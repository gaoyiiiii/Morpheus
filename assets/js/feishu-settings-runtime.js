// @ts-check
(function initMorphFeishuSettingsRuntime() {
  function createFeishuSettingsRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getSettingsState() {
      return typeof api.getSettingsState === 'function' ? api.getSettingsState() : {};
    }

    function getCurrentTab() {
      return typeof api.getCurrentTab === 'function' ? api.getCurrentTab() : '';
    }

    function rerender() {
      const tab = getCurrentTab();
      if (tab === 'settings' && typeof api.renderSettingsView === 'function') api.renderSettingsView();
      else if (tab === 'extensions' && typeof api.renderExtensionsView === 'function') api.renderExtensionsView();
    }

    function normalizeConfig(config = {}) {
      const src = config && typeof config === 'object' ? config : {};
      const runtime = src.runtime && typeof src.runtime === 'object' ? src.runtime : {};
      const ai = src.ai && typeof src.ai === 'object' ? src.ai : {};
      return {
        enabled: src.enabled === true,
        appId: String(src.appId || '').trim(),
        hasAppSecret: !!src.hasAppSecret,
        verificationToken: String(src.verificationToken || '').trim(),
        hasEncryptKey: !!src.hasEncryptKey,
        botName: String(src.botName || '').trim(),
        callbackPath: String(src.callbackPath || '/api/feishu/webhook').trim() || '/api/feishu/webhook',
        eventCount: Number.isFinite(Number(src.eventCount)) ? Number(src.eventCount) : 0,
        lastMessageAt: String(src.lastMessageAt || '').trim(),
        lastEventType: String(src.lastEventType || '').trim(),
        connectionMode: String(src.connectionMode || 'long-connection').trim() || 'long-connection',
        runtimeConnected: runtime.connected === true,
        runtimeRunning: runtime.running === true,
        runtimeLastError: String(runtime.lastError || '').trim(),
        runtimeReceivePolicy: String(runtime.receivePolicy || '').trim(),
        aiConfigured: ai.configured === true,
        aiProvider: String(ai.provider || '').trim(),
      };
    }

    function resolveCallbackURL(callbackPath = '/api/feishu/webhook') {
      const pathText = String(callbackPath || '/api/feishu/webhook').trim() || '/api/feishu/webhook';
      if (/^https?:\/\//i.test(pathText)) return pathText;
      const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
      return origin ? `${origin}${pathText.startsWith('/') ? pathText : `/${pathText}`}` : pathText;
    }

    function normalizeExternalConfigSnapshot(config = {}) {
      const src = config && typeof config === 'object' ? config : {};
      return {
        enabled: src.enabled === true,
        appId: String(src.appId || '').trim(),
        appSecret: String(src.appSecret || '').trim(),
        verificationToken: String(src.verificationToken || '').trim(),
        encryptKey: String(src.encryptKey || '').trim(),
        botName: String(src.botName || '').trim(),
        callbackPath: String(src.callbackPath || '/api/feishu/webhook').trim() || '/api/feishu/webhook',
      };
    }

    async function loadFullConfigSnapshot() {
      try {
        const res = await api.fetchLocalApiWithFallback?.(`/api/feishu/config/full?t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!json?.ok) return false;
        api.setExternalConfigSnapshot?.(normalizeExternalConfigSnapshot(json.config || {}));
        return true;
      } catch (_) {
        return false;
      }
    }

    function syncModalUI() {
      const modal = document.getElementById('settings-feishu-modal');
      if (!modal) return;
      const settingsState = getSettingsState();
      const open = typeof api.isModalOpen === 'function' ? api.isModalOpen() : false;
      modal.classList.toggle('opacity-0', !open);
      modal.classList.toggle('pointer-events-none', !open);
      modal.setAttribute('aria-hidden', open ? 'false' : 'true');
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.classList.toggle('scale-95', !open);
        content.classList.toggle('scale-100', open);
      }
      const summary = document.getElementById('settings-feishu-status-summary');
      if (summary) {
        const config = settingsState.feishuConfig || {};
        const enabledText = config.enabled ? '当前准备通过飞书长连接接收消息' : '当前还没启用飞书接入';
        const appIdText = String(config.appId || '').trim() ? 'App ID 已配置' : 'App ID 还没填';
        const secretText = config.hasAppSecret ? 'App Secret 已配置' : 'App Secret 还没填';
        const runtimeText = config.enabled
          ? (config.runtimeConnected ? '长连接已连上' : (config.runtimeRunning ? '长连接正在启动' : '长连接还没连上'))
          : '长连接未启动';
        const aiText = config.aiConfigured
          ? `AI 已同步${config.aiProvider ? `（${config.aiProvider}）` : ''}`
          : 'AI 还没同步';
        summary.textContent = `${enabledText}。${appIdText}，${secretText}，${runtimeText}，${aiText}。`;
      }
    }

    function openModal() {
      if (typeof api.setModalOpen === 'function') api.setModalOpen(true);
      syncModalUI();
      rerender();
      const input = document.getElementById('settings-feishu-app-id-input');
      if (input) {
        requestAnimationFrame(() => {
          try { input.focus(); } catch (_) {}
        });
      }
    }

    function closeModal() {
      if (typeof api.setModalOpen === 'function') api.setModalOpen(false);
      syncModalUI();
    }

    async function loadConfig(options = {}) {
      const { silent = false } = options && typeof options === 'object' ? options : {};
      const settingsState = getSettingsState();
      try {
        const res = await api.fetchLocalApiWithFallback?.(`/api/feishu/status?t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!json?.ok) throw new Error(json?.error || '加载失败');
        settingsState.feishuConfig = normalizeConfig({
          enabled: json.enabled,
          appId: json.appId,
          hasAppSecret: json.hasAppSecret,
          verificationToken: json.verificationToken,
          hasEncryptKey: json.hasEncryptKey,
          botName: json.botName,
          callbackPath: json.callbackPath,
          eventCount: json.eventCount,
          lastMessageAt: json.lastMessageAt,
          lastEventType: json.lastEventType,
          connectionMode: json.connectionMode,
          runtime: json.runtime,
          ai: json.ai,
        });
        settingsState.feishuConfigLoaded = true;
        api.maybeAutoEnableExtensionsFromExistingState?.();
        if (!silent) api.setFeedback?.('已加载飞书配对状态', false);
        else rerender();
        return true;
      } catch (error) {
        settingsState.feishuConfigLoaded = true;
        if (!silent) {
          const msg = String(error?.message || '未知错误');
          const hint = /load failed|fetch|failed to fetch|network/i.test(msg)
            ? '无法连接本地服务，请确认 Morpheus 服务已启动（npm start）'
            : msg;
          api.setFeedback?.(`加载失败：${hint}`, true);
        }
        return false;
      }
    }

    async function saveConfig() {
      const settingsState = getSettingsState();
      const enabledInput = document.getElementById('settings-feishu-enabled-input');
      const appIdInput = document.getElementById('settings-feishu-app-id-input');
      const appSecretInput = document.getElementById('settings-feishu-app-secret-input');
      const tokenInput = document.getElementById('settings-feishu-verification-token-input');
      const encryptKeyInput = document.getElementById('settings-feishu-encrypt-key-input');
      const botNameInput = document.getElementById('settings-feishu-bot-name-input');
      if (!enabledInput || !appIdInput || !appSecretInput || !botNameInput) return;

      const enabled = enabledInput.checked === true;
      const appId = String(appIdInput.value || '').trim();
      const appSecret = String(appSecretInput.value || '').trim();
      const verificationToken = String(tokenInput?.value || '').trim();
      const encryptKey = String(encryptKeyInput?.value || '').trim();
      const botName = String(botNameInput.value || '').trim();

      if (enabled && !appId) {
        api.setFeedback?.('启用时必须填写 App ID', true);
        return;
      }
      if (enabled && !appSecret && !settingsState.feishuConfig.hasAppSecret) {
        api.setFeedback?.('首次启用时必须填写 App Secret', true);
        return;
      }

      try {
        api.setFeedback?.('正在保存...', false);
        const res = await api.fetchLocalApiWithFallback?.('/api/feishu/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled, appId, appSecret, verificationToken, encryptKey, botName }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        settingsState.feishuConfig = normalizeConfig(json.config || {});
        appSecretInput.value = '';
        if (encryptKeyInput) encryptKeyInput.value = '';
        api.setExtensionEnabled?.('feishu', true, { silent: true });
        api.setFeedback?.('已保存飞书配对信息', false);
        await loadFullConfigSnapshot();
        await loadConfig({ silent: true });
        closeModal();
        return { changed: true, appliedLabel: '手动保存飞书配置' };
      } catch (error) {
        const msg = String(error?.message || '未知错误');
        const hint = /load failed|fetch|failed to fetch|network/i.test(msg)
          ? '无法连接本地服务，请确认 Morpheus 服务已启动（npm start）'
          : msg;
        api.setFeedback?.(`保存失败：${hint}`, true);
        return false;
      }
    }

    return {
      syncModalUI,
      openModal,
      closeModal,
      normalizeConfig,
      resolveCallbackURL,
      loadConfig,
      saveConfig,
    };
  }

  window.MorphFeishuSettingsRuntime = {
    create: createFeishuSettingsRuntime,
  };
})();
