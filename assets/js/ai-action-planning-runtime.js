// @ts-check

(function initMorphAIActionPlanningRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionPlanningRuntime && typeof window.MorphAIActionPlanningRuntime.create === 'function') return;

  function createAIActionPlanningRuntime() {
    function buildPlanningActionRuntimeMeta({
      transactionEligible = false,
      mutationLayer = 'draft',
      actionResult = null,
    } = {}) {
      const meta = {
        transactionEligible: transactionEligible === true,
        mutationLayer: String(mutationLayer || '').trim() || 'draft',
      };
      if (actionResult && typeof actionResult === 'object') meta.actionResult = actionResult;
      return meta;
    }

    function applyPlanningAction(type = '', actionPayload = {}, runtime = {}) {
      const actionType = String(type || '').trim();
      const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
      const ctx = runtime && typeof runtime === 'object' ? runtime : {};
      const pushAILogReminderUndoSnapshot = typeof ctx.pushAILogReminderUndoSnapshot === 'function' ? ctx.pushAILogReminderUndoSnapshot : null;
      const clampTimeBlockDayCount = typeof ctx.clampTimeBlockDayCount === 'function' ? ctx.clampTimeBlockDayCount : (value, fallback) => Number(value || fallback || 7);
      const applyExplicitWeekScheduleDraft = typeof ctx.applyExplicitWeekScheduleDraft === 'function' ? ctx.applyExplicitWeekScheduleDraft : null;
      const generateWeekScheduleDraftFromCurrentData = typeof ctx.generateWeekScheduleDraftFromCurrentData === 'function' ? ctx.generateWeekScheduleDraftFromCurrentData : null;
      const generateTodayTimeBlocksDraftFromCurrentData = typeof ctx.generateTodayTimeBlocksDraftFromCurrentData === 'function' ? ctx.generateTodayTimeBlocksDraftFromCurrentData : null;
      const formatTimeBlocksAsDailyText = typeof ctx.formatTimeBlocksAsDailyText === 'function' ? ctx.formatTimeBlocksAsDailyText : () => '';
      const appendToTodayDailyLog = typeof ctx.appendToTodayDailyLog === 'function' ? ctx.appendToTodayDailyLog : null;
      const genId = typeof ctx.genId === 'function' ? ctx.genId : () => `id-${Date.now().toString(36)}`;
      const userAskedWriteBlocksToDaily = ctx.userAskedWriteBlocksToDaily === true;

      if (!actionType) return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };

      if (actionType === 'plan_week_schedule_draft') {
        if (!generateWeekScheduleDraftFromCurrentData) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        if (pushAILogReminderUndoSnapshot) pushAILogReminderUndoSnapshot('plan_week_schedule_draft');
        const rangeType = ['this_week', 'next_week', 'rolling'].includes(String(action.rangeType || '').trim())
          ? String(action.rangeType || '').trim()
          : 'rolling';
        const dayCount = rangeType === 'rolling' ? clampTimeBlockDayCount(action.dayCount, 7) : 7;
        const result = Array.isArray(action.days) && action.days.length && applyExplicitWeekScheduleDraft
          ? applyExplicitWeekScheduleDraft(action.days, rangeType, dayCount)
          : generateWeekScheduleDraftFromCurrentData(rangeType, dayCount);
        if (!result || !result.added) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        return {
          handled: true,
          changed: true,
          appliedLabels: [`周计划草案：${result.startDate} 至 ${result.endDate}，新增 ${result.added} 个时间块`],
          createdItems: [
            { tab: 'routine', id: result.routineId, text: '统一日历' },
            {
              tab: 'weekTimeBlocks',
              id: genId(),
              text: `week-time-blocks-${result.startDate}`,
              startDate: result.startDate,
              endDate: result.endDate,
              rangeType: result.rangeType || rangeType,
              dayCount: result.dayCount || dayCount,
              days: Array.isArray(result.weekBlocks) ? result.weekBlocks : [],
            },
          ],
          actionRuntimeMeta: buildPlanningActionRuntimeMeta({
            transactionEligible: false,
            mutationLayer: 'draft',
          }),
        };
      }

      if (actionType === 'plan_today_time_blocks') {
        if (!generateTodayTimeBlocksDraftFromCurrentData) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const result = generateTodayTimeBlocksDraftFromCurrentData({
          customBlocks: Array.isArray(action.blocks) ? action.blocks : [],
        });
        const blocks = Array.isArray(result?.blocks) ? result.blocks : [];
        if (!blocks.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const allowWriteToDaily = (
          action.writeToDaily === true
          && (
            action.explicitWriteToDaily === true
            || action.target === 'daily'
            || userAskedWriteBlocksToDaily
          )
        );
        if (allowWriteToDaily && appendToTodayDailyLog) {
          const dailyText = formatTimeBlocksAsDailyText(result);
          if (dailyText) {
            if (pushAILogReminderUndoSnapshot) pushAILogReminderUndoSnapshot('plan_today_time_blocks');
            appendToTodayDailyLog(dailyText, { preferTodo: false });
          }
        }
        return {
          handled: true,
          changed: true,
          appliedLabels: [`今日时间块：${result.date}，新增 ${blocks.length} 个卡片`],
          createdItems: [{
            tab: 'timeBlocks',
            id: genId(),
            text: `time-blocks-${result.date}`,
            date: result.date,
            blocks,
          }],
          actionRuntimeMeta: buildPlanningActionRuntimeMeta({
            transactionEligible: allowWriteToDaily,
            mutationLayer: allowWriteToDaily ? 'canonical' : 'draft',
            actionResult: allowWriteToDaily
              ? {
                entity: 'daily_log_entry',
                targetDate: String(result?.date || '').trim(),
                dateStr: String(result?.date || '').trim(),
                updatedAt: new Date().toISOString(),
              }
              : null,
          }),
        };
      }

      return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
    }

    return {
      applyPlanningAction,
    };
  }

  window.MorphAIActionPlanningRuntime = {
    create: createAIActionPlanningRuntime,
  };
})();
