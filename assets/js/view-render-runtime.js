(function initMorphViewRenderRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphViewRenderRuntime && typeof window.MorphViewRenderRuntime.create === 'function') return;

  function createViewRenderRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const getCurrentTab = typeof api.getCurrentTab === 'function' ? api.getCurrentTab : () => 'flashThoughts';
    const getRenderMinGapMs = typeof api.getRenderMinGapMs === 'function' ? api.getRenderMinGapMs : () => 0;
    const performRenderAll = typeof api.performRenderAll === 'function' ? api.performRenderAll : () => {};
    const performRenderAIChatView = typeof api.performRenderAIChatView === 'function' ? api.performRenderAIChatView : () => {};

    let renderQueued = false;
    let pendingFollowUpRender = false;
    let renderThrottleTimer = null;
    let lastRenderAt = 0;
    let aiChatRenderQueued = false;

    function queueRenderFrame() {
      if (renderQueued) {
        pendingFollowUpRender = true;
        return;
      }
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        lastRenderAt = Date.now();
        performRenderAll();
        if (pendingFollowUpRender) {
          pendingFollowUpRender = false;
          requestRenderAll();
        }
      });
    }

    function requestRenderAll() {
      const now = Date.now();
      const minGapMs = Math.max(0, Number(getRenderMinGapMs()) || 0);
      const gap = now - lastRenderAt;
      if (gap < minGapMs) {
        clearTimeout(renderThrottleTimer);
        renderThrottleTimer = setTimeout(() => {
          renderThrottleTimer = null;
          requestRenderAll();
        }, Math.max(0, minGapMs - gap));
        return;
      }
      queueRenderFrame();
    }

    function requestAIChatRender() {
      if (aiChatRenderQueued) return;
      aiChatRenderQueued = true;
      requestAnimationFrame(() => {
        aiChatRenderQueued = false;
        if (String(getCurrentTab() || '').trim() === 'ai') {
          performRenderAIChatView();
        }
      });
    }

    function renderAll(renderOpts = {}) {
      return performRenderAll(renderOpts);
    }

    function renderAIChatView() {
      return performRenderAIChatView();
    }

    return {
      requestRenderAll,
      requestAIChatRender,
      renderAll,
      renderAIChatView,
    };
  }

  window.MorphViewRenderRuntime = {
    create: createViewRenderRuntime,
  };
})();
