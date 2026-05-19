// @ts-check

(function initMorphEditorDraftRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphEditorDraftRuntime && typeof window.MorphEditorDraftRuntime.create === 'function') return;

  function createEditorDraftRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const state = {
      contextDrafts: new Map(),
      detailDrafts: new Map(),
      contextSubmissionStates: new Map(),
      detailSubmissionStates: new Map(),
    };

    const cloneValue = (value) => {
      if (typeof api.cloneJSONSafe === 'function') return api.cloneJSONSafe(value);
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_) {
        return value;
      }
    };

    const createBlockId = () => (typeof api.genId === 'function'
      ? api.genId()
      : `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);

    function getDataRoot() {
      const value = typeof api.getDataRoot === 'function' ? api.getDataRoot() : null;
      return value && typeof value === 'object' ? value : null;
    }

    function getContextKey(context = '', contextId = '') {
      return `${String(context || '').trim()}::${String(contextId || '').trim()}`;
    }

    function getDetailKey(meta = {}, item = null) {
      const kind = String(meta?.kind || 'detail').trim();
      const contextType = String(meta?.contextType || '').trim();
      const itemId = String(item?.id || '').trim();
      return `${kind}::${contextType}::${itemId}`;
    }

    function buildSubmissionSnapshot(phase = 'clean', extra = {}) {
      const editingAt = Number(extra?.editingAt || 0);
      const committedAt = Number(extra?.committedAt || 0);
      return {
        phase: phase === 'committed' ? 'committed' : (phase === 'editing' ? 'editing' : 'clean'),
        editingAt,
        committedAt,
        updatedAt: Math.max(Number(extra?.updatedAt || 0), editingAt, committedAt, Date.now()),
      };
    }

    function setContextSubmissionState(context = '', contextId = '', phase = 'clean', extra = {}) {
      const key = getContextKey(context, contextId);
      if (!key.trim()) return buildSubmissionSnapshot();
      const current = state.contextSubmissionStates.get(key) || {};
      const next = buildSubmissionSnapshot(phase, {
        editingAt: extra?.editingAt ?? current.editingAt ?? 0,
        committedAt: extra?.committedAt ?? current.committedAt ?? 0,
        updatedAt: extra?.updatedAt ?? current.updatedAt ?? 0,
      });
      state.contextSubmissionStates.set(key, next);
      return next;
    }

    function setDetailSubmissionState(meta = {}, item = null, phase = 'clean', extra = {}) {
      const key = getDetailKey(meta, item);
      if (!key.trim()) return buildSubmissionSnapshot();
      const current = state.detailSubmissionStates.get(key) || {};
      const next = buildSubmissionSnapshot(phase, {
        editingAt: extra?.editingAt ?? current.editingAt ?? 0,
        committedAt: extra?.committedAt ?? current.committedAt ?? 0,
        updatedAt: extra?.updatedAt ?? current.updatedAt ?? 0,
      });
      state.detailSubmissionStates.set(key, next);
      return next;
    }

    function getContextSubmissionState(context = '', contextId = '') {
      const key = getContextKey(context, contextId);
      return state.contextSubmissionStates.get(key) || buildSubmissionSnapshot();
    }

    function getDetailSubmissionState(meta = {}, item = null) {
      const key = getDetailKey(meta, item);
      return state.detailSubmissionStates.get(key) || buildSubmissionSnapshot();
    }

    function syncObjectShape(target = null, snapshot = null) {
      if (!target || !snapshot || typeof target !== 'object' || typeof snapshot !== 'object') return target;
      Object.keys(target).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(snapshot, key)) delete target[key];
      });
      Object.keys(snapshot).forEach((key) => {
        target[key] = cloneValue(snapshot[key]);
      });
      return target;
    }

    function ensureBlockIdList(blocks = []) {
      if (!Array.isArray(blocks)) return blocks;
      if (typeof api.ensureManagedBlockIds === 'function') {
        api.ensureManagedBlockIds(blocks);
        return blocks;
      }
      const seen = new Set();
      blocks.forEach((block) => {
        if (!block || typeof block !== 'object') return;
        const rawId = String(block.id || '').trim();
        if (!rawId || seen.has(rawId)) {
          block.id = createBlockId();
        }
        seen.add(String(block.id || '').trim());
      });
      return blocks;
    }

    function getCanonicalContextRecord(context = '', contextId = '', { create = false } = {}) {
      const normalizedContext = String(context || '').trim();
      const normalizedContextId = String(contextId || '').trim();
      const dataRoot = getDataRoot();
      if (!dataRoot || !normalizedContext || !normalizedContextId) return null;
      if (normalizedContext === 'daily') {
        if (!dataRoot.dailyMonths || typeof dataRoot.dailyMonths !== 'object') dataRoot.dailyMonths = {};
        if (create && !Array.isArray(dataRoot.dailyMonths[normalizedContextId])) dataRoot.dailyMonths[normalizedContextId] = [];
        const blocks = Array.isArray(dataRoot.dailyMonths[normalizedContextId]) ? dataRoot.dailyMonths[normalizedContextId] : null;
        if (!blocks) return null;
        ensureBlockIdList(blocks);
        return {
          context: normalizedContext,
          contextId: normalizedContextId,
          blocks,
          title: '',
          target: null,
        };
      }
      if (normalizedContext === 'project') {
        if (!Array.isArray(dataRoot.projects)) dataRoot.projects = [];
        const project = dataRoot.projects.find((item) => String(item?.id || '').trim() === normalizedContextId) || null;
        if (!project) return null;
        if (create && !Array.isArray(project.blocks)) project.blocks = [{ id: createBlockId(), type: 'p', content: '', checked: false }];
        if (!Array.isArray(project.blocks)) return null;
        ensureBlockIdList(project.blocks);
        return {
          context: normalizedContext,
          contextId: normalizedContextId,
          blocks: project.blocks,
          title: String(project.name || '未命名'),
          target: project,
        };
      }
      return null;
    }

    function ensureContextDraft(context = '', contextId = '') {
      const key = getContextKey(context, contextId);
      if (!key.trim()) return null;
      const existing = state.contextDrafts.get(key);
      if (existing && typeof existing === 'object') {
        if (existing.dirty !== true) {
          const canonical = getCanonicalContextRecord(context, contextId, { create: true });
          if (!canonical) {
            clearContextDraft(context, contextId);
            return null;
          }
          syncObjectShape(existing, {
            context: canonical.context,
            contextId: canonical.contextId,
            title: String(canonical.title || '').trim(),
            blocks: ensureBlockIdList(cloneValue(Array.isArray(canonical.blocks) ? canonical.blocks : [])),
            dirty: false,
            updatedAt: Date.now(),
          });
        }
        return existing;
      }
      const canonical = getCanonicalContextRecord(context, contextId, { create: true });
      if (!canonical) return null;
      const draft = {
        context: canonical.context,
        contextId: canonical.contextId,
        title: canonical.title,
        blocks: ensureBlockIdList(cloneValue(Array.isArray(canonical.blocks) ? canonical.blocks : [])),
        dirty: false,
        updatedAt: Date.now(),
      };
      state.contextDrafts.set(key, draft);
      return draft;
    }

    function getContextDraft(context = '', contextId = '') {
      return state.contextDrafts.get(getContextKey(context, contextId)) || null;
    }

    function hasContextDraft(context = '', contextId = '') {
      return !!getContextDraft(context, contextId);
    }

    function clearContextDraft(context = '', contextId = '') {
      return state.contextDrafts.delete(getContextKey(context, contextId));
    }

    function reconcileContextDraftToCanonical(context = '', contextId = '') {
      const key = getContextKey(context, contextId);
      const existing = state.contextDrafts.get(key);
      if (!existing || typeof existing !== 'object') return null;
      const canonical = getCanonicalContextRecord(context, contextId, { create: true });
      if (!canonical) {
        clearContextDraft(context, contextId);
        return null;
      }
      syncObjectShape(existing, {
        context: canonical.context,
        contextId: canonical.contextId,
        title: String(canonical.title || '').trim(),
        blocks: ensureBlockIdList(cloneValue(Array.isArray(canonical.blocks) ? canonical.blocks : [])),
        dirty: false,
        updatedAt: Date.now(),
      });
      setContextSubmissionState(context, contextId, 'committed', {
        committedAt: existing.updatedAt,
        updatedAt: existing.updatedAt,
      });
      return existing;
    }

    function stageBlockPayload(context = '', contextId = '', blockId = '', payload = null) {
      const draft = ensureContextDraft(context, contextId);
      const snapshot = payload && typeof payload === 'object' ? cloneValue(payload) : null;
      if (!draft || !snapshot) return null;
      const normalizedBlockId = String(blockId || snapshot.id || '').trim();
      let block = Array.isArray(draft.blocks)
        ? draft.blocks.find((item) => String(item?.id || '').trim() === normalizedBlockId)
        : null;
      if (!block) {
        block = { id: normalizedBlockId || createBlockId(), type: 'p', content: '', checked: false };
        draft.blocks.push(block);
      }
      syncObjectShape(block, {
        ...snapshot,
        id: normalizedBlockId || String(snapshot.id || '').trim() || String(block.id || '').trim() || createBlockId(),
      });
      ensureBlockIdList(draft.blocks);
      draft.dirty = true;
      draft.updatedAt = Date.now();
      setContextSubmissionState(context, contextId, 'editing', { editingAt: draft.updatedAt, updatedAt: draft.updatedAt });
      return block;
    }

    function getContextBlocksForRender(context = '', contextId = '', fallbackBlocks = []) {
      const draft = getContextDraft(context, contextId);
      if (draft && Array.isArray(draft.blocks) && (draft.dirty === true || !Array.isArray(fallbackBlocks) || fallbackBlocks.length === 0)) return draft.blocks;
      return Array.isArray(fallbackBlocks) ? fallbackBlocks : [];
    }

    function stageContextTitle(context = '', contextId = '', nextTitle = '') {
      const draft = ensureContextDraft(context, contextId);
      if (!draft) return '';
      draft.title = String(nextTitle || '').trim() || '未命名';
      draft.dirty = true;
      draft.updatedAt = Date.now();
      setContextSubmissionState(context, contextId, 'editing', { editingAt: draft.updatedAt, updatedAt: draft.updatedAt });
      return draft.title;
    }

    function getContextTitle(context = '', contextId = '', fallbackTitle = '') {
      const draft = getContextDraft(context, contextId);
      if (draft && typeof draft.title === 'string' && draft.title.trim() && (draft.dirty === true || !String(fallbackTitle || '').trim())) return draft.title.trim();
      return String(fallbackTitle || '').trim();
    }

    function applyBlockDraftToCanonical(targetBlocks = [], draftBlocks = []) {
      if (!Array.isArray(targetBlocks)) return [];
      const safeDraftBlocks = ensureBlockIdList(Array.isArray(draftBlocks) ? draftBlocks.map((item) => cloneValue(item)) : []);
      const existingById = new Map();
      targetBlocks.forEach((block) => {
        const id = String(block?.id || '').trim();
        if (id) existingById.set(id, block);
      });
      const nextBlocks = safeDraftBlocks.map((snapshot) => {
        const id = String(snapshot?.id || '').trim();
        const reused = id ? existingById.get(id) : null;
        if (reused && typeof reused === 'object') {
          syncObjectShape(reused, snapshot);
          existingById.delete(id);
          return reused;
        }
        return cloneValue(snapshot);
      });
      targetBlocks.splice(0, targetBlocks.length, ...nextBlocks);
      ensureBlockIdList(targetBlocks);
      return targetBlocks;
    }

    function applyContextDraftToCanonical(context = '', contextId = '', options = {}) {
      const draft = getContextDraft(context, contextId);
      if (!draft) return { applied: false, changed: false, draft: null };
      if (draft.dirty !== true) {
        if (options && options.clear === true) clearContextDraft(context, contextId);
        return { applied: false, changed: false, draft };
      }
      const canonical = getCanonicalContextRecord(context, contextId, { create: true });
      if (!canonical) return { applied: false, changed: false, draft };
      let changed = false;
      if (Array.isArray(canonical.blocks) && Array.isArray(draft.blocks)) {
        const before = JSON.stringify(canonical.blocks);
        applyBlockDraftToCanonical(canonical.blocks, draft.blocks);
        changed = changed || before !== JSON.stringify(canonical.blocks);
      }
      if (canonical.context === 'project' && canonical.target) {
        const nextTitle = String(draft.title || '').trim() || '未命名';
        if (String(canonical.target.name || '').trim() !== nextTitle) {
          if (typeof api.applyProjectDisplayName === 'function') api.applyProjectDisplayName(canonical.target, nextTitle, { syncHtml: false });
          else canonical.target.name = nextTitle;
          changed = true;
        }
      }
      const committedAt = Date.now();
      syncObjectShape(draft, {
        context: canonical.context,
        contextId: canonical.contextId,
        title: canonical.context === 'project' && canonical.target
          ? String(canonical.target.name || '').trim() || '未命名'
          : String(draft.title || '').trim(),
        blocks: ensureBlockIdList(cloneValue(Array.isArray(canonical.blocks) ? canonical.blocks : [])),
        dirty: false,
        updatedAt: committedAt,
      });
      setContextSubmissionState(context, contextId, 'committed', { committedAt: draft.updatedAt, updatedAt: draft.updatedAt });
      if (options && options.clear === true) clearContextDraft(context, contextId);
      return { applied: true, changed, draft };
    }

    function ensureDetailDraft(meta = {}, item = null) {
      const key = getDetailKey(meta, item);
      if (!key.trim()) return null;
      const existing = state.detailDrafts.get(key);
      if (existing && typeof existing === 'object') return existing;
      const draft = {
        kind: String(meta?.kind || 'detail').trim(),
        contextType: String(meta?.contextType || '').trim(),
        itemId: String(item?.id || '').trim(),
        html: String(item?.html || ''),
        text: String(item?.text || '').trim(),
        name: String(item?.name || '').trim(),
        dirty: false,
        updatedAt: Date.now(),
      };
      state.detailDrafts.set(key, draft);
      return draft;
    }

    function getDetailDraft(meta = {}, item = null) {
      return state.detailDrafts.get(getDetailKey(meta, item)) || null;
    }

    function clearDetailDraft(meta = {}, item = null) {
      return state.detailDrafts.delete(getDetailKey(meta, item));
    }

    function stageDetailDraft(meta = {}, item = null, payload = {}) {
      const draft = ensureDetailDraft(meta, item);
      if (!draft) return null;
      if (Object.prototype.hasOwnProperty.call(payload, 'html')) draft.html = String(payload.html || '');
      if (Object.prototype.hasOwnProperty.call(payload, 'text')) draft.text = String(payload.text || '').trim();
      if (Object.prototype.hasOwnProperty.call(payload, 'name')) draft.name = String(payload.name || '').trim();
      draft.dirty = true;
      draft.updatedAt = Date.now();
      setDetailSubmissionState(meta, item, 'editing', { editingAt: draft.updatedAt, updatedAt: draft.updatedAt });
      return draft;
    }

    function markDetailDraftCommitted(meta = {}, item = null) {
      const draft = getDetailDraft(meta, item);
      const committedAt = Date.now();
      if (draft) {
        draft.dirty = false;
        draft.updatedAt = committedAt;
      }
      return setDetailSubmissionState(meta, item, 'committed', { committedAt, updatedAt: committedAt });
    }

    function getDetailDraftPayload(meta = {}, item = null, fallback = {}) {
      const draft = getDetailDraft(meta, item);
      if (!draft) return {
        html: String(fallback?.html || item?.html || ''),
        text: String(fallback?.text || item?.text || '').trim(),
        name: String(fallback?.name || item?.name || '').trim(),
      };
      return {
        html: String(draft.html || ''),
        text: String(draft.text || '').trim(),
        name: String(draft.name || '').trim(),
      };
    }

    function listDirtyContextDrafts() {
      const out = [];
      state.contextDrafts.forEach((draft) => {
        if (!draft || draft.dirty !== true) return;
        out.push({
          kind: 'context',
          context: String(draft.context || '').trim(),
          contextId: String(draft.contextId || '').trim(),
          updatedAt: Number(draft.updatedAt || 0),
        });
      });
      return out.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    }

    function listDirtyDetailDrafts() {
      const out = [];
      state.detailDrafts.forEach((draft) => {
        if (!draft || draft.dirty !== true) return;
        out.push({
          kind: 'detail',
          detailKind: String(draft.kind || 'detail').trim(),
          contextType: String(draft.contextType || '').trim(),
          itemId: String(draft.itemId || '').trim(),
          updatedAt: Number(draft.updatedAt || 0),
        });
      });
      return out.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    }

    function getProtectedDraftSummary() {
      const contexts = listDirtyContextDrafts();
      const details = listDirtyDetailDrafts();
      const protectedDrafts = contexts.concat(details);
      return {
        hasProtectedDrafts: protectedDrafts.length > 0,
        count: protectedDrafts.length,
        latestUpdatedAt: protectedDrafts.reduce((max, item) => Math.max(max, Number(item?.updatedAt || 0)), 0),
        contexts,
        details,
      };
    }

    function hasProtectedDrafts() {
      return getProtectedDraftSummary().hasProtectedDrafts;
    }

    return {
      hasContextDraft,
      getContextDraft,
      ensureContextDraft,
      clearContextDraft,
      reconcileContextDraftToCanonical,
      stageBlockPayload,
      getContextBlocksForRender,
      stageContextTitle,
      getContextTitle,
      applyContextDraftToCanonical,
      getDetailDraft,
      getContextSubmissionState,
      getDetailSubmissionState,
      ensureDetailDraft,
      clearDetailDraft,
      stageDetailDraft,
      markDetailDraftCommitted,
      getDetailDraftPayload,
      listDirtyContextDrafts,
      listDirtyDetailDrafts,
      getProtectedDraftSummary,
      hasProtectedDrafts,
    };
  }

  window.MorphEditorDraftRuntime = {
    create: createEditorDraftRuntime,
  };
})();
