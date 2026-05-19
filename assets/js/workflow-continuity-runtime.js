(function initMorphWorkflowContinuityRuntime() {
  function createWorkflowContinuityRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const getCurrentTab = typeof api.getCurrentTab === 'function'
      ? api.getCurrentTab
      : () => String(api.currentTab || '').trim();
    const getActiveContextId = typeof api.getActiveContextId === 'function'
      ? api.getActiveContextId
      : () => String(api.activeContextId || '').trim();
    const getProjects = typeof api.getProjects === 'function'
      ? api.getProjects
      : () => (api.data && Array.isArray(api.data.projects) ? api.data.projects : []);

    function isWorkflowContinuationCue(text = '') {
      const clean = String(text || '').trim();
      if (!clean) return false;
      if (clean.length <= 40 && /(继续|然后|接着|下一步|按这个|照这个|就这个|还是这个|先这个|这个先|这个再|改一下|调一下|重写|优化|再来|往下走|往前推)/.test(clean)) return true;
      return /^(这个|它|这里|刚才那个|上一个|这一条|这一步)/.test(clean);
    }

    function deriveWorkflowStep({ previous = null, currentTaskState = null, responseMode = null, sharedIntentionality = null, dualGuidance = null, actions = [] } = {}) {
      const prev = previous && typeof previous === 'object' ? previous : {};
      const taskState = currentTaskState && typeof currentTaskState === 'object' ? currentTaskState : {};
      const guidance = dualGuidance && typeof dualGuidance === 'object' ? dualGuidance : {};
      const actionLabels = Array.isArray(actions) ? actions.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const mode = String(responseMode?.mode || responseMode || '').trim().toLowerCase();
      if (sharedIntentionality?.needsClarification || guidance.actionBias === 'clarify-and-frame') return 'awaiting_clarification';
      if (guidance.actionBias === 'hold-space') return 'holding';
      if (actionLabels.length) return 'committed_recently';
      if (String(taskState?.pendingDataIntent || '').trim() && (guidance.actionBias === 'structure-and-commit' || guidance.dominantMode === 'architect')) {
        return 'ready_to_commit';
      }
      if (guidance.actionBias === 'structure-and-advance') return 'advancing';
      if (mode === 'organize' || mode === 'solve') return 'continuing';
      return String(prev.step || '').trim() || 'active';
    }

    function inferCurrentWorkflowState({
      previous = null,
      userText = '',
      assistantText = '',
      actions = [],
      currentTaskState = null,
      responseMode = null,
      sharedIntentionality = null,
      dualGuidance = null,
    } = {}) {
      const cleanUser = String(userText || '').trim();
      const cleanAssistant = String(assistantText || '').trim();
      const actionLabels = Array.isArray(actions) ? actions.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const actionText = actionLabels.join(' | ');
      const combined = `${cleanUser}\n${cleanAssistant}\n${actionText}`;
      const prev = previous && typeof previous === 'object' ? previous : {};
      const continueCue = isWorkflowContinuationCue(cleanUser);
      const pendingDataIntent = String(currentTaskState?.pendingDataIntent || '').trim();
      const mode = String(responseMode?.mode || responseMode || '').trim().toLowerCase();
      const currentTab = String(getCurrentTab() || '').trim();
      const activeContextId = String(getActiveContextId() || '').trim();
      const projects = Array.isArray(getProjects()) ? getProjects() : [];

      let type = '';
      let targetName = '';

      const projectIntent = /项目/.test(combined) || /项目/.test(actionText);
      const inProjectContext = currentTab === 'project' && !!activeContextId;

      if (/周计划|周时间块|本周时间块|下周时间块|最近七天时间块|周计划草案/.test(combined)) {
        type = 'week_schedule';
        targetName = '';
      } else if (projectIntent || inProjectContext) {
        const activeName = currentTab === 'project'
            ? String(projects.find((item) => item.id === activeContextId)?.name || '').trim()
            : '';
        type = 'project_edit';
        targetName = activeName || String(prev.targetName || '').trim();
      } else if (pendingDataIntent === 'daily_log_capture' || /日志/.test(actionText)) {
        type = 'data_operation';
        targetName = 'daily_log';
      } else if (pendingDataIntent && /reminder/.test(pendingDataIntent)) {
        type = 'data_operation';
        targetName = 'reminders';
      } else if (continueCue && String(prev.type || '').trim()) {
        type = String(prev.type || '').trim();
        targetName = String(prev.targetName || '').trim();
      } else if (String(prev.type || '').trim() && ['organize', 'solve'].includes(mode) && cleanUser.length <= 48) {
        type = String(prev.type || '').trim();
        targetName = String(prev.targetName || '').trim();
      } else if (['companionship', 'overload', 'boundary', 'meaning'].includes(mode) && String(prev.type || '').trim() && continueCue) {
        type = String(prev.type || '').trim();
        targetName = String(prev.targetName || '').trim();
      }

      const nextType = String(type || prev.type || '').trim();
      const step = (nextType || sharedIntentionality?.needsClarification || String(dualGuidance?.actionBias || '').trim() === 'clarify-and-frame')
        ? deriveWorkflowStep({ previous: prev, currentTaskState, responseMode, sharedIntentionality, dualGuidance, actions: actionLabels })
        : String(prev.step || '').trim();
      return {
        type: nextType,
        step,
        targetName: String(targetName || prev.targetName || '').trim(),
        summary: cleanAssistant || cleanUser || String(prev.summary || ''),
        updatedAt: new Date().toISOString(),
      };
    }

    function buildRecallAugmentedQuestion(question = '', currentTaskState = null, currentWorkflowState = null) {
      const raw = String(question || '').trim();
      if (!raw) return raw;
      const currentIntent = String(currentTaskState?.lastUserIntent || '').trim();
      const shortFollowup = raw.length <= 36 && /(继续|然后|再来|改一下|调整|优化|按这个|照这个|这个|这个先|这个再|下一步|继续做|继续写)/.test(raw);
      const workflowHint = currentWorkflowState?.type
        ? `当前工作流:${String(currentWorkflowState.type || '').trim()}${currentWorkflowState?.step ? `/${String(currentWorkflowState.step || '').trim()}` : ''}${currentWorkflowState?.targetName ? `/${String(currentWorkflowState.targetName || '').trim()}` : ''}`
        : '';
      if (!shortFollowup || (!currentIntent && !workflowHint)) return raw;
      return [currentIntent, workflowHint, `当前追问：${raw}`].filter(Boolean).join('\n');
    }

    return {
      isWorkflowContinuationCue,
      deriveWorkflowStep,
      inferCurrentWorkflowState,
      buildRecallAugmentedQuestion,
    };
  }

  window.MorphWorkflowContinuityRuntime = { create: createWorkflowContinuityRuntime };
})();
