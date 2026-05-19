#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_FILE = path.join(ROOT, 'data', 'morph-owner-loop-monitor.config.json');

function parseArgs(argv = []) {
  const out = {
    config: '',
    once: false,
    dryRun: false,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (!token) continue;
    if (token === '--config') out.config = String(argv[i + 1] || '').trim(), i += 1;
    else if (token === '--once') out.once = true;
    else if (token === '--dry-run') out.dryRun = true;
    else if (token === '--verbose') out.verbose = true;
  }
  return out;
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonFileSafe(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallbackValue;
  }
}

function writeJsonFile(filePath, payload) {
  ensureDirForFile(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function appendLog(filePath, line) {
  ensureDirForFile(filePath);
  fs.appendFileSync(filePath, `${line}\n`, 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const resolveInRoot = (value, fallbackValue) => {
    const text = String(value || '').trim();
    if (!text) return fallbackValue;
    if (path.isAbsolute(text)) return text;
    return path.resolve(ROOT, text);
  };
  return {
    ownerLoopStateFile: resolveInRoot(input.ownerLoopStateFile, path.join(ROOT, 'data', 'morph-owner-loop.state.json')),
    latestMessageFile: resolveInRoot(input.latestMessageFile, path.join(ROOT, 'data', 'morph-owner-loop.last-message.txt')),
    stateFile: resolveInRoot(input.stateFile, path.join(ROOT, 'data', 'morph-owner-loop-monitor.state.json')),
    logFile: resolveInRoot(input.logFile, path.join(ROOT, 'data', 'morph-owner-loop-monitor.log')),
    notifierName: String(input.notifierName || 'Morpheus Owner Loop').trim() || 'Morpheus Owner Loop',
    alwaysNotify: input.alwaysNotify !== false,
    notifyOnChangeOnly: input.notifyOnChangeOnly === true,
  };
}

function loadConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) {
    return sanitizeConfig({});
  }
  return sanitizeConfig(readJsonFileSafe(configPath, {}));
}

function buildRoundStatus(ownerState) {
  const latestObservedRound = ownerState?.latestObservedRound || null;
  const currentRun = ownerState?.currentRun || null;
  const latestCompletedRound = Number(latestObservedRound?.roundNumber || 0);
  const latestProjectStatus = String(latestObservedRound?.projectStatus || 'UNKNOWN');
  const currentInProgressRound = currentRun && currentRun.active
    ? Number(currentRun.sourceRoundNumber || latestCompletedRound || 0) + 1
    : 0;
  const running = !!(currentRun && currentRun.active);
  const title = running
    ? `第 ${currentInProgressRound} 轮进行中`
    : latestCompletedRound > 0
      ? `当前完成到第 ${latestCompletedRound} 轮`
      : '尚未发现轮次结果';
  const body = running
    ? `最新完成轮次：第 ${latestCompletedRound} 轮（${latestProjectStatus}）；后台当前正在执行第 ${currentInProgressRound} 轮。`
    : latestCompletedRound > 0
      ? `最新 round result：第 ${latestCompletedRound} 轮，项目状态 ${latestProjectStatus}。`
      : '还没有检测到有效的 owner round result。';
  return {
    running,
    latestCompletedRound,
    latestProjectStatus,
    currentInProgressRound,
    title,
    body,
  };
}

function readLatestMessageSummary(filePath) {
  try {
    const text = String(fs.readFileSync(filePath, 'utf8') || '').trim();
    if (!text) return '';
    const firstParagraph = text.split(/\n\s*\n/)[0].trim().replace(/\s+/g, ' ');
    return firstParagraph.slice(0, 180);
  } catch (_) {
    return '';
  }
}

function sendNotification(title, subtitle, message) {
  const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)} subtitle ${JSON.stringify(subtitle)}`;
  execFileSync('osascript', ['-e', script], { stdio: 'ignore' });
}

function buildFingerprint(summary, latestMessageSummary) {
  return JSON.stringify({
    running: summary.running,
    latestCompletedRound: summary.latestCompletedRound,
    latestProjectStatus: summary.latestProjectStatus,
    currentInProgressRound: summary.currentInProgressRound,
    latestMessageSummary,
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config || DEFAULT_CONFIG_FILE);
  const ownerState = readJsonFileSafe(config.ownerLoopStateFile, {});
  const monitorState = readJsonFileSafe(config.stateFile, {
    lastCheckedAt: '',
    lastFingerprint: '',
    lastNotificationAt: '',
  });
  const summary = buildRoundStatus(ownerState);
  const latestMessageSummary = readLatestMessageSummary(config.latestMessageFile);
  const fingerprint = buildFingerprint(summary, latestMessageSummary);
  const shouldNotify = config.alwaysNotify || (config.notifyOnChangeOnly && fingerprint !== String(monitorState.lastFingerprint || ''));
  const subtitle = summary.running
    ? `已完成到第 ${summary.latestCompletedRound} 轮`
    : `项目状态 ${summary.latestProjectStatus}`;
  const message = latestMessageSummary
    ? `${summary.body}\n最新总结：${latestMessageSummary}`
    : summary.body;
  const logLine = `[owner-loop-monitor ${nowIso()}] ${summary.title} | ${summary.body}${latestMessageSummary ? ` | ${latestMessageSummary}` : ''}`;

  if (args.verbose || args.once || args.dryRun) {
    process.stdout.write(`${logLine}\n`);
  }
  appendLog(config.logFile, logLine);

  if (!args.dryRun && shouldNotify) {
    sendNotification(config.notifierName, subtitle, message);
  }

  writeJsonFile(config.stateFile, {
    lastCheckedAt: nowIso(),
    lastFingerprint: fingerprint,
    lastNotificationAt: !args.dryRun && shouldNotify ? nowIso() : String(monitorState.lastNotificationAt || ''),
    summary,
    latestMessageSummary,
  });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[owner-loop-monitor ${nowIso()}] fatal: ${String(error.message || error)}\n`);
    process.exitCode = 1;
  }
}
