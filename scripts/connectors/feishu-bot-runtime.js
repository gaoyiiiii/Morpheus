const path = require('path');
const { resolveFetch } = require('./node-fetch-compat');
const {
  requestAITextWithProviderFallback,
} = require('./morph-plugin-source-worker');

const FEISHU_PENDING_REACTION_TYPES = String(process.env.MORPH_FEISHU_PENDING_REACTIONS || 'Typing,OnIt,OneSecond')
  .split(',')
  .map((item) => String(item || '').trim())
  .filter(Boolean);
const FEISHU_PENDING_REACTION_MIN_VISIBLE_MS = Math.max(0, Number(process.env.MORPH_FEISHU_PENDING_REACTION_MIN_VISIBLE_MS) || 900);

function toSafeText(value, maxLen = 4000) {
  return String(value || '').trim().slice(0, maxLen);
}

function buildRequestId(prefix = 'feishu') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function delay(ms = 0) {
  const safe = Math.max(0, Number(ms) || 0);
  return new Promise((resolve) => setTimeout(resolve, safe));
}

function getBeijingNowText() {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch (_) {
    return new Date().toISOString();
  }
}

function getTodayInShanghai() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const lookup = Object.fromEntries(parts.map((item) => [item.type, item.value]));
    return `${lookup.year}-${lookup.month}-${lookup.day}`;
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function getYesterdayInShanghai() {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(yesterday);
    const lookup = Object.fromEntries(parts.map((item) => [item.type, item.value]));
    return `${lookup.year}-${lookup.month}-${lookup.day}`;
  } catch (_) {
    return '';
  }
}

function extractFeishuTextContent(content = '') {
  const raw = String(content || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return String(parsed?.text || parsed?.title || '').trim();
  } catch (_) {
    return raw;
  }
}

function normalizeMemoryTargetFile(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (/(^|[^\w-])memory-system\.?md([^\w-]|$)/i.test(raw)) return 'memory-system.md';
  if (/(^|[^\w-])identity\.?md([^\w-]|$)/i.test(raw)) return 'identity.md';
  if (/(^|[^\w-])user\.?md([^\w-]|$)/i.test(raw)) return 'user.md';
  if (/(^|[^\w-])memory\.?md([^\w-]|$)/i.test(raw)) return 'memory.md';
  if (/(^|[^\w-])soul\.?md([^\w-]|$)/i.test(raw)) return 'soul.md';
  return '';
}

function extractUserNameMemorySignal(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return '';
  const patterns = [
    /(?:以后叫我|你可以叫我|从今天开始叫我|叫我的真名|我的真名是|我的名字是|我叫|名字叫)\s*[：:，,\s]*([^\n，。；;,.!?！？]{1,24})/u,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return toSafeText(match[1], 24);
  }
  return '';
}

function inferStableUserMemoryEntry(body = '') {
  const text = String(body || '').trim();
  if (!text) return null;
  if (/^(?:我今天|我昨日|我昨天|我刚刚|我刚才|我现在|我这会儿|我此刻|刚刚我|刚才我)/.test(text)) return null;
  if ( (/(不要|别|少用|默认不要).*(列表|bullet|项目符号|提纲)/.test(text) && /(回答|说话|聊天|表达|回复|对话)/.test(text))
    || (/(一段一段|自然段|像正常人聊天|像人聊天|正常人说话)/.test(text) && /(回答|说话|聊天|表达|回复|对话)/.test(text)) ) {
    return {
      sectionTitle: '回答表达偏好',
      content: '默认用自然段表达，少用列表；只有内容本身确实需要步骤、选项或清单时，再用编号。',
    };
  }
  if (/(自然点|像人一点|像正常人|少系统腔|少表演感|别太像ai|不要太像ai|不要油滑|不要演)/i.test(text)) {
    return {
      sectionTitle: '回答表达偏好',
      content: '回答更自然、更像人话，少系统腔、少表演感，不要为了像人而演。',
    };
  }
  if (/日志/.test(text) && /(保留原话|保留原文|保留原味|别整理|不要整理|不要改写|直接放进去|稍微做调整|留住.*写作)/.test(text)) {
    return {
      sectionTitle: '日志记录偏好',
      content: '用户给了成型原文时，日志优先保留原话、段落节奏和思考细节，只做必要清理。',
    };
  }
  if (/日志/.test(text) && /(整理|归纳|改写|润色|生成一版)/.test(text) && /(需要|想要|要|让我|请你|帮我|有时候)/.test(text)) {
    return {
      sectionTitle: '日志记录偏好',
      content: '当用户明确要求整理、归纳、改写或生成一版日志时，可以主动重组结构与措辞。',
    };
  }
  if (!/^(?:我|对我来说|我一般|我通常|我总是|我会|我容易|我希望|我想要|我不想|我喜欢|我不喜欢|我讨厌|我更喜欢|我更偏向|我习惯|我需要|我最好|我无论如何最好|默认|请默认|以后)/.test(text)) {
    return null;
  }
  const sectionTitle = /(回答|说话|聊天|表达|回复|语气|口吻|列表|bullet|项目符号|提纲)/i.test(text)
    ? '回答表达偏好'
    : /日志|日记|日志/i.test(text)
      ? '日志记录偏好'
      : /(做饭|下厨|吃饭|外卖|咖啡|喝咖啡|茶|夜宵|口味|饮食)/.test(text)
        ? '饮食偏好'
        : /(早睡|晚睡|午睡|起床|作息|休息|喝水|散步|运动|通勤|留出休息|休息一下)/.test(text)
          ? '作息与休息偏好'
          : /(番茄钟|低中断|专注|一次只做一件|小步推进|拆小步|连续工作|沉浸|推进节奏|工作方式|做事方式)/.test(text)
            ? '工作方式偏好'
            : /(生活|家务|洗牙|装修|做家务)/.test(text)
              ? '生活偏好'
              : '长期偏好';
  return {
    sectionTitle,
    content: text,
  };
}

