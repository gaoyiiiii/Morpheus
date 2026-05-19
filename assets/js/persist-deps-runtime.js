// @ts-check

(function initMorphPersistDepsRuntime(root) {
  if (!root) return;
  if (root.MorphPersistDepsRuntime && typeof root.MorphPersistDepsRuntime.create === 'function') return;

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function create() {
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || root;
    const getGlobalFunction = (name = '') => {
      const key = String(name || '').trim();
      if (!key) return null;
      const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
      if (typeof fromGlobal === 'function') return fromGlobal;
      const fromWindow = typeof root[key] === 'function' ? root[key] : null;
      return typeof fromWindow === 'function' ? fromWindow : null;
    };
    const getGlobalValue = (name = '', fallback = null) => {
      const key = String(name || '').trim();
      if (!key) return fallback;
      if (globalRoot && typeof globalRoot[key] !== 'undefined') return globalRoot[key];
      if (typeof root[key] !== 'undefined') return root[key];
      return fallback;
    };

    function buildDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        getData: pickFunction(context.getData, () => null),
        setData: pickFunction(context.setData, () => {}),
        getStorage: pickFunction(context.getStorage, () => null),
        getPerf: pickFunction(context.getPerf, () => ({})),
        getCurrentTab: pickFunction(context.getCurrentTab, () => 'flashThoughts'),
        getAIChatState: pickFunction(context.getAIChatState, () => null),
        getAIMemory: pickFunction(context.getAIMemory, () => null),
        getAIChatHistoryKey: pickFunction(context.getAIChatHistoryKey, () => ''),
        getAIChatLocalHistoryMax: pickFunction(context.getAIChatLocalHistoryMax, () => 0),
        getAIChatMaxSessions: pickFunction(context.getAIChatMaxSessions, () => 0),
        getUiSessionLockUntil: pickFunction(context.getUiSessionLockUntil, () => 0),
        getRecentCommittedDataFreezeUntil: pickFunction(context.getRecentCommittedDataFreezeUntil, () => 0),
        getLastUserEditAt: pickFunction(context.getLastUserEditAt, () => 0),
        getDataRevision: pickFunction(context.getDataRevision, () => 0),
        getActiveManagedEditorNode: pickFunction(context.getActiveManagedEditorNode, () => null),
        isUserEditComposeActive: pickFunction(context.isUserEditComposeActive, () => false),
        isDrawerOpen: pickFunction(context.isDrawerOpen, () => false),
        isVersionedEditorContext: pickFunction(context.isVersionedEditorContext, () => false),
        expandMorphSyncDomains: pickFunction(context.expandMorphSyncDomains, (list = []) => (Array.isArray(list) ? list : [])),
        mergeMorphSyncEntityRefs: pickFunction(context.mergeMorphSyncEntityRefs, (prev = [], next = []) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [])]),
        pushUndoSnapshot: pickFunction(context.pushUndoSnapshot, () => {}),
        scheduleTypingUndoSnapshot: pickFunction(context.scheduleTypingUndoSnapshot, () => {}),
        requestRenderAll: pickFunction(context.requestRenderAll, () => {}),
        requestDrawerRender: pickFunction(context.requestDrawerRender, () => {}),
        requestAIChatRender: pickFunction(context.requestAIChatRender, () => {}),
        writeRecoverySnapshotNow: pickFunction(context.writeRecoverySnapshotNow, () => {}),
        markUserEditingActivity: pickFunction(context.markUserEditingActivity, () => {}),
        stampLocalDataRevision: pickFunction(context.stampLocalDataRevision, () => {}),
        protectRecentCommittedData: pickFunction(context.protectRecentCommittedData, () => {}),
        bumpUISessionLock: pickFunction(context.bumpUISessionLock, () => {}),
        markWebPassivePullFastLane: pickFunction(context.markWebPassivePullFastLane, () => {}),
        emitMorphRuntimeSyncPulse: pickFunction(context.emitMorphRuntimeSyncPulse, () => {}),
        resolveManagedEditorSyncPayload: pickFunction(context.resolveManagedEditorSyncPayload, () => ({})),
        normalizeAIChatMessage: pickFunction(context.normalizeAIChatMessage, (value) => value),
        buildLightweightAIChatLocalHistory: pickFunction(context.buildLightweightAIChatLocalHistory, () => []),
        ensureCurrentAIChatSession: pickFunction(context.ensureCurrentAIChatSession, () => null),
        shouldKeepExistingAIChatSessionTitle: pickFunction(context.shouldKeepExistingAIChatSessionTitle, () => false),
        buildAIChatSessionTitle: pickFunction(context.buildAIChatSessionTitle, () => '新对话'),
        isAnyVoiceRunning: pickFunction(context.isAnyVoiceRunning, () => false),
        getExternalReloadGraceMs: pickFunction(context.getExternalReloadGraceMs, () => 0),
        ensureBootstrapShellState: pickFunction(context.ensureBootstrapShellState, () => null),
        syncAllPluginFacingDataExports: pickFunction(context.syncAllPluginFacingDataExports, () => Promise.resolve()),
      };
    }

    function buildAppPersistDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      const getAIChatStateFallback = () => {
        const value = getGlobalValue('aiChatState', null);
        return value && typeof value === 'object' ? value : null;
      };
      return {
        getData: pickFunction(context.getData, () => null),
        setData: pickFunction(context.setData, () => {}),
        getStorage: pickFunction(context.getStorage, () => root.MorphStorage || root.LianXingStorage || null),
        getPerf: pickFunction(context.getPerf, () => getGlobalValue('PERF', {})),
        getCurrentTab: pickFunction(context.getCurrentTab, () => String(getGlobalValue('currentTab', 'flashThoughts') || 'flashThoughts').trim() || 'flashThoughts'),
        getAIChatState: pickFunction(context.getAIChatState, getAIChatStateFallback),
        getAIMemory: pickFunction(context.getAIMemory, getGlobalFunction('getAIMemory') || (() => null)),
        getAIChatHistoryKey: pickFunction(context.getAIChatHistoryKey, () => String(getGlobalValue('AI_CHAT_HISTORY_KEY', '') || '')),
        getAIChatLocalHistoryMax: pickFunction(context.getAIChatLocalHistoryMax, () => Number(getGlobalValue('AI_CHAT_LOCAL_HISTORY_MAX', 0) || 0)),
        getAIChatMaxSessions: pickFunction(context.getAIChatMaxSessions, () => Number(getGlobalValue('AI_CHAT_MAX_SESSIONS', 0) || 0)),
        getUiSessionLockUntil: pickFunction(context.getUiSessionLockUntil, () => Number(getGlobalValue('uiSessionLockUntil', 0) || 0)),
        getRecentCommittedDataFreezeUntil: pickFunction(context.getRecentCommittedDataFreezeUntil, () => Number(getGlobalValue('recentCommittedDataFreezeUntil', 0) || 0)),
        getLastUserEditAt: pickFunction(context.getLastUserEditAt, () => Number(getGlobalValue('lastUserEditAt', 0) || 0)),
        getDataRevision: pickFunction(context.getDataRevision, (target) => {
          const reader = getGlobalFunction('getDataRevision');
          return typeof reader === 'function' ? reader(target) : 0;
        }),
        getActiveManagedEditorNode: pickFunction(context.getActiveManagedEditorNode, getGlobalFunction('getActiveManagedEditorNode') || (() => null)),
        isUserEditComposeActive: pickFunction(context.isUserEditComposeActive, () => !!getGlobalValue('userEditComposeActive', false)),
        isDrawerOpen: pickFunction(context.isDrawerOpen, () => !!getGlobalValue('isDrawerOpen', false)),
        isVersionedEditorContext: pickFunction(context.isVersionedEditorContext, getGlobalFunction('isVersionedEditorContext') || (() => false)),
        expandMorphSyncDomains: pickFunction(context.expandMorphSyncDomains, getGlobalFunction('expandMorphSyncDomains') || ((list = []) => (Array.isArray(list) ? list : []))),
        mergeMorphSyncEntityRefs: pickFunction(context.mergeMorphSyncEntityRefs, getGlobalFunction('mergeMorphSyncEntityRefs') || ((prev = [], next = []) => [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [])])),
        pushUndoSnapshot: pickFunction(context.pushUndoSnapshot, getGlobalFunction('pushUndoSnapshot') || (() => {})),
        scheduleTypingUndoSnapshot: pickFunction(context.scheduleTypingUndoSnapshot, getGlobalFunction('scheduleTypingUndoSnapshot') || (() => {})),
        requestRenderAll: pickFunction(context.requestRenderAll, getGlobalFunction('requestRenderAll') || (() => {})),
        requestDrawerRender: pickFunction(context.requestDrawerRender, getGlobalFunction('requestDrawerRender') || (() => {})),
        requestAIChatRender: pickFunction(context.requestAIChatRender, getGlobalFunction('requestAIChatRender') || (() => {})),
        writeRecoverySnapshotNow: pickFunction(context.writeRecoverySnapshotNow, getGlobalFunction('writeRecoverySnapshotNow') || (() => {})),
        markUserEditingActivity: pickFunction(context.markUserEditingActivity, getGlobalFunction('markUserEditingActivity') || (() => {})),
        stampLocalDataRevision: pickFunction(context.stampLocalDataRevision, getGlobalFunction('stampLocalDataRevision') || (() => {})),
        protectRecentCommittedData: pickFunction(context.protectRecentCommittedData, getGlobalFunction('protectRecentCommittedData') || (() => {})),
        bumpUISessionLock: pickFunction(context.bumpUISessionLock, getGlobalFunction('bumpUISessionLock') || (() => {})),
        markWebPassivePullFastLane: pickFunction(context.markWebPassivePullFastLane, getGlobalFunction('markWebPassivePullFastLane') || (() => {})),
        emitMorphRuntimeSyncPulse: pickFunction(context.emitMorphRuntimeSyncPulse, getGlobalFunction('emitMorphRuntimeSyncPulse') || (() => {})),
        resolveManagedEditorSyncPayload: pickFunction(context.resolveManagedEditorSyncPayload, getGlobalFunction('resolveManagedEditorSyncPayload') || (() => ({}))),
        normalizeAIChatMessage: pickFunction(context.normalizeAIChatMessage, getGlobalFunction('normalizeAIChatMessage') || ((value) => value)),
        buildLightweightAIChatLocalHistory: pickFunction(context.buildLightweightAIChatLocalHistory, getGlobalFunction('buildLightweightAIChatLocalHistory') || (() => [])),
        ensureCurrentAIChatSession: pickFunction(context.ensureCurrentAIChatSession, getGlobalFunction('ensureCurrentAIChatSession') || (() => null)),
        shouldKeepExistingAIChatSessionTitle: pickFunction(context.shouldKeepExistingAIChatSessionTitle, getGlobalFunction('shouldKeepExistingAIChatSessionTitle') || (() => false)),
        buildAIChatSessionTitle: pickFunction(context.buildAIChatSessionTitle, getGlobalFunction('buildAIChatSessionTitle') || (() => '新对话')),
        isAnyVoiceRunning: pickFunction(context.isAnyVoiceRunning, () => !!(getGlobalValue('detailComposerVoiceState', {})?.running || getGlobalValue('mobileQuickVoiceState', {})?.running || getGlobalValue('aiVoiceState', {})?.running)),
        getExternalReloadGraceMs: pickFunction(context.getExternalReloadGraceMs, getGlobalFunction('getExternalReloadGraceMs') || (() => 0)),
        ensureBootstrapShellState: pickFunction(context.ensureBootstrapShellState, getGlobalFunction('ensureBootstrapShellState') || (() => null)),
        syncAllPluginFacingDataExports: pickFunction(context.syncAllPluginFacingDataExports, getGlobalFunction('syncAllPluginFacingDataExports') || (() => Promise.resolve())),
      };
    }

    return { buildDeps, buildAppPersistDeps };
  }

  root.MorphPersistDepsRuntime = { create };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
