// @ts-check

(function initMorphAIActionTraceRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionTraceRuntime && typeof window.MorphAIActionTraceRuntime.create === 'function') return;

  function createAIActionTraceRuntime() {
    function buildActionSkillTraceMeta(actionType = '') {
      const runtime = typeof window !== 'undefined'
        && window.MorphAIActionSkillRuntime
        && typeof window.MorphAIActionSkillRuntime.create === 'function'
        ? window.MorphAIActionSkillRuntime.create()
        : null;
      const descriptor = runtime && typeof runtime.getMorphSkillDescriptorForActionType === 'function'
        ? runtime.getMorphSkillDescriptorForActionType(actionType)
        : null;
      return descriptor && typeof descriptor === 'object'
        ? {
          skillId: String(descriptor.skillId || '').trim(),
          skillLabel: String(descriptor.skillLabel || '').trim(),
        }
        : {};
    }

    function buildBlockedVerificationTraceEntry(context = {}, helpers = {}) {
      const sanitizeVerifier = typeof helpers.sanitizeVerifier === 'function' ? helpers.sanitizeVerifier : (value) => value;
      return {
        type: String(context.actionType || '').trim(),
        ...buildActionSkillTraceMeta(context.actionType),
        status: 'blocked_verification',
        verifierStatus: 'failed',
        message: context.verification?.userMessage || '',
        requestId: String(context.action?.requestId || context.actionCandidate?.requestId || '').trim(),
        entity: context.verification?.entity || context.normalization?.entity || '',
        entityId: context.verification?.entityId || '',
        targetDate: context.verification?.targetDate || context.normalization?.targetDate || '',
        candidate: context.actionCandidate || {},
        normalizedPayload: context.normalization?.normalizedPayload || {},
        boundary: context.baseBoundary || null,
        verifier: sanitizeVerifier(context.verification || { ok: true }),
        promptQuestion: String(context.promptQuestion || '').trim(),
        transactionId: '',
      };
    }

    function buildNeedsConfirmationTraceEntry(context = {}) {
      return {
        type: String(context.actionType || '').trim(),
        ...buildActionSkillTraceMeta(context.actionType),
        status: 'needs_confirmation',
        verifierStatus: 'not_run',
        message: String(context.postcheck?.blockedReason || '').trim(),
        requestId: String(context.action?.requestId || context.actionCandidate?.requestId || '').trim(),
        entity: context.normalization?.entity || '',
        targetDate: context.normalization?.targetDate || '',
        candidate: context.actionCandidate || {},
        normalizedPayload: context.normalization?.normalizedPayload || {},
        boundary: context.baseBoundary || null,
        promptQuestion: String(context.promptQuestion || '').trim(),
        transactionId: '',
        hydratedFields: Array.isArray(context.hydratedFields) ? context.hydratedFields : [],
      };
    }

    function resolveMutationTraceStatus(context = {}) {
      if (context.transactionCommitted === false) {
        const mutationLayer = String(context.mutationLayer || '').trim().toLowerCase();
        return mutationLayer === 'draft' ? 'draft_applied' : 'applied_local';
      }
      return 'committed';
    }

    function buildCommittedTraceEntry(context = {}, helpers = {}) {
      const sanitizeVerifier = typeof helpers.sanitizeVerifier === 'function' ? helpers.sanitizeVerifier : (value) => value;
      const mutationLayer = String(context.mutationLayer || '').trim().toLowerCase() || 'canonical';
      const transactionCommitted = context.transactionCommitted !== false;
      return {
        type: String(context.actionType || '').trim(),
        ...buildActionSkillTraceMeta(context.actionType),
        status: resolveMutationTraceStatus({ mutationLayer, transactionCommitted }),
        verifierStatus: 'verified',
        message: '',
        requestId: String(context.action?.requestId || context.actionCandidate?.requestId || '').trim(),
        entity: context.actionReceipt?.entity || context.verification?.entity || context.normalization?.entity || '',
        entityId: context.actionReceipt?.entityId || context.verification?.entityId || '',
        targetDate: context.actionReceipt?.targetDate || context.verification?.targetDate || context.normalization?.targetDate || '',
        candidate: context.actionCandidate || {},
        normalizedPayload: context.normalization?.normalizedPayload || {},
        boundary: context.baseBoundary || null,
        verifier: sanitizeVerifier(context.verification || { ok: true }),
        receipt: context.actionReceipt && typeof context.actionReceipt === 'object' ? context.actionReceipt : null,
        promptQuestion: String(context.promptQuestion || '').trim(),
        transactionId: '',
        mutationLayer,
        transactionCommitted,
        hydratedFields: Array.isArray(context.hydratedFields) ? context.hydratedFields : [],
      };
    }

    return {
      buildBlockedVerificationTraceEntry,
      buildNeedsConfirmationTraceEntry,
      buildCommittedTraceEntry,
    };
  }

  window.MorphAIActionTraceRuntime = {
    create: createAIActionTraceRuntime,
  };
})();
