(function initMorphProactiveRuntime() {
  function createProactiveRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function hasMorphLowDisturbProactiveBias(selfMemory = null) {
      const safeSelfMemory = selfMemory || (typeof api.getMorphSelfMemory === 'function'
        ? api.getMorphSelfMemory(typeof api.getAIMemory === 'function' ? api.getAIMemory() : null)
        : null);
      const lines = [
        ...(Array.isArray(safeSelfMemory?.identity) ? safeSelfMemory.identity : []),
        ...(Array.isArray(safeSelfMemory?.motivations) ? safeSelfMemory.motivations : []),
        ...(Array.isArray(safeSelfMemory?.relationalStance) ? safeSelfMemory.relationalStance : []),
        ...(Array.isArray(safeSelfMemory?.growthDirections) ? safeSelfMemory.growthDirections : []),
      ].map((line) => String(line || '').trim()).filter(Boolean);
      return lines.some((line) => /(低打扰|克制|不过度主动|不打扰|安静|先稳住|少一点打扰)/.test(line));
    }

    function getProactiveAITimezone() {
      return typeof api.getAITimezone === 'function'
        ? String(api.getAITimezone() || '').trim() || 'Asia/Shanghai'
        : 'Asia/Shanghai';
    }

    function getProactiveDatePartsInTimezone(input = new Date()) {
      if (typeof api.getDatePartsInTimezone === 'function') {
        return api.getDatePartsInTimezone(input, getProactiveAITimezone());
      }
      const date = input instanceof Date ? input : new Date(input);
      if (Number.isNaN(date.getTime())) return null;
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: getProactiveAITimezone(),
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

    function getRuntimeData() {
      if (typeof api.getData === 'function') {
        const data = api.getData();
        if (data && typeof data === 'object') return data;
      }
      const currentWindow = typeof window !== 'undefined' ? window : null;
      const storageApi = currentWindow && currentWindow.MorphStorage && typeof currentWindow.MorphStorage.loadData === 'function'
        ? currentWindow.MorphStorage
        : currentWindow && currentWindow.LianXingStorage && typeof currentWindow.LianXingStorage.loadData === 'function'
          ? currentWindow.LianXingStorage
          : null;
      if (!storageApi) return null;
      try {
        const data = storageApi.loadData();
        return data && typeof data === 'object' ? data : null;
      } catch (_) {
        return null;
      }
    }

    function getRuntimeAIMemory() {
      if (typeof api.getAIMemory === 'function') return api.getAIMemory();
      const data = getRuntimeData();
      return data && typeof data === 'object' && data.aiMemory && typeof data.aiMemory === 'object'
        ? data.aiMemory
        : null;
    }

    function getRuntimeLongTermMemory() {
      if (typeof api.getMorphLongTermMemory === 'function') {
        return api.getMorphLongTermMemory(getRuntimeAIMemory());
      }
      const aiMemory = getRuntimeAIMemory();
      return aiMemory && typeof aiMemory === 'object' && aiMemory.longTermMemory && typeof aiMemory.longTermMemory === 'object'
        ? aiMemory.longTermMemory
        : {};
    }

    function getRuntimeReminderList() {
      if (typeof api.getReminderList === 'function') {
        const list = api.getReminderList();
        return Array.isArray(list) ? list : [];
      }
      const data = getRuntimeData();
      return Array.isArray(data?.reminders) ? data.reminders : [];
    }

    function analyzeTodayDailyLogCompletion() {
      if (typeof api.analyzeTodayDailyLogCompletion === 'function') {
        const result = api.analyzeTodayDailyLogCompletion();
        return result && typeof result === 'object' ? result : { hasHeader: false, filledLines: 0, todoTotal: 0, todoDone: 0 };
      }
      const data = getRuntimeData();
      const dailyMonths = data && typeof data === 'object' && data.dailyMonths && typeof data.dailyMonths === 'object'
        ? data.dailyMonths
        : {};
      const parts = getProactiveDatePartsInTimezone(new Date());
      if (!parts) return { hasHeader: false, filledLines: 0, todoTotal: 0, todoDone: 0 };
      const todayStr = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
      const monthKey = todayStr.slice(0, 7);
      const blocks = Array.isArray(dailyMonths[monthKey]) ? dailyMonths[monthKey] : [];
      let activeDate = '';
      let hasHeader = false;
      let filledLines = 0;
      let todoTotal = 0;
      let todoDone = 0;
      blocks.forEach((block) => {
        if (!block || typeof block !== 'object') return;
        if (block.type === 'h3') {
          const content = String(block.content || '');
          const matched = content.match(/(\d{4}-\d{2}-\d{2})/);
          activeDate = matched ? matched[1] : '';
          if (activeDate === todayStr) hasHeader = true;
          return;
        }
        if (activeDate !== todayStr) return;
        const content = String(block.content || '').trim();
        if (block.type === 'todo') {
          todoTotal += 1;
          if (block.checked === true) todoDone += 1;
        }
        if (content) filledLines += 1;
      });
      return { hasHeader, filledLines, todoTotal, todoDone };
    }

    function repairPossibleMojibake(text) {
      if (typeof api.repairPossibleMojibake === 'function') {
        return api.repairPossibleMojibake(text);
      }
      const source = String(text || '');
      if (!source) return '';
      const hasReplacement = /[\uFFFD\u25A1]/.test(source);
      const latinNoiseCount = (source.match(/[À-ÿ]/g) || []).length;
      const cjkCount = (source.match(/[\u3400-\u9FFF]/g) || []).length;
      const looksBroken = hasReplacement || (latinNoiseCount >= 3 && latinNoiseCount > cjkCount);
      if (!looksBroken || typeof TextDecoder !== 'function') return source;
      try {
        const bytes = Uint8Array.from(Array.from(source).map((ch) => ch.charCodeAt(0) & 0xFF));
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim();
        if (!decoded) return source;
        const decodedCjk = (decoded.match(/[\u3400-\u9FFF]/g) || []).length;
        const decodedLatinNoise = (decoded.match(/[À-ÿ]/g) || []).length;
        const improved = decodedCjk > cjkCount || decodedLatinNoise < latinNoiseCount;
        return improved ? decoded : source;
      } catch (_) {
        return source;
      }
    }

    function collectLongTermFactsNeedingReconfirmation(facts = [], lookbackDays = 3) {
      if (typeof api.collectLongTermFactsNeedingReconfirmation === 'function') {
        const result = api.collectLongTermFactsNeedingReconfirmation(facts, lookbackDays);
        return Array.isArray(result) ? result : [];
      }
      const sourceFacts = Array.isArray(facts) ? facts : [];
      const thresholdDays = Math.max(1, Number(lookbackDays) || 3);
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      return sourceFacts.filter((fact) => {
        const updatedAt = Date.parse(String(fact?.updatedAt || fact?.lastConfirmedAt || fact?.lastUpdatedAt || ''));
        if (!Number.isFinite(updatedAt) || updatedAt <= 0) return true;
        return now - updatedAt >= thresholdDays * dayMs;
      });
    }

    function queueMorphMemoryReconfirmationTasksFromFacts(facts = []) {
      if (typeof api.queueMorphMemoryReconfirmationTasksFromFacts === 'function') {
        return api.queueMorphMemoryReconfirmationTasksFromFacts(facts);
      }
      return [];
    }

    function queuePendingProactiveReminder(reminder = null) {
      if (!reminder || typeof reminder !== 'object') return false;
      const data = getRuntimeData();
      let aiMemory = getRuntimeAIMemory();
      if (!aiMemory || typeof aiMemory !== 'object') {
        if (!data || typeof data !== 'object') return false;
        if (!data.aiMemory || typeof data.aiMemory !== 'object') {
          data.aiMemory = {};
        }
        aiMemory = data.aiMemory;
      } else if (data && typeof data === 'object' && data.aiMemory !== aiMemory) {
        if (!data.aiMemory || typeof data.aiMemory !== 'object') {
          data.aiMemory = aiMemory;
        }
      }
      if (!aiMemory || typeof aiMemory !== 'object') return false;
      if (!aiMemory.workingMemory || typeof aiMemory.workingMemory !== 'object') {
        aiMemory.workingMemory = {};
      }
      aiMemory.workingMemory.pendingProactiveReminder = {
        message: String(reminder.message || '').trim(),
        createdAt: String(reminder.createdAt || new Date().toISOString()),
        severity: String(reminder.severity || '').trim(),
        source: String(reminder.source || '').trim(),
        transitionHint: String(reminder.transitionHint || '').trim(),
      };
      return true;
    }

    function prioritizeLongTermMemoryFacts(facts = [], query = '', context = null, options = {}) {
      if (typeof api.prioritizeLongTermMemoryFacts === 'function') {
        const result = api.prioritizeLongTermMemoryFacts(facts, query, context, options);
        return Array.isArray(result) ? result : [];
      }
      return Array.isArray(facts) ? facts.slice() : [];
    }

    function scoreProactiveFindingAgainstLongTermFacts(finding = {}, longTermFacts = []) {
      if (typeof api.scoreProactiveFindingAgainstLongTermFacts === 'function') {
        const score = api.scoreProactiveFindingAgainstLongTermFacts(finding, longTermFacts);
        return Number.isFinite(Number(score)) ? Number(score) : 0;
      }
      const tokens = [
        String(finding?.summary || ''),
        String(finding?.hint || ''),
      ].join(' ').toLowerCase();
      if (!tokens.trim()) return 0;
      return (Array.isArray(longTermFacts) ? longTermFacts : []).reduce((acc, fact) => {
        const factText = [
          fact?.label,
          fact?.name,
          fact?.key,
          fact?.summary,
          fact?.text,
        ].map((value) => String(value || '').toLowerCase()).join(' ');
        if (!factText.trim()) return acc;
        return acc + (tokens.includes(factText.trim()) ? 2 : 0);
      }, 0);
    }

    function buildProactiveAgentFindings(now, config, source = 'scheduler') {
      const currentNow = now instanceof Date ? now : new Date(now);
      const safeNow = Number.isNaN(currentNow.getTime()) ? new Date() : currentNow;
      const safeConfig = typeof api.sanitizeMorphProactiveAgentConfig === 'function'
        ? api.sanitizeMorphProactiveAgentConfig(config)
        : (config && typeof config === 'object' ? config : {});
      const aiMemory = getRuntimeAIMemory();
      const proactivity = typeof api.sanitizeRelationshipProactivityPreferences === 'function'
        ? api.sanitizeRelationshipProactivityPreferences(aiMemory?.relationshipMode?.proactivityPreferences)
        : (aiMemory?.relationshipMode?.proactivityPreferences || {});
      const currentLongTermMemory = getRuntimeLongTermMemory();
      const proactivePurpose = source === 'heartbeat' ? 'heartbeat' : 'proactive';
      const relevantLongTermFacts = prioritizeLongTermMemoryFacts(
        Array.isArray(currentLongTermMemory.facts) ? currentLongTermMemory.facts : [],
        '主动巡检 提醒 健康 状态 项目',
        null,
        {
          purpose: proactivePurpose,
          archiveFacts: Array.isArray(currentLongTermMemory.factArchive) ? currentLongTermMemory.factArchive : [],
        },
      ).slice(0, 6);
      const reconfirmFacts = collectLongTermFactsNeedingReconfirmation(
        Array.isArray(currentLongTermMemory.facts) ? currentLongTermMemory.facts : [],
        3,
      );
      queueMorphMemoryReconfirmationTasksFromFacts(reconfirmFacts);

      const findings = [];
      const preferReserved = proactivity.defaultMode === 'reserved';
      const preferProactive = proactivity.defaultMode === 'proactive';
      const reminderList = getRuntimeReminderList();
      const nowMs = safeNow.getTime();
      const pending = reminderList
        .filter((item) => item && String(item.status || 'pending') === 'pending' && Number.isFinite(Number(item.dueAtMs)));
      const overdueCutoff = nowMs - Number(safeConfig.overdueReminderMinutes || 15) * 60 * 1000;
      const overdue = pending
        .filter((item) => Number(item.dueAtMs) <= overdueCutoff)
        .sort((a, b) => Number(a.dueAtMs || 0) - Number(b.dueAtMs || 0));
      if (overdue.length) {
        const first = overdue[0];
        const firstReminderText = repairPossibleMojibake(String(first.text || '未命名提醒')).slice(0, 40);
        findings.push({
          key: `reminder_overdue_${Math.min(9, overdue.length)}`,
          severity: 'high',
          summary: `你有 ${overdue.length} 条提醒已超时，最早一条是「${firstReminderText}」。`,
          hint: '建议先清理超时提醒，避免后续同步噪音。',
        });
      }

      const soonWindowMs = Number(safeConfig.soonReminderMinutes || 45) * 60 * 1000;
      const soon = pending
        .filter((item) => {
          const due = Number(item.dueAtMs || 0);
          return due > nowMs && due <= nowMs + soonWindowMs;
        })
        .sort((a, b) => Number(a.dueAtMs || 0) - Number(b.dueAtMs || 0))
        .slice(0, 3);
      if (soon.length) {
        const names = soon.map((item) => repairPossibleMojibake(String(item.text || '提醒')).slice(0, 24)).join('、');
        findings.push({
          key: `reminder_soon_${soon.length}`,
          severity: 'medium',
          summary: `接下来 ${safeConfig.soonReminderMinutes} 分钟有 ${soon.length} 条提醒：${names}。`,
          hint: '建议提前预留 5-10 分钟切换。',
        });
      }

      const daily = analyzeTodayDailyLogCompletion();
      const parts = getProactiveDatePartsInTimezone(safeNow);
      const currentMinutes = parts ? parts.hour * 60 + parts.minute : 0;
      if ((preferProactive ? currentMinutes >= 10 * 60 : currentMinutes >= 12 * 60) && (!daily.hasHeader || daily.filledLines === 0)) {
        findings.push({
          key: 'daily_empty_today',
          severity: 'medium',
          summary: '今日日志还没有有效内容。',
          hint: '可先写 1 行进展 + 1 条下一步，后续再补细节。',
        });
      }
      if (!preferReserved && daily.todoTotal >= 4 && daily.todoDone === 0 && currentMinutes >= 14 * 60) {
        findings.push({
          key: `daily_todo_stuck_${daily.todoTotal}`,
          severity: 'low',
          summary: `今日日志里有 ${daily.todoTotal} 条待办仍未勾选。`,
          hint: '建议先完成最小一步，避免任务堆积。',
        });
      }

      const data = getRuntimeData();
      const ungrouped = Array.isArray(data?.flashThoughts)
        ? data.flashThoughts.filter((item) => !String(item?.clusterId || '').trim())
        : [];
      if (!preferReserved && ungrouped.length >= (preferProactive ? 16 : 24)) {
        findings.push({
          key: `flash_ungrouped_${Math.min(60, ungrouped.length)}`,
          severity: 'low',
          summary: `未分组闪念累计 ${ungrouped.length} 条，检索成本会变高。`,
          hint: '可触发一次 AI 分组与去重。',
        });
      }

      const glucoseUpdatedAt = Date.parse(String(data?.glucoseSync?.updatedAt || ''));
      if (Number.isFinite(glucoseUpdatedAt) && glucoseUpdatedAt > 0 && nowMs - glucoseUpdatedAt > 100 * 60 * 1000) {
        findings.push({
          key: 'glucose_stale_sync',
          severity: 'low',
          summary: '血糖数据已超过 100 分钟未刷新。',
          hint: '建议检查网络、账号状态或手动同步一次。',
        });
      }

      if (reconfirmFacts.length && !preferReserved) {
        const labels = reconfirmFacts
          .map((fact) => String(fact.label || fact.key || '长期记忆').trim())
          .filter(Boolean);
        findings.push({
          key: `memory_reconfirm_${labels.join('_').slice(0, 36) || reconfirmFacts.length}`,
          severity: preferProactive ? 'medium' : 'low',
          summary: `有 ${reconfirmFacts.length} 条长期记忆已经久未确认：${labels.join('、')}。`,
          hint: '后续遇到相关话题时，先用一句轻量确认再继续，不要直接把旧记忆当成当前事实。',
        });
      }

      const severityRank = { high: 3, medium: 2, low: 1 };
      findings.sort((a, b) => {
        const severityDelta = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
        if (severityDelta !== 0) return severityDelta;
        const memoryDelta = scoreProactiveFindingAgainstLongTermFacts(b, relevantLongTermFacts)
          - scoreProactiveFindingAgainstLongTermFacts(a, relevantLongTermFacts);
        if (memoryDelta !== 0) return memoryDelta;
        return String(b.summary || '').length - String(a.summary || '').length;
      });
      return findings.slice(0, Math.max(1, Number(safeConfig.maxFindingsPerScan || 3)));
    }

    function normalizeProactiveDigestLine(text = '') {
      return String(text || '')
        .replace(/^今日日志还没有有效内容。?$/u, '你今天的日志还几乎没动。')
        .replace(/^今日日志里有 (\d+) 条待办仍未勾选。?$/u, '你今天还有 $1 条待办没动。')
        .replace(/^未分组闪念累计 (\d+) 条，检索成本会变高。?$/u, '没分组的闪念已经攒到 $1 条了，之后会越来越乱。')
        .replace(/^血糖数据已超过 100 分钟未刷新。?$/u, '血糖这边有一阵没刷新了。')
        .replace(/^你有 (\d+) 条提醒已超时，最早一条是「(.+)」。$/u, '你有 $1 条提醒已经过点了，最早那条是「$2」。')
        .replace(/^接下来 (\d+) 分钟有 (\d+) 条提醒：(.+)。$/u, '接下来 $1 分钟里有 $2 条提醒，主要是：$3。')
        .replace(/^有 (\d+) 条长期记忆已经久未确认：(.+)。$/u, '有 $1 条我已经很久没和你确认过的长期理解：$2。');
    }

    function normalizeProactiveDigestHint(text = '') {
      return String(text || '')
        .replace(/^建议先清理超时提醒，避免后续同步噪音。?$/u, '先把过点提醒收一收，会轻松很多。')
        .replace(/^建议提前预留 5-10 分钟切换。?$/u, '可以提前留 5 到 10 分钟切一下状态。')
        .replace(/^可先写 1 行进展 \+ 1 条下一步，后续再补细节。?$/u, '哪怕先写 1 行进展、1 条下一步也行。')
        .replace(/^建议先完成最小一步，避免任务堆积。?$/u, '先动最小一步，就不容易越堆越重。')
        .replace(/^可触发一次 AI 分组与去重。?$/u, '找个顺手的时候分一下组就够了。')
        .replace(/^建议检查网络、账号状态或手动同步一次。?$/u, '方便的话，等会儿手动同步一下就好。')
        .replace(/^后续遇到相关话题时，先用一句轻量确认再继续，不要直接把旧记忆当成当前事实。?$/u, '之后再聊到这类事，我会先轻轻确认一下。');
    }

    function formatProactiveDigest(findings = [], now = new Date(), source = 'scheduler') {
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      const reminder = typeof api.sanitizeRelationshipReminderPreferences === 'function'
        ? api.sanitizeRelationshipReminderPreferences(aiMemory?.relationshipMode?.reminderPreferences)
        : (aiMemory?.relationshipMode?.reminderPreferences || {});
      const safeReminder = reminder && typeof reminder === 'object' ? reminder : {};
      const proactivity = typeof api.sanitizeRelationshipProactivityPreferences === 'function'
        ? api.sanitizeRelationshipProactivityPreferences(aiMemory?.relationshipMode?.proactivityPreferences)
        : (aiMemory?.relationshipMode?.proactivityPreferences || {});
      const safeProactivity = proactivity && typeof proactivity === 'object' ? proactivity : {};
      const parts = getProactiveDatePartsInTimezone(now);
      const timeText = parts ? `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}` : '--:--';
      const lead = safeReminder.tone === 'direct'
        ? '我先直接说重点。'
        : safeReminder.tone === 'minimal'
          ? '轻提醒一下。'
          : '我先轻轻提醒你一下。';
      const lines = (Array.isArray(findings) ? findings : []).map((item) => {
        const summary = normalizeProactiveDigestLine(item?.summary);
        const hint = normalizeProactiveDigestHint(item?.hint || '');
        return `${summary}${safeReminder.tone === 'minimal' || !hint ? '' : ` ${hint}`}`;
      });
      const tail = safeProactivity.defaultMode === 'reserved'
        ? '如果你现在不想处理，先放着也没关系。'
        : safeProactivity.defaultMode === 'proactive'
          ? '如果你愿意，就先动最上面那一条。'
          : '先从最重要的一条开始就够了。';
      return `（${timeText}）${lead}\n${lines.map((line, idx) => `${idx + 1}. ${line}`).join('\n')}\n${tail}`;
    }

    function buildProactiveCarryoverReminder(findings = [], now = new Date(), source = 'scheduler') {
      if (!Array.isArray(findings) || !findings.length) return null;
      const reminder = typeof api.sanitizeRelationshipReminderPreferences === 'function'
        ? api.sanitizeRelationshipReminderPreferences(typeof api.getAIMemory === 'function'
          ? api.getAIMemory()?.relationshipMode?.reminderPreferences
          : null)
        : (typeof api.getAIMemory === 'function'
          ? api.getAIMemory()?.relationshipMode?.reminderPreferences || {}
          : {});
      const safeReminder = reminder && typeof reminder === 'object' ? reminder : {};
      const top = findings[0] || {};
      const digest = formatProactiveDigest([top], now, source);
      const cleaned = String(digest || '')
        .replace(/^（\d{2}:\d{2}）/u, '')
        .replace(/^我先轻轻提醒你一下。/u, '')
        .replace(/^轻提醒一下。/u, '')
        .replace(/^我先直接说重点。/u, '')
        .trim();
      const firstLine = cleaned.split('\n').map((line) => line.replace(/^\d+\.\s*/, '').trim()).find(Boolean) || '';
      if (!firstLine) return null;
      const severity = String(top.severity || 'low');
      const transitionHint = severity === 'high'
        ? '先提醒你一件更要紧的事。'
        : safeReminder.tone === 'direct'
          ? '顺手提醒你一下。'
          : '对了，顺手提醒你一下。';
      return {
        message: firstLine,
        createdAt: new Date().toISOString(),
        severity,
        source: String(source || 'scheduler'),
        transitionHint,
      };
    }

    function buildMorphInternalProactiveGuidance(findings = [], source = 'scheduler') {
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      const workingMemory = typeof api.getMorphWorkingMemory === 'function'
        ? api.getMorphWorkingMemory(aiMemory)
        : (aiMemory?.workingMemory || {});
      const dualGuidance = workingMemory?.dualGuidance && typeof workingMemory.dualGuidance === 'object'
        ? (typeof api.sanitizeMorphDualGuidance === 'function' ? api.sanitizeMorphDualGuidance(workingMemory.dualGuidance) : workingMemory.dualGuidance)
        : (typeof api.sanitizeMorphDualGuidance === 'function' ? api.sanitizeMorphDualGuidance(null) : {});
      const findingList = Array.isArray(findings) ? findings : [];
      const hasHighSeverity = findingList.some((item) => String(item?.severity || '').trim() === 'high');
      const hasStructuralFinding = findingList.some((item) => /daily_|flash_|reminder_|glucose_/.test(String(item?.key || '').trim()));
      const hasMemoryFinding = findingList.some((item) => String(item?.key || '').trim().startsWith('memory_reconfirm_'));
      let surfaceThresholdAdjustment = 0;
      let persistenceThresholdAdjustment = 0;
      let allowSoftPersistence = true;
      const notes = [];

      if (dualGuidance.dominantMode === 'oracle') {
        surfaceThresholdAdjustment += source === 'heartbeat' ? 0.9 : 0.55;
        persistenceThresholdAdjustment += hasMemoryFinding ? 1.1 : 0.7;
        if (dualGuidance.actionBias === 'hold-space') {
          allowSoftPersistence = false;
          notes.push('当前更偏 Oracle / hold-space，后台提醒和沉淀阈值上调。');
        } else {
          notes.push('当前更偏 Oracle，后台提醒要更克制。');
        }
      } else if (dualGuidance.dominantMode === 'architect') {
        surfaceThresholdAdjustment -= hasStructuralFinding ? 0.4 : 0.2;
        persistenceThresholdAdjustment -= (hasStructuralFinding || hasMemoryFinding) ? 0.55 : 0.2;
        notes.push('当前更偏 Architect，结构性提醒和沉淀阈值下调。');
      } else {
        notes.push('当前 Oracle / Architect 保持平衡。');
      }

      if (source === 'heartbeat' && dualGuidance.dominantMode !== 'architect') {
        surfaceThresholdAdjustment += 0.25;
      }
      if (hasHighSeverity) {
        surfaceThresholdAdjustment -= 0.6;
        persistenceThresholdAdjustment -= 0.4;
        allowSoftPersistence = true;
        notes.push('存在高优先级事项，允许打破部分克制。');
      }

      return {
        dominantMode: dualGuidance.dominantMode,
        actionBias: dualGuidance.actionBias,
        surfaceThresholdAdjustment,
        persistenceThresholdAdjustment,
        allowSoftPersistence,
        notes: notes.slice(0, 3),
      };
    }

    function shouldSurfaceProactiveDigest(chatFindings = [], source = 'scheduler', config = null, internalGuidance = null) {
      if (!Array.isArray(chatFindings) || !chatFindings.length) return false;
      if (source === 'ai-action') return true;
      const hasCritical = chatFindings.some((item) => String(item?.severity || '') === 'high');
      if (hasCritical) return true;
      const safeConfig = typeof api.sanitizeMorphProactiveAgentConfig === 'function'
        ? api.sanitizeMorphProactiveAgentConfig(config)
        : (config || {});
      if (safeConfig.autoPushToChat === false) return false;
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      const proactivity = typeof api.sanitizeRelationshipProactivityPreferences === 'function'
        ? api.sanitizeRelationshipProactivityPreferences(aiMemory?.relationshipMode?.proactivityPreferences)
        : (aiMemory?.relationshipMode?.proactivityPreferences || {});
      const selfMemory = typeof api.getMorphSelfMemory === 'function' ? api.getMorphSelfMemory(aiMemory) : null;
      const severityScore = chatFindings.reduce((sum, item) => {
        const severity = String(item?.severity || '');
        return sum + (severity === 'high' ? 3 : severity === 'medium' ? 1.4 : 0.4);
      }, 0);
      let threshold = 3;
      if (proactivity.defaultMode === 'proactive') threshold -= 0.35;
      if (proactivity.defaultMode === 'reserved') threshold += 0.65;
      if (hasMorphLowDisturbProactiveBias(selfMemory)) threshold += 0.75;
      if (source === 'heartbeat') threshold += 0.5;
      if (internalGuidance && typeof internalGuidance === 'object') {
        threshold += Number(internalGuidance.surfaceThresholdAdjustment || 0);
      }
      return severityScore >= threshold;
    }

    function shouldPersistProactiveDigestToInteractionMemory(chatFindings = [], source = 'scheduler', config = null, internalGuidance = null) {
      if (!Array.isArray(chatFindings) || !chatFindings.length) return false;
      if (source === 'ai-action') return true;
      const safeConfig = typeof api.sanitizeMorphProactiveAgentConfig === 'function'
        ? api.sanitizeMorphProactiveAgentConfig(config)
        : (config || {});
      if (safeConfig.autoWriteMemory === false) return false;
      const severityScore = chatFindings.reduce((sum, item) => {
        const severity = String(item?.severity || '');
        return sum + (severity === 'high' ? 3 : severity === 'medium' ? 1.5 : 0.45);
      }, 0);
      let threshold = 3;
      if (source === 'heartbeat') threshold += 0.4;
      if (internalGuidance && typeof internalGuidance === 'object') {
        threshold += Number(internalGuidance.persistenceThresholdAdjustment || 0);
        if (internalGuidance.allowSoftPersistence === false && !chatFindings.some((item) => String(item?.severity || '') === 'high')) {
          return false;
        }
      }
      return severityScore >= threshold;
    }

    function buildProactiveNotificationCopy(findings = [], now = new Date()) {
      if (!Array.isArray(findings) || !findings.length) return null;
      const top = findings[0] || {};
      const severity = String(top.severity || 'low');
      if (severity !== 'high') return null;
      const userName = typeof api.inferKnownUserNameFromMemory === 'function'
        ? api.inferKnownUserNameFromMemory()
        : '';
      const title = userName
        ? `${userName}，不好意思打扰了`
        : '不好意思打扰了';
      const carryover = typeof api.buildProactiveCarryoverReminder === 'function'
        ? api.buildProactiveCarryoverReminder([top], now, 'notification')
        : buildProactiveCarryoverReminder([top], now, 'notification');
      const body = carryover?.message || String(top.summary || '').trim();
      if (!body) return null;
      return {
        title,
        body: `但我得提醒你一下：${body}`.trim(),
      };
    }

    return {
      hasMorphLowDisturbProactiveBias,
      analyzeTodayDailyLogCompletion,
      repairPossibleMojibake,
      buildProactiveAgentFindings,
      queuePendingProactiveReminder,
      formatProactiveDigest,
      buildProactiveCarryoverReminder,
      buildMorphInternalProactiveGuidance,
      shouldSurfaceProactiveDigest,
      shouldPersistProactiveDigestToInteractionMemory,
      buildProactiveNotificationCopy,
    };
  }

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createProactiveDepsRuntime(root) {
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
        getData: pickFunction(context.getData, () => getGlobalValue('data', null)),
        getReminderList: pickFunction(context.getReminderList, getGlobalFunction('getReminderList') || (() => [])),
        getAIMemory: pickFunction(context.getAIMemory, getGlobalFunction('getAIMemory') || (() => null)),
        getMorphLongTermMemory: pickFunction(context.getMorphLongTermMemory, getGlobalFunction('getMorphLongTermMemory') || (() => ({}))),
        getMorphWorkingMemory: pickFunction(context.getMorphWorkingMemory, getGlobalFunction('getMorphWorkingMemory') || (() => ({}))),
        getMorphSelfMemory: pickFunction(context.getMorphSelfMemory, getGlobalFunction('getMorphSelfMemory') || (() => ({}))),
        prioritizeLongTermMemoryFacts: pickFunction(
          context.prioritizeLongTermMemoryFacts,
          getGlobalFunction('prioritizeLongTermMemoryFactsRuntime') || getGlobalFunction('prioritizeLongTermMemoryFacts') || ((facts = []) => (Array.isArray(facts) ? facts : []))
        ),
        collectLongTermFactsNeedingReconfirmation: pickFunction(
          context.collectLongTermFactsNeedingReconfirmation,
          getGlobalFunction('collectLongTermFactsNeedingReconfirmation') || ((facts = []) => (Array.isArray(facts) ? facts : []))
        ),
        queueMorphMemoryReconfirmationTasksFromFacts: pickFunction(
          context.queueMorphMemoryReconfirmationTasksFromFacts,
          getGlobalFunction('queueMorphMemoryReconfirmationTasksFromFacts') || (() => [])
        ),
        scoreProactiveFindingAgainstLongTermFacts: pickFunction(
          context.scoreProactiveFindingAgainstLongTermFacts,
          getGlobalFunction('scoreProactiveFindingAgainstLongTermFacts') || (() => 0)
        ),
        sanitizeMorphDualGuidance: pickFunction(
          context.sanitizeMorphDualGuidance,
          getGlobalFunction('sanitizeMorphDualGuidance') || ((value) => value)
        ),
        sanitizeMorphProactiveAgentConfig: pickFunction(
          context.sanitizeMorphProactiveAgentConfig,
          getGlobalFunction('sanitizeMorphProactiveAgentConfig') || ((value) => (value && typeof value === 'object' ? value : {}))
        ),
        sanitizeRelationshipProactivityPreferences: pickFunction(
          context.sanitizeRelationshipProactivityPreferences,
          getGlobalFunction('sanitizeRelationshipProactivityPreferences') || ((value) => (value && typeof value === 'object' ? value : {}))
        ),
        sanitizeRelationshipReminderPreferences: pickFunction(
          context.sanitizeRelationshipReminderPreferences,
          getGlobalFunction('sanitizeRelationshipReminderPreferences') || ((value) => (value && typeof value === 'object' ? value : {}))
        ),
        inferKnownUserNameFromMemory: pickFunction(
          context.inferKnownUserNameFromMemory,
          getGlobalFunction('inferKnownUserNameFromMemory') || (() => '')
        ),
        getDatePartsInTimezone: pickFunction(
          context.getDatePartsInTimezone,
          getGlobalFunction('getDatePartsInTimezone') || (() => null)
        ),
        getAITimezone: pickFunction(
          context.getAITimezone,
          () => String(getGlobalValue('AI_TIMEZONE', 'Asia/Shanghai') || 'Asia/Shanghai').trim() || 'Asia/Shanghai'
        ),
        buildProactiveCarryoverReminder: pickFunction(
          context.buildProactiveCarryoverReminder,
          getGlobalFunction('buildProactiveCarryoverReminder') || (() => null)
        ),
      };
    }

    return { buildAppDeps };
  }

  window.MorphProactiveRuntime = { create: createProactiveRuntime };
  window.MorphProactiveDepsRuntime = { create: () => createProactiveDepsRuntime(window) };
})();
