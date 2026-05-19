(function () {
  const deps = window.MorphThoughtGraphDeps || null;
  if (!deps || !deps.PIXI || !deps.d3Force) {
    window.MorphThoughtGraphRuntime = {
      mount() {},
      unmount() {},
      update() {},
      isActive() { return false; },
      resetViewport() {},
    };
    return;
  }

  const { PIXI, d3Force } = deps;
  const DEFAULT_VIEWPORT_SCALE = 2;
  const MIN_SCALE = 0.18;
  const MAX_SCALE = 6.4;
  const PAN_VELOCITY_EPSILON = 0.015;
  const SCALE_VELOCITY_EPSILON = 0.0006;
  const PAN_INERTIA_DAMPING = 0.9;
  const PAN_SETTLE_EASING = 0.74;
  const SCALE_INERTIA_DAMPING = 0.9;
  const SCALE_SETTLE_EASING = 0.72;
  const RUBBER_BAND_FACTOR = 0.14;
  const WHEEL_SETTLE_DELAY_MS = 88;
  const SCALE_MOMENTUM_GAIN = 0.92;
  const SCALE_MOMENTUM_BLEND = 0.68;
  const SCALE_MOMENTUM_LIMIT = 0.26;
  const WORM_HOVER_NEIGHBOR_RADIUS = 214;
  const WORM_HOVER_SAME_WORM_RADIUS = 324;
  const WORM_HOVER_NEIGHBOR_SPREAD = 13.6;
  const WORM_HOVER_SAME_WORM_SPREAD = 30.4;
  const WORM_HOVER_WIGGLE_MIN_LENGTH = 4;
  const WORM_HOVER_WIGGLE_BASE = 5.2;
  const WORM_HOVER_WIGGLE_GAIN = 0.44;
  const WORM_HOVER_RETURN_EASING = 0.12;
  const WORM_HOVER_ACTIVE_EASING = 0.27;
  const FOCUS_IMPULSE_DURATION_MS = 860;
  const FOCUS_IMPULSE_RADIUS = 680;
  const FOCUS_IMPULSE_SPREAD_FOCUSED = 0;
  const FOCUS_IMPULSE_SPREAD_PERIPHERAL = 48;
  const PREVIEW_CENTERING_DURATION_MS = 720;
  const PREVIEW_CENTERING_RADIUS = 1200;

  const state = {
    host: null,
    app: null,
    canvas: null,
    viewport: null,
    world: null,
    background: null,
    nodesLayer: null,
    labelsLayer: null,
    payload: null,
    simulation: null,
    nodeViews: new Map(),
    nodeModels: [],
    edgeModels: [],
    positionCache: new Map(),
    scale: DEFAULT_VIEWPORT_SCALE,
    scaleTarget: DEFAULT_VIEWPORT_SCALE,
    scaleVelocity: 0,
    scaleAnimRaf: 0,
    panX: 0,
    panY: 0,
    panTargetX: 0,
    panTargetY: 0,
    panVelocityX: 0,
    panVelocityY: 0,
    resizing: false,
    active: false,
    hoveredGroupKey: '',
    hoveredNodeId: '',
    previewNodeId: '',
    dropTargetNodeId: '',
    pointer: null,
    touches: new Map(),
    pinch: null,
    longPressTimer: 0,
    longPressStart: null,
    longPressNodeId: '',
    longPressHandled: false,
    rafId: 0,
    hoverRafId: 0,
    lastFrameAt: 0,
    layoutKey: '',
    focusImpulse: null,
    resizeObserver: null,
    viewportAnchorClientX: 0,
    viewportAnchorClientY: 0,
    wheelSettleTimer: 0,
    touchHandlers: null,
    pendingAppInit: null,
    mountRequestId: 0,
    mountCount: 0,
    destroyCount: 0,
    lastMountAt: 0,
    lastDestroyAt: 0,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function shortText(input, maxChars = 10) {
    const text = String(input || '').trim();
    if (!text) return '';
    const chars = Array.from(text);
    if (chars.length <= maxChars) return text;
    return `${chars.slice(0, Math.max(1, maxChars - 1)).join('')}…`;
  }

  function hashString(input = '') {
    const text = String(input || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function colorFromRgba(input, fallback = 0x555555) {
    const match = String(input || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return fallback;
    return (Number(match[1]) << 16) + (Number(match[2]) << 8) + Number(match[3]);
  }

  function hslToColorInt(h = 0, s = 0, l = 0) {
    const hue = ((Number(h) % 360) + 360) % 360;
    const sat = clamp(Number(s) || 0, 0, 100) / 100;
    const lig = clamp(Number(l) || 0, 0, 100) / 100;
    const c = (1 - Math.abs((2 * lig) - 1)) * sat;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = lig - (c / 2);
    let r = 0; let g = 0; let b = 0;
    if (hue < 60) { r = c; g = x; b = 0; }
    else if (hue < 120) { r = x; g = c; b = 0; }
    else if (hue < 180) { r = 0; g = c; b = x; }
    else if (hue < 240) { r = 0; g = x; b = c; }
    else if (hue < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const rr = Math.round((r + m) * 255);
    const gg = Math.round((g + m) * 255);
    const bb = Math.round((b + m) * 255);
    return (rr << 16) + (gg << 8) + bb;
  }

  function getWormCoreColor(node) {
    const role = String(node?.wormRole || '').trim();
    const norm = clamp(Number(node?.timeNorm) || 0, 0, 1);
    if (role === 'seed') {
      const seedChannel = isDarkMode() ? 214 : 92;
      return (seedChannel << 16) + (seedChannel << 8) + seedChannel;
    }
    if (role === 'turn') {
      const darkWarm = isDarkMode() ? 122 : 150;
      const lightWarm = isDarkMode() ? 172 : 178;
      const channel = Math.round(darkWarm + ((lightWarm - darkWarm) * norm));
      return (channel << 16) + (channel << 8) + channel;
    }
    // 主题灰阶：时间越后越亮。
    const darkGray = isDarkMode() ? 66 : 82;
    const lightGray = isDarkMode() ? 232 : 205;
    const channel = Math.round(darkGray + ((lightGray - darkGray) * norm));
    return (channel << 16) + (channel << 8) + channel;
  }

  function alphaFromRgba(input, fallback = 0.18) {
    const match = String(input || '').match(/rgba?\(\d+,\s*\d+,\s*\d+,\s*([0-9.]+)\)/i);
    return match ? Number(match[1]) : fallback;
  }

  function isDarkMode() {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  }

  function nodeRadius(kind, totalCount = 0) {
    const isFixed = String(kind || '').trim().toLowerCase().includes('fixed');
    const flashRadius = totalCount <= 10 ? 11 : totalCount <= 24 ? 10 : totalCount <= 48 ? 9 : 8;
    return isFixed ? flashRadius * 3 : flashRadius;
  }

  function nodeFontSize(totalCount = 0) {
    if (totalCount <= 10) return 14;
    if (totalCount <= 24) return 12;
    if (totalCount <= 48) return 11;
    return 10;
  }

  function getViewportCenter() {
    const width = state.host?.clientWidth || 0;
    const height = state.host?.clientHeight || 0;
    return { x: width / 2, y: height / 2 };
  }

  function getDeviceResolution() {
    if (typeof window === 'undefined') return 1;
    const ratio = Math.max(1, Number(window.devicePixelRatio) || 1);
    const isCompactPointer = typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    const nodeCount = Math.max(
      Number(state.payload?.nodes?.length) || 0,
      Number(state.nodeModels?.length) || 0,
    );
    const hostWidth = Math.max(0, Number(state.host?.clientWidth) || 0);
    const hostHeight = Math.max(0, Number(state.host?.clientHeight) || 0);
    const hostArea = hostWidth * hostHeight;
    let cap = isCompactPointer ? 1.35 : 2;
    if (nodeCount >= 120 || hostArea >= 4_500_000) {
      cap = isCompactPointer ? 1.12 : 1.45;
    } else if (nodeCount >= 72 || hostArea >= 3_000_000) {
      cap = isCompactPointer ? 1.2 : 1.62;
    } else if (nodeCount >= 40 || hostArea >= 2_000_000) {
      cap = isCompactPointer ? 1.28 : 1.82;
    }
    return Math.max(1, Math.min(cap, ratio));
  }

  function applyViewport() {
    if (!state.world) return;
    const center = getViewportCenter();
    state.world.position.set(center.x + state.panX, center.y + state.panY);
    state.world.scale.set(state.scale);
  }

  function shouldAnimateViewport() {
    const panDiffX = state.panTargetX - state.panX;
    const panDiffY = state.panTargetY - state.panY;
    return (
      Math.abs(panDiffX) > 0.08
      || Math.abs(panDiffY) > 0.08
      || Math.abs(state.panVelocityX) > PAN_VELOCITY_EPSILON
      || Math.abs(state.panVelocityY) > PAN_VELOCITY_EPSILON
      || Math.abs(state.scaleTarget - state.scale) > 0.0005
      || Math.abs(state.scaleVelocity) > SCALE_VELOCITY_EPSILON
    );
  }

  function isWormLayoutActive() {
    return String(state.payload?.layoutMode || '').trim() === 'worms';
  }

  function getVirtualHierarchyEdges(nodes = state.nodeModels) {
    const nodeList = Array.isArray(nodes) ? nodes : [];
    const nodeById = new Map();
    nodeList.forEach((node) => {
      const nodeId = String(node?.id || '').trim();
      if (!nodeId) return;
      nodeById.set(nodeId, node);
    });
    const seen = new Set();
    const edges = [];
    nodeList.forEach((node) => {
      if (String(node?.role || '').trim() !== 'fixed') return;
      const childId = String(node?.id || '').trim();
      const parentId = String(node?.parentFixedNodeId || '').trim();
      if (!childId || !parentId || childId === parentId) return;
      const parentNode = nodeById.get(parentId) || null;
      const childNode = nodeById.get(childId) || null;
      if (!parentNode || !childNode) return;
      const edgeKey = `${parentId}::${childId}`;
      if (seen.has(edgeKey)) return;
      seen.add(edgeKey);
      edges.push({
        source: parentNode,
        target: childNode,
        kind: 'project-hierarchy',
        virtual: true,
      });
    });
    return edges;
  }

  function isFlashFixedRelationEdge(edge) {
    if (String(edge?.kind || '').trim() !== 'relation') return false;
    const sourceRole = String(edge?.source?.role || '').trim();
    const targetRole = String(edge?.target?.role || '').trim();
    return (
      (sourceRole === 'flash' && targetRole === 'fixed')
      || (sourceRole === 'fixed' && targetRole === 'flash')
    );
  }

  function isHierarchyStyledWormEdge(edge) {
    const edgeKind = String(edge?.kind || '').trim();
    return edgeKind === 'project-hierarchy';
  }

  function getRenderableEdgeModels() {
    const isWormLayout = String(state.payload?.layoutMode || '').trim() === 'worms';
    if (!isWormLayout) return Array.isArray(state.edgeModels) ? state.edgeModels : [];
    const visibleEdges = [];
    const seen = new Set();
    const flashNodesWithExplicitFixedRelation = new Set(
      (Array.isArray(state.edgeModels) ? state.edgeModels : [])
        .filter((edge) => isFlashFixedRelationEdge(edge))
        .flatMap((edge) => {
          const ids = [];
          if (String(edge?.source?.role || '').trim() === 'flash') ids.push(String(edge?.source?.id || '').trim());
          if (String(edge?.target?.role || '').trim() === 'flash') ids.push(String(edge?.target?.id || '').trim());
          return ids.filter(Boolean);
        }),
    );
    const pushEdge = (edge = null) => {
      const sourceId = String(edge?.source?.id || '').trim();
      const targetId = String(edge?.target?.id || '').trim();
      const kind = String(edge?.kind || '').trim() || 'relation';
      if (!sourceId || !targetId || sourceId === targetId) return;
      const key = `${[sourceId, targetId].sort().join('::')}::${kind}`;
      if (seen.has(key)) return;
      seen.add(key);
      visibleEdges.push(edge);
    };
    getVirtualHierarchyEdges(state.nodeModels).forEach((edge) => {
      pushEdge({
        source: edge?.source || null,
        target: edge?.target || null,
        kind: 'project-hierarchy',
      });
    });
    (Array.isArray(state.edgeModels) ? state.edgeModels : [])
      .filter((edge) => String(edge?.kind || '').trim() === 'worm-anchor')
      .filter((edge) => {
        const sourceRole = String(edge?.source?.role || '').trim();
        const targetRole = String(edge?.target?.role || '').trim();
        const flashNodeId = sourceRole === 'flash'
          ? String(edge?.source?.id || '').trim()
          : (targetRole === 'flash' ? String(edge?.target?.id || '').trim() : '');
        if (!flashNodeId) return true;
        return !flashNodesWithExplicitFixedRelation.has(flashNodeId);
      })
      .forEach((edge) => pushEdge(edge));
    (Array.isArray(state.edgeModels) ? state.edgeModels : [])
      .filter((edge) => isFlashFixedRelationEdge(edge))
      .forEach((edge) => pushEdge(edge));
    return visibleEdges;
  }

  function hasActiveWormHoverOffsets() {
    for (let index = 0; index < state.nodeModels.length; index += 1) {
      const node = state.nodeModels[index];
      if (Math.abs(Number(node?.hoverOffsetX) || 0) > 0.02) return true;
      if (Math.abs(Number(node?.hoverOffsetY) || 0) > 0.02) return true;
    }
    return false;
  }

  function readActiveFocusImpulse(timeMs = performance.now()) {
    const impulse = state.focusImpulse && typeof state.focusImpulse === 'object' ? state.focusImpulse : null;
    if (!impulse) return null;
    if ((Number(timeMs) || 0) <= Number(impulse.untilAt || 0)) return impulse;
    state.focusImpulse = null;
    return null;
  }

  function shouldAnimateWormHoverPresentation() {
    if (!state.active || !isWormLayoutActive()) return false;
    const dragNodeId = state.pointer?.type === 'node'
      ? String(state.pointer.nodeId || '').trim()
      : '';
    const hoveredId = dragNodeId || String(state.hoveredNodeId || '').trim();
    if (hoveredId) return true;
    if (readActiveFocusImpulse()) return true;
    return hasActiveWormHoverOffsets();
  }

  function stepWormHoverFrame() {
    state.hoverRafId = 0;
    if (!state.active) return;
    updateNodePositions({ refreshVisuals: true });
    if (shouldAnimateWormHoverPresentation()) {
      scheduleWormHoverFrame();
    }
  }

  function scheduleWormHoverFrame() {
    if (state.hoverRafId) return;
    state.hoverRafId = requestAnimationFrame(stepWormHoverFrame);
  }

  function stopWormHoverFrame() {
    if (!state.hoverRafId) return;
    cancelAnimationFrame(state.hoverRafId);
    state.hoverRafId = 0;
  }

  function scheduleViewportFrame() {
    if (state.rafId) return;
    state.lastFrameAt = 0;
    state.rafId = requestAnimationFrame(stepViewportFrame);
  }

  function stopViewportFrame() {
    if (!state.rafId) return;
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
    state.lastFrameAt = 0;
  }

  function clearWheelSettleTimer() {
    if (!state.wheelSettleTimer) return;
    clearTimeout(state.wheelSettleTimer);
    state.wheelSettleTimer = 0;
  }

  function scheduleWheelSettle() {
    clearWheelSettleTimer();
    state.wheelSettleTimer = window.setTimeout(() => {
      state.wheelSettleTimer = 0;
      settleViewportElastic();
      scheduleViewportFrame();
    }, WHEEL_SETTLE_DELAY_MS);
  }

  function isZoomGestureActive() {
    return state.touches.size >= 2;
  }

  function clampScale(value) {
    return clamp(Number(value) || 1, MIN_SCALE, MAX_SCALE);
  }

  function rubberBandScale(value) {
    const numeric = Number(value) || 1;
    if (numeric < MIN_SCALE) {
      const overshoot = MIN_SCALE - numeric;
      return MIN_SCALE - (overshoot * RUBBER_BAND_FACTOR);
    }
    if (numeric > MAX_SCALE) {
      const overshoot = numeric - MAX_SCALE;
      return MAX_SCALE + (overshoot * RUBBER_BAND_FACTOR);
    }
    return numeric;
  }

  function getClientPointInHost(clientX, clientY) {
    if (!state.host) return { x: 0, y: 0 };
    const rect = state.host.getBoundingClientRect();
    return {
      x: (Number(clientX) || 0) - rect.left,
      y: (Number(clientY) || 0) - rect.top,
    };
  }

  function getWorldPointForClient(clientX, clientY, transform = {}) {
    const center = getViewportCenter();
    const point = getClientPointInHost(clientX, clientY);
    const scale = Number.isFinite(transform.scale) ? transform.scale : state.scale;
    const panX = Number.isFinite(transform.panX) ? transform.panX : state.panX;
    const panY = Number.isFinite(transform.panY) ? transform.panY : state.panY;
    return {
      x: (point.x - center.x - panX) / Math.max(0.001, scale),
      y: (point.y - center.y - panY) / Math.max(0.001, scale),
    };
  }

  function alignPanTargetsForScale(nextScale, clientX, clientY, options = {}) {
    if (!state.host) return;
    const center = getViewportCenter();
    const point = getClientPointInHost(clientX, clientY);
    const world = getWorldPointForClient(clientX, clientY, {
      scale: options.fromScale,
      panX: options.fromPanX,
      panY: options.fromPanY,
    });
    const targetPanX = point.x - center.x - (world.x * nextScale);
    const targetPanY = point.y - center.y - (world.y * nextScale);
    state.panTargetX = targetPanX;
    state.panTargetY = targetPanY;
    if (options.immediatePan === true) {
      state.panX = targetPanX;
      state.panY = targetPanY;
    }
  }

  function scaleAroundClientPoint(nextScale, clientX, clientY, options = {}) {
    const rawScale = Number(nextScale) || 1;
    const normalized = options.rubberBand === false ? clampScale(rawScale) : rubberBandScale(rawScale);
    state.viewportAnchorClientX = Number(clientX) || 0;
    state.viewportAnchorClientY = Number(clientY) || 0;
    if (!state.host) return animateScaleTo(normalized, options);
    alignPanTargetsForScale(normalized, clientX, clientY, {
      fromScale: state.scale,
      fromPanX: state.panX,
      fromPanY: state.panY,
      immediatePan: options.immediate === true,
    });
    return animateScaleTo(normalized, options);
  }

  function settleViewportElastic() {
    const clamped = clampScale(state.scale);
    if (Math.abs(clamped - state.scale) <= 0.0001) {
      state.scaleTarget = clamped;
      return;
    }
    const anchorX = state.viewportAnchorClientX || (state.host?.getBoundingClientRect().left || 0) + (state.host?.clientWidth || 0) / 2;
    const anchorY = state.viewportAnchorClientY || (state.host?.getBoundingClientRect().top || 0) + (state.host?.clientHeight || 0) / 2;
    state.scaleTarget = clamped;
    alignPanTargetsForScale(clamped, anchorX, anchorY, {
      fromScale: state.scale,
      fromPanX: state.panX,
      fromPanY: state.panY,
      immediatePan: false,
    });
  }

  function pushScaleMomentum(previousScale, nextScale, elapsedMs) {
    const prev = Math.max(0.0001, Number(previousScale) || 1);
    const next = Math.max(0.0001, Number(nextScale) || 1);
    const elapsed = Math.min(48, Math.max(8, Number(elapsedMs) || 16.667));
    const normalizedDt = elapsed / 16.667;
    const instantaneous = Math.log(next / prev) / Math.max(0.35, normalizedDt);
    const amplified = clamp(
      instantaneous * SCALE_MOMENTUM_GAIN,
      -SCALE_MOMENTUM_LIMIT,
      SCALE_MOMENTUM_LIMIT
    );
    state.scaleVelocity = (state.scaleVelocity * (1 - SCALE_MOMENTUM_BLEND))
      + (amplified * SCALE_MOMENTUM_BLEND);
  }

  function stepViewportFrame(now) {
    state.rafId = 0;
    const dtMs = state.lastFrameAt ? Math.min(32, Math.max(8, now - state.lastFrameAt)) : 16.667;
    const dt = dtMs / 16.667;
    state.lastFrameAt = now;

    const pointerActive = state.pointer?.type === 'pan';
    const zoomActive = isZoomGestureActive();

    if (!pointerActive) {
      if (Math.abs(state.panVelocityX) > PAN_VELOCITY_EPSILON || Math.abs(state.panVelocityY) > PAN_VELOCITY_EPSILON) {
        state.panX += state.panVelocityX * dt;
        state.panY += state.panVelocityY * dt;
        state.panTargetX = state.panX;
        state.panTargetY = state.panY;
        state.panVelocityX *= Math.pow(PAN_INERTIA_DAMPING, dt);
        state.panVelocityY *= Math.pow(PAN_INERTIA_DAMPING, dt);
      } else {
        const panDiffX = state.panTargetX - state.panX;
        const panDiffY = state.panTargetY - state.panY;
        if (Math.abs(panDiffX) > 0.08 || Math.abs(panDiffY) > 0.08) {
          const settleProgress = 1 - Math.pow(PAN_SETTLE_EASING, dt);
          state.panX += panDiffX * settleProgress;
          state.panY += panDiffY * settleProgress;
        }
      }
      if (Math.abs(state.panVelocityX) <= PAN_VELOCITY_EPSILON) state.panVelocityX = 0;
      if (Math.abs(state.panVelocityY) <= PAN_VELOCITY_EPSILON) state.panVelocityY = 0;
    }

    if (!zoomActive && Math.abs(state.scaleVelocity) > SCALE_VELOCITY_EPSILON) {
      const nextScale = state.scale * Math.exp(state.scaleVelocity * dt);
      scaleAroundClientPoint(nextScale, state.viewportAnchorClientX, state.viewportAnchorClientY, {
        immediate: true,
        motion: false,
        rubberBand: true,
        keepVelocity: true,
      });
      state.scaleVelocity *= Math.pow(SCALE_INERTIA_DAMPING, dt);
    }

    if (!zoomActive && Math.abs(state.scaleVelocity) <= SCALE_VELOCITY_EPSILON) {
      const scaleDiff = state.scaleTarget - state.scale;
      if (Math.abs(scaleDiff) > 0.0006) {
        const settleProgress = 1 - Math.pow(SCALE_SETTLE_EASING, dt);
        const nextScale = state.scale + (scaleDiff * settleProgress);
        scaleAroundClientPoint(nextScale, state.viewportAnchorClientX, state.viewportAnchorClientY, {
          immediate: true,
          motion: false,
          rubberBand: false,
          keepVelocity: true,
        });
      }
    }

    if (Math.abs(state.scaleVelocity) <= SCALE_VELOCITY_EPSILON && Math.abs(state.scaleTarget - state.scale) <= 0.0006) {
      state.scaleVelocity = 0;
      state.scale = state.scaleTarget;
    }

    if (!zoomActive && !pointerActive) {
      settleViewportElastic();
    }

    applyViewport();
    if (shouldAnimateViewport()) {
      state.rafId = requestAnimationFrame(stepViewportFrame);
    } else {
      state.panX = state.panTargetX;
      state.panY = state.panTargetY;
      state.scale = state.scaleTarget;
      applyViewport();
      state.lastFrameAt = 0;
    }
  }

  function easeScaleOutBack(progress) {
    const t = Math.min(1, Math.max(0, Number(progress) || 0));
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function stopScaleAnimation() {
    if (state.scaleAnimRaf) {
      cancelAnimationFrame(state.scaleAnimRaf);
      state.scaleAnimRaf = 0;
    }
    state.scaleVelocity = 0;
  }

  function clearLongPressState() {
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = 0;
    }
    state.longPressStart = null;
    state.longPressNodeId = '';
  }

  function animateScaleTo(nextScale, options = {}) {
    const normalized = Number(nextScale) || 1;
    state.scaleTarget = normalized;
    const immediate = options.immediate === true || options.motion === false;
    if (immediate) {
      state.scale = normalized;
      if (options.keepVelocity !== true) {
        state.scaleVelocity = 0;
      }
      applyViewport();
      return normalized;
    }
    scheduleViewportFrame();
    return normalized;
  }

  function destroyPixiApp() {
    const previousHost = state.host;
    const hadRuntimeSurface = !!(state.app || state.canvas || previousHost);
    const previousCanvas = state.canvas || state.app?.canvas || null;
    const previousRenderer = state.app?.renderer || null;
    state.mountRequestId += 1;
    state.pendingAppInit = null;
    if (state.canvas) {
      if (state.touchHandlers) {
        try { state.canvas.removeEventListener('touchstart', state.touchHandlers.touchstart); } catch (_) {}
        try { state.canvas.removeEventListener('touchmove', state.touchHandlers.touchmove); } catch (_) {}
        try { state.canvas.removeEventListener('touchend', state.touchHandlers.touchend); } catch (_) {}
        try { state.canvas.removeEventListener('touchcancel', state.touchHandlers.touchcancel); } catch (_) {}
      }
      state.canvas.onpointerdown = null;
      state.canvas.onpointermove = null;
      state.canvas.onpointerup = null;
      state.canvas.onpointercancel = null;
      state.canvas.onpointerleave = null;
      state.canvas.oncontextmenu = null;
      state.canvas.onwheel = null;
    }
    if (previousCanvas) {
      try { previousCanvas.style.width = '0px'; } catch (_) {}
      try { previousCanvas.style.height = '0px'; } catch (_) {}
      try { previousCanvas.width = 0; } catch (_) {}
      try { previousCanvas.height = 0; } catch (_) {}
    }
    if (previousRenderer) {
      const webglContext = previousRenderer.gl || previousRenderer.context?.gl || null;
      const loseContextExtension = webglContext?.getExtension?.('WEBGL_lose_context')
        || previousRenderer.context?.extensions?.loseContext
        || null;
      try { loseContextExtension?.loseContext?.(); } catch (_) {}
      try { previousRenderer.textureGC?.run?.(); } catch (_) {}
      try { previousRenderer.renderTexture?.destroy?.(true); } catch (_) {}
      try { previousRenderer.resize?.(1, 1); } catch (_) {}
    }
    if (state.rafId) {
      stopViewportFrame();
    }
    stopWormHoverFrame();
    stopScaleAnimation();
    clearWheelSettleTimer();
    if (state.simulation) {
      state.simulation.stop();
      state.simulation = null;
    }
    if (state.app) {
      try {
        state.app.destroy(
          { removeView: true },
          {
            children: true,
            texture: true,
            textureSource: true,
            context: true,
          },
        );
      } catch (_) {
        try {
          state.app.destroy(true, true);
        } catch (_) {}
      }
    }
    state.app = null;
    state.viewport = null;
    state.world = null;
    state.background = null;
    state.nodesLayer = null;
    state.labelsLayer = null;
    state.canvas = null;
    state.touchHandlers = null;
    state.nodeViews.clear();
    state.nodeModels = [];
    state.edgeModels = [];
    state.payload = null;
    state.previewNodeId = '';
    state.dropTargetNodeId = '';
    state.hoveredGroupKey = '';
    state.hoveredNodeId = '';
    state.focusImpulse = null;
    state.lastFrameAt = 0;
    state.pointer = null;
    state.touches.clear();
    state.pinch = null;
    clearLongPressState();
    state.longPressHandled = false;
    state.active = false;
    state.layoutKey = '';
    state.scaleTarget = DEFAULT_VIEWPORT_SCALE;
    state.panTargetX = 0;
    state.panTargetY = 0;
    state.panVelocityX = 0;
    state.panVelocityY = 0;
    state.viewportAnchorClientX = 0;
    state.viewportAnchorClientY = 0;
    notifyThoughtGraphNodeHover(null, 0, 0);
    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
      state.resizeObserver = null;
    }
    if (previousHost) {
      try {
        previousHost.classList?.remove?.('thought-graph-runtime-host');
        previousHost.innerHTML = '';
      } catch (_) {}
    }
    state.host = null;
    clearPositionCache();
    if (hadRuntimeSurface) {
      state.destroyCount += 1;
      state.lastDestroyAt = Date.now();
    }
  }

  function resetTransientInteractionState() {
    state.pointer = null;
    state.dropTargetNodeId = '';
    state.hoveredGroupKey = '';
    state.hoveredNodeId = '';
    notifyThoughtGraphNodeHover(null, 0, 0);
    clearLongPressState();
    state.longPressHandled = false;
  }

  function pruneRuntimeStateForNodeIds(validNodeIds) {
    const safeIds = validNodeIds instanceof Set ? validNodeIds : new Set();
    state.nodeViews.forEach((view, key) => {
      if (safeIds.has(String(key || '').trim())) return;
      try {
        view?.container?.destroy?.({ children: true });
      } catch (_) {}
      state.nodeViews.delete(key);
    });
    Array.from(state.positionCache.keys()).forEach((key) => {
      if (safeIds.has(String(key || '').trim())) return;
      state.positionCache.delete(key);
    });
    if (state.hoveredNodeId && !safeIds.has(String(state.hoveredNodeId || '').trim())) {
      state.hoveredNodeId = '';
      state.hoveredGroupKey = '';
      notifyThoughtGraphNodeHover(null, 0, 0);
    }
    if (state.dropTargetNodeId && !safeIds.has(String(state.dropTargetNodeId || '').trim())) {
      state.dropTargetNodeId = '';
    }
    if (state.longPressNodeId && !safeIds.has(String(state.longPressNodeId || '').trim())) {
      clearLongPressState();
      state.longPressHandled = false;
    }
    if (state.pointer?.type === 'node' && !safeIds.has(String(state.pointer.nodeId || '').trim())) {
      state.pointer = null;
    }
  }

  function syncCanvasSize() {
    if (!state.app || !state.host) return;
    const width = Math.max(1, Math.round(state.host.clientWidth || 0));
    const height = Math.max(1, Math.round(state.host.clientHeight || 0));
    const resolution = getDeviceResolution();
    if (state.app.renderer.resolution !== resolution) {
      state.app.renderer.resolution = resolution;
    }
    state.app.renderer.resize(width, height);
    state.app.canvas.style.width = `${width}px`;
    state.app.canvas.style.height = `${height}px`;
    state.nodeViews.forEach((view) => {
      if (view?.label) {
        view.label.resolution = resolution;
      }
    });
    applyViewport();
  }

  async function ensureApp(host) {
    if (!host) return null;
    if (state.app && state.host === host) return state.app;
    if (state.pendingAppInit && state.host === host) return state.pendingAppInit;
    destroyPixiApp();
    state.host = host;
    state.host.innerHTML = '';
    const mountRequestId = state.mountRequestId;
    let initPromise = null;
    initPromise = (async () => {
      const app = new PIXI.Application();
      try {
        await app.init({
          resizeTo: host,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: getDeviceResolution(),
          preference: 'webgl',
        });
        const staleMount = state.mountRequestId !== mountRequestId
          || state.host !== host
          || host.isConnected === false;
        if (staleMount) {
          try { app.canvas.style.width = '0px'; app.canvas.style.height = '0px'; } catch (_) {}
          try { app.canvas.width = 0; app.canvas.height = 0; } catch (_) {}
          try { app.destroy(true, { children: true }); } catch (_) {}
          return null;
        }

        host.appendChild(app.canvas);
        host.classList.add('thought-graph-runtime-host');
        app.canvas.style.position = 'absolute';
        app.canvas.style.inset = '0';
        app.canvas.style.display = 'block';
        app.canvas.style.cursor = 'grab';

        const viewport = new PIXI.Container();
        const world = new PIXI.Container();
        const background = new PIXI.Graphics();
        const nodesLayer = new PIXI.Container();
        const labelsLayer = new PIXI.Container();

        world.addChild(background);
        world.addChild(nodesLayer);
        world.addChild(labelsLayer);
        viewport.addChild(world);
        app.stage.addChild(viewport);

        state.app = app;
        state.viewport = viewport;
        state.world = world;
        state.background = background;
        state.nodesLayer = nodesLayer;
        state.labelsLayer = labelsLayer;
        state.canvas = app.canvas;
        state.scale = DEFAULT_VIEWPORT_SCALE;
        state.scaleTarget = DEFAULT_VIEWPORT_SCALE;
        state.scaleVelocity = 0;
        state.panX = 0;
        state.panY = 0;
        state.panTargetX = 0;
        state.panTargetY = 0;
        state.panVelocityX = 0;
        state.panVelocityY = 0;
        state.viewportAnchorClientX = 0;
        state.viewportAnchorClientY = 0;
        state.hoveredGroupKey = '';
        state.hoveredNodeId = '';
        state.active = true;
        state.mountCount += 1;
        state.lastMountAt = Date.now();
        state.touches.clear();
        state.pinch = null;
        clearLongPressState();
        state.longPressHandled = false;
        if (typeof ResizeObserver === 'function') {
          state.resizeObserver = new ResizeObserver(() => {
            syncCanvasSize();
          });
          state.resizeObserver.observe(host);
        }
        bindCanvasEvents(app.canvas);
        syncCanvasSize();
        applyViewport();
        return app;
      } finally {
        if (state.pendingAppInit === initPromise) {
          state.pendingAppInit = null;
        }
      }
    })();
    state.pendingAppInit = initPromise;
    return initPromise;
  }

  function buildModels(payload) {
    const totalCount = Array.isArray(payload?.nodes) ? payload.nodes.length : 0;
    const nodes = (payload?.nodes || []).map((node) => {
      const cached = state.positionCache.get(node.id) || null;
      return {
        ...node,
        radius: nodeRadius(node.kind, totalCount),
        fontSize: nodeFontSize(totalCount),
        hierarchyClusterId: String(node?.hierarchyClusterId || '').trim(),
        linkedProjectId: String(node?.linkedProjectId || '').trim(),
        parentFixedNodeId: String(node?.parentFixedNodeId || '').trim(),
        x: cached?.x ?? node.x ?? node.seedX ?? 0,
        y: cached?.y ?? node.y ?? node.seedY ?? 0,
        vx: 0,
        vy: 0,
        fx: node.pinned ? (cached?.x ?? node.x ?? node.seedX ?? 0) : null,
        fy: node.pinned ? (cached?.y ?? node.y ?? node.seedY ?? 0) : null,
      };
    });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = (payload?.edges || [])
      .map((edge) => ({
        source: nodeById.get(edge.source) || null,
        target: nodeById.get(edge.target) || null,
        kind: String(edge?.kind || 'relation').trim() || 'relation',
      }))
      .filter((edge) => edge.source && edge.target);
    state.nodeModels = nodes;
    state.edgeModels = edges;
    pruneRuntimeStateForNodeIds(new Set(nodes.map((node) => String(node?.id || '').trim()).filter(Boolean)));
  }

  function buildGroupLayoutSignature(nodes = []) {
    return (Array.isArray(nodes) ? nodes : [])
      .map((node) => `${String(node?.id || '').trim()}::${String(node?.groupKey || '').trim()}::${String(node?.role || '').trim()}::${String(node?.wormId || '').trim()}::${String(node?.wormRole || '').trim()}::${Number(node?.wormOrder) || 0}::${String(node?.linkedProjectId || '').trim()}::${String(node?.parentFixedNodeId || '').trim()}`)
      .sort()
      .join('|');
  }

  function buildEdgeLayoutSignature(edges = []) {
    return (Array.isArray(edges) ? edges : [])
      .map((edge) => {
        const kind = String(edge?.kind || 'relation').trim() || 'relation';
        const sourceId = String(typeof edge?.source === 'string' ? edge.source : edge?.source?.id || '').trim();
        const targetId = String(typeof edge?.target === 'string' ? edge.target : edge?.target?.id || '').trim();
        const pair = [sourceId, targetId].sort();
        return `${pair[0]}::${pair[1]}::${kind}`;
      })
      .filter(Boolean)
      .sort()
      .join('|');
  }

  function buildGroupedNodeBuckets(nodes = []) {
    const buckets = new Map();
    (Array.isArray(nodes) ? nodes : []).forEach((node) => {
      const groupKey = String(node?.groupKey || '').trim();
      if (!groupKey) return;
      const bucket = buckets.get(groupKey) || {
        groupKey,
        role: String(node?.role || '').trim() || 'flash',
        nodes: [],
      };
      bucket.nodes.push(node);
      buckets.set(groupKey, bucket);
    });
    return Array.from(buckets.values())
      .filter((bucket) => bucket.nodes.length >= 2)
      .sort((left, right) => {
        if (right.nodes.length !== left.nodes.length) return right.nodes.length - left.nodes.length;
        return left.groupKey.localeCompare(right.groupKey);
      });
  }

  function getGroupedAnchorRadius(bucketCount = 1, role = '') {
    const normalizedRole = String(role || '').trim();
    const fixedMode = normalizedRole === 'fixed' || String(state.payload?.focusKind || '').trim() === 'fixed';
    if (fixedMode) {
      if (bucketCount <= 1) return 0;
      if (bucketCount === 2) return 304;
      if (bucketCount <= 4) return 382;
      if (bucketCount <= 6) return 452;
      return 524;
    }
    if (bucketCount <= 1) return 0;
    if (bucketCount === 2) return 220;
    if (bucketCount <= 4) return 278;
    if (bucketCount <= 6) return 334;
    return 386;
  }

  function getUngroupedOuterRadius(anchorRadius = 0, role = '') {
    const normalizedRole = String(role || '').trim();
    const fixedMode = normalizedRole === 'fixed' || String(state.payload?.focusKind || '').trim() === 'fixed';
    return fixedMode
      ? Math.max(320, anchorRadius + 188)
      : Math.max(228, anchorRadius + 124);
  }

  function buildBucketAdjacency(bucket) {
    const nodeIds = new Set((bucket?.nodes || []).map((node) => String(node?.id || '').trim()).filter(Boolean));
    const adjacency = new Map();
    nodeIds.forEach((id) => adjacency.set(id, new Set()));
    state.edgeModels.forEach((edge) => {
      const sourceId = String(edge?.source?.id || '').trim();
      const targetId = String(edge?.target?.id || '').trim();
      if (!sourceId || !targetId || sourceId === targetId) return;
      if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return;
      adjacency.get(sourceId)?.add(targetId);
      adjacency.get(targetId)?.add(sourceId);
    });
    return adjacency;
  }

  function buildGroupStats() {
    const groups = new Map();
    state.nodeModels.forEach((node) => {
      const groupKey = String(node?.groupKey || '').trim();
      if (!groupKey) return;
      const group = groups.get(groupKey) || {
        groupKey,
        nodeCount: 0,
        edgeCount: 0,
        degreeByNode: new Map(),
      };
      group.nodeCount += 1;
      group.degreeByNode.set(String(node?.id || '').trim(), 0);
      groups.set(groupKey, group);
    });
    state.edgeModels.forEach((edge) => {
      const sourceId = String(edge?.source?.id || '').trim();
      const targetId = String(edge?.target?.id || '').trim();
      const sourceGroup = String(edge?.source?.groupKey || '').trim();
      const targetGroup = String(edge?.target?.groupKey || '').trim();
      if (!sourceId || !targetId || !sourceGroup || sourceGroup !== targetGroup) return;
      const group = groups.get(sourceGroup);
      if (!group) return;
      group.edgeCount += 1;
      group.degreeByNode.set(sourceId, (group.degreeByNode.get(sourceId) || 0) + 1);
      group.degreeByNode.set(targetId, (group.degreeByNode.get(targetId) || 0) + 1);
    });
    groups.forEach((group) => {
      const totalDegree = Array.from(group.degreeByNode.values()).reduce((sum, degree) => sum + degree, 0);
      group.avgDegree = group.nodeCount ? totalDegree / group.nodeCount : 0;
      group.maxDegree = Math.max(0, ...group.degreeByNode.values());
      group.isSparse = group.nodeCount >= 2 && group.avgDegree <= 1.6;
    });
    return groups;
  }

  function sortBucketNodeIds(nodeIds = [], adjacency = new Map()) {
    return [...nodeIds].sort((left, right) => {
      const degreeDiff = (adjacency.get(right)?.size || 0) - (adjacency.get(left)?.size || 0);
      if (degreeDiff) return degreeDiff;
      return left.localeCompare(right);
    });
  }

  function sortLayerNodeIds(nodeIds = [], adjacency = new Map(), placedOrder = new Map()) {
    return [...nodeIds].sort((left, right) => {
      const leftNeighbors = Array.from(adjacency.get(left) || []).filter((id) => placedOrder.has(id));
      const rightNeighbors = Array.from(adjacency.get(right) || []).filter((id) => placedOrder.has(id));
      const leftLinked = leftNeighbors.length > 0;
      const rightLinked = rightNeighbors.length > 0;
      if (leftLinked !== rightLinked) return leftLinked ? -1 : 1;
      if (leftLinked && rightLinked) {
        const leftCenter = leftNeighbors.reduce((sum, id) => sum + (placedOrder.get(id) || 0), 0) / leftNeighbors.length;
        const rightCenter = rightNeighbors.reduce((sum, id) => sum + (placedOrder.get(id) || 0), 0) / rightNeighbors.length;
        if (Math.abs(leftCenter - rightCenter) > 0.001) return leftCenter - rightCenter;
      }
      const degreeDiff = (adjacency.get(right)?.size || 0) - (adjacency.get(left)?.size || 0);
      if (degreeDiff) return degreeDiff;
      return left.localeCompare(right);
    });
  }

  function buildBucketLayers(bucket, adjacency = new Map()) {
    const bucketNodeIds = (bucket?.nodes || []).map((node) => String(node?.id || '').trim()).filter(Boolean);
    if (!bucketNodeIds.length) return [];
    const orderedIds = sortBucketNodeIds(bucketNodeIds, adjacency);
    const rootId = orderedIds[0];
    const visited = new Set([rootId]);
    const layers = [[rootId]];
    let frontier = [rootId];
    while (frontier.length) {
      const nextLayer = [];
      frontier.forEach((nodeId) => {
        const neighbors = sortBucketNodeIds(adjacency.get(nodeId) || [], adjacency);
        neighbors.forEach((neighborId) => {
          if (visited.has(neighborId)) return;
          visited.add(neighborId);
          nextLayer.push(neighborId);
        });
      });
      if (!nextLayer.length) break;
      layers.push(nextLayer);
      frontier = nextLayer;
    }
    const leftovers = orderedIds.filter((nodeId) => !visited.has(nodeId));
    if (leftovers.length) layers.push(leftovers);
    return layers;
  }

  function flattenBucketLayers(layers = []) {
    const ordered = [];
    (Array.isArray(layers) ? layers : []).forEach((layer) => {
      (Array.isArray(layer) ? layer : []).forEach((nodeId) => {
        if (!ordered.includes(nodeId)) ordered.push(nodeId);
      });
    });
    return ordered;
  }

  function applyBucketMemberLayout(bucket, anchorX, anchorY, anchorAngle = 0) {
    const adjacency = buildBucketAdjacency(bucket);
    const layers = buildBucketLayers(bucket, adjacency);
    if (!layers.length) return;
    const nodeById = new Map((bucket?.nodes || []).map((node) => [String(node?.id || '').trim(), node]));
    const fixedMode = bucket?.role === 'fixed';
    const nodeCount = (bucket?.nodes || []).length;
    const maxDegree = Math.max(0, ...Array.from(adjacency.values()).map((neighbors) => neighbors?.size || 0));
    const edgeCount = Array.from(adjacency.values()).reduce((sum, neighbors) => sum + (neighbors?.size || 0), 0) / 2;
    const isTreeLike = nodeCount >= 3 && maxDegree <= 2 && edgeCount <= (nodeCount - 1);
    const avgDegree = nodeCount ? ((edgeCount * 2) / nodeCount) : 0;
    const isSparse = avgDegree <= 1.6;
    if (isTreeLike) {
      const orderedIds = flattenBucketLayers(layers);
      const lineAngle = anchorAngle + (Math.PI / 2);
      const spacing = fixedMode ? 60 : 46;
      const centeredOffset = (orderedIds.length - 1) / 2;
      orderedIds.forEach((id, index) => {
        const node = nodeById.get(id);
        if (!node) return;
        const offset = (index - centeredOffset) * spacing;
        node.seedX = anchorX + (Math.cos(lineAngle) * offset);
        node.seedY = anchorY + (Math.sin(lineAngle) * offset * 0.82);
      });
      return;
    }
    const layerBaseRadius = fixedMode ? 34 : 26;
    const layerGap = isSparse
      ? (fixedMode ? 34 : 28)
      : (fixedMode ? 46 : 36);
    const placedOrder = new Map();
    layers.forEach((layerIds, depth) => {
      const ids = depth === 0
        ? sortBucketNodeIds(layerIds, adjacency)
        : sortLayerNodeIds(layerIds, adjacency, placedOrder);
      if (!ids.length) return;
      if (depth === 0) {
        const root = nodeById.get(ids[0]);
        if (root) {
          root.seedX = anchorX;
          root.seedY = anchorY;
        }
        if (!placedOrder.has(ids[0])) {
          placedOrder.set(ids[0], placedOrder.size);
        }
        return;
      }
      const layerRadius = layerBaseRadius + ((depth - 1) * layerGap);
      const arcSpan = fixedMode
        ? Math.min(isSparse ? Math.PI * 0.72 : Math.PI * 0.96, 0.58 + (ids.length * (isSparse ? 0.14 : 0.2)))
        : Math.min(Math.PI * 1.24, 0.78 + (ids.length * 0.28));
      const startAngle = anchorAngle - (arcSpan / 2);
      ids.forEach((id, index) => {
        const node = nodeById.get(id);
        if (!node) return;
        const angle = ids.length === 1
          ? anchorAngle
          : startAngle + ((index / Math.max(1, ids.length - 1)) * arcSpan);
        node.seedX = anchorX + (Math.cos(angle) * layerRadius);
        node.seedY = anchorY + (Math.sin(angle) * layerRadius * 0.82);
        if (!placedOrder.has(id)) {
          placedOrder.set(id, placedOrder.size);
        }
      });
    });
  }

  function buildWormBuckets(nodes = []) {
    const buckets = new Map();
    (Array.isArray(nodes) ? nodes : []).forEach((node) => {
      const wormId = String(node?.wormId || '').trim();
      if (!wormId) return;
      const bucket = buckets.get(wormId) || {
        wormId,
        nodes: [],
      };
      bucket.nodes.push(node);
      buckets.set(wormId, bucket);
    });
    return Array.from(buckets.values())
      .filter((bucket) => Array.isArray(bucket.nodes) && bucket.nodes.length > 0)
      .sort((left, right) => {
        const leftHash = hashString(String(left?.wormId || ''));
        const rightHash = hashString(String(right?.wormId || ''));
        if (leftHash !== rightHash) return leftHash - rightHash;
        return String(left?.wormId || '').localeCompare(String(right?.wormId || ''));
      });
  }

  function sortWormNodes(nodes = []) {
    const roleRank = { anchor: 0, seed: 1, turn: 2, bridge: 3, flow: 4 };
    return [...(Array.isArray(nodes) ? nodes : [])].sort((left, right) => {
      const leftRoleRank = roleRank[String(left?.wormRole || '').trim()] ?? 99;
      const rightRoleRank = roleRank[String(right?.wormRole || '').trim()] ?? 99;
      if (leftRoleRank !== rightRoleRank) return leftRoleRank - rightRoleRank;
      const leftOrder = Number(left?.wormOrder) || 0;
      const rightOrder = Number(right?.wormOrder) || 0;
      if (leftOrder && rightOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
      const leftSeed = ['anchor', 'seed'].includes(String(left?.wormRole || '').trim());
      const rightSeed = ['anchor', 'seed'].includes(String(right?.wormRole || '').trim());
      if (leftSeed !== rightSeed) return leftSeed ? -1 : 1;
      const leftId = String(left?.id || '').trim();
      const rightId = String(right?.id || '').trim();
      return leftId.localeCompare(rightId);
    });
  }

  function buildWormNodeMeta(nodes = []) {
    const buckets = buildWormBuckets(nodes);
    const metaByNodeId = new Map();
    buckets.forEach((bucket) => {
      const ordered = sortWormNodes(bucket.nodes || []);
      const count = ordered.length;
      ordered.forEach((node, index) => {
        if (!node?.id) return;
        metaByNodeId.set(String(node.id), {
          ordered,
          index,
          count,
          wormId: String(bucket?.wormId || '').trim(),
        });
      });
    });
    return metaByNodeId;
  }

  function getNodeRenderBaseX(node) {
    return Number.isFinite(node?.x) ? Number(node.x) : (Number.isFinite(node?.seedX) ? Number(node.seedX) : 0);
  }

  function getNodeRenderBaseY(node) {
    return Number.isFinite(node?.y) ? Number(node.y) : (Number.isFinite(node?.seedY) ? Number(node.seedY) : 0);
  }

  function resolveWormHoverTargetOffset(node, context = {}) {
    const hoveredNode = context.hoveredNode || null;
    const hoveredId = String(context.hoveredId || '').trim();
    if (!hoveredNode || !hoveredId) return { x: 0, y: 0 };
    const nodeId = String(node?.id || '').trim();
    if (!nodeId) return { x: 0, y: 0 };
    if (nodeId === hoveredId) return { x: 0, y: 0 };
    if (String(context.dragNodeId || '').trim() === nodeId) return { x: 0, y: 0 };

    const hx = getNodeRenderBaseX(hoveredNode);
    const hy = getNodeRenderBaseY(hoveredNode);
    const nx = getNodeRenderBaseX(node);
    const ny = getNodeRenderBaseY(node);
    const dx = nx - hx;
    const dy = ny - hy;
    const distance = Math.hypot(dx, dy) || 0.0001;
    const sameWorm = (
      String(node?.wormId || '').trim()
      && String(node?.wormId || '').trim() === String(context.hoveredWormId || '').trim()
    );
    const influenceRadius = sameWorm ? WORM_HOVER_SAME_WORM_RADIUS : WORM_HOVER_NEIGHBOR_RADIUS;
    if (distance >= influenceRadius) return { x: 0, y: 0 };

    const falloff = Math.pow(Math.max(0, 1 - (distance / influenceRadius)), 1.28);
    const spreadStrength = sameWorm ? WORM_HOVER_SAME_WORM_SPREAD : WORM_HOVER_NEIGHBOR_SPREAD;
    const ux = dx / distance;
    const uy = dy / distance;
    let targetX = ux * spreadStrength * falloff;
    let targetY = uy * spreadStrength * falloff;

    const nodeMeta = context.metaByNodeId?.get(nodeId) || null;
    if (sameWorm && nodeMeta?.count >= WORM_HOVER_WIGGLE_MIN_LENGTH) {
      const ordered = Array.isArray(nodeMeta.ordered) ? nodeMeta.ordered : [];
      const prev = nodeMeta.index > 0 ? ordered[nodeMeta.index - 1] : null;
      const next = nodeMeta.index < ordered.length - 1 ? ordered[nodeMeta.index + 1] : null;
      let tangentX = 0;
      let tangentY = 0;
      if (prev && next) {
        tangentX = getNodeRenderBaseX(next) - getNodeRenderBaseX(prev);
        tangentY = getNodeRenderBaseY(next) - getNodeRenderBaseY(prev);
      } else if (next) {
        tangentX = getNodeRenderBaseX(next) - nx;
        tangentY = getNodeRenderBaseY(next) - ny;
      } else if (prev) {
        tangentX = nx - getNodeRenderBaseX(prev);
        tangentY = ny - getNodeRenderBaseY(prev);
      }
      const tangentLength = Math.hypot(tangentX, tangentY) || 0.0001;
      const perpX = (-tangentY) / tangentLength;
      const perpY = tangentX / tangentLength;
      const orderNorm = nodeMeta.count <= 1 ? 0 : (nodeMeta.index / Math.max(1, nodeMeta.count - 1));
      const phase = (context.timeMs * 0.0062) + (orderNorm * Math.PI * 3.5) + ((hashString(nodeMeta.wormId) % 360) * (Math.PI / 180));
      const wave = Math.sin(phase);
      const waveAmp = (WORM_HOVER_WIGGLE_BASE + (nodeMeta.count * WORM_HOVER_WIGGLE_GAIN)) * (0.35 + (falloff * 0.65));
      targetX += perpX * wave * waveAmp;
      targetY += perpY * wave * waveAmp;
      const drift = Math.cos(phase * 0.75) * waveAmp * 0.2;
      targetX += (tangentX / tangentLength) * drift;
      targetY += (tangentY / tangentLength) * drift;
    } else if (falloff > 0.06) {
      const swirlPhase = (context.timeMs * 0.0054) + ((hashString(nodeId) % 360) * (Math.PI / 180)) + (distance * 0.042);
      const swirl = Math.sin(swirlPhase) * (2.2 * falloff);
      const sx = -uy;
      const sy = ux;
      targetX += sx * swirl;
      targetY += sy * swirl;
    }
    return { x: targetX, y: targetY };
  }

  function resolveFocusImpulseTargetOffset(node, context = {}) {
    const focusKind = String(context.focusKind || '').trim();
    if (!focusKind) return { x: 0, y: 0 };
    if (String(node?.role || '').trim() === focusKind) return { x: 0, y: 0 };
    const centerX = Number(context.centerX);
    const centerY = Number(context.centerY);
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return { x: 0, y: 0 };
    const nx = getNodeRenderBaseX(node);
    const ny = getNodeRenderBaseY(node);
    let dx = nx - centerX;
    let dy = ny - centerY;
    let distance = Math.hypot(dx, dy);
    if (distance < 0.001) {
      const phase = ((hashString(String(node?.id || 'focus')) % 360) * Math.PI) / 180;
      dx = Math.cos(phase);
      dy = Math.sin(phase);
      distance = 1;
    }
    if (distance >= FOCUS_IMPULSE_RADIUS) return { x: 0, y: 0 };
    const elapsed = Math.max(0, (Number(context.timeMs) || 0) - (Number(context.startedAt) || 0));
    const duration = Math.max(120, Number(context.durationMs) || FOCUS_IMPULSE_DURATION_MS);
    const progress = clamp(elapsed / duration, 0, 1);
    const envelope = Math.sin(progress * Math.PI) * (0.92 + (0.08 * Math.sin(progress * Math.PI * 2.6)));
    if (envelope <= 0.001) return { x: 0, y: 0 };
    const falloff = Math.pow(Math.max(0, 1 - (distance / FOCUS_IMPULSE_RADIUS)), 1.12);
    const ux = dx / distance;
    const uy = dy / distance;
    const spread = node.role === focusKind ? FOCUS_IMPULSE_SPREAD_FOCUSED : FOCUS_IMPULSE_SPREAD_PERIPHERAL;
    let targetX = ux * spread * falloff * envelope;
    let targetY = uy * spread * falloff * envelope;
    const swirlPhase = (progress * Math.PI * 4) + (((hashString(String(node?.id || '')) % 360) * Math.PI) / 180);
    const swirlAmp = 8.8 * falloff * envelope;
    targetX += -uy * Math.sin(swirlPhase) * swirlAmp;
    targetY += ux * Math.sin(swirlPhase) * swirlAmp;
    return { x: targetX, y: targetY };
  }

  function resolvePreviewCenteringTargetOffset(node, context = {}) {
    const focusNodeId = String(context.focusNodeId || '').trim();
    const centerX = Number(context.centerX);
    const centerY = Number(context.centerY);
    if (!focusNodeId || !Number.isFinite(centerX) || !Number.isFinite(centerY)) return { x: 0, y: 0 };
    const nodeId = String(node?.id || '').trim();
    const nx = getNodeRenderBaseX(node);
    const ny = getNodeRenderBaseY(node);
    let dx = nx - centerX;
    let dy = ny - centerY;
    let distance = Math.hypot(dx, dy);
    if (distance < 0.001) {
      const phase = ((hashString(nodeId || 'preview-center') % 360) * Math.PI) / 180;
      dx = Math.cos(phase);
      dy = Math.sin(phase);
      distance = 1;
    }
    if (distance >= PREVIEW_CENTERING_RADIUS) return { x: 0, y: 0 };
    const elapsed = Math.max(0, (Number(context.timeMs) || 0) - (Number(context.startedAt) || 0));
    const duration = Math.max(180, Number(context.durationMs) || PREVIEW_CENTERING_DURATION_MS);
    const progress = clamp(elapsed / duration, 0, 1);
    const falloff = Math.pow(Math.max(0, 1 - (distance / PREVIEW_CENTERING_RADIUS)), 0.92);
    const distanceNorm = clamp(distance / PREVIEW_CENTERING_RADIUS, 0, 1);
    const delayBias = nodeId === focusNodeId ? 0 : (0.1 + (distanceNorm * 0.44));
    const localProgress = nodeId === focusNodeId
      ? progress
      : clamp((progress - delayBias) / Math.max(0.12, 1 - delayBias), 0, 1);
    const catchup = 1 - Math.pow(1 - localProgress, nodeId === focusNodeId ? 2.8 : 2.2);
    const panDiffX = Number(context.targetPanX || 0) - Number(state.panX || 0);
    const panDiffY = Number(context.targetPanY || 0) - Number(state.panY || 0);
    const lagStrength = nodeId === focusNodeId ? 0.035 : (0.14 + (distanceNorm * 0.54));
    let targetX = -(panDiffX * lagStrength * (1 - catchup) * falloff);
    let targetY = -(panDiffY * lagStrength * (1 - catchup) * falloff);
    if (nodeId !== focusNodeId) {
      const ux = dx / distance;
      const uy = dy / distance;
      const swayPhase = (progress * Math.PI * 2.8) + (((hashString(nodeId || '')) % 360) * Math.PI / 180);
      const swayAmp = 2.2 * distanceNorm * falloff * (1 - catchup);
      targetX += -uy * Math.sin(swayPhase) * swayAmp;
      targetY += ux * Math.sin(swayPhase) * swayAmp;
    }
    return { x: targetX, y: targetY };
  }

  function applyWormHoverPresentationOffsets(timeMs = 0) {
    const isWormLayout = String(state.payload?.layoutMode || '').trim() === 'worms';
    const dragNodeId = state.pointer?.type === 'node' ? String(state.pointer.nodeId || '').trim() : '';
    const hoveredId = dragNodeId || String(state.hoveredNodeId || '').trim();
    const hoveredNode = hoveredId
      ? (state.nodeModels.find((entry) => String(entry?.id || '').trim() === hoveredId) || null)
      : null;
    const hoveredWormId = String(hoveredNode?.wormId || '').trim();
    const hasHover = !!(isWormLayout && hoveredNode);
    const metaByNodeId = hasHover ? buildWormNodeMeta(state.nodeModels) : new Map();
    const context = {
      timeMs: Number(timeMs) || performance.now(),
      hoveredNode,
      hoveredId,
      hoveredWormId,
      dragNodeId,
      metaByNodeId,
    };
    const focusImpulse = !hasHover ? readActiveFocusImpulse(context.timeMs) : null;
    state.nodeModels.forEach((node) => {
      const currentX = Number(node?.hoverOffsetX) || 0;
      const currentY = Number(node?.hoverOffsetY) || 0;
      const target = hasHover
        ? resolveWormHoverTargetOffset(node, context)
        : (
          focusImpulse
            ? (
              String(focusImpulse.mode || '').trim() === 'preview-center'
                ? resolvePreviewCenteringTargetOffset(node, { ...focusImpulse, timeMs: context.timeMs })
                : resolveFocusImpulseTargetOffset(node, { ...focusImpulse, timeMs: context.timeMs })
            )
            : { x: 0, y: 0 }
        );
      const easing = hasHover ? WORM_HOVER_ACTIVE_EASING : WORM_HOVER_RETURN_EASING;
      let nextX = currentX + ((Number(target?.x) || 0) - currentX) * easing;
      let nextY = currentY + ((Number(target?.y) || 0) - currentY) * easing;
      if (Math.abs(nextX) < 0.01) nextX = 0;
      if (Math.abs(nextY) < 0.01) nextY = 0;
      node.hoverOffsetX = nextX;
      node.hoverOffsetY = nextY;
      node.renderX = getNodeRenderBaseX(node) + nextX;
      node.renderY = getNodeRenderBaseY(node) + nextY;
    });
  }

  function buildWormChainLinks(nodes = []) {
    const links = [];
    buildWormBuckets(nodes).forEach((bucket) => {
      const ordered = sortWormNodes(bucket.nodes || []);
      const hasAnchor = ordered.some((node) => String(node?.wormRole || '').trim() === 'anchor');
      if (!hasAnchor) return;
      for (let index = 1; index < ordered.length; index += 1) {
        const prev = ordered[index - 1];
        const next = ordered[index];
        if (!prev || !next) continue;
        links.push({
          source: prev.id,
          target: next.id,
          wormId: bucket.wormId,
        });
      }
    });
    return links;
  }

  function primeFocusImpulse(nextFocusKind = '') {
    const normalizedFocusKind = String(nextFocusKind || '').trim();
    if (!normalizedFocusKind || !isWormLayoutActive()) {
      state.focusImpulse = null;
      return;
    }
    const focusedNodes = state.nodeModels.filter((node) => String(node?.role || '').trim() === normalizedFocusKind);
    if (!focusedNodes.length) {
      state.focusImpulse = null;
      return;
    }
    const centerX = focusedNodes.reduce((sum, node) => sum + getNodeRenderBaseX(node), 0) / focusedNodes.length;
    const centerY = focusedNodes.reduce((sum, node) => sum + getNodeRenderBaseY(node), 0) / focusedNodes.length;
    const now = performance.now();
    state.focusImpulse = {
      focusKind: normalizedFocusKind,
      centerX,
      centerY,
      startedAt: now,
      untilAt: now + FOCUS_IMPULSE_DURATION_MS,
      durationMs: FOCUS_IMPULSE_DURATION_MS,
    };
    scheduleWormHoverFrame();
  }

  function primePreviewCenteringImpulse(kind = '', rawId = '') {
    const node = findNodeBySource(kind, rawId);
    if (!node || !isWormLayoutActive()) {
      state.focusImpulse = null;
      return;
    }
    const centerX = getNodeRenderBaseX(node);
    const centerY = getNodeRenderBaseY(node);
    const now = performance.now();
    state.focusImpulse = {
      mode: 'preview-center',
      focusNodeId: String(node?.id || '').trim(),
      centerX,
      centerY,
      targetPanX: Number(state.panTargetX) || 0,
      targetPanY: Number(state.panTargetY) || 0,
      startedAt: now,
      untilAt: now + PREVIEW_CENTERING_DURATION_MS,
      durationMs: PREVIEW_CENTERING_DURATION_MS,
    };
    scheduleWormHoverFrame();
  }

  function applySingleWormCurveLayout(bucket, anchorX, anchorY, anchorAngle = 0) {
    const ordered = sortWormNodes(bucket?.nodes || []);
    if (!ordered.length) return;
    if (ordered.length === 1) {
      ordered[0].seedX = anchorX;
      ordered[0].seedY = anchorY;
      return;
    }
    const anchorNode = ordered.find((node) => String(node?.wormRole || '').trim() === 'anchor') || null;
    if (anchorNode) {
      const tail = ordered.filter((node) => node !== anchorNode);
      anchorNode.seedX = anchorX;
      anchorNode.seedY = anchorY;
      if (!tail.length) return;
      const hash = hashString(String(bucket?.wormId || 'worm'));
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const orbitBase = Math.max((Number(anchorNode?.radius) || 0) + 26, 44);
      tail.forEach((node, index) => {
        const ringRadius = orbitBase + (Math.sqrt(index + 0.75) * 18);
        const jitter = (((hashString(String(node?.id || index)) % 11) - 5) * 1.4);
        const angle = anchorAngle + (index * goldenAngle) + ((((hash >> 3) % 19) - 9) * 0.012);
        node.seedX = anchorX + (Math.cos(angle) * (ringRadius + jitter));
        node.seedY = anchorY + (Math.sin(angle) * (ringRadius + jitter) * 0.84);
      });
      return;
    }
    applyAnchorlessWormScatterLayout(ordered, bucket, anchorX, anchorY, anchorAngle);
  }

  function applyAnchorlessWormScatterLayout(ordered = [], bucket = null, anchorX = 0, anchorY = 0, anchorAngle = 0) {
    const hash = hashString(String(bucket?.wormId || 'worm'));
    const count = Math.max(1, ordered.length);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const spreadBase = count >= 36 ? 52 : (count >= 18 ? 46 : 38);
    const spreadGain = count >= 36 ? 9.4 : (count >= 18 ? 10.6 : 12.4);
    const radialCap = Math.max(76, Math.min(190, spreadBase + (Math.sqrt(count) * spreadGain)));
    const rotation = anchorAngle + (((hash % 360) / 180) * Math.PI);
    ordered.forEach((node, index) => {
      const nodeHash = hashString(String(node?.id || index));
      const ring = Math.sqrt(index + 0.72) / Math.sqrt(count + 0.72);
      const radialJitter = (((nodeHash % 1000) / 999) - 0.5) * 18;
      const radius = clamp((ring * radialCap) + radialJitter, 12, radialCap + 14);
      const angle = rotation + (index * goldenAngle) + ((((nodeHash >> 6) % 1000) / 999) - 0.5) * 0.58;
      const oval = 0.78 + ((((hash >> 5) % 1000) / 999) * 0.18);
      node.seedX = anchorX + (Math.cos(angle) * radius);
      node.seedY = anchorY + (Math.sin(angle) * radius * oval);
    });
  }

  function applyWormSeedLayout(nodes = []) {
    const wormBuckets = buildWormBuckets(nodes);
    if (!wormBuckets.length) return;
    const bucketCount = wormBuckets.length;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const spiralScale = bucketCount <= 8 ? 52 : (bucketCount <= 24 ? 60 : 68);
    const maxRadius = Math.max(140, (Math.sqrt(bucketCount) * spiralScale) + 32);
    const anchors = wormBuckets.map((bucket, index) => {
      const anchorNode = (bucket?.nodes || []).find((node) => String(node?.wormRole || '').trim() === 'anchor') || null;
      const hash = hashString(bucket.wormId);
      const size = Math.max(1, Number(bucket?.nodes?.length) || 1);
      const isLooseSolo = !anchorNode && size <= 1;
      const baseAngle = (index * goldenAngle) + ((((hash % 720) - 360) / 360) * 0.6);
      const baseRadius = (Math.sqrt(index + 0.9) * spiralScale) + (((hash >> 4) % 21) - 10) * 2.8;
      const x = Math.cos(baseAngle) * baseRadius;
      const y = Math.sin(baseAngle) * baseRadius * 0.86;
      const footprint = Math.min(118, 30 + (size * 3.4));
      const orientation = (((hash % 360) / 180) * Math.PI) + ((((hash >> 7) % 31) - 15) * 0.014);
      return {
        bucket,
        anchorNode,
        hash,
        x,
        y,
        footprint,
        orientation,
        isLooseSolo,
      };
    });
    const structuredAnchors = anchors.filter((anchor) => anchor?.isLooseSolo !== true);
    const looseSoloAnchors = anchors.filter((anchor) => anchor?.isLooseSolo === true);

    const hierarchyAnchorByNodeId = new Map();
    structuredAnchors.forEach((anchor) => {
      const anchorNodeId = String(anchor?.anchorNode?.id || '').trim();
      if (!anchorNodeId) return;
      hierarchyAnchorByNodeId.set(anchorNodeId, anchor);
    });
    const hierarchyEdges = getVirtualHierarchyEdges();
    const hierarchyChildrenByAnchorId = new Map();
    const hierarchyChildAnchorIds = new Set();
    hierarchyEdges.forEach((edge) => {
      const parentAnchorId = String(edge?.source?.id || '').trim();
      const childAnchorId = String(edge?.target?.id || '').trim();
      const parentAnchor = hierarchyAnchorByNodeId.get(parentAnchorId) || null;
      const childAnchor = hierarchyAnchorByNodeId.get(childAnchorId) || null;
      if (!parentAnchor || !childAnchor || parentAnchor === childAnchor) return;
      if (!hierarchyChildrenByAnchorId.has(parentAnchorId)) hierarchyChildrenByAnchorId.set(parentAnchorId, []);
      hierarchyChildrenByAnchorId.get(parentAnchorId).push(childAnchor);
      hierarchyChildAnchorIds.add(childAnchorId);
    });
    const clusterRootsByClusterId = new Map();
    structuredAnchors.forEach((anchor) => {
      const anchorNodeId = String(anchor?.anchorNode?.id || '').trim();
      const clusterId = anchorNodeId
        ? String(anchor?.anchorNode?.hierarchyClusterId || anchor?.anchorNode?.linkedProjectId || anchorNodeId).trim()
        : `worm:${String(anchor?.bucket?.wormId || anchor?.hash || 'ungrouped').trim()}`;
      anchor.clusterId = clusterId || anchorNodeId;
      if (hierarchyChildAnchorIds.has(anchorNodeId)) return;
      if (!clusterRootsByClusterId.has(anchor.clusterId)) clusterRootsByClusterId.set(anchor.clusterId, []);
      clusterRootsByClusterId.get(anchor.clusterId).push(anchor);
    });
    const clusterRoots = Array.from(clusterRootsByClusterId.entries()).map(([clusterId, roots]) => ({
      clusterId,
      roots: Array.isArray(roots) ? roots.slice() : [],
      hash: hashString(clusterId),
    }));
    const rootClusterCount = Math.max(1, clusterRoots.length);
    const sortedClusters = clusterRoots
      .slice()
      .sort((left, right) => Number(left?.hash || 0) - Number(right?.hash || 0));
    const clusterCols = Math.max(1, Math.ceil(Math.sqrt(rootClusterCount)));
    const clusterRows = Math.max(1, Math.ceil(rootClusterCount / clusterCols));
    const clusterCellWidth = rootClusterCount <= 6 ? 240 : (rootClusterCount <= 16 ? 268 : 292);
    const clusterCellHeight = rootClusterCount <= 6 ? 194 : (rootClusterCount <= 16 ? 216 : 236);
    const clusterCenterCol = (clusterCols - 1) / 2;
    const clusterCenterRow = (clusterRows - 1) / 2;
    sortedClusters.forEach((cluster, index) => {
      const col = index % clusterCols;
      const row = Math.floor(index / clusterCols);
      const jitterSeedA = ((cluster.hash % 1000) / 999) - 0.5;
      const jitterSeedB = (((cluster.hash >> 5) % 1000) / 999) - 0.5;
      const clusterCenterX = ((col - clusterCenterCol) * clusterCellWidth) + (jitterSeedA * clusterCellWidth * 0.52);
      const clusterCenterY = ((row - clusterCenterRow) * clusterCellHeight * 0.9) + (jitterSeedB * clusterCellHeight * 0.48);
      const clusterAngle = ((((cluster.hash >> 9) % 360) / 180) * Math.PI) + (jitterSeedA * 0.32);
      const roots = Array.isArray(cluster.roots) ? cluster.roots : [];
      roots.forEach((rootAnchor, rootIndex) => {
        const rootCount = roots.length;
        const rootArcSpan = rootCount <= 1 ? 0 : Math.min(Math.PI * 0.56, 0.48 + ((rootCount - 1) * 0.22));
        const rootStartAngle = clusterAngle - (rootArcSpan / 2);
        const rootAngle = rootCount <= 1 ? clusterAngle : rootStartAngle + ((rootIndex / Math.max(1, rootCount - 1)) * rootArcSpan);
        const rootOffset = rootCount <= 1 ? 0 : 42;
        rootAnchor.x = clusterCenterX + (Math.cos(rootAngle) * rootOffset);
        rootAnchor.y = clusterCenterY + (Math.sin(rootAngle) * rootOffset * 0.84);
        rootAnchor.orientation = rootAngle;
      });
    });
    const positionHierarchyChildren = (parentAnchor, depth = 1, lineage = new Set()) => {
      const parentAnchorId = String(parentAnchor?.anchorNode?.id || '').trim();
      if (!parentAnchorId || lineage.has(parentAnchorId)) return;
      const childAnchors = (hierarchyChildrenByAnchorId.get(parentAnchorId) || [])
        .slice()
        .sort((left, right) => String(left?.bucket?.wormId || '').localeCompare(String(right?.bucket?.wormId || '')));
      if (!childAnchors.length) return;
      const nextLineage = new Set(lineage);
      nextLineage.add(parentAnchorId);
      const siblingCount = childAnchors.length;
      const arcSpan = siblingCount <= 1
        ? 0
        : Math.min(Math.PI * 0.92, 0.72 + ((siblingCount - 1) * 0.32));
      const baseAngle = Number(parentAnchor?.orientation) || (((Number(parentAnchor?.hash) || 0) % 360) * Math.PI / 180);
      const startAngle = baseAngle - (arcSpan / 2);
      childAnchors.forEach((childAnchor, index) => {
        const parentRadius = Number(parentAnchor?.anchorNode?.radius) || 16;
        const childRadius = Number(childAnchor?.anchorNode?.radius) || 16;
        const radialDistance = Math.max(112, parentRadius + childRadius + 58 + (depth * 10));
        const angle = siblingCount <= 1
          ? baseAngle
          : startAngle + ((index / Math.max(1, siblingCount - 1)) * arcSpan);
        childAnchor.x = parentAnchor.x + (Math.cos(angle) * radialDistance);
        childAnchor.y = parentAnchor.y + (Math.sin(angle) * radialDistance * 0.84);
        childAnchor.orientation = angle;
        positionHierarchyChildren(childAnchor, depth + 1, nextLineage);
      });
    };
    structuredAnchors
      .filter((anchor) => !hierarchyChildAnchorIds.has(String(anchor?.anchorNode?.id || '').trim()))
      .forEach((rootAnchor) => {
        positionHierarchyChildren(rootAnchor, 1, new Set());
      });

    for (let iter = 0; iter < 16; iter += 1) {
      for (let i = 0; i < structuredAnchors.length; i += 1) {
        for (let j = i + 1; j < structuredAnchors.length; j += 1) {
          const left = structuredAnchors[i];
          const right = structuredAnchors[j];
          const dx = right.x - left.x;
          const dy = right.y - left.y;
          const distance = Math.hypot(dx, dy) || 0.0001;
          const minGap = (left.footprint + right.footprint) * 0.34;
          if (distance >= minGap) continue;
          const push = ((minGap - distance) / minGap) * 5.8;
          const ux = dx / distance;
          const uy = dy / distance;
          left.x -= ux * push;
          left.y -= uy * push;
          right.x += ux * push;
          right.y += uy * push;
        }
      }
      hierarchyEdges.forEach((edge) => {
        const sourceAnchor = hierarchyAnchorByNodeId.get(String(edge?.source?.id || '').trim()) || null;
        const targetAnchor = hierarchyAnchorByNodeId.get(String(edge?.target?.id || '').trim()) || null;
        if (!sourceAnchor || !targetAnchor || sourceAnchor === targetAnchor) return;
        const dx = targetAnchor.x - sourceAnchor.x;
        const dy = targetAnchor.y - sourceAnchor.y;
        const distance = Math.hypot(dx, dy) || 0.0001;
        const desiredGap = Math.max(
          92,
          ((Number(sourceAnchor?.anchorNode?.radius) || 16) + (Number(targetAnchor?.anchorNode?.radius) || 16)) * 2.15,
        );
        if (distance <= desiredGap) return;
        const pull = ((distance - desiredGap) / distance) * 0.22;
        const moveX = dx * pull;
        const moveY = dy * pull;
        sourceAnchor.x += moveX * 0.5;
        sourceAnchor.y += moveY * 0.5;
        targetAnchor.x -= moveX * 0.5;
        targetAnchor.y -= moveY * 0.5;
      });
      structuredAnchors.forEach((anchor) => {
        const distance = Math.hypot(anchor.x, anchor.y) || 0.0001;
        if (distance > maxRadius) {
          const ratio = maxRadius / distance;
          anchor.x *= ratio;
          anchor.y *= ratio;
        }
        anchor.x *= 0.994;
        anchor.y *= 0.994;
      });
    }

    if (looseSoloAnchors.length) {
      const looseCount = looseSoloAnchors.length;
      const looseCols = Math.max(1, Math.ceil(Math.sqrt(looseCount)));
      const looseRows = Math.max(1, Math.ceil(looseCount / looseCols));
      const looseCellWidth = 116;
      const looseCellHeight = 96;
      const looseCenterCol = (looseCols - 1) / 2;
      const looseCenterRow = (looseRows - 1) / 2;
      looseSoloAnchors
        .slice()
        .sort((left, right) => Number(left?.hash || 0) - Number(right?.hash || 0))
        .forEach((anchor, index) => {
          const col = index % looseCols;
          const row = Math.floor(index / looseCols);
          const jitterX = (((anchor.hash % 1000) / 999) - 0.5) * looseCellWidth * 0.62;
          const jitterY = ((((anchor.hash >> 5) % 1000) / 999) - 0.5) * looseCellHeight * 0.62;
          anchor.x = ((col - looseCenterCol) * looseCellWidth) + jitterX;
          anchor.y = ((row - looseCenterRow) * looseCellHeight * 0.94) + jitterY;
          anchor.orientation = ((((anchor.hash >> 9) % 360) / 180) * Math.PI) + (jitterX * 0.0024);
        });
    }

    anchors.forEach((anchor) => {
      const jitterX = (((anchor.hash % 27) - 13) * 1.6);
      const jitterY = ((((anchor.hash >> 3) % 25) - 12) * 1.45);
      applySingleWormCurveLayout(
        anchor.bucket,
        anchor.x + jitterX,
        anchor.y + jitterY,
        anchor.orientation,
      );
    });

    const ungrouped = (Array.isArray(nodes) ? nodes : [])
      .filter((node) => !String(node?.wormId || '').trim());
    if (!ungrouped.length) return;
    const outerBaseX = maxRadius + 36;
    const outerBaseY = (maxRadius * 0.84) + 30;
    ungrouped.forEach((node, index) => {
      const hash = hashString(String(node?.id || index));
      const angle = (index * goldenAngle * 1.18) + ((((hash % 720) - 360) / 360) * 0.45);
      const ringOffset = Math.sqrt(index + 1) * 12;
      const jitter = (((hash >> 2) % 17) - 8) * 1.5;
      node.seedX = Math.cos(angle) * (outerBaseX + ringOffset + jitter);
      node.seedY = Math.sin(angle) * (outerBaseY + (ringOffset * 0.82) + jitter);
    });
  }

  function applyGroupedSeedLayout(nodes = []) {
    if (String(state.payload?.layoutMode || '').trim() === 'worms') {
      applyWormSeedLayout(nodes);
      return;
    }
    const buckets = buildGroupedNodeBuckets(nodes);
    if (!buckets.length) return;
    const bucketCount = buckets.length;
    buckets.forEach((bucket, bucketIndex) => {
      const anchorRadius = getGroupedAnchorRadius(bucketCount, bucket.role);
      const hash = hashString(bucket.groupKey);
      const angleBase = bucketCount <= 1
        ? 0
        : (-Math.PI / 2) + ((bucketIndex / bucketCount) * Math.PI * 2);
      const angle = angleBase + ((((hash % 17) - 8) * 0.014));
      const anchorX = Math.cos(angle) * anchorRadius;
      const anchorY = Math.sin(angle) * anchorRadius * 0.82;
      applyBucketMemberLayout(bucket, anchorX, anchorY, angle);
    });
    const ungroupedNodes = (Array.isArray(nodes) ? nodes : []).filter((node) => !String(node?.groupKey || '').trim());
    if (!ungroupedNodes.length) return;
    const totalUngrouped = ungroupedNodes.length;
    ungroupedNodes.forEach((node, index) => {
      const hash = hashString(String(node?.id || index));
      const outerRadius = getUngroupedOuterRadius(getGroupedAnchorRadius(bucketCount, node?.role), node?.role);
      const angleBase = totalUngrouped <= 1
        ? ((hash % 360) * Math.PI) / 180
        : (-Math.PI / 2) + ((index / totalUngrouped) * Math.PI * 2);
      const angle = angleBase + ((((hash % 15) - 7) * 0.01));
      node.seedX = Math.cos(angle) * outerRadius;
      node.seedY = Math.sin(angle) * outerRadius * 0.84;
    });
  }

  function canPatchGraphInPlace(payload) {
    if (!state.active || !state.host || !state.layoutKey) return false;
    const nextLayoutKey = String(payload?.layoutKey || '').trim();
    if (!nextLayoutKey || nextLayoutKey !== state.layoutKey) return false;
    const nextNodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
    const nextEdges = Array.isArray(payload?.edges) ? payload.edges : [];
    if (state.nodeModels.length !== nextNodes.length) return false;
    if (state.edgeModels.length !== nextEdges.length) return false;
    const currentNodeIds = new Set(state.nodeModels.map((node) => String(node?.id || '').trim()).filter(Boolean));
    if (currentNodeIds.size !== nextNodes.length) return false;
    return nextNodes.every((node) => currentNodeIds.has(String(node?.id || '').trim()));
  }

  function syncModelsFromPayload(payload) {
    const nextNodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
    const nextNodeById = new Map(nextNodes.map((node) => [String(node?.id || '').trim(), node]));
    const totalCount = nextNodes.length;
    const previousGroupSignature = buildGroupLayoutSignature(state.nodeModels);
    const previousEdgeSignature = buildEdgeLayoutSignature(state.edgeModels);
    state.nodeModels.forEach((node) => {
      const incoming = nextNodeById.get(String(node?.id || '').trim());
      if (!incoming) return;
      const nextPinned = incoming.pinned === true;
      const pinnedChanged = !!node.pinned !== nextPinned;
      node.rawId = incoming.rawId;
      node.kind = incoming.kind;
      node.role = incoming.role;
      node.label = incoming.label;
      node.wormId = incoming.wormId;
      node.wormRole = incoming.wormRole;
      node.wormOrder = incoming.wormOrder;
      node.transitionScore = incoming.transitionScore;
      node.timeNorm = incoming.timeNorm;
      node.groupKey = incoming.groupKey;
      node.groupStroke = incoming.groupStroke;
      node.groupGlow = incoming.groupGlow;
      node.hierarchyClusterId = String(incoming?.hierarchyClusterId || '').trim();
      node.linkedProjectId = String(incoming?.linkedProjectId || '').trim();
      node.parentFixedNodeId = String(incoming?.parentFixedNodeId || '').trim();
      node.seedX = incoming.seedX;
      node.seedY = incoming.seedY;
      node.radius = nodeRadius(incoming.kind, totalCount);
      node.fontSize = nodeFontSize(totalCount);
      node.pinned = nextPinned;
      if (pinnedChanged) {
        if (nextPinned) {
          node.fx = node.x || incoming.seedX || 0;
          node.fy = node.y || incoming.seedY || 0;
        } else {
          node.fx = null;
          node.fy = null;
        }
      }
    });
    applyGroupedSeedLayout(state.nodeModels);
    const nodeById = new Map(state.nodeModels.map((node) => [String(node?.id || '').trim(), node]));
    state.edgeModels = (Array.isArray(payload?.edges) ? payload.edges : [])
      .map((edge) => ({
        source: nodeById.get(String(edge?.source || '').trim()) || null,
        target: nodeById.get(String(edge?.target || '').trim()) || null,
        kind: String(edge?.kind || 'relation').trim() || 'relation',
      }))
      .filter((edge) => edge.source && edge.target);
    const groupChanged = previousGroupSignature !== buildGroupLayoutSignature(state.nodeModels);
    const edgeChanged = previousEdgeSignature !== buildEdgeLayoutSignature(state.edgeModels);
    if (groupChanged) {
      clearPositionCache();
      state.nodeModels.forEach((node) => {
        if (node?.pinned) return;
        node.x = Number.isFinite(node?.seedX) ? node.seedX : 0;
        node.y = Number.isFinite(node?.seedY) ? node.seedY : 0;
        node.vx = 0;
        node.vy = 0;
      });
    }
    return groupChanged || edgeChanged;
  }

  function rebuildGraphFromPayload(payload) {
    const nextLayoutKey = String(payload?.layoutKey || '').trim();
    if (nextLayoutKey && nextLayoutKey !== state.layoutKey) {
      clearPositionCache();
    }
    resetTransientInteractionState();
    state.layoutKey = nextLayoutKey;
    state.payload = payload;
    state.focusImpulse = null;
    clearRendererLayers();
    buildModels(payload);
    applyGroupedSeedLayout(state.nodeModels);
    updateVisibility();
    setupSimulation();
    updateNodePositions({ refreshVisuals: true });
  }

  function patchGraphFromPayload(payload) {
    const previousFocusKind = String(state.payload?.focusKind || '').trim();
    if (state.pointer?.type === 'node') {
      resetTransientInteractionState();
    }
    state.payload = payload;
    const graphStructureChanged = syncModelsFromPayload(payload);
    pruneRuntimeStateForNodeIds(new Set(state.nodeModels.map((node) => String(node?.id || '').trim()).filter(Boolean)));
    updateVisibility();
    const nextFocusKind = String(payload?.focusKind || '').trim();
    if (graphStructureChanged) {
      setupSimulation();
    }
    updateNodePositions({ refreshVisuals: true });
    if (String(payload?.layoutMode || '').trim() === 'worms' && previousFocusKind !== nextFocusKind) {
      primeFocusImpulse(nextFocusKind);
    }
  }

  function clearPositionCache() {
    state.positionCache.clear();
  }

  function focusStrength(node) {
    if (!state.payload) return 0.045;
    if (state.payload.focusKind === 'flash' && node.role === 'flash') return 0.06;
    if (state.payload.focusKind === 'fixed' && node.role === 'fixed') return 0.06;
    return 0.03;
  }

  function peripheralStrength(node) {
    if (!state.payload) return 0.012;
    const focusKind = state.payload.focusKind || '';
    if (!focusKind) return 0.01;
    return node.role === focusKind ? 0.012 : 0.085;
  }

  function getSameGroupEdgeProfile(edge, group) {
    const sourceDegree = group?.degreeByNode?.get(String(edge?.source?.id || '').trim()) || 0;
    const targetDegree = group?.degreeByNode?.get(String(edge?.target?.id || '').trim()) || 0;
    const lowDegreePair = sourceDegree <= 2 && targetDegree <= 2;
    const fixedPair = edge?.source?.role === 'fixed' && edge?.target?.role === 'fixed';
    if (group?.isSparse) {
      if (fixedPair) {
        return {
          distance: lowDegreePair ? 48 : 56,
          strength: 0.5,
          maxSpan: lowDegreePair ? 102 : 112,
        };
      }
      return {
        distance: lowDegreePair ? 52 : 60,
        strength: 0.42,
        maxSpan: lowDegreePair ? 94 : 104,
      };
    }
    if (fixedPair) {
      return {
        distance: 68,
        strength: 0.4,
        maxSpan: 120,
      };
    }
    return {
      distance: 72,
      strength: 0.36,
      maxSpan: 110,
    };
  }

  function constrainSameGroupEdgeSpans(groupStats) {
    const activeDragNodeId = state.pointer?.type === 'node'
      ? String(state.pointer.nodeId || '').trim()
      : '';
    state.edgeModels.forEach((edge) => {
      const source = edge?.source || null;
      const target = edge?.target || null;
      if (!source || !target) return;
      const sourceGroup = String(source?.groupKey || '').trim();
      const targetGroup = String(target?.groupKey || '').trim();
      if (!sourceGroup || sourceGroup !== targetGroup) return;
      if (activeDragNodeId && (String(source?.id || '').trim() === activeDragNodeId || String(target?.id || '').trim() === activeDragNodeId)) return;
      const group = groupStats.get(sourceGroup);
      const profile = getSameGroupEdgeProfile(edge, group);
      const sourceX = Number.isFinite(source?.x) ? source.x : (Number.isFinite(source?.seedX) ? source.seedX : 0);
      const sourceY = Number.isFinite(source?.y) ? source.y : (Number.isFinite(source?.seedY) ? source.seedY : 0);
      const targetX = Number.isFinite(target?.x) ? target.x : (Number.isFinite(target?.seedX) ? target.seedX : 0);
      const targetY = Number.isFinite(target?.y) ? target.y : (Number.isFinite(target?.seedY) ? target.seedY : 0);
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const distance = Math.hypot(dx, dy);
      if (!Number.isFinite(distance) || distance <= profile.maxSpan || distance <= 1) return;
      const nextDistance = profile.maxSpan;
      const shrinkRatio = (distance - nextDistance) / distance;
      const moveX = dx * shrinkRatio * 0.5;
      const moveY = dy * shrinkRatio * 0.5;
      const sourceLocked = source?.pinned === true || (source?.fx != null && source?.fy != null);
      const targetLocked = target?.pinned === true || (target?.fx != null && target?.fy != null);
      if (sourceLocked && targetLocked) return;
      if (sourceLocked) {
        target.x = targetX - (moveX * 2);
        target.y = targetY - (moveY * 2);
        return;
      }
      if (targetLocked) {
        source.x = sourceX + (moveX * 2);
        source.y = sourceY + (moveY * 2);
        return;
      }
      source.x = sourceX + moveX;
      source.y = sourceY + moveY;
      target.x = targetX - moveX;
      target.y = targetY - moveY;
    });
  }

  function setupSimulation() {
    if (state.simulation) state.simulation.stop();
    const focusKind = state.payload?.focusKind || '';
    const isWormLayout = String(state.payload?.layoutMode || '').trim() === 'worms';
    const groupStats = buildGroupStats();
    const wormLinks = isWormLayout ? buildWormChainLinks(state.nodeModels) : [];
    const hierarchyLinks = isWormLayout ? getVirtualHierarchyEdges() : [];
    const simulation = d3Force.forceSimulation(state.nodeModels)
      .force('charge', d3Force.forceManyBody().strength((node) => {
        if (isWormLayout) return node.role === 'flash' ? -40 : -66;
        if (focusKind === 'fixed') return node.role === 'fixed' ? -258 : -360;
        if (focusKind === 'flash') return node.role === 'flash' ? -208 : -320;
        return node.role === 'fixed' ? -286 : -226;
      }))
      .force('center', d3Force.forceCenter(0, 0))
      .force('collision', d3Force.forceCollide().radius((node) => {
        const group = groupStats.get(String(node?.groupKey || '').trim());
        if (isWormLayout) {
          if (node.role === 'fixed') return (node.radius || 8) + (node.groupKey ? 8 : 12);
          return Math.max(6, (node.radius || 8) * 0.82) + (node.groupKey ? 2.2 : 4.4);
        }
        const groupPadding = node.groupKey
          ? (group?.isSparse ? (node.role === 'fixed' ? 20 : 10) : (node.role === 'fixed' ? 16 : 8))
          : 0;
        if (focusKind === 'fixed') return node.role === 'fixed' ? node.radius + 32 + groupPadding : node.radius + 28 + groupPadding;
        if (focusKind === 'flash') return node.role === 'flash' ? node.radius + 26 + groupPadding : node.radius + 31 + groupPadding;
        return node.radius + 27 + groupPadding;
      }).strength(1))
      .force('x', d3Force.forceX((node) => {
        return node.seedX ?? 0;
      }).strength((node) => {
        if (isWormLayout) return node.groupKey ? 0.64 : 0.52;
        return node.groupKey ? (node.role === 'fixed' ? 0.3 : 0.24) : focusStrength(node);
      }))
      .force('y', d3Force.forceY((node) => {
        return node.seedY ?? 0;
      }).strength((node) => {
        if (isWormLayout) return node.groupKey ? 0.64 : 0.52;
        return node.groupKey ? (node.role === 'fixed' ? 0.3 : 0.24) : focusStrength(node);
      }));
    if (!isWormLayout) {
      simulation.force('link', d3Force.forceLink(state.edgeModels).id((node) => node.id).distance((edge) => {
        if (edge.source.groupKey && edge.source.groupKey === edge.target.groupKey) {
          const group = groupStats.get(String(edge.source.groupKey || '').trim());
          return getSameGroupEdgeProfile(edge, group).distance;
        }
        if (edge.source.groupKey && edge.target.groupKey && edge.source.groupKey !== edge.target.groupKey) return 196;
        return 156;
      }).strength((edge) => {
        if (edge.source.groupKey && edge.source.groupKey === edge.target.groupKey) {
          const group = groupStats.get(String(edge.source.groupKey || '').trim());
          return getSameGroupEdgeProfile(edge, group).strength;
        }
        if (edge.source.groupKey && edge.target.groupKey && edge.source.groupKey !== edge.target.groupKey) return 0.15;
        return 0.22;
      }));
    } else {
      simulation.force('link', null);
    }
    if (isWormLayout) {
      simulation.force('wormChain', d3Force.forceLink(wormLinks).id((node) => node.id).distance((edge) => {
        const sourceRole = String(edge?.source?.wormRole || '').trim();
        const targetRole = String(edge?.target?.wormRole || '').trim();
        if (sourceRole === 'anchor' || targetRole === 'anchor') {
          return Math.max(42, ((Number(edge?.source?.radius) || 8) + (Number(edge?.target?.radius) || 8)) * 0.82);
        }
        if (sourceRole === 'turn' || targetRole === 'turn') return 12;
        if (sourceRole === 'seed' || targetRole === 'seed') return 11;
        return 10;
      }).strength((edge) => {
        const sourceRole = String(edge?.source?.wormRole || '').trim();
        const targetRole = String(edge?.target?.wormRole || '').trim();
        if (sourceRole === 'anchor' || targetRole === 'anchor') return 0.92;
        if (sourceRole === 'turn' || targetRole === 'turn') return 0.95;
        if (sourceRole === 'seed' || targetRole === 'seed') return 0.86;
        return 0.78;
      }).iterations(2));
      simulation.force('wormHierarchy', d3Force.forceLink(hierarchyLinks).id((node) => node.id).distance((edge) => {
        return Math.max(84, ((Number(edge?.source?.radius) || 16) + (Number(edge?.target?.radius) || 16)) * 1.9);
      }).strength(() => 0.36).iterations(2));
    } else {
      simulation.force('wormChain', null);
      simulation.force('wormHierarchy', null);
    }
    if (focusKind) {
      simulation
        .force('peripheralX', d3Force.forceX((node) => {
          if (node.role === focusKind) return 0;
          return node.seedX ?? 0;
        }).strength((node) => peripheralStrength(node)))
        .force('peripheralY', d3Force.forceY((node) => {
          if (node.role === focusKind) return 0;
          return node.seedY ?? 0;
        }).strength((node) => peripheralStrength(node)));
    }
    if (isWormLayout) {
      simulation.alpha(0.72).alphaDecay(0.072).velocityDecay(0.36);
    } else {
      simulation.alpha(0.9).alphaDecay(0.08).velocityDecay(0.45);
    }
    simulation.on('tick', () => {
      if (!isWormLayout) constrainSameGroupEdgeSpans(groupStats);
      updateNodePositions({ refreshVisuals: false });
      state.nodeModels.forEach((node) => {
        state.positionCache.set(node.id, { x: node.x || 0, y: node.y || 0 });
      });
    });
    state.simulation = simulation;
  }

  function createNodeView(node) {
    const container = new PIXI.Container();
    container.sortableChildren = true;
    container.cursor = 'pointer';

    const ring = new PIXI.Graphics();
    const core = new PIXI.Graphics();
    const label = new PIXI.Text({
      text: shortText(node.label, 10),
      style: {
        fontFamily: '"SF Pro Display", "PingFang SC", sans-serif',
        fontSize: node.fontSize || 12,
        fill: isDarkMode() ? 0xd6d6d6 : 0x666666,
        align: 'center',
        padding: 4,
        lineJoin: 'round',
      },
    });
    label.anchor.set(0.5, 0);
    label.y = node.radius + 10;
    label.resolution = getDeviceResolution();

    container.addChild(ring);
    container.addChild(core);
    container.addChild(label);
    state.nodesLayer.addChild(container);

    const view = {
      container,
      ring,
      core,
      label,
      node,
      labelState: {
        fontSize: node.fontSize || 12,
        fill: isDarkMode() ? 0xd6d6d6 : 0x666666,
        text: shortText(node.label, 10),
        y: (node.radius || 8) + 10,
        visible: true,
      },
    };
    state.nodeViews.set(node.id, view);
    return view;
  }

  function drawEdges() {
    const background = state.background;
    if (!background) return;
    const isWormLayout = String(state.payload?.layoutMode || '').trim() === 'worms';
    const darkMode = isDarkMode();
    const focusKind = state.payload?.focusKind || '';
    const renderEdges = getRenderableEdgeModels();
    background.clear();
    renderEdges.forEach((edge) => {
      const source = edge?.source || null;
      const target = edge?.target || null;
      if (!source || !target) return;
      if (source.visible === false || target.visible === false) return;
      const edgeKind = String(edge?.kind || '').trim();
      if (!isWormLayout && focusKind) {
        const sourceFocused = source.role === focusKind;
        const targetFocused = target.role === focusKind;
        if (!sourceFocused && !targetFocused) return;
      }
      const wormDimmedByFocus = isWormLayout && !!focusKind && (source.role !== focusKind || target.role !== focusKind);
      const wormFixedLinked = isWormLayout && !focusKind && (source.role === 'fixed' || target.role === 'fixed');
      const strokeStyle = isWormLayout
        ? isHierarchyStyledWormEdge(edge)
          ? {
            width: 1.35,
            color: darkMode ? 0xd8d8d8 : 0x555555,
            alpha: wormDimmedByFocus ? 0.2 : (wormFixedLinked ? 0.6 : (darkMode ? 0.46 : 0.34)),
            cap: 'round',
            join: 'round',
          }
          : (edgeKind === 'worm-anchor' || isFlashFixedRelationEdge(edge))
            ? {
              width: 0.95,
              color: darkMode ? 0xc8c8c8 : 0x7a7a7a,
              alpha: wormDimmedByFocus ? 0.18 : (wormFixedLinked ? 0.28 : (darkMode ? 0.24 : 0.18)),
              cap: 'round',
              join: 'round',
            }
          : {
            width: 0.9,
            color: darkMode ? 0xb4b4b4 : 0x8a8a8a,
            alpha: wormDimmedByFocus ? 0.2 : (wormFixedLinked ? 0.6 : (darkMode ? 0.22 : 0.18)),
            cap: 'round',
            join: 'round',
          }
        : {
          width: 1.6,
          color: darkMode ? 0x7a7a7a : 0xafafaf,
          alpha: darkMode ? 0.34 : 0.3,
          cap: 'round',
          join: 'round',
        };
      background.setStrokeStyle(strokeStyle);
      background.moveTo(
        Number.isFinite(source?.renderX) ? source.renderX : (source.x || 0),
        Number.isFinite(source?.renderY) ? source.renderY : (source.y || 0),
      );
      background.lineTo(
        Number.isFinite(target?.renderX) ? target.renderX : (target.x || 0),
        Number.isFinite(target?.renderY) ? target.renderY : (target.y || 0),
      );
      background.stroke();
    });
  }

  function applyNodeVisual(view) {
    const { node, ring, core, label, container } = view;
    const isWormLayout = String(state.payload?.layoutMode || '').trim() === 'worms';
    container.visible = node.visible !== false;
    if (container.visible === false) return;
    const darkMode = isDarkMode();
    const isFixed = node.role === 'fixed';
    const isDropTarget = state.dropTargetNodeId === node.id;
    const focusKind = state.payload?.focusKind || '';
    const isPeripheralGhost = !isWormLayout && !!focusKind && node.role !== focusKind;
    const isWormPeripheralGhost = isWormLayout && !!focusKind && node.role !== focusKind;
    const isWormFocusedRole = isWormLayout && !!focusKind && node.role === focusKind;
    const baseVisualRadius = isPeripheralGhost
      ? Math.max(5, Math.round((node.radius || 8) * 0.64))
      : (node.radius || 8);
    const wormTurnBoost = isWormLayout
      ? (String(node?.wormRole || '').trim() === 'turn' ? 0.6 : (String(node?.wormRole || '').trim() === 'seed' ? 0.35 : 0))
      : 0;
    const visualRadius = isWormLayout
      ? Math.max(6, Math.round(baseVisualRadius * 1.02) + wormTurnBoost)
      : baseVisualRadius;
    const hoverOffsetMagnitude = Math.hypot(Number(node?.hoverOffsetX) || 0, Number(node?.hoverOffsetY) || 0);
    const nodeId = String(node?.id || '').trim();
    const activeDragNodeId = state.pointer?.type === 'node' ? String(state.pointer.nodeId || '').trim() : '';
    const previewNodeId = String(state.previewNodeId || '').trim();
    const isPreviewNode = previewNodeId === nodeId;
    const isHoveredNode = String(state.hoveredNodeId || '').trim() === nodeId || activeDragNodeId === nodeId || isPreviewNode;
    const hoverScale = isWormLayout
      ? (1 + Math.min(0.34, (hoverOffsetMagnitude * 0.018) + (isHoveredNode ? (isPreviewNode ? 0.16 : 0.11) : 0)))
      : (isHoveredNode ? 1.82 : 1);
    const focusScale = isWormFocusedRole ? 1.1 : 1;
    container.scale.set(hoverScale * focusScale);

    ring.clear();
    if (isWormLayout && isHoveredNode) {
      ring.setStrokeStyle({
        width: isPreviewNode ? 2.1 : 1.5,
        color: isPreviewNode ? 0x50d6de : (darkMode ? 0xf2f2f2 : 0x373737),
        alpha: isPreviewNode ? 0.3 : (darkMode ? 0.38 : 0.28),
        cap: 'round',
        join: 'round',
      });
      ring.circle(0, 0, visualRadius + (isPreviewNode ? 8.6 : 6.2)).stroke();
    } else if (!isWormLayout && isHoveredNode) {
      ring.setStrokeStyle({
        width: darkMode ? 1.2 : 1.1,
        color: darkMode ? 0xf3f3f3 : 0x2e2e2e,
        alpha: darkMode ? 0.48 : 0.34,
        cap: 'round',
        join: 'round',
      });
      ring.circle(0, 0, visualRadius + 6.8).stroke();
    }
    if (isDropTarget) {
      ring.setStrokeStyle({
        width: darkMode ? 1.8 : 1.5,
        color: darkMode ? 0xd2d2d2 : 0x6d6d6d,
        alpha: darkMode ? 0.82 : 0.68,
        cap: 'round',
        join: 'round',
      });
      ring.circle(0, 0, visualRadius + 8).stroke();
    }

    core.clear();
    if (isWormLayout && isFixed) {
      core.setFillStyle({ color: darkMode ? 0x979797 : 0x4a4a4a, alpha: darkMode ? 0.18 : 0.12 });
      core.circle(0, 0, visualRadius + 7).fill();
      core.setFillStyle({ color: darkMode ? 0xcfcfcf : 0x777777, alpha: darkMode ? 0.94 : 0.9 });
      core.circle(0, 0, visualRadius + 1.2).fill();
      core.setFillStyle({ color: darkMode ? 0xe8e8e8 : 0xb5b5b5, alpha: 1 });
      core.circle(0, 0, Math.max(6, visualRadius - 3.2)).fill();
    } else if (isWormLayout) {
      const wormColor = getWormCoreColor(node);
      const isTurn = String(node?.wormRole || '').trim() === 'turn';
      const isSeed = String(node?.wormRole || '').trim() === 'seed';
      const outerAlpha = isTurn ? 0.09 : (isSeed ? 0.11 : 0.07);
      core.setFillStyle({ color: wormColor, alpha: outerAlpha });
      core.circle(0, 0, visualRadius + (isSeed ? 2.6 : 2.0)).fill();
      core.setFillStyle({ color: wormColor, alpha: isSeed ? 0.92 : 0.86 });
      core.circle(0, 0, visualRadius).fill();
    } else if (isPeripheralGhost) {
      core.setFillStyle({
        color: darkMode ? 0xe8e8e8 : 0x343434,
        alpha: darkMode ? 0.28 : 0.22,
      });
      core.circle(0, 0, visualRadius + 1.5).fill();
      core.setFillStyle({
        color: darkMode ? 0xcecece : 0x707070,
        alpha: darkMode ? 0.76 : 0.62,
      });
      core.circle(0, 0, visualRadius).fill();
    } else if (isFixed) {
      core.setFillStyle({ color: darkMode ? 0x979797 : 0x4a4a4a, alpha: darkMode ? 0.2 : 0.14 });
      core.circle(0, 0, visualRadius + 4).fill();
      core.setFillStyle({ color: darkMode ? 0xcfcfcf : 0x777777, alpha: darkMode ? 0.92 : 0.88 });
      core.circle(0, 0, visualRadius + 0.8).fill();
      core.setFillStyle({ color: darkMode ? 0xe8e8e8 : 0xb5b5b5, alpha: 1 });
      core.circle(0, 0, Math.max(4, visualRadius - 2.2)).fill();
    } else {
      core.setFillStyle({ color: darkMode ? 0xf2f2f2 : 0x262626, alpha: darkMode ? 0.11 : 0.07 });
      core.circle(0, 0, visualRadius + 3.6).fill();
      core.setFillStyle({ color: darkMode ? 0xe6e6e6 : 0x424242, alpha: darkMode ? 0.96 : 0.84 });
      core.circle(0, 0, visualRadius + 0.7).fill();
      core.setFillStyle({ color: darkMode ? 0xffffff : 0x5a5a5a, alpha: darkMode ? 0.96 : 0.88 });
      core.circle(0, 0, Math.max(3.6, visualRadius - 2)).fill();
    }

    const wormBaseAlpha = !focusKind && isFixed ? 0.6 : 0.94;
    container.alpha = isWormLayout
      ? (isWormPeripheralGhost ? 0.2 : (node.dimmed ? 0.16 : wormBaseAlpha))
      : (isPeripheralGhost ? 0.58 : (node.dimmed ? 0.34 : (isHoveredNode ? 1 : 0.96)));
    const nextVisible = !!node.showLabel && !isPeripheralGhost;
    const nextFontSize = node.fontSize || 12;
    const nextFill = darkMode ? 0xd6d6d6 : 0x666666;
    const nextText = shortText(node.label, 10);
    const nextY = visualRadius + 10;
    const labelState = view.labelState || (view.labelState = {});
    if (labelState.visible !== nextVisible) {
      label.visible = nextVisible;
      labelState.visible = nextVisible;
    }
    if (labelState.fontSize !== nextFontSize) {
      label.style.fontSize = nextFontSize;
      labelState.fontSize = nextFontSize;
    }
    if (labelState.fill !== nextFill) {
      label.style.fill = nextFill;
      labelState.fill = nextFill;
    }
    if (labelState.text !== nextText) {
      label.text = nextText;
      labelState.text = nextText;
    }
    if (labelState.y !== nextY) {
      label.y = nextY;
      labelState.y = nextY;
    }
  }

  function updateNodePositions(options = {}) {
    const refreshVisuals = options.refreshVisuals !== false;
    applyWormHoverPresentationOffsets(performance.now());
    drawEdges();
    state.nodeModels.forEach((node) => {
      const view = state.nodeViews.get(node.id) || createNodeView(node);
      view.node = node;
      view.container.position.set(
        Number.isFinite(node?.renderX) ? node.renderX : (node.x || 0),
        Number.isFinite(node?.renderY) ? node.renderY : (node.y || 0),
      );
      if (refreshVisuals) applyNodeVisual(view);
    });
  }

  function refreshPreviewNodeVisuals(previousNodeId = '', nextNodeId = '') {
    const ids = [...new Set([previousNodeId, nextNodeId].map((value) => String(value || '').trim()).filter(Boolean))];
    ids.forEach((nodeId) => {
      const view = state.nodeViews.get(nodeId);
      if (!view) return;
      applyNodeVisual(view);
    });
  }

  function clearRendererLayers() {
    state.nodeViews.forEach(({ container }) => container.destroy({ children: true }));
    state.nodeViews.clear();
    if (state.nodesLayer) state.nodesLayer.removeChildren();
    if (state.labelsLayer) state.labelsLayer.removeChildren();
    if (state.background) state.background.clear();
  }

  function updateVisibility() {
    const focusKind = state.payload?.focusKind || '';
    const isWormLayout = String(state.payload?.layoutMode || '').trim() === 'worms';
    state.nodeModels.forEach((node) => {
      if (isWormLayout) {
        node.visible = true;
        node.showLabel = false;
        node.dimmed = false;
        return;
      }
      if (focusKind === 'flash') {
        node.visible = node.role === 'flash';
        node.showLabel = node.role === 'flash';
        node.dimmed = false;
      } else if (focusKind === 'fixed') {
        node.visible = node.role === 'fixed';
        node.showLabel = node.role === 'fixed';
        node.dimmed = false;
      } else {
        node.visible = true;
        node.showLabel = true;
        node.dimmed = false;
      }
    });
  }

  function render(payload) {
    rebuildGraphFromPayload(payload);
  }

  function toWorldPoint(clientX, clientY) {
    const rect = state.host.getBoundingClientRect();
    const center = getViewportCenter();
    const x = (clientX - rect.left - center.x - state.panX) / state.scale;
    const y = (clientY - rect.top - center.y - state.panY) / state.scale;
    return { x, y };
  }

  function findNodeAt(clientX, clientY, options = {}) {
    const excludeNodeId = String(options.excludeNodeId || '').trim();
    const maxDistance = Number.isFinite(Number(options.maxDistance)) ? Number(options.maxDistance) : Infinity;
    const point = toWorldPoint(clientX, clientY);
    let best = null;
    for (const node of state.nodeModels) {
      if (node.visible === false) continue;
      if (excludeNodeId && node.id === excludeNodeId) continue;
      const nodeX = Number.isFinite(node?.renderX) ? node.renderX : (node.x || 0);
      const nodeY = Number.isFinite(node?.renderY) ? node.renderY : (node.y || 0);
      const dx = point.x - nodeX;
      const dy = point.y - nodeY;
      const distance = Math.hypot(dx, dy);
      if (distance <= node.radius + 12) {
        if (!best || distance < best.distance) best = { node, distance };
      }
    }
    if (best && best.distance > maxDistance) return null;
    return best?.node || null;
  }

  function findNodeBySource(kind = '', rawId = '') {
    const normalizedKind = String(kind || '').trim();
    const normalizedId = String(rawId || '').trim();
    if (!normalizedKind || !normalizedId) return null;
    return state.nodeModels.find((node) => String(node?.kind || '').trim() === normalizedKind && String(node?.rawId || '').trim() === normalizedId) || null;
  }

  function getNodeClientPoint(kind = '', rawId = '') {
    const node = findNodeBySource(kind, rawId);
    if (!node || !state.host) return null;
    const rect = state.host.getBoundingClientRect();
    const center = getViewportCenter();
    const renderX = Number.isFinite(node?.renderX) ? node.renderX : (node.x || 0);
    const renderY = Number.isFinite(node?.renderY) ? node.renderY : (node.y || 0);
    return {
      x: rect.left + center.x + state.panX + (renderX * state.scale),
      y: rect.top + center.y + state.panY + (renderY * state.scale),
    };
  }

  function getNodeNavigationMeta(kind = '', rawId = '') {
    const node = findNodeBySource(kind, rawId);
    const point = getNodeClientPoint(kind, rawId);
    if (!node || !point) return null;
    const groupKey = String(node?.groupKey || '').trim();
    const adjacentGroupKeys = [];
    if (groupKey) {
      const seen = new Set();
      state.edgeModels.forEach((edge) => {
        const sourceGroup = String(edge?.source?.groupKey || '').trim();
        const targetGroup = String(edge?.target?.groupKey || '').trim();
        if (!sourceGroup || !targetGroup || sourceGroup === targetGroup) return;
        if (sourceGroup === groupKey && !seen.has(targetGroup)) {
          seen.add(targetGroup);
          adjacentGroupKeys.push(targetGroup);
        } else if (targetGroup === groupKey && !seen.has(sourceGroup)) {
          seen.add(sourceGroup);
          adjacentGroupKeys.push(sourceGroup);
        }
      });
    }
    return {
      point,
      groupKey,
      adjacentGroupKeys,
      wormId: String(node?.wormId || '').trim(),
      hierarchyClusterId: String(node?.hierarchyClusterId || '').trim(),
      linkedProjectId: String(node?.linkedProjectId || '').trim(),
    };
  }

  function centerNodeInViewport(kind = '', rawId = '', options = {}) {
    const node = findNodeBySource(kind, rawId);
    if (!node || !state.host) return false;
    const rect = state.host.getBoundingClientRect();
    const center = getViewportCenter();
    const currentPoint = getNodeClientPoint(kind, rawId);
    if (!currentPoint) return false;
    const desiredClientX = rect.left + center.x;
    const desiredClientY = rect.top + center.y;
    const targetPanX = state.panX + (desiredClientX - Number(currentPoint.x || 0));
    const targetPanY = state.panY + (desiredClientY - Number(currentPoint.y || 0));
    state.panTargetX = targetPanX;
    state.panTargetY = targetPanY;
    state.panVelocityX = 0;
    state.panVelocityY = 0;
    if (options.motion !== false) {
      primePreviewCenteringImpulse(kind, rawId);
    }
    if (options.immediate === true) {
      state.panX = targetPanX;
      state.panY = targetPanY;
      applyViewport();
      return true;
    }
    scheduleViewportFrame();
    return true;
  }

  function notifyThoughtGraphNodeHover(node, clientX, clientY) {
    if (typeof window.handleThoughtGraphNodeHover !== 'function') return;
    const kind = String(node?.kind || '').trim();
    const rawId = String(node?.rawId || '').trim();
    window.handleThoughtGraphNodeHover(
      kind,
      rawId,
      Number(clientX) || 0,
      Number(clientY) || 0,
    );
  }

  function setHovered(node) {
    if (state.previewNodeId) return false;
    const nextGroupKey = node?.groupKey || '';
    const nextNodeId = node?.id || '';
    if (state.hoveredGroupKey === nextGroupKey && state.hoveredNodeId === nextNodeId) return false;
    state.hoveredGroupKey = nextGroupKey;
    state.hoveredNodeId = nextNodeId;
    updateNodePositions({ refreshVisuals: true });
    if (shouldAnimateWormHoverPresentation()) {
      scheduleWormHoverFrame();
    } else {
      stopWormHoverFrame();
    }
    return true;
  }

  function setDropTarget(node, options = {}) {
    const nextId = node?.id || '';
    const nextGroupKey = node?.groupKey || '';
    const nextHoveredNodeId = nextId;
    if (
      state.dropTargetNodeId === nextId &&
      state.hoveredGroupKey === nextGroupKey &&
      state.hoveredNodeId === nextHoveredNodeId
    ) return false;
    state.dropTargetNodeId = nextId;
    state.hoveredGroupKey = nextGroupKey;
    state.hoveredNodeId = nextHoveredNodeId;
    if (options.deferRender !== true) {
      updateNodePositions({ refreshVisuals: true });
    }
    return true;
  }

  function clearDropTarget(options = {}) {
    if (!state.dropTargetNodeId && !state.hoveredGroupKey && !state.hoveredNodeId) return false;
    state.dropTargetNodeId = '';
    state.hoveredGroupKey = '';
    state.hoveredNodeId = '';
    if (options.deferRender !== true) {
      updateNodePositions({ refreshVisuals: true });
    }
    return true;
  }

  function freezeNodeDragContext(activeNodeId) {
    const isWormLayout = String(state.payload?.layoutMode || '').trim() === 'worms';
    if (isWormLayout) {
      return;
    }
    state.nodeModels.forEach((node) => {
      if (!node || node.id === activeNodeId) return;
      node.fx = node.x || 0;
      node.fy = node.y || 0;
    });
    state.simulation?.stop?.();
  }

  function releaseNodeDragContext(activeNodeId, restart = true) {
    const isWormLayout = String(state.payload?.layoutMode || '').trim() === 'worms';
    if (isWormLayout) {
      if (restart) {
        state.simulation?.alphaTarget?.(0);
        state.simulation?.alpha?.(0.46);
        state.simulation?.restart?.();
      }
      return;
    }
    state.nodeModels.forEach((node) => {
      if (!node || node.id === activeNodeId) return;
      if (node.pinned) return;
      node.fx = null;
      node.fy = null;
    });
    if (restart) {
      state.simulation?.alpha?.(0.42);
      state.simulation?.restart?.();
    }
  }

  function findNearestMergeTarget(sourceNode, options = {}) {
    if (!sourceNode) return null;
    const maxGap = Number.isFinite(Number(options.maxGap)) ? Number(options.maxGap) : 26;
    let best = null;
    state.nodeModels.forEach((node) => {
      if (!node || node.id === sourceNode.id || node.visible === false) return;
      const dx = (sourceNode.x || 0) - (node.x || 0);
      const dy = (sourceNode.y || 0) - (node.y || 0);
      const distance = Math.hypot(dx, dy);
      const allowedDistance = (sourceNode.radius || 0) + (node.radius || 0) + maxGap;
      if (distance > allowedDistance) return;
      const score = distance - ((sourceNode.radius || 0) + (node.radius || 0));
      if (!best || score < best.score) {
        best = { node, score };
      }
    });
    return best?.node || null;
  }

  function bindCanvasEvents(canvas) {
    canvas.onpointerdown = (event) => {
      if (!state.active) return;
      if (event.button !== undefined && event.button !== 0) return;
      notifyThoughtGraphNodeHover(null, event.clientX, event.clientY);
      const hitNode = findNodeAt(event.clientX, event.clientY);
      canvas.setPointerCapture?.(event.pointerId);
      if (hitNode) {
        hitNode.fx = hitNode.x;
        hitNode.fy = hitNode.y;
        freezeNodeDragContext(hitNode.id);
        state.pointer = {
          type: 'node',
          pointerId: event.pointerId,
          nodeId: hitNode.id,
          kind: hitNode.kind,
          rawId: hitNode.rawId,
          moved: false,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startNodeX: hitNode.x || 0,
          startNodeY: hitNode.y || 0,
          lastMoveAt: performance.now(),
          lastClientX: event.clientX,
          lastClientY: event.clientY,
          lastWorldX: hitNode.x || 0,
          lastWorldY: hitNode.y || 0,
          dragVX: 0,
          dragVY: 0,
        };
      } else {
        state.pointer = {
          type: 'pan',
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: state.panX,
          originY: state.panY,
          moved: false,
          lastMoveAt: performance.now(),
          lastClientX: event.clientX,
          lastClientY: event.clientY,
        };
      }
      event.preventDefault();
      event.stopPropagation();
    };

    canvas.onpointermove = (event) => {
      if (!state.active) return;
      if (!state.pointer) {
        if (state.previewNodeId) {
          notifyThoughtGraphNodeHover(null, event.clientX, event.clientY);
          return;
        }
        const hovered = findNodeAt(event.clientX, event.clientY);
        setHovered(hovered);
        notifyThoughtGraphNodeHover(hovered, event.clientX, event.clientY);
        return;
      }
      notifyThoughtGraphNodeHover(null, event.clientX, event.clientY);
      if (state.pointer.type === 'pan') {
        const nextPanX = state.pointer.originX + (event.clientX - state.pointer.startX);
        const nextPanY = state.pointer.originY + (event.clientY - state.pointer.startY);
        const now = performance.now();
        const elapsed = Math.max(8, now - (state.pointer.lastMoveAt || now));
        const velocityScale = 16.667 / elapsed;
        state.panVelocityX = (nextPanX - state.panX) * velocityScale;
        state.panVelocityY = (nextPanY - state.panY) * velocityScale;
        state.panX = nextPanX;
        state.panY = nextPanY;
        state.panTargetX = nextPanX;
        state.panTargetY = nextPanY;
        state.pointer.moved = true;
        state.pointer.lastMoveAt = now;
        state.pointer.lastClientX = event.clientX;
        state.pointer.lastClientY = event.clientY;
        applyViewport();
        return;
      }
      if (state.pointer.type === 'node') {
        const node = state.nodeModels.find((entry) => entry.id === state.pointer.nodeId);
        if (!node) return;
        const moveDx = event.clientX - (Number.isFinite(state.pointer.startClientX) ? state.pointer.startClientX : event.clientX);
        const moveDy = event.clientY - (Number.isFinite(state.pointer.startClientY) ? state.pointer.startClientY : event.clientY);
        if (!state.pointer.moved && Math.abs(moveDx) <= 4 && Math.abs(moveDy) <= 4) {
          return;
        }
        const point = toWorldPoint(event.clientX, event.clientY);
        const now = performance.now();
        const elapsed = Math.max(8, now - (state.pointer.lastMoveAt || now));
        const velocityScale = 16.667 / elapsed;
        const deltaX = point.x - (Number.isFinite(state.pointer.lastWorldX) ? state.pointer.lastWorldX : point.x);
        const deltaY = point.y - (Number.isFinite(state.pointer.lastWorldY) ? state.pointer.lastWorldY : point.y);
        state.pointer.dragVX = (state.pointer.dragVX * 0.35) + (deltaX * velocityScale * 0.65);
        state.pointer.dragVY = (state.pointer.dragVY * 0.35) + (deltaY * velocityScale * 0.65);
        state.pointer.lastWorldX = point.x;
        state.pointer.lastWorldY = point.y;
        state.pointer.lastMoveAt = now;
        state.pointer.lastClientX = event.clientX;
        state.pointer.lastClientY = event.clientY;
        node.x = point.x;
        node.y = point.y;
        node.fx = point.x;
        node.fy = point.y;
        node.vx = state.pointer.dragVX;
        node.vy = state.pointer.dragVY;
        if (String(state.payload?.layoutMode || '').trim() === 'worms') {
          state.simulation?.alphaTarget?.(0.24);
          state.simulation?.restart?.();
        }
        state.pointer.moved = true;
        clearDropTarget({ deferRender: true });
        updateNodePositions({ refreshVisuals: false });
        return;
      }
    };

    const finishPointer = (event) => {
      if (!state.pointer) return;
      notifyThoughtGraphNodeHover(null, event?.clientX, event?.clientY);
      const pointer = state.pointer;
      if (pointer.type === 'node') {
        const node = state.nodeModels.find((entry) => entry.id === pointer.nodeId);
        const longPressHandled = state.longPressHandled === true;
        state.longPressHandled = false;
        let shouldRestartAfterRelease = false;
        const totalDx = (Number.isFinite(pointer.lastClientX) ? pointer.lastClientX : event?.clientX || 0) - (Number.isFinite(pointer.startClientX) ? pointer.startClientX : event?.clientX || 0);
        const totalDy = (Number.isFinite(pointer.lastClientY) ? pointer.lastClientY : event?.clientY || 0) - (Number.isFinite(pointer.startClientY) ? pointer.startClientY : event?.clientY || 0);
        const shouldTreatAsClick = !pointer.moved || (Math.abs(totalDx) <= 8 && Math.abs(totalDy) <= 8);
        if (node) {
          const isWormLayout = String(state.payload?.layoutMode || '').trim() === 'worms';
          if (isWormLayout && pointer.moved && !shouldTreatAsClick) {
            const inertiaScale = 1.08;
            node.vx = (Number(pointer.dragVX) || 0) * inertiaScale;
            node.vy = (Number(pointer.dragVY) || 0) * inertiaScale;
          }
          node.fx = null;
          node.fy = null;
        }
        if (longPressHandled) {
          clearDropTarget();
          shouldRestartAfterRelease = true;
        } else if (shouldTreatAsClick && node) {
          if (typeof window.handleThoughtGraphNodeOpen === 'function') {
            window.handleThoughtGraphNodeOpen(node.kind, node.rawId);
          }
        }
        clearDropTarget();
        releaseNodeDragContext(pointer.nodeId, shouldRestartAfterRelease || (pointer.moved && !shouldTreatAsClick));
      }
      state.pointer = null;
      if (state.simulation) state.simulation.alphaTarget(0);
      scheduleViewportFrame();
      canvas.releasePointerCapture?.(event.pointerId);
    };

    canvas.onpointerup = finishPointer;
    canvas.onpointercancel = finishPointer;
    canvas.onpointerleave = () => {
      if (!state.pointer) clearDropTarget();
      notifyThoughtGraphNodeHover(null, 0, 0);
    };

    canvas.oncontextmenu = (event) => {
      if (!state.active) return;
      notifyThoughtGraphNodeHover(null, event.clientX, event.clientY);
      const hitNode = findNodeAt(event.clientX, event.clientY);
      if (!hitNode) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.handleThoughtGraphNodeContextMenu === 'function') {
        window.handleThoughtGraphNodeContextMenu(hitNode.kind, hitNode.rawId, event.clientX, event.clientY);
      }
    };

    canvas.onwheel = (event) => {
      if (!state.active) return;
      notifyThoughtGraphNodeHover(null, event.clientX, event.clientY);
      const isZoomGesture = !!(event.ctrlKey || event.metaKey);
      if (isZoomGesture) {
        const previousScale = state.scale;
        const now = performance.now();
        const elapsed = Math.max(8, now - (state.lastFrameAt || now - 16.667));
        const multiplier = Math.exp(-event.deltaY * 0.00145);
        scaleAroundClientPoint((state.scaleTarget || state.scale || 1) * multiplier, event.clientX, event.clientY, { immediate: true, motion: false, rubberBand: true });
        pushScaleMomentum(previousScale, state.scale, elapsed);
        scheduleViewportFrame();
        scheduleWheelSettle();
      } else {
        state.panX -= event.deltaX;
        state.panY -= event.deltaY;
        state.panTargetX = state.panX;
        state.panTargetY = state.panY;
        state.panVelocityX = (state.panVelocityX * 0.42) + ((-event.deltaX) * 0.065);
        state.panVelocityY = (state.panVelocityY * 0.42) + ((-event.deltaY) * 0.065);
        applyViewport();
        scheduleViewportFrame();
      }
      event.preventDefault();
      event.stopPropagation();
    };

    const getTouchDistance = (a, b) => Math.hypot((a?.clientX || 0) - (b?.clientX || 0), (a?.clientY || 0) - (b?.clientY || 0));
    const getTouchCenter = (a, b) => ({
      x: ((a?.clientX || 0) + (b?.clientX || 0)) / 2,
      y: ((a?.clientY || 0) + (b?.clientY || 0)) / 2,
    });
    const refreshPinchState = () => {
      if (state.touches.size < 2) {
        state.pinch = null;
        return;
      }
      const [touchA, touchB] = Array.from(state.touches.values()).slice(0, 2);
      const distance = getTouchDistance(touchA, touchB);
      const center = getTouchCenter(touchA, touchB);
      if (!state.pinch) {
        state.pinch = {
          startDistance: Math.max(1, distance),
          startScale: state.scaleTarget || state.scale || 1,
          centerX: center.x,
          centerY: center.y,
          lastScale: state.scaleTarget || state.scale || 1,
          lastAt: performance.now(),
        };
        return;
      }
      state.pinch.centerX = center.x;
      state.pinch.centerY = center.y;
      const nextScale = (state.pinch.startScale || 1) * (distance / Math.max(1, state.pinch.startDistance || 1));
      const now = performance.now();
      const previousScale = state.scale;
      scaleAroundClientPoint(nextScale, center.x, center.y, { immediate: true, motion: false, rubberBand: true });
      pushScaleMomentum(previousScale, state.scale, Math.max(8, now - (state.pinch.lastAt || now - 16.667)));
      state.pinch.lastScale = state.scale;
      state.pinch.lastAt = now;
    };

    const onTouchStart = (event) => {
      if (!state.active) return;
      notifyThoughtGraphNodeHover(null, 0, 0);
      Array.from(event.changedTouches || []).forEach((touch) => {
        state.touches.set(touch.identifier, { clientX: touch.clientX, clientY: touch.clientY });
      });
      if (event.touches && event.touches.length === 1) {
        const touch = event.touches[0];
        const hitNode = findNodeAt(touch.clientX, touch.clientY);
        clearLongPressState();
        state.longPressHandled = false;
        if (hitNode) {
          state.longPressStart = { x: touch.clientX, y: touch.clientY };
          state.longPressNodeId = hitNode.id;
          state.longPressTimer = window.setTimeout(() => {
            const node = state.nodeModels.find((entry) => entry.id === state.longPressNodeId);
            if (!node) return;
            state.longPressHandled = true;
            state.pointer = null;
            clearDropTarget();
            releaseNodeDragContext(node.id, false);
            if (typeof window.handleThoughtGraphNodeContextMenu === 'function') {
              window.handleThoughtGraphNodeContextMenu(node.kind, node.rawId, touch.clientX, touch.clientY);
            }
            clearLongPressState();
          }, 420);
        }
      }
      if (state.touches.size >= 2) {
        clearLongPressState();
        state.pointer = null;
        refreshPinchState();
        event.preventDefault();
      }
    };

    const onTouchMove = (event) => {
      if (!state.active) return;
      Array.from(event.changedTouches || []).forEach((touch) => {
        if (state.touches.has(touch.identifier)) {
          state.touches.set(touch.identifier, { clientX: touch.clientX, clientY: touch.clientY });
        }
      });
      if (state.longPressStart && event.touches && event.touches.length === 1) {
        const touch = event.touches[0];
        const dx = touch.clientX - state.longPressStart.x;
        const dy = touch.clientY - state.longPressStart.y;
        if ((dx * dx + dy * dy) > 100) {
          clearLongPressState();
        }
      }
      if (state.touches.size >= 2) {
        refreshPinchState();
        event.preventDefault();
      }
    };

    const clearTouches = (event) => {
      Array.from(event.changedTouches || []).forEach((touch) => {
        state.touches.delete(touch.identifier);
      });
      clearLongPressState();
      if (state.touches.size < 2) {
        state.pinch = null;
        settleViewportElastic();
        scheduleViewportFrame();
      }
    };
    state.touchHandlers = {
      touchstart: onTouchStart,
      touchmove: onTouchMove,
      touchend: clearTouches,
      touchcancel: clearTouches,
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', clearTouches, { passive: true });
    canvas.addEventListener('touchcancel', clearTouches, { passive: true });
  }

  function resetViewport() {
    clearWheelSettleTimer();
    stopScaleAnimation();
    state.scale = DEFAULT_VIEWPORT_SCALE;
    state.scaleTarget = DEFAULT_VIEWPORT_SCALE;
    state.panTargetX = 0;
    state.panTargetY = 0;
    state.panVelocityX = 0;
    state.panVelocityY = 0;
    state.panX = 0;
    state.panY = 0;
    applyViewport();
    if (state.simulation) state.simulation.alpha(0.55).restart();
  }

  function resetViewportWithOptions(options = {}) {
    clearWheelSettleTimer();
    const preserveScale = options.preserveScale === true;
    const resetLayout = options.resetLayout === true;
    if (!preserveScale) {
      stopScaleAnimation();
      state.scale = DEFAULT_VIEWPORT_SCALE;
      state.scaleTarget = DEFAULT_VIEWPORT_SCALE;
    }
    state.panX = 0;
    state.panY = 0;
    state.panTargetX = 0;
    state.panTargetY = 0;
    state.panVelocityX = 0;
    state.panVelocityY = 0;
    if (resetLayout) {
      clearPositionCache();
      if (state.payload) {
        rebuildGraphFromPayload(state.payload);
        return;
      }
    }
    applyViewport();
    if (state.simulation) state.simulation.alpha(0.55).restart();
  }

  function setScale(nextScale, options = {}) {
    return animateScaleTo(nextScale, options);
  }

  function getScale() {
    return state.scale;
  }

  function setPreviewNode(kind = '', rawId = '') {
    const node = findNodeBySource(kind, rawId);
    const nextNodeId = String(node?.id || '').trim();
    const previousNodeId = String(state.previewNodeId || '').trim();
    if (previousNodeId === nextNodeId) return nextNodeId;
    state.previewNodeId = nextNodeId;
    state.hoveredGroupKey = '';
    state.hoveredNodeId = '';
    refreshPreviewNodeVisuals(previousNodeId, nextNodeId);
    if (shouldAnimateWormHoverPresentation()) scheduleWormHoverFrame();
    return nextNodeId;
  }

  function clearPreviewNode() {
    if (!state.previewNodeId) return false;
    const previousNodeId = String(state.previewNodeId || '').trim();
    state.previewNodeId = '';
    refreshPreviewNodeVisuals(previousNodeId, '');
    if (shouldAnimateWormHoverPresentation()) scheduleWormHoverFrame();
    else stopWormHoverFrame();
    return true;
  }

  async function mount(host, payload) {
    if (!host) return;
    const app = await ensureApp(host);
    if (!app || state.host !== host || state.app !== app) return;
    rebuildGraphFromPayload(payload);
  }

  function update(payload) {
    if (!state.active || !state.host) return;
    if (canPatchGraphInPlace(payload)) {
      patchGraphFromPayload(payload);
      return;
    }
    rebuildGraphFromPayload(payload);
  }

  function unmount() {
    destroyPixiApp();
  }

  function getDebugSnapshot() {
    return {
      active: state.active === true,
      hasApp: !!state.app,
      hasCanvas: !!state.canvas,
      hostConnected: !!state.host?.isConnected,
      nodeViewCount: state.nodeViews instanceof Map ? state.nodeViews.size : 0,
      nodeModelCount: Array.isArray(state.nodeModels) ? state.nodeModels.length : 0,
      edgeModelCount: Array.isArray(state.edgeModels) ? state.edgeModels.length : 0,
      positionCacheCount: state.positionCache instanceof Map ? state.positionCache.size : 0,
      previewNodeId: String(state.previewNodeId || '').trim(),
      hoveredNodeId: String(state.hoveredNodeId || '').trim(),
      dropTargetNodeId: String(state.dropTargetNodeId || '').trim(),
      focusImpulseActive: !!state.focusImpulse,
      pendingAppInit: !!state.pendingAppInit,
      resizeObserverActive: !!state.resizeObserver,
      rafActive: !!state.rafId,
      hoverRafActive: !!state.hoverRafId,
      mountCount: Number(state.mountCount || 0) || 0,
      destroyCount: Number(state.destroyCount || 0) || 0,
      lastMountAt: Number(state.lastMountAt || 0) || 0,
      lastDestroyAt: Number(state.lastDestroyAt || 0) || 0,
    };
  }

  window.MorphThoughtGraphRuntime = {
    mount,
    update,
    unmount,
    isActive() {
      return !!state.active;
    },
    isMountedTo(host) {
      return !!host && state.host === host && state.active === true;
    },
    resetViewport: resetViewportWithOptions,
    setScale,
    getScale,
    setPreviewNode,
    clearPreviewNode,
    getNodeClientPoint,
    getNodeNavigationMeta,
    centerNodeInViewport,
    getDebugSnapshot,
  };
})();
