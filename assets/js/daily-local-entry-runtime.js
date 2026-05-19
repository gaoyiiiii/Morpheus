// @ts-check

(function initMorphDailyLocalEntryRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphDailyLocalEntryRuntime && typeof window.MorphDailyLocalEntryRuntime.create === 'function') return;

  function createDailyLocalEntryRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getMonthStr() {
      return typeof api.getMonthStr === 'function' ? String(api.getMonthStr() || '').trim() : '';
    }

    function getTodayStr() {
      return typeof api.getTodayStr === 'function' ? String(api.getTodayStr() || '').trim() : '';
    }

    function initDailyMonth(monthKey = '') {
      if (typeof api.initDailyMonth === 'function') api.initDailyMonth(monthKey);
    }

    function getDataRoot() {
      return typeof api.getDataRoot === 'function' ? api.getDataRoot() : null;
    }

    function genId() {
      if (typeof api.genId === 'function') return api.genId();
      return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function parseManagedBlocksFromText(text = '', options = {}) {
      if (typeof api.parseManagedBlocksFromText === 'function') return api.parseManagedBlocksFromText(text, options);
      return [];
    }

    function ingestRemindersFromDailyLogs(root, options = {}) {
      if (typeof api.ingestRemindersFromDailyLogs === 'function') api.ingestRemindersFromDailyLogs(root, options);
    }

    function syncReminderBlocksIntoDailyMonth(monthKey = '') {
      if (typeof api.syncReminderBlocksIntoDailyMonth === 'function') api.syncReminderBlocksIntoDailyMonth(monthKey);
    }

    function getNow() {
      if (typeof api.getNow === 'function') {
        const value = api.getNow();
        if (value instanceof Date) return value;
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      return new Date();
    }

    function ensureTodayDailyLogReady() {
      const monthKey = getMonthStr();
      const todayStr = getTodayStr();
      initDailyMonth(monthKey);
      return { monthKey, todayStr };
    }

    function ensureDailyDateHeader(monthKey, dateStr) {
      const root = getDataRoot();
      if (!root || typeof root !== 'object') return [];
      if (!monthKey || !dateStr) return [];
      if (!root.dailyMonths || typeof root.dailyMonths !== 'object') root.dailyMonths = {};
      if (!Array.isArray(root.dailyMonths[monthKey])) root.dailyMonths[monthKey] = [];
      const blocks = root.dailyMonths[monthKey];
      const headerIndex = blocks.findIndex((block) => block?.type === 'h3' && String(block?.content || '').includes(dateStr));
      if (headerIndex >= 0) return blocks;
      blocks.push({ id: genId(), type: 'h3', content: `[ 日志 ] ${dateStr}`, checked: false });
      blocks.push({ id: genId(), type: 'p', content: '', checked: false });
      return blocks;
    }

    function appendToDailyLogUnderDateDetailed(monthKey, dateStr, text = '', options = {}) {
      const root = getDataRoot();
      const blocks = ensureDailyDateHeader(monthKey, dateStr);
      const insertBlocks = parseManagedBlocksFromText(text, options);
      if (!insertBlocks.length) {
        return { count: 0, monthKey, dateStr, blockIds: [], blockContents: [], insertIndex: -1, updatedAt: '' };
      }
      const headerIndex = blocks.findIndex((block) => block?.type === 'h3' && String(block?.content || '').includes(dateStr));
      let insertAt = headerIndex >= 0 ? headerIndex + 1 : blocks.length;
      while (blocks[insertAt]?.autoReminder === true) insertAt += 1;
      if (blocks[insertAt] && blocks[insertAt].type === 'p' && !String(blocks[insertAt].content || '').trim()) blocks.splice(insertAt, 1);
      insertBlocks.forEach((block) => {
        if (!String(block?.id || '').trim()) block.id = genId();
      });
      blocks.splice(insertAt, 0, ...insertBlocks);
      ingestRemindersFromDailyLogs(root, { monthKeys: [monthKey], sourceTag: 'daily-log-local' });
      syncReminderBlocksIntoDailyMonth(monthKey);
      const updatedAt = getNow().toISOString();
      return {
        count: insertBlocks.length,
        monthKey,
        dateStr,
        blockIds: insertBlocks.map((block) => String(block?.id || '').trim()).filter(Boolean),
        blockContents: insertBlocks.map((block) => String(block?.content || '').trim()),
        insertIndex: insertAt,
        updatedAt,
        textPreview: String(text || '').trim().slice(0, 80),
      };
    }

    function appendToDailyLogUnderDate(monthKey, dateStr, text = '', options = {}) {
      const result = appendToDailyLogUnderDateDetailed(monthKey, dateStr, text, options);
      return Number(result?.count || 0);
    }

    function appendToTodayDailyLog(text = '', options = {}) {
      const { monthKey, todayStr } = ensureTodayDailyLogReady();
      return appendToDailyLogUnderDate(monthKey, todayStr, text, options);
    }

    function appendToTodayDailyLogDetailed(text = '', options = {}) {
      const { monthKey, todayStr } = ensureTodayDailyLogReady();
      return appendToDailyLogUnderDateDetailed(monthKey, todayStr, text, options);
    }

    function summarizeTodayDailyLogLocally() {
      const root = getDataRoot();
      const { monthKey, todayStr } = ensureTodayDailyLogReady();
      const blocks = root?.dailyMonths?.[monthKey] || [];
      const headerIndex = blocks.findIndex((block) => block?.type === 'h3' && String(block?.content || '').includes(todayStr));
      if (headerIndex < 0) return '';
      const lines = [];
      for (let index = headerIndex + 1; index < blocks.length; index += 1) {
        const block = blocks[index];
        if (block?.type === 'h3') break;
        const content = String(block?.content || '').trim();
        if (!content) continue;
        if (block?.type === 'todo') lines.push(`${block.checked ? '已完成' : '待推进'}：${content}`);
        else lines.push(content);
        if (lines.length >= 5) break;
      }
      if (!lines.length) return '';
      return `今日小结：\n${lines.map((line) => `- ${line}`).join('\n')}`;
    }

    return {
      ensureTodayDailyLogReady,
      ensureDailyDateHeader,
      appendToDailyLogUnderDate,
      appendToTodayDailyLog,
      appendToTodayDailyLogDetailed,
      appendToDailyLogUnderDateDetailed,
      summarizeTodayDailyLogLocally,
    };
  }

  window.MorphDailyLocalEntryRuntime = {
    create: createDailyLocalEntryRuntime,
  };
})();
