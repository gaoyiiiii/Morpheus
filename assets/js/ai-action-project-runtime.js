// @ts-check

(function initMorphAIActionProjectRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionProjectRuntime && typeof window.MorphAIActionProjectRuntime.create === 'function') return;

  function createAIActionProjectRuntime() {
    function applyProjectAction(type = '', actionPayload = {}, runtime = {}) {
      const actionType = String(type || '').trim();
      const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
      const ctx = runtime && typeof runtime === 'object' ? runtime : {};
      const dataRef = ctx.dataRef && typeof ctx.dataRef === 'object' ? ctx.dataRef : null;
      const genId = typeof ctx.genId === 'function' ? ctx.genId : (() => `id-${Date.now().toString(36)}`);
      const normalizeProjectStatus = typeof ctx.normalizeProjectStatus === 'function' ? ctx.normalizeProjectStatus : (() => 'active');
      const createProjectWithLinkedFixedThought = typeof ctx.createProjectWithLinkedFixedThought === 'function' ? ctx.createProjectWithLinkedFixedThought : null;
      const applyProjectDisplayName = typeof ctx.applyProjectDisplayName === 'function' ? ctx.applyProjectDisplayName : null;
      const resolveProjectByRef = typeof ctx.resolveProjectByRef === 'function' ? ctx.resolveProjectByRef : () => null;
      const getProjectStoredStatus = typeof ctx.getProjectStoredStatus === 'function' ? ctx.getProjectStoredStatus : () => '';
      const findProjectByRef = typeof ctx.findProjectByRef === 'function' ? ctx.findProjectByRef : () => null;
      const syncFixedThoughtFromLinkedProject = typeof ctx.syncFixedThoughtFromLinkedProject === 'function' ? ctx.syncFixedThoughtFromLinkedProject : null;
      const archiveProjectState = typeof ctx.archiveProjectState === 'function' ? ctx.archiveProjectState : null;
      const restoreProjectState = typeof ctx.restoreProjectState === 'function' ? ctx.restoreProjectState : null;
      const ensureContextBlocks = typeof ctx.ensureContextBlocks === 'function' ? ctx.ensureContextBlocks : () => [];
      const buildBlockFromAIAction = typeof ctx.buildBlockFromAIAction === 'function' ? ctx.buildBlockFromAIAction : (() => ({}));
      const normalizeAIItemText = typeof ctx.normalizeAIItemText === 'function' ? ctx.normalizeAIItemText : (text) => String(text || '').trim();
      const shouldWriteProjectActionIntoBlocks = typeof ctx.shouldWriteProjectActionIntoBlocks === 'function' ? ctx.shouldWriteProjectActionIntoBlocks : () => false;
      const ensureProjectItems = typeof ctx.ensureProjectItems === 'function' ? ctx.ensureProjectItems : () => [];
      const findContextBlockByRef = typeof ctx.findContextBlockByRef === 'function' ? ctx.findContextBlockByRef : () => null;
      const inferListStyleFromText = typeof ctx.inferListStyleFromText === 'function' ? ctx.inferListStyleFromText : (text) => ({ type: 'p', content: String(text || ''), checked: false });
      const isIndentableBlockType = typeof ctx.isIndentableBlockType === 'function' ? ctx.isIndentableBlockType : () => false;
      const findProjectReferenceByRef = typeof ctx.findProjectReferenceByRef === 'function' ? ctx.findProjectReferenceByRef : () => null;
      const unlinkProjectFromFixedThought = typeof ctx.unlinkProjectFromFixedThought === 'function' ? ctx.unlinkProjectFromFixedThought : null;
      const promptQuestion = String(ctx.promptQuestion || '').trim();

      if (!actionType || !dataRef) return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };

      if (actionType === 'create_project') {
        const name = String(action.name || '').trim();
        if (!name) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const nowIso = new Date().toISOString();
        const normalizedStatus = normalizeProjectStatus(action.status || '') || 'active';
        const result = createProjectWithLinkedFixedThought
          ? createProjectWithLinkedFixedThought(name, {
            description: String(action.description || '').trim(),
            bodyText: String(action.bodyText || action.content || '').trim(),
          })
          : (() => {
            const id = genId();
            const project = { id, name, items: [], blocks: [{ id: genId(), type: 'p', content: '', checked: false }], createdAt: new Date().toISOString() };
            if (!Array.isArray(dataRef.projects)) dataRef.projects = [];
            dataRef.projects.unshift(project);
            return { project };
          })();
        if (!result?.project) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        result.project.updatedAt = nowIso;
        if (normalizedStatus === 'archived' && archiveProjectState) archiveProjectState(result.project, { syncLinkedFixed: true, occurredAt: nowIso });
        else {
          result.project.status = normalizedStatus;
          if (normalizedStatus === 'archived') result.project.archivedAt = nowIso;
          else delete result.project.archivedAt;
        }
        return {
          handled: true,
          changed: true,
          appliedLabels: [`新建项目：${result.project.name}`],
          createdItems: [{ tab: 'project', id: result.project.id, text: result.project.name }],
          actionRuntimeMeta: {
            actionResult: {
              entity: 'project',
              entityId: String(result.project.id || '').trim(),
              status: normalizedStatus,
              updatedAt: nowIso,
            },
          },
        };
      }

      if (actionType === 'update_project_status') {
        const project = resolveProjectByRef(action);
        const nextStatus = normalizeProjectStatus(action.status || '');
        if (!project || !nextStatus) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const previousStatus = getProjectStoredStatus(project) || 'active';
        const nowIso = new Date().toISOString();
        project.updatedAt = nowIso;
        if (nextStatus === 'archived' && archiveProjectState) archiveProjectState(project, { syncLinkedFixed: true, occurredAt: nowIso });
        else if (nextStatus !== 'archived' && restoreProjectState) restoreProjectState(project, { syncLinkedFixed: true });
        else {
          project.status = nextStatus;
          if (nextStatus === 'archived') project.archivedAt = nowIso;
          else delete project.archivedAt;
        }
        return {
          handled: true,
          changed: true,
          appliedLabels: [`${nextStatus === 'archived' ? '归档项目' : '恢复项目'}：${project.name}`],
          createdItems: [{ tab: 'project', id: project.id, text: project.name, status: nextStatus, oldStatus: previousStatus }],
          actionRuntimeMeta: {
            actionResult: {
              entity: 'project',
              entityId: String(project.id || '').trim(),
              oldStatus: previousStatus,
              newStatus: nextStatus,
              status: nextStatus,
              updatedAt: nowIso,
            },
          },
        };
      }

      if (actionType === 'create_routine') {
        const name = String(action.name || '').trim();
        if (!name) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const id = genId();
        if (!Array.isArray(dataRef.routines)) dataRef.routines = [];
        dataRef.routines.unshift({ id, name, items: [], blocks: [{ id: genId(), type: 'p', content: '', checked: false }] });
        return {
          handled: true,
          changed: true,
          appliedLabels: [`新建节律：${name}`],
          createdItems: [{ tab: 'routine', id, text: name }],
          actionRuntimeMeta: null,
        };
      }

      if (actionType === 'rename_project') {
        const project = findProjectByRef(action);
        const newName = String(action.newName || '').trim();
        if (!project || !newName) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (typeof applyProjectDisplayName === 'function') applyProjectDisplayName(project, newName, { syncHtml: false });
        else {
          project.name = newName;
          if (syncFixedThoughtFromLinkedProject) syncFixedThoughtFromLinkedProject(project, { syncHtml: false });
        }
        return { handled: true, changed: true, appliedLabels: [`重命名项目：${project.name}`], createdItems: [], actionRuntimeMeta: null };
      }

      if (actionType === 'append_project_block') {
        const project = findProjectByRef(action);
        const content = String(action.content || '').trim();
        if (!project || !content) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        ensureContextBlocks(project).push(buildBlockFromAIAction(action));
        return {
          handled: true,
          changed: true,
          appliedLabels: [`项目追加块：${project.name}`],
          createdItems: [{ tab: 'project', id: project.id, text: project.name, target: 'blocks' }],
          actionRuntimeMeta: null,
        };
      }

      if (actionType === 'add_project_reference') {
        const project = findProjectByRef(action);
        const text = normalizeAIItemText(action.text || '');
        if (!project || !text) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (shouldWriteProjectActionIntoBlocks(promptQuestion, action)) {
          ensureContextBlocks(project).push(buildBlockFromAIAction({
            ...action,
            type: 'append_project_block',
            content: text,
            blockType: action.blockType || 'p',
          }));
          return {
            handled: true,
            changed: true,
            appliedLabels: [`项目内容：${project.name}`],
            createdItems: [{ tab: 'project', id: project.id, text: project.name, target: 'blocks' }],
            actionRuntimeMeta: null,
          };
        }
        ensureProjectItems(project).unshift({ id: genId(), text, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
        return {
          handled: true,
          changed: true,
          appliedLabels: [`项目条目：${project.name}`],
          createdItems: [{ tab: 'project', id: project.id, text: project.name, target: 'references' }],
          actionRuntimeMeta: null,
        };
      }

      if (actionType === 'update_project_block') {
        const project = findProjectByRef(action);
        const newContent = String(action.newContent || action.content || '').trim();
        if (!project || !newContent) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const block = findContextBlockByRef(project, action);
        if (!block) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const inferred = inferListStyleFromText(newContent);
        block.type = ['p', 'todo', 'h1', 'h2', 'h3', 'bullet', 'number'].includes(action.blockType) ? action.blockType : inferred.type;
        block.content = inferred.content;
        if (block.type === 'todo') block.checked = Object.prototype.hasOwnProperty.call(action, 'checked') ? !!action.checked : !!inferred.checked;
        if (block.type !== 'todo') delete block.checked;
        if (isIndentableBlockType(block.type)) block.indent = Math.max(0, Number(action.indent) || 0);
        else delete block.indent;
        delete block.html;
        return { handled: true, changed: true, appliedLabels: [`更新项目块：${project.name}`], createdItems: [], actionRuntimeMeta: null };
      }

      if (actionType === 'delete_project_block') {
        const project = findProjectByRef(action);
        if (!project) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const blocks = ensureContextBlocks(project);
        const block = findContextBlockByRef(project, action);
        if (!block) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const idx = blocks.findIndex((entry) => String(entry?.id || '') === String(block.id || ''));
        if (idx < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        blocks.splice(idx, 1);
        if (!blocks.length) blocks.push({ id: genId(), type: 'p', content: '', checked: false });
        return { handled: true, changed: true, appliedLabels: [`删除项目块：${project.name}`], createdItems: [], actionRuntimeMeta: null };
      }

      if (actionType === 'update_project_reference') {
        const project = findProjectByRef(action);
        const newText = normalizeAIItemText(action.newText || action.text || '');
        if (!project || !newText) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const item = findProjectReferenceByRef(project, action);
        if (!item) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        item.text = newText;
        item.time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        return { handled: true, changed: true, appliedLabels: [`更新项目条目：${project.name}`], createdItems: [], actionRuntimeMeta: null };
      }

      if (actionType === 'delete_project_reference') {
        const project = findProjectByRef(action);
        if (!project) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const items = ensureProjectItems(project);
        const item = findProjectReferenceByRef(project, action);
        if (!item) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const idx = items.findIndex((entry) => String(entry?.id || '') === String(item.id || ''));
        if (idx < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        items.splice(idx, 1);
        return { handled: true, changed: true, appliedLabels: [`删除项目条目：${project.name}`], createdItems: [], actionRuntimeMeta: null };
      }

      if (actionType === 'delete_project') {
        const project = findProjectByRef(action);
        if (!project) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const idx = Array.isArray(dataRef.projects) ? dataRef.projects.findIndex((entry) => String(entry?.id || '') === String(project.id || '')) : -1;
        if (idx < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (unlinkProjectFromFixedThought) unlinkProjectFromFixedThought(project);
        dataRef.projects.forEach((entry) => {
          if (String(entry?.parentProjectId || '').trim() === String(project.id || '').trim()) delete entry.parentProjectId;
        });
        dataRef.projects.splice(idx, 1);
        return { handled: true, changed: true, appliedLabels: [`删除项目：${project.name}`], createdItems: [], actionRuntimeMeta: null };
      }

      return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
    }

    return {
      applyProjectAction,
    };
  }

  window.MorphAIActionProjectRuntime = {
    create: createAIActionProjectRuntime,
  };
})();
