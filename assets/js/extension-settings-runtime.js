// @ts-check
(function initMorphExtensionSettingsRuntime() {
  /**
   * @typedef {import('../../interfaces/extensions').OfficialExtensionManifest} OfficialExtensionManifest
   */

    function createExtensionSettingsRuntime(deps = {}) {
      const api = deps && typeof deps === 'object' ? deps : {};

    function splitDescriptionParts(text = '') {
      return String(text || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function renderHumanDescription(text = '') {
      const parts = splitDescriptionParts(text);
      if (!parts.length) return '';
      return `<p class="text-[12px] leading-6 text-gray-600 dark:text-white/70">${parts.join(' ')}</p>`;
    }

    function buildHostIntegrationFacts(definition) {
      const host = definition?.hostIntegration && typeof definition.hostIntegration === 'object' ? definition.hostIntegration : {};
      const facts = [];
      if (host.sidebarEntry?.label) facts.push(`左侧导航：${host.sidebarEntry.label}`);
      if (host.sidebarFooterEntry?.label) facts.push(`侧栏底部：${host.sidebarFooterEntry.label}`);
      if (host.mobileMoreEntry?.label) facts.push(`手机更多：${host.mobileMoreEntry.label}`);
      if (host.drawerEntry?.label) facts.push(`抽屉入口：${host.drawerEntry.label}`);
      if (host.entryCommandId) facts.push(`默认入口命令：${host.entryCommandId}`);
      if (Array.isArray(host.contextPanels) && host.contextPanels.length) {
        host.contextPanels.forEach((panel) => {
          const target = String(panel?.target || '').trim() || 'unknown';
          const label = String(panel?.label || '').trim() || target;
          facts.push(`上下文面板：${label} · ${target}`);
        });
      }
      if (Array.isArray(host.chatShortcuts) && host.chatShortcuts.length) {
        host.chatShortcuts.forEach((shortcut) => {
          const label = String(shortcut?.label || '').trim();
          if (label) facts.push(`聊天快捷入口：${label}`);
        });
      }
      if (Array.isArray(host.workspaceHeaderActions) && host.workspaceHeaderActions.length) {
        host.workspaceHeaderActions.forEach((action) => {
          const label = String(action?.label || '').trim();
          if (label) facts.push(`工作台头部动作：${label}`);
        });
      }
      const shell = definition?.ui?.workspaceShell && typeof definition.ui.workspaceShell === 'object'
        ? definition.ui.workspaceShell
        : {};
      if (shell.eyebrow) facts.push(`工作台眉标题：${shell.eyebrow}`);
      if (shell.backLabel) facts.push(`工作台返回文案：${shell.backLabel}`);
      if (Array.isArray(host.createdItemTargets) && host.createdItemTargets.length) {
        facts.push(`AI 创建项回跳：${host.createdItemTargets.join('、')}`);
      }
      if (host.settingsSection?.label) facts.push(`设置入口：${host.settingsSection.label}`);
      return facts;
    }

    function buildCommandFacts(definition) {
      const commands = Array.isArray(definition?.commands) ? definition.commands : [];
      return commands.map((command) => {
        const label = String(command?.label || '').trim() || String(command?.id || '').trim();
        const action = String(command?.action || 'custom').trim() || 'custom';
        const target = String(command?.target || '').trim();
        return target ? `命令：${label} · ${action} · ${target}` : `命令：${label} · ${action}`;
      }).filter(Boolean);
    }

    function buildDataModelFacts(definition) {
      const model = definition?.dataModel && typeof definition.dataModel === 'object' ? definition.dataModel : {};
      const namespace = String(model.namespace || definition?.id || '').trim();
      const state = String(model.state || 'none').trim() || 'none';
      const stateKey = String(model.stateKey || '').trim();
      const history = String(model.history || 'none').trim() || 'none';
      const syncPolicy = String(model.syncPolicy || 'inherit-root').trim() || 'inherit-root';
      const sharedDomains = Array.isArray(model.sharedDomains) ? model.sharedDomains.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const facts = [
        `命名空间：${namespace || '-'}`,
        `状态层：${state}`,
        `历史层：${history}`,
        `同步策略：${syncPolicy}`,
      ];
      if (stateKey) facts.push(`共享键：${stateKey}`);
      if (state === 'root-pluginData' && namespace) facts.push(`状态路径：pluginData.${namespace}`);
      if (history === 'file-backed' && namespace) {
        facts.push(`文件目录：data/plugins/${namespace}/`);
        facts.push(`建议事件文件：data/plugins/${namespace}/events.ndjson`);
      }
      if (api.storage && typeof api.storage.getExtensionDataRelativePaths === 'function' && namespace) {
        const descriptor = api.storage.getExtensionDataRelativePaths(namespace);
        if (descriptor?.stateFile) facts.push(`状态文件：${descriptor.stateFile}`);
        if (descriptor?.eventsFile && history === 'file-backed') facts.push(`事件文件：${descriptor.eventsFile}`);
        if (descriptor?.cacheFile) facts.push(`缓存文件：${descriptor.cacheFile}`);
      }
      if (sharedDomains.length) facts.push(`共享域：${sharedDomains.join('、')}`);
      return facts;
    }

    /**
     * @param {OfficialExtensionManifest | null | undefined} definition
     * @param {{ enabled?: boolean, healthLabel?: string, facts?: string[] }} options
     */
    function buildDetailShell(definition, options = {}) {
      if (!definition) return '';
      const enabled = options.enabled === true;
      const facts = Array.isArray(options.facts) ? options.facts : [];
      const permissions = Array.isArray(definition.permissions) ? definition.permissions : [];
      const hostFacts = buildHostIntegrationFacts(definition);
      const commandFacts = buildCommandFacts(definition);
      const dataModelFacts = buildDataModelFacts(definition);
      const requirements = []
        .concat(Array.isArray(definition.requires?.accounts) ? definition.requires.accounts.map((item) => `账号：${item}`) : [])
        .concat(Array.isArray(definition.requires?.devices) ? definition.requires.devices.map((item) => `设备：${item}`) : [])
        .concat(Array.isArray(definition.requires?.runtimeCapabilities) ? definition.requires.runtimeCapabilities.map((item) => `能力：${item}`) : []);
      const healthLabel = String(options.healthLabel || '').trim() || '未检查';
      return `
        <section class="glass-card rounded-[1.3rem] p-5 sm:p-6 flex flex-col gap-5 flex-1 min-h-full">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
                <button type="button" onclick="closeExtensionDetail()" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[11px] font-medium text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                  <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回插件列表</span>
                </button>
            </div>
            <div class="flex items-center gap-2 ml-auto flex-wrap">
              <button type="button" onclick="openExtensionSettings('${definition.id}')" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                配置
              </button>
              <button
                type="button"
                role="switch"
                aria-checked="${enabled ? 'true' : 'false'}"
                aria-label="${enabled ? '停用' : '启用'} ${definition.name}"
                onclick="toggleExtensionEnabled('${definition.id}')"
                class="inline-flex items-center text-[11px] font-medium text-gray-600 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors"
              >
                <span class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-white/15'}">
                  <span class="inline-block h-4 w-4 rounded-full bg-white dark:bg-[#232020] transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}"></span>
                </span>
              </button>
            </div>
          </div>
          <div class="min-w-0">
              <div class="flex items-center gap-3 flex-wrap">
                <h2 class="text-base font-medium text-black dark:text-white/90">${definition.name}</h2>
                <span class="px-2.5 py-1 rounded-full text-[10px] font-mono ${enabled ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/55'}">${enabled ? '已启用' : '未启用'}</span>
                <span class="px-2.5 py-1 rounded-full text-[10px] font-mono bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/55">${definition.category || definition.kind}</span>
                <span class="px-2.5 py-1 rounded-full text-[10px] font-mono bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/55">${healthLabel}</span>
              </div>
              <div class="mt-3 space-y-2">${renderHumanDescription(definition.description || definition.summary || '')}</div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">当前状态</div>
              <div class="mt-3 space-y-2">
                ${facts.length ? facts.map((item) => `<div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">${item}</div>`).join('') : '<div class="text-[12px] leading-6 text-gray-500 dark:text-white/45">暂无额外状态。</div>'}
              </div>
            </div>
            <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">依赖与入口</div>
              <div class="mt-3 space-y-2">
                <div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">Owner：${definition.owner || 'official'}</div>
                <div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">Source：${definition.source || 'official'}</div>
                <div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">Entry：${definition.entry || '-'}</div>
                ${requirements.length ? requirements.map((item) => `<div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">${item}</div>`).join('') : '<div class="text-[12px] leading-6 text-gray-500 dark:text-white/45">无额外依赖。</div>'}
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">权限</div>
              <div class="mt-3 space-y-2">
                ${permissions.length ? permissions.map((item) => `<div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">${item.label || item.id}${item.required ? ' · 必需' : ''}</div>`).join('') : '<div class="text-[12px] leading-6 text-gray-500 dark:text-white/45">未声明权限。</div>'}
              </div>
            </div>
            <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">标签</div>
              <div class="mt-3 flex flex-wrap gap-2">
                ${(definition.tags || []).map((tag) => `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/55">${tag}</span>`).join('') || '<span class="text-[12px] leading-6 text-gray-500 dark:text-white/45">无标签。</span>'}
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">宿主接入</div>
              <div class="mt-3 space-y-2">
                ${hostFacts.length ? hostFacts.map((item) => `<div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">${item}</div>`).join('') : '<div class="text-[12px] leading-6 text-gray-500 dark:text-white/45">当前没有声明额外宿主入口。</div>'}
              </div>
            </div>
            <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">数据模型</div>
              <div class="mt-3 space-y-2">
                ${dataModelFacts.length ? dataModelFacts.map((item) => `<div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">${item}</div>`).join('') : '<div class="text-[12px] leading-6 text-gray-500 dark:text-white/45">未声明数据模型。</div>'}
              </div>
            </div>
          </div>
          <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
            <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">插件命令</div>
            <div class="mt-3 space-y-2">
              ${commandFacts.length ? commandFacts.map((item) => `<div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">${item}</div>`).join('') : '<div class="text-[12px] leading-6 text-gray-500 dark:text-white/45">当前没有声明插件命令。</div>'}
            </div>
          </div>
        </section>
      `;
    }

    function buildSettingsCardSummary(items = []) {
      const list = Array.isArray(items) ? items : [];
      if (!list.length) return '当前没有已注册插件';
      const enabledCount = list.filter((item) => item && item.enabled === true).length;
      return `已注册 ${list.length} 个插件，已启用 ${enabledCount} 个`;
    }

    return {
      buildDetailShell,
      buildSettingsCardSummary,
    };
  }

  window.MorphExtensionSettingsRuntime = {
    create: createExtensionSettingsRuntime,
  };
})();
