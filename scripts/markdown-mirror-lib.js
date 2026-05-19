const fs = require('fs');
const path = require('path');

const MORPH_SSOT_CONTRACT_VERSION = '2026-03-30.round-06';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(file, content) {
  ensureDir(path.dirname(file));
  const next = String(content == null ? '' : content);
  if (fs.existsSync(file)) {
    try {
      const current = fs.readFileSync(file, 'utf8');
      if (current === next) return;
    } catch (_) {}
  }
  fs.writeFileSync(file, next, 'utf8');
  cleanupMirrorConflictCopiesForFile(file);
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanupMonthMirrorConflictCopies(yearDir, monthKey) {
  if (!yearDir || !monthKey || !fs.existsSync(yearDir)) return;
  const pattern = new RegExp(`^${escapeRegExp(monthKey)} \\d+\\.md$`);
  try {
    fs.readdirSync(yearDir).forEach((entryName) => {
      if (!pattern.test(entryName)) return;
      try {
        fs.unlinkSync(path.join(yearDir, entryName));
      } catch (_) {}
    });
  } catch (_) {}
}

function cleanupMirrorConflictCopiesForFile(file) {
  const target = String(file || '').trim();
  if (!target) return;
  const normalized = path.normalize(target);
  if (!normalized.includes(`${path.sep}morph_md_mirror${path.sep}`)) return;
  const dir = path.dirname(normalized);
  const ext = path.extname(normalized);
  const stem = path.basename(normalized, ext);
  const fileName = path.basename(normalized);
  if (!ext || !stem || !fs.existsSync(dir)) return;
  const pattern = new RegExp(`^${escapeRegExp(stem)} \\d+${escapeRegExp(ext)}$`);
  try {
    fs.readdirSync(dir).forEach((entryName) => {
      if (entryName === fileName || !pattern.test(entryName)) return;
      try {
        fs.unlinkSync(path.join(dir, entryName));
      } catch (_) {}
    });
  } catch (_) {}
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function escapeMd(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ');
}

function stripHtmlToText(text) {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getEntryText(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  const candidates = [item.text, item.content, item.title, item.name, item.html];
  for (const candidate of candidates) {
    const text = stripHtmlToText(candidate);
    if (text) return text;
  }
  return '';
}

function normalizeBlockList(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value)
    .sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a).localeCompare(String(b), 'zh-Hans-CN');
    })
    .map((key) => value[key])
    .filter((item) => item && typeof item === 'object');
}

function removeGeneratedChildren(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch (error) {
    console.warn('[MarkdownMirror] unable to scan generated mirror directory:', dir, error?.message || error);
    return;
  }
  entries.forEach((entryName) => {
    try {
      fs.rmSync(path.join(dir, entryName), { recursive: true, force: true });
    } catch (error) {
      console.warn('[MarkdownMirror] unable to remove generated mirror entry:', path.join(dir, entryName), error?.message || error);
    }
  });
}

function slugify(name, fallback) {
  const ascii = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  return ascii || fallback;
}

