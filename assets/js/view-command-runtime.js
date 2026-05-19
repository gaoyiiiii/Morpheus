(function initMorphViewCommandRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphViewCommandRuntime && typeof window.MorphViewCommandRuntime.create === 'function') return;

  const ALLOWED_ROUTE_TABS = new Set([
    'flashThoughts',
    'fixed',
    'project',
    'schedule',
    'daily',
    'health',
    'finance',
    'extensions',
    'localPluginWorkspace',
    'archive',
    'ai',
    'settings',
    'channelOps',
  ]);

  function createViewCommandRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const helpers = api.helpers && typeof api.helpers === 'object' ? api.helpers : api;
    const getViewStateRuntimeModules = typeof api.getViewStateRuntimeModules === 'function'
      ? api.getViewStateRuntimeModules
      : () => null;
    const getData = typeof api.getData === 'function' ? api.getData : () => ({ projects: [], routines: [], fixed: [], dailyMonths: {} });
    const getCurrentTab = typeof api.getCurrentTab === 'function' ? api.getCurrentTab : () => 'flashThoughts';
    const getActiveContextId = typeof api.getActiveContextId === 'function' ? api.getActiveContextId : () => null;
    const getSelectedDailyMonth = typeof api.getSelectedDailyMonth === 'function' ? api.getSelectedDailyMonth : () => '';
    const getActiveThoughtsViewPane = typeof api.getActiveThoughtsViewPane === 'function' ? api.getActiveThoughtsViewPane : () => '';
    const setActiveThoughtsViewPane = typeof api.setActiveThoughtsViewPane === 'function' ? api.setActiveThoughtsViewPane : () => {};
    const getLastNonAITab = typeof api.getLastNonAITab === 'function' ? api.getLastNonAITab : () => 'flashThoughts';
    const setLastNonAITab = typeof api.setLastNonAITab === 'function' ? api.setLastNonAITab : () => {};
    const getLastNonExtensionsTab = typeof api.getLastNonExtensionsTab === 'function' ? api.getLastNonExtensionsTab : () => 'flashThoughts';
    const setLastNonExtensionsTab = typeof api.setLastNonExtensionsTab === 'function' ? api.setLastNonExtensionsTab : () => {};
    const getMobileAIComposeActive = typeof api.getMobileAIComposeActive === 'function' ? api.getMobileAIComposeActive : () => false;
    const setMobileAIComposeActive = typeof api.setMobileAIComposeActive === 'function' ? api.setMobileAIComposeActive : () => {};
    const getMobileFinanceAIComposeActive = typeof api.getMobileFinanceAIComposeActive === 'function' ? api.getMobileFinanceAIComposeActive : () => false;
    const setMobileFinanceAIComposeActive = typeof api.setMobileFinanceAIComposeActive === 'function' ? api.setMobileFinanceAIComposeActive : () => {};
    const getMobileDailyAIComposeActive = typeof api.getMobileDailyAIComposeActive === 'function' ? api.getMobileDailyAIComposeActive : () => false;
    const setMobileDailyAIComposeActive = typeof api.setMobileDailyAIComposeActive === 'function' ? api.setMobileDailyAIComposeActive : () => {};
    const getMobileHealthAIComposeActive = typeof api.getMobileHealthAIComposeActive === 'function' ? api.getMobileHealthAIComposeActive : () => false;
    const setMobileHealthAIComposeActive = typeof api.setMobileHealthAIComposeActive === 'function' ? api.setMobileHealthAIComposeActive : () => {};
    const getActiveLocalPluginWorkspaceId = typeof api.getActiveLocalPluginWorkspaceId === 'function' ? api.getActiveLocalPluginWorkspaceId : () => '';
    const setActiveLocalPluginWorkspaceId = typeof api.setActiveLocalPluginWorkspaceId === 'function' ? api.setActiveLocalPluginWorkspaceId : () => {};
    const getMobileMoreMenuOpen = typeof api.getMobileMoreMenuOpen === 'function' ? api.getMobileMoreMenuOpen : () => false;
    const getMobileProjectOrbitPanelOpen = typeof api.getMobileProjectOrbitPanelOpen === 'function' ? api.getMobileProjectOrbitPanelOpen : () => false;
    const setMobileProjectOrbitPanelOpen = typeof api.setMobileProjectOrbitPanelOpen === 'function' ? api.setMobileProjectOrbitPanelOpen : () => {};
    const getGlucoseSettingsModalOpen = typeof api.getGlucoseSettingsModalOpen === 'function' ? api.getGlucoseSettingsModalOpen : () => false;
    const getFeishuSettingsModalOpen = typeof api.getFeishuSettingsModalOpen === 'function' ? api.getFeishuSettingsModalOpen : () => false;
    const getDailyAlignSettingsModalOpen = typeof api.getDailyAlignSettingsModalOpen === 'function' ? api.getDailyAlignSettingsModalOpen : () => false;
    const getAIKeySettingsModalOpen = typeof api.getAIKeySettingsModalOpen === 'function' ? api.getAIKeySettingsModalOpen : () => false;
    const getSecureVaultSettingsModalOpen = typeof api.getSecureVaultSettingsModalOpen === 'function' ? api.getSecureVaultSettingsModalOpen : () => false;
    const getAIVoiceState = typeof api.getAIVoiceState === 'function' ? api.getAIVoiceState : () => ({ running: false });
    const getDailyVoiceState = typeof api.getDailyVoiceState === 'function' ? api.getDailyVoiceState : () => ({ running: false });
    const getMobileQuickVoiceState = typeof api.getMobileQuickVoiceState === 'function' ? api.getMobileQuickVoiceState : () => ({ running: false });
    const getLastTabKey = typeof api.getLastTabKey === 'function' ? api.getLastTabKey : () => 'lianxing_last_tab_v1';
    const getLowPerfMode = typeof api.getLowPerfMode === 'function' ? api.getLowPerfMode : () => false;
    const recentProjectKey = 'morph_recent_project_id_v1';
    const call = (name, ...args) => {
      const fn = typeof helpers[name] === 'function'
        ? helpers[name]
        : typeof window[name] === 'function'
          ? window[name]
          : null;
      return typeof fn === 'function' ? fn(...args) : undefined;
    };
    const renderProjectPageNavButton = (mode = 'menu') => {
      const navBtn = document.getElementById('project-page-nav-btn');
      if (!navBtn) return;
      void mode;
      navBtn.setAttribute('aria-label', '切换导航栏');
      navBtn.setAttribute('title', '目录');
      navBtn.innerHTML = '<i id="project-page-nav-icon" data-lucide="menu" class="w-4 h-4"></i>';
      navBtn.onclick = (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        call('togglePrimarySidebarVisibility', event);
      };
      call('requestLucideRefresh', { root: navBtn });
    };
    const applyRawNavigationShellState = (next = {}) => {
      if (Object.prototype.hasOwnProperty.call(next, 'currentTab')) {
        const tab = String(next.currentTab || '').trim();
        if (tab) {
          if (typeof api.setCurrentTab === 'function') api.setCurrentTab(tab);
        }
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeContextId')) {
        if (typeof api.setActiveContextId === 'function') {
          api.setActiveContextId(String(next.activeContextId || '').trim() || null);
        }
      }
      if (Object.prototype.hasOwnProperty.call(next, 'selectedDailyMonth')) {
        if (typeof api.setSelectedDailyMonth === 'function') {
          api.setSelectedDailyMonth(String(next.selectedDailyMonth || '').trim());
        }
      }
      if (Object.prototype.hasOwnProperty.call(next, 'aiChatSessionId') || Object.prototype.hasOwnProperty.call(next, 'sessionId')) {
        if (typeof api.setAIChatSessionId === 'function') {
          api.setAIChatSessionId(String(next.aiChatSessionId || next.sessionId || '').trim());
        }
      }
    };
    const setNavigationShellState = (next = {}) => {
      const viewStateRuntime = getViewStateRuntimeModules();
      if (
        viewStateRuntime
        && typeof viewStateRuntime.applyMorphNavigationShellState === 'function'
        && !Object.prototype.hasOwnProperty.call(next, 'currentTab')
      ) {
        viewStateRuntime.applyMorphNavigationShellState(next);
        return;
      }
      applyRawNavigationShellState(next);
    };

    function shouldKeepStartupBlockersVisible() {
      return !!call('shouldKeepStartupBlockersVisible');
    }

    function hideStartupBlockers(force = false) {
      call('hideStartupBlockers', force);
    }

    function isIOSNativeHashNavigationUnsafe() {
      try {
        if (typeof api.isIOSNativeAppRuntime === 'function') return api.isIOSNativeAppRuntime() === true;
      } catch (_) {}
      try {
        return !!document?.documentElement?.classList?.contains('ios-native-app');
      } catch (_) {}
      return false;
    }

    function updateRouteURLWithoutReload(nextTab = '') {
      const safeTab = String(nextTab || '').trim();
      if (!safeTab || typeof window === 'undefined' || !window.location) return;
      if (isIOSNativeHashNavigationUnsafe() && window.history && typeof window.history.replaceState === 'function') {
        try {
          const nextURL = `${window.location.pathname || '/'}${window.location.search || ''}#${safeTab}`;
          window.history.replaceState(null, '', nextURL);
          return;
        } catch (_) {}
      }
      window.location.hash = safeTab;
    }

    function handleRoute() {
      const routeResult = call('parseMorphHashRoute') || {};
      const rawHash = String(routeResult.route || '').trim();
      let hash = rawHash || '';
      try {
        const savedTab = localStorage.getItem(String(getLastTabKey() || '').trim()) || '';
        hash = hash || savedTab || 'schedule';
      } catch (_) {
        hash = hash || 'schedule';
      }
      const wantsAIChatDrawer = hash === 'ai' && call('isMobileNavMode') !== true;
      let shouldRestoreAIChatDrawer = wantsAIChatDrawer;
      if (!shouldRestoreAIChatDrawer && call('isMobileNavMode') !== true) {
        try { shouldRestoreAIChatDrawer = localStorage.getItem('morph_ai_chat_drawer_open_v1') === '1'; } catch (_) {}
      }
      if (hash === 'home') hash = 'schedule';
      if (hash === 'list' || hash === 'fleeting') hash = 'flashThoughts';
      if (hash === 'ai' && call('isMobileNavMode') !== true) {
        hash = String(getLastNonAITab() || getCurrentTab() || 'flashThoughts').trim() || 'flashThoughts';
      }
      if (hash === 'completedFlashThoughts') {
        hash = 'archive';
      }
      if (!ALLOWED_ROUTE_TABS.has(hash)) hash = 'schedule';
      switchTab(hash, false);
      if (shouldRestoreAIChatDrawer) call('setAIChatDrawerOpen', true, { persist: false });
    }

    function commitManagedEditorBeforeNavigation() {
      call('flushActiveManagedEditorToCanonicalData', { immediatePersist: true });
      call('flushPersistData');
      call('flushLocalCacheWriteNow');
    }

    function getActiveProjects() {
      const data = getData();
      return (Array.isArray(data?.projects) ? data.projects : []).filter((item) => {
        const id = String(item?.id || '').trim();
        if (!id) return false;
        return String(item?.status || '').trim() !== 'archived' && !String(item?.archivedAt || '').trim();
      });
    }

    function readRecentProjectId() {
      try { return String(localStorage.getItem(recentProjectKey) || '').trim(); } catch (_) { return ''; }
    }

    function writeRecentProjectId(projectId = '') {
      const normalizedId = String(projectId || '').trim();
      if (!normalizedId) return false;
      try { localStorage.setItem(recentProjectKey, normalizedId); } catch (_) {}
      return true;
    }

    function choosePreferredProjectId() {
      const projects = getActiveProjects();
      if (!projects.length) return '';
      const recentId = readRecentProjectId();
      if (recentId && projects.some((item) => String(item?.id || '').trim() === recentId)) return recentId;
      const rootProjects = projects.filter((item) => !String(call('getProjectParentId', item) || '').trim());
      const candidates = rootProjects.length ? rootProjects : projects;
      const sorted = call('sortProjectsForDirectory', candidates);
      const list = Array.isArray(sorted) && sorted.length ? sorted : candidates;
      return String(list[0]?.id || '').trim();
    }

    function openPreferredProjectDetailIfNeeded() {
      if (String(getCurrentTab() || '').trim() !== 'project') return false;
      if (String(getActiveContextId() || '').trim()) return false;
      const projectId = choosePreferredProjectId();
      if (!projectId) return false;
      return openContextDetail(projectId, 'project', { source: 'project-default' });
    }

    function switchTab(tab, updateHash = true) {
      let nextTab = String(tab || '').trim() || 'flashThoughts';
      if (nextTab === 'ai' && call('isMobileNavMode') !== true) {
        if (!shouldKeepStartupBlockersVisible()) hideStartupBlockers(true);
        if (updateHash) {
          const currentVisibleTab = String(getCurrentTab() || getLastNonAITab() || 'flashThoughts').trim() || 'flashThoughts';
          updateRouteURLWithoutReload(currentVisibleTab === 'ai' ? 'flashThoughts' : currentVisibleTab);
        }
        if (getMobileMoreMenuOpen()) call('hideMobileMoreMenu');
        call('setAIChatDrawerOpen', true);
        call('renderGlobalHeaderActionPill');
        call('syncHeaderActionPillHitArea');
        return;
      }
      if (!shouldKeepStartupBlockersVisible()) {
        hideStartupBlockers(true);
      }
      if (nextTab === 'fixed') {
        setActiveThoughtsViewPane('fixed');
        nextTab = 'flashThoughts';
      } else if (nextTab === 'flashThoughts') {
        call('normalizeThoughtsViewPane');
      }
      if (nextTab === 'finance' && !call('canUseFinancePageFeatures')) {
        nextTab = 'extensions';
      }
      if (nextTab === 'health' && !call('canUseHealthPageFeatures')) {
        nextTab = 'extensions';
      }
      if (nextTab === 'channelOps' && !call('canUseAtlasExtensionFeatures')) {
        nextTab = 'extensions';
      }
      call('bumpUISessionLock', 1200);
      call('clearBlockBatchSelection');
      if (nextTab !== 'flashThoughts') {
        call('clearThoughtGraphKeyboardNavigation', { closeDetail: true });
        if (call('isModalShellOpenById', 'detail-modal')) {
          call('closeDetailModal', { skipRender: true, skipFocus: true, forceImmediate: true });
        }
      }
      commitManagedEditorBeforeNavigation();
      if (nextTab !== 'health') {
        call('stopGlucoseHealthAutoRefresh');
      }
      if (nextTab !== 'settings' && nextTab !== 'extensions' && getGlucoseSettingsModalOpen()) {
        call('closeGlucoseSettingsModal');
      }
      if (nextTab !== 'settings' && nextTab !== 'extensions' && getFeishuSettingsModalOpen()) {
        call('closeFeishuSettingsModal');
      }
      if (nextTab !== 'settings' && getDailyAlignSettingsModalOpen()) {
        call('closeDailyAlignSettingsModal');
      }
      if (nextTab !== 'settings' && getAIKeySettingsModalOpen()) {
        call('closeAIKeySettingsModal');
      }
      if (nextTab !== 'settings' && getSecureVaultSettingsModalOpen()) {
        call('closeSecureVaultSettingsModal');
      }
      if (nextTab !== 'ai') {
        setLastNonAITab(nextTab);
      }
      if (nextTab !== 'extensions' && nextTab !== 'localPluginWorkspace') {
        setLastNonExtensionsTab(nextTab);
      }
      const aiVoiceState = getAIVoiceState();
      if (aiVoiceState?.running && nextTab !== 'ai') {
        call('stopAIVoiceRecognition');
        aiVoiceState.running = false;
        aiVoiceState.finalText = '';
        aiVoiceState.interimText = '';
      }
      if (nextTab !== 'ai' && getMobileAIComposeActive()) {
        setMobileAIComposeActive(false);
        const input = document.getElementById('mobile-detail-input');
        if (input) {
          input.value = '';
          call('resizeComposerTextarea', input, 120);
        }
      }
      const dailyVoiceState = getDailyVoiceState();
      if (dailyVoiceState?.running && nextTab !== 'daily') {
        dailyVoiceState.running = false;
        call('commitDailyVoiceLiveTranscript', '');
      }
      if (nextTab !== 'daily' && getMobileDailyAIComposeActive()) {
        setMobileDailyAIComposeActive(false);
        const input = document.getElementById('mobile-detail-input');
        if (input) {
          input.value = '';
          call('resizeComposerTextarea', input, 120);
        }
      }
      if (nextTab !== 'health' && getMobileHealthAIComposeActive()) {
        setMobileHealthAIComposeActive(false);
        const input = document.getElementById('mobile-detail-input');
        if (input) {
          input.value = '';
          call('resizeComposerTextarea', input, 120);
        }
      }
      if (nextTab !== 'finance' && getMobileFinanceAIComposeActive()) {
        setMobileFinanceAIComposeActive(false);
        const input = document.getElementById('mobile-detail-input');
        if (input) {
          input.value = '';
          call('resizeComposerTextarea', input, 120);
        }
      }
      const mobileQuickVoiceState = getMobileQuickVoiceState();
      if (mobileQuickVoiceState?.running) {
        const leavingDailyVoice = mobileQuickVoiceState.mode === 'daily-ai' && nextTab !== 'daily';
        const leavingContextVoice = mobileQuickVoiceState.mode === 'context-detail'
          && (nextTab !== 'project' || !String(getActiveContextId() || '').trim());
        if (leavingDailyVoice || leavingContextVoice) {
          call('stopMobileQuickVoiceInput');
        }
      }
      if (nextTab !== 'daily' && mobileQuickVoiceState?.mode === 'daily-ai') {
        call('resetMobileQuickVoiceState', { clearInput: false });
      }
      closeContextDetail({ skipRender: true, skipFocus: true });
      setNavigationShellState({ currentTab: nextTab });
      if (updateHash && window.location && typeof window.location === 'object') {
        updateRouteURLWithoutReload(nextTab);
      }
      if (getMobileMoreMenuOpen() && !call('shouldShowMobileBottomBar', nextTab)) {
        call('hideMobileMoreMenu');
      }
      try {
        localStorage.setItem(String(getLastTabKey() || '').trim(), nextTab);
      } catch (_) {}
      const viewSections = document.querySelectorAll('.view-section');
      viewSections.forEach((el) => el.classList.remove('active'));
      const activeSection = document.getElementById(`view-${nextTab}`);
      if (activeSection) activeSection.classList.add('active');
      if (!(activeSection && activeSection.classList.contains('active')) && typeof api.forceExplicitHashRouteVisibilityFallback === 'function') {
        api.forceExplicitHashRouteVisibilityFallback(nextTab);
      }
      const navButtons = document.querySelectorAll('.nav-btn');
      navButtons.forEach((el) => {
        el.classList.remove('bg-gray-200/50', 'dark:bg-white/[0.03]', 'text-black', 'dark:text-white', 'font-medium', 'font-light');
        el.classList.add('text-gray-600', 'dark:text-gray-500', 'font-normal');
      });
      const activeNav = document.getElementById(`tab-${nextTab}`);
      if (activeNav) {
        activeNav.classList.remove('text-gray-600', 'dark:text-gray-500', 'font-light', 'font-medium');
        activeNav.classList.add('bg-gray-200/50', 'dark:bg-white/[0.03]', 'text-black', 'dark:text-white', 'font-normal');
      }
      if (nextTab === 'daily') {
        call('ensureSelectedDailyMonth');
      }
      if (nextTab === 'project') {
        openPreferredProjectDetailIfNeeded();
      }
      call('renderSidebarProjectNavTree');
      call('renderSidebarDailyNavTree');
      call('renderThoughtViewSwitcher');
      call('renderGlobalHeaderActionPill');
      call('syncHeaderActionPillHitArea');
      call('syncOmniInputPlaceholder', nextTab);
      call('syncDrawerProjectScopeForNavigation');
      call('syncComposerLayoutState', 'omni');
      call('syncComposerLayoutState', 'ai-chat');
      call('syncThoughtsComposerChrome', nextTab);
      if (nextTab === 'health') {
        const canApple = call('canUseAppleHealthExtensionFeatures') === true;
        const canGlu = call('canUseGlucoseExtensionFeatures') === true;
        const ios = call('isIOSNativeAppRuntime') === true;
        if (canApple && ios && !canGlu) {
          call('setHealthViewPane', 'apple-health');
        } else if (canApple) {
          call('setHealthViewPane', 'apple-health');
        } else if (canGlu) {
          call('setHealthViewPane', 'glucose');
        } else {
          call('normalizeHealthViewPane');
        }
        if (canGlu) {
          call('startGlucoseHealthAutoRefresh');
          setTimeout(() => {
            call('fetchGlucoseHistoryForHealth', { force: false, silent: false });
          }, 0);
        }
      }
      if (nextTab === 'finance') {
        call('renderFinanceContentTabs');
        call('renderFinanceHostView');
      }
      if (nextTab === 'channelOps') {
        call('scheduleChannelOpsSync', 'tab-switch', { immediate: true, minGapMs: 0 });
      }
      if (nextTab === 'extensions') {
        call('showExtensionList');
      }
      renderProjectPageNavButton(nextTab === 'project' && String(getActiveContextId() || '').trim() ? 'back' : 'menu');
      if (nextTab === 'localPluginWorkspace' && !String(getActiveLocalPluginWorkspaceId() || '').trim()) {
        nextTab = 'extensions';
      }
      if (nextTab === 'settings') call('refreshSettingsNativeState');
      // Keep AI directory drawer state consistent with current tab.
      call('applyAIChatSessionDrawerState');
      call('requestRenderAll');
      call('scheduleExplicitHashRouteVisibilityEnforcement', 80, { source: 'switch-tab' });
      call('setOmniBarVisible', call('shouldShowOmniBar'));
      call('applyMobileNavigationMode');
      call('syncMainScrollAreaBottomInset');
      call('syncMobileBottomNavState');
      call('syncMobileQuickComposeButton');
      call('renderHomeVoiceUI');
      call('renderHealthVoiceUI');
      if (!getLowPerfMode() && (call('shouldShowOmniBar') || call('isMobileBottomInputMode'))) {
        call('focusOmniInputSoon', 100);
      }
    }

    function openContextDetail(id, contextType, options = {}) {
      const context = String(contextType || '').trim();
      const normalizedId = String(id || '').trim();
      if (!context || !normalizedId) return false;
      commitManagedEditorBeforeNavigation();
      call('bumpUISessionLock');
      setNavigationShellState({ activeContextId: normalizedId });
      if (context === 'project') {
        renderProjectPageNavButton('back');
      }
      const detailWrapper = document.getElementById(`${context}-detail`);
      const data = getData();
      const list = Array.isArray(data?.[`${context}s`]) ? data[`${context}s`] : [];
      const p = list.find((item) => item && item.id === normalizedId) || null;
      if (!detailWrapper || !p) return false;
      if (context === 'project') writeRecentProjectId(normalizedId);
      const grid = document.getElementById(`${context}-grid`);
      const listHeader = document.getElementById(`${context}-list-header`);
      if (grid) grid.classList.add('hidden');
      if (listHeader && context !== 'project') listHeader.classList.add('hidden');
      if (context === 'project') {
        const listShell = document.getElementById('project-list-shell');
        if (listShell) listShell.classList.add('hidden');
        call('renderProjectDirectoryTree');
        call('renderSidebarProjectNavTree');
      }
      if (context === 'project') {
        call('prepareProjectVisualOrganizerForDetailRender');
        const projectSourceBadge = String(p?.sourceThought?.type || '') === 'fixed'
          ? `<button type="button" onclick="event.stopPropagation(); openFixedThoughtFromProject('${p.id}')" class="mb-4 inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-3 py-1.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-400/15 transition-colors"><i data-lucide="target" class="w-3 h-3"></i><span>来自定念</span><i data-lucide="arrow-up-left" class="w-3 h-3"></i></button>`
          : '';
        const projectTitle = String(call('getManagedContextTitleDisplayValue', 'project', p.id, p.name || '未命名') || p.name || '未命名').trim() || '未命名';
        detailWrapper.innerHTML = `
                <div class="relative w-full h-full min-h-0 flex flex-col">
                <div id="project-detail-content-shell" class="relative flex flex-1 min-h-0 items-stretch w-full overflow-hidden">
                    <aside id="project-visual-organizer-drawer" class="hidden absolute inset-y-0 left-0 z-20 w-full overflow-hidden transition-[width,transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:relative md:inset-auto md:left-auto md:z-0 md:shrink-0" aria-hidden="true">
                        <div id="project-visual-organizer-surface" class="h-full w-full p-3 sm:p-4 md:p-5 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
                            <div id="project-visual-organizer-shell" class="flex h-full min-h-0 flex-col rounded-[1.6rem] border border-black/[0.06] bg-white/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#050505]/88">
                                <div class="flex items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3 dark:border-white/10">
                                    <div class="min-w-0">
                                        <div class="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.24em] text-gray-500 dark:text-white/40">
                                            <i data-lucide="shapes" class="w-3.5 h-3.5"></i>
                                            <span>视觉图形</span>
                                        </div>
                                        <div class="mt-1 text-[13px] leading-6 text-gray-600 dark:text-white/62">围绕当前项目，把问题、概念、对比和学习脉络真正摆出来。</div>
                                    </div>
                                    <button id="project-visual-organizer-toggle-btn" type="button" onclick="toggleProjectVisualOrganizerPanelFullscreen(event)" class="inline-flex h-8 w-8 shrink-0 items-center justify-center text-gray-400 transition-colors hover:text-black dark:text-white/40 dark:hover:text-white" aria-label="全屏视觉图形" title="全屏视觉图形">
                                        <i id="project-visual-organizer-toggle-icon" data-lucide="maximize-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                                <div class="flex-1 min-h-0 overflow-hidden px-4 py-4">
                                    <div id="project-visual-organizer-content" class="h-full min-h-0"></div>
                                </div>
                            </div>
                        </div>
                    </aside>
                    <div id="project-visual-organizer-resizer" class="hidden absolute inset-y-0 z-30 w-5 cursor-col-resize select-none" onpointerdown="beginProjectVisualOrganizerPanelResize(event)" aria-hidden="true"></div>
                    <div id="project-detail-scroll" class="order-1 flex-1 min-w-0 w-full h-full px-1 sm:px-2 pt-2 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar">
                        <div class="w-full mx-auto min-h-full flex flex-col" style="max-width:800px;">
	                            <h1 class="text-3xl md:text-4xl leading-tight font-medium text-black dark:text-white/95 tracking-tight mb-3 outline-none rounded-md focus:bg-black/[0.02] dark:focus:bg-white/[0.03] px-1 -mx-1" contenteditable="true" spellcheck="false" data-context-title="true" data-context="project" data-context-id="${p.id}" oninput="handleContextTitleInput(event, 'project', '${p.id}')" onkeydown="handleContextTitleKeydown(event)" onblur="handleContextTitleBlur(event, 'project', '${p.id}')">${call('escapeHTML', projectTitle)}</h1>
	                            ${projectSourceBadge}
	                            <div class="flex items-center gap-6 text-[10px] font-mono text-gray-500 dark:text-gray-600 mb-6 pb-3 border-b border-gray-100 dark:border-white/[0.04]">
                                <span class="flex items-center gap-1.5 text-gray-400 dark:text-white/30"><i data-lucide="file-text" class="w-3 h-3"></i> 编辑器</span>
                                <span class="flex items-center gap-1.5"><i data-lucide="hash" class="w-3 h-3"></i> 项目条目: <span id="bp-count-project">${Array.isArray(p.items) ? p.items.length : 0}</span></span>
                            </div>
                            <div id="project-block-editor" class="flex flex-col gap-1 w-full" onpointerdown="handleManagedBlockEditorContainerPointer(event, 'project', '${p.id}')"></div>
                        </div>
                    </div>
                </div>
                </div>`;
        detailWrapper.classList.remove('hidden');
        detailWrapper.classList.add('flex');
        call('renderGlobalHeaderActionPill');
        call('syncHeaderActionPillHitArea');
        const omniInput = document.getElementById('omni-input');
        if (omniInput) omniInput.placeholder = "记录项目内容... (Enter 发送，Cmd/Ctrl+Enter 换行)";
        call('setOmniBarVisible', call('shouldShowOmniBar'));
        call('ensureEditorHistorySeed', 'project', p.id);
        call('renderStandardBlockEditor', 'project', p.id, 'project-block-editor');
        call('renderProjectDirectoryTree');
        call('renderSidebarProjectNavTree');
        call('applyProjectTreePanelState');
        call('applyProjectVisualOrganizerPanelState');
        if (call('isMobileNavMode')) {
          call('syncMobileContextDetailInputState');
          call('syncMobileQuickComposeButton');
        }
        renderProjectPageNavButton('back');
        call('syncProjectListHeaderNavState');
      }
      call('syncDrawerProjectScopeForNavigation', { forceRender: true });
      call('requestLucideRefresh');
      call('syncMobileBottomNavState');
      call('focusOmniInputSoon', 100);
      return true;
    }

    function closeContextDetail(options = {}) {
      const currentContextId = String(getActiveContextId() || '').trim();
      if (!currentContextId) return false;
      commitManagedEditorBeforeNavigation();
      const contextType = String(getCurrentTab() || '').trim();
      if (contextType === 'project') {
        renderProjectPageNavButton('menu');
      }
      if (contextType === 'project' && options.skipRender !== true) {
        const currentProject = call('findProjectById', currentContextId);
        const parentProjectId = String(call('getProjectParentId', currentProject) || '').trim();
        if (parentProjectId) {
          openContextDetail(parentProjectId, 'project');
          return true;
        }
      }
      if (getMobileQuickVoiceState()?.running && getMobileQuickVoiceState()?.mode === 'context-detail') {
        call('stopMobileQuickVoiceInput');
      }
      call('resetMobileQuickVoiceState', { clearInput: true });
      const grid = document.getElementById(`${contextType}-grid`);
      if (grid) grid.classList.remove('hidden');
      const listHeader = document.getElementById(`${contextType}-list-header`);
      if (listHeader) listHeader.classList.remove('hidden');
      if (contextType === 'project') {
        const listShell = document.getElementById('project-list-shell');
        if (listShell) listShell.classList.remove('hidden');
        call('renderProjectDirectoryTree');
        call('renderSidebarProjectNavTree');
      }
      const detailWrapper = document.getElementById(`${contextType}-detail`);
      if (detailWrapper) {
        detailWrapper.classList.add('hidden');
        detailWrapper.classList.remove('flex');
        detailWrapper.innerHTML = '';
      }
      setNavigationShellState({ activeContextId: null });
      if (contextType === 'project') renderProjectPageNavButton('menu');
      if (contextType === 'project') call('syncProjectListHeaderNavState');
      call('syncDrawerProjectScopeForNavigation', { forceRender: options.skipRender === true });
      const emptyMap = { project: "记录项目内容... (Enter 发送，Cmd/Ctrl+Enter 换行)" };
      const omniInput = document.getElementById('omni-input');
      if (omniInput) omniInput.placeholder = emptyMap[contextType] || "记录...";
      call('setOmniBarVisible', call('shouldShowOmniBar'));
      if (!options.skipRender) {
        call('requestRenderAll');
      }
      call('renderGlobalHeaderActionPill');
      call('syncHeaderActionPillHitArea');
      call('syncMobileBottomNavState');
      if (!options.skipFocus) call('focusOmniInputSoon', 100);
      return true;
    }

    return {
      handleRoute,
      switchTab,
      openContextDetail,
      closeContextDetail,
    };
  }

  window.MorphViewCommandRuntime = {
    create: createViewCommandRuntime,
  };
})();
