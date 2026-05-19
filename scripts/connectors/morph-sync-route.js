function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function countUserData(data) {
  if (!data || typeof data !== 'object') return 0;
  const arrLen = (v) => (Array.isArray(v) ? v.length : 0);
  const objLen = (v) => (v && typeof v === 'object' ? Object.keys(v).length : 0);
  const rhythmCount = countScheduleMvpRecords(data.scheduleMvp);
  return (
    arrLen(data.flashThoughts || data.fleeting) +
    arrLen(data.fixed) +
    arrLen(data.projects) +
    arrLen(data.routines) +
    rhythmCount +
    arrLen(data.sops) +
    objLen(data.dailyMonths) +
    arrLen(data.expenseLedger?.records)
  );
}

function getSyncRevision(data) {
  const revision = Number(data?.syncMeta?.revision || 0);
  return Number.isFinite(revision) ? revision : 0;
}

function getSyncWriteAtMs(data) {
  const text = String(data?.syncMeta?.lastClientWriteAt || '').trim();
  const value = Date.parse(text);
  return Number.isFinite(value) ? value : 0;
}

function getEntityTimestampMs(item) {
  const candidates = [
    item?.updatedAt,
    item?.completedAt,
    item?.spentAt,
    item?.timestamp,
    item?.createdAt,
  ];
  for (const candidate of candidates) {
    const value = Date.parse(String(candidate || '').trim());
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function mergeListById(existingList, incomingList, options = {}) {
  const idKey = options.idKey || 'id';
  const fallbackPrefix = String(options.fallbackPrefix || 'item');
  const map = new Map();
  const makeKey = (item, index, source) => {
    const rawId = String(item?.[idKey] || '').trim();
    if (rawId) return rawId;
    return `${fallbackPrefix}:${source}:${index}`;
  };
  (Array.isArray(existingList) ? existingList : []).forEach((item, index) => {
    map.set(makeKey(item, index, 'existing'), cloneJson(item));
  });
  (Array.isArray(incomingList) ? incomingList : []).forEach((item, index) => {
    const key = makeKey(item, index, 'incoming');
    const current = map.get(key);
    if (!current) {
      map.set(key, cloneJson(item));
      return;
    }
    const incomingTs = getEntityTimestampMs(item);
    const currentTs = getEntityTimestampMs(current);
    if (incomingTs >= currentTs) {
      map.set(key, {
        ...current,
        ...cloneJson(item),
      });
    }
  });
  return Array.from(map.values());
}

function mergeDailyLogs(existingLogs, incomingLogs) {
  const out = { ...(existingLogs && typeof existingLogs === 'object' ? cloneJson(existingLogs) : {}) };
  const incoming = incomingLogs && typeof incomingLogs === 'object' ? incomingLogs : {};
  Object.entries(incoming).forEach(([day, entries]) => {
    out[day] = mergeListById(out[day], entries, { fallbackPrefix: `daily:${day}` });
  });
  return out;
}

function mergeAiMemoryAppendOnly(currentData, incomingData) {
  const current = currentData.aiMemory && typeof currentData.aiMemory === 'object' ? currentData.aiMemory : {};
  const incoming = incomingData.aiMemory && typeof incomingData.aiMemory === 'object' ? incomingData.aiMemory : {};
  const incomingChatSessions = Array.isArray(incoming.chatSessions) ? incoming.chatSessions : [];
  const incomingDailyLogs = incoming.dailyLogs && typeof incoming.dailyLogs === 'object' ? incoming.dailyLogs : {};
  const hasAppendOnly = incomingChatSessions.length > 0 || Object.keys(incomingDailyLogs).length > 0;
  if (!hasAppendOnly) return false;
  currentData.aiMemory = {
    ...current,
    chatSessions: mergeListById(current.chatSessions, incomingChatSessions, { fallbackPrefix: 'chat-session' }),
    dailyLogs: mergeDailyLogs(current.dailyLogs, incomingDailyLogs),
    currentChatSessionId: String(current.currentChatSessionId || '').trim() || String(incoming.currentChatSessionId || '').trim(),
  };
  return true;
}

function mergeFlashDomains(currentData, incomingData) {
  const currentFlash = Array.isArray(currentData.flashThoughts) ? currentData.flashThoughts : [];
  const currentCompleted = Array.isArray(currentData.completedFlashThoughts) ? currentData.completedFlashThoughts : [];
  const incomingFlash = Array.isArray(incomingData.flashThoughts) ? incomingData.flashThoughts : [];
  const incomingCompleted = Array.isArray(incomingData.completedFlashThoughts) ? incomingData.completedFlashThoughts : [];
  const flashMap = new Map(currentFlash.map((item, index) => [String(item?.id || `flash:${index}`), cloneJson(item)]));
  const completedMap = new Map(currentCompleted.map((item, index) => [String(item?.id || `completed:${index}`), cloneJson(item)]));

  incomingCompleted.forEach((item, index) => {
    const key = String(item?.id || `completed:incoming:${index}`);
    const existing = completedMap.get(key);
    if (!existing || getEntityTimestampMs(item) >= getEntityTimestampMs(existing)) {
      completedMap.set(key, cloneJson(item));
    }
    if (flashMap.has(key)) {
      const flash = flashMap.get(key);
      if (getEntityTimestampMs(item) >= getEntityTimestampMs(flash)) {
        flashMap.delete(key);
      }
    }
  });

  incomingFlash.forEach((item, index) => {
    const key = String(item?.id || `flash:incoming:${index}`);
    if (completedMap.has(key)) return;
    const existing = flashMap.get(key);
    if (!existing || getEntityTimestampMs(item) >= getEntityTimestampMs(existing)) {
      flashMap.set(key, cloneJson(item));
    }
  });

  currentData.flashThoughts = Array.from(flashMap.values());
  currentData.completedFlashThoughts = Array.from(completedMap.values());
}

function mergeSafeDomains(currentData, incomingData) {
  let merged = false;
  if ((Array.isArray(incomingData.flashThoughts) && incomingData.flashThoughts.length)
    || (Array.isArray(incomingData.completedFlashThoughts) && incomingData.completedFlashThoughts.length)) {
    mergeFlashDomains(currentData, incomingData);
    merged = true;
  }
  if (Array.isArray(incomingData.reminders) && incomingData.reminders.length) {
    currentData.reminders = mergeListById(currentData.reminders, incomingData.reminders, { fallbackPrefix: 'reminder' });
    merged = true;
  }
  if (Array.isArray(incomingData.projectSpaces) && incomingData.projectSpaces.length) {
    currentData.projectSpaces = mergeListById(currentData.projectSpaces, incomingData.projectSpaces, { fallbackPrefix: 'project-space' });
    merged = true;
  }
  return merged;
}

function countScheduleMvpRecords(state) {
  const source = state && typeof state === 'object' ? state : {};
  const countFlatBucket = (bucket = null) => (bucket && typeof bucket === 'object' ? Object.keys(bucket).length : 0);
  const customDoneCount = Object.values(source.customDone && typeof source.customDone === 'object' ? source.customDone : {})
    .reduce((sum, days) => sum + countFlatBucket(days), 0);
  return Object.keys(source.video || {}).length
    + Object.keys(source.review || {}).length
    + Object.keys(source.sleep || {}).length
    + Object.keys(source.exercise || {}).reduce((sum, weekKey) => {
      const days = source.exercise && typeof source.exercise === 'object' ? source.exercise[weekKey] : null;
      return sum + (days && typeof days === 'object' ? Object.keys(days).length : 0);
    }, 0)
    + (Array.isArray(source.custom) ? source.custom.length : 0)
    + customDoneCount
    + (Array.isArray(source.cardOrder) ? source.cardOrder.length : 0);
}

function mergeScheduleMvpDomain(currentData, incomingState) {
  const current = currentData.scheduleMvp && typeof currentData.scheduleMvp === 'object' ? currentData.scheduleMvp : {};
  const incoming = incomingState && typeof incomingState === 'object' ? incomingState : {};
  const mergeFlatBucket = (a, b) => ({ ...(a && typeof a === 'object' ? cloneJson(a) : {}), ...(b && typeof b === 'object' ? cloneJson(b) : {}) });
  const exercise = mergeFlatBucket(current.exercise, null);
  Object.entries(incoming.exercise && typeof incoming.exercise === 'object' ? incoming.exercise : {}).forEach(([weekKey, days]) => {
    exercise[weekKey] = mergeFlatBucket(exercise[weekKey], days);
  });
  const customMap = new Map();
  [...(Array.isArray(current.custom) ? current.custom : []), ...(Array.isArray(incoming.custom) ? incoming.custom : [])].forEach((item) => {
    if (item?.id) customMap.set(String(item.id), cloneJson(item));
  });
  const customDone = mergeFlatBucket(current.customDone, null);
  Object.entries(incoming.customDone && typeof incoming.customDone === 'object' ? incoming.customDone : {}).forEach(([id, days]) => {
    customDone[id] = mergeFlatBucket(customDone[id], days);
  });
  currentData.scheduleMvp = {
    video: mergeFlatBucket(current.video, incoming.video),
    review: mergeFlatBucket(current.review, incoming.review),
    sleep: mergeFlatBucket(current.sleep, incoming.sleep),
    exercise,
    custom: Array.from(customMap.values()),
    customDone,
    cardOverrides: mergeFlatBucket(current.cardOverrides, incoming.cardOverrides),
    cardOrder: Array.isArray(incoming.cardOrder) && incoming.cardOrder.length ? incoming.cardOrder : (Array.isArray(current.cardOrder) ? current.cardOrder : []),
    updatedAt: String(incoming.updatedAt || current.updatedAt || '').trim(),
  };
}

function shouldPreserveCurrentScheduleMvp(current, incoming) {
  if (countScheduleMvpRecords(current?.scheduleMvp) <= 0) return false;
  if (countScheduleMvpRecords(incoming?.scheduleMvp) > 0) return false;
  // Full snapshots cannot express per-record rhythm tombstones yet.
  // Treat an empty rhythm object as "missing", not "delete every rhythm record".
  return true;
}

function mergeScheduleMvpForFullSnapshot(current, incoming) {
  if (countScheduleMvpRecords(current?.scheduleMvp) <= 0 && countScheduleMvpRecords(incoming?.scheduleMvp) <= 0) return incoming;
  const merged = cloneJson(incoming);
  mergeScheduleMvpDomain(merged, current?.scheduleMvp);
  mergeScheduleMvpDomain(merged, incoming?.scheduleMvp);
  return merged;
}

function mergeProjectEntity(existing, incoming) {
  const current = existing && typeof existing === 'object' ? cloneJson(existing) : {};
  const next = incoming && typeof incoming === 'object' ? incoming : {};
  const merged = {
    ...current,
    ...cloneJson(next),
  };
  merged.blocks = mergeListById(current.blocks, next.blocks, { fallbackPrefix: `project-block:${merged.id || 'project'}` });
  merged.items = mergeListById(current.items, next.items, { fallbackPrefix: `project-item:${merged.id || 'project'}` });
  return merged;
}

function mergeProjectsDomain(currentData, incomingProjects) {
  const currentList = Array.isArray(currentData.projects) ? currentData.projects : [];
  const map = new Map(currentList.map((item, index) => [String(item?.id || `project:${index}`), cloneJson(item)]));
  (Array.isArray(incomingProjects) ? incomingProjects : []).forEach((item, index) => {
    const key = String(item?.id || `project:incoming:${index}`);
    const existing = map.get(key);
    map.set(key, existing ? mergeProjectEntity(existing, item) : cloneJson(item));
  });
  currentData.projects = Array.from(map.values());
}

function mergeDailyMonthsDomain(currentData, incomingDailyMonths) {
  const current = currentData.dailyMonths && typeof currentData.dailyMonths === 'object' ? currentData.dailyMonths : {};
  const incoming = incomingDailyMonths && typeof incomingDailyMonths === 'object' ? incomingDailyMonths : {};
  const out = cloneJson(current) || {};
  Object.entries(incoming).forEach(([month, monthEntry]) => {
    if (Array.isArray(monthEntry) || Array.isArray(out[month])) {
      out[month] = mergeLegacyDailyMonthBlocks(out[month], monthEntry);
      return;
    }
    const currentMonth = out[month] && typeof out[month] === 'object' ? out[month] : { month, days: {} };
    const incomingMonth = monthEntry && typeof monthEntry === 'object' ? monthEntry : { month, days: {} };
    const mergedDays = { ...(currentMonth.days && typeof currentMonth.days === 'object' ? cloneJson(currentMonth.days) : {}) };
    Object.entries(incomingMonth.days && typeof incomingMonth.days === 'object' ? incomingMonth.days : {}).forEach(([date, dayEntry]) => {
      const currentDay = mergedDays[date] && typeof mergedDays[date] === 'object' ? mergedDays[date] : { date, blocks: [] };
      const nextDay = dayEntry && typeof dayEntry === 'object' ? dayEntry : { date, blocks: [] };
      mergedDays[date] = {
        ...currentDay,
        ...cloneJson(nextDay),
        blocks: mergeListById(currentDay.blocks, nextDay.blocks, { fallbackPrefix: `daily-block:${date}` }),
      };
    });
    out[month] = {
      ...currentMonth,
      ...cloneJson(incomingMonth),
      days: mergedDays,
    };
  });
  currentData.dailyMonths = out;
}

function readLegacyDailyBlockDate(block) {
  const text = String(block?.content || block?.text || '').trim();
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function splitLegacyDailySections(blocks) {
  const sections = [];
  let current = null;
  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    const date = String(block?.type || '').trim() === 'h3' ? readLegacyDailyBlockDate(block) : '';
    if (date) {
      current = { date, blocks: [cloneJson(block)] };
      sections.push(current);
      return;
    }
    if (!current) {
      current = { date: '', blocks: [] };
      sections.push(current);
    }
    current.blocks.push(cloneJson(block));
  });
  return sections;
}

function mergeLegacyDailySectionBlocks(currentBlocks, incomingBlocks) {
  const out = [];
  const seen = new Set();
  const keyFor = (block, index, source) => {
    const id = String(block?.id || '').trim();
    if (id) return `id:${id}`;
    return `fallback:${source}:${index}:${String(block?.type || '').trim()}:${String(block?.content || block?.text || '').trim()}`;
  };
  (Array.isArray(currentBlocks) ? currentBlocks : []).forEach((block, index) => {
    const key = keyFor(block, index, 'current');
    seen.add(key);
    out.push(cloneJson(block));
  });
  (Array.isArray(incomingBlocks) ? incomingBlocks : []).forEach((block, index) => {
    const key = keyFor(block, index, 'incoming');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cloneJson(block));
  });
  return out;
}

