// @ts-check

(function initMorphManagedBlockPrepareRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphManagedBlockPrepareRuntime && typeof window.MorphManagedBlockPrepareRuntime.create === 'function') return;

  function createManagedBlockPrepareRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getDataRoot() {
      const value = typeof api.getDataRoot === 'function' ? api.getDataRoot() : null;
      return value && typeof value === 'object' ? value : null;
    }

    function createBlockId() {
      return typeof api.genId === 'function'
        ? api.genId()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function initDailyMonth(monthStr = '') {
      const dataRoot = getDataRoot();
      if (!dataRoot || !dataRoot.dailyMonths || typeof dataRoot.dailyMonths !== 'object') return;
      const todayStr = typeof api.getTodayStr === 'function' ? api.getTodayStr() : '';
      if (!dataRoot.dailyMonths[monthStr]) dataRoot.dailyMonths[monthStr] = [];
      const blocks = dataRoot.dailyMonths[monthStr];
      if (monthStr !== (typeof api.getMonthStr === 'function' ? api.getMonthStr() : monthStr)) return;
      let changed = false;
      const hasToday = blocks.some((block) => block.type === 'h3'
        && (typeof api.extractDailyDateFromHeaderContent === 'function'
          ? api.extractDailyDateFromHeaderContent(block.content)
          : '') === todayStr);
      if (!hasToday) {
        blocks.push({ id: createBlockId(), type: 'h3', content: `[ 日志 ] ${todayStr}`, checked: false });
        blocks.push({ id: createBlockId(), type: 'p', content: '', checked: false });
        changed = true;
      }
      if (changed && typeof api.saveSilent === 'function') {
        api.saveSilent({ skipUndo: true, forceDebounce: true, domains: ['daily'] });
      }
    }

    function prepareStandardBlockEditorState(contextType = '', contextId = '') {
      const blocks = typeof api.getBlocksContext === 'function' ? api.getBlocksContext(contextType, contextId) : [];
      let seededEmptyBlock = false;
      let normalizedTables = false;
      if (blocks.length === 0) {
        blocks.push({ id: createBlockId(), type: 'p', content: '', checked: false });
        seededEmptyBlock = true;
        if (typeof api.persistManagedEditorState === 'function') {
          api.persistManagedEditorState(contextType, contextId, { skipUndo: true, forceDebounce: true, skipRender: true });
        }
      }
      if (typeof api.normalizeMarkdownTablesInBlocks === 'function' && api.normalizeMarkdownTablesInBlocks(blocks)) {
        normalizedTables = true;
        if (typeof api.persistManagedEditorState === 'function') {
          api.persistManagedEditorState(contextType, contextId, { skipUndo: true, forceDebounce: true, skipRender: true });
        }
      }
      const renderableBlocks = typeof api.getRenderableBlocksContext === 'function'
        ? api.getRenderableBlocksContext(contextType, contextId)
        : blocks;
      return {
        blocks,
        renderableBlocks,
        changed: seededEmptyBlock || normalizedTables,
        repairMeta: {
          seededEmptyBlock,
          normalizedTables,
        },
      };
    }

    function prepareRoutineEditorState(contextId = '') {
      const blocks = typeof api.getBlocksContext === 'function' ? api.getBlocksContext('routine', contextId) : [];
      let seededEmptyBlock = false;
      let normalizedTables = false;
      if (blocks.length === 0) {
        blocks.push({ id: createBlockId(), type: 'p', content: '', checked: false });
        seededEmptyBlock = true;
        if (typeof api.saveSilent === 'function') api.saveSilent({ skipUndo: true, forceDebounce: true, domains: ['routines'] });
      }
      if (typeof api.normalizeMarkdownTablesInBlocks === 'function' && api.normalizeMarkdownTablesInBlocks(blocks)) {
        normalizedTables = true;
        if (typeof api.saveSilent === 'function') api.saveSilent({ skipUndo: true, forceDebounce: true, domains: ['routines'] });
      }
      return {
        blocks,
        renderableBlocks: blocks,
        changed: seededEmptyBlock || normalizedTables,
        repairMeta: {
          seededEmptyBlock,
          normalizedTables,
        },
      };
    }

    return {
      initDailyMonth,
      prepareStandardBlockEditorState,
      prepareRoutineEditorState,
    };
  }

  window.MorphManagedBlockPrepareRuntime = {
    create: createManagedBlockPrepareRuntime,
  };
})();
