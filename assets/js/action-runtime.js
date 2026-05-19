(function () {
  function createActionRuntimeModules(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getActiveRuntimeBundle(runtimeOverride = null) {
      return runtimeOverride && typeof runtimeOverride === 'object'
        ? runtimeOverride
        : (typeof api.getMorphRuntimeBundle === 'function' ? api.getMorphRuntimeBundle() : {});
    }

    function getActionRegistry(runtimeOverride = null) {
      const runtime = getActiveRuntimeBundle(runtimeOverride);
      const registry = runtime?.actionRegistry && typeof runtime.actionRegistry === 'object'
        ? runtime.actionRegistry
        : null;
      return registry && registry.actions && typeof registry.actions === 'object'
        ? registry
        : { aliases: {}, actions: {} };
    }

    function getActionAliases(runtimeOverride = null) {
      const registry = getActionRegistry(runtimeOverride);
      const aliases = registry.aliases && typeof registry.aliases === 'object'
        ? { ...registry.aliases }
        : {};
      Object.entries(registry.actions || {}).forEach(([actionType, value]) => {
        const entry = value && typeof value === 'object' ? value : {};
        const canonicalAction = String(entry.canonicalAction || actionType || '').trim();
        if (!canonicalAction) return;
        if (actionType !== canonicalAction) aliases[actionType] = canonicalAction;
        (Array.isArray(entry.aliases) ? entry.aliases : []).forEach((alias) => {
          const safeAlias = String(alias || '').trim();
          if (!safeAlias) return;
          aliases[safeAlias] = canonicalAction;
        });
      });
      return aliases;
    }

    function getCanonicalMorphActionName(actionType = '', runtimeOverride = null) {
      const requestedAction = String(actionType || '').trim();
      if (!requestedAction) return '';
      const aliases = getActionAliases(runtimeOverride);
      return String(aliases[requestedAction] || requestedAction).trim();
    }

    function getActionRegistryEntry(actionType = '', runtimeOverride = null) {
      const requestedAction = String(actionType || '').trim();
      if (!requestedAction) return null;
      const registry = getActionRegistry(runtimeOverride);
      const direct = registry.actions?.[requestedAction];
      if (direct && typeof direct === 'object') return direct;
      const canonicalAction = getCanonicalMorphActionName(requestedAction, runtimeOverride);
      const canonical = registry.actions?.[canonicalAction];
      return canonical && typeof canonical === 'object' ? canonical : null;
    }

    function getMorphStructuredActionContract(actionType = '', runtimeOverride = null) {
      const entry = getActionRegistryEntry(actionType, runtimeOverride);
      if (!entry) return null;
      const displayName = String(entry.displayName || '').trim();
      const structured = entry.structured && typeof entry.structured === 'object' ? entry.structured : null;
      if (!displayName && !structured) return null;
      return {
        displayName,
        ...(structured ? { ...structured } : {}),
      };
    }

    function hydrateMorphStructuredActionSlots(actionType = '', action = {}, context = {}) {
      const contract = getMorphStructuredActionContract(actionType, context.runtimeOverride || null);
      const hydration = contract?.slotHydration && typeof contract.slotHydration === 'object' ? contract.slotHydration : null;
      const safeAction = action && typeof action === 'object' ? { ...action } : {};
      const promptQuestion = String(context.promptQuestion || '').trim();
      if (!hydration || !promptQuestion) return { action: safeAction, hydratedFields: [] };
      const hydratedFields = [];
      const fillStringField = (field, value = '') => {
        const nextValue = String(value || '').trim();
        if (!field || !nextValue) return;
        if (String(safeAction[field] || '').trim()) return;
        safeAction[field] = nextValue;
        hydratedFields.push(field);
      };
      const fillNumericField = (field, value) => {
        if (!field) return;
        const numeric = Number(value);
        if (!(Number.isFinite(numeric) && numeric > 0)) return;
        if (Number.isFinite(Number(safeAction[field])) && Number(safeAction[field]) > 0) return;
        safeAction[field] = numeric;
        hydratedFields.push(field);
      };
      if (hydration.nameFromQuestionKind && typeof api.extractCreateNameForAIAction === 'function') {
        fillStringField('name', api.extractCreateNameForAIAction(promptQuestion, hydration.nameFromQuestionKind));
      }
      if (hydration.projectStatusFromQuestion && typeof api.inferProjectStatusActionFromQuestion === 'function') {
        const inferredProjectStatus = api.inferProjectStatusActionFromQuestion(promptQuestion) || {};
        fillStringField('status', inferredProjectStatus.status || '');
        fillStringField('projectId', inferredProjectStatus.projectId || '');
        fillStringField('projectName', inferredProjectStatus.projectName || '');
        fillStringField('name', inferredProjectStatus.projectName || '');
      }
      if (hydration.tailTextField && typeof api.extractTailContentForAIAction === 'function') {
        fillStringField(hydration.tailTextField, api.extractTailContentForAIAction(promptQuestion));
      }
      if (hydration.fixedThoughtNameField && typeof api.extractFixedThoughtNameForDeletion === 'function') {
        fillStringField(hydration.fixedThoughtNameField, api.extractFixedThoughtNameForDeletion(promptQuestion));
      }
      if (hydration.reminderFromQuestion) {
        const inferredReminder = (
          (['delete_reminder', 'update_reminder'].includes(String(actionType || '').trim()) && typeof api.inferLogReminderEditActionFromQuestion === 'function')
            ? api.inferLogReminderEditActionFromQuestion(promptQuestion)
            : typeof api.inferReminderActionFromQuestion === 'function'
              ? api.inferReminderActionFromQuestion(promptQuestion)
              : null
        ) || {};
        fillStringField('text', inferredReminder.text || inferredReminder.title || '');
        fillStringField('requestText', inferredReminder.requestText || inferredReminder.text || inferredReminder.title || '');
        fillStringField('datetime', inferredReminder.datetime || '');
        fillStringField('datetimeRaw', inferredReminder.datetimeRaw || '');
        fillStringField('newText', inferredReminder.text || inferredReminder.title || '');
        fillStringField('newDatetime', inferredReminder.datetime || inferredReminder.datetimeRaw || '');
      }
      if (hydration.expenseFromQuestion && typeof api.extractExpenseRecordFromQuestion === 'function') {
        const inferredExpense = api.extractExpenseRecordFromQuestion(promptQuestion) || {};
        fillStringField('item', inferredExpense.item || inferredExpense.text || inferredExpense.title || '');
        fillStringField('text', inferredExpense.item || inferredExpense.text || inferredExpense.title || '');
        fillStringField('title', inferredExpense.item || inferredExpense.text || inferredExpense.title || '');
        fillStringField('category', inferredExpense.category || '');
        fillStringField('note', inferredExpense.note || '');
        fillStringField('datetime', inferredExpense.datetime || inferredExpense.spentAt || '');
        fillStringField('spentAt', inferredExpense.spentAt || inferredExpense.datetime || '');
        fillNumericField('amount', inferredExpense.amount);
      }
      return { action: safeAction, hydratedFields };
    }

    function validateMorphStructuredAction(actionType = '', action = {}, runtimeOverride = null) {
      const contract = getMorphStructuredActionContract(actionType, runtimeOverride);
      if (!contract) return { ok: true };
      const safe = action && typeof action === 'object' ? action : {};
      const missingField = (contract.requiredStringFields || []).find((field) => !String(safe[field] || '').trim());
      if (missingField) {
        return {
          ok: false,
          userMessage: `${contract.displayName}没有通过参数校验，缺少必要字段“${missingField}”。`,
        };
      }
      const missingGroup = (contract.anyOfStringFields || []).find((fields) => !(Array.isArray(fields) && fields.some((field) => String(safe[field] || '').trim())));
      if (missingGroup) {
        return {
          ok: false,
          userMessage: String(contract.anyOfStringMessage || '').trim() || `${contract.displayName}没有通过参数校验，缺少必要时间信息。`,
        };
      }
      const invalidDateField = (contract.dateFields || []).find((field) => {
        const value = String(safe[field] || '').trim();
        return value && !/^\d{4}-\d{2}-\d{2}$/.test(value);
      });
      if (invalidDateField) {
        return {
          ok: false,
          userMessage: `${contract.displayName}没有通过参数校验，日期格式不正确。`,
        };
      }
      const invalidNumericField = (contract.numericFields || []).find((field) => !(Number.isFinite(Number(safe[field])) && Number(safe[field]) > 0));
      if (invalidNumericField) {
        return {
          ok: false,
          userMessage: `${contract.displayName}没有通过参数校验，数值字段“${invalidNumericField}”不正确。`,
        };
      }
      const missingObjectField = (contract.requiredObjectFields || []).find((field) => {
        const value = safe[field];
        return !(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length);
      });
      if (missingObjectField) {
        return {
          ok: false,
          userMessage: `${contract.displayName}没有通过参数校验，缺少必要对象字段“${missingObjectField}”。`,
        };
      }
      return { ok: true };
    }

    function normalizeMorphActionDateInput(value = '') {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const normalized = raw.replace(/[./]/g, '-');
      const matched = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s.*)?$/);
      if (!matched) return '';
      const year = Number(matched[1]);
      const month = Number(matched[2]);
      const day = Number(matched[3]);
      if (![year, month, day].every(Number.isFinite)) return '';
      const utcNoon = Date.UTC(year, month - 1, day, 12, 0, 0);
      const timezone = typeof api.getAITimezone === 'function' ? api.getAITimezone() : 'Asia/Shanghai';
      const parts = typeof api.getDatePartsInTimezone === 'function'
        ? api.getDatePartsInTimezone(new Date(utcNoon), timezone)
        : null;
      if (!parts || typeof api.formatYMDFromParts !== 'function') return '';
      const dateStr = api.formatYMDFromParts(parts);
      const rematched = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!rematched) return '';
      if (Number(rematched[1]) !== year || Number(rematched[2]) !== month || Number(rematched[3]) !== day) return '';
      return dateStr;
    }

    function normalizeAppendDailyLogAction(actionType = '', action = {}, context = {}) {
      const safeAction = action && typeof action === 'object' ? { ...action } : {};
      const normalizedFields = [];
      const requestId = typeof api.buildMorphActionRequestId === 'function'
        ? api.buildMorphActionRequestId(actionType, safeAction, context)
        : String(safeAction.requestId || '').trim();
      if (String(safeAction.requestId || '').trim() !== requestId) {
        safeAction.requestId = requestId;
        normalizedFields.push('requestId');
      }
      if (!String(safeAction.source || '').trim()) {
        safeAction.source = String(context.source || 'ai').trim() || 'ai';
        normalizedFields.push('source');
      }
      safeAction.preserveStyle = !!safeAction.preserveStyle;
      const text = typeof api.sanitizeAIDailyLogWriteText === 'function'
        ? api.sanitizeAIDailyLogWriteText(safeAction.text || safeAction.content || '', { preserveStyle: !!safeAction.preserveStyle })
        : String(safeAction.text || safeAction.content || '').trim();
      if (!text) {
        return {
          ok: false,
          action: safeAction,
          normalizedFields,
          userMessage: '这次日志写入的内容还是空的，我先没有继续执行。',
        };
      }
      if (String(safeAction.text || '').trim() !== text) normalizedFields.push('text');
      safeAction.text = text;
      safeAction.content = text;
      let targetDate = normalizeMorphActionDateInput(safeAction.date || safeAction.dateStr || '');
      if (!targetDate && actionType === 'append_daily_log') {
        targetDate = typeof api.getTodayStr === 'function' ? api.getTodayStr() : new Date().toISOString().slice(0, 10);
        normalizedFields.push('date');
      }
      if (!targetDate && actionType === 'append_daily_log_under_date') {
        return {
          ok: false,
          action: safeAction,
          normalizedFields,
          userMessage: '指定日期日志写入还缺少有效日期，我先没有继续执行。',
        };
      }
      if (targetDate) {
        if (String(safeAction.date || '').trim() !== targetDate) normalizedFields.push('date');
        safeAction.date = targetDate;
        safeAction.dateStr = targetDate;
      }
      const insertPolicy = String(safeAction.insertPolicy || '').trim() || 'append-under-date-header';
      if (String(safeAction.insertPolicy || '').trim() !== insertPolicy) normalizedFields.push('insertPolicy');
      safeAction.insertPolicy = insertPolicy;
      return {
        ok: true,
        action: safeAction,
        normalizedFields,
        entity: 'daily_log_entry',
        targetDate,
        normalizedPayload: typeof api.sanitizeMorphActionTracePayload === 'function'
          ? api.sanitizeMorphActionTracePayload({
              requestId,
              source: safeAction.source,
              date: targetDate,
              text,
              insertPolicy,
              preserveStyle: !!safeAction.preserveStyle,
            })
          : {},
      };
    }

    function normalizeMorphHarnessAction(actionType = '', action = {}, context = {}) {
      const safeAction = action && typeof action === 'object' ? { ...action } : {};
      const normalizedFields = [];
      const requestedActionType = String(actionType || '').trim();
      const canonicalActionType = getCanonicalMorphActionName(requestedActionType, context.runtimeOverride || null);
      const matchesType = (...candidates) => candidates.includes(requestedActionType) || candidates.includes(canonicalActionType);
      const requestId = typeof api.buildMorphActionRequestId === 'function'
        ? api.buildMorphActionRequestId(actionType, safeAction, context)
        : String(safeAction.requestId || '').trim();
      if (String(safeAction.requestId || '').trim() !== requestId) {
        safeAction.requestId = requestId;
        normalizedFields.push('requestId');
      }
      if (!String(safeAction.source || '').trim()) {
        safeAction.source = String(context.source || 'ai').trim() || 'ai';
        normalizedFields.push('source');
      }
      if (matchesType('add_flash_thought', 'create_flash_thought', 'add_fixed_thought')) {
        const text = typeof api.normalizeAIItemText === 'function'
          ? api.normalizeAIItemText(safeAction.text || safeAction.content || '')
          : String(safeAction.text || safeAction.content || '').trim();
        if (!text) {
          return {
            ok: false,
            action: safeAction,
            normalizedFields,
            entity: matchesType('add_flash_thought', 'create_flash_thought') ? 'flash_thought' : 'fixed_thought',
            userMessage: matchesType('add_flash_thought', 'create_flash_thought')
              ? '这次新增闪念的内容还是空的，我先没有继续执行。'
              : '这次新增定念的内容还是空的，我先没有继续执行。',
          };
        }
        if (String(safeAction.text || '').trim() !== text) normalizedFields.push('text');
        safeAction.text = text;
        safeAction.content = text;
        safeAction.tag = String(safeAction.tag || '').trim();
        return {
          ok: true,
          action: safeAction,
          normalizedFields,
          entity: matchesType('add_flash_thought', 'create_flash_thought') ? 'flash_thought' : 'fixed_thought',
          targetDate: '',
          normalizedPayload: typeof api.sanitizeMorphActionTracePayload === 'function'
            ? api.sanitizeMorphActionTracePayload({ requestId, source: safeAction.source, text, tag: safeAction.tag })
            : {},
        };
      }
      if (matchesType('create_project')) {
        const name = String(safeAction.name || safeAction.projectName || '').trim();
        if (!name) {
          return { ok: false, action: safeAction, normalizedFields, entity: 'project', userMessage: '这次新建项目还没有锁定项目名称，我先没有继续执行。' };
        }
        if (String(safeAction.name || '').trim() !== name) normalizedFields.push('name');
        safeAction.name = name;
        if (!String(safeAction.projectName || '').trim()) {
          safeAction.projectName = name;
          normalizedFields.push('projectName');
        }
        const status = (typeof api.normalizeProjectStatus === 'function' ? api.normalizeProjectStatus(safeAction.status || 'active') : '') || 'active';
        if (String(safeAction.status || '').trim() !== status) normalizedFields.push('status');
        safeAction.status = status;
        const description = String(safeAction.description || '').trim();
        const bodyText = String(safeAction.bodyText || safeAction.content || '').trim();
        if (String(safeAction.description || '').trim() !== description) normalizedFields.push('description');
        if (String(safeAction.bodyText || '').trim() !== bodyText) normalizedFields.push('bodyText');
        safeAction.description = description;
        safeAction.bodyText = bodyText;
        if (bodyText && String(safeAction.content || '').trim() !== bodyText) {
          safeAction.content = bodyText;
          normalizedFields.push('content');
        }
        return {
          ok: true,
          action: safeAction,
          normalizedFields,
          entity: 'project',
          targetDate: '',
          normalizedPayload: typeof api.sanitizeMorphActionTracePayload === 'function'
            ? api.sanitizeMorphActionTracePayload({ requestId, source: safeAction.source, name, status, description, bodyText })
            : {},
        };
      }
      if (matchesType('update_project_status')) {
        const status = typeof api.normalizeProjectStatus === 'function' ? api.normalizeProjectStatus(safeAction.status || '') : '';
        if (!status) {
          return { ok: false, action: safeAction, normalizedFields, entity: 'project', userMessage: '这次项目状态更新还没有锁定目标状态，我先没有继续执行。' };
        }
        if (String(safeAction.status || '').trim() !== status) normalizedFields.push('status');
        safeAction.status = status;
        const project = typeof api.resolveProjectByRef === 'function' ? api.resolveProjectByRef(safeAction) : null;
        const projectId = String(safeAction.projectId || project?.id || '').trim();
        const projectName = String(safeAction.projectName || safeAction.name || project?.name || '').trim();
        if (!projectId && !projectName) {
          return { ok: false, action: safeAction, normalizedFields, entity: 'project', userMessage: '这次项目状态更新没有锁定目标项目，我先没有继续执行。' };
        }
        if (String(safeAction.projectId || '').trim() !== projectId) normalizedFields.push('projectId');
        if (String(safeAction.projectName || '').trim() !== projectName) normalizedFields.push('projectName');
        if (String(safeAction.name || '').trim() !== projectName) normalizedFields.push('name');
        safeAction.projectId = projectId;
        safeAction.projectName = projectName;
        safeAction.name = projectName;
        const currentStatus = typeof api.getProjectStoredStatus === 'function' ? api.getProjectStoredStatus(project) : '';
        if (currentStatus) {
          if (String(safeAction.oldStatus || '').trim() !== currentStatus) normalizedFields.push('oldStatus');
          safeAction.oldStatus = currentStatus;
        }
        return {
          ok: true,
          action: safeAction,
          normalizedFields,
          entity: 'project',
          targetDate: '',
          normalizedPayload: typeof api.sanitizeMorphActionTracePayload === 'function'
            ? api.sanitizeMorphActionTracePayload({
                requestId,
                source: safeAction.source,
                projectId,
                projectName,
                oldStatus: safeAction.oldStatus || '',
                newStatus: status,
              })
            : {},
        };
      }
      if (matchesType('add_reminder', 'create_reminder')) {
        const text = String(safeAction.text || safeAction.task || safeAction.content || '').trim();
        if (!text) {
          return { ok: false, action: safeAction, normalizedFields, entity: 'reminder', userMessage: '这次提醒的内容还是空的，我先没有继续执行。' };
        }
        if (String(safeAction.text || '').trim() !== text) normalizedFields.push('text');
        safeAction.text = text;
        safeAction.requestText = String(
          safeAction.requestText
          || safeAction.detailText
          || safeAction.reminderText
          || (typeof api.extractReminderDemandTextFromQuestion === 'function' ? api.extractReminderDemandTextFromQuestion(safeAction.rawQuestion || context.promptQuestion || '') : '')
          || text
        ).trim() || text;
        const normalizedReminder = typeof api.normalizeReminderAction === 'function'
          ? api.normalizeReminderAction({
              ...safeAction,
              text,
              requestText: safeAction.requestText,
              source: safeAction.source,
            })
          : null;
        if (!normalizedReminder) {
          return { ok: false, action: safeAction, normalizedFields, entity: 'reminder', userMessage: '这次提醒还缺少可解析的时间，我先没有继续执行。' };
        }
        [
          ['id', normalizedReminder.id],
          ['dueAtMs', normalizedReminder.dueAtMs],
          ['dueAtText', normalizedReminder.dueAtText],
          ['datetime', normalizedReminder.dueAtText],
          ['timezone', normalizedReminder.timezone],
          ['createdAt', normalizedReminder.createdAt],
          ['updatedAt', normalizedReminder.updatedAt],
          ['status', normalizedReminder.status],
          ['requestText', normalizedReminder.requestText],
          ['source', normalizedReminder.source],
        ].forEach(([field, value]) => {
          if (safeAction[field] !== value) normalizedFields.push(field);
          safeAction[field] = value;
        });
        return {
          ok: true,
          action: safeAction,
          normalizedFields,
          entity: 'reminder',
          targetDate: String(normalizedReminder.dueAtText || '').trim().slice(0, 10),
          normalizedPayload: typeof api.sanitizeMorphActionTracePayload === 'function'
            ? api.sanitizeMorphActionTracePayload({
                requestId,
                source: safeAction.source,
                text: safeAction.text,
                requestText: safeAction.requestText,
                datetime: safeAction.dueAtText,
                dueAtMs: safeAction.dueAtMs,
                timezone: safeAction.timezone,
              })
            : {},
        };
      }
      if (matchesType('append_daily_log', 'append_daily_log_under_date')) {
        return normalizeAppendDailyLogAction(requestedActionType, action, context);
      }
      if (matchesType('summarize_today_to_daily_log')) {
        const text = typeof api.sanitizeAIDailyLogWriteText === 'function'
          ? api.sanitizeAIDailyLogWriteText(safeAction.text || safeAction.content || '', { preserveStyle: true })
          : String(safeAction.text || safeAction.content || '').trim();
        if (String(safeAction.text || '').trim() !== text) normalizedFields.push('text');
        safeAction.text = text;
        safeAction.content = text;
        const targetDate = typeof api.getTodayStr === 'function' ? api.getTodayStr() : new Date().toISOString().slice(0, 10);
        if (String(safeAction.date || '').trim() !== targetDate) normalizedFields.push('date');
        safeAction.date = targetDate;
        safeAction.dateStr = targetDate;
        return {
          ok: true,
          action: safeAction,
          normalizedFields,
          entity: 'daily_log_entry',
          targetDate,
          normalizedPayload: typeof api.sanitizeMorphActionTracePayload === 'function'
            ? api.sanitizeMorphActionTracePayload({ requestId, source: safeAction.source, date: targetDate, text })
            : {},
        };
      }
      return {
        ok: true,
        action: safeAction,
        normalizedFields,
        entity: '',
        targetDate: '',
        normalizedPayload: normalizedFields.length && typeof api.sanitizeMorphActionTracePayload === 'function'
          ? api.sanitizeMorphActionTracePayload({ requestId: safeAction.requestId, source: safeAction.source })
          : {},
      };
    }

    function buildStructuredConfirmationReason(actionType = '', action = {}, options = {}) {
      const type = String(actionType || '').trim();
      if (!type) return '';
      const exposeRawActionFailures = options.exposeRawActionFailures === true;
      const buildActionDebugMessage = typeof api.buildActionDebugMessage === 'function'
        ? api.buildActionDebugMessage
        : (status = '', requestedType = '', reason = '') => `${String(status || '').trim()}:${String(requestedType || '').trim()}:${String(reason || '').trim()}`;
      if (exposeRawActionFailures) {
        if (['create_project', 'create_routine'].includes(type) && !String(action.name || '').trim()) return buildActionDebugMessage('needs_confirmation', type, 'missing_name');
        if (['add_flash_thought', 'create_flash_thought', 'add_fixed_thought'].includes(type) && !String(action.text || '').trim()) return buildActionDebugMessage('needs_confirmation', type, 'missing_text');
        if (type === 'delete_fixed_thought' && !String(action.text || '').trim()) return buildActionDebugMessage('needs_confirmation', type, 'missing_target_text');
        if (['delete_project_reference', 'update_project_reference'].includes(type)) return buildActionDebugMessage('needs_confirmation', type, 'missing_reference_target');
        if (['delete_project_block', 'update_project_block'].includes(type)) return buildActionDebugMessage('needs_confirmation', type, 'missing_block_target');
        if (['delete_reminder', 'update_reminder'].includes(type) && !action.deleteAllMatches) return buildActionDebugMessage('needs_confirmation', type, 'missing_reminder_target');
        if (type === 'add_reminder' || type === 'create_reminder') {
          const reminderText = String(action.text || action.requestText || '').trim();
          const hasConcreteText = !!reminderText && reminderText !== '你设置的提醒';
          const hasConcreteTime = !!String(action.datetime || action.datetimeRaw || '').trim();
          if (!hasConcreteText && !hasConcreteTime) return buildActionDebugMessage('needs_confirmation', type, 'missing_text_and_time');
          if (!hasConcreteTime) return buildActionDebugMessage('needs_confirmation', type, 'missing_time');
          if (!hasConcreteText) return buildActionDebugMessage('needs_confirmation', type, 'missing_text');
        }
        if (['delete_expense_record', 'update_expense_record'].includes(type)) return buildActionDebugMessage('needs_confirmation', type, 'missing_expense_target');
        if (['delete_daily_log_entry', 'update_daily_log_entry'].includes(type)) return buildActionDebugMessage('needs_confirmation', type, 'missing_daily_log_target');
      }
      if (['create_project', 'create_routine'].includes(type) && !String(action.name || '').trim()) {
        return `我已经理解到你是在新建${type === 'create_project' ? '项目' : '节律'}，但名字还没锁定。你直接回我名称，我就继续。`;
      }
      if (['add_flash_thought', 'create_flash_thought', 'add_fixed_thought'].includes(type) && !String(action.text || '').trim()) {
        return `我已经理解到你是在新增${['add_flash_thought', 'create_flash_thought'].includes(type) ? '闪念' : '定念'}，但内容还没锁定。你直接回我那句内容，我就继续。`;
      }
      if (type === 'delete_fixed_thought' && !String(action.text || '').trim()) return '我已经理解到你是在删除定念，但还没锁定具体是哪一条。你直接回我定念名字，我就继续。';
      if (['delete_project_reference', 'update_project_reference'].includes(type)) return '我已经理解到你是在处理项目参考，但还没锁定具体是哪一条。你直接给我那条参考的原文，或者点名它所在的项目和内容，我就能继续。';
      if (['delete_project_block', 'update_project_block'].includes(type)) return '我已经理解到你是在处理项目正文块，但目标块还不够明确。你可以直接引用那一段，或者告诉我是这个项目里的哪一块。';
      if (['delete_reminder', 'update_reminder'].includes(type) && !action.deleteAllMatches) return '我已经理解到你是在处理提醒，但还没锁定具体是哪一条。你给我提醒内容、时间，或者说“最新那条提醒”，我就能继续。';
      if (type === 'add_reminder' || type === 'create_reminder') {
        const reminderText = String(action.text || action.requestText || '').trim();
        const hasConcreteText = !!reminderText && reminderText !== '你设置的提醒';
        const hasConcreteTime = !!String(action.datetime || action.datetimeRaw || '').trim();
        if (!hasConcreteText && !hasConcreteTime) return '我已经理解到你是想加一条提醒，但提醒内容和时间都还没锁定。你直接回我“提醒什么 + 什么时候”，我就继续。';
        if (!hasConcreteTime) return '我已经理解到你是想加提醒了，但时间还没锁定。你直接回我提醒时间，我就继续。';
        if (!hasConcreteText) return '我已经理解到你是想加提醒了，但提醒内容还没锁定。你直接回我提醒什么，我就继续。';
      }
      if (['delete_expense_record', 'update_expense_record'].includes(type)) return '我已经理解到你是在处理记账，但还没锁定具体是哪一笔。你给我金额、事项，或者直接说“最新那笔”，我就能继续。';
      if (['delete_daily_log_entry', 'update_daily_log_entry'].includes(type)) return '我已经理解到你是在处理日志条目，但还没锁定具体是哪一段。你给我日期和那段原文，我就能继续。';
      return '';
    }

    return {
      getCanonicalMorphActionName,
      getMorphStructuredActionContract,
      hydrateMorphStructuredActionSlots,
      validateMorphStructuredAction,
      normalizeMorphActionDateInput,
      normalizeAppendDailyLogAction,
      normalizeMorphHarnessAction,
      buildStructuredConfirmationReason,
    };
  }

  window.MorphActionRuntimeModules = {
    create: createActionRuntimeModules,
  };
})();
