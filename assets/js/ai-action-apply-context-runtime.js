// @ts-check

(function initMorphAIActionApplyContextRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionApplyContextRuntime && typeof window.MorphAIActionApplyContextRuntime.create === 'function') return;

  function createAIActionApplyContextRuntime() {
    function prepareApplyActionsContext(options = {}) {
      const actionsInput = Array.isArray(options.actions) ? options.actions : [];
      const context = options.context && typeof options.context === 'object' ? options.context : {};
      const dataRef = options.dataRef && typeof options.dataRef === 'object' ? options.dataRef : {};
      const promptQuestion = String(context.promptQuestion || '').trim();

      const filterDisallowedPlanningActions = typeof options.filterDisallowedPlanningActions === 'function'
        ? options.filterDisallowedPlanningActions
        : ((nextActions = []) => ({ actions: Array.isArray(nextActions) ? nextActions : [], blockedActionTypes: [] }));
      const planningActionFilter = filterDisallowedPlanningActions(actionsInput, promptQuestion);
      const actions = Array.isArray(planningActionFilter?.actions) ? planningActionFilter.actions : actionsInput.slice();
      const blockedActionTypes = Array.isArray(planningActionFilter?.blockedActionTypes)
        ? planningActionFilter.blockedActionTypes.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      const planningBlocked = blockedActionTypes.length > 0;

      const didUserExplicitlyAskWriteTimeBlocksToDaily = typeof options.didUserExplicitlyAskWriteTimeBlocksToDaily === 'function'
        ? options.didUserExplicitlyAskWriteTimeBlocksToDaily
        : () => false;
      const userAskedWriteBlocksToDaily = didUserExplicitlyAskWriteTimeBlocksToDaily(promptQuestion) === true;

      const getMorphRuntimeBundle = typeof options.getMorphRuntimeBundle === 'function'
        ? options.getMorphRuntimeBundle
        : () => ({ skills: { disabledActions: [] } });
      const runtimeBundle = getMorphRuntimeBundle() || { skills: { disabledActions: [] } };
      const disabledActions = new Set((runtimeBundle?.skills?.disabledActions || []).map((item) => String(item || '').trim()).filter(Boolean));

      const isMorphActionExecutionFollowup = typeof options.isMorphActionExecutionFollowup === 'function'
        ? options.isMorphActionExecutionFollowup
        : () => false;
      const followupExecutionConfirmation = isMorphActionExecutionFollowup(promptQuestion) === true;

      const extractExpenseRecordFromQuestion = typeof options.extractExpenseRecordFromQuestion === 'function'
        ? options.extractExpenseRecordFromQuestion
        : () => null;
      const terseExpenseCaptureIntent = !!extractExpenseRecordFromQuestion(promptQuestion);

      const explicitWriteIntent = /(记下来|记下|记住|记录到|记录进|记到|写入|写进|放进|放入|存进|保存|新增|添加|加入|创建|新建|修改|更新|删除|删掉|移除|去掉|清掉|撤销|撤回|回退|提醒我|帮我记|帮我加|帮我写|直接写|直接加|落到系统里|搬到|移到|挪到|归到|归入|去重|清重|整理到)/i.test(promptQuestion)
        || /(设置(?:一个)?提醒|设(?:一个|个)?提醒|帮我设置(?:一个)?提醒|给我设(?:一个|个)?提醒)/i.test(promptQuestion)
        || followupExecutionConfirmation
        || terseExpenseCaptureIntent;

      const inferImplicitMemoryWriteActionFromConversation = typeof options.inferImplicitMemoryWriteActionFromConversation === 'function'
        ? options.inferImplicitMemoryWriteActionFromConversation
        : () => null;
      const implicitMemoryWriteIntent = inferImplicitMemoryWriteActionFromConversation(promptQuestion);
      const explicitMemoryWriteIntent = /(记住|记下|存进(?:你的)?记忆|写进(?:你的)?记忆|写入(?:你的)?记忆|放进(?:你的)?(?:soul|user|identity|memory(?:-system)?)\.?md|写进(?:你的)?(?:soul|user|identity|memory(?:-system)?)\.?md|(?:修改|改写|重写|更新).{0,12}(?:(?:soul|user|identity|memory(?:-system)?)\.?md|soul|记忆)|memory_write|write_soul_memory)/i.test(promptQuestion)
        || /(以后叫我|你可以叫我|从今天开始叫我|叫我的真名|真名|我的名字是|我叫|名字叫)/.test(promptQuestion)
        || !!implicitMemoryWriteIntent;
      const explicitRuntimeWriteIntent = /(运行时规则|自升级|升级规则|技能开关|context rules|memory rules|runtime|更新规则|修改规则)/i.test(promptQuestion);

      const shouldTreatAsMorphDataOperation = typeof options.shouldTreatAsMorphDataOperation === 'function'
        ? options.shouldTreatAsMorphDataOperation
        : () => false;
      const strongDataOperationIntent = shouldTreatAsMorphDataOperation(promptQuestion) === true || terseExpenseCaptureIntent;

      const ensureAIMemoryShape = typeof options.ensureAIMemoryShape === 'function' ? options.ensureAIMemoryShape : null;
      const aiMemory = ensureAIMemoryShape
        ? (ensureAIMemoryShape(dataRef).aiMemory || {})
        : (dataRef.aiMemory && typeof dataRef.aiMemory === 'object' ? dataRef.aiMemory : {});

      const activeDualGuidance = context.dualGuidance && typeof context.dualGuidance === 'object'
        ? context.dualGuidance
        : (aiMemory?.workingMemory?.dualGuidance && typeof aiMemory.workingMemory.dualGuidance === 'object'
          ? aiMemory.workingMemory.dualGuidance
          : null);
      const dominantMode = String(activeDualGuidance?.dominantMode || 'balanced').trim();
      const actionBias = String(activeDualGuidance?.actionBias || 'guide-then-structure').trim();
      const pendingDataIntent = String(aiMemory?.workingMemory?.currentTaskState?.pendingDataIntent || aiMemory?.currentTaskState?.pendingDataIntent || '').trim();
      const hasPendingDataIntent = !!pendingDataIntent;

      const getPermissionContextRuntimeModules = typeof options.getPermissionContextRuntimeModules === 'function'
        ? options.getPermissionContextRuntimeModules
        : null;
      const runtimeModulesRef = options.runtimeModulesRef && typeof options.runtimeModulesRef === 'object'
        ? options.runtimeModulesRef
        : null;
      const permissionRuntime = getPermissionContextRuntimeModules
        ? getPermissionContextRuntimeModules()
        : runtimeModulesRef;

      const getMorphActionExecutionPolicy = typeof options.getMorphActionExecutionPolicy === 'function'
        ? options.getMorphActionExecutionPolicy
        : null;
      const resolveActionExecutionPolicy = getMorphActionExecutionPolicy || ((type = '') => {
        if (permissionRuntime && typeof permissionRuntime.getMorphActionExecutionPolicy === 'function') {
          return permissionRuntime.getMorphActionExecutionPolicy(type);
        }
        const actionType = String(type || '').trim();
        return {
          action: actionType || 'unknown',
          domain: 'general',
          permissionLevel: 'update',
          consentTier: 'architect-required',
          riskLevel: 'medium',
          notes: '',
        };
      });

      const buildMorphActionCandidate = typeof options.buildMorphActionCandidate === 'function'
        ? options.buildMorphActionCandidate
        : null;
      const buildActionCandidate = buildMorphActionCandidate || ((type = '', action = {}, meta = {}, policy = null) => ({
        action: String(type || '').trim(),
        actor: String(meta.actor || 'ai').trim() || 'ai',
        source: String(meta.source || 'ai').trim() || 'ai',
        requestId: String(action?.requestId || '').trim() || `morph-${String(type || 'action').trim() || 'action'}-${Date.now().toString(36).slice(-8)}`,
        target: String(action?.target || '').trim(),
        entity: String(meta.entity || '').trim(),
        riskLevel: String(policy?.riskLevel || 'medium').trim() || 'medium',
        confirmationLevel: String(policy?.consentTier || 'architect-required').trim() || 'architect-required',
      }));

      const buildMorphActionBoundaryResult = typeof options.buildMorphActionBoundaryResult === 'function'
        ? options.buildMorphActionBoundaryResult
        : null;
      const buildActionBoundary = buildMorphActionBoundaryResult || ((type = '', policy = null, details = {}) => {
        if (permissionRuntime && typeof permissionRuntime.buildMorphActionBoundaryResult === 'function') {
          return permissionRuntime.buildMorphActionBoundaryResult(type, policy, details);
        }
        return {
          allowed: details?.allowed !== false,
          action: String(type || '').trim(),
          domain: String(policy?.domain || '').trim(),
          permissionLevel: String(policy?.permissionLevel || '').trim(),
          consentTier: String(policy?.consentTier || '').trim(),
          riskLevel: String(policy?.riskLevel || '').trim(),
          reason: String(details?.reason || '').trim(),
        };
      });

      return {
        actions,
        promptQuestion,
        planningBlocked,
        planningBlockedActionTypes: blockedActionTypes,
        planningBlockedLabel: planningBlocked ? '已拦截未明确请求的时间块' : '',
        planningBlockedReason: planningBlocked ? '用户没有明确提到“时间块”，因此不执行时间块草案动作。' : '',
        userAskedWriteBlocksToDaily,
        disabledActions,
        followupExecutionConfirmation,
        terseExpenseCaptureIntent,
        explicitWriteIntent,
        implicitMemoryWriteIntent,
        explicitMemoryWriteIntent,
        explicitRuntimeWriteIntent,
        strongDataOperationIntent,
        aiMemory,
        activeDualGuidance,
        dominantMode,
        actionBias,
        pendingDataIntent,
        hasPendingDataIntent,
        permissionRuntime,
        resolveActionExecutionPolicy,
        buildActionCandidate,
        buildActionBoundary,
      };
    }

    return {
      prepareApplyActionsContext,
    };
  }

  window.MorphAIActionApplyContextRuntime = {
    create: createAIActionApplyContextRuntime,
  };
})();
