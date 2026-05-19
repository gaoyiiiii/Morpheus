// @ts-check

(function initMorphAIActionPostcheckRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionPostcheckRuntime && typeof window.MorphAIActionPostcheckRuntime.create === 'function') return;

  function createAIActionPostcheckRuntime() {
    function evaluateActionPostcheck(options = {}) {
      const actionProducedMutation = options.actionProducedMutation === true;
      const actionType = String(options.actionType || '').trim();
      const action = options.action && typeof options.action === 'object' ? options.action : {};
      const actionRuntimeMeta = options.actionRuntimeMeta && typeof options.actionRuntimeMeta === 'object' ? options.actionRuntimeMeta : null;
      const createdItems = Array.isArray(options.createdItems) ? options.createdItems : [];
      const appliedLabels = Array.isArray(options.appliedLabels) ? options.appliedLabels : [];
      const beforeCreatedCount = Number.isFinite(Number(options.beforeCreatedCount)) ? Number(options.beforeCreatedCount) : 0;
      const beforeAppliedCount = Number.isFinite(Number(options.beforeAppliedCount)) ? Number(options.beforeAppliedCount) : 0;
      const verifyStructuredActionOutcome = typeof options.verifyStructuredActionOutcome === 'function'
        ? options.verifyStructuredActionOutcome
        : () => ({ ok: true });
      const buildActionReceiptFromVerification = typeof options.buildActionReceiptFromVerification === 'function'
        ? options.buildActionReceiptFromVerification
        : () => null;
      const actionPolicy = options.actionPolicy && typeof options.actionPolicy === 'object' ? options.actionPolicy : {};
      const buildStructuredConfirmationReason = typeof options.buildStructuredConfirmationReason === 'function'
        ? options.buildStructuredConfirmationReason
        : () => '';

      const result = {
        status: 'ok',
        verification: { ok: true },
        actionReceipt: null,
        blockedReason: '',
      };

      if (actionProducedMutation) {
        result.verification = verifyStructuredActionOutcome(actionType, action, {
          createdItemsDelta: createdItems.slice(beforeCreatedCount),
          appliedLabelsDelta: appliedLabels.slice(beforeAppliedCount),
          actionResult: actionRuntimeMeta?.actionResult || null,
        });
        if (!result.verification?.ok) {
          result.status = 'blocked_verification';
          result.blockedReason = String(result.verification?.userMessage || '').trim() || '这次动作没有通过执行验证，我先没有把它当作成功写入。';
          return result;
        }
        result.actionReceipt = buildActionReceiptFromVerification(actionType, action, result.verification, {
          actionResult: actionRuntimeMeta?.actionResult || null,
          summary: String(appliedLabels[beforeAppliedCount] || appliedLabels[appliedLabels.length - 1] || actionType).trim(),
        });
        return result;
      }

      if (String(actionPolicy?.consentTier || '').trim() === 'architect-required') {
        const confirmationReason = String(buildStructuredConfirmationReason(actionType, action) || '').trim();
        if (confirmationReason) {
          result.status = 'needs_confirmation';
          result.blockedReason = confirmationReason;
          return result;
        }
      }
      return result;
    }

    return {
      evaluateActionPostcheck,
    };
  }

  window.MorphAIActionPostcheckRuntime = {
    create: createAIActionPostcheckRuntime,
  };
})();
