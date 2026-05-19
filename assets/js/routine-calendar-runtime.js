// @ts-check

(function initMorphRoutineCalendarRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphRoutineCalendarRuntime && typeof window.MorphRoutineCalendarRuntime.create === 'function') return;

  function createRoutineCalendarRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const AI_WEEK_DRAFT_TAG = String(api.aiWeekDraftTag || '[AI周计划草案]');
    const AI_TODAY_DRAFT_TAG = String(api.aiTodayDraftTag || '[AI今日日程]');

    function getRoutineCalendarState() {
      if (typeof api.getRoutineCalendarState === 'function') {
        const state = api.getRoutineCalendarState();
        if (state && typeof state === 'object') return state;
      }
      return null;
    }

    function getDataRoot() {
      if (typeof api.getDataRoot === 'function') {
        const dataRoot = api.getDataRoot();
        if (dataRoot && typeof dataRoot === 'object') return dataRoot;
      }
      return null;
    }

    function getAIChatState() {
      if (typeof api.getAIChatState === 'function') {
        const state = api.getAIChatState();
        if (state && typeof state === 'object') return state;
      }
      return null;
    }

    function getTodayStr() {
      if (typeof api.getTodayStr === 'function') {
        const value = String(api.getTodayStr() || '').trim();
        if (value) return value;
      }
      return formatRoutineCalendarDate(new Date());
    }

    function parseRoutineCalendarDate(value) {
      const text = String(value || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date();
      const parsed = new Date(`${text}T12:00:00`);
      return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    }

    function formatRoutineCalendarDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function addRoutineCalendarDays(date, days) {
      const next = new Date(date);
      next.setDate(next.getDate() + days);
      return next;
    }

    function addRoutineCalendarMonths(date, months) {
      const next = new Date(date);
      next.setMonth(next.getMonth() + months);
      return next;
    }

    function addRoutineCalendarYears(date, years) {
      const next = new Date(date);
      next.setFullYear(next.getFullYear() + years);
      return next;
    }

    function startOfRoutineCalendarWeek(date) {
      const next = new Date(date);
      const day = next.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      next.setDate(next.getDate() + diff);
      next.setHours(0, 0, 0, 0);
      return next;
    }

    function getRoutineCalendarShiftAnchor(step = 0) {
      const state = getRoutineCalendarState();
      const anchor = parseRoutineCalendarDate(state?.anchorDate || '');
      const offset = Number(step) || 0;
      if (!state) return addRoutineCalendarDays(anchor, offset);
      if (state.view === 'day') return addRoutineCalendarDays(anchor, offset);
      if (state.view === 'week') return addRoutineCalendarDays(anchor, offset * 7);
      if (state.view === 'month') return addRoutineCalendarMonths(anchor, offset);
      if (state.view === 'year') return addRoutineCalendarYears(anchor, offset);
      return addRoutineCalendarDays(anchor, offset);
    }

    function parseRoutineScheduleDraft(rawInput, defaultDate) {
      const parts = String(rawInput || '').split('|').map((part) => part.trim()).filter(Boolean);
      if (!parts.length) return null;
      let title = parts[0] || '';
      let date = defaultDate;
      let startTime = '09:00';
      let endTime = '10:00';
      if (parts[1] && /^\d{4}-\d{2}-\d{2}$/.test(parts[1])) {
        date = parts[1];
        if (parts[2] && /^\d{2}:\d{2}$/.test(parts[2])) startTime = parts[2];
        if (parts[3] && /^\d{2}:\d{2}$/.test(parts[3])) endTime = parts[3];
      } else {
        if (parts[1] && /^\d{2}:\d{2}$/.test(parts[1])) startTime = parts[1];
        if (parts[2] && /^\d{2}:\d{2}$/.test(parts[2])) endTime = parts[2];
      }
      title = title.trim();
      if (!title) return null;
      return { title, date, startTime, endTime };
    }

    function ensureUnifiedRoutineCalendarBucket() {
      const dataRoot = getDataRoot();
      if (!dataRoot || !Array.isArray(dataRoot.routines)) return null;
      let bucket = dataRoot.routines.find((item) => item && item.calendarUnified === true);
      if (bucket) return bucket;
      bucket = dataRoot.routines[0];
      if (bucket) return bucket;
      const genId = typeof api.genId === 'function' ? api.genId : () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      bucket = {
        id: genId(),
        name: '统一日历',
        calendarUnified: true,
        items: [],
        blocks: [{ id: genId(), type: 'p', content: '', checked: false }],
        scheduleItems: [],
      };
      dataRoot.routines.unshift(bucket);
      return bucket;
    }

    function parseHHMMToMinutes(text = '') {
      const m = String(text || '').match(/^(\d{2}):(\d{2})$/);
      if (!m) return null;
      const hour = Number(m[1]);
      const minute = Number(m[2]);
      if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
      return hour * 60 + minute;
    }

    function formatMinutesToHHMM(totalMinutes = 0) {
      const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.floor(totalMinutes)));
      const hour = Math.floor(normalized / 60);
      const minute = normalized % 60;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    function canPlaceRoutineSlot(existingSlots = [], startMin = 0, endMin = 0) {
      return !existingSlots.some((slot) => !(endMin <= slot.start || startMin >= slot.end));
    }

    function reserveRoutineSlot(existingSlots = [], preferredStart = '09:30', duration = 60) {
      const list = Array.isArray(existingSlots) ? existingSlots : [];
      const startBase = parseHHMMToMinutes(preferredStart);
      if (!Number.isFinite(startBase)) return null;
      const minStart = 7 * 60;
      const maxEnd = 22 * 60;
      const dur = Math.max(30, Math.min(180, Math.floor(duration || 60)));
      for (let delta = 0; delta <= 10 * 60; delta += 30) {
        const candidates = delta === 0 ? [startBase] : [startBase + delta, startBase - delta];
        for (const startMin of candidates) {
          const endMin = startMin + dur;
          if (startMin < minStart || endMin > maxEnd) continue;
          if (canPlaceRoutineSlot(list, startMin, endMin)) {
            list.push({ start: startMin, end: endMin });
            return { startTime: formatMinutesToHHMM(startMin), endTime: formatMinutesToHHMM(endMin) };
          }
        }
      }
      return null;
    }

    function chooseTodayDraftPreferredStart(candidate = null, profile = {}, index = 0) {
      if (candidate?.preferredStart) return candidate.preferredStart;
      const text = String(candidate?.title || '');
      if (/(复盘|总结|收尾|明日准备)/.test(text)) return profile.wrapUpStart || '20:00';
      if (/(沟通|会议|同步|对齐|确认)/.test(text)) return profile.supportStart || '11:00';
      if (/(写作|方案|开发|实现|研究|推进|处理|整理|输出|完成|提交|修改|评审|准备)/.test(text)) return profile.deepWorkStart || '09:00';
      const fallbacks = [profile.deepWorkStart || '09:00', profile.supportStart || '14:00', '16:30', profile.wrapUpStart || '20:00'];
      return fallbacks[index % fallbacks.length];
    }

    function sanitizeRoutineTimeBlocksFromAction(blocksInput = []) {
      const blocks = Array.isArray(blocksInput) ? blocksInput : [];
      const isTrivialToday = typeof api.isTrivialTodayTimeBlockText === 'function'
        ? api.isTrivialTodayTimeBlockText
        : () => false;
      const parseMinutes = typeof api.parseHHMMToMinutes === 'function'
        ? api.parseHHMMToMinutes
        : parseHHMMToMinutes;
      return blocks.map((raw) => {
        const title = String(raw?.title || raw?.task || raw?.content || '').trim();
        const startTime = String(raw?.startTime || raw?.start || '').trim();
        const endTime = String(raw?.endTime || raw?.end || '').trim();
        const notes = String(raw?.notes || raw?.note || '').trim();
        if (!title || isTrivialToday(title)) return null;
        const startMin = parseMinutes(startTime);
        const endMin = parseMinutes(endTime);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;
        return { title, startTime, endTime, notes };
      }).filter(Boolean).slice(0, 18);
    }

    function extractPreferredTimeRangesFromUserMemory(text = '') {
      const ranges = [];
      const value = String(text || '');
      const pairRe = /(\d{1,2}:\d{2})\s*(?:到|至|-|~|～|—)\s*(\d{1,2}:\d{2})/g;
      let match;
      while ((match = pairRe.exec(value)) !== null) {
        ranges.push([match[1], match[2]]);
        if (ranges.length >= 4) break;
      }
      return ranges;
    }

    function buildWeekPlanningHabitProfile() {
      const aiMemory = typeof api.getAIMemory === 'function' ? (api.getAIMemory() || {}) : {};
      const ensureBucket = typeof api.ensureUnifiedRoutineCalendarBucket === 'function'
        ? api.ensureUnifiedRoutineCalendarBucket
        : () => null;
      const bucket = ensureBucket() || {};
      const userText = `${String(aiMemory.user || '')}\n${String(aiMemory.soul || '')}`;
      const explicitRanges = extractPreferredTimeRangesFromUserMemory(userText);
      const nonAIBuckets = new Map();
      (Array.isArray(bucket.scheduleItems) ? bucket.scheduleItems : []).forEach((item) => {
        if (!item || String(item.notes || '').includes(AI_WEEK_DRAFT_TAG) || String(item.notes || '').includes(AI_TODAY_DRAFT_TAG)) return;
        const start = String(item.startTime || '').trim();
        const hour = Number(start.split(':')[0]);
        if (!Number.isFinite(hour)) return;
        const key = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        nonAIBuckets.set(key, (nonAIBuckets.get(key) || 0) + 1);
      });
      const orderedBuckets = ['morning', 'afternoon', 'evening'].sort((a, b) => (nonAIBuckets.get(b) || 0) - (nonAIBuckets.get(a) || 0));
      const bucketToStart = { morning: '09:00', afternoon: '14:00', evening: '20:00' };
      const preferredStarts = explicitRanges.length
        ? explicitRanges.map((item) => String(item[0] || '').trim()).filter(Boolean)
        : orderedBuckets.map((key) => bucketToStart[key]).filter(Boolean);
      const deepWorkStart = preferredStarts[0] || (/晚上|夜里|夜间/.test(userText) ? '19:30' : '09:00');
      const supportStart = preferredStarts[1] || (/下午/.test(userText) ? '14:00' : '11:00');
      const wrapUpStart = preferredStarts[2] || (/晚上|夜里|夜间/.test(userText) ? '20:30' : '17:30');
      return {
        deepWorkStart,
        supportStart,
        wrapUpStart,
        prefersLowInterrupt: /低中断|连续|稳定|少打断/.test(userText),
        prefersEvening: /晚上|夜里|夜间/.test(userText),
      };
    }

    function generateTodayTimeBlocksDraftFromCurrentData({ customBlocks = [] } = {}) {
      const today = getTodayStr();
      const acceptedCustom = sanitizeRoutineTimeBlocksFromAction(customBlocks);
      if (acceptedCustom.length) return { date: today, blocks: acceptedCustom };
      const reserveSlot = typeof api.reserveRoutineSlot === 'function' ? api.reserveRoutineSlot : reserveRoutineSlot;
      const daySlots = [];
      const blocks = [];
      const profile = buildWeekPlanningHabitProfile();
      const isTrivialToday = typeof api.isTrivialTodayTimeBlockText === 'function'
        ? api.isTrivialTodayTimeBlockText
        : () => false;
      const pushBlock = (title, preferredStart, duration, notes = '') => {
        const allocated = reserveSlot(daySlots, preferredStart, duration);
        if (!allocated) return;
        if (!title || isTrivialToday(title)) return;
        blocks.push({
          title: String(title || '').trim(),
          startTime: allocated.startTime,
          endTime: allocated.endTime,
          notes: String(notes || '').trim(),
        });
      };
      const candidates = typeof api.buildTodayPlanningCandidates === 'function'
        ? api.buildTodayPlanningCandidates()
        : [];
      candidates.slice(0, 4).forEach((candidate, idx) => {
        pushBlock(
          candidate.title,
          chooseTodayDraftPreferredStart(candidate, profile, idx),
          Number(candidate.duration || 60),
          `来源：${String(candidate.notes || '重要事项').trim()}`
        );
      });
      return { date: today, blocks: sanitizeRoutineTimeBlocksFromAction(blocks).slice(0, 4) };
    }

    function formatTimeBlocksAsDailyText(draft = null) {
      const date = String(draft?.date || getTodayStr());
      const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];
      if (!blocks.length) return '';
      const lines = [`${AI_TODAY_DRAFT_TAG} ${date}`];
      blocks.forEach((item) => {
        const title = String(item?.title || '').trim();
        const start = String(item?.startTime || '').trim();
        const end = String(item?.endTime || '').trim();
        const notes = String(item?.notes || '').trim();
        if (!title || !start || !end) return;
        lines.push(`- [ ] ${start}-${end} ${title}${notes ? `（${notes}）` : ''}`);
      });
      return lines.join('\n').trim();
    }

    function formatRoutineWeekBlocksFromScheduleItems(dayList = [], scheduleItems = []) {
      const days = Array.isArray(dayList) ? dayList : [];
      const items = Array.isArray(scheduleItems) ? scheduleItems : [];
      return days.map((date) => {
        const blocks = items
          .filter((item) => String(item?.date || '') === String(date))
          .sort((a, b) => String(a?.startTime || '').localeCompare(String(b?.startTime || '')))
          .slice(0, 4)
          .map((item) => ({
            title: String(item?.title || '').trim(),
            startTime: String(item?.startTime || '').trim(),
            endTime: String(item?.endTime || '').trim(),
            notes: String(item?.notes || '').replace(AI_WEEK_DRAFT_TAG, '').trim(),
          }))
          .filter((item) => item.title && item.startTime && item.endTime);
        return { date: String(date || ''), blocks };
      });
    }

    function extractTimeBlocksDateFromReply(text = '') {
      const value = String(text || '');
      const match = value.match(/(?:今日时间块|今天的时间块|时间块)[^\d]*(\d{4}-\d{2}-\d{2})/);
      return match ? String(match[1] || '').trim() : '';
    }

    function getTodayDraftBlocksFromScheduleItems(dateText = '') {
      const date = String(dateText || getTodayStr()).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
      const dataRoot = getDataRoot();
      const routines = Array.isArray(dataRoot?.routines) ? dataRoot.routines : [];
      const scheduleItems = routines.flatMap((routine) => (
        Array.isArray(routine?.scheduleItems) ? routine.scheduleItems : []
      ));
      return scheduleItems
        .filter((item) => String(item?.date || '') === date && String(item?.notes || '').includes(AI_TODAY_DRAFT_TAG))
        .sort((a, b) => String(a?.startTime || '').localeCompare(String(b?.startTime || '')))
        .map((item) => ({
          title: String(item?.title || '').trim(),
          startTime: String(item?.startTime || '').trim(),
          endTime: String(item?.endTime || '').trim(),
          notes: String(item?.notes || '').replace(AI_TODAY_DRAFT_TAG, '').trim(),
        }))
        .filter((item) => item.title && item.startTime && item.endTime)
        .slice(0, 18);
    }

    function getRecentWeekTimeBlocksContext() {
      const aiChatState = getAIChatState();
      const messages = Array.isArray(aiChatState?.messages) ? aiChatState.messages.slice(-12).reverse() : [];
      const clampDayCount = typeof api.clampTimeBlockDayCount === 'function'
        ? api.clampTimeBlockDayCount
        : (value, fallback = 7) => {
          const max = Math.max(1, Math.floor(Number(fallback) || 7));
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return max;
          return Math.max(1, Math.min(max, Math.floor(parsed)));
        };
      for (const msg of messages) {
        const createdItems = Array.isArray(msg?.meta?.createdItems) ? msg.meta.createdItems : [];
        const weekItem = createdItems.find((item) => String(item?.tab || '').trim() === 'weekTimeBlocks');
        if (!weekItem) continue;
        const rangeType = ['this_week', 'next_week', 'rolling'].includes(String(weekItem?.rangeType || '').trim())
          ? String(weekItem.rangeType).trim()
          : 'rolling';
        return {
          rangeType,
          startDate: String(weekItem?.startDate || '').trim(),
          endDate: String(weekItem?.endDate || '').trim(),
          dayCount: clampDayCount(weekItem?.dayCount, Array.isArray(weekItem?.days) ? weekItem.days.length || 7 : 7),
          days: Array.isArray(weekItem?.days) ? weekItem.days : [],
        };
      }
      return null;
    }

    function escapeHTML(text = '') {
      if (typeof api.escapeHTML === 'function') return api.escapeHTML(text);
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function renderAIChatTimeBlocksHtml(items = [], fallbackText = '') {
      const hasWeekBlocks = (Array.isArray(items) ? items : []).some((item) => String(item?.tab || '') === 'weekTimeBlocks');
      const explicitBlocks = (Array.isArray(items) ? items : [])
        .filter((item) => String(item?.tab || '') === 'timeBlocks')
        .flatMap((item) => Array.isArray(item?.blocks) ? item.blocks : []);
      let blocks = explicitBlocks;
      if (!blocks.length && !hasWeekBlocks) {
        blocks = getTodayDraftBlocksFromScheduleItems(extractTimeBlocksDateFromReply(fallbackText));
      }
      if (!blocks.length && !hasWeekBlocks && /今日时间块|今天的时间块/.test(String(fallbackText || ''))) {
        const dateFromReply = extractTimeBlocksDateFromReply(fallbackText);
        const regenerated = generateTodayTimeBlocksDraftFromCurrentData({ customBlocks: [] });
        const regeneratedDate = String(regenerated?.date || '').trim();
        if (!dateFromReply || !regeneratedDate || dateFromReply === regeneratedDate) {
          blocks = Array.isArray(regenerated?.blocks) ? regenerated.blocks : [];
        }
      }
      if (!blocks.length && !hasWeekBlocks) {
        const parser = typeof api.extractTimeBlocksFromText === 'function' ? api.extractTimeBlocksFromText : () => [];
        const parsed = parser(fallbackText);
        if (parsed.length >= 2) blocks = parsed;
      }
      if (!blocks.length) return '';
      const rows = blocks.slice(0, 18).map((item) => {
        const title = escapeHTML(String(item?.title || '').trim());
        const start = escapeHTML(String(item?.startTime || '').trim());
        const end = escapeHTML(String(item?.endTime || '').trim());
        const notes = escapeHTML(String(item?.notes || '').trim());
        if (!title || !start || !end) return '';
        return `<div class="px-3 py-2.5 rounded-2xl border border-gray-300 dark:border-white/35">
            <div class="text-[10px] font-mono text-gray-600 dark:text-gray-300">${start}-${end}</div>
            <div class="text-[12px] mt-0.5 text-gray-900 dark:text-white">${title}</div>
            ${notes ? `<div class="text-[10px] mt-1 text-gray-600 dark:text-gray-300">${notes}</div>` : ''}
        </div>`;
      }).filter(Boolean).join('');
      if (!rows) return '';
      return `<div class="mt-2">
        <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45 mb-2">Today Blocks</div>
        <div style="display:flex; flex-direction:column; gap:5px;">${rows}</div>
    </div>`;
    }

    function renderAIChatWeekTimeBlocksHtml(items = []) {
      const explicitWeeks = (Array.isArray(items) ? items : [])
        .filter((item) => String(item?.tab || '') === 'weekTimeBlocks')
        .flatMap((item) => Array.isArray(item?.days) ? item.days : []);
      if (!explicitWeeks.length) return '';
      const columns = explicitWeeks.slice(0, 7).map((day) => {
        const dateText = String(day?.date || '').trim();
        if (!dateText) return '';
        const date = parseRoutineCalendarDate(dateText);
        const weekday = date.toLocaleDateString('zh-CN', { weekday: 'short' });
        const dayNum = `${date.getMonth() + 1}/${date.getDate()}`;
        const rows = (Array.isArray(day?.blocks) ? day.blocks : []).slice(0, 4).map((item) => {
          const title = escapeHTML(String(item?.title || '').trim());
          const start = escapeHTML(String(item?.startTime || '').trim());
          const end = escapeHTML(String(item?.endTime || '').trim());
          const notes = escapeHTML(String(item?.notes || '').trim());
          if (!title || !start || !end) return '';
          return `<div class="px-3 py-2.5 rounded-2xl border border-gray-300 dark:border-white/35">
                <div class="text-[9px] font-mono text-gray-500 dark:text-white/45">${start}-${end}</div>
                <div class="text-[10px] mt-0.5 text-gray-900 dark:text-white leading-snug">${title}</div>
                ${notes ? `<div class="text-[9px] mt-1 text-gray-500 dark:text-white/45 leading-snug">${notes}</div>` : ''}
            </div>`;
        }).filter(Boolean).join('');
        return `<div class="rounded-2xl border border-gray-200 dark:border-white/10 p-3 bg-white/40 dark:bg-white/[0.03]" style="min-width:128px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:8px;">
                <div class="text-[11px] font-medium text-gray-900 dark:text-white">${escapeHTML(weekday)}</div>
                <div class="text-[9px] font-mono text-gray-500 dark:text-white/65">${escapeHTML(dayNum)}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;min-height:72px;">
                ${rows || '<div class="text-[10px] text-gray-400 dark:text-white/30 leading-relaxed">留白，后续可自己补。</div>'}
            </div>
        </div>`;
      }).filter(Boolean).join('');
      if (!columns) return '';
      return `<div class="mt-2">
        <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/45 mb-2">Week Blocks</div>
        <div style="display:grid;grid-template-columns:repeat(7,minmax(128px,1fr));gap:8px;overflow-x:auto;padding-bottom:2px;">${columns}</div>
    </div>`;
    }

    function chooseWeekDraftStartTime(candidate, profile, dateLoad = 0) {
      const text = String(candidate?.title || '');
      if (candidate?.preferredStart) return candidate.preferredStart;
      if (/(复盘|总结|收尾)/.test(text)) return profile.wrapUpStart;
      if (/(沟通|会议|同步)/.test(text)) return profile.supportStart;
      if (profile.prefersLowInterrupt && dateLoad <= 1) return profile.deepWorkStart;
      if (/(写作|方案|开发|实现|研究|推进|处理)/.test(text)) return profile.deepWorkStart;
      return dateLoad % 2 === 0 ? profile.supportStart : profile.deepWorkStart;
    }

    function chooseWeekDraftDate(dayList = [], candidate, loadMap = new Map(), profile = {}) {
      if (candidate?.fixedDate && dayList.includes(candidate.fixedDate)) return candidate.fixedDate;
      const rankedDays = [...dayList].sort((a, b) => {
        const loadA = Number(loadMap.get(a) || 0);
        const loadB = Number(loadMap.get(b) || 0);
        const weekendA = [0, 6].includes(parseRoutineCalendarDate(a).getDay()) ? 1 : 0;
        const weekendB = [0, 6].includes(parseRoutineCalendarDate(b).getDay()) ? 1 : 0;
        if (weekendA !== weekendB) return weekendA - weekendB;
        if (loadA !== loadB) return loadA - loadB;
        return a.localeCompare(b);
      });
      if (!rankedDays.length) return '';
      const text = String(candidate?.title || '');
      if (/(复盘|总结|收尾)/.test(text)) return rankedDays[rankedDays.length - 1];
      if (profile.prefersEvening && /(写作|整理|复盘)/.test(text)) return rankedDays[Math.min(rankedDays.length - 1, 4)];
      return rankedDays[0];
    }

    function generateWeekScheduleDraftFromCurrentData(rangeType = 'rolling', dayCount = 7) {
      const ensureBucket = typeof api.ensureUnifiedRoutineCalendarBucket === 'function'
        ? api.ensureUnifiedRoutineCalendarBucket
        : () => null;
      const bucket = ensureBucket();
      if (!bucket || typeof bucket !== 'object') {
        return { added: 0, cleared: 0, startDate: '', endDate: '', routineId: '', rangeType, dayCount: 7, weekBlocks: [] };
      }
      if (!Array.isArray(bucket.scheduleItems)) bucket.scheduleItems = [];
      const clampDayCount = typeof api.clampTimeBlockDayCount === 'function'
        ? api.clampTimeBlockDayCount
        : (value, fallback = 7) => {
          const max = Math.max(1, Math.floor(Number(fallback) || 7));
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return max;
          return Math.max(1, Math.min(max, Math.floor(parsed)));
        };
      const getRange = typeof api.getWeekScheduleDraftRange === 'function'
        ? api.getWeekScheduleDraftRange
        : () => [];
      const effectiveDayCount = rangeType === 'rolling' ? clampDayCount(dayCount, 7) : 7;
      const dayList = getRange(rangeType, effectiveDayCount);
      const daySet = new Set(dayList);

      const before = bucket.scheduleItems.length;
      bucket.scheduleItems = bucket.scheduleItems.filter((item) => {
        const note = String(item?.notes || '');
        const date = String(item?.date || '');
        if (!daySet.has(date)) return true;
        return !note.includes(AI_WEEK_DRAFT_TAG);
      });
      const cleared = before - bucket.scheduleItems.length;

      const parseMinutes = typeof api.parseHHMMToMinutes === 'function'
        ? api.parseHHMMToMinutes
        : parseHHMMToMinutes;
      const daySlots = new Map(dayList.map((day) => [day, []]));
      bucket.scheduleItems.forEach((item) => {
        if (!daySet.has(String(item?.date || ''))) return;
        const slots = daySlots.get(item.date);
        if (!slots) return;
        const start = parseMinutes(String(item.startTime || ''));
        const end = parseMinutes(String(item.endTime || ''));
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
        slots.push({ start, end });
      });
      const canAddDraftToDate = (date) => {
        const current = bucket.scheduleItems.filter((item) => {
          if (String(item?.date || '') !== String(date || '')) return false;
          return String(item?.notes || '').includes(AI_WEEK_DRAFT_TAG);
        }).length;
        return current < 3;
      };

      let added = 0;
      const nowIso = new Date().toISOString();
      const profile = buildWeekPlanningHabitProfile();
      const buildCandidates = typeof api.buildWeekPlanningCandidates === 'function'
        ? api.buildWeekPlanningCandidates
        : () => [];
      const candidates = buildCandidates(dayList);
      const reserveSlot = typeof api.reserveRoutineSlot === 'function' ? api.reserveRoutineSlot : reserveRoutineSlot;
      const createId = typeof api.genId === 'function' ? api.genId : () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const perDayCount = new Map(dayList.map((date) => [date, 0]));
      candidates.forEach((candidate) => {
        const date = chooseWeekDraftDate(dayList, candidate, perDayCount, profile);
        if (!date || !canAddDraftToDate(date)) return;
        const slots = daySlots.get(date);
        if (!slots) return;
        const preferred = chooseWeekDraftStartTime(candidate, profile, Number(perDayCount.get(date) || 0));
        const allocated = reserveSlot(slots, preferred, Number(candidate.duration || 60));
        if (!allocated) return;
        bucket.scheduleItems.push({
          id: createId(),
          title: String(candidate.title || '').trim(),
          date,
          startTime: allocated.startTime,
          endTime: allocated.endTime,
          notes: `${AI_WEEK_DRAFT_TAG}\n来源：${String(candidate.notes || '重点事项').trim()}`,
          completed: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          source: 'ai',
        });
        perDayCount.set(date, Number(perDayCount.get(date) || 0) + 1);
        added += 1;
      });

      bucket.scheduleItems.sort((a, b) => {
        const keyA = `${String(a?.date || '')} ${String(a?.startTime || '')}`;
        const keyB = `${String(b?.date || '')} ${String(b?.startTime || '')}`;
        return keyA.localeCompare(keyB);
      });

      const draftItems = bucket.scheduleItems.filter((item) => {
        const note = String(item?.notes || '');
        const date = String(item?.date || '');
        return daySet.has(date) && note.includes(AI_WEEK_DRAFT_TAG);
      });

      return {
        added,
        cleared,
        startDate: dayList[0] || '',
        endDate: dayList[dayList.length - 1] || '',
        routineId: bucket.id,
        rangeType,
        dayCount: effectiveDayCount,
        weekBlocks: formatRoutineWeekBlocksFromScheduleItems(dayList, draftItems),
      };
    }

    function applyExplicitWeekScheduleDraft(daysInput = [], rangeType = 'rolling', dayCount = 7) {
      const ensureBucket = typeof api.ensureUnifiedRoutineCalendarBucket === 'function'
        ? api.ensureUnifiedRoutineCalendarBucket
        : () => null;
      const bucket = ensureBucket();
      if (!bucket || typeof bucket !== 'object') {
        return { added: 0, cleared: 0, startDate: '', endDate: '', routineId: '', rangeType, dayCount: 7, weekBlocks: [] };
      }
      if (!Array.isArray(bucket.scheduleItems)) bucket.scheduleItems = [];
      const firstAcceptedDate = (Array.isArray(daysInput) ? daysInput : [])
        .map((day) => String(day?.date || '').trim())
        .find((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
      const clampDayCount = typeof api.clampTimeBlockDayCount === 'function'
        ? api.clampTimeBlockDayCount
        : (value, fallback = 7) => {
          const max = Math.max(1, Math.floor(Number(fallback) || 7));
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return max;
          return Math.max(1, Math.min(max, Math.floor(parsed)));
        };
      const acceptedDayCount = Math.max(
        Array.isArray(daysInput) ? daysInput.length : 0,
        rangeType === 'rolling' ? clampDayCount(dayCount, 7) : 7,
      );
      const buildDayList = typeof api.buildAIWeekDraftDayList === 'function' ? api.buildAIWeekDraftDayList : () => [];
      const getRange = typeof api.getWeekScheduleDraftRange === 'function' ? api.getWeekScheduleDraftRange : () => [];
      const dayList = firstAcceptedDate ? buildDayList(firstAcceptedDate, acceptedDayCount) : getRange(rangeType, acceptedDayCount);
      const daySet = new Set(dayList);
      const before = bucket.scheduleItems.length;
      bucket.scheduleItems = bucket.scheduleItems.filter((item) => {
        const note = String(item?.notes || '');
        const date = String(item?.date || '');
        if (!daySet.has(date)) return true;
        return !note.includes(AI_WEEK_DRAFT_TAG);
      });
      const cleared = before - bucket.scheduleItems.length;
      const nowIso = new Date().toISOString();
      const acceptedDays = (Array.isArray(daysInput) ? daysInput : [])
        .map((day) => ({
          date: String(day?.date || '').trim(),
          blocks: sanitizeRoutineTimeBlocksFromAction(Array.isArray(day?.blocks) ? day.blocks : []).slice(0, 4),
        }))
        .filter((day) => day.date && daySet.has(day.date) && day.blocks.length > 0);
      const createId = typeof api.genId === 'function' ? api.genId : () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let added = 0;
      acceptedDays.forEach((day) => {
        day.blocks.forEach((block) => {
          bucket.scheduleItems.push({
            id: createId(),
            title: String(block.title || '').trim(),
            date: day.date,
            startTime: String(block.startTime || '').trim(),
            endTime: String(block.endTime || '').trim(),
            notes: `${AI_WEEK_DRAFT_TAG}${block.notes ? `\n${String(block.notes || '').trim()}` : ''}`,
            completed: false,
            createdAt: nowIso,
            updatedAt: nowIso,
            source: 'ai',
          });
          added += 1;
        });
      });
      bucket.scheduleItems.sort((a, b) => {
        const keyA = `${String(a?.date || '')} ${String(a?.startTime || '')}`;
        const keyB = `${String(b?.date || '')} ${String(b?.startTime || '')}`;
        return keyA.localeCompare(keyB);
      });
      return {
        added,
        cleared,
        startDate: dayList[0] || '',
        endDate: dayList[dayList.length - 1] || '',
        routineId: bucket.id,
        rangeType,
        dayCount: acceptedDayCount,
        weekBlocks: dayList.map((date) => acceptedDays.find((day) => day.date === date) || { date, blocks: [] }),
      };
    }

    function setRoutineCalendarView(view) {
      if (!['day', 'week', 'month', 'year'].includes(view)) return false;
      const state = getRoutineCalendarState();
      if (!state) return false;
      state.view = view;
      if (typeof api.requestRenderAll === 'function') api.requestRenderAll();
      return true;
    }

    function shiftRoutineCalendarRange(step) {
      const state = getRoutineCalendarState();
      if (!state) return false;
      const anchor = getRoutineCalendarShiftAnchor(step);
      const formatter = typeof api.formatRoutineCalendarDate === 'function'
        ? api.formatRoutineCalendarDate
        : formatRoutineCalendarDate;
      state.anchorDate = formatter(anchor);
      if (typeof api.requestRenderAll === 'function') api.requestRenderAll();
      return true;
    }

    function goRoutineCalendarToday() {
      const state = getRoutineCalendarState();
      if (!state) return false;
      const formatter = typeof api.formatRoutineCalendarDate === 'function'
        ? api.formatRoutineCalendarDate
        : formatRoutineCalendarDate;
      state.anchorDate = formatter(new Date());
      if (typeof api.requestRenderAll === 'function') api.requestRenderAll();
      return true;
    }

    function focusRoutineCalendarDate(dateText, forceView = 'day') {
      const state = getRoutineCalendarState();
      if (!state) return false;
      state.anchorDate = String(dateText || state.anchorDate);
      state.view = forceView;
      if (typeof api.requestRenderAll === 'function') api.requestRenderAll();
      return true;
    }

    return {
      parseRoutineCalendarDate,
      formatRoutineCalendarDate,
      addRoutineCalendarDays,
      addRoutineCalendarMonths,
      addRoutineCalendarYears,
      startOfRoutineCalendarWeek,
      getRoutineCalendarShiftAnchor,
      parseRoutineScheduleDraft,
      ensureUnifiedRoutineCalendarBucket,
      parseHHMMToMinutes,
      formatMinutesToHHMM,
      canPlaceRoutineSlot,
      reserveRoutineSlot,
      chooseTodayDraftPreferredStart,
      sanitizeRoutineTimeBlocksFromAction,
      extractPreferredTimeRangesFromUserMemory,
      buildWeekPlanningHabitProfile,
      generateTodayTimeBlocksDraftFromCurrentData,
      formatTimeBlocksAsDailyText,
      formatRoutineWeekBlocksFromScheduleItems,
      getRecentWeekTimeBlocksContext,
      renderAIChatTimeBlocksHtml,
      renderAIChatWeekTimeBlocksHtml,
      chooseWeekDraftStartTime,
      chooseWeekDraftDate,
      generateWeekScheduleDraftFromCurrentData,
      applyExplicitWeekScheduleDraft,
      setRoutineCalendarView,
      shiftRoutineCalendarRange,
      goRoutineCalendarToday,
      focusRoutineCalendarDate,
    };
  }

  window.MorphRoutineCalendarRuntime = {
    create: createRoutineCalendarRuntime,
  };
})();