function detectDeterministicMemoryShortcut(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  const explicitTargetFile = normalizeMemoryTargetFile(normalized);
  const explicitRewrite = explicitTargetFile && /^(?:帮我|请|麻烦你)?\s*(?:修改|改写|重写|更新)/i.test(normalized);
  const rememberMatch = normalized.match(/^(?:请(?:你|我)?帮?我?)?(?:请记住|记住|记下)(?!这一点|这点|这个|那句|刚才)(?:[，,：:\s]+|)([\s\S]{2,2000})$/i);
  if (!rememberMatch && !explicitRewrite) return null;
  const stripExplicitTargetLead = (value = '') => {
    return explicitTargetFile
      ? String(value || '')
        .replace(/^(?:写进|写入|放进|放入|存进|存入|记进|记入|改写|重写|更新|修改)\s*(?:你的)?\s*(?:soul|user|identity|memory(?:-system)?)\.?md\s*[，,：:\s]*/i, '')
        .trim()
      : String(value || '').trim();
  };
  const body = stripExplicitTargetLead(rememberMatch?.[1] || normalized);
  if (!body || body.length < 2) return null;
  const userName = extractUserNameMemorySignal(normalized);
  if (userName && /(以后叫我|你可以叫我|从今天开始叫我|叫我的真名|真名|我的名字是|我叫|名字叫)/.test(normalized)) {
    return {
      type: 'memory_write_user',
      payload: {
        sectionTitle: '名字与称呼',
        content: `用户名字：${userName}`,
        targetFile: explicitTargetFile || 'user.md',
      },
      replyText: '已记住，并写入 user.md：名字与称呼',
    };
  }
  const isAIPersonaAssignment = /^(?:从(?:现在|今天|此刻)(?:开始|起)?[，,\s]*)?你(?:就)?是/.test(body)
    || /^(?:从(?:现在|今天|此刻)(?:开始|起)?[，,\s]*)?你(?:的)?(?:名字|身份|角色|人设|设定|背景|故事|经历)/.test(body)
    || /^(?:你|以后你|从现在开始你)(?:叫|叫做|就叫|是叫)/.test(body);
  if (explicitRewrite) {
    const sectionTitle = explicitTargetFile === 'memory-system.md'
      ? '运行规则'
      : explicitTargetFile === 'identity.md'
        ? '自我定位'
        : explicitTargetFile === 'memory.md'
          ? '长期索引'
          : '长期记忆';
    return {
      type: 'memory_rewrite_section',
      payload: {
        sectionTitle,
        content: body,
        targetFile: explicitTargetFile,
      },
      replyText: `已更新 ${explicitTargetFile}：${sectionTitle}`,
    };
  }
  if (isAIPersonaAssignment) {
    const targetFile = explicitTargetFile || 'soul.md';
    return {
      type: 'write_soul_memory',
      payload: {
        sectionTitle: 'AI 角色设定',
        content: body,
        targetFile,
      },
      replyText: `已记住，并写入 ${targetFile}：AI 角色设定`,
    };
  }
  const stableUserMemoryEntry = inferStableUserMemoryEntry(body);
  if ((explicitTargetFile || 'soul.md') === 'user.md' || stableUserMemoryEntry) {
    return {
      type: 'memory_write_user',
      payload: {
        sectionTitle: stableUserMemoryEntry?.sectionTitle || '长期偏好',
        content: stableUserMemoryEntry?.content || body,
        targetFile: explicitTargetFile || 'user.md',
      },
      replyText: `已记住，并写入 user.md：${stableUserMemoryEntry?.sectionTitle || '长期偏好'}`,
    };
  }
  const targetFile = explicitTargetFile || 'soul.md';
  const sectionTitle = targetFile === 'identity.md'
    ? '自我定位'
    : targetFile === 'memory.md'
      ? '长期索引'
      : targetFile === 'memory-system.md'
        ? '运行规则'
        : '长期记忆';
  return {
    type: 'write_soul_memory',
    payload: {
      sectionTitle,
      content: body,
      targetFile,
    },
    replyText: `已记住，并写入 ${targetFile}：${sectionTitle}`,
  };
}

