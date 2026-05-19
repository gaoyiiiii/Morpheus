// @ts-check
/** @typedef {import("../../interfaces/frontend-settings").SettingsControllerRuntimeDeps} SettingsControllerRuntimeDeps */
/** @typedef {import("../../interfaces/frontend-settings").SettingsControllerRuntimeModules} SettingsControllerRuntimeModules */

(function initMorphSettingsControllerRuntime() {
  /**
   * @param {SettingsControllerRuntimeDeps} [deps={}]
   * @returns {SettingsControllerRuntimeModules}
   */
  function createSettingsControllerRuntime(deps = {}) {
    /** @type {Required<SettingsControllerRuntimeDeps>} */
    const api = /** @type {Required<SettingsControllerRuntimeDeps>} */ (deps && typeof deps === 'object' ? deps : {});

    /**
     * @param {string} id
     * @param {string} event
     * @param {(event: any) => void} handler
     */
    function bind(id, event, handler) {
      const el = document.getElementById(id);
      if (!el) return;
      if (typeof handler !== 'function') return;
      const key = `morphBound${event}`;
      if (el.dataset[key] === '1') return;
      el.addEventListener(event, handler);
      el.dataset[key] = '1';
    }

    function bindSettingsEvents() {
      const aiKeyProviders = [
        'gemini',
        'openrouter',
        'glm',
        'doubao',
        'qwen',
        'kimi',
        'codex',
      ];
      aiKeyProviders.forEach((provider) => {
        const cardId = `settings-ai-key-menu-${provider}`;
        bind(cardId, 'click', () => api.setAIProviderFromSettings?.(provider));
        bind(cardId, 'keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            api.setAIProviderFromSettings?.(provider);
          }
        });
      });
      bind('settings-ai-key-menu-gemini-open', 'click', (e) => {
        e.stopPropagation();
        api.openAIKeySettingsModal('gemini');
      });
      bind('settings-ai-key-menu-openrouter-open', 'click', (e) => {
        e.stopPropagation();
        api.openAIKeySettingsModal('openrouter');
      });
      bind('settings-ai-key-menu-glm-open', 'click', (e) => {
        e.stopPropagation();
        api.openAIKeySettingsModal('glm');
      });
      bind('settings-ai-key-menu-doubao-open', 'click', (e) => {
        e.stopPropagation();
        api.openAIKeySettingsModal('doubao');
      });
      bind('settings-ai-key-menu-qwen-open', 'click', (e) => {
        e.stopPropagation();
        api.openAIKeySettingsModal('qwen');
      });
      bind('settings-ai-key-menu-kimi-open', 'click', (e) => {
        e.stopPropagation();
        api.openAIKeySettingsModal('kimi');
      });
      bind('settings-ai-key-menu-codex-open', 'click', (e) => {
        e.stopPropagation();
        api.openAIKeySettingsModal('codex');
      });
      bind('settings-ai-key-close-modal', 'click', () => api.closeAIKeySettingsModal());
      bind('settings-ai-key-modal-save', 'click', () => api.saveAIKeyFromModal());
      bind('settings-ai-key-modal-clear', 'click', () => api.clearAIKeyFromModal());
      bind('settings-secure-vault-open-menu', 'click', () => api.openSecureVaultSettingsModal());
      bind('settings-secure-vault-close-modal', 'click', () => api.closeSecureVaultSettingsModal());
      bind('settings-secure-vault-backup', 'click', () => api.backupSensitiveSettingsToSecureVault());
      bind('settings-secure-vault-restore', 'click', () => api.restoreSensitiveSettingsFromSecureVault());
      bind('settings-glucose-open-menu', 'click', () => api.openGlucoseSettingsModal());
      bind('settings-feishu-open-menu', 'click', () => api.openFeishuSettingsModal());
      bind('settings-glucose-close-modal', 'click', () => api.closeGlucoseSettingsModal());
      bind('settings-feishu-close-modal', 'click', () => api.closeFeishuSettingsModal());
      bind('settings-local-plugin-close-modal', 'click', () => api.closeLocalPluginSettingsModal());
      bind('settings-local-plugin-close-action', 'click', () => api.closeLocalPluginSettingsModal());
      bind('settings-daily-align-close-modal', 'click', () => api.closeDailyAlignSettingsModal());
      bind('settings-glucose-save', 'click', api.saveGlucoseConfigFromSettings);
      bind('settings-feishu-save', 'click', api.saveFeishuConfigFromSettings);
      bind('settings-glucose-refresh', 'click', () => { api.loadGlucoseConfigFromServer({ silent: false }); });
      bind('settings-feishu-refresh', 'click', () => { api.loadFeishuConfigFromServer({ silent: false }); });
      bind('settings-daily-align-save', 'click', api.saveDailyAlignSettingsFromSettings);
      bind('settings-reminder-sync-save', 'click', api.saveReminderSyncSettingsFromSettings);
      bind('settings-theme-system-btn', 'click', api.setSystemThemeFromSettings);
      bind('settings-theme-light-btn', 'click', api.setLightThemeFromSettings);
      bind('settings-theme-dark-btn', 'click', api.setDarkThemeFromSettings);
      bind('settings-ai-key-modal-input', 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          api.saveAIKeyFromModal();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeAIKeySettingsModal();
        }
      });
      bind('settings-ai-key-modal-base-url', 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          api.saveAIKeyFromModal();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeAIKeySettingsModal();
        }
      });
      bind('settings-ai-key-modal-model', 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          api.saveAIKeyFromModal();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeAIKeySettingsModal();
        }
      });
      bind('settings-secure-vault-passphrase-input', 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          api.backupSensitiveSettingsToSecureVault();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeSecureVaultSettingsModal();
        }
      });
      bind('settings-secure-vault-account-input', 'keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeSecureVaultSettingsModal();
        }
      });
      bind('settings-glucose-email-input', 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          api.saveGlucoseConfigFromSettings();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeGlucoseSettingsModal();
        }
      });
      bind('settings-glucose-email-input', 'input', (e) => {
        api.getSettingsState().glucoseConfig.email = String(e.target?.value || '');
      });
      bind('settings-glucose-password-input', 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          api.saveGlucoseConfigFromSettings();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeGlucoseSettingsModal();
        }
      });
      bind('settings-glucose-target-low-input', 'input', (e) => {
        const value = Math.round(Number(e.target?.value || ''));
        if (Number.isFinite(value)) api.getSettingsState().glucoseConfig.targetLow = value;
      });
      bind('settings-glucose-target-low-input', 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          api.saveGlucoseConfigFromSettings();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeGlucoseSettingsModal();
        }
      });
      bind('settings-glucose-target-high-input', 'input', (e) => {
        const value = Math.round(Number(e.target?.value || ''));
        if (Number.isFinite(value)) api.getSettingsState().glucoseConfig.targetHigh = value;
      });
      bind('settings-glucose-target-high-input', 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          api.saveGlucoseConfigFromSettings();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeGlucoseSettingsModal();
        }
      });
      bind('settings-glucose-region-input', 'change', () => {
        /** @type {HTMLSelectElement | HTMLInputElement | null} */
        const input = /** @type {HTMLSelectElement | HTMLInputElement | null} */ (document.getElementById('settings-glucose-region-input'));
        api.getSettingsState().glucoseConfig.region = api.normalizeGlucoseRegion(input?.value || 'CN');
      });
      bind('settings-feishu-enabled-input', 'change', (e) => {
        api.getSettingsState().feishuConfig.enabled = !!e.target?.checked;
      });
      bind('settings-feishu-app-id-input', 'input', (e) => {
        api.getSettingsState().feishuConfig.appId = String(e.target?.value || '').trim();
      });
      bind('settings-feishu-verification-token-input', 'input', (e) => {
        api.getSettingsState().feishuConfig.verificationToken = String(e.target?.value || '').trim();
      });
      bind('settings-feishu-bot-name-input', 'input', (e) => {
        api.getSettingsState().feishuConfig.botName = String(e.target?.value || '').trim();
      });
      ['settings-feishu-app-id-input', 'settings-feishu-app-secret-input', 'settings-feishu-verification-token-input', 'settings-feishu-encrypt-key-input', 'settings-feishu-bot-name-input']
        .forEach((id) => bind(id, 'keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            api.saveFeishuConfigFromSettings();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            api.closeFeishuSettingsModal();
          }
        }));
      bind('settings-daily-align-time-input', 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          api.saveDailyAlignSettingsFromSettings();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeDailyAlignSettingsModal();
        }
      });
      bind('settings-daily-align-prompt-input', 'keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          api.saveDailyAlignSettingsFromSettings();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          api.closeDailyAlignSettingsModal();
        }
      });
      bind('settings-reminder-sync-endpoint-input', 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          api.saveReminderSyncSettingsFromSettings();
        }
      });
      bind('settings-choose-sync-root-btn', 'click', api.chooseSettingsSyncRoot);
      bind('settings-open-sync-root-btn', 'click', api.openSettingsSyncRoot);
      bind('settings-reload-from-user-data-btn', 'click', api.reloadFromUserDataInSettings);
      bind('settings-ai-user-md-save', 'click', api.saveAIUserMemoryFromSettings);
      bind('settings-morph-runtime-save', 'click', api.saveMorphRuntimeFromSettings);
    }

    return { bindSettingsEvents };
  }

  window.MorphSettingsControllerRuntime = { create: createSettingsControllerRuntime };
})();
