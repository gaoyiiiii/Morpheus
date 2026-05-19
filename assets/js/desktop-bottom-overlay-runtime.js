// @ts-check

(function initMorphDesktopBottomOverlayRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphDesktopBottomOverlayRuntime && typeof window.MorphDesktopBottomOverlayRuntime.create === 'function') return;

  function createDesktopBottomOverlayRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getWindowRef() {
      if (typeof api.getWindowRef === 'function') return api.getWindowRef();
      if (typeof window !== 'undefined') return window;
      return null;
    }

    function getDocumentRef() {
      if (typeof api.getDocumentRef === 'function') return api.getDocumentRef();
      if (typeof document !== 'undefined') return document;
      return null;
    }

    function isMobileNavMode() {
      if (typeof api.isMobileNavMode === 'function') {
        return api.isMobileNavMode() === true;
      }
      return false;
    }

    function isElementActuallyVisible(el) {
      return !!(el
        && !el.classList.contains('hidden')
        && el.style.display !== 'none'
        && el.getBoundingClientRect().width > 0
        && el.getBoundingClientRect().height > 0);
    }

    function syncDesktopBottomOverlayClearance() {
      const doc = getDocumentRef();
      const win = getWindowRef();
      if (!doc || !win) return;
      const root = doc.documentElement;
      if (!root) return;
      if (isMobileNavMode()) {
        root.style.removeProperty('--desktop-bottom-overlay-clearance');
        root.style.removeProperty('--desktop-bottom-overlay-scroll-padding');
        return;
      }
      const omniWrap = doc.getElementById('omni-bar-wrap');
      const syncStatus = doc.getElementById('sync-status');
      const omniVisible = isElementActuallyVisible(omniWrap);
      const syncVisible = isElementActuallyVisible(syncStatus);
      const omniBottomGap = omniVisible ? Math.max(0, win.innerHeight - omniWrap.getBoundingClientRect().top) : 0;
      const syncBottomGap = syncVisible ? Math.max(0, win.innerHeight - syncStatus.getBoundingClientRect().top) : 0;
      const overlayHeight = Math.max(omniBottomGap, syncBottomGap, 0);
      const clearance = overlayHeight > 0 ? Math.max(overlayHeight + 8, 76) : 0;
      const scrollPadding = clearance > 0 ? Math.max(clearance - 12, 64) : 0;
      root.style.setProperty('--desktop-bottom-overlay-clearance', `${clearance}px`);
      root.style.setProperty('--desktop-bottom-overlay-scroll-padding', `${scrollPadding}px`);
    }

    return {
      isElementActuallyVisible,
      syncDesktopBottomOverlayClearance,
    };
  }

  window.MorphDesktopBottomOverlayRuntime = {
    create: createDesktopBottomOverlayRuntime,
  };
})();