function parseLegacyDailyHeadingDate(text = '') {
  const match = String(text || '').trim().match(/\[\s*日志\s*\]\s*(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function readBlockText(block = {}) {
  return toSafeText(block?.text || block?.content || '', 4000);
}

function collectLegacyDailyEntries(rows = []) {
  const items = [];
  let current = null;
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const date = parseLegacyDailyHeadingDate(row?.content || row?.text || '');
    if (date) {
      if (current && current.blocks.length) items.push(current);
      current = { date, blocks: [] };
      return;
    }
    if (!current) return;
    const text = readBlockText(row);
    if (!text) return;
    current.blocks.push({
      type: toSafeText(row?.type, 20),
      text,
    });
  });
  if (current && current.blocks.length) items.push(current);
  return items;
}

function collectStructuredDailyEntries(dailyMonths = {}) {
  const items = [];
  Object.entries(dailyMonths && typeof dailyMonths === 'object' ? dailyMonths : {}).forEach(([monthKey, monthEntry]) => {
    const days = monthEntry && typeof monthEntry === 'object' && !Array.isArray(monthEntry)
      ? monthEntry.days
      : null;
    if (!days || typeof days !== 'object') return;
    Object.entries(days).forEach(([date, entry]) => {
      const blocks = Array.isArray(entry?.blocks) ? entry.blocks : [];
      items.push({
        date,
        blocks: blocks
          .map((block) => ({
            type: toSafeText(block?.type, 20),
            text: readBlockText(block),
          }))
          .filter((block) => block.text),
        monthKey,
      });
    });
  });
  return items;
}

function collectAllDailyEntries(data = {}) {
  const dailyMonths = data && data.dailyMonths && typeof data.dailyMonths === 'object'
    ? data.dailyMonths
    : {};
  const structured = collectStructuredDailyEntries(dailyMonths);
  if (structured.length) {
    return structured
      .filter((item) => Array.isArray(item.blocks) && item.blocks.length)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }
  const legacy = [];
  Object.entries(dailyMonths).forEach(([monthKey, rows]) => {
    if (!Array.isArray(rows)) return;
    collectLegacyDailyEntries(rows).forEach((entry) => {
      legacy.push({
        ...entry,
        monthKey,
      });
    });
  });
  return legacy
    .filter((item) => Array.isArray(item.blocks) && item.blocks.length)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function summarizeDailyEntry(entry = {}) {
  const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];
  return blocks
    .map((block) => toSafeText(block?.text || '', 220))
    .filter(Boolean)
    .slice(0, 6);
}

function formatDailyEntryReply(date = '', entry = null) {
  const safeDate = toSafeText(date, 20);
  const lines = entry ? summarizeDailyEntry(entry) : [];
  if (!lines.length) {
    return `今天（${safeDate}）的日志里，我这边还没有读到明确内容。`;
  }
  return [
    `${safeDate} 的日志里有这些：`,
    '',
    ...lines.map((line) => `- ${line}`),
  ].join('\n');
}

function summarizeRecentDaily(data) {
  const entries = collectAllDailyEntries(data);
  return entries
    .slice(-4)
    .flatMap((entry) => summarizeDailyEntry(entry).map((text) => `[${entry.date}] ${text}`))
    .slice(-8);
}

function readHealthNumber(value, digits = null) {
  if (value == null) return '';
  if (typeof value === 'string' && !value.trim()) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (digits == null) return String(Math.round(n));
  return n.toFixed(digits).replace(/\.?0+$/, '');
}

function buildFeishuGlucoseSummary(data = {}) {
  const bundle = data?.glucoseSync && typeof data.glucoseSync === 'object' ? data.glucoseSync : null;
  if (!bundle) return '';
  const reading = bundle.reading && typeof bundle.reading === 'object' ? bundle.reading : null;
  const series = Array.isArray(bundle.series) ? bundle.series : [];
  const archive = Array.isArray(data?.glucoseHistoryArchive) ? data.glucoseHistoryArchive : [];
  if (!reading && !series.length && !archive.length) return '';
  const lines = ['血糖上下文：'];
  const updatedAt = toSafeText(bundle.updatedAt, 80);
  if (updatedAt) lines.push(`- 最近同步：${updatedAt}`);
  if (reading && Number.isFinite(Number(reading.value))) {
    const value = Number(reading.value);
    const mmol = (value / 18).toFixed(1);
    const trend = toSafeText(reading.trend, 40);
    const timestamp = toSafeText(reading.timestamp, 80);
    lines.push(`- 当前读数：${Math.round(value)} mg/dL（${mmol} mmol/L）${trend ? `，趋势 ${trend}` : ''}${timestamp ? `，时间 ${timestamp}` : ''}`);
  }
  const targetLow = Number.isFinite(Number(bundle?.range?.targetLow)) ? Number(bundle.range.targetLow) : 70;
  const targetHigh = Number.isFinite(Number(bundle?.range?.targetHigh)) ? Number(bundle.range.targetHigh) : 180;
  lines.push(`- 目标范围：${Math.round(targetLow)}-${Math.round(targetHigh)} mg/dL`);
  const totalPoints = Math.max(series.length, archive.length);
  if (totalPoints > 0) lines.push(`- 历史序列点数：${totalPoints}`);
  return lines.join('\n');
}

function buildFeishuAppleHealthSummary(data = {}) {
  const bundle = data?.appleHealthSync && typeof data.appleHealthSync === 'object' ? data.appleHealthSync : null;
  if (!bundle) return '';
  const snapshot = bundle.snapshot && typeof bundle.snapshot === 'object' ? bundle.snapshot : null;
  const history = bundle.history && typeof bundle.history === 'object' ? bundle.history : null;
  if (!snapshot && !history) return '';
  const lines = ['Apple 健康上下文：'];
  const updatedAt = toSafeText(bundle.updatedAt, 80);
  if (updatedAt) lines.push(`- 最近同步：${updatedAt}`);
  if (snapshot) {
    const windowHours = readHealthNumber(snapshot.windowHours);
    if (windowHours) lines.push(`- 统计窗口：约 ${windowHours} 小时`);
    const steps = readHealthNumber(snapshot.steps);
    if (steps) lines.push(`- 步数：${steps}`);
    const energy = readHealthNumber(snapshot.activeEnergyKcal);
    if (energy) lines.push(`- 活动能量：${energy} kcal`);
    const distanceMeters = Number(snapshot.distanceMeters);
    if (Number.isFinite(distanceMeters)) lines.push(`- 距离：${(distanceMeters / 1000).toFixed(2)} km`);
    const resting = readHealthNumber(snapshot.restingHeartRateBpm);
    if (resting) lines.push(`- 静息心率：${resting} bpm`);
    const bodyMass = readHealthNumber(snapshot.bodyMassKg, 1);
    if (bodyMass) lines.push(`- 体重：${bodyMass} kg`);
    const bloodGlucose = readHealthNumber(snapshot.bloodGlucoseMmolPerL, 1);
    if (bloodGlucose) lines.push(`- HealthKit 血糖：${bloodGlucose} mmol/L`);
    const sleep = snapshot.sleep && typeof snapshot.sleep === 'object' ? snapshot.sleep : null;
    if (sleep) {
      const asleep = readHealthNumber(sleep.asleepHours, 1);
      const inBed = readHealthNumber(sleep.inBedHours, 1);
      if (asleep || inBed) lines.push(`- 睡眠：${asleep ? `实际 ${asleep} h` : ''}${asleep && inBed ? '，' : ''}${inBed ? `卧床 ${inBed} h` : ''}`);
    }
    const heartRateSamples = Array.isArray(snapshot.heartRateSamples) ? snapshot.heartRateSamples : [];
    if (heartRateSamples.length) lines.push(`- 当前窗口心率样本：${heartRateSamples.length} 条`);
  }
  if (history) {
    const activityDaily = Array.isArray(history.activityDaily) ? history.activityDaily : [];
    const sleepDaily = Array.isArray(history.sleepDaily) ? history.sleepDaily : [];
    const restingDaily = Array.isArray(history.restingHeartRateDaily) ? history.restingHeartRateDaily : [];
    const heartHistory = Array.isArray(history.heartRateSamples) ? history.heartRateSamples : [];
    const bodyMassSamples = Array.isArray(history.bodyMassSamples) ? history.bodyMassSamples : [];
    const glucoseSamples = Array.isArray(history.bloodGlucoseSamples) ? history.bloodGlucoseSamples : [];
    if (activityDaily.length || sleepDaily.length || restingDaily.length || heartHistory.length || bodyMassSamples.length || glucoseSamples.length) {
      lines.push(`- 长期历史：活动 ${activityDaily.length} 天，睡眠 ${sleepDaily.length} 天，静息心率 ${restingDaily.length} 天，心率样本 ${heartHistory.length} 条，体重 ${bodyMassSamples.length} 条，血糖 ${glucoseSamples.length} 条`);
    }
  }
  return lines.join('\n');
}

function buildMorphContextSummary(data = {}) {
  const flashThoughts = Array.isArray(data.flashThoughts) ? data.flashThoughts : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const reminders = Array.isArray(data.reminders) ? data.reminders : [];
  const routines = Array.isArray(data.routines) ? data.routines : [];

  // 记账数据注入
  const expenseLedger = data.expenseLedger && typeof data.expenseLedger === 'object'
    ? data.expenseLedger : {};
  const expenseRecords = Array.isArray(expenseLedger.records) ? expenseLedger.records : [];
  const expenseCategories = Array.isArray(expenseLedger.categories) ? expenseLedger.categories : [];
  const recentExpenses = expenseRecords
    .slice(-5)
    .reverse()
    .map((item) => {
      const spentAt = item?.spentAt ? String(item.spentAt).slice(0, 10) : '';
      const itemName = toSafeText(item?.item || '', 60);
      const category = toSafeText(item?.category || '', 40);
      const amount = Number(item?.amount || 0);
      const note = toSafeText(item?.note || '', 80);
      const notePart = note && !note.includes('UTC') ? ` | ${note}` : '';
      return `- ${spentAt} ${itemName} ${category} ¥${amount.toFixed(1)}${notePart}`;
    })
    .filter(Boolean);

  const recentFlash = flashThoughts
    .slice(-6)
    .map((item) => `- ${toSafeText(item?.text || '', 180)}`)
    .filter(Boolean);
  const recentProjects = projects
    .slice(-5)
    .map((item) => {
      const name = toSafeText(item?.name || '未命名项目', 80);
      const status = toSafeText(item?.status || '', 40);
      return `- ${name}${status ? ` | ${status}` : ''}`;
    })
    .filter(Boolean);
  const openReminders = reminders
    .filter((item) => !item?.completedAt)
    .slice(0, 6)
    .map((item) => {
      const title = toSafeText(item?.title || item?.text || '未命名提醒', 120);
      const dueAt = toSafeText(item?.dueAt || '', 80);
      return `- ${title}${dueAt ? ` | ${dueAt}` : ''}`;
    });
  const recentDaily = summarizeRecentDaily(data);
  const glucoseSummary = buildFeishuGlucoseSummary(data);
  const appleHealthSummary = buildFeishuAppleHealthSummary(data);

  const expenseSummary = expenseRecords.length
    ? `记账概况：共 ${expenseRecords.length} 条记录，分类 ${expenseCategories.length} 个。`
    : '';
  const expenseDetail = recentExpenses.length
    ? `最近消费（最近5条）：\n${recentExpenses.join('\n')}`
    : '';

  return [
    `当前时间：${getBeijingNowText()}（Asia/Shanghai）`,
    `Morpheus 数据概况：闪念 ${flashThoughts.length} 条，项目 ${projects.length} 个，提醒 ${reminders.length} 条，节律 ${routines.length} 条，记账 ${expenseRecords.length} 条。`,
    recentProjects.length ? `最近项目：\n${recentProjects.join('\n')}` : '',
    openReminders.length ? `未完成提醒：\n${openReminders.join('\n')}` : '',
    recentFlash.length ? `最近闪念：\n${recentFlash.join('\n')}` : '',
    recentDaily.length ? `最近日志：\n${recentDaily.join('\n')}` : '',
    expenseSummary,
    expenseDetail,
    glucoseSummary,
    appleHealthSummary,
  ].filter(Boolean).join('\n\n');
}

function looksLikeRecentSituationAnalysisQuestion(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  const asksRecent = /(最近情况|最近状态|最近怎么样|近期情况|这几天情况|整体情况)/.test(normalized);
  const asksAnalysis = /(分析|总结|梳理|看看|复盘|重点看)/.test(normalized);
  const mentionsMorphDomains = /(项目|日志|闪念|提醒|记账|账本|消费|日程|任务)/.test(normalized);
  return asksRecent && (asksAnalysis || mentionsMorphDomains);
}

function buildRecentSituationAnalysisReply(data = {}) {
  const context = buildMorphContextSummary(data);
  const lines = [
    '我先按当前 Morpheus 数据做一个本地摘要：',
    '',
    context || '我这边当前没有读到足够明确的项目、日志、闪念、提醒或记账数据。',
  ];
  if (context) {
    lines.push('');
    lines.push('初步判断：先看未完成提醒和最近项目，确认今天还需要推进什么；再用最近日志和闪念判断状态变化；记账部分可以作为这几天生活/支出节奏的辅助线索。');
  }
  return lines.join('\n');
}

function tryAnswerRecentSituationAnalysisQuestion(text = '', data = {}) {
  if (!looksLikeRecentSituationAnalysisQuestion(text)) return '';
  return buildRecentSituationAnalysisReply(data);
}

function buildConversationHistoryText(history = []) {
  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];
  if (!safeHistory.length) return '';
  return safeHistory
    .map((item) => {
      const role = item?.role === 'assistant' ? 'Morpheus' : '用户';
      return `${role}：${toSafeText(item?.content || '', 800)}`;
    })
    .filter(Boolean)
    .join('\n');
}

