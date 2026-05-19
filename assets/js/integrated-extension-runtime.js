(function initMorphIntegratedExtensionRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphIntegratedExtensionRuntime && typeof window.MorphIntegratedExtensionRuntime.create === 'function') return;
  const BUILTIN_FLEETING_FEATURE_ID = 'fleeting-station';
  const HIDDEN_EXTENSION_IDS = new Set([]);

  function createIntegratedExtensionRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getWindowRef() {
      return api.windowRef || window;
    }

    function getDocumentRef() {
      return api.documentRef || document;
    }

    function getExtensionsRuntime() {
      return typeof api.getExtensionsRuntimeModules === 'function' ? api.getExtensionsRuntimeModules() : null;
    }

    function getCatalog() {
      if (typeof api.getCachedExtensionCatalog === 'function') return api.getCachedExtensionCatalog() || null;
      const runtime = getExtensionsRuntime();
      return runtime && typeof runtime.getCachedCatalog === 'function' ? runtime.getCachedCatalog() || null : null;
    }

    async function loadOfficialExtensionCatalog() {
      if (typeof api.loadOfficialExtensionCatalog === 'function') {
        return api.loadOfficialExtensionCatalog();
      }
      const runtime = getExtensionsRuntime();
      if (runtime && typeof runtime.loadOfficialExtensionCatalog === 'function') {
        return runtime.loadOfficialExtensionCatalog();
      }
      return null;
    }

    function getCurrentTab() {
      return typeof api.getCurrentTab === 'function' ? String(api.getCurrentTab() || '').trim() : '';
    }

    function getActiveLocalPluginWorkspaceId() {
      return typeof api.getActiveLocalPluginWorkspaceId === 'function'
        ? String(api.getActiveLocalPluginWorkspaceId() || '').trim()
        : '';
    }

    function setActiveLocalPluginWorkspaceId(value = '') {
      if (typeof api.setActiveLocalPluginWorkspaceId === 'function') {
        api.setActiveLocalPluginWorkspaceId(String(value || '').trim());
      }
    }

    function isMobileNavMode() {
      return typeof api.isMobileNavMode === 'function' ? api.isMobileNavMode() === true : false;
    }

    function getIsDrawerOpen() {
      return typeof api.getIsDrawerOpen === 'function' ? api.getIsDrawerOpen() === true : false;
    }

    function setIsDrawerOpen(next = false) {
      if (typeof api.setIsDrawerOpen === 'function') {
        api.setIsDrawerOpen(next === true);
      }
    }

    function requestDrawerRender() {
      if (typeof api.requestDrawerRender === 'function') api.requestDrawerRender();
    }

    function prepareFleetingDrawerOpen() {
      if (typeof api.prepareFleetingDrawerOpen === 'function') api.prepareFleetingDrawerOpen();
    }

    function requestLucideRefresh(options = {}) {
      if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh(options);
    }

    function openCustomModal(options = {}) {
      if (typeof api.openCustomModal === 'function') api.openCustomModal(options);
    }

    function requestExtensionSurfaceRefresh() {
      if (typeof api.refreshExtensionSurfaceBindings === 'function') {
        api.refreshExtensionSurfaceBindings();
      }
    }

    async function fetchLocalApi(path = '', options = {}) {
      if (typeof api.fetchLocalApiWithFallback === 'function') {
        return api.fetchLocalApiWithFallback(path, options);
      }
      const target = String(path || '').trim();
      if (!target || typeof fetch !== 'function') throw new Error('local_api_unavailable');
      return fetch(target, options);
    }

    function syncDesktopRightDrawerOpenClass() {
      if (typeof api.syncDesktopRightDrawerOpenClass === 'function') {
        api.syncDesktopRightDrawerOpenClass();
        return;
      }
      const body = getDocumentRef().body;
      if (!body) return;
      body.classList.toggle('drawer-open-desktop', getIsDrawerOpen() && !isMobileNavMode());
    }

    function openLocalPluginWorkspace(id = '') {
      if (typeof api.openLocalPluginWorkspace === 'function') api.openLocalPluginWorkspace(id);
    }

    function openExtensionSettings(key = '') {
      if (typeof api.openExtensionSettings === 'function') api.openExtensionSettings(key);
    }

    function setExtensionEnabled(key = '', next = true, options = {}) {
      if (typeof api.setExtensionEnabled === 'function') {
        return api.setExtensionEnabled(key, next, options);
      }
      return false;
    }

    function openLocalPluginSettingsModal(definition = null) {
      if (typeof api.openLocalPluginSettingsModal === 'function') api.openLocalPluginSettingsModal(definition);
    }

    function switchTab(target = '', sync = false) {
      if (typeof api.switchTab === 'function') api.switchTab(target, sync);
    }

    function isExtensionEnabled(key = '') {
      return typeof api.isExtensionEnabled === 'function' ? api.isExtensionEnabled(key) === true : true;
    }

    function isBuiltinHostFeatureId(id = '') {
      return String(id || '').trim() === BUILTIN_FLEETING_FEATURE_ID;
    }

    function isHiddenExtensionId(id = '') {
      return HIDDEN_EXTENSION_IDS.has(String(id || '').trim());
    }

    function escapeHTML(value = '') {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function getIntegratedExtensionDefinitions() {
      const catalog = getCatalog();
      return Array.isArray(catalog?.extensions)
        ? catalog.extensions.filter((item) => !isBuiltinHostFeatureId(item?.id) && !isHiddenExtensionId(item?.id)).slice()
        : [];
    }

    function getExtensionDefinitionById(id = '') {
      const normalized = String(id || '').trim();
      if (!normalized) return null;
      return getIntegratedExtensionDefinitions().find((item) => String(item?.id || '').trim() === normalized) || null;
    }

    function getCurrentExtensionClientTarget() {
      return isMobileNavMode() ? 'mobile' : 'desktop';
    }

    function isExtensionClientTargetAllowed(targets = []) {
      const list = Array.isArray(targets)
        ? targets.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      if (!list.length) return true;
      return list.includes(getCurrentExtensionClientTarget());
    }

    function isIntegratedExtensionSurfaceVisible(definition = null, surfaceKey = '') {
      const host = definition?.hostIntegration && typeof definition.hostIntegration === 'object'
        ? definition.hostIntegration
        : null;
      if (!host) return false;
      if (!isExtensionClientTargetAllowed(host.platforms)) return false;
      if (!surfaceKey) return true;
      const surface = host[surfaceKey];
      if (!surface || typeof surface !== 'object') return false;
      return isExtensionClientTargetAllowed(surface.platforms);
    }

    function getIntegratedExtensionDataModel(extensionId = '') {
      const definition = getExtensionDefinitionById(extensionId);
      return definition?.dataModel && typeof definition.dataModel === 'object' ? definition.dataModel : null;
    }

    function findIntegratedExtensionByCreatedItemTarget(targetTab = '') {
      const normalized = String(targetTab || '').trim();
      if (!normalized) return null;
      return getIntegratedExtensionDefinitions().find((item) => Array.isArray(item?.hostIntegration?.createdItemTargets) && item.hostIntegration.createdItemTargets.includes(normalized)) || null;
    }

    function getIntegratedExtensionContextPanels(target = '') {
      const normalized = String(target || '').trim();
      if (!normalized) return [];
      return getIntegratedExtensionDefinitions().flatMap((item) => {
        const panels = Array.isArray(item?.hostIntegration?.contextPanels) ? item.hostIntegration.contextPanels : [];
        return panels
          .filter((panel) => isIntegratedExtensionSurfaceVisible(item, 'contextPanels') && isExtensionClientTargetAllowed(panel?.platforms))
          .filter((panel) => String(panel?.target || '').trim() === normalized)
          .map((panel) => ({ ...panel, extensionId: item.id, extensionName: item.name, definition: item }));
      });
    }

    function getIntegratedExtensionCommands(extensionId = '') {
      const definition = getExtensionDefinitionById(extensionId);
      return Array.isArray(definition?.commands) ? definition.commands.slice() : [];
    }

    function buildIntegratedExtensionCommandExecutePath(extensionId = '', commandId = '') {
      const normalizedExtensionId = String(extensionId || '').trim();
      const normalizedCommandId = String(commandId || '').trim();
      if (!normalizedExtensionId || !normalizedCommandId) return '';
      return `/api/morph/plugins/${encodeURIComponent(normalizedExtensionId)}/commands/${encodeURIComponent(normalizedCommandId)}`;
    }

    function shouldExecuteIntegratedExtensionViaPluginCommand(command = null) {
      const entry = command && typeof command === 'object' ? command : null;
      if (!entry || entry.aiCallable !== true) return false;
      const executionTarget = String(entry.executionTarget || '').trim();
      return executionTarget === 'host-action' || executionTarget === 'plugin-runtime';
    }

    function extractIntegratedExtensionCommandErrorMessage(result = null, fallback = '') {
      const source = result && typeof result === 'object' ? result : null;
      return [
        source?.userMessage,
        source?.error,
        source?.message,
        source?.receipt?.message,
        source?.verifier?.userMessage,
        fallback,
      ].map((item) => String(item || '').trim()).find(Boolean) || '执行失败';
    }

    async function executeIntegratedExtensionCommandRequest(extensionId = '', commandId = '', payload = null, options = {}) {
      const normalizedExtensionId = String(extensionId || '').trim();
      const normalizedCommandId = String(commandId || '').trim();
      if (!normalizedExtensionId || !normalizedCommandId) {
        return { ok: false, error: 'extensionId and commandId are required' };
      }
      const definition = getExtensionDefinitionById(normalizedExtensionId);
      const command = getIntegratedExtensionCommands(normalizedExtensionId)
        .find((item) => String(item?.id || '').trim() === normalizedCommandId);
      if (!definition || !command) {
        return {
          ok: false,
          error: 'plugin command not found',
          pluginId: normalizedExtensionId,
          commandId: normalizedCommandId,
        };
      }
      const action = String(command.action || '').trim();
      if (action !== 'open-settings' && !isExtensionEnabled(normalizedExtensionId)) {
        return {
          ok: false,
          error: 'plugin is disabled',
          pluginId: normalizedExtensionId,
          commandId: normalizedCommandId,
        };
      }
      if (!shouldExecuteIntegratedExtensionViaPluginCommand(command)) {
        return {
          ok: false,
          error: 'plugin command is not routed through host execute path',
          pluginId: normalizedExtensionId,
          commandId: normalizedCommandId,
        };
      }
      const requestPayload = payload && typeof payload === 'object' ? { ...payload } : {};
      const executePath = String(command.executePath || '').trim()
        || buildIntegratedExtensionCommandExecutePath(normalizedExtensionId, normalizedCommandId);
      try {
        const response = await fetchLocalApi(executePath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        });
        const result = response && typeof response.json === 'function'
          ? await response.json().catch(() => null)
          : null;
        if (!response?.ok || result?.ok === false) {
          const errorMessage = extractIntegratedExtensionCommandErrorMessage(result, `HTTP ${Number(response?.status || 500)}`);
          if (options?.silent !== true) {
            openCustomModal({
              title: '执行失败',
              desc: errorMessage,
            });
          }
          return {
            ok: false,
            error: errorMessage,
            status: Number(response?.status || 500),
            pluginId: normalizedExtensionId,
            commandId: normalizedCommandId,
            result,
          };
        }
        if (options?.refresh !== false) requestExtensionSurfaceRefresh();
        return result && typeof result === 'object'
          ? result
          : {
              ok: true,
              pluginId: normalizedExtensionId,
              commandId: normalizedCommandId,
            };
      } catch (error) {
        const errorMessage = extractIntegratedExtensionCommandErrorMessage(null, error?.message || '执行失败');
        if (options?.silent !== true) {
          openCustomModal({
            title: '执行失败',
            desc: errorMessage,
          });
        }
        return {
          ok: false,
          error: errorMessage,
          pluginId: normalizedExtensionId,
          commandId: normalizedCommandId,
        };
      }
    }

    function getIntegratedExtensionWorkspaceHeaderActions(extensionId = '') {
      const definition = getExtensionDefinitionById(extensionId);
      const commands = getIntegratedExtensionCommands(extensionId);
      const actions = Array.isArray(definition?.hostIntegration?.workspaceHeaderActions)
        ? definition.hostIntegration.workspaceHeaderActions.slice()
        : [];
      const normalizedExtensionId = String(extensionId || '').trim();
      const shouldHideWorkspaceAction = (action = null) => {
        if (!action) return false;
        const commandId = String(action?.commandId || '').trim();
        const label = String(action?.label || '').trim();
        return commandId === 'open-ai-chat' || label === '去 AI';
      };
      const resolveCommand = (commandId = '') => commands.find((item) => String(item?.id || '').trim() === String(commandId || '').trim()) || null;
      const canConfigure = !!(
        definition
        && (
          String(definition?.settingsTarget || '').trim()
          || commands.some((item) => String(item?.action || '').trim() === 'open-settings')
        )
      );
      const normalizedActions = actions.filter((action) => (
        isIntegratedExtensionSurfaceVisible(definition, 'workspaceHeaderActions')
        && isExtensionClientTargetAllowed(action?.platforms)
        && !shouldHideWorkspaceAction(action)
      )).map((action) => {
        const command = resolveCommand(action?.commandId || '');
        const isSettingsAction = String(action?.commandId || '').trim() === 'open-extension-settings'
          || String(command?.action || '').trim() === 'open-settings';
        return {
          ...action,
          label: isSettingsAction ? '配置' : action?.label,
          icon: isSettingsAction ? 'settings-2' : action?.icon,
          extensionId: normalizedExtensionId,
        };
      });
      const hasSettingsAction = normalizedActions.some((action) => String(action?.commandId || '').trim() === 'open-extension-settings'
        || String(resolveCommand(action?.commandId || '')?.action || '').trim() === 'open-settings');
      if (canConfigure && !hasSettingsAction) {
        normalizedActions.unshift({
          id: `${normalizedExtensionId}-workspace-config`,
          label: '配置',
          icon: 'settings-2',
          commandId: 'open-extension-settings',
          variant: 'ghost',
          extensionId: normalizedExtensionId,
        });
      }
      return normalizedActions;
    }

    function getIntegratedExtensionWorkspaceShell(extensionId = '') {
      const definition = getExtensionDefinitionById(extensionId);
      const shell = definition?.ui?.workspaceShell;
      if (!shell || typeof shell !== 'object') return null;
      return {
        eyebrow: String(shell.eyebrow || '').trim(),
        title: String(shell.title || '').trim(),
        englishTitle: String(shell.englishTitle || '').trim(),
        description: String(shell.description || '').trim(),
        backLabel: String(shell.backLabel || '').trim(),
      };
    }

    function isFinanceExtensionDefinition(definition = null) {
      const tags = Array.isArray(definition?.tags) ? definition.tags.map((item) => String(item || '').toLowerCase()) : [];
      const category = String(definition?.category || '').toLowerCase();
      const id = String(definition?.id || '').toLowerCase();
      return tags.includes('finance') || tags.includes('expense-ledger') || category === 'finance' || /expense|ledger|finance|budget|bill/.test(id);
    }

    function isIntegratedDrawerActive(extensionDefinition = null) {
      const drawerId = String(extensionDefinition?.hostIntegration?.drawerEntry?.drawerId || '').trim();
      if (!drawerId) return false;
      if (drawerId === 'fleeting') return getIsDrawerOpen();
      return false;
    }

    function setIntegratedDrawerOpen(drawerId = '', open = null) {
      const normalized = String(drawerId || '').trim();
      if (!normalized || isMobileNavMode()) return false;
      if (normalized === 'fleeting') {
        const drawer = getDocumentRef().getElementById('fleeting-drawer');
        if (!drawer) return false;
        const nextOpen = typeof open === 'boolean' ? open : !getIsDrawerOpen();
        setIsDrawerOpen(nextOpen);
        syncDesktopRightDrawerOpenClass();
        drawer.classList.toggle('open', nextOpen);
        drawer.classList.toggle('translate-x-full', !nextOpen);
        drawer.classList.toggle('translate-x-0', nextOpen);
        drawer.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
        if (nextOpen) {
          prepareFleetingDrawerOpen();
          requestDrawerRender();
        }
        void renderHostIntegratedExtensionEntries();
        return true;
      }
      return false;
    }

    function executeIntegratedExtensionCommand(extensionId = '', commandId = '') {
      const normalizedExtensionId = String(extensionId || '').trim();
      const normalizedCommandId = String(commandId || '').trim();
      if (!normalizedExtensionId || !normalizedCommandId) return false;
      const definition = getExtensionDefinitionById(normalizedExtensionId);
      const command = getIntegratedExtensionCommands(normalizedExtensionId)
        .find((item) => String(item?.id || '').trim() === normalizedCommandId);
      if (!definition || !command) return false;
      const action = String(command.action || '').trim();
      if (action !== 'open-settings' && !isExtensionEnabled(normalizedExtensionId)) return false;
      if (action === 'open-workspace') {
        openLocalPluginWorkspace(normalizedExtensionId);
        return true;
      }
      if (action === 'open-settings') {
        openExtensionSettings(definition.settingsTarget || normalizedExtensionId);
        return true;
      }
      if (action === 'open-drawer') {
        const drawerId = String(definition?.hostIntegration?.drawerEntry?.drawerId || command.target || '').trim();
        if (drawerId) return setIntegratedDrawerOpen(drawerId);
        return false;
      }
      if (action === 'switch-tab') {
        const target = String(command.target || '').trim();
        if (!target) return false;
        switchTab(target, true);
        return true;
      }
      if (normalizedExtensionId === 'expense-ledger-plugin' && normalizedCommandId === 'import-ledger-csv') {
        const financeInput = getDocumentRef().getElementById('finance-csv-input');
        const currentTab = getCurrentTab();
        if (currentTab === 'finance' && financeInput) {
          financeInput.value = '';
          if (typeof financeInput.showPicker === 'function') {
            try { financeInput.showPicker(); return true; } catch (_) {}
          }
          financeInput.click();
          return true;
        }
        const win = getWindowRef();
        if (typeof win.triggerExpenseLedgerCsvImport === 'function') {
          win.triggerExpenseLedgerCsvImport();
          return true;
        }
        return false;
      }
      if (shouldExecuteIntegratedExtensionViaPluginCommand(command)) {
        void executeIntegratedExtensionCommandRequest(normalizedExtensionId, normalizedCommandId);
        return true;
      }
      return false;
    }

    function executeIntegratedExtensionWorkspaceAction(extensionId = '', commandId = '') {
      return executeIntegratedExtensionCommand(extensionId, commandId);
    }

    function getIntegratedExtensionChatShortcuts(target = '') {
      const normalized = String(target || '').trim();
      return getIntegratedExtensionDefinitions().flatMap((item) => {
        const shortcuts = Array.isArray(item?.hostIntegration?.chatShortcuts) ? item.hostIntegration.chatShortcuts : [];
        return shortcuts
          .filter((shortcut) => isIntegratedExtensionSurfaceVisible(item, 'chatShortcuts') && isExtensionClientTargetAllowed(shortcut?.platforms))
          .filter((shortcut) => !normalized || String(shortcut?.target || '').trim() === normalized)
          .map((shortcut) => ({ ...shortcut, extensionId: item.id, extensionName: item.name, definition: item }));
      });
    }

    function getIntegratedExtensionStorageDescriptor(extensionId = '') {
      const definition = getExtensionDefinitionById(extensionId);
      if (!definition) return null;
      const model = getIntegratedExtensionDataModel(extensionId) || {};
      const namespace = String(model.namespace || extensionId).trim() || extensionId;
      const stateMode = String(model.state || 'none').trim() || 'none';
      const historyMode = String(model.history || 'none').trim() || 'none';
      const syncPolicy = String(model.syncPolicy || 'inherit-root').trim() || 'inherit-root';
      const sharedDomains = Array.isArray(model.sharedDomains) ? model.sharedDomains.filter(Boolean) : [];
      const statePath = stateMode === 'root-pluginData' ? `pluginData.${namespace}` : '';
      const fileBaseDir = historyMode === 'file-backed' ? `data/plugins/${namespace}/` : '';
      return {
        namespace,
        stateMode,
        historyMode,
        syncPolicy,
        sharedDomains,
        statePath,
        fileBaseDir,
        stateFilePath: fileBaseDir ? `${fileBaseDir}state.json` : '',
        eventsPath: fileBaseDir ? `${fileBaseDir}events.ndjson` : '',
        historyPath: fileBaseDir ? `${fileBaseDir}events.ndjson` : '',
      };
    }

    function getIntegratedExtensionStorageFacts(extensionId = '') {
      const descriptor = getIntegratedExtensionStorageDescriptor(extensionId);
      if (!descriptor) return [];
      const stateModeLabelMap = {
        'none': '无独立状态',
        'shared-domain': '共享业务域',
        'root-pluginData': '扩展私有状态',
        'file-backed': '文件型状态',
      };
      const historyModeLabelMap = {
        'none': '无独立历史文件',
        'root-inline': '跟随主数据快照',
        'file-backed': '独立历史文件',
      };
      const syncPolicyLabelMap = {
        'inherit-root': '跟随主数据同步',
        'local-only': '仅本地',
        'manual-export': '手动导出',
      };
      const facts = [
        `命名空间：${descriptor.namespace}`,
        `状态层：${stateModeLabelMap[descriptor.stateMode] || descriptor.stateMode}`,
        `历史层：${historyModeLabelMap[descriptor.historyMode] || descriptor.historyMode}`,
        `同步策略：${syncPolicyLabelMap[descriptor.syncPolicy] || descriptor.syncPolicy}`,
      ];
      if (descriptor.statePath) facts.push(`状态路径：${descriptor.statePath}`);
      if (descriptor.fileBaseDir) facts.push(`文件目录：${descriptor.fileBaseDir}`);
      if (descriptor.sharedDomains.length) facts.push(`共享域：${descriptor.sharedDomains.join('、')}`);
      return facts;
    }

    function openIntegratedExtensionEntry(extensionId = '') {
      const normalized = String(extensionId || '').trim();
      if (!normalized) return;
      if (isBuiltinHostFeatureId(normalized)) {
        if (setIntegratedDrawerOpen('fleeting')) return;
        switchTab('flashThoughts', true);
        return;
      }
      const definition = getExtensionDefinitionById(normalized);
      setExtensionEnabled(normalized, true, { silent: true });
      const entryCommandId = String(definition?.hostIntegration?.entryCommandId || '').trim();
      if (entryCommandId && executeIntegratedExtensionCommand(normalized, entryCommandId)) {
        return;
      }
      if (definition?.ui?.primaryAction === 'open-drawer' && definition?.hostIntegration?.drawerEntry?.drawerId) {
        if (setIntegratedDrawerOpen(definition.hostIntegration.drawerEntry.drawerId)) return;
        switchTab('flashThoughts', true);
        return;
      }
      if (definition?.ui?.primaryAction === 'open-workspace') {
        openLocalPluginWorkspace(normalized);
        return;
      }
      if (definition) {
        openLocalPluginSettingsModal(definition);
        return;
      }
      openLocalPluginWorkspace(normalized);
    }

    function activateIntegratedExtension(extensionId = '', preferredCommandId = '', postActionName = '') {
      const normalized = String(extensionId || '').trim();
      if (!normalized) return false;
      const commandId = String(preferredCommandId || '').trim();
      const postAction = String(postActionName || '').trim();
      const handled = commandId
        ? executeIntegratedExtensionCommand(normalized, commandId)
        : false;
      if (!handled) {
        openIntegratedExtensionEntry(normalized);
      }
      const win = getWindowRef();
      if (postAction && typeof win[postAction] === 'function') {
        try { win[postAction](); } catch (_) {}
      }
      return handled || true;
    }

    function isIntegratedExtensionNavActive(item = null) {
      const extensionId = String(item?.id || '').trim();
      if (!extensionId) return false;
      const currentTab = getCurrentTab();
      const uiTabId = String(item?.ui?.tabId || '').trim();
      if (uiTabId && currentTab === uiTabId) return true;
      return currentTab === 'localPluginWorkspace' && getActiveLocalPluginWorkspaceId() === extensionId;
    }

    async function renderHostIntegratedExtensionEntries() {
      const documentRef = getDocumentRef();
      const sidebar = documentRef.getElementById('sidebar-plugin-entries');
      const sidebarFooter = documentRef.getElementById('sidebar-footer-extension-entries');
      const mobileMore = documentRef.getElementById('mobile-more-plugin-entries');
      if (!sidebar && !sidebarFooter && !mobileMore) return;
      try {
        await loadOfficialExtensionCatalog();
      } catch (_) {}
      const catalog = getCatalog();
      const list = Array.isArray(catalog?.extensions) ? catalog.extensions : [];
      const hostVisibleList = list.filter((item) => !isBuiltinHostFeatureId(item?.id));
      const sidebarItems = hostVisibleList.filter((item) => item?.hostIntegration?.sidebarEntry && isIntegratedExtensionSurfaceVisible(item, 'sidebarEntry') && isExtensionEnabled(item.id));
      const sidebarFooterItems = hostVisibleList.filter((item) => item?.hostIntegration?.sidebarFooterEntry && isIntegratedExtensionSurfaceVisible(item, 'sidebarFooterEntry') && isExtensionEnabled(item.id));
      const mobileItems = hostVisibleList.filter((item) => item?.hostIntegration?.mobileMoreEntry && isIntegratedExtensionSurfaceVisible(item, 'mobileMoreEntry') && isExtensionEnabled(item.id));
      if (sidebar) {
        sidebar.innerHTML = sidebarItems.map((item) => {
          const entry = item.hostIntegration.sidebarEntry;
          const active = isIntegratedExtensionNavActive(item);
          const commandId = String(item?.hostIntegration?.entryCommandId || '').trim();
          return `
                <button onclick="activateIntegratedExtension('${escapeHTML(item.id)}','${escapeHTML(commandId)}')" id="tab-host-${escapeHTML(item.id)}" class="host-integrated-nav-btn nav-btn w-full text-left px-3 py-2 rounded-lg transition-all text-[13px] flex items-center gap-3 ${active ? 'bg-gray-200/50 dark:bg-white/[0.03] text-black dark:text-white font-normal' : 'font-normal text-gray-600 dark:text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/[0.03]'}">
                    <span class="inline-flex w-3.5 h-3.5 items-center justify-center shrink-0">
                        <i data-lucide="${escapeHTML(entry.icon || item.icon || 'puzzle')}" class="w-3.5 h-3.5 shrink-0"></i>
                    </span><span class="nav-label truncate">${escapeHTML(entry.label)}</span>
                </button>
            `;
        }).join('');
      }
      if (sidebarFooter) {
        sidebarFooter.innerHTML = [
          ...sidebarFooterItems.map((item) => {
          const entry = item.hostIntegration.sidebarFooterEntry;
          const active = isIntegratedDrawerActive(item);
          const commandId = String(item?.hostIntegration?.entryCommandId || '').trim();
          return `
                <button onclick="activateIntegratedExtension('${escapeHTML(item.id)}','${escapeHTML(commandId)}')" id="sidebar-footer-host-${escapeHTML(item.id)}" class="nav-btn w-full text-left px-3 py-2 rounded-lg transition-all text-[13px] flex items-center gap-3 ${active ? 'bg-gray-200/50 dark:bg-white/[0.03] text-black dark:text-white font-normal' : 'font-normal text-gray-600 dark:text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/[0.03]'}">
                    <i data-lucide="${escapeHTML(entry.icon || item.icon || 'puzzle')}" class="w-3.5 h-3.5 shrink-0"></i><span class="nav-label truncate">${escapeHTML(entry.label)}</span>
                </button>
            `;
          }),
        ].filter(Boolean).join('');
      }
      if (mobileMore) {
        mobileMore.innerHTML = mobileItems.map((item) => {
          const entry = item.hostIntegration.mobileMoreEntry;
          const commandId = String(item?.hostIntegration?.entryCommandId || '').trim();
          return `
                <button id="mobile-more-host-${escapeHTML(item.id)}" type="button" onclick="activateIntegratedExtension('${escapeHTML(item.id)}','${escapeHTML(commandId)}','hideMobileMoreMenu')" class="surface-choice-btn inline-flex items-center gap-3">
                    <i data-lucide="${escapeHTML(entry.icon || item.icon || 'puzzle')}" class="w-4 h-4"></i><span>${escapeHTML(entry.label)}</span>
                </button>
            `;
        }).join('');
      }
      if (sidebar) requestLucideRefresh({ root: sidebar });
      if (sidebarFooter) requestLucideRefresh({ root: sidebarFooter });
      if (mobileMore) requestLucideRefresh({ root: mobileMore });
    }

    return {
      getIntegratedExtensionDefinitions,
      getCurrentExtensionClientTarget,
      isExtensionClientTargetAllowed,
      isIntegratedExtensionSurfaceVisible,
      getIntegratedExtensionDataModel,
      findIntegratedExtensionByCreatedItemTarget,
      getIntegratedExtensionContextPanels,
      getIntegratedExtensionCommands,
      getIntegratedExtensionWorkspaceHeaderActions,
      getIntegratedExtensionWorkspaceShell,
      executeIntegratedExtensionCommandRequest,
      executeIntegratedExtensionCommand,
      executeIntegratedExtensionWorkspaceAction,
      getIntegratedExtensionChatShortcuts,
      getIntegratedExtensionStorageDescriptor,
      getIntegratedExtensionStorageFacts,
      isIntegratedDrawerActive,
      setIntegratedDrawerOpen,
      openIntegratedExtensionEntry,
      activateIntegratedExtension,
      renderHostIntegratedExtensionEntries,
    };
  }

  window.MorphIntegratedExtensionRuntime = { create: createIntegratedExtensionRuntime };
})();
