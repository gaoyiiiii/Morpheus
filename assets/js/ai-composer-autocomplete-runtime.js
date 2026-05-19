// @ts-check
(function initMorphAIComposerAutocompleteRuntime() {
  if (typeof window === 'undefined') return;

  const MENU_ID = 'morph-composer-ac-menu';
  const INPUT_IDS = ['omni-input', 'ai-chat-input', 'mobile-detail-input'];

  /** @type {HTMLDivElement | null} */
  let menuEl = null;

  /** @type {{ open: boolean, mode: string, input: HTMLTextAreaElement | null, items: any[], selectedIndex: number, replaceStart: number, replaceEnd: number }} */
  let state = {
    open: false,
    mode: '',
    input: null,
    items: [],
    selectedIndex: 0,
    replaceStart: 0,
    replaceEnd: 0,
  };

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  /** @type {WeakMap<HTMLTextAreaElement, { wrap: HTMLDivElement, backdrop: HTMLDivElement, inner: HTMLDivElement, ro: ResizeObserver }>} */
  const composerHighlightByTextarea = new WeakMap();
  /** @type {WeakMap<HTMLTextAreaElement, number>} */
  const mirrorRafByTextarea = new WeakMap();

  /**
   * 首行已输入的、可识别的 `/指令` 在输入框内以胶囊底显示（非下拉列表高亮）。
   * @param {string} value
   * @returns {{ ws: string, cmd: string, firstLineRest: string } | null}
   */
  function parseLeadingSlashToken(value) {
    if (!value) return null;
    const nl = value.indexOf('\n');
    const first = nl === -1 ? value : value.slice(0, nl);
    const m = first.match(/^(\s*)(\/\S+)/);
    if (!m) return null;
    const cmd = m[2];
    const check = window.MorphAIComposerCommandsRuntime?.isRecognizedSlashCommand;
    if (typeof check !== 'function' || !check(cmd)) return null;
    return { ws: m[1], cmd, firstLineRest: first.slice(m[0].length) };
  }

  function isRecognizedSlashCmd(cmdWithSlash) {
    const fn = window.MorphAIComposerCommandsRuntime?.isRecognizedSlashCommand;
    return typeof fn === 'function' && fn(cmdWithSlash);
  }

  /**
   * 单行镜像：首行可带已识别 `/指令` 胶囊；行内 `(^|\s)@token` 胶囊（与 parseAt / 整块删除规则一致）。
   * @param {string} line
   * @param {boolean} isFirstLine
   */
  function mirrorOneLineHtml(line, isFirstLine) {
    let i = 0;
    let out = '';
    if (isFirstLine) {
      const m = line.match(/^(\s*)(\/[\w\u4e00-\u9fa5-]+)/);
      if (m && isRecognizedSlashCmd(m[2])) {
        out += escHtml(m[1]) + `<span class="morph-composer-cmd-pill">${escHtml(m[2])}</span>`;
        i = m[0].length;
      }
    }
    while (i < line.length) {
      const at = line.indexOf('@', i);
      if (at < 0) {
        out += escHtml(line.slice(i));
        break;
      }
      const atBoundary = at === 0 || /\s/.test(line.charAt(at - 1));
      if (!atBoundary) {
        out += escHtml(line.slice(i, at + 1));
        i = at + 1;
        continue;
      }
      out += escHtml(line.slice(i, at));
      const after = line.slice(at + 1);
      const tm = after.match(/^([^\s@]+)/);
      if (!tm) {
        out += '@';
        i = at + 1;
        continue;
      }
      const token = `@${tm[1]}`;
      out += `<span class="morph-composer-cmd-pill">${escHtml(token)}</span>`;
      i = at + token.length;
    }
    return out;
  }

  function buildFullMirrorHtml(value) {
    const lines = String(value || '').split('\n');
    return lines.map((ln, li) => mirrorOneLineHtml(ln, li === 0)).join('<br>');
  }

  function shouldMirrorComposer(value) {
    if (parseLeadingSlashToken(value)) return true;
    const lines = String(value || '').split('\n');
    for (let li = 0; li < lines.length; li += 1) {
      const line = lines[li];
      const re = /(^|[\s])@([^\s@]+)/g;
      let m;
      while ((m = re.exec(line))) {
        return true;
      }
    }
    return false;
  }

  /**
   * 与 mirrorOneLineHtml 相同的原子块，用于 Backspace/Delete 整块删除。
   * @param {string} line
   * @param {boolean} isFirstLine
   * @returns {{ start: number, end: number }[]}
   */
  function findAtomicComposerSpansOnLine(line, isFirstLine) {
    /** @type {{ start: number, end: number }[]} */
    const spans = [];
    if (isFirstLine) {
      const m = line.match(/^(\s*)(\/[\w\u4e00-\u9fa5-]+)/);
      if (m && isRecognizedSlashCmd(m[2])) {
        spans.push({ start: m[1].length, end: m[1].length + m[2].length });
      }
    }
    const re = /(^|[\s])@([^\s@]+)/g;
    let mm;
    while ((mm = re.exec(line))) {
      const start = mm.index + mm[1].length;
      const end = start + 1 + mm[2].length;
      spans.push({ start, end });
    }
    return spans.sort((a, b) => a.start - b.start);
  }

  function lineBoundsAt(value, pos) {
    const lineStart = value.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
    const nextNl = value.indexOf('\n', pos);
    const lineEnd = nextNl === -1 ? value.length : nextNl;
    return { lineStart, lineEnd, line: value.slice(lineStart, lineEnd) };
  }

  function onComposerAtomicDeleteKeydown(e) {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.isComposing) return;
    const t = e.target;
    if (!t || t.tagName !== 'TEXTAREA') return;
    if (!INPUT_IDS.includes(String(t.id))) return;
    if (String(t.dataset.imeComposing || '') === '1') return;

    const value = String(t.value || '');
    let a = t.selectionStart ?? 0;
    let b = t.selectionEnd ?? 0;
    if (a !== b) return;

    const { lineStart, line } = lineBoundsAt(value, a);
    const isFirstLine = lineStart === 0;
    const spans = findAtomicComposerSpansOnLine(line, isFirstLine);
    if (!spans.length) return;

    const offset = a - lineStart;

    if (e.key === 'Backspace') {
      if (offset === 0) return;
      const delCh = offset - 1;
      const span = spans.find((s) => delCh >= s.start && delCh < s.end);
      if (!span) return;
      e.preventDefault();
      e.stopPropagation();
      let delFrom = lineStart + span.start;
      let delTo = lineStart + span.end;
      if (value.charAt(delTo) === ' ') delTo += 1;
      const next = `${value.slice(0, delFrom)}${value.slice(delTo)}`;
      t.value = next;
      try {
        t.setSelectionRange(delFrom, delFrom);
      } catch (_) {}
      t.dispatchEvent(new Event('input', { bubbles: true }));
      scheduleSyncComposerHighlight(t);
      return;
    }

    if (offset >= line.length) return;
    const span = spans.find((s) => offset >= s.start && offset < s.end);
    if (!span) return;
    e.preventDefault();
    e.stopPropagation();
    let delFrom = lineStart + span.start;
    let delTo = lineStart + span.end;
    if (value.charAt(delTo) === ' ') delTo += 1;
    const next = `${value.slice(0, delFrom)}${value.slice(delTo)}`;
    t.value = next;
    try {
      t.setSelectionRange(delFrom, delFrom);
    } catch (_) {}
    t.dispatchEvent(new Event('input', { bubbles: true }));
    scheduleSyncComposerHighlight(t);
  }

  function scheduleSyncComposerHighlight(textarea) {
    if (!textarea) return;
    const prev = mirrorRafByTextarea.get(textarea);
    if (prev) cancelAnimationFrame(prev);
    const id = requestAnimationFrame(() => {
      mirrorRafByTextarea.delete(textarea);
      syncComposerHighlight(textarea);
    });
    mirrorRafByTextarea.set(textarea, id);
  }

  function syncComposerHighlight(textarea) {
    const st = composerHighlightByTextarea.get(textarea);
    if (!st) return;
    const { inner } = st;
    const value = String(textarea.value || '');
    if (!shouldMirrorComposer(value)) {
      inner.innerHTML = '';
      textarea.classList.remove('morph-composer-input-mirroring');
      return;
    }
    textarea.classList.add('morph-composer-input-mirroring');
    inner.innerHTML = buildFullMirrorHtml(value);
    const cs = getComputedStyle(textarea);
    inner.style.fontFamily = cs.fontFamily;
    inner.style.fontSize = cs.fontSize;
    inner.style.lineHeight = cs.lineHeight;
    inner.style.letterSpacing = cs.letterSpacing;
    inner.style.fontWeight = cs.fontWeight;
    inner.style.fontStyle = cs.fontStyle;
    inner.style.fontVariantNumeric = cs.fontVariantNumeric;
    inner.style.padding = cs.padding;
    inner.style.boxSizing = cs.boxSizing;
    inner.style.tabSize = cs.tabSize;
    inner.style.textIndent = cs.textIndent;
    inner.style.wordSpacing = cs.wordSpacing;
    inner.style.direction = cs.direction;
    inner.style.whiteSpace = 'pre-wrap';
    inner.style.overflowWrap = 'break-word';
    inner.style.wordBreak = 'break-word';
    inner.style.color = cs.color;
    inner.style.position = 'absolute';
    inner.style.top = '0';
    inner.style.left = '0';
    inner.style.width = `${textarea.clientWidth}px`;
    inner.style.minHeight = `${textarea.scrollHeight}px`;
    inner.style.transform = `translate3d(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px, 0)`;
  }

  function ensureComposerHighlightLayer(textarea) {
    if (!textarea || textarea.tagName !== 'TEXTAREA') return;
    if (composerHighlightByTextarea.has(textarea)) return;
    const parent = textarea.parentNode;
    if (!parent) return;

    const wrap = document.createElement('div');
    wrap.className = 'morph-composer-highlight-wrap relative w-full min-w-0';
    if (textarea.classList.contains('flex-1')) {
      wrap.classList.add('flex-1');
      textarea.classList.remove('flex-1');
    }
    if (textarea.classList.contains('min-w-[7rem]')) {
      wrap.classList.add('min-w-[7rem]');
      textarea.classList.remove('min-w-[7rem]');
    }
    if (textarea.classList.contains('block')) {
      wrap.classList.add('block');
      textarea.classList.remove('block');
    }
    if (!textarea.classList.contains('w-full')) textarea.classList.add('w-full');

    const backdrop = document.createElement('div');
    backdrop.className =
      'morph-composer-highlight-backdrop pointer-events-none absolute inset-0 z-0 overflow-hidden';
    const inner = document.createElement('div');
    inner.className = 'morph-composer-highlight-inner';
    inner.setAttribute('aria-hidden', 'true');
    backdrop.appendChild(inner);
    wrap.appendChild(backdrop);
    parent.insertBefore(wrap, textarea);
    wrap.appendChild(textarea);
    textarea.classList.add('relative', 'z-[1]', 'bg-transparent');

    const ro = new ResizeObserver(() => scheduleSyncComposerHighlight(textarea));
    ro.observe(textarea);

    composerHighlightByTextarea.set(textarea, { wrap, backdrop, inner, ro });

    textarea.addEventListener('scroll', () => scheduleSyncComposerHighlight(textarea), { passive: true });
    textarea.addEventListener('compositionend', () => scheduleSyncComposerHighlight(textarea));
    const onCaretMove = () => scheduleSyncComposerHighlight(textarea);
    textarea.addEventListener('keyup', onCaretMove);
    textarea.addEventListener('click', onCaretMove);
    textarea.addEventListener('select', onCaretMove);
  }

  window.syncMorphComposerSlashHighlight = scheduleSyncComposerHighlight;

  function ensureMenu() {
    if (menuEl && document.body.contains(menuEl)) return menuEl;
    menuEl = document.createElement('div');
    menuEl.id = MENU_ID;
    menuEl.setAttribute('role', 'listbox');
    menuEl.className =
      'morph-composer-ac-menu morph-composer-ac-menu-shell fixed z-[10050] hidden min-w-[240px] max-w-[min(92vw,320px)] max-h-[min(42vh,280px)] overflow-y-auto bg-white text-[13px] dark:bg-[#1a1918]';
    menuEl.style.display = 'none';
    document.body.appendChild(menuEl);
    menuEl.addEventListener(
      'wheel',
      (e) => {
        if (!state.open) return;
        e.preventDefault();
      },
      { passive: false },
    );
    return menuEl;
  }

  /** @param {string} name lucide icon name */
  function escLucideName(name) {
    const n = String(name || '').trim().toLowerCase();
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(n) ? n : 'circle';
  }

  function refreshLucideInMenu(root) {
    try {
      if (typeof requestLucideRefresh === 'function') requestLucideRefresh({ root });
      else if (typeof window !== 'undefined' && typeof window.requestLucideRefresh === 'function') window.requestLucideRefresh({ root });
    } catch (_) {}
  }

  function resetComposerAcMenuMount() {
    if (!menuEl) return;
    menuEl.classList.remove('morph-composer-ac-menu--anchored');
    if (menuEl.parentNode && menuEl.parentNode !== document.body) {
      document.body.appendChild(menuEl);
    }
  }

  function hideMenu() {
    state.open = false;
    state.mode = '';
    state.items = [];
    state.input = null;
    if (menuEl) {
      resetComposerAcMenuMount();
      menuEl.classList.add('hidden');
      menuEl.style.display = 'none';
      menuEl.innerHTML = '';
    }
  }

  window.closeMorphComposerAutocompleteMenu = function closeMorphComposerAutocompleteMenu() {
    if (!state.open) return false;
    hideMenu();
    return true;
  };

  function scrollComposerAcSelectedIntoView() {
    if (!menuEl || !state.open) return;
    const btn = menuEl.querySelector(`[data-ac-i="${state.selectedIndex}"]`);
    if (!btn) return;
    const itemTop = btn.offsetTop;
    const itemBottom = itemTop + btn.offsetHeight;
    const pad = 8;
    const st = menuEl.scrollTop;
    const vh = menuEl.clientHeight;
    if (itemTop < st + pad) menuEl.scrollTop = Math.max(0, itemTop - pad);
    else if (itemBottom > st + vh - pad) menuEl.scrollTop = Math.max(0, itemBottom - vh + pad);
  }

  /** 移动端键盘 / 视口变化时，layout 首帧 getBoundingClientRect 常不准；用 visualViewport 做下边界 */
  function getComposerAcViewportBottom() {
    const vv = window.visualViewport;
    if (vv && typeof vv.height === 'number') return vv.offsetTop + vv.height;
    return window.innerHeight;
  }

  let composerAcRepositionRaf = 0;
  function scheduleComposerAcMenuReposition(textarea) {
    if (!textarea) return;
    cancelAnimationFrame(composerAcRepositionRaf);
    composerAcRepositionRaf = requestAnimationFrame(() => {
      composerAcRepositionRaf = 0;
      positionMenuNear(textarea);
    });
  }

  function bindComposerAcViewportReposition() {
    if (bindComposerAcViewportReposition.did) return;
    bindComposerAcViewportReposition.did = true;
    const onMove = () => {
      if (!state.open || !state.input || !menuEl) return;
      if (menuEl.classList.contains('morph-composer-ac-menu--anchored')) return;
      scheduleComposerAcMenuReposition(state.input);
    };
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', onMove, { passive: true });
      vv.addEventListener('scroll', onMove, { passive: true });
    }
    window.addEventListener('resize', onMove);
  }
  bindComposerAcViewportReposition.did = false;

  /**
   * 底部栏输入：菜单挂到 shell 内 absolute 锚定，避免 iOS fixed+键盘视口错位。
   * 桌面：fixed + getBoundingClientRect。
   */
  function positionMenuNear(textarea) {
    if (!textarea) return;
    const el = ensureMenu();
    const mobileShell = textarea.closest('#mobile-bottom-nav-input-shell');
    if (mobileShell) {
      resetComposerAcMenuMount();
      mobileShell.appendChild(el);
      el.classList.add('morph-composer-ac-menu--anchored');
      return;
    }

    el.classList.remove('morph-composer-ac-menu--anchored');
    if (el.parentNode !== document.body) document.body.appendChild(el);

    const measureAnchors = () => {
      const ta = textarea.getBoundingClientRect();
      const shell = textarea.closest('.composer-shell');
      const sh = shell?.getBoundingClientRect?.();
      const shellOk = sh && sh.width >= 2 && sh.height >= 2;
      return {
        anchorLeft: shellOk ? sh.left : ta.left,
        anchorBottom: shellOk ? Math.max(ta.bottom, sh.bottom) : ta.bottom,
        anchorTop: shellOk ? Math.min(ta.top, sh.top) : ta.top,
      };
    };

    const apply = () => {
      const { anchorLeft, anchorBottom, anchorTop } = measureAnchors();
      const viewBottom = getComposerAcViewportBottom();
      const viewW = window.innerWidth;
      const left = Math.min(Math.max(8, anchorLeft), viewW - 24);
      el.style.left = `${left}px`;
      el.style.maxWidth = `${Math.min(340, viewW - 16)}px`;
      const h = el.offsetHeight || 200;
      let top = anchorBottom + 6;
      if (top + h > viewBottom - 8) top = anchorTop - h - 6;
      if (!Number.isFinite(top) || top < 8) top = 8;
      if (top + h > viewBottom - 8) top = Math.max(8, viewBottom - h - 8);
      el.style.top = `${top}px`;
    };

    apply();
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
  }

  function renderMenu() {
    const el = ensureMenu();
    el.innerHTML = state.items
      .map((item, i) => {
        const active = i === state.selectedIndex;
        const activeCls = active ? ' morph-composer-ac-item--active' : '';
        if (item.kind === 'slash') {
          const icon = escLucideName(item.icon);
          const title = escHtml(item.title || '');
          const desc = escHtml(item.desc || '');
          return `<button type="button" role="option" aria-selected="${active ? 'true' : 'false'}" data-ac-i="${i}" class="morph-composer-ac-item${activeCls}"><span class="morph-composer-ac-item-icon" aria-hidden="true"><i data-lucide="${icon}" class="h-4 w-4"></i></span><span class="min-w-0 flex-1 text-left leading-tight"><span class="morph-composer-ac-item-title block text-[13px]">${title}</span><span class="morph-composer-ac-item-desc mt-0.5 block text-[11px]">${desc}</span></span></button>`;
        }
        if (item.kind === 'atscope') {
          const icon = escLucideName(item.icon);
          const title = escHtml(item.title || '');
          const desc = escHtml(item.desc || '');
          return `<button type="button" role="option" aria-selected="${active ? 'true' : 'false'}" data-ac-i="${i}" class="morph-composer-ac-item${activeCls}"><span class="morph-composer-ac-item-icon" aria-hidden="true"><i data-lucide="${icon}" class="h-4 w-4"></i></span><span class="min-w-0 flex-1 text-left leading-tight"><span class="morph-composer-ac-item-title block text-[13px]">${title}</span><span class="morph-composer-ac-item-desc mt-0.5 block text-[11px]">${desc}</span></span></button>`;
        }
        if (item.kind === 'atproj') {
          const name = escHtml(item.projName || '');
          const short = escHtml(item.projShort || '');
          return `<button type="button" role="option" aria-selected="${active ? 'true' : 'false'}" data-ac-i="${i}" class="morph-composer-ac-item${activeCls}"><span class="morph-composer-ac-item-icon" aria-hidden="true"><i data-lucide="folder-kanban" class="h-4 w-4"></i></span><span class="min-w-0 flex-1 text-left leading-tight"><span class="morph-composer-ac-item-title block text-[13px] truncate">${name}</span><span class="morph-composer-ac-item-desc mt-0.5 block font-mono text-[10px]">${short}</span></span></button>`;
        }
        return `<button type="button" role="option" aria-selected="${active ? 'true' : 'false'}" data-ac-i="${i}" class="morph-composer-ac-item${activeCls}">${escHtml(item.label || '')}</button>`;
      })
      .join('');
    el.querySelectorAll('.morph-composer-ac-item').forEach((btn) => {
      btn.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const i = Number(btn.getAttribute('data-ac-i'));
        if (Number.isFinite(i)) applyItem(i);
      });
    });
    refreshLucideInMenu(el);
    el.classList.remove('hidden');
    el.style.display = 'block';
    positionMenuNear(state.input);
    requestAnimationFrame(() => {
      positionMenuNear(state.input);
      scrollComposerAcSelectedIntoView();
    });
  }

  function normalizeMatch(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  function scoreProjectToken(query, project) {
    const name = String(project?.name || '').trim();
    const q = normalizeMatch(query);
    const n = normalizeMatch(name);
    if (!q.length) return name ? 10 : 0;
    if (!n.length) return 0;
    let score = 0;
    if (n.includes(q)) score = 80 + (n.startsWith(q) ? 30 : 0);
    else {
      let j = 0;
      for (let i = 0; i < n.length && j < q.length; i += 1) {
        if (n[i] === q[j]) j += 1;
      }
      if (j === q.length) score = 40;
    }
    const id = String(project?.id || '').trim().toLowerCase();
    if (id && id.includes(q)) score = Math.max(score, 35);
    return score;
  }

  function filterProjects(query) {
    const dataRef = typeof data !== 'undefined' ? data : {};
    const projects = Array.isArray(dataRef.projects) ? dataRef.projects.slice() : [];
    const isArchived = (p) => String(p?.status || '').trim() === 'archived' || !!String(p?.archivedAt || '').trim();
    const active = projects.filter((p) => !isArchived(p));
    const pool = active.length ? active : projects;
    const scored = pool.map((p) => ({ p, score: scoreProjectToken(query, p) })).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map(({ p }) => p);
  }

  function filterAtScopeItems(queryRaw) {
    const q = String(queryRaw || '').trim().toLowerCase();
    const all =
      typeof window.MorphAIComposerCommandsRuntime?.getAtScopeMenuItems === 'function'
        ? window.MorphAIComposerCommandsRuntime.getAtScopeMenuItems()
        : [];
    if (!q) return all;
    return all.filter((item) => {
      const insRaw = String(item.insert || '').trim();
      const ins = insRaw.toLowerCase().replace(/\s+$/, '');
      const token = ins.replace(/^@/, '').trim().split(/\s+/)[0] || '';
      const hints = Array.isArray(item.matchHints)
        ? item.matchHints.map((h) => String(h || '').toLowerCase())
        : [];
      const key = String(item.key || '').toLowerCase();
      const title = String(item.titleDisplay || '').toLowerCase();
      if (ins.startsWith(`@${q}`)) return true;
      if (q && token.startsWith(q)) return true;
      if (key.startsWith(q) || key.includes(q)) return true;
      if (title.includes(q)) return true;
      return hints.some((h) => h.startsWith(q) || h.includes(q));
    });
  }

  function filterSlashItems(queryRaw) {
    const q = String(queryRaw || '').trim().toLowerCase();
    const all =
      typeof window.MorphAIComposerCommandsRuntime?.getSlashCommandMenuItems === 'function'
        ? window.MorphAIComposerCommandsRuntime.getSlashCommandMenuItems()
        : [];
    if (!q) return all;
    return all.filter((item) => {
      const insRaw = String(item.insert || '').trim();
      const ins = insRaw.toLowerCase();
      const tail = ins.replace(/^\//, '').replace(/\s+$/, '');
      const hints = Array.isArray(item.matchHints)
        ? item.matchHints.map((h) => String(h || '').toLowerCase())
        : [tail];
      const key = String(item.key || '').toLowerCase();
      if (ins.startsWith(`/${q}`)) return true;
      if (tail.startsWith(q)) return true;
      if (key.startsWith(q) || key.includes(q)) return true;
      return hints.some((h) => h.startsWith(q) || h.includes(q));
    });
  }

  function getLinePrefix(value, selStart) {
    const lineStart = value.lastIndexOf('\n', Math.max(0, selStart - 1)) + 1;
    return { lineStart, linePrefix: value.slice(lineStart, selStart) };
  }

  function isOnFirstLine(value, selStart) {
    return value.slice(0, selStart).indexOf('\n') === -1;
  }

  function detectSlashContext(input) {
    const value = String(input.value || '');
    const selStart = input.selectionStart ?? value.length;
    const selEnd = input.selectionEnd ?? selStart;
    if (selStart !== selEnd) return null;
    if (!isOnFirstLine(value, selStart)) return null;
    const { lineStart, linePrefix } = getLinePrefix(value, selStart);
    const m = linePrefix.match(/^(\s*)(\/[\w\u4e00-\u9fa5-]*)$/);
    if (!m) return null;
    const ws = m[1];
    const slashPart = m[2];
    const query = slashPart.slice(1);
    return {
      replaceStart: lineStart + ws.length,
      replaceEnd: selStart,
      query,
    };
  }

  function detectAtContext(input) {
    const value = String(input.value || '');
    const selStart = input.selectionStart ?? value.length;
    const selEnd = input.selectionEnd ?? selStart;
    if (selStart !== selEnd) return null;
    const { lineStart, linePrefix } = getLinePrefix(value, selStart);
    const atIdx = linePrefix.lastIndexOf('@');
    if (atIdx < 0) return null;
    if (atIdx > 0) {
      const prev = linePrefix.charAt(atIdx - 1);
      if (prev && !/\s/.test(prev)) return null;
    }
    const frag = linePrefix.slice(atIdx + 1);
    if (/\s/.test(frag)) return null;
    return {
      replaceStart: lineStart + atIdx,
      replaceEnd: selStart,
      query: frag,
    };
  }

  function refreshMenu(input) {
    if (input.dataset.imeComposing === '1') {
      hideMenu();
      return;
    }
    const slash = detectSlashContext(input);
    if (slash) {
      const items = filterSlashItems(slash.query).map((row) => ({
        kind: 'slash',
        insert: row.insert,
        icon: row.icon,
        title: row.cmdDisplay,
        desc: row.desc,
      }));
      if (!items.length) {
        hideMenu();
        return;
      }
      state.open = true;
      state.mode = 'slash';
      state.input = input;
      state.items = items;
      state.selectedIndex = 0;
      state.replaceStart = slash.replaceStart;
      state.replaceEnd = slash.replaceEnd;
      renderMenu();
      return;
    }
    const at = detectAtContext(input);
    if (at) {
      const scopeItems = filterAtScopeItems(at.query).map((row) => ({
        kind: 'atscope',
        insert: row.insert,
        icon: row.icon,
        title: row.titleDisplay,
        desc: row.desc,
      }));
      const projects = filterProjects(at.query);
      const projItems = projects.map((p) => {
        const name = String(p.name || '未命名').slice(0, 56);
        const pid = String(p.id || '').trim();
        const short = pid.length > 10 ? `${pid.slice(0, 8)}…` : pid;
        return {
          kind: 'atproj',
          projName: name,
          projShort: short,
          projId: pid,
        };
      });
      const items = scopeItems.concat(projItems);
      if (!items.length) {
        hideMenu();
        return;
      }
      state.open = true;
      state.mode = 'at';
      state.input = input;
      state.items = items;
      state.selectedIndex = 0;
      state.replaceStart = at.replaceStart;
      state.replaceEnd = at.replaceEnd;
      renderMenu();
      return;
    }
    hideMenu();
  }

  function applyItem(index) {
    if (!state.open || !state.input) {
      hideMenu();
      return;
    }
    const item = state.items[index];
    if (!item) return;
    const input = state.input;
    const v = String(input.value || '');
    const a = state.replaceStart;
    const b = state.replaceEnd;
    let insert = '';
    if (item.kind === 'slash') insert = String(item.insert || '');
    else if (item.kind === 'atscope') insert = String(item.insert || '');
    else if (item.kind === 'atproj') {
      const rawName = String(item.projName || '未命名').trim() || '未命名';
      if (/\s/.test(rawName)) insert = `@${rawName.replace(/\s+/g, '')} `;
      else insert = `@proj:${rawName} `;
    }
    const next = `${v.slice(0, a)}${insert}${v.slice(b)}`;
    const pos = a + insert.length;
    input.value = next;
    try {
      input.setSelectionRange(pos, pos);
      input.focus();
    } catch (_) {}
    hideMenu();
    const maxH = input.id === 'omni-input' ? 132 : 120;
    if (typeof requestComposerTextareaResize === 'function') {
      requestComposerTextareaResize(input, maxH, {
        force: true,
        syncMobileQuickComposeButton: input.id === 'mobile-detail-input',
        skipMobileIconRefresh: input.id === 'mobile-detail-input',
      });
    }
    if (input.id === 'omni-input' && typeof syncComposerLayoutState === 'function') syncComposerLayoutState('omni');
    if (input.id === 'ai-chat-input' && typeof syncComposerLayoutState === 'function') syncComposerLayoutState('ai-chat');
    if (typeof markUserEditingActivity === 'function') markUserEditingActivity();
    scheduleSyncComposerHighlight(input);
    requestAnimationFrame(() => scheduleSyncComposerHighlight(input));
  }

  function moveSelection(delta) {
    if (!state.open || !state.items.length) return;
    const n = state.items.length;
    state.selectedIndex = (state.selectedIndex + delta + n) % n;
    renderMenu();
  }

  function onKeydownCapture(e) {
    const t = e.target;
    if (!t || t.tagName !== 'TEXTAREA') return;
    if (!INPUT_IDS.includes(String(t.id))) return;
    if (!state.open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      hideMenu();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-1);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      if (typeof shouldTreatEnterAsCompositionConfirm === 'function' && shouldTreatEnterAsCompositionConfirm(e)) return;
      e.preventDefault();
      e.stopPropagation();
      applyItem(state.selectedIndex);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      applyItem(state.selectedIndex);
    }
  }

  function onInput(e) {
    const t = e.target;
    if (!t || t.tagName !== 'TEXTAREA') return;
    if (!INPUT_IDS.includes(String(t.id))) return;
    state.selectedIndex = 0;
    requestAnimationFrame(() => {
      refreshMenu(t);
      scheduleSyncComposerHighlight(t);
    });
  }

  function onFocus(e) {
    const t = e.target;
    if (!t || t.tagName !== 'TEXTAREA') return;
    if (!INPUT_IDS.includes(String(t.id))) return;
    state.selectedIndex = 0;
    requestAnimationFrame(() => {
      refreshMenu(t);
      scheduleSyncComposerHighlight(t);
    });
  }

  function onBlur() {
    setTimeout(() => {
      if (!state.open) return;
      const ae = document.activeElement;
      if (ae && ae.closest && ae.closest(`#${MENU_ID}`)) return;
      hideMenu();
    }, 180);
  }

  function onDocClick(e) {
    const target = e.target;
    if (!state.open) return;
    if (target?.closest?.(`#${MENU_ID}`)) return;
    if (INPUT_IDS.some((id) => target?.closest?.(`#${id}`))) return;
    hideMenu();
  }

  function install() {
    if (install.did) return;
    install.did = true;
    bindComposerAcViewportReposition();
    document.addEventListener('keydown', onComposerAtomicDeleteKeydown, true);
    document.addEventListener('keydown', onKeydownCapture, true);
    document.addEventListener('click', onDocClick, true);
    INPUT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      ensureComposerHighlightLayer(el);
      scheduleSyncComposerHighlight(el);
      el.addEventListener('input', onInput);
      el.addEventListener('focus', onFocus);
      el.addEventListener('blur', onBlur);
    });
  }
  install.did = false;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => install());
  } else {
    install();
  }
})();
