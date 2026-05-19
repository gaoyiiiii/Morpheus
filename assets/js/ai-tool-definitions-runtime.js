// @ts-check

/**
 * Morpheus Tool Definitions Runtime
 *
 * Converts the existing Morpheus action types into OpenAI-compatible
 * `tools` (function calling) schema so the model can natively select
 * and parameterise actions instead of relying on free-text JSON extraction.
 */
(function initMorphAIToolDefinitionsRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIToolDefinitionsRuntime && typeof window.MorphAIToolDefinitionsRuntime.create === 'function') return;

  /** @type {Record<string, { description: string, parameters: Record<string, unknown> }>} */
  const ACTION_TOOL_SCHEMAS = {
    write_soul_memory: {
      description: '将用户要求记住的内容写入长期记忆。适用于「记住…」「以后记得…」「存进记忆」等。当用户说「记住你是…」「你的名字叫…」时，表示为 AI 设定角色身份，sectionTitle 应设为「AI 角色设定」。如果用户明确点名 `soul.md`、`identity.md`、`memory.md` 或 `memory-system.md`，请把 targetFile 设成对应文件名。',
      parameters: {
        type: 'object',
        properties: {
          sectionTitle: { type: 'string', description: "记忆分区，如 '长期记忆'、'用户偏好'、'名字与称呼'、'观点与判断'、'AI 角色设定'" },
          content: { type: 'string', description: '要记住的具体内容' },
          targetFile: { type: 'string', description: "可选。显式指定目标文件：'soul.md'、'identity.md'、'memory.md'、'memory-system.md'、'user.md'" },
        },
        required: ['content'],
      },
    },
    memory_write_user: {
      description: '写入用户身份信息，如名字、称呼、偏好称谓。适用于「以后叫我…」「我的名字是…」。',
      parameters: {
        type: 'object',
        properties: {
          sectionTitle: { type: 'string', description: "通常为 '名字与称呼'" },
          content: { type: 'string', description: '用户名字或称呼，如「用户名字：少城」' },
        },
        required: ['content'],
      },
    },
    memory_rewrite_section: {
      description: '重写记忆文件中的某个分区。适用于「修改/改写/重写 soul 的 XX 部分」或明确点名 `identity.md` / `memory.md` / `memory-system.md` 的情况。',
      parameters: {
        type: 'object',
        properties: {
          sectionTitle: { type: 'string', description: '要重写的分区名称' },
          content: { type: 'string', description: '替换后的完整内容' },
          targetFile: { type: 'string', description: "可选。显式指定目标文件：'soul.md'、'identity.md'、'memory.md'、'memory-system.md'、'user.md'" },
        },
        required: ['sectionTitle', 'content'],
      },
    },
    add_flash_thought: {
      description: '新增一条闪念。适用于「记一条闪念」「加个闪念」等。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '闪念内容' },
        },
        required: ['text'],
      },
    },
    add_fixed_thought: {
      description: '新增一条定念。适用于「加一条定念」「新增定念」。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '定念内容' },
        },
        required: ['text'],
      },
    },
    delete_fixed_thought: {
      description: '删除一条定念。适用于「删除 XX 这个定念」。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要删除的定念名称或内容' },
        },
        required: ['text'],
      },
    },
    add_reminder: {
      description: '新增一条提醒。适用于「提醒我…」「设一个提醒…」「明天下午三点提醒我开会」。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '提醒事项描述' },
          datetime: { type: 'string', description: "提醒时间，ISO 8601 或自然语言如 '明天 09:00'" },
          repeat: { type: 'string', description: "重复规则，如 'daily'、'weekly'、'none'（默认 none）" },
        },
        required: ['text'],
      },
    },
    update_reminder: {
      description: '修改已有提醒。适用于「把那个提醒改到…」「修改提醒」。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '要修改的提醒 ID' },
          text: { type: 'string', description: '新的提醒描述' },
          datetime: { type: 'string', description: '新的提醒时间' },
          status: { type: 'string', description: "'pending'、'done'、'cancelled'" },
        },
        required: ['id'],
      },
    },
    delete_reminder: {
      description: '删除提醒。适用于「删除那个提醒」「取消提醒」。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '要删除的提醒 ID（若删除全部则留空）' },
          deleteAllMatches: { type: 'boolean', description: '是否删除所有匹配的提醒' },
        },
      },
    },
    append_daily_log: {
      description: '往今日日志追加内容。适用于「写进今天的日志」「日志加一条」。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要追加的日志内容' },
          preserveStyle: { type: 'boolean', description: '是否保留原有格式风格' },
        },
        required: ['text'],
      },
    },
    append_daily_log_under_date: {
      description: '往指定日期的日志追加内容。适用于「写进昨天的日志」「3 月 1 日日志加一条」。',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: "目标日期，如 '2026-04-05'" },
          text: { type: 'string', description: '要追加的日志内容' },
        },
        required: ['date', 'text'],
      },
    },
    update_daily_log_entry: {
      description: '修改已有日志条目。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '条目 ID' },
          text: { type: 'string', description: '替换后的文字' },
        },
        required: ['id', 'text'],
      },
    },
    delete_daily_log_entry: {
      description: '删除日志条目。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '条目 ID' },
        },
        required: ['id'],
      },
    },
    create_project: {
      description: '新建项目。适用于「帮我新建一个项目，叫做 X」。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '项目名称' },
        },
        required: ['name'],
      },
    },
    update_project_status: {
      description: '更新项目状态（归档、恢复等）。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '项目 ID' },
          name: { type: 'string', description: '项目名称（用于匹配）' },
          status: { type: 'string', description: "'active'、'archived'、'deleted'" },
        },
        required: ['status'],
      },
    },
    rename_project: {
      description: '重命名项目。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '项目 ID' },
          name: { type: 'string', description: '新名称' },
        },
        required: ['name'],
      },
    },
    delete_project: {
      description: '删除项目。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '项目 ID' },
          name: { type: 'string', description: '项目名称' },
        },
      },
    },
    create_routine: {
      description: '新建例程/习惯。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '例程名称' },
        },
        required: ['name'],
      },
    },
    append_project_block: {
      description: '给项目追加内容块。',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: '项目 ID' },
          text: { type: 'string', description: '块内容' },
        },
        required: ['text'],
      },
    },
    update_project_block: {
      description: '更新项目内容块。',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: '项目 ID' },
          blockId: { type: 'string', description: '块 ID' },
          text: { type: 'string', description: '替换后的文字' },
        },
        required: ['blockId', 'text'],
      },
    },
    delete_project_block: {
      description: '删除项目内容块。',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: '项目 ID' },
          blockId: { type: 'string', description: '块 ID' },
        },
        required: ['blockId'],
      },
    },
    add_project_reference: {
      description: '添加项目参考。',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: '项目 ID' },
          text: { type: 'string', description: '参考内容' },
        },
        required: ['text'],
      },
    },
    update_project_reference: {
      description: '更新项目参考。',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: '项目 ID' },
          referenceId: { type: 'string', description: '参考 ID' },
          text: { type: 'string', description: '替换后的文字' },
        },
        required: ['referenceId', 'text'],
      },
    },
    delete_project_reference: {
      description: '删除项目参考。',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: '项目 ID' },
          referenceId: { type: 'string', description: '参考 ID' },
        },
        required: ['referenceId'],
      },
    },
    add_expense_record: {
      description: '记一笔支出。适用于「今天午餐花了 35 元」「记一笔 XX 元」「充话费 200 元，记个账」。',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: '支出项目名称，如「午餐」「打车」「给老婆充话费」' },
          amount: { type: 'number', description: '金额' },
          category: { type: 'string', description: "分类，如 '餐饮'、'交通'、'生活'、'通讯'" },
          note: { type: 'string', description: '备注' },
          date: { type: 'string', description: '消费日期' },
        },
        required: ['item', 'amount'],
      },
    },
    update_expense_record: {
      description: '修改已有支出记录。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '记录 ID' },
          amount: { type: 'number', description: '新金额' },
          category: { type: 'string', description: '新分类' },
          note: { type: 'string', description: '新备注' },
        },
        required: ['id'],
      },
    },
    delete_expense_record: {
      description: '删除支出记录。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '记录 ID' },
        },
        required: ['id'],
      },
    },
    undo_last_ai_transaction: {
      description: '撤销上一次 AI 执行的操作。适用于「撤销」「回退刚才的操作」。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    undo_last_expense_record: {
      description: '撤销上一条记账。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    undo_last_external_sync: {
      description: '撤销上一次外部同步。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    undo_last_manual_transaction: {
      description: '撤销上一次手动操作。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    undo_log_or_reminder_change: {
      description: '撤销最近的日志或提醒修改。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    summarize_today_to_daily_log: {
      description: '汇总今天的内容并写入日志。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    group_flash_thoughts: {
      description: '将多条闪念分组。',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: '闪念 ID 列表' },
          groupName: { type: 'string', description: '分组名称' },
        },
      },
    },
    move_flash_to_fixed: {
      description: '将闪念转为定念。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '闪念 ID' },
        },
        required: ['id'],
      },
    },
    move_flash_to_project_reference: {
      description: '将闪念移到项目参考区。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '闪念 ID' },
          projectId: { type: 'string', description: '目标项目 ID' },
        },
        required: ['id'],
      },
    },
    ungroup_flash_thoughts: {
      description: '解散闪念分组。',
      parameters: {
        type: 'object',
        properties: {
          groupId: { type: 'string', description: '分组 ID' },
        },
        required: ['groupId'],
      },
    },
    merge_flash_thoughts: {
      description: '合并多条闪念为一条。',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: '要合并的闪念 ID 列表' },
          mergedText: { type: 'string', description: '合并后的文字' },
        },
        required: ['ids'],
      },
    },
    dedupe_flash_thoughts: {
      description: '闪念去重。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    dedupe_project_references: {
      description: '项目参考去重。',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: '项目 ID' },
        },
      },
    },
    create_project_from_flash_group: {
      description: '从闪念分组创建新项目。',
      parameters: {
        type: 'object',
        properties: {
          groupId: { type: 'string', description: '分组 ID' },
          name: { type: 'string', description: '新项目名称' },
        },
        required: ['name'],
      },
    },
    create_visual_organizer: {
      description: '生成视觉组织图。适用于「做一个对比图」「帮我画一个流程图」。',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '图的描述或问题' },
          templateKey: { type: 'string', description: "图类型，如 'comparison'、'hierarchy'、'flowchart'、'concept_map'" },
        },
        required: ['prompt'],
      },
    },
    plan_week_schedule_draft: {
      description: '生成周计划草案。',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '计划需求描述' },
        },
      },
    },
    plan_today_time_blocks: {
      description: '规划今天的时间块。',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '时间块规划需求' },
        },
      },
    },
    self_update_runtime_rules: {
      description: '更新 Morpheus 运行时规则/行为。',
      parameters: {
        type: 'object',
        properties: {
          ruleKey: { type: 'string', description: '规则键名' },
          ruleValue: { type: 'string', description: '规则值' },
        },
        required: ['ruleKey', 'ruleValue'],
      },
    },
    trigger_proactive_scan: {
      description: '触发一次主动巡检。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  };
  const TOOL_NARROWING_GENERIC_SKILL_IDS = new Set([
    'morph-data-operations',
  ]);
  const TOOL_NARROWING_BACKSTOP_ACTION_TYPES = [
    'undo_last_ai_transaction',
    'undo_last_manual_transaction',
    'undo_last_external_sync',
    'undo_log_or_reminder_change',
  ];
  const TOOL_ACTION_FAMILY_BY_TYPE = {
    write_soul_memory: 'memory',
    memory_write_user: 'memory',
    memory_rewrite_section: 'memory',
    add_flash_thought: 'flash',
    add_fixed_thought: 'flash',
    delete_fixed_thought: 'flash',
    add_reminder: 'reminder',
    update_reminder: 'reminder',
    delete_reminder: 'reminder',
    append_daily_log: 'daily-log',
    append_daily_log_under_date: 'daily-log',
    update_daily_log_entry: 'daily-log',
    delete_daily_log_entry: 'daily-log',
    summarize_today_to_daily_log: 'daily-log',
    create_project: 'project',
    update_project_status: 'project',
    rename_project: 'project',
    delete_project: 'project',
    create_routine: 'project',
    append_project_block: 'project',
    update_project_block: 'project',
    delete_project_block: 'project',
    add_project_reference: 'project',
    update_project_reference: 'project',
    delete_project_reference: 'project',
    move_flash_to_project_reference: 'project',
    move_fixed_to_project: 'project',
    create_project_from_flash_group: 'project',
    group_flash_thoughts: 'flash',
    ungroup_flash_thoughts: 'flash',
    merge_flash_thoughts: 'flash',
    dedupe_flash_thoughts: 'flash',
    move_flash_to_fixed: 'flash',
    add_expense_record: 'expense',
    update_expense_record: 'expense',
    delete_expense_record: 'expense',
    undo_last_expense_record: 'expense',
    plan_today_time_blocks: 'schedule',
    plan_week_schedule_draft: 'schedule',
    create_visual_organizer: 'visual',
    self_update_runtime_rules: 'runtime',
    trigger_proactive_scan: 'runtime',
    undo_last_ai_transaction: 'undo',
    undo_last_manual_transaction: 'undo',
    undo_last_external_sync: 'undo',
    undo_log_or_reminder_change: 'undo',
  };

  function normalizeText(value = '') {
    return String(value || '').trim();
  }

  function normalizeStringList(values = []) {
    return (Array.isArray(values) ? values : [])
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  function inferRelevantToolFamilies(promptQuestion = '') {
    const text = normalizeText(promptQuestion);
    const families = new Set();
    if (!text) return families;
    if (/(提醒|闹钟|叫我|通知我|几分钟后|几点|明天早上|后天|下周|到时候提醒|提醒我)/i.test(text)) families.add('reminder');
    if (/(写进|写入|记进|记入|放进|放入|存进|存入|追加到|补进|更新|修改|删除|删掉|清理).{0,12}(日志|日记|今日记录|今日日志|今天日志)|(?:日志|日记|今日记录|今日日志|今天日志).{0,12}(写进|写入|记进|记入|放进|放入|存进|存入|追加|补进|更新|修改|删除|删掉|清理)|总结今天.{0,8}(写进|写入|记进|记入|日志)/i.test(text)) families.add('daily-log');
    if (/(记账|支出|花了|停车费|晚饭|咖啡|报销|消费|金额|元|块钱)/i.test(text)) families.add('expense');
    if (/(新增|添加|加入|记一条|记下|删除|删掉|归类|分组|合并|去重|移动).{0,12}(闪念|定念|灵感|想法|碎念)/i.test(text)) families.add('flash');
    if (/(新建|创建|新增|建一个|加一个|追加|写进|写入|放进|更新|修改|删除|删掉|重命名).{0,14}(项目|project|参考区|参考碎片|项目正文|块内容|block|routine|例行|例程)/i.test(text)) families.add('project');
    if (/(视觉组织图|对比图|层级图|概念图|流程图|视觉图|organizer|kwl|脑图)/i.test(text)) families.add('visual');
    if (/(时间块|本周|下周|最近七天|未来一周|今天安排|排期|日程|schedule|日历)/i.test(text)) families.add('schedule');
    if (/(记住|写进记忆|存进|写入.*memory|写入.*soul|以后叫我|我的名字是|你的名字|角色设定)/i.test(text)) families.add('memory');
    if (/(自升级|运行时规则|runtime|contextRules|memoryRules|skills|巡检|主动扫描|heartbeat|升级方案)/i.test(text)) families.add('runtime');
    if (/(撤销|回退|恢复|撤回|取消).{0,16}(刚刚|刚才|上一次|上次|那次|上一轮|最近一次|最近|上一步|上一条|操作|动作|修改|写入|整理|调整|变更)/i.test(text)) families.add('undo');
    return families;
  }

  /**
   * @param {object} [deps]
   * @param {() => string[]} [deps.getPreferredMorphPromptActionTypes]
   * @param {(actionType: string) => { skillId?: string, skillLabel?: string } | null} [deps.getMorphSkillDescriptorForActionType]
   * @param {(skillId: string) => string[]} [deps.getMorphActionTypesForSkillId]
   * @param {(skillId: string) => boolean} [deps.isGenericMorphSkillId]
   */
  function createAIToolDefinitionsRuntime(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function resolveActionSkillRuntime() {
      return typeof window !== 'undefined'
        && window.MorphAIActionSkillRuntime
        && typeof window.MorphAIActionSkillRuntime.create === 'function'
        ? window.MorphAIActionSkillRuntime.create()
        : null;
    }

    function isGenericSkillId(skillId = '') {
      const id = normalizeText(skillId);
      if (!id) return false;
      if (typeof api.isGenericMorphSkillId === 'function') return !!api.isGenericMorphSkillId(id);
      const runtime = resolveActionSkillRuntime();
      if (runtime && typeof runtime.isGenericMorphSkillId === 'function') {
        return !!runtime.isGenericMorphSkillId(id);
      }
      return TOOL_NARROWING_GENERIC_SKILL_IDS.has(id);
    }

    function getActionTypesForSkillId(skillId = '') {
      const id = normalizeText(skillId);
      if (!id) return [];
      if (typeof api.getMorphActionTypesForSkillId === 'function') {
        return normalizeStringList(api.getMorphActionTypesForSkillId(id));
      }
      const runtime = resolveActionSkillRuntime();
      if (runtime && typeof runtime.getMorphActionTypesForSkillId === 'function') {
        return normalizeStringList(runtime.getMorphActionTypesForSkillId(id));
      }
      return [];
    }

    function getSkillDescriptorForActionType(actionType = '') {
      const type = normalizeText(actionType);
      if (!type) return null;
      if (typeof api.getMorphSkillDescriptorForActionType === 'function') {
        return api.getMorphSkillDescriptorForActionType(type);
      }
      const runtime = resolveActionSkillRuntime();
      if (runtime && typeof runtime.getMorphSkillDescriptorForActionType === 'function') {
        return runtime.getMorphSkillDescriptorForActionType(type);
      }
      return null;
    }

    function resolveToolActionTypes(options = {}) {
      let preferredActionTypes = typeof api.getPreferredMorphPromptActionTypes === 'function'
        ? normalizeStringList(api.getPreferredMorphPromptActionTypes())
        : [];
      if (!preferredActionTypes.length) preferredActionTypes = Object.keys(ACTION_TOOL_SCHEMAS);
      const activeSkillIds = normalizeStringList(options.activeSkillIds);
      const concreteSkillIds = activeSkillIds.filter((skillId) => !isGenericSkillId(skillId));
      const shouldNarrowBySkill = concreteSkillIds.length === 1 && concreteSkillIds.length === activeSkillIds.length;
      if (!shouldNarrowBySkill) return preferredActionTypes;
      const allowedSkillActionTypes = new Set(getActionTypesForSkillId(concreteSkillIds[0]));
      TOOL_NARROWING_BACKSTOP_ACTION_TYPES.forEach((actionType) => {
        if (ACTION_TOOL_SCHEMAS[actionType]) allowedSkillActionTypes.add(actionType);
      });
      if (!allowedSkillActionTypes.size) return preferredActionTypes;
      const narrowedPreferred = preferredActionTypes.filter((actionType) => allowedSkillActionTypes.has(actionType));
      if (narrowedPreferred.length) return narrowedPreferred;
      return Array.from(allowedSkillActionTypes);
    }

    function narrowToolActionTypesByQuestion(actionTypes = [], promptQuestion = '') {
      const question = normalizeText(promptQuestion);
      if (!question) return actionTypes;
      const families = inferRelevantToolFamilies(question);
      if (!families.size) return [];
      return actionTypes.filter((actionType) => (
        families.has(TOOL_ACTION_FAMILY_BY_TYPE[actionType])
        || TOOL_NARROWING_BACKSTOP_ACTION_TYPES.includes(actionType)
      ));
    }

    /**
     * Build OpenAI-compatible tool definitions for the currently allowed action types.
     * @param {{ allowMorphDataActions?: boolean, activeSkillIds?: string[] }} [options]
     * @returns {Array<{ type: 'function', function: { name: string, description: string, parameters: Record<string, unknown> } }>}
     */
    function buildMorphToolDefinitions(options = {}) {
      if (!options.allowMorphDataActions) return [];
      const actionTypes = narrowToolActionTypesByQuestion(resolveToolActionTypes(options), options.promptQuestion);
      /** @type {Array<{ type: 'function', function: { name: string, description: string, parameters: Record<string, unknown> } }>} */
      const tools = [];
      for (const actionType of actionTypes) {
        const schema = ACTION_TOOL_SCHEMAS[actionType];
        if (!schema) continue;
        tools.push({
          type: 'function',
          function: {
            name: actionType,
            description: schema.description,
            parameters: schema.parameters,
          },
        });
      }
      return tools;
    }

    /**
     * Convert tool_calls from an OpenAI-compatible response into Morpheus AIAction[].
     * @param {Array<{ id?: string, function?: { name?: string, arguments?: string } }>} toolCalls
     * @returns {import('../../interfaces').AIAction[]}
     */
    function convertToolCallsToActions(toolCalls) {
      if (!Array.isArray(toolCalls)) return [];
      /** @type {import('../../interfaces').AIAction[]} */
      const actions = [];
      for (const call of toolCalls) {
        const name = String(call?.function?.name || '').trim();
        if (!name) continue;
        let args = {};
        try {
          const raw = call?.function?.arguments;
          args = typeof raw === 'string' ? JSON.parse(raw) : (raw && typeof raw === 'object' ? raw : {});
        } catch (_) {
          args = {};
        }
        const skill = getSkillDescriptorForActionType(name);
        actions.push({
          type: name,
          source: 'tool_use',
          ...(skill && skill.skillId ? { skillId: skill.skillId } : {}),
          ...(skill && skill.skillLabel ? { skillLabel: skill.skillLabel } : {}),
          ...args,
        });
      }
      return actions;
    }

    /**
     * Check whether a raw API response message used tool_calls (function calling).
     * Works for OpenAI-compatible responses (OpenRouter / GLM / Doubao / Qwen / Kimi / Codex).
     * @param {Record<string, unknown>} responseMessage  choices[0].message
     * @returns {boolean}
     */
    function hasToolCalls(responseMessage) {
      return Array.isArray(responseMessage?.tool_calls) && responseMessage.tool_calls.length > 0;
    }

    return {
      buildMorphToolDefinitions,
      convertToolCallsToActions,
      hasToolCalls,
      ACTION_TOOL_SCHEMAS,
    };
  }

  window.MorphAIToolDefinitionsRuntime = {
    create: createAIToolDefinitionsRuntime,
  };
})();
