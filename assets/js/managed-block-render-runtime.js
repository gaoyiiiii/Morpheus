// @ts-check

(function initMorphManagedBlockRenderRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphManagedBlockRenderRuntime && typeof window.MorphManagedBlockRenderRuntime.create === 'function') return;

  function createManagedBlockRenderRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getDocumentRef() {
      return typeof api.getDocumentRef === 'function'
        ? api.getDocumentRef()
        : (typeof document !== 'undefined' ? document : null);
    }

    function buildStandardBlockRowHtml(contextType = '', contextId = '', block = {}, numberingState = {}) {
      const textClass = contextType === 'daily' || contextType === 'project'
        ? 'dialogue-editor-body-text'
        : 'reading-body-text';
      let prefixHtml = '';
      let contentClass = textClass;
      let rowSpacingClass = 'py-0.5';
      let rowTypeClass = 'block-row-paragraph';
      let dragHandleStyle = 'margin-top:6px;';
      let placeholder = '';
      const indentLevel = typeof api.isIndentableBlockType === 'function' && api.isIndentableBlockType(block.type)
        ? ((typeof api.getListIndentLevel === 'function' ? api.getListIndentLevel(block) : 0) || 0)
        : 0;
      const indentOffset = indentLevel * 20;
      const indentStyle = indentOffset > 0 ? ` style="margin-left:${indentOffset}px"` : '';

      if (block.type === 'todo') {
        const todoPrefixStyle = indentOffset > 0 ? `margin-left:${indentOffset}px;` : '';
        prefixHtml = `<span class="todo-prefix shrink-0 flex items-start" style="${todoPrefixStyle}"><button type="button" class="todo-checkbox shrink-0 mr-2" style="width:14px;height:14px;min-width:14px;min-height:14px;max-width:14px;max-height:14px;flex:0 0 14px;padding:0;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;line-height:1;vertical-align:top;aspect-ratio:1 / 1;overflow:hidden;-webkit-appearance:none;appearance:none;margin-top:6px;" data-checked="${block.checked ? 'true' : 'false'}" aria-pressed="${block.checked ? 'true' : 'false'}" aria-label="${block.checked ? '取消完成待办' : '完成待办'}" onclick="toggleTodo('${contextType}', '${contextId}', '${block.id}', ${!block.checked})"><span class="todo-checkbox-mark" aria-hidden="true"></span></button></span>`;
        if (block.checked) contentClass += ' todo-completed-text';
        placeholder = '待办事项...';
        rowTypeClass = 'block-row-todo';
        dragHandleStyle = 'margin-top:6px;';
        Object.keys(numberingState).forEach((key) => delete numberingState[key]);
      } else if (block.type === 'h1') {
        contentClass = 'text-2xl leading-tight font-semibold text-black dark:text-white tracking-tight';
        rowSpacingClass = 'pt-6 pb-2';
        rowTypeClass = 'block-row-heading block-row-heading-1';
        dragHandleStyle = 'margin-top:8px;';
        Object.keys(numberingState).forEach((key) => delete numberingState[key]);
      } else if (block.type === 'h2') {
        contentClass = 'text-xl leading-tight font-semibold text-black dark:text-white tracking-tight';
        rowSpacingClass = 'pt-5 pb-1';
        rowTypeClass = 'block-row-heading block-row-heading-2';
        dragHandleStyle = 'margin-top:7px;';
        Object.keys(numberingState).forEach((key) => delete numberingState[key]);
      } else if (block.type === 'h3') {
        contentClass = 'text-lg leading-snug font-medium text-black dark:text-white tracking-wide';
        rowSpacingClass = 'pt-5 pb-1';
        rowTypeClass = 'block-row-heading block-row-heading-3';
        dragHandleStyle = 'margin-top:7px;';
        Object.keys(numberingState).forEach((key) => delete numberingState[key]);
      } else if (block.type === 'bullet') {
        prefixHtml = `<span class="shrink-0 w-6 mr-1 mt-[1px] text-center text-[16px] leading-6 text-gray-700 dark:text-gray-300 select-none"${indentStyle}>•</span>`;
        contentClass += ' py-[1px]';
        rowTypeClass = 'block-row-bullet';
        dragHandleStyle = 'margin-top:6px;';
        Object.keys(numberingState).forEach((key) => delete numberingState[key]);
      } else if (block.type === 'number') {
        const currentIndent = typeof api.getListIndentLevel === 'function' ? api.getListIndentLevel(block) : 0;
        Object.keys(numberingState).forEach((key) => {
          if (Number(key) > currentIndent) delete numberingState[key];
        });
        numberingState[currentIndent] = (numberingState[currentIndent] || 0) + 1;
        prefixHtml = `<span class="shrink-0 w-8 mr-1 mt-[1px] text-right text-[12px] leading-6 font-medium text-gray-600 dark:text-gray-400 select-none"${indentStyle}>${numberingState[currentIndent]}.</span>`;
        contentClass += ' py-[1px]';
        rowTypeClass = 'block-row-number';
        dragHandleStyle = 'margin-top:6px;';
      } else if (block.type === 'quote') {
        contentClass = 'reading-body-text reading-body-text-muted border-l-4 border-gray-300 dark:border-white/20 pl-3 py-1';
        rowSpacingClass = 'py-1';
        rowTypeClass = 'block-row-quote';
        placeholder = '引用...';
        dragHandleStyle = 'margin-top:6px;';
        Object.keys(numberingState).forEach((key) => delete numberingState[key]);
      } else if (block.type === 'divider') {
        contentClass = 'min-h-[2px] py-2';
        rowSpacingClass = 'py-0';
        rowTypeClass = 'block-row-divider';
        dragHandleStyle = 'margin-top:8px;';
        Object.keys(numberingState).forEach((key) => delete numberingState[key]);
      } else {
        dragHandleStyle = 'margin-top:6px;';
        Object.keys(numberingState).forEach((key) => delete numberingState[key]);
      }

      const innerHtml = block.type === 'divider'
        ? '<div class="w-full h-[1px] bg-gray-200 dark:bg-white/10 my-1" contenteditable="false"></div>'
        : (typeof api.getBlockEditorInnerHTML === 'function' ? api.getBlockEditorInnerHTML(block) : String(block.content || ''));
      const richClass = typeof api.editorContentHasStructuredRichHTML === 'function' && api.editorContentHasStructuredRichHTML(innerHtml)
        ? ' block-content-rich'
        : '';
      return `<div class="block-row ${rowTypeClass} group flex items-start min-w-0 ${rowSpacingClass} -mx-2 px-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors relative" data-context="${contextType}" data-context-id="${contextId}" data-block-id="${block.id}" onpointerdown="handleManagedBlockRowPointer(event, '${contextType}', '${contextId}', '${block.id}')" ondragover="blockDragOver(event)" ondragleave="blockDragLeave(event)" ondrop="blockDrop(event, '${contextType}', '${contextId}', '${block.id}')"><div class="drag-handle opacity-0 group-hover:opacity-100 cursor-grab mr-2 text-gray-400 dark:text-gray-600 hover:text-black dark:hover:text-white shrink-0" style="${dragHandleStyle}" draggable="true" title="拖拽或点击操作" onmousedown="handleBlockDragHandleMouseDown(event, '${contextType}', '${contextId}', '${block.id}')" ondragstart="blockDragStart(event, '${contextType}', '${contextId}', '${block.id}')" ondragend="blockDragEnd(event)" onclick="openSingleBlockHandleMenu(event, '${contextType}', '${contextId}', '${block.id}')"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></div>${prefixHtml}<div class="block-content min-w-0 max-w-full flex-1 outline-none empty:before:content-[attr(placeholder)] ${contentClass}${richClass}" contenteditable="true" data-id="${block.id}" placeholder="${placeholder}" oninput="handleBlockInput(event, '${contextType}', '${contextId}', '${block.id}')" onkeydown="handleBlockKeydown(event, '${contextType}', '${contextId}', '${block.id}')" onblur="handleManagedEditorBlur(event, '${contextType}', '${contextId}')">${innerHtml}</div></div>`;
    }

    function finalizeManagedEditorRender(container = null, previousView = null, contextType = '', contextId = '', shouldRestoreView = true) {
      if (typeof api.applyBlockBatchSelectionStyles === 'function') api.applyBlockBatchSelectionStyles();
      if (typeof api.hydrateManagedEditorStructuredNodes === 'function') api.hydrateManagedEditorStructuredNodes(container);
      if (typeof api.hydrateRichLinkNodes === 'function') api.hydrateRichLinkNodes(container);
      if (typeof api.hydrateEditorImageItems === 'function') api.hydrateEditorImageItems(container);
      if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh();
      if (shouldRestoreView && previousView && typeof api.restoreManagedBlockEditorRenderState === 'function') {
        api.restoreManagedBlockEditorRenderState(container, previousView, contextType, contextId);
      }
    }

    function renderStandardBlockEditor(contextType = '', contextId = '', containerId = '', options = {}) {
      const doc = getDocumentRef();
      const container = doc?.getElementById?.(containerId);
      if (!container) return;
      const preserveView = options?.preserveView !== false;
      let previousView = null;
      if (preserveView
        && (containerId === 'daily-block-editor' || containerId === 'project-block-editor')
        && typeof api.captureManagedBlockEditorRenderState === 'function') {
        previousView = api.captureManagedBlockEditorRenderState(container, contextType, contextId);
      }
      const prepared = typeof api.prepareStandardBlockEditorState === 'function'
        ? api.prepareStandardBlockEditorState(contextType, contextId)
        : null;
      const renderableBlocks = Array.isArray(prepared?.renderableBlocks)
        ? prepared.renderableBlocks
        : (Array.isArray(prepared?.blocks) ? prepared.blocks : []);
      const numberingState = {};
      container.innerHTML = renderableBlocks.map((block) => buildStandardBlockRowHtml(contextType, contextId, block, numberingState)).join('');
      finalizeManagedEditorRender(container, previousView, contextType, contextId, preserveView);
    }

    function renderRoutineEditor(contextId = '', containerId = '') {
      const doc = getDocumentRef();
      const container = doc?.getElementById?.(containerId);
      const prepared = typeof api.prepareRoutineEditorState === 'function'
        ? api.prepareRoutineEditorState(contextId)
        : null;
      const blocks = Array.isArray(prepared?.blocks) ? prepared.blocks : [];
      const html = blocks.map((block) => {
        const textClasses = block.checked
          ? 'text-gray-400 dark:text-gray-500 transition-all duration-500'
          : 'text-gray-800 dark:text-gray-200 font-medium transition-all duration-500';
        const bgClass = block.checked
          ? 'bg-transparent border border-dashed border-gray-200 dark:border-white/10 opacity-60'
          : 'bg-white dark:bg-white/5 shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.03)] border border-gray-100 dark:border-white/5';
        const btnClass = block.checked
          ? 'bg-green-50 border-green-200 text-green-500 dark:bg-green-500/20 dark:border-green-500/30 dark:text-green-400'
          : 'bg-gray-50 dark:bg-[#111] text-gray-300 dark:text-gray-600 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10';
        const innerContent = typeof api.getBlockEditorInnerHTML === 'function' ? api.getBlockEditorInnerHTML(block) : String(block.content || '');
        const richClass = typeof api.editorContentHasStructuredRichHTML === 'function' && api.editorContentHasStructuredRichHTML(innerContent)
          ? ' block-content-rich'
          : '';
        return `<div class="block-row group flex items-center gap-4 py-2 relative" data-context="routine" data-context-id="${contextId}" data-block-id="${block.id}" ondragover="blockDragOver(event)" ondragleave="blockDragLeave(event)" ondrop="blockDrop(event, 'routine', '${contextId}', '${block.id}')"><div class="drag-handle opacity-0 group-hover:opacity-100 cursor-grab text-gray-400 hover:text-black dark:hover:text-white shrink-0 absolute -left-6" draggable="true" title="拖拽或点击操作" onmousedown="handleBlockDragHandleMouseDown(event, 'routine', '${contextId}', '${block.id}')" ondragstart="blockDragStart(event, 'routine', '${contextId}', '${block.id}')" ondragend="blockDragEnd(event)" onclick="openSingleBlockHandleMenu(event, 'routine', '${contextId}', '${block.id}')"><i data-lucide="grip-vertical" class="w-4 h-4"></i></div><button onclick="toggleTodo('routine', '${contextId}', '${block.id}', ${!block.checked})" class="w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-all duration-500 ${btnClass}"><i data-lucide="${block.checked ? 'check' : 'circle'}" class="w-4 h-4"></i></button><div class="flex-1 ${bgClass} rounded-2xl p-5 transition-all duration-500"><div class="rhythm-node-input outline-none text-[15px] tracking-wide ${textClasses}${richClass}" contenteditable="true" data-id="${block.id}" placeholder="" oninput="handleBlockInput(event, 'routine', '${contextId}', '${block.id}')" onkeydown="handleSpecialKeydown(event, 'routine', '${contextId}', '${block.id}')" onblur="handleManagedEditorBlur(event, 'routine', '${contextId}')">${innerContent}</div></div></div>`;
      }).join('');
      if (container) container.innerHTML = html;
      finalizeManagedEditorRender(container, null, 'routine', contextId);
    }

    return {
      renderStandardBlockEditor,
      renderRoutineEditor,
    };
  }

  window.MorphManagedBlockRenderRuntime = {
    create: createManagedBlockRenderRuntime,
  };
})();
