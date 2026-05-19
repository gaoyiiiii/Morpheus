// @ts-check

(function initMorphAIWorkspaceSnapshotRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIWorkspaceSnapshotRuntime && typeof window.MorphAIWorkspaceSnapshotRuntime.create === 'function') return;

  function createAIWorkspaceSnapshotRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getGlobalMethod(name) {
      if (!name) return null;
      try {
        if (typeof api[name] === 'function') return api[name];
      } catch (_) {}
      try {
        if (typeof window !== 'undefined' && typeof window[name] === 'function') return window[name];
      } catch (_) {}
      try {
        if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name];
      } catch (_) {}
      return null;
    }

    function getDataRoot() {
      if (typeof api.getDataRoot === 'function') return api.getDataRoot() || {};
      try {
        return typeof data !== 'undefined' ? (data || {}) : {};
      } catch (_) {
        return {};
      }
    }

    function call(name, args = [], fallback = null) {
      const method = getGlobalMethod(name);
      if (!method) return typeof fallback === 'function' ? fallback() : fallback;
      try {
        return method.apply(api, Array.isArray(args) ? args : []);
      } catch (_) {
        return typeof fallback === 'function' ? fallback() : fallback;
      }
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

    function buildAIWorkspaceSnapshotFallback(question = '') {
        const promptQuestion = String(question || '');
        const data = getDataRoot() || {};
        const focus = call('getCurrentAIFocusContext', [], {});
        const ensured = call('ensureAIMemoryShape', [data], { aiMemory: {} }) || { aiMemory: {} };
        const aiMemory = ensured && typeof ensured === 'object' && ensured.aiMemory && typeof ensured.aiMemory === 'object' ? ensured.aiMemory : {};
        const sharedIntentionality = call('buildMorphSharedIntentionality', [promptQuestion, focus, aiMemory], {});
        const responseMode = call('inferMorphResponseMode', [promptQuestion, focus, sharedIntentionality], {});
        const temporalFrame = call('buildAuthoritativeTemporalFrame', [], {});
        const monthKey = focus.selectedDailyMonth || call('getMonthStr', [], '');
        const asArray = (value) => Array.isArray(value) ? value : [];
        const dailyBlocks = asArray(data.dailyMonths?.[monthKey]);
        const {
          todayDate = String(temporalFrame?.date || call('getTodayStr', [], '')),
          todayDailyLog = [],
          yesterdayDate = String(temporalFrame?.relativeDates?.yesterday || ''),
          yesterdayDailyLog = [],
        } = call('getTodayAndYesterdayDailyLogExcerpts', [monthKey], {});
        const recentDailyLogs = call('buildRecentDailyLogExcerpts', [6, 4], []);
        const sampleTexts = (items, limit = 6) => asArray(items).slice(0, limit).map((item) => (item.text || item.content || '').trim()).filter(Boolean);
        const selfMemory = call('getMorphSelfMemory', [aiMemory], {});
        const longTermMemory = call('getMorphLongTermMemory', [aiMemory], {});
        const workingMemory = call('getMorphWorkingMemory', [aiMemory], {});
        const coreMemoryPacket = call('buildCoreMemoryPacket', [aiMemory], { version: 1, source: 'empty', identity: { preferredName: '', addressPreference: '' }, directives: [], hardInject: false });
        const innerState = call('inferMorphInnerState', [promptQuestion, focus, aiMemory, sharedIntentionality], {});
        const relationalMemory = call('buildRelevantRelationalMemory', [longTermMemory.relationalMemory, responseMode], []);
        const relationalThreads = call('buildMorphRelationalThreads', [longTermMemory.relationalThreads, responseMode], []);
        const relationalMemorySummary = call('summarizeRelationalMemoryPatterns', [longTermMemory.relationalMemory, responseMode], {});
        const relationalFlow = call('buildMorphRelationalFlow', [workingMemory.relationalFlow, relationalMemorySummary, responseMode], {});
        const growthMemory = call('sanitizeMorphGrowthMemory', [longTermMemory.growthMemory], []);
        const baseDiscoursePlan = call('buildMorphDiscoursePlan', [promptQuestion, responseMode, innerState, relationalMemorySummary, relationalFlow, growthMemory, sharedIntentionality, null], {});
        const relationalBridge = call('buildMorphRelationalBridge', [relationalThreads, sharedIntentionality, responseMode, relationalFlow, baseDiscoursePlan], {});
        const discoursePlan = call('buildMorphDiscoursePlan', [promptQuestion, responseMode, innerState, relationalMemorySummary, relationalFlow, growthMemory, sharedIntentionality, relationalBridge], {});
        const growthState = call('buildMorphGrowthState', [innerState, selfMemory, relationalMemorySummary, relationalFlow, growthMemory], {});
        const moodField = call('buildMorphMoodField', [innerState, relationalFlow, growthMemory], {});
        const valueConflict = call('buildMorphValueConflict', [innerState, selfMemory, responseMode, relationalMemorySummary], {});
        const narrativeMemory = call('buildMorphNarrativeMemory', [longTermMemory.narrativeMemory, growthState, relationalFlow, responseMode], []);
        const relationalStyleMemory = call('buildMorphRelationalStyleMemory', [longTermMemory.relationalStyleMemory, relationalMemorySummary, relationalFlow], {});
        const environmentalMemory = call('buildMorphEnvironmentalMemory', [longTermMemory.environmentalMemory, selfMemory, responseMode, relationalMemorySummary, growthState], {});
        const presenceField = call('buildMorphPresenceField', [innerState, selfMemory, responseMode, relationalMemorySummary], {});
        const recentMemoryDays = Object.keys(longTermMemory.dailyLogs || aiMemory.dailyLogs || {}).sort().slice(-3);
        const recallQuestion = ['companionship', 'overload', 'boundary', 'meaning'].includes(String(responseMode.mode || ''))
            ? promptQuestion.trim()
            : call('buildRecallAugmentedQuestion', [promptQuestion, workingMemory.currentTaskState || null, workingMemory.currentWorkflowState || null], promptQuestion.trim());
        const contextualRecall = call('buildDeterministicAIRecall', [recallQuestion, focus], { citations: [], citationChains: [] }) || { citations: [], citationChains: [] };
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
        const pendingCorrectionReconfirmation = pendingCorrectionReconfirmationSource ? { message: String(pendingCorrectionReconfirmationSource.message || '').trim(), createdAt: String(pendingCorrectionReconfirmationSource.createdAt || ''), sourceSignals: Array.isArray(pendingCorrectionReconfirmationSource.sourceSignals) ? pendingCorrectionReconfirmationSource.sourceSignals.slice(0, 4).map((item) => String(item || '').trim()).filter(Boolean) : [], } : null;
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
        const dualGuidance = call('buildMorphDualGuidance', [promptQuestion, {
            sharedIntentionality,
            responseMode,
            innerState,
            discoursePlan,
            currentTaskState,
            currentWorkflowState,
            previous: workingMemory.dualGuidance,
        }], null);
        const replySelectionPolicy = call('inferLongTermMemorySelectionPolicyRuntime', [recallQuestion, focus, { purpose: 'reply', selfMemory }], {});
        const longTermSelectionReport = call('buildLongTermMemorySelectionReportRuntime', [longTermMemory.facts, longTermMemory.factArchive, recallQuestion, focus, { purpose: 'reply', limit: 12, selfMemory }], []);
        const longTermSelectionSignals = call('aggregateLongTermMemorySelectionSignalsRuntime', [longTermSelectionReport], {});
        const longTermTelemetry = call('buildLongTermMemoryTelemetryReportRuntime', [longTermSelectionReport, longTermSelectionSignals, replySelectionPolicy], {});
        const longTermFacts = longTermSelectionReport.map((entry) => {
            const fact = entry.fact;
            return ({
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
            reconfirmAfterDays: Number.isFinite(Number(fact?.reconfirmAfterDays)) ? Number(fact.reconfirmAfterDays) : 0,
            needsReconfirmation: fact?.needsReconfirmation === true,
            needsReconfirmationReason: String(fact?.needsReconfirmationReason || ''),
            staleAt: String(fact?.staleAt || ''),
            versionGroup: String(fact?.versionGroup || ''),
            supersedes: String(fact?.supersedes || ''),
            referenceStrength: call('deriveLongTermFactReferenceStrengthRuntime', [fact, longTermMemory.factArchive, replySelectionPolicy], ''),
            trustLevel: entry.trustLevel,
            mustConfirmBeforeUse: entry.mustConfirmBeforeUse === true,
            isLatestVersion: entry.isLatestVersion === true,
            selectionReason: String(entry.selectionReason || ''),
            ambiguous: entry.ambiguous === true,
            selectionConfidence: String(entry.selectionConfidence || ''),
            reasonCodes: Array.isArray(entry.reasonCodes) ? entry.reasonCodes.slice(0, 6) : [],
            scoreGap: Number(entry.scoreGap || 0),
            scope: String(fact?.scope || ''),
            writeMode: String(fact?.writeMode || ''),
            stability: String(fact?.stability || ''),
            alwaysInject: fact?.alwaysInject === true,
        });
        }).filter((fact) => fact.fact);
        const stableDirectiveFacts = longTermFacts.filter((fact) => {
            if (!fact?.alwaysInject) return false;
            if (fact?.mustConfirmBeforeUse || fact?.needsReconfirmation) return false;
            const scope = String(fact?.scope || '').trim();
            return ['identity', 'address', 'communication', 'boundary', 'relationship', 'workflow', 'persona-surface'].includes(scope);
        });
        const priorityPacketFacts = longTermFacts.filter((fact) => {
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
        const expenseLedger = call('ensureExpenseLedgerShape', [data], { categories: [], records: [] }) || { categories: [], records: [] };
        const flashThoughts = sortSnapshotThoughtsNewestFirst(asArray(data.flashThoughts));
        const projects = asArray(data.projects);
        const routines = asArray(data.routines);
        const visibleFixedThoughts = call('getVisibleFixedThoughts', [], []);
        const reminderList = call('getReminderList', [], []);
        return {
            todayDate,
            todayDailyLog,
            yesterdayDate,
            yesterdayDailyLog,
            counts: {
                flashThoughts: flashThoughts.length,
                fixed: asArray(visibleFixedThoughts).length,
                projects: projects.length,
                routines: routines.length,
                expenseRecords: asArray(expenseLedger.records).length,
                currentMonthDailyBlocks: dailyBlocks.length,
            },
            samples: {
                flashThoughts: sampleTexts(flashThoughts, 8),
                flashThoughtCatalog: flashThoughts.slice(0, 80).map((item) => ({
                    id: item.id,
                    text: String(item.text || '').slice(0, 100),
                    clusterId: item.clusterId || '',
                })),
                projectReferenceCatalog: projects.map((p) => ({
                    projectId: p.id,
                    projectName: p.name || '',
                    items: asArray(p.items).slice(0, 25).map((item) => ({ id: item.id, text: String(item.text || '').slice(0, 100) })),
                    blocks: asArray(p.blocks).slice(0, 16).map((block) => ({
                        id: block.id,
                        type: String(block.type || '').slice(0, 12),
                        text: String(block.content || '').slice(0, 140),
                    })),
                    childProjects: projects
                        .filter((child) => child && child.id !== p.id && String(child.parentProjectId || child.parentId || child.spaceId || '') === String(p.id || ''))
                        .slice(0, 16)
                        .map((child) => ({
                            id: child.id,
                            name: child.name || '',
                            referenceCount: asArray(child.items).length,
                            blockCount: asArray(child.blocks).length,
                        })),
                })),
                manualOrganizationLog: asArray(aiMemory.manualOrganizationLog).slice(-20).map((e) => ({
                    type: e.type,
                    ...(e.projectName && { projectName: e.projectName }),
                    ...(e.fromProjectName && { fromProjectName: e.fromProjectName }),
                    ...(e.toProjectName && { toProjectName: e.toProjectName }),
                    ...(e.textSnippet && { textSnippet: String(e.textSnippet).slice(0, 56) }),
                })),
                projectHierarchy: projects.map((p) => {
                    const parentId = String(p.parentProjectId || p.parentId || p.spaceId || '');
                    const parent = parentId ? projects.find((candidate) => String(candidate.id || '') === parentId) : null;
                    return {
                        projectId: p.id,
                        projectName: p.name || '',
                        parentProjectId: parentId,
                        parentProjectName: parent?.name || '',
                    };
                }).filter((item) => item.projectName),
                coreMemoryPacket,
                fixed: sampleTexts(visibleFixedThoughts, 6),
                projectNames: projects.slice(0, 40).map((item) => item.name),
                reminders: reminderList.slice(0, 80).map((item) => ({
                    id: item.id,
                    text: String(item.text || '').slice(0, 120),
                    dueAtText: String(item.dueAtText || ''),
                    status: String(item.status || 'pending'),
                })),
                expenseLedger: {
                    categories: expenseLedger.categories.slice(0, 24),
                    recentRecords: expenseLedger.records.slice(0, 40).map((item) => ({
                        id: item.id,
                        item: String(item.item || '').slice(0, 48),
                        category: String(item.category || '').slice(0, 20),
                        amount: Number(item.amount || 0),
                        spentAt: String(item.spentAt || ''),
                    })),
                },
                dailyLogCatalog: call('collectDailyLogEntryRefs', [160], []).map((entry) => ({
                    id: entry.blockId,
                    date: entry.dateStr,
                    text: String(entry.text || '').slice(0, 140),
                })),
                recentDailyLogs,
                currentDaily: dailyBlocks.slice(0, 10).map((block) => `${block.type}:${(block.content || '').trim()}`).filter(Boolean),
                recentAIMemory: recentMemoryDays.flatMap((day) => asArray((longTermMemory.dailyLogs || aiMemory.dailyLogs || {})[day]).slice(-2).map((entry) => `[${day}] ${entry.summary || ''}`)).slice(-6),
                userExcerpt: String(longTermMemory.user || aiMemory.user || '').split('\n').slice(0, 16),
                memoryIndexExcerpt: String(longTermMemory.memoryIndex || aiMemory.memoryIndex || '').split('\n').slice(0, 16),
                identityExcerpt: String(longTermMemory.identityNotes || aiMemory.identityNotes || '').split('\n').slice(0, 12),
                currentTaskState,
                currentWorkflowState,
                pendingCorrectionReconfirmation,
                pendingMemoryReconfirmationTasks,
                pendingProactiveReminder,
                soulMaterialActivation,
                recentMemoryBuffer,
                sharedIntentionality,
                innerState,
                discoursePlan,
                dualGuidance,
                growthState,
                relationalFlow,
                growthMemory,
                temporalFrame,
                responseMode,
                priorityMemoryPacket,
                longTermFacts,
                longTermFactSelection: longTermSelectionSignals,
                longTermFactTelemetry: longTermTelemetry,
                relevantSources: contextualRecall.citations,
                citationChains: contextualRecall.citationChains,
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
                        windowStart: String(snap.windowStart || '').slice(0, 22),
                        windowEnd: String(snap.windowEnd || '').slice(0, 22),
                        steps: snap.steps,
                        distanceMeters: snap.distanceMeters,
                        activeEnergyKcal: snap.activeEnergyKcal,
                        restingHeartRateBpm: snap.restingHeartRateBpm,
                        sleep: sleep ? { asleepHours: sleep.asleepHours, inBedHours: sleep.inBedHours } : null,
                        heartRateSampleCount: hr.length,
                        heartRateRecent: hr.slice(0, 10).map((s) => ({ at: String(s?.at || '').slice(11, 19), bpm: s?.bpm })),
                        bodyMassKg: snap.bodyMassKg,
                        bloodGlucoseMmolPerL: snap.bloodGlucoseMmolPerL,
                    };
                })(),
            },
            currentView: call('buildMorphCurrentViewSnapshot', [{ blockSampleLimit: 12, includeActiveRoutine: true }], {
                tab: String(focus?.tab || '').trim(),
                selectedDailyMonth: String(focus?.selectedDailyMonth || '').trim(),
                activeProject: null,
                activeRoutine: null,
            }),
        };
    }

    function buildAIWorkspaceSnapshot(question = '') {
        return buildAIWorkspaceSnapshotFallback(question);
    }

    function buildMorphMemoryAuditSnapshot(aiMemory = null, options = {}) {
        const targetMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : call('getAIMemory', [], {});
        const workingMemory = call('getMorphWorkingMemory', [targetMemory], {});
        const longTermMemory = call('getMorphLongTermMemory', [targetMemory], {});
        const recentMemoryBuffer = call('pruneMorphRecentMemoryBuffer', [workingMemory.recentMemoryBuffer], { user: [], self: [], task: [] });
        const pendingCandidates = call('pruneMorphPendingMemoryCandidates', [targetMemory], []).slice(-12).reverse();
        const explicitMemoryLog = (Array.isArray(targetMemory?.explicitMemoryLog) ? targetMemory.explicitMemoryLog : []).slice(0, 12);
        const activeFacts = (Array.isArray(longTermMemory?.facts) ? longTermMemory.facts : []).map((item) => call('sanitizeLongTermMemoryFact', [item], item));
        const factArchive = (Array.isArray(longTermMemory?.factArchive) ? longTermMemory.factArchive : []).map((item) => call('sanitizeLongTermMemoryFact', [item], item));
        const memoryWriteReceipts = call('sanitizeMorphMemoryWriteReceipts', [longTermMemory?.memoryWriteReceipts], []).slice(0, 10);
        const memoryReconciliation = call('sanitizeMorphMemoryReconcileResults', [workingMemory?.memoryReconciliation], []).slice(0, 10);
        const memoryConflictLog = call('sanitizeMorphMemoryConflictResults', [workingMemory?.memoryConflictLog], []).slice(0, 10);
        const pendingReconfirmationTasks = call('sanitizeMorphMemoryReconfirmationTasks', [workingMemory?.pendingMemoryReconfirmationTasks], []).slice(0, 10);
        const asCountMap = (entries, pickKey) => { const map = {}; (Array.isArray(entries) ? entries : []).forEach((entry) => { const key = String(pickKey(entry) || '').trim() || 'unknown'; map[key] = (map[key] || 0) + 1; }); return map; };
        return {
            generatedAt: new Date().toISOString(),
            overview: {
                recentUserCount: recentMemoryBuffer.user.length,
                recentSelfCount: recentMemoryBuffer.self.length,
                recentTaskCount: recentMemoryBuffer.task.length,
                pendingCandidateCount: pendingCandidates.length,
                explicitMemoryCount: explicitMemoryLog.length,
                activeFactCount: activeFacts.length,
                archivedFactCount: factArchive.length,
                receiptCount: memoryWriteReceipts.length,
                reconcileCount: memoryReconciliation.length,
                conflictCount: memoryConflictLog.length,
                pendingReconfirmationCount: pendingReconfirmationTasks.filter((item) => String(item?.status || '') === 'pending').length,
            },
            recent: {
                user: recentMemoryBuffer.user.map((entry) => ({
                    text: String(entry?.text || '').trim(),
                    source: String(entry?.source || '').trim(),
                    createdAt: String(entry?.createdAt || '').trim(),
                })),
                self: recentMemoryBuffer.self.map((entry) => ({
                    text: String(entry?.text || '').trim(),
                    source: String(entry?.source || '').trim(),
                    createdAt: String(entry?.createdAt || '').trim(),
                })),
                task: recentMemoryBuffer.task.map((entry) => ({
                    text: String(entry?.text || '').trim(),
                    source: String(entry?.source || '').trim(),
                    createdAt: String(entry?.createdAt || '').trim(),
                })),
            },
            candidates: {
                byWriteTier: asCountMap(pendingCandidates, (entry) => entry?.writeTier),
                byScope: asCountMap(pendingCandidates, (entry) => entry?.scope),
                items: pendingCandidates.map((entry) => ({
                    id: String(entry?.id || '').trim(),
                    scope: String(entry?.scope || '').trim(),
                    candidateType: String(entry?.candidateType || '').trim(),
                    writeTier: String(entry?.writeTier || '').trim(),
                    sectionTitle: String(entry?.sectionTitle || '').trim(),
                    stableKey: String(entry?.stableKey || '').trim(),
                    status: String(entry?.status || '').trim(),
                    content: String(entry?.content || '').trim(),
                    updatedAt: String(entry?.updatedAt || entry?.createdAt || '').trim(),
                })),
            },
            explicit: {
                sections: asCountMap(explicitMemoryLog, (entry) => entry?.sectionTitle),
                items: explicitMemoryLog.map((entry) => ({
                    id: String(entry?.id || '').trim(),
                    scope: String(entry?.scope || '').trim(),
                    sectionTitle: String(entry?.sectionTitle || '').trim(),
                    stableKey: String(entry?.stableKey || '').trim(),
                    content: String(entry?.content || '').trim(),
                    source: String(entry?.source || '').trim(),
                    at: String(entry?.at || '').trim(),
                })),
            },
            facts: {
                activeByCategory: asCountMap(activeFacts, (entry) => entry?.category),
                archiveByStatus: asCountMap(factArchive, (entry) => entry?.status),
                active: activeFacts.slice(0, 12).map((fact) => ({
                    id: String(fact?.id || '').trim(),
                    category: String(fact?.category || '').trim(),
                    key: String(fact?.key || '').trim(),
                    label: String(fact?.label || '').trim(),
                    status: String(fact?.status || '').trim(),
                    confidence: String(fact?.confidence || '').trim(),
                    versionGroup: String(fact?.versionGroup || '').trim(),
                    supersedes: String(fact?.supersedes || '').trim(),
                })),
                archive: factArchive.slice(0, 12).map((fact) => ({
                    id: String(fact?.id || '').trim(),
                    category: String(fact?.category || '').trim(),
                    key: String(fact?.key || '').trim(),
                    status: String(fact?.status || '').trim(),
                    versionGroup: String(fact?.versionGroup || '').trim(),
                    supersededBy: String(fact?.supersededBy || '').trim(),
                    archivedAt: String(fact?.archivedAt || '').trim(),
                })),
            },
            reconciliation: {
                receipts: memoryWriteReceipts.map((entry) => ({
                    candidateId: String(entry?.candidateId || '').trim(),
                    result: String(entry?.result || '').trim(),
                    targetKind: String(entry?.targetKind || '').trim(),
                    sectionTitle: String(entry?.sectionTitle || '').trim(),
                    summary: String(entry?.summary || '').trim(),
                })),
                reconcileResults: memoryReconciliation.map((entry) => ({
                    candidateId: String(entry?.candidateId || '').trim(),
                    result: String(entry?.result || '').trim(),
                    lookupKey: String(entry?.lookupKey || '').trim(),
                    targetFactId: String(entry?.targetFactId || '').trim(),
                    reason: String(entry?.reason || '').trim(),
                })),
                conflicts: memoryConflictLog.map((entry) => ({
                    factId: String(entry?.factId || '').trim(),
                    strategy: String(entry?.strategy || '').trim(),
                    conflictingFactIds: Array.isArray(entry?.conflictingFactIds) ? entry.conflictingFactIds.slice() : [],
                    reason: String(entry?.reason || '').trim(),
                })),
                pendingReconfirmation: pendingReconfirmationTasks.map((entry) => ({
                    factId: String(entry?.factId || '').trim(),
                    label: String(entry?.label || '').trim(),
                    status: String(entry?.status || '').trim(),
                    message: String(entry?.message || '').trim(),
                })),
            },
            current: {
                taskSummary: String(workingMemory?.currentTaskState?.summary || '').trim(),
                taskNextStep: String(workingMemory?.currentTaskState?.nextStep || '').trim(),
                workflowType: String(workingMemory?.currentWorkflowState?.type || '').trim(),
                workflowStep: String(workingMemory?.currentWorkflowState?.step || '').trim(),
            },
            note: String(options?.note || '').trim(),
        };
    }

    return {
      buildAIWorkspaceSnapshot,
      buildAIWorkspaceSnapshotFallback,
      buildMorphMemoryAuditSnapshot,
    };
  }

  window.MorphAIWorkspaceSnapshotRuntime = {
    create: createAIWorkspaceSnapshotRuntime,
  };
})();
