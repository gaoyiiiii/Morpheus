// @ts-check

(function initMorphReminderDailyRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphReminderDailyRuntime && typeof window.MorphReminderDailyRuntime.create === 'function') return;

  function createReminderDailyRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getDataRoot() {
      return typeof api.getData === 'function' ? api.getData() : null;
    }

    function getReminderList() {
      return typeof api.getReminderList === 'function' ? api.getReminderList() : [];
    }

    function getReminderAutoDisplayVariants(reminder) {
      if (typeof api.getReminderAutoDisplayVariants === 'function') return api.getReminderAutoDisplayVariants(reminder);
      return new Set();
    }

    function getDatePartsInTimezone(date, timezone) {
      if (typeof api.getDatePartsInTimezone === 'function') return api.getDatePartsInTimezone(date, timezone);
      return null;
    }

    function getAITimezone() {
      return typeof api.getAITimezone === 'function' ? String(api.getAITimezone() || '').trim() || 'Asia/Shanghai' : 'Asia/Shanghai';
    }

    function formatYMDFromParts(parts) {
      if (typeof api.formatYMDFromParts === 'function') return api.formatYMDFromParts(parts);
      const year = Number(parts?.year || 0);
      const month = Number(parts?.month || 0);
      const day = Number(parts?.day || 0);
      if (!year || !month || !day) return '';
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function ensureDailyDateHeader(monthKey, dateStr) {
      if (typeof api.ensureDailyDateHeader === 'function') return api.ensureDailyDateHeader(monthKey, dateStr);
      const root = getDataRoot();
      if (!root || typeof root !== 'object') return [];
      if (!root.dailyMonths || typeof root.dailyMonths !== 'object') root.dailyMonths = {};
      if (!Array.isArray(root.dailyMonths[monthKey])) root.dailyMonths[monthKey] = [];
      return root.dailyMonths[monthKey];
    }

    function extractDailyDateFromHeaderContent(content = '') {
      if (typeof api.extractDailyDateFromHeaderContent === 'function') return api.extractDailyDateFromHeaderContent(content);
      const matched = String(content || '').match(/\d{4}-\d{2}-\d{2}/);
      return matched ? matched[0] : '';
    }

    function formatReminderDisplayTime(reminder) {
      if (typeof api.formatReminderDisplayTime === 'function') return api.formatReminderDisplayTime(reminder);
      return '';
    }

    function formatReminderStatusPrefix(reminder) {
      if (typeof api.formatReminderStatusPrefix === 'function') return api.formatReminderStatusPrefix(reminder);
      return '';
    }

    function getReminderDisplayText(reminder) {
      if (typeof api.getReminderDisplayText === 'function') return api.getReminderDisplayText(reminder);
      return String(reminder?.text || '').trim();
    }

    function genId() {
      if (typeof api.genId === 'function') return api.genId();
      return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function isReminderCompletedForDailyLog(reminder) {
      const status = String(reminder?.status || '').trim().toLowerCase();
      if (['notified', 'done', 'completed', 'complete', 'finished'].includes(status)) return true;
      const dueAtMs = Number(reminder?.dueAtMs || 0);
      return Number.isFinite(dueAtMs) && dueAtMs > 0 && dueAtMs <= Date.now();
    }

    function shouldRenderReminderInDailyLog(reminder) {
      if (!reminder || !Number.isFinite(Number(reminder.dueAtMs))) return false;
      if (reminder.dailyLogDismissed === true && isReminderCompletedForDailyLog(reminder)) return false;
      return true;
    }

    function syncReminderBlocksIntoDailyMonth(monthKey) {
      const key = String(monthKey || '').trim();
      if (!key) return;
      const root = getDataRoot();
      if (!root || typeof root !== 'object') return;
      if (!root.dailyMonths || typeof root.dailyMonths !== 'object') root.dailyMonths = {};
      if (!root.dailyMonths[key]) root.dailyMonths[key] = [];
      const blocks = root.dailyMonths[key];
      if (!Array.isArray(blocks)) return;

      const reminders = getReminderList()
        .filter((entry) => shouldRenderReminderInDailyLog(entry))
        .slice()
        .sort((a, b) => Number(a.dueAtMs) - Number(b.dueAtMs));
      if (!reminders.length) return;

      const reminderMap = new Map(reminders.map((entry) => [String(entry?.id || ''), entry]));
      for (let index = blocks.length - 1; index >= 0; index -= 1) {
        const block = blocks[index];
        if (block?.autoReminder !== true) continue;
        const reminderId = String(block?.reminderId || '');
        const reminder = reminderMap.get(reminderId);
        if (!reminder) {
          blocks.splice(index, 1);
          continue;
        }
        const currentText = String(block.content || '').trim();
        const variants = getReminderAutoDisplayVariants(reminder);
        if (block.type === 'p' && variants.has(currentText)) {
          blocks.splice(index, 1);
          continue;
        }
        if (block.type !== 'p') {
          delete block.autoReminder;
          delete block.reminderId;
          continue;
        }
        delete block.autoReminder;
        delete block.reminderId;
      }

      const groupedByDate = new Map();
      reminders.forEach((reminder) => {
        const parts = getDatePartsInTimezone(new Date(Number(reminder.dueAtMs)), getAITimezone());
        const dateKey = formatYMDFromParts(parts);
        if (!dateKey || !dateKey.startsWith(`${key}-`)) return;
        if (!groupedByDate.has(dateKey)) groupedByDate.set(dateKey, []);
        groupedByDate.get(dateKey).push(reminder);
      });
      if (groupedByDate.size === 0) return;

      Array.from(groupedByDate.keys()).forEach((dateKey) => {
        ensureDailyDateHeader(key, dateKey);
      });

      const headerIndexMap = new Map();
      blocks.forEach((block, index) => {
        if (block?.type !== 'h3') return;
        const dateKey = extractDailyDateFromHeaderContent(block.content);
        if (dateKey) headerIndexMap.set(dateKey, index);
      });

      Array.from(groupedByDate.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .forEach(([dateKey, dayReminders]) => {
          const headerIndex = headerIndexMap.get(dateKey);
          if (!Number.isInteger(headerIndex)) return;
          const injectBlocks = dayReminders
            .map((reminder) => {
              const displayTime = formatReminderDisplayTime(reminder);
              const statusPrefix = formatReminderStatusPrefix(reminder);
              return {
                id: genId(),
                type: 'p',
                content: `${statusPrefix} ${displayTime ? `${displayTime} ` : ''}${getReminderDisplayText(reminder)}`.trim(),
                checked: false,
                autoReminder: true,
                reminderId: reminder.id || '',
              };
            })
            .filter((block) => String(block.content || '').trim());
          if (!injectBlocks.length) return;
          blocks.splice(headerIndex + 1, 0, ...injectBlocks);
          headerIndexMap.forEach((value, mapKey) => {
            if (value > headerIndex) headerIndexMap.set(mapKey, value + injectBlocks.length);
          });
        });
    }

    return {
      syncReminderBlocksIntoDailyMonth,
    };
  }

  window.MorphReminderDailyRuntime = {
    create: createReminderDailyRuntime,
  };
})();
