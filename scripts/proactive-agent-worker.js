#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const { normalizeData } = require('./markdown-mirror-lib');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_FILE = path.join(ROOT, 'data', 'proactive-agent.config.json');
const DEFAULT_STATE_FILE = path.join(ROOT, 'data', 'proactive-agent.state.json');
const DEFAULT_LOG_FILE = path.join(ROOT, 'data', 'proactive-agent.worker.log');

function parseArgs(argv = []) {
  const out = {
    once: false,
    dryRun: false,
    verbose: false,
    config: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (!token) continue;
    if (token === '--once') out.once = true;
    else if (token === '--dry-run') out.dryRun = true;
    else if (token === '--verbose') out.verbose = true;
    else if (token === '--config') out.config = String(argv[i + 1] || '').trim(), i += 1;
  }
  return out;
}

function ensureDirForFile(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readJsonFileSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJsonFile(file, payload) {
  ensureDirForFile(file);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function clampInt(raw, min, max, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function sanitizeClock(raw, fallback) {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return fallback;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function sanitizeConfig(raw, configPath) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const resolveInRoot = (p, fallback) => {
    const base = String(p || '').trim();
    if (!base) return fallback;
    if (path.isAbsolute(base)) return base;
    return path.resolve(ROOT, base);
  };
  const localCommandRaw = input.localCommand && typeof input.localCommand === 'object' ? input.localCommand : {};
  const webhookRaw = input.webhook && typeof input.webhook === 'object' ? input.webhook : {};
  return {
    enabled: input.enabled !== false,
    timezone: String(input.timezone || 'Asia/Shanghai').trim() || 'Asia/Shanghai',
    intervalSeconds: clampInt(input.intervalSeconds, 20, 3600, 3600),
    minNotifyGapMinutes: clampInt(input.minNotifyGapMinutes, 3, 360, 20),
    maxFindingsPerScan: clampInt(input.maxFindingsPerScan, 1, 8, 3),
    soonReminderMinutes: clampInt(input.soonReminderMinutes, 5, 240, 45),
    overdueReminderMinutes: clampInt(input.overdueReminderMinutes, 1, 240, 15),
    quietHoursStart: sanitizeClock(input.quietHoursStart, '22:00'),
    quietHoursEnd: sanitizeClock(input.quietHoursEnd, '07:00'),
    dataFile: resolveInRoot(input.dataFile, path.join(ROOT, 'data', 'live-data.json')),
    stateFile: resolveInRoot(input.stateFile, DEFAULT_STATE_FILE),
    logFile: resolveInRoot(input.logFile, DEFAULT_LOG_FILE),
    webhook: {
      enabled: webhookRaw.enabled === true,
      url: String(webhookRaw.url || '').trim(),
      timeoutMs: clampInt(webhookRaw.timeoutMs, 1000, 60000, 8000),
      secret: String(webhookRaw.secret || '').trim(),
      headers: webhookRaw.headers && typeof webhookRaw.headers === 'object' ? webhookRaw.headers : {},
    },
    localCommand: {
      enabled: localCommandRaw.enabled === true,
      command: String(localCommandRaw.command || '').trim(),
      args: Array.isArray(localCommandRaw.args) ? localCommandRaw.args.map((item) => String(item || '')) : [],
      timeoutMs: clampInt(localCommandRaw.timeoutMs, 1000, 60000, 8000),
    },
  };
}

function nowPartsInTimezone(date, timezone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map = {};
  parts.forEach((item) => {
    if (item.type !== 'literal') map[item.type] = item.value;
  });
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function todayStrInTimezone(date, timezone) {
  const p = nowPartsInTimezone(date, timezone);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function parseClockToMinutes(value) {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return h * 60 + mm;
}

function isQuietHours(date, config) {
  const start = parseClockToMinutes(config.quietHoursStart);
  const end = parseClockToMinutes(config.quietHoursEnd);
  const p = nowPartsInTimezone(date, config.timezone);
  const current = p.hour * 60 + p.minute;
  if (start === null || end === null || start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function extractDailyDate(content = '') {
  const text = String(content || '').trim();
  const m = text.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function analyzeDailyToday(data, timezone, now = new Date()) {
  const today = todayStrInTimezone(now, timezone);
  const month = today.slice(0, 7);
  const blocks = Array.isArray(data.dailyMonths?.[month]) ? data.dailyMonths[month] : [];
  let activeDate = '';
  let hasHeader = false;
  let filledLines = 0;
  let todoTotal = 0;
  let todoDone = 0;
  blocks.forEach((block) => {
    if (!block || typeof block !== 'object') return;
    if (block.type === 'h3') {
      activeDate = extractDailyDate(block.content);
      if (activeDate === today) hasHeader = true;
      return;
    }
    if (activeDate !== today) return;
    const content = String(block.content || '').trim();
    if (block.type === 'todo') {
      todoTotal += 1;
      if (block.checked === true) todoDone += 1;
    }
    if (content) filledLines += 1;
  });
  return { hasHeader, filledLines, todoTotal, todoDone };
}

function analyzeFindings(data, config, now = new Date()) {
  const findings = [];
  const nowMs = now.getTime();
  const reminders = Array.isArray(data.reminders) ? data.reminders : [];
  const pending = reminders
    .filter((item) => item && String(item.status || 'pending') === 'pending' && Number.isFinite(Number(item.dueAtMs)));
  const overdueCutoff = nowMs - Number(config.overdueReminderMinutes) * 60 * 1000;
  const overdue = pending
    .filter((item) => Number(item.dueAtMs) <= overdueCutoff)
    .sort((a, b) => Number(a.dueAtMs || 0) - Number(b.dueAtMs || 0));
  if (overdue.length) {
    findings.push({
      key: `reminder_overdue_${Math.min(overdue.length, 9)}`,
      severity: 'high',
      summary: `超时提醒 ${overdue.length} 条，最早是「${String(overdue[0].text || '').slice(0, 40)}」。`,
    });
  }
  const soonMs = Number(config.soonReminderMinutes) * 60 * 1000;
  const soon = pending
    .filter((item) => {
      const due = Number(item.dueAtMs || 0);
      return due > nowMs && due <= nowMs + soonMs;
    })
    .sort((a, b) => Number(a.dueAtMs || 0) - Number(b.dueAtMs || 0))
    .slice(0, 3);
  if (soon.length) {
    findings.push({
      key: `reminder_soon_${soon.length}`,
      severity: 'medium',
      summary: `${config.soonReminderMinutes} 分钟内有 ${soon.length} 条提醒即将触发。`,
    });
  }
  const daily = analyzeDailyToday(data, config.timezone, now);
  const p = nowPartsInTimezone(now, config.timezone);
  const mins = p.hour * 60 + p.minute;
  if (mins >= 12 * 60 && (!daily.hasHeader || daily.filledLines === 0)) {
    findings.push({
      key: 'daily_empty_today',
      severity: 'medium',
      summary: '今日日志仍为空，建议先写 1-2 行进展。',
    });
  }
  if (mins >= 14 * 60 && daily.todoTotal >= 4 && daily.todoDone === 0) {
    findings.push({
      key: `daily_todo_stuck_${daily.todoTotal}`,
      severity: 'low',
      summary: `今日日志中 ${daily.todoTotal} 条待办尚未勾选。`,
    });
  }
  const ungroupedFlash = (Array.isArray(data.flashThoughts) ? data.flashThoughts : [])
    .filter((item) => !String(item?.clusterId || '').trim());
  if (ungroupedFlash.length >= 24) {
    findings.push({
      key: `flash_ungrouped_${Math.min(99, ungroupedFlash.length)}`,
      severity: 'low',
      summary: `未分组闪念累计 ${ungroupedFlash.length} 条。`,
    });
  }
  const glucoseUpdatedAt = Date.parse(String(data?.glucoseSync?.updatedAt || ''));
  if (Number.isFinite(glucoseUpdatedAt) && glucoseUpdatedAt > 0 && nowMs - glucoseUpdatedAt > 100 * 60 * 1000) {
    findings.push({
      key: 'glucose_sync_stale',
      severity: 'low',
      summary: '血糖同步超过 100 分钟未更新。',
    });
  }
  const rank = { high: 3, medium: 2, low: 1 };
  findings.sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0));
  return findings.slice(0, config.maxFindingsPerScan);
}

function buildSummary(findings, config, now = new Date()) {
  const p = nowPartsInTimezone(now, config.timezone);
  const at = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  const lines = findings.map((item, idx) => `${idx + 1}. ${item.summary}`);
  return `主动巡检(${at})发现 ${findings.length} 项:\n${lines.join('\n')}`;
}

function stateShape(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const issueCooldowns = {};
  if (src.issueCooldowns && typeof src.issueCooldowns === 'object') {
    Object.entries(src.issueCooldowns).forEach(([key, value]) => {
      const ts = Number(value);
      if (!key || !Number.isFinite(ts) || ts <= 0) return;
      issueCooldowns[key] = ts;
    });
  }
  const history = Array.isArray(src.history)
    ? src.history.filter((item) => item && typeof item === 'object').slice(-80)
    : [];
  return {
    lastRunAt: String(src.lastRunAt || ''),
    lastNotifiedAt: String(src.lastNotifiedAt || ''),
    issueCooldowns,
    history,
  };
}

function trimCooldowns(issueCooldowns, nowMs) {
  const out = {};
  Object.entries(issueCooldowns || {}).forEach(([key, value]) => {
    const ts = Number(value);
    if (!Number.isFinite(ts) || ts <= 0) return;
    if (nowMs - ts > 7 * 24 * 60 * 60 * 1000) return;
    out[key] = ts;
  });
  return out;
}

function shouldNotifyFinding(state, findingKey, nowMs, minGapMinutes) {
  const minGapMs = Number(minGapMinutes) * 60 * 1000;
  const issueLast = Number(state.issueCooldowns[findingKey] || 0);
  if (Number.isFinite(issueLast) && issueLast > 0 && nowMs - issueLast < minGapMs) return false;
  const globalLast = Date.parse(String(state.lastNotifiedAt || ''));
  if (Number.isFinite(globalLast) && globalLast > 0 && nowMs - globalLast < minGapMs) return false;
  return true;
}

function logLine(logFile, message) {
  ensureDirForFile(logFile);
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logFile, line, 'utf8');
}

function postWebhook(config, payload) {
  return new Promise((resolve, reject) => {
    const target = new URL(config.url);
    const isHttps = target.protocol === 'https:';
    const mod = isHttps ? https : http;
    const body = Buffer.from(JSON.stringify(payload));
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(body.length),
      ...config.headers,
    };
    if (config.secret) headers['x-morph-agent-secret'] = config.secret;
    const req = mod.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: `${target.pathname || '/'}${target.search || ''}`,
      method: 'POST',
      headers,
      timeout: config.timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        statusCode: Number(res.statusCode || 0),
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('timeout', () => req.destroy(new Error('webhook timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function runLocalCommand(config, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.command, config.args || [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MORPH_AGENT_SUMMARY: String(payload.summary || ''),
        MORPH_AGENT_FINDINGS: JSON.stringify(payload.findings || []),
      },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) {}
      reject(new Error('local command timeout'));
    }, config.timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += String(chunk || ''); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk || ''); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(`local command failed: code=${code} stderr=${stderr.trim()}`));
    });
  });
}

