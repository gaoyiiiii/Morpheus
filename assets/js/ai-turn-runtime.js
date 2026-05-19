// @ts-check

(function () {
  /**
   * @typedef {object} AITurnRuntimeDeps
   * @property {() => import('../../interfaces').AIChatState} [getAIChatState]
   * @property {() => string} [getCurrentTab]
   * @property {() => string} [getSelectedDailyMonth]
   * @property {() => unknown} [getCurrentProject]
   * @property {() => unknown} [getData]
   * @property {() => import('../../interfaces').MorphRuntimeState} [getMorphRuntimeBundle]
   * @property {() => string} [getCurrentAIKey]
   * @property {() => string} [getAIProviderDisplayLabel]
   * @property {(value: string) => { promptQuestion: string, userVisibleQuestion: string, extracted?: boolean }} [extractLikelyUserTaskFromMixedMessage]
   * @property {(mode: string) => NonNullable<import('../../interfaces').AIChatAttachment['mode']>} [normalizeAIChatAttachmentMode]
   * @property {(attachments: import('../../interfaces').AIChatAttachment[]) => import('../../interfaces').AIChatAttachmentPreviewItem[]} [buildAIChatAttachmentPreviewMeta]
   * @property {(attachments: import('../../interfaces').AIChatAttachment[]) => string} [buildAIChatAttachmentPromptContext]
   * @property {() => string} [getLatestAssistantMessageText]
   * @property {() => string} [buildRelationshipModePromptContext]
   * @property {() => string} [buildBehaviorMemoryPromptContext]
   * @property {() => string} [buildBehaviorStylePromptContext]
   * @property {() => string} [buildBehaviorFocusPromptContext]
   * @property {() => string} [buildBehaviorSafetyPromptContext]
   * @property {(question: string, options?: { latencyMode?: 'fast' | 'full' }) => Promise<import('../../interfaces').PluginAIReadableContext[]>} [buildPluginAIReadableContexts]
   * @property {(question: string, options?: { force?: boolean }) => Promise<import('../../interfaces').WebSearchBundle | null>} [fetchWebSearchContext]
   * @property {(question: string) => import('../../interfaces').AIWorkspaceSnapshot} [buildAIWorkspaceSnapshot]
   * @property {(question: string, snapshot: import('../../interfaces').AIWorkspaceSnapshot, options?: { attachments?: import('../../interfaces').AIChatAttachment[], webSearchRequested?: boolean }) => import('../../interfaces').AIPlannerSummary | null} [buildAITaskPlannerSummary]
   * @property {(question: string, focus?: Record<string, unknown> | null, sharedIntentionality?: Record<string, unknown> | null) => import('../../interfaces').AIResponseMode} [inferMorphResponseMode]
   * @property {(question: string) => Promise<string>} [buildBundledSkillPromptContext]
   * @property {(question: string) => Promise<string>} [buildBundledSkillActionHintContext]
   * @property {(question: string) => Promise<string[]>} [buildBundledActiveSkillIds]
   * @property {() => string} [getNowInAITimezoneText]
   * @property {(question: string) => boolean} [isExternalAssistantConflictQuery]
   * @property {(question: string) => boolean} [shouldTreatAsMorphDataOperation]
   * @property {(prompt: string, options?: { stream?: boolean, signal?: AbortSignal | null, preferNativeIOS?: boolean }) => Promise<string>} [requestAIText]
   * @property {() => number} [getAIRequestMetricsCount]
   * @property {(index: number) => Array<Record<string, unknown>>} [readAIRequestMetricsSince]
   * @property {() => AbortSignal | null} [getAIAbortSignal]
   * @property {(text: string) => { reply?: string, actions?: import('../../interfaces').AIAction[] }} [extractAIChatStructuredResponse]
   * @property {(question: string, context?: { recordChat?: boolean, userVisibleQuestion?: string, attachments?: import('../../interfaces').AIChatAttachment[], attachmentPreviewMeta?: import('../../interfaces').AIChatAttachmentPreviewItem[], webSearchRequested?: boolean, beijingNow?: string }) => Promise<{ ok?: boolean, reply?: string, applied?: import('../../interfaces').AIAppliedResult }>} [executeExpenseCaptureWithAI]
   * @property {(question: string) => import('../../interfaces').AIAction[]} [inferExpenseRecordEditActionsFromQuestion]
   * @property {(question: string) => import('../../interfaces').AIAction | null} [inferImplicitMemoryWriteActionFromConversation]
   * @property {(question: string) => import('../../interfaces').AIAction | null} [inferImplicitUndoActionFromConversation]
   * @property {(question: string) => { handled?: boolean, reply?: string, applied?: import('../../interfaces').AIAppliedResult }} [inferReminderReadRequestFromQuestion]
   * @property {(question: string) => import('../../interfaces').AIAction | null} [inferReminderActionFromQuestion]
   * @property {() => string} [buildReminderListReply]
   * @property {() => Array<unknown>} [getReminderList]
   * @property {(question: string) => { handled?: boolean, reply?: string, applied?: import('../../interfaces').AIAppliedResult }} [inferProjectReadRequestFromQuestion]
   * @property {(req: unknown) => string} [buildProjectListReply]
   * @property {(question: string) => { handled?: boolean, reply?: string, applied?: import('../../interfaces').AIAppliedResult }} [inferDailyLogReadRequestFromQuestion]
   * @property {(req: unknown) => string} [buildDailyLogListReply]
   * @property {(question: string) => { handled?: boolean, reply?: string, applied?: import('../../interfaces').AIAppliedResult }} [inferConversationRecallReadRequestFromQuestion]
   * @property {(req: unknown) => string} [buildConversationRecallReply]
   * @property {(question: string) => import('../../interfaces').AIAction | null} [inferLogReminderEditActionFromQuestion]
   * @property {(question: string) => { handled?: boolean, reply?: string, applied?: import('../../interfaces').AIAppliedResult }} [inferRecentActionReadRequestFromQuestion]
   * @property {() => string} [buildRecentActionListReply]
   * @property {(question: string) => { handled?: boolean, reply?: string, applied?: import('../../interfaces').AIAppliedResult }} [inferTaskAlignmentReadRequestFromQuestion]
   * @property {(req: unknown) => string} [buildTaskAlignmentReply]
   * @property {() => void} [healStuckAIChatBusyState]
   * @property {() => void} [requestAIChatRender]
   * @property {() => void} [scheduleAIChatHistoryPersistence]
   * @property {() => void} [syncMobileQuickComposeIcon]
   * @property {() => void} [syncAIInputLoadingState]
   * @property {() => void} [stopAITTSPlayback]
   * @property {() => void} [startAIThinkingIndicator]
   * @property {() => void} [stopAIThinkingIndicator]
   * @property {(role: string, content: string, meta?: Record<string, unknown> | null, options?: Record<string, unknown>) => string} [pushAIChatMessage]
   * @property {(messageId: string, updates: Record<string, unknown>, options?: Record<string, unknown>) => void} [updateAIChatMessage]
   * @property {(promptQuestion: string, options: { recordChat: boolean, assistantMessageId?: string | null, bestStreamedReply?: string }) => string} [getAIChatMessageContent]
   * @property {(actions: import('../../interfaces').AIAction[], reply?: string) => import('../../interfaces').AIAction[]} [enrichAIActionsFromReply]
   * @property {() => { provider?: string, apiKey?: string, baseUrl?: string, model?: string }} [buildCurrentAIExecutionConfig]
   * @property {() => string} [getAIThinkingFrame]
   * @property {(text: string, options: { stream?: boolean, signal?: AbortSignal | null, preferNativeIOS?: boolean, onProgress?: (chunk: string) => void }) => Promise<string>} [requestAIText]
   * @property {(text: string) => string} [getReadableAIErrorMessage]
   * @property {(text: string) => Promise<void>} [speakAIReplyWithTTS]
   * @property {(text: string, error?: boolean) => void} [setAISettingsFeedback]
   * @property {() => void} [openCustomModal]
   * @property {(question: string) => boolean} [isRunningInNativeIOSShell]
   * @property {(question: string, options?: { recordChat?: boolean, attachments?: import('../../interfaces').AIChatAttachment[], webSearchRequested?: boolean }) => Promise<{ ok?: boolean, reply?: string, applied?: import('../../interfaces').AIAppliedResult }>} [executeExpenseCaptureWithAI]
   * @property {(question: string) => Promise<string>} [buildBundledSkillPromptContext]
   * @property {(question: string, options?: { allowMorphDataActions?: boolean, beijingNow?: string }) => Promise<{ ok?: boolean, actions?: import('../../interfaces').AIAction[], rawText?: string } | null>} [executeMorphActionExtractionWithAI]
   * @property {(question: string, options?: { attachments?: import('../../interfaces').AIChatAttachment[], webSearchRequested?: boolean }) => Promise<unknown>} [prepareAIExecutionContext]
   * @property {(applied?: import('../../interfaces').AIAppliedResult | null) => string} [buildAppliedActionReceiptReply]
   */

  function createAITurnRuntimeModules(deps) {
    const api = /** @type {AITurnRuntimeDeps} */ (deps && typeof deps === 'object' ? deps : {});
    const getAIChatState = typeof api.getAIChatState === 'function'
      ? api.getAIChatState
      : () => (window.aiChatState && typeof window.aiChatState === 'object' ? window.aiChatState : {});
    const getCurrentTab = typeof api.getCurrentTab === 'function' ? api.getCurrentTab : () => '';
    const getSelectedDailyMonth = typeof api.getSelectedDailyMonth === 'function' ? api.getSelectedDailyMonth : () => '';
    const getCurrentProject = typeof api.getCurrentProject === 'function' ? api.getCurrentProject : () => null;
    const getData = typeof api.getData === 'function' ? api.getData : null;
    const getMorphRuntimeBundle = typeof api.getMorphRuntimeBundle === 'function' ? api.getMorphRuntimeBundle : () => ({});
    const aiOrchestrationModules = api.aiOrchestrationModules && typeof api.aiOrchestrationModules.prepareAIExecutionContext === 'function'
      ? api.aiOrchestrationModules
      : null;
    const aiPromptBuilderModules = api.aiPromptBuilderModules && typeof api.aiPromptBuilderModules.buildMainAIPrompt === 'function'
      ? api.aiPromptBuilderModules
      : null;
    const aiResponseHandlerModules = api.aiResponseHandlerModules && typeof api.aiResponseHandlerModules.finalizeReply === 'function'
      ? api.aiResponseHandlerModules
      : null;
    const getCurrentAIKey = typeof api.getCurrentAIKey === 'function' ? api.getCurrentAIKey : () => '';
    const getAIProviderDisplayLabel = typeof api.getAIProviderDisplayLabel === 'function' ? api.getAIProviderDisplayLabel : () => 'AI';
    const normalizeAIChatAttachmentMode = typeof api.normalizeAIChatAttachmentMode === 'function'
      ? api.normalizeAIChatAttachmentMode
      : (mode) => mode || 'inline';
    const buildAIChatAttachmentPreviewMeta = typeof api.buildAIChatAttachmentPreviewMeta === 'function'
      ? api.buildAIChatAttachmentPreviewMeta
      : () => [];
    const requestAIChatRender = typeof api.requestAIChatRender === 'function' ? api.requestAIChatRender : () => {};
    const scheduleAIChatHistoryPersistence = typeof api.scheduleAIChatHistoryPersistence === 'function' ? api.scheduleAIChatHistoryPersistence : () => {};
    const syncMobileQuickComposeIcon = typeof api.syncMobileQuickComposeIcon === 'function' ? api.syncMobileQuickComposeIcon : () => {};
    const syncAIInputLoadingState = typeof api.syncAIInputLoadingState === 'function' ? api.syncAIInputLoadingState : () => {};
    const stopAITTSPlayback = typeof api.stopAITTSPlayback === 'function' ? api.stopAITTSPlayback : () => {};
    const inferImplicitUndoActionFromConversation = typeof api.inferImplicitUndoActionFromConversation === 'function'
      ? api.inferImplicitUndoActionFromConversation
      : () => null;
    const startAIThinkingIndicator = typeof api.startAIThinkingIndicator === 'function' ? api.startAIThinkingIndicator : () => {};
    const stopAIThinkingIndicator = typeof api.stopAIThinkingIndicator === 'function' ? api.stopAIThinkingIndicator : () => {};
    const pushAIChatMessage = typeof api.pushAIChatMessage === 'function' ? api.pushAIChatMessage : null;
    const updateAIChatMessage = typeof api.updateAIChatMessage === 'function' ? api.updateAIChatMessage : null;
    const getAIThinkingFrame = typeof api.getAIThinkingFrame === 'function' ? api.getAIThinkingFrame : () => '思考中';
    const getReadableAIErrorMessage = typeof api.getReadableAIErrorMessage === 'function' ? api.getReadableAIErrorMessage : (error) => error?.message || 'unknown';
    const openCustomModal = typeof api.openCustomModal === 'function' ? api.openCustomModal : () => {};
    const applyAIActions = typeof api.applyAIActions === 'function' ? api.applyAIActions : null;
    const AbortControllerCtor = typeof api.AbortController === 'function'
      ? api.AbortController
      : (typeof AbortController === 'function' ? AbortController : null);
    const executeExpenseCaptureWithAI = typeof api.executeExpenseCaptureWithAI === 'function' ? api.executeExpenseCaptureWithAI : null;
    const inferExpenseRecordEditActionsFromQuestion = typeof api.inferExpenseRecordEditActionsFromQuestion === 'function'
      ? api.inferExpenseRecordEditActionsFromQuestion
      : null;
    const inferImplicitMemoryWriteActionFromConversation = typeof api.inferImplicitMemoryWriteActionFromConversation === 'function'
      ? api.inferImplicitMemoryWriteActionFromConversation
      : null;
    const inferReminderReadRequestFromQuestion = typeof api.inferReminderReadRequestFromQuestion === 'function' ? api.inferReminderReadRequestFromQuestion : null;
    const inferReminderActionFromQuestion = typeof api.inferReminderActionFromQuestion === 'function' ? api.inferReminderActionFromQuestion : null;
    const buildReminderListReply = typeof api.buildReminderListReply === 'function' ? api.buildReminderListReply : () => '';
    const getReminderList = typeof api.getReminderList === 'function' ? api.getReminderList : () => [];
    const inferProjectReadRequestFromQuestion = typeof api.inferProjectReadRequestFromQuestion === 'function' ? api.inferProjectReadRequestFromQuestion : null;
    const buildProjectListReply = typeof api.buildProjectListReply === 'function' ? api.buildProjectListReply : () => '';
    const inferDailyLogReadRequestFromQuestion = typeof api.inferDailyLogReadRequestFromQuestion === 'function' ? api.inferDailyLogReadRequestFromQuestion : null;
    const buildDailyLogListReply = typeof api.buildDailyLogListReply === 'function' ? api.buildDailyLogListReply : () => '';
    const inferConversationRecallReadRequestFromQuestion = typeof api.inferConversationRecallReadRequestFromQuestion === 'function' ? api.inferConversationRecallReadRequestFromQuestion : null;
    const buildConversationRecallReply = typeof api.buildConversationRecallReply === 'function' ? api.buildConversationRecallReply : () => '';
    const inferLogReminderEditActionFromQuestion = typeof api.inferLogReminderEditActionFromQuestion === 'function' ? api.inferLogReminderEditActionFromQuestion : null;
    const inferRecentActionReadRequestFromQuestion = typeof api.inferRecentActionReadRequestFromQuestion === 'function' ? api.inferRecentActionReadRequestFromQuestion : null;
    const buildRecentActionListReply = typeof api.buildRecentActionListReply === 'function' ? api.buildRecentActionListReply : () => '';
    const inferTaskAlignmentReadRequestFromQuestion = typeof api.inferTaskAlignmentReadRequestFromQuestion === 'function' ? api.inferTaskAlignmentReadRequestFromQuestion : null;
    const buildTaskAlignmentReply = typeof api.buildTaskAlignmentReply === 'function' ? api.buildTaskAlignmentReply : () => '';
    const buildAppliedActionReceiptReply = typeof api.buildAppliedActionReceiptReply === 'function'
      ? api.buildAppliedActionReceiptReply
      : (applied = null) => {
        const labels = Array.isArray(applied?.appliedLabels) ? applied.appliedLabels : [];
        return String(labels[0] || '').trim();
      };
    const extractLikelyUserTaskFromMixedMessage = typeof api.extractLikelyUserTaskFromMixedMessage === 'function'
      ? api.extractLikelyUserTaskFromMixedMessage
      : (question = '') => ({ promptQuestion: String(question || ''), userVisibleQuestion: String(question || ''), extracted: false });
    const call = (name, ...args) => (typeof api[name] === 'function' ? api[name](...args) : undefined);
    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb) => {
        if (typeof cb === 'function') cb();
        return 1;
      };

    function nowMs() {
      return Date.now();
    }

    function createTimingState(seed = {}) {
      return {
        startedAtMs: nowMs(),
        firstVisibleAtMs: 0,
        path: String(seed.path || '').trim(),
        latencyMode: String(seed.latencyMode || '').trim(),
        provider: String(seed.provider || '').trim(),
        phases: [],
      };
    }

    function recordTimingPhase(timingState, key, startedAt, extra = {}) {
      if (!timingState || !key) return;
      const endAt = nowMs();
      const safeStartedAt = Number(startedAt || 0) || endAt;
      const ms = Math.max(0, endAt - safeStartedAt);
      timingState.phases.push({
        key: String(key || '').trim(),
        ms,
        detail: String(extra.detail || '').trim(),
      });
    }

    function markTimingFirstVisible(timingState) {
      if (!timingState || Number(timingState.firstVisibleAtMs || 0) > 0) return;
      timingState.firstVisibleAtMs = nowMs();
    }

    function buildTimingTrace(timingState) {
      if (!timingState || !Array.isArray(timingState.phases)) return null;
      const totalMs = Math.max(0, nowMs() - (Number(timingState.startedAtMs || 0) || nowMs()));
      const visibleReplyMs = Number(timingState.firstVisibleAtMs || 0) > 0
        ? Math.max(0, Number(timingState.firstVisibleAtMs || 0) - Number(timingState.startedAtMs || 0))
        : totalMs;
      const phases = timingState.phases
        .filter((item) => item && String(item.key || '').trim())
        .map((item) => ({
          key: String(item.key || '').trim(),
          ms: Math.max(0, Number(item.ms || 0) || 0),
          detail: String(item.detail || '').trim(),
        }));
      return {
        totalMs,
        visibleReplyMs,
        path: String(timingState.path || '').trim(),
        latencyMode: String(timingState.latencyMode || '').trim(),
        provider: String(timingState.provider || '').trim(),
        phases,
      };
    }

    function mergeAssistantMetaWithTiming(meta, timingTrace) {
      const baseMeta = meta && typeof meta === 'object' ? { ...meta } : {};
      if (!timingTrace) return baseMeta;
      const routeTrace = baseMeta.routeTrace && typeof baseMeta.routeTrace === 'object'
        ? { ...baseMeta.routeTrace }
        : null;
      if (routeTrace) {
        routeTrace.timing = {
          totalMs: Number(timingTrace.totalMs || 0) || 0,
          visibleReplyMs: Number(timingTrace.visibleReplyMs || 0) || 0,
          path: String(timingTrace.path || '').trim(),
          latencyMode: String(timingTrace.latencyMode || '').trim(),
          provider: String(timingTrace.provider || '').trim(),
          phases: Array.isArray(timingTrace.phases)
            ? timingTrace.phases.map((item) => ({
              key: String(item?.key || '').trim(),
              ms: Math.max(0, Number(item?.ms || 0) || 0),
            }))
            : [],
        };
      }
      return {
        ...baseMeta,
        routeTrace,
        timingTrace,
      };
    }

    function buildAIRequestTrace(metrics = [], timingTrace = null) {
      const requests = (Array.isArray(metrics) ? metrics : [])
        .filter((item) => item && typeof item === 'object')
        .slice(0, 8)
        .map((item) => ({
          provider: String(item.provider || '').trim(),
          model: String(item.model || '').trim(),
          requestKind: String(item.requestKind || 'text').trim() || 'text',
          transport: String(item.transport || 'http').trim() || 'http',
          status: String(item.status || 'ok').trim() || 'ok',
          stream: item.stream === true,
          durationMs: Math.max(0, Number(item.durationMs || 0) || 0),
          promptTokens: Math.max(0, Number(item.promptTokens || 0) || 0),
          completionTokens: Math.max(0, Number(item.completionTokens || 0) || 0),
          totalTokens: Math.max(0, Number(item.totalTokens || 0) || 0),
          tokenSource: String(item.tokenSource || 'estimated').trim() || 'estimated',
        }));
      if (!requests.length) return null;
      return {
        path: String(timingTrace?.path || '').trim(),
        totalDurationMs: Math.max(0, Number(timingTrace?.totalMs || 0) || 0),
        requestCount: requests.length,
        totalTokens: requests.reduce((sum, item) => sum + Math.max(0, Number(item.totalTokens || 0) || 0), 0),
        promptTokens: requests.reduce((sum, item) => sum + Math.max(0, Number(item.promptTokens || 0) || 0), 0),
        completionTokens: requests.reduce((sum, item) => sum + Math.max(0, Number(item.completionTokens || 0) || 0), 0),
        requests,
      };
    }

    function getShortcutCanonicalObservedActionType(routeTrace = null) {
      const normalizedRoute = String(routeTrace?.route || '').trim().toUpperCase();
      const capability = String(routeTrace?.capability || '').trim();
      if (!capability || !/^(?:READ|PLAN)$/.test(normalizedRoute)) return '';
      return /^(?:list_|summarize_|plan_)/.test(capability) ? capability : '';
    }

    function buildShortcutAppliedForAssistantMeta(applied = null, routeTrace = null) {
      const canonicalObservedActionType = getShortcutCanonicalObservedActionType(routeTrace);
      if (!canonicalObservedActionType) return applied;
      const normalizedTrace = Array.isArray(applied?.actionExecutionTrace)
        ? applied.actionExecutionTrace.filter((entry) => entry && typeof entry === 'object')
        : [];
      if (normalizedTrace.some((entry) => String(entry.type || '').trim() === canonicalObservedActionType)) {
        return applied;
      }
      const syntheticStatus = String(routeTrace?.route || '').trim().toUpperCase() === 'PLAN'
        ? 'draft_applied'
        : 'applied_local';
      return {
        ...(applied && typeof applied === 'object' ? applied : {}),
        actionExecutionTrace: normalizedTrace.concat([{
          type: canonicalObservedActionType,
          status: syntheticStatus,
          transactionCommitted: false,
          syntheticShortcutSurface: true,
        }]),
      };
    }

    function buildShortcutAssistantMeta({ applied = null, relevantSources = [], webCitations = [], relevantChains = [], routeTrace = null } = {}) {
      const normalizedApplied = buildShortcutAppliedForAssistantMeta(applied, routeTrace);
      if (aiResponseHandlerModules && typeof aiResponseHandlerModules.buildAssistantMeta === 'function') {
        const assistantMeta = aiResponseHandlerModules.buildAssistantMeta({
          applied: normalizedApplied,
          relevantSources,
          webCitations,
          relevantChains,
          routeTrace,
        });
        return {
          ...(assistantMeta && typeof assistantMeta === 'object' ? assistantMeta : {}),
          routeTrace: routeTrace && typeof routeTrace === 'object' ? routeTrace : null,
        };
      }
      const canonicalObservedActionType = getShortcutCanonicalObservedActionType(routeTrace);
      return {
        actions: Array.isArray(normalizedApplied?.appliedLabels) ? normalizedApplied.appliedLabels : [],
        actionTypes: canonicalObservedActionType ? [canonicalObservedActionType] : [],
        createdItems: Array.isArray(normalizedApplied?.createdItems) ? normalizedApplied.createdItems : [],
        citations: [],
        citationChains: [],
        routeTrace: routeTrace && typeof routeTrace === 'object' ? routeTrace : null,
      };
    }

    function buildShortcutRouteTrace({
      route = '',
      capability = '',
      semanticFamily = '',
      path = '',
      decisionSource = 'shortcut-shell',
      status = 'completed',
    } = {}) {
      const normalizedRoute = String(route || '').trim().toUpperCase();
      if (!normalizedRoute) return null;
      return {
        route: normalizedRoute,
        capability: String(capability || '').trim(),
        semanticFamily: String(semanticFamily || '').trim(),
        path: String(path || '').trim(),
        decisionSource: String(decisionSource || '').trim() || 'shortcut-shell',
        status: String(status || '').trim() || 'completed',
      };
    }

    function finalizeShortcutAIResult({
      reply = '',
      applied = null,
      assistantMessageId = null,
      recordChat = true,
      freezeMs = 5000,
      relevantSources = [],
      webCitations = [],
      relevantChains = [],
      timingTrace = null,
      routeTrace = null,
    } = {}) {
      const aiChatState = getAIChatState();
      const assistantMeta = mergeAssistantMetaWithTiming(buildShortcutAssistantMeta({
        applied,
        relevantSources,
        webCitations,
        relevantChains,
        routeTrace,
      }), timingTrace);
      if (recordChat) {
        if (!assistantMessageId) {
          assistantMessageId = typeof api.pushAIChatMessage === 'function'
            ? api.pushAIChatMessage('assistant', reply, assistantMeta)
            : null;
          if (assistantMessageId && aiChatState) aiChatState.currentAssistantMessageId = assistantMessageId;
        } else if (typeof api.updateAIChatMessage === 'function') {
          api.updateAIChatMessage(assistantMessageId, {
            content: reply,
            meta: assistantMeta,
          });
        }
        aiChatState.freezeSessionUntil = Date.now() + freezeMs;
        if (typeof api.persistAIChatHistory === 'function') {
          api.persistAIChatHistory({ syncData: true, skipRender: true, flushNow: true });
        }
        if (typeof api.ensureAIChatSessionAutoTitle === 'function') {
          api.ensureAIChatSessionAutoTitle(aiChatState.sessionId);
        }
      }
      return { ok: true, reply: String(reply || '').trim(), applied, timingTrace };
    }

    function buildShortcutAppliedReply(applied = null) {
      const assistantMeta = buildShortcutAssistantMeta({ applied });
      const receiptSummary = String(assistantMeta?.receiptSummary || '').trim();
      if (receiptSummary) return receiptSummary;
      return String(buildAppliedActionReceiptReply(applied) || '').trim() || '已处理。';
    }

    function didShortcutWriteCommit(applied = null) {
      const actionExecutionTrace = Array.isArray(applied?.actionExecutionTrace) ? applied.actionExecutionTrace : [];
      const committedActionTypes = Array.from(new Set(
        actionExecutionTrace
          .filter((entry) => entry && String(entry.status || '').trim() === 'committed' && entry.transactionCommitted !== false)
          .map((entry) => String(entry.type || '').trim())
          .filter(Boolean)
      ));
      const hasFormalCommittedWriteLikeAction = committedActionTypes.some((type) => !/^(?:list_|summarize_|plan_|chat$)/.test(String(type || '').trim()));
      const hasExplicitNonCommittedMutationTrace = actionExecutionTrace.some((entry) => {
        if (!entry || !String(entry.type || '').trim()) return false;
        const status = String(entry.status || '').trim();
        return status === 'draft_applied'
          || status === 'applied_local'
          || (status === 'committed' && entry.transactionCommitted === false);
      });
      const fallbackCommittedSignal = committedActionTypes.length === 0
        && !hasExplicitNonCommittedMutationTrace
        && (
          (Array.isArray(applied?.appliedLabels) && applied.appliedLabels.length > 0)
          || (Array.isArray(applied?.createdItems) && applied.createdItems.length > 0)
          || !!String(applied?.transactionId || '').trim()
      );
      return hasFormalCommittedWriteLikeAction || fallbackCommittedSignal;
    }

    function resolveAppliedFailureSemantic(applied = null) {
      if (aiResponseHandlerModules && typeof aiResponseHandlerModules.getAppliedFailureSemantic === 'function') {
        const semantic = aiResponseHandlerModules.getAppliedFailureSemantic(applied);
        if (semantic && typeof semantic === 'object') return semantic;
      }
      const failureKind = String(applied?.failureKind || '').trim();
      const failureMessage = String(applied?.failureMessage || applied?.blockedReason || '').trim();
      if (failureKind || failureMessage) {
        return {
          kind: failureKind || (applied?.morphActionExecutionFailed === true ? 'failed' : (applied?.needsConfirmation === true ? 'needs_confirmation' : 'blocked')),
          message: failureMessage,
          needsConfirmation: applied?.needsConfirmation === true || failureKind === 'needs_confirmation',
        };
      }
      const traceStatuses = Array.isArray(applied?.actionExecutionTrace)
        ? applied.actionExecutionTrace.map((entry) => String(entry?.status || '').trim()).filter(Boolean)
        : [];
      const inferredKind = traceStatuses.includes('needs_confirmation')
        ? 'needs_confirmation'
        : (traceStatuses.some((status) => status === 'blocked_verification')
            ? 'verification_failed'
            : (traceStatuses.some((status) => /failed/.test(status)) || applied?.morphActionExecutionFailed === true
                ? 'failed'
                : ((String(applied?.blockedReason || '').trim() || (Array.isArray(applied?.blockedLabels) && applied.blockedLabels.length))
                    ? 'blocked'
                    : '')));
      return {
        kind: inferredKind,
        message: failureMessage,
        needsConfirmation: inferredKind === 'needs_confirmation',
      };
    }

    function shouldStopAfterShortcutWriteFailure(applied = null) {
      if (!applied || typeof applied !== 'object') return false;
      return Boolean(String(resolveAppliedFailureSemantic(applied)?.kind || '').trim());
    }

    function resolveShortcutWriteFailureStatus(applied = null) {
      const kind = String(resolveAppliedFailureSemantic(applied)?.kind || '').trim();
      if (kind === 'failed') return 'failed';
      if (kind === 'needs_confirmation') return 'needs_confirmation';
      if (kind) return 'blocked';
      return 'blocked';
    }

    function buildShortcutWriteFailureReply(applied = null, fallbackText = '') {
      const failureSemantic = resolveAppliedFailureSemantic(applied);
      const failureMessage = String(failureSemantic?.message || '').trim();
      if (failureMessage) return failureMessage;
      const blockedReason = String(applied?.blockedReason || '').trim();
      if (blockedReason) return blockedReason;
      const firstBlockedLabel = Array.isArray(applied?.blockedLabels) ? String(applied.blockedLabels[0] || '').trim() : '';
      if (firstBlockedLabel) return firstBlockedLabel;
      if (String(failureSemantic?.kind || '').trim() === 'failed' || applied?.morphActionExecutionFailed === true) {
        return '应用在执行写入动作时发生了内部错误（与 AI 服务商无关）。请重试一次；若持续出现请反馈。';
      }
      return String(fallbackText || '').trim() || '这次没有真正写入成功，请再试一次。';
    }

    function resolveReminderShortcutDecision(question = '') {
      const promptQuestion = String(question || '').trim();
      if (!promptQuestion) return null;
      const reminderReadRequest = typeof inferReminderReadRequestFromQuestion === 'function'
        ? inferReminderReadRequestFromQuestion(promptQuestion)
        : null;
      const logReminderEditAction = typeof inferLogReminderEditActionFromQuestion === 'function'
        ? inferLogReminderEditActionFromQuestion(promptQuestion)
        : null;
      const reminderCreateAction = typeof inferReminderActionFromQuestion === 'function'
        ? inferReminderActionFromQuestion(promptQuestion)
        : null;
      const reminderCreateHasExactTime = !!(
        reminderCreateAction
        && String(reminderCreateAction.type || '').trim() === 'add_reminder'
        && String(reminderCreateAction.text || '').trim()
        && String(reminderCreateAction.datetime || reminderCreateAction.dueAtText || '').trim()
      );
      if (logReminderEditAction && String(logReminderEditAction.type || '').trim()) {
        return {
          kind: 'write-edit',
          action: logReminderEditAction,
          readRequest: reminderReadRequest,
          createAction: reminderCreateAction,
        };
      }
      if (reminderCreateHasExactTime) {
        return {
          kind: 'write-add',
          action: reminderCreateAction,
          readRequest: reminderReadRequest,
        };
      }
      if (reminderReadRequest) {
        return {
          kind: 'read',
          request: reminderReadRequest,
          createAction: reminderCreateAction,
        };
      }
      return null;
    }

    function resolveExpenseShortcutDecision(question = '') {
      const promptQuestion = String(question || '').trim();
      if (!promptQuestion) return null;
      const expenseEditActions = typeof inferExpenseRecordEditActionsFromQuestion === 'function'
        ? inferExpenseRecordEditActionsFromQuestion(promptQuestion)
        : [];
      const normalizedEditActions = Array.isArray(expenseEditActions)
        ? expenseEditActions.filter((item) => item && typeof item === 'object' && String(item.type || '').trim())
        : [];
      if (normalizedEditActions.length) {
        return {
          kind: 'write-edit',
          actions: normalizedEditActions,
        };
      }
      return null;
    }

    function resolveMemoryShortcutDecision(question = '') {
      const promptQuestion = String(question || '').trim();
      if (!promptQuestion) return null;
      const implicitMemoryAction = typeof inferImplicitMemoryWriteActionFromConversation === 'function'
        ? inferImplicitMemoryWriteActionFromConversation(promptQuestion)
        : null;
      if (!implicitMemoryAction || typeof implicitMemoryAction !== 'object') return null;
      const actionType = String(implicitMemoryAction.type || '').trim();
      if (!['memory_write_user', 'write_soul_memory', 'memory_rewrite_section'].includes(actionType)) return null;
      const content = String(implicitMemoryAction.content || implicitMemoryAction.text || '').trim();
      if (!content) return null;
      return {
        kind: 'write-memory',
        action: implicitMemoryAction,
      };
    }

    function resolveTimeBlockShortcutDecision(question = '') {
      const promptQuestion = String(question || '').trim();
      if (!promptQuestion) return null;
      if (/(不要|别|无需|不用).{0,10}(时间块|按时间|时段|几点到几点|日程表)/i.test(promptQuestion)) return null;
      const explicitlyAsked = /(时间块|time block|按时间(?:块|段)?|分时段|时段安排|具体到几点|几点到几点|排进日程|排到日程|安排成时间块|日程表|按小时|按时段)/i.test(promptQuestion);
      if (!explicitlyAsked) return null;
      const writeToDaily = /(写进|写入|同步到|放进|放入|记到|记进).{0,12}(日志|今日日志|今天的日志|daily)/i.test(promptQuestion);
      return {
        kind: 'plan-today',
        action: {
          type: 'plan_today_time_blocks',
          writeToDaily,
          explicitWriteToDaily: writeToDaily,
          target: writeToDaily ? 'daily' : '',
        },
      };
    }

    async function handleAICommandShortcutShell(context = {}) {
      const promptQuestion = String(context.promptQuestion || '').trim();
      if (!promptQuestion) return null;
      const recordChat = context.recordChat !== false;
      const userVisibleQuestion = String(context.userVisibleQuestion || promptQuestion).trim();
      const fallbackAttachments = Array.isArray(context.fallbackAttachments) ? context.fallbackAttachments : [];
        const fallbackAttachmentPreviewMeta = Array.isArray(context.fallbackAttachmentPreviewMeta) ? context.fallbackAttachmentPreviewMeta : [];
        const assistantMessageId = context.assistantMessageId || null;
        const aiChatState = context.aiChatState && typeof context.aiChatState === 'object' ? context.aiChatState : getAIChatState();
        const beijingNow = typeof context.getNowInAITimezoneText === 'function' ? context.getNowInAITimezoneText() : '';
        const timingState = context.timingState && typeof context.timingState === 'object' ? context.timingState : null;
        const allowReadShortcuts = context.allowReadShortcuts === true;
        const allowWriteShortcuts = context.allowWriteShortcuts === true;

      try {
        const memoryShortcutDecision = allowWriteShortcuts ? resolveMemoryShortcutDecision(promptQuestion) : null;
        if (memoryShortcutDecision?.kind === 'write-memory' && typeof context.applyAIActions === 'function') {
          const memoryWriteStartedAt = nowMs();
          const applied = await context.applyAIActions([memoryShortcutDecision.action], {
            promptQuestion,
            allowMorphDataActions: true,
          });
          recordTimingPhase(timingState, 'shortcut_memory_write_apply', memoryWriteStartedAt);
          const committed = didShortcutWriteCommit(applied);
          if (committed) {
            if (timingState) timingState.path = 'shortcut-memory-write';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply: buildShortcutAppliedReply(applied),
              applied,
              assistantMessageId,
              recordChat,
              freezeMs: 10000,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'WRITE',
                capability: String(memoryShortcutDecision.action?.type || '').trim() || 'write_soul_memory',
                semanticFamily: 'memory',
                path: String(timingState?.path || '').trim(),
              }),
            });
          }
          if (shouldStopAfterShortcutWriteFailure(applied)) {
            if (timingState) timingState.path = 'shortcut-memory-write-failed';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply: buildShortcutWriteFailureReply(applied, '记忆这边这次没有真正写入成功。请再试一次。'),
              applied,
              assistantMessageId,
              recordChat,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'WRITE',
                capability: String(memoryShortcutDecision.action?.type || '').trim() || 'write_soul_memory',
                semanticFamily: 'memory',
                path: String(timingState?.path || '').trim(),
                status: resolveShortcutWriteFailureStatus(applied),
              }),
            });
          }
        }

        const expenseShortcutDecision = allowWriteShortcuts ? resolveExpenseShortcutDecision(promptQuestion) : null;
        if (expenseShortcutDecision?.kind === 'write-edit' && typeof context.applyAIActions === 'function') {
          const expenseEditStartedAt = nowMs();
          const applied = await context.applyAIActions(expenseShortcutDecision.actions, {
            promptQuestion,
            allowMorphDataActions: true,
          });
          recordTimingPhase(timingState, 'shortcut_expense_edit_apply', expenseEditStartedAt);
          const committed = didShortcutWriteCommit(applied);
          if (committed) {
            if (timingState) timingState.path = 'shortcut-expense-edit';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply: buildShortcutAppliedReply(applied),
              applied,
              assistantMessageId,
              recordChat,
              freezeMs: 10000,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'WRITE',
                capability: String(expenseShortcutDecision.actions?.[0]?.type || '').trim() || 'update_expense_record',
                semanticFamily: 'expense',
                path: String(timingState?.path || '').trim(),
              }),
            });
          }
          if (shouldStopAfterShortcutWriteFailure(applied)) {
            if (timingState) timingState.path = 'shortcut-expense-edit-failed';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply: buildShortcutWriteFailureReply(applied, '账本这边这次没有真正写入成功。请再试一次。'),
              applied,
              assistantMessageId,
              recordChat,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'WRITE',
                capability: String(expenseShortcutDecision.actions?.[0]?.type || '').trim() || 'update_expense_record',
                semanticFamily: 'expense',
                path: String(timingState?.path || '').trim(),
                status: resolveShortcutWriteFailureStatus(applied),
              }),
            });
          }
        }

        const timeBlockShortcutDecision = allowWriteShortcuts ? resolveTimeBlockShortcutDecision(promptQuestion) : null;
        if (timeBlockShortcutDecision?.kind === 'plan-today' && typeof context.applyAIActions === 'function') {
          const timeBlockStartedAt = nowMs();
          const applied = await context.applyAIActions([timeBlockShortcutDecision.action], {
            promptQuestion,
            allowMorphDataActions: true,
          });
          recordTimingPhase(timingState, 'shortcut_today_time_blocks_apply', timeBlockStartedAt);
          const createdItems = Array.isArray(applied?.createdItems) ? applied.createdItems : [];
          const hasTimeBlockDraft = createdItems.some((item) => (
            item
            && String(item.tab || '').trim() === 'timeBlocks'
            && Array.isArray(item.blocks)
            && item.blocks.length > 0
          ));
          if (hasTimeBlockDraft) {
            if (timingState) timingState.path = 'shortcut-today-time-blocks';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply: buildShortcutAppliedReply(applied),
              applied,
              assistantMessageId,
              recordChat,
              freezeMs: 10000,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'PLAN',
                capability: 'plan_today_time_blocks',
                semanticFamily: 'schedule',
                path: String(timingState?.path || '').trim(),
              }),
            });
          }
          if (shouldStopAfterShortcutWriteFailure(applied)) {
            if (timingState) timingState.path = 'shortcut-today-time-blocks-failed';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply: buildShortcutWriteFailureReply(applied, '时间块这边这次没有生成成功。请再试一次。'),
              applied,
              assistantMessageId,
              recordChat,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'PLAN',
                capability: 'plan_today_time_blocks',
                semanticFamily: 'schedule',
                path: String(timingState?.path || '').trim(),
                status: resolveShortcutWriteFailureStatus(applied),
              }),
            });
          }
        }

        if (allowWriteShortcuts && executeExpenseCaptureWithAI) {
          const expenseStartedAt = nowMs();
          const structuredExpenseResult = await executeExpenseCaptureWithAI(promptQuestion, {
            recordChat,
            userVisibleQuestion,
            attachments: fallbackAttachments,
            attachmentPreviewMeta: fallbackAttachmentPreviewMeta,
            webSearchRequested: !!context.webSearchRequested,
            beijingNow,
          });
          recordTimingPhase(timingState, 'shortcut_expense_capture', expenseStartedAt);
          if (structuredExpenseResult?.ok) {
            if (timingState) timingState.path = 'shortcut-expense-write';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply: structuredExpenseResult.reply,
              applied: structuredExpenseResult.applied,
              assistantMessageId,
              recordChat,
              freezeMs: 10000,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'WRITE',
                capability: 'add_expense_record',
                semanticFamily: 'expense',
                path: String(timingState?.path || '').trim(),
              }),
            });
          }
        }

        const reminderShortcutDecision = resolveReminderShortcutDecision(promptQuestion);
        if (allowReadShortcuts && reminderShortcutDecision?.kind === 'read') {
          const reminderReadRequest = reminderShortcutDecision.request;
          const reminderListReply = buildReminderListReply(reminderReadRequest);
          const applied = {
            appliedLabels: [`读取提醒列表：${getReminderList().length} 条`],
            blockedLabels: [],
            blockedReason: '',
            createdItems: [],
            transactionId: '',
            actionExecutionTrace: [],
          };
          if (timingState) timingState.path = 'shortcut-reminder-read';
          markTimingFirstVisible(timingState);
          if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
          return finalizeShortcutAIResult({
            reply: reminderListReply,
            applied,
            assistantMessageId,
            recordChat,
            timingTrace: buildTimingTrace(timingState),
            routeTrace: buildShortcutRouteTrace({
              route: 'READ',
              capability: 'list_reminders',
              semanticFamily: 'workspace_state',
              path: String(timingState?.path || '').trim(),
            }),
          });
        }

        if (allowWriteShortcuts && reminderShortcutDecision?.kind === 'write-add' && typeof context.applyAIActions === 'function') {
          const reminderCreateAction = reminderShortcutDecision.action;
          const reminderApplyStartedAt = nowMs();
          const applied = await context.applyAIActions([reminderCreateAction], {
            promptQuestion,
            allowMorphDataActions: true,
          });
          recordTimingPhase(timingState, 'shortcut_add_reminder_apply', reminderApplyStartedAt);
          const createdItem = Array.isArray(applied?.createdItems) ? applied.createdItems[0] : null;
          const committed = didShortcutWriteCommit({
            ...(applied && typeof applied === 'object' ? applied : {}),
            createdItems: Array.isArray(applied?.createdItems) && applied.createdItems.length
              ? applied.createdItems
              : createdItem ? [createdItem] : [],
          });
          if (committed) {
            const reply = buildShortcutAppliedReply({
              ...(applied && typeof applied === 'object' ? applied : {}),
              createdItems: Array.isArray(applied?.createdItems) && applied.createdItems.length
                ? applied.createdItems
                : [{
                  tab: 'reminders',
                  text: String(reminderCreateAction.text || '').trim(),
                  dueAtText: String(reminderCreateAction.dueAtText || reminderCreateAction.datetime || '').trim(),
                }],
            });
            if (timingState) timingState.path = 'shortcut-reminder-write';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply,
              applied,
              assistantMessageId,
              recordChat,
              freezeMs: 10000,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'WRITE',
                capability: String(reminderCreateAction?.type || '').trim() || 'add_reminder',
                semanticFamily: 'reminder',
                path: String(timingState?.path || '').trim(),
              }),
            });
          }
          if (shouldStopAfterShortcutWriteFailure(applied)) {
            if (timingState) timingState.path = 'shortcut-reminder-write-failed';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply: buildShortcutWriteFailureReply(applied, '提醒这边这次没有真正执行成功。请再试一次。'),
              applied,
              assistantMessageId,
              recordChat,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'WRITE',
                capability: String(reminderCreateAction?.type || '').trim() || 'add_reminder',
                semanticFamily: 'reminder',
                path: String(timingState?.path || '').trim(),
                status: resolveShortcutWriteFailureStatus(applied),
              }),
            });
          }
        }

        const projectReadRequest = inferProjectReadRequestFromQuestion
          ? inferProjectReadRequestFromQuestion(promptQuestion)
          : null;
        if (allowReadShortcuts && projectReadRequest) {
          const projectListReply = buildProjectListReply(projectReadRequest);
          const dataRef = typeof getData === 'function' ? getData() : null;
          const projectCount = Array.isArray(dataRef?.projects) ? dataRef.projects.length : 0;
          const applied = {
            appliedLabels: [`读取项目列表：${projectCount} 个`],
            blockedLabels: [],
            blockedReason: '',
            createdItems: [],
            transactionId: '',
            actionExecutionTrace: [],
          };
          if (timingState) timingState.path = 'shortcut-project-read';
          markTimingFirstVisible(timingState);
          if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
          return finalizeShortcutAIResult({
            reply: projectListReply,
            applied,
            assistantMessageId,
            recordChat,
            timingTrace: buildTimingTrace(timingState),
            routeTrace: buildShortcutRouteTrace({
              route: 'READ',
              capability: 'list_projects',
              semanticFamily: 'workspace_state',
              path: String(timingState?.path || '').trim(),
            }),
          });
        }

        if (allowWriteShortcuts && reminderShortcutDecision?.kind === 'write-edit' && typeof context.applyAIActions === 'function') {
          const logReminderEditAction = reminderShortcutDecision.action;
          const logReminderEditStartedAt = nowMs();
          const applied = await context.applyAIActions([logReminderEditAction], {
            promptQuestion,
            allowMorphDataActions: true,
          });
          recordTimingPhase(timingState, 'shortcut_log_reminder_edit_apply', logReminderEditStartedAt);
          const committed = didShortcutWriteCommit(applied);
          if (committed) {
            if (timingState) timingState.path = 'shortcut-log-reminder-write';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply: buildShortcutAppliedReply(applied),
              applied,
              assistantMessageId,
              recordChat,
              freezeMs: 10000,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'WRITE',
                capability: String(logReminderEditAction?.type || '').trim() || 'update_reminder',
                semanticFamily: 'reminder',
                path: String(timingState?.path || '').trim(),
              }),
            });
          }
          if (shouldStopAfterShortcutWriteFailure(applied)) {
            if (timingState) timingState.path = 'shortcut-log-reminder-write-failed';
            markTimingFirstVisible(timingState);
            if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
            return finalizeShortcutAIResult({
              reply: buildShortcutWriteFailureReply(applied, '这次提醒修改没有真正写入成功。请再试一次。'),
              applied,
              assistantMessageId,
              recordChat,
              timingTrace: buildTimingTrace(timingState),
              routeTrace: buildShortcutRouteTrace({
                route: 'WRITE',
                capability: String(logReminderEditAction?.type || '').trim() || 'update_reminder',
                semanticFamily: 'reminder',
                path: String(timingState?.path || '').trim(),
                status: resolveShortcutWriteFailureStatus(applied),
              }),
            });
          }
        }

        const dailyLogReadRequest = inferDailyLogReadRequestFromQuestion
          ? inferDailyLogReadRequestFromQuestion(promptQuestion)
          : null;
        if (allowReadShortcuts && dailyLogReadRequest) {
          const dailyLogListReply = buildDailyLogListReply(dailyLogReadRequest);
          const applied = {
            appliedLabels: ['读取日志内容'],
            blockedLabels: [],
            blockedReason: '',
            createdItems: [],
            transactionId: '',
            actionExecutionTrace: [],
          };
          if (timingState) timingState.path = 'shortcut-daily-read';
          markTimingFirstVisible(timingState);
          if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
          return finalizeShortcutAIResult({
            reply: dailyLogListReply,
            applied,
            assistantMessageId,
            recordChat,
            timingTrace: buildTimingTrace(timingState),
            routeTrace: buildShortcutRouteTrace({
              route: 'READ',
              capability: 'list_daily_logs',
              semanticFamily: 'workspace_state',
              path: String(timingState?.path || '').trim(),
            }),
          });
        }

        const conversationRecallReadRequest = inferConversationRecallReadRequestFromQuestion
          ? inferConversationRecallReadRequestFromQuestion(promptQuestion)
          : null;
        if (allowReadShortcuts && conversationRecallReadRequest) {
          const conversationRecallReply = buildConversationRecallReply(conversationRecallReadRequest);
          const applied = {
            appliedLabels: ['读取对话历史'],
            blockedLabels: [],
            blockedReason: '',
            createdItems: [],
            transactionId: '',
            actionExecutionTrace: [{ type: 'recall_chat_history', status: 'committed', verifierStatus: 'verified' }],
          };
          if (timingState) timingState.path = 'shortcut-conversation-recall-read';
          markTimingFirstVisible(timingState);
          if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
          return finalizeShortcutAIResult({
            reply: conversationRecallReply,
            applied,
            assistantMessageId,
            recordChat,
            timingTrace: buildTimingTrace(timingState),
            routeTrace: buildShortcutRouteTrace({
              route: 'READ',
              capability: 'recall_chat_history',
              semanticFamily: 'workspace_state',
              path: String(timingState?.path || '').trim(),
            }),
          });
        }

        const recentActionReadRequest = inferRecentActionReadRequestFromQuestion
          ? inferRecentActionReadRequestFromQuestion(promptQuestion)
          : null;
        if (allowReadShortcuts && recentActionReadRequest) {
          const recentActionReply = buildRecentActionListReply(recentActionReadRequest);
          const applied = {
            appliedLabels: ['读取最近操作'],
            blockedLabels: [],
            blockedReason: '',
            createdItems: [],
            transactionId: '',
            actionExecutionTrace: [],
          };
          if (timingState) timingState.path = 'shortcut-recent-actions-read';
          markTimingFirstVisible(timingState);
          if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
          return finalizeShortcutAIResult({
            reply: recentActionReply,
            applied,
            assistantMessageId,
            recordChat,
            timingTrace: buildTimingTrace(timingState),
            routeTrace: buildShortcutRouteTrace({
              route: 'READ',
              capability: 'list_recent_actions',
              semanticFamily: 'workspace_state',
              path: String(timingState?.path || '').trim(),
            }),
          });
        }

        const taskAlignmentReadRequest = inferTaskAlignmentReadRequestFromQuestion
          ? inferTaskAlignmentReadRequestFromQuestion(promptQuestion)
          : null;
        if (allowReadShortcuts && taskAlignmentReadRequest) {
          const taskAlignmentReply = buildTaskAlignmentReply(taskAlignmentReadRequest);
          const applied = {
            appliedLabels: ['读取最近安排建议'],
            blockedLabels: [],
            blockedReason: '',
            createdItems: [],
            transactionId: '',
            actionExecutionTrace: [],
          };
          if (timingState) timingState.path = 'shortcut-task-alignment-read';
          markTimingFirstVisible(timingState);
          if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
          return finalizeShortcutAIResult({
            reply: taskAlignmentReply,
            applied,
            assistantMessageId,
            recordChat,
            timingTrace: buildTimingTrace(timingState),
            routeTrace: buildShortcutRouteTrace({
              route: 'PLAN',
              capability: 'summarize_next_actions',
              semanticFamily: 'next_actions',
              path: String(timingState?.path || '').trim(),
            }),
          });
        }
      } catch (shortcutError) {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn('[Morpheus] shortcut shell failed, fallback to main chat path —', shortcutError?.name || 'Error', ':', shortcutError?.message || shortcutError);
        }
      }

      return null;
    }

    async function executeAICommandWithQuestion(context = {}) {
      Object.assign(context, api);
      const extractedQuestion = extractLikelyUserTaskFromMixedMessage(String(context.question || ''));
      const promptQuestion = String(extractedQuestion.promptQuestion || '').trim();
      const recordChat = context.recordChat !== false;
      const userVisibleQuestion = String(extractedQuestion.userVisibleQuestion || promptQuestion).trim();
      const sourceAttachments = Array.isArray(context.attachments)
        ? context.attachments
        : Array.isArray(context.fallbackAttachments)
          ? context.fallbackAttachments
          : [];
      const fallbackAttachments = Array.isArray(sourceAttachments)
        ? sourceAttachments.map((item) => ({ ...item, mode: normalizeAIChatAttachmentMode(item.mode) }))
        : [];
      const fallbackAttachmentPreviewMeta = buildAIChatAttachmentPreviewMeta(fallbackAttachments);
      const aiChatState = context.aiChatState && typeof context.aiChatState === 'object' ? context.aiChatState : getAIChatState();
      if (!promptQuestion || aiChatState.busy) return { ok: false };
      if (!getCurrentAIKey()) {
        openCustomModal({ title: "未配置 AI 密钥", desc: `请先在设置中填写 ${getAIProviderDisplayLabel()} API Key，再使用 AI 对话。` });
        return { ok: false };
      }
      let assistantMessageId = null;
      const timingState = createTimingState();
      aiChatState.busy = true;
      aiChatState.busyStartedAt = Date.now();
      if (recordChat) {
        // Keep the optimistic user bubble lightweight on the main thread first,
        // then let the normal debounced persistence catch up in the background.
        pushAIChatMessage('user', userVisibleQuestion, fallbackAttachmentPreviewMeta.length ? { attachments: fallbackAttachmentPreviewMeta } : null, {
          syncData: false,
          persistLocal: false,
          skipRender: true,
          forceScroll: true,
        });
        assistantMessageId = pushAIChatMessage('assistant', getAIThinkingFrame('思考中', 0), null, {
          syncData: false,
          persistLocal: false,
          skipRender: true,
          forceScroll: true,
        });
        aiChatState.currentAssistantMessageId = assistantMessageId;
        startAIThinkingIndicator(assistantMessageId, '思考中');
      }
      if (recordChat) {
        requestAIChatRender();
        scheduleAIChatHistoryPersistence();
      } else {
        syncMobileQuickComposeIcon();
      }
      syncAIInputLoadingState();
      stopAITTSPlayback();
      aiChatState.abortController = AbortControllerCtor ? new AbortControllerCtor() : null;
      let bestStreamedReply = '';
      try {
        return await continueAICommandWithQuestion({
          promptQuestion,
          recordChat,
          userVisibleQuestion,
          fallbackAttachments,
          fallbackAttachmentPreviewMeta,
          aiChatState,
          assistantMessageId,
          bestStreamedReply,
          webSearchRequested: !!context.webSearchRequested,
          extractedQuestion,
          applyAIActions,
          timingState,
          allowReadShortcuts: context.allowReadShortcuts === true,
          allowWriteShortcuts: context.allowWriteShortcuts === true,
        });
      } catch (err) {
        stopAIThinkingIndicator();
        if (err?.name === 'AbortError') {
          if (recordChat && assistantMessageId) {
            const current = aiChatState.messages.find((msg) => msg.id === assistantMessageId);
            const existing = String(current?.content || '').trim();
            updateAIChatMessage(assistantMessageId, {
              content: existing || '已停止生成。',
              meta: current?.meta || null,
            });
          }
          return { ok: false, aborted: true };
        } else {
          if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error('[Morpheus] executeAICommandWithQuestion caught —', err?.name || 'Error', ':', err?.message || err, '\nstack:', err?.stack || '(no stack)');
          }
          const readableError = getReadableAIErrorMessage(err);
          if (recordChat && assistantMessageId) {
            const current = aiChatState.messages.find((msg) => msg.id === assistantMessageId);
            const existingReply = String(current?.content || '').trim();
            const hasSubstantiveReply = existingReply && existingReply.length > 20 && !/(思考中|加载中|正在)/.test(existingReply);
            if (hasSubstantiveReply) {
              updateAIChatMessage(assistantMessageId, {
                content: `${existingReply}\n\n（注意：尝试执行操作时遇到了内部问题，没有真正写入。你可以再试一次。）`,
                meta: current?.meta || null,
              });
            } else {
              updateAIChatMessage(assistantMessageId, {
                content: readableError,
                meta: null,
              });
            }
          } else {
            openCustomModal({ title: 'AI 执行失败', desc: readableError });
          }
          return { ok: false, error: err };
        }
      } finally {
        stopAIThinkingIndicator();
        aiChatState.abortController = null;
        aiChatState.currentAssistantMessageId = null;
        aiChatState.busy = false;
        aiChatState.busyStartedAt = 0;
        syncAIInputLoadingState();
        if (recordChat) requestAIChatRender();
        else syncMobileQuickComposeIcon();
      }
    }

    async function continueAICommandWithQuestion(context = {}) {
      Object.assign(context, api);
      const promptQuestion = String(context.promptQuestion || '').trim();
      const recordChat = context.recordChat !== false;
      const userVisibleQuestion = String(context.userVisibleQuestion || promptQuestion).trim();
      const fallbackAttachments = Array.isArray(context.fallbackAttachments) ? context.fallbackAttachments : [];
      const fallbackAttachmentPreviewMeta = Array.isArray(context.fallbackAttachmentPreviewMeta) ? context.fallbackAttachmentPreviewMeta : [];
      const aiChatState = context.aiChatState && typeof context.aiChatState === 'object' ? context.aiChatState : getAIChatState();
      const attachmentPreviewMeta = fallbackAttachmentPreviewMeta;
      const timingState = context.timingState && typeof context.timingState === 'object'
        ? context.timingState
        : createTimingState();
      const aiRequestMetricsCursor = typeof context.getAIRequestMetricsCount === 'function'
        ? Math.max(0, Number(context.getAIRequestMetricsCount() || 0) || 0)
        : 0;
      if (!promptQuestion) return { ok: false };
      if (recordChat && attachmentPreviewMeta.length) {
        const userMessage = Array.isArray(aiChatState.messages)
          ? aiChatState.messages.find((msg) => msg.role === 'user' && String(msg.content || '').trim() === userVisibleQuestion)
          : null;
        if (userMessage) {
          userMessage.meta = { ...(userMessage.meta || {}), attachments: attachmentPreviewMeta };
          if (typeof context.persistAIChatHistory === 'function') {
            context.persistAIChatHistory({ syncData: false, skipRender: true });
          }
        }
      }
      const waitFrameStartedAt = nowMs();
      await new Promise((resolve) => raf(() => resolve()));
      recordTimingPhase(timingState, 'wait_for_next_frame', waitFrameStartedAt);
      const shortcutResult = await handleAICommandShortcutShell({
        promptQuestion,
        recordChat,
        userVisibleQuestion,
        fallbackAttachments,
        fallbackAttachmentPreviewMeta,
        aiChatState,
        assistantMessageId: context.assistantMessageId || null,
        webSearchRequested: !!context.webSearchRequested,
        getNowInAITimezoneText: typeof context.getNowInAITimezoneText === 'function' ? context.getNowInAITimezoneText : null,
        stopAIThinkingIndicator: typeof context.stopAIThinkingIndicator === 'function' ? context.stopAIThinkingIndicator : null,
        buildCurrentAIExecutionConfig: typeof context.buildCurrentAIExecutionConfig === 'function' ? context.buildCurrentAIExecutionConfig : null,
        applyAIActions: typeof context.applyAIActions === 'function' ? context.applyAIActions : null,
        getData,
        timingState,
        allowReadShortcuts: context.allowReadShortcuts === true,
        allowWriteShortcuts: context.allowWriteShortcuts === true,
      });
      if (shortcutResult) {
        return shortcutResult;
      }
      const executionContextStartedAt = nowMs();
      const executionContext = context.executionContext && typeof context.executionContext === 'object'
        ? context.executionContext
        : aiOrchestrationModules && typeof aiOrchestrationModules.prepareAIExecutionContext === 'function'
          ? await aiOrchestrationModules.prepareAIExecutionContext(promptQuestion, {
            attachments: fallbackAttachments,
            webSearchRequested: !!context.webSearchRequested,
          })
          : null;
      recordTimingPhase(timingState, 'prepare_execution_context', executionContextStartedAt);
      const latencyMode = String(executionContext?.latencyMode || 'full').trim().toLowerCase();
      timingState.latencyMode = latencyMode;
      const useLowLatencyPath = latencyMode === 'fast';
      const safeAttachments = Array.isArray(executionContext?.safeAttachments)
        ? executionContext.safeAttachments
        : fallbackAttachments;
      const attachmentContext = typeof executionContext?.attachmentContext === 'string'
        ? executionContext.attachmentContext
        : typeof context.buildAIChatAttachmentPromptContext === 'function'
          ? context.buildAIChatAttachmentPromptContext(safeAttachments)
          : '';
      const pluginPromptContexts = Array.isArray(executionContext?.pluginPromptContexts)
        ? executionContext.pluginPromptContexts
        : useLowLatencyPath
          ? []
          : typeof context.buildPluginAIReadableContexts === 'function'
            ? await context.buildPluginAIReadableContexts(promptQuestion, { latencyMode })
            : [];
      const hasPreparedWebSearchBundle = !!(executionContext && Object.prototype.hasOwnProperty.call(executionContext, 'webSearchBundle'));
      const webSearchBundle = hasPreparedWebSearchBundle
        ? (executionContext?.webSearchBundle || null)
        : typeof context.fetchWebSearchContext === 'function'
          ? await context.fetchWebSearchContext(promptQuestion, { force: !!context.webSearchRequested })
          : null;
      const snapshot = executionContext?.snapshot || (typeof context.buildAIWorkspaceSnapshot === 'function' ? context.buildAIWorkspaceSnapshot(promptQuestion) : {});
      const currentTab = typeof getCurrentTab === 'function' ? getCurrentTab() : '';
      const selectedDailyMonth = typeof getSelectedDailyMonth === 'function' ? getSelectedDailyMonth() : '';
      const currentProject = typeof getCurrentProject === 'function' ? getCurrentProject() : null;
      const responseMode = executionContext?.responseMode || snapshot?.samples?.responseMode || (typeof context.inferMorphResponseMode === 'function'
        ? context.inferMorphResponseMode(promptQuestion, {
          tab: snapshot?.currentView?.tab || currentTab,
          selectedDailyMonth: snapshot?.currentView?.selectedDailyMonth || selectedDailyMonth,
          activeProject: snapshot?.currentView?.activeProject || currentProject,
          currentTaskState: snapshot?.samples?.currentTaskState || null,
          currentWorkflowState: snapshot?.samples?.currentWorkflowState || null,
        })
        : { mode: 'solve' });
      const skillPromptContext = typeof executionContext?.skillPromptContext === 'string'
        ? executionContext.skillPromptContext
        : typeof context.buildBundledSkillPromptContext === 'function'
          ? await context.buildBundledSkillPromptContext(promptQuestion)
          : '';
      const activeSkillIds = Array.isArray(executionContext?.activeSkillIds)
        ? executionContext.activeSkillIds.filter((item) => typeof item === 'string' && item.trim())
        : typeof context.buildBundledActiveSkillIds === 'function'
          ? await context.buildBundledActiveSkillIds(promptQuestion)
          : [];
      const beijingNow = executionContext?.beijingNow || (typeof context.getNowInAITimezoneText === 'function' ? context.getNowInAITimezoneText() : '');
      const temporalFrame = snapshot?.samples?.temporalFrame || null;
      const runtime = executionContext?.runtime || getMorphRuntimeBundle();
      const currentPluginId = String(executionContext?.currentPluginId || snapshot?.currentView?.activeLocalPluginWorkspaceId || '').trim();
      const currentAIConfig = executionContext?.currentAIConfig && typeof executionContext.currentAIConfig === 'object'
        ? executionContext.currentAIConfig
        : (typeof context.buildCurrentAIExecutionConfig === 'function' ? context.buildCurrentAIExecutionConfig() : null);
      timingState.provider = String(currentAIConfig?.provider || '').trim();
      const isRoleConflictQuery = typeof context.isExternalAssistantConflictQuery === 'function'
        ? context.isExternalAssistantConflictQuery(promptQuestion)
        : false;
      const allowMorphDataActions = typeof executionContext?.allowMorphDataActions === 'boolean'
        ? executionContext.allowMorphDataActions
        : typeof context.shouldTreatAsMorphDataOperation === 'function'
          ? context.shouldTreatAsMorphDataOperation(promptQuestion)
          : false;
      const directUndoAction = allowMorphDataActions
        ? inferImplicitUndoActionFromConversation(promptQuestion)
        : null;
      const directActionOverride = directUndoAction && String(directUndoAction.type || '').trim() === 'undo_last_ai_transaction'
        ? [{
          ...directUndoAction,
          source: String(directUndoAction.source || 'system-undo-inference').trim() || 'system-undo-inference',
        }]
        : [];
      const relevantSources = Array.isArray(snapshot?.samples?.relevantSources) ? snapshot.samples.relevantSources.slice(0, 5) : [];
      const webCitations = Array.isArray(webSearchBundle?.citations) ? webSearchBundle.citations.slice(0, 3) : [];
      const relevantChains = Array.isArray(snapshot?.samples?.citationChains) ? snapshot.samples.citationChains.slice(0, 4) : [];
      let prompt = '';
      if (!directActionOverride.length) {
        const promptBuildStartedAt = nowMs();
        prompt = aiPromptBuilderModules && typeof aiPromptBuilderModules.buildMainAIPrompt === 'function'
          ? aiPromptBuilderModules.buildMainAIPrompt({
            extractedQuestion: context.extractedQuestion || extractLikelyUserTaskFromMixedMessage(promptQuestion),
            promptQuestion,
            webSearchRequested: !!context.webSearchRequested,
            beijingNow,
            temporalFrame,
            responseMode,
            snapshot,
            runtime,
            isRoleConflictQuery,
            allowMorphDataActions,
            attachmentContext,
            skillPromptContext,
            pluginPromptContexts,
            webSearchBundle,
            aiPersonaContext: typeof context.getAIPersonaAssignmentText === 'function' ? context.getAIPersonaAssignmentText() : '',
          })
          : '';
        recordTimingPhase(timingState, 'build_prompt', promptBuildStartedAt);
      }

      // --- Tool Use path: when data actions are allowed, try native function calling first ---
      const aiToolDefsRuntime = typeof window !== 'undefined' && window.MorphAIToolDefinitionsRuntime && typeof window.MorphAIToolDefinitionsRuntime.create === 'function'
        ? window.MorphAIToolDefinitionsRuntime.create({
          getPreferredMorphPromptActionTypes: typeof context.getPreferredMorphPromptActionTypes === 'function' ? context.getPreferredMorphPromptActionTypes : undefined,
        })
        : null;
      let toolUseActions = [];
      let toolUseReplyContent = '';
      let usedToolUsePath = false;
      if (!directActionOverride.length && allowMorphDataActions && aiToolDefsRuntime && typeof context.requestAIWithTools === 'function') {
        try {
          const toolDefs = typeof aiToolDefsRuntime.buildMorphToolDefinitions === 'function'
            ? aiToolDefsRuntime.buildMorphToolDefinitions({
              allowMorphDataActions: true,
              activeSkillIds,
              promptQuestion,
            })
            : [];
          if (toolDefs.length) {
            const toolUseStartedAt = nowMs();
            const toolMsg = await context.requestAIWithTools(prompt, {
              tools: toolDefs,
              signal: aiChatState.abortController?.signal,
            });
            recordTimingPhase(timingState, 'tool_use_request', toolUseStartedAt);
            if (Array.isArray(toolMsg?.tool_calls) && toolMsg.tool_calls.length > 0) {
              toolUseActions = typeof aiToolDefsRuntime.convertToolCallsToActions === 'function'
                ? aiToolDefsRuntime.convertToolCallsToActions(toolMsg.tool_calls)
                : [];
              toolUseReplyContent = String(toolMsg.content || '').trim();
              usedToolUsePath = toolUseActions.length > 0;
            }
          }
        } catch (_toolErr) {
          // Tool use failed — fall through to legacy stream path
        }
      }

      let rawText = '';
      if (!usedToolUsePath && !directActionOverride.length) {
        // --- Legacy stream path ---
        try {
          const requestAITextStartedAt = nowMs();
          rawText = await (typeof context.requestAIText === 'function'
            ? context.requestAIText(prompt, {
              stream: true,
              onProgress: (streamedText) => {
                markTimingFirstVisible(timingState);
                if (!aiResponseHandlerModules || typeof aiResponseHandlerModules.handleStreamProgress !== 'function') return;
                const next = aiResponseHandlerModules.handleStreamProgress(streamedText, {
                  recordChat,
                  promptQuestion,
                  assistantMessageId: context.assistantMessageId || null,
                  bestStreamedReply: context.bestStreamedReply || '',
                });
                context.assistantMessageId = next.assistantMessageId || context.assistantMessageId || null;
                context.bestStreamedReply = next.bestStreamedReply || context.bestStreamedReply || '';
              },
              signal: aiChatState.abortController?.signal,
            })
            : Promise.resolve(''));
          recordTimingPhase(timingState, 'request_ai_text_stream', requestAITextStartedAt);
          timingState.path = 'legacy-stream';
        } catch (_) {
          const hadStreamProgress = !!context.assistantMessageId || !!String(context.bestStreamedReply || '').trim();
          if (typeof context.isRunningInNativeIOSShell === 'function' && context.isRunningInNativeIOSShell() && !hadStreamProgress) {
            try {
              const nativeStreamStartedAt = nowMs();
              rawText = await context.requestAIText(prompt, {
                stream: true,
                preferNativeIOS: true,
                onProgress: (streamedText) => {
                  markTimingFirstVisible(timingState);
                  if (!aiResponseHandlerModules || typeof aiResponseHandlerModules.handleStreamProgress !== 'function') return;
                  const next = aiResponseHandlerModules.handleStreamProgress(streamedText, {
                    recordChat,
                    promptQuestion,
                    assistantMessageId: context.assistantMessageId || null,
                    bestStreamedReply: context.bestStreamedReply || '',
                  });
                  context.assistantMessageId = next.assistantMessageId || context.assistantMessageId || null;
                  context.bestStreamedReply = next.bestStreamedReply || context.bestStreamedReply || '';
                },
                signal: aiChatState.abortController?.signal,
              });
              recordTimingPhase(timingState, 'request_ai_text_stream_native_ios', nativeStreamStartedAt);
              timingState.path = 'legacy-stream-native-ios';
            } catch (_) {
              const nonStreamStartedAt = nowMs();
              rawText = await context.requestAIText(prompt, { stream: false, signal: aiChatState.abortController?.signal });
              recordTimingPhase(timingState, 'request_ai_text_nonstream', nonStreamStartedAt);
              timingState.path = 'legacy-nonstream';
            }
          } else {
            const nonStreamStartedAt = nowMs();
            rawText = await context.requestAIText(prompt, { stream: false, signal: aiChatState.abortController?.signal });
            recordTimingPhase(timingState, 'request_ai_text_nonstream', nonStreamStartedAt);
            timingState.path = 'legacy-nonstream';
          }
        }
      }
      if (usedToolUsePath) timingState.path = 'tool-use';
      if (directActionOverride.length) timingState.path = 'direct-undo';

      // --- Derive actions and reply ---
      let derivedResponse = null;
      let derivedActions = [];
      if (directActionOverride.length) {
        derivedActions = directActionOverride;
        derivedResponse = { reply: '', effectiveActions: directActionOverride, weakReplyPatterns: [] };
      } else if (usedToolUsePath) {
        derivedActions = toolUseActions;
        derivedResponse = { reply: toolUseReplyContent, effectiveActions: toolUseActions, weakReplyPatterns: [] };
      } else {
        const deriveStartedAt = nowMs();
        derivedResponse = aiResponseHandlerModules && typeof aiResponseHandlerModules.deriveStructuredResult === 'function'
          ? aiResponseHandlerModules.deriveStructuredResult(rawText, {
            promptQuestion,
            recordChat,
            assistantMessageId: context.assistantMessageId || null,
            bestStreamedReply: context.bestStreamedReply || '',
          })
          : null;
        recordTimingPhase(timingState, 'derive_structured_result', deriveStartedAt);
        derivedActions = Array.isArray(derivedResponse?.effectiveActions) ? derivedResponse.effectiveActions : [];
      }
      const canExecuteModelActions = allowMorphDataActions === true;
      const extractActionsStartedAt = nowMs();
      const extractedActionResult = (!canExecuteModelActions || derivedActions.length || usedToolUsePath)
        ? null
        : aiOrchestrationModules && typeof aiOrchestrationModules.executeMorphActionExtractionWithAI === 'function'
          ? await aiOrchestrationModules.executeMorphActionExtractionWithAI(promptQuestion, {
            allowMorphDataActions,
            beijingNow,
            skillPromptContext,
          })
          : null;
      if (!(derivedActions.length || usedToolUsePath)) {
        recordTimingPhase(timingState, 'extract_actions', extractActionsStartedAt);
      }
      const extractedActions = Array.isArray(extractedActionResult?.actions) ? extractedActionResult.actions : [];
      const effectiveAllowMorphDataActions = allowMorphDataActions;
      let effectiveActions = usedToolUsePath
        ? toolUseActions
        : (canExecuteModelActions
          ? (derivedActions.length
            ? derivedActions
            : extractedActions)
          : []);
      let reply = String(derivedResponse?.reply || '').trim();
      const weakReplyPatterns = Array.isArray(derivedResponse?.weakReplyPatterns) ? derivedResponse.weakReplyPatterns : [];
      const handleActionProgress = (progress = {}) => {
        if (!recordChat || !context.assistantMessageId) return;
        const nextLabel = String(progress.label || progress.message || '处理中').trim() || '处理中';
        if (typeof context.startAIThinkingIndicator === 'function') {
          context.startAIThinkingIndicator(context.assistantMessageId, nextLabel);
        }
        if (typeof context.updateAIChatMessage === 'function') {
          context.updateAIChatMessage(context.assistantMessageId, {
            content: getAIThinkingFrame(nextLabel, 0),
          }, {
            syncData: false,
            skipRender: true,
          });
        }
        if (typeof context.requestAIChatRender === 'function') {
          context.requestAIChatRender();
        }
      };
      const applyActionsStartedAt = nowMs();
      let applied = await (typeof context.applyAIActions === 'function'
        ? context.applyAIActions(effectiveActions || [], { promptQuestion, allowMorphDataActions: effectiveAllowMorphDataActions, currentPluginId, currentAIConfig, onActionProgress: handleActionProgress })
        : Promise.resolve({ appliedLabels: [], createdItems: [], blockedLabels: [], blockedReason: '', actionExecutionTrace: [], transactionId: '' }));
      recordTimingPhase(timingState, 'apply_actions', applyActionsStartedAt);
      const finalizeReplyStartedAt = nowMs();
      const finalizedResponse = aiResponseHandlerModules && typeof aiResponseHandlerModules.finalizeReply === 'function'
        ? await aiResponseHandlerModules.finalizeReply({
          reply,
          safeAttachments,
          webCitations,
          relevantSources,
          relevantChains,
          promptQuestion,
          snapshot,
          effectiveActions,
          applied,
          weakReplyPatterns,
        })
        : null;
      recordTimingPhase(timingState, 'finalize_reply', finalizeReplyStartedAt);
      reply = String(finalizedResponse?.reply || reply || '').trim();
      const appliedLabels = Array.isArray(finalizedResponse?.appliedLabels) ? finalizedResponse.appliedLabels : (applied.appliedLabels || []);
      if (!reply && appliedLabels.length > 0) {
        const fallbackReceipt = typeof context.buildAppliedActionReceiptReply === 'function'
          ? String(context.buildAppliedActionReceiptReply(applied) || '').trim()
          : '';
        reply = fallbackReceipt || String(appliedLabels[0] || '').trim();
      }
      if (typeof context.stopAIThinkingIndicator === 'function') context.stopAIThinkingIndicator();
      markTimingFirstVisible(timingState);
      const timingTrace = buildTimingTrace(timingState);
      const aiRequestTrace = buildAIRequestTrace(
        typeof context.readAIRequestMetricsSince === 'function' ? context.readAIRequestMetricsSince(aiRequestMetricsCursor) : [],
        timingTrace,
      );
      if (recordChat) {
        const assistantMetaBase = aiResponseHandlerModules && typeof aiResponseHandlerModules.buildAssistantMeta === 'function'
          ? aiResponseHandlerModules.buildAssistantMeta({
            applied,
            relevantSources,
            webCitations,
            relevantChains,
          })
          : { actions: appliedLabels, createdItems: applied.createdItems || [], citations: relevantSources.concat(webCitations).slice(0, 6), citationChains: relevantChains };
        const assistantMeta = mergeAssistantMetaWithTiming(assistantMetaBase, timingTrace);
        if (aiRequestTrace) assistantMeta.aiRequestTrace = aiRequestTrace;
        if (!context.assistantMessageId) {
          context.assistantMessageId = typeof context.pushAIChatMessage === 'function'
            ? context.pushAIChatMessage('assistant', reply, assistantMeta)
            : null;
          if (context.assistantMessageId && aiChatState) aiChatState.currentAssistantMessageId = context.assistantMessageId;
        } else if (typeof context.updateAIChatMessage === 'function') {
          context.updateAIChatMessage(context.assistantMessageId, {
            content: reply,
            meta: assistantMeta,
          });
        }
        aiChatState.freezeSessionUntil = Date.now() + 10000;
        if (typeof context.persistAIChatHistory === 'function') {
          context.persistAIChatHistory({ syncData: true, skipRender: true, flushNow: true });
        }
        if (typeof context.ensureAIChatSessionAutoTitle === 'function') {
          context.ensureAIChatSessionAutoTitle(aiChatState.sessionId);
        }
      } else if (!appliedLabels.length && reply && typeof context.openCustomModal === 'function') {
        context.openCustomModal({ title: 'AI 已返回内容', desc: reply.slice(0, 2000) });
      }
      try {
        if (typeof context.speakAIReplyWithTTS === 'function') {
          await context.speakAIReplyWithTTS(reply);
        }
      } catch (ttsError) {
        console.warn('[Morpheus] CosyVoice playback failed.', ttsError);
        if (typeof context.setAISettingsFeedback === 'function') {
          context.setAISettingsFeedback(`CosyVoice 播放失败：${ttsError?.message || '未知错误'}`, true);
        }
      }
      return { ok: true, reply, applied, timingTrace, aiRequestTrace };
    }

    return {
      executeAICommandWithQuestion,
      continueAICommandWithQuestion,
    };
  }

  window.MorphAITurnRuntime = {
    create: createAITurnRuntimeModules,
  };
})();
