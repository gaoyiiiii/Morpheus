// @ts-check

(function initMorphAIActionReminderRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionReminderRuntime && typeof window.MorphAIActionReminderRuntime.create === 'function') return;

  function createAIActionReminderRuntime() {
    function applyReminderAction(type = '', actionPayload = {}, runtime = {}) {
      const actionType = String(type || '').trim();
      const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
      const ctx = runtime && typeof runtime === 'object' ? runtime : {};
      const normalizeReminderAction = typeof ctx.normalizeReminderAction === 'function' ? ctx.normalizeReminderAction : null;
      const promptReminderDatetimeSelection = typeof ctx.promptReminderDatetimeSelection === 'function' ? ctx.promptReminderDatetimeSelection : null;
      const getReminderList = typeof ctx.getReminderList === 'function' ? ctx.getReminderList : null;
      const findReminderIndexByActionRef = typeof ctx.findReminderIndexByActionRef === 'function' ? ctx.findReminderIndexByActionRef : null;
      const findReminderIndexesByActionRef = typeof ctx.findReminderIndexesByActionRef === 'function' ? ctx.findReminderIndexesByActionRef : null;
      const parseReminderDatetimeToEpoch = typeof ctx.parseReminderDatetimeToEpoch === 'function' ? ctx.parseReminderDatetimeToEpoch : null;
      const extractReminderDemandTextFromQuestion = typeof ctx.extractReminderDemandTextFromQuestion === 'function' ? ctx.extractReminderDemandTextFromQuestion : () => '';
      const reminderMonthKey = typeof ctx.reminderMonthKey === 'function' ? ctx.reminderMonthKey : () => '';
      const syncReminderBlocksIntoDailyMonth = typeof ctx.syncReminderBlocksIntoDailyMonth === 'function' ? ctx.syncReminderBlocksIntoDailyMonth : null;
      const scheduleReminderLanSync = typeof ctx.scheduleReminderLanSync === 'function' ? ctx.scheduleReminderLanSync : null;
      const scheduleReminderNativeIfPossible = typeof ctx.scheduleReminderNativeIfPossible === 'function' ? ctx.scheduleReminderNativeIfPossible : null;
      const cancelReminderNativeIfPossible = typeof ctx.cancelReminderNativeIfPossible === 'function' ? ctx.cancelReminderNativeIfPossible : null;
      const getCurrentNativePlatformForReminderNotifications = typeof ctx.getCurrentNativePlatformForReminderNotifications === 'function'
        ? ctx.getCurrentNativePlatformForReminderNotifications
        : null;
      const pushAILogReminderUndoSnapshot = typeof ctx.pushAILogReminderUndoSnapshot === 'function' ? ctx.pushAILogReminderUndoSnapshot : null;
      const saveSilent = typeof ctx.saveSilent === 'function' ? ctx.saveSilent : null;
      const commitPatchIntent = typeof ctx.commitPatchIntent === 'function'
        ? ctx.commitPatchIntent
        : (typeof ctx.commitMorphCoreMutation === 'function' ? ctx.commitMorphCoreMutation : null);
      const currentOwnerPlatform = String(getCurrentNativePlatformForReminderNotifications ? getCurrentNativePlatformForReminderNotifications() : '').trim().toLowerCase();
      const resolveReminderOwnerPlatform = (reminder = null) => {
        const explicitOwner = String(
          reminder?.notificationOwnerPlatform
          || reminder?.ownerPlatform
          || ''
        ).trim().toLowerCase();
        if (explicitOwner === 'ios' || explicitOwner === 'macos') return explicitOwner;
        if (currentOwnerPlatform === 'ios' || currentOwnerPlatform === 'macos') return currentOwnerPlatform;
        return '';
      };

      if (!actionType || !getReminderList) {
        return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
      }

      const reminders = getReminderList();

      const restoreReminderRuntimeFields = (reminder = null, snapshot = null) => {
        if (!reminder || typeof reminder !== 'object' || !snapshot || typeof snapshot !== 'object') return;
        const keys = ['nativeScheduled', 'nativeScheduleError', 'nativeScheduleErrorAt'];
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(snapshot, key)) reminder[key] = snapshot[key];
          else delete reminder[key];
        });
      };

      const persistReminderRuntimeState = (reminder = null, reason = '', snapshot = null) => {
        const reminderId = String(reminder?.id || '').trim();
        const committed = typeof commitPatchIntent === 'function'
          ? commitPatchIntent({
              changed: true,
              source: 'runtime',
              promptQuestion: '提醒原生调度状态刷新',
              actions: [{ type: 'runtime_refresh_reminder_native_state', reminderId, reason: String(reason || '').trim() }],
              actionTypes: ['runtime_refresh_reminder_native_state'],
              domains: ['reminders'],
              appliedLabels: ['提醒原生调度状态刷新'],
              detail: { reminderId, reason: String(reason || '').trim() },
              entityRefs: reminderId ? [{ domain: 'reminders', entityType: 'reminder', entityId: reminderId, action: 'upsert', label: String(reminder?.text || '').trim().slice(0, 40) }] : [],
              saveMode: 'silent',
              skipUndo: true,
              immediatePersist: true,
              saveSilent,
            })
          : null;
        if (!committed) {
          restoreReminderRuntimeFields(reminder, snapshot);
          return false;
        }
        return true;
      };

      if (actionType === 'add_reminder') {
        if (pushAILogReminderUndoSnapshot) pushAILogReminderUndoSnapshot('add_reminder');
        const reminder = (
          String(action.id || '').trim()
          && String(action.text || '').trim()
          && String(action.dueAtText || action.datetime || '').trim()
          && Number.isFinite(Number(action.dueAtMs || 0))
          && Number(action.dueAtMs || 0) > 0
        ) ? {
          id: String(action.id || '').trim(),
          text: String(action.text || '').trim(),
          requestText: String(action.requestText || action.text || '').trim(),
          dueAtText: String(action.dueAtText || action.datetime || '').trim(),
          dueAtMs: Number(action.dueAtMs || 0),
          timezone: String(action.timezone || 'Asia/Shanghai').trim() || 'Asia/Shanghai',
          createdAt: String(action.createdAt || '').trim() || new Date().toISOString(),
          updatedAt: String(action.updatedAt || '').trim() || new Date().toISOString(),
          status: String(action.status || 'pending').trim() || 'pending',
          source: String(action.source || 'ai').trim() || 'ai',
        } : (normalizeReminderAction ? normalizeReminderAction(action) : null);

        if (!reminder) {
          if (promptReminderDatetimeSelection) {
            const ownerPlatform = resolveReminderOwnerPlatform(action);
            promptReminderDatetimeSelection(ownerPlatform ? { ...action, notificationOwnerPlatform: ownerPlatform } : action);
          }
          return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        }
        const ownerPlatform = resolveReminderOwnerPlatform(reminder);
        if (ownerPlatform) reminder.notificationOwnerPlatform = ownerPlatform;

        const actionRuntimeMeta = {
          actionResult: {
            entity: 'reminder',
            entityId: reminder.id,
            targetDate: String(reminder.dueAtText || '').trim().slice(0, 10),
            updatedAt: String(reminder.updatedAt || '').trim() || new Date().toISOString(),
          },
        };

        reminders.push(reminder);
        reminders.sort((a, b) => Number(a?.dueAtMs || 0) - Number(b?.dueAtMs || 0));
        if (scheduleReminderLanSync) scheduleReminderLanSync('add_reminder');
        const monthKey = reminderMonthKey(reminder);
        if (monthKey && syncReminderBlocksIntoDailyMonth) syncReminderBlocksIntoDailyMonth(monthKey);
        if (scheduleReminderNativeIfPossible) {
          scheduleReminderNativeIfPossible(reminder).then((result) => {
            const beforeRuntimeState = {
              ...(Object.prototype.hasOwnProperty.call(reminder, 'nativeScheduled') ? { nativeScheduled: reminder.nativeScheduled } : {}),
              ...(Object.prototype.hasOwnProperty.call(reminder, 'nativeScheduleError') ? { nativeScheduleError: reminder.nativeScheduleError } : {}),
              ...(Object.prototype.hasOwnProperty.call(reminder, 'nativeScheduleErrorAt') ? { nativeScheduleErrorAt: reminder.nativeScheduleErrorAt } : {}),
            };
            if (result?.scheduled) {
              reminder.nativeScheduled = true;
              delete reminder.nativeScheduleError;
              delete reminder.nativeScheduleErrorAt;
              persistReminderRuntimeState(reminder, 'native_schedule_confirmed', beforeRuntimeState);
              return;
            }
            const reason = String(result?.reason || '').trim();
            if (reason) {
              reminder.nativeScheduleError = reason;
              reminder.nativeScheduleErrorAt = new Date().toISOString();
              persistReminderRuntimeState(reminder, 'native_schedule_error', beforeRuntimeState);
            }
          });
        }
        return {
          handled: true,
          changed: true,
          appliedLabels: [`提醒已设置：${reminder.dueAtText} ${String(reminder.text || '').slice(0, 24)}`],
          createdItems: [{ tab: 'reminders', id: reminder.id, text: reminder.text, dueAtText: reminder.dueAtText }],
          actionRuntimeMeta,
        };
      }

      if (actionType === 'delete_reminder') {
        const indexes = findReminderIndexesByActionRef
          ? findReminderIndexesByActionRef(action)
          : (findReminderIndexByActionRef ? [findReminderIndexByActionRef(action)].filter((idx) => idx >= 0) : []);
        if (!indexes.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };

        if (pushAILogReminderUndoSnapshot) pushAILogReminderUndoSnapshot('delete_reminder');
        const removedItems = [];
        Array.from(new Set(indexes))
          .sort((a, b) => b - a)
          .forEach((idx) => {
            if (!(idx >= 0 && idx < reminders.length)) return;
            const removed = reminders.splice(idx, 1)[0];
            if (removed) removedItems.unshift(removed);
          });
        if (!removedItems.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };

        if (scheduleReminderLanSync) scheduleReminderLanSync('delete_reminder');
        Array.from(new Set(removedItems.map((item) => reminderMonthKey(item)).filter(Boolean))).forEach((monthKey) => {
          if (syncReminderBlocksIntoDailyMonth) syncReminderBlocksIntoDailyMonth(monthKey);
        });
        removedItems.forEach((removed) => {
          if (cancelReminderNativeIfPossible) cancelReminderNativeIfPossible(removed?.id);
        });
        const removedPreview = String(removedItems[0]?.text || '').slice(0, 24);
        return {
          handled: true,
          changed: true,
          appliedLabels: [removedItems.length > 1 ? `删除提醒：${removedPreview} 等 ${removedItems.length} 条` : `删除提醒：${removedPreview}`],
          createdItems: removedItems.map((removed) => ({ tab: 'reminders', id: removed.id, text: removed.text, dueAtText: removed.dueAtText, removed: true })),
          actionRuntimeMeta: null,
        };
      }

      if (actionType === 'update_reminder') {
        if (!findReminderIndexByActionRef) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const idx = findReminderIndexByActionRef(action);
        if (idx < 0 || idx >= reminders.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        const target = reminders[idx];
        const oldMonthKey = reminderMonthKey(target);
        const nextText = String(action.newText || action.textNew || action.toText || '').trim();
        const datetimeRaw = [
          action.newDatetime,
          action.datetimeNew,
          action.toDatetime,
          action.datetime,
          action.dueAt,
          (action.newDate && action.newTime) ? `${action.newDate} ${action.newTime}` : '',
          (action.date && action.time) ? `${action.date} ${action.time}` : '',
          action.newTime,
          action.time,
        ].map((item) => String(item || '').trim()).find(Boolean) || '';
        const parsed = datetimeRaw && parseReminderDatetimeToEpoch ? parseReminderDatetimeToEpoch(datetimeRaw) : null;
        const shouldUpdateText = !!nextText;
        const shouldUpdateTime = !!parsed;
        if (!shouldUpdateText && !shouldUpdateTime) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };

        if (pushAILogReminderUndoSnapshot) pushAILogReminderUndoSnapshot('update_reminder');
        if (shouldUpdateText) {
          target.text = nextText;
          target.requestText = String(
            action.requestText
            || action.detailText
            || extractReminderDemandTextFromQuestion(action.rawQuestion || '')
            || nextText
          ).trim() || nextText;
        }
        if (shouldUpdateTime && parsed) {
          target.dueAtMs = parsed.epochMs;
          target.dueAtText = parsed.text;
        }
        const nextOwnerPlatform = resolveReminderOwnerPlatform(target);
        if (nextOwnerPlatform) target.notificationOwnerPlatform = nextOwnerPlatform;
        delete target.dailyLogDismissed;
        delete target.dailyLogDismissedAt;
        target.updatedAt = new Date().toISOString();
        reminders.sort((a, b) => Number(a?.dueAtMs || 0) - Number(b?.dueAtMs || 0));
        if (scheduleReminderLanSync) scheduleReminderLanSync('update_reminder');
        const nextMonthKey = reminderMonthKey(target);
        if (oldMonthKey && syncReminderBlocksIntoDailyMonth) syncReminderBlocksIntoDailyMonth(oldMonthKey);
        if (nextMonthKey && syncReminderBlocksIntoDailyMonth) syncReminderBlocksIntoDailyMonth(nextMonthKey);
        if (scheduleReminderNativeIfPossible) {
          scheduleReminderNativeIfPossible(target).then((result) => {
            const beforeRuntimeState = {
              ...(Object.prototype.hasOwnProperty.call(target, 'nativeScheduled') ? { nativeScheduled: target.nativeScheduled } : {}),
              ...(Object.prototype.hasOwnProperty.call(target, 'nativeScheduleError') ? { nativeScheduleError: target.nativeScheduleError } : {}),
              ...(Object.prototype.hasOwnProperty.call(target, 'nativeScheduleErrorAt') ? { nativeScheduleErrorAt: target.nativeScheduleErrorAt } : {}),
            };
            if (result?.scheduled) {
              target.nativeScheduled = true;
              delete target.nativeScheduleError;
              delete target.nativeScheduleErrorAt;
              persistReminderRuntimeState(target, 'native_schedule_confirmed', beforeRuntimeState);
              return;
            }
            const reason = String(result?.reason || '').trim();
            if (reason) {
              target.nativeScheduleError = reason;
              target.nativeScheduleErrorAt = new Date().toISOString();
              persistReminderRuntimeState(target, 'native_schedule_error', beforeRuntimeState);
            }
          });
        }
        return {
          handled: true,
          changed: true,
          appliedLabels: [`修改提醒：${String(target?.text || '').slice(0, 24)}`],
          createdItems: [],
          actionRuntimeMeta: null,
        };
      }

      return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
    }

    return {
      applyReminderAction,
    };
  }

  window.MorphAIActionReminderRuntime = {
    create: createAIActionReminderRuntime,
  };
})();
