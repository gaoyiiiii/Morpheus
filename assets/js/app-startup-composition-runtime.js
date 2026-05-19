(function initMorphAppStartupCompositionRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphAppStartupCompositionRuntime && typeof window.MorphAppStartupCompositionRuntime.create === 'function';
  const hasDepsRuntime = window.MorphAppStartupCompositionDepsRuntime && typeof window.MorphAppStartupCompositionDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createAppStartupCompositionRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    let startupCompositionStarted = false;

    function recordError(err, label = '') {
      try {
        if (typeof api.recordMorphBootError === 'function') {
          api.recordMorphBootError(err, label);
        }
      } catch (_) {}
    }

    function runStartupTask(label, fn) {
      try {
        return typeof fn === 'function' ? fn() : undefined;
      } catch (err) {
        console.error(`[Morpheus startup] ${label} failed`, err);
        recordError(err, label);
        return undefined;
      }
    }

    function scheduleDeferredStartupTask(label, fn, delay = 0) {
      setTimeout(() => {
        runStartupTask(label, fn);
      }, Math.max(0, Number(delay) || 0));
    }

    function getBackgroundBootDelayMs() {
      try {
        if (typeof api.getBackgroundBootDelayMs === 'function') {
          return Math.max(0, Number(api.getBackgroundBootDelayMs()) || 0);
        }
      } catch (_) {}
      return Math.max(0, Number(api.backgroundBootDelayMs) || 0);
    }

    function startStartupComposition() {
      if (startupCompositionStarted) return;
      startupCompositionStarted = true;
      const backgroundBootDelayMs = getBackgroundBootDelayMs();

      runStartupTask('initSidebarUI', () => api.initSidebarUI?.());
      runStartupTask('initMobileSidebarToggleBinding', () => api.initMobileSidebarToggleBinding?.());
      scheduleDeferredStartupTask('applySyncedUserPreferencesOnBoot', () => api.applySyncedUserPreferencesFromData?.({ render: false }), 120);
      scheduleDeferredStartupTask('bootstrapSyncedUserPreferences', () => api.syncStableUserPreferencesSoon?.('bootstrap'), 180);
      scheduleDeferredStartupTask('bootstrapDesktopManagedCodexProvider', () => {
        if (typeof api.bootstrapDesktopManagedCodexProvider !== 'function') return;
        api.bootstrapDesktopManagedCodexProvider().catch((err) => {
          console.warn('[Morpheus startup] bootstrapDesktopManagedCodexProvider failed', err);
        });
      }, 220);
      scheduleDeferredStartupTask('primeNativeIOSCodexDefaults', () => {
        try {
          api.primeNativeIOSCodexDefaults?.();
        } catch (err) {
          console.warn('[Morpheus startup] primeNativeIOSCodexDefaults failed', err);
        }
      }, 240);
      scheduleDeferredStartupTask('maybeAutoEnableExtensionsFromExistingState', () => api.maybeAutoEnableExtensionsFromExistingState?.(), 200);
      runStartupTask('syncExtensionVisibility', () => api.syncExtensionVisibility?.());
      scheduleDeferredStartupTask('syncExperimentalFeatureVisibility', () => api.syncExperimentalFeatureVisibility?.(), 220);
      runStartupTask('consumeCodexRemoteBootstrapFromUrl', () => api.consumeCodexRemoteBootstrapFromUrl?.());
      runStartupTask('handleRoute', () => api.handleRoute?.());
      scheduleDeferredStartupTask('enforceExplicitHashRouteVisibility:boot', () => api.enforceExplicitHashRouteVisibility?.({ source: 'startup:boot' }), 180);
      scheduleDeferredStartupTask('enforceExplicitHashRouteVisibility:late-boot', () => api.enforceExplicitHashRouteVisibility?.({ source: 'startup:late-boot' }), 960);
      scheduleDeferredStartupTask('pushUndoSnapshot', () => api.pushUndoSnapshot?.(), 280);
      scheduleDeferredStartupTask('bootstrapSelectedBrowserSyncRoot', () => {
        if (typeof api.bootstrapSelectedBrowserSyncRoot !== 'function') return;
        api.bootstrapSelectedBrowserSyncRoot().catch((err) => {
          console.warn('[Morpheus startup] bootstrapSelectedBrowserSyncRoot failed', err);
        });
      }, 340);
      scheduleDeferredStartupTask('renderHomeVoiceUI', () => api.renderHomeVoiceUI?.(), 220);
      scheduleDeferredStartupTask('renderHealthVoiceUI', () => api.renderHealthVoiceUI?.(), 260);
      runStartupTask('applyMobileNavigationMode', () => api.applyMobileNavigationMode?.());
      setTimeout(() => {
        runStartupTask('initGalaxyCanvas', () => api.initGalaxyCanvas?.());
        runStartupTask('drawNetworkLinks', () => api.drawNetworkLinks?.());
      }, backgroundBootDelayMs);
      setTimeout(() => {
        runStartupTask('startNativePassivePull', () => api.startNativePassivePull?.());
      }, backgroundBootDelayMs + 120);
      setTimeout(() => {
        runStartupTask('startRuntimeSyncPulseBridge', () => api.startRuntimeSyncPulseBridge?.());
      }, backgroundBootDelayMs + 150);
      setTimeout(() => {
        runStartupTask('startServerSyncEventStream', () => api.startServerSyncEventStream?.());
      }, backgroundBootDelayMs + 165);
      setTimeout(() => {
        runStartupTask('startWebPassivePull', () => api.startWebPassivePull?.());
      }, backgroundBootDelayMs + 180);
      scheduleDeferredStartupTask('restartDailyAlignScheduler', () => api.restartDailyAlignScheduler?.(), 500);
      scheduleDeferredStartupTask('restartProactiveAgentScheduler', () => api.restartProactiveAgentScheduler?.(), 520);
      scheduleDeferredStartupTask('restartReminderScheduler', () => api.restartReminderScheduler?.(), 540);
      scheduleDeferredStartupTask('restartReminderLanSyncScheduler', () => api.restartReminderLanSyncScheduler?.(), 560);
      scheduleDeferredStartupTask('restartGlucoseSyncHydrationScheduler', () => api.restartGlucoseSyncHydrationScheduler?.(), 580);
      scheduleDeferredStartupTask('restartAppleHealthSyncScheduler', () => api.restartAppleHealthSyncScheduler?.(), 600);
      scheduleDeferredStartupTask('bootstrapExtensionCompatibility', () => api.bootstrapExtensionCompatibility?.(), 620);
      setTimeout(() => {
        runStartupTask('syncAllPluginFacingDataExports', () => api.syncAllPluginFacingDataExports?.());
      }, backgroundBootDelayMs + 240);
      setTimeout(() => {
        runStartupTask('ensureNativeSchedulesForPendingReminders', () => api.ensureNativeSchedulesForPendingReminders?.());
      }, 1800);
      if (typeof api.installAppLifecycleHandlers === 'function') {
        api.installAppLifecycleHandlers();
      }
      runStartupTask('resizeComposerTextarea:omni', () => api.resizeComposerTextarea?.(document.getElementById('omni-input'), 132));
      runStartupTask('resizeComposerTextarea:mobile', () => api.resizeComposerTextarea?.(document.getElementById('mobile-detail-input'), 120));
      runStartupTask('syncComposerLayoutState', () => api.syncComposerLayoutState?.('all'));
      runStartupTask('syncDesktopBottomOverlayClearance', () => api.syncDesktopBottomOverlayClearance?.());
      scheduleDeferredStartupTask('focusOmniInputSoon', () => api.focusOmniInputSoon?.(300), 420);
      const bootstrapState = typeof api.ensureBootstrapShellState === 'function'
        ? api.ensureBootstrapShellState()
        : null;
      const shouldHydrateLocalCacheFallback = typeof api.shouldHydrateAfterLocalCacheFallback === 'function'
        ? api.shouldHydrateAfterLocalCacheFallback() === true
        : false;
      if ((bootstrapState?.bootLoadedFromStartupSnapshot === true) || shouldHydrateLocalCacheFallback) {
        setTimeout(() => {
          runStartupTask('hydrateFullDataAfterStartup', () => api.hydrateFullDataAfterStartup?.());
        }, Math.max(260, backgroundBootDelayMs + 120));
      }
      if (typeof api.dismissStartupSkeleton === 'function') {
        api.dismissStartupSkeleton(0);
      }
    }

    return {
      runStartupTask,
      scheduleDeferredStartupTask,
      startStartupComposition,
    };
  }

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createAppStartupCompositionDepsRuntime() {
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || window;
    const getGlobalFunction = (name = '') => {
      const key = String(name || '').trim();
      if (!key) return null;
      const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
      if (typeof fromGlobal === 'function') return fromGlobal;
      const fromWindow = typeof window[key] === 'function' ? window[key] : null;
      return typeof fromWindow === 'function' ? fromWindow : null;
    };
    const getGlobalValue = (name = '', fallback = null) => {
      const key = String(name || '').trim();
      if (!key) return fallback;
      if (globalRoot && typeof globalRoot[key] !== 'undefined') return globalRoot[key];
      if (typeof window[key] !== 'undefined') return window[key];
      return fallback;
    };

    function buildAppDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        getBackgroundBootDelayMs: pickFunction(context.getBackgroundBootDelayMs, () => Number(getGlobalValue('PERF', {})?.backgroundBootDelayMs || 0)),
        recordMorphBootError: pickFunction(context.recordMorphBootError, getGlobalFunction('recordMorphBootError') || (() => {})),
        initSidebarUI: pickFunction(context.initSidebarUI, getGlobalFunction('initSidebarUI') || (() => {})),
        initMobileSidebarToggleBinding: pickFunction(context.initMobileSidebarToggleBinding, getGlobalFunction('initMobileSidebarToggleBinding') || (() => {})),
        applySyncedUserPreferencesFromData: pickFunction(context.applySyncedUserPreferencesFromData, getGlobalFunction('applySyncedUserPreferencesFromData') || (() => {})),
        syncStableUserPreferencesSoon: pickFunction(context.syncStableUserPreferencesSoon, getGlobalFunction('syncStableUserPreferencesSoon') || (() => {})),
        bootstrapDesktopManagedCodexProvider: pickFunction(context.bootstrapDesktopManagedCodexProvider, getGlobalFunction('bootstrapDesktopManagedCodexProvider') || (() => Promise.resolve())),
        primeNativeIOSCodexDefaults: pickFunction(context.primeNativeIOSCodexDefaults, getGlobalFunction('primeNativeIOSCodexDefaults') || (() => {})),
        maybeAutoEnableExtensionsFromExistingState: pickFunction(context.maybeAutoEnableExtensionsFromExistingState, getGlobalFunction('maybeAutoEnableExtensionsFromExistingState') || (() => {})),
        syncExtensionVisibility: pickFunction(context.syncExtensionVisibility, getGlobalFunction('syncExtensionVisibility') || (() => {})),
        syncExperimentalFeatureVisibility: pickFunction(context.syncExperimentalFeatureVisibility, getGlobalFunction('syncExperimentalFeatureVisibility') || (() => {})),
        consumeCodexRemoteBootstrapFromUrl: pickFunction(context.consumeCodexRemoteBootstrapFromUrl, getGlobalFunction('consumeCodexRemoteBootstrapFromUrl') || (() => {})),
        handleRoute: pickFunction(context.handleRoute, getGlobalFunction('handleRoute') || (() => {})),
        pushUndoSnapshot: pickFunction(context.pushUndoSnapshot, getGlobalFunction('pushUndoSnapshot') || (() => {})),
        bootstrapSelectedBrowserSyncRoot: pickFunction(context.bootstrapSelectedBrowserSyncRoot, getGlobalFunction('bootstrapSelectedBrowserSyncRoot') || (() => Promise.resolve())),
        renderHomeVoiceUI: pickFunction(context.renderHomeVoiceUI, getGlobalFunction('renderHomeVoiceUI') || (() => {})),
        renderHealthVoiceUI: pickFunction(context.renderHealthVoiceUI, getGlobalFunction('renderHealthVoiceUI') || (() => {})),
        applyMobileNavigationMode: pickFunction(context.applyMobileNavigationMode, getGlobalFunction('applyMobileNavigationMode') || (() => {})),
        initGalaxyCanvas: pickFunction(context.initGalaxyCanvas, getGlobalFunction('initGalaxyCanvas') || (() => {})),
        drawNetworkLinks: pickFunction(context.drawNetworkLinks, getGlobalFunction('drawNetworkLinks') || (() => {})),
        startNativePassivePull: pickFunction(context.startNativePassivePull, getGlobalFunction('startNativePassivePull') || (() => {})),
        startRuntimeSyncPulseBridge: pickFunction(context.startRuntimeSyncPulseBridge, getGlobalFunction('startRuntimeSyncPulseBridge') || (() => {})),
        startServerSyncEventStream: pickFunction(context.startServerSyncEventStream, getGlobalFunction('startServerSyncEventStream') || (() => {})),
        startWebPassivePull: pickFunction(context.startWebPassivePull, getGlobalFunction('startWebPassivePull') || (() => {})),
        restartDailyAlignScheduler: pickFunction(context.restartDailyAlignScheduler, getGlobalFunction('restartDailyAlignScheduler') || (() => {})),
        restartProactiveAgentScheduler: pickFunction(context.restartProactiveAgentScheduler, getGlobalFunction('restartProactiveAgentScheduler') || (() => {})),
        restartReminderScheduler: pickFunction(context.restartReminderScheduler, getGlobalFunction('restartReminderScheduler') || (() => {})),
        restartReminderLanSyncScheduler: pickFunction(context.restartReminderLanSyncScheduler, getGlobalFunction('restartReminderLanSyncScheduler') || (() => {})),
        restartGlucoseSyncHydrationScheduler: pickFunction(context.restartGlucoseSyncHydrationScheduler, getGlobalFunction('restartGlucoseSyncHydrationScheduler') || (() => {})),
        restartAppleHealthSyncScheduler: pickFunction(context.restartAppleHealthSyncScheduler, getGlobalFunction('restartAppleHealthSyncScheduler') || (() => {})),
        bootstrapExtensionCompatibility: pickFunction(context.bootstrapExtensionCompatibility, getGlobalFunction('bootstrapExtensionCompatibility') || (() => {})),
        syncAllPluginFacingDataExports: pickFunction(context.syncAllPluginFacingDataExports, getGlobalFunction('syncAllPluginFacingDataExports') || (() => Promise.resolve())),
        ensureNativeSchedulesForPendingReminders: pickFunction(context.ensureNativeSchedulesForPendingReminders, getGlobalFunction('ensureNativeSchedulesForPendingReminders') || (() => {})),
        resizeComposerTextarea: pickFunction(context.resizeComposerTextarea, getGlobalFunction('resizeComposerTextarea') || (() => {})),
        syncComposerLayoutState: pickFunction(context.syncComposerLayoutState, getGlobalFunction('syncComposerLayoutState') || (() => {})),
        syncDesktopBottomOverlayClearance: pickFunction(context.syncDesktopBottomOverlayClearance, getGlobalFunction('syncDesktopBottomOverlayClearance') || (() => {})),
        focusOmniInputSoon: pickFunction(context.focusOmniInputSoon, getGlobalFunction('focusOmniInputSoon') || (() => {})),
        enforceExplicitHashRouteVisibility: pickFunction(context.enforceExplicitHashRouteVisibility, getGlobalFunction('enforceExplicitHashRouteVisibility') || (() => false)),
        hydrateFullDataAfterStartup: pickFunction(context.hydrateFullDataAfterStartup, getGlobalFunction('hydrateFullDataAfterStartup') || (() => {})),
        shouldHydrateAfterLocalCacheFallback: pickFunction(context.shouldHydrateAfterLocalCacheFallback, getGlobalFunction('shouldHydrateAfterLocalCacheFallback') || (() => false)),
        ensureBootstrapShellState: pickFunction(context.ensureBootstrapShellState, getGlobalFunction('ensureBootstrapShellState') || (() => null)),
        installAppLifecycleHandlers: pickFunction(context.installAppLifecycleHandlers, () => {
          const appLifecycleRuntimeModules = getGlobalValue('appLifecycleRuntimeModules', null);
          if (appLifecycleRuntimeModules && typeof appLifecycleRuntimeModules.installAppLifecycleHandlers === 'function') {
            appLifecycleRuntimeModules.installAppLifecycleHandlers();
          }
        }),
        dismissStartupSkeleton: pickFunction(context.dismissStartupSkeleton, getGlobalFunction('dismissStartupSkeleton') || (() => {})),
      };
    }

    return { buildAppDeps };
  }

  window.MorphAppStartupCompositionRuntime = { create: createAppStartupCompositionRuntime };
  window.MorphAppStartupCompositionDepsRuntime = { create: createAppStartupCompositionDepsRuntime };
})();
