// @ts-check

/** @typedef {import('../../interfaces').AIChatAttachment} AIChatAttachment */
/** @typedef {import('../../interfaces').AIExecutionContext} MorphAIExecutionContext */
/** @typedef {import('../../interfaces').AIPlannerSummary} AIPlannerSummary */
/** @typedef {import('../../interfaces').AIWorkspaceSnapshot} AIWorkspaceSnapshot */
/** @typedef {import('../../interfaces').MorphRuntimeState} MorphRuntimeState */
/** @typedef {import('../../interfaces').WebSearchBundle} WebSearchBundle */
(function () {
  /**
   * Prefer the low-latency path for lightweight in-app chat that does not need
   * live workspace reads, attachments, web search, or write execution.
   * @param {string} promptQuestion
   * @param {import('../../interfaces').AIResponseMode | null | undefined} responseMode
   * @param {{ hasAttachments?: boolean, webSearchRequested?: boolean, allowMorphDataActions?: boolean }} [options]
   * @returns {boolean}
   */
  function shouldPreferFastLatencyMode(promptQuestion, responseMode, options = {}) {
    const question = String(promptQuestion || '').trim();
    if (!question) return false;
    if (options.hasAttachments || options.webSearchRequested || options.allowMorphDataActions) return false;

    const mode = String(responseMode?.mode || '').trim().toLowerCase();
    if (['companionship', 'overload', 'boundary', 'meaning'].includes(mode)) return true;

    const workspaceDomainPattern = /(?:日志|日记|提醒|闹钟|项目|project|节律|routine|闪念|定念|记账|账单|支出|血糖|健康|apple\s*health|插件|plugin|文档|文件|附件)/i;
    const workspaceCuePattern = /(?:我的|我这边|当前|现在|最近|今天|昨天|本周|这周|这个月|刚刚|上次|最新)/i;
    const workspaceReadVerbPattern = /(?:有哪些|有啥|有什么|还有什么|写了啥|写的啥|是什么|怎么样|情况|进展|看看|查看|查一下|列出|总结|汇总|同步|读到|有没有|多少|最新)/i;
    const planningPattern = /(?:计划|规划|排期|拆解|推进|roadmap|待办|todo|下一步|复盘|梳理|归纳|整理一下|分析一下|分析下|详细|展开|对比|评估|判断|策略|方案)/i;
    const generalKnowledgePattern = /(?:区别|是什么|为什么|如何|怎么|讲讲|解释(?:一下)?|说说|介绍(?:一下|下)?|举例|原理|方法|概念|理解)/i;

    const workspaceReadLike = workspaceDomainPattern.test(question)
      && (workspaceCuePattern.test(question) || workspaceReadVerbPattern.test(question));
    if (workspaceReadLike) return false;
    if (workspaceDomainPattern.test(question) && planningPattern.test(question)) return false;
    if (generalKnowledgePattern.test(question) && !workspaceReadLike) return true;
    return question.length <= 48;
  }

  /**
   * @typedef {object} AIOrchestrationDeps
   * @property {(mode: string) => NonNullable<AIChatAttachment['mode']>} normalizeAIChatAttachmentMode
   * @property {(attachments: AIChatAttachment[]) => string} buildAIChatAttachmentPromptContext
   * @property {(attachments: AIChatAttachment[]) => import('../../interfaces').AIChatAttachmentPreviewItem[]} buildAIChatAttachmentPreviewMeta
   * @property {() => string} getLatestAssistantMessageText
   * @property {(promptQuestion: string, options?: { latencyMode?: 'fast' | 'full' }) => Promise<import('../../interfaces').PluginAIReadableContext[]>} [buildPluginAIReadableContexts]
   * @property {(promptQuestion: string, options?: { force?: boolean }) => Promise<WebSearchBundle | null>} fetchWebSearchContext
   * @property {(promptQuestion: string) => AIWorkspaceSnapshot} buildAIWorkspaceSnapshot
   * @property {(promptQuestion: string) => AIWorkspaceSnapshot} [buildAIWorkspaceSnapshotLite]
  * @property {(promptQuestion: string) => Promise<string>} buildBundledSkillPromptContext
   * @property {(promptQuestion: string) => Promise<string[]> | string[]} [buildBundledActiveSkillIds]
   * @property {(promptQuestion: string, snapshot: AIWorkspaceSnapshot, options?: { attachments?: AIChatAttachment[], webSearchRequested?: boolean }) => AIPlannerSummary | null} buildAITaskPlannerSummary
   * @property {(promptQuestion: string, focus?: Record<string, unknown> | null, sharedIntentionality?: Record<string, unknown> | null) => import('../../interfaces').AIResponseMode} inferMorphResponseMode
  * @property {() => string} getNowInAITimezoneText
  * @property {() => MorphRuntimeState} getMorphRuntimeBundle
   * @property {() => string[]} [getPreferredMorphPromptActionTypes]
   * @property {(currentQuestion: string, limit?: number) => string} [buildRecentAIActionContextText]
   * @property {(question: string) => unknown} [extractExpenseRecordFromQuestion]
   * @property {(question: string) => string} [extractUserNameMemorySignal]
   * @property {(question: string) => import('../../interfaces').AIAction | null} [inferImplicitMemoryWriteActionFromConversation]
   * @property {(question: string) => import('../../interfaces').AIAction | null} [inferImplicitUndoActionFromConversation]
   * @property {(prompt: string, options?: { stream?: boolean, signal?: AbortSignal | null }) => Promise<string>} [requestAIText]
   * @property {() => AbortSignal | null} [getAIAbortSignal]
   * @property {(text: string) => { reply?: string, actions?: import('../../interfaces').AIAction[] }} [extractAIChatStructuredResponse]
   * @property {(promptQuestion: string) => boolean} isExternalAssistantConflictQuery
   * @property {(promptQuestion: string) => boolean} shouldTreatAsMorphDataOperation
   */

  /**
   * @param {AIOrchestrationDeps} deps
   */
  function createAIOrchestrationModules(deps) {
    const api = /** @type {AIOrchestrationDeps} */ (deps && typeof deps === 'object' ? deps : {});

    function isHighConfidenceMorphActionExtractionIntent(question = '') {
      const q = String(question || '').trim();
      if (!q) return false;
      const readOrHelpIntent = /(?:看看|查看|查一下|列出|有哪些|有啥|有什么|多少|怎么用|如何使用|是什么|说明|介绍|解释|总结一下|汇总一下)/i.test(q)
        && /(?:记账|账本|支出记录|日志|日记|闪念|定念|念头|项目|project|提醒|记忆)/i.test(q)
        && !/(?:写|加|新增|添加|创建|设置|提醒我|删除|删|改|修改|更新|归档|恢复|移动|搬到|转为|转成|记录|记下|记住|清理|清除|撤销|撤回|回退|保存|入账|花了|花费|付了|用了|归类|分组|合并|去重|总结到|整理到)/i.test(q);
      if (readOrHelpIntent) return false;
      const patterns = [
        /(?:提醒我|设置.{0,6}提醒|新增提醒|添加提醒|创建提醒|加.{0,6}提醒|改提醒|修改提醒|删除提醒|删提醒|取消提醒|闹钟)/i,
        /(?:明天|后天|今晚|今早|明早|早上|上午|中午|下午|晚上|\d{1,2}(?:点|:|：)\d{0,2}).{0,12}提醒/i,
        /(?:记住|记下|记下来|写进.{0,8}记忆|写入.{0,8}记忆|存进.{0,8}记忆|以后叫我|从现在开始叫我|你的名字叫|从现在开始你是)/i,
        /(?:撤销|撤回|回退|恢复|取消).{0,18}(?:刚刚|刚才|上一次|上次|那次|最近|上一步|操作|动作|修改|写入|变更|同步)/i,
        /(?:新增|添加|加入|记一条|记下|创建|新建|建一个|删除|删掉|移除|去掉|清掉|归类|分组|合并|去重|移动|归档|恢复).{0,18}(?:闪念|定念|念头|想法|项目|project|routine|节律)/i,
        /(?:把|将).{0,32}(?:闪念|定念|念头|想法|项目|project).{0,24}(?:归档|恢复|删除|删掉|移动|搬到|转为|转成|重命名|改名|更新|修改)/i,
        /(?:写进|写入|追加到|补进|放进|放入|记录到|记进|记入|清理|删除|更新|修改).{0,18}(?:日志|日记|今日日志|今天的日志|项目正文|项目参考|参考区)/i,
        /(?:写到|写入到|追加到|补到|放到|放在|记录到|整理到|总结到).{0,24}(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|今天|昨天|明天|今日日志|今天的日志|日志|日记)/i,
        /(?:记账|记一笔|入账)/i,
        /(?:支出|消费|花了|花费|用了|付了|付款|报销).{0,20}(?:\d|¥|元|块)/i,
        /(?:账本|类目|分类).{0,24}(?:修改|更新|改成|改为|归到|归类|删除|删掉|撤销|记录|记下|新增|添加|保存)/i,
        /(?:修改|更新|改成|改为|归到|归类|删除|删掉).{0,24}(?:账本|类目|分类|记账|支出|消费)/i,
      ];
      return patterns.some((pattern) => pattern.test(q));
    }

    /**
     * @param {string} [question]
     * @param {{ allowMorphDataActions?: boolean }} [options]
     */
    function shouldRouteMorphActionExtractionThroughAI(question = '', options = {}) {
      const q = String(question || '').trim();
      if (!q || api.isExternalAssistantConflictQuery(q)) return false;
      if (typeof api.extractExpenseRecordFromQuestion === 'function' && api.extractExpenseRecordFromQuestion(q)) return false;
      if (typeof api.extractUserNameMemorySignal === 'function' && api.extractUserNameMemorySignal(q)) return true;
      if (typeof api.inferImplicitMemoryWriteActionFromConversation === 'function' && api.inferImplicitMemoryWriteActionFromConversation(q)) return true;
      if (typeof api.inferImplicitUndoActionFromConversation === 'function' && api.inferImplicitUndoActionFromConversation(q)) return true;
      if (!isHighConfidenceMorphActionExtractionIntent(q)) return false;
      if (options.allowMorphDataActions === true) return true;
      if (typeof api.shouldTreatAsMorphDataOperation !== 'function') return false;
      return !!api.shouldTreatAsMorphDataOperation(q);
    }

    /**
     * @param {string} [question]
     * @param {{ nowText?: string, skillPromptContext?: string }} [options]
     */
    function buildMorphActionExtractionAIPrompt(question = '', options = {}) {
      const userText = String(question || '').trim();
      const now = String(options.nowText || '').trim() || api.getNowInAITimezoneText();
      const skillPromptContext = String(options.skillPromptContext || '').trim();
      const recentContext = typeof api.buildRecentAIActionContextText === 'function'
        ? api.buildRecentAIActionContextText(userText, 6)
        : '';
      return [
        '你是 Morpheus 的通用动作提取器。',
        '任务：根据“当前用户输入”以及“最近对话上下文”，把用户真正要你执行的 Morpheus 动作转换成严格 JSON。',
        '你只能返回 JSON，不能返回解释、不能返回 Markdown、不能返回代码块。',
        '唯一允许的 JSON 结构是：{"actions":[...]}。',
        '如果当前用户并不是在要求你修改 Morpheus 内部数据，就返回 {"actions":[]}。',
        '你必须理解指代与跟进语气，例如：',
        '- “记住这一点 / 记住这个” 要结合最近对话，把“这一点”还原成具体内容。',
        '- 纯自然语言即可（不必写 / 或 @）；例如「记住我喜欢燕麦」「明天下午三点提醒我开会」也要分别提取为 write_soul_memory 与 add_reminder。',
        '- “记住你是…”“从现在开始你是…”“你的名字叫…” 是用户在给 AI 设定角色身份，要写成 write_soul_memory，sectionTitle 设为「AI 角色设定」。注意：主语是“你”（AI），不是“我”（用户）。',
        '- “记住我喜欢…”“我叫…” 主语是“我”（用户），要写成 memory_write_user 或 write_soul_memory（取决于内容类型）。',
        '- “从今天开始叫我的真名，少城 / 以后叫我 X” 要写成 memory_write_user，并把名字写入“名字与称呼”。',
        '- “撤销这个操作 / 回退这个” 如果最近一轮已经执行过 AI 动作，就返回 undo_last_ai_transaction。',
        '- “帮我添加一个项目，叫做 X” 要识别成 create_project。',
        '- “把项目 X 归档 / 恢复项目 X” 要识别成 update_project_status。',
        '- “帮我删除，X 这个定念” 要识别成 delete_fixed_thought。',
        '- 对提醒请求，必须优先返回 add_reminder / update_reminder / delete_reminder；不要只写“已设置提醒”“已经帮你加好了”这类口头成功句。',
        '- 如果提醒时间还不够精确，优先返回 add_reminder 并补 datetimeRaw，不能因为时间模糊就假装已经创建成功。',
        '- 如果用户要求 Morpheus 自己创建、安装或补全插件，不要返回插件源码动作；应改为自然语言说明：Morpheus 当前不再直接生成插件，请改由外部第三方 AI agent 按插件规范完成。',
        '当用户是在要求新增/创建/删除/撤销/记住时，不要只返回口头承诺，必须返回具体 action。',
        `当前北京时间：${now}`,
        skillPromptContext ? `当前匹配到的技能说明：\n${skillPromptContext}` : '',
        recentContext ? `最近对话上下文：\n${recentContext}` : '',
        `当前用户输入：${userText}`,
      ].filter(Boolean).join('\n');
    }

    /**
     * @param {string} question
     * @param {{ allowMorphDataActions?: boolean, skillPromptContext?: string, beijingNow?: string }} [context]
     */
    async function executeMorphActionExtractionWithAI(question, context = {}) {
      const promptQuestion = String(question || '').trim();
      if (!shouldRouteMorphActionExtractionThroughAI(promptQuestion, context)) return null;
      if (typeof api.requestAIText !== 'function' || typeof api.extractAIChatStructuredResponse !== 'function') return null;
      const directUndoAction = typeof api.inferImplicitUndoActionFromConversation === 'function'
        ? api.inferImplicitUndoActionFromConversation(promptQuestion)
        : null;
      if (directUndoAction && String(directUndoAction.type || '').trim() === 'undo_last_ai_transaction') {
        return {
          ok: true,
          actions: [{
            ...directUndoAction,
            source: String(directUndoAction.source || 'system-undo-inference').trim() || 'system-undo-inference',
          }],
          rawText: '',
        };
      }
      const skillPromptContext = String(context.skillPromptContext || '').trim()
        || (typeof api.buildBundledSkillPromptContext === 'function'
          ? await api.buildBundledSkillPromptContext(promptQuestion)
          : '');
      const prompt = buildMorphActionExtractionAIPrompt(promptQuestion, {
        nowText: context.beijingNow,
        skillPromptContext,
      });
      let rawText = '';
      try {
        rawText = await api.requestAIText(prompt, {
          stream: false,
          signal: typeof api.getAIAbortSignal === 'function' ? api.getAIAbortSignal() : null,
        });
      } catch (_) {
        return null;
      }
      const parsed = api.extractAIChatStructuredResponse(rawText);
      const actions = (Array.isArray(parsed?.actions) ? parsed.actions : [])
        .filter((action) => action && typeof action === 'object' && String(action.type || '').trim())
        .map((action) => ({
          ...action,
          source: String(action.source || 'ai-action-extractor').trim() || 'ai-action-extractor',
        }));
      if (!actions.length) return null;
      return { ok: true, actions, rawText };
    }

    /**
     * @param {AIChatAttachment[]} [attachments=[]]
     * @returns {AIChatAttachment[]}
     */
    function normalizeAttachments(attachments = []) {
      return Array.isArray(attachments)
        ? attachments.map((item) => ({ ...item, mode: api.normalizeAIChatAttachmentMode(String(item.mode || 'reference')) }))
        : [];
    }

    /**
     * @param {string} promptQuestion
     * @param {{ attachments?: AIChatAttachment[], webSearchRequested?: boolean }} [options]
     * @returns {Promise<MorphAIExecutionContext>}
     */
    async function prepareAIExecutionContext(promptQuestion, { attachments = [], webSearchRequested = false } = {}) {
      const safeAttachments = normalizeAttachments(attachments);
      const attachmentContext = api.buildAIChatAttachmentPromptContext(safeAttachments);
      const liteCandidate = !safeAttachments.length && !webSearchRequested && typeof api.buildAIWorkspaceSnapshotLite === 'function'
        ? api.buildAIWorkspaceSnapshotLite(promptQuestion)
        : null;
      const responseSnapshot = liteCandidate || api.buildAIWorkspaceSnapshot(promptQuestion);
      const sharedIntentionality = responseSnapshot?.samples?.sharedIntentionality || null;
      const responseMode = responseSnapshot?.samples?.responseMode || api.inferMorphResponseMode(promptQuestion, {
        tab: responseSnapshot?.currentView?.tab,
        selectedDailyMonth: responseSnapshot?.currentView?.selectedDailyMonth,
        activeProject: responseSnapshot?.currentView?.activeProject,
        currentTaskState: responseSnapshot?.samples?.currentTaskState,
        currentWorkflowState: responseSnapshot?.samples?.currentWorkflowState,
      }, sharedIntentionality);
      const allowMorphDataActions = typeof api.shouldTreatAsMorphDataOperation === 'function'
        && !!api.shouldTreatAsMorphDataOperation(promptQuestion);
      const latencyMode = shouldPreferFastLatencyMode(promptQuestion, responseMode, {
        hasAttachments: safeAttachments.length > 0,
        webSearchRequested,
        allowMorphDataActions,
      })
        ? 'fast'
        : 'full';
      const snapshot = latencyMode === 'fast' && liteCandidate
        ? liteCandidate
        : responseSnapshot === liteCandidate
          ? api.buildAIWorkspaceSnapshot(promptQuestion)
          : responseSnapshot;
      const [webSearchBundle, pluginPromptContexts, skillPromptContext, activeSkillIds] = latencyMode === 'fast'
        ? [null, [], '', []]
        : await Promise.all([
          api.fetchWebSearchContext(promptQuestion, { force: webSearchRequested }),
          typeof api.buildPluginAIReadableContexts === 'function'
            ? api.buildPluginAIReadableContexts(promptQuestion, { latencyMode })
            : Promise.resolve([]),
          api.buildBundledSkillPromptContext(promptQuestion),
          typeof api.buildBundledActiveSkillIds === 'function'
            ? api.buildBundledActiveSkillIds(promptQuestion)
            : Promise.resolve([]),
        ]);
      const beijingNow = api.getNowInAITimezoneText();
      const runtime = api.getMorphRuntimeBundle();

      return {
        safeAttachments,
        attachmentContext,
        pluginPromptContexts,
        webSearchBundle,
        snapshot,
        skillPromptContext,
        activeSkillIds: Array.isArray(activeSkillIds) ? activeSkillIds : [],
        responseMode,
        latencyMode,
        beijingNow,
        runtime,
        allowMorphDataActions,
      };
    }

    return {
      normalizeAttachments,
      prepareAIExecutionContext,
      shouldRouteMorphActionExtractionThroughAI,
      buildMorphActionExtractionAIPrompt,
      executeMorphActionExtractionWithAI,
    };
  }

  window.MorphAIOrchestrationModules = {
    create: createAIOrchestrationModules,
  };
})();
