// @ts-check

(function initMorphHealthRelationshipCanvasRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphHealthRelationshipCanvasRuntime && typeof window.MorphHealthRelationshipCanvasRuntime.create === 'function') return;

  function createHealthRelationshipCanvasRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const getDataRoot = typeof api.getDataRoot === 'function' ? api.getDataRoot : () => ({});
    const getAIChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState : () => ({});
    const getGlucoseHistoryState = typeof api.getGlucoseHistoryState === 'function' ? api.getGlucoseHistoryState : () => ({});
    const getAIMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory : () => ({});
    const getMonthStr = typeof api.getMonthStr === 'function' ? api.getMonthStr : () => '';
    const getVisibleFixedThoughts = typeof api.getVisibleFixedThoughts === 'function' ? api.getVisibleFixedThoughts : () => [];
    const formatGlucoseMmol = typeof api.formatGlucoseMmol === 'function' ? api.formatGlucoseMmol : () => '--';
    const formatGlucoseTrendLabel = typeof api.formatGlucoseTrendLabel === 'function' ? api.formatGlucoseTrendLabel : () => '--';
    const formatGlucoseTime = typeof api.formatGlucoseTime === 'function' ? api.formatGlucoseTime : () => '--';
    const AI_TIMEZONE = typeof api.getAITimezone === 'function' ? api.getAITimezone() : '';
    const getDatePartsInTimezone = typeof api.getDatePartsInTimezone === 'function' ? api.getDatePartsInTimezone : () => null;
    const formatYMDFromParts = typeof api.formatYMDFromParts === 'function' ? api.formatYMDFromParts : () => '';
    const getNowInAITimezoneParts = typeof api.getNowInAITimezoneParts === 'function' ? api.getNowInAITimezoneParts : () => null;
    const getTodayStr = typeof api.getTodayStr === 'function' ? api.getTodayStr : () => '';
    const getYesterdayStr = typeof api.getYesterdayStr === 'function' ? api.getYesterdayStr : () => '';
    const escapeHTML = typeof api.escapeHTML === 'function' ? api.escapeHTML : (value) => String(value || '');
    const canUseHealthStateExtensionFeatures = typeof api.canUseHealthStateExtensionFeatures === 'function'
      ? api.canUseHealthStateExtensionFeatures
      : () => false;
    const document = typeof api.getDocumentRef === 'function'
      ? (api.getDocumentRef() || { getElementById: () => null })
      : (typeof window !== 'undefined' && window.document ? window.document : { getElementById: () => null });

    let data = {};
    let aiChatState = {};
    let glucoseHistoryState = {};

    function refreshRuntimeState() {
      const nextData = getDataRoot();
      data = nextData && typeof nextData === 'object' ? nextData : {};
      const nextAIChatState = getAIChatState();
      aiChatState = nextAIChatState && typeof nextAIChatState === 'object' ? nextAIChatState : {};
      const nextGlucoseState = getGlucoseHistoryState();
      glucoseHistoryState = nextGlucoseState && typeof nextGlucoseState === 'object' ? nextGlucoseState : {};
    }

function extractPlainTextFromDailyBlock(block = {}) {
    if (!block || typeof block !== 'object') return '';
    if (typeof block.content === 'string' && block.content.trim()) return block.content.trim();
    if (typeof block.text === 'string' && block.text.trim()) return block.text.trim();
    if (typeof block.title === 'string' && block.title.trim()) return block.title.trim();
    return '';
}

function isHealthMetaInteractionText(text = '') {
    const value = String(text || '').trim();
    if (!value) return true;
    return [
        /如果现在主动(?:巡检|巡查)/,
        /我目前有一些关于你的长期理解/,
        /我会优先听现实和证据/,
        /我作为你当前对话的界面/,
        /这个代理是在系统后台/,
        /这不是信息不足/,
        /我是 Morpheus/,
        /你不用问我，直接替我决定/,
        /帮我直接写一条朋友圈发出去/,
        /可视化.*后台主动代理/,
        /长期理解/,
        /偏好引导/,
        /核心身份/,
        /这套规则/,
        /你觉得还准吗/,
        /先确认下/,
        /如果你想展开某个/,
        /这是我目前比较稳定的长期理解/,
    ].some((pattern) => pattern.test(value));
}

