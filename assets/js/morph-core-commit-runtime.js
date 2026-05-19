// @ts-check

(function initMorphCoreCommitRuntime() {
  if (typeof window === 'undefined') return;
  const hasCoreRuntime = window.MorphCoreCommitRuntime && typeof window.MorphCoreCommitRuntime.create === 'function';
  const hasCanonicalWriterRuntime = window.MorphCanonicalWriterRuntime && typeof window.MorphCanonicalWriterRuntime.create === 'function';
  if (hasCoreRuntime && hasCanonicalWriterRuntime) return;

  function createMorphCoreCommitRuntime() {
    function toCleanArray(value = []) {
      return Array.isArray(value) ? value.filter(Boolean) : [];
    }

    function toCleanString(value = '') {
      return String(value || '').trim();
    }

    function normalizeDomainList(value = []) {
      return Array.from(
        new Set(
          toCleanArray(value)
            .map((item) => String(item || '').trim())
            .filter(Boolean),
        ),
      );
    }

    function collectPatchFieldPaths(source, bucket) {
      if (!source) return;
      if (typeof source === 'string' || typeof source === 'number') {
        const normalized = toCleanString(source);
        if (normalized) bucket.push(normalized);
        return;
      }
      if (Array.isArray(source)) {
        source.forEach((item) => collectPatchFieldPaths(item, bucket));
        return;
      }
      if (typeof source !== 'object') return;
      ['fieldPaths', 'changedFields', 'changedKeys', 'fields'].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(source, key)) collectPatchFieldPaths(source[key], bucket);
      });
      ['field', 'targetField', 'section'].forEach((key) => {
        const normalized = toCleanString(source[key]);
        if (normalized) bucket.push(normalized);
      });
    }

    function normalizeFieldPathList(...sources) {
      const bucket = [];
      sources.forEach((source) => collectPatchFieldPaths(source, bucket));
      return Array.from(new Set(bucket.map((item) => toCleanString(item)).filter(Boolean))).slice(0, 24);
    }

    function getDefaultFieldPathsForDomains(value = []) {
      const map = {
        daily: 'blocks',
        thoughts: 'items',
        projects: 'items',
        expenseLedger: 'records',
        reminders: 'items',
        aiMemory: 'memory',
        aiMemoryFull: 'memory',
      };
      const fieldPaths = normalizeDomainList(value)
        .map((domain) => map[domain] || 'state')
        .filter(Boolean);
      return Array.from(new Set(fieldPaths)).slice(0, 12);
    }

    function normalizeEntityRef(item = {}, fallbackDomain = '') {
      const source = item && typeof item === 'object' ? item : {};
      const domain = toCleanString(source.domain || fallbackDomain);
      const entityType = toCleanString(source.entityType || '');
      const entityId = toCleanString(source.entityId || '');
      if (!domain && !entityType && !entityId) return null;
      return {
        domain,
        entityType: entityType || 'domain_state',
        entityId: entityId || domain || 'unknown',
        action: toCleanString(source.action || ''),
        label: toCleanString(source.label || source.summary || '').slice(0, 120),
      };
    }

    function buildFallbackPatchEntries(fallback = {}) {
      const refs = toCleanArray(fallback.entityRefs)
        .map((item) => normalizeEntityRef(item))
        .filter(Boolean);
      const action = toCleanString(fallback.action || '');
      const reason = toCleanString(fallback.reason || '').slice(0, 240);
      const fieldPaths = normalizeFieldPathList(fallback.fieldPaths);
      if (refs.length) {
        return refs.map((ref) => ({
          domain: ref.domain,
          entityType: ref.entityType,
          entityId: ref.entityId,
          action: toCleanString(ref.action || action),
          fieldPaths,
          reason,
        }));
      }
      return normalizeDomainList(fallback.domains).map((domain) => ({
        domain,
        entityType: 'domain_state',
        entityId: domain,
        action,
        fieldPaths,
        reason,
      }));
    }

    function normalizePatchList(value = [], fallback = {}) {
      const sourceList = toCleanArray(value).length
        ? toCleanArray(value)
        : buildFallbackPatchEntries(fallback);
      const deduped = new Map();
      sourceList.forEach((item) => {
        const source = item && typeof item === 'object' ? item : {};
        const fallbackDomain = normalizeDomainList(fallback.domains)[0] || '';
        const domain = toCleanString(source.domain || fallbackDomain);
        const entityType = toCleanString(source.entityType || '') || 'domain_state';
        const entityId = toCleanString(source.entityId || '') || domain || 'unknown';
        const action = toCleanString(source.action || fallback.action || '');
        const fieldPaths = normalizeFieldPathList(
          source.fieldPaths,
          source.changedFields,
          source.changedKeys,
          source.fields,
          source.field,
          source.targetField,
          source.section,
          fallback.fieldPaths,
        );
        const reason = toCleanString(
          source.reason
          || source.why
          || fallback.reason
          || fallback.promptQuestion
          || '',
        ).slice(0, 240);
        if (!domain) return;
        const key = [domain, entityType, entityId, action, fieldPaths.join('|')].join('::');
        deduped.set(key, {
          domain,
          entityType,
          entityId,
          action,
          fieldPaths: fieldPaths.length ? fieldPaths : ['state'],
          reason,
        });
      });
      return Array.from(deduped.values()).slice(0, 48);
    }

    function defaultMergeSyncEntityRefs(...groups) {
      const list = [];
      const seen = new Set();
      groups.forEach((group) => {
        toCleanArray(group).forEach((item) => {
          const key = JSON.stringify(item || {});
          if (seen.has(key)) return;
          seen.add(key);
          list.push(item);
        });
      });
      return list;
    }

    function shouldImmediatePersistForDomains(value = []) {
      const domains = normalizeDomainList(value);
      return domains.includes('reminders')
        || domains.includes('expenseLedger')
        || domains.includes('aiMemory')
        || domains.includes('aiMemoryFull');
    }

    function buildCommitReceipt({
      writer = 'MorphCanonicalWriterRuntime.commitPatchIntent',
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
        type: 'canonical_write',
        writer: toCleanString(writer) || 'MorphCanonicalWriterRuntime.commitPatchIntent',
        domains: normalizeDomainList(domains),
        entityRefs: toCleanArray(entityRefs),
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

    function commitMorphCoreMutation(options = {}) {
      const changed = options.changed !== false;
      const source = String(options.source || 'manual').trim() || 'manual';
      const promptQuestion = String(options.promptQuestion || '').trim();
      const actions = toCleanArray(options.actions);
      const actionTypes = toCleanArray(options.actionTypes);
      const domains = normalizeDomainList(
        options.domains instanceof Set ? Array.from(options.domains) : options.domains,
      );
      const beforeDomains = options.beforeDomains && typeof options.beforeDomains === 'object'
        ? options.beforeDomains
        : {};
      const beforeView = options.beforeView && typeof options.beforeView === 'object'
        ? options.beforeView
        : null;
      const appliedLabels = toCleanArray(options.appliedLabels)
        .map((item) => String(item || '').trim())
        .filter(Boolean);
      const createdItems = toCleanArray(options.createdItems);
      const trace = toCleanArray(options.trace);
      const receipts = toCleanArray(options.receipts);
      const detail = options.detail && typeof options.detail === 'object' ? options.detail : {};
      const saveMode = String(options.saveMode || 'data').trim() || 'data';
      const recordMorphActionTransaction = typeof options.recordMorphActionTransaction === 'function'
        ? options.recordMorphActionTransaction
        : null;
      const resolveActionExecutionPolicy = typeof options.resolveActionExecutionPolicy === 'function'
        ? options.resolveActionExecutionPolicy
        : null;
      const mergeSyncEntityRefs = typeof options.mergeSyncEntityRefs === 'function'
        ? options.mergeSyncEntityRefs
        : defaultMergeSyncEntityRefs;
      const buildSyncEntityRefsFromReceipts = typeof options.buildSyncEntityRefsFromReceipts === 'function'
        ? options.buildSyncEntityRefsFromReceipts
        : () => [];
      const buildSyncEntityRefsFromCreatedItems = typeof options.buildSyncEntityRefsFromCreatedItems === 'function'
        ? options.buildSyncEntityRefsFromCreatedItems
        : () => [];
      const explicitEntityRefs = toCleanArray(options.entityRefs);
      const explicitPatches = toCleanArray(options.patches);
      const protectRecentCommittedData = typeof options.protectRecentCommittedData === 'function'
        ? options.protectRecentCommittedData
        : null;
      const setLastUserEditAt = typeof options.setLastUserEditAt === 'function'
        ? options.setLastUserEditAt
        : null;
      const bumpUISessionLock = typeof options.bumpUISessionLock === 'function'
        ? options.bumpUISessionLock
        : null;
      const saveData = typeof options.saveData === 'function' ? options.saveData : null;
      const saveSilent = typeof options.saveSilent === 'function' ? options.saveSilent : null;
      const postPersistTasks = toCleanArray(options.postPersistTasks).filter((task) => typeof task === 'function');
      const currentTab = String(options.currentTab || '').trim();
      const skipRender = options.skipRender === true;
      const skipUndo = options.skipUndo === true;
      const immediatePersist = Object.prototype.hasOwnProperty.call(options, 'immediatePersist')
        ? options.immediatePersist === true
        : shouldImmediatePersistForDomains(domains);
      const derivedEntityRefs = mergeSyncEntityRefs(
        buildSyncEntityRefsFromReceipts(receipts),
        explicitEntityRefs,
        buildSyncEntityRefsFromCreatedItems(createdItems, actionTypes[0] || '', detail),
      );
      const patchFieldPaths = normalizeFieldPathList(
        options.fieldPaths,
        detail,
        actions,
      );
      const normalizedPatches = normalizePatchList(explicitPatches, {
        domains,
        entityRefs: derivedEntityRefs,
        action: actionTypes[0] || actions[0]?.type || '',
        fieldPaths: patchFieldPaths.length ? patchFieldPaths : getDefaultFieldPathsForDomains(domains),
        reason: options.reason || detail.reason || promptQuestion || appliedLabels[0] || actionTypes[0] || '',
        promptQuestion,
      });

      let committedTransaction = null;
      if (changed && recordMorphActionTransaction && actions.length && domains.length) {
        committedTransaction = recordMorphActionTransaction({
          source,
          promptQuestion,
          actions,
          actionTypes,
          domains,
          beforeDomains,
          beforeView,
          appliedLabels,
          createdItems,
          trace,
          patches: normalizedPatches,
          receipt: receipts[0] || null,
          resolveActionExecutionPolicy,
        });
        if (committedTransaction && typeof options.onTransactionRecorded === 'function') {
          options.onTransactionRecorded(committedTransaction);
        }
      }

      const committedEntityRefs = derivedEntityRefs;

      if (changed && saveMode !== 'none') {
        if (protectRecentCommittedData) protectRecentCommittedData(20000);
        else {
          if (setLastUserEditAt) setLastUserEditAt(Date.now());
          if (bumpUISessionLock) bumpUISessionLock(12000);
        }
        const persistOptions = {
          skipRender: skipRender || currentTab === 'ai',
          skipUndo,
          domains,
          entityRefs: committedEntityRefs,
        };
        if (postPersistTasks.length) persistOptions.postPersistTasks = postPersistTasks;
        if (immediatePersist) persistOptions.immediatePersist = true;
        if (saveMode === 'silent') {
          if (saveSilent) saveSilent(persistOptions);
        } else if (saveData) {
          saveData(persistOptions);
        }
      }

      const transactionId = String(committedTransaction?.id || '').trim();
      const writeReceipt = buildCommitReceipt({
        domains,
        entityRefs: committedEntityRefs,
        transactionId,
        saveMode,
        immediatePersist,
        changed,
        persisted: changed && saveMode !== 'none',
        transactionRecorded: !!transactionId,
      });

      return {
        transactionId,
        committedTransaction,
        committedDomains: domains,
        committedEntityRefs,
        committedPatches: normalizedPatches,
        writeReceipt,
        commitReceipt: writeReceipt,
      };
    }

    return {
      commitMorphCoreMutation,
      shouldImmediatePersistForDomains,
      buildCommitReceipt,
    };
  }

  function createMorphCanonicalWriterRuntime() {
    function getMorphCoreCommitRuntime() {
      if (typeof window === 'undefined') return null;
      const factory = window.MorphCoreCommitRuntime && typeof window.MorphCoreCommitRuntime.create === 'function'
        ? window.MorphCoreCommitRuntime.create
        : null;
      return typeof factory === 'function' ? factory() : null;
    }

    function commitPatchIntent(options = {}) {
      const runtime = getMorphCoreCommitRuntime();
      if (!runtime || typeof runtime.commitMorphCoreMutation !== 'function') return null;
      return runtime.commitMorphCoreMutation(options);
    }

    function hasCanonicalWriter() {
      const runtime = getMorphCoreCommitRuntime();
      return !!(runtime && typeof runtime.commitMorphCoreMutation === 'function');
    }

    return {
      commitPatchIntent,
      commitMorphCoreMutation: commitPatchIntent,
      hasCanonicalWriter,
    };
  }

  if (!hasCoreRuntime) {
    window.MorphCoreCommitRuntime = {
      create: createMorphCoreCommitRuntime,
    };
    window.LianXingMorphCoreCommitRuntime = window.MorphCoreCommitRuntime;
  }

  if (!hasCanonicalWriterRuntime) {
    window.MorphCanonicalWriterRuntime = {
      create: createMorphCanonicalWriterRuntime,
    };
    window.LianXingMorphCanonicalWriterRuntime = window.MorphCanonicalWriterRuntime;
  }
})();
