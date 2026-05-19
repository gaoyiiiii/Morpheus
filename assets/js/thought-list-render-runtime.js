// @ts-check

(function initMorphThoughtListRenderRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphThoughtListRenderRuntime && typeof window.MorphThoughtListRenderRuntime.create === 'function';
  const hasDepsRuntime = window.MorphThoughtListRenderDepsRuntime && typeof window.MorphThoughtListRenderDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createThoughtListRenderRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getDataRoot() {
      if (typeof api.getDataRoot === 'function') {
        const dataRoot = api.getDataRoot();
        if (dataRoot && typeof dataRoot === 'object') return dataRoot;
      }
      return null;
    }

    function escapeHTML(text = '') {
      if (typeof api.escapeHTML === 'function') return api.escapeHTML(text);
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatThoughtCardTimestamp(item) {
      if (typeof api.formatThoughtCardTimestamp === 'function') return api.formatThoughtCardTimestamp(item);
      return String(item?.time || '').trim();
    }

    function renderArchivedFixedThoughtCard(item) {
      if (typeof api.getThoughtCardPreviewModel !== 'function') return '';
      const preview = api.getThoughtCardPreviewModel(item);
      return `<div class="flash-thought-card glass-card rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] hover:border-gray-300 dark:hover:border-white/20 transition-colors flex flex-col gap-2 p-4 cursor-pointer" onmouseenter="const a=this.querySelector('[data-fixed-card-actions]'); if(a) a.style.opacity='1';" onmouseleave="const a=this.querySelector('[data-fixed-card-actions]'); if(a) a.style.opacity='0';" onclick="openDetailModal(data.completedFixedThoughts.find(i=>i.id==='${item.id}'), { kind: 'completedFixedThoughts' })">
        <div class="${preview.rich ? 'thought-card-preview-rich thought-card-preview-body archived' : 'thought-card-preview-body thought-card-preview-text archived'}">${preview.html}</div>
        <div class="flex items-center justify-between shrink-0 border-t border-gray-100 dark:border-white/5 pt-2 mt-1">
            <span class="text-[10px] font-mono text-gray-400 dark:text-white/40">${item.time || ''}</span>
            <div data-fixed-card-actions class="flex items-center gap-1 opacity-0 transition-opacity">
                <button onclick="event.stopPropagation(); restoreCompletedFixedThought('${item.id}')" class="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors" title="恢复"><i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i></button>
                <button onclick="event.stopPropagation(); confirmDelete('completedFixedThoughts', '${item.id}')" class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="删除"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>
    </div>`;
    }

    function buildArchivedThoughtEntries() {
      const data = getDataRoot();
      if (!data) return [];
      const archivedFlash = (Array.isArray(data.completedFlashThoughts) ? data.completedFlashThoughts : []).map((item) => ({
        item,
        kind: 'completedFlashThoughts',
        ts: Date.parse(String(item?.completedAt || item?.createdAt || '').trim()) || 0,
      }));
      const archivedFixed = (Array.isArray(data.completedFixedThoughts) ? data.completedFixedThoughts : []).map((item) => ({
        item,
        kind: 'completedFixedThoughts',
        ts: Date.parse(String(item?.completedAt || item?.createdAt || '').trim()) || 0,
      }));
      return [...archivedFlash, ...archivedFixed].sort((a, b) => b.ts - a.ts);
    }

    function renderArchivedThoughtCard(entry) {
      if (!entry || typeof entry !== 'object') return '';
      if (entry.kind === 'completedFixedThoughts') return renderArchivedFixedThoughtCard(entry.item);
      if (typeof api.renderArchivedFlashThoughtCard === 'function') return api.renderArchivedFlashThoughtCard(entry.item);
      return '';
    }

    function renderOrbitFragment(item, parentId, contextType) {
      const previewHtml = typeof api.getFragmentPreviewMarkup === 'function' ? api.getFragmentPreviewMarkup(item) : '';
      return `<div class="group glass-card p-3 rounded-xl flex flex-col gap-2 relative draggable" draggable="true" data-orbit-fragment data-item-id="${escapeHTML(item.id)}" data-parent-id="${escapeHTML(parentId)}" data-context-type="${escapeHTML(contextType)}" ondragstart="dragStart(event, '${item.id}', '${contextType}Orbit', '${parentId}')" ondragend="dragEnd(event)" oncontextmenu="handleOrbitFragmentRightClick(event, '${item.id}', '${parentId}', '${contextType}')" onclick="openDetailModal(data.${contextType}s.find(p=>p.id==='${parentId}').items.find(i=>i.id==='${item.id}'), { kind: 'context-fragment', parentId: '${parentId}', contextType: '${contextType}' })"><div class="text-[10px] text-gray-700 dark:text-gray-300 leading-relaxed font-light whitespace-pre-wrap break-words">${previewHtml || '<span class="text-gray-400 dark:text-gray-500">[空内容]</span>'}</div><div class="shrink-0 flex items-center justify-between border-t border-gray-200 dark:border-white/5 pt-2 mt-1"><span class="text-[8px] font-mono text-gray-500 dark:text-gray-600">${item.time}</span><div class="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity"><button onclick="event.stopPropagation(); returnOrbitFragmentToFlash('${item.id}', '${parentId}', '${contextType}')" class="text-gray-500 hover:text-black dark:hover:text-white" title="退回"><i data-lucide="corner-up-left" class="w-3 h-3"></i></button><button onclick="event.stopPropagation(); confirmDelete('${contextType}Orbit', '${item.id}', '${parentId}')" class="text-gray-500 hover:text-black dark:hover:text-white" title="删除"><i data-lucide="trash-2" class="w-3 h-3"></i></button><button onclick="event.stopPropagation(); injectFragment('${item.id}', '${contextType}')" class="flex items-center gap-1 text-[9px] font-mono text-gray-600 dark:text-white/70 hover:text-black hover:bg-black/10 dark:hover:text-black dark:bg-white/10 dark:hover:bg-white px-1.5 py-0.5 rounded transition-all"><i data-lucide="arrow-left-to-line" class="w-2.5 h-2.5"></i> 写入</button></div></div></div>`;
    }

    function renderOrbitFragmentGroup(clusterId, items, parentId, contextType) {
      return `<div class="context-orbit-cluster-group rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] p-2.5 flex flex-col gap-2">
        <div class="text-[8px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/40 px-1 py-1 rounded-md flex items-center gap-1.5 cursor-grab active:cursor-grabbing hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors" draggable="true" ondragstart="dragStartContextCluster(event, '${contextType}', '${parentId}', '${clusterId}')" ondragend="dragEnd(event)" title="拖拽整组回闪念中转站">
            <i data-lucide="grip-vertical" class="w-3 h-3"></i><i data-lucide="share-2" class="w-3 h-3"></i><span>内容集合</span><span class="opacity-70">(${items.length})</span>
        </div>
        <div class="flex flex-col gap-2">${items.map(item => renderOrbitFragment(item, parentId, contextType)).join('')}</div>
    </div>`;
    }

    function renderOrbitListContent(items, parentId, contextType) {
      if (!items || items.length === 0) return '<div class="text-center mt-6 text-gray-500 dark:text-gray-700 font-mono text-[9px] p-3 border border-dashed border-gray-300 dark:border-white/5 rounded-lg">拖拽或输入以添加。</div>';
      return items.map(item => renderOrbitFragment(item, parentId, contextType)).join('');
    }

    function renderDrawerCard(item) {
      const groupName = typeof api.getFlashThoughtProjectGroupName === 'function' ? String(api.getFlashThoughtProjectGroupName(item) || '').trim() : '';
      const scopeMode = typeof api.getDrawerProjectScopeMode === 'function' ? String(api.getDrawerProjectScopeMode() || '').trim() : 'all-projects';
      const groupBadge = scopeMode === 'all-projects' && groupName ? `<span class="inline-flex items-center max-w-full text-[8px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500 dark:text-white/50 truncate">项目 · ${escapeHTML(groupName)}</span>` : '';
      const previewHtml = typeof api.getCompactFragmentPreviewMarkup === 'function' ? (api.getCompactFragmentPreviewMarkup(item) || '') : '';
      const hasRichPreview = /<(?:div|img)\b/i.test(previewHtml);
      const displayTime = escapeHTML(formatThoughtCardTimestamp(item));
      return `<div class="drawer-thought-card group glass-card p-4 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] draggable cursor-pointer min-w-0 max-w-full overflow-hidden" draggable="true" data-drawer-thought-id="${escapeHTML(item.id)}" ondragstart="dragStart(event, '${item.id}', 'flashThoughts')" ondragend="dragEnd(event)" onclick="openDetailModal(data.flashThoughts.find(i=>i.id==='${item.id}'), { kind: 'flashThoughts' })"><div class="drawer-flash-thought-card-inner"><span class="drawer-flash-thought-card-grip text-gray-400 dark:text-gray-700 group-hover:text-black dark:group-hover:text-white transition-colors pointer-events-none" aria-hidden="true"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></span>${hasRichPreview ? `<div class="pointer-events-none drawer-flash-thought-card-body thought-card-preview-rich thought-card-preview-body">${previewHtml}<div class="mt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100 dark:border-white/5 pt-2">${groupBadge || ''}<span class="text-[10px] font-mono text-gray-500 dark:text-white/45">${displayTime}</span></div></div>` : `<div class="drawer-flash-thought-card-body"><div class="thought-card-preview-body thought-card-preview-text line-clamp-2 pointer-events-none">${previewHtml}</div><div class="mt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100 dark:border-white/5 pt-2">${groupBadge || ''}<span class="text-[10px] font-mono text-gray-500 dark:text-white/45">${displayTime}</span></div></div>`}</div></div>`;
    }

    function renderDrawerClusterGroup(clusterId, items) {
      const cards = items.map(item => renderDrawerCard(item)).join('');
      return `<div class="drawer-cluster-group rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] p-2.5 flex flex-col gap-2">
        <div class="text-[8px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/40 px-1 py-1 rounded-md flex items-center gap-1.5 cursor-grab active:cursor-grabbing hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors" draggable="true" ondragstart="dragStartFleetingCluster(event, '${clusterId}')" ondragend="dragEnd(event)" title="拖拽整组">
            <i data-lucide="grip-vertical" class="w-3 h-3"></i><i data-lucide="share-2" class="w-3 h-3"></i><span>内容集合</span><span class="opacity-70">(${items.length})</span>
        </div>
        <div class="flex flex-col gap-2">${cards}</div>
    </div>`;
    }

    return {
      renderArchivedFixedThoughtCard,
      buildArchivedThoughtEntries,
      renderArchivedThoughtCard,
      renderOrbitFragment,
      renderOrbitFragmentGroup,
      renderOrbitListContent,
      renderDrawerCard,
      renderDrawerClusterGroup,
    };
  }

  window.MorphThoughtListRenderRuntime = {
    create: createThoughtListRenderRuntime,
  };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createThoughtListRenderDepsRuntime(root) {
    const currentRoot = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || currentRoot;
    const getGlobalFunction = (name = '') => {
      const key = String(name || '').trim();
      if (!key) return null;
      const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
      if (typeof fromGlobal === 'function') return fromGlobal;
      const fromRoot = currentRoot && typeof currentRoot[key] === 'function' ? currentRoot[key] : null;
      return typeof fromRoot === 'function' ? fromRoot : null;
    };
    const getGlobalValue = (name = '', fallback = null) => {
      const key = String(name || '').trim();
      if (!key) return fallback;
      if (globalRoot && typeof globalRoot[key] !== 'undefined') return globalRoot[key];
      if (currentRoot && typeof currentRoot[key] !== 'undefined') return currentRoot[key];
      return fallback;
    };

    function buildAppDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        getDataRoot: pickFunction(context.getDataRoot, () => {
          const value = getGlobalValue('data', null);
          return value && typeof value === 'object' ? value : null;
        }),
        getThoughtCardPreviewModel: pickFunction(context.getThoughtCardPreviewModel, getGlobalFunction('getThoughtCardPreviewModel') || null),
        renderArchivedFlashThoughtCard: pickFunction(context.renderArchivedFlashThoughtCard, getGlobalFunction('renderArchivedFlashThoughtCard') || (() => '')),
        getFragmentPreviewMarkup: pickFunction(context.getFragmentPreviewMarkup, getGlobalFunction('getFragmentPreviewMarkup') || (() => '')),
        escapeHTML: pickFunction(context.escapeHTML, getGlobalFunction('escapeHTML') || ((text = '') => String(text || ''))),
        getCompactFragmentPreviewMarkup: pickFunction(context.getCompactFragmentPreviewMarkup, getGlobalFunction('getCompactFragmentPreviewMarkup') || (() => '')),
        formatThoughtCardTimestamp: pickFunction(context.formatThoughtCardTimestamp, getGlobalFunction('formatThoughtCardTimestamp') || ((item = null) => String(item?.time || '').trim())),
        getFlashThoughtProjectGroupName: pickFunction(context.getFlashThoughtProjectGroupName, getGlobalFunction('getFlashThoughtProjectGroupName') || (() => '')),
        getDrawerProjectScopeMode: pickFunction(context.getDrawerProjectScopeMode, getGlobalFunction('getDrawerProjectScopeMode') || (() => 'all-projects')),
      };
    }

    return { buildAppDeps };
  }

  window.MorphThoughtListRenderDepsRuntime = { create: () => createThoughtListRenderDepsRuntime(window) };
})();
