(function initMorphEcosystemRegistryRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphEcosystemRegistryRuntime && typeof window.MorphEcosystemRegistryRuntime.create === 'function') return;

  const ALLOWED_CONTEXT_PANEL_TARGETS = new Set([
    'health-top',
    'health-chart-bottom',
    'project-top'
  ]);
  const USER_LOCAL_EXTENSION_CATALOG_STORAGE_ID = 'local-plugin-catalog';
  const USER_LOCAL_EXTENSION_CATALOG_RELATIVE_PATH = 'data/extensions/local-plugin-catalog/state.json';

  function normalizeStringList(value) {
    return Array.isArray(value)
      ? value.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
  }

  function normalizeClientTargets(value) {
    return normalizeStringList(value)
      .map((item) => {
        const text = String(item || '').trim().toLowerCase();
        return text === 'desktop' || text === 'mobile' ? text : '';
      })
      .filter(Boolean);
  }

  function createEcosystemRegistryRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    let extensionCatalogCache = null;
    let extensionCatalogLoadState = {
      phase: 'idle',
      transport: '',
      source: '',
      count: 0,
      error: '',
    };
    let bundledSkillManifestCache = null;

    async function loadJson(url = '') {
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

    function normalizeExtensionItem(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const id = String(raw.id || '').trim();
      if (!id) return null;
      const ui = raw.ui && typeof raw.ui === 'object' ? raw.ui : {};
      const requires = raw.requires && typeof raw.requires === 'object' ? raw.requires : {};
      const hostIntegration = raw.hostIntegration && typeof raw.hostIntegration === 'object' ? raw.hostIntegration : {};
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
        tags: normalizeStringList(raw.tags),
        settingsTarget: String(raw.settingsTarget || id).trim() || id,
        visibilityTargets: normalizeStringList(raw.visibilityTargets),
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
          createdItemTargets: normalizeStringList(hostIntegration.createdItemTargets),
        },
        dataModel: {
          namespace: String(dataModel.namespace || id).trim() || id,
          state: String(dataModel.state || 'none').trim() || 'none',
          stateKey: String(dataModel.stateKey || '').trim(),
          history: String(dataModel.history || 'none').trim() || 'none',
          syncPolicy: String(dataModel.syncPolicy || 'inherit-root').trim() || 'inherit-root',
          sharedDomains: normalizeStringList(dataModel.sharedDomains),
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
          accounts: normalizeStringList(requires.accounts),
          devices: normalizeStringList(requires.devices),
          runtimeCapabilities: normalizeStringList(requires.runtimeCapabilities),
        },
      };
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

    async function loadCatalogViaWeb(url = '') {
      const candidates = buildManifestUrlCandidates(url);
      for (const candidate of candidates) {
        const json = await loadJson(candidate);
        if (!json || typeof json !== 'object') continue;
        return {
          json,
          transport: 'web',
          source: (/^file:/i.test(String(window?.location?.protocol || '')) ? 'file-bundle' : 'http'),
        };
      }
      return null;
    }

    async function loadUserLocalExtensionCatalog() {
      const storage = api.storage;
      if (!storage || typeof storage.readExtensionDataJson !== 'function') return null;
      try {
        const payload = await storage.readExtensionDataJson(
          USER_LOCAL_EXTENSION_CATALOG_STORAGE_ID,
          { relativePath: USER_LOCAL_EXTENSION_CATALOG_RELATIVE_PATH }
        );
        const value = payload?.value;
        if (!value || typeof value !== 'object') return null;
        return normalizeExtensionCatalog(value);
      } catch (_) {
        return null;
      }
    }

    async function loadOfficialExtensionCatalog(options = {}) {
      const forceRefresh = options && typeof options === 'object' && options.forceRefresh === true;
      if (!forceRefresh && extensionCatalogCache) return extensionCatalogCache;
      extensionCatalogLoadState = { phase: 'loading', transport: '', source: '', count: 0, error: '' };
      try {
        const loaded = await loadCatalogViaNativeBridge('official') || await loadCatalogViaWeb('extensions/manifest.json');
        const userLocalLoaded = await loadUserLocalExtensionCatalog();
        const bundledLocalLoaded = await loadCatalogViaNativeBridge('marketplace') || await loadCatalogViaWeb('extensions/local-manifest.json');
        const normalized = normalizeExtensionCatalog({
          version: Number(loaded?.json?.version || bundledLocalLoaded?.json?.version || userLocalLoaded?.version || 2),
          updatedAt: String(loaded?.json?.updatedAt || bundledLocalLoaded?.json?.updatedAt || userLocalLoaded?.updatedAt || ''),
          extensions: []
            .concat(Array.isArray(loaded?.json?.extensions) ? loaded.json.extensions : [])
            .concat(Array.isArray(userLocalLoaded?.extensions) ? userLocalLoaded.extensions : [])
            .concat(Array.isArray(bundledLocalLoaded?.json?.extensions) ? bundledLocalLoaded.json.extensions : []),
        });
        extensionCatalogCache = normalized;
        extensionCatalogLoadState = {
          phase: normalized.extensions.length ? 'loaded' : 'empty',
          transport: String(loaded?.transport || ''),
          source: String(loaded?.source || ''),
          count: normalized.extensions.length,
          error: normalized.extensions.length ? '' : 'no_extensions_found',
        };
      } catch (_) {
        extensionCatalogCache = normalizeExtensionCatalog(null);
        extensionCatalogLoadState = { phase: 'error', transport: '', source: '', count: 0, error: 'catalog_load_failed' };
      }
      return extensionCatalogCache;
    }

    function invalidateExtensionCatalogCache() {
      extensionCatalogCache = null;
      extensionCatalogLoadState = {
        phase: 'idle',
        transport: '',
        source: '',
        count: 0,
        error: '',
      };
    }

    async function loadBundledSkillManifest() {
      if (bundledSkillManifestCache) return bundledSkillManifestCache;
      const loader = window.MorphConfigLoader;
      try {
        const manifest = loader && typeof loader.loadSkillCatalogFromUrl === 'function'
          ? await loader.loadSkillCatalogFromUrl('/skills/manifest.json')
          : await loadJson('/skills/manifest.json');
        if (!manifest || typeof manifest !== 'object') return null;
        bundledSkillManifestCache = manifest;
        return bundledSkillManifestCache;
      } catch (_) {
        return null;
      }
    }

    function getExtensionDefinitionById(id = '') {
      const normalizedId = String(id || '').trim();
      if (!normalizedId) return null;
      const list = Array.isArray(extensionCatalogCache?.extensions) ? extensionCatalogCache.extensions : [];
      return list.find((item) => String(item?.id || '').trim() === normalizedId) || null;
    }

    return {
      normalizeExtensionItem,
      normalizeExtensionCatalog,
      loadOfficialExtensionCatalog,
      invalidateExtensionCatalogCache,
      getCachedExtensionCatalog: () => extensionCatalogCache,
      getExtensionCatalogLoadState: () => ({ ...extensionCatalogLoadState }),
      getExtensionDefinitionById,
      loadBundledSkillManifest,
    };
  }

  window.MorphEcosystemRegistryRuntime = {
    create: createEcosystemRegistryRuntime,
  };
})();