function mergeLegacyDailyMonthBlocks(currentBlocks, incomingBlocks) {
  const currentSections = splitLegacyDailySections(currentBlocks);
  const incomingSections = splitLegacyDailySections(incomingBlocks);
  const out = [];
  const currentByDate = new Map(currentSections.map((section) => [section.date, section]));
  const consumedDates = new Set();
  incomingSections.forEach((incomingSection) => {
    const currentSection = currentByDate.get(incomingSection.date);
    consumedDates.add(incomingSection.date);
    out.push(...mergeLegacyDailySectionBlocks(currentSection?.blocks, incomingSection.blocks));
  });
  currentSections.forEach((section) => {
    if (consumedDates.has(section.date)) return;
    out.push(...cloneJson(section.blocks));
  });
  return out;
}

function mergeExpenseLedgerDomain(currentData, incomingLedger) {
  const current = currentData.expenseLedger && typeof currentData.expenseLedger === 'object' ? currentData.expenseLedger : { categories: [], records: [] };
  const incoming = incomingLedger && typeof incomingLedger === 'object' ? incomingLedger : { categories: [], records: [] };
  currentData.expenseLedger = {
    categories: Array.from(new Set([...(Array.isArray(current.categories) ? current.categories : []), ...(Array.isArray(incoming.categories) ? incoming.categories : [])])),
    records: mergeListById(current.records, incoming.records, { fallbackPrefix: 'expense-record' }),
  };
}

