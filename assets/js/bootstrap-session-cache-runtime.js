// @ts-check

(function initMorphBootstrapSessionCacheRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphBootstrapSessionCacheRuntime && typeof window.MorphBootstrapSessionCacheRuntime.create === 'function') return;

  function createBootstrapSessionCacheRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getStorageRef() {
      if (typeof api.getStorageRef === 'function') return api.getStorageRef();
      return null;
    }

    function getAppBootstrapRuntimeModules() {
      if (typeof api.getAppBootstrapRuntimeModules === 'function') {
        return api.getAppBootstrapRuntimeModules();
      }
      return null;
    }

    function writeRuntimeCacheSnapshot(data) {
      try {
        const storageRef = getStorageRef();
        if (storageRef && typeof storageRef.writeLocalCacheSnapshot === 'function') {
          storageRef.writeLocalCacheSnapshot(data);
          return true;
        }
      } catch (_) {}
      return false;
    }

    function setNativeBootstrapAppliedForSession(applied) {
      const runtime = getAppBootstrapRuntimeModules();
      if (runtime && typeof runtime.setNativeBootstrapAppliedForSession === 'function') {
        return runtime.setNativeBootstrapAppliedForSession(applied);
      }
      return false;
    }

    function setCurrentBootDataSnapshot(snapshot = null) {
      const runtime = getAppBootstrapRuntimeModules();
      if (runtime && typeof runtime.setCurrentBootDataSnapshot === 'function') {
        return runtime.setCurrentBootDataSnapshot(snapshot);
      }
      return false;
    }

    function readNativeBootstrapAppliedSessionMarker() {
      const runtime = getAppBootstrapRuntimeModules();
      if (runtime && typeof runtime.readNativeBootstrapAppliedSessionMarker === 'function') {
        return runtime.readNativeBootstrapAppliedSessionMarker();
      }
      return false;
    }

    function readCurrentBootDataSnapshotAlias() {
      const runtime = getAppBootstrapRuntimeModules();
      if (runtime && typeof runtime.readCurrentBootDataSnapshotAlias === 'function') {
        return runtime.readCurrentBootDataSnapshotAlias();
      }
      return null;
    }

    function markRuntimeLastRestoreAtNow() {
      try {
        const storageRef = getStorageRef();
        if (storageRef && typeof storageRef.setLastRestoreAt === 'function') {
          storageRef.setLastRestoreAt(new Date().toISOString());
          return true;
        }
      } catch (_) {}
      return false;
    }

    return {
      writeRuntimeCacheSnapshot,
      setNativeBootstrapAppliedForSession,
      setCurrentBootDataSnapshot,
      readNativeBootstrapAppliedSessionMarker,
      readCurrentBootDataSnapshotAlias,
      markRuntimeLastRestoreAtNow,
    };
  }

  window.MorphBootstrapSessionCacheRuntime = {
    create: createBootstrapSessionCacheRuntime,
  };
})();
