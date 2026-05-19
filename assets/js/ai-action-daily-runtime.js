// @ts-check

(function initMorphAIActionDailyRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionDailyRuntime && typeof window.MorphAIActionDailyRuntime.create === 'function') return;

  function createAIActionDailyRuntime() {
    function applyDailyAction(type = '', actionPayload = {}, runtime = {}) {
      const actionType = String(type || '').trim();
      const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
      const ctx = runtime && typeof runtime === 'object' ? runtime : {};
      const dataRef = ctx.dataRef && typeof ctx.dataRef === 'object' ? ctx.dataRef : null;
      const pushAILogReminderUndoSnapshot = typeof ctx.pushAILogReminderUndoSnapshot === 'function' ? ctx.pushAILogReminderUndoSnapshot : null;
      const appendTodayLogDetailed = typeof ctx.appendTodayLogDetailed === 'function' ? ctx.appendTodayLogDetailed : null;
      const appendLogUnderDateDetailed = typeof ctx.appendLogUnderDateDetailed === 'function' ? ctx.appendLogUnderDateDetailed : null;
      const findDailyLogEntriesByActionRef = typeof ctx.findDailyLogEntriesByActionRef === 'function' ? ctx.findDailyLogEntriesByActionRef : null;
      const summarizeTodayDailyLogLocally = typeof ctx.summarizeTodayDailyLogLocally === 'function' ? ctx.summarizeTodayDailyLogLocally : () => '';

      if (!actionType || !dataRef) return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };

      if (actionType === 'append_daily_log') {
        if (!appendTodayLogDetailed) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (pushAILogReminderUndoSnapshot) pushAILogReminderUndoSnapshot('append_daily_log');
        const preserveStyle = !!action.preserveStyle;
        const result = appendTodayLogDetailed(action.text || action.content || '', { preferTodo: !preserveStyle });
        if (!result?.count) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        return {
          handled: true,
          changed: true,
          appliedLabels: [`写入今日日志：${result.count} 段`],
          createdItems: [{ tab: 'daily', id: result.dateStr, text: result.textPreview, blockIds: result.blockIds }],
          actionRuntimeMeta: { actionResult: result },
        };
      }

      if (actionType === 'append_daily_log_under_date') {
        if (!appendLogUnderDateDetailed) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (pushAILogReminderUndoSnapshot) pushAILogReminderUndoSnapshot('append_daily_log_under_date');
        const dateStr = String(action.date || action.dateStr || '').trim();
        const preserveStyle = !!action.preserveStyle;
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const result = appendLogUnderDateDetailed(dateStr.slice(0, 7), dateStr, action.text || action.content || '', { preferTodo: !preserveStyle });
        if (!result?.count) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        return {
          handled: true,
          changed: true,
          appliedLabels: [`写入日志：${dateStr}`],
          createdItems: [{ tab: 'daily', id: dateStr, text: result.textPreview, blockIds: result.blockIds }],
          actionRuntimeMeta: { actionResult: result },
        };
      }

      if (actionType === 'delete_daily_log_entry') {
        if (!findDailyLogEntriesByActionRef) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const targets = findDailyLogEntriesByActionRef(action, { single: false });
        if (!targets.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (pushAILogReminderUndoSnapshot) pushAILogReminderUndoSnapshot('delete_daily_log_entry');
        let removed = 0;
        targets.forEach((target) => {
          const blocks = dataRef.dailyMonths?.[target.monthKey];
          if (!Array.isArray(blocks)) return;
          const idx = blocks.findIndex((block) => String(block?.id || '') === target.blockId);
          if (idx < 0) return;
          blocks.splice(idx, 1);
          removed += 1;
        });
        if (!removed) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        return { handled: true, changed: true, appliedLabels: [`删除日志条目：${removed} 条`], createdItems: [], actionRuntimeMeta: null };
      }

      if (actionType === 'update_daily_log_entry') {
        if (!findDailyLogEntriesByActionRef) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const targets = findDailyLogEntriesByActionRef(action, { single: true });
        if (!targets.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const target = targets[0];
        const newText = String(action.newText || action.textNew || action.toText || action.content || '').trim();
        if (!newText) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const blocks = dataRef.dailyMonths?.[target.monthKey];
        if (!Array.isArray(blocks)) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const idx = blocks.findIndex((block) => String(block?.id || '') === target.blockId);
        if (idx < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (pushAILogReminderUndoSnapshot) pushAILogReminderUndoSnapshot('update_daily_log_entry');
        blocks[idx].content = newText;
        delete blocks[idx].html;
        return { handled: true, changed: true, appliedLabels: [`修改日志：${target.dateStr}`], createdItems: [], actionRuntimeMeta: null };
      }

      if (actionType === 'summarize_today_to_daily_log') {
        if (!appendTodayLogDetailed) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (pushAILogReminderUndoSnapshot) pushAILogReminderUndoSnapshot('summarize_today_to_daily_log');
        const text = String(action.text || action.content || '').trim() || summarizeTodayDailyLogLocally();
        if (!text) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const result = appendTodayLogDetailed(text, { preferTodo: false });
        if (!result?.count) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        return {
          handled: true,
          changed: true,
          appliedLabels: [`今日日志总结：${result.count} 段`],
          createdItems: [{ tab: 'daily', id: result.dateStr, text: result.textPreview, blockIds: result.blockIds }],
          actionRuntimeMeta: { actionResult: result },
        };
      }

      return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
    }

    return {
      applyDailyAction,
    };
  }

  window.MorphAIActionDailyRuntime = {
    create: createAIActionDailyRuntime,
  };
})();