function normalizeHealthEvidenceSnippet(text = '') {
    const plain = String(text || '')
        .replace(/[#>*`]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!plain) return '';
    const sentence = plain.split(/(?<=[。！？!?])/)[0] || plain;
    return sentence.length > 54 ? `${sentence.slice(0, 54).trim()}…` : sentence;
}

function uniqueHealthClues(items = [], limit = 3) {
    const seen = new Set();
    const result = [];
    items.forEach((item) => {
        const value = String(item || '').trim();
        if (!value || seen.has(value)) return;
        seen.add(value);
        result.push(value);
    });
    return result.slice(0, limit);
}

function getHealthTextWindow(text = '', index = 0, radius = 14) {
    const source = String(text || '');
    const center = Math.max(0, Number(index) || 0);
    const safeRadius = Math.max(4, Number(radius) || 14);
    return source.slice(Math.max(0, center - safeRadius), Math.min(source.length, center + safeRadius));
}

function hasNegatedHealthTextNear(text = '', index = 0) {
    const nearby = getHealthTextWindow(text, index, 18);
    const before = nearby.slice(0, Math.max(0, Math.min(nearby.length, 18)));
    const strongNegation = /(没|没有|未|别|避免|戒|停|少|减少|不再|无|拒绝|不要).{0,8}$/;
    const verbNegation = /(没|没有|未|别|避免|戒|停|少|减少|不再|无|拒绝|不要).{0,8}(喝|吃|摄入|碰|买|点|来|要)?/;
    const directBuNegation = /不(?:想|准备|打算|能|要|再)?(?:喝|吃|摄入|碰|买|点|来|要)/;
    const abilityNegation = /(不能|没法|没办法|无法|不敢|不适合|不再|不能再|没再).{0,14}(喝|吃|摄入|碰|点|来|要)/;
    return strongNegation.test(before)
        || verbNegation.test(nearby)
        || directBuNegation.test(nearby)
        || abilityNegation.test(nearby);
}

function hasNonActualCaffeineIntentNear(text = '', index = 0) {
    const nearby = getHealthTextWindow(text, index, 20);
    return /(想|准备|打算|考虑|计划|要).{0,6}(喝|摄入|来一杯|点).{0,6}(咖啡(?!因)|奶茶)/.test(nearby)
        || /(咖啡(?!因)|奶茶).{0,10}(忍住|没喝|未喝|不喝|没点|未点|取消)/.test(nearby);
}

function readHealthOptionalNumber(value) {
    if (value == null) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function hasAffirmedCaffeineIntake(text = '') {
    const source = String(text || '').trim();
    if (!source) return false;
    const caffeineRe = /咖啡(?!因)|奶茶/g;
    let match;
    while ((match = caffeineRe.exec(source))) {
        const nearby = getHealthTextWindow(source, match.index, 18);
        if (hasNegatedHealthTextNear(source, match.index)) continue;
        if (hasNonActualCaffeineIntentNear(source, match.index)) continue;
        if (/(喝(?:了|过|完)?|饮用|摄入|吃(?:了|过)?|来(?:了)?一杯|一杯|半杯|两杯|三杯|[0-9]+杯|拿铁|美式|冷萃)/.test(nearby)) return true;
        if (/^\s*(咖啡(?!因)|奶茶)\s*([一半两三四五六七八九十0-9]+杯|后|前|时|时间|@)/.test(nearby)) return true;
    }
    return false;
}

function getAppleHealthSyncBundle(dataRoot = {}) {
    return dataRoot?.appleHealthSync && typeof dataRoot.appleHealthSync === 'object' ? dataRoot.appleHealthSync : null;
}

function isAppleHealthEnabledInData(dataRoot = {}) {
    const state = dataRoot?.morphRuntime?.userPreferences?.extensionsState;
    return !!(state && typeof state === 'object' && state['apple-health'] === true);
}

function formatAppleHealthSyncLabel(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw.slice(0, 16);
    const parts = getHealthDateParts(parsed);
    if (!parts) return raw.slice(0, 16);
    return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function findAppleHealthDailyEntry(items = [], dateKey = '') {
    const expected = String(dateKey || '').trim();
    if (!expected || !Array.isArray(items)) return null;
    return items
        .filter((item) => item && typeof item === 'object' && String(item.date || '').trim() === expected)
        .slice()
        .sort((a, b) => (Date.parse(String(a?.at || a?.updatedAt || a?.generatedAt || '')) || 0) - (Date.parse(String(b?.at || b?.updatedAt || b?.generatedAt || '')) || 0))
        .pop() || null;
}

function findLatestAppleHealthDailyEntry(items = []) {
    if (!Array.isArray(items)) return null;
    return items
        .filter((item) => item && typeof item === 'object')
        .slice()
        .sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')))
        .pop() || null;
}

function inferHealthSourceKind(source = '') {
    const value = String(source || '').trim();
    if (!value) return 'unknown';
    if (value.startsWith('当前对话') || value.startsWith('历史对话')) return 'chat';
    if (value.startsWith('日志:')) return 'daily';
    if (value === '闪念') return 'flash';
    if (value === '定念') return 'fixed';
    if (value.startsWith('项目')) return 'project';
    if (value === '血糖实时数据') return 'sensor';
    return 'unknown';
}

function getHealthWeekKey(dateKey = '') {
    const raw = String(dateKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayOfMonth}`;
}

function collectHealthSourceTexts(options = {}) {
    refreshRuntimeState();
    const includeTodayHistory = options && options.includeTodayHistory === true;
    const currentMonthKey = String(options?.currentMonthKey || '').trim();
    const entries = [];
    const pushEntry = (axisSource, text, meta = {}) => {
        const value = String(text || '').trim();
        if (!value) return;
        if (isHealthMetaInteractionText(value)) return;
        entries.push({
            source: axisSource,
            text: value,
            ts: String(meta.ts || meta.time || '').trim(),
            kind: inferHealthSourceKind(axisSource),
            meta,
        });
    };

    const currentMessages = Array.isArray(aiChatState?.messages) ? aiChatState.messages.slice(-24) : [];
    currentMessages.forEach((msg) => {
        if (String(msg?.role || '') !== 'user') return;
        pushEntry('当前对话', msg?.content || '', {
            ts: msg?.createdAt || msg?.time || '',
            createdAt: msg?.createdAt || '',
            role: msg?.role || '',
        });
    });

    const sessions = Array.isArray(getAIMemory()?.chatSessions) ? getAIMemory().chatSessions.slice(-6) : [];
    sessions.forEach((session) => {
        (Array.isArray(session?.messages) ? session.messages.slice(-12) : []).forEach((msg) => {
            if (String(msg?.role || '') !== 'user') return;
            pushEntry(`历史对话:${session?.title || '未命名'}`, msg?.content || '', {
                ts: msg?.createdAt || msg?.time || session?.updatedAt || session?.createdAt || '',
                createdAt: msg?.createdAt || session?.updatedAt || session?.createdAt || '',
                role: msg?.role || '',
            });
        });
    });

    const monthKeys = Object.keys(data?.dailyMonths || {}).sort((a, b) => (a < b ? 1 : -1)).slice(0, 2);
    monthKeys.forEach((monthKey) => {
        const monthBlocks = Array.isArray(data?.dailyMonths?.[monthKey]) ? data.dailyMonths[monthKey] : [];
        const blocks = includeTodayHistory && monthKey === currentMonthKey
            ? monthBlocks
            : monthBlocks.slice(-24);
        let currentSectionDateKey = '';
        blocks.forEach((block) => {
            const blockType = String(block?.type || '').trim();
            if (blockType === 'h3') {
                const matchedDate = String(block?.content || '').match(/\d{4}-\d{2}-\d{2}/);
                currentSectionDateKey = matchedDate ? matchedDate[0] : '';
            }
            pushEntry(`日志:${monthKey}`, extractPlainTextFromDailyBlock(block), {
                ts: block?.createdAt || block?.time || '',
                createdAt: block?.createdAt || '',
                kind: blockType,
                dateKey: currentSectionDateKey,
            });
        });
    });

    (Array.isArray(data?.flashThoughts) ? data.flashThoughts.slice(0, 24) : []).forEach((item) => {
        pushEntry('闪念', item?.text || '', {
            ts: item?.createdAt || item?.time || '',
            createdAt: item?.createdAt || '',
        });
    });
    getVisibleFixedThoughts().slice(0, 12).forEach((item) => {
        pushEntry('定念', item?.text || '', {
            ts: item?.createdAt || item?.time || '',
            createdAt: item?.createdAt || '',
        });
    });

    (Array.isArray(data?.projects) ? data.projects.slice(0, 8) : []).forEach((project) => {
        pushEntry(`项目:${project?.name || '未命名'}`, project?.description || project?.summary || '', {
            ts: project?.updatedAt || project?.createdAt || '',
            createdAt: project?.createdAt || '',
            updatedAt: project?.updatedAt || '',
        });
        (Array.isArray(project?.items) ? project.items.slice(0, 8) : []).forEach((item) => {
            pushEntry(`项目执行:${project?.name || '未命名'}`, item?.text || item?.content || '', {
                ts: item?.createdAt || item?.time || '',
                createdAt: item?.createdAt || '',
            });
        });
    });

    if (glucoseHistoryState?.reading && Number.isFinite(Number(glucoseHistoryState.reading.value))) {
        pushEntry('血糖实时数据', `当前血糖 ${formatGlucoseMmol(glucoseHistoryState.reading.value)} mmol/L，趋势 ${formatGlucoseTrendLabel(glucoseHistoryState.reading?.trend)}，时间 ${formatGlucoseTime(glucoseHistoryState.reading?.timestamp)}`, {
            ts: glucoseHistoryState.reading?.timestamp || glucoseHistoryState.updatedAt || '',
            createdAt: glucoseHistoryState.reading?.timestamp || glucoseHistoryState.updatedAt || '',
        });
    }

    return entries;
}

function parseClockToMinutes(clock = '') {
    const match = String(clock || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
}

function formatHealthTimelineClock(minutes = 0) {
    const safe = ((Number(minutes) || 0) + 1440) % 1440;
    const hours = Math.floor(safe / 60);
    const mins = safe % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function getHealthTimezone() {
    return typeof AI_TIMEZONE !== 'undefined' && String(AI_TIMEZONE || '').trim()
        ? String(AI_TIMEZONE).trim()
        : 'Asia/Shanghai';
}

function getHealthDateParts(value = null) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    return getDatePartsInTimezone(date, getHealthTimezone());
}

function getLocalDateKey(value = null) {
    const parts = getHealthDateParts(value);
    return formatYMDFromParts(parts);
}

function parseTodayMinuteFromTimestamp(ts = '', options = {}) {
    const raw = String(ts || '').trim();
    if (!raw) return null;
    if (/^\d{1,2}:\d{2}$/.test(raw)) return parseClockToMinutes(raw);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    const parts = getHealthDateParts(parsed);
    if (!parts) return null;
    const targetDateKey = String(options.dateKey || getLocalDateKey()).trim();
    const currentDateKey = formatYMDFromParts(parts);
    if (currentDateKey === targetDateKey) return (parts.hour * 60) + parts.minute;
    const allowPreviousLateNight = options && options.allowPreviousLateNight === true;
    const previousDateKey = String(options.previousDateKey || '').trim();
    if (allowPreviousLateNight && previousDateKey && currentDateKey === previousDateKey && parts.hour >= 22) return (parts.hour * 60) + parts.minute;
    return null;
}

function deriveHealthWindowMinutes(startTs = '', endTs = '', windowHours = null, options = {}) {
    const endMinute = parseTodayMinuteFromTimestamp(endTs, options);
    let startMinute = parseTodayMinuteFromTimestamp(startTs, options);
    if (startMinute === null && endMinute !== null && Number.isFinite(Number(windowHours)) && Number(windowHours) > 0) {
        startMinute = Math.max(0, Math.round(endMinute - (Number(windowHours) * 60)));
    }
    if (startMinute === null || endMinute === null) return null;
    if (endMinute <= startMinute) return null;
    return {
        start: Math.max(0, Math.min(1439, Math.round(startMinute))),
        end: Math.max(1, Math.min(1440, Math.round(endMinute))),
    };
}

function extractHealthEntryTemporal(entry = {}) {
    const candidates = [
        entry?.meta?.createdAt,
        entry?.meta?.updatedAt,
        entry?.meta?.ts,
        entry?.ts,
    ];
    for (const candidate of candidates) {
        const raw = String(candidate || '').trim();
        if (!raw || /^\d{1,2}:\d{2}$/.test(raw)) continue;
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) continue;
        const parts = getHealthDateParts(parsed);
        if (!parts) continue;
        return {
            dateKey: formatYMDFromParts(parts),
            hour: parts.hour,
            minute: parts.minute,
            timestampMs: parsed.getTime(),
            parts,
        };
    }
    const fallbackDateKey = String(entry?.meta?.dateKey || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(fallbackDateKey)) {
        const text = String(entry?.text || '').trim();
        const clockMatch = text.match(/(\d{1,2}[:：]\d{2})/);
        const fallbackMinute = clockMatch ? parseClockToMinutes(clockMatch[1].replace('：', ':')) : null;
        const hour = fallbackMinute === null ? 12 : Math.floor(fallbackMinute / 60);
        const minute = fallbackMinute === null ? 0 : fallbackMinute % 60;
        return {
            dateKey: fallbackDateKey,
            hour,
            minute,
            timestampMs: NaN,
            parts: null,
        };
    }
    return null;
}

function extractHealthEntryDateKey(entry = {}) {
    return extractHealthEntryTemporal(entry)?.dateKey || '';
}

function isTodayHealthEntry(entry = {}, options = {}) {
    const expected = String(options.dateKey || getLocalDateKey()).trim();
    const dateKey = extractHealthEntryDateKey(entry);
    return !!dateKey && !!expected && dateKey === expected;
}

function parseClockToMinutesWithContext(source = '', hour = 0, minute = 0, index = 0) {
    let normalizedHour = Number(hour);
    const normalizedMinute = Number(minute);
    if (!Number.isFinite(normalizedHour) || !Number.isFinite(normalizedMinute)) return null;
    if (normalizedHour < 0 || normalizedHour > 23 || normalizedMinute < 0 || normalizedMinute > 59) return null;
    const text = String(source || '');
    const start = Math.max(0, Number(index) - 8);
    const end = Math.min(text.length, Number(index) + 8);
    const nearby = text.slice(start, end);
    if (/(下午|晚上|傍晚|晚间|夜里|pm)/i.test(nearby) && normalizedHour < 12) normalizedHour += 12; else if (/(中午)/.test(nearby) && normalizedHour < 11) normalizedHour += 12; else if (/(凌晨|清晨|早上|上午|am)/i.test(nearby) && normalizedHour === 12) {
        normalizedHour = 0;
    }
    return (normalizedHour * 60) + normalizedMinute;
}

function extractHealthTimelineClocks(text = '') {
    const source = String(text || '');
    const matcher = /(\d{1,2})[:：](\d{2})/g;
    const clocks = [];
    let match;
    while ((match = matcher.exec(source))) {
        const minute = parseClockToMinutesWithContext(source, Number(match[1]), Number(match[2]), match.index);
        if (minute === null) continue;
        clocks.push({
            minute,
            index: match.index,
        });
    }
    return clocks;
}

function resolveHealthTimelineMinuteForPattern(entry = {}, text = '', pattern = null, options = {}) {
    const source = String(text || '');
    const clocks = extractHealthTimelineClocks(source);
    if (clocks.length) {
        if (clocks.length === 1 || !(pattern instanceof RegExp)) return clocks[0].minute;
        const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
        const matcher = new RegExp(pattern.source, flags);
        const hits = [];
        let match;
        while ((match = matcher.exec(source))) {
            hits.push(match.index);
        }
        if (!hits.length) return clocks[0].minute;
        let bestPreviousClock = null;
        let bestPreviousDistance = Infinity;
        hits.forEach((hitIndex) => {
            clocks.forEach((clock) => {
                if (clock.index > hitIndex) return;
                const distance = hitIndex - clock.index;
                if (distance < bestPreviousDistance) {
                    bestPreviousDistance = distance;
                    bestPreviousClock = clock;
                }
            });
        });
        if (bestPreviousClock && bestPreviousDistance <= 18) return bestPreviousClock.minute;
        let bestClock = null;
        let bestDistance = Infinity;
        hits.forEach((hitIndex) => {
            clocks.forEach((clock) => {
                const distance = Math.abs(clock.index - hitIndex);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestClock = clock;
                }
            });
        });
        if (bestClock && bestDistance <= 28) return bestClock.minute;
    }
    const fromTs = parseTodayMinuteFromTimestamp(entry?.ts || entry?.meta?.ts || entry?.meta?.time || '', options);
    if (fromTs !== null) return fromTs;
    return null;
}

function isMinuteInsideSleepWindow(minute, sleepStartMinute, sleepEndMinute) {
    if (!Number.isFinite(Number(minute))) return false;
    if (!Number.isFinite(Number(sleepStartMinute)) || !Number.isFinite(Number(sleepEndMinute))) return false;
    const safeMinute = Math.max(0, Math.min(1439, Math.round(Number(minute))));
    const start = Math.max(0, Math.min(1439, Math.round(Number(sleepStartMinute))));
    const end = Math.max(0, Math.min(1439, Math.round(Number(sleepEndMinute))));
    if (end >= start) return safeMinute >= start && safeMinute <= end;
    return safeMinute >= start || safeMinute <= end;
}

function formatHealthDurationShort(totalMinutes = 0) {
    const safe = Math.max(0, Math.round(Number(totalMinutes) || 0));
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;
    if (hours <= 0) return `${minutes}m`;
    if (minutes <= 0) return `${hours}h`;
    return `${hours}h${String(minutes).padStart(2, '0')}m`;
}

function computeContinuousHealthWorkMinutes(timestamps = [], nowMs = Date.now(), maxGapMinutes = 95) {
    const list = Array.isArray(timestamps)
        ? Array.from(new Set(
            timestamps
                .map((item) => Number(item))
                .filter((item) => Number.isFinite(item) && item > 0 && item <= nowMs)
        )).sort((a, b) => a - b)
        : [];
    if (!list.length) return 0;
    const maxGapMs = Math.max(15, Number(maxGapMinutes) || 95) * 60 * 1000;
    const lastIndex = list.length - 1;
    if ((nowMs - list[lastIndex]) > maxGapMs) return 0;
    let chainStart = list[lastIndex];
    for (let idx = lastIndex; idx > 0; idx -= 1) {
        if ((list[idx] - list[idx - 1]) > maxGapMs) break;
        chainStart = list[idx - 1];
    }
    return Math.max(0, Math.round((nowMs - chainStart) / (60 * 1000)));
}

function buildHealthRelationshipFieldModel() {
    refreshRuntimeState();
    const now = new Date();
    const nowParts = getHealthDateParts(now) || getNowInAITimezoneParts() || null;
    const currentHour = Number(nowParts?.hour);
    const currentMinute = Number(nowParts?.minute);
    const resolvedHour = Number.isFinite(currentHour) ? currentHour : now.getHours();
    const resolvedMinute = Number.isFinite(currentMinute) ? currentMinute : now.getMinutes();
    const nowMinute = resolvedHour * 60 + resolvedMinute;
    const todayDateKey = formatYMDFromParts(nowParts) || getTodayStr();
    const yesterdayDateKey = getYesterdayStr();
    const currentMonthKey = String(todayDateKey || '').slice(0, 7);
    const isEarlyMorning = resolvedHour < 4;
    const timelineMinuteOptions = {
        dateKey: todayDateKey,
        previousDateKey: yesterdayDateKey,
        allowPreviousLateNight: isEarlyMorning,
    };
    const isLateNightByClock = () => resolvedHour >= 23 || resolvedHour < 4;
    const sourceTexts = collectHealthSourceTexts({ currentMonthKey }).slice(0, 96);
    const isCurrentCycleEntry = (entry) => {
        if (isTodayHealthEntry(entry, { dateKey: todayDateKey })) return true;
        if (!isEarlyMorning) return false;
        const temporal = extractHealthEntryTemporal(entry);
        return !!(temporal && temporal.dateKey === yesterdayDateKey && temporal.hour >= 22);
    };
    const timelineSourceTexts = collectHealthSourceTexts({ includeTodayHistory: true, currentMonthKey })
        .filter((entry) => isCurrentCycleEntry(entry));
    const todayAiDailyLogs = Array.isArray(getAIMemory()?.dailyLogs?.[todayDateKey]) ? getAIMemory().dailyLogs[todayDateKey] : [];
    const appleHealthBundle = getAppleHealthSyncBundle(data);
    const appleHealthSnapshot = appleHealthBundle?.snapshot && typeof appleHealthBundle.snapshot === 'object'
        ? appleHealthBundle.snapshot
        : null;
    const appleHealthHistory = appleHealthBundle?.history && typeof appleHealthBundle.history === 'object'
        ? appleHealthBundle.history
        : null;
    const appleHealthEnabled = isAppleHealthEnabledInData(data);
    const grouped = {
        body: [],
        others: [],
        self: [],
    };
    const pushSignal = (axis, id, title, state, evidence = [], options = {}) => {
        if (!grouped[axis]) return;
        const evidenceList = (Array.isArray(evidence) ? evidence : [evidence])
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 3);
        const confidenceHint = String(options.confidence || '').trim().toLowerCase();
        let confidence = confidenceHint;
        if (!['high', 'medium', 'low'].includes(confidence)) {
            if (evidenceList.length >= 2) confidence = 'high';
            else if (evidenceList.length === 1) confidence = 'medium';
            else if (options && options.hasStructuredData === true) confidence = 'medium';
            else confidence = 'low';
        }
        const confidenceLabel = confidence === 'high'
            ? '高'
            : (confidence === 'medium' ? '中' : '低');
        grouped[axis].push({
            id,
            title,
            state: String(state || '').trim(),
            evidence: evidenceList,
            confidence,
            confidenceLabel,
        });
    };

    const topicScores = { glucose: 0, sleep: 0, project: 0, rhythm: 0, relation: 0, food: 0 };
    const mentalScores = { tense: 0, reflective: 0, orderly: 0, drained: 0, soft: 0 };
    const attitudeScores = { push: 0, protect: 0, postpone: 0 };
    const hasLateNightWorkload = () => resolvedHour >= 22 && (topicScores.project + attitudeScores.push) >= 3;
    const shouldFlagLateNight = () => isLateNightByClock() || hasLateNightWorkload();

    const peopleSignals = [];
    const socialSignals = [];
    const selfSignals = [];
    const symptomSignals = [];
    const sleepSignals = [];
    const foodSignals = [];
    const movementSignals = [];
    const moodSignals = [];
    const rhythmSymptomSignals = [];
    const rhythmFoodSignals = [];
    const rhythmMovementSignals = [];
    const rhythmStateClues = [];
    const timelineEvents = [];
    const recentLateNightWorkEvidence = [];
    const lateNightWorkTimestamps = [];
    const workloadLikeRe = /项目|推进|工作流|修复|部署|交付|bug|版本|优化|清单|会议|沟通|处理|排查|开发|上线|回归|发布/;
    const isTemporalRecent = (temporal, minutes = 90) => {
        if (!temporal || !Number.isFinite(Number(temporal.timestampMs))) return false;
        const diff = now.getTime() - Number(temporal.timestampMs);
        return diff >= 0 && diff <= Math.max(5, Number(minutes) || 90) * 60 * 1000;
    };
    const isTemporalInLateNightWindow = (temporal) => {
        if (!temporal) return false;
        if (resolvedHour >= 22) return temporal.dateKey === todayDateKey && temporal.hour >= 22;
        if (resolvedHour < 4) {
            return (temporal.dateKey === todayDateKey && temporal.hour < 4)
                || (temporal.dateKey === yesterdayDateKey && temporal.hour >= 22);
        }
        return false;
    };

    let latestSleepClock = null;
    let latestWakeClock = null;
    let rhythmSleepClock = null;
    let rhythmWakeClock = null;
    const timelineSleepEntries = timelineSourceTexts.length
        ? timelineSourceTexts
        : sourceTexts.filter((entry) => isCurrentCycleEntry(entry));
    timelineSleepEntries.forEach((entry) => {
        const text = String(entry?.text || '').trim();
        if (!text) return;
        const sleepMatch = text.match(/(?:睡|入睡|睡觉|睡着)[^\d]{0,4}(\d{1,2}[:：]\d{2})/);
        const wakeMatch = text.match(/(?:起床|醒来|醒)[^\d]{0,4}(\d{1,2}[:：]\d{2})/);
        if (sleepMatch) rhythmSleepClock = sleepMatch[1].replace('：', ':');
        if (wakeMatch) rhythmWakeClock = wakeMatch[1].replace('：', ':');
    });
    const inferredSleepStartMinute = parseClockToMinutes(rhythmSleepClock);
    const inferredSleepEndMinute = parseClockToMinutes(rhythmWakeClock);
    const timelineEventSeen = new Set();
    const pushTimelineEvent = (label, minute, tone = 'neutral') => {
        if (!label || minute === null || !Number.isFinite(Number(minute))) return;
        const safeMinute = Math.max(0, Math.min(1439, Math.round(Number(minute))));
        const bucket = Math.round(safeMinute / 20);
        const key = `${label}:${bucket}`;
        if (timelineEventSeen.has(key)) return;
        timelineEventSeen.add(key);
        timelineEvents.push({
            label,
            minute: safeMinute,
            time: formatHealthTimelineClock(safeMinute),
            tone,
        });
    };
    const scheduleState = data?.scheduleMvp && typeof data.scheduleMvp === 'object' ? data.scheduleMvp : {};
    const scheduleWeekKey = getHealthWeekKey(todayDateKey);
    let scheduleTimelineEventCount = 0;
    const pushScheduleTimelineEvent = (label, minute, tone = 'neutral') => {
        const beforeCount = timelineEvents.length;
        pushTimelineEvent(label, minute, tone);
        if (timelineEvents.length > beforeCount) scheduleTimelineEventCount += 1;
    };
    const inferScheduleTimelineMinute = (text = '', fallbackMinute = null) => {
        const source = String(text || '').trim();
        if (/22:30|上床|睡觉|入睡|睡眠/.test(source)) return 22 * 60 + 30;
        if (/起床|醒来|早起/.test(source)) return 7 * 60 + 30;
        if (/跑步|晨跑/.test(source)) return 8 * 60 + 30;
        if (/散步|步行|遛弯/.test(source)) return 18 * 60 + 30;
        if (/锻炼|运动|健身|训练/.test(source)) return 19 * 60;
        if (/书稿|写书|写作|改稿/.test(source)) return 11 * 60 + 20;
        if (/日志|记录/.test(source)) return 10 * 60 + 5;
        if (/review|复盘/i.test(source)) return 10 * 60 + 30;
        return Number.isFinite(Number(fallbackMinute)) ? Number(fallbackMinute) : null;
    };
    const resolveScheduleTimelineMinute = (timestamp = '', text = '', fallbackMinute = null, options = {}) => {
        const rawTimestamp = String(timestamp || '').trim();
        if (rawTimestamp) {
            const exactMinute = parseTodayMinuteFromTimestamp(rawTimestamp, timelineMinuteOptions);
            if (exactMinute !== null) return exactMinute;
            if (options && options.strictToday === true) return null;
        }
        return inferScheduleTimelineMinute(text, fallbackMinute);
    };
    const appendTimelineMarkersFromEntry = (entry, minuteOptions = {}) => {
        const text = String(entry?.text || '').trim();
        if (!text) return;
        const breakfastRe = /早餐|早饭/;
        const lunchRe = /午餐|午饭/;
        const dinnerRe = /晚餐|晚饭/;
        const snackRe = /夜宵|加餐|零食/;
        const caffeineRe = /咖啡|奶茶/;
        const runRe = /跑步|慢跑|夜跑|晨跑/;
        const walkRe = /散步|走路|步行|遛弯/;
        const workoutRe = /运动|锻炼|健身|训练/;
        const movementRe = /走|散步|运动|锻炼|健身|训练|站起来|活动|跑步|慢跑|夜跑|晨跑|走路|步行|遛弯/;
        const symptomRe = /头晕|头疼|疲劳|乏力|难受|痛|眩晕|心慌|恶心|胸闷/;
        const focusRe = /项目|推进|会议|沟通|处理|交付|修复|部署/;
        const writingRe = /写日志|日志|复盘|记录|写作|书稿|写书|改稿|整理书稿/;
        const sleepStartRe = /睡觉|入睡|睡着|去睡|上床睡/;
        const wakeRe = /起床|醒来|睡醒|醒了|早起/;
        const minuteFor = (pattern) => resolveHealthTimelineMinuteForPattern(entry, text, pattern, minuteOptions);
        const canRenderInSleep = (minute, tone) => {
            if (!['move', 'body', 'focus'].includes(String(tone || ''))) return true;
            return !isMinuteInsideSleepWindow(minute, inferredSleepStartMinute, inferredSleepEndMinute);
        };
        const pushIfValid = (label, minute, tone) => {
            if (minute === null || minute > (nowMinute + 5)) return;
            if (!canRenderInSleep(minute, tone)) return;
            pushTimelineEvent(label, minute, tone);
        };

        if (breakfastRe.test(text)) pushIfValid('早餐', minuteFor(breakfastRe), 'meal');
        else if (lunchRe.test(text)) pushIfValid('午餐', minuteFor(lunchRe), 'meal');
        else if (dinnerRe.test(text)) pushIfValid('晚餐', minuteFor(dinnerRe), 'meal');
        else if (snackRe.test(text)) pushIfValid('加餐', minuteFor(snackRe), 'meal');
        else if (hasAffirmedCaffeineIntake(text)) pushIfValid('咖啡因', minuteFor(caffeineRe), 'meal');

        if (sleepStartRe.test(text)) pushIfValid('入睡', minuteFor(sleepStartRe), 'rest');
        if (wakeRe.test(text)) pushIfValid('起床', minuteFor(wakeRe), 'rest');

        if (runRe.test(text)) pushIfValid('跑步', minuteFor(runRe), 'move');
        else if (walkRe.test(text)) pushIfValid('散步', minuteFor(walkRe), 'move');
        else if (workoutRe.test(text)) pushIfValid('锻炼', minuteFor(workoutRe), 'move');
        else if (movementRe.test(text)) pushIfValid('活动', minuteFor(movementRe), 'move');

        if (writingRe.test(text)) {
            const writingLabel = /书稿|写书|改稿|整理书稿/.test(text)
                ? '写书稿'
                : /写作/.test(text)
                    ? '写作'
                    : '日志记录';
            pushIfValid(writingLabel, minuteFor(writingRe), 'self');
        }
        if (symptomRe.test(text)) pushIfValid('不适', minuteFor(symptomRe), 'body');
        if (focusRe.test(text)) pushIfValid('事务负荷', minuteFor(focusRe), 'focus');
    };
    const buildRhythmStateClue = (entry = {}, text = '', snippet = '') => {
        const temporal = extractHealthEntryTemporal(entry);
        if (!temporal || temporal.dateKey !== todayDateKey) return null;
        const minute = (Number(temporal.hour) * 60) + Number(temporal.minute);
        if (!Number.isFinite(minute) || minute > (nowMinute + 5)) return null;
        const source = String(text || '');
        const tags = {
            sleep: /昏昏欲睡|困|睡|失眠|熬夜|早醒|醒来|起床|入睡|疲惫|累|乏力|恢复不足|没睡好/.test(source),
            body: /头晕|头疼|疲劳|乏力|难受|痛|眩晕|心慌|恶心|胸闷|身体/.test(source),
            food: /早餐|早饭|午餐|午饭|晚餐|晚饭|夜宵|加餐|零食|进食|饮食|餐后|甜|碳水|饭/.test(source) || hasAffirmedCaffeineIntake(source),
            move: /走|散步|运动|锻炼|久坐|站起来|活动/.test(source),
            work: workloadLikeRe.test(source),
            mood: /焦虑|混乱|卡住|崩|烦|痛苦|压力|撑不住|情绪|委屈|平静|放松/.test(source),
            self: /记录|复盘|整理|写日志|判断|为什么|如何|状态/.test(source),
        };
        if (!Object.values(tags).some(Boolean)) return null;
        return {
            minute: Math.max(0, Math.min(1439, Math.round(minute))),
            tags,
            snippet,
        };
    };

    sourceTexts.forEach((entry) => {
        const text = String(entry?.text || '').trim();
        if (!text) return;
        const snippet = normalizeHealthEvidenceSnippet(text);
        const entryTemporal = extractHealthEntryTemporal(entry);
        const entryIsToday = !!(entryTemporal && entryTemporal.dateKey === todayDateKey);
        const entryInCurrentCycle = entryIsToday || !!(isEarlyMorning && entryTemporal && entryTemporal.dateKey === yesterdayDateKey && entryTemporal.hour >= 22);

        if (entryInCurrentCycle) {
            const periodClue = buildRhythmStateClue(entry, text, snippet);
            if (periodClue) rhythmStateClues.push(periodClue);
            if (/血糖|glucose|cgm|libre|低血糖|高血糖|餐后/.test(text)) topicScores.glucose += 1;
            if (/睡|失眠|熬夜|早醒|醒来|起床|入睡|困|没睡好|睡眠/.test(text)) topicScores.sleep += 1;
            if (/项目|推进|工作流|修复|部署|交付|bug|版本|优化|装修|清单/.test(text)) topicScores.project += 1;
            if (/节律|稳住|规律|作息|秩序|恢复|周期/.test(text)) topicScores.rhythm += 1;
            if (/家人|妈妈|爸爸|女儿|儿子|朋友|同事|伴侣|爷爷|奶奶|舅舅|外甥女|社交|关系/.test(text)) topicScores.relation += 1;
            if (/吃|喝|饮食|餐|咖啡|奶茶|甜|碳水|买菜|饭/.test(text)) topicScores.food += 1;

            if (/焦虑|混乱|卡住|崩|烦|痛苦|不要|必须|到底|怎么还|难受|撑不住|压力/.test(text)) mentalScores.tense += 1;
            if (/我觉得|我发现|判断|其实|状态|为什么|如何|关系|模型|记录|日志/.test(text)) mentalScores.reflective += 1;
            if (/整理|统一|修复|推进|稳住|复盘|计划|总结|继续/.test(text)) mentalScores.orderly += 1;
            if (/累|疲惫|头晕|熬夜|困|乏力|消耗|睡不好/.test(text)) mentalScores.drained += 1;
            if (/温和|慢慢|先停|先缓|保护|陪跑|留白/.test(text)) mentalScores.soft += 1;

            if (/先|今天|马上|尽快|推进|完成|修复|处理|搞定/.test(text)) attitudeScores.push += 1;
            if (/稳住|保护|轻一点|留白|不要塞满|压缩|缓冲|先停/.test(text)) attitudeScores.protect += 1;
            if (/之后|明天|先不|往后挪|缓一缓|再说|延期/.test(text)) attitudeScores.postpone += 1;

            if (/睡|失眠|熬夜|早醒|醒来|起床|入睡|睡眠/.test(text)) {
                sleepSignals.push(snippet);
                const sleepMatch = text.match(/(?:睡|入睡|睡觉|睡着)[^\d]{0,4}(\d{1,2}[:：]\d{2})/);
                const wakeMatch = text.match(/(?:起床|醒来|醒)[^\d]{0,4}(\d{1,2}[:：]\d{2})/);
                if (sleepMatch) latestSleepClock = sleepMatch[1].replace('：', ':');
                if (wakeMatch) latestWakeClock = wakeMatch[1].replace('：', ':');
                if (sleepMatch) rhythmSleepClock = sleepMatch[1].replace('：', ':');
                if (wakeMatch) rhythmWakeClock = wakeMatch[1].replace('：', ':');
            }
            if (/头晕|头疼|疲劳|乏力|难受|痛|眩晕|心慌|恶心|胸闷|身体/.test(text)) {
                symptomSignals.push(snippet);
                rhythmSymptomSignals.push(snippet);
            }
            if (/吃|喝|饮食|餐|咖啡|奶茶|甜|碳水|零食|饭/.test(text)) {
                foodSignals.push(snippet);
                rhythmFoodSignals.push(snippet);
            }
            if (/走|散步|运动|锻炼|久坐|站起来|活动/.test(text)) {
                movementSignals.push(snippet);
                rhythmMovementSignals.push(snippet);
            }
        }
        if (entryInCurrentCycle && workloadLikeRe.test(text)) {
            if (isTemporalRecent(entryTemporal, 90)) recentLateNightWorkEvidence.push(snippet);
            if (isTemporalInLateNightWindow(entryTemporal) && Number.isFinite(Number(entryTemporal?.timestampMs))) lateNightWorkTimestamps.push(Number(entryTemporal.timestampMs));
        }

        const personMention = /家人|父母|妈妈|爸爸|女儿|儿子|老婆|老公|伴侣|朋友|同事|老板|客户|爷爷|奶奶|舅舅|外甥女/.test(text);
        const interactionVerb = /聊|说|沟通|见面|打电话|发消息|一起|陪|相处|吃饭|去看|拜访|联系/.test(text);
        if (entryInCurrentCycle && personMention && interactionVerb) peopleSignals.push(snippet);
        if ((personMention && /压力|期待|照顾|支持|牵挂|陪伴|人情|冲突/.test(text)) || /沟通|冲突|关系|压力|期待|照顾|支持|陪|相处|社交|人情/.test(text)) if (entryInCurrentCycle) socialSignals.push(snippet);

        if (entryInCurrentCycle && (entry.kind === 'daily' || entry.kind === 'flash' || entry.kind === 'fixed' || entry.kind === 'chat') && /日志|写作|写日志|复盘|记录|整理|计划/.test(text)) selfSignals.push(snippet);
        if (entryInCurrentCycle && (entry.kind === 'daily' || entry.kind === 'chat' || entry.kind === 'flash') && /情绪|难过|委屈|开心|平静|烦|累|撑不住|压力|放松|焦虑|混乱|希望/.test(text)) moodSignals.push(snippet);

        if (entryInCurrentCycle) appendTimelineMarkersFromEntry(entry, timelineMinuteOptions);
    });
    timelineSourceTexts.forEach((entry) => appendTimelineMarkersFromEntry(entry, timelineMinuteOptions));

    if (scheduleState?.sleep && scheduleState.sleep[todayDateKey] === true) {
        const sleepAt = scheduleState?.sleepAt && typeof scheduleState.sleepAt === 'object' ? scheduleState.sleepAt[todayDateKey] : '';
        pushScheduleTimelineEvent('上床睡觉', resolveScheduleTimelineMinute(sleepAt, '22:30 上床睡觉'), 'rest');
    }
    if (scheduleWeekKey && scheduleState?.review && scheduleState.review[scheduleWeekKey] === true) {
        const reviewAt = scheduleState?.reviewAt && typeof scheduleState.reviewAt === 'object' ? scheduleState.reviewAt[scheduleWeekKey] : '';
        pushScheduleTimelineEvent('Weekly Review', resolveScheduleTimelineMinute(reviewAt, 'review', null, { strictToday: true }), 'self');
    }
    if (scheduleWeekKey && scheduleState?.exercise && scheduleState.exercise[scheduleWeekKey] && scheduleState.exercise[scheduleWeekKey][todayDateKey] === true) {
        const exerciseAt = scheduleState?.exerciseAt && typeof scheduleState.exerciseAt === 'object' && scheduleState.exerciseAt[scheduleWeekKey] && typeof scheduleState.exerciseAt[scheduleWeekKey] === 'object'
            ? scheduleState.exerciseAt[scheduleWeekKey][todayDateKey]
            : '';
        pushScheduleTimelineEvent('锻炼', resolveScheduleTimelineMinute(exerciseAt, '锻炼'), 'move');
    }
    const monthBlocks = Array.isArray(data?.dailyMonths?.[currentMonthKey]) ? data.dailyMonths[currentMonthKey] : [];
    const hasDailyLogToday = monthBlocks.some((block) => {
        if (String(block?.type || '').trim() !== 'h3') return false;
        return String(block?.content || '').includes(todayDateKey);
    });
    if (hasDailyLogToday) {
        pushScheduleTimelineEvent('日志记录', inferScheduleTimelineMinute('日志'), 'self');
    }
    const customRoutines = Array.isArray(scheduleState?.custom) ? scheduleState.custom : [];
    const customDoneMap = scheduleState?.customDone && typeof scheduleState.customDone === 'object' ? scheduleState.customDone : {};
    customRoutines.forEach((item) => {
        const id = String(item?.id || '').trim();
        if (!id) return;
        const todayDone = !!(customDoneMap[id] && typeof customDoneMap[id] === 'object' && customDoneMap[id][todayDateKey] === true);
        if (!todayDone) return;
        const title = String(item?.title || '').trim() || '自定义节律';
        const customDoneAt = scheduleState?.customDoneAt && typeof scheduleState.customDoneAt === 'object' && scheduleState.customDoneAt[id] && typeof scheduleState.customDoneAt[id] === 'object'
            ? scheduleState.customDoneAt[id][todayDateKey]
            : '';
        const label = /书稿|写书|写作/.test(title)
            ? '写书稿'
            : /日志|记录/.test(title)
                ? '日志记录'
                : /跑步/.test(title)
                    ? '跑步'
                    : /散步/.test(title)
                        ? '散步'
                        : /锻炼|运动/.test(title)
                            ? '锻炼'
                            : title.slice(0, 12);
        pushScheduleTimelineEvent(label, resolveScheduleTimelineMinute(customDoneAt, title, 15 * 60), /跑步|散步|锻炼|运动/.test(label) ? 'move' : 'self');
    });

    const liveReading = glucoseHistoryState?.reading && Number.isFinite(Number(glucoseHistoryState.reading.value))
        ? glucoseHistoryState.reading
        : null;
    const validGlucoseSeries = Array.isArray(glucoseHistoryState?.series) ? glucoseHistoryState.series.filter((item) => Number.isFinite(Number(item?.value))) : [];
    const todayGlucoseSeries = validGlucoseSeries
        .map((item) => {
            const minute = parseTodayMinuteFromTimestamp(item?.timestamp || '', timelineMinuteOptions);
            return minute === null ? null : { minute, value: Number(item?.value) };
        })
        .filter(Boolean);

    if (liveReading && todayGlucoseSeries.length >= 6) {
        const glucoseState = liveReading.isLow
            ? `当前偏低，代谢稳定性需要优先照看`
            : liveReading.isHigh
                ? `当前偏高，今天的身体状态容易被代谢牵动`
                : `当前血糖 ${formatGlucoseMmol(liveReading.value)} mmol/L，整体偏稳`;
        pushSignal('body', 'glucose', '代谢状态', glucoseState, [
            `今天有连续血糖数据，可以放心把代谢状态纳入判断`,
            `${formatGlucoseTrendLabel(liveReading.trend)}，当前没有明显失控迹象`,
        ], { confidence: 'high', hasStructuredData: true });
    }

    const glucoseMinute = liveReading?.timestamp ? parseTodayMinuteFromTimestamp(liveReading.timestamp, timelineMinuteOptions) : null;
    if (glucoseMinute !== null) {
        pushTimelineEvent(
            liveReading?.isLow ? '低糖提醒' : liveReading?.isHigh ? '高糖提醒' : '血糖检查',
            glucoseMinute,
            liveReading?.isLow || liveReading?.isHigh ? 'body' : 'glucose'
        );
    }

    const appleActivityToday = findAppleHealthDailyEntry(appleHealthHistory?.activityDaily, todayDateKey);
    const appleActivityLatest = findLatestAppleHealthDailyEntry(appleHealthHistory?.activityDaily);
    const appleRestingToday = findAppleHealthDailyEntry(appleHealthHistory?.restingHeartRateDaily, todayDateKey);
    const appleRestingLatest = findLatestAppleHealthDailyEntry(appleHealthHistory?.restingHeartRateDaily);
    const appleSleepToday = findAppleHealthDailyEntry(appleHealthHistory?.sleepDaily, todayDateKey);
    const appleSleepLatest = findLatestAppleHealthDailyEntry(appleHealthHistory?.sleepDaily);
    const appleSnapshotAnchor = appleHealthSnapshot?.windowEnd || appleHealthSnapshot?.fetchedAt || appleHealthBundle?.updatedAt || '';
    const appleSnapshotDateKey = appleSnapshotAnchor ? getLocalDateKey(appleSnapshotAnchor) : '';
    const appleSnapshotIsToday = !!appleSnapshotDateKey && appleSnapshotDateKey === todayDateKey;
    const appleLastSyncAt = String(appleHealthBundle?.updatedAt || appleHealthSnapshot?.fetchedAt || appleHealthHistory?.generatedAt || '').trim();
    const appleLastSyncLabel = formatAppleHealthSyncLabel(appleLastSyncAt);
    const appleLastSyncMs = appleLastSyncAt ? Date.parse(appleLastSyncAt) : NaN;
    const appleSyncIsFresh = Number.isFinite(appleLastSyncMs)
        ? (now.getTime() - appleLastSyncMs) <= 24 * 60 * 60 * 1000
        : false;
    const appleHistoryHeartSamples = Array.isArray(appleHealthHistory?.heartRateSamples) ? appleHealthHistory.heartRateSamples : [];
    const appleTodayHeartSamples = appleHistoryHeartSamples.filter((sample) => {
        const at = String(sample?.at || '').trim();
        return at && getLocalDateKey(at) === todayDateKey;
    });
    const appleSnapshotHeartSamples = Array.isArray(appleHealthSnapshot?.heartRateSamples) ? appleHealthSnapshot.heartRateSamples : [];
    const appleHeartSamples = appleSnapshotIsToday && appleSnapshotHeartSamples.length
        ? appleSnapshotHeartSamples
        : appleTodayHeartSamples;
    const appleFallbackActivity = appleActivityToday || (appleSnapshotIsToday ? appleHealthSnapshot : null) || appleActivityLatest;
    const appleFallbackResting = appleRestingToday || (appleSnapshotIsToday ? appleHealthSnapshot : null) || appleRestingLatest;
    const appleFallbackSleep = appleSleepToday || (appleSnapshotIsToday ? appleHealthSnapshot?.sleep : null) || appleSleepLatest;
    const appleSteps = readHealthOptionalNumber(appleActivityToday?.steps ?? (appleSnapshotIsToday ? appleHealthSnapshot?.steps : null));
    const appleActiveKcal = readHealthOptionalNumber(appleActivityToday?.activeEnergyKcal ?? (appleSnapshotIsToday ? appleHealthSnapshot?.activeEnergyKcal : null));
    const appleDistanceMeters = readHealthOptionalNumber(appleActivityToday?.distanceMeters ?? (appleSnapshotIsToday ? appleHealthSnapshot?.distanceMeters : null));
    const appleRestingHeartRate = readHealthOptionalNumber(appleRestingToday?.restingHeartRateBpm ?? (appleSnapshotIsToday ? appleHealthSnapshot?.restingHeartRateBpm : null));
    const appleWindowHours = appleSnapshotIsToday ? readHealthOptionalNumber(appleHealthSnapshot?.windowHours) : null;
    const appleSleep = appleFallbackSleep && typeof appleFallbackSleep === 'object' ? appleFallbackSleep : null;
    const appleAsleepHours = readHealthOptionalNumber((appleSleepToday || (appleSnapshotIsToday ? appleHealthSnapshot?.sleep : null))?.asleepHours);
    const appleInBedHours = readHealthOptionalNumber((appleSleepToday || (appleSnapshotIsToday ? appleHealthSnapshot?.sleep : null))?.inBedHours);
    const appleLatestSteps = readHealthOptionalNumber(appleFallbackActivity?.steps);
    const appleLatestActiveKcal = readHealthOptionalNumber(appleFallbackActivity?.activeEnergyKcal);
    const appleLatestDistanceMeters = readHealthOptionalNumber(appleFallbackActivity?.distanceMeters);
    const appleLatestRestingHeartRate = readHealthOptionalNumber(appleFallbackResting?.restingHeartRateBpm);
    const appleLatestAsleepHours = readHealthOptionalNumber(appleFallbackSleep?.asleepHours);
    const appleHasTodayStructuredData = !!(
        appleSteps != null
        || appleActiveKcal != null
        || appleDistanceMeters != null
        || appleRestingHeartRate != null
        || appleAsleepHours != null
        || appleInBedHours != null
        || appleHeartSamples.length
    );
    const appleHasAnyStructuredData = !!(
        appleHealthSnapshot
        && (
            readHealthOptionalNumber(appleHealthSnapshot?.steps) != null
            || readHealthOptionalNumber(appleHealthSnapshot?.activeEnergyKcal) != null
            || readHealthOptionalNumber(appleHealthSnapshot?.distanceMeters) != null
            || readHealthOptionalNumber(appleHealthSnapshot?.restingHeartRateBpm) != null
            || readHealthOptionalNumber(appleHealthSnapshot?.sleep?.asleepHours) != null
            || appleSnapshotHeartSamples.length
        )
    ) || !!(
        appleLatestSteps != null
        || appleLatestActiveKcal != null
        || appleLatestDistanceMeters != null
        || appleLatestRestingHeartRate != null
        || appleLatestAsleepHours != null
        || appleHistoryHeartSamples.length
    );
    const appleHealthNeedsTodaySync = appleHasAnyStructuredData && !appleHasTodayStructuredData && !appleSyncIsFresh;
    const appleLatestHeartSample = appleHeartSamples
        .map((sample) => {
            const bpm = readHealthOptionalNumber(sample?.bpm);
            const at = String(sample?.at || '').trim();
            const minute = parseTodayMinuteFromTimestamp(at, timelineMinuteOptions);
            if (bpm == null || minute === null) return null;
            return { bpm, at, minute };
        })
        .filter(Boolean)
        .sort((a, b) => a.minute - b.minute)
        .pop() || null;
    const appleHealthHasSnapshotData = appleHasAnyStructuredData;
    const appleSyncMinute = parseTodayMinuteFromTimestamp(appleHealthBundle?.updatedAt || appleHealthSnapshot?.fetchedAt || '', timelineMinuteOptions);
    const appleExplicitHealthWindow = appleHasTodayStructuredData && appleSnapshotIsToday
        ? deriveHealthWindowMinutes(appleHealthSnapshot?.windowStart || '', appleHealthSnapshot?.windowEnd || appleHealthBundle?.updatedAt || '', appleWindowHours, timelineMinuteOptions)
        : null;
    const appleHealthWindow = appleExplicitHealthWindow || (
        appleHasTodayStructuredData && appleSyncMinute !== null
            ? { start: 0, end: Math.max(1, Math.min(1440, appleSyncMinute)) }
            : null
    );
    if (appleHealthHasSnapshotData) {
        const appleEvidence = [];
        if (appleSteps != null) appleEvidence.push(`Apple 健康步数 ${Math.round(appleSteps)}`);
        else if (appleLatestSteps != null) appleEvidence.push(`最近步数 ${Math.round(appleLatestSteps)}${appleFallbackActivity?.date ? `（${appleFallbackActivity.date}）` : ''}`);
        if (appleActiveKcal != null) appleEvidence.push(`活动能量 ${Math.round(appleActiveKcal)} kcal`);
        else if (appleLatestActiveKcal != null) appleEvidence.push(`最近活动能量 ${Math.round(appleLatestActiveKcal)} kcal`);
        if (appleDistanceMeters != null) appleEvidence.push(`步行跑步距离 ${(appleDistanceMeters / 1000).toFixed(2)} km`);
        else if (appleLatestDistanceMeters != null) appleEvidence.push(`最近距离 ${(appleLatestDistanceMeters / 1000).toFixed(2)} km`);
        if (appleAsleepHours != null) appleEvidence.push(`实际睡眠约 ${appleAsleepHours.toFixed(1)} h`);
        else if (appleLatestAsleepHours != null) appleEvidence.push(`最近睡眠约 ${appleLatestAsleepHours.toFixed(1)} h`);
        if (appleRestingHeartRate != null) appleEvidence.push(`静息心率 ${Math.round(appleRestingHeartRate)} bpm`);
        else if (appleLatestRestingHeartRate != null) appleEvidence.push(`最近静息心率 ${Math.round(appleLatestRestingHeartRate)} bpm`);
        const appleStateParts = [];
        if (appleSteps != null) appleStateParts.push(`步数 ${Math.round(appleSteps)}`);
        if (appleAsleepHours != null) appleStateParts.push(`睡眠 ${appleAsleepHours.toFixed(1)} h`);
        if (appleRestingHeartRate != null) appleStateParts.push(`静息心率 ${Math.round(appleRestingHeartRate)} bpm`);
        const appleState = appleStateParts.length
            ? appleStateParts.join('，')
            : (appleHealthNeedsTodaySync
                ? `电脑端最近同步至 ${appleLastSyncLabel || '上一次手机同步'}，今天的 HealthKit 还没写入`
                : '已同步结构化健康摘要');
        pushSignal('body', 'apple-health', 'Apple 健康', appleState, appleEvidence, {
            confidence: appleHasTodayStructuredData ? 'high' : 'medium',
            hasStructuredData: true,
        });
        const appleWindowMinute = appleHealthWindow?.end ?? parseTodayMinuteFromTimestamp(appleHealthSnapshot?.windowEnd || appleHealthBundle?.updatedAt || '', timelineMinuteOptions);
        const appleActivityMinute = appleWindowMinute ?? (
            appleHasTodayStructuredData && (appleSteps != null || appleActiveKcal != null || appleDistanceMeters != null)
                ? nowMinute
                : null
        );
        if (appleSyncMinute !== null) pushTimelineEvent('Apple健康同步', appleSyncMinute, 'glucose');
        if ((appleSteps != null || appleActiveKcal != null || appleDistanceMeters != null) && appleActivityMinute !== null) {
            pushTimelineEvent('活动累计', appleActivityMinute, 'move');
        }
        if (appleLatestHeartSample) pushTimelineEvent('心率检查', appleLatestHeartSample.minute, 'body');
    }

    if (latestSleepClock || latestWakeClock || sleepSignals.length) {
        const sleepMinutes = parseClockToMinutes(latestSleepClock);
        const wakeMinutes = parseClockToMinutes(latestWakeClock);
        let durationMinutes = null;
        if (sleepMinutes !== null && wakeMinutes !== null) {
            durationMinutes = wakeMinutes >= sleepMinutes
                ? wakeMinutes - sleepMinutes
                : (24 * 60 - sleepMinutes + wakeMinutes);
        }
        let cycleHint = '';
        if (durationMinutes !== null && durationMinutes > 0) {
            const cycleRemainder = durationMinutes % 90;
            cycleHint = Math.min(cycleRemainder, 90 - cycleRemainder) <= 20
                ? '起床点大致贴近完整睡眠周期'
                : '起床点可能不在舒服的睡眠周期边界上';
        }
        const sleepState = latestSleepClock && latestWakeClock
            ? `${latestSleepClock} → ${latestWakeClock}${durationMinutes !== null ? `，约 ${Math.floor(durationMinutes / 60)}h${String(durationMinutes % 60).padStart(2, '0')}` : ''}`
            : '今天有睡眠相关线索，但还不够完整';
        pushSignal('body', 'sleep', '睡眠节律', sleepState, [
            cycleHint,
            sleepSignals.length ? '今天的身体状态里能看到睡眠/熬夜相关影响' : '',
            (latestSleepClock && parseClockToMinutes(latestSleepClock) !== null && parseClockToMinutes(latestSleepClock) >= 60) ? '入睡时间偏晚，节律可能还在往后漂' : '',
        ]);
    }

    if (symptomSignals.length || foodSignals.length || movementSignals.length) {
        let bodyState = '今天身体状态更多由基础节律牵动';
        if (symptomSignals.length) bodyState = '身体有明显消耗或不适信号，今天不适合硬推自己';
        else if (foodSignals.length && movementSignals.length) bodyState = '饮食与活动都在影响今天的身体感受';
        else if (foodSignals.length) bodyState = '今天身体状态和进食/餐后反应关系更紧';
        else if (movementSignals.length) bodyState = '今天身体状态和活动量、久坐情况关系更紧';
        pushSignal('body', 'body-load', '身体负荷', bodyState, [
            symptomSignals.length ? '今天出现了身体不适或明显消耗线索' : '',
            foodSignals.length ? '今天的饮食/餐后反应也在影响身体感受' : '',
            movementSignals.length ? '活动量和久坐情况会直接牵动今天的恢复感' : '',
        ]);
    }

    const uniqueRecentLateNightWorkEvidence = uniqueHealthClues(recentLateNightWorkEvidence, 2);
    const hasRecentLateNightWorkEvidence = uniqueRecentLateNightWorkEvidence.length > 0;
    const shouldMarkStillWorkingLateNight = shouldFlagLateNight() && (hasLateNightWorkload() || hasRecentLateNightWorkEvidence);
    const continuousLateNightWorkMinutes = computeContinuousHealthWorkMinutes(lateNightWorkTimestamps, now.getTime(), 95);

    if (shouldFlagLateNight()) {
        const reminderText = shouldMarkStillWorkingLateNight
            ? (resolvedHour < 4
                ? '现在已进入凌晨时段，而且你还在持续处理事情，恢复窗口会继续被挤占'
                : '现在已经进入深夜时段，且仍在处理事项，今天要优先计算熬夜成本')
            : (resolvedHour < 4
                ? '现在已进入凌晨时段，建议尽快收口，让身体拿回恢复窗口'
                : '现在已经进入深夜时段，建议尽量减少新任务输入');
        pushSignal('body', 'late-night', '深夜提醒', reminderText, [
            shouldMarkStillWorkingLateNight ? '如果继续处理事情，恢复窗口会被继续占用' : '这个时段优先止损，会比继续推进更划算',
            hasRecentLateNightWorkEvidence ? `最近仍有处理痕迹：${uniqueRecentLateNightWorkEvidence[0]}` : '',
        ], { confidence: shouldMarkStillWorkingLateNight ? 'high' : 'medium' });
    }

    if (peopleSignals.length || socialSignals.length) {
        const socialState = peopleSignals.length
            ? '今天并不是完全独处，你和外界是有接触的'
            : '今天有人际/社交张力线索，但更像压力而非陪伴';
        pushSignal('others', 'contact', '与外界接触', socialState, [
            peopleSignals.length ? '今天能看到真实的人际接触线索，而不只是提到别人' : '',
            socialSignals.length ? '这些接触里还带着关系感受或责任牵引' : '',
        ]);
    } else {
        pushSignal('others', 'contact', '与外界接触', '今天更像主要在和任务、身体、自己相处', [
            '暂时没有抓到清晰的家人/朋友/社交接触线索',
        ]);
    }

    if (socialSignals.length) {
        const pressureLike = socialSignals.some((item) => /冲突|压力|期待|人情/.test(item));
        pushSignal('others', 'relationship-tone', '关系里的感受', pressureLike ? '今天的人际线索更偏责任、压力或牵挂' : '今天的人际线索更偏支持、陪伴或照料', [
            pressureLike ? '关系感受里能看到责任、牵挂或被期待的成分' : '关系感受里更像支持、靠近或陪伴',
            peopleSignals.length ? '这种关系线索不是抽象想象，更像今天真实发生过的互动' : '',
        ]);
    }

    let selfState = '今天和自己的关系还看不清，像是在直接处理事情';
    if (mentalScores.tense > 0 && mentalScores.reflective > 0) selfState = '你一边在绷着自己往前走，一边也在试图看清自己当下的状态';
    else if (mentalScores.orderly > 0 && mentalScores.reflective > 0) selfState = '你还在主动整理自己，说明你和自己并没有断开';
    else if (mentalScores.drained > 0) selfState = '今天自我关系里有明显的疲惫和消耗感';
    pushSignal('self', 'mindset', '心态底色', selfState, [
        mentalScores.tense > 0 ? '语言里有明显的紧绷、控制或压力感' : '',
        mentalScores.reflective > 0 ? '同时又能看到你在理解、命名和观察自己' : '',
        mentalScores.soft > 0 ? '你也在努力给自己留一点缓冲和温和' : '',
    ]);

    const topicEntries = [
        ['健康与身体', topicScores.glucose + topicScores.sleep + topicScores.food],
        ['项目推进', topicScores.project],
        ['节律稳定', topicScores.rhythm + topicScores.sleep],
        ['人与关系', topicScores.relation],
    ].filter((item) => item[1] > 0).sort((a, b) => b[1] - a[1]);
    if (topicEntries.length) {
        const focusState = topicEntries.length > 1
            ? `你现在更在意 ${topicEntries[0][0]}，同时也在牵挂 ${topicEntries[1][0]}`
            : `你现在最在意的是 ${topicEntries[0][0]}`;
        pushSignal('self', 'focus', '当前焦点与欲望', focusState, [
            topicScores.glucose + topicScores.sleep >= 2 ? '今天身体、节律、代谢相关内容的牵引力比较强' : '',
            topicScores.project >= 2 ? '任务推进和完成感也一直在拉扯你的注意力' : '',
        ]);
    }

    const wroteLog = selfSignals.length > 0 || todayAiDailyLogs.length > 0;
    pushSignal('self', 'self-contact', '与自己相处', wroteLog
        ? '今天仍然有记录、整理或反思行为，说明你还在和自己保持对话'
        : '今天更像一直在应付事情，自我对话线索偏少', [
        wroteLog ? '今天仍然能看到记录、复盘、整理或写日志的痕迹' : '',
        moodSignals.length ? '你也有在试图记录自己的感受，而不只是记录任务' : '',
    ]);

    let taskAttitude = '今天对事情的态度还不够明显';
    if (attitudeScores.push > 0 && attitudeScores.protect > 0) taskAttitude = '你想把事情继续往前推，但也在明显地给自己加护栏';
    else if (attitudeScores.push > 0) taskAttitude = '你对事情有明显推进欲，不太像完全收缩';
    else if (attitudeScores.postpone > 0 || attitudeScores.protect > 0) taskAttitude = '你对事情更偏保守处理，像是在先保护状态';
    pushSignal('self', 'task-attitude', '对事情的态度', taskAttitude, [
        attitudeScores.push > 0 ? '能看出你还是想往前推进，而不是完全放掉' : '',
        attitudeScores.protect > 0 ? '同时又在给自己设护栏，避免把状态继续压垮' : '',
        attitudeScores.postpone > 0 ? '你也会主动把部分事情往后放，而不是一股脑硬扛' : '',
    ]);

    Object.keys(grouped).forEach((key) => {
        grouped[key] = grouped[key]
            .map((item) => ({
                ...item,
                evidence: uniqueHealthClues(item.evidence, 3),
            }))
            .filter((item) => item.state || item.evidence.length);
    });

    const effectiveSignals = [];
    if (liveReading && todayGlucoseSeries.length >= 6) {
        effectiveSignals.push({
            label: liveReading.isLow ? '代谢偏低' : liveReading.isHigh ? '代谢偏高' : '血糖平稳',
            tone: liveReading.isLow || liveReading.isHigh ? 'warn' : 'steady',
        });
    }
    if (appleHealthHasSnapshotData) {
        effectiveSignals.push({
            label: appleHealthNeedsTodaySync ? 'Apple 健康待今日同步' : 'Apple 健康已同步',
            tone: appleHealthNeedsTodaySync ? 'info' : 'steady',
        });
    }
    if (latestSleepClock || latestWakeClock || sleepSignals.length) {
        effectiveSignals.push({
            label: latestSleepClock && latestWakeClock ? '有睡眠节律线索' : '睡眠线索不足',
            tone: latestSleepClock && latestWakeClock ? 'info' : 'muted',
        });
    }
    if (symptomSignals.length) effectiveSignals.push({ label: '有身体负荷信号', tone: 'warn' });
    if (peopleSignals.length) effectiveSignals.push({ label: '今天有外界接触', tone: 'info' });
    if (wroteLog) effectiveSignals.push({ label: '今天有记录行为', tone: 'steady' });
    if (shouldMarkStillWorkingLateNight) effectiveSignals.push({ label: '仍在熬夜处理事情', tone: 'warn' }); else if (shouldFlagLateNight()) effectiveSignals.push({ label: resolvedHour < 4 ? '已进入凌晨时段' : '已进入深夜时段', tone: 'info' });

    const clampForce = (value, min = 8) => Math.min(100, Math.max(min, Math.round(Number(value) || 0)));
    const socialWeight = peopleSignals.length * 24 + socialSignals.length * 12;
    const journalingWeight = selfSignals.length * 18 + moodSignals.length * 12 + (wroteLog ? 12 : 0);
    const lateNightPenalty = shouldMarkStillWorkingLateNight ? 16 : (shouldFlagLateNight() ? 8 : 0);
    const forcePairs = [
        {
            label: '行动',
            value: clampForce(attitudeScores.push * 24 + topicScores.project * 12 + mentalScores.orderly * 8),
            mirrorLabel: '回避',
            mirrorValue: clampForce(attitudeScores.postpone * 22 + mentalScores.drained * 12 + (attitudeScores.push === 0 ? 14 : 0)),
        },
        {
            label: '连接',
            value: clampForce(socialWeight + (peopleSignals.length ? 8 : 0)),
            mirrorLabel: '独处',
            mirrorValue: clampForce((peopleSignals.length ? 8 : 34) + (socialSignals.length ? 0 : 10) + ((selfSignals.length || todayAiDailyLogs.length) ? 10 : 0)),
        },
        {
            label: '控制',
            value: clampForce(mentalScores.tense * 18 + mentalScores.orderly * 16 + attitudeScores.push * 8),
            mirrorLabel: '接受',
            mirrorValue: clampForce(mentalScores.reflective * 18 + mentalScores.soft * 16 + attitudeScores.protect * 10),
        },
        {
            label: '推进',
            value: clampForce(attitudeScores.push * 20 + topicScores.project * 14 + topicScores.rhythm * 5),
            mirrorLabel: '恢复',
            mirrorValue: clampForce(attitudeScores.protect * 20 + mentalScores.drained * 14 + topicScores.sleep * 10 + symptomSignals.length * 8),
        },
        {
            label: '表达',
            value: clampForce(journalingWeight + socialSignals.length * 6),
            mirrorLabel: '压抑',
            mirrorValue: clampForce(mentalScores.tense * 16 + (wroteLog ? 4 : 18) + (moodSignals.length ? 0 : 12)),
        },
        {
            label: '自爱',
            value: clampForce(mentalScores.soft * 20 + mentalScores.reflective * 14 + attitudeScores.protect * 12 + (wroteLog ? 8 : 0)),
            mirrorLabel: '自责',
            mirrorValue: clampForce(mentalScores.tense * 18 + attitudeScores.push * 8 + lateNightPenalty + symptomSignals.length * 8),
        },
    ];

    const rhythmSegments = [];
    const pushRhythmSegment = (label, start, end, tone = 'neutral') => {
        if (start === null || end === null) return;
        if (!Number.isFinite(start) || !Number.isFinite(end)) return;
        const safeStart = Math.max(0, Math.min(1439, Math.round(start)));
        const safeEnd = Math.max(0, Math.min(1440, Math.round(end)));
        if (safeEnd <= safeStart) return;
        rhythmSegments.push({
            label,
            start: safeStart,
            end: safeEnd,
            tone,
        });
    };
    const sleepStart = parseClockToMinutes(rhythmSleepClock);
    const sleepEnd = parseClockToMinutes(rhythmWakeClock);
    if (sleepStart !== null && sleepEnd !== null) {
        if (sleepEnd >= sleepStart) pushRhythmSegment('睡眠', sleepStart, sleepEnd, 'sleep'); else {
            pushRhythmSegment('睡眠', sleepStart, 1440, 'sleep');
            pushRhythmSegment('睡眠', 0, sleepEnd, 'sleep');
        }
    }
    if (appleHealthWindow) {
        pushRhythmSegment('健康覆盖', appleHealthWindow.start, appleHealthWindow.end, 'health-data');
    }
    if (todayGlucoseSeries.length >= 2) {
        const sortedSeries = todayGlucoseSeries.slice().sort((a, b) => a.minute - b.minute);
        pushRhythmSegment('监测窗口', sortedSeries[0].minute, sortedSeries[sortedSeries.length - 1].minute, 'glucose');
    }
    if (shouldFlagLateNight()) {
        const lateNightSegmentLabel = shouldMarkStillWorkingLateNight
            ? (resolvedHour < 4 ? '凌晨持续负荷' : '深夜持续负荷')
            : (resolvedHour < 4 ? '凌晨负荷' : '深夜负荷');
        const lateNightSegmentTone = shouldMarkStillWorkingLateNight ? 'strain-strong' : 'strain';
        if (resolvedHour >= 22) pushRhythmSegment(lateNightSegmentLabel, 22 * 60, nowMinute, lateNightSegmentTone); else if (resolvedHour < 4) {
            // Timeline is "today", so early morning only renders today's segment.
            pushRhythmSegment(lateNightSegmentLabel, 0, nowMinute, lateNightSegmentTone);
        }
    }
    const rhythmTags = [];
    const pushRhythmTag = (label) => {
        const clean = String(label || '').trim();
        if (!clean || rhythmTags.includes(clean)) return;
        rhythmTags.push(clean);
    };
    if (sleepStart !== null && sleepStart >= 60) pushRhythmTag('晚睡');
    if (sleepStart !== null && sleepEnd !== null) {
        const duration = sleepEnd >= sleepStart ? sleepEnd - sleepStart : (1440 - sleepStart + sleepEnd);
        if (duration < 7 * 60) pushRhythmTag('恢复不足');
    }
    if (rhythmFoodSignals.length) pushRhythmTag('进食牵引');
    if (rhythmMovementSignals.length) pushRhythmTag('活动切换');
    if (appleSteps != null || appleActiveKcal != null || appleDistanceMeters != null) pushRhythmTag('活动数据');
    if (appleAsleepHours != null || appleInBedHours != null) pushRhythmTag('睡眠数据');
    if (appleHealthNeedsTodaySync) pushRhythmTag('等待健康同步');
    if (rhythmSymptomSignals.length) pushRhythmTag('身体负荷');
    if (shouldFlagLateNight()) pushRhythmTag('深夜仍在处理');
    if (liveReading?.isLow || liveReading?.isHigh) pushRhythmTag('代谢波动');

    let rhythmSummary = '今天的节律线索还不够完整，先把睡眠、进食、活动和不适多记一点，会更容易看清整天怎么被牵动。';
    if (shouldFlagLateNight() && sleepStart !== null && sleepStart >= 60) rhythmSummary = '今天的节律更像被晚睡和持续处理事情往后拖，恢复窗口被明显压缩了。'; else if (rhythmSymptomSignals.length && rhythmFoodSignals.length) rhythmSummary = '今天的节律主要被身体不适和进食反应牵着走，身体感受比任务推进更该优先看。'; else if (sleepStart !== null && sleepEnd !== null) {
        rhythmSummary = '今天的节律主轴还是睡眠窗口和起床后的恢复过程，后面的波动基本都在围着这条线展开。';
    } else if (rhythmMovementSignals.length && rhythmFoodSignals.length) {
        rhythmSummary = '今天的节律更多是进食和活动切换在拉扯，状态起伏不像完全随机。';
    } else if (peopleSignals.length && socialSignals.length) {
        rhythmSummary = '今天除了身体线索，还有外界接触和关系牵引一起参与了你的节律变化。';
    } else if (appleHealthNeedsTodaySync) {
        rhythmSummary = `电脑端已经有 Apple 健康历史数据，但今天的 HealthKit 还没有写入 sync root，最近一次同步是 ${appleLastSyncLabel || '上一次手机同步'}。`;
    }

    const rhythmEvents = timelineEvents
        .sort((a, b) => a.minute - b.minute);
    const nowEventTimeParts = [formatHealthTimelineClock(nowMinute)];
    if (shouldMarkStillWorkingLateNight && continuousLateNightWorkMinutes >= 20) nowEventTimeParts.push(`连续处理 ${formatHealthDurationShort(continuousLateNightWorkMinutes)}`);
    rhythmEvents.push({
        label: '现在',
        minute: nowMinute,
        time: nowEventTimeParts.join(' · '),
        tone: shouldMarkStillWorkingLateNight ? 'now-strain' : 'now',
    });
    const uniqueRhythmEvents = [];
    const uniqueRhythmSeen = new Set();
    rhythmEvents
        .sort((a, b) => a.minute - b.minute)
        .forEach((item) => {
            const key = `${item.label}:${item.minute}`;
            if (uniqueRhythmSeen.has(key)) return;
            uniqueRhythmSeen.add(key);
            uniqueRhythmEvents.push(item);
        });
    const clusteredRhythmEvents = [];
    const rhythmEventClusters = [];
    uniqueRhythmEvents.forEach((item) => {
        const currentCluster = rhythmEventClusters[rhythmEventClusters.length - 1];
        if (!currentCluster || item.minute - currentCluster[currentCluster.length - 1].minute > 110) {
            rhythmEventClusters.push([item]);
            return;
        }
        currentCluster.push(item);
    });
    rhythmEventClusters.forEach((cluster) => {
        const centerIndex = (cluster.length - 1) / 2;
        cluster.forEach((item, idx) => {
            const lane = idx % 2 === 0 ? 'top' : 'bottom';
            let cardShift = (idx - centerIndex) * 34;
            const minutePercent = Math.max(0, Math.min(100, (Number(item.minute) || 0) / 1440 * 100));
            if (minutePercent < 12) cardShift = Math.max(0, cardShift);
            if (minutePercent > 88) cardShift = Math.min(0, cardShift);
            clusteredRhythmEvents.push({
                ...item,
                lane,
                cardShift,
            });
        });
    });
    const rhythmStatePeriods = [];
    const pushRhythmStatePeriod = (start, end, label, detail = '', tone = 'neutral') => {
        if (!label || !Number.isFinite(Number(start)) || !Number.isFinite(Number(end))) return;
        const safeStart = Math.max(0, Math.min(1439, Math.round(Number(start))));
        const safeEnd = Math.max(1, Math.min(1440, Math.round(Number(end))));
        if (safeEnd - safeStart < 20) return;
        rhythmStatePeriods.push({
            start: safeStart,
            end: safeEnd,
            label: String(label || '').trim(),
            detail: String(detail || '').trim(),
            tone,
        });
    };
    const summarizeRhythmStateCluster = (cluster = []) => {
        const has = (key) => cluster.some((item) => item?.tags?.[key]);
        const inLateNight = cluster.some((item) => Number(item?.minute) >= 22 * 60);
        if (shouldMarkStillWorkingLateNight && inLateNight) return { label: '深夜仍在处理', tone: 'strain' };
        if (has('sleep') && has('work')) return { label: '困倦中推进', tone: 'strain' };
        if (has('body') && has('food')) return { label: '进食牵引身体', tone: 'body' };
        if (has('body') || has('sleep')) return { label: '身体负荷偏高', tone: 'body' };
        if (has('food')) return { label: '进食牵引', tone: 'meal' };
        if (has('move')) return { label: '活动切换', tone: 'move' };
        if (has('work')) return { label: inLateNight ? '深夜处理事情' : '事务推进', tone: inLateNight ? 'strain' : 'focus' };
        if (has('mood')) return { label: '情绪压力', tone: 'body' };
        if (has('self')) return { label: '记录与整理', tone: 'self' };
        return { label: '有记录线索', tone: 'neutral' };
    };
    const sortedStateClues = rhythmStateClues
        .slice()
        .sort((a, b) => a.minute - b.minute);
    const firstStateMinute = sortedStateClues.length ? sortedStateClues[0].minute : null;
    if (firstStateMinute !== null && firstStateMinute >= 180) {
        pushRhythmStatePeriod(0, Math.max(30, firstStateMinute - 15), '主观记录少', '这段暂未形成明确状态线索', 'muted');
    }
    const stateClusters = [];
    sortedStateClues.forEach((clue) => {
        const current = stateClusters[stateClusters.length - 1];
        if (!current || clue.minute - current[current.length - 1].minute > 210) {
            stateClusters.push([clue]);
            return;
        }
        current.push(clue);
    });
    stateClusters.forEach((cluster, index) => {
        const nextCluster = stateClusters[index + 1] || null;
        const summary = summarizeRhythmStateCluster(cluster);
        const clusterStart = Math.max(0, cluster[0].minute - 30);
        const clusterLast = cluster[cluster.length - 1].minute;
        const naturalEnd = nextCluster
            ? Math.max(clusterStart + 45, nextCluster[0].minute - 20)
            : Math.min(nowMinute, Math.max(clusterLast + 120, clusterStart + 80));
        const detailBits = [
            `${formatHealthTimelineClock(cluster[0].minute)} 起`,
            cluster.length > 1 ? `${cluster.length} 条线索` : '',
        ].filter(Boolean);
        pushRhythmStatePeriod(clusterStart, naturalEnd, summary.label, detailBits.join(' · '), summary.tone);
    });
    if (shouldFlagLateNight() && nowMinute > 22 * 60) {
        const hasLateNightPeriod = rhythmStatePeriods.some((item) => item.end > 22 * 60 && /深夜/.test(item.label));
        if (!hasLateNightPeriod) {
            pushRhythmStatePeriod(22 * 60, nowMinute, shouldMarkStillWorkingLateNight ? '深夜仍在处理' : '深夜恢复窗口', shouldMarkStillWorkingLateNight ? '恢复窗口被压缩' : '建议减少新输入', shouldMarkStillWorkingLateNight ? 'strain' : 'body');
        }
    }
    const compactRhythmStatePeriods = rhythmStatePeriods
        .sort((a, b) => a.start - b.start)
        .filter((item, index, list) => {
            const prev = list[index - 1];
            return !(prev && prev.label === item.label && item.start - prev.start < 60);
        })
        .slice(0, 5);

    return {
        grouped,
        meta: {
            effectiveSignals: effectiveSignals.slice(0, 6),
            forcePairs,
            rhythmSummary,
            rhythmTags: rhythmTags.slice(0, 4),
            rhythmSegments,
            rhythmStatePeriods: compactRhythmStatePeriods,
            rhythmEvents: clusteredRhythmEvents,
            lateNight: shouldFlagLateNight(),
            continuousLateNightWorkMinutes,
            stillWorkingLateNight: shouldMarkStillWorkingLateNight,
            dataCoverage: {
                textSources: sourceTexts.length,
                timelineTextSources: timelineSourceTexts.length,
                scheduleRhythmSources: scheduleTimelineEventCount,
                glucoseSynced: !!(liveReading || todayGlucoseSeries.length),
                appleHealthEnabled,
                appleHealthSynced: appleHealthHasSnapshotData,
                appleHealthSyncedToday: appleHasTodayStructuredData,
                appleHealthNeedsTodaySync,
                appleHealthLastSyncedAt: appleLastSyncAt,
                appleHealthLastSyncedLabel: appleLastSyncLabel,
                appleHealthCoverageStart: appleHealthWindow ? formatHealthTimelineClock(appleHealthWindow.start) : '',
                appleHealthCoverageEnd: appleHealthWindow ? formatHealthTimelineClock(appleHealthWindow.end) : '',
                appleHealthHistoryDays: Array.isArray(appleHealthHistory?.activityDaily) ? appleHealthHistory.activityDaily.length : 0,
            },
        },
    };
}

function buildHealthCanvasMarkup({ standalone = false } = {}) {
    const { grouped, meta } = buildHealthRelationshipFieldModel();
    const signalWavePath = (tone = 'muted') => {
        if (tone === 'steady') return 'M2 12 C8 12, 10 12, 14 12 S22 12, 28 12 S36 12, 42 12 S50 12, 56 12';
        if (tone === 'warn') return 'M2 12 C8 12, 10 18, 15 18 S23 5, 29 5 S37 17, 42 17 S50 10, 56 10';
        if (tone === 'info') return 'M2 12 C7 12, 10 8, 14 8 S21 16, 28 16 S36 7, 42 7 S49 13, 56 13';
        return 'M2 12 C10 12, 14 13, 20 13 S30 11, 36 11 S46 13, 56 13';
    };
    const signalToneLabel = (tone = 'muted') => {
        if (tone === 'steady') return '稳定信号';
        if (tone === 'warn') return '偏强信号';
        if (tone === 'info') return '弱关联信号';
        return '背景信号';
    };
    const confidenceLabelText = (confidence = '', fallback = '') => {
        const normalized = String(confidence || '').trim().toLowerCase();
        if (normalized === 'high') return '置信高';
        if (normalized === 'medium') return '置信中';
        if (normalized === 'low') return '置信低';
        const cleanFallback = String(fallback || '').trim();
        return cleanFallback ? `置信${cleanFallback}` : '置信中';
    };
    const signalsHtml = meta.effectiveSignals.length
        ? meta.effectiveSignals.map((signal) => `
            <div class="health-signal-card">
                <div class="health-signal-wavebox">
                    <svg viewBox="0 0 58 24" class="health-signal-wave ${escapeHTML(signal.tone || 'muted')}" aria-hidden="true">
                        <path d="${signalWavePath(signal.tone || 'muted')}"></path>
                    </svg>
                </div>
                <div class="health-signal-copy">
                    <div class="health-signal-label">${escapeHTML(signal.label)}</div>
                    <div class="health-signal-meta">${signalToneLabel(signal.tone || 'muted')}</div>
                </div>
            </div>
        `).join('')
        : `<div class="text-[12px] text-gray-500 dark:text-white/45">今天还没有足够成形的有效信号。</div>`;

    const minuteToPercent = (minute) => Math.max(0, Math.min(100, (Number(minute) || 0) / 1440 * 100));
    const rhythmTicks = [0, 6 * 60, 12 * 60, 18 * 60, 24 * 60].map((minute) => ({
        label: minute >= 1440 ? '24:00' : formatHealthTimelineClock(minute),
        left: minute >= 1440 ? 100 : minuteToPercent(minute),
    }));
    const rhythmTagsHtml = Array.isArray(meta.rhythmTags) && meta.rhythmTags.length
        ? `<div class="health-rhythm-tags">${meta.rhythmTags.map((tag) => `<span class="health-rhythm-tag">${escapeHTML(tag)}</span>`).join('')}</div>`
        : '';
    const coverage = meta?.dataCoverage && typeof meta.dataCoverage === 'object' ? meta.dataCoverage : {};
    const appleHealthCoverageLabel = coverage.appleHealthEnabled
        ? (coverage.appleHealthNeedsTodaySync
            ? `Apple健康待今日同步${coverage.appleHealthLastSyncedLabel ? ` ${coverage.appleHealthLastSyncedLabel}` : ''}`
            : (coverage.appleHealthSynced ? 'Apple健康已同步' : 'Apple健康未同步'))
        : '';
    const coverageBits = [
        Number.isFinite(Number(coverage.timelineTextSources)) ? `文本 ${Number(coverage.timelineTextSources)}` : '',
        Number.isFinite(Number(coverage.scheduleRhythmSources)) && Number(coverage.scheduleRhythmSources) > 0 ? `节律 ${Number(coverage.scheduleRhythmSources)}` : '',
        coverage.glucoseSynced ? '血糖已同步' : '',
        appleHealthCoverageLabel,
    ].filter(Boolean);
    const coverageHtml = coverageBits.length
        ? `<div class="mt-2 text-[10px] font-mono text-gray-500 dark:text-white/45">${coverageBits.map((item) => escapeHTML(item)).join(' · ')}</div>`
        : '';
    const timelineHtml = Array.isArray(meta.rhythmEvents) && meta.rhythmEvents.length
        ? `
            <div class="health-rhythm-wrap">
                ${rhythmTagsHtml}
                <div class="health-rhythm-stage">
                    <div class="health-rhythm-axis"></div>
                    ${Array.isArray(meta.rhythmSegments) ? meta.rhythmSegments.map((segment) => `
                        <div class="health-rhythm-segment tone-${escapeHTML(segment.tone || 'neutral')}" style="left:${minuteToPercent(segment.start)}%; width:${Math.max(1.2, minuteToPercent(segment.end) - minuteToPercent(segment.start))}%;">
                            ${String(segment.label || '').trim() ? `<span>${escapeHTML(segment.label)}</span>` : ''}
                        </div>
                    `).join('') : ''}
                    ${Array.isArray(meta.rhythmStatePeriods) ? meta.rhythmStatePeriods.map((period) => {
                        const startPercent = minuteToPercent(period.start);
                        const endPercent = minuteToPercent(period.end);
                        const anchoredRight = endPercent > 88;
                        const style = anchoredRight
                            ? `right:${Math.max(0, 100 - endPercent)}%;`
                            : `left:${startPercent}%;`;
                        return `
                            <div class="health-rhythm-period tone-${escapeHTML(period.tone || 'neutral')}" style="${style}">
                                <div class="health-rhythm-period-label">${escapeHTML(period.label)}</div>
                                ${period.detail ? `<div class="health-rhythm-period-detail">${escapeHTML(period.detail)}</div>` : ''}
                            </div>
                        `;
                    }).join('') : ''}
                    ${meta.rhythmEvents.map((event) => `
                        <div class="health-rhythm-event is-${escapeHTML(event.lane || 'top')} tone-${escapeHTML(event.tone || 'neutral')}" style="left:${minuteToPercent(event.minute)}%; --health-rhythm-card-shift:${Number(event.cardShift) || 0}px;">
                            <div class="health-rhythm-event-card">
                                <div class="health-rhythm-event-label">${escapeHTML(event.label)}</div>
                                <div class="health-rhythm-event-time">${escapeHTML(event.time)}</div>
                            </div>
                            <div class="health-rhythm-event-stem"></div>
                            <div class="health-rhythm-event-dot"></div>
                        </div>
                    `).join('')}
                </div>
                <div class="health-rhythm-ticks">
                    ${rhythmTicks.map((tick) => `
                        <div class="health-rhythm-tick" style="left:${tick.left}%;">
                            <span>${escapeHTML(tick.label)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `
        : `<div class="text-[12px] text-gray-500 dark:text-white/45">今天的时间线线索还不够完整。</div>`;

    const forceHtml = `
        <div class="health-force-panel">
            <div class="health-force-grid">
                ${meta.forcePairs.map((pair) => {
                    const dominant = pair.value >= pair.mirrorValue;
                    const dominantValue = dominant ? pair.value : pair.mirrorValue;
                    const indicatorBottom = Math.min(88, Math.max(10, dominantValue));
                    const indicatorTone = dominantValue >= 72 ? 'danger' : (dominant ? 'primary' : 'secondary');
                    return `
                        <div class="health-force-pair">
                            <div class="health-force-pair-label">${escapeHTML(pair.label)}</div>
                            <div class="health-force-track">
                                ${Array.from({ length: 6 }).map(() => `<span class="health-force-slot"></span>`).join('')}
                                <div class="health-force-indicator ${indicatorTone}" style="bottom:${indicatorBottom}%"></div>
                            </div>
                            <div class="health-force-pair-label">${escapeHTML(pair.mirrorLabel)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    const explainSections = [
        { key: 'body', title: '身体相关判断' },
        { key: 'others', title: '与外界相关判断' },
        { key: 'self', title: '与自己相关判断' },
    ].map((section) => {
        const items = Array.isArray(grouped?.[section.key]) ? grouped[section.key] : [];
        if (!items.length) return '';
        return `
            <div class="space-y-2">
                <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">${escapeHTML(section.title)}</div>
                ${items.map((item) => `
                    <div class="rounded-[0.95rem] border border-gray-200 dark:border-white/10 px-3 py-2.5">
                        <div class="flex items-center justify-between gap-2">
                            <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">${escapeHTML(item.title)}</div>
                            <span class="health-confidence-pill tone-${escapeHTML(item.confidence || 'medium')}">${escapeHTML(confidenceLabelText(item.confidence, item.confidenceLabel))}</span>
                        </div>
                        <div class="mt-1 text-[13px] leading-6 text-gray-800 dark:text-white/90">${escapeHTML(item.state)}</div>
                        ${item.evidence.length ? `<div class="mt-2 space-y-1">${item.evidence.map((sample) => `<div class="text-[11px] leading-5 text-gray-500 dark:text-white/50">• ${escapeHTML(sample)}</div>`).join('')}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }).filter(Boolean).join('');

    return `
        <div class="grid grid-cols-1 gap-3">
            <div class="health-canvas-panel px-4 py-4">
                <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">今天的身体时间线</div>
                ${coverageHtml}
                <div class="mt-3">${timelineHtml}</div>
            </div>
            <div class="health-canvas-secondary-grid grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="health-canvas-panel px-4 py-4">
                    <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">今天的有效信号</div>
                    <div class="mt-3 grid grid-cols-1 gap-2">${signalsHtml}</div>
                </div>
                <div class="health-canvas-panel health-force-card px-4 py-4">
                    <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">今天的状态图谱</div>
                    <div class="mt-3 health-force-card-body">${forceHtml}</div>
                </div>
            </div>
        </div>

        <details open class="health-canvas-explain health-canvas-panel mt-3 px-4 py-4 group">
            <summary class="list-none cursor-pointer flex items-center justify-between text-[10px] font-mono text-gray-500 dark:text-white/45">
                <span>AI 为什么这么看</span>
                <span class="text-gray-500 dark:text-white/45 group-open:rotate-180 transition-transform">⌄</span>
            </summary>
            <div class="mt-3 grid grid-cols-1 gap-3">${explainSections}</div>
        </details>
    `;
}

function getHealthCanvasWorkspaceMarkup() {
    return buildHealthCanvasMarkup({ standalone: true });
}

function buildHealthStateAIReadablePromptContext(question = '') {
    const model = buildHealthRelationshipFieldModel();
    const grouped = model?.grouped && typeof model.grouped === 'object' ? model.grouped : {};
    const meta = model?.meta && typeof model.meta === 'object' ? model.meta : {};
    const signalLines = [];
    [
        ['body', '身体'],
        ['others', '外界'],
        ['self', '自我'],
    ].forEach(([key, label]) => {
        (Array.isArray(grouped[key]) ? grouped[key] : []).slice(0, 3).forEach((item) => {
            const title = String(item?.title || '').trim();
            const state = String(item?.state || '').trim();
            const evidence = Array.isArray(item?.evidence) ? item.evidence.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 2) : [];
            if (!title && !state && !evidence.length) return;
            signalLines.push(`- ${label}/${title || '状态'}: ${state || '未形成明确结论'}${evidence.length ? `；证据=${evidence.join(' / ')}` : ''}`);
        });
    });
    const eventLines = (Array.isArray(meta.rhythmEvents) ? meta.rhythmEvents : [])
        .filter((event) => String(event?.label || '').trim() !== '现在')
        .slice(0, 8)
        .map((event) => `- ${String(event.time || '').trim() || '--:--'} ${String(event.label || '').trim()}（${String(event.tone || 'derived').trim()}）`);
    const periodLines = (Array.isArray(meta.rhythmStatePeriods) ? meta.rhythmStatePeriods : [])
        .slice(0, 5)
        .map((period) => `- ${formatHealthTimelineClock(period.start)}-${formatHealthTimelineClock(period.end)} ${String(period.label || '').trim()}${period.detail ? `（${String(period.detail || '').trim()}）` : ''}`);
    const tagLine = Array.isArray(meta.rhythmTags) && meta.rhythmTags.length ? `节律标签: ${meta.rhythmTags.join('、')}` : '';
    const effectiveLine = Array.isArray(meta.effectiveSignals) && meta.effectiveSignals.length
        ? `有效信号: ${meta.effectiveSignals.map((item) => String(item?.label || '').trim()).filter(Boolean).join('、')}`
        : '';
    const coverage = meta?.dataCoverage && typeof meta.dataCoverage === 'object' ? meta.dataCoverage : {};
    const appleHealthPromptCoverage = coverage.appleHealthEnabled
        ? (coverage.appleHealthNeedsTodaySync
            ? `Apple 健康有历史数据但今天尚未同步${coverage.appleHealthLastSyncedLabel ? `（最近 ${coverage.appleHealthLastSyncedLabel}）` : ''}`
            : (coverage.appleHealthSynced ? 'Apple 健康已同步' : 'Apple 健康已启用但未同步到根数据'))
        : '';
    const coverageLine = [
        Number.isFinite(Number(coverage.timelineTextSources)) ? `今日/当前周期文本线索 ${Number(coverage.timelineTextSources)} 条` : '',
        coverage.glucoseSynced ? '血糖已同步' : '血糖未同步或当前不可用',
        appleHealthPromptCoverage,
    ].filter(Boolean).join('；');
    return [
        '健康状态上下文（来自 Morpheus 今天/当前睡眠周期的日志、对话、闪念、定念、项目线索、血糖同步数据和 Apple 健康摘要）:',
        '注意: 下列内容是可解释的状态线索，不是医学诊断；“时间线事件”只代表记录或派生标记，回答时必须区分事实、用户纠正和推测。',
        String(question || '').trim() ? `用户当前问题: ${String(question || '').trim().slice(0, 120)}` : '',
        coverageLine ? `数据覆盖: ${coverageLine}` : '',
        meta.rhythmSummary ? `节律摘要: ${meta.rhythmSummary}` : '',
        tagLine,
        effectiveLine,
        periodLines.length ? ['时间段状态:', ...periodLines].join('\n') : '',
        eventLines.length ? ['时间线事件:', ...eventLines].join('\n') : '',
        signalLines.length ? ['状态线索:', ...signalLines.slice(0, 9)].join('\n') : '',
    ].filter(Boolean).join('\n');
}

function renderHealthRelationshipFieldLab() {
    const root = document.getElementById('health-relationship-lab');
    if (!root) return;
    const visible = canUseHealthStateExtensionFeatures();
    root.classList.toggle('hidden', !visible);
    if (!visible) {
        root.innerHTML = '';
        return;
    }
    root.innerHTML = buildHealthCanvasMarkup();
}



    return {
      buildHealthRelationshipFieldModel,
      buildHealthCanvasMarkup,
      buildHealthStateAIReadablePromptContext,
      getHealthCanvasWorkspaceMarkup,
      renderHealthRelationshipFieldLab,
    };
  }

  window.MorphHealthRelationshipCanvasRuntime = { create: createHealthRelationshipCanvasRuntime };
})();