function normalizeData(raw) {
  const payload = raw && raw.data && typeof raw.data === 'object' ? raw.data : raw;
  const glucoseRaw = (
    (payload?.glucoseSync && typeof payload.glucoseSync === 'object' && payload.glucoseSync)
    || (payload?.glucose && typeof payload.glucose === 'object' && payload.glucose)
    || (payload?.health && payload.health.glucose && typeof payload.health.glucose === 'object' && payload.health.glucose)
    || null
  );
  return {
    ...(payload && typeof payload === 'object' ? payload : {}),
    syncMeta: payload?.syncMeta && typeof payload.syncMeta === 'object'
      ? {
          revision: Number.isFinite(Number(payload.syncMeta.revision)) ? Number(payload.syncMeta.revision) : 0,
          lastClientWriteAt: typeof payload.syncMeta.lastClientWriteAt === 'string' ? payload.syncMeta.lastClientWriteAt : '',
          lastServerWriteAt: typeof payload.syncMeta.lastServerWriteAt === 'string' ? payload.syncMeta.lastServerWriteAt : '',
          deviceId: typeof payload.syncMeta.deviceId === 'string' ? payload.syncMeta.deviceId : '',
          schemaVersion: Number.isFinite(Number(payload.syncMeta.schemaVersion)) ? Number(payload.syncMeta.schemaVersion) : 1,
        }
      : {
          revision: 0,
          lastClientWriteAt: '',
          lastServerWriteAt: '',
          deviceId: '',
          schemaVersion: 1,
        },
    flashThoughts: Array.isArray(payload?.flashThoughts) ? payload.flashThoughts : (Array.isArray(payload?.fleeting) ? payload.fleeting : []),
    completedFlashThoughts: Array.isArray(payload?.completedFlashThoughts) ? payload.completedFlashThoughts : [],
    fixed: Array.isArray(payload?.fixed) ? payload.fixed : [],
    completedFixedThoughts: Array.isArray(payload?.completedFixedThoughts) ? payload.completedFixedThoughts : [],
    reminders: Array.isArray(payload?.reminders) ? payload.reminders : [],
    dailyMonths: payload?.dailyMonths && typeof payload.dailyMonths === 'object' ? payload.dailyMonths : {},
    scheduleMvp: payload?.scheduleMvp && typeof payload.scheduleMvp === 'object' ? payload.scheduleMvp : {},
    writingStudio: payload?.writingStudio && typeof payload.writingStudio === 'object' ? payload.writingStudio : {},
    projectSpaces: Array.isArray(payload?.projectSpaces) ? payload.projectSpaces : [],
    projects: Array.isArray(payload?.projects) ? payload.projects : [],
    routines: Array.isArray(payload?.routines) ? payload.routines : [],
    sops: Array.isArray(payload?.sops) ? payload.sops : [],
    aiMemory: payload?.aiMemory && typeof payload.aiMemory === 'object' ? {
      ...payload.aiMemory,
      soul: typeof payload.aiMemory.soul === 'string'
        ? payload.aiMemory.soul
        : (typeof payload.aiMemory?.selfMemory?.soul === 'string' ? payload.aiMemory.selfMemory.soul : ''),
      identityNotes: typeof payload.aiMemory.identityNotes === 'string'
        ? payload.aiMemory.identityNotes
        : (typeof payload.aiMemory?.longTermMemory?.identityNotes === 'string' ? payload.aiMemory.longTermMemory.identityNotes : ''),
      user: typeof payload.aiMemory.user === 'string'
        ? payload.aiMemory.user
        : (typeof payload.aiMemory?.longTermMemory?.user === 'string' ? payload.aiMemory.longTermMemory.user : ''),
      memoryIndex: typeof payload.aiMemory.memoryIndex === 'string'
        ? payload.aiMemory.memoryIndex
        : (typeof payload.aiMemory?.longTermMemory?.memoryIndex === 'string' ? payload.aiMemory.longTermMemory.memoryIndex : ''),
      systemNotes: typeof payload.aiMemory.systemNotes === 'string'
        ? payload.aiMemory.systemNotes
        : (typeof payload.aiMemory?.longTermMemory?.systemNotes === 'string' ? payload.aiMemory.longTermMemory.systemNotes : ''),
      dailyLogs: payload.aiMemory.dailyLogs && typeof payload.aiMemory.dailyLogs === 'object'
        ? payload.aiMemory.dailyLogs
        : (payload.aiMemory?.longTermMemory?.dailyLogs && typeof payload.aiMemory.longTermMemory.dailyLogs === 'object' ? payload.aiMemory.longTermMemory.dailyLogs : {}),
      chatSessions: Array.isArray(payload.aiMemory.chatSessions) ? payload.aiMemory.chatSessions : [],
      currentChatSessionId: typeof payload.aiMemory.currentChatSessionId === 'string' ? payload.aiMemory.currentChatSessionId : '',
    } : {
      soul: '',
      identityNotes: '',
      user: '',
      memoryIndex: '',
      systemNotes: '',
      dailyLogs: {},
      chatSessions: [],
      currentChatSessionId: '',
    },
    glucoseSync: glucoseRaw ? {
      reading: glucoseRaw.reading && typeof glucoseRaw.reading === 'object' ? glucoseRaw.reading : null,
      series: Array.isArray(glucoseRaw.series) ? glucoseRaw.series : [],
      range: glucoseRaw.range && typeof glucoseRaw.range === 'object'
        ? {
            targetLow: Number.isFinite(Number(glucoseRaw.range.targetLow)) ? Number(glucoseRaw.range.targetLow) : 70,
            targetHigh: Number.isFinite(Number(glucoseRaw.range.targetHigh)) ? Number(glucoseRaw.range.targetHigh) : 180,
          }
        : { targetLow: 70, targetHigh: 180 },
      updatedAt: typeof glucoseRaw.updatedAt === 'string'
        ? glucoseRaw.updatedAt
        : (typeof glucoseRaw.fetchedAt === 'string' ? glucoseRaw.fetchedAt : ''),
    } : {
      reading: null,
      series: [],
      range: { targetLow: 70, targetHigh: 180 },
      updatedAt: '',
    },
    glucoseHistoryArchive: Array.isArray(payload?.glucoseHistoryArchive)
      ? payload.glucoseHistoryArchive
      : (Array.isArray(glucoseRaw?.archive) ? glucoseRaw.archive : []),
    expenseLedger: payload?.expenseLedger && typeof payload.expenseLedger === 'object'
      ? {
          categories: Array.isArray(payload.expenseLedger.categories) ? payload.expenseLedger.categories : [],
          records: Array.isArray(payload.expenseLedger.records) ? payload.expenseLedger.records : [],
        }
      : {
          categories: [],
          records: [],
        },
    secureVault: payload?.secureVault && typeof payload.secureVault === 'object'
      ? payload.secureVault
      : {},
  };
}

function buildCanonicalLiveDataPayload(data) {
  const normalized = normalizeData(data);
  const payload = JSON.parse(JSON.stringify(normalized));
  const aiMemory = payload && payload.aiMemory && typeof payload.aiMemory === 'object'
    ? payload.aiMemory
    : null;
  const longTermMemory = aiMemory && aiMemory.longTermMemory && typeof aiMemory.longTermMemory === 'object'
    ? aiMemory.longTermMemory
    : null;
  if (aiMemory && longTermMemory) {
    ['identityNotes', 'user', 'memoryIndex', 'systemNotes'].forEach((key) => {
      if (typeof aiMemory[key] === 'string' && aiMemory[key] && longTermMemory[key] === aiMemory[key]) {
        delete longTermMemory[key];
      }
    });
    const topLevelDailyLogs = aiMemory.dailyLogs && typeof aiMemory.dailyLogs === 'object' ? JSON.stringify(aiMemory.dailyLogs) : '';
    const mirroredDailyLogs = longTermMemory.dailyLogs && typeof longTermMemory.dailyLogs === 'object' ? JSON.stringify(longTermMemory.dailyLogs) : '';
    if (topLevelDailyLogs && mirroredDailyLogs && topLevelDailyLogs === mirroredDailyLogs) delete longTermMemory.dailyLogs;
  }
  return payload;
}

function buildStorageTopology() {
  return {
    contractVersion: MORPH_SSOT_CONTRACT_VERSION,
    migrationState: 'boundary-landed',
    canonicalStore: {
      kind: 'live-data-json',
      relativePath: 'data/live-data.json',
      role: 'authoritative-user-store',
      owner: 'core-data',
    },
    authoritativeWritePath: {
      strategy: 'full-snapshot-commit',
      allowedWriters: ['server-sync', 'native-sync'],
    },
    cacheReplicas: [
      {
        kind: 'browser-local-storage',
        location: 'localStorage:lianxing_mono_v18',
        role: 'bootstrap-cache',
      },
      {
        kind: 'bootstrap-cache',
        location: 'app-bootstrap-cache',
        role: 'bootstrap-cache',
      },
      {
        kind: 'startup-snapshot',
        location: 'startup-snapshot',
        role: 'startup-read-model',
      },
    ],
    derivedReplicas: [
      {
        kind: 'markdown-mirror',
        location: 'morph_md_mirror/',
        role: 'derived-mirror',
      },
      {
        kind: 'live-data-shards',
        location: 'data/shards/',
        role: 'derived-shard-index',
      },
    ],
  };
}

