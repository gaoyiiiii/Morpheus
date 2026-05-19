// @ts-check
/** @typedef {import("../../interfaces/frontend-settings").SettingsPageRuntimeDeps} SettingsPageRuntimeDeps */
/** @typedef {import("../../interfaces/frontend-settings").SettingsPageRuntimeModules} SettingsPageRuntimeModules */

(function initMorphSettingsPageRuntime() {
  /**
   * @param {SettingsPageRuntimeDeps} [deps={}]
   * @returns {SettingsPageRuntimeModules}
   */
  function createSettingsPageRuntime(deps = {}) {
    /** @type {Required<SettingsPageRuntimeDeps>} */
    const api = /** @type {Required<SettingsPageRuntimeDeps>} */ (deps && typeof deps === 'object' ? deps : {});

    function syncSettingsStatusBadgeFromGlobal() {
      const globalDot = document.getElementById('sync-status-dot');
      const globalText = document.getElementById('sync-status-text');
      const dot = document.getElementById('settings-sync-dot');
      const text = document.getElementById('settings-sync-text');
      if (!globalDot || !globalText || !dot || !text) return;
      dot.className = globalDot.className;
      const fullText = String(globalText.dataset?.fullText || globalText.title || globalText.textContent || '').trim();
      text.textContent = fullText || '等待同步';
    }

    function buildSettingsDetailMarkup(mode) {
      const runtime = api.getSettingsDetailRuntimeModules();
      if (runtime && typeof runtime.buildSettingsDetailMarkup === 'function') {
        return runtime.buildSettingsDetailMarkup(mode);
      }
      return '';
    }

    function bindSettingsDetailActions(mode) {
      if (mode !== 'data-settings') return;
      const chooseBtn = document.getElementById('settings-choose-sync-root-btn');
      const openBtn = document.getElementById('settings-open-sync-root-btn');
      const reloadBtn = document.getElementById('settings-reload-from-user-data-btn');
      if (chooseBtn) {
        chooseBtn.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          api.chooseSettingsSyncRoot();
        };
      }
      if (openBtn) {
        openBtn.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          api.openSettingsSyncRoot();
        };
      }
      if (reloadBtn) {
        reloadBtn.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          api.reloadFromUserDataInSettings();
        };
      }
    }

    function renderSettingsView() {
      api.syncExtensionVisibility();
      api.syncExperimentalFeatureVisibility();
      const settingsList = document.getElementById('settings-sections-list');
      const settingsDetail = document.getElementById('settings-detail-view');
      const settingsHeader = document.getElementById('settings-page-header');
      const settingsState = api.getSettingsState();
      const settingsDetailMode = api.getSettingsDetailMode();
      if (settingsList && settingsDetail) {
        if (settingsDetailMode) {
          try {
            const detailMarkup = buildSettingsDetailMarkup(settingsDetailMode);
            settingsList.classList.add('hidden');
            settingsDetail.classList.remove('hidden');
            settingsDetail.classList.add('flex', 'flex-col', 'h-full');
            if (settingsHeader) settingsHeader.classList.add('hidden');
            settingsDetail.innerHTML = detailMarkup || `
                    <div class="w-full h-full flex-1 min-h-0 flex flex-col glass-card rounded-[1.2rem] p-5">
                        <div class="flex items-center justify-between gap-3 mb-4">
                            <button type="button" onclick="closeSettingsDetail()" class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[11px] font-medium text-gray-700 dark:text-white/80">
                                <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i><span>返回</span>
                            </button>
                            <div class="text-right">
                                <h2 class="text-sm font-medium text-black dark:text-white/90">内容未生成</h2>
                                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">当前详情页没有返回可显示内容。</p>
                            </div>
                        </div>
                    </div>
                `;
            api.requestLucideRefresh({ root: settingsDetail });
            bindSettingsDetailActions(settingsDetailMode);
          } catch (error) {
            console.error('[settings] failed to render detail view:', settingsDetailMode, error);
            settingsList.classList.remove('hidden');
            settingsDetail.classList.add('hidden');
            settingsDetail.classList.remove('flex', 'flex-col', 'h-full');
            settingsDetail.innerHTML = '';
            api.setSettingsDetailMode(null);
            settingsState.writingStudioStatusMessage = `写作训练台打开失败：${error?.message || 'unknown error'}`;
            settingsState.writingStudioStatusError = true;
          }
        } else {
          settingsList.classList.remove('hidden');
          settingsDetail.classList.add('hidden');
          settingsDetail.classList.remove('flex', 'flex-col', 'h-full');
          if (settingsHeader) settingsHeader.classList.remove('hidden');
          settingsDetail.innerHTML = '';
        }
      }
      const renderRuntime = api.getSettingsRenderRuntimeModules();
      if (renderRuntime && typeof renderRuntime.syncSettingsSummaryUI === 'function') {
        renderRuntime.syncSettingsSummaryUI();
      }
      const settingsController = api.getSettingsControllerRuntimeModules();
      if (settingsController && typeof settingsController.bindSettingsEvents === 'function') {
        settingsController.bindSettingsEvents();
      }
      syncSettingsStatusBadgeFromGlobal();
    }

    function openSettingsDetail(mode) {
      if (mode === 'writing-studio') {
        const runtime = api.getLegacyWritingRuntimeModules();
        if (runtime?.openWritingStudioSettings) {
          runtime.openWritingStudioSettings();
          return;
        }
        return;
      }
      api.setSettingsDetailMode(mode);
      if (mode === 'data-settings') {
        api.refreshSettingsNativeState();
        return;
      }
      renderSettingsView();
    }

    function closeSettingsDetail() {
      api.setSettingsDetailMode(null);
      renderSettingsView();
    }

    return {
      syncSettingsStatusBadgeFromGlobal,
      renderSettingsView,
      buildSettingsDetailMarkup,
      bindSettingsDetailActions,
      openSettingsDetail,
      closeSettingsDetail,
    };
  }

  window.MorphSettingsPageRuntime = { create: createSettingsPageRuntime };
})();