function mapEntityTypeToMorphDomain(type) {
  const normalized = String(type || '').trim();
  if (!normalized) return '';
  if (normalized === 'flashThought') return 'flashThoughts';
  if (normalized === 'daily' || normalized === 'dailyBlock') return 'dailyMonths';
  if (normalized === 'reminder') return 'reminders';
  return '';
}

function collectRecentExternalMutationRefs(liveDataStore, options = {}) {
  const windowMs = Math.max(1000, Number(options.windowMs) || 600000);
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  if (!liveDataStore || typeof liveDataStore.readRecentActionLogEntries !== 'function') return [];
  const entries = liveDataStore.readRecentActionLogEntries(options);
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => {
      if (!entry || entry.ok !== true || String(entry.executionSurface || '').trim() !== 'external') return false;
      const updatedAtMs = Date.parse(String(entry?.updatedAt || entry?.writeReceipt?.savedAt || '').trim());
      if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) return false;
      return updatedAtMs >= (nowMs - windowMs);
    })
    .flatMap((entry) => {
      const updatedAt = String(entry?.updatedAt || entry?.writeReceipt?.savedAt || '').trim();
      return (Array.isArray(entry?.affectedEntities) ? entry.affectedEntities : []).map((item) => ({
        domain: mapEntityTypeToMorphDomain(item?.type),
        entityType: String(item?.type || '').trim(),
        entityId: String(item?.id || '').trim(),
        updatedAt,
      })).filter((item) => item.domain && item.entityId);
    });
}

