(function initMorphAIActionExecutionRuntime() {
  function cloneJSONSafe(value) {
    try {
      return value == null ? value : JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function createAIActionExecutionRuntimeModules(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const getData = typeof api.getData === 'function'
      ? api.getData
      : () => (typeof data !== 'undefined' ? data : {});
    const getViewStateRuntimeModules = typeof api.getViewStateRuntimeModules === 'function'
      ? api.getViewStateRuntimeModules
      : () => (typeof getViewStateRuntimeModules === 'function' ? getViewStateRuntimeModules() : null);
    const getCurrentTab = typeof api.getCurrentTab === 'function'
      ? api.getCurrentTab
      : () => (typeof currentTab !== 'undefined' ? currentTab : '');
    const getSelectedDailyMonth = typeof api.getSelectedDailyMonth === 'function'
      ? api.getSelectedDailyMonth
      : () => (typeof selectedDailyMonth !== 'undefined' ? selectedDailyMonth : '');
    const getAIChatState = typeof api.getAIChatState === 'function'
      ? api.getAIChatState
      : () => (typeof aiChatState !== 'undefined' ? aiChatState : {});
    const getActiveThoughtsViewPane = typeof api.getActiveThoughtsViewPane === 'function'
      ? api.getActiveThoughtsViewPane
      : () => (typeof activeThoughtsViewPane !== 'undefined' ? activeThoughtsViewPane : '');
    const getActiveProjectCollectionPane = typeof api.getActiveProjectCollectionPane === 'function'
      ? api.getActiveProjectCollectionPane
      : () => (typeof activeProjectCollectionPane !== 'undefined' ? activeProjectCollectionPane : '');
    const getActiveProjectSpaceId = typeof api.getActiveProjectSpaceId === 'function'
      ? api.getActiveProjectSpaceId
      : () => (typeof activeProjectSpaceId !== 'undefined' ? activeProjectSpaceId : '');
    const getActiveProjectViewPane = typeof api.getActiveProjectViewPane === 'function'
      ? api.getActiveProjectViewPane
      : () => (typeof activeProjectViewPane !== 'undefined' ? activeProjectViewPane : '');
    const getActiveLocalPluginWorkspaceId = typeof api.getActiveLocalPluginWorkspaceId === 'function'
      ? api.getActiveLocalPluginWorkspaceId
      : () => (typeof activeLocalPluginWorkspaceId !== 'undefined' ? activeLocalPluginWorkspaceId : '');
    const setCurrentTab = typeof api.setCurrentTab === 'function' ? api.setCurrentTab : (value) => { if (typeof currentTab !== 'undefined') currentTab = String(value || '').trim() || 'flashThoughts'; };
    const setActiveContextId = typeof api.setActiveContextId === 'function' ? api.setActiveContextId : (value) => { if (typeof activeContextId !== 'undefined') activeContextId = String(value || '').trim() || null; };
    const setSelectedDailyMonth = typeof api.setSelectedDailyMonth === 'function' ? api.setSelectedDailyMonth : (value) => { if (typeof selectedDailyMonth !== 'undefined') selectedDailyMonth = String(value || '').trim(); };
    const setAIChatSessionId = typeof api.setAIChatSessionId === 'function' ? api.setAIChatSessionId : (value) => { if (typeof aiChatState !== 'undefined' && aiChatState && typeof aiChatState === 'object') aiChatState.sessionId = String(value || '').trim(); };
    const setActiveThoughtsViewPane = typeof api.setActiveThoughtsViewPane === 'function' ? api.setActiveThoughtsViewPane : (value) => { if (typeof activeThoughtsViewPane !== 'undefined') activeThoughtsViewPane = String(value || '').trim(); };
    const setActiveProjectCollectionPane = typeof api.setActiveProjectCollectionPane === 'function' ? api.setActiveProjectCollectionPane : (value) => { if (typeof activeProjectCollectionPane !== 'undefined') activeProjectCollectionPane = String(value || '').trim(); };
    const setActiveProjectSpaceId = typeof api.setActiveProjectSpaceId === 'function' ? api.setActiveProjectSpaceId : (value) => { if (typeof activeProjectSpaceId !== 'undefined') activeProjectSpaceId = String(value || '').trim(); };
    const setActiveProjectViewPane = typeof api.setActiveProjectViewPane === 'function' ? api.setActiveProjectViewPane : (value) => { if (typeof activeProjectViewPane !== 'undefined') activeProjectViewPane = String(value || '').trim(); };
    const setActiveLocalPluginWorkspaceId = typeof api.setActiveLocalPluginWorkspaceId === 'function' ? api.setActiveLocalPluginWorkspaceId : (value) => { if (typeof activeLocalPluginWorkspaceId !== 'undefined') activeLocalPluginWorkspaceId = String(value || '').trim(); };
    const setLastUserEditAt = typeof api.setLastUserEditAt === 'function'
      ? api.setLastUserEditAt
      : (value) => { if (typeof lastUserEditAt !== 'undefined') lastUserEditAt = Number.isFinite(Number(value)) ? Number(value) : Date.now(); };
    const buildCurrentAIExecutionConfig = typeof api.buildCurrentAIExecutionConfig === 'function'
      ? api.buildCurrentAIExecutionConfig
      : () => null;
    const resolveShouldTreatAsMorphDataOperation =
      typeof api.shouldTreatAsMorphDataOperation === 'function'
        ? api.shouldTreatAsMorphDataOperation
        : () => false;
    const resolveMorphSkillDescriptorForActionType =
      typeof api.resolveMorphSkillDescriptorForActionType === 'function'
        ? api.resolveMorphSkillDescriptorForActionType
        : (actionType = '') => {
          const runtime = typeof window !== 'undefined'
            && window.MorphAIActionSkillRuntime
            && typeof window.MorphAIActionSkillRuntime.create === 'function'
            ? window.MorphAIActionSkillRuntime.create()
            : null;
          return runtime && typeof runtime.getMorphSkillDescriptorForActionType === 'function'
            ? runtime.getMorphSkillDescriptorForActionType(actionType)
            : null;
        };
    const resolveMorphSkillDescriptorsForActionTypes =
      typeof api.resolveMorphSkillDescriptorsForActionTypes === 'function'
        ? api.resolveMorphSkillDescriptorsForActionTypes
        : (actionTypes = []) => {
          const runtime = typeof window !== 'undefined'
            && window.MorphAIActionSkillRuntime
            && typeof window.MorphAIActionSkillRuntime.create === 'function'
            ? window.MorphAIActionSkillRuntime.create()
            : null;
          return runtime && typeof runtime.getMorphSkillDescriptorsForActionTypes === 'function'
            ? runtime.getMorphSkillDescriptorsForActionTypes(actionTypes)
            : [];
        };

    const resolve = (name, fallback = null) => {
      if (typeof api[name] === 'function') return api[name];
      if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name];
      return fallback;
    };

    const pushAILogReminderUndoSnapshot = resolve('pushAILogReminderUndoSnapshot', () => {});

    function buildActionSkillMeta(actionType = '') {
      const descriptor = resolveMorphSkillDescriptorForActionType(actionType);
      return descriptor && typeof descriptor === 'object'
        ? {
          skillId: String(descriptor.skillId || '').trim(),
          skillLabel: String(descriptor.skillLabel || '').trim(),
        }
        : {};
    }

    function buildMorphActionTransactionViewState() {
      const runtime = getViewStateRuntimeModules();
      if (runtime && typeof runtime.buildMorphActionTransactionViewState === 'function') {
        return runtime.buildMorphActionTransactionViewState();
      }
      return {
        currentTab: String(getCurrentTab() || '').trim(),
        activeContextId: String(typeof activeContextId !== 'undefined' ? activeContextId : '').trim(),
        selectedDailyMonth: String(getSelectedDailyMonth() || '').trim(),
        aiChatSessionId: String(getAIChatState()?.sessionId || '').trim(),
        activeThoughtsViewPane: String(getActiveThoughtsViewPane() || '').trim(),
        activeProjectCollectionPane: String(getActiveProjectCollectionPane() || '').trim(),
        activeProjectSpaceId: String(getActiveProjectSpaceId() || '').trim(),
        activeProjectViewPane: String(getActiveProjectViewPane() || '').trim(),
        activeLocalPluginWorkspaceId: String(getActiveLocalPluginWorkspaceId() || '').trim(),
      };
    }

    function applyMorphActionTransactionViewState(view = null) {
      const runtime = getViewStateRuntimeModules();
      if (runtime && typeof runtime.applyMorphActionTransactionViewState === 'function') {
        return runtime.applyMorphActionTransactionViewState(view);
      }
      const next = view && typeof view === 'object' ? view : {};
      if (Object.prototype.hasOwnProperty.call(next, 'currentTab')) {
        let value = String(next.currentTab || '').trim();
        try {
          const rawHash = typeof window !== 'undefined' && window.location
            ? String(window.location.hash || '').replace(/^#/, '').trim()
            : '';
          const route = rawHash ? rawHash.split('?')[0].trim() : '';
          if (route === 'completedFlashThoughts') {
            value = 'archive';
          } else if (route === 'home' || route === 'list' || route === 'fleeting' || route === 'fixed') {
            value = 'flashThoughts';
          } else if (route && route !== 'ai' && ['flashThoughts', 'project', 'daily', 'health', 'finance', 'extensions', 'localPluginWorkspace', 'archive', 'settings', 'channelOps'].includes(route)) {
            value = route;
          }
        } catch (_) {}
        if (value) {
          const currentValue = String(getCurrentTab() || '').trim() || 'flashThoughts';
          const section = typeof document !== 'undefined' ? document.getElementById(`view-${value}`) : null;
          const isActive = !!(section && section.classList.contains('active'));
          if (typeof switchTab === 'function' && (value !== currentValue || !isActive)) {
            switchTab(value, false);
          } else {
            setCurrentTab(value);
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeContextId')) {
        const value = String(next.activeContextId || '').trim();
        setActiveContextId(value || null);
      }
      if (Object.prototype.hasOwnProperty.call(next, 'selectedDailyMonth')) {
        setSelectedDailyMonth(String(next.selectedDailyMonth || '').trim());
      }
      if (Object.prototype.hasOwnProperty.call(next, 'aiChatSessionId') || Object.prototype.hasOwnProperty.call(next, 'sessionId')) {
        setAIChatSessionId(String(next.aiChatSessionId || next.sessionId || '').trim());
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeThoughtsViewPane')) {
        setActiveThoughtsViewPane(String(next.activeThoughtsViewPane || '').trim());
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeProjectCollectionPane')) {
        setActiveProjectCollectionPane(String(next.activeProjectCollectionPane || '').trim());
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeProjectSpaceId')) {
        setActiveProjectSpaceId(String(next.activeProjectSpaceId || '').trim());
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeProjectViewPane')) {
        setActiveProjectViewPane(String(next.activeProjectViewPane || '').trim());
      }
      if (Object.prototype.hasOwnProperty.call(next, 'activeLocalPluginWorkspaceId')) {
        setActiveLocalPluginWorkspaceId(String(next.activeLocalPluginWorkspaceId || '').trim());
      }
    }

    function shouldRecordMorphActionTransactionAction(actionType = '') {
      const type = String(actionType || '').trim();
      return !!type && !['undo_last_ai_transaction', 'undo_log_or_reminder_change', 'trigger_proactive_scan'].includes(type);
    }

    function shouldActionMutationRecordTransaction({
      actionType = '',
      actionRuntimeMeta = null,
      actionProducedMutation = false,
    } = {}) {
      if (actionProducedMutation !== true) return false;
      const runtimeMeta = actionRuntimeMeta && typeof actionRuntimeMeta === 'object' ? actionRuntimeMeta : null;
      if (runtimeMeta && Object.prototype.hasOwnProperty.call(runtimeMeta, 'transactionEligible')) {
        return runtimeMeta.transactionEligible === true;
      }
      return shouldRecordMorphActionTransactionAction(actionType);
    }

    function buildMorphActionReceiptFromVerification(type = '', action = {}, verification = {}, runtime = {}) {
      const sanitizeMorphActionReceipt = resolve('sanitizeMorphActionReceipt', (value = null) => (value && typeof value === 'object' ? { ...value } : {}));
      const result = runtime.actionResult && typeof runtime.actionResult === 'object' ? runtime.actionResult : {};
      return sanitizeMorphActionReceipt({
        ok: verification?.ok !== false,
        action: type,
        ...buildActionSkillMeta(type),
        summary: String(runtime.summary || '').trim() || String(type || '').trim(),
        verifierStatus: verification?.ok === false ? 'failed' : 'verified',
        entity: String(verification?.entity || (/daily_log/.test(type) ? 'daily_log_entry' : '')).trim(),
        entityId: String(verification?.entityId || '').trim() || String(result.blockIds?.[0] || result.dateStr || '').trim(),
        status: String(verification?.status || result.status || '').trim(),
        oldStatus: String(verification?.oldStatus || result.oldStatus || '').trim(),
        newStatus: String(verification?.newStatus || result.newStatus || '').trim(),
        targetDate: String(verification?.targetDate || result.dateStr || action.date || action.dateStr || '').trim(),
        updatedAt: String(verification?.updatedAt || result.updatedAt || new Date().toISOString()).trim(),
        undoAvailable: false,
        transactionHandle: '',
        blockIds: Array.isArray(verification?.blockIds) ? verification.blockIds : (Array.isArray(result.blockIds) ? result.blockIds : []),
      });
    }

    function recordMorphActionTransaction({
      source = 'ai',
      promptQuestion = '',
      actions = [],
      actionTypes = [],
      domains = [],
      beforeDomains = {},
      beforeView = null,
      appliedLabels = [],
      createdItems = [],
      trace = [],
      patches = [],
      receipt = null,
      resolveActionExecutionPolicy = null,
    } = {}) {
      const dataRef = getData();
      const clone = typeof cloneJSONSafe === 'function' ? cloneJSONSafe : (value) => value;
      const sanitizeMorphActionTransaction = resolve('sanitizeMorphActionTransaction', (value = null) => (value && typeof value === 'object' ? { ...value } : null));
      const sanitizeMorphActionTransactions = resolve('sanitizeMorphActionTransactions', (list = []) => (Array.isArray(list) ? list : []).filter(Boolean));
      const ensureMorphRuntimeShape = resolve('ensureMorphRuntimeShape', (value) => value);
      const captureMorphActionTransactionDomain = resolve('captureMorphActionTransactionDomain', (domain, target = null) => (target && typeof target === 'object' ? clone(target?.[domain]) : null));
      const shouldExternalizeMorphActionTransactionDomain = resolve('shouldExternalizeMorphActionTransactionDomain', () => false);
      const getMorphActionTransactionInlineSnapshotMaxBytes = resolve('getMorphActionTransactionInlineSnapshotMaxBytes', () => 48 * 1024);
      const estimateJSONStringBytes = resolve('estimateJSONStringBytes', (value = null) => {
        try {
          return Math.max(0, JSON.stringify(value)?.length || 0) * 2;
        } catch (_) {
          return 0;
        }
      });
      const getMorphActionTransactionFingerprint = resolve('getMorphActionTransactionFingerprint', () => '');
      const writeMorphExternalTransactionSnapshot = resolve('writeMorphExternalTransactionSnapshot', () => {});
      const pruneMorphExternalTransactionSnapshotStore = resolve('pruneMorphExternalTransactionSnapshotStore', () => {});
      const getMorphSyncEntityRefsFromReceipts = resolve('buildMorphSyncEntityRefsFromReceipts', () => []);
      const buildMorphSyncEntityRefsFromCreatedItems = resolve('buildMorphSyncEntityRefsFromCreatedItems', () => []);
      const mergeMorphSyncEntityRefs = resolve('mergeMorphSyncEntityRefs', (...groups) => groups.flatMap((group) => (Array.isArray(group) ? group : [])));
      const cleanDomains = Array.from(new Set((Array.isArray(domains) ? domains : []).map((item) => String(item || '').trim()).filter(Boolean)));
      if (!cleanDomains.length) return null;
      const skillDescriptors = Array.isArray(resolveMorphSkillDescriptorsForActionTypes(actionTypes))
        ? resolveMorphSkillDescriptorsForActionTypes(actionTypes)
        : [];
      const policies = typeof resolveActionExecutionPolicy === 'function'
        ? (Array.isArray(actionTypes) ? actionTypes : []).map((type) => resolveActionExecutionPolicy(type))
        : [];
      const riskLevel = policies.some((policy) => String(policy?.riskLevel || '') === 'high')
        ? 'high'
        : policies.some((policy) => String(policy?.riskLevel || '') === 'medium')
          ? 'medium'
          : 'low';
      const externalSnapshots = {};
      const inlineSnapshotMaxBytes = Math.max(8 * 1024, Number(getMorphActionTransactionInlineSnapshotMaxBytes()) || 48 * 1024);
      const beforeSnapshot = {
        domains: Object.fromEntries(cleanDomains.map((domain) => {
          const snapshot = clone(beforeDomains?.[domain] ?? captureMorphActionTransactionDomain(domain, dataRef));
          const snapshotBytes = estimateJSONStringBytes(snapshot);
          if (shouldExternalizeMorphActionTransactionDomain(domain) || snapshotBytes > inlineSnapshotMaxBytes) {
            externalSnapshots[domain] = snapshot;
            return [domain, { __externalSnapshot: true, domain }];
          }
          return [domain, snapshot];
        })),
        view: beforeView && typeof beforeView === 'object' ? clone(beforeView) : buildMorphActionTransactionViewState(),
      };
      const afterFingerprints = Object.fromEntries(cleanDomains.map((domain) => [domain, getMorphActionTransactionFingerprint(domain, dataRef)]));
      const transaction = sanitizeMorphActionTransaction({
        id: typeof genId === 'function' ? genId() : `tx_${Date.now().toString(36)}`,
        source,
        status: 'committed',
        createdAt: new Date().toISOString(),
        promptQuestion,
        riskLevel,
        domains: cleanDomains,
        skillIds: skillDescriptors.map((item) => String(item?.skillId || '').trim()).filter(Boolean),
        skillLabels: skillDescriptors.map((item) => String(item?.skillLabel || '').trim()).filter(Boolean),
        actionTypes,
        actions: clone(Array.isArray(actions) ? actions : []),
        appliedLabels,
        createdItems,
        trace: clone(Array.isArray(trace) ? trace : []),
        patches: clone(Array.isArray(patches) ? patches : []),
        receipt: receipt && typeof receipt === 'object'
          ? {
            ...receipt,
            summary: String(receipt.summary || receipt.receiptSummary || '').trim(),
            verifierStatus: String(receipt.verifierStatus || '').trim() || 'verified',
          }
          : {
            summary: String((Array.isArray(appliedLabels) && appliedLabels[0]) || (Array.isArray(actionTypes) && actionTypes[0]) || '').trim(),
            verifierStatus: 'verified',
            undoAvailable: true,
          },
        beforeSnapshot,
        afterFingerprints,
      });
      if (!transaction) return null;
      const runtime = ensureMorphRuntimeShape(dataRef).morphRuntime;
      runtime.actionTransactions = sanitizeMorphActionTransactions(
        (Array.isArray(runtime.actionTransactions) ? runtime.actionTransactions : []).concat(transaction)
      );
      Object.entries(externalSnapshots).forEach(([domain, snapshot]) => {
        writeMorphExternalTransactionSnapshot(transaction.id, domain, snapshot);
      });
      pruneMorphExternalTransactionSnapshotStore((runtime.actionTransactions || []).map((entry) => entry?.id));
      return transaction;
    }

    function getLastMorphActionTransaction({ domainFilter = null, sourceFilter = null, actionTypeFilter = null, transactionIdFilter = '' } = {}) {
      const dataRef = getData();
      const ensureMorphRuntimeShape = resolve('ensureMorphRuntimeShape', (value) => value);
      const sanitizeMorphActionTransactions = resolve('sanitizeMorphActionTransactions', (list = []) => (Array.isArray(list) ? list : []).filter(Boolean));
      const getMorphActionTransactionFingerprint = resolve('getMorphActionTransactionFingerprint', () => '');
      const runtime = ensureMorphRuntimeShape(dataRef).morphRuntime;
      const entries = sanitizeMorphActionTransactions(runtime.actionTransactions);
      const filters = Array.isArray(domainFilter)
        ? new Set(domainFilter.map((item) => String(item || '').trim()).filter(Boolean))
        : null;
      const sourceFilters = Array.isArray(sourceFilter)
        ? new Set(sourceFilter.map((item) => String(item || '').trim()).filter(Boolean))
        : null;
      const actionTypeFilters = Array.isArray(actionTypeFilter)
        ? new Set(actionTypeFilter.map((item) => String(item || '').trim()).filter(Boolean))
        : null;
      const targetTransactionId = String(transactionIdFilter || '').trim();
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (!entry || entry.status !== 'committed') continue;
        if (targetTransactionId && String(entry.id || '').trim() !== targetTransactionId) continue;
        if (filters && !entry.domains.some((domain) => filters.has(domain))) continue;
        if (sourceFilters && !sourceFilters.has(String(entry.source || '').trim())) continue;
        if (actionTypeFilters && !entry.actionTypes.some((type) => actionTypeFilters.has(String(type || '').trim()))) continue;
        const reminderOnlyTransaction = entry.actionTypes.every((type) => ['add_reminder', 'update_reminder', 'delete_reminder'].includes(String(type || '').trim()));
        const driftedDomains = entry.domains.filter((domain) => {
          const normalizedDomain = String(domain || '').trim();
          if (reminderOnlyTransaction && normalizedDomain === 'daily') {
            return false;
          }
          return entry.afterFingerprints?.[normalizedDomain] !== getMorphActionTransactionFingerprint(normalizedDomain, dataRef);
        });
        if (driftedDomains.length) {
          return {
            entry,
            reason: '这次变更之后，这部分内容又被改过了。直接回滚会覆盖后续修改，所以我先没有自动撤销。',
            driftedDomains,
          };
        }
        return { entry, reason: '', driftedDomains: [] };
      }
      return { entry: null, reason: '当前没有可撤销的操作。', driftedDomains: [] };
    }

    async function undoLastMorphActionTransaction(options = {}) {
      const sanitizeMorphActionTransactionSnapshot = resolve('sanitizeMorphActionTransactionSnapshot', (value = null) => (value && typeof value === 'object' ? { ...value } : { domains: {}, view: {} }));
      const readMorphExternalTransactionSnapshot = resolve('readMorphExternalTransactionSnapshot', () => null);
      const applyMorphActionTransactionDomain = resolve('applyMorphActionTransactionDomain', () => false);
      const syncExpenseLedgerExtensionFiles = resolve('syncExpenseLedgerExtensionFiles', () => {});
      const ensureNativeSchedulesForPendingReminders = resolve('ensureNativeSchedulesForPendingReminders', () => {});
      const reminderSchedulerTick = resolve('reminderSchedulerTick', () => {});
      const scheduleReminderLanSync = resolve('scheduleReminderLanSync', () => {});
      const syncReminderBlocksIntoDailyMonth = resolve('syncReminderBlocksIntoDailyMonth', () => {});
      const buildPostPersistTask = (label = '', effect = null) => {
        if (typeof effect !== 'function') return null;
        return () => {
          try {
            effect();
          } catch (error) {
            if (typeof console !== 'undefined' && typeof console.warn === 'function') {
              console.warn(`[Morpheus][undo-post-persist] ${String(label || 'post-persist').trim() || 'post-persist'} failed, preserving canonical undo.`, error);
            }
          }
        };
      };
      const result = getLastMorphActionTransaction(options);
      if (!result.entry || result.reason) {
        return {
          ok: false,
          reason: result.reason || '当前没有可撤销的操作。',
          driftedDomains: result.driftedDomains || [],
        };
      }
      const snapshot = sanitizeMorphActionTransactionSnapshot(result.entry.beforeSnapshot);
      const touchedDomains = Object.keys(snapshot.domains || {});
      if (!touchedDomains.length) return { ok: false, reason: '这次 AI 操作没有可恢复的快照。' };
      for (const domain of touchedDomains) {
        const payload = snapshot.domains[domain];
        const resolvedPayload = payload && payload.__externalSnapshot === true
          ? readMorphExternalTransactionSnapshot(result.entry.id, domain)
          : payload;
        if (!resolvedPayload) {
          return { ok: false, reason: `这次变更缺少 ${domain} 的恢复快照，暂时无法自动撤销。` };
        }
        const restored = await applyMorphActionTransactionDomain(domain, resolvedPayload);
        if (!restored) {
          return { ok: false, reason: `这次变更里的 ${domain} 暂时无法自动恢复。` };
        }
      }
      const postPersistTasks = [];
      if (touchedDomains.includes('expenseLedger')) {
        const syncExpenseTask = buildPostPersistTask('syncExpenseLedgerExtensionFiles', () => syncExpenseLedgerExtensionFiles());
        if (syncExpenseTask) postPersistTasks.push(syncExpenseTask);
      }
      if (touchedDomains.includes('reminders')) {
        const reminderTask = buildPostPersistTask('reminder-runtime-refresh', () => {
          ensureNativeSchedulesForPendingReminders();
          setTimeout(reminderSchedulerTick, 120);
          scheduleReminderLanSync('undo_last_action_transaction');
        });
        if (reminderTask) postPersistTasks.push(reminderTask);
        Object.keys(getData().dailyMonths || {}).forEach((monthKey) => syncReminderBlocksIntoDailyMonth(monthKey));
      }
      applyMorphActionTransactionViewState(snapshot.view);
      const ensureMorphRuntimeShape = resolve('ensureMorphRuntimeShape', (value) => value);
      const sanitizeMorphActionTransactions = resolve('sanitizeMorphActionTransactions', (list = []) => (Array.isArray(list) ? list : []).filter(Boolean));
      const runtime = ensureMorphRuntimeShape(getData()).morphRuntime;
      runtime.actionTransactions = sanitizeMorphActionTransactions(
        (Array.isArray(runtime.actionTransactions) ? runtime.actionTransactions : []).map((entry) => {
          if (String(entry?.id || '') !== result.entry.id) return entry;
          return {
            ...entry,
            status: 'undone',
            undoneAt: new Date().toISOString(),
          };
        })
      );
      return {
        ok: true,
        entry: result.entry,
        summary: result.entry.appliedLabels?.[0] || result.entry.actionTypes?.[0] || '最近一次 AI 操作',
        actionRuntimeMeta: {
          restoredDomains: touchedDomains.slice(),
          ...(postPersistTasks.length ? { postPersistTasks } : {}),
        },
      };
    }

    function performMorphTransactionalMutation({
      source = 'manual',
      actionType = '',
      promptQuestion = '',
      domains = [],
      detail = {},
      mutation = null,
      saveMode = 'data',
      saveOptions = {},
    } = {}) {
      if (typeof mutation !== 'function') return false;
      const cleanDomains = Array.from(new Set((Array.isArray(domains) ? domains : []).map((item) => String(item || '').trim()).filter(Boolean)));
      const enforcedCanonicalDomains = new Set(['daily', 'thoughts', 'projects', 'rhythm', 'expenseLedger', 'reminders', 'aiMemory', 'aiMemoryFull']);
      const requiresCanonicalCommit = cleanDomains.some((domain) => enforcedCanonicalDomains.has(domain));
      const canonicalWriterRuntime = (
        typeof window !== 'undefined'
        && window.MorphCanonicalWriterRuntime
        && typeof window.MorphCanonicalWriterRuntime.create === 'function'
      )
        ? window.MorphCanonicalWriterRuntime.create()
        : null;
      const legacyCoreCommitRuntime = (!canonicalWriterRuntime && typeof window !== 'undefined'
        && window.MorphCoreCommitRuntime
        && typeof window.MorphCoreCommitRuntime.create === 'function')
        ? window.MorphCoreCommitRuntime.create()
        : null;
      const commitPatchIntent = canonicalWriterRuntime && typeof canonicalWriterRuntime.commitPatchIntent === 'function'
        ? canonicalWriterRuntime.commitPatchIntent.bind(canonicalWriterRuntime)
        : (legacyCoreCommitRuntime && typeof legacyCoreCommitRuntime.commitMorphCoreMutation === 'function'
          ? legacyCoreCommitRuntime.commitMorphCoreMutation.bind(legacyCoreCommitRuntime)
          : null);
      const canUseCoreCommit = typeof commitPatchIntent === 'function';
      if (requiresCanonicalCommit && !canUseCoreCommit) return false;
      const captureMorphActionTransactionDomain = resolve('captureMorphActionTransactionDomain', (domain, target = null) => (target && typeof target === 'object' ? cloneJSONSafe(target?.[domain]) : null));
      const beforeDomains = Object.fromEntries(cleanDomains.map((domain) => [domain, captureMorphActionTransactionDomain(domain, getData())]));
      const beforeView = buildMorphActionTransactionViewState();
      const result = mutation();
      if (result === false || result === null) return false;
      const outcome = result && typeof result === 'object' ? result : {};
      if (outcome.changed === false) return false;
      const appliedLabels = Array.isArray(outcome.appliedLabels)
        ? outcome.appliedLabels.map((item) => String(item || '').trim()).filter(Boolean)
        : (outcome.appliedLabel ? [String(outcome.appliedLabel || '').trim()].filter(Boolean) : []);
      const createdItems = Array.isArray(outcome.createdItems) ? cloneJSONSafe(outcome.createdItems) : [];
      const patches = Array.isArray(outcome.patches) ? cloneJSONSafe(outcome.patches) : [];
      const explicitEntityRefs = Array.isArray(outcome.entityRefs) ? cloneJSONSafe(outcome.entityRefs) : [];
      const mergeMorphSyncEntityRefs = resolve('mergeMorphSyncEntityRefs', (...groups) => groups.flatMap((group) => (Array.isArray(group) ? group : [])));
      const buildMorphSyncEntityRefsFromCreatedItems = resolve('buildMorphSyncEntityRefsFromCreatedItems', () => []);
      const entityRefs = mergeMorphSyncEntityRefs(
        explicitEntityRefs,
        buildMorphSyncEntityRefsFromCreatedItems(createdItems, actionType, detail)
      );
      if (canUseCoreCommit) {
        commitPatchIntent({
          changed: true,
          source,
          promptQuestion: String(promptQuestion || actionType || source).trim(),
          actions: [{ type: actionType || 'manual_mutation', ...cloneJSONSafe(detail) }],
          actionTypes: [actionType || 'manual_mutation'],
          domains: cleanDomains,
          beforeDomains,
          beforeView,
          appliedLabels,
          createdItems,
          detail,
          patches,
          entityRefs,
          saveMode,
          immediatePersist: (saveOptions && typeof saveOptions === 'object' && Object.prototype.hasOwnProperty.call(saveOptions, 'immediatePersist'))
            ? saveOptions.immediatePersist
            : cleanDomains.includes('reminders'),
          skipRender: saveOptions?.skipRender === true,
          skipUndo: saveOptions?.skipUndo === true,
          recordMorphActionTransaction,
          mergeSyncEntityRefs: mergeMorphSyncEntityRefs,
          buildSyncEntityRefsFromCreatedItems: buildMorphSyncEntityRefsFromCreatedItems,
          protectRecentCommittedData: resolve('protectRecentCommittedData', null),
          setLastUserEditAt: resolve('setLastUserEditAt', null),
          bumpUISessionLock: resolve('bumpUISessionLock', null),
          saveData: resolve('saveData', () => {}),
          saveSilent: resolve('saveSilent', () => {}),
          currentTab: String(resolve('getCurrentTab', () => '')() || '').trim(),
        });
        return outcome || true;
      }
      if (requiresCanonicalCommit) return false;
      if (cleanDomains.length) {
        recordMorphActionTransaction({
          source,
          promptQuestion: String(promptQuestion || actionType || source).trim(),
          actions: [{ type: actionType || 'manual_mutation', ...cloneJSONSafe(detail) }],
          actionTypes: [actionType || 'manual_mutation'],
          domains: cleanDomains,
          beforeDomains,
          beforeView,
          appliedLabels,
          createdItems,
          patches,
        });
      }
      const nextSaveOptions = {
        ...(saveOptions || {}),
        domains: cleanDomains,
        entityRefs,
        immediatePersist: (saveOptions && typeof saveOptions === 'object' && Object.prototype.hasOwnProperty.call(saveOptions, 'immediatePersist'))
          ? saveOptions.immediatePersist
          : cleanDomains.includes('reminders'),
      };
      const saveSilent = resolve('saveSilent', () => {});
      const saveData = resolve('saveData', () => {});
      if (saveMode === 'silent') saveSilent(nextSaveOptions);
      else if (saveMode === 'none') {
        // no-op
      } else {
        saveData(nextSaveOptions);
      }
      return outcome || true;
    }

    async function performMorphTransactionalMutationAsync({
      source = 'manual',
      actionType = '',
      promptQuestion = '',
      domains = [],
      detail = {},
      mutation = null,
      saveMode = 'data',
      saveOptions = {},
    } = {}) {
      if (typeof mutation !== 'function') return false;
      const cleanDomains = Array.from(new Set((Array.isArray(domains) ? domains : []).map((item) => String(item || '').trim()).filter(Boolean)));
      const enforcedCanonicalDomains = new Set(['daily', 'thoughts', 'projects', 'rhythm', 'expenseLedger', 'reminders', 'aiMemory', 'aiMemoryFull']);
      const requiresCanonicalCommit = cleanDomains.some((domain) => enforcedCanonicalDomains.has(domain));
      const canonicalWriterRuntime = (
        typeof window !== 'undefined'
        && window.MorphCanonicalWriterRuntime
        && typeof window.MorphCanonicalWriterRuntime.create === 'function'
      )
        ? window.MorphCanonicalWriterRuntime.create()
        : null;
      const legacyCoreCommitRuntime = (!canonicalWriterRuntime && typeof window !== 'undefined'
        && window.MorphCoreCommitRuntime
        && typeof window.MorphCoreCommitRuntime.create === 'function')
        ? window.MorphCoreCommitRuntime.create()
        : null;
      const commitPatchIntent = canonicalWriterRuntime && typeof canonicalWriterRuntime.commitPatchIntent === 'function'
        ? canonicalWriterRuntime.commitPatchIntent.bind(canonicalWriterRuntime)
        : (legacyCoreCommitRuntime && typeof legacyCoreCommitRuntime.commitMorphCoreMutation === 'function'
          ? legacyCoreCommitRuntime.commitMorphCoreMutation.bind(legacyCoreCommitRuntime)
          : null);
      const canUseCoreCommit = typeof commitPatchIntent === 'function';
      if (requiresCanonicalCommit && !canUseCoreCommit) return false;
      const captureMorphActionTransactionDomain = resolve('captureMorphActionTransactionDomain', (domain, target = null) => (target && typeof target === 'object' ? cloneJSONSafe(target?.[domain]) : null));
      const beforeDomains = Object.fromEntries(cleanDomains.map((domain) => [domain, captureMorphActionTransactionDomain(domain, getData())]));
      const beforeView = buildMorphActionTransactionViewState();
      const result = await mutation();
      if (result === false || result === null) return false;
      const outcome = result && typeof result === 'object' ? result : {};
      if (outcome.changed === false) return false;
      const appliedLabels = Array.isArray(outcome.appliedLabels)
        ? outcome.appliedLabels.map((item) => String(item || '').trim()).filter(Boolean)
        : (outcome.appliedLabel ? [String(outcome.appliedLabel || '').trim()].filter(Boolean) : []);
      const createdItems = Array.isArray(outcome.createdItems) ? cloneJSONSafe(outcome.createdItems) : [];
      const patches = Array.isArray(outcome.patches) ? cloneJSONSafe(outcome.patches) : [];
      const explicitEntityRefs = Array.isArray(outcome.entityRefs) ? cloneJSONSafe(outcome.entityRefs) : [];
      const mergeMorphSyncEntityRefs = resolve('mergeMorphSyncEntityRefs', (...groups) => groups.flatMap((group) => (Array.isArray(group) ? group : [])));
      const buildMorphSyncEntityRefsFromCreatedItems = resolve('buildMorphSyncEntityRefsFromCreatedItems', () => []);
      const entityRefs = mergeMorphSyncEntityRefs(
        explicitEntityRefs,
        buildMorphSyncEntityRefsFromCreatedItems(createdItems, actionType, detail)
      );
      if (canUseCoreCommit) {
        commitPatchIntent({
          changed: true,
          source,
          promptQuestion: String(promptQuestion || actionType || source).trim(),
          actions: [{ type: actionType || 'manual_mutation', ...cloneJSONSafe(detail) }],
          actionTypes: [actionType || 'manual_mutation'],
          domains: cleanDomains,
          beforeDomains,
          beforeView,
          appliedLabels,
          createdItems,
          detail,
          patches,
          entityRefs,
          saveMode,
          immediatePersist: (saveOptions && typeof saveOptions === 'object' && Object.prototype.hasOwnProperty.call(saveOptions, 'immediatePersist'))
            ? saveOptions.immediatePersist
            : cleanDomains.includes('reminders'),
          skipRender: saveOptions?.skipRender === true,
          skipUndo: saveOptions?.skipUndo === true,
          recordMorphActionTransaction,
          mergeSyncEntityRefs: mergeMorphSyncEntityRefs,
          buildSyncEntityRefsFromCreatedItems: buildMorphSyncEntityRefsFromCreatedItems,
          protectRecentCommittedData: resolve('protectRecentCommittedData', null),
          setLastUserEditAt: resolve('setLastUserEditAt', null),
          bumpUISessionLock: resolve('bumpUISessionLock', null),
          saveData: resolve('saveData', () => {}),
          saveSilent: resolve('saveSilent', () => {}),
          currentTab: String(resolve('getCurrentTab', () => '')() || '').trim(),
        });
        return outcome || true;
      }
      if (requiresCanonicalCommit) return false;
      if (cleanDomains.length) {
        recordMorphActionTransaction({
          source,
          promptQuestion: String(promptQuestion || actionType || source).trim(),
          actions: [{ type: actionType || 'manual_mutation', ...cloneJSONSafe(detail) }],
          actionTypes: [actionType || 'manual_mutation'],
          domains: cleanDomains,
          beforeDomains,
          beforeView,
          appliedLabels,
          createdItems,
          patches,
        });
      }
      const nextSaveOptions = {
        ...(saveOptions || {}),
        domains: cleanDomains,
        entityRefs,
        immediatePersist: (saveOptions && typeof saveOptions === 'object' && Object.prototype.hasOwnProperty.call(saveOptions, 'immediatePersist'))
          ? saveOptions.immediatePersist
          : cleanDomains.includes('reminders'),
      };
      const saveSilent = resolve('saveSilent', () => {});
      const saveData = resolve('saveData', () => {});
      if (saveMode === 'silent') saveSilent(nextSaveOptions);
      else if (saveMode === 'none') {
        // no-op
      } else {
        saveData(nextSaveOptions);
      }
      return outcome || true;
    }

async function applyAIActions(actions, context = {}) {
      const data = getData();
      const currentTab = String(getCurrentTab() || '').trim();
      const saveData = resolve('saveData', () => {});
      const saveSilent = resolve('saveSilent', () => {});
      const protectRecentCommittedData = resolve('protectRecentCommittedData', () => {});
      const bumpUISessionLock = resolve('bumpUISessionLock', () => {});
      const runtimeModulesRef = typeof runtimeModules !== 'undefined' && runtimeModules && typeof runtimeModules === 'object'
        ? runtimeModules
        : null;
      const genId = resolve('genId', () => `morph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
      const filterPlanningActions = resolve('filterDisallowedPlanningActions', (incomingActions = []) => ({
        actions: Array.isArray(incomingActions) ? incomingActions : [],
        blockedActionTypes: [],
      }));
      const detectWriteTimeBlocksIntent = resolve('didUserExplicitlyAskWriteTimeBlocksToDaily', () => false);
      const getMorphRuntimeBundleSafe = resolve('getMorphRuntimeBundle', () => ({ skills: { disabledActions: [] } }));
      const isActionExecutionFollowup = resolve('isMorphActionExecutionFollowup', () => false);
      const extractExpenseRecordFromQuestionSafe = resolve('extractExpenseRecordFromQuestion', () => null);
      const inferImplicitMemoryWriteActionSafe = resolve('inferImplicitMemoryWriteActionFromConversation', () => null);
      const ensureAIMemoryShapeSafe = resolve('ensureAIMemoryShape', (target = data) => {
        const safeTarget = target && typeof target === 'object' ? target : {};
        if (!safeTarget.aiMemory || typeof safeTarget.aiMemory !== 'object') safeTarget.aiMemory = {};
        if (!safeTarget.aiMemory.workingMemory || typeof safeTarget.aiMemory.workingMemory !== 'object') safeTarget.aiMemory.workingMemory = {};
        if (!safeTarget.aiMemory.currentTaskState || typeof safeTarget.aiMemory.currentTaskState !== 'object') safeTarget.aiMemory.currentTaskState = {};
        return safeTarget;
      });
      const getPermissionContextRuntimeModulesSafe = typeof getPermissionContextRuntimeModules === 'function'
        ? getPermissionContextRuntimeModules
        : () => runtimeModulesRef;
      const getMorphActionExecutionPolicySafe = typeof getMorphActionExecutionPolicy === 'function'
        ? getMorphActionExecutionPolicy
        : null;
      const buildMorphActionCandidateSafe = typeof buildMorphActionCandidate === 'function'
        ? buildMorphActionCandidate
        : null;
      const buildMorphActionBoundaryResultSafe = typeof buildMorphActionBoundaryResult === 'function'
        ? buildMorphActionBoundaryResult
        : null;
      const hydrateStructuredActionSlots = resolve('hydrateMorphStructuredActionSlots', (actionType = '', action = {}) => ({
        action: action && typeof action === 'object'
          ? { ...action, type: String(action.type || actionType || '').trim() }
          : { type: String(actionType || '').trim() },
        hydratedFields: [],
      }));
    if (!Array.isArray(actions) || actions.length === 0) return { appliedLabels: [], createdItems: [], blockedLabels: [], blockedReason: '' };
    const appliedLabels = [];
    const createdItems = [];
    const blockedLabels = [];
    const actionExecutionTrace = [];
    const committedReceipts = [];
    const committedActions = [];
    const committedActionTypes = [];
    const committedDomains = new Set();
    const transactionBeforeDomains = {};
    const transactionBeforeView = buildMorphActionTransactionViewState();
    let blockedReason = '';
    let failureKind = '';
    let failureStage = '';
    let failureCode = '';
    let failureMessage = '';
    let changed = false;
    let performedTransactionUndo = false;
    const pendingPostPersistTasks = [];
    const setFailureSemantic = ({
        kind = '',
        stage = '',
        code = '',
        message = '',
        overwrite = false,
    } = {}) => {
        const nextKind = String(kind || '').trim();
        const nextStage = String(stage || '').trim();
        const nextCode = String(code || '').trim();
        const nextMessage = String(message || '').trim();
        if (!overwrite && (failureKind || failureStage || failureCode || failureMessage)) return;
        failureKind = nextKind;
        failureStage = nextStage;
        failureCode = nextCode;
        failureMessage = nextMessage;
    };
    const buildFailureSemanticPayload = () => ({
        failureKind,
        failureStage,
        failureCode,
        failureMessage,
        needsConfirmation: failureKind === 'needs_confirmation',
    });
    const applyContextRuntime = typeof getAIActionApplyContextRuntimeModules === 'function' ? getAIActionApplyContextRuntimeModules() : null;
    const applyContextState = applyContextRuntime && typeof applyContextRuntime.prepareApplyActionsContext === 'function'
        ? applyContextRuntime.prepareApplyActionsContext({ actions, context, dataRef: data, runtimeModulesRef, filterDisallowedPlanningActions: filterPlanningActions, didUserExplicitlyAskWriteTimeBlocksToDaily: detectWriteTimeBlocksIntent, getMorphRuntimeBundle: getMorphRuntimeBundleSafe, isMorphActionExecutionFollowup: isActionExecutionFollowup, extractExpenseRecordFromQuestion: extractExpenseRecordFromQuestionSafe, inferImplicitMemoryWriteActionFromConversation: inferImplicitMemoryWriteActionSafe, shouldTreatAsMorphDataOperation: resolveShouldTreatAsMorphDataOperation, ensureAIMemoryShape: ensureAIMemoryShapeSafe, getPermissionContextRuntimeModules: getPermissionContextRuntimeModulesSafe, getMorphActionExecutionPolicy: getMorphActionExecutionPolicySafe, buildMorphActionCandidate: buildMorphActionCandidateSafe, buildMorphActionBoundaryResult: buildMorphActionBoundaryResultSafe, })
        : null;
    const fallbackPromptQuestion = String(context.promptQuestion || '').trim();
    const fallbackPlanningActionFilter = filterPlanningActions(actions, fallbackPromptQuestion);
    const fallbackBlockedActionTypes = Array.isArray(fallbackPlanningActionFilter?.blockedActionTypes) ? fallbackPlanningActionFilter.blockedActionTypes : [];
    const promptQuestion = String(applyContextState?.promptQuestion || fallbackPromptQuestion).trim();
    actions = Array.isArray(applyContextState?.actions) ? applyContextState.actions : (Array.isArray(fallbackPlanningActionFilter?.actions) ? fallbackPlanningActionFilter.actions : []);
    if ((applyContextState && applyContextState.planningBlocked === true) || (!applyContextState && fallbackBlockedActionTypes.length)) {
        blockedLabels.push(String(applyContextState?.planningBlockedLabel || '已拦截未明确请求的时间块').trim() || '已拦截未明确请求的时间块');
        if (!blockedReason) blockedReason = String(applyContextState?.planningBlockedReason || '用户没有明确提到“时间块”，因此不执行时间块草案动作。').trim() || '用户没有明确提到“时间块”，因此不执行时间块草案动作。';
        setFailureSemantic({
            kind: 'blocked',
            stage: 'planning',
            code: 'time-block-intent-not-explicit',
            message: blockedReason,
        });
    }
    if (!Array.isArray(actions) || actions.length === 0) return { appliedLabels, createdItems, blockedLabels, blockedReason, actionExecutionTrace, transactionId: '', writeReceipt: null, commitReceipt: null, morphActionExecutionFailed: failureKind === 'failed', ...buildFailureSemanticPayload() };
    const userAskedWriteBlocksToDaily = applyContextState ? applyContextState.userAskedWriteBlocksToDaily === true : detectWriteTimeBlocksIntent(promptQuestion);
    const disabledActions = applyContextState?.disabledActions instanceof Set ? applyContextState.disabledActions : new Set((((getMorphRuntimeBundleSafe() || {}).skills || {}).disabledActions || []).map((item) => String(item || '').trim()).filter(Boolean));
    const followupExecutionConfirmation = applyContextState ? applyContextState.followupExecutionConfirmation === true : isActionExecutionFollowup(promptQuestion);
    const terseExpenseCaptureIntent = applyContextState ? applyContextState.terseExpenseCaptureIntent === true : !!extractExpenseRecordFromQuestionSafe(promptQuestion);
    const explicitPluginImplementationIntent = applyContextState
        ? applyContextState.explicitPluginImplementationIntent === true
        : /(补全|补齐|补成|补完|实现|完善|升级|继续做|继续实现|完成插件|可用版本|做完整|做成可用|补功能)/i.test(promptQuestion);
    const explicitWriteIntent = applyContextState ? applyContextState.explicitWriteIntent === true : (/(记下来|记下|记住|记录到|记录进|记到|写入|写进|放进|放入|存进|保存|新增|添加|加入|创建|新建|修改|更新|删除|删掉|移除|去掉|清掉|撤销|撤回|回退|提醒我|帮我记|帮我加|帮我写|直接写|直接加|落到系统里|搬到|移到|挪到|归到|归入|去重|清重|整理到)/i.test(promptQuestion) || /(设置(?:一个)?提醒|设(?:一个|个)?提醒|帮我设置(?:一个)?提醒|给我设(?:一个|个)?提醒)/i.test(promptQuestion) || explicitPluginImplementationIntent || followupExecutionConfirmation || terseExpenseCaptureIntent);
    const implicitMemoryWriteIntent = applyContextState ? applyContextState.implicitMemoryWriteIntent : inferImplicitMemoryWriteActionSafe(promptQuestion);
    const explicitMemoryWriteIntent = applyContextState ? applyContextState.explicitMemoryWriteIntent === true : (/(记住|记下|存进(?:你的)?记忆|写进(?:你的)?记忆|写入(?:你的)?记忆|放进(?:你的)?(?:soul|user|identity|memory(?:-system)?)\.?md|写进(?:你的)?(?:soul|user|identity|memory(?:-system)?)\.?md|(?:修改|改写|重写|更新).{0,12}(?:(?:soul|user|identity|memory(?:-system)?)\.?md|soul|记忆)|memory_write|write_soul_memory)/i.test(promptQuestion) || /(以后叫我|你可以叫我|从今天开始叫我|叫我的真名|真名|我的名字是|我叫|名字叫)/.test(promptQuestion) || !!implicitMemoryWriteIntent);
    const explicitRuntimeWriteIntent = applyContextState ? applyContextState.explicitRuntimeWriteIntent === true : /(运行时规则|自升级|升级规则|技能开关|context rules|memory rules|runtime|更新规则|修改规则)/i.test(promptQuestion);
    const strongDataOperationIntent = applyContextState ? applyContextState.strongDataOperationIntent === true : (resolveShouldTreatAsMorphDataOperation(promptQuestion) === true || terseExpenseCaptureIntent);
    const aiMemory = applyContextState?.aiMemory && typeof applyContextState.aiMemory === 'object' ? applyContextState.aiMemory : (ensureAIMemoryShapeSafe(data).aiMemory || {});
    const activeDualGuidance = applyContextState?.activeDualGuidance && typeof applyContextState.activeDualGuidance === 'object' ? applyContextState.activeDualGuidance : (context.dualGuidance && typeof context.dualGuidance === 'object' ? context.dualGuidance : (aiMemory?.workingMemory?.dualGuidance && typeof aiMemory.workingMemory.dualGuidance === 'object' ? aiMemory.workingMemory.dualGuidance : null));
    const dominantMode = String(applyContextState?.dominantMode || activeDualGuidance?.dominantMode || 'balanced').trim();
    const actionBias = String(applyContextState?.actionBias || activeDualGuidance?.actionBias || 'guide-then-structure').trim();
    const pendingDataIntent = String(applyContextState?.pendingDataIntent || aiMemory?.workingMemory?.currentTaskState?.pendingDataIntent || aiMemory?.currentTaskState?.pendingDataIntent || '').trim();
    const hasPendingDataIntent = applyContextState ? applyContextState.hasPendingDataIntent === true : !!pendingDataIntent;
    const permissionRuntime = applyContextState?.permissionRuntime && typeof applyContextState.permissionRuntime === 'object' ? applyContextState.permissionRuntime : getPermissionContextRuntimeModulesSafe();
    const resolveActionExecutionPolicy = typeof applyContextState?.resolveActionExecutionPolicy === 'function' ? applyContextState.resolveActionExecutionPolicy : (typeof getMorphActionExecutionPolicySafe === 'function' ? getMorphActionExecutionPolicySafe : (type = '') => { if (permissionRuntime && typeof permissionRuntime.getMorphActionExecutionPolicy === 'function') return permissionRuntime.getMorphActionExecutionPolicy(type); const actionType = String(type || '').trim(); return { action: actionType || 'unknown', domain: 'general', permissionLevel: 'update', consentTier: 'architect-required', riskLevel: 'medium', notes: '', }; });
    const buildActionCandidate = typeof applyContextState?.buildActionCandidate === 'function' ? applyContextState.buildActionCandidate : (typeof buildMorphActionCandidateSafe === 'function' ? buildMorphActionCandidateSafe : (type = '', action = {}, meta = {}, policy = null) => ({ action: String(type || '').trim(), actor: String(meta.actor || 'ai').trim() || 'ai', source: String(meta.source || 'ai').trim() || 'ai', requestId: String(action?.requestId || '').trim() || `morph-${String(type || 'action').trim() || 'action'}-${Date.now().toString(36).slice(-8)}`, target: String(action?.target || '').trim(), entity: String(meta.entity || '').trim(), riskLevel: String(policy?.riskLevel || 'medium').trim() || 'medium', confirmationLevel: String(policy?.consentTier || 'architect-required').trim() || 'architect-required', }));
    const buildActionBoundary = typeof applyContextState?.buildActionBoundary === 'function' ? applyContextState.buildActionBoundary : (typeof buildMorphActionBoundaryResultSafe === 'function' ? buildMorphActionBoundaryResultSafe : (type = '', policy = null, details = {}) => { if (permissionRuntime && typeof permissionRuntime.buildMorphActionBoundaryResult === 'function') return permissionRuntime.buildMorphActionBoundaryResult(type, policy, details); return { allowed: details?.allowed !== false, action: String(type || '').trim(), domain: String(policy?.domain || '').trim(), permissionLevel: String(policy?.permissionLevel || '').trim(), consentTier: String(policy?.consentTier || '').trim(), riskLevel: String(policy?.riskLevel || '').trim(), reason: String(details?.reason || '').trim(), }; });
    const sanitizeVerifier = typeof sanitizeMorphActionVerifierResult === 'function'
        ? sanitizeMorphActionVerifierResult
        : (value = null) => (value && typeof value === 'object' ? { ...value } : {});
    const sanitizeReceipt = typeof sanitizeMorphActionReceipt === 'function'
        ? sanitizeMorphActionReceipt
        : (value = null) => (value && typeof value === 'object' ? { ...value } : {});
    const buildSyncEntityRefsFromReceipts = typeof buildMorphSyncEntityRefsFromReceipts === 'function'
        ? buildMorphSyncEntityRefsFromReceipts
        : (receipts = []) => (Array.isArray(receipts) ? receipts : []).filter(Boolean).slice(0, 48);
    const buildSyncEntityRefsFromCreatedItems = typeof buildMorphSyncEntityRefsFromCreatedItems === 'function'
        ? buildMorphSyncEntityRefsFromCreatedItems
        : (items = []) => (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 48);
    const mergeSyncEntityRefs = typeof mergeMorphSyncEntityRefs === 'function'
        ? mergeMorphSyncEntityRefs
        : (...groups) => groups.flatMap((group) => (Array.isArray(group) ? group : [])).filter(Boolean).slice(0, 48);
    const captureMorphActionTransactionDomain = resolve(
      'captureMorphActionTransactionDomain',
      (domain, target = null) => (target && typeof target === 'object' ? cloneJSONSafe(target?.[domain]) : null),
    );
    const normalizeReminderAction = resolve('normalizeReminderAction', () => null);
    const promptReminderDatetimeSelection = resolve('promptReminderDatetimeSelection', () => false);
    const getReminderList = resolve('getReminderList', () => {
      if (!Array.isArray(data?.reminders)) data.reminders = [];
      return data.reminders;
    });
    const findReminderIndexByActionRef = resolve('findReminderIndexByActionRef', () => -1);
    const findReminderIndexesByActionRef = resolve('findReminderIndexesByActionRef', () => []);
    const parseReminderDatetimeToEpoch = resolve('parseReminderDatetimeToEpoch', () => null);
    const extractReminderDemandTextFromQuestion = resolve('extractReminderDemandTextFromQuestion', () => '');
    const reminderMonthKey = resolve('reminderMonthKey', () => '');
    const syncReminderBlocksIntoDailyMonth = resolve('syncReminderBlocksIntoDailyMonth', () => {});
    const scheduleReminderLanSync = resolve('scheduleReminderLanSync', () => {});
    const scheduleReminderNativeIfPossible = resolve('scheduleReminderNativeIfPossible', async () => false);
    const cancelReminderNativeIfPossible = resolve('cancelReminderNativeIfPossible', () => {});
    const getCurrentNativePlatformForReminderNotifications = resolve('getCurrentNativePlatformForReminderNotifications', () => '');
    const normalizeProjectStatus = typeof normalizeProjectStatusValue === 'function'
        ? normalizeProjectStatusValue
        : (value = '') => {
            const raw = String(value || '').trim().toLowerCase();
            if (!raw) return '';
            if (['archived', 'archive', '归档', '已归档', '存档'].includes(raw) || /(归档|存档|放到归档|移到归档)/.test(raw)) return 'archived';
            if (['active', 'restore', '恢复', '还原', '取消归档', '启用'].includes(raw) || /(恢复|还原|取消归档|重新启用|启用)/.test(raw)) return 'active';
            return '';
        };
    const getProjectStoredStatus = typeof normalizeProjectStoredStatus === 'function'
        ? normalizeProjectStoredStatus
        : (project = null) => {
            if (!project || typeof project !== 'object') return '';
            return normalizeProjectStatus(String(project.status || '').trim()) || (String(project.archivedAt || '').trim() ? 'archived' : 'active');
        };
    const resolveProjectByRef = typeof findProjectByRef === 'function'
        ? findProjectByRef
        : (ref = {}) => {
            const projectId = String(ref?.projectId || ref?.id || '').trim();
            const projectName = String(ref?.projectName || ref?.name || '').trim();
            const projects = Array.isArray(data?.projects) ? data.projects : [];
            if (projectId) {
                const exact = projects.find((entry) => String(entry?.id || '').trim() === projectId);
                if (exact) return exact;
            }
            if (projectName) {
                const exactByName = projects.find((entry) => String(entry?.name || '').trim() === projectName);
                if (exactByName) return exactByName;
            }
            return null;
        };
    const exposeRawActionFailures = typeof shouldExposeMorphDevRawFailures === 'function'
        ? shouldExposeMorphDevRawFailures()
        : (typeof globalThis !== 'undefined' && globalThis.__MORPH_DEV_EXPOSE_RAW_FAILURES === true);
    const actionDevRuntime = typeof getAIActionDevRuntimeModules === 'function' ? getAIActionDevRuntimeModules() : null;
    const buildActionDebugMessage = typeof buildMorphDevActionDebugMessage === 'function'
        ? buildMorphDevActionDebugMessage
        : (actionDevRuntime && typeof actionDevRuntime.buildActionDebugMessage === 'function'
            ? actionDevRuntime.buildActionDebugMessage
            : (status = '', type = '', reason = '', details = {}) => `${String(status || '').trim() || 'action'}:${String(type || '').trim() || 'unknown'}${String(reason || '').trim() ? ` | ${String(reason || '').trim()}` : ''}`);
    const buildActionFailure = typeof buildMorphDevActionFailure === 'function'
        ? buildMorphDevActionFailure
        : (status = '', type = '', reasonCode = '', fallbackUserMessage = '', details = {}) => (
            actionDevRuntime && typeof actionDevRuntime.buildActionFailure === 'function'
                ? actionDevRuntime.buildActionFailure(status, type, reasonCode, fallbackUserMessage, details, { exposeRawActionFailures })
                : (() => { const debugMessage = buildActionDebugMessage(status, type, reasonCode, details); return { reasonCode: String(reasonCode || '').trim(), debugMessage, userMessage: exposeRawActionFailures ? debugMessage : String(fallbackUserMessage || '').trim(), }; })()
        );
    const normalizeActionRuntime = typeof getAIActionNormalizeRuntimeModules === 'function' ? getAIActionNormalizeRuntimeModules() : null;
    const normalizeAction = normalizeActionRuntime && typeof normalizeActionRuntime.normalizeMorphHarnessAction === 'function'
        ? (type = '', rawAction = {}, meta = {}) => normalizeActionRuntime.normalizeMorphHarnessAction(type, rawAction, { ...meta, buildActionFailure, normalizeProjectStatus, normalizeReminderAction, sanitizeAIDailyLogWriteText, getTodayStr, })
        : (type = '', rawAction = {}, meta = {}) => {
            const safeAction = rawAction && typeof rawAction === 'object' ? { ...rawAction } : {};
            const normalizedFields = [];
            if (!String(safeAction.requestId || '').trim()) { safeAction.requestId = `morph-${String(type || 'action').trim() || 'action'}-${Date.now().toString(36).slice(-8)}`; normalizedFields.push('requestId'); }
            if (!String(safeAction.source || '').trim()) { safeAction.source = String(meta.source || 'ai').trim() || 'ai'; normalizedFields.push('source'); }
            return { ok: true, action: safeAction, normalizedFields, entity: '', normalizedPayload: {} };
        };
    const validateAction = typeof validateMorphStructuredAction === 'function'
        ? validateMorphStructuredAction
        : () => ({ ok: true, displayName: '' });
    const appendTodayLogDetailed = typeof appendToTodayDailyLogDetailed === 'function'
        ? appendToTodayDailyLogDetailed
        : (text = '', options = {}) => {
            const count = typeof appendToTodayDailyLog === 'function'
                ? appendToTodayDailyLog(text, options)
                : 0;
            const fallbackDateStr = (() => { const now = new Date(); const yyyy = now.getFullYear(); const mm = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0'); return `${yyyy}-${mm}-${dd}`; })(); const dateStr = typeof getTodayStr === 'function' ? getTodayStr() : fallbackDateStr; return { count, dateStr, monthKey: dateStr ? dateStr.slice(0, 7) : '', blockIds: [], blockContents: [String(text || '').trim()].filter(Boolean), updatedAt: new Date().toISOString(), };
        };
    const appendLogUnderDateDetailed = typeof appendToDailyLogUnderDateDetailed === 'function'
        ? appendToDailyLogUnderDateDetailed
        : (monthKey = '', dateStr = '', text = '', options = {}) => {
            const count = typeof appendToDailyLogUnderDate === 'function'
                ? appendToDailyLogUnderDate(monthKey, dateStr, text, options)
                : 0;
            return {
                count,
                dateStr: String(dateStr || '').trim(),
                monthKey: String(monthKey || '').trim(),
                blockIds: [],
                blockContents: [String(text || '').trim()].filter(Boolean),
                updatedAt: new Date().toISOString(),
            };
        };
    const applyTransactionDomain = typeof applyMorphActionTransactionDomain === 'function'
        ? applyMorphActionTransactionDomain
        : async () => false;
    const ensureRuntimeShape = typeof ensureMorphRuntimeShape === 'function'
        ? ensureMorphRuntimeShape
        : (target = {}) => {
            if (!target || typeof target !== 'object') return { morphRuntime: { actionTransactions: [] } };
            if (!target.morphRuntime || typeof target.morphRuntime !== 'object') target.morphRuntime = {};
            if (!Array.isArray(target.morphRuntime.actionTransactions)) target.morphRuntime.actionTransactions = [];
            return target;
        };
    const sanitizeActionTransactions = typeof sanitizeMorphActionTransactions === 'function'
        ? sanitizeMorphActionTransactions
        : (value = []) => (Array.isArray(value) ? value.map((item) => ({ ...(item && typeof item === 'object' ? item : {}) })) : []);
    const restoreActionDomains = async (beforeDomains = {}) => { const entries = Object.entries(beforeDomains || {}); for (const [domain, snapshot] of entries) { if (!domain) continue; await applyTransactionDomain(domain, cloneJSONSafe(snapshot)); } };
    const actionVerifierRuntime = typeof getAIActionVerifierRuntimeModules === 'function' ? getAIActionVerifierRuntimeModules() : null;
    const buildActionReceiptFromVerification = (type = '', action = {}, verification = {}, runtime = {}) => actionVerifierRuntime && typeof actionVerifierRuntime.buildActionReceiptFromVerification === 'function'
        ? actionVerifierRuntime.buildActionReceiptFromVerification(type, action, verification, runtime, { buildMorphActionReceiptFromVerification, sanitizeReceipt, shouldRecordMorphActionTransactionAction, })
        : (typeof buildMorphActionReceiptFromVerification === 'function'
            ? buildMorphActionReceiptFromVerification(type, action, verification, runtime)
            : sanitizeReceipt({ ok: verification?.ok !== false, action: type, summary: String(runtime.summary || '').trim() || String(type || '').trim(), verifierStatus: verification?.ok === false ? 'failed' : 'verified', entity: String(verification?.entity || (/daily_log/.test(type) ? 'daily_log_entry' : '')).trim(), entityId: String(verification?.entityId || '').trim() || String((runtime && runtime.actionResult && runtime.actionResult.blockIds && runtime.actionResult.blockIds[0]) || (runtime && runtime.actionResult && runtime.actionResult.dateStr) || '').trim(), status: String(verification?.status || (runtime && runtime.actionResult && runtime.actionResult.status) || '').trim(), oldStatus: String(verification?.oldStatus || (runtime && runtime.actionResult && runtime.actionResult.oldStatus) || '').trim(), newStatus: String(verification?.newStatus || (runtime && runtime.actionResult && runtime.actionResult.newStatus) || '').trim(), targetDate: String(verification?.targetDate || (runtime && runtime.actionResult && runtime.actionResult.dateStr) || action.date || action.dateStr || '').trim(), updatedAt: String(verification?.updatedAt || (runtime && runtime.actionResult && runtime.actionResult.updatedAt) || new Date().toISOString()).trim(), undoAvailable: shouldRecordMorphActionTransactionAction(type), transactionHandle: '', blockIds: Array.isArray(verification?.blockIds) ? verification.blockIds : (Array.isArray(runtime?.actionResult?.blockIds) ? runtime.actionResult.blockIds : []), }))
        ;
    const verifyStructuredActionOutcome = (type = '', action = {}, runtime = {}) => actionVerifierRuntime && typeof actionVerifierRuntime.verifyStructuredActionOutcome === 'function'
        ? actionVerifierRuntime.verifyStructuredActionOutcome(type, action, runtime, { runtimeModules: runtimeModulesRef })
        : (runtimeModulesRef && typeof runtimeModulesRef.verifyStructuredActionOutcome === 'function' ? runtimeModulesRef.verifyStructuredActionOutcome(type, action, runtime) : { ok: true });
    const buildStructuredConfirmationReason = (type = '', action = {}) => {
        if (typeof actionRuntimeModules !== 'undefined' && actionRuntimeModules && typeof actionRuntimeModules.buildStructuredConfirmationReason === 'function') return actionRuntimeModules.buildStructuredConfirmationReason(type, action, { exposeRawActionFailures });
        return '';
    };
    const actionGateRuntime = typeof getAIActionGateRuntimeModules === 'function' ? getAIActionGateRuntimeModules() : null;
    const matchesActionIntent = (type = '') => {
        if (permissionRuntime && typeof permissionRuntime.matchesMorphActionIntent === 'function') {
            return permissionRuntime.matchesMorphActionIntent(type, {
                promptQuestion,
                explicitWriteIntent,
                explicitPluginImplementationIntent,
                explicitMemoryWriteIntent,
                implicitMemoryWriteIntent,
                explicitRuntimeWriteIntent,
                hasPendingDataIntent,
                terseExpenseCaptureIntent,
            });
        }
        const actionType = String(type || '').trim();
        if (!actionType) return false;
        if (actionType === 'implement_existing_plugin_source') {
            return explicitPluginImplementationIntent || explicitWriteIntent || followupExecutionConfirmation;
        }
        return explicitWriteIntent;
    };
    const buildBlockedReason = () => { const nextBlockedReason = actionGateRuntime && typeof actionGateRuntime.buildBlockedReason === 'function' ? actionGateRuntime.buildBlockedReason({ actionExecutionTrace, blockedLabels, blockedReason, dominantMode, actionBias, exposeRawActionFailures, buildMorphDevActionVisibleMessage, }) : (blockedReason || '没能自动执行写入。用平常话说清要记什么、写到哪里，我再试。'); blockedReason = String(nextBlockedReason || '').trim(); return blockedReason; };
    const actionTraceRuntime = typeof getAIActionTraceRuntimeModules === 'function' ? getAIActionTraceRuntimeModules() : null;
    const isFormalCommittedTraceEntry = (entry = null) => !!(
        entry
        && String(entry.status || '').trim() === 'committed'
        && entry.transactionCommitted !== false
    );
    const buildBlockedVerificationTraceEntry = (context = {}) => actionTraceRuntime && typeof actionTraceRuntime.buildBlockedVerificationTraceEntry === 'function'
        ? actionTraceRuntime.buildBlockedVerificationTraceEntry(context, { sanitizeVerifier })
        : { type: String(context.actionType || '').trim(), status: 'blocked_verification', verifierStatus: 'failed', message: context.verification?.userMessage || '', requestId: String(context.action?.requestId || context.actionCandidate?.requestId || '').trim(), entity: context.verification?.entity || context.normalization?.entity || '', entityId: context.verification?.entityId || '', targetDate: context.verification?.targetDate || context.normalization?.targetDate || '', candidate: context.actionCandidate || {}, normalizedPayload: context.normalization?.normalizedPayload || {}, boundary: context.baseBoundary || null, verifier: sanitizeVerifier(context.verification || { ok: true }), promptQuestion: String(context.promptQuestion || '').trim(), transactionId: '', };
    const buildNeedsConfirmationTraceEntry = (context = {}) => actionTraceRuntime && typeof actionTraceRuntime.buildNeedsConfirmationTraceEntry === 'function'
        ? actionTraceRuntime.buildNeedsConfirmationTraceEntry(context)
        : { type: String(context.actionType || '').trim(), status: 'needs_confirmation', verifierStatus: 'not_run', message: String(context.postcheck?.blockedReason || '').trim(), requestId: String(context.action?.requestId || context.actionCandidate?.requestId || '').trim(), entity: context.normalization?.entity || '', targetDate: context.normalization?.targetDate || '', candidate: context.actionCandidate || {}, normalizedPayload: context.normalization?.normalizedPayload || {}, boundary: context.baseBoundary || null, promptQuestion: String(context.promptQuestion || '').trim(), transactionId: '', hydratedFields: Array.isArray(context.hydratedFields) ? context.hydratedFields : [], };
    const buildCommittedTraceEntry = (context = {}) => actionTraceRuntime && typeof actionTraceRuntime.buildCommittedTraceEntry === 'function'
        ? actionTraceRuntime.buildCommittedTraceEntry(context, { sanitizeVerifier })
        : (() => { const mutationLayer = String(context.actionRuntimeMeta?.mutationLayer || context.mutationLayer || '').trim().toLowerCase() || 'canonical'; const transactionCommitted = context.transactionCommitted !== false; return { type: String(context.actionType || '').trim(), status: transactionCommitted ? 'committed' : (mutationLayer === 'draft' ? 'draft_applied' : 'applied_local'), verifierStatus: 'verified', message: '', requestId: String(context.action?.requestId || context.actionCandidate?.requestId || '').trim(), entity: context.actionReceipt?.entity || context.verification?.entity || context.normalization?.entity || '', entityId: context.actionReceipt?.entityId || context.verification?.entityId || '', targetDate: context.actionReceipt?.targetDate || context.verification?.targetDate || context.normalization?.targetDate || '', candidate: context.actionCandidate || {}, normalizedPayload: context.normalization?.normalizedPayload || {}, boundary: context.baseBoundary || null, verifier: sanitizeVerifier(context.verification || { ok: true }), receipt: context.actionReceipt && typeof context.actionReceipt === 'object' ? context.actionReceipt : null, promptQuestion: String(context.promptQuestion || '').trim(), transactionId: '', mutationLayer, transactionCommitted, hydratedFields: Array.isArray(context.hydratedFields) ? context.hydratedFields : [], }; })();
    const actionExpenseRuntime = typeof getAIActionExpenseRuntimeModules === 'function' ? getAIActionExpenseRuntimeModules() : null;
    const applyExpenseAction = (type = '', actionPayload = {}, runtime = {}) => actionExpenseRuntime && typeof actionExpenseRuntime.applyExpenseAction === 'function'
        ? actionExpenseRuntime.applyExpenseAction(type, actionPayload, { ...runtime, genId, ensureExpenseLedgerShape, normalizeExpenseLedgerRecord, inferExpenseCategoryFromText, findExpenseLedgerRecordByAction, getExpenseLedgerRecordIndexById, syncExpenseLedgerExtensionFiles, buildExpenseLedgerSummary, formatDateTimeFull, })
        : (() => { const actionType = String(type || '').trim(); const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {}; const dataRef = runtime.dataRef && typeof runtime.dataRef === 'object' ? runtime.dataRef : data; if (!actionType || !dataRef || typeof ensureExpenseLedgerShape !== 'function') return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const ledger = ensureExpenseLedgerShape(dataRef); const buildItem = (record = {}, label = '记账') => { const summary = typeof buildExpenseLedgerSummary === 'function' ? buildExpenseLedgerSummary(record) : ''; return { label: `${label}：${summary}`, item: { tab: 'expenseLedger', id: String(record?.id || '').trim(), text: summary } }; }; if (actionType === 'add_expense_record') { const record = typeof normalizeExpenseLedgerRecord === 'function' ? normalizeExpenseLedgerRecord({ id: action.id || genId(), item: String(action.item || action.text || action.title || action.note || action.category || '').trim(), category: String(action.category || '').trim() || inferExpenseCategoryFromText(String(action.item || action.text || action.note || '')), amount: Number(action.amount), note: String(action.note || '').trim(), spentAt: String(action.spentAt || action.datetime || '').trim() || formatDateTimeFull(new Date()).slice(0, 16), createdAt: new Date().toISOString(), source: String(action.source || 'ai').trim() || 'ai', }) : null; if (!record || !record.item) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (!Array.isArray(ledger.categories)) ledger.categories = []; if (!ledger.categories.includes(record.category)) ledger.categories.push(record.category); if (!Array.isArray(ledger.records)) ledger.records = []; ledger.records.unshift(record); if (typeof syncExpenseLedgerExtensionFiles === 'function') syncExpenseLedgerExtensionFiles(record); const built = buildItem(record, '记账'); return { handled: true, changed: true, appliedLabels: [built.label], createdItems: [built.item], actionRuntimeMeta: null }; } if (actionType === 'update_expense_record') { const target = typeof findExpenseLedgerRecordByAction === 'function' ? findExpenseLedgerRecordByAction(action, ledger) : null; if (!target?.id) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const index = typeof getExpenseLedgerRecordIndexById === 'function' ? getExpenseLedgerRecordIndexById(target.id, ledger) : -1; if (index < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const nextCategory = String(action.category || '').trim() || String(target.category || '').trim() || inferExpenseCategoryFromText(String(action.item || target.item || '')); const nextAmount = Number.isFinite(Number(action.amount)) && Number(action.amount) > 0 ? Math.round(Number(action.amount) * 100) / 100 : Number(target.amount || 0); const nextSpentAt = String(action.spentAt || action.datetime || '').trim() || String(target.spentAt || '').trim() || formatDateTimeFull(new Date()).slice(0, 16); const nextItem = String(action.item || action.text || action.title || '').trim() || String(target.item || '').trim(); const nextNote = Object.prototype.hasOwnProperty.call(action, 'note') ? String(action.note || '').trim() : String(target.note || '').trim(); const updated = typeof normalizeExpenseLedgerRecord === 'function' ? normalizeExpenseLedgerRecord({ ...target, item: nextItem, amount: nextAmount, category: nextCategory, note: nextNote, spentAt: nextSpentAt, source: String(action.source || target.source || 'ai').trim() || 'ai', }) : null; if (!updated?.item) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (!Array.isArray(ledger.records)) ledger.records = []; const existing = ledger.records[index] && typeof ledger.records[index] === 'object' ? ledger.records[index] : null; if (existing) { Object.assign(existing, updated); ledger.records[index] = existing; } else { ledger.records[index] = updated; } if (!Array.isArray(ledger.categories)) ledger.categories = []; if (updated.category && !ledger.categories.includes(updated.category)) ledger.categories.push(updated.category); if (typeof syncExpenseLedgerExtensionFiles === 'function') syncExpenseLedgerExtensionFiles(); const built = buildItem(existing || updated, '修改记账'); return { handled: true, changed: true, appliedLabels: [built.label], createdItems: [built.item], actionRuntimeMeta: null }; } if (actionType === 'delete_expense_record') { const target = typeof findExpenseLedgerRecordByAction === 'function' ? findExpenseLedgerRecordByAction(action, ledger) : null; if (!target?.id) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const index = typeof getExpenseLedgerRecordIndexById === 'function' ? getExpenseLedgerRecordIndexById(target.id, ledger) : -1; if (index < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const removed = Array.isArray(ledger.records) ? ledger.records.splice(index, 1)[0] : null; if (!removed?.id) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (typeof syncExpenseLedgerExtensionFiles === 'function') syncExpenseLedgerExtensionFiles(); const built = buildItem(removed, '删除记账'); return { handled: true, changed: true, appliedLabels: [built.label], createdItems: [built.item], actionRuntimeMeta: null }; } if (actionType === 'undo_last_expense_record') { const removed = Array.isArray(ledger.records) ? ledger.records.shift() : null; if (!removed?.id) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (typeof syncExpenseLedgerExtensionFiles === 'function') syncExpenseLedgerExtensionFiles(); const built = buildItem(removed, '撤销记账'); return { handled: true, changed: true, appliedLabels: [built.label], createdItems: [built.item], actionRuntimeMeta: null }; } return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; })();
    const actionReminderRuntime = typeof getAIActionReminderRuntimeModules === 'function' ? getAIActionReminderRuntimeModules() : null;
    const applyReminderAction = (type = '', actionPayload = {}, runtime = {}) => actionReminderRuntime && typeof actionReminderRuntime.applyReminderAction === 'function'
        ? actionReminderRuntime.applyReminderAction(type, actionPayload, { ...runtime, genId, normalizeReminderAction, promptReminderDatetimeSelection, getReminderList, findReminderIndexByActionRef, findReminderIndexesByActionRef, parseReminderDatetimeToEpoch, extractReminderDemandTextFromQuestion, reminderMonthKey, syncReminderBlocksIntoDailyMonth, scheduleReminderLanSync, scheduleReminderNativeIfPossible, cancelReminderNativeIfPossible, getCurrentNativePlatformForReminderNotifications, pushAILogReminderUndoSnapshot, saveSilent, commitPatchIntent: typeof commitMorphCoreMutation === 'function' ? commitMorphCoreMutation : null, })
        : (() => { const actionType = String(type || '').trim(); const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {}; if (!actionType) return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const reminders = getReminderList(); if (actionType === 'add_reminder') { pushAILogReminderUndoSnapshot('add_reminder'); const reminder = (String(action.id || '').trim() && String(action.text || '').trim() && String(action.dueAtText || action.datetime || '').trim() && Number.isFinite(Number(action.dueAtMs || 0)) && Number(action.dueAtMs || 0) > 0) ? { id: String(action.id || '').trim(), text: String(action.text || '').trim(), requestText: String(action.requestText || action.text || '').trim(), dueAtText: String(action.dueAtText || action.datetime || '').trim(), dueAtMs: Number(action.dueAtMs || 0), timezone: String(action.timezone || 'Asia/Shanghai').trim() || 'Asia/Shanghai', createdAt: String(action.createdAt || '').trim() || new Date().toISOString(), updatedAt: String(action.updatedAt || '').trim() || new Date().toISOString(), status: String(action.status || 'active').trim() || 'active', source: String(action.source || 'ai').trim() || 'ai', } : normalizeReminderAction(action); if (!reminder) { promptReminderDatetimeSelection(action); return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; } const actionRuntimeMeta = { actionResult: { entity: 'reminder', entityId: reminder.id, targetDate: String(reminder.dueAtText || '').trim().slice(0, 10), updatedAt: String(reminder.updatedAt || '').trim() || new Date().toISOString(), }, }; reminders.push(reminder); reminders.sort((a, b) => Number(a?.dueAtMs || 0) - Number(b?.dueAtMs || 0)); scheduleReminderLanSync('add_reminder'); const monthKey = reminderMonthKey(reminder); if (monthKey) syncReminderBlocksIntoDailyMonth(monthKey); scheduleReminderNativeIfPossible(reminder).then((scheduled) => { if (!scheduled) return; reminder.nativeScheduled = true; saveSilent({ skipUndo: true }); }); return { handled: true, changed: true, appliedLabels: [`提醒已设置：${reminder.dueAtText} ${reminder.text.slice(0, 24)}`], createdItems: [{ tab: 'reminders', id: reminder.id, text: reminder.text, dueAtText: reminder.dueAtText }], actionRuntimeMeta, }; } if (actionType === 'delete_reminder') { const indexes = typeof findReminderIndexesByActionRef === 'function' ? findReminderIndexesByActionRef(action) : [findReminderIndexByActionRef(action)].filter((idx) => idx >= 0); if (!indexes.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; pushAILogReminderUndoSnapshot('delete_reminder'); const removedItems = []; Array.from(new Set(indexes)).sort((a, b) => b - a).forEach((idx) => { if (!(idx >= 0 && idx < reminders.length)) return; const removed = reminders.splice(idx, 1)[0]; if (removed) removedItems.unshift(removed); }); if (!removedItems.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; scheduleReminderLanSync('delete_reminder'); Array.from(new Set(removedItems.map((item) => reminderMonthKey(item)).filter(Boolean))).forEach((monthKey) => { syncReminderBlocksIntoDailyMonth(monthKey); }); removedItems.forEach((removed) => { cancelReminderNativeIfPossible(removed?.id); }); const removedPreview = String(removedItems[0]?.text || '').slice(0, 24); return { handled: true, changed: true, appliedLabels: [removedItems.length > 1 ? `删除提醒：${removedPreview} 等 ${removedItems.length} 条` : `删除提醒：${removedPreview}`], createdItems: removedItems.map((removed) => ({ tab: 'reminders', id: removed.id, text: removed.text, dueAtText: removed.dueAtText, removed: true })), actionRuntimeMeta: null, }; } if (actionType === 'update_reminder') { const idx = findReminderIndexByActionRef(action); if (idx < 0 || idx >= reminders.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const target = reminders[idx]; const oldMonthKey = reminderMonthKey(target); const nextText = String(action.newText || action.textNew || action.toText || '').trim(); const datetimeRaw = [action.newDatetime, action.datetimeNew, action.toDatetime, action.datetime, action.dueAt, (action.newDate && action.newTime) ? `${action.newDate} ${action.newTime}` : '', (action.date && action.time) ? `${action.date} ${action.time}` : '', action.newTime, action.time,].map((item) => String(item || '').trim()).find(Boolean) || ''; const parsed = datetimeRaw ? parseReminderDatetimeToEpoch(datetimeRaw) : null; const shouldUpdateText = !!nextText; const shouldUpdateTime = !!parsed; if (!shouldUpdateText && !shouldUpdateTime) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; pushAILogReminderUndoSnapshot('update_reminder'); if (shouldUpdateText) { target.text = nextText; target.requestText = String(action.requestText || action.detailText || extractReminderDemandTextFromQuestion(action.rawQuestion || '') || nextText).trim() || nextText; } if (shouldUpdateTime) { target.dueAtMs = parsed.epochMs; target.dueAtText = parsed.text; } target.updatedAt = new Date().toISOString(); reminders.sort((a, b) => Number(a?.dueAtMs || 0) - Number(b?.dueAtMs || 0)); scheduleReminderLanSync('update_reminder'); const nextMonthKey = reminderMonthKey(target); if (oldMonthKey) syncReminderBlocksIntoDailyMonth(oldMonthKey); if (nextMonthKey) syncReminderBlocksIntoDailyMonth(nextMonthKey); scheduleReminderNativeIfPossible(target).then((scheduled) => { if (!scheduled) return; target.nativeScheduled = true; saveSilent({ skipUndo: true }); }); return { handled: true, changed: true, appliedLabels: [`修改提醒：${String(target?.text || '').slice(0, 24)}`], createdItems: [], actionRuntimeMeta: null, }; } return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; })();
    const applyThoughtTransformAction = (type = '', actionPayload = {}, runtime = {}) => {
        const thoughtRuntime = typeof getAIActionThoughtRuntimeModules === 'function' ? getAIActionThoughtRuntimeModules() : null;
        if (thoughtRuntime && typeof thoughtRuntime.applyThoughtTransformAction === 'function') {
            return thoughtRuntime.applyThoughtTransformAction(type, actionPayload, { ...runtime, dataRef: data, genId, findFlashThoughtByRef, findFlashThoughtsByRefs, findFixedThoughtByRef, findProjectByRef, createProjectFromFixedThought, createProjectWithLinkedFixedThought, normalizeFlashThoughtText, });
        }
        const actionType = String(type || '').trim();
        const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
        const dataRef = runtime.dataRef && typeof runtime.dataRef === 'object' ? runtime.dataRef : data;
        if (!actionType || !dataRef) return { handled: false, changed: false, appliedLabels: [], createdItems: [] };
        if (actionType === 'move_flash_to_fixed') {
            const flash = findFlashThoughtByRef(action);
            if (!flash) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const flashIdx = dataRef.flashThoughts.findIndex((item) => item.id === flash.id);
            if (flashIdx < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const [moved] = dataRef.flashThoughts.splice(flashIdx, 1);
            delete moved.clusterId;
            dataRef.fixed.unshift(moved);
            return { handled: true, changed: true, appliedLabels: [`闪念转定念：${String(moved.text || '').slice(0, 16)}`], createdItems: [] };
        }
        if (actionType === 'move_fixed_to_project') {
            const fixed = findFixedThoughtByRef(action);
            if (!fixed) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const result = createProjectFromFixedThought(fixed);
            if (!result?.project) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            return { handled: true, changed: true, appliedLabels: [`定念转项目：${result.project.name}`], createdItems: [{ tab: 'project', id: result.project.id, text: result.project.name }] };
        }
        if (actionType === 'move_flash_to_project_reference') {
            const project = findProjectByRef(action);
            const flash = findFlashThoughtByRef(action);
            if (!project || !flash) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const flashIdx = dataRef.flashThoughts.findIndex((item) => item.id === flash.id);
            if (flashIdx < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const [moved] = dataRef.flashThoughts.splice(flashIdx, 1);
            delete moved.clusterId;
            if (!Array.isArray(project.items)) project.items = [];
            project.items.unshift(moved);
            return { handled: true, changed: true, appliedLabels: [`闪念归入项目：${project.name}`], createdItems: [{ tab: 'project', id: project.id, text: project.name, target: 'references' }] };
        }
        if (actionType === 'ungroup_flash_thoughts') {
            const refs = Array.isArray(action.items) ? action.items : [];
            let targets = findFlashThoughtsByRefs(refs);
            if (!targets.length && action.clusterId) targets = dataRef.flashThoughts.filter((item) => item.clusterId === action.clusterId);
            if (!targets.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            let ungrouped = 0;
            targets.forEach((item) => {
                if (!item.clusterId) return;
                delete item.clusterId;
                ungrouped += 1;
            });
            if (!ungrouped) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            return { handled: true, changed: true, appliedLabels: [`取消分组：${ungrouped} 条`], createdItems: [] };
        }
        if (actionType === 'merge_flash_thoughts') {
            const refs = Array.isArray(action.items) ? action.items : [];
            const matches = findFlashThoughtsByRefs(refs);
            if (matches.length < 2) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const mergedText = String(action.text || '').trim() || matches.map((item) => String(item.text || '').trim()).filter(Boolean).join('\n');
            if (!mergedText) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const ids = new Set(matches.map((item) => item.id));
            dataRef.flashThoughts = dataRef.flashThoughts.filter((item) => !ids.has(item.id));
            const id = genId();
            dataRef.flashThoughts.unshift({ id, text: mergedText, time: new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) });
            return { handled: true, changed: true, appliedLabels: [`合并闪念：${matches.length} 条`], createdItems: [{ tab: 'flashThoughts', id, text: mergedText }] };
        }
        if (actionType === 'dedupe_flash_thoughts') {
            const refs = Array.isArray(action.items) ? action.items : [];
            const scoped = refs.length ? findFlashThoughtsByRefs(refs) : dataRef.flashThoughts.slice();
            if (scoped.length < 2) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const keepMap = new Map();
            const removeIds = [];
            scoped.forEach((item) => {
                const key = normalizeFlashThoughtText(item.text);
                if (!key) return;
                if (!keepMap.has(key)) {
                    keepMap.set(key, item.id);
                    return;
                }
                removeIds.push(item.id);
            });
            if (!removeIds.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const removeSet = new Set(removeIds);
            dataRef.flashThoughts = dataRef.flashThoughts.filter((item) => !removeSet.has(item.id));
            return { handled: true, changed: true, appliedLabels: [`闪念去重：${removeIds.length} 条`], createdItems: [] };
        }
        if (actionType === 'dedupe_project_references') {
            const removals = Array.isArray(action.removals) ? action.removals : [];
            let removedCount = 0;
            removals.forEach((r) => {
                const projectId = r.projectId || r.project;
                const itemId = r.itemId || r.id;
                if (!projectId || !itemId) return;
                const project = dataRef.projects.find((p) => p.id === projectId);
                if (!project || !Array.isArray(project.items)) return;
                const before = project.items.length;
                project.items = project.items.filter((item) => item.id !== itemId);
                if (project.items.length < before) removedCount += 1;
            });
            if (!removedCount) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            return { handled: true, changed: true, appliedLabels: [`项目条目去重：移除 ${removedCount} 条重复`], createdItems: [] };
        }
        if (actionType === 'create_project_from_flash_group') {
            const clusterId = String(action.clusterId || '').trim();
            let sourceItems = clusterId ? dataRef.flashThoughts.filter((item) => item.clusterId === clusterId) : findFlashThoughtsByRefs(Array.isArray(action.items) ? action.items : []);
            sourceItems = Array.from(new Map(sourceItems.map((item) => [item.id, item])).values());
            if (sourceItems.length < 2) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const name = String(action.name || action.projectName || '').trim() || `闪念群组项目 ${new Date().toLocaleDateString('zh-CN')}`;
            const items = sourceItems.map((item) => {
                const next = { ...item };
                delete next.clusterId;
                return next;
            });
            const result = typeof createProjectWithLinkedFixedThought === 'function' ? createProjectWithLinkedFixedThought(name, { items }) : (() => { const id = genId(); const project = { id, name, items, blocks: [{ id: genId(), type: 'p', content: '', checked: false }], createdAt: new Date().toISOString() }; dataRef.projects.unshift(project); return { project }; })();
            if (!result?.project) return { handled: true, changed: false, appliedLabels: [], createdItems: [] };
            const sourceIds = new Set(sourceItems.map((item) => item.id));
            dataRef.flashThoughts = dataRef.flashThoughts.filter((item) => !sourceIds.has(item.id));
            return { handled: true, changed: true, appliedLabels: [`群组建项目：${result.project.name}`], createdItems: [{ tab: 'project', id: result.project.id, text: result.project.name }] };
        }
        return { handled: false, changed: false, appliedLabels: [], createdItems: [] };
    };
    const actionMemoryRuntime = typeof getAIActionMemoryRuntimeModules === 'function' ? getAIActionMemoryRuntimeModules() : null;
    const applyMemoryAction = (type = '', actionPayload = {}, runtime = {}) => actionMemoryRuntime && typeof actionMemoryRuntime.applyMemoryAction === 'function'
        ? actionMemoryRuntime.applyMemoryAction(type, actionPayload, { ...runtime, ensureAIMemoryShape, appendToMarkdownSection, recordExplicitMemoryLogEntry, rewriteMarkdownSection, buildDefaultAISoulUserMaterialMarkdown, setMorphSoulMaterialActivation, refreshDurableVisibleMemoryFiles, writeStableUserMemoryEntry: writeStableUserMemoryEntryRuntime, getMorphRuntimeBundle, applyMorphRuntimeOverlayUpdate, runProactiveAgentScan, })
        : (() => { const actionType = String(type || '').trim(); const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {}; if (!actionType) return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (actionType === 'memory_write_user') { const content = String(action.content || action.text || '').trim(); if (!content) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const sectionTitle = String(action.sectionTitle || '用户偏好').trim() || '用户偏好'; const aiMemory = ensureAIMemoryShape(data).aiMemory; const stableWriteResult = typeof writeStableUserMemoryEntryRuntime === 'function' ? writeStableUserMemoryEntryRuntime({ scope: 'user', sectionTitle, content, stableKey: String(action.stableKey || '').trim(), }, aiMemory, { source: 'memory_write_user' }) : null; if (stableWriteResult?.blocked) return { handled: true, changed: false, appliedLabels: ['已拦截稳定记忆写入'], createdItems: [], actionRuntimeMeta: { blocked: true, blockedReason: '这条内容会改写 Morpheus 的核心底盘，当前不允许作为稳定用户记忆写入。', constitution: Array.isArray(stableWriteResult.constitution) ? stableWriteResult.constitution.slice(0, 6) : [], }, }; if (stableWriteResult?.changed) return { handled: true, changed: true, appliedLabels: [`已记住，并写入 ${String(stableWriteResult.targetFile || 'user.md').trim() || 'user.md'}：${sectionTitle}`], createdItems: [], actionRuntimeMeta: null }; aiMemory.user = appendToMarkdownSection(aiMemory.user, sectionTitle, content); recordExplicitMemoryLogEntry({ scope: 'user', sectionTitle, content, source: 'memory_write_user', candidateType: 'stable-preference', writeTier: 'long-term-active', label: sectionTitle, summary: `写入了用户记忆：${sectionTitle}`, }); return { handled: true, changed: true, appliedLabels: [`写入用户记忆：${sectionTitle}`], createdItems: [], actionRuntimeMeta: null }; } if (actionType === 'memory_rewrite_section') { const content = String(action.content || action.text || '').trim(); const sectionTitle = String(action.sectionTitle || '长期记忆').trim() || '长期记忆'; if (!content) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const aiMemory = ensureAIMemoryShape(data).aiMemory; aiMemory.soulUserNotes = rewriteMarkdownSection(aiMemory.soulUserNotes, sectionTitle, content, { buildDefaultMarkdown: buildDefaultAISoulUserMaterialMarkdown, }); setMorphSoulMaterialActivation({ sectionTitle, content, source: 'memory_rewrite_section', turns: 3, }); refreshDurableVisibleMemoryFiles(aiMemory); recordExplicitMemoryLogEntry({ scope: 'soul', sectionTitle, content, source: 'memory_rewrite_section', candidateType: 'explicit-memory', writeTier: 'long-term-candidate', label: sectionTitle, summary: `重写了 soul 记忆章节：${sectionTitle}`, }); return { handled: true, changed: true, appliedLabels: [`重写记忆章节：${sectionTitle}`], createdItems: [], actionRuntimeMeta: null }; } if (actionType === 'write_soul_memory') { const content = String(action.content || action.text || '').trim(); if (!content) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const sectionTitle = String(action.sectionTitle || '长期记忆').trim() || '长期记忆'; const aiMemory = ensureAIMemoryShape(data).aiMemory; aiMemory.soulUserNotes = appendToMarkdownSection(aiMemory.soulUserNotes, sectionTitle, content, { buildDefaultMarkdown: buildDefaultAISoulUserMaterialMarkdown, }); setMorphSoulMaterialActivation({ sectionTitle, content, source: 'write_soul_memory', turns: 3, }); refreshDurableVisibleMemoryFiles(aiMemory); recordExplicitMemoryLogEntry({ scope: 'soul', sectionTitle, content, source: 'write_soul_memory', candidateType: 'explicit-memory', writeTier: 'long-term-candidate', label: sectionTitle, summary: `写入了 soul 记忆：${sectionTitle}`, }); return { handled: true, changed: true, appliedLabels: [`写入记忆：${sectionTitle}`], createdItems: [], actionRuntimeMeta: null }; } if (actionType === 'self_update_runtime_rules') { if (!getMorphRuntimeBundle().skills.selfUpgradeEnabled) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const updates = action.updates && typeof action.updates === 'object' ? action.updates : {}; if (!applyMorphRuntimeOverlayUpdate(updates)) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; recordExplicitMemoryLogEntry({ scope: 'runtime', sectionTitle: '运行时规则', content: JSON.stringify(updates), source: 'self_update_runtime_rules', candidateType: 'explicit-memory', writeTier: 'runtime-rule-hint', label: '运行时规则', summary: '记录了一次运行时规则更新', }); const touched = []; if (updates.skills) touched.push('skills'); if (updates.contextRules) touched.push('contextRules'); if (typeof updates.memoryRules === 'string') touched.push('memoryRules'); return { handled: true, changed: true, appliedLabels: [`自升级：${touched.join(' / ') || 'runtime'}`], createdItems: [], actionRuntimeMeta: null }; } if (actionType === 'trigger_proactive_scan') { setTimeout(() => { runProactiveAgentScan({ force: true, source: 'ai-action' }); }, 0); return { handled: true, changed: false, appliedLabels: ['已触发主动巡查'], createdItems: [], actionRuntimeMeta: null }; } return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; })();
    const actionDailyRuntime = typeof getAIActionDailyRuntimeModules === 'function' ? getAIActionDailyRuntimeModules() : null;
    const applyDailyAction = (type = '', actionPayload = {}, runtime = {}) => actionDailyRuntime && typeof actionDailyRuntime.applyDailyAction === 'function'
        ? actionDailyRuntime.applyDailyAction(type, actionPayload, { ...runtime, dataRef: data, pushAILogReminderUndoSnapshot, appendTodayLogDetailed, appendLogUnderDateDetailed, findDailyLogEntriesByActionRef, summarizeTodayDailyLogLocally, })
        : (() => { const actionType = String(type || '').trim(); const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {}; const dataRef = runtime.dataRef && typeof runtime.dataRef === 'object' ? runtime.dataRef : data; if (!actionType || !dataRef) return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (actionType === 'append_daily_log') { pushAILogReminderUndoSnapshot('append_daily_log'); const preserveStyle = !!action.preserveStyle; const result = appendTodayLogDetailed(action.text || action.content || '', { preferTodo: !preserveStyle }); if (!result?.count) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; return { handled: true, changed: true, appliedLabels: [`写入今日日志：${result.count} 段`], createdItems: [{ tab: 'daily', id: result.dateStr, text: result.textPreview, blockIds: result.blockIds }], actionRuntimeMeta: { actionResult: result }, }; } if (actionType === 'append_daily_log_under_date') { pushAILogReminderUndoSnapshot('append_daily_log_under_date'); const dateStr = String(action.date || action.dateStr || '').trim(); const preserveStyle = !!action.preserveStyle; if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const result = appendLogUnderDateDetailed(dateStr.slice(0, 7), dateStr, action.text || action.content || '', { preferTodo: !preserveStyle }); if (!result?.count) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; return { handled: true, changed: true, appliedLabels: [`写入日志：${dateStr}`], createdItems: [{ tab: 'daily', id: dateStr, text: result.textPreview, blockIds: result.blockIds }], actionRuntimeMeta: { actionResult: result }, }; } if (actionType === 'delete_daily_log_entry') { const targets = findDailyLogEntriesByActionRef(action, { single: false }); if (!targets.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; pushAILogReminderUndoSnapshot('delete_daily_log_entry'); let removed = 0; targets.forEach((target) => { const blocks = dataRef.dailyMonths?.[target.monthKey]; if (!Array.isArray(blocks)) return; const idx = blocks.findIndex((block) => String(block?.id || '') === target.blockId); if (idx < 0) return; blocks.splice(idx, 1); removed += 1; }); if (!removed) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; return { handled: true, changed: true, appliedLabels: [`删除日志条目：${removed} 条`], createdItems: [], actionRuntimeMeta: null }; } if (actionType === 'update_daily_log_entry') { const targets = findDailyLogEntriesByActionRef(action, { single: true }); if (!targets.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const target = targets[0]; const newText = String(action.newText || action.textNew || action.toText || action.content || '').trim(); if (!newText) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const blocks = dataRef.dailyMonths?.[target.monthKey]; if (!Array.isArray(blocks)) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const idx = blocks.findIndex((block) => String(block?.id || '') === target.blockId); if (idx < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; pushAILogReminderUndoSnapshot('update_daily_log_entry'); blocks[idx].content = newText; delete blocks[idx].html; return { handled: true, changed: true, appliedLabels: [`修改日志：${target.dateStr}`], createdItems: [], actionRuntimeMeta: null }; } if (actionType === 'summarize_today_to_daily_log') { pushAILogReminderUndoSnapshot('summarize_today_to_daily_log'); const text = String(action.text || action.content || '').trim() || summarizeTodayDailyLogLocally(); if (!text) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const result = appendTodayLogDetailed(text, { preferTodo: false }); if (!result?.count) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; return { handled: true, changed: true, appliedLabels: [`今日日志总结：${result.count} 段`], createdItems: [{ tab: 'daily', id: result.dateStr, text: result.textPreview, blockIds: result.blockIds }], actionRuntimeMeta: { actionResult: result }, }; } return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; })();
    const actionPlanningRuntime = typeof getAIActionPlanningRuntimeModules === 'function' ? getAIActionPlanningRuntimeModules() : null;
    const applyPlanningAction = (type = '', actionPayload = {}, runtime = {}) => actionPlanningRuntime && typeof actionPlanningRuntime.applyPlanningAction === 'function'
        ? actionPlanningRuntime.applyPlanningAction(type, actionPayload, { ...runtime, pushAILogReminderUndoSnapshot, clampTimeBlockDayCount, applyExplicitWeekScheduleDraft, generateWeekScheduleDraftFromCurrentData, generateTodayTimeBlocksDraftFromCurrentData, formatTimeBlocksAsDailyText, appendToTodayDailyLog, genId, userAskedWriteBlocksToDaily, })
        : (() => { const actionType = String(type || '').trim(); const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {}; if (!actionType) return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (actionType === 'plan_week_schedule_draft') { pushAILogReminderUndoSnapshot('plan_week_schedule_draft'); const rangeType = ['this_week', 'next_week', 'rolling'].includes(String(action.rangeType || '').trim()) ? String(action.rangeType || '').trim() : 'rolling'; const dayCount = rangeType === 'rolling' ? clampTimeBlockDayCount(action.dayCount, 7) : 7; const result = Array.isArray(action.days) && action.days.length ? applyExplicitWeekScheduleDraft(action.days, rangeType, dayCount) : generateWeekScheduleDraftFromCurrentData(rangeType, dayCount); if (!result || !result.added) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; return { handled: true, changed: true, appliedLabels: [`周计划草案：${result.startDate} 至 ${result.endDate}，新增 ${result.added} 个时间块`], createdItems: [{ tab: 'routine', id: result.routineId, text: '统一日历' }, { tab: 'weekTimeBlocks', id: genId(), text: `week-time-blocks-${result.startDate}`, startDate: result.startDate, endDate: result.endDate, rangeType: result.rangeType || rangeType, dayCount: result.dayCount || dayCount, days: Array.isArray(result.weekBlocks) ? result.weekBlocks : [], }], actionRuntimeMeta: { transactionEligible: false, mutationLayer: 'draft' }, }; } if (actionType === 'plan_today_time_blocks') { const result = generateTodayTimeBlocksDraftFromCurrentData({ customBlocks: Array.isArray(action.blocks) ? action.blocks : [], }); const blocks = Array.isArray(result?.blocks) ? result.blocks : []; if (!blocks.length) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const allowWriteToDaily = (action.writeToDaily === true && (action.explicitWriteToDaily === true || action.target === 'daily' || userAskedWriteBlocksToDaily)); if (allowWriteToDaily) { const dailyText = formatTimeBlocksAsDailyText(result); if (dailyText) { pushAILogReminderUndoSnapshot('plan_today_time_blocks'); appendToTodayDailyLog(dailyText, { preferTodo: false }); } } return { handled: true, changed: true, appliedLabels: [`今日时间块：${result.date}，新增 ${blocks.length} 个卡片`], createdItems: [{ tab: 'timeBlocks', id: genId(), text: `time-blocks-${result.date}`, date: result.date, blocks, }], actionRuntimeMeta: { transactionEligible: allowWriteToDaily, mutationLayer: allowWriteToDaily ? 'canonical' : 'draft', actionResult: allowWriteToDaily ? { entity: 'daily_log_entry', targetDate: String(result?.date || '').trim(), dateStr: String(result?.date || '').trim(), updatedAt: new Date().toISOString(), } : null }, }; } return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; })();
    const actionProjectRuntime = typeof getAIActionProjectRuntimeModules === 'function' ? getAIActionProjectRuntimeModules() : null;
    const applyProjectAction = (type = '', actionPayload = {}, runtime = {}) => actionProjectRuntime && typeof actionProjectRuntime.applyProjectAction === 'function'
        ? actionProjectRuntime.applyProjectAction(type, actionPayload, { ...runtime, dataRef: data, genId, normalizeProjectStatus, createProjectWithLinkedFixedThought, applyProjectDisplayName, resolveProjectByRef, getProjectStoredStatus, findProjectByRef, syncFixedThoughtFromLinkedProject, archiveProjectState, restoreProjectState, ensureContextBlocks, buildBlockFromAIAction, normalizeAIItemText, shouldWriteProjectActionIntoBlocks, ensureProjectItems, findContextBlockByRef, inferListStyleFromText, isIndentableBlockType, findProjectReferenceByRef, unlinkProjectFromFixedThought, promptQuestion, })
        : (() => { const actionType = String(type || '').trim(); const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {}; const dataRef = runtime.dataRef && typeof runtime.dataRef === 'object' ? runtime.dataRef : data; if (!actionType || !dataRef) return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (actionType === 'create_project') { const name = String(action.name || '').trim(); if (!name) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const nowIso = new Date().toISOString(); const normalizedStatus = normalizeProjectStatus(action.status || '') || 'active'; const result = typeof createProjectWithLinkedFixedThought === 'function' ? createProjectWithLinkedFixedThought(name, { description: String(action.description || '').trim(), bodyText: String(action.bodyText || action.content || '').trim(), }) : (() => { const id = genId(); const project = { id, name, items: [], blocks: [{ id: genId(), type: 'p', content: '', checked: false }], createdAt: new Date().toISOString() }; dataRef.projects.unshift(project); return { project }; })(); if (!result?.project) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; result.project.status = normalizedStatus; result.project.updatedAt = nowIso; if (normalizedStatus === 'archived') result.project.archivedAt = nowIso; else delete result.project.archivedAt; return { handled: true, changed: true, appliedLabels: [`新建项目：${result.project.name}`], createdItems: [{ tab: 'project', id: result.project.id, text: result.project.name }], actionRuntimeMeta: { actionResult: { entity: 'project', entityId: String(result.project.id || '').trim(), status: normalizedStatus, updatedAt: nowIso, } }, }; } if (actionType === 'update_project_status') { const project = resolveProjectByRef(action); const nextStatus = normalizeProjectStatus(action.status || ''); if (!project || !nextStatus) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const previousStatus = getProjectStoredStatus(project) || 'active'; const nowIso = new Date().toISOString(); project.status = nextStatus; project.updatedAt = nowIso; if (nextStatus === 'archived') project.archivedAt = nowIso; else delete project.archivedAt; return { handled: true, changed: true, appliedLabels: [`${nextStatus === 'archived' ? '归档项目' : '恢复项目'}：${project.name}`], createdItems: [{ tab: 'project', id: project.id, text: project.name, status: nextStatus, oldStatus: previousStatus }], actionRuntimeMeta: { actionResult: { entity: 'project', entityId: String(project.id || '').trim(), oldStatus: previousStatus, newStatus: nextStatus, status: nextStatus, updatedAt: nowIso, } }, }; } if (actionType === 'create_routine') { const name = String(action.name || '').trim(); if (!name) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const id = genId(); dataRef.routines.unshift({ id, name, items: [], blocks: [{ id: genId(), type: 'p', content: '', checked: false }] }); return { handled: true, changed: true, appliedLabels: [`新建节律：${name}`], createdItems: [{ tab: 'routine', id, text: name }], actionRuntimeMeta: null, }; } if (actionType === 'rename_project') { const project = findProjectByRef(action); const newName = String(action.newName || '').trim(); if (!project || !newName) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (typeof applyProjectDisplayName === 'function') applyProjectDisplayName(project, newName, { syncHtml: false }); else { project.name = newName; if (typeof syncFixedThoughtFromLinkedProject === 'function') syncFixedThoughtFromLinkedProject(project, { syncHtml: false }); } return { handled: true, changed: true, appliedLabels: [`重命名项目：${project.name}`], createdItems: [], actionRuntimeMeta: null, }; } if (actionType === 'append_project_block') { const project = findProjectByRef(action); const content = String(action.content || '').trim(); if (!project || !content) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; ensureContextBlocks(project).push(buildBlockFromAIAction(action)); return { handled: true, changed: true, appliedLabels: [`项目追加块：${project.name}`], createdItems: [{ tab: 'project', id: project.id, text: project.name, target: 'blocks' }], actionRuntimeMeta: null, }; } if (actionType === 'add_project_reference') { const project = findProjectByRef(action); const text = normalizeAIItemText(action.text || ''); if (!project || !text) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (shouldWriteProjectActionIntoBlocks(promptQuestion, action)) { ensureContextBlocks(project).push(buildBlockFromAIAction({ ...action, type: 'append_project_block', content: text, blockType: action.blockType || 'p', })); return { handled: true, changed: true, appliedLabels: [`项目内容：${project.name}`], createdItems: [{ tab: 'project', id: project.id, text: project.name, target: 'blocks' }], actionRuntimeMeta: null, }; } ensureProjectItems(project).unshift({ id: genId(), text, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }); return { handled: true, changed: true, appliedLabels: [`项目条目：${project.name}`], createdItems: [{ tab: 'project', id: project.id, text: project.name, target: 'references' }], actionRuntimeMeta: null, }; } if (actionType === 'update_project_block') { const project = findProjectByRef(action); const newContent = String(action.newContent || action.content || '').trim(); if (!project || !newContent) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const block = findContextBlockByRef(project, action); if (!block) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const inferred = inferListStyleFromText(newContent); block.type = ['p', 'todo', 'h1', 'h2', 'h3', 'bullet', 'number'].includes(action.blockType) ? action.blockType : inferred.type; block.content = inferred.content; if (block.type === 'todo') block.checked = Object.prototype.hasOwnProperty.call(action, 'checked') ? !!action.checked : !!inferred.checked; if (block.type !== 'todo') delete block.checked; if (isIndentableBlockType(block.type)) block.indent = Math.max(0, Number(action.indent) || 0); else delete block.indent; delete block.html; return { handled: true, changed: true, appliedLabels: [`更新项目块：${project.name}`], createdItems: [], actionRuntimeMeta: null, }; } if (actionType === 'delete_project_block') { const project = findProjectByRef(action); if (!project) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const blocks = ensureContextBlocks(project); const block = findContextBlockByRef(project, action); if (!block) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const idx = blocks.findIndex((entry) => String(entry?.id || '') === String(block.id || '')); if (idx < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; blocks.splice(idx, 1); if (!blocks.length) blocks.push({ id: genId(), type: 'p', content: '', checked: false }); return { handled: true, changed: true, appliedLabels: [`删除项目块：${project.name}`], createdItems: [], actionRuntimeMeta: null, }; } if (actionType === 'update_project_reference') { const project = findProjectByRef(action); const newText = normalizeAIItemText(action.newText || action.text || ''); if (!project || !newText) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const item = findProjectReferenceByRef(project, action); if (!item) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; item.text = newText; item.time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); return { handled: true, changed: true, appliedLabels: [`更新项目条目：${project.name}`], createdItems: [], actionRuntimeMeta: null, }; } if (actionType === 'delete_project_reference') { const project = findProjectByRef(action); if (!project) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const items = ensureProjectItems(project); const item = findProjectReferenceByRef(project, action); if (!item) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const idx = items.findIndex((entry) => String(entry?.id || '') === String(item.id || '')); if (idx < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; items.splice(idx, 1); return { handled: true, changed: true, appliedLabels: [`删除项目条目：${project.name}`], createdItems: [], actionRuntimeMeta: null, }; } if (actionType === 'delete_project') { const project = findProjectByRef(action); if (!project) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const idx = dataRef.projects.findIndex((entry) => String(entry?.id || '') === String(project.id || '')); if (idx < 0) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; if (typeof unlinkProjectFromFixedThought === 'function') unlinkProjectFromFixedThought(project); dataRef.projects.forEach((entry) => { if (String(entry?.parentProjectId || '').trim() === String(project.id || '').trim()) delete entry.parentProjectId; }); dataRef.projects.splice(idx, 1); return { handled: true, changed: true, appliedLabels: [`删除项目：${project.name}`], createdItems: [], actionRuntimeMeta: null, }; } return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; })();
    const actionUndoRuntime = typeof getAIActionUndoRuntimeModules === 'function' ? getAIActionUndoRuntimeModules() : null;
    const applyUndoAction = async (type = '', actionPayload = {}, runtime = {}) => actionUndoRuntime && typeof actionUndoRuntime.applyUndoAction === 'function'
        ? actionUndoRuntime.applyUndoAction(type, actionPayload, { ...runtime, undoLastMorphActionTransaction, undoLastChange, })
        : (() => { const actionType = String(type || '').trim(); const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {}; if (!actionType) return Promise.resolve({ handled: false, changed: false, appliedLabels: [], createdItems: [], blockedLabel: '', blockedReason: '', performedTransactionUndo: false, actionRuntimeMeta: null }); if (actionType === 'undo_log_or_reminder_change') return undoLastMorphActionTransaction({ domainFilter: ['daily', 'reminders', 'routines'], sourceFilter: ['ai'] }).then((undone) => { if (undone.ok) return { handled: true, changed: true, appliedLabels: [`撤销成功：${undone.summary}`], createdItems: [], blockedLabel: '', blockedReason: '', performedTransactionUndo: true, actionRuntimeMeta: undone.actionRuntimeMeta && typeof undone.actionRuntimeMeta === 'object' ? undone.actionRuntimeMeta : null }; const fallbackUndone = undoLastChange(); if (fallbackUndone) return { handled: true, changed: true, appliedLabels: ['撤销成功：最近一次变更'], createdItems: [], blockedLabel: '', blockedReason: '', performedTransactionUndo: true, actionRuntimeMeta: null }; return { handled: true, changed: false, appliedLabels: [], createdItems: [], blockedLabel: undone.reason ? '撤销失败：日志或提醒变更' : '', blockedReason: String(undone.reason || '').trim(), performedTransactionUndo: false, actionRuntimeMeta: null }; }); if (actionType === 'undo_last_ai_transaction') { const targetActionTypes = Array.isArray(action.targetActionTypes) ? action.targetActionTypes.map((item) => String(item || '').trim()).filter(Boolean) : []; const targetTransactionId = String(action.targetTransactionId || '').trim(); return undoLastMorphActionTransaction({ sourceFilter: ['ai'], transactionIdFilter: targetTransactionId || '', actionTypeFilter: targetActionTypes.length ? targetActionTypes : null, }).then((undone) => !undone.ok ? ({ handled: true, changed: false, appliedLabels: [], createdItems: [], blockedLabel: '撤销失败：最近一次 AI 操作', blockedReason: undone.reason || (targetActionTypes.length ? '当前没有可撤销的对应操作。' : '当前没有可撤销的 AI 操作。'), performedTransactionUndo: false, actionRuntimeMeta: null, }) : ({ handled: true, changed: true, appliedLabels: [`撤销成功：${undone.summary}`], createdItems: [], blockedLabel: '', blockedReason: '', performedTransactionUndo: true, actionRuntimeMeta: undone.actionRuntimeMeta && typeof undone.actionRuntimeMeta === 'object' ? undone.actionRuntimeMeta : null, })); } if (actionType === 'undo_last_external_sync') return undoLastMorphActionTransaction({ sourceFilter: ['external-sync'] }).then((undone) => !undone.ok ? ({ handled: true, changed: false, appliedLabels: [], createdItems: [], blockedLabel: '撤销失败：最近一次外部同步', blockedReason: undone.reason || '当前没有可撤销的外部同步。', performedTransactionUndo: false, actionRuntimeMeta: null, }) : ({ handled: true, changed: true, appliedLabels: [`撤销成功：${undone.summary}`], createdItems: [], blockedLabel: '', blockedReason: '', performedTransactionUndo: true, actionRuntimeMeta: undone.actionRuntimeMeta && typeof undone.actionRuntimeMeta === 'object' ? undone.actionRuntimeMeta : null, })); if (actionType === 'undo_last_manual_transaction') return undoLastMorphActionTransaction({ sourceFilter: ['manual'] }).then((undone) => !undone.ok ? ({ handled: true, changed: false, appliedLabels: [], createdItems: [], blockedLabel: '撤销失败：最近一次手动操作', blockedReason: undone.reason || '当前没有可撤销的手动操作。', performedTransactionUndo: false, actionRuntimeMeta: null, }) : ({ handled: true, changed: true, appliedLabels: [`撤销成功：${undone.summary}`], createdItems: [], blockedLabel: '', blockedReason: '', performedTransactionUndo: true, actionRuntimeMeta: undone.actionRuntimeMeta && typeof undone.actionRuntimeMeta === 'object' ? undone.actionRuntimeMeta : null, })); return Promise.resolve({ handled: false, changed: false, appliedLabels: [], createdItems: [], blockedLabel: '', blockedReason: '', performedTransactionUndo: false, actionRuntimeMeta: null }); })();
    const actionVisualRuntime = typeof getAIActionVisualRuntimeModules === 'function' ? getAIActionVisualRuntimeModules() : null;
    const applyVisualAction = (type = '', actionPayload = {}, runtime = {}) => actionVisualRuntime && typeof actionVisualRuntime.applyVisualAction === 'function'
        ? actionVisualRuntime.applyVisualAction(type, actionPayload, { ...runtime, upsertVisualOrganizerDraft, setExtensionEnabled, visualOrganizerPluginId: VISUAL_ORGANIZER_PLUGIN_ID, })
        : (() => { const actionType = String(type || '').trim(); const action = actionPayload && typeof actionPayload === 'object' ? actionPayload : {}; const prompt = String(runtime.promptQuestion || '').trim(); if (actionType !== 'create_visual_organizer') return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; const organizer = upsertVisualOrganizerDraft({ ...action, source: String(action.source || 'ai-chat').trim() || 'ai-chat', }, { prompt: String(action.prompt || action.question || prompt || '').trim(), templateKey: String(action.templateKey || action.organizerType || action.typeKey || '').trim(), save: false, skipRender: true, }); if (!organizer) return { handled: true, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null }; setExtensionEnabled(VISUAL_ORGANIZER_PLUGIN_ID, true, { silent: true }); return { handled: true, changed: true, appliedLabels: [`新增视觉组织图：${organizer.title}`], createdItems: [{ tab: 'visualOrganizer', id: organizer.id, text: organizer.title }], actionRuntimeMeta: null, }; })();
    const applyPluginBuilderAction = async (type = '', actionPayload = {}, runtime = {}) => {
        void actionPayload;
        void runtime;
        const actionType = String(type || '').trim();
        if (!['create_and_install_plugin', 'implement_existing_plugin_source'].includes(actionType)) return { handled: false, changed: false, appliedLabels: [], createdItems: [], actionRuntimeMeta: null };
        return {
            handled: true,
            changed: false,
            appliedLabels: [],
            createdItems: [],
            blockedLabel: actionType === 'implement_existing_plugin_source' ? '已停用插件内建实现' : '已停用插件内建生成',
            blockedReason: 'Morpheus 当前不再直接生成或补全插件源码。请改由外部第三方 AI agent 按现有插件规范完成。',
            actionRuntimeMeta: null,
        };
    };
    const thoughtActionTypes = new Set(['add_flash_thought', 'add_fixed_thought', 'group_flash_thoughts', 'delete_fixed_thought']);
    const expenseActionTypes = new Set(['add_expense_record', 'update_expense_record', 'delete_expense_record', 'undo_last_expense_record']);
    const projectActionTypes = new Set(['create_project', 'update_project_status', 'create_routine', 'rename_project', 'append_project_block', 'add_project_reference', 'update_project_block', 'delete_project_block', 'update_project_reference', 'delete_project_reference', 'delete_project']);
    const dailyActionTypes = new Set(['append_daily_log', 'append_daily_log_under_date', 'delete_daily_log_entry', 'update_daily_log_entry', 'summarize_today_to_daily_log']);
    const reminderActionTypes = new Set(['add_reminder', 'delete_reminder', 'update_reminder']);
    const undoActionTypes = new Set(['undo_log_or_reminder_change', 'undo_last_ai_transaction', 'undo_last_external_sync', 'undo_last_manual_transaction']);
    const planningActionTypes = new Set(['plan_week_schedule_draft', 'plan_today_time_blocks']);
    const thoughtTransformActionTypes = new Set(['move_flash_to_fixed', 'move_fixed_to_project', 'move_flash_to_project_reference', 'ungroup_flash_thoughts', 'merge_flash_thoughts', 'dedupe_flash_thoughts', 'dedupe_project_references', 'create_project_from_flash_group']);
    const memoryActionTypes = new Set(['memory_write_user', 'memory_rewrite_section', 'write_soul_memory', 'self_update_runtime_rules', 'trigger_proactive_scan']);
    const pluginBuilderActionTypes = new Set(['create_and_install_plugin', 'implement_existing_plugin_source']);
    for (const rawAction of actions) {
      try {
        if (!rawAction || typeof rawAction !== 'object') continue;
        const actionType = String(rawAction.type || '').trim();
        if (disabledActions.has(actionType)) {
            actionExecutionTrace.push({
                type: actionType,
                ...buildActionSkillMeta(actionType),
                status: 'blocked_boundary',
                verifierStatus: 'not_run',
                message: '当前动作属于默认禁用范围。',
                requestId: '',
                candidate: {},
                boundary: buildActionBoundary(actionType, { action: actionType, consentTier: 'disabled', permissionLevel: 'update', riskLevel: 'medium', }, { allowed: false, reason: 'disabled' }),
                promptQuestion,
                transactionId: '',
                hydratedFields: [],
            });
            blockedLabels.push(`默认禁用动作：${actionType}`);
            buildBlockedReason();
            continue;
        }
        const hydrated = hydrateStructuredActionSlots(actionType, rawAction, { promptQuestion });
        let action = hydrated?.action && typeof hydrated.action === 'object' ? hydrated.action : rawAction;
        const hydratedFields = Array.isArray(hydrated?.hydratedFields) ? hydrated.hydratedFields : [];
        const actionPolicy = resolveActionExecutionPolicy(actionType);
        const actionCandidate = buildActionCandidate(actionType, action, { promptQuestion, source: 'ai', actor: 'ai' }, actionPolicy);
        if (actionPolicy.consentTier === 'disabled') {
            actionExecutionTrace.push({
                type: actionType,
                ...buildActionSkillMeta(actionType),
                status: 'blocked_boundary',
                verifierStatus: 'not_run',
                message: '当前动作属于默认禁用范围。',
                requestId: actionCandidate.requestId,
                candidate: actionCandidate,
                boundary: buildActionBoundary(actionType, actionPolicy, { allowed: false, reason: 'disabled' }),
                promptQuestion,
                transactionId: '',
                hydratedFields,
            });
            blockedLabels.push(`默认禁用动作：${actionType}`);
            buildBlockedReason();
            continue;
        }
        const baseBoundary = buildActionBoundary(actionType, actionPolicy, { allowed: true });
        const gateResult = actionGateRuntime && typeof actionGateRuntime.evaluateActionCommitGate === 'function' ? actionGateRuntime.evaluateActionCommitGate({ actionType, action, actionPolicy, actionCandidate, promptQuestion, hydratedFields, permissionRuntime, dominantMode, actionBias, explicitWriteIntent, explicitMemoryWriteIntent, implicitMemoryWriteIntent, explicitRuntimeWriteIntent, strongDataOperationIntent, hasPendingDataIntent, followupExecutionConfirmation, terseExpenseCaptureIntent, allowMorphDataActions: context.allowMorphDataActions === true, exposeRawActionFailures, buildMorphDevActionVisibleMessage, buildActionBoundary, }) : (actionPolicy.permissionLevel === 'read' || matchesActionIntent(actionType) ? { status: 'ok', commitDecision: { allowed: true, reasonCode: '' } } : { status: 'blocked_commit', blockedLabel: `暂未执行：${actionType}`, blockedReason: exposeRawActionFailures ? buildMorphDevActionVisibleMessage('blocked_boundary', actionType, 'intent-threshold-not-met') : '这次先不自动写入；你再用平常话补一句要做什么即可。', traceEntry: { type: actionType, ...buildActionSkillMeta(actionType), status: 'blocked_boundary', reasonCode: 'intent-threshold-not-met', verifierStatus: 'not_run', message: exposeRawActionFailures ? buildMorphDevActionVisibleMessage('blocked_boundary', actionType, 'intent-threshold-not-met') : '这次先不自动写入；你再用平常话补一句要做什么即可。', requestId: actionCandidate.requestId, candidate: actionCandidate, boundary: buildActionBoundary(actionType, actionPolicy, { allowed: false, reason: 'intent-threshold-not-met' }), promptQuestion, transactionId: '', hydratedFields, }, });
        if (gateResult && gateResult.status === 'blocked_commit') {
            if (gateResult.traceEntry && typeof gateResult.traceEntry === 'object') actionExecutionTrace.push(gateResult.traceEntry);
            if (String(gateResult.blockedLabel || '').trim()) blockedLabels.push(String(gateResult.blockedLabel || '').trim());
            blockedReason = String(gateResult.blockedReason || '').trim() || buildBlockedReason();
            setFailureSemantic({
                kind: 'blocked',
                stage: 'gate',
                code: String(gateResult?.commitDecision?.reasonCode || gateResult?.traceEntry?.reasonCode || 'intent-threshold-not-met').trim() || 'intent-threshold-not-met',
                message: blockedReason,
            });
            continue;
        }
        const actionPrecheckRuntime = typeof getAIActionPrecheckRuntimeModules === 'function' ? getAIActionPrecheckRuntimeModules() : null;
        const precheck = actionPrecheckRuntime && typeof actionPrecheckRuntime.evaluateActionNormalizationAndValidation === 'function'
            ? actionPrecheckRuntime.evaluateActionNormalizationAndValidation({
                actionType,
                action,
                actionCandidate,
                baseBoundary,
                promptQuestion,
                hydratedFields,
                normalizeAction,
                validateAction,
                buildStructuredConfirmationReason,
                exposeRawActionFailures,
                source: 'ai',
            })
            : null;
        if (precheck && precheck.status && precheck.status !== 'ok') {
            if (precheck.traceEntry && typeof precheck.traceEntry === 'object') actionExecutionTrace.push(precheck.traceEntry);
            if (String(precheck.blockedLabel || '').trim()) blockedLabels.push(String(precheck.blockedLabel || '').trim());
            if (precheck.status === 'blocked_validation') blockedReason = String(precheck.blockedReason || '').trim() || buildBlockedReason();
            else blockedReason = String(precheck.blockedReason || '').trim();
            setFailureSemantic({
                kind: precheck.status === 'needs_confirmation' ? 'needs_confirmation' : 'blocked',
                stage: 'precheck',
                code: String(precheck.traceEntry?.reasonCode || precheck.status || '').trim() || 'precheck-blocked',
                message: blockedReason,
            });
            continue;
        }
        if (precheck && precheck.status === 'ok') action = precheck.action && typeof precheck.action === 'object' ? precheck.action : action;
        const actionNormalization = (precheck && precheck.status === 'ok' && precheck.normalization && typeof precheck.normalization === 'object')
          ? precheck.normalization
          : { entity: '', targetDate: '', normalizedPayload: {} };
        const candidateDomains = getMorphActionTransactionDomainsForAction(actionType, action);
        const transactionRuntime = typeof getAIActionTransactionRuntimeModules === 'function' ? getAIActionTransactionRuntimeModules() : null;
        const snapshotResult = transactionRuntime && typeof transactionRuntime.captureActionTransactionDomainSnapshots === 'function'
            ? transactionRuntime.captureActionTransactionDomainSnapshots(candidateDomains, { captureDomain: captureMorphActionTransactionDomain, clone: cloneJSONSafe, dataRef: data, transactionBeforeDomains, })
            : null;
        const actionBeforeDomains = snapshotResult && snapshotResult.actionBeforeDomains && typeof snapshotResult.actionBeforeDomains === 'object'
            ? snapshotResult.actionBeforeDomains
            : (() => { const fallback = {}; (Array.isArray(candidateDomains) ? candidateDomains : []).forEach((domain) => { if (!domain) return; const snapshot = captureMorphActionTransactionDomain(domain, data); fallback[domain] = snapshot; if (Object.prototype.hasOwnProperty.call(transactionBeforeDomains, domain)) return; transactionBeforeDomains[domain] = cloneJSONSafe(snapshot); }); return fallback; })();
        const beforeChanged = changed;
        const beforeAppliedCount = appliedLabels.length;
        const beforeCreatedCount = createdItems.length;
        let actionRuntimeMeta = null;
        const mergeActionResult = (result, { allowUnchanged = false, trackUndo = false } = {}) => {
            if (!result || result.handled !== true) return false;
            if (result.actionRuntimeMeta && typeof result.actionRuntimeMeta === 'object') {
                const runtimeMeta = result.actionRuntimeMeta;
                const nextPostPersistTasks = Array.isArray(runtimeMeta.postPersistTasks)
                    ? runtimeMeta.postPersistTasks.filter((task) => typeof task === 'function')
                    : [];
                const restoredDomains = Array.isArray(runtimeMeta.restoredDomains)
                    ? runtimeMeta.restoredDomains.map((item) => String(item || '').trim()).filter(Boolean)
                    : [];
                if (nextPostPersistTasks.length) pendingPostPersistTasks.push(...nextPostPersistTasks);
                if (restoredDomains.length) {
                    restoredDomains.forEach((domain) => {
                        committedDomains.add(domain);
                    });
                }
                const { postPersistTasks, ...restRuntimeMeta } = runtimeMeta;
                void postPersistTasks;
                if (Object.keys(restRuntimeMeta).length) actionRuntimeMeta = restRuntimeMeta;
            }
            if (Array.isArray(result.appliedLabels) && result.appliedLabels.length) appliedLabels.push(...result.appliedLabels);
            if (Array.isArray(result.createdItems) && result.createdItems.length) createdItems.push(...result.createdItems);
            if (trackUndo && result.performedTransactionUndo === true) performedTransactionUndo = true;
            if (String(result.blockedLabel || '').trim()) blockedLabels.push(String(result.blockedLabel || '').trim());
            if (String(result.blockedReason || '').trim()) {
                blockedReason = String(result.blockedReason || '').trim();
                setFailureSemantic({
                    kind: result.handled === true && result.changed === false ? 'blocked' : 'failed',
                    stage: 'execution',
                    code: 'action-handler-blocked',
                    message: blockedReason,
                });
            }
            if (result.changed) changed = true;
            return allowUnchanged ? true : result.changed === true;
        };
        const applyStructuredActionByType = async (type = '') => {
            const nextType = String(type || '').trim();
            if (!nextType) return false;
            if (thoughtActionTypes.has(nextType)) {
                const thoughtRuntime = typeof getAIActionThoughtRuntimeModules === 'function' ? getAIActionThoughtRuntimeModules() : null;
                const thoughtResult = thoughtRuntime && typeof thoughtRuntime.applyThoughtAction === 'function'
                    ? thoughtRuntime.applyThoughtAction(nextType, action, { dataRef: data, genId, findFixedThoughtByRef, deleteFixedThoughtKeepingProjectCoverage, applyAIFlashThoughtGrouping })
                    : null;
                return mergeActionResult(thoughtResult);
            }
            if (expenseActionTypes.has(nextType)) return mergeActionResult(applyExpenseAction(nextType, action, { dataRef: data }));
            if (nextType === 'create_visual_organizer') return mergeActionResult(applyVisualAction(nextType, action, { promptQuestion }));
            if (projectActionTypes.has(nextType)) return mergeActionResult(applyProjectAction(nextType, action, { dataRef: data, promptQuestion }));
            if (dailyActionTypes.has(nextType)) return mergeActionResult(applyDailyAction(nextType, action, { dataRef: data }));
            if (reminderActionTypes.has(nextType)) return mergeActionResult(applyReminderAction(nextType, action, { dataRef: data }));
            if (undoActionTypes.has(nextType)) return mergeActionResult(await applyUndoAction(nextType, action, {}), { allowUnchanged: true, trackUndo: true });
            if (planningActionTypes.has(nextType)) return mergeActionResult(applyPlanningAction(nextType, action, { dataRef: data }));
            if (thoughtTransformActionTypes.has(nextType)) return mergeActionResult(applyThoughtTransformAction(nextType, action, { dataRef: data }));
            if (memoryActionTypes.has(nextType)) return mergeActionResult(applyMemoryAction(nextType, action, { dataRef: data }), { allowUnchanged: true });
            if (pluginBuilderActionTypes.has(nextType)) {
                actionExecutionTrace.push({
                    type: nextType,
                    ...buildActionSkillMeta(nextType),
                    status: 'blocked_boundary',
                    verifierStatus: 'not_run',
                    message: 'Morpheus 当前不再直接生成或补全插件源码。请改由外部第三方 AI agent 按现有插件规范完成。',
                    requestId: actionCandidate.requestId,
                    candidate: actionCandidate,
                    boundary: buildActionBoundary(nextType, { ...actionPolicy, consentTier: 'disabled' }, { allowed: false, reason: 'disabled' }),
                    promptQuestion,
                    transactionId: '',
                    hydratedFields,
                });
                return mergeActionResult(await applyPluginBuilderAction(nextType, action, { dataRef: data, currentPluginId: String(context.currentPluginId || '').trim(), currentAIConfig: context.currentAIConfig && typeof context.currentAIConfig === 'object' ? context.currentAIConfig : buildCurrentAIExecutionConfig(), }), { allowUnchanged: true });
            }
            return false;
        };
        await applyStructuredActionByType(action.type);
        const actionProducedMutation = changed !== beforeChanged || appliedLabels.length > beforeAppliedCount || createdItems.length > beforeCreatedCount;
        let verification = { ok: true };
        let actionReceipt = null;
        const actionPostcheckRuntime = typeof getAIActionPostcheckRuntimeModules === 'function' ? getAIActionPostcheckRuntimeModules() : null;
        const postcheck = actionPostcheckRuntime && typeof actionPostcheckRuntime.evaluateActionPostcheck === 'function'
            ? actionPostcheckRuntime.evaluateActionPostcheck({ actionProducedMutation, actionType, action, actionRuntimeMeta, createdItems, beforeCreatedCount, appliedLabels, beforeAppliedCount, verifyStructuredActionOutcome, buildActionReceiptFromVerification, actionPolicy, buildStructuredConfirmationReason, })
            : (() => { if (actionProducedMutation) { const nextVerification = verifyStructuredActionOutcome(actionType, action, { createdItemsDelta: createdItems.slice(beforeCreatedCount), appliedLabelsDelta: appliedLabels.slice(beforeAppliedCount), actionResult: actionRuntimeMeta?.actionResult || null, }); if (!nextVerification?.ok) return { status: 'blocked_verification', verification: nextVerification, actionReceipt: null, blockedReason: String(nextVerification?.userMessage || '').trim() || '这次动作没有通过执行验证，我先没有把它当作成功写入。', }; return { status: 'ok', verification: nextVerification, actionReceipt: buildActionReceiptFromVerification(actionType, action, nextVerification, { actionResult: actionRuntimeMeta?.actionResult || null, summary: String(appliedLabels[beforeAppliedCount] || appliedLabels[appliedLabels.length - 1] || actionType).trim(), }), blockedReason: '', }; } if (actionPolicy.consentTier === 'architect-required') { const confirmationReason = buildStructuredConfirmationReason(actionType, action); if (confirmationReason) return { status: 'needs_confirmation', verification: { ok: true }, actionReceipt: null, blockedReason: String(confirmationReason || '').trim(), }; } return { status: 'ok', verification: { ok: true }, actionReceipt: null, blockedReason: '', }; })();
        verification = postcheck?.verification && typeof postcheck.verification === 'object' ? postcheck.verification : { ok: true };
        actionReceipt = postcheck?.actionReceipt && typeof postcheck.actionReceipt === 'object' ? postcheck.actionReceipt : null;
        if (postcheck && postcheck.status === 'blocked_verification') {
            await restoreActionDomains(actionBeforeDomains);
            appliedLabels.length = beforeAppliedCount;
            createdItems.length = beforeCreatedCount;
            changed = beforeChanged;
            actionExecutionTrace.push(buildBlockedVerificationTraceEntry({ actionType, action, actionCandidate, verification, normalization: actionNormalization, baseBoundary, promptQuestion, }));
            blockedLabels.push(`执行验证失败：${actionType}`);
            blockedReason = String(postcheck.blockedReason || '').trim() || verification.userMessage || '这次动作没有通过执行验证，我先没有把它当作成功写入。';
            setFailureSemantic({
                kind: 'verification_failed',
                stage: 'postcheck',
                code: 'postcheck-verification-failed',
                message: blockedReason,
                overwrite: true,
            });
            continue;
        }
        if (postcheck && postcheck.status === 'needs_confirmation') {
            actionExecutionTrace.push(buildNeedsConfirmationTraceEntry({ actionType, action, actionCandidate, postcheck, normalization: actionNormalization, baseBoundary, promptQuestion, hydratedFields, }));
            blockedLabels.push(`目标待确认：${actionType}`);
            blockedReason = String(postcheck.blockedReason || '').trim();
            setFailureSemantic({
                kind: 'needs_confirmation',
                stage: 'postcheck',
                code: 'confirmation-required',
                message: blockedReason,
                overwrite: true,
            });
            continue;
        }
        const actionCommitted = shouldActionMutationRecordTransaction({
            actionType,
            actionRuntimeMeta,
            actionProducedMutation,
        });
        if (actionCommitted) {
            committedActions.push(cloneJSONSafe(action));
            committedActionTypes.push(actionType);
            if (actionReceipt) committedReceipts.push(actionReceipt);
            candidateDomains.forEach((domain) => {
                if (domain) committedDomains.add(domain);
            });
        }
        if (actionProducedMutation) {
            actionExecutionTrace.push(buildCommittedTraceEntry({
                actionType,
                action,
                actionCandidate,
                actionReceipt,
                verification,
                normalization: actionNormalization,
                baseBoundary,
                promptQuestion,
                hydratedFields,
                actionRuntimeMeta,
                mutationLayer: String(actionRuntimeMeta?.mutationLayer || '').trim() || 'canonical',
                transactionCommitted: actionCommitted,
            }));
        }
      } catch (actionErr) {
        console.error('[Morpheus] action execution error for', String(rawAction?.type || ''), ':', actionErr?.message || actionErr);
        blockedLabels.push(`执行异常：${String(rawAction?.type || 'unknown')}`);
        blockedReason = blockedReason || '动作执行中遇到了内部错误，未能写入。请重试。';
        setFailureSemantic({
            kind: 'failed',
            stage: 'execution',
            code: 'action-runtime-exception',
            message: blockedReason,
            overwrite: true,
        });
      }
    }
    const actionCommitRuntime = typeof getAIActionCommitRuntimeModules === 'function' ? getAIActionCommitRuntimeModules() : null;
    const commitResult = actionCommitRuntime && typeof actionCommitRuntime.finalizeActionCommit === 'function'
        ? actionCommitRuntime.finalizeActionCommit({ changed, committedActions, committedActionTypes, committedDomains, committedReceipts, actionExecutionTrace, appliedLabels, createdItems, promptQuestion, transactionBeforeDomains, transactionBeforeView, resolveActionExecutionPolicy, recordMorphActionTransaction, ensureRuntimeShape, sanitizeActionTransactions, dataRef: data, mergeSyncEntityRefs, buildSyncEntityRefsFromReceipts, buildSyncEntityRefsFromCreatedItems, protectRecentCommittedData, setLastUserEditAt, bumpUISessionLock, saveData, currentTab, performedTransactionUndo, postPersistTasks: pendingPostPersistTasks, })
        : null;
    if (commitResult && typeof commitResult === 'object') {
        const commitBlockedReason = String(commitResult.blockedReason || '').trim();
        if (commitResult.morphActionExecutionFailed === true || commitBlockedReason) {
            const failureReason = commitBlockedReason || '应用在执行写入动作时发生了内部错误（与 AI 服务商无关）。请重试一次；若持续出现请反馈。';
            const normalizedFailureKind = String(commitResult.failureKind || '').trim() || 'failed';
            const normalizedFailureStage = String(commitResult.failureStage || '').trim() || 'commit';
            const normalizedFailureCode = String(commitResult.failureCode || '').trim() || 'canonical-commit-failed';
            const normalizedFailureMessage = String(commitResult.failureMessage || '').trim() || failureReason;
            await restoreActionDomains(transactionBeforeDomains);
            applyMorphActionTransactionViewState(transactionBeforeView);
            try {
                if (typeof renderAll === 'function') renderAll({ forceManagedBlockEditors: true });
            } catch (_) {}
            const failedTrace = actionExecutionTrace.map((entry) => {
                if (!isFormalCommittedTraceEntry(entry)) return entry;
                const nextReceipt = entry.receipt && typeof entry.receipt === 'object'
                    ? { ...entry.receipt, verifierStatus: 'failed', transactionHandle: '' }
                    : entry.receipt;
                return {
                    ...entry,
                    status: 'failed',
                    verifierStatus: 'failed',
                    message: failureReason,
                    transactionId: '',
                    receipt: nextReceipt,
                };
            });
            return {
                appliedLabels: [],
                createdItems: [],
                blockedLabels: blockedLabels.length ? blockedLabels : ['执行失败：核心提交未完成'],
                blockedReason: failureReason,
                actionExecutionTrace: failedTrace,
                transactionId: '',
                writeReceipt: null,
                commitReceipt: null,
                morphActionExecutionFailed: normalizedFailureKind === 'failed',
                failureKind: normalizedFailureKind,
                failureStage: normalizedFailureStage,
                failureCode: normalizedFailureCode,
                failureMessage: normalizedFailureMessage,
                needsConfirmation: normalizedFailureKind === 'needs_confirmation',
            };
        }
        return {
            appliedLabels,
            createdItems,
            blockedLabels,
            blockedReason,
            actionExecutionTrace,
            transactionId: String(commitResult.transactionId || '').trim(),
            writeReceipt: commitResult.writeReceipt && typeof commitResult.writeReceipt === 'object' ? commitResult.writeReceipt : null,
            commitReceipt: commitResult.commitReceipt && typeof commitResult.commitReceipt === 'object'
                ? commitResult.commitReceipt
                : (commitResult.writeReceipt && typeof commitResult.writeReceipt === 'object' ? commitResult.writeReceipt : null),
            morphActionExecutionFailed: false,
            failureKind: String(commitResult.failureKind || '').trim(),
            failureStage: String(commitResult.failureStage || '').trim(),
            failureCode: String(commitResult.failureCode || '').trim(),
            failureMessage: String(commitResult.failureMessage || '').trim(),
            needsConfirmation: commitResult.needsConfirmation === true,
        };
    }
    let committedTransaction = null;
    if (changed && committedActions.length && committedDomains.size) committedTransaction = recordMorphActionTransaction({ promptQuestion, actions: committedActions, actionTypes: committedActionTypes, domains: Array.from(committedDomains), beforeDomains: transactionBeforeDomains, beforeView: transactionBeforeView, appliedLabels, createdItems, trace: actionExecutionTrace.filter((entry) => isFormalCommittedTraceEntry(entry)), receipt: committedReceipts[0] || { summary: String(appliedLabels[0] || committedActionTypes[0] || '').trim(), verifierStatus: 'verified', undoAvailable: true, }, resolveActionExecutionPolicy, });
    if (committedTransaction?.id) { actionExecutionTrace.forEach((entry) => { if (!isFormalCommittedTraceEntry(entry)) return; entry.transactionId = committedTransaction.id; if (entry.receipt && typeof entry.receipt === 'object') { entry.receipt.transactionHandle = committedTransaction.id; entry.receipt.undoAvailable = true; } }); committedReceipts.forEach((receipt) => { if (receipt && typeof receipt === 'object') { receipt.transactionHandle = committedTransaction.id; receipt.undoAvailable = true; } }); const runtime = ensureRuntimeShape(data).morphRuntime; runtime.actionTransactions = sanitizeActionTransactions((Array.isArray(runtime.actionTransactions) ? runtime.actionTransactions : []).map((entry) => (entry?.id === committedTransaction.id ? { ...entry, trace: actionExecutionTrace.filter((traceEntry) => isFormalCommittedTraceEntry(traceEntry)), receipt: { ...(entry.receipt || {}), transactionHandle: committedTransaction.id, undoAvailable: true, }, } : entry))); }
    const committedEntityRefs = mergeSyncEntityRefs(buildSyncEntityRefsFromReceipts(committedReceipts), buildSyncEntityRefsFromCreatedItems(createdItems, committedActionTypes[0] || ''));
    if (changed) { if (typeof protectRecentCommittedData === 'function') protectRecentCommittedData(20000); else { setLastUserEditAt(Date.now()); if (typeof bumpUISessionLock === 'function') bumpUISessionLock(12000); } saveData({ skipRender: currentTab === 'ai', skipUndo: performedTransactionUndo, domains: Array.from(committedDomains), entityRefs: committedEntityRefs, postPersistTasks: pendingPostPersistTasks, immediatePersist: committedDomains.has('reminders') || committedDomains.has('expenseLedger') || committedDomains.has('aiMemory') || committedDomains.has('aiMemoryFull'), }); }
    const fallbackWriteReceipt = {
        type: 'structured_write',
        writer: 'MorphAIActionExecutionRuntime.applyAIActions',
        domains: Array.from(committedDomains),
        entityRefs: committedEntityRefs,
        transactionId: committedTransaction?.id || '',
        saveMode: 'data',
        immediatePersist: committedDomains.has('reminders') || committedDomains.has('expenseLedger') || committedDomains.has('aiMemory') || committedDomains.has('aiMemoryFull'),
        result: {
            status: changed ? 'committed' : 'noop',
            changed: changed === true,
            persisted: changed === true,
            transactionRecorded: !!committedTransaction?.id,
        },
    };
    return { appliedLabels, createdItems, blockedLabels, blockedReason, actionExecutionTrace, transactionId: committedTransaction?.id || '', writeReceipt: fallbackWriteReceipt, commitReceipt: fallbackWriteReceipt, morphActionExecutionFailed: false, ...buildFailureSemanticPayload() };
}

    return {
      buildMorphActionTransactionViewState,
      applyMorphActionTransactionViewState,
      buildMorphActionReceiptFromVerification,
      shouldRecordMorphActionTransactionAction,
      shouldActionMutationRecordTransaction,
      recordMorphActionTransaction,
      getLastMorphActionTransaction,
      undoLastMorphActionTransaction,
      performMorphTransactionalMutation,
      performMorphTransactionalMutationAsync,
      applyAIActions,
    };
  }

  if (typeof window !== 'undefined') {
    window.MorphAIActionExecutionRuntime = {
      create: createAIActionExecutionRuntimeModules,
    };
  }
})();
