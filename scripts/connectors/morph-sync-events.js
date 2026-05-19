const fs = require('fs');
const path = require('path');

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getSyncRevision(data) {
  const revision = Number(data?.syncMeta?.revision || 0);
  return Number.isFinite(revision) ? revision : 0;
}

function createMorphSyncEvents(deps = {}) {
  const api = deps && typeof deps === 'object' ? deps : {};
  const syncEventClients = new Map();
  let syncEventClientSeq = 0;
  let syncEventSeq = 0;
  let liveDataWatchHandle = null;
  let liveDataWatchDebounceTimer = null;

  function getLiveDataStore() {
    if (typeof api.getLiveDataStore === 'function') return api.getLiveDataStore();
    return api.liveDataStore || null;
  }

  function readCurrentLiveDataSafely() {
    const liveDataStore = getLiveDataStore();
    if (!liveDataStore || typeof liveDataStore.readCurrentLiveDataSafely !== 'function') return null;
    return liveDataStore.readCurrentLiveDataSafely();
  }

  function writeSyncSseEvent(res, eventName, payload) {
    if (!res || res.writableEnded || res.destroyed) return false;
    const safeEvent = String(eventName || 'message').trim() || 'message';
    const id = String(++syncEventSeq);
    try {
      res.write(`id: ${id}\n`);
      res.write(`event: ${safeEvent}\n`);
      res.write(`data: ${JSON.stringify(payload || {})}\n\n`);
      return true;
    } catch (_) {
      return false;
    }
  }

  function buildLiveDataSyncEventPayload(source = 'server-sync', extras = {}) {
    const current = readCurrentLiveDataSafely();
    return {
      source: String(source || 'server-sync').trim() || 'server-sync',
      changedAt: new Date().toISOString(),
      revision: getSyncRevision(current),
      lastClientWriteAt: String(current?.syncMeta?.lastClientWriteAt || '').trim(),
      lastServerWriteAt: String(current?.syncMeta?.lastServerWriteAt || '').trim(),
      deviceId: String(current?.syncMeta?.deviceId || '').trim(),
      ...cloneJson(extras),
    };
  }

  function emitLiveDataSyncEvent(eventName, payload = {}) {
    if (!syncEventClients.size) return;
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    syncEventClients.forEach((client, clientId) => {
      const ok = writeSyncSseEvent(client?.res, eventName, safePayload);
      if (!ok) {
        try { clearInterval(client?.heartbeatTimer); } catch (_) {}
        syncEventClients.delete(clientId);
      }
    });
  }

  function registerSyncEventClient(req, res) {
    const clientId = `sync-client-${Date.now()}-${++syncEventClientSeq}`;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Morpheus-Codex-Token',
      'Access-Control-Allow-Private-Network': 'true',
    });
    try { res.write(': connected\n\n'); } catch (_) {}
    const heartbeatTimer = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch (_) {
        try { clearInterval(heartbeatTimer); } catch (_) {}
        syncEventClients.delete(clientId);
      }
    }, Math.max(1000, Number(api.heartbeatMs) || 20000));
    syncEventClients.set(clientId, { res, heartbeatTimer });
    writeSyncSseEvent(res, 'hello', buildLiveDataSyncEventPayload('server-bootstrap'));
    const cleanup = () => {
      const current = syncEventClients.get(clientId);
      if (!current) return;
      try { clearInterval(current.heartbeatTimer); } catch (_) {}
      syncEventClients.delete(clientId);
    };
    req.on('close', cleanup);
    req.on('end', cleanup);
  }

  async function handleSyncEventsRequest(req, res, context = {}) {
    const url = String(context.url || req.url || '').split('?')[0];
    if (req.method !== 'GET' || url !== '/api/sync/events') return false;
    registerSyncEventClient(req, res);
    return true;
  }

  function startLiveDataWatch() {
    if (liveDataWatchHandle || typeof fs.watch !== 'function') return;
    const liveDataFile = String(api.liveDataFile || '').trim();
    if (!liveDataFile) return;
    const watchDir = path.dirname(liveDataFile);
    const watchFile = path.basename(liveDataFile);
    try {
      liveDataWatchHandle = fs.watch(watchDir, (eventType, filename) => {
        const target = typeof filename === 'string' ? filename : String(filename || '');
        if (target && target !== watchFile) return;
        clearTimeout(liveDataWatchDebounceTimer);
        liveDataWatchDebounceTimer = setTimeout(() => {
          emitLiveDataSyncEvent('live-data-changed', buildLiveDataSyncEventPayload('fs-watch', {
            eventType: String(eventType || '').trim(),
          }));
        }, 120);
      });
      liveDataWatchHandle.on('error', () => {
        try { liveDataWatchHandle.close(); } catch (_) {}
        liveDataWatchHandle = null;
      });
    } catch (error) {
      console.warn('[Morpheus sync] live-data watcher unavailable:', error?.message || error);
    }
  }

  function stopLiveDataWatch() {
    if (liveDataWatchDebounceTimer) {
      clearTimeout(liveDataWatchDebounceTimer);
      liveDataWatchDebounceTimer = null;
    }
    if (liveDataWatchHandle) {
      try { liveDataWatchHandle.close(); } catch (_) {}
      liveDataWatchHandle = null;
    }
  }

  return {
    buildLiveDataSyncEventPayload,
    emitLiveDataSyncEvent,
    handleSyncEventsRequest,
    registerSyncEventClient,
    startLiveDataWatch,
    stopLiveDataWatch,
  };
}

module.exports = {
  createMorphSyncEvents,
};
