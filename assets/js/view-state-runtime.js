(function initMorphViewStateRuntime() {
  function cloneJSONSafe(value) {
    try {
      return value == null ? value : JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function createHostRealmPlainObject(runtimeApi = {}) {
    try {
      const cloneCtor = typeof runtimeApi.cloneJSONSafe === 'function' && runtimeApi.cloneJSONSafe.constructor;
      if (typeof cloneCtor === 'function') {
        const hostGlobal = cloneCtor('return this')();
        if (hostGlobal && typeof hostGlobal.Object === 'function') {
          return new hostGlobal.Object();
        }
      }
    } catch (_) {}
    return {};
  }

  function buildStableSnapshotSignature(value = '') {
    const text = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `v2:${text.length}:${(hash >>> 0).toString(16)}`;
  }

  function stripUndoSnapshotRuntimePayload(snapshotData = null) {
    if (!snapshotData || typeof snapshotData !== 'object') return snapshotData;
    const nextData = snapshotData;
    const runtime = nextData.morphRuntime && typeof nextData.morphRuntime === 'object'
      ? nextData.morphRuntime
      : null;
    if (runtime && Array.isArray(runtime.actionTransactions) && runtime.actionTransactions.length) {
      runtime.actionTransactions = [];
    }
    return nextData;
  }

  function buildDefaultNavigationShellState(runtimeApi = {}) {
    const shell = createHostRealmPlainObject(runtimeApi);
    shell.currentTab = 'flashThoughts';
    shell.activeContextId = null;
    shell.selectedDailyMonth = '';
    shell.aiChatSessionId = '';
    shell.activeThoughtsViewPane = '';
    shell.activeProjectCollectionPane = '';
    shell.activeProjectSpaceId = '';
    shell.activeProjectViewPane = '';
    shell.activeLocalPluginWorkspaceId = '';
    return shell;
  }

  function createViewStateRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const getData = typeof api.getData === 'function' ? api.getData : () => ({ projects: [], routines: [] });
    const getCurrentTab = typeof api.getCurrentTab === 'function' ? api.getCurrentTab : () => 'flashThoughts';
    const setCurrentTab = typeof api.setCurrentTab === 'function' ? api.setCurrentTab : () => {};
    const getActiveContextId = typeof api.getActiveContextId === 'function' ? api.getActiveContextId : () => null;
    const setActiveContextId = typeof api.setActiveContextId === 'function' ? api.setActiveContextId : () => {};
    const getSelectedDailyMonth = typeof api.getSelectedDailyMonth === 'function' ? api.getSelectedDailyMonth : () => '';
    const setSelectedDailyMonth = typeof api.setSelectedDailyMonth === 'function' ? api.setSelectedDailyMonth : () => {};
    const getAIChatSessionId = typeof api.getAIChatSessionId === 'function' ? api.getAIChatSessionId : () => '';
    const setAIChatSessionId = typeof api.setAIChatSessionId === 'function' ? api.setAIChatSessionId : () => {};
    const getActiveThoughtsViewPane = typeof api.getActiveThoughtsViewPane === 'function' ? api.getActiveThoughtsViewPane : () => '';
    const setActiveThoughtsViewPane = typeof api.setActiveThoughtsViewPane === 'function' ? api.setActiveThoughtsViewPane : () => {};
    const getActiveThoughtVisualMode = typeof api.getActiveThoughtVisualMode === 'function' ? api.getActiveThoughtVisualMode : () => '';
    const getActiveProjectCollectionPane = typeof api.getActiveProjectCollectionPane === 'function' ? api.getActiveProjectCollectionPane : () => '';
    const setActiveProjectCollectionPane = typeof api.setActiveProjectCollectionPane === 'function' ? api.setActiveProjectCollectionPane : () => {};
    const getActiveProjectSpaceId = typeof api.getActiveProjectSpaceId === 'function' ? api.getActiveProjectSpaceId : () => '';
    const setActiveProjectSpaceId = typeof api.setActiveProjectSpaceId === 'function' ? api.setActiveProjectSpaceId : () => {};
    const getActiveProjectViewPane = typeof api.getActiveProjectViewPane === 'function' ? api.getActiveProjectViewPane : () => '';
    const setActiveProjectViewPane = typeof api.setActiveProjectViewPane === 'function' ? api.setActiveProjectViewPane : () => {};
    const getActiveLocalPluginWorkspaceId = typeof api.getActiveLocalPluginWorkspaceId === 'function' ? api.getActiveLocalPluginWorkspaceId : () => '';
    const setActiveLocalPluginWorkspaceId = typeof api.setActiveLocalPluginWorkspaceId === 'function' ? api.setActiveLocalPluginWorkspaceId : () => {};
    const getCurrentEditorFocusSnapshot = typeof api.getCurrentEditorFocusSnapshot === 'function' ? api.getCurrentEditorFocusSnapshot : () => null;
    const getMonthStr = typeof api.getMonthStr === 'function' ? api.getMonthStr : () => new Date().toISOString().slice(0, 7);
    const ensureAIMemoryShape = typeof api.ensureAIMemoryShape === 'function' ? api.ensureAIMemoryShape : (target) => target;
    const getMorphWorkingMemory = typeof api.getMorphWorkingMemory === 'function' ? api.getMorphWorkingMemory : () => ({});
    const pruneMorphRecentMemoryBuffer = typeof api.pruneMorphRecentMemoryBuffer === 'function' ? api.pruneMorphRecentMemoryBuffer : (buffer) => buffer;
    const suspendOmniAutoFocus = typeof api.suspendOmniAutoFocus === 'function' ? api.suspendOmniAutoFocus : () => {};
    const switchTab = typeof api.switchTab === 'function' ? api.switchTab : () => {};
    const openContextDetail = typeof api.openContextDetail === 'function' ? api.openContextDetail : () => {};
    const renderAll = typeof api.renderAll === 'function' ? api.renderAll : () => {};
    const renderAIChatView = typeof api.renderAIChatView === 'function' ? api.renderAIChatView : () => {};
    const clone = typeof api.cloneJSONSafe === 'function' ? api.cloneJSONSafe : cloneJSONSafe;
    let renderQueued = false;
    let pendingFollowUpRender = false;
    let renderThrottleTimer = null;
    let lastRenderAt = 0;
    let aiChatRenderQueued = false;
    let navigationShellSwitchInFlight = false;

    function getVisibleProjectDetailContextId() {
      if (typeof document === 'undefined') return '';
      try {
        const view = document.getElementById('view-project');
        const detail = document.getElementById('project-detail');
        if (!view || !detail) return '';
        if (!view.classList?.contains?.('active')) return '';
        if (detail.classList?.contains?.('hidden')) return '';
        if (!detail.classList?.contains?.('flex')) return '';
        const el = typeof detail.querySelector === 'function'
          ? detail.querySelector('[data-context="project"][data-context-id]')
          : null;
        return String(el?.getAttribute?.('data-context-id') || '').trim();
      } catch (_) {
        return '';
      }
    }

    function buildMorphNavigationShellState() {
      const currentTab = String(getCurrentTab() || '').trim() || 'flashThoughts';
      const explicitActiveContextId = String(getActiveContextId() || '').trim() || null;
      const visibleProjectContextId = currentTab === 'project'
        ? (getVisibleProjectDetailContextId() || '')
        : '';
      return {
        currentTab,
        activeContextId: visibleProjectContextId || explicitActiveContextId,
        selectedDailyMonth: String(getSelectedDailyMonth() || '').trim(),
        aiChatSessionId: String(getAIChatSessionId() || '').trim(),
        activeThoughtsViewPane: String(getActiveThoughtsViewPane() || '').trim(),
        activeProjectCollectionPane: String(getActiveProjectCollectionPane() || '').trim(),
        activeProjectSpaceId: String(getActiveProjectSpaceId() || '').trim(),
        activeProjectViewPane: String(getActiveProjectViewPane() || '').trim(),
        activeLocalPluginWorkspaceId: String(getActiveLocalPluginWorkspaceId() || '').trim(),
      };
    }

    function isViewSectionActive(tab = '') {
      const value = String(tab || '').trim();
      if (!value || typeof document === 'undefined') return false;
      const section = document.getElementById(`view-${value}`);
      return !!(section && section.classList.contains('active'));
    }

    function getExplicitHashPreferredTab() {
      if (typeof window === 'undefined' || !window.location) return '';
      const rawHash = String(window.location.hash || '').replace(/^#/, '').trim();
      if (!rawHash) return '';
      const route = rawHash.split('?')[0].trim();
      if (!route) return '';
      if (route === 'home') return 'schedule';
      if (route === 'list' || route === 'fleeting') return 'flashThoughts';
      if (route === 'completedFlashThoughts') return 'archive';
      if (route === 'fixed') return 'flashThoughts';
      if (route === 'ai') return '';
      return ['flashThoughts', 'project', 'schedule', 'daily', 'health', 'finance', 'extensions', 'localPluginWorkspace', 'archive', 'settings', 'channelOps']
        .includes(route)
        ? route
        : '';
    }

    function applyMorphNavigationShellState(next = {}) {
      const view = next && typeof next === 'object' ? next : {};
      if (Object.prototype.hasOwnProperty.call(view, 'currentTab')) {
        const explicitHashTab = getExplicitHashPreferredTab();
        const value = explicitHashTab || String(view.currentTab || '').trim();
        if (value) {
          const currentValue = String(getCurrentTab() || '').trim() || 'flashThoughts';
          const shouldSyncSurface = value !== currentValue || !isViewSectionActive(value);
          if (typeof switchTab === 'function' && !navigationShellSwitchInFlight && shouldSyncSurface) {
            navigationShellSwitchInFlight = true;
            try {
              switchTab(value, false);
            } finally {
              navigationShellSwitchInFlight = false;
            }
          } else {
            setCurrentTab(value);
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(view, 'activeContextId')) {
        const value = String(view.activeContextId || '').trim();
        setActiveContextId(value || null);
      }
      if (Object.prototype.hasOwnProperty.call(view, 'selectedDailyMonth')) {
        const value = String(view.selectedDailyMonth || '').trim();
        setSelectedDailyMonth(value);
      }
      if (Object.prototype.hasOwnProperty.call(view, 'aiChatSessionId') || Object.prototype.hasOwnProperty.call(view, 'sessionId')) {
        const value = String(view.aiChatSessionId || view.sessionId || '').trim();
        setAIChatSessionId(value);
      }
      if (Object.prototype.hasOwnProperty.call(view, 'activeLocalPluginWorkspaceId')) {
        const value = String(view.activeLocalPluginWorkspaceId || '').trim();
        setActiveLocalPluginWorkspaceId(value);
      }
    }

    function buildMorphActionTransactionViewState() {
      return {
        ...buildMorphNavigationShellState(),
        activeThoughtsViewPane: String(getActiveThoughtsViewPane() || '').trim(),
        activeProjectCollectionPane: String(getActiveProjectCollectionPane() || '').trim(),
        activeProjectSpaceId: String(getActiveProjectSpaceId() || '').trim(),
        activeProjectViewPane: String(getActiveProjectViewPane() || '').trim(),
        activeLocalPluginWorkspaceId: String(getActiveLocalPluginWorkspaceId() || '').trim(),
      };
    }

    function applyMorphActionTransactionViewState(view = null) {
      const next = view && typeof view === 'object' ? view : {};
      applyMorphNavigationShellState(next);
      if (Object.prototype.hasOwnProperty.call(next, 'activeThoughtsViewPane')) {
        setActiveThoughtsViewPane(String(next.activeThoughtsViewPane || '').trim());
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeProjectCollectionPane')) {
        setActiveProjectCollectionPane(String(next.activeProjectCollectionPane || '').trim());
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeProjectSpaceId')) {
        setActiveProjectSpaceId(String(next.activeProjectSpaceId || '').trim());
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeProjectViewPane')) {
        setActiveProjectViewPane(String(next.activeProjectViewPane || '').trim());
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeLocalPluginWorkspaceId')) {
        setActiveLocalPluginWorkspaceId(String(next.activeLocalPluginWorkspaceId || '').trim());
      }
    }

    function getCurrentAIFocusContext() {
      const shell = buildMorphNavigationShellState();
      const selectedMonth = shell.selectedDailyMonth || getMonthStr();
      const data = getData();
      const aiMemory = ensureAIMemoryShape(data).aiMemory;
      const workingMemory = getMorphWorkingMemory(aiMemory);
      const projects = Array.isArray(data?.projects) ? data.projects : [];
      const activeProject = shell.currentTab === 'project' && shell.activeContextId
        ? projects.find((item) => item && item.id === shell.activeContextId) || null
        : null;
      return {
        tab: shell.currentTab,
        selectedDailyMonth: selectedMonth,
        aiChatSessionId: shell.aiChatSessionId,
        activeProject,
        recentMessages: Array.isArray(api.getAIChatMessages?.()) ? api.getAIChatMessages().slice(-4).map((msg) => `${msg.role}:${String(msg.content || '').slice(0, 120)}`) : [],
        currentTaskState: workingMemory.currentTaskState || aiMemory.currentTaskState || null,
        currentWorkflowState: workingMemory.currentWorkflowState || aiMemory.currentWorkflowState || null,
        recentMemoryBuffer: pruneMorphRecentMemoryBuffer(workingMemory.recentMemoryBuffer),
      };
    }

    function getMorphViewTabLabel(tab = '') {
      const value = String(tab || '').trim();
      const labels = {
        flashThoughts: '念头 (Thoughts)',
        project: '项目 (Projects)',
        schedule: '节律 (Rhythm)',
        daily: '日志 (Daily Log)',
        health: '健康 (Health)',
        finance: '财务 (Finance)',
        extensions: '插件 (Plugins)',
        localPluginWorkspace: '插件工作台 (Plugin Workspace)',
        settings: '设置 (Settings)',
        channelOps: '频道运营 (Channel Ops)',
      };
      return labels[value] || value;
    }

    function getMorphThoughtPaneLabel(pane = '') {
      const value = String(pane || '').trim();
      if (value === 'fixed') return '定念';
      if (value === 'archived') return '已归档';
      if (value === 'flash') return '闪念';
      return value;
    }

    function getMorphThoughtVisualModeLabel(mode = '') {
      const value = String(mode || '').trim();
      if (value === 'worms') return '图谱状态';
      if (value === 'cards') return '卡片状态';
      return value;
    }

    function buildMorphCurrentViewSnapshot(options = {}) {
      const focus = getCurrentAIFocusContext();
      const shell = buildMorphNavigationShellState();
      const blockSampleLimit = Math.max(0, Number(options.blockSampleLimit) || 0);
      const includeActiveRoutine = options.includeActiveRoutine !== false;
      const data = getData();
      const thoughtVisualMode = shell.currentTab === 'flashThoughts'
        ? String(getActiveThoughtVisualMode() || '').trim()
        : '';
      return {
        tab: focus.tab,
        tabLabel: getMorphViewTabLabel(focus.tab),
        activeContextId: shell.activeContextId,
        selectedDailyMonth: focus.selectedDailyMonth,
        activeThoughtsViewPane: shell.currentTab === 'flashThoughts' ? shell.activeThoughtsViewPane : '',
        activeThoughtsViewPaneLabel: shell.currentTab === 'flashThoughts' ? getMorphThoughtPaneLabel(shell.activeThoughtsViewPane) : '',
        activeThoughtVisualMode: thoughtVisualMode,
        activeThoughtVisualModeLabel: getMorphThoughtVisualModeLabel(thoughtVisualMode),
        activeProjectCollectionPane: shell.currentTab === 'project' ? shell.activeProjectCollectionPane : '',
        activeProjectSpaceId: shell.currentTab === 'project' ? shell.activeProjectSpaceId : '',
        activeProjectViewPane: shell.currentTab === 'project' ? shell.activeProjectViewPane : '',
        activeProject: focus.activeProject ? {
          id: focus.activeProject.id,
          name: focus.activeProject.name,
          referenceCount: Array.isArray(focus.activeProject.items) ? focus.activeProject.items.length : 0,
          blockSample: blockSampleLimit > 0
            ? (Array.isArray(focus.activeProject.blocks) ? focus.activeProject.blocks : []).slice(0, blockSampleLimit).map((block) => `${block.type}:${String(block.content || '').trim()}`)
            : [],
        } : null,
        activeRoutine: includeActiveRoutine && shell.activeContextId && shell.currentTab === 'routine' && Array.isArray(data?.routines)
          ? (() => {
              const activeRoutine = data.routines.find((item) => item && item.id === shell.activeContextId) || null;
              if (!activeRoutine) return null;
              return {
                id: activeRoutine.id,
                name: activeRoutine.name,
                blockSample: blockSampleLimit > 0
                  ? (Array.isArray(activeRoutine.blocks) ? activeRoutine.blocks : []).slice(0, blockSampleLimit).map((block) => `${block.type}:${String(block.content || '').trim()}`)
                  : [],
              };
            })()
          : null,
        activeLocalPluginWorkspaceId: shell.currentTab === 'localPluginWorkspace'
          ? String(getActiveLocalPluginWorkspaceId() || '').trim()
          : '',
      };
    }

    function buildUndoSnapshot() {
      const snapshotData = stripUndoSnapshotRuntimePayload(clone(getData()));
      return {
        data: snapshotData,
        currentTab: String(getCurrentTab() || '').trim(),
        activeContextId: String(getActiveContextId() || '').trim() || null,
        selectedDailyMonth: String(getSelectedDailyMonth() || '').trim(),
        aiChatSessionId: String(getAIChatSessionId() || '').trim(),
        activeLocalPluginWorkspaceId: String(getActiveLocalPluginWorkspaceId() || '').trim(),
        lastInject: clone(api.getLastInject ? api.getLastInject() : null),
        focus: getCurrentEditorFocusSnapshot(),
      };
    }

    function snapshotSignature(snapshot) {
      const serialized = JSON.stringify({
        data: snapshot?.data,
        currentTab: snapshot?.currentTab,
        activeContextId: snapshot?.activeContextId,
        selectedDailyMonth: snapshot?.selectedDailyMonth,
        aiChatSessionId: snapshot?.aiChatSessionId,
        activeLocalPluginWorkspaceId: snapshot?.activeLocalPluginWorkspaceId,
        lastInject: snapshot?.lastInject || null,
      });
      return buildStableSnapshotSignature(serialized);
    }

    function getUndoScopeKeyFromSnapshot(snapshot) {
      return [
        String(snapshot?.currentTab || 'unknown'),
        String(snapshot?.activeContextId || ''),
        String(snapshot?.selectedDailyMonth || ''),
        String(snapshot?.aiChatSessionId || ''),
        String(snapshot?.activeLocalPluginWorkspaceId || ''),
      ].join('::');
    }

    function getCurrentUndoScopeKey() {
      const shell = buildMorphNavigationShellState();
      return [shell.currentTab || 'unknown', shell.activeContextId || '', shell.selectedDailyMonth || '', shell.aiChatSessionId || '', shell.activeLocalPluginWorkspaceId || ''].join('::');
    }

    function requestRenderAll() {
      if (renderQueued) {
        pendingFollowUpRender = true;
        return;
      }
      const now = Date.now();
      const minGapMs = Number(api.renderMinGapMs || 0);
      const gap = now - lastRenderAt;
      if (gap < minGapMs) {
        clearTimeout(renderThrottleTimer);
        renderThrottleTimer = setTimeout(() => {
          renderThrottleTimer = null;
          requestRenderAll();
        }, Math.max(0, minGapMs - gap));
        return;
      }
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        lastRenderAt = Date.now();
        renderAll();
        if (pendingFollowUpRender) {
          pendingFollowUpRender = false;
          requestRenderAll();
        }
      });
    }

    function requestAIChatRender() {
      if (aiChatRenderQueued) return;
      aiChatRenderQueued = true;
      requestAnimationFrame(() => {
        aiChatRenderQueued = false;
        if (String(getCurrentTab() || '').trim() === 'ai') {
          renderAIChatView();
        }
      });
    }

    return {
      buildDefaultNavigationShellState: () => buildDefaultNavigationShellState(api),
      buildMorphNavigationShellState,
      applyMorphNavigationShellState,
      buildMorphActionTransactionViewState,
      applyMorphActionTransactionViewState,
      buildMorphCurrentViewSnapshot,
      getCurrentAIFocusContext,
      buildUndoSnapshot,
      snapshotSignature,
      getUndoScopeKeyFromSnapshot,
      getCurrentUndoScopeKey,
      requestRenderAll,
      requestAIChatRender,
      suspendOmniAutoFocus,
      switchTab,
      openContextDetail,
      renderAll,
      getCurrentEditorFocusSnapshot,
    };
  }

  window.MorphViewStateRuntime = {
    create: createViewStateRuntime,
  };
})();
