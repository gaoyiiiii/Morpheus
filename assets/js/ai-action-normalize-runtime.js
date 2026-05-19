// @ts-check

(function initMorphAIActionNormalizeRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionNormalizeRuntime && typeof window.MorphAIActionNormalizeRuntime.create === 'function') return;

  function createAIActionNormalizeRuntime() {
    function normalizeMorphHarnessAction(type = '', rawAction = {}, meta = {}) {
      const safeAction = rawAction && typeof rawAction === 'object' ? { ...rawAction } : {};
      const normalizedFields = [];
      const actionType = String(type || '').trim();
      const buildActionFailure = typeof meta.buildActionFailure === 'function'
        ? meta.buildActionFailure
        : (status = '', _type = '', reasonCode = '', fallbackUserMessage = '') => ({
          reasonCode: String(reasonCode || '').trim(),
          debugMessage: `${String(status || '').trim()}:${String(_type || '').trim()}`,
          userMessage: String(fallbackUserMessage || '').trim(),
        });
      const normalizeProjectStatus = typeof meta.normalizeProjectStatus === 'function'
        ? meta.normalizeProjectStatus
        : (value = '') => String(value || '').trim().toLowerCase();
      const normalizeReminderAction = typeof meta.normalizeReminderAction === 'function'
        ? meta.normalizeReminderAction
        : null;
      const sanitizeAIDailyLogWriteText = typeof meta.sanitizeAIDailyLogWriteText === 'function'
        ? meta.sanitizeAIDailyLogWriteText
        : (value = '') => String(value || '').trim();
      const getTodayStr = typeof meta.getTodayStr === 'function'
        ? meta.getTodayStr
        : () => new Date().toISOString().slice(0, 10);

      if (!String(safeAction.requestId || '').trim()) {
        safeAction.requestId = `morph-${actionType || 'action'}-${Date.now().toString(36).slice(-8)}`;
        normalizedFields.push('requestId');
      }
      if (!String(safeAction.source || '').trim()) {
        safeAction.source = String(meta.source || 'ai').trim() || 'ai';
        normalizedFields.push('source');
      }

      if (['add_flash_thought', 'add_fixed_thought'].includes(actionType)) {
        const text = String(safeAction.text || safeAction.content || '').trim();
        if (!text) return {
          ok: false,
          action: safeAction,
          normalizedFields,
          entity: /flash/.test(actionType) ? 'flash_thought' : 'fixed_thought',
          ...buildActionFailure(
            'blocked_normalization',
            actionType,
            'missing_text',
            /flash/.test(actionType) ? '这次新增闪念的内容还是空的，我先没有继续执行。' : '这次新增定念的内容还是空的，我先没有继续执行。',
            { entity: /flash/.test(actionType) ? 'flash_thought' : 'fixed_thought' }
          ),
        };
        safeAction.text = text;
        safeAction.content = text;
        return { ok: true, action: safeAction, normalizedFields, entity: /flash/.test(actionType) ? 'flash_thought' : 'fixed_thought', normalizedPayload: { requestId: safeAction.requestId, source: safeAction.source, text } };
      }

      if (actionType === 'create_project') {
        const name = String(safeAction.name || safeAction.projectName || '').trim();
        if (!name) return {
          ok: false,
          action: safeAction,
          normalizedFields,
          entity: 'project',
          ...buildActionFailure(
            'blocked_normalization',
            actionType,
            'missing_name',
            '这次新建项目还没有锁定项目名称，我先没有继续执行。',
            { entity: 'project' }
          ),
        };
        safeAction.name = name;
        safeAction.projectName = String(safeAction.projectName || name).trim();
        safeAction.status = normalizeProjectStatus(safeAction.status || 'active') || 'active';
        return { ok: true, action: safeAction, normalizedFields, entity: 'project', normalizedPayload: { requestId: safeAction.requestId, source: safeAction.source, name: safeAction.name, status: safeAction.status } };
      }

      if (actionType === 'update_project_status') {
        const status = normalizeProjectStatus(safeAction.status || '');
        const projectName = String(safeAction.projectName || safeAction.name || '').trim();
        const projectId = String(safeAction.projectId || '').trim();
        if (!status) return {
          ok: false,
          action: safeAction,
          normalizedFields,
          entity: 'project',
          ...buildActionFailure(
            'blocked_normalization',
            actionType,
            'missing_status',
            '这次项目状态更新还没有锁定目标状态，我先没有继续执行。',
            { entity: 'project' }
          ),
        };
        if (!projectId && !projectName) return {
          ok: false,
          action: safeAction,
          normalizedFields,
          entity: 'project',
          ...buildActionFailure(
            'blocked_normalization',
            actionType,
            'missing_project_ref',
            '这次项目状态更新没有锁定目标项目，我先没有继续执行。',
            { entity: 'project' }
          ),
        };
        safeAction.status = status;
        safeAction.projectName = projectName;
        safeAction.name = String(safeAction.name || projectName).trim();
        safeAction.projectId = projectId;
        return { ok: true, action: safeAction, normalizedFields, entity: 'project', normalizedPayload: { requestId: safeAction.requestId, source: safeAction.source, projectId, projectName, newStatus: status } };
      }

      if (actionType === 'add_reminder') {
        const text = String(safeAction.text || safeAction.task || '').trim();
        const datetime = String(safeAction.datetime || safeAction.datetimeRaw || safeAction.dueAtText || '').trim();
        safeAction.text = text;
        if (datetime) safeAction.datetime = datetime;
        if (text && datetime && typeof normalizeReminderAction === 'function') {
          const normalizedReminder = normalizeReminderAction({
            ...safeAction,
            text,
            datetime,
            requestText: String(safeAction.requestText || text).trim() || text,
            source: safeAction.source,
          });
          if (!normalizedReminder) {
            return {
              ok: false,
              action: safeAction,
              normalizedFields,
              entity: 'reminder',
              ...buildActionFailure(
                'blocked_normalization',
                actionType,
                'missing_parseable_datetime',
                '这次提醒还缺少可解析的时间，我先没有继续执行。',
                { entity: 'reminder' }
              ),
            };
          }
          safeAction.id = normalizedReminder.id;
          safeAction.dueAtText = normalizedReminder.dueAtText;
          safeAction.dueAtMs = normalizedReminder.dueAtMs;
          safeAction.datetime = normalizedReminder.dueAtText;
        } else if (datetime) {
          safeAction.dueAtText = datetime;
        }
        return { ok: true, action: safeAction, normalizedFields, entity: 'reminder', targetDate: String(safeAction.dueAtText || datetime).slice(0, 10), normalizedPayload: { requestId: safeAction.requestId, source: safeAction.source, text, datetime: safeAction.dueAtText || datetime, dueAtMs: safeAction.dueAtMs } };
      }

      if (actionType === 'append_daily_log' || actionType === 'append_daily_log_under_date') {
        const text = sanitizeAIDailyLogWriteText(safeAction.text || safeAction.content || '');
        if (!text) return {
          ok: false,
          action: safeAction,
          normalizedFields,
          entity: 'daily_log_entry',
          ...buildActionFailure(
            'blocked_normalization',
            actionType,
            'missing_text',
            '这次日志写入内容还是空的，我先没有继续执行。',
            { entity: 'daily_log_entry' }
          ),
        };
        safeAction.text = text;
        safeAction.content = text;
        if (actionType === 'append_daily_log_under_date') safeAction.date = String(safeAction.date || '').trim();
        return { ok: true, action: safeAction, normalizedFields, entity: 'daily_log_entry', targetDate: String(safeAction.date || '').trim(), normalizedPayload: { requestId: safeAction.requestId, source: safeAction.source, text, date: String(safeAction.date || '').trim() } };
      }

      if (actionType === 'summarize_today_to_daily_log') {
        const text = sanitizeAIDailyLogWriteText(safeAction.text || safeAction.content || '', { preserveStyle: true });
        safeAction.text = text;
        safeAction.content = text;
        safeAction.date = getTodayStr();
        return { ok: true, action: safeAction, normalizedFields, entity: 'daily_log_entry', targetDate: safeAction.date, normalizedPayload: { requestId: safeAction.requestId, source: safeAction.source, text, date: safeAction.date } };
      }

      if (['add_expense_record', 'update_expense_record', 'delete_expense_record', 'undo_last_expense_record'].includes(actionType)) {
        const aliasMap = [
          ['targetNote', ['targetNote', 'searchRemark', 'searchNote', 'noteContains']],
          ['targetText', ['targetText', 'searchText', 'searchItem', 'recordText']],
          ['amount', ['amount', 'newAmount']],
          ['note', ['note', 'newRemark', 'newNote']],
          ['item', ['item', 'newItem']],
          ['category', ['category', 'newCategory']],
          ['spentAt', ['spentAt', 'datetime', 'newSpentAt', 'newDatetime']],
        ];
        aliasMap.forEach(([field, aliases]) => {
          if (String(safeAction[field] || '').trim()) return;
          const found = aliases.find((alias) => String(safeAction[alias] || '').trim());
          if (!found) return;
          safeAction[field] = safeAction[found];
          normalizedFields.push(field);
        });
        if (Number.isFinite(Number(safeAction.amount)) && Number(safeAction.amount) > 0) {
          safeAction.amount = Math.round(Number(safeAction.amount) * 100) / 100;
        }
        return {
          ok: true,
          action: safeAction,
          normalizedFields,
          entity: 'expense_record',
          normalizedPayload: {
            requestId: safeAction.requestId,
            source: safeAction.source,
            recordId: String(safeAction.recordId || safeAction.id || '').trim(),
            item: String(safeAction.item || '').trim(),
            targetText: String(safeAction.targetText || '').trim(),
            targetNote: String(safeAction.targetNote || '').trim(),
            amount: Number.isFinite(Number(safeAction.amount)) ? Number(safeAction.amount) : 0,
            category: String(safeAction.category || '').trim(),
            note: String(safeAction.note || '').trim(),
          },
        };
      }

      return { ok: true, action: safeAction, normalizedFields, entity: '', normalizedPayload: {} };
    }

    return {
      normalizeMorphHarnessAction,
    };
  }

  window.MorphAIActionNormalizeRuntime = {
    create: createAIActionNormalizeRuntime,
  };
})();
