#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROUND_RESULT_FILE_RE = /^morph-round-(\d+)-.+\.md$/i;
const DEFAULT_DEBOUNCE_MS = 1500;
const DEFAULT_POLL_INTERVAL_MS = 30000;
const DEFAULT_AFTER_RUN_DELAY_MS = 2500;
const DEFAULT_MAX_RETRY_PER_PASS_ROUND = 3;

function nowIso() {
  return new Date().toISOString();
}

function log(message, verbose) {
  if (!verbose && /^\[debug\]/.test(message)) return;
  process.stdout.write(`[owner-loop ${nowIso()}] ${message}\n`);
}

function parseArgs(argv) {
  const args = {
    configPath: '',
    once: false,
    dryRun: false,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--config' && argv[i + 1]) {
      args.configPath = argv[i + 1];
      i += 1;
    } else if (token === '--once') {
      args.once = true;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--verbose') {
      args.verbose = true;
    }
  }
  return args;
}

function readJson(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function getDefaultConfig(rootDir) {
  const dataDir = path.join(rootDir, 'data');
  return {
    workspaceRoot: rootDir,
    docsDir: path.join(rootDir, 'docs'),
    stateFile: path.join(dataDir, 'morph-owner-loop.state.json'),
    lastMessageFile: path.join(dataDir, 'morph-owner-loop.last-message.txt'),
    debounceMs: DEFAULT_DEBOUNCE_MS,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    afterRunDelayMs: DEFAULT_AFTER_RUN_DELAY_MS,
    bootstrapOnPass: true,
    allowWebSearch: true,
    dangerouslyBypassApprovalsAndSandbox: true,
    maxRetryPerPassRound: DEFAULT_MAX_RETRY_PER_PASS_ROUND,
    codexBin: process.env.MORPH_OWNER_LOOP_CODEX_BIN || 'codex',
    codexModel: '',
    requiredDocs: [
      path.join(rootDir, 'docs', 'README.md'),
      path.join(rootDir, 'docs', 'morph-product-canon.md'),
      path.join(rootDir, 'docs', 'morph-module-ownership-guide.md'),
      path.join(rootDir, 'docs', 'morph-90-day-execution-plan.md'),
      path.join(rootDir, 'docs', 'morph-autonomous-execution-loop.md'),
      path.join(rootDir, 'docs', 'morph-quality-gates.md'),
    ],
  };
}

function loadConfig(rootDir, configPath) {
  const defaults = getDefaultConfig(rootDir);
  if (!configPath || !fs.existsSync(configPath)) return defaults;
  const loaded = readJson(configPath, {});
  return {
    ...defaults,
    ...loaded,
    requiredDocs: Array.isArray(loaded.requiredDocs) && loaded.requiredDocs.length
      ? loaded.requiredDocs.map((item) => path.resolve(rootDir, item))
      : defaults.requiredDocs,
  };
}

function parseRoundNumber(fileName) {
  const match = String(fileName || '').match(ROUND_RESULT_FILE_RE);
  return match ? Number(match[1]) : 0;
}

function extractNextAction(text) {
  const lines = String(text || '').split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /下一轮唯一允许推进的动作/.test(line));
  if (headingIndex === -1) return '';
  for (let i = headingIndex + 1; i < Math.min(lines.length, headingIndex + 8); i += 1) {
    const cleaned = String(lines[i] || '').trim();
    if (!cleaned) continue;
    if (cleaned.startsWith('>')) return cleaned.replace(/^>\s*/, '').trim();
    if (/^[0-9]+\./.test(cleaned) || /^[-*]/.test(cleaned)) return cleaned.replace(/^([0-9]+\.\s*|[-*]\s*)/, '').trim();
  }
  return '';
}

function parseProjectStatus(text) {
  const explicit = String(text || '').match(/当前项目状态：`(PASS|HOLD|BLOCKED)`/);
  if (explicit) return explicit[1];
  const overallGate = String(text || '').match(/项目整体门槛评价[\s\S]*?结果：`(PASS|HOLD|BLOCKED)`/);
  if (overallGate) return overallGate[1];
  return 'UNKNOWN';
}

function parseRoundResultDoc(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    fileName: path.basename(filePath),
    roundNumber: parseRoundNumber(path.basename(filePath)),
    projectStatus: parseProjectStatus(text),
    nextAction: extractNextAction(text),
    mtimeMs: stat.mtimeMs,
    updatedAt: stat.mtime.toISOString(),
  };
}

