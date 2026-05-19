// @ts-check
/** @typedef {import("../../interfaces/frontend-settings").SettingsActionsRuntimeDeps} SettingsActionsRuntimeDeps */
/** @typedef {import("../../interfaces/frontend-settings").SettingsActionsRuntimeModules} SettingsActionsRuntimeModules */

(function initMorphSettingsActionsRuntime() {
  /**
   * @param {SettingsActionsRuntimeDeps} [deps={}]
   * @returns {SettingsActionsRuntimeModules}
   */
  function createSettingsActionsRuntime(deps) {
    /** @type {Required<SettingsActionsRuntimeDeps>} */
    const api = /** @type {Required<SettingsActionsRuntimeDeps>} */ (deps && typeof deps === 'object' ? deps : {});

    function normalizeAIProvider(provider = 'gemini') {
      return provider === 'openrouter'
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
    }

    function getAIProviderLabel(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      return normalized === 'openrouter'
        ? 'OpenRouter'
        : normalized === 'glm'
          ? 'GLM-4.7-Flash'
          : normalized === 'doubao'
            ? 'Doubao-1.5-pro-256k'
            : normalized === 'qwen'
              ? 'Qwen-Plus'
              : normalized === 'kimi'
                ? 'Kimi'
                : normalized === 'codex'
                  ? 'Codex（OpenAI 兼容）'
                  : 'Gemini';
    }

    function isAIProviderConfigured(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      if (normalized === 'openrouter') return !!(api.getOpenRouterApiKey ? api.getOpenRouterApiKey() : '');
      if (normalized === 'glm') return !!(api.getGLMApiKey ? api.getGLMApiKey() : '');
      if (normalized === 'doubao') return !!(api.getDoubaoApiKey ? api.getDoubaoApiKey() : '');
      if (normalized === 'qwen') return !!(api.getQwenApiKey ? api.getQwenApiKey() : '');
      if (normalized === 'kimi') return !!(api.getKimiApiKey ? api.getKimiApiKey() : '');
      if (normalized === 'codex') return !!(api.getCodexBaseUrl ? api.getCodexBaseUrl() : '');
      return !!(api.getApiKey ? api.getApiKey() : '');
    }

    function getAIProviderConfigSignature(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      if (normalized === 'openrouter') return String(api.getOpenRouterApiKey ? api.getOpenRouterApiKey() : '');
      if (normalized === 'glm') return String(api.getGLMApiKey ? api.getGLMApiKey() : '');
      if (normalized === 'doubao') return String(api.getDoubaoApiKey ? api.getDoubaoApiKey() : '');
      if (normalized === 'qwen') return String(api.getQwenApiKey ? api.getQwenApiKey() : '');
      if (normalized === 'kimi') return String(api.getKimiApiKey ? api.getKimiApiKey() : '');
      if (normalized === 'codex') return String(api.getCodexBaseUrl ? api.getCodexBaseUrl() : '');
      return String(api.getApiKey ? api.getApiKey() : '');
    }

    function getAIProviderStatusesStore() {
      const settingsState = api.getSettingsState?.();
      if (!settingsState) return null;
      if (!settingsState.aiProviderStatuses || typeof settingsState.aiProviderStatuses !== 'object') {
        settingsState.aiProviderStatuses = Object.create(null);
      }
      return settingsState.aiProviderStatuses;
    }

    function getAIProviderStatusSnapshot(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      const configured = isAIProviderConfigured(normalized);
      const signature = getAIProviderConfigSignature(normalized);
      const store = getAIProviderStatusesStore();
      const stored = store && store[normalized] && typeof store[normalized] === 'object' ? store[normalized] : null;
      if (!configured) {
        return {
          provider: normalized,
          status: 'unconfigured',
          signature: '',
          lastMessage: '',
          lastReason: '',
          lastCheckedAt: '',
          lastSucceededAt: '',
          lastFailedAt: '',
          isError: false,
          source: 'derived',
        };
      }
      if (stored && stored.signature === signature) {
        return {
          provider: normalized,
          status: String(stored.status || 'configured'),
          signature,
          lastMessage: String(stored.lastMessage || ''),
          lastReason: String(stored.lastReason || ''),
          lastCheckedAt: String(stored.lastCheckedAt || ''),
          lastSucceededAt: String(stored.lastSucceededAt || ''),
          lastFailedAt: String(stored.lastFailedAt || ''),
          isError: !!stored.isError,
          source: 'stored',
        };
      }
      return {
        provider: normalized,
        status: 'configured',
        signature,
        lastMessage: '',
        lastReason: '',
        lastCheckedAt: '',
        lastSucceededAt: '',
        lastFailedAt: '',
        isError: false,
        source: 'derived',
      };
    }

    function setAIProviderStatus(provider, nextState = {}) {
      const normalized = normalizeAIProvider(provider);
      const store = getAIProviderStatusesStore();
      if (!store) return null;
      const current = store[normalized] && typeof store[normalized] === 'object' ? store[normalized] : {};
      store[normalized] = {
        ...current,
        ...nextState,
        provider: normalized,
      };
      return store[normalized];
    }

    function syncAIProviderStatusFromConfiguration(provider) {
      const normalized = normalizeAIProvider(provider);
      const configured = isAIProviderConfigured(normalized);
      const signature = getAIProviderConfigSignature(normalized);
      if (!configured) {
        return setAIProviderStatus(normalized, {
          status: 'unconfigured',
          signature: '',
          lastMessage: '',
          lastReason: '',
          lastCheckedAt: '',
          lastSucceededAt: '',
          lastFailedAt: '',
          isError: false,
        });
      }
      const snapshot = getAIProviderStatusSnapshot(normalized);
      if (snapshot.source === 'stored' && snapshot.signature === signature && (snapshot.status === 'online' || snapshot.status === 'failed' || snapshot.status === 'configured')) {
        return snapshot;
      }
      return setAIProviderStatus(normalized, {
        status: 'configured',
        signature,
        lastMessage: '',
        lastReason: '',
        lastCheckedAt: '',
        lastSucceededAt: '',
        lastFailedAt: '',
        isError: false,
      });
    }

    function recordAIProviderHealthOutcome(provider, outcome = {}) {
      const normalized = normalizeAIProvider(provider);
      if (!isAIProviderConfigured(normalized)) {
        return syncAIProviderStatusFromConfiguration(normalized);
      }
      const signature = getAIProviderConfigSignature(normalized);
      const now = new Date().toISOString();
      if (outcome.ok) {
        return setAIProviderStatus(normalized, {
          status: 'online',
          signature,
          lastMessage: String(outcome.message || ''),
          lastReason: 'ok',
          lastCheckedAt: now,
          lastSucceededAt: now,
          isError: false,
        });
      }
      if (String(outcome.reason || '') === 'missing_config') {
        return syncAIProviderStatusFromConfiguration(normalized);
      }
      return setAIProviderStatus(normalized, {
        status: 'failed',
        signature,
        lastMessage: String(outcome.message || ''),
        lastReason: String(outcome.reason || 'remote_failure'),
        lastCheckedAt: now,
        lastFailedAt: now,
        isError: true,
      });
    }

    function getAIProviderLifecycleLabel(provider = 'gemini') {
      const snapshot = getAIProviderStatusSnapshot(provider);
      return snapshot.status === 'online'
        ? '在线可达'
        : snapshot.status === 'failed'
          ? '最近失败'
          : snapshot.status === 'unconfigured'
            ? '未配置'
            : '已配置';
    }

    function buildAIProviderSaveFeedback(provider = 'gemini', isFirstSave = false) {
      const providerLabel = getAIProviderLabel(provider);
      return `已保存 ${providerLabel} 设置。`;
    }

    function buildAIProviderSwitchFeedback(provider = 'gemini') {
      const providerLabel = getAIProviderLabel(provider);
      if (!isAIProviderConfigured(provider)) return `已切换到 ${providerLabel}，请点击“配置”填写 API 信息`;
      const status = getAIProviderLifecycleLabel(provider);
      if (status === '在线可达') return `已切换到 ${providerLabel}，当前配置在线可达`;
      if (status === '最近失败') return `已切换到 ${providerLabel}，当前配置上次验证失败`;
      return `已切换到 ${providerLabel}`;
    }

    function getFetchImpl() {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') return window.fetch.bind(window);
      if (typeof fetch === 'function') return fetch.bind(globalThis);
      return null;
    }

    function createProviderHealthCheckRequest(provider) {
      const normalized = normalizeAIProvider(provider);
      const prompt = 'ping';
      if (normalized === 'openrouter') {
        const key = String(api.getOpenRouterApiKey ? api.getOpenRouterApiKey() : '').trim();
        return {
          provider: normalized,
          missingLabel: 'API Key',
          request: {
            url: 'https://openrouter.ai/api/v1/chat/completions',
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model: 'openrouter/auto',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1,
                temperature: 0,
              }),
            },
          },
        };
      }
      if (normalized === 'glm') {
        const key = String(api.getGLMApiKey ? api.getGLMApiKey() : '').trim();
        return {
          provider: normalized,
          missingLabel: 'API Key',
          request: {
            url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model: 'glm-4.7-flash',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1,
                temperature: 0,
              }),
            },
          },
        };
      }
      if (normalized === 'doubao') {
        const key = String(api.getDoubaoApiKey ? api.getDoubaoApiKey() : '').trim();
        return {
          provider: normalized,
          missingLabel: 'API Key',
          request: {
            url: 'https://operator.las.cn-beijing.volces.com/api/v1/chat/completions',
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model: 'doubao-1-5-pro-256k-250115',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1,
                temperature: 0,
              }),
            },
          },
        };
      }
      if (normalized === 'qwen') {
        const key = String(api.getQwenApiKey ? api.getQwenApiKey() : '').trim();
        return {
          provider: normalized,
          missingLabel: 'API Key',
          request: {
            url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model: 'qwen-plus',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1,
                temperature: 0,
              }),
            },
          },
        };
      }
      if (normalized === 'kimi') {
        const key = String(api.getKimiApiKey ? api.getKimiApiKey() : '').trim();
        return {
          provider: normalized,
          missingLabel: 'API Key',
          request: {
            url: 'https://api.moonshot.cn/v1/chat/completions',
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({
                model: 'moonshot-v1-8k',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1,
                temperature: 0,
              }),
            },
          },
        };
      }
      if (normalized === 'codex') {
        const baseUrl = String(api.getCodexBaseUrl ? api.getCodexBaseUrl() : '').trim();
        const model = String(api.getCodexModel ? api.getCodexModel() : '').trim() || 'gpt-5';
        const apiKey = String(api.getCodexApiKey ? api.getCodexApiKey() : '').trim();
        return {
          provider: normalized,
          missingLabel: 'Base URL',
          request: {
            url: baseUrl,
            init: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
              },
              body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1,
                temperature: 0,
              }),
            },
          },
        };
      }
      const key = String(api.getApiKey ? api.getApiKey() : '').trim();
      return {
        provider: normalized,
        missingLabel: 'API Key',
        request: {
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 1, temperature: 0 },
            }),
          },
        },
      };
    }

    function clearAIProviderHealthCheck() {
      const settingsState = api.getSettingsState?.();
      if (!settingsState) return;
      settingsState.aiHealthCheckProvider = '';
      settingsState.aiHealthCheckSignature = '';
      settingsState.aiHealthCheckMessage = '';
      settingsState.aiHealthCheckError = false;
    }

    function setAIProviderHealthCheck(provider, message, isError = false) {
      const settingsState = api.getSettingsState?.();
      if (!settingsState) return;
      settingsState.aiHealthCheckProvider = normalizeAIProvider(provider);
      settingsState.aiHealthCheckSignature = getAIProviderConfigSignature(provider);
      settingsState.aiHealthCheckMessage = String(message || '');
      settingsState.aiHealthCheckError = !!isError;
    }

    function buildAIProviderRemoteFailureMessage(providerLabel, response, responseText, errorText) {
      const status = response?.status || 0;
      const rawStatusText = response?.statusText ? ` ${response.statusText}` : '';
      const bodySuffix = responseText ? `（${responseText.slice(0, 120)}）` : '';
      if (status === 401) {
        return `鉴权失败：${providerLabel} 拒绝了请求（HTTP 401${rawStatusText}）。请检查 API Key 是否正确、是否过期，然后重新保存。`;
      }
      if (status === 403) {
        return `权限不足：${providerLabel} 拒绝了访问（HTTP 403${rawStatusText}）。请确认账号对该模型/接口有调用权限。`;
      }
      if (status === 404) {
        return `未找到接口或模型：${providerLabel} 返回 HTTP 404${rawStatusText}${bodySuffix}。请检查 Base URL、接口路径和模型名是否填写正确。`;
      }
      if (status === 429) {
        return `请求太频繁：${providerLabel} 返回 HTTP 429${rawStatusText}${bodySuffix}。请稍后再试，或检查配额与限流设置。`;
      }
      if (status >= 500 && status < 600) {
        return `服务端暂时不可用：${providerLabel} 返回 HTTP ${status}${rawStatusText}${bodySuffix}。请稍后重试。`;
      }
      if (status) {
        return `远端失败：${providerLabel} 返回 HTTP ${status}${rawStatusText}${bodySuffix}。请检查接口地址、模型名和账号权限后再试。`;
      }
      if (errorText && /timeout|timed out|abort|aborted|signal is aborted|networkerror|failed to fetch|fetch failed/i.test(errorText)) {
        return `网络超时或连接失败：${providerLabel} 暂时连不上。请检查网络、代理或稍后再试。`;
      }
      return `远端失败：${providerLabel} 在线检查失败${errorText ? `（${errorText.slice(0, 120)}）` : ''}。请检查网络、接口地址和账号权限后再试。`;
    }

    async function runAIProviderHealthCheckFromSettings(provider) {
      const normalized = normalizeAIProvider(provider || (api.getAIProvider ? api.getAIProvider() : 'gemini'));
      const providerLabel = getAIProviderLabel(normalized);
      const render = () => api.renderSettingsView?.();

      if (normalized === 'codex') {
        const baseUrl = String(api.getCodexBaseUrl ? api.getCodexBaseUrl() : '').trim();
        const model = String(api.getCodexModel ? api.getCodexModel() : '').trim();
        if (!baseUrl) {
          const message = `配置缺失：${providerLabel} 还缺少 Base URL。请先补全后再点在线检查。`;
          setAIProviderHealthCheck(normalized, message, true);
          recordAIProviderHealthOutcome(normalized, { ok: false, reason: 'missing_config', message });
          render();
          return { provider: normalized, ok: false, message, reason: 'missing_config' };
        }
        try {
          new URL(baseUrl);
        } catch (_) {
          const message = `本地格式错误：${providerLabel} 的 Base URL 不是有效地址，请补上完整协议和域名后再试。`;
          setAIProviderHealthCheck(normalized, message, true);
          recordAIProviderHealthOutcome(normalized, { ok: false, reason: 'local_format_error', message });
          render();
          return { provider: normalized, ok: false, message, reason: 'local_format_error' };
        }
        if (!model) {
          const message = `配置缺失：${providerLabel} 还缺少 Model。请先补全后再点在线检查。`;
          setAIProviderHealthCheck(normalized, message, true);
          recordAIProviderHealthOutcome(normalized, { ok: false, reason: 'missing_config', message });
          render();
          return { provider: normalized, ok: false, message, reason: 'missing_config' };
        }
      } else if (!isAIProviderConfigured(normalized)) {
        const message = `配置缺失：${providerLabel} 还缺少 API Key。请先补全后再点在线检查。`;
        setAIProviderHealthCheck(normalized, message, true);
        recordAIProviderHealthOutcome(normalized, { ok: false, reason: 'missing_config', message });
        render();
        return { provider: normalized, ok: false, message, reason: 'missing_config' };
      }

      const requestSpec = createProviderHealthCheckRequest(normalized);
      const fetchImpl = getFetchImpl();
      if (!fetchImpl) {
        const message = `在线检查失败：当前环境没有可用的 fetch`;
        setAIProviderHealthCheck(normalized, message, true);
        recordAIProviderHealthOutcome(normalized, { ok: false, reason: 'fetch_unavailable', message });
        render();
        return { provider: normalized, ok: false, message, reason: 'fetch_unavailable' };
      }

      setAIProviderHealthCheck(normalized, `在线检查中：正在连接 ${providerLabel} ...`, false);
      render();

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3000) : null;
      try {
        const response = await fetchImpl(requestSpec.request.url, {
          ...requestSpec.request.init,
          signal: controller?.signal,
        });
        const responseText = response && typeof response.text === 'function' ? await response.text().catch(() => '') : '';
        if (!response || !response.ok) {
          const message = buildAIProviderRemoteFailureMessage(providerLabel, response, responseText, '');
          setAIProviderHealthCheck(normalized, message, true);
          recordAIProviderHealthOutcome(normalized, { ok: false, reason: 'remote_failure', message });
          render();
          return { provider: normalized, ok: false, message, reason: 'remote_failure', status: response?.status || 0 };
        }
        const message = `成功：${providerLabel} 在线可达，当前配置已就绪，可以直接使用。`;
        setAIProviderHealthCheck(normalized, message, false);
        recordAIProviderHealthOutcome(normalized, { ok: true, reason: 'ok', message });
        render();
        return { provider: normalized, ok: true, message, status: response.status };
      } catch (error) {
        const raw = String(error && typeof error === 'object' && 'message' in error ? error.message : error || '').trim();
        const normalizedError = raw.toLowerCase();
        const isFormatError = normalized === 'codex' && (
          normalizedError.includes('invalid url')
          || normalizedError.includes('failed to construct')
          || normalizedError.includes('failed to parse')
        );
        const message = isFormatError
          ? `本地格式错误：${providerLabel} 的 Base URL 不是有效地址，请补上完整协议和域名后再试。`
          : buildAIProviderRemoteFailureMessage(providerLabel, null, '', raw);
        setAIProviderHealthCheck(normalized, message, true);
        recordAIProviderHealthOutcome(normalized, { ok: false, reason: isFormatError ? 'local_format_error' : 'remote_failure', message, error: raw });
        render();
        return { provider: normalized, ok: false, message, reason: isFormatError ? 'local_format_error' : 'remote_failure', error: raw };
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    async function chooseSettingsSyncRoot() {
      const settingsState = api.getSettingsState();
      const hasNativeBridge = !!(api.storage.hasNativeControlBridge && api.storage.hasNativeControlBridge());
      const canUseWebDirectory =
        !!(api.storage.chooseWebSyncRoot
          && ((api.storage.canUseWebDirectoryPicker && api.storage.canUseWebDirectoryPicker())
            || (api.storage.canUseWebDirectoryUploadFallback && api.storage.canUseWebDirectoryUploadFallback())));
      if (!hasNativeBridge && !canUseWebDirectory) {
        settingsState.statusMessage = '当前环境还不能直接读取本地文件夹，请改用桌面版或 Chromium 浏览器。';
        api.renderSettingsView();
        return;
      }
      settingsState.statusMessage = hasNativeBridge ? '正在选择并迁移数据目录...' : '正在连接浏览器目录并读取内容...';
      api.renderSettingsView();
      try {
        if (hasNativeBridge) {
          const callNativeDesktopControl = api.storage.callNativeDesktopControl;
          const res = await callNativeDesktopControl('chooseSyncRoot');
          settingsState.syncRootPath = res?.path || settingsState.syncRootPath;
          settingsState.syncRootDeleteSafe = typeof res?.deleteSafe === 'boolean' ? res.deleteSafe : true;
          settingsState.nativePlatform = res?.platform || settingsState.nativePlatform;
          settingsState.statusMessage = '数据目录已更新，正在从用户数据重新载入...';
          api.renderSettingsView();
          const reloadRes = await callNativeDesktopControl('reloadFromUserData');
          if (reloadRes?.path) settingsState.syncRootPath = reloadRes.path;
          if (reloadRes?.platform) settingsState.nativePlatform = reloadRes.platform;
          settingsState.statusMessage = '数据目录已更新，并已从用户数据重新载入';
        } else {
          const res = await api.storage.chooseWebSyncRoot({ importData: true });
          settingsState.syncRootPath = String(res?.pathLabel || settingsState.syncRootPath || '').trim();
          settingsState.syncRootDeleteSafe = null;
          settingsState.nativePlatform = 'browser';
          settingsState.nativeBridge = false;
          if (res?.dataImported) {
            settingsState.statusMessage = `浏览器目录已连接，并已从 ${String(res.importedFrom || 'live-data.json').trim() || 'live-data.json'} 载入数据`;
          } else if (res?.readable) {
            settingsState.statusMessage = '浏览器目录已连接，但这次没找到可读取的 live-data.json；如果你选的是 iCloud 上层目录，请重新选择一次。';
          } else if (res?.writable) {
            settingsState.statusMessage = '浏览器目录已连接，后续保存会同步到该目录';
          } else {
            settingsState.statusMessage = '浏览器目录已连接，但当前为只读临时模式';
          }
        }
      } catch (err) {
        const msg = err && typeof err === 'object' && 'message' in err ? String(err.message || '') : '';
        if (msg === 'cancelled') settingsState.statusMessage = '已取消';
        else if (msg === 'native_control_timeout') settingsState.statusMessage = '选择目录超时，请再试一次';
        else if (msg === 'browser_sync_root_write_denied') settingsState.statusMessage = '目录已选择，但浏览器没有授予写入权限';
        else if (msg === 'browser_sync_root_permission_denied') settingsState.statusMessage = '浏览器没有授予该目录读取权限';
        else settingsState.statusMessage = msg || '切换数据目录失败';
      }
      api.renderSettingsView();
    }

    async function openSettingsSyncRoot() {
      const settingsState = api.getSettingsState();
      if (!api.storage.hasNativeControlBridge || !api.storage.hasNativeControlBridge()) {
        const canUseWebDirectory =
          !!(api.storage.chooseWebSyncRoot
            && ((api.storage.canUseWebDirectoryPicker && api.storage.canUseWebDirectoryPicker())
              || (api.storage.canUseWebDirectoryUploadFallback && api.storage.canUseWebDirectoryUploadFallback())));
        if (!canUseWebDirectory) {
          settingsState.statusMessage = '当前环境不能直接打开本地文件夹，请使用桌面版或 Chromium 浏览器重新选择目录。';
          api.renderSettingsView();
          return;
        }
        settingsState.statusMessage = '正在重新连接浏览器目录...';
        api.renderSettingsView();
        try {
          const pickerOptions = Object.assign(Object.create(Object.getPrototypeOf(api.storage) || Object.prototype), { importData: true });
          const res = await api.storage.chooseWebSyncRoot(pickerOptions);
          settingsState.syncRootPath = String(res?.pathLabel || settingsState.syncRootPath || '').trim();
          settingsState.syncRootDeleteSafe = null;
          settingsState.nativePlatform = 'browser';
          settingsState.nativeBridge = false;
          settingsState.statusMessage = res?.dataImported
            ? `浏览器目录已重新连接，并已从 ${String(res.importedFrom || 'live-data.json').trim() || 'live-data.json'} 载入数据`
            : '浏览器目录已重新连接，后续保存会同步到该目录';
        } catch (err) {
          const msg = String(err?.message || '').trim();
          settingsState.statusMessage = msg === 'cancelled' ? '已取消' : (msg || '重新连接浏览器目录失败');
        }
        api.renderSettingsView();
        return;
      }
      try {
        const callNativeDesktopControl = api.storage.callNativeDesktopControl;
        const res = await callNativeDesktopControl('openSyncRoot');
        if (res?.path) settingsState.syncRootPath = res.path;
        settingsState.statusMessage = '';
      } catch (_) {
        settingsState.statusMessage = '打开数据目录失败';
      }
      api.renderSettingsView();
    }

    async function reloadFromUserDataInSettings() {
      const settingsState = api.getSettingsState();
      if (!api.storage.hasNativeControlBridge || !api.storage.hasNativeControlBridge()) {
        if (!api.storage.reloadDataFromWebSyncRoot) {
          settingsState.statusMessage = '当前还不能从用户数据重新载入，请改用桌面版。';
          api.renderSettingsView();
          return;
        }
        const webMeta = api.storage.getWebSyncRootMeta ? api.storage.getWebSyncRootMeta() : null;
        if (!webMeta) {
          settingsState.statusMessage = '请先选择浏览器可访问的本地文件夹。';
          api.renderSettingsView();
          return;
        }
        settingsState.statusMessage = '正在从浏览器目录重载...';
        api.renderSettingsView();
        try {
          const res = await api.storage.reloadDataFromWebSyncRoot({ forceApply: true });
          settingsState.syncRootPath = String(webMeta.pathLabel || settingsState.syncRootPath || '').trim();
          settingsState.nativePlatform = 'browser';
          const importedRevision = Number(res?.data?.syncMeta?.revision || 0);
          settingsState.statusMessage = `已从 ${String(res?.relativePath || 'live-data.json').trim() || 'live-data.json'} 重新载入 | revision=${importedRevision}`;
        } catch (error) {
          const msg = String(error?.message || '').trim();
          settingsState.statusMessage = msg || '从浏览器目录重载失败';
        }
        api.renderSettingsView();
        return;
      }
      settingsState.statusMessage = '正在从用户数据重载...';
      api.renderSettingsView();
      try {
        const callNativeDesktopControl = api.storage.callNativeDesktopControl;
        const res = await callNativeDesktopControl('reloadFromUserData');
        if (res?.path) settingsState.syncRootPath = res.path;
        if (res?.platform) settingsState.nativePlatform = res.platform;
        settingsState.statusMessage = '已从用户数据重新载入';
      } catch (_) {
        settingsState.statusMessage = '重载失败';
      }
      api.renderSettingsView();
    }

    function saveApiKeysFromSettings() {
      /** @type {HTMLInputElement | null} */
      const geminiInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-api-key-input'));
      /** @type {HTMLInputElement | null} */
      const openRouterInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-openrouter-api-key-input'));
      /** @type {HTMLInputElement | null} */
      const glmInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-glm-api-key-input'));
      /** @type {HTMLInputElement | null} */
      const doubaoInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-doubao-api-key-input'));
      /** @type {HTMLInputElement | null} */
      const qwenInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-qwen-api-key-input'));
      /** @type {HTMLInputElement | null} */
      const kimiInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-kimi-api-key-input'));
      /** @type {HTMLInputElement | null} */
      const codexInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-codex-api-key-input'));
      if (geminiInput) api.storage.setApiKey(geminiInput.value);
      if (openRouterInput && api.storage.setOpenRouterApiKey) api.storage.setOpenRouterApiKey(openRouterInput.value);
      if (glmInput && api.storage.setGLMApiKey) api.storage.setGLMApiKey(glmInput.value);
      if (doubaoInput && api.storage.setDoubaoApiKey) api.storage.setDoubaoApiKey(doubaoInput.value);
      if (qwenInput && api.storage.setQwenApiKey) api.storage.setQwenApiKey(qwenInput.value);
      if (kimiInput && api.storage.setKimiApiKey) api.storage.setKimiApiKey(kimiInput.value);
      if (codexInput && api.storage.setCodexApiKey) api.storage.setCodexApiKey(codexInput.value);
      syncAIProviderStatusFromConfiguration('gemini');
      syncAIProviderStatusFromConfiguration('openrouter');
      syncAIProviderStatusFromConfiguration('glm');
      syncAIProviderStatusFromConfiguration('doubao');
      syncAIProviderStatusFromConfiguration('qwen');
      syncAIProviderStatusFromConfiguration('kimi');
      syncAIProviderStatusFromConfiguration('codex');
      clearAIProviderHealthCheck();
      api.setAISettingsFeedback(buildAIProviderSaveFeedback(api.getAIProvider ? api.getAIProvider() : 'gemini', false));
      api.renderSettingsView();
    }

    function clearCurrentAIKeyFromSettings() {
      const currentProvider = String(api.getAIProvider ? api.getAIProvider() : 'gemini');
      const provider = currentProvider === 'openrouter'
        ? 'openrouter'
        : currentProvider === 'glm'
          ? 'glm'
          : currentProvider === 'doubao'
            ? 'doubao'
            : currentProvider === 'qwen'
              ? 'qwen'
              : currentProvider === 'kimi'
                ? 'kimi'
                : currentProvider === 'codex'
              ? 'codex'
            : 'gemini';
      const providerLabel = provider === 'openrouter'
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
      api.openCustomModal({
        title: '确认清除密钥？',
        desc: `将删除当前提供方（${providerLabel}）已保存的 API Key。此操作不可撤销。`,
        onConfirm: () => {
          if (provider === 'openrouter') {
            api.storage.setOpenRouterApiKey('');
            /** @type {HTMLInputElement | null} */
            const input = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-openrouter-api-key-input'));
            if (input) input.value = '';
          } else if (provider === 'glm') {
            api.storage.setGLMApiKey?.('');
            /** @type {HTMLInputElement | null} */
            const input = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-glm-api-key-input'));
            if (input) input.value = '';
          } else if (provider === 'doubao') {
            api.storage.setDoubaoApiKey?.('');
            /** @type {HTMLInputElement | null} */
            const input = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-doubao-api-key-input'));
            if (input) input.value = '';
          } else if (provider === 'qwen') {
            api.storage.setQwenApiKey?.('');
            /** @type {HTMLInputElement | null} */
            const input = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-qwen-api-key-input'));
            if (input) input.value = '';
          } else if (provider === 'kimi') {
            api.storage.setKimiApiKey?.('');
            /** @type {HTMLInputElement | null} */
            const input = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-kimi-api-key-input'));
            if (input) input.value = '';
          } else if (provider === 'codex') {
            api.storage.setCodexApiKey?.('');
            api.storage.setCodexBaseUrl?.('');
            api.storage.setCodexModel?.('');
            /** @type {HTMLInputElement | null} */
            const keyInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-codex-api-key-input'));
            /** @type {HTMLInputElement | null} */
            const baseUrlInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-codex-base-url-input'));
            /** @type {HTMLInputElement | null} */
            const modelInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-codex-model-input'));
            if (keyInput) keyInput.value = '';
            if (baseUrlInput) baseUrlInput.value = '';
            if (modelInput) modelInput.value = '';
          } else {
            api.storage.setApiKey('');
            /** @type {HTMLInputElement | null} */
            const input = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-api-key-input'));
            if (input) input.value = '';
          }
          syncAIProviderStatusFromConfiguration(provider);
          clearAIProviderHealthCheck();
          api.setAISettingsFeedback(`已清除 ${providerLabel} 密钥`);
          api.renderSettingsView();
        },
      });
    }

    /**
     * @param {string} provider
     */
    function setAIProviderFromSettings(provider) {
      const normalized = normalizeAIProvider(provider);
      syncAIProviderStatusFromConfiguration(normalized);
      clearAIProviderHealthCheck();
      api.storage.setAIProvider(normalized);
      api.setAISettingsFeedback(buildAIProviderSwitchFeedback(normalized));
      api.renderSettingsView();
    }

    function saveDailyAlignSettingsFromSettings() {
      /** @type {HTMLInputElement | null} */
      const enabledInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-daily-align-enabled-input'));
      /** @type {HTMLInputElement | null} */
      const timeInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-daily-align-time-input'));
      /** @type {HTMLTextAreaElement | null} */
      const promptInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('settings-daily-align-prompt-input'));
      api.storage.setDailyAlignEnabled(!!enabledInput?.checked);
      api.storage.setDailyAlignTime(timeInput?.value || '08:00');
      api.storage.setDailyAlignPrompt(promptInput?.value || api.getDailyAlignDefaultPrompt());
      api.setAISettingsFeedback('已保存每日 AI 对齐设置');
      api.restartDailyAlignScheduler();
      api.renderSettingsView();
      api.closeDailyAlignSettingsModal();
    }

    function saveReminderSyncSettingsFromSettings() {
      /** @type {HTMLInputElement | null} */
      const enabledInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-reminder-sync-enabled-input'));
      /** @type {HTMLInputElement | null} */
      const endpointInput = /** @type {HTMLInputElement | null} */ (document.getElementById('settings-reminder-sync-endpoint-input'));
      api.setReminderSyncEnabled(!!enabledInput?.checked);
      const endpoint = api.setReminderSyncEndpoint(endpointInput?.value || '');
      if (endpointInput) endpointInput.value = endpoint;
      api.restartReminderLanSyncScheduler();
      api.scheduleReminderLanSync('settings_save');
      api.setAISettingsFeedback('已保存提醒同步设置');
      api.renderSettingsView();
    }

    function saveTTSSettingsFromSettings() {
      api.storage.setTTSProvider?.('none');
      api.storage.setAIAutoSpeak?.(false);
    }

    async function rebuildPluginDataInSettings() {
      if (typeof api.rebuildPluginDataInSettings === 'function') {
        await api.rebuildPluginDataInSettings();
      }
    }

    function setLightThemeFromSettings() { api.setThemeMode('light'); }
    function setDarkThemeFromSettings() { api.setThemeMode('dark'); }
    function setSystemThemeFromSettings() { api.setThemeMode('system'); }

    const modules = {
      chooseSettingsSyncRoot,
      openSettingsSyncRoot,
      reloadFromUserDataInSettings,
      rebuildPluginDataInSettings,
      saveApiKeysFromSettings,
      clearCurrentAIKeyFromSettings,
      setAIProviderFromSettings,
      runAIProviderHealthCheckFromSettings,
      saveDailyAlignSettingsFromSettings,
      saveReminderSyncSettingsFromSettings,
      saveTTSSettingsFromSettings,
      setLightThemeFromSettings,
      setDarkThemeFromSettings,
      setSystemThemeFromSettings,
      getAIProviderStatusSnapshot,
      syncAIProviderStatusFromConfiguration,
      getAIProviderLifecycleLabel,
      buildAIProviderSaveFeedback,
      buildAIProviderSwitchFeedback,
    };
    window.MorphSettingsActionsRuntimeInstance = modules;
    return modules;
  }

  window.MorphSettingsActionsRuntime = { create: createSettingsActionsRuntime };
  window.runAIProviderHealthCheckFromSettings = function runAIProviderHealthCheckFromSettings(provider) {
    const runtime = window.MorphSettingsActionsRuntimeInstance;
    if (runtime && typeof runtime.runAIProviderHealthCheckFromSettings === 'function') {
      return runtime.runAIProviderHealthCheckFromSettings(provider);
    }
    return null;
  };
})();
