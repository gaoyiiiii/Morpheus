// @ts-check

(function initMorphProjectOrbitPanelRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphProjectOrbitPanelRuntime && typeof window.MorphProjectOrbitPanelRuntime.create === 'function') return;

  function createProjectOrbitPanelRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getDocumentRef() {
      if (typeof api.getDocumentRef === 'function') return api.getDocumentRef();
      if (typeof document !== 'undefined') return document;
      return null;
    }

    function getLocalStorageRef() {
      if (typeof api.getLocalStorageRef === 'function') return api.getLocalStorageRef();
      if (typeof localStorage !== 'undefined') return localStorage;
      return null;
    }

    function isMobileNavMode() {
      if (typeof api.isMobileNavMode === 'function') return api.isMobileNavMode() === true;
      return false;
    }

    function getMobileProjectOrbitPanelOpen() {
      if (typeof api.getMobileProjectOrbitPanelOpen === 'function') {
        return api.getMobileProjectOrbitPanelOpen() === true;
      }
      return false;
    }

    function setMobileProjectOrbitPanelOpen(value) {
      if (typeof api.setMobileProjectOrbitPanelOpen === 'function') {
        api.setMobileProjectOrbitPanelOpen(value === true);
      }
    }

    function getDesktopProjectOrbitCollapsed() {
      if (typeof api.getDesktopProjectOrbitCollapsed === 'function') {
        return api.getDesktopProjectOrbitCollapsed() === true;
      }
      return false;
    }

    function setDesktopProjectOrbitCollapsed(value) {
      if (typeof api.setDesktopProjectOrbitCollapsed === 'function') {
        api.setDesktopProjectOrbitCollapsed(value === true);
      }
    }

    function getCurrentTab() {
      if (typeof api.getCurrentTab === 'function') {
        return String(api.getCurrentTab() || '').trim();
      }
      return '';
    }

    function getActiveContextId() {
      if (typeof api.getActiveContextId === 'function') {
        return String(api.getActiveContextId() || '').trim();
      }
      return '';
    }

    function syncMobileBottomNavState() {
      if (typeof api.syncMobileBottomNavState === 'function') {
        api.syncMobileBottomNavState();
      }
    }

    function syncMobileQuickComposeButton() {
      if (typeof api.syncMobileQuickComposeButton === 'function') {
        api.syncMobileQuickComposeButton();
      }
    }

    function applyProjectOrbitMobilePanelState() {
      const doc = getDocumentRef();
      if (!doc) return;
      const panel = doc.getElementById('project-tree-panel');
      const btn = doc.getElementById('project-tree-toggle-btn');
      if (!panel) return;
      const hidden = getDesktopProjectOrbitCollapsed();
      panel.classList.toggle('hidden', hidden);
      panel.classList.toggle('flex', !hidden);
      if (btn) {
        btn.setAttribute?.('aria-pressed', hidden ? 'false' : 'true');
      }
    }

    function toggleProjectOrbitMobilePanel(forceOpen = null) {
      const current = getDesktopProjectOrbitCollapsed();
      const nextHidden = typeof forceOpen === 'boolean' ? !forceOpen : !current;
      setDesktopProjectOrbitCollapsed(nextHidden);
      const localStorageRef = getLocalStorageRef();
      if (localStorageRef && typeof localStorageRef.setItem === 'function') {
        try {
          localStorageRef.setItem('morph_project_tree_panel_hidden', nextHidden ? '1' : '0');
        } catch (_) {}
      }
      applyProjectOrbitMobilePanelState();
    }

    function applyDesktopProjectOrbitPanelState() {
      applyProjectOrbitMobilePanelState();
    }

    function toggleDesktopProjectOrbitPanel() {
      toggleProjectOrbitMobilePanel();
    }

    function handleDesktopProjectOrbitHeaderClick(event) {
      if (event?.target?.closest?.('button')) return;
      toggleProjectOrbitMobilePanel();
    }

    function toggleProjectOrbitPanel() {
      toggleProjectOrbitMobilePanel();
    }

    function handleProjectOrbitIconClick(event) {
      if (event) {
        event.preventDefault?.();
        event.stopPropagation?.();
      }
      toggleProjectOrbitMobilePanel();
    }

    return {
      applyProjectOrbitMobilePanelState,
      toggleProjectOrbitMobilePanel,
      applyDesktopProjectOrbitPanelState,
      toggleDesktopProjectOrbitPanel,
      handleDesktopProjectOrbitHeaderClick,
      toggleProjectOrbitPanel,
      handleProjectOrbitIconClick,
    };
  }

  window.MorphProjectOrbitPanelRuntime = {
    create: createProjectOrbitPanelRuntime,
  };
})();
