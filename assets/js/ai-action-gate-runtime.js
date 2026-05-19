// @ts-check

(function initMorphAIActionGateRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionGateRuntime && typeof window.MorphAIActionGateRuntime.create === 'function') return;

  function createAIActionGateRuntime() {
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

    function matchesActionIntent(type = '', options = {}) {
      const permissionRuntime = options.permissionRuntime && typeof options.permissionRuntime === 'object'
        ? options.permissionRuntime
        : null;
      if (permissionRuntime && typeof permissionRuntime.matchesMorphActionIntent === 'function') {
        return permissionRuntime.matchesMorphActionIntent(type, {
          promptQuestion: options.promptQuestion,
          explicitWriteIntent: options.explicitWriteIntent,
          explicitMemoryWriteIntent: options.explicitMemoryWriteIntent,
          implicitMemoryWriteIntent: options.implicitMemoryWriteIntent,
          explicitRuntimeWriteIntent: options.explicitRuntimeWriteIntent,
          hasPendingDataIntent: options.hasPendingDataIntent,
          terseExpenseCaptureIntent: options.terseExpenseCaptureIntent,
        });
      }
      const actionType = String(type || '').trim();
      if (!actionType) return false;
      return options.explicitWriteIntent === true;
    }

    function evaluateActionCommitGate(options = {}) {
      const actionType = String(options.actionType || '').trim();
      const action = options.action && typeof options.action === 'object' ? options.action : {};
      const actionPolicy = options.actionPolicy && typeof options.actionPolicy === 'object' ? options.actionPolicy : {};
      const actionCandidate = options.actionCandidate && typeof options.actionCandidate === 'object' ? options.actionCandidate : {};
      const promptQuestion = String(options.promptQuestion || '').trim();
      const hydratedFields = Array.isArray(options.hydratedFields) ? options.hydratedFields : [];
      const exposeRawActionFailures = options.exposeRawActionFailures === true;
      const permissionRuntime = options.permissionRuntime && typeof options.permissionRuntime === 'object'
        ? options.permissionRuntime
        : null;
      const buildActionBoundary = typeof options.buildActionBoundary === 'function'
        ? options.buildActionBoundary
        : () => ({});
      const buildMorphDevActionVisibleMessage = typeof options.buildMorphDevActionVisibleMessage === 'function'
        ? options.buildMorphDevActionVisibleMessage
        : null;

      if (String(actionPolicy.permissionLevel || '').trim() === 'read') {
        return { status: 'ok', commitDecision: { allowed: true, reasonCode: '' } };
      }

      const commitDecision = permissionRuntime && typeof permissionRuntime.getMorphActionCommitDecision === 'function'
        ? permissionRuntime.getMorphActionCommitDecision(actionType, action, {
          promptQuestion,
          dominantMode: options.dominantMode,
          actionBias: options.actionBias,
          explicitWriteIntent: options.explicitWriteIntent,
          explicitMemoryWriteIntent: options.explicitMemoryWriteIntent,
          implicitMemoryWriteIntent: options.implicitMemoryWriteIntent,
          explicitRuntimeWriteIntent: options.explicitRuntimeWriteIntent,
          strongDataOperationIntent: options.strongDataOperationIntent,
          hasPendingDataIntent: options.hasPendingDataIntent,
          followupExecutionConfirmation: options.followupExecutionConfirmation,
          terseExpenseCaptureIntent: options.terseExpenseCaptureIntent,
          allowMorphDataActions: options.allowMorphDataActions === true,
        })
        : { allowed: matchesActionIntent(actionType, options), reasonCode: '' };

      if (commitDecision?.allowed) {
        return { status: 'ok', commitDecision };
      }

      const reasonCode = String(commitDecision?.reasonCode || 'intent-threshold-not-met').trim() || 'intent-threshold-not-met';
      const message = exposeRawActionFailures && typeof buildMorphDevActionVisibleMessage === 'function'
        ? buildMorphDevActionVisibleMessage('blocked_boundary', actionType, 'intent-threshold-not-met')
        : '这次先不自动写入；你再用平常话补一句要做什么即可。';

      return {
        status: 'blocked_commit',
        blockedLabel: `暂未执行：${actionType}`,
        blockedReason: String(message || '').trim(),
        commitDecision,
        traceEntry: {
          type: actionType,
          ...buildActionSkillTraceMeta(actionType),
          status: 'blocked_boundary',
          reasonCode,
          verifierStatus: 'not_run',
          message,
          requestId: String(actionCandidate.requestId || '').trim(),
          candidate: actionCandidate,
          boundary: buildActionBoundary(actionType, actionPolicy, { allowed: false, reason: 'intent-threshold-not-met' }),
          promptQuestion,
          transactionId: '',
          hydratedFields,
        },
      };
    }

    function buildBlockedReason(options = {}) {
      const actionExecutionTrace = Array.isArray(options.actionExecutionTrace) ? options.actionExecutionTrace : [];
      const blockedLabels = Array.isArray(options.blockedLabels) ? options.blockedLabels : [];
      const currentBlockedReason = String(options.blockedReason || '').trim();
      const dominantMode = String(options.dominantMode || '').trim();
      const actionBias = String(options.actionBias || '').trim();
      const exposeRawActionFailures = options.exposeRawActionFailures === true;
      const buildMorphDevActionVisibleMessage = typeof options.buildMorphDevActionVisibleMessage === 'function'
        ? options.buildMorphDevActionVisibleMessage
        : null;

      const firstConcreteTraceMessage = actionExecutionTrace.find((entry) => (
        /blocked_|needs_confirmation/.test(String(entry?.status || '')) &&
        String(entry?.message || '').trim()
      ));
      if (firstConcreteTraceMessage) {
        if (exposeRawActionFailures && typeof buildMorphDevActionVisibleMessage === 'function') {
          return buildMorphDevActionVisibleMessage(
            String(firstConcreteTraceMessage.status || '').trim(),
            String(firstConcreteTraceMessage.type || '').trim(),
            String(firstConcreteTraceMessage.reasonCode || firstConcreteTraceMessage.message || '').trim(),
            {
              entity: firstConcreteTraceMessage.entity,
              targetDate: firstConcreteTraceMessage.targetDate,
              requestId: firstConcreteTraceMessage.requestId,
            },
            String(firstConcreteTraceMessage.message || '').trim(),
          );
        }
        return String(firstConcreteTraceMessage.message || '').trim();
      }
      if (currentBlockedReason) return currentBlockedReason;

      if (blockedLabels.some((label) => /默认禁用/.test(label))) {
        return exposeRawActionFailures && typeof buildMorphDevActionVisibleMessage === 'function'
          ? buildMorphDevActionVisibleMessage('blocked_boundary', 'action', 'disabled-by-policy')
          : '这个动作暂时不能直接执行。需要的话我们再走确认流程。';
      }
      if (blockedLabels.some((label) => /运行时|记忆/.test(label))) {
        return exposeRawActionFailures && typeof buildMorphDevActionVisibleMessage === 'function'
          ? buildMorphDevActionVisibleMessage('blocked_boundary', 'memory_write_user', 'requires_explicit_target')
          : '长期记忆和运行规则这边需要先对齐目标。你再说一下要改哪一段即可。';
      }
      if (dominantMode === 'oracle' && actionBias === 'hold-space') {
        return exposeRawActionFailures && typeof buildMorphDevActionVisibleMessage === 'function'
          ? buildMorphDevActionVisibleMessage('blocked_boundary', 'action', 'intent-threshold-not-met')
          : '这轮先不动数据。想落库的话，用平常话说「记进日志 / 加提醒 / 建项目」这类就行。';
      }
      if (dominantMode === 'oracle' && actionBias === 'clarify-and-frame') {
        return exposeRawActionFailures && typeof buildMorphDevActionVisibleMessage === 'function'
          ? buildMorphDevActionVisibleMessage('blocked_boundary', 'action', 'clarify-before-write')
          : '先帮你把话听完。要改哪一项、怎么改，再补一句就好。';
      }

      return exposeRawActionFailures && typeof buildMorphDevActionVisibleMessage === 'function'
        ? buildMorphDevActionVisibleMessage('blocked_boundary', 'action', 'no-executable-action')
        : '没能自动执行写入。用平常话说清要记什么、写到哪里，我再试。';
    }

    return {
      evaluateActionCommitGate,
      buildBlockedReason,
    };
  }

  window.MorphAIActionGateRuntime = {
    create: createAIActionGateRuntime,
  };
})();
