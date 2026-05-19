// @ts-check

/** @typedef {import('../../interfaces').AIAppliedResult} AIAppliedResult */
/** @typedef {import('../../interfaces').AIAssistantMessageMeta} AIAssistantMessageMeta */
/** @typedef {import('../../interfaces').AIChatMessageMeta} ResponseHandlerChatMessageMeta */
/** @typedef {import('../../interfaces').AIChatMessageUpdate} ResponseHandlerChatMessageUpdate */
/** @typedef {import('../../interfaces').AIChatPersistOptions} ResponseHandlerChatPersistOptions */
/** @typedef {import('../../interfaces').AIDerivedResponse} AIDerivedResponse */
/** @typedef {import('../../interfaces').AIFinalizeReplyInput} AIFinalizeReplyInput */
/** @typedef {import('../../interfaces').AIFinalizedResponse} AIFinalizedResponse */
/** @typedef {import('../../interfaces').AIStreamProgressResult} AIStreamProgressResult */
/** @typedef {import('../../interfaces').AIStreamProgressState} MorphAIStreamProgressState */

(function () {
  /**
   * @typedef {object} AIResponseHandlerDeps
   * @property {(text: string) => { reply?: string, actions?: import('../../interfaces').AIAction[] }} splitAIChatStructuredResponse
   * @property {() => void} stopAIThinkingIndicator
   * @property {() => void} [requestAIChatRender]
   * @property {(role: string, content: string, meta?: ResponseHandlerChatMessageMeta | null, options?: ResponseHandlerChatPersistOptions) => string} pushAIChatMessage
   * @property {(messageId: string, updates: ResponseHandlerChatMessageUpdate, options?: ResponseHandlerChatPersistOptions) => void} updateAIChatMessage
   * @property {(value: string | null) => void} setCurrentAssistantMessageId
   * @property {(messageId: string) => string} getAIChatMessageContent
   * @property {(text: string) => { reply?: string, actions?: import('../../interfaces').AIAction[] }} extractAIChatStructuredResponse
   * @property {(actions: import('../../interfaces').AIAction[], reply?: string) => import('../../interfaces').AIAction[]} enrichAIActionsFromReply
   * @property {(actionTypes: string[]) => Array<{ skillId?: string, skillLabel?: string }>} [getMorphSkillDescriptorsForActionTypes]
   * @property {(attachments: import('../../interfaces').AIChatAttachment[]) => number} ingestAIChatAttachmentsToWritingStudio
   * @property {(question: string, reply: string, snapshot: import('../../interfaces').AIWorkspaceSnapshot) => Promise<void>} runScriptWorkflowAutoLearn
   * @property {(userText: string, assistantText: string, actions?: string[]) => void} appendAIInteractionMemory
   * @property {(applied?: AIAppliedResult | null) => string} [buildAppliedActionReceiptReply]
   */

  /**
   * @param {AIResponseHandlerDeps} deps
   */
  function createAIResponseHandlerModules(deps) {
    const api = /** @type {AIResponseHandlerDeps} */ (deps && typeof deps === 'object' ? deps : {});
    const getMorphSkillDescriptorsForActionTypes = typeof api.getMorphSkillDescriptorsForActionTypes === 'function'
      ? api.getMorphSkillDescriptorsForActionTypes
      : (actionTypes = []) => {
        const runtime = typeof window !== 'undefined'
          && window.MorphAIActionSkillRuntime
          && typeof window.MorphAIActionSkillRuntime.create === 'function'
          ? window.MorphAIActionSkillRuntime.create()
          : null;
        return runtime && typeof runtime.getMorphSkillDescriptorsForActionTypes === 'function'
          ? runtime.getMorphSkillDescriptorsForActionTypes(actionTypes)
          : [];
      };
    const buildAppliedActionReceiptReply = typeof api.buildAppliedActionReceiptReply === 'function'
      ? api.buildAppliedActionReceiptReply
      : (applied = null) => {
        const createdItems = Array.isArray(applied?.createdItems) ? applied.createdItems : [];
        const committedTrace = Array.isArray(applied?.actionExecutionTrace)
          ? applied.actionExecutionTrace.filter((entry) => entry && String(entry.status || '').trim() === 'committed' && entry.transactionCommitted !== false)
          : [];
        const actionTypes = Array.from(new Set(committedTrace.map((entry) => String(entry?.type || '').trim()).filter(Boolean)));
        const labels = Array.isArray(applied?.appliedLabels)
          ? applied.appliedLabels.map((item) => String(item || '').trim()).filter(Boolean)
          : [];
        const firstAppliedLabel = String(labels[0] || '').trim();
        if (!createdItems.length && !actionTypes.length) return firstAppliedLabel;
        const firstCreatedItem = createdItems[0] || null;
        const tab = String(firstCreatedItem?.tab || '').trim();
        const text = String(firstCreatedItem?.text || '').trim();
        const dueAtText = String(firstCreatedItem?.dueAtText || '').trim();
        if (actionTypes.includes('append_daily_log') || actionTypes.includes('append_daily_log_under_date') || tab === 'daily') {
          return text ? `已写入日志：${text}` : '已写入日志。';
        }
        if (actionTypes.includes('delete_reminder') || (tab === 'reminders' && firstCreatedItem?.removed)) {
          return firstAppliedLabel || (text ? `已删除提醒：${text}` : '已删除提醒。');
        }
        if (actionTypes.includes('add_reminder') || tab === 'reminders') {
          return [dueAtText ? `已设置提醒：${dueAtText}` : '已设置提醒：', text].filter(Boolean).join(' ').trim();
        }
        if (actionTypes.includes('update_reminder')) {
          return firstAppliedLabel || (text ? `已更新提醒：${text}` : '已更新提醒。');
        }
        if (actionTypes.includes('update_expense_record')) {
          return firstAppliedLabel || (text ? `已更新记账：${text}` : '已更新记账。');
        }
        if (actionTypes.includes('delete_expense_record') || (tab === 'expenseLedger' && firstCreatedItem?.removed)) {
          return firstAppliedLabel || (text ? `已删除记账：${text}` : '已删除记账。');
        }
        if (actionTypes.includes('undo_last_expense_record')) {
          return firstAppliedLabel || (text ? `已撤销记账：${text}` : '已撤销最近一笔记账。');
        }
        if (actionTypes.includes('add_expense_record') || tab === 'expenseLedger') {
          return text ? `已记账：${text}` : '已记账。';
        }
        if (actionTypes.includes('add_flash_thought') || tab === 'flashThoughts') {
          return text ? `已新增闪念：${text}` : '已新增闪念。';
        }
        if (actionTypes.includes('add_fixed_thought') || tab === 'fixed') {
          return text ? `已新增定念：${text}` : '已新增定念。';
        }
        if (actionTypes.some((type) => ['memory_write_user', 'write_soul_memory', 'memory_rewrite_section'].includes(type))) {
          return firstAppliedLabel || (actionTypes.includes('memory_rewrite_section') ? '已更新记忆文件。' : '已记住。');
        }
        return firstAppliedLabel || '已处理。';
      };

    function isWriteLikeActionType(type = '') {
      return !/^(?:list_|summarize_|plan_|chat$)/.test(String(type || '').trim());
    }

    function isFormalCommittedTraceEntry(entry = null) {
      return !!(
        entry
        && String(entry.status || '').trim() === 'committed'
        && entry.transactionCommitted !== false
        && String(entry.type || '').trim()
      );
    }

    function isObservedMutationTraceEntry(entry = null) {
      if (!entry || !String(entry.type || '').trim()) return false;
      const status = String(entry.status || '').trim();
      return status === 'committed' || status === 'draft_applied' || status === 'applied_local';
    }

    function collectFormalCommittedActionTypes(applied = null) {
      const trace = Array.isArray(applied?.actionExecutionTrace) ? applied.actionExecutionTrace : [];
      return Array.from(new Set(
        trace
          .filter((entry) => isFormalCommittedTraceEntry(entry))
          .map((entry) => String(entry.type || '').trim())
          .filter(Boolean)
      ));
    }

    function collectObservedActionTypes(applied = null) {
      const trace = Array.isArray(applied?.actionExecutionTrace) ? applied.actionExecutionTrace : [];
      return Array.from(new Set(
        trace
          .filter((entry) => isObservedMutationTraceEntry(entry))
          .map((entry) => String(entry.type || '').trim())
          .filter(Boolean)
      ));
    }

    function hasExplicitNonCommittedMutationTrace(applied = null) {
      const trace = Array.isArray(applied?.actionExecutionTrace) ? applied.actionExecutionTrace : [];
      return trace.some((entry) => {
        if (!entry || !String(entry.type || '').trim()) return false;
        const status = String(entry.status || '').trim();
        return status === 'draft_applied'
          || status === 'applied_local'
          || (status === 'committed' && entry.transactionCommitted === false);
      });
    }

    function getAppliedFailureSemantic(applied = null) {
      const failureKind = String(applied?.failureKind || '').trim();
      const failureStage = String(applied?.failureStage || '').trim();
      const failureCode = String(applied?.failureCode || '').trim();
      const failureMessage = String(applied?.failureMessage || applied?.blockedReason || '').trim();
      if (failureKind || failureStage || failureCode || failureMessage) {
        return {
          kind: failureKind || (applied?.morphActionExecutionFailed === true ? 'failed' : (applied?.needsConfirmation === true ? 'needs_confirmation' : 'blocked')),
          stage: failureStage,
          code: failureCode,
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
        stage: '',
        code: '',
        message: failureMessage,
        needsConfirmation: inferredKind === 'needs_confirmation',
      };
    }

    /**
     * @param {string} streamedText
     * @param {{ recordChat?: boolean, assistantMessageId?: string | null, bestStreamedReply?: string, promptQuestion?: string }} [context]
     * @returns {AIStreamProgressResult}
     */
    function handleStreamProgress(streamedText, context = {}) {
      if (!context.recordChat) {
        return {
          assistantMessageId: context.assistantMessageId || null,
          bestStreamedReply: context.bestStreamedReply || '',
        };
      }
      const partial = api.splitAIChatStructuredResponse(streamedText);
      if (!partial.reply) {
        return {
          assistantMessageId: context.assistantMessageId || null,
          bestStreamedReply: context.bestStreamedReply || '',
        };
      }
      api.stopAIThinkingIndicator();
      const partialReply = String(partial.reply || '').trim();
      const weakPartial = /^[?？…\.]+$/.test(partialReply) || partialReply.length <= 2;
      const nextBestReply = !weakPartial && partialReply.length >= String(context.bestStreamedReply || '').length
        ? partialReply
        : String(context.bestStreamedReply || '');
      if (!context.assistantMessageId) {
        const nextId = api.pushAIChatMessage('assistant', partialReply, null, { syncData: false });
        api.setCurrentAssistantMessageId(nextId);
        if (typeof api.requestAIChatRender === 'function') api.requestAIChatRender();
        return {
          assistantMessageId: nextId,
          bestStreamedReply: nextBestReply,
        };
      }
      api.updateAIChatMessage(context.assistantMessageId, /** @type {ResponseHandlerChatMessageUpdate} */ ({
        content: partialReply,
        meta: null,
      }), /** @type {ResponseHandlerChatPersistOptions} */ ({ syncData: false }));
      if (typeof api.requestAIChatRender === 'function') api.requestAIChatRender();
      return {
        assistantMessageId: context.assistantMessageId,
        bestStreamedReply: nextBestReply,
      };
    }

    /**
     * @param {string} rawText
     * @param {{ promptQuestion?: string, recordChat?: boolean, assistantMessageId?: string | null, bestStreamedReply?: string }} [context]
     * @returns {AIDerivedResponse}
     */
    function deriveStructuredResult(rawText, context = {}) {
      const parsed = api.extractAIChatStructuredResponse(rawText);
      const parsedReply = parsed.reply || rawText;
      const baseActions = Array.isArray(parsed.actions) && parsed.actions.length > 0
        ? parsed.actions
        : [];
      const effectiveActions = api.enrichAIActionsFromReply(baseActions, parsedReply);
      let reply = String(parsed.reply || '').trim();
      if (!reply) {
        if (effectiveActions.length > 0) reply = '已按你的要求更新。';
        else reply = String(rawText || '').replace(/<<ACTIONS>>[\s\S]*$/i, '').trim() || 'AI 没有返回可读内容。';
      }
      const weakReplyPatterns = [
        /^$/,
        /^[?？…\.]+$/,
        /^已按你的要求更新。?$/,
        /^已处理。?$/,
        /^好的[，,。.]?(已|已经).{0,16}$/,
      ];
      return {
        parsed,
        parsedReply,
        effectiveActions,
        reply,
        weakReplyPatterns,
      };
    }

    /**
     * @param {Partial<AIFinalizeReplyInput>} [context]
     * @returns {Promise<AIFinalizedResponse>}
     */
    async function finalizeReply(context = {}) {
      let reply = String(context.reply || '').trim();
      const appliedLabels = Array.isArray(context.applied?.appliedLabels) ? context.applied.appliedLabels : [];
      const createdItems = Array.isArray(context.applied?.createdItems) ? context.applied.createdItems : [];
      const performedTransactionUndo = context.applied?.performedTransactionUndo === true;
      const committedActionTypes = collectFormalCommittedActionTypes(context.applied);
      const hasCommittedActionTypes = committedActionTypes.length > 0;
      const hasCommittedWriteLikeAction = committedActionTypes.some((type) => isWriteLikeActionType(type));
      const explicitNonCommittedMutationTrace = hasExplicitNonCommittedMutationTrace(context.applied);
      const fallbackCommittedMutationSignal = !hasCommittedActionTypes
        && !explicitNonCommittedMutationTrace
        && (
          createdItems.length > 0
          || appliedLabels.length > 0
          || String(context.applied?.transactionId || '').trim().length > 0
        );
      const failureSemantic = getAppliedFailureSemantic(context.applied);
      const hasCommittedMutation = hasCommittedWriteLikeAction || fallbackCommittedMutationSignal;
      if (performedTransactionUndo) {
        const undoReceipt = String(buildAppliedActionReceiptReply(context.applied) || appliedLabels[0] || '').trim();
        if (undoReceipt) reply = undoReceipt;
      }
      const replyClaimsWriteSuccess = /(已经更新|已更新|已经记录|已记录|已经写入|已写入|已经修改|已修改|内部记录|记住了|记下了|已经帮你记|已记住|已经记住|已为你设置提醒|已设置提醒|已为你添加提醒|已添加提醒|已删除提醒|已取消提醒|已更新提醒|已记账|已帮你记下这笔支出|已删除记账|已更新记账)/i.test(reply);
      if (Array.isArray(context.effectiveActions) && context.effectiveActions.length > 0 && appliedLabels.length === 0 && !hasCommittedMutation) {
        const blockedReasonText = String(failureSemantic.message || context.applied?.blockedReason || '').trim();
        if (blockedReasonText) {
          const isInternalCrash = failureSemantic.kind === 'failed' || context.applied?.morphActionExecutionFailed === true;
          if (replyClaimsWriteSuccess) {
            reply = isInternalCrash
              ? '刚才尝试自动执行操作时遇到了内部问题，没有真正写入。你可以再试一次。'
              : blockedReasonText;
          } else if (reply && reply.length > 20) {
            reply = isInternalCrash
              ? `${reply}\n\n（注意：刚才尝试自动执行操作时遇到了内部问题，没有真正写入。你可以再试一次。）`
              : `${reply}\n\n（注意：这次操作没有真正执行。你可以再明确说一下要做什么，或回复「确认」来执行。）`;
          } else {
            reply = blockedReasonText;
          }
        }
        const blockedLabels = Array.isArray(context.applied?.blockedLabels) ? context.applied.blockedLabels : [];
        const needsUserConfirm = failureSemantic.needsConfirmation || blockedLabels.some((label) => String(label || '').includes('待确认'));
        if (needsUserConfirm && reply && !/(回一句「确认」|回复「确认」|直接说「确认」|再说清楚要写到哪里|明确说出)/.test(reply)) {
          reply = `${reply}\n\n要执行的话，回一句「确认」或再说清楚要写到哪里即可。`;
        }
        const afterApplyReply = String(reply || '').replace(/\s+/g, ' ').trim();
        const weakAfterApply = (context.weakReplyPatterns || []).some((pattern) => pattern.test(afterApplyReply)) || afterApplyReply.length <= 12;
        if (weakAfterApply && !needsUserConfirm) {
          reply = blockedReasonText || '这次没有自动改到你的数据。用平常话再说一下要做什么就行。';
        }
      }
      if ((!Array.isArray(context.effectiveActions) || context.effectiveActions.length === 0) && appliedLabels.length === 0) {
        const promptQ = String(context.promptQuestion || '').trim();
        const declarativeUserFactIntent = /^(?:我|我的|我暂时|我现在|我目前|我已经|我不再|我最近|我一般|我通常|我总是|我会|我容易|我希望|我想要|我不想|我喜欢|我不喜欢|我讨厌|我更喜欢|我更偏向|我习惯|我需要|我最好|以后|默认)/.test(promptQ)
          && !/[?？]/.test(promptQ);
        const memoryWriteIntent = /(修改|改写|重写|更新|写入|写进|存进|放进).{0,12}(?:你的)?(?:soul\.?md|soul\s*记忆|soul|记忆)/i.test(promptQ)
          || /(记住|记下|存进(?:你的)?记忆|写进(?:你的)?记忆|写入(?:你的)?记忆)/i.test(promptQ);
        const claimsSuccess = /(已经更新|已更新|已经记录|已记录|已经写入|已写入|已经修改|已修改|内部记录|记住了|记下了|已经帮你记|已记住|已经记住)/i.test(reply);
        if ((memoryWriteIntent || declarativeUserFactIntent) && claimsSuccess) {
          reply = '记忆这边还没真正落库。你可以再说一句具体要记的内容，例如「记住我总是早上喝咖啡」。';
        }
        const expenseWriteIntent = /(记账|记一笔|记个账|账本|入账|支出|消费|开销|花了|用了|付了|打车|停车费|药费|挂号费|看病|拿药|买了)/i.test(promptQ)
          && !/[?？]/.test(promptQ);
        const expenseClaimsSuccess = /(已(?:经)?(?:帮你)?(?:记账|记下(?:这笔)?支出|写入账本|存入账本|记入账本|正式记入账本|入账)|(?:这笔|该笔).{0,24}(?:已|已经).{0,16}(?:记账|写入账本|存入账本|记入账本|入账)|正式记入账本|写入账本|存入账本|记入账本|暂存在临时记录|待归类状态)/i.test(reply);
        if (expenseWriteIntent && expenseClaimsSuccess) {
          reply = '账本这边还没有真正写入成功。只有出现明确的记账回执，或你在账单里看到新增记录，才算真的记下。';
        }
        const reminderWriteIntent = /(提醒我|设置(?:一个|个)?提醒|设(?:一个|个)?提醒|加(?:一条|个)?提醒|新增提醒|添加提醒|创建提醒|改提醒|修改提醒|删提醒|删除提醒|取消提醒|闹钟)/i.test(promptQ)
          || /(?:明天|后天|今晚|今早|明早|早上|下午|晚上|中午|\d{1,2}(?:点|:|：)\d{0,2}).{0,10}提醒/i.test(promptQ);
        const reminderClaimsSuccess = /(已(?:为你)?(?:添加|设置|创建|改好|修改好|删除|取消).{0,12}提醒|提醒已(?:设置|添加|创建|修改|删除)|提醒将(?:在|于)|将在.+提醒你|已为你添加今日提醒|已为你设置提醒)/i.test(reply);
        if (reminderWriteIntent && reminderClaimsSuccess) {
          reply = '提醒这边还没有真正执行成功。你可以再试一次；如果我真的改到了提醒，会出现明确的提醒回执，并且能在提醒列表里看到。';
        }
        const pluginInstallIntent = /(创建|新建|生成|做一个|做个|开发|实现|搭一个|安装).{0,18}(插件|plugin)|(插件|plugin).{0,18}(创建|新建|生成|安装|开发|实现)/i.test(promptQ);
        const pluginClaimsSuccess = /(已(?:为你)?创建并安装(?:了)?(?:这个)?插件|已(?:为你)?生成(?:了)?(?:这个)?插件|它已在后台激活|无需额外配置，也不依赖联网或外部服务)/i.test(reply);
        if (pluginInstallIntent && pluginClaimsSuccess) {
          reply = 'Morpheus 当前不再直接创建、安装或补全插件源码。插件开发现在需要改由外部第三方 AI agent 按现有 Morpheus 插件规范完成。';
        }
        const pluginImplementationIntent = /((补全|补成|补到|做成|实现|完善|升级|继续做|继续实现|继续完善|补完整).{0,18}(插件|plugin))|((插件|plugin).{0,18}(补全|补成|补到|做成|实现|完善|升级|继续做|继续实现|继续完善|补完整))/.test(promptQ)
          && !pluginInstallIntent;
        const pluginImplementationClaimsSuccess = /(已(?:为你)?补全|已(?:经)?(?:帮你)?补成可用版本|现已完整就位|下次你只需说一句|就能立即启动|无需额外配置，也不依赖联网或外部服务)/i.test(reply);
        if (pluginImplementationIntent && pluginImplementationClaimsSuccess) {
          reply = 'Morpheus 当前不再直接补全插件源码。需要继续实现插件时，请改由外部第三方 AI agent 按现有 Morpheus 插件规范完成。';
        }
      }
      reply = String(reply || '').trim();
      api.appendAIInteractionMemory(String(context.promptQuestion || ''), reply, appliedLabels);
      return {
        reply,
        appliedLabels,
      };
    }

    /**
     * @param {{ applied?: AIAppliedResult, routeTrace?: import('../../interfaces').AIRouteTrace | null, relevantSources?: import('../../interfaces').WebCitation[], webCitations?: import('../../interfaces').WebCitation[], relevantChains?: string[] }} [context]
     * @returns {AIAssistantMessageMeta}
     */
    function buildAssistantMeta(context = {}) {
      const observedActionTypes = collectObservedActionTypes(context.applied);
      const committedActionTypes = collectFormalCommittedActionTypes(context.applied);
      const firstObservedActionType = String(observedActionTypes[0] || '').trim();
      const skillDescriptors = Array.isArray(getMorphSkillDescriptorsForActionTypes(observedActionTypes))
        ? getMorphSkillDescriptorsForActionTypes(observedActionTypes)
        : [];
      const firstCreatedItem = Array.isArray(context.applied?.createdItems) ? context.applied.createdItems[0] : null;
      const firstAppliedLabel = Array.isArray(context.applied?.appliedLabels)
        ? String(context.applied.appliedLabels[0] || '').trim()
        : '';
      const createdItems = Array.isArray(context.applied?.createdItems) ? context.applied.createdItems : [];
      const transactionId = String(context.applied?.transactionId || '').trim();
      const normalizedRoute = String(context.routeTrace?.route || '').trim().toUpperCase();
      const hasObservedActionTypes = observedActionTypes.length > 0;
      const hasOnlyPlanActionTypes = hasObservedActionTypes
        && observedActionTypes.every((type) => /^plan_/.test(String(type || '').trim()));
      const hasOnlyReadActionTypes = hasObservedActionTypes
        && observedActionTypes.every((type) => /^(?:list_|summarize_)/.test(String(type || '').trim()));
      const hasAnyCommittedWriteLikeActionTypes = committedActionTypes.some((type) => isWriteLikeActionType(type));
      const explicitNonCommittedMutationTrace = hasExplicitNonCommittedMutationTrace(context.applied);
      const inferredRoute = hasOnlyPlanActionTypes
        ? 'PLAN'
        : hasOnlyReadActionTypes
          ? 'READ'
          : (hasAnyCommittedWriteLikeActionTypes || (transactionId && (firstAppliedLabel || createdItems.length > 0)))
            ? 'WRITE'
            : '';
      const effectiveRoute = normalizedRoute || inferredRoute || (firstObservedActionType || firstAppliedLabel ? 'WRITE' : '');
      const shouldExposeTransactionId = Boolean(transactionId)
        && effectiveRoute === 'WRITE'
        && !explicitNonCommittedMutationTrace
        && (hasAnyCommittedWriteLikeActionTypes || (!committedActionTypes.length && (firstAppliedLabel || createdItems.length > 0)));
      const shouldExposeReceiptSummary = effectiveRoute === 'WRITE'
        && !explicitNonCommittedMutationTrace
        && (hasAnyCommittedWriteLikeActionTypes || Boolean(transactionId) || Boolean(firstAppliedLabel) || createdItems.length > 0);
      const receiptSummary = shouldExposeReceiptSummary
        ? String(buildAppliedActionReceiptReply(context.applied) || '').trim()
        : '';
      const shouldOfferUndo = shouldExposeTransactionId;
      return {
        actions: context.applied?.appliedLabels || [],
        actionTypes: observedActionTypes,
        skillIds: skillDescriptors.map((item) => String(item?.skillId || '').trim()).filter(Boolean),
        skillLabels: skillDescriptors.map((item) => String(item?.skillLabel || '').trim()).filter(Boolean),
        primarySkillId: String(skillDescriptors[0]?.skillId || '').trim(),
        primarySkillLabel: String(skillDescriptors[0]?.skillLabel || '').trim(),
        createdItems: context.applied?.createdItems || [],
        transactionId: shouldExposeTransactionId ? transactionId : null,
        receiptSummary,
        undoHint: shouldOfferUndo ? '可直接说“撤销刚才那次操作”。' : '',
        citations: (context.relevantSources || []).concat(context.webCitations || []).slice(0, 6),
        citationChains: context.relevantChains || [],
      };
    }

    return {
      handleStreamProgress,
      deriveStructuredResult,
      finalizeReply,
      buildAssistantMeta,
      getAppliedFailureSemantic,
    };
  }

  window.MorphAIResponseHandlerModules = {
    create: createAIResponseHandlerModules,
  };
})();