function formatThoughtList(title, items, archivedItems = []) {
  const active = Array.isArray(items) ? items : [];
  const archived = Array.isArray(archivedItems) ? archivedItems : [];
  const lines = [`# ${title}`, '', `当前 ${active.length} 条，已归档 ${archived.length} 条`, ''];
  if (!active.length && !archived.length) return [...lines, '_暂无内容_', ''].join('\n');
  if (active.length) lines.push('## 当前内容', '');
  active.forEach((item, idx) => {
    const text = getEntryText(item);
    lines.push(`## ${idx + 1}. ${item.time ? `[${item.time}] ` : ''}${text.split('\n')[0] || '未命名念头'}`);
    lines.push('');
    lines.push(escapeMd(text));
    if (item.clusterId) lines.push('', `关联簇: \`${item.clusterId}\``);
    lines.push('', '---', '');
  });
  if (archived.length) {
    lines.push('## 已归档', '');
    archived.forEach((item, idx) => {
      const text = getEntryText(item);
      lines.push(`### ${idx + 1}. ${item.time ? `[${item.time}] ` : ''}${text.split('\n')[0] || '归档内容'}`);
      lines.push('');
      lines.push(escapeMd(text));
      const archivedAt = String(item.archivedAt || item.completedAt || '').trim();
      if (archivedAt) lines.push('', `归档时间: \`${archivedAt}\``);
      lines.push('', '---', '');
    });
  }
  return lines.join('\n');
}

function formatBlocks(title, blocks) {
  const lines = [`# ${title}`, ''];
  const normalizedBlocks = normalizeBlockList(blocks);
  if (!normalizedBlocks.length) return [...lines, '_暂无内容_', ''].join('\n');
  normalizedBlocks.forEach((b) => {
    const content = escapeMd(getEntryText(b));
    if (b.type === 'h2') lines.push(`## ${content || '小标题'}`);
    else if (b.type === 'h3') lines.push(`### ${content || '小标题'}`);
    else if (b.type === 'todo') lines.push(`- [${b.checked ? 'x' : ' '}] ${content}`);
    else lines.push(content || '');
  });
  lines.push('');
  return lines.join('\n');
}

function formatFragments(title, items) {
  const lines = [`# ${title}`, ''];
  const entries = Array.isArray(items) ? items : [];
  if (!entries.length) return [...lines, '_暂无参考碎片_', ''].join('\n');
  entries.forEach((item, idx) => {
    const text = getEntryText(item);
    lines.push(`## ${idx + 1}. ${item.time ? `[${item.time}] ` : ''}${text.split('\n')[0] || '碎片'}`);
    lines.push('');
    lines.push(escapeMd(text));
    lines.push('', '---', '');
  });
  return lines.join('\n');
}

function writeProjectFolders(outDir, items, kind) {
  const base = path.join(outDir, kind);
  ensureDir(base);
  removeGeneratedChildren(base);
  if (!items.length) {
    writeFile(path.join(base, 'README.md'), `# ${kind}\n\n暂无内容。\n`);
    return;
  }

  items.forEach((entry, idx) => {
    const folder = path.join(base, `${String(idx + 1).padStart(2, '0')}-${slugify(entry.name, entry.id || String(idx + 1))}`);
    const meta = [
      `# ${entry.name || '(未命名)'}`,
      '',
      `- id: \`${entry.id || ''}\``,
      `- kind: ${kind}`,
      `- fragments: ${Array.isArray(entry.items) ? entry.items.length : 0}`,
      `- blocks: ${normalizeBlockList(entry.blocks).length}`,
      '',
    ].join('\n');
    writeFile(path.join(folder, 'index.md'), meta);
    writeFile(path.join(folder, 'fragments.md'), formatFragments(`${entry.name || '(未命名)'} - 参考碎片`, Array.isArray(entry.items) ? entry.items : []));
    writeFile(path.join(folder, 'blocks.md'), formatBlocks(`${entry.name || '(未命名)'} - 块编辑内容`, entry.blocks));
    const seedFiles = Array.isArray(entry.seedFiles) ? entry.seedFiles : [];
    seedFiles.forEach((seed, seedIdx) => {
      const seedName = String(seed?.name || '').trim() || `文档 ${seedIdx + 1}`;
      const fileName = `${slugify(seedName, `note-${seedIdx + 1}`)}.md`;
      const seedContent = String(seed?.content || '').trim();
      writeFile(path.join(folder, fileName), [`# ${seedName}`, '', seedContent || '_暂无内容_', ''].join('\n'));
    });
  });
}

function writeDaily(outDir, dailyMonths) {
  const base = path.join(outDir, '日志');
  ensureDir(base);
  removeGeneratedChildren(base);
  const months = Object.keys(dailyMonths).sort();
  if (!months.length) {
    writeFile(path.join(base, '说明.md'), '# 日志\n\n暂无日志。\n');
    return;
  }
  months.forEach((month) => {
    const year = /^\d{4}/.test(month) ? month.slice(0, 4) : 'unknown';
    const yearDir = path.join(base, year);
    const blocks = normalizeBlockList(dailyMonths[month]);
    writeFile(path.join(yearDir, `${month}.md`), formatBlocks(`日志 ${month}`, blocks));
    cleanupMonthMirrorConflictCopies(yearDir, month);
  });
}

function summarizeDoneMap(map) {
  if (!map || typeof map !== 'object') return [];
  return Object.keys(map).sort().filter((key) => !!map[key]);
}

