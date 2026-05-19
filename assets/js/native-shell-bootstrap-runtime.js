// @ts-check

(function initMorphNativeShellBootstrapRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphNativeShellBootstrapRuntime && typeof window.MorphNativeShellBootstrapRuntime.create === 'function') return;

  function createNativeShellBootstrapRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getWindowRef() {
      if (typeof api.getWindowRef === 'function') return api.getWindowRef();
      if (typeof window !== 'undefined') return window;
      return null;
    }

    function getDocumentRef() {
      if (typeof api.getDocumentRef === 'function') return api.getDocumentRef();
      if (typeof document !== 'undefined') return document;
      return null;
    }

    function getNavigatorRef() {
      if (typeof api.getNavigatorRef === 'function') return api.getNavigatorRef();
      if (typeof navigator !== 'undefined') return navigator;
      return null;
    }

    function getLocalStorageRef() {
      if (typeof api.getLocalStorageRef === 'function') return api.getLocalStorageRef();
      if (typeof localStorage !== 'undefined') return localStorage;
      return null;
    }

    function getStorageRef() {
      if (typeof api.getStorageRef === 'function') return api.getStorageRef();
      return null;
    }

    function getSettingsState() {
      if (typeof api.getSettingsState === 'function') return api.getSettingsState();
      return {};
    }

    function getTrustedNativeBootstrapKey() {
      return String(api.trustedNativeBootstrapKey || '').trim();
    }

    function getNativeSyncRootCacheKey() {
      return String(api.nativeSyncRootCacheKey || '').trim();
    }

    function getDesktopMessageHandlers() {
      const win = getWindowRef();
      if (!win) return null;
      return (win.webkit && win.webkit.messageHandlers) ? win.webkit.messageHandlers : null;
    }

    function readNativeDesktopControlHandler() {
      const handlers = getDesktopMessageHandlers();
      const primary = handlers && handlers.morphDesktopControl;
      if (primary && typeof primary.postMessage === 'function') return primary;
      return null;
    }

    function readNativeSyncHandler() {
      const handlers = getDesktopMessageHandlers();
      const primary = handlers && handlers.morphSync;
      if (primary && typeof primary.postMessage === 'function') return primary;
      return null;
    }

    function readNativeSpeechHandler() {
      const handlers = getDesktopMessageHandlers();
      const primary = handlers && handlers.morphNativeSpeech;
      if (primary && typeof primary.postMessage === 'function') return primary;
      return null;
    }

    function isLikelyIOSNativeRuntime() {
      const doc = getDocumentRef();
      if (doc && doc.documentElement && doc.documentElement.classList && typeof doc.documentElement.classList.contains === 'function'
        && doc.documentElement.classList.contains('ios-native-app')) {
        return true;
      }
      const nav = getNavigatorRef();
      if (!nav) return false;
      return /iPhone|iPad|iPod/i.test(String(nav.userAgent || ''));
    }

    function normalizeBootSyncRootPath(path = '') {
      return String(path || '').trim().replace(/\/+$/g, '').toLowerCase();
    }

    function bootSnapshotHasUserData(raw) {
      const d = raw && typeof raw === 'object' ? raw : null;
      if (!d) return false;
      if (Array.isArray(d.flashThoughts) && d.flashThoughts.length > 0) return true;
      if (Array.isArray(d.completedFlashThoughts) && d.completedFlashThoughts.length > 0) return true;
      if (Array.isArray(d.fixed) && d.fixed.length > 0) return true;
      if (Array.isArray(d.completedFixedThoughts) && d.completedFixedThoughts.length > 0) return true;
      if (Array.isArray(d.projects) && d.projects.length > 0) return true;
      if (Array.isArray(d.routines) && d.routines.length > 0) return true;
      if (Array.isArray(d.sops) && d.sops.length > 0) return true;
      if (Array.isArray(d.reminders) && d.reminders.length > 0) return true;
      if (d.dailyMonths && typeof d.dailyMonths === 'object' && Object.keys(d.dailyMonths).length > 0) return true;
      const ai = d.aiMemory && typeof d.aiMemory === 'object' ? d.aiMemory : {};
      if (typeof ai.soul === 'string' && ai.soul.trim()) return true;
      if (typeof ai.user === 'string' && ai.user.trim()) return true;
      if (Array.isArray(ai.chatSessions) && ai.chatSessions.length > 0) return true;
      if (ai.dailyLogs && typeof ai.dailyLogs === 'object' && Object.keys(ai.dailyLogs).length > 0) return true;
      return false;
    }

    function readBootJSONStorage(key = '') {
      const localStorageRef = getLocalStorageRef();
      if (!localStorageRef || typeof localStorageRef.getItem !== 'function') return {};
      try {
        const raw = localStorageRef.getItem(String(key || '').trim());
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (_) {
        return {};
      }
    }

    function readTrustedNativeBootstrapMeta() {
      const key = getTrustedNativeBootstrapKey();
      if (!key) return {};
      return readBootJSONStorage(key);
    }

    function writeTrustedNativeBootstrapMeta(value = {}) {
      const localStorageRef = getLocalStorageRef();
      const key = getTrustedNativeBootstrapKey();
      if (!localStorageRef || !key || typeof localStorageRef.setItem !== 'function') return;
      try {
        localStorageRef.setItem(key, JSON.stringify(value && typeof value === 'object' ? value : {}));
      } catch (_) {}
    }

    function canTrustPersistedNativeDataSnapshot(snapshot = null) {
      if (!bootSnapshotHasUserData(snapshot)) return false;
      const trusted = readTrustedNativeBootstrapMeta();
      const trustedPath = normalizeBootSyncRootPath(trusted.path || '');
      if (!trustedPath) return false;
      const cacheKey = getNativeSyncRootCacheKey();
      const cached = cacheKey ? readBootJSONStorage(cacheKey) : {};
      const expectedPath = normalizeBootSyncRootPath(cached.path || '');
      if (expectedPath && trustedPath !== expectedPath) return false;
      return true;
    }

    function isRunningInNativeDesktopShell() {
      if (isLikelyIOSNativeRuntime()) return false;
      const storageRef = getStorageRef();
      return !!(
        (storageRef && typeof storageRef.hasNativeControlBridge === 'function' && storageRef.hasNativeControlBridge())
        || readNativeDesktopControlHandler()
        || readNativeSyncHandler()
      );
    }

    function isRunningInNativeIOSShell() {
      const storageRef = getStorageRef();
      const hasControlBridge = !!(storageRef && typeof storageRef.hasNativeControlBridge === 'function' && storageRef.hasNativeControlBridge());
      if (!hasControlBridge) return false;
      try {
        const settingsState = getSettingsState();
        const explicitPlatform = String(settingsState && settingsState.nativePlatform || '').toLowerCase();
        if (explicitPlatform === 'ios') return true;
        if (explicitPlatform === 'macos') return false;
      } catch (_) {}
      return isLikelyIOSNativeRuntime();
    }

    return {
      getDesktopMessageHandlers,
      readNativeDesktopControlHandler,
      readNativeSyncHandler,
      readNativeSpeechHandler,
      isLikelyIOSNativeRuntime,
      normalizeBootSyncRootPath,
      bootSnapshotHasUserData,
      readBootJSONStorage,
      readTrustedNativeBootstrapMeta,
      writeTrustedNativeBootstrapMeta,
      canTrustPersistedNativeDataSnapshot,
      isRunningInNativeDesktopShell,
      isRunningInNativeIOSShell,
    };
  }

  window.MorphNativeShellBootstrapRuntime = {
    create: createNativeShellBootstrapRuntime,
  };
})();
