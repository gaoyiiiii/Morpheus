(function initMorphTaskRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphTaskRuntime && typeof window.MorphTaskRuntime.create === 'function') return;

  function cloneJSONSafe(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return null;
    }
  }

  function buildDefaultTaskRuntimeState() {
    return {
      proactiveScan: {
        timerActive: false,
        running: false,
        lastRunAt: '',
        lastOutcome: '',
        lastReason: '',
      },
      reminderDispatch: {
        timerActive: false,
        running: false,
        lastRunAt: '',
        lastOutcome: '',
        lastReason: '',
      },
      reminderLanSync: {
        timerActive: false,
        running: false,
        queued: false,
        lastRunAt: '',
        lastOutcome: '',
        lastReason: '',
      },
      dailyAlign: {
        timerActive: false,
        running: false,
        lastRunAt: '',
        lastOutcome: '',
        lastReason: '',
      },
      reminderNativeRoutingState: null,
      futureAgentTasks: [],
      lastTaskEventAt: '',
      lastTaskEventKind: '',
      lastTaskEventMeta: null,
      lastUpdatedAt: '',
    };
  }

  function createTaskRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getAppState() {
      if (typeof api.getAppState === 'function') {
        const state = api.getAppState();
        if (state && typeof state === 'object') return state;
      }
      const state = window.__MorphAppStateRuntimeState;
      return state && typeof state === 'object' ? state : {};
    }

    function ensureTaskRuntimeState() {
      const appState = getAppState();
      if (!appState.taskRuntimeState || typeof appState.taskRuntimeState !== 'object') {
        appState.taskRuntimeState = buildDefaultTaskRuntimeState();
      }
      const defaults = buildDefaultTaskRuntimeState();
      ['proactiveScan', 'reminderDispatch', 'reminderLanSync', 'dailyAlign'].forEach((key) => {
        if (!appState.taskRuntimeState[key] || typeof appState.taskRuntimeState[key] !== 'object') {
          appState.taskRuntimeState[key] = defaults[key];
          return;
        }
        Object.keys(defaults[key]).forEach((field) => {
          if (!Object.prototype.hasOwnProperty.call(appState.taskRuntimeState[key], field)) {
            appState.taskRuntimeState[key][field] = defaults[key][field];
          }
        });
      });
      ['reminderNativeRoutingState', 'lastTaskEventAt', 'lastTaskEventKind', 'lastTaskEventMeta', 'lastUpdatedAt'].forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(appState.taskRuntimeState, key)) {
          appState.taskRuntimeState[key] = defaults[key];
        }
      });
      if (!Array.isArray(appState.taskRuntimeState.futureAgentTasks)) {
        appState.taskRuntimeState.futureAgentTasks = [];
      }
      return appState.taskRuntimeState;
    }

    function getBackgroundWorkflowRuntimeModules() {
      return typeof api.getBackgroundWorkflowRuntimeModules === 'function'
        ? api.getBackgroundWorkflowRuntimeModules()
        : null;
    }

    function syncBackgroundWorkflowState() {
      const state = ensureTaskRuntimeState();
      const runtime = getBackgroundWorkflowRuntimeModules();
      const snapshot = runtime && typeof runtime.getBackgroundWorkflowSchedulerState === 'function'
        ? runtime.getBackgroundWorkflowSchedulerState()
        : null;
      if (!snapshot || typeof snapshot !== 'object') return state;
      state.proactiveScan.timerActive = snapshot.proactiveAgentSchedulerActive === true;
      state.proactiveScan.running = snapshot.proactiveAgentRunning === true;
      state.reminderDispatch.timerActive = snapshot.reminderSchedulerActive === true;
      state.reminderDispatch.running = snapshot.reminderDispatchRunning === true;
      state.reminderLanSync.timerActive = snapshot.reminderLanSyncActive === true;
      state.reminderLanSync.running = snapshot.reminderLanSyncInFlight === true;
      state.reminderLanSync.queued = snapshot.reminderLanSyncQueued === true;
      state.dailyAlign.timerActive = snapshot.dailyAlignSchedulerActive === true;
      state.dailyAlign.running = snapshot.dailyAlignRunning === true;
      state.reminderNativeRoutingState = snapshot.reminderNativeRoutingState && typeof snapshot.reminderNativeRoutingState === 'object'
        ? cloneJSONSafe(snapshot.reminderNativeRoutingState) || null
        : null;
      state.lastUpdatedAt = new Date().toISOString();
      return state;
    }

    function recordTaskEvent(kind = '', meta = null) {
      const state = ensureTaskRuntimeState();
      state.lastTaskEventAt = new Date().toISOString();
      state.lastTaskEventKind = String(kind || '').trim();
      state.lastTaskEventMeta = meta && typeof meta === 'object' ? (cloneJSONSafe(meta) || null) : null;
      state.lastUpdatedAt = state.lastTaskEventAt;
      return state;
    }

    function stampTaskOutcome(taskKey, result = null) {
      const state = ensureTaskRuntimeState();
      const target = state[taskKey] && typeof state[taskKey] === 'object' ? state[taskKey] : null;
      if (!target) return state;
      const safe = result && typeof result === 'object' ? result : null;
      const ok = safe ? safe.ok === true || safe.findings > 0 || safe.changed === true : result === true;
      target.lastRunAt = new Date().toISOString();
      target.lastOutcome = ok ? 'ok' : 'blocked';
      target.lastReason = String(safe?.reason || '').trim();
      state.lastUpdatedAt = target.lastRunAt;
      return state;
    }

    function normalizeFutureAgentTask(task = {}) {
      const safe = task && typeof task === 'object' ? task : {};
      const id = String(safe.id || '').trim() || `future_task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        id,
        title: String(safe.title || safe.summary || safe.label || 'Future agent task').trim() || 'Future agent task',
        status: String(safe.status || 'pending').trim() || 'pending',
        source: String(safe.source || 'future-agent').trim() || 'future-agent',
        createdAt: String(safe.createdAt || new Date().toISOString()).trim() || new Date().toISOString(),
        scheduledAt: String(safe.scheduledAt || '').trim(),
        meta: safe.meta && typeof safe.meta === 'object' ? (cloneJSONSafe(safe.meta) || null) : null,
      };
    }

    function listFutureAgentTasks() {
      const state = ensureTaskRuntimeState();
      return state.futureAgentTasks.map((item) => cloneJSONSafe(item) || item);
    }

    function upsertFutureAgentTask(task = {}) {
      const state = ensureTaskRuntimeState();
      const next = normalizeFutureAgentTask(task);
      const index = state.futureAgentTasks.findIndex((item) => String(item?.id || '').trim() === next.id);
      if (index >= 0) state.futureAgentTasks[index] = next;
      else state.futureAgentTasks.push(next);
      recordTaskEvent('future-agent-task:upsert', { id: next.id, status: next.status, source: next.source });
      return next;
    }

    function removeFutureAgentTask(id = '') {
      const state = ensureTaskRuntimeState();
      const targetId = String(id || '').trim();
      if (!targetId) return false;
      const before = state.futureAgentTasks.length;
      state.futureAgentTasks = state.futureAgentTasks.filter((item) => String(item?.id || '').trim() !== targetId);
      if (state.futureAgentTasks.length !== before) {
        recordTaskEvent('future-agent-task:remove', { id: targetId });
        return true;
      }
      return false;
    }

    function delegateToBackgroundWorkflow(methodName, args = [], fallbackValue = undefined, eventKind = '', eventMeta = null) {
      recordTaskEvent(eventKind || methodName, eventMeta);
      syncBackgroundWorkflowState();
      const runtime = getBackgroundWorkflowRuntimeModules();
      if (!runtime || typeof runtime[methodName] !== 'function') return fallbackValue;
      try {
        const result = runtime[methodName](...(Array.isArray(args) ? args : []));
        if (result && typeof result.then === 'function') {
          return result.finally(() => {
            syncBackgroundWorkflowState();
          });
        }
        syncBackgroundWorkflowState();
        return result;
      } catch (error) {
        syncBackgroundWorkflowState();
        throw error;
      }
    }

    function getTaskRuntimeState() {
      return syncBackgroundWorkflowState();
    }

    function getRegisteredTaskDescriptors() {
      return [
        { id: 'proactiveScan', runner: 'runProactiveAgentScan', tick: 'proactiveAgentSchedulerTick', restart: 'restartProactiveAgentScheduler' },
        { id: 'reminderDispatch', runner: 'dispatchDueReminders', tick: 'reminderSchedulerTick', restart: 'restartReminderScheduler' },
        { id: 'reminderLanSync', runner: 'runReminderLanSyncOnce', schedule: 'scheduleReminderLanSync', restart: 'restartReminderLanSyncScheduler' },
        { id: 'dailyAlign', runner: 'runScheduledDailyAlign', tick: 'dailyAlignSchedulerTick', restart: 'restartDailyAlignScheduler' },
      ];
    }

    return {
      buildDefaultTaskRuntimeState,
      ensureTaskRuntimeState,
      syncBackgroundWorkflowState,
      getTaskRuntimeState,
      getRegisteredTaskDescriptors,
      listFutureAgentTasks,
      upsertFutureAgentTask,
      removeFutureAgentTask,
      runProactiveAgentScan(options = {}) {
        const result = delegateToBackgroundWorkflow('runProactiveAgentScan', [options], { ok: false, reason: 'runtime_unavailable' }, 'proactive-scan', options);
        if (result && typeof result.then === 'function') {
          return result.then((value) => {
            stampTaskOutcome('proactiveScan', value);
            return value;
          });
        }
        stampTaskOutcome('proactiveScan', result);
        return result;
      },
      proactiveAgentSchedulerTick() {
        return delegateToBackgroundWorkflow('proactiveAgentSchedulerTick', [], undefined, 'proactive-heartbeat');
      },
      restartProactiveAgentScheduler() {
        return delegateToBackgroundWorkflow('restartProactiveAgentScheduler', [], undefined, 'proactive-restart');
      },
      dispatchDueReminders() {
        const result = delegateToBackgroundWorkflow('dispatchDueReminders', [], false, 'reminder-dispatch');
        if (result && typeof result.then === 'function') {
          return result.then((value) => {
            stampTaskOutcome('reminderDispatch', value);
            return value;
          });
        }
        stampTaskOutcome('reminderDispatch', result);
        return result;
      },
      reminderSchedulerTick() {
        return delegateToBackgroundWorkflow('reminderSchedulerTick', [], undefined, 'reminder-tick');
      },
      restartReminderScheduler() {
        return delegateToBackgroundWorkflow('restartReminderScheduler', [], undefined, 'reminder-restart');
      },
      isLikelySharedReminderSyncRootPath(path = '') {
        return delegateToBackgroundWorkflow('isLikelySharedReminderSyncRootPath', [path], false, 'reminder-routing:probe', { path: String(path || '').trim() });
      },
      getCurrentNativePlatformForReminderNotifications() {
        return delegateToBackgroundWorkflow('getCurrentNativePlatformForReminderNotifications', [], '', 'reminder-routing:platform');
      },
      getReminderNotificationRoutingState() {
        return delegateToBackgroundWorkflow('getReminderNotificationRoutingState', [], null, 'reminder-routing:state');
      },
      scheduleReminderNativeIfPossible(reminder) {
        return delegateToBackgroundWorkflow('scheduleReminderNativeIfPossible', [reminder], false, 'reminder-native:schedule', { id: String(reminder?.id || '').trim() });
      },
      cancelReminderNativeIfPossible(reminderId = '') {
        return delegateToBackgroundWorkflow('cancelReminderNativeIfPossible', [reminderId], false, 'reminder-native:cancel', { id: String(reminderId || '').trim() });
      },
      reconcileNativeReminderSchedules(reminders = []) {
        return delegateToBackgroundWorkflow('reconcileNativeReminderSchedules', [reminders], false, 'reminder-native:reconcile', { count: Array.isArray(reminders) ? reminders.length : 0 });
      },
      ensureNativeSchedulesForPendingReminders() {
        return delegateToBackgroundWorkflow('ensureNativeSchedulesForPendingReminders', [], undefined, 'reminder-native:ensure');
      },
      handleNativeReminderEvent(payload = {}) {
        return delegateToBackgroundWorkflow('handleNativeReminderEvent', [payload], false, 'reminder-native:event', {
          id: String(payload?.reminderId || payload?.id || '').trim(),
          event: String(payload?.event || payload?.type || '').trim(),
        });
      },
      normalizeReminderForSync(item = {}) {
        return delegateToBackgroundWorkflow('normalizeReminderForSync', [item], null, 'reminder-sync:normalize');
      },
      reminderSyncStampMs(item = null) {
        return delegateToBackgroundWorkflow('reminderSyncStampMs', [item], 0, 'reminder-sync:stamp');
      },
      mergeReminderSnapshot(localList = [], remoteList = []) {
        return delegateToBackgroundWorkflow('mergeReminderSnapshot', [localList, remoteList], [], 'reminder-sync:merge', {
          local: Array.isArray(localList) ? localList.length : 0,
          remote: Array.isArray(remoteList) ? remoteList.length : 0,
        });
      },
      applyReminderSyncList(remoteList = []) {
        return delegateToBackgroundWorkflow('applyReminderSyncList', [remoteList], false, 'reminder-sync:apply', {
          remote: Array.isArray(remoteList) ? remoteList.length : 0,
        });
      },
      runReminderLanSyncOnce(options = {}) {
        const result = delegateToBackgroundWorkflow('runReminderLanSyncOnce', [options], false, 'reminder-lan-sync:run', options);
        if (result && typeof result.then === 'function') {
          return result.then((value) => {
            stampTaskOutcome('reminderLanSync', value);
            return value;
          });
        }
        stampTaskOutcome('reminderLanSync', result);
        return result;
      },
      scheduleReminderLanSync(reason = 'update') {
        return delegateToBackgroundWorkflow('scheduleReminderLanSync', [reason], undefined, 'reminder-lan-sync:schedule', { reason: String(reason || '').trim() });
      },
      restartReminderLanSyncScheduler() {
        return delegateToBackgroundWorkflow('restartReminderLanSyncScheduler', [], undefined, 'reminder-lan-sync:restart');
      },
      runScheduledDailyAlign() {
        const result = delegateToBackgroundWorkflow('runScheduledDailyAlign', [], { ok: false, reason: 'runtime_unavailable' }, 'daily-align:run');
        if (result && typeof result.then === 'function') {
          return result.then((value) => {
            stampTaskOutcome('dailyAlign', value);
            return value;
          });
        }
        stampTaskOutcome('dailyAlign', result);
        return result;
      },
      dailyAlignSchedulerTick() {
        return delegateToBackgroundWorkflow('dailyAlignSchedulerTick', [], undefined, 'daily-align:tick');
      },
      restartDailyAlignScheduler() {
        return delegateToBackgroundWorkflow('restartDailyAlignScheduler', [], undefined, 'daily-align:restart');
      },
    };
  }

  window.MorphTaskRuntime = { create: createTaskRuntime };
})();
