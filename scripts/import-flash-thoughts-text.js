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

function stamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function genId() {
  return `ft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isTimestampLine(line) {
  const value = String(line || '').trim();
  if (!value) return false;
  if (/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}/.test(value)) return true;
  if (/^\d{4}年.*\d{1,2}:\d{2}$/.test(value)) return true;
  return false;
}

function normalizeText(text) {
  return String(text || '').replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
}

function parseEntries(raw) {
  const lines = raw.split('\n');
  const out = [];
  let current = null;
  let body = [];

  function flush() {
    if (!current) return;
    const text = body.join('\n').trim();
    if (text) {
      out.push({
        id: genId(),
        text,
        time: current,
      });
    }
    current = null;
    body = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (isTimestampLine(trimmed)) {
      flush();
      current = trimmed;
      continue;
    }

    if (!current) continue;

    if (trimmed === '（已剪切）' || trimmed === '(已剪切)') continue;

    if (!trimmed && body.length === 0) continue;
    body.push(line);
  }

  flush();
  return out;
}

function mergeFlashThoughts(existing, imported) {
  const seen = new Set();
  const merged = [];

  function add(item) {
    const key = `${String(item.time || '').trim()}|${normalizeText(item.text)}`;
    if (!normalizeText(item.text)) return;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  }

  for (const item of existing || []) add(item);
  for (const item of imported || []) add(item);
  return merged;
}

const root = path.resolve(process.argv[2] || process.cwd());
const textFile = path.resolve(process.argv[3] || '');
const dataFile = path.join(root, 'data', 'live-data.json');
const outputFile = process.argv[4] ? path.resolve(process.argv[4]) : dataFile;

if (!textFile || !exists(textFile)) {
  console.error('未找到导入文本文件。');
  process.exit(1);
}

if (!exists(dataFile)) {
  console.error(`未找到数据文件: ${dataFile}`);
  process.exit(1);
}

const rawData = JSON.parse(read(dataFile));
const data = rawData.data || rawData;
const imported = parseEntries(read(textFile));

let backup = '';
if (outputFile === dataFile) {
  backup = path.join(root, 'data', `live-data.flash-import-backup.${stamp()}.json`);
  fs.copyFileSync(dataFile, backup);
} else {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}

const nextData = {
  ...data,
  flashThoughts: mergeFlashThoughts(data.flashThoughts || data.fleeting || [], imported),
};

const nextRaw = rawData.data ? {
  ...rawData,
  source: 'native-sync',
  savedAt: new Date().toISOString(),
  data: nextData,
} : nextData;

fs.writeFileSync(outputFile, JSON.stringify(nextRaw, null, 2), 'utf8');

process.stdout.write(JSON.stringify({
  imported: imported.length,
  flashThoughts: nextData.flashThoughts.length,
  backup,
  target: outputFile,
}, null, 2));
