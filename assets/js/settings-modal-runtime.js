// @ts-check
/** @typedef {import("../../interfaces/frontend-settings").SettingsModalRuntimeDeps} SettingsModalRuntimeDeps */
/** @typedef {import("../../interfaces/frontend-settings").SettingsModalRuntimeModules} SettingsModalRuntimeModules */
/** @typedef {import("../../interfaces/frontend-settings").SettingsLocalPluginDefinition} SettingsLocalPluginDefinition */

(function initMorphSettingsModalRuntime() {
  /**
   * @param {SettingsModalRuntimeDeps} [deps={}]
   * @returns {SettingsModalRuntimeModules}
   */
  function createSettingsModalRuntime(deps) {
    /** @type {Required<SettingsModalRuntimeDeps>} */
    const api = /** @type {Required<SettingsModalRuntimeDeps>} */ (deps && typeof deps === 'object' ? deps : {});
    const modalTriggerState = Object.create(null);
    /** @type {Record<string, { labelledby: string, focusIds: string[] }>} */
    const modalShellConfig = {
      'settings-local-plugin-modal': {
        labelledby: 'settings-local-plugin-title',
        focusIds: ['settings-local-plugin-close-action', 'settings-local-plugin-close-modal'],
      },
      'settings-daily-align-modal': {
        labelledby: 'settings-daily-align-title',
        focusIds: ['settings-daily-align-time-input', 'settings-daily-align-enabled-input', 'settings-daily-align-save', 'settings-daily-align-close-modal'],
      },
      'settings-ai-key-modal': {
        labelledby: 'settings-ai-key-modal-title',
        focusIds: ['settings-ai-key-modal-input', 'settings-ai-key-modal-base-url', 'settings-ai-key-modal-model', 'settings-ai-key-modal-save', 'settings-ai-key-close-modal'],
      },
      'settings-secure-vault-modal': {
        labelledby: 'settings-secure-vault-title',
        focusIds: ['settings-secure-vault-account-input', 'settings-secure-vault-passphrase-input', 'settings-secure-vault-backup', 'settings-secure-vault-close-modal'],
      },
      'settings-glucose-modal': {
        labelledby: 'settings-glucose-modal-title',
        focusIds: ['settings-glucose-email-input', 'settings-glucose-password-input', 'settings-glucose-target-low-input', 'settings-glucose-save', 'settings-glucose-close-modal'],
      },
      'settings-feishu-modal': {
        labelledby: 'settings-feishu-modal-title',
        focusIds: ['settings-feishu-app-id-input', 'settings-feishu-app-secret-input', 'settings-feishu-verification-token-input', 'settings-feishu-encrypt-key-input', 'settings-feishu-bot-name-input', 'settings-feishu-save', 'settings-feishu-close-modal'],
      },
      'settings-apple-health-modal': {
        labelledby: 'settings-apple-health-modal-title',
        focusIds: ['settings-apple-health-enabled-input', 'settings-apple-health-authorize', 'settings-apple-health-refresh', 'settings-apple-health-close-modal'],
      },
    };
    const externalDialogHooks = [
      ['openGlucoseSettingsModal', 'closeGlucoseSettingsModal', 'settings-glucose-modal'],
      ['openFeishuSettingsModal', 'closeFeishuSettingsModal', 'settings-feishu-modal'],
      ['openAppleHealthSettingsModal', 'closeAppleHealthSettingsModal', 'settings-apple-health-modal'],
    ];
    const POMODORO_PLUGIN_ID = 'pomodoro-plugin';
    let globalEscapeBound = false;
    let pomodoroRuntimeModules = null;

    /**
     * @param {string} modalId
     * @param {boolean} open
     */
    function syncModalShell(modalId, open) {
      const modal = document.getElementById(modalId);
      if (!modal) return;
      const config = modalShellConfig[modalId] || null;
      if (open) {
        modal.hidden = false;
        if (typeof modal.removeAttribute === 'function') modal.removeAttribute('inert');
      }
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', open ? 'true' : 'false');
      if (config?.labelledby) modal.setAttribute('aria-labelledby', config.labelledby);
      else if (modal.removeAttribute) modal.removeAttribute('aria-labelledby');
      modal.setAttribute('tabindex', '-1');
      modal.classList.toggle('opacity-0', !open);
      modal.classList.toggle('pointer-events-none', !open);
      modal.setAttribute('aria-hidden', open ? 'false' : 'true');
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.classList.toggle('scale-95', !open);
        content.classList.toggle('scale-100', open);
      }
      if (!open) {
        modal.setAttribute('inert', '');
        modal.hidden = true;
      }
    }

    function rememberModalTrigger(modalId) {
      const active = document.activeElement || null;
      modalTriggerState[modalId] = active && typeof active === 'object' ? {
        id: String(active.id || '').trim(),
        element: active,
      } : null;
    }

    function restoreModalTrigger(modalId) {
      const trigger = modalTriggerState[modalId];
      modalTriggerState[modalId] = null;
      const target = trigger?.id
        ? document.getElementById(trigger.id)
        : trigger?.element || null;
      if (!target || typeof target.focus !== 'function') return;
      requestAnimationFrame(() => {
        try {
          target.focus({ preventScroll: true });
        } catch (_) {
          try { target.focus(); } catch (_) {}
        }
      });
    }

    /**
     * @param {string} modalId
     */
    function focusModalPrimaryControl(modalId) {
      const config = modalShellConfig[modalId];
      if (!config) return false;
      const activeId = String(document.activeElement && document.activeElement.id || '').trim();
      if (activeId && config.focusIds.includes(activeId)) return true;
      for (const elementId of config.focusIds) {
        const candidate = document.getElementById(elementId);
        if (!candidate || typeof candidate.focus !== 'function') continue;
        requestAnimationFrame(() => {
          try {
            candidate.focus({ preventScroll: true });
          } catch (_) {
            try { candidate.focus(); } catch (_) {}
          }
        });
        return true;
      }
      const modal = document.getElementById(modalId);
      if (modal && typeof modal.focus === 'function') {
        requestAnimationFrame(() => {
          try {
            modal.focus({ preventScroll: true });
          } catch (_) {
            try { modal.focus(); } catch (_) {}
          }
        });
        return true;
      }
      return false;
    }

    /**
     * @param {string} modalId
     */
    function isModalElementOpen(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) return false;
      if (typeof modal.getAttribute === 'function') return modal.getAttribute('aria-hidden') === 'false';
      return String(/** @type {Record<string, any>} */ (modal)['aria-hidden'] || '') === 'false';
    }

    /**
     * @param {string} functionName
     * @param {string} modalId
     * @param {'open' | 'close'} mode
     */
    function installExternalDialogHook(functionName, modalId, mode) {
      const descriptor = Object.getOwnPropertyDescriptor(window, functionName);
      const existingGetter = descriptor && descriptor.get ? /** @type {Function & { __morphDialogHook?: boolean }} */ (descriptor.get) : null;
      if (existingGetter && existingGetter.__morphDialogHook === true) return;
      let current = typeof window[functionName] === 'function' ? window[functionName] : null;
      if (typeof current === 'function') current = wrapExternalDialogHandler(current, modalId, mode);
      if (!current) return;
      if (descriptor && descriptor.configurable === false) {
        try {
          window[functionName] = current;
        } catch (_) {}
        return;
      }
      const dialogGetter = /** @type {(() => unknown) & { __morphDialogHook?: boolean }} */ (function morphDialogGetter() {
        return current;
      });
      dialogGetter.__morphDialogHook = true;
      try {
        Object.defineProperty(window, functionName, {
          configurable: true,
          enumerable: true,
          get: dialogGetter,
          set(next) {
            current = typeof next === 'function' ? wrapExternalDialogHandler(next, modalId, mode) : next;
          },
        });
      } catch (_) {
        try {
          window[functionName] = current;
        } catch (_) {}
      }
    }

    /**
     * @param {Function} original
     * @param {string} modalId
     * @param {'open' | 'close'} mode
     */
    function wrapExternalDialogHandler(original, modalId, mode) {
      const originalWithMeta = /** @type {Function & { __morphDialogWrapped?: boolean }} */ (original);
      if (typeof original !== 'function' || originalWithMeta.__morphDialogWrapped === true) return original;
      const wrapped = /** @type {Function & { __morphDialogWrapped?: boolean }} */ (function morphWrappedExternalDialogHandler(/** @type {any[]} */ ...args) {
        if (mode === 'open') rememberModalTrigger(modalId);
        const result = original.apply(/** @type {any} */ (this), args);
        syncModalShell(modalId, mode === 'open');
        if (mode === 'open') focusModalPrimaryControl(modalId);
        else restoreModalTrigger(modalId);
        return result;
      });
      wrapped.__morphDialogWrapped = true;
      return wrapped;
    }

    function bindGlobalEscapeHandler() {
      if (globalEscapeBound || typeof document.addEventListener !== 'function') return;
      globalEscapeBound = true;
      document.addEventListener('keydown', (event) => {
        if (!event || event.key !== 'Escape' || event.defaultPrevented) return;
        const openModalId = getTopMostOpenSettingsModalId();
        if (!openModalId) return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        closeModalById(openModalId);
      });
    }

    function getTopMostOpenSettingsModalId() {
      const modalOrder = [
        'settings-local-plugin-modal',
        'settings-feishu-modal',
        'settings-apple-health-modal',
        'settings-secure-vault-modal',
        'settings-ai-key-modal',
        'settings-daily-align-modal',
        'settings-glucose-modal',
      ];
      return modalOrder.find((modalId) => isSettingsModalOpen(modalId)) || '';
    }

    function isSettingsModalOpen(modalId) {
      if (modalId === 'settings-local-plugin-modal') return !!api.getLocalPluginSettingsModalOpen() || isModalElementOpen(modalId);
      if (modalId === 'settings-daily-align-modal') return !!api.getDailyAlignSettingsModalOpen() || isModalElementOpen(modalId);
      if (modalId === 'settings-ai-key-modal') return !!api.getAIKeySettingsModalOpen() || isModalElementOpen(modalId);
      if (modalId === 'settings-secure-vault-modal') return !!api.getSecureVaultSettingsModalOpen() || isModalElementOpen(modalId);
      if (modalId === 'settings-glucose-modal' || modalId === 'settings-feishu-modal' || modalId === 'settings-apple-health-modal') return isModalElementOpen(modalId);
      return false;
    }

    function closeModalById(modalId) {
      if (modalId === 'settings-local-plugin-modal') {
        closeLocalPluginSettingsModal();
        return;
      }
      if (modalId === 'settings-daily-align-modal') {
        closeDailyAlignSettingsModal();
        return;
      }
      if (modalId === 'settings-ai-key-modal') {
        closeAIKeySettingsModal();
        return;
      }
      if (modalId === 'settings-secure-vault-modal') {
        closeSecureVaultSettingsModal();
        return;
      }
      if (modalId === 'settings-glucose-modal' && typeof window.closeGlucoseSettingsModal === 'function') {
        window.closeGlucoseSettingsModal();
        return;
      }
      if (modalId === 'settings-feishu-modal' && typeof window.closeFeishuSettingsModal === 'function') {
        window.closeFeishuSettingsModal();
        return;
      }
      if (modalId === 'settings-apple-health-modal' && typeof window.closeAppleHealthSettingsModal === 'function') {
        window.closeAppleHealthSettingsModal();
      }
    }

    function escapeHTML(value = '') {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function getPomodoroRuntimeModules() {
      if (pomodoroRuntimeModules) return pomodoroRuntimeModules;
      const factory = window.MorphPomodoroPluginRuntime && typeof window.MorphPomodoroPluginRuntime.create === 'function'
        ? window.MorphPomodoroPluginRuntime.create
        : null;
      if (!factory) return null;
      pomodoroRuntimeModules = factory({
        isExtensionEnabled: (extensionId) => {
          const rootData = typeof api.getData === 'function' ? api.getData() : null;
          const enabledMap = rootData?.morphRuntime?.userPreferences?.extensionsState;
          if (enabledMap && typeof enabledMap === 'object') return enabledMap[String(extensionId || '').trim()] === true;
          return String(extensionId || '').trim() === POMODORO_PLUGIN_ID;
        },
        getData: () => (typeof api.getData === 'function' ? api.getData() : {}),
        getExtensionPrivateState: (extensionId) => (
          typeof api.getExtensionPrivateState === 'function'
            ? api.getExtensionPrivateState(extensionId, api.getData ? api.getData() : undefined)
            : {}
        ),
        setExtensionPrivateState: (extensionId, updater, options = {}) => {
          if (typeof api.setExtensionPrivateState === 'function') {
            api.setExtensionPrivateState(extensionId, updater, options);
          }
        },
      });
      return pomodoroRuntimeModules;
    }

    function getPomodoroSettingsState() {
      const runtime = getPomodoroRuntimeModules();
      return runtime && typeof runtime.getPluginState === 'function'
        ? runtime.getPluginState({ sync: true })
        : null;
    }

    function buildPomodoroSettingsMarkup() {
      const state = getPomodoroSettingsState();
      if (!state) {
        return `<div class="w-full rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-4 text-[12px] leading-6 text-gray-500 dark:text-white/45">番茄时钟 runtime 尚未加载，暂时无法渲染配置项。</div>`;
      }
      const runtime = getPomodoroRuntimeModules();
      const presets = runtime && typeof runtime.getQuickStartPresets === 'function' ? runtime.getQuickStartPresets() : [15, 25, 45];
      const statusText = runtime && typeof runtime.getStatusLabel === 'function' ? runtime.getStatusLabel(state.status) : String(state.status || 'idle');
      const phaseText = runtime && typeof runtime.getPhaseLabel === 'function' ? runtime.getPhaseLabel(state.phase) : String(state.phase || 'focus');
      const currentTaskText = state.currentTaskLabel ? `当前主题：${escapeHTML(state.currentTaskLabel)}` : '当前没有设置主题';
      return `
        <div class="w-full space-y-4">
          <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-[12px] font-medium text-gray-900 dark:text-white/88">${escapeHTML(statusText)} · ${escapeHTML(phaseText)}</div>
                <div class="mt-1 text-[11px] text-gray-500 dark:text-white/45">${currentTaskText}</div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                ${presets.map((minutes) => `<button type="button" onclick="savePomodoroPluginSettingsFromModal(${Number(minutes) || 25}, true)" class="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[11px] font-medium text-gray-600 dark:text-white/72 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">设为 ${escapeHTML(String(minutes))} 分钟专注</button>`).join('')}
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="block text-[11px] font-medium text-gray-600 dark:text-white/68 mb-1.5">专注时长（分钟）</span>
              <input id="settings-pomodoro-focus-duration" type="number" min="1" max="180" value="${escapeHTML(String(state.focusDurationMinutes || 25))}" class="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2.5 text-[13px] text-gray-900 dark:text-white/88 outline-none focus:border-gray-400 dark:focus:border-white/25 transition-colors">
            </label>
            <label class="block">
              <span class="block text-[11px] font-medium text-gray-600 dark:text-white/68 mb-1.5">短休息（分钟）</span>
              <input id="settings-pomodoro-short-break-duration" type="number" min="1" max="60" value="${escapeHTML(String(state.shortBreakMinutes || 5))}" class="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2.5 text-[13px] text-gray-900 dark:text-white/88 outline-none focus:border-gray-400 dark:focus:border-white/25 transition-colors">
            </label>
            <label class="block">
              <span class="block text-[11px] font-medium text-gray-600 dark:text-white/68 mb-1.5">长休息（分钟）</span>
              <input id="settings-pomodoro-long-break-duration" type="number" min="1" max="90" value="${escapeHTML(String(state.longBreakMinutes || 15))}" class="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2.5 text-[13px] text-gray-900 dark:text-white/88 outline-none focus:border-gray-400 dark:focus:border-white/25 transition-colors">
            </label>
            <label class="block">
              <span class="block text-[11px] font-medium text-gray-600 dark:text-white/68 mb-1.5">几个专注后进入长休息</span>
              <input id="settings-pomodoro-long-break-interval" type="number" min="2" max="8" value="${escapeHTML(String(state.longBreakInterval || 4))}" class="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2.5 text-[13px] text-gray-900 dark:text-white/88 outline-none focus:border-gray-400 dark:focus:border-white/25 transition-colors">
            </label>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label class="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-3">
              <input id="settings-pomodoro-auto-breaks" type="checkbox" ${state.autoStartBreaks ? 'checked' : ''} class="mt-0.5">
              <span>
                <span class="block text-[12px] font-medium text-gray-900 dark:text-white/88">自动开始休息</span>
                <span class="block mt-1 text-[11px] leading-5 text-gray-500 dark:text-white/45">专注结束后直接进入短休息或长休息。</span>
              </span>
            </label>
            <label class="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-3">
              <input id="settings-pomodoro-auto-focus" type="checkbox" ${state.autoStartFocus ? 'checked' : ''} class="mt-0.5">
              <span>
                <span class="block text-[12px] font-medium text-gray-900 dark:text-white/88">休息后自动回到专注</span>
                <span class="block mt-1 text-[11px] leading-5 text-gray-500 dark:text-white/45">适合连续工作节奏，不想每轮都手动点开始。</span>
              </span>
            </label>
            <label class="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-3">
              <input id="settings-pomodoro-sound-enabled" type="checkbox" ${state.soundEnabled !== false ? 'checked' : ''} class="mt-0.5">
              <span>
                <span class="block text-[12px] font-medium text-gray-900 dark:text-white/88">保留提示音开关</span>
                <span class="block mt-1 text-[11px] leading-5 text-gray-500 dark:text-white/45">先把偏好存起来，后续接入系统提醒时可直接复用。</span>
              </span>
            </label>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="savePomodoroPluginSettingsFromModal()" class="px-4 py-2.5 rounded-xl text-[12px] font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">保存配置</button>
            <button type="button" onclick="resetPomodoroPluginSettingsFromModal()" class="px-4 py-2.5 rounded-xl text-[12px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">恢复默认</button>
          </div>
          <div id="settings-pomodoro-feedback" class="text-[11px] leading-5 text-gray-500 dark:text-white/45">这里只保留配置项；倒计时、统计与历史请在番茄时钟工作台查看。</div>
        </div>
      `;
    }

    function buildPluginActionButton(label = '', onclick = '', tone = 'default') {
      const base = 'inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-medium transition-colors';
      const toneClass = tone === 'danger'
        ? 'border border-red-200 dark:border-red-400/20 bg-red-50 dark:bg-red-500/[0.08] text-red-600 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-500/[0.14]'
        : tone === 'secondary'
          ? 'border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/[0.08]'
          : 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200';
      return `<button type="button" onclick="${onclick}" class="${base} ${toneClass}">${escapeHTML(label)}</button>`;
    }

    /**
     * @param {SettingsLocalPluginDefinition | null} [definition=null]
     */
    function buildLocalPluginEntryHint(definition = null) {
      if (!definition || typeof definition !== 'object') return '这个插件已经接入 Morpheus，会在对应页面或入口里出现。';
      const currentClient = (() => {
        try {
          return typeof window.isMobileNavMode === 'function' && window.isMobileNavMode() ? 'mobile' : 'desktop';
        } catch (_) {
          return 'desktop';
        }
      })();
      const hostIntegration = definition.hostIntegration && typeof definition.hostIntegration === 'object'
        ? definition.hostIntegration
        : null;
      /** @param {string[] | undefined} targets */
      function isAllowed(targets) {
        const list = Array.isArray(targets) ? targets.map((item) => String(item || '').trim()).filter(Boolean) : [];
        if (!list.length) return true;
        return list.includes(currentClient);
      }
      const hostPlatforms = hostIntegration?.platforms;
      const sidebarLabel = isAllowed(hostPlatforms) && isAllowed(hostIntegration?.sidebarEntry?.platforms)
        ? String(hostIntegration?.sidebarEntry?.label || '').trim()
        : '';
      const mobileLabel = isAllowed(hostPlatforms) && isAllowed(hostIntegration?.mobileMoreEntry?.platforms)
        ? String(hostIntegration?.mobileMoreEntry?.label || '').trim()
        : '';
      const drawerLabel = isAllowed(hostPlatforms) && isAllowed(hostIntegration?.drawerEntry?.platforms)
        ? String(hostIntegration?.drawerEntry?.label || '').trim()
        : '';
      if (sidebarLabel) return `你可以在左侧导航里找到它，入口名称是“${sidebarLabel}”。`;
      if (mobileLabel) return `你可以在手机端的“更多”里找到它，入口名称是“${mobileLabel}”。`;
      if (drawerLabel) return `你可以通过右侧抽屉进入它，入口名称是“${drawerLabel}”。`;
      if (String(definition?.id || '').trim() === 'glucose') return '你可以在健康页里看到并使用它。配置完成后，血糖数据会直接进入健康页面。';
      if (String(definition?.id || '').trim() === 'health-state') return '你可以在健康页里看到它，它会直接并入健康页面一起工作。';
      return '这个插件已经接入 Morpheus，你可以从它对应的页面入口进入。';
    }

    /**
     * @param {SettingsLocalPluginDefinition | null} [definition=null]
     */
    function buildLocalPluginSummary(definition = null) {
      const key = String(definition?.id || '').trim();
      if (key === 'expense-ledger-plugin') {
        const rootData = typeof api.getData === 'function' ? api.getData() : null;
        const ledger = typeof api.ensureExpenseLedgerShape === 'function'
          ? api.ensureExpenseLedgerShape(rootData)
          : (rootData?.expenseLedger || {});
        const recordCount = Array.isArray(ledger?.records) ? ledger.records.length : 0;
        const categoryCount = Array.isArray(ledger?.categories) ? ledger.categories.length : 0;
        return `当前账本里有 ${recordCount} 条记录、${categoryCount} 个类目。你可以在这里导入 CSV，或在确认后清空全部记账数据。`;
      }
      if (key === POMODORO_PLUGIN_ID) {
        const state = getPomodoroSettingsState();
        if (state) {
          return `默认节奏是 ${state.focusDurationMinutes}/${state.shortBreakMinutes}/${state.longBreakMinutes} 分钟，${state.longBreakInterval} 个专注后长休息一次。这里仅保留配置项，运行内容继续放在番茄时钟工作台。`;
        }
      }
      const base = String(definition?.summary || definition?.description || '').replace(/\s+/g, ' ').trim();
      const settingsLabel = String(definition?.hostIntegration?.settingsSection?.label || definition?.name || '插件').trim() || '插件';
      if (base) return `${settingsLabel} 已接入 Morpheus。这里主要保留配置入口，运行内容仍在它自己的页面或工作台里。`;
      return '这个插件已经接入到 Morpheus。这里主要保留配置入口，运行内容仍在它自己的页面或工作台里。';
    }

    /**
     * @param {SettingsLocalPluginDefinition | null} [definition=null]
     */
    function buildLocalPluginActionMarkup(definition = null) {
      const key = String(definition?.id || '').trim();
      if (!key) return '';
      const actions = [];
      if (key === POMODORO_PLUGIN_ID) {
        actions.push(buildPomodoroSettingsMarkup());
      }
      if (key === 'expense-ledger-plugin') {
        actions.push(buildPluginActionButton('导入数据', `closeLocalPluginSettingsModal(); executeIntegratedExtensionCommand('expense-ledger-plugin','import-ledger-csv')`, 'default'));
        actions.push(buildPluginActionButton('清空全部记录', `closeLocalPluginSettingsModal(); confirmClearExpenseLedgerWorkspaceRecords()`, 'danger'));
      }
      return actions.join('');
    }

    function syncLocalPluginSettingsModalUI() {
      syncModalShell('settings-local-plugin-modal', api.getLocalPluginSettingsModalOpen());
      /** @type {SettingsLocalPluginDefinition | null} */
      const definition = api.getLocalPluginSettingsDefinition() || null;
      const title = document.getElementById('settings-local-plugin-title');
      if (title) title.textContent = definition?.name ? `${definition.name} 配置` : '工具配置';
      const subtitle = document.getElementById('settings-local-plugin-subtitle');
      if (subtitle) subtitle.textContent = definition?.description
        ? String(definition.description).replace(/\s+/g, ' ').trim()
        : '在这里查看插件当前状态，并执行它自己的配置动作。';
      const summary = document.getElementById('settings-local-plugin-summary');
      if (summary) summary.textContent = buildLocalPluginSummary(definition);
      const manifestPath = document.getElementById('settings-local-plugin-manifest-path');
      if (manifestPath) manifestPath.textContent = buildLocalPluginEntryHint(definition);
      const nextSteps = document.getElementById('settings-local-plugin-next-steps');
      if (nextSteps) {
        nextSteps.textContent = String(definition?.id || '').trim() === POMODORO_PLUGIN_ID
          ? '这里统一维护番茄节奏参数。开始、暂停、统计和历史都留在番茄时钟工作台，避免配置与详情混在一起。'
          : (String(definition?.summary || '').trim()
            || '统一的配置按钮已经接到工作台头部。后续如果这个插件有更多可调项，也会继续放到这里。');
      }
      const actions = document.getElementById('settings-local-plugin-actions');
      if (actions) {
        const actionMarkup = buildLocalPluginActionMarkup(definition);
        actions.innerHTML = actionMarkup;
        actions.classList.toggle('hidden', !actionMarkup);
      }
    }

    /**
     * @param {SettingsLocalPluginDefinition | null} [definition=null]
     */
    function openLocalPluginSettingsModal(definition = null) {
      rememberModalTrigger('settings-local-plugin-modal');
      api.setLocalPluginSettingsDefinition(definition && typeof definition === 'object' ? definition : null);
      api.setLocalPluginSettingsModalOpen(true);
      syncLocalPluginSettingsModalUI();
      focusModalPrimaryControl('settings-local-plugin-modal');
    }

    function closeLocalPluginSettingsModal() {
      api.setLocalPluginSettingsModalOpen(false);
      syncLocalPluginSettingsModalUI();
      restoreModalTrigger('settings-local-plugin-modal');
    }

    function openLocalPluginSettingsModalById(id = '') {
      const normalized = String(id || '').trim();
      if (!normalized) return;
      const runtime = api.getExtensionsRuntimeModules();
      const catalog = runtime?.getCachedCatalog ? runtime.getCachedCatalog() : null;
      const definition = Array.isArray(catalog?.extensions)
        ? catalog.extensions.find((item) => String(item?.id || '').trim() === normalized) || null
        : null;
      openLocalPluginSettingsModal(definition);
    }

    function syncDailyAlignSettingsModalUI() { syncModalShell('settings-daily-align-modal', api.getDailyAlignSettingsModalOpen()); }
    function openDailyAlignSettingsModal() {
      rememberModalTrigger('settings-daily-align-modal');
      api.setDailyAlignSettingsModalOpen(true);
      syncDailyAlignSettingsModalUI();
      if (api.getCurrentTab() === 'settings') api.renderSettingsView();
      /** @type {HTMLInputElement | null} */
      const input = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-daily-align-time-input'));
      if (input) requestAnimationFrame(() => { try { input.focus(); } catch (_) {} });
    }
    function closeDailyAlignSettingsModal() {
      api.setDailyAlignSettingsModalOpen(false);
      syncDailyAlignSettingsModalUI();
      restoreModalTrigger('settings-daily-align-modal');
    }

    function getAIProviderLabel(provider = 'gemini') {
      return provider === 'openrouter'
        ? 'OpenRouter'
        : provider === 'glm'
          ? 'GLM-4.7-Flash'
          : provider === 'doubao'
            ? 'Doubao-1.5-pro-256k'
            : provider === 'qwen'
              ? 'Qwen-Plus'
              : provider === 'kimi'
                ? 'Kimi'
            : provider === 'codex'
              ? 'Codex（OpenAI 兼容）'
              : 'Gemini';
    }

    function isAIProviderConfigured(provider = 'gemini') {
      const normalized = provider === 'openrouter'
        ? 'openrouter'
        : provider === 'glm'
          ? 'glm'
          : provider === 'doubao'
            ? 'doubao'
            : provider === 'qwen'
              ? 'qwen'
              : provider === 'kimi'
                ? 'kimi'
                : provider === 'codex'
                  ? 'codex'
                  : 'gemini';
      if (normalized === 'openrouter') return !!(api.getOpenRouterApiKey ? api.getOpenRouterApiKey() : '');
      if (normalized === 'glm') return !!(api.getGLMApiKey ? api.getGLMApiKey() : '');
      if (normalized === 'doubao') return !!(api.getDoubaoApiKey ? api.getDoubaoApiKey() : '');
      if (normalized === 'qwen') return !!(api.getQwenApiKey ? api.getQwenApiKey() : '');
      if (normalized === 'kimi') return !!(api.getKimiApiKey ? api.getKimiApiKey() : '');
      if (normalized === 'codex') return !!(api.getCodexBaseUrl ? api.getCodexBaseUrl() : '');
      return !!(api.getApiKey ? api.getApiKey() : '');
    }

    function syncAIProviderStatusFromSettings(provider) {
      const runtime = window.MorphSettingsActionsRuntimeInstance;
      if (runtime && typeof runtime.syncAIProviderStatusFromConfiguration === 'function') {
        runtime.syncAIProviderStatusFromConfiguration(provider);
      }
    }

    function buildAIProviderSaveFeedback(provider, isFirstSave) {
      const label = getAIProviderLabel(provider);
      return isFirstSave
        ? `已保存 ${label} 设置。接下来可以点“在线检查”确认当前配置是否可用。`
        : `已保存 ${label} 设置`;
    }

    function syncAIKeySettingsModalUI() {
      syncModalShell('settings-ai-key-modal', api.getAIKeySettingsModalOpen());
      const titleEl = document.getElementById('settings-ai-key-modal-title');
      /** @type {HTMLInputElement | null} */
      const inputEl = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ai-key-modal-input'));
      /** @type {HTMLInputElement | null} */
      const baseUrlEl = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ai-key-modal-base-url'));
      /** @type {HTMLInputElement | null} */
      const modelEl = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ai-key-modal-model'));
      const extraWrap = document.getElementById('settings-ai-key-modal-openai-compat-fields');
      const hintEl = document.getElementById('settings-ai-key-modal-hint');
      const provider = api.getAIKeySettingsModalProvider();
      const providerLabel = getAIProviderLabel(provider);
      const isCodexCompat = provider === 'codex';
      if (titleEl) titleEl.textContent = `${providerLabel} 密钥设置`;
      if (hintEl) {
        hintEl.textContent = isCodexCompat
          ? '用于接 anti-api 这类 OpenAI 兼容服务。API Key 可留空；请填写 Base URL，Model 不填时默认 gpt-5。'
          : provider === 'qwen'
            ? '填写百炼 API Key，保存后会切到 Qwen，默认模型是 qwen-plus。'
            : provider === 'kimi'
              ? '填写 Moonshot API Key，保存后会切到 Kimi，并按上下文自动使用 8k / 32k / 128k 模型。'
              : '输入后保存，自动退出弹窗。';
      }
      if (inputEl && api.getAIKeySettingsModalOpen()) {
        inputEl.placeholder = isCodexCompat
          ? 'API Key（可留空，若 anti-api 未启用鉴权）'
          : provider === 'openrouter'
          ? 'OpenRouter API Key (sk-or-v1-...)'
          : provider === 'glm'
            ? 'GLM API Key'
            : provider === 'doubao'
              ? 'Doubao / 方舟 API Key'
            : provider === 'qwen'
              ? 'Qwen / DashScope API Key'
              : provider === 'kimi'
                ? 'Kimi / Moonshot API Key'
            : 'Gemini API Key (AIzaSy...)';
      }
      if (extraWrap) extraWrap.classList.toggle('hidden', !isCodexCompat);
      if (baseUrlEl && api.getAIKeySettingsModalOpen()) {
        baseUrlEl.placeholder = 'Base URL（如 http://127.0.0.1:4000 或 http://127.0.0.1:4000/v1）';
      }
      if (modelEl && api.getAIKeySettingsModalOpen()) {
        modelEl.placeholder = 'Model（可选，默认 gpt-5）';
      }
    }

    function openAIKeySettingsModal(provider = 'gemini') {
      const normalizedProvider = String(provider || '').toLowerCase();
      rememberModalTrigger('settings-ai-key-modal');
      api.setAIKeySettingsModalProvider(normalizedProvider === 'openrouter' || normalizedProvider === 'glm' || normalizedProvider === 'doubao' || normalizedProvider === 'qwen' || normalizedProvider === 'kimi' || normalizedProvider === 'codex' ? normalizedProvider : 'gemini');
      api.setAIKeySettingsModalOpen(true);
      syncAIKeySettingsModalUI();
      /** @type {HTMLInputElement | null} */
      const inputEl = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ai-key-modal-input'));
      /** @type {HTMLInputElement | null} */
      const baseUrlEl = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ai-key-modal-base-url'));
      /** @type {HTMLInputElement | null} */
      const modelEl = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ai-key-modal-model'));
      if (inputEl) {
        inputEl.value = api.getAIKeySettingsModalProvider() === 'openrouter'
          ? api.getOpenRouterApiKey()
          : api.getAIKeySettingsModalProvider() === 'glm'
            ? (api.getGLMApiKey ? api.getGLMApiKey() : '')
            : api.getAIKeySettingsModalProvider() === 'doubao'
              ? (api.getDoubaoApiKey ? api.getDoubaoApiKey() : '')
              : api.getAIKeySettingsModalProvider() === 'qwen'
                ? (api.getQwenApiKey ? api.getQwenApiKey() : '')
                : api.getAIKeySettingsModalProvider() === 'kimi'
                  ? (api.getKimiApiKey ? api.getKimiApiKey() : '')
              : api.getAIKeySettingsModalProvider() === 'codex'
                ? (api.getCodexApiKey ? api.getCodexApiKey() : '')
            : api.getApiKey();
        requestAnimationFrame(() => { try { inputEl.focus(); } catch (_) {} });
      }
      if (baseUrlEl) {
        baseUrlEl.value = api.getAIKeySettingsModalProvider() === 'codex'
          ? (api.getCodexBaseUrl ? api.getCodexBaseUrl() : '')
          : '';
      }
      if (modelEl) {
        modelEl.value = api.getAIKeySettingsModalProvider() === 'codex'
          ? (api.getCodexModel ? api.getCodexModel() : '')
          : '';
      }
    }
    function closeAIKeySettingsModal() {
      api.setAIKeySettingsModalOpen(false);
      syncAIKeySettingsModalUI();
      restoreModalTrigger('settings-ai-key-modal');
    }
    function saveAIKeyFromModal() {
      /** @type {HTMLInputElement | null} */
      const inputEl = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ai-key-modal-input'));
      /** @type {HTMLInputElement | null} */
      const baseUrlEl = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ai-key-modal-base-url'));
      /** @type {HTMLInputElement | null} */
      const modelEl = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-ai-key-modal-model'));
      const provider = api.getAIKeySettingsModalProvider();
      const wasConfigured = isAIProviderConfigured(provider);
      const value = String(inputEl?.value || '').trim();
      if (provider === 'openrouter') {
        api.storage.setOpenRouterApiKey(value);
        api.storage.setAIProvider('openrouter');
      } else if (provider === 'glm') {
        api.storage.setGLMApiKey?.(value);
        api.storage.setAIProvider('glm');
      } else if (provider === 'doubao') {
        api.storage.setDoubaoApiKey?.(value);
        api.storage.setAIProvider('doubao');
      } else if (provider === 'qwen') {
        api.storage.setQwenApiKey?.(value);
        api.storage.setAIProvider('qwen');
      } else if (provider === 'kimi') {
        api.storage.setKimiApiKey?.(value);
        api.storage.setAIProvider('kimi');
      } else if (provider === 'codex') {
        api.storage.setCodexApiKey?.(value);
        api.storage.setCodexBaseUrl?.(String(baseUrlEl?.value || '').trim());
        api.storage.setCodexModel?.(String(modelEl?.value || '').trim());
        api.storage.setAIProvider('codex');
      } else {
        api.storage.setApiKey(value);
        api.storage.setAIProvider('gemini');
      }
      syncAIProviderStatusFromSettings(provider);
      api.setAISettingsFeedback(buildAIProviderSaveFeedback(provider, !wasConfigured));
      api.renderSettingsView();
      closeAIKeySettingsModal();
    }
    function clearAIKeyFromModal() {
      const provider = api.getAIKeySettingsModalProvider() === 'openrouter'
        ? 'openrouter'
        : api.getAIKeySettingsModalProvider() === 'glm'
          ? 'glm'
          : api.getAIKeySettingsModalProvider() === 'doubao'
            ? 'doubao'
            : api.getAIKeySettingsModalProvider() === 'qwen'
              ? 'qwen'
              : api.getAIKeySettingsModalProvider() === 'kimi'
                ? 'kimi'
            : api.getAIKeySettingsModalProvider() === 'codex'
              ? 'codex'
            : 'gemini';
      const providerLabel = getAIProviderLabel(provider);
      closeAIKeySettingsModal();
      api.openCustomModal({
        title: provider === 'codex' ? '确认清除连接配置？' : '确认清除密钥？',
        desc: provider === 'codex'
          ? `将删除已保存的 ${providerLabel} API Key、Base URL 和 Model。此操作不可撤销。`
          : `将删除已保存的 ${providerLabel} API Key。此操作不可撤销。`,
        onConfirm: () => {
          if (provider === 'openrouter') api.storage.setOpenRouterApiKey('');
          else if (provider === 'glm') api.storage.setGLMApiKey?.('');
          else if (provider === 'doubao') api.storage.setDoubaoApiKey?.('');
          else if (provider === 'qwen') api.storage.setQwenApiKey?.('');
          else if (provider === 'kimi') api.storage.setKimiApiKey?.('');
          else if (provider === 'codex') {
            api.storage.setCodexApiKey?.('');
            api.storage.setCodexBaseUrl?.('');
            api.storage.setCodexModel?.('');
          } else api.storage.setApiKey('');
          syncAIProviderStatusFromSettings(provider);
          api.setAISettingsFeedback(provider === 'codex' ? `已清除 ${providerLabel} 设置` : `已清除 ${providerLabel} 密钥`);
          api.renderSettingsView();
        },
      });
    }

    function syncSecureVaultSettingsModalUI() { syncModalShell('settings-secure-vault-modal', api.getSecureVaultSettingsModalOpen()); }
    function openSecureVaultSettingsModal() {
      rememberModalTrigger('settings-secure-vault-modal');
      api.setSecureVaultSettingsModalOpen(true);
      syncSecureVaultSettingsModalUI();
      if (api.getCurrentTab() === 'settings') api.renderSettingsView();
      /** @type {HTMLInputElement | null} */
      const input = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-secure-vault-account-input'));
      if (input) requestAnimationFrame(() => { try { input.focus(); } catch (_) {} });
    }
    function closeSecureVaultSettingsModal() {
      api.setSecureVaultSettingsModalOpen(false);
      syncSecureVaultSettingsModalUI();
      restoreModalTrigger('settings-secure-vault-modal');
    }

    window.savePomodoroPluginSettingsFromModal = function savePomodoroPluginSettingsFromModal(focusMinutes = null, presetOnly = false) {
      const runtime = getPomodoroRuntimeModules();
      if (!runtime || typeof runtime.applySettings !== 'function') return;
      const focusInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-pomodoro-focus-duration'));
      const shortBreakInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-pomodoro-short-break-duration'));
      const longBreakInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-pomodoro-long-break-duration'));
      const longBreakIntervalInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-pomodoro-long-break-interval'));
      const autoBreaksInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-pomodoro-auto-breaks'));
      const autoFocusInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-pomodoro-auto-focus'));
      const soundInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-pomodoro-sound-enabled'));
      const patch = {
        focusDurationMinutes: Number.isFinite(Number(focusMinutes)) ? Number(focusMinutes) : Number(focusInput?.value || 25),
        shortBreakMinutes: Number(shortBreakInput?.value || 5),
        longBreakMinutes: Number(longBreakInput?.value || 15),
        longBreakInterval: Number(longBreakIntervalInput?.value || 4),
        autoStartBreaks: autoBreaksInput?.checked === true,
        autoStartFocus: autoFocusInput?.checked === true,
        soundEnabled: soundInput?.checked !== false,
      };
      runtime.applySettings(patch);
      syncLocalPluginSettingsModalUI();
      const feedback = document.getElementById('settings-pomodoro-feedback');
      if (feedback) {
        feedback.textContent = presetOnly === true
          ? `已把默认专注时长设为 ${Math.round(Number(patch.focusDurationMinutes) || 25)} 分钟。`
          : '番茄时钟配置已保存。';
      }
    };

    window.resetPomodoroPluginSettingsFromModal = function resetPomodoroPluginSettingsFromModal() {
      const runtime = getPomodoroRuntimeModules();
      if (!runtime || typeof runtime.applySettings !== 'function') return;
      runtime.applySettings({
        focusDurationMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        longBreakInterval: 4,
        autoStartBreaks: false,
        autoStartFocus: false,
        soundEnabled: true,
      });
      syncLocalPluginSettingsModalUI();
      const feedback = document.getElementById('settings-pomodoro-feedback');
      if (feedback) feedback.textContent = '已恢复番茄时钟默认节奏。';
    };

    bindGlobalEscapeHandler();
    externalDialogHooks.forEach(([openFn, closeFn, modalId]) => {
      installExternalDialogHook(openFn, modalId, 'open');
      installExternalDialogHook(closeFn, modalId, 'close');
    });

    return {
      syncLocalPluginSettingsModalUI,
      openLocalPluginSettingsModal,
      closeLocalPluginSettingsModal,
      openLocalPluginSettingsModalById,
      syncDailyAlignSettingsModalUI,
      openDailyAlignSettingsModal,
      closeDailyAlignSettingsModal,
      syncAIKeySettingsModalUI,
      openAIKeySettingsModal,
      closeAIKeySettingsModal,
      saveAIKeyFromModal,
      clearAIKeyFromModal,
      syncSecureVaultSettingsModalUI,
      openSecureVaultSettingsModal,
      closeSecureVaultSettingsModal,
    };
  }

  window.MorphSettingsModalRuntime = { create: createSettingsModalRuntime };
})();
