// @ts-check

(function initMorphAIActionUndoRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionUndoRuntime && typeof window.MorphAIActionUndoRuntime.create === 'function') return;

  function createAIActionUndoRuntime() {
    async function applyUndoAction(type = '', actionPayload = {}, runtime = {}) {
      const actionType = String(type || '').trim();
      const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
      const ctx = runtime && typeof runtime === 'object' ? runtime : {};
      const undoLastMorphActionTransaction = typeof ctx.undoLastMorphActionTransaction === 'function'
        ? ctx.undoLastMorphActionTransaction
        : async () => ({ ok: false, reason: '当前没有可撤销的操作。' });
      const undoLastChange = typeof ctx.undoLastChange === 'function' ? ctx.undoLastChange : () => false;

      if (!actionType) {
        return { handled: false, changed: false, appliedLabels: [], createdItems: [], blockedLabel: '', blockedReason: '', performedTransactionUndo: false, actionRuntimeMeta: null };
      }

      if (actionType === 'undo_log_or_reminder_change') {
        const undone = await undoLastMorphActionTransaction({ domainFilter: ['daily', 'reminders', 'routines'], sourceFilter: ['ai'] });
        if (undone?.ok) {
          return {
            handled: true,
            changed: true,
            appliedLabels: [`撤销成功：${String(undone.summary || '').trim()}`],
            createdItems: [],
            blockedLabel: '',
            blockedReason: '',
            performedTransactionUndo: true,
            actionRuntimeMeta: undone.actionRuntimeMeta && typeof undone.actionRuntimeMeta === 'object' ? undone.actionRuntimeMeta : null,
          };
        }
        if (undoLastChange()) {
          return {
            handled: true,
            changed: true,
            appliedLabels: ['撤销成功：最近一次变更'],
            createdItems: [],
            blockedLabel: '',
            blockedReason: '',
            performedTransactionUndo: true,
            actionRuntimeMeta: null,
          };
        }
        return {
          handled: true,
          changed: false,
          appliedLabels: [],
          createdItems: [],
          blockedLabel: String(undone?.reason || '').trim() ? '撤销失败：日志或提醒变更' : '',
          blockedReason: String(undone?.reason || '').trim(),
          performedTransactionUndo: false,
          actionRuntimeMeta: null,
        };
      }

      if (actionType === 'undo_last_ai_transaction') {
        const targetActionTypes = Array.isArray(action.targetActionTypes)
          ? action.targetActionTypes.map((item) => String(item || '').trim()).filter(Boolean)
          : [];
        const targetTransactionId = String(action.targetTransactionId || '').trim();
        const undone = await undoLastMorphActionTransaction({
          sourceFilter: ['ai'],
          transactionIdFilter: targetTransactionId || '',
          actionTypeFilter: targetActionTypes.length ? targetActionTypes : null,
        });
        if (!undone?.ok) {
          return {
            handled: true,
            changed: false,
            appliedLabels: [],
            createdItems: [],
            blockedLabel: '撤销失败：最近一次 AI 操作',
            blockedReason: String(undone?.reason || '').trim() || (targetActionTypes.length ? '当前没有可撤销的对应操作。' : '当前没有可撤销的 AI 操作。'),
            performedTransactionUndo: false,
            actionRuntimeMeta: null,
          };
        }
        return {
          handled: true,
          changed: true,
          appliedLabels: [`撤销成功：${String(undone.summary || '').trim()}`],
          createdItems: [],
          blockedLabel: '',
          blockedReason: '',
          performedTransactionUndo: true,
          actionRuntimeMeta: undone.actionRuntimeMeta && typeof undone.actionRuntimeMeta === 'object' ? undone.actionRuntimeMeta : null,
        };
      }

      if (actionType === 'undo_last_external_sync') {
        const undone = await undoLastMorphActionTransaction({ sourceFilter: ['external-sync'] });
        if (!undone?.ok) {
          return {
            handled: true,
            changed: false,
            appliedLabels: [],
            createdItems: [],
            blockedLabel: '撤销失败：最近一次外部同步',
            blockedReason: String(undone?.reason || '').trim() || '当前没有可撤销的外部同步。',
            performedTransactionUndo: false,
            actionRuntimeMeta: null,
          };
        }
        return {
          handled: true,
          changed: true,
          appliedLabels: [`撤销成功：${String(undone.summary || '').trim()}`],
          createdItems: [],
          blockedLabel: '',
          blockedReason: '',
          performedTransactionUndo: true,
          actionRuntimeMeta: undone.actionRuntimeMeta && typeof undone.actionRuntimeMeta === 'object' ? undone.actionRuntimeMeta : null,
        };
      }

      if (actionType === 'undo_last_manual_transaction') {
        const undone = await undoLastMorphActionTransaction({ sourceFilter: ['manual'] });
        if (!undone?.ok) {
          return {
            handled: true,
            changed: false,
            appliedLabels: [],
            createdItems: [],
            blockedLabel: '撤销失败：最近一次手动操作',
            blockedReason: String(undone?.reason || '').trim() || '当前没有可撤销的手动操作。',
            performedTransactionUndo: false,
            actionRuntimeMeta: null,
          };
        }
        return {
          handled: true,
          changed: true,
          appliedLabels: [`撤销成功：${String(undone.summary || '').trim()}`],
          createdItems: [],
          blockedLabel: '',
          blockedReason: '',
          performedTransactionUndo: true,
          actionRuntimeMeta: undone.actionRuntimeMeta && typeof undone.actionRuntimeMeta === 'object' ? undone.actionRuntimeMeta : null,
        };
      }

      return { handled: false, changed: false, appliedLabels: [], createdItems: [], blockedLabel: '', blockedReason: '', performedTransactionUndo: false, actionRuntimeMeta: null };
    }

    return {
      applyUndoAction,
    };
  }

  window.MorphAIActionUndoRuntime = {
    create: createAIActionUndoRuntime,
  };
})();
