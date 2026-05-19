// @ts-check

(function initMorphAIActionPrecheckRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionPrecheckRuntime && typeof window.MorphAIActionPrecheckRuntime.create === 'function') return;

  function createAIActionPrecheckRuntime() {
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

    function evaluateActionNormalizationAndValidation(options = {}) {
      const actionType = String(options.actionType || '').trim();
      const actionCandidate = options.actionCandidate && typeof options.actionCandidate === 'object'
        ? options.actionCandidate
        : {};
      const baseBoundary = options.baseBoundary && typeof options.baseBoundary === 'object'
        ? options.baseBoundary
        : {};
      const promptQuestion = String(options.promptQuestion || '').trim();
      const hydratedFields = Array.isArray(options.hydratedFields) ? options.hydratedFields : [];
      const normalizeAction = typeof options.normalizeAction === 'function' ? options.normalizeAction : null;
      const validateAction = typeof options.validateAction === 'function' ? options.validateAction : null;
      const buildStructuredConfirmationReason = typeof options.buildStructuredConfirmationReason === 'function'
        ? options.buildStructuredConfirmationReason
        : () => '';
      const exposeRawActionFailures = options.exposeRawActionFailures === true;

      let action = options.action && typeof options.action === 'object' ? options.action : {};
      if (typeof normalizeAction !== 'function' || typeof validateAction !== 'function') {
        return { status: 'ok', action, normalization: { entity: '', targetDate: '', normalizedPayload: {} } };
      }

      const normalization = normalizeAction(actionType, action, {
        promptQuestion,
        source: String(options.source || 'ai').trim() || 'ai',
      });

      if (!normalization?.ok) {
        return {
          status: 'blocked_normalization',
          blockedLabel: `动作标准化失败：${actionType}`,
          blockedReason: exposeRawActionFailures
            ? String(normalization?.debugMessage || normalization?.userMessage || '').trim()
            : (normalization?.userMessage || '这次动作在标准化阶段没有通过，我先没有继续执行。'),
          traceEntry: {
            type: actionType,
            ...buildActionSkillTraceMeta(actionType),
            status: 'blocked_normalization',
            reasonCode: String(normalization?.reasonCode || '').trim(),
            verifierStatus: 'not_run',
            message: normalization?.debugMessage || normalization?.userMessage || '',
            requestId: String(actionCandidate?.requestId || '').trim(),
            entity: normalization?.entity || '',
            targetDate: normalization?.targetDate || '',
            candidate: actionCandidate,
            normalizedPayload: normalization?.normalizedPayload || {},
            boundary: baseBoundary,
            promptQuestion,
            transactionId: '',
            hydratedFields,
          },
        };
      }

      action = normalization.action && typeof normalization.action === 'object' ? normalization.action : action;
      const validation = validateAction(actionType, action);
      if (validation?.ok) {
        return {
          status: 'ok',
          action,
          normalization,
        };
      }

      const confirmationReason = buildStructuredConfirmationReason(actionType, action);
      if (confirmationReason) {
        return {
          status: 'needs_confirmation',
          blockedLabel: `目标待确认：${actionType}`,
          blockedReason: confirmationReason,
          traceEntry: {
            type: actionType,
            ...buildActionSkillTraceMeta(actionType),
            status: 'needs_confirmation',
            verifierStatus: 'not_run',
            message: confirmationReason,
            requestId: String(action?.requestId || actionCandidate?.requestId || '').trim(),
            entity: normalization?.entity || '',
            targetDate: normalization?.targetDate || '',
            candidate: actionCandidate,
            normalizedPayload: normalization?.normalizedPayload || {},
            boundary: baseBoundary,
            promptQuestion,
            transactionId: '',
            hydratedFields,
          },
        };
      }

      return {
        status: 'blocked_validation',
        blockedLabel: `动作参数校验失败：${actionType}`,
        blockedReason: String(validation?.userMessage || '').trim(),
        traceEntry: {
          type: actionType,
          ...buildActionSkillTraceMeta(actionType),
          status: 'blocked_validation',
          verifierStatus: 'not_run',
          message: validation?.userMessage || '',
          requestId: String(action?.requestId || actionCandidate?.requestId || '').trim(),
          entity: normalization?.entity || '',
          targetDate: normalization?.targetDate || '',
          candidate: actionCandidate,
          normalizedPayload: normalization?.normalizedPayload || {},
          boundary: baseBoundary,
          promptQuestion,
          transactionId: '',
          hydratedFields,
        },
      };
    }

    return {
      evaluateActionNormalizationAndValidation,
    };
  }

  window.MorphAIActionPrecheckRuntime = {
    create: createAIActionPrecheckRuntime,
  };
})();
