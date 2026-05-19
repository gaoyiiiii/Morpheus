(function initMorphEditorFlashTransferRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphEditorFlashTransferRuntime && typeof window.MorphEditorFlashTransferRuntime.create === 'function') return;

  function createEditorFlashTransferRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getEditorFlashTransferScope(context = '', contextId = '') {
      return typeof api.getEditorFlashTransferScope === 'function'
        ? api.getEditorFlashTransferScope(context, contextId)
        : null;
    }

    function getDataRoot() {
      return typeof api.getDataRoot === 'function' ? api.getDataRoot() : null;
    }

    function cloneJSONSafe(value) {
      if (typeof api.cloneJSONSafe === 'function') return api.cloneJSONSafe(value);
      if (value === undefined) return undefined;
      return JSON.parse(JSON.stringify(value));
    }

    function requestDrawerRender() {
      if (typeof api.requestDrawerRender === 'function') api.requestDrawerRender();
    }

    function performMorphTransactionalMutation(options = {}) {
      return typeof api.performMorphTransactionalMutation === 'function'
        ? api.performMorphTransactionalMutation(options)
        : false;
    }

    function commitMorphCoreMutation(options = {}) {
      return typeof api.commitMorphCoreMutation === 'function'
        ? api.commitMorphCoreMutation(options)
        : null;
    }

    function recordMorphActionTransaction(value = {}) {
      if (typeof api.recordMorphActionTransaction === 'function') return api.recordMorphActionTransaction(value);
      return null;
    }

    function mergeMorphSyncEntityRefs(value = {}) {
      return typeof api.mergeMorphSyncEntityRefs === 'function' ? api.mergeMorphSyncEntityRefs(value) : value;
    }

    function buildMorphSyncEntityRefsFromCreatedItems(value = []) {
      return typeof api.buildMorphSyncEntityRefsFromCreatedItems === 'function'
        ? api.buildMorphSyncEntityRefsFromCreatedItems(value)
        : value;
    }

    function protectRecentCommittedData(value = {}) {
      if (typeof api.protectRecentCommittedData === 'function') return api.protectRecentCommittedData(value);
      return null;
    }

    function setLastUserEditAt(value) {
      if (typeof api.setLastUserEditAt === 'function') api.setLastUserEditAt(value);
    }

    function bumpUISessionLock() {
      if (typeof api.bumpUISessionLock === 'function') api.bumpUISessionLock();
    }

    function saveData(options = {}) {
      return typeof api.saveData === 'function' ? api.saveData(options) : null;
    }

    function saveSilent(options = {}) {
      return typeof api.saveSilent === 'function' ? api.saveSilent(options) : null;
    }

    function getCurrentTab() {
      return typeof api.getCurrentTab === 'function' ? api.getCurrentTab() : '';
    }

    function getTransferState(context = '', contextId = '', entryId = '') {
      const normalizedEntryId = String(entryId || '').trim();
      if (!normalizedEntryId) return { normalizedEntryId: '', transfer: null };
      const scope = getEditorFlashTransferScope(context, contextId);
      const transfer = scope?.byEntryId?.get?.(normalizedEntryId) || null;
      return { normalizedEntryId, transfer };
    }

    function getFlashThoughtsRef() {
      const dataRoot = getDataRoot();
      if (!dataRoot || typeof dataRoot !== 'object') return [];
      if (!Array.isArray(dataRoot.flashThoughts)) dataRoot.flashThoughts = [];
      return dataRoot.flashThoughts;
    }

    function buildTransferCommitPayload({
      actionType = '',
      promptQuestion = '',
      detail = {},
    } = {}) {
      return {
        changed: true,
        source: 'manual',
        promptQuestion,
        actions: [{ type: actionType, ...cloneJSONSafe(detail) }],
        actionTypes: [actionType],
        domains: ['thoughts'],
        appliedLabels: [promptQuestion],
        detail,
        saveMode: 'silent',
        skipUndo: true,
        recordMorphActionTransaction: typeof api.recordMorphActionTransaction === 'function' ? recordMorphActionTransaction : null,
        mergeSyncEntityRefs: typeof api.mergeMorphSyncEntityRefs === 'function' ? mergeMorphSyncEntityRefs : null,
        buildSyncEntityRefsFromCreatedItems: typeof api.buildMorphSyncEntityRefsFromCreatedItems === 'function'
          ? buildMorphSyncEntityRefsFromCreatedItems
          : null,
        protectRecentCommittedData: typeof api.protectRecentCommittedData === 'function' ? protectRecentCommittedData : null,
        setLastUserEditAt,
        bumpUISessionLock: typeof api.bumpUISessionLock === 'function' ? bumpUISessionLock : null,
        saveData: typeof api.saveData === 'function' ? saveData : null,
        saveSilent: typeof api.saveSilent === 'function' ? saveSilent : null,
        currentTab: getCurrentTab(),
      };
    }

    function restoreFlashThoughtFromEditorTransfer(context = '', contextId = '', entryId = '', options = {}) {
      const { normalizedEntryId, transfer } = getTransferState(context, contextId, entryId);
      if (!normalizedEntryId || !transfer || transfer.state !== 'moved') return false;
      const flashThoughts = getFlashThoughtsRef();
      const beforeFlashThoughts = cloneJSONSafe(Array.isArray(flashThoughts) ? flashThoughts : []);
      const beforeTransferState = String(transfer.state || '').trim();
      const restoreFallbackState = () => {
        const dataRoot = getDataRoot();
        if (dataRoot && typeof dataRoot === 'object') dataRoot.flashThoughts = cloneJSONSafe(beforeFlashThoughts);
        transfer.state = beforeTransferState || 'moved';
        requestDrawerRender();
      };
      const applyRestoreMutation = () => {
        const item = transfer.item && typeof transfer.item === 'object' ? cloneJSONSafe(transfer.item) : null;
        if (!item?.id) return false;
        const targetFlashThoughts = getFlashThoughtsRef();
        const exists = targetFlashThoughts.some((candidate) => String(candidate?.id || '') === String(item.id));
        if (!exists) targetFlashThoughts.unshift(item);
        transfer.state = 'restored';
        requestDrawerRender();
        return { changed: true, appliedLabel: '恢复编辑转移闪念' };
      };
      if (options?.persist === false) return !!applyRestoreMutation();
      const detail = {
        context: String(context || '').trim(),
        contextId: String(contextId || '').trim(),
        entryId: normalizedEntryId,
      };
      const applied = performMorphTransactionalMutation({
        source: 'manual',
        actionType: 'manual_restore_editor_transfer_flash_thought',
        promptQuestion: '恢复编辑转移闪念',
        domains: ['thoughts'],
        detail,
        saveMode: 'silent',
        saveOptions: { skipUndo: true, forceDebounce: true },
        mutation: applyRestoreMutation,
      });
      if (applied) return true;
      if (typeof api.commitMorphCoreMutation !== 'function') return false;
      const fallback = applyRestoreMutation();
      if (!fallback) return false;
      const committed = commitMorphCoreMutation(buildTransferCommitPayload({
        actionType: 'manual_restore_editor_transfer_flash_thought',
        promptQuestion: '恢复编辑转移闪念',
        detail,
      }));
      if (committed) return true;
      restoreFallbackState();
      return false;
    }

    function reapplyFlashThoughtFromEditorTransfer(context = '', contextId = '', entryId = '', options = {}) {
      const { normalizedEntryId, transfer } = getTransferState(context, contextId, entryId);
      if (!normalizedEntryId || !transfer || transfer.state !== 'restored') return false;
      const flashThoughts = getFlashThoughtsRef();
      const beforeFlashThoughts = cloneJSONSafe(Array.isArray(flashThoughts) ? flashThoughts : []);
      const beforeTransferState = String(transfer.state || '').trim();
      const restoreFallbackState = () => {
        const dataRoot = getDataRoot();
        if (dataRoot && typeof dataRoot === 'object') dataRoot.flashThoughts = cloneJSONSafe(beforeFlashThoughts);
        transfer.state = beforeTransferState || 'restored';
        requestDrawerRender();
      };
      const applyReapplyMutation = () => {
        const itemId = String(transfer.item?.id || '').trim();
        if (!itemId) return false;
        const targetFlashThoughts = getFlashThoughtsRef();
        const idx = targetFlashThoughts.findIndex((candidate) => String(candidate?.id || '') === itemId);
        if (idx >= 0) targetFlashThoughts.splice(idx, 1);
        transfer.state = 'moved';
        requestDrawerRender();
        return { changed: true, appliedLabel: '重做编辑转移闪念' };
      };
      if (options?.persist === false) return !!applyReapplyMutation();
      const detail = {
        context: String(context || '').trim(),
        contextId: String(contextId || '').trim(),
        entryId: normalizedEntryId,
      };
      const applied = performMorphTransactionalMutation({
        source: 'manual',
        actionType: 'manual_reapply_editor_transfer_flash_thought',
        promptQuestion: '重做编辑转移闪念',
        domains: ['thoughts'],
        detail,
        saveMode: 'silent',
        saveOptions: { skipUndo: true, forceDebounce: true },
        mutation: applyReapplyMutation,
      });
      if (applied) return true;
      if (typeof api.commitMorphCoreMutation !== 'function') return false;
      const fallback = applyReapplyMutation();
      if (!fallback) return false;
      const committed = commitMorphCoreMutation(buildTransferCommitPayload({
        actionType: 'manual_reapply_editor_transfer_flash_thought',
        promptQuestion: '重做编辑转移闪念',
        detail,
      }));
      if (committed) return true;
      restoreFallbackState();
      return false;
    }

    return {
      restoreFlashThoughtFromEditorTransfer,
      reapplyFlashThoughtFromEditorTransfer,
    };
  }

  window.MorphEditorFlashTransferRuntime = {
    create: createEditorFlashTransferRuntime,
  };
})();
