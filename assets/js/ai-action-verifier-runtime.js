// @ts-check

(function initMorphAIActionVerifierRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionVerifierRuntime && typeof window.MorphAIActionVerifierRuntime.create === 'function') return;

  function createAIActionVerifierRuntime() {
    function verifyStructuredActionOutcome(type = '', action = {}, runtime = {}, deps = {}) {
      const runtimeModules = deps.runtimeModules && typeof deps.runtimeModules === 'object' ? deps.runtimeModules : null;
      if (runtimeModules && typeof runtimeModules.verifyStructuredActionOutcome === 'function') {
        return runtimeModules.verifyStructuredActionOutcome(type, action, runtime);
      }
      return { ok: true };
    }

    function buildActionReceiptFromVerification(type = '', action = {}, verification = {}, runtime = {}, deps = {}) {
      const buildMorphActionReceiptFromVerification = typeof deps.buildMorphActionReceiptFromVerification === 'function'
        ? deps.buildMorphActionReceiptFromVerification
        : null;
      if (buildMorphActionReceiptFromVerification) {
        return buildMorphActionReceiptFromVerification(type, action, verification, runtime);
      }
      const sanitizeReceipt = typeof deps.sanitizeReceipt === 'function'
        ? deps.sanitizeReceipt
        : ((value = null) => (value && typeof value === 'object' ? { ...value } : {}));
      const shouldRecordMorphActionTransactionAction = typeof deps.shouldRecordMorphActionTransactionAction === 'function'
        ? deps.shouldRecordMorphActionTransactionAction
        : () => true;
      const result = runtime && typeof runtime === 'object' && runtime.actionResult && typeof runtime.actionResult === 'object'
        ? runtime.actionResult
        : {};
      return sanitizeReceipt({
        ok: verification?.ok !== false,
        action: type,
        summary: String(runtime?.summary || '').trim() || String(type || '').trim(),
        verifierStatus: verification?.ok === false ? 'failed' : 'verified',
        entity: String(verification?.entity || (/daily_log/.test(String(type || '')) ? 'daily_log_entry' : '')).trim(),
        entityId: String(verification?.entityId || '').trim() || String(result.blockIds?.[0] || result.dateStr || '').trim(),
        status: String(verification?.status || result.status || '').trim(),
        oldStatus: String(verification?.oldStatus || result.oldStatus || '').trim(),
        newStatus: String(verification?.newStatus || result.newStatus || '').trim(),
        targetDate: String(verification?.targetDate || result.dateStr || action?.date || action?.dateStr || '').trim(),
        updatedAt: String(verification?.updatedAt || result.updatedAt || new Date().toISOString()).trim(),
        undoAvailable: !!String(runtime?.transactionHandle || runtime?.transactionId || '').trim() || runtime?.transactionRecorded === true,
        transactionHandle: '',
        blockIds: Array.isArray(verification?.blockIds) ? verification.blockIds : (Array.isArray(result.blockIds) ? result.blockIds : []),
      });
    }

    return {
      verifyStructuredActionOutcome,
      buildActionReceiptFromVerification,
    };
  }

  window.MorphAIActionVerifierRuntime = {
    create: createAIActionVerifierRuntime,
  };
})();
