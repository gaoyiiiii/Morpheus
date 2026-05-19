(function initMorphDetailRefineRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphDetailRefineRuntime && typeof window.MorphDetailRefineRuntime.create === 'function') return;

  function createDetailRefineRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getDocumentRef() {
      return typeof api.getDocumentRef === 'function' ? api.getDocumentRef() : document;
    }

    function getCurrentDetailItem() {
      return typeof api.getCurrentDetailItem === 'function' ? api.getCurrentDetailItem() : null;
    }

    function getCurrentDetailMeta() {
      return typeof api.getCurrentDetailMeta === 'function' ? api.getCurrentDetailMeta() : null;
    }

    function getDetailPreRefineState() {
      return typeof api.getDetailPreRefineState === 'function' ? api.getDetailPreRefineState() : null;
    }

    function setDetailPreRefineState(value) {
      if (typeof api.setDetailPreRefineState === 'function') api.setDetailPreRefineState(value);
    }

    function getDataRoot() {
      return typeof api.getDataRoot === 'function' ? api.getDataRoot() : null;
    }

    function getCurrentTab() {
      return typeof api.getCurrentTab === 'function' ? String(api.getCurrentTab() || '').trim() : '';
    }

    function cloneJSONSafe(value) {
      if (typeof api.cloneJSONSafe === 'function') return api.cloneJSONSafe(value);
      if (value === undefined) return undefined;
      return JSON.parse(JSON.stringify(value));
    }

    function hydrateRichLinkNodes(editor) {
      if (typeof api.hydrateRichLinkNodes === 'function') api.hydrateRichLinkNodes(editor);
    }

    function getDetailPersistDomains(options = {}) {
      return typeof api.getDetailPersistDomains === 'function' ? api.getDetailPersistDomains(options) : [];
    }

    function captureMorphActionTransactionDomain(domain = '', dataRoot = null) {
      return typeof api.captureMorphActionTransactionDomain === 'function'
        ? api.captureMorphActionTransactionDomain(domain, dataRoot)
        : null;
    }

    function performMorphTransactionalMutation(options = {}) {
      return typeof api.performMorphTransactionalMutation === 'function'
        ? api.performMorphTransactionalMutation(options)
        : false;
    }

    async function performMorphTransactionalMutationAsync(options = {}) {
      return typeof api.performMorphTransactionalMutationAsync === 'function'
        ? api.performMorphTransactionalMutationAsync(options)
        : false;
    }

    function commitMorphCoreMutation(options = {}) {
      return typeof api.commitMorphCoreMutation === 'function'
        ? api.commitMorphCoreMutation(options)
        : null;
    }

    function saveData(options = {}) {
      return typeof api.saveData === 'function' ? api.saveData(options) : null;
    }

    function requestAIText(prompt = '', options = {}) {
      return typeof api.requestAIText === 'function' ? api.requestAIText(prompt, options) : Promise.resolve('');
    }

    function parseTextToRichHTML(text = '') {
      return typeof api.parseTextToRichHTML === 'function' ? api.parseTextToRichHTML(text) : String(text || '');
    }

    function extractPlainTextFromRich(editor) {
      return typeof api.extractPlainTextFromRich === 'function' ? api.extractPlainTextFromRich(editor) : '';
    }

    function getCurrentAIKey() {
      return typeof api.getCurrentAIKey === 'function' ? api.getCurrentAIKey() : '';
    }

    function getAIProviderDisplayLabel() {
      return typeof api.getAIProviderDisplayLabel === 'function' ? api.getAIProviderDisplayLabel() : 'AI';
    }

    function openCustomModal(options = {}) {
      if (typeof api.openCustomModal === 'function') api.openCustomModal(options);
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

    function trimText(value = '') {
      return String(value || '').trim();
    }

    function buildDetailPayload() {
      const meta = getCurrentDetailMeta();
      const item = getCurrentDetailItem();
      return {
        kind: trimText(meta?.kind),
        contextType: trimText(meta?.contextType),
        itemId: trimText(item?.id),
      };
    }

    function buildBeforeDomains(persistDomains = []) {
      const dataRoot = getDataRoot();
      if (!Array.isArray(persistDomains) || !persistDomains.length) return {};
      return Object.fromEntries(
        persistDomains.map((domain) => [domain, captureMorphActionTransactionDomain(domain, dataRoot)]),
      );
    }

    function hasCanonicalCommitRequirement(persistDomains = []) {
      const enforcedCanonicalDomains = new Set(['daily', 'thoughts', 'projects', 'expenseLedger', 'reminders', 'aiMemory', 'aiMemoryFull']);
      return persistDomains.some((domain) => enforcedCanonicalDomains.has(trimText(domain)));
    }

    function restoreObjectState(target, snapshot) {
      if (!target || !snapshot || typeof target !== 'object' || typeof snapshot !== 'object') return;
      Object.keys(target).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(snapshot, key)) delete target[key];
      });
      Object.keys(snapshot).forEach((key) => {
        target[key] = cloneJSONSafe(snapshot[key]);
      });
    }

    function buildCommitPayload({
      actionType = '',
      promptQuestion = '',
      persistDomains = [],
      beforeDomains = {},
      detail = {},
    } = {}) {
      return {
        changed: true,
        source: 'manual',
        promptQuestion,
        actions: [{ type: actionType, ...cloneJSONSafe(detail) }],
        actionTypes: [actionType],
        domains: persistDomains,
        beforeDomains,
        appliedLabels: [promptQuestion],
        detail,
        saveMode: 'data',
        recordMorphActionTransaction: typeof api.recordMorphActionTransaction === 'function' ? recordMorphActionTransaction : null,
        mergeSyncEntityRefs: typeof api.mergeMorphSyncEntityRefs === 'function' ? mergeMorphSyncEntityRefs : null,
        buildSyncEntityRefsFromCreatedItems: typeof api.buildMorphSyncEntityRefsFromCreatedItems === 'function' ? buildMorphSyncEntityRefsFromCreatedItems : null,
        protectRecentCommittedData: typeof api.protectRecentCommittedData === 'function' ? protectRecentCommittedData : null,
        setLastUserEditAt,
        bumpUISessionLock: typeof api.bumpUISessionLock === 'function' ? bumpUISessionLock : null,
        saveData: typeof api.saveData === 'function' ? saveData : null,
        currentTab: getCurrentTab(),
      };
    }

    function updateDetailRefineButtonUI() {
      const documentRef = getDocumentRef();
      const refineBtn = documentRef && typeof documentRef.getElementById === 'function'
        ? documentRef.getElementById('detail-refine-btn')
        : null;
      if (!refineBtn) return false;
      if (getDetailPreRefineState()) {
        refineBtn.textContent = '撤销';
        refineBtn.onclick = undoDetailRefine;
      } else {
        refineBtn.textContent = '优化';
        refineBtn.onclick = runDetailRefineWithAI;
      }
      return true;
    }

    function undoDetailRefine() {
      const detailPreRefineState = getDetailPreRefineState();
      const currentDetailItem = getCurrentDetailItem();
      const currentDetailMeta = getCurrentDetailMeta();
      if (!detailPreRefineState || !currentDetailItem) return false;
      const documentRef = getDocumentRef();
      const editor = documentRef && typeof documentRef.getElementById === 'function'
        ? documentRef.getElementById('detail-editor-rich')
        : null;
      if (!editor) return false;

      const persistDomains = getDetailPersistDomains({ meta: currentDetailMeta, item: currentDetailItem, commit: false });
      const requiresCanonicalCommit = hasCanonicalCommitRequirement(persistDomains);
      const detail = buildDetailPayload();
      const beforeDomains = buildBeforeDomains(persistDomains);
      const beforeItemSnapshot = cloneJSONSafe(currentDetailItem);
      const beforeEditorHtml = editor.innerHTML;
      const beforeRefineSnapshot = detailPreRefineState ? cloneJSONSafe(detailPreRefineState) : null;

      const restoreFallbackState = () => {
        restoreObjectState(currentDetailItem, beforeItemSnapshot);
        editor.innerHTML = String(beforeEditorHtml || '');
        hydrateRichLinkNodes(editor);
        setDetailPreRefineState(beforeRefineSnapshot ? cloneJSONSafe(beforeRefineSnapshot) : null);
        updateDetailRefineButtonUI();
      };

      const applyUndoMutation = () => {
        const currentPreRefineState = getDetailPreRefineState();
        if (!currentPreRefineState) return false;
        editor.innerHTML = currentPreRefineState.html;
        hydrateRichLinkNodes(editor);
        currentDetailItem.text = currentPreRefineState.text;
        currentDetailItem.html = currentPreRefineState.html;
        setDetailPreRefineState(null);
        return {
          changed: true,
          appliedLabel: '手动撤销详情优化',
        };
      };

      const applied = performMorphTransactionalMutation({
        source: 'manual',
        actionType: 'manual_undo_detail_refine',
        promptQuestion: '手动撤销详情优化',
        domains: persistDomains,
        detail,
        mutation: applyUndoMutation,
      });

      if (!applied) {
        if (requiresCanonicalCommit && typeof api.commitMorphCoreMutation !== 'function') return false;
        const fallback = applyUndoMutation();
        if (!fallback) return false;
        const committed = commitMorphCoreMutation(buildCommitPayload({
          actionType: 'manual_undo_detail_refine',
          promptQuestion: '手动撤销详情优化',
          persistDomains,
          beforeDomains,
          detail,
        }));
        if (!committed) {
          if (requiresCanonicalCommit) {
            restoreFallbackState();
            return false;
          }
          saveData({ domains: persistDomains });
        }
      }

      updateDetailRefineButtonUI();
      return true;
    }

    async function runDetailRefineWithAI() {
      const currentDetailItem = getCurrentDetailItem();
      const currentDetailMeta = getCurrentDetailMeta();
      if (!currentDetailItem) return false;
      const kind = trimText(currentDetailMeta?.kind);
      const contextType = trimText(currentDetailMeta?.contextType);
      const canRefine = kind === 'flashThoughts' || kind === 'fixed' || (kind === 'context-fragment' && contextType === 'project');
      if (!canRefine) return false;
      if (!getCurrentAIKey()) {
        openCustomModal({
          title: '未配置 AI 密钥',
          desc: `请先在设置中填写 ${getAIProviderDisplayLabel()} API Key。`,
        });
        return false;
      }
      const documentRef = getDocumentRef();
      const editor = documentRef && typeof documentRef.getElementById === 'function'
        ? documentRef.getElementById('detail-editor-rich')
        : null;
      if (!editor) return false;

      const rawText = trimText(extractPlainTextFromRich(editor));
      if (!rawText) {
        openCustomModal({ title: '内容为空', desc: '请先输入或粘贴需要优化的内容。' });
        return false;
      }

      const refineBtn = documentRef && typeof documentRef.getElementById === 'function'
        ? documentRef.getElementById('detail-refine-btn')
        : null;
      if (refineBtn) {
        refineBtn.disabled = true;
        refineBtn.textContent = '优化中...';
      }

      try {
        const persistDomains = getDetailPersistDomains({ meta: currentDetailMeta, item: currentDetailItem, commit: false });
        const requiresCanonicalCommit = hasCanonicalCommitRequirement(persistDomains);
        const detail = buildDetailPayload();
        const prompt = `请将以下内容整理：提升易读性、逻辑与错别字，只输出整理后的正文，不要解释、不要加标题。\n\n${rawText}`;
        const beforeDomains = buildBeforeDomains(persistDomains);
        const beforeItemSnapshot = cloneJSONSafe(currentDetailItem);
        const beforeEditorHtml = editor.innerHTML;
        const beforeRefineSnapshot = getDetailPreRefineState() ? cloneJSONSafe(getDetailPreRefineState()) : null;

        const restoreFallbackState = () => {
          restoreObjectState(currentDetailItem, beforeItemSnapshot);
          editor.innerHTML = String(beforeEditorHtml || '');
          hydrateRichLinkNodes(editor);
          setDetailPreRefineState(beforeRefineSnapshot ? cloneJSONSafe(beforeRefineSnapshot) : null);
          updateDetailRefineButtonUI();
        };

        const applyRefineMutation = async () => {
          let result = await requestAIText(prompt, { stream: false });
          result = trimText(result);
          if (!result) throw new Error('AI 未返回内容');
          const savedText = rawText;
          const savedHtml = editor.innerHTML;
          editor.innerHTML = parseTextToRichHTML(result);
          hydrateRichLinkNodes(editor);
          currentDetailItem.text = result;
          currentDetailItem.html = editor.innerHTML;
          setDetailPreRefineState({ text: savedText, html: savedHtml });
          return {
            changed: true,
            appliedLabel: '手动优化详情正文',
          };
        };

        const applied = await performMorphTransactionalMutationAsync({
          source: 'manual',
          actionType: 'manual_refine_detail_with_ai',
          promptQuestion: '手动优化详情正文',
          domains: persistDomains,
          detail,
          mutation: applyRefineMutation,
        });

        if (!applied) {
          if (requiresCanonicalCommit && typeof api.commitMorphCoreMutation !== 'function') return false;
          const fallback = await applyRefineMutation();
          if (!fallback) return false;
          const committed = commitMorphCoreMutation(buildCommitPayload({
            actionType: 'manual_refine_detail_with_ai',
            promptQuestion: '手动优化详情正文',
            persistDomains,
            beforeDomains,
            detail,
          }));
          if (!committed) {
            if (requiresCanonicalCommit) {
              restoreFallbackState();
              return false;
            }
            saveData({ domains: persistDomains });
          }
        }

        updateDetailRefineButtonUI();
        return true;
      } catch (err) {
        openCustomModal({
          title: '优化失败',
          desc: err && err.message ? err.message : '请检查网络与 API 密钥后重试。',
        });
        return false;
      } finally {
        if (refineBtn) {
          refineBtn.disabled = false;
          if (!getDetailPreRefineState()) refineBtn.textContent = '优化';
        }
      }
    }

    return {
      updateDetailRefineButtonUI,
      undoDetailRefine,
      runDetailRefineWithAI,
    };
  }

  window.MorphDetailRefineRuntime = {
    create: createDetailRefineRuntime,
  };
})();
