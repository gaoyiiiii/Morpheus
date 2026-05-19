(function initMorphProjectVisualOrganizerGraphRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const mountStateByContainer = new WeakMap();
  const MIN_SCALE = 0.01;
  const MAX_SCALE = 2.2;
  const ZOOM_MULTIPLIER = 0.00145;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampScale(value) {
    return clamp(Number(value) || 1, MIN_SCALE, MAX_SCALE);
  }

  function sanitizeText(value, maxLength) {
    const limit = Number.isFinite(Number(maxLength)) ? Math.max(1, Number(maxLength)) : 240;
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  }

  function cloneJson(value, fallback) {
    if (value == null) return fallback;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return fallback;
    }
  }

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeTemplateKey(value) {
    void value;
    return 'big-question-map';
  }

  function createEmptyOrganizer() {
    return {
      title: '',
      summary: '',
      centralTopic: '',
      focusQuestion: '',
      templateKey: 'big-question-map',
      viewportStates: {},
      sections: [],
      nodes: [],
      edges: [],
    };
  }

  function sanitizeViewportState(rawState) {
    const src = rawState && typeof rawState === 'object' ? rawState : {};
    const scale = clampScale(src.scale);
    const panX = Number(src.panX);
    const panY = Number(src.panY);
    return {
      scale,
      panX: Number.isFinite(panX) ? panX : 0,
      panY: Number.isFinite(panY) ? panY : 0,
      userAdjusted: src.userAdjusted === true,
    };
  }

  function normalizeViewportStates(rawStates) {
    const src = rawStates && typeof rawStates === 'object' ? rawStates : {};
    const normalized = {};
    Object.keys(src).forEach((key) => {
      const templateKey = normalizeTemplateKey(key);
      if (!templateKey) return;
      normalized[templateKey] = sanitizeViewportState(src[key]);
    });
    return normalized;
  }

  function normalizeSections(rawSections) {
    return (Array.isArray(rawSections) ? rawSections : [])
      .map((section) => {
        const src = section && typeof section === 'object' ? section : {};
        return {
          title: sanitizeText(src.title || src.label || src.name || '', 72) || '未命名卡片',
          items: (Array.isArray(src.items) ? src.items : [])
            .map((item) => sanitizeText(item, 120))
            .slice(0, 8),
        };
      })
      .slice(0, 8);
  }

  function normalizeTemplateSections(rawTemplateKey, rawSections) {
    void rawTemplateKey;
    const normalized = normalizeSections(rawSections);
    const ensured = [];
    for (let index = 0; index < 5; index += 1) {
      const existing = normalized[index] || {};
      const prompt = getBigQuestionPromptMeta('section', index);
      ensured.push({
        title: sanitizeText(existing.title || prompt.title || `卡片 ${index + 1}`, 72) || prompt.title || `卡片 ${index + 1}`,
        items: Array.isArray(existing.items) ? existing.items.slice(0, 8) : [],
      });
    }
    return ensured.concat(normalized.slice(5)).slice(0, 8);
  }

  function normalizeStoredNodes(rawNodes) {
    return (Array.isArray(rawNodes) ? rawNodes : [])
      .map((node) => {
        const src = node && typeof node === 'object' ? node : {};
        const id = sanitizeText(src.id || '', 64);
        if (!id) return null;
        const x = Number(src.x);
        const y = Number(src.y);
        return {
          id,
          x: Number.isFinite(x) ? clamp(x, 0.08, 0.92) : null,
          y: Number.isFinite(y) ? clamp(y, 0.08, 0.92) : null,
          pinned: src.pinned === true,
        };
      })
      .filter(Boolean);
  }

  function normalizeOrganizer(rawOrganizer) {
    const src = rawOrganizer && typeof rawOrganizer === 'object' ? rawOrganizer : {};
    return {
      ...createEmptyOrganizer(),
      ...cloneJson(src, {}),
      title: sanitizeText(src.title || '', 80),
      summary: sanitizeText(src.summary || '', 180),
      centralTopic: sanitizeText(src.centralTopic || src.title || '', 80),
      focusQuestion: sanitizeText(src.focusQuestion || '', 160),
      templateKey: normalizeTemplateKey(src.templateKey || 'big-question-map'),
      viewportStates: normalizeViewportStates(src.viewportStates || src.viewStates || src.viewports || {}),
      sections: normalizeTemplateSections(src.templateKey || 'big-question-map', src.sections || []),
      nodes: normalizeStoredNodes(src.nodes || []),
      edges: cloneJson(src.edges, []),
    };
  }

  function getPalette(templateKey, theme = 'light') {
    const key = normalizeTemplateKey(templateKey);
    const dark = String(theme || '').trim() === 'dark';
    if (dark) {
      if (key === 'compare-map') {
        return {
          line: 'rgba(249, 236, 208, 0.85)',
          accent: '#f59e0b',
          cardBg: '#23201d',
          cardAltBg: '#292420',
          chrome: '#3a332d',
          shadow: '18px 14px 0 rgba(0,0,0,0.34)',
          shadowActive: '20px 16px 0 rgba(245,158,11,0.14)',
          text: 'rgba(255,248,240,0.94)',
          mutedText: 'rgba(255,248,240,0.62)',
          panelBg: '#171311',
          grid: 'rgba(255,255,255,0.045)',
        };
      }
      if (key === 'kwhl-chart') {
        return {
          line: 'rgba(220, 255, 247, 0.84)',
          accent: '#14b8a6',
          cardBg: '#182320',
          cardAltBg: '#1d2925',
          chrome: '#30453f',
          shadow: '18px 14px 0 rgba(0,0,0,0.34)',
          shadowActive: '20px 16px 0 rgba(20,184,166,0.15)',
          text: 'rgba(240,255,250,0.94)',
          mutedText: 'rgba(240,255,250,0.62)',
          panelBg: '#111816',
          grid: 'rgba(255,255,255,0.045)',
        };
      }
      if (key === 'main-concepts-map') {
        return {
          line: 'rgba(226, 236, 255, 0.88)',
          accent: '#60a5fa',
          cardBg: '#171c28',
          cardAltBg: '#1d2432',
          chrome: '#2d3950',
          shadow: '18px 14px 0 rgba(0,0,0,0.34)',
          shadowActive: '20px 16px 0 rgba(96,165,250,0.15)',
          text: 'rgba(242,247,255,0.94)',
          mutedText: 'rgba(242,247,255,0.62)',
          panelBg: '#0f131c',
          grid: 'rgba(255,255,255,0.045)',
        };
      }
      return {
        line: 'rgba(255, 241, 224, 0.88)',
        accent: '#fb923c',
        cardBg: '#221d18',
        cardAltBg: '#29211b',
        chrome: '#3a3129',
        shadow: '18px 14px 0 rgba(0,0,0,0.34)',
        shadowActive: '20px 16px 0 rgba(251,146,60,0.15)',
        text: 'rgba(255,248,240,0.94)',
        mutedText: 'rgba(255,248,240,0.62)',
        panelBg: '#161210',
        grid: 'rgba(255,255,255,0.045)',
      };
    }

    if (key === 'compare-map') {
      return {
        line: '#1f1b18',
        accent: '#b45309',
        cardBg: '#f7f3ea',
        cardAltBg: '#f3eee3',
        chrome: '#ddd4c7',
        shadow: '16px 13px 0 rgba(0,0,0,0.18)',
        shadowActive: '18px 15px 0 rgba(180,83,9,0.16)',
        text: '#211b17',
        mutedText: 'rgba(33,27,23,0.64)',
        panelBg: '#f5f1e9',
        grid: 'rgba(0,0,0,0.05)',
      };
    }
    if (key === 'kwhl-chart') {
      return {
        line: '#14342f',
        accent: '#0f766e',
        cardBg: '#f0f5f2',
        cardAltBg: '#eaf1ed',
        chrome: '#cfd9d4',
        shadow: '16px 13px 0 rgba(0,0,0,0.15)',
        shadowActive: '18px 15px 0 rgba(15,118,110,0.14)',
        text: '#182522',
        mutedText: 'rgba(24,37,34,0.64)',
        panelBg: '#edf3f0',
        grid: 'rgba(0,0,0,0.048)',
      };
    }
    if (key === 'main-concepts-map') {
      return {
        line: '#19304f',
        accent: '#2563eb',
        cardBg: '#f2f6fd',
        cardAltBg: '#e9f0fb',
        chrome: '#d2dced',
        shadow: '16px 13px 0 rgba(0,0,0,0.15)',
        shadowActive: '18px 15px 0 rgba(37,99,235,0.14)',
        text: '#172236',
        mutedText: 'rgba(23,34,54,0.64)',
        panelBg: '#eef4fc',
        grid: 'rgba(0,0,0,0.048)',
      };
    }
    return {
      line: '#221c16',
      accent: '#c2410c',
      cardBg: '#f8f4ee',
      cardAltBg: '#f3eee7',
      chrome: '#ddd4ca',
      shadow: '16px 13px 0 rgba(0,0,0,0.16)',
      shadowActive: '18px 15px 0 rgba(194,65,12,0.14)',
      text: '#221c16',
      mutedText: 'rgba(34,28,22,0.64)',
      panelBg: '#f6f1e8',
      grid: 'rgba(0,0,0,0.048)',
    };
  }

  function getWindowChromeLabel(node) {
    if (node.type === 'central') return 'Topic / 主题';
    if (node.type === 'focus') return 'Question / 问题';
    return 'Card / 卡片';
  }

  function getBigQuestionPromptMeta(kind = 'section', sectionIndex = -1) {
    if (kind === 'central') {
      return {
        badge: 'Topic / 主题',
        title: 'Topic / 主题',
        subtitle: '核心主题',
      };
    }
    if (kind === 'focus') {
      return {
        badge: 'Frame Problem / 问题框定',
        title: 'What is the question? / 问题是什么？',
        subtitle: '这个项目现在最值得先回答的问题是什么？',
      };
    }
    const prompts = [
      {
        badge: 'Timeline / 时间线',
        title: 'When did the problem start? / 问题从什么时候开始？',
        subtitle: '这个问题是什么时候开始变成问题的？',
      },
      {
        badge: 'Impact / 影响面',
        title: 'Who will suffer? / 谁会受到影响？',
        subtitle: '如果不解决，谁会受到影响？',
      },
      {
        badge: 'Support / 外部帮助',
        title: 'Where can we seek help? / 我们可以向哪里求助？',
        subtitle: '我们可以向哪里寻求帮助？',
      },
      {
        badge: 'Cause / 成因',
        title: 'How did the problem form? / 问题是如何形成的？',
        subtitle: '这个问题是如何形成的？',
      },
      {
        badge: 'Action / 解法',
        title: 'How can we solve it? / 我们可以怎样解决？',
        subtitle: '我们可以怎样解决这个问题？',
      },
    ];
    return prompts[Number(sectionIndex) || 0] || {
      badge: 'Question / 问题',
      title: 'What else matters? / 还有什么重要？',
      subtitle: '还有什么关键问题需要补上？',
    };
  }

  function getCentralTopicPlaceholder(templateKey = '') {
    void templateKey;
    return '写下这个项目当前最核心的主题';
  }

  function getFocusQuestionPlaceholder(sectionIndex = -1) {
    return getBigQuestionPromptMeta('focus', sectionIndex).subtitle || '写下当前最值得先回答的问题';
  }

  function getSectionTitlePlaceholder(templateKey = '', sectionIndex = -1) {
    void templateKey;
    return getBigQuestionPromptMeta('section', sectionIndex).title || '写下这一格的标题 / Title';
  }

  function getSectionItemPlaceholder(templateKey = '', sectionIndex = -1, itemIndex = -1) {
    void templateKey;
    void itemIndex;
    const prompts = [
      '写一个关于时间线的事实、变化或起点',
      '写一个会被影响的人、角色或场景',
      '写一个可借力的对象、资源或支持点',
      '写一个你现在看到的成因、诱因或机制',
      '写一个下一步可执行的动作或方案',
    ];
    return prompts[Number(sectionIndex) || 0] || '写一句当前值得记录的判断';
  }

  function getEmptySectionHint(templateKey = '', sectionIndex = -1) {
    return getSectionItemPlaceholder(templateKey, sectionIndex, 0);
  }

  function estimateTextareaRows(value, minRows = 2, maxRows = 10, charsPerRow = 20) {
    const safeMin = Math.max(1, Number(minRows) || 1);
    const safeMax = Math.max(safeMin, Number(maxRows) || safeMin);
    const normalized = String(value || '').replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const estimated = lines.reduce((sum, line) => {
      const cleanLength = Math.max(1, String(line || '').trim().length || 0);
      return sum + Math.max(1, Math.ceil(cleanLength / Math.max(8, Number(charsPerRow) || 20)));
    }, 0);
    return clamp(estimated || safeMin, safeMin, safeMax);
  }

  function buildTemplateSectionSlots(templateKey, sectionCount) {
    void templateKey;
    const count = Math.max(0, Number(sectionCount) || 0);
    const fiveWOneHSlots = [
      { x: 0.17, y: 0.54, width: 0.21, height: 0.24 },
      { x: 0.83, y: 0.54, width: 0.21, height: 0.24 },
      { x: 0.17, y: 0.87, width: 0.21, height: 0.25 },
      { x: 0.83, y: 0.87, width: 0.21, height: 0.25 },
      { x: 0.50, y: 1.23, width: 0.58, height: 0.22 },
    ];
    if (count <= fiveWOneHSlots.length) return fiveWOneHSlots.slice(0, count);

    const overflowSlots = [];
    const overflowXs = [0.31, 0.69];
    let cursorY = 1.42;
    for (let index = fiveWOneHSlots.length; index < count; index += 2) {
      overflowSlots.push(
        { x: overflowXs[0], y: cursorY, width: 0.26, height: 0.24 },
        index + 1 < count ? { x: overflowXs[1], y: cursorY, width: 0.26, height: 0.24 } : { x: 0.50, y: cursorY, width: 0.30, height: 0.24 },
      );
      cursorY += 0.30;
    }
    return fiveWOneHSlots.concat(overflowSlots).slice(0, count);
  }

  function buildGraphModels(organizer, theme = 'light') {
    const safeOrganizer = normalizeOrganizer(organizer);
    const palette = getPalette(safeOrganizer.templateKey, theme);
    const nodes = [];
    const edges = [];

    nodes.push({
      id: 'central-topic',
      type: 'central',
      label: sanitizeText(safeOrganizer.centralTopic || safeOrganizer.title || '未命名项目', 80) || '未命名项目',
      x: 0.50,
      y: 0.50,
      width: 0.16,
      height: 0.11,
      palette,
    });

    nodes.push({
      id: 'focus-question',
      type: 'focus',
      label: sanitizeText(safeOrganizer.focusQuestion, 160),
      x: 0.50,
      y: 0.16,
      width: 0.42,
      height: 0.13,
      palette,
    });

    const slots = buildTemplateSectionSlots(safeOrganizer.templateKey, safeOrganizer.sections.length);
    safeOrganizer.sections.forEach((section, index) => {
      const slot = slots[index] || {
        x: 0.50,
        y: 0.30 + (index * 0.18),
        width: 0.30,
        height: 0.22,
      };
      nodes.push({
        id: `section-${index + 1}`,
        type: 'section',
        label: sanitizeText(section.title || `卡片 ${index + 1}`, 72) || `卡片 ${index + 1}`,
        items: cloneJson(section.items, []),
        sectionIndex: index,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        palette,
      });
      edges.push({
        id: `edge-central-topic-section-${index + 1}`,
        from: 'central-topic',
        to: `section-${index + 1}`,
      });
    });

    const persistedNodes = nodes.map((node) => ({
      ...node,
      pinned: false,
    }));

    return {
      organizer: safeOrganizer,
      nodes: persistedNodes,
      edges,
      palette,
      theme: String(theme || 'light') === 'dark' ? 'dark' : 'light',
    };
  }

  function buildPersistedNodes(graph) {
    return graph.nodes.map((node) => ({
      id: node.id,
      label: node.label || '',
      x: clamp(Number(node.x) || 0.5, 0.08, 0.92),
      y: clamp(Number(node.y) || 0.5, 0.08, 0.92),
      pinned: node.pinned === true,
    }));
  }

  function buildViewportTransform(state) {
    return `translate(${Math.round(state.viewport.panX)}px, ${Math.round(state.viewport.panY)}px) scale(${state.viewport.scale.toFixed(4)})`;
  }

  function escapeSelectorValue(value) {
    const raw = String(value || '');
    if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') return CSS.escape(raw);
    return raw.replace(/["\\]/g, '\\$&');
  }

  function getStageRect(state) {
    const stage = state.container?.querySelector?.('[data-project-graph-stage]');
    const fallback = state.container?.getBoundingClientRect?.() || null;
    return stage?.getBoundingClientRect?.() || fallback;
  }

  function getStageMetrics(state) {
    const rect = getStageRect(state);
    return {
      width: Math.max(1, rect?.width || 0),
      height: Math.max(1, rect?.height || 0),
      left: rect?.left || 0,
      top: rect?.top || 0,
    };
  }

  function getLayoutMetrics(state) {
    const layout = state?.layout && typeof state.layout === 'object' ? state.layout : null;
    if (layout) {
      return {
        width: Math.max(1, Number(layout.width) || 0),
        height: Math.max(1, Number(layout.height) || 0),
      };
    }
    const metrics = getStageMetrics(state);
    return {
      width: Math.max(1, Number(metrics.width) || 0),
      height: Math.max(1, Number(metrics.height) || 0),
    };
  }

  function estimateNodeWidthPx(node, templateKey = '') {
    void templateKey;
    if (node?.type === 'focus') return 620;
    if (node?.type === 'central') return 220;
    if (node?.id === 'section-5') return 720;
    const sectionIndex = Number(node?.sectionIndex);
    if (Number.isFinite(sectionIndex) && sectionIndex >= 5) return 360;
    return 300;
  }

  function getNodeElement(state, nodeId) {
    if (!state.container?.isConnected) return null;
    const nodeEl = state.container.querySelector(`[data-project-graph-node-id="${escapeSelectorValue(nodeId)}"]`);
    return nodeEl instanceof HTMLElement ? nodeEl : null;
  }

  function getStageCenter(state) {
    const metrics = getStageMetrics(state);
    return {
      x: metrics.width / 2,
      y: metrics.height / 2,
    };
  }

  function getClientPointInStage(state, clientX, clientY) {
    const metrics = getStageMetrics(state);
    return {
      x: (Number(clientX) || 0) - metrics.left,
      y: (Number(clientY) || 0) - metrics.top,
    };
  }

  function getWorldPointForClient(state, clientX, clientY, transform = {}) {
    const point = getClientPointInStage(state, clientX, clientY);
    const scale = Number.isFinite(transform.scale) ? transform.scale : state.viewport.scale;
    const panX = Number.isFinite(transform.panX) ? transform.panX : state.viewport.panX;
    const panY = Number.isFinite(transform.panY) ? transform.panY : state.viewport.panY;
    return {
      x: (point.x - panX) / Math.max(0.001, scale),
      y: (point.y - panY) / Math.max(0.001, scale),
    };
  }

  function setViewportTransform(state, nextScale, clientX, clientY, options = {}) {
    const normalizedScale = clampScale(nextScale);
    const point = getClientPointInStage(state, clientX, clientY);
    const world = getWorldPointForClient(state, clientX, clientY, {
      scale: Number.isFinite(options.fromScale) ? options.fromScale : state.viewport.scale,
      panX: Number.isFinite(options.fromPanX) ? options.fromPanX : state.viewport.panX,
      panY: Number.isFinite(options.fromPanY) ? options.fromPanY : state.viewport.panY,
    });
    state.viewport.scale = normalizedScale;
    state.viewport.panX = point.x - (world.x * normalizedScale);
    state.viewport.panY = point.y - (world.y * normalizedScale);
    if (options.markUserAdjusted !== false) state.viewport.userAdjusted = true;
    applyViewportPresentation(state);
    rememberViewportState(state, {
      emit: options.emitPersist !== false,
      viewportOnly: options.viewportOnly !== false,
      userAdjustedOverride: options.markUserAdjusted !== false,
    });
    return normalizedScale;
  }

  function panViewportBy(state, deltaX, deltaY, options = {}) {
    state.viewport.panX += Number(deltaX) || 0;
    state.viewport.panY += Number(deltaY) || 0;
    if (options.markUserAdjusted !== false) state.viewport.userAdjusted = true;
    applyViewportPresentation(state);
    rememberViewportState(state, {
      emit: options.emitPersist !== false,
      viewportOnly: options.viewportOnly !== false,
      userAdjustedOverride: options.markUserAdjusted !== false,
    });
  }

  function estimateNodeMinHeightPx(node, metrics) {
    if (node?.type === 'focus') return 188;
    if (node?.type === 'central') return 92;
    if (node?.id === 'section-5') return 220;
    const sectionIndex = Number(node?.sectionIndex);
    if (Number.isFinite(sectionIndex) && sectionIndex >= 5) return 220;
    return 220;
  }

  function estimateNodeHeightRatio(node, metrics) {
    const normalizedHeight = Math.max(0.12, Number(node?.height) || 0.2);
    const responsiveHeight = estimateNodeMinHeightPx(node, metrics) / Math.max(1, Number(metrics?.height) || 1);
    return Math.max(normalizedHeight, responsiveHeight);
  }

  function getReadableFitScale(metrics, templateKey = '') {
    void templateKey;
    const width = Number(metrics?.width) || 0;
    const height = Number(metrics?.height) || 0;
    if (width >= 1180 || height >= 620) return 0.8;
    if (width >= 920 && height >= 460) return 0.76;
    if (width >= 760 && height >= 340) return 0.72;
    return 0.68;
  }

  function buildGraphBounds(state) {
    const nodes = Array.isArray(state?.graph?.nodes) ? state.graph.nodes : [];
    const layout = getLayoutMetrics(state);
    if (!nodes.length) return {
      minX: layout.width * 0.2,
      minY: layout.height * 0.18,
      maxX: layout.width * 0.8,
      maxY: layout.height * 0.82,
      centerX: layout.width * 0.5,
      centerY: layout.height * 0.5,
      width: layout.width * 0.6,
      height: layout.height * 0.64,
    };
    let minX = layout.width;
    let minY = layout.height;
    let maxX = 0;
    let maxY = 0;
    nodes.forEach((node) => {
      let width = estimateNodeWidthPx(node, state.graph?.organizer?.templateKey || '');
      if (!Number.isFinite(width) || width <= 0) width = (Number(node.width) || 0.2) * layout.width;
      let height = estimateNodeHeightRatio(node, layout) * layout.height;
      const renderedNode = getNodeElement(state, node.id);
      if (renderedNode instanceof HTMLElement) {
        const measuredHeight = renderedNode.offsetHeight || renderedNode.getBoundingClientRect?.().height || 0;
        if (measuredHeight > 0) {
          height = Math.max(height, measuredHeight);
        }
      }
      const centerX = (Number(node.x) || 0.5) * layout.width;
      const centerY = (Number(node.y) || 0.5) * layout.height;
      minX = Math.min(minX, centerX - (width / 2));
      minY = Math.min(minY, centerY - (height / 2));
      maxX = Math.max(maxX, centerX + (width / 2));
      maxY = Math.max(maxY, centerY + (height / 2));
    });
    minX = clamp(minX, -layout.width * 0.40, layout.width * 1.20);
    minY = clamp(minY, -layout.height * 0.40, layout.height * 1.80);
    maxX = clamp(maxX, -layout.width * 0.20, layout.width * 1.40);
    maxY = clamp(maxY, -layout.height * 0.20, layout.height * 2.20);
    const width = Math.max(0.14, maxX - minX);
    const height = Math.max(0.14, maxY - minY);
    return {
      minX,
      minY,
      maxX,
      maxY,
      centerX: minX + (width / 2),
      centerY: minY + (height / 2),
      width,
      height,
    };
  }

  function fitGraphToViewport(state, options = {}) {
    if (!state.container?.isConnected) return false;
    const metrics = getStageMetrics(state);
    const layout = getLayoutMetrics(state);
    const bounds = buildGraphBounds(state);
    const paddingX = clamp(metrics.width * 0.065, 40, 92);
    const paddingY = clamp(metrics.height * 0.085, 24, 76);
    const availableWidth = Math.max(120, metrics.width - (paddingX * 2));
    const availableHeight = Math.max(120, metrics.height - (paddingY * 2));
    const contentWidth = Math.max(80, bounds.width);
    const contentHeight = Math.max(80, bounds.height);
    const fitScale = Math.min(1.18, availableWidth / contentWidth, availableHeight / contentHeight);
    const nextScale = clampScale(Math.min(0.9, fitScale));
    const center = getStageCenter(state);
    const templateCenterNode = getNodeById(state, 'central-topic');
    const worldCenterX = templateCenterNode ? ((templateCenterNode.x || 0.5) * layout.width) : bounds.centerX;
    const worldCenterY = templateCenterNode ? ((templateCenterNode.y || 0.5) * layout.height) : bounds.centerY;
    state.viewport.scale = nextScale;
    state.viewport.panX = center.x - (worldCenterX * nextScale);
    state.viewport.panY = center.y - (worldCenterY * nextScale);
    state.viewport.userAdjusted = options.markUserAdjusted === true;
    applyViewportPresentation(state);
    rememberViewportState(state, {
      emit: options.emitPersist !== false,
      viewportOnly: options.viewportOnly !== false,
      userAdjustedOverride: options.markUserAdjusted === true,
    });
    return true;
  }

  function focusNodeInViewport(state, nodeId, options = {}) {
    if (!state.container?.isConnected) return false;
    const node = getNodeById(state, nodeId)
      || getNodeById(state, 'central-topic')
      || state.graph.nodes.find(Boolean)
      || null;
    if (!node) return false;
    const metrics = getStageMetrics(state);
    const layout = getLayoutMetrics(state);
    const center = getStageCenter(state);
    const nodeEl = getNodeElement(state, node.id);
    const nodeWidth = estimateNodeWidthPx(node, state.graph?.organizer?.templateKey || '');
    const nodeHeight = Math.max(
      estimateNodeHeightRatio(node, layout) * layout.height,
      nodeEl?.offsetHeight || nodeEl?.getBoundingClientRect?.().height || 0,
      80,
    );
    const paddingX = clamp(metrics.width * 0.12, 56, 128);
    const paddingY = clamp(metrics.height * 0.16, 48, 140);
    const availableWidth = Math.max(140, metrics.width - (paddingX * 2));
    const availableHeight = Math.max(140, metrics.height - (paddingY * 2));
    const fitScale = Math.min(1.18, availableWidth / Math.max(80, nodeWidth), availableHeight / Math.max(80, nodeHeight));
    const nextScale = clampScale(Math.max(0.86, fitScale));
    const worldCenterX = (Number(node.x) || 0.5) * layout.width;
    const worldCenterY = (Number(node.y) || 0.5) * layout.height;
    state.viewport.scale = nextScale;
    state.viewport.panX = center.x - (worldCenterX * nextScale);
    state.viewport.panY = center.y - (worldCenterY * nextScale);
    state.viewport.userAdjusted = options.markUserAdjusted !== false;
    applyViewportPresentation(state);
    rememberViewportState(state, {
      emit: options.emitPersist !== false,
      viewportOnly: options.viewportOnly !== false,
      userAdjustedOverride: options.markUserAdjusted !== false,
    });
    return true;
  }

  function zoomToActualSize(state, options = {}) {
    if (!state.container?.isConnected) return false;
    const metrics = getStageMetrics(state);
    const clientX = metrics.left + (metrics.width / 2);
    const clientY = metrics.top + (metrics.height / 2);
    setViewportTransform(state, 1, clientX, clientY, {
      markUserAdjusted: options.markUserAdjusted !== false,
      fromScale: state.viewport.scale,
      fromPanX: state.viewport.panX,
      fromPanY: state.viewport.panY,
      emitPersist: options.emitPersist !== false,
      viewportOnly: options.viewportOnly !== false,
    });
    return true;
  }

  function getConnectorAnchorPoint(state, node, direction = 'bottom') {
    const frame = getNodeFramePx(state, node);
    if (direction === 'top') return { x: frame.centerX, y: frame.top };
    if (direction === 'left') return { x: frame.left, y: frame.centerY };
    if (direction === 'right') return { x: frame.right, y: frame.centerY };
    return { x: frame.centerX, y: frame.bottom };
  }

  function buildRoundedOrthogonalPath(start, end, options = {}) {
    const radius = Math.max(8, Number(options.radius) || 14);
    const minMidY = start.y + radius + 12;
    const maxMidY = end.y - radius - 12;
    const preferredMidY = Number.isFinite(options.midY) ? options.midY : (start.y + ((end.y - start.y) * 0.42));
    const midY = clamp(preferredMidY, Math.min(minMidY, maxMidY), Math.max(minMidY, maxMidY));
    const horizontalDirection = end.x >= start.x ? 1 : -1;
    const verticalDirection = end.y >= start.y ? 1 : -1;
    const elbowX = end.x - (radius * horizontalDirection);
    return [
      `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
      `L ${start.x.toFixed(2)} ${(midY - (radius * verticalDirection)).toFixed(2)}`,
      `Q ${start.x.toFixed(2)} ${midY.toFixed(2)} ${(start.x + (radius * horizontalDirection)).toFixed(2)} ${midY.toFixed(2)}`,
      `L ${(elbowX - (radius * horizontalDirection)).toFixed(2)} ${midY.toFixed(2)}`,
      `Q ${elbowX.toFixed(2)} ${midY.toFixed(2)} ${elbowX.toFixed(2)} ${(midY + (radius * verticalDirection)).toFixed(2)}`,
      `L ${elbowX.toFixed(2)} ${end.y.toFixed(2)}`,
      `L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    ].join(' ');
  }

  function buildBusBranchPath(start, end, options = {}) {
    const horizontalDirection = end.x >= start.x ? 1 : -1;
    const verticalDirection = end.y >= start.y ? 1 : -1;
    const radius = Math.max(8, Number(options.radius) || 12);
    if (Math.abs(end.x - start.x) <= 1) {
      return [
        `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
        `L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
      ].join(' ');
    }
    const elbowX = end.x - (radius * horizontalDirection);
    return [
      `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
      `L ${elbowX.toFixed(2)} ${start.y.toFixed(2)}`,
      `Q ${end.x.toFixed(2)} ${start.y.toFixed(2)} ${end.x.toFixed(2)} ${(start.y + (radius * verticalDirection)).toFixed(2)}`,
      `L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    ].join(' ');
  }

  function buildCentralTopicConnectorNetwork(state) {
    const focusNode = getNodeById(state, 'focus-question');
    const centralNode = getNodeById(state, 'central-topic');
    if (!focusNode || !centralNode) return '';
    const sectionNodes = state.graph.nodes
      .filter((node) => node?.type === 'section')
      .sort((left, right) => {
        const leftY = (Number(left?.y) || 0.5);
        const rightY = (Number(right?.y) || 0.5);
        if (Math.abs(leftY - rightY) > 0.001) return leftY - rightY;
        const leftX = (Number(left?.x) || 0.5);
        const rightX = (Number(right?.x) || 0.5);
        if (Math.abs(leftX - rightX) > 0.001) return leftX - rightX;
        return (Number(left?.sectionIndex) || 0) - (Number(right?.sectionIndex) || 0);
      });
    if (!sectionNodes.length) return '';
    const focusBottom = getConnectorAnchorPoint(state, focusNode, 'bottom');
    const centralTop = getConnectorAnchorPoint(state, centralNode, 'top');
    const centralBottom = getConnectorAnchorPoint(state, centralNode, 'bottom');
    const targets = sectionNodes.map((node) => ({
      node,
      point: getConnectorAnchorPoint(state, node, 'top'),
    }));
    const trunkX = centralTop.x;
    const trunkTopY = focusBottom.y;
    const trunkBottomY = Math.max(
      centralBottom.y + 30,
      ...targets.map((entry) => entry.point.y - 22),
    );
    const upperTrunk = [
      `M ${focusBottom.x.toFixed(2)} ${focusBottom.y.toFixed(2)}`,
      `L ${trunkX.toFixed(2)} ${focusBottom.y.toFixed(2)}`,
      `L ${trunkX.toFixed(2)} ${centralTop.y.toFixed(2)}`,
    ].join(' ');
    const lowerTrunk = [
      `M ${trunkX.toFixed(2)} ${centralBottom.y.toFixed(2)}`,
      `L ${trunkX.toFixed(2)} ${trunkBottomY.toFixed(2)}`,
    ].join(' ');
    const branches = targets.map((entry) => {
      const branchStartY = clamp(
        entry.point.y - 34,
        centralBottom.y + 24,
        Math.max(centralBottom.y + 22, trunkBottomY),
      );
      return buildBusBranchPath(
        { x: trunkX, y: branchStartY },
        entry.point,
        { radius: 10 },
      );
    });
    return {
      trunk: [upperTrunk, lowerTrunk],
      branches,
    };
  }

  function buildCanvasDecoration(state) {
    const graph = state?.graph;
    const edges = Array.isArray(graph?.edges) ? graph.edges : [];
    const network = buildCentralTopicConnectorNetwork(state);
    if (!edges.length && !network) return '';
    const layout = getLayoutMetrics(state);
    const stroke = graph?.theme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(54,44,38,0.20)';
    const glow = graph?.theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(54,44,38,0.035)';
    const networkMarkup = network
      ? [
        ...(Array.isArray(network.trunk) ? network.trunk : [network.trunk]).flatMap((path) => [
          `<path d="${path}" fill="none" stroke="${glow}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>`,
          `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"></path>`,
        ]),
      ].concat(network.branches.flatMap((path) => [
        `<path d="${path}" fill="none" stroke="${glow}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>`,
        `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"></path>`,
      ])).join('')
      : '';
    const fallbackPaths = edges.map((edge) => {
      const fromNode = getNodeById(state, edge.from);
      const toNode = getNodeById(state, edge.to);
      if (!fromNode || !toNode) return '';
      const start = getConnectorAnchorPoint(state, fromNode, 'bottom');
      const end = getConnectorAnchorPoint(state, toNode, 'top');
      const path = buildRoundedOrthogonalPath(start, end, {
        radius: fromNode.type === 'focus' ? 16 : 12,
        midY: start.y + Math.max(24, (end.y - start.y) * 0.38),
      });
      return `
        <g data-project-graph-edge-id="${escapeHTML(edge.id || '')}">
          <path d="${path}" fill="none" stroke="${glow}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>
      `;
    }).filter(Boolean).join('');
    const paths = networkMarkup || fallbackPaths;
    if (!paths) return '';
    return `
      <svg class="pointer-events-none absolute left-0 top-0 overflow-visible" width="${Math.round(layout.width)}" height="${Math.round(layout.height)}" viewBox="0 0 ${Math.round(layout.width)} ${Math.round(layout.height)}" fill="none" aria-hidden="true">
        ${paths}
      </svg>
    `;
  }

  function buildWindowControls(palette) {
    return `<span class="inline-flex h-2.5 w-2.5 rounded-full shrink-0" style="background:#e76f51;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.18);"></span>`;
  }

  function isMacLikePlatform() {
    const platform = String(window.navigator?.userAgentData?.platform || window.navigator?.platform || '').trim();
    const userAgent = String(window.navigator?.userAgent || '').trim();
    return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS|iPhone|iPad|iPod/i.test(userAgent);
  }

  function isTouchPrimaryExperience() {
    return !!(
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
      || Number(window.navigator?.maxTouchPoints || 0) > 0
    );
  }

  function getGuideDescriptor(state) {
    const touch = isTouchPrimaryExperience();
    if (touch) {
      return {
        eyebrow: 'Touch Guide',
        title: '操作提示',
        rows: [
          ['拖动画布', '移动视图'],
          ['点卡片', state.readOnly ? '选中并查看' : '选中并继续编辑'],
          ['聚焦所选', '快速回到当前卡片'],
          ['适应视图', '一键看全图'],
          ['重排', '恢复默认布局'],
          ['+ / -', '缩放视图'],
        ],
      };
    }
    const modifier = isMacLikePlatform() ? 'Cmd' : 'Ctrl';
    return {
      eyebrow: 'Keyboard Guide',
      title: '快捷键',
      rows: [
        ['拖动画布', '移动视图'],
        [`${modifier} + 滚轮`, '缩放视图'],
        ['Space + 拖拽', '按住空格平移'],
        ['0', '回到 100%'],
        ['1', '适应视图'],
        ['2', '聚焦所选卡片'],
        ['Esc', '关闭快捷键帮助'],
        ['? / F1', '打开快捷键帮助'],
      ].concat(state.readOnly ? [] : [
        ['Tab', '跳到下一格'],
        ['Enter', '新增同级内容'],
      ]),
    };
  }

  function getBottomHintText(state) {
    if (isTouchPrimaryExperience()) return '拖动画布 · + / - 缩放 · ? 操作提示';
    const editingHint = state?.readOnly ? '' : ' · Tab 下一格 · Enter 同级新增';
    return `拖动画布 · ${isMacLikePlatform() ? 'Cmd' : 'Ctrl'} + 滚轮缩放${editingHint} · ? 快捷键`;
  }

  function getGuideCloseLabel() {
    return isTouchPrimaryExperience() ? '关闭' : 'Esc';
  }

  function buildShortcutOverlayMarkup(state) {
    const palette = state.graph.palette;
    if (!state.showShortcutHelp) return '';
    const guide = getGuideDescriptor(state);
    return `
      <div class="absolute inset-0 z-40 flex items-start justify-end p-4">
        <button type="button" data-project-graph-action="toggle-shortcuts" class="absolute inset-0" aria-label="关闭快捷键帮助" style="background:${state.graph.theme === 'dark' ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.10)'};"></button>
        <section class="relative w-[320px] max-w-[calc(100%-2rem)] overflow-hidden rounded-[24px] border backdrop-blur-xl" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'};background:${state.graph.theme === 'dark' ? 'rgba(17,18,16,0.92)' : 'rgba(255,255,255,0.90)'};box-shadow:0 28px 80px rgba(0,0,0,0.24);color:${palette.text};">
          <div class="flex items-start justify-between gap-4 border-b px-5 py-4" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'};">
            <div>
              <div class="text-[10px] font-semibold uppercase tracking-[0.22em]" style="color:${palette.mutedText};">${escapeHTML(guide.eyebrow)}</div>
              <div class="mt-2 text-[18px] font-semibold leading-7">${escapeHTML(guide.title)}</div>
            </div>
            <button type="button" data-project-graph-action="toggle-shortcuts" class="inline-flex rounded-full border px-3 py-1 text-[11px] leading-5" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'};color:${palette.mutedText};">${escapeHTML(getGuideCloseLabel())}</button>
          </div>
          <div class="px-5 py-4">
            <div class="space-y-2.5">
              ${guide.rows.map(([shortcut, description]) => `
                <div class="flex items-center justify-between gap-4 rounded-[18px] border px-3 py-2.5" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};background:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.58)'};">
                  <span class="text-[12px] leading-5" style="color:${palette.text};">${escapeHTML(description)}</span>
                  <kbd class="rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.08em]" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'};color:${palette.mutedText};">${escapeHTML(shortcut)}</kbd>
                </div>
              `).join('')}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function getReadonlyTextareaAttributes(state) {
    return state.readOnly ? ' readonly tabindex="-1" aria-readonly="true"' : '';
  }

  function getReadonlyTextareaClass(state) {
    return state.readOnly ? ' pointer-events-none select-none' : '';
  }

  function buildNodeMarkup(state, node) {
    const selected = state.selectedNodeId === node.id;
    const readOnly = state.readOnly === true;
    const palette = state.graph.palette;
    const templateKey = 'big-question-map';
    const layout = getLayoutMetrics(state);
    const responsiveMinHeight = estimateNodeMinHeightPx(node, layout);
    const fixedWidthPx = estimateNodeWidthPx({ ...node, templateKey }, templateKey);
    const zIndex = node.type === 'central' ? 18 : (node.type === 'focus' ? 16 : 10);
    const paperBg = node.type === 'focus' ? palette.cardAltBg : palette.cardBg;
    const centralPlaceholder = getCentralTopicPlaceholder(templateKey);
    const focusPlaceholder = getFocusQuestionPlaceholder(node.sectionIndex);
    const sectionTitlePlaceholder = getSectionTitlePlaceholder(templateKey, node.sectionIndex);
    const emptySectionHint = getEmptySectionHint(templateKey, node.sectionIndex);
    const promptMeta = node.type === 'central'
      ? getBigQuestionPromptMeta('central')
      : (node.type === 'focus' ? getBigQuestionPromptMeta('focus') : getBigQuestionPromptMeta('section', node.sectionIndex));
    const frameStyle = [
      `left:${((Number(node.x) || 0.5) * layout.width).toFixed(2)}px`,
      `top:${((Number(node.y) || 0.5) * layout.height).toFixed(2)}px`,
      `width:${fixedWidthPx}px`,
      `min-height:${responsiveMinHeight}px`,
      `z-index:${zIndex}`,
      `background:${paperBg}`,
      `border-color:${selected ? palette.accent : palette.line}`,
      `box-shadow:${palette.shadow}`,
      `color:${palette.text}`,
    ].join(';');
    const articleClass = [
      'absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden border text-left transition-shadow duration-150',
      node.type === 'focus' ? 'rounded-[26px]' : 'rounded-[24px]',
    ].filter(Boolean).join(' ');
    const header = `
      <div class="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em]" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'};background:${palette.chrome};color:${palette.mutedText};">
        <div class="flex min-w-0 items-center">
          ${buildWindowControls(state.graph)}
          <span class="ml-2 truncate">${escapeHTML(getWindowChromeLabel(node))}</span>
        </div>
        ${node.type === 'section' && !readOnly ? `
          <div class="flex items-center gap-1.5">
            <button type="button" data-project-graph-action="add-item" data-section-index="${node.sectionIndex}" class="rounded-full border px-2 py-0.5 text-[10px] leading-4 transition-colors" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)'};color:${palette.mutedText};">+</button>
            <button type="button" data-project-graph-action="delete-section" data-section-index="${node.sectionIndex}" class="rounded-full border px-2 py-0.5 text-[10px] leading-4 transition-colors" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)'};color:${palette.mutedText};">-</button>
          </div>
        ` : '<span class="opacity-70">[]</span>'}
      </div>
    `;

    if (node.type === 'central') {
      return `
        <article data-project-graph-node-id="${escapeHTML(node.id)}" class="${articleClass}" style="${frameStyle}">
          ${header}
          <div class="rounded-b-[24px] px-4 py-3">
            <textarea data-project-graph-field="centralTopic" placeholder="${escapeHTML(centralPlaceholder)}" rows="${estimateTextareaRows(node.label || '', 2, 4, 12)}" class="w-full resize-none overflow-hidden bg-transparent text-center text-[18px] font-semibold leading-7 outline-none${getReadonlyTextareaClass(state)}" style="color:${palette.text};"${getReadonlyTextareaAttributes(state)}>${escapeHTML(node.label || '')}</textarea>
          </div>
        </article>
      `;
    }

    if (node.type === 'focus') {
      return `
        <article data-project-graph-node-id="${escapeHTML(node.id)}" class="${articleClass}" style="${frameStyle}">
          ${header}
          <div class="px-5 py-4">
            <div class="text-[10px] tracking-[0.18em]" style="color:${palette.mutedText};">${escapeHTML(promptMeta.badge)}</div>
            <div class="mt-2 text-[24px] font-black leading-none" style="color:${palette.text};">${escapeHTML(promptMeta.title)}</div>
            <div class="mt-2 text-[12px] leading-6" style="color:${palette.mutedText};">${escapeHTML(promptMeta.subtitle)}</div>
            <textarea data-project-graph-field="focusQuestion" placeholder="${escapeHTML(focusPlaceholder)}" rows="${estimateTextareaRows(node.label || '', 3, 6, 22)}" class="mt-3 w-full resize-none overflow-hidden bg-transparent text-[14px] font-medium leading-6 outline-none${getReadonlyTextareaClass(state)}" style="color:${palette.text};"${getReadonlyTextareaAttributes(state)}>${escapeHTML(node.label || '')}</textarea>
          </div>
        </article>
      `;
    }

    const items = Array.isArray(node.items) ? node.items : [];
    return `
      <article data-project-graph-node-id="${escapeHTML(node.id)}" class="${articleClass}" style="${frameStyle}">
        ${header}
        <div class="px-4 py-4">
          <textarea data-project-graph-field="sectionTitle" data-section-index="${node.sectionIndex}" placeholder="${escapeHTML(sectionTitlePlaceholder)}" rows="2" class="w-full resize-none bg-transparent text-[20px] font-black leading-7 outline-none${getReadonlyTextareaClass(state)}" style="color:${palette.text};"${getReadonlyTextareaAttributes(state)}>${escapeHTML(node.label || '')}</textarea>
          <div class="mt-3 space-y-2">
            ${items.length ? items.map((item, itemIndex) => `
              <div class="overflow-hidden rounded-[18px] border px-3 py-2" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'};background:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.38)'};">
                <div class="flex items-start gap-2">
                  <span class="pt-1 text-[12px] font-semibold leading-6" style="color:${palette.mutedText};">${itemIndex + 1}.</span>
                  <textarea data-project-graph-field="sectionItem" data-section-index="${node.sectionIndex}" data-item-index="${itemIndex}" placeholder="${escapeHTML(getSectionItemPlaceholder(templateKey, node.sectionIndex, itemIndex))}" rows="${estimateTextareaRows(item || '', 2, 10, 20)}" class="flex-1 resize-none overflow-hidden bg-transparent text-[13px] leading-6 outline-none${getReadonlyTextareaClass(state)}" style="color:${palette.text};"${getReadonlyTextareaAttributes(state)}>${escapeHTML(item || '')}</textarea>
                  ${readOnly ? '' : `<button type="button" data-project-graph-action="delete-item" data-section-index="${node.sectionIndex}" data-item-index="${itemIndex}" class="mt-0.5 rounded-full border px-2 py-0.5 text-[10px] leading-4" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};color:${palette.mutedText};">-</button>`}
                </div>
              </div>
            `).join('') : `
              <div class="rounded-[18px] border border-dashed px-3 py-3" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'};background:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.018)' : 'rgba(255,255,255,0.32)'};">
                <div class="text-[12px] leading-6" style="color:${palette.mutedText};">${escapeHTML(emptySectionHint)}</div>
                ${readOnly ? '' : `<button type="button" data-project-graph-action="add-item" data-section-index="${node.sectionIndex}" class="mt-2 inline-flex rounded-full border px-3 py-1.5 text-[11px] leading-5" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)'};color:${palette.mutedText};">开始写第一条</button>`}
              </div>
            `}
          </div>
        </div>
      </article>
    `;
  }

  function buildGraphMarkup(state) {
    const palette = state.graph.palette;
    const layout = getLayoutMetrics(state);
    const viewportCursor = state.pointer?.type === 'pan'
      ? 'grabbing'
      : (state.spacePressed ? 'grab' : 'default');
    const hasSelectedNode = !!getNodeById(state, state.selectedNodeId);

    return `
      <div data-project-graph-stage="1" class="relative h-full w-full overflow-hidden" style="background:${palette.panelBg};cursor:${viewportCursor};">
        <div class="pointer-events-none absolute inset-0 opacity-70" style="background-image:linear-gradient(90deg,${palette.grid} 1px,transparent 1px),linear-gradient(${palette.grid} 1px,transparent 1px);background-size:20px 20px;"></div>
        <div class="pointer-events-none absolute inset-0 opacity-80" style="background-image:radial-gradient(circle at 50% 24%,${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.52)'} 0%,transparent 44%);"></div>
        <div class="absolute left-4 top-4 z-30 flex flex-wrap items-center gap-2">
          ${state.readOnly ? '' : `<button type="button" data-project-graph-action="add-section" class="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] leading-5 backdrop-blur-sm" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};background:${state.graph.theme === 'dark' ? 'rgba(0,0,0,0.24)' : 'rgba(255,255,255,0.74)'};color:${palette.text};">新卡片</button>`}
          <button type="button" data-project-graph-action="focus-selection" aria-disabled="${hasSelectedNode ? 'false' : 'true'}" class="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] leading-5 backdrop-blur-sm" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};background:${state.graph.theme === 'dark' ? 'rgba(0,0,0,0.24)' : 'rgba(255,255,255,0.74)'};color:${hasSelectedNode ? palette.text : palette.mutedText};opacity:${hasSelectedNode ? '1' : '0.66'};pointer-events:${hasSelectedNode ? 'auto' : 'none'};">聚焦所选</button>
          <button type="button" data-project-graph-action="fit-view" class="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] leading-5 backdrop-blur-sm" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};background:${state.graph.theme === 'dark' ? 'rgba(0,0,0,0.24)' : 'rgba(255,255,255,0.74)'};color:${palette.text};">适应视图</button>
          <button type="button" data-project-graph-action="reset-layout" class="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] leading-5 backdrop-blur-sm" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};background:${state.graph.theme === 'dark' ? 'rgba(0,0,0,0.24)' : 'rgba(255,255,255,0.74)'};color:${palette.text};">重排</button>
        </div>
        <div class="absolute right-4 top-4 z-30 flex items-center gap-2 rounded-full border px-2 py-2 backdrop-blur-sm" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};background:${state.graph.theme === 'dark' ? 'rgba(0,0,0,0.24)' : 'rgba(255,255,255,0.74)'};">
          <button type="button" data-project-graph-action="zoom-out" class="inline-flex h-7 w-7 items-center justify-center rounded-full border text-[14px]" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};color:${palette.text};">-</button>
          <button type="button" data-project-graph-action="actual-size" data-project-graph-zoom-label="1" class="min-w-[56px] text-center text-[11px] font-medium tracking-[0.16em]" style="color:${palette.text};">${Math.round(state.viewport.scale * 100)}%</button>
          <button type="button" data-project-graph-action="zoom-in" class="inline-flex h-7 w-7 items-center justify-center rounded-full border text-[14px]" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};color:${palette.text};">+</button>
          <button type="button" data-project-graph-action="toggle-shortcuts" class="inline-flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-semibold leading-none" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'};background:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'};color:${palette.mutedText};">?</button>
        </div>
        <div data-project-graph-canvas="1" class="absolute inset-0 overflow-hidden" style="touch-action:none;">
          <div data-project-graph-world="1" class="absolute left-0 top-0" style="width:${Math.round(layout.width)}px;height:${Math.round(layout.height)}px;transform-origin:0 0;transform:${buildViewportTransform(state)};">
            <div data-project-graph-connectors="1" class="absolute inset-0 pointer-events-none">${buildCanvasDecoration(state)}</div>
            <div class="absolute inset-0">${state.graph.nodes.map((node) => buildNodeMarkup(state, node)).join('')}</div>
          </div>
        </div>
        <div class="pointer-events-none absolute bottom-4 left-4 z-30 rounded-full border px-3 py-1.5 text-[10px] tracking-[0.18em] backdrop-blur-sm" style="border-color:${state.graph.theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'};background:${state.graph.theme === 'dark' ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.62)'};color:${palette.mutedText};">
          ${escapeHTML(getBottomHintText(state))}
        </div>
        ${buildShortcutOverlayMarkup(state)}
      </div>
    `;
  }

  function getNodeById(state, nodeId) {
    return state.graph.nodes.find((node) => String(node.id || '').trim() === String(nodeId || '').trim()) || null;
  }

  function selectNode(state, nodeId, options = {}) {
    const nextId = sanitizeText(nodeId || '', 64);
    if (!nextId) return false;
    if (!getNodeById(state, nextId)) return false;
    const changed = state.selectedNodeId !== nextId;
    state.selectedNodeId = nextId;
    if (changed && options.rerender !== false) rerender(state);
    return true;
  }

  function ensureSelectedNodeExists(state) {
    if (getNodeById(state, state.selectedNodeId)) return true;
    if (getNodeById(state, 'central-topic')) {
      state.selectedNodeId = 'central-topic';
      return true;
    }
    if (getNodeById(state, 'focus-question')) {
      state.selectedNodeId = 'focus-question';
      return true;
    }
    const firstNode = Array.isArray(state.graph?.nodes) ? state.graph.nodes.find(Boolean) : null;
    state.selectedNodeId = sanitizeText(firstNode?.id || '', 64);
    return !!state.selectedNodeId;
  }

  function updateNodeElementPosition(state, node) {
    if (!node || !state.container?.isConnected) return false;
    const nodeEl = getNodeElement(state, node.id);
    if (!(nodeEl instanceof HTMLElement)) return false;
    const layout = getLayoutMetrics(state);
    nodeEl.style.left = `${((Number(node.x) || 0.5) * layout.width).toFixed(2)}px`;
    nodeEl.style.top = `${((Number(node.y) || 0.5) * layout.height).toFixed(2)}px`;
    nodeEl.style.width = `${estimateNodeWidthPx(node, state.graph?.organizer?.templateKey || '')}px`;
    return true;
  }

  function getNodeFramePx(state, node) {
    const layout = getLayoutMetrics(state);
    const nodeEl = getNodeElement(state, node?.id);
    const measuredWidth = nodeEl?.offsetWidth || nodeEl?.getBoundingClientRect?.().width || 0;
    const measuredHeight = nodeEl?.offsetHeight || nodeEl?.getBoundingClientRect?.().height || 0;
    const width = measuredWidth > 0
      ? measuredWidth
      : estimateNodeWidthPx(node, state.graph?.organizer?.templateKey || '');
    const height = measuredHeight > 0
      ? measuredHeight
      : Math.max(
        estimateNodeHeightRatio(node, layout) * layout.height,
        estimateNodeMinHeightPx(node, layout),
      );
    const centerX = (Number(node?.x) || 0.5) * layout.width;
    const centerY = (Number(node?.y) || 0.5) * layout.height;
    return {
      width,
      height,
      centerX,
      centerY,
      left: centerX - (width / 2),
      right: centerX + (width / 2),
      top: centerY - (height / 2),
      bottom: centerY + (height / 2),
    };
  }

  function getBigQuestionNodeCollisionPriority(node) {
    if (node?.type === 'focus') return 0;
    if (node?.type === 'central') return 1;
    return 10 + Math.max(0, Number(node?.sectionIndex) || 0);
  }

  function nudgeNodeByPx(state, node, deltaX = 0, deltaY = 0, options = {}) {
    if (!node) return false;
    const layout = getLayoutMetrics(state);
    const sideInsetPx = Math.max(0, Number(options.sideInsetPx) || 0);
    const topInsetPx = Math.max(0, Number(options.topInsetPx) || 0);
    const bottomInsetPx = Math.max(0, Number(options.bottomInsetPx) || 0);
    const width = estimateNodeWidthPx(node, state.graph?.organizer?.templateKey || '');
    const height = Math.max(
      estimateNodeHeightRatio(node, layout) * layout.height,
      getNodeElement(state, node?.id)?.offsetHeight || getNodeElement(state, node?.id)?.getBoundingClientRect?.().height || 0,
      estimateNodeMinHeightPx(node, layout),
    );
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const minCenterX = sideInsetPx + halfWidth;
    const maxCenterX = Math.max(minCenterX, layout.width - sideInsetPx - halfWidth);
    const minCenterY = topInsetPx + halfHeight;
    const maxCenterY = Math.max(minCenterY, layout.height - bottomInsetPx - halfHeight);
    const currentCenterX = (Number(node.x) || 0.5) * layout.width;
    const currentCenterY = (Number(node.y) || 0.5) * layout.height;
    const nextCenterX = clamp(currentCenterX + (Number(deltaX) || 0), minCenterX, maxCenterX);
    const nextCenterY = clamp(currentCenterY + (Number(deltaY) || 0), minCenterY, maxCenterY);
    node.x = nextCenterX / Math.max(1, layout.width);
    node.y = nextCenterY / Math.max(1, layout.height);
    return true;
  }

  function resolveBigQuestionNodeCollisions(state, nodes, options = {}) {
    const safeNodes = Array.isArray(nodes) ? nodes.filter(Boolean) : [];
    if (!safeNodes.length) return false;
    const minGapPx = Math.max(12, Number(options.minGapPx) || 20);
    const sideInsetPx = Math.max(16, Number(options.sideInsetPx) || 28);
    const topInsetPx = Math.max(72, Number(options.topInsetPx) || 120);
    const bottomInsetPx = Math.max(24, Number(options.bottomInsetPx) || 36);
    let changed = false;

    safeNodes.forEach((node) => {
      const frame = getNodeFramePx(state, node);
      let deltaX = 0;
      let deltaY = 0;
      if (frame.left < sideInsetPx) deltaX += sideInsetPx - frame.left;
      if (frame.right > (getLayoutMetrics(state).width - sideInsetPx)) deltaX -= frame.right - (getLayoutMetrics(state).width - sideInsetPx);
      if (frame.top < topInsetPx) deltaY += topInsetPx - frame.top;
      if (frame.bottom > (getLayoutMetrics(state).height - bottomInsetPx)) deltaY -= frame.bottom - (getLayoutMetrics(state).height - bottomInsetPx);
      if (deltaX || deltaY) {
        nudgeNodeByPx(state, node, deltaX, deltaY, { sideInsetPx, topInsetPx, bottomInsetPx });
        changed = true;
      }
    });

    for (let pass = 0; pass < 18; pass += 1) {
      let passChanged = false;
      for (let i = 0; i < safeNodes.length; i += 1) {
        for (let j = i + 1; j < safeNodes.length; j += 1) {
          const left = safeNodes[i];
          const right = safeNodes[j];
          const frameA = getNodeFramePx(state, left);
          const frameB = getNodeFramePx(state, right);
          const overlapX = Math.min(frameA.right, frameB.right) - Math.max(frameA.left, frameB.left);
          const overlapY = Math.min(frameA.bottom, frameB.bottom) - Math.max(frameA.top, frameB.top);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const priorityA = getBigQuestionNodeCollisionPriority(left);
          const priorityB = getBigQuestionNodeCollisionPriority(right);
          const movable = priorityA === priorityB
            ? (frameA.centerY <= frameB.centerY ? right : left)
            : (priorityA < priorityB ? right : left);
          const anchor = movable === right ? left : right;
          const movableFrame = movable === right ? frameB : frameA;
          const anchorFrame = movable === right ? frameA : frameB;
          const verticalBias = movableFrame.centerY >= anchorFrame.centerY ? 1 : -1;
          const horizontalBias = movableFrame.centerX >= anchorFrame.centerX ? 1 : -1;
          const separationY = overlapY + minGapPx;
          const separationX = overlapX + minGapPx;
          const preferVertical = overlapY <= overlapX || movable?.type === 'focus' || anchor?.type === 'focus' || movable?.type === 'central' || anchor?.type === 'central';
          if (preferVertical) {
            nudgeNodeByPx(state, movable, 0, verticalBias * separationY, { sideInsetPx, topInsetPx, bottomInsetPx });
          } else {
            nudgeNodeByPx(state, movable, horizontalBias * separationX, 0, { sideInsetPx, topInsetPx, bottomInsetPx });
          }
          passChanged = true;
          changed = true;
        }
      }
      if (!passChanged) break;
    }

    safeNodes.forEach((node) => updateNodeElementPosition(state, node));
    return changed;
  }

  function updateConnectorPositions(state) {
    if (!state.container?.isConnected) return false;
    const connectorLayer = state.container.querySelector('[data-project-graph-connectors="1"]');
    if (!(connectorLayer instanceof HTMLElement)) return false;
    connectorLayer.innerHTML = buildCanvasDecoration(state);
    return true;
  }

  function applyViewportPresentation(state) {
    if (!state.container?.isConnected) return false;
    const worldEl = state.container.querySelector('[data-project-graph-world]');
    const stageEl = state.container.querySelector('[data-project-graph-stage]');
    const zoomLabel = state.container.querySelector('[data-project-graph-zoom-label]');
    if (worldEl instanceof HTMLElement) worldEl.style.transform = buildViewportTransform(state);
    if (stageEl instanceof HTMLElement) {
      stageEl.style.cursor = state.pointer?.type === 'pan' ? 'grabbing' : (state.spacePressed ? 'grab' : 'default');
    }
    if (zoomLabel instanceof HTMLElement) zoomLabel.textContent = `${Math.round(state.viewport.scale * 100)}%`;
    return true;
  }

  function applyBigQuestionMapCanonicalSpacing(state) {
    if (!state.container?.isConnected) return false;
    if (normalizeTemplateKey(state.graph?.organizer?.templateKey) !== 'big-question-map') return false;
    const layout = getLayoutMetrics(state);
    const focusNode = getNodeById(state, 'focus-question');
    const centralNode = getNodeById(state, 'central-topic');
    if (!focusNode || !centralNode) return false;
    const sectionNodes = state.graph.nodes
      .filter((node) => node?.type === 'section')
      .sort((left, right) => (Number(left?.sectionIndex) || 0) - (Number(right?.sectionIndex) || 0));
    const primarySections = sectionNodes.slice(0, 5);
    const overflowSections = sectionNodes.slice(5);
    const section1 = primarySections[0] || null;
    const section2 = primarySections[1] || null;
    const section3 = primarySections[2] || null;
    const section4 = primarySections[3] || null;
    const section5 = primarySections[4] || null;
    const targetNodes = [focusNode, centralNode].concat(sectionNodes).filter(Boolean);
    const topInset = 96;
    const sideInset = 72;
    const focusGap = 96;
    const rowGap = 82;
    const lowerGap = 104;
    const centralGap = 78;
    const branchGap = 148;
    const focusWidth = estimateNodeWidthPx(focusNode, 'big-question-map');
    const centralWidth = estimateNodeWidthPx(centralNode, 'big-question-map');
    const sideWidth = section1 ? Math.min(272, estimateNodeWidthPx(section1, 'big-question-map')) : 272;
    const lowerWidth = section3 ? Math.min(272, estimateNodeWidthPx(section3, 'big-question-map')) : 272;
    const solutionWidth = section5 ? Math.min(820, Math.max(760, estimateNodeWidthPx(section5, 'big-question-map'))) : 820;
    const focusHeight = getNodeMeasuredHeightPx(state, focusNode, 188);
    const centralHeight = getNodeMeasuredHeightPx(state, centralNode, 92);
    const upperSectionRowHeight = Math.max(
      section1 ? getNodeMeasuredHeightPx(state, section1, 220) : 0,
      section2 ? getNodeMeasuredHeightPx(state, section2, 220) : 0,
      0,
    );
    const lowerRowHeight = Math.max(
      section3 ? getNodeMeasuredHeightPx(state, section3, 220) : 0,
      section4 ? getNodeMeasuredHeightPx(state, section4, 220) : 0,
      0,
    );
    const solutionHeight = section5 ? getNodeMeasuredHeightPx(state, section5, 220) : 0;

    const availableWidth = Math.max(360, layout.width - (sideInset * 2));
    const pairGap = Math.max(132, Math.min(220, Math.floor((availableWidth - (lowerWidth * 2)) / 2.4)));
    const pairLeft = Math.max(sideInset, Math.floor((layout.width - ((lowerWidth * 2) + pairGap)) / 2));
    const leftCenter = pairLeft + (lowerWidth / 2);
    const rightCenter = pairLeft + lowerWidth + pairGap + (lowerWidth / 2);

    setNodeFramePx(state, focusNode, layout.width / 2, topInset + (focusHeight / 2), focusWidth);
    let cursorTop = topInset + focusHeight + focusGap;

    setNodeFramePx(state, centralNode, layout.width / 2, cursorTop + (centralHeight / 2), centralWidth);
    cursorTop += centralHeight + centralGap;
    if (section1 || section2) {
      const centerY = cursorTop + (upperSectionRowHeight / 2);
      if (section1) setNodeFramePx(state, section1, leftCenter, centerY, sideWidth);
      if (section2) setNodeFramePx(state, section2, rightCenter, centerY, sideWidth);
      cursorTop += upperSectionRowHeight + branchGap;
    }

    if (section3 || section4) {
      const centerY = cursorTop + (lowerRowHeight / 2);
      if (section3) setNodeFramePx(state, section3, leftCenter, centerY, lowerWidth);
      if (section4) setNodeFramePx(state, section4, rightCenter, centerY, lowerWidth);
      cursorTop += lowerRowHeight + lowerGap;
    }

    if (section5) {
      setNodeFramePx(state, section5, layout.width / 2, cursorTop + (solutionHeight / 2), solutionWidth);
      cursorTop += solutionHeight + lowerGap;
    }

    if (overflowSections.length) {
      layoutOverflowRowsPx(state, overflowSections, cursorTop, {
        pairWidth: 320,
        pairGap: 44,
        singleWidth: 420,
        rowGap: 46,
        defaultHeight: 220,
      });
    }
    return true;
  }

  function layoutOverflowRows(overflowNodes, heights, startTop, options = {}) {
    const nodes = Array.isArray(overflowNodes) ? overflowNodes.filter(Boolean) : [];
    if (!nodes.length) return Number(startTop) || 0;
    const columnXs = Array.isArray(options.columnXs) && options.columnXs.length >= 2 ? options.columnXs : [0.31, 0.69];
    const width = Number(options.width) || 0.26;
    const singleWidth = Number(options.singleWidth) || Math.max(width, 0.30);
    const defaultHeight = Number(options.defaultHeight) || 0.24;
    const rowGap = Number(options.rowGap) || 0.08;
    let cursorTop = Number(startTop) || 0;
    for (let index = 0; index < nodes.length; index += 2) {
      const leftNode = nodes[index] || null;
      const rightNode = nodes[index + 1] || null;
      const rowHeight = Math.max(
        leftNode ? (heights.get(leftNode.id) || leftNode.height || defaultHeight) : 0,
        rightNode ? (heights.get(rightNode.id) || rightNode.height || defaultHeight) : 0,
      );
      if (leftNode) {
        leftNode.x = rightNode ? columnXs[0] : 0.50;
        leftNode.width = rightNode ? width : singleWidth;
        leftNode.y = cursorTop + (rowHeight / 2);
      }
      if (rightNode) {
        rightNode.x = columnXs[1];
        rightNode.width = width;
        rightNode.y = cursorTop + (rowHeight / 2);
      }
      cursorTop += rowHeight + rowGap;
    }
    return cursorTop - rowGap;
  }

  function getNodeMeasuredHeightPx(state, node, fallbackPx = 220) {
    const layout = getLayoutMetrics(state);
    const defaultPx = Math.max(80, Number(fallbackPx) || 220);
    if (!node) return defaultPx;
    const el = getNodeElement(state, node.id);
    const measuredHeight = el?.offsetHeight || el?.getBoundingClientRect?.().height || 0;
    if (measuredHeight > 0) return measuredHeight;
    return Math.max(defaultPx, estimateNodeHeightRatio(node, layout) * layout.height);
  }

  function setNodeFramePx(state, node, centerX, centerY, widthPx) {
    if (!node) return false;
    const layout = getLayoutMetrics(state);
    node.x = (Number(centerX) || 0) / Math.max(1, layout.width);
    node.y = (Number(centerY) || 0) / Math.max(1, layout.height);
    if (Number.isFinite(Number(widthPx)) && Number(widthPx) > 0) {
      node.width = Number(widthPx) / Math.max(1, layout.width);
    }
    updateNodeElementPosition(state, node);
    return true;
  }

  function layoutOverflowRowsPx(state, overflowNodes, startTopPx, options = {}) {
    const layout = getLayoutMetrics(state);
    const nodes = Array.isArray(overflowNodes) ? overflowNodes.filter(Boolean) : [];
    if (!nodes.length) return Number(startTopPx) || 0;
    const pairWidth = Number(options.pairWidth) || 280;
    const pairGap = Number(options.pairGap) || 36;
    const singleWidth = Number(options.singleWidth) || 340;
    const rowGap = Number(options.rowGap) || 40;
    const defaultHeight = Number(options.defaultHeight) || 220;
    const totalPairWidth = (pairWidth * 2) + pairGap;
    const pairLeft = (layout.width - totalPairWidth) / 2;
    const leftCenter = pairLeft + (pairWidth / 2);
    const rightCenter = pairLeft + pairWidth + pairGap + (pairWidth / 2);
    let cursorTop = Number(startTopPx) || 0;

    for (let index = 0; index < nodes.length; index += 2) {
      const leftNode = nodes[index] || null;
      const rightNode = nodes[index + 1] || null;
      const rowHeight = Math.max(
        leftNode ? getNodeMeasuredHeightPx(state, leftNode, defaultHeight) : 0,
        rightNode ? getNodeMeasuredHeightPx(state, rightNode, defaultHeight) : 0,
      );
      const centerY = cursorTop + (rowHeight / 2);
      if (leftNode) {
        setNodeFramePx(state, leftNode, rightNode ? leftCenter : (layout.width / 2), centerY, rightNode ? pairWidth : singleWidth);
      }
      if (rightNode) {
        setNodeFramePx(state, rightNode, rightCenter, centerY, pairWidth);
      }
      cursorTop += rowHeight + rowGap;
    }
    return cursorTop - rowGap;
  }

  function applyMainConceptMapCanonicalSpacing(state) {
    if (!state.container?.isConnected) return false;
    if (normalizeTemplateKey(state.graph?.organizer?.templateKey) !== 'main-concepts-map') return false;
    const layout = getLayoutMetrics(state);
    const centralNode = getNodeById(state, 'central-topic');
    if (!centralNode) return false;
    const sectionNodes = state.graph.nodes
      .filter((node) => node?.type === 'section')
      .sort((left, right) => (Number(left?.sectionIndex) || 0) - (Number(right?.sectionIndex) || 0));
    const topSections = sectionNodes.slice(0, 3);
    const illustrationNode = sectionNodes[3] || null;
    const overflowSections = sectionNodes.slice(4);
    const centralWidth = estimateNodeWidthPx(centralNode, 'main-concepts-map');
    const topWidth = topSections[0] ? estimateNodeWidthPx(topSections[0], 'main-concepts-map') : 280;
    const illustrationWidth = illustrationNode ? estimateNodeWidthPx(illustrationNode, 'main-concepts-map') : 960;
    const centralHeight = getNodeMeasuredHeightPx(state, centralNode, 132);
    const topGap = 34;
    const rowGap = 38;
    const topRowGap = Math.max(28, Math.min(52, (layout.width - (topWidth * 3)) / 4));
    const totalTopWidth = (topWidth * 3) + (topRowGap * 2);
    const topLeft = (layout.width - totalTopWidth) / 2;
    const topCenters = [0, 1, 2].map((index) => topLeft + (topWidth / 2) + (index * (topWidth + topRowGap)));

    setNodeFramePx(state, centralNode, layout.width / 2, 88 + (centralHeight / 2), centralWidth);
    const topRowTop = 88 + centralHeight + topGap;
    topSections.forEach((node, index) => {
      const height = getNodeMeasuredHeightPx(state, node, 240);
      setNodeFramePx(state, node, topCenters[index] || (layout.width / 2), topRowTop + (height / 2), topWidth);
    });

    const topRowBottom = topSections.reduce((maxBottom, node) => {
      if (!node) return maxBottom;
      const height = getNodeMeasuredHeightPx(state, node, 240);
      const centerY = (Number(node.y) || 0.5) * layout.height;
      return Math.max(maxBottom, centerY + (height / 2));
    }, topRowTop);
    let contentBottom = topRowBottom;
    if (illustrationNode) {
      const illustrationHeight = getNodeMeasuredHeightPx(state, illustrationNode, 260);
      const illustrationTop = topRowBottom + rowGap;
      setNodeFramePx(state, illustrationNode, layout.width / 2, illustrationTop + (illustrationHeight / 2), illustrationWidth);
      contentBottom = illustrationTop + illustrationHeight;
    }
    if (overflowSections.length) {
      contentBottom = layoutOverflowRowsPx(state, overflowSections, contentBottom + rowGap, {
        pairWidth: 280,
        pairGap: Math.max(36, Math.min(96, (layout.width - (280 * 2)) / 3)),
        singleWidth: 340,
        defaultHeight: 220,
        rowGap: 38,
      });
    }
    return true;
  }

  function applyKWHLCanonicalSpacing(state) {
    if (!state.container?.isConnected) return false;
    if (normalizeTemplateKey(state.graph?.organizer?.templateKey) !== 'kwhl-chart') return false;
    const layout = getLayoutMetrics(state);
    const centralNode = getNodeById(state, 'central-topic');
    if (!centralNode) return false;
    const sections = state.graph.nodes
      .filter((node) => node?.type === 'section')
      .sort((left, right) => (Number(left?.sectionIndex) || 0) - (Number(right?.sectionIndex) || 0));
    const primarySections = sections.slice(0, 4);
    const overflowSections = sections.slice(4);
    const centralWidth = estimateNodeWidthPx(centralNode, 'kwhl-chart');
    const sectionWidth = primarySections[0] ? estimateNodeWidthPx(primarySections[0], 'kwhl-chart') : 280;
    const centralHeight = getNodeMeasuredHeightPx(state, centralNode, 116);
    const columnGap = Math.max(20, Math.min(52, (layout.width - (sectionWidth * 4)) / 5));
    const totalColumnsWidth = (sectionWidth * 4) + (columnGap * 3);
    const columnsLeft = (layout.width - totalColumnsWidth) / 2;
    const columnCenters = [0, 1, 2, 3].map((index) => columnsLeft + (sectionWidth / 2) + (index * (sectionWidth + columnGap)));
    const topPadding = 52;
    const rowGap = 34;

    setNodeFramePx(state, centralNode, layout.width / 2, topPadding + (centralHeight / 2), centralWidth);
    const columnTop = topPadding + centralHeight + 28;
    primarySections.forEach((node, index) => {
      const height = getNodeMeasuredHeightPx(state, node, 220);
      setNodeFramePx(state, node, columnCenters[index] || (layout.width / 2), columnTop + (height / 2), sectionWidth);
    });
    let contentBottom = primarySections.reduce((maxBottom, node) => {
      if (!node) return maxBottom;
      const height = getNodeMeasuredHeightPx(state, node, 220);
      const centerY = (Number(node.y) || 0.5) * layout.height;
      return Math.max(maxBottom, centerY + (height / 2));
    }, columnTop);
    if (overflowSections.length) {
      contentBottom = layoutOverflowRowsPx(state, overflowSections, contentBottom + rowGap, {
        pairWidth: 280,
        pairGap: Math.max(36, Math.min(96, (layout.width - (280 * 2)) / 3)),
        singleWidth: 340,
        defaultHeight: 220,
        rowGap: 34,
      });
    }
    return true;
  }

  function applyCompareMapCanonicalSpacing(state) {
    if (!state.container?.isConnected) return false;
    if (normalizeTemplateKey(state.graph?.organizer?.templateKey) !== 'compare-map') return false;
    const layout = getLayoutMetrics(state);
    const centralNode = getNodeById(state, 'central-topic');
    if (!centralNode) return false;
    const sectionNodes = state.graph.nodes
      .filter((node) => node?.type === 'section')
      .sort((left, right) => (Number(left?.sectionIndex) || 0) - (Number(right?.sectionIndex) || 0));
    const optionA = sectionNodes[0] || null;
    const optionB = sectionNodes[1] || null;
    const sharedNode = sectionNodes[2] || null;
    const overflowSections = sectionNodes.slice(3);
    const centralWidth = estimateNodeWidthPx(centralNode, 'compare-map');
    const optionWidth = optionA ? estimateNodeWidthPx(optionA, 'compare-map') : 320;
    const sharedWidth = sharedNode ? estimateNodeWidthPx(sharedNode, 'compare-map') : 520;
    const centralHeight = getNodeMeasuredHeightPx(state, centralNode, 108);
    const optionGap = Math.max(44, Math.min(120, (layout.width - (optionWidth * 2)) / 3));
    const totalOptionWidth = (optionWidth * 2) + optionGap;
    const optionLeft = (layout.width - totalOptionWidth) / 2;
    const optionACenterX = optionLeft + (optionWidth / 2);
    const optionBCenterX = optionLeft + optionWidth + optionGap + (optionWidth / 2);
    const topPadding = 56;
    const rowGap = 40;

    setNodeFramePx(state, centralNode, layout.width / 2, topPadding + (centralHeight / 2), centralWidth);
    const topRowTop = topPadding + centralHeight + rowGap;
    if (optionA) {
      const optionHeight = getNodeMeasuredHeightPx(state, optionA, 240);
      setNodeFramePx(state, optionA, optionACenterX, topRowTop + (optionHeight / 2), optionWidth);
    }
    if (optionB) {
      const optionHeight = getNodeMeasuredHeightPx(state, optionB, 240);
      setNodeFramePx(state, optionB, optionBCenterX, topRowTop + (optionHeight / 2), optionWidth);
    }
    const topRowBottom = Math.max(
      optionA ? (((Number(optionA.y) || 0.5) * layout.height) + (getNodeMeasuredHeightPx(state, optionA, 240) / 2)) : topRowTop,
      optionB ? (((Number(optionB.y) || 0.5) * layout.height) + (getNodeMeasuredHeightPx(state, optionB, 240) / 2)) : topRowTop,
    );
    let contentBottom = topRowBottom;
    if (sharedNode) {
      const sharedHeight = getNodeMeasuredHeightPx(state, sharedNode, 220);
      const sharedTop = topRowBottom + rowGap;
      setNodeFramePx(state, sharedNode, layout.width / 2, sharedTop + (sharedHeight / 2), sharedWidth);
      contentBottom = sharedTop + sharedHeight;
    }
    if (overflowSections.length) {
      contentBottom = layoutOverflowRowsPx(state, overflowSections, contentBottom + rowGap, {
        pairWidth: 320,
        pairGap: Math.max(44, Math.min(120, (layout.width - (320 * 2)) / 3)),
        singleWidth: 360,
        defaultHeight: 220,
        rowGap: 38,
      });
    }
    return true;
  }

  function applyTemplateCanonicalSpacing(state) {
    return applyBigQuestionMapCanonicalSpacing(state);
  }

  function getCurrentTemplateViewportKey(state) {
    void state;
    return 'big-question-map';
  }

  function getStoredViewportStateForTemplate(organizer, templateKey = '') {
    const key = normalizeTemplateKey(templateKey || organizer?.templateKey || 'big-question-map');
    const states = normalizeViewportStates(organizer?.viewportStates || {});
    return states[key] || null;
  }

  function applyStoredViewportToState(state, viewportState = null) {
    const safe = viewportState && typeof viewportState === 'object' ? sanitizeViewportState(viewportState) : null;
    if (!safe) return false;
    state.viewport.scale = safe.scale;
    state.viewport.panX = safe.panX;
    state.viewport.panY = safe.panY;
    state.viewport.userAdjusted = safe.userAdjusted === true;
    return true;
  }

  function rememberViewportState(state, options = {}) {
    const organizer = state?.graph?.organizer;
    if (!organizer || typeof organizer !== 'object') return false;
    const templateKey = getCurrentTemplateViewportKey(state);
    if (!templateKey) return false;
    organizer.viewportStates = normalizeViewportStates(organizer.viewportStates || {});
    const nextState = sanitizeViewportState({
      scale: state.viewport.scale,
      panX: state.viewport.panX,
      panY: state.viewport.panY,
      userAdjusted: options.userAdjustedOverride === true || (options.userAdjustedOverride !== false && state.viewport.userAdjusted === true),
    });
    const prevState = organizer.viewportStates[templateKey];
    const unchanged = prevState
      && Math.abs((prevState.scale || 0) - nextState.scale) < 0.0001
      && Math.abs((prevState.panX || 0) - nextState.panX) < 0.5
      && Math.abs((prevState.panY || 0) - nextState.panY) < 0.5
      && prevState.userAdjusted === nextState.userAdjusted;
    if (unchanged) return false;
    organizer.viewportStates[templateKey] = nextState;
    if (options.emit !== false) scheduleChange(state, { viewportOnly: options.viewportOnly === true });
    return true;
  }

  function scheduleChange(state, options = {}) {
    if (state.emitTimer) {
      clearTimeout(state.emitTimer);
      state.emitTimer = 0;
    }
    const delay = options.viewportOnly === true ? 0 : 140;
    state.emitTimer = window.setTimeout(() => {
      state.emitTimer = 0;
      if (typeof state.onChange !== 'function') return;
      const viewportStates = cloneJson(state.graph.organizer.viewportStates || {}, {});
      if (options.viewportOnly === true) {
        state.onChange({
          viewportStates,
        });
        return;
      }
      state.onChange({
        title: state.graph.organizer.title || state.graph.organizer.centralTopic || '',
        summary: state.graph.organizer.summary || '',
        centralTopic: state.graph.organizer.centralTopic || '',
        focusQuestion: state.graph.organizer.focusQuestion || '',
        viewportStates,
        sections: cloneJson(state.graph.organizer.sections, []),
        nodes: buildPersistedNodes(state.graph),
        edges: cloneJson(state.graph.edges, []),
      });
    }, delay);
  }

  function buildFocusSelector(focusTarget) {
    if (!focusTarget || typeof focusTarget !== 'object') return '';
    const field = String(focusTarget.field || '').trim();
    if (field === 'centralTopic') return 'textarea[data-project-graph-field="centralTopic"]';
    if (field === 'focusQuestion') return 'textarea[data-project-graph-field="focusQuestion"]';
    if (field === 'sectionTitle') return `textarea[data-project-graph-field="sectionTitle"][data-section-index="${Number(focusTarget.sectionIndex) || 0}"]`;
    if (field === 'sectionItem') return `textarea[data-project-graph-field="sectionItem"][data-section-index="${Number(focusTarget.sectionIndex) || 0}"][data-item-index="${Number(focusTarget.itemIndex) || 0}"]`;
    return '';
  }

  function flushPendingFocus(state) {
    const selector = buildFocusSelector(state.pendingFocus);
    if (!selector || !state.container?.isConnected) return false;
    state.pendingFocus = null;
    const target = state.container.querySelector(selector);
    if (!(target instanceof HTMLTextAreaElement)) return false;
    try {
      target.focus({ preventScroll: true });
    } catch (_) {
      target.focus();
    }
    try { target.select(); } catch (_) {}
    return true;
  }

  function rerender(state) {
    if (!state.container?.isConnected) return false;
    const renderToken = (Number(state.renderToken) || 0) + 1;
    state.renderToken = renderToken;
    state.container.innerHTML = buildGraphMarkup(state);
    requestAnimationFrame(() => {
      if (!state.container?.isConnected || state.renderToken !== renderToken) return;
      state.container.querySelectorAll('textarea').forEach((textarea) => {
        if (!(textarea instanceof HTMLTextAreaElement)) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      });
      applyTemplateCanonicalSpacing(state);
      applyViewportPresentation(state);
      updateConnectorPositions(state);
      flushPendingFocus(state);
      requestAnimationFrame(() => {
        if (!state.container?.isConnected || state.renderToken !== renderToken) return;
        state.container.querySelectorAll('textarea').forEach((textarea) => {
          if (!(textarea instanceof HTMLTextAreaElement)) return;
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        });
        applyTemplateCanonicalSpacing(state);
        applyViewportPresentation(state);
        updateConnectorPositions(state);
        flushPendingFocus(state);
      });
    });
    return true;
  }

  function schedulePostLayoutViewportPresentation(state, options = {}) {
    const fitToken = Number(state.renderToken) || 0;
    const mode = String(options.mode || 'focus-central').trim();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!state.container?.isConnected || state.renderToken !== fitToken) return;
        if (mode === 'fit') {
          fitGraphToViewport(state, options);
          return;
        }
        const targetNodeId = sanitizeText(options.nodeId || 'central-topic', 64) || 'central-topic';
        focusNodeInViewport(state, targetNodeId, {
          markUserAdjusted: options.markUserAdjusted === true,
          emitPersist: options.emitPersist === true,
          viewportOnly: options.viewportOnly !== false,
        });
      });
    });
    return true;
  }

  function setFocusTarget(state, focusTarget) {
    state.pendingFocus = focusTarget && typeof focusTarget === 'object' ? focusTarget : null;
    return true;
  }

  function syncGraphAfterOrganizerMutation(state, focusTarget = null) {
    state.graph = buildGraphModels(state.graph.organizer, state.theme);
    if (focusTarget) setFocusTarget(state, focusTarget);
    rerender(state);
    if (!state.viewport.userAdjusted) {
      schedulePostLayoutViewportPresentation(state, {
        mode: 'focus-central',
        nodeId: 'central-topic',
        markUserAdjusted: false,
        emitPersist: false,
        viewportOnly: true,
      });
    }
    scheduleChange(state);
    return true;
  }

  function addSection(state, insertIndex = null) {
    const targetIndex = Number.isFinite(Number(insertIndex))
      ? Math.max(0, Math.min(state.graph.organizer.sections.length, Number(insertIndex)))
      : state.graph.organizer.sections.length;
    state.graph.organizer.sections.splice(targetIndex, 0, {
      title: `新卡片 ${targetIndex + 1}`,
      items: [],
    });
    state.graph.organizer.sections = state.graph.organizer.sections.slice(0, 8);
    return syncGraphAfterOrganizerMutation(state, {
      field: 'sectionTitle',
      sectionIndex: targetIndex,
    });
  }

  function addItem(state, sectionIndex = -1, itemIndex = null) {
    const normalizedSectionIndex = Number(sectionIndex);
    if (!Number.isFinite(normalizedSectionIndex) || normalizedSectionIndex < 0) return false;
    const section = state.graph.organizer.sections[normalizedSectionIndex];
    if (!section) return false;
    if (!Array.isArray(section.items)) section.items = [];
    const targetIndex = Number.isFinite(Number(itemIndex))
      ? Math.max(0, Math.min(section.items.length, Number(itemIndex)))
      : section.items.length;
    section.items.splice(targetIndex, 0, '');
    section.items = section.items.slice(0, 8);
    return syncGraphAfterOrganizerMutation(state, {
      field: 'sectionItem',
      sectionIndex: normalizedSectionIndex,
      itemIndex: targetIndex,
    });
  }

  function deleteSection(state, sectionIndex = -1) {
    const normalizedSectionIndex = Number(sectionIndex);
    if (!Number.isFinite(normalizedSectionIndex) || normalizedSectionIndex < 0) return false;
    state.graph.organizer.sections.splice(normalizedSectionIndex, 1);
    return syncGraphAfterOrganizerMutation(state, {
      field: 'centralTopic',
    });
  }

  function deleteItem(state, sectionIndex = -1, itemIndex = -1) {
    const normalizedSectionIndex = Number(sectionIndex);
    const normalizedItemIndex = Number(itemIndex);
    if (!Number.isFinite(normalizedSectionIndex) || !Number.isFinite(normalizedItemIndex)) return false;
    const section = state.graph.organizer.sections[normalizedSectionIndex];
    if (!section || !Array.isArray(section.items)) return false;
    section.items.splice(normalizedItemIndex, 1);
    const nextItemIndex = Math.max(0, Math.min(section.items.length - 1, normalizedItemIndex));
    if (section.items.length > 0) {
      return syncGraphAfterOrganizerMutation(state, {
        field: 'sectionItem',
        sectionIndex: normalizedSectionIndex,
        itemIndex: nextItemIndex,
      });
    }
    return syncGraphAfterOrganizerMutation(state, {
      field: 'sectionTitle',
      sectionIndex: normalizedSectionIndex,
    });
  }

  function resetLayout(state) {
    state.graph.organizer.nodes = [];
    state.viewport.userAdjusted = false;
    state.viewport.panX = 0;
    state.viewport.panY = 0;
    state.viewport.scale = 1;
    return syncGraphAfterOrganizerMutation(state, null);
  }

  function toggleShortcutHelp(state, forceValue) {
    const nextValue = typeof forceValue === 'boolean' ? forceValue : !state.showShortcutHelp;
    if (state.showShortcutHelp === nextValue) return true;
    state.showShortcutHelp = nextValue;
    rerender(state);
    return true;
  }

  function moveFocusToNextInput(state, source) {
    const order = [];
    order.push({ field: 'centralTopic' });
    if (state.graph.organizer.focusQuestion) order.push({ field: 'focusQuestion' });
    state.graph.organizer.sections.forEach((section, sectionIndex) => {
      order.push({ field: 'sectionTitle', sectionIndex });
      (Array.isArray(section.items) ? section.items : []).forEach((_item, itemIndex) => {
        order.push({ field: 'sectionItem', sectionIndex, itemIndex });
      });
    });
    const sourceKey = JSON.stringify(source || {});
    const index = order.findIndex((entry) => JSON.stringify(entry) === sourceKey);
    if (index >= 0 && index < order.length - 1) {
      setFocusTarget(state, order[index + 1]);
      rerender(state);
      return true;
    }
    if (source?.field === 'sectionTitle') return addItem(state, source.sectionIndex);
    if (source?.field === 'sectionItem') return addSection(state, Number(source.sectionIndex) + 1);
    return addSection(state);
  }

  function handleEnterShortcut(state, source) {
    if (!source || typeof source !== 'object') return false;
    if (source.field === 'centralTopic' || source.field === 'focusQuestion') {
      return addSection(state);
    }
    if (source.field === 'sectionTitle') {
      return addSection(state, Number(source.sectionIndex) + 1);
    }
    if (source.field === 'sectionItem') {
      return addItem(state, source.sectionIndex, Number(source.itemIndex) + 1);
    }
    return false;
  }

  function applyTextareaChange(state, target) {
    if (state.readOnly) return false;
    if (!(target instanceof HTMLTextAreaElement)) return false;
    const field = sanitizeText(target.getAttribute('data-project-graph-field') || '', 32);
    if (!field) return false;
    const value = target.value;
    if (field === 'centralTopic') {
      state.graph.organizer.centralTopic = sanitizeText(value, 80) || '未命名项目';
      state.graph.organizer.title = state.graph.organizer.centralTopic;
      return syncGraphAfterOrganizerMutation(state, { field: 'centralTopic' });
    }
    if (field === 'focusQuestion') {
      state.graph.organizer.focusQuestion = sanitizeText(value, 160);
      return syncGraphAfterOrganizerMutation(state, { field: 'focusQuestion' });
    }
    if (field === 'sectionTitle') {
      const sectionIndex = Number(target.getAttribute('data-section-index'));
      const section = state.graph.organizer.sections[sectionIndex];
      if (!section) return false;
      section.title = sanitizeText(value, 72) || section.title || '未命名卡片';
      return syncGraphAfterOrganizerMutation(state, {
        field: 'sectionTitle',
        sectionIndex,
      });
    }
    if (field === 'sectionItem') {
      const sectionIndex = Number(target.getAttribute('data-section-index'));
      const itemIndex = Number(target.getAttribute('data-item-index'));
      const section = state.graph.organizer.sections[sectionIndex];
      if (!section || !Array.isArray(section.items) || typeof section.items[itemIndex] !== 'string') return false;
      section.items[itemIndex] = sanitizeText(value, 120);
      return syncGraphAfterOrganizerMutation(state, {
        field: 'sectionItem',
        sectionIndex,
        itemIndex,
      });
    }
    return false;
  }

  function isEditableTarget(target) {
    return !!(target && (
      target.closest?.('textarea, input, [contenteditable="true"]')
      || target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
    ));
  }

  function stepZoom(state, direction = 1) {
    const metrics = getStageMetrics(state);
    const centerX = metrics.left + (metrics.width / 2);
    const centerY = metrics.top + (metrics.height / 2);
    const multiplier = direction > 0 ? 1.12 : (1 / 1.12);
    setViewportTransform(state, state.viewport.scale * multiplier, centerX, centerY, {
      markUserAdjusted: true,
      fromScale: state.viewport.scale,
      fromPanX: state.viewport.panX,
      fromPanY: state.viewport.panY,
    });
    return true;
  }

  function handleAction(state, target) {
    const action = sanitizeText(target?.getAttribute?.('data-project-graph-action') || '', 32);
    if (!action) return false;
    if (state.readOnly && ['add-section', 'add-item', 'delete-section', 'delete-item'].includes(action)) return false;
    const sectionIndex = Number(target?.getAttribute?.('data-section-index'));
    const itemIndex = Number(target?.getAttribute?.('data-item-index'));
    if (action === 'add-section') return addSection(state);
    if (action === 'add-item') return addItem(state, sectionIndex);
    if (action === 'delete-section') return deleteSection(state, sectionIndex);
    if (action === 'delete-item') return deleteItem(state, sectionIndex, itemIndex);
    if (action === 'reset-layout') return resetLayout(state);
    if (action === 'fit-view') return fitGraphToViewport(state, { markUserAdjusted: false });
    if (action === 'focus-selection') return focusNodeInViewport(state, state.selectedNodeId, { markUserAdjusted: true });
    if (action === 'actual-size') return zoomToActualSize(state, { markUserAdjusted: true });
    if (action === 'zoom-in') return stepZoom(state, 1);
    if (action === 'zoom-out') return stepZoom(state, -1);
    if (action === 'toggle-shortcuts') return toggleShortcutHelp(state);
    return false;
  }

  function bindRuntimeEvents(state) {
    const container = state.container;

    const onClick = (event) => {
      const target = event.target;
      if (!target || !target.closest) return;
      const actionButton = target.closest('[data-project-graph-action]');
      if (actionButton) {
        const activeTextarea = container.contains(document.activeElement) && document.activeElement instanceof HTMLTextAreaElement
          ? document.activeElement
          : null;
        if (activeTextarea) applyTextareaChange(state, activeTextarea);
        event.preventDefault();
        event.stopPropagation();
        handleAction(state, actionButton);
        return;
      }
      const nodeEl = target.closest('[data-project-graph-node-id]');
      if (nodeEl) {
        selectNode(state, nodeEl.getAttribute('data-project-graph-node-id') || '');
      }
    };

    const onChange = (event) => {
      if (state.readOnly) return;
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) return;
      applyTextareaChange(state, target);
    };

    const onInput = (event) => {
      if (state.readOnly) return;
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) return;
      target.style.height = 'auto';
      target.style.height = `${target.scrollHeight}px`;
    };

    const onLocalKeyDown = (event) => {
      if (event.__projectGraphHandled === true) return;
      if (event.code === 'Space' && !event.repeat && !isEditableTarget(event.target || document.activeElement)) {
        state.spacePressed = true;
        applyViewportPresentation(state);
        event.preventDefault();
      }

      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) return;
      if (state.readOnly) return;
      if (event.isComposing) return;
      const field = sanitizeText(target.getAttribute('data-project-graph-field') || '', 32);
      if (!field) return;
      const focusSource = {
        field,
        sectionIndex: Number(target.getAttribute('data-section-index')),
        itemIndex: Number(target.getAttribute('data-item-index')),
      };
      if (event.key === 'Tab') {
        event.__projectGraphHandled = true;
        event.preventDefault();
        applyTextareaChange(state, target);
        moveFocusToNextInput(state, focusSource);
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.__projectGraphHandled = true;
        event.preventDefault();
        applyTextareaChange(state, target);
        handleEnterShortcut(state, focusSource);
      }
    };

    const onLocalKeyUp = (event) => {
      if (event.code !== 'Space') return;
      state.spacePressed = false;
      applyViewportPresentation(state);
    };

    const onWindowKeyDown = (event) => {
      if (event.repeat) return;
      const editing = isEditableTarget(event.target || document.activeElement);
      if ((event.key === '?' || (event.key === '/' && event.shiftKey) || event.key === 'F1') && !editing) {
        event.preventDefault();
        toggleShortcutHelp(state);
        return;
      }
      if (event.key === 'Escape' && state.showShortcutHelp) {
        event.preventDefault();
        toggleShortcutHelp(state, false);
        return;
      }
      if (editing) return;
      if (event.code === 'Space') {
        state.spacePressed = true;
        applyViewportPresentation(state);
        event.preventDefault();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '0') {
        event.preventDefault();
        zoomToActualSize(state, { markUserAdjusted: true });
        return;
      }
      if (event.key === '1') {
        event.preventDefault();
        fitGraphToViewport(state, { markUserAdjusted: false });
        return;
      }
      if (event.key === '2') {
        event.preventDefault();
        focusNodeInViewport(state, state.selectedNodeId, { markUserAdjusted: true });
      }
    };

    const onWindowKeyUp = (event) => {
      if (event.code !== 'Space') return;
      state.spacePressed = false;
      applyViewportPresentation(state);
    };

    const onWindowBlur = () => {
      state.spacePressed = false;
      state.pointer = null;
      applyViewportPresentation(state);
    };

    const onWheel = (event) => {
      if (!state.container?.isConnected) return;
      const isZoomGesture = !!(event.ctrlKey || event.metaKey);
      if (isZoomGesture) {
        const nextScale = state.viewport.scale * Math.exp(-event.deltaY * ZOOM_MULTIPLIER);
        setViewportTransform(state, nextScale, event.clientX, event.clientY, {
          markUserAdjusted: true,
          fromScale: state.viewport.scale,
          fromPanX: state.viewport.panX,
          fromPanY: state.viewport.panY,
        });
      } else {
        panViewportBy(state, -event.deltaX, -event.deltaY, { markUserAdjusted: true });
      }
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerMove = (event) => {
      const pointer = state.pointer;
      if (!pointer) return;
      if (pointer.type === 'pan') {
        state.viewport.panX = pointer.startPanX + ((Number(event.clientX) || 0) - pointer.startClientX);
        state.viewport.panY = pointer.startPanY + ((Number(event.clientY) || 0) - pointer.startClientY);
        state.viewport.userAdjusted = true;
        applyViewportPresentation(state);
        return;
      }
    };

    const onPointerUp = () => {
      const pointer = state.pointer;
      if (!pointer) return;
      state.pointer = null;
      applyViewportPresentation(state);
      if (pointer.type === 'pan') {
        rememberViewportState(state, {
          emit: true,
          viewportOnly: true,
          userAdjustedOverride: true,
        });
      }
    };

    const onPointerDown = (event) => {
      const target = event.target;
      if (!target || !target.closest) return;
      if (typeof event.button === 'number' && event.button !== 0) return;
      const nodeEl = target.closest('[data-project-graph-node-id]');
      const canPan = state.spacePressed || (!nodeEl && !isEditableTarget(target));
      if (canPan) {
        state.pointer = {
          type: 'pan',
          startClientX: Number(event.clientX) || 0,
          startClientY: Number(event.clientY) || 0,
          startPanX: state.viewport.panX,
          startPanY: state.viewport.panY,
        };
        applyViewportPresentation(state);
        event.preventDefault();
        return;
      }
      if (isEditableTarget(target) || target.closest('button')) return;
      if (!nodeEl) return;
      const nodeId = sanitizeText(nodeEl.getAttribute('data-project-graph-node-id') || '', 64);
      selectNode(state, nodeId);
    };

    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
        if (!state.container?.isConnected) return;
        state.container.querySelectorAll('textarea').forEach((textarea) => {
          if (!(textarea instanceof HTMLTextAreaElement)) return;
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        });
      })
      : null;
    if (resizeObserver) resizeObserver.observe(container);

    container.addEventListener('click', onClick);
    container.addEventListener('change', onChange);
    container.addEventListener('input', onInput);
    container.addEventListener('keydown', onLocalKeyDown);
    container.addEventListener('keyup', onLocalKeyUp);
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('keydown', onWindowKeyDown);
    window.addEventListener('keyup', onWindowKeyUp);

    state.cleanup = () => {
      resizeObserver?.disconnect?.();
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      container.removeEventListener('input', onInput);
      container.removeEventListener('keydown', onLocalKeyDown);
      container.removeEventListener('keyup', onLocalKeyUp);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('keydown', onWindowKeyDown);
      window.removeEventListener('keyup', onWindowKeyUp);
    };
  }

  function mount(container, options) {
    const host = container instanceof HTMLElement ? container : null;
    if (!host) return false;
    unmount(host);
    const config = options && typeof options === 'object' ? options : {};
    const theme = String(config.theme || 'light') === 'dark' ? 'dark' : 'light';
    const state = {
      container: host,
      cleanup: null,
      emitTimer: 0,
      onChange: typeof config.onChange === 'function' ? config.onChange : null,
      selectedNodeId: 'central-topic',
      pendingFocus: null,
      pointer: null,
      showShortcutHelp: false,
      spacePressed: false,
      theme,
      readOnly: config.readOnly === true,
      markerId: `project-graph-arrow-${Math.random().toString(36).slice(2, 10)}`,
      activeTemplateKey: 'big-question-map',
      renderToken: 0,
      viewport: {
        scale: 1,
        panX: 0,
        panY: 0,
        userAdjusted: false,
      },
      layout: getStageMetrics({ container: host }),
      graph: buildGraphModels(config.organizer || null, theme),
    };
    state.activeTemplateKey = getCurrentTemplateViewportKey(state);
    ensureSelectedNodeExists(state);
    rerender(state);
    bindRuntimeEvents(state);
    schedulePostLayoutViewportPresentation(state, {
      mode: 'focus-central',
      nodeId: 'central-topic',
      markUserAdjusted: false,
      emitPersist: false,
      viewportOnly: true,
    });
    mountStateByContainer.set(host, state);
    return true;
  }

  function update(container, options) {
    const host = container instanceof HTMLElement ? container : null;
    const state = host ? mountStateByContainer.get(host) : null;
    if (!host || !state) return false;
    const config = options && typeof options === 'object' ? options : {};
    state.onChange = typeof config.onChange === 'function' ? config.onChange : state.onChange;
    state.theme = String(config.theme || state.theme || 'light') === 'dark' ? 'dark' : 'light';
    state.readOnly = config.readOnly === true;
    if (!(state.layout && Number(state.layout.width) > 0 && Number(state.layout.height) > 0)) state.layout = getStageMetrics(state);
    const nextOrganizer = normalizeOrganizer(config.organizer || state.graph.organizer);
    const nextTemplateKey = normalizeTemplateKey(nextOrganizer.templateKey || 'big-question-map');
    const templateChanged = nextTemplateKey !== state.activeTemplateKey;
    state.graph = buildGraphModels(nextOrganizer, state.theme);
    state.activeTemplateKey = nextTemplateKey;
    state.selectedNodeId = 'central-topic';
    if (templateChanged) {
      state.viewport.scale = 1;
      state.viewport.panX = 0;
      state.viewport.panY = 0;
      state.viewport.userAdjusted = false;
    }
    ensureSelectedNodeExists(state);
    rerender(state);
    if (templateChanged || !state.viewport.userAdjusted) {
      schedulePostLayoutViewportPresentation(state, {
        mode: 'focus-central',
        nodeId: 'central-topic',
        markUserAdjusted: false,
        emitPersist: false,
        viewportOnly: true,
      });
    }
    return true;
  }

  function unmount(container) {
    const host = container instanceof HTMLElement ? container : null;
    const state = host ? mountStateByContainer.get(host) : null;
    if (!host || !state) return false;
    if (state.emitTimer) {
      clearTimeout(state.emitTimer);
      state.emitTimer = 0;
    }
    if (typeof state.cleanup === 'function') state.cleanup();
    mountStateByContainer.delete(host);
    host.innerHTML = '';
    return true;
  }

  window.MorphProjectVisualOrganizerGraphRuntime = {
    mount,
    update,
    unmount,
  };
})();