function buildFlashThoughtEntityMap(data) {
  const map = new Map();
  [...(Array.isArray(data?.flashThoughts) ? data.flashThoughts : []), ...(Array.isArray(data?.completedFlashThoughts) ? data.completedFlashThoughts : [])]
    .forEach((item, index) => {
      const id = String(item?.id || `flash:${index}`).trim();
      if (id) map.set(id, item);
    });
  return map;
}

function collectProtectedDailyDates(refs = []) {
  const dates = new Set();
  (Array.isArray(refs) ? refs : []).forEach((ref) => {
    if (ref.domain !== 'dailyMonths') return;
    if (ref.entityType === 'daily') {
      const date = String(ref.entityId || '').trim();
      if (date) dates.add(date);
    }
  });
  return dates;
}

function buildDailyEntryMap(data) {
  const map = new Map();
  const months = data?.dailyMonths && typeof data.dailyMonths === 'object' ? data.dailyMonths : {};
  Object.values(months).forEach((monthEntry) => {
    if (Array.isArray(monthEntry)) {
      splitLegacyDailySections(monthEntry).forEach((section) => {
        const date = String(section?.date || '').trim();
        if (!date) return;
        map.set(date, {
          date,
          blocks: (Array.isArray(section.blocks) ? section.blocks : []).map((block) => ({
            ...block,
            text: String(block?.text || block?.content || '').trim(),
          })),
        });
      });
      return;
    }
    const days = monthEntry?.days && typeof monthEntry.days === 'object' ? monthEntry.days : {};
    Object.entries(days).forEach(([date, entry]) => {
      const key = String(date || entry?.date || '').trim();
      if (!key) return;
      map.set(key, entry && typeof entry === 'object' ? entry : { date: key, blocks: [] });
    });
  });
  return map;
}

