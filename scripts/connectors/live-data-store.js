const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function createLiveDataStore(deps = {}) {
  const api = deps && typeof deps === 'object' ? deps : {};
  const SHARDS_DIR_NAME = 'shards';
  const SHARDS_INDEX_FILE = 'index.json';
  const AI_CHAT_SESSIONS_FILE = 'ai-chat-sessions.json';
  const AI_DAILY_LOGS_FILE = 'ai-daily-logs.json';
  const AI_DAILY_LOGS_DIR = 'ai-daily-logs';
  const AI_DAILY_LOGS_INDEX_FILE = 'index.json';
  const AI_DAILY_LOGS_ITEMS_DIR = 'days';
  const DAILY_MONTHS_FILE = 'daily-months.json';
  const REMINDERS_FILE = 'reminders.json';
  const AI_CHAT_SESSIONS_DIR = 'ai-chat-sessions';
  const AI_CHAT_SESSIONS_INDEX_FILE = 'index.json';
  const AI_CHAT_SESSIONS_ITEMS_DIR = 'sessions';
  const DAILY_MONTHS_DIR = 'daily-months';
  const DAILY_MONTHS_INDEX_FILE = 'index.json';
  const DAILY_MONTHS_ITEMS_DIR = 'months';
  const REMINDERS_DIR = 'reminders';
  const REMINDERS_INDEX_FILE = 'index.json';
  const REMINDERS_ITEMS_DIR = 'items';
  const PROJECTS_FILE = 'projects.json';
  const PROJECTS_DIR = 'projects';
  const PROJECTS_INDEX_FILE = 'index.json';
  const PROJECTS_ITEMS_DIR = 'items';
  const EXPENSE_LEDGER_FILE = 'expense-ledger.json';
  const EXPENSE_LEDGER_DIR = 'expense-ledger';
  const EXPENSE_LEDGER_INDEX_FILE = 'index.json';
  const EXPENSE_LEDGER_ITEMS_DIR = 'records';
  const EXPENSE_LEDGER_CATEGORIES_FILE = 'categories.json';

  function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function describeCanonicalStore() {
    const provided = api.canonicalStore && typeof api.canonicalStore === 'object' ? api.canonicalStore : {};
    const liveDataFile = String(api.liveDataFile || '').trim();
    const syncRoot = String(api.syncRoot || provided.syncRoot || '').trim();
    const relativePath = String(provided.relativePath || '').trim()
      || (path.basename(liveDataFile) === 'live-data.json'
        ? 'data/live-data.json'
        : (syncRoot && liveDataFile && path.resolve(liveDataFile) === path.resolve(path.join(syncRoot, 'data', 'live-data.json'))
        ? 'data/live-data.json'
        : (path.basename(liveDataFile) || 'live-data.json')));
    return {
      kind: 'live-data-json',
      role: 'authoritative-user-store',
      owner: 'core-data',
      ...cloneJson(provided),
      relativePath,
      absolutePath: liveDataFile,
      syncRoot,
    };
  }

  function writeJsonIfChanged(filePath, payload) {
    const next = `${JSON.stringify(payload, null, 2)}\n`;
    try {
      if (fs.existsSync(filePath)) {
        const current = fs.readFileSync(filePath, 'utf8');
        if (current === next) return;
      }
    } catch (_) {}
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, next, 'utf8');
    removeDuplicateShardConflictFiles(filePath);
  }

  function removeDuplicateShardConflictFiles(filePath) {
    const normalized = String(filePath || '').trim();
    if (!normalized) return 0;
    const dirname = path.dirname(normalized);
    const basename = path.basename(normalized);
    if (!/[/\\]data[/\\]shards([/\\]|$)/.test(dirname)) return 0;
    const extIndex = basename.lastIndexOf('.');
    if (extIndex <= 0 || extIndex === basename.length - 1) return 0;
    const stem = basename.slice(0, extIndex);
    const ext = basename.slice(extIndex).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+${ext}$`);
    let removed = 0;
    try {
      const entries = fs.existsSync(dirname) ? fs.readdirSync(dirname) : [];
      entries.forEach((entryName) => {
        if (!pattern.test(entryName)) return;
        try {
          fs.unlinkSync(path.join(dirname, entryName));
          removed += 1;
        } catch (_) {}
      });
    } catch (_) {}
    return removed;
  }

  function encodeShardFileSegment(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return 'empty';
    return Buffer.from(text, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  function readJsonSafely(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {
      return null;
    }
  }

  function stableJsonStringify(value) {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => stableJsonStringify(entry)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function hashJsonValue(value) {
    return crypto
      .createHash('sha256')
      .update(stableJsonStringify(value), 'utf8')
      .digest('hex');
  }

  function buildDerivedShardManifest(data) {
    const normalized = api.normalizeData(data);
    const aiMemory = normalized?.aiMemory && typeof normalized.aiMemory === 'object' ? normalized.aiMemory : {};
    const expenseLedger = normalized?.expenseLedger && typeof normalized.expenseLedger === 'object'
      ? normalized.expenseLedger
      : { categories: [], records: [] };
    const buildDomainEntry = (domain, payload, extra = {}) => ({
      domain,
      role: 'derived-shard',
      writable: false,
      sourceOfTruth: 'data/live-data.json',
      onConflict: 'discard-and-rebuild',
      rebuildStrategy: 'rebuild-from-morphcore',
      contentHash: hashJsonValue(payload),
      ...extra,
    });
    return {
      version: 1,
      kind: 'morph-derived-shards',
      role: 'derived-shard-index',
      generatedAt: new Date().toISOString(),
      sourceOfTruth: 'data/live-data.json',
      canonicalHash: hashJsonValue(normalized),
      syncRevision: api.getSyncRevision(normalized),
      syncDeviceId: String(normalized?.syncMeta?.deviceId || '').trim(),
      rebuildPolicy: {
        strategy: 'rebuild-from-morphcore',
        onConflict: 'discard-and-rebuild',
        neverOverrideMorphCore: true,
      },
      domains: [
        buildDomainEntry('aiMemory.chatSessions', Array.isArray(aiMemory.chatSessions) ? aiMemory.chatSessions : [], {
          aggregateFile: AI_CHAT_SESSIONS_FILE,
          manifestFile: `${AI_CHAT_SESSIONS_DIR}/${AI_CHAT_SESSIONS_INDEX_FILE}`,
          itemDirectory: `${AI_CHAT_SESSIONS_DIR}/${AI_CHAT_SESSIONS_ITEMS_DIR}`,
          itemCount: Array.isArray(aiMemory.chatSessions) ? aiMemory.chatSessions.length : 0,
        }),
        buildDomainEntry('aiMemory.dailyLogs', aiMemory.dailyLogs && typeof aiMemory.dailyLogs === 'object' ? aiMemory.dailyLogs : {}, {
          aggregateFile: AI_DAILY_LOGS_FILE,
          manifestFile: `${AI_DAILY_LOGS_DIR}/${AI_DAILY_LOGS_INDEX_FILE}`,
          itemDirectory: `${AI_DAILY_LOGS_DIR}/${AI_DAILY_LOGS_ITEMS_DIR}`,
          itemCount: aiMemory.dailyLogs && typeof aiMemory.dailyLogs === 'object' ? Object.keys(aiMemory.dailyLogs).length : 0,
        }),
        buildDomainEntry('dailyMonths', normalized?.dailyMonths && typeof normalized.dailyMonths === 'object' ? normalized.dailyMonths : {}, {
          aggregateFile: DAILY_MONTHS_FILE,
          manifestFile: `${DAILY_MONTHS_DIR}/${DAILY_MONTHS_INDEX_FILE}`,
          itemDirectory: `${DAILY_MONTHS_DIR}/${DAILY_MONTHS_ITEMS_DIR}`,
          itemCount: normalized?.dailyMonths && typeof normalized.dailyMonths === 'object' ? Object.keys(normalized.dailyMonths).length : 0,
        }),
        buildDomainEntry('reminders', Array.isArray(normalized?.reminders) ? normalized.reminders : [], {
          aggregateFile: REMINDERS_FILE,
          manifestFile: `${REMINDERS_DIR}/${REMINDERS_INDEX_FILE}`,
          itemDirectory: `${REMINDERS_DIR}/${REMINDERS_ITEMS_DIR}`,
          itemCount: Array.isArray(normalized?.reminders) ? normalized.reminders.length : 0,
        }),
        buildDomainEntry('projects', Array.isArray(normalized?.projects) ? normalized.projects : [], {
          aggregateFile: PROJECTS_FILE,
          manifestFile: `${PROJECTS_DIR}/${PROJECTS_INDEX_FILE}`,
          itemDirectory: `${PROJECTS_DIR}/${PROJECTS_ITEMS_DIR}`,
          itemCount: Array.isArray(normalized?.projects) ? normalized.projects.length : 0,
        }),
        buildDomainEntry('expenseLedger', expenseLedger, {
          aggregateFile: EXPENSE_LEDGER_FILE,
          manifestFile: `${EXPENSE_LEDGER_DIR}/${EXPENSE_LEDGER_INDEX_FILE}`,
          sidecars: [
            `${EXPENSE_LEDGER_DIR}/${EXPENSE_LEDGER_CATEGORIES_FILE}`,
            `${EXPENSE_LEDGER_DIR}/${EXPENSE_LEDGER_ITEMS_DIR}/`,
          ],
          itemCount: Array.isArray(expenseLedger.records) ? expenseLedger.records.length : 0,
          categoryCount: Array.isArray(expenseLedger.categories) ? expenseLedger.categories.length : 0,
        }),
      ],
    };
  }

  function writeShardedAIChatSessions(shardDir, sessions) {
    const safeSessions = Array.isArray(sessions) ? sessions : [];
    const baseDir = path.join(shardDir, AI_CHAT_SESSIONS_DIR);
    const itemsDir = path.join(baseDir, AI_CHAT_SESSIONS_ITEMS_DIR);
    fs.mkdirSync(itemsDir, { recursive: true });
    const manifest = [];
    const keepFiles = new Set();
    safeSessions.forEach((session, index) => {
      const safeSession = session && typeof session === 'object' ? cloneJson(session) : null;
      if (!safeSession) return;
      const sessionId = String(safeSession.id || '').trim() || `session-${index + 1}`;
      const fileName = `${encodeShardFileSegment(sessionId)}.json`;
      const relativeFile = `${AI_CHAT_SESSIONS_ITEMS_DIR}/${fileName}`;
      manifest.push({
        id: sessionId,
        file: relativeFile,
        order: index,
        updatedAt: String(safeSession.updatedAt || '').trim(),
        title: String(safeSession.title || '').trim(),
      });
      writeJsonIfChanged(path.join(baseDir, relativeFile), safeSession);
      keepFiles.add(fileName);
    });
    try {
      const existingFiles = fs.existsSync(itemsDir) ? fs.readdirSync(itemsDir) : [];
      existingFiles.forEach((entryName) => {
        if (!/\.json$/i.test(entryName) || keepFiles.has(entryName)) return;
        try {
          fs.unlinkSync(path.join(itemsDir, entryName));
        } catch (_) {}
      });
    } catch (_) {}
    writeJsonIfChanged(path.join(baseDir, AI_CHAT_SESSIONS_INDEX_FILE), manifest);
  }

  function readShardedAIChatSessions(shardDir) {
    const baseDir = path.join(shardDir, AI_CHAT_SESSIONS_DIR);
    const manifest = readJsonSafely(path.join(baseDir, AI_CHAT_SESSIONS_INDEX_FILE));
    if (!Array.isArray(manifest) || !manifest.length) return null;
    const sessions = [];
    manifest.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return;
      const sessionId = String(entry.id || '').trim() || `session-${index + 1}`;
      const fileName = String(entry.file || '').trim() || `${AI_CHAT_SESSIONS_ITEMS_DIR}/${encodeShardFileSegment(sessionId)}.json`;
      const session = readJsonSafely(path.join(baseDir, fileName));
      if (!session || typeof session !== 'object') return;
      sessions.push(session);
    });
    return sessions.length ? sessions : null;
  }

  function writeShardedDailyMonths(shardDir, dailyMonths) {
    const safeDailyMonths = dailyMonths && typeof dailyMonths === 'object' ? dailyMonths : {};
    const monthKeys = Object.keys(safeDailyMonths).sort();
    const baseDir = path.join(shardDir, DAILY_MONTHS_DIR);
    const itemsDir = path.join(baseDir, DAILY_MONTHS_ITEMS_DIR);
    fs.mkdirSync(itemsDir, { recursive: true });
    const manifest = [];
    const keepFiles = new Set();
    monthKeys.forEach((monthKey, index) => {
      if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
      const blocks = Array.isArray(safeDailyMonths[monthKey]) ? cloneJson(safeDailyMonths[monthKey]) : [];
      const fileName = `${encodeShardFileSegment(monthKey)}.json`;
      const relativeFile = `${DAILY_MONTHS_ITEMS_DIR}/${fileName}`;
      manifest.push({
        id: monthKey,
        file: relativeFile,
        order: index,
        updatedAt: '',
      });
      writeJsonIfChanged(path.join(baseDir, relativeFile), blocks);
      keepFiles.add(fileName);
    });
    try {
      const existingFiles = fs.existsSync(itemsDir) ? fs.readdirSync(itemsDir) : [];
      existingFiles.forEach((entryName) => {
        if (!/\.json$/i.test(entryName) || keepFiles.has(entryName)) return;
        try {
          fs.unlinkSync(path.join(itemsDir, entryName));
        } catch (_) {}
      });
    } catch (_) {}
    writeJsonIfChanged(path.join(baseDir, DAILY_MONTHS_INDEX_FILE), manifest);
  }

  function readShardedDailyMonths(shardDir) {
    const baseDir = path.join(shardDir, DAILY_MONTHS_DIR);
    const manifest = readJsonSafely(path.join(baseDir, DAILY_MONTHS_INDEX_FILE));
    if (!Array.isArray(manifest) || !manifest.length) return null;
    const dailyMonths = {};
    manifest.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return;
      const monthKey = String(entry.id || '').trim();
      const effectiveMonthKey = /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : '';
      if (!effectiveMonthKey) return;
      const fileName = String(entry.file || '').trim() || `${DAILY_MONTHS_ITEMS_DIR}/${encodeShardFileSegment(effectiveMonthKey)}.json`;
      const blocks = readJsonSafely(path.join(baseDir, fileName));
      if (!Array.isArray(blocks)) return;
      dailyMonths[effectiveMonthKey] = blocks;
    });
    return Object.keys(dailyMonths).length ? dailyMonths : null;
  }

  function writeShardedAIDailyLogs(shardDir, dailyLogs) {
    const safeDailyLogs = dailyLogs && typeof dailyLogs === 'object' && !Array.isArray(dailyLogs) ? dailyLogs : {};
    const dayKeys = Object.keys(safeDailyLogs).sort();
    const baseDir = path.join(shardDir, AI_DAILY_LOGS_DIR);
    const itemsDir = path.join(baseDir, AI_DAILY_LOGS_ITEMS_DIR);
    fs.mkdirSync(itemsDir, { recursive: true });
    const manifest = [];
    const keepFiles = new Set();
    dayKeys.forEach((dayKey, index) => {
      const safeDayKey = String(dayKey || '').trim();
      if (!safeDayKey) return;
      const entryPayload = Array.isArray(safeDailyLogs[safeDayKey]) || (safeDailyLogs[safeDayKey] && typeof safeDailyLogs[safeDayKey] === 'object')
        ? cloneJson(safeDailyLogs[safeDayKey])
        : [];
      const fileName = `${encodeShardFileSegment(safeDayKey)}.json`;
      const relativeFile = `${AI_DAILY_LOGS_ITEMS_DIR}/${fileName}`;
      manifest.push({
        id: safeDayKey,
        file: relativeFile,
        order: index,
        entryCount: Array.isArray(entryPayload) ? entryPayload.length : Object.keys(entryPayload || {}).length,
      });
      writeJsonIfChanged(path.join(baseDir, relativeFile), entryPayload);
      keepFiles.add(fileName);
    });
    try {
      const existingFiles = fs.existsSync(itemsDir) ? fs.readdirSync(itemsDir) : [];
      existingFiles.forEach((entryName) => {
        if (!/\.json$/i.test(entryName) || keepFiles.has(entryName)) return;
        try {
          fs.unlinkSync(path.join(itemsDir, entryName));
        } catch (_) {}
      });
    } catch (_) {}
    writeJsonIfChanged(path.join(baseDir, AI_DAILY_LOGS_INDEX_FILE), manifest);
  }

  function readShardedAIDailyLogs(shardDir) {
    const baseDir = path.join(shardDir, AI_DAILY_LOGS_DIR);
    const manifest = readJsonSafely(path.join(baseDir, AI_DAILY_LOGS_INDEX_FILE));
    if (!Array.isArray(manifest) || !manifest.length) return null;
    const dailyLogs = {};
    manifest.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return;
      const dayKey = String(entry.id || '').trim() || `day-${index + 1}`;
      const fileName = String(entry.file || '').trim() || `${AI_DAILY_LOGS_ITEMS_DIR}/${encodeShardFileSegment(dayKey)}.json`;
      const entryPayload = readJsonSafely(path.join(baseDir, fileName));
      if (entryPayload == null) return;
      dailyLogs[dayKey] = entryPayload;
    });
    return Object.keys(dailyLogs).length ? dailyLogs : null;
  }

  function writeShardedReminders(shardDir, reminders) {
    const safeReminders = Array.isArray(reminders) ? reminders : [];
    const baseDir = path.join(shardDir, REMINDERS_DIR);
    const itemsDir = path.join(baseDir, REMINDERS_ITEMS_DIR);
    fs.mkdirSync(itemsDir, { recursive: true });
    const manifest = [];
    const keepFiles = new Set();
    safeReminders.forEach((reminder, index) => {
      const safeReminder = reminder && typeof reminder === 'object' ? cloneJson(reminder) : null;
      if (!safeReminder) return;
      const reminderId = String(safeReminder.id || '').trim() || `reminder-${index + 1}`;
      const fileName = `${encodeShardFileSegment(reminderId)}.json`;
      const relativeFile = `${REMINDERS_ITEMS_DIR}/${fileName}`;
      manifest.push({
        id: reminderId,
        file: relativeFile,
        order: index,
        remindAt: String(safeReminder.remindAt || safeReminder.triggerAt || '').trim(),
        text: String(safeReminder.text || safeReminder.title || safeReminder.label || '').trim().slice(0, 120),
      });
      writeJsonIfChanged(path.join(baseDir, relativeFile), safeReminder);
      keepFiles.add(fileName);
    });
    try {
      const existingFiles = fs.existsSync(itemsDir) ? fs.readdirSync(itemsDir) : [];
      existingFiles.forEach((entryName) => {
        if (!/\.json$/i.test(entryName) || keepFiles.has(entryName)) return;
        try {
          fs.unlinkSync(path.join(itemsDir, entryName));
        } catch (_) {}
      });
    } catch (_) {}
    writeJsonIfChanged(path.join(baseDir, REMINDERS_INDEX_FILE), manifest);
  }

  function readShardedReminders(shardDir) {
    const baseDir = path.join(shardDir, REMINDERS_DIR);
    const manifest = readJsonSafely(path.join(baseDir, REMINDERS_INDEX_FILE));
    if (!Array.isArray(manifest) || !manifest.length) return null;
    const reminders = [];
    manifest.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return;
      const reminderId = String(entry.id || '').trim() || `reminder-${index + 1}`;
      const fileName = String(entry.file || '').trim() || `${REMINDERS_ITEMS_DIR}/${encodeShardFileSegment(reminderId)}.json`;
      const reminder = readJsonSafely(path.join(baseDir, fileName));
      if (!reminder || typeof reminder !== 'object') return;
      reminders.push(reminder);
    });
    return reminders.length ? reminders : null;
  }

  function writeShardedProjects(shardDir, projects) {
    const safeProjects = Array.isArray(projects) ? projects : [];
    const baseDir = path.join(shardDir, PROJECTS_DIR);
    const itemsDir = path.join(baseDir, PROJECTS_ITEMS_DIR);
    fs.mkdirSync(itemsDir, { recursive: true });
    const manifest = [];
    const keepFiles = new Set();
    safeProjects.forEach((project, index) => {
      const safeProject = project && typeof project === 'object' ? cloneJson(project) : null;
      if (!safeProject) return;
      const projectId = String(safeProject.id || '').trim() || `project-${index + 1}`;
      const fileName = `${encodeShardFileSegment(projectId)}.json`;
      const relativeFile = `${PROJECTS_ITEMS_DIR}/${fileName}`;
      manifest.push({
        id: projectId,
        file: relativeFile,
        order: index,
        updatedAt: String(safeProject.updatedAt || '').trim(),
        title: String(safeProject.title || safeProject.name || '').trim().slice(0, 120),
      });
      writeJsonIfChanged(path.join(baseDir, relativeFile), safeProject);
      keepFiles.add(fileName);
    });
    try {
      const existingFiles = fs.existsSync(itemsDir) ? fs.readdirSync(itemsDir) : [];
      existingFiles.forEach((entryName) => {
        if (!/\.json$/i.test(entryName) || keepFiles.has(entryName)) return;
        try {
          fs.unlinkSync(path.join(itemsDir, entryName));
        } catch (_) {}
      });
    } catch (_) {}
    writeJsonIfChanged(path.join(baseDir, PROJECTS_INDEX_FILE), manifest);
  }

  function readShardedProjects(shardDir) {
    const baseDir = path.join(shardDir, PROJECTS_DIR);
    const manifest = readJsonSafely(path.join(baseDir, PROJECTS_INDEX_FILE));
    if (!Array.isArray(manifest) || !manifest.length) return null;
    const projects = [];
    manifest.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return;
      const projectId = String(entry.id || '').trim() || `project-${index + 1}`;
      const fileName = String(entry.file || '').trim() || `${PROJECTS_ITEMS_DIR}/${encodeShardFileSegment(projectId)}.json`;
      const project = readJsonSafely(path.join(baseDir, fileName));
      if (!project || typeof project !== 'object') return;
      projects.push(project);
    });
    return projects.length ? projects : null;
  }

  function writeShardedExpenseLedger(shardDir, expenseLedger) {
    const safeLedger = expenseLedger && typeof expenseLedger === 'object' ? expenseLedger : {};
    const categories = Array.isArray(safeLedger.categories) ? cloneJson(safeLedger.categories) : [];
    const records = Array.isArray(safeLedger.records) ? safeLedger.records : [];
    const baseDir = path.join(shardDir, EXPENSE_LEDGER_DIR);
    const itemsDir = path.join(baseDir, EXPENSE_LEDGER_ITEMS_DIR);
    fs.mkdirSync(itemsDir, { recursive: true });
    writeJsonIfChanged(path.join(baseDir, EXPENSE_LEDGER_CATEGORIES_FILE), categories);
    const manifest = [];
    const keepFiles = new Set();
    records.forEach((record, index) => {
      const safeRecord = record && typeof record === 'object' ? cloneJson(record) : null;
      if (!safeRecord) return;
      const recordId = String(safeRecord.id || '').trim() || `expense-${index + 1}`;
      const fileName = `${encodeShardFileSegment(recordId)}.json`;
      const relativeFile = `${EXPENSE_LEDGER_ITEMS_DIR}/${fileName}`;
      manifest.push({
        id: recordId,
        file: relativeFile,
        order: index,
        spentAt: String(safeRecord.spentAt || '').trim(),
        amount: Number.isFinite(Number(safeRecord.amount)) ? Number(safeRecord.amount) : 0,
        item: String(safeRecord.item || '').trim().slice(0, 120),
      });
      writeJsonIfChanged(path.join(baseDir, relativeFile), safeRecord);
      keepFiles.add(fileName);
    });
    try {
      const existingFiles = fs.existsSync(itemsDir) ? fs.readdirSync(itemsDir) : [];
      existingFiles.forEach((entryName) => {
        if (!/\.json$/i.test(entryName) || keepFiles.has(entryName)) return;
        try {
          fs.unlinkSync(path.join(itemsDir, entryName));
        } catch (_) {}
      });
    } catch (_) {}
    writeJsonIfChanged(path.join(baseDir, EXPENSE_LEDGER_INDEX_FILE), manifest);
  }

  function readShardedExpenseLedger(shardDir) {
    const baseDir = path.join(shardDir, EXPENSE_LEDGER_DIR);
    const manifest = readJsonSafely(path.join(baseDir, EXPENSE_LEDGER_INDEX_FILE));
    if (!Array.isArray(manifest) || !manifest.length) {
      const categoriesOnly = readJsonSafely(path.join(baseDir, EXPENSE_LEDGER_CATEGORIES_FILE));
      if (Array.isArray(categoriesOnly) && categoriesOnly.length) {
        return { categories: categoriesOnly, records: [] };
      }
      return null;
    }
    const categories = readJsonSafely(path.join(baseDir, EXPENSE_LEDGER_CATEGORIES_FILE));
    const records = [];
    manifest.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return;
      const recordId = String(entry.id || '').trim() || `expense-${index + 1}`;
      const fileName = String(entry.file || '').trim() || `${EXPENSE_LEDGER_ITEMS_DIR}/${encodeShardFileSegment(recordId)}.json`;
      const record = readJsonSafely(path.join(baseDir, fileName));
      if (!record || typeof record !== 'object') return;
      records.push(record);
    });
    return {
      categories: Array.isArray(categories) ? categories : [],
      records,
    };
  }

  function writeDerivedShards(data) {
    const normalized = api.normalizeData(data);
    const shardDir = path.join(path.dirname(api.liveDataFile), SHARDS_DIR_NAME);
    const aiMemory = normalized?.aiMemory && typeof normalized.aiMemory === 'object' ? normalized.aiMemory : {};
    writeJsonIfChanged(
      path.join(shardDir, AI_CHAT_SESSIONS_FILE),
      Array.isArray(aiMemory.chatSessions) ? aiMemory.chatSessions : []
    );
    writeShardedAIChatSessions(shardDir, aiMemory.chatSessions);
    writeJsonIfChanged(
      path.join(shardDir, AI_DAILY_LOGS_FILE),
      aiMemory.dailyLogs && typeof aiMemory.dailyLogs === 'object' ? aiMemory.dailyLogs : {}
    );
    writeShardedAIDailyLogs(shardDir, aiMemory.dailyLogs);
    writeJsonIfChanged(
      path.join(shardDir, DAILY_MONTHS_FILE),
      normalized?.dailyMonths && typeof normalized.dailyMonths === 'object' ? normalized.dailyMonths : {}
    );
    writeShardedDailyMonths(shardDir, normalized?.dailyMonths);
    writeJsonIfChanged(
      path.join(shardDir, REMINDERS_FILE),
      Array.isArray(normalized?.reminders) ? normalized.reminders : []
    );
    writeShardedReminders(shardDir, normalized?.reminders);
    writeJsonIfChanged(
      path.join(shardDir, PROJECTS_FILE),
      Array.isArray(normalized?.projects) ? normalized.projects : []
    );
    writeShardedProjects(shardDir, normalized?.projects);
    writeJsonIfChanged(
      path.join(shardDir, EXPENSE_LEDGER_FILE),
      normalized?.expenseLedger && typeof normalized.expenseLedger === 'object'
        ? normalized.expenseLedger
        : { categories: [], records: [] }
    );
    writeShardedExpenseLedger(shardDir, normalized?.expenseLedger);
    writeJsonIfChanged(path.join(shardDir, SHARDS_INDEX_FILE), buildDerivedShardManifest(normalized));
  }

  // === Live Data Cache with File Watch ===
  let liveDataCache = null;
  let liveDataCacheTime = 0;
  let liveDataWatcher = null;
  let liveDataRefreshPending = false;
  const LIVE_DATA_CACHE_TTL = 5000; // 5秒缓存
  const LIVE_DATA_WATCH_DELAY = 100; // 文件变化后延迟100ms刷新

  function refreshLiveDataCache() {
    try {
      if (!api.liveDataFile || !fs.existsSync(api.liveDataFile)) {
        liveDataCache = null;
        liveDataCacheTime = 0;
        return null;
      }
      const stat = fs.statSync(api.liveDataFile);
      const raw = fs.readFileSync(api.liveDataFile, 'utf8');
      liveDataCache = api.normalizeData(JSON.parse(raw));
      liveDataCacheTime = Date.now();
      return liveDataCache;
    } catch (err) {
      console.warn('[LiveDataStore] refresh cache failed:', err?.message || err);
      return null;
    }
  }

  function startLiveDataWatcher() {
    if (liveDataWatcher) return; // 已启动

    const filePath = api.liveDataFile;
    if (!filePath || !fs.existsSync(filePath)) {
      return;
    }

    try {
      liveDataWatcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change' && !liveDataRefreshPending) {
          liveDataRefreshPending = true;
          setTimeout(() => {
            liveDataRefreshPending = false;
            refreshLiveDataCache();
          }, LIVE_DATA_WATCH_DELAY);
        }
      });
      liveDataWatcher.on('error', (err) => {
        console.warn('[LiveDataStore] watcher error:', err?.message || err);
      });
      console.log('[LiveDataStore] file watcher started for:', filePath);
    } catch (err) {
      console.warn('[LiveDataStore] failed to start watcher:', err?.message || err);
    }
  }

  function readCurrentLiveDataSafely(options = {}) {
    const clone = options && options.clone === true;
    const now = Date.now();

    // 如果缓存有效且未过期，直接返回
    if (liveDataCache && (now - liveDataCacheTime) < LIVE_DATA_CACHE_TTL) {
      return clone ? cloneJson(liveDataCache) : liveDataCache;
    }

    // 缓存过期或不存在，重新读取
    const data = refreshLiveDataCache();

    // 首次读取时启动文件监听
    if (!liveDataWatcher) {
      startLiveDataWatcher();
    }

    return clone ? cloneJson(data) : data;
  }

  function readCurrentLiveEnvelopeSafely() {
    try {
      const raw = fs.readFileSync(api.liveDataFile, 'utf8');
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function persistMorphData(data, source = 'api/morph') {
    const snapshotFile = api.writeLiveSnapshot(api.rootDir, data, {
      file: api.liveDataFile,
      source: String(source || 'api/morph'),
    });
    writeDerivedShards(data);
    const mirrorDir = api.generateMarkdownMirror({
      rootDir: api.rootDir,
      outDir: api.mirrorDir,
      data,
      sourceLabel: path.relative(api.rootDir, snapshotFile),
    });
    return {
      snapshot: path.relative(api.rootDir, snapshotFile),
      mirror: path.relative(api.rootDir, mirrorDir),
    };
  }

  function commitMorphWrite(data, options = {}) {
    const source = String(options.source || 'canonical-write').trim() || 'canonical-write';
    const savedAt = typeof options.savedAt === 'string' && options.savedAt.trim()
      ? options.savedAt.trim()
      : new Date().toISOString();
    const normalized = api.normalizeData(data);
    if (!normalized.syncMeta || typeof normalized.syncMeta !== 'object') {
      normalized.syncMeta = {};
    }
    if (options.incrementRevision === true) {
      const currentRevision = api.getSyncRevision(readCurrentLiveEnvelopeSafely());
      const payloadRevision = api.getSyncRevision(normalized);
      normalized.syncMeta.revision = Math.max(currentRevision, payloadRevision) + 1;
    }
    normalized.syncMeta.lastServerWriteAt = savedAt;
    const persisted = persistMorphData(normalized, source);
    // Keep the in-process snapshot aligned with the just-committed canonical file
    // so immediate follow-up reads do not fall back to stale pre-commit cache.
    liveDataCache = cloneJson(normalized);
    liveDataCacheTime = Date.now();
    const routeReceipt = options.receipt && typeof options.receipt === 'object'
      ? api.cloneJson(options.receipt)
      : {};
    const writeReceipt = {
      ok: true,
      type: 'canonical_write',
      pipeline: 'morph-canonical-write',
      ...routeReceipt,
      canonicalStore: describeCanonicalStore(),
      snapshot: persisted.snapshot,
      mirror: persisted.mirror,
      savedAt,
      syncRevision: api.getSyncRevision(normalized),
      syncDeviceId: String(normalized?.syncMeta?.deviceId || '').trim(),
    };
    if (!Number.isFinite(Number(writeReceipt.ackedRevision))) {
      writeReceipt.ackedRevision = api.getSyncRevision(normalized);
    }
    if (typeof api.emitLiveDataSyncEvent === 'function' && typeof api.buildLiveDataSyncEventPayload === 'function') {
      api.emitLiveDataSyncEvent('live-data-committed', api.buildLiveDataSyncEventPayload(source, {
        savedAt,
        ackedRevision: Number(writeReceipt.ackedRevision || 0),
      }));
    }
    return {
      ok: true,
      savedAt,
      snapshot: persisted.snapshot,
      mirror: persisted.mirror,
      writeReceipt,
    };
  }

  function appendActionLog(entry) {
    try {
      fs.mkdirSync(path.dirname(api.actionLogFile), { recursive: true });
      fs.appendFileSync(api.actionLogFile, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error) {
      console.warn('[MorphActionLog] append failed:', error?.message || error);
    }
  }

  function readRecentActionLogEntries(options = {}) {
    const windowMs = Math.max(1000, Number(options.windowMs) || 600000);
    const maxEntries = Math.max(1, Number(options.maxEntries) || 120);
    const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
    if (!api.actionLogFile || !fs.existsSync(api.actionLogFile)) return [];
    try {
      const raw = fs.readFileSync(api.actionLogFile, 'utf8');
      const lines = String(raw || '').trim().split('\n').filter(Boolean);
      const entries = [];
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        if (entries.length >= maxEntries) break;
        let parsed = null;
        try {
          parsed = JSON.parse(lines[index]);
        } catch (_) {
          continue;
        }
        const updatedAtMs = Date.parse(String(parsed?.updatedAt || parsed?.writeReceipt?.savedAt || '').trim());
        if (Number.isFinite(updatedAtMs) && updatedAtMs > 0 && updatedAtMs < (nowMs - windowMs)) break;
        entries.push(parsed);
      }
      return entries.reverse();
    } catch (_) {
      return [];
    }
  }

  return {
    appendActionLog,
    commitMorphWrite,
    describeCanonicalStore,
    persistMorphData,
    readRecentActionLogEntries,
    readCurrentLiveDataSafely,
    readCurrentLiveEnvelopeSafely,
    refreshLiveDataCache,
    startLiveDataWatcher,
  };
}

module.exports = {
  createLiveDataStore,
};
