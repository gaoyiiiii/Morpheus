(function () {
  const runtime = {
    host: null,
    caption: null,
    meta: null,
    active: false,
  };

  function unwrapData(raw) {
    const root = raw && typeof raw === 'object' ? raw : {};
    return root.data && typeof root.data === 'object' ? root.data : root;
  }

  function textOfThought(item) {
    return String(item?.text || item?.html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function fixedName(item) {
    return String(item?.title || item?.name || item?.text || '').trim() || '未命名定念';
  }

  function normalizeTokens(text) {
    const normalized = String(text || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[^\p{Script=Han}a-zA-Z0-9]+/gu, ' ')
      .trim()
      .toLowerCase();
    if (!normalized) return [];
    const words = normalized.split(/\s+/).filter((item) => item.length >= 2);
    const han = Array.from(normalized).filter((char) => /[\p{Script=Han}]/u.test(char));
    const pairs = [];
    for (let i = 0; i < han.length - 1; i += 1) pairs.push(`${han[i]}${han[i + 1]}`);
    return [...new Set([...words, ...pairs])];
  }

  function similarityScore(a, b) {
    const left = new Set(normalizeTokens(textOfThought(a)));
    const right = new Set(normalizeTokens(textOfThought(b)));
    let score = 0;
    left.forEach((token) => {
      if (right.has(token)) score += /[\p{Script=Han}]/u.test(token) ? 2 : 1.1;
    });
    return score;
  }

  function getCurrentData() {
    const source = typeof window.data !== 'undefined' ? window.data : {};
    const safe = unwrapData(source);
    return {
      fixed: Array.isArray(safe.fixed) ? safe.fixed : [],
      flashThoughts: Array.isArray(safe.flashThoughts) ? safe.flashThoughts : [],
    };
  }

  function getFocus(fixed) {
    const focusId = String(window.activeSpaceFocusId || '').trim();
    if (focusId) {
      const match = fixed.find((item) => String(item?.id || '') === focusId);
      if (match) return match;
    }
    return fixed[0] || null;
  }

  function shortLabel(text, max = 18) {
    const raw = String(text || '').trim();
    return raw.length > max ? `${raw.slice(0, max)}…` : raw;
  }

  function buildScene() {
    const { fixed, flashThoughts } = getCurrentData();
    const focus = getFocus(fixed);
    if (!focus) return { focus: null, flash: [], neighbors: [] };

    const flash = flashThoughts
      .map((item) => ({ item, score: similarityScore(focus, item) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const neighbors = fixed
      .filter((item) => String(item?.id || '') !== String(focus?.id || ''))
      .map((item) => ({ item, score: similarityScore(item, focus) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    return { focus, flash, neighbors };
  }

  function createFixedNode(title, subtitle, cls, x, y, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `space-node fixed ${cls}`.trim();
    button.style.transform = `translate(calc(-50% + ${Math.round(x)}px), calc(-50% + ${Math.round(y)}px))`;

    const core = document.createElement('div');
    core.className = 'space-core';

    const meta = document.createElement('div');
    meta.className = 'space-meta';
    meta.textContent = cls.includes('focus') ? '定念焦点' : '邻近定念';

    const titleEl = document.createElement('div');
    titleEl.className = 'space-title';
    titleEl.textContent = title;

    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'space-subtitle';
    subtitleEl.textContent = subtitle;

    core.appendChild(meta);
    core.appendChild(titleEl);
    core.appendChild(subtitleEl);
    button.appendChild(core);

    if (typeof onClick === 'function') {
      button.addEventListener('click', onClick);
    } else {
      button.style.cursor = 'default';
    }
    return button;
  }

  function createFlashNode(title, x, y) {
    const node = document.createElement('div');
    node.className = 'space-node flash';
    node.style.transform = `translate(calc(-50% + ${Math.round(x)}px), calc(-50% + ${Math.round(y)}px))`;

    const core = document.createElement('div');
    core.className = 'space-core';

    const titleEl = document.createElement('div');
    titleEl.className = 'space-title';
    titleEl.textContent = title;

    core.appendChild(titleEl);
    node.appendChild(core);
    return node;
  }

  function renderIntoHost() {
    if (!runtime.active || !runtime.host) return;
    const scene = buildScene();
    if (!scene.focus) {
      runtime.host.replaceChildren(Object.assign(document.createElement('div'), {
        className: 'space-empty',
        textContent: '暂无定念，先去创建一个定念',
      }));
      if (runtime.caption) runtime.caption.textContent = '这里会把你的定念拉到中间，再让相关闪念围过来。';
      if (runtime.meta) runtime.meta.textContent = '当前没有可聚焦的定念';
      return;
    }

    const stage = document.createElement('div');
    stage.className = 'space-stage';

    const width = Math.max(820, runtime.host.clientWidth || 0);
    const height = Math.max(520, runtime.host.clientHeight || 0);

    const axis = document.createElement('div');
    axis.className = 'space-axis';
    stage.appendChild(axis);

    const innerRing = document.createElement('div');
    innerRing.className = 'space-ring';
    innerRing.style.width = `${Math.min(500, width * 0.34)}px`;
    innerRing.style.height = `${Math.min(340, height * 0.28)}px`;
    stage.appendChild(innerRing);

    const outerRing = document.createElement('div');
    outerRing.className = 'space-ring outer';
    outerRing.style.width = `${Math.min(820, width * 0.58)}px`;
    outerRing.style.height = `${Math.min(560, height * 0.44)}px`;
    stage.appendChild(outerRing);

    stage.appendChild(createFixedNode(
      fixedName(scene.focus),
      `${scene.flash.length} 条相关闪念围绕中`,
      'focus',
      0,
      0,
      null
    ));

    const flashRX = Math.min(260, width * 0.18);
    const flashRY = Math.min(170, height * 0.15);
    scene.flash.forEach((entry, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / Math.max(1, scene.flash.length));
      const wobble = ((index % 3) - 1) * 8;
      const x = Math.cos(angle) * (flashRX + wobble);
      const y = Math.sin(angle) * (flashRY + wobble * 0.5);
      stage.appendChild(createFlashNode(shortLabel(textOfThought(entry.item), 18), x, y));
    });

    const outerRX = Math.min(390, width * 0.28);
    const outerRY = Math.min(240, height * 0.2);
    scene.neighbors.forEach((entry, index) => {
      const angle = index === 0 ? Math.PI * 0.82 : Math.PI * 0.18;
      stage.appendChild(createFixedNode(
        shortLabel(fixedName(entry.item), 16),
        '点击切换焦点',
        'neighbor',
        Math.cos(angle) * outerRX,
        Math.sin(angle) * outerRY,
        () => {
          if (typeof window.focusSpaceThought === 'function') {
            window.focusSpaceThought(String(entry.item?.id || ''));
          } else {
            window.activeSpaceFocusId = String(entry.item?.id || '');
            renderIntoHost();
          }
        }
      ));
    });

    runtime.host.replaceChildren(stage);
    if (runtime.caption) runtime.caption.textContent = `当前聚焦：${fixedName(scene.focus)}`;
    if (runtime.meta) runtime.meta.textContent = `${scene.flash.length} 条闪念在内环，${scene.neighbors.length} 个定念留在外围。`;
  }

  function mount({ host, caption, meta }) {
    runtime.host = host || null;
    runtime.caption = caption || null;
    runtime.meta = meta || null;
    runtime.active = true;
    renderIntoHost();
  }

  function unmount() {
    runtime.active = false;
    if (runtime.host) runtime.host.replaceChildren();
  }

  function refresh() {
    renderIntoHost();
  }

  window.MorphSpaceCleanRuntime = {
    mount,
    unmount,
    refresh,
  };
})();
