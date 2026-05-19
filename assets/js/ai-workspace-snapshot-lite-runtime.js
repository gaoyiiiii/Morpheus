// @ts-check

(function initMorphAIWorkspaceSnapshotLiteRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIWorkspaceSnapshotLiteRuntime && typeof window.MorphAIWorkspaceSnapshotLiteRuntime.create === 'function') return;

  function createAIWorkspaceSnapshotLiteRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getDataRoot() {
      return typeof api.getDataRoot === 'function' ? api.getDataRoot() : {};
    }

    function call(name, args = [], fallback = null) {
      const method = api && typeof api[name] === 'function' ? api[name] : null;
      if (!method) return typeof fallback === 'function' ? fallback() : fallback;
      return method.apply(api, Array.isArray(args) ? args : []);
    }

    function normalizeSnapshotThoughtTimestampSource(value = '') {
      return String(value || '')
        .trim()
        .replace(/[年月]/g, '-')
        .replace(/[日]/g, ' ')
        .replace(/\//g, '-')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function parseSnapshotThoughtTimestamp(item = null) {
      if (!item || typeof item !== 'object') return 0;
      const fields = [item.updatedAt, item.createdAt, item.completedAt, item.time, item.date];
      for (let i = 0; i < fields.length; i += 1) {
        const normalized = normalizeSnapshotThoughtTimestampSource(fields[i]);
        if (!normalized) continue;
        const parsed = Date.parse(normalized);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
      const sortOrder = Number(item.sortOrder);
      if (Number.isFinite(sortOrder) && sortOrder > 0) return sortOrder;
      return 0;
    }

    function sortSnapshotThoughtsNewestFirst(items = []) {
      const list = Array.isArray(items) ? items : [];
      const hostSorted = call('sortThoughtsNewestFirst', [list], null);
      if (Array.isArray(hostSorted) && hostSorted.length === list.length) return hostSorted;
      return list
        .map((item, idx) => ({ item, idx, ts: parseSnapshotThoughtTimestamp(item) }))
        .sort((a, b) => (b.ts - a.ts) || (a.idx - b.idx))
        .map((entry) => entry.item);
    }

    function shouldExposeLegacyPluginSummary(pluginId = '') {
      const key = String(pluginId || '').trim();
      if (!key) return false;
      return call('isExtensionEnabled', [key], true) === true;
    }

    function buildAIWorkspaceSnapshotLite(question = '') {
      const promptQuestion = String(question || '');
      const data = getDataRoot() || {};
      const focus = call('getCurrentAIFocusContext', [], {});
      const ensured = call('ensureAIMemoryShape', [data], { aiMemory: {} }) || { aiMemory: {} };
      const aiMemory = ensured && typeof ensured === 'object' && ensured.aiMemory && typeof ensured.aiMemory === 'object' ? ensured.aiMemory : {};
      const sharedIntentionality = call('buildMorphSharedIntentionality', [promptQuestion, focus, aiMemory], {});
      const responseMode = call('inferMorphResponseMode', [promptQuestion, focus, sharedIntentionality], {});
      const temporalFrame = call('buildAuthoritativeTemporalFrame', [], {});
      const selfMemory = call('getMorphSelfMemory', [aiMemory], {});
      const longTermMemory = call('getMorphLongTermMemory', [aiMemory], {});
      const workingMemory = call('getMorphWorkingMemory', [aiMemory], {});
      const coreMemoryPacket = call('buildCoreMemoryPacket', [aiMemory], { version: 1, source: 'empty', identity: { preferredName: '', addressPreference: '' }, directives: [], hardInject: false });

      const currentTaskStateSource = workingMemory.currentTaskState && typeof workingMemory.currentTaskState === 'object' ? workingMemory.currentTaskState : null;
      const currentWorkflowStateSource = workingMemory.currentWorkflowState && typeof workingMemory.currentWorkflowState === 'object' ? workingMemory.currentWorkflowState : null;
      const currentTaskState = currentTaskStateSource && typeof currentTaskStateSource === 'object'
        ? {
            summary: String(currentTaskStateSource.summary || '').trim(),
            lastUserIntent: String(currentTaskStateSource.lastUserIntent || '').trim(),
            nextStep: String(currentTaskStateSource.nextStep || '').trim(),
            pendingDataIntent: String(currentTaskStateSource.pendingDataIntent || '').trim(),
            lastActionLabels: Array.isArray(currentTaskStateSource.lastActionLabels) ? currentTaskStateSource.lastActionLabels.slice(0, 6) : [],
            updatedAt: String(currentTaskStateSource.updatedAt || ''),
          }
        : null;
      const currentWorkflowState = currentWorkflowStateSource && typeof currentWorkflowStateSource === 'object'
        ? {
            type: String(currentWorkflowStateSource.type || '').trim(),
            step: String(currentWorkflowStateSource.step || '').trim(),
            targetName: String(currentWorkflowStateSource.targetName || '').trim(),
            summary: String(currentWorkflowStateSource.summary || '').trim(),
            updatedAt: String(currentWorkflowStateSource.updatedAt || ''),
          }
        : null;

      const pendingCorrectionReconfirmationSource = workingMemory.pendingCorrectionReconfirmation && typeof workingMemory.pendingCorrectionReconfirmation === 'object' ? workingMemory.pendingCorrectionReconfirmation : null;
      const pendingCorrectionReconfirmation = pendingCorrectionReconfirmationSource
        ? {
            message: String(pendingCorrectionReconfirmationSource.message || '').trim(),
            createdAt: String(pendingCorrectionReconfirmationSource.createdAt || ''),
            sourceSignals: Array.isArray(pendingCorrectionReconfirmationSource.sourceSignals)
              ? pendingCorrectionReconfirmationSource.sourceSignals.slice(0, 4).map((item) => String(item || '').trim()).filter(Boolean)
              : [],
          }
        : null;

      const pendingMemoryReconfirmationTasks = Array.isArray(workingMemory.pendingMemoryReconfirmationTasks)
        ? call('sanitizeMorphMemoryReconfirmationTasks', [workingMemory.pendingMemoryReconfirmationTasks], [])
            .filter((item) => item.status === 'pending')
            .slice(0, 3)
            .map((item) => ({
              factId: String(item.factId || '').trim(),
              label: String(item.label || '').trim(),
              message: String(item.message || '').trim(),
              reason: String(item.reason || '').trim(),
              createdAt: String(item.createdAt || '').trim(),
            }))
        : [];

      const pendingProactiveReminderSource = workingMemory.pendingProactiveReminder && typeof workingMemory.pendingProactiveReminder === 'object'
        ? workingMemory.pendingProactiveReminder
        : null;
      const pendingProactiveReminder = pendingProactiveReminderSource
        ? {
            message: String(pendingProactiveReminderSource.message || '').trim(),
            createdAt: String(pendingProactiveReminderSource.createdAt || ''),
            severity: String(pendingProactiveReminderSource.severity || '').trim(),
            source: String(pendingProactiveReminderSource.source || '').trim(),
            transitionHint: String(pendingProactiveReminderSource.transitionHint || '').trim(),
          }
        : null;

      const soulMaterialActivationSource = workingMemory.soulMaterialActivation && typeof workingMemory.soulMaterialActivation === 'object'
        ? workingMemory.soulMaterialActivation
        : null;
      const soulMaterialActivation = soulMaterialActivationSource
        ? {
            source: String(soulMaterialActivationSource.source || '').trim(),
            sectionTitle: String(soulMaterialActivationSource.sectionTitle || '').trim(),
            lines: Array.isArray(soulMaterialActivationSource.lines)
              ? soulMaterialActivationSource.lines.slice(0, 6).map((item) => String(item || '').trim()).filter(Boolean)
              : [],
            remainingTurns: Math.max(0, Math.min(3, Number.isFinite(Number(soulMaterialActivationSource.remainingTurns)) ? Number(soulMaterialActivationSource.remainingTurns) : 0)),
            updatedAt: String(soulMaterialActivationSource.updatedAt || '').trim(),
          }
        : null;

      const recentMemoryBuffer = call('pruneMorphRecentMemoryBuffer', [workingMemory.recentMemoryBuffer], []);
      const selectedLongTermFacts = call('prioritizeLongTermMemoryFactsRuntime', [longTermMemory.facts, promptQuestion, focus, {
        purpose: 'reply',
        limit: 4,
        archiveFacts: longTermMemory.factArchive,
        selfMemory,
      }], [])
        .slice(0, 4)
        .map((fact) => ({
          id: String(fact?.id || ''),
          category: String(fact?.category || ''),
          key: String(fact?.key || ''),
          label: String(fact?.label || ''),
          fact: String(fact?.fact || ''),
          source: String(fact?.source || ''),
          confidence: String(fact?.confidence || ''),
          lastConfirmedAt: String(fact?.lastConfirmedAt || ''),
          lastObservedAt: String(fact?.lastObservedAt || ''),
          status: String(fact?.status || ''),
          taskHints: Array.isArray(fact?.taskHints) ? fact.taskHints.slice(0, 6) : [],
          needsReconfirmation: fact?.needsReconfirmation === true,
          staleAt: String(fact?.staleAt || ''),
          scope: String(fact?.scope || ''),
          writeMode: String(fact?.writeMode || ''),
          stability: String(fact?.stability || ''),
          alwaysInject: fact?.alwaysInject === true,
        }))
        .filter((fact) => fact.fact);
      const stableDirectiveFacts = selectedLongTermFacts.filter((fact) => {
        if (!fact?.alwaysInject) return false;
        if (fact?.needsReconfirmation) return false;
        const scope = String(fact?.scope || '').trim();
        return ['identity', 'address', 'communication', 'boundary', 'relationship', 'workflow', 'persona-surface'].includes(scope);
      });

      const priorityPacketFacts = selectedLongTermFacts.filter((fact) => {
        const category = String(fact?.category || '').trim();
        if (['companionship', 'overload', 'boundary'].includes(String(responseMode.mode || ''))) return ['relationship', 'behavior'].includes(category);
        return true;
      });

      const priorityMemoryPacket = call('buildMorphPriorityMemoryPacket', [{
        stableDirectiveFacts,
        longTermFacts: priorityPacketFacts,
        pendingCorrectionReconfirmation,
        currentTaskState,
        currentWorkflowState,
      }], null);

      const expenseLedger = call('ensureExpenseLedgerShape', [data], { records: [] }) || { records: [] };
      const flashThoughts = sortSnapshotThoughtsNewestFirst(Array.isArray(data.flashThoughts) ? data.flashThoughts : []);
      const projects = Array.isArray(data.projects) ? data.projects : [];
      const routines = Array.isArray(data.routines) ? data.routines : [];
      const visibleFixedThoughts = call('getVisibleFixedThoughts', [], []);
      const asArray = (value) => Array.isArray(value) ? value : [];
      const getProjectParentId = (project) => String(project?.parentProjectId || project?.parentId || project?.spaceId || '');
      const projectReferenceCatalog = projects.map((project) => {
        const projectId = String(project?.id || '');
        return {
          projectId,
          projectName: String(project?.name || ''),
          items: asArray(project?.items).slice(0, 8).map((item) => ({
            id: String(item?.id || ''),
            text: String(item?.text || item?.title || item || '').slice(0, 80),
          })),
          blocks: asArray(project?.blocks).slice(0, 6).map((block) => ({
            id: String(block?.id || ''),
            type: String(block?.type || '').slice(0, 12),
            text: String(block?.content || block?.text || block?.title || '').slice(0, 100),
          })),
          childProjects: projects
            .filter((child) => child && String(child.id || '') !== projectId && getProjectParentId(child) === projectId)
            .slice(0, 16)
            .map((child) => ({
              id: String(child?.id || ''),
              name: String(child?.name || ''),
              referenceCount: asArray(child?.items).length,
              blockCount: asArray(child?.blocks).length,
            })),
        };
      }).filter((item) => item.projectName);
      const projectHierarchy = projects.map((project) => {
        const parentProjectId = getProjectParentId(project);
        const parent = parentProjectId
          ? projects.find((candidate) => String(candidate?.id || '') === parentProjectId)
          : null;
        return {
          projectId: String(project?.id || ''),
          projectName: String(project?.name || ''),
          parentProjectId,
          parentProjectName: String(parent?.name || ''),
        };
      }).filter((item) => item.projectName);

      return {
        todayDate: String(temporalFrame?.date || call('getTodayStr', [], '')),
        todayDailyLog: [],
        yesterdayDate: String(temporalFrame?.relativeDates?.yesterday || ''),
        yesterdayDailyLog: [],
        counts: {
          flashThoughts: flashThoughts.length,
          fixed: Array.isArray(visibleFixedThoughts) ? visibleFixedThoughts.length : 0,
          projects: projects.length,
          routines: routines.length,
          expenseRecords: Array.isArray(expenseLedger.records) ? expenseLedger.records.length : 0,
          currentMonthDailyBlocks: 0,
        },
        samples: {
          userExcerpt: String(longTermMemory.user || aiMemory.user || '').split('\n').slice(0, 12),
          memoryIndexExcerpt: String(longTermMemory.memoryIndex || aiMemory.memoryIndex || '').split('\n').slice(0, 12),
          identityExcerpt: String(longTermMemory.identityNotes || aiMemory.identityNotes || '').split('\n').slice(0, 8),
          coreMemoryPacket,
          priorityMemoryPacket,
          longTermFacts: selectedLongTermFacts,
          currentTaskState,
          currentWorkflowState,
          pendingCorrectionReconfirmation,
          pendingMemoryReconfirmationTasks,
          pendingProactiveReminder,
          soulMaterialActivation,
          recentMemoryBuffer,
          sharedIntentionality,
          temporalFrame,
          responseMode,
          flashThoughts: flashThoughts.slice(0, 8).map((item) => String(item?.text || item?.content || '').trim()).filter(Boolean),
          flashThoughtCatalog: flashThoughts.slice(0, 40).map((item) => ({
            id: String(item?.id || ''),
            text: String(item?.text || item?.content || '').slice(0, 100),
            clusterId: String(item?.clusterId || ''),
          })).filter((item) => item.id || item.text),
          projectNames: projects.map((project) => String(project?.name || '').trim()).filter(Boolean),
          projectReferenceCatalog,
          projectHierarchy,
          relevantSources: [],
          citationChains: call('buildAIRecallChains', [focus, []], []),
          appleHealthSummary: (() => {
            if (!shouldExposeLegacyPluginSummary('apple-health')) return null;
            const bundle = data?.appleHealthSync;
            if (!bundle || typeof bundle !== 'object') return null;
            const snap = bundle.snapshot && typeof bundle.snapshot === 'object' ? bundle.snapshot : null;
            if (!snap) {
              return {
                hasSnapshot: false,
                updatedAt: String(bundle.updatedAt || ''),
                source: String(bundle.source || ''),
              };
            }
            const hr = Array.isArray(snap.heartRateSamples) ? snap.heartRateSamples : [];
            const sleep = snap.sleep && typeof snap.sleep === 'object' ? snap.sleep : null;
            return {
              hasSnapshot: true,
              updatedAt: String(bundle.updatedAt || ''),
              source: String(bundle.source || ''),
              windowHours: snap.windowHours,
              steps: snap.steps,
              activeEnergyKcal: snap.activeEnergyKcal,
              restingHeartRateBpm: snap.restingHeartRateBpm,
              sleep: sleep ? { asleepHours: sleep.asleepHours, inBedHours: sleep.inBedHours } : null,
              heartRateSampleCount: hr.length,
            };
          })(),
        },
        currentView: call('buildMorphCurrentViewSnapshot', [{ blockSampleLimit: 3, includeActiveRoutine: true }], {}),
      };
    }

    return {
      buildAIWorkspaceSnapshotLite,
    };
  }

  window.MorphAIWorkspaceSnapshotLiteRuntime = {
    create: createAIWorkspaceSnapshotLiteRuntime,
  };
})();
