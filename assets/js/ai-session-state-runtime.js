(function () {
  const DEFAULT_CHAT_SESSION_MAX = 24;
  const DEFAULT_DECISION_TRACE_MAX = 24;

  function buildDefaultCurrentTaskState() {
    return {
      summary: '',
      lastUserIntent: '',
      nextStep: '',
      lastActionLabels: [],
      updatedAt: '',
    };
  }

  function buildDefaultCurrentWorkflowState() {
    return {
      type: '',
      step: '',
      targetName: '',
      summary: '',
      updatedAt: '',
    };
  }

  function buildDefaultAISessionStateCore() {
    return {
      currentTaskState: buildDefaultCurrentTaskState(),
      currentWorkflowState: buildDefaultCurrentWorkflowState(),
      chatSessions: [],
      currentChatSessionId: '',
    };
  }

  function sanitizeMorphDualGuidanceFallback(raw) {
    return {
      dominantMode: 'balanced',
      oracleWeight: Math.max(0, Math.min(12, Number.isFinite(Number(raw?.oracleWeight)) ? Number(raw.oracleWeight) : 1)),
      architectWeight: Math.max(0, Math.min(12, Number.isFinite(Number(raw?.architectWeight)) ? Number(raw.architectWeight) : 1)),
      actionBias: 'guide-then-structure',
      visibility: 'internal-only',
      summary: String(raw?.summary || '').trim().slice(0, 160),
      rationale: String(raw?.rationale || '').trim().slice(0, 220),
      focusPoints: Array.isArray(raw?.focusPoints)
        ? raw.focusPoints.slice(0, 6).map((item) => String(item || '').trim()).filter(Boolean)
        : [],
      promptDirectives: Array.isArray(raw?.promptDirectives)
        ? raw.promptDirectives.slice(0, 6).map((item) => String(item || '').trim()).filter(Boolean)
        : [],
      updatedAt: String(raw?.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphInternalDecisionTraceEntryFallback(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (value, allowed, fallback) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : fallback;
    return {
      id: String(src.id || '').trim(),
      kind: pick(src.kind, ['interaction', 'proactive'], 'interaction'),
      source: String(src.source || '').trim().slice(0, 48),
      summary: String(src.summary || '').trim().slice(0, 220),
      responseMode: String(src.responseMode || '').trim().slice(0, 40),
      workflowType: String(src.workflowType || '').trim().slice(0, 64),
      workflowStep: String(src.workflowStep || '').trim().slice(0, 64),
      memoryWriteMode: pick(src.memoryWriteMode, ['observe', 'commit', ''], ''),
      proactiveSurfaceDecision: pick(src.proactiveSurfaceDecision, ['surface', 'queue', 'skip', ''], ''),
      proactivePersistenceDecision: pick(src.proactivePersistenceDecision, ['persist', 'skip', ''], ''),
      dominantMode: pick(src.dominantMode, ['oracle', 'architect', 'balanced', ''], ''),
      actionBias: pick(src.actionBias, ['hold-space', 'clarify-and-frame', 'guide-then-structure', 'structure-and-advance', 'structure-and-commit', ''], ''),
      findingKeys: Array.isArray(src.findingKeys) ? src.findingKeys.slice(0, 6).map((item) => String(item || '').trim()).filter(Boolean) : [],
      notes: Array.isArray(src.notes) ? src.notes.slice(0, 6).map((item) => String(item || '').trim()).filter(Boolean) : [],
      createdAt: String(src.createdAt || '').trim(),
      updatedAt: String(src.updatedAt || '').trim(),
    };
  }

  function sanitizeMorphInternalDecisionTraceFallback(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => sanitizeMorphInternalDecisionTraceEntryFallback(item))
      .filter((item) => item.summary || item.kind === 'proactive')
      .slice(-DEFAULT_DECISION_TRACE_MAX);
  }

  function getSanitizeDualGuidance(options = {}) {
    return typeof options.sanitizeDualGuidance === 'function'
      ? options.sanitizeDualGuidance
      : sanitizeMorphDualGuidanceFallback;
  }

  function getSanitizeInternalDecisionTrace(options = {}) {
    return typeof options.sanitizeInternalDecisionTrace === 'function'
      ? options.sanitizeInternalDecisionTrace
      : sanitizeMorphInternalDecisionTraceFallback;
  }

  function normalizeChatSessions(target, options = {}) {
    const normalizeAIChatSession = typeof options.normalizeAIChatSession === 'function'
      ? options.normalizeAIChatSession
      : null;
    const maxSessions = Math.max(1, Number(options.maxChatSessions) || DEFAULT_CHAT_SESSION_MAX);
    const sessions = Array.isArray(target.chatSessions)
      ? target.chatSessions.filter((item) => item && typeof item === 'object')
      : [];
    const normalizedSessions = normalizeAIChatSession
      ? sessions.map((item) => normalizeAIChatSession(item)).filter(Boolean)
      : sessions;
    let keptSessions = normalizedSessions.slice(-maxSessions);

    if (typeof target.currentChatSessionId !== 'string') target.currentChatSessionId = '';
    target.currentChatSessionId = String(target.currentChatSessionId || '').trim();

    if (target.currentChatSessionId) {
      const currentSessionExists = keptSessions.some((item) => String(item?.id || '').trim() === target.currentChatSessionId);
      if (!currentSessionExists) {
        const currentSession = normalizedSessions.find((item) => String(item?.id || '').trim() === target.currentChatSessionId);
        if (currentSession) {
          keptSessions = maxSessions > 1
            ? keptSessions.slice(-(maxSessions - 1)).concat(currentSession)
            : [currentSession];
        }
      }
    }
    target.chatSessions = keptSessions;

    const currentSessionExists = target.currentChatSessionId
      && target.chatSessions.some((item) => String(item?.id || '').trim() === target.currentChatSessionId);
    if (currentSessionExists) return;

    const preferredSessionId = String(options.currentChatSessionId || '').trim();
    if (preferredSessionId && target.chatSessions.some((item) => String(item?.id || '').trim() === preferredSessionId)) {
      target.currentChatSessionId = preferredSessionId;
      return;
    }

    target.currentChatSessionId = String(target.chatSessions[target.chatSessions.length - 1]?.id || '').trim();
  }

  function normalizeAISessionCoreState(aiMemory, options = {}) {
    const target = aiMemory && typeof aiMemory === 'object' ? aiMemory : null;
    if (!target) return target;

    if (!target.workingMemory || typeof target.workingMemory !== 'object') target.workingMemory = {};
    const workingMemory = target.workingMemory;
    const defaultState = buildDefaultAISessionStateCore();

    if (!target.currentTaskState || typeof target.currentTaskState !== 'object') {
      target.currentTaskState = defaultState.currentTaskState;
    }
    if (!target.currentWorkflowState || typeof target.currentWorkflowState !== 'object') {
      target.currentWorkflowState = defaultState.currentWorkflowState;
    }

    const workingTaskState = workingMemory.currentTaskState && typeof workingMemory.currentTaskState === 'object'
      ? workingMemory.currentTaskState
      : null;
    const workingWorkflowState = workingMemory.currentWorkflowState && typeof workingMemory.currentWorkflowState === 'object'
      ? workingMemory.currentWorkflowState
      : null;

    if (!workingTaskState) {
      workingMemory.currentTaskState = target.currentTaskState;
    }
    if (!workingWorkflowState) {
      workingMemory.currentWorkflowState = target.currentWorkflowState;
    }

    target.currentTaskState = workingMemory.currentTaskState || defaultState.currentTaskState;
    target.currentWorkflowState = workingMemory.currentWorkflowState || defaultState.currentWorkflowState;

    const sanitizeDualGuidance = getSanitizeDualGuidance(options);
    workingMemory.dualGuidance = sanitizeDualGuidance(workingMemory.dualGuidance);

    const sanitizeInternalDecisionTrace = getSanitizeInternalDecisionTrace(options);
    workingMemory.internalDecisionTrace = sanitizeInternalDecisionTrace(workingMemory.internalDecisionTrace);

    if (options.normalizeChatSessions !== false) {
      normalizeChatSessions(target, options);
    } else {
      if (!Array.isArray(target.chatSessions)) target.chatSessions = [];
      if (typeof target.currentChatSessionId !== 'string') target.currentChatSessionId = '';
    }

    return target;
  }

  function resolvePreferredCurrentChatSessionId(aiMemory, options = {}) {
    const target = aiMemory && typeof aiMemory === 'object' ? aiMemory : null;
    const sessions = Array.isArray(target?.chatSessions) ? target.chatSessions : [];
    const hasSession = (sessionId = '') => {
      const normalizedId = String(sessionId || '').trim();
      return !!(normalizedId && sessions.some((item) => String(item?.id || '').trim() === normalizedId));
    };
    const liveCurrentChatSessionId = Object.prototype.hasOwnProperty.call(options, 'liveCurrentChatSessionId')
      ? String(options.liveCurrentChatSessionId || '').trim()
      : String(target?.currentChatSessionId || '').trim();
    if (hasSession(liveCurrentChatSessionId)) {
      return {
        currentChatSessionId: liveCurrentChatSessionId,
        currentSelectionSource: 'live-current',
      };
    }
    const preferredCurrentChatSessionId = String(options.preferredCurrentChatSessionId || options.currentChatSessionId || '').trim();
    if (hasSession(preferredCurrentChatSessionId)) {
      return {
        currentChatSessionId: preferredCurrentChatSessionId,
        currentSelectionSource: 'preferred-current',
      };
    }
    const storedCurrentChatSessionId = String(options.storedCurrentChatSessionId || '').trim();
    if (hasSession(storedCurrentChatSessionId)) {
      return {
        currentChatSessionId: storedCurrentChatSessionId,
        currentSelectionSource: 'stored-pointer',
      };
    }
    const fallbackCurrentChatSessionId = String(target?.currentChatSessionId || sessions[sessions.length - 1]?.id || '').trim();
    return {
      currentChatSessionId: fallbackCurrentChatSessionId,
      currentSelectionSource: fallbackCurrentChatSessionId ? 'fallback-latest' : 'empty',
    };
  }

  function prepareAIChatSessionRegistry(aiMemory, options = {}) {
    const target = aiMemory && typeof aiMemory === 'object' ? aiMemory : null;
    if (!target) {
      return {
        aiMemory: target,
        currentChatSessionId: '',
        currentSelectionSource: 'missing-ai-memory',
        storedCurrentChatSessionId: '',
        nextStoredCurrentChatSessionId: '',
        shouldPersistStoredCurrentChatSessionId: false,
        storedPointerStatus: 'missing-ai-memory',
        repairAttempted: false,
        repairApplied: false,
      };
    }

    const repairRegistry = typeof options.repairRegistry === 'function'
      ? options.repairRegistry
      : null;
    let repairAttempted = false;
    let repairApplied = false;
    if (repairRegistry) {
      repairAttempted = true;
      repairApplied = repairRegistry() === true;
    }

    const storedCurrentChatSessionId = String(options.storedCurrentChatSessionId || '').trim();
    const preferredCurrentChatSessionId = String(options.preferredCurrentChatSessionId || options.currentChatSessionId || '').trim();
    const liveCurrentChatSessionId = String(target.currentChatSessionId || '').trim();

    normalizeAISessionCoreState(target, {
      ...options,
      currentChatSessionId: liveCurrentChatSessionId || preferredCurrentChatSessionId || storedCurrentChatSessionId,
    });

    const selection = resolvePreferredCurrentChatSessionId(target, {
      ...options,
      liveCurrentChatSessionId,
      preferredCurrentChatSessionId,
      storedCurrentChatSessionId,
    });
    target.currentChatSessionId = String(selection.currentChatSessionId || '').trim();

    const nextStoredCurrentChatSessionId = String(target.currentChatSessionId || '').trim();
    let storedPointerStatus = 'empty';
    if (selection.currentSelectionSource === 'stored-pointer') {
      storedPointerStatus = 'accepted';
    } else if (storedCurrentChatSessionId && !nextStoredCurrentChatSessionId) {
      storedPointerStatus = 'cleared-empty';
    } else if (storedCurrentChatSessionId && storedCurrentChatSessionId !== nextStoredCurrentChatSessionId) {
      storedPointerStatus = selection.currentSelectionSource === 'live-current'
        ? 'overridden-by-live-current'
        : 'repointed';
    } else if (nextStoredCurrentChatSessionId) {
      storedPointerStatus = 'kept';
    }

    return {
      aiMemory: target,
      currentChatSessionId: nextStoredCurrentChatSessionId,
      currentSelectionSource: selection.currentSelectionSource,
      storedCurrentChatSessionId,
      nextStoredCurrentChatSessionId,
      shouldPersistStoredCurrentChatSessionId: storedCurrentChatSessionId !== nextStoredCurrentChatSessionId,
      storedPointerStatus,
      repairAttempted,
      repairApplied,
    };
  }

  function createAISessionStateRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const buildCurrentTaskStateSnapshot = typeof api.buildCurrentTaskStateSnapshot === 'function'
      ? api.buildCurrentTaskStateSnapshot
      : (value) => (value && typeof value === 'object' ? value : buildDefaultCurrentTaskState());
    const normalizeAIChatSession = typeof api.normalizeAIChatSession === 'function'
      ? api.normalizeAIChatSession
      : (session) => (session && typeof session === 'object' ? session : null);
    const normalizeAIChatSessions = typeof api.normalizeAIChatSessions === 'function'
      ? api.normalizeAIChatSessions
      : (value) => (Array.isArray(value) ? value : []);
    return {
      buildDefaultCurrentTaskState,
      buildDefaultCurrentWorkflowState,
      buildDefaultAISessionStateCore,
      buildCurrentTaskStateSnapshot,
      normalizeAIChatSession,
      normalizeAIChatSessions,
      sanitizeMorphInternalDecisionTraceEntry: sanitizeMorphInternalDecisionTraceEntryFallback,
      sanitizeMorphInternalDecisionTrace: sanitizeMorphInternalDecisionTraceFallback,
      normalizeAISessionCoreState,
      resolvePreferredCurrentChatSessionId,
      prepareAIChatSessionRegistry,
    };
  }

  window.MorphAISessionStateRuntime = {
    create: createAISessionStateRuntime,
  };
})();
