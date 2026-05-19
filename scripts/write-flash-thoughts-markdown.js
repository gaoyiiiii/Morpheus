#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch (_) {
    return false;
  }
}

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, 'utf8');
}

function isTimestampLine(line) {
  const value = String(line || '').trim();
  if (!value) return false;
  if (/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}/.test(value)) return true;
  if (/^\d{4}年.*\d{1,2}:\d{2}$/.test(value)) return true;
  return false;
}

function parseEntries(raw) {
  const lines = raw.split('\n');
  const out = [];
  let currentTime = null;
  let body = [];

  function flush() {
    if (!currentTime) return;
    const text = body.join('\n').trim();
    if (text) {
      out.push({ time: currentTime, text });
    }
    currentTime = null;
    body = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (isTimestampLine(trimmed)) {
      flush();
      currentTime = trimmed;
      continue;
    }

    if (!currentTime) continue;
    if (trimmed === '（已剪切）' || trimmed === '(已剪切)') continue;
    if (!trimmed && body.length === 0) continue;
    body.push(line);
  }

  flush();
  return out;
}

function formatThoughtList(title, items) {
  const lines = [`# ${title}`, '', `共 ${items.length} 条`, ''];
  if (!items.length) {
    lines.push('_暂无内容_', '');
    return lines.join('\n');
  }

  items.forEach((item, idx) => {
    const firstLine = String(item.text || '').split('\n')[0] || '未命名念头';
    lines.push(`## ${idx + 1}. ${item.time ? `[${item.time}] ` : ''}${firstLine}`);
    lines.push('');
    lines.push(String(item.text || ''));
    lines.push('', '---', '');
  });

  return lines.join('\n');
}

const root = path.resolve(process.argv[2] || process.cwd());
const textFile = path.resolve(process.argv[3] || '');
if (!textFile || !exists(textFile)) {
  console.error('未找到导入文本文件。');
  process.exit(1);
}

const entries = parseEntries(read(textFile));
const mirrorRoot = path.join(root, 'morph_md_mirror');
const flashFile = path.join(mirrorRoot, '闪念', '总览.md');
const legacyFile = path.join(mirrorRoot, 'flash-thoughts', 'FLASH_THOUGHTS.md');
const fleetingLegacyFile = path.join(mirrorRoot, 'fleeting', 'FLEETING.md');

writeFile(flashFile, formatThoughtList('闪念', entries));
writeFile(legacyFile, formatThoughtList('闪念 (Flash Thoughts)', entries));
writeFile(fleetingLegacyFile, formatThoughtList('闪念 (Flash Thoughts)', entries));

process.stdout.write(JSON.stringify({
  entries: entries.length,
  flashFile,
  legacyFile,
  fleetingLegacyFile,
}, null, 2));
