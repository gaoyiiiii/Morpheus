// @ts-check

/** @typedef {import('../../interfaces').AIChatAttachment} MorphAIChatAttachment */
/** @typedef {import('../../interfaces').AIChatInputRef} ChatControllerInputRef */
/** @typedef {import('../../interfaces').AIChatMessageMeta} ChatControllerMessageMeta */
/** @typedef {import('../../interfaces').AIChatPersistOptions} ChatControllerPersistOptions */
/** @typedef {import('../../interfaces').AIChatPreExecutionResult} MorphAIChatPreExecutionResult */
/** @typedef {import('../../interfaces').AIChatSendContext} MorphAIChatSendContext */

(function () {
  /**
   * @typedef {object} AIChatControllerDeps
   * @property {() => (ChatControllerInputRef | null)} getAIChatInputElement
   * @property {() => MorphAIChatAttachment[]} cloneAIChatDraftAttachments
   * @property {(question: string) => string} buildAIPendingScriptWorkflowPrompt
   * @property {(question: string) => string} buildAIPendingTimeBlockPrompt
   * @property {(mode: string) => NonNullable<MorphAIChatAttachment['mode']>} normalizeAIChatAttachmentMode
   * @property {() => boolean} isPendingOnboardingIntent
   * @property {() => boolean} isPendingWebSearchIntent
   * @property {(input: ChatControllerInputRef | null, options?: { syncMobileLayout?: boolean }) => void} resetComposerInput
   * @property {() => boolean} isAIOnboardingActive
   * @property {(question: string) => boolean} shouldStartAIOnboarding
   * @property {(role: string, content: string, meta?: ChatControllerMessageMeta | null, options?: ChatControllerPersistOptions) => string} pushAIChatMessage
   * @property {() => void} clearAIPendingOnboardingIntent
   * @property {(prefillContext?: string) => void} startAIOnboarding
   * @property {(answer: string) => void} processAIOnboardingInput
   * @property {() => void} clearAIChatDraftAttachments
   * @property {() => void} clearAIPendingScriptWorkflowIntent
   * @property {() => void} clearAIPendingTimeBlockIntent
   * @property {() => void} clearAIPendingWebSearchIntent
 * @property {() => void} clearAIPendingUtilityCategory
 * @property {() => boolean} isMobileNavMode
 * @property {() => string} getCurrentTab
 * @property {(value: boolean) => void} setMobileAIComposeActive
 * @property {() => void} syncMobileBottomNavState
 * @property {() => void} syncMobileQuickComposeButton
 * @property {() => (boolean | null | undefined)} [getAIChatUtilityMenuOpen]
 * @property {(value: boolean) => void} [setAIChatUtilityMenuOpen]
 * @property {() => ({ busy?: boolean } | null)} [getAIChatState]
 * @property {() => boolean} [isAIChatBusy]
 * @property {() => ({ running?: boolean, finalText?: string, interimText?: string } | null)} [getAIVoiceState]
 * @property {() => boolean} [isAIVoiceRunning]
 * @property {() => void} [stopAIVoiceRecognition]
 * @property {() => void} [healStuckAIChatBusyState]
 * @property {(input: ChatControllerInputRef | null) => { input?: ChatControllerInputRef | null, question?: string }} [resolveAIChatSendInputContext]
 * @property {(input: ChatControllerInputRef | null, options?: number | { syncMobileLayout?: boolean }) => void} [resizeComposerTextarea]
 * @property {(mode: string) => void} [syncComposerLayoutState]
 * @property {() => void} [syncMobileContextDetailInputState]
 * @property {(input?: ChatControllerInputRef | null) => boolean} [shouldUseExplicitAIWebSearch]
 * @property {() => string} [getCurrentAIKey]
 * @property {() => string} [getAIProviderDisplayLabel]
 * @property {(options: { title: string, desc: string, actionText?: string }) => void} [openCustomModal]
 * @property {(question: string, options?: { recordChat?: boolean, attachments?: MorphAIChatAttachment[], webSearchRequested?: boolean }) => Promise<any>} [executeAICommandWithQuestion]
 * @property {(ctx?: { question?: string, input?: ChatControllerInputRef | null }) => (MorphAIChatPreExecutionResult | null)} [dispatchLocalComposerCommands]
 * @property {(value: boolean) => void} [setMobileDailyAIComposeActive]
 * @property {(value: boolean) => void} [setMobileHealthAIComposeActive]
 * @property {() => void} [stopMobileQuickVoiceInput]
 * @property {(options?: { clearInput?: boolean }) => void} [resetMobileQuickVoiceState]
 * @property {() => void} [requestRenderAll]
 * @property {() => void} [renderGlucoseHealthView]
  */

  /**
   * @param {AIChatControllerDeps} deps
   */
  function createAIChatControllerModules(deps) {
    const api = /** @type {AIChatControllerDeps} */ (deps && typeof deps === 'object' ? deps : {});

    /**
     * @param {ChatControllerInputRef | null | undefined} input
     * @param {string} draftQuestion
     * @returns {void}
     */
    function restoreDraftToComposer(input, draftQuestion) {
      if (!input || !draftQuestion) return;
      input.value = draftQuestion;
      if (typeof api.resizeComposerTextarea === 'function') {
        api.resizeComposerTextarea(input, input.id === 'omni-input' ? 132 : 120);
      }
      if (input.id === 'mobile-detail-input' && typeof api.syncMobileContextDetailInputState === 'function') {
        api.syncMobileContextDetailInputState();
      } else if (input.id === 'ai-chat-input' && typeof api.syncComposerLayoutState === 'function') {
        api.syncComposerLayoutState('ai-chat');
      } else if (typeof api.syncComposerLayoutState === 'function') {
        api.syncComposerLayoutState('omni');
      }
      try {
        const len = input.value.length;
        if (typeof input.focus === 'function') input.focus();
        if (typeof input.setSelectionRange === 'function') input.setSelectionRange(len, len);
      } catch (_) {}
    }

    /**
     * @returns {MorphAIChatSendContext}
     */
    function prepareSendContext() {
      const input = api.getAIChatInputElement();
      const question = String(input?.value || '').trim();
      const attachments = api.cloneAIChatDraftAttachments();
      const pendingScriptWorkflowPrompt = api.buildAIPendingScriptWorkflowPrompt(question);
      const pendingTimeBlockPrompt = api.buildAIPendingTimeBlockPrompt(question);
      const onboardingRequested = !!api.isPendingOnboardingIntent();
      const webSearchRequested = !!api.isPendingWebSearchIntent();
      const fallbackQuestion = attachments.length
        ? '参考这些附件，结合它们回答我的问题。'
        : '';
      const finalQuestion = pendingScriptWorkflowPrompt || pendingTimeBlockPrompt || question || fallbackQuestion;
      return {
        input,
        question,
        attachments,
        onboardingRequested,
        webSearchRequested,
        finalQuestion,
      };
    }

    /**
     * @param {ChatControllerInputRef | null | undefined} input
     * @returns {void}
     */
    function resetComposerForSend(input) {
      if (!input) return;
      api.resetComposerInput(input, {
        syncMobileLayout: input.id === 'mobile-detail-input',
      });
    }

    /**
     * @param {{ question?: string, onboardingRequested?: boolean, input?: ChatControllerInputRef | null }} [context]
     * @returns {MorphAIChatPreExecutionResult}
     */
    function handlePreExecutionRoutes(context = {}) {
      const question = String(context.question || '');
      if (typeof api.dispatchLocalComposerCommands === 'function') {
        const local = api.dispatchLocalComposerCommands({ question, input: context.input || null });
        if (local && local.handled) return local;
      }
      if (context.onboardingRequested && !api.isAIOnboardingActive()) {
        const onboardingContext = question;
        api.pushAIChatMessage('user', onboardingContext || '开始偏好引导', null, { flushNow: true, forceScroll: true });
        api.clearAIPendingOnboardingIntent();
        api.startAIOnboarding(onboardingContext);
        return { handled: true };
      }
      if (api.shouldStartAIOnboarding(question) && !api.isAIOnboardingActive()) {
        api.pushAIChatMessage('user', question, null, { flushNow: true, forceScroll: true });
        api.startAIOnboarding();
        return { handled: true };
      }
      if (api.isAIOnboardingActive()) {
        api.pushAIChatMessage('user', question, null, { flushNow: true, forceScroll: true });
        api.processAIOnboardingInput(question);
        return { handled: true };
      }
      return { handled: false };
    }

    /**
     * @returns {void}
     */
    function handlePostExecutionSuccess() {
      api.clearAIChatDraftAttachments();
      api.clearAIPendingScriptWorkflowIntent();
      api.clearAIPendingTimeBlockIntent();
      api.clearAIPendingWebSearchIntent();
      api.clearAIPendingOnboardingIntent();
      api.clearAIPendingUtilityCategory();
      if (api.isMobileNavMode() && api.getCurrentTab() === 'ai') {
        api.setMobileAIComposeActive(false);
        api.syncMobileBottomNavState();
        api.syncMobileQuickComposeButton();
      }
    }

    /**
     * @param {any} result
     * @returns {boolean}
     */
    function shouldPreserveComposerDraftAfterResult(result) {
      if (!result || result.ok !== true) return false;
      const applied = result.applied && typeof result.applied === 'object' ? result.applied : null;
      if (!applied) return false;
      const failureKind = String(applied.failureKind || '').trim();
      if (failureKind) return true;
      if (applied.needsConfirmation === true) return true;
      if (applied.morphActionExecutionFailed === true) return true;
      if (String(applied.blockedReason || '').trim()) return true;
      if (Array.isArray(applied.blockedLabels) && applied.blockedLabels.some(/** @param {any} item */ (item) => String(item || '').trim())) return true;
      return Array.isArray(applied.actionExecutionTrace)
        && applied.actionExecutionTrace.some(/** @param {any} entry */ (entry) => /^(?:blocked_|needs_confirmation|failed)/.test(String(entry?.status || '').trim()));
    }

    /**
     * @returns {Promise<any>}
     */
    async function sendAIChatMessage() {
      if (typeof api.healStuckAIChatBusyState === 'function') {
        api.healStuckAIChatBusyState();
      }

      const getAIChatState = typeof api.getAIChatState === 'function'
        ? api.getAIChatState
        : null;
      const aiChatState = getAIChatState ? getAIChatState() : null;
      if ((aiChatState && aiChatState.busy === true) || (typeof api.isAIChatBusy === 'function' && api.isAIChatBusy())) {
        return { ok: false, reason: 'busy' };
      }

      const getAIVoiceState = typeof api.getAIVoiceState === 'function'
        ? api.getAIVoiceState
        : null;
      const aiVoiceState = getAIVoiceState ? getAIVoiceState() : null;
      const voiceRunning = (aiVoiceState && aiVoiceState.running === true)
        || (typeof api.isAIVoiceRunning === 'function' && api.isAIVoiceRunning());
      if (voiceRunning && typeof api.stopAIVoiceRecognition === 'function') {
        api.stopAIVoiceRecognition();
      }
      if (aiVoiceState && typeof aiVoiceState === 'object') {
        aiVoiceState.running = false;
        aiVoiceState.finalText = '';
        aiVoiceState.interimText = '';
      }

      if (typeof api.setAIChatUtilityMenuOpen === 'function') {
        const utilityMenuOpen = typeof api.getAIChatUtilityMenuOpen === 'function'
          ? !!api.getAIChatUtilityMenuOpen()
          : false;
        if (utilityMenuOpen) {
          api.setAIChatUtilityMenuOpen(false);
        }
      }

      const sendContext = prepareSendContext();
      const resolveAIChatSendInputContext = typeof api.resolveAIChatSendInputContext === 'function'
        ? api.resolveAIChatSendInputContext
        : /** @param {ChatControllerInputRef | null | undefined} input */ (input) => ({
          input,
          question: String(input?.value || '').trim(),
        });
      const resolvedInputContext = resolveAIChatSendInputContext(sendContext?.input || null) || {};
      const input = resolvedInputContext.input || sendContext?.input || (typeof api.getAIChatInputElement === 'function' ? api.getAIChatInputElement() : null);
      const question = String(sendContext?.question || resolvedInputContext.question || input?.value || '').trim();
      const attachments = Array.isArray(sendContext?.attachments) ? sendContext.attachments : [];
      const onboardingRequested = !!sendContext?.onboardingRequested;
      const shouldUseExplicitAIWebSearch = typeof api.shouldUseExplicitAIWebSearch === 'function'
        ? api.shouldUseExplicitAIWebSearch
        : () => false;
      const webSearchRequested = shouldUseExplicitAIWebSearch(input) && !!sendContext?.webSearchRequested;
      const pendingScriptWorkflowPrompt = typeof api.buildAIPendingScriptWorkflowPrompt === 'function'
        ? api.buildAIPendingScriptWorkflowPrompt(question)
        : '';
      const pendingTimeBlockPrompt = typeof api.buildAIPendingTimeBlockPrompt === 'function'
        ? api.buildAIPendingTimeBlockPrompt(question)
        : '';
      const fallbackQuestion = attachments.length
        ? '参考这些附件，结合它们回答我的问题。'
        : '';
      const finalQuestion = String(
        sendContext?.finalQuestion
        || pendingScriptWorkflowPrompt
        || pendingTimeBlockPrompt
        || question
        || fallbackQuestion
        || ''
      ).trim();
      if (!finalQuestion) return { ok: false, reason: 'empty_question' };

      const draftQuestion = String(input?.value || question || '').trim();

      const preExecution = handlePreExecutionRoutes({ question, onboardingRequested, input });
      if (preExecution?.handled) return preExecution;

      const getCurrentAIKey = typeof api.getCurrentAIKey === 'function' ? api.getCurrentAIKey : () => '';
      const currentAIKey = String(getCurrentAIKey() || '').trim();
      if (!currentAIKey) {
        if (typeof api.openCustomModal === 'function') {
          const providerLabel = typeof api.getAIProviderDisplayLabel === 'function'
            ? api.getAIProviderDisplayLabel()
            : 'AI';
          api.openCustomModal({
            title: '未配置 AI 密钥',
            desc: `请先在设置中填写 ${providerLabel} API Key，再使用 AI 对话。`,
          });
        }
        restoreDraftToComposer(input, draftQuestion);
        return { ok: false, reason: 'missing_ai_key' };
      }

      const executeAICommandWithQuestion = typeof api.executeAICommandWithQuestion === 'function'
        ? api.executeAICommandWithQuestion
        : null;
      if (!executeAICommandWithQuestion) {
        restoreDraftToComposer(input, draftQuestion);
        return { ok: false, reason: 'execute_unavailable' };
      }

      const pendingExecution = executeAICommandWithQuestion(finalQuestion, {
        recordChat: true,
        attachments,
        webSearchRequested,
      });
      if (typeof api.resetComposerInput === 'function' && input) {
        api.resetComposerInput(input, {
          syncMobileLayout: input.id === 'mobile-detail-input',
        });
      }

      const res = await pendingExecution;
      if (shouldPreserveComposerDraftAfterResult(res)) {
        restoreDraftToComposer(input, draftQuestion);
      } else if (res?.ok) {
        handlePostExecutionSuccess();
      } else {
        restoreDraftToComposer(input, draftQuestion);
      }
      return res;
    }

    /**
     * @param {string} question
     * @returns {Promise<boolean>}
     */
    async function runMobileDailyAIVoiceCommand(question) {
      const executeAICommandWithQuestion = typeof api.executeAICommandWithQuestion === 'function'
        ? api.executeAICommandWithQuestion
        : null;
      const prompt = String(question || '').trim();
      let res = { ok: false };
      if (executeAICommandWithQuestion && prompt) {
        res = await executeAICommandWithQuestion(prompt, { recordChat: false });
      }
      if (typeof api.setMobileDailyAIComposeActive === 'function') {
        api.setMobileDailyAIComposeActive(false);
      }
      if (typeof api.stopMobileQuickVoiceInput === 'function') {
        api.stopMobileQuickVoiceInput();
      }
      if (typeof api.resetMobileQuickVoiceState === 'function') {
        api.resetMobileQuickVoiceState({ clearInput: true });
      }
      if (typeof api.syncMobileBottomNavState === 'function') {
        api.syncMobileBottomNavState();
      }
      if (typeof api.syncMobileQuickComposeButton === 'function') {
        api.syncMobileQuickComposeButton();
      }
      if (res?.ok && typeof api.getCurrentTab === 'function' && api.getCurrentTab() === 'daily') {
        if (typeof api.requestRenderAll === 'function') {
          api.requestRenderAll();
        }
      }
      return !!res?.ok;
    }

    /**
     * @param {string} question
     * @returns {Promise<boolean>}
     */
    async function runMobileHealthAICommand(question) {
      const executeAICommandWithQuestion = typeof api.executeAICommandWithQuestion === 'function'
        ? api.executeAICommandWithQuestion
        : null;
      const prompt = `请结合我当前同步到 Morpheus 的血糖数据，回答我的健康问题并给出简短建议：${String(question || '').trim()}`;
      let res = { ok: false };
      if (executeAICommandWithQuestion) {
        res = await executeAICommandWithQuestion(prompt, { recordChat: false });
      }
      if (typeof api.setMobileHealthAIComposeActive === 'function') {
        api.setMobileHealthAIComposeActive(false);
      }
      if (typeof api.syncMobileBottomNavState === 'function') {
        api.syncMobileBottomNavState();
      }
      if (typeof api.syncMobileQuickComposeButton === 'function') {
        api.syncMobileQuickComposeButton();
      }
      if (res?.ok && typeof api.getCurrentTab === 'function' && api.getCurrentTab() === 'health') {
        if (typeof api.renderGlucoseHealthView === 'function') {
          api.renderGlucoseHealthView();
        }
      }
      return !!res?.ok;
    }

    return {
      prepareSendContext,
      resetComposerForSend,
      handlePreExecutionRoutes,
      handlePostExecutionSuccess,
      shouldPreserveComposerDraftAfterResult,
      sendAIChatMessage,
      runMobileDailyAIVoiceCommand,
      runMobileHealthAICommand,
    };
  }

  window.MorphAIChatControllerModules = {
    create: createAIChatControllerModules,
  };
})();
