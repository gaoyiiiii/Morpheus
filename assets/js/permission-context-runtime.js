(function () {
  function createPermissionContextRuntimeModules(deps) {
  const api = deps && typeof deps === 'object' ? deps : {};
    const HIDDEN_PROMPT_ACTION_TYPES = new Set([
      'self_update_runtime_rules',
      'trigger_proactive_scan',
    ]);

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
      'add_expense_record',
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

    function getActiveRuntimeBundle(runtimeOverride = null) {
      if (runtimeOverride && typeof runtimeOverride === 'object') return runtimeOverride;
      return typeof api.getMorphRuntimeBundle === 'function'
        ? (api.getMorphRuntimeBundle() || {})
        : {};
    }

    function sanitizeText(value = '', fallback = '') {
      const text = String(value || '').trim();
      return text || fallback;
    }

    function inferConsentTierFromBoundaryLevel(boundaryLevel = '') {
      const level = String(boundaryLevel || '').trim();
      if (level === 'disabled') return 'disabled';
      if (level === 'explicit-consent-required') return 'explicit-consent-required';
      return 'architect-required';
    }

    function synthesizeRegistryFromLegacyRuntime(runtimeOverride = null) {
      const runtime = getActiveRuntimeBundle(runtimeOverride);
      const actionPolicy = runtime?.actionPolicy && typeof runtime.actionPolicy === 'object'
        ? runtime.actionPolicy
        : null;
      const actionContract = runtime?.actionContract && typeof runtime.actionContract === 'object'
        ? runtime.actionContract
        : null;
      const policyActions = actionPolicy?.actions && typeof actionPolicy.actions === 'object'
        ? actionPolicy.actions
        : {};
      const actions = {};
      Object.entries(policyActions).forEach(([actionType, value]) => {
        const action = String(actionType || '').trim();
        const entry = value && typeof value === 'object' ? value : {};
        if (!action) return;
        actions[action] = {
          canonicalAction: action,
          policy: {
            domain: sanitizeText(entry.domain),
            permissionLevel: sanitizeText(entry.permissionLevel, 'update'),
            consentTier: sanitizeText(entry.consentTier, 'architect-required'),
            riskLevel: sanitizeText(entry.riskLevel, 'medium'),
            notes: sanitizeText(entry.notes),
          },
          boundary: {
            level: sanitizeText(entry.boundaryLevel, ''),
            reason: sanitizeText(entry.boundaryReason || entry.notes),
          },
          confirmationRequired: entry.confirmationRequired === true,
        };
      });
      return {
        aliases: actionContract?.aliases && typeof actionContract.aliases === 'object'
          ? { ...actionContract.aliases }
          : {},
        tiers: actionPolicy?.tiers && typeof actionPolicy.tiers === 'object'
          ? { ...actionPolicy.tiers }
          : {},
        defaultBoundaryLevel: 'disabled',
        boundaryLevels: {},
        actions,
      };
    }

    function getActionRegistry(runtimeOverride = null) {
      const runtime = getActiveRuntimeBundle(runtimeOverride);
      const registry = runtime?.actionRegistry && typeof runtime.actionRegistry === 'object'
        ? runtime.actionRegistry
        : null;
      if (registry && registry.actions && typeof registry.actions === 'object') {
        return registry;
      }
      return synthesizeRegistryFromLegacyRuntime(runtimeOverride);
    }

    function getActionAliases(runtimeOverride = null) {
      const registry = getActionRegistry(runtimeOverride);
      const aliases = registry.aliases && typeof registry.aliases === 'object'
        ? { ...registry.aliases }
        : {};
      Object.entries(registry.actions || {}).forEach(([actionType, value]) => {
        const action = String(actionType || '').trim();
        const entry = value && typeof value === 'object' ? value : {};
        const canonicalAction = sanitizeText(entry.canonicalAction || action);
        if (!action || !canonicalAction) return;
        if (action !== canonicalAction) aliases[action] = canonicalAction;
        (Array.isArray(entry.aliases) ? entry.aliases : []).forEach((alias) => {
          const safeAlias = sanitizeText(alias);
          if (!safeAlias) return;
          aliases[safeAlias] = canonicalAction;
        });
      });
      return aliases;
    }

    function getCanonicalMorphActionName(actionType = '', runtimeOverride = null) {
      const requestedAction = sanitizeText(actionType);
      if (!requestedAction) return '';
      const aliases = getActionAliases(runtimeOverride);
      return sanitizeText(aliases[requestedAction] || requestedAction);
    }

    function getActionRegistryEntry(actionType = '', runtimeOverride = null) {
      const requestedAction = sanitizeText(actionType);
      if (!requestedAction) return null;
      const registry = getActionRegistry(runtimeOverride);
      const direct = registry.actions?.[requestedAction];
      if (direct && typeof direct === 'object') return direct;
      const canonicalAction = getCanonicalMorphActionName(requestedAction, runtimeOverride);
      const canonical = registry.actions?.[canonicalAction];
      return canonical && typeof canonical === 'object' ? canonical : null;
    }

    function buildFallbackPermissionContext(actionType = '') {
      const type = sanitizeText(actionType);
      const buildContext = (overrides = {}) => ({
        action: type || 'unknown',
        requestedAction: type || 'unknown',
        canonicalAction: type || 'unknown',
        aliases: [],
        domain: 'general',
        permissionLevel: 'update',
        consentTier: 'architect-required',
        riskLevel: 'medium',
        notes: '',
        boundaryLevel: 'allowed',
        boundaryReason: '',
        boundarySummary: '',
        tierSummary: '',
        tierUserFacingRule: '',
        confirmationRequired: false,
        enabled: true,
        ...overrides,
      });
      if (!type) return buildContext({ action: 'unknown', enabled: false, boundaryLevel: 'disabled', notes: 'unknown action type' });
      if (DISABLED_BY_DEFAULT_ACTIONS.has(type)) {
        return buildContext({
          domain: 'system',
          permissionLevel: 'admin',
          consentTier: 'disabled',
          riskLevel: 'high',
          notes: 'disabled by default in phase 1',
          boundaryLevel: 'disabled',
          enabled: false,
        });
      }
      if (EXPLICIT_CONSENT_ACTIONS.has(type)) {
        return buildContext({
          domain: /runtime/.test(type) ? 'runtime' : 'memory',
          permissionLevel: 'admin',
          consentTier: 'explicit-consent-required',
          riskLevel: 'high',
          notes: 'requires explicit user authorization',
          boundaryLevel: 'explicit-consent-required',
          enabled: false,
        });
      }
      if (ORACLE_SAFE_ACTIONS.has(type)) {
        return buildContext({
          domain: /daily_log/.test(type)
            ? 'daily'
            : type === 'add_reminder'
              ? 'reminders'
              : /expense/.test(type)
                ? 'expenseLedger'
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
          boundaryLevel: 'allowed',
          enabled: true,
        });
      }
      if (type === 'undo_last_ai_transaction' || type === 'undo_last_external_sync' || type === 'undo_last_manual_transaction') {
        return buildContext({
          domain: 'system',
          permissionLevel: 'restore',
          consentTier: 'architect-required',
          riskLevel: 'high',
          notes: 'restores the latest transaction when the touched domains are unchanged',
          boundaryLevel: 'confirm-required',
          enabled: false,
        });
      }
      if (/expense/.test(type)) {
        return buildContext({
          domain: 'expenseLedger',
          permissionLevel: /delete|undo/.test(type) ? 'archive' : /update/.test(type) ? 'update' : 'append',
          consentTier: 'architect-required',
          riskLevel: /delete|undo/.test(type) ? 'high' : 'medium',
          notes: 'financial records should follow structured confirmation thresholds',
          boundaryLevel: /delete|undo|update/.test(type) ? 'confirm-required' : 'allowed',
          enabled: !/delete|undo|update/.test(type),
        });
      }
      if (/project/.test(type)) {
        const structuralUpdate = /rename|update|delete/.test(type);
        return buildContext({
          domain: 'projects',
          permissionLevel: /delete/.test(type) ? 'archive' : /rename|update/.test(type) ? 'update' : 'append',
          consentTier: 'architect-required',
          riskLevel: /delete/.test(type) ? 'high' : 'medium',
          notes: 'project structure changes should be architect-led',
          boundaryLevel: structuralUpdate ? 'confirm-required' : 'allowed',
          enabled: !structuralUpdate,
        });
      }
      if (/routine|week_schedule|time_blocks/.test(type)) {
        return buildContext({
          domain: 'routines',
          permissionLevel: 'update',
          consentTier: 'architect-required',
          riskLevel: 'medium',
          notes: 'schedule construction should be stabilized before commit',
          boundaryLevel: 'confirm-required',
          enabled: false,
        });
      }
      if (/daily_log/.test(type)) {
        const structuralUpdate = /delete|update/.test(type);
        return buildContext({
          domain: 'daily',
          permissionLevel: structuralUpdate ? 'update' : 'append',
          consentTier: structuralUpdate ? 'architect-required' : 'oracle-safe',
          riskLevel: /delete/.test(type) ? 'medium' : 'low',
          notes: structuralUpdate
            ? 'daily edits beyond append should require stronger structure signals'
            : 'appending to daily logs is safe with clear write intent',
          boundaryLevel: structuralUpdate ? 'confirm-required' : 'allowed',
          enabled: !structuralUpdate,
        });
      }
      if (/reminder/.test(type)) {
        const structuralUpdate = /delete|update|complete/.test(type);
        return buildContext({
          domain: 'reminders',
          permissionLevel: /delete/.test(type) ? 'archive' : /update|complete/.test(type) ? 'update' : 'append',
          consentTier: structuralUpdate ? 'architect-required' : 'oracle-safe',
          riskLevel: structuralUpdate ? 'medium' : 'low',
          notes: 'reminder mutations should preserve user timing intent',
          boundaryLevel: structuralUpdate ? 'confirm-required' : 'allowed',
          enabled: !structuralUpdate,
        });
      }
      if (/flash|fixed/.test(type)) {
        const structuralUpdate = /delete|move|dedupe|merge|group|ungroup/.test(type);
        return buildContext({
          domain: /fixed/.test(type) ? 'fixed' : 'flashThoughts',
          permissionLevel: /delete/.test(type) ? 'archive' : structuralUpdate ? 'update' : 'append',
          consentTier: structuralUpdate ? 'architect-required' : 'oracle-safe',
          riskLevel: /delete|merge|dedupe/.test(type) ? 'medium' : 'low',
          notes: structuralUpdate
            ? 'reorganization actions should confirm structural intent'
            : 'thought capture should remain reversible and clearly targeted',
          boundaryLevel: structuralUpdate ? 'confirm-required' : 'allowed',
          enabled: !structuralUpdate,
        });
      }
      return buildContext();
    }

    function getMorphActionPermissionContext(actionType = '', runtimeOverride = null) {
      const requestedAction = sanitizeText(actionType);
      if (!requestedAction) return buildFallbackPermissionContext('');
      const registry = getActionRegistry(runtimeOverride);
      const entry = getActionRegistryEntry(requestedAction, runtimeOverride);
      if (!entry) return buildFallbackPermissionContext(requestedAction);
      const canonicalAction = getCanonicalMorphActionName(requestedAction, runtimeOverride) || requestedAction;
      const policy = entry.policy && typeof entry.policy === 'object' ? entry.policy : {};
      const boundary = entry.boundary && typeof entry.boundary === 'object' ? entry.boundary : {};
      const boundaryLevel = sanitizeText(boundary.level, sanitizeText(registry.defaultBoundaryLevel, 'disabled'));
      const consentTier = sanitizeText(policy.consentTier, inferConsentTierFromBoundaryLevel(boundaryLevel));
      const tierCatalog = registry.tiers && typeof registry.tiers === 'object' ? registry.tiers : {};
      const boundaryCatalog = registry.boundaryLevels && typeof registry.boundaryLevels === 'object' ? registry.boundaryLevels : {};
      const tierSpec = tierCatalog[consentTier] && typeof tierCatalog[consentTier] === 'object'
        ? tierCatalog[consentTier]
        : {};
      const boundarySpec = boundaryCatalog[boundaryLevel] && typeof boundaryCatalog[boundaryLevel] === 'object'
        ? boundaryCatalog[boundaryLevel]
        : {};
      return {
        action: requestedAction,
        requestedAction,
        canonicalAction: canonicalAction || requestedAction,
        displayName: sanitizeText(entry.displayName),
        aliases: Object.keys(getActionAliases(runtimeOverride)).filter((alias) => getActionAliases(runtimeOverride)[alias] === canonicalAction),
        domain: sanitizeText(policy.domain, 'general'),
        permissionLevel: sanitizeText(policy.permissionLevel, 'update'),
        consentTier,
        riskLevel: sanitizeText(policy.riskLevel, 'medium'),
        notes: sanitizeText(policy.notes),
        boundaryLevel,
        boundaryReason: sanitizeText(boundary.reason),
        boundarySummary: sanitizeText(boundarySpec.summary),
        tierSummary: sanitizeText(tierSpec.summary),
        tierUserFacingRule: sanitizeText(tierSpec.userFacingRule),
        confirmationRequired: entry.confirmationRequired === true,
        enabled: boundaryLevel === 'allowed',
      };
    }

    function getMorphActionExecutionPolicy(actionType = '', runtimeOverride = null) {
      const context = getMorphActionPermissionContext(actionType, runtimeOverride);
      return {
        action: sanitizeText(context.action, sanitizeText(actionType, 'unknown')),
        requestedAction: sanitizeText(context.requestedAction, sanitizeText(actionType, 'unknown')),
        canonicalAction: sanitizeText(context.canonicalAction, sanitizeText(actionType, 'unknown')),
        aliases: Array.isArray(context.aliases) ? context.aliases.slice() : [],
        domain: sanitizeText(context.domain, 'general'),
        permissionLevel: sanitizeText(context.permissionLevel, 'update'),
        requiredPermission: sanitizeText(context.permissionLevel, 'update'),
        consentTier: sanitizeText(context.consentTier, 'architect-required'),
        riskLevel: sanitizeText(context.riskLevel, 'medium'),
        notes: sanitizeText(context.notes),
        tierSummary: sanitizeText(context.tierSummary),
        userFacingRule: sanitizeText(context.tierUserFacingRule),
        boundaryLevel: sanitizeText(context.boundaryLevel, 'disabled'),
        boundaryReason: sanitizeText(context.boundaryReason),
        boundarySummary: sanitizeText(context.boundarySummary),
        enabled: context.enabled === true,
        confirmationRequired: context.confirmationRequired === true,
      };
    }

    function buildMorphActionPolicySummary(runtimeOverride = null) {
      const registry = getActionRegistry(runtimeOverride);
      const summary = {
        oracleSafe: [],
        architectRequired: [],
        explicitConsentRequired: [],
        disabledByDefault: [],
      };
      const sourceActionTypes = Object.keys(registry.actions || {}).length
        ? Object.keys(registry.actions || {})
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
      const registry = getActionRegistry(runtimeOverride);
      const rawActionTypes = Object.keys(registry.actions || {});
      if (!rawActionTypes.length) return [];
      const aliasMap = getActionAliases(runtimeOverride);
      const availableAliases = new Set(Object.keys(aliasMap).filter((key) => rawActionTypes.includes(key)));
      const canonicalCoveredByAlias = new Set(
        Array.from(availableAliases)
          .map((alias) => sanitizeText(aliasMap[alias]))
          .filter(Boolean)
      );
      const promptTypes = [];
      rawActionTypes.forEach((actionType) => {
        const type = sanitizeText(actionType);
        if (!type) return;
        if (HIDDEN_PROMPT_ACTION_TYPES.has(type)) return;
        if (getMorphActionExecutionPolicy(type, runtimeOverride).consentTier === 'disabled') return;
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
      const type = sanitizeText(actionType);
      const promptQuestion = sanitizeText(context.promptQuestion);
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
      if (/expense/.test(type)) return terseExpenseCaptureIntent || /(记.{0,2}账|支出|花了|消费|开销|报销|补记|补进去|记进去|入账|这笔记上|就这么记账|充话费)/i.test(promptQuestion);
      if (/flash|fixed/.test(type)) return /(闪念|定念|记下来|记下|记录|加一条|存一下|搬到|移到|挪到|去重|清重|重复)/i.test(promptQuestion);
      return explicitWriteIntent;
    }

    function getMorphActionCommitDecision(actionType = '', action = {}, context = {}) {
      const type = sanitizeText(actionType);
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
      const oracleSafeFastPath = policy.consentTier === 'oracle-safe'
        && (
          (context.explicitWriteIntent === true && hasSpecificIntent)
          || context.allowMorphDataActions === true
          || canCommitFromFollowupConfirmation
        );
      const architectRequiredCommit = context.dominantMode === 'oracle'
        ? (context.actionBias === 'hold-space'
          ? ((context.explicitWriteIntent === true && hasSpecificIntent && (context.strongDataOperationIntent === true || context.hasPendingDataIntent === true)) || canCommitFromFollowupConfirmation)
          : ((context.explicitWriteIntent === true && hasSpecificIntent) || (hasSpecificIntent && (context.strongDataOperationIntent === true || context.hasPendingDataIntent === true)) || canCommitFromFollowupConfirmation))
        : ((context.explicitWriteIntent === true && hasSpecificIntent) || (hasSpecificIntent && (context.strongDataOperationIntent === true || context.hasPendingDataIntent === true)) || canCommitFromFollowupConfirmation);
      const canCommitByThreshold = oracleSafeFastPath
        || (policy.consentTier === 'explicit-consent-required'
          ? (hasSpecificIntent || canCommitFromFollowupConfirmation)
          : policy.consentTier === 'architect-required'
            ? architectRequiredCommit
            : context.dominantMode === 'balanced'
              ? (context.explicitWriteIntent === true || context.strongDataOperationIntent === true || context.hasPendingDataIntent === true || canCommitFromFollowupConfirmation)
              : (context.explicitWriteIntent === true || context.strongDataOperationIntent === true || context.hasPendingDataIntent === true || canCommitFromFollowupConfirmation || context.allowMorphDataActions === true));
      return {
        allowed: !!canCommitByThreshold,
        policy,
        reasonCode: canCommitByThreshold ? '' : 'intent-threshold-not-met',
        hasSpecificIntent,
        canCommitFromFollowupConfirmation,
      };
    }

    function buildMorphActionBoundaryResult(actionType = '', policy = {}, options = {}) {
      const context = getMorphActionPermissionContext(actionType, options.runtimeOverride || null);
      const next = {
        allowed: options.allowed !== false,
        action: sanitizeText(actionType),
        displayName: sanitizeText(context.displayName),
        domain: sanitizeText(policy?.domain, sanitizeText(context.domain)),
        permissionLevel: sanitizeText(policy?.permissionLevel, sanitizeText(context.permissionLevel)),
        requiredPermission: sanitizeText(policy?.requiredPermission, sanitizeText(context.permissionLevel)),
        consentTier: sanitizeText(policy?.consentTier, sanitizeText(context.consentTier)),
        riskLevel: sanitizeText(policy?.riskLevel, sanitizeText(context.riskLevel)),
        boundaryLevel: sanitizeText(policy?.boundaryLevel, sanitizeText(context.boundaryLevel)),
        boundarySummary: sanitizeText(context.boundarySummary),
        requiresConfirmation: context.confirmationRequired === true,
        requiresExplicitPermission: sanitizeText(context.consentTier) === 'explicit-consent-required',
        reason: sanitizeText(options.reason, sanitizeText(context.boundaryReason)),
      };
      return typeof api.sanitizeMorphActionBoundaryResult === 'function'
        ? api.sanitizeMorphActionBoundaryResult(next)
        : next;
    }

    return {
      getCanonicalMorphActionName,
      getMorphActionPermissionContext,
      getMorphActionExecutionPolicy,
      buildMorphActionPolicySummary,
      getPreferredMorphPromptActionTypes,
      matchesMorphActionIntent,
      getMorphActionCommitDecision,
      buildMorphActionBoundaryResult,
    };
  }

  window.MorphPermissionContextRuntime = {
    create: createPermissionContextRuntimeModules,
  };
})();