function buildFeishuBotPrompt({ question = '', history = [], data = {} } = {}) {
  const trimmedQuestion = toSafeText(question, 2000);
  const contextSummary = buildMorphContextSummary(data);
  const historyText = buildConversationHistoryText(history);
  return [
    '你是 Morpheus，一个本地优先、数据可带走、偏个人工作流与长期状态管理的中文助手。',
    '回复要求：自然、温和、直接，默认用简体中文；不要提自己是模型；不知道的就坦白；不要编造已经写入了某条数据，除非系统明确告诉你写入成功。',
    '当前是飞书机器人入口，先以对话陪伴和工作流梳理为主。若用户是在闲聊，就顺着聊；若用户在问自己的项目、提醒、日志、闪念，请优先利用提供的 Morpheus 上下文回答。',
    '如果用户要求执行写入型动作，而系统没有明确写入成功回执，你只能给建议或让用户改用明确指令，不要假装已经写入。',
    contextSummary,
    historyText ? `最近对话：\n${historyText}` : '',
    `用户这次发来的消息：\n${trimmedQuestion}`,
    '请直接输出最终回复正文，不要加角色名前缀。',
  ].filter(Boolean).join('\n\n');
}

function parseReminderShortcut(text = '') {
  const match = String(text || '').trim().match(/^提醒[：:]\s*(.+?)(?:\s+@\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?))?\s*$/);
  if (!match) return null;
  return {
    title: toSafeText(match[1], 200),
    dueAt: toSafeText(match[2], 40),
  };
}

function parseExpenseAmountFromNaturalText(text = '') {
  const raw = String(text || '').replace(/[,，]/g, '').trim();
  if (!raw) return 0;
  const colloquialMatch = raw.match(/(\d+)\s*块\s*(\d{1,2})(?:\s*(?:毛|角))?/i);
  if (colloquialMatch) {
    const whole = Number(colloquialMatch[1] || 0);
    const fraction = Number(`0.${String(colloquialMatch[2] || '').slice(0, 2)}`);
    const value = whole + (Number.isFinite(fraction) ? fraction : 0);
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  }
  const directMatch = raw.match(/(?:¥|￥|rmb\s*)?(\d+(?:\.\d{1,2})?)/i);
  if (directMatch) {
    const value = Number(directMatch[1] || 0);
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  }
  return 0;
}

function inferExpenseCategoryFromText(text = '') {
  const q = String(text || '').toLowerCase();
  if (!q) return '日用百货';
  if (/(医院|看病|挂号|体检|药|药店|诊所|保健|牙医|复诊)/i.test(q)) return '医疗保健';
  if (/(地铁|公交|打车|高铁|火车|机票|加油|停车|过路费|滴滴|出行|洗车|修车|保养)/i.test(q)) return '交通出行';
  if (/(咖啡|奶茶|午餐|晚餐|早餐|夜宵|外卖|吃饭|餐|饮料|煎饼|包子|面包|面条|米饭|盒饭)/i.test(q)) return '餐饮';
  if (/(房租|租金)/i.test(q)) return '房租';
  if (/(房贷|月供|按揭)/i.test(q)) return '房贷';
  if (/(车贷)/i.test(q)) return '车贷';
  if (/(物业|物业费)/i.test(q)) return '物业';
  if (/(水费|电费|燃气|煤气|宽带|话费)/i.test(q)) return '水电气';
  return '日用百货';
}

