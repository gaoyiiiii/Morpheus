(function initMorphBackgroundWorkflowRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphBackgroundWorkflowRuntime && typeof window.MorphBackgroundWorkflowRuntime.create === 'function';
  const hasDepsRuntime = window.MorphBackgroundWorkflowDepsRuntime && typeof window.MorphBackgroundWorkflowDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createBackgroundWorkflowRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    let proactiveAgentSchedulerTimer = null;
    let proactiveAgentRunning = false;
    let reminderSchedulerTimer = null;
    let reminderDispatchRunning = false;
    let reminderNativeReconcileRunning = false;
    let reminderLanSyncTimer = null;
    let reminderLanSyncInFlight = false;
    let reminderLanSyncQueued = false;
    let reminderLanSyncWarned = false;
    let dailyAlignSchedulerTimer = null;
    let dailyAlignRunning = false;
    const REMINDER_NOTIFICATION_OWNER_PLATFORM = 'ios';
    const REMINDER_SHARED_REPLICA_FALLBACK_GRACE_MS = 2 * 60 * 1000;
    const REMINDER_DESKTOP_NATIVE_DELIVERY_GRACE_MS = 30 * 1000;

    function commitReminderPatchIntent(options = {}) {
      const commit = typeof api.commitPatchIntent === 'function'
        ? api.commitPatchIntent
        : (typeof api.commitMorphCoreMutation === 'function' ? api.commitMorphCoreMutation : null);
      if (typeof commit === 'function') return commit(options);
      return null;
    }

    function restoreReminderRuntimeFields(reminder = null, snapshot = null) {
      if (!reminder || typeof reminder !== 'object' || !snapshot || typeof snapshot !== 'object') return;
      ['nativeScheduled', 'nativeScheduleError', 'nativeScheduleErrorAt'].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(snapshot, key)) reminder[key] = snapshot[key];
        else delete reminder[key];
      });
    }

    function restoreReminderSnapshot(reminder = null, snapshot = null) {
      if (!reminder || typeof reminder !== 'object' || !snapshot || typeof snapshot !== 'object') return;
      Object.keys(reminder).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(snapshot, key)) delete reminder[key];
      });
      Object.keys(snapshot).forEach((key) => {
        reminder[key] = snapshot[key];
      });
    }

    function getDocumentRef() {
      return api.documentRef || (typeof document !== 'undefined' ? document : null);
    }

    function getCurrentTab() {
      return typeof api.getCurrentTab === 'function' ? String(api.getCurrentTab() || '').trim() : '';
    }

    function getAIChatState() {
      return typeof api.getAIChatState === 'function' ? (api.getAIChatState() || {}) : {};
    }

    function getDailyAlignEnabled() {
      return typeof api.getDailyAlignEnabled === 'function' ? api.getDailyAlignEnabled() === true : false;
    }

    function getDailyAlignTime() {
      return typeof api.getDailyAlignTime === 'function' ? String(api.getDailyAlignTime() || '').trim() : '08:00';
    }

    function getDailyAlignPrompt() {
      return typeof api.getDailyAlignPrompt === 'function' ? String(api.getDailyAlignPrompt() || '').trim() : '';
    }

    function getDailyAlignDefaultPrompt() {
      return typeof api.getDailyAlignDefaultPrompt === 'function' ? String(api.getDailyAlignDefaultPrompt() || '').trim() : '';
    }

    function getDailyAlignLastRunDate() {
      return typeof api.getDailyAlignLastRunDate === 'function' ? String(api.getDailyAlignLastRunDate() || '').trim() : '';
    }

    function getCurrentAIKey() {
      return typeof api.getCurrentAIKey === 'function' ? String(api.getCurrentAIKey() || '').trim() : '';
    }

    function setDailyAlignLastRunDate(value) {
      if (typeof api.setDailyAlignLastRunDate === 'function') {
        api.setDailyAlignLastRunDate(value);
      }
    }

    function parseDailyAlignTimeToMinutes(value = '') {
      if (typeof api.parseDailyAlignTimeToMinutes === 'function') {
        return api.parseDailyAlignTimeToMinutes(value);
      }
      const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return 8 * 60;
      const hours = Math.max(0, Math.min(23, Number(match[1]) || 0));
      const minutes = Math.max(0, Math.min(59, Number(match[2]) || 0));
      return hours * 60 + minutes;
    }

    function todayDateKeyLocal() {
      if (typeof api.todayDateKeyLocal === 'function') {
        return String(api.todayDateKeyLocal() || '').trim();
      }
      const parts = typeof api.getDatePartsInTimezone === 'function'
        ? api.getDatePartsInTimezone(new Date(), typeof api.getAITimezone === 'function' ? api.getAITimezone() : 'Asia/Shanghai')
        : null;
      if (!parts) return '';
      return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    }

    function getDatePartsInTimezone(input = new Date()) {
      if (typeof api.getDatePartsInTimezone === 'function') {
        return api.getDatePartsInTimezone(input, typeof api.getAITimezone === 'function' ? api.getAITimezone() : 'Asia/Shanghai');
      }
      const date = input instanceof Date ? input : new Date(input);
      if (Number.isNaN(date.getTime())) return null;
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {});
      return {
        year: Number(parts.year || 0),
        month: Number(parts.month || 0),
        day: Number(parts.day || 0),
        hour: Number(parts.hour || 0),
        minute: Number(parts.minute || 0),
        second: Number(parts.second || 0),
      };
    }

    function parseClockToMinutesHHMM(value = '') {
      const matched = String(value || '').trim().match(/^(\d{1,2}):(\d{1,2})$/);
      if (!matched) return null;
      const hour = Math.max(0, Math.min(23, Number(matched[1])));
      const minute = Math.max(0, Math.min(59, Number(matched[2])));
      return hour * 60 + minute;
    }

    function isNowWithinQuietHours(now = new Date(), startHHMM = '', endHHMM = '') {
      if (typeof api.isNowWithinQuietHours === 'function') {
        return api.isNowWithinQuietHours(now, startHHMM, endHHMM);
      }
      const start = parseClockToMinutesHHMM(startHHMM);
      const end = parseClockToMinutesHHMM(endHHMM);
      const parts = getDatePartsInTimezone(now);
      if (start === null || end === null || !parts) return false;
      const current = parts.hour * 60 + parts.minute;
      if (start === end) return false;
      if (start < end) return current >= start && current < end;
      return current >= start || current < end;
    }

    function shouldTriggerDailyAlignNow(now = new Date()) {
      if (!getDailyAlignEnabled()) return false;
      const todayKey = todayDateKeyLocal();
      if (getDailyAlignLastRunDate() === todayKey) return false;
      const targetMinutes = parseDailyAlignTimeToMinutes(getDailyAlignTime());
      const parts = getDatePartsInTimezone(now);
      if (!parts) return false;
      const currentMinutes = parts.hour * 60 + parts.minute;
      return currentMinutes >= targetMinutes;
    }

    async function runScheduledDailyAlign() {
      if (dailyAlignRunning) return { ok: false, reason: 'running' };
      if (getAIChatState().busy) return { ok: false, reason: 'ai_busy' };
      if (!getCurrentAIKey()) return { ok: false, reason: 'missing_ai_key' };
      dailyAlignRunning = true;
      const prompt = String(getDailyAlignPrompt() || getDailyAlignDefaultPrompt() || '').trim() || '请和我对齐今天任务：结合我的日志、项目与待办，给出今天最重要的3件事、建议时间块，以及第一步马上做什么。';
      const todayKey = todayDateKeyLocal();
      try {
        const res = typeof api.executeAICommandWithQuestion === 'function'
          ? await api.executeAICommandWithQuestion(prompt, { recordChat: true })
          : { ok: false, reason: 'runtime_unavailable' };
        if (res?.ok) {
          setDailyAlignLastRunDate(todayKey);
          const summary = String(res.reply || '').replace(/\s+/g, ' ').trim();
          await sendLocalNotification(
            'Morpheus 每日任务对齐已完成',
            summary ? summary.slice(0, 120) : '已生成今日优先事项。'
          );
          return { ok: true, reply: res.reply || '', summary };
        }
        await sendLocalNotification('Morpheus 每日任务对齐未完成', '请打开应用查看并手动重试。');
        return { ok: false, reason: 'ai_failed' };
      } catch (_) {
        await sendLocalNotification('Morpheus 每日任务对齐失败', '请检查 AI 密钥或网络连接后重试。');
        return { ok: false, reason: 'exception' };
      } finally {
        dailyAlignRunning = false;
        if (getCurrentTab() === 'settings' && typeof api.renderSettingsView === 'function') {
          api.renderSettingsView();
        }
      }
    }

    function dailyAlignSchedulerTick() {
      if (!shouldTriggerDailyAlignNow(new Date())) return;
      runScheduledDailyAlign();
    }

    function restartDailyAlignScheduler() {
      if (dailyAlignSchedulerTimer) {
        clearInterval(dailyAlignSchedulerTimer);
        dailyAlignSchedulerTimer = null;
      }
      dailyAlignSchedulerTimer = setInterval(dailyAlignSchedulerTick, 30 * 1000);
      setTimeout(dailyAlignSchedulerTick, 1500);
    }

    function normalizeNotificationDeliveryResult(result, fallbackReason = '') {
      const reason = String(fallbackReason || '').trim();
      if (result && typeof result === 'object') {
        if (Object.prototype.hasOwnProperty.call(result, 'notified')) {
          return {
            delivered: result.notified === true,
            reason: String(result.reason || reason).trim(),
          };
        }
        if (Object.prototype.hasOwnProperty.call(result, 'delivered')) {
          return {
            delivered: result.delivered === true,
            reason: String(result.reason || reason).trim(),
          };
        }
      }
      if (result === false) {
        return {
          delivered: false,
          reason: reason || 'notify_failed',
        };
      }
      return {
        delivered: true,
        reason: '',
      };
    }

    async function sendLocalNotificationDetailed(title, body) {
      if (typeof api.sendLocalNotification === 'function') {
        try {
          const result = await api.sendLocalNotification(title, body);
          return normalizeNotificationDeliveryResult(result);
        } catch (error) {
          return normalizeNotificationDeliveryResult(false, error?.message || 'notify_failed');
        }
      }
      const notifyTitle = String(title || 'Morpheus 通知').trim();
      const notifyBody = String(body || '').trim();
      if (typeof api.hasNativeControlBridge === 'function' && api.hasNativeControlBridge()) {
        try {
          if (typeof api.callNativeDesktopControl === 'function') {
            const nativeResult = await api.callNativeDesktopControl('notify', { title: notifyTitle, body: notifyBody });
            return normalizeNotificationDeliveryResult(nativeResult);
          }
        } catch (error) {
          return normalizeNotificationDeliveryResult(false, error?.message || 'notify_failed');
        }
      }
      if (typeof Notification === 'undefined') return normalizeNotificationDeliveryResult(false, 'notification_api_unavailable');
      try {
        if (Notification.permission !== 'granted') {
          if (Notification.permission === 'denied') return normalizeNotificationDeliveryResult(false, 'notification_permission_denied');
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return normalizeNotificationDeliveryResult(false, 'notification_permission_denied');
        }
        new Notification(notifyTitle, { body: notifyBody });
        return normalizeNotificationDeliveryResult(true);
      } catch (_) {}
      return normalizeNotificationDeliveryResult(false, 'notification_api_failed');
    }

    async function sendLocalNotification(title, body) {
      const result = await sendLocalNotificationDetailed(title, body);
      return result.delivered === true;
    }

    function surfaceInAppReminderFallback(reminder, body = '', reason = '') {
      const doc = getDocumentRef();
      if (!doc || doc.visibilityState === 'hidden') return false;
      if (typeof api.openCustomModal !== 'function') return false;
      const reminderText = String(reminder?.text || '').trim();
      const descBody = String(body || reminderText || '你有一个提醒').trim();
      const normalizedReason = String(reason || '').trim();
      const usePermissionCopy = /permission|alert_disabled|notification_center_disabled/i.test(normalizedReason);
      const extra = usePermissionCopy
        ? '系统通知当前不可用，这次先改为应用内提醒。你可以稍后在桌面系统设置里检查 Morpheus 的通知权限。'
        : '系统通知这次没有成功弹出，这次先改为应用内提醒。';
      api.openCustomModal({
        title: '提醒时间到了',
        desc: `${descBody}\n\n${extra}`,
      });
      return true;
    }

    function maybeSurfaceInAppReminderForNativeReconcile(reminder, payload = {}) {
      if (!reminder || typeof reminder !== 'object') return false;
      const eventName = String(payload?.event || '').trim().toLowerCase();
      const reason = String(payload?.reason || '').trim().toLowerCase();
      if (eventName !== 'native-reconcile' && reason !== 'native-reconcile') return false;
      if (typeof api.hasLocalReminderAck === 'function' && api.hasLocalReminderAck(reminder.id)) return false;
      const bodyText = buildReminderNotificationBody(reminder);
      return surfaceInAppReminderFallback(reminder, bodyText, 'native_reconcile_visibility_gap');
    }

    function shouldQueueProactiveReminderForChat(source = 'scheduler') {
      if (source === 'ai-action') return false;
      const aiChatState = getAIChatState();
      if (aiChatState?.busy) return true;
      if (getCurrentTab() !== 'ai') return false;
      return Array.isArray(aiChatState?.messages) && aiChatState.messages.length > 0;
    }

    function canNotifyProactiveFinding(state, key, nowMs, config) {
      const cooldownMap = state?.issueCooldowns || {};
      const lastItemMs = Number(cooldownMap[key] || 0);
      const baseGapMs = Number(config?.minNotifyGapMinutes || 18) * 60 * 1000;
      const minGapMs = String(key || '').startsWith('memory_reconfirm_')
        ? Math.max(baseGapMs, 12 * 60 * 60 * 1000)
        : baseGapMs;
      if (Number.isFinite(lastItemMs) && lastItemMs > 0 && nowMs - lastItemMs < minGapMs) return false;
      const lastNotifyMs = Date.parse(String(state?.lastNotifiedAt || ''));
      if (Number.isFinite(lastNotifyMs) && lastNotifyMs > 0 && nowMs - lastNotifyMs < minGapMs) return false;
      return true;
    }

    function trimProactiveIssueCooldowns(state, nowMs) {
      const map = state?.issueCooldowns || {};
      const expiryMs = 7 * 24 * 60 * 60 * 1000;
      const next = {};
      Object.entries(map).forEach(([key, ts]) => {
        const value = Number(ts);
        if (!Number.isFinite(value) || value <= 0) return;
        if (nowMs - value > expiryMs) return;
        next[key] = value;
      });
      if (state && typeof state === 'object') {
        state.issueCooldowns = next;
      }
    }

    function isReminderProactiveFinding(item) {
      const key = String(item?.key || '');
      return key.startsWith('reminder_');
    }

    async function runProactiveAgentScan({ force = false, source = 'scheduler' } = {}) {
      const runtime = typeof api.getMorphRuntimeBundle === 'function' ? api.getMorphRuntimeBundle() : {};
      const config = typeof api.sanitizeMorphProactiveAgentConfig === 'function'
        ? api.sanitizeMorphProactiveAgentConfig(runtime.skills?.proactiveAgent)
        : (runtime.skills?.proactiveAgent || {});
      if (!config.enabled && !force) return { ok: false, reason: 'disabled' };
      if (proactiveAgentRunning) return { ok: false, reason: 'running' };
      const aiChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
      if (aiChatState?.busy && !force) return { ok: false, reason: 'ai_busy' };
      const doc = getDocumentRef();
      if (!config.runWhenHidden && doc?.visibilityState === 'hidden' && !force) return { ok: false, reason: 'hidden' };
      const now = new Date();
      if (!force && isNowWithinQuietHours(now, config.quietHoursStart, config.quietHoursEnd)) {
        return { ok: false, reason: 'quiet_hours' };
      }
      proactiveAgentRunning = true;
      try {
        const state = typeof api.getMorphRuntimeAgentState === 'function' ? api.getMorphRuntimeAgentState() : {};
        const nowMs = now.getTime();
        const findings = typeof api.buildProactiveAgentFindings === 'function'
          ? api.buildProactiveAgentFindings(now, config, source)
          : [];
        const filtered = force
          ? findings
          : findings.filter((item) => (typeof api.canNotifyProactiveFinding === 'function'
            ? api.canNotifyProactiveFinding(state, item.key, nowMs, config)
            : canNotifyProactiveFinding(state, item.key, nowMs, config)));
        state.lastHeartbeatAt = now.toISOString();
        if (typeof api.trimProactiveIssueCooldowns === 'function') {
          api.trimProactiveIssueCooldowns(state, nowMs);
        } else {
          trimProactiveIssueCooldowns(state, nowMs);
        }
        if (!filtered.length) {
          api.recordMorphProactiveDecisionReceipt?.({
            source,
            findingKeys: [],
            findingCount: 0,
            surfaceDecision: 'skip',
            persistenceDecision: 'skip',
            note: 'no_findings',
          });
          api.recordMorphInternalDecisionTrace?.({
            kind: 'proactive',
            source,
            summary: '本轮主动巡检没有发现值得推进的问题。',
            proactiveSurfaceDecision: 'skip',
            proactivePersistenceDecision: 'skip',
            notes: ['no_findings'],
          });
          api.saveSilent?.({ skipUndo: true });
          return { ok: true, reason: 'no_findings' };
        }
        api.recordMorphProactiveFindingLog?.(filtered, source);
        filtered.forEach((item) => {
          if (!state.issueCooldowns || typeof state.issueCooldowns !== 'object') state.issueCooldowns = {};
          state.issueCooldowns[item.key] = nowMs;
        });
        state.lastNotifiedAt = now.toISOString();
        const summary = typeof api.formatProactiveDigest === 'function'
          ? api.formatProactiveDigest(filtered, now, source)
          : '';
        state.history = Array.isArray(state.history) ? state.history : [];
        state.history.push({
          at: state.lastNotifiedAt,
          summary: String(summary || '').slice(0, 280),
          source: String(source || '').slice(0, 40),
        });
        if (state.history.length > 60) state.history = state.history.slice(-60);
        const chatFindings = filtered.filter((item) => !(typeof api.isReminderProactiveFinding === 'function'
          ? api.isReminderProactiveFinding(item)
          : isReminderProactiveFinding(item)));
        const internalProactiveGuidance = typeof api.buildMorphInternalProactiveGuidanceRuntime === 'function'
          ? api.buildMorphInternalProactiveGuidanceRuntime(chatFindings, source)
          : { dominantMode: '', actionBias: '', notes: [] };
        const shouldQueueReminder = chatFindings.length && (typeof api.shouldQueueProactiveReminderForChat === 'function'
          ? api.shouldQueueProactiveReminderForChat(source)
          : shouldQueueProactiveReminderForChat(source));
        const shouldSurfaceToChat = chatFindings.length && !shouldQueueReminder && (typeof api.shouldSurfaceProactiveDigestRuntime === 'function'
          ? api.shouldSurfaceProactiveDigestRuntime(chatFindings, source, config, internalProactiveGuidance)
          : false);
        const shouldPersistToMemory = chatFindings.length && (typeof api.shouldPersistProactiveDigestToInteractionMemoryRuntime === 'function'
          ? api.shouldPersistProactiveDigestToInteractionMemoryRuntime(chatFindings, source, config, internalProactiveGuidance)
          : false);
        api.recordMorphProactiveDecisionReceipt?.({
          source,
          findingKeys: filtered.map((item) => String(item?.key || '').trim()).filter(Boolean).slice(0, 8),
          findingCount: filtered.length,
          surfaceDecision: shouldQueueReminder ? 'queue' : shouldSurfaceToChat ? 'surface' : 'skip',
          persistenceDecision: shouldPersistToMemory ? 'persist' : 'skip',
          note: chatFindings.length
            ? (shouldQueueReminder ? 'queued_as_carryover' : shouldSurfaceToChat ? 'surfaced_to_chat' : 'kept_background')
            : 'reminder_only',
        });
        api.recordMorphInternalDecisionTrace?.({
          kind: 'proactive',
          source,
          summary: chatFindings.length
            ? `主动巡检评估了 ${chatFindings.length} 条候选，${shouldQueueReminder ? '先转成轻提醒' : shouldSurfaceToChat ? '允许进聊天' : '继续留在后台'}。`
            : '本轮巡检只有提醒类事项，没有进入聊天候选。',
          proactiveSurfaceDecision: shouldQueueReminder ? 'queue' : shouldSurfaceToChat ? 'surface' : 'skip',
          proactivePersistenceDecision: shouldPersistToMemory ? 'persist' : 'skip',
          dominantMode: String(internalProactiveGuidance?.dominantMode || ''),
          actionBias: String(internalProactiveGuidance?.actionBias || ''),
          findingKeys: chatFindings.map((item) => String(item?.key || '').trim()).filter(Boolean).slice(0, 6),
          notes: Array.isArray(internalProactiveGuidance?.notes) ? internalProactiveGuidance.notes : [],
        });
        if (shouldQueueReminder) {
          if (typeof api.queuePendingProactiveReminder === 'function' && typeof api.buildProactiveCarryoverReminder === 'function') {
            if (api.queuePendingProactiveReminder(api.buildProactiveCarryoverReminder(chatFindings, now, source))) {
              api.saveSilent?.({ skipUndo: true });
            }
          }
        } else if (shouldSurfaceToChat) {
          const chatSummary = typeof api.formatProactiveDigest === 'function'
            ? api.formatProactiveDigest(chatFindings, now, source)
            : '';
          api.pushAIChatMessage?.('assistant', chatSummary, {
            actions: ['提醒'],
            sources: ['runtime/proactive-agent'],
          }, { flushNow: true, syncData: true });
          const notifyCopy = typeof api.buildProactiveNotificationCopyRuntime === 'function'
            ? api.buildProactiveNotificationCopyRuntime(chatFindings, now)
            : null;
          if (notifyCopy && source !== 'ai-action') {
            await sendLocalNotification(notifyCopy.title, notifyCopy.body);
          }
        }
        if (shouldPersistToMemory) {
          const chatSummary = typeof api.formatProactiveDigest === 'function'
            ? api.formatProactiveDigest(chatFindings, now, source)
            : '';
          api.appendAIInteractionMemory?.('runtime:proactive_scan', chatSummary, ['提醒']);
        }
        api.saveSilent?.({ skipUndo: true });
        return { ok: true, findings: filtered.length };
      } finally {
        proactiveAgentRunning = false;
      }
    }

    function proactiveAgentSchedulerTick() {
      const runtime = typeof api.getMorphRuntimeBundle === 'function' ? api.getMorphRuntimeBundle() : {};
      const config = typeof api.sanitizeMorphProactiveAgentConfig === 'function'
        ? api.sanitizeMorphProactiveAgentConfig(runtime.skills?.proactiveAgent)
        : (runtime.skills?.proactiveAgent || {});
      if (!config.enabled) return;
      const state = typeof api.getMorphRuntimeAgentState === 'function' ? api.getMorphRuntimeAgentState() : {};
      const nowMs = Date.now();
      const lastHeartbeatMs = Date.parse(String(state.lastHeartbeatAt || ''));
      const heartbeatMs = Math.max(1, Number(config.heartbeatMinutes || 5)) * 60 * 1000;
      const shouldRun = !Number.isFinite(lastHeartbeatMs) || lastHeartbeatMs <= 0 || nowMs - lastHeartbeatMs >= heartbeatMs;
      if (!shouldRun) return;
      runProactiveAgentScan({ force: false, source: 'heartbeat' });
    }

    function restartProactiveAgentScheduler() {
      if (proactiveAgentSchedulerTimer) {
        clearInterval(proactiveAgentSchedulerTimer);
        proactiveAgentSchedulerTimer = null;
      }
      proactiveAgentSchedulerTimer = setInterval(proactiveAgentSchedulerTick, 25 * 1000);
      setTimeout(proactiveAgentSchedulerTick, 1800);
    }

    async function dispatchDueReminders() {
      if (reminderDispatchRunning) return;
      reminderDispatchRunning = true;
      try {
        const routing = getReminderNotificationRoutingState();
        if (routing.suppressReplicaNotifications && !routing.allowReplicaFallback) return;
        const reminders = typeof api.getReminderList === 'function' ? api.getReminderList() : [];
        const nowMs = Date.now();
        const dueItems = reminders.filter((item) => {
          if (!item || typeof item !== 'object') return false;
          if (String(item.status || 'pending') !== 'pending') return false;
          if (typeof api.hasLocalReminderAck === 'function' && api.hasLocalReminderAck(item.id)) return false;
          const dueAtMs = Number(item.dueAtMs);
          if (!Number.isFinite(dueAtMs)) return false;
          if (dueAtMs > nowMs) return false;
          const hasNativeBridge = typeof api.hasNativeControlBridge === 'function' && api.hasNativeControlBridge();
          const hasLocalNativeSchedule = routing.platform === 'macos' && item.nativeScheduled === true && hasNativeBridge;
          const preferOwnerNative = routing.preferOwnerNative === true && hasLocalNativeSchedule;
          if (preferOwnerNative) {
            const fallbackGraceMs = Math.max(0, Number(routing.fallbackToReplicaAfterMs || 0) || 0);
            if (dueAtMs + fallbackGraceMs > nowMs) return false;
          }
          const desktopNativeGraceMs = routing.platform === 'macos' && routing.owner === true
            ? REMINDER_DESKTOP_NATIVE_DELIVERY_GRACE_MS
            : 0;
          if (hasLocalNativeSchedule && desktopNativeGraceMs > 0 && dueAtMs + desktopNativeGraceMs > nowMs) return false;
          if (!routing.allowReplicaFallback && hasLocalNativeSchedule && routing.preferOwnerNative === true) return false;
          return true;
        }).slice(0, 8);
        if (!dueItems.length) return;
        let deliveredCount = 0;
        for (const item of dueItems) {
          const bodyText = typeof api.buildReminderNotificationBody === 'function'
            ? api.buildReminderNotificationBody(item)
            : String(item.text || '').trim();
          const delivery = await sendLocalNotificationDetailed('Morpheus 提醒', bodyText);
          const delivered = delivery.delivered === true
            || surfaceInAppReminderFallback(item, bodyText, delivery.reason);
          if (!delivered) continue;
          item.status = 'notified';
          item.notifiedAt = new Date().toISOString();
          item.updatedAt = item.notifiedAt;
          api.markLocalReminderAck?.(item.id);
          const monthKey = typeof api.reminderMonthKey === 'function' ? api.reminderMonthKey(item) : '';
          if (monthKey) api.syncReminderBlocksIntoDailyMonth?.(monthKey);
          deliveredCount += 1;
        }
        if (deliveredCount > 0) {
          api.saveData?.({ skipRender: getCurrentTab() !== 'daily', immediatePersist: true });
        }
      } finally {
        reminderDispatchRunning = false;
      }
    }

    async function reconcilePendingReminderDeliveries() {
      if (reminderNativeReconcileRunning) return false;
      if (!api.hasNativeControlBridge || !api.hasNativeControlBridge()) return false;
      reminderNativeReconcileRunning = true;
      try {
        const reminders = typeof api.getReminderList === 'function' ? api.getReminderList() : [];
        const pendingReminders = (Array.isArray(reminders) ? reminders : [])
          .filter((item) => item && String(item.status || 'pending') === 'pending' && Number.isFinite(Number(item.dueAtMs)))
          .slice(0, 200);
        if (!pendingReminders.length) return false;
        return await reconcileNativeReminderSchedules(pendingReminders);
      } finally {
        reminderNativeReconcileRunning = false;
      }
    }

    async function reminderSchedulerTick() {
      await reconcilePendingReminderDeliveries();
      await dispatchDueReminders();
    }

    function restartReminderScheduler() {
      if (reminderSchedulerTimer) {
        clearInterval(reminderSchedulerTimer);
        reminderSchedulerTimer = null;
      }
      reminderSchedulerTimer = setInterval(reminderSchedulerTick, 15 * 1000);
      setTimeout(reminderSchedulerTick, 1200);
    }

    function getSettingsState() {
      return typeof api.getSettingsState === 'function' ? (api.getSettingsState() || {}) : {};
    }

    function readMorphNativeSyncRootCache() {
      return typeof api.readMorphNativeSyncRootCache === 'function' ? (api.readMorphNativeSyncRootCache() || {}) : {};
    }

    function isRunningInNativeIOSShell() {
      return typeof api.isRunningInNativeIOSShell === 'function' ? api.isRunningInNativeIOSShell() === true : false;
    }

    function isRunningInNativeDesktopShell() {
      return typeof api.isRunningInNativeDesktopShell === 'function' ? api.isRunningInNativeDesktopShell() === true : false;
    }

    function buildReminderNotificationBody(reminder, { forNativeSchedule = false } = {}) {
      if (typeof api.buildReminderNotificationBody === 'function') {
        return api.buildReminderNotificationBody(reminder, { forNativeSchedule });
      }
      const text = String(reminder?.text || '').trim() || '你有一个待办提醒';
      const dueText = String(reminder?.dueAtText || '').trim();
      return dueText ? `${text}（计划时间 ${dueText}）` : text;
    }

    function isLikelySharedReminderSyncRootPath(path = '') {
      const text = String(path || '').trim();
      if (!text) return false;
      return /(mobile documents|icloud|onedrive|dropbox|google\s*drive|googledrive|百度网盘|阿里云盘|坚果云|synology drive|nextcloud)/i.test(text);
    }

    function getCurrentNativePlatformForReminderNotifications() {
      const settingsState = getSettingsState();
      const explicitPlatform = String(settingsState?.nativePlatform || '').trim().toLowerCase();
      if (explicitPlatform === 'ios' || explicitPlatform === 'macos') return explicitPlatform;
      const cachedPlatform = String(readMorphNativeSyncRootCache()?.platform || '').trim().toLowerCase();
      if (cachedPlatform === 'ios' || cachedPlatform === 'macos') return cachedPlatform;
      if (isRunningInNativeIOSShell()) return 'ios';
      if (isRunningInNativeDesktopShell()) return 'macos';
      return '';
    }

    function resolveReminderNotificationOwnerPlatform(reminder = null, platform = '', sharedSyncRoot = false) {
      const explicitOwnerPlatform = String(
        reminder?.notificationOwnerPlatform
        || reminder?.ownerPlatform
        || ''
      ).trim().toLowerCase();
      if (explicitOwnerPlatform === 'ios' || explicitOwnerPlatform === 'macos') return explicitOwnerPlatform;
      const currentPlatform = String(platform || '').trim().toLowerCase();
      if (!sharedSyncRoot && (currentPlatform === 'ios' || currentPlatform === 'macos')) return currentPlatform;
      return REMINDER_NOTIFICATION_OWNER_PLATFORM;
    }

    function getReminderNotificationRoutingState(reminder = null) {
      const platform = getCurrentNativePlatformForReminderNotifications();
      const cachedRoot = readMorphNativeSyncRootCache();
      const settingsState = getSettingsState();
      const syncRootPath = String(settingsState?.syncRootPath || cachedRoot?.path || '').trim();
      const sharedSyncRoot = isLikelySharedReminderSyncRootPath(syncRootPath);
      const ownerPlatform = resolveReminderNotificationOwnerPlatform(reminder, platform, sharedSyncRoot);
      if (platform === 'ios') {
        if (sharedSyncRoot && ownerPlatform !== 'ios') {
          return {
            platform,
            sharedSyncRoot,
            ownerPlatform,
            owner: false,
            suppressReplicaNotifications: true,
            allowReplicaFallback: false,
            preferOwnerNative: true,
            fallbackToReplicaAfterMs: 0,
            mode: 'shared-ios-replica',
          };
        }
        return {
          platform,
          sharedSyncRoot,
          ownerPlatform,
          owner: true,
          suppressReplicaNotifications: false,
          allowReplicaFallback: false,
          preferOwnerNative: false,
          fallbackToReplicaAfterMs: 0,
          mode: sharedSyncRoot ? 'shared-ios-primary' : 'ios-local',
        };
      }
      if (platform === 'macos' && sharedSyncRoot) {
        if (ownerPlatform === 'macos') {
          return {
            platform,
            sharedSyncRoot,
            ownerPlatform,
            owner: true,
            suppressReplicaNotifications: false,
            allowReplicaFallback: false,
            preferOwnerNative: false,
            fallbackToReplicaAfterMs: 0,
            mode: 'shared-desktop-owner',
          };
        }
        return {
          platform,
          sharedSyncRoot,
          ownerPlatform,
          owner: false,
          suppressReplicaNotifications: false,
          allowReplicaFallback: true,
          preferOwnerNative: true,
          fallbackToReplicaAfterMs: REMINDER_SHARED_REPLICA_FALLBACK_GRACE_MS,
          mode: 'shared-desktop-fallback',
        };
      }
      return {
        platform,
        sharedSyncRoot,
        ownerPlatform,
        owner: true,
        suppressReplicaNotifications: false,
        allowReplicaFallback: false,
        preferOwnerNative: false,
        fallbackToReplicaAfterMs: 0,
        mode: platform === 'macos' ? 'desktop-local' : 'default-local',
      };
    }

    function canUseNativeReminderScheduling(routing = null) {
      const state = routing && typeof routing === 'object' ? routing : getReminderNotificationRoutingState();
      const platform = String(state?.platform || '').trim().toLowerCase();
      if (platform === 'ios' || platform === 'macos') {
        return state.owner === true || state.allowReplicaFallback === true;
      }
      return state.owner === true;
    }

    async function scheduleReminderNativeIfPossible(reminder) {
      const routing = getReminderNotificationRoutingState(reminder);
      if (!canUseNativeReminderScheduling(routing)) return { scheduled: false, reason: 'routing_blocked' };
      if (!reminder || !api.hasNativeControlBridge || !api.hasNativeControlBridge()) return { scheduled: false, reason: 'native_bridge_unavailable' };
      if (typeof api.callNativeDesktopControl !== 'function') return { scheduled: false, reason: 'native_bridge_unavailable' };
      try {
        const bodyText = buildReminderNotificationBody(reminder, { forNativeSchedule: true });
        const res = await api.callNativeDesktopControl('scheduleReminder', {
          id: String(reminder.id || (typeof api.genId === 'function' ? api.genId() : `rem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`)),
          text: bodyText,
          dueAtMs: Number(reminder.dueAtMs),
          timezone: String(typeof api.getAITimezone === 'function' ? api.getAITimezone() : 'Asia/Shanghai').trim() || 'Asia/Shanghai',
          title: 'Morpheus 提醒',
        });
        return {
          scheduled: res?.scheduled === true,
          reason: String(res?.reason || '').trim(),
          settings: res?.settings && typeof res.settings === 'object' ? res.settings : null,
        };
      } catch (error) {
        return {
          scheduled: false,
          reason: String(error?.message || 'schedule_failed').trim() || 'schedule_failed',
          settings: null,
        };
      }
    }

    async function cancelReminderNativeIfPossible(reminderId) {
      const routing = getReminderNotificationRoutingState();
      if (!canUseNativeReminderScheduling(routing)) return false;
      const id = String(reminderId || '').trim();
      if (!id || !api.hasNativeControlBridge || !api.hasNativeControlBridge()) return false;
      if (typeof api.callNativeDesktopControl !== 'function') return false;
      try {
        const res = await api.callNativeDesktopControl('cancelReminder', { id });
        return !!res?.cancelled;
      } catch (_) {
        return false;
      }
    }

    async function reconcileNativeReminderSchedules(reminders = []) {
      const routing = getReminderNotificationRoutingState();
      if (!canUseNativeReminderScheduling(routing)) return false;
      if (!api.hasNativeControlBridge || !api.hasNativeControlBridge()) return false;
      if (typeof api.callNativeDesktopControl !== 'function') return false;
      const activeIds = (Array.isArray(reminders) ? reminders : [])
        .filter((item) => item && String(item.status || 'pending') === 'pending' && Number.isFinite(Number(item.dueAtMs)))
        .map((item) => String(item.id || '').trim())
        .filter(Boolean);
      try {
        const res = await api.callNativeDesktopControl('reconcileReminderNotifications', { activeIds });
        const deliveredIds = Array.isArray(res?.deliveredIds) ? res.deliveredIds : [];
        if (deliveredIds.length) {
          applyNativeDeliveredReminderIds(deliveredIds, {
            event: 'native-reconcile',
            reason: 'native-reconcile',
            deliveredAt: new Date().toISOString(),
            platform: routing.platform,
          });
        }
        return !!res?.ok;
      } catch (_) {
        return false;
      }
    }

    function ensureNativeSchedulesForPendingReminders() {
      const routing = getReminderNotificationRoutingState();
      if (!canUseNativeReminderScheduling(routing)) return;
      if (!api.hasNativeControlBridge || !api.hasNativeControlBridge()) return;
      const reminders = typeof api.getReminderList === 'function' ? api.getReminderList() : [];
      const reconcileCandidates = (Array.isArray(reminders) ? reminders : [])
        .filter((item) => item && String(item.status || 'pending') === 'pending' && Number.isFinite(Number(item.dueAtMs)))
        .slice(0, 200);
      const pendingReminders = reconcileCandidates
        .filter((item) => Number(item.dueAtMs) > Date.now() - 60 * 1000);
      reconcileNativeReminderSchedules(reconcileCandidates);
      if (!pendingReminders.length) return;
      pendingReminders.forEach((item) => {
        if (item.nativeScheduled === true) return;
        scheduleReminderNativeIfPossible(item).then((result) => {
          const beforeRuntimeState = {
            ...(Object.prototype.hasOwnProperty.call(item, 'nativeScheduled') ? { nativeScheduled: item.nativeScheduled } : {}),
            ...(Object.prototype.hasOwnProperty.call(item, 'nativeScheduleError') ? { nativeScheduleError: item.nativeScheduleError } : {}),
            ...(Object.prototype.hasOwnProperty.call(item, 'nativeScheduleErrorAt') ? { nativeScheduleErrorAt: item.nativeScheduleErrorAt } : {}),
          };
          if (!result?.scheduled) return;
          item.nativeScheduled = true;
          delete item.nativeScheduleError;
          delete item.nativeScheduleErrorAt;
          const committed = commitReminderPatchIntent({
            changed: true,
            source: 'runtime',
            promptQuestion: '提醒原生调度已确认',
            actions: [{ type: 'runtime_mark_reminder_native_scheduled', reminderId: String(item?.id || '').trim() }],
            actionTypes: ['runtime_mark_reminder_native_scheduled'],
            domains: ['reminders'],
            appliedLabels: ['提醒原生调度已确认'],
            detail: { reminderId: String(item?.id || '').trim(), reason: 'native_schedule_confirmed' },
            entityRefs: item?.id ? [{ domain: 'reminders', entityType: 'reminder', entityId: String(item.id), action: 'upsert', label: String(item.text || '').trim().slice(0, 40) }] : [],
            saveMode: 'silent',
            skipUndo: true,
            immediatePersist: true,
            saveSilent: typeof api.saveSilent === 'function' ? api.saveSilent : null,
            saveData: typeof api.saveData === 'function' ? api.saveData : null,
            currentTab: getCurrentTab(),
          });
          if (!committed) restoreReminderRuntimeFields(item, beforeRuntimeState);
        });
      });
    }

    function getReminderSyncEnabled() {
      return typeof api.getReminderSyncEnabled === 'function' ? api.getReminderSyncEnabled() === true : false;
    }

    function getReminderSyncEndpoint() {
      return typeof api.getReminderSyncEndpoint === 'function' ? String(api.getReminderSyncEndpoint() || '').trim() : '';
    }

    function getReminderSyncDeviceId() {
      return typeof api.getReminderSyncDeviceId === 'function' ? String(api.getReminderSyncDeviceId() || '').trim() : '';
    }

    function getReminderList() {
      if (typeof api.getReminderList === 'function') {
        const list = api.getReminderList();
        return Array.isArray(list) ? list : [];
      }
      return [];
    }

    function clearLocalReminderAck(id) {
      if (typeof api.clearLocalReminderAck === 'function') {
        api.clearLocalReminderAck(id);
      }
    }

    function markReminderDeliveredByNative(reminderId = '', payload = {}) {
      const id = String(reminderId || '').trim();
      if (!id) return false;
      const reminders = getReminderList();
      const reminder = Array.isArray(reminders)
        ? reminders.find((item) => String(item?.id || '').trim() === id)
        : null;
      if (!reminder || typeof reminder !== 'object') return false;
      const currentStatus = String(reminder.status || 'pending').trim() || 'pending';
      if (currentStatus === 'notified' && String(reminder.notifiedAt || '').trim()) return false;
      const deliveredAt = String(
        payload?.presentedAt
        || payload?.deliveredAt
        || payload?.notifiedAt
        || payload?.timestamp
        || ''
      ).trim() || new Date().toISOString();
      reminder.status = 'notified';
      reminder.notifiedAt = deliveredAt;
      reminder.updatedAt = deliveredAt;
      api.markLocalReminderAck?.(id);
      const monthKey = typeof api.reminderMonthKey === 'function' ? api.reminderMonthKey(reminder) : '';
      if (monthKey) api.syncReminderBlocksIntoDailyMonth?.(monthKey);
      return true;
    }

    function persistNativeDeliveredReminderChanges(changedCount = 0, reason = 'native-reminder-event') {
      if (!(Number(changedCount) > 0)) return false;
      const committed = commitReminderPatchIntent({
        changed: true,
        source: 'runtime',
        promptQuestion: '提醒已由原生通知送达',
        actions: [{ type: 'runtime_mark_reminder_delivered_by_native', changedCount: Number(changedCount) || 0, reason: String(reason || '').trim() }],
        actionTypes: ['runtime_mark_reminder_delivered_by_native'],
        domains: ['reminders', 'daily'],
        appliedLabels: ['提醒已由原生通知送达'],
        detail: { changedCount: Number(changedCount) || 0, reason: String(reason || '').trim() || 'native-reminder-event' },
        saveMode: 'data',
        immediatePersist: true,
        skipRender: getCurrentTab() !== 'daily',
        saveData: typeof api.saveData === 'function' ? api.saveData : null,
        currentTab: getCurrentTab(),
      });
      if (!committed) return false;
      if (getReminderSyncEnabled() && getReminderSyncEndpoint()) {
        scheduleReminderLanSync(String(reason || 'native-reminder-event').trim() || 'native-reminder-event');
      }
      return true;
    }

    function applyNativeDeliveredReminderIds(reminderIds = [], payload = {}) {
      const ids = Array.isArray(reminderIds)
        ? reminderIds.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      if (!ids.length) return false;
      const reminders = getReminderList();
      const beforeSnapshots = new Map();
      let changedCount = 0;
      ids.forEach((id) => {
        const reminder = Array.isArray(reminders)
          ? reminders.find((item) => String(item?.id || '').trim() === id)
          : null;
        if (reminder && typeof reminder === 'object' && !beforeSnapshots.has(id)) {
          try {
            beforeSnapshots.set(id, JSON.parse(JSON.stringify(reminder)));
          } catch (_) {}
        }
        maybeSurfaceInAppReminderForNativeReconcile(reminder, payload);
        if (markReminderDeliveredByNative(id, payload)) changedCount += 1;
      });
      const persisted = persistNativeDeliveredReminderChanges(changedCount, payload?.reason || payload?.event || 'native-reconcile');
      if (!persisted) {
        beforeSnapshots.forEach((snapshot, id) => {
          const reminder = Array.isArray(reminders)
            ? reminders.find((item) => String(item?.id || '').trim() === String(id || '').trim())
            : null;
          restoreReminderSnapshot(reminder, snapshot);
          const monthKey = typeof api.reminderMonthKey === 'function' ? api.reminderMonthKey(reminder) : '';
          if (monthKey) api.syncReminderBlocksIntoDailyMonth?.(monthKey);
        });
      }
      return persisted;
    }

    function handleNativeReminderEvent(payload = {}) {
      const reminderId = String(payload?.reminderId || payload?.id || '').trim();
      if (!reminderId) return false;
      const reminders = getReminderList();
      const reminder = Array.isArray(reminders)
        ? reminders.find((item) => String(item?.id || '').trim() === reminderId)
        : null;
      const beforeSnapshot = reminder && typeof reminder === 'object'
        ? (() => {
          try {
            return JSON.parse(JSON.stringify(reminder));
          } catch (_) {
            return null;
          }
        })()
        : null;
      const changed = markReminderDeliveredByNative(reminderId, payload);
      if (!changed) return false;
      const persisted = persistNativeDeliveredReminderChanges(1, payload?.event || 'native-reminder-event');
      if (!persisted && reminder && beforeSnapshot) {
        restoreReminderSnapshot(reminder, beforeSnapshot);
        const monthKey = typeof api.reminderMonthKey === 'function' ? api.reminderMonthKey(reminder) : '';
        if (monthKey) api.syncReminderBlocksIntoDailyMonth?.(monthKey);
      }
      return persisted;
    }

    function normalizeReminderForSync(item = {}) {
      if (!item || typeof item !== 'object') return null;
      const id = String(item.id || '').trim() || (typeof api.genId === 'function' ? api.genId() : `rem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
      const text = String(item.text || '').trim();
      const dueAtMs = Number(item.dueAtMs);
      if (!text || !Number.isFinite(dueAtMs)) return null;
      const dueParts = typeof api.getDatePartsInTimezone === 'function'
        ? api.getDatePartsInTimezone(new Date(dueAtMs), typeof api.getAITimezone === 'function' ? api.getAITimezone() : 'Asia/Shanghai')
        : null;
      const dueAtText = String(item.dueAtText || '').trim()
        || (dueParts && typeof api.formatYMDHMSFromParts === 'function'
          ? api.formatYMDHMSFromParts(dueParts).slice(0, 16)
          : new Date(dueAtMs).toISOString().slice(0, 16));
      const createdAt = String(item.createdAt || '').trim() || new Date().toISOString();
      const updatedAt = String(item.updatedAt || '').trim() || createdAt;
      const requestText = String(item.requestText || item.detailText || item.text || '').trim() || text;
      const status = String(item.status || 'pending').trim() || 'pending';
      const notifiedAt = String(item.notifiedAt || '').trim();
      const dailyLogDismissed = item.dailyLogDismissed === true;
      const dailyLogDismissedAt = String(item.dailyLogDismissedAt || '').trim();
      const notificationOwnerPlatform = resolveReminderNotificationOwnerPlatform(item, getCurrentNativePlatformForReminderNotifications(), false);
      return {
        id,
        text,
        requestText,
        dueAtMs,
        dueAtText,
        timezone: typeof api.getAITimezone === 'function' ? String(api.getAITimezone() || 'Asia/Shanghai').trim() || 'Asia/Shanghai' : 'Asia/Shanghai',
        source: String(item.source || 'ai').trim() || 'ai',
        notificationOwnerPlatform,
        status,
        notifiedAt,
        dailyLogDismissed,
        dailyLogDismissedAt: dailyLogDismissed ? dailyLogDismissedAt : '',
        createdAt,
        updatedAt,
      };
    }

    function reminderSyncStampMs(item = null) {
      if (!item || typeof item !== 'object') return 0;
      const updated = Date.parse(String(item.updatedAt || ''));
      if (Number.isFinite(updated) && updated > 0) return updated;
      const notifiedAt = Date.parse(String(item.notifiedAt || ''));
      if (Number.isFinite(notifiedAt) && notifiedAt > 0) return notifiedAt;
      const dismissedAt = Date.parse(String(item.dailyLogDismissedAt || ''));
      if (Number.isFinite(dismissedAt) && dismissedAt > 0) return dismissedAt;
      const created = Date.parse(String(item.createdAt || ''));
      if (Number.isFinite(created) && created > 0) return created;
      const dueAt = Number(item.dueAtMs || 0);
      return Number.isFinite(dueAt) ? dueAt : 0;
    }

    function mergeReminderSnapshot(localList = [], remoteList = []) {
      const merged = new Map();
      localList.forEach((item) => {
        const canonical = normalizeReminderForSync(item);
        if (!canonical) return;
        merged.set(canonical.id, canonical);
      });
      remoteList.forEach((item) => {
        const canonical = normalizeReminderForSync(item);
        if (!canonical) return;
        const current = merged.get(canonical.id);
        if (!current || reminderSyncStampMs(canonical) >= reminderSyncStampMs(current)) {
          merged.set(canonical.id, canonical);
        }
      });
      return Array.from(merged.values()).sort((a, b) => Number(a.dueAtMs || 0) - Number(b.dueAtMs || 0));
    }

    function applyReminderSyncList(remoteList = []) {
      const localList = getReminderList();
      const localById = new Map(localList.map((item) => [String(item?.id || ''), item]));
      const mergedCanonical = mergeReminderSnapshot(localList, remoteList);
      const next = mergedCanonical.map((item) => {
        const local = localById.get(String(item.id || ''));
        const localDueAt = Number(local?.dueAtMs || 0);
        const nextDueAt = Number(item?.dueAtMs || 0);
        const localText = String(local?.text || '').trim();
        const nextText = String(item?.text || '').trim();
        const localRequestText = String(local?.requestText || local?.detailText || local?.text || '').trim();
        const nextRequestText = String(item?.requestText || item?.detailText || item?.text || '').trim();
        const localOwnerPlatform = String(local?.notificationOwnerPlatform || local?.ownerPlatform || '').trim().toLowerCase();
        const nextOwnerPlatform = String(item?.notificationOwnerPlatform || item?.ownerPlatform || '').trim().toLowerCase();
        const reminderCoreChanged = !!local && (
          localDueAt !== nextDueAt
          || localText !== nextText
          || localRequestText !== nextRequestText
          || localOwnerPlatform !== nextOwnerPlatform
        );
        if (reminderCoreChanged) clearLocalReminderAck(item.id);
        const shouldResetNativeRuntime = !local || reminderCoreChanged;
        const runtime = local && typeof local === 'object'
          ? {
            nativeScheduled: local.nativeScheduled === true,
          }
          : null;
        return {
          ...item,
          status: String(item?.status || 'pending').trim() || 'pending',
          notifiedAt: String(item?.notifiedAt || '').trim(),
          dailyLogDismissed: item?.dailyLogDismissed === true,
          dailyLogDismissedAt: item?.dailyLogDismissed === true ? String(item?.dailyLogDismissedAt || '').trim() : '',
          nativeScheduled: shouldResetNativeRuntime ? false : (runtime?.nativeScheduled === true),
        };
      });
      const currentFingerprint = JSON.stringify(localList);
      const nextFingerprint = JSON.stringify(next);
      if (currentFingerprint === nextFingerprint) return false;
      if (typeof api.getReminderList === 'function') {
        const list = api.getReminderList();
        if (Array.isArray(list)) {
          list.length = 0;
          next.forEach((item) => list.push(item));
        }
      }
      if (typeof api.saveSilent === 'function') {
        api.saveSilent({ skipUndo: true, forceDebounce: true, domains: ['reminders', 'daily'] });
      }
      return true;
    }

    async function runReminderLanSyncOnce({ reason = '' } = {}) {
      if (!getReminderSyncEnabled() || !getReminderSyncEndpoint() || reminderLanSyncInFlight || typeof fetch !== 'function') return false;
      reminderLanSyncInFlight = true;
      try {
        const payload = {
          deviceId: getReminderSyncDeviceId(),
          now: new Date().toISOString(),
          reason: String(reason || ''),
          reminders: getReminderList().map((item) => normalizeReminderForSync(item)).filter(Boolean),
        };
        const res = await fetch(getReminderSyncEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json;charset=UTF-8' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json().catch(() => null);
        const remoteReminders = Array.isArray(json?.reminders) ? json.reminders : [];
        const changed = applyReminderSyncList(remoteReminders);
        if (changed) {
          ensureNativeSchedulesForPendingReminders();
          setTimeout(() => {
            reminderSchedulerTick();
          }, 120);
        }
        if (!changed && reminderLanSyncQueued) {
          reminderLanSyncQueued = false;
          setTimeout(() => runReminderLanSyncOnce({ reason: 'queued' }), 160);
        }
        reminderLanSyncWarned = false;
        return changed;
      } catch (error) {
        if (!reminderLanSyncWarned) {
          console.warn('[ReminderSync] LAN sync failed:', error);
          reminderLanSyncWarned = true;
        }
        return false;
      } finally {
        reminderLanSyncInFlight = false;
      }
    }

    function scheduleReminderLanSync(reason = 'update') {
      if (!getReminderSyncEnabled() || !getReminderSyncEndpoint()) return;
      if (reminderLanSyncInFlight) {
        reminderLanSyncQueued = true;
        return;
      }
      setTimeout(() => runReminderLanSyncOnce({ reason }), 120);
    }

    function restartReminderLanSyncScheduler() {
      if (reminderLanSyncTimer) {
        clearInterval(reminderLanSyncTimer);
        reminderLanSyncTimer = null;
      }
      if (!getReminderSyncEnabled() || !getReminderSyncEndpoint()) return;
      reminderLanSyncTimer = setInterval(() => {
        runReminderLanSyncOnce({ reason: 'poll' });
      }, 20 * 1000);
      setTimeout(() => runReminderLanSyncOnce({ reason: 'bootstrap' }), 1500);
    }

    function getBackgroundWorkflowSchedulerState() {
      return {
        proactiveAgentRunning,
        reminderDispatchRunning,
        proactiveAgentSchedulerActive: !!proactiveAgentSchedulerTimer,
        reminderSchedulerActive: !!reminderSchedulerTimer,
        reminderLanSyncActive: !!reminderLanSyncTimer,
        reminderLanSyncInFlight,
        reminderLanSyncQueued,
        dailyAlignRunning,
        dailyAlignSchedulerActive: !!dailyAlignSchedulerTimer,
        reminderNativeRoutingState: getReminderNotificationRoutingState(),
      };
    }

    return {
      runProactiveAgentScan,
      proactiveAgentSchedulerTick,
      restartProactiveAgentScheduler,
      dispatchDueReminders,
      reconcilePendingReminderDeliveries,
      reminderSchedulerTick,
      restartReminderScheduler,
      shouldQueueProactiveReminderForChat,
      canNotifyProactiveFinding,
      trimProactiveIssueCooldowns,
      isReminderProactiveFinding,
      isLikelySharedReminderSyncRootPath,
      getCurrentNativePlatformForReminderNotifications,
      getReminderNotificationRoutingState,
      scheduleReminderNativeIfPossible,
      cancelReminderNativeIfPossible,
      reconcileNativeReminderSchedules,
      ensureNativeSchedulesForPendingReminders,
      runReminderLanSyncOnce,
      scheduleReminderLanSync,
      restartReminderLanSyncScheduler,
      normalizeReminderForSync,
      reminderSyncStampMs,
      mergeReminderSnapshot,
      applyReminderSyncList,
      applyNativeDeliveredReminderIds,
      handleNativeReminderEvent,
      runScheduledDailyAlign,
      dailyAlignSchedulerTick,
      restartDailyAlignScheduler,
      getBackgroundWorkflowSchedulerState,
    };
  }

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createBackgroundWorkflowDepsRuntime(root) {
    const currentRoot = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || currentRoot;
    const getGlobalFunction = (name = '') => {
      const key = String(name || '').trim();
      if (!key) return null;
      const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
      if (typeof fromGlobal === 'function') return fromGlobal;
      const fromRoot = currentRoot && typeof currentRoot[key] === 'function' ? currentRoot[key] : null;
      return typeof fromRoot === 'function' ? fromRoot : null;
    };
    const getGlobalValue = (name = '', fallback = null) => {
      const key = String(name || '').trim();
      if (!key) return fallback;
      if (globalRoot && typeof globalRoot[key] !== 'undefined') return globalRoot[key];
      if (currentRoot && typeof currentRoot[key] !== 'undefined') return currentRoot[key];
      return fallback;
    };

    function buildAppDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        documentRef: context.documentRef || (typeof document !== 'undefined' ? document : null),
        getCurrentTab: pickFunction(context.getCurrentTab, () => String(getGlobalValue('currentTab', '') || '').trim()),
        getAIChatState: pickFunction(context.getAIChatState, () => {
          const value = getGlobalValue('aiChatState', {});
          return value && typeof value === 'object' ? value : {};
        }),
        getMorphRuntimeBundle: pickFunction(context.getMorphRuntimeBundle, getGlobalFunction('getMorphRuntimeBundle') || (() => ({}))),
        getMorphRuntimeAgentState: pickFunction(context.getMorphRuntimeAgentState, () => {
          const ensureMorphRuntimeShape = getGlobalFunction('ensureMorphRuntimeShape');
          const sanitizeMorphProactiveAgentState = getGlobalFunction('sanitizeMorphProactiveAgentState');
          const data = getGlobalValue('data', null);
          const runtime = typeof ensureMorphRuntimeShape === 'function'
            ? ensureMorphRuntimeShape(data)?.morphRuntime
            : (data && typeof data === 'object' && data.morphRuntime && typeof data.morphRuntime === 'object' ? data.morphRuntime : {});
          if (runtime && typeof runtime === 'object' && typeof sanitizeMorphProactiveAgentState === 'function') {
            runtime.agentState = sanitizeMorphProactiveAgentState(runtime.agentState);
          }
          return runtime && typeof runtime === 'object' ? (runtime.agentState || {}) : {};
        }),
        sanitizeMorphProactiveAgentConfig: pickFunction(context.sanitizeMorphProactiveAgentConfig, getGlobalFunction('sanitizeMorphProactiveAgentConfig') || ((value) => (value && typeof value === 'object' ? value : {}))),
        buildProactiveAgentFindings: pickFunction(context.buildProactiveAgentFindings, getGlobalFunction('buildProactiveAgentFindings') || (() => [])),
        recordMorphProactiveDecisionReceipt: pickFunction(context.recordMorphProactiveDecisionReceipt, getGlobalFunction('recordMorphProactiveDecisionReceipt') || (() => {})),
        recordMorphInternalDecisionTrace: pickFunction(context.recordMorphInternalDecisionTrace, getGlobalFunction('recordMorphInternalDecisionTrace') || (() => {})),
        saveSilent: pickFunction(context.saveSilent, getGlobalFunction('saveSilent') || (() => {})),
        recordMorphProactiveFindingLog: pickFunction(context.recordMorphProactiveFindingLog, getGlobalFunction('recordMorphProactiveFindingLog') || (() => {})),
        buildMorphInternalProactiveGuidanceRuntime: pickFunction(context.buildMorphInternalProactiveGuidanceRuntime, getGlobalFunction('buildMorphInternalProactiveGuidanceRuntime') || (() => ({ dominantMode: '', actionBias: '', notes: [] }))),
        shouldSurfaceProactiveDigestRuntime: pickFunction(context.shouldSurfaceProactiveDigestRuntime, getGlobalFunction('shouldSurfaceProactiveDigestRuntime') || (() => false)),
        shouldPersistProactiveDigestToInteractionMemoryRuntime: pickFunction(context.shouldPersistProactiveDigestToInteractionMemoryRuntime, getGlobalFunction('shouldPersistProactiveDigestToInteractionMemoryRuntime') || (() => false)),
        queuePendingProactiveReminder: pickFunction(context.queuePendingProactiveReminder, getGlobalFunction('queuePendingProactiveReminder') || (() => false)),
        buildProactiveCarryoverReminder: pickFunction(context.buildProactiveCarryoverReminder, getGlobalFunction('buildProactiveCarryoverReminder') || (() => null)),
        formatProactiveDigest: pickFunction(context.formatProactiveDigest, getGlobalFunction('formatProactiveDigest') || (() => '')),
        pushAIChatMessage: pickFunction(context.pushAIChatMessage, getGlobalFunction('pushAIChatMessage') || (() => {})),
        buildProactiveNotificationCopyRuntime: pickFunction(context.buildProactiveNotificationCopyRuntime, getGlobalFunction('buildProactiveNotificationCopyRuntime') || (() => null)),
        appendAIInteractionMemory: pickFunction(context.appendAIInteractionMemory, getGlobalFunction('appendAIInteractionMemory') || (() => {})),
        getDailyAlignEnabled: pickFunction(context.getDailyAlignEnabled, getGlobalFunction('getDailyAlignEnabled') || (() => false)),
        getDailyAlignTime: pickFunction(context.getDailyAlignTime, getGlobalFunction('getDailyAlignTime') || (() => '08:00')),
        getDailyAlignPrompt: pickFunction(context.getDailyAlignPrompt, getGlobalFunction('getDailyAlignPrompt') || (() => '')),
        getDailyAlignLastRunDate: pickFunction(context.getDailyAlignLastRunDate, getGlobalFunction('getDailyAlignLastRunDate') || (() => '')),
        getDailyAlignDefaultPrompt: pickFunction(context.getDailyAlignDefaultPrompt, () => String(getGlobalValue('DAILY_ALIGN_DEFAULT_PROMPT', '') || '')),
        setDailyAlignLastRunDate: pickFunction(context.setDailyAlignLastRunDate, (value) => {
          const storage = getGlobalValue('storage', null);
          if (storage && typeof storage.setDailyAlignLastRunDate === 'function') storage.setDailyAlignLastRunDate(value);
        }),
        getCurrentAIKey: pickFunction(context.getCurrentAIKey, getGlobalFunction('getCurrentAIKey') || (() => '')),
        executeAICommandWithQuestion: pickFunction(context.executeAICommandWithQuestion, getGlobalFunction('executeAICommandWithQuestion') || (async () => ({ ok: false, reason: 'runtime_unavailable' }))),
        getDatePartsInTimezone: pickFunction(context.getDatePartsInTimezone, getGlobalFunction('getDatePartsInTimezone') || (() => null)),
        formatYMDHMSFromParts: pickFunction(context.formatYMDHMSFromParts, getGlobalFunction('formatYMDHMSFromParts') || (() => '')),
        getAITimezone: pickFunction(context.getAITimezone, () => String(getGlobalValue('AI_TIMEZONE', 'Asia/Shanghai') || 'Asia/Shanghai')),
        genId: pickFunction(context.genId, getGlobalFunction('genId') || (() => `id_${Date.now().toString(36)}`)),
        renderSettingsView: pickFunction(context.renderSettingsView, getGlobalFunction('renderSettingsView') || (() => {})),
        getReminderList: pickFunction(context.getReminderList, getGlobalFunction('getReminderList') || (() => [])),
        getReminderSyncEnabled: pickFunction(context.getReminderSyncEnabled, getGlobalFunction('getReminderSyncEnabled') || (() => false)),
        getReminderSyncEndpoint: pickFunction(context.getReminderSyncEndpoint, getGlobalFunction('getReminderSyncEndpoint') || (() => '')),
        getReminderSyncDeviceId: pickFunction(context.getReminderSyncDeviceId, getGlobalFunction('getReminderSyncDeviceId') || (() => '')),
        hasLocalReminderAck: pickFunction(context.hasLocalReminderAck, getGlobalFunction('hasLocalReminderAck') || (() => false)),
        clearLocalReminderAck: pickFunction(context.clearLocalReminderAck, getGlobalFunction('clearLocalReminderAck') || (() => {})),
        getSettingsState: pickFunction(context.getSettingsState, () => {
          const value = getGlobalValue('settingsState', {});
          return value && typeof value === 'object' ? value : {};
        }),
        readMorphNativeSyncRootCache: pickFunction(context.readMorphNativeSyncRootCache, getGlobalFunction('readMorphNativeSyncRootCache') || (() => ({}))),
        isRunningInNativeIOSShell: pickFunction(context.isRunningInNativeIOSShell, getGlobalFunction('isRunningInNativeIOSShell') || (() => false)),
        isRunningInNativeDesktopShell: pickFunction(context.isRunningInNativeDesktopShell, getGlobalFunction('isRunningInNativeDesktopShell') || (() => false)),
        buildReminderNotificationBody: pickFunction(context.buildReminderNotificationBody, getGlobalFunction('buildReminderNotificationBody') || ((item) => String(item?.text || '').trim())),
        callNativeDesktopControl: pickFunction(context.callNativeDesktopControl, (method, payload) => {
          const storage = getGlobalValue('storage', null);
          return storage && typeof storage.callNativeDesktopControl === 'function'
            ? storage.callNativeDesktopControl(method, payload)
            : Promise.reject(new Error('native_control_unavailable'));
        }),
        markLocalReminderAck: pickFunction(context.markLocalReminderAck, getGlobalFunction('markLocalReminderAck') || (() => {})),
        reminderMonthKey: pickFunction(context.reminderMonthKey, getGlobalFunction('reminderMonthKey') || (() => '')),
        syncReminderBlocksIntoDailyMonth: pickFunction(context.syncReminderBlocksIntoDailyMonth, getGlobalFunction('syncReminderBlocksIntoDailyMonth') || (() => {})),
        ensureNativeSchedulesForPendingReminders: pickFunction(context.ensureNativeSchedulesForPendingReminders, getGlobalFunction('ensureNativeSchedulesForPendingReminders') || (() => {})),
        reminderSchedulerTick: pickFunction(context.reminderSchedulerTick, getGlobalFunction('reminderSchedulerTick') || (() => {})),
        commitPatchIntent: pickFunction(context.commitPatchIntent, getGlobalFunction('commitMorphCoreMutation') || (() => null)),
        saveData: pickFunction(context.saveData, getGlobalFunction('saveData') || (() => {})),
        hasNativeControlBridge: pickFunction(context.hasNativeControlBridge, () => {
          const storage = getGlobalValue('storage', null);
          return !!(storage && typeof storage.hasNativeControlBridge === 'function' && storage.hasNativeControlBridge());
        }),
      };
    }

    return { buildAppDeps };
  }

  window.MorphBackgroundWorkflowRuntime = { create: createBackgroundWorkflowRuntime };
  window.MorphBackgroundWorkflowDepsRuntime = { create: () => createBackgroundWorkflowDepsRuntime(window) };
})();
