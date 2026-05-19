// @ts-check

(function initMorphAIActionSkillRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionSkillRuntime && typeof window.MorphAIActionSkillRuntime.create === 'function') return;

  const SKILL_LABELS_BY_ID = {
    'morph-data-operations': 'Morpheus Data Operations',
    'morph-daily-log-operations': 'Morpheus Daily Log Operations',
    'morph-thought-operations': 'Morpheus Thought Operations',
    'morph-project-operations': 'Morpheus Project Operations',
    'morph-reminder-operations': 'Morpheus Reminder Operations',
    'morph-expense-ledger-operations': 'Morpheus Expense Ledger Operations',
    'morph-planning-operations': 'Morpheus Planning Operations',
    'morph-proactive-operations': 'Morpheus Proactive Operations',
    'morph-health-glucose-support': 'Morpheus Health Glucose Support',
  };
  const GENERIC_SKILL_IDS = new Set([
    'morph-data-operations',
  ]);

  const ACTION_SKILL_ID_MAP = {
    append_daily_log: 'morph-daily-log-operations',
    append_daily_log_under_date: 'morph-daily-log-operations',
    update_daily_log_entry: 'morph-daily-log-operations',
    delete_daily_log_entry: 'morph-daily-log-operations',
    summarize_today_to_daily_log: 'morph-daily-log-operations',
    add_flash_thought: 'morph-thought-operations',
    add_fixed_thought: 'morph-thought-operations',
    delete_fixed_thought: 'morph-thought-operations',
    group_flash_thoughts: 'morph-thought-operations',
    move_flash_to_fixed: 'morph-thought-operations',
    move_fixed_to_project: 'morph-thought-operations',
    move_flash_to_project_reference: 'morph-thought-operations',
    ungroup_flash_thoughts: 'morph-thought-operations',
    merge_flash_thoughts: 'morph-thought-operations',
    dedupe_flash_thoughts: 'morph-thought-operations',
    dedupe_project_references: 'morph-thought-operations',
    create_project_from_flash_group: 'morph-thought-operations',
    create_project: 'morph-project-operations',
    update_project_status: 'morph-project-operations',
    create_routine: 'morph-project-operations',
    rename_project: 'morph-project-operations',
    append_project_block: 'morph-project-operations',
    update_project_block: 'morph-project-operations',
    delete_project_block: 'morph-project-operations',
    add_project_reference: 'morph-project-operations',
    update_project_reference: 'morph-project-operations',
    delete_project_reference: 'morph-project-operations',
    delete_project: 'morph-project-operations',
    add_reminder: 'morph-reminder-operations',
    update_reminder: 'morph-reminder-operations',
    delete_reminder: 'morph-reminder-operations',
    add_expense_record: 'morph-expense-ledger-operations',
    update_expense_record: 'morph-expense-ledger-operations',
    delete_expense_record: 'morph-expense-ledger-operations',
    undo_last_expense_record: 'morph-expense-ledger-operations',
    plan_week_schedule_draft: 'morph-planning-operations',
    plan_today_time_blocks: 'morph-planning-operations',
    trigger_proactive_scan: 'morph-proactive-operations',
    undo_log_or_reminder_change: 'morph-data-operations',
    undo_last_ai_transaction: 'morph-data-operations',
    undo_last_external_sync: 'morph-data-operations',
    undo_last_manual_transaction: 'morph-data-operations',
    write_soul_memory: 'morph-data-operations',
    memory_write_user: 'morph-data-operations',
    memory_rewrite_section: 'morph-data-operations',
    self_update_runtime_rules: 'morph-data-operations',
    create_visual_organizer: 'morph-data-operations',
    create_and_install_plugin: 'morph-data-operations',
    implement_existing_plugin_source: 'morph-data-operations',
    external_sync_apply: 'morph-data-operations',
    external_sync_restore: 'morph-data-operations',
  };
  const SKILL_ACTION_TYPES_MAP = Object.entries(ACTION_SKILL_ID_MAP)
    .reduce((acc, [actionType, skillId]) => {
      const key = normalizeText(skillId);
      if (!key) return acc;
      if (!Array.isArray(acc[key])) acc[key] = [];
      acc[key].push(normalizeText(actionType));
      return acc;
    }, /** @type {Record<string, string[]>} */ ({}));

  function normalizeText(value = '') {
    return String(value || '').trim();
  }

  function inferMorphSkillIdForActionType(actionType = '') {
    const type = normalizeText(actionType);
    if (!type) return '';
    if (ACTION_SKILL_ID_MAP[type]) return ACTION_SKILL_ID_MAP[type];
    if (/glucose|health/i.test(type)) return 'morph-health-glucose-support';
    if (/proactive|heartbeat/i.test(type)) return 'morph-proactive-operations';
    if (/daily_log|journal/i.test(type)) return 'morph-daily-log-operations';
    if (/expense|ledger/i.test(type)) return 'morph-expense-ledger-operations';
    if (/reminder/i.test(type)) return 'morph-reminder-operations';
    if (/project|routine/i.test(type)) return 'morph-project-operations';
    if (/flash|fixed|thought|group|merge|dedupe|ungroup/i.test(type)) return 'morph-thought-operations';
    if (/plan_|schedule|time_blocks/i.test(type)) return 'morph-planning-operations';
    return 'morph-data-operations';
  }

  function buildMorphSkillDescriptor(skillId = '') {
    const id = normalizeText(skillId);
    if (!id) return null;
    return {
      skillId: id,
      skillLabel: normalizeText(SKILL_LABELS_BY_ID[id] || id),
    };
  }

  function createAIActionSkillRuntime() {
    function isGenericMorphSkillId(skillId = '') {
      return GENERIC_SKILL_IDS.has(normalizeText(skillId));
    }

    function getMorphSkillDescriptorForActionType(actionType = '') {
      return buildMorphSkillDescriptor(inferMorphSkillIdForActionType(actionType));
    }

    function getMorphActionTypesForSkillId(skillId = '') {
      const key = normalizeText(skillId);
      return key && Array.isArray(SKILL_ACTION_TYPES_MAP[key])
        ? SKILL_ACTION_TYPES_MAP[key].slice()
        : [];
    }

    function getMorphActionTypesForSkillIds(skillIds = []) {
      const seen = new Set();
      return (Array.isArray(skillIds) ? skillIds : [])
        .flatMap((skillId) => getMorphActionTypesForSkillId(skillId))
        .filter((actionType) => actionType && !seen.has(actionType) && seen.add(actionType));
    }

    function getMorphSkillDescriptorsForActionTypes(actionTypes = []) {
      const seen = new Set();
      return (Array.isArray(actionTypes) ? actionTypes : [])
        .map((item) => getMorphSkillDescriptorForActionType(item))
        .filter((item) => item && item.skillId && !seen.has(item.skillId) && seen.add(item.skillId));
    }

    return {
      inferMorphSkillIdForActionType,
      isGenericMorphSkillId,
      getMorphSkillDescriptorForActionType,
      getMorphActionTypesForSkillId,
      getMorphActionTypesForSkillIds,
      getMorphSkillDescriptorsForActionTypes,
    };
  }

  window.MorphAIActionSkillRuntime = {
    create: createAIActionSkillRuntime,
  };
})();
