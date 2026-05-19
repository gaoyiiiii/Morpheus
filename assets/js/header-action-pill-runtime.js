// @ts-check

(function initMorphHeaderActionPillRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphHeaderActionPillRuntime && typeof window.MorphHeaderActionPillRuntime.create === 'function') return;

  function createHeaderActionPillRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getDocumentRef() {
      if (typeof api.getDocumentRef === 'function') return api.getDocumentRef();
      if (typeof document !== 'undefined') return document;
      return null;
    }

    function getWindowRef() {
      if (typeof api.getWindowRef === 'function') return api.getWindowRef();
      if (typeof window !== 'undefined') return window;
      return null;
    }

    function coerceTrimmedString(value) {
      if (value == null) return '';
      const text = String(value).trim();
      if (!text || text === 'null' || text === 'undefined') return '';
      return text;
    }
    function getCurrentTab() {
      let tab = '';
      if (typeof api.getCurrentTab === 'function') tab = coerceTrimmedString(api.getCurrentTab());
      if (tab) return tab;
      try {
        const win = getWindowRef();
        tab = coerceTrimmedString(win?.currentTab);
      } catch (_) {}
      if (tab) return tab;
      try {
        const doc = getDocumentRef();
        const view = doc?.getElementById('view-project');
        if (view?.classList.contains('active')) return 'project';
      } catch (_) {}
      return '';
    }
    function getActiveLocalPluginWorkspaceId() { return String(typeof api.getActiveLocalPluginWorkspaceId === 'function' ? api.getActiveLocalPluginWorkspaceId() : '').trim(); }
    function getAIChatSessionDrawerOpen() { return typeof api.getAIChatSessionDrawerOpen === 'function' ? api.getAIChatSessionDrawerOpen() === true : false; }
    function getAIChatDrawerOpen() { return typeof api.getAIChatDrawerOpen === 'function' ? api.getAIChatDrawerOpen() === true : false; }
    function getAIChatHeaderMoreMenuOpen() { return typeof api.getAIChatHeaderMoreMenuOpen === 'function' ? api.getAIChatHeaderMoreMenuOpen() === true : false; }
    function getActiveProjectCollectionPane() { return String(typeof api.getActiveProjectCollectionPane === 'function' ? api.getActiveProjectCollectionPane() : '').trim(); }
    function getActiveProjectViewPane() { return String(typeof api.getActiveProjectViewPane === 'function' ? api.getActiveProjectViewPane() : '').trim(); }
    function getActiveContextId() {
      let id = '';
      if (typeof api.getActiveContextId === 'function') id = coerceTrimmedString(api.getActiveContextId());
      if (id) return id;
      try {
        const win = getWindowRef();
        id = coerceTrimmedString(win?.activeContextId);
      } catch (_) {}
      return id;
    }
    function getProjectVisualOrganizerPanelOpen() {
      return typeof api.getProjectVisualOrganizerPanelOpen === 'function'
        ? api.getProjectVisualOrganizerPanelOpen() === true
        : false;
    }
    function getScheduleViewPane() {
      return String(typeof api.getScheduleViewPane === 'function' ? api.getScheduleViewPane() : 'overview').trim() === 'history'
        ? 'history'
        : 'overview';
    }
    function normalizeThemeMode(value) {
      const mode = String(value || '').trim().toLowerCase();
      return mode === 'light' || mode === 'dark' || mode === 'system' ? mode : '';
    }
    function getThemeModePreference() {
      if (typeof api.getThemeMode === 'function') {
        const viaApi = normalizeThemeMode(api.getThemeMode());
        if (viaApi) return viaApi;
      }
      try {
        const win = getWindowRef();
        const storageApi = win?.MorphStorage || win?.LianXingStorage;
        const viaStorageApi = normalizeThemeMode(storageApi && typeof storageApi.getTheme === 'function' ? storageApi.getTheme() : '');
        if (viaStorageApi) return viaStorageApi;
        const viaLocalStorage = normalizeThemeMode(win?.localStorage?.getItem('lianxing_theme'));
        if (viaLocalStorage) return viaLocalStorage;
      } catch (_) {}
      const doc = getDocumentRef();
      return doc?.documentElement?.classList?.contains('dark') ? 'dark' : 'light';
    }
    function getProjectDetailContextIdFromDom() {
      const doc = getDocumentRef();
      if (!doc) return '';
      try {
        const view = doc.getElementById('view-project');
        const detail = doc.getElementById('project-detail');
        if (!view?.classList.contains('active')) return '';
        if (!detail || detail.classList.contains('hidden') || !detail.classList.contains('flex')) return '';
        const el = detail.querySelector('[data-context="project"][data-context-id]');
        return coerceTrimmedString(el?.getAttribute('data-context-id'));
      } catch (_) {
        return '';
      }
    }
    function getResolvedProjectContextId() {
      const fromApi = getActiveContextId();
      if (fromApi) return fromApi;
      return getProjectDetailContextIdFromDom();
    }

    function requestAnimationFrameRef(callback) {
      if (typeof api.requestAnimationFrameRef === 'function') return api.requestAnimationFrameRef(callback);
      const win = getWindowRef();
      if (win && typeof win.requestAnimationFrame === 'function') return win.requestAnimationFrame(callback);
      if (typeof callback === 'function') callback();
      return 0;
    }

    function requestLucideRefresh(options = {}) {
      if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh(options);
    }

    function syncHeaderActionPillHitArea() {
      const doc = getDocumentRef();
      if (!doc) return;
      const wrap = doc.getElementById('header-action-pill-global');
      if (!wrap) return;
      const isMulti = wrap.classList.contains('header-action-pill-multi');
      wrap.style.pointerEvents = 'auto';
      Array.from(wrap.querySelectorAll('*')).forEach((node) => {
        if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) return;
        node.style.pointerEvents = 'none';
      });
      if (!isMulti) return;
      Array.from(wrap.querySelectorAll('.header-action-pill-segment')).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        node.style.pointerEvents = 'auto';
      });
    }

    function renderGlobalHeaderActionPill() {
      const doc = getDocumentRef();
      if (!doc) return;
      const wrap = doc.getElementById('header-action-pill-global');
      const icon = doc.getElementById('header-action-pill-icon');
      const label = doc.getElementById('header-action-pill-label');
      const count = doc.getElementById('header-action-pill-count');
      const segments = doc.getElementById('header-action-pill-segments');
      if (!wrap || !icon || !label || !count || !segments) return;
      const menu = doc.getElementById('header-action-pill-menu');

      if (typeof api.applyAIChatSessionDrawerState === 'function') api.applyAIChatSessionDrawerState();

      const currentTab = getCurrentTab();
      const activeLocalPluginWorkspaceId = getActiveLocalPluginWorkspaceId();
      const activeContextId = currentTab === 'project' ? getResolvedProjectContextId() : getActiveContextId();
      const aiChatSessionDrawerOpen = getAIChatSessionDrawerOpen();
      const aiChatDrawerOpen = getAIChatDrawerOpen();
      const activeProjectCollectionPane = getActiveProjectCollectionPane();
      const activeProjectViewPane = getActiveProjectViewPane();
      const projectVisualOrganizerPanelOpen = getProjectVisualOrganizerPanelOpen();
      const scheduleViewPane = getScheduleViewPane();

      const shouldShow = ['project', 'health', 'finance', 'extensions', 'daily', 'schedule', 'channelOps', 'localPluginWorkspace', 'settings'].includes(currentTab);
      wrap.classList.toggle('hidden', !shouldShow);
      wrap.classList.toggle('inline-flex', shouldShow);
      if (typeof wrap.__headerActionHandler === 'function') {
        wrap.removeEventListener('click', wrap.__headerActionHandler);
        wrap.__headerActionHandler = null;
      }
      wrap.classList.remove('header-action-pill-multi');
      icon.classList.remove('hidden');
      label.classList.remove('hidden');
      count.classList.remove('hidden');
      segments.classList.add('hidden');
      segments.innerHTML = '';
      if (!shouldShow) {
        if (menu) menu.classList.add('hidden');
        return;
      }

      if (
        currentTab === 'finance'
        || (currentTab === 'localPluginWorkspace' && activeLocalPluginWorkspaceId === 'expense-ledger-plugin')
        || currentTab === 'daily'
        || currentTab === 'schedule'
        || currentTab === 'health'
        || currentTab === 'extensions'
        || currentTab === 'project'
      ) {
        wrap.classList.add('header-action-pill-multi');
        icon.classList.add('hidden');
        label.classList.add('hidden');
        count.classList.add('hidden');
        segments.classList.remove('hidden');

        if (currentTab === 'daily') {
          segments.innerHTML = `
                <button type="button" class="header-action-pill-segment" data-action="calendar" aria-label="切换月份" title="切换月份">
                    <i data-lucide="calendar-range" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment" data-action="history" aria-label="查看历史记录" title="历史记录">
                    <i data-lucide="history" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment" data-action="more" aria-label="更多" title="更多">
                    <i data-lucide="ellipsis" class="w-4 h-4"></i>
                </button>
            `;
        } else if (currentTab === 'schedule') {
          segments.innerHTML = `
                <button type="button" class="header-action-pill-segment" data-action="rhythm-create" aria-label="新增节律" title="新增节律">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment ${scheduleViewPane === 'history' ? 'is-active' : ''}" data-action="rhythm-calendar" aria-label="节律日历" title="节律日历" aria-pressed="${scheduleViewPane === 'history' ? 'true' : 'false'}">
                    <i data-lucide="calendar-days" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment" data-action="more" aria-label="更多" title="更多">
                    <i data-lucide="ellipsis" class="w-4 h-4"></i>
                </button>
            `;
        } else if (currentTab === 'health') {
          segments.innerHTML = `
                <button type="button" class="header-action-pill-segment" data-action="refresh-health" aria-label="刷新健康数据" title="刷新">
                    <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment" data-action="health-placeholder" aria-label="健康概览" title="健康概览">
                    <i data-lucide="activity" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment" data-action="more" aria-label="更多" title="更多">
                    <i data-lucide="ellipsis" class="w-4 h-4"></i>
                </button>
            `;
        } else if (currentTab === 'project' && !activeContextId) {
          if (typeof api.normalizeProjectCollectionPane === 'function') api.normalizeProjectCollectionPane();
          if (typeof api.normalizeProjectSpaceId === 'function') api.normalizeProjectSpaceId();
          segments.innerHTML = `
                <button type="button" class="header-action-pill-segment" data-action="more" aria-label="更多" title="更多">
                    <i data-lucide="ellipsis" class="w-4 h-4"></i>
                </button>
            `;
        } else if (currentTab === 'project' && activeContextId) {
          segments.innerHTML = `
                <button type="button" class="header-action-pill-segment" data-action="project-create" aria-label="新建项目" title="新建项目">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment ${projectVisualOrganizerPanelOpen ? 'is-active' : ''}" data-action="visual-organizer" aria-label="视觉图形" title="视觉图形" aria-pressed="${projectVisualOrganizerPanelOpen ? 'true' : 'false'}">
                    <i data-lucide="waypoints" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment" data-action="more" aria-label="更多" title="更多">
                    <i data-lucide="ellipsis" class="w-4 h-4"></i>
                </button>
            `;
        } else if (currentTab === 'extensions') {
          segments.innerHTML = `
                <button type="button" class="header-action-pill-segment" data-action="add-local" aria-label="添加本地插件" title="添加本地插件">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment" data-action="market" aria-label="去市集" title="去市集">
                    <i data-lucide="compass" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment" data-action="more" aria-label="更多" title="更多">
                    <i data-lucide="ellipsis" class="w-4 h-4"></i>
                </button>
            `;
        } else {
          segments.innerHTML = `
                <button type="button" class="header-action-pill-segment" data-action="add" aria-label="手动添加记账" title="手动添加">
                    <i data-lucide="square-pen" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment" data-action="import" aria-label="导入账单" title="导入账单">
                    <i data-lucide="upload" class="w-4 h-4"></i>
                </button>
                <button type="button" class="header-action-pill-segment" data-action="more" aria-label="更多" title="更多">
                    <i data-lucide="ellipsis" class="w-4 h-4"></i>
                </button>
            `;
        }

        segments.querySelectorAll('.header-action-pill-segment').forEach((button) => {
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const action = String(button.dataset.action || '').trim();
            const tabNow = getCurrentTab();
            const contextIdNow = tabNow === 'project' ? getResolvedProjectContextId() : getActiveContextId();

            if (action === 'more' && tabNow === 'project' && contextIdNow && typeof api.openContextCardMenuFromTrigger === 'function') {
              api.openContextCardMenuFromTrigger(event, 'project', contextIdNow, { source: 'project-detail-header' });
              return;
            }

            if (action === 'more') {
              if (typeof api.openCustomModal === 'function') {
                api.openCustomModal({ title: '更多', desc: '这里暂时作为页面更多动作入口。' });
              }
              return;
            }

            if (tabNow === 'ai') {
              if (action === 'add') {
                if (typeof api.setAIChatHeaderMoreMenuOpen === 'function') api.setAIChatHeaderMoreMenuOpen(false);
                if (typeof api.startNewAIChatSession === 'function') api.startNewAIChatSession();
                return;
              }
              if (action === 'directory') {
                if (typeof api.setAIChatHeaderMoreMenuOpen === 'function') api.setAIChatHeaderMoreMenuOpen(false);
                if (typeof api.setAIChatSessionDrawerOpen === 'function') api.setAIChatSessionDrawerOpen(!getAIChatSessionDrawerOpen());
                renderGlobalHeaderActionPill();
                return;
              }
              if (action === 'chat') {
                if (typeof api.setAIChatHeaderMoreMenuOpen === 'function') api.setAIChatHeaderMoreMenuOpen(false);
                if (typeof api.setAIChatDrawerOpen === 'function') api.setAIChatDrawerOpen(!getAIChatDrawerOpen());
                renderGlobalHeaderActionPill();
              }
              return;
            }

            if (tabNow === 'daily') {
              if (action === 'calendar') {
                if (typeof api.toggleDailyMonthPillMenu === 'function') api.toggleDailyMonthPillMenu();
                return;
              }
              if (action === 'history') {
                if (typeof api.setDailyMonthPillMenuOpen === 'function') api.setDailyMonthPillMenuOpen(false);
                if (typeof api.openVersionedEditorHistory === 'function' && typeof api.ensureSelectedDailyMonth === 'function') {
                  api.openVersionedEditorHistory('daily', api.ensureSelectedDailyMonth());
                }
                return;
              }
              if (action === 'chat') {
                if (typeof api.setDailyMonthPillMenuOpen === 'function') api.setDailyMonthPillMenuOpen(false);
                if (typeof api.setAIChatDrawerOpen === 'function') api.setAIChatDrawerOpen(!getAIChatDrawerOpen());
              }
              return;
            }

            if (tabNow === 'schedule') {
              if (action === 'rhythm-create') {
                if (typeof api.openCreateRhythmModal === 'function') api.openCreateRhythmModal();
                return;
              }
              if (action === 'rhythm-calendar') {
                if (typeof api.setScheduleViewPane === 'function') api.setScheduleViewPane('history');
                return;
              }
              if (action === 'chat' && typeof api.setAIChatDrawerOpen === 'function') api.setAIChatDrawerOpen(!getAIChatDrawerOpen());
              return;
            }

            if (tabNow === 'health') {
              if (action === 'refresh-health') {
                if (typeof api.refreshHealthViewPrimary === 'function') api.refreshHealthViewPrimary();
                else if (typeof api.fetchGlucoseHistoryForHealth === 'function') api.fetchGlucoseHistoryForHealth({ force: true, silent: false });
                return;
              }
              if (action === 'chat' && typeof api.setAIChatDrawerOpen === 'function') api.setAIChatDrawerOpen(!getAIChatDrawerOpen());
              return;
            }

            if (tabNow === 'project' && contextIdNow) {
              if (action === 'project-create') {
                if (typeof api.createRootProjectFromHeaderPill === 'function') api.createRootProjectFromHeaderPill();
                else if (typeof api.promptCreateContext === 'function') api.promptCreateContext('project', { parentProjectId: '' });
                return;
              }
              if (action === 'visual-organizer') {
                if (typeof api.setProjectVisualOrganizerPanelOpen === 'function') api.setProjectVisualOrganizerPanelOpen(!getProjectVisualOrganizerPanelOpen());
                return;
              }
              if (action === 'chat' && typeof api.setAIChatDrawerOpen === 'function') api.setAIChatDrawerOpen(!getAIChatDrawerOpen());
              return;
            }

            if (tabNow === 'project') {
              if (action === 'chat') {
                if (typeof api.setProjectArchivePillMenuOpen === 'function') api.setProjectArchivePillMenuOpen(false);
                if (typeof api.setAIChatDrawerOpen === 'function') api.setAIChatDrawerOpen(!getAIChatDrawerOpen());
              }
              return;
            }

            if (tabNow === 'extensions') {
              if (action === 'add-local' && typeof api.triggerLocalPluginCatalogImport === 'function') api.triggerLocalPluginCatalogImport();
              if (action === 'market' && typeof api.openExtensionMarketplace === 'function') api.openExtensionMarketplace();
              if (action === 'chat' && typeof api.setAIChatDrawerOpen === 'function') api.setAIChatDrawerOpen(!getAIChatDrawerOpen());
              return;
            }

            if (action === 'add') {
              const win = getWindowRef();
              if (typeof win?.openExpenseLedgerManualAddModal === 'function') win.openExpenseLedgerManualAddModal();
              return;
            }
            if (action === 'import') {
              if (typeof api.executeIntegratedExtensionCommand === 'function') api.executeIntegratedExtensionCommand('expense-ledger-plugin', 'import-ledger-csv');
              return;
            }
            if (action === 'chat') {
              if (typeof api.setAIChatDrawerOpen === 'function') api.setAIChatDrawerOpen(!getAIChatDrawerOpen());
            }
          });
        });

        if (menu) menu.classList.add('hidden');
        requestLucideRefresh({ root: wrap });
        syncHeaderActionPillHitArea();
        requestAnimationFrameRef(syncHeaderActionPillHitArea);
        if (typeof api.renderAIChatHeaderMoreMenu === 'function') api.renderAIChatHeaderMoreMenu();
        if (typeof api.renderDailyMonthPillMenu === 'function') api.renderDailyMonthPillMenu();
        if (typeof api.renderSettingsThemePillMenu === 'function') api.renderSettingsThemePillMenu();
        if (typeof api.renderProjectCreatePillMenu === 'function') api.renderProjectCreatePillMenu();
        if (typeof api.renderProjectArchivePillMenu === 'function') api.renderProjectArchivePillMenu();
        if (typeof api.renderProjectSpacePillMenu === 'function') api.renderProjectSpacePillMenu();
        return;
      }

      let iconName = 'plus';
      let labelText = '动作';
      let countText = '';
      let onClick = null;

      if (currentTab === 'ai') {
        iconName = 'square-pen';
        labelText = '新建对话';
        onClick = () => { if (typeof api.startNewAIChatSession === 'function') api.startNewAIChatSession(); };
      } else if (currentTab === 'project' && activeContextId) {
        iconName = 'list';
        labelText = '项目目录';
        countText = '';
        onClick = null;
      } else if (currentTab === 'project') {
        iconName = 'plus';
        labelText = '新建项目';
        onClick = () => { if (typeof api.promptCreateContext === 'function') api.promptCreateContext('project'); };
      } else if (currentTab === 'health') {
        iconName = 'refresh-cw';
        labelText = '刷新';
        onClick = () => {
          if (typeof api.refreshHealthViewPrimary === 'function') api.refreshHealthViewPrimary();
          else if (typeof api.fetchGlucoseHistoryForHealth === 'function') api.fetchGlucoseHistoryForHealth({ force: true, silent: false });
        };
      } else if (currentTab === 'finance') {
        iconName = 'upload';
        labelText = '导入数据';
        onClick = () => { if (typeof api.executeIntegratedExtensionCommand === 'function') api.executeIntegratedExtensionCommand('expense-ledger-plugin', 'import-ledger-csv'); };
      } else if (currentTab === 'channelOps') {
        iconName = 'refresh-cw';
        labelText = '刷新';
        onClick = () => { if (typeof api.refreshChannelOpsView === 'function') api.refreshChannelOpsView(true); };
      } else if (currentTab === 'localPluginWorkspace' && activeLocalPluginWorkspaceId) {
        const workspaceActions = typeof api.getIntegratedExtensionWorkspaceHeaderActions === 'function'
          ? api.getIntegratedExtensionWorkspaceHeaderActions(activeLocalPluginWorkspaceId)
          : null;
        const primaryAction = Array.isArray(workspaceActions) ? workspaceActions[0] : null;
        if (primaryAction?.commandId) {
          iconName = String(primaryAction.icon || 'sparkles').trim() || 'sparkles';
          labelText = String(primaryAction.label || '动作').trim() || '动作';
          onClick = () => {
            if (typeof api.executeIntegratedExtensionWorkspaceAction === 'function') {
              api.executeIntegratedExtensionWorkspaceAction(activeLocalPluginWorkspaceId, primaryAction.commandId);
            }
          };
        }
      } else if (currentTab === 'daily') {
        iconName = 'calendar-range';
        labelText = typeof api.getDailyMonthPillLabel === 'function' && typeof api.ensureSelectedDailyMonth === 'function'
          ? api.getDailyMonthPillLabel(api.ensureSelectedDailyMonth())
          : '月份';
        onClick = () => { if (typeof api.toggleDailyMonthPillMenu === 'function') api.toggleDailyMonthPillMenu(); };
      } else if (currentTab === 'settings') {
        const themeMode = getThemeModePreference();
        const isDark = doc.documentElement.classList.contains('dark');
        if (themeMode === 'system') {
          iconName = 'monitor';
          labelText = '跟随系统';
        } else {
          iconName = isDark ? 'moon' : 'sun';
          labelText = isDark ? '深色模式' : '浅色模式';
        }
        onClick = () => { if (typeof api.toggleSettingsThemePillMenu === 'function') api.toggleSettingsThemePillMenu(); };
      }

      icon.setAttribute('data-lucide', iconName);
      label.textContent = labelText;
      count.textContent = countText;
      count.classList.toggle('hidden', !countText);
      if (typeof onClick === 'function') {
        wrap.__headerActionHandler = (event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        };
        wrap.addEventListener('click', wrap.__headerActionHandler);
      }

      requestLucideRefresh({ root: wrap });
      syncHeaderActionPillHitArea();
      requestAnimationFrameRef(syncHeaderActionPillHitArea);
      if (typeof api.renderDailyMonthPillMenu === 'function') api.renderDailyMonthPillMenu();
      if (typeof api.renderSettingsThemePillMenu === 'function') api.renderSettingsThemePillMenu();
      if (typeof api.renderProjectArchivePillMenu === 'function') api.renderProjectArchivePillMenu();
    }

    return {
      syncHeaderActionPillHitArea,
      renderGlobalHeaderActionPill,
    };
  }

  window.MorphHeaderActionPillRuntime = {
    create: createHeaderActionPillRuntime,
  };
})();