function writeScheduleMvpMirror(outDir, scheduleMvp) {
  const base = path.join(outDir, '节律');
  ensureDir(base);
  const custom = Array.isArray(scheduleMvp?.custom) ? scheduleMvp.custom : [];
  const videoDone = summarizeDoneMap(scheduleMvp?.video);
  const reviewDone = summarizeDoneMap(scheduleMvp?.review);
  const sleepDone = summarizeDoneMap(scheduleMvp?.sleep);
  const exerciseWeeks = scheduleMvp?.exercise && typeof scheduleMvp.exercise === 'object' ? scheduleMvp.exercise : {};
  const customDone = scheduleMvp?.customDone && typeof scheduleMvp.customDone === 'object' ? scheduleMvp.customDone : {};
  const mainline = scheduleMvp?.annualMainline && typeof scheduleMvp.annualMainline === 'object' ? scheduleMvp.annualMainline : null;
  const lines = [
    '# 节律总览',
    '',
    '本文件由 `data/live-data.json` 的节律数据派生，便于人和 AI 直接查看；权威写入仍以 live-data.json 为准。',
    '',
    `- 最近更新: ${String(scheduleMvp?.updatedAt || '').trim() || '未知'}`,
    `- 自定义节律: ${custom.length}`,
    '',
  ];
  if (mainline) {
    lines.push('## 2026 主线', '');
    lines.push(`- 标题: ${escapeMd(mainline.title || '2026 主线')}`);
    if (mainline.description) lines.push(`- 描述: ${escapeMd(stripHtmlToText(mainline.description))}`);
    const anchors = Array.isArray(mainline.anchors) ? mainline.anchors : [];
    if (anchors.length) {
      lines.push('- 锚点:');
      anchors.forEach((item) => lines.push(`  - ${escapeMd(stripHtmlToText(item))}`));
    }
    lines.push('');
  }
  lines.push('## 系统节律', '');
  lines.push('### 视频频道更新');
  lines.push('');
  lines.push('- 规则: 每周五更新；可以延期一周，系统只记录是否更新，连续两周未更新时再提醒 Review。');
  lines.push(`- 已更新周: ${videoDone.length ? videoDone.join(' / ') : '暂无记录'}`);
  lines.push('');
  lines.push('### Weekly Review');
  lines.push('');
  lines.push(`- 已完成周: ${reviewDone.length ? reviewDone.join(' / ') : '暂无记录'}`);
  lines.push('');
  lines.push('### 22:30 上床睡觉');
  lines.push('');
  lines.push(`- 已记录日期: ${sleepDone.length ? sleepDone.join(' / ') : '暂无记录'}`);
  lines.push('');
  lines.push('### 每周锻炼三次');
  lines.push('');
  const exerciseWeekKeys = Object.keys(exerciseWeeks).sort();
  if (!exerciseWeekKeys.length) lines.push('- 暂无记录');
  exerciseWeekKeys.forEach((weekKey) => {
    const days = summarizeDoneMap(exerciseWeeks[weekKey]);
    lines.push(`- ${weekKey}: ${days.length}/3（${days.length ? days.join(' / ') : '暂无记录'}）`);
  });
  lines.push('');
  if (custom.length) {
    lines.push('## 自定义节律', '');
    custom.forEach((item) => {
      const id = String(item?.id || '').trim();
      const done = id && customDone[id] && typeof customDone[id] === 'object' ? summarizeDoneMap(customDone[id]) : [];
      lines.push(`### ${escapeMd(item?.title || '未命名节律')}`);
      lines.push('');
      if (item?.englishLabel) lines.push(`- 英文标签: ${escapeMd(item.englishLabel)}`);
      if (item?.cadence) lines.push(`- 频次: ${escapeMd(item.cadence)}`);
      if (item?.description) lines.push(`- 描述: ${escapeMd(stripHtmlToText(item.description))}`);
      lines.push(`- 已完成: ${done.length ? done.join(' / ') : '暂无记录'}`);
      lines.push('');
    });
  }
  writeFile(path.join(base, 'README.md'), `${lines.join('\n').trimEnd()}\n`);
}

