#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch (_) {
    return false;
  }
}

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('') + '-' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

const args = process.argv.slice(2);
let rootArg = '';
let forceRecover = false;
args.forEach((arg) => {
  if (arg === '--force') {
    forceRecover = true;
    return;
  }
  if (!rootArg) rootArg = arg;
});

const root = path.resolve(rootArg || process.cwd());
const dataDir = path.join(root, 'data');
const liveDataFile = path.join(dataDir, 'live-data.json');

if (!exists(path.join(root, 'morph_md_mirror'))) {
  console.error('未找到 morph_md_mirror，无法恢复。');
  process.exit(1);
}

const imported = execFileSync(
  process.execPath,
  [path.join(__dirname, 'import-markdown.js'), root],
  { encoding: 'utf8' }
);

const data = JSON.parse(imported);
const summary = {
  mode: forceRecover ? 'force-recover' : 'preview',
  wouldWrite: forceRecover,
  target: liveDataFile,
  flashThoughts: (data.flashThoughts || []).length,
  fixed: (data.fixed || []).length,
  dailyMonths: Object.keys(data.dailyMonths || {}).length,
  projects: (data.projects || []).length,
  routines: (data.routines || []).length,
  sops: (data.sops || []).length,
};

if (!forceRecover) {
  process.stdout.write(JSON.stringify(summary, null, 2));
  process.exit(0);
}

fs.mkdirSync(dataDir, { recursive: true });

let backup = '';
if (exists(liveDataFile)) {
  backup = path.join(dataDir, `live-data.recovery-backup.${timestamp()}.json`);
  fs.copyFileSync(liveDataFile, backup);
  console.error(`已备份旧数据: ${backup}`);
}

const payload = {
  source: 'recovered-from-markdown-force',
  savedAt: new Date().toISOString(),
  data,
};

fs.writeFileSync(liveDataFile, JSON.stringify(payload, null, 2), 'utf8');

process.stdout.write(JSON.stringify({
  ...summary,
  wrote: true,
  backup,
}, null, 2));
