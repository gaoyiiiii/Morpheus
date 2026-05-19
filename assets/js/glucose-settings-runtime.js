// @ts-check
(function initMorphGlucoseSettingsRuntime() {
  function createGlucoseSettingsRuntime(deps = {}) {
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

    function normalizeStatusText(status = '') {
      const key = String(status || '').trim();
      if (key === 'ok' || key === 'ready') return '可用';
      if (key === 'disabled') return '未配置';
      if (key === 'missing_dependency') return '缺少依赖';
      if (key === 'error') return '读取异常';
      if (!key) return '未知';
      return key;
    }

    function syncModalUI() {
      const modal = document.getElementById('settings-glucose-modal');
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
      const summary = document.getElementById('settings-glucose-status-summary');
      if (summary) {
        const config = settingsState.glucoseConfig || {};
        const emailReady = String(config.email || '').trim() ? '邮箱已配置' : '还没填账号';
        const passwordReady = config.hasPassword ? '密码已保存' : '还没保存密码';
        const rangeText = typeof api.formatGlucoseTargetRangeMmol === 'function'
          ? api.formatGlucoseTargetRangeMmol(config.targetLow || 70, config.targetHigh || 180)
          : `${config.targetLow || 70}-${config.targetHigh || 180}`;
        summary.textContent = `${emailReady}，${passwordReady}。目标区间当前是 ${rangeText}，保存后会立刻用于健康页和血糖上下文。`;
      }
    }

    function openModal() {
      if (typeof api.setModalOpen === 'function') api.setModalOpen(true);
      syncModalUI();
      rerender();
      const emailInput = document.getElementById('settings-glucose-email-input');
      if (emailInput) {
        requestAnimationFrame(() => {
          try { emailInput.focus(); } catch (_) {}
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
      if (typeof api.isIOSNativeAppRuntime === 'function' && api.isIOSNativeAppRuntime()) {
        try {
          const res = await api.storage?.callNativeDesktopControl?.('getGlucoseConfig');
          const cfg = res?.config || {};
          settingsState.glucoseConfig = {
            email: String(cfg.email || ''),
            hasPassword: !!cfg.hasPassword,
            targetLow: Number.isFinite(Number(cfg.targetLow)) ? Number(cfg.targetLow) : 70,
            targetHigh: Number.isFinite(Number(cfg.targetHigh)) ? Number(cfg.targetHigh) : 180,
            region: typeof api.normalizeGlucoseRegion === 'function' ? api.normalizeGlucoseRegion(cfg.region) : String(cfg.region || 'CN'),
          };
          settingsState.glucoseConfigLoaded = true;
          if (typeof api.maybeAutoEnableExtensionsFromExistingState === 'function') api.maybeAutoEnableExtensionsFromExistingState();
          if (!silent && typeof api.setFeedback === 'function') api.setFeedback('已加载 iOS LibreLink 配置', false);
          else rerender();
          return true;
        } catch (error) {
          settingsState.glucoseConfigLoaded = true;
          if (!silent && typeof api.setFeedback === 'function') {
            api.setFeedback(`加载失败：${String(error?.message || '未知错误')}`, true);
          }
          return false;
        }
      }

      try {
        const res = await api.fetchLocalApiWithFallback?.(`/api/glucose/config?t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!json?.ok) throw new Error(json?.error || '加载失败');
        const cfg = json.config || {};
        settingsState.glucoseConfig = {
          email: String(cfg.email || ''),
          hasPassword: !!cfg.hasPassword,
          targetLow: Number.isFinite(Number(cfg.targetLow)) ? Number(cfg.targetLow) : 70,
          targetHigh: Number.isFinite(Number(cfg.targetHigh)) ? Number(cfg.targetHigh) : 180,
          region: typeof api.normalizeGlucoseRegion === 'function' ? api.normalizeGlucoseRegion(cfg.region) : String(cfg.region || 'CN'),
        };
        settingsState.glucoseConfigLoaded = true;
        if (typeof api.maybeAutoEnableExtensionsFromExistingState === 'function') api.maybeAutoEnableExtensionsFromExistingState();
        if (!silent && typeof api.setFeedback === 'function') {
          api.setFeedback(`已加载（状态：${normalizeStatusText(json.status)}）`, false);
        } else {
          rerender();
        }
        return true;
      } catch (error) {
        settingsState.glucoseConfigLoaded = true;
        if (!silent && typeof api.setFeedback === 'function') {
          const msg = String(error?.message || '未知错误');
          const hint = /load failed|fetch|failed to fetch|network/i.test(msg)
            ? '无法连接本地服务，请确认 Morpheus 服务已启动（npm start）'
            : msg;
          api.setFeedback(`加载失败：${hint}`, true);
        }
        return false;
      }
    }

    async function saveConfig() {
      const settingsState = getSettingsState();
      const emailInput = document.getElementById('settings-glucose-email-input');
      const passwordInput = document.getElementById('settings-glucose-password-input');
      const lowInput = document.getElementById('settings-glucose-target-low-input');
      const highInput = document.getElementById('settings-glucose-target-high-input');
      const regionInput = document.getElementById('settings-glucose-region-input');
      if (!emailInput || !passwordInput || !lowInput || !highInput || !regionInput) return;

      const email = String(emailInput.value || '').trim();
      const password = String(passwordInput.value || '').trim();
      const targetLow = Math.round(Number(lowInput.value || settingsState.glucoseConfig.targetLow || 70));
      const targetHigh = Math.round(Number(highInput.value || settingsState.glucoseConfig.targetHigh || 180));
      const region = typeof api.normalizeGlucoseRegion === 'function'
        ? api.normalizeGlucoseRegion(regionInput.value || settingsState.glucoseConfig.region || 'CN')
        : String(regionInput.value || settingsState.glucoseConfig.region || 'CN');

      if (!email) {
        api.setFeedback?.('请输入 LibreLink 邮箱', true);
        return;
      }
      if (!password && !settingsState.glucoseConfig.hasPassword) {
        api.setFeedback?.('请输入 LibreLink 密码', true);
        return;
      }
      if (!Number.isFinite(targetLow) || !Number.isFinite(targetHigh) || targetLow >= targetHigh) {
        api.setFeedback?.('目标区间无效（下限必须小于上限）', true);
        return;
      }

      try {
        api.setFeedback?.('正在保存...', false);
        if (typeof api.isIOSNativeAppRuntime === 'function' && api.isIOSNativeAppRuntime()) {
          const iosRes = await api.storage?.callNativeDesktopControl?.('saveGlucoseConfig', {
            email,
            password,
            targetLow,
            targetHigh,
            region,
          });
          const cfg = iosRes?.config || {};
          settingsState.glucoseConfig = {
            email: String(cfg.email || email),
            hasPassword: !!cfg.hasPassword || !!password,
            targetLow: Number.isFinite(Number(cfg.targetLow)) ? Number(cfg.targetLow) : targetLow,
            targetHigh: Number.isFinite(Number(cfg.targetHigh)) ? Number(cfg.targetHigh) : targetHigh,
            region: typeof api.normalizeGlucoseRegion === 'function' ? api.normalizeGlucoseRegion(cfg.region || region) : region,
          };
          if (passwordInput) passwordInput.value = '';
          api.setExtensionEnabled?.('glucose', true, { silent: true });
          api.setFeedback?.('已保存 iOS LibreLink 配置', false);
          closeModal();
          return;
        }

        const res = await api.fetchLocalApiWithFallback?.('/api/glucose/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, targetLow, targetHigh, region }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

        settingsState.glucoseConfig = { email, hasPassword: true, targetLow, targetHigh, region };
        if (password) {
          const volatile = typeof api.getSecureVaultVolatile === 'function' ? api.getSecureVaultVolatile() : null;
          if (volatile && typeof volatile === 'object') volatile.glucosePassword = password;
        }
        if (passwordInput) passwordInput.value = '';
        api.clearGlucoseContextCache?.();
        api.setExtensionEnabled?.('glucose', true, { silent: true });
        api.setFeedback?.('已保存 LibreLink 账号', false);
        await loadConfig({ silent: true });
        closeModal();
      } catch (error) {
        const msg = String(error?.message || '未知错误');
        const hint = /load failed|fetch|failed to fetch|network/i.test(msg)
          ? '无法连接本地服务，请确认 Morpheus 服务已启动（npm start）'
          : msg;
        api.setFeedback?.(`保存失败：${hint}`, true);
      }
    }

    return {
      syncModalUI,
      openModal,
      closeModal,
      normalizeStatusText,
      loadConfig,
      saveConfig,
    };
  }

  window.MorphGlucoseSettingsRuntime = {
    create: createGlucoseSettingsRuntime,
  };
})();
