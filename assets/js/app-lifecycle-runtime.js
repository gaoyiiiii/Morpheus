(function initMorphAppLifecycleRuntime() {
  function createAppLifecycleRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function syncAppleHealthFromNativeOnForeground(reason = 'foreground') {
      if (typeof api.hydrateAppleHealthFromNativeOnce !== 'function') return;
      const force = typeof api.isIOSNativeAppRuntime === 'function' ? api.isIOSNativeAppRuntime() === true : false;
      api.hydrateAppleHealthFromNativeOnce({ force, reason });
    }

    function installAppLifecycleHandlers() {
      const win = api.windowRef || window;
      const doc = api.documentRef || document;
      if (!win || !doc || typeof api.runStartupTask !== 'function') return;
      win.addEventListener('hashchange', () => {
        api.runStartupTask('hashchange:handleRoute', () => api.handleRoute?.());
      });
      win.addEventListener('resize', () => {
        api.runStartupTask('resize:applyMobileNavigationMode', () => api.applyMobileNavigationMode());
        api.runStartupTask('resize:syncMobileQuickComposeButton', () => api.syncMobileQuickComposeButton());
        api.runStartupTask('resize:syncDesktopBottomOverlayClearance', () => api.syncDesktopBottomOverlayClearance());
        api.runStartupTask('resize:renderHealthVoiceUI', () => api.renderHealthVoiceUI());
        api.runStartupTask('resize:scheduleThoughtCardMasonryLayout', () => api.scheduleThoughtCardMasonryLayout());
      });
      if (win.visualViewport) {
        win.visualViewport.addEventListener('resize', () => {
          api.runStartupTask('visualViewport:syncMobileKeyboardFollowPosition', () => api.syncMobileKeyboardFollowPosition());
        });
        win.visualViewport.addEventListener('scroll', () => {
          if (doc.documentElement.classList.contains('ios-native-app') && api.shouldTrackMobileKeyboard()) {
            return;
          }
          api.runStartupTask('visualViewportScroll:syncMobileKeyboardFollowPosition', () => api.syncMobileKeyboardFollowPosition());
        });
      }
      doc.addEventListener('pointerdown', () => {
        if (typeof api.handleStartupBlockerPointerDown === 'function') {
          api.handleStartupBlockerPointerDown();
        } else if (typeof api.hideStartupBlockers === 'function' && (win.__MorphAppBootState === 'ready' || win.__LianXingAppBootState === 'ready')) {
          api.hideStartupBlockers(true);
        }
      }, true);
      doc.addEventListener('visibilitychange', () => {
        if (doc.visibilityState === 'visible') {
          api.runStartupTask('visible:triggerForegroundSyncRefresh', () => api.triggerForegroundSyncRefresh?.('visible'));
          api.runStartupTask('visible:proactiveAgentSchedulerTick', () => api.proactiveAgentSchedulerTick());
          api.runStartupTask('visible:reminderSchedulerTick', () => api.reminderSchedulerTick());
          api.runStartupTask('visible:runReminderLanSyncOnce', () => api.runReminderLanSyncOnce({ reason: 'visible' }));
          api.runStartupTask(
            api.isIOSNativeAppRuntime() ? 'visible:hydrateGlucoseSyncFromNativeOnce' : 'visible:hydrateGlucoseSyncFromLocalApiOnce',
            () => (api.isIOSNativeAppRuntime()
              ? api.hydrateGlucoseSyncFromNativeOnce({ force: false })
              : api.hydrateGlucoseSyncFromLocalApiOnce({ force: false }))
          );
          api.runStartupTask('visible:hydrateAppleHealthFromNativeOnce', () => syncAppleHealthFromNativeOnForeground('visible'));
          api.runStartupTask('visible:scheduleChannelOpsSync', () => api.scheduleChannelOpsSync('visible', { immediate: true, minGapMs: 0 }));
        }
        if (doc.visibilityState === 'hidden') {
          api.runStartupTask('hidden:flushActiveManagedEditorToCanonicalData', () => api.flushActiveManagedEditorToCanonicalData?.({ immediatePersist: true }));
          api.runStartupTask('hidden:writeRecoverySnapshotNow', () => api.writeRecoverySnapshotNow());
          api.runStartupTask('hidden:flushPersistData', () => api.flushPersistData());
        }
      });
      win.addEventListener('pageshow', () => {
        api.runStartupTask('pageshow:triggerForegroundSyncRefresh', () => api.triggerForegroundSyncRefresh?.('pageshow'));
        api.runStartupTask('pageshow:hydrateAppleHealthFromNativeOnce', () => syncAppleHealthFromNativeOnForeground('pageshow'));
      });
      doc.addEventListener('freeze', () => {
        api.runStartupTask('freeze:flushActiveManagedEditorToCanonicalData', () => api.flushActiveManagedEditorToCanonicalData?.({ immediatePersist: true }));
        api.runStartupTask('freeze:writeRecoverySnapshotNow', () => api.writeRecoverySnapshotNow());
        api.runStartupTask('freeze:flushPersistData', () => api.flushPersistData());
      });
      win.addEventListener('focus', () => {
        api.runStartupTask('focus:triggerForegroundSyncRefresh', () => api.triggerForegroundSyncRefresh?.('focus'));
        api.runStartupTask('focus:hydrateAppleHealthFromNativeOnce', () => syncAppleHealthFromNativeOnForeground('focus'));
        api.runStartupTask('focus:scheduleChannelOpsSync', () => api.scheduleChannelOpsSync('focus', { immediate: false, minGapMs: 0 }));
      });
      win.addEventListener('pagehide', () => {
        api.runStartupTask('pagehide:flushActiveManagedEditorToCanonicalData', () => api.flushActiveManagedEditorToCanonicalData?.({ immediatePersist: true }));
        api.runStartupTask('pagehide:writeRecoverySnapshotNow', () => api.writeRecoverySnapshotNow());
        api.runStartupTask('pagehide:flushPersistData', () => api.flushPersistData());
        api.runStartupTask('pagehide:flushLocalCacheWriteNow', () => api.flushLocalCacheWriteNow?.());
      });
      win.addEventListener('beforeunload', () => {
        api.runStartupTask('beforeunload:flushActiveManagedEditorToCanonicalData', () => api.flushActiveManagedEditorToCanonicalData?.({ immediatePersist: true }));
        api.runStartupTask('beforeunload:writeRecoverySnapshotNow', () => api.writeRecoverySnapshotNow());
        api.runStartupTask('beforeunload:flushLocalCacheWriteNow', () => api.flushLocalCacheWriteNow?.());
      });
    }

    return {
      installAppLifecycleHandlers,
    };
  }

  window.MorphAppLifecycleRuntime = { create: createAppLifecycleRuntime };
})();
