// @ts-check
/** @typedef {import("../../interfaces/frontend-settings").SettingsRenderRuntimeDeps} SettingsRenderRuntimeDeps */
/** @typedef {import("../../interfaces/frontend-settings").SettingsRenderRuntimeModules} SettingsRenderRuntimeModules */

(function initMorphSettingsRenderRuntime() {
  /**
   * @param {SettingsRenderRuntimeDeps} [deps={}]
   * @returns {SettingsRenderRuntimeModules}
   */
  function createSettingsRenderRuntime(deps) {
    /** @type {Required<SettingsRenderRuntimeDeps>} */
    const api = /** @type {Required<SettingsRenderRuntimeDeps>} */ (deps && typeof deps === 'object' ? deps : {});

    function getSyncReasonRuntime() {
      const factory = window.MorphSyncReasonRuntime && typeof window.MorphSyncReasonRuntime.create === 'function'
        ? window.MorphSyncReasonRuntime.create
        : null;
      return typeof factory === 'function' ? factory() : null;
    }

    /**
     * @param {string} id
     * @param {string} value
     */
    function syncValue(id, value) {
      /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null} */
      const el = /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null} */ (document.getElementById(id));
      if (el && document.activeElement !== el) el.value = value;
    }

    /**
     * @param {string} id
     * @param {boolean} checked
     */
    function syncToggle(id, checked) {
      /** @type {HTMLInputElement | null} */
      const el = /** @type {HTMLInputElement | null} */ (document.getElementById(id));
      if (el) el.checked = !!checked;
    }

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

    function getAIProviderStatusSnapshot(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      const configured = isAIProviderConfigured(normalized);
      const signature = getAIProviderConfigSignature(normalized);
      const settingsState = api.getSettingsState();
      const store = settingsState && settingsState.aiProviderStatuses && typeof settingsState.aiProviderStatuses === 'object'
        ? settingsState.aiProviderStatuses
        : null;
      const stored = store && store[normalized] && typeof store[normalized] === 'object' ? store[normalized] : null;
      if (!configured) return { status: 'unconfigured', signature: '' };
      if (stored && stored.signature === signature) return stored;
      const healthMatches = settingsState.aiHealthCheckProvider === normalized && settingsState.aiHealthCheckSignature === signature;
      if (healthMatches) {
        if (settingsState.aiHealthCheckError) return { status: 'failed', signature, lastMessage: String(settingsState.aiHealthCheckMessage || '') };
        const healthText = String(settingsState.aiHealthCheckMessage || '');
        if (healthText.includes('在线可达')) {
          return { status: 'online', signature, lastMessage: healthText };
        }
        if (healthText.includes('失败') || healthText.includes('错误')) {
          return { status: 'failed', signature, lastMessage: healthText };
        }
      }
      return { status: 'configured', signature };
    }

    function getAIProviderLifecycleLabel(provider = 'gemini') {
      const snapshot = getAIProviderStatusSnapshot(provider);
      if (snapshot.status === 'online') return '在线可达';
      if (snapshot.status === 'failed') return '最近失败';
      if (snapshot.status === 'unconfigured') return '未配置';
      return '已配置';
    }

    function formatAIProviderMenuSummary(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      const statusLabel = getAIProviderLifecycleLabel(normalized);
      if (normalized === 'qwen') return `${statusLabel} | qwen-plus`;
      if (normalized === 'kimi') return `${statusLabel} | Auto`;
      if (normalized === 'codex') {
        const model = api.getCodexModel ? api.getCodexModel() : '';
        return `${statusLabel} | ${model || 'gpt-5'}`;
      }
      return statusLabel;
    }

    /**
     * @param {string} provider
     * @returns {{ label: string, tone: 'muted' | 'neutral' | 'success' | 'error' }}
     */
    function getAIProviderLifecycleStatus(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      if (!isAIProviderConfigured(normalized)) {
        return { label: '未配置', tone: 'muted' };
      }

      const settingsState = api.getSettingsState();
      const healthSignature = getAIProviderConfigSignature(normalized);
      const statusStore = settingsState.aiProviderStatuses && typeof settingsState.aiProviderStatuses === 'object'
        ? settingsState.aiProviderStatuses
        : null;
      const storedStatus = statusStore && statusStore[normalized] && typeof statusStore[normalized] === 'object'
        ? statusStore[normalized]
        : null;
      if (storedStatus && storedStatus.signature === healthSignature) {
        if (storedStatus.status === 'online') return { label: '在线可达', tone: 'success' };
        if (storedStatus.status === 'failed') return { label: '最近失败', tone: 'error' };
        if (storedStatus.status === 'configured') return { label: '已配置', tone: 'neutral' };
      }

      const healthMatches = settingsState.aiHealthCheckProvider === normalized && settingsState.aiHealthCheckSignature === healthSignature;
      if (!healthMatches) {
        return { label: '已配置', tone: 'neutral' };
      }

      if (settingsState.aiHealthCheckError) {
        return { label: '最近失败', tone: 'error' };
      }

      const healthText = String(settingsState.aiHealthCheckMessage || '');
      if (healthText.includes('在线可达')) {
        return { label: '在线可达', tone: 'success' };
      }

      return { label: '已配置', tone: 'neutral' };
    }

    /**
     * @param {string} value
     * @returns {string}
     */
    function formatAIProviderRecentCheckTime(value = '') {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (isoMatch) {
        return `${isoMatch[2]}-${isoMatch[3]} ${isoMatch[4]}:${isoMatch[5]}`;
      }
      const compact = raw.replace(/^(\d{4})-/, '').replace('T', ' ');
      return compact.length > 16 ? `${compact.slice(0, 16)}…` : compact;
    }

    /**
     * @param {string} provider
     * @returns {{ status: 'unconfigured' | 'configured' | 'online' | 'failed', hint: string, message: string }}
     */
    function getAIProviderRecentCheckMeta(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      if (!isAIProviderConfigured(normalized)) {
        return { status: 'unconfigured', hint: '未配置', message: '' };
      }

      const settingsState = api.getSettingsState();
      const healthSignature = getAIProviderConfigSignature(normalized);
      const statusStore = settingsState.aiProviderStatuses && typeof settingsState.aiProviderStatuses === 'object'
        ? settingsState.aiProviderStatuses
        : null;
      const storedStatus = statusStore && statusStore[normalized] && typeof statusStore[normalized] === 'object'
        ? statusStore[normalized]
        : null;
      const healthMatches = settingsState.aiHealthCheckProvider === normalized && settingsState.aiHealthCheckSignature === healthSignature;
      const healthMessage = healthMatches ? String(settingsState.aiHealthCheckMessage || '') : '';
      const status = storedStatus && storedStatus.signature === healthSignature
        ? String(storedStatus.status || 'configured')
        : healthMatches
          ? (settingsState.aiHealthCheckError ? 'failed' : (healthMessage.includes('在线可达') ? 'online' : 'configured'))
          : 'configured';
      const checkedAt = status === 'online'
        ? String(storedStatus?.lastSucceededAt || storedStatus?.lastCheckedAt || '')
        : status === 'failed'
          ? String(storedStatus?.lastFailedAt || storedStatus?.lastCheckedAt || '')
          : String(storedStatus?.lastCheckedAt || '');
      const timeLabel = formatAIProviderRecentCheckTime(checkedAt);
      const storedMessage = String(storedStatus?.lastMessage || '');
      const latestMessage = healthMessage || storedMessage;

      if (healthMessage.includes('在线检查中')) {
        return { status: 'configured', hint: '检查中', message: latestMessage };
      }
      if (status === 'online') {
        return { status: 'online', hint: timeLabel ? `最近成功 · ${timeLabel}` : '最近成功', message: latestMessage };
      }
      if (status === 'failed') {
        return { status: 'failed', hint: timeLabel ? `最近失败 · ${timeLabel}` : '最近失败', message: latestMessage };
      }
      if (timeLabel) {
        return { status: 'configured', hint: `最近检查 · ${timeLabel}`, message: latestMessage };
      }
      if (healthMessage.includes('在线可达')) {
        return { status: 'online', hint: '在线可达', message: latestMessage };
      }
      if (healthMessage.includes('失败') || healthMessage.includes('错误')) {
        return { status: 'failed', hint: '最近失败', message: latestMessage };
      }
      return { status: 'configured', hint: '未执行', message: latestMessage };
    }

    /**
     * @param {string} provider
     * @returns {{
     *   badge: string,
     *   title: string,
     *   description: string,
     *   actionLabel: string,
     *   tone: 'muted' | 'neutral' | 'success' | 'error',
     *   meta: string,
     * }}
     */
    function getAIProviderReadyState(provider = 'gemini') {
      const normalized = normalizeAIProvider(provider);
      const providerLabel = getAIProviderLabel(normalized);
      const currentModelLabel = api.getCurrentAIModelLabel ? api.getCurrentAIModelLabel() : '';
      const recentCheck = getAIProviderRecentCheckMeta(normalized);
      const baseMeta = `当前模型：${currentModelLabel || '-'}`;
      const meta = recentCheck.hint && recentCheck.hint !== '未执行' && recentCheck.hint !== '未配置'
        ? `${baseMeta} | 最近检查：${recentCheck.hint}`
        : baseMeta;
      const settingsState = api.getSettingsState();
      const configured = isAIProviderConfigured(normalized);
      const healthSignature = getAIProviderConfigSignature(normalized);
      const statusStore = settingsState.aiProviderStatuses && typeof settingsState.aiProviderStatuses === 'object'
        ? settingsState.aiProviderStatuses
        : null;
      const storedStatus = statusStore && statusStore[normalized] && typeof statusStore[normalized] === 'object'
        ? statusStore[normalized]
        : null;
      const healthMatches = settingsState.aiHealthCheckProvider === normalized && settingsState.aiHealthCheckSignature === healthSignature;
      const healthText = healthMatches ? String(settingsState.aiHealthCheckMessage || '') : '';
      const hasOnlineState = storedStatus?.status === 'online' || (healthMatches && healthText.includes('在线可达'));
      const hasFailedState = storedStatus?.status === 'failed'
        || (healthMatches && (settingsState.aiHealthCheckError || healthText.includes('失败') || healthText.includes('错误')));

      if (!configured) {
        return {
          badge: '未配置',
          title: `${providerLabel} 还没准备好`,
          description: '先补上当前 Provider 的密钥或 base URL。',
          actionLabel: '去配置',
          tone: 'muted',
          meta,
        };
      }

      if (hasOnlineState) {
        return {
          badge: '现在可用',
          title: `${providerLabel} 已通过在线检查`,
          description: '当前配置可以直接使用。',
          actionLabel: '重新检查',
          tone: 'success',
          meta,
        };
      }

      if (hasFailedState) {
        return {
          badge: '最近失败',
          title: `${providerLabel} 上次检查失败`,
          description: healthText || '先修复配置，再重新跑一次在线检查。',
          actionLabel: '重新检查',
          tone: 'error',
          meta,
        };
      }

      return {
        badge: '需要在线检查',
        title: `${providerLabel} 已配置，等待确认`,
        description: '建议先跑一次在线检查，确认连通性和鉴权都没问题。',
        actionLabel: '运行在线检查',
        tone: 'neutral',
        meta,
      };
    }

    /**
     * @param {HTMLElement | null} el
     * @param {'muted' | 'neutral' | 'success' | 'error'} tone
     */
    function syncAIProviderLifecycleTone(el, tone) {
      if (!el) return;
      el.classList.toggle('text-gray-500', tone === 'muted' || tone === 'neutral');
      el.classList.toggle('dark:text-gray-400', tone === 'muted' || tone === 'neutral');
      el.classList.toggle('text-emerald-600', tone === 'success');
      el.classList.toggle('dark:text-emerald-400', tone === 'success');
      el.classList.toggle('text-red-600', tone === 'error');
      el.classList.toggle('dark:text-red-400', tone === 'error');
    }

    function syncSettingsSummaryUI() {
      const settingsState = api.getSettingsState();
      const aiMemory = api.getAIMemory();
      const runtime = api.getMorphRuntimeBundle();
      const settingsSyncSummary = api.getSettingsSyncSummary && typeof api.getSettingsSyncSummary === 'function'
        ? api.getSettingsSyncSummary()
        : null;
      const shellDescriptor = settingsSyncSummary?.descriptor && typeof settingsSyncSummary.descriptor === 'object'
        ? settingsSyncSummary.descriptor
        : (api.getShellDescriptor ? api.getShellDescriptor() : null);
      const isFileProtocol = typeof window !== 'undefined'
        && window.location
        && window.location.protocol === 'file:';
      const nativePlatform = String(settingsState.nativePlatform || '').toLowerCase();
      const hasSyncRootPath = String(settingsState.syncRootPath || '').trim().length > 0;
      const webMeta = api.storage.getWebSyncRootMeta ? api.storage.getWebSyncRootMeta() : null;
      const descriptorPlatform = String(shellDescriptor?.platform || nativePlatform || '').toLowerCase();
      const descriptorShellKind = String(shellDescriptor?.shellKind || '').trim().toLowerCase();
      const descriptorSyncMode = String(shellDescriptor?.syncMode || '').trim().toLowerCase();
      const descriptorWriteOwner = String(shellDescriptor?.durableWriteOwner || '').trim().toLowerCase();
      const descriptorSyncRootPath = String(shellDescriptor?.syncRoot?.pathHint || settingsState.syncRootPath || '').trim();
      const isDesktopContext = descriptorShellKind === 'native-webview'
        || descriptorPlatform === 'macos'
        || descriptorPlatform === 'ios'
        || nativePlatform === 'macos'
        || nativePlatform === 'ios'
        || isFileProtocol
        || hasSyncRootPath;
      const bridgeBadgeLabel = String(settingsSyncSummary?.bridgeBadgeLabel || '').trim() || (() => {
        if (descriptorShellKind === 'native-webview' && descriptorPlatform === 'ios') return '已连接（iOS App）';
        if (descriptorShellKind === 'native-webview') return '已连接（mac 桌面版）';
        if (descriptorWriteOwner === 'browser-directory') return '浏览器目录为主写入';
        if (descriptorWriteOwner === 'local-server') return '本地服务为主写入';
        if (descriptorSyncRootPath) return '本地目录已选中（待桥接）';
        if (isDesktopContext) return '桌面版（桥接检测中）';
        return '未连接（web 浏览器）';
      })();
      const syncRootText = String(settingsSyncSummary?.syncRootText || '').trim() || ((descriptorWriteOwner === 'native-sync-writer' || descriptorWriteOwner === 'browser-directory')
        ? (descriptorSyncRootPath || '正在读取...')
        : (descriptorSyncRootPath && descriptorWriteOwner !== 'local-server' && descriptorWriteOwner !== 'browser-local-cache'
          ? descriptorSyncRootPath
          : (isDesktopContext
            ? '正在读取桌面数据目录'
            : (descriptorWriteOwner === 'local-server'
              ? '当前读写依赖本地服务 live-data.json'
              : '当前仅使用浏览器本地缓存（未接管用户目录）'))));

      syncValue('settings-api-key-input', api.getApiKey());
      syncValue('settings-openrouter-api-key-input', api.getOpenRouterApiKey());
      syncValue('settings-glm-api-key-input', api.getGLMApiKey ? api.getGLMApiKey() : '');
      syncValue('settings-doubao-api-key-input', api.getDoubaoApiKey ? api.getDoubaoApiKey() : '');
      syncValue('settings-qwen-api-key-input', api.getQwenApiKey ? api.getQwenApiKey() : '');
      syncValue('settings-kimi-api-key-input', api.getKimiApiKey ? api.getKimiApiKey() : '');
      syncValue('settings-codex-api-key-input', api.getCodexApiKey ? api.getCodexApiKey() : '');
      syncValue('settings-codex-base-url-input', api.getCodexBaseUrl ? api.getCodexBaseUrl() : '');
      syncValue('settings-codex-model-input', api.getCodexModel ? api.getCodexModel() : '');

      const provider = normalizeAIProvider(api.getAIProvider());
      const providerLabel = getAIProviderLabel(provider);
      const currentModelLabel = api.getCurrentAIModelLabel ? api.getCurrentAIModelLabel() : '';
      const providerLifecycle = getAIProviderLifecycleStatus(provider);
      const providerReady = getAIProviderReadyState(provider);
      const generalFeedbackText = String(settingsState.aiStatusMessage || '');
      const recentCheckMeta = getAIProviderRecentCheckMeta(provider);
      const apiStatus = document.getElementById('settings-api-key-status');
      if (apiStatus) {
        const baseText = `当前提供方：${providerLabel} | 当前模型：${currentModelLabel || '-'} | 当前状态：${providerReady.badge} | 最近检查：${recentCheckMeta.hint}`;
        const statusParts = [baseText];
        if (generalFeedbackText) statusParts.push(`提示：${generalFeedbackText}`);
        apiStatus.textContent = statusParts.join(' | ');
        apiStatus.title = [
          recentCheckMeta.message,
          generalFeedbackText ? `提示：${generalFeedbackText}` : '',
        ].filter(Boolean).join(' | ');
        const hasError = !!generalFeedbackText && settingsState.aiStatusError;
        syncAIProviderLifecycleTone(apiStatus, hasError ? 'error' : providerReady.tone);
      }

      const readyCard = document.getElementById('settings-current-provider-ready-card');
      if (readyCard) {
        readyCard.classList.remove('border-gray-200', 'dark:border-white/10', 'border-emerald-300', 'dark:border-emerald-400/50', 'border-red-200', 'dark:border-red-400/50', 'bg-gray-50', 'dark:bg-white/[0.03]', 'bg-emerald-50', 'dark:bg-emerald-500/10', 'bg-red-50', 'dark:bg-red-500/10');
        readyCard.classList.add('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
        if (providerReady.tone === 'success') {
          readyCard.classList.remove('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
          readyCard.classList.add('border-emerald-300', 'dark:border-emerald-400/50', 'bg-emerald-50', 'dark:bg-emerald-500/10');
        } else if (providerReady.tone === 'error') {
          readyCard.classList.remove('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
          readyCard.classList.add('border-red-200', 'dark:border-red-400/50', 'bg-red-50', 'dark:bg-red-500/10');
        }
      }
      const readyBadge = document.getElementById('settings-current-provider-ready-badge');
      if (readyBadge) {
        readyBadge.textContent = providerReady.badge;
        syncAIProviderLifecycleTone(readyBadge, providerReady.tone);
      }
      const readyProviderLabel = document.getElementById('settings-current-provider-ready-provider-label');
      if (readyProviderLabel) readyProviderLabel.textContent = providerLabel;
      const readyTitle = document.getElementById('settings-current-provider-ready-title');
      if (readyTitle) readyTitle.textContent = providerReady.title;
      const readyDescription = document.getElementById('settings-current-provider-ready-description');
      if (readyDescription) readyDescription.textContent = providerReady.description;
      const readyMeta = document.getElementById('settings-current-provider-ready-meta');
      if (readyMeta) readyMeta.textContent = providerReady.meta;
      const readyAction = document.getElementById('settings-current-provider-ready-action');
      if (readyAction) readyAction.textContent = providerReady.actionLabel;
      const readyHint = document.getElementById('settings-current-provider-ready-hint');
      if (readyHint) readyHint.textContent = providerReady.badge === '现在可用'
        ? '刚做过检查，可以直接继续。'
        : providerReady.badge === '最近失败'
          ? '先修正配置，再点一次在线检查。'
          : providerReady.badge === '未配置'
            ? '先补全配置，再回来确认。'
            : '先点一次在线检查，确认这组配置。';
      const geminiSummary = document.getElementById('settings-ai-key-menu-gemini-summary');
      if (geminiSummary) {
        const lifecycle = getAIProviderLifecycleStatus('gemini');
        geminiSummary.textContent = formatAIProviderMenuSummary('gemini');
        syncAIProviderLifecycleTone(geminiSummary, lifecycle.tone);
      }
      const openRouterSummary = document.getElementById('settings-ai-key-menu-openrouter-summary');
      if (openRouterSummary) {
        const lifecycle = getAIProviderLifecycleStatus('openrouter');
        openRouterSummary.textContent = formatAIProviderMenuSummary('openrouter');
        syncAIProviderLifecycleTone(openRouterSummary, lifecycle.tone);
      }
      const glmSummary = document.getElementById('settings-ai-key-menu-glm-summary');
      if (glmSummary) {
        const lifecycle = getAIProviderLifecycleStatus('glm');
        glmSummary.textContent = formatAIProviderMenuSummary('glm');
        syncAIProviderLifecycleTone(glmSummary, lifecycle.tone);
      }
      const doubaoSummary = document.getElementById('settings-ai-key-menu-doubao-summary');
      if (doubaoSummary) {
        const lifecycle = getAIProviderLifecycleStatus('doubao');
        doubaoSummary.textContent = formatAIProviderMenuSummary('doubao');
        syncAIProviderLifecycleTone(doubaoSummary, lifecycle.tone);
      }
      const qwenSummary = document.getElementById('settings-ai-key-menu-qwen-summary');
      if (qwenSummary) {
        const lifecycle = getAIProviderLifecycleStatus('qwen');
        qwenSummary.textContent = formatAIProviderMenuSummary('qwen');
        syncAIProviderLifecycleTone(qwenSummary, lifecycle.tone);
      }
      const kimiSummary = document.getElementById('settings-ai-key-menu-kimi-summary');
      if (kimiSummary) {
        const lifecycle = getAIProviderLifecycleStatus('kimi');
        kimiSummary.textContent = formatAIProviderMenuSummary('kimi');
        syncAIProviderLifecycleTone(kimiSummary, lifecycle.tone);
      }
      const codexSummary = document.getElementById('settings-ai-key-menu-codex-summary');
      if (codexSummary) {
        const lifecycle = getAIProviderLifecycleStatus('codex');
        codexSummary.textContent = formatAIProviderMenuSummary('codex');
        syncAIProviderLifecycleTone(codexSummary, lifecycle.tone);
      }

      const extensionCenterSummary = document.getElementById('settings-extension-center-summary');
      if (extensionCenterSummary) {
        const runtimeModules = api.getSettingsSectionsRuntimeModules();
        extensionCenterSummary.textContent = runtimeModules?.buildExtensionCenterSummary
          ? runtimeModules.buildExtensionCenterSummary()
          : '插件页';
      }
      const extensionSectionWrap = document.getElementById('settings-extension-sections');
      if (extensionSectionWrap) {
        const runtimeModules = api.getSettingsSectionsRuntimeModules();
        const items = runtimeModules?.buildExtensionSettingsSectionItems
          ? runtimeModules.buildExtensionSettingsSectionItems()
          : [];
        if (Array.isArray(items) && items.length) {
          extensionSectionWrap.innerHTML = items.map((item) => `
            <div role="button" tabindex="0" onclick="activateIntegratedExtension('${item.extensionId}','${item.commandId || 'open-extension-settings'}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); activateIntegratedExtension('${item.extensionId}','${item.commandId || 'open-extension-settings'}');}" class="settings-nav-card rounded-[1rem] border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] px-4 py-4 text-left transition-colors hover:bg-gray-100/70 dark:hover:bg-white/[0.04] cursor-pointer">
              <div class="flex items-start justify-between gap-4 w-full">
                <div class="min-w-0 flex-1">
                  <div class="inline-flex items-center gap-2 text-[11px] font-medium text-black dark:text-white/90">
                    <i data-lucide="${item.icon}" class="w-3.5 h-3.5 text-gray-500 dark:text-white/45"></i>
                    <span>${item.label}</span>
                  </div>
                  <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">${item.summary || '打开插件自己的设置入口。'}</p>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 dark:text-white/40 shrink-0 self-center"></i>
              </div>
            </div>
          `).join('');
          extensionSectionWrap.classList.remove('hidden');
          if (typeof api.requestLucideRefresh === 'function') {
            api.requestLucideRefresh({ root: extensionSectionWrap });
          }
        } else {
          extensionSectionWrap.innerHTML = '';
          extensionSectionWrap.classList.add('hidden');
        }
      }

      const vault = api.getSecureVaultRecord();
      syncValue('settings-secure-vault-account-input', String(vault?.accountName || ''));
      const vaultStatus = document.getElementById('settings-secure-vault-status');
      const vaultMenuSummary = document.getElementById('settings-secure-vault-menu-summary');
      const vaultBase = vault?.cipher?.ciphertextB64
        ? `云端已备份 | 账户：${vault.accountName || '-'} | 更新时间：${vault.updatedAt || '-'}`
        : '云端未备份';
      if (vaultMenuSummary) vaultMenuSummary.textContent = vaultBase;
      if (vaultStatus) {
        const message = settingsState.secureVaultStatusMessage ? `${vaultBase} | ${settingsState.secureVaultStatusMessage}` : vaultBase;
        vaultStatus.textContent = message;
        vaultStatus.classList.toggle('text-red-600', !!settingsState.secureVaultStatusMessage && settingsState.secureVaultStatusError);
        vaultStatus.classList.toggle('dark:text-red-400', !!settingsState.secureVaultStatusMessage && settingsState.secureVaultStatusError);
      }

      syncValue('settings-glucose-email-input', String(settingsState.glucoseConfig.email || ''));
      syncValue('settings-glucose-target-low-input', String(settingsState.glucoseConfig.targetLow || 70));
      syncValue('settings-glucose-target-high-input', String(settingsState.glucoseConfig.targetHigh || 180));
      syncValue('settings-glucose-region-input', api.normalizeGlucoseRegion(settingsState.glucoseConfig.region || 'CN'));
      const glucoseStatus = document.getElementById('settings-glucose-status');
      const glucoseMenuSummary = document.getElementById('settings-glucose-menu-summary');
      const isIOS = api.isIOSNativeAppRuntime();
      const pwdLabel = settingsState.glucoseConfig.hasPassword ? '已配置' : '未配置';
      const targetLow = settingsState.glucoseConfig.targetLow || 70;
      const targetHigh = settingsState.glucoseConfig.targetHigh || 180;
      const targetRangeText = api.formatGlucoseTargetRangeMmol(targetLow, targetHigh);
      if (glucoseMenuSummary) {
        const sourcePrefix = isIOS ? 'iOS 直连' : '本地服务';
        glucoseMenuSummary.textContent = `${sourcePrefix} | 邮箱：${settingsState.glucoseConfig.email || '-'} | 密码：${pwdLabel} | 区域：${api.normalizeGlucoseRegion(settingsState.glucoseConfig.region || 'CN')} | 目标：${targetRangeText}`;
      }
      if (glucoseStatus) {
        const base = isIOS
          ? `iOS 直连 LibreLink | 邮箱：${settingsState.glucoseConfig.email || '-'} | 密码：${pwdLabel} | 区域：${api.normalizeGlucoseRegion(settingsState.glucoseConfig.region || 'CN')} | 目标：${targetRangeText}`
          : `邮箱：${settingsState.glucoseConfig.email || '-'} | 密码：${pwdLabel} | 区域：${api.normalizeGlucoseRegion(settingsState.glucoseConfig.region || 'CN')} | 目标：${targetRangeText}`;
        const message = settingsState.glucoseStatusMessage ? `${base} | ${settingsState.glucoseStatusMessage}` : base;
        glucoseStatus.textContent = message;
        glucoseStatus.classList.toggle('text-red-600', !!settingsState.glucoseStatusMessage && settingsState.glucoseStatusError);
        glucoseStatus.classList.toggle('dark:text-red-400', !!settingsState.glucoseStatusMessage && settingsState.glucoseStatusError);
      }
      const glucoseIOSHint = document.getElementById('settings-glucose-ios-hint');
      if (glucoseIOSHint) glucoseIOSHint.classList.toggle('hidden', !isIOS);
      api.syncGlucoseSettingsModalUI();

      syncToggle('settings-feishu-enabled-input', settingsState.feishuConfig.enabled === true);
      syncValue('settings-feishu-app-id-input', String(settingsState.feishuConfig.appId || ''));
      syncValue('settings-feishu-verification-token-input', String(settingsState.feishuConfig.verificationToken || ''));
      syncValue('settings-feishu-bot-name-input', String(settingsState.feishuConfig.botName || ''));
      const feishuStatus = document.getElementById('settings-feishu-status');
      const feishuMenuSummary = document.getElementById('settings-feishu-menu-summary');
      const callbackURL = api.resolveFeishuCallbackURL(settingsState.feishuConfig.callbackPath || '/api/feishu/webhook');
      const callbackEl = document.getElementById('settings-feishu-callback-url');
      if (callbackEl) callbackEl.textContent = callbackURL;
      const feishuRuntimeLabel = settingsState.feishuConfig.enabled
        ? (settingsState.feishuConfig.runtimeConnected ? '已连接' : (settingsState.feishuConfig.runtimeRunning ? '启动中' : '未连接'))
        : '未启动';
      const feishuAILabel = settingsState.feishuConfig.aiConfigured
        ? `已同步${settingsState.feishuConfig.aiProvider ? `:${settingsState.feishuConfig.aiProvider}` : ''}`
        : '未同步';
      const baseFeishuText = `状态：${settingsState.feishuConfig.enabled ? '已启用' : '未启用'} | 模式：长连接 | 连接：${feishuRuntimeLabel} | AI：${feishuAILabel} | AppID：${settingsState.feishuConfig.appId || '-'} | Secret：${settingsState.feishuConfig.hasAppSecret ? '已配置' : '未配置'} | 最近事件：${settingsState.feishuConfig.eventCount || 0}`;
      if (feishuMenuSummary) feishuMenuSummary.textContent = baseFeishuText;
      if (feishuStatus) {
        const extra = [];
        if (settingsState.feishuConfig.lastMessageAt) extra.push(`最近消息：${api.formatSettingsTime(settingsState.feishuConfig.lastMessageAt)}`);
        if (settingsState.feishuConfig.lastEventType) extra.push(`事件：${settingsState.feishuConfig.lastEventType}`);
        if (settingsState.feishuConfig.runtimeReceivePolicy) extra.push(`接收策略：${settingsState.feishuConfig.runtimeReceivePolicy}`);
        if (settingsState.feishuConfig.runtimeLastError) extra.push(`错误：${settingsState.feishuConfig.runtimeLastError}`);
        const details = extra.length ? ` | ${extra.join(' | ')}` : '';
        const message = settingsState.feishuStatusMessage
          ? `${baseFeishuText}${details} | ${settingsState.feishuStatusMessage}`
          : `${baseFeishuText}${details}`;
        feishuStatus.textContent = message;
        feishuStatus.classList.toggle('text-red-600', !!settingsState.feishuStatusMessage && settingsState.feishuStatusError);
        feishuStatus.classList.toggle('dark:text-red-400', !!settingsState.feishuStatusMessage && settingsState.feishuStatusError);
      }
      api.syncFeishuSettingsModalUI();

      syncToggle('settings-daily-align-enabled-input', api.getDailyAlignEnabled());
      syncValue('settings-daily-align-time-input', api.getDailyAlignTime());
      syncValue('settings-daily-align-prompt-input', api.getDailyAlignPrompt());
      const dailyAlignStatus = document.getElementById('settings-daily-align-status');
      if (dailyAlignStatus) {
        const enabledLabel = api.getDailyAlignEnabled() ? '开' : '关';
        const timeLabel = api.getDailyAlignTime();
        const lastRun = api.getDailyAlignLastRunDate() || '-';
        dailyAlignStatus.textContent = `状态：${enabledLabel} | 时间：${timeLabel} | 最近执行：${lastRun}`;
      }
      api.syncSecureVaultSettingsModalUI();
      api.syncAIKeySettingsModalUI();
      api.syncDailyAlignSettingsModalUI();

      syncToggle('settings-reminder-sync-enabled-input', api.getReminderSyncEnabled());
      syncValue('settings-reminder-sync-endpoint-input', api.getReminderSyncEndpoint());
      const reminderSyncStatus = document.getElementById('settings-reminder-sync-status');
      if (reminderSyncStatus) {
        const enabled = api.getReminderSyncEnabled();
        const endpoint = api.getReminderSyncEndpoint();
        reminderSyncStatus.textContent = enabled
          ? (endpoint ? `状态：已启用 | 端点：${endpoint}` : '状态：已启用但未配置端点')
          : '状态：未启用';
      }

      const providerGeminiCard = document.getElementById('settings-ai-key-menu-gemini');
      const providerOpenRouterCard = document.getElementById('settings-ai-key-menu-openrouter');
      const providerGLMCard = document.getElementById('settings-ai-key-menu-glm');
      const providerDoubaoCard = document.getElementById('settings-ai-key-menu-doubao');
      const providerQwenCard = document.getElementById('settings-ai-key-menu-qwen');
      const providerKimiCard = document.getElementById('settings-ai-key-menu-kimi');
      const providerCodexCard = document.getElementById('settings-ai-key-menu-codex');
      const providerGeminiActiveBadge = document.getElementById('settings-ai-key-menu-gemini-active-badge');
      const providerOpenRouterActiveBadge = document.getElementById('settings-ai-key-menu-openrouter-active-badge');
      const providerGLMActiveBadge = document.getElementById('settings-ai-key-menu-glm-active-badge');
      const providerDoubaoActiveBadge = document.getElementById('settings-ai-key-menu-doubao-active-badge');
      const providerQwenActiveBadge = document.getElementById('settings-ai-key-menu-qwen-active-badge');
      const providerKimiActiveBadge = document.getElementById('settings-ai-key-menu-kimi-active-badge');
      const providerCodexActiveBadge = document.getElementById('settings-ai-key-menu-codex-active-badge');
      [providerGeminiCard, providerOpenRouterCard, providerGLMCard, providerDoubaoCard, providerQwenCard, providerKimiCard, providerCodexCard].forEach((card) => {
        if (!card) return;
        card.classList.remove('border-gray-400', 'dark:border-white/40', 'bg-white', 'dark:bg-white/[0.08]', 'shadow-sm');
        card.classList.add('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
        card.setAttribute('aria-pressed', 'false');
        card.setAttribute('aria-checked', 'false');
      });
      [providerGeminiActiveBadge, providerOpenRouterActiveBadge, providerGLMActiveBadge, providerDoubaoActiveBadge, providerQwenActiveBadge, providerKimiActiveBadge, providerCodexActiveBadge].forEach((badge) => {
        if (badge) badge.classList.add('hidden');
      });
      if (provider === 'openrouter') {
        providerOpenRouterCard?.classList.remove('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
        providerOpenRouterCard?.classList.add('border-gray-400', 'dark:border-white/40', 'bg-white', 'dark:bg-white/[0.08]', 'shadow-sm');
        providerOpenRouterCard?.setAttribute('aria-pressed', 'true');
        providerOpenRouterCard?.setAttribute('aria-checked', 'true');
        providerOpenRouterActiveBadge?.classList.remove('hidden');
      } else if (provider === 'glm') {
        providerGLMCard?.classList.remove('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
        providerGLMCard?.classList.add('border-gray-400', 'dark:border-white/40', 'bg-white', 'dark:bg-white/[0.08]', 'shadow-sm');
        providerGLMCard?.setAttribute('aria-pressed', 'true');
        providerGLMCard?.setAttribute('aria-checked', 'true');
        providerGLMActiveBadge?.classList.remove('hidden');
      } else if (provider === 'doubao') {
        providerDoubaoCard?.classList.remove('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
        providerDoubaoCard?.classList.add('border-gray-400', 'dark:border-white/40', 'bg-white', 'dark:bg-white/[0.08]', 'shadow-sm');
        providerDoubaoCard?.setAttribute('aria-pressed', 'true');
        providerDoubaoCard?.setAttribute('aria-checked', 'true');
        providerDoubaoActiveBadge?.classList.remove('hidden');
      } else if (provider === 'qwen') {
        providerQwenCard?.classList.remove('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
        providerQwenCard?.classList.add('border-gray-400', 'dark:border-white/40', 'bg-white', 'dark:bg-white/[0.08]', 'shadow-sm');
        providerQwenCard?.setAttribute('aria-pressed', 'true');
        providerQwenCard?.setAttribute('aria-checked', 'true');
        providerQwenActiveBadge?.classList.remove('hidden');
      } else if (provider === 'kimi') {
        providerKimiCard?.classList.remove('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
        providerKimiCard?.classList.add('border-gray-400', 'dark:border-white/40', 'bg-white', 'dark:bg-white/[0.08]', 'shadow-sm');
        providerKimiCard?.setAttribute('aria-pressed', 'true');
        providerKimiCard?.setAttribute('aria-checked', 'true');
        providerKimiActiveBadge?.classList.remove('hidden');
      } else if (provider === 'codex') {
        providerCodexCard?.classList.remove('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
        providerCodexCard?.classList.add('border-gray-400', 'dark:border-white/40', 'bg-white', 'dark:bg-white/[0.08]', 'shadow-sm');
        providerCodexCard?.setAttribute('aria-pressed', 'true');
        providerCodexCard?.setAttribute('aria-checked', 'true');
        providerCodexActiveBadge?.classList.remove('hidden');
      } else {
        providerGeminiCard?.classList.remove('border-gray-200', 'dark:border-white/10', 'bg-gray-50', 'dark:bg-white/[0.03]');
        providerGeminiCard?.classList.add('border-gray-400', 'dark:border-white/40', 'bg-white', 'dark:bg-white/[0.08]', 'shadow-sm');
        providerGeminiCard?.setAttribute('aria-pressed', 'true');
        providerGeminiCard?.setAttribute('aria-checked', 'true');
        providerGeminiActiveBadge?.classList.remove('hidden');
      }

      syncValue('settings-ai-user-md-input', aiMemory.user || '');
      const aiUserStatus = document.getElementById('settings-ai-user-md-status');
      if (aiUserStatus) aiUserStatus.textContent = `今日记忆 ${(aiMemory.dailyLogs?.[api.getTodayStr()] || []).length} 条`;

      syncValue('settings-morph-runtime-skills-input', JSON.stringify(runtime.skills || {}, null, 2));
      syncValue('settings-morph-runtime-context-input', JSON.stringify(runtime.contextRules || {}, null, 2));
      syncValue('settings-morph-runtime-memory-input', String(runtime.memoryRules || ''));
      const runtimeStatus = document.getElementById('settings-morph-runtime-status');
      if (runtimeStatus) {
        const lastUpdatedAt = api.ensureMorphRuntimeShape(api.getData()).morphRuntime.lastUpdatedAt;
        const baseText = lastUpdatedAt ? `最后更新：${api.formatSettingsTime(lastUpdatedAt)}` : '使用默认运行时规则';
        runtimeStatus.textContent = settingsState.runtimeStatusMessage ? `${baseText} | ${settingsState.runtimeStatusMessage}` : baseText;
        runtimeStatus.classList.toggle('text-red-600', !!settingsState.runtimeStatusMessage && settingsState.runtimeStatusError);
        runtimeStatus.classList.toggle('dark:text-red-400', !!settingsState.runtimeStatusMessage && settingsState.runtimeStatusError);
      }

      const isDarkTheme = document.documentElement.classList.contains('dark');
      const savedThemeMode = (() => {
        const raw = String(api.storage?.getTheme ? api.storage.getTheme() : '').trim().toLowerCase();
        return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
      })();
      const lightBtn = document.getElementById('settings-theme-light-btn');
      const darkBtn = document.getElementById('settings-theme-dark-btn');
      const systemBtn = document.getElementById('settings-theme-system-btn');
      const themeStatus = document.getElementById('settings-theme-status');
      [lightBtn, darkBtn, systemBtn].forEach((btn) => {
        if (!btn) return;
        btn.classList.remove('bg-white', 'dark:bg-white/10', 'text-black', 'dark:text-white', 'shadow-sm');
      });
      if (savedThemeMode === 'system') systemBtn?.classList.add('bg-white', 'dark:bg-white/10', 'text-black', 'dark:text-white', 'shadow-sm');
      else if (savedThemeMode === 'dark') darkBtn?.classList.add('bg-white', 'dark:bg-white/10', 'text-black', 'dark:text-white', 'shadow-sm');
      else lightBtn?.classList.add('bg-white', 'dark:bg-white/10', 'text-black', 'dark:text-white', 'shadow-sm');
      if (themeStatus) {
        const currentThemeLabel = isDarkTheme ? '深色模式' : '浅色模式';
        themeStatus.textContent = savedThemeMode === 'system'
          ? '当前：跟随系统'
          : `当前：${currentThemeLabel}`;
      }

      const bridgeBadge = document.getElementById('settings-native-bridge-badge');
      if (bridgeBadge) {
        const bridgeConnected = typeof settingsSyncSummary?.bridgeBadgeConnected === 'boolean'
          ? settingsSyncSummary.bridgeBadgeConnected
          : (settingsState.nativeBridge || isDesktopContext);
        bridgeBadge.textContent = bridgeBadgeLabel;
        bridgeBadge.className = bridgeConnected
          ? 'text-green-600 dark:text-green-400'
          : 'text-gray-700 dark:text-white/80';
      }

      const pathEl = document.getElementById('settings-sync-root-path');
      if (pathEl) {
        pathEl.textContent = syncRootText;
      }

      const readSyncReceipt = api.storage.readLastSyncReceipt
        ? api.storage.readLastSyncReceipt.bind(api.storage)
        : () => null;
      const syncReceipt = readSyncReceipt();
      const syncMutationState = api.storage.getSyncMutationState
        ? api.storage.getSyncMutationState()
        : null;
      const hasWebSyncRoot = !!webMeta;
      const isHttpRuntime = typeof window !== 'undefined'
        && window.location
        && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
      const syncMode = (() => {
        if (settingsSyncSummary?.syncModeText) return String(settingsSyncSummary.syncModeText || '').trim();
        if (descriptorSyncMode === 'ios-native-bridge') return 'iOS 原生桥接同步';
        if (descriptorSyncMode === 'macos-native-bridge') return 'mac 原生桥接同步';
        if (descriptorSyncMode === 'web-browser-directory') return '浏览器目录直连同步';
        if (descriptorSyncMode === 'web-local-server') return 'Web + 本地服务同步';
        if (descriptorSyncMode === 'web-local-cache') return '浏览器本地缓存模式';
        if (hasWebSyncRoot) return '浏览器目录直连同步';
        if (isHttpRuntime) return 'Web + 本地服务同步';
        return '浏览器本地缓存模式';
      })();
      const syncRouteText = (() => {
        if (settingsSyncSummary?.syncRouteText) return String(settingsSyncSummary.syncRouteText || '').trim();
        if (descriptorWriteOwner === 'native-sync-writer' && descriptorPlatform === 'ios') return '启动与主写入都以原生目录桥接为主，web 只负责界面与运行时。';
        if (descriptorWriteOwner === 'native-sync-writer') return '启动与主写入都以桌面桥接目录为主，本地服务负责补充同步与状态。';
        if (descriptorWriteOwner === 'browser-directory') return '当前由用户选择目录作为主读写入口；本地服务只负责辅助联动与状态回执。';
        if (descriptorWriteOwner === 'local-server') return '当前没有用户目录桥接；启动与主写入依赖本地服务 live-data.json，浏览器本地缓存只作临时快照。';
        return '当前没有目录桥接也没有本地服务；只能使用浏览器本地缓存，退出或换设备后不保证同步。';
      })();
      const syncModeEl = document.getElementById('settings-sync-mode');
      if (syncModeEl) syncModeEl.textContent = syncMode;
      const syncRouteEl = document.getElementById('settings-sync-route');
      if (syncRouteEl) syncRouteEl.textContent = syncRouteText;

      const describeSyncReason = (reason = '', receipt = null, context = {}) => {
        const runtime = getSyncReasonRuntime();
        if (runtime && typeof runtime.buildSyncReasonSurface === 'function') {
          const surface = runtime.buildSyncReasonSurface({
            receipt: receipt && typeof receipt === 'object'
              ? { ...receipt, reason: String(reason || receipt.reason || '').trim() }
              : { reason: String(reason || '').trim() },
            descriptor: context.descriptor || null,
            syncState: context.snapshotState || null,
            currentMeta: context.currentMeta || null,
            bootPhase: String(context.bootPhase || '').trim(),
          });
          if (surface && typeof surface === 'object' && String(surface.explainText || '').trim()) {
            return String(surface.explainText || '').trim();
          }
        }
        const normalized = String(reason || '').trim().toLowerCase();
        const receiptMessage = String(receipt?.message || '').trim();
        if (!normalized) return '最近没有记录到异常或阻塞。';
        if (normalized === 'browser_sync_root_loaded') return '用户目录已经接管当前运行态。';
        if (normalized === 'editing_in_progress') return '当前正在编辑内容，外部同步被暂缓，避免把光标下的数据突然替换掉。';
        if (normalized === 'recent_local_commit') return '刚刚有一次本地写入提交，系统短暂延后外部同步，避免新内容被旧快照覆盖。';
        if (normalized === 'local_dirty_pending_sync') return '本地还有未确认写入，外部同步先不覆盖，等待当前写入确认。';
        if (normalized === 'external_reload_deferred') return '外部快照已经到达，但会等本地空闲后再应用。';
        if (normalized === 'unexpected_sync_root') return '收到的外部数据来自另一个目录，不是当前用户目录，所以被系统主动忽略。';
        if (normalized === 'empty_external_snapshot') return '外部快照是空数据，但当前本地已有内容，系统已拦截这次覆盖。';
        if (normalized === 'stale_external_snapshot') return '收到的是旧版本外部快照，系统已保留当前较新的数据。';
        if (normalized === 'same_data') return '收到的数据与当前运行态一致，所以没有重复应用。';
        if (normalized === 'native_control_unavailable') return '当前环境没有可用的原生桥接能力。';
        if (normalized === 'browser_sync_root_permission_denied') return '浏览器没有授予所选目录读取权限。';
        if (normalized === 'browser_sync_root_write_denied') return '浏览器已经允许读取，但没有授予写入权限。';
        if (descriptorWriteOwner === 'browser-directory' && (normalized === 'sync_failed' || normalized === 'server_sync_error' || normalized === 'server-sync:error')) {
          return '浏览器目录仍是主写入链路；当前只是本地服务辅助联动没连上。';
        }
        if (descriptorWriteOwner === 'browser-directory' && /辅助同步服务未连接|无法连接同步服务/.test(receiptMessage)) {
          return '浏览器目录仍是主写入链路；当前只是本地服务辅助联动没连上。';
        }
        if (normalized === 'server_sync_error' || normalized === 'server-sync:error') return '本地服务同步失败，通常是服务端拒绝写入或服务暂时不可达。';
        return receiptMessage || `系统记录了同步事件：${normalized}`;
      };
      const describeSyncStatus = (status = '') => {
        const normalized = String(status || '').trim().toLowerCase();
        if (normalized === 'acked' || normalized === 'ok') return '已确认';
        if (normalized === 'pending' || normalized === 'syncing') return '同步中';
        if (normalized === 'deferred') return '已暂缓';
        if (normalized === 'blocked') return '已拦截';
        if (normalized === 'noop') return '无需应用';
        if (normalized === 'error') return '失败';
        return normalized || '未知';
      };
      const describeBootPhase = (phase = '') => {
        const normalized = String(phase || '').trim().toLowerCase();
        if (normalized === 'ready') return '已就绪';
        if (normalized === 'waiting-native-bootstrap') return '等待原生全量数据';
        if (normalized === 'waiting-browser-sync-bootstrap') return '等待浏览器目录数据';
        if (normalized === 'hydrating-startup-snapshot') return '启动补水中';
        if (normalized === 'booting') return '启动中';
        return normalized ? `阶段：${normalized}` : '未知';
      };
      const isBootHydrationPending = (phase = '') => {
        const normalized = String(phase || '').trim().toLowerCase();
        return normalized === 'waiting-native-bootstrap'
          || normalized === 'waiting-browser-sync-bootstrap'
          || normalized === 'hydrating-startup-snapshot'
          || normalized === 'booting';
      };
      const formatFreshnessAge = (value = '') => {
        const raw = String(value || '').trim();
        if (!raw) return '未知';
        const at = Date.parse(raw);
        if (!Number.isFinite(at) || at <= 0) return '未知';
        const deltaMs = Math.max(0, Date.now() - at);
        const deltaMinutes = Math.floor(deltaMs / 60000);
        if (deltaMinutes <= 0) return '刚刚';
        if (deltaMinutes < 60) return `${deltaMinutes} 分钟前`;
        const deltaHours = Math.floor(deltaMinutes / 60);
        if (deltaHours < 48) return `${deltaHours} 小时前`;
        const deltaDays = Math.floor(deltaHours / 24);
        return `${deltaDays} 天前`;
      };
      const pickFiniteNumber = (...values) => {
        for (const value of values) {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) return numeric;
        }
        return 0;
      };
      const buildSyncUserSummary = ({
        descriptor = null,
        receiptMeta = null,
        snapshotReceipt = null,
        snapshotState = null,
        currentMeta = null,
        bootPhase = '',
      } = {}) => {
        const pendingCount = pickFiniteNumber(
          snapshotState?.pendingCount,
          receiptMeta?.pendingCount,
          snapshotReceipt?.pendingCount,
          0,
        );
        const receiptReason = String(receiptMeta?.reason || snapshotReceipt?.reason || '').trim();
        const receiptMessage = String(snapshotReceipt?.message || receiptMeta?.message || '').trim();
        const receiptAt = String(receiptMeta?.lastReceiptAt || snapshotReceipt?.updatedAt || '').trim();
        const writeAt = String(currentMeta?.lastClientWriteAt || '').trim();
        const receiptFreshness = formatFreshnessAge(receiptAt);
        const writeFreshness = formatFreshnessAge(writeAt);
        const owner = String(descriptor?.durableWriteOwner || '').trim().toLowerCase();
        if (isBootHydrationPending(bootPhase)) {
          return '应用正在补水启动数据；补完后会立刻切到这台设备上最新的 live-data。';
        }
        if (pendingCount > 0) {
          return `本地改动已经保存，正在等待同步链路确认；当前还有 ${pendingCount} 条待确认写入。`;
        }
        if (
          owner === 'browser-directory'
          && (
            receiptReason === 'sync_failed'
            || receiptReason === 'server_sync_error'
            || receiptReason === 'server-sync:error'
            || /辅助同步服务未连接|无法连接同步服务/.test(receiptMessage)
          )
        ) {
          return '浏览器目录仍是主写入口；当前只是辅助同步服务没连上，目录里的最新内容仍可继续使用。';
        }
        if (owner === 'local-server') {
          return '当前没有接管用户目录；本机读写依赖本地服务 live-data.json，浏览器本地缓存只作临时快照。';
        }
        if (owner === 'browser-local-cache') {
          return '当前还没有接管用户目录或本地服务；此设备只使用浏览器本地缓存。';
        }
        if (receiptAt && receiptFreshness !== '未知') {
          return `当前设备已载入最新确认数据；最近一次同步回执是 ${receiptFreshness}。`;
        }
        if (writeAt && writeFreshness !== '未知') {
          return `当前运行态已经使用本机最新写入；最近一次本地写入是 ${writeFreshness}。`;
        }
        return '应用打开后会尽快读取这台设备上已经同步到位的最新 live-data。';
      };
      const describeSyncReadSource = (descriptor = null, fallbackMode = '') => {
        const safeDescriptor = descriptor && typeof descriptor === 'object' ? descriptor : {};
        const owner = String(safeDescriptor?.durableWriteOwner || '').trim().toLowerCase();
        const platform = String(safeDescriptor?.platform || '').trim().toLowerCase();
        const syncRootPath = String(safeDescriptor?.syncRoot?.pathHint || '').trim();
        if (owner === 'native-sync-writer' && platform === 'ios') return syncRootPath ? `iOS 原生目录（${syncRootPath}）` : 'iOS 原生目录';
        if (owner === 'native-sync-writer') return syncRootPath ? `原生目录（${syncRootPath}）` : '原生目录';
        if (owner === 'browser-directory') return syncRootPath ? `浏览器目录（${syncRootPath}）` : '浏览器目录';
        if (owner === 'local-server') return '本地服务 live-data.json';
        if (owner === 'browser-local-cache') return '浏览器本地缓存';
        if (syncRootPath) return `目录（${syncRootPath}）`;
        const normalizedMode = String(fallbackMode || '').trim().toLowerCase();
        if (normalizedMode === 'web + 本地服务同步') return '本地服务 live-data.json';
        if (normalizedMode === '浏览器目录直连同步') return '浏览器目录';
        return '浏览器本地缓存';
      };
      const describeStartupSource = (descriptor = null) => {
        const source = String(descriptor?.bootstrapSource || '').trim().toLowerCase();
        if (!source) return '未知';
        if (source === 'server-bootstrap-cache') return '服务端 bootstrap 副本';
        if (source === 'native-bootstrap-cache') return '原生壳 bootstrap 副本';
        if (source === 'startup-snapshot-fallback') return 'startup snapshot 副本';
        if (source === 'browser-directory-live-data') return '浏览器目录 live-data';
        if (source === 'local-cache-fallback') return '本地缓存回退';
        return source;
      };
      const LEGACY_NATIVE_BUILD_THRESHOLD_ISO = '2026-04-02T22:57:35+08:00';
      const LEGACY_NATIVE_BUILD_THRESHOLD_MS = Date.parse(LEGACY_NATIVE_BUILD_THRESHOLD_ISO);
      const normalizeNativeBuildInfo = (raw = null) => {
        if (!raw || typeof raw !== 'object') return null;
        const appVersion = String(raw.appVersion || raw.version || raw.appVersionName || '').trim();
        const buildTime = String(raw.buildTime || raw.nativeBuildTime || raw.compiledAt || '').trim();
        const binaryMTime = String(raw.binaryMTime || raw.binaryMtime || raw.binaryModifiedAt || '').trim();
        const binaryPath = String(raw.binaryPath || raw.executablePath || raw.path || '').trim();
        const webBuildStamp = String(raw.webBuildStamp || raw.webBuildVersion || raw.buildStamp || '').trim();
        if (!appVersion && !buildTime && !binaryMTime && !binaryPath && !webBuildStamp) return null;
        return {
          appVersion,
          buildTime,
          binaryMTime,
          binaryPath,
          webBuildStamp,
        };
      };
      const truncatePathForDiagnostic = (path = '', maxLength = 72) => {
        const value = String(path || '').trim();
        if (!value) return '-';
        if (value.length <= maxLength) return value;
        const head = Math.max(20, Math.floor((maxLength - 3) / 2));
        const tail = Math.max(16, maxLength - 3 - head);
        return `${value.slice(0, head)}...${value.slice(-tail)}`;
      };
      const resolveBuildFingerprint = ({
        descriptor = null,
        receiptMeta = null,
        snapshotReceipt = null,
        currentMeta = null,
      } = {}) => {
        const buildInfo = normalizeNativeBuildInfo(descriptor?.nativeBuildInfo || descriptor?.buildInfo);
        const appVersion = String(buildInfo?.appVersion || '').trim();
        const buildTime = String(buildInfo?.buildTime || '').trim();
        const binaryMTime = String(buildInfo?.binaryMTime || '').trim();
        const binaryPath = String(buildInfo?.binaryPath || '').trim();
        const webBuildStamp = String(
          buildInfo?.webBuildStamp
          || receiptMeta?.webBuildStamp
          || snapshotReceipt?.webBuildStamp
          || currentMeta?.webBuildStamp
          || ''
        ).trim();
        const binaryMTimeMs = Date.parse(binaryMTime);
        const isLikelyLegacyBuild = !!webBuildStamp
          && Number.isFinite(LEGACY_NATIVE_BUILD_THRESHOLD_MS)
          && Number.isFinite(binaryMTimeMs)
          && binaryMTimeMs > 0
          && binaryMTimeMs < LEGACY_NATIVE_BUILD_THRESHOLD_MS;
        return {
          appVersion: appVersion || '-',
          buildTime: buildTime || '-',
          binaryMTime: binaryMTime || '-',
          binaryPath: truncatePathForDiagnostic(binaryPath),
          webBuildStamp: webBuildStamp || '-',
          isLikelyLegacyBuild,
        };
      };
      const buildLegacyBuildWarning = (fingerprint = null) => {
        if (!fingerprint || fingerprint.isLikelyLegacyBuild !== true) return '';
        return `疑似旧包/旧构建（native binaryMTime < ${LEGACY_NATIVE_BUILD_THRESHOLD_ISO}）`;
      };
      const buildPlatformShellSummary = (descriptor = null) => {
        const platform = String(descriptor?.platform || '').trim() || '-';
        const shellKind = String(descriptor?.shellKind || '').trim() || '-';
        return `${platform} / ${shellKind}`;
      };

      const observabilityRuntime = typeof api.getObservabilityRuntimeModules === 'function'
        ? api.getObservabilityRuntimeModules()
        : null;
      const syncDebugSnapshot = observabilityRuntime && typeof observabilityRuntime.buildSyncDebugSnapshot === 'function'
        ? observabilityRuntime.buildSyncDebugSnapshot({ syncMode, syncReceipt })
        : null;
      const syncInspection = syncDebugSnapshot?.syncInspection && typeof syncDebugSnapshot.syncInspection === 'object'
        ? syncDebugSnapshot.syncInspection
        : null;
      const debugEl = document.getElementById('settings-sync-debug');
      const buildPlatformShellEl = document.getElementById('settings-build-platform-shell');
      const nativeAppVersionEl = document.getElementById('settings-native-app-version');
      const nativeBuildTimeEl = document.getElementById('settings-native-build-time');
      const webBuildStampEl = document.getElementById('settings-web-build-stamp');
      const buildWarningEl = document.getElementById('settings-build-warning');
      const runtimeFootprint = syncDebugSnapshot?.runtimeFootprint && typeof syncDebugSnapshot.runtimeFootprint === 'object'
        ? syncDebugSnapshot.runtimeFootprint
        : null;
      const actionTransactionRawTypeLabel = runtimeFootprint
        ? String(runtimeFootprint?.actionTransactionRawType).trim()
        : '-';
      const formatMemoryMb = (value) => {
        const bytes = Math.max(0, Number(value || 0) || 0);
        if (!bytes) return '0 MB';
        const mb = bytes / (1024 * 1024);
        const formatted = bytes >= 1024 * 1024 * 1024 ? mb.toFixed(1).replace(/\.0$/, '') : Math.round(mb).toString();
        return `${formatted} MB`;
      };
      if (buildPlatformShellEl || nativeAppVersionEl || nativeBuildTimeEl || webBuildStampEl || buildWarningEl || debugEl) {
        const descriptor = syncDebugSnapshot?.shellDescriptor && typeof syncDebugSnapshot.shellDescriptor === 'object'
          ? syncDebugSnapshot.shellDescriptor
          : shellDescriptor;
        const currentMeta = syncDebugSnapshot?.currentMeta && typeof syncDebugSnapshot.currentMeta === 'object'
          ? syncDebugSnapshot.currentMeta
          : {};
        const buildFingerprint = resolveBuildFingerprint({
          descriptor,
          snapshotReceipt: syncReceipt,
          currentMeta,
        });
        const legacyBuildWarning = buildLegacyBuildWarning(buildFingerprint);
        if (buildPlatformShellEl) buildPlatformShellEl.textContent = buildPlatformShellSummary(descriptor);
        if (nativeAppVersionEl) nativeAppVersionEl.textContent = buildFingerprint.appVersion;
        if (nativeBuildTimeEl) nativeBuildTimeEl.textContent = buildFingerprint.buildTime;
        if (webBuildStampEl) webBuildStampEl.textContent = buildFingerprint.webBuildStamp;
        if (buildWarningEl) buildWarningEl.textContent = legacyBuildWarning || '构建状态正常';
      }
      const surfaceSummaryEl = document.getElementById('settings-runtime-surface-summary');
      const memorySummaryEl = document.getElementById('settings-runtime-memory-summary');
      if (debugEl) {
        const currentMeta = syncDebugSnapshot?.currentMeta && typeof syncDebugSnapshot.currentMeta === 'object'
          ? syncDebugSnapshot.currentMeta
          : {};
        const browserMeta = syncDebugSnapshot?.browserMeta && typeof syncDebugSnapshot.browserMeta === 'object'
          ? syncDebugSnapshot.browserMeta
          : {};
        const descriptor = syncDebugSnapshot?.shellDescriptor && typeof syncDebugSnapshot.shellDescriptor === 'object'
          ? syncDebugSnapshot.shellDescriptor
          : shellDescriptor;
        const revision = Number.isFinite(Number(currentMeta.revision)) ? Number(currentMeta.revision) : 0;
        const lastClientWriteAt = String(currentMeta.lastClientWriteAt || '').trim() || '-';
        const deviceId = String(currentMeta.deviceId || '').trim() || '-';
        const liveDataPath = String(browserMeta.liveDataPath || '').trim() || 'data/live-data.json（默认）';
        const pathPrefix = String(browserMeta.pathPrefix || '').trim() || '/';
        const selectedMode = String(browserMeta.selectedMode || '').trim() || 'none';
        const selectedAt = String(browserMeta.selectedAt || '').trim() || '-';
        const recentPendingMutation = Array.isArray(syncInspection?.pendingMutations) && syncInspection.pendingMutations.length
          ? syncInspection.pendingMutations[0]
          : null;
        const syncQueue = syncInspection?.syncQueue && typeof syncInspection.syncQueue === 'object'
          ? syncInspection.syncQueue
          : null;
        const bootPhaseRaw = String(syncDebugSnapshot?.bootPhase || '').trim();
        const readSource = describeSyncReadSource(descriptor, syncMode);
        const startupSource = describeStartupSource(descriptor);
        const startupInspection = descriptor?.startupSourceInspection && typeof descriptor.startupSourceInspection === 'object'
          ? descriptor.startupSourceInspection
          : null;
        const authoritativeSource = String(startupInspection?.authoritativeSource || '').trim() || '-';
        const authoritativeRevision = Number(startupInspection?.authoritativeRevision || 0);
        const authoritativeHasUserData = startupInspection?.authoritativeHasUserData === true ? 'yes' : 'no';
        const authoritativeLastWriteAt = String(startupInspection?.authoritativeLastWriteAt || '').trim() || '-';
        const browserDirectoryCandidate = startupInspection?.selectedBrowserDirectory
          ? `${String(startupInspection?.browserDirectoryPathHint || '').trim() || '-'} | readable=${startupInspection?.browserDirectoryReadable === true ? 'yes' : 'no'} | writable=${startupInspection?.browserDirectoryWritable === true ? 'yes' : 'no'}`
          : '未选择浏览器目录';
        const startupSelectionReason = String(startupInspection?.selectionReason || '').trim() || '-';
        const buildFingerprint = resolveBuildFingerprint({
          descriptor,
          snapshotReceipt: syncReceipt,
          currentMeta,
        });
        const legacyBuildWarning = buildLegacyBuildWarning(buildFingerprint);
        debugEl.textContent = [
          `descriptorVersion: ${String(descriptor?.descriptorVersion || '-').trim() || '-'}`,
          `platform/shell: ${String(descriptor?.platform || '-').trim() || '-'}/${String(descriptor?.shellKind || '-').trim() || '-'}`,
          `启动阶段: ${describeBootPhase(bootPhaseRaw)}`,
          `补水状态: ${isBootHydrationPending(bootPhaseRaw) ? '补水中' : '已稳定'}`,
          `当前读源: ${readSource}`,
          `启动来源: ${startupSource}`,
          `启动权威快照: ${authoritativeSource} | rev=${authoritativeRevision} | hasUserData=${authoritativeHasUserData}`,
          `启动权威写入时间: ${authoritativeLastWriteAt}`,
          `浏览器目录候选: ${browserDirectoryCandidate}`,
          `启动判定: ${startupSelectionReason}`,
          `native appVersion: ${buildFingerprint.appVersion}`,
          `native buildTime: ${buildFingerprint.buildTime}`,
          `native binaryMTime: ${buildFingerprint.binaryMTime}`,
          `native binaryPath: ${buildFingerprint.binaryPath}`,
          `web build stamp: ${buildFingerprint.webBuildStamp}`,
          `构建告警: ${legacyBuildWarning || '-'}`,
          `运行中 revision: ${revision}`,
          `运行中 lastClientWriteAt: ${lastClientWriteAt}`,
          `运行态新鲜度: ${formatFreshnessAge(lastClientWriteAt)}`,
          `运行中 deviceId: ${deviceId}`,
          `当前同步模式: ${syncMode}`,
          `主写入 owner: ${String(descriptor?.durableWriteOwner || '-').trim() || '-'}`,
          `bridge 状态: sync=${String(descriptor?.bridgeStatus?.sync || '-').trim() || '-'}, control=${String(descriptor?.bridgeStatus?.control || '-').trim() || '-'}, speech=${String(descriptor?.bridgeStatus?.speech || '-').trim() || '-'}`,
          `浏览器目录模式: ${selectedMode}`,
          `浏览器命中路径: ${liveDataPath}`,
          `浏览器路径前缀: ${pathPrefix}`,
          `浏览器目录选择时间: ${selectedAt}`,
          `最近待确认 mutation: ${recentPendingMutation ? `${String(recentPendingMutation.mutationId || '').trim()} | ${String((Array.isArray(recentPendingMutation.domains) ? recentPendingMutation.domains : []).join(', ')) || '-'}` : '-'}`,
          `同步队列: pendingRevision=${Number(syncQueue?.pendingRevision || syncInspection?.latestPendingRevision || 0)} | pendingMutations=${Number(syncQueue?.pendingCount || syncInspection?.pendingCount || 0)} | pendingEntities=${Number(syncQueue?.pendingEntityCount || (Array.isArray(syncInspection?.pendingEntities) ? syncInspection.pendingEntities.length : 0) || 0)}`,
          `聊天会话: sessions=${Number(runtimeFootprint?.chatSessionCount || 0)} | currentMessages=${Number(runtimeFootprint?.currentSessionMessageCount || 0)} | totalMessages=${Number(runtimeFootprint?.totalChatMessageCount || 0)}`,
          `AI 历史链: registry=${String(runtimeFootprint?.registryCurrentSelectionSource || runtimeFootprint?.registryStatus || '-').trim() || '-'} | stored=${String(runtimeFootprint?.storedPointerStatus || '-').trim() || '-'} | repair=${String(runtimeFootprint?.historyRepairStatus || '-').trim() || '-'}:${String(runtimeFootprint?.historyRepairReason || '-').trim() || '-'} | boot=${String(runtimeFootprint?.bootHistoryStatus || '-').trim() || '-'}:${String(runtimeFootprint?.bootHistoryReason || '-').trim() || '-'}`,
          `稳定记忆链: facts=${Number(runtimeFootprint?.stableMemoryFactCount || 0)} | locked=${Number(runtimeFootprint?.lockedStableMemoryFactCount || 0)} | explicit=${Number(runtimeFootprint?.explicitUserStableFactCount || 0)} | settings=${Number(runtimeFootprint?.settingsDerivedStableFactCount || 0)} | mirror=${runtimeFootprint?.stableMemoryMirrorAvailable ? 'ready' : 'missing'} | boot=${String(runtimeFootprint?.bootStableMemoryStatus || '-').trim() || '-'}:${String(runtimeFootprint?.bootStableMemoryReason || '-').trim() || '-'}`,
          `图谱节点: nodes=${Number(runtimeFootprint?.thoughtGraphNodeCount || 0)} | canvas=${Number(runtimeFootprint?.thoughtGraphCanvasCount || 0)} | layout=${String(runtimeFootprint?.thoughtGraphLayout || 'unknown').trim() || 'unknown'} | focus=${String(runtimeFootprint?.thoughtGraphFocus || '-').trim() || '-'} | preview=${runtimeFootprint?.thoughtGraphPreviewVisible ? 'visible' : 'hidden'} | shortcut=${runtimeFootprint?.thoughtGraphShortcutActive ? 'active' : 'idle'} | detail=${runtimeFootprint?.detailModalActive ? 'open' : 'closed'}`,
          `图谱运行态: rt=${runtimeFootprint?.thoughtGraphRuntimeKnown ? (runtimeFootprint?.thoughtGraphRuntimeActive ? 'active' : 'idle') : 'missing'} | app=${runtimeFootprint?.thoughtGraphRuntimeHasApp ? 'yes' : 'no'} | canvas=${runtimeFootprint?.thoughtGraphRuntimeHasCanvas ? 'yes' : 'no'} | host=${runtimeFootprint?.thoughtGraphRuntimeHostConnected ? 'connected' : 'detached'} | views=${Number(runtimeFootprint?.thoughtGraphRuntimeNodeViewCount || 0)} | models=${Number(runtimeFootprint?.thoughtGraphRuntimeNodeModelCount || 0)} | edges=${Number(runtimeFootprint?.thoughtGraphRuntimeEdgeModelCount || 0)} | cache=${Number(runtimeFootprint?.thoughtGraphRuntimePositionCacheCount || 0)} | raf=${runtimeFootprint?.thoughtGraphRuntimeRafActive ? 'on' : 'off'}/${runtimeFootprint?.thoughtGraphRuntimeHoverRafActive ? 'hover' : 'idle'} | pending=${runtimeFootprint?.thoughtGraphRuntimePendingInit ? 'yes' : 'no'} | mount=${Number(runtimeFootprint?.thoughtGraphRuntimeMountCount || 0)}/${Number(runtimeFootprint?.thoughtGraphRuntimeDestroyCount || 0)} | galaxy=${Number(runtimeFootprint?.galaxyCanvasWidth || 0)}x${Number(runtimeFootprint?.galaxyCanvasHeight || 0)}:${formatMemoryMb(runtimeFootprint?.galaxyCanvasApproxBytes)} | link=${Number(runtimeFootprint?.linkCanvasWidth || 0)}x${Number(runtimeFootprint?.linkCanvasHeight || 0)}:${formatMemoryMb(runtimeFootprint?.linkCanvasApproxBytes)}`,
          `图谱预览队列: mode=${String(runtimeFootprint?.thoughtGraphKeyboardMode || '-').trim() || '-'} | flashVisited=${Number(runtimeFootprint?.thoughtGraphKeyboardFlashVisitedCount || 0)} | fixedVisited=${Number(runtimeFootprint?.thoughtGraphKeyboardFixedVisitedCount || 0)} | flashTraversal=${Number(runtimeFootprint?.thoughtGraphKeyboardFlashTraversalCount || 0)}@${Number(runtimeFootprint?.thoughtGraphKeyboardFlashTraversalCursor || -1)} | fixedTraversal=${Number(runtimeFootprint?.thoughtGraphKeyboardFixedTraversalCount || 0)}@${Number(runtimeFootprint?.thoughtGraphKeyboardFixedTraversalCursor || -1)} | detail=${runtimeFootprint?.thoughtGraphKeyboardDetailOpen ? 'open' : 'closed'}`,
          `Surface 占用: thoughts=${Number(runtimeFootprint?.flashThoughtsSurfaceNodes || 0)}${runtimeFootprint?.flashThoughtsViewActive ? '*' : ''} | daily=${Number(runtimeFootprint?.dailySurfaceNodes || 0)}${runtimeFootprint?.dailyViewActive ? '*' : ''} | project=${Number(runtimeFootprint?.projectSurfaceNodes || 0)}${runtimeFootprint?.projectViewActive ? '*' : ''} | settings=${Number(runtimeFootprint?.settingsSurfaceNodes || 0)}${runtimeFootprint?.settingsViewActive ? '*' : ''} | sidebarP=${Number(runtimeFootprint?.sidebarProjectTreeNodes || 0)} | sidebarD=${Number(runtimeFootprint?.sidebarDailyTreeNodes || 0)} | hover=${Number(runtimeFootprint?.thoughtGraphHoverPreviewNodes || 0)}${runtimeFootprint?.thoughtGraphHoverPreviewVisible ? '*' : ''} | drawer=${Number(runtimeFootprint?.drawerFlashThoughtsNodes || 0)} | projExt=${Number(runtimeFootprint?.projectExternalSurfaceNodes || 0)} | detail=${runtimeFootprint?.detailModalVisible ? 'visible' : 'hidden'} | ai=${runtimeFootprint?.aiChatDrawerVisible ? 'open' : 'closed'} | sessions=${runtimeFootprint?.aiChatSessionDrawerVisible ? 'open' : 'closed'}`,
          `DOM roots: ${Array.isArray(runtimeFootprint?.domRootLeaders) && runtimeFootprint.domRootLeaders.length
            ? runtimeFootprint.domRootLeaders.map((entry) => `${String(entry?.id || '').trim() || '-'}=${Number(entry?.nodeCount || 0)}${entry?.hidden ? '(h)' : ''}`).join(' | ')
            : '-'}`,
          `存储快照: recovery=${formatMemoryMb(runtimeFootprint?.recoverySnapshotChars)} | localCache=${formatMemoryMb(runtimeFootprint?.localDataCacheChars)} | startup=${formatMemoryMb(runtimeFootprint?.startupSnapshotChars)} | txSnapshot=${formatMemoryMb(runtimeFootprint?.externalTxSnapshotChars)}`,
          `页面内存: heap=${formatMemoryMb(runtimeFootprint?.jsHeapUsedBytes)}/${formatMemoryMb(runtimeFootprint?.jsHeapTotalBytes)} | limit=${formatMemoryMb(runtimeFootprint?.jsHeapLimitBytes ?? runtimeFootprint?.jsHeapSizeLimit)} | dom=${Number(runtimeFootprint?.domNodeCount || 0)} | data=${formatMemoryMb(runtimeFootprint?.runtimeDataBytes)} | ai=${formatMemoryMb(runtimeFootprint?.runtimeDataAIMemoryBytes)} | flash=${formatMemoryMb(runtimeFootprint?.runtimeDataFlashThoughtsBytes)} | project=${formatMemoryMb(runtimeFootprint?.runtimeDataProjectsBytes)} | daily=${formatMemoryMb(runtimeFootprint?.runtimeDataDailyMonthsBytes)} | rem=${formatMemoryMb(runtimeFootprint?.runtimeDataRemindersBytes)} | routine=${formatMemoryMb(runtimeFootprint?.runtimeDataRoutinesBytes)} | sop=${formatMemoryMb(runtimeFootprint?.runtimeDataSopsBytes)} | plugin=${formatMemoryMb(runtimeFootprint?.runtimeDataPluginDataBytes)} | ledger=${formatMemoryMb(runtimeFootprint?.runtimeDataExpenseLedgerBytes)} | overlay=${formatMemoryMb(runtimeFootprint?.runtimeDataRuntimeOverlayBytes)} | undo=${Number(runtimeFootprint?.undoStackCount || 0)}/${Number(runtimeFootprint?.undoRedoCount || 0)} | undoBytes=${formatMemoryMb(runtimeFootprint?.undoStackApproxBytes)}/${formatMemoryMb(runtimeFootprint?.undoRedoApproxBytes)} | tx=${Number(runtimeFootprint?.actionTransactionCount || 0)} | txBytes=${formatMemoryMb(runtimeFootprint?.actionTransactionSnapshotBytes)} | txRaw=${actionTransactionRawTypeLabel || '-'}:${Number(runtimeFootprint?.actionTransactionRawKeyCount || 0)}:${formatMemoryMb(runtimeFootprint?.actionTransactionRawBytes)} | txNorm=${Number(runtimeFootprint?.actionTransactionNormalizedCount || 0)}:${formatMemoryMb(runtimeFootprint?.actionTransactionNormalizedBytes)} | perf=${runtimeFootprint?.jsHeapMetricsAvailable ? 'available' : 'missing'} | graphMode=${String(runtimeFootprint?.thoughtGraphStatusMode || '-').trim() || '-'}`,
        ].join('\n');
      }
      if (surfaceSummaryEl) {
        const domRootSummary = Array.isArray(runtimeFootprint?.domRootLeaders) && runtimeFootprint.domRootLeaders.length
          ? runtimeFootprint.domRootLeaders.slice(0, 3).map((entry) => `${String(entry?.id || '').trim() || '-'}=${Number(entry?.nodeCount || 0)}${entry?.hidden ? '(h)' : ''}`).join(',')
          : '-';
        surfaceSummaryEl.textContent = `thoughts=${Number(runtimeFootprint?.flashThoughtsSurfaceNodes || 0)}${runtimeFootprint?.flashThoughtsViewActive ? '*' : ''} | daily=${Number(runtimeFootprint?.dailySurfaceNodes || 0)}${runtimeFootprint?.dailyViewActive ? '*' : ''} | project=${Number(runtimeFootprint?.projectSurfaceNodes || 0)}${runtimeFootprint?.projectViewActive ? '*' : ''} | settings=${Number(runtimeFootprint?.settingsSurfaceNodes || 0)}${runtimeFootprint?.settingsViewActive ? '*' : ''} | sidebarP=${Number(runtimeFootprint?.sidebarProjectTreeNodes || 0)} | sidebarD=${Number(runtimeFootprint?.sidebarDailyTreeNodes || 0)} | hover=${Number(runtimeFootprint?.thoughtGraphHoverPreviewNodes || 0)}${runtimeFootprint?.thoughtGraphHoverPreviewVisible ? '*' : ''} | drawer=${Number(runtimeFootprint?.drawerFlashThoughtsNodes || 0)} | projExt=${Number(runtimeFootprint?.projectExternalSurfaceNodes || 0)} | detail=${runtimeFootprint?.detailModalVisible ? 'visible' : 'hidden'} | ai=${runtimeFootprint?.aiChatDrawerVisible ? 'open' : 'closed'} | sessions=${runtimeFootprint?.aiChatSessionDrawerVisible ? 'open' : 'closed'} | rt=${runtimeFootprint?.thoughtGraphRuntimeKnown ? (runtimeFootprint?.thoughtGraphRuntimeActive ? 'active' : 'idle') : 'missing'} | views=${Number(runtimeFootprint?.thoughtGraphRuntimeNodeViewCount || 0)} | models=${Number(runtimeFootprint?.thoughtGraphRuntimeNodeModelCount || 0)} | cache=${Number(runtimeFootprint?.thoughtGraphRuntimePositionCacheCount || 0)} | roots=${domRootSummary}`;
      }
      if (memorySummaryEl) {
        memorySummaryEl.textContent = `heap=${formatMemoryMb(runtimeFootprint?.jsHeapUsedBytes)}/${formatMemoryMb(runtimeFootprint?.jsHeapTotalBytes)} | limit=${formatMemoryMb(runtimeFootprint?.jsHeapLimitBytes ?? runtimeFootprint?.jsHeapSizeLimit)} | dom=${Number(runtimeFootprint?.domNodeCount || 0)} | data=${formatMemoryMb(runtimeFootprint?.runtimeDataBytes)} | ai=${formatMemoryMb(runtimeFootprint?.runtimeDataAIMemoryBytes)} | flash=${formatMemoryMb(runtimeFootprint?.runtimeDataFlashThoughtsBytes)} | project=${formatMemoryMb(runtimeFootprint?.runtimeDataProjectsBytes)} | daily=${formatMemoryMb(runtimeFootprint?.runtimeDataDailyMonthsBytes)} | rem=${formatMemoryMb(runtimeFootprint?.runtimeDataRemindersBytes)} | routine=${formatMemoryMb(runtimeFootprint?.runtimeDataRoutinesBytes)} | sop=${formatMemoryMb(runtimeFootprint?.runtimeDataSopsBytes)} | plugin=${formatMemoryMb(runtimeFootprint?.runtimeDataPluginDataBytes)} | ledger=${formatMemoryMb(runtimeFootprint?.runtimeDataExpenseLedgerBytes)} | overlay=${formatMemoryMb(runtimeFootprint?.runtimeDataRuntimeOverlayBytes)} | undo=${Number(runtimeFootprint?.undoStackCount || 0)}/${Number(runtimeFootprint?.undoRedoCount || 0)} | undoBytes=${formatMemoryMb(runtimeFootprint?.undoStackApproxBytes)}/${formatMemoryMb(runtimeFootprint?.undoRedoApproxBytes)} | tx=${Number(runtimeFootprint?.actionTransactionCount || 0)} | txBytes=${formatMemoryMb(runtimeFootprint?.actionTransactionSnapshotBytes)} | txRaw=${actionTransactionRawTypeLabel || '-'}:${Number(runtimeFootprint?.actionTransactionRawKeyCount || 0)}:${formatMemoryMb(runtimeFootprint?.actionTransactionRawBytes)} | txNorm=${Number(runtimeFootprint?.actionTransactionNormalizedCount || 0)}:${formatMemoryMb(runtimeFootprint?.actionTransactionNormalizedBytes)} | rec=${formatMemoryMb(runtimeFootprint?.recoverySnapshotChars)} | cache=${formatMemoryMb(runtimeFootprint?.localDataCacheChars)} | startup=${formatMemoryMb(runtimeFootprint?.startupSnapshotChars)} | perf=${runtimeFootprint?.jsHeapMetricsAvailable ? 'available' : 'missing'} | graphMode=${String(runtimeFootprint?.thoughtGraphStatusMode || '-').trim() || '-'} | app=${runtimeFootprint?.thoughtGraphRuntimeHasApp ? 'yes' : 'no'} | raf=${runtimeFootprint?.thoughtGraphRuntimeRafActive ? 'on' : 'off'}/${runtimeFootprint?.thoughtGraphRuntimeHoverRafActive ? 'hover' : 'idle'} | pending=${runtimeFootprint?.thoughtGraphRuntimePendingInit ? 'yes' : 'no'} | mount=${Number(runtimeFootprint?.thoughtGraphRuntimeMountCount || 0)}/${Number(runtimeFootprint?.thoughtGraphRuntimeDestroyCount || 0)} | galaxy=${Number(runtimeFootprint?.galaxyCanvasWidth || 0)}x${Number(runtimeFootprint?.galaxyCanvasHeight || 0)}:${formatMemoryMb(runtimeFootprint?.galaxyCanvasApproxBytes)} | link=${Number(runtimeFootprint?.linkCanvasWidth || 0)}x${Number(runtimeFootprint?.linkCanvasHeight || 0)}:${formatMemoryMb(runtimeFootprint?.linkCanvasApproxBytes)}`;
      }
      if (memorySummaryEl) {
        const topDomains = Array.isArray(runtimeFootprint?.runtimeDataTopDomains)
          ? runtimeFootprint.runtimeDataTopDomains
          : [];
        const morphRuntimeDomains = Array.isArray(runtimeFootprint?.runtimeDataMorphRuntimeDomains)
          ? runtimeFootprint.runtimeDataMorphRuntimeDomains
          : [];
        const runtimeHolderDomains = Array.isArray(runtimeFootprint?.runtimeHolderTopDomains)
          ? runtimeFootprint.runtimeHolderTopDomains
          : [];
        const settingsStateDomains = Array.isArray(runtimeFootprint?.runtimeSettingsStateDomains)
          ? runtimeFootprint.runtimeSettingsStateDomains
          : [];
        const aiChatStateDomains = Array.isArray(runtimeFootprint?.runtimeAIChatStateDomains)
          ? runtimeFootprint.runtimeAIChatStateDomains
          : [];
        const largestTxFields = Array.isArray(runtimeFootprint?.actionTransactionLargestFieldBreakdown)
          ? runtimeFootprint.actionTransactionLargestFieldBreakdown
          : [];
        if (topDomains.length) {
          memorySummaryEl.textContent += ` | top=${topDomains.map((entry) => `${String(entry?.key || '').trim() || '-'}:${formatMemoryMb(entry?.bytes)}`).join(',')}`;
        }
        if (morphRuntimeDomains.length) {
          memorySummaryEl.textContent += ` | morphRuntime=${morphRuntimeDomains.map((entry) => `${String(entry?.key || '').trim() || '-'}:${formatMemoryMb(entry?.bytes)}`).join(',')}`;
        }
        if (runtimeHolderDomains.length) {
          memorySummaryEl.textContent += ` | holders=${runtimeHolderDomains.map((entry) => `${String(entry?.key || '').trim() || '-'}:${formatMemoryMb(entry?.bytes)}`).join(',')}`;
        }
        if (settingsStateDomains.length) {
          memorySummaryEl.textContent += ` | settingsState=${settingsStateDomains.map((entry) => `${String(entry?.key || '').trim() || '-'}:${formatMemoryMb(entry?.bytes)}`).join(',')}`;
        }
        if (aiChatStateDomains.length) {
          memorySummaryEl.textContent += ` | aiState=${aiChatStateDomains.map((entry) => `${String(entry?.key || '').trim() || '-'}:${formatMemoryMb(entry?.bytes)}`).join(',')}`;
        }
        if (Number(runtimeFootprint?.actionTransactionLargestBytes || 0) > 0) {
          memorySummaryEl.textContent += ` | txTop=${String(runtimeFootprint?.actionTransactionLargestId || '-').trim() || '-'}:${formatMemoryMb(runtimeFootprint?.actionTransactionLargestBytes)}`;
          if (largestTxFields.length) {
            memorySummaryEl.textContent += ` | txFields=${largestTxFields.map((entry) => `${String(entry?.key || '').trim() || '-'}:${formatMemoryMb(entry?.bytes)}`).join(',')}`;
          }
        }
      }

      const aiRequestEl = document.getElementById('settings-ai-request-debug');
      if (aiRequestEl) {
        const aiRequestMetrics = syncDebugSnapshot?.aiRequestMetrics && typeof syncDebugSnapshot.aiRequestMetrics === 'object'
          ? syncDebugSnapshot.aiRequestMetrics
          : null;
        const latestRequests = Array.isArray(aiRequestMetrics?.latestRequests)
          ? aiRequestMetrics.latestRequests
          : [];
        const heaviestPrompt = aiRequestMetrics?.heaviestPrompt && typeof aiRequestMetrics.heaviestPrompt === 'object'
          ? aiRequestMetrics.heaviestPrompt
          : null;
        const slowestRequest = aiRequestMetrics?.slowestRequest && typeof aiRequestMetrics.slowestRequest === 'object'
          ? aiRequestMetrics.slowestRequest
          : null;
        const latestReminderShortcut = aiRequestMetrics?.latestReminderShortcut && typeof aiRequestMetrics.latestReminderShortcut === 'object'
          ? aiRequestMetrics.latestReminderShortcut
          : null;
        aiRequestEl.textContent = [
          `最近请求数: ${Number(aiRequestMetrics?.requestCount || 0)} | 对话内=${Number(aiRequestMetrics?.sessionRequestCount || 0)} | 运行时=${Number(aiRequestMetrics?.runtimeRequestCount || 0)}`,
          `累计 tokens: total=${Number(aiRequestMetrics?.totalTokens || 0)} | prompt=${Number(aiRequestMetrics?.promptTokens || 0)} | completion=${Number(aiRequestMetrics?.completionTokens || 0)}`,
          `累计耗时: totalMs=${Number(aiRequestMetrics?.totalDurationMs || 0)} | avgMs=${Number(aiRequestMetrics?.averageDurationMs || 0)}`,
          `提醒 shortcut: hits=${Number(aiRequestMetrics?.reminderShortcutWriteCount || 0)} | latest=${latestReminderShortcut ? `${String(latestReminderShortcut.provider || '-').trim() || '-'} | ${String(latestReminderShortcut.model || '-').trim() || '-'} | path=${String(latestReminderShortcut.path || '-').trim() || '-'} | ms=${Number(latestReminderShortcut.durationMs || 0)} | totalTokens=${Number(latestReminderShortcut.totalTokens || 0)}` : '-'}`,
          `最重 prompt: ${heaviestPrompt ? `${String(heaviestPrompt.provider || '-').trim() || '-'} | ${String(heaviestPrompt.model || '-').trim() || '-'} | path=${String(heaviestPrompt.path || '-').trim() || '-'} | promptTokens=${Number(heaviestPrompt.promptTokens || 0)} | totalTokens=${Number(heaviestPrompt.totalTokens || 0)}` : '-'}`,
          `最慢请求: ${slowestRequest ? `${String(slowestRequest.provider || '-').trim() || '-'} | ${String(slowestRequest.model || '-').trim() || '-'} | path=${String(slowestRequest.path || '-').trim() || '-'} | durationMs=${Number(slowestRequest.durationMs || 0)} | totalTokens=${Number(slowestRequest.totalTokens || 0)}` : '-'}`,
          `最近明细: ${latestRequests.length ? latestRequests.slice(0, 6).map((item) => [String(item?.provider || '-').trim() || '-', String(item?.model || '-').trim() || '-', `path=${String(item?.path || '-').trim() || '-'}`, `tokens=${Number(item?.totalTokens || 0)}`, `ms=${Number(item?.durationMs || 0)}`, String(item?.tokenSource || 'estimated').trim() || 'estimated'].join(' | ')).join('\n') : '-'}`,
        ].join('\n');
      }

      const receiptEl = document.getElementById('settings-sync-receipt');
      const syncSummaryEl = document.getElementById('settings-sync-summary');
      if (receiptEl) {
        const receiptMeta = syncDebugSnapshot?.receiptFeed && typeof syncDebugSnapshot.receiptFeed === 'object'
          ? syncDebugSnapshot.receiptFeed
          : (shellDescriptor?.receiptFeed && typeof shellDescriptor.receiptFeed === 'object' ? shellDescriptor.receiptFeed : null);
        const snapshotReceipt = syncDebugSnapshot?.syncReceipt && typeof syncDebugSnapshot.syncReceipt === 'object'
          ? syncDebugSnapshot.syncReceipt
          : syncReceipt;
        const snapshotState = syncDebugSnapshot?.syncMutationState && typeof syncDebugSnapshot.syncMutationState === 'object'
          ? syncDebugSnapshot.syncMutationState
          : syncMutationState;
        const updatedAt = api.formatSettingsTime(receiptMeta?.lastReceiptAt || snapshotReceipt?.updatedAt || '');
        const source = String(receiptMeta?.source || snapshotReceipt?.source || '').trim() || '-';
        const reason = String(receiptMeta?.reason || snapshotReceipt?.reason || '').trim() || '-';
        const pendingCount = pickFiniteNumber(
          snapshotState?.pendingCount,
          receiptMeta?.pendingCount,
          snapshotReceipt?.pendingCount,
          0,
        );
        const pendingDomains = Array.isArray(snapshotState?.pendingDomains) && snapshotState.pendingDomains.length
          ? snapshotState.pendingDomains.join(', ')
          : (Array.isArray(snapshotReceipt?.pendingDomains) && snapshotReceipt.pendingDomains.length ? snapshotReceipt.pendingDomains.join(', ') : '-');
        const ackedRevision = pickFiniteNumber(
          receiptMeta?.ackedRevision,
          snapshotReceipt?.ackedRevision,
          snapshotState?.ackedRevision,
          0,
        );
        const mergedMutation = Array.isArray(syncInspection?.mergedMutations) && syncInspection.mergedMutations.length
          ? syncInspection.mergedMutations[0]
          : null;
        const blockedMutation = Array.isArray(syncInspection?.blockedMutations) && syncInspection.blockedMutations.length
          ? syncInspection.blockedMutations[0]
          : null;
        const conflict = syncInspection?.conflict && typeof syncInspection.conflict === 'object'
          ? syncInspection.conflict
          : null;
        const receiptTimeline = Array.isArray(syncInspection?.receiptTimeline)
          ? syncInspection.receiptTimeline
          : [];
        const timelineText = receiptTimeline.length
          ? receiptTimeline.slice(0, 6).map((item) => {
              const summary = String(item?.summary || item?.message || '').trim();
              return [
                String(item?.kind || 'receipt').trim() || 'receipt',
                String(item?.status || '').trim(),
                String(item?.source || '').trim(),
                summary,
              ].filter(Boolean).join(' | ');
            }).join(' || ')
          : '-';
        const pendingEntity = Array.isArray(syncInspection?.pendingEntities) && syncInspection.pendingEntities.length
          ? syncInspection.pendingEntities[0]
          : null;
        const descriptor = syncDebugSnapshot?.shellDescriptor && typeof syncDebugSnapshot.shellDescriptor === 'object'
          ? syncDebugSnapshot.shellDescriptor
          : shellDescriptor;
        const bootPhaseRaw = String(syncDebugSnapshot?.bootPhase || '').trim();
        const currentMeta = syncDebugSnapshot?.currentMeta && typeof syncDebugSnapshot.currentMeta === 'object'
          ? syncDebugSnapshot.currentMeta
          : {};
        const reasonRuntime = getSyncReasonRuntime();
        const reasonSurface = syncInspection?.reasonSurface && typeof syncInspection.reasonSurface === 'object'
          ? syncInspection.reasonSurface
          : (reasonRuntime && typeof reasonRuntime.buildSyncReasonSurface === 'function'
            ? reasonRuntime.buildSyncReasonSurface({
                receipt: snapshotReceipt || receiptMeta,
                descriptor,
                syncState: snapshotState,
                currentMeta,
                bootPhase: bootPhaseRaw,
                reason,
              })
            : null);
        const lastClientWriteAt = String(currentMeta.lastClientWriteAt || '').trim();
        const readSource = describeSyncReadSource(descriptor, syncMode);
        const startupSource = describeStartupSource(descriptor);
        const startupInspection = descriptor?.startupSourceInspection && typeof descriptor.startupSourceInspection === 'object'
          ? descriptor.startupSourceInspection
          : null;
        const authoritativeSource = String(startupInspection?.authoritativeSource || '').trim() || '-';
        const authoritativeRevision = Number(startupInspection?.authoritativeRevision || 0);
        const authoritativeHasUserData = startupInspection?.authoritativeHasUserData === true ? 'yes' : 'no';
        const authoritativeLastWriteAt = String(startupInspection?.authoritativeLastWriteAt || '').trim() || '-';
        const browserDirectoryCandidate = startupInspection?.selectedBrowserDirectory
          ? `${String(startupInspection?.browserDirectoryPathHint || '').trim() || '-'} | readable=${startupInspection?.browserDirectoryReadable === true ? 'yes' : 'no'} | writable=${startupInspection?.browserDirectoryWritable === true ? 'yes' : 'no'}`
          : '未选择浏览器目录';
        const startupSelectionReason = String(startupInspection?.selectionReason || '').trim() || '-';
        const buildFingerprint = resolveBuildFingerprint({
          descriptor,
          receiptMeta,
          snapshotReceipt,
          currentMeta,
        });
        const legacyBuildWarning = buildLegacyBuildWarning(buildFingerprint);
        if (syncSummaryEl) {
          syncSummaryEl.textContent = buildSyncUserSummary({
            descriptor,
            receiptMeta,
            snapshotReceipt,
            snapshotState,
            currentMeta,
            bootPhase: bootPhaseRaw,
          });
        }
        receiptEl.textContent = [
          `当前读源: ${readSource}`,
          `启动来源: ${startupSource}`,
          `启动权威快照: ${authoritativeSource} | rev=${authoritativeRevision} | hasUserData=${authoritativeHasUserData}`,
          `启动权威写入时间: ${authoritativeLastWriteAt}`,
          `浏览器目录候选: ${browserDirectoryCandidate}`,
          `启动判定: ${startupSelectionReason}`,
          `native appVersion: ${buildFingerprint.appVersion}`,
          `native buildTime: ${buildFingerprint.buildTime}`,
          `native binaryMTime: ${buildFingerprint.binaryMTime}`,
          `native binaryPath: ${buildFingerprint.binaryPath}`,
          `web build stamp: ${buildFingerprint.webBuildStamp}`,
          `构建告警: ${legacyBuildWarning || '-'}`,
          `启动阶段: ${describeBootPhase(bootPhaseRaw)}`,
          `补水状态: ${isBootHydrationPending(bootPhaseRaw) ? '补水中' : '已稳定'}`,
          `运行态新鲜度: ${formatFreshnessAge(lastClientWriteAt)}`,
          `回执新鲜度: ${formatFreshnessAge(receiptMeta?.lastReceiptAt || snapshotReceipt?.updatedAt || '')}`,
          `状态: ${describeSyncStatus(receiptMeta?.status || snapshotReceipt?.status || '')}`,
          `来源: ${source}`,
          `时间: ${updatedAt || '-'}`,
          `原因: ${reason}`,
          `原因归类: ${String(reasonSurface?.bucket || '-').trim() || '-'}`,
          `原因标签: ${String(reasonSurface?.label || '-').trim() || '-'}`,
          `解释: ${describeSyncReason(reason, snapshotReceipt || receiptMeta, { descriptor, snapshotState, currentMeta, bootPhase: bootPhaseRaw })}`,
          `回执通道: ${String(receiptMeta?.kind || '-').trim() || '-'}`,
          `已确认 revision: ${ackedRevision}`,
          `待确认写入数: ${pendingCount}`,
          `待确认域: ${pendingDomains}`,
          `最近合并 mutation: ${mergedMutation ? `${String(mergedMutation.mutationId || '').trim()} | ${String(mergedMutation.domain || mergedMutation.domains?.join(', ') || '').trim()}` : '-'}`,
          `最近拦截 mutation: ${blockedMutation ? `${String(blockedMutation.mutationId || '').trim()} | ${String(blockedMutation.detail || blockedMutation.label || '').trim()}` : '-'}`,
          `最近待确认实体: ${pendingEntity ? `${String(pendingEntity.domain || '').trim()} | ${String(pendingEntity.entityType || '').trim()} | ${String(pendingEntity.entityId || '').trim()} | ${String(pendingEntity.status || '').trim()}` : '-'}`,
          `回执时间线: ${timelineText}`,
          `冲突设备: ${conflict ? `${String(conflict.incomingDeviceId || '').trim()} -> ${String(conflict.currentDeviceId || '').trim()}` : '-'}`,
        ].join('\n');
      }

      const statusEl = document.getElementById('settings-sync-root-status');
      if (statusEl) {
        statusEl.textContent = settingsState.statusMessage || '';
        statusEl.classList.toggle('text-red-600', !!settingsState.statusMessage && settingsState.syncRootDeleteSafe === false);
        statusEl.classList.toggle('dark:text-red-400', !!settingsState.statusMessage && settingsState.syncRootDeleteSafe === false);
      }

      const lastSyncEl = document.getElementById('settings-last-sync-at');
      if (lastSyncEl) lastSyncEl.textContent = api.formatSettingsTime(api.storage.getLastSyncAt ? api.storage.getLastSyncAt() : '');
      const lastRestoreEl = document.getElementById('settings-last-restore-at');
      if (lastRestoreEl) lastRestoreEl.textContent = api.formatSettingsTime(api.storage.getLastRestoreAt ? api.storage.getLastRestoreAt() : '');

      const chooseBtn = document.getElementById('settings-choose-sync-root-btn');
      const openBtn = document.getElementById('settings-open-sync-root-btn');
      const reloadBtn = document.getElementById('settings-reload-from-user-data-btn');
      [chooseBtn, openBtn, reloadBtn].forEach((btn) => {
        if (!btn) return;
        /** @type {HTMLButtonElement} */ (btn).disabled = false;
        btn.classList.toggle('opacity-60', !settingsState.nativeBridge);
      });
    }

    return { syncSettingsSummaryUI };
  }

  window.MorphSettingsRenderRuntime = { create: createSettingsRenderRuntime };
})();