function writeAIMemory(outDir, aiMemory) {
  const base = path.join(outDir, 'AI记忆');
  ensureDir(base);
  const soulText = String(aiMemory?.soul || '').trim() || [
    '# soul.md',
    '',
    '这是 AI 在 Morpheus 中的人格、偏好与长期自我约束。',
    '',
    '- 目标：帮助用户澄清念头、构建系统、沉淀长期思考',
    '- 风格：简洁、直接、尊重现实约束',
    '- 原则：优先帮助用户行动，其次帮助用户解释',
    '',
  ].join('\n');
  const userText = String(aiMemory?.user || '').trim() || [
    '# user.md',
    '',
    '这里记录用户的长期偏好、目标、处境与持续主题。',
    '',
    '- 用户倾向长期写作、系统化思考',
    '- 用户同时使用闪念、定念、项目、节律、程序来组织生活',
    '- 用户偏好直接、连续、低打扰的交互',
    '',
  ].join('\n');
  const systemText = String(aiMemory?.systemNotes || '').trim() || [
    '# memory-system.md',
    '',
    '说明：',
    '',
    '- `soul.md`：AI 自身长期人格与工作原则',
    '- `identity.md`：Morpheus 当前可操作的自我结构',
    '- `user.md`：用户长期画像与偏好',
    '- `memory.md`：长期记忆索引层（事实与关系线程）',
    '- `daily/*.md`：AI 基于每日互动沉淀的记忆日志',
    '',
    '这些内容应被视为 AI 的长期记忆层。',
    '',
  ].join('\n');
  const identityText = String(aiMemory?.identityNotes || '').trim() || [
    '# identity.md',
    '',
    '这里记录 Morpheus 当前的自我结构，而不是叙事性传记。',
    '',
  ].join('\n');
  const memoryIndexText = String(aiMemory?.memoryIndex || '').trim() || [
    '# memory.md',
    '',
    '这里记录 Morpheus 当前长期记忆的索引层。',
    '',
  ].join('\n');
  const agentsText = [
    '# AGENTS.md - Morpheus Memory Workspace',
    '',
    '这组文件借鉴 OpenClaw 的工作区记忆结构，但属于 Morpheus 的本地镜像。',
    '',
    '## Startup Memory',
    '',
    '主对话启动时应优先读取：',
    '',
    '1. `SOUL.md`：Morpheus 自身定位与工作原则。',
    '2. `USER.md`：用户身份、称呼、稳定偏好。',
    '3. `memory/YYYY-MM-DD.md`：今日和昨日的 AI 对话 / 互动日志。',
    '4. `MEMORY.md`：主会话长期沉淀的事实、边界和关系线索。',
    '',
    '## Rules',
    '',
    '- `USER.md` 和 `MEMORY.md` 是人可读镜像，不应绕过 Morpheus 的 canonical commit 直接当写入事实源。',
    '- AI 对话日志进入 `memory/`，作为过程记忆；真正需要长期稳定保留的内容再升格进核心记忆。',
    '- 名字、称呼、核心边界必须进入 Core Memory Packet，每轮主 prompt 都应可见。',
    '',
  ].join('\n');
  writeFile(path.join(base, 'soul.md'), soulText.endsWith('\n') ? soulText : `${soulText}\n`);
  writeFile(path.join(base, 'identity.md'), identityText.endsWith('\n') ? identityText : `${identityText}\n`);
  writeFile(path.join(base, 'user.md'), userText.endsWith('\n') ? userText : `${userText}\n`);
  writeFile(path.join(base, 'memory.md'), memoryIndexText.endsWith('\n') ? memoryIndexText : `${memoryIndexText}\n`);
  writeFile(path.join(base, 'memory-system.md'), systemText.endsWith('\n') ? systemText : `${systemText}\n`);
  writeFile(path.join(base, 'SOUL.md'), soulText.endsWith('\n') ? soulText : `${soulText}\n`);
  writeFile(path.join(base, 'IDENTITY.md'), identityText.endsWith('\n') ? identityText : `${identityText}\n`);
  writeFile(path.join(base, 'USER.md'), userText.endsWith('\n') ? userText : `${userText}\n`);
  writeFile(path.join(base, 'MEMORY.md'), memoryIndexText.endsWith('\n') ? memoryIndexText : `${memoryIndexText}\n`);
  writeFile(path.join(base, 'MEMORY-SYSTEM.md'), systemText.endsWith('\n') ? systemText : `${systemText}\n`);
  writeFile(path.join(base, 'AGENTS.md'), agentsText);

  const dailyBase = path.join(base, '每日');
  ensureDir(dailyBase);
  const dailyKeys = Object.keys(aiMemory?.dailyLogs || {}).sort();
  if (!dailyKeys.length) {
    writeFile(path.join(dailyBase, '说明.md'), '# AI 每日记忆\n\n暂无互动日志。\n');
  } else dailyKeys.forEach((key) => {
    const entries = Array.isArray(aiMemory.dailyLogs[key]) ? aiMemory.dailyLogs[key] : [];
    const lines = [`# AI Daily Memory ${key}`, ''];
    if (!entries.length) {
      lines.push('_暂无内容_', '');
    } else {
      entries.forEach((entry, index) => {
        lines.push(`## ${index + 1}. [${entry.time || ''}] ${entry.summary || '互动记录'}`);
        lines.push('');
        if (entry.user) lines.push(`- 用户：${escapeMd(entry.user)}`);
        if (entry.assistant) lines.push(`- AI：${escapeMd(entry.assistant)}`);
        if (Array.isArray(entry.actions) && entry.actions.length) lines.push(`- 动作：${entry.actions.map((item) => escapeMd(item)).join(' / ')}`);
        lines.push('', '---', '');
      });
    }
    writeFile(path.join(dailyBase, `${key}.md`), lines.join('\n'));
  });

  const memoryBase = path.join(base, 'memory');
  ensureDir(memoryBase);
  const memoryByDate = new Map();
  const addMemoryLine = (dateKey, line) => {
    const key = String(dateKey || '').trim();
    const text = String(line || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !text) return;
    const bucket = memoryByDate.get(key) || [];
    bucket.push(text);
    memoryByDate.set(key, bucket);
  };
  Object.keys(aiMemory?.dailyLogs || {}).sort().forEach((key) => {
    const entries = Array.isArray(aiMemory.dailyLogs[key]) ? aiMemory.dailyLogs[key] : [];
    entries.forEach((entry, index) => {
      const parts = [];
      if (entry.time) parts.push(`[${entry.time}]`);
      parts.push(String(entry.summary || `互动记录 ${index + 1}`).trim());
      if (entry.user) parts.push(`用户：${escapeMd(entry.user)}`);
      if (entry.assistant) parts.push(`AI：${escapeMd(entry.assistant)}`);
      if (Array.isArray(entry.actions) && entry.actions.length) parts.push(`动作：${entry.actions.map((item) => escapeMd(item)).join(' / ')}`);
      addMemoryLine(key, `- ${parts.filter(Boolean).join('；')}`);
    });
  });
  (Array.isArray(aiMemory?.chatSessions) ? aiMemory.chatSessions : []).forEach((session) => {
    const fallbackDate = String(session?.updatedAt || session?.createdAt || '').slice(0, 10);
    const title = String(session?.title || '未命名对话').trim();
    (Array.isArray(session?.messages) ? session.messages : []).forEach((msg) => {
      const dateKey = String(msg?.createdAt || msg?.updatedAt || '').slice(0, 10) || fallbackDate;
      const role = msg?.role === 'user' ? '用户' : msg?.role === 'assistant' ? 'AI' : '系统';
      const time = String(msg?.time || '').trim();
      const content = escapeMd(String(msg?.content || '').replace(/<<ACTIONS[\s\S]*$/i, '').trim()).slice(0, 1200);
      if (!content) return;
      addMemoryLine(dateKey, `- ${time ? `[${time}] ` : ''}${role}（${escapeMd(title)}）：${content}`);
    });
  });
  if (!memoryByDate.size) {
    writeFile(path.join(memoryBase, 'README.md'), '# memory\n\n暂无 AI 对话记忆。\n');
  } else {
    Array.from(memoryByDate.keys()).sort().forEach((key) => {
      const lines = [`# ${key}`, '', ...memoryByDate.get(key), ''];
      writeFile(path.join(memoryBase, `${key}.md`), lines.join('\n'));
    });
  }
}