function cleanExpenseItemText(text = '') {
  return String(text || '')
    .replace(/^(?:请|帮我|麻烦你)?\s*(?:记一笔账|记账|记一下账|记一下|记一笔)[：:\s]*/i, '')
    .replace(/^(?:今天|刚刚|刚才|昨晚|昨天|上午|中午|下午|晚上)\s*/i, '')
    .replace(/(?:花了|花费|用了|付了|消费了|支出了).*/i, '')
    .replace(/(?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?/ig, '')
    .replace(/[，。,；;]+$/g, '')
    .trim();
}

function extractExpenseRecordShortcut(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized || /[?？]/.test(normalized)) return null;
  const explicit = normalized.match(/^(?:记账|记一笔账|记一下账)[：:]\s*(.+)$/i);
  if (explicit) {
    const rawBody = String(explicit[1] || '').trim();
    const amount = parseExpenseAmountFromNaturalText(rawBody);
    const item = cleanExpenseItemText(rawBody);
    if (Number.isFinite(amount) && amount > 0 && item) {
      return {
        type: 'add_expense_record',
        payload: {
          item,
          amount,
          category: inferExpenseCategoryFromText(rawBody),
          spentAt: getBeijingNowText().replace(/\//g, '-').replace(',', '').slice(0, 16),
          note: '',
        },
      };
    }
  }
  if (!/(花了|花费|用了|付了|消费了|支出了|记账|记一笔|打车|停车费|咖啡|奶茶|外卖|早餐|午餐|晚餐|夜宵|房租|房贷|车贷|物业|电费|水费|燃气费|话费|宽带|快递|运费|挂号费|药费)/i.test(normalized)) {
    const looseAmount = parseExpenseAmountFromNaturalText(normalized);
    const looseItem = cleanExpenseItemText(normalized);
    if (!Number.isFinite(looseAmount) || looseAmount <= 0 || !looseItem || looseItem.length > 40) return null;
    if (!/(?:元|块|块钱|¥|￥|rmb)/i.test(normalized)) return null;
    return {
      type: 'add_expense_record',
      payload: {
        item: looseItem,
        amount: looseAmount,
        category: inferExpenseCategoryFromText(normalized),
        spentAt: getBeijingNowText().replace(/\//g, '-').replace(',', '').slice(0, 16),
        note: '',
      },
    };
  }
  const amount = parseExpenseAmountFromNaturalText(normalized);
  const item = cleanExpenseItemText(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || !item) return null;
  return {
    type: 'add_expense_record',
    payload: {
      item,
      amount,
      category: inferExpenseCategoryFromText(normalized),
      spentAt: getBeijingNowText().replace(/\//g, '-').replace(',', '').slice(0, 16),
      note: '',
    },
  };
}

function extractTrailingDailyLogWriteContent(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return '';
  const match = normalized.match(/^(.+?)[，,。；;\s]*(?:这一句(?:话)?|这句(?:话)?|这条|这段|这段话)?\s*(?:写进|写入|记进|记入|放进|放入|存进|存入|追加到|补进)\s*(?:今天的日志|今日日志|今天日志)(?:里|中|里面)?\s*[。！!？?]*$/);
  const candidate = toSafeText(match?.[1] || '', 1200).replace(/^(?:帮我|请|麻烦你|把|将)\s*/i, '').trim();
  if (!candidate || /^(?:这(?:一)?句(?:话)?|这条|这段(?:话)?|这个|这些|那句|那段|它)$/i.test(candidate)) return '';
  return candidate;
}

function looksLikeDailyLogWriteIntent(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  if (extractTrailingDailyLogWriteContent(normalized)) return true;
  return /(?:写进|写入|记进|记入|放进|放入|存进|存入|追加到|补进).{0,8}(?:今天的日志|今日日志|今天日志)(?:里|中|里面)?/i.test(normalized)
    || /(?:今天的日志|今日日志|今天日志).{0,8}(?:写进|写入|记进|记入|放进|放入|存进|存入|追加|补进)/i.test(normalized)
    || /^(?:日志|写日志|记录日志)[：:]\s*(.+)\s*$/i.test(normalized);
}

function detectDeterministicMorphShortcut(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  const memoryShortcut = detectDeterministicMemoryShortcut(normalized);
  if (memoryShortcut) return memoryShortcut;
  const naturalTodayLogWriteText = extractTrailingDailyLogWriteContent(normalized);
  if (naturalTodayLogWriteText) {
    return {
      type: 'append_daily_log',
      payload: {
        date: getTodayInShanghai(),
        text: naturalTodayLogWriteText,
      },
    };
  }
  const flashMatch = normalized.match(/^(?:记一下|帮我记一下)[：:]\s*(.+)\s*$/);
  if (flashMatch) {
    return {
      type: 'create_flash_thought',
      payload: { text: toSafeText(flashMatch[1], 500) },
    };
  }
  const dailyMatch = normalized.match(/^(?:日志|写日志|记录日志)[：:]\s*(.+)\s*$/);
  if (dailyMatch) {
    return {
      type: 'append_daily_log',
      payload: {
        date: getTodayInShanghai(),
        text: toSafeText(dailyMatch[1], 1200),
      },
    };
  }
  const reminder = parseReminderShortcut(normalized);
  if (reminder && reminder.title) {
    return {
      type: 'create_reminder',
      payload: {
        title: reminder.title,
        dueAt: reminder.dueAt || '',
      },
    };
  }
  const expenseRecord = extractExpenseRecordShortcut(normalized);
  if (expenseRecord) return expenseRecord;
  return null;
}

function resolveDailyLogDateFromQuestion(text = '') {
  const normalized = String(text || '').trim();
  if (!/(日志|日记)/.test(normalized)) return '';
  const iso = normalized.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const md = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (md) {
    const year = getTodayInShanghai().slice(0, 4);
    const month = String(Number(md[1])).padStart(2, '0');
    const day = String(Number(md[2])).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (/今天/.test(normalized)) return getTodayInShanghai();
  if (/昨天/.test(normalized)) return getYesterdayInShanghai();
  return '';
}

function tryAnswerDailyLogQuestion(text = '', data = {}) {
  if (looksLikeDailyLogWriteIntent(text)) return null;
  const targetDate = resolveDailyLogDateFromQuestion(text);
  if (!targetDate) return null;
  const entry = collectAllDailyEntries(data).find((item) => String(item?.date || '').trim() === targetDate) || null;
  return formatDailyEntryReply(targetDate, entry);
}

function inferConversationRecallReadRequestFromQuestion(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  if (/(日志|提醒|项目|记账|账单|血糖|健康|苹果健康|healthkit)/i.test(normalized)) return null;
  if (/(?:删除|删掉|移除|去掉|清除|修改|更新|写入|写进|补充|记住|记下)/.test(normalized) && !/(聊过什么|说过什么|聊到什么|提到什么)/.test(normalized)) {
    return null;
  }
  const conversationRecallLike = /(?:你记得|还记得|记不记得).{0,10}(?:我们|昨天|今天|刚刚|刚才|上次|之前|前面|这次).{0,10}(?:聊过什么|说过什么|聊到什么|提到什么)|(?:昨天|今天|刚刚|刚才|上次|之前|前面|这次).{0,6}(?:我们).{0,6}(?:聊过什么|说过什么|聊到什么|提到什么)|(?:我们).{0,8}(?:昨天|今天|刚刚|刚才|上次|之前|前面|这次).{0,8}(?:聊过什么|说过什么|聊到什么|提到什么)/i.test(normalized);
  if (!conversationRecallLike) return null;
  let scope = 'recent';
  if (/(昨天|昨日)/.test(normalized)) scope = 'yesterday';
  else if (/(今天|今日|刚刚|刚才|这次|这一轮)/.test(normalized)) scope = 'today';
  else if (/(上次|前一次|上一个会话|之前|前面)/.test(normalized)) scope = 'previous-session';
  return { type: 'recall_chat_history', scope, rawQuestion: normalized };
}

function toShanghaiDateKey(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = Date.parse(text);
  const hasTimeOrZone = /[Tt]\d{2}:\d{2}|(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  if (Number.isFinite(parsed) && hasTimeOrZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date(parsed));
      const lookup = Object.fromEntries(parts.map((item) => [item.type, item.value]));
      return `${lookup.year}-${lookup.month}-${lookup.day}`;
    } catch (_) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
  }
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (direct?.[1]) return direct[1];
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toISOString().slice(0, 10);
}

function summarizeConversationTopics(history = [], options = {}) {
  const excludeQuestion = String(options?.excludeQuestion || '').trim();
  const highlights = (Array.isArray(history) ? history : [])
    .filter((item) => String(item?.role || '').trim() === 'user')
    .map((item) => toSafeText(item?.content || '', 400))
    .filter(Boolean)
    .filter((text) => !excludeQuestion || text !== excludeQuestion)
    .filter((text) => !/^(思考中|继续|还有呢|然后呢|具体有哪些|嗯|哦|好|好的|在吗|确认|收到|行|行啊|可以|可以的|知道了|明白了|\?|？)[。！!？?]*$/.test(text))
    .filter((text) => !/(聊过什么|说过什么|聊到什么|提到什么)/.test(text));
  const preferred = highlights.filter((text) => /(?:记住|以后|叫我|我叫|我喜欢|我不喜欢|希望|不要|别|习惯|表情|emoji|颜文字)/i.test(text));
  return Array.from(new Set((preferred.length ? preferred : highlights).slice(-3).map((text) => String(text || '').replace(/[。！!？?]+$/u, '').trim()).filter(Boolean)));
}

function buildConversationRecallReply(request = {}, history = []) {
  const scope = String(request?.scope || 'recent').trim() || 'recent';
  const rawQuestion = String(request?.rawQuestion || '').trim();
  const safeHistory = Array.isArray(history) ? history.slice(-20) : [];
  const todayStr = getTodayInShanghai();
  const yesterdayStr = getYesterdayInShanghai();
  const currentHighlights = summarizeConversationTopics(safeHistory, { excludeQuestion: rawQuestion });
  const groupByDate = new Map();
  safeHistory.forEach((item) => {
    const dateKey = toShanghaiDateKey(item?.at || '');
    if (!dateKey) return;
    const bucket = Array.isArray(groupByDate.get(dateKey)) ? groupByDate.get(dateKey) : [];
    bucket.push(item);
    groupByDate.set(dateKey, bucket);
  });
  if (scope === 'yesterday') {
    const yesterdayHighlights = summarizeConversationTopics(groupByDate.get(yesterdayStr) || [], { excludeQuestion: rawQuestion });
    if (yesterdayHighlights.length) return `昨天（${yesterdayStr}）可确认聊到：${yesterdayHighlights.join('；')}。`;
    if (currentHighlights.length) return `我这里没找到 ${yesterdayStr} 的对话证据。能确认的是，今天这轮刚刚聊到：${currentHighlights.join('；')}。所以这件事不该算成昨天。`;
    return `我这里没找到 ${yesterdayStr} 的对话证据，所以不能把某条长期记忆直接说成“昨天聊过”。`;
  }
  if (scope === 'today') {
    const todayHighlights = summarizeConversationTopics(groupByDate.get(todayStr) || safeHistory, { excludeQuestion: rawQuestion });
    if (todayHighlights.length) return `今天（${todayStr}）可确认聊到：${todayHighlights.join('；')}。`;
    return '我这里暂时没整理出今天这轮足够明确的对话线索。';
  }
  if (scope === 'previous-session') {
    const dateKeys = Array.from(groupByDate.keys()).sort((a, b) => String(b).localeCompare(String(a)));
    const previousDate = dateKeys.find((item) => item && item !== todayStr) || '';
    const previousHighlights = summarizeConversationTopics(groupByDate.get(previousDate) || [], { excludeQuestion: rawQuestion });
    if (previousHighlights.length) return `${previousDate ? `上一次可确认的对话在 ${previousDate}。` : '上一次可确认的对话里，'}主要聊到：${previousHighlights.join('；')}。`;
    if (currentHighlights.length) return `我现在更能确认的是这轮刚刚聊到：${currentHighlights.join('；')}。更早一轮的会话线索不够稳，先不硬说。`;
    return '我现在拿不到足够稳的上一轮会话线索，所以不想硬编。';
  }
  if (currentHighlights.length) return `最近这轮可确认聊到：${currentHighlights.join('；')}。`;
  return '我现在拿不到足够稳的对话历史线索，所以不想把长期记忆冒充成某次具体聊天。';
}

function isAppleHealthVisibilityQuestion(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  const asksAppleHealth = /(苹果健康|apple\s*health|healthkit|健康数据)/i.test(normalized);
  const asksVisibility = /(能看到|看得到|读到|同步到|接入了|有了吗|现在呢|读取到|拿到)/.test(normalized);
  const asksStatus = /(数据如何|情况如何|状态如何|怎么样了|怎么样|什么情况|啥情况|有数据吗|有没有数据)/.test(normalized);
  return asksAppleHealth && (asksVisibility || asksStatus);
}

function isAppleHealthFollowupQuestion(text = '', history = []) {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  const isShortFollowup = /^(现在呢|现在有了吗|现在怎么样|现在可以了吗|还是一样|有了吗|现在行了吗|那现在呢)[？?！!。.]?$/u.test(normalized);
  if (!isShortFollowup) return false;
  const recent = Array.isArray(history) ? history.slice(-6) : [];
  return recent.some((entry) => /(苹果健康|apple\s*health|healthkit|健康数据)/i.test(String(entry?.content || '').trim()));
}

function buildAppleHealthVisibilityReply(data = {}) {
  const bundle = data?.appleHealthSync && typeof data.appleHealthSync === 'object' ? data.appleHealthSync : null;
  const snapshot = bundle?.snapshot && typeof bundle.snapshot === 'object' ? bundle.snapshot : null;
  const history = bundle?.history && typeof bundle.history === 'object' ? bundle.history : null;
  if (!bundle || (!snapshot && !history)) {
    return [
      '现在还看不到你的苹果健康数据。',
      '',
      '我这边当前读到的 Morpheus 实时数据里还没有 `appleHealthSync`，也就是苹果健康同步结果还没真正落进 Morpheus 的 live data。',
      '这和“飞书灰度功能”没关系；上一条回复里那部分判断不可信。',
      '',
      '现在能确认的是：血糖数据链路在，苹果健康数据链路还没落盘。',
    ].join('\n');
  }
  const lines = ['现在能看到你的苹果健康数据了。', ''];
  const updatedAt = toSafeText(bundle.updatedAt, 80);
  if (updatedAt) lines.push(`最近同步时间：${updatedAt}`);
  if (snapshot) {
    const parts = [];
    const steps = readHealthNumber(snapshot.steps);
    if (steps) parts.push(`步数 ${steps}`);
    const sleepHours = readHealthNumber(snapshot?.sleep?.asleepHours, 1);
    if (sleepHours) parts.push(`睡眠 ${sleepHours} h`);
    const resting = readHealthNumber(snapshot.restingHeartRateBpm);
    if (resting) parts.push(`静息心率 ${resting} bpm`);
    if (parts.length) lines.push(`当前摘要：${parts.join('，')}`);
  }
  if (history) {
    const activityDaily = Array.isArray(history.activityDaily) ? history.activityDaily.length : 0;
    const sleepDaily = Array.isArray(history.sleepDaily) ? history.sleepDaily.length : 0;
    const heartSamples = Array.isArray(history.heartRateSamples) ? history.heartRateSamples.length : 0;
    lines.push(`长期历史：活动 ${activityDaily} 天，睡眠 ${sleepDaily} 天，心率样本 ${heartSamples} 条`);
  }
  return lines.join('\n');
}

function tryAnswerHealthVisibilityQuestion(text = '', data = {}, history = []) {
  if (isAppleHealthVisibilityQuestion(text) || isAppleHealthFollowupQuestion(text, history)) {
    return buildAppleHealthVisibilityReply(data);
  }
  return null;
}

function tryAnswerConnectivityQuestion(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return '';
  if (/飞书消息/.test(normalized) && /(能收到|收得到|收到吗|通了吗|连上了吗)/.test(normalized)) {
    return '收到。';
  }
  if (/^(?:ping|测试|连通性测试|收到吗|能收到吗)[。！!？?]*$/i.test(normalized)) {
    return '收到。';
  }
  return '';
}

function buildDeterministicShortcutFailureReply(shortcut = {}, error = null) {
  const type = String(shortcut?.type || '').trim();
  const detail = toSafeText(error?.message || error, 120);
  const suffix = detail ? `（原因：${detail}）` : '';
  if (['memory_write_user', 'write_soul_memory', 'memory_rewrite_section'].includes(type)) {
    return `这次记忆没有真正写入成功，请再试一次。${suffix}`.trim();
  }
  if (type === 'append_daily_log') {
    return `这次日志没有真正写入成功，请再试一次。${suffix}`.trim();
  }
  if (type === 'create_reminder') {
    return `这次提醒没有真正创建成功，请再试一次。${suffix}`.trim();
  }
  if (type === 'add_expense_record') {
    return `这次记账没有真正写入成功，请再试一次。${suffix}`.trim();
  }
  if (type === 'create_flash_thought') {
    return `这次闪念没有真正记下，请再试一次。${suffix}`.trim();
  }
  return `这次操作没有真正执行成功，请再试一次。${suffix}`.trim();
}

function buildFeishuRuntimeFailureReply(error = null) {
  const detail = toSafeText(error?.message || error, 160);
  if (/401|unauthorized|invalid.*key|api key/i.test(detail)) {
    return '飞书入口已经收到消息，但当前 AI 配置鉴权失败（401），所以这次没法生成 AI 回复。请先在 Morpheus 里重新保存可用的 AI Key / Provider。';
  }
  if (detail) {
    return `飞书入口已经收到消息，但处理回复时失败了：${detail}`;
  }
  return '飞书入口已经收到消息，但处理回复时失败了。';
}

function createFeishuBotRuntime(deps = {}) {
  const api = deps && typeof deps === 'object' ? deps : {};
  const feishuStore = api.feishuStore || null;
  const feishuAIConfigStore = api.feishuAIConfigStore || null;
  const readCurrentLiveData = typeof api.readCurrentLiveData === 'function' ? api.readCurrentLiveData : () => null;
  const logger = api.logger && typeof api.logger.log === 'function' ? api.logger : console;
  const baseUrl = String(api.baseUrl || 'http://127.0.0.1:2199').trim() || 'http://127.0.0.1:2199';
  const fetchImpl = resolveFetch(api.fetchImpl);
  const larkSdk = api.larkSdk || (() => {
    try {
      return require('@larksuiteoapi/node-sdk');
    } catch (_) {
      return null;
    }
  })();

  const state = {
    running: false,
    connected: false,
    queueLength: 0,
    processing: false,
    lastStartedAt: '',
    lastConnectedAt: '',
    lastMessageAt: '',
    lastError: '',
    lastReplyAt: '',
    lastInboundPreview: '',
    lastReplyPreview: '',
    lastConfigAppliedAt: '',
    lastAIConfigSyncAt: '',
    sdkAvailable: !!larkSdk,
  };

  let client = null;
  let wsClient = null;
  let queue = [];
  const queuedMessageIds = new Set();

  function updateState(patch = {}) {
    Object.assign(state, patch);
  }

  function logInfo(...args) {
    try {
      logger.log('[FeishuBot]', ...args);
    } catch (_) {}
  }

  function logWarn(...args) {
    try {
      if (typeof logger.warn === 'function') logger.warn('[FeishuBot]', ...args);
      else logger.log('[FeishuBot]', ...args);
    } catch (_) {}
  }

  function getConfig() {
    return feishuStore && typeof feishuStore.readConfig === 'function'
      ? feishuStore.readConfig()
      : {};
  }

  function getAIConfig() {
    return feishuAIConfigStore && typeof feishuAIConfigStore.readConfig === 'function'
      ? feishuAIConfigStore.readConfig()
      : {};
  }

  function getStatusSummary() {
    const cfg = getConfig();
    const aiCfg = getAIConfig();
    return {
      connectionMode: 'long-connection',
      enabled: cfg.enabled === true,
      running: state.running === true,
      connected: state.connected === true,
      queueLength: state.queueLength || 0,
      processing: state.processing === true,
      lastStartedAt: state.lastStartedAt || '',
      lastConnectedAt: state.lastConnectedAt || '',
      lastMessageAt: state.lastMessageAt || '',
      lastReplyAt: state.lastReplyAt || '',
      lastError: state.lastError || '',
      lastInboundPreview: state.lastInboundPreview || '',
      lastReplyPreview: state.lastReplyPreview || '',
      sdkAvailable: state.sdkAvailable === true,
      aiConfigured: !!(aiCfg.provider && (aiCfg.apiKey || aiCfg.baseUrl || aiCfg.provider === 'codex')),
      aiProvider: toSafeText(aiCfg.provider, 40),
      aiUpdatedAt: toSafeText(aiCfg.updatedAt, 80),
      supportsWebhook: true,
      requiresPublicCallback: false,
      receivePolicy: 'p2p-only',
    };
  }

  async function postMorphAction(actionName, payload = {}) {
    const response = await fetchImpl(`${baseUrl}/api/morph/actions/${encodeURIComponent(actionName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: 'feishu-bot',
        source: 'feishu-long-connection',
        requestId: buildRequestId(actionName),
        payload,
      }),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) {
      throw new Error(String(json?.error || `HTTP ${response.status}`).trim() || 'morph_action_failed');
    }
    return json;
  }

  async function tryHandleDeterministicShortcut(text = '') {
    const shortcut = detectDeterministicMorphShortcut(text);
    if (!shortcut) return null;
    if (['memory_write_user', 'write_soul_memory', 'memory_rewrite_section'].includes(shortcut.type)) {
      await postMorphAction(shortcut.type, shortcut.payload);
      return toSafeText(shortcut.replyText, 240);
    }
    if (shortcut.type === 'create_flash_thought') {
      await postMorphAction('create_flash_thought', shortcut.payload);
      return `记下来了：${shortcut.payload.text}`;
    }
    if (shortcut.type === 'append_daily_log') {
      await postMorphAction('append_daily_log', shortcut.payload);
      return `已经记到今日日志：${shortcut.payload.text}`;
    }
    if (shortcut.type === 'add_expense_record') {
      await postMorphAction('add_expense_record', shortcut.payload);
      const amountText = Number.isFinite(Number(shortcut.payload.amount)) ? Number(shortcut.payload.amount).toFixed(2).replace(/\.00$/, '') : '';
      const categoryText = shortcut.payload.category ? ` · ${shortcut.payload.category}` : '';
      return `已记账：${shortcut.payload.item}${amountText ? ` ¥${amountText}` : ''}${categoryText}`;
    }
    if (shortcut.type === 'create_reminder') {
      await postMorphAction('create_reminder', shortcut.payload);
      return shortcut.payload.dueAt
        ? `提醒已创建：${shortcut.payload.title} @ ${shortcut.payload.dueAt}`
        : `提醒已创建：${shortcut.payload.title}`;
    }
    return null;
  }

  async function generateReplyFromAI(text = '', chatId = '') {
    const aiConfig = getAIConfig();
    const shortcut = detectDeterministicMorphShortcut(text);
    if (shortcut) {
      try {
        const shortcutReply = await tryHandleDeterministicShortcut(text);
        if (shortcutReply) return shortcutReply;
      } catch (error) {
        logWarn('deterministic shortcut failed:', error?.message || error);
        return buildDeterministicShortcutFailureReply(shortcut, error);
      }
    }

    const data = readCurrentLiveData() || {};
    const history = feishuStore && typeof feishuStore.readConversation === 'function'
      ? feishuStore.readConversation(chatId, 8)
      : [];
    const conversationRecallRequest = inferConversationRecallReadRequestFromQuestion(text);
    if (conversationRecallRequest) return buildConversationRecallReply(conversationRecallRequest, history);
    const connectivityReply = tryAnswerConnectivityQuestion(text);
    if (connectivityReply) return connectivityReply;
    const recentSituationReply = tryAnswerRecentSituationAnalysisQuestion(text, data);
    if (recentSituationReply) return recentSituationReply;
    const dailyReply = tryAnswerDailyLogQuestion(text, data);
    if (dailyReply) return dailyReply;
    const healthVisibilityReply = tryAnswerHealthVisibilityQuestion(text, data, history);
    if (healthVisibilityReply) return healthVisibilityReply;

    if (!aiConfig.provider) {
      return '飞书入口已经连上了，但当前还没有可用的 Morpheus AI 执行配置。先打开 Morpheus 一次，确认 AI 已经可用，我这边会自动同步。';
    }
    const prompt = buildFeishuBotPrompt({
      question: text,
      history,
      data,
    });
    const reply = await requestAITextWithProviderFallback(prompt, aiConfig, {
      fetchImpl,
    });
    return toSafeText(reply, 4000) || '我刚刚没有成功生成回复，你可以再发一次。';
  }

  function shouldIgnoreEvent(event = {}) {
    const chatType = toSafeText(event?.message?.chat_type || event?.chat_type || '', 40);
    if (chatType && chatType !== 'p2p') return true;
    const senderType = toSafeText(event?.sender?.sender_type || '', 40).toLowerCase();
    if (senderType === 'app' || senderType === 'bot') return true;
    return false;
  }

  async function sendTextReply(chatId, text) {
    if (!client || !chatId || !text) return null;
    const response = await client.im.v1.message.create({
      params: {
        receive_id_type: 'chat_id',
      },
      data: {
        receive_id: chatId,
        content: JSON.stringify({ text }),
        msg_type: 'text',
      },
    });
    if (response?.code !== 0) {
      throw new Error(toSafeText(response?.msg || `send_reply_failed:${response?.code}`, 240));
    }
    return response;
  }

  async function addPendingReaction(messageId) {
    const api = client?.im?.v1?.messageReaction;
    if (!api || typeof api.create !== 'function' || !messageId) return null;
    for (const emojiType of FEISHU_PENDING_REACTION_TYPES) {
      try {
        const response = await api.create({
          path: {
            message_id: messageId,
          },
          data: {
            reaction_type: {
              emoji_type: emojiType,
            },
          },
        });
        if (response?.code === 0 && response?.data?.reaction_id) {
          return {
            reactionId: toSafeText(response.data.reaction_id, 120),
            emojiType,
            createdAtMs: Date.now(),
          };
        }
      } catch (error) {
        logWarn(`pending reaction create failed for ${emojiType}:`, error?.message || error);
      }
    }
    return null;
  }

  async function removePendingReaction(messageId, token = null) {
    const api = client?.im?.v1?.messageReaction;
    if (!api || typeof api.delete !== 'function' || !messageId || !token?.reactionId) return false;
    try {
      const response = await api.delete({
        path: {
          message_id: messageId,
          reaction_id: token.reactionId,
        },
      });
      return response?.code === 0;
    } catch (error) {
      logWarn(`pending reaction delete failed for ${token?.emojiType || 'unknown'}:`, error?.message || error);
      return false;
    }
  }

  async function processQueue() {
    if (state.processing || !queue.length) return;
    updateState({ processing: true });
    while (queue.length) {
      const job = queue.shift();
      updateState({ queueLength: queue.length });
      if (!job) continue;
      queuedMessageIds.delete(job.messageId);
      const pendingReaction = await addPendingReaction(job.messageId);
      try {
        const reply = await generateReplyFromAI(job.text, job.chatId);
        await sendTextReply(job.chatId, reply);
        updateState({
          lastReplyAt: new Date().toISOString(),
          lastReplyPreview: toSafeText(reply, 240),
          lastError: '',
        });
        if (feishuStore && typeof feishuStore.appendConversationMessage === 'function') {
          feishuStore.appendConversationMessage(job.chatId, {
            role: 'assistant',
            content: reply,
            messageId: '',
          });
        }
        if (feishuStore && typeof feishuStore.appendEvent === 'function') {
          feishuStore.appendEvent({
            eventId: buildRequestId('reply'),
            eventType: 'feishu.reply.sent',
            chatId: job.chatId,
            chatType: job.chatType,
            senderId: 'morph-feishu-bot',
            messageId: '',
            messageType: 'text',
            text: reply,
            direction: 'outbound',
            raw: {
              sourceMessageId: job.messageId,
            },
          });
        }
      } catch (error) {
        const message = toSafeText(error?.message || error, 280) || 'unknown_feishu_runtime_error';
        updateState({ lastError: message });
        logWarn('process queue failed:', message);
        const failureReply = buildFeishuRuntimeFailureReply(error);
        try {
          await sendTextReply(job.chatId, failureReply);
          updateState({
            lastReplyAt: new Date().toISOString(),
            lastReplyPreview: toSafeText(failureReply, 240),
          });
          if (feishuStore && typeof feishuStore.appendConversationMessage === 'function') {
            feishuStore.appendConversationMessage(job.chatId, {
              role: 'assistant',
              content: failureReply,
              messageId: '',
            });
          }
          if (feishuStore && typeof feishuStore.appendEvent === 'function') {
            feishuStore.appendEvent({
              eventId: buildRequestId('reply-error'),
              eventType: 'feishu.reply.failed',
              chatId: job.chatId,
              chatType: job.chatType,
              senderId: 'morph-feishu-bot',
              messageId: '',
              messageType: 'text',
              text: failureReply,
              direction: 'outbound',
              raw: {
                sourceMessageId: job.messageId,
                error: message,
              },
            });
          }
        } catch (sendError) {
          logWarn('failed to send feishu failure reply:', sendError?.message || sendError);
        }
      } finally {
        const visibleFor = Date.now() - Number(pendingReaction?.createdAtMs || 0);
        if (pendingReaction?.reactionId && visibleFor < FEISHU_PENDING_REACTION_MIN_VISIBLE_MS) {
          await delay(FEISHU_PENDING_REACTION_MIN_VISIBLE_MS - visibleFor);
        }
        await removePendingReaction(job.messageId, pendingReaction);
      }
    }
    updateState({ processing: false, queueLength: 0 });
  }

  function enqueueMessage(job) {
    if (!job?.messageId || queuedMessageIds.has(job.messageId)) return;
    queuedMessageIds.add(job.messageId);
    queue.push(job);
    updateState({ queueLength: queue.length });
    setTimeout(() => {
      processQueue().catch((error) => {
        updateState({
          processing: false,
          lastError: toSafeText(error?.message || error, 280),
        });
      });
    }, 0);
  }

  async function handleIncomingEvent(event = {}) {
    if (shouldIgnoreEvent(event)) return;
    const message = event?.message && typeof event.message === 'object' ? event.message : {};
    const messageId = toSafeText(message.message_id, 120);
    const chatId = toSafeText(message.chat_id || event?.chat_id, 120);
    const chatType = toSafeText(message.chat_type || event?.chat_type, 40);
    const text = extractFeishuTextContent(message.content);
    if (!messageId || !chatId || !text) return;
    if (feishuStore && typeof feishuStore.hasProcessedMessage === 'function' && feishuStore.hasProcessedMessage(messageId)) {
      return;
    }
    const senderId = toSafeText(
      event?.sender?.sender_id?.open_id
      || event?.sender?.sender_id?.union_id
      || event?.sender?.sender_id?.user_id
      || '',
      120
    );
    if (feishuStore && typeof feishuStore.appendEvent === 'function') {
      feishuStore.appendEvent({
        eventId: toSafeText(event?.header?.event_id, 120) || buildRequestId('event'),
        eventType: toSafeText(event?.header?.event_type || 'im.message.receive_v1', 120) || 'im.message.receive_v1',
        chatId,
        chatType,
        senderId,
        messageId,
        messageType: toSafeText(message.message_type || '', 40),
        text,
        direction: 'inbound',
        raw: event,
      });
    }
    if (feishuStore && typeof feishuStore.appendConversationMessage === 'function') {
      feishuStore.appendConversationMessage(chatId, {
        role: 'user',
        content: text,
        messageId,
      });
    }
    updateState({
      lastMessageAt: new Date().toISOString(),
      lastInboundPreview: toSafeText(text, 240),
    });
    enqueueMessage({
      messageId,
      chatId,
      chatType,
      senderId,
      text,
    });
  }

  async function syncFromStoredConfig() {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.appId || !cfg.appSecret) {
      stop();
      return false;
    }
    if (!larkSdk) {
      updateState({
        sdkAvailable: false,
        lastError: 'missing_larksuite_node_sdk',
      });
      return false;
    }
    stop();
    client = new larkSdk.Client({
      appId: cfg.appId,
      appSecret: cfg.appSecret,
      appType: larkSdk.AppType?.SelfBuild,
      domain: larkSdk.Domain?.Feishu,
      loggerLevel: larkSdk.LoggerLevel?.info,
    });
    wsClient = new larkSdk.WSClient({
      appId: cfg.appId,
      appSecret: cfg.appSecret,
      domain: larkSdk.Domain?.Feishu,
      loggerLevel: larkSdk.LoggerLevel?.info,
    });
    const dispatcher = new larkSdk.EventDispatcher({}).register({
      'im.message.receive_v1': async (data) => {
        await handleIncomingEvent(data);
      },
    });
    try {
      await wsClient.start({ eventDispatcher: dispatcher });
      updateState({
        sdkAvailable: true,
        running: true,
        connected: true,
        lastStartedAt: new Date().toISOString(),
        lastConnectedAt: new Date().toISOString(),
        lastError: '',
      });
      logInfo('feishu long connection started');
      return true;
    } catch (error) {
      updateState({
        running: false,
        connected: false,
        lastError: toSafeText(error?.message || error, 280),
      });
      logWarn('failed to start feishu long connection:', error?.message || error);
      return false;
    }
  }

  function stop() {
    queue = [];
    queuedMessageIds.clear();
    if (wsClient && typeof wsClient.close === 'function') {
      try {
        wsClient.close({ force: true });
      } catch (_) {}
    }
    client = null;
    wsClient = null;
    updateState({
      running: false,
      connected: false,
      processing: false,
      queueLength: 0,
    });
  }

  async function applyConfigUpdate() {
    updateState({ lastConfigAppliedAt: new Date().toISOString() });
    return syncFromStoredConfig();
  }

  async function applyAIConfigUpdate() {
    updateState({ lastAIConfigSyncAt: new Date().toISOString() });
    return true;
  }

  return {
    getStatusSummary,
    stop,
    syncFromStoredConfig,
    applyConfigUpdate,
    applyAIConfigUpdate,
    handleIncomingEvent,
    extractFeishuTextContent,
    buildFeishuBotPrompt,
    detectDeterministicMorphShortcut,
  };
}

module.exports = {
  createFeishuBotRuntime,
  extractFeishuTextContent,
  buildFeishuBotPrompt,
  detectDeterministicMorphShortcut,
};