function buildDailyMonthsSubset(data, dateSet) {
  const months = data?.dailyMonths && typeof data.dailyMonths === 'object' ? data.dailyMonths : {};
  const wantedDates = dateSet instanceof Set ? dateSet : new Set();
  const out = {};
  Object.entries(months).forEach(([monthKey, monthEntry]) => {
    if (Array.isArray(monthEntry)) {
      const pickedBlocks = splitLegacyDailySections(monthEntry)
        .filter((section) => wantedDates.has(String(section?.date || '').trim()))
        .flatMap((section) => cloneJson(section.blocks));
      if (pickedBlocks.length) out[monthKey] = pickedBlocks;
      return;
    }
    const days = monthEntry?.days && typeof monthEntry.days === 'object' ? monthEntry.days : {};
    const pickedDays = {};
    Object.entries(days).forEach(([date, entry]) => {
      const key = String(date || entry?.date || '').trim();
      if (!key || !wantedDates.has(key)) return;
      pickedDays[key] = cloneJson(entry);
    });
    if (!Object.keys(pickedDays).length) return;
    out[monthKey] = {
      ...(monthEntry && typeof monthEntry === 'object' ? cloneJson(monthEntry) : { month: monthKey }),
      days: pickedDays,
    };
  });
  return out;
}

function buildReminderEntityMap(data) {
  const map = new Map();
  (Array.isArray(data?.reminders) ? data.reminders : []).forEach((item, index) => {
    const id = String(item?.id || `reminder:${index}`).trim();
    if (id) map.set(id, item);
  });
  return map;
}

function hasRecentProtectedFlashDrift(current, incoming, refs = []) {
  const targetIds = new Set((Array.isArray(refs) ? refs : [])
    .filter((ref) => ref.domain === 'flashThoughts')
    .map((ref) => String(ref.entityId || '').trim())
    .filter(Boolean));
  if (!targetIds.size) return false;
  const currentMap = buildFlashThoughtEntityMap(current);
  const incomingMap = buildFlashThoughtEntityMap(incoming);
  return Array.from(targetIds).some((id) => {
    const currentItem = currentMap.get(id);
    if (!currentItem) return false;
    const incomingItem = incomingMap.get(id);
    if (!incomingItem) return true;
    return getEntityTimestampMs(currentItem) > getEntityTimestampMs(incomingItem);
  });
}

function hasRecentProtectedDailyDrift(current, incoming, refs = []) {
  const protectedDates = collectProtectedDailyDates(refs);
  if (!protectedDates.size) return false;
  const currentMap = buildDailyEntryMap(current);
  const incomingMap = buildDailyEntryMap(incoming);
  return Array.from(protectedDates).some((date) => {
    const currentEntry = currentMap.get(date);
    if (!currentEntry) return false;
    const incomingEntry = incomingMap.get(date);
    if (!incomingEntry) return true;
    const currentBlocks = Array.isArray(currentEntry?.blocks) ? currentEntry.blocks : [];
    const incomingBlocks = Array.isArray(incomingEntry?.blocks) ? incomingEntry.blocks : [];
    const incomingBlockMap = new Map(incomingBlocks.map((item, index) => [String(item?.id || `block:${index}`).trim(), item]));
    return currentBlocks.some((block, index) => {
      const blockId = String(block?.id || `block:${index}`).trim();
      const incomingBlock = incomingBlockMap.get(blockId);
      if (!incomingBlock) return true;
      return getEntityTimestampMs(block) > getEntityTimestampMs(incomingBlock);
    });
  });
}

function hasRecentProtectedReminderDrift(current, incoming, refs = []) {
  const targetIds = new Set((Array.isArray(refs) ? refs : [])
    .filter((ref) => ref.domain === 'reminders')
    .map((ref) => String(ref.entityId || '').trim())
    .filter(Boolean));
  if (!targetIds.size) return false;
  const currentMap = buildReminderEntityMap(current);
  const incomingMap = buildReminderEntityMap(incoming);
  return Array.from(targetIds).some((id) => {
    const currentItem = currentMap.get(id);
    if (!currentItem) return false;
    const incomingItem = incomingMap.get(id);
    if (!incomingItem) return true;
    return getEntityTimestampMs(currentItem) > getEntityTimestampMs(incomingItem);
  });
}

function buildRecentExternalMergeReceipt(domains = [], refs = []) {
  return {
    status: 'merged',
    source: 'server-sync',
    reason: 'recent_external_commit_preserved',
    message: '服务端保留了最近外部入口提交但设备快照暂未带上的数据',
    mergedDomains: Array.isArray(domains) ? domains : [],
    preservedEntityRefs: (Array.isArray(refs) ? refs : []).map((ref) => ({
      domain: ref.domain,
      entityType: ref.entityType,
      entityId: ref.entityId,
      updatedAt: ref.updatedAt,
    })),
  };
}

function preserveRecentExternalMutations(current, incoming, liveDataStore, options = {}) {
  const refs = collectRecentExternalMutationRefs(liveDataStore, options);
  if (!refs.length) return null;
  const merged = cloneJson(incoming);
  const mergedDomains = [];
  if (hasRecentProtectedFlashDrift(current, incoming, refs)) {
    mergeFlashDomains(merged, {
      flashThoughts: Array.isArray(current?.flashThoughts) ? current.flashThoughts : [],
      completedFlashThoughts: Array.isArray(current?.completedFlashThoughts) ? current.completedFlashThoughts : [],
    });
    mergedDomains.push('flashThoughts');
  }
  if (hasRecentProtectedDailyDrift(current, incoming, refs)) {
    const protectedDates = collectProtectedDailyDates(refs);
    mergeDailyMonthsDomain(merged, buildDailyMonthsSubset(current, protectedDates));
    mergedDomains.push('dailyMonths');
  }
  if (hasRecentProtectedReminderDrift(current, incoming, refs)) {
    merged.reminders = mergeListById(merged.reminders, current?.reminders, { fallbackPrefix: 'reminder' });
    mergedDomains.push('reminders');
  }
  if (!mergedDomains.length) return null;
  const preservedRefs = refs.filter((ref) => mergedDomains.includes(ref.domain));
  return {
    data: merged,
    receipt: buildRecentExternalMergeReceipt(mergedDomains, preservedRefs),
  };
}

