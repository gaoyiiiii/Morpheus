// @ts-check

(function initMorphAIActionExpenseRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionExpenseRuntime && typeof window.MorphAIActionExpenseRuntime.create === 'function') return;

  function createAIActionExpenseRuntime() {
    function buildExpensePostPersistTask(label = '', effect = null) {
      if (typeof effect !== 'function') return;
      return () => {
        try {
          effect();
        } catch (error) {
          if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn(`[Morpheus][expense-action] ${String(label || 'post-persist').trim() || 'post-persist'} failed, preserving primary write.`, error);
          }
        }
      };
    }

    function applyExpenseAction(type = '', actionPayload = {}, runtime = {}) {
      const actionType = String(type || '').trim();
      const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
      const ctx = runtime && typeof runtime === 'object' ? runtime : {};
      const dataRef = ctx.dataRef && typeof ctx.dataRef === 'object' ? ctx.dataRef : null;
      const ensureExpenseLedgerShape = typeof ctx.ensureExpenseLedgerShape === 'function' ? ctx.ensureExpenseLedgerShape : null;
      const normalizeExpenseLedgerRecord = typeof ctx.normalizeExpenseLedgerRecord === 'function' ? ctx.normalizeExpenseLedgerRecord : null;
      const inferExpenseCategoryFromText = typeof ctx.inferExpenseCategoryFromText === 'function' ? ctx.inferExpenseCategoryFromText : () => '日用百货';
      const findExpenseLedgerRecordByAction = typeof ctx.findExpenseLedgerRecordByAction === 'function' ? ctx.findExpenseLedgerRecordByAction : null;
      const getExpenseLedgerRecordIndexById = typeof ctx.getExpenseLedgerRecordIndexById === 'function' ? ctx.getExpenseLedgerRecordIndexById : null;
      const syncExpenseLedgerExtensionFiles = typeof ctx.syncExpenseLedgerExtensionFiles === 'function' ? ctx.syncExpenseLedgerExtensionFiles : null;
      const buildExpenseLedgerSummary = typeof ctx.buildExpenseLedgerSummary === 'function' ? ctx.buildExpenseLedgerSummary : () => '';
      const formatDateTimeFull = typeof ctx.formatDateTimeFull === 'function' ? ctx.formatDateTimeFull : (() => '');
      const genId = typeof ctx.genId === 'function' ? ctx.genId : (() => `expense_${Date.now()}`);

      if (!actionType || !dataRef || !ensureExpenseLedgerShape) {
        return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
      }

      const ledger = ensureExpenseLedgerShape(dataRef);
      const buildResult = (record = {}, label = '记账') => {
        const summary = buildExpenseLedgerSummary(record);
        return {
          handled: true,
          changed: true,
          appliedLabels: [`${label}：${summary}`],
          createdItems: [{ tab: 'expenseLedger', id: String(record?.id || '').trim(), text: summary }],
          actionRuntimeMeta: null,
        };
      };

      if (actionType === 'add_expense_record') {
        if (!normalizeExpenseLedgerRecord) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const record = normalizeExpenseLedgerRecord({
          id: action.id || genId(),
          item: String(action.item || action.text || action.title || action.note || action.category || '').trim(),
          category: String(action.category || '').trim() || inferExpenseCategoryFromText(String(action.item || action.text || action.note || '')),
          amount: Number(action.amount),
          note: String(action.note || '').trim(),
          spentAt: String(action.spentAt || action.datetime || '').trim() || formatDateTimeFull(new Date()).slice(0, 16),
          createdAt: new Date().toISOString(),
          source: String(action.source || 'ai').trim() || 'ai',
        });
        if (!record || !record.item) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const postPersistTasks = [];
        if (!Array.isArray(ledger.categories)) ledger.categories = [];
        if (!ledger.categories.includes(record.category)) ledger.categories.push(record.category);
        if (!Array.isArray(ledger.records)) ledger.records = [];
        ledger.records.unshift(record);
        const syncTask = buildExpensePostPersistTask('syncExpenseLedgerExtensionFiles', () => {
          if (syncExpenseLedgerExtensionFiles) syncExpenseLedgerExtensionFiles(record);
        });
        if (syncTask) postPersistTasks.push(syncTask);
        return {
          ...buildResult(record, '记账'),
          actionRuntimeMeta: postPersistTasks.length ? { postPersistTasks } : null,
        };
      }

      if (actionType === 'update_expense_record') {
        if (!normalizeExpenseLedgerRecord || !findExpenseLedgerRecordByAction || !getExpenseLedgerRecordIndexById) {
          return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        }
        const target = findExpenseLedgerRecordByAction(action, ledger);
        if (!target?.id) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const index = getExpenseLedgerRecordIndexById(target.id, ledger);
        if (index < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const nextCategory = String(action.category || '').trim() || String(target.category || '').trim() || inferExpenseCategoryFromText(String(action.item || target.item || ''));
        const nextAmount = Number.isFinite(Number(action.amount)) && Number(action.amount) > 0 ? Math.round(Number(action.amount) * 100) / 100 : Number(target.amount || 0);
        const nextSpentAt = String(action.spentAt || action.datetime || '').trim() || String(target.spentAt || '').trim() || formatDateTimeFull(new Date()).slice(0, 16);
        const nextItem = String(action.item || action.text || action.title || '').trim() || String(target.item || '').trim();
        const nextNote = Object.prototype.hasOwnProperty.call(action, 'note') ? String(action.note || '').trim() : String(target.note || '').trim();
        const updated = normalizeExpenseLedgerRecord({
          ...target,
          item: nextItem,
          amount: nextAmount,
          category: nextCategory,
          note: nextNote,
          spentAt: nextSpentAt,
          source: String(action.source || target.source || 'ai').trim() || 'ai',
        });
        if (!updated?.item) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const postPersistTasks = [];
        if (!Array.isArray(ledger.records)) ledger.records = [];
        ledger.records[index] = updated;
        if (!Array.isArray(ledger.categories)) ledger.categories = [];
        if (updated.category && !ledger.categories.includes(updated.category)) ledger.categories.push(updated.category);
        const syncTask = buildExpensePostPersistTask('syncExpenseLedgerExtensionFiles', () => {
          if (syncExpenseLedgerExtensionFiles) syncExpenseLedgerExtensionFiles();
        });
        if (syncTask) postPersistTasks.push(syncTask);
        return {
          ...buildResult(updated, '修改记账'),
          actionRuntimeMeta: postPersistTasks.length ? { postPersistTasks } : null,
        };
      }

      if (actionType === 'delete_expense_record') {
        if (!findExpenseLedgerRecordByAction || !getExpenseLedgerRecordIndexById) {
          return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        }
        const target = findExpenseLedgerRecordByAction(action, ledger);
        if (!target?.id) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const index = getExpenseLedgerRecordIndexById(target.id, ledger);
        if (index < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const removed = Array.isArray(ledger.records) ? ledger.records.splice(index, 1)[0] : null;
        if (!removed?.id) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const postPersistTasks = [];
        const syncTask = buildExpensePostPersistTask('syncExpenseLedgerExtensionFiles', () => {
          if (syncExpenseLedgerExtensionFiles) syncExpenseLedgerExtensionFiles();
        });
        if (syncTask) postPersistTasks.push(syncTask);
        return {
          ...buildResult(removed, '删除记账'),
          actionRuntimeMeta: postPersistTasks.length ? { postPersistTasks } : null,
        };
      }

      if (actionType === 'undo_last_expense_record') {
        const removed = Array.isArray(ledger.records) ? ledger.records.shift() : null;
        if (!removed?.id) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const postPersistTasks = [];
        const syncTask = buildExpensePostPersistTask('syncExpenseLedgerExtensionFiles', () => {
          if (syncExpenseLedgerExtensionFiles) syncExpenseLedgerExtensionFiles();
        });
        if (syncTask) postPersistTasks.push(syncTask);
        return {
          ...buildResult(removed, '撤销记账'),
          actionRuntimeMeta: postPersistTasks.length ? { postPersistTasks } : null,
        };
      }

      return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
    }

    return {
      applyExpenseAction,
    };
  }

  window.MorphAIActionExpenseRuntime = {
    create: createAIActionExpenseRuntime,
  };
})();
