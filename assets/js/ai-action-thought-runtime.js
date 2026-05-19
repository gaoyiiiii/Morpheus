// @ts-check

(function initMorphAIActionThoughtRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionThoughtRuntime && typeof window.MorphAIActionThoughtRuntime.create === 'function') return;

  function createAIActionThoughtRuntime() {
    function applyThoughtAction(actionType = '', action = {}, options = {}) {
      const type = String(actionType || '').trim();
      const safeAction = action && typeof action === 'object' ? action : {};
      const dataRef = options.dataRef && typeof options.dataRef === 'object' ? options.dataRef : null;
      const genId = typeof options.genId === 'function' ? options.genId : () => `id-${Date.now().toString(36)}`;
      const findFixedThoughtByRef = typeof options.findFixedThoughtByRef === 'function' ? options.findFixedThoughtByRef : () => null;
      const deleteFixedThoughtKeepingProjectCoverage = typeof options.deleteFixedThoughtKeepingProjectCoverage === 'function'
        ? options.deleteFixedThoughtKeepingProjectCoverage
        : () => ({ removed: null });
      const applyAIFlashThoughtGrouping = typeof options.applyAIFlashThoughtGrouping === 'function'
        ? options.applyAIFlashThoughtGrouping
        : () => ({ changed: false, groupedCount: 0 });
      if (!dataRef) return { handled: false, changed: false };

      if (type === 'add_flash_thought') {
        const text = String(safeAction.text || '').trim();
        if (!text) return { handled: true, changed: false };
        if (!Array.isArray(dataRef.flashThoughts)) dataRef.flashThoughts = [];
        const id = genId();
        dataRef.flashThoughts.unshift({
          id,
          text,
          time: new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
        return {
          handled: true,
          changed: true,
          actionRuntimeMeta: { actionResult: { entity: 'flash_thought', entityId: id, updatedAt: new Date().toISOString() } },
          appliedLabels: [`新增闪念：${text.slice(0, 16)}`],
          createdItems: [{ tab: 'flashThoughts', id, text }],
        };
      }

      if (type === 'add_fixed_thought') {
        const text = String(safeAction.text || '').trim();
        if (!text) return { handled: true, changed: false };
        if (!Array.isArray(dataRef.fixed)) dataRef.fixed = [];
        const id = genId();
        dataRef.fixed.unshift({
          id,
          text,
          time: new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
        return {
          handled: true,
          changed: true,
          actionRuntimeMeta: { actionResult: { entity: 'fixed_thought', entityId: id, updatedAt: new Date().toISOString() } },
          appliedLabels: [`新增定念：${text.slice(0, 16)}`],
          createdItems: [{ tab: 'fixed', id, text }],
        };
      }

      if (type === 'delete_fixed_thought') {
        const fixed = findFixedThoughtByRef(safeAction);
        if (!fixed) return { handled: true, changed: false };
        const result = deleteFixedThoughtKeepingProjectCoverage(fixed);
        const removed = result?.removed;
        if (!removed) return { handled: true, changed: false };
        return {
          handled: true,
          changed: true,
          appliedLabels: [`删除定念：${String(removed?.text || '').slice(0, 16)}`],
          createdItems: [{ tab: 'fixed', id: removed.id, text: removed.text, removed: true }],
        };
      }

      if (type === 'group_flash_thoughts') {
        const result = applyAIFlashThoughtGrouping(safeAction.groups);
        if (!result?.changed) return { handled: true, changed: false };
        return {
          handled: true,
          changed: true,
          appliedLabels: [`闪念分组：${Number(result.groupedCount || 0)} 条`],
        };
      }

      return { handled: false, changed: false };
    }

    function applyThoughtTransformAction(actionType = '', action = {}, options = {}) {
      const type = String(actionType || '').trim();
      const safeAction = action && typeof action === 'object' ? action : {};
      const dataRef = options.dataRef && typeof options.dataRef === 'object' ? options.dataRef : null;
      const genId = typeof options.genId === 'function' ? options.genId : () => `id-${Date.now().toString(36)}`;
      const findFlashThoughtByRef = typeof options.findFlashThoughtByRef === 'function' ? options.findFlashThoughtByRef : () => null;
      const findFlashThoughtsByRefs = typeof options.findFlashThoughtsByRefs === 'function' ? options.findFlashThoughtsByRefs : () => [];
      const findFixedThoughtByRef = typeof options.findFixedThoughtByRef === 'function' ? options.findFixedThoughtByRef : () => null;
      const findProjectByRef = typeof options.findProjectByRef === 'function' ? options.findProjectByRef : () => null;
      const createProjectFromFixedThought = typeof options.createProjectFromFixedThought === 'function' ? options.createProjectFromFixedThought : () => ({ project: null });
      const createProjectWithLinkedFixedThought = typeof options.createProjectWithLinkedFixedThought === 'function' ? options.createProjectWithLinkedFixedThought : null;
      const normalizeFlashThoughtText = typeof options.normalizeFlashThoughtText === 'function' ? options.normalizeFlashThoughtText : (text) => String(text || '').trim().toLowerCase();
      if (!dataRef) return { handled: false, changed: false };

      if (type === 'move_flash_to_fixed') {
        const flash = findFlashThoughtByRef(safeAction);
        if (!flash) return { handled: true, changed: false };
        const flashIdx = Array.isArray(dataRef.flashThoughts) ? dataRef.flashThoughts.findIndex((item) => item.id === flash.id) : -1;
        if (flashIdx < 0) return { handled: true, changed: false };
        if (!Array.isArray(dataRef.fixed)) dataRef.fixed = [];
        const moved = dataRef.flashThoughts.splice(flashIdx, 1)[0];
        if (!moved) return { handled: true, changed: false };
        delete moved.clusterId;
        dataRef.fixed.unshift(moved);
        return { handled: true, changed: true, appliedLabels: [`闪念转定念：${String(moved.text || '').slice(0, 16)}`] };
      }

      if (type === 'move_fixed_to_project') {
        const fixed = findFixedThoughtByRef(safeAction);
        if (!fixed) return { handled: true, changed: false };
        const result = createProjectFromFixedThought(fixed);
        if (!result?.project) return { handled: true, changed: false };
        return {
          handled: true,
          changed: true,
          appliedLabels: [`定念转项目：${result.project.name}`],
          createdItems: [{ tab: 'project', id: result.project.id, text: result.project.name }],
        };
      }

      if (type === 'move_flash_to_project_reference') {
        const project = findProjectByRef(safeAction);
        const flash = findFlashThoughtByRef(safeAction);
        if (!project || !flash) return { handled: true, changed: false };
        const flashIdx = Array.isArray(dataRef.flashThoughts) ? dataRef.flashThoughts.findIndex((item) => item.id === flash.id) : -1;
        if (flashIdx < 0) return { handled: true, changed: false };
        const moved = dataRef.flashThoughts.splice(flashIdx, 1)[0];
        if (!moved) return { handled: true, changed: false };
        delete moved.clusterId;
        if (!Array.isArray(project.items)) project.items = [];
        project.items.unshift(moved);
        return {
          handled: true,
          changed: true,
          appliedLabels: [`闪念归入项目：${project.name}`],
          createdItems: [{ tab: 'project', id: project.id, text: project.name, target: 'references' }],
        };
      }

      if (type === 'ungroup_flash_thoughts') {
        const refs = Array.isArray(safeAction.items) ? safeAction.items : [];
        let targets = findFlashThoughtsByRefs(refs);
        if (!targets.length && safeAction.clusterId && Array.isArray(dataRef.flashThoughts)) {
          targets = dataRef.flashThoughts.filter((item) => item.clusterId === safeAction.clusterId);
        }
        if (!targets.length) return { handled: true, changed: false };
        let ungrouped = 0;
        targets.forEach((item) => {
          if (!item.clusterId) return;
          delete item.clusterId;
          ungrouped += 1;
        });
        if (!ungrouped) return { handled: true, changed: false };
        return { handled: true, changed: true, appliedLabels: [`取消分组：${ungrouped} 条`] };
      }

      if (type === 'merge_flash_thoughts') {
        const refs = Array.isArray(safeAction.items) ? safeAction.items : [];
        const matches = findFlashThoughtsByRefs(refs);
        if (matches.length < 2) return { handled: true, changed: false };
        const mergedText = String(safeAction.text || '').trim() || matches.map((item) => String(item.text || '').trim()).filter(Boolean).join('\n');
        if (!mergedText) return { handled: true, changed: false };
        const ids = new Set(matches.map((item) => item.id));
        if (!Array.isArray(dataRef.flashThoughts)) dataRef.flashThoughts = [];
        dataRef.flashThoughts = dataRef.flashThoughts.filter((item) => !ids.has(item.id));
        const id = genId();
        dataRef.flashThoughts.unshift({
          id,
          text: mergedText,
          time: new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        });
        return {
          handled: true,
          changed: true,
          appliedLabels: [`合并闪念：${matches.length} 条`],
          createdItems: [{ tab: 'flashThoughts', id, text: mergedText }],
        };
      }

      if (type === 'dedupe_flash_thoughts') {
        const refs = Array.isArray(safeAction.items) ? safeAction.items : [];
        const scoped = refs.length ? findFlashThoughtsByRefs(refs) : (Array.isArray(dataRef.flashThoughts) ? dataRef.flashThoughts.slice() : []);
        if (scoped.length < 2) return { handled: true, changed: false };
        const keepMap = new Map();
        const removeIds = [];
        scoped.forEach((item) => {
          const key = normalizeFlashThoughtText(item.text);
          if (!key) return;
          if (!keepMap.has(key)) {
            keepMap.set(key, item.id);
            return;
          }
          removeIds.push(item.id);
        });
        if (!removeIds.length) return { handled: true, changed: false };
        const removeSet = new Set(removeIds);
        if (!Array.isArray(dataRef.flashThoughts)) dataRef.flashThoughts = [];
        dataRef.flashThoughts = dataRef.flashThoughts.filter((item) => !removeSet.has(item.id));
        return { handled: true, changed: true, appliedLabels: [`闪念去重：${removeIds.length} 条`] };
      }

      if (type === 'dedupe_project_references') {
        const removals = Array.isArray(safeAction.removals) ? safeAction.removals : [];
        let removedCount = 0;
        removals.forEach((r) => {
          const projectId = r.projectId || r.project;
          const itemId = r.itemId || r.id;
          if (!projectId || !itemId) return;
          const project = Array.isArray(dataRef.projects) ? dataRef.projects.find((p) => p.id === projectId) : null;
          if (!project || !Array.isArray(project.items)) return;
          const before = project.items.length;
          project.items = project.items.filter((item) => item.id !== itemId);
          if (project.items.length < before) removedCount += 1;
        });
        if (!removedCount) return { handled: true, changed: false };
        return { handled: true, changed: true, appliedLabels: [`项目条目去重：移除 ${removedCount} 条重复`] };
      }

      if (type === 'create_project_from_flash_group') {
        const clusterId = String(safeAction.clusterId || '').trim();
        let sourceItems = clusterId
          ? (Array.isArray(dataRef.flashThoughts) ? dataRef.flashThoughts.filter((item) => item.clusterId === clusterId) : [])
          : findFlashThoughtsByRefs(Array.isArray(safeAction.items) ? safeAction.items : []);
        sourceItems = Array.from(new Map(sourceItems.map((item) => [item.id, item])).values());
        if (sourceItems.length < 2) return { handled: true, changed: false };
        const name = String(safeAction.name || safeAction.projectName || '').trim() || `闪念群组项目 ${new Date().toLocaleDateString('zh-CN')}`;
        const items = sourceItems.map((item) => {
          const next = { ...item };
          delete next.clusterId;
          return next;
        });
        const result = createProjectWithLinkedFixedThought
          ? createProjectWithLinkedFixedThought(name, { items })
          : (() => {
            const id = genId();
            const project = { id, name, items, blocks: [{ id: genId(), type: 'p', content: '', checked: false }], createdAt: new Date().toISOString() };
            if (!Array.isArray(dataRef.projects)) dataRef.projects = [];
            dataRef.projects.unshift(project);
            return { project };
          })();
        if (!result?.project) return { handled: true, changed: false };
        const sourceIds = new Set(sourceItems.map((item) => item.id));
        if (!Array.isArray(dataRef.flashThoughts)) dataRef.flashThoughts = [];
        dataRef.flashThoughts = dataRef.flashThoughts.filter((item) => !sourceIds.has(item.id));
        return {
          handled: true,
          changed: true,
          appliedLabels: [`群组建项目：${result.project.name}`],
          createdItems: [{ tab: 'project', id: result.project.id, text: result.project.name }],
        };
      }

      return { handled: false, changed: false };
    }

    return {
      applyThoughtAction,
      applyThoughtTransformAction,
    };
  }

  window.MorphAIActionThoughtRuntime = {
    create: createAIActionThoughtRuntime,
  };
})();