function listRoundResultFiles(docsDir) {
  if (!fs.existsSync(docsDir)) return [];
  return fs.readdirSync(docsDir)
    .filter((fileName) => ROUND_RESULT_FILE_RE.test(fileName))
    .map((fileName) => path.join(docsDir, fileName));
}

function findLatestRoundResult(docsDir) {
  const files = listRoundResultFiles(docsDir)
    .map((filePath) => parseRoundResultDoc(filePath))
    .sort((a, b) => {
      if (b.roundNumber !== a.roundNumber) return b.roundNumber - a.roundNumber;
      return b.mtimeMs - a.mtimeMs;
    });
  return files[0] || null;
}

function shouldTriggerNextCycle(latestRound, state, config) {
  if (!latestRound) return { trigger: false, reason: 'no-round-results' };
  if (latestRound.projectStatus !== 'PASS') return { trigger: false, reason: `latest-round-${String(latestRound.projectStatus || 'unknown').toLowerCase()}` };
  if (state.currentRun && state.currentRun.active) return { trigger: false, reason: 'run-in-progress' };
  const handled = state.lastHandledPassRound || null;
  if (!handled || Number(handled.roundNumber || 0) < latestRound.roundNumber) {
    return { trigger: true, reason: 'new-pass-round-detected' };
  }
  if (Number(handled.roundNumber || 0) > latestRound.roundNumber) {
    return { trigger: false, reason: 'state-ahead-of-latest-round' };
  }
  const attempts = Number(handled.attempts || 0);
  if (Number(handled.lastExitCode || 0) === 0) {
    return { trigger: false, reason: 'latest-pass-round-already-consumed' };
  }
  if (attempts >= Number(config.maxRetryPerPassRound || DEFAULT_MAX_RETRY_PER_PASS_ROUND)) {
    return { trigger: false, reason: 'retry-limit-reached' };
  }
  return { trigger: true, reason: 'retry-after-failed-run' };
}

function buildOwnerPrompt(config, latestRound) {
  const docs = config.requiredDocs.map((filePath) => filePath).join(', ');
  const latestSummary = latestRound
    ? `The latest completed owner round is ${latestRound.fileName} with overall project status ${latestRound.projectStatus}.`
    : 'No prior owner round result doc was found.';
  const nextAction = latestRound && latestRound.nextAction
    ? `The owner-locked next action is: ${latestRound.nextAction}.`
    : 'Determine the single allowed next action from the latest owner docs and round results.';
  return [
    `Read these canonical docs first: ${docs}.`,
    latestSummary,
    nextAction,
    'Act as the direct product owner for this repository.',
    'Determine the single currently allowed next round and complete exactly one bounded cycle of work.',
    'Spawn only the relevant sub-agents for that round if agent delegation is available.',
    'Update code, docs, and tests together when the round requires implementation.',
    'Run the relevant evaluation and regression checks before stopping.',
    'Write a new round-result doc under the docs directory, update docs/README.md, and clearly record PASS, HOLD, or BLOCKED.',
    'If a blocker remains, stop after documenting it. If the round passes, stop after that single round; the event-driven owner loop service will trigger the next round automatically.',
  ].join(' ');
}

function loadState(stateFile) {
  return readJson(stateFile, {
    latestObservedRound: null,
    currentRun: null,
    lastHandledPassRound: null,
    lastRun: null,
  });
}

function persistState(stateFile, nextState) {
  writeJson(stateFile, nextState);
}

