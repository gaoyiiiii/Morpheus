// @ts-check
(function initMorphAppBootstrapRuntime() {
  function createAppBootstrapRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    let fallbackRootState = { bootstrapState: null };
    let cachedAuthoritativeStartupDescriptor = null;
    let startupSkeletonForceTimer = null;
    let startupSkeletonRescueTimer = null;
    let startupLucideRefreshTimers = [];
    let startupLucideObserver = null;
    let startupLucideObserverStopTimer = null;
    let bootOnlyWatchersInstalled = false;
    const startupStylesReadyDeadlineAt = Date.now() + 8000;

    function scheduleTimeout(callback, delay) {
      if (typeof api.setTimeout === 'function') return api.setTimeout(callback, delay);
      return setTimeout(callback, delay);
    }

    function cancelTimeout(timerId) {
      if (typeof api.clearTimeout === 'function') {
        api.clearTimeout(timerId);
        return;
      }
      clearTimeout(timerId);
    }

    function buildDefaultBootstrapState() {
      const waitMs = Math.max(0, Number(api.desktopBootstrapWaitMs) || 4500);
      const readyDelayMs = Math.max(0, Number(api.startupSkeletonReadyDelayMs) || 1200);
      return {
        startupSkeletonDismissed: false,
        startupSkeletonReadyAt: Date.now() + readyDelayMs,
        startupHydrationSettled: true,
        startupHydrationHoldDeadlineAt: 0,
        desktopBootstrapWaitDeadlineAt: Date.now() + waitMs,
        browserSyncRootStartupBootstrapPending: false,
        browserSyncRootStartupBootstrapSettled: false,
        morphBootUsedStartupSnapshot: false,
        bootLoadedFromStartupSnapshot: false,
        startupHydrationScheduled: false,
      };
    }

    function getRootState() {
      const currentWindow = getCurrentWindow();
      if (currentWindow
        && currentWindow.__MorphAppStateRuntimeState
        && typeof currentWindow.__MorphAppStateRuntimeState === 'object') {
        return currentWindow.__MorphAppStateRuntimeState;
      }
      if (typeof window !== 'undefined'
        && window.__MorphAppStateRuntimeState
        && typeof window.__MorphAppStateRuntimeState === 'object') {
        return window.__MorphAppStateRuntimeState;
      }
      return fallbackRootState;
    }

    function ensureBootstrapState() {
      const root = getRootState();
      if (!root.bootstrapState || typeof root.bootstrapState !== 'object') {
        root.bootstrapState = buildDefaultBootstrapState();
      }
      const state = root.bootstrapState;
      const defaults = buildDefaultBootstrapState();
      Object.keys(defaults).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(state, key)) {
          state[key] = defaults[key];
        }
      });
      return state;
    }

    function hasAnyUserData(snapshot = null) {
      if (typeof api.hasAnyUserData === 'function') return api.hasAnyUserData(snapshot);
      return false;
    }

    function canTrustPersistedNativeDataSnapshot(snapshot = null) {
      if (typeof api.canTrustPersistedNativeDataSnapshot === 'function') {
        return api.canTrustPersistedNativeDataSnapshot(snapshot);
      }
      return false;
    }

    function buildEmptySnapshot() {
      return typeof api.buildEmptyMorphDataSnapshot === 'function'
        ? api.buildEmptyMorphDataSnapshot()
        : {};
    }

    function getCurrentWindow() {
      return api.window || (typeof window !== 'undefined' ? window : null);
    }

    function getCurrentSessionStorage() {
      const currentWindow = getCurrentWindow();
      if (currentWindow && currentWindow.sessionStorage) return currentWindow.sessionStorage;
      return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    }

    function readAuthoritativeStartupDataSnapshot() {
      const descriptor = readAuthoritativeStartupDataDescriptor();
      return descriptor && descriptor.data && typeof descriptor.data === 'object'
        ? descriptor.data
        : null;
    }

    function readAuthoritativeStartupDataDescriptor() {
      if (cachedAuthoritativeStartupDescriptor && typeof cachedAuthoritativeStartupDescriptor === 'object') {
        return cachedAuthoritativeStartupDescriptor;
      }
      try {
        if (api.storage && typeof api.storage.loadAuthoritativeStartupDataDescriptor === 'function') {
          const descriptor = api.storage.loadAuthoritativeStartupDataDescriptor();
          cachedAuthoritativeStartupDescriptor = descriptor && typeof descriptor === 'object'
            ? descriptor
            : { data: null, source: '', bootstrapSource: '', startupDescriptor: null };
          return cachedAuthoritativeStartupDescriptor;
        }
        const data = api.storage && typeof api.storage.loadAuthoritativeStartupData === 'function'
          ? api.storage.loadAuthoritativeStartupData()
          : null;
        cachedAuthoritativeStartupDescriptor = {
          data: data && typeof data === 'object' ? data : null,
          source: data && typeof data === 'object' ? 'unknown' : '',
          bootstrapSource: '',
          startupDescriptor: null,
        };
        return cachedAuthoritativeStartupDescriptor;
      } catch (_) {
        cachedAuthoritativeStartupDescriptor = {
          data: null,
          source: '',
          bootstrapSource: '',
          startupDescriptor: null,
        };
        return cachedAuthoritativeStartupDescriptor;
      }
    }

    function buildReleasedAuthoritativeStartupDescriptor(entry = null) {
      const current = entry && typeof entry === 'object' ? entry : null;
      const source = String(current?.source || '').trim();
      const bootstrapSource = (() => {
        const explicit = String(current?.bootstrapSource || '').trim();
        if (explicit) return explicit;
        if (source === 'bootstrap-cache') return 'server-bootstrap-cache';
        if (source === 'startup-snapshot') return 'startup-snapshot-fallback';
        return 'local-cache-fallback';
      })();
      const startupDescriptor = current?.startupDescriptor && typeof current.startupDescriptor === 'object'
        ? current.startupDescriptor
        : {
          descriptorVersion: 'startup-storage.v1',
          contractVersion: '',
          bootstrapSource,
          migrationState: '',
          storageTopology: null,
          canonicalStore: null,
          authoritativeWritePath: null,
          cacheReplicas: [],
          derivedReplicas: [],
          authoritativeSnapshot: {
            source,
            revision: 0,
            lastWriteAt: '',
            hasUserData: false,
          },
        };
      return {
        data: null,
        source,
        bootstrapSource,
        startupDescriptor,
      };
    }

    function releaseAuthoritativeStartupDataCache() {
      const released = buildReleasedAuthoritativeStartupDescriptor(cachedAuthoritativeStartupDescriptor);
      cachedAuthoritativeStartupDescriptor = released;
      try {
        if (api.storage && typeof api.storage.releaseAuthoritativeStartupData === 'function') {
          api.storage.releaseAuthoritativeStartupData();
        }
      } catch (_) {}
      return released;
    }

    function setCurrentBootDataSnapshot(snapshot = null) {
      const currentWindow = getCurrentWindow();
      if (!currentWindow) return false;
      try {
        currentWindow.__MorphCurrentDataSnapshot = snapshot;
        return true;
      } catch (_) {
        return false;
      }
    }

    function readCurrentBootDataSnapshotAlias() {
      const currentWindow = getCurrentWindow();
      if (!currentWindow) return null;
      try {
        const cached = currentWindow.__MorphCurrentDataSnapshot;
        return cached && typeof cached === 'object' ? cached : null;
      } catch (_) {
        return null;
      }
    }

    function setNativeBootstrapAppliedForSession(applied) {
      const currentSessionStorage = getCurrentSessionStorage();
      if (!currentSessionStorage) return false;
      try {
        if (applied) {
          currentSessionStorage.setItem('__morph_native_bootstrap_done', '1');
        } else {
          currentSessionStorage.removeItem('__morph_native_bootstrap_done');
          currentSessionStorage.removeItem('__lianxing_native_bootstrap_done');
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    function readNativeBootstrapAppliedSessionMarker() {
      const currentSessionStorage = getCurrentSessionStorage();
      if (!currentSessionStorage) return false;
      try {
        return currentSessionStorage.getItem('__morph_native_bootstrap_done') === '1';
      } catch (_) {
        return false;
      }
    }

    function hasNativeBootstrapAppliedForSession() {
      return readNativeBootstrapAppliedSessionMarker();
    }

    function readCurrentBootDataSnapshotForStartupGuard() {
      if (isRunningInNativeIOSShell() && !hasNativeBootstrapAppliedForSession()) {
        return null;
      }
      const cached = readCurrentBootDataSnapshotAlias();
      if (cached) return cached;
      try {
        const persisted = readAuthoritativeStartupDataDescriptor().data;
        return persisted && typeof persisted === 'object' ? persisted : null;
      } catch (_) {
        return null;
      }
    }

    function readDataRevision(snapshot = null) {
      const value = Number(snapshot?.syncMeta?.revision || 0);
      return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function readDataWriteTime(snapshot = null) {
      const raw = String(
        snapshot?.syncMeta?.lastClientWriteAt
        || snapshot?.syncMeta?.lastServerWriteAt
        || snapshot?.syncMeta?.updatedAt
        || ''
      ).trim();
      if (!raw) return 0;
      const value = Date.parse(raw);
      return Number.isFinite(value) ? value : 0;
    }

    function getCurrentData() {
      return typeof api.getData === 'function' ? api.getData() : null;
    }

    function setCurrentData(value) {
      if (typeof api.setData === 'function') api.setData(value);
    }

    function setLocalDataRevision(value) {
      if (typeof api.setLocalDataRevision === 'function') api.setLocalDataRevision(value);
    }

    function isRunningInNativeDesktopShell() {
      return typeof api.isRunningInNativeDesktopShell === 'function'
        ? api.isRunningInNativeDesktopShell()
        : false;
    }

    function isRunningInNativeIOSShell() {
      return typeof api.isRunningInNativeIOSShell === 'function'
        ? api.isRunningInNativeIOSShell()
        : false;
    }

    function areMorphStylesReady() {
      const currentWindow = getCurrentWindow();
      if (!currentWindow) return true;
      return currentWindow.__MorphStylesReady === true || currentWindow.__LianXingStylesReady === true;
    }

    function shouldWaitForNativeBootstrap() {
      const state = ensureBootstrapState();
      const runningInNativeShell = isRunningInNativeDesktopShell() || isRunningInNativeIOSShell();
      if (!runningInNativeShell) return false;
      if (hasNativeBootstrapAppliedForSession()) return false;
      const currentSnapshot = readCurrentBootDataSnapshotForStartupGuard();
      if (canTrustPersistedNativeDataSnapshot(currentSnapshot) || hasAnyUserData(currentSnapshot)) return false;
      return Date.now() < Number(state.desktopBootstrapWaitDeadlineAt || 0);
    }

    function shouldBootstrapSelectedBrowserSyncRootOnStartup() {
      if (isRunningInNativeDesktopShell() || isRunningInNativeIOSShell()) return false;
      try {
        const meta = api.storage && typeof api.storage.getWebSyncRootMeta === 'function'
          ? api.storage.getWebSyncRootMeta()
          : null;
        return !!(meta && meta.readable !== false);
      } catch (_) {
        return false;
      }
    }

    function markBrowserSyncRootBootstrapStarted() {
      const state = ensureBootstrapState();
      state.browserSyncRootStartupBootstrapPending = shouldBootstrapSelectedBrowserSyncRootOnStartup();
      state.browserSyncRootStartupBootstrapSettled = state.browserSyncRootStartupBootstrapPending !== true;
      return state.browserSyncRootStartupBootstrapPending;
    }

    function beginBrowserSyncRootStartupBootstrapIfNeeded() {
      return markBrowserSyncRootBootstrapStarted();
    }

    function markBrowserSyncRootBootstrapSettled() {
      const state = ensureBootstrapState();
      state.browserSyncRootStartupBootstrapPending = false;
      state.browserSyncRootStartupBootstrapSettled = true;
      return true;
    }

    function shouldWaitForBrowserSyncRootStartupBootstrap() {
      const state = ensureBootstrapState();
      return state.browserSyncRootStartupBootstrapPending === true
        && state.browserSyncRootStartupBootstrapSettled !== true;
    }

    function shouldHoldStartupHydrationForSkeleton() {
      const state = ensureBootstrapState();
      const hydrationPending = state.bootLoadedFromStartupSnapshot
        && state.startupHydrationSettled !== true
        && Date.now() < Number(state.startupHydrationHoldDeadlineAt || 0);
      if (!hydrationPending) return false;
      if (!(isRunningInNativeDesktopShell() || isRunningInNativeIOSShell())) return true;
      return !hasMeaningfulCurrentViewContent();
    }

    function shouldKeepStartupBlockersVisible() {
      const state = ensureBootstrapState();
      if (state.startupSkeletonDismissed) return false;
      if (shouldWaitForNativeBootstrap()) return true;
      if (shouldWaitForBrowserSyncRootStartupBootstrap()) return true;
      if (shouldHoldStartupHydrationForSkeleton()) return true;
      return false;
    }

    function releaseStartupBootPayloadCaches() {
      const currentWindow = api.window || (typeof window !== 'undefined' ? window : null);
      const currentDocument = api.document || (typeof document !== 'undefined' ? document : null);
      if (!currentWindow) return;
      try {
        currentWindow.__MORPH_BOOTSTRAP_CACHE = null;
        currentWindow.__CHANNEL_OPS_BOOTSTRAP = null;
      } catch (_) {}
      try {
        const morphNode = currentDocument && typeof currentDocument.getElementById === 'function'
          ? currentDocument.getElementById('morph-bootstrap-cache-data')
          : null;
        if (morphNode) morphNode.textContent = 'null';
        const channelNode = currentDocument && typeof currentDocument.getElementById === 'function'
          ? currentDocument.getElementById('channel-ops-bootstrap-data')
          : null;
        if (channelNode) channelNode.textContent = 'null';
      } catch (_) {}
      if (!ensureBootstrapState().startupHydrationSettled || shouldWaitForNativeBootstrap() || shouldWaitForBrowserSyncRootStartupBootstrap()) return;
      try {
        currentWindow.__MorphCurrentDataSnapshot = null;
      } catch (_) {}
      try {
        releaseAuthoritativeStartupDataCache();
      } catch (_) {}
    }

    function releaseRetainedAuthoritativeStartupPayload(source = '', payload = null) {
      if (!hasAnyUserData(payload)) return false;
      const normalizedSource = String(source || '').trim();
      if (normalizedSource !== 'startup-snapshot' && normalizedSource !== 'bootstrap-cache') return false;
      try {
        releaseAuthoritativeStartupDataCache();
        return true;
      } catch (_) {}
      return false;
    }

    function getLucideCreateIcons() {
      if (typeof api.getLucideCreateIcons === 'function') {
        const resolved = api.getLucideCreateIcons();
        if (typeof resolved === 'function') return resolved;
      }
      const currentWindow = api.window || (typeof window !== 'undefined' ? window : null);
      const globalLucide = currentWindow && currentWindow.lucide && typeof currentWindow.lucide === 'object'
        ? currentWindow.lucide
        : (typeof globalThis !== 'undefined' && globalThis.lucide && typeof globalThis.lucide === 'object'
          ? globalThis.lucide
          : null);
      return globalLucide && typeof globalLucide.createIcons === 'function'
        ? globalLucide.createIcons.bind(globalLucide)
        : null;
    }

    function hasPendingLucideNodes(root = null) {
      if (typeof api.hasPendingLucideNodes === 'function') return api.hasPendingLucideNodes(root);
      const currentDocument = api.document || (typeof document !== 'undefined' ? document : null);
      const scope = root && typeof root === 'object' ? root : currentDocument;
      if (!scope) return false;
      try {
        if (typeof scope.getAttribute === 'function' && scope.getAttribute('data-lucide')) return true;
      } catch (_) {}
      try {
        return typeof scope.querySelector === 'function' && !!scope.querySelector('[data-lucide]');
      } catch (_) {
        return false;
      }
    }

    function requestAnimationFrameSafe(fn) {
      if (typeof api.requestAnimationFrame === 'function') return api.requestAnimationFrame(fn);
      return scheduleTimeout(fn, 16);
    }

    function requestLucideRefresh(options = null) {
      const currentDocument = api.document || (typeof document !== 'undefined' ? document : null);
      const createIcons = getLucideCreateIcons();
      if (!createIcons || !currentDocument) return;
      const root = options && options.root ? options.root : currentDocument;
      requestAnimationFrameSafe(() => {
        try {
          createIcons({ icons: undefined, nameAttr: 'data-lucide', attrs: {}, root });
        } catch (_) {}
      });
    }

    function ensureLucideScriptLoaded() {
      const currentDocument = api.document || (typeof document !== 'undefined' ? document : null);
      const currentWindow = api.window || (typeof window !== 'undefined' ? window : null);
      if (!currentDocument || !currentWindow) return;
      if (getLucideCreateIcons()) {
        currentWindow.dispatchEvent?.(new Event('lucide-ready'));
        return;
      }
      const existing = currentDocument.getElementById('morph-lucide-runtime-script');
      if (existing) return;
      const script = currentDocument.createElement('script');
      script.id = 'morph-lucide-runtime-script';
      script.src = 'https://unpkg.com/lucide@latest';
      script.async = true;
      script.onload = () => {
        try {
          currentWindow.dispatchEvent?.(new Event('lucide-ready'));
        } catch (_) {}
      };
      currentDocument.head?.appendChild(script);
    }

    function clearStartupLucideRefreshTimers() {
      startupLucideRefreshTimers.forEach((timerId) => {
        try {
          cancelTimeout(timerId);
        } catch (_) {}
      });
      startupLucideRefreshTimers = [];
    }

    function scheduleStartupLucideRefreshes() {
      clearStartupLucideRefreshTimers();
      requestLucideRefresh();
      [120, 420, 900, 1600, 2600, 4200, 6200, 8600, 12000].forEach((delay) => {
        const timerId = scheduleTimeout(() => {
          requestLucideRefresh();
        }, delay);
        startupLucideRefreshTimers.push(timerId);
      });
    }

    function installBootOnlyWatchers() {
      const currentWindow = api.window || (typeof window !== 'undefined' ? window : null);
      const currentDocument = api.document || (typeof document !== 'undefined' ? document : null);
      if (!currentWindow || !currentDocument || bootOnlyWatchersInstalled) return;
      bootOnlyWatchersInstalled = true;
      currentWindow.addEventListener('lucide-ready', () => {
        scheduleStartupLucideRefreshes();
        scheduleTimeout(() => requestLucideRefresh(), 2200);
      });
      currentWindow.addEventListener('load', () => {
        ensureLucideScriptLoaded();
        scheduleStartupLucideRefreshes();
        scheduleTimeout(() => requestLucideRefresh(), 320);
      });
      currentDocument.addEventListener('pointerdown', () => {
        if (currentWindow.__MorphAppBootState === 'ready' || currentWindow.__LianXingAppBootState === 'ready') {
          hideStartupBlockers(true);
        }
      }, true);
    }

    function stopStartupLucideObserver() {
      if (startupLucideObserver && typeof startupLucideObserver.disconnect === 'function') {
        startupLucideObserver.disconnect();
      }
      startupLucideObserver = null;
      if (startupLucideObserverStopTimer) {
        clearTimeout(startupLucideObserverStopTimer);
        startupLucideObserverStopTimer = null;
      }
    }

    function startStartupLucideObserver() {
      const MutationObserverCtor = api.MutationObserver || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
      const currentDocument = api.document || (typeof document !== 'undefined' ? document : null);
      if (!MutationObserverCtor || !currentDocument?.body || startupLucideObserver) return;
      startupLucideObserver = new MutationObserverCtor((mutations) => {
        if (!Array.isArray(mutations)) return;
        let shouldRefresh = false;
        for (const mutation of mutations) {
          if (mutation?.type !== 'childList') continue;
          const added = Array.from(mutation.addedNodes || []);
          for (const node of added) {
            if (node && typeof node.querySelector === 'function' && hasPendingLucideNodes(node)) {
              shouldRefresh = true;
              break;
            }
          }
          if (shouldRefresh) break;
        }
        if (shouldRefresh) scheduleStartupLucideRefreshes();
      });
      startupLucideObserver.observe(currentDocument.body, { childList: true, subtree: true });
      startupLucideObserverStopTimer = scheduleTimeout(() => stopStartupLucideObserver(), 12000);
    }

    function hideStartupBlockers(force = false) {
      if (typeof api.hideStartupBlockers === 'function') {
        api.hideStartupBlockers(force);
      }
    }

    function handleStartupBlockerPointerDown() {
      const currentWindow = api.window || (typeof window !== 'undefined' ? window : null);
      if (!currentWindow) return;
      if (currentWindow.__MorphAppBootState === 'ready' || currentWindow.__LianXingAppBootState === 'ready') {
        hideStartupBlockers(true);
      }
    }

    function hasMeaningfulCurrentViewContent() {
      return typeof api.hasMeaningfulCurrentViewContent === 'function'
        ? api.hasMeaningfulCurrentViewContent()
        : true;
    }

    function setMorphAppBootState(state) {
      if (typeof api.setMorphAppBootState === 'function') api.setMorphAppBootState(state);
    }

    function dismissStartupSkeleton(delay = 120) {
      const state = ensureBootstrapState();
      const run = () => {
        if (state.startupSkeletonDismissed) return;
        if (shouldWaitForNativeBootstrap()) {
          scheduleTimeout(run, 120);
          return;
        }
        if (shouldWaitForBrowserSyncRootStartupBootstrap()) {
          scheduleTimeout(run, 120);
          return;
        }
        if (!areMorphStylesReady() && Date.now() < startupStylesReadyDeadlineAt) {
          scheduleTimeout(run, 120);
          return;
        }
        if (shouldHoldStartupHydrationForSkeleton()) {
          scheduleTimeout(run, 120);
          return;
        }
        const wait = Number(state.startupSkeletonReadyAt || 0) - Date.now();
        if (wait > 0) {
          scheduleTimeout(run, wait);
          return;
        }
        state.startupSkeletonDismissed = true;
        if (startupSkeletonForceTimer) {
          cancelTimeout(startupSkeletonForceTimer);
          startupSkeletonForceTimer = null;
        }
        if (startupSkeletonRescueTimer) {
          cancelTimeout(startupSkeletonRescueTimer);
          startupSkeletonRescueTimer = null;
        }
        clearStartupLucideRefreshTimers();
        hideStartupBlockers(true);
        setMorphAppBootState('ready');
        releaseStartupBootPayloadCaches();
        scheduleTimeout(() => releaseStartupBootPayloadCaches(), 1200);
        scheduleStartupLucideRefreshes();
        scheduleTimeout(() => stopStartupLucideObserver(), 4200);
      };
      if (delay > 0) scheduleTimeout(run, delay);
      else run();
    }

    function rescueStartupSkeletonReady() {
      if (ensureBootstrapState().startupSkeletonDismissed) return;
      if (shouldWaitForNativeBootstrap() || shouldWaitForBrowserSyncRootStartupBootstrap() || shouldKeepStartupBlockersVisible()) {
        startupSkeletonRescueTimer = scheduleTimeout(() => rescueStartupSkeletonReady(), 120);
        return;
      }
      if (!areMorphStylesReady() && Date.now() < startupStylesReadyDeadlineAt) {
        startupSkeletonRescueTimer = scheduleTimeout(() => rescueStartupSkeletonReady(), 180);
        return;
      }
      if (shouldHoldStartupHydrationForSkeleton()) {
        startupSkeletonRescueTimer = scheduleTimeout(() => rescueStartupSkeletonReady(), 180);
        return;
      }
      dismissStartupSkeleton(0);
    }

    function parseBootSnapshotRevision(snapshot = null) {
      return readDataRevision(snapshot);
    }

    function parseBootSnapshotWriteTime(snapshot = null) {
      return readDataWriteTime(snapshot);
    }

    function tryLoadPersistedReplicaSnapshot() {
      try {
        if (api.storage && typeof api.storage.loadData === 'function') {
          return api.storage.loadData();
        }
      } catch (_) {}
      return null;
    }

    function sanitizeBootScheduleMvpState(raw = null) {
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
        cardOrder: Array.isArray(source.cardOrder) ? Array.from(new Set(source.cardOrder.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 64) : [],
        cardOrderUpdatedAt: typeof source.cardOrderUpdatedAt === 'string' ? source.cardOrderUpdatedAt : '',
        updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
      };
    }

    function countBootScheduleMvpRecords(state = null) {
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

    function mergeBootScheduleMvpState(preferred = null, supplemental = null) {
      const base = sanitizeBootScheduleMvpState(preferred);
      const extra = sanitizeBootScheduleMvpState(supplemental);
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

    function attachMergedBootScheduleMvp(preferred = null, other = null) {
      if (!preferred || !other || typeof preferred !== 'object' || typeof other !== 'object') return preferred;
      if (countBootScheduleMvpRecords(other.scheduleMvp) <= 0) return preferred;
      const mergedScheduleMvp = mergeBootScheduleMvpState(preferred.scheduleMvp, other.scheduleMvp);
      if (JSON.stringify(mergedScheduleMvp) === JSON.stringify(sanitizeBootScheduleMvpState(preferred.scheduleMvp))) return preferred;
      const next = JSON.parse(JSON.stringify(preferred));
      next.scheduleMvp = mergedScheduleMvp;
      try {
        Object.defineProperty(next, '__morphBootMergedFrom', {
          value: preferred,
          enumerable: false,
          configurable: true,
        });
      } catch (_) {}
      return next;
    }

    function hasPromotableScheduleMvpDelta(nextData = null, currentData = null) {
      const nextScheduleMvp = sanitizeBootScheduleMvpState(nextData?.scheduleMvp);
      if (countBootScheduleMvpRecords(nextScheduleMvp) <= 0) return false;
      const currentScheduleMvp = sanitizeBootScheduleMvpState(currentData?.scheduleMvp);
      return JSON.stringify(nextScheduleMvp) !== JSON.stringify(currentScheduleMvp);
    }

    function pickNativeBootReplicaWhenAuthoritativeEmpty(finalizeBootSelection) {
      const ls = tryLoadPersistedReplicaSnapshot();
      if (!ls || !hasAnyUserData(ls)) return null;
      const state = ensureBootstrapState();
      state.morphBootUsedStartupSnapshot = false;
      state.bootLoadedFromStartupSnapshot = true;
      state.startupHydrationSettled = false;
      state.startupHydrationHoldDeadlineAt = Date.now() + 12000;
      return finalizeBootSelection(ls);
    }

    function choosePreferredBootSnapshot(primary = null, secondary = null, options = {}) {
      const left = primary && typeof primary === 'object' ? primary : null;
      const right = secondary && typeof secondary === 'object' ? secondary : null;
      const leftHasData = hasAnyUserData(left);
      const rightHasData = hasAnyUserData(right);
      if (leftHasData && !rightHasData) return left;
      if (rightHasData && !leftHasData) return right;
      if (!leftHasData && !rightHasData) return left || right || null;
      if (options && options.preferTrusted === true) {
        const leftTrusted = canTrustPersistedNativeDataSnapshot(left);
        const rightTrusted = canTrustPersistedNativeDataSnapshot(right);
        if (leftTrusted && !rightTrusted) return left;
        if (rightTrusted && !leftTrusted) return right;
      }
      const leftRevision = parseBootSnapshotRevision(left);
      const rightRevision = parseBootSnapshotRevision(right);
      if (leftRevision !== rightRevision) {
        const winner = leftRevision > rightRevision ? left : right;
        const loser = winner === left ? right : left;
        return attachMergedBootScheduleMvp(winner, loser);
      }
      const leftWriteAt = parseBootSnapshotWriteTime(left);
      const rightWriteAt = parseBootSnapshotWriteTime(right);
      if (leftWriteAt !== rightWriteAt) {
        const winner = leftWriteAt > rightWriteAt ? left : right;
        const loser = winner === left ? right : left;
        return attachMergedBootScheduleMvp(winner, loser);
      }
      return attachMergedBootScheduleMvp(left || right || null, left ? right : left);
    }

    function loadBestAvailableData() {
      const state = ensureBootstrapState();
      beginBrowserSyncRootStartupBootstrapIfNeeded();
      state.morphBootUsedStartupSnapshot = false;
      const finalizeBootSelection = (snapshot = null) => {
        const selected = snapshot && typeof snapshot === 'object' ? snapshot : buildEmptySnapshot();
        setCurrentBootDataSnapshot(selected);
        return selected;
      };
      const runningInNativeShell = isRunningInNativeDesktopShell() || isRunningInNativeIOSShell();
      const runningInNativeIOSShell = isRunningInNativeIOSShell();
      const descriptor = readAuthoritativeStartupDataDescriptor();
      const authoritativeStartupData = descriptor?.data || null;
      const authoritativeStartupSource = String(descriptor?.source || '').trim();
      const preferredPersistedSnapshot = authoritativeStartupData;
      const applyNativeStartupReplicaState = (snapshot = null) => {
        const hasData = hasAnyUserData(snapshot);
        const usedStartupSnapshot = authoritativeStartupSource === 'startup-snapshot' && hasData;
        const usedStartupReplica = (authoritativeStartupSource === 'startup-snapshot' || authoritativeStartupSource === 'bootstrap-cache') && hasData;
        state.morphBootUsedStartupSnapshot = usedStartupSnapshot;
        state.bootLoadedFromStartupSnapshot = usedStartupReplica === true;
        state.startupHydrationSettled = state.bootLoadedFromStartupSnapshot !== true;
        state.startupHydrationHoldDeadlineAt = state.bootLoadedFromStartupSnapshot ? Date.now() + 12000 : 0;
      };

      if (runningInNativeIOSShell && !hasNativeBootstrapAppliedForSession()) {
        try {
          const currentSessionStorage = getCurrentSessionStorage();
          currentSessionStorage?.removeItem('morph_recovery_snapshot_v1');
        } catch (_) {}
        if (canUsePersistedNativeStartupSnapshot(preferredPersistedSnapshot, authoritativeStartupSource)) {
          applyNativeStartupReplicaState(preferredPersistedSnapshot);
          releaseRetainedAuthoritativeStartupPayload(authoritativeStartupSource, preferredPersistedSnapshot);
          return finalizeBootSelection(preferredPersistedSnapshot);
        }
        const iosReplica = pickNativeBootReplicaWhenAuthoritativeEmpty(finalizeBootSelection);
        if (iosReplica) return iosReplica;
        return finalizeBootSelection(buildEmptySnapshot());
      }

      if (runningInNativeShell) {
        try {
          const currentSessionStorage = getCurrentSessionStorage();
          currentSessionStorage?.removeItem('morph_recovery_snapshot_v1');
        } catch (_) {}
        if (!hasNativeBootstrapAppliedForSession()) {
          if (canUsePersistedNativeStartupSnapshot(preferredPersistedSnapshot, authoritativeStartupSource)) {
            applyNativeStartupReplicaState(preferredPersistedSnapshot);
            releaseRetainedAuthoritativeStartupPayload(authoritativeStartupSource, preferredPersistedSnapshot);
            return finalizeBootSelection(preferredPersistedSnapshot);
          }
          const nativeReplicaA = pickNativeBootReplicaWhenAuthoritativeEmpty(finalizeBootSelection);
          if (nativeReplicaA) return nativeReplicaA;
          return finalizeBootSelection(buildEmptySnapshot());
        }
        if (canUsePersistedNativeStartupSnapshot(preferredPersistedSnapshot, authoritativeStartupSource)) {
          applyNativeStartupReplicaState(preferredPersistedSnapshot);
          releaseRetainedAuthoritativeStartupPayload(authoritativeStartupSource, preferredPersistedSnapshot);
          return finalizeBootSelection(preferredPersistedSnapshot);
        }
        const nativeReplicaB = pickNativeBootReplicaWhenAuthoritativeEmpty(finalizeBootSelection);
        if (nativeReplicaB) return nativeReplicaB;
        return finalizeBootSelection(buildEmptySnapshot());
      }

      if (state.browserSyncRootStartupBootstrapPending) {
        try {
          sessionStorage.removeItem('morph_recovery_snapshot_v1');
        } catch (_) {}
        if (preferredPersistedSnapshot && hasAnyUserData(preferredPersistedSnapshot)) {
          return finalizeBootSelection(preferredPersistedSnapshot);
        }
        return finalizeBootSelection(buildEmptySnapshot());
      }

      const recovery = typeof api.readRecoverySnapshot === 'function' ? api.readRecoverySnapshot() : null;
      const preferredBootSnapshot = choosePreferredBootSnapshot(
        preferredPersistedSnapshot || buildEmptySnapshot(),
        recovery,
        { preferTrusted: true }
      );
      let selectedBootSnapshot = preferredBootSnapshot || preferredPersistedSnapshot || buildEmptySnapshot();
      const selectedBootOrigin = selectedBootSnapshot?.__morphBootMergedFrom || selectedBootSnapshot;
      const selectedBootSource = selectedBootOrigin === recovery
        ? 'recovery'
        : (selectedBootOrigin === preferredPersistedSnapshot
          ? (authoritativeStartupSource || 'authoritative')
          : 'empty');
      if (typeof api.reconcileAIHistoryAfterBootSelection === 'function') {
        selectedBootSnapshot = api.reconcileAIHistoryAfterBootSelection({
          selectedSnapshot: selectedBootSnapshot,
          selectedSource: selectedBootSource,
          authoritativeSnapshot: preferredPersistedSnapshot,
          authoritativeSource: authoritativeStartupSource,
          recoverySnapshot: recovery,
        }) || selectedBootSnapshot;
      }
      if (typeof api.reconcileStableMemoryAfterBootSelection === 'function') {
        selectedBootSnapshot = api.reconcileStableMemoryAfterBootSelection({
          selectedSnapshot: selectedBootSnapshot,
          selectedSource: selectedBootSource,
          authoritativeSnapshot: preferredPersistedSnapshot,
          authoritativeSource: authoritativeStartupSource,
          recoverySnapshot: recovery,
        }) || selectedBootSnapshot;
      }
      const selectedFromAuthoritativeStartup = selectedBootOrigin === preferredPersistedSnapshot && hasAnyUserData(preferredPersistedSnapshot);
      state.morphBootUsedStartupSnapshot = selectedFromAuthoritativeStartup && authoritativeStartupSource === 'startup-snapshot';
      state.bootLoadedFromStartupSnapshot = selectedFromAuthoritativeStartup
        && (authoritativeStartupSource === 'startup-snapshot' || authoritativeStartupSource === 'bootstrap-cache');
      state.startupHydrationSettled = state.bootLoadedFromStartupSnapshot !== true;
      state.startupHydrationHoldDeadlineAt = state.bootLoadedFromStartupSnapshot ? Date.now() + 12000 : 0;
      releaseRetainedAuthoritativeStartupPayload(authoritativeStartupSource, preferredPersistedSnapshot);
      return finalizeBootSelection(selectedBootSnapshot);
    }

    function hasLongTermMemory(snapshot = null) {
      const ai = snapshot && typeof snapshot === 'object' ? snapshot.aiMemory : null;
      if (!ai || typeof ai !== 'object') return false;
      if (typeof ai.user === 'string' && ai.user.trim()) return true;
      if (typeof ai.memoryIndex === 'string' && ai.memoryIndex.trim()) return true;
      const longTerm = ai.longTermMemory && typeof ai.longTermMemory === 'object'
        ? ai.longTermMemory
        : null;
      if (!longTerm) return false;
      if (typeof longTerm.user === 'string' && longTerm.user.trim()) return true;
      return Array.isArray(longTerm.facts) && longTerm.facts.length > 0;
    }

    function canUsePersistedNativeStartupSnapshot(snapshot = null, source = '') {
      if (!snapshot || typeof snapshot !== 'object') return false;
      if (canTrustPersistedNativeDataSnapshot(snapshot)) return true;
      return String(source || '').trim() === 'bootstrap-cache' && hasAnyUserData(snapshot);
    }

    function shouldHydrateAfterLocalCacheFallback() {
      const runningInNativeShell = isRunningInNativeDesktopShell() || isRunningInNativeIOSShell();
      if (!runningInNativeShell) return false;
      const descriptor = readAuthoritativeStartupDataDescriptor();
      const source = String(descriptor?.source || '').trim();
      if (source === 'startup-snapshot') {
        const snapshot = descriptor?.data && typeof descriptor.data === 'object'
          ? descriptor.data
          : null;
        if (hasAnyUserData(snapshot) && !canTrustPersistedNativeDataSnapshot(snapshot)) {
          return true;
        }
        // 注入的 startup-snapshot 可能暂时为空（原生侧 / iCloud 尚未就绪），仍需走 getLiveData 对账。
        if (!hasAnyUserData(snapshot)) {
          return true;
        }
        return false;
      }
      const bootstrapSource = String(
        descriptor?.bootstrapSource
        || descriptor?.startupDescriptor?.bootstrapSource
        || ''
      ).trim();
      if (source) return false;
      if (bootstrapSource && bootstrapSource !== 'local-cache-fallback') return false;
      return true;
    }

    function shouldPromoteHydratedData(nextData = null) {
      if (!nextData || typeof nextData !== 'object') return false;
      const state = ensureBootstrapState();
      const currentData = getCurrentData();
      const nextRevision = parseBootSnapshotRevision(nextData);
      const currentRevision = parseBootSnapshotRevision(currentData);
      if (nextRevision > currentRevision) return true;
      const allowRichnessPromotion = state.bootLoadedFromStartupSnapshot === true
        || shouldHydrateAfterLocalCacheFallback();
      if (!allowRichnessPromotion) return false;
      if (hasPromotableScheduleMvpDelta(nextData, currentData)) return true;
      if (hasLongTermMemory(nextData) && !hasLongTermMemory(currentData)) return true;
      return estimateSnapshotRichness(nextData) > estimateSnapshotRichness(currentData);
    }

    function extractNativeLiveDataPayload(response) {
      const nativePayload = response && response.data && typeof response.data === 'object'
        ? response.data
        : null;
      const extracted = nativePayload
        && !nativePayload.syncMeta
        && nativePayload.data
        && typeof nativePayload.data === 'object'
        ? nativePayload.data
        : nativePayload;
      return extracted && typeof extracted === 'object' ? extracted : null;
    }

    async function fetchNativeLiveDataWithRetries() {
      const backoffMs = [0, 400, 1200, 2400];
      let lastError = null;
      for (let attempt = 0; attempt < backoffMs.length; attempt += 1) {
        if (backoffMs[attempt] > 0) {
          await new Promise((resolve) => {
            scheduleTimeout(resolve, backoffMs[attempt]);
          });
        }
        try {
          const response = await api.storage.callNativeDesktopControl('getLiveData');
          const extracted = extractNativeLiveDataPayload(response);
          if (extracted && hasAnyUserData(extracted)) {
            return { data: extracted, error: null };
          }
        } catch (error) {
          lastError = error;
        }
      }
      return { data: null, error: lastError };
    }

    function hydrateFullDataAfterStartup() {
      const state = ensureBootstrapState();
      if (state.startupHydrationScheduled) return;
      state.startupHydrationScheduled = true;
      const run = async () => {
        state.startupHydrationScheduled = false;
        const shouldHydrateFallbackReplica = shouldHydrateAfterLocalCacheFallback();
        if (state.bootLoadedFromStartupSnapshot !== true && !shouldHydrateFallbackReplica) {
          state.startupHydrationSettled = true;
          releaseStartupBootPayloadCaches();
          return;
        }
        const startupHydrationReplicaActive = state.bootLoadedFromStartupSnapshot === true || shouldHydrateFallbackReplica;
        if (typeof window !== 'undefined'
          && typeof window.MorphShouldPausePassivePull === 'function'
          && window.MorphShouldPausePassivePull()
          && !startupHydrationReplicaActive) {
          scheduleTimeout(() => hydrateFullDataAfterStartup(), 600);
          return;
        }
        let nextData = null;
        const canUseNativeHydration = (isRunningInNativeDesktopShell() || isRunningInNativeIOSShell())
          && api.storage
          && typeof api.storage.hasNativeControlBridge === 'function'
          && api.storage.hasNativeControlBridge()
          && typeof api.storage.callNativeDesktopControl === 'function';
        let nativeHydrationError = null;
        if (canUseNativeHydration) {
          const fetched = await fetchNativeLiveDataWithRetries();
          nextData = fetched.data;
          nativeHydrationError = fetched.error;
          if (!nextData && nativeHydrationError) {
            console.warn('[Morpheus startup] hydrateFullDataAfterStartup native getLiveData failed after retries; fallback to local cache', nativeHydrationError);
          }
        }
        if (!nextData) {
          try {
            nextData = api.storage && typeof api.storage.loadData === 'function'
              ? api.storage.loadData()
              : null;
          } catch (error) {
            const hydrateError = nativeHydrationError || error;
            console.warn('[Morpheus startup] hydrateFullDataAfterStartup failed', hydrateError);
            state.bootLoadedFromStartupSnapshot = false;
            state.startupHydrationSettled = true;
            releaseStartupBootPayloadCaches();
            if (api.storage && typeof api.storage.flushDeferredAuthoritativePersist === 'function') {
              try { api.storage.flushDeferredAuthoritativePersist(); } catch (_) {}
            }
            dismissStartupSkeleton(0);
            scheduleStartupLucideRefreshes();
            return;
          }
        }
        const normalizedHydrationCandidate = typeof api.normalizeIncomingDataShape === 'function'
          ? api.normalizeIncomingDataShape(nextData)
          : nextData;
        const normalizedWithCurrentRhythm = attachMergedBootScheduleMvp(normalizedHydrationCandidate, getCurrentData());
        const normalizedWithBootRhythm = attachMergedBootScheduleMvp(normalizedWithCurrentRhythm, readCurrentBootDataSnapshotAlias());
        const normalizedNextData = attachMergedBootScheduleMvp(normalizedWithBootRhythm, readAuthoritativeStartupDataSnapshot());
        if (!shouldPromoteHydratedData(normalizedNextData)) {
          state.bootLoadedFromStartupSnapshot = false;
          state.startupHydrationSettled = true;
          releaseStartupBootPayloadCaches();
          if (api.storage && typeof api.storage.flushDeferredAuthoritativePersist === 'function') {
            try { api.storage.flushDeferredAuthoritativePersist(); } catch (_) {}
          }
          dismissStartupSkeleton(0);
          scheduleStartupLucideRefreshes();
          return;
        }
        setCurrentData(normalizedNextData);
        if (typeof api.ensureSecureVaultShape === 'function') api.ensureSecureVaultShape(normalizedNextData);
        setLocalDataRevision(parseBootSnapshotRevision(normalizedNextData));
        setCurrentBootDataSnapshot(normalizedNextData);
        try {
          if (typeof api.syncAIChatStateFromData === 'function') api.syncAIChatStateFromData();
        } catch (error) {
          console.warn('[Morpheus startup] hydrateFullDataAfterStartup failed to sync AI chat state.', error);
        }
        state.bootLoadedFromStartupSnapshot = false;
        state.startupHydrationSettled = true;
        releaseStartupBootPayloadCaches();
        if (api.storage && typeof api.storage.flushDeferredAuthoritativePersist === 'function') {
          try {
            api.storage.flushDeferredAuthoritativePersist();
          } catch (_) {}
        }
        if (typeof api.renderAll === 'function') api.renderAll();
        try {
          if (typeof api.enforceExplicitHashRouteVisibility === 'function') {
            api.enforceExplicitHashRouteVisibility({ source: 'hydrateFullDataAfterStartup:post-render' });
          }
          if (typeof api.scheduleExplicitHashRouteVisibilityEnforcement === 'function') {
            api.scheduleExplicitHashRouteVisibilityEnforcement(90, { source: 'hydrateFullDataAfterStartup:deferred-1' });
            api.scheduleExplicitHashRouteVisibilityEnforcement(320, { source: 'hydrateFullDataAfterStartup:deferred-2' });
          }
        } catch (_) {}
        dismissStartupSkeleton(0);
        scheduleStartupLucideRefreshes();
      };
      if (state.bootLoadedFromStartupSnapshot) {
        scheduleTimeout(() => { void run(); }, 140);
        return;
      }
      if (typeof api.requestIdleCallback === 'function') {
        api.requestIdleCallback(() => { void run(); }, { timeout: 2200 });
        return;
      }
      scheduleTimeout(() => { void run(); }, 900);
    }

    function estimateSnapshotRichness(snapshot = null) {
      if (!snapshot || typeof snapshot !== 'object') return 0;
      const safe = snapshot;
      const dailyMonths = safe.dailyMonths && typeof safe.dailyMonths === 'object' ? safe.dailyMonths : {};
      const totalDailyBlocks = Object.values(dailyMonths).reduce((sum, blocks) => {
        return sum + (Array.isArray(blocks) ? blocks.length : 0);
      }, 0);
      const aiMemory = safe.aiMemory && typeof safe.aiMemory === 'object' ? safe.aiMemory : {};
      const chatSessions = Array.isArray(aiMemory.chatSessions) ? aiMemory.chatSessions : [];
      const totalChatMessages = chatSessions.reduce((sum, session) => {
        return sum + (Array.isArray(session?.messages) ? session.messages.length : 0);
      }, 0);
      const aiDailyLogs = aiMemory.dailyLogs && typeof aiMemory.dailyLogs === 'object' ? aiMemory.dailyLogs : {};
      const expenseRecords = Array.isArray(safe.expenseLedger?.records) ? safe.expenseLedger.records.length : 0;
      return (
        (Array.isArray(safe.flashThoughts) ? safe.flashThoughts.length : 0)
        + (Array.isArray(safe.fixed) ? safe.fixed.length : 0)
        + (Array.isArray(safe.projects) ? safe.projects.length : 0)
        + (Array.isArray(safe.routines) ? safe.routines.length : 0)
        + (Array.isArray(safe.sops) ? safe.sops.length : 0)
        + (Array.isArray(safe.reminders) ? safe.reminders.length : 0)
        + Object.keys(dailyMonths).length * 5
        + totalDailyBlocks
        + chatSessions.length * 3
        + totalChatMessages
        + Object.keys(aiDailyLogs).length * 2
        + expenseRecords
      );
    }

    function startBootstrapWatchers() {
      installBootOnlyWatchers();
      ensureLucideScriptLoaded();
      scheduleStartupLucideRefreshes();
      startStartupLucideObserver();
      if (startupSkeletonRescueTimer) cancelTimeout(startupSkeletonRescueTimer);
      startupSkeletonRescueTimer = scheduleTimeout(() => rescueStartupSkeletonReady(), 3200);
      if (startupSkeletonForceTimer) cancelTimeout(startupSkeletonForceTimer);
      startupSkeletonForceTimer = scheduleTimeout(() => dismissStartupSkeleton(0), 16000);
    }

    function describeCurrentBootPhase() {
      const state = ensureBootstrapState();
      if (state.startupSkeletonDismissed) return 'ready';
      if (shouldWaitForNativeBootstrap()) return 'waiting-native-bootstrap';
      if (shouldWaitForBrowserSyncRootStartupBootstrap()) return 'waiting-browser-sync-bootstrap';
      if (state.bootLoadedFromStartupSnapshot && state.startupHydrationSettled !== true) {
        return 'hydrating-startup-snapshot';
      }
      return 'booting';
    }

    return {
      buildDefaultBootstrapState,
      ensureBootstrapState,
      shouldWaitForNativeBootstrap,
      shouldBootstrapSelectedBrowserSyncRootOnStartup,
      beginBrowserSyncRootStartupBootstrapIfNeeded,
      markBrowserSyncRootBootstrapStarted,
      markBrowserSyncRootBootstrapSettled,
      shouldWaitForBrowserSyncRootStartupBootstrap,
      shouldKeepStartupBlockersVisible,
      releaseStartupBootPayloadCaches,
      handleStartupBlockerPointerDown,
      rescueStartupSkeletonReady,
      parseBootSnapshotRevision,
      parseBootSnapshotWriteTime,
      choosePreferredBootSnapshot,
      loadBestAvailableData,
      readAuthoritativeStartupDataSnapshot,
      readAuthoritativeStartupDataDescriptor,
      setCurrentBootDataSnapshot,
      setNativeBootstrapAppliedForSession,
      readNativeBootstrapAppliedSessionMarker,
      readCurrentBootDataSnapshotAlias,
      readCurrentBootDataSnapshotForStartupGuard,
      hasNativeBootstrapAppliedForSession,
      shouldHydrateAfterLocalCacheFallback,
      shouldPromoteHydratedData,
      hydrateFullDataAfterStartup,
      requestLucideRefresh,
      ensureLucideScriptLoaded,
      clearStartupLucideRefreshTimers,
      stopStartupLucideObserver,
      startStartupLucideObserver,
      startBootstrapWatchers,
      installBootOnlyWatchers,
      dismissStartupSkeleton,
      scheduleStartupLucideRefreshes,
      describeCurrentBootPhase,
    };
  }

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createAppBootstrapDepsRuntime(root) {
    const currentRoot = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || currentRoot;
    const getGlobalFunction = (name = '') => {
      const key = String(name || '').trim();
      if (!key) return null;
      const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
      if (typeof fromGlobal === 'function') return fromGlobal;
      const fromRoot = currentRoot && typeof currentRoot[key] === 'function' ? currentRoot[key] : null;
      return typeof fromRoot === 'function' ? fromRoot : null;
    };
    const getGlobalValue = (name = '', fallback = null) => {
      const key = String(name || '').trim();
      if (!key) return fallback;
      if (globalRoot && typeof globalRoot[key] !== 'undefined') return globalRoot[key];
      if (currentRoot && typeof currentRoot[key] !== 'undefined') return currentRoot[key];
      return fallback;
    };

    function buildAppDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        window: context.window || currentRoot || (typeof window !== 'undefined' ? window : null),
        document: context.document || (typeof document !== 'undefined' ? document : null),
        desktopBootstrapWaitMs: Number(context.desktopBootstrapWaitMs) || 4500,
        startupSkeletonReadyDelayMs: Number(context.startupSkeletonReadyDelayMs) || 1200,
        storage: context.storage || getGlobalValue('storage', null) || (currentRoot && (currentRoot.MorphStorage || currentRoot.LianXingStorage)) || null,
        buildEmptyMorphDataSnapshot: pickFunction(context.buildEmptyMorphDataSnapshot, getGlobalFunction('buildEmptyMorphDataSnapshot') || (() => ({}))),
        hasAnyUserData: pickFunction(context.hasAnyUserData, getGlobalFunction('hasAnyUserData') || (() => false)),
        canTrustPersistedNativeDataSnapshot: pickFunction(context.canTrustPersistedNativeDataSnapshot, getGlobalFunction('canTrustPersistedNativeDataSnapshot') || (() => false)),
        readRecoverySnapshot: pickFunction(context.readRecoverySnapshot, getGlobalFunction('readRecoverySnapshot') || (() => null)),
        isRunningInNativeDesktopShell: pickFunction(context.isRunningInNativeDesktopShell, getGlobalFunction('isRunningInNativeDesktopShell') || (() => false)),
        isRunningInNativeIOSShell: pickFunction(context.isRunningInNativeIOSShell, getGlobalFunction('isRunningInNativeIOSShell') || (() => false)),
        setMorphAppBootState: pickFunction(context.setMorphAppBootState, getGlobalFunction('setMorphAppBootState') || (() => {})),
        ensureSecureVaultShape: pickFunction(context.ensureSecureVaultShape, getGlobalFunction('ensureSecureVaultShape') || ((value) => value || {})),
        renderAll: pickFunction(context.renderAll, getGlobalFunction('renderAll') || (() => {})),
        hasMeaningfulCurrentViewContent: pickFunction(context.hasMeaningfulCurrentViewContent, getGlobalFunction('hasMeaningfulCurrentViewContent') || (() => true)),
        getData: pickFunction(context.getData, () => getGlobalValue('data', null)),
        setData: pickFunction(context.setData, () => {}),
        setLocalDataRevision: pickFunction(context.setLocalDataRevision, () => {}),
        normalizeIncomingDataShape: pickFunction(context.normalizeIncomingDataShape, getGlobalFunction('normalizeIncomingDataShape') || ((value) => value)),
        syncAIChatStateFromData: pickFunction(context.syncAIChatStateFromData, getGlobalFunction('syncAIChatStateFromData') || (() => {})),
        enforceExplicitHashRouteVisibility: pickFunction(context.enforceExplicitHashRouteVisibility, getGlobalFunction('enforceExplicitHashRouteVisibility') || (() => false)),
        scheduleExplicitHashRouteVisibilityEnforcement: pickFunction(context.scheduleExplicitHashRouteVisibilityEnforcement, getGlobalFunction('scheduleExplicitHashRouteVisibilityEnforcement') || (() => false)),
        reconcileAIHistoryAfterBootSelection: pickFunction(context.reconcileAIHistoryAfterBootSelection, getGlobalFunction('reconcileAIHistoryAfterBootSelection') || ((options = {}) => options.selectedSnapshot || null)),
        reconcileStableMemoryAfterBootSelection: pickFunction(context.reconcileStableMemoryAfterBootSelection, getGlobalFunction('reconcileStableMemoryAfterBootSelection') || ((options = {}) => options.selectedSnapshot || null)),
        hideStartupBlockers: pickFunction(context.hideStartupBlockers, getGlobalFunction('hideStartupBlockers') || (() => {})),
        getLucideCreateIcons: pickFunction(context.getLucideCreateIcons, getGlobalFunction('getLucideCreateIcons') || (() => null)),
        hasPendingLucideNodes: pickFunction(context.hasPendingLucideNodes, getGlobalFunction('hasPendingLucideNodes') || (() => false)),
        requestIdleCallback: pickFunction(context.requestIdleCallback, (callback, options) => {
          const owner = context.window || currentRoot || (typeof window !== 'undefined' ? window : null);
          return owner && typeof owner.requestIdleCallback === 'function'
            ? owner.requestIdleCallback(callback, options)
            : null;
        }),
        requestAnimationFrame: pickFunction(context.requestAnimationFrame, (callback) => requestAnimationFrame(callback)),
        setTimeout: pickFunction(context.setTimeout, (callback, delay) => setTimeout(callback, delay)),
        clearTimeout: pickFunction(context.clearTimeout, (timerId) => clearTimeout(timerId)),
        MutationObserver: context.MutationObserver || getGlobalValue('MutationObserver', null),
      };
    }

    return { buildAppDeps };
  }

  if (typeof window !== 'undefined') {
    window.MorphAppBootstrapRuntime = {
      create: createAppBootstrapRuntime,
    };
    window.MorphAppBootstrapDepsRuntime = {
      create: () => createAppBootstrapDepsRuntime(window),
    };
  }
})();