function readLiveData(dataFile) {
  const raw = readJsonFileSafe(dataFile, null);
  if (!raw || typeof raw !== 'object') return null;
  return normalizeData(raw);
}

async function runScan(config, state, flags) {
  const now = new Date();
  state.lastRunAt = now.toISOString();
  const data = readLiveData(config.dataFile);
  if (!data) return { ok: false, reason: 'data_unavailable' };
  if (!flags.force && isQuietHours(now, config)) return { ok: true, reason: 'quiet_hours' };
  const findings = analyzeFindings(data, config, now);
  if (!findings.length) return { ok: true, reason: 'no_findings', findings: [] };
  const nowMs = now.getTime();
  state.issueCooldowns = trimCooldowns(state.issueCooldowns, nowMs);
  const notifyFindings = findings.filter((item) => shouldNotifyFinding(state, item.key, nowMs, config.minNotifyGapMinutes));
  if (!notifyFindings.length) return { ok: true, reason: 'cooldown', findings: [] };
  const summary = buildSummary(notifyFindings, config, now);
  const payload = {
    at: now.toISOString(),
    timezone: config.timezone,
    summary,
    findings: notifyFindings,
  };
  if (!flags.dryRun) {
    if (config.webhook.enabled && config.webhook.url) {
      await postWebhook(config.webhook, payload);
    }
    if (config.localCommand.enabled && config.localCommand.command) {
      await runLocalCommand(config.localCommand, payload);
    }
  }
  notifyFindings.forEach((item) => { state.issueCooldowns[item.key] = nowMs; });
  state.lastNotifiedAt = now.toISOString();
  state.history.push({
    at: payload.at,
    summary: payload.summary,
    count: notifyFindings.length,
  });
  if (state.history.length > 80) state.history = state.history.slice(-80);
  return { ok: true, reason: 'notified', findings: notifyFindings };
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const configPath = argv.config ? path.resolve(argv.config) : DEFAULT_CONFIG_FILE;
  const configRaw = readJsonFileSafe(configPath, {});
  const config = sanitizeConfig(configRaw, configPath);
  const state = stateShape(readJsonFileSafe(config.stateFile, {}));
  const log = (msg) => {
    if (argv.verbose) process.stdout.write(`[agent] ${msg}\n`);
    logLine(config.logFile, msg);
  };
  const tick = async () => {
    if (!config.enabled) {
      log('disabled');
      writeJsonFile(config.stateFile, state);
      return;
    }
    try {
      const result = await runScan(config, state, { dryRun: argv.dryRun, force: argv.once });
      const brief = `${result.ok ? 'ok' : 'fail'}:${result.reason}${Array.isArray(result.findings) ? `:${result.findings.length}` : ''}`;
      log(brief);
    } catch (error) {
      log(`error:${error.message || 'unknown'}`);
    } finally {
      writeJsonFile(config.stateFile, state);
    }
  };

  await tick();
  if (argv.once) return;

  const intervalMs = config.intervalSeconds * 1000;
  setInterval(() => {
    tick();
  }, intervalMs);
  process.stdout.write(`[agent] running interval=${config.intervalSeconds}s config=${configPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`[agent] fatal: ${error.message || error}\n`);
  process.exit(1);
});
