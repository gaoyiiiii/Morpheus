(function initMorphAppPersistRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphPersistRuntime && typeof window.MorphPersistRuntime.create === 'function') return;

  function createAppPersistRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const state = {
      pendingRecoveryTimer: null,
      pendingRecoveryMaxTimer: null,
      pendingPersistTimer: null,
      pendingPersistMaxTimer: null,
      pendingPersistDeferredSince: 0,
      pendingPersistDomains: new Set(),
      pendingPersistEntityRefs: [],
      lastPersistFlushAt: 0,
      managedEditorTypingSyncTimers: new Map(),
      managedEditorTypingLastAt: new Map(),
      managedEditorTypingFirstPendingAt: new Map(),
      managedEditorBlurPersistSuppressedUntil: 0,
      pendingPostPersistTasks: [],
    };

    function getPerf() {
      return api.getPerf && typeof api.getPerf === 'object'
        ? api.getPerf
        : (typeof api.getPerf === 'function' ? api.getPerf() : {});
    }

    function getStorage() {
      return typeof api.getStorage === 'function' ? api.getStorage() : null;
    }

    function getData() {
      return typeof api.getData === 'function' ? api.getData() : null;
    }

    function setData(value) {
      if (typeof api.setData === 'function') api.setData(value);
    }

    function getAIChatState() {
      return typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
    }

    function getCurrentTab() {
      return typeof api.getCurrentTab === 'function' ? api.getCurrentTab() : 'flashThoughts';
    }

    function isStartupHydrationInFlight() {
      const bootstrapState = typeof api.ensureBootstrapShellState === 'function'
        ? api.ensureBootstrapShellState()
        : null;
      return !!(
        bootstrapState
        && bootstrapState.bootLoadedFromStartupSnapshot === true
        && bootstrapState.startupHydrationSettled !== true
      );
    }

    function markUserEditingActivity() {
      if (typeof api.markUserEditingActivity === 'function') {
        api.markUserEditingActivity();
      }
    }

    function stampLocalDataRevision() {
      if (typeof api.stampLocalDataRevision === 'function') {
        api.stampLocalDataRevision();
      }
    }

    function getActiveManagedEditorNode() {
      return typeof api.getActiveManagedEditorNode === 'function' ? api.getActiveManagedEditorNode() : null;
    }

    function isUserEditComposeActive() {
      return typeof api.isUserEditComposeActive === 'function' ? !!api.isUserEditComposeActive() : false;
    }

    function isDrawerOpen() {
      return typeof api.isDrawerOpen === 'function' ? !!api.isDrawerOpen() : false;
    }

    function getIsVersionedEditorContext(context = '') {
      return typeof api.isVersionedEditorContext === 'function' ? !!api.isVersionedEditorContext(context) : false;
    }

    function getResolvedManagedEditorSyncPayload(context = '', contextId = '') {
      if (typeof api.resolveManagedEditorSyncPayload === 'function') {
        return api.resolveManagedEditorSyncPayload(context, contextId);
      }
      return {};
    }

    function clearManagedEditorTypingSync(context = '', contextId = '') {
      const key = `${String(context || '').trim()}::${String(contextId || '').trim()}`;
      const timer = state.managedEditorTypingSyncTimers.get(key);
      if (timer) clearTimeout(timer);
      state.managedEditorTypingSyncTimers.delete(key);
      state.managedEditorTypingLastAt.delete(key);
      state.managedEditorTypingFirstPendingAt.delete(key);
    }

    function suppressManagedEditorBlurPersist(durationMs = 900) {
      state.managedEditorBlurPersistSuppressedUntil = Math.max(
        state.managedEditorBlurPersistSuppressedUntil,
        Date.now() + Math.max(120, Number(durationMs) || 0)
      );
    }

    function shouldDeferManagedEditorPersistFlush() {
      return isUserEditComposeActive();
    }

    function scheduleRecoverySnapshot(options = {}) {
      const debounceMs = Math.max(120, Number(options.debounceMs) || 260);
      const maxLagMs = Math.max(debounceMs, Number(options.maxLagMs) || 1200);
      clearTimeout(state.pendingRecoveryTimer);
      state.pendingRecoveryTimer = setTimeout(() => {
        clearTimeout(state.pendingRecoveryMaxTimer);
        state.pendingRecoveryTimer = null;
        state.pendingRecoveryMaxTimer = null;
        if (typeof api.writeRecoverySnapshotNow === 'function') {
          api.writeRecoverySnapshotNow();
        }
      }, debounceMs);
      if (!state.pendingRecoveryMaxTimer) {
        state.pendingRecoveryMaxTimer = setTimeout(() => {
          clearTimeout(state.pendingRecoveryTimer);
          state.pendingRecoveryTimer = null;
          state.pendingRecoveryMaxTimer = null;
          if (typeof api.writeRecoverySnapshotNow === 'function') {
            api.writeRecoverySnapshotNow();
          }
        }, maxLagMs);
      }
    }

    function hasPendingLocalPersist() {
      return !!state.pendingPersistTimer || !!state.pendingPersistMaxTimer;
    }

    function normalizePersistDomains(domains = []) {
      const expand = typeof api.expandMorphSyncDomains === 'function'
        ? api.expandMorphSyncDomains
        : (list) => Array.isArray(list) ? list : [];
      return expand(domains);
    }

    function mergePersistEntityRefs(prev = [], next = []) {
      if (typeof api.mergeMorphSyncEntityRefs === 'function') {
        return api.mergeMorphSyncEntityRefs(prev, next);
      }
      const list = [];
      const seen = new Set();
      [...(Array.isArray(prev) ? prev : []), ...(Array.isArray(next) ? next : [])].forEach((item) => {
        const key = JSON.stringify(item || {});
        if (seen.has(key)) return;
        seen.add(key);
        list.push(item);
      });
      return list;
    }

    function normalizePostPersistTasks(tasks = []) {
      return (Array.isArray(tasks) ? tasks : [])
        .filter((task) => typeof task === 'function');
    }

    function queuePostPersistTasks(tasks = []) {
      const normalized = normalizePostPersistTasks(tasks);
      if (!normalized.length) return;
      state.pendingPostPersistTasks.push(...normalized);
    }

    function runPostPersistTasks(tasks = []) {
      const normalized = normalizePostPersistTasks(tasks);
      if (!normalized.length) return;
      setTimeout(() => {
        normalized.forEach((task, index) => {
          Promise.resolve()
            .then(() => task())
            .catch((error) => {
              console.warn(`[MorphPersist] post-persist task #${index + 1} failed.`, error);
            });
        });
      }, 0);
    }

    function buildAIChatPersistEntityRefs(session = null) {
      const safeSession = session && typeof session === 'object' ? session : null;
      const sessionId = String(safeSession?.id || '').trim();
      if (!sessionId) return [];
      const sessionTitle = String(safeSession?.title || '').trim().slice(0, 120);
      return [
        {
          domain: 'aiChatSessions',
          entityType: 'ai_chat_session',
          entityId: sessionId,
          action: 'upsert',
          label: sessionTitle,
        },
        {
          domain: 'aiCurrentChatSessionId',
          entityType: 'ai_chat_session_pointer',
          entityId: sessionId,
          action: 'point_to',
          label: sessionTitle,
        },
      ];
    }

    function flushPersistData(options = {}) {
      const immediatePersist = options && options.immediatePersist === true;
      const now = Date.now();
      const persistDeferMaxMs = Math.max(1800, Number(getPerf().typingPersistForceFlushMs) || 12000);
      if (shouldDeferManagedEditorPersistFlush()) {
        if (!state.pendingPersistDeferredSince) state.pendingPersistDeferredSince = now;
        const elapsed = Math.max(0, now - state.pendingPersistDeferredSince);
        if (elapsed < persistDeferMaxMs) {
          clearTimeout(state.pendingPersistTimer);
          state.pendingPersistTimer = setTimeout(() => {
            flushPersistData();
          }, Math.max(420, Number(getPerf().typingPersistDebounceMs) || 520));
          if (!state.pendingPersistMaxTimer) {
            const remainingMs = Math.max(120, persistDeferMaxMs - elapsed);
            state.pendingPersistMaxTimer = setTimeout(() => {
              state.pendingPersistMaxTimer = null;
              flushPersistData();
            }, remainingMs);
          }
          return;
        }
      }
      state.pendingPersistDeferredSince = 0;
      clearTimeout(state.pendingPersistTimer);
      clearTimeout(state.pendingPersistMaxTimer);
      state.pendingPersistTimer = null;
      state.pendingPersistMaxTimer = null;
      clearTimeout(state.pendingRecoveryTimer);
      clearTimeout(state.pendingRecoveryMaxTimer);
      state.pendingRecoveryTimer = null;
      state.pendingRecoveryMaxTimer = null;
      if (typeof api.writeRecoverySnapshotNow === 'function') {
        api.writeRecoverySnapshotNow();
      }
      state.lastPersistFlushAt = Date.now();
      const domains = Array.from(state.pendingPersistDomains);
      state.pendingPersistDomains = new Set();
      const entityRefs = Array.isArray(state.pendingPersistEntityRefs) ? state.pendingPersistEntityRefs.slice() : [];
      state.pendingPersistEntityRefs = [];
      const postPersistTasks = Array.isArray(state.pendingPostPersistTasks) ? state.pendingPostPersistTasks.slice() : [];
      state.pendingPostPersistTasks = [];
      const persistOptions = {};
      if (domains.length) persistOptions.domains = domains;
      if (entityRefs.length) persistOptions.entityRefs = entityRefs;
      const storage = getStorage();
      if (domains.length && typeof api.rememberRecentCommittedDomains === 'function') {
        api.rememberRecentCommittedDomains(domains, getData(), immediatePersist ? 18000 : 12000);
      }
      if (storage && typeof storage.saveData === 'function') {
        const nextPersistOptions = Object.keys(persistOptions).length ? { ...persistOptions } : {};
        if (immediatePersist) nextPersistOptions.immediatePersist = true;
        storage.saveData(getData(), nextPersistOptions);
        if (typeof api.flushLocalCacheWriteNow === 'function') api.flushLocalCacheWriteNow();
        if (typeof api.writeRecoverySnapshotNow === 'function') {
          api.writeRecoverySnapshotNow(null, { referenceLocalCache: true });
        }
      }
      runPostPersistTasks(postPersistTasks);
      if (typeof api.syncAllPluginFacingDataExports === 'function') {
        Promise.resolve()
          .then(() => api.syncAllPluginFacingDataExports())
          .catch((error) => {
            console.warn('[MorphPersist] Plugin-facing mirror sync failed.', error);
          });
      }
      if (typeof api.markWebPassivePullFastLane === 'function') {
        api.markWebPassivePullFastLane(12000);
      }
      if (typeof api.emitMorphRuntimeSyncPulse === 'function') {
        api.emitMorphRuntimeSyncPulse('local-persist', {
          pendingDomains: domains.slice(0, 12),
          revision: typeof api.getDataRevision === 'function' ? api.getDataRevision(getData()) : 0,
        });
      }
    }

    function schedulePersistData(options = {}) {
      if (Array.isArray(options.domains)) {
        normalizePersistDomains(options.domains).forEach((domain) => state.pendingPersistDomains.add(domain));
      }
      if (Array.isArray(options.entityRefs)) {
        state.pendingPersistEntityRefs = mergePersistEntityRefs(state.pendingPersistEntityRefs, options.entityRefs);
      }
      if (Array.isArray(options.postPersistTasks)) {
        queuePostPersistTasks(options.postPersistTasks);
      }
      const debounceMs = Math.max(120, Number(options.debounceMs) || getPerf().persistDebounceMs || 420);
      const maxLagMs = Math.max(debounceMs, Number(options.maxLagMs) || getPerf().persistMaxLagMs || 3600);
      clearTimeout(state.pendingPersistTimer);
      state.pendingPersistTimer = setTimeout(() => {
        flushPersistData();
      }, debounceMs);
      if (!state.pendingPersistMaxTimer) {
        state.pendingPersistMaxTimer = setTimeout(() => {
          flushPersistData();
        }, maxLagMs);
      }
    }

    function saveData(options = {}) {
      markUserEditingActivity();
      stampLocalDataRevision();
      scheduleRecoverySnapshot();
      if (!options.skipUndo) {
        if (options.undoMode === 'typing') {
          if (typeof api.scheduleTypingUndoSnapshot === 'function') {
            api.scheduleTypingUndoSnapshot(options.coalesceKey || '', options.textSample || '');
          }
        } else if (typeof api.pushUndoSnapshot === 'function') {
          api.pushUndoSnapshot();
        }
      }
      const shouldFlushImmediately = options.immediatePersist === true || options.forceFlush === true;
      if (shouldFlushImmediately) {
        if (Array.isArray(options.domains)) {
          normalizePersistDomains(options.domains).forEach((domain) => state.pendingPersistDomains.add(domain));
        }
        if (Array.isArray(options.entityRefs)) {
          state.pendingPersistEntityRefs = mergePersistEntityRefs(state.pendingPersistEntityRefs, options.entityRefs);
        }
        if (Array.isArray(options.postPersistTasks)) {
          queuePostPersistTasks(options.postPersistTasks);
        }
        flushPersistData({ immediatePersist: true });
      } else {
        schedulePersistData({
          debounceMs: getPerf().actionPersistDebounceMs,
          maxLagMs: getPerf().actionPersistMaxLagMs,
          domains: options.domains,
          entityRefs: options.entityRefs,
          postPersistTasks: options.postPersistTasks,
        });
      }
      if (options.skipRender) {
        if (isDrawerOpen() && typeof api.requestDrawerRender === 'function') {
          api.requestDrawerRender();
        }
        return;
      }
      if (typeof api.requestRenderAll === 'function') {
        api.requestRenderAll();
      }
    }

    function scheduleManagedEditorTypingSync(options = {}) {
      const context = String(options.context || '').trim();
      const contextId = String(options.contextId || '').trim();
      if (!context || !contextId) return;
      const key = `${context}::${contextId}`;
      const now = Date.now();
      state.managedEditorTypingLastAt.set(key, now);
      if (!state.managedEditorTypingFirstPendingAt.has(key)) {
        state.managedEditorTypingFirstPendingAt.set(key, now);
      }
      const previousTimer = state.managedEditorTypingSyncTimers.get(key);
      if (previousTimer) clearTimeout(previousTimer);
      const perf = getPerf();
      const delayMs = Math.max(
        1200,
        Number(options.syncIdleMs)
        || Number(perf.typingPersistIdleSyncMs)
        || Number(perf.typingPersistMaxLagMs)
        || 2400
      );
      const forceSyncMs = Math.max(
        delayMs,
        Number(options.syncForceMs)
        || Number(perf.typingPersistForceSyncMs)
        || Math.max(delayMs * 2, 8000)
      );
      const timer = setTimeout(() => {
        state.managedEditorTypingSyncTimers.delete(key);
        const runAt = Date.now();
        const lastTypingAt = Number(state.managedEditorTypingLastAt.get(key) || 0);
        const firstPendingAt = Number(state.managedEditorTypingFirstPendingAt.get(key) || runAt);
        const idleForMs = lastTypingAt > 0 ? Math.max(0, runAt - lastTypingAt) : Number.POSITIVE_INFINITY;
        const pendingForMs = Math.max(0, runAt - firstPendingAt);
        if (
          (isUserEditComposeActive() || isManagedEditorContextActivelyEditing(context, contextId))
          && idleForMs < delayMs
          && pendingForMs < forceSyncMs
        ) {
          scheduleManagedEditorTypingSync({
            ...options,
            syncIdleMs: delayMs,
            syncForceMs: forceSyncMs,
          });
          return;
        }
        state.managedEditorTypingLastAt.delete(key);
        state.managedEditorTypingFirstPendingAt.delete(key);
        saveSilent({
          context,
          contextId,
          skipUndo: true,
          forceDebounce: true,
          deferSyncUntilIdle: false,
          domains: options.domains,
          entityRefs: options.entityRefs,
        });
      }, delayMs);
      state.managedEditorTypingSyncTimers.set(key, timer);
    }

    function isManagedEditorContextActivelyEditing(context = '', contextId = '') {
      const normalizedContext = String(context || '').trim();
      const normalizedContextId = String(contextId || '').trim();
      if (!normalizedContext || !normalizedContextId) return false;
      const active = getActiveManagedEditorNode();
      if (!active || !active.closest) return false;
      const row = active.closest('.block-row');
      if (!row) return false;
      return String(row.dataset.context || '').trim() === normalizedContext
        && String(row.dataset.contextId || '').trim() === normalizedContextId;
    }

    function saveSilent(options = {}) {
      const isTypingSave = options.undoMode === 'typing';
      const isDraftOnly = options.draftOnly === true;
      const shouldImmediatePersist = options.immediatePersist === true && !isTypingSave;
      markUserEditingActivity();
      scheduleRecoverySnapshot(isTypingSave
        ? { debounceMs: getPerf().typingRecoveryDebounceMs, maxLagMs: getPerf().typingRecoveryMaxLagMs }
        : undefined);
      if (!options.skipUndo) {
        if (options.undoMode === 'typing') {
          if (typeof api.scheduleTypingUndoSnapshot === 'function') {
            api.scheduleTypingUndoSnapshot(options.coalesceKey || '', options.textSample || '');
          }
        } else if (typeof api.pushUndoSnapshot === 'function') {
          api.pushUndoSnapshot();
        }
      }
      if (isDraftOnly) {
        return;
      }
      if (isTypingSave && options.deferSyncUntilIdle !== false) {
        // Mark the in-memory snapshot as newer immediately, so passive pull cannot
        // re-apply an older external snapshot while the user is still typing.
        stampLocalDataRevision();
        scheduleManagedEditorTypingSync(options);
        return;
      }
      stampLocalDataRevision();
      if (options.forceDebounce && !shouldImmediatePersist) {
        schedulePersistData(isTypingSave
          ? {
            debounceMs: getPerf().typingPersistDebounceMs,
            maxLagMs: getPerf().typingPersistMaxLagMs,
            domains: options.domains,
            entityRefs: options.entityRefs,
            postPersistTasks: options.postPersistTasks,
          }
          : {
            domains: options.domains,
            entityRefs: options.entityRefs,
            postPersistTasks: options.postPersistTasks,
          });
        return;
      }
      if (options.undoMode !== 'typing') {
        if (Array.isArray(options.domains)) {
          normalizePersistDomains(options.domains).forEach((domain) => state.pendingPersistDomains.add(domain));
        }
        if (Array.isArray(options.entityRefs)) {
          state.pendingPersistEntityRefs = mergePersistEntityRefs(state.pendingPersistEntityRefs, options.entityRefs);
        }
        if (Array.isArray(options.postPersistTasks)) {
          queuePostPersistTasks(options.postPersistTasks);
        }
        flushPersistData({ immediatePersist: shouldImmediatePersist });
        return;
      }
      schedulePersistData({
        debounceMs: getPerf().typingPersistDebounceMs,
        maxLagMs: getPerf().typingPersistMaxLagMs,
        domains: options.domains,
        entityRefs: options.entityRefs,
        postPersistTasks: options.postPersistTasks,
      });
    }

    function resolveManagedEditorSyncPayload(context = '', contextId = '') {
      const injectedPayload = getResolvedManagedEditorSyncPayload(context, contextId);
      if (injectedPayload && typeof injectedPayload === 'object') {
        const hasDomains = Array.isArray(injectedPayload.domains) && injectedPayload.domains.length > 0;
        const hasEntityRefs = Array.isArray(injectedPayload.entityRefs) && injectedPayload.entityRefs.length > 0;
        if (hasDomains || hasEntityRefs) return injectedPayload;
      }
      const normalizedContext = String(context || '').trim();
      const normalizedContextId = String(contextId || '').trim();
      if (!normalizedContext || !normalizedContextId) return {};
      if (normalizedContext === 'daily') {
        return {
          domains: ['daily'],
          entityRefs: [{ domain: 'daily', type: 'dailyMonth', id: normalizedContextId }],
        };
      }
      if (normalizedContext === 'project') {
        const project = (() => {
          const dataRoot = getData();
          const projects = Array.isArray(dataRoot?.projects) ? dataRoot.projects : [];
          return projects.find((item) => String(item?.id || '').trim() === normalizedContextId) || null;
        })();
        const linkedFixedThought = typeof api.findLinkedFixedThoughtForProject === 'function'
          ? api.findLinkedFixedThoughtForProject(project)
          : null;
        if (linkedFixedThought && String(linkedFixedThought?.id || '').trim()) {
          return {
            domains: ['projects', 'thoughts'],
            entityRefs: [
              { domain: 'projects', type: 'project', id: normalizedContextId },
              { domain: 'thoughts', type: 'fixedThought', id: String(linkedFixedThought.id || '').trim() },
            ],
          };
        }
        return {
          domains: ['projects'],
          entityRefs: [{ domain: 'projects', type: 'project', id: normalizedContextId }],
        };
      }
      if (normalizedContext === 'routine') {
        return {
          domains: ['routines'],
          entityRefs: [{ domain: 'routines', type: 'routine', id: normalizedContextId }],
        };
      }
      return {};
    }

    function persistManagedEditorState(context = '', contextId = '', options = {}) {
      if (!options?.allowDuringSuppressedBlur && Date.now() < state.managedEditorBlurPersistSuppressedUntil) {
        return;
      }
      if (context === 'atlasDoc') {
        const bridge = window.AtlasDocBridge;
        if (bridge && typeof bridge.scheduleSave === 'function') {
          bridge.scheduleSave(contextId, options);
        }
        return;
      }
      const syncPayload = resolveManagedEditorSyncPayload(context, contextId);
      const mergedOptions = {
        context: String(context || '').trim(),
        contextId: String(contextId || '').trim(),
        ...syncPayload,
        ...(options && typeof options === 'object' ? options : {}),
      };
      if (mergedOptions?.undoMode !== 'typing') {
        clearManagedEditorTypingSync(context, contextId);
      }
      const isVersionedTyping = mergedOptions?.undoMode === 'typing' && getIsVersionedEditorContext(context);
      const nextOptions = isVersionedTyping
        ? { ...mergedOptions, skipUndo: true, draftOnly: mergedOptions?.draftOnly !== false }
        : mergedOptions;
      saveSilent(nextOptions);
    }

    function shouldDeferExternalReload() {
      const now = Date.now();
      if (isStartupHydrationInFlight()) return true;
      if (typeof api.getUiSessionLockUntil === 'function' && now < api.getUiSessionLockUntil()) return true;
      if (typeof api.getRecentCommittedDataFreezeUntil === 'function' && now < api.getRecentCommittedDataFreezeUntil()) return true;
      if (isUserEditComposeActive()) return true;
      if (hasPendingLocalPersist()) return true;
      if (typeof api.hasProtectedDrafts === 'function' && api.hasProtectedDrafts()) return true;
      const aiChatState = getAIChatState();
      if (aiChatState?.busy) return true;
      if (typeof api.isAnyVoiceRunning === 'function' && api.isAnyVoiceRunning()) return true;
      if (now - state.lastPersistFlushAt < 3500) return true;
      if (typeof api.getLastUserEditAt === 'function' && now - api.getLastUserEditAt() < (typeof api.getExternalReloadGraceMs === 'function' ? api.getExternalReloadGraceMs() : 15000)) return true;
      return false;
    }

    function shouldPausePassivePull() {
      const now = Date.now();
      if (isStartupHydrationInFlight()) return true;
      if (typeof api.getUiSessionLockUntil === 'function' && now < api.getUiSessionLockUntil()) return true;
      if (typeof api.getRecentCommittedDataFreezeUntil === 'function' && now < api.getRecentCommittedDataFreezeUntil()) return true;
      if (isUserEditComposeActive()) return true;
      if (hasPendingLocalPersist()) return true;
      if (typeof api.hasProtectedDrafts === 'function' && api.hasProtectedDrafts()) return true;
      const aiChatState = getAIChatState();
      if (aiChatState?.busy) return true;
      if (typeof api.isAnyVoiceRunning === 'function' && api.isAnyVoiceRunning()) return true;
      if (now - state.lastPersistFlushAt < 3500) return true;
      if (typeof api.getLastUserEditAt === 'function' && now - api.getLastUserEditAt() < (typeof api.getExternalReloadGraceMs === 'function' ? api.getExternalReloadGraceMs() : 15000)) return true;
      return false;
    }

    function persistAIChatHistory(options = {}) {
      const syncData = options.syncData !== false;
      const skipRender = options.skipRender === true;
      const flushNow = options.flushNow === true;
      const persistLocal = options.persistLocal !== false;
      const aiChatState = getAIChatState();
      if (!aiChatState || typeof aiChatState !== 'object') return;
      const safeMessages = Array.isArray(aiChatState.messages)
        ? aiChatState.messages
            .map((item) => (typeof api.normalizeAIChatMessage === 'function' ? api.normalizeAIChatMessage(item) : item))
            .filter(Boolean)
            .slice(-((typeof api.getAIChatLocalHistoryMax === 'function' ? api.getAIChatLocalHistoryMax() : 20) || 20))
        : [];
      aiChatState.messages = safeMessages;
      if (persistLocal) {
        try {
          const localHistory = typeof api.buildLightweightAIChatLocalHistory === 'function'
            ? api.buildLightweightAIChatLocalHistory(safeMessages)
            : safeMessages;
          localStorage.setItem(api.getAIChatHistoryKey ? api.getAIChatHistoryKey() : 'lianxing_ai_chat_history_v1', JSON.stringify(localHistory));
        } catch (_) {}
      }
      aiChatState.freezeSessionUntil = Date.now() + (aiChatState.busy ? 6000 : 3500);
      if (syncData) {
        if (typeof api.protectRecentCommittedData === 'function') {
          api.protectRecentCommittedData(flushNow ? 18000 : 12000);
        } else if (typeof api.bumpUISessionLock === 'function') {
          api.bumpUISessionLock(flushNow ? 12000 : 8000);
        }
        const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
        const session = typeof api.ensureCurrentAIChatSession === 'function' ? api.ensureCurrentAIChatSession() : null;
        if (session) {
          session.messages = safeMessages;
          session.updatedAt = new Date().toISOString();
          if (!session.createdAt) session.createdAt = session.updatedAt;
          const currentTitle = String(session.title || '').trim();
          const shouldKeepTitle = typeof api.shouldKeepExistingAIChatSessionTitle === 'function'
            ? api.shouldKeepExistingAIChatSessionTitle(session)
            : false;
          session.title = shouldKeepTitle
            ? currentTitle
            : (session.customTitle
                ? (currentTitle || (typeof api.buildAIChatSessionTitle === 'function' ? api.buildAIChatSessionTitle(session.messages) : currentTitle))
                : (typeof api.buildAIChatSessionTitle === 'function' ? api.buildAIChatSessionTitle(session.messages, currentTitle || '新对话') : currentTitle || '新对话'));
          if (aiMemory && typeof aiMemory === 'object') {
            aiMemory.currentChatSessionId = session.id;
            aiMemory.chatSessions = Array.isArray(aiMemory.chatSessions)
              ? aiMemory.chatSessions
                  .map((item) => item.id === session.id ? session : item)
                  .sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')))
                  .slice(-((typeof api.getAIChatMaxSessions === 'function' ? api.getAIChatMaxSessions() : 20) || 20))
              : [session];
          }
          const persistEntityRefs = buildAIChatPersistEntityRefs(session);
          const persistDomains = ['aiChatSessions', 'aiCurrentChatSessionId'];
          if (flushNow) {
            saveData({
              skipUndo: true,
              skipRender: true,
              immediatePersist: true,
              domains: persistDomains,
              entityRefs: persistEntityRefs,
            });
          } else {
            saveSilent({
              skipUndo: true,
              forceDebounce: true,
              domains: persistDomains,
              entityRefs: persistEntityRefs,
            });
          }
        }
      }
      if (!skipRender && getCurrentTab() === 'ai' && typeof api.requestAIChatRender === 'function') {
        api.requestAIChatRender();
      }
    }

    return {
      scheduleRecoverySnapshot,
      flushPersistData,
      schedulePersistData,
      saveData,
      saveSilent,
      persistManagedEditorState,
      scheduleManagedEditorTypingSync,
      clearManagedEditorTypingSync,
      suppressManagedEditorBlurPersist,
      resolveManagedEditorSyncPayload,
      hasPendingLocalPersist,
      shouldDeferManagedEditorPersistFlush,
      shouldDeferExternalReload,
      shouldPausePassivePull,
      persistAIChatHistory,
      getLastPersistFlushAt: () => state.lastPersistFlushAt,
    };
  }

  window.MorphPersistRuntime = {
    create: createAppPersistRuntime,
  };
})();
