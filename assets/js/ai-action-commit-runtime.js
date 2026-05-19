// @ts-check

(function initMorphAIActionCommitRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionCommitRuntime && typeof window.MorphAIActionCommitRuntime.create === 'function') return;

  function createAIActionCommitRuntime() {
    function toCleanString(value = '') {
      return String(value || '').trim();
    }

    function normalizeDomainList(value = []) {
      return Array.from(new Set((Array.isArray(value) ? value : []).map((item) => toCleanString(item)).filter(Boolean)));
    }

    function isFormalCommittedTraceEntry(entry = null) {
      return !!(
        entry
        && toCleanString(entry.status) === 'committed'
        && entry.transactionCommitted !== false
      );
    }

    function buildStructuredWriteReceipt({
      type = 'structured_write',
      writer = 'MorphAIActionCommitRuntime.finalizeActionCommit',
      domains = [],
      entityRefs = [],
      transactionId = '',
      saveMode = 'data',
      immediatePersist = false,
      changed = false,
      persisted = false,
      transactionRecorded = false,
    } = {}) {
      return {
        type: toCleanString(type) || 'structured_write',
        writer: toCleanString(writer) || 'MorphAIActionCommitRuntime.finalizeActionCommit',
        domains: normalizeDomainList(domains),
        entityRefs: Array.isArray(entityRefs) ? entityRefs : [],
        transactionId: toCleanString(transactionId),
        saveMode: toCleanString(saveMode) || 'data',
        immediatePersist: immediatePersist === true,
        result: {
          status: changed ? 'committed' : 'noop',
          changed: changed === true,
          persisted: persisted === true,
          transactionRecorded: transactionRecorded === true,
        },
      };
    }

    function getMorphCanonicalWriterRuntime() {
      if (typeof window === 'undefined') return null;
      const canonicalFactory = window.MorphCanonicalWriterRuntime && typeof window.MorphCanonicalWriterRuntime.create === 'function'
        ? window.MorphCanonicalWriterRuntime.create
        : null;
      if (typeof canonicalFactory === 'function') return canonicalFactory();
      const coreFactory = window.MorphCoreCommitRuntime && typeof window.MorphCoreCommitRuntime.create === 'function'
        ? window.MorphCoreCommitRuntime.create
        : null;
      if (typeof coreFactory !== 'function') return null;
      const runtime = coreFactory();
      return runtime && typeof runtime.commitMorphCoreMutation === 'function'
        ? {
            commitPatchIntent: (options = {}) => runtime.commitMorphCoreMutation(options),
            commitMorphCoreMutation: (options = {}) => runtime.commitMorphCoreMutation(options),
            hasCanonicalWriter: () => true,
          }
        : null;
    }

    function finalizeActionCommit(options = {}) {
      const changed = options.changed === true;
      const committedActions = Array.isArray(options.committedActions) ? options.committedActions : [];
      const committedActionTypes = Array.isArray(options.committedActionTypes) ? options.committedActionTypes : [];
      const committedDomains = options.committedDomains instanceof Set ? options.committedDomains : new Set(Array.isArray(options.committedDomains) ? options.committedDomains : []);
      const enforcedCanonicalDomains = new Set(['daily', 'thoughts', 'projects', 'rhythm', 'expenseLedger', 'reminders', 'aiMemory', 'aiMemoryFull']);
      const requiresCanonicalCommit = Array.from(committedDomains).some((domain) => enforcedCanonicalDomains.has(String(domain || '').trim()));
      const committedReceipts = Array.isArray(options.committedReceipts) ? options.committedReceipts : [];
      const actionExecutionTrace = Array.isArray(options.actionExecutionTrace) ? options.actionExecutionTrace : [];
      const appliedLabels = Array.isArray(options.appliedLabels) ? options.appliedLabels : [];
      const createdItems = Array.isArray(options.createdItems) ? options.createdItems : [];
      const promptQuestion = String(options.promptQuestion || '').trim();
      const transactionBeforeDomains = options.transactionBeforeDomains && typeof options.transactionBeforeDomains === 'object'
        ? options.transactionBeforeDomains
        : {};
      const transactionBeforeView = options.transactionBeforeView && typeof options.transactionBeforeView === 'object'
        ? options.transactionBeforeView
        : null;

      const recordMorphActionTransaction = typeof options.recordMorphActionTransaction === 'function'
        ? options.recordMorphActionTransaction
        : () => null;
      const resolveActionExecutionPolicy = typeof options.resolveActionExecutionPolicy === 'function'
        ? options.resolveActionExecutionPolicy
        : null;
      const ensureRuntimeShape = typeof options.ensureRuntimeShape === 'function'
        ? options.ensureRuntimeShape
        : ((target = {}) => target);
      const sanitizeActionTransactions = typeof options.sanitizeActionTransactions === 'function'
        ? options.sanitizeActionTransactions
        : ((list = []) => (Array.isArray(list) ? list : []));
      const dataRef = options.dataRef && typeof options.dataRef === 'object' ? options.dataRef : {};
      const mergeSyncEntityRefs = typeof options.mergeSyncEntityRefs === 'function' ? options.mergeSyncEntityRefs : (...groups) => groups.flat();
      const buildSyncEntityRefsFromReceipts = typeof options.buildSyncEntityRefsFromReceipts === 'function'
        ? options.buildSyncEntityRefsFromReceipts
        : () => [];
      const buildSyncEntityRefsFromCreatedItems = typeof options.buildSyncEntityRefsFromCreatedItems === 'function'
        ? options.buildSyncEntityRefsFromCreatedItems
        : () => [];
      const protectRecentCommittedData = typeof options.protectRecentCommittedData === 'function' ? options.protectRecentCommittedData : null;
      const setLastUserEditAt = typeof options.setLastUserEditAt === 'function' ? options.setLastUserEditAt : null;
      const bumpUISessionLock = typeof options.bumpUISessionLock === 'function' ? options.bumpUISessionLock : null;
      const saveData = typeof options.saveData === 'function' ? options.saveData : null;
      const postPersistTasks = Array.isArray(options.postPersistTasks)
        ? options.postPersistTasks.filter((task) => typeof task === 'function')
        : [];
      const currentTab = String(options.currentTab || '').trim();
      const performedTransactionUndo = options.performedTransactionUndo === true;
      const canonicalWriterRuntime = getMorphCanonicalWriterRuntime();
      const shouldImmediatePersist = committedDomains.has('reminders')
        || committedDomains.has('expenseLedger')
        || committedDomains.has('aiMemory')
        || committedDomains.has('aiMemoryFull');
      const committedTrace = actionExecutionTrace.filter((entry) => isFormalCommittedTraceEntry(entry));

      if (canonicalWriterRuntime && typeof canonicalWriterRuntime.commitPatchIntent === 'function') {
        const commitResult = canonicalWriterRuntime.commitPatchIntent({
          changed,
          source: 'ai',
          promptQuestion,
          actions: committedActions,
          actionTypes: committedActionTypes,
          domains: committedDomains,
          beforeDomains: transactionBeforeDomains,
          beforeView: transactionBeforeView,
          appliedLabels,
          createdItems,
          trace: committedTrace,
          receipts: committedReceipts.length
            ? committedReceipts
            : [{
              summary: String(appliedLabels[0] || committedActionTypes[0] || '').trim(),
              verifierStatus: 'verified',
              undoAvailable: false,
            }],
          resolveActionExecutionPolicy,
          recordMorphActionTransaction,
          mergeSyncEntityRefs,
          buildSyncEntityRefsFromReceipts,
          buildSyncEntityRefsFromCreatedItems,
          protectRecentCommittedData,
          setLastUserEditAt,
          bumpUISessionLock,
          saveData,
          postPersistTasks,
          currentTab,
          skipRender: currentTab === 'ai',
          skipUndo: performedTransactionUndo,
          immediatePersist: shouldImmediatePersist,
          detail: {},
          onTransactionRecorded: (committedTransaction) => {
            if (!committedTransaction?.id) return;
            actionExecutionTrace.forEach((entry) => {
              if (!isFormalCommittedTraceEntry(entry)) return;
              entry.transactionId = committedTransaction.id;
              if (entry.receipt && typeof entry.receipt === 'object') {
                entry.receipt.transactionHandle = committedTransaction.id;
                entry.receipt.undoAvailable = true;
              }
            });
            committedReceipts.forEach((receipt) => {
              if (receipt && typeof receipt === 'object') {
                receipt.transactionHandle = committedTransaction.id;
                receipt.undoAvailable = true;
              }
            });
            const runtime = ensureRuntimeShape(dataRef).morphRuntime;
            runtime.actionTransactions = sanitizeActionTransactions(
              (Array.isArray(runtime.actionTransactions) ? runtime.actionTransactions : []).map((entry) => (
                entry?.id === committedTransaction.id
                  ? {
                    ...entry,
                    trace: actionExecutionTrace.filter((traceEntry) => isFormalCommittedTraceEntry(traceEntry)),
                    receipt: {
                      ...(entry.receipt || {}),
                      transactionHandle: committedTransaction.id,
                      undoAvailable: true,
                    },
                  }
                  : entry
              )),
            );
          },
        });
        return {
          transactionId: String(commitResult?.transactionId || '').trim(),
          committedTransaction: commitResult?.committedTransaction || null,
          committedEntityRefs: Array.isArray(commitResult?.committedEntityRefs) ? commitResult.committedEntityRefs : [],
          committedPatches: Array.isArray(commitResult?.committedPatches) ? commitResult.committedPatches : [],
          writeReceipt: commitResult?.writeReceipt && typeof commitResult.writeReceipt === 'object' ? commitResult.writeReceipt : null,
          commitReceipt: commitResult?.commitReceipt && typeof commitResult.commitReceipt === 'object'
            ? commitResult.commitReceipt
            : (commitResult?.writeReceipt && typeof commitResult.writeReceipt === 'object' ? commitResult.writeReceipt : null),
          failureKind: '',
          failureStage: '',
          failureCode: '',
          failureMessage: '',
          needsConfirmation: false,
        };
      }

      if (changed && committedActions.length && committedDomains.size && requiresCanonicalCommit) {
        return {
          transactionId: '',
          committedTransaction: null,
          committedEntityRefs: [],
          failureKind: 'failed',
          failureStage: 'commit',
          failureCode: 'canonical-writer-unavailable',
          failureMessage: '应用在执行写入动作时发生了内部错误（与 AI 服务商无关）。请重试一次；若持续出现请反馈。',
          needsConfirmation: false,
          blockedReason: '应用在执行写入动作时发生了内部错误（与 AI 服务商无关）。请重试一次；若持续出现请反馈。',
          morphActionExecutionFailed: true,
        };
      }

      let committedTransaction = null;
      if (changed && committedActions.length && committedDomains.size) {
        committedTransaction = recordMorphActionTransaction({
          promptQuestion,
          actions: committedActions,
          actionTypes: committedActionTypes,
          domains: Array.from(committedDomains),
          beforeDomains: transactionBeforeDomains,
          beforeView: transactionBeforeView,
          appliedLabels,
          createdItems,
          trace: committedTrace,
          receipt: committedReceipts[0] || {
            summary: String(appliedLabels[0] || committedActionTypes[0] || '').trim(),
            verifierStatus: 'verified',
            undoAvailable: false,
          },
          resolveActionExecutionPolicy,
        });
      }

      if (committedTransaction?.id) {
        actionExecutionTrace.forEach((entry) => {
          if (!isFormalCommittedTraceEntry(entry)) return;
          entry.transactionId = committedTransaction.id;
          if (entry.receipt && typeof entry.receipt === 'object') {
            entry.receipt.transactionHandle = committedTransaction.id;
            entry.receipt.undoAvailable = true;
          }
        });
        committedReceipts.forEach((receipt) => {
          if (receipt && typeof receipt === 'object') {
            receipt.transactionHandle = committedTransaction.id;
            receipt.undoAvailable = true;
          }
        });
        const runtime = ensureRuntimeShape(dataRef).morphRuntime;
        runtime.actionTransactions = sanitizeActionTransactions(
          (Array.isArray(runtime.actionTransactions) ? runtime.actionTransactions : []).map((entry) => (
            entry?.id === committedTransaction.id
              ? {
                ...entry,
                trace: actionExecutionTrace.filter((traceEntry) => isFormalCommittedTraceEntry(traceEntry)),
                receipt: {
                  ...(entry.receipt || {}),
                  transactionHandle: committedTransaction.id,
                  undoAvailable: true,
                },
              }
              : entry
          )),
        );
      }

      const committedEntityRefs = mergeSyncEntityRefs(
        buildSyncEntityRefsFromReceipts(committedReceipts),
        buildSyncEntityRefsFromCreatedItems(createdItems, committedActionTypes[0] || ''),
      );

      if (changed) {
        if (protectRecentCommittedData) protectRecentCommittedData(20000);
        else {
          if (setLastUserEditAt) setLastUserEditAt(Date.now());
          if (bumpUISessionLock) bumpUISessionLock(12000);
        }
        if (saveData) {
          saveData({
            skipRender: currentTab === 'ai',
            skipUndo: performedTransactionUndo,
            domains: Array.from(committedDomains),
            entityRefs: committedEntityRefs,
            postPersistTasks,
            immediatePersist: shouldImmediatePersist,
          });
        }
      }

      const transactionId = String(committedTransaction?.id || '').trim();
      const writeReceipt = buildStructuredWriteReceipt({
        domains: Array.from(committedDomains),
        entityRefs: committedEntityRefs,
        transactionId,
        saveMode: 'data',
        immediatePersist: shouldImmediatePersist,
        changed,
        persisted: changed,
        transactionRecorded: !!transactionId,
      });

      return {
        transactionId,
        committedTransaction,
        committedEntityRefs,
        committedPatches: [],
        writeReceipt,
        commitReceipt: writeReceipt,
        failureKind: '',
        failureStage: '',
        failureCode: '',
        failureMessage: '',
        needsConfirmation: false,
      };
    }

    return {
      finalizeActionCommit,
    };
  }

  window.MorphAIActionCommitRuntime = {
    create: createAIActionCommitRuntime,
  };
})();