function writeAIConversations(outDir, aiMemory) {
  const base = path.join(outDir, '对话');
  ensureDir(base);
  const sessions = Array.isArray(aiMemory?.chatSessions) ? aiMemory.chatSessions : [];
  const summaryLines = [
    '# 对话',
    '',
    `当前共 ${sessions.length} 个会话。`,
    '',
  ];
  sessions.forEach((session, index) => {
    const title = String(session?.title || '').trim() || `对话 ${index + 1}`;
    const updatedAt = String(session?.updatedAt || '').trim() || '未知';
    summaryLines.push(`- ${title}（最近更新：${updatedAt}）`);
  });
  if (!sessions.length) summaryLines.push('_暂无会话_', '');
  writeFile(path.join(base, '总览.md'), `${summaryLines.join('\n').trimEnd()}\n`);
  sessions.forEach((session, index) => {
    const title = String(session?.title || '').trim() || `对话 ${index + 1}`;
    const fileName = `${String(index + 1).padStart(2, '0')}-${slugify(title, `chat-${index + 1}`)}.md`;
    const lines = [
      `# ${title}`,
      '',
      `- 创建时间: ${String(session?.createdAt || '').trim() || '未知'}`,
      `- 最近更新: ${String(session?.updatedAt || '').trim() || '未知'}`,
      '',
    ];
    const messages = Array.isArray(session?.messages) ? session.messages : [];
    if (!messages.length) {
      lines.push('_暂无消息_', '');
    } else {
      messages.forEach((msg, msgIndex) => {
        const role = msg?.role === 'user' ? '用户' : msg?.role === 'assistant' ? 'AI' : '系统';
        const time = String(msg?.time || '').trim();
        lines.push(`## ${msgIndex + 1}. ${role}${time ? ` [${time}]` : ''}`);
        lines.push('');
        lines.push(escapeMd(String(msg?.content || '').trim() || '_空内容_'));
        lines.push('', '---', '');
      });
    }
    writeFile(path.join(base, fileName), `${lines.join('\n').trimEnd()}\n`);
  });
}

function writeReminders(outDir, reminders) {
  const base = path.join(outDir, '提醒');
  ensureDir(base);
  const items = Array.isArray(reminders) ? reminders : [];
  const active = items.filter((item) => !String(item?.completedAt || '').trim());
  const done = items.filter((item) => String(item?.completedAt || '').trim());
  const lines = [
    '# 提醒',
    '',
    `当前 ${active.length} 条，已完成 ${done.length} 条`,
    '',
  ];
  if (!items.length) {
    lines.push('_暂无提醒_', '');
    writeFile(path.join(base, '总览.md'), `${lines.join('\n').trimEnd()}\n`);
    return;
  }
  if (active.length) {
    lines.push('## 当前提醒', '');
    active.forEach((item, index) => {
      lines.push(`- ${index + 1}. ${escapeMd(String(item?.title || item?.text || '未命名提醒').trim())}`);
      const dueAt = String(item?.dueAt || '').trim();
      if (dueAt) lines.push(`  - 到期: ${dueAt}`);
      const note = String(item?.note || '').trim();
      if (note) lines.push(`  - 备注: ${escapeMd(note)}`);
    });
    lines.push('');
  }
  if (done.length) {
    lines.push('## 已完成', '');
    done.forEach((item, index) => {
      lines.push(`- ${index + 1}. ${escapeMd(String(item?.title || item?.text || '未命名提醒').trim())}`);
      const completedAt = String(item?.completedAt || '').trim();
      if (completedAt) lines.push(`  - 完成: ${completedAt}`);
    });
    lines.push('');
  }
  writeFile(path.join(base, '总览.md'), `${lines.join('\n').trimEnd()}\n`);
}

function writeRootReadme(rootDir, outDir, sourceLabel) {
  const text = [
    '# Morpheus 数据镜像',
    '',
    '这是应用数据的 Markdown 镜像目录，便于用户直接查看。',
    '',
    `- 来源快照: \`${sourceLabel || path.relative(rootDir, path.join(rootDir, 'data', 'live-data.json'))}\``,
    '- 目录说明:',
    '  - `闪念/总览.md` 闪念总览',
    '  - `定念/总览.md` 定念总览',
    '  - `提醒/总览.md` 提醒总览',
    '  - `日志/<year>/<yyyy-mm>.md` 月日志',
    '  - `项目/<project>/` 每个项目一个文件夹，含多个 md',
    '  - `节律/README.md` 节律总览，包含系统节律与自定义节律记录',
    '  - `流程/<sop>/` 每个流程一个文件夹，含多个 md',
    '  - `对话/` 历史会话镜像',
    '  - `AI记忆/` AI 长期记忆：包含 OpenClaw 风格的 USER.md / MEMORY.md / AGENTS.md / memory/YYYY-MM-DD.md，并兼容 soul.md / user.md / 每日/',
    '',
  ].join('\n');
  writeFile(path.join(outDir, 'README.md'), text);
}

function normalizeMirrorDeltaDomain(domain = '') {
  const normalized = String(domain || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'daily' || normalized === 'dailymonth' || normalized === 'dailymonths') return 'daily';
  if (normalized === 'project' || normalized === 'projects') return 'projects';
  if (normalized === 'projectspaces' || normalized === 'project_space') return 'projects';
  if (normalized === 'routine' || normalized === 'routines') return 'routines';
  if (normalized === 'schedule' || normalized === 'schedulemvp' || normalized === 'rhythm' || normalized === 'rhythms') return 'scheduleMvp';
  if (normalized === 'sop' || normalized === 'sops') return 'sops';
  if (normalized === 'flash' || normalized === 'flashthoughts' || normalized === 'fleeting') return 'flashThoughts';
  if (normalized === 'fixed' || normalized === 'fixedthoughts') return 'fixed';
  if (normalized === 'reminder' || normalized === 'reminders') return 'reminders';
  if (
    normalized === 'aimemory'
    || normalized === 'aimemoryfull'
    || normalized === 'ai_memory'
    || normalized === 'chat'
    || normalized === 'conversations'
    || normalized === 'aichatsessions'
    || normalized === 'aidailylogs'
    || normalized === 'aicurrentchatsessionid'
  ) return 'aiMemory';
  if (normalized === 'none') return 'none';
  if (normalized === 'all' || normalized === 'meta') return normalized;
  return '';
}

function normalizeMirrorDeltaEntityRef(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const domain = normalizeMirrorDeltaDomain(raw.domain || raw.scope || '');
  const id = String(raw.id || raw.entityId || '').trim();
  const type = String(raw.type || raw.entityType || '').trim();
  if (!domain || !id) return null;
  return type ? { domain, id, type } : { domain, id };
}

