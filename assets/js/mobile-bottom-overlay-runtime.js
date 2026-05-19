// @ts-check

(function initMorphMobileBottomOverlayRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphMobileBottomOverlayRuntime && typeof window.MorphMobileBottomOverlayRuntime.create === 'function') return;

  function createMobileBottomOverlayRuntime(deps = {}) {
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

    function isMobileBottomInputMode() {
      if (typeof api.isMobileBottomInputMode === 'function') {
        return api.isMobileBottomInputMode() === true;
      }
      return false;
    }

    function getMobileKeyboardInsetPx() {
      const win = getWindowRef();
      if (!isMobileNavMode() || !win) return 0;
      const vv = win.visualViewport;
      if (!vv) return 0;
      const inset = Math.max(0, win.innerHeight - (vv.height + vv.offsetTop));
      return inset > 80 ? Math.round(inset) : 0;
    }

    function getMobileKeyboardFollowInsetPx() {
      const doc = getDocumentRef();
      const inset = getMobileKeyboardInsetPx();
      if (!inset || !doc) return 0;
      const iosNativeCompensation = doc.documentElement?.classList?.contains?.('ios-native-app') ? 46 : 0;
      return Math.max(0, inset - iosNativeCompensation);
    }

    function shouldTrackMobileKeyboard() {
      const doc = getDocumentRef();
      if (!doc) return false;
      if (!isMobileNavMode() || !isMobileBottomInputMode()) return false;
      const active = doc.activeElement;
      return !!(active && (active.id === 'mobile-detail-input' || active.closest?.('#mobile-bottom-nav-input-shell')));
    }

    function getMobileBottomTrackedOffset() {
      if (!shouldTrackMobileKeyboard()) {
        return 'calc(env(safe-area-inset-bottom, 0px) + 0.2rem)';
      }
      const keyboardInset = getMobileKeyboardFollowInsetPx();
      if (!keyboardInset) {
        return 'calc(env(safe-area-inset-bottom, 0px) + 0.2rem)';
      }
      return `${Math.max(0, keyboardInset)}px`;
    }

    function syncMobileBottomOverlayClearance() {
      const doc = getDocumentRef();
      if (!doc) return;
      const root = doc.documentElement;
      if (!root) return;
      if (!isMobileNavMode()) {
        root.style.removeProperty('--mobile-bottom-overlay-clearance');
        root.style.removeProperty('--mobile-bottom-overlay-scroll-padding');
        return;
      }
      const nav = doc.getElementById('mobile-bottom-nav');
      const quickBtn = doc.getElementById('mobile-quick-compose-btn');
      const navVisible = !!(nav && !nav.classList.contains('hidden') && nav.style.display !== 'none');
      const quickVisible = !!(quickBtn && !quickBtn.classList.contains('hidden') && quickBtn.style.display !== 'none');
      if (!navVisible && !quickVisible) {
        root.style.setProperty('--mobile-bottom-overlay-clearance', 'calc(env(safe-area-inset-bottom, 0px) + 0px)');
        root.style.setProperty('--mobile-bottom-overlay-scroll-padding', 'calc(env(safe-area-inset-bottom, 0px) + 0px)');
        return;
      }
      const navHeight = navVisible ? Math.max(56, Math.ceil(nav.getBoundingClientRect().height || 56)) : 0;
      const quickHeight = quickVisible ? Math.max(56, Math.ceil(quickBtn.getBoundingClientRect().height || 56)) : 0;
      const overlayBase = Math.max(navHeight, quickHeight, 0);
      const keyboardInset = getMobileKeyboardFollowInsetPx();
      const trackedLift = shouldTrackMobileKeyboard() ? keyboardInset : 0;
      const clearance = Math.max(overlayBase * 3, 168) + trackedLift;
      const scrollPadding = Math.max(overlayBase * 2, 112) + trackedLift;
      root.style.setProperty('--mobile-bottom-overlay-clearance', `calc(env(safe-area-inset-bottom, 0px) + ${clearance}px)`);
      root.style.setProperty('--mobile-bottom-overlay-scroll-padding', `calc(env(safe-area-inset-bottom, 0px) + ${scrollPadding}px)`);
    }

    return {
      getMobileKeyboardInsetPx,
      getMobileKeyboardFollowInsetPx,
      shouldTrackMobileKeyboard,
      getMobileBottomTrackedOffset,
      syncMobileBottomOverlayClearance,
    };
  }

  window.MorphMobileBottomOverlayRuntime = {
    create: createMobileBottomOverlayRuntime,
  };
})();