function runCodexRound(config, prompt, verbose) {
  fs.mkdirSync(path.dirname(config.lastMessageFile), { recursive: true });
  const args = [];
  if (config.allowWebSearch) args.push('--search');
  args.push('exec', '--cd', config.workspaceRoot, '--output-last-message', config.lastMessageFile);
  if (config.codexModel) args.push('--model', config.codexModel);
  if (config.dangerouslyBypassApprovalsAndSandbox) args.push('--dangerously-bypass-approvals-and-sandbox');
  args.push(prompt);
  log(`[debug] spawning: ${config.codexBin} ${args.join(' ')}`, verbose);
  return new Promise((resolve, reject) => {
    const child = spawn(config.codexBin, args, {
      cwd: config.workspaceRoot,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code: code == null ? 1 : code, signal: signal || '' }));
  });
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(rootDir, args.configPath);
  let reconcileTimer = null;
  let pollTimer = null;
  let watcher = null;
  let shuttingDown = false;

  function saveObservation(latestRound) {
    const state = loadState(config.stateFile);
    state.latestObservedRound = latestRound
      ? {
        roundNumber: latestRound.roundNumber,
        fileName: latestRound.fileName,
        projectStatus: latestRound.projectStatus,
        updatedAt: latestRound.updatedAt,
      }
      : null;
    persistState(config.stateFile, state);
  }

  async function reconcile(reason) {
    if (shuttingDown) return;
    const latestRound = findLatestRoundResult(config.docsDir);
    saveObservation(latestRound);
    const state = loadState(config.stateFile);
    const decision = shouldTriggerNextCycle(latestRound, state, config);
    log(`[debug] reconcile reason=${reason} latest=${latestRound ? latestRound.fileName : 'none'} status=${latestRound ? latestRound.projectStatus : 'none'} decision=${decision.reason}`, args.verbose);
    if (!decision.trigger) {
      if (args.once) log(`no trigger: ${decision.reason}`, true);
      return;
    }
    if (args.dryRun) {
      const prompt = buildOwnerPrompt(config, latestRound);
      log(`dry-run: would trigger next cycle from ${latestRound.fileName}`, true);
      log(`dry-run prompt: ${prompt}`, true);
      return;
    }
    const handled = state.lastHandledPassRound || {};
    const nextAttempts = Number(handled.roundNumber || 0) === latestRound.roundNumber
      ? Number(handled.attempts || 0) + 1
      : 1;
    state.lastHandledPassRound = {
      roundNumber: latestRound.roundNumber,
      fileName: latestRound.fileName,
      attempts: nextAttempts,
      lastExitCode: null,
      triggeredAt: nowIso(),
    };
    state.currentRun = {
      active: true,
      sourceRoundNumber: latestRound.roundNumber,
      sourceRoundFile: latestRound.fileName,
      startedAt: nowIso(),
      reason,
    };
    persistState(config.stateFile, state);
    const prompt = buildOwnerPrompt(config, latestRound);
    log(`triggering next owner cycle from ${latestRound.fileName}`, true);
    const result = await runCodexRound(config, prompt, args.verbose).catch((error) => ({ code: 1, signal: '', error }));
    const finalState = loadState(config.stateFile);
    finalState.currentRun = null;
    finalState.lastHandledPassRound = {
      ...(finalState.lastHandledPassRound || {}),
      lastExitCode: Number(result.code || 1),
      finishedAt: nowIso(),
    };
    finalState.lastRun = {
      sourceRoundNumber: latestRound.roundNumber,
      sourceRoundFile: latestRound.fileName,
      startedAt: state.currentRun.startedAt,
      endedAt: nowIso(),
      exitCode: Number(result.code || 1),
      signal: result.signal || '',
      error: result.error ? String(result.error.message || result.error) : '',
    };
    persistState(config.stateFile, finalState);
    if (result.error) {
      log(`codex round failed before completion: ${String(result.error.message || result.error)}`, true);
    } else if (Number(result.code || 1) !== 0) {
      log(`codex round exited with code ${Number(result.code || 1)}`, true);
    } else {
      log('codex round finished, waiting for result docs to settle', true);
    }
    if (!args.once) scheduleReconcile('post-run', Number(config.afterRunDelayMs || DEFAULT_AFTER_RUN_DELAY_MS));
  }

  function scheduleReconcile(reason, delayMs) {
    if (shuttingDown) return;
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(() => {
      reconcile(reason).catch((error) => {
        log(`reconcile failed: ${String(error.message || error)}`, true);
      });
    }, Number(delayMs || config.debounceMs || DEFAULT_DEBOUNCE_MS));
  }

  function shutdown() {
    shuttingDown = true;
    clearTimeout(reconcileTimer);
    clearInterval(pollTimer);
    if (watcher) watcher.close();
  }

  if (args.once) {
    await reconcile(config.bootstrapOnPass ? 'once-bootstrap' : 'once');
    return;
  }

  fs.mkdirSync(path.dirname(config.stateFile), { recursive: true });
  watcher = fs.watch(config.docsDir, () => {
    scheduleReconcile('docs-change', Number(config.debounceMs || DEFAULT_DEBOUNCE_MS));
  });
  pollTimer = setInterval(() => {
    scheduleReconcile('poll', 0);
  }, Number(config.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  log(`watching ${config.docsDir} for owner round completion events`, true);
  if (config.bootstrapOnPass) scheduleReconcile('startup', 0);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`[owner-loop ${nowIso()}] fatal: ${String(error.message || error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildOwnerPrompt,
  extractNextAction,
  findLatestRoundResult,
  loadConfig,
  parseProjectStatus,
  parseRoundNumber,
  parseRoundResultDoc,
  shouldTriggerNextCycle,
};