function normalizeMirrorDeltaHint(rawHint) {
  if (!rawHint || typeof rawHint !== 'object') return null;
  const rawDomains = Array.isArray(rawHint.domains) ? rawHint.domains : [];
  const rawEntityRefs = Array.isArray(rawHint.entityRefs) ? rawHint.entityRefs : [];
  const hasRawHint = rawDomains.length > 0 || rawEntityRefs.length > 0;
  const domains = [];
  const seenDomains = new Set();
  rawDomains.forEach((item) => {
    const domain = normalizeMirrorDeltaDomain(item);
    if (!domain || seenDomains.has(domain)) return;
    seenDomains.add(domain);
    domains.push(domain);
  });
  const entityRefs = [];
  const seenEntityRefs = new Set();
  rawEntityRefs.forEach((item) => {
    const normalized = normalizeMirrorDeltaEntityRef(item);
    if (!normalized) return;
    const key = JSON.stringify(normalized);
    if (seenEntityRefs.has(key)) return;
    seenEntityRefs.add(key);
    entityRefs.push(normalized);
  });
  if (domains.includes('all')) return { domains: ['all'], entityRefs: [] };
  const effectiveDomains = domains.filter((domain) => domain !== 'none');
  if (!effectiveDomains.length && !entityRefs.length && hasRawHint) {
    return { domains: ['none'], entityRefs: [] };
  }
  if (!effectiveDomains.length && !entityRefs.length) return null;
  return { domains: effectiveDomains, entityRefs };
}

