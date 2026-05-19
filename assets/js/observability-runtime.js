(function initMorphObservabilityRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphObservabilityRuntime && typeof window.MorphObservabilityRuntime.create === 'function') return;

  function cloneJSONSafe(value) {
    try {
      return value == null ? value : JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function createObservabilityRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getSyncReasonRuntime() {
      const factory = window.MorphSyncReasonRuntime && typeof window.MorphSyncReasonRuntime.create === 'function'
        ? window.MorphSyncReasonRuntime.create
        : null;
      return typeof factory === 'function' ? factory() : null;
    }

    function trimText(value) {
      return String(value || '').trim();
    }

    function sanitizeEntityRefs(list = []) {
      return (Array.isArray(list) ? list : [])
        .map((item) => {
          const entry = item && typeof item === 'object' ? item : {};
          const domain = trimText(entry.domain);
          const entityType = trimText(entry.entityType || entry.entity);
          const entityId = trimText(entry.entityId || entry.id || entry.targetDate);
          if (!domain && !entityType && !entityId) return null;
          return {
            domain,
            entityType,
            entityId,
            label: trimText(entry.label || entry.text || ''),
          };
        })
        .filter(Boolean)
        .slice(0, 24);
    }

    function sanitizeMutationEntries(list = []) {
      return (Array.isArray(list) ? list : [])
        .map((item) => {
          const entry = item && typeof item === 'object' ? item : {};
          const mutationId = trimText(entry.mutationId);
          const revision = Number.isFinite(Number(entry.revision)) ? Number(entry.revision) : 0;
          const domains = Array.isArray(entry.domains)
            ? entry.domains.map((value) => trimText(value)).filter(Boolean).slice(0, 12)
            : [];
          return {
            mutationId,
            revision,
            createdAt: trimText(entry.createdAt),
            updatedAt: trimText(entry.updatedAt),
            deviceId: trimText(entry.deviceId),
            status: trimText(entry.status),
            domain: trimText(entry.domain),
            entityType: trimText(entry.entityType || entry.entity),
            entityId: trimText(entry.entityId || entry.targetDate),
            label: trimText(entry.label || entry.text),
            detail: trimText(entry.detail || entry.message),
            domains,
            entityRefs: sanitizeEntityRefs(entry.entityRefs),
          };
        })
        .filter((item) => item.mutationId || item.domain || item.entityType || item.entityId)
        .slice(0, 24);
    }

    function sanitizeTraceEntries(list = []) {
      return (Array.isArray(list) ? list : [])
        .map((item) => {
          const entry = item && typeof item === 'object' ? item : {};
          const type = trimText(entry.type);
          if (!type) return null;
          const receipt = entry.receipt && typeof entry.receipt === 'object' ? entry.receipt : null;
          return {
            type,
            status: trimText(entry.status),
            verifierStatus: trimText(entry.verifierStatus || entry.verifier?.status),
            message: trimText(entry.message),
            requestId: trimText(entry.requestId),
            entity: trimText(entry.entity),
            entityId: trimText(entry.entityId),
            targetDate: trimText(entry.targetDate),
            receiptSummary: trimText(receipt?.summary || receipt?.receiptSummary),
          };
        })
        .filter(Boolean)
        .slice(0, 24);
    }

    function buildMutationEntitySummary(entry = {}) {
      const refs = Array.isArray(entry.entityRefs) ? entry.entityRefs : [];
      if (refs.length) {
        return refs
          .slice(0, 3)
          .map((item) => [trimText(item.domain), trimText(item.entityType), trimText(item.entityId)].filter(Boolean).join(' · '))
          .filter(Boolean)
          .join(' | ');
      }
      return [trimText(entry.domain), trimText(entry.entityType), trimText(entry.entityId)].filter(Boolean).join(' · ');
    }

    function buildReceiptTimelineEntries(receipt = null, syncState = null) {
      const safeReceipt = receipt && typeof receipt === 'object' ? receipt : null;
      if (!safeReceipt) return [];
      const ackedRevision = Number.isFinite(Number(safeReceipt.ackedRevision))
        ? Number(safeReceipt.ackedRevision)
        : Number.isFinite(Number(syncState?.ackedRevision)) ? Number(syncState.ackedRevision) : 0;
      const pendingCount = Number.isFinite(Number(safeReceipt.pendingCount))
        ? Number(safeReceipt.pendingCount)
        : Number.isFinite(Number(syncState?.pendingCount)) ? Number(syncState.pendingCount) : 0;
      const entries = [{
        kind: 'receipt',
        updatedAt: trimText(safeReceipt.updatedAt),
        status: trimText(safeReceipt.status),
        source: trimText(safeReceipt.source),
        reason: trimText(safeReceipt.reason),
        message: trimText(safeReceipt.message),
        ackedRevision,
        pendingCount,
        summary: [trimText(safeReceipt.status), trimText(safeReceipt.source), trimText(safeReceipt.reason)].filter(Boolean).join(' · '),
      }];
      const pushMutationEntries = (list, kind, status) => {
        sanitizeMutationEntries(list).slice(0, 8).forEach((item) => {
          entries.push({
            kind,
            updatedAt: trimText(item.updatedAt || item.createdAt || safeReceipt.updatedAt),
            status,
            source: trimText(safeReceipt.source),
            reason: trimText(safeReceipt.reason),
            message: trimText(item.detail || item.label),
            ackedRevision,
            pendingCount,
            mutationId: trimText(item.mutationId),
            revision: Number.isFinite(Number(item.revision)) ? Number(item.revision) : 0,
            domains: Array.isArray(item.domains) ? item.domains.slice(0, 12) : [],
            entitySummary: buildMutationEntitySummary(item),
            summary: [trimText(item.mutationId), buildMutationEntitySummary(item)].filter(Boolean).join(' · '),
          });
        });
      };
      pushMutationEntries(safeReceipt.mergedMutations, 'merged-mutation', 'merged');
      pushMutationEntries(safeReceipt.ackedMutations, 'acked-mutation', 'acked');
      pushMutationEntries(safeReceipt.blockedMutations, 'blocked-mutation', 'blocked');
      if (safeReceipt.conflict && typeof safeReceipt.conflict === 'object') {
        entries.push({
          kind: 'conflict',
          updatedAt: trimText(safeReceipt.updatedAt),
          status: 'conflict',
          source: trimText(safeReceipt.source),
          reason: trimText(safeReceipt.reason),
          message: trimText(safeReceipt.conflict.detail),
          ackedRevision,
          pendingCount,
          incomingDeviceId: trimText(safeReceipt.conflict.incomingDeviceId),
          currentDeviceId: trimText(safeReceipt.conflict.currentDeviceId),
          summary: [trimText(safeReceipt.conflict.incomingDeviceId), trimText(safeReceipt.conflict.currentDeviceId)].filter(Boolean).join(' -> '),
        });
      }
      return entries.filter((entry) => entry.summary || entry.message || entry.status).slice(0, 24);
    }

    function buildSyncQueueSnapshot(syncState = null, pendingMutations = [], pendingEntities = []) {
      const mutations = (Array.isArray(pendingMutations) ? pendingMutations : []).map((item) => ({
        mutationId: trimText(item.mutationId),
        revision: Number.isFinite(Number(item.revision)) ? Number(item.revision) : 0,
        domains: Array.isArray(item.domains) ? item.domains.slice(0, 12) : [],
        entityRefs: sanitizeEntityRefs(item.entityRefs),
        detail: trimText(item.detail || item.label),
        entitySummary: buildMutationEntitySummary(item),
      }));
      const entities = (Array.isArray(pendingEntities) ? pendingEntities : []).map((item) => ({
        domain: trimText(item.domain),
        entityType: trimText(item.entityType),
        entityId: trimText(item.entityId),
        status: trimText(item.status),
        detail: trimText(item.detail),
      }));
      return {
        pendingRevision: Number.isFinite(Number(syncState?.latestPendingRevision)) ? Number(syncState.latestPendingRevision) : 0,
        pendingCount: Number.isFinite(Number(syncState?.pendingCount)) ? Number(syncState.pendingCount) : mutations.length,
        pendingDomainCount: Array.isArray(syncState?.pendingDomains) ? syncState.pendingDomains.length : 0,
        pendingEntityCount: entities.length,
        mutations: mutations.slice(0, 12),
        entities: entities.slice(0, 24),
      };
    }

    function buildActionTraceDrilldown(recentTransactions = []) {
      const transactions = (Array.isArray(recentTransactions) ? recentTransactions : []).map((item) => ({
        id: trimText(item.id),
        source: trimText(item.source),
        status: trimText(item.status),
        createdAt: trimText(item.createdAt),
        actionTypes: Array.isArray(item.actionTypes) ? item.actionTypes.slice(0, 12) : [],
        domains: Array.isArray(item.domains) ? item.domains.slice(0, 12) : [],
        receiptSummary: trimText(item.receiptSummary),
        receiptStatus: trimText(item.receiptStatus),
        trace: sanitizeTraceEntries(item.trace).map((traceEntry) => ({
          type: trimText(traceEntry.type),
          status: trimText(traceEntry.status),
          entity: trimText(traceEntry.entity),
          entityId: trimText(traceEntry.entityId || traceEntry.targetDate),
          requestId: trimText(traceEntry.requestId),
          verifierStatus: trimText(traceEntry.verifierStatus),
          receiptSummary: trimText(traceEntry.receiptSummary),
          message: trimText(traceEntry.message),
          summary: [trimText(traceEntry.type), trimText(traceEntry.status), trimText(traceEntry.entityId || traceEntry.targetDate)].filter(Boolean).join(' · '),
        })),
      })).filter((item) => item.id);
      return {
        totalTransactions: transactions.length,
        totalTraceEntries: transactions.reduce((sum, item) => sum + item.trace.length, 0),
        transactions: transactions.slice(0, 8),
      };
    }

    function buildSyncInspectionSnapshot({ syncReceipt = null } = {}) {
      const data = typeof api.getData === 'function'
        ? (api.getData() || {})
        : {};
      const syncState = typeof api.getSyncMutationState === 'function'
        ? api.getSyncMutationState()
        : null;
      const stateReceipt = syncState?.lastReceipt && typeof syncState.lastReceipt === 'object'
        ? syncState.lastReceipt
        : null;
      const safeReceipt = syncReceipt && typeof syncReceipt === 'object'
        ? syncReceipt
        : ((typeof api.readLastSyncReceipt === 'function' ? api.readLastSyncReceipt() : null) || stateReceipt);
      const pendingMutations = sanitizeMutationEntries(syncState?.pendingMutations);
      const pendingEntities = syncState?.entityStates && typeof syncState.entityStates === 'object'
        ? Object.values(syncState.entityStates).map((item) => {
            const entry = item && typeof item === 'object' ? item : {};
            return {
              domain: trimText(entry.domain),
              entityType: trimText(entry.entityType || entry.entity),
              entityId: trimText(entry.entityId || entry.targetDate),
              status: trimText(entry.status),
              detail: trimText(entry.detail || entry.message),
            };
          }).filter((entry) => entry.domain || entry.entityType || entry.entityId).slice(0, 24)
        : [];
      const receiptTimeline = buildReceiptTimelineEntries(safeReceipt, syncState);
      const mergedMutations = sanitizeMutationEntries(safeReceipt?.mergedMutations);
      const ackedMutations = sanitizeMutationEntries(safeReceipt?.ackedMutations);
      const blockedMutations = sanitizeMutationEntries(safeReceipt?.blockedMutations);
      const conflict = safeReceipt?.conflict && typeof safeReceipt.conflict === 'object'
        ? {
            incomingDeviceId: trimText(safeReceipt.conflict.incomingDeviceId),
            currentDeviceId: trimText(safeReceipt.conflict.currentDeviceId),
            incomingRevision: Number.isFinite(Number(safeReceipt.conflict.incomingRevision)) ? Number(safeReceipt.conflict.incomingRevision) : 0,
            currentRevision: Number.isFinite(Number(safeReceipt.conflict.currentRevision)) ? Number(safeReceipt.conflict.currentRevision) : 0,
            incomingWriteAt: trimText(safeReceipt.conflict.incomingWriteAt),
            currentWriteAt: trimText(safeReceipt.conflict.currentWriteAt),
            detail: trimText(safeReceipt.conflict.detail),
          }
        : null;
      const shellDescriptor = typeof api.getShellDescriptor === 'function'
        ? api.getShellDescriptor()
        : null;
      const reasonRuntime = getSyncReasonRuntime();
      const reasonSurface = reasonRuntime && typeof reasonRuntime.buildSyncReasonSurface === 'function'
        ? reasonRuntime.buildSyncReasonSurface({
            receipt: safeReceipt,
            descriptor: shellDescriptor,
            syncState,
            currentMeta: data && typeof data === 'object' ? data.syncMeta : null,
            bootPhase: typeof api.describeCurrentBootPhase === 'function' ? api.describeCurrentBootPhase() : '',
          })
        : null;
      return {
        pendingCount: Number.isFinite(Number(syncState?.pendingCount)) ? Number(syncState.pendingCount) : pendingMutations.length,
        latestPendingRevision: Number.isFinite(Number(syncState?.latestPendingRevision)) ? Number(syncState.latestPendingRevision) : 0,
        ackedRevision: Number.isFinite(Number(syncState?.ackedRevision)) ? Number(syncState.ackedRevision) : Number(safeReceipt?.ackedRevision || 0),
        pendingDomains: Array.isArray(syncState?.pendingDomains) ? syncState.pendingDomains.map((item) => trimText(item)).filter(Boolean).slice(0, 24) : [],
        pendingMutations,
        pendingEntities,
        receiptTimeline,
        mergedMutations,
        ackedMutations,
        blockedMutations,
        conflict,
        reasonSurface,
        syncQueue: buildSyncQueueSnapshot(syncState, pendingMutations, pendingEntities),
      };
    }

    function buildActionInspectionSnapshot() {
      const actionTransactions = typeof api.getActionTransactions === 'function'
        ? api.getActionTransactions()
        : [];
      const recentTransactions = (Array.isArray(actionTransactions) ? actionTransactions : [])
        .slice(-8)
        .reverse()
        .map((item) => {
          const entry = item && typeof item === 'object' ? item : {};
          const receipt = entry.receipt && typeof entry.receipt === 'object' ? entry.receipt : null;
          const trace = sanitizeTraceEntries(entry.trace);
          return {
            id: trimText(entry.id),
            source: trimText(entry.source),
            status: trimText(entry.status),
            createdAt: trimText(entry.createdAt),
            domains: Array.isArray(entry.domains) ? entry.domains.map((value) => trimText(value)).filter(Boolean).slice(0, 12) : [],
            actionTypes: Array.isArray(entry.actionTypes) ? entry.actionTypes.map((value) => trimText(value)).filter(Boolean).slice(0, 12) : [],
            appliedLabels: Array.isArray(entry.appliedLabels) ? entry.appliedLabels.map((value) => trimText(value)).filter(Boolean).slice(0, 12) : [],
            receiptSummary: trimText(receipt?.summary || receipt?.receiptSummary),
            receiptStatus: trimText(receipt?.verifierStatus),
            trace,
            committedTraceCount: trace.filter((traceEntry) => traceEntry.status === 'committed' && traceEntry.transactionCommitted !== false).length,
            blockedTraceCount: trace.filter((traceEntry) => /^blocked/.test(traceEntry.status) || traceEntry.status === 'needs_confirmation').length,
          };
        })
        .filter((entry) => entry.id);
      const latestTransaction = typeof api.getLastMorphActionTransaction === 'function'
        ? api.getLastMorphActionTransaction()
        : null;
      const traceDrilldown = buildActionTraceDrilldown(recentTransactions);
      return {
        totalRecentTransactions: recentTransactions.length,
        recentTransactions,
        traceDrilldown,
        latestTransaction: latestTransaction && typeof latestTransaction === 'object'
          ? {
              entry: latestTransaction.entry && typeof latestTransaction.entry === 'object'
                ? cloneJSONSafe(latestTransaction.entry)
                : null,
              driftedDomains: Array.isArray(latestTransaction.driftedDomains) ? latestTransaction.driftedDomains.map((item) => trimText(item)).filter(Boolean) : [],
              reason: trimText(latestTransaction.reason),
            }
          : null,
      };
    }

    function shouldShowDebugStatus() {
      if (typeof api.shouldShowDebugStatus === 'function') {
        return api.shouldShowDebugStatus() === true;
      }
      try {
        const forced = localStorage.getItem('morph_extension_debug');
        if (forced === '1') return true;
        if (forced === '0') return false;
      } catch (_) {}
      const host = String(window?.location?.hostname || '').trim().toLowerCase();
      return host === 'localhost' || host === '127.0.0.1';
    }

    function buildChatMetricsSnapshot() {
      const currentData = typeof api.getData === 'function'
        ? api.getData()
        : null;
      const aiMemory = currentData && typeof currentData === 'object' && currentData.aiMemory && typeof currentData.aiMemory === 'object'
        ? currentData.aiMemory
        : {};
      const sessions = Array.isArray(aiMemory.chatSessions) ? aiMemory.chatSessions : [];
      const currentSessionId = trimText(aiMemory.currentChatSessionId);
      const currentSession = sessions.find((session) => trimText(session?.id) === currentSessionId)
        || sessions[sessions.length - 1]
        || null;
      const totalChatMessageCount = sessions.reduce((sum, session) => {
        const count = Array.isArray(session?.messages) ? session.messages.length : 0;
        return sum + (Number.isFinite(count) ? count : 0);
      }, 0);
      const currentSessionMessageCount = Array.isArray(currentSession?.messages)
        ? currentSession.messages.length
        : 0;
      const historyDebug = typeof api.getAIChatHistoryDebugState === 'function'
        ? api.getAIChatHistoryDebugState()
        : null;
      return {
        chatSessionCount: sessions.length,
        currentChatSessionId: currentSessionId || trimText(currentSession?.id),
        currentSessionMessageCount: Number.isFinite(currentSessionMessageCount) ? currentSessionMessageCount : 0,
        totalChatMessageCount: Number.isFinite(totalChatMessageCount) ? totalChatMessageCount : 0,
        registryOwner: trimText(historyDebug?.registryOwner),
        registryStatus: trimText(historyDebug?.registryStatus),
        registryCurrentSelectionSource: trimText(historyDebug?.registryCurrentSelectionSource),
        storedActiveSessionId: trimText(historyDebug?.storedActiveSessionId),
        storedPointerStatus: trimText(historyDebug?.storedPointerStatus),
        historyRepairStatus: trimText(historyDebug?.historyRepairStatus),
        historyRepairReason: trimText(historyDebug?.historyRepairReason),
        historyRepairSource: trimText(historyDebug?.historyRepairSource),
        historyRepairSourceDetail: trimText(historyDebug?.historyRepairSourceDetail),
        bootHistoryStatus: trimText(historyDebug?.bootHistoryStatus),
        bootHistoryReason: trimText(historyDebug?.bootHistoryReason),
        bootHistorySource: trimText(historyDebug?.bootHistorySource),
        bootHistorySourceDetail: trimText(historyDebug?.bootHistorySourceDetail),
        bootHistorySessionCount: Math.max(0, Number(historyDebug?.bootHistorySessionCount || 0) || 0),
      };
    }

    function buildStableMemoryMetricsSnapshot() {
      const currentData = typeof api.getData === 'function'
        ? api.getData()
        : null;
      const aiMemory = currentData && typeof currentData === 'object' && currentData.aiMemory && typeof currentData.aiMemory === 'object'
        ? currentData.aiMemory
        : {};
      const longTermMemory = aiMemory.longTermMemory && typeof aiMemory.longTermMemory === 'object'
        ? aiMemory.longTermMemory
        : {};
      const facts = Array.isArray(longTermMemory.facts) ? longTermMemory.facts : [];
      const activeFacts = facts.filter((fact) => {
        const status = trimText(fact?.status || 'active') || 'active';
        return status === 'active' || status === 'confirmed';
      });
      const stableFacts = activeFacts.filter((fact) => fact?.alwaysInject === true || ['locked', 'stable'].includes(trimText(fact?.stability)));
      const lockedFacts = stableFacts.filter((fact) => trimText(fact?.stability) === 'locked');
      const explicitUserFacts = stableFacts.filter((fact) => trimText(fact?.writeMode) === 'explicit-user');
      const settingsFacts = stableFacts.filter((fact) => trimText(fact?.writeMode) === 'settings');
      const stableMemoryDebug = typeof api.getStableMemoryDebugState === 'function'
        ? api.getStableMemoryDebugState()
        : null;
      return {
        stableMemoryFactCount: stableFacts.length,
        lockedStableMemoryFactCount: lockedFacts.length,
        explicitUserStableFactCount: explicitUserFacts.length,
        settingsDerivedStableFactCount: settingsFacts.length,
        stableMemoryMirrorAvailable: trimText(aiMemory.user).length > 0 || trimText(longTermMemory.user).length > 0,
        bootStableMemoryStatus: trimText(stableMemoryDebug?.bootStableMemoryStatus),
        bootStableMemoryReason: trimText(stableMemoryDebug?.bootStableMemoryReason),
        bootStableMemorySource: trimText(stableMemoryDebug?.bootStableMemorySource),
        bootStableMemorySourceDetail: trimText(stableMemoryDebug?.bootStableMemorySourceDetail),
        bootStableMemoryFactCount: Math.max(0, Number(stableMemoryDebug?.bootStableMemoryFactCount || 0) || 0),
        bootStableMemoryAuthoritativeFactCount: Math.max(0, Number(stableMemoryDebug?.bootStableMemoryAuthoritativeFactCount || 0) || 0),
        bootStableMemoryRecoveryFactCount: Math.max(0, Number(stableMemoryDebug?.bootStableMemoryRecoveryFactCount || 0) || 0),
      };
    }

    function buildThoughtGraphMetricsSnapshot() {
      const container = typeof document !== 'undefined'
        ? document.getElementById('main-flash-thoughts-list')
        : null;
      const runtime = typeof window !== 'undefined' && window.MorphThoughtGraphRuntime && typeof window.MorphThoughtGraphRuntime.getDebugSnapshot === 'function'
        ? window.MorphThoughtGraphRuntime
        : null;
      const runtimeDebug = runtime ? runtime.getDebugSnapshot() : null;
      const thoughtGraphNodeCount = container && typeof container.querySelectorAll === 'function'
        ? container.querySelectorAll('.orb-wrapper[data-thought-graph-key]').length
        : 0;
      const thoughtGraphCanvasCount = container && typeof container.querySelectorAll === 'function'
        ? container.querySelectorAll('canvas').length
        : 0;
      const thoughtGraphLayout = trimText(container?.dataset?.orbLayout || '');
      const thoughtGraphFocus = trimText(container?.dataset?.orbFocus || '');
      const thoughtGraphShortcutActive = trimText(container?.dataset?.shortcutActive || '') === '1';
      const statusBar = typeof document !== 'undefined'
        ? document.getElementById('thought-graph-status-bar')
        : null;
      const hoverPreview = typeof document !== 'undefined'
        ? document.getElementById('thought-graph-hover-preview')
        : null;
      const detailModal = typeof document !== 'undefined'
        ? document.getElementById('detail-modal')
        : null;
      const galaxyCanvas = typeof document !== 'undefined'
        ? document.getElementById('galaxy-canvas')
        : null;
      const linkCanvas = typeof document !== 'undefined'
        ? document.getElementById('link-canvas')
        : null;
      const thoughtGraphStatusMode = trimText(statusBar?.dataset?.mode || '');
      const thoughtGraphPreviewVisible = !!(hoverPreview
        && hoverPreview.getAttribute?.('aria-hidden') !== 'true'
        && hoverPreview.style?.display !== 'none');
      const detailModalActive = detailModal?.classList?.contains?.('active') === true;
      const keyboardDebug = typeof api.getThoughtGraphKeyboardDebugState === 'function'
        ? api.getThoughtGraphKeyboardDebugState()
        : null;
      const measureCanvasBytes = (canvas) => {
        const width = Math.max(0, Number(canvas?.width || 0) || 0);
        const height = Math.max(0, Number(canvas?.height || 0) || 0);
        return width > 0 && height > 0 ? (width * height * 4) : 0;
      };
      return {
        thoughtGraphNodeCount: Number.isFinite(thoughtGraphNodeCount) ? thoughtGraphNodeCount : 0,
        thoughtGraphCanvasCount: Number.isFinite(thoughtGraphCanvasCount) ? thoughtGraphCanvasCount : 0,
        thoughtGraphLayout: thoughtGraphLayout || 'unknown',
        thoughtGraphFocus,
        thoughtGraphShortcutActive,
        thoughtGraphStatusMode,
        thoughtGraphPreviewVisible,
        detailModalActive,
        thoughtGraphRuntimeKnown: !!runtimeDebug,
        thoughtGraphRuntimeActive: runtimeDebug?.active === true,
        thoughtGraphRuntimeHasApp: runtimeDebug?.hasApp === true,
        thoughtGraphRuntimeHasCanvas: runtimeDebug?.hasCanvas === true,
        thoughtGraphRuntimeHostConnected: runtimeDebug?.hostConnected === true,
        thoughtGraphRuntimeNodeViewCount: Math.max(0, Number(runtimeDebug?.nodeViewCount || 0) || 0),
        thoughtGraphRuntimeNodeModelCount: Math.max(0, Number(runtimeDebug?.nodeModelCount || 0) || 0),
        thoughtGraphRuntimeEdgeModelCount: Math.max(0, Number(runtimeDebug?.edgeModelCount || 0) || 0),
        thoughtGraphRuntimePositionCacheCount: Math.max(0, Number(runtimeDebug?.positionCacheCount || 0) || 0),
        thoughtGraphRuntimePreviewNodeId: trimText(runtimeDebug?.previewNodeId),
        thoughtGraphRuntimeHoveredNodeId: trimText(runtimeDebug?.hoveredNodeId),
        thoughtGraphRuntimeDropTargetNodeId: trimText(runtimeDebug?.dropTargetNodeId),
        thoughtGraphRuntimeFocusImpulseActive: runtimeDebug?.focusImpulseActive === true,
        thoughtGraphRuntimePendingInit: runtimeDebug?.pendingAppInit === true,
        thoughtGraphRuntimeResizeObserverActive: runtimeDebug?.resizeObserverActive === true,
        thoughtGraphRuntimeRafActive: runtimeDebug?.rafActive === true,
        thoughtGraphRuntimeHoverRafActive: runtimeDebug?.hoverRafActive === true,
        thoughtGraphRuntimeMountCount: Math.max(0, Number(runtimeDebug?.mountCount || 0) || 0),
        thoughtGraphRuntimeDestroyCount: Math.max(0, Number(runtimeDebug?.destroyCount || 0) || 0),
        thoughtGraphRuntimeLastMountAt: Math.max(0, Number(runtimeDebug?.lastMountAt || 0) || 0),
        thoughtGraphRuntimeLastDestroyAt: Math.max(0, Number(runtimeDebug?.lastDestroyAt || 0) || 0),
        galaxyCanvasWidth: Math.max(0, Number(galaxyCanvas?.width || 0) || 0),
        galaxyCanvasHeight: Math.max(0, Number(galaxyCanvas?.height || 0) || 0),
        galaxyCanvasApproxBytes: measureCanvasBytes(galaxyCanvas),
        linkCanvasWidth: Math.max(0, Number(linkCanvas?.width || 0) || 0),
        linkCanvasHeight: Math.max(0, Number(linkCanvas?.height || 0) || 0),
        linkCanvasApproxBytes: measureCanvasBytes(linkCanvas),
        thoughtGraphKeyboardMode: trimText(keyboardDebug?.mode),
        thoughtGraphKeyboardDetailOpen: keyboardDebug?.detailOpen === true,
        thoughtGraphKeyboardFlashVisitedCount: Math.max(0, Number(keyboardDebug?.flashVisitedCount || 0) || 0),
        thoughtGraphKeyboardFixedVisitedCount: Math.max(0, Number(keyboardDebug?.fixedVisitedCount || 0) || 0),
        thoughtGraphKeyboardFlashTraversalCount: Math.max(0, Number(keyboardDebug?.flashTraversalCount || 0) || 0),
        thoughtGraphKeyboardFixedTraversalCount: Math.max(0, Number(keyboardDebug?.fixedTraversalCount || 0) || 0),
        thoughtGraphKeyboardFlashTraversalCursor: Number.isFinite(Number(keyboardDebug?.flashTraversalCursor))
          ? Number(keyboardDebug.flashTraversalCursor)
          : -1,
        thoughtGraphKeyboardFixedTraversalCursor: Number.isFinite(Number(keyboardDebug?.fixedTraversalCursor))
          ? Number(keyboardDebug.fixedTraversalCursor)
          : -1,
      };
    }

    function buildStorageFootprintSnapshot() {
      const readChars = (storageRef, key) => {
        try {
          if (!storageRef || !key || typeof storageRef.getItem !== 'function') return 0;
          const value = storageRef.getItem(key);
          return typeof value === 'string' ? value.length : 0;
        } catch (_) {
          return 0;
        }
      };
      const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
      const ls = typeof localStorage !== 'undefined' ? localStorage : null;
      return {
        recoverySnapshotChars: readChars(ss, 'morph_recovery_snapshot_v1'),
        externalTxSnapshotChars: readChars(ls, 'morph_action_transaction_external_snapshots_v1'),
        localDataCacheChars: readChars(ls, 'lianxing_mono_v18'),
        startupSnapshotChars: readChars(ls, 'morph_startup_snapshot_v1'),
      };
    }

    function buildSurfaceMetricsSnapshot() {
      const resolveElement = (selector = '') => {
        if (typeof document === 'undefined' || !selector) return null;
        if (selector.startsWith('#') && typeof document.getElementById === 'function') {
          return document.getElementById(selector.slice(1));
        }
        if (typeof document.querySelector === 'function') return document.querySelector(selector);
        return null;
      };
      const countNodes = (selector = '') => {
        const el = resolveElement(selector);
        if (!el || typeof el.getElementsByTagName !== 'function') return 0;
        return Math.max(0, Number(el.getElementsByTagName('*')?.length || 0) || 0);
      };
      const isActiveView = (viewId = '') => {
        if (typeof document === 'undefined' || !viewId) return false;
        return document.getElementById(viewId)?.classList?.contains?.('active') === true;
      };
      const detailModal = typeof document !== 'undefined'
        ? document.getElementById('detail-modal')
        : null;
      const aiDrawer = typeof document !== 'undefined'
        ? document.getElementById('ai-chat-drawer')
        : null;
      const aiSessionDrawer = typeof document !== 'undefined'
        ? document.getElementById('ai-chat-session-drawer')
        : null;
      const thoughtGraphHoverPreview = typeof document !== 'undefined'
        ? document.getElementById('thought-graph-hover-preview')
        : null;
      return {
        flashThoughtsSurfaceNodes: countNodes('#view-flashThoughts'),
        dailySurfaceNodes: countNodes('#view-daily'),
        projectSurfaceNodes: countNodes('#view-project'),
        settingsSurfaceNodes: countNodes('#view-settings'),
        sidebarProjectTreeNodes: countNodes('#sidebar-project-tree'),
        sidebarDailyTreeNodes: countNodes('#sidebar-daily-tree'),
        thoughtGraphHoverPreviewNodes: countNodes('#thought-graph-hover-preview'),
        drawerFlashThoughtsNodes: countNodes('#drawer-flash-thoughts-list'),
        projectExternalSurfaceNodes: countNodes('#project-space-external-view'),
        flashThoughtsViewActive: isActiveView('view-flashThoughts'),
        dailyViewActive: isActiveView('view-daily'),
        projectViewActive: isActiveView('view-project'),
        settingsViewActive: isActiveView('view-settings'),
        detailModalVisible: detailModal?.getAttribute?.('aria-hidden') === 'false' || detailModal?.classList?.contains?.('active') === true,
        aiChatDrawerVisible: aiDrawer?.getAttribute?.('aria-hidden') === 'false' || aiDrawer?.classList?.contains?.('open') === true,
        aiChatSessionDrawerVisible: aiSessionDrawer?.getAttribute?.('aria-hidden') === 'false' || aiSessionDrawer?.classList?.contains?.('open') === true,
        thoughtGraphHoverPreviewVisible: thoughtGraphHoverPreview?.getAttribute?.('aria-hidden') === 'false'
          || thoughtGraphHoverPreview?.style?.display === 'block',
      };
    }

    function buildLargeDomRootsSnapshot() {
      if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') {
        return {
          domRootLeaders: [],
        };
      }
      const roots = [];
      const allWithId = Array.from(document.querySelectorAll('[id]'));
      allWithId.forEach((el) => {
        const id = trimText(el?.id);
        if (!id || typeof el.getElementsByTagName !== 'function') return;
        const nodeCount = Math.max(0, Number(el.getElementsByTagName('*')?.length || 0) || 0);
        if (!nodeCount) return;
        roots.push({
          id,
          nodeCount,
          hidden: el.getAttribute?.('aria-hidden') === 'true'
            || el.classList?.contains?.('hidden') === true
            || el.hidden === true,
        });
      });
      roots.sort((a, b) => Number(b.nodeCount || 0) - Number(a.nodeCount || 0));
      return {
        domRootLeaders: roots.slice(0, 10),
      };
    }

    function buildRendererMemoryMetricsSnapshot() {
      const measureBytes = (value) => {
        try {
          if (value == null) return 0;
          const serialized = JSON.stringify(value);
          if (!serialized) return 0;
          if (typeof TextEncoder === 'function') {
            return Math.max(0, Number(new TextEncoder().encode(serialized).length || 0) || 0);
          }
          return Math.max(0, Number(serialized.length || 0) || 0);
        } catch (_) {
          return 0;
        }
      };
      const coerceTransactionList = (value) => {
        if (Array.isArray(value)) return value;
        if (value && typeof value === 'object') {
          try {
            return Object.values(value);
          } catch (_) {
            return [];
          }
        }
        return [];
      };
      const measureTopLevelEntries = (value, limit = 8) => (
        value && typeof value === 'object'
          ? Object.entries(value)
            .map(([key, entryValue]) => ({
              key: trimText(key),
              bytes: measureBytes(entryValue),
            }))
            .filter((entry) => entry.key && entry.bytes > 0)
            .sort((a, b) => Number(b.bytes || 0) - Number(a.bytes || 0))
            .slice(0, limit)
          : []
      );
      const measureTransactionFieldBreakdown = (entry = null, limit = 8) => {
        const transaction = entry && typeof entry === 'object' ? entry : null;
        if (!transaction) return [];
        return [
          ['actions', transaction.actions],
          ['trace', transaction.trace],
          ['beforeSnapshot', transaction.beforeSnapshot],
          ['patches', transaction.patches],
          ['createdItems', transaction.createdItems],
          ['receipt', transaction.receipt],
          ['appliedLabels', transaction.appliedLabels],
          ['actionTypes', transaction.actionTypes],
          ['domains', transaction.domains],
          ['afterFingerprints', transaction.afterFingerprints],
          ['promptQuestion', transaction.promptQuestion],
        ]
          .map(([key, value]) => ({
            key,
            bytes: measureBytes(value),
          }))
          .filter((item) => item.bytes > 0)
          .sort((a, b) => Number(b.bytes || 0) - Number(a.bytes || 0))
          .slice(0, limit);
      };
      const measureNamedRuntimeHolders = (entries = [], limit = 8) => (
        (Array.isArray(entries) ? entries : [])
          .map((entry) => {
            const key = trimText(entry?.key);
            if (!key) return null;
            return {
              key,
              bytes: measureBytes(entry?.value),
            };
          })
          .filter((entry) => entry && entry.key && entry.bytes > 0)
          .sort((a, b) => Number(b.bytes || 0) - Number(a.bytes || 0))
          .slice(0, limit)
      );
      const currentData = typeof api.getData === 'function'
        ? api.getData()
        : null;
      const settingsState = typeof api.getSettingsState === 'function'
        ? api.getSettingsState()
        : null;
      const aiChatState = typeof api.getAIChatState === 'function'
        ? api.getAIChatState()
        : null;
      const lastInject = typeof api.getLastInject === 'function'
        ? api.getLastInject()
        : null;
      const shellDescriptor = typeof api.getShellDescriptor === 'function'
        ? api.getShellDescriptor()
        : null;
      const syncMutationState = typeof api.getSyncMutationState === 'function'
        ? api.getSyncMutationState()
        : null;
      const perfMemory = typeof performance !== 'undefined' && performance?.memory && typeof performance.memory === 'object'
        ? performance.memory
        : null;
      const usedJSHeapSize = Math.max(0, Number(perfMemory?.usedJSHeapSize || 0) || 0);
      const totalJSHeapSize = Math.max(0, Number(perfMemory?.totalJSHeapSize || 0) || 0);
      const jsHeapSizeLimit = Math.max(0, Number(perfMemory?.jsHeapSizeLimit || 0) || 0);
      const domNodeCount = typeof document !== 'undefined' && typeof document.getElementsByTagName === 'function'
        ? Math.max(0, Number(document.getElementsByTagName('*')?.length || 0) || 0)
        : 0;
      const undoDebug = typeof api.getUndoDebugState === 'function'
        ? api.getUndoDebugState()
        : null;
      const rawActionTransactions = currentData?.morphRuntime?.actionTransactions;
      const normalizedActionTransactions = coerceTransactionList(rawActionTransactions);
      const rawActionTransactionType = Array.isArray(rawActionTransactions)
        ? 'array'
        : (rawActionTransactions && typeof rawActionTransactions === 'object' ? 'object' : typeof rawActionTransactions);
      const rawActionTransactionKeyCount = rawActionTransactions && typeof rawActionTransactions === 'object'
        ? Math.max(0, Number(Object.keys(rawActionTransactions).length || 0) || 0)
        : 0;
      const largestActionTransaction = normalizedActionTransactions
        .map((entry) => ({
          entry,
          bytes: measureBytes(entry),
        }))
        .sort((a, b) => Number(b.bytes || 0) - Number(a.bytes || 0))[0] || null;
      const runtimeDataTopDomains = measureTopLevelEntries(currentData, 8);
      const runtimeDataMorphRuntimeDomains = measureTopLevelEntries(currentData?.morphRuntime, 8);
      const runtimeHolderTopDomains = measureNamedRuntimeHolders([
        { key: 'settingsState', value: settingsState },
        { key: 'aiChatState', value: aiChatState },
        { key: 'lastInject', value: lastInject },
        { key: 'shellDescriptor', value: shellDescriptor },
        { key: 'syncMutationState', value: syncMutationState },
      ], 8);
      const runtimeSettingsStateDomains = measureTopLevelEntries(settingsState, 8);
      const runtimeAIChatStateDomains = measureTopLevelEntries(aiChatState, 8);
      return {
        jsHeapUsedBytes: usedJSHeapSize,
        jsHeapTotalBytes: totalJSHeapSize,
        jsHeapLimitBytes: jsHeapSizeLimit,
        domNodeCount,
        jsHeapMetricsAvailable: !!perfMemory,
        runtimeDataBytes: measureBytes(currentData),
        runtimeDataAIMemoryBytes: measureBytes(currentData?.aiMemory),
        runtimeDataFlashThoughtsBytes: measureBytes(currentData?.flashThoughts),
        runtimeDataProjectsBytes: measureBytes(currentData?.projects),
        runtimeDataDailyMonthsBytes: measureBytes(currentData?.dailyMonths),
        runtimeDataRemindersBytes: measureBytes(currentData?.reminders),
        runtimeDataRoutinesBytes: measureBytes(currentData?.routines),
        runtimeDataSopsBytes: measureBytes(currentData?.sops),
        runtimeDataPluginDataBytes: measureBytes(currentData?.pluginData),
        runtimeDataExpenseLedgerBytes: measureBytes(currentData?.expenseLedger),
        runtimeDataRuntimeOverlayBytes: measureBytes(currentData?.runtimeOverlay),
        undoStackCount: Number.isFinite(Number(undoDebug?.undoStackCount)) ? Number(undoDebug.undoStackCount) : 0,
        undoRedoCount: Number.isFinite(Number(undoDebug?.undoRedoCount)) ? Number(undoDebug.undoRedoCount) : 0,
        undoStackApproxBytes: Math.max(0, Number(undoDebug?.undoStackApproxBytes || 0) || 0),
        undoRedoApproxBytes: Math.max(0, Number(undoDebug?.undoRedoApproxBytes || 0) || 0),
        actionTransactionCount: Number.isFinite(Number(undoDebug?.actionTransactionCount)) ? Number(undoDebug.actionTransactionCount) : 0,
        actionTransactionSnapshotBytes: Math.max(0, Number(undoDebug?.actionTransactionSnapshotBytes || 0) || 0),
        actionTransactionRawType: rawActionTransactionType,
        actionTransactionRawKeyCount: rawActionTransactionKeyCount,
        actionTransactionRawBytes: measureBytes(rawActionTransactions),
        actionTransactionNormalizedCount: normalizedActionTransactions.length,
        actionTransactionNormalizedBytes: measureBytes(normalizedActionTransactions),
        actionTransactionLargestId: trimText(largestActionTransaction?.entry?.id),
        actionTransactionLargestBytes: Math.max(0, Number(largestActionTransaction?.bytes || 0) || 0),
        actionTransactionLargestFieldBreakdown: measureTransactionFieldBreakdown(largestActionTransaction?.entry, 8),
        runtimeDataTopDomains,
        runtimeDataMorphRuntimeDomains,
        runtimeHolderTopDomains,
        runtimeSettingsStateDomains,
        runtimeAIChatStateDomains,
        runtimeSettingsStateBytes: measureBytes(settingsState),
        runtimeAIChatStateBytes: measureBytes(aiChatState),
        runtimeLastInjectBytes: measureBytes(lastInject),
        runtimeShellDescriptorBytes: measureBytes(shellDescriptor),
        runtimeSyncMutationStateBytes: measureBytes(syncMutationState),
      };
    }

    function buildAIRequestMetricsSnapshot() {
      const currentData = typeof api.getData === 'function'
        ? api.getData()
        : null;
      const aiMemory = currentData && typeof currentData === 'object' && currentData.aiMemory && typeof currentData.aiMemory === 'object'
        ? currentData.aiMemory
        : {};
      const sessions = Array.isArray(aiMemory.chatSessions) ? aiMemory.chatSessions : [];
      const sessionRequests = [];
      sessions.forEach((session) => {
        const sessionId = trimText(session?.id);
        const messages = Array.isArray(session?.messages) ? session.messages : [];
        messages.forEach((message) => {
          const trace = message?.meta?.aiRequestTrace && typeof message.meta.aiRequestTrace === 'object'
            ? message.meta.aiRequestTrace
            : null;
          if (!trace) return;
          const requests = Array.isArray(trace.requests) ? trace.requests : [];
          requests.forEach((item) => {
            const entry = item && typeof item === 'object' ? item : {};
            sessionRequests.push({
              sessionId,
              messageId: trimText(message?.id),
              provider: trimText(entry.provider),
              model: trimText(entry.model),
              requestKind: trimText(entry.requestKind || 'text') || 'text',
              transport: trimText(entry.transport || 'http') || 'http',
              status: trimText(entry.status || 'ok') || 'ok',
              stream: entry.stream === true,
              durationMs: Math.max(0, Number(entry.durationMs || 0) || 0),
              promptTokens: Math.max(0, Number(entry.promptTokens || 0) || 0),
              completionTokens: Math.max(0, Number(entry.completionTokens || 0) || 0),
              totalTokens: Math.max(0, Number(entry.totalTokens || 0) || 0),
              tokenSource: trimText(entry.tokenSource || 'estimated') || 'estimated',
              path: trimText(trace.path || message?.meta?.timingTrace?.path),
            });
          });
        });
      });
      const runtimeRequests = typeof api.readRecentAIRequestMetrics === 'function'
        ? (Array.isArray(api.readRecentAIRequestMetrics(20)) ? api.readRecentAIRequestMetrics(20) : [])
        : [];
      const aggregateSource = sessionRequests.length ? sessionRequests : runtimeRequests;
      const latestRequests = aggregateSource.slice(-12).reverse().map((item) => ({
        provider: trimText(item.provider),
        model: trimText(item.model),
        requestKind: trimText(item.requestKind || 'text') || 'text',
        transport: trimText(item.transport || 'http') || 'http',
        status: trimText(item.status || 'ok') || 'ok',
        stream: item.stream === true,
        path: trimText(item.path),
        durationMs: Math.max(0, Number(item.durationMs || 0) || 0),
        promptTokens: Math.max(0, Number(item.promptTokens || 0) || 0),
        completionTokens: Math.max(0, Number(item.completionTokens || 0) || 0),
        totalTokens: Math.max(0, Number(item.totalTokens || 0) || 0),
        tokenSource: trimText(item.tokenSource || 'estimated') || 'estimated',
      }));
      const reminderShortcutRequests = aggregateSource.filter((item) => trimText(item?.path) === 'shortcut-reminder-write');
      const latestReminderShortcut = reminderShortcutRequests.length
        ? reminderShortcutRequests.slice(-1)[0]
        : null;
      const heaviestPrompt = aggregateSource
        .slice()
        .sort((a, b) => (Number(b.promptTokens || 0) - Number(a.promptTokens || 0)) || (Number(b.totalTokens || 0) - Number(a.totalTokens || 0)))
        .find(Boolean) || null;
      const slowestRequest = aggregateSource
        .slice()
        .sort((a, b) => Number(b.durationMs || 0) - Number(a.durationMs || 0))
        .find(Boolean) || null;
      return {
        requestCount: aggregateSource.length,
        sessionRequestCount: sessionRequests.length,
        runtimeRequestCount: runtimeRequests.length,
        promptTokens: aggregateSource.reduce((sum, item) => sum + Math.max(0, Number(item.promptTokens || 0) || 0), 0),
        completionTokens: aggregateSource.reduce((sum, item) => sum + Math.max(0, Number(item.completionTokens || 0) || 0), 0),
        totalTokens: aggregateSource.reduce((sum, item) => sum + Math.max(0, Number(item.totalTokens || 0) || 0), 0),
        totalDurationMs: aggregateSource.reduce((sum, item) => sum + Math.max(0, Number(item.durationMs || 0) || 0), 0),
        averageDurationMs: aggregateSource.length ? Math.round(aggregateSource.reduce((sum, item) => sum + Math.max(0, Number(item.durationMs || 0) || 0), 0) / aggregateSource.length) : 0,
        latestRequests,
        reminderShortcutWriteCount: reminderShortcutRequests.length,
        latestReminderShortcut: latestReminderShortcut
          ? {
              provider: trimText(latestReminderShortcut.provider),
              model: trimText(latestReminderShortcut.model),
              path: trimText(latestReminderShortcut.path),
              durationMs: Math.max(0, Number(latestReminderShortcut.durationMs || 0) || 0),
              totalTokens: Math.max(0, Number(latestReminderShortcut.totalTokens || 0) || 0),
            }
          : null,
        heaviestPrompt: heaviestPrompt
          ? {
              provider: trimText(heaviestPrompt.provider),
              model: trimText(heaviestPrompt.model),
              path: trimText(heaviestPrompt.path),
              promptTokens: Math.max(0, Number(heaviestPrompt.promptTokens || 0) || 0),
              totalTokens: Math.max(0, Number(heaviestPrompt.totalTokens || 0) || 0),
            }
          : null,
        slowestRequest: slowestRequest
          ? {
              provider: trimText(slowestRequest.provider),
              model: trimText(slowestRequest.model),
              path: trimText(slowestRequest.path),
              durationMs: Math.max(0, Number(slowestRequest.durationMs || 0) || 0),
              totalTokens: Math.max(0, Number(slowestRequest.totalTokens || 0) || 0),
            }
          : null,
      };
    }

    function buildSyncDebugSnapshot({ syncMode = '', syncReceipt = null } = {}) {
      const shellDescriptor = typeof api.getShellDescriptor === 'function'
        ? api.getShellDescriptor()
        : null;
      const bootPhase = typeof api.describeCurrentBootPhase === 'function'
        ? api.describeCurrentBootPhase()
        : '';
      const currentData = typeof api.getData === 'function'
        ? api.getData()
        : null;
      const currentMeta = currentData && typeof currentData === 'object' && currentData.syncMeta && typeof currentData.syncMeta === 'object'
        ? currentData.syncMeta
        : {};
      const webMeta = typeof api.getWebSyncRootMeta === 'function'
        ? api.getWebSyncRootMeta()
        : null;
      const syncMutationState = typeof api.getSyncMutationState === 'function'
        ? api.getSyncMutationState()
        : null;
      const safeReceipt = syncReceipt && typeof syncReceipt === 'object'
        ? syncReceipt
        : (typeof api.readLastSyncReceipt === 'function' ? api.readLastSyncReceipt() : null);
      const runtimeFootprint = {
        ...buildChatMetricsSnapshot(),
        ...buildStableMemoryMetricsSnapshot(),
        ...buildThoughtGraphMetricsSnapshot(),
        ...buildSurfaceMetricsSnapshot(),
        ...buildLargeDomRootsSnapshot(),
        ...buildStorageFootprintSnapshot(),
        ...buildRendererMemoryMetricsSnapshot(),
      };
      return {
        shellDescriptor,
        syncMode: String(syncMode || '').trim(),
        currentMeta: {
          revision: Number.isFinite(Number(currentMeta?.revision)) ? Number(currentMeta.revision) : 0,
          lastClientWriteAt: String(currentMeta?.lastClientWriteAt || '').trim(),
          deviceId: String(currentMeta?.deviceId || '').trim(),
        },
        browserMeta: {
          selectedMode: String(webMeta?.mode || '').trim() || 'none',
          liveDataPath: String(shellDescriptor?.canonicalStore?.pathHint || webMeta?.liveDataRelativePath || '').trim() || 'data/live-data.json（默认）',
          pathPrefix: String(webMeta?.pathPrefix || '').trim() || '/',
          selectedAt: String(webMeta?.selectedAt || '').trim(),
        },
        bridgeStatus: shellDescriptor?.bridgeStatus && typeof shellDescriptor.bridgeStatus === 'object'
          ? cloneJSONSafe(shellDescriptor.bridgeStatus)
          : null,
        receiptFeed: shellDescriptor?.receiptFeed && typeof shellDescriptor.receiptFeed === 'object'
          ? cloneJSONSafe(shellDescriptor.receiptFeed)
          : null,
        bootPhase: String(bootPhase || '').trim(),
        syncMutationState: syncMutationState && typeof syncMutationState === 'object'
          ? cloneJSONSafe(syncMutationState)
          : null,
        syncReceipt: safeReceipt && typeof safeReceipt === 'object'
          ? cloneJSONSafe(safeReceipt)
          : null,
        runtimeFootprint,
        syncInspection: buildSyncInspectionSnapshot({ syncReceipt: safeReceipt }),
        aiRequestMetrics: buildAIRequestMetricsSnapshot(),
      };
    }

    function buildExtensionDebugSnapshot() {
      const shellDescriptor = typeof api.getShellDescriptor === 'function'
        ? api.getShellDescriptor()
        : null;
      const lastActionTransaction = typeof api.getLastMorphActionTransaction === 'function'
        ? api.getLastMorphActionTransaction()
        : null;
      const taskRuntimeState = typeof api.getTaskRuntimeState === 'function'
        ? api.getTaskRuntimeState()
        : null;
      const actionTransactions = typeof api.getActionTransactions === 'function'
        ? api.getActionTransactions()
        : [];
      const currentView = typeof api.buildCurrentViewSnapshot === 'function'
        ? api.buildCurrentViewSnapshot()
        : null;
      const bootPhase = typeof api.describeCurrentBootPhase === 'function'
        ? api.describeCurrentBootPhase()
        : '';
      const syncInspection = buildSyncInspectionSnapshot();
      const actionInspection = buildActionInspectionSnapshot();
      const runtimeFootprint = {
        ...buildChatMetricsSnapshot(),
        ...buildStableMemoryMetricsSnapshot(),
        ...buildThoughtGraphMetricsSnapshot(),
        ...buildSurfaceMetricsSnapshot(),
        ...buildLargeDomRootsSnapshot(),
        ...buildStorageFootprintSnapshot(),
        ...buildRendererMemoryMetricsSnapshot(),
      };
      return {
        memorySummary: typeof api.buildMemoryHealthStatusSummary === 'function'
          ? String(api.buildMemoryHealthStatusSummary() || '').trim()
          : '',
        memoryReport: typeof api.getMemoryHealthReport === 'function'
          ? cloneJSONSafe(api.getMemoryHealthReport())
          : null,
        syncMutationState: typeof api.getSyncMutationState === 'function'
          ? cloneJSONSafe(api.getSyncMutationState())
          : null,
        taskRuntimeState: taskRuntimeState && typeof taskRuntimeState === 'object'
          ? cloneJSONSafe(taskRuntimeState)
          : null,
        actionTransactions: Array.isArray(actionTransactions)
          ? cloneJSONSafe(actionTransactions)
          : [],
        lastActionTransaction: lastActionTransaction && typeof lastActionTransaction === 'object'
          ? cloneJSONSafe(lastActionTransaction)
          : null,
        syncInspection,
        actionInspection,
        aiRequestMetrics: buildAIRequestMetricsSnapshot(),
        runtimeFootprint,
        runtimeSnapshot: {
          currentView: currentView && typeof currentView === 'object'
            ? cloneJSONSafe(currentView)
            : null,
          bootPhase: String(bootPhase || '').trim(),
          runtimeFootprint,
          receiptFeed: shellDescriptor?.receiptFeed && typeof shellDescriptor.receiptFeed === 'object'
            ? cloneJSONSafe(shellDescriptor.receiptFeed)
            : null,
          reminderNativeRoutingState: taskRuntimeState?.reminderNativeRoutingState && typeof taskRuntimeState.reminderNativeRoutingState === 'object'
            ? cloneJSONSafe(taskRuntimeState.reminderNativeRoutingState)
            : null,
        },
      };
    }

    return {
      shouldShowDebugStatus,
      buildSyncInspectionSnapshot,
      buildActionInspectionSnapshot,
      buildAIRequestMetricsSnapshot,
      buildSyncDebugSnapshot,
      buildExtensionDebugSnapshot,
    };
  }

  window.MorphObservabilityRuntime = {
    create: createObservabilityRuntime,
  };
})();
