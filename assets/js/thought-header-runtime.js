// @ts-check

(function initMorphThoughtHeaderRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphThoughtHeaderRuntime && typeof window.MorphThoughtHeaderRuntime.create === 'function') return;

  function createThoughtHeaderRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getDocumentRef() {
      if (typeof api.getDocumentRef === 'function') return api.getDocumentRef();
      if (typeof document !== 'undefined') return document;
      return null;
    }

    function getWindowRef() {
      if (typeof api.getWindowRef === 'function') return api.getWindowRef();
      if (typeof window !== 'undefined') return window;
      return null;
    }

    function getCurrentTab() {
      if (typeof api.getCurrentTab === 'function') {
        return String(api.getCurrentTab() || '').trim();
      }
      return '';
    }

    function getFlashThoughtsViewMode() {
      if (typeof api.getFlashThoughtsViewMode === 'function') {
        return String(api.getFlashThoughtsViewMode() || '').trim();
      }
      return 'cards';
    }

    function setFlashThoughtsViewModeState(value) {
      if (typeof api.setFlashThoughtsViewModeState === 'function') {
        api.setFlashThoughtsViewModeState(String(value || '').trim() || 'cards');
      }
    }

    function getFixedThoughtsViewMode() {
      if (typeof api.getFixedThoughtsViewMode === 'function') {
        return String(api.getFixedThoughtsViewMode() || '').trim();
      }
      return 'cards';
    }

    function setFixedThoughtsViewModeState(value) {
      if (typeof api.setFixedThoughtsViewModeState === 'function') {
        api.setFixedThoughtsViewModeState(String(value || '').trim() || 'cards');
      }
    }

    function getLastPrimaryThoughtsViewPane() {
      if (typeof api.getLastPrimaryThoughtsViewPane === 'function') {
        return String(api.getLastPrimaryThoughtsViewPane() || '').trim();
      }
      return 'flash';
    }

    function getActiveThoughtsViewPane() {
      if (typeof api.getActiveThoughtsViewPane === 'function') {
        return String(api.getActiveThoughtsViewPane() || '').trim();
      }
      return 'flash';
    }

    function setThoughtsViewPane(value) {
      if (typeof api.setThoughtsViewPane === 'function') {
        api.setThoughtsViewPane(value);
      }
    }

    function normalizeThoughtsViewMode(value) {
      if (typeof api.normalizeThoughtsViewMode === 'function') {
        return api.normalizeThoughtsViewMode(value);
      }
      const normalized = String(value || '').trim();
      if (normalized === 'orbs') return 'worms';
      return normalized === 'worms' ? 'worms' : 'cards';
    }

    function persistThoughtsViewMode(value) {
      if (typeof api.persistThoughtsViewMode === 'function') {
        api.persistThoughtsViewMode(value);
      }
    }

    function renderAll() {
      if (typeof api.renderAll === 'function') {
        api.renderAll();
      }
    }

    function resetThoughtGraphViewport() {
      if (typeof api.resetThoughtGraphViewport === 'function') {
        api.resetThoughtGraphViewport();
      }
    }

    function triggerThoughtGraphMotion(phase) {
      if (typeof api.triggerThoughtGraphMotion === 'function') {
        api.triggerThoughtGraphMotion(phase);
      }
    }

    function requestAnimationFrameRef(callback) {
      if (typeof api.requestAnimationFrameRef === 'function') {
        return api.requestAnimationFrameRef(callback);
      }
      const win = getWindowRef();
      if (win && typeof win.requestAnimationFrame === 'function') {
        return win.requestAnimationFrame(callback);
      }
      if (typeof callback === 'function') callback();
      return 0;
    }

    function requestLucideRefresh(options = {}) {
      if (typeof api.requestLucideRefresh === 'function') {
        api.requestLucideRefresh(options);
      }
    }

    function getActiveThoughtVisualMode() {
      if (getFlashThoughtsViewMode() === 'worms' || getFixedThoughtsViewMode() === 'worms') {
        return 'worms';
      }
      return 'cards';
    }

    function applyThoughtViewToggleState(mode = 'cards') {
      const doc = getDocumentRef();
      if (!doc) return;
      const cardsBtn = doc.getElementById('thought-view-cards');
      const wormsBtn = doc.getElementById('thought-view-worms');
      const applyState = (btn, active) => {
        if (!btn) return;
        btn.classList.toggle('active', active);
        btn.classList.toggle('bg-white', active);
        btn.classList.toggle('text-black', active);
        btn.classList.toggle('dark:bg-white/90', active);
        btn.classList.toggle('dark:text-black', active);
        btn.classList.toggle('shadow-sm', active);
        btn.classList.toggle('text-gray-500', !active);
        btn.classList.toggle('dark:text-white/50', !active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      };
      applyState(cardsBtn, mode === 'cards');
      applyState(wormsBtn, mode === 'worms');
    }

    function closeThoughtHeaderMenus() {
      const doc = getDocumentRef();
      if (!doc) return;
      ['thoughts-view-mode-menu', 'thoughts-archive-menu'].forEach((id) => {
        const menu = doc.getElementById(id);
        if (!menu) return;
        menu.classList.add('hidden');
        menu.classList.remove('active');
      });
    }

    function toggleThoughtHeaderMenu(menuId, anchorEl) {
      const doc = getDocumentRef();
      const win = getWindowRef();
      if (!doc || !win) return;
      const menu = doc.getElementById(menuId);
      if (!menu || !anchorEl) return;
      const shouldOpen = menu.classList.contains('hidden');
      closeThoughtHeaderMenus();
      if (!shouldOpen) return;
      const rect = anchorEl.getBoundingClientRect();
      menu.style.top = `${Math.round(rect.bottom + 8)}px`;
      menu.style.right = `${Math.max(10, Math.round(win.innerWidth - rect.right))}px`;
      menu.classList.remove('hidden');
      menu.classList.add('active');
    }

    function openThoughtArchivePane(option = 'all') {
      const target = String(option || 'all').trim() === 'archived'
        ? 'archived'
        : (['flash', 'fixed'].includes(getLastPrimaryThoughtsViewPane()) ? getLastPrimaryThoughtsViewPane() : 'flash');
      closeThoughtHeaderMenus();
      setThoughtsViewPane(target);
    }

    function renderThoughtViewSwitcher() {
      const doc = getDocumentRef();
      if (!doc) return;
      const wrap = doc.getElementById('thoughts-header-actions');
      const cardsBtn = doc.getElementById('thought-view-cards');
      const wormsBtn = doc.getElementById('thought-view-worms');
      const moreBtn = doc.getElementById('thoughts-more-btn');
      const menu = doc.getElementById('thoughts-view-mode-menu');
      const archiveMenu = doc.getElementById('thoughts-archive-menu');
      if (!wrap || !cardsBtn || !wormsBtn || !moreBtn || !menu || !archiveMenu) return;
      const active = getCurrentTab() === 'flashThoughts';
      wrap.classList.toggle('hidden', !active);
      if (!active) {
        closeThoughtHeaderMenus();
        return;
      }

      const mode = getActiveThoughtVisualMode();
      const activePane = getActiveThoughtsViewPane();
      applyThoughtViewToggleState(mode);
      cardsBtn.setAttribute('aria-label', mode === 'cards' ? '当前为卡片状态' : '切换到卡片状态');
      cardsBtn.title = '卡片状态';
      wormsBtn.setAttribute('aria-label', mode === 'worms' ? '当前为图谱状态' : '切换到图谱状态');
      wormsBtn.title = '图谱状态';
      moreBtn.setAttribute('aria-label', '更多');
      moreBtn.title = '更多';

      Array.from(menu.querySelectorAll('[data-thought-view-mode-option]')).forEach((btn) => {
        const option = String(btn.getAttribute('data-thought-view-mode-option') || '').trim();
        const isActive = option === mode;
        btn.classList.toggle('is-active', isActive);
      });
      Array.from(archiveMenu.querySelectorAll('[data-thought-archive-option]')).forEach((btn) => {
        const option = String(btn.getAttribute('data-thought-archive-option') || '').trim();
        const isActive = option === 'archived'
          ? activePane === 'archived'
          : activePane !== 'archived';
        btn.classList.toggle('is-active', isActive);
      });

      if (typeof cardsBtn.__thoughtModeHandler === 'function') {
        cardsBtn.removeEventListener('click', cardsBtn.__thoughtModeHandler);
      }
      cardsBtn.__thoughtModeHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeThoughtHeaderMenus();
        handleThoughtViewModeChange('cards');
      };
      cardsBtn.addEventListener('click', cardsBtn.__thoughtModeHandler);

      if (typeof wormsBtn.__thoughtModeHandler === 'function') {
        wormsBtn.removeEventListener('click', wormsBtn.__thoughtModeHandler);
      }
      wormsBtn.__thoughtModeHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeThoughtHeaderMenus();
        handleThoughtViewModeChange('worms');
      };
      wormsBtn.addEventListener('click', wormsBtn.__thoughtModeHandler);

      if (typeof moreBtn.__thoughtMoreHandler === 'function') {
        moreBtn.removeEventListener('click', moreBtn.__thoughtMoreHandler);
      }
      moreBtn.__thoughtMoreHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof api.openCustomModal === 'function') {
          api.openCustomModal({ title: '更多', desc: '这里暂时作为页面更多动作入口。' });
        }
      };
      moreBtn.addEventListener('click', moreBtn.__thoughtMoreHandler);

      requestLucideRefresh({ root: wrap });
      requestLucideRefresh({ root: menu });
      requestLucideRefresh({ root: archiveMenu });
    }

    function handleThoughtViewModeChange(mode) {
      const nextMode = normalizeThoughtsViewMode(mode);
      const previousMode = getActiveThoughtVisualMode();
      setFlashThoughtsViewMode(nextMode);
      setFixedThoughtsViewMode(nextMode);
      persistThoughtsViewMode(nextMode);
      if (getCurrentTab() === 'flashThoughts' && previousMode !== nextMode && nextMode === 'worms') {
        resetThoughtGraphViewport();
      }
      renderAll();
      if (getCurrentTab() === 'flashThoughts' && previousMode !== nextMode && nextMode === 'worms') {
        requestAnimationFrameRef(() => triggerThoughtGraphMotion('enter'));
      }
    }

    function setFlashThoughtsViewMode(mode) {
      const nextMode = normalizeThoughtsViewMode(mode);
      setFlashThoughtsViewModeState(nextMode);
      persistThoughtsViewMode(nextMode);
      if (getCurrentTab() === 'flashThoughts' && getActiveThoughtsViewPane() !== 'archived') {
        applyThoughtViewToggleState(nextMode);
      }
    }

    function setFixedThoughtsViewMode(mode) {
      const nextMode = normalizeThoughtsViewMode(mode);
      setFixedThoughtsViewModeState(nextMode);
      persistThoughtsViewMode(nextMode);
      if (getCurrentTab() === 'flashThoughts' && getActiveThoughtsViewPane() !== 'archived') {
        applyThoughtViewToggleState(nextMode);
      }
    }

    return {
      applyThoughtViewToggleState,
      closeThoughtHeaderMenus,
      toggleThoughtHeaderMenu,
      openThoughtArchivePane,
      renderThoughtViewSwitcher,
      handleThoughtViewModeChange,
      setFlashThoughtsViewMode,
      setFixedThoughtsViewMode,
    };
  }

  window.MorphThoughtHeaderRuntime = {
    create: createThoughtHeaderRuntime,
  };
})();
