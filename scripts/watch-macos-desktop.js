#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const appDir = path.join(repoRoot, 'macos-app');

const watchRoots = [
  path.join(repoRoot, 'morph.html'),
  path.join(repoRoot, 'assets'),
  path.join(repoRoot, 'scripts'),
  path.join(appDir, 'Package.swift'),
  path.join(appDir, 'Sources'),
];

const ignorePatterns = [
  `${path.sep}.git${path.sep}`,
  `${path.sep}.build${path.sep}`,
  `${path.sep}morph_md_mirror${path.sep}`,
  `${path.sep}data${path.sep}live-data.json`,
  `${path.sep}.DS_Store`,
];

let child = null;
let restarting = false;
let lastSig = '';
let booted = false;
let starting = false;
const lockFile = '/tmp/morph-macos-watch.lock';

function isPidAlive(pid) {
  if (!pid || !Number.isInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

function acquireWatcherLock() {
  try {
    if (fs.existsSync(lockFile)) {
      const raw = fs.readFileSync(lockFile, 'utf8').trim();
      const pid = Number(raw);
      if (isPidAlive(pid) && pid !== process.pid) {
        process.stdout.write(`[watch] 已有 watcher 在运行 (pid=${pid})，本次退出。\n`);
        process.exit(0);
      }
    }
    fs.writeFileSync(lockFile, String(process.pid));
  } catch (err) {
    process.stdout.write(`[watch] lock 处理失败: ${err.message}\n`);
  }
}

function releaseWatcherLock() {
  try {
    if (fs.existsSync(lockFile)) {
      const raw = fs.readFileSync(lockFile, 'utf8').trim();
      if (Number(raw) === process.pid) fs.unlinkSync(lockFile);
    }
  } catch (_) {}
}

function shouldIgnore(p) {
  return ignorePatterns.some((token) => p.includes(token));
}

function walkSignature(targetPath, acc) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  if (shouldIgnore(targetPath)) return;

  if (stat.isFile()) {
    acc.push(`${targetPath}:${stat.mtimeMs}:${stat.size}`);
    return;
  }
  if (!stat.isDirectory()) return;

  const entries = fs.readdirSync(targetPath);
  for (const name of entries) {
    walkSignature(path.join(targetPath, name), acc);
  }
}

function getSignature() {
  const acc = [];
  for (const root of watchRoots) walkSignature(root, acc);
  acc.sort();
  return acc.join('\n');
}

function log(msg) {
  const t = new Date().toLocaleTimeString();
  process.stdout.write(`[watch ${t}] ${msg}\n`);
}

function quitExistingAppInstances() {
  // Best-effort quit to avoid duplicate windows when multiple restarts happen.
  try {
    execFileSync('osascript', ['-e', 'tell application "Morph" to quit'], { stdio: 'ignore' });
  } catch (_) {}
  try {
    execFileSync('killall', ['Morph'], { stdio: 'ignore' });
  } catch (_) {}
}

function startApp() {
  if (starting) return;
  starting = true;
  quitExistingAppInstances();
  log('启动 macOS App (swift run)');
  child = spawn('swift', ['run', 'Morph'], {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, MORPH_REPO_ROOT: repoRoot, LIANXING_REPO_ROOT: repoRoot },
  });

  child.on('exit', (code, signal) => {
    log(`App 进程退出 (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    child = null;
    starting = false;
    if (!restarting && booted) {
      // App 被手动关闭时 watcher 继续存在，不自动拉起，等待文件变更再重启
    }
  });

  booted = true;
}

function stopAppForRestart(reason) {
  if (!child) {
    log(`检测到变更，准备启动 (${reason})`);
    startApp();
    return;
  }

  restarting = true;
  log(`检测到变更，重启 App (${reason})`);
  const proc = child;
  const timer = setTimeout(() => {
    if (proc && !proc.killed) {
      try { proc.kill('SIGKILL'); } catch (_) {}
    }
  }, 4000);

  proc.once('exit', () => {
    clearTimeout(timer);
    restarting = false;
    startApp();
  });

  try {
    proc.kill('SIGTERM');
  } catch (_) {
    clearTimeout(timer);
    restarting = false;
    startApp();
  }
}

function poll() {
  try {
    const sig = getSignature();
    if (!lastSig) {
      lastSig = sig;
      startApp();
      return;
    }
    if (sig !== lastSig) {
      lastSig = sig;
      stopAppForRestart('文件修改');
    }
  } catch (err) {
    log(`watch 失败: ${err.message}`);
  }
}

process.on('SIGINT', () => {
  log('停止 watcher');
  releaseWatcherLock();
  if (child) {
    try { child.kill('SIGTERM'); } catch (_) {}
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  releaseWatcherLock();
  if (child) {
    try { child.kill('SIGTERM'); } catch (_) {}
  }
  process.exit(0);
});

acquireWatcherLock();
log('开始监听文件变更');
poll();
setInterval(poll, 1200);
