(function () {
  const BUILTIN_HOST_FEATURE_IDS = new Set(['fleeting-station']);
  const HIDDEN_EXTENSION_IDS = new Set([
    'visual-organizer-plugin',
    'pomodoro-plugin',
    'codex-remote-plugin',
  ]);
  const ALLOWED_CONTEXT_PANEL_TARGETS = new Set([
    'health-top',
    'health-chart-bottom',
    'project-top'
  ]);
  const USER_LOCAL_EXTENSION_CATALOG_STORAGE_ID = 'local-plugin-catalog';
  const USER_LOCAL_EXTENSION_CATALOG_RELATIVE_PATH = 'data/extensions/local-plugin-catalog/state.json';
  const LOCAL_MARKETPLACE_MANIFEST_PATHS = Object.freeze([
    'extensions/apple-health/manifest.json',
    'extensions/wechat-article-formatter/manifest.json',
  ]);
  const LOCAL_MARKETPLACE_META = Object.freeze({
    'apple-health': {
      eyebrow: 'Apple Health',
      accent: 'linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.9) 50%, rgba(148,163,184,0.82) 100%)',
      surface: '#efefed',
      note: '在 iPhone 上读取 HealthKit 摘要并同步到 Morpheus',
      template: 'generic',
      categoryLabel: '健康工具',
      icon: 'heart-pulse',
    },
    'wechat-article-formatter': {
      eyebrow: 'WeChat Writing',
      accent: 'linear-gradient(135deg, rgba(23,23,23,0.96) 0%, rgba(120,82,32,0.9) 48%, rgba(214,179,107,0.82) 100%)',
      surface: '#f5efe6',
      note: '把正文整理成可复制进微信公众号编辑器的兼容排版',
      template: 'generic',
      categoryLabel: '写作工具',
      icon: 'newspaper',
    },
  });
  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isBuiltinHostFeatureId(id = '') {
    return BUILTIN_HOST_FEATURE_IDS.has(String(id || '').trim());
  }

  function isHiddenExtensionId(id = '') {
    return HIDDEN_EXTENSION_IDS.has(String(id || '').trim());
  }

  function formatLoadDebugText(state) {
    const src = state && typeof state === 'object' ? state : {};
    const parts = [];
    if (src.phase) parts.push(`phase=${src.phase}`);
    if (src.transport) parts.push(`transport=${src.transport}`);
    if (src.source) parts.push(`source=${src.source}`);
    if (src.count || src.count === 0) parts.push(`count=${src.count}`);
    if (src.error) parts.push(`error=${src.error}`);
    return parts.join(' | ');
  }

  async function loadCatalogJson(url) {
    const target = String(url || '').trim();
    if (!target) return null;
    if (typeof fetch === 'function') {
      try {
        const response = await fetch(target, { cache: 'no-store' });
        if (response && response.ok) {
          const json = await response.json().catch(() => null);
          if (json && typeof json === 'object') return json;
        }
      } catch (_) {}
    }
    if (typeof XMLHttpRequest !== 'function') return null;
    return new Promise((resolve) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', target, true);
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) return;
          const ok = (xhr.status >= 200 && xhr.status < 300) || xhr.status === 0;
          if (!ok || !xhr.responseText) {
            resolve(null);
            return;
          }
          try {
            const parsed = JSON.parse(xhr.responseText);
            resolve(parsed && typeof parsed === 'object' ? parsed : null);
          } catch (_) {
            resolve(null);
          }
        };
        xhr.onerror = function () { resolve(null); };
        xhr.send(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  function buildManifestUrlCandidates(url = '') {
    const target = String(url || '').trim();
    if (!target) return [];
    const candidates = [];
    const seen = new Set();
    const push = (value) => {
      const next = String(value || '').trim();
      if (!next || seen.has(next)) return;
      seen.add(next);
      candidates.push(next);
    };
    push(target);
    if (!/^(?:https?:|file:)/i.test(target)) {
      if (target.startsWith('/')) push(target.slice(1));
      else push(`/${target}`);
    }
    return candidates;
  }

  async function loadCatalogJsonWithFallback(url = '') {
    const candidates = buildManifestUrlCandidates(url);
    for (const candidate of candidates) {
      const json = await loadCatalogJson(candidate);
      if (json && typeof json === 'object') return json;
    }
    return null;
  }

  function normalizeExtensionCatalog(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const list = Array.isArray(source.extensions) ? source.extensions : [];
    const map = new Map();
    list.forEach((item) => {
      const normalized = normalizeExtensionItem(item);
      if (!normalized) return;
      if (map.has(normalized.id)) map.delete(normalized.id);
      map.set(normalized.id, normalized);
    });
    return {
      version: Number.isFinite(Number(source.version)) ? Number(source.version) : 1,
      updatedAt: String(source.updatedAt || '').trim(),
      extensions: Array.from(map.values()),
    };
  }

  function normalizeExtensionItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim();
    if (!id) return null;
    if (isHiddenExtensionId(id)) return null;
    const ui = raw.ui && typeof raw.ui === 'object' ? raw.ui : {};
    const requires = raw.requires && typeof raw.requires === 'object' ? raw.requires : {};
    const hostIntegration = raw.hostIntegration && typeof raw.hostIntegration === 'object' ? raw.hostIntegration : {};
    const normalizeClientTargets = (value) => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => {
          const text = String(item || '').trim().toLowerCase();
          if (text === 'desktop' || text === 'mobile') return text;
          return '';
        })
        .filter(Boolean);
    };
    const normalizeHostEntry = (entryRaw) => {
      const entry = entryRaw && typeof entryRaw === 'object' ? entryRaw : null;
      if (!entry) return null;
      const label = String(entry.label || '').trim();
      if (!label) return null;
      return {
        label,
        icon: String(entry.icon || raw.icon || 'puzzle').trim() || 'puzzle',
        platforms: normalizeClientTargets(entry.platforms),
      };
    };
    const normalizeDrawerEntry = (entryRaw) => {
      const entry = entryRaw && typeof entryRaw === 'object' ? entryRaw : null;
      if (!entry) return null;
      const drawerId = String(entry.drawerId || '').trim();
      if (!drawerId) return null;
      return {
        drawerId,
        label: String(entry.label || raw.name || '').trim() || String(raw.name || '').trim() || drawerId,
        icon: String(entry.icon || raw.icon || 'panel-right-open').trim() || 'panel-right-open',
        platforms: normalizeClientTargets(entry.platforms),
      };
    };
    const normalizeContextPanel = (panelRaw, index) => {
      const panel = panelRaw && typeof panelRaw === 'object' ? panelRaw : null;
      if (!panel) return null;
      const target = String(panel.target || '').trim();
      if (!target || !ALLOWED_CONTEXT_PANEL_TARGETS.has(target)) return null;
      return {
        id: String(panel.id || `${id}-panel-${index + 1}`).trim(),
        target,
        label: String(panel.label || raw.name || '').trim() || String(raw.name || id).trim(),
        icon: String(panel.icon || raw.icon || 'panel-right-open').trim() || 'panel-right-open',
        commandId: String(panel.commandId || '').trim(),
        platforms: normalizeClientTargets(panel.platforms),
      };
    };
    const normalizeChatShortcut = (shortcutRaw, index) => {
      const shortcut = shortcutRaw && typeof shortcutRaw === 'object' ? shortcutRaw : null;
      if (!shortcut) return null;
      const label = String(shortcut.label || '').trim();
      if (!label) return null;
      return {
        id: String(shortcut.id || `${id}-shortcut-${index + 1}`).trim(),
        label,
        icon: String(shortcut.icon || raw.icon || 'sparkles').trim() || 'sparkles',
        target: String(shortcut.target || '').trim(),
        commandId: String(shortcut.commandId || '').trim(),
        platforms: normalizeClientTargets(shortcut.platforms),
      };
    };
    const normalizeSettingsSection = (sectionRaw) => {
      const section = sectionRaw && typeof sectionRaw === 'object' ? sectionRaw : null;
      if (!section) return null;
      const label = String(section.label || '').trim();
      if (!label) return null;
      return {
        id: String(section.id || `${id}-settings`).trim(),
        label,
        icon: String(section.icon || raw.icon || 'settings-2').trim() || 'settings-2',
        commandId: String(section.commandId || '').trim(),
        platforms: normalizeClientTargets(section.platforms),
      };
    };
    const normalizeWorkspaceHeaderAction = (actionRaw, index) => {
      const action = actionRaw && typeof actionRaw === 'object' ? actionRaw : null;
      if (!action) return null;
      const label = String(action.label || '').trim();
      if (!label) return null;
      return {
        id: String(action.id || `${id}-workspace-action-${index + 1}`).trim(),
        label,
        icon: String(action.icon || raw.icon || 'sparkles').trim() || 'sparkles',
        commandId: String(action.commandId || '').trim(),
        variant: String(action.variant || 'ghost').trim() || 'ghost',
        platforms: normalizeClientTargets(action.platforms),
      };
    };
    const normalizeCommand = (commandRaw, index) => {
      const command = commandRaw && typeof commandRaw === 'object' ? commandRaw : null;
      if (!command) return null;
      const label = String(command.label || '').trim();
      if (!label) return null;
      return {
        id: String(command.id || `${id}-command-${index + 1}`).trim(),
        label,
        icon: String(command.icon || raw.icon || 'sparkles').trim() || 'sparkles',
        action: String(command.action || 'custom').trim() || 'custom',
        target: String(command.target || '').trim(),
        payload: command.payload && typeof command.payload === 'object' ? command.payload : {},
        aiCallable: command.aiCallable === true,
        executionTarget: String(command.executionTarget || '').trim(),
        hostAction: String(command.hostAction || '').trim(),
        requiredPermission: String(command.requiredPermission || '').trim(),
        risk: String(command.risk || '').trim(),
        confirmationRequired: command.confirmationRequired === true,
        boundaryLevel: String(command.boundaryLevel || '').trim(),
      };
    };
    const dataModel = raw.dataModel && typeof raw.dataModel === 'object' ? raw.dataModel : {};
    const workspaceShell = ui.workspaceShell && typeof ui.workspaceShell === 'object' ? ui.workspaceShell : {};
    return {
      id,
      source: String(raw.source || 'official').trim() || 'official',
      kind: String(raw.kind || 'integration').trim() || 'integration',
      category: String(raw.category || raw.kind || 'integration').trim() || 'integration',
      owner: String(raw.owner || 'official').trim() || 'official',
      name: String(raw.name || id).trim() || id,
      summary: String(raw.summary || '').trim(),
      icon: String(raw.icon || 'puzzle').trim() || 'puzzle',
      entry: String(raw.entry || '').trim(),
      description: String(raw.description || '').trim(),
      tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : [],
      settingsTarget: String(raw.settingsTarget || id).trim() || id,
      visibilityTargets: Array.isArray(raw.visibilityTargets) ? raw.visibilityTargets.map((item) => String(item || '').trim()).filter(Boolean) : [],
      hostIntegration: {
        entryCommandId: String(hostIntegration.entryCommandId || '').trim(),
        platforms: normalizeClientTargets(hostIntegration.platforms),
        sidebarEntry: normalizeHostEntry(hostIntegration.sidebarEntry),
        sidebarFooterEntry: normalizeHostEntry(hostIntegration.sidebarFooterEntry),
        mobileMoreEntry: normalizeHostEntry(hostIntegration.mobileMoreEntry),
        drawerEntry: normalizeDrawerEntry(hostIntegration.drawerEntry),
        contextPanels: Array.isArray(hostIntegration.contextPanels)
          ? hostIntegration.contextPanels.map((item, index) => normalizeContextPanel(item, index)).filter(Boolean)
          : [],
        chatShortcuts: Array.isArray(hostIntegration.chatShortcuts)
          ? hostIntegration.chatShortcuts.map((item, index) => normalizeChatShortcut(item, index)).filter(Boolean)
          : [],
        settingsSection: normalizeSettingsSection(hostIntegration.settingsSection),
        workspaceHeaderActions: Array.isArray(hostIntegration.workspaceHeaderActions)
          ? hostIntegration.workspaceHeaderActions.map((item, index) => normalizeWorkspaceHeaderAction(item, index)).filter(Boolean)
          : [],
        createdItemTargets: Array.isArray(hostIntegration.createdItemTargets)
          ? hostIntegration.createdItemTargets.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
      },
      dataModel: {
        namespace: String(dataModel.namespace || id).trim() || id,
        state: String(dataModel.state || 'none').trim() || 'none',
        stateKey: String(dataModel.stateKey || '').trim(),
        history: String(dataModel.history || 'none').trim() || 'none',
        syncPolicy: String(dataModel.syncPolicy || 'inherit-root').trim() || 'inherit-root',
        sharedDomains: Array.isArray(dataModel.sharedDomains)
          ? dataModel.sharedDomains.map((item) => String(item || '').trim()).filter(Boolean)
          : [],
      },
      defaultEnabled: raw.defaultEnabled === true,
      requiresConfiguration: raw.requiresConfiguration !== false,
      permissions: Array.isArray(raw.permissions)
        ? raw.permissions.map((item) => ({
            id: String(item?.id || '').trim(),
            label: String(item?.label || '').trim(),
            required: item?.required !== false,
            scope: String(item?.scope || '').trim(),
          })).filter((item) => item.id)
        : [],
      commands: Array.isArray(raw.commands)
        ? raw.commands.map((item, index) => normalizeCommand(item, index)).filter(Boolean)
        : [],
      ui: {
        detailMode: String(ui.detailMode || 'embedded').trim() || 'embedded',
        primaryAction: String(ui.primaryAction || 'configure').trim() || 'configure',
        workspaceShell: {
          eyebrow: String(workspaceShell.eyebrow || '').trim(),
          title: String(workspaceShell.title || '').trim(),
          description: String(workspaceShell.description || '').trim(),
          backLabel: String(workspaceShell.backLabel || '').trim(),
        },
      },
      requires: {
        accounts: Array.isArray(requires.accounts) ? requires.accounts.map((item) => String(item || '').trim()).filter(Boolean) : [],
        devices: Array.isArray(requires.devices) ? requires.devices.map((item) => String(item || '').trim()).filter(Boolean) : [],
        runtimeCapabilities: Array.isArray(requires.runtimeCapabilities) ? requires.runtimeCapabilities.map((item) => String(item || '').trim()).filter(Boolean) : [],
      },
    };
  }

  function createExtensionsRuntime(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};
    let catalogCache = null;
    let selectedExtensionId = '';
    let marketplaceOpen = false;
    let marketplaceReturnExtensionId = '';
    let marketplaceCatalogCache = null;
    let userLocalExtensionIdSet = new Set();
    let catalogLoadState = {
      phase: 'idle',
      transport: '',
      source: '',
      count: 0,
      error: '',
    };
    let extensionCardContextMenuEl = null;
    let extensionCardContextMenuRemoveBtn = null;
    let extensionCardContextMenuBound = false;
    let extensionCardContextMenuTargetId = '';
    let extensionCardContextMenuOpenedAt = 0;

    function getEcosystemRegistryRuntime() {
      if (typeof api.getEcosystemRegistryRuntimeModules === 'function') {
        return api.getEcosystemRegistryRuntimeModules() || null;
      }
      if (typeof globalThis !== 'undefined' && typeof globalThis.getEcosystemRegistryRuntimeModules === 'function') {
        return globalThis.getEcosystemRegistryRuntimeModules() || null;
      }
      return null;
    }

    function getObservabilityRuntime() {
      if (typeof api.getObservabilityRuntimeModules === 'function') {
        return api.getObservabilityRuntimeModules() || null;
      }
      if (typeof globalThis !== 'undefined' && typeof globalThis.getObservabilityRuntimeModules === 'function') {
        return globalThis.getObservabilityRuntimeModules() || null;
      }
      return null;
    }

    function getDefinitionById(catalog, key = '') {
      const list = Array.isArray(catalog?.extensions) ? catalog.extensions : [];
      return list.find((item) => String(item?.id || '') === String(key || '')) || null;
    }

    function getActiveViewMode() {
      if (marketplaceOpen) return 'marketplace';
      if (selectedExtensionId) return 'detail';
      return 'list';
    }

    function syncExtensionsPageHeader(viewMode = 'list') {
      const title = document.getElementById('extensions-page-title');
      const subtitle = document.getElementById('extensions-page-subtitle');
      const navBtn = document.getElementById('extensions-page-nav-btn');
      const navIcon = document.getElementById('extensions-page-nav-icon');
      // Design rule: top-level page headers should not render helper subtitle copy below the title.
      if (title) {
        title.innerHTML = viewMode === 'marketplace'
          ? '插件市集'
          : '插件 <span class="text-gray-500 dark:text-white/35 text-sm sm:text-lg ml-2">(Plugins)</span>';
      }
      if (subtitle) {
        subtitle.textContent = '';
        subtitle.classList.add('hidden');
      }
      if (navBtn) {
        if (viewMode === 'list') {
          navBtn.setAttribute('aria-label', '切换导航栏');
          navBtn.setAttribute('title', '目录');
          navBtn.setAttribute('onclick', 'togglePrimarySidebarVisibility(event)');
        } else {
          navBtn.setAttribute('aria-label', '返回上一层');
          navBtn.setAttribute('title', '返回');
          navBtn.setAttribute('onclick', 'returnFromExtensionsPage()');
        }
      }
      if (navIcon) {
        navIcon.setAttribute('data-lucide', viewMode === 'list' ? 'menu' : 'chevron-left');
      }
    }

    async function loadCatalogViaNativeBridge(catalogId = 'official') {
      const storage = api.storage;
      if (!storage || typeof storage.hasNativeControlBridge !== 'function' || !storage.hasNativeControlBridge()) {
        return null;
      }
      if (typeof storage.callNativeDesktopControl !== 'function') return null;
      try {
        const payload = await storage.callNativeDesktopControl('getExtensionCatalog', { catalogId });
        const catalog = payload && typeof payload === 'object' ? payload.catalog : null;
        if (!catalog || typeof catalog !== 'object') return null;
        return {
          json: catalog,
          transport: 'native-bridge',
          source: String(payload.source || 'native'),
        };
      } catch (_) {
        return null;
      }
    }

    async function loadCatalogViaWeb(url) {
      const json = await loadCatalogJsonWithFallback(url);
      if (!json || typeof json !== 'object') return null;
      return {
        json,
        transport: 'web',
        source: (/^file:/i.test(String(window?.location?.protocol || '')) ? 'file-bundle' : 'http'),
      };
    }

    async function loadUserLocalExtensionCatalog() {
      const storage = api.storage;
      if (!storage || typeof storage.readExtensionDataJson !== 'function') {
        userLocalExtensionIdSet = new Set();
        return null;
      }
      try {
        const payload = await storage.readExtensionDataJson(
          USER_LOCAL_EXTENSION_CATALOG_STORAGE_ID,
          { relativePath: USER_LOCAL_EXTENSION_CATALOG_RELATIVE_PATH }
        );
        const value = payload?.value;
        if (!value || typeof value !== 'object') {
          userLocalExtensionIdSet = new Set();
          return null;
        }
        const normalized = normalizeExtensionCatalog(value);
        userLocalExtensionIdSet = new Set(
          (Array.isArray(normalized.extensions) ? normalized.extensions : [])
            .map((item) => String(item?.id || '').trim())
            .filter(Boolean)
        );
        return normalized;
      } catch (_) {
        userLocalExtensionIdSet = new Set();
        return null;
      }
    }

    async function loadOfficialExtensionCatalog(options = {}) {
      const ecosystemRuntime = getEcosystemRegistryRuntime();
      if (ecosystemRuntime && typeof ecosystemRuntime.loadOfficialExtensionCatalog === 'function') {
        await loadUserLocalExtensionCatalog();
        const catalog = await ecosystemRuntime.loadOfficialExtensionCatalog(options);
        catalogCache = catalog && typeof catalog === 'object' ? catalog : normalizeExtensionCatalog(null);
        if (typeof ecosystemRuntime.getExtensionCatalogLoadState === 'function') {
          catalogLoadState = ecosystemRuntime.getExtensionCatalogLoadState();
        }
        return catalogCache;
      }
      const forceRefresh = options && typeof options === 'object' && options.forceRefresh === true;
      if (!forceRefresh && catalogCache) return catalogCache;
      catalogLoadState = { phase: 'loading', transport: '', source: '', count: 0, error: '' };
      try {
        const loaded = await loadCatalogViaNativeBridge('official') || await loadCatalogViaWeb('extensions/manifest.json');
        const userLocalLoaded = await loadUserLocalExtensionCatalog();
        const bundledLocalItems = await loadLocalMarketplaceCatalog();
        const normalized = normalizeExtensionCatalog({
          version: Number(loaded?.json?.version || userLocalLoaded?.version || 2),
          updatedAt: String(loaded?.json?.updatedAt || userLocalLoaded?.updatedAt || ''),
          extensions: []
            .concat(Array.isArray(loaded?.json?.extensions) ? loaded.json.extensions : [])
            .concat(Array.isArray(userLocalLoaded?.extensions) ? userLocalLoaded.extensions : [])
            .concat(Array.isArray(bundledLocalItems) ? bundledLocalItems : []),
        });
        catalogCache = normalized;
        catalogLoadState = {
          phase: normalized.extensions.length ? 'loaded' : 'empty',
          transport: String(loaded?.transport || ''),
          source: String(loaded?.source || ''),
          count: normalized.extensions.length,
          error: normalized.extensions.length ? '' : 'no_extensions_found',
        };
      } catch (_) {
        catalogCache = normalizeExtensionCatalog(null);
        catalogLoadState = { phase: 'error', transport: '', source: '', count: 0, error: 'catalog_load_failed' };
      }
      return catalogCache;
    }

    async function loadLocalMarketplaceCatalog() {
      if (marketplaceCatalogCache) return marketplaceCatalogCache;
      const bundledMarketplaceLoaded = await loadCatalogViaNativeBridge('marketplace')
        || await loadCatalogViaWeb('extensions/local-manifest.json');
      const bundledMarketplaceCatalog = normalizeExtensionCatalog(bundledMarketplaceLoaded?.json || null);
      const pathEntries = await Promise.all(
        LOCAL_MARKETPLACE_MANIFEST_PATHS.map(async (path) => {
          const loaded = await loadCatalogJsonWithFallback(path);
          return normalizeExtensionItem(loaded);
        })
      );
      marketplaceCatalogCache = normalizeExtensionCatalog({
        version: Number(bundledMarketplaceCatalog?.version || 2),
        updatedAt: String(bundledMarketplaceCatalog?.updatedAt || ''),
        extensions: []
          .concat(Array.isArray(bundledMarketplaceCatalog?.extensions) ? bundledMarketplaceCatalog.extensions : [])
          .concat(pathEntries.filter(Boolean)),
      }).extensions;
      return marketplaceCatalogCache;
    }

    function isUserAddedExtension(definition = null) {
      const key = String(definition?.id || '').trim();
      if (!key) return false;
      return userLocalExtensionIdSet.has(key);
    }

    function closeExtensionCardContextMenu() {
      extensionCardContextMenuTargetId = '';
      extensionCardContextMenuOpenedAt = 0;
      if (!extensionCardContextMenuEl) return;
      extensionCardContextMenuEl.classList.add('hidden');
      extensionCardContextMenuEl.style.display = 'none';
    }

    function ensureExtensionCardContextMenu() {
      if (extensionCardContextMenuEl) return extensionCardContextMenuEl;
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
      const body = document.body;
      if (!body || typeof body.appendChild !== 'function') return null;
      const menu = document.createElement('div');
      menu.id = 'extensions-card-context-menu';
      menu.className = 'hidden fixed z-[1400] min-w-[132px] rounded-xl border border-gray-200 bg-white/96 shadow-xl backdrop-blur dark:border-white/12 dark:bg-[#1f1a1a]/96';
      menu.style.display = 'none';
      menu.style.left = '0px';
      menu.style.top = '0px';
      menu.innerHTML = `
        <button
          type="button"
          data-action="remove-extension"
          class="w-full text-left px-3 py-2.5 text-[12px] leading-5 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"
        >移除插件</button>
      `;
      body.appendChild(menu);
      extensionCardContextMenuEl = menu;
      extensionCardContextMenuRemoveBtn = menu.querySelector('[data-action="remove-extension"]');
      if (extensionCardContextMenuRemoveBtn && typeof extensionCardContextMenuRemoveBtn.addEventListener === 'function') {
        extensionCardContextMenuRemoveBtn.addEventListener('click', (event) => {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
          const key = String(extensionCardContextMenuTargetId || '').trim();
          closeExtensionCardContextMenu();
          if (!key) return;
          const definition = getDefinitionById(catalogCache, key);
          if (!definition || !isUserAddedExtension(definition)) return;
          const removeNow = async () => {
            const removed = await removeUserAddedExtensionById(key);
            const opener = api.openCustomModal || (typeof globalThis !== 'undefined' && typeof globalThis.openCustomModal === 'function' ? globalThis.openCustomModal : null);
            if (removed) {
              if (typeof opener === 'function') {
                opener({
                  title: '插件已移除',
                  desc: `已移除「${String(definition.name || key).trim() || key}」。`,
                });
              }
              return;
            }
            if (typeof opener === 'function') {
              opener({
                title: '移除失败',
                desc: '未在用户本地插件目录中找到可移除记录。',
              });
            }
          };
          const opener = api.openCustomModal || (typeof globalThis !== 'undefined' && typeof globalThis.openCustomModal === 'function' ? globalThis.openCustomModal : null);
          if (typeof opener === 'function') {
            opener({
              title: '确认移除插件？',
              desc: `将从本地插件清单中移除「${String(definition.name || key).trim() || key}」。`,
              onConfirm: () => { void removeNow(); },
            });
            return;
          }
          if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
            if (window.confirm(`确认移除插件「${String(definition.name || key).trim() || key}」？`)) {
              void removeNow();
            }
          }
        });
      }
      if (!extensionCardContextMenuBound) {
        if (typeof document.addEventListener === 'function') {
          document.addEventListener('click', (event) => {
            if (!extensionCardContextMenuEl || extensionCardContextMenuEl.classList.contains('hidden')) return;
            const button = Number(event?.button ?? 0);
            if (button !== 0 || event?.ctrlKey === true) return;
            if (Date.now() - Number(extensionCardContextMenuOpenedAt || 0) < 120) return;
            const target = event?.target || null;
            if (target && typeof extensionCardContextMenuEl.contains === 'function' && extensionCardContextMenuEl.contains(target)) return;
            closeExtensionCardContextMenu();
          });
          document.addEventListener('scroll', () => { closeExtensionCardContextMenu(); }, true);
          document.addEventListener('keydown', (event) => {
            if (String(event?.key || '') === 'Escape') closeExtensionCardContextMenu();
          });
        }
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('resize', () => { closeExtensionCardContextMenu(); });
        }
        extensionCardContextMenuBound = true;
      }
      return extensionCardContextMenuEl;
    }

    function openExtensionCardContextMenu(event, definition) {
      if (!definition || !isUserAddedExtension(definition)) {
        closeExtensionCardContextMenu();
        return;
      }
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      const menu = ensureExtensionCardContextMenu();
      if (!menu) return;
      const key = String(definition.id || '').trim();
      if (!key) return;
      const x = Number(event?.clientX || 0);
      const y = Number(event?.clientY || 0);
      extensionCardContextMenuTargetId = key;
      extensionCardContextMenuOpenedAt = Date.now();
      menu.classList.remove('hidden');
      menu.style.display = 'block';
      const width = Number(menu.offsetWidth || 140);
      const height = Number(menu.offsetHeight || 42);
      const viewportWidth = Number((typeof window !== 'undefined' ? window.innerWidth : 0) || 0);
      const viewportHeight = Number((typeof window !== 'undefined' ? window.innerHeight : 0) || 0);
      const left = Math.max(8, Math.min(x, Math.max(8, viewportWidth - width - 8)));
      const top = Math.max(8, Math.min(y, Math.max(8, viewportHeight - height - 8)));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    async function removeUserAddedExtensionById(extensionId = '') {
      const key = String(extensionId || '').trim();
      if (!key) return false;
      const storage = api.storage;
      if (!storage || typeof storage.readExtensionDataJson !== 'function' || typeof storage.writeExtensionDataJson !== 'function') {
        return false;
      }
      let existingValue = null;
      try {
        const payload = await storage.readExtensionDataJson(
          USER_LOCAL_EXTENSION_CATALOG_STORAGE_ID,
          { relativePath: USER_LOCAL_EXTENSION_CATALOG_RELATIVE_PATH }
        );
        existingValue = payload?.value && typeof payload.value === 'object' ? payload.value : null;
      } catch (_) {
        existingValue = null;
      }
      const existing = normalizeExtensionCatalog(existingValue);
      const list = Array.isArray(existing.extensions) ? existing.extensions : [];
      const nextExtensions = list.filter((item) => String(item?.id || '').trim() !== key);
      if (nextExtensions.length === list.length) return false;
      const nextCatalog = {
        version: Math.max(Number(existing.version || 2), 2),
        updatedAt: new Date().toISOString(),
        extensions: nextExtensions,
      };
      await storage.writeExtensionDataJson(
        USER_LOCAL_EXTENSION_CATALOG_STORAGE_ID,
        nextCatalog,
        { relativePath: USER_LOCAL_EXTENSION_CATALOG_RELATIVE_PATH }
      );
      userLocalExtensionIdSet = new Set(nextExtensions.map((item) => String(item?.id || '').trim()).filter(Boolean));
      const setEnabled = api.setExtensionEnabled || (typeof globalThis !== 'undefined' && typeof globalThis.setExtensionEnabled === 'function' ? globalThis.setExtensionEnabled : null);
      if (typeof setEnabled === 'function') {
        try { setEnabled(key, false, { silent: true }); } catch (_) {}
      }
      const ecosystemRuntime = getEcosystemRegistryRuntime();
      if (ecosystemRuntime && typeof ecosystemRuntime.invalidateExtensionCatalogCache === 'function') {
        ecosystemRuntime.invalidateExtensionCatalogCache();
      }
      invalidateCatalogCache();
      if (selectedExtensionId === key) selectedExtensionId = '';
      await loadOfficialExtensionCatalog();
      const refreshBindings = api.refreshExtensionSurfaceBindings || (typeof globalThis !== 'undefined' && typeof globalThis.refreshExtensionSurfaceBindings === 'function' ? globalThis.refreshExtensionSurfaceBindings : null);
      if (typeof refreshBindings === 'function') refreshBindings();
      await renderExtensionsView();
      return true;
    }

    function hasMeaningfulExtensionState(value = null) {
      if (value == null) return false;
      if (Array.isArray(value)) return value.some((item) => hasMeaningfulExtensionState(item));
      if (typeof value === 'object') return Object.values(value).some((item) => hasMeaningfulExtensionState(item));
      if (typeof value === 'string') return !!String(value).trim();
      if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
      if (typeof value === 'boolean') return value === true;
      return false;
    }

    function readExtensionDataProjection(definition = null) {
      const root = api.getData ? api.getData() : null;
      const model = definition?.dataModel && typeof definition.dataModel === 'object' ? definition.dataModel : {};
      const namespace = String(model.namespace || definition?.id || '').trim();
      const state = String(model.state || '').trim();
      const stateKey = String(model.stateKey || '').trim();
      if (state === 'root-pluginData' && namespace) {
        const pluginState = root?.pluginData?.[namespace];
        if (pluginState && typeof pluginState === 'object') {
          if (hasMeaningfulExtensionState(pluginState?.state)) return pluginState.state;
          if (hasMeaningfulExtensionState(pluginState)) return pluginState;
        }
      }
      if (stateKey && hasMeaningfulExtensionState(root?.[stateKey])) return root[stateKey];
      const sharedDomains = Array.isArray(model.sharedDomains) ? model.sharedDomains.map((item) => String(item || '').trim()).filter(Boolean) : [];
      if (sharedDomains.length) {
        const projection = sharedDomains.reduce((acc, key) => {
          if (hasMeaningfulExtensionState(root?.[key])) acc[key] = root[key];
          return acc;
        }, {});
        if (hasMeaningfulExtensionState(projection)) return projection;
      }
      return null;
    }

    function resolveExtensionRuntimeState(extensionId, definition = null) {
      const settingsState = api.getSettingsState ? api.getSettingsState() : {};
      const enabled = api.isExtensionEnabled ? api.isExtensionEnabled(extensionId) : false;
      const dataProjection = readExtensionDataProjection(definition);
      const meta = {
        enabled,
        ready: definition?.requiresConfiguration !== true,
        error: false,
        hasData: hasMeaningfulExtensionState(dataProjection),
        readyLabel: '已就绪',
        pendingLabel: definition?.requiresConfiguration ? '待配置' : '待启用',
        facts: [],
      };
      if (extensionId === 'glucose') {
        const config = settingsState.glucoseConfig || {};
        const targetText = typeof api.formatGlucoseTargetRangeMmol === 'function'
          ? api.formatGlucoseTargetRangeMmol(config.targetLow || 70, config.targetHigh || 180)
          : `${config.targetLow || 70}-${config.targetHigh || 180}`;
        const region = typeof api.normalizeGlucoseRegion === 'function'
          ? api.normalizeGlucoseRegion(config.region || 'CN')
          : String(config.region || 'CN');
        meta.error = !!settingsState.glucoseStatusError;
        meta.ready = !!(String(config.email || '').trim() && config.hasPassword);
        meta.hasData = meta.hasData || !!hasMeaningfulExtensionState(api.getData ? api.getData()?.glucoseSync : null);
        meta.readyLabel = meta.hasData ? '已同步' : '已配置';
        meta.pendingLabel = '待配置';
        meta.facts = [
          `账号：${config.email ? '已配置' : '未配置'}`,
          `密码：${config.hasPassword ? '已配置' : '未配置'}`,
          `区域：${region}`,
          `目标：${targetText}`,
        ];
        return meta;
      }
      if (extensionId === 'feishu') {
        const config = settingsState.feishuConfig || {};
        meta.error = !!settingsState.feishuStatusError;
        meta.ready = !!String(config.appId || '').trim();
        meta.hasData = Number(config.eventCount || 0) > 0;
        meta.readyLabel = config.enabled ? '已连接' : '待启用';
        meta.pendingLabel = '待配置';
        meta.facts = [
          `状态：${config.enabled ? '已启用' : '未启用'}`,
          `AppID：${config.appId ? '已配置' : '未配置'}`,
          `Secret：${config.hasAppSecret ? '已配置' : '未配置'}`,
          `最近事件：${Number(config.eventCount || 0)}`,
        ];
        return meta;
      }
      if (extensionId === 'apple-health') {
        const root = api.getData ? api.getData() : null;
        const bundle = root?.appleHealthSync && typeof root.appleHealthSync === 'object' ? root.appleHealthSync : {};
        meta.ready = enabled;
        meta.hasData = !!(bundle?.snapshot && typeof bundle.snapshot === 'object');
        meta.readyLabel = meta.hasData ? '已同步' : '待拉取';
        meta.pendingLabel = '待配置';
        meta.facts = [
          `设备：${Array.isArray(definition?.requires?.devices) && definition.requires.devices.length ? definition.requires.devices.join('、') : '未声明'}`,
          `数据域：${String(definition?.dataModel?.stateKey || 'appleHealthSync').trim() || 'appleHealthSync'}`,
          `最近更新：${String(bundle?.updatedAt || '').trim() || '暂无'}`,
        ];
        return meta;
      }
      return meta;
    }

    function buildExtensionSummary(extensionId, definition = null) {
      const resolvedDefinition = definition || getDefinitionById(catalogCache, extensionId);
      const baseSummary = String(resolvedDefinition?.summary || resolvedDefinition?.description || '').replace(/\s+/g, ' ').trim();
      if (!resolvedDefinition) return baseSummary || '未配置';
      const meta = resolveExtensionRuntimeState(extensionId, resolvedDefinition);
      const settingsLabel = String(resolvedDefinition?.hostIntegration?.settingsSection?.label || '').trim();
      if (!meta.enabled) return baseSummary || '按需启用';
      if (meta.error) return '已启用，但当前运行异常，请进入配置查看';
      if (resolvedDefinition?.requiresConfiguration && !meta.ready) {
        return `已启用，请先完成${settingsLabel || '插件'}配置`;
      }
      if (meta.hasData) {
        return baseSummary ? `已启用，${baseSummary}` : '已启用，已有可读数据';
      }
      if (String(resolvedDefinition?.ui?.primaryAction || '').trim() === 'open-workspace') {
        return '已启用，可继续进入工作台使用';
      }
      return baseSummary ? `已启用，${baseSummary}` : '已启用';
    }

    function getMarketplaceMeta(definition = null) {
      const key = String(definition?.id || '').trim();
      return LOCAL_MARKETPLACE_META[key] && typeof LOCAL_MARKETPLACE_META[key] === 'object'
        ? LOCAL_MARKETPLACE_META[key]
        : {
            eyebrow: 'Local Plugin',
            accent: 'linear-gradient(135deg, rgba(17,24,39,0.94) 0%, rgba(55,65,81,0.88) 50%, rgba(148,163,184,0.82) 100%)',
            surface: '#efefed',
            note: '把本地准备好的插件加入你的插件页',
            template: 'generic',
            categoryLabel: '本地插件',
          };
    }

    function buildMarketplaceCoverMarkup(definition = null) {
      const meta = getMarketplaceMeta(definition);
      const template = String(meta.template || 'generic').trim();
      if (template === 'sop') {
        return `
          <div class="relative h-full rounded-[1.7rem] overflow-hidden bg-[#f7f5ef]">
            <div class="absolute inset-[1.8rem] rounded-[1rem] border-[5px] border-[#171717] bg-white"></div>
            <div class="absolute left-[3.3rem] right-[3.3rem] top-[4rem] h-[4px] bg-[#171717]"></div>
            <div class="absolute left-[3.3rem] right-[5.2rem] top-[6.4rem] space-y-5">
              <div class="flex items-center gap-3"><div class="h-5 w-5 rounded-full border-[3px] border-[#171717]"></div><div class="h-[3px] flex-1 bg-[#c9c3b7]"></div></div>
              <div class="flex items-center gap-3"><div class="h-5 w-5 rounded-full border-[3px] border-[#171717]"></div><div class="h-[3px] flex-1 bg-[#c9c3b7]"></div></div>
              <div class="flex items-center gap-3"><div class="h-5 w-5 rounded-full border-[3px] border-[#171717]"></div><div class="h-[3px] flex-1 bg-[#c9c3b7]"></div></div>
              <div class="flex items-center gap-3"><div class="h-5 w-5 rounded-full border-[3px] border-[#171717]"></div><div class="h-[3px] flex-1 bg-[#c9c3b7]"></div></div>
            </div>
            <div class="absolute right-[3.5rem] bottom-[2.4rem] rounded-full border-[4px] border-[#171717] px-4 py-1 text-[18px] font-semibold text-[#171717]">SOP</div>
          </div>
        `;
      }
      if (template === 'jcring') {
        return `
          <div class="relative h-full rounded-[1.7rem] overflow-hidden" style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 52%, #334155 100%);">
            <div class="absolute left-[2.1rem] top-[2rem] text-white">
              <div class="text-[32px] font-semibold leading-none">${escapeHTML(definition?.name || 'JCRing')}</div>
              <div class="mt-2 text-[17px] text-white/68">Ring Device Workspace</div>
            </div>
            <div class="absolute right-[3rem] top-[2.5rem] h-[8rem] w-[8rem] rounded-full border-[18px] border-[#d6dee7] shadow-[0_0_0_8px_rgba(255,255,255,0.08)]"></div>
            <div class="absolute right-[5.1rem] top-[4.6rem] h-[3.8rem] w-[3.8rem] rounded-full bg-[#0f172a]"></div>
            <div class="absolute left-[2.1rem] bottom-[2rem] inline-flex items-center rounded-full bg-white/12 px-5 py-2.5 text-[17px] font-semibold text-white">${escapeHTML(meta.categoryLabel || '设备工具')}</div>
          </div>
        `;
      }
      return `
        <div class="relative h-full rounded-[1.7rem] overflow-hidden" style="background:${escapeHTML(meta.accent)};">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_42%)]"></div>
          <div class="absolute left-[2rem] top-[2rem] text-[32px] font-semibold text-white">${escapeHTML(definition?.name || 'Plugin')}</div>
        </div>
      `;
    }

    function buildMarketplaceCardMarkup(definition, catalog = null) {
      const key = String(definition?.id || '').trim();
      if (!key) return '';
      const meta = getMarketplaceMeta(definition);
      const installed = !!getDefinitionById(catalog, key);
      const summary = String(definition?.description || definition?.summary || buildExtensionSummary(key, definition) || '').trim();
      const safeSummary = summary.replace(/\s*\n+\s*/g, ' ').replace(/\s+/g, ' ').trim();
      const detailAction = installed
        ? `showExtensionList(); openExtensionDetail('${escapeHTML(key)}')`
        : `installMarketplacePlugin('${escapeHTML(key)}')`;
      const installAction = installed
        ? `showExtensionList(); openExtensionDetail('${escapeHTML(key)}')`
        : `installMarketplacePlugin('${escapeHTML(key)}')`;
      const installLabel = installed ? '已添加' : '+';
      const rawIconName = String(definition?.icon || '').trim();
      const iconName = rawIconName && rawIconName !== 'puzzle'
        ? rawIconName
        : String(meta.icon || rawIconName || 'puzzle').trim() || 'puzzle';
      return `
        <section class="extension-card glass-card rounded-[1.2rem] p-5 flex flex-col gap-3 w-full cursor-pointer transition-all" style="height:178px;max-height:178px;min-height:178px;" data-extension-id="${escapeHTML(key)}" onclick="if (event && (event.button !== 0 || event.ctrlKey === true)) return; ${detailAction}">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-medium text-black dark:text-white/90 truncate whitespace-nowrap max-w-full">${escapeHTML(definition?.name || key)}</h2>
              </div>
              <p class="mt-2 text-[11px] leading-5 text-gray-600 dark:text-white/70 overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHTML(safeSummary || meta.note || '本地插件清单里的预置工具，可按需加入当前账号的插件页。')}</p>
            </div>
            <i data-lucide="${escapeHTML(iconName)}" class="w-4 h-4 text-gray-400 dark:text-white/35 shrink-0"></i>
          </div>
          <div class="mt-auto flex items-center gap-2">
            <button type="button" onclick="event.stopPropagation(); ${detailAction}" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              详情
            </button>
            <button
              type="button"
              aria-label="${installed ? '已添加，去插件页管理' : `添加 ${escapeHTML(definition?.name || key)}`}"
              title="${installed ? '已添加，去插件页管理' : '添加到插件页'}"
              onclick="event.stopPropagation(); ${installAction}"
              class="ml-auto inline-flex items-center font-medium text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors ${installed ? 'text-[11px]' : 'text-[18px]'}"
            >
              ${installLabel}
            </button>
          </div>
        </section>
      `;
    }

    function buildMarketplaceMarkup(installedCatalog = null, marketplaceItems = []) {
      const catalog = installedCatalog && typeof installedCatalog === 'object' ? installedCatalog : { extensions: [] };
      return marketplaceItems.map((item) => buildMarketplaceCardMarkup(item, catalog)).join('');
    }

    async function installMarketplacePluginById(extensionId = '', options = {}) {
      const key = String(extensionId || '').trim();
      if (!key) return false;
      const confirmed = options && options.confirmed === true;
      const storage = api.storage;
      if (!storage || typeof storage.readExtensionDataJson !== 'function' || typeof storage.writeExtensionDataJson !== 'function') {
        if (typeof api.openCustomModal === 'function') {
          api.openCustomModal({
            title: '当前环境暂不支持',
            desc: '当前运行环境还不能写入本地插件目录，请在支持本地写入的桌面端使用这个入口。',
          });
        }
        return false;
      }
      const marketplaceItems = await loadLocalMarketplaceCatalog();
      const target = marketplaceItems.find((item) => String(item?.id || '').trim() === key) || null;
      if (!target) {
        if (typeof api.openCustomModal === 'function') {
          api.openCustomModal({
            title: '没有找到插件',
            desc: '这条插件清单在本地没有找到对应 manifest。',
          });
        }
        return false;
      }
      let existingValue = null;
      try {
        const payload = await storage.readExtensionDataJson(
          USER_LOCAL_EXTENSION_CATALOG_STORAGE_ID,
          { relativePath: USER_LOCAL_EXTENSION_CATALOG_RELATIVE_PATH }
        );
        existingValue = payload?.value && typeof payload.value === 'object' ? payload.value : null;
      } catch (_) {
        existingValue = null;
      }
      const existing = normalizeExtensionCatalog(existingValue);
      const nextMap = new Map();
      (Array.isArray(existing.extensions) ? existing.extensions : []).forEach((item) => {
        const id = String(item?.id || '').trim();
        if (!id) return;
        nextMap.set(id, item);
      });
      const alreadyInstalled = nextMap.has(key);
      if (!alreadyInstalled && !confirmed) {
        if (typeof api.openCustomModal === 'function') {
          api.openCustomModal({
            title: '添加到插件页？',
            desc: `将把「${String(target.name || key).trim() || key}」加入你的插件页，并默认开启。`,
            onConfirm: () => { void installMarketplacePluginById(key, { confirmed: true }); },
          });
          return false;
        }
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (!window.confirm(`确认将「${String(target.name || key).trim() || key}」添加到插件页并默认开启吗？`)) return false;
        }
      }
      nextMap.set(key, { ...target, defaultEnabled: false });
      const nextCatalog = {
        version: Math.max(Number(existing.version || 2), 2),
        updatedAt: new Date().toISOString(),
        extensions: Array.from(nextMap.values()),
      };
      await storage.writeExtensionDataJson(
        USER_LOCAL_EXTENSION_CATALOG_STORAGE_ID,
        nextCatalog,
        { relativePath: USER_LOCAL_EXTENSION_CATALOG_RELATIVE_PATH }
      );
      userLocalExtensionIdSet = new Set(nextCatalog.extensions.map((item) => String(item?.id || '').trim()).filter(Boolean));
      const ecosystemRuntime = getEcosystemRegistryRuntime();
      if (ecosystemRuntime && typeof ecosystemRuntime.invalidateExtensionCatalogCache === 'function') {
        ecosystemRuntime.invalidateExtensionCatalogCache();
      }
      invalidateCatalogCache();
      await loadOfficialExtensionCatalog();
      const setEnabled = api.setExtensionEnabled || (typeof globalThis !== 'undefined' && typeof globalThis.setExtensionEnabled === 'function' ? globalThis.setExtensionEnabled : null);
      if (typeof setEnabled === 'function') {
        try { setEnabled(key, true, { silent: true }); } catch (_) {}
      }
      if (typeof api.refreshExtensionSurfaceBindings === 'function') api.refreshExtensionSurfaceBindings();
      await renderExtensionsView();
      return true;
    }

    function buildConfigFacts(extensionId, definition = null) {
      const resolvedDefinition = definition || getDefinitionById(catalogCache, extensionId);
      if (!resolvedDefinition) return [];
      const meta = resolveExtensionRuntimeState(extensionId, resolvedDefinition);
      if (meta.facts.length) return meta.facts.slice(0, 4);
      const facts = [];
      facts.push(`配置：${resolvedDefinition.requiresConfiguration ? (meta.ready ? '已完成' : '待完成') : '无需配置'}`);
      facts.push(`数据：${meta.hasData ? '已检测到' : '暂无'}`);
      if (resolvedDefinition?.hostIntegration?.settingsSection?.label) facts.push(`设置入口：${resolvedDefinition.hostIntegration.settingsSection.label}`);
      if (resolvedDefinition?.hostIntegration?.entryCommandId) facts.push(`默认入口：${resolvedDefinition.hostIntegration.entryCommandId}`);
      return facts.slice(0, 4);
    }

    function buildHealthLabel(extensionId, definition = null) {
      const resolvedDefinition = definition || getDefinitionById(catalogCache, extensionId);
      if (!resolvedDefinition) return '未检查';
      const meta = resolveExtensionRuntimeState(extensionId, resolvedDefinition);
      if (meta.error) return '运行异常';
      if (!meta.enabled) return '未启用';
      if (resolvedDefinition.requiresConfiguration && !meta.ready) return meta.pendingLabel || '待配置';
      if (meta.hasData) return meta.readyLabel || '已就绪';
      return resolvedDefinition.requiresConfiguration ? (meta.readyLabel || '已配置') : '已启用';
    }

    function buildExtensionCardMarkup(definition) {
      const key = String(definition?.id || '').trim();
      if (!key) return '';
      const enabled = api.isExtensionEnabled ? api.isExtensionEnabled(key) : false;
      const selected = key === selectedExtensionId;
      const summaryText = String(definition?.description || definition?.summary || buildExtensionSummary(key, definition) || '')
        .replace(/\s*\n+\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return `
        <section class="extension-card glass-card rounded-[1.2rem] p-5 flex flex-col gap-3 w-full cursor-pointer transition-all ${selected ? 'ring-1 ring-black/15 dark:ring-white/20 border-gray-300 dark:border-white/20' : ''}" style="height:178px;max-height:178px;min-height:178px;" data-extension-id="${escapeHTML(key)}" onclick="if (event && (event.button !== 0 || event.ctrlKey === true)) return; openExtensionDetail('${key}')">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-medium text-black dark:text-white/90 truncate whitespace-nowrap max-w-full">${definition.name}</h2>
              </div>
              <p class="mt-2 text-[11px] leading-5 text-gray-600 dark:text-white/70 overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${summaryText}</p>
            </div>
            <i data-lucide="${definition.icon || 'puzzle'}" class="w-4 h-4 text-gray-400 dark:text-white/35 shrink-0"></i>
          </div>
          <div class="mt-auto flex items-center gap-2">
            <button type="button" onclick="event.stopPropagation(); openExtensionDetail('${key}')" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              详情
            </button>
            <button type="button" onclick="event.stopPropagation(); openExtensionSettings('${key}')" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              配置
            </button>
            <button
              type="button"
              role="switch"
              data-extension-switch="true"
              data-extension-name="${escapeHTML(definition.name || '')}"
              aria-checked="${enabled ? 'true' : 'false'}"
              aria-label="${enabled ? '停用' : '启用'} ${definition.name}"
              onclick="return toggleExtensionEnabledFromCard(event, '${key}', this)"
              class="ml-auto inline-flex items-center text-[11px] font-medium text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors"
            >
              <span data-extension-switch-track class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-white/15'}">
                <span data-extension-switch-thumb class="inline-block h-4 w-4 rounded-full bg-white dark:bg-[#232020] transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}"></span>
              </span>
            </button>
          </div>
        </section>
      `;
    }

    function buildDetailMarkup(definition) {
      if (!definition) return '';
      const key = String(definition.id || '').trim();
      const enabled = api.isExtensionEnabled ? api.isExtensionEnabled(key) : false;
      const facts = buildConfigFacts(key, definition);
      const healthLabel = buildHealthLabel(key, definition);
      if (typeof api.buildExtensionDetailShell === 'function') {
        return api.buildExtensionDetailShell(definition, { enabled, healthLabel, facts });
      }
      return '';
    }

    function buildDebugRows(items = [], renderItem = () => '') {
      return (Array.isArray(items) ? items : [])
        .map((item, index) => renderItem(item, index))
        .filter(Boolean)
        .join('');
    }

    function buildDebugSubsection(title, body) {
      const content = String(body || '').trim();
      if (!content) return '';
      return `<div>${escapeHTML(String(title || ''))}</div>${content}`;
    }

    function buildExtensionsDebugPanelMarkup(snapshot = null) {
      const memoryReport = snapshot?.memoryReport && typeof snapshot.memoryReport === 'object'
        ? snapshot.memoryReport
        : (typeof api.getMemoryHealthReport === 'function' ? api.getMemoryHealthReport() : null);
      const syncInspection = snapshot?.syncInspection && typeof snapshot.syncInspection === 'object'
        ? snapshot.syncInspection
        : null;
      const syncState = snapshot?.syncMutationState && typeof snapshot.syncMutationState === 'object'
        ? snapshot.syncMutationState
        : (typeof api.getSyncMutationState === 'function' ? api.getSyncMutationState() : null);
      const taskState = snapshot?.taskRuntimeState && typeof snapshot.taskRuntimeState === 'object'
        ? snapshot.taskRuntimeState
        : null;
      const actionInspection = snapshot?.actionInspection && typeof snapshot.actionInspection === 'object'
        ? snapshot.actionInspection
        : null;
      const actionTransactions = Array.isArray(actionInspection?.recentTransactions)
        ? actionInspection.recentTransactions
        : (Array.isArray(snapshot?.actionTransactions) ? snapshot.actionTransactions : []);
      const lastActionTransaction = actionInspection?.latestTransaction && typeof actionInspection.latestTransaction === 'object'
        ? actionInspection.latestTransaction
        : (snapshot?.lastActionTransaction && typeof snapshot.lastActionTransaction === 'object' ? snapshot.lastActionTransaction : null);
      const runtimeSnapshot = snapshot?.runtimeSnapshot && typeof snapshot.runtimeSnapshot === 'object'
        ? snapshot.runtimeSnapshot
        : null;
      const blocks = [];
      if (memoryReport && typeof memoryReport === 'object') {
        const issues = Array.isArray(memoryReport.issues) ? memoryReport.issues : [];
        const overview = memoryReport.snapshot && typeof memoryReport.snapshot === 'object' && memoryReport.snapshot.overview && typeof memoryReport.snapshot.overview === 'object'
          ? memoryReport.snapshot.overview
          : {};
        blocks.push(`
          <section>
            <div>Memory Health</div>
            <div>${escapeHTML(String(memoryReport.status || 'unknown'))}</div>
            ${issues.map((item) => `<div>${escapeHTML(String(item?.summary || ''))}</div>`).join('')}
            <div>recentUserCount=${escapeHTML(String(overview.recentUserCount || 0))}</div>
            <div>pendingCandidateCount=${escapeHTML(String(overview.pendingCandidateCount || 0))}</div>
          </section>
        `);
      }
      if (syncState && typeof syncState === 'object') {
        const pendingMutations = Array.isArray(syncInspection?.pendingMutations)
          ? syncInspection.pendingMutations
          : (Array.isArray(syncState.pendingMutations) ? syncState.pendingMutations : []);
        const entityStates = Array.isArray(syncInspection?.pendingEntities)
          ? syncInspection.pendingEntities
          : (syncState.entityStates && typeof syncState.entityStates === 'object' ? Object.values(syncState.entityStates) : []);
        const lastReceipt = Array.isArray(syncInspection?.receiptTimeline) && syncInspection.receiptTimeline.length
          ? syncInspection.receiptTimeline[0]
          : (syncState.lastReceipt && typeof syncState.lastReceipt === 'object' ? syncState.lastReceipt : null);
        const conflict = syncInspection?.conflict && typeof syncInspection.conflict === 'object'
          ? syncInspection.conflict
          : (lastReceipt?.conflict && typeof lastReceipt.conflict === 'object' ? lastReceipt.conflict : null);
        const mergedMutations = Array.isArray(syncInspection?.mergedMutations)
          ? syncInspection.mergedMutations
          : (Array.isArray(lastReceipt?.mergedMutations) ? lastReceipt.mergedMutations : []);
        const receiptTimeline = Array.isArray(syncInspection?.receiptTimeline)
          ? syncInspection.receiptTimeline
          : [];
        const syncQueue = syncInspection?.syncQueue && typeof syncInspection.syncQueue === 'object'
          ? syncInspection.syncQueue
          : null;
        blocks.push(`
          <section>
            <div>Sync Health</div>
            <div>ackedRevision=${escapeHTML(String(syncInspection?.ackedRevision || syncState.ackedRevision || 0))}</div>
            <div>pendingDomains=${escapeHTML((Array.isArray(syncInspection?.pendingDomains) ? syncInspection.pendingDomains : (Array.isArray(syncState.pendingDomains) ? syncState.pendingDomains : [])).join(', '))}</div>
            <div>Pending Mutations</div>
            ${pendingMutations.map((item) => `<div>${escapeHTML(String(item?.mutationId || ''))} · ${escapeHTML((Array.isArray(item?.domains) ? item.domains : []).join(', '))}</div>`).join('')}
            <div>Pending Entities</div>
            ${entityStates.map((item) => `<div>${escapeHTML(String(item?.domain || ''))} · ${escapeHTML(String(item?.entityType || ''))} · ${escapeHTML(String(item?.entityId || ''))}</div>`).join('')}
            ${lastReceipt ? `<div>Conflict Receipt</div><div>${escapeHTML(String(lastReceipt.message || ''))}</div>` : ''}
            ${conflict ? `<div>${escapeHTML(String(conflict.incomingDeviceId || ''))}</div>` : ''}
            ${mergedMutations.length ? `<div>Mutation Receipt</div>${mergedMutations.map((item) => `<div>${escapeHTML(String(item?.domain || ''))} · ${escapeHTML(String(item?.entityType || ''))} · ${escapeHTML(String(item?.entityId || ''))}</div>`).join('')}` : ''}
            ${buildDebugSubsection('Sync Queue', `
              <div>pendingRevision=${escapeHTML(String(syncQueue?.pendingRevision || syncInspection?.latestPendingRevision || 0))}</div>
              <div>pendingMutations=${escapeHTML(String(syncQueue?.pendingCount || pendingMutations.length || 0))}</div>
              <div>pendingEntities=${escapeHTML(String(syncQueue?.pendingEntityCount || entityStates.length || 0))}</div>
              ${buildDebugRows(Array.isArray(syncQueue?.mutations) ? syncQueue.mutations : pendingMutations, (item) => `
                <div>${escapeHTML(String(item?.mutationId || ''))} · rev=${escapeHTML(String(item?.revision || 0))} · ${escapeHTML((Array.isArray(item?.domains) ? item.domains : []).join(', '))}</div>
                ${String(item?.entitySummary || '').trim() ? `<div>${escapeHTML(String(item?.entitySummary || ''))}</div>` : ''}
              `)}
            `)}
            ${buildDebugSubsection('Receipt Timeline', buildDebugRows(receiptTimeline, (item) => `
              <div>${escapeHTML(String(item?.kind || 'receipt'))} · ${escapeHTML(String(item?.status || ''))} · ${escapeHTML(String(item?.source || ''))}</div>
              ${String(item?.summary || item?.message || '').trim() ? `<div>${escapeHTML(String(item?.summary || item?.message || ''))}</div>` : ''}
            `))}
          </section>
        `);
      }
      if (taskState && typeof taskState === 'object') {
        blocks.push(`
          <section>
            <div>Task Runtime</div>
            <div>lastEvent=${escapeHTML(String(taskState.lastTaskEventKind || ''))}</div>
            <div>lastUpdatedAt=${escapeHTML(String(taskState.lastUpdatedAt || ''))}</div>
            <div>proactive=${escapeHTML(String(taskState.proactiveScan?.running === true ? 'running' : taskState.proactiveScan?.timerActive === true ? 'armed' : 'idle'))}</div>
            <div>reminderDispatch=${escapeHTML(String(taskState.reminderDispatch?.running === true ? 'running' : taskState.reminderDispatch?.timerActive === true ? 'armed' : 'idle'))}</div>
            <div>reminderLanSync=${escapeHTML(String(taskState.reminderLanSync?.running === true ? 'running' : taskState.reminderLanSync?.timerActive === true ? 'armed' : 'idle'))}</div>
            <div>dailyAlign=${escapeHTML(String(taskState.dailyAlign?.running === true ? 'running' : taskState.dailyAlign?.timerActive === true ? 'armed' : 'idle'))}</div>
          </section>
        `);
      }
      if (actionTransactions.length) {
        const traceDrilldown = actionInspection?.traceDrilldown && typeof actionInspection.traceDrilldown === 'object'
          ? actionInspection.traceDrilldown
          : null;
        blocks.push(`
          <section>
            <div>Action Transactions</div>
            ${actionTransactions.slice(-6).reverse().map((item) => `
              <div>${escapeHTML(String(item?.id || ''))} · ${escapeHTML(String(item?.source || ''))} · ${escapeHTML((Array.isArray(item?.actionTypes) ? item.actionTypes : []).join(', '))}</div>
              ${String(item?.receiptSummary || '').trim() ? `<div>${escapeHTML(String(item?.receiptSummary || ''))}</div>` : ''}
            `).join('')}
            ${buildDebugSubsection('Transaction Timeline', buildDebugRows(Array.isArray(traceDrilldown?.transactions) ? traceDrilldown.transactions : [], (item) => `
              <div>${escapeHTML(String(item?.id || ''))} · ${escapeHTML(String(item?.status || ''))} · ${escapeHTML(String(item?.createdAt || ''))}</div>
              <div>${escapeHTML((Array.isArray(item?.domains) ? item.domains : []).join(', '))}</div>
            `))}
            ${buildDebugSubsection('Action Trace Drill-down', buildDebugRows(Array.isArray(traceDrilldown?.transactions) ? traceDrilldown.transactions : [], (item) => `
              <div>${escapeHTML(String(item?.id || ''))}</div>
              ${buildDebugRows(Array.isArray(item?.trace) ? item.trace : [], (traceEntry) => `
                <div>${escapeHTML(String(traceEntry?.summary || `${traceEntry?.type || ''} · ${traceEntry?.status || ''}`))}</div>
                ${String(traceEntry?.receiptSummary || traceEntry?.message || '').trim() ? `<div>${escapeHTML(String(traceEntry?.receiptSummary || traceEntry?.message || ''))}</div>` : ''}
              `)}
            `))}
          </section>
        `);
      }
      if (lastActionTransaction && typeof lastActionTransaction === 'object') {
        const entry = lastActionTransaction.entry && typeof lastActionTransaction.entry === 'object'
          ? lastActionTransaction.entry
          : null;
        const driftedDomains = Array.isArray(lastActionTransaction.driftedDomains)
          ? lastActionTransaction.driftedDomains
          : [];
        blocks.push(`
          <section>
            <div>Latest Transaction</div>
            <div>id=${escapeHTML(String(entry?.id || ''))}</div>
            <div>source=${escapeHTML(String(entry?.source || ''))}</div>
            <div>actions=${escapeHTML((Array.isArray(entry?.actionTypes) ? entry.actionTypes : []).join(', '))}</div>
            <div>domains=${escapeHTML((Array.isArray(entry?.domains) ? entry.domains : []).join(', '))}</div>
            <div>status=${escapeHTML(String(entry?.status || ''))}</div>
            ${driftedDomains.length ? `<div>drifted=${escapeHTML(driftedDomains.join(', '))}</div>` : ''}
            ${String(lastActionTransaction.reason || '').trim() ? `<div>${escapeHTML(String(lastActionTransaction.reason || ''))}</div>` : ''}
          </section>
        `);
      }
      if (runtimeSnapshot && typeof runtimeSnapshot === 'object') {
        const currentView = runtimeSnapshot.currentView && typeof runtimeSnapshot.currentView === 'object'
          ? runtimeSnapshot.currentView
          : null;
        const runtimeFootprint = runtimeSnapshot.runtimeFootprint && typeof runtimeSnapshot.runtimeFootprint === 'object'
          ? runtimeSnapshot.runtimeFootprint
          : (snapshot?.runtimeFootprint && typeof snapshot.runtimeFootprint === 'object' ? snapshot.runtimeFootprint : null);
        const receiptFeed = runtimeSnapshot.receiptFeed && typeof runtimeSnapshot.receiptFeed === 'object'
          ? runtimeSnapshot.receiptFeed
          : null;
        const reminderRouting = runtimeSnapshot.reminderNativeRoutingState && typeof runtimeSnapshot.reminderNativeRoutingState === 'object'
          ? runtimeSnapshot.reminderNativeRoutingState
          : null;
        blocks.push(`
          <section>
            <div>Runtime Snapshot</div>
            <div>Boot Phase</div>
            <div>${escapeHTML(String(runtimeSnapshot.bootPhase || ''))}</div>
            ${currentView ? `<div>Current View</div><div>${escapeHTML(String(currentView.tab || ''))} · ${escapeHTML(String(currentView.selectedDailyMonth || ''))}</div>` : ''}
            ${runtimeFootprint ? `<div>Runtime Footprint</div><div>chatSessions=${escapeHTML(String(runtimeFootprint.chatSessionCount || 0))} · currentMessages=${escapeHTML(String(runtimeFootprint.currentSessionMessageCount || 0))} · totalMessages=${escapeHTML(String(runtimeFootprint.totalChatMessageCount || 0))}</div><div>stableMemoryFacts=${escapeHTML(String(runtimeFootprint.stableMemoryFactCount || 0))} · locked=${escapeHTML(String(runtimeFootprint.lockedStableMemoryFactCount || 0))} · explicit=${escapeHTML(String(runtimeFootprint.explicitUserStableFactCount || 0))} · settings=${escapeHTML(String(runtimeFootprint.settingsDerivedStableFactCount || 0))}</div><div>thoughtGraphNodes=${escapeHTML(String(runtimeFootprint.thoughtGraphNodeCount || 0))} · layout=${escapeHTML(String(runtimeFootprint.thoughtGraphLayout || 'unknown'))}</div>` : ''}
            ${receiptFeed ? `<div>Receipt Feed</div><div>${escapeHTML(String(receiptFeed.kind || ''))} · pending=${escapeHTML(String(receiptFeed.pendingCount || 0))}</div>` : ''}
            ${reminderRouting ? `<div>Reminder Routing</div><div>${escapeHTML(String(reminderRouting.platform || ''))} · ${escapeHTML(String(reminderRouting.mode || ''))}</div>` : ''}
          </section>
        `);
      }
      return blocks.join('');
    }

    function renderExtensionDetail(catalog) {
      const panel = document.getElementById('extensions-detail-panel');
      if (!panel) return;
      const definition = getDefinitionById(catalog, selectedExtensionId);
      if (!definition) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
      }
      panel.classList.remove('hidden');
      panel.innerHTML = buildDetailMarkup(definition);
    }

    async function renderExtensionsView(options = {}) {
      const grid = document.getElementById('extensions-grid');
      const debug = document.getElementById('extensions-debug-status');
      const debugPanel = document.getElementById('extensions-debug-panel');
      const panel = document.getElementById('extensions-detail-panel');
      if (!grid) return;
      const settingsState = api.getSettingsState ? api.getSettingsState() : {};
      if (settingsState.glucoseConfigLoaded !== true && typeof api.loadGlucoseConfigFromServer === 'function') {
        api.loadGlucoseConfigFromServer({ silent: true });
      }
      if (settingsState.feishuConfigLoaded !== true && typeof api.loadFeishuConfigFromServer === 'function') {
        api.loadFeishuConfigFromServer({ silent: true });
      }
      const renderOptions = options && typeof options === 'object' ? options : {};
      const forceCatalogRefresh = renderOptions.forceCatalogRefresh === true;
      const ecosystemRuntime = getEcosystemRegistryRuntime();
      const observabilityRuntime = getObservabilityRuntime();
      const debugSnapshot = observabilityRuntime && typeof observabilityRuntime.buildExtensionDebugSnapshot === 'function'
        ? observabilityRuntime.buildExtensionDebugSnapshot()
        : null;
      const cachedCatalog = ecosystemRuntime && typeof ecosystemRuntime.getCachedExtensionCatalog === 'function'
        ? ecosystemRuntime.getCachedExtensionCatalog()
        : catalogCache;
      const catalog = forceCatalogRefresh
        ? (await loadOfficialExtensionCatalog({ forceRefresh: true }) || cachedCatalog || normalizeExtensionCatalog(null))
        : (cachedCatalog || await loadOfficialExtensionCatalog({ forceRefresh: false }) || normalizeExtensionCatalog(null));
      const viewMode = getActiveViewMode();
      syncExtensionsPageHeader(viewMode);
      grid.style.gap = '';
      grid.style.gridTemplateColumns = '';
      grid.style.justifyContent = '';
      if (viewMode === 'marketplace') {
        const marketplaceItems = await loadLocalMarketplaceCatalog();
        grid.innerHTML = buildMarketplaceMarkup(catalog, marketplaceItems);
        if (panel) {
          panel.classList.add('hidden');
          panel.innerHTML = '';
        }
        if (debug) {
          debug.classList.add('hidden');
          debug.textContent = '';
        }
        if (debugPanel) {
          debugPanel.classList.add('hidden');
          debugPanel.innerHTML = '';
        }
        grid.classList.remove('hidden');
        if (typeof api.requestLucideRefresh === 'function') {
          api.requestLucideRefresh({ root: document.getElementById('view-extensions') });
        }
        return;
      }
      const cards = (Array.isArray(catalog.extensions) ? catalog.extensions : [])
        .filter((item) => !isBuiltinHostFeatureId(item?.id) && !isHiddenExtensionId(item?.id));
      const activeDefinition = isBuiltinHostFeatureId(selectedExtensionId)
        ? null
        : getDefinitionById(catalog, selectedExtensionId);
      grid.innerHTML = cards.map(buildExtensionCardMarkup).join('');
      if (typeof grid.querySelectorAll === 'function') {
        grid.querySelectorAll('.extension-card[data-extension-id]').forEach((node) => {
          if (!node || typeof node.addEventListener !== 'function') return;
          node.addEventListener('contextmenu', (event) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
            const key = String(node?.dataset?.extensionId || '').trim();
            if (!key) {
              closeExtensionCardContextMenu();
              return;
            }
            const definition = getDefinitionById(catalog, key);
            openExtensionCardContextMenu(event, definition);
          });
        });
      }
      renderExtensionDetail(catalog);
      const detailMode = !!activeDefinition;
      const runtimeDebugStatus = observabilityRuntime && typeof observabilityRuntime.shouldShowDebugStatus === 'function'
        ? observabilityRuntime.shouldShowDebugStatus() === true
        : false;
      const localDebugStatus = typeof api.shouldShowDebugStatus === 'function'
        ? api.shouldShowDebugStatus() === true
        : false;
      const showDebug = !detailMode && (runtimeDebugStatus || localDebugStatus);
      if (panel) {
        panel.classList.toggle('hidden', !detailMode);
      }
      if (debug) {
        debug.classList.toggle('hidden', !showDebug);
        debug.textContent = showDebug
          ? String(debugSnapshot?.memorySummary || (typeof api.buildMemoryHealthStatusSummary === 'function'
            ? api.buildMemoryHealthStatusSummary()
            : '') || '').trim()
          : '';
      }
      if (debugPanel) {
        debugPanel.classList.toggle('hidden', !showDebug);
        debugPanel.innerHTML = showDebug
          ? buildExtensionsDebugPanelMarkup(debugSnapshot)
          : '';
      }
      grid.classList.toggle('hidden', detailMode);
      if (typeof api.requestLucideRefresh === 'function') {
        api.requestLucideRefresh({ root: document.getElementById('view-extensions') });
      }
    }

    function openExtensionDetail(key = '') {
      const normalized = String(key || '').trim();
      if (!normalized) return;
      if (isBuiltinHostFeatureId(normalized) || isHiddenExtensionId(normalized)) return;
      marketplaceOpen = false;
      marketplaceReturnExtensionId = '';
      selectedExtensionId = normalized;
      void renderExtensionsView();
    }

    function closeExtensionDetail() {
      selectedExtensionId = '';
      marketplaceOpen = false;
      marketplaceReturnExtensionId = '';
      void renderExtensionsView();
    }

    function resetExtensionSelection() {
      selectedExtensionId = '';
      marketplaceOpen = false;
      marketplaceReturnExtensionId = '';
    }

    function setMarketplaceReturnSelection(key = '') {
      marketplaceReturnExtensionId = String(key || '').trim();
    }

    function openExtensionMarketplace() {
      if (selectedExtensionId) marketplaceReturnExtensionId = selectedExtensionId;
      selectedExtensionId = '';
      marketplaceOpen = true;
      void renderExtensionsView();
    }

    function returnFromMarketplace() {
      const target = String(marketplaceReturnExtensionId || '').trim();
      marketplaceOpen = false;
      marketplaceReturnExtensionId = '';
      selectedExtensionId = target;
      void renderExtensionsView();
    }

    function showExtensionList() {
      selectedExtensionId = '';
      marketplaceOpen = false;
      marketplaceReturnExtensionId = '';
      const panel = document.getElementById('extensions-detail-panel');
      const grid = document.getElementById('extensions-grid');
      if (panel) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
      }
      if (grid) {
        grid.classList.remove('hidden');
      }
    }

    function mapVisibilityTargetToElementId(target = '') {
      const key = String(target || '').trim();
      if (key === 'health-tab') return 'tab-health';
      if (key === 'channel-ops-tab') return 'tab-channelOps';
      if (key === 'health-more') return 'mobile-more-health';
      if (key === 'channel-ops-more') return 'mobile-more-channelOps';
      return '';
    }

    function getVisibilityPairs() {
      const catalog = catalogCache || { extensions: [] };
      const pairs = [];
      (catalog.extensions || []).forEach((definition) => {
        const enabled = api.isExtensionEnabled ? api.isExtensionEnabled(definition.id) : false;
        (definition.visibilityTargets || []).forEach((target) => {
          const elementId = mapVisibilityTargetToElementId(target);
          if (elementId) pairs.push([elementId, enabled]);
        });
      });
      return pairs;
    }

    function invalidateCatalogCache() {
      catalogCache = null;
      marketplaceCatalogCache = null;
      userLocalExtensionIdSet = new Set();
      catalogLoadState = { phase: 'idle', transport: '', source: '', count: 0, error: '' };
    }

    return {
      loadOfficialExtensionCatalog,
      invalidateCatalogCache,
      renderExtensionsView,
      openExtensionDetail,
      closeExtensionDetail,
      resetExtensionSelection,
      setMarketplaceReturnSelection,
      openExtensionMarketplace,
      returnFromMarketplace,
      installMarketplacePluginById,
      showExtensionList,
      getActiveViewMode,
      getSelectedExtensionId: () => selectedExtensionId,
      getVisibilityPairs,
      getCachedCatalog: () => {
        const ecosystemRuntime = getEcosystemRegistryRuntime();
        if (ecosystemRuntime && typeof ecosystemRuntime.getCachedExtensionCatalog === 'function') {
          return ecosystemRuntime.getCachedExtensionCatalog();
        }
        return catalogCache;
      },
      getCatalogLoadState: () => {
        const ecosystemRuntime = getEcosystemRegistryRuntime();
        if (ecosystemRuntime && typeof ecosystemRuntime.getExtensionCatalogLoadState === 'function') {
          return ecosystemRuntime.getExtensionCatalogLoadState();
        }
        return { ...catalogLoadState };
      },
    };
  }

  window.MorphExtensionsRuntime = {
    create: createExtensionsRuntime,
  };
})();
