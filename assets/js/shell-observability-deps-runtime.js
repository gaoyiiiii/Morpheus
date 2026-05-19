// @ts-check

(function initMorphShellObservabilityDepsRuntime(root) {
  if (!root) return;
  if (root.MorphShellObservabilityDepsRuntime && typeof root.MorphShellObservabilityDepsRuntime.create === 'function') return;

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function create() {
    function buildStartupStorageDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        hasAnyUserData: pickFunction(context.hasAnyUserData, () => false),
        canTrustPersistedNativeDataSnapshot: pickFunction(context.canTrustPersistedNativeDataSnapshot, () => false),
      };
    }

    function buildShellDescriptorDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        getSettingsState: pickFunction(context.getSettingsState, () => ({})),
        getCurrentDataSyncMeta: pickFunction(context.getCurrentDataSyncMeta, () => ({})),
        getStartupStorageDescriptor: pickFunction(context.getStartupStorageDescriptor, () => null),
        readBootstrapShellDescriptor: pickFunction(context.readBootstrapShellDescriptor, () => null),
        getWebSyncRootMeta: pickFunction(context.getWebSyncRootMeta, () => null),
        readLastSyncReceipt: pickFunction(context.readLastSyncReceipt, () => null),
        getSyncMutationState: pickFunction(context.getSyncMutationState, () => null),
        getLastSyncAt: pickFunction(context.getLastSyncAt, () => ''),
        getLocationProtocol: pickFunction(context.getLocationProtocol, () => ''),
        hasNativeControlBridge: pickFunction(context.hasNativeControlBridge, () => false),
        hasNativeSyncBridge: pickFunction(context.hasNativeSyncBridge, () => false),
        hasNativeSpeechBridge: pickFunction(context.hasNativeSpeechBridge, () => false),
        isRunningInNativeDesktopShell: pickFunction(context.isRunningInNativeDesktopShell, () => false),
        isRunningInNativeIOSShell: pickFunction(context.isRunningInNativeIOSShell, () => false),
        notificationsSupported: pickFunction(context.notificationsSupported, () => false),
        pushTokenAvailable: pickFunction(context.pushTokenAvailable, () => false),
        callNativeDesktopControl: pickFunction(context.callNativeDesktopControl, () => Promise.reject(new Error('native_control_unavailable'))),
        writeMorphNativeSyncRootCache: pickFunction(context.writeMorphNativeSyncRootCache, () => {}),
        syncAllPluginFacingDataExports: pickFunction(context.syncAllPluginFacingDataExports, () => Promise.resolve()),
      };
    }

    function buildObservabilityDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        shouldShowDebugStatus: pickFunction(context.shouldShowDebugStatus, () => false),
        getData: pickFunction(context.getData, () => null),
        getShellDescriptor: pickFunction(context.getShellDescriptor, () => null),
        getWebSyncRootMeta: pickFunction(context.getWebSyncRootMeta, () => null),
        readLastSyncReceipt: pickFunction(context.readLastSyncReceipt, () => null),
        getSyncMutationState: pickFunction(context.getSyncMutationState, () => null),
        buildMemoryHealthStatusSummary: pickFunction(context.buildMemoryHealthStatusSummary, () => ''),
        getMemoryHealthReport: pickFunction(context.getMemoryHealthReport, () => null),
        getTaskRuntimeState: pickFunction(context.getTaskRuntimeState, () => null),
        getActionTransactions: pickFunction(context.getActionTransactions, () => []),
        getUndoDebugState: pickFunction(context.getUndoDebugState, () => null),
        getThoughtGraphKeyboardDebugState: pickFunction(context.getThoughtGraphKeyboardDebugState, () => null),
        buildCurrentViewSnapshot: pickFunction(context.buildCurrentViewSnapshot, () => null),
        describeCurrentBootPhase: pickFunction(context.describeCurrentBootPhase, () => ''),
        getLastMorphActionTransaction: pickFunction(context.getLastMorphActionTransaction, () => null),
        readRecentAIRequestMetrics: pickFunction(context.readRecentAIRequestMetrics, () => []),
        getAIChatHistoryDebugState: pickFunction(context.getAIChatHistoryDebugState, () => null),
        getStableMemoryDebugState: pickFunction(context.getStableMemoryDebugState, () => null),
      };
    }

    return {
      buildStartupStorageDeps,
      buildShellDescriptorDeps,
      buildObservabilityDeps,
    };
  }

  root.MorphShellObservabilityDepsRuntime = { create };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
