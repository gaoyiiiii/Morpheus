(function initMorphNativeBootstrapTransferEarly() {
  if (typeof window === 'undefined') return;
  if (window.__MorphNativeBootstrapTransferEarlyInstalled === true) return;
  window.__MorphNativeBootstrapTransferEarlyInstalled = true;
  window.__LianXingNativeBootstrapTransferEarlyInstalled = true;

  const STORAGE_KEYS = {
    data: 'lianxing_mono_v18',
    startupSnapshot: 'morph_startup_snapshot_v1',
    syncRootCache: 'morph_native_sync_root_cache_v1',
    trustedBootstrap: 'morph_trusted_native_bootstrap_v1',
    lastRestoreAtMorph: 'morph_last_restore_at',
    lastRestoreAtLegacy: 'lianxing_last_restore_at',
  };

  let transferState = null;

  function safeSetLocalStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function safeSetSessionStorage(key, value) {
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function normalizeTransferMeta(meta) {
    const src = meta && typeof meta === 'object' ? meta : {};
    const totalChunks = Math.max(0, Number(src.totalChunks || 0));
    return {
      totalChunks,
      syncRootPath: String(src.syncRootPath || '').trim(),
      platform: String(src.platform || '').trim(),
      forceApply: src.forceApply === true,
    };
  }

  function ensureTransferState() {
    if (transferState && typeof transferState === 'object') return transferState;
    transferState = {
      chunks: [],
      meta: normalizeTransferMeta({}),
    };
    return transferState;
  }

  function normalizeIncomingBootstrapData(raw = null) {
    const source = raw && typeof raw === 'object' ? raw : null;
    if (!source) return null;
    if (source.data && typeof source.data === 'object') return source.data;
    if (source.envelope && source.envelope.data && typeof source.envelope.data === 'object') {
      return source.envelope.data;
    }
    return source;
  }

  function persistBootstrapData(dataObject, meta = {}) {
    const safe = normalizeIncomingBootstrapData(dataObject);
    if (!safe || typeof safe !== 'object') return false;
    let payloadText = '';
    try {
      payloadText = JSON.stringify(safe);
    } catch (_) {
      return false;
    }
    if (!payloadText) return false;
    safeSetLocalStorage(STORAGE_KEYS.data, payloadText);
    safeSetLocalStorage(STORAGE_KEYS.startupSnapshot, payloadText);

    const syncRootPath = String(
      meta.syncRootPath
      || window.__MorphNativePendingSyncRootPath
      || window.__LianXingNativePendingSyncRootPath
      || ''
    ).trim();
    if (syncRootPath) {
      safeSetLocalStorage(STORAGE_KEYS.syncRootCache, JSON.stringify({
        path: syncRootPath,
        platform: String(meta.platform || '').trim() || 'native',
      }));
      safeSetLocalStorage(STORAGE_KEYS.trustedBootstrap, JSON.stringify({
        path: syncRootPath,
        appliedAt: new Date().toISOString(),
        fingerprint: '',
      }));
      try {
        window.__MorphNativePendingSyncRootPath = syncRootPath;
        window.__LianXingNativePendingSyncRootPath = syncRootPath;
      } catch (_) {}
    }

    const now = new Date().toISOString();
    safeSetLocalStorage(STORAGE_KEYS.lastRestoreAtMorph, now);
    safeSetLocalStorage(STORAGE_KEYS.lastRestoreAtLegacy, now);
    safeSetSessionStorage('__morph_native_bootstrap_done', '1');
    safeSetSessionStorage('__lianxing_native_bootstrap_done', '1');

    try {
      const cachePayload = {
        ok: true,
        source: 'native-transfer-early',
        platform: String(meta.platform || '').trim() || 'native',
        generatedAt: now,
        envelope: { data: safe },
      };
      window.__MORPH_BOOTSTRAP_CACHE = cachePayload;
      window.__LianXingBootstrapCache = cachePayload;
      const bootstrapNode = document.getElementById('morph-bootstrap-cache-data');
      if (bootstrapNode) bootstrapNode.textContent = JSON.stringify(cachePayload);
    } catch (_) {}
    return true;
  }

  function beginBootstrapTransfer(meta) {
    const normalizedMeta = normalizeTransferMeta(meta);
    transferState = {
      chunks: new Array(normalizedMeta.totalChunks),
      meta: normalizedMeta,
    };
    return true;
  }

  function appendBootstrapTransferChunk(index, chunk) {
    const state = ensureTransferState();
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0) return false;
    state.chunks[idx] = typeof chunk === 'string' ? chunk : String(chunk || '');
    return true;
  }

  function finishBootstrapTransfer() {
    const state = ensureTransferState();
    const chunks = Array.isArray(state.chunks) ? state.chunks : [];
    if (!chunks.length) return false;
    if (chunks.some((item) => typeof item !== 'string')) return false;
    const payloadText = chunks.join('');
    transferState = null;
    if (!payloadText) return false;
    let parsed = null;
    try {
      parsed = JSON.parse(payloadText);
    } catch (_) {
      return false;
    }
    return persistBootstrapData(parsed, state.meta || {});
  }

  if (typeof window.MorphBeginBootstrapTransfer !== 'function') {
    window.MorphBeginBootstrapTransfer = beginBootstrapTransfer;
  }
  if (typeof window.LianXingBeginBootstrapTransfer !== 'function') {
    window.LianXingBeginBootstrapTransfer = beginBootstrapTransfer;
  }
  if (typeof window.MorphAppendBootstrapTransferChunk !== 'function') {
    window.MorphAppendBootstrapTransferChunk = appendBootstrapTransferChunk;
  }
  if (typeof window.LianXingAppendBootstrapTransferChunk !== 'function') {
    window.LianXingAppendBootstrapTransferChunk = appendBootstrapTransferChunk;
  }
  if (typeof window.MorphFinishBootstrapTransfer !== 'function') {
    window.MorphFinishBootstrapTransfer = finishBootstrapTransfer;
  }
  if (typeof window.LianXingFinishBootstrapTransfer !== 'function') {
    window.LianXingFinishBootstrapTransfer = finishBootstrapTransfer;
  }
})();