function buildMergedSyncReceipt(syncSummary, mergedDomains) {
  const summary = syncSummary && typeof syncSummary === 'object' ? syncSummary : {};
  const domainStates = Object.fromEntries((Array.isArray(mergedDomains) ? mergedDomains : []).map((domain) => [domain, {
    status: 'merged',
    detail: 'stale sync payload was merged into the current snapshot',
  }]));
  const entityRefs = Array.isArray(summary.pendingEntityRefs) && summary.pendingEntityRefs.length
    ? summary.pendingEntityRefs
    : (Array.isArray(summary.pendingMutations)
      ? summary.pendingMutations.flatMap((mutation) => (Array.isArray(mutation?.entityRefs) ? mutation.entityRefs : []))
      : []);
  const entityStates = {};
  entityRefs.forEach((entry) => {
    const domain = String(entry?.domain || '').trim();
    const entityType = String(entry?.entityType || '').trim();
    const entityId = String(entry?.entityId || '').trim();
    if (!domain || !entityType || !entityId) return;
    entityStates[`${domain}::${entityType}::${entityId}`] = {
      domain,
      entityType,
      entityId,
      action: String(entry?.action || '').trim(),
      label: String(entry?.label || '').trim(),
      status: 'merged',
      detail: 'stale sync entity payload was merged into the current snapshot',
    };
  });
  const mergedMutations = Array.isArray(summary.pendingMutations)
    ? summary.pendingMutations.map((mutation) => ({
        mutationId: String(mutation?.mutationId || '').trim(),
        revision: Number(mutation?.revision || 0),
        domains: Array.isArray(mutation?.domains) ? mutation.domains : [],
      })).filter((entry) => entry.mutationId)
    : [];
  return {
    status: 'merged',
    source: 'server-sync',
    reason: 'stale_revision_safe_merge',
    message: '服务端已将过期设备上的可安全域与追加域数据合并到当前快照',
    mergedDomains: Array.isArray(mergedDomains) ? mergedDomains : [],
    domainStates,
    entityStates,
    mergedMutations,
    ackedMutations: [],
  };
}

function tryMergeStaleSyncPayload(current, incoming, parsed) {
  const merged = cloneJson(current);
  let mergedAppendOnlyDomains = false;
  let mergedSafeDomains = false;
  const mergedDomains = [];
  if (mergeAiMemoryAppendOnly(merged, incoming)) {
    mergedAppendOnlyDomains = true;
    mergedDomains.push('aiMemory');
  }
  if (mergeSafeDomains(merged, incoming)) {
    mergedSafeDomains = true;
    if (Array.isArray(incoming.flashThoughts) && incoming.flashThoughts.length) mergedDomains.push('flashThoughts');
    if (Array.isArray(incoming.completedFlashThoughts) && incoming.completedFlashThoughts.length) mergedDomains.push('completedFlashThoughts');
    if (Array.isArray(incoming.reminders) && incoming.reminders.length) mergedDomains.push('reminders');
    if (Array.isArray(incoming.projectSpaces) && incoming.projectSpaces.length) mergedDomains.push('projectSpaces');
  }
  const syncSummary = parsed?.syncSummary && typeof parsed.syncSummary === 'object' ? parsed.syncSummary : {};
  const pendingMutations = Array.isArray(syncSummary.pendingMutations) ? syncSummary.pendingMutations : [];
  if (pendingMutations.length) {
    pendingMutations.forEach((mutation) => {
      const domainPayloads = mutation?.domainPayloads && typeof mutation.domainPayloads === 'object' ? mutation.domainPayloads : {};
      const domains = Array.isArray(mutation?.domains) ? mutation.domains : [];
      if (domains.includes('projects') || Array.isArray(domainPayloads.projects)) {
        mergeProjectsDomain(merged, domainPayloads.projects);
        mergedSafeDomains = true;
        if (!mergedDomains.includes('projects')) mergedDomains.push('projects');
      }
      if (domains.includes('dailyMonths') || (domainPayloads.dailyMonths && typeof domainPayloads.dailyMonths === 'object')) {
        mergeDailyMonthsDomain(merged, domainPayloads.dailyMonths);
        mergedSafeDomains = true;
        if (!mergedDomains.includes('dailyMonths')) mergedDomains.push('dailyMonths');
      }
      if (domains.includes('expenseLedger') || (domainPayloads.expenseLedger && typeof domainPayloads.expenseLedger === 'object')) {
        mergeExpenseLedgerDomain(merged, domainPayloads.expenseLedger);
        mergedSafeDomains = true;
        if (!mergedDomains.includes('expenseLedger')) mergedDomains.push('expenseLedger');
      }
      if (domains.includes('rhythm') || (domainPayloads.rhythm && typeof domainPayloads.rhythm === 'object')) {
        mergeScheduleMvpDomain(merged, domainPayloads.rhythm || incoming.scheduleMvp);
        mergedSafeDomains = true;
        if (!mergedDomains.includes('rhythm')) mergedDomains.push('rhythm');
      }
    });
  }
  if (!mergedAppendOnlyDomains && !mergedSafeDomains) return null;
  return {
    data: merged,
    mergedAppendOnlyDomains,
    mergedSafeDomains,
    receipt: buildMergedSyncReceipt(syncSummary, mergedDomains),
  };
}

function summarizeSyncMutationEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      mutationId: String(entry?.mutationId || '').trim(),
      revision: Number(entry?.revision || 0),
      domains: Array.isArray(entry?.domains) ? entry.domains : [],
    }))
    .filter((entry) => entry.mutationId);
}

function buildSyncCommitReceipt(data, parsed, overrides = {}) {
  const syncSummary = parsed?.syncSummary && typeof parsed.syncSummary === 'object' ? parsed.syncSummary : {};
  return {
    status: 'acked',
    source: 'server-sync',
    reason: 'full_snapshot_committed',
    message: '服务端已提交最新快照',
    ackedRevision: getSyncRevision(data),
    ackedMutations: summarizeSyncMutationEntries(syncSummary.pendingMutations),
    mergedMutations: [],
    pendingCount: 0,
    pendingDomains: [],
    ...cloneJson(overrides),
  };
}

function buildSyncFailureReceipt(reason, message, extras = {}) {
  return {
    ok: false,
    type: 'canonical_write',
    pipeline: 'morph-canonical-write',
    status: 'failed',
    source: 'server-sync',
    reason: String(reason || 'sync_failed').trim() || 'sync_failed',
    message: String(message || '同步失败').trim() || '同步失败',
    canonicalStore: {
      kind: 'live-data-json',
      relativePath: 'data/live-data.json',
    },
    ...cloneJson(extras),
  };
}

function unwrapDataEnvelope(input) {
  if (!input || typeof input !== 'object') return input;
  const hasEnvelope = input.data && typeof input.data === 'object';
  if (!hasEnvelope) return input;
  const out = { ...(input.data || {}) };
  if (input.morphRuntime && typeof input.morphRuntime === 'object') {
    const mergedRuntime = {
      ...(out.morphRuntime && typeof out.morphRuntime === 'object' ? out.morphRuntime : {}),
      ...input.morphRuntime,
    };
    if (out.morphRuntime && typeof out.morphRuntime === 'object' && input.morphRuntime && typeof input.morphRuntime === 'object') {
      if (out.morphRuntime.skills && typeof out.morphRuntime.skills === 'object' && input.morphRuntime.skills && typeof input.morphRuntime.skills === 'object') {
        mergedRuntime.skills = { ...out.morphRuntime.skills, ...input.morphRuntime.skills };
      }
      if (out.morphRuntime.contextRules && typeof out.morphRuntime.contextRules === 'object' && input.morphRuntime.contextRules && typeof input.morphRuntime.contextRules === 'object') {
        mergedRuntime.contextRules = { ...out.morphRuntime.contextRules, ...input.morphRuntime.contextRules };
      }
    }
    out.morphRuntime = mergedRuntime;
  }
  return out;
}

function isStructuredMetadataOnlySyncPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : null;
  if (!data) return false;
  const keys = Object.keys(data).filter((key) => key !== 'syncMeta');
  if (keys.length > 0) return false;
  return true;
}

