(function () {
  if (typeof window === 'undefined') return;
  if (window.MorphExternalSyncApplyRuntime && typeof window.MorphExternalSyncApplyRuntime.create === 'function') return;

  function createExternalSyncApplyRuntime(deps = {}) {
    let deferredExternalSnapshot = null;
    let deferredExternalSnapshotTimer = null;

    const getWindowRef = () => (
      typeof deps.getWindowRef === 'function'
        ? deps.getWindowRef()
        : window
    );
    const clearTimeoutRef = (timer) => {
      const fn = typeof deps.clearTimeoutRef === 'function' ? deps.clearTimeoutRef : clearTimeout;
      return fn(timer);
    };
    const setTimeoutRef = (callback, delayMs) => {
      const fn = typeof deps.setTimeoutRef === 'function' ? deps.setTimeoutRef : setTimeout;
      return fn(callback, delayMs);
    };
    const now = () => (
      typeof deps.now === 'function'
        ? Number(deps.now()) || Date.now()
        : Date.now()
    );
    const guardExternalSnapshotByRecentDomainWrites = (rawData, options = {}) => (
      typeof deps.guardExternalSnapshotByRecentDomainWrites === 'function'
        ? deps.guardExternalSnapshotByRecentDomainWrites(rawData, options)
        : { guarded: false, reason: '', domains: [] }
    );
    const isDeferredExternalApplyReason = (reason = '') => (
      typeof deps.isDeferredExternalApplyReason === 'function'
        ? !!deps.isDeferredExternalApplyReason(reason)
        : false
    );
    const recordMorphSyncReceipt = (payload = {}) => {
      if (typeof deps.recordMorphSyncReceipt === 'function') deps.recordMorphSyncReceipt(payload);
    };
    const applySoftExternalData = (rawData, options = {}) => (
      typeof deps.applySoftExternalData === 'function'
        ? deps.applySoftExternalData(rawData, options)
        : { applied: false, reason: 'runtime_missing_apply' }
    );

    function buildDeferredExternalApplyMessage(applyResult = {}) {
      if (Array.isArray(applyResult.guardedDomains) && applyResult.guardedDomains.length) {
        return `外部同步触碰最近本地已提交的核心域，暂缓应用：${applyResult.guardedDomains.join('、')}`;
      }
      if (String(applyResult.reason || '').trim() === 'draft_protected') {
        return '当前存在未提交草稿，外部同步已暂缓，等待草稿提交或撤销';
      }
      return '外部同步暂缓应用，等待本地空闲或本地写入确认';
    }

    function clearDeferredExternalSnapshot() {
      deferredExternalSnapshot = null;
      clearTimeoutRef(deferredExternalSnapshotTimer);
      deferredExternalSnapshotTimer = null;
    }

    function scheduleDeferredExternalSnapshot(rawData, options = {}, delayMs = 2200) {
      deferredExternalSnapshot = {
        rawData,
        options: { ...options },
        queuedAt: now(),
      };
      clearTimeoutRef(deferredExternalSnapshotTimer);
      deferredExternalSnapshotTimer = setTimeoutRef(() => {
        deferredExternalSnapshotTimer = null;
        flushDeferredExternalSnapshot();
      }, Math.max(800, Number(delayMs) || 2200));
    }

    function hasDeferredExternalSnapshot() {
      return !!deferredExternalSnapshot;
    }

    function flushDeferredExternalSnapshot() {
      if (!deferredExternalSnapshot) return false;
      const payload = deferredExternalSnapshot;
      const windowRef = getWindowRef();
      if (typeof windowRef?.MorphShouldPausePassivePull === 'function' && windowRef.MorphShouldPausePassivePull()) {
        scheduleDeferredExternalSnapshot(payload.rawData, payload.options, 2500);
        payload.rawData = null;
        payload.options = null;
        return false;
      }
      if (typeof windowRef?.MorphShouldDeferExternalReload === 'function' && windowRef.MorphShouldDeferExternalReload()) {
        scheduleDeferredExternalSnapshot(payload.rawData, payload.options, 2500);
        payload.rawData = null;
        payload.options = null;
        return false;
      }
      const guard = guardExternalSnapshotByRecentDomainWrites(payload.rawData, payload.options);
      if (guard.guarded && isDeferredExternalApplyReason(guard.reason)) {
        scheduleDeferredExternalSnapshot(payload.rawData, payload.options, 2500);
        payload.rawData = null;
        payload.options = null;
        return false;
      }
      clearDeferredExternalSnapshot();
      const applyResult = applySoftExternalData(payload.rawData, payload.options);
      if (!applyResult.applied && isDeferredExternalApplyReason(applyResult.reason)) {
        scheduleDeferredExternalSnapshot(payload.rawData, payload.options, 2500);
        payload.rawData = null;
        payload.options = null;
        return false;
      }
      payload.rawData = null;
      payload.options = null;
      return applyResult.applied;
    }

    function applyOrQueueExternalSnapshot(rawData, options = {}) {
      const guard = guardExternalSnapshotByRecentDomainWrites(rawData, options);
      const applyResult = guard.guarded
        ? {
            applied: false,
            reason: guard.reason,
            guardedDomains: Array.isArray(guard.domains) ? guard.domains.slice() : [],
          }
        : applySoftExternalData(rawData, options);
      if (applyResult.applied) {
        clearDeferredExternalSnapshot();
        return applyResult;
      }
      if (!applyResult.applied && isDeferredExternalApplyReason(applyResult.reason)) {
        recordMorphSyncReceipt({
          status: 'deferred',
          source: 'external-sync',
          reason: String(applyResult.reason || 'external_reload_deferred'),
          message: buildDeferredExternalApplyMessage(applyResult),
        });
        scheduleDeferredExternalSnapshot(rawData, options);
      }
      return applyResult;
    }

    function flushDeferredExternalSnapshotSoon(delayMs = 60) {
      if (!deferredExternalSnapshot) return false;
      setTimeoutRef(() => {
        flushDeferredExternalSnapshot();
      }, Math.max(0, Number(delayMs) || 0));
      return true;
    }

    return {
      clearDeferredExternalSnapshot,
      scheduleDeferredExternalSnapshot,
      hasDeferredExternalSnapshot,
      flushDeferredExternalSnapshot,
      flushDeferredExternalSnapshotSoon,
      applyOrQueueExternalSnapshot,
    };
  }

  window.MorphExternalSyncApplyRuntime = {
    create: createExternalSyncApplyRuntime,
  };
})();
