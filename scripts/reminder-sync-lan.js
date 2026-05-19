#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8787);
const STORE_FILE = process.env.REMINDER_SYNC_FILE
  ? path.resolve(process.env.REMINDER_SYNC_FILE)
  : path.resolve(__dirname, '../data/reminder-sync-lan.json');
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) {}
  return fallback;
}

function writeJson(filePath, payload) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function normalizeReminder(item) {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id || '').trim();
  const text = String(item.text || '').trim();
  const dueAtMs = Number(item.dueAtMs);
  if (!id || !text || !Number.isFinite(dueAtMs)) return null;
  const createdAt = String(item.createdAt || '').trim() || new Date().toISOString();
  const updatedAt = String(item.updatedAt || '').trim() || createdAt;
  const requestText = String(item.requestText || item.detailText || item.text || '').trim() || text;
  const status = String(item.status || 'pending').trim() || 'pending';
  const notifiedAt = String(item.notifiedAt || '').trim();
  const dailyLogDismissed = item.dailyLogDismissed === true;
  const dailyLogDismissedAt = String(item.dailyLogDismissedAt || '').trim();
  const notificationOwnerPlatform = String(item.notificationOwnerPlatform || item.ownerPlatform || '').trim().toLowerCase();
  return {
    id,
    text,
    requestText,
    dueAtMs,
    dueAtText: String(item.dueAtText || '').trim(),
    timezone: String(item.timezone || 'Asia/Shanghai').trim() || 'Asia/Shanghai',
    source: String(item.source || 'sync').trim() || 'sync',
    notificationOwnerPlatform: (notificationOwnerPlatform === 'ios' || notificationOwnerPlatform === 'macos') ? notificationOwnerPlatform : '',
    status,
    notifiedAt,
    dailyLogDismissed,
    dailyLogDismissedAt: dailyLogDismissed ? dailyLogDismissedAt : '',
    createdAt,
    updatedAt,
  };
}

function stampMs(item) {
  if (!item || typeof item !== 'object') return 0;
  const updated = Date.parse(String(item.updatedAt || ''));
  if (Number.isFinite(updated) && updated > 0) return updated;
  const notifiedAt = Date.parse(String(item.notifiedAt || ''));
  if (Number.isFinite(notifiedAt) && notifiedAt > 0) return notifiedAt;
  const dismissedAt = Date.parse(String(item.dailyLogDismissedAt || ''));
  if (Number.isFinite(dismissedAt) && dismissedAt > 0) return dismissedAt;
  const created = Date.parse(String(item.createdAt || ''));
  if (Number.isFinite(created) && created > 0) return created;
  const dueAtMs = Number(item.dueAtMs || 0);
  return Number.isFinite(dueAtMs) ? dueAtMs : 0;
}

function mergeReminders(base = [], incoming = []) {
  const byId = new Map();
  base.forEach((item) => {
    const normalized = normalizeReminder(item);
    if (!normalized) return;
    byId.set(normalized.id, normalized);
  });
  incoming.forEach((item) => {
    const normalized = normalizeReminder(item);
    if (!normalized) return;
    const current = byId.get(normalized.id);
    if (!current || stampMs(normalized) >= stampMs(current)) {
      byId.set(normalized.id, normalized);
    }
  });
  return Array.from(byId.values()).sort((a, b) => Number(a.dueAtMs || 0) - Number(b.dueAtMs || 0));
}

function loadStore() {
  const fallback = { revision: 0, reminders: [], updatedAt: '' };
  const store = readJson(STORE_FILE, fallback);
  if (!store || typeof store !== 'object') return fallback;
  return {
    revision: Number.isFinite(store.revision) ? store.revision : 0,
    reminders: Array.isArray(store.reminders) ? store.reminders.map(normalizeReminder).filter(Boolean) : [],
    updatedAt: String(store.updatedAt || ''),
  };
}

function saveStore(store) {
  writeJson(STORE_FILE, store);
}

async function handleSync(req, res) {
  try {
    const raw = await readBody(req);
    const payload = raw ? JSON.parse(raw) : {};
    const incoming = Array.isArray(payload?.reminders) ? payload.reminders : [];
    const store = loadStore();
    const merged = mergeReminders(store.reminders, incoming);
    const changed = JSON.stringify(merged) !== JSON.stringify(store.reminders);
    const nextStore = changed
      ? { revision: store.revision + 1, reminders: merged, updatedAt: new Date().toISOString() }
      : store;
    if (changed) saveStore(nextStore);
    sendJson(res, 200, {
      ok: true,
      revision: nextStore.revision,
      updatedAt: nextStore.updatedAt,
      reminders: nextStore.reminders,
      count: nextStore.reminders.length,
    });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || 'sync failed' });
  }
}

function createServer() {
  return http.createServer((req, res) => {
    const pathname = (req.url || '').split('?')[0];
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }
    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'reminder-sync-lan',
        now: new Date().toISOString(),
        file: STORE_FILE,
      });
      return;
    }
    if (req.method === 'POST' && pathname === '/api/reminders-sync') {
      handleSync(req, res);
      return;
    }
    sendJson(res, 404, { ok: false, error: 'Not found' });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`[ReminderSync] listening on http://${HOST}:${PORT}`);
    console.log('[ReminderSync] POST /api/reminders-sync');
    console.log(`[ReminderSync] store file: ${STORE_FILE}`);
  });
}

module.exports = {
  normalizeReminder,
  stampMs,
  mergeReminders,
  loadStore,
  saveStore,
  handleSync,
  createServer,
};
