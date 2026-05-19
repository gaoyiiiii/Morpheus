// @ts-check
(function initMorphSettingsConfigRuntime() {
  function createSettingsConfigRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function cloneJSONSafe(value) {
      if (typeof api.cloneJSONSafe === 'function') return api.cloneJSONSafe(value);
      try {
        return value == null ? value : JSON.parse(JSON.stringify(value));
      } catch (_) {
        return value;
      }
    }

    function getRootState() {
      if (typeof window === 'undefined') return null;
      const root = window.__MorphAppStateRuntimeState;
      return root && typeof root === 'object' ? root : null;
    }

    function buildDefaultGlucoseConfig() {
      return {
        email: '',
        hasPassword: false,
        targetLow: 70,
        targetHigh: 180,
        region: 'CN',
      };
    }

    function buildDefaultFeishuConfig() {
      return {
        enabled: false,
        appId: '',
        hasAppSecret: false,
        verificationToken: '',
        hasEncryptKey: false,
        botName: '',
        callbackPath: '/api/feishu/webhook',
        eventCount: 0,
        lastMessageAt: '',
        lastEventType: '',
      };
    }

    function buildDefaultSettingsConfigState() {
      return {
        glucoseConfig: buildDefaultGlucoseConfig(),
        feishuConfig: buildDefaultFeishuConfig(),
        secureVaultVolatile: {
          glucosePassword: '',
        },
        externalServiceSettingsVolatile: {
          glucoseConfigFull: null,
          feishuConfigFull: null,
        },
      };
    }

    function ensureSettingsConfigState() {
      const root = getRootState();
      if (!root) return buildDefaultSettingsConfigState();
      if (!root.settingsConfigState || typeof root.settingsConfigState !== 'object') {
        root.settingsConfigState = buildDefaultSettingsConfigState();
      }
      const state = root.settingsConfigState;
      const defaults = buildDefaultSettingsConfigState();
      if (!state.glucoseConfig || typeof state.glucoseConfig !== 'object') state.glucoseConfig = defaults.glucoseConfig;
      if (!state.feishuConfig || typeof state.feishuConfig !== 'object') state.feishuConfig = defaults.feishuConfig;
      if (!state.secureVaultVolatile || typeof state.secureVaultVolatile !== 'object') state.secureVaultVolatile = defaults.secureVaultVolatile;
      if (!state.externalServiceSettingsVolatile || typeof state.externalServiceSettingsVolatile !== 'object') {
        state.externalServiceSettingsVolatile = defaults.externalServiceSettingsVolatile;
      }
      return state;
    }

    function normalizeGlucoseRegion(raw = '') {
      if (typeof api.normalizeGlucoseRegion === 'function') return api.normalizeGlucoseRegion(raw);
      const key = String(raw || '').trim().toUpperCase();
      if (key === 'US' || key === 'EU' || key === 'CN') return key;
      return 'CN';
    }

    function sanitizeGlucoseExternalConfigSnapshot(raw = {}, fallback = null) {
      const base = fallback && typeof fallback === 'object' ? fallback : {};
      const src = raw && typeof raw === 'object' ? raw : {};
      const targetLowRaw = Number(src.targetLow ?? base.targetLow ?? 70);
      const targetHighRaw = Number(src.targetHigh ?? base.targetHigh ?? 180);
      const targetLow = Number.isFinite(targetLowRaw) ? Math.round(targetLowRaw) : 70;
      const targetHigh = Number.isFinite(targetHighRaw) ? Math.max(targetLow + 1, Math.round(targetHighRaw)) : Math.max(targetLow + 1, 180);
      return {
        email: String(src.email ?? base.email ?? '').trim(),
        password: String(src.password ?? base.password ?? '').trim(),
        targetLow,
        targetHigh,
        region: normalizeGlucoseRegion(src.region ?? base.region ?? 'CN'),
      };
    }

    function summarizeGlucoseExternalConfigSnapshot(raw = {}) {
      const safe = sanitizeGlucoseExternalConfigSnapshot(raw);
      return {
        email: safe.email,
        hasPassword: !!safe.password,
        targetLow: safe.targetLow,
        targetHigh: safe.targetHigh,
        region: safe.region,
      };
    }

    function sanitizeFeishuExternalConfigSnapshot(raw = {}, fallback = null) {
      const base = fallback && typeof fallback === 'object' ? fallback : {};
      const src = raw && typeof raw === 'object' ? raw : {};
      return {
        enabled: src.enabled === true || (src.enabled !== false && base.enabled === true),
        appId: String(src.appId ?? base.appId ?? '').trim(),
        appSecret: String(src.appSecret ?? base.appSecret ?? '').trim(),
        verificationToken: String(src.verificationToken ?? base.verificationToken ?? '').trim(),
        encryptKey: String(src.encryptKey ?? base.encryptKey ?? '').trim(),
        botName: String(src.botName ?? base.botName ?? '').trim(),
        callbackPath: String(src.callbackPath ?? base.callbackPath ?? '/api/feishu/webhook').trim() || '/api/feishu/webhook',
      };
    }

    function summarizeFeishuExternalConfigSnapshot(raw = {}) {
      const src = raw && typeof raw === 'object' ? raw : {};
      const safe = sanitizeFeishuExternalConfigSnapshot(src);
      return {
        enabled: safe.enabled === true,
        appId: safe.appId,
        hasAppSecret: !!safe.appSecret,
        verificationToken: safe.verificationToken,
        hasEncryptKey: !!safe.encryptKey,
        botName: safe.botName,
        callbackPath: safe.callbackPath,
        eventCount: Number.isFinite(Number(src.eventCount)) ? Number(src.eventCount) : 0,
        lastMessageAt: String(src.lastMessageAt || '').trim(),
        lastEventType: String(src.lastEventType || '').trim(),
      };
    }

    function getGlucoseConfigSummary() {
      const state = ensureSettingsConfigState();
      return state.glucoseConfig;
    }

    function setGlucoseConfigSummary(value) {
      const state = ensureSettingsConfigState();
      state.glucoseConfig = summarizeGlucoseExternalConfigSnapshot(value);
      return state.glucoseConfig;
    }

    function getFeishuConfigSummary() {
      const state = ensureSettingsConfigState();
      return state.feishuConfig;
    }

    function setFeishuConfigSummary(value) {
      const state = ensureSettingsConfigState();
      state.feishuConfig = summarizeFeishuExternalConfigSnapshot(value);
      return state.feishuConfig;
    }

    function getGlucosePasswordDraft() {
      const state = ensureSettingsConfigState();
      return String(state.secureVaultVolatile?.glucosePassword || '');
    }

    function setGlucosePasswordDraft(value) {
      const state = ensureSettingsConfigState();
      state.secureVaultVolatile.glucosePassword = String(value || '').trim();
      return state.secureVaultVolatile.glucosePassword;
    }

    function getGlucoseExternalConfigSnapshot() {
      const state = ensureSettingsConfigState();
      return cloneJSONSafe(state.externalServiceSettingsVolatile.glucoseConfigFull);
    }

    function setGlucoseExternalConfigSnapshot(value) {
      const state = ensureSettingsConfigState();
      state.externalServiceSettingsVolatile.glucoseConfigFull = sanitizeGlucoseExternalConfigSnapshot(value);
      return cloneJSONSafe(state.externalServiceSettingsVolatile.glucoseConfigFull);
    }

    function getFeishuExternalConfigSnapshot() {
      const state = ensureSettingsConfigState();
      return cloneJSONSafe(state.externalServiceSettingsVolatile.feishuConfigFull);
    }

    function setFeishuExternalConfigSnapshot(value) {
      const state = ensureSettingsConfigState();
      state.externalServiceSettingsVolatile.feishuConfigFull = sanitizeFeishuExternalConfigSnapshot(value);
      return cloneJSONSafe(state.externalServiceSettingsVolatile.feishuConfigFull);
    }

    function captureMorphActionTransactionGlucoseExternalConfig() {
      const state = ensureSettingsConfigState();
      const fallback = {
        email: String(state.glucoseConfig?.email || '').trim(),
        password: String(state.secureVaultVolatile?.glucosePassword || '').trim(),
        targetLow: Number(state.glucoseConfig?.targetLow || 70),
        targetHigh: Number(state.glucoseConfig?.targetHigh || 180),
        region: normalizeGlucoseRegion(state.glucoseConfig?.region || 'CN'),
      };
      const cached = state.externalServiceSettingsVolatile.glucoseConfigFull;
      return cloneJSONSafe(sanitizeGlucoseExternalConfigSnapshot(cached || fallback, fallback));
    }

    async function applyMorphActionTransactionGlucoseExternalConfig(snapshot = null) {
      const state = ensureSettingsConfigState();
      const safe = sanitizeGlucoseExternalConfigSnapshot(snapshot);
      if (!safe.email || !safe.password) return false;
      if (typeof api.isIOSNativeAppRuntime === 'function' && api.isIOSNativeAppRuntime()) {
        if (typeof api.storage?.callNativeDesktopControl !== 'function') return false;
        const iosRes = await api.storage.callNativeDesktopControl('saveGlucoseConfig', safe);
        const cfg = iosRes?.config || {};
        state.glucoseConfig = {
          email: String(cfg.email || safe.email).trim(),
          hasPassword: !!cfg.hasPassword || !!safe.password,
          targetLow: Number.isFinite(Number(cfg.targetLow)) ? Number(cfg.targetLow) : safe.targetLow,
          targetHigh: Number.isFinite(Number(cfg.targetHigh)) ? Number(cfg.targetHigh) : safe.targetHigh,
          region: normalizeGlucoseRegion(cfg.region || safe.region),
        };
      } else {
        const res = await api.fetchLocalApiWithFallback?.('/api/glucose/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(safe),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) return false;
        state.glucoseConfig = {
          email: safe.email,
          hasPassword: true,
          targetLow: safe.targetLow,
          targetHigh: safe.targetHigh,
          region: safe.region,
        };
      }
      state.secureVaultVolatile.glucosePassword = safe.password;
      state.externalServiceSettingsVolatile.glucoseConfigFull = cloneJSONSafe(safe);
      if (typeof api.getCurrentTab === 'function' && api.getCurrentTab() === 'settings' && typeof api.renderSettingsView === 'function') {
        api.renderSettingsView();
      }
      return true;
    }

    function captureMorphActionTransactionFeishuExternalConfig() {
      const state = ensureSettingsConfigState();
      const fallback = {
        enabled: state.feishuConfig?.enabled === true,
        appId: String(state.feishuConfig?.appId || '').trim(),
        appSecret: '',
        verificationToken: String(state.feishuConfig?.verificationToken || '').trim(),
        encryptKey: '',
        botName: String(state.feishuConfig?.botName || '').trim(),
        callbackPath: String(state.feishuConfig?.callbackPath || '/api/feishu/webhook').trim() || '/api/feishu/webhook',
      };
      const cached = state.externalServiceSettingsVolatile.feishuConfigFull;
      return cloneJSONSafe(sanitizeFeishuExternalConfigSnapshot(cached || fallback, fallback));
    }

    async function applyMorphActionTransactionFeishuExternalConfig(snapshot = null) {
      const state = ensureSettingsConfigState();
      const safe = sanitizeFeishuExternalConfigSnapshot(snapshot);
      const res = await api.fetchLocalApiWithFallback?.('/api/feishu/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safe),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) return false;
      state.feishuConfig = summarizeFeishuExternalConfigSnapshot(safe);
      state.externalServiceSettingsVolatile.feishuConfigFull = cloneJSONSafe(safe);
      if (typeof api.getCurrentTab === 'function' && api.getCurrentTab() === 'settings' && typeof api.renderSettingsView === 'function') {
        api.renderSettingsView();
      }
      return true;
    }

    function collectSensitiveSnapshotForVault({ accountName = '' } = {}) {
      const glucosePasswordInput = document.getElementById('settings-glucose-password-input');
      const currentPassword = String(glucosePasswordInput?.value || '').trim();
      if (currentPassword) setGlucosePasswordDraft(currentPassword);
      const state = ensureSettingsConfigState();
      return {
        version: 1,
        savedAt: new Date().toISOString(),
        accountName: String(accountName || '').trim(),
        ai: {
          provider: typeof api.getAIProvider === 'function' ? api.getAIProvider() : '',
          geminiApiKey: typeof api.getApiKey === 'function' ? api.getApiKey() : '',
          openRouterApiKey: typeof api.getOpenRouterApiKey === 'function' ? api.getOpenRouterApiKey() : '',
          glmApiKey: typeof api.getGLMApiKey === 'function' ? api.getGLMApiKey() : '',
          doubaoApiKey: typeof api.getDoubaoApiKey === 'function' ? api.getDoubaoApiKey() : '',
          qwenApiKey: typeof api.getQwenApiKey === 'function' ? api.getQwenApiKey() : '',
          kimiApiKey: typeof api.getKimiApiKey === 'function' ? api.getKimiApiKey() : '',
          codexApiKey: typeof api.getCodexApiKey === 'function' ? api.getCodexApiKey() : '',
          codexBaseUrl: typeof api.getCodexBaseUrl === 'function' ? api.getCodexBaseUrl() : '',
          codexModel: typeof api.getCodexModel === 'function' ? api.getCodexModel() : '',
        },
        glucose: {
          email: String(state.glucoseConfig?.email || '').trim(),
          password: String(state.secureVaultVolatile?.glucosePassword || '').trim(),
          targetLow: Number(state.glucoseConfig?.targetLow || 70),
          targetHigh: Number(state.glucoseConfig?.targetHigh || 180),
          region: normalizeGlucoseRegion(state.glucoseConfig?.region || 'CN'),
        },
      };
    }

    return {
      buildDefaultGlucoseConfig,
      buildDefaultFeishuConfig,
      buildDefaultSettingsConfigState,
      ensureSettingsConfigState,
      getSettingsConfigState: ensureSettingsConfigState,
      getGlucoseConfigSummary,
      setGlucoseConfigSummary,
      getFeishuConfigSummary,
      setFeishuConfigSummary,
      getGlucosePasswordDraft,
      setGlucosePasswordDraft,
      getGlucoseExternalConfigSnapshot,
      setGlucoseExternalConfigSnapshot,
      getFeishuExternalConfigSnapshot,
      setFeishuExternalConfigSnapshot,
      sanitizeGlucoseExternalConfigSnapshot,
      summarizeGlucoseExternalConfigSnapshot,
      sanitizeFeishuExternalConfigSnapshot,
      summarizeFeishuExternalConfigSnapshot,
      captureMorphActionTransactionGlucoseExternalConfig,
      applyMorphActionTransactionGlucoseExternalConfig,
      captureMorphActionTransactionFeishuExternalConfig,
      applyMorphActionTransactionFeishuExternalConfig,
      collectSensitiveSnapshotForVault,
    };
  }

  window.MorphSettingsConfigRuntime = {
    create: createSettingsConfigRuntime,
  };
})();