function writeDailyForSelectedMonths(outDir, dailyMonths, monthKeys = []) {
  const base = path.join(outDir, '日志');
  ensureDir(base);
  const selected = Array.from(new Set(
    (Array.isArray(monthKeys) ? monthKeys : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ));
  if (!selected.length) {
    writeDaily(outDir, dailyMonths);
    return;
  }
  selected.forEach((month) => {
    const year = /^\d{4}/.test(month) ? month.slice(0, 4) : 'unknown';
    const yearDir = path.join(base, year);
    ensureDir(yearDir);
    const targetFile = path.join(yearDir, `${month}.md`);
    const hasMonth = !!(dailyMonths && Object.prototype.hasOwnProperty.call(dailyMonths, month));
    const blocks = hasMonth ? normalizeBlockList(dailyMonths[month]) : null;
    if (!hasMonth) {
      if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
      cleanupMonthMirrorConflictCopies(yearDir, month);
      return;
    }
    writeFile(targetFile, formatBlocks(`日志 ${month}`, blocks));
    cleanupMonthMirrorConflictCopies(yearDir, month);
  });
}

function generateMarkdownMirrorFull(options) {
  const rootDir = options.rootDir;
  const outDir = options.outDir || path.join(rootDir, 'morph_md_mirror');
  const data = normalizeData(options.data);
  ensureDir(outDir);

  writeRootReadme(rootDir, outDir, options.sourceLabel);
  writeFile(path.join(outDir, '闪念', '总览.md'), formatThoughtList('闪念', data.flashThoughts, data.completedFlashThoughts));
  writeFile(path.join(outDir, '定念', '总览.md'), formatThoughtList('定念', data.fixed, data.completedFixedThoughts));
  writeReminders(outDir, data.reminders);
  writeDaily(outDir, data.dailyMonths);
  writeProjectFolders(outDir, data.projects, '项目');
  writeProjectFolders(outDir, data.routines, '节律');
  writeScheduleMvpMirror(outDir, data.scheduleMvp);
  writeProjectFolders(outDir, data.sops, '流程');
  writeAIConversations(outDir, data.aiMemory);
  writeAIMemory(outDir, data.aiMemory);

  return outDir;
}

function generateMarkdownMirror(options) {
  const rootDir = options.rootDir;
  const outDir = options.outDir || path.join(rootDir, 'morph_md_mirror');
  const data = normalizeData(options.data);
  const delta = normalizeMirrorDeltaHint(options.delta);
  if (!delta) {
    return generateMarkdownMirrorFull({
      ...options,
      rootDir,
      outDir,
      data,
    });
  }
  const domainSet = new Set(delta.domains || []);
  const knownDomains = new Set(['daily', 'projects', 'routines', 'scheduleMvp', 'sops', 'flashThoughts', 'fixed', 'reminders', 'aiMemory', 'meta', 'all', 'none']);
  const hasUnknownDomain = Array.from(domainSet).some((domain) => !knownDomains.has(domain));
  if (domainSet.has('all') || hasUnknownDomain) {
    return generateMarkdownMirrorFull({
      ...options,
      rootDir,
      outDir,
      data,
    });
  }
  if (domainSet.has('none') && domainSet.size === 1 && !(delta.entityRefs || []).length) {
    ensureDir(outDir);
    return outDir;
  }
  ensureDir(outDir);
  const readmeFile = path.join(outDir, 'README.md');
  if (!fs.existsSync(readmeFile) || domainSet.has('meta')) {
    writeRootReadme(rootDir, outDir, options.sourceLabel);
  }
  const dailyMonthRefs = (delta.entityRefs || [])
    .filter((item) => item && item.domain === 'daily')
    .map((item) => String(item.id || '').trim())
    .filter(Boolean);
  if (domainSet.has('flashThoughts')) {
    writeFile(path.join(outDir, '闪念', '总览.md'), formatThoughtList('闪念', data.flashThoughts, data.completedFlashThoughts));
  }
  if (domainSet.has('fixed')) {
    writeFile(path.join(outDir, '定念', '总览.md'), formatThoughtList('定念', data.fixed, data.completedFixedThoughts));
  }
  if (domainSet.has('reminders')) {
    writeReminders(outDir, data.reminders);
  }
  if (domainSet.has('daily') || dailyMonthRefs.length) {
    if (domainSet.has('daily')) writeDaily(outDir, data.dailyMonths);
    else writeDailyForSelectedMonths(outDir, data.dailyMonths, dailyMonthRefs);
  }
  if (domainSet.has('projects')) {
    writeProjectFolders(outDir, data.projects, '项目');
  }
  if (domainSet.has('routines')) {
    writeProjectFolders(outDir, data.routines, '节律');
    writeScheduleMvpMirror(outDir, data.scheduleMvp);
  }
  if (domainSet.has('scheduleMvp')) {
    writeScheduleMvpMirror(outDir, data.scheduleMvp);
  }
  if (domainSet.has('sops')) {
    writeProjectFolders(outDir, data.sops, '流程');
  }
  if (domainSet.has('aiMemory')) {
    writeAIConversations(outDir, data.aiMemory);
    writeAIMemory(outDir, data.aiMemory);
  }
  return outDir;
}

function collectWritingCandidates(data) {
  const normalized = normalizeData(data);
  const candidates = [];
  const push = (source, title, body = '') => {
    const cleanTitle = stripHtmlToText(title).split('\n')[0].trim();
    const cleanBody = stripHtmlToText(body).trim();
    if (!cleanTitle && !cleanBody) return;
    candidates.push({
      source,
      title: cleanTitle || cleanBody.slice(0, 48),
      body: cleanBody,
    });
  };
  (normalized.fixed || []).forEach((item) => push('定念', getEntryText(item), getEntryText(item)));
  (normalized.flashThoughts || []).forEach((item) => {
    const text = getEntryText(item);
    if (/(书|写作|文章|视频|观点|选题|Topbook|生活|实验|AI|应用|系统|Morpheus)/i.test(text)) {
      push('闪念', text, text);
    }
  });
  (normalized.projects || []).forEach((project) => {
    const blockText = normalizeBlockList(project.blocks).map(getEntryText).filter(Boolean).slice(0, 6).join('\n');
    if (/(书|写作|文章|视频|观点|选题|Topbook|频道|内容|Morpheus|产品)/i.test(`${project.name || ''}\n${blockText}`)) {
      push('项目', project.name, blockText);
    }
  });
  const seen = new Set();
  return candidates.filter((item) => {
    const key = `${item.source}:${item.title}:${item.body.slice(0, 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80);
}

function generateWritingStudioMirror(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const data = normalizeData(options.data || {});
  const base = options.outDir || path.join(rootDir, 'writing-studio', 'morph-derived');
  ensureDir(base);
  const candidates = collectWritingCandidates(data);
  const mainline = data.scheduleMvp?.annualMainline && typeof data.scheduleMvp.annualMainline === 'object'
    ? data.scheduleMvp.annualMainline
    : {
        title: '2026 主线',
        description: '稳定写完书，同时用小规模移动生活验证真正想要的生活方式。',
        anchors: ['书是主线', 'Topbook 是表达渠道', '生活实验是验证', '其他全部降级'],
      };
  const readme = [
    '# 写作工作室派生层',
    '',
    '这里不是新的权威数据源，而是从 Morpheus 权威数据派生出来的可读写作索引。',
    '',
    `- 来源: ${options.sourceLabel || 'data/live-data.json'}`,
    `- revision: ${data.syncMeta?.revision || 0}`,
    `- 候选素材: ${candidates.length}`,
    '',
  ].join('\n');
  writeFile(path.join(base, 'README.md'), readme);
  const mainlineLines = [
    `# ${escapeMd(mainline.title || '2026 主线')}`,
    '',
    escapeMd(stripHtmlToText(mainline.description || '稳定写完书，同时用小规模移动生活验证真正想要的生活方式。')),
    '',
    '## 锚点',
    '',
  ];
  const anchors = Array.isArray(mainline.anchors) && mainline.anchors.length
    ? mainline.anchors
    : ['书是主线', 'Topbook 是表达渠道', '生活实验是验证', '其他全部降级'];
  anchors.forEach((item) => mainlineLines.push(`- ${escapeMd(stripHtmlToText(item))}`));
  mainlineLines.push('');
  writeFile(path.join(base, '2026-mainline.md'), mainlineLines.join('\n'));

  const backlog = [
    '# 选题 / 写作素材池',
    '',
    '这些条目从闪念、定念和项目中自动抽取，用来提醒“哪些东西可能已经可以写”。',
    '',
  ];
  if (!candidates.length) {
    backlog.push('_暂无可用素材_', '');
  } else {
    candidates.forEach((item, index) => {
      backlog.push(`## ${index + 1}. ${escapeMd(item.title)}`);
      backlog.push('');
      backlog.push(`- 来源: ${item.source}`);
      if (item.body && item.body !== item.title) {
        backlog.push('');
        backlog.push(escapeMd(item.body));
      }
      backlog.push('', '---', '');
    });
  }
  writeFile(path.join(base, 'topic-backlog.md'), `${backlog.join('\n').trimEnd()}\n`);

  const topLevelBacklog = path.join(rootDir, 'writing-studio', 'topic-backlog.md');
  const shouldRefreshTopLevelBacklog = !fs.existsSync(topLevelBacklog)
    || /待补充|由 Morpheus 自动派生/.test(fs.readFileSync(topLevelBacklog, 'utf8'));
  if (shouldRefreshTopLevelBacklog) {
    writeFile(topLevelBacklog, [
      '# Topic Backlog',
      '',
      '由 Morpheus 自动派生。人工整理后的长期稿件计划可以另存，避免被同步覆盖。',
      '',
      ...backlog.slice(4),
    ].join('\n').trimEnd() + '\n');
  }
  return base;
}

function writeLiveSnapshot(rootDir, data, options = {}) {
  const file = options.file || path.join(rootDir, 'data', 'live-data.json');
  ensureDir(path.dirname(file));
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'Morpheus',
    version: 1,
    source: String(options.source || 'live-sync'),
    storageTopology: buildStorageTopology(),
    data: buildCanonicalLiveDataPayload(data),
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return file;
}

function pickSourceJson(rootDir) {
  const dataDir = path.join(rootDir, 'data');
  if (!fs.existsSync(dataDir)) return null;
  const canonicalLiveData = path.join(dataDir, 'live-data.json');
  if (fs.existsSync(canonicalLiveData)) return canonicalLiveData;
  const files = fs.readdirSync(dataDir)
    .filter((f) => f.endsWith('.json') && f !== 'user-data.template.json')
    .map((f) => ({ f, mtime: fs.statSync(path.join(dataDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length) return path.join(dataDir, files[0].f);
  const template = path.join(dataDir, 'user-data.template.json');
  return fs.existsSync(template) ? template : null;
}

module.exports = {
  readJson,
  normalizeData,
  buildCanonicalLiveDataPayload,
  buildStorageTopology,
  normalizeMirrorDeltaHint,
  generateMarkdownMirror,
  generateWritingStudioMirror,
  writeLiveSnapshot,
  pickSourceJson,
};
