(function initMorphAIMemoryWriteRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphAIMemoryWriteRuntime && typeof window.MorphAIMemoryWriteRuntime.create === 'function';
  const hasDepsRuntime = window.MorphAIMemoryWriteDepsRuntime && typeof window.MorphAIMemoryWriteDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function cloneJSONSafe(value) {
    try {
      return value == null ? value : JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function createAIMemoryWriteRuntimeModules(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const resolve = (name, fallback = null) => {
      if (typeof api[name] === 'function') return api[name];
      if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name];
      return fallback;
    };
    const getData = typeof api.getData === 'function'
      ? api.getData
      : () => (typeof data !== 'undefined' ? data : {});
    const getMorphSelfMemory = typeof api.getMorphSelfMemory === 'function'
      ? api.getMorphSelfMemory
      : null;
    const ensureAIMemoryShape = resolve('ensureAIMemoryShape', (target) => {
      if (!target || typeof target !== 'object') return target;
      target.aiMemory = target.aiMemory && typeof target.aiMemory === 'object' ? target.aiMemory : {};
      target.aiMemory.longTermMemory = target.aiMemory.longTermMemory && typeof target.aiMemory.longTermMemory === 'object'
        ? target.aiMemory.longTermMemory
        : {};
      target.aiMemory.workingMemory = target.aiMemory.workingMemory && typeof target.aiMemory.workingMemory === 'object'
        ? target.aiMemory.workingMemory
        : {};
      target.aiMemory.selfMemory = target.aiMemory.selfMemory && typeof target.aiMemory.selfMemory === 'object'
        ? target.aiMemory.selfMemory
        : {};
      return target;
    });
    const getAIMemory = typeof api.getAIMemory === 'function'
      ? api.getAIMemory
      : () => ensureAIMemoryShape(getData()).aiMemory;
    const getTodayStr = typeof api.getTodayStr === 'function'
      ? api.getTodayStr
      : () => new Date().toISOString().slice(0, 10);
    const genId = typeof api.genId === 'function'
      ? api.genId
      : () => `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const getCurrentAIFocusContext = resolve('getCurrentAIFocusContext', () => null);
    const buildMorphSharedIntentionality = resolve('buildMorphSharedIntentionality', () => ({ coordinationMode: 'execution' }));
    const inferMorphResponseMode = resolve('inferMorphResponseMode', () => ({ mode: 'solve' }));
    const summarizeRelationalMemoryPatterns = resolve('summarizeRelationalMemoryPatterns', () => ({}));
    const inferMorphInnerState = resolve('inferMorphInnerState', () => ({}));
    const buildMorphRelationalFlow = resolve('buildMorphRelationalFlow', () => ({}));
    const sanitizeMorphGrowthMemory = resolve('sanitizeMorphGrowthMemory', (value) => (value && typeof value === 'object' ? value : {}));
    const buildMorphDiscoursePlan = resolve('buildMorphDiscoursePlan', () => ({}));
    const buildMorphRelationalBridge = resolve('buildMorphRelationalBridge', () => ({}));
    const buildMorphGrowthState = resolve('buildMorphGrowthState', () => ({}));
    const buildMorphMoodField = resolve('buildMorphMoodField', () => ({}));
    const buildMorphValueConflict = resolve('buildMorphValueConflict', () => ({}));
    const buildMorphNarrativeMemory = resolve('buildMorphNarrativeMemory', (value) => (value && typeof value === 'object' ? value : {}));
    const buildMorphRelationalStyleMemory = resolve('buildMorphRelationalStyleMemory', (value) => (value && typeof value === 'object' ? value : {}));
    const buildMorphEnvironmentalMemory = resolve('buildMorphEnvironmentalMemory', (value) => (value && typeof value === 'object' ? value : {}));
    const buildMorphPresenceField = resolve('buildMorphPresenceField', () => ({}));
    const refreshLongTermFactsFromUserSignalsRuntime = resolve('refreshLongTermFactsFromUserSignalsRuntime', () => []);
    const rememberUserNameFromMessage = resolve('rememberUserNameFromMessage', () => {});
    const rememberStableUserPreferencesFromMessage = resolve('rememberStableUserPreferencesFromMessage', () => {});
    const evaluateMorphResponseFollowthrough = resolve('evaluateMorphResponseFollowthrough', () => ({ drift: [], landed: [], signals: [] }));
    const buildMorphGrowthMemory = resolve('buildMorphGrowthMemory', (previous = {}, growthState = null) => (growthState && typeof growthState === 'object' ? { ...growthState } : (previous && typeof previous === 'object' ? { ...previous } : {})));
    const updateMorphRecentMemoryBuffer = resolve('updateMorphRecentMemoryBuffer', () => {});
    const promoteMorphRecentMemoryEntries = resolve('promoteMorphRecentMemoryEntries', () => {});
    const pruneMorphPendingMemoryCandidates = resolve('pruneMorphPendingMemoryCandidates', () => {});
    const queueMorphPendingMemoryObservation = resolve('queueMorphPendingMemoryObservation', () => false);
    const promoteMorphPendingMemoryObservations = resolve('promoteMorphPendingMemoryObservations', () => 0);
    const upsertMorphRelationalThread = resolve('upsertMorphRelationalThread', () => {});
    const recordMorphInternalDecisionTrace = resolve('recordMorphInternalDecisionTrace', () => false);
    const getAISessionStateRuntimeModules = resolve('getAISessionStateRuntimeModules', () => null);
    const consumeMorphSoulMaterialActivationTurn = resolve('consumeMorphSoulMaterialActivationTurn', () => {});
    const refreshDurableVisibleMemoryFiles = resolve('refreshDurableVisibleMemoryFiles', () => {});
    const saveSilent = resolve('saveSilent', () => {});
    const inferRelationalMemoryOutcome = resolve('inferRelationalMemoryOutcome', (userText = '', assistantText = '') => {
      const cleanUser = String(userText || '').trim();
      const cleanAssistant = String(assistantText || '').trim();
      if (!cleanUser && !cleanAssistant) return '';
      return cleanAssistant || cleanUser || '';
    });
    const inferRelationalMemoryNeed = resolve('inferRelationalMemoryNeed', (userText = '', mode = '') => {
      const cleanUser = String(userText || '').trim();
      const cleanMode = String(mode || '').trim();
      if (!cleanUser && !cleanMode) return '';
      return cleanMode ? `${cleanMode}` : 'interaction';
    });
    const deriveRelationalMemoryTags = resolve('deriveRelationalMemoryTags', (userText = '', assistantText = '', mode = '', outcome = '') => {
      const tags = [mode, outcome, String(userText || '').trim() ? 'user' : '', String(assistantText || '').trim() ? 'assistant' : '']
        .map((item) => String(item || '').trim())
        .filter(Boolean);
      return Array.from(new Set(tags)).slice(0, 6);
    });
    const sanitizeSelfMemoryTextList = resolve('sanitizeSelfMemoryTextList', (value = [], fallback = []) => {
      if (!Array.isArray(value)) return Array.isArray(fallback) ? fallback : [];
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    });
    const sanitizeRelationalMemoryEntries = resolve('sanitizeRelationalMemoryEntries', (value = []) => {
      if (!Array.isArray(value)) return [];
      return value.filter((item) => item && typeof item === 'object');
    });
    const sanitizeMorphDualGuidance = resolve('sanitizeMorphDualGuidance', (value = null) => {
      return value && typeof value === 'object'
        ? value
        : {
            dominantMode: 'balanced',
            actionBias: 'guide-then-structure',
            visibility: 'internal-only',
            summary: '',
            rationale: '',
            focusPoints: [],
            promptDirectives: [],
            updatedAt: '',
          };
    });
    const sanitizeMorphInnerState = resolve('sanitizeMorphInnerState', (value = null) => (value && typeof value === 'object' ? value : {}));
    const sanitizeMorphDiscoursePlan = resolve('sanitizeMorphDiscoursePlan', (value = null) => (value && typeof value === 'object' ? value : {}));
    const sanitizeMorphGrowthState = resolve('sanitizeMorphGrowthState', (value = null) => (value && typeof value === 'object' ? value : {}));
    const buildCurrentTaskStateSnapshot = typeof api.buildCurrentTaskStateSnapshot === 'function'
      ? api.buildCurrentTaskStateSnapshot
      : null;
    const inferCurrentWorkflowState = typeof api.inferCurrentWorkflowState === 'function'
      ? api.inferCurrentWorkflowState
      : null;
    const buildMorphDualGuidance = typeof api.buildMorphDualGuidance === 'function'
      ? api.buildMorphDualGuidance
      : null;

    function appendRelationalMemoryEntry(userText = '', assistantText = '', responseMode = null, innerState = null, discoursePlan = null, growthState = null, followthrough = null) {
      const aiMemory = getAIMemory();
      if (!aiMemory.longTermMemory || typeof aiMemory.longTermMemory !== 'object') aiMemory.longTermMemory = {};
      if (!Array.isArray(aiMemory.longTermMemory.relationalMemory)) aiMemory.longTermMemory.relationalMemory = [];
      const safeInnerState = innerState && typeof innerState === 'object' ? innerState : sanitizeMorphInnerState(null);
      const safePlan = discoursePlan && typeof discoursePlan === 'object' ? discoursePlan : sanitizeMorphDiscoursePlan(null);
      const safeGrowth = growthState && typeof growthState === 'object' ? growthState : sanitizeMorphGrowthState(null);
      const safeFollowthrough = followthrough && typeof followthrough === 'object'
        ? {
            drift: sanitizeSelfMemoryTextList(followthrough.drift, []),
            landed: sanitizeSelfMemoryTextList(followthrough.landed, []),
            signals: sanitizeSelfMemoryTextList(followthrough.signals, []),
          }
        : { drift: [], landed: [], signals: [] };
      const cleanUser = String(userText || '').trim();
      const cleanAssistant = String(assistantText || '').trim();
      if (!cleanUser && !cleanAssistant) return;
      const baseOutcome = inferRelationalMemoryOutcome(cleanUser, cleanAssistant);
      const outcome = safeFollowthrough.drift.length
        ? `这轮还有点滑向：${safeFollowthrough.drift.join('；')}`
        : safeFollowthrough.landed.length
          ? `这轮更守住了：${safeFollowthrough.landed.join('；')}`
          : baseOutcome;
      aiMemory.longTermMemory.relationalMemory.push({
        id: genId(),
        at: new Date().toISOString(),
        mode: String(responseMode?.mode || safeInnerState.responseMode || 'solve'),
        userCue: cleanUser.slice(0, 220),
        assistantMove: `${String(safePlan.primaryFunction || '')}${safePlan.secondaryFunction ? ` -> ${String(safePlan.secondaryFunction)}` : ''}`.trim(),
        perceivedNeed: inferRelationalMemoryNeed(cleanUser, String(responseMode?.mode || safeInnerState.responseMode || '')),
        tension: String(safeInnerState.attachmentActivation?.[0] || safeGrowth.currentDrift?.[0] || '').trim(),
        notes: cleanAssistant.slice(0, 220),
        outcome,
        signals: Array.from(new Set([
          ...sanitizeSelfMemoryTextList(safeInnerState.affectTone, []),
          String(safeInnerState.awarenessCue || '').trim(),
          ...safeFollowthrough.signals,
        ].filter(Boolean))).slice(0, 6),
        tags: deriveRelationalMemoryTags(cleanUser, cleanAssistant, String(responseMode?.mode || safeInnerState.responseMode || 'solve'), outcome),
      });
      aiMemory.longTermMemory.relationalMemory = sanitizeRelationalMemoryEntries(aiMemory.longTermMemory.relationalMemory);
    }

    function buildMorphLongTermMemoryWriteDecision({
      dualGuidance = null,
      responseMode = null,
      sharedIntentionality = null,
      currentTaskState = null,
      actions = [],
      followthrough = null,
    } = {}) {
      const guidance = dualGuidance && typeof dualGuidance === 'object' ? sanitizeMorphDualGuidance(dualGuidance) : sanitizeMorphDualGuidance(null);
      const mode = String(responseMode?.mode || responseMode || '').trim().toLowerCase();
      const taskState = currentTaskState && typeof currentTaskState === 'object' ? currentTaskState : {};
      const actionLabels = Array.isArray(actions) ? actions.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const safeFollowthrough = followthrough && typeof followthrough === 'object'
        ? {
            drift: sanitizeSelfMemoryTextList(followthrough.drift, []),
            landed: sanitizeSelfMemoryTextList(followthrough.landed, []),
            signals: sanitizeSelfMemoryTextList(followthrough.signals, []),
          }
        : { drift: [], landed: [], signals: [] };
      const hasPendingDataIntent = !!String(taskState.pendingDataIntent || '').trim();
      const hasConcreteProgress = actionLabels.length > 0 || safeFollowthrough.landed.length > 0;
      if (hasPendingDataIntent || actionLabels.length) {
        return {
          mode: 'commit',
          rationale: '当前已有结构化动作或待落库意图，长期记忆可以同步收束。',
        };
      }
      if (sharedIntentionality?.needsClarification || guidance.actionBias === 'clarify-and-frame') {
        return {
          mode: 'observe',
          rationale: '当前仍需先澄清共享意向，先观察，不急着沉淀长期记忆。',
        };
      }
      if (
        mode === 'meaning'
        && String(sharedIntentionality?.coordinationMode || '').trim() === 'meaning-making'
        && String(sharedIntentionality?.alignmentConfidence || '').trim().toLowerCase() !== 'low'
      ) {
        return {
          mode: 'commit',
          rationale: '当前是在明确的意义/关系反思场景里，这类长期取向的理解可以谨慎沉淀。',
        };
      }
      if (guidance.dominantMode === 'oracle' && guidance.actionBias === 'hold-space' && !hasConcreteProgress) {
        return {
          mode: 'observe',
          rationale: '当前由 Oracle 主导且更偏 hold-space，先观察，不急着沉淀长期记忆。',
        };
      }
      if (['companionship', 'overload', 'boundary'].includes(mode) && !hasConcreteProgress) {
        return {
          mode: 'observe',
          rationale: '当前更偏陪伴/安顿/边界场景，先保留观察层，不直接固化长期记忆。',
        };
      }
      return {
        mode: 'commit',
        rationale: '当前已有足够结构或落地信号，可以同步沉淀长期记忆。',
      };
    }

    function appendAIInteractionMemory(userText, assistantText, actions = []) {
      const aiMemory = getAIMemory();
      const focus = typeof getCurrentAIFocusContext === 'function' ? getCurrentAIFocusContext() : null;
      const sharedIntentionality = buildMorphSharedIntentionality(userText, focus, aiMemory);
      const responseMode = inferMorphResponseMode(userText, focus, sharedIntentionality);
      const relationalSummary = summarizeRelationalMemoryPatterns(aiMemory?.longTermMemory?.relationalMemory, responseMode);
      const innerState = inferMorphInnerState(userText, focus, aiMemory, sharedIntentionality);
      const relationalFlow = buildMorphRelationalFlow(aiMemory?.workingMemory?.relationalFlow, relationalSummary, responseMode);
      const growthMemory = sanitizeMorphGrowthMemory(aiMemory?.longTermMemory?.growthMemory);
      const baseDiscoursePlan = buildMorphDiscoursePlan(userText, responseMode, innerState, relationalSummary, relationalFlow, growthMemory, sharedIntentionality, null);
      const relationalBridge = buildMorphRelationalBridge(
        aiMemory?.longTermMemory?.relationalThreads,
        sharedIntentionality,
        responseMode,
        relationalFlow,
        baseDiscoursePlan
      );
      const discoursePlan = buildMorphDiscoursePlan(userText, responseMode, innerState, relationalSummary, relationalFlow, growthMemory, sharedIntentionality, relationalBridge);
      const growthState = buildMorphGrowthState(innerState, getMorphSelfMemory ? getMorphSelfMemory(aiMemory) : aiMemory?.selfMemory || {}, relationalSummary, relationalFlow, growthMemory);
      const moodField = buildMorphMoodField(innerState, relationalFlow, growthMemory);
      const valueConflict = buildMorphValueConflict(innerState, getMorphSelfMemory ? getMorphSelfMemory(aiMemory) : aiMemory?.selfMemory || {}, responseMode, relationalSummary);
      const nextNarrativeMemory = buildMorphNarrativeMemory(aiMemory?.longTermMemory?.narrativeMemory, growthState, relationalFlow, responseMode);
      const nextRelationalStyleMemory = buildMorphRelationalStyleMemory(aiMemory?.longTermMemory?.relationalStyleMemory, relationalSummary, relationalFlow);
      const nextEnvironmentalMemory = buildMorphEnvironmentalMemory(aiMemory?.longTermMemory?.environmentalMemory, getMorphSelfMemory ? getMorphSelfMemory(aiMemory) : aiMemory?.selfMemory || {}, responseMode, relationalSummary, growthState);
      const presenceField = buildMorphPresenceField(innerState, getMorphSelfMemory ? getMorphSelfMemory(aiMemory) : aiMemory?.selfMemory || {}, responseMode, relationalSummary);
      const refreshedFactLabels = refreshLongTermFactsFromUserSignalsRuntime(userText, aiMemory);
      const dayKey = getTodayStr();
      if (!Array.isArray(aiMemory.dailyLogs[dayKey])) aiMemory.dailyLogs[dayKey] = [];
      const cleanUser = String(userText || '').trim();
      const cleanAssistant = String(assistantText || '').trim();
      rememberUserNameFromMessage(cleanUser, aiMemory);
      rememberStableUserPreferencesFromMessage(cleanUser, aiMemory);
      const followthrough = evaluateMorphResponseFollowthrough(cleanAssistant, discoursePlan, responseMode);
      const nextGrowthMemory = buildMorphGrowthMemory(growthMemory, growthState, relationalSummary, responseMode, followthrough);
      const summarySource = cleanAssistant || cleanUser || '互动记录';
      const summary = summarySource.length > 120 ? `${summarySource.slice(0, 120)}...` : summarySource;
      aiMemory.dailyLogs[dayKey].push({
        id: genId(),
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        user: cleanUser,
        assistant: cleanAssistant,
        summary,
        actions: Array.isArray(actions) ? actions.slice(0, 8) : [],
        memoryRefresh: refreshedFactLabels.slice(0, 3),
      });
      if (aiMemory.dailyLogs[dayKey].length > 50) {
        aiMemory.dailyLogs[dayKey] = aiMemory.dailyLogs[dayKey].slice(-50);
      }
      const allDays = Object.keys(aiMemory.dailyLogs).sort();
      if (allDays.length > 90) {
        allDays.slice(0, allDays.length - 90).forEach((day) => delete aiMemory.dailyLogs[day]);
      }
      if (!aiMemory.workingMemory || typeof aiMemory.workingMemory !== 'object') aiMemory.workingMemory = {};
      const nextTaskState = buildCurrentTaskStateSnapshot
        ? buildCurrentTaskStateSnapshot({
            previous: aiMemory.workingMemory.currentTaskState || aiMemory.currentTaskState,
            userText: cleanUser,
            assistantText: cleanAssistant,
            actions,
          })
        : (aiMemory.workingMemory.currentTaskState || aiMemory.currentTaskState);
      aiMemory.workingMemory.currentTaskState = nextTaskState;
      aiMemory.currentTaskState = aiMemory.workingMemory.currentTaskState;
      const provisionalWorkflowState = inferCurrentWorkflowState
        ? inferCurrentWorkflowState({
            previous: aiMemory.workingMemory.currentWorkflowState || aiMemory.currentWorkflowState,
            userText: cleanUser,
            assistantText: cleanAssistant,
            actions,
            currentTaskState: aiMemory.workingMemory.currentTaskState,
            responseMode,
            sharedIntentionality,
          })
        : (aiMemory.workingMemory.currentWorkflowState || aiMemory.currentWorkflowState);
      const provisionalDualGuidance = buildMorphDualGuidance
        ? buildMorphDualGuidance(cleanUser, {
            sharedIntentionality,
            responseMode,
            innerState,
            discoursePlan,
            currentTaskState: aiMemory.workingMemory.currentTaskState,
            currentWorkflowState: provisionalWorkflowState,
            actions,
            previous: aiMemory.workingMemory.dualGuidance,
          })
        : aiMemory.workingMemory.dualGuidance;
      const nextWorkflowState = inferCurrentWorkflowState
        ? inferCurrentWorkflowState({
            previous: aiMemory.workingMemory.currentWorkflowState || aiMemory.currentWorkflowState,
            userText: cleanUser,
            assistantText: cleanAssistant,
            actions,
            currentTaskState: aiMemory.workingMemory.currentTaskState,
            responseMode,
            sharedIntentionality,
            dualGuidance: provisionalDualGuidance,
          })
        : (aiMemory.workingMemory.currentWorkflowState || aiMemory.currentWorkflowState);
      aiMemory.workingMemory.currentWorkflowState = nextWorkflowState;
      aiMemory.currentWorkflowState = aiMemory.workingMemory.currentWorkflowState;
      const dualGuidance = buildMorphDualGuidance
        ? buildMorphDualGuidance(cleanUser, {
            sharedIntentionality,
            responseMode,
            innerState,
            discoursePlan,
            currentTaskState: aiMemory.workingMemory.currentTaskState,
            currentWorkflowState: aiMemory.workingMemory.currentWorkflowState,
            actions,
            previous: provisionalDualGuidance,
          })
        : provisionalDualGuidance;
      const memoryWriteDecision = buildMorphLongTermMemoryWriteDecision({
        dualGuidance,
        responseMode,
        sharedIntentionality,
        currentTaskState: aiMemory.workingMemory.currentTaskState,
        actions,
        followthrough,
      });
      aiMemory.workingMemory.sharedIntentionality = sharedIntentionality;
      aiMemory.workingMemory.relationalBridge = relationalBridge;
      aiMemory.workingMemory.innerState = innerState;
      aiMemory.workingMemory.discoursePlan = discoursePlan;
      aiMemory.workingMemory.dualGuidance = dualGuidance;
      aiMemory.workingMemory.growthState = growthState;
      aiMemory.workingMemory.relationalFlow = relationalFlow;
      aiMemory.workingMemory.moodField = moodField;
      aiMemory.workingMemory.valueConflict = valueConflict;
      aiMemory.workingMemory.presenceField = presenceField;
      updateMorphRecentMemoryBuffer({
        aiMemory,
        userText: cleanUser,
        assistantText: cleanAssistant,
        currentTaskState: aiMemory.currentTaskState,
        pendingCorrectionReconfirmation: aiMemory.workingMemory.pendingCorrectionReconfirmation,
        actions,
      });
      promoteMorphRecentMemoryEntries(aiMemory);
      pruneMorphPendingMemoryCandidates(aiMemory);
      if (aiMemory.workingMemory && typeof aiMemory.workingMemory === 'object') {
        aiMemory.workingMemory.pendingCorrectionReconfirmation = null;
        aiMemory.workingMemory.pendingProactiveReminder = null;
      }
      if (!aiMemory.longTermMemory || typeof aiMemory.longTermMemory !== 'object') aiMemory.longTermMemory = {};
      aiMemory.longTermMemory.dailyLogs = aiMemory.dailyLogs;
      if (memoryWriteDecision.mode === 'commit') {
        promoteMorphPendingMemoryObservations(2);
        aiMemory.longTermMemory.growthMemory = nextGrowthMemory;
        aiMemory.longTermMemory.narrativeMemory = nextNarrativeMemory;
        aiMemory.longTermMemory.relationalStyleMemory = nextRelationalStyleMemory;
        aiMemory.longTermMemory.environmentalMemory = nextEnvironmentalMemory;
        upsertMorphRelationalThread(sharedIntentionality, cleanUser, responseMode);
        appendRelationalMemoryEntry(cleanUser, cleanAssistant, responseMode, innerState, discoursePlan, growthState, followthrough);
      } else {
        queueMorphPendingMemoryObservation({
          source: 'interaction',
          summary: memoryWriteDecision.rationale || summary,
          userText: cleanUser,
          assistantText: cleanAssistant,
          responseMode: String(responseMode?.mode || ''),
          dominantMode: String(dualGuidance?.dominantMode || ''),
          actionBias: String(dualGuidance?.actionBias || ''),
          sharedIntentionality,
          innerState,
          discoursePlan,
          growthState,
          followthrough,
        });
      }
      recordMorphInternalDecisionTrace({
        kind: 'interaction',
        source: 'append_ai_interaction',
        summary: `${String(dualGuidance?.dominantMode || 'balanced')} / ${String(dualGuidance?.actionBias || 'guide-then-structure')} -> ${String(aiMemory.workingMemory.currentWorkflowState?.type || 'general')}:${String(aiMemory.workingMemory.currentWorkflowState?.step || 'active')} -> ${memoryWriteDecision.mode}`,
        responseMode: String(responseMode?.mode || ''),
        workflowType: String(aiMemory.workingMemory.currentWorkflowState?.type || ''),
        workflowStep: String(aiMemory.workingMemory.currentWorkflowState?.step || ''),
        memoryWriteMode: String(memoryWriteDecision.mode || ''),
        dominantMode: String(dualGuidance?.dominantMode || ''),
        actionBias: String(dualGuidance?.actionBias || ''),
        notes: [
          String(memoryWriteDecision.rationale || '').trim(),
          String(aiMemory.workingMemory.currentTaskState?.pendingDataIntent || '').trim() ? `pending:${String(aiMemory.workingMemory.currentTaskState.pendingDataIntent || '').trim()}` : '',
        ].filter(Boolean),
      });
      const sessionRuntime = typeof getAISessionStateRuntimeModules === 'function' ? getAISessionStateRuntimeModules() : null;
      if (sessionRuntime && typeof sessionRuntime.normalizeAISessionCoreState === 'function') {
        const sanitizeDualGuidanceRuntime = typeof sanitizeMorphDualGuidance === 'function' ? sanitizeMorphDualGuidance : null;
        const sanitizeInternalDecisionTraceRuntime = typeof sanitizeMorphInternalDecisionTrace === 'function' ? sanitizeMorphInternalDecisionTrace : null;
        sessionRuntime.normalizeAISessionCoreState(aiMemory, {
          normalizeChatSessions: false,
          sanitizeDualGuidance: sanitizeDualGuidanceRuntime,
          sanitizeInternalDecisionTrace: sanitizeInternalDecisionTraceRuntime,
        });
      } else {
        aiMemory.currentTaskState = aiMemory.workingMemory.currentTaskState;
        aiMemory.currentWorkflowState = aiMemory.workingMemory.currentWorkflowState;
        aiMemory.workingMemory.dualGuidance = dualGuidance;
        aiMemory.workingMemory.internalDecisionTrace = typeof sanitizeMorphInternalDecisionTrace === 'function'
          ? sanitizeMorphInternalDecisionTrace(aiMemory.workingMemory.internalDecisionTrace)
          : aiMemory.workingMemory.internalDecisionTrace;
      }
      if (String(userText || '').trim() !== 'runtime:proactive_scan') {
        consumeMorphSoulMaterialActivationTurn(aiMemory);
      }
      if (typeof refreshDurableVisibleMemoryFiles === 'function') refreshDurableVisibleMemoryFiles(aiMemory);
      saveSilent({ skipUndo: true });
    }

    return {
      appendRelationalMemoryEntry,
      buildMorphLongTermMemoryWriteDecision,
      appendAIInteractionMemory,
    };
  }

  window.MorphAIMemoryWriteRuntime = {
    create: createAIMemoryWriteRuntimeModules,
  };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createAIMemoryWriteDepsRuntime(root) {
    const currentRoot = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || currentRoot;
    const getGlobalFunction = (name = '') => {
      const key = String(name || '').trim();
      if (!key) return null;
      const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
      if (typeof fromGlobal === 'function') return fromGlobal;
      const fromRoot = currentRoot && typeof currentRoot[key] === 'function' ? currentRoot[key] : null;
      return typeof fromRoot === 'function' ? fromRoot : null;
    };
    const getGlobalValue = (name = '', fallback = null) => {
      const key = String(name || '').trim();
      if (!key) return fallback;
      if (globalRoot && typeof globalRoot[key] !== 'undefined') return globalRoot[key];
      if (currentRoot && typeof currentRoot[key] !== 'undefined') return currentRoot[key];
      return fallback;
    };

    function buildAppDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        getData: pickFunction(context.getData, () => {
          const value = getGlobalValue('data', null);
          return value && typeof value === 'object' ? value : {};
        }),
        getAIMemory: pickFunction(context.getAIMemory, getGlobalFunction('getAIMemory') || (() => ({}))),
        genId: pickFunction(context.genId, getGlobalFunction('genId') || (() => `id_${Date.now().toString(36)}`)),
        getTodayStr: pickFunction(context.getTodayStr, getGlobalFunction('getTodayStr') || (() => new Date().toISOString().slice(0, 10))),
        getCurrentAIFocusContext: pickFunction(context.getCurrentAIFocusContext, getGlobalFunction('getCurrentAIFocusContext') || (() => null)),
        getMorphSelfMemory: pickFunction(context.getMorphSelfMemory, getGlobalFunction('getMorphSelfMemory') || (() => ({}))),
        buildMorphSharedIntentionality: pickFunction(context.buildMorphSharedIntentionality, getGlobalFunction('buildMorphSharedIntentionality') || (() => ({ coordinationMode: 'execution' }))),
        inferMorphResponseMode: pickFunction(context.inferMorphResponseMode, getGlobalFunction('inferMorphResponseMode') || (() => ({ mode: 'solve' }))),
        summarizeRelationalMemoryPatterns: pickFunction(context.summarizeRelationalMemoryPatterns, getGlobalFunction('summarizeRelationalMemoryPatterns') || (() => ({}))),
        inferMorphInnerState: pickFunction(context.inferMorphInnerState, getGlobalFunction('inferMorphInnerState') || (() => ({}))),
        buildMorphRelationalFlow: pickFunction(context.buildMorphRelationalFlow, getGlobalFunction('buildMorphRelationalFlow') || (() => ({}))),
        sanitizeMorphGrowthMemory: pickFunction(context.sanitizeMorphGrowthMemory, getGlobalFunction('sanitizeMorphGrowthMemory') || ((value) => (value && typeof value === 'object' ? value : {}))),
        buildMorphDiscoursePlan: pickFunction(context.buildMorphDiscoursePlan, getGlobalFunction('buildMorphDiscoursePlan') || (() => ({}))),
        buildMorphRelationalBridge: pickFunction(context.buildMorphRelationalBridge, getGlobalFunction('buildMorphRelationalBridge') || (() => ({}))),
        buildMorphGrowthState: pickFunction(context.buildMorphGrowthState, getGlobalFunction('buildMorphGrowthState') || (() => ({}))),
        buildMorphMoodField: pickFunction(context.buildMorphMoodField, getGlobalFunction('buildMorphMoodField') || (() => ({}))),
        buildMorphValueConflict: pickFunction(context.buildMorphValueConflict, getGlobalFunction('buildMorphValueConflict') || (() => ({}))),
        buildMorphNarrativeMemory: pickFunction(context.buildMorphNarrativeMemory, getGlobalFunction('buildMorphNarrativeMemory') || ((value) => (value && typeof value === 'object' ? value : {}))),
        buildMorphRelationalStyleMemory: pickFunction(context.buildMorphRelationalStyleMemory, getGlobalFunction('buildMorphRelationalStyleMemory') || ((value) => (value && typeof value === 'object' ? value : {}))),
        buildMorphEnvironmentalMemory: pickFunction(context.buildMorphEnvironmentalMemory, getGlobalFunction('buildMorphEnvironmentalMemory') || ((value) => (value && typeof value === 'object' ? value : {}))),
        buildMorphPresenceField: pickFunction(context.buildMorphPresenceField, getGlobalFunction('buildMorphPresenceField') || (() => ({}))),
        refreshLongTermFactsFromUserSignalsRuntime: pickFunction(context.refreshLongTermFactsFromUserSignalsRuntime, getGlobalFunction('refreshLongTermFactsFromUserSignalsRuntime') || (() => [])),
        rememberUserNameFromMessage: pickFunction(context.rememberUserNameFromMessage, getGlobalFunction('rememberUserNameFromMessage') || (() => {})),
        rememberStableUserPreferencesFromMessage: pickFunction(context.rememberStableUserPreferencesFromMessage, getGlobalFunction('rememberStableUserPreferencesFromMessage') || (() => {})),
        evaluateMorphResponseFollowthrough: pickFunction(context.evaluateMorphResponseFollowthrough, getGlobalFunction('evaluateMorphResponseFollowthrough') || (() => ({ drift: [], landed: [], signals: [] }))),
        buildMorphGrowthMemory: pickFunction(context.buildMorphGrowthMemory, getGlobalFunction('buildMorphGrowthMemory') || ((previous = {}, growthState = null) => (growthState && typeof growthState === 'object' ? { ...growthState } : (previous && typeof previous === 'object' ? { ...previous } : {})))),
        updateMorphRecentMemoryBuffer: pickFunction(context.updateMorphRecentMemoryBuffer, getGlobalFunction('updateMorphRecentMemoryBuffer') || (() => {})),
        promoteMorphRecentMemoryEntries: pickFunction(context.promoteMorphRecentMemoryEntries, getGlobalFunction('promoteMorphRecentMemoryEntries') || (() => {})),
        pruneMorphPendingMemoryCandidates: pickFunction(context.pruneMorphPendingMemoryCandidates, getGlobalFunction('pruneMorphPendingMemoryCandidates') || (() => {})),
        queueMorphPendingMemoryObservation: pickFunction(context.queueMorphPendingMemoryObservation, getGlobalFunction('queueMorphPendingMemoryObservation') || (() => false)),
        promoteMorphPendingMemoryObservations: pickFunction(context.promoteMorphPendingMemoryObservations, getGlobalFunction('promoteMorphPendingMemoryObservations') || (() => 0)),
        upsertMorphRelationalThread: pickFunction(context.upsertMorphRelationalThread, getGlobalFunction('upsertMorphRelationalThread') || (() => {})),
        recordMorphInternalDecisionTrace: pickFunction(context.recordMorphInternalDecisionTrace, getGlobalFunction('recordMorphInternalDecisionTrace') || (() => false)),
        getAISessionStateRuntimeModules: pickFunction(context.getAISessionStateRuntimeModules, getGlobalFunction('getAISessionStateRuntimeModules') || (() => null)),
        consumeMorphSoulMaterialActivationTurn: pickFunction(context.consumeMorphSoulMaterialActivationTurn, getGlobalFunction('consumeMorphSoulMaterialActivationTurn') || (() => {})),
        refreshDurableVisibleMemoryFiles: pickFunction(context.refreshDurableVisibleMemoryFiles, getGlobalFunction('refreshDurableVisibleMemoryFiles') || (() => {})),
        saveSilent: pickFunction(context.saveSilent, getGlobalFunction('saveSilent') || (() => {})),
        inferRelationalMemoryOutcome: pickFunction(context.inferRelationalMemoryOutcome, getGlobalFunction('inferRelationalMemoryOutcome') || ((userText = '', assistantText = '') => String(assistantText || userText || '').trim())),
        inferRelationalMemoryNeed: pickFunction(context.inferRelationalMemoryNeed, getGlobalFunction('inferRelationalMemoryNeed') || ((userText = '', mode = '') => String(mode || userText || '').trim())),
        deriveRelationalMemoryTags: pickFunction(context.deriveRelationalMemoryTags, getGlobalFunction('deriveRelationalMemoryTags') || (() => [])),
        sanitizeSelfMemoryTextList: pickFunction(context.sanitizeSelfMemoryTextList, getGlobalFunction('sanitizeSelfMemoryTextList') || ((value = [], fallback = []) => (Array.isArray(value) ? value : (Array.isArray(fallback) ? fallback : [])))),
        sanitizeRelationalMemoryEntries: pickFunction(context.sanitizeRelationalMemoryEntries, getGlobalFunction('sanitizeRelationalMemoryEntries') || ((value = []) => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []))),
        sanitizeMorphDualGuidance: pickFunction(context.sanitizeMorphDualGuidance, getGlobalFunction('sanitizeMorphDualGuidance') || ((value) => value)),
        sanitizeMorphInnerState: pickFunction(context.sanitizeMorphInnerState, getGlobalFunction('sanitizeMorphInnerState') || ((value = null) => (value && typeof value === 'object' ? value : {}))),
        sanitizeMorphDiscoursePlan: pickFunction(context.sanitizeMorphDiscoursePlan, getGlobalFunction('sanitizeMorphDiscoursePlan') || ((value = null) => (value && typeof value === 'object' ? value : {}))),
        sanitizeMorphGrowthState: pickFunction(context.sanitizeMorphGrowthState, getGlobalFunction('sanitizeMorphGrowthState') || ((value = null) => (value && typeof value === 'object' ? value : {}))),
        buildCurrentTaskStateSnapshot: pickFunction(context.buildCurrentTaskStateSnapshot, getGlobalFunction('buildCurrentTaskStateSnapshot') || null),
        inferCurrentWorkflowState: pickFunction(context.inferCurrentWorkflowState, getGlobalFunction('inferCurrentWorkflowState') || null),
        buildMorphDualGuidance: pickFunction(context.buildMorphDualGuidance, getGlobalFunction('buildMorphDualGuidance') || null),
      };
    }

    return { buildAppDeps };
  }

  window.MorphAIMemoryWriteDepsRuntime = { create: () => createAIMemoryWriteDepsRuntime(window) };
})();
