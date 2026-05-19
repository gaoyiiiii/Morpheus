(function initMorphLocalPluginShellRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphLocalPluginShellRuntime && typeof window.MorphLocalPluginShellRuntime.create === 'function') return;

  function fallbackEscapeHTML(text = '') {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toTitleCaseWords(text = '') {
    return String(text || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  function createLocalPluginShellRuntime(deps = {}) {
    const escapeHTML = typeof deps.escapeHTML === 'function' ? deps.escapeHTML : fallbackEscapeHTML;
    const getWorkspaceShellById = typeof deps.getWorkspaceShellById === 'function'
      ? deps.getWorkspaceShellById
      : () => ({});
    const getWorkspaceHeaderActionsById = typeof deps.getWorkspaceHeaderActionsById === 'function'
      ? deps.getWorkspaceHeaderActionsById
      : () => [];
    const getDocument = typeof deps.getDocument === 'function'
      ? deps.getDocument
      : () => (typeof document !== 'undefined' ? document : null);
    const requestAnimationFrameFn = typeof deps.requestAnimationFrame === 'function'
      ? deps.requestAnimationFrame
      : (typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame.bind(typeof window !== 'undefined' ? window : null)
        : (callback) => {
            if (typeof callback === 'function') callback();
            return 0;
          });
    let localPluginWorkspaceScrollTop = 0;

    function deriveWorkspaceEnglishTitle(definition = null, shell = null, fallback = {}) {
      const explicit = String(shell?.englishTitle || shell?.subtitle || shell?.titleEn || fallback.englishTitle || fallback.subtitle || fallback.titleEn || '').trim();
      if (explicit) return explicit;
      const sidebarLabel = String(definition?.hostIntegration?.sidebarEntry?.label || '').trim();
      const sidebarMatch = sidebarLabel.match(/\(([^)]+)\)/);
      if (sidebarMatch && String(sidebarMatch[1] || '').trim()) {
        return String(sidebarMatch[1] || '').trim();
      }
      const title = String(shell?.title || fallback.title || definition?.name || '').trim();
      const titleMatch = title.match(/\(([^)]+)\)/);
      if (titleMatch && String(titleMatch[1] || '').trim()) {
        return String(titleMatch[1] || '').trim();
      }
      const id = String(definition?.id || '').trim().replace(/-plugin$/i, '');
      if (!id) return '';
      return toTitleCaseWords(id.replace(/[-_]+/g, ' '));
    }

    function getWorkspaceShellSpec(definition = null) {
      const extensionId = String(definition?.id || '').trim();
      if (!extensionId) return {};
      const shell = getWorkspaceShellById(extensionId);
      return shell && typeof shell === 'object' ? shell : {};
    }

    function resolveWorkspaceShellCopy(definition = null, fallback = {}) {
      const shell = getWorkspaceShellSpec(definition);
      return {
        eyebrow: String(shell?.eyebrow || fallback.eyebrow || '').trim(),
        title: String(shell?.title || fallback.title || '').trim(),
        englishTitle: deriveWorkspaceEnglishTitle(definition, shell, fallback),
        description: String(shell?.description || fallback.description || '').trim(),
        backLabel: String(shell?.backLabel || fallback.backLabel || '').trim(),
      };
    }

    function renderWorkspaceShell({
      eyebrow = '',
      title = '插件工作台',
      englishTitle = '',
      description = '',
      badges = [],
      leftActions = [],
      rightActions = [],
      body = '',
      bodyClass = '',
    } = {}) {
      const defaultMenuAction = `<button type="button" onclick="togglePrimarySidebarVisibility(event)" aria-label="切换导航栏" class="shrink-0 w-8 h-8 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white inline-flex items-center justify-center"><i data-lucide="menu" class="w-4 h-4"></i></button>`;
      const leftHtml = [defaultMenuAction].concat(Array.isArray(leftActions) ? leftActions : []).join('');
      const badgeHtml = (Array.isArray(badges) ? badges : []).filter(Boolean).join('');
      return `
        <section class="h-full w-full max-w-none flex flex-col min-h-0 relative">
          <div class="health-view-header shrink-0 flex items-start justify-between gap-3 mb-5">
            <div class="page-header-copy flex items-start gap-3 min-w-0">
              ${leftHtml ? `<div class="shrink-0 mt-0.5 flex items-center gap-2 flex-wrap">${leftHtml}</div>` : ''}
              <div class="min-w-0">
                ${eyebrow ? `<div class="text-gray-500 dark:text-white/45 font-mono text-[9px] tracking-widest uppercase">${escapeHTML(eyebrow)}</div>` : ''}
                <div class="${eyebrow ? 'mt-1.5 ' : ''}flex items-center gap-3 flex-wrap">
                  <h1 class="text-lg sm:text-2xl text-black dark:text-white/90 tracking-wide font-tech">${escapeHTML(title)}${englishTitle ? ` <span class="text-gray-500 dark:text-white/35 text-sm sm:text-lg ml-2">(${escapeHTML(englishTitle)})</span>` : ''}</h1>
                  ${badgeHtml}
                </div>
                ${description ? `<p class="text-gray-500 dark:text-white/45 font-mono text-[9px] tracking-widest uppercase mt-1">${escapeHTML(description)}</p>` : ''}
              </div>
            </div>
          </div>
          <div class="flex-1 overflow-hidden flex flex-col pt-0">
            <div data-local-plugin-scroll-body class="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col gap-4 pt-2 pb-8">
              <div class="${bodyClass || 'flex flex-col gap-4'}">${body}</div>
            </div>
          </div>
        </section>
      `;
    }

    function getLocalPluginWorkspaceScrollBody(root = null) {
      const doc = getDocument();
      const scope = root && typeof root.querySelector === 'function'
        ? root
        : doc;
      return scope && typeof scope.querySelector === 'function'
        ? scope.querySelector('[data-local-plugin-scroll-body]') || null
        : null;
    }

    function captureLocalPluginWorkspaceScroll(root = null) {
      const scroller = getLocalPluginWorkspaceScrollBody(root);
      if (!scroller) return;
      localPluginWorkspaceScrollTop = Number(scroller.scrollTop || 0);
    }

    function restoreLocalPluginWorkspaceScroll(root = null) {
      const scroller = getLocalPluginWorkspaceScrollBody(root);
      if (!scroller) return;
      const nextTop = Number(localPluginWorkspaceScrollTop || 0);
      requestAnimationFrameFn(() => {
        scroller.scrollTop = nextTop;
      });
    }

    function buildWorkspaceGhostAction(label = '配置', onclick = '') {
      const handler = String(onclick || '').trim();
      return `
        <button type="button" ${handler ? `onclick="${handler}"` : ''} class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">${escapeHTML(label)}</button>
      `;
    }

    function buildWorkspaceMetaBadge(text = '') {
      const value = String(text || '').trim();
      if (!value) return '';
      return `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/55">${escapeHTML(value)}</span>`;
    }

    function buildWorkspaceHeaderActions(definition = null, options = {}) {
      const settings = options && typeof options === 'object' ? options : {};
      const skipPrimary = settings.skipPrimary === true;
      const extensionId = String(definition?.id || '').trim();
      if (!extensionId) return [];
      const source = getWorkspaceHeaderActionsById(extensionId);
      const list = skipPrimary ? source.slice(1) : source.slice();
      return list.map((action) => {
        const label = String(action?.label || '').trim();
        const commandId = String(action?.commandId || '').trim();
        if (!label || !commandId) return '';
        const icon = String(action?.icon || 'sparkles').trim() || 'sparkles';
        const classes = 'header-action-pill inline-flex items-center gap-2';
        return `
          <button type="button" onclick="executeIntegratedExtensionWorkspaceAction('${escapeHTML(extensionId)}','${escapeHTML(commandId)}')" class="${classes}">
            <i data-lucide="${escapeHTML(icon)}" class="w-3.5 h-3.5"></i><span>${escapeHTML(label)}</span>
          </button>
        `;
      }).filter(Boolean);
    }

    return {
      deriveWorkspaceEnglishTitle,
      getWorkspaceShellSpec,
      resolveWorkspaceShellCopy,
      renderWorkspaceShell,
      getLocalPluginWorkspaceScrollBody,
      captureLocalPluginWorkspaceScroll,
      restoreLocalPluginWorkspaceScroll,
      buildWorkspaceGhostAction,
      buildWorkspaceMetaBadge,
      buildWorkspaceHeaderActions,
    };
  }

  window.MorphLocalPluginShellRuntime = {
    create: createLocalPluginShellRuntime,
  };
  window.LianXingLocalPluginShellRuntime = window.MorphLocalPluginShellRuntime;
})();
