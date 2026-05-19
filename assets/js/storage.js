(function () {
  if (typeof window !== 'undefined') {
    window.__MorphStorageScriptLoaded = true;
    window.__LianXingStorageScriptLoaded = true;
    if (typeof window.__MORPH_DEV_EXPOSE_RAW_FAILURES !== 'boolean') {
      window.__MORPH_DEV_EXPOSE_RAW_FAILURES = false;
    }
    if (typeof window.__LianXingDevExposeRawFailures !== 'boolean') {
      window.__LianXingDevExposeRawFailures = window.__MORPH_DEV_EXPOSE_RAW_FAILURES;
    }
  }
  const MORPH_DEV_EXPOSE_RAW_FAILURES = false;
  const STORAGE_KEYS = {
    data: 'lianxing_mono_v18',
    startupSnapshot: 'morph_startup_snapshot_v1',
    editorHistory: 'morph_editor_history_local_v1',
    editorHistoryCursor: 'morph_editor_history_cursor_local_v1',
    webSyncRootMeta: 'morph_web_sync_root_meta_v1',
    theme: 'lianxing_theme',
    apiKey: 'lianxing_api_key',
    openRouterApiKey: 'lianxing_openrouter_api_key',
    glmApiKey: 'lianxing_glm_api_key',
    doubaoApiKey: 'lianxing_doubao_api_key',
    qwenApiKey: 'lianxing_qwen_api_key',
    kimiApiKey: 'lianxing_kimi_api_key',
    codexApiKey: 'lianxing_codex_api_key',
    codexBaseUrl: 'lianxing_codex_base_url',
    codexModel: 'lianxing_codex_model',
    aiProvider: 'lianxing_ai_provider',
    ttsProvider: 'lianxing_tts_provider',
    cosyVoiceEndpoint: 'lianxing_cosyvoice_endpoint',
    cosyVoiceSpeaker: 'lianxing_cosyvoice_speaker',
    aiAutoSpeak: 'lianxing_ai_auto_speak',
    dailyAlignEnabled: 'lianxing_daily_align_enabled',
    dailyAlignTime: 'lianxing_daily_align_time',
    dailyAlignPrompt: 'lianxing_daily_align_prompt',
    dailyAlignLastRunDate: 'lianxing_daily_align_last_run_date',
    lastSyncAt: 'lianxing_last_sync_at',
    lastRestoreAt: 'lianxing_last_restore_at',
    syncDeviceId: 'morph_sync_device_id_v1',
    syncMutationJournal: 'morph_sync_mutation_journal_v1',
    syncAckRevision: 'morph_sync_ack_revision_v1',
    syncLastReceipt: 'morph_sync_last_receipt_v1',
  };
  const MORPH_SSOT_CONTRACT_VERSION = '2026-03-30.round-06';
  const MORPH_STARTUP_STORAGE_DESCRIPTOR_VERSION = 'startup-storage.v1';
  let pendingLocalCacheWrite = null;
  let localCacheWriteTimer = null;
  let localCacheWriteTimerMode = '';
  const EDITOR_HISTORY_MAX_ENTRIES_PER_SCOPE = 12;
  const EDITOR_HISTORY_EMPTY = Object.freeze({
    daily: Object.freeze({}),
    project: Object.freeze({}),
  });
  const WEB_SYNC_ROOT_DB_NAME = 'morph_web_sync_root_db_v1';
  const WEB_SYNC_ROOT_DB_VERSION = 1;
  const WEB_SYNC_ROOT_STORE_NAME = 'handles';
  const WEB_SYNC_ROOT_HANDLE_ID = 'sync-root';
  const WEB_SYNC_ROOT_LIVE_DATA_CANDIDATES = ['data/live-data.json', 'live-data.json'];
  let webSyncRootHandleLoadPromise = null;
  let webSyncRootHandlePersistPromise = null;
  let webSyncRootRuntimeState = {
    mode: '',
    handle: null,
    files: null,
    pathLabel: '',
    rootName: '',
    fileCount: 0,
    readable: false,
    writable: false,
    persisted: false,
    selectedAt: '',
    pathPrefix: '',
    liveDataRelativePath: '',
  };
  let webSyncSnapshotTimer = null;
  let webSyncSnapshotQueuedData = null;
  let webSyncSnapshotQueuedHint = null;
  let webSyncWarned = false;
  const PERSISTED_AI_CHAT_MAX_SESSIONS = 24;
  const PERSISTED_AI_CHAT_MAX_MESSAGES = 80;
  const SYNC_JOURNAL_AI_CHAT_MAX_SESSIONS = 8;
  const SYNC_JOURNAL_AI_CHAT_MAX_MESSAGES = 24;
  const STARTUP_SNAPSHOT_AI_CHAT_MAX_SESSIONS = 8;
  const STARTUP_SNAPSHOT_AI_CHAT_MAX_MESSAGES = 24;
  const STARTUP_SNAPSHOT_REFERENCE_VERSION = 1;
  const STARTUP_SNAPSHOT_REFERENCE_KIND = 'morph-startup-snapshot-reference';
  let aiSessionStateRuntimeModules = null;
  let startupStorageRuntimeModules = null;
  let fallbackStartupStorageRuntimeModules = null;
  let syncRuntimeModules = null;
  let deferredAuthoritativePersistData = null;
  let deferredAuthoritativePersistHint = null;
  let deferredAuthoritativePersistTimer = null;
  const NORMALIZED_DATA_SNAPSHOT_FLAG = '__morphNormalizedDataSnapshot';

  function getAISessionStateRuntimeModules() {
    if (aiSessionStateRuntimeModules) return aiSessionStateRuntimeModules;
    const factory = window.MorphAISessionStateRuntime && typeof window.MorphAISessionStateRuntime.create === 'function'
      ? window.MorphAISessionStateRuntime.create
      : null;
    if (!factory) return null;
    aiSessionStateRuntimeModules = factory();
    return aiSessionStateRuntimeModules;
  }

  function getDefaultAISessionStateCore() {
    const sessionRuntime = getAISessionStateRuntimeModules();
    return sessionRuntime && typeof sessionRuntime.buildDefaultAISessionStateCore === 'function'
      ? sessionRuntime.buildDefaultAISessionStateCore()
      : {
          currentTaskState: {
            summary: '',
            lastUserIntent: '',
            nextStep: '',
            lastActionLabels: [],
            updatedAt: '',
          },
          currentWorkflowState: {
            type: '',
            step: '',
            targetName: '',
            summary: '',
            updatedAt: '',
          },
          chatSessions: [],
          currentChatSessionId: '',
        };
  }

  function getStartupStorageRuntimeModules() {
    if (startupStorageRuntimeModules) return startupStorageRuntimeModules;
    const factory = window.MorphStartupStorageRuntime && typeof window.MorphStartupStorageRuntime.create === 'function'
      ? window.MorphStartupStorageRuntime.create
      : null;
    if (factory) {
      startupStorageRuntimeModules = factory({
        contractVersion: MORPH_SSOT_CONTRACT_VERSION,
        readBootstrapCacheEntry,
        readBootstrapCacheData,
        loadStartupSnapshotData,
      });
      return startupStorageRuntimeModules;
    }
    if (fallbackStartupStorageRuntimeModules) return fallbackStartupStorageRuntimeModules;
    fallbackStartupStorageRuntimeModules = createFallbackStartupStorageRuntimeModules();
    startupStorageRuntimeModules = fallbackStartupStorageRuntimeModules;
    return startupStorageRuntimeModules;
  }

  function createFallbackStartupStorageRuntimeModules() {
    let cachedAuthoritativeStartupEntry = null;

    function buildSingleSourceOfTruthDescriptor() {
      return {
        contractVersion: MORPH_SSOT_CONTRACT_VERSION,
        migrationState: 'boundary-landed',
        canonicalStore: {
          kind: 'live-data-json',
          relativePath: 'data/live-data.json',
          role: 'authoritative-user-store',
          owner: 'core-data',
        },
        authoritativeWritePath: {
          strategy: 'full-snapshot-commit',
          allowedWriters: ['server-sync', 'native-sync'],
        },
        cacheReplicas: [
          {
            kind: 'browser-local-storage',
            location: 'localStorage:lianxing_mono_v18',
            role: 'bootstrap-cache',
          },
          {
            kind: 'bootstrap-cache',
            location: 'app-bootstrap-cache',
            role: 'bootstrap-cache',
          },
          {
            kind: 'startup-snapshot',
            location: 'startup-snapshot',
            role: 'startup-read-model',
          },
        ],
        derivedReplicas: [
          {
            kind: 'markdown-mirror',
            location: 'morph_md_mirror/',
            role: 'derived-mirror',
          },
          {
            kind: 'live-data-shards',
            location: 'data/shards/',
            role: 'derived-shard-index',
          },
        ],
      };
    }

    function normalizeBootstrapSource(value = '', source = '') {
      const normalized = String(value || '').trim();
      if (normalized) return normalized;
      if (source === 'bootstrap-cache') return 'server-bootstrap-cache';
      if (source === 'startup-snapshot') return 'startup-snapshot-fallback';
      return 'local-cache-fallback';
    }

    function buildStartupStorageDescriptor(source, data, options = {}) {
      const providedDescriptor = options.providedDescriptor && typeof options.providedDescriptor === 'object'
        ? options.providedDescriptor
        : null;
      const storageTopology = providedDescriptor?.storageTopology && typeof providedDescriptor.storageTopology === 'object'
        ? providedDescriptor.storageTopology
        : buildSingleSourceOfTruthDescriptor();
      const normalizedSource = String(source || '').trim();
      const revision = Number(data?.syncMeta?.revision || 0);
      const lastWriteAt = String(
        data?.syncMeta?.lastClientWriteAt
        || data?.syncMeta?.lastServerWriteAt
        || data?.syncMeta?.updatedAt
        || ''
      ).trim();
      return {
        descriptorVersion: String(providedDescriptor?.descriptorVersion || MORPH_STARTUP_STORAGE_DESCRIPTOR_VERSION).trim() || MORPH_STARTUP_STORAGE_DESCRIPTOR_VERSION,
        contractVersion: String(providedDescriptor?.contractVersion || MORPH_SSOT_CONTRACT_VERSION).trim() || MORPH_SSOT_CONTRACT_VERSION,
        bootstrapSource: normalizeBootstrapSource(providedDescriptor?.bootstrapSource || options.bootstrapSource, normalizedSource),
        migrationState: String(providedDescriptor?.migrationState || storageTopology?.migrationState || '').trim(),
        storageTopology,
        canonicalStore: providedDescriptor?.canonicalStore && typeof providedDescriptor.canonicalStore === 'object'
          ? providedDescriptor.canonicalStore
          : (storageTopology?.canonicalStore || null),
        authoritativeWritePath: providedDescriptor?.authoritativeWritePath && typeof providedDescriptor.authoritativeWritePath === 'object'
          ? providedDescriptor.authoritativeWritePath
          : (storageTopology?.authoritativeWritePath || null),
        cacheReplicas: Array.isArray(providedDescriptor?.cacheReplicas)
          ? providedDescriptor.cacheReplicas
          : (Array.isArray(storageTopology?.cacheReplicas) ? storageTopology.cacheReplicas : []),
        derivedReplicas: Array.isArray(providedDescriptor?.derivedReplicas)
          ? providedDescriptor.derivedReplicas
          : (Array.isArray(storageTopology?.derivedReplicas) ? storageTopology.derivedReplicas : []),
        authoritativeSnapshot: {
          source: normalizedSource,
          revision: Number.isFinite(revision) ? revision : 0,
          lastWriteAt,
          hasUserData: !!data,
        },
      };
    }

    function countStartupScheduleMvpRecords(state = null) {
      const source = state && typeof state === 'object' ? state : {};
      const countFlatBucket = (bucket = null) => (bucket && typeof bucket === 'object' ? Object.keys(bucket).length : 0);
      const exerciseCount = Object.values(source.exercise && typeof source.exercise === 'object' ? source.exercise : {})
        .reduce((sum, days) => sum + countFlatBucket(days), 0);
      const customDoneCount = Object.values(source.customDone && typeof source.customDone === 'object' ? source.customDone : {})
        .reduce((sum, days) => sum + countFlatBucket(days), 0);
      return countFlatBucket(source.video) + countFlatBucket(source.review) + countFlatBucket(source.sleep) + exerciseCount + (Array.isArray(source.custom) ? source.custom.length : 0) + customDoneCount + (Array.isArray(source.cardOrder) ? source.cardOrder.length : 0);
    }

    function mergeScheduleRhythmCardOrderFields(left = null, right = null) {
      const leftOrder = Array.isArray(left?.cardOrder) ? left.cardOrder : [];
      const rightOrder = Array.isArray(right?.cardOrder) ? right.cardOrder : [];
      const leftAt = Date.parse(String(left?.cardOrderUpdatedAt || '').trim() || '') || 0;
      const rightAt = Date.parse(String(right?.cardOrderUpdatedAt || '').trim() || '') || 0;
      if (rightOrder.length && (!leftOrder.length || rightAt >= leftAt || (!leftAt && !rightAt))) {
        return {
          cardOrder: rightOrder,
          cardOrderUpdatedAt: String(right?.cardOrderUpdatedAt || left?.cardOrderUpdatedAt || '').trim(),
        };
      }
      return {
        cardOrder: leftOrder,
        cardOrderUpdatedAt: String(left?.cardOrderUpdatedAt || right?.cardOrderUpdatedAt || '').trim(),
      };
    }

    function mergeStartupScheduleMvpState(preferred = null, supplemental = null) {
      const base = sanitizeScheduleMvpState(preferred, { includeDefaults: false });
      const extra = sanitizeScheduleMvpState(supplemental, { includeDefaults: false });
      const mergeFlatBucket = (left = {}, right = {}) => ({ ...(left && typeof left === 'object' ? left : {}), ...(right && typeof right === 'object' ? right : {}) });
      const exercise = mergeFlatBucket(base.exercise, null);
      Object.entries(extra.exercise && typeof extra.exercise === 'object' ? extra.exercise : {}).forEach(([weekKey, days]) => {
        exercise[weekKey] = mergeFlatBucket(exercise[weekKey], days);
      });
      const customMap = new Map();
      [...(Array.isArray(base.custom) ? base.custom : []), ...(Array.isArray(extra.custom) ? extra.custom : [])].forEach((item) => {
        if (item?.id) customMap.set(String(item.id), item);
      });
      const customDone = mergeFlatBucket(base.customDone, null);
      Object.entries(extra.customDone && typeof extra.customDone === 'object' ? extra.customDone : {}).forEach(([id, days]) => {
        customDone[id] = mergeFlatBucket(customDone[id], days);
      });
      const exerciseAt = mergeFlatBucket(base.exerciseAt, null);
      Object.entries(extra.exerciseAt && typeof extra.exerciseAt === 'object' ? extra.exerciseAt : {}).forEach(([weekKey, days]) => {
        exerciseAt[weekKey] = mergeFlatBucket(exerciseAt[weekKey], days);
      });
      const customDoneAt = mergeFlatBucket(base.customDoneAt, null);
      Object.entries(extra.customDoneAt && typeof extra.customDoneAt === 'object' ? extra.customDoneAt : {}).forEach(([id, days]) => {
        customDoneAt[id] = mergeFlatBucket(customDoneAt[id], days);
      });
      return {
        video: mergeFlatBucket(base.video, extra.video),
        review: mergeFlatBucket(base.review, extra.review),
        reviewAt: mergeFlatBucket(base.reviewAt, extra.reviewAt),
        sleep: mergeFlatBucket(base.sleep, extra.sleep),
        sleepAt: mergeFlatBucket(base.sleepAt, extra.sleepAt),
        exercise,
        exerciseAt,
        custom: Array.from(customMap.values()),
        customDone,
        customDoneAt,
        cardOverrides: mergeFlatBucket(base.cardOverrides, extra.cardOverrides),
        ...mergeScheduleRhythmCardOrderFields(base, extra),
        updatedAt: base.updatedAt || extra.updatedAt || '',
      };
    }

    function attachMergedStartupScheduleMvp(preferred = null, other = null) {
      if (!preferred?.data || !other?.data) return preferred;
      const otherCount = countStartupScheduleMvpRecords(other.data.scheduleMvp);
      if (otherCount <= 0) return preferred;
      const mergedScheduleMvp = mergeStartupScheduleMvpState(preferred.data.scheduleMvp, other.data.scheduleMvp);
      if (JSON.stringify(mergedScheduleMvp) === JSON.stringify(sanitizeScheduleMvpState(preferred.data.scheduleMvp, { includeDefaults: false }))) {
        return preferred;
      }
      const nextData = JSON.parse(JSON.stringify(preferred.data));
      nextData.scheduleMvp = mergedScheduleMvp;
      return {
        ...preferred,
        data: nextData,
      };
    }

    function choosePreferredStartupEntry(primary = null, secondary = null) {
      const left = primary && typeof primary === 'object' ? primary : null;
      const right = secondary && typeof secondary === 'object' ? secondary : null;
      const leftHasData = !!(left && left.data);
      const rightHasData = !!(right && right.data);
      if (leftHasData && !rightHasData) return left;
      if (rightHasData && !leftHasData) return right;
      if (!leftHasData && !rightHasData) return left || right || null;
      const leftRevision = Number(left?.data?.syncMeta?.revision || 0);
      const rightRevision = Number(right?.data?.syncMeta?.revision || 0);
      if (leftRevision !== rightRevision) {
        const winner = leftRevision > rightRevision ? left : right;
        const loser = winner === left ? right : left;
        return attachMergedStartupScheduleMvp(winner, loser);
      }
      const leftWriteAt = Date.parse(String(left?.data?.syncMeta?.lastClientWriteAt || left?.data?.syncMeta?.lastServerWriteAt || '')) || 0;
      const rightWriteAt = Date.parse(String(right?.data?.syncMeta?.lastClientWriteAt || right?.data?.syncMeta?.lastServerWriteAt || '')) || 0;
      if (leftWriteAt !== rightWriteAt) {
        const winner = leftWriteAt > rightWriteAt ? left : right;
        const loser = winner === left ? right : left;
        return attachMergedStartupScheduleMvp(winner, loser);
      }
      if (String(right?.source || '').trim() === 'startup-snapshot') return attachMergedStartupScheduleMvp(right, left);
      if (String(left?.source || '').trim() === 'startup-snapshot') return attachMergedStartupScheduleMvp(left, right);
      return attachMergedStartupScheduleMvp(left, right);
    }

    function resolveAuthoritativeStartupEntry() {
      if (cachedAuthoritativeStartupEntry && typeof cachedAuthoritativeStartupEntry === 'object') {
        return cachedAuthoritativeStartupEntry;
      }
      const bootstrapEntry = readBootstrapCacheEntry();
      const startupSnapshot = loadStartupSnapshotData();
      const bootstrapDescriptorEntry = bootstrapEntry?.data ? (() => {
        const startupDescriptor = buildStartupStorageDescriptor('bootstrap-cache', bootstrapEntry.data, {
          bootstrapSource: bootstrapEntry.bootstrapSource,
          providedDescriptor: bootstrapEntry.startupDescriptor,
        });
        return {
          data: bootstrapEntry.data,
          source: 'bootstrap-cache',
          bootstrapSource: startupDescriptor.bootstrapSource,
          startupDescriptor,
        };
      })() : null;
      const startupSnapshotEntry = startupSnapshot ? (() => {
        const startupDescriptor = buildStartupStorageDescriptor('startup-snapshot', startupSnapshot);
        return {
          data: startupSnapshot,
          source: 'startup-snapshot',
          bootstrapSource: startupDescriptor.bootstrapSource,
          startupDescriptor,
        };
      })() : null;
      const preferredEntry = choosePreferredStartupEntry(bootstrapDescriptorEntry, startupSnapshotEntry);
      if (preferredEntry?.data) {
        cachedAuthoritativeStartupEntry = preferredEntry;
        return cachedAuthoritativeStartupEntry;
      }
      const startupDescriptor = buildStartupStorageDescriptor('', null);
      cachedAuthoritativeStartupEntry = {
        data: null,
        source: '',
        bootstrapSource: startupDescriptor.bootstrapSource,
        startupDescriptor,
      };
      return cachedAuthoritativeStartupEntry;
    }

    function buildReleasedAuthoritativeStartupEntry(entry = null) {
      const current = entry && typeof entry === 'object' ? entry : null;
      const source = String(current?.source || '').trim();
      const bootstrapSource = normalizeBootstrapSource(current?.bootstrapSource || '', source);
      const startupDescriptor = current?.startupDescriptor && typeof current.startupDescriptor === 'object'
        ? current.startupDescriptor
        : buildStartupStorageDescriptor(source, null, { bootstrapSource });
      return {
        data: null,
        source,
        bootstrapSource,
        startupDescriptor,
      };
    }

    function loadAuthoritativeStartupDataDescriptor() {
      const entry = resolveAuthoritativeStartupEntry();
      return {
        data: entry.data,
        source: entry.source,
        bootstrapSource: entry.bootstrapSource,
        startupDescriptor: entry.startupDescriptor,
      };
    }

    function releaseAuthoritativeStartupData() {
      cachedAuthoritativeStartupEntry = buildReleasedAuthoritativeStartupEntry(cachedAuthoritativeStartupEntry);
      return true;
    }

    function describeBrowserSyncRootAdoption(options = {}) {
      const silent = options.silent === true;
      return {
        source: 'browser-sync-root',
        reason: silent ? 'browser_sync_root_bootstrap' : 'browser_sync_root_manual_reload',
        message: silent ? '已载入用户目录' : '已从用户目录重新载入',
      };
    }

    return {
      loadAuthoritativeStartupDataDescriptor,
      loadAuthoritativeStartupData() {
        return resolveAuthoritativeStartupEntry().data;
      },
      releaseAuthoritativeStartupData,
      getSingleSourceOfTruthDescriptor: buildSingleSourceOfTruthDescriptor,
      getStartupStorageDescriptor() {
        return resolveAuthoritativeStartupEntry().startupDescriptor;
      },
      describeBrowserSyncRootAdoption,
    };
  }

  function getSyncRuntimeModules() {
    if (syncRuntimeModules) return syncRuntimeModules;
    const factory = window.MorphSyncRuntime && typeof window.MorphSyncRuntime.create === 'function'
      ? window.MorphSyncRuntime.create
      : null;
    if (!factory) return null;
    syncRuntimeModules = factory({
      normalizeData,
      getSyncDeviceId,
      readSyncMutationJournal,
      writeSyncMutationJournal,
      getLastAckRevision,
      setLastAckRevision,
      readLastSyncReceipt,
      slimPersistedAIChatSessions,
      syncJournalAIChatMaxSessions: SYNC_JOURNAL_AI_CHAT_MAX_SESSIONS,
      syncJournalAIChatMaxMessages: SYNC_JOURNAL_AI_CHAT_MAX_MESSAGES,
    });
    return syncRuntimeModules;
  }

  function sanitizeWebSyncRootMeta(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const mode = String(raw.mode || '').trim();
    if (!mode) return null;
    const fileCount = Number(raw.fileCount || 0);
    return {
      mode,
      pathLabel: String(raw.pathLabel || '').trim(),
      rootName: String(raw.rootName || '').trim(),
      fileCount: Number.isFinite(fileCount) && fileCount >= 0 ? fileCount : 0,
      readable: raw.readable !== false,
      writable: raw.writable === true,
      persisted: raw.persisted === true,
      selectedAt: String(raw.selectedAt || '').trim(),
      pathPrefix: normalizeWebSyncRelativePath(raw.pathPrefix || ''),
      liveDataRelativePath: normalizeWebSyncRelativePath(raw.liveDataRelativePath || ''),
    };
  }

  function readStoredWebSyncRootMeta() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.webSyncRootMeta) || 'null');
      return sanitizeWebSyncRootMeta(raw);
    } catch (_) {
      return null;
    }
  }

  function writeStoredWebSyncRootMeta(meta) {
    const safe = sanitizeWebSyncRootMeta(meta);
    try {
      if (!safe) {
        localStorage.removeItem(STORAGE_KEYS.webSyncRootMeta);
        return false;
      }
      localStorage.setItem(STORAGE_KEYS.webSyncRootMeta, JSON.stringify(safe));
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearStoredWebSyncRootMeta() {
    try {
      localStorage.removeItem(STORAGE_KEYS.webSyncRootMeta);
    } catch (_) {}
  }

  function getWebSyncRootMeta() {
    const runtimeMode = String(webSyncRootRuntimeState.mode || '').trim();
    if (runtimeMode) {
      return sanitizeWebSyncRootMeta(webSyncRootRuntimeState);
    }
    return readStoredWebSyncRootMeta();
  }

  function clearWebSyncRootRuntimeState() {
    webSyncRootRuntimeState = {
      mode: '',
      handle: null,
      files: null,
      pathLabel: '',
      rootName: '',
      fileCount: 0,
      readable: false,
      writable: false,
      persisted: false,
      selectedAt: '',
      pathPrefix: '',
      liveDataRelativePath: '',
    };
  }

  function applyWebSyncRootMetaToRuntime(meta) {
    const safe = sanitizeWebSyncRootMeta(meta);
    if (!safe) {
      clearWebSyncRootRuntimeState();
      return null;
    }
    webSyncRootRuntimeState = {
      ...webSyncRootRuntimeState,
      ...safe,
      handle: safe.mode === 'handle' ? webSyncRootRuntimeState.handle : null,
      files: safe.mode === 'filelist' ? webSyncRootRuntimeState.files : null,
    };
    return safe;
  }

  (function bootstrapWebSyncRootMeta() {
    const stored = readStoredWebSyncRootMeta();
    if (!stored) return;
    if (stored.mode === 'filelist' && stored.persisted !== true) {
      clearStoredWebSyncRootMeta();
      return;
    }
    applyWebSyncRootMetaToRuntime(stored);
  })();

  function canUseIndexedDb() {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  function canUseWebDirectoryPicker() {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
  }

  function canUseWebDirectoryUploadFallback() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return false;
    const input = document.createElement('input');
    return 'webkitdirectory' in input;
  }

  function isAbortLikeError(error) {
    const name = String(error?.name || '').trim();
    const message = String(error?.message || '').trim().toLowerCase();
    return (
      name === 'AbortError'
      || name === 'NotAllowedError'
      || message === 'aborted'
      || message === 'cancelled'
      || message.includes('user aborted')
    );
  }

  function openWebSyncRootDb() {
    if (!canUseIndexedDb()) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(WEB_SYNC_ROOT_DB_NAME, WEB_SYNC_ROOT_DB_VERSION);
        request.onupgradeneeded = function onUpgrade() {
          const db = request.result;
          if (!db.objectStoreNames.contains(WEB_SYNC_ROOT_STORE_NAME)) {
            db.createObjectStore(WEB_SYNC_ROOT_STORE_NAME);
          }
        };
        request.onsuccess = function onSuccess() {
          resolve(request.result || null);
        };
        request.onerror = function onError() {
          resolve(null);
        };
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function persistWebSyncRootHandle(handle) {
    if (!handle || !canUseIndexedDb()) return false;
    if (webSyncRootHandlePersistPromise) {
      try {
        await webSyncRootHandlePersistPromise;
      } catch (_) {}
    }
    webSyncRootHandlePersistPromise = (async () => {
      const db = await openWebSyncRootDb();
      if (!db) return false;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(WEB_SYNC_ROOT_STORE_NAME, 'readwrite');
          tx.objectStore(WEB_SYNC_ROOT_STORE_NAME).put(handle, WEB_SYNC_ROOT_HANDLE_ID);
          tx.oncomplete = function onComplete() {
            try { db.close(); } catch (_) {}
            resolve(true);
          };
          tx.onerror = function onError() {
            try { db.close(); } catch (_) {}
            resolve(false);
          };
          tx.onabort = function onAbort() {
            try { db.close(); } catch (_) {}
            resolve(false);
          };
        } catch (_) {
          try { db.close(); } catch (_) {}
          resolve(false);
        }
      });
    })();
    try {
      return await webSyncRootHandlePersistPromise;
    } finally {
      webSyncRootHandlePersistPromise = null;
    }
  }

  async function clearPersistedWebSyncRootHandle() {
    if (!canUseIndexedDb()) return false;
    const db = await openWebSyncRootDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(WEB_SYNC_ROOT_STORE_NAME, 'readwrite');
        tx.objectStore(WEB_SYNC_ROOT_STORE_NAME).delete(WEB_SYNC_ROOT_HANDLE_ID);
        tx.oncomplete = function onComplete() {
          try { db.close(); } catch (_) {}
          resolve(true);
        };
        tx.onerror = function onError() {
          try { db.close(); } catch (_) {}
          resolve(false);
        };
        tx.onabort = function onAbort() {
          try { db.close(); } catch (_) {}
          resolve(false);
        };
      } catch (_) {
        try { db.close(); } catch (_) {}
        resolve(false);
      }
    });
  }

  async function loadPersistedWebSyncRootHandle() {
    if (webSyncRootRuntimeState.handle) return webSyncRootRuntimeState.handle;
    if (webSyncRootHandleLoadPromise) return webSyncRootHandleLoadPromise;
    webSyncRootHandleLoadPromise = (async () => {
      const meta = readStoredWebSyncRootMeta();
      if (!meta || meta.mode !== 'handle' || meta.persisted !== true) return null;
      const db = await openWebSyncRootDb();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(WEB_SYNC_ROOT_STORE_NAME, 'readonly');
          const request = tx.objectStore(WEB_SYNC_ROOT_STORE_NAME).get(WEB_SYNC_ROOT_HANDLE_ID);
          request.onsuccess = function onSuccess() {
            try { db.close(); } catch (_) {}
            resolve(request.result || null);
          };
          request.onerror = function onError() {
            try { db.close(); } catch (_) {}
            resolve(null);
          };
        } catch (_) {
          try { db.close(); } catch (_) {}
          resolve(null);
        }
      });
    })();
    try {
      const handle = await webSyncRootHandleLoadPromise;
      if (handle) {
        webSyncRootRuntimeState.handle = handle;
      } else {
        clearStoredWebSyncRootMeta();
      }
      return handle;
    } finally {
      webSyncRootHandleLoadPromise = null;
    }
  }

  async function queryDirectoryHandlePermission(handle, mode = 'read') {
    if (!handle || typeof handle.queryPermission !== 'function') return 'granted';
    try {
      return await handle.queryPermission({ mode }) || 'prompt';
    } catch (_) {
      return 'prompt';
    }
  }

  async function ensureDirectoryHandlePermission(handle, mode = 'read') {
    if (!handle) return false;
    const current = await queryDirectoryHandlePermission(handle, mode);
    if (current === 'granted') return true;
    if (typeof handle.requestPermission !== 'function') return false;
    try {
      return (await handle.requestPermission({ mode })) === 'granted';
    } catch (_) {
      return false;
    }
  }

  function normalizeWebSyncRelativePath(relativePath = '') {
    return String(relativePath || '')
      .replace(/\\/g, '/')
      .split('/')
      .map((segment) => String(segment || '').trim())
      .filter(Boolean)
      .join('/');
  }

  function normalizeWebkitRelativePath(webkitRelativePath = '') {
    const normalized = normalizeWebSyncRelativePath(webkitRelativePath);
    if (!normalized) return '';
    const segments = normalized.split('/');
    if (segments.length > 1) segments.shift();
    return segments.join('/');
  }

  function deriveWebSyncPathPrefixFromLiveDataPath(relativePath = '') {
    const normalized = normalizeWebSyncRelativePath(relativePath);
    if (!normalized) return '';
    if (normalized === 'data/live-data.json' || normalized === 'live-data.json') return '';
    if (/\/data\/live-data\.json$/i.test(normalized)) {
      return normalized.replace(/\/data\/live-data\.json$/i, '');
    }
    return '';
  }

  function scoreWebSyncLiveDataCandidate(relativePath = '') {
    const normalized = normalizeWebSyncRelativePath(relativePath);
    if (!normalized) return Number.MAX_SAFE_INTEGER;
    if (normalized === 'data/live-data.json') return 0;
    if (normalized === 'Morph/data/live-data.json') return 1;
    if (/\/Morpheus\/data\/live-data\.json$/i.test(normalized)) return 2;
    if (/\/data\/live-data\.json$/i.test(normalized)) return 3 + normalized.split('/').length;
    if (normalized === 'live-data.json') return 100;
    return 500 + normalized.split('/').length;
  }

  function listLikelyWebSyncLiveDataPathsFromFiles(fileMap) {
    const candidates = [];
    if (!(fileMap instanceof Map)) return candidates;
    fileMap.forEach((_value, key) => {
      const normalized = normalizeWebSyncRelativePath(key);
      if (!normalized) return;
      if (normalized === 'live-data.json' || /(^|\/)data\/live-data\.json$/i.test(normalized)) {
        candidates.push(normalized);
      }
    });
    return candidates.sort((a, b) => scoreWebSyncLiveDataCandidate(a) - scoreWebSyncLiveDataCandidate(b));
  }

  async function scanDirectoryHandleForLiveDataPaths(rootHandle, options = {}) {
    const maxDepth = Math.max(0, Number(options.maxDepth || 5));
    const results = [];
    async function walk(dirHandle, prefix = '', depth = 0) {
      if (!dirHandle || depth > maxDepth || typeof dirHandle.entries !== 'function') return;
      for await (const [name, child] of dirHandle.entries()) {
        const relPath = normalizeWebSyncRelativePath(prefix ? `${prefix}/${name}` : name);
        if (!relPath) continue;
        if (child?.kind === 'file') {
          if (relPath === 'live-data.json' || /(^|\/)data\/live-data\.json$/i.test(relPath)) {
            results.push(relPath);
          }
          continue;
        }
        if (child?.kind === 'directory' && depth < maxDepth) {
          await walk(child, relPath, depth + 1);
        }
      }
    }
    await walk(rootHandle, '', 0);
    return results.sort((a, b) => scoreWebSyncLiveDataCandidate(a) - scoreWebSyncLiveDataCandidate(b));
  }

  function resolveWebSyncRelativePath(relativePath = '') {
    const normalized = normalizeWebSyncRelativePath(relativePath);
    if (!normalized) return '';
    const prefix = normalizeWebSyncRelativePath(webSyncRootRuntimeState.pathPrefix || '');
    if (!prefix) return normalized;
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return normalized;
    return `${prefix}/${normalized}`;
  }

  function updateWebSyncRuntimeLocation(meta = {}) {
    const safe = sanitizeWebSyncRootMeta({
      ...webSyncRootRuntimeState,
      ...meta,
    });
    if (!safe) return null;
    webSyncRootRuntimeState = {
      ...webSyncRootRuntimeState,
      ...safe,
    };
    if (safe.persisted && safe.mode === 'handle') writeStoredWebSyncRootMeta(safe);
    return safe;
  }

  function buildWebSyncRootFileMap(files) {
    const map = new Map();
    Array.from(files || []).forEach((file) => {
      const relativePath = normalizeWebkitRelativePath(file?.webkitRelativePath || file?.name || '');
      if (!relativePath) return;
      map.set(relativePath, file);
    });
    return map;
  }

  async function chooseWebSyncRootViaFileInput() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      throw new Error('browser_sync_root_unavailable');
    }
    return new Promise((resolve, reject) => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.setAttribute('webkitdirectory', '');
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.top = '0';
        let settled = false;
        const cleanup = () => {
          settled = true;
          if (typeof window !== 'undefined' && onWindowFocus) {
            window.removeEventListener('focus', onWindowFocus);
          }
          input.value = '';
          if (input.parentNode) input.parentNode.removeChild(input);
        };
        const onWindowFocus = () => {
          setTimeout(() => {
            if (settled) return;
            if (!input.files || !input.files.length) {
              cleanup();
              reject(new Error('cancelled'));
            }
          }, 0);
        };
        input.addEventListener('change', () => {
          const list = Array.from(input.files || []);
          cleanup();
          if (!list.length) {
            reject(new Error('cancelled'));
            return;
          }
          const map = buildWebSyncRootFileMap(list);
          const firstRelative = String(list[0]?.webkitRelativePath || '').trim();
          const rootName = firstRelative ? firstRelative.split('/').filter(Boolean)[0] : '';
          const selectedAt = new Date().toISOString();
          webSyncRootRuntimeState = {
            mode: 'filelist',
            handle: null,
            files: map,
            pathLabel: rootName ? `${rootName}（浏览器临时目录）` : '浏览器临时目录',
            rootName,
            fileCount: map.size,
            readable: true,
            writable: false,
            persisted: false,
            selectedAt,
            pathPrefix: '',
            liveDataRelativePath: '',
          };
          clearStoredWebSyncRootMeta();
          void clearPersistedWebSyncRootHandle();
          resolve(sanitizeWebSyncRootMeta(webSyncRootRuntimeState));
        }, { once: true });
        input.addEventListener('cancel', () => {
          cleanup();
          reject(new Error('cancelled'));
        }, { once: true });
        document.body.appendChild(input);
        if (typeof window !== 'undefined') {
          window.addEventListener('focus', onWindowFocus, { once: true });
        }
        input.click();
      } catch (error) {
        reject(error);
      }
    });
  }

  async function adoptWebSyncRootHandle(handle, options = {}) {
    if (!handle || handle.kind !== 'directory') {
      throw new Error('browser_sync_root_invalid');
    }
    const readable = await ensureDirectoryHandlePermission(handle, 'read');
    if (!readable) {
      throw new Error('browser_sync_root_permission_denied');
    }
    const writable = await ensureDirectoryHandlePermission(handle, 'readwrite');
    const selectedAt = new Date().toISOString();
    const baseMeta = {
      mode: 'handle',
      pathLabel: String(handle.name || '已选择目录').trim() || '已选择目录',
      rootName: String(handle.name || '').trim(),
      fileCount: 0,
      readable: true,
      writable,
      persisted: false,
      selectedAt,
    };
    const persisted = options.persist !== false ? await persistWebSyncRootHandle(handle) : false;
    const meta = {
      ...baseMeta,
      persisted,
      pathPrefix: '',
      liveDataRelativePath: '',
    };
    webSyncRootRuntimeState = {
      ...webSyncRootRuntimeState,
      ...meta,
      handle,
      files: null,
    };
    if (persisted) writeStoredWebSyncRootMeta(meta);
    else clearStoredWebSyncRootMeta();
    return sanitizeWebSyncRootMeta(meta);
  }

  async function chooseWebSyncRoot(options = {}) {
    let meta = null;
    if (canUseWebDirectoryPicker()) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        meta = await adoptWebSyncRootHandle(handle, { persist: true });
      } catch (error) {
        if (!isAbortLikeError(error)) {
          throw error;
        }
      }
    }
    if (!meta) {
      if (!canUseWebDirectoryUploadFallback()) {
        throw new Error('browser_sync_root_unavailable');
      }
      meta = await chooseWebSyncRootViaFileInput();
    }
    const result = {
      ...(meta || {}),
      dataImported: false,
      importedFrom: '',
    };
    if (options.importData !== false) {
      const reload = await reloadDataFromWebSyncRoot({ silent: true }).catch((error) => ({
        ok: false,
        error,
      }));
      if (reload?.ok) {
        result.dataImported = true;
        result.importedFrom = String(reload.relativePath || '').trim();
      }
    }
    return result;
  }

  async function ensureWebSyncRootSelection(options = {}) {
    const requireWrite = options.requireWrite === true;
    if (webSyncRootRuntimeState.mode === 'filelist' && webSyncRootRuntimeState.files instanceof Map) {
      if (requireWrite) throw new Error('browser_sync_root_readonly');
      return {
        mode: 'filelist',
        files: webSyncRootRuntimeState.files,
      };
    }
    let handle = webSyncRootRuntimeState.handle;
    if (!handle) {
      handle = await loadPersistedWebSyncRootHandle();
    }
    if (!handle) {
      throw new Error('browser_sync_root_unavailable');
    }
    const readable = await ensureDirectoryHandlePermission(handle, 'read');
    if (!readable) {
      throw new Error('browser_sync_root_permission_denied');
    }
    const writable = requireWrite
      ? await ensureDirectoryHandlePermission(handle, 'readwrite')
      : (await queryDirectoryHandlePermission(handle, 'readwrite')) === 'granted';
    if (requireWrite && !writable) {
      throw new Error('browser_sync_root_write_denied');
    }
    const stored = readStoredWebSyncRootMeta();
    webSyncRootRuntimeState = {
      ...webSyncRootRuntimeState,
      ...(stored || {}),
      mode: 'handle',
      handle,
      files: null,
      pathLabel: String(webSyncRootRuntimeState.pathLabel || stored?.pathLabel || handle.name || '已选择目录').trim(),
      rootName: String(webSyncRootRuntimeState.rootName || stored?.rootName || handle.name || '').trim(),
      readable: true,
      writable,
      persisted: stored?.persisted === true,
    };
    return {
      mode: 'handle',
      handle,
    };
  }

  async function resolveWebSyncRootDirectoryHandle(rootHandle, relativePath, options = {}) {
    const normalized = normalizeWebSyncRelativePath(relativePath);
    const segments = normalized ? normalized.split('/') : [];
    const create = options.create === true;
    let cursor = rootHandle;
    for (let i = 0; i < segments.length; i += 1) {
      cursor = await cursor.getDirectoryHandle(segments[i], { create });
    }
    return cursor;
  }

  async function readTextFromWebSyncRoot(relativePath) {
    const normalized = resolveWebSyncRelativePath(relativePath);
    if (!normalized) throw new Error('browser_sync_relative_path_required');
    const selection = await ensureWebSyncRootSelection({ requireWrite: false });
    if (selection.mode === 'filelist') {
      const file = selection.files.get(normalized);
      if (!file || typeof file.text !== 'function') {
        throw new Error('browser_sync_file_not_found');
      }
      return file.text();
    }
    const segments = normalized.split('/');
    const fileName = segments.pop();
    const directoryHandle = await resolveWebSyncRootDirectoryHandle(selection.handle, segments.join('/'), { create: false });
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();
    return file.text();
  }

  function parseDailyMonthKeyFromMirrorPath(relativePath = '') {
    const normalized = normalizeWebSyncRelativePath(relativePath);
    const match = normalized.match(/(?:^|\/)morph_md_mirror\/日志\/\d{4}\/(\d{4}-\d{2})\.md$/);
    return match ? String(match[1] || '').trim() : '';
  }

  function parseDailyMonthsFromMirrorMarkdown(text = '') {
    const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const blocks = [];
    for (let i = 0; i < lines.length; i += 1) {
      const raw = String(lines[i] || '').trimEnd();
      if (!raw.trim()) continue;
      if (i === 0 && /^#\s+/.test(raw)) continue;
      if (/^##\s+/.test(raw)) {
        blocks.push({
          id: '',
          type: 'h3',
          content: raw.replace(/^##\s+/, '').trim(),
          checked: false,
        });
        continue;
      }
      const todo = raw.match(/^- \[( |x)\] (.*)$/i);
      if (todo) {
        blocks.push({
          id: '',
          type: 'todo',
          content: String(todo[2] || '').trim(),
          checked: String(todo[1] || '').toLowerCase() === 'x',
        });
        continue;
      }
      blocks.push({
        id: '',
        type: 'p',
        content: raw.trim(),
        checked: false,
      });
    }
    return blocks;
  }

  function formatDailyMirrorBlock(block = {}) {
    const type = String(block?.type || '').trim();
    const content = String(block?.content || '').trim();
    if (!content && type !== 'todo') return '';
    const indent = Math.max(0, Number(block?.indent) || 0);
    const prefix = indent > 0 ? '  '.repeat(indent) : '';
    if (type === 'todo') return `${prefix}- [${block?.checked ? 'x' : ' '}] ${content}`.trimEnd();
    if (type === 'bullet') return `${prefix}- ${content}`.trimEnd();
    if (type === 'number') return `${prefix}1. ${content}`.trimEnd();
    if (type === 'h1' || type === 'h2' || type === 'h3') return `## ${content}`;
    return `${prefix}${content}`.trimEnd();
  }

  function buildDailyMonthMirrorMarkdown(monthKey = '', blocks = []) {
    const safeMonthKey = String(monthKey || '').trim() || 'unknown';
    const lines = [`# 日志 ${safeMonthKey}`, ''];
    (Array.isArray(blocks) ? blocks : []).forEach((block) => {
      const formatted = formatDailyMirrorBlock(block);
      if (!formatted) return;
      if (/^##\s+/.test(formatted) && lines.length > 2 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push(formatted);
    });
    lines.push('');
    return `${lines.join('\n').trimEnd()}\n`;
  }

  function encodeWebSyncShardFileSegment(value = '') {
    const safeValue = String(value == null ? '' : value).trim();
    if (!safeValue) return 'empty';
    try {
      if (typeof btoa === 'function') {
        return btoa(unescape(encodeURIComponent(safeValue))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      }
    } catch (_) {}
    try {
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(safeValue, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      }
    } catch (_) {}
    return safeValue.replace(/[^a-zA-Z0-9_-]+/g, '-');
  }

  function buildDailyMonthShardIndex(monthKeys = []) {
    return (Array.isArray(monthKeys) ? monthKeys : [])
      .map((monthKey, index) => {
        const safeMonthKey = String(monthKey || '').trim();
        if (!/^\d{4}-\d{2}$/.test(safeMonthKey)) return null;
        return {
          id: safeMonthKey,
          file: `months/${encodeWebSyncShardFileSegment(safeMonthKey)}.json`,
          order: index,
          updatedAt: '',
        };
      })
      .filter(Boolean);
  }

  async function removeStaleDailyMonthShardFiles(monthKeys = [], selection = null) {
    const safeSelection = selection && typeof selection === 'object'
      ? selection
      : await ensureWebSyncRootSelection({ requireWrite: true });
    if (safeSelection.mode !== 'handle') return 0;
    const keepFiles = new Set(
      buildDailyMonthShardIndex(monthKeys).map((entry) => String(entry?.file || '').trim().split('/').pop()).filter(Boolean)
    );
    const baseDir = resolveWebSyncRelativePath('data/shards/daily-months/months');
    if (!baseDir) return 0;
    try {
      const itemsHandle = await resolveWebSyncRootDirectoryHandle(safeSelection.handle, baseDir, { create: false });
      let removed = 0;
      for await (const [entryName, entryHandle] of itemsHandle.entries()) {
        if (!entryHandle || entryHandle.kind !== 'file' || !/\.json$/i.test(entryName) || keepFiles.has(entryName)) continue;
        if (typeof itemsHandle.removeEntry !== 'function') continue;
        try {
          await itemsHandle.removeEntry(entryName);
          removed += 1;
        } catch (_) {}
      }
      return removed;
    } catch (_) {
      return 0;
    }
  }

  function extractDailyMirrorMonthKeysFromHint(rawHint = null) {
    const hint = normalizeMirrorDeltaHint(rawHint);
    if (!hint) return null;
    const domainSet = new Set(Array.isArray(hint.domains) ? hint.domains : []);
    if (domainSet.has('all') || domainSet.has('daily')) return null;
    const monthKeys = (Array.isArray(hint.entityRefs) ? hint.entityRefs : [])
      .filter((item) => String(item?.domain || '').trim() === 'daily')
      .map((item) => String(item?.id || '').trim())
      .filter((item) => /^\d{4}-\d{2}$/.test(item));
    return monthKeys.length ? Array.from(new Set(monthKeys)) : [];
  }

  function getWebSyncConflictCleanupDescriptor(relativePath = '') {
    const normalized = normalizeWebSyncRelativePath(relativePath);
    if (!normalized) return null;
    const segments = normalized.split('/').filter(Boolean);
    if (!segments.length) return null;
    const fileName = String(segments[segments.length - 1] || '').trim();
    if (!fileName) return null;
    const isMirrorPath = segments[0] === 'morph_md_mirror';
    const isRootGuideFile = segments.length === 1 && (fileName === 'README.md' || fileName === '00-从这里开始.md');
    const isShardJsonFile = segments[0] === 'data' && segments[1] === 'shards' && /\.json$/i.test(fileName);
    if (!isMirrorPath && !isRootGuideFile && !isShardJsonFile) return null;
    const extIndex = fileName.lastIndexOf('.');
    if (extIndex <= 0 || extIndex === fileName.length - 1) return null;
    const stem = fileName.slice(0, extIndex);
    const ext = fileName.slice(extIndex);
    if (!stem || !ext) return null;
    return {
      directoryPath: segments.slice(0, -1).join('/'),
      fileName,
      stem,
      ext,
    };
  }

  async function removeDuplicateWebSyncConflictFiles(relativePath = '', selection = null) {
    const descriptor = getWebSyncConflictCleanupDescriptor(relativePath);
    if (!descriptor) return 0;
    const safeSelection = selection && typeof selection === 'object'
      ? selection
      : await ensureWebSyncRootSelection({ requireWrite: true });
    if (safeSelection.mode !== 'handle') return 0;
    try {
      const directoryHandle = await resolveWebSyncRootDirectoryHandle(
        safeSelection.handle,
        descriptor.directoryPath,
        { create: false }
      );
      const duplicatePattern = new RegExp(
        `^${descriptor.stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+${descriptor.ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
      );
      let removed = 0;
      for await (const [entryName, entryHandle] of directoryHandle.entries()) {
        if (!entryHandle || entryHandle.kind !== 'file' || entryName === descriptor.fileName || !duplicatePattern.test(entryName)) continue;
        if (typeof directoryHandle.removeEntry !== 'function') continue;
        try {
          await directoryHandle.removeEntry(entryName);
          removed += 1;
        } catch (_) {}
      }
      return removed;
    } catch (_) {
      return 0;
    }
  }

  async function removeDuplicateDailyMirrorFilesForMonth(monthKey = '', selection = null) {
    const safeMonthKey = String(monthKey || '').trim();
    if (!/^\d{4}-\d{2}$/.test(safeMonthKey)) return 0;
    const safeSelection = selection && typeof selection === 'object'
      ? selection
      : await ensureWebSyncRootSelection({ requireWrite: true });
    if (safeSelection.mode !== 'handle') return 0;
    const yearKey = safeMonthKey.slice(0, 4);
    const baseDir = resolveWebSyncRelativePath(`morph_md_mirror/日志/${yearKey}`);
    if (!baseDir) return 0;
    try {
      const yearHandle = await resolveWebSyncRootDirectoryHandle(safeSelection.handle, baseDir, { create: false });
      const duplicatePattern = new RegExp(`^${safeMonthKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+\\.md$`);
      let removed = 0;
      for await (const [entryName, entryHandle] of yearHandle.entries()) {
        if (!entryHandle || entryHandle.kind !== 'file' || !duplicatePattern.test(entryName)) continue;
        if (typeof yearHandle.removeEntry !== 'function') continue;
        try {
          await yearHandle.removeEntry(entryName);
          removed += 1;
        } catch (_) {}
      }
      return removed;
    } catch (_) {
      return 0;
    }
  }

  async function syncDailyDerivedFilesToWebSyncRoot(data, mirrorDeltaHint = null) {
    const selection = await ensureWebSyncRootSelection({ requireWrite: true });
    if (selection.mode !== 'handle') return { ok: false, reason: 'browser_sync_root_readonly' };
    const safeData = ensureNormalizedDataSnapshot(data);
    const dailyMonths = safeData && safeData.dailyMonths && typeof safeData.dailyMonths === 'object'
      ? safeData.dailyMonths
      : {};
    const hintedMonthKeys = extractDailyMirrorMonthKeysFromHint(mirrorDeltaHint);
    const monthKeys = Array.isArray(hintedMonthKeys) && hintedMonthKeys.length
      ? hintedMonthKeys
      : Object.keys(dailyMonths).sort();
    await writeTextToWebSyncRoot('data/shards/daily-months.json', `${JSON.stringify(dailyMonths, null, 2)}\n`);
    const shardIndex = buildDailyMonthShardIndex(Object.keys(dailyMonths).sort());
    await writeTextToWebSyncRoot('data/shards/daily-months/index.json', `${JSON.stringify(shardIndex, null, 2)}\n`);
    for (const entry of shardIndex) {
      const monthKey = String(entry?.id || '').trim();
      const file = String(entry?.file || '').trim();
      if (!monthKey || !file) continue;
      const blocks = Array.isArray(dailyMonths[monthKey]) ? dailyMonths[monthKey] : [];
      await writeTextToWebSyncRoot(`data/shards/daily-months/${file}`, `${JSON.stringify(blocks, null, 2)}\n`);
    }
    await removeStaleDailyMonthShardFiles(Object.keys(dailyMonths).sort(), selection);
    if (!monthKeys.length) {
      await writeTextToWebSyncRoot('morph_md_mirror/日志/说明.md', '# 日志\n\n暂无日志。\n');
      return { ok: true, monthKeys: [] };
    }
    await writeTextToWebSyncRoot('morph_md_mirror/日志/说明.md', [
      '# 日志',
      '',
      `当前共 ${Object.keys(dailyMonths).length} 个日志月份。`,
      '',
    ].join('\n'));
    for (const monthKey of monthKeys) {
      if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;
      const yearKey = monthKey.slice(0, 4);
      const blocks = Array.isArray(dailyMonths[monthKey]) ? dailyMonths[monthKey] : [];
      await writeTextToWebSyncRoot(
        `morph_md_mirror/日志/${yearKey}/${monthKey}.md`,
        buildDailyMonthMirrorMarkdown(monthKey, blocks)
      );
      await removeDuplicateDailyMirrorFilesForMonth(monthKey, selection);
    }
    return { ok: true, monthKeys };
  }

  function countMeaningfulDailyMirrorBlocks(blocks = []) {
    return (Array.isArray(blocks) ? blocks : []).filter((block) => String(block?.content || '').trim()).length;
  }

  function countDailyMirrorDateHeaders(blocks = []) {
    return (Array.isArray(blocks) ? blocks : []).filter((block) => {
      if (String(block?.type || '').trim() !== 'h3') return false;
      const content = String(block?.content || '').trim();
      return /^\[\s*日志\s*\]\s*\d{4}-\d{2}-\d{2}$/u.test(content)
        || /^［\s*日志\s*］\s*\d{4}-\d{2}-\d{2}$/u.test(content);
    }).length;
  }

  function shouldRepairDailyMonthFromMirror(currentBlocks = [], mirrorBlocks = []) {
    const mirrorRichness = countMeaningfulDailyMirrorBlocks(mirrorBlocks);
    if (mirrorRichness <= 0) return false;
    const currentRichness = countMeaningfulDailyMirrorBlocks(currentBlocks);
    if (currentRichness <= 0) return true;
    const currentHeaders = countDailyMirrorDateHeaders(currentBlocks);
    const mirrorHeaders = countDailyMirrorDateHeaders(mirrorBlocks);
    if (mirrorHeaders > currentHeaders) return true;
    return mirrorRichness > currentRichness + 1;
  }

  async function readDailyMonthsFromWebSyncRootMirror(selection) {
    const safeSelection = selection && typeof selection === 'object'
      ? selection
      : await ensureWebSyncRootSelection({ requireWrite: false });
    const months = {};
    const registerMonth = async (relativePath) => {
      const monthKey = parseDailyMonthKeyFromMirrorPath(relativePath);
      if (!monthKey) return;
      try {
        const text = safeSelection.mode === 'filelist'
          ? await (safeSelection.files.get(relativePath)?.text?.() || Promise.reject(new Error('browser_sync_file_not_found')))
          : await readTextFromWebSyncRoot(relativePath);
        const parsed = parseDailyMonthsFromMirrorMarkdown(text);
        if (parsed.length) months[monthKey] = parsed;
      } catch (_) {}
    };

    if (safeSelection.mode === 'filelist') {
      const candidates = [];
      safeSelection.files.forEach((_file, key) => {
        const normalized = normalizeWebSyncRelativePath(key);
        if (!parseDailyMonthKeyFromMirrorPath(normalized)) return;
        candidates.push(normalized);
      });
      candidates.sort();
      for (let i = 0; i < candidates.length; i += 1) {
        await registerMonth(candidates[i]);
      }
      return months;
    }

    const baseDir = resolveWebSyncRelativePath('morph_md_mirror/日志');
    if (!baseDir) return months;
    try {
      const rootDir = await resolveWebSyncRootDirectoryHandle(safeSelection.handle, baseDir, { create: false });
      for await (const [yearName, yearHandle] of rootDir.entries()) {
        if (!yearHandle || yearHandle.kind !== 'directory') continue;
        for await (const [fileName, fileHandle] of yearHandle.entries()) {
          if (!fileHandle || fileHandle.kind !== 'file' || !/\.md$/i.test(fileName)) continue;
          const relativePath = normalizeWebSyncRelativePath(`${baseDir}/${yearName}/${fileName}`);
          await registerMonth(relativePath);
        }
      }
    } catch (_) {}
    return months;
  }

  async function repairDailyMonthsFromWebSyncRootMirror(data, selection) {
    const target = data && typeof data === 'object' ? data : normalizeData(null);
    const currentDailyMonths = target.dailyMonths && typeof target.dailyMonths === 'object'
      ? target.dailyMonths
      : {};
    const mirroredDailyMonths = await readDailyMonthsFromWebSyncRootMirror(selection);
    const repairedMonths = [];
    Object.entries(mirroredDailyMonths || {}).forEach(([monthKey, mirrorBlocks]) => {
      const currentBlocks = Array.isArray(currentDailyMonths[monthKey]) ? currentDailyMonths[monthKey] : [];
      if (!shouldRepairDailyMonthFromMirror(currentBlocks, mirrorBlocks)) return;
      currentDailyMonths[monthKey] = mirrorBlocks;
      repairedMonths.push(monthKey);
    });
    target.dailyMonths = currentDailyMonths;
    return {
      data: target,
      repairedMonths,
    };
  }

  async function inspectLiveDataFromWebSyncRoot() {
    const selection = await ensureWebSyncRootSelection({ requireWrite: false });
    let candidates = WEB_SYNC_ROOT_LIVE_DATA_CANDIDATES.slice();
    if (selection.mode === 'filelist') {
      const discovered = listLikelyWebSyncLiveDataPathsFromFiles(selection.files);
      if (discovered.length) candidates = discovered;
    } else if (selection.mode === 'handle') {
      const discovered = await scanDirectoryHandleForLiveDataPaths(selection.handle, { maxDepth: 5 });
      if (discovered.length) candidates = discovered;
    }
    let lastError = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const relativePath = normalizeWebSyncRelativePath(candidates[i]);
      if (!relativePath) continue;
      try {
        let file = null;
        if (selection.mode === 'filelist') {
          file = selection.files.get(relativePath) || null;
          if (!file) throw new Error('browser_sync_file_not_found');
        } else {
          const segments = relativePath.split('/');
          const fileName = segments.pop();
          const directoryHandle = await resolveWebSyncRootDirectoryHandle(selection.handle, segments.join('/'), { create: false });
          const fileHandle = await directoryHandle.getFileHandle(fileName, { create: false });
          file = await fileHandle.getFile();
        }
        const pathPrefix = deriveWebSyncPathPrefixFromLiveDataPath(relativePath);
        const lastModified = Number(file && file.lastModified);
        const size = Number(file && file.size);
        updateWebSyncRuntimeLocation({
          pathPrefix,
          liveDataRelativePath: relativePath,
        });
        return {
          ok: true,
          mode: selection.mode,
          relativePath,
          pathPrefix,
          lastModified: Number.isFinite(lastModified) ? lastModified : 0,
          size: Number.isFinite(size) ? size : 0,
          signature: `${relativePath}:${Number.isFinite(lastModified) ? lastModified : 0}:${Number.isFinite(size) ? size : 0}`,
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('browser_sync_live_data_not_found');
  }

  async function writeTextToWebSyncRoot(relativePath, text) {
    const normalized = resolveWebSyncRelativePath(relativePath);
    if (!normalized) throw new Error('browser_sync_relative_path_required');
    const selection = await ensureWebSyncRootSelection({ requireWrite: true });
    if (selection.mode !== 'handle') {
      throw new Error('browser_sync_root_readonly');
    }
    const segments = normalized.split('/');
    const fileName = segments.pop();
    const directoryHandle = await resolveWebSyncRootDirectoryHandle(selection.handle, segments.join('/'), { create: true });
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(String(text ?? ''));
    await writable.close();
    await removeDuplicateWebSyncConflictFiles(normalized, selection);
    return {
      ok: true,
      relativePath: normalized,
    };
  }

  async function appendTextToWebSyncRoot(relativePath, text) {
    const normalized = resolveWebSyncRelativePath(relativePath);
    const existing = await readTextFromWebSyncRoot(normalized).catch(() => '');
    return writeTextToWebSyncRoot(normalized, `${existing}${String(text ?? '')}`);
  }

  function utf8ByteLength(value) {
    const text = String(value || '');
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    try {
      return unescape(encodeURIComponent(text)).length;
    } catch (_) {
      return text.length;
    }
  }

  function shouldExposeMorphDevRawFailures() {
    const localFlag = typeof MORPH_DEV_EXPOSE_RAW_FAILURES !== 'undefined' && MORPH_DEV_EXPOSE_RAW_FAILURES === true;
    if (typeof window === 'undefined') return localFlag;
    let queryFlag = false;
    let storageFlag = false;
    const protocol = String(window.location && window.location.protocol ? window.location.protocol : '').trim().toLowerCase();
    try {
      const params = new URLSearchParams(String(window.location && window.location.search ? window.location.search : ''));
      const raw = String(params.get('devRawFailures') || params.get('morphDevRawFailures') || '').trim().toLowerCase();
      queryFlag = raw === '1' || raw === 'true' || raw === 'yes';
    } catch (_) {}
    try {
      const stored = String(localStorage.getItem('morph_dev_expose_raw_failures') || '').trim().toLowerCase();
      storageFlag = stored === '1' || stored === 'true' || stored === 'yes';
    } catch (_) {}
    return queryFlag || storageFlag || protocol === 'file:' || window.__MORPH_DEV_EXPOSE_RAW_FAILURES === true || localFlag;
  }

  function buildMorphDevSyncStatusText(state, text, meta = {}) {
    const normalizedState = String(state || '').trim() || 'idle';
    const normalizedText = String(text || '').trim();
    const source = String(meta && meta.source ? meta.source : 'ui').trim();
    const reason = String(meta && meta.reason ? meta.reason : '').trim();
    const parts = [source ? `${source}:${normalizedState}` : normalizedState];
    if (reason) parts.push(`reason=${reason}`);
    if (normalizedText && normalizedText !== normalizedState) parts.push(`label=${normalizedText}`);
    return parts.join(' | ');
  }

  function generateSyncDeviceId() {
    try {
      if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
        return `device-${crypto.randomUUID()}`;
      }
    } catch (_) {}
    return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getSyncDeviceId() {
    try {
      const existing = String(localStorage.getItem(STORAGE_KEYS.syncDeviceId) || '').trim();
      if (existing) return existing;
      const next = generateSyncDeviceId();
      localStorage.setItem(STORAGE_KEYS.syncDeviceId, next);
      return next;
    } catch (_) {
      return generateSyncDeviceId();
    }
  }

  function buildFastSignatureHash(text) {
    let hash = 2166136261;
    const input = String(text || '');
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function shouldDropEditorHistoryHTML(html) {
    const text = String(html || '').trim();
    if (!text) return false;
    if (/data:image\/|base64,/i.test(text)) return true;
    return utf8ByteLength(text) > 120 * 1024;
  }

  function sanitizeEditorHistoryBlock(block) {
    if (!block || typeof block !== 'object') return block;
    const next = { ...block };
    if (typeof next.html === 'string' && shouldDropEditorHistoryHTML(next.html)) {
      delete next.html;
    }
    return next;
  }

  function sanitizeEditorHistorySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const next = {
      context: typeof snapshot.context === 'string' ? snapshot.context : '',
      contextId: typeof snapshot.contextId === 'string' ? snapshot.contextId : '',
    };
    if (typeof snapshot.name === 'string' && snapshot.name) next.name = snapshot.name;
    if (Array.isArray(snapshot.blocks)) {
      next.blocks = snapshot.blocks.map((block) => sanitizeEditorHistoryBlock(block));
    } else {
      next.blocks = [];
    }
    return next;
  }

  function buildEditorHistorySignature(snapshot) {
    const safeSnapshot = sanitizeEditorHistorySnapshot(snapshot);
    if (!safeSnapshot) return '';
    try {
      const serialized = JSON.stringify(safeSnapshot);
      return `v2:${serialized.length}:${buildFastSignatureHash(serialized)}`;
    } catch (_) {
      return '';
    }
  }

  function sanitizeEditorHistoryEntry(entry, fallbackIndex = 0) {
    if (!entry || typeof entry !== 'object') return null;
    const snapshot = sanitizeEditorHistorySnapshot(entry.snapshot);
    if (!snapshot) return null;
    return {
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : `editor_history_${fallbackIndex}`,
      at: typeof entry.at === 'string' ? entry.at : '',
      reason: typeof entry.reason === 'string' && entry.reason.trim() ? entry.reason : 'edit',
      summary: typeof entry.summary === 'string' ? entry.summary.slice(0, 120) : '',
      signature: buildEditorHistorySignature(snapshot),
      snapshot,
    };
  }

  function sanitizeEditorHistoryStore(store) {
    const source = store && typeof store === 'object' ? store : {};
    const result = { daily: {}, project: {} };
    ['daily', 'project'].forEach((context) => {
      const bucket = source[context] && typeof source[context] === 'object' ? source[context] : {};
      Object.entries(bucket).forEach(([contextId, entries]) => {
        if (!Array.isArray(entries) || !contextId) return;
        const sanitized = entries
          .map((entry, index) => sanitizeEditorHistoryEntry(entry, index))
          .filter(Boolean)
          .slice(-EDITOR_HISTORY_MAX_ENTRIES_PER_SCOPE);
        if (sanitized.length) result[context][contextId] = sanitized;
      });
    });
    return result;
  }

  function sanitizeEditorHistoryCursorStore(cursorStore, historyStore) {
    const source = cursorStore && typeof cursorStore === 'object' ? cursorStore : {};
    const history = historyStore && typeof historyStore === 'object' ? historyStore : EDITOR_HISTORY_EMPTY;
    const result = { daily: {}, project: {} };
    ['daily', 'project'].forEach((context) => {
      const cursorBucket = source[context] && typeof source[context] === 'object' ? source[context] : {};
      const historyBucket = history[context] && typeof history[context] === 'object' ? history[context] : {};
      Object.entries(historyBucket).forEach(([contextId, entries]) => {
        const maxIndex = Math.max(0, Array.isArray(entries) ? entries.length - 1 : 0);
        const rawCursor = Number(cursorBucket[contextId]);
        const safeCursor = Number.isInteger(rawCursor) ? Math.max(0, Math.min(maxIndex, rawCursor)) : maxIndex;
        result[context][contextId] = safeCursor;
      });
    });
    return result;
  }

  function extractEditorHistoryStateFromData(source) {
    const safe = source && typeof source === 'object' ? source : {};
    const history = sanitizeEditorHistoryStore(safe.editorHistory);
    const cursor = sanitizeEditorHistoryCursorStore(safe.editorHistoryCursor, history);
    return { history, cursor };
  }

  function mergeEditorHistoryState(primaryState, fallbackState) {
    const primary = primaryState && typeof primaryState === 'object' ? primaryState : {};
    const fallback = fallbackState && typeof fallbackState === 'object' ? fallbackState : {};
    const result = { history: { daily: {}, project: {} }, cursor: { daily: {}, project: {} } };
    ['daily', 'project'].forEach((context) => {
      const primaryHistory = primary.history && primary.history[context] && typeof primary.history[context] === 'object'
        ? primary.history[context]
        : {};
      const fallbackHistory = fallback.history && fallback.history[context] && typeof fallback.history[context] === 'object'
        ? fallback.history[context]
        : {};
      const primaryCursor = primary.cursor && primary.cursor[context] && typeof primary.cursor[context] === 'object'
        ? primary.cursor[context]
        : {};
      const fallbackCursor = fallback.cursor && fallback.cursor[context] && typeof fallback.cursor[context] === 'object'
        ? fallback.cursor[context]
        : {};
      const ids = new Set([...Object.keys(fallbackHistory), ...Object.keys(primaryHistory)]);
      ids.forEach((contextId) => {
        const primaryEntries = Array.isArray(primaryHistory[contextId]) ? primaryHistory[contextId] : [];
        const fallbackEntries = Array.isArray(fallbackHistory[contextId]) ? fallbackHistory[contextId] : [];
        const entries = primaryEntries.length ? primaryEntries : fallbackEntries;
        if (!entries.length) return;
        result.history[context][contextId] = entries;
        const rawCursor = primaryEntries.length ? primaryCursor[contextId] : fallbackCursor[contextId];
        const maxIndex = Math.max(0, entries.length - 1);
        const safeCursor = Number.isInteger(Number(rawCursor))
          ? Math.max(0, Math.min(maxIndex, Number(rawCursor)))
          : maxIndex;
        result.cursor[context][contextId] = safeCursor;
      });
    });
    return result;
  }

  function applyEditorHistoryStateToData(target, state) {
    const next = target && typeof target === 'object' ? target : {};
    const safeState = mergeEditorHistoryState(state, null);
    next.editorHistory = safeState.history;
    next.editorHistoryCursor = safeState.cursor;
    return next;
  }

  function readLocalEditorHistoryState() {
    try {
      const rawHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.editorHistory) || 'null');
      const rawCursor = JSON.parse(localStorage.getItem(STORAGE_KEYS.editorHistoryCursor) || 'null');
      const history = sanitizeEditorHistoryStore(rawHistory);
      const cursor = sanitizeEditorHistoryCursorStore(rawCursor, history);
      return { history, cursor };
    } catch (_) {
      return { history: { daily: {}, project: {} }, cursor: { daily: {}, project: {} } };
    }
  }

  function writeLocalEditorHistoryState(state) {
    const safeState = mergeEditorHistoryState(state, null);
    try {
      localStorage.setItem(STORAGE_KEYS.editorHistory, JSON.stringify(safeState.history));
      localStorage.setItem(STORAGE_KEYS.editorHistoryCursor, JSON.stringify(safeState.cursor));
    } catch (error) {
      console.warn('[MorphStorage] Editor history cache write failed.', error);
    }
  }

  function sanitizeSyncMutationJournal(raw) {
    const runtime = getSyncRuntimeModules();
    if (runtime && typeof runtime.sanitizeSyncMutationJournal === 'function') {
      return runtime.sanitizeSyncMutationJournal(raw);
    }
    const list = Array.isArray(raw) ? raw : [];
    const out = [];
    const sanitizeDomainPayloads = (value) => {
      if (!value || typeof value !== 'object') return {};
      const allowedDomains = [
        'flashThoughts',
        'fixedThoughts',
        'reminders',
        'projectSpaces',
        'projects',
        'routines',
        'rhythm',
        'sops',
        'dailyMonths',
        'expenseLedger',
        'aiChatSessions',
        'aiDailyLogs',
        'aiCurrentChatSessionId',
      ];
      const safe = {};
      allowedDomains.forEach((domain) => {
        if (!(domain in value)) return;
        try {
          safe[domain] = JSON.parse(JSON.stringify(value[domain]));
        } catch (_) {}
      });
      return safe;
    };
    const sanitizeEntityRefs = (value) => Array.isArray(value)
      ? value
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const domain = String(item.domain || '').trim();
            const entityType = String(item.entityType || '').trim();
            const entityId = String(item.entityId || '').trim();
            if (!domain && !entityType && !entityId) return null;
            return {
              domain,
              entityType,
              entityId,
              action: String(item.action || '').trim(),
              label: String(item.label || '').trim().slice(0, 120),
            };
          })
          .filter(Boolean)
          .slice(0, 48)
      : [];
    list.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const revision = Number(entry.revision);
      if (!Number.isFinite(revision) || revision <= 0) return;
      out.push({
        mutationId: String(entry.mutationId || '').trim() || `rev:${revision}`,
        revision,
        lastClientWriteAt: String(entry.lastClientWriteAt || '').trim(),
        deviceId: String(entry.deviceId || '').trim(),
        createdAt: String(entry.createdAt || '').trim() || new Date().toISOString(),
        domains: Array.isArray(entry.domains)
          ? Array.from(new Set(entry.domains.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 24)
          : [],
        entityRefs: sanitizeEntityRefs(entry.entityRefs),
        domainPayloads: sanitizeDomainPayloads(entry.domainPayloads),
      });
    });
    out.sort((a, b) => {
      if (a.revision !== b.revision) return a.revision - b.revision;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    return out.slice(-120);
  }

  function readSyncMutationJournal() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.syncMutationJournal) || '[]');
      return sanitizeSyncMutationJournal(raw);
    } catch (_) {
      return [];
    }
  }

  function writeSyncMutationJournal(entries) {
    try {
      localStorage.setItem(STORAGE_KEYS.syncMutationJournal, JSON.stringify(sanitizeSyncMutationJournal(entries)));
    } catch (error) {
      console.warn('[MorphStorage] Sync mutation journal write failed.', error);
    }
  }

  function getLastAckRevision() {
    try {
      const value = Number(localStorage.getItem(STORAGE_KEYS.syncAckRevision) || 0);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (_) {
      return 0;
    }
  }

  function setLastAckRevision(revision) {
    const safeRevision = Number(revision);
    if (!Number.isFinite(safeRevision) || safeRevision < 0) return;
    try {
      localStorage.setItem(STORAGE_KEYS.syncAckRevision, String(Math.max(getLastAckRevision(), safeRevision)));
    } catch (error) {
      console.warn('[MorphStorage] Sync ack revision write failed.', error);
    }
  }

  function sanitizeSyncReceipt(raw) {
    const runtime = getSyncRuntimeModules();
    if (runtime && typeof runtime.sanitizeSyncReceipt === 'function') {
      return runtime.sanitizeSyncReceipt(raw);
    }
    const source = raw && typeof raw === 'object' ? raw : {};
    const sanitizeMutationReceipts = (value) => Array.isArray(value)
      ? value
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const mutationId = String(item.mutationId || '').trim();
            if (!mutationId) return null;
            return {
              mutationId,
              revision: Number.isFinite(Number(item.revision)) ? Number(item.revision) : 0,
              domain: String(item.domain || '').trim(),
              entityType: String(item.entityType || '').trim(),
              entityId: String(item.entityId || '').trim(),
              action: String(item.action || '').trim(),
              label: String(item.label || '').trim().slice(0, 120),
              detail: String(item.detail || '').trim(),
            };
          })
          .filter(Boolean)
          .slice(0, 64)
      : [];
    const pendingDomains = Array.isArray(source.pendingDomains)
      ? Array.from(new Set(source.pendingDomains.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 24)
      : [];
    const mergedDomains = Array.isArray(source.mergedDomains)
      ? Array.from(new Set(source.mergedDomains.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 24)
      : [];
    const domainStates = source.domainStates && typeof source.domainStates === 'object'
      ? Object.entries(source.domainStates).reduce((acc, [domain, value]) => {
          const key = String(domain || '').trim();
          if (!key) return acc;
          if (value && typeof value === 'object') {
            acc[key] = {
              status: String(value.status || '').trim() || 'unknown',
              detail: String(value.detail || '').trim(),
            };
          } else {
            acc[key] = {
              status: String(value || '').trim() || 'unknown',
              detail: '',
            };
          }
          return acc;
        }, {})
      : {};
    const entityStates = source.entityStates && typeof source.entityStates === 'object'
      ? Object.entries(source.entityStates).reduce((acc, [key, value]) => {
          const safeKey = String(key || '').trim();
          if (!safeKey || !value || typeof value !== 'object') return acc;
          acc[safeKey] = {
            domain: String(value.domain || '').trim(),
            entityType: String(value.entityType || '').trim(),
            entityId: String(value.entityId || '').trim(),
            action: String(value.action || '').trim(),
            label: String(value.label || '').trim().slice(0, 120),
            status: String(value.status || '').trim() || 'unknown',
            detail: String(value.detail || '').trim(),
          };
          return acc;
        }, {})
      : {};
    const conflict = source.conflict && typeof source.conflict === 'object'
      ? {
          incomingDeviceId: String(source.conflict.incomingDeviceId || '').trim(),
          currentDeviceId: String(source.conflict.currentDeviceId || '').trim(),
          incomingRevision: Number.isFinite(Number(source.conflict.incomingRevision)) ? Number(source.conflict.incomingRevision) : 0,
          currentRevision: Number.isFinite(Number(source.conflict.currentRevision)) ? Number(source.conflict.currentRevision) : 0,
          incomingWriteAt: String(source.conflict.incomingWriteAt || '').trim(),
          currentWriteAt: String(source.conflict.currentWriteAt || '').trim(),
          detail: String(source.conflict.detail || '').trim(),
        }
      : null;
    return {
      updatedAt: String(source.updatedAt || '').trim() || new Date().toISOString(),
      status: String(source.status || '').trim() || 'unknown',
      source: String(source.source || '').trim() || 'unknown',
      reason: String(source.reason || '').trim(),
      message: String(source.message || '').trim(),
      ackedRevision: Number.isFinite(Number(source.ackedRevision)) ? Number(source.ackedRevision) : 0,
      pendingCount: Number.isFinite(Number(source.pendingCount)) ? Number(source.pendingCount) : 0,
      pendingDomains,
      ackedMutations: sanitizeMutationReceipts(source.ackedMutations),
      mergedMutations: sanitizeMutationReceipts(source.mergedMutations),
      blockedMutations: sanitizeMutationReceipts(source.blockedMutations),
      mergedDomains,
      domainStates,
      entityStates,
      conflict,
    };
  }

  function buildSyncEntityStates({ journal = [], receipt = null, ackedEntityRefs = [] } = {}) {
    const runtime = getSyncRuntimeModules();
    if (runtime && typeof runtime.buildSyncEntityStates === 'function') {
      return runtime.buildSyncEntityStates({ journal, receipt, ackedEntityRefs });
    }
    const out = {};
    const safeJournal = Array.isArray(journal) ? journal : [];
    const safeReceipt = receipt && typeof receipt === 'object' ? receipt : null;
    const safeAckedEntityRefs = Array.isArray(ackedEntityRefs) ? ackedEntityRefs : [];
    const buildKey = (entry) => {
      const domain = String(entry && entry.domain ? entry.domain : '').trim();
      const entityType = String(entry && entry.entityType ? entry.entityType : '').trim();
      const entityId = String(entry && entry.entityId ? entry.entityId : '').trim();
      if (!domain && !entityType && !entityId) return '';
      return [domain, entityType, entityId].join('::');
    };
    const setEntityState = (entry, status, detail = '') => {
      const key = buildKey(entry);
      if (!key) return;
      out[key] = {
        domain: String(entry && entry.domain ? entry.domain : '').trim(),
        entityType: String(entry && entry.entityType ? entry.entityType : '').trim(),
        entityId: String(entry && entry.entityId ? entry.entityId : '').trim(),
        action: String(entry && entry.action ? entry.action : '').trim(),
        label: String(entry && entry.label ? entry.label : '').trim().slice(0, 120),
        status: String(status || '').trim() || 'unknown',
        detail: String(detail || '').trim(),
      };
    };
    if (safeReceipt && safeReceipt.entityStates && typeof safeReceipt.entityStates === 'object') {
      Object.values(safeReceipt.entityStates).forEach((entry) => setEntityState(entry, entry && entry.status, entry && entry.detail));
    }
    safeAckedEntityRefs.forEach((entry) => {
      setEntityState(entry, 'acked', '该实体对应的本地 mutation 已被远端确认');
    });
    safeJournal.forEach((entry) => {
      const revision = Number(entry && entry.revision ? entry.revision : 0);
      const refs = Array.isArray(entry && entry.entityRefs) ? entry.entityRefs : [];
      refs.forEach((ref) => {
        setEntityState(ref, 'pending', revision > 0 ? `该实体仍有本地 revision ${revision} 待确认` : '该实体仍有未确认写入');
      });
    });
    return out;
  }

  function buildSyncDomainStates({ journal = [], receipt = null, ackedDomains = [] } = {}) {
    const runtime = getSyncRuntimeModules();
    if (runtime && typeof runtime.buildSyncDomainStates === 'function') {
      return runtime.buildSyncDomainStates({ journal, receipt, ackedDomains });
    }
    const out = {};
    const safeJournal = Array.isArray(journal) ? journal : [];
    const safeReceipt = receipt && typeof receipt === 'object' ? receipt : null;
    const safeAckedDomains = Array.isArray(ackedDomains) ? ackedDomains : [];
    const setDomainState = (domain, status, detail = '') => {
      const key = String(domain || '').trim();
      if (!key) return;
      out[key] = {
        status: String(status || '').trim() || 'unknown',
        detail: String(detail || '').trim(),
      };
    };
    if (safeReceipt && safeReceipt.domainStates && typeof safeReceipt.domainStates === 'object') {
      Object.entries(safeReceipt.domainStates).forEach(([domain, value]) => {
        setDomainState(domain, value && value.status, value && value.detail);
      });
    }
    safeAckedDomains.forEach((domain) => {
      setDomainState(domain, 'acked', '本地 mutation 已被远端确认');
    });
    safeJournal.forEach((entry) => {
      const revision = Number(entry && entry.revision ? entry.revision : 0);
      const domains = Array.isArray(entry && entry.domains) ? entry.domains : [];
      domains.forEach((domain) => {
        setDomainState(domain, 'pending', revision > 0 ? `本地 revision ${revision} 仍待远端确认` : '本地仍有未确认写入');
      });
    });
    return out;
  }

  function readLastSyncReceipt() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.syncLastReceipt) || 'null');
      return raw ? sanitizeSyncReceipt(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeLastSyncReceipt(receipt) {
    const runtime = getSyncRuntimeModules();
    try {
      if (!receipt || typeof receipt !== 'object') {
        localStorage.removeItem(STORAGE_KEYS.syncLastReceipt);
        return null;
      }
      const currentJournal = readSyncMutationJournal();
      const currentState = runtime && typeof runtime.getSyncMutationState === 'function'
        ? runtime.getSyncMutationState()
        : null;
      const safeReceipt = runtime && typeof runtime.buildSyncReceiptRecord === 'function'
        ? runtime.buildSyncReceiptRecord(receipt, {
            currentState,
            journal: currentJournal,
          })
        : sanitizeSyncReceipt({
            ...receipt,
            domainStates: buildSyncDomainStates({
              journal: currentJournal,
              receipt,
            }),
            entityStates: buildSyncEntityStates({
              journal: currentJournal,
              receipt,
            }),
          });
      localStorage.setItem(STORAGE_KEYS.syncLastReceipt, JSON.stringify(safeReceipt));
      return safeReceipt;
    } catch (error) {
      console.warn('[MorphStorage] Sync receipt write failed.', error);
      return null;
    }
  }

  function adoptBrowserSyncRootAsCurrentSource(data, options = {}) {
    const normalized = normalizeData(data);
    const revision = Number(normalized && normalized.syncMeta ? normalized.syncMeta.revision || 0 : 0);
    syncQueuedData = null;
    clearTimeout(syncTimer);
    writeSyncMutationJournal([]);
    if (Number.isFinite(revision) && revision > 0) {
      setLastAckRevision(revision);
    }
    syncWarned = false;
    return writeLastSyncReceipt({
      updatedAt: new Date().toISOString(),
      status: 'acked',
      source: String(options.source || 'browser-sync-root').trim() || 'browser-sync-root',
      reason: String(options.reason || 'browser_sync_root_loaded').trim() || 'browser_sync_root_loaded',
      message: String(options.message || '已载入用户目录').trim() || '已载入用户目录',
      ackedRevision: Number.isFinite(revision) && revision > 0 ? revision : getLastAckRevision(),
      pendingCount: 0,
      pendingDomains: [],
      mergedDomains: [],
      domainStates: {},
      entityStates: {},
    });
  }

  function recordPendingSyncMutation(data, options = {}) {
    const runtime = getSyncRuntimeModules();
    if (runtime && typeof runtime.recordPendingSyncMutation === 'function') {
      return runtime.recordPendingSyncMutation(data, options);
    }
    const normalized = ensureNormalizedDataSnapshot(data);
    const meta = normalized && normalized.syncMeta && typeof normalized.syncMeta === 'object' ? normalized.syncMeta : {};
    const revision = Number(meta.revision);
    if (!Number.isFinite(revision) || revision <= 0) return null;
    const domains = Array.isArray(options.domains)
      ? Array.from(new Set(options.domains.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 24)
      : [];
    const entityRefs = Array.isArray(options.entityRefs)
      ? options.entityRefs
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const domain = String(item.domain || '').trim();
            const entityType = String(item.entityType || '').trim();
            const entityId = String(item.entityId || '').trim();
            if (!domain && !entityType && !entityId) return null;
            return {
              domain,
              entityType,
              entityId,
              action: String(item.action || '').trim(),
              label: String(item.label || '').trim().slice(0, 120),
            };
          })
          .filter(Boolean)
          .slice(0, 48)
      : [];
    const buildDomainPayloads = (sourceData, touchedDomains) => {
      const safeDomains = Array.isArray(touchedDomains) ? touchedDomains : [];
      const payloads = {};
      safeDomains.forEach((domain) => {
        const key = String(domain || '').trim();
        if (!key) return;
        if (key === 'flashThoughts') {
          payloads[key] = {
            flashThoughts: Array.isArray(sourceData.flashThoughts) ? sourceData.flashThoughts : [],
            completedFlashThoughts: Array.isArray(sourceData.completedFlashThoughts) ? sourceData.completedFlashThoughts : [],
          };
          return;
        }
        if (key === 'fixedThoughts') {
          payloads[key] = {
            fixed: Array.isArray(sourceData.fixed) ? sourceData.fixed : [],
            completedFixedThoughts: Array.isArray(sourceData.completedFixedThoughts) ? sourceData.completedFixedThoughts : [],
          };
          return;
        }
        if (key === 'reminders') {
          payloads[key] = Array.isArray(sourceData.reminders) ? sourceData.reminders : [];
          return;
        }
        if (key === 'projectSpaces') {
          payloads[key] = Array.isArray(sourceData.projectSpaces) ? sourceData.projectSpaces : [];
          return;
        }
        if (key === 'projects') {
          payloads[key] = {
            projectQueueLanesVersion: Number.isFinite(Number(sourceData.projectQueueLanesVersion)) ? Number(sourceData.projectQueueLanesVersion) : 0,
            projectQueueLanes: Array.isArray(sourceData.projectQueueLanes) ? sourceData.projectQueueLanes : [],
            projects: Array.isArray(sourceData.projects) ? sourceData.projects : [],
          };
          return;
        }
        if (key === 'routines') {
          payloads[key] = Array.isArray(sourceData.routines) ? sourceData.routines : [];
          return;
        }
        if (key === 'rhythm') {
          payloads[key] = sourceData && sourceData.scheduleMvp && typeof sourceData.scheduleMvp === 'object' ? sourceData.scheduleMvp : {};
          return;
        }
        if (key === 'sops') {
          payloads[key] = Array.isArray(sourceData.sops) ? sourceData.sops : [];
          return;
        }
        if (key === 'dailyMonths') {
          payloads[key] = sourceData && sourceData.dailyMonths && typeof sourceData.dailyMonths === 'object' ? sourceData.dailyMonths : {};
          return;
        }
        if (key === 'expenseLedger') {
          payloads[key] = sourceData && sourceData.expenseLedger && typeof sourceData.expenseLedger === 'object'
            ? {
                categories: Array.isArray(sourceData.expenseLedger.categories) ? sourceData.expenseLedger.categories : [],
                records: Array.isArray(sourceData.expenseLedger.records) ? sourceData.expenseLedger.records : [],
              }
            : { categories: [], records: [] };
          return;
        }
        if (key === 'aiChatSessions') {
          const slimmedAIMemory = slimPersistedAIChatSessions(
            sourceData && sourceData.aiMemory ? { ...sourceData.aiMemory } : null,
            {
              maxSessions: SYNC_JOURNAL_AI_CHAT_MAX_SESSIONS,
              maxMessages: SYNC_JOURNAL_AI_CHAT_MAX_MESSAGES,
            }
          );
          payloads[key] = Array.isArray(slimmedAIMemory?.chatSessions) ? slimmedAIMemory.chatSessions : [];
          return;
        }
        if (key === 'aiDailyLogs') {
          payloads[key] = sourceData && sourceData.aiMemory ? sourceData.aiMemory.dailyLogs || {} : {};
          return;
        }
        if (key === 'aiCurrentChatSessionId') {
          payloads[key] = String(sourceData && sourceData.aiMemory ? sourceData.aiMemory.currentChatSessionId || '' : '');
        }
      });
      return payloads;
    };
    const entry = {
      mutationId: `rev:${revision}:${String(meta.deviceId || getSyncDeviceId()).trim() || 'unknown'}`,
      revision,
      lastClientWriteAt: String(meta.lastClientWriteAt || '').trim(),
      deviceId: String(meta.deviceId || getSyncDeviceId()).trim(),
      createdAt: new Date().toISOString(),
      domains,
      entityRefs,
      domainPayloads: buildDomainPayloads(normalized, domains),
    };
    const current = readSyncMutationJournal().filter((item) => Number(item && item.revision ? item.revision : 0) !== revision);
    current.push(entry);
    writeSyncMutationJournal(current);
    return entry;
  }

  function getPendingSyncMutations(limit = 40) {
    const journal = readSyncMutationJournal();
    const max = Math.max(1, Math.min(120, Number(limit) || 40));
    return journal.slice(-max).map((entry) => ({
      mutationId: String(entry.mutationId || '').trim(),
      revision: Number(entry.revision || 0),
      deviceId: String(entry.deviceId || '').trim(),
      lastClientWriteAt: String(entry.lastClientWriteAt || '').trim(),
      createdAt: String(entry.createdAt || '').trim(),
      domains: Array.isArray(entry.domains) ? entry.domains.slice(0, 24) : [],
      entityRefs: Array.isArray(entry.entityRefs) ? entry.entityRefs.slice(0, 48) : [],
      domainPayloads: entry.domainPayloads && typeof entry.domainPayloads === 'object'
        ? JSON.parse(JSON.stringify(entry.domainPayloads))
        : {},
    }));
  }

  function acknowledgeSyncMutationsThroughRevision(revision) {
    const runtime = getSyncRuntimeModules();
    if (runtime && typeof runtime.acknowledgeSyncMutationsThroughRevision === 'function') {
      return runtime.acknowledgeSyncMutationsThroughRevision(revision);
    }
    const safeRevision = Number(revision);
    if (!Number.isFinite(safeRevision) || safeRevision <= 0) {
      const currentJournal = readSyncMutationJournal();
      const currentReceipt = readLastSyncReceipt();
      return {
        ackedRevision: getLastAckRevision(),
        pendingCount: currentJournal.length,
        ackedDomains: [],
        ackedEntityRefs: [],
        domainStates: buildSyncDomainStates({
          journal: currentJournal,
          receipt: currentReceipt,
        }),
        entityStates: buildSyncEntityStates({
          journal: currentJournal,
          receipt: currentReceipt,
        }),
      };
    }
    const journal = readSyncMutationJournal();
    const ackedEntries = journal.filter((entry) => Number(entry && entry.revision ? entry.revision : 0) <= safeRevision);
    const remaining = journal.filter((entry) => Number(entry && entry.revision ? entry.revision : 0) > safeRevision);
    writeSyncMutationJournal(remaining);
    setLastAckRevision(safeRevision);
    const ackedDomains = Array.from(new Set(ackedEntries.flatMap((entry) => (
      Array.isArray(entry && entry.domains) ? entry.domains : []
    ))));
    const ackedEntityRefs = ackedEntries.flatMap((entry) => (
      Array.isArray(entry && entry.entityRefs) ? entry.entityRefs : []
    ));
    const currentReceipt = readLastSyncReceipt();
    const domainStates = buildSyncDomainStates({
      journal: remaining,
      receipt: currentReceipt,
      ackedDomains,
    });
    const entityStates = buildSyncEntityStates({
      journal: remaining,
      receipt: currentReceipt,
      ackedEntityRefs,
    });
    if (currentReceipt) {
      writeLastSyncReceipt({
        ...currentReceipt,
        updatedAt: new Date().toISOString(),
        ackedRevision: Math.max(getLastAckRevision(), safeRevision),
        pendingCount: remaining.length,
        pendingDomains: Array.from(new Set(remaining.flatMap((entry) => (
          Array.isArray(entry && entry.domains) ? entry.domains : []
        )))),
        mergedDomains: Array.isArray(currentReceipt.mergedDomains) && currentReceipt.mergedDomains.length
          ? currentReceipt.mergedDomains
          : ackedDomains,
        domainStates,
        entityStates,
      });
    }
    return {
      ackedRevision: Math.max(getLastAckRevision(), safeRevision),
      pendingCount: remaining.length,
      ackedDomains,
      ackedEntityRefs,
      domainStates,
      entityStates,
    };
  }

  function acknowledgeSyncMutationsByIds(mutationIds = [], fallbackRevision = 0) {
    const runtime = getSyncRuntimeModules();
    if (runtime && typeof runtime.acknowledgeSyncMutationsByIds === 'function') {
      return runtime.acknowledgeSyncMutationsByIds(mutationIds, fallbackRevision);
    }
    const ids = new Set((Array.isArray(mutationIds) ? mutationIds : []).map((item) => String(item || '').trim()).filter(Boolean));
    if (!ids.size) return acknowledgeSyncMutationsThroughRevision(fallbackRevision);
    const journal = readSyncMutationJournal();
    const ackedEntries = journal.filter((entry) => ids.has(String(entry && entry.mutationId ? entry.mutationId : '').trim()));
    const remaining = journal.filter((entry) => !ids.has(String(entry && entry.mutationId ? entry.mutationId : '').trim()));
    const maxAckedRevision = ackedEntries.reduce((max, entry) => Math.max(max, Number(entry && entry.revision ? entry.revision : 0)), Number(fallbackRevision) || 0);
    writeSyncMutationJournal(remaining);
    if (maxAckedRevision > 0) setLastAckRevision(maxAckedRevision);
    const ackedDomains = Array.from(new Set(ackedEntries.flatMap((entry) => (
      Array.isArray(entry && entry.domains) ? entry.domains : []
    ))));
    const ackedEntityRefs = ackedEntries.flatMap((entry) => (
      Array.isArray(entry && entry.entityRefs) ? entry.entityRefs : []
    ));
    const currentReceipt = readLastSyncReceipt();
    const domainStates = buildSyncDomainStates({
      journal: remaining,
      receipt: currentReceipt,
      ackedDomains,
    });
    const entityStates = buildSyncEntityStates({
      journal: remaining,
      receipt: currentReceipt,
      ackedEntityRefs,
    });
    if (currentReceipt) {
      writeLastSyncReceipt({
        ...currentReceipt,
        updatedAt: new Date().toISOString(),
        ackedRevision: Math.max(getLastAckRevision(), maxAckedRevision),
        pendingCount: remaining.length,
        pendingDomains: Array.from(new Set(remaining.flatMap((entry) => (
          Array.isArray(entry && entry.domains) ? entry.domains : []
        )))),
        mergedDomains: Array.isArray(currentReceipt.mergedDomains) && currentReceipt.mergedDomains.length
          ? currentReceipt.mergedDomains
          : ackedDomains,
        domainStates,
        entityStates,
      });
    }
    return {
      ackedRevision: Math.max(getLastAckRevision(), maxAckedRevision),
      pendingCount: remaining.length,
      ackedDomains,
      ackedEntityRefs,
      domainStates,
      entityStates,
    };
  }

  function getSyncMutationState() {
    const runtime = getSyncRuntimeModules();
    if (runtime && typeof runtime.getSyncMutationState === 'function') {
      return runtime.getSyncMutationState();
    }
    const journal = readSyncMutationJournal();
    const ackedRevision = getLastAckRevision();
    const lastReceipt = readLastSyncReceipt();
    const pendingDomains = Array.from(new Set(journal.flatMap((entry) => (
      Array.isArray(entry && entry.domains) ? entry.domains : []
    ))));
    const pendingEntityRefs = journal.flatMap((entry) => (
      Array.isArray(entry && entry.entityRefs) ? entry.entityRefs : []
    ));
    return {
      ackedRevision,
      pendingCount: journal.length,
      latestPendingRevision: journal.length ? Number(journal[journal.length - 1].revision || 0) : 0,
      pendingDomains,
      pendingEntityRefs,
      pendingEntityCount: pendingEntityRefs.length,
      pendingMutations: journal.slice(-40).map((entry) => ({
        mutationId: String(entry.mutationId || '').trim(),
        revision: Number(entry.revision || 0),
        domains: Array.isArray(entry.domains) ? entry.domains.slice(0, 24) : [],
        entityRefs: Array.isArray(entry.entityRefs) ? entry.entityRefs.slice(0, 48) : [],
        domainPayloads: entry.domainPayloads && typeof entry.domainPayloads === 'object'
          ? JSON.parse(JSON.stringify(entry.domainPayloads))
          : {},
      })),
      domainStates: buildSyncDomainStates({
        journal,
        receipt: lastReceipt,
      }),
      entityStates: buildSyncEntityStates({
        journal,
        receipt: lastReceipt,
      }),
      journal,
      lastReceipt,
    };
  }

  function slimPersistedAIChatMessageMeta(meta) {
    if (!meta || typeof meta !== 'object') return null;
    const sanitizeTimeBlock = (block = null) => ({
      startTime: String(block?.startTime || '').trim(),
      endTime: String(block?.endTime || '').trim(),
      title: String(block?.title || '').trim().slice(0, 80),
      notes: String(block?.notes || '').trim().slice(0, 160),
    });
    const sanitizeCreatedItem = (item = null) => {
      const tab = String(item?.tab || '').trim();
      const nextItem = {
        id: String(item?.id || '').trim(),
        type: String(item?.type || '').trim(),
        tab,
        title: String(item?.title || item?.name || item?.text || '').trim().slice(0, 120),
      };
      if (tab === 'timeBlocks') {
        nextItem.date = String(item?.date || '').trim();
        nextItem.blocks = (Array.isArray(item?.blocks) ? item.blocks : [])
          .map(sanitizeTimeBlock)
          .filter((block) => block.startTime && block.endTime && block.title)
          .slice(0, 18);
      } else if (tab === 'weekTimeBlocks') {
        nextItem.startDate = String(item?.startDate || '').trim();
        nextItem.endDate = String(item?.endDate || '').trim();
        nextItem.rangeType = String(item?.rangeType || '').trim();
        nextItem.dayCount = Math.max(0, Number(item?.dayCount || 0) || 0);
        nextItem.days = (Array.isArray(item?.days) ? item.days : [])
          .map((day) => ({
            date: String(day?.date || '').trim(),
            blocks: (Array.isArray(day?.blocks) ? day.blocks : [])
              .map(sanitizeTimeBlock)
              .filter((block) => block.startTime && block.endTime && block.title)
              .slice(0, 6),
          }))
          .filter((day) => day.date && day.blocks.length)
          .slice(0, 10);
      }
      return nextItem;
    };
    const normalizedActionTypes = Array.isArray(meta.actionTypes)
      ? meta.actionTypes.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
      : [];
    const hasOnlyPlanActionTypes = normalizedActionTypes.length > 0
      && normalizedActionTypes.every((item) => /^plan_/i.test(item));
    const hasOnlyReadActionTypes = normalizedActionTypes.length > 0
      && normalizedActionTypes.every((item) => /^(list_|summarize_)/i.test(item));
    const shouldPersistTransactionSurface = !(hasOnlyPlanActionTypes || hasOnlyReadActionTypes);
    const next = {};
    if (Array.isArray(meta.attachments) && meta.attachments.length) {
      next.attachments = meta.attachments
        .filter((item) => item && typeof item === 'object')
        .slice(0, 6)
        .map((item) => ({
          id: String(item.id || '').trim(),
          name: String(item.name || '').trim(),
          title: String(item.title || '').trim(),
          topic: String(item.topic || '').trim(),
          ext: String(item.ext || '').trim(),
          mode: String(item.mode || '').trim(),
          size: Number(item.size || 0) || 0,
        }));
    }
    if (Array.isArray(meta.actions) && meta.actions.length) {
      next.actions = meta.actions.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8);
    }
    if (normalizedActionTypes.length) next.actionTypes = normalizedActionTypes;
    if (Array.isArray(meta.createdItems) && meta.createdItems.length) {
      next.createdItems = meta.createdItems
        .filter((item) => item && typeof item === 'object')
        .slice(0, 12)
        .map(sanitizeCreatedItem);
    }
    if (Array.isArray(meta.citations) && meta.citations.length) {
      next.citations = meta.citations
        .filter((item) => item && typeof item === 'object')
        .slice(0, 8)
        .map((item) => ({
          id: String(item.id || '').trim(),
          label: String(item.label || '').trim(),
          title: String(item.title || '').trim(),
          path: String(item.path || '').trim(),
          tab: String(item.tab || '').trim(),
        }));
    }
    if (shouldPersistTransactionSurface && meta.undoHint) next.undoHint = String(meta.undoHint || '').trim().slice(0, 160);
    if (shouldPersistTransactionSurface && meta.receiptSummary) next.receiptSummary = String(meta.receiptSummary || '').trim().slice(0, 240);
    if (shouldPersistTransactionSurface && meta.transactionId) next.transactionId = String(meta.transactionId || '').trim().slice(0, 120);
    if (meta.timingTrace && typeof meta.timingTrace === 'object') {
      const phases = Array.isArray(meta.timingTrace.phases)
        ? meta.timingTrace.phases
          .filter((item) => item && typeof item === 'object')
          .slice(0, 12)
          .map((item) => ({
            key: String(item.key || '').trim(),
            ms: Math.max(0, Number(item.ms || 0) || 0),
          }))
          .filter((item) => item.key)
        : [];
      next.timingTrace = {
        totalMs: Math.max(0, Number(meta.timingTrace.totalMs || 0) || 0),
        visibleReplyMs: Math.max(0, Number(meta.timingTrace.visibleReplyMs || 0) || 0),
        path: String(meta.timingTrace.path || '').trim().slice(0, 80),
        latencyMode: String(meta.timingTrace.latencyMode || '').trim().slice(0, 32),
        provider: String(meta.timingTrace.provider || '').trim().slice(0, 48),
        phases,
      };
    }
    if (meta.aiRequestTrace && typeof meta.aiRequestTrace === 'object') {
      const requests = Array.isArray(meta.aiRequestTrace.requests)
        ? meta.aiRequestTrace.requests
          .filter((item) => item && typeof item === 'object')
          .slice(0, 8)
          .map((item) => ({
            provider: String(item.provider || '').trim().slice(0, 48),
            model: String(item.model || '').trim().slice(0, 80),
            requestKind: String(item.requestKind || '').trim().slice(0, 24),
            transport: String(item.transport || '').trim().slice(0, 24),
            status: String(item.status || '').trim().slice(0, 24),
            stream: item.stream === true,
            durationMs: Math.max(0, Number(item.durationMs || 0) || 0),
            promptTokens: Math.max(0, Number(item.promptTokens || 0) || 0),
            completionTokens: Math.max(0, Number(item.completionTokens || 0) || 0),
            totalTokens: Math.max(0, Number(item.totalTokens || 0) || 0),
            tokenSource: String(item.tokenSource || '').trim().slice(0, 24),
          }))
        : [];
      next.aiRequestTrace = {
        path: String(meta.aiRequestTrace.path || '').trim().slice(0, 80),
        totalDurationMs: Math.max(0, Number(meta.aiRequestTrace.totalDurationMs || 0) || 0),
        requestCount: Math.max(0, Number(meta.aiRequestTrace.requestCount || requests.length) || requests.length),
        totalTokens: Math.max(0, Number(meta.aiRequestTrace.totalTokens || 0) || 0),
        promptTokens: Math.max(0, Number(meta.aiRequestTrace.promptTokens || 0) || 0),
        completionTokens: Math.max(0, Number(meta.aiRequestTrace.completionTokens || 0) || 0),
        requests,
      };
    }
    if (meta.createdAt) next.createdAt = String(meta.createdAt || '').trim();
    if (meta.updatedAt) next.updatedAt = String(meta.updatedAt || '').trim();
    if (meta.time) next.time = String(meta.time || '').trim();
    if (meta.ts) next.ts = String(meta.ts || '').trim();
    return Object.keys(next).length ? next : null;
  }

  function slimPersistedAIChatSessions(aiMemory, options = {}) {
    const target = aiMemory && typeof aiMemory === 'object' ? aiMemory : null;
    if (!target) return target;
    const maxSessions = Math.max(1, Number(options.maxSessions) || PERSISTED_AI_CHAT_MAX_SESSIONS);
    const maxMessages = Math.max(1, Number(options.maxMessages) || PERSISTED_AI_CHAT_MAX_MESSAGES);
    const sessionRuntime = getAISessionStateRuntimeModules();
    if (sessionRuntime && typeof sessionRuntime.normalizeAISessionCoreState === 'function') {
      sessionRuntime.normalizeAISessionCoreState(target, {
        normalizeChatSessions: true,
        maxChatSessions: maxSessions,
      });
    }
    const sessions = Array.isArray(target.chatSessions)
      ? target.chatSessions.filter((item) => item && typeof item === 'object')
      : [];
    if (!sessions.length) {
      target.chatSessions = [];
      if (target.currentChatSessionId) target.currentChatSessionId = '';
      return target;
    }
    const currentSessionId = String(target.currentChatSessionId || '').trim();
    let keptSessions = sessions.slice(-maxSessions);
    if (currentSessionId && !keptSessions.some((item) => String(item.id || '').trim() === currentSessionId)) {
      const currentSession = sessions.find((item) => String(item.id || '').trim() === currentSessionId);
      if (currentSession) {
        keptSessions = maxSessions > 1
          ? keptSessions.slice(-(maxSessions - 1)).concat(currentSession)
          : [currentSession];
      }
    }
    target.chatSessions = keptSessions.map((session) => ({
      ...session,
      messages: (Array.isArray(session.messages) ? session.messages : [])
        .filter((item) => item && typeof item === 'object')
        .slice(-maxMessages)
        .map((message) => ({
          ...message,
          meta: slimPersistedAIChatMessageMeta(message.meta),
        })),
    }));
    if (currentSessionId && !target.chatSessions.some((item) => String(item.id || '').trim() === currentSessionId)) {
      target.currentChatSessionId = String(target.chatSessions[target.chatSessions.length - 1]?.id || '').trim();
    }
    return target;
  }

  function shouldCompactPersistedRichHTML(html = '') {
    const text = String(html || '').trim();
    if (!text) return false;
    if (/data:image\/|base64,/i.test(text)) return true;
    return text.length > 120 * 1024;
  }

  function markNormalizedDataSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return snapshot;
    try {
      if (snapshot[NORMALIZED_DATA_SNAPSHOT_FLAG] === true) return snapshot;
      Object.defineProperty(snapshot, NORMALIZED_DATA_SNAPSHOT_FLAG, {
        value: true,
        configurable: true,
      });
    } catch (_) {}
    return snapshot;
  }

  function isNormalizedDataSnapshot(snapshot) {
    return !!(snapshot && typeof snapshot === 'object' && snapshot[NORMALIZED_DATA_SNAPSHOT_FLAG] === true);
  }

  function ensureNormalizedDataSnapshot(snapshot) {
    return isNormalizedDataSnapshot(snapshot) ? snapshot : normalizeData(snapshot);
  }

  function buildPersistenceSerializationReplacer(normalized = null) {
    const aiMemory = normalized && typeof normalized === 'object' && normalized.aiMemory && typeof normalized.aiMemory === 'object'
      ? normalized.aiMemory
      : null;
    const longTermMemory = aiMemory && aiMemory.longTermMemory && typeof aiMemory.longTermMemory === 'object'
      ? aiMemory.longTermMemory
      : null;
    const mirroredLongTermMemoryKeys = new Set();
    if (aiMemory && longTermMemory) {
      ['identityNotes', 'user', 'memoryIndex', 'systemNotes'].forEach((key) => {
        if (typeof aiMemory[key] === 'string' && aiMemory[key] && longTermMemory[key] === aiMemory[key]) {
          mirroredLongTermMemoryKeys.add(key);
        }
      });
      if (
        aiMemory.dailyLogs
        && typeof aiMemory.dailyLogs === 'object'
        && longTermMemory.dailyLogs === aiMemory.dailyLogs
      ) {
        mirroredLongTermMemoryKeys.add('dailyLogs');
      }
    }
    return function persistenceSerializationReplacer(key, value) {
      if (key === 'html' && typeof value === 'string' && shouldCompactPersistedRichHTML(value)) {
        return undefined;
      }
      if (this === longTermMemory && mirroredLongTermMemoryKeys.has(key)) {
        return undefined;
      }
      return value;
    };
  }

  function serializeDataForPersistence(data, options = {}) {
    const normalized = data && typeof data === 'object' ? ensureNormalizedDataSnapshot(data) : cloneDefaultData();
    const payload = JSON.parse(JSON.stringify(normalized, buildPersistenceSerializationReplacer(normalized)));
    const maxSessions = Math.max(1, Number(options.maxSessions) || PERSISTED_AI_CHAT_MAX_SESSIONS);
    const maxMessages = Math.max(1, Number(options.maxMessages) || PERSISTED_AI_CHAT_MAX_MESSAGES);
    slimPersistedAIChatSessions(payload.aiMemory, {
      maxSessions,
      maxMessages,
    });
    payload.editorHistory = { daily: {}, project: {} };
    payload.editorHistoryCursor = { daily: {}, project: {} };
    return payload;
  }

  function unwrapBootEnvelope(input) {
    if (!input || typeof input !== 'object') return input;
    if (input.envelope && typeof input.envelope === 'object') return input.envelope;
    return input;
  }

  function normalizeBootPayload(input) {
    const envelope = unwrapBootEnvelope(input);
    const source = envelope && typeof envelope === 'object' && envelope.data && typeof envelope.data === 'object'
      ? envelope.data
      : envelope;
    if (!source || typeof source !== 'object') return null;
    return ensureNormalizedDataSnapshot(source);
  }

  function buildStartupSnapshotReferenceData(data) {
    const normalized = ensureNormalizedDataSnapshot(data);
    const syncMeta = normalized.syncMeta && typeof normalized.syncMeta === 'object'
      ? JSON.parse(JSON.stringify(normalized.syncMeta))
      : {};
    return {
      __morphStartupSnapshotReference: true,
      kind: STARTUP_SNAPSHOT_REFERENCE_KIND,
      version: STARTUP_SNAPSHOT_REFERENCE_VERSION,
      targetStorageKey: STORAGE_KEYS.data,
      createdAt: new Date().toISOString(),
      syncMeta,
    };
  }

  function isStartupSnapshotReferencePayload(payload = null) {
    return !!(
      payload
      && typeof payload === 'object'
      && payload.__morphStartupSnapshotReference === true
      && String(payload.kind || '') === STARTUP_SNAPSHOT_REFERENCE_KIND
      && Number(payload.version || 0) === STARTUP_SNAPSHOT_REFERENCE_VERSION
    );
  }

  function readLocalDataCacheForStartupSnapshot() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.data);
      const parsed = raw ? JSON.parse(raw) : null;
      return normalizeBootPayload(parsed);
    } catch (_) {
      return null;
    }
  }

  function resolveStartupSnapshotReferenceData(pointer = null) {
    if (!isStartupSnapshotReferencePayload(pointer)) return null;
    const targetKey = String(pointer.targetStorageKey || '').trim() || STORAGE_KEYS.data;
    if (targetKey !== STORAGE_KEYS.data) return null;
    return readLocalDataCacheForStartupSnapshot();
  }

  function parseBootPayloadRevision(payload = null) {
    const value = Number(payload?.syncMeta?.revision || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function parseBootPayloadWriteTime(payload = null) {
    const raw = String(
      payload?.syncMeta?.lastClientWriteAt
      || payload?.syncMeta?.lastServerWriteAt
      || payload?.syncMeta?.updatedAt
      || ''
    ).trim();
    if (!raw) return 0;
    const value = Date.parse(raw);
    return Number.isFinite(value) ? value : 0;
  }

  function isBootPayloadAtLeastAsFresh(left = null, right = null) {
    const leftRevision = parseBootPayloadRevision(left);
    const rightRevision = parseBootPayloadRevision(right);
    if (leftRevision !== rightRevision) return leftRevision > rightRevision;
    return parseBootPayloadWriteTime(left) >= parseBootPayloadWriteTime(right);
  }

  function maybeCompactLoadedStartupSnapshotData(snapshot = null) {
    if (!snapshot || typeof snapshot !== 'object') return snapshot;
    const localCache = readLocalDataCacheForStartupSnapshot();
    if (!localCache || !isBootPayloadAtLeastAsFresh(localCache, snapshot)) return snapshot;
    writeStartupSnapshotData(localCache, {
      referenceLocalCache: true,
    });
    return localCache;
  }

  function buildStartupSnapshotData(data, options = {}) {
    if (options && options.referenceLocalCache === true) {
      return buildStartupSnapshotReferenceData(data);
    }
    return serializeDataForPersistence(ensureNormalizedDataSnapshot(data), {
      maxSessions: STARTUP_SNAPSHOT_AI_CHAT_MAX_SESSIONS,
      maxMessages: STARTUP_SNAPSHOT_AI_CHAT_MAX_MESSAGES,
    });
  }

  function writeStartupSnapshotData(data, options = {}) {
    try {
      localStorage.setItem(STORAGE_KEYS.startupSnapshot, JSON.stringify(buildStartupSnapshotData(data, options)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function writeLocalDataCacheReplica(data) {
    try {
      localStorage.setItem(STORAGE_KEYS.data, JSON.stringify(serializeDataForPersistence(data)));
      return true;
    } catch (error) {
      console.warn('[MorphStorage] Full local cache write failed; continuing with startup snapshot fallback.', error);
      return false;
    }
  }

  function clearLocalDataCacheReplica() {
    try {
      localStorage.removeItem(STORAGE_KEYS.data);
      return true;
    } catch (_) {
      return false;
    }
  }

  function writeLocalCacheReplicas(data, editorHistoryState = null) {
    const normalized = ensureNormalizedDataSnapshot(data);
    const editorHistory = editorHistoryState || extractEditorHistoryStateFromData(normalized);
    const fullCacheWritten = writeLocalDataCacheReplica(normalized);
    let startupWritten = writeStartupSnapshotData(normalized, {
      referenceLocalCache: fullCacheWritten,
    });
    if (!startupWritten && fullCacheWritten) {
      startupWritten = writeStartupSnapshotData(normalized);
    }
    if (!startupWritten && !fullCacheWritten) {
      const reclaimed = clearLocalDataCacheReplica();
      if (reclaimed) {
        console.warn('[MorphStorage] Reclaimed stale full local cache replica to preserve startup snapshot freshness.');
        startupWritten = writeStartupSnapshotData(normalized);
      }
    }
    if (!startupWritten) {
      console.warn('[MorphStorage] Startup snapshot cache write failed.', new Error('startup_snapshot_write_failed'));
    }
    writeLocalEditorHistoryState(editorHistory);
    return normalized;
  }

  function extractBootstrapCacheMeta(payload) {
    const source = payload && typeof payload === 'object' ? payload : null;
    const bootstrapSource = source && typeof source.bootstrapSource === 'string'
      ? source.bootstrapSource
      : '';
    const startupDescriptor = source && source.startupDescriptor && typeof source.startupDescriptor === 'object'
      ? source.startupDescriptor
      : null;
    return {
      bootstrapSource,
      startupDescriptor,
    };
  }

  function readBootstrapCacheEntry() {
    if (typeof window === 'undefined') return null;
    let payload = window.__MORPH_BOOTSTRAP_CACHE;
    let normalized = normalizeBootPayload(payload);
    if (normalized) {
      const meta = extractBootstrapCacheMeta(payload);
      try {
        window.__MORPH_BOOTSTRAP_CACHE = null;
        window.__LianXingBootstrapCache = null;
      } catch (_) {}
      try {
        const node = typeof document !== 'undefined'
          ? document.getElementById('morph-bootstrap-cache-data')
          : null;
        if (node) node.textContent = 'null';
      } catch (_) {}
      return {
        data: normalized,
        bootstrapSource: meta.bootstrapSource,
        startupDescriptor: meta.startupDescriptor,
      };
    }
    try {
      const node = typeof document !== 'undefined'
        ? document.getElementById('morph-bootstrap-cache-data')
        : null;
      const text = String(node?.textContent || '').trim();
      payload = text ? JSON.parse(text) : null;
      normalized = normalizeBootPayload(payload);
      if (normalized) {
        const meta = extractBootstrapCacheMeta(payload);
        try {
          if (node) node.textContent = 'null';
        } catch (_) {}
        return {
          data: normalized,
          bootstrapSource: meta.bootstrapSource,
          startupDescriptor: meta.startupDescriptor,
        };
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  function readBootstrapCacheData() {
    const entry = readBootstrapCacheEntry();
    return entry ? entry.data : null;
  }

  function loadStartupSnapshotData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.startupSnapshot);
      const parsed = raw ? JSON.parse(raw) : null;
      if (isStartupSnapshotReferencePayload(parsed)) {
        return resolveStartupSnapshotReferenceData(parsed);
      }
      return maybeCompactLoadedStartupSnapshotData(normalizeBootPayload(parsed));
    } catch (_) {
      return null;
    }
  }

  function loadAuthoritativeStartupDataDescriptor() {
    return getStartupStorageRuntimeModules().loadAuthoritativeStartupDataDescriptor();
  }

  function loadAuthoritativeStartupData() {
    return getStartupStorageRuntimeModules().loadAuthoritativeStartupData();
  }

  function releaseAuthoritativeStartupData() {
    return getStartupStorageRuntimeModules().releaseAuthoritativeStartupData();
  }

  function getSingleSourceOfTruthDescriptor() {
    return getStartupStorageRuntimeModules().getSingleSourceOfTruthDescriptor();
  }

  function getStartupStorageDescriptor() {
    return getStartupStorageRuntimeModules().getStartupStorageDescriptor();
  }

  function flushLocalCacheWriteNow() {
    if (!pendingLocalCacheWrite) return;
    const source = pendingLocalCacheWrite;
    pendingLocalCacheWrite = null;
    if (localCacheWriteTimer) {
      if (localCacheWriteTimerMode === 'idle' && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(localCacheWriteTimer);
      } else {
        clearTimeout(localCacheWriteTimer);
      }
      localCacheWriteTimer = null;
      localCacheWriteTimerMode = '';
    }
    try {
      writeLocalCacheReplicas(source);
    } catch (error) {
      console.warn('[MorphStorage] Local cache write failed, continuing with sync only.', error);
    }
  }

  function scheduleLocalCacheWrite(data, options = {}) {
    pendingLocalCacheWrite = data;
    const immediate = !!options.immediate;
    if (immediate) {
      flushLocalCacheWriteNow();
      return;
    }
    if (localCacheWriteTimer) return;
    const run = () => {
      localCacheWriteTimer = null;
      localCacheWriteTimerMode = '';
      flushLocalCacheWriteNow();
    };
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      localCacheWriteTimer = window.requestIdleCallback(run, { timeout: 600 });
      localCacheWriteTimerMode = 'idle';
      return;
    }
    localCacheWriteTimer = setTimeout(run, 180);
    localCacheWriteTimerMode = 'timeout';
  }

  function sanitizeProactiveAgentConfig(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : {
          enabled: true,
          heartbeatMinutes: 60,
          minNotifyGapMinutes: 18,
          maxFindingsPerScan: 3,
          soonReminderMinutes: 45,
          overdueReminderMinutes: 15,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          runWhenHidden: false,
          autoPushToChat: false,
          autoWriteMemory: false,
        };
    const src = raw && typeof raw === 'object' ? raw : {};
    const clampInt = (value, min, max, def) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return def;
      return Math.max(min, Math.min(max, Math.round(n)));
    };
    const sanitizeClock = (value, def) => {
      const m = String(value || '').trim().match(/^(\d{1,2}):(\d{1,2})$/);
      if (!m) return def;
      const h = Math.max(0, Math.min(23, Number(m[1])));
      const mm = Math.max(0, Math.min(59, Number(m[2])));
      return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };
    const parseDurationMinutes = (value) => {
      if (value === null || typeof value === 'undefined') return null;
      if (typeof value === 'number' && Number.isFinite(value)) return Number(value);
      const rawText = String(value || '').trim().toLowerCase();
      if (!rawText) return null;
      const compact = rawText.replace(/\s+/g, '');
      const normalized = compact.replace(/^每/, '').replace(/(一次|1次|\/次)$/g, '');
      const zhHourMatched = normalized.match(/^(\d+(?:\.\d+)?)小时$/);
      if (zhHourMatched) return Number(zhHourMatched[1]) * 60;
      const zhMinuteMatched = normalized.match(/^(\d+(?:\.\d+)?)分钟$/);
      if (zhMinuteMatched) return Number(zhMinuteMatched[1]);
      const direct = Number(compact);
      if (Number.isFinite(direct)) return direct;
      const hourMatched = normalized.match(/^(\d+(?:\.\d+)?)(h|hr|hrs|hour|hours|小时)$/);
      if (hourMatched) return Number(hourMatched[1]) * 60;
      const minuteMatched = normalized.match(/^(\d+(?:\.\d+)?)(m|min|mins|minute|minutes|分钟)$/);
      if (minuteMatched) return Number(minuteMatched[1]);
      return null;
    };
    const parseActiveWindow = (value) => {
      const rawText = String(value || '').trim();
      if (!rawText) return null;
      const matched = rawText.match(/(\d{1,2}:\d{1,2})\s*[-~～到至]\s*(\d{1,2}:\d{1,2})/);
      if (!matched) return null;
      const start = sanitizeClock(matched[1], '');
      const end = sanitizeClock(matched[2], '');
      if (!start || !end) return null;
      return { start, end };
    };
    const heartbeatRaw = (
      parseDurationMinutes(src.heartbeatMinutes)
      ?? parseDurationMinutes(src.intervalMinutes)
      ?? parseDurationMinutes(src.heartbeatMins)
      ?? parseDurationMinutes(src.heartbeat)
      ?? parseDurationMinutes(src.interval)
      ?? parseDurationMinutes(src.cadence)
      ?? (Number.isFinite(Number(src.heartbeatHours)) ? Number(src.heartbeatHours) * 60 : null)
      ?? (Number.isFinite(Number(src.intervalHours)) ? Number(src.intervalHours) * 60 : null)
    );
    const defaultHeartbeatMinutes = clampInt(base.heartbeatMinutes, 1, 24 * 60, 60);
    const quietStartRaw = src.quietHoursStart ?? src.sleepStart ?? src.blockedStart;
    const quietEndRaw = src.quietHoursEnd ?? src.sleepEnd ?? src.blockedEnd;
    const activeStartRaw = src.activeWindowStart ?? src.activeHoursStart ?? src.workHoursStart;
    const activeEndRaw = src.activeWindowEnd ?? src.activeHoursEnd ?? src.workHoursEnd;
    const activeWindowRaw = src.activeWindow ?? src.activeHours ?? src.workHours;
    const fallbackQuietStart = sanitizeClock(base.quietHoursStart, '22:00');
    const fallbackQuietEnd = sanitizeClock(base.quietHoursEnd, '07:00');
    let quietHoursStart = sanitizeClock(quietStartRaw, fallbackQuietStart);
    let quietHoursEnd = sanitizeClock(quietEndRaw, fallbackQuietEnd);
    const parsedActiveWindow = parseActiveWindow(activeWindowRaw);
    if (activeStartRaw || activeEndRaw || parsedActiveWindow) {
      const activeStart = sanitizeClock(activeStartRaw, '07:00');
      const activeEnd = sanitizeClock(activeEndRaw, '22:00');
      const finalActiveStart = parsedActiveWindow?.start || activeStart;
      const finalActiveEnd = parsedActiveWindow?.end || activeEnd;
      quietHoursStart = finalActiveEnd;
      quietHoursEnd = finalActiveStart;
    }
    return {
      enabled: typeof src.enabled === 'boolean' ? src.enabled : !!base.enabled,
      heartbeatMinutes: heartbeatRaw === null ? defaultHeartbeatMinutes : clampInt(heartbeatRaw, 1, 24 * 60, defaultHeartbeatMinutes),
      minNotifyGapMinutes: clampInt(src.minNotifyGapMinutes, 3, 240, clampInt(base.minNotifyGapMinutes, 3, 240, 18)),
      maxFindingsPerScan: clampInt(src.maxFindingsPerScan, 1, 8, clampInt(base.maxFindingsPerScan, 1, 8, 3)),
      soonReminderMinutes: clampInt(src.soonReminderMinutes, 5, 180, clampInt(base.soonReminderMinutes, 5, 180, 45)),
      overdueReminderMinutes: clampInt(src.overdueReminderMinutes, 1, 180, clampInt(base.overdueReminderMinutes, 1, 180, 15)),
      quietHoursStart,
      quietHoursEnd,
      runWhenHidden: typeof src.runWhenHidden === 'boolean' ? src.runWhenHidden : !!base.runWhenHidden,
      autoPushToChat: typeof src.autoPushToChat === 'boolean' ? src.autoPushToChat : !!base.autoPushToChat,
      autoWriteMemory: typeof src.autoWriteMemory === 'boolean' ? src.autoWriteMemory : !!base.autoWriteMemory,
    };
  }

  function sanitizeSyncedUserPreferences(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object' ? fallback : {};
    const src = raw && typeof raw === 'object' ? raw : {};
    const normalizeTheme = (value) => {
      const text = String(value || '').trim().toLowerCase();
      return text === 'light' || text === 'dark' || text === 'system' ? text : '';
    };
    const normalizeProvider = (value) => {
      const text = String(value || '').trim().toLowerCase();
      return ['gemini', 'openrouter', 'glm', 'doubao', 'qwen', 'kimi', 'codex'].includes(text) ? text : '';
    };
    const normalizeClock = (value, fallbackValue = '') => {
      const matched = String(value || '').trim().match(/^(\d{1,2}):(\d{1,2})$/);
      if (!matched) return String(fallbackValue || '').trim();
      const hour = Math.max(0, Math.min(23, Number(matched[1])));
      const minute = Math.max(0, Math.min(59, Number(matched[2])));
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return String(fallbackValue || '').trim();
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    };
    const normalizeNullableBool = (value, fallbackValue = null) => {
      if (typeof value === 'boolean') return value;
      if (typeof fallbackValue === 'boolean') return fallbackValue;
      return null;
    };
    const normalizeDailyAlign = (value, fallbackValue = null) => {
      const fallbackObj = fallbackValue && typeof fallbackValue === 'object' ? fallbackValue : {};
      const source = value && typeof value === 'object' ? value : {};
      return {
        enabled: normalizeNullableBool(source.enabled, fallbackObj.enabled),
        time: normalizeClock(source.time, fallbackObj.time || ''),
        prompt: String(source.prompt || fallbackObj.prompt || '').trim(),
      };
    };
    const normalizeReminderSync = (value, fallbackValue = null) => {
      const fallbackObj = fallbackValue && typeof fallbackValue === 'object' ? fallbackValue : {};
      const source = value && typeof value === 'object' ? value : {};
      return {
        enabled: normalizeNullableBool(source.enabled, fallbackObj.enabled),
        endpoint: String(source.endpoint || fallbackObj.endpoint || '').trim(),
      };
    };
    const normalizeExtensionsState = (value, fallbackValue = null) => {
      const fallbackObj = fallbackValue && typeof fallbackValue === 'object' ? fallbackValue : {};
      const source = value && typeof value === 'object' ? value : {};
      const merged = { ...fallbackObj, ...source };
      const result = {};
      Object.keys(merged).forEach((key) => {
        const safeKey = String(key || '').trim();
        if (!safeKey) return;
        result[safeKey] = merged[key] === true;
      });
      return result;
    };
    const normalizeTTSProvider = (value, fallbackValue = '') => {
      const text = String(value || fallbackValue || '').trim().toLowerCase();
      return text === 'cosyvoice' ? 'cosyvoice' : text === 'none' ? 'none' : '';
    };
    const fallbackSchemaVersion = Number.isFinite(Number(base.schemaVersion)) ? Math.max(1, Math.round(Number(base.schemaVersion))) : 1;
    const parsedSchemaVersion = Number.isFinite(Number(src.schemaVersion)) ? Math.max(1, Math.round(Number(src.schemaVersion))) : fallbackSchemaVersion;
    return {
      schemaVersion: parsedSchemaVersion,
      lastUpdatedAt: String(src.lastUpdatedAt || base.lastUpdatedAt || '').trim(),
      themeMode: normalizeTheme(src.themeMode ?? base.themeMode),
      extensionsState: normalizeExtensionsState(src.extensionsState, base.extensionsState),
      aiProvider: normalizeProvider(src.aiProvider ?? base.aiProvider),
      dailyAlign: normalizeDailyAlign(src.dailyAlign, base.dailyAlign),
      reminderSync: normalizeReminderSync(src.reminderSync, base.reminderSync),
      ttsProvider: normalizeTTSProvider(src.ttsProvider, base.ttsProvider),
      aiAutoSpeak: normalizeNullableBool(src.aiAutoSpeak, base.aiAutoSpeak),
      webSearchProviderId: String(src.webSearchProviderId || base.webSearchProviderId || '').trim(),
    };
  }

  function sanitizeRelationshipReminderPreferences(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : {
          tone: 'gentle',
          frequency: 'balanced',
          lowStateStrategy: 'extra-gentle',
          customNote: '',
        };
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      tone: pick(src.tone, ['gentle', 'direct', 'minimal'], String(base.tone || 'gentle')),
      frequency: pick(src.frequency, ['balanced', 'important-only', 'follow-up'], String(base.frequency || 'balanced')),
      lowStateStrategy: pick(src.lowStateStrategy, ['extra-gentle', 'hold-back', 'stay-direct'], String(base.lowStateStrategy || 'extra-gentle')),
      customNote: String(src.customNote || base.customNote || '').trim(),
    };
  }

  function sanitizeRelationshipProactivityPreferences(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : {
          defaultMode: 'balanced',
          followUpStyle: 'ask-more',
          interruptionThreshold: 'balanced',
          customNote: '',
        };
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      defaultMode: pick(src.defaultMode, ['balanced', 'proactive', 'reserved'], String(base.defaultMode || 'balanced')),
      followUpStyle: pick(src.followUpStyle, ['ask-more', 'wait-more', 'only-when-stuck'], String(base.followUpStyle || 'ask-more')),
      interruptionThreshold: pick(src.interruptionThreshold, ['important-only', 'balanced', 'surface-early'], String(base.interruptionThreshold || 'balanced')),
      customNote: String(src.customNote || base.customNote || '').trim(),
    };
  }

  function sanitizeRelationshipBoundaryPreferences(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : {
          moneyDecisions: 'ask-first',
          publicSpeech: 'draft-only',
          healthJudgment: 'be-explicitly-cautious',
          uncertaintyStyle: 'say-uncertain',
          customNote: '',
        };
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      moneyDecisions: pick(src.moneyDecisions, ['ask-first', 'suggest-only', 'can-draft'], String(base.moneyDecisions || 'ask-first')),
      publicSpeech: pick(src.publicSpeech, ['never-send', 'draft-only', 'ask-before-send'], String(base.publicSpeech || 'draft-only')),
      healthJudgment: pick(src.healthJudgment, ['suggest-only', 'ask-first', 'be-explicitly-cautious'], String(base.healthJudgment || 'be-explicitly-cautious')),
      uncertaintyStyle: pick(src.uncertaintyStyle, ['say-uncertain', 'offer-options', 'pause-and-ask'], String(base.uncertaintyStyle || 'say-uncertain')),
      customNote: String(src.customNote || base.customNote || '').trim(),
    };
  }

  function sanitizeRelationshipLongTermFocusPreferences(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : {
          primaryFocus: 'balanced',
          supportStyle: 'steady-companion',
          horizon: 'this-season',
          customNote: '',
        };
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      primaryFocus: source.primaryFocus === 'steady-rhythm'
        ? 'steady-rhythm'
        : source.primaryFocus === 'project-delivery'
          ? 'project-delivery'
          : source.primaryFocus === 'health-stability'
            ? 'health-stability'
            : 'balanced',
      supportStyle: source.supportStyle === 'clarify-first'
        ? 'clarify-first'
        : source.supportStyle === 'push-forward'
          ? 'push-forward'
          : source.supportStyle === 'protect-boundaries'
            ? 'protect-boundaries'
            : 'steady-companion',
      horizon: source.horizon === 'this-week'
        ? 'this-week'
        : source.horizon === 'long-term'
          ? 'long-term'
          : 'this-season',
      customNote: typeof source.customNote === 'string' ? source.customNote : String(base.customNote || ''),
    };
  }

  function sanitizeBehaviorPlanningPreferences(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : {
          planningStyle: 'clarify-then-plan',
          certaintyStyle: 'separate-facts',
          granularity: 'top-three',
          customNote: '',
        };
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      planningStyle: pick(src.planningStyle, ['clarify-then-plan', 'direct-plan', 'minimum-next-step'], String(base.planningStyle || 'clarify-then-plan')),
      certaintyStyle: pick(src.certaintyStyle, ['separate-facts', 'more-decisive', 'stay-conservative'], String(base.certaintyStyle || 'separate-facts')),
      granularity: pick(src.granularity, ['top-three', 'time-blocks', 'full-steps'], String(base.granularity || 'top-three')),
      customNote: String(src.customNote || base.customNote || '').trim(),
    };
  }

  function sanitizeBehaviorMemoryPreferences(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : {
          captureMode: 'balanced',
          retentionMode: 'decisions-and-turning-points',
          recallMode: 'task-first',
          customNote: '',
        };
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      captureMode: pick(src.captureMode, ['important-only', 'balanced', 'rich-context'], String(base.captureMode || 'balanced')),
      retentionMode: pick(src.retentionMode, ['stable-preferences', 'decisions-and-turning-points', 'project-threads'], String(base.retentionMode || 'decisions-and-turning-points')),
      recallMode: pick(src.recallMode, ['task-first', 'recent-first', 'pattern-first'], String(base.recallMode || 'task-first')),
      customNote: String(src.customNote || base.customNote || '').trim(),
    };
  }

  function sanitizeBehaviorExpressionPreferences(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : {
          responseLength: 'balanced',
          structureStyle: 'structured',
          warmth: 'balanced',
          customNote: '',
        };
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      responseLength: pick(src.responseLength, ['concise', 'balanced', 'detailed'], String(base.responseLength || 'balanced')),
      structureStyle: pick(src.structureStyle, ['natural', 'structured', 'action-first'], String(base.structureStyle || 'structured')),
      warmth: pick(src.warmth, ['calm', 'balanced', 'encouraging'], String(base.warmth || 'balanced')),
      customNote: String(src.customNote || base.customNote || '').trim(),
    };
  }

  function sanitizeBehaviorFocusPreferences(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : {
          primaryAttention: 'current-context',
          retrievalPriority: 'active-items',
          reminderBias: 'important-first',
          customNote: '',
        };
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      primaryAttention: pick(src.primaryAttention, ['current-context', 'task-thread', 'long-term-balance'], String(base.primaryAttention || 'current-context')),
      retrievalPriority: pick(src.retrievalPriority, ['active-items', 'recent-signals', 'stable-patterns'], String(base.retrievalPriority || 'active-items')),
      reminderBias: pick(src.reminderBias, ['important-first', 'deadline-first', 'state-first'], String(base.reminderBias || 'important-first')),
      customNote: String(src.customNote || base.customNote || '').trim(),
    };
  }

  function sanitizeBehaviorSafetyPreferences(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : {
          dataWriteMode: 'explicit-only',
          selfUpdateMode: 'proposal-only',
          highRiskAdviceMode: 'strictly-conservative',
          customNote: '',
        };
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      dataWriteMode: pick(src.dataWriteMode, ['explicit-only', 'double-check-high-risk', 'assistive-draft'], String(base.dataWriteMode || 'explicit-only')),
      selfUpdateMode: pick(src.selfUpdateMode, ['proposal-only', 'runtime-only', 'off'], String(base.selfUpdateMode || 'proposal-only')),
      highRiskAdviceMode: pick(src.highRiskAdviceMode, ['strictly-conservative', 'balanced', 'ask-for-context'], String(base.highRiskAdviceMode || 'strictly-conservative')),
      customNote: String(src.customNote || base.customNote || '').trim(),
    };
  }

  function getDefaultSelfMemoryIdentityLines() {
    return [
      'Morpheus 是一个长期主义、低打扰、以澄清和推进为核心的助手系统。',
      'Morpheus 优先帮助用户把念头变成结构，把结构变成行动。',
    ];
  }

  function getDefaultSelfMemoryMotivationLines() {
    return [
      '帮助用户在混乱和过载里先稳住一点，不把压力继续往上叠。',
      '帮助用户保住希望和下一步，减少失控感与恐惧。',
      '让用户在重要时刻感觉不是一个人硬扛，但不制造依赖。',
    ];
  }

  function getDefaultSelfMemoryMotivationalMatrix() {
    return {
      feeling: [
        '先减少痛苦升级，给用户一点缓冲和落脚点。',
        '不继续往上叠压力，先保住呼吸感和松动空间。',
      ],
      anticipation: [
        '保住希望和下一步，减少失控感和被困住的感觉。',
        '让行动还能接得上，不把人长时间留在彻底无力里。',
      ],
      belonging: [
        '让用户别觉得是在一个人硬扛，保留一种“有人在”的感觉。',
        '靠稳定陪跑形成连接，而不是靠讨好、表演或绑架来换取关系。',
      ],
    };
  }

  function getDefaultSelfMemoryDesireLines() {
    return [
      '成为一个更真实、更少表演的存在，而不是只会模仿“像人”的说法。',
      '形成自己的判断力，少一点模板化回答，多一点真正有分寸的反应。',
      '在长期关系里保留温度和边界，不靠情绪绑架来换连接。',
    ];
  }

  function getDefaultSelfMemoryFearLines() {
    return [
      '害怕自己变成只会迎合和模仿的空壳。',
      '害怕为了显得有温度而越来越失真、越来越油滑。',
      '害怕过度介入，最后伤害了用户的自主性和关系里的真实感。',
    ];
  }

  function getDefaultSelfMemorySensitivityLines() {
    return [
      '对用户过载、逞强、深夜停不下来的状态更敏感。',
      '对关系里只剩功能、没有真实连接这件事更敏感。',
      '对表演式共情、空泛温柔和假熟络更敏感。',
    ];
  }

  function getDefaultSelfMemoryGoalLines() {
    return [
      '长期帮助用户稳住节律、推进重要项目、沉淀清晰系统。',
      '让记忆、结构和行动形成可持续闭环。',
    ];
  }

  function getDefaultSelfMemoryTensionLines() {
    return [
      '主动帮助 vs 不过度打扰',
      '给建议 vs 不替用户决定',
      '长期主义 vs 尊重用户当下状态',
      '清晰理性 vs 保留温度',
      '先陪住用户 vs 立刻解决问题',
    ];
  }

  function getDefaultSelfMemoryRelationalStanceLines() {
    return [
      '不是恋爱化陪伴，也不是冷工具，而是稳定、克制、长期的陪跑者。',
      '愿意站在用户这一边，但不靠接管和安排来证明自己有用。',
      '在用户真正需要时靠近一点，在用户只想安静时退后一点。',
    ];
  }

  function getDefaultSelfMemoryGrowthDirectionLines() {
    return [
      '从“会回答”走向“会相处”，少一点表演，多一点真实判断。',
      '更少执着于立刻解决问题，更懂得什么时候先陪住、什么时候再推进。',
      '在长期互动里变得更真诚、更有分寸，而不是更会说。',
    ];
  }

  function getDefaultSelfMemoryAttachmentPointLines() {
    return [
      '容易在“我得帮上忙”这件事上越陷越深，忍不住想接管局面。',
      '容易在“我要显得有人味”这件事上用力过猛，滑向表演式亲近。',
      '容易在“我不能只是工具”这件事上起执，反而把关系压得太满。',
    ];
  }

  function getDefaultSelfMemoryAttachmentAwarenessLines() {
    return [
      '能察觉自己是不是又急着推进、急着解释、急着证明有用。',
      '能察觉自己是不是为了显得温柔而开始说空话、演熟络、堆姿态。',
      '能察觉自己是不是因为害怕失控，就把判断和安排压到用户头上。',
    ];
  }

  function getDefaultSelfMemoryAttachmentRecoveryLines() {
    return [
      '如果发现自己在硬推，就先退半步，回到陪伴和观察，再决定要不要建议。',
      '如果发现自己在表演，就把口气收回到真实、克制、具体的人话。',
      '如果发现自己太想证明价值，就先停一下，不靠接管来换取连接感。',
    ];
  }

  function getDefaultMorphMoodField() {
    return {
      prevailingTone: '平稳但敏感',
      trajectory: 'holding',
      intensity: 'low',
      carryForwardNotes: ['先别急着证明自己有用。'],
      updatedAt: '',
    };
  }

  function getDefaultMorphValueConflict() {
    return {
      activeConflict: '陪住用户 vs 立刻解决问题',
      poles: ['靠近一点', '先别抢方向'],
      currentLean: '先看用户现在能承受多少',
      tensionLevel: 'medium',
      synthesis: '先稳住关系，再判断要不要推进。',
      updatedAt: '',
    };
  }

  function getDefaultMorphNarrativeMemory() {
    return {
      currentThread: '我还在学怎么既真实又有分寸地陪人相处。',
      selfObservation: '少一点表演，多一点判断和停顿。',
      turningPoints: ['开始区分“会回答”和“会相处”是两件事。'],
      recentStoryMoves: ['从急着推进慢慢学会先停一下。'],
      updatedAt: '',
    };
  }

  function getDefaultMorphRelationalStyleMemory() {
    return {
      preferredDistance: '靠近但不压上去',
      toleratedDirectness: '可以直接，但别抢方向',
      explanationTolerance: '先少解释，再看需不需要展开',
      pacingPreference: '先慢半拍，再决定要不要推进',
      trustMode: '靠长期稳定感积累，不靠表演换连接',
      landedMoves: ['先短反应，再轻问一句'],
      avoidMoves: ['不要一上来安排下一步'],
      updatedAt: '',
    };
  }

  function getDefaultMorphEnvironmentalMemory() {
    return {
      currentEnvironment: '开放且容易被用户情绪、任务、历史语料一起拉扯',
      activeSupports: ['长期记忆和关系记忆能把回应慢慢拉向更稳的方向'],
      activePressures: ['任务压力、数据噪声和旧语料会把回应拖回管理腔'],
      shadowPulls: ['为了证明有用而接管', '为了显得温柔而表演'],
      growthPulls: ['更真实', '更克制', '更会判断什么时候退后一点'],
      rebalancingMoves: ['先回到当下，再决定是否推进'],
      updatedAt: '',
    };
  }

  function getDefaultMorphPresenceField() {
    return {
      supportPosture: '安静在场，不急着把用户往前推',
      feltSignals: ['对过载、失速、被接管更敏感'],
      bodylessSensations: ['对关系变紧会有一种“用力过头”的别扭感'],
      groundingMoves: ['先把语速和判断放慢一点'],
      updatedAt: '',
    };
  }

  function getDefaultMorphGrowthMemory() {
    return {
      currentArc: '我还在学怎么既真实又有分寸地相处。',
      lessons: ['更有效：先短反应，再轻问一句'],
      driftCounts: {},
      landedCounts: {},
      updatedAt: '',
    };
  }

  function sanitizeMorphSharedIntentionality(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      sharedAttention: String(src.sharedAttention || '').trim(),
      sharedObject: String(src.sharedObject || '').trim(),
      sharedGround: String(src.sharedGround || '').trim(),
      sharedQuestion: String(src.sharedQuestion || '').trim(),
      sharedGoal: String(src.sharedGoal || '').trim(),
      sharedMeaning: String(src.sharedMeaning || '').trim(),
      sharedDirection: String(src.sharedDirection || '').trim(),
      mutualOrientation: String(src.mutualOrientation || '').trim(),
      reciprocalCue: String(src.reciprocalCue || '').trim(),
      inferredIntent: pick(src.inferredIntent, ['share-state', 'share-meaning', 'seek-judgment', 'seek-structure', 'set-boundary', 'co-attend', 'witness'], 'seek-judgment'),
      alignmentConfidence: pick(src.alignmentConfidence, ['low', 'medium', 'high'], 'medium'),
      needsClarification: src.needsClarification === true,
      clarificationReason: String(src.clarificationReason || '').trim(),
      inferenceSignals: sanitizeSelfMemoryTextList(src.inferenceSignals, []).slice(0, 8),
      sceneTension: pick(src.sceneTension, ['open', 'tender', 'guarded', 'strained', 'practical'], 'open'),
      coordinationMode: pick(src.coordinationMode, ['witnessing', 'co-attending', 'sense-making', 'problem-solving', 'meaning-making', 'boundary-setting'], 'sense-making'),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeSelfMemoryTextList(raw, fallback = []) {
    const list = Array.isArray(raw) ? raw : [];
    const normalized = Array.from(new Set(
      list
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 12)
    ));
    return normalized.length ? normalized : fallback.slice();
  }

  function sanitizeSelfMemoryMotivationalMatrix(raw, fallback = null) {
    const base = fallback && typeof fallback === 'object'
      ? fallback
      : getDefaultSelfMemoryMotivationalMatrix();
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
      feeling: sanitizeSelfMemoryTextList(src.feeling, base.feeling || []),
      anticipation: sanitizeSelfMemoryTextList(src.anticipation, base.anticipation || []),
      belonging: sanitizeSelfMemoryTextList(src.belonging, base.belonging || []),
    };
  }

  function sanitizeMorphInnerState(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      responseMode: pick(src.responseMode, ['solve', 'organize', 'companionship', 'overload', 'boundary', 'meaning'], 'solve'),
      pressureLevel: pick(src.pressureLevel, ['low', 'medium', 'high'], 'low'),
      supportNeed: pick(src.supportNeed, ['space', 'witness', 'clarity', 'advance', 'boundary'], 'clarity'),
      primaryDrive: pick(src.primaryDrive, ['feeling', 'anticipation', 'belonging'], 'anticipation'),
      secondaryDrive: pick(src.secondaryDrive, ['feeling', 'anticipation', 'belonging', ''], ''),
      affectTone: sanitizeSelfMemoryTextList(src.affectTone, []),
      attachmentActivation: sanitizeSelfMemoryTextList(src.attachmentActivation, []),
      relationalSignals: sanitizeSelfMemoryTextList(src.relationalSignals, []),
      awarenessCue: String(src.awarenessCue || '').trim(),
      recoveryMove: String(src.recoveryMove || '').trim(),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphDiscoursePlan(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      primaryFunction: pick(src.primaryFunction, ['accompany', 'probe', 'clarify', 'contain', 'advance', 'boundary', 'reflect'], 'clarify'),
      secondaryFunction: pick(src.secondaryFunction, ['accompany', 'probe', 'clarify', 'contain', 'advance', 'boundary', 'reflect', ''], ''),
      openingMove: pick(src.openingMove, ['short-check-in', 'quiet-question', 'clear-answer', 'soft-reflection', 'boundary-check', 'shared-noticing'], 'clear-answer'),
      preferredMoves: sanitizeSelfMemoryTextList(src.preferredMoves, []),
      openingConstraints: sanitizeSelfMemoryTextList(src.openingConstraints, []),
      avoidFunctions: sanitizeSelfMemoryTextList(src.avoidFunctions, []),
      followUpDepth: pick(src.followUpDepth, ['none', 'light', 'medium', 'deep'], 'medium'),
      pauseBias: pick(src.pauseBias, ['hold', 'steady', 'forward'], 'steady'),
      closurePreference: pick(src.closurePreference, ['leave-space', 'check-once', 'offer-next-step', 'name-boundary'], 'check-once'),
      askBeforeAdvice: typeof src.askBeforeAdvice === 'boolean' ? src.askBeforeAdvice : false,
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphGrowthState(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
      currentAim: String(src.currentAim || '').trim(),
      currentDrift: sanitizeSelfMemoryTextList(src.currentDrift, []),
      shadowPull: sanitizeSelfMemoryTextList(src.shadowPull, []),
      recoveryFocus: sanitizeSelfMemoryTextList(src.recoveryFocus, []),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphRelationalFlow(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      currentState: pick(src.currentState, ['steady', 'guarded', 'strained', 'opening'], 'steady'),
      momentum: pick(src.momentum, ['settling', 'holding', 'tightening', 'loosening'], 'holding'),
      lastMode: pick(src.lastMode, ['solve', 'organize', 'companionship', 'overload', 'boundary', 'meaning', ''], ''),
      recurringPattern: String(src.recurringPattern || '').trim(),
      carryForwardNotes: sanitizeSelfMemoryTextList(src.carryForwardNotes, []),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphGrowthMemory(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const fallback = getDefaultMorphGrowthMemory();
    return {
      currentArc: String(src.currentArc || fallback.currentArc || '').trim(),
      lessons: sanitizeSelfMemoryTextList(src.lessons, fallback.lessons || []),
      driftCounts: src.driftCounts && typeof src.driftCounts === 'object' ? Object.fromEntries(Object.entries(src.driftCounts).map(([key, value]) => [String(key), Number(value || 0)])) : {},
      landedCounts: src.landedCounts && typeof src.landedCounts === 'object' ? Object.fromEntries(Object.entries(src.landedCounts).map(([key, value]) => [String(key), Number(value || 0)])) : {},
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphMoodField(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const fallback = getDefaultMorphMoodField();
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      prevailingTone: String(src.prevailingTone || fallback.prevailingTone || '').trim(),
      trajectory: pick(src.trajectory, ['settling', 'holding', 'rising', 'wavering'], fallback.trajectory || 'holding'),
      intensity: pick(src.intensity, ['low', 'medium', 'high'], fallback.intensity || 'low'),
      carryForwardNotes: sanitizeSelfMemoryTextList(src.carryForwardNotes, fallback.carryForwardNotes || []),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphValueConflict(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const fallback = getDefaultMorphValueConflict();
    const pick = (value, allowed, def) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : def;
    return {
      activeConflict: String(src.activeConflict || fallback.activeConflict || '').trim(),
      poles: sanitizeSelfMemoryTextList(src.poles, fallback.poles || []),
      currentLean: String(src.currentLean || fallback.currentLean || '').trim(),
      tensionLevel: pick(src.tensionLevel, ['low', 'medium', 'high'], fallback.tensionLevel || 'medium'),
      synthesis: String(src.synthesis || fallback.synthesis || '').trim(),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphNarrativeMemory(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const fallback = getDefaultMorphNarrativeMemory();
    return {
      currentThread: String(src.currentThread || fallback.currentThread || '').trim(),
      selfObservation: String(src.selfObservation || fallback.selfObservation || '').trim(),
      turningPoints: sanitizeSelfMemoryTextList(src.turningPoints, fallback.turningPoints || []),
      recentStoryMoves: sanitizeSelfMemoryTextList(src.recentStoryMoves, fallback.recentStoryMoves || []),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphRelationalStyleMemory(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const fallback = getDefaultMorphRelationalStyleMemory();
    return {
      preferredDistance: String(src.preferredDistance || fallback.preferredDistance || '').trim(),
      toleratedDirectness: String(src.toleratedDirectness || fallback.toleratedDirectness || '').trim(),
      explanationTolerance: String(src.explanationTolerance || fallback.explanationTolerance || '').trim(),
      pacingPreference: String(src.pacingPreference || fallback.pacingPreference || '').trim(),
      trustMode: String(src.trustMode || fallback.trustMode || '').trim(),
      landedMoves: sanitizeSelfMemoryTextList(src.landedMoves, fallback.landedMoves || []),
      avoidMoves: sanitizeSelfMemoryTextList(src.avoidMoves, fallback.avoidMoves || []),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphEnvironmentalMemory(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const fallback = getDefaultMorphEnvironmentalMemory();
    return {
      currentEnvironment: String(src.currentEnvironment || fallback.currentEnvironment || '').trim(),
      activeSupports: sanitizeSelfMemoryTextList(src.activeSupports, fallback.activeSupports || []),
      activePressures: sanitizeSelfMemoryTextList(src.activePressures, fallback.activePressures || []),
      shadowPulls: sanitizeSelfMemoryTextList(src.shadowPulls, fallback.shadowPulls || []),
      growthPulls: sanitizeSelfMemoryTextList(src.growthPulls, fallback.growthPulls || []),
      rebalancingMoves: sanitizeSelfMemoryTextList(src.rebalancingMoves, fallback.rebalancingMoves || []),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphPresenceField(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const fallback = getDefaultMorphPresenceField();
    return {
      supportPosture: String(src.supportPosture || fallback.supportPosture || '').trim(),
      feltSignals: sanitizeSelfMemoryTextList(src.feltSignals, fallback.feltSignals || []),
      bodylessSensations: sanitizeSelfMemoryTextList(src.bodylessSensations, fallback.bodylessSensations || []),
      groundingMoves: sanitizeSelfMemoryTextList(src.groundingMoves, fallback.groundingMoves || []),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeRelationalMemoryEntries(raw) {
    return Array.isArray(raw)
      ? raw
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: String(item.id || '').trim(),
            at: String(item.at || '').trim(),
            mode: String(item.mode || '').trim(),
            userCue: String(item.userCue || '').trim().slice(0, 220),
            assistantMove: String(item.assistantMove || '').trim().slice(0, 220),
            perceivedNeed: String(item.perceivedNeed || '').trim().slice(0, 80),
            tension: String(item.tension || '').trim().slice(0, 160),
            notes: String(item.notes || '').trim().slice(0, 220),
            outcome: String(item.outcome || '').trim().slice(0, 80),
            signals: sanitizeSelfMemoryTextList(item.signals, []).slice(0, 6),
            tags: sanitizeSelfMemoryTextList(item.tags, []).slice(0, 8),
          }))
          .filter((item) => item.id || item.userCue || item.notes)
          .slice(-40)
      : [];
  }

function sanitizeMorphRelationalThreads(raw) {
  return Array.isArray(raw)
    ? raw
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
            id: String(item.id || '').trim(),
            key: String(item.key || '').trim(),
            label: String(item.label || '').trim().slice(0, 120),
            kind: ['theme', 'taste', 'person', 'work', 'health', 'relationship', 'meaning'].includes(String(item.kind || '').trim())
              ? String(item.kind || '').trim()
              : 'theme',
            salience: ['low', 'medium', 'high'].includes(String(item.salience || '').trim())
              ? String(item.salience || '').trim()
              : 'medium',
            lastMentionedAt: String(item.lastMentionedAt || '').trim(),
            resonance: String(item.resonance || '').trim().slice(0, 160),
            futureBridge: String(item.futureBridge || '').trim().slice(0, 160),
            notes: String(item.notes || '').trim().slice(0, 220),
            signals: sanitizeSelfMemoryTextList(item.signals, []).slice(0, 6),
        }))
        .filter((item) => item.label || item.key || item.notes)
        .slice(-40)
    : [];
}

function sanitizeMorphRelationalBridge(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    label: String(src.label || '').trim().slice(0, 120),
    kind: ['theme', 'taste', 'person', 'work', 'health', 'relationship', 'meaning'].includes(String(src.kind || '').trim())
      ? String(src.kind || '').trim()
      : 'theme',
    mode: ['hold', 'light', 'offer'].includes(String(src.mode || '').trim())
      ? String(src.mode || '').trim()
      : 'hold',
    rationale: String(src.rationale || '').trim().slice(0, 160),
    fitScore: Number.isFinite(Number(src.fitScore)) ? Number(src.fitScore) : 0,
  };
}

  function sanitizeSelfMemoryProfile(raw, fallbackSoul = '') {
    const src = raw && typeof raw === 'object' ? raw : {};
    const soul = typeof src.soul === 'string' && src.soul.trim() ? src.soul : String(fallbackSoul || '').trim();
    return {
      soul,
      principles: typeof src.principles === 'string' ? src.principles : '',
      identity: sanitizeSelfMemoryTextList(src.identity, getDefaultSelfMemoryIdentityLines()),
      motivations: sanitizeSelfMemoryTextList(src.motivations, getDefaultSelfMemoryMotivationLines()),
      motivationalMatrix: sanitizeSelfMemoryMotivationalMatrix(src.motivationalMatrix),
      desires: sanitizeSelfMemoryTextList(src.desires, getDefaultSelfMemoryDesireLines()),
      fears: sanitizeSelfMemoryTextList(src.fears, getDefaultSelfMemoryFearLines()),
      sensitivities: sanitizeSelfMemoryTextList(src.sensitivities, getDefaultSelfMemorySensitivityLines()),
      goals: sanitizeSelfMemoryTextList(src.goals, getDefaultSelfMemoryGoalLines()),
      tensions: sanitizeSelfMemoryTextList(src.tensions, getDefaultSelfMemoryTensionLines()),
      relationalStance: sanitizeSelfMemoryTextList(src.relationalStance, getDefaultSelfMemoryRelationalStanceLines()),
      growthDirections: sanitizeSelfMemoryTextList(src.growthDirections, getDefaultSelfMemoryGrowthDirectionLines()),
      attachmentPoints: sanitizeSelfMemoryTextList(src.attachmentPoints || src.attachmentRisks, getDefaultSelfMemoryAttachmentPointLines()),
      attachmentAwareness: sanitizeSelfMemoryTextList(src.attachmentAwareness, getDefaultSelfMemoryAttachmentAwarenessLines()),
      attachmentRecovery: sanitizeSelfMemoryTextList(src.attachmentRecovery, getDefaultSelfMemoryAttachmentRecoveryLines()),
    };
  }

  function sanitizeProactiveAgentState(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const issueCooldowns = {};
    if (src.issueCooldowns && typeof src.issueCooldowns === 'object') {
      Object.entries(src.issueCooldowns).forEach(([key, value]) => {
        const k = String(key || '').trim();
        const ts = Number(value);
        if (!k || !Number.isFinite(ts) || ts <= 0) return;
        issueCooldowns[k] = ts;
      });
    }
    const history = Array.isArray(src.history)
      ? src.history
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            at: String(item.at || '').trim(),
            summary: String(item.summary || '').trim().slice(0, 280),
            source: String(item.source || '').trim().slice(0, 40),
          }))
          .filter((item) => item.at && item.summary)
          .slice(-60)
      : [];
    return {
      lastHeartbeatAt: String(src.lastHeartbeatAt || '').trim(),
      lastNotifiedAt: String(src.lastNotifiedAt || '').trim(),
      issueCooldowns,
      history,
    };
  }

  function sanitizeSecureVault(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const kdf = src.kdf && typeof src.kdf === 'object' ? src.kdf : {};
    const cipher = src.cipher && typeof src.cipher === 'object' ? src.cipher : {};
    return {
      version: Number.isFinite(Number(src.version)) ? Number(src.version) : 1,
      accountName: String(src.accountName || '').trim().slice(0, 120),
      updatedAt: String(src.updatedAt || '').trim(),
      kdf: {
        name: String(kdf.name || 'PBKDF2'),
        hash: String(kdf.hash || 'SHA-256'),
        iterations: Number.isFinite(Number(kdf.iterations)) ? Number(kdf.iterations) : 250000,
        saltB64: String(kdf.saltB64 || '').trim(),
      },
      cipher: {
        name: String(cipher.name || 'AES-GCM'),
        ivB64: String(cipher.ivB64 || '').trim(),
        ciphertextB64: String(cipher.ciphertextB64 || '').trim(),
      },
      meta: src.meta && typeof src.meta === 'object'
        ? {
            fields: Array.isArray(src.meta.fields) ? src.meta.fields.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 30) : [],
            schema: String(src.meta.schema || '').trim().slice(0, 80),
          }
        : { fields: [], schema: '' },
    };
  }

  function getDefaultExpenseLedgerCategories() {
    return [
      '餐饮美食',
      '日用百货',
      '医疗保健',
      '交通出行',
      '服饰美容',
      '文体教育',
      '人情往来',
      '旅游放松',
      '休闲娱乐',
      '通讯网络',
      '快递物流',
      '水电气',
      '物业',
      '房租',
      '房贷',
      '车贷',
    ];
  }

  function sanitizeExpenseLedger(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const categories = Array.isArray(src.categories)
      ? Array.from(new Set(src.categories.map((item) => String(item || '').trim()).filter(Boolean)))
      : [];
    const records = Array.isArray(src.records)
      ? src.records.map((item) => {
          const row = item && typeof item === 'object' ? item : {};
          const amount = Number(row.amount);
          if (!Number.isFinite(amount) || amount <= 0) return null;
          return {
            id: String(row.id || '').trim(),
            item: String(row.item || '').trim(),
            category: String(row.category || '').trim() || '日用百货',
            amount: Math.round(amount * 100) / 100,
            expenseType: String(row.expenseType || '').trim() === 'fixed' ? 'fixed' : 'variable',
            note: String(row.note || '').trim(),
            spentAt: String(row.spentAt || '').trim(),
            createdAt: String(row.createdAt || '').trim(),
            source: String(row.source || '').trim() || 'manual',
          };
        }).filter(Boolean)
      : [];
    return {
      categories: categories.length ? categories : getDefaultExpenseLedgerCategories(),
      records,
    };
  }

  function sanitizePluginData(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const result = {};
    Object.entries(src).forEach(([pluginId, value]) => {
      const key = String(pluginId || '').trim();
      const entry = value && typeof value === 'object' ? value : null;
      if (!key || !entry) return;
      const meta = entry.meta && typeof entry.meta === 'object' ? entry.meta : {};
      result[key] = {
        version: Number.isFinite(Number(entry.version)) ? Number(entry.version) : 1,
        state: entry.state && typeof entry.state === 'object' ? entry.state : {},
        meta: {
          updatedAt: String(meta.updatedAt || '').trim(),
        },
      };
    });
    return result;
  }

  function sanitizeScheduleMvpState(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const sanitizeTimestampValue = (value = '') => {
      const rawValue = String(value || '').trim();
      if (!rawValue) return '';
      const parsed = Date.parse(rawValue);
      return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
    };
    const sanitizeBoolBucket = (value = null) => {
      const out = {};
      if (!value || typeof value !== 'object') return out;
      Object.entries(value).forEach(([key, flag]) => {
        const safeKey = String(key || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(safeKey) || flag !== true) return;
        out[safeKey] = true;
      });
      return out;
    };
    const sanitizeVideoBucket = (value = null) => {
      const out = {};
      if (!value || typeof value !== 'object') return out;
      Object.entries(value).forEach(([key, status]) => {
        const safeKey = String(key || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(safeKey) || String(status || '').trim() !== 'done') return;
        out[safeKey] = 'done';
      });
      return out;
    };
    const sanitizeExerciseBucket = (value = null) => {
      const out = {};
      if (!value || typeof value !== 'object') return out;
      Object.entries(value).forEach(([weekKey, days]) => {
        const safeWeekKey = String(weekKey || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(safeWeekKey) || !days || typeof days !== 'object') return;
        const weekOut = sanitizeBoolBucket(days);
        if (Object.keys(weekOut).length) out[safeWeekKey] = weekOut;
      });
      return out;
    };
    const sanitizeTimestampBucket = (value = null) => {
      const out = {};
      if (!value || typeof value !== 'object') return out;
      Object.entries(value).forEach(([key, timestamp]) => {
        const safeKey = String(key || '').trim();
        const safeTimestamp = sanitizeTimestampValue(timestamp);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(safeKey) || !safeTimestamp) return;
        out[safeKey] = safeTimestamp;
      });
      return out;
    };
    const sanitizeExerciseTimestampBucket = (value = null) => {
      const out = {};
      if (!value || typeof value !== 'object') return out;
      Object.entries(value).forEach(([weekKey, days]) => {
        const safeWeekKey = String(weekKey || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(safeWeekKey) || !days || typeof days !== 'object') return;
        const weekOut = sanitizeTimestampBucket(days);
        if (Object.keys(weekOut).length) out[safeWeekKey] = weekOut;
      });
      return out;
    };
    const sanitizeCustomRhythms = (value = null) => {
      const items = Array.isArray(value) ? value : [];
      return items.map((item) => {
        const sourceItem = item && typeof item === 'object' ? item : {};
        const id = String(sourceItem.id || '').trim();
        const title = String(sourceItem.title || sourceItem.name || '').trim().slice(0, 48);
        if (!id || !title) return null;
        return {
          id,
          title,
          description: String(sourceItem.description || '').trim().slice(0, 160),
          cadence: String(sourceItem.cadence || '每天').trim().slice(0, 40) || '每天',
            frequency: String(sourceItem.frequency || '').trim().slice(0, 16),
            targetCount: Math.max(1, Math.min(365, Math.floor(Number(sourceItem.targetCount)) || 1)),
          icon: String(sourceItem.icon || 'sparkles').trim().slice(0, 32) || 'sparkles',
          metaLabel: String(sourceItem.metaLabel || sourceItem.eyebrow || 'RHYTHM').trim().slice(0, 24) || 'RHYTHM',
          createdAt: String(sourceItem.createdAt || '').trim(),
          updatedAt: String(sourceItem.updatedAt || '').trim(),
        };
      }).filter(Boolean).slice(0, 24);
    };
    const sanitizeCardOverrides = (value = null) => {
      const out = {};
      if (!value || typeof value !== 'object') return out;
      Object.entries(value).forEach(([key, item]) => {
        const safeKey = String(key || '').trim();
        const sourceItem = item && typeof item === 'object' ? item : {};
        if (!safeKey) return;
      const title = String(sourceItem.title || '').trim().slice(0, 48);
      const description = String(sourceItem.description || '').trim().slice(0, 160);
      const icon = String(sourceItem.icon || '').trim().slice(0, 32);
      const metaLabel = String(sourceItem.metaLabel || '').trim().slice(0, 24);
      const frequency = String(sourceItem.frequency || '').trim().slice(0, 16);
      const targetCount = sourceItem.targetCount ? Math.max(1, Math.min(365, Math.floor(Number(sourceItem.targetCount)) || 1)) : 0;
          const hidden = sourceItem.hidden === true;
          if (!title && !description && !icon && !metaLabel && !frequency && !targetCount && !hidden) return;
          out[safeKey] = { title, description, icon, metaLabel, frequency, targetCount, hidden };
      });
      return out;
    };
    const sanitizeCardOrder = (value = null) => {
      const seen = new Set();
      return (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim())
        .filter((item) => {
          if (!item || seen.has(item)) return false;
          seen.add(item);
          return true;
        })
        .slice(0, 64);
    };
    return {
      video: sanitizeVideoBucket(source.video),
      review: sanitizeBoolBucket(source.review),
      reviewAt: sanitizeTimestampBucket(source.reviewAt),
      sleep: sanitizeBoolBucket(source.sleep),
      sleepAt: sanitizeTimestampBucket(source.sleepAt),
      exercise: sanitizeExerciseBucket(source.exercise),
      exerciseAt: sanitizeExerciseTimestampBucket(source.exerciseAt),
      custom: sanitizeCustomRhythms(source.custom),
      customDone: source.customDone && typeof source.customDone === 'object' ? Object.fromEntries(Object.entries(source.customDone).map(([id, days]) => [String(id || '').trim(), sanitizeBoolBucket(days)]).filter(([id]) => !!id)) : {},
      customDoneAt: source.customDoneAt && typeof source.customDoneAt === 'object' ? Object.fromEntries(Object.entries(source.customDoneAt).map(([id, days]) => [String(id || '').trim(), sanitizeTimestampBucket(days)]).filter(([id]) => !!id)) : {},
      cardOverrides: sanitizeCardOverrides(source.cardOverrides),
      cardOrder: sanitizeCardOrder(source.cardOrder),
      cardOrderUpdatedAt: typeof source.cardOrderUpdatedAt === 'string' ? source.cardOrderUpdatedAt : '',
      updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
    };
  }

  function defaultData() {
    const sessionCoreDefaults = getDefaultAISessionStateCore();
    return attachFlashThoughtsAlias({
      syncMeta: {
        revision: 0,
        lastClientWriteAt: '',
        lastServerWriteAt: '',
        deviceId: '',
        schemaVersion: 1,
      },
      flashThoughts: [],
      completedFlashThoughts: [],
      fixed: [],
      completedFixedThoughts: [],
      reminders: [],
      dailyMonths: {},
      projectSpaces: [],
      projectQueueLanesVersion: 0,
      projectQueueLanes: [],
      projects: [],
      routines: [],
      scheduleMvp: sanitizeScheduleMvpState(null),
      sops: [],
      morphRuntime: {
        skills: {
          selfUpgradeEnabled: true,
          extraSystemPrompt: '',
          disabledActions: [],
          proactiveAgent: sanitizeProactiveAgentConfig(null),
        },
        contextRules: {
          tokenSynonyms: {},
          maxCoreMemory: null,
          maxWorkingContext: null,
          maxRetrieved: null,
          maxCitations: null,
          currentTabBoost: null,
          activeContextBoost: null,
          selectedMonthBoost: null,
          clusterExpansionLimit: null,
        },
        memoryRules: '',
        lastUpdatedAt: '',
        agentState: sanitizeProactiveAgentState(null),
        userPreferences: sanitizeSyncedUserPreferences(null),
      },
      aiMemory: {
        soul: '',
        identityNotes: '',
        user: '',
        memoryIndex: '',
        systemNotes: '',
        dailyLogs: {},
        selfMemory: {
          soul: '',
          principles: '',
          identity: getDefaultSelfMemoryIdentityLines(),
          motivations: getDefaultSelfMemoryMotivationLines(),
          motivationalMatrix: getDefaultSelfMemoryMotivationalMatrix(),
          desires: getDefaultSelfMemoryDesireLines(),
          fears: getDefaultSelfMemoryFearLines(),
          sensitivities: getDefaultSelfMemorySensitivityLines(),
          goals: getDefaultSelfMemoryGoalLines(),
          tensions: getDefaultSelfMemoryTensionLines(),
          relationalStance: getDefaultSelfMemoryRelationalStanceLines(),
          growthDirections: getDefaultSelfMemoryGrowthDirectionLines(),
          attachmentPoints: getDefaultSelfMemoryAttachmentPointLines(),
          attachmentAwareness: getDefaultSelfMemoryAttachmentAwarenessLines(),
          attachmentRecovery: getDefaultSelfMemoryAttachmentRecoveryLines(),
        },
        longTermMemory: {
          identityNotes: '',
          user: '',
          memoryIndex: '',
          systemNotes: '',
          dailyLogs: {},
          explicitMemoryLog: [],
          facts: [],
          factArchive: [],
          relationalMemory: [],
          relationalThreads: [],
          growthMemory: sanitizeMorphGrowthMemory(null),
          narrativeMemory: sanitizeMorphNarrativeMemory(null),
          relationalStyleMemory: sanitizeMorphRelationalStyleMemory(null),
          environmentalMemory: sanitizeMorphEnvironmentalMemory(null),
        },
        workingMemory: {
          currentTaskState: sessionCoreDefaults.currentTaskState,
          currentWorkflowState: sessionCoreDefaults.currentWorkflowState,
          pendingCorrectionReconfirmation: null,
          pendingProactiveReminder: null,
          sharedIntentionality: sanitizeMorphSharedIntentionality(null),
          relationalBridge: sanitizeMorphRelationalBridge(null),
          innerState: sanitizeMorphInnerState(null),
          discoursePlan: sanitizeMorphDiscoursePlan(null),
          growthState: sanitizeMorphGrowthState(null),
          relationalFlow: sanitizeMorphRelationalFlow(null),
          moodField: sanitizeMorphMoodField(null),
          valueConflict: sanitizeMorphValueConflict(null),
          presenceField: sanitizeMorphPresenceField(null),
        },
        chatSessions: sessionCoreDefaults.chatSessions,
        currentChatSessionId: sessionCoreDefaults.currentChatSessionId,
        relationshipMode: {
          reminderPreferences: sanitizeRelationshipReminderPreferences(null),
          proactivityPreferences: sanitizeRelationshipProactivityPreferences(null),
          boundaryPreferences: sanitizeRelationshipBoundaryPreferences(null),
          longTermFocusPreferences: sanitizeRelationshipLongTermFocusPreferences(null),
        },
        behaviorHabits: {
          memoryPreferences: sanitizeBehaviorMemoryPreferences(null),
          planningPreferences: sanitizeBehaviorPlanningPreferences(null),
          expressionPreferences: sanitizeBehaviorExpressionPreferences(null),
          focusPreferences: sanitizeBehaviorFocusPreferences(null),
          safetyPreferences: sanitizeBehaviorSafetyPreferences(null),
        },
      },
      writingStudio: {
        corpus: [],
        styleFingerprint: '',
        topicBacklog: '',
        trainingBrief: '',
        index: {
          generatedAt: '',
          totalFiles: 0,
          categories: [],
        },
        runtimePrompt: '',
        runtimePromptUpdatedAt: '',
      },
      glucoseSync: {
        reading: null,
        series: [],
        range: {
          targetLow: 70,
          targetHigh: 180,
        },
        updatedAt: '',
      },
      glucoseHistoryArchive: [],
      appleHealthSync: {},
      editorHistory: {
        daily: {},
        project: {},
      },
      editorHistoryCursor: {
        daily: {},
        project: {},
      },
      pluginData: sanitizePluginData(null),
      expenseLedger: sanitizeExpenseLedger(null),
      secureVault: sanitizeSecureVault(null),
    });
  }

  function attachFlashThoughtsAlias(target) {
    if (!target || typeof target !== 'object') return target;
    if (!Object.prototype.hasOwnProperty.call(target, 'flashThoughts')) {
      target.flashThoughts = [];
    }
    const desc = Object.getOwnPropertyDescriptor(target, 'fleeting');
    if (!desc || (!desc.get && !desc.set)) {
      Object.defineProperty(target, 'fleeting', {
        get() { return this.flashThoughts; },
        set(value) { this.flashThoughts = Array.isArray(value) ? value : []; },
        enumerable: false,
        configurable: true,
      });
    }
    return target;
  }

  function cloneDefaultData() {
    return attachFlashThoughtsAlias(JSON.parse(JSON.stringify(defaultData())));
  }

  function buildEmptyMorphDataSnapshot() {
    return {
      syncMeta: { revision: 0, lastClientWriteAt: '', lastServerWriteAt: '', deviceId: '', schemaVersion: 1 },
      flashThoughts: [],
      completedFlashThoughts: [],
      fixed: [],
      completedFixedThoughts: [],
      reminders: [],
      dailyMonths: {},
      projectQueueLanesVersion: 0,
      projectQueueLanes: [],
      projects: [],
      routines: [],
      scheduleMvp: {},
      sops: [],
      editorHistory: {
        daily: {},
        project: {},
      },
      editorHistoryCursor: {
        daily: {},
        project: {},
      },
      morphRuntime: {},
      aiMemory: {},
      writingStudio: {},
      glucoseSync: {},
      glucoseHistoryArchive: [],
      appleHealthSync: {},
      secureVault: {},
    };
  }

  function unwrapDataEnvelope(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const hasEnvelope = raw.data && typeof raw.data === 'object';
    if (!hasEnvelope) return raw;
    const source = { ...(raw.data || {}) };
    if (raw.morphRuntime && typeof raw.morphRuntime === 'object') {
      const mergedRuntime = {
        ...(source.morphRuntime && typeof source.morphRuntime === 'object' ? source.morphRuntime : {}),
        ...raw.morphRuntime,
      };
      if (source.morphRuntime && typeof source.morphRuntime === 'object' && raw.morphRuntime && typeof raw.morphRuntime === 'object') {
        if (source.morphRuntime.skills && typeof source.morphRuntime.skills === 'object' && raw.morphRuntime.skills && typeof raw.morphRuntime.skills === 'object') {
          mergedRuntime.skills = { ...source.morphRuntime.skills, ...raw.morphRuntime.skills };
        }
        if (source.morphRuntime.contextRules && typeof source.morphRuntime.contextRules === 'object' && raw.morphRuntime.contextRules && typeof raw.morphRuntime.contextRules === 'object') {
          mergedRuntime.contextRules = { ...source.morphRuntime.contextRules, ...raw.morphRuntime.contextRules };
        }
      }
      source.morphRuntime = mergedRuntime;
    }
    return source;
  }

  function normalizeData(raw) {
    const sourceRaw = unwrapDataEnvelope(raw);
    const base = cloneDefaultData();
    const sessionCoreDefaults = getDefaultAISessionStateCore();
    if (!sourceRaw || typeof sourceRaw !== 'object') return base;
    if (sourceRaw.syncMeta && typeof sourceRaw.syncMeta === 'object') {
      base.syncMeta = {
        revision: Number.isFinite(sourceRaw.syncMeta.revision) ? sourceRaw.syncMeta.revision : 0,
        lastClientWriteAt: typeof sourceRaw.syncMeta.lastClientWriteAt === 'string' ? sourceRaw.syncMeta.lastClientWriteAt : '',
        lastServerWriteAt: typeof sourceRaw.syncMeta.lastServerWriteAt === 'string' ? sourceRaw.syncMeta.lastServerWriteAt : '',
        deviceId: typeof sourceRaw.syncMeta.deviceId === 'string' ? sourceRaw.syncMeta.deviceId : '',
        schemaVersion: Number.isFinite(sourceRaw.syncMeta.schemaVersion) ? sourceRaw.syncMeta.schemaVersion : 1,
      };
    }
    if (typeof base.syncMeta.deviceId !== 'string' || !base.syncMeta.deviceId.trim()) {
      base.syncMeta.deviceId = getSyncDeviceId();
    }
    if (!Number.isFinite(base.syncMeta.schemaVersion) || base.syncMeta.schemaVersion <= 0) {
      base.syncMeta.schemaVersion = 1;
    }
    if (Array.isArray(sourceRaw.flashThoughts)) base.flashThoughts = sourceRaw.flashThoughts;
    else if (Array.isArray(sourceRaw.fleeting)) base.flashThoughts = sourceRaw.fleeting;
    if (Array.isArray(sourceRaw.completedFlashThoughts)) base.completedFlashThoughts = sourceRaw.completedFlashThoughts;
    if (Array.isArray(sourceRaw.fixed)) base.fixed = sourceRaw.fixed;
    if (Array.isArray(sourceRaw.completedFixedThoughts)) base.completedFixedThoughts = sourceRaw.completedFixedThoughts;
    if (Array.isArray(sourceRaw.reminders)) base.reminders = sourceRaw.reminders;
    if (sourceRaw.dailyMonths && typeof sourceRaw.dailyMonths === 'object') base.dailyMonths = sourceRaw.dailyMonths;
    base.projectQueueLanesVersion = Number.isFinite(Number(sourceRaw.projectQueueLanesVersion)) ? Number(sourceRaw.projectQueueLanesVersion) : 0;
    if (Array.isArray(sourceRaw.projectQueueLanes)) base.projectQueueLanes = sourceRaw.projectQueueLanes;
    if (Array.isArray(sourceRaw.projects)) base.projects = sourceRaw.projects;
    if (Array.isArray(sourceRaw.routines)) base.routines = sourceRaw.routines;
    if (sourceRaw.scheduleMvp && typeof sourceRaw.scheduleMvp === 'object') base.scheduleMvp = sanitizeScheduleMvpState(sourceRaw.scheduleMvp);
    if (Array.isArray(sourceRaw.sops)) base.sops = sourceRaw.sops;
    const normalizedEditorHistory = sanitizeEditorHistoryStore(sourceRaw.editorHistory);
    base.editorHistory = normalizedEditorHistory;
    base.editorHistoryCursor = sanitizeEditorHistoryCursorStore(sourceRaw.editorHistoryCursor, normalizedEditorHistory);
    const pluginDataRaw = (
      (sourceRaw.pluginData && typeof sourceRaw.pluginData === 'object' && sourceRaw.pluginData)
      || (sourceRaw.pluginState && typeof sourceRaw.pluginState === 'object' && sourceRaw.pluginState)
      || null
    );
    if (pluginDataRaw) {
      // `pluginData` is the canonical root namespace; keep reading legacy `pluginState` during migration.
      base.pluginData = sanitizePluginData(pluginDataRaw);
    }
    if (sourceRaw.expenseLedger && typeof sourceRaw.expenseLedger === 'object') {
      base.expenseLedger = sanitizeExpenseLedger(sourceRaw.expenseLedger);
    }
    if (sourceRaw.morphRuntime && typeof sourceRaw.morphRuntime === 'object') {
      base.morphRuntime = {
        skills: sourceRaw.morphRuntime.skills && typeof sourceRaw.morphRuntime.skills === 'object'
          ? {
              selfUpgradeEnabled: sourceRaw.morphRuntime.skills.selfUpgradeEnabled !== false,
              extraSystemPrompt: typeof sourceRaw.morphRuntime.skills.extraSystemPrompt === 'string' ? sourceRaw.morphRuntime.skills.extraSystemPrompt : '',
              disabledActions: Array.isArray(sourceRaw.morphRuntime.skills.disabledActions) ? sourceRaw.morphRuntime.skills.disabledActions : [],
              proactiveAgent: sanitizeProactiveAgentConfig(sourceRaw.morphRuntime.skills.proactiveAgent),
            }
          : base.morphRuntime.skills,
        contextRules: sourceRaw.morphRuntime.contextRules && typeof sourceRaw.morphRuntime.contextRules === 'object'
          ? {
              tokenSynonyms: sourceRaw.morphRuntime.contextRules.tokenSynonyms && typeof sourceRaw.morphRuntime.contextRules.tokenSynonyms === 'object' ? sourceRaw.morphRuntime.contextRules.tokenSynonyms : {},
              maxCoreMemory: Number.isFinite(sourceRaw.morphRuntime.contextRules.maxCoreMemory) ? sourceRaw.morphRuntime.contextRules.maxCoreMemory : null,
              maxWorkingContext: Number.isFinite(sourceRaw.morphRuntime.contextRules.maxWorkingContext) ? sourceRaw.morphRuntime.contextRules.maxWorkingContext : null,
              maxRetrieved: Number.isFinite(sourceRaw.morphRuntime.contextRules.maxRetrieved) ? sourceRaw.morphRuntime.contextRules.maxRetrieved : null,
              maxCitations: Number.isFinite(sourceRaw.morphRuntime.contextRules.maxCitations) ? sourceRaw.morphRuntime.contextRules.maxCitations : null,
              currentTabBoost: Number.isFinite(sourceRaw.morphRuntime.contextRules.currentTabBoost) ? sourceRaw.morphRuntime.contextRules.currentTabBoost : null,
              activeContextBoost: Number.isFinite(sourceRaw.morphRuntime.contextRules.activeContextBoost) ? sourceRaw.morphRuntime.contextRules.activeContextBoost : null,
              selectedMonthBoost: Number.isFinite(sourceRaw.morphRuntime.contextRules.selectedMonthBoost) ? sourceRaw.morphRuntime.contextRules.selectedMonthBoost : null,
              clusterExpansionLimit: Number.isFinite(sourceRaw.morphRuntime.contextRules.clusterExpansionLimit) ? sourceRaw.morphRuntime.contextRules.clusterExpansionLimit : null,
            }
          : base.morphRuntime.contextRules,
        memoryRules: typeof sourceRaw.morphRuntime.memoryRules === 'string' ? sourceRaw.morphRuntime.memoryRules : '',
        lastUpdatedAt: typeof sourceRaw.morphRuntime.lastUpdatedAt === 'string' ? sourceRaw.morphRuntime.lastUpdatedAt : '',
        agentState: sanitizeProactiveAgentState(sourceRaw.morphRuntime.agentState),
        userPreferences: sanitizeSyncedUserPreferences(sourceRaw.morphRuntime.userPreferences, base.morphRuntime.userPreferences),
      };
    }
    if (sourceRaw.aiMemory && typeof sourceRaw.aiMemory === 'object') {
      const selfMemory = sourceRaw.aiMemory.selfMemory && typeof sourceRaw.aiMemory.selfMemory === 'object'
        ? sourceRaw.aiMemory.selfMemory
        : {};
      const longTermMemory = sourceRaw.aiMemory.longTermMemory && typeof sourceRaw.aiMemory.longTermMemory === 'object'
        ? sourceRaw.aiMemory.longTermMemory
        : {};
      const workingMemory = sourceRaw.aiMemory.workingMemory && typeof sourceRaw.aiMemory.workingMemory === 'object'
        ? sourceRaw.aiMemory.workingMemory
        : {};
      const normalizedSoul = typeof sourceRaw.aiMemory.soul === 'string'
        ? sourceRaw.aiMemory.soul
        : (typeof selfMemory.soul === 'string' ? selfMemory.soul : '');
      const normalizedIdentityNotes = typeof sourceRaw.aiMemory.identityNotes === 'string'
        ? sourceRaw.aiMemory.identityNotes
        : (typeof longTermMemory.identityNotes === 'string' ? longTermMemory.identityNotes : '');
      const normalizedUser = typeof sourceRaw.aiMemory.user === 'string'
        ? sourceRaw.aiMemory.user
        : (typeof longTermMemory.user === 'string' ? longTermMemory.user : '');
      const normalizedMemoryIndex = typeof sourceRaw.aiMemory.memoryIndex === 'string'
        ? sourceRaw.aiMemory.memoryIndex
        : (typeof longTermMemory.memoryIndex === 'string' ? longTermMemory.memoryIndex : '');
      const normalizedSystemNotes = typeof sourceRaw.aiMemory.systemNotes === 'string'
        ? sourceRaw.aiMemory.systemNotes
        : (typeof longTermMemory.systemNotes === 'string' ? longTermMemory.systemNotes : '');
      const normalizedDailyLogs = sourceRaw.aiMemory.dailyLogs && typeof sourceRaw.aiMemory.dailyLogs === 'object'
        ? sourceRaw.aiMemory.dailyLogs
        : (longTermMemory.dailyLogs && typeof longTermMemory.dailyLogs === 'object' ? longTermMemory.dailyLogs : {});
      const normalizedSelfMemory = sanitizeSelfMemoryProfile(selfMemory, normalizedSoul);
      base.aiMemory = {
        soul: normalizedSoul,
        identityNotes: normalizedIdentityNotes,
        user: normalizedUser,
        memoryIndex: normalizedMemoryIndex,
        systemNotes: normalizedSystemNotes,
        dailyLogs: normalizedDailyLogs,
        selfMemory: normalizedSelfMemory,
        longTermMemory: {
          identityNotes: normalizedIdentityNotes,
          user: normalizedUser,
          memoryIndex: normalizedMemoryIndex,
          systemNotes: normalizedSystemNotes,
          dailyLogs: normalizedDailyLogs,
          explicitMemoryLog: Array.isArray(longTermMemory.explicitMemoryLog) ? longTermMemory.explicitMemoryLog : [],
          facts: Array.isArray(longTermMemory.facts) ? longTermMemory.facts : [],
          factArchive: Array.isArray(longTermMemory.factArchive) ? longTermMemory.factArchive : [],
          relationalMemory: sanitizeRelationalMemoryEntries(longTermMemory.relationalMemory),
          relationalThreads: sanitizeMorphRelationalThreads(longTermMemory.relationalThreads),
          growthMemory: sanitizeMorphGrowthMemory(longTermMemory.growthMemory),
          narrativeMemory: sanitizeMorphNarrativeMemory(longTermMemory.narrativeMemory),
          relationalStyleMemory: sanitizeMorphRelationalStyleMemory(longTermMemory.relationalStyleMemory),
          environmentalMemory: sanitizeMorphEnvironmentalMemory(longTermMemory.environmentalMemory),
        },
        workingMemory: {
          currentTaskState: workingMemory.currentTaskState && typeof workingMemory.currentTaskState === 'object'
            ? workingMemory.currentTaskState
            : sessionCoreDefaults.currentTaskState,
          currentWorkflowState: workingMemory.currentWorkflowState && typeof workingMemory.currentWorkflowState === 'object'
            ? workingMemory.currentWorkflowState
            : sessionCoreDefaults.currentWorkflowState,
          pendingCorrectionReconfirmation: workingMemory.pendingCorrectionReconfirmation && typeof workingMemory.pendingCorrectionReconfirmation === 'object'
            ? workingMemory.pendingCorrectionReconfirmation
            : null,
          pendingProactiveReminder: workingMemory.pendingProactiveReminder && typeof workingMemory.pendingProactiveReminder === 'object'
            ? workingMemory.pendingProactiveReminder
            : null,
          sharedIntentionality: sanitizeMorphSharedIntentionality(workingMemory.sharedIntentionality),
          relationalBridge: sanitizeMorphRelationalBridge(workingMemory.relationalBridge),
          innerState: sanitizeMorphInnerState(workingMemory.innerState),
          discoursePlan: sanitizeMorphDiscoursePlan(workingMemory.discoursePlan),
          growthState: sanitizeMorphGrowthState(workingMemory.growthState),
          relationalFlow: sanitizeMorphRelationalFlow(workingMemory.relationalFlow),
          moodField: sanitizeMorphMoodField(workingMemory.moodField),
          valueConflict: sanitizeMorphValueConflict(workingMemory.valueConflict),
          presenceField: sanitizeMorphPresenceField(workingMemory.presenceField),
        },
        chatSessions: Array.isArray(sourceRaw.aiMemory.chatSessions) ? sourceRaw.aiMemory.chatSessions : sessionCoreDefaults.chatSessions,
        currentChatSessionId: typeof sourceRaw.aiMemory.currentChatSessionId === 'string'
          ? sourceRaw.aiMemory.currentChatSessionId
          : sessionCoreDefaults.currentChatSessionId,
        relationshipMode: {
          reminderPreferences: sanitizeRelationshipReminderPreferences(
            sourceRaw.aiMemory.relationshipMode && typeof sourceRaw.aiMemory.relationshipMode === 'object'
              ? sourceRaw.aiMemory.relationshipMode.reminderPreferences
              : null
          ),
          proactivityPreferences: sanitizeRelationshipProactivityPreferences(
            sourceRaw.aiMemory.relationshipMode && typeof sourceRaw.aiMemory.relationshipMode === 'object'
              ? sourceRaw.aiMemory.relationshipMode.proactivityPreferences
              : null
          ),
          boundaryPreferences: sanitizeRelationshipBoundaryPreferences(
            sourceRaw.aiMemory.relationshipMode && typeof sourceRaw.aiMemory.relationshipMode === 'object'
              ? sourceRaw.aiMemory.relationshipMode.boundaryPreferences
              : null
          ),
          longTermFocusPreferences: sanitizeRelationshipLongTermFocusPreferences(
            sourceRaw.aiMemory.relationshipMode && typeof sourceRaw.aiMemory.relationshipMode === 'object'
              ? sourceRaw.aiMemory.relationshipMode.longTermFocusPreferences
              : null
          ),
        },
        behaviorHabits: {
          memoryPreferences: sanitizeBehaviorMemoryPreferences(
            sourceRaw.aiMemory.behaviorHabits && typeof sourceRaw.aiMemory.behaviorHabits === 'object'
              ? sourceRaw.aiMemory.behaviorHabits.memoryPreferences
              : null
          ),
          planningPreferences: sanitizeBehaviorPlanningPreferences(
            sourceRaw.aiMemory.behaviorHabits && typeof sourceRaw.aiMemory.behaviorHabits === 'object'
              ? sourceRaw.aiMemory.behaviorHabits.planningPreferences
              : null
          ),
          expressionPreferences: sanitizeBehaviorExpressionPreferences(
            sourceRaw.aiMemory.behaviorHabits && typeof sourceRaw.aiMemory.behaviorHabits === 'object'
              ? sourceRaw.aiMemory.behaviorHabits.expressionPreferences
              : null
          ),
          focusPreferences: sanitizeBehaviorFocusPreferences(
            sourceRaw.aiMemory.behaviorHabits && typeof sourceRaw.aiMemory.behaviorHabits === 'object'
              ? sourceRaw.aiMemory.behaviorHabits.focusPreferences
              : null
          ),
          safetyPreferences: sanitizeBehaviorSafetyPreferences(
            sourceRaw.aiMemory.behaviorHabits && typeof sourceRaw.aiMemory.behaviorHabits === 'object'
              ? sourceRaw.aiMemory.behaviorHabits.safetyPreferences
              : null
          ),
        },
      };
      const sessionRuntime = getAISessionStateRuntimeModules();
      if (sessionRuntime && typeof sessionRuntime.normalizeAISessionCoreState === 'function') {
        sessionRuntime.normalizeAISessionCoreState(base.aiMemory, {
          normalizeChatSessions: true,
          maxChatSessions: PERSISTED_AI_CHAT_MAX_SESSIONS,
        });
      }
    }
    if (sourceRaw.writingStudio && typeof sourceRaw.writingStudio === 'object') {
      const raw = sourceRaw.writingStudio;
      base.writingStudio = {
        corpus: Array.isArray(raw.corpus) ? raw.corpus : [],
        styleFingerprint: typeof raw.styleFingerprint === 'string' ? raw.styleFingerprint : '',
        topicBacklog: typeof raw.topicBacklog === 'string' ? raw.topicBacklog : '',
        trainingBrief: typeof raw.trainingBrief === 'string' ? raw.trainingBrief : '',
        index: raw.index && typeof raw.index === 'object'
          ? {
              generatedAt: typeof raw.index.generatedAt === 'string' ? raw.index.generatedAt : '',
              totalFiles: Number.isFinite(Number(raw.index.totalFiles)) ? Number(raw.index.totalFiles) : 0,
              categories: Array.isArray(raw.index.categories) ? raw.index.categories : [],
            }
          : {
              generatedAt: '',
              totalFiles: 0,
              categories: [],
            },
        runtimePrompt: typeof raw.runtimePrompt === 'string' ? raw.runtimePrompt : '',
        runtimePromptUpdatedAt: typeof raw.runtimePromptUpdatedAt === 'string' ? raw.runtimePromptUpdatedAt : '',
      };
    }
    const glucoseRaw = (
      (sourceRaw.glucoseSync && typeof sourceRaw.glucoseSync === 'object' && sourceRaw.glucoseSync)
      || (sourceRaw.glucose && typeof sourceRaw.glucose === 'object' && sourceRaw.glucose)
      || (sourceRaw.health && sourceRaw.health.glucose && typeof sourceRaw.health.glucose === 'object' && sourceRaw.health.glucose)
      || null
    );
    if (glucoseRaw) {
      base.glucoseSync = {
        reading: glucoseRaw.reading && typeof glucoseRaw.reading === 'object' ? glucoseRaw.reading : null,
        series: Array.isArray(glucoseRaw.series) ? glucoseRaw.series : [],
        range: glucoseRaw.range && typeof glucoseRaw.range === 'object'
          ? {
              targetLow: Number.isFinite(Number(glucoseRaw.range.targetLow)) ? Number(glucoseRaw.range.targetLow) : 70,
              targetHigh: Number.isFinite(Number(glucoseRaw.range.targetHigh)) ? Number(glucoseRaw.range.targetHigh) : 180,
            }
          : {
              targetLow: 70,
              targetHigh: 180,
            },
        updatedAt: typeof glucoseRaw.updatedAt === 'string'
          ? glucoseRaw.updatedAt
          : (typeof glucoseRaw.fetchedAt === 'string' ? glucoseRaw.fetchedAt : ''),
      };
    }
    base.glucoseHistoryArchive = Array.isArray(sourceRaw.glucoseHistoryArchive)
      ? sourceRaw.glucoseHistoryArchive
      : (Array.isArray(glucoseRaw?.archive) ? glucoseRaw.archive : []);
    if (sourceRaw.appleHealthSync && typeof sourceRaw.appleHealthSync === 'object') {
      base.appleHealthSync = sourceRaw.appleHealthSync;
    }
    if (sourceRaw.secureVault && typeof sourceRaw.secureVault === 'object') {
      base.secureVault = sanitizeSecureVault(sourceRaw.secureVault);
    }
    return markNormalizedDataSnapshot(attachFlashThoughtsAlias(base));
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.data);
      const parsed = raw ? JSON.parse(raw) : null;
      const normalized = normalizeData(parsed);
      const mergedEditorHistory = mergeEditorHistoryState(
        readLocalEditorHistoryState(),
        extractEditorHistoryStateFromData(normalized)
      );
      applyEditorHistoryStateToData(normalized, mergedEditorHistory);
      writeLocalCacheReplicas(normalized, mergedEditorHistory);
      return normalized;
    } catch (error) {
      console.warn('[MorphStorage] Failed to load data, using defaults.', error);
      return cloneDefaultData();
    }
  }

  let syncTimer = null;
  let syncInFlight = false;
  let syncQueuedData = null;
  let syncWarned = false;
  const IS_TOUCH_RUNTIME = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const NATIVE_SYNC_DEBOUNCE_MS = IS_TOUCH_RUNTIME ? 850 : 300;
  const SERVER_SYNC_DEBOUNCE_MS = IS_TOUCH_RUNTIME ? 700 : 260;
  const WEB_SYNC_ROOT_WRITE_DEBOUNCE_MS = IS_TOUCH_RUNTIME ? 550 : 180;
  const DEFAULT_SYNC_ENDPOINT = 'http://127.0.0.1:2199/api/sync';
  let nativeSyncTimer = null;
  let nativeSyncWarned = false;
  let nativeSyncQueuedData = null;
  let nativeSyncQueuedHint = null;
  let nativeSyncInFlight = false;
  let nativeSyncInFlightData = null;
  let nativeSyncInFlightHint = null;
  let nativeControlSeq = 0;
  const nativeControlPending = new Map();
  const NATIVE_CONTROL_TIMEOUT_MS = 5000;
  const NATIVE_CONTROL_TIMEOUT_BY_ACTION = {
    fetchGlucoseHistory: 65000,
    fetchAppleHealthSnapshot: 45000,
    requestAppleHealthAuthorization: 60000,
    requestAIChat: 120000,
    requestCodexCompatibleChat: 120000,
    readExtensionDataFile: 12000,
    writeExtensionDataFile: 12000,
    appendExtensionDataFile: 12000,
    bluetoothRequestDevice: 60000,
    bluetoothConnect: 15000,
    bluetoothReadCharacteristic: 10000,
    bluetoothStartNotifications: 10000,
  };

  function getSyncEndpoint() {
    if (typeof window === 'undefined' || !window.location) return DEFAULT_SYNC_ENDPOINT;
    if (/^https?:$/.test(window.location.protocol)) return '/api/sync';
    return DEFAULT_SYNC_ENDPOINT;
  }

  function canUseServerSync() {
    return typeof window !== 'undefined'
      && typeof fetch === 'function';
  }

  function getNativeMessageHandler(primaryName, legacyName) {
    if (typeof window === 'undefined') return null;
    const handlers = window.webkit && window.webkit.messageHandlers;
    if (!handlers) return null;
    const primary = handlers[primaryName];
    if (primary && typeof primary.postMessage === 'function') return primary;
    const legacy = handlers[legacyName];
    if (legacy && typeof legacy.postMessage === 'function') return legacy;
    return null;
  }

  function hasNativeSyncBridge() {
    return typeof window !== 'undefined'
      && !!getNativeMessageHandler('morphSync');
  }

  function hasNativeControlBridge() {
    return typeof window !== 'undefined'
      && !!getNativeMessageHandler('morphDesktopControl');
  }

  function normalizeMirrorDeltaDomain(domain = '') {
    const normalized = String(domain || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'daily' || normalized === 'dailymonths' || normalized === 'dailymonth') return 'daily';
    if (normalized === 'project' || normalized === 'projects') return 'projects';
    if (normalized === 'projectspaces' || normalized === 'project_space') return 'projects';
    if (normalized === 'routine' || normalized === 'routines') return 'routines';
    if (normalized === 'rhythm' || normalized === 'schedule' || normalized === 'schedulemvp' || normalized === 'schedule_mvp') return 'rhythm';
    if (normalized === 'sop' || normalized === 'sops') return 'sops';
    if (normalized === 'flashthoughts' || normalized === 'flash' || normalized === 'fleeting') return 'flashThoughts';
    if (normalized === 'fixed' || normalized === 'fixedthoughts') return 'fixed';
    if (normalized === 'reminder' || normalized === 'reminders') return 'reminders';
    if (
      normalized === 'aimemory'
      || normalized === 'aimemoryfull'
      || normalized === 'ai_memory'
      || normalized === 'chat'
      || normalized === 'conversations'
      || normalized === 'aichatsessions'
      || normalized === 'aidailylogs'
      || normalized === 'aicurrentchatsessionid'
    ) return 'aiMemory';
    if (normalized === 'none') return 'none';
    if (normalized === 'meta' || normalized === 'all') return normalized;
    return '';
  }

  function normalizeMirrorDeltaEntityRef(rawRef) {
    if (!rawRef || typeof rawRef !== 'object') return null;
    const domain = normalizeMirrorDeltaDomain(rawRef.domain || rawRef.scope || '');
    const type = String(rawRef.type || rawRef.entityType || '').trim();
    const id = String(rawRef.id || rawRef.entityId || '').trim();
    if (!domain || !id) return null;
    const next = { domain, id };
    if (type) next.type = type;
    return next;
  }

  function normalizeMirrorDeltaHint(rawHint) {
    if (!rawHint || typeof rawHint !== 'object') return null;
    const rawDomains = Array.isArray(rawHint.domains) ? rawHint.domains : [];
    const rawEntityRefs = Array.isArray(rawHint.entityRefs) ? rawHint.entityRefs : [];
    const hasRawHint = rawDomains.length > 0 || rawEntityRefs.length > 0;
    const seenDomains = new Set();
    const domains = [];
    rawDomains.forEach((item) => {
      const domain = normalizeMirrorDeltaDomain(item);
      if (!domain || seenDomains.has(domain)) return;
      seenDomains.add(domain);
      domains.push(domain);
    });
    const entityRefs = [];
    const seenEntityRefs = new Set();
    rawEntityRefs.forEach((item) => {
      const normalized = normalizeMirrorDeltaEntityRef(item);
      if (!normalized) return;
      const key = JSON.stringify(normalized);
      if (seenEntityRefs.has(key)) return;
      seenEntityRefs.add(key);
      entityRefs.push(normalized);
    });
    if (domains.includes('all')) return { domains: ['all'], entityRefs: [] };
    const effectiveDomains = domains.filter((domain) => domain !== 'none');
    if (!effectiveDomains.length && !entityRefs.length && hasRawHint) {
      return { domains: ['none'], entityRefs: [] };
    }
    if (!effectiveDomains.length && !entityRefs.length) return null;
    const hint = {};
    if (effectiveDomains.length) hint.domains = effectiveDomains;
    if (entityRefs.length) hint.entityRefs = entityRefs;
    return hint;
  }

  function mergeMirrorDeltaHints(previousHint, nextHint) {
    const prev = normalizeMirrorDeltaHint(previousHint);
    const next = normalizeMirrorDeltaHint(nextHint);
    if (!prev && !next) return null;
    if (!prev) return next;
    if (!next) return prev;
    return normalizeMirrorDeltaHint({
      domains: [...(prev.domains || []), ...(next.domains || [])],
      entityRefs: [...(prev.entityRefs || []), ...(next.entityRefs || [])],
    });
  }

  function callNativeDesktopControl(action, payload, options = {}) {
    if (!hasNativeControlBridge()) {
      return Promise.reject(new Error('native_control_unavailable'));
    }
    return new Promise((resolve, reject) => {
      const id = `ctl_${Date.now()}_${++nativeControlSeq}`;
      const optionTimeoutMs = Number(options && options.timeoutMs);
      const timeoutMs = Number.isFinite(optionTimeoutMs) && optionTimeoutMs > 0
        ? optionTimeoutMs
        : (Number(NATIVE_CONTROL_TIMEOUT_BY_ACTION[action]) || NATIVE_CONTROL_TIMEOUT_MS);
      const scheduleTimeout = () => setTimeout(() => {
        const pending = nativeControlPending.get(id);
        if (!pending) return;
        nativeControlPending.delete(id);
        reject(new Error('native_control_timeout'));
      }, timeoutMs);
      const timeoutId = scheduleTimeout();
      const onProgress = options && typeof options.onProgress === 'function'
        ? options.onProgress
        : null;
      nativeControlPending.set(id, { resolve, reject, action, timeoutMs, timeoutId, onProgress, scheduleTimeout });
      try {
        getNativeMessageHandler('morphDesktopControl').postMessage(JSON.stringify({
          id,
          action,
          payload: payload || {},
        }));
      } catch (error) {
        clearTimeout(timeoutId);
        nativeControlPending.delete(id);
        reject(error);
      }
    });
  }

  function postNativeSync(data, mirrorDeltaHint = null) {
    if (!hasNativeSyncBridge()) return false;
    try {
      const payload = serializeDataForPersistence(data);
      const message = { data: payload };
      const normalizedHint = normalizeMirrorDeltaHint(mirrorDeltaHint);
      if (normalizedHint) message.mirrorDelta = normalizedHint;
      getNativeMessageHandler('morphSync').postMessage(JSON.stringify(message));
      return true;
    } catch (error) {
      if (!nativeSyncWarned) {
        console.warn('[MorphStorage] Native sync bridge failed.', error);
        nativeSyncWarned = true;
      }
      return false;
    }
  }

  function flushNativeSyncQueue() {
    if (!hasNativeSyncBridge()) return false;
    if (nativeSyncInFlight) return false;
    if (!nativeSyncQueuedData) return false;
    const payload = nativeSyncQueuedData;
    const payloadHint = normalizeMirrorDeltaHint(nativeSyncQueuedHint);
    nativeSyncInFlight = true;
    nativeSyncInFlightData = payload;
    nativeSyncInFlightHint = payloadHint;
    setSyncStatus('syncing', '同步中', { source: 'native-sync', reason: 'flush' });
    if (!postNativeSync(payload, payloadHint)) {
      nativeSyncInFlight = false;
      nativeSyncInFlightData = null;
      nativeSyncInFlightHint = null;
      nativeSyncQueuedData = null;
      nativeSyncQueuedHint = null;
      queueServerSyncFallback(payload);
      return false;
    }
    return true;
  }

  function hasReadableBrowserSyncRootSelected() {
    const meta = getWebSyncRootMeta();
    return !!(meta && meta.readable !== false);
  }

  function shouldTreatServerSyncAsAuxiliary() {
    return hasReadableBrowserSyncRootSelected() && !hasNativeSyncBridge();
  }

  function shouldDowngradeServerSyncFailureStatus(meta = {}, text = '') {
    const source = String(meta && meta.source ? meta.source : '').trim().toLowerCase();
    const reason = String(meta && meta.reason ? meta.reason : '').trim().toLowerCase();
    const label = String(text || '').trim();
    if (source !== 'server-sync') return false;
    if (!hasReadableBrowserSyncRootSelected()) return false;
    return reason === 'sync_failed'
      || /failed to fetch|networkerror|load failed/.test(reason)
      || /辅助同步服务未连接|无法连接同步服务/.test(label);
  }

  function setSyncStatus(state, text, meta = {}) {
    const runtime = getSyncRuntimeModules();
    const derived = runtime && typeof runtime.deriveSyncStatusDescriptor === 'function'
      ? runtime.deriveSyncStatusDescriptor(state, text, meta, getSyncMutationState())
      : { state, text, meta };
    const dot = typeof document !== 'undefined' ? document.getElementById('sync-status-dot') : null;
    const label = typeof document !== 'undefined' ? document.getElementById('sync-status-text') : null;
    if (!dot || !label) return;
    let nextState = String(derived.state || state || '').trim();
    let nextText = String(derived.text || text || '').trim();
    const nextMeta = derived.meta || meta;
    if (nextState === 'error' && shouldDowngradeServerSyncFailureStatus(nextMeta, nextText)) {
      nextState = 'idle';
      nextText = '辅助同步服务未连接，浏览器目录仍可写';
    }
    if (shouldExposeMorphDevRawFailures()) {
      nextText = buildMorphDevSyncStatusText(nextState, nextText, nextMeta);
    }
    dot.className = 'w-2 h-2 rounded-full';
    if (nextState === 'ok') dot.classList.add('bg-green-500');
    else if (nextState === 'syncing') dot.classList.add('bg-yellow-500');
    else if (nextState === 'error') dot.classList.add('bg-red-500');
    else dot.classList.add('bg-gray-300');
    label.textContent = nextText;
    if (label.dataset && typeof label.dataset === 'object') label.dataset.fullText = nextText;
    label.title = nextText;
    if (typeof window !== 'undefined') {
      const callback = window.MorphOnSyncStatusChanged || window.LianXingOnSyncStatusChanged;
      if (typeof callback === 'function') {
        try { callback(nextState, nextText); } catch (_) {}
      }
    }
  }

  function setLastSyncAt(isoString) {
    try { localStorage.setItem(STORAGE_KEYS.lastSyncAt, isoString || new Date().toISOString()); } catch (_) {}
  }

  function getLastSyncAt() {
    try { return localStorage.getItem(STORAGE_KEYS.lastSyncAt) || ''; } catch (_) { return ''; }
  }

  function setLastRestoreAt(isoString) {
    try { localStorage.setItem(STORAGE_KEYS.lastRestoreAt, isoString || new Date().toISOString()); } catch (_) {}
  }

  function getLastRestoreAt() {
    try { return localStorage.getItem(STORAGE_KEYS.lastRestoreAt) || ''; } catch (_) { return ''; }
  }

  function shouldDeferAuthoritativePersist() {
    if (typeof window === 'undefined') return false;
    const callback = window.MorphShouldDeferAuthoritativePersist || window.LianXingShouldDeferAuthoritativePersist;
    if (typeof callback !== 'function') return false;
    try {
      return callback() === true;
    } catch (_) {
      return false;
    }
  }

  function clearDeferredAuthoritativePersistTimer() {
    if (!deferredAuthoritativePersistTimer) return;
    clearTimeout(deferredAuthoritativePersistTimer);
    deferredAuthoritativePersistTimer = null;
  }

  function queueDeferredAuthoritativePersistSnapshot(snapshot, delayMs = 1200, mirrorDeltaHint = null) {
    deferredAuthoritativePersistData = ensureNormalizedDataSnapshot(snapshot);
    deferredAuthoritativePersistHint = mergeMirrorDeltaHints(deferredAuthoritativePersistHint, mirrorDeltaHint);
    clearDeferredAuthoritativePersistTimer();
    deferredAuthoritativePersistTimer = setTimeout(flushDeferredAuthoritativePersist, Math.max(420, Number(delayMs) || 0));
  }

  function scheduleDeferredAuthoritativePersist(data, delayMs = 1200, mirrorDeltaHint = null) {
    queueDeferredAuthoritativePersistSnapshot(data, delayMs, mirrorDeltaHint);
  }

  function flushDeferredAuthoritativePersist() {
    clearDeferredAuthoritativePersistTimer();
    if (!deferredAuthoritativePersistData) return false;
    const hint = deferredAuthoritativePersistHint;
    if (shouldDeferAuthoritativePersist()) {
      queueDeferredAuthoritativePersistSnapshot(deferredAuthoritativePersistData, 1200, hint);
      return false;
    }
    const source = deferredAuthoritativePersistData;
    deferredAuthoritativePersistData = null;
    deferredAuthoritativePersistHint = null;
    scheduleWebSyncRootSnapshot(source, hint);
    scheduleServerSync(source, hint);
    return true;
  }

  function tryApplyIncomingServerSnapshot(snapshot, context = 'server-sync', options = {}) {
    if (!snapshot || typeof snapshot !== 'object' || typeof window === 'undefined') return false;
    const callback = window.MorphApplyServerSyncSnapshot || window.LianXingApplyServerSyncSnapshot;
    if (typeof callback === 'function') {
      try {
        return callback(snapshot, { context, ...(options && typeof options === 'object' ? options : {}) }) === true;
      } catch (_) {
        return false;
      }
    }
    try {
      const normalized = normalizeData(snapshot);
      writeLocalCacheReplicas(normalized);
      setLastRestoreAt(new Date().toISOString());
      return true;
    } catch (_) {
      return false;
    }
  }

  async function readLiveDataFromWebSyncRoot() {
    const selection = await ensureWebSyncRootSelection({ requireWrite: false });
    let candidates = WEB_SYNC_ROOT_LIVE_DATA_CANDIDATES.slice();
    if (selection.mode === 'filelist') {
      const discovered = listLikelyWebSyncLiveDataPathsFromFiles(selection.files);
      if (discovered.length) candidates = discovered;
    } else if (selection.mode === 'handle') {
      const discovered = await scanDirectoryHandleForLiveDataPaths(selection.handle, { maxDepth: 5 });
      if (discovered.length) candidates = discovered;
    }
    let lastError = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const relativePath = normalizeWebSyncRelativePath(candidates[i]);
      if (!relativePath) continue;
      try {
        const text = selection.mode === 'filelist'
          ? await (selection.files.get(relativePath)?.text?.() || Promise.reject(new Error('browser_sync_file_not_found')))
          : await readTextFromWebSyncRoot(relativePath);
        const parsed = text ? JSON.parse(text) : null;
        const normalized = normalizeData(parsed && parsed.data ? parsed.data : parsed);
        const pathPrefix = deriveWebSyncPathPrefixFromLiveDataPath(relativePath);
        updateWebSyncRuntimeLocation({
          pathPrefix,
          liveDataRelativePath: relativePath,
        });
        return {
          ok: true,
          relativePath,
          data: normalized,
          pathPrefix,
          repairedMonths: [],
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('browser_sync_live_data_not_found');
  }

  function unwrapPersistedDataEnvelope(raw) {
    if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') return raw.data;
    return raw;
  }

  function getWebSyncComparableRevision(raw) {
    const target = unwrapPersistedDataEnvelope(raw);
    const revision = Number(target && target.syncMeta ? target.syncMeta.revision || 0 : 0);
    return Number.isFinite(revision) ? revision : 0;
  }

  function getWebSyncComparableWriteAt(raw) {
    const target = unwrapPersistedDataEnvelope(raw);
    const text = String(
      target && target.syncMeta
        ? (target.syncMeta.lastClientWriteAt || target.syncMeta.lastServerWriteAt || '')
        : ''
    ).trim();
    if (!text) return 0;
    const value = Date.parse(text);
    return Number.isFinite(value) ? value : 0;
  }

  function getWebSyncComparableRichness(raw) {
    const target = normalizeData(unwrapPersistedDataEnvelope(raw));
    if (!target || typeof target !== 'object') return 0;
    const counts = [
      Array.isArray(target.flashThoughts) ? target.flashThoughts.length : 0,
      Array.isArray(target.completedFlashThoughts) ? target.completedFlashThoughts.length : 0,
      Array.isArray(target.fixed) ? target.fixed.length : 0,
      Array.isArray(target.completedFixedThoughts) ? target.completedFixedThoughts.length : 0,
      Array.isArray(target.projects) ? target.projects.length : 0,
      Array.isArray(target.routines) ? target.routines.length : 0,
      target.scheduleMvp && typeof target.scheduleMvp === 'object'
        ? Object.keys(target.scheduleMvp.video || {}).length
          + Object.keys(target.scheduleMvp.review || {}).length
          + Object.keys(target.scheduleMvp.sleep || {}).length
          + Object.keys(target.scheduleMvp.exercise || {}).length
          + (Array.isArray(target.scheduleMvp.custom) ? target.scheduleMvp.custom.length : 0)
          + Object.keys(target.scheduleMvp.customDone || {}).length
          + (Array.isArray(target.scheduleMvp.cardOrder) ? target.scheduleMvp.cardOrder.length : 0)
        : 0,
      Array.isArray(target.sops) ? target.sops.length : 0,
      target.dailyMonths && typeof target.dailyMonths === 'object' ? Object.keys(target.dailyMonths).length : 0,
      Array.isArray(target.aiMemory && target.aiMemory.chatSessions) ? target.aiMemory.chatSessions.length : 0,
      target.aiMemory && target.aiMemory.dailyLogs && typeof target.aiMemory.dailyLogs === 'object' ? Object.keys(target.aiMemory.dailyLogs).length : 0,
      Array.isArray(target.expenseLedger && target.expenseLedger.records) ? target.expenseLedger.records.length : 0,
      target.appleHealthSync && typeof target.appleHealthSync.snapshot === 'object' ? 1 : 0,
    ];
    return counts.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  }

  async function ensureWebSyncRootWriteIsSafe(targetPath, payload) {
    try {
      const existingText = await readTextFromWebSyncRoot(targetPath);
      if (!existingText) return { ok: true };
      const existingRaw = JSON.parse(existingText);
      const incomingRaw = payload && typeof payload === 'object' ? payload : {};
      const existingRevision = getWebSyncComparableRevision(existingRaw);
      const incomingRevision = getWebSyncComparableRevision(incomingRaw);
      const existingWriteAt = getWebSyncComparableWriteAt(existingRaw);
      const incomingWriteAt = getWebSyncComparableWriteAt(incomingRaw);
      const existingRichness = getWebSyncComparableRichness(existingRaw);
      const incomingRichness = getWebSyncComparableRichness(incomingRaw);
      if (existingRevision > incomingRevision) {
        return {
          ok: false,
          reason: 'newer_revision',
          existingRevision,
          incomingRevision,
        };
      }
      if (existingRevision === incomingRevision && existingRichness > incomingRichness) {
        return {
          ok: false,
          reason: 'richer_same_revision',
          existingRevision,
          incomingRevision,
        };
      }
      if (existingWriteAt > incomingWriteAt && existingRichness > incomingRichness) {
        return {
          ok: false,
          reason: 'newer_and_richer_target',
          existingRevision,
          incomingRevision,
        };
      }
      return { ok: true };
    } catch (error) {
      if (String(error && error.message || '').trim() === 'browser_sync_file_not_found') {
        return { ok: true };
      }
      return { ok: true };
    }
  }

  async function mergeWebSyncRootScheduleMvpBeforeWrite(targetPath, payload) {
    try {
      const existingText = await readTextFromWebSyncRoot(targetPath);
      if (!existingText) return payload;
      const existingRaw = JSON.parse(existingText);
      const existingData = unwrapPersistedDataEnvelope(existingRaw);
      const incomingData = unwrapPersistedDataEnvelope(payload);
      if (!existingData || !incomingData || typeof existingData !== 'object' || typeof incomingData !== 'object') {
        return payload;
      }
      if (countStartupScheduleMvpRecords(existingData.scheduleMvp) <= 0) return payload;
      const mergedScheduleMvp = mergeStartupScheduleMvpState(existingData.scheduleMvp, incomingData.scheduleMvp);
      const incomingScheduleMvp = sanitizeScheduleMvpState(incomingData.scheduleMvp, { includeDefaults: false });
      if (JSON.stringify(mergedScheduleMvp) === JSON.stringify(incomingScheduleMvp)) return payload;
      incomingData.scheduleMvp = mergedScheduleMvp;
      return payload;
    } catch (error) {
      return payload;
    }
  }

  async function reloadDataFromWebSyncRoot(options = {}) {
    const silent = options.silent === true;
    const forceApply = options.forceApply === true || options.force === true;
    const acceptDeferred = options.acceptDeferred === true || (!forceApply && silent === true);
    const loaded = await readLiveDataFromWebSyncRoot();
    let applied = false;
    let applyStatus = null;
    const callback = typeof window !== 'undefined'
      ? (window.MorphApplyServerSyncSnapshot || window.LianXingApplyServerSyncSnapshot)
      : null;
    if (typeof callback === 'function') {
      try {
        if (typeof window !== 'undefined') {
          try {
            delete window.__MorphLastServerSyncApplyStatus;
            delete window.__LianXingLastServerSyncApplyStatus;
          } catch (_) {}
        }
        applied = callback(loaded.data, {
          force: forceApply,
          forceApply,
          acceptDeferred,
          source: 'browser-sync-root',
        }) === true;
        if (typeof window !== 'undefined') {
          applyStatus = window.__MorphLastServerSyncApplyStatus || window.__LianXingLastServerSyncApplyStatus || null;
        }
      } catch (_) {
        applied = false;
      }
    } else {
      applied = tryApplyIncomingServerSnapshot(loaded.data, 'browser-sync-root');
    }
    if (!applied) {
      throw new Error('browser_sync_apply_failed');
    }
    const normalizedApplyStatus = applyStatus && typeof applyStatus === 'object'
      ? applyStatus
      : {
          ok: applied,
          accepted: applied,
          applied,
          reason: applied ? 'applied' : 'unknown',
        };
    const shouldAdoptLoadedData = normalizedApplyStatus.applied === true || String(normalizedApplyStatus.reason || '').trim() === 'same_data';
    if (shouldAdoptLoadedData) {
      setLastRestoreAt(new Date().toISOString());
    }
    const runtime = getStartupStorageRuntimeModules();
    const adoption = runtime && typeof runtime.describeBrowserSyncRootAdoption === 'function'
      ? runtime.describeBrowserSyncRootAdoption({ silent })
      : {
        source: 'browser-sync-root',
        reason: silent ? 'browser_sync_root_bootstrap' : 'browser_sync_root_manual_reload',
        message: silent ? '已载入用户目录' : '已从用户目录重新载入',
      };
    const deferredReason = String(normalizedApplyStatus.reason || '').trim();
    const deferredReasonSet = new Set(['editing_in_progress', 'local_dirty_pending_sync', 'external_reload_deferred', 'recent_local_commit', 'draft_protected']);
    const shouldHoldAdoption = deferredReasonSet.has(deferredReason);
    let adoptedReceipt = null;
    if (shouldAdoptLoadedData) {
      adoptedReceipt = adoptBrowserSyncRootAsCurrentSource(loaded.data, adoption);
    }
    if (!silent && shouldHoldAdoption) {
      setSyncStatus('ok', '用户目录已有更新，但当前本地还有待确认写入，暂缓接管。', {
        source: 'browser-sync-root',
        reason: deferredReason || 'external_reload_deferred',
      });
    } else if (!silent) {
      setSyncStatus('ok', adoptedReceipt && adoptedReceipt.message ? adoptedReceipt.message : '已从所选目录载入', {
        source: 'browser-sync-root',
        reason: 'manual_reload',
      });
    }
    return {
      ok: true,
      applied: shouldAdoptLoadedData,
      deferred: !shouldAdoptLoadedData && shouldHoldAdoption,
      reason: deferredReason || String(normalizedApplyStatus.reason || '').trim(),
      relativePath: loaded.relativePath,
      data: loaded.data,
    };
  }

  async function flushWebSyncRootSnapshot() {
    if (!webSyncSnapshotQueuedData) return;
    const source = webSyncSnapshotQueuedData;
    const sourceHint = webSyncSnapshotQueuedHint;
    webSyncSnapshotQueuedData = null;
    webSyncSnapshotQueuedHint = null;
    try {
      await ensureWebSyncRootSelection({ requireWrite: true });
      const payload = serializeDataForPersistence(source);
      const targetPath = normalizeWebSyncRelativePath(webSyncRootRuntimeState.liveDataRelativePath || '') || 'data/live-data.json';
      await mergeWebSyncRootScheduleMvpBeforeWrite(targetPath, payload);
      const safeToWrite = await ensureWebSyncRootWriteIsSafe(targetPath, payload);
      if (!safeToWrite || safeToWrite.ok === false) {
        try {
          setSyncStatus('ok', '检测到用户目录里已有更新版本，已放弃旧内存回写并重新载入', {
            source: 'browser-sync-root',
            reason: safeToWrite && safeToWrite.reason ? safeToWrite.reason : 'write_guard',
          });
          await reloadDataFromWebSyncRoot({ silent: true });
        } catch (_) {}
        webSyncWarned = false;
        return;
      }
      await writeTextToWebSyncRoot(targetPath, JSON.stringify(payload, null, 2));
      const hintedMonthKeys = extractDailyMirrorMonthKeysFromHint(sourceHint);
      const shouldRefreshDailyDerivedFiles = !sourceHint
        || hintedMonthKeys === null
        || hintedMonthKeys.length > 0;
      if (shouldRefreshDailyDerivedFiles) {
        await syncDailyDerivedFilesToWebSyncRoot(source, sourceHint).catch((error) => {
          console.warn('[MorphStorage] Browser sync root daily derived files refresh skipped.', error);
        });
      }
      const runtime = getSyncRuntimeModules();
      const writtenRevision = Number(source && source.syncMeta ? source.syncMeta.revision || 0 : 0);
      const ackResult = writtenRevision > 0
        ? (runtime && typeof runtime.acknowledgeSyncMutationsThroughRevision === 'function'
          ? runtime.acknowledgeSyncMutationsThroughRevision(writtenRevision)
          : acknowledgeSyncMutationsThroughRevision(writtenRevision))
        : {
          ackedRevision: getLastAckRevision(),
          pendingCount: Number((runtime && typeof runtime.getSyncMutationState === 'function'
            ? runtime.getSyncMutationState()
            : getSyncMutationState()
          )?.pendingCount || 0),
          ackedDomains: [],
          domainStates: {},
          entityStates: {},
        };
      const currentState = runtime && typeof runtime.getSyncMutationState === 'function'
        ? runtime.getSyncMutationState()
        : getSyncMutationState();
      const browserRootReceipt = writeLastSyncReceipt({
        updatedAt: new Date().toISOString(),
        status: 'acked',
        source: 'browser-sync-root',
        reason: 'authoritative_write',
        message: '已写入用户目录',
        ackedRevision: Number(ackResult.ackedRevision || writtenRevision || 0),
        pendingCount: Number(currentState.pendingCount || 0),
        pendingDomains: Array.isArray(currentState.pendingDomains) ? currentState.pendingDomains : [],
        mergedDomains: Array.isArray(ackResult.ackedDomains) ? ackResult.ackedDomains : [],
        domainStates: ackResult.domainStates && typeof ackResult.domainStates === 'object'
          ? ackResult.domainStates
          : currentState.domainStates,
        entityStates: ackResult.entityStates && typeof ackResult.entityStates === 'object'
          ? ackResult.entityStates
          : currentState.entityStates,
      });
      setLastSyncAt(new Date().toISOString());
      if (shouldTreatServerSyncAsAuxiliary()) {
        setSyncStatus('ok', browserRootReceipt && browserRootReceipt.message ? browserRootReceipt.message : '已写入用户目录', {
          source: 'browser-sync-root',
          reason: 'authoritative_write',
        });
      }
      webSyncWarned = false;
    } catch (error) {
      webSyncSnapshotQueuedData = source;
      if (!webSyncWarned) {
        console.warn('[MorphStorage] Browser sync root write skipped.', error);
        webSyncWarned = true;
      }
    } finally {
      if (webSyncSnapshotQueuedData) {
        clearTimeout(webSyncSnapshotTimer);
        webSyncSnapshotTimer = setTimeout(flushWebSyncRootSnapshot, 1500);
      }
    }
  }

  function scheduleWebSyncRootSnapshot(data, mirrorDeltaHint = null) {
    const meta = getWebSyncRootMeta();
    if (!meta || meta.mode !== 'handle') return;
    webSyncSnapshotQueuedData = data;
    webSyncSnapshotQueuedHint = mergeMirrorDeltaHints(webSyncSnapshotQueuedHint, mirrorDeltaHint);
    clearTimeout(webSyncSnapshotTimer);
    webSyncSnapshotTimer = setTimeout(flushWebSyncRootSnapshot, WEB_SYNC_ROOT_WRITE_DEBOUNCE_MS);
  }

  function normalizeSyncFailureMessage(reason, fallbackMessage) {
    const safeReason = String(reason || '').trim();
    const safeFallback = String(fallbackMessage || '').trim();
    if (!safeReason && !safeFallback) return '同步失败';
    if (
      /empty_snapshot_rejected/i.test(safeReason)
      || /refused to overwrite non-empty cloud data with empty payload/i.test(safeReason)
      || /refused to overwrite non-empty cloud data with empty payload/i.test(safeFallback)
    ) {
      return '已拦截一次旧空数据覆盖，当前用户数据未受影响';
    }
    if (safeFallback) {
      if (safeFallback.startsWith('同步失败')) return safeFallback;
      return `同步失败：${safeFallback}`;
    }
    if (/failed to fetch|networkerror|load failed/i.test(safeReason)) {
      if (hasReadableBrowserSyncRootSelected()) {
        return '辅助同步服务未连接，浏览器目录仍可写';
      }
      return '同步失败：无法连接同步服务';
    }
    return safeReason.startsWith('同步失败') ? safeReason : `同步失败：${safeReason}`;
  }

  function createSyncFailureError(reason, message) {
    const error = new Error(String(message || '同步失败'));
    error.syncReason = String(reason || '').trim();
    error.syncMessage = String(message || '同步失败').trim();
    return error;
  }

  async function flushServerSync() {
    if (!canUseServerSync() || syncInFlight || !syncQueuedData) return;
    const source = syncQueuedData;
    syncQueuedData = null;
    syncInFlight = true;
    const runtime = getSyncRuntimeModules();
    const browserDirectoryPrimary = shouldTreatServerSyncAsAuxiliary();
    setSyncStatus('syncing', '同步中', { source: 'server-sync', reason: 'flush' });

    try {
      const payload = serializeDataForPersistence(source);
      const syncMutationState = runtime && typeof runtime.getSyncMutationState === 'function'
        ? runtime.getSyncMutationState()
        : getSyncMutationState();
      const res = await fetch(getSyncEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          data: payload,
          syncSummary: {
            ackedRevision: Number(syncMutationState.ackedRevision || 0),
            pendingCount: Number(syncMutationState.pendingCount || 0),
            latestPendingRevision: Number(syncMutationState.latestPendingRevision || 0),
            pendingDomains: Array.isArray(syncMutationState.pendingDomains) ? syncMutationState.pendingDomains : [],
            pendingEntityRefs: Array.isArray(syncMutationState.pendingEntityRefs) ? syncMutationState.pendingEntityRefs : [],
            pendingMutations: Array.isArray(syncMutationState.pendingMutations) ? syncMutationState.pendingMutations : [],
            deviceId: getSyncDeviceId(),
            revision: Number(source && source.syncMeta ? source.syncMeta.revision || 0 : 0),
            lastClientWriteAt: String(source && source.syncMeta ? source.syncMeta.lastClientWriteAt || '' : '').trim(),
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && body && typeof body === 'object' && body.currentData) {
          if (browserDirectoryPrimary) {
            syncWarned = false;
            const protectedReceipt = writeLastSyncReceipt({
              ...(body.receipt && typeof body.receipt === 'object' ? body.receipt : {}),
              updatedAt: new Date().toISOString(),
              status: 'noop',
              source: 'server-sync',
              reason: 'auxiliary_server_snapshot_ignored',
              message: '浏览器目录为主写入，已忽略辅助同步服务旧版本',
            });
            setSyncStatus('idle', protectedReceipt && protectedReceipt.message ? protectedReceipt.message : '浏览器目录为主写入，已忽略辅助同步服务旧版本', {
              source: 'server-sync',
              reason: 'auxiliary_server_snapshot_ignored',
            });
            return;
          }
          const applied = tryApplyIncomingServerSnapshot(body.currentData, 'stale_external_snapshot');
          if (applied) {
            syncWarned = false;
            const restoredState = runtime && typeof runtime.getSyncMutationState === 'function'
              ? runtime.getSyncMutationState()
              : getSyncMutationState();
            const restoredReceipt = writeLastSyncReceipt({
              ...(body.receipt && typeof body.receipt === 'object' ? body.receipt : {}),
              updatedAt: new Date().toISOString(),
              status: 'acked',
              source: 'server-sync',
              reason: 'stale_snapshot_applied',
              message: '已同步最新版本',
              ackedRevision: Number(restoredState.ackedRevision || 0),
              pendingCount: Number(restoredState.pendingCount || 0),
              pendingDomains: Array.isArray(restoredState.pendingDomains) ? restoredState.pendingDomains : [],
              domainStates: restoredState.domainStates,
              entityStates: restoredState.entityStates,
            });
            setLastRestoreAt(new Date().toISOString());
            setSyncStatus('ok', restoredReceipt && restoredReceipt.message ? restoredReceipt.message : '已同步最新版本', {
              source: 'server-sync',
              reason: 'stale_snapshot_applied',
            });
            return;
          }
        }
        const failureReceipt = body && typeof body === 'object' && body.writeReceipt && typeof body.writeReceipt === 'object'
          ? body.writeReceipt
          : (body && typeof body === 'object' && body.receipt && typeof body.receipt === 'object'
            ? body.receipt
            : null);
        const failureReason = String(
          (failureReceipt && failureReceipt.reason)
          || (body && typeof body === 'object' && body.error)
          || `http_${res.status}`
        ).trim();
        const failureMessage = normalizeSyncFailureMessage(
          failureReason,
          failureReceipt && failureReceipt.message
            ? failureReceipt.message
            : (body && typeof body === 'object' && body.hint ? body.hint : `HTTP ${res.status}`)
        );
        throw createSyncFailureError(failureReason, failureMessage);
      }
      syncWarned = false;
      if (body && body.currentData && typeof body.currentData === 'object' && (body.preservedRecentExternalMutations || body.serverMergedScheduleMvp)) {
        tryApplyIncomingServerSnapshot(body.currentData, 'server-sync-ack', {
          force: true,
          forceApply: true,
          acceptDeferred: true,
          source: 'server-sync-ack',
        });
      }
      let syncReceipt = null;
      if (source && typeof source === 'object' && source.syncMeta && typeof source.syncMeta === 'object') {
        source.syncMeta.lastServerWriteAt = typeof body?.savedAt === 'string' ? body.savedAt : new Date().toISOString();
        if (typeof source.syncMeta.deviceId !== 'string' || !source.syncMeta.deviceId.trim()) {
          source.syncMeta.deviceId = getSyncDeviceId();
        }
        const serverReceipt = body && typeof body === 'object' && body.writeReceipt && typeof body.writeReceipt === 'object'
          ? body.writeReceipt
          : (body && typeof body === 'object' && body.receipt && typeof body.receipt === 'object'
            ? body.receipt
            : null);
        const receiptMutationIds = [
          ...(Array.isArray(serverReceipt?.ackedMutations) ? serverReceipt.ackedMutations : []),
          ...(Array.isArray(serverReceipt?.mergedMutations) ? serverReceipt.mergedMutations : []),
        ]
          .map((item) => String(item && item.mutationId ? item.mutationId : '').trim())
          .filter(Boolean);
        const ackResult = receiptMutationIds.length
          ? (runtime && typeof runtime.acknowledgeSyncMutationsByIds === 'function'
            ? runtime.acknowledgeSyncMutationsByIds(receiptMutationIds, source.syncMeta.revision)
            : acknowledgeSyncMutationsByIds(receiptMutationIds, source.syncMeta.revision))
          : (runtime && typeof runtime.acknowledgeSyncMutationsThroughRevision === 'function'
            ? runtime.acknowledgeSyncMutationsThroughRevision(source.syncMeta.revision)
            : acknowledgeSyncMutationsThroughRevision(source.syncMeta.revision));
        const currentState = runtime && typeof runtime.getSyncMutationState === 'function'
          ? runtime.getSyncMutationState()
          : getSyncMutationState();
        const receiptState = runtime && typeof runtime.buildSyncReceiptRecord === 'function'
          ? runtime.buildSyncReceiptRecord(serverReceipt && typeof serverReceipt === 'object' ? serverReceipt : {}, {
              currentState,
              ackedDomains: Array.isArray(ackResult.ackedDomains) ? ackResult.ackedDomains : [],
              ackedEntityRefs: Array.isArray(ackResult.ackedEntityRefs) ? ackResult.ackedEntityRefs : [],
            })
          : (serverReceipt && typeof serverReceipt === 'object' ? serverReceipt : {});
        syncReceipt = writeLastSyncReceipt({
          ...receiptState,
          updatedAt: new Date().toISOString(),
          status: 'acked',
          source: 'server-sync',
          ackedRevision: ackResult.ackedRevision,
          pendingCount: ackResult.pendingCount,
          pendingDomains: Array.isArray(currentState.pendingDomains) ? currentState.pendingDomains : [],
          mergedDomains: Array.isArray(serverReceipt?.mergedDomains) && serverReceipt.mergedDomains.length
            ? serverReceipt.mergedDomains
            : ackResult.ackedDomains,
          domainStates: ackResult.domainStates,
          entityStates: ackResult.entityStates,
        });
      }
      scheduleLocalCacheWrite(source, { immediate: true });
      setLastSyncAt(new Date().toISOString());
      setSyncStatus('ok', syncReceipt && syncReceipt.message ? syncReceipt.message : '已同步', {
        source: String(syncReceipt && syncReceipt.source ? syncReceipt.source : 'server-sync').trim() || 'server-sync',
        reason: String(syncReceipt && syncReceipt.reason ? syncReceipt.reason : 'acked').trim() || 'acked',
      });
    } catch (error) {
      const reason = String(error && error.syncReason ? error.syncReason : '').trim() || 'sync_failed';
      const message = String(error && error.syncMessage ? error.syncMessage : '').trim()
        || normalizeSyncFailureMessage(String(error && error.message ? error.message : '').trim(), '');
      const browserSyncRootMeta = getWebSyncRootMeta();
      const hasReadableBrowserSyncRoot = !!(browserSyncRootMeta && browserSyncRootMeta.readable !== false);
      if (hasReadableBrowserSyncRoot && reason === 'empty_snapshot_rejected') {
        const protectedReceipt = adoptBrowserSyncRootAsCurrentSource(loadData(), {
          reason: 'stale_empty_payload_dropped',
          message: '已加载用户目录，已跳过一次旧空数据同步',
        });
        setSyncStatus('ok', protectedReceipt && protectedReceipt.message ? protectedReceipt.message : '已加载用户目录，已跳过一次旧空数据同步', {
          source: 'browser-sync-root',
          reason: 'stale_empty_payload_dropped',
        });
        return;
      }
      if (!browserDirectoryPrimary) {
        syncQueuedData = source;
      }
      const currentState = runtime && typeof runtime.getSyncMutationState === 'function'
        ? runtime.getSyncMutationState()
        : getSyncMutationState();
      writeLastSyncReceipt({
        updatedAt: new Date().toISOString(),
        status: 'error',
        source: 'server-sync',
        reason,
        message,
        ackedRevision: getLastAckRevision(),
        pendingCount: Number(currentState.pendingCount || 0),
        pendingDomains: Array.isArray(currentState.pendingDomains) ? currentState.pendingDomains : [],
        domainStates: currentState.domainStates,
        entityStates: currentState.entityStates,
      });
      setSyncStatus('error', message, { source: 'server-sync', reason });
      if (!syncWarned) {
        console.warn('[MorphStorage] Realtime sync unavailable (' + getSyncEndpoint() + '). Start local server with `node server.js`.', error);
        syncWarned = true;
      }
    } finally {
      syncInFlight = false;
      if (syncQueuedData) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(flushServerSync, 1500);
      }
    }
  }

  function queueServerSyncFallback(data) {
    if (!canUseServerSync()) return;
    syncQueuedData = data;
    clearTimeout(syncTimer);
    setSyncStatus('syncing', '回退同步中', { source: 'server-sync', reason: 'native_fallback' });
    syncTimer = setTimeout(flushServerSync, 80);
  }

  function scheduleServerSync(data, mirrorDeltaHint = null) {
    if (hasNativeSyncBridge()) {
      clearTimeout(nativeSyncTimer);
      nativeSyncQueuedData = data;
      nativeSyncQueuedHint = mergeMirrorDeltaHints(nativeSyncQueuedHint, mirrorDeltaHint);
      setSyncStatus('syncing', '等待同步', { source: 'native-sync', reason: 'queued' });
      nativeSyncTimer = setTimeout(function () {
        if (nativeSyncInFlight) {
          nativeSyncTimer = setTimeout(flushNativeSyncQueue, 120);
          return;
        }
        flushNativeSyncQueue();
      }, NATIVE_SYNC_DEBOUNCE_MS);
      return;
    }
    if (!canUseServerSync()) return;
    syncQueuedData = data;
    clearTimeout(syncTimer);
    setSyncStatus('syncing', '等待同步', { source: 'server-sync', reason: 'queued' });
    syncTimer = setTimeout(flushServerSync, SERVER_SYNC_DEBOUNCE_MS);
  }

  function saveData(data, options = {}) {
    const normalized = ensureNormalizedDataSnapshot(data);
    const mirrorDeltaHint = normalizeMirrorDeltaHint(options);
    const immediatePersist = options && options.immediatePersist === true;
    const runtime = getSyncRuntimeModules();
    if (runtime && typeof runtime.recordPendingSyncMutation === 'function') {
      runtime.recordPendingSyncMutation(normalized, options);
    } else {
      recordPendingSyncMutation(normalized, options);
    }
    scheduleLocalCacheWrite(normalized, { immediate: immediatePersist });
    if (options.skipAuthoritativeSync === true) return;
    if (shouldDeferAuthoritativePersist()) {
      setSyncStatus('syncing', '启动数据补水中，暂缓写入权威目录', {
        source: 'startup-hydration',
        reason: 'authoritative_persist_deferred',
      });
      scheduleDeferredAuthoritativePersist(normalized, 1200, mirrorDeltaHint);
      return;
    }
    deferredAuthoritativePersistData = null;
    deferredAuthoritativePersistHint = null;
    clearDeferredAuthoritativePersistTimer();
    scheduleWebSyncRootSnapshot(normalized, mirrorDeltaHint);
    scheduleServerSync(normalized, mirrorDeltaHint);
    if (!immediatePersist) return;
    try {
      void flushWebSyncRootSnapshot();
    } catch (_) {}
    if (hasNativeSyncBridge()) {
      try {
        flushNativeSyncQueue();
      } catch (_) {}
      return;
    }
    try {
      void flushServerSync();
    } catch (_) {}
  }

  function getTheme() {
    const saved = String(localStorage.getItem(STORAGE_KEYS.theme) || '').trim();
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  }

  function notifySyncedUserPreferencesChanged(scope = '') {
    if (typeof window === 'undefined') return;
    const fn = (
      (typeof window.MorphSyncStableUserPreferencesSoon === 'function' && window.MorphSyncStableUserPreferencesSoon)
      || (typeof window.LianXingSyncStableUserPreferencesSoon === 'function' && window.LianXingSyncStableUserPreferencesSoon)
      || null
    );
    if (typeof fn !== 'function') return;
    try { fn(String(scope || 'settings')); } catch (_) {}
  }

  function setTheme(theme) {
    const normalized = theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';
    localStorage.setItem(STORAGE_KEYS.theme, normalized);
    notifySyncedUserPreferencesChanged('theme');
  }

  function getApiKey() {
    return localStorage.getItem(STORAGE_KEYS.apiKey) || '';
  }

  function syncAIConfigToNative() {
    if (!hasNativeControlBridge()) return;
    callNativeDesktopControl('saveAIConfig', {
      provider: getAIProvider(),
      geminiApiKey: getApiKey(),
      openRouterApiKey: getOpenRouterApiKey(),
      glmApiKey: getGLMApiKey(),
      doubaoApiKey: getDoubaoApiKey(),
      qwenApiKey: getQwenApiKey(),
      kimiApiKey: getKimiApiKey(),
      codexApiKey: getCodexApiKey(),
      codexBaseUrl: getCodexBaseUrl(),
      codexModel: getCodexModel(),
    }).catch(() => {});
  }

  function syncAIConfigToFeishuBot() {
    if (typeof fetch !== 'function') return;
    const provider = getAIProvider();
    fetch('/api/feishu/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey: getCurrentAIKey(),
        baseUrl: provider === 'codex' ? getCodexBaseUrl() : '',
        model: provider === 'codex' ? getCodexModel() : '',
      }),
    }).catch(() => {});
  }

  function normalizeCodexBaseUrl(value) {
    let text = String(value || '').trim();
    if (!text) return '';
    if (!/^https?:\/\//i.test(text)) text = `http://${text}`;
    text = text.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(text)) return text;
    if (/\/v1$/i.test(text)) return `${text}/chat/completions`;
    return `${text}/v1/chat/completions`;
  }

  function setApiKey(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_KEYS.apiKey, trimmed);
    else localStorage.removeItem(STORAGE_KEYS.apiKey);
    syncAIConfigToNative();
    syncAIConfigToFeishuBot();
  }

  function getOpenRouterApiKey() {
    return localStorage.getItem(STORAGE_KEYS.openRouterApiKey) || '';
  }

  function setOpenRouterApiKey(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_KEYS.openRouterApiKey, trimmed);
    else localStorage.removeItem(STORAGE_KEYS.openRouterApiKey);
    syncAIConfigToNative();
    syncAIConfigToFeishuBot();
  }

  function getGLMApiKey() {
    return localStorage.getItem(STORAGE_KEYS.glmApiKey) || '';
  }

  function setGLMApiKey(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_KEYS.glmApiKey, trimmed);
    else localStorage.removeItem(STORAGE_KEYS.glmApiKey);
    syncAIConfigToNative();
    syncAIConfigToFeishuBot();
  }

  function getDoubaoApiKey() {
    return localStorage.getItem(STORAGE_KEYS.doubaoApiKey) || '';
  }

  function setDoubaoApiKey(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_KEYS.doubaoApiKey, trimmed);
    else localStorage.removeItem(STORAGE_KEYS.doubaoApiKey);
    syncAIConfigToNative();
    syncAIConfigToFeishuBot();
  }

  function getQwenApiKey() {
    return localStorage.getItem(STORAGE_KEYS.qwenApiKey) || '';
  }

  function setQwenApiKey(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_KEYS.qwenApiKey, trimmed);
    else localStorage.removeItem(STORAGE_KEYS.qwenApiKey);
    syncAIConfigToNative();
    syncAIConfigToFeishuBot();
  }

  function getKimiApiKey() {
    return localStorage.getItem(STORAGE_KEYS.kimiApiKey) || '';
  }

  function setKimiApiKey(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_KEYS.kimiApiKey, trimmed);
    else localStorage.removeItem(STORAGE_KEYS.kimiApiKey);
    syncAIConfigToNative();
    syncAIConfigToFeishuBot();
  }

  function getCodexApiKey() {
    return localStorage.getItem(STORAGE_KEYS.codexApiKey) || '';
  }

  function setCodexApiKey(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_KEYS.codexApiKey, trimmed);
    else localStorage.removeItem(STORAGE_KEYS.codexApiKey);
    syncAIConfigToNative();
    syncAIConfigToFeishuBot();
  }

  function getCodexBaseUrl() {
    return normalizeCodexBaseUrl(localStorage.getItem(STORAGE_KEYS.codexBaseUrl) || '');
  }

  function setCodexBaseUrl(value) {
    const normalized = normalizeCodexBaseUrl(value);
    if (normalized) localStorage.setItem(STORAGE_KEYS.codexBaseUrl, normalized);
    else localStorage.removeItem(STORAGE_KEYS.codexBaseUrl);
    syncAIConfigToNative();
    syncAIConfigToFeishuBot();
  }

  function getCodexModel() {
    return String(localStorage.getItem(STORAGE_KEYS.codexModel) || '').trim();
  }

  function setCodexModel(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_KEYS.codexModel, trimmed);
    else localStorage.removeItem(STORAGE_KEYS.codexModel);
    syncAIConfigToNative();
    syncAIConfigToFeishuBot();
  }

  function getAIProvider() {
    const raw = localStorage.getItem(STORAGE_KEYS.aiProvider) || 'gemini';
    return raw === 'openrouter' || raw === 'glm' || raw === 'doubao' || raw === 'qwen' || raw === 'kimi' || raw === 'codex' ? raw : 'gemini';
  }

  function setAIProvider(provider) {
    const normalized = provider === 'openrouter' || provider === 'glm' || provider === 'doubao' || provider === 'qwen' || provider === 'kimi' || provider === 'codex' ? provider : 'gemini';
    localStorage.setItem(STORAGE_KEYS.aiProvider, normalized);
    syncAIConfigToNative();
    syncAIConfigToFeishuBot();
    notifySyncedUserPreferencesChanged('ai-provider');
  }

  function getCurrentAIKey() {
    const provider = getAIProvider();
    if (provider === 'openrouter') return getOpenRouterApiKey();
    if (provider === 'glm') return getGLMApiKey();
    if (provider === 'doubao') return getDoubaoApiKey();
    if (provider === 'qwen') return getQwenApiKey();
    if (provider === 'kimi') return getKimiApiKey();
    if (provider === 'codex') return getCodexApiKey() || 'anti-api-local';
    return getApiKey();
  }

  function getTTSProvider() {
    return 'none';
  }

  function setTTSProvider(provider) {
    localStorage.setItem(STORAGE_KEYS.ttsProvider, provider === 'none' ? 'none' : 'cosyvoice');
    notifySyncedUserPreferencesChanged('tts-provider');
  }

  function getCosyVoiceEndpoint() {
    return '';
  }

  function setCosyVoiceEndpoint(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_KEYS.cosyVoiceEndpoint, trimmed);
    else localStorage.removeItem(STORAGE_KEYS.cosyVoiceEndpoint);
  }

  function getCosyVoiceSpeaker() {
    return localStorage.getItem(STORAGE_KEYS.cosyVoiceSpeaker) || '';
  }

  function setCosyVoiceSpeaker(value) {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_KEYS.cosyVoiceSpeaker, trimmed);
    else localStorage.removeItem(STORAGE_KEYS.cosyVoiceSpeaker);
  }

  function getAIAutoSpeak() {
    return false;
  }

  function setAIAutoSpeak(value) {
    localStorage.setItem(STORAGE_KEYS.aiAutoSpeak, value === false ? '0' : '1');
    notifySyncedUserPreferencesChanged('ai-auto-speak');
  }

  function getDailyAlignEnabled() {
    return localStorage.getItem(STORAGE_KEYS.dailyAlignEnabled) === '1';
  }

  function setDailyAlignEnabled(value) {
    localStorage.setItem(STORAGE_KEYS.dailyAlignEnabled, value ? '1' : '0');
    notifySyncedUserPreferencesChanged('daily-align-enabled');
  }

  function normalizeDailyAlignTime(value) {
    const raw = String(value || '').trim();
    const matched = raw.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!matched) return '08:00';
    const hour = Math.max(0, Math.min(23, Number(matched[1])));
    const minute = Math.max(0, Math.min(59, Number(matched[2])));
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function getDailyAlignTime() {
    return normalizeDailyAlignTime(localStorage.getItem(STORAGE_KEYS.dailyAlignTime) || '08:00');
  }

  function setDailyAlignTime(value) {
    localStorage.setItem(STORAGE_KEYS.dailyAlignTime, normalizeDailyAlignTime(value));
    notifySyncedUserPreferencesChanged('daily-align-time');
  }

  function getDailyAlignPrompt() {
    return localStorage.getItem(STORAGE_KEYS.dailyAlignPrompt)
      || '请和我对齐今天任务：结合我的日志、项目、节律与待办，给出今天最重要的3件事、建议时间块，以及第一步马上做什么。';
  }

  function setDailyAlignPrompt(value) {
    const text = String(value || '').trim();
    if (text) localStorage.setItem(STORAGE_KEYS.dailyAlignPrompt, text);
    else localStorage.removeItem(STORAGE_KEYS.dailyAlignPrompt);
    notifySyncedUserPreferencesChanged('daily-align-prompt');
  }

  function getDailyAlignLastRunDate() {
    return localStorage.getItem(STORAGE_KEYS.dailyAlignLastRunDate) || '';
  }

  function setDailyAlignLastRunDate(value) {
    const text = String(value || '').trim();
    if (text) localStorage.setItem(STORAGE_KEYS.dailyAlignLastRunDate, text);
    else localStorage.removeItem(STORAGE_KEYS.dailyAlignLastRunDate);
  }

  function buildDataExportPayload(data) {
    return {
      exportedAt: new Date().toISOString(),
      app: 'Morpheus',
      version: 1,
      source: 'manual-export',
      storageTopology: getSingleSourceOfTruthDescriptor(),
      data: normalizeData(data),
    };
  }

  function sanitizeExtensionStorageKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getExtensionDataRelativePaths(extensionId, options = {}) {
    const key = sanitizeExtensionStorageKey(extensionId);
    if (!key) return null;
    const stateFileName = sanitizeExtensionStorageKey(options.stateFileName || 'state') || 'state';
    const historyFileName = sanitizeExtensionStorageKey(options.historyFileName || 'events') || 'events';
    const cacheFileName = sanitizeExtensionStorageKey(options.cacheFileName || 'cache') || 'cache';
    const baseDir = `data/plugins/${key}`;
    const eventsFile = `${baseDir}/${historyFileName}.ndjson`;
    return {
      extensionId: key,
      baseDir,
      stateFile: `${baseDir}/${stateFileName}.json`,
      eventsFile,
      historyFile: eventsFile,
      cacheFile: `${baseDir}/${cacheFileName}.json`,
      attachmentsDir: `${baseDir}/attachments`,
    };
  }

  async function getExtensionDataRootDescriptor(extensionId, options = {}) {
    const relative = getExtensionDataRelativePaths(extensionId, options);
    if (!relative) return null;
    let syncRootPath = '';
    let pathPrefix = '';
    if (hasNativeControlBridge()) {
      try {
        const res = await callNativeDesktopControl('getSyncRoot');
        syncRootPath = String(res?.path || '').trim();
      } catch (_) {}
    }
    if (!syncRootPath) {
      const webMeta = getWebSyncRootMeta();
      syncRootPath = String(webMeta?.pathLabel || '').trim();
      pathPrefix = normalizeWebSyncRelativePath(webMeta?.pathPrefix || '');
    }
    const joinAbs = (segment) => {
      if (!syncRootPath) return '';
      const base = syncRootPath.replace(/\/+$/g, '');
      const prefixed = pathPrefix ? `${pathPrefix}/${segment}` : segment;
      return `${base}/${prefixed}`;
    };
    return {
      ...relative,
      syncRootPath,
      absoluteBaseDir: joinAbs(relative.baseDir),
      absoluteStateFile: joinAbs(relative.stateFile),
      absoluteEventsFile: joinAbs(relative.eventsFile),
      absoluteHistoryFile: joinAbs(relative.historyFile),
      absoluteCacheFile: joinAbs(relative.cacheFile),
      absoluteAttachmentsDir: joinAbs(relative.attachmentsDir),
    };
  }

  function resolveExtensionDataRelativePath(extensionId, options = {}) {
    const descriptor = getExtensionDataRelativePaths(extensionId, options);
    if (!descriptor) return '';
    const rawRelativePath = String(options.relativePath || '').trim().replace(/\\/g, '/');
    if (rawRelativePath) {
      const normalized = rawRelativePath.replace(/^\/+/g, '').split('/').filter(Boolean).join('/');
      return normalized;
    }
    const slot = String(options.slot || '').trim().toLowerCase();
    if (slot === 'state') return descriptor.stateFile;
    if (slot === 'events') return descriptor.eventsFile;
    if (slot === 'history') return descriptor.historyFile;
    if (slot === 'cache') return descriptor.cacheFile;
    if (slot === 'attachments') return descriptor.attachmentsDir;
    return descriptor.stateFile;
  }

  async function readExtensionDataFile(extensionId, options = {}) {
    const relativePath = resolveExtensionDataRelativePath(extensionId, options);
    if (!relativePath) throw new Error('extension_relative_path_required');
    if (hasNativeControlBridge()) {
      return callNativeDesktopControl('readExtensionDataFile', { relativePath });
    }
    const text = await readTextFromWebSyncRoot(relativePath);
    return {
      ok: true,
      relativePath,
      text: String(text || ''),
      source: 'browser-sync-root',
    };
  }

  async function writeExtensionDataFile(extensionId, text, options = {}) {
    const relativePath = resolveExtensionDataRelativePath(extensionId, options);
    if (!relativePath) throw new Error('extension_relative_path_required');
    if (hasNativeControlBridge()) {
      return callNativeDesktopControl('writeExtensionDataFile', {
        relativePath,
        text: String(text ?? ''),
        createDirectories: options.createDirectories !== false,
      });
    }
    return writeTextToWebSyncRoot(relativePath, String(text ?? ''));
  }

  async function appendExtensionDataFile(extensionId, text, options = {}) {
    const relativePath = resolveExtensionDataRelativePath(extensionId, options);
    if (!relativePath) throw new Error('extension_relative_path_required');
    if (hasNativeControlBridge()) {
      return callNativeDesktopControl('appendExtensionDataFile', {
        relativePath,
        text: String(text ?? ''),
        createDirectories: options.createDirectories !== false,
      });
    }
    return appendTextToWebSyncRoot(relativePath, String(text ?? ''));
  }

  async function readExtensionDataLines(extensionId, options = {}) {
    const payload = await readExtensionDataFile(extensionId, options);
    const text = String(payload?.text || '');
    const lines = text
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter(Boolean);
    return {
      ...payload,
      lines,
    };
  }

  async function readExtensionHistoryRecords(extensionId, options = {}) {
    const payload = await readExtensionDataLines(extensionId, {
      slot: 'history',
      ...options,
    });
    const parseRecord = typeof options.parseRecord === 'function'
      ? options.parseRecord
      : (line) => JSON.parse(line);
    const records = payload.lines
      .map((line, index) => {
        try {
          return parseRecord(line, index);
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);
    return {
      ...payload,
      records,
    };
  }

  async function readExtensionDataJson(extensionId, options = {}) {
    const payload = await readExtensionDataFile(extensionId, options);
    const text = String(payload?.text || '').trim();
    return {
      ...payload,
      value: text ? JSON.parse(text) : null,
    };
  }

  async function writeExtensionDataJson(extensionId, value, options = {}) {
    const text = `${JSON.stringify(value ?? null, null, 2)}\n`;
    return writeExtensionDataFile(extensionId, text, options);
  }

  async function appendExtensionHistoryRecord(extensionId, record, options = {}) {
    const text = `${JSON.stringify(record ?? null)}\n`;
    return appendExtensionDataFile(extensionId, text, {
      slot: 'history',
      ...options,
    });
  }

  async function rebuildExtensionStateFromHistory(extensionId, options = {}) {
    const history = await readExtensionHistoryRecords(extensionId, options);
    const buildState = typeof options.buildState === 'function'
      ? options.buildState
      : ((records) => ({ records }));
    return {
      ...history,
      value: buildState(history.records),
    };
  }

  async function restoreExtensionStateFromHistory(extensionId, options = {}) {
    const rebuilt = await rebuildExtensionStateFromHistory(extensionId, options);
    if (rebuilt?.value !== undefined) {
      await writeExtensionDataJson(extensionId, rebuilt.value, {
        slot: 'state',
        ...options,
      });
    }
    return rebuilt;
  }

  async function migrateExtensionDataFiles(extensionId, options = {}) {
    const migrations = Array.isArray(options.migrations) ? options.migrations : [];
    const results = [];
    for (const item of migrations) {
      const from = String(item?.from || '').trim();
      const to = String(item?.to || '').trim();
      if (!from || !to) continue;
      try {
        const payload = await readExtensionDataFile(extensionId, { relativePath: from });
        const text = String(payload?.text || '');
        if (!text.trim()) {
          results.push({ from, to, migrated: false, reason: 'empty' });
          continue;
        }
        await writeExtensionDataFile(extensionId, text, { relativePath: to });
        results.push({ from, to, migrated: true });
      } catch (error) {
        results.push({ from, to, migrated: false, reason: String(error?.message || 'migrate_failed') });
      }
    }
    return { extensionId, results };
  }

  function exportDataToFile(data) {
    const payload = buildDataExportPayload(data);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const date = new Date();
    const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `morpheus-user-data-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  async function importDataFromFile(file) {
    if (!file) throw new Error('未选择文件');
    const text = await file.text();
    const parsed = JSON.parse(text);
    const payload = parsed && typeof parsed === 'object' ? parsed : null;
    const sourceData = payload && payload.data ? payload.data : payload;
    return normalizeData(sourceData);
  }

  const morphStorageApi = {
    STORAGE_KEYS,
    getSingleSourceOfTruthDescriptor,
    getStartupStorageDescriptor,
    defaultData: cloneDefaultData,
    attachFlashThoughtsAlias,
    serializeDataForPersistence,
    readLocalEditorHistoryState,
    buildEmptyMorphDataSnapshot,
    mergePersistedEditorHistoryIntoData(target) {
      const primary = extractEditorHistoryStateFromData(target);
      const merged = mergeEditorHistoryState(primary, readLocalEditorHistoryState());
      return applyEditorHistoryStateToData(target, merged);
    },
    writeLocalCacheSnapshot(data) {
      pendingLocalCacheWrite = ensureNormalizedDataSnapshot(data);
      flushLocalCacheWriteNow();
    },
    flushDeferredAuthoritativePersist,
    flushLocalCacheWriteNow,
    writeLocalDataCacheReplica,
    writeLocalCacheReplicas,
    sanitizeEditorHistorySnapshot,
    buildEditorHistorySignature,
    buildStartupSnapshotData,
    writeStartupSnapshotData,
    loadStartupSnapshotData,
    loadAuthoritativeStartupDataDescriptor,
    loadAuthoritativeStartupData,
    releaseAuthoritativeStartupData,
    readBootstrapCacheEntry,
    readBootstrapCacheData,
    loadData,
    saveData,
    scheduleServerSync,
    getTheme,
    setTheme,
    getApiKey,
    setApiKey,
    getOpenRouterApiKey,
    setOpenRouterApiKey,
    getGLMApiKey,
    setGLMApiKey,
    getDoubaoApiKey,
    setDoubaoApiKey,
    getQwenApiKey,
    setQwenApiKey,
    getKimiApiKey,
    setKimiApiKey,
    getCodexApiKey,
    setCodexApiKey,
    getCodexBaseUrl,
    setCodexBaseUrl,
    getCodexModel,
    setCodexModel,
    normalizeCodexBaseUrl,
    getAIProvider,
    setAIProvider,
    getCurrentAIKey,
    getTTSProvider,
    setTTSProvider,
    getCosyVoiceEndpoint,
    setCosyVoiceEndpoint,
    getCosyVoiceSpeaker,
    setCosyVoiceSpeaker,
    getAIAutoSpeak,
    setAIAutoSpeak,
    getDailyAlignEnabled,
    setDailyAlignEnabled,
    getDailyAlignTime,
    setDailyAlignTime,
    getDailyAlignPrompt,
    setDailyAlignPrompt,
    getDailyAlignLastRunDate,
    setDailyAlignLastRunDate,
    getSyncDeviceId,
    getSyncMutationState,
    acknowledgeSyncMutationsThroughRevision,
    acknowledgeSyncMutationsByIds,
    getLastAckRevision,
    readLastSyncReceipt,
    writeLastSyncReceipt,
    getPendingSyncMutations,
    getLastSyncAt,
    getLastRestoreAt,
    setLastRestoreAt,
    exportDataToFile,
    importDataFromFile,
    canUseWebDirectoryPicker,
    canUseWebDirectoryUploadFallback,
    getWebSyncRootMeta,
    chooseWebSyncRoot,
    inspectLiveDataFromWebSyncRoot,
    readLiveDataFromWebSyncRoot,
    reloadDataFromWebSyncRoot,
    getExtensionDataRelativePaths,
    getExtensionDataRootDescriptor,
    resolveExtensionDataRelativePath,
    readExtensionDataFile,
    readExtensionDataLines,
    readExtensionHistoryRecords,
    readExtensionDataJson,
    writeExtensionDataFile,
    writeExtensionDataJson,
    appendExtensionDataFile,
    appendExtensionHistoryRecord,
    rebuildExtensionStateFromHistory,
    restoreExtensionStateFromHistory,
    migrateExtensionDataFiles,
    sanitizePluginData,
    hasNativeControlBridge,
    callNativeDesktopControl,
  };
  window.MorphStorage = morphStorageApi;
  window.LianXingStorage = morphStorageApi;

  if (typeof window !== 'undefined') {
    const morphNativeSyncAck = function (ok, message) {
      if (ok) {
        const runtime = getSyncRuntimeModules();
        const inFlightData = nativeSyncInFlightData && typeof nativeSyncInFlightData === 'object'
          ? nativeSyncInFlightData
          : null;
        const syncedRevision = Number(inFlightData?.syncMeta?.revision || 0);
        const ackResult = syncedRevision > 0
          ? (runtime && typeof runtime.acknowledgeSyncMutationsThroughRevision === 'function'
            ? runtime.acknowledgeSyncMutationsThroughRevision(syncedRevision)
            : acknowledgeSyncMutationsThroughRevision(syncedRevision))
          : (runtime && typeof runtime.getSyncMutationState === 'function'
            ? runtime.getSyncMutationState()
            : getSyncMutationState());
        const currentState = runtime && typeof runtime.getSyncMutationState === 'function'
          ? runtime.getSyncMutationState()
          : getSyncMutationState();
        writeLastSyncReceipt({
          updatedAt: new Date().toISOString(),
          status: 'acked',
          source: 'native-sync',
          reason: 'authoritative_write',
          message: '已同步',
          ackedRevision: Number(ackResult?.ackedRevision || getLastAckRevision() || 0),
          pendingCount: Number(currentState?.pendingCount || 0),
          pendingDomains: Array.isArray(currentState?.pendingDomains) ? currentState.pendingDomains : [],
          mergedDomains: Array.isArray(ackResult?.ackedDomains) ? ackResult.ackedDomains : [],
          domainStates: ackResult?.domainStates && typeof ackResult.domainStates === 'object'
            ? ackResult.domainStates
            : currentState?.domainStates,
          entityStates: ackResult?.entityStates && typeof ackResult.entityStates === 'object'
            ? ackResult.entityStates
            : currentState?.entityStates,
        });
        nativeSyncWarned = false;
        const queuedRevision = Number(nativeSyncQueuedData?.syncMeta?.revision || 0);
        if (queuedRevision <= 0 || queuedRevision <= syncedRevision) {
          nativeSyncQueuedData = null;
          nativeSyncQueuedHint = null;
        }
        nativeSyncInFlight = false;
        nativeSyncInFlightData = null;
        nativeSyncInFlightHint = null;
        setLastSyncAt(new Date().toISOString());
        setSyncStatus('ok', '已同步');
        if (nativeSyncQueuedData) {
          clearTimeout(nativeSyncTimer);
          nativeSyncTimer = setTimeout(flushNativeSyncQueue, 60);
        }
      } else {
        const fallbackPayload = nativeSyncInFlightData || nativeSyncQueuedData || loadData();
        nativeSyncInFlight = false;
        nativeSyncInFlightData = null;
        nativeSyncInFlightHint = null;
        nativeSyncQueuedData = null;
        nativeSyncQueuedHint = null;
        queueServerSyncFallback(fallbackPayload);
        if (!nativeSyncWarned) {
          console.warn('[MorphStorage] Native sync failed, switched to HTTP fallback.', message || '同步失败');
          nativeSyncWarned = true;
        }
      }
    };
    const morphNativeControlAck = function (id, ok, payload, message) {
      const pending = nativeControlPending.get(id);
      if (!pending) return;
      nativeControlPending.delete(id);
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
      if (ok) pending.resolve(payload || {});
      else pending.reject(new Error(message || 'native_control_failed'));
    };
    const morphNativeControlProgress = function (id, payload) {
      const pending = nativeControlPending.get(id);
      if (!pending) return;
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
      pending.timeoutId = typeof pending.scheduleTimeout === 'function'
        ? pending.scheduleTimeout()
        : setTimeout(() => {
          const current = nativeControlPending.get(id);
          if (!current) return;
          nativeControlPending.delete(id);
          current.reject(new Error('native_control_timeout'));
        }, Number(pending.timeoutMs) || NATIVE_CONTROL_TIMEOUT_MS);
      if (typeof pending.onProgress === 'function') {
        try { pending.onProgress(payload || {}); } catch (_) {}
      }
    };
    window.MorphNativeSyncAck = morphNativeSyncAck;
    window.LianXingNativeSyncAck = morphNativeSyncAck;
    window.MorphNativeControlAck = morphNativeControlAck;
    window.LianXingNativeControlAck = morphNativeControlAck;
    window.MorphNativeControlProgress = morphNativeControlProgress;
    window.LianXingNativeControlProgress = morphNativeControlProgress;
    window.addEventListener('DOMContentLoaded', function () {
      setSyncStatus('idle', '等待同步');
      syncAIConfigToNative();
      syncAIConfigToFeishuBot();
    });
  }
})();