async function handleMorphSyncRequest(req, res, context = {}) {
  const url = String(context.url || req.url || '').split('?')[0];
  if (req.method !== 'POST' || url !== '/api/sync') return false;

  const {
    host,
    port,
    sendJson,
    readRequestBody,
    liveDataStore,
    normalizeData,
  } = context;

  try {
    const raw = await readRequestBody(req);
    const parsed = raw ? JSON.parse(raw) : {};
    const data = normalizeData(unwrapDataEnvelope(parsed));
    const current = liveDataStore.readCurrentLiveDataSafely({ clone: true });
    const incomingCount = countUserData(data);
    const currentCount = countUserData(current);
    const pendingDomains = Array.isArray(parsed?.syncSummary?.pendingDomains) ? parsed.syncSummary.pendingDomains : [];
    const pendingMutations = Array.isArray(parsed?.syncSummary?.pendingMutations) ? parsed.syncSummary.pendingMutations : [];
    const hasStructuredSyncMergePayload = pendingDomains.length > 0 || pendingMutations.length > 0;
    const reqUrl = new URL(req.url || '/api/sync', `http://${host}:${port}`);
    const allowEmptyOverwrite = reqUrl.searchParams.get('allowEmptyOverwrite') === '1';
    if (!allowEmptyOverwrite && !hasStructuredSyncMergePayload && incomingCount === 0 && currentCount > 0) {
      sendJson(res, 409, {
        ok: false,
        error: 'Refused to overwrite non-empty cloud data with empty payload',
        hint: 'Pass ?allowEmptyOverwrite=1 only when you intentionally want to clear cloud data.',
        incomingCount,
        currentCount,
        receipt: buildSyncFailureReceipt(
          'empty_snapshot_rejected',
          '服务端拒绝用空快照覆盖非空 canonical store',
          { incomingCount, currentCount }
        ),
      });
      return true;
    }
    const currentRevision = getSyncRevision(current);
    const incomingRevision = getSyncRevision(data);
    const currentWriteAt = getSyncWriteAtMs(current);
    const incomingWriteAt = getSyncWriteAtMs(data);
    const isStaleIncoming = !!current
      && (
        (incomingRevision > 0 && incomingRevision < currentRevision)
        || (!incomingRevision && currentRevision > 0)
        || (incomingRevision === currentRevision && incomingRevision > 0 && incomingWriteAt > 0 && currentWriteAt > 0 && incomingWriteAt < currentWriteAt)
      );

    if (!allowEmptyOverwrite && !isStaleIncoming && hasStructuredSyncMergePayload && currentCount > 0 && incomingCount === 0 && isStructuredMetadataOnlySyncPayload(parsed)) {
      sendJson(res, 409, {
        ok: false,
        error: 'Structured sync payload is missing the full snapshot body',
        hint: 'Client must send the canonical data snapshot together with syncSummary; metadata-only payloads are rejected to avoid clobbering live-data.',
        incomingCount,
        currentCount,
        currentData: current,
        receipt: buildSyncFailureReceipt(
          'metadata_only_sync_payload',
          '服务端拒绝只带 syncMeta 的结构化同步负载，避免覆盖 canonical store',
          { incomingCount, currentCount }
        ),
      });
      return true;
    }

    if (isStaleIncoming) {
      const merged = tryMergeStaleSyncPayload(current, data, parsed);
      if (!merged) {
        sendJson(res, 409, {
          ok: false,
          error: 'Incoming sync payload is stale and cannot be safely merged',
          incomingRevision,
          currentRevision,
          currentData: current,
          receipt: buildSyncFailureReceipt(
            'stale_revision_conflict',
            '传入快照版本已落后于当前 canonical store，且当前负载无法安全合并',
            {
              incomingRevision,
              currentRevision,
            }
          ),
        });
        return true;
      }
      const committed = liveDataStore.commitMorphWrite(merged.data, {
        source: 'sync/stale-merge',
        receipt: buildSyncCommitReceipt(merged.data, parsed, merged.receipt),
      });
      sendJson(res, 200, {
        ok: true,
        savedAt: committed.savedAt,
        snapshot: committed.snapshot,
        mirror: committed.mirror,
        mergedAppendOnlyDomains: merged.mergedAppendOnlyDomains === true,
        mergedSafeDomains: merged.mergedSafeDomains === true,
        receipt: committed.writeReceipt,
        writeReceipt: committed.writeReceipt,
      });
      return true;
    }
    const preserved = preserveRecentExternalMutations(current, data, liveDataStore);
    let commitData = preserved?.data || data;
    const incomingScheduleMvpRecordCount = countScheduleMvpRecords(commitData?.scheduleMvp);
    commitData = mergeScheduleMvpForFullSnapshot(current, commitData);
    let serverMergedScheduleMvp = countScheduleMvpRecords(current?.scheduleMvp) > 0
      && incomingScheduleMvpRecordCount <= 0
      && countScheduleMvpRecords(commitData?.scheduleMvp) > 0;
    if (shouldPreserveCurrentScheduleMvp(current, commitData)) {
      mergeScheduleMvpDomain(commitData, current.scheduleMvp);
      serverMergedScheduleMvp = true;
    }
    const committed = liveDataStore.commitMorphWrite(commitData, {
      source: 'sync/full-snapshot',
      receipt: buildSyncCommitReceipt(commitData, parsed, preserved?.receipt || {}),
    });
    sendJson(res, 200, {
      ok: true,
      savedAt: committed.savedAt,
      snapshot: committed.snapshot,
      mirror: committed.mirror,
      preservedRecentExternalMutations: !!preserved,
      serverMergedScheduleMvp,
      currentData: (preserved || serverMergedScheduleMvp) ? commitData : undefined,
      receipt: committed.writeReceipt,
      writeReceipt: committed.writeReceipt,
    });
    return true;
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error.message || 'sync failed',
      receipt: buildSyncFailureReceipt('sync_failed', error.message || 'sync failed'),
    });
    return true;
  }
}

module.exports = {
  buildSyncCommitReceipt,
  buildSyncFailureReceipt,
  countUserData,
  getSyncRevision,
  handleMorphSyncRequest,
  tryMergeStaleSyncPayload,
  unwrapDataEnvelope,
};
