(function () {
  if (typeof window === 'undefined') return;
  if (window.MorphSyncRuntime && typeof window.MorphSyncRuntime.create === 'function') return;

  function cloneJSONSafe(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return null;
    }
  }

  function countScheduleMvpRecords(state = null) {
    const source = state && typeof state === 'object' ? state : {};
    const countFlatBucket = (bucket = null) => (
      bucket && typeof bucket === 'object' ? Object.keys(bucket).length : 0
    );
    const exerciseCount = Object.values(source.exercise && typeof source.exercise === 'object' ? source.exercise : {})
      .reduce((sum, days) => sum + countFlatBucket(days), 0);
    const customDoneCount = Object.values(source.customDone && typeof source.customDone === 'object' ? source.customDone : {})
      .reduce((sum, days) => sum + countFlatBucket(days), 0);
    return countFlatBucket(source.video) + countFlatBucket(source.review) + countFlatBucket(source.sleep) + exerciseCount + (Array.isArray(source.custom) ? source.custom.length : 0) + customDoneCount + (Array.isArray(source.cardOrder) ? source.cardOrder.length : 0);
  }

  function mergeScheduleRhythmCardOrderFields(left = null, right = null) {
    const leftOrder = Array.isArray(left?.cardOrder) ? left.cardOrder : [];
    const rightOrder = Array.isArray(right?.cardOrder) ? right.cardOrder : [];
    const leftAt = Date.parse(String(left?.cardOrderUpdatedAt || '').trim() || '') || 0;
    const rightAt = Date.parse(String(right?.cardOrderUpdatedAt || '').trim() || '') || 0;
    if (rightOrder.length && (!leftOrder.length || rightAt >= leftAt || (!leftAt && !rightAt))) {
      return {
        cardOrder: rightOrder,
        cardOrderUpdatedAt: String(right?.cardOrderUpdatedAt || left?.cardOrderUpdatedAt || '').trim(),
      };
    }
    return {
      cardOrder: leftOrder,
      cardOrderUpdatedAt: String(left?.cardOrderUpdatedAt || right?.cardOrderUpdatedAt || '').trim(),
    };
  }

  function mergeScheduleMvpState(preferred = null, supplemental = null) {
    const left = preferred && typeof preferred === 'object' ? preferred : {};
    const right = supplemental && typeof supplemental === 'object' ? supplemental : {};
    const mergeFlatBucket = (a = null, b = null) => ({
      ...(a && typeof a === 'object' ? cloneJSONSafe(a) || {} : {}),
      ...(b && typeof b === 'object' ? cloneJSONSafe(b) || {} : {}),
    });
    const exercise = mergeFlatBucket(left.exercise, null);
    Object.entries(right.exercise && typeof right.exercise === 'object' ? right.exercise : {}).forEach(([weekKey, days]) => {
      exercise[weekKey] = mergeFlatBucket(exercise[weekKey], days);
    });
    const customMap = new Map();
    [...(Array.isArray(left.custom) ? left.custom : []), ...(Array.isArray(right.custom) ? right.custom : [])].forEach((item) => {
      if (item?.id) customMap.set(String(item.id), item);
    });
    const customDone = mergeFlatBucket(left.customDone, null);
    Object.entries(right.customDone && typeof right.customDone === 'object' ? right.customDone : {}).forEach(([id, days]) => {
      customDone[id] = mergeFlatBucket(customDone[id], days);
    });
    return {
      video: mergeFlatBucket(left.video, right.video),
      review: mergeFlatBucket(left.review, right.review),
      sleep: mergeFlatBucket(left.sleep, right.sleep),
      exercise,
      custom: Array.from(customMap.values()),
      customDone,
      cardOverrides: mergeFlatBucket(left.cardOverrides, right.cardOverrides),
      ...mergeScheduleRhythmCardOrderFields(left, right),
      updatedAt: String(right.updatedAt || left.updatedAt || '').trim(),
    };
  }

  function sanitizeEntityRefs(list) {
    const refs = Array.isArray(list) ? list : [];
    return refs
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const domain = String(item.domain || '').trim();
        const entityType = String(item.entityType || '').trim();
        const entityId = String(item.entityId || '').trim();
        if (!domain && !entityType && !entityId) return null;
        return {
          domain,
          entityType,
          entityId,
          action: String(item.action || '').trim(),
          label: String(item.label || '').trim().slice(0, 120),
        };
      })
      .filter(Boolean)
      .slice(0, 48);
  }

  function sanitizeMutationReceipts(value) {
    return Array.isArray(value)
      ? value
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const mutationId = String(item.mutationId || '').trim();
            if (!mutationId) return null;
            return {
              mutationId,
              revision: Number.isFinite(Number(item.revision)) ? Number(item.revision) : 0,
              domain: String(item.domain || '').trim(),
              entityType: String(item.entityType || '').trim(),
              entityId: String(item.entityId || '').trim(),
              action: String(item.action || '').trim(),
              label: String(item.label || '').trim().slice(0, 120),
              detail: String(item.detail || '').trim(),
            };
          })
          .filter(Boolean)
          .slice(0, 64)
      : [];
  }

  function buildSyncReceiptCore(source = {}, helpers = {}) {
    const readJournal = typeof helpers.readJournal === 'function' ? helpers.readJournal : () => [];
    const journal = Array.isArray(helpers.journal) ? helpers.journal : readJournal();
    const receiptSource = source && typeof source === 'object' ? source : {};
    const receipt = {
      updatedAt: String(receiptSource.updatedAt || '').trim() || new Date().toISOString(),
      status: String(receiptSource.status || '').trim() || 'unknown',
      source: String(receiptSource.source || '').trim() || 'unknown',
      reason: String(receiptSource.reason || '').trim(),
      message: String(receiptSource.message || '').trim(),
      ackedRevision: Number.isFinite(Number(receiptSource.ackedRevision)) ? Number(receiptSource.ackedRevision) : 0,
      pendingCount: Number.isFinite(Number(receiptSource.pendingCount)) ? Number(receiptSource.pendingCount) : 0,
      pendingDomains: Array.isArray(receiptSource.pendingDomains)
        ? Array.from(new Set(receiptSource.pendingDomains.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 24)
        : [],
      ackedMutations: sanitizeMutationReceipts(receiptSource.ackedMutations),
      mergedMutations: sanitizeMutationReceipts(receiptSource.mergedMutations),
      blockedMutations: sanitizeMutationReceipts(receiptSource.blockedMutations),
      mergedDomains: Array.isArray(receiptSource.mergedDomains)
        ? Array.from(new Set(receiptSource.mergedDomains.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 24)
        : [],
      domainStates: receiptSource.domainStates && typeof receiptSource.domainStates === 'object'
        ? receiptSource.domainStates
        : {},
      entityStates: receiptSource.entityStates && typeof receiptSource.entityStates === 'object'
        ? receiptSource.entityStates
        : {},
      conflict: receiptSource.conflict && typeof receiptSource.conflict === 'object'
        ? {
            incomingDeviceId: String(receiptSource.conflict.incomingDeviceId || '').trim(),
            currentDeviceId: String(receiptSource.conflict.currentDeviceId || '').trim(),
            incomingRevision: Number.isFinite(Number(receiptSource.conflict.incomingRevision)) ? Number(receiptSource.conflict.incomingRevision) : 0,
            currentRevision: Number.isFinite(Number(receiptSource.conflict.currentRevision)) ? Number(receiptSource.conflict.currentRevision) : 0,
            incomingWriteAt: String(receiptSource.conflict.incomingWriteAt || '').trim(),
            currentWriteAt: String(receiptSource.conflict.currentWriteAt || '').trim(),
            detail: String(receiptSource.conflict.detail || '').trim(),
          }
        : null,
    };
    const ackedDomains = Array.isArray(helpers.ackedDomains) ? helpers.ackedDomains : [];
    const ackedEntityRefs = Array.isArray(helpers.ackedEntityRefs) ? helpers.ackedEntityRefs : [];
    if (!Object.keys(receipt.domainStates).length) {
      receipt.domainStates = buildSyncDomainStates({ journal, receipt: receiptSource, ackedDomains });
    }
    if (!Object.keys(receipt.entityStates).length) {
      receipt.entityStates = buildSyncEntityStates({ journal, receipt: receiptSource, ackedEntityRefs });
    }
    return receipt;
  }

  function buildEntityKey(entry) {
    const domain = String(entry && entry.domain ? entry.domain : '').trim();
    const entityType = String(entry && entry.entityType ? entry.entityType : '').trim();
    const entityId = String(entry && entry.entityId ? entry.entityId : '').trim();
    if (!domain && !entityType && !entityId) return '';
    return [domain, entityType, entityId].join('::');
  }

  function buildSyncEntityStates({ journal = [], receipt = null, ackedEntityRefs = [] } = {}) {
    const out = {};
    const safeJournal = Array.isArray(journal) ? journal : [];
    const safeReceipt = receipt && typeof receipt === 'object' ? receipt : null;
    const safeAckedEntityRefs = Array.isArray(ackedEntityRefs) ? ackedEntityRefs : [];
    const setEntityState = (entry, status, detail = '') => {
      const key = buildEntityKey(entry);
      if (!key) return;
      out[key] = {
        domain: String(entry && entry.domain ? entry.domain : '').trim(),
        entityType: String(entry && entry.entityType ? entry.entityType : '').trim(),
        entityId: String(entry && entry.entityId ? entry.entityId : '').trim(),
        action: String(entry && entry.action ? entry.action : '').trim(),
        label: String(entry && entry.label ? entry.label : '').trim().slice(0, 120),
        status: String(status || '').trim() || 'unknown',
        detail: String(detail || '').trim(),
      };
    };
    if (safeReceipt && safeReceipt.entityStates && typeof safeReceipt.entityStates === 'object') {
      Object.values(safeReceipt.entityStates).forEach((entry) => setEntityState(entry, entry && entry.status, entry && entry.detail));
    }
    safeAckedEntityRefs.forEach((entry) => {
      setEntityState(entry, 'acked', '该实体对应的本地 mutation 已被远端确认');
    });
    safeJournal.forEach((entry) => {
      const revision = Number(entry && entry.revision ? entry.revision : 0);
      const refs = Array.isArray(entry && entry.entityRefs) ? entry.entityRefs : [];
      refs.forEach((ref) => {
        setEntityState(ref, 'pending', revision > 0 ? `该实体仍有本地 revision ${revision} 待确认` : '该实体仍有未确认写入');
      });
    });
    return out;
  }

  function buildSyncDomainStates({ journal = [], receipt = null, ackedDomains = [] } = {}) {
    const out = {};
    const safeJournal = Array.isArray(journal) ? journal : [];
    const safeReceipt = receipt && typeof receipt === 'object' ? receipt : null;
    const safeAckedDomains = Array.isArray(ackedDomains) ? ackedDomains : [];
    const setDomainState = (domain, status, detail = '') => {
      const key = String(domain || '').trim();
      if (!key) return;
      out[key] = {
        status: String(status || '').trim() || 'unknown',
        detail: String(detail || '').trim(),
      };
    };
    if (safeReceipt && safeReceipt.domainStates && typeof safeReceipt.domainStates === 'object') {
      Object.entries(safeReceipt.domainStates).forEach(([domain, value]) => {
        setDomainState(domain, value && value.status, value && value.detail);
      });
    }
    safeAckedDomains.forEach((domain) => {
      setDomainState(domain, 'acked', '本地 mutation 已被远端确认');
    });
    safeJournal.forEach((entry) => {
      const revision = Number(entry && entry.revision ? entry.revision : 0);
      const domains = Array.isArray(entry && entry.domains) ? entry.domains : [];
      domains.forEach((domain) => {
        setDomainState(domain, 'pending', revision > 0 ? `本地 revision ${revision} 仍待远端确认` : '本地仍有未确认写入');
      });
    });
    return out;
  }

  function normalizeSyncMutationJournal(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const out = [];
    list.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const revision = Number(entry.revision);
      if (!Number.isFinite(revision) || revision <= 0) return;
      out.push({
        mutationId: String(entry.mutationId || '').trim() || `rev:${revision}`,
        revision,
        lastClientWriteAt: String(entry.lastClientWriteAt || '').trim(),
        deviceId: String(entry.deviceId || '').trim(),
        createdAt: String(entry.createdAt || '').trim() || new Date().toISOString(),
        domains: Array.isArray(entry.domains)
          ? Array.from(new Set(entry.domains.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 24)
          : [],
        entityRefs: sanitizeEntityRefs(entry.entityRefs),
        domainPayloads: entry.domainPayloads && typeof entry.domainPayloads === 'object'
          ? cloneJSONSafe(entry.domainPayloads) || {}
          : {},
      });
    });
    out.sort((a, b) => {
      if (a.revision !== b.revision) return a.revision - b.revision;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    return out.slice(-120);
  }

  function sanitizeSyncMutationJournal(raw) {
    return normalizeSyncMutationJournal(raw);
  }

  function sanitizeSyncReceipt(raw) {
    return buildSyncReceiptCore(raw);
  }

  function buildDomainPayloads(sourceData, touchedDomains, options = {}) {
    const safeDomains = Array.isArray(touchedDomains) ? touchedDomains : [];
    const payloads = {};
    const slimPersistedAIChatSessions = typeof options.slimPersistedAIChatSessions === 'function'
      ? options.slimPersistedAIChatSessions
      : null;
    const syncJournalAIChatMaxSessions = Math.max(1, Number(options.syncJournalAIChatMaxSessions) || 8);
    const syncJournalAIChatMaxMessages = Math.max(1, Number(options.syncJournalAIChatMaxMessages) || 24);
    safeDomains.forEach((domain) => {
      const key = String(domain || '').trim();
      if (!key) return;
      if (key === 'flashThoughts') {
        payloads[key] = {
          flashThoughts: Array.isArray(sourceData.flashThoughts) ? sourceData.flashThoughts : [],
          completedFlashThoughts: Array.isArray(sourceData.completedFlashThoughts) ? sourceData.completedFlashThoughts : [],
        };
        return;
      }
      if (key === 'fixedThoughts') {
        payloads[key] = {
          fixed: Array.isArray(sourceData.fixed) ? sourceData.fixed : [],
          completedFixedThoughts: Array.isArray(sourceData.completedFixedThoughts) ? sourceData.completedFixedThoughts : [],
        };
        return;
      }
      if (key === 'reminders') {
        payloads[key] = Array.isArray(sourceData.reminders) ? sourceData.reminders : [];
        return;
      }
      if (key === 'projectSpaces') {
        payloads[key] = Array.isArray(sourceData.projectSpaces) ? sourceData.projectSpaces : [];
        return;
      }
      if (key === 'projects') {
        payloads[key] = {
          projectQueueLanesVersion: Number.isFinite(Number(sourceData.projectQueueLanesVersion)) ? Number(sourceData.projectQueueLanesVersion) : 0,
          projectQueueLanes: Array.isArray(sourceData.projectQueueLanes) ? sourceData.projectQueueLanes : [],
          projects: Array.isArray(sourceData.projects) ? sourceData.projects : [],
        };
        return;
      }
      if (key === 'routines') {
        payloads[key] = Array.isArray(sourceData.routines) ? sourceData.routines : [];
        return;
      }
      if (key === 'rhythm') {
        payloads[key] = sourceData && sourceData.scheduleMvp && typeof sourceData.scheduleMvp === 'object' ? sourceData.scheduleMvp : {};
        return;
      }
      if (key === 'sops') {
        payloads[key] = Array.isArray(sourceData.sops) ? sourceData.sops : [];
        return;
      }
      if (key === 'dailyMonths') {
        payloads[key] = sourceData && sourceData.dailyMonths && typeof sourceData.dailyMonths === 'object' ? sourceData.dailyMonths : {};
        return;
      }
      if (key === 'expenseLedger') {
        payloads[key] = sourceData && sourceData.expenseLedger && typeof sourceData.expenseLedger === 'object'
          ? {
              categories: Array.isArray(sourceData.expenseLedger.categories) ? sourceData.expenseLedger.categories : [],
              records: Array.isArray(sourceData.expenseLedger.records) ? sourceData.expenseLedger.records : [],
            }
          : { categories: [], records: [] };
        return;
      }
      if (key === 'aiChatSessions') {
        if (slimPersistedAIChatSessions) {
          const aiMemorySource = sourceData && sourceData.aiMemory && typeof sourceData.aiMemory === 'object'
            ? sourceData.aiMemory
            : null;
          const slimmedAIMemory = slimPersistedAIChatSessions(
            cloneJSONSafe(aiMemorySource) || (aiMemorySource ? { ...aiMemorySource } : null),
            {
              maxSessions: syncJournalAIChatMaxSessions,
              maxMessages: syncJournalAIChatMaxMessages,
            }
          );
          payloads[key] = Array.isArray(slimmedAIMemory?.chatSessions) ? slimmedAIMemory.chatSessions : [];
          return;
        }
        payloads[key] = Array.isArray(sourceData?.aiMemory?.chatSessions) ? sourceData.aiMemory.chatSessions : [];
        return;
      }
      if (key === 'aiDailyLogs') {
        payloads[key] = sourceData && sourceData.aiMemory ? sourceData.aiMemory.dailyLogs || {} : {};
        return;
      }
      if (key === 'aiCurrentChatSessionId') {
        payloads[key] = String(sourceData && sourceData.aiMemory ? sourceData.aiMemory.currentChatSessionId || '' : '');
      }
    });
    return payloads;
  }

  function buildSyncEntityRefsFromReceipts(receipts = []) {
    return (Array.isArray(receipts) ? receipts : [])
      .filter(Boolean)
      .flatMap((item) => (Array.isArray(item.entityRefs) ? item.entityRefs : []))
      .filter(Boolean)
      .slice(0, 48);
  }

  function buildSyncEntityRefsFromCreatedItems(items = []) {
    return (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 48);
  }

  function mergeSyncEntityRefs(...groups) {
    return groups.flatMap((group) => (Array.isArray(group) ? group : [])).filter(Boolean).slice(0, 48);
  }

  function getPendingDomainsFromJournal(journal) {
    return Array.from(new Set((Array.isArray(journal) ? journal : []).flatMap((entry) => (
      Array.isArray(entry && entry.domains) ? entry.domains : []
    ))));
  }

  function getPendingEntityRefsFromJournal(journal) {
    return (Array.isArray(journal) ? journal : []).flatMap((entry) => (
      Array.isArray(entry && entry.entityRefs) ? entry.entityRefs : []
    ));
  }

  function recordPendingSyncMutation(data, options = {}) {
    const normalizeData = typeof options.normalizeData === 'function' ? options.normalizeData : (value) => value;
    const getSyncDeviceId = typeof options.getSyncDeviceId === 'function' ? options.getSyncDeviceId : () => '';
    const readSyncMutationJournal = typeof options.readSyncMutationJournal === 'function' ? options.readSyncMutationJournal : () => [];
    const writeSyncMutationJournal = typeof options.writeSyncMutationJournal === 'function' ? options.writeSyncMutationJournal : () => {};
    const normalized = normalizeData(data);
    const meta = normalized && normalized.syncMeta && typeof normalized.syncMeta === 'object' ? normalized.syncMeta : {};
    const revision = Number(meta.revision);
    if (!Number.isFinite(revision) || revision <= 0) return null;
    const domains = Array.isArray(options.domains)
      ? Array.from(new Set(options.domains.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 24)
      : [];
    const entityRefs = Array.isArray(options.entityRefs)
      ? sanitizeEntityRefs(options.entityRefs)
      : [];
    const entry = {
      mutationId: `rev:${revision}:${String(meta.deviceId || getSyncDeviceId()).trim() || 'unknown'}`,
      revision,
      lastClientWriteAt: String(meta.lastClientWriteAt || '').trim(),
      deviceId: String(meta.deviceId || getSyncDeviceId()).trim(),
      createdAt: new Date().toISOString(),
      domains,
      entityRefs,
      domainPayloads: buildDomainPayloads(normalized, domains, options),
    };
    const current = normalizeSyncMutationJournal(readSyncMutationJournal()).filter((item) => Number(item && item.revision ? item.revision : 0) !== revision);
    current.push(entry);
    writeSyncMutationJournal(current);
    return entry;
  }

  function acknowledgeSyncMutationsThroughRevision(revision, options = {}) {
    const safeRevision = Number(revision);
    const readSyncMutationJournal = typeof options.readSyncMutationJournal === 'function' ? options.readSyncMutationJournal : () => [];
    const writeSyncMutationJournal = typeof options.writeSyncMutationJournal === 'function' ? options.writeSyncMutationJournal : () => {};
    const getLastAckRevision = typeof options.getLastAckRevision === 'function' ? options.getLastAckRevision : () => 0;
    const setLastAckRevision = typeof options.setLastAckRevision === 'function' ? options.setLastAckRevision : () => {};
    const readLastSyncReceipt = typeof options.readLastSyncReceipt === 'function' ? options.readLastSyncReceipt : () => null;
    const journal = normalizeSyncMutationJournal(readSyncMutationJournal());
    if (!Number.isFinite(safeRevision) || safeRevision <= 0) {
      const currentReceipt = readLastSyncReceipt();
      return {
        ackedRevision: getLastAckRevision(),
        pendingCount: journal.length,
        ackedDomains: [],
        ackedEntityRefs: [],
        domainStates: buildSyncDomainStates({
          journal,
          receipt: currentReceipt,
        }),
        entityStates: buildSyncEntityStates({
          journal,
          receipt: currentReceipt,
        }),
      };
    }
    const ackedEntries = journal.filter((entry) => Number(entry && entry.revision ? entry.revision : 0) <= safeRevision);
    const remaining = journal.filter((entry) => Number(entry && entry.revision ? entry.revision : 0) > safeRevision);
    writeSyncMutationJournal(remaining);
    setLastAckRevision(safeRevision);
    const ackedDomains = Array.from(new Set(ackedEntries.flatMap((entry) => (
      Array.isArray(entry && entry.domains) ? entry.domains : []
    ))));
    const ackedEntityRefs = ackedEntries.flatMap((entry) => (
      Array.isArray(entry && entry.entityRefs) ? entry.entityRefs : []
    ));
    const currentReceipt = readLastSyncReceipt();
    return {
      ackedRevision: Math.max(getLastAckRevision(), safeRevision),
      pendingCount: remaining.length,
      ackedDomains,
      ackedEntityRefs,
      domainStates: buildSyncDomainStates({
        journal: remaining,
        receipt: currentReceipt,
        ackedDomains,
      }),
      entityStates: buildSyncEntityStates({
        journal: remaining,
        receipt: currentReceipt,
        ackedEntityRefs,
      }),
    };
  }

  function acknowledgeSyncMutationsByIds(mutationIds = [], fallbackRevision = 0, options = {}) {
    const ids = new Set((Array.isArray(mutationIds) ? mutationIds : []).map((item) => String(item || '').trim()).filter(Boolean));
    if (!ids.size) return acknowledgeSyncMutationsThroughRevision(fallbackRevision, options);
    const readSyncMutationJournal = typeof options.readSyncMutationJournal === 'function' ? options.readSyncMutationJournal : () => [];
    const writeSyncMutationJournal = typeof options.writeSyncMutationJournal === 'function' ? options.writeSyncMutationJournal : () => {};
    const getLastAckRevision = typeof options.getLastAckRevision === 'function' ? options.getLastAckRevision : () => 0;
    const setLastAckRevision = typeof options.setLastAckRevision === 'function' ? options.setLastAckRevision : () => {};
    const readLastSyncReceipt = typeof options.readLastSyncReceipt === 'function' ? options.readLastSyncReceipt : () => null;
    const journal = normalizeSyncMutationJournal(readSyncMutationJournal());
    const ackedEntries = journal.filter((entry) => ids.has(String(entry && entry.mutationId ? entry.mutationId : '').trim()));
    const remaining = journal.filter((entry) => !ids.has(String(entry && entry.mutationId ? entry.mutationId : '').trim()));
    const maxAckedRevision = ackedEntries.reduce((max, entry) => Math.max(max, Number(entry && entry.revision ? entry.revision : 0)), Number(fallbackRevision) || 0);
    writeSyncMutationJournal(remaining);
    if (maxAckedRevision > 0) setLastAckRevision(maxAckedRevision);
    const ackedDomains = Array.from(new Set(ackedEntries.flatMap((entry) => (
      Array.isArray(entry && entry.domains) ? entry.domains : []
    ))));
    const ackedEntityRefs = ackedEntries.flatMap((entry) => (
      Array.isArray(entry && entry.entityRefs) ? entry.entityRefs : []
    ));
    const currentReceipt = readLastSyncReceipt();
    return {
      ackedRevision: Math.max(getLastAckRevision(), maxAckedRevision),
      pendingCount: remaining.length,
      ackedDomains,
      ackedEntityRefs,
      domainStates: buildSyncDomainStates({
        journal: remaining,
        receipt: currentReceipt,
        ackedDomains,
      }),
      entityStates: buildSyncEntityStates({
        journal: remaining,
        receipt: currentReceipt,
        ackedEntityRefs,
      }),
    };
  }

  function getSyncMutationState(options = {}) {
    const readSyncMutationJournal = typeof options.readSyncMutationJournal === 'function' ? options.readSyncMutationJournal : () => [];
    const getLastAckRevision = typeof options.getLastAckRevision === 'function' ? options.getLastAckRevision : () => 0;
    const readLastSyncReceipt = typeof options.readLastSyncReceipt === 'function' ? options.readLastSyncReceipt : () => null;
    const journal = normalizeSyncMutationJournal(readSyncMutationJournal());
    const ackedRevision = getLastAckRevision();
    const lastReceipt = readLastSyncReceipt();
    const pendingDomains = getPendingDomainsFromJournal(journal);
    const pendingEntityRefs = getPendingEntityRefsFromJournal(journal);
    return {
      ackedRevision,
      pendingCount: journal.length,
      latestPendingRevision: journal.length ? Number(journal[journal.length - 1].revision || 0) : 0,
      pendingDomains,
      pendingEntityRefs,
      pendingEntityCount: pendingEntityRefs.length,
      pendingMutations: journal.slice(-40).map((entry) => ({
        mutationId: String(entry.mutationId || '').trim(),
        revision: Number(entry.revision || 0),
        domains: Array.isArray(entry.domains) ? entry.domains.slice(0, 24) : [],
        entityRefs: Array.isArray(entry.entityRefs) ? entry.entityRefs.slice(0, 48) : [],
        domainPayloads: entry.domainPayloads && typeof entry.domainPayloads === 'object'
          ? cloneJSONSafe(entry.domainPayloads) || {}
          : {},
      })),
      domainStates: buildSyncDomainStates({
        journal,
        receipt: lastReceipt,
      }),
      entityStates: buildSyncEntityStates({
        journal,
        receipt: lastReceipt,
      }),
      journal,
      lastReceipt,
    };
  }

  function buildSyncReceiptRecord(receipt, options = {}) {
    const currentState = options.currentState && typeof options.currentState === 'object'
      ? options.currentState
      : getSyncMutationState(options);
    const journal = Array.isArray(options.journal) ? options.journal : currentState.journal || [];
    const ackedDomains = Array.isArray(options.ackedDomains) ? options.ackedDomains : [];
    const ackedEntityRefs = Array.isArray(options.ackedEntityRefs) ? options.ackedEntityRefs : [];
    return buildSyncReceiptCore({
      ...receipt,
      updatedAt: String(receipt && receipt.updatedAt ? receipt.updatedAt : '') || new Date().toISOString(),
      ackedRevision: Number.isFinite(Number(receipt && receipt.ackedRevision)) ? Number(receipt.ackedRevision) : Number(currentState.ackedRevision || 0),
      pendingCount: Number.isFinite(Number(receipt && receipt.pendingCount)) ? Number(receipt.pendingCount) : Number(currentState.pendingCount || 0),
      pendingDomains: Array.isArray(receipt && receipt.pendingDomains) ? receipt.pendingDomains : currentState.pendingDomains || [],
      domainStates: receipt && receipt.domainStates && typeof receipt.domainStates === 'object'
        ? receipt.domainStates
        : buildSyncDomainStates({
            journal,
            receipt: currentState.lastReceipt,
            ackedDomains,
          }),
      entityStates: receipt && receipt.entityStates && typeof receipt.entityStates === 'object'
        ? receipt.entityStates
        : buildSyncEntityStates({
            journal,
            receipt: currentState.lastReceipt,
            ackedEntityRefs,
          }),
    }, {
      journal,
      readJournal: options.readSyncMutationJournal,
      ackedDomains,
      ackedEntityRefs,
    });
  }

  function formatSyncStatusFreshness(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const at = Date.parse(raw);
    if (!Number.isFinite(at) || at <= 0) return '';
    const deltaMs = Math.max(0, Date.now() - at);
    const deltaSeconds = Math.floor(deltaMs / 1000);
    if (deltaSeconds < 10) return '刚刚确认';
    if (deltaSeconds < 60) return `${deltaSeconds} 秒前确认`;
    const deltaMinutes = Math.floor(deltaSeconds / 60);
    if (deltaMinutes < 60) return `${deltaMinutes} 分钟前确认`;
    const deltaHours = Math.floor(deltaMinutes / 60);
    if (deltaHours < 48) return `${deltaHours} 小时前确认`;
    const deltaDays = Math.floor(deltaHours / 24);
    return `${deltaDays} 天前确认`;
  }

  function deriveSyncStatusDescriptor(state, text, meta = {}, snapshot = null) {
    const syncState = String(state || '').trim() || 'idle';
    const requestedText = String(text || '').trim();
    const currentState = snapshot && typeof snapshot === 'object'
      ? snapshot
      : null;
    const pendingCount = Number(currentState?.pendingCount || meta.pendingCount || 0);
    const ackedRevision = Number(currentState?.ackedRevision || meta.ackedRevision || 0);
    const lastReceiptAt = String(meta.lastReceiptAt || currentState?.lastReceipt?.updatedAt || '').trim();
    const freshnessText = formatSyncStatusFreshness(lastReceiptAt);
    const isGenericText = !requestedText
      || requestedText === '等待同步'
      || requestedText === '同步中'
      || requestedText === '同步空闲'
      || requestedText === '已同步'
      || requestedText === '已同步，仍有待确认变更';
    const fallbackText = (
      syncState === 'syncing'
        ? (pendingCount > 0 ? '本地已保存，等待同步确认' : '同步中')
        : syncState === 'error'
          ? '同步失败'
          : syncState === 'ok'
            ? (pendingCount > 0
                ? '本地已保存，等待多端确认'
                : (freshnessText ? `已同步（${freshnessText}）` : '已同步'))
            : (pendingCount > 0
                ? '本地已保存，等待多端确认'
                : ((ackedRevision > 0 && freshnessText) ? `已同步（${freshnessText}）` : '同步空闲'))
    );
    const derivedText = isGenericText ? fallbackText : requestedText;
    return {
      state: syncState,
      text: derivedText,
      meta: {
        ...meta,
        pendingCount,
        ackedRevision,
        lastReceiptAt,
        freshnessText,
      },
    };
  }

  window.MorphSyncRuntime = {
    create(deps = {}) {
      const windowRef = typeof window !== 'undefined' ? window : null;
      const documentRef = typeof document !== 'undefined' ? document : null;
      const runtimePulseKey = String(deps.getRuntimePulseKey?.() || 'morph_sync_runtime_pulse_v1').trim() || 'morph_sync_runtime_pulse_v1';
      const runtimeChannelName = String(deps.getRuntimeChannelName?.() || 'morph-sync-runtime-v1').trim() || 'morph-sync-runtime-v1';
      const runtimeTabId = String(
        deps.getRuntimeTabId?.()
        || `morph-tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      ).trim() || `morph-tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const transportState = {
        nativePassivePullTimer: null,
        nativePassivePullInFlight: false,
        nativePassivePullLastToken: '',
        nativePassivePullPendingToken: '',
        nativePassivePullLastDataHash: '',
        webPassivePullTimer: null,
        webPassivePullInFlight: false,
        webPassivePullLastDataHash: '',
        browserSyncRootPassivePullLastDataHash: '',
        browserSyncRootPassivePullLastStatKey: '',
        webPassivePullFastLaneUntil: 0,
        morphServerSyncEventSource: null,
        morphServerSyncEventReconnectTimer: null,
        morphRuntimeSyncChannel: null,
        morphRuntimeSyncBridgeStarted: false,
        morphServerSyncBridgeStarted: false,
        bootstrapTransferState: null,
      };
      const readData = () => (typeof deps.getData === 'function' ? deps.getData() : null);
      const readStorage = () => (typeof deps.getStorage === 'function' ? deps.getStorage() : null);
      const getLastPersistFlushAt = () => (typeof deps.getLastPersistFlushAt === 'function' ? deps.getLastPersistFlushAt() : 0);
      const hasPendingLocalPersist = () => (typeof deps.hasPendingLocalPersist === 'function' ? deps.hasPendingLocalPersist() : false);
      const setSyncStatusText = (text) => {
        const el = documentRef && typeof documentRef.getElementById === 'function'
          ? documentRef.getElementById('sync-status-text')
          : null;
        if (el) {
          const nextText = String(text || '');
          el.textContent = nextText;
          if (el.dataset && typeof el.dataset === 'object') el.dataset.fullText = nextText;
          el.title = nextText;
        }
      };
      const shouldPausePassivePull = () => {
        if (typeof deps.shouldPausePassivePull === 'function') return !!deps.shouldPausePassivePull();
        return !!(windowRef && typeof windowRef.MorphShouldPausePassivePull === 'function' && windowRef.MorphShouldPausePassivePull());
      };
      const shouldDeferExternalReload = () => {
        if (typeof deps.shouldDeferExternalReload === 'function') return !!deps.shouldDeferExternalReload();
        return !!(windowRef && typeof windowRef.LianXingShouldDeferExternalReload === 'function' && windowRef.LianXingShouldDeferExternalReload());
      };
      const isRunningInNativeDesktopShell = () => (
        typeof deps.isRunningInNativeDesktopShell === 'function'
          ? !!deps.isRunningInNativeDesktopShell()
          : false
      );
      const isRunningInNativeIOSShell = () => (
        typeof deps.isRunningInNativeIOSShell === 'function'
          ? !!deps.isRunningInNativeIOSShell()
          : false
      );
      const markExternalSnapshotHash = (incomingHash, options = {}) => {
        const hash = String(incomingHash || '').trim();
        if (!hash) return false;
        const markNative = options.native !== false;
        const markWeb = options.web !== false;
        const markBrowserRoot = options.browserRoot === true;
        if (markNative) transportState.nativePassivePullLastDataHash = hash;
        if (markWeb) transportState.webPassivePullLastDataHash = hash;
        if (markBrowserRoot) {
          transportState.browserSyncRootPassivePullLastDataHash = hash;
          const statKey = String(options.statKey || '').trim();
          if (statKey) transportState.browserSyncRootPassivePullLastStatKey = statKey;
        }
        return true;
      };
      const recordReceipt = (partial = {}) => {
        if (typeof deps.recordMorphSyncReceipt === 'function') {
          deps.recordMorphSyncReceipt(partial);
        }
      };
      const getDataFingerprint = (value) => (typeof deps.dataFingerprint === 'function' ? deps.dataFingerprint(value) : '');
      const normalizeIncomingDataShape = (value) => (typeof deps.normalizeIncomingDataShape === 'function' ? deps.normalizeIncomingDataShape(value) : value);
      const hasAnyUserData = (value) => (typeof deps.hasAnyUserData === 'function' ? deps.hasAnyUserData(value) : false);
      const mergeExternalScheduleMvpSnapshot = (incoming = null) => {
        const current = readData();
        if (!incoming || typeof incoming !== 'object' || !current || typeof current !== 'object') return incoming;
        const currentCount = countScheduleMvpRecords(current.scheduleMvp);
        if (currentCount <= 0) return incoming;
        const incomingCount = countScheduleMvpRecords(incoming.scheduleMvp);
        if (incomingCount > 0) {
          const next = cloneJSONSafe(incoming) || incoming;
          next.scheduleMvp = mergeScheduleMvpState(current.scheduleMvp, incoming.scheduleMvp);
          return next;
        }
        const next = cloneJSONSafe(incoming) || incoming;
        next.scheduleMvp = mergeScheduleMvpState(current.scheduleMvp, null);
        return next;
      };
      const getCurrentSyncDeviceId = () => (typeof deps.getCurrentSyncDeviceId === 'function' ? deps.getCurrentSyncDeviceId() : '');
      const getAIChatRecoveryMaxSessions = () => Math.max(1, Number(
        typeof deps.getAIChatRecoveryMaxSessions === 'function' ? deps.getAIChatRecoveryMaxSessions() : 8
      ) || 8);
      const getAIChatRecoveryMaxMessages = () => Math.max(1, Number(
        typeof deps.getAIChatRecoveryMaxMessages === 'function' ? deps.getAIChatRecoveryMaxMessages() : 24
      ) || 24);
      const extractNativeSyncRootPathFromToken = (token) => (typeof deps.extractNativeSyncRootPathFromToken === 'function' ? deps.extractNativeSyncRootPathFromToken(token) : '');
      const isDeferredExternalApplyReason = (reason) => (typeof deps.isDeferredExternalApplyReason === 'function' ? deps.isDeferredExternalApplyReason(reason) : false);
      const getExpectedNativeSyncRootPath = () => (typeof deps.getExpectedNativeSyncRootPath === 'function' ? deps.getExpectedNativeSyncRootPath() : '');
      const adoptMorphExternalSyncRootPath = (payload, expected) => {
        if (typeof deps.adoptMorphExternalSyncRootPath === 'function') return deps.adoptMorphExternalSyncRootPath(payload, expected);
        return { reason: 'ok' };
      };
      const settleBrowserSyncRootStartupBootstrap = () => {
        if (typeof deps.settleBrowserSyncRootStartupBootstrap === 'function') deps.settleBrowserSyncRootStartupBootstrap();
      };
      const dismissStartupSkeleton = (delayMs = 0) => {
        if (typeof deps.dismissStartupSkeleton === 'function') deps.dismissStartupSkeleton(delayMs);
      };
      const markRuntimeLastRestoreAtNow = () => {
        if (typeof deps.markRuntimeLastRestoreAtNow === 'function') return deps.markRuntimeLastRestoreAtNow();
        const storage = readStorage();
        try {
          if (storage?.setLastRestoreAt) {
            storage.setLastRestoreAt(new Date().toISOString());
            return true;
          }
        } catch (_) {}
        return false;
      };
      const setNativeBootstrapAppliedForSession = (applied) => {
        if (typeof deps.setNativeBootstrapAppliedForSession === 'function') {
          return deps.setNativeBootstrapAppliedForSession(applied);
        }
        return false;
      };
      const applyOrQueueExternalSnapshot = (rawData, options = {}) => (
        typeof deps.applyOrQueueExternalSnapshot === 'function'
          ? deps.applyOrQueueExternalSnapshot(rawData, options)
          : { applied: false, reason: 'runtime_missing_apply', sourceSyncRootPath: '', expectedSyncRootPath: '' }
      );
      const applySoftExternalData = (rawData, options = {}) => (
        typeof deps.applySoftExternalData === 'function'
          ? deps.applySoftExternalData(rawData, options)
          : { applied: false, reason: 'runtime_missing_apply', sourceSyncRootPath: '', expectedSyncRootPath: '' }
      );
      const triggerWebPassivePullNow = async (reason = 'manual', options = {}) => {
        const run = hasReadableBrowserSyncRootSelected()
          ? performBrowserSyncRootPassivePull(reason)
          : performWebPassivePull(reason);
        try {
          return await run;
        } finally {
          if (options.reschedule !== false) {
            scheduleNextWebPassivePull();
          }
        }
      };
      function hasReadableBrowserSyncRootSelected() {
        try {
          const storage = readStorage();
          const meta = storage?.getWebSyncRootMeta ? storage.getWebSyncRootMeta() : null;
          return !!(meta && meta.readable !== false);
        } catch (_) {
          return false;
        }
      }
      function markWebPassivePullFastLane(ms = 12000) {
        transportState.webPassivePullFastLaneUntil = Math.max(
          transportState.webPassivePullFastLaneUntil,
          Date.now() + Math.max(2500, Number(ms) || 12000),
        );
      }
      function getBrowserSyncRootPassivePullIntervalMs() {
        return typeof deps.getBrowserSyncRootPassivePullIntervalMs === 'function'
          ? deps.getBrowserSyncRootPassivePullIntervalMs()
          : 1500;
      }
      function getWebServerPassivePullIntervalMs() {
        if (Date.now() < transportState.webPassivePullFastLaneUntil) {
          return typeof deps.getWebServerFastLanePassivePullIntervalMs === 'function'
            ? deps.getWebServerFastLanePassivePullIntervalMs()
            : 3000;
        }
        return typeof deps.getWebServerPassivePullIntervalMs === 'function'
          ? deps.getWebServerPassivePullIntervalMs()
          : 10000;
      }
      function getNextWebPassivePullIntervalMs() {
        return hasReadableBrowserSyncRootSelected()
          ? getBrowserSyncRootPassivePullIntervalMs()
          : getWebServerPassivePullIntervalMs();
      }
      function emitMorphRuntimeSyncPulse(reason = 'local-write', extras = {}) {
        if (!windowRef) return;
        const payload = {
          reason: String(reason || 'local-write').trim() || 'local-write',
          tabId: runtimeTabId,
          revision: typeof deps.getDataRevision === 'function' ? deps.getDataRevision(readData()) : 0,
          deviceId: getCurrentSyncDeviceId(),
          changedAt: new Date().toISOString(),
          ...extras,
        };
        try {
          windowRef.localStorage?.setItem?.(runtimePulseKey, JSON.stringify(payload));
        } catch (_) {}
        try {
          transportState.morphRuntimeSyncChannel?.postMessage?.(payload);
        } catch (_) {}
      }
      function handleMorphRuntimeSyncPulse(payload, source = 'runtime-pulse') {
        if (!payload || typeof payload !== 'object') return;
        if (String(payload.tabId || '').trim() === runtimeTabId) return;
        markWebPassivePullFastLane(12000);
        void triggerWebPassivePullNow(source, { reschedule: false });
      }
      function startRuntimeSyncPulseBridge() {
        if (transportState.morphRuntimeSyncBridgeStarted || !windowRef) return;
        transportState.morphRuntimeSyncBridgeStarted = true;
        if (typeof windowRef.BroadcastChannel === 'function') {
          try {
            transportState.morphRuntimeSyncChannel = new windowRef.BroadcastChannel(runtimeChannelName);
            transportState.morphRuntimeSyncChannel.addEventListener('message', (event) => {
              handleMorphRuntimeSyncPulse(event?.data || null, 'runtime-channel');
            });
          } catch (_) {
            transportState.morphRuntimeSyncChannel = null;
          }
        }
        windowRef.addEventListener('storage', (event) => {
          if (event.key !== runtimePulseKey || !event.newValue) return;
          try {
            handleMorphRuntimeSyncPulse(JSON.parse(event.newValue), 'runtime-storage');
          } catch (_) {}
        });
        windowRef.addEventListener('online', () => {
          markWebPassivePullFastLane(12000);
          void triggerWebPassivePullNow('online', { reschedule: false });
        });
      }
      function scheduleServerSyncEventReconnect(delayMs = 1500) {
        clearTimeout(transportState.morphServerSyncEventReconnectTimer);
        transportState.morphServerSyncEventReconnectTimer = setTimeout(() => {
          transportState.morphServerSyncEventReconnectTimer = null;
          startServerSyncEventStream();
        }, Math.max(600, Number(delayMs) || 1500));
      }
      function shouldSkipServerSyncEventPassivePull(payload = {}) {
        const incomingRevision = Number(payload?.revision || 0);
        if (!Number.isFinite(incomingRevision) || incomingRevision <= 0) return false;
        const localRevision = Number(
          typeof deps.getDataRevision === 'function'
            ? deps.getDataRevision(readData())
            : 0
        );
        if (!Number.isFinite(localRevision) || localRevision <= 0) return false;
        return incomingRevision <= localRevision;
      }
      function handleServerSyncEventPayload(payload = {}, eventName = 'message') {
        if (!payload || typeof payload !== 'object') return;
        if (shouldSkipServerSyncEventPassivePull(payload)) return;
        markWebPassivePullFastLane(15000);
        void triggerWebPassivePullNow(`server-event:${String(eventName || 'message').trim() || 'message'}`, { reschedule: false });
      }
      function startServerSyncEventStream() {
        if (transportState.morphServerSyncBridgeStarted && transportState.morphServerSyncEventSource) return;
        if (isRunningInNativeDesktopShell() || isRunningInNativeIOSShell()) return;
        if (!windowRef || !windowRef.location || !/^https?:$/.test(String(windowRef.location.protocol || ''))) return;
        if (typeof windowRef.EventSource !== 'function') return;
        transportState.morphServerSyncBridgeStarted = true;
        clearTimeout(transportState.morphServerSyncEventReconnectTimer);
        if (transportState.morphServerSyncEventSource) {
          try { transportState.morphServerSyncEventSource.close(); } catch (_) {}
          transportState.morphServerSyncEventSource = null;
        }
        try {
          const es = new windowRef.EventSource(String(deps.getServerSyncEventUrl?.() || '/api/sync/events'));
          transportState.morphServerSyncEventSource = es;
          es.addEventListener('hello', (event) => {
            try {
              handleServerSyncEventPayload(JSON.parse(String(event?.data || '{}')), 'hello');
            } catch (_) {}
          });
          es.addEventListener('live-data-committed', (event) => {
            try {
              handleServerSyncEventPayload(JSON.parse(String(event?.data || '{}')), 'live-data-committed');
            } catch (_) {}
          });
          es.addEventListener('live-data-changed', (event) => {
            try {
              handleServerSyncEventPayload(JSON.parse(String(event?.data || '{}')), 'live-data-changed');
            } catch (_) {}
          });
          es.onerror = () => {
            if (transportState.morphServerSyncEventSource === es) {
              try { transportState.morphServerSyncEventSource.close(); } catch (_) {}
              transportState.morphServerSyncEventSource = null;
            }
            scheduleServerSyncEventReconnect(1800);
          };
        } catch (_) {
          transportState.morphServerSyncEventSource = null;
          scheduleServerSyncEventReconnect(2200);
        }
      }
      async function bootstrapSelectedBrowserSyncRoot() {
        if (isRunningInNativeDesktopShell() || isRunningInNativeIOSShell()) return false;
        if (!hasReadableBrowserSyncRootSelected()) {
          settleBrowserSyncRootStartupBootstrap();
          return false;
        }
        const storage = readStorage();
        if (!storage?.reloadDataFromWebSyncRoot) {
          settleBrowserSyncRootStartupBootstrap();
          return false;
        }
        try {
          const res = await storage.reloadDataFromWebSyncRoot({ silent: true });
          const incomingHash = getDataFingerprint(res?.data || null);
          if (incomingHash) {
            markExternalSnapshotHash(incomingHash, { native: true, web: true, browserRoot: true });
          }
          if (storage?.inspectLiveDataFromWebSyncRoot) {
            try {
              const stat = await storage.inspectLiveDataFromWebSyncRoot();
              const statKey = String(stat?.signature || '').trim();
              if (statKey) transportState.browserSyncRootPassivePullLastStatKey = statKey;
            } catch (_) {}
          }
          setSyncStatusText('已载入用户目录');
          settleBrowserSyncRootStartupBootstrap();
          dismissStartupSkeleton(0);
          return true;
        } catch (error) {
          console.warn('[Morpheus startup] bootstrapSelectedBrowserSyncRoot failed', error);
          settleBrowserSyncRootStartupBootstrap();
          dismissStartupSkeleton(0);
          return false;
        }
      }
      function startNativePassivePull() {
        if (isRunningInNativeIOSShell()) return;
        if (transportState.nativePassivePullTimer) return;
        transportState.nativePassivePullTimer = setInterval(async () => {
          const storage = readStorage();
          if (documentRef?.visibilityState === 'hidden') return;
          if (transportState.nativePassivePullInFlight) return;
          if (shouldPausePassivePull()) return;
          if (typeof deps.isUserEditComposeActive === 'function' && deps.isUserEditComposeActive()) return;
          const ae = documentRef?.activeElement;
          if (ae && (ae.matches?.('[contenteditable="true"]') || ae.closest?.('[contenteditable="true"]'))) return;
          if (!storage || typeof storage.hasNativeControlBridge !== 'function') return;
          if (!storage.hasNativeControlBridge()) return;
          transportState.nativePassivePullInFlight = true;
          try {
            let token = '';
            try {
              const tokenRes = await storage.callNativeDesktopControl('getLiveDataToken');
              token = String(tokenRes?.token || '');
            } catch (_) {
              token = '';
            }
            if (!token) {
              const res = await storage.callNativeDesktopControl('getLiveData');
              if (!res || !res.data) return;
              const incoming = mergeExternalScheduleMvpSnapshot(normalizeIncomingDataShape(res.data));
              if (!hasAnyUserData(incoming) && hasAnyUserData(readData())) return;
              const incomingHash = getDataFingerprint(incoming);
              const localHash = getDataFingerprint(readData());
              if (!incomingHash) return;
              if (incomingHash === localHash) {
                markExternalSnapshotHash(incomingHash, { native: true, web: false });
                return;
              }
              if (!transportState.nativePassivePullLastDataHash) {
                markExternalSnapshotHash(incomingHash, { native: true, web: false });
                return;
              }
              if (incomingHash === transportState.nativePassivePullLastDataHash) return;
              if (shouldPausePassivePull()) return;
              if (typeof deps.shouldDeferExternalReload === 'function' ? deps.shouldDeferExternalReload() : shouldDeferExternalReload()) return;
              const applyResult = applyOrQueueExternalSnapshot(incoming, { authoritative: true, sourceSyncRootPath: res?.path || '' });
              if (applyResult.applied) {
                markExternalSnapshotHash(incomingHash, { native: true, web: false });
                setSyncStatusText('已同步');
              }
              return;
            }
            const tokenSyncRootPath = extractNativeSyncRootPathFromToken(token);

            if (!transportState.nativePassivePullLastToken) {
              let shouldAdvanceToken = false;
              try {
                const fullRes = await storage.callNativeDesktopControl('getLiveData');
                if (fullRes && fullRes.data) {
                  const incoming = mergeExternalScheduleMvpSnapshot(normalizeIncomingDataShape(fullRes.data));
                  const incomingHash = getDataFingerprint(incoming);
                  const localHash = getDataFingerprint(readData());
                  if (incomingHash && incomingHash !== localHash) {
                    if (shouldPausePassivePull()) return;
                    if (!(typeof deps.shouldDeferExternalReload === 'function' ? deps.shouldDeferExternalReload() : shouldDeferExternalReload())) {
                      const applyResult = applyOrQueueExternalSnapshot(incoming, {
                        authoritative: true,
                        sourceSyncRootPath: fullRes?.path || tokenSyncRootPath,
                      });
                      if (applyResult.applied) {
                        markExternalSnapshotHash(incomingHash, { native: true, web: false });
                        setSyncStatusText('已同步');
                        shouldAdvanceToken = true;
                      } else if (isDeferredExternalApplyReason(applyResult.reason)) {
                        return;
                      } else {
                        shouldAdvanceToken = true;
                      }
                    }
                  } else if (incomingHash) {
                    markExternalSnapshotHash(incomingHash, { native: true, web: false });
                    shouldAdvanceToken = true;
                  } else {
                    shouldAdvanceToken = true;
                  }
                }
              } catch (_) {}
              if (shouldAdvanceToken) {
                transportState.nativePassivePullLastToken = token;
                transportState.nativePassivePullPendingToken = '';
              }
              return;
            }
            if (token === transportState.nativePassivePullLastToken) {
              transportState.nativePassivePullPendingToken = '';
              return;
            }
            transportState.nativePassivePullPendingToken = token;
            if (hasPendingLocalPersist() || (Date.now() - getLastPersistFlushAt() < 5000)) {
              return;
            }
            if (typeof deps.shouldDeferExternalReload === 'function' ? deps.shouldDeferExternalReload() : shouldDeferExternalReload()) return;
            try {
              const fullRes = await storage.callNativeDesktopControl('getLiveData');
              if (fullRes && fullRes.data) {
                const incoming = mergeExternalScheduleMvpSnapshot(normalizeIncomingDataShape(fullRes.data));
                if (!hasAnyUserData(incoming) && hasAnyUserData(readData())) {
                  // Keep existing local data when external snapshot is empty.
                } else {
                  const incomingHash = getDataFingerprint(incoming);
                  const localHash = getDataFingerprint(readData());
                  if (incomingHash && incomingHash !== localHash) {
                    if (shouldPausePassivePull()) return;
                    const applyResult = applyOrQueueExternalSnapshot(incoming, {
                      authoritative: true,
                      sourceSyncRootPath: fullRes?.path || tokenSyncRootPath,
                    });
                    if (applyResult.applied) markExternalSnapshotHash(incomingHash, { native: true, web: false });
                    else if (isDeferredExternalApplyReason(applyResult.reason)) return;
                  } else if (incomingHash) {
                    markExternalSnapshotHash(incomingHash, { native: true, web: false });
                  }
                }
              }
            } catch (_) {}
            transportState.nativePassivePullLastToken = token;
            transportState.nativePassivePullPendingToken = '';
            setSyncStatusText('已同步');
          } catch {
            // ignore; keep background polling quiet
          } finally {
            transportState.nativePassivePullInFlight = false;
          }
        }, typeof deps.getNativePassivePullIntervalMs === 'function' ? deps.getNativePassivePullIntervalMs() : 10000);
      }
      async function performWebPassivePull(reason = 'interval') {
        if (isRunningInNativeDesktopShell() || isRunningInNativeIOSShell()) return false;
        if (!windowRef || !windowRef.location || !/^https?:$/.test(String(windowRef.location.protocol || ''))) return false;
        if (hasReadableBrowserSyncRootSelected()) return false;
        if (documentRef?.visibilityState === 'hidden') return false;
        if (transportState.webPassivePullInFlight) return false;
        if (shouldPausePassivePull()) return false;
        transportState.webPassivePullInFlight = true;
        try {
          const res = await fetch(`/data/live-data.json?t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-store' },
          });
          if (!res.ok) return false;
          const raw = await res.json().catch(() => null);
          if (!raw || typeof raw !== 'object') return false;
          const incoming = mergeExternalScheduleMvpSnapshot(normalizeIncomingDataShape(raw));
          if (!hasAnyUserData(incoming) && hasAnyUserData(readData())) return false;
          const incomingHash = getDataFingerprint(incoming);
          const localHash = getDataFingerprint(readData());
          if (!incomingHash) return false;
          if (incomingHash === localHash) {
            markExternalSnapshotHash(incomingHash, { native: false, web: true });
            return false;
          }
          const eagerReason = reason !== 'interval';
          if (!transportState.webPassivePullLastDataHash) {
            markExternalSnapshotHash(incomingHash, { native: false, web: true });
            if (!eagerReason) return false;
          }
          if (incomingHash === transportState.webPassivePullLastDataHash && reason === 'interval') return false;
          const applyResult = applyOrQueueExternalSnapshot(incoming, { authoritative: true });
          if (applyResult.applied) {
            markExternalSnapshotHash(incomingHash, { native: false, web: true });
            setSyncStatusText('已同步');
            return true;
          }
          return false;
        } catch (_) {
          return false;
        } finally {
          transportState.webPassivePullInFlight = false;
        }
      }
      async function performBrowserSyncRootPassivePull(reason = 'interval') {
        if (isRunningInNativeDesktopShell() || isRunningInNativeIOSShell()) return false;
        if (!hasReadableBrowserSyncRootSelected()) return false;
        const storage = readStorage();
        if (!storage?.readLiveDataFromWebSyncRoot) return false;
        if (documentRef?.visibilityState === 'hidden') return false;
        if (transportState.webPassivePullInFlight) return false;
        if (shouldPausePassivePull()) return false;
        transportState.webPassivePullInFlight = true;
        try {
          const eagerReason = reason !== 'interval';
          let statKey = '';
          if (storage?.inspectLiveDataFromWebSyncRoot) {
            try {
              const stat = await storage.inspectLiveDataFromWebSyncRoot();
              statKey = String(stat?.signature || '').trim();
              if (statKey) {
                if (!transportState.browserSyncRootPassivePullLastStatKey) {
                  transportState.browserSyncRootPassivePullLastStatKey = statKey;
                  if (!eagerReason && transportState.browserSyncRootPassivePullLastDataHash) return false;
                }
                if (statKey === transportState.browserSyncRootPassivePullLastStatKey && reason === 'interval') return false;
              }
            } catch (_) {}
          }
          const loaded = await storage.readLiveDataFromWebSyncRoot();
          const incoming = mergeExternalScheduleMvpSnapshot(normalizeIncomingDataShape(loaded?.data || null));
          if (!hasAnyUserData(incoming) && hasAnyUserData(readData())) return false;
          const incomingHash = getDataFingerprint(incoming);
          const localHash = getDataFingerprint(readData());
          if (!incomingHash) return false;
          if (incomingHash === localHash) {
            markExternalSnapshotHash(incomingHash, { native: true, web: true, browserRoot: true, statKey });
            return false;
          }
          if (!transportState.browserSyncRootPassivePullLastDataHash) {
            markExternalSnapshotHash(incomingHash, { native: true, web: true, browserRoot: true, statKey });
            if (!eagerReason) return false;
          }
          if (incomingHash === transportState.browserSyncRootPassivePullLastDataHash && reason === 'interval') return false;
          if (shouldPausePassivePull()) return false;
          if (typeof deps.shouldDeferExternalReload === 'function' ? deps.shouldDeferExternalReload() : shouldDeferExternalReload()) {
            return false;
          }
          const applyResult = applyOrQueueExternalSnapshot(incoming, {
            authoritative: true,
            sourceSyncRootPath: String(loaded?.relativePath || '').trim(),
          });
          if (applyResult.applied) {
            markExternalSnapshotHash(incomingHash, { native: true, web: true, browserRoot: true, statKey });
            setSyncStatusText('已同步用户目录');
            return true;
          }
          return false;
        } catch (_) {
          return false;
        } finally {
          transportState.webPassivePullInFlight = false;
        }
      }
      function scheduleNextWebPassivePull(delayMs = null) {
        clearTimeout(transportState.webPassivePullTimer);
        transportState.webPassivePullTimer = setTimeout(() => {
          transportState.webPassivePullTimer = null;
          void triggerWebPassivePullNow('interval');
        }, Math.max(500, Number(delayMs) || getNextWebPassivePullIntervalMs()));
      }
      function startWebPassivePull() {
        if (isRunningInNativeDesktopShell() || isRunningInNativeIOSShell()) return;
        if (!windowRef || !windowRef.location || !/^https?:$/.test(String(windowRef.location.protocol || ''))) return;
        if (transportState.webPassivePullTimer) return;
        const tick = (reason = 'interval') => {
          markWebPassivePullFastLane(reason === 'startup' ? 10000 : 15000);
          void triggerWebPassivePullNow(reason, { reschedule: false });
        };
        scheduleNextWebPassivePull(900);
        windowRef.addEventListener('focus', () => { tick('focus'); });
        documentRef?.addEventListener?.('visibilitychange', () => {
          if (documentRef.visibilityState === 'visible') tick('visible');
        });
        setTimeout(() => { tick('startup'); }, 800);
      }
      function softRefreshFromNative() {
        (async () => {
          try {
            if (shouldDeferExternalReload()) return;
            const storage = readStorage();
            if (!storage || typeof storage.hasNativeControlBridge !== 'function' || !storage.hasNativeControlBridge()) return;
            const res = await storage.callNativeDesktopControl('getLiveData');
            if (!res || !res.data) return;
            const incoming = mergeExternalScheduleMvpSnapshot(normalizeIncomingDataShape(res.data));
            if (!hasAnyUserData(incoming) && hasAnyUserData(readData())) return;
            const incomingHash = getDataFingerprint(incoming);
            if (!incomingHash) return;
            if (incomingHash === getDataFingerprint(readData())) return;
            const applyResult = applyOrQueueExternalSnapshot(incoming, { authoritative: true, sourceSyncRootPath: res?.path || '' });
            if (applyResult.applied) {
              markExternalSnapshotHash(incomingHash, { native: true, web: false });
              setSyncStatusText('已同步');
            }
          } catch (_) {
            // keep silent; native side can fallback to hard reload
          }
        })();
        return true;
      }
      function onSyncStatusChanged(state, text) {
        if (String(state || '').trim() === 'ok' && typeof deps.markCurrentDataAsSyncConfirmed === 'function') {
          deps.markCurrentDataAsSyncConfirmed();
        }
        if (typeof deps.syncMobileSyncStatusIndicator === 'function') {
          deps.syncMobileSyncStatusIndicator(state, text);
        }
        if (typeof deps.getCurrentTab === 'function' && deps.getCurrentTab() === 'settings') {
          if (typeof deps.syncSettingsStatusBadgeFromGlobal === 'function') deps.syncSettingsStatusBadgeFromGlobal();
          if (typeof deps.syncSettingsSummaryUI === 'function') deps.syncSettingsSummaryUI();
        }
      }
      function applyServerSyncSnapshot(rawData, options = {}) {
        try {
          const targetWindow = typeof windowRef !== 'undefined' && windowRef
            ? windowRef
            : (typeof window !== 'undefined' ? window : null);
          const writeApplyStatus = (status = {}) => {
            if (!targetWindow) return;
            try {
              targetWindow.__MorphLastServerSyncApplyStatus = status;
              targetWindow.__LianXingLastServerSyncApplyStatus = status;
            } catch (_) {}
          };
          const incoming = mergeExternalScheduleMvpSnapshot(normalizeIncomingDataShape(rawData));
          const incomingHash = getDataFingerprint(incoming);
          if (!incomingHash) {
            writeApplyStatus({
              ok: false,
              accepted: false,
              applied: false,
              reason: 'empty_incoming_hash',
              incomingHash: '',
            });
            return false;
          }
          const localHash = getDataFingerprint(readData());
          if (incomingHash === localHash) {
            writeApplyStatus({
              ok: true,
              accepted: true,
              applied: false,
              reason: 'same_data',
              incomingHash,
              localHash,
            });
            return true;
          }
          const explicitImport = options
            && typeof options === 'object'
            && (options.force === true || options.forceApply === true);
          const acceptDeferred = options && typeof options === 'object' && options.acceptDeferred === true;
          const applyResult = explicitImport
            ? applySoftExternalData(incoming, {
              authoritative: true,
              force: true,
              acceptAsCurrentSyncRoot: true,
              sourceSyncRootPath: String(options.sourceSyncRootPath || '').trim(),
            })
            : applyOrQueueExternalSnapshot(incoming, { authoritative: true });
          if (applyResult.applied) {
            markExternalSnapshotHash(incomingHash, {
              native: true,
              web: true,
              browserRoot: !!explicitImport,
              statKey: '',
            });
            if (explicitImport && !['browser-sync-root', 'server-sync-ack'].includes(String(options.source || '').trim())) {
              const storage = readStorage();
              if (storage?.scheduleServerSync) {
                try {
                  storage.scheduleServerSync(incoming);
                } catch (_) {}
              }
            }
            writeApplyStatus({
              ok: true,
              accepted: true,
              applied: true,
              reason: 'applied',
              incomingHash,
              localHash,
            });
            return true;
          }
          const acceptedNoop = ['same_data', 'stale_external_snapshot', 'empty_external_snapshot', 'editing_in_progress', 'local_dirty_pending_sync', 'external_reload_deferred', 'draft_protected', ...(acceptDeferred ? ['recent_local_commit'] : [])].includes(String(applyResult.reason || ''));
          writeApplyStatus({
            ok: acceptedNoop,
            accepted: acceptedNoop,
            applied: false,
            reason: String(applyResult.reason || ''),
            incomingHash,
            localHash,
          });
          return acceptedNoop;
        } catch (_) {
          const targetWindow = typeof windowRef !== 'undefined' && windowRef
            ? windowRef
            : (typeof window !== 'undefined' ? window : null);
          if (targetWindow) {
            try {
              targetWindow.__MorphLastServerSyncApplyStatus = {
                ok: false,
                accepted: false,
                applied: false,
                reason: 'exception',
              };
              targetWindow.__LianXingLastServerSyncApplyStatus = targetWindow.__MorphLastServerSyncApplyStatus;
            } catch (_) {}
          }
          return false;
        }
      }
      function writeBootstrapApplyStatus(status = {}) {
        if (!windowRef) return;
        try {
          windowRef.__MorphLastBootstrapApplyStatus = status;
          windowRef.__LianXingLastBootstrapApplyStatus = status;
        } catch (_) {}
      }
      function applyBootstrapFromJSON(jsonText, options = {}) {
        try {
          if (!jsonText || typeof jsonText !== 'string') return false;
          const parsed = JSON.parse(jsonText);
          const incoming = mergeExternalScheduleMvpSnapshot(normalizeIncomingDataShape(parsed));
          const incomingHash = getDataFingerprint(incoming);
          if (!incomingHash) {
            writeBootstrapApplyStatus({ ok: false, reason: 'empty_incoming_hash' });
            return false;
          }
          const forceApply = options && typeof options === 'object'
            ? options.forceApply === true
            : true;
          const sourceSyncRootPath = String(
            (options && typeof options === 'object' && options.sourceSyncRootPath)
            || windowRef?.__MorphNativePendingSyncRootPath
            || windowRef?.__LianXingNativePendingSyncRootPath
            || ''
          ).trim();
          const applyResult = applySoftExternalData(incoming, {
            authoritative: true,
            force: forceApply,
            sourceSyncRootPath,
            acceptAsCurrentSyncRoot: true,
          });
          const acceptedNoopReasons = forceApply
            ? ['same_data', 'stale_external_snapshot', 'empty_external_snapshot']
            : ['same_data', 'stale_external_snapshot', 'empty_external_snapshot', 'editing_in_progress', 'local_dirty_pending_sync', 'external_reload_deferred', 'recent_local_commit'];
          const accepted = applyResult.applied || acceptedNoopReasons.includes(String(applyResult.reason || ''));
          if (applyResult.applied || String(applyResult.reason || '') === 'same_data') {
            markRuntimeLastRestoreAtNow();
            try {
              const storage = readStorage();
              if (storage?.writeStartupSnapshotData) {
                const startupSnapshotPayload = typeof storage?.serializeDataForPersistence === 'function'
                  ? storage.serializeDataForPersistence(incoming, {
                    maxSessions: getAIChatRecoveryMaxSessions(),
                    maxMessages: getAIChatRecoveryMaxMessages(),
                  })
                  : incoming;
                storage.writeStartupSnapshotData(startupSnapshotPayload);
              }
            } catch (_) {}
          }
          writeBootstrapApplyStatus({
            ok: !!accepted,
            reason: String(applyResult.reason || ''),
            applied: applyResult.applied === true,
            forceApply,
            sourceSyncRootPath,
            incomingHash,
          });
          if (accepted) {
            if (applyResult.applied) {
              markExternalSnapshotHash(incomingHash, { native: true, web: true, browserRoot: true });
            }
            setNativeBootstrapAppliedForSession(true);
            dismissStartupSkeleton(0);
            return true;
          }
          return false;
        } catch (error) {
          writeBootstrapApplyStatus({
            ok: false,
            reason: 'exception',
            message: String(error?.message || error || ''),
          });
          return false;
        }
      }
      function beginBootstrapTransfer(meta) {
        try {
          const info = meta && typeof meta === 'object' ? meta : {};
          const totalChunks = Math.max(0, Number(info.totalChunks || 0));
          const syncRootPath = String(info.syncRootPath || '').trim();
          transportState.bootstrapTransferState = {
            chunks: new Array(totalChunks),
            totalChunks,
            receivedChunks: 0,
            forceApply: info.forceApply === true,
            syncRootPath,
          };
          if (syncRootPath && windowRef) {
            windowRef.__MorphNativePendingSyncRootPath = syncRootPath;
            windowRef.__LianXingNativePendingSyncRootPath = syncRootPath;
          }
          return totalChunks >= 0;
        } catch (_) {
          transportState.bootstrapTransferState = null;
          return false;
        }
      }
      function appendBootstrapTransferChunk(index, chunk) {
        try {
          const state = transportState.bootstrapTransferState;
          if (!state) return false;
          const slot = Number(index);
          if (!Number.isFinite(slot) || slot < 0 || slot >= state.totalChunks) return false;
          if (state.chunks[slot] == null) state.receivedChunks += 1;
          state.chunks[slot] = String(chunk || '');
          return true;
        } catch (_) {
          return false;
        }
      }
      function finishBootstrapTransfer() {
        try {
          const state = transportState.bootstrapTransferState;
          transportState.bootstrapTransferState = null;
          if (!state) return false;
          if (state.receivedChunks !== state.totalChunks) return false;
          const jsonText = state.chunks.join('');
          if (!jsonText) return false;
          return applyBootstrapFromJSON(jsonText, {
            forceApply: state.forceApply === true,
            sourceSyncRootPath: state.syncRootPath,
          });
        } catch (_) {
          transportState.bootstrapTransferState = null;
          return false;
        }
      }
      return {
        sanitizeSyncMutationJournal,
        sanitizeSyncReceipt,
        buildSyncEntityStates,
        buildSyncDomainStates,
        recordPendingSyncMutation(data, options = {}) {
          return recordPendingSyncMutation(data, {
            ...options,
            normalizeData: typeof deps.normalizeData === 'function' ? deps.normalizeData : (value) => value,
            getSyncDeviceId: typeof deps.getSyncDeviceId === 'function' ? deps.getSyncDeviceId : () => '',
            readSyncMutationJournal: typeof deps.readSyncMutationJournal === 'function' ? deps.readSyncMutationJournal : () => [],
            writeSyncMutationJournal: typeof deps.writeSyncMutationJournal === 'function' ? deps.writeSyncMutationJournal : () => {},
            slimPersistedAIChatSessions: typeof deps.slimPersistedAIChatSessions === 'function'
              ? deps.slimPersistedAIChatSessions
              : null,
            syncJournalAIChatMaxSessions: Number(deps.syncJournalAIChatMaxSessions),
            syncJournalAIChatMaxMessages: Number(deps.syncJournalAIChatMaxMessages),
          });
        },
        acknowledgeSyncMutationsThroughRevision(revision) {
          return acknowledgeSyncMutationsThroughRevision(revision, {
            readSyncMutationJournal: typeof deps.readSyncMutationJournal === 'function' ? deps.readSyncMutationJournal : () => [],
            writeSyncMutationJournal: typeof deps.writeSyncMutationJournal === 'function' ? deps.writeSyncMutationJournal : () => {},
            getLastAckRevision: typeof deps.getLastAckRevision === 'function' ? deps.getLastAckRevision : () => 0,
            setLastAckRevision: typeof deps.setLastAckRevision === 'function' ? deps.setLastAckRevision : () => {},
            readLastSyncReceipt: typeof deps.readLastSyncReceipt === 'function' ? deps.readLastSyncReceipt : () => null,
          });
        },
        acknowledgeSyncMutationsByIds(mutationIds = [], fallbackRevision = 0) {
          return acknowledgeSyncMutationsByIds(mutationIds, fallbackRevision, {
            readSyncMutationJournal: typeof deps.readSyncMutationJournal === 'function' ? deps.readSyncMutationJournal : () => [],
            writeSyncMutationJournal: typeof deps.writeSyncMutationJournal === 'function' ? deps.writeSyncMutationJournal : () => {},
            getLastAckRevision: typeof deps.getLastAckRevision === 'function' ? deps.getLastAckRevision : () => 0,
            setLastAckRevision: typeof deps.setLastAckRevision === 'function' ? deps.setLastAckRevision : () => {},
            readLastSyncReceipt: typeof deps.readLastSyncReceipt === 'function' ? deps.readLastSyncReceipt : () => null,
          });
        },
        getSyncMutationState() {
          return getSyncMutationState({
            readSyncMutationJournal: typeof deps.readSyncMutationJournal === 'function' ? deps.readSyncMutationJournal : () => [],
            getLastAckRevision: typeof deps.getLastAckRevision === 'function' ? deps.getLastAckRevision : () => 0,
            readLastSyncReceipt: typeof deps.readLastSyncReceipt === 'function' ? deps.readLastSyncReceipt : () => null,
          });
        },
        buildSyncReceiptRecord(receipt, options = {}) {
          return buildSyncReceiptRecord(receipt, {
            ...options,
            readSyncMutationJournal: typeof deps.readSyncMutationJournal === 'function' ? deps.readSyncMutationJournal : () => [],
          });
        },
        deriveSyncStatusDescriptor,
        markExternalSnapshotHash,
        markWebPassivePullFastLane,
        getBrowserSyncRootPassivePullIntervalMs,
        getWebServerPassivePullIntervalMs,
        getNextWebPassivePullIntervalMs,
        hasReadableBrowserSyncRootSelected,
        emitMorphRuntimeSyncPulse,
        handleMorphRuntimeSyncPulse,
        startRuntimeSyncPulseBridge,
        scheduleServerSyncEventReconnect,
        handleServerSyncEventPayload,
        startServerSyncEventStream,
        bootstrapSelectedBrowserSyncRoot,
        hasPendingLocalPersist,
        startNativePassivePull,
        performWebPassivePull,
        performBrowserSyncRootPassivePull,
        scheduleNextWebPassivePull,
        triggerWebPassivePullNow,
        startWebPassivePull,
        onSyncStatusChanged,
        softRefreshFromNative,
        applyServerSyncSnapshot,
        applyBootstrapFromJSON,
        beginBootstrapTransfer,
        appendBootstrapTransferChunk,
        finishBootstrapTransfer,
      };
    },
  };
  window.LianXingSyncRuntime = window.MorphSyncRuntime;
})();
