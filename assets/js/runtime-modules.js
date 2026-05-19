(function () {
  function createRuntimeModules(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const HIDDEN_PROMPT_ACTION_TYPES = new Set([
      'self_update_runtime_rules',
      'trigger_proactive_scan',
    ]);
    const getEcosystemRegistryRuntimeModules = typeof api.getEcosystemRegistryRuntimeModules === 'function'
      ? api.getEcosystemRegistryRuntimeModules
      : () => (typeof globalThis !== 'undefined' && typeof globalThis.getEcosystemRegistryRuntimeModules === 'function'
        ? globalThis.getEcosystemRegistryRuntimeModules()
        : null);
    const getPermissionContextRuntimeModules = typeof api.getPermissionContextRuntimeModules === 'function'
      ? api.getPermissionContextRuntimeModules
      : () => (typeof globalThis !== 'undefined' && typeof globalThis.getPermissionContextRuntimeModules === 'function'
        ? globalThis.getPermissionContextRuntimeModules()
        : null);
    const EXPLICIT_CONSENT_ACTIONS = new Set([
      'write_soul_memory',
      'memory_write_user',
      'memory_rewrite_section',
      'self_update_runtime_rules',
    ]);
    const ORACLE_SAFE_ACTIONS = new Set([
      'add_flash_thought',
      'add_fixed_thought',
      'append_daily_log',
      'append_daily_log_under_date',
      'add_reminder',
      'summarize_today_to_daily_log',
      'trigger_proactive_scan',
    ]);
    const DISABLED_BY_DEFAULT_ACTIONS = new Set([
      'create_and_install_plugin',
      'implement_existing_plugin_source',
      'delete_entity',
      'bulk_overwrite_root',
      'bulk_archive_entities',
      'move_entities_across_domains',
      'update_secure_vault',
    ]);
    const FALLBACK_ACTION_TYPES = [
      'add_flash_thought',
      'add_fixed_thought',
      'add_expense_record',
      'update_expense_record',
      'delete_expense_record',
      'undo_last_expense_record',
      'create_visual_organizer',
      'group_flash_thoughts',
      'write_soul_memory',
      'create_project',
      'update_project_status',
      'create_routine',
      'rename_project',
      'append_project_block',
      'add_project_reference',
      'update_project_block',
      'delete_project_block',
      'update_project_reference',
      'delete_project_reference',
      'delete_project',
      'append_daily_log',
      'append_daily_log_under_date',
      'add_reminder',
      'delete_reminder',
      'update_reminder',
      'delete_daily_log_entry',
      'update_daily_log_entry',
      'undo_log_or_reminder_change',
      'undo_last_ai_transaction',
      'undo_last_external_sync',
      'undo_last_manual_transaction',
      'plan_week_schedule_draft',
      'plan_today_time_blocks',
      'summarize_today_to_daily_log',
      'move_flash_to_fixed',
      'move_fixed_to_project',
      'move_flash_to_project_reference',
      'ungroup_flash_thoughts',
      'merge_flash_thoughts',
      'dedupe_flash_thoughts',
      'dedupe_project_references',
      'create_project_from_flash_group',
      'memory_write_user',
      'memory_rewrite_section',
      'self_update_runtime_rules',
      'trigger_proactive_scan',
      'delete_entity',
      'bulk_overwrite_root',
      'bulk_archive_entities',
      'move_entities_across_domains',
      'update_secure_vault',
    ];

    function getActiveRuntimeBundle(runtimeOverride) {
      return runtimeOverride && typeof runtimeOverride === 'object'
        ? runtimeOverride
        : api.getMorphRuntimeBundle();
    }

    function getConfiguredRuntimeActions(runtimeOverride) {
      const runtime = getActiveRuntimeBundle(runtimeOverride);
      const actionPolicy = runtime?.actionPolicy && typeof runtime.actionPolicy === 'object'
        ? runtime.actionPolicy
        : null;
      return actionPolicy?.actions && typeof actionPolicy.actions === 'object'
        ? actionPolicy.actions
        : null;
    }

    function getMorphActionExecutionPolicy(actionType = '', runtimeOverride = null) {
      const permissionRuntime = getPermissionContextRuntimeModules();
      if (permissionRuntime && typeof permissionRuntime.getMorphActionExecutionPolicy === 'function') {
        return permissionRuntime.getMorphActionExecutionPolicy(actionType, runtimeOverride);
      }
      const type = String(actionType || '').trim();
      const configuredActions = getConfiguredRuntimeActions(runtimeOverride);
      const configured = configuredActions && configuredActions[type] && typeof configuredActions[type] === 'object'
        ? configuredActions[type]
        : null;
      const buildPolicy = (overrides = {}) => ({
        action: type || 'unknown',
        domain: 'general',
        permissionLevel: 'update',
        consentTier: 'architect-required',
        riskLevel: 'medium',
        notes: '',
        ...overrides,
      });
      if (type && configured) {
        return buildPolicy({
          action: type,
          domain: String(configured.domain || 'general').trim() || 'general',
          permissionLevel: String(configured.permissionLevel || 'update').trim() || 'update',
          consentTier: String(configured.consentTier || 'architect-required').trim() || 'architect-required',
          riskLevel: String(configured.riskLevel || 'medium').trim() || 'medium',
          notes: String(configured.notes || '').trim(),
        });
      }
      if (!type) return buildPolicy({ action: 'unknown', notes: 'unknown action type' });
      if (DISABLED_BY_DEFAULT_ACTIONS.has(type)) {
        return buildPolicy({
          domain: 'system',
          permissionLevel: 'admin',
          consentTier: 'disabled',
          riskLevel: 'high',
          notes: 'disabled by default in phase 1',
        });
      }
      if (EXPLICIT_CONSENT_ACTIONS.has(type)) {
        return buildPolicy({
          domain: /runtime/.test(type) ? 'runtime' : 'memory',
          permissionLevel: 'admin',
          consentTier: 'explicit-consent-required',
          riskLevel: 'high',
          notes: 'requires explicit user authorization',
        });
      }
      if (ORACLE_SAFE_ACTIONS.has(type)) {
        return buildPolicy({
          domain: /daily_log/.test(type)
            ? 'daily'
            : type === 'add_reminder'
              ? 'reminders'
              : /flash/.test(type)
                ? 'flashThoughts'
                : /fixed/.test(type)
                  ? 'fixed'
                  : type === 'trigger_proactive_scan'
                    ? 'runtime'
                    : 'general',
          permissionLevel: type === 'trigger_proactive_scan' ? 'read' : 'append',
          consentTier: 'oracle-safe',
          riskLevel: type === 'trigger_proactive_scan' ? 'medium' : 'low',
          notes: type === 'trigger_proactive_scan'
            ? 'allowed as runtime execution without direct data write'
            : 'safe to commit when user intent is clear',
        });
      }
      if (type === 'undo_last_ai_transaction') {
        return buildPolicy({
          domain: 'system',
          permissionLevel: 'restore',
          consentTier: 'architect-required',
          riskLevel: 'high',
          notes: 'restores the latest committed AI transaction when the touched domains are unchanged',
        });
      }
      if (type === 'undo_last_external_sync') {
        return buildPolicy({
          domain: 'system',
          permissionLevel: 'restore',
          consentTier: 'architect-required',
          riskLevel: 'high',
          notes: 'restores the latest external sync transaction when the touched domains are unchanged',
        });
      }
      if (type === 'undo_last_manual_transaction') {
        return buildPolicy({
          domain: 'system',
          permissionLevel: 'restore',
          consentTier: 'architect-required',
          riskLevel: 'high',
          notes: 'restores the latest manual transaction when the touched domains are unchanged',
        });
      }
      if (/expense/.test(type)) {
        return buildPolicy({
          domain: 'expenseLedger',
          permissionLevel: /delete|undo/.test(type) ? 'archive' : /update/.test(type) ? 'update' : 'append',
          consentTier: 'architect-required',
          riskLevel: /delete|undo/.test(type) ? 'high' : 'medium',
          notes: 'financial records should follow structured confirmation thresholds',
        });
      }
      if (/project/.test(type)) {
        return buildPolicy({
          domain: 'projects',
          permissionLevel: /delete/.test(type) ? 'archive' : /rename|update/.test(type) ? 'update' : 'append',
          consentTier: 'architect-required',
          riskLevel: /delete/.test(type) ? 'high' : 'medium',
          notes: 'project structure changes should be architect-led',
        });
      }
      if (/fixed/.test(type)) {
        return buildPolicy({
          domain: 'thoughts',
          permissionLevel: /delete/.test(type) ? 'archive' : /update/.test(type) ? 'update' : 'append',
          consentTier: /delete/.test(type) ? 'architect-required' : 'oracle-safe',
          riskLevel: /delete/.test(type) ? 'medium' : 'low',
          notes: 'fixed-thought writes should remain reversible and clearly targeted',
        });
      }
      if (/routine|week_schedule|time_blocks/.test(type)) {
        return buildPolicy({
          domain: 'routines',
          permissionLevel: 'update',
          consentTier: 'architect-required',
          riskLevel: 'medium',
          notes: 'schedule construction should be stabilized before commit',
        });
      }
      if (/daily_log/.test(type)) {
        return buildPolicy({
          domain: 'daily',
          permissionLevel: /delete|update/.test(type) ? 'update' : 'append',
          consentTier: 'architect-required',
          riskLevel: /delete/.test(type) ? 'medium' : 'low',
          notes: 'daily edits beyond append should require stronger structure signals',
        });
      }
      if (/reminder/.test(type)) {
        return buildPolicy({
          domain: 'reminders',
          permissionLevel: /delete/.test(type) ? 'archive' : /update/.test(type) ? 'update' : 'append',
          consentTier: 'architect-required',
          riskLevel: /delete|update/.test(type) ? 'medium' : 'low',
          notes: 'reminder mutations should preserve user timing intent',
        });
      }
      if (/visual_organizer/.test(type)) {
        return buildPolicy({
          domain: 'visualOrganizer',
          permissionLevel: 'append',
          consentTier: 'architect-required',
          riskLevel: 'medium',
          notes: 'visual outputs are draft artifacts that still reshape structure',
        });
      }
      if (/flash|fixed/.test(type)) {
        return buildPolicy({
          domain: /fixed/.test(type) ? 'fixed' : 'flashThoughts',
          permissionLevel: /delete|move|dedupe|merge|group|ungroup/.test(type) ? 'update' : 'append',
          consentTier: 'architect-required',
          riskLevel: /delete|merge|dedupe/.test(type) ? 'medium' : 'low',
          notes: 'reorganization actions should confirm structural intent',
        });
      }
      return buildPolicy();
    }

    function buildMorphActionPolicySummary(runtimeOverride = null) {
      const permissionRuntime = getPermissionContextRuntimeModules();
      if (permissionRuntime && typeof permissionRuntime.buildMorphActionPolicySummary === 'function') {
        return permissionRuntime.buildMorphActionPolicySummary(runtimeOverride);
      }
      const configuredActions = getConfiguredRuntimeActions(runtimeOverride);
      const summary = {
        oracleSafe: [],
        architectRequired: [],
        explicitConsentRequired: [],
        disabledByDefault: [],
      };
      const sourceActionTypes = configuredActions && Object.keys(configuredActions).length
        ? Object.keys(configuredActions)
        : FALLBACK_ACTION_TYPES;
      sourceActionTypes.forEach((actionType) => {
        const policy = getMorphActionExecutionPolicy(actionType, runtimeOverride);
        if (policy.consentTier === 'oracle-safe') summary.oracleSafe.push(policy.action);
        else if (policy.consentTier === 'architect-required') summary.architectRequired.push(policy.action);
        else if (policy.consentTier === 'explicit-consent-required') summary.explicitConsentRequired.push(policy.action);
        else if (policy.consentTier === 'disabled') summary.disabledByDefault.push(policy.action);
      });
      Object.values(summary).forEach((list) => {
        list.sort((left, right) => String(left || '').localeCompare(String(right || '')));
      });
      return summary;
    }

    function getPreferredMorphPromptActionTypes(runtimeOverride = null) {
      const permissionRuntime = getPermissionContextRuntimeModules();
      if (permissionRuntime && typeof permissionRuntime.getPreferredMorphPromptActionTypes === 'function') {
        return permissionRuntime.getPreferredMorphPromptActionTypes(runtimeOverride);
      }
      const runtime = getActiveRuntimeBundle(runtimeOverride);
      const configuredActions = getConfiguredRuntimeActions(runtime);
      const rawActionTypes = configuredActions ? Object.keys(configuredActions) : [];
      if (!rawActionTypes.length) return [];
      const actionContract = runtime?.actionContract && typeof runtime.actionContract === 'object'
        ? runtime.actionContract
        : null;
      const aliasMap = actionContract?.aliases && typeof actionContract.aliases === 'object'
        ? actionContract.aliases
        : {};
      const availableAliases = new Set(Object.keys(aliasMap).filter((key) => rawActionTypes.includes(key)));
      const canonicalCoveredByAlias = new Set(
        Array.from(availableAliases)
          .map((alias) => String(aliasMap[alias] || '').trim())
          .filter(Boolean)
      );
      const promptTypes = [];
      rawActionTypes.forEach((actionType) => {
        const type = String(actionType || '').trim();
        if (!type) return;
        if (HIDDEN_PROMPT_ACTION_TYPES.has(type)) return;
        if (availableAliases.has(type)) {
          promptTypes.push(type);
          return;
        }
        if (canonicalCoveredByAlias.has(type)) return;
        promptTypes.push(type);
      });
      return promptTypes;
    }

    function matchesMorphActionIntent(actionType = '', context = {}) {
      const permissionRuntime = getPermissionContextRuntimeModules();
      if (permissionRuntime && typeof permissionRuntime.matchesMorphActionIntent === 'function') {
        return permissionRuntime.matchesMorphActionIntent(actionType, context);
      }
      const type = String(actionType || '').trim();
      const promptQuestion = String(context.promptQuestion || '').trim();
      if (!type || !promptQuestion) return false;
      const explicitWriteIntent = context.explicitWriteIntent === true;
      const explicitMemoryWriteIntent = context.explicitMemoryWriteIntent === true;
      const implicitMemoryWriteIntent = context.implicitMemoryWriteIntent;
      const explicitRuntimeWriteIntent = context.explicitRuntimeWriteIntent === true;
      const hasPendingDataIntent = context.hasPendingDataIntent === true;
      const terseExpenseCaptureIntent = context.terseExpenseCaptureIntent === true;
      if (['write_soul_memory', 'memory_write_user', 'memory_rewrite_section'].includes(type)) {
        return explicitMemoryWriteIntent || !!implicitMemoryWriteIntent;
      }
      if (type === 'self_update_runtime_rules') return explicitRuntimeWriteIntent;
      if (/reminder/.test(type)) {
        return /(提醒|remind)/i.test(promptQuestion)
          || (typeof api.inferConversationalReminderDeleteActionFromQuestion === 'function'
            && !!api.inferConversationalReminderDeleteActionFromQuestion(promptQuestion));
      }
      if (/daily_log|summarize_today_to_daily_log/.test(type)) return /(日志|日记|daily|log)/i.test(promptQuestion) || hasPendingDataIntent;
      if (['move_flash_to_project_reference', 'add_project_reference', 'update_project_reference', 'delete_project_reference', 'dedupe_project_references'].includes(type)) {
        return /(项目参考|参考区|项目参考区|参考碎片|作为参考|放到参考|放进参考|加到参考|搬到项目|搬到参考区|移到参考区|挪到参考区|归到参考区|去重|清重|重复)/i.test(promptQuestion);
      }
      if (/project|routine|time_blocks|week_schedule|visual_organizer/.test(type)) return /(项目|节律|routine|时间块|周计划|图|组织图|visual organizer|流程图|概念图)/i.test(promptQuestion);
      if (/expense/.test(type)) return terseExpenseCaptureIntent || /(记账|支出|花了|消费|开销|报销|补记|补进去|记进去|入账|这笔记上|就这么记账)/i.test(promptQuestion);
      if (/flash|fixed/.test(type)) return /(闪念|定念|记下来|记下|记录|加一条|存一下|搬到|移到|挪到|去重|清重|重复)/i.test(promptQuestion);
      return explicitWriteIntent;
    }

    function getMorphActionCommitDecision(actionType = '', action = {}, context = {}) {
      const permissionRuntime = getPermissionContextRuntimeModules();
      if (permissionRuntime && typeof permissionRuntime.getMorphActionCommitDecision === 'function') {
        return permissionRuntime.getMorphActionCommitDecision(actionType, action, context);
      }
      const type = String(actionType || '').trim();
      const policy = getMorphActionExecutionPolicy(type, context.runtimeOverride || null);
      if (!type) {
        return {
          allowed: false,
          policy,
          reasonCode: 'missing_action_type',
          hasSpecificIntent: false,
          canCommitFromFollowupConfirmation: false,
        };
      }
      if (policy.consentTier === 'disabled') {
        return {
          allowed: false,
          policy,
          reasonCode: 'disabled',
          hasSpecificIntent: false,
          canCommitFromFollowupConfirmation: false,
        };
      }
      if (policy.permissionLevel === 'read') {
        return {
          allowed: true,
          policy,
          reasonCode: '',
          hasSpecificIntent: true,
          canCommitFromFollowupConfirmation: false,
        };
      }
      const hasSpecificIntent = matchesMorphActionIntent(type, context);
      const canCommitFromFollowupConfirmation = context.followupExecutionConfirmation === true
        && (typeof api.actionCarriesConcreteExecutionPayload === 'function'
          ? api.actionCarriesConcreteExecutionPayload(type, action)
          : true);
      const architectRequiredCommit = context.dominantMode === 'oracle'
        ? (context.actionBias === 'hold-space'
          ? ((context.explicitWriteIntent === true && hasSpecificIntent && (context.strongDataOperationIntent === true || context.hasPendingDataIntent === true)) || canCommitFromFollowupConfirmation)
          : ((context.explicitWriteIntent === true && hasSpecificIntent) || (hasSpecificIntent && (context.strongDataOperationIntent === true || context.hasPendingDataIntent === true)) || canCommitFromFollowupConfirmation))
        : ((context.explicitWriteIntent === true && hasSpecificIntent) || (hasSpecificIntent && (context.strongDataOperationIntent === true || context.hasPendingDataIntent === true)) || canCommitFromFollowupConfirmation);
      const canCommitByThreshold = policy.consentTier === 'explicit-consent-required'
        ? (hasSpecificIntent || canCommitFromFollowupConfirmation)
        : policy.consentTier === 'architect-required'
          ? architectRequiredCommit
          : context.dominantMode === 'balanced'
            ? (context.explicitWriteIntent === true || context.strongDataOperationIntent === true || context.hasPendingDataIntent === true || canCommitFromFollowupConfirmation)
            : (context.explicitWriteIntent === true || context.strongDataOperationIntent === true || context.hasPendingDataIntent === true || canCommitFromFollowupConfirmation || context.allowMorphDataActions === true);
      return {
        allowed: !!canCommitByThreshold,
        policy,
        reasonCode: canCommitByThreshold ? '' : 'intent-threshold-not-met',
        hasSpecificIntent,
        canCommitFromFollowupConfirmation,
      };
    }

    function buildMorphActionRequestId(actionType = '', action = {}, context = {}) {
      const existing = String(action?.requestId || action?.requestID || action?.request_id || '').trim();
      if (existing) return existing;
      const hint = String(context.promptQuestion || '').trim().slice(0, 18).replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '');
      const generatedId = typeof api.genId === 'function'
        ? String(api.genId() || '').slice(0, 8)
        : Date.now().toString(36).slice(-8);
      return `morph-${String(actionType || 'action').trim() || 'action'}-${hint || 'req'}-${generatedId}`;
    }

    function buildMorphActionBoundaryResult(actionType = '', policy = {}, options = {}) {
      const permissionRuntime = getPermissionContextRuntimeModules();
      if (permissionRuntime && typeof permissionRuntime.buildMorphActionBoundaryResult === 'function') {
        return permissionRuntime.buildMorphActionBoundaryResult(actionType, policy, options);
      }
      const next = {
        allowed: options.allowed !== false,
        domain: String(policy?.domain || '').trim(),
        permissionLevel: String(policy?.permissionLevel || '').trim(),
        consentTier: String(policy?.consentTier || '').trim(),
        riskLevel: String(policy?.riskLevel || '').trim(),
        reason: String(options.reason || '').trim(),
        action: String(actionType || '').trim(),
      };
      return typeof api.sanitizeMorphActionBoundaryResult === 'function'
        ? api.sanitizeMorphActionBoundaryResult(next)
        : next;
    }

    function buildMorphActionCandidate(actionType = '', action = {}, context = {}, policy = {}) {
      const safeAction = action && typeof action === 'object' ? action : {};
      return {
        action: String(actionType || '').trim(),
        actor: String(context.actor || 'ai').trim() || 'ai',
        source: String(safeAction.source || context.source || 'ai').trim() || 'ai',
        requestId: buildMorphActionRequestId(actionType, safeAction, context),
        target: String(safeAction.date || safeAction.dateStr || safeAction.target || '').trim(),
        entity: /daily_log/.test(String(actionType || '').trim()) ? 'daily_log_entry' : '',
        riskLevel: String(policy?.riskLevel || '').trim() || 'medium',
        confirmationLevel: String(policy?.consentTier || '').trim() || 'architect-required',
      };
    }

    function buildMorphActionReceiptFromVerification(type = '', action = {}, verification = {}, runtime = {}) {
      const result = runtime.actionResult && typeof runtime.actionResult === 'object' ? runtime.actionResult : {};
      const next = {
        ok: verification?.ok !== false,
        action: String(type || '').trim(),
        summary: String(runtime.summary || '').trim() || String(type || '').trim(),
        verifierStatus: verification?.ok === false ? 'failed' : 'verified',
        entity: String(verification?.entity || (/daily_log/.test(type) ? 'daily_log_entry' : '')).trim(),
        entityId: String(verification?.entityId || '').trim() || String(result.blockIds?.[0] || result.dateStr || '').trim(),
        status: String(verification?.status || result.status || '').trim(),
        oldStatus: String(verification?.oldStatus || result.oldStatus || '').trim(),
        newStatus: String(verification?.newStatus || result.newStatus || '').trim(),
        targetDate: String(verification?.targetDate || result.dateStr || action.date || action.dateStr || '').trim(),
        updatedAt: String(verification?.updatedAt || result.updatedAt || new Date().toISOString()).trim(),
        undoAvailable: !!String(runtime.transactionHandle || runtime.transactionId || '').trim() || runtime.transactionRecorded === true,
        transactionHandle: '',
        blockIds: Array.isArray(verification?.blockIds)
          ? verification.blockIds
          : (Array.isArray(result.blockIds) ? result.blockIds : []),
      };
      return typeof api.sanitizeMorphActionReceipt === 'function'
        ? api.sanitizeMorphActionReceipt(next)
        : next;
    }

    function sanitizeSyncEntityRefs(refs = []) {
      return typeof api.sanitizeMorphSyncEntityRefs === 'function'
        ? api.sanitizeMorphSyncEntityRefs(refs)
        : (Array.isArray(refs) ? refs : []);
    }

    function buildMorphSyncEntityRefsFromReceipts(receipts = []) {
      const refs = [];
      (Array.isArray(receipts) ? receipts : []).forEach((receipt) => {
        if (!receipt || typeof receipt !== 'object') return;
        const entityType = String(receipt.entity || '').trim();
        const entityId = String(receipt.entityId || receipt.targetDate || '').trim();
        const domain = typeof api.getMorphSyncDomainForEntity === 'function'
          ? api.getMorphSyncDomainForEntity(entityType)
          : '';
        if (!domain || !entityType || !entityId) return;
        refs.push({
          domain,
          entityType,
          entityId,
          action: String(receipt.action || '').trim(),
          label: String(receipt.summary || '').trim(),
        });
      });
      return sanitizeSyncEntityRefs(refs);
    }

    function buildMorphSyncEntityRefsFromCreatedItems(createdItems = [], fallbackActionType = '', fallbackDetail = {}) {
      const refs = [];
      (Array.isArray(createdItems) ? createdItems : []).forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const tab = String(item.tab || '').trim();
        const domain = typeof api.getMorphSyncDomainForEntity === 'function'
          ? api.getMorphSyncDomainForEntity('', tab)
          : '';
        if (!domain) return;
        const entityType = (
          tab === 'flashThoughts' ? 'flash_thought' :
          tab === 'fixed' ? 'fixed_thought' :
          tab === 'project' ? 'project' :
          tab === 'routine' ? 'routine' :
          tab === 'reminders' ? 'reminder' :
          tab === 'daily' ? 'daily_log_entry' :
          tab === 'expenseLedger' ? 'expense_record' :
          tab === 'sops' ? 'sop' : ''
        );
        const entityId = String(item.id || item.date || '').trim();
        if (!entityType || !entityId) return;
        refs.push({
          domain,
          entityType,
          entityId,
          action: String(item.removed ? 'delete' : fallbackActionType || '').trim(),
          label: String(item.text || item.name || '').trim().slice(0, 120),
        });
      });
      if (refs.length) return sanitizeSyncEntityRefs(refs);
      const type = String(fallbackActionType || '').trim();
      const detail = fallbackDetail && typeof fallbackDetail === 'object' ? fallbackDetail : {};
      if (/project/.test(type)) {
        const entityId = String(detail.projectId || detail.id || '').trim();
        if (entityId) refs.push({ domain: 'projects', entityType: 'project', entityId, action: type, label: String(detail.projectName || detail.name || '').trim() });
      } else if (/reminder/.test(type)) {
        const entityId = String(detail.reminderId || detail.id || '').trim();
        if (entityId) refs.push({ domain: 'reminders', entityType: 'reminder', entityId, action: type, label: String(detail.text || '').trim() });
      } else if (/expense/.test(type)) {
        const entityId = String(detail.recordId || detail.id || '').trim();
        if (entityId) refs.push({ domain: 'expenseLedger', entityType: 'expense_record', entityId, action: type, label: String(detail.text || detail.summary || '').trim() });
      } else if (/daily_log/.test(type)) {
        const entityId = String(detail.targetDate || detail.date || detail.dateStr || '').trim();
        if (entityId) refs.push({ domain: 'dailyMonths', entityType: 'daily_log_entry', entityId, action: type, label: String(detail.text || detail.summary || '').trim() });
      }
      return sanitizeSyncEntityRefs(refs);
    }

    function mergeMorphSyncEntityRefs(...groups) {
      return sanitizeSyncEntityRefs(groups.flatMap((group) => (Array.isArray(group) ? group : [])));
    }

    function getRuntimeData() {
      return typeof api.getData === 'function' ? api.getData() : null;
    }

    function buildThoughtVerifierResult(type = '', action = {}, runtime = {}) {
      const data = getRuntimeData();
      const entity = type === 'add_flash_thought' ? 'flash_thought' : 'fixed_thought';
      const createdItemsDelta = Array.isArray(runtime.createdItemsDelta) ? runtime.createdItemsDelta : [];
      const targetTab = type === 'add_flash_thought' ? 'flashThoughts' : 'fixed';
      const targetList = type === 'add_flash_thought'
        ? (Array.isArray(data?.flashThoughts) ? data.flashThoughts : [])
        : (Array.isArray(data?.fixed) ? data.fixed : []);
      const item = createdItemsDelta.find((entry) => String(entry?.tab || '') === targetTab && !entry?.removed);
      const expectedText = String(action.text || '').trim();
      const matched = item?.id
        ? targetList.find((entry) => String(entry?.id || '') === String(item.id || '') && String(entry?.text || '').trim() === expectedText)
        : null;
      if (!matched) {
        return {
          ok: false,
          action: type,
          entity,
          userMessage: type === 'add_flash_thought'
            ? '这次新增闪念没有真正落进闪念列表，我先不把它算作成功执行。'
            : '这次新增定念没有真正落进定念列表，我先不把它算作成功执行。',
        };
      }
      return {
        ok: true,
        action: type,
        entity,
        entityId: String(matched.id || '').trim(),
        updatedAt: new Date().toISOString(),
      };
    }

    function buildReminderVerifierResult(type = '', action = {}, runtime = {}) {
      const createdItemsDelta = Array.isArray(runtime.createdItemsDelta) ? runtime.createdItemsDelta : [];
      const item = createdItemsDelta.find((entry) => String(entry?.tab || '') === 'reminders');
      const reminders = typeof api.getReminderList === 'function' ? api.getReminderList() : [];
      const matched = item?.id && Array.isArray(reminders)
        ? reminders.find((entry) => (
          String(entry?.id || '') === String(item.id || '')
          && String(entry?.text || '').trim() === String(action.text || '').trim()
          && Number(entry?.dueAtMs || 0) === Number(action.dueAtMs || 0)
        ))
        : null;
      if (!matched) {
        return {
          ok: false,
          action: type,
          entity: 'reminder',
          userMessage: '这次新增提醒没有真正出现在提醒列表里，或者时间没有对上，我先不把它算作成功执行。',
        };
      }
      return {
        ok: true,
        action: type,
        entity: 'reminder',
        entityId: String(matched.id || '').trim(),
        targetDate: String(matched.dueAtText || '').trim().slice(0, 10),
        updatedAt: String(matched.updatedAt || matched.createdAt || new Date().toISOString()).trim(),
      };
    }

    function buildAppendDailyLogVerifierResult(type = '', action = {}, runtime = {}) {
      const data = getRuntimeData();
      const result = runtime.actionResult && typeof runtime.actionResult === 'object' ? runtime.actionResult : {};
      const dateStr = String(result.dateStr || action.date || action.dateStr || '').trim();
      const monthKey = String(result.monthKey || (dateStr ? dateStr.slice(0, 7) : '')).trim();
      const blockIds = Array.isArray(result.blockIds) ? result.blockIds.map((item) => String(item || '').trim()).filter(Boolean) : [];
      if (!dateStr || !monthKey) {
        return { ok: false, action: type, entity: 'daily_log_entry', userMessage: '日志追加后没有拿到明确的目标日期，我先不把它算作成功执行。' };
      }
      if ((!data?.dailyMonths || typeof data.dailyMonths !== 'object') && Number(result.count || 0) > 0) {
        return {
          ok: true,
          action: type,
          entity: 'daily_log_entry',
          entityId: blockIds[0] || dateStr,
          targetDate: dateStr,
          updatedAt: String(result.updatedAt || '').trim() || new Date().toISOString(),
          blockIds,
        };
      }
      const blocks = monthKey && data?.dailyMonths && Array.isArray(data.dailyMonths[monthKey]) ? data.dailyMonths[monthKey] : [];
      if (!Array.isArray(blocks) || !blocks.length) {
        return { ok: false, action: type, entity: 'daily_log_entry', targetDate: dateStr, userMessage: '目标日期所在的日志分区没有真正写入内容。' };
      }
      const headerIndex = blocks.findIndex((block) => block?.type === 'h3' && (typeof api.extractDailyDateFromHeaderContent === 'function'
        ? api.extractDailyDateFromHeaderContent(block?.content || '')
        : '') === dateStr);
      if (headerIndex < 0) {
        return { ok: false, action: type, entity: 'daily_log_entry', targetDate: dateStr, userMessage: '目标日期的日志标题没有准备好，我先不把这次写入算作成功。' };
      }
      const insertedBlocks = blockIds.length
        ? blockIds.map((id) => blocks.find((block) => String(block?.id || '') === id)).filter(Boolean)
        : [];
      if (blockIds.length && insertedBlocks.length !== blockIds.length) {
        return { ok: false, action: type, entity: 'daily_log_entry', targetDate: dateStr, userMessage: '这次日志追加有一部分块没有真正写进目标日期下。' };
      }
      if (!insertedBlocks.length) {
        return { ok: false, action: type, entity: 'daily_log_entry', targetDate: dateStr, userMessage: '这次日志追加没有找到对应的新块，我先不把它算作成功执行。' };
      }
      const firstInsertedIndex = blocks.findIndex((block) => String(block?.id || '') === blockIds[0]);
      if (!(firstInsertedIndex > headerIndex)) {
        return { ok: false, action: type, entity: 'daily_log_entry', targetDate: dateStr, userMessage: '这次日志追加的位置不对，没有落在目标日期标题下面。' };
      }
      const actualContents = insertedBlocks.map((block) => String(block?.content || '').trim());
      const expectedContents = Array.isArray(result.blockContents) ? result.blockContents.map((item) => String(item || '').trim()) : [];
      if (expectedContents.length && expectedContents.join('\n') !== actualContents.join('\n')) {
        return { ok: false, action: type, entity: 'daily_log_entry', targetDate: dateStr, userMessage: '这次日志追加的实际内容和标准化后的内容不一致，我先没有把它算作成功写入。' };
      }
      return {
        ok: true,
        action: type,
        entity: 'daily_log_entry',
        entityId: blockIds[0] || dateStr,
        targetDate: dateStr,
        updatedAt: String(result.updatedAt || '').trim() || new Date().toISOString(),
        blockIds,
      };
    }

    function buildCreateProjectVerifierResult(type = '', action = {}, runtime = {}) {
      const data = getRuntimeData();
      const result = runtime.actionResult && typeof runtime.actionResult === 'object' ? runtime.actionResult : {};
      const expectedName = String(action.name || '').trim();
      const expectedStatus = (typeof api.normalizeProjectStatus === 'function' ? api.normalizeProjectStatus(action.status || '') : '') || 'active';
      const projectId = String(result.entityId || result.projectId || '').trim();
      const project = projectId && Array.isArray(data?.projects)
        ? data.projects.find((entry) => String(entry?.id || '') === projectId)
        : null;
      if (!project) {
        return {
          ok: false,
          action: type,
          entity: 'project',
          userMessage: '这次新建项目没有真正出现在项目列表里，我先不把它算作成功执行。',
        };
      }
      const actualStatus = typeof api.getProjectStoredStatus === 'function' ? api.getProjectStoredStatus(project) : '';
      if (String(project.name || '').trim() !== expectedName) {
        return {
          ok: false,
          action: type,
          entity: 'project',
          entityId: String(project.id || '').trim(),
          status: actualStatus,
          userMessage: '这次新建项目的标题没有真正落成目标名称，我先不把它算作成功执行。',
        };
      }
      if (actualStatus !== expectedStatus) {
        return {
          ok: false,
          action: type,
          entity: 'project',
          entityId: String(project.id || '').trim(),
          status: actualStatus,
          userMessage: '这次新建项目的初始状态没有真正落成标准化后的状态。',
        };
      }
      return {
        ok: true,
        action: type,
        entity: 'project',
        entityId: String(project.id || '').trim(),
        status: actualStatus,
        updatedAt: String(project.updatedAt || project.createdAt || new Date().toISOString()).trim(),
      };
    }

    function buildProjectStatusVerifierResult(type = '', action = {}, runtime = {}) {
      const result = runtime.actionResult && typeof runtime.actionResult === 'object' ? runtime.actionResult : {};
      const projectId = String(result.entityId || result.projectId || action.projectId || '').trim();
      const project = typeof api.resolveProjectByRef === 'function'
        ? api.resolveProjectByRef({ projectId, projectName: action.projectName || action.name || '' })
        : null;
      if (!project) {
        return {
          ok: false,
          action: type,
          entity: 'project',
          userMessage: '这次项目状态更新没有真正命中目标项目，我先不把它算作成功执行。',
        };
      }
      const actualStatus = typeof api.getProjectStoredStatus === 'function' ? api.getProjectStoredStatus(project) : '';
      const expectedStatus = typeof api.normalizeProjectStatus === 'function' ? api.normalizeProjectStatus(action.status || '') : '';
      if (!expectedStatus || actualStatus !== expectedStatus) {
        return {
          ok: false,
          action: type,
          entity: 'project',
          entityId: String(project.id || '').trim(),
          status: actualStatus,
          oldStatus: String(action.oldStatus || result.oldStatus || '').trim(),
          newStatus: expectedStatus,
          userMessage: '这次项目状态没有真正更新成目标状态，我先不把它算作成功执行。',
        };
      }
      return {
        ok: true,
        action: type,
        entity: 'project',
        entityId: String(project.id || '').trim(),
        status: actualStatus,
        oldStatus: String(result.oldStatus || action.oldStatus || '').trim(),
        newStatus: actualStatus,
        updatedAt: String(project.updatedAt || new Date().toISOString()).trim(),
      };
    }

    function verifyStructuredActionOutcome(type = '', action = {}, runtime = {}) {
      const data = getRuntimeData();
      const actionType = String(type || '').trim();
      const createdItemsDelta = Array.isArray(runtime.createdItemsDelta) ? runtime.createdItemsDelta : [];
      switch (actionType) {
        case 'append_daily_log':
        case 'append_daily_log_under_date':
        case 'summarize_today_to_daily_log':
          return buildAppendDailyLogVerifierResult(actionType, action, runtime);
        case 'add_flash_thought':
        case 'add_fixed_thought':
          return buildThoughtVerifierResult(actionType, action, runtime);
        case 'create_project':
          return buildCreateProjectVerifierResult(actionType, action, runtime);
        case 'update_project_status':
          return buildProjectStatusVerifierResult(actionType, action, runtime);
        case 'rename_project': {
          const projects = Array.isArray(data?.projects) ? data.projects : [];
          const targetId = String(action.projectId || action.id || '').trim();
          const nextName = String(action.newName || '').trim();
          const exists = projects.some((project) => {
            if (targetId && String(project?.id || '') !== targetId) return false;
            return nextName ? String(project?.name || '').trim() === nextName : true;
          });
          return exists ? { ok: true } : { ok: false, userMessage: '这次项目改名没有真正落到目标项目上。' };
        }
        case 'delete_project': {
          const projects = Array.isArray(data?.projects) ? data.projects : [];
          const targetId = String(action.projectId || action.id || '').trim();
          const targetName = String(action.projectName || action.name || '').trim();
          const stillExists = projects.some((project) => (
            (targetId && String(project?.id || '') === targetId)
            || (targetName && String(project?.name || '').trim() === targetName)
          ));
          return !stillExists ? { ok: true } : { ok: false, userMessage: '这次项目没有真正从项目列表里删除。' };
        }
        case 'delete_fixed_thought': {
          const item = createdItemsDelta.find((entry) => String(entry?.tab || '') === 'fixed' && entry?.removed === true);
          const stillExists = Array.isArray(data?.fixed)
            ? data.fixed.some((entry) => item?.id
              ? String(entry?.id || '') === String(item.id || '')
              : String(entry?.text || '').trim() === String(action.text || '').trim())
            : false;
          return !stillExists && item
            ? { ok: true }
            : { ok: false, userMessage: '这次删除定念没有真正从定念列表消失，我先不把它算作成功执行。' };
        }
        case 'create_routine': {
          const item = createdItemsDelta.find((entry) => String(entry?.tab || '') === 'routine');
          const exists = item?.id && Array.isArray(data?.routines)
            ? data.routines.some((entry) => String(entry?.id || '') === String(item.id || '') && String(entry?.name || '').trim() === String(action.name || '').trim())
            : false;
          return exists ? { ok: true } : { ok: false, userMessage: '这次新建节律没有真正出现在节律列表里，我先不把它算作成功执行。' };
        }
        case 'add_reminder':
          return buildReminderVerifierResult(actionType, action, runtime);
        case 'add_project_reference': {
          const project = typeof api.resolveProjectByRef === 'function' ? api.resolveProjectByRef(action) : null;
          const exists = Array.isArray(project?.items)
            ? project.items.some((entry) => String(entry?.text || '').trim() === String(action.text || '').trim())
            : false;
          return exists ? { ok: true } : { ok: false, userMessage: '这次项目参考没有真正出现在目标项目的参考区里。' };
        }
        case 'append_project_block': {
          const project = typeof api.resolveProjectByRef === 'function' ? api.resolveProjectByRef(action) : null;
          const blocks = Array.isArray(project?.blocks) ? project.blocks : [];
          const exists = blocks.some((entry) => String(entry?.content || '').trim() === String(action.content || '').trim());
          return exists ? { ok: true } : { ok: false, userMessage: '这次项目块没有真正写进目标项目正文里。' };
        }
        case 'update_project_reference': {
          const project = typeof api.resolveProjectByRef === 'function' ? api.resolveProjectByRef(action) : null;
          const expected = String(action.newText || action.text || '').trim();
          const exists = Array.isArray(project?.items)
            ? project.items.some((entry) => String(entry?.text || '').trim() === expected)
            : false;
          return exists ? { ok: true } : { ok: false, userMessage: '这次项目参考没有真正更新到目标内容。' };
        }
        case 'delete_project_reference': {
          const project = typeof api.resolveProjectByRef === 'function' ? api.resolveProjectByRef(action) : null;
          const targetText = String(action.text || '').trim();
          const stillExists = Array.isArray(project?.items)
            ? project.items.some((entry) => targetText && String(entry?.text || '').trim() === targetText)
            : false;
          return !stillExists ? { ok: true } : { ok: false, userMessage: '这次项目参考没有真正从参考区里移除。' };
        }
        case 'update_project_block': {
          const project = typeof api.resolveProjectByRef === 'function' ? api.resolveProjectByRef(action) : null;
          const expected = String(action.newContent || action.content || '').trim();
          const exists = Array.isArray(project?.blocks)
            ? project.blocks.some((entry) => String(entry?.content || '').trim() === expected)
            : false;
          return exists ? { ok: true } : { ok: false, userMessage: '这次项目块没有真正更新到目标内容。' };
        }
        case 'delete_project_block': {
          const project = typeof api.resolveProjectByRef === 'function' ? api.resolveProjectByRef(action) : null;
          const targetBlockId = String(action.blockId || action.id || '').trim();
          const stillExists = Array.isArray(project?.blocks)
            ? project.blocks.some((entry) => targetBlockId && String(entry?.id || '') === targetBlockId)
            : false;
          return !stillExists ? { ok: true } : { ok: false, userMessage: '这次项目块没有真正从目标项目里删除。' };
        }
        case 'update_reminder': {
          const reminders = typeof api.getReminderList === 'function' ? api.getReminderList() : [];
          const expectedText = String(action.newText || action.text || '').trim();
          const expectedDatetime = String(action.newDatetime || action.datetime || '').trim();
          const exists = Array.isArray(reminders)
            ? reminders.some((entry) => {
              const textOk = expectedText ? String(entry?.text || '').trim() === expectedText : true;
              const timeOk = expectedDatetime ? String(entry?.dueAtText || '').trim() === expectedDatetime : true;
              return textOk && timeOk;
            })
            : false;
          return exists ? { ok: true } : { ok: false, userMessage: '这次提醒没有真正更新到目标内容。' };
        }
        case 'delete_reminder': {
          const reminders = typeof api.getReminderList === 'function' ? api.getReminderList() : [];
          const stillExists = Array.isArray(reminders) && typeof api.findReminderIndexesByActionRef === 'function'
            ? api.findReminderIndexesByActionRef(action).length > 0
            : false;
          return !stillExists ? { ok: true } : { ok: false, userMessage: '这次提醒没有真正从提醒列表里删除。' };
        }
        case 'update_daily_log_entry': {
          const dateStr = String(action.date || '').trim();
          const monthKey = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr.slice(0, 7) : '';
          const expected = String(action.newText || action.textNew || action.toText || action.content || '').trim();
          const blocks = monthKey && data?.dailyMonths && Array.isArray(data.dailyMonths[monthKey]) ? data.dailyMonths[monthKey] : [];
          const exists = Array.isArray(blocks) && blocks.some((block) => String(block?.content || '').trim() === expected);
          return exists ? { ok: true } : { ok: false, userMessage: '这次日志更新没有真正落到目标日期的日志里。' };
        }
        case 'delete_daily_log_entry': {
          const dateStr = String(action.date || '').trim();
          const monthKey = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr.slice(0, 7) : '';
          const targetText = String(action.text || '').trim();
          const blocks = monthKey && data?.dailyMonths && Array.isArray(data.dailyMonths[monthKey]) ? data.dailyMonths[monthKey] : [];
          const stillExists = targetText && Array.isArray(blocks) && blocks.some((block) => String(block?.content || '').trim() === targetText);
          return !stillExists ? { ok: true } : { ok: false, userMessage: '这次日志条目没有真正从目标日期的日志里移除。' };
        }
        case 'move_flash_to_fixed': {
          const targetText = String(action.text || '').trim();
          const existsInFixed = Array.isArray(data?.fixed)
            ? data.fixed.some((entry) => targetText && String(entry?.text || '').trim() === targetText)
            : false;
          const stillInFlash = Array.isArray(data?.flashThoughts)
            ? data.flashThoughts.some((entry) => targetText && String(entry?.text || '').trim() === targetText)
            : false;
          return existsInFixed && !stillInFlash
            ? { ok: true }
            : { ok: false, userMessage: '这次闪念转定念没有真正完成迁移。' };
        }
        case 'move_flash_to_project_reference': {
          const project = typeof api.resolveProjectByRef === 'function' ? api.resolveProjectByRef(action) : null;
          const targetText = String(action.text || '').trim();
          const existsInProject = Array.isArray(project?.items)
            ? project.items.some((entry) => targetText && String(entry?.text || '').trim() === targetText)
            : false;
          const stillInFlash = Array.isArray(data?.flashThoughts)
            ? data.flashThoughts.some((entry) => targetText && String(entry?.text || '').trim() === targetText)
            : false;
          return existsInProject && !stillInFlash
            ? { ok: true }
            : { ok: false, userMessage: '这次闪念归入项目参考没有真正完成迁移。' };
        }
        case 'create_project_from_flash_group': {
          const expectedName = String(action.name || action.projectName || '').trim();
          const exists = Array.isArray(data?.projects)
            ? data.projects.some((project) => expectedName && String(project?.name || '').trim() === expectedName)
            : false;
          return exists ? { ok: true } : { ok: false, userMessage: '这次闪念群组建项目没有真正出现在项目列表里。' };
        }
        case 'write_soul_memory': {
          const aiMemory = typeof api.ensureAIMemoryShape === 'function'
            ? api.ensureAIMemoryShape(data).aiMemory
            : (data?.aiMemory || {});
          const sectionTitle = String(action.sectionTitle || '').trim();
          const content = String(action.content || action.text || '').trim();
          const rawTargetFile = String(action.targetFile || action.file || action.memoryFile || action.targetPath || '').trim().toLowerCase();
          const targetFile = /(^|\/)memory-system\.?md$/.test(rawTargetFile)
            ? 'memory-system.md'
            : /(^|\/)identity\.?md$/.test(rawTargetFile)
              ? 'identity.md'
              : /(^|\/)user\.?md$/.test(rawTargetFile)
                ? 'user.md'
                : /(^|\/)memory\.?md$/.test(rawTargetFile)
                  ? 'memory.md'
                  : 'soul.md';
          const notes = targetFile === 'identity.md'
            ? String(aiMemory?.identityNotes || '').trim()
            : targetFile === 'user.md'
              ? String(aiMemory?.user || '').trim()
              : targetFile === 'memory.md'
                ? String(aiMemory?.memoryIndex || '').trim()
                : targetFile === 'memory-system.md'
                  ? String(aiMemory?.systemNotes || '').trim()
                  : String(aiMemory?.soulUserNotes || aiMemory?.soul || '').trim();
          const ok = (!sectionTitle || notes.includes(sectionTitle)) && (!!content && notes.includes(content));
          return ok ? { ok: true } : { ok: false, userMessage: '这次记忆写入没有真正落到 soul 记忆里。' };
        }
        case 'memory_write_user': {
          const aiMemory = typeof api.ensureAIMemoryShape === 'function'
            ? api.ensureAIMemoryShape(data).aiMemory
            : (data?.aiMemory || {});
          const sectionTitle = String(action.sectionTitle || '').trim();
          const content = String(action.content || action.text || '').trim();
          const notes = String(aiMemory?.user || '').trim();
          const ok = (!sectionTitle || notes.includes(sectionTitle)) && (!!content && notes.includes(content));
          return ok ? { ok: true } : { ok: false, userMessage: '这次用户记忆没有真正写入用户记忆区。' };
        }
        case 'memory_rewrite_section': {
          const aiMemory = typeof api.ensureAIMemoryShape === 'function'
            ? api.ensureAIMemoryShape(data).aiMemory
            : (data?.aiMemory || {});
          const sectionTitle = String(action.sectionTitle || '').trim();
          const content = String(action.content || action.text || '').trim();
          const rawTargetFile = String(action.targetFile || action.file || action.memoryFile || action.targetPath || '').trim().toLowerCase();
          const targetFile = /(^|\/)memory-system\.?md$/.test(rawTargetFile)
            ? 'memory-system.md'
            : /(^|\/)identity\.?md$/.test(rawTargetFile)
              ? 'identity.md'
              : /(^|\/)user\.?md$/.test(rawTargetFile)
                ? 'user.md'
                : /(^|\/)memory\.?md$/.test(rawTargetFile)
                  ? 'memory.md'
                  : 'soul.md';
          const notes = targetFile === 'identity.md'
            ? String(aiMemory?.identityNotes || '').trim()
            : targetFile === 'user.md'
              ? String(aiMemory?.user || '').trim()
              : targetFile === 'memory.md'
                ? String(aiMemory?.memoryIndex || '').trim()
                : targetFile === 'memory-system.md'
                  ? String(aiMemory?.systemNotes || '').trim()
                  : String(aiMemory?.soulUserNotes || aiMemory?.soul || '').trim();
          const ok = (!sectionTitle || notes.includes(sectionTitle)) && (!!content && notes.includes(content));
          return ok ? { ok: true } : { ok: false, userMessage: '这次记忆章节重写没有真正落到目标章节。' };
        }
        case 'add_expense_record': {
          const item = createdItemsDelta.find((entry) => String(entry?.tab || '') === 'expenseLedger');
          const records = Array.isArray(data?.expenseLedger?.records) ? data.expenseLedger.records : [];
          const exists = item?.id
            ? records.some((entry) => String(entry?.id || '') === String(item.id || '') && Number(entry?.amount || 0) === Number(action.amount || 0))
            : false;
          return exists ? { ok: true } : { ok: false, userMessage: '这次记账没有真正出现在账本里。' };
        }
        case 'update_expense_record': {
          const records = Array.isArray(data?.expenseLedger?.records) ? data.expenseLedger.records : [];
          const targetId = String(action.recordId || action.id || '').trim();
          const expectedItem = String(action.item || action.text || action.title || '').trim();
          const rawExpectedCategory = String(action.category || '').trim();
          const expectedCategory = rawExpectedCategory && typeof api.normalizeExpenseLedgerCategory === 'function'
            ? String(api.normalizeExpenseLedgerCategory(rawExpectedCategory, expectedItem) || '').trim()
            : rawExpectedCategory;
          const expectedAmount = Number.isFinite(Number(action.amount)) ? Number(action.amount) : null;
          const exists = records.some((entry) => {
            if (targetId && String(entry?.id || '') !== targetId) return false;
            const itemOk = expectedItem ? String(entry?.item || '').trim() === expectedItem : true;
            const actualCategory = String(entry?.category || '').trim();
            const categoryOk = expectedCategory ? (actualCategory === expectedCategory || actualCategory === rawExpectedCategory) : true;
            const amountOk = expectedAmount !== null ? Number(entry?.amount || 0) === expectedAmount : true;
            return itemOk && categoryOk && amountOk;
          });
          return exists ? { ok: true } : { ok: false, userMessage: '这次记账更新没有真正落到账本记录里。' };
        }
        case 'delete_expense_record':
        case 'undo_last_expense_record': {
          const targetId = String((createdItemsDelta[0] && createdItemsDelta[0].id) || '').trim();
          const records = Array.isArray(data?.expenseLedger?.records) ? data.expenseLedger.records : [];
          const stillExists = targetId ? records.some((entry) => String(entry?.id || '') === targetId) : false;
          return !stillExists ? { ok: true } : { ok: false, userMessage: '这次记账删除没有真正从账本里移除。' };
        }
        default:
          return { ok: true };
      }
    }

    async function loadMorphRuntimeDefaults() {
      const next = api.cloneMorphRuntimeDefaultBundle();
      const loader = window.MorphConfigLoader;
      const bundle = loader && typeof loader.loadRuntimeBundleFromUrls === 'function'
        ? await loader.loadRuntimeBundleFromUrls({
            skillsUrl: 'morph-runtime/skills.json',
            contextRulesUrl: 'morph-runtime/context-rules.json',
            memoryRulesUrl: 'morph-runtime/memory-rules.md',
            actionRegistryUrl: 'morph-runtime/action-registry.json',
            actionPolicyUrl: 'morph-runtime/action-policy.json',
            actionContractUrl: 'morph-runtime/action-contract.json',
          })
        : null;
      const skillsJson = bundle && bundle.skills ? bundle.skills : null;
      const contextJson = bundle && bundle.contextRules ? bundle.contextRules : null;
      const memoryText = bundle && typeof bundle.memoryRules === 'string' ? bundle.memoryRules : '';
      const actionRegistry = bundle && bundle.actionRegistry && typeof bundle.actionRegistry === 'object' ? bundle.actionRegistry : null;
      const actionPolicy = bundle && bundle.actionPolicy && typeof bundle.actionPolicy === 'object' ? bundle.actionPolicy : null;
      const actionContract = bundle && bundle.actionContract && typeof bundle.actionContract === 'object' ? bundle.actionContract : null;
      if (skillsJson && typeof skillsJson === 'object') next.skills = { ...next.skills, ...skillsJson };
      if (contextJson && typeof contextJson === 'object') {
        next.contextRules = {
          ...next.contextRules,
          ...contextJson,
          tokenSynonyms: {
            ...next.contextRules.tokenSynonyms,
            ...api.sanitizeMorphTokenSynonyms(contextJson.tokenSynonyms),
          },
        };
      }
      if (typeof memoryText === 'string' && memoryText.trim()) next.memoryRules = memoryText.trim();
      if (actionRegistry && typeof actionRegistry === 'object') next.actionRegistry = actionRegistry;
      if (actionPolicy && typeof actionPolicy === 'object') next.actionPolicy = actionPolicy;
      if (actionContract && typeof actionContract === 'object') next.actionContract = actionContract;
      api.setMorphRuntimeDefaults(next);
      api.setMorphRuntimeLoaded(true);
      return next;
    }

    function buildMorphSelfInspectionSnapshot() {
      const runtime = api.getMorphRuntimeBundle();
      const defaults = api.getMorphRuntimeDefaults();
      const actionPolicySummary = buildMorphActionPolicySummary(runtime);
      return {
        runtimeLoaded: api.isMorphRuntimeLoaded(),
        selfUpgradeEnabled: runtime.skills.selfUpgradeEnabled !== false,
        writableScopes: runtime.skills.writableScopes || defaults?.skills?.writableScopes || ['skills', 'contextRules', 'memoryRules'],
        capabilities: runtime.skills.capabilities || defaults?.skills?.capabilities || [],
        disabledActions: runtime.skills.disabledActions || [],
        actionPolicySummary,
        contextRules: {
          maxCoreMemory: runtime.contextRules.maxCoreMemory,
          maxWorkingContext: runtime.contextRules.maxWorkingContext,
          maxRetrieved: runtime.contextRules.maxRetrieved,
          maxCitations: runtime.contextRules.maxCitations,
          currentTabBoost: runtime.contextRules.currentTabBoost,
          activeContextBoost: runtime.contextRules.activeContextBoost,
          selectedMonthBoost: runtime.contextRules.selectedMonthBoost,
          clusterExpansionLimit: runtime.contextRules.clusterExpansionLimit,
          customTokenSynonyms: Object.keys(runtime.contextRules.tokenSynonyms || {}).length,
        },
        proactiveAgent: runtime.skills.proactiveAgent || api.sanitizeMorphProactiveAgentConfig(null),
        memoryRulesPreview: String(runtime.memoryRules || '').split('\n').filter(Boolean).slice(0, 6),
      };
    }

    async function loadBundledSkillManifest() {
      const ecosystemRuntime = getEcosystemRegistryRuntimeModules();
      if (ecosystemRuntime && typeof ecosystemRuntime.loadBundledSkillManifest === 'function') {
        return ecosystemRuntime.loadBundledSkillManifest();
      }
      const cached = api.getBundledSkillManifestCache();
      if (cached) return cached;
      const loader = window.MorphConfigLoader;
      if (!loader || typeof loader.loadSkillCatalogFromUrl !== 'function') return null;
      try {
        const manifest = await loader.loadSkillCatalogFromUrl('/skills/manifest.json');
        if (!manifest) return null;
        api.setBundledSkillManifestCache(manifest);
        return manifest;
      } catch (_) {
        return null;
      }
    }

    function isExternalAssistantConflictQuery(question) {
      const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!q) return false;
      const metaIntentPatterns = [
        /(为什么|为何|怎么|如何|帮我|请你|分析|解释|厘清|区分|修复|排查|处理).*(冲突|混乱|矛盾|误判|路由|提示词|system prompt|系统提示|身份)/i,
        /(冲突|混乱|矛盾|误判|路由|提示词|system prompt|系统提示|身份).*(为什么|为何|怎么|如何|帮我|请你|分析|解释|厘清|区分|修复|排查|处理)/i,
        /(这段|这份|这个).*(提示词|system prompt|系统提示|路由|身份).*(怎么|如何|为什么|有问题|冲突|混乱)/i,
      ];
      if (!metaIntentPatterns.some((pattern) => pattern.test(q))) return false;
      const roleConflictPatterns = [
        /我是\s*(perplexity|claude|chatgpt|gemini)/i,
        /我不是\s*morph/i,
        /不是\s*morph/i,
        /不是morph/i,
        /搜索助手/,
        /不是\s*morph.*(为什么|冲突|矛盾|误判|路由)/i,
        /(为什么|冲突|矛盾|误判|路由).*(perplexity|搜索助手|不是\s*morph)/i,
      ];
      return roleConflictPatterns.some((pattern) => pattern.test(q));
    }

    function selectBundledSkillsForQuery(question, manifest) {
      const q = String(question || '').toLowerCase();
      const list = Array.isArray(manifest?.skills) ? manifest.skills : [];
      if (!q || !list.length) return [];
      if (isExternalAssistantConflictQuery(q)) return [];
      const genericSkillIds = new Set(['morph-data-operations']);
      const matched = list
        .map((skill) => {
          const score = (skill.triggers || []).reduce((acc, token) => acc + (q.includes(String(token || '').toLowerCase()) ? 1 : 0), 0);
          const blocked = (skill.negativeTriggers || []).some((token) => q.includes(String(token || '').toLowerCase()));
          return { skill, score, blocked };
        })
        .filter((row) => row.score > 0 && !row.blocked)
        .sort((a, b) => b.score - a.score);
      if (!matched.length) return [];
      const genericRows = matched.filter((row) => genericSkillIds.has(String(row.skill?.id || row.skill?.name || '').trim()));
      const specificRows = matched.filter((row) => !genericSkillIds.has(String(row.skill?.id || row.skill?.name || '').trim()));
      if (!specificRows.length) return matched.slice(0, 2).map((row) => row.skill);
      const specificSkillCount = new Set(specificRows.map((row) => String(row.skill?.id || row.skill?.name || '').trim()).filter(Boolean)).size;
      if (specificSkillCount >= 2 && genericRows.length) {
        return [genericRows[0], ...specificRows]
          .slice(0, 2)
          .map((row) => row.skill);
      }
      return specificRows
        .slice(0, 2)
        .map((row) => row.skill);
    }

    function shouldTreatAsMorphDataOperation(question) {
      const q = String(question || '').toLowerCase().trim();
      if (!q || isExternalAssistantConflictQuery(q)) return false;
      if (/(?:在|到|往).{0,4}(?:morph|应用内|app里).{0,12}(?:写|记|记录|新增|添加|删除|修改|更新|同步|放进|加入)/i.test(q)) return true;
      if (/(?:创建|新建|生成|做一个|做个|开发|实现|搭一个|安装).{0,18}(?:插件|plugin)/i.test(q)) return true;
      if (/(?:插件|plugin).{0,18}(?:创建|新建|生成|做一个|做个|开发|实现|安装)/i.test(q)) return true;

      if (/提醒我/.test(q)) return true;
      if (/(?:新建|创建|新增|添加).{0,4}(?:一个|个)?(?:提醒|闹钟)/i.test(q)) return true;
      if (/帮我设置.{0,12}提醒/.test(q) || /设置(?:一个|个)提醒/.test(q) || /设(?:一个|个)提醒/.test(q)) return true;
      if (/\d{1,2}[点:：时]\d{0,2}分?\s*(?:的时候|时)?提醒/.test(q)) return true;
      if (/(?:明天|后天|下周|周[一二三四五六日天]).{0,10}提醒/.test(q)) return true;
      if (/(?:所有|全部).{0,6}(?:提醒|闹钟).{0,8}(?:删除|删掉|移除|去掉|清掉|清空|取消)/i.test(q)) return true;
      if (/(?:提醒|闹钟).{0,16}(?:删除|删掉|移除|去掉|清掉|取消|改到|改成|修改|更新|推迟|提前|重命名|改名|完成|标记)/i.test(q)) return true;
      if (/(?:删除|删掉|移除|去掉|清掉|取消|改到|改成|修改|更新|推迟|提前|重命名|改名|完成|标记).{0,16}(?:提醒|闹钟)/i.test(q)) return true;

      if (/(?:新建|创建|新增|添加|加一个|建一个).{0,12}(?:项目|project|节律|routine|闪念|定念|时间块|周计划|周时间块)/i.test(q)) return true;
      if (/(?:项目|project|节律|routine|闪念|定念|时间块|周计划|周时间块).{0,16}(?:归档|恢复|删除|删掉|移除|去掉|修改|更新|重命名|改名|改到|改成|完成|标记)/i.test(q)) return true;
      if (/(?:归档|恢复|删除|删掉|移除|去掉|修改|更新|重命名|改名|改到|改成|完成|标记).{0,16}(?:项目|project|节律|routine|闪念|定念|时间块|周计划|周时间块)/i.test(q)) return true;

      if (/^(?:请(?:你|我)?帮?我?)?(?:请记住|记住|记下)(?!不住\b)/.test(q)) return true;
      if (/(?:从今天开始|从现在开始|以后|之后).{0,8}叫我/.test(q)) return true;
      if (/(?:我的名字是|我叫).{1,20}/.test(q)) return true;
      if (/(?:写入|写进|放进|放入|存进|存入|记进|记入|追加到|更新|修改|改写|重写).{0,18}(?:soul|user|identity|memory(?:-system)?)\.?md/i.test(q)) return true;
      if (/(?:soul|user|identity|memory(?:-system)?)\.?md.{0,18}(?:写入|写进|放进|放入|存进|存入|记进|记入|追加|更新|修改|改写|重写)/i.test(q)) return true;
      if (/(?:撤销|回退|恢复).{0,12}(?:刚刚|刚才|上一次|上次|那次|最近|这次)?(?:.{0,8}(?:操作|修改|写入|动作))?/i.test(q)) return true;

      if (/(?:记录到|记到|记进|录到|录进|写入|写进|放进|加入).{0,20}(?:日志|日记)/.test(q)) return true;
      if (/(?:日志|日记).{0,16}(?:新增|添加|记录|写入|写进|修改|更新|删除|清空)/.test(q)) return true;
      if (/写到\s*\d{4}-\d{2}-\d{2}.{0,6}(?:日志|日记)/i.test(q)) return true;

      if (/(?:项目参考区|项目参考|参考区).*(?:添加|记录|保存|写入|放进|移动|挪到|去重|清重|合并)/i.test(q)) return true;
      if (/(?:添加|记录|保存|写入|放进|移动|挪到|去重|清重|合并).*(?:项目参考区|项目参考|参考区)/i.test(q)) return true;
      if (/(?:闪念|定念).*(?:参考区|项目参考|项目参考区|去重|清重|搬到项目|搬到参考|移到参考|挪到参考)/i.test(q)) return true;

      if (/记.{0,2}账/.test(q)) return true;
      if (/(?:吃完饭|吃了|喝了|喝咖啡|喝奶茶|打车|加油|理发|洗车|修车|寄快递).{0,12}\d+/i.test(q)) return true;
      return /(?:花了|花费|用了|付了|付款|消费|支出|买了|点了|交了|缴了|充值了|充话费).*(?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?/i.test(q)
        || /(?:¥|￥|rmb\s*)?\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|人民币)?.*(?:买了|点了|花了|付了|消费|支出|房租|房贷|车贷|物业|水电|快递|打车|充话费|记.{0,2}账)/i.test(q);
    }

    return {
      loadMorphRuntimeDefaults,
      buildMorphSelfInspectionSnapshot,
      getMorphActionExecutionPolicy,
      buildMorphActionPolicySummary,
      getPreferredMorphPromptActionTypes,
      matchesMorphActionIntent,
      getMorphActionCommitDecision,
      buildMorphActionRequestId,
      buildMorphActionBoundaryResult,
      buildMorphActionCandidate,
      buildMorphActionReceiptFromVerification,
      buildMorphSyncEntityRefsFromReceipts,
      buildMorphSyncEntityRefsFromCreatedItems,
      mergeMorphSyncEntityRefs,
      verifyStructuredActionOutcome,
      loadBundledSkillManifest,
      isExternalAssistantConflictQuery,
      selectBundledSkillsForQuery,
      shouldTreatAsMorphDataOperation,
    };
  }

  window.MorphRuntimeModules = {
    create: createRuntimeModules,
  };
})();
