(function initMorphAppStateRuntime() {
  if (typeof window === 'undefined') return;

  function buildDefaultAIChatState() {
    return {
      sessionId: '',
      messages: [],
      busy: false,
      busyStartedAt: 0,
      abortController: null,
      currentAssistantMessageId: null,
      freezeSessionUntil: 0,
      longPressTimer: null,
      suppressNextSessionClick: false,
      sessionListDrag: null,
      scrollTopBySession: Object.create(null),
      forceScrollToBottom: false,
      renderedSessionId: '',
      onboarding: null,
      dismissedCurrentTaskBySession: Object.create(null),
      dismissedExtensionPanelsBySession: Object.create(null),
    };
  }

  function buildDefaultDetailEditorSelection() {
    return {
      range: null,
    };
  }

  function buildDefaultDailyShadowState() {
    return {
      monthKey: '',
      blockId: '',
      baseText: '',
      mode: '',
      suggestion: '',
      directions: [],
      directionsIntroLabel: '',
      directionsMaxCount: 2,
      suggestionSource: '',
      suggestionMeta: null,
      timer: null,
      aiTimer: null,
      aiAbortController: null,
      aiRequestKey: '',
      suspendUntil: 0,
    };
  }

  function buildDefaultDailyShadowThreadGuideState() {
    return {
      timer: null,
      abortController: null,
      requestKey: '',
    };
  }

  function buildDefaultRoutineCalendarState() {
    return {
      view: 'week',
      anchorDate: new Date().toISOString().slice(0, 10),
    };
  }

  function buildDefaultFinanceHostFeedbackState() {
    return {
      text: '',
      tone: 'neutral',
      timestamp: 0,
    };
  }

  function buildDefaultExtensionsState() {
      return {
        atlas: false,
        glucose: true,
        'health-state': true,
        feishu: false,
        'apple-health': false,
      };
    }

  function buildDefaultSettingsShellState() {
    return {
      settingsDetailMode: null,
      glucoseSettingsModalOpen: false,
      feishuSettingsModalOpen: false,
      appleHealthSettingsModalOpen: false,
      localPluginSettingsModalOpen: false,
      localPluginSettingsDefinition: null,
      dailyAlignSettingsModalOpen: false,
      aiKeySettingsModalOpen: false,
      aiKeySettingsModalProvider: 'gemini',
      secureVaultSettingsModalOpen: false,
    };
  }

  function buildDefaultSettingsRuntimeState() {
    return {
      nativeBridge: false,
      syncRootPath: '',
      syncRootDeleteSafe: null,
      nativePlatform: '',
      statusMessage: '',
      aiStatusMessage: '',
      aiStatusError: false,
      runtimeStatusMessage: '',
      runtimeStatusError: false,
      glucoseStatusMessage: '',
      glucoseStatusError: false,
      feishuStatusMessage: '',
      feishuStatusError: false,
      secureVaultStatusMessage: '',
      secureVaultStatusError: false,
      writingStudioStatusMessage: '',
      writingStudioStatusError: false,
      relationshipModeStatusMessage: '',
      relationshipModeStatusError: false,
      behaviorHabitStatusMessage: '',
      behaviorHabitStatusError: false,
      glucoseConfigLoaded: false,
      feishuConfigLoaded: false,
      agentStatusLoaded: false,
      agentStatus: null,
    };
  }

  function buildDefaultGlucoseRuntimeState() {
    return {
      contextCache: null,
      historyState: {
        loading: false,
        error: '',
        updatedAt: '',
        reading: null,
        series: [],
        targetLow: 70,
        targetHigh: 180,
        source: '',
        refreshTimer: null,
      },
      syncHydrationState: {
        timer: null,
        inFlight: false,
      },
    };
  }

  function buildDefaultGlucoseConfigState() {
    return {
      email: '',
      hasPassword: false,
      targetLow: 70,
      targetHigh: 180,
      region: 'CN',
    };
  }

  function buildDefaultFeishuConfigState() {
    return {
      enabled: false,
      appId: '',
      hasAppSecret: false,
      verificationToken: '',
      hasEncryptKey: false,
      botName: '',
      callbackPath: '/api/feishu/webhook',
      eventCount: 0,
      lastMessageAt: '',
      lastEventType: '',
    };
  }

  function createHostRealmPlainObject() {
    try {
      const hostGlobalFactory = typeof setTimeout === 'function' && setTimeout.constructor;
      if (typeof hostGlobalFactory === 'function') {
        const hostGlobal = hostGlobalFactory('return this')();
        if (hostGlobal && typeof hostGlobal.Object === 'function') {
          return new hostGlobal.Object();
        }
      }
    } catch (_) {}
    return {};
  }

  function buildDefaultSettingsConfigState() {
    return {
      glucoseConfig: buildDefaultGlucoseConfigState(),
      feishuConfig: buildDefaultFeishuConfigState(),
      secureVaultVolatile: (() => {
        const state = createHostRealmPlainObject();
        state.glucosePassword = '';
        return state;
      })(),
      externalServiceSettingsVolatile: (() => {
        const state = createHostRealmPlainObject();
        state.glucoseConfigFull = null;
        state.feishuConfigFull = null;
        return state;
      })(),
    };
  }

  function buildDefaultBootstrapState() {
    return {
      startupSkeletonDismissed: false,
      startupSkeletonReadyAt: Date.now() + 1200,
      startupHydrationSettled: true,
      startupHydrationHoldDeadlineAt: 0,
      desktopBootstrapWaitDeadlineAt: Date.now() + 4500,
      browserSyncRootStartupBootstrapPending: false,
      browserSyncRootStartupBootstrapSettled: false,
      morphBootUsedStartupSnapshot: false,
      bootLoadedFromStartupSnapshot: false,
      startupHydrationScheduled: false,
    };
  }

  function buildDefaultTaskRuntimeState() {
    return {
      proactiveScan: {
        running: false,
        timerActive: false,
        lastOutcome: '',
        lastReason: '',
        lastRunAt: '',
        lastSource: '',
      },
      reminderDispatch: {
        running: false,
        timerActive: false,
        lastOutcome: '',
        lastReason: '',
        lastRunAt: '',
      },
      reminderLanSync: {
        running: false,
        queued: false,
        timerActive: false,
        lastOutcome: '',
        lastReason: '',
        lastRunAt: '',
      },
      dailyAlign: {
        running: false,
        timerActive: false,
        lastOutcome: '',
        lastReason: '',
        lastRunAt: '',
      },
      reminderNativeRoutingState: null,
      futureAgentTasks: [],
      lastTaskEventAt: '',
      lastTaskEventKind: '',
      lastTaskEventMeta: null,
    };
  }

  function buildDefaultHomeVoiceState() {
    return {
      available: false,
      running: false,
    };
  }

  function buildDefaultDetailComposerVoiceState() {
    return {
      available: false,
      running: false,
      recognition: null,
      lastCommittedText: '',
      lastCommittedAt: 0,
      liveNode: null,
    };
  }

  function buildDefaultDailyVoiceState() {
    return {
      available: false,
      running: false,
      lastCommittedText: '',
      lastCommittedAt: 0,
      liveNode: null,
      targetBlockId: null,
      anchorRange: null,
    };
  }

  function buildDefaultAIVoiceState() {
    return {
      available: false,
      running: false,
      provider: '',
      captureContext: 'ai',
      recognition: null,
      finalText: '',
      interimText: '',
      lastCommittedText: '',
      lastCommittedAt: 0,
    };
  }

  function buildDefaultHealthVoiceState() {
    return {
      running: false,
      asking: false,
    };
  }

  function buildDefaultAITTSState() {
    return {
      audio: null,
      currentObjectUrl: '',
      requestToken: 0,
      playing: false,
    };
  }

  function buildDefaultMobileQuickVoiceState() {
    return {
      available: false,
      running: false,
      recognition: null,
      finalText: '',
      interimText: '',
      mode: '',
      lastCommittedText: '',
      lastCommittedAt: 0,
    };
  }

  function buildDefaultTaskRuntimeState() {
    return {
      proactiveScan: {
        timerActive: false,
        running: false,
        lastRunAt: '',
        lastOutcome: '',
        lastReason: '',
      },
      reminderDispatch: {
        timerActive: false,
        running: false,
        lastRunAt: '',
        lastOutcome: '',
        lastReason: '',
      },
      reminderLanSync: {
        timerActive: false,
        running: false,
        queued: false,
        lastRunAt: '',
        lastOutcome: '',
        lastReason: '',
      },
      dailyAlign: {
        timerActive: false,
        running: false,
        lastRunAt: '',
        lastOutcome: '',
        lastReason: '',
      },
      reminderNativeRoutingState: null,
      lastUpdatedAt: '',
    };
  }

  function buildDefaultAppState() {
    return {
      currentTab: 'schedule',
      activeContextId: null,
      selectedDailyMonth: '',
      isDrawerOpen: false,
      isLogDrawerOpen: false,
      currentDetailItem: null,
      currentDetailMeta: null,
      drawerSearchOpen: false,
      drawerSearchQuery: '',
      flashThoughtsViewMode: 'cards',
      fixedThoughtsViewMode: 'cards',
      lastPrimaryThoughtsViewPane: 'flash',
      lastNonAITab: 'schedule',
      lastNonExtensionsTab: 'schedule',
      mobileAIComposeActive: false,
      mobileFinanceAIComposeActive: false,
      thoughtGraphPan: { x: 0, y: 0 },
      thoughtGraphScale: 2,
      thoughtGraphScaleTarget: 2,
      thoughtGraphScaleRaf: 0,
      thoughtGraphTouchState: null,
      thoughtGraphPointerSession: null,
      suppressThoughtGraphClickUntil: 0,
      thoughtGraphWheelTimer: 0,
      thoughtGraphMotionTimer: 0,
      thoughtGraphMotionStamp: 0,
      mobileMoreMenuOpen: false,
      mobileProjectOrbitPanelOpen: false,
      sidebarResizeState: null,
      activeHealthViewPane: 'all',
      activeFinanceViewPane: 'all',
      activeLocalPluginWorkspaceId: '',
      activeProjectViewPane: 'default',
      activeProjectCollectionPane: 'active',
      activeProjectSpaceId: 'all',
      extensionsState: buildDefaultExtensionsState(),
      ...buildDefaultSettingsShellState(),
      ...buildDefaultSettingsRuntimeState(),
      settingsConfigState: buildDefaultSettingsConfigState(),
      bootstrapState: buildDefaultBootstrapState(),
      taskRuntimeState: buildDefaultTaskRuntimeState(),
      financeHostFeedbackState: buildDefaultFinanceHostFeedbackState(),
      glucoseRuntimeState: buildDefaultGlucoseRuntimeState(),
      taskRuntimeState: buildDefaultTaskRuntimeState(),
      lastInject: null,
      suppressProjectCardClickUntil: 0,
      routineCalendarState: buildDefaultRoutineCalendarState(),
      desktopProjectOrbitCollapsed: false,
      dailyMonthPillMenuOpen: false,
      settingsThemePillMenuOpen: false,
      projectArchivePillMenuOpen: false,
      projectCreatePillMenuOpen: false,
      projectSpacePillMenuOpen: false,
      homeVoiceState: buildDefaultHomeVoiceState(),
      detailComposerVoiceState: buildDefaultDetailComposerVoiceState(),
      dailyVoiceState: buildDefaultDailyVoiceState(),
      aiVoiceState: buildDefaultAIVoiceState(),
      healthVoiceState: buildDefaultHealthVoiceState(),
      aiTTSState: buildDefaultAITTSState(),
      mobileQuickVoiceState: buildDefaultMobileQuickVoiceState(),
      mobileDailyAIComposeActive: false,
      mobileHealthAIComposeActive: false,
      draggedBlockData: null,
      draggedEditorImageItem: null,
      editorImageResizeState: null,
      lastDetailEditorSelection: buildDefaultDetailEditorSelection(),
      detailPreRefineState: null,
      modalCallback: null,
      modalSelectedValue: '',
      selectedBlockBatch: null,
      blockSweepSelection: null,
      dailyShadowState: buildDefaultDailyShadowState(),
      dailyShadowAdaptiveProfileCache: null,
      dailyShadowThreadGuideCache: null,
      dailyShadowThreadGuideState: buildDefaultDailyShadowThreadGuideState(),
      aiChatState: buildDefaultAIChatState(),
      aiChatSessionDrawerOpen: false,
      aiChatSessionInlineMenuId: '',
      aiChatDraftAttachments: [],
      aiChatHeaderMoreMenuOpen: false,
      aiChatUtilityMenuOpen: false,
      aiChatUtilityMenuSection: 'root',
      aiChatPendingUploadMode: 'learn',
      aiInlineUploadIntentActive: false,
      aiPendingTimeBlockIntent: null,
      aiPendingScriptWorkflowIntent: null,
      aiPendingWebSearchIntent: false,
      aiPendingOnboardingIntent: false,
      aiPendingUtilityCategory: null,
      aiPendingUtilityOptionSelected: false,
      aiChatHistoryPersistQueued: false,
    };
  }

  function hydrateAppStateShape(state) {
    if (!state || typeof state !== 'object') return buildDefaultAppState();
    const defaults = buildDefaultAppState();
    Object.keys(defaults).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(state, key)) {
        state[key] = defaults[key];
      }
    });
    if (!state.aiChatState || typeof state.aiChatState !== 'object') {
      state.aiChatState = buildDefaultAIChatState();
    } else {
      const chatDefaults = buildDefaultAIChatState();
      Object.keys(chatDefaults).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(state.aiChatState, key)) {
          state.aiChatState[key] = chatDefaults[key];
        }
      });
    }
    if (!state.lastDetailEditorSelection || typeof state.lastDetailEditorSelection !== 'object') {
      state.lastDetailEditorSelection = buildDefaultDetailEditorSelection();
    } else if (!Object.prototype.hasOwnProperty.call(state.lastDetailEditorSelection, 'range')) {
      state.lastDetailEditorSelection.range = null;
    }
    if (!state.dailyShadowState || typeof state.dailyShadowState !== 'object') {
      state.dailyShadowState = buildDefaultDailyShadowState();
    } else {
      const dailyShadowDefaults = buildDefaultDailyShadowState();
      Object.keys(dailyShadowDefaults).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(state.dailyShadowState, key)) {
          state.dailyShadowState[key] = dailyShadowDefaults[key];
        }
      });
      if (!Array.isArray(state.dailyShadowState.directions)) state.dailyShadowState.directions = [];
    }
    if (!Object.prototype.hasOwnProperty.call(state, 'dailyShadowAdaptiveProfileCache')) {
      state.dailyShadowAdaptiveProfileCache = null;
    }
    if (!Object.prototype.hasOwnProperty.call(state, 'dailyShadowThreadGuideCache')) {
      state.dailyShadowThreadGuideCache = null;
    }
    if (!state.dailyShadowThreadGuideState || typeof state.dailyShadowThreadGuideState !== 'object') {
      state.dailyShadowThreadGuideState = buildDefaultDailyShadowThreadGuideState();
    } else {
      const dailyShadowThreadGuideDefaults = buildDefaultDailyShadowThreadGuideState();
      Object.keys(dailyShadowThreadGuideDefaults).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(state.dailyShadowThreadGuideState, key)) {
          state.dailyShadowThreadGuideState[key] = dailyShadowThreadGuideDefaults[key];
        }
      });
    }
    if (!Object.prototype.hasOwnProperty.call(state, 'lastInject')) {
      state.lastInject = null;
    }
    if (!Object.prototype.hasOwnProperty.call(state, 'suppressProjectCardClickUntil')) {
      state.suppressProjectCardClickUntil = 0;
    }
    if (!state.routineCalendarState || typeof state.routineCalendarState !== 'object') {
      state.routineCalendarState = buildDefaultRoutineCalendarState();
    } else {
      const routineCalendarDefaults = buildDefaultRoutineCalendarState();
      if (!['day', 'week', 'month', 'year'].includes(String(state.routineCalendarState.view || ''))) {
        state.routineCalendarState.view = routineCalendarDefaults.view;
      }
      if (!Object.prototype.hasOwnProperty.call(state.routineCalendarState, 'anchorDate')) {
        state.routineCalendarState.anchorDate = routineCalendarDefaults.anchorDate;
      }
    }
    if (!Object.prototype.hasOwnProperty.call(state, 'desktopProjectOrbitCollapsed')) {
      state.desktopProjectOrbitCollapsed = false;
    }
    if (!Object.prototype.hasOwnProperty.call(state, 'sidebarResizeState')) {
      state.sidebarResizeState = null;
    }
    if (typeof state.activeHealthViewPane !== 'string') {
      state.activeHealthViewPane = 'all';
    }
    if (typeof state.activeFinanceViewPane !== 'string') {
      state.activeFinanceViewPane = 'all';
    }
    if (typeof state.activeLocalPluginWorkspaceId !== 'string') {
      state.activeLocalPluginWorkspaceId = '';
    }
    if (typeof state.activeProjectViewPane !== 'string') {
      state.activeProjectViewPane = 'default';
    }
    if (typeof state.activeProjectCollectionPane !== 'string') {
      state.activeProjectCollectionPane = 'active';
    }
      if (typeof state.activeProjectSpaceId !== 'string') {
        state.activeProjectSpaceId = 'all';
      }
      if (typeof state.currentTab !== 'string' || !state.currentTab.trim()) {
        state.currentTab = 'flashThoughts';
      }
      if (state.activeContextId !== null && typeof state.activeContextId !== 'string') {
        state.activeContextId = null;
      }
      if (typeof state.selectedDailyMonth !== 'string') {
        state.selectedDailyMonth = '';
      }
      if (!state.extensionsState || typeof state.extensionsState !== 'object') {
        state.extensionsState = buildDefaultExtensionsState();
      } else {
      const extensionsDefaults = buildDefaultExtensionsState();
      Object.keys(extensionsDefaults).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(state.extensionsState, key)) {
          state.extensionsState[key] = extensionsDefaults[key];
        }
      });
    }
    if (typeof state.settingsDetailMode !== 'string' && state.settingsDetailMode !== null) {
      state.settingsDetailMode = null;
    }
    if (typeof state.glucoseSettingsModalOpen !== 'boolean') {
      state.glucoseSettingsModalOpen = false;
    }
    if (typeof state.feishuSettingsModalOpen !== 'boolean') {
      state.feishuSettingsModalOpen = false;
    }
    if (typeof state.appleHealthSettingsModalOpen !== 'boolean') {
      state.appleHealthSettingsModalOpen = false;
    }
    if (typeof state.localPluginSettingsModalOpen !== 'boolean') {
      state.localPluginSettingsModalOpen = false;
    }
    if (typeof state.localPluginSettingsDefinition !== 'object' || state.localPluginSettingsDefinition === null) {
      state.localPluginSettingsDefinition = null;
    }
    if (typeof state.dailyAlignSettingsModalOpen !== 'boolean') {
      state.dailyAlignSettingsModalOpen = false;
    }
    if (typeof state.aiKeySettingsModalOpen !== 'boolean') {
      state.aiKeySettingsModalOpen = false;
    }
    if (typeof state.aiKeySettingsModalProvider !== 'string') {
      state.aiKeySettingsModalProvider = 'gemini';
    }
    if (typeof state.secureVaultSettingsModalOpen !== 'boolean') {
      state.secureVaultSettingsModalOpen = false;
    }
    const settingsRuntimeDefaults = buildDefaultSettingsRuntimeState();
    Object.keys(settingsRuntimeDefaults).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(state, key)) {
        state[key] = settingsRuntimeDefaults[key];
      }
    });
    if (!state.glucoseRuntimeState || typeof state.glucoseRuntimeState !== 'object') {
      state.glucoseRuntimeState = buildDefaultGlucoseRuntimeState();
    } else {
      const glucoseRuntimeDefaults = buildDefaultGlucoseRuntimeState();
      if (!state.glucoseRuntimeState.contextCache && state.glucoseRuntimeState.contextCache !== null) {
        state.glucoseRuntimeState.contextCache = glucoseRuntimeDefaults.contextCache;
      }
      if (!state.glucoseRuntimeState.historyState || typeof state.glucoseRuntimeState.historyState !== 'object') {
        state.glucoseRuntimeState.historyState = glucoseRuntimeDefaults.historyState;
      } else {
        const historyDefaults = glucoseRuntimeDefaults.historyState;
        if (typeof state.glucoseRuntimeState.historyState.loading !== 'boolean') state.glucoseRuntimeState.historyState.loading = historyDefaults.loading;
        if (typeof state.glucoseRuntimeState.historyState.error !== 'string') state.glucoseRuntimeState.historyState.error = historyDefaults.error;
        if (typeof state.glucoseRuntimeState.historyState.updatedAt !== 'string') state.glucoseRuntimeState.historyState.updatedAt = historyDefaults.updatedAt;
        if (!Object.prototype.hasOwnProperty.call(state.glucoseRuntimeState.historyState, 'reading')) state.glucoseRuntimeState.historyState.reading = historyDefaults.reading;
        if (!Array.isArray(state.glucoseRuntimeState.historyState.series)) state.glucoseRuntimeState.historyState.series = historyDefaults.series;
        if (!Number.isFinite(Number(state.glucoseRuntimeState.historyState.targetLow))) state.glucoseRuntimeState.historyState.targetLow = historyDefaults.targetLow;
        if (!Number.isFinite(Number(state.glucoseRuntimeState.historyState.targetHigh))) state.glucoseRuntimeState.historyState.targetHigh = historyDefaults.targetHigh;
        if (typeof state.glucoseRuntimeState.historyState.source !== 'string') state.glucoseRuntimeState.historyState.source = historyDefaults.source;
        if (!Object.prototype.hasOwnProperty.call(state.glucoseRuntimeState.historyState, 'refreshTimer')) state.glucoseRuntimeState.historyState.refreshTimer = historyDefaults.refreshTimer;
      }
      if (!state.glucoseRuntimeState.syncHydrationState || typeof state.glucoseRuntimeState.syncHydrationState !== 'object') {
        state.glucoseRuntimeState.syncHydrationState = glucoseRuntimeDefaults.syncHydrationState;
      } else {
        const syncDefaults = glucoseRuntimeDefaults.syncHydrationState;
        if (!Object.prototype.hasOwnProperty.call(state.glucoseRuntimeState.syncHydrationState, 'timer')) {
          state.glucoseRuntimeState.syncHydrationState.timer = syncDefaults.timer;
        }
        if (typeof state.glucoseRuntimeState.syncHydrationState.inFlight !== 'boolean') {
          state.glucoseRuntimeState.syncHydrationState.inFlight = syncDefaults.inFlight;
        }
      }
    }
    if (!state.taskRuntimeState || typeof state.taskRuntimeState !== 'object') {
      state.taskRuntimeState = buildDefaultTaskRuntimeState();
    } else {
      const taskRuntimeDefaults = buildDefaultTaskRuntimeState();
      ['proactiveScan', 'reminderDispatch', 'reminderLanSync', 'dailyAlign'].forEach((key) => {
        if (!state.taskRuntimeState[key] || typeof state.taskRuntimeState[key] !== 'object') {
          state.taskRuntimeState[key] = taskRuntimeDefaults[key];
          return;
        }
        Object.keys(taskRuntimeDefaults[key]).forEach((field) => {
          if (!Object.prototype.hasOwnProperty.call(state.taskRuntimeState[key], field)) {
            state.taskRuntimeState[key][field] = taskRuntimeDefaults[key][field];
          }
        });
      });
      if (!Object.prototype.hasOwnProperty.call(state.taskRuntimeState, 'reminderNativeRoutingState')) {
        state.taskRuntimeState.reminderNativeRoutingState = taskRuntimeDefaults.reminderNativeRoutingState;
      }
      if (typeof state.taskRuntimeState.lastUpdatedAt !== 'string') {
        state.taskRuntimeState.lastUpdatedAt = taskRuntimeDefaults.lastUpdatedAt;
      }
    }
    if (!state.settingsConfigState || typeof state.settingsConfigState !== 'object') {
      state.settingsConfigState = buildDefaultSettingsConfigState();
    } else {
      const settingsConfigDefaults = buildDefaultSettingsConfigState();
      if (!state.settingsConfigState.glucoseConfig || typeof state.settingsConfigState.glucoseConfig !== 'object') {
        state.settingsConfigState.glucoseConfig = settingsConfigDefaults.glucoseConfig;
      } else {
        const glucoseDefaults = settingsConfigDefaults.glucoseConfig;
        if (typeof state.settingsConfigState.glucoseConfig.email !== 'string') state.settingsConfigState.glucoseConfig.email = glucoseDefaults.email;
        if (typeof state.settingsConfigState.glucoseConfig.hasPassword !== 'boolean') state.settingsConfigState.glucoseConfig.hasPassword = glucoseDefaults.hasPassword;
        if (!Number.isFinite(Number(state.settingsConfigState.glucoseConfig.targetLow))) state.settingsConfigState.glucoseConfig.targetLow = glucoseDefaults.targetLow;
        if (!Number.isFinite(Number(state.settingsConfigState.glucoseConfig.targetHigh))) state.settingsConfigState.glucoseConfig.targetHigh = glucoseDefaults.targetHigh;
        if (typeof state.settingsConfigState.glucoseConfig.region !== 'string') state.settingsConfigState.glucoseConfig.region = glucoseDefaults.region;
      }
      if (!state.settingsConfigState.feishuConfig || typeof state.settingsConfigState.feishuConfig !== 'object') {
        state.settingsConfigState.feishuConfig = settingsConfigDefaults.feishuConfig;
      } else {
        const feishuDefaults = settingsConfigDefaults.feishuConfig;
        if (typeof state.settingsConfigState.feishuConfig.enabled !== 'boolean') state.settingsConfigState.feishuConfig.enabled = feishuDefaults.enabled;
        if (typeof state.settingsConfigState.feishuConfig.appId !== 'string') state.settingsConfigState.feishuConfig.appId = feishuDefaults.appId;
        if (typeof state.settingsConfigState.feishuConfig.hasAppSecret !== 'boolean') state.settingsConfigState.feishuConfig.hasAppSecret = feishuDefaults.hasAppSecret;
        if (typeof state.settingsConfigState.feishuConfig.verificationToken !== 'string') state.settingsConfigState.feishuConfig.verificationToken = feishuDefaults.verificationToken;
        if (typeof state.settingsConfigState.feishuConfig.hasEncryptKey !== 'boolean') state.settingsConfigState.feishuConfig.hasEncryptKey = feishuDefaults.hasEncryptKey;
        if (typeof state.settingsConfigState.feishuConfig.botName !== 'string') state.settingsConfigState.feishuConfig.botName = feishuDefaults.botName;
        if (typeof state.settingsConfigState.feishuConfig.callbackPath !== 'string') state.settingsConfigState.feishuConfig.callbackPath = feishuDefaults.callbackPath;
        if (!Number.isFinite(Number(state.settingsConfigState.feishuConfig.eventCount))) state.settingsConfigState.feishuConfig.eventCount = feishuDefaults.eventCount;
        if (typeof state.settingsConfigState.feishuConfig.lastMessageAt !== 'string') state.settingsConfigState.feishuConfig.lastMessageAt = feishuDefaults.lastMessageAt;
        if (typeof state.settingsConfigState.feishuConfig.lastEventType !== 'string') state.settingsConfigState.feishuConfig.lastEventType = feishuDefaults.lastEventType;
      }
      if (!state.settingsConfigState.secureVaultVolatile || typeof state.settingsConfigState.secureVaultVolatile !== 'object') {
        state.settingsConfigState.secureVaultVolatile = settingsConfigDefaults.secureVaultVolatile;
      } else if (typeof state.settingsConfigState.secureVaultVolatile.glucosePassword !== 'string') {
        state.settingsConfigState.secureVaultVolatile.glucosePassword = settingsConfigDefaults.secureVaultVolatile.glucosePassword;
      }
      if (!state.settingsConfigState.externalServiceSettingsVolatile || typeof state.settingsConfigState.externalServiceSettingsVolatile !== 'object') {
        state.settingsConfigState.externalServiceSettingsVolatile = settingsConfigDefaults.externalServiceSettingsVolatile;
      } else {
        if (!Object.prototype.hasOwnProperty.call(state.settingsConfigState.externalServiceSettingsVolatile, 'glucoseConfigFull')) {
          state.settingsConfigState.externalServiceSettingsVolatile.glucoseConfigFull = settingsConfigDefaults.externalServiceSettingsVolatile.glucoseConfigFull;
        }
        if (!Object.prototype.hasOwnProperty.call(state.settingsConfigState.externalServiceSettingsVolatile, 'feishuConfigFull')) {
          state.settingsConfigState.externalServiceSettingsVolatile.feishuConfigFull = settingsConfigDefaults.externalServiceSettingsVolatile.feishuConfigFull;
        }
      }
    }
    if (!state.bootstrapState || typeof state.bootstrapState !== 'object') {
      state.bootstrapState = buildDefaultBootstrapState();
    } else {
      const bootstrapDefaults = buildDefaultBootstrapState();
      Object.keys(bootstrapDefaults).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(state.bootstrapState, key)) {
          state.bootstrapState[key] = bootstrapDefaults[key];
        }
      });
    }
    if (!state.taskRuntimeState || typeof state.taskRuntimeState !== 'object') {
      state.taskRuntimeState = buildDefaultTaskRuntimeState();
    } else {
      const taskRuntimeDefaults = buildDefaultTaskRuntimeState();
      Object.keys(taskRuntimeDefaults).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(state.taskRuntimeState, key)) {
          state.taskRuntimeState[key] = taskRuntimeDefaults[key];
        }
      });
      if (!Array.isArray(state.taskRuntimeState.futureAgentTasks)) {
        state.taskRuntimeState.futureAgentTasks = taskRuntimeDefaults.futureAgentTasks;
      }
    }
    if (!state.financeHostFeedbackState || typeof state.financeHostFeedbackState !== 'object') {
      state.financeHostFeedbackState = buildDefaultFinanceHostFeedbackState();
    } else {
      const financeHostFeedbackDefaults = buildDefaultFinanceHostFeedbackState();
      if (typeof state.financeHostFeedbackState.text !== 'string') {
        state.financeHostFeedbackState.text = financeHostFeedbackDefaults.text;
      }
      if (typeof state.financeHostFeedbackState.tone !== 'string') {
        state.financeHostFeedbackState.tone = financeHostFeedbackDefaults.tone;
      }
      if (!Object.prototype.hasOwnProperty.call(state.financeHostFeedbackState, 'timestamp')) {
        state.financeHostFeedbackState.timestamp = financeHostFeedbackDefaults.timestamp;
      }
    }
    if (!state.homeVoiceState || typeof state.homeVoiceState !== 'object') {
      state.homeVoiceState = buildDefaultHomeVoiceState();
    }
    if (!state.detailComposerVoiceState || typeof state.detailComposerVoiceState !== 'object') {
      state.detailComposerVoiceState = buildDefaultDetailComposerVoiceState();
    }
    if (!state.dailyVoiceState || typeof state.dailyVoiceState !== 'object') {
      state.dailyVoiceState = buildDefaultDailyVoiceState();
    }
    if (!state.aiVoiceState || typeof state.aiVoiceState !== 'object') {
      state.aiVoiceState = buildDefaultAIVoiceState();
    }
    if (!state.healthVoiceState || typeof state.healthVoiceState !== 'object') {
      state.healthVoiceState = buildDefaultHealthVoiceState();
    }
    if (!state.aiTTSState || typeof state.aiTTSState !== 'object') {
      state.aiTTSState = buildDefaultAITTSState();
    }
    if (!state.mobileQuickVoiceState || typeof state.mobileQuickVoiceState !== 'object') {
      state.mobileQuickVoiceState = buildDefaultMobileQuickVoiceState();
    }
    return state;
  }

  function installStateAccessors(state) {
    Object.defineProperties(state, {
      glucoseConfig: {
        configurable: true,
        enumerable: true,
        get() {
          return state.settingsConfigState?.glucoseConfig || buildDefaultGlucoseConfigState();
        },
        set(value) {
          state.settingsConfigState.glucoseConfig = value && typeof value === 'object'
            ? value
            : buildDefaultGlucoseConfigState();
        },
      },
      feishuConfig: {
        configurable: true,
        enumerable: true,
        get() {
          return state.settingsConfigState?.feishuConfig || buildDefaultFeishuConfigState();
        },
        set(value) {
          state.settingsConfigState.feishuConfig = value && typeof value === 'object'
            ? value
            : buildDefaultFeishuConfigState();
        },
      },
      glucosePassword: {
        configurable: true,
        enumerable: true,
        get() {
          return String(state.settingsConfigState?.secureVaultVolatile?.glucosePassword || '');
        },
        set(value) {
          if (!state.settingsConfigState.secureVaultVolatile || typeof state.settingsConfigState.secureVaultVolatile !== 'object') {
            state.settingsConfigState.secureVaultVolatile = buildDefaultSettingsConfigState().secureVaultVolatile;
          }
          state.settingsConfigState.secureVaultVolatile.glucosePassword = String(value || '').trim();
        },
      },
      secureVaultVolatile: {
        configurable: true,
        enumerable: true,
        get() {
          return state.settingsConfigState?.secureVaultVolatile || buildDefaultSettingsConfigState().secureVaultVolatile;
        },
      },
      glucoseConfigFull: {
        configurable: true,
        enumerable: true,
        get() {
          return state.settingsConfigState?.externalServiceSettingsVolatile?.glucoseConfigFull || null;
        },
        set(value) {
          if (!state.settingsConfigState.externalServiceSettingsVolatile || typeof state.settingsConfigState.externalServiceSettingsVolatile !== 'object') {
            state.settingsConfigState.externalServiceSettingsVolatile = buildDefaultSettingsConfigState().externalServiceSettingsVolatile;
          }
          state.settingsConfigState.externalServiceSettingsVolatile.glucoseConfigFull = value && typeof value === 'object' ? value : null;
        },
      },
      externalServiceSettingsVolatile: {
        configurable: true,
        enumerable: true,
        get() {
          return state.settingsConfigState?.externalServiceSettingsVolatile || buildDefaultSettingsConfigState().externalServiceSettingsVolatile;
        },
      },
      feishuConfigFull: {
        configurable: true,
        enumerable: true,
        get() {
          return state.settingsConfigState?.externalServiceSettingsVolatile?.feishuConfigFull || null;
        },
        set(value) {
          if (!state.settingsConfigState.externalServiceSettingsVolatile || typeof state.settingsConfigState.externalServiceSettingsVolatile !== 'object') {
            state.settingsConfigState.externalServiceSettingsVolatile = buildDefaultSettingsConfigState().externalServiceSettingsVolatile;
          }
          state.settingsConfigState.externalServiceSettingsVolatile.feishuConfigFull = value && typeof value === 'object' ? value : null;
        },
      },
    });
  }

  function installBinding(state, name) {
    Object.defineProperty(window, name, {
      configurable: true,
      enumerable: true,
      get() {
        return state[name];
      },
      set(value) {
        state[name] = value;
      },
    });
  }

  function installBindings(state) {
    [
      'currentTab',
      'activeContextId',
      'selectedDailyMonth',
      'isDrawerOpen',
      'isLogDrawerOpen',
      'currentDetailItem',
      'currentDetailMeta',
      'drawerSearchOpen',
      'drawerSearchQuery',
      'flashThoughtsViewMode',
      'fixedThoughtsViewMode',
      'lastPrimaryThoughtsViewPane',
      'lastNonAITab',
      'lastNonExtensionsTab',
      'mobileAIComposeActive',
      'mobileFinanceAIComposeActive',
      'thoughtGraphPan',
      'thoughtGraphScale',
      'thoughtGraphScaleTarget',
      'thoughtGraphScaleRaf',
      'thoughtGraphTouchState',
      'thoughtGraphPointerSession',
      'suppressThoughtGraphClickUntil',
      'thoughtGraphWheelTimer',
      'thoughtGraphMotionTimer',
      'thoughtGraphMotionStamp',
      'mobileMoreMenuOpen',
      'mobileProjectOrbitPanelOpen',
      'sidebarResizeState',
      'activeHealthViewPane',
      'activeFinanceViewPane',
      'activeLocalPluginWorkspaceId',
      'activeProjectViewPane',
      'activeProjectCollectionPane',
      'activeProjectSpaceId',
      'extensionsState',
      'settingsConfigState',
      'taskRuntimeState',
      'settingsDetailMode',
      'glucoseSettingsModalOpen',
      'feishuSettingsModalOpen',
      'appleHealthSettingsModalOpen',
      'localPluginSettingsModalOpen',
      'localPluginSettingsDefinition',
      'dailyAlignSettingsModalOpen',
      'aiKeySettingsModalOpen',
      'aiKeySettingsModalProvider',
      'secureVaultSettingsModalOpen',
      'nativeBridge',
      'syncRootPath',
      'syncRootDeleteSafe',
      'nativePlatform',
      'statusMessage',
      'aiStatusMessage',
      'aiStatusError',
      'runtimeStatusMessage',
      'runtimeStatusError',
      'glucoseStatusMessage',
      'glucoseStatusError',
      'feishuStatusMessage',
      'feishuStatusError',
      'secureVaultStatusMessage',
      'secureVaultStatusError',
      'writingStudioStatusMessage',
      'writingStudioStatusError',
      'relationshipModeStatusMessage',
      'relationshipModeStatusError',
      'behaviorHabitStatusMessage',
      'behaviorHabitStatusError',
      'glucoseConfigLoaded',
      'feishuConfigLoaded',
      'agentStatusLoaded',
      'agentStatus',
      'financeHostFeedbackState',
      'lastInject',
      'suppressProjectCardClickUntil',
      'routineCalendarState',
      'desktopProjectOrbitCollapsed',
      'draggedBlockData',
      'draggedEditorImageItem',
      'editorImageResizeState',
      'lastDetailEditorSelection',
      'detailPreRefineState',
      'modalCallback',
      'modalSelectedValue',
      'selectedBlockBatch',
      'blockSweepSelection',
      'dailyMonthPillMenuOpen',
      'settingsThemePillMenuOpen',
      'projectArchivePillMenuOpen',
      'projectCreatePillMenuOpen',
      'projectSpacePillMenuOpen',
      'homeVoiceState',
      'detailComposerVoiceState',
      'dailyVoiceState',
      'aiVoiceState',
      'healthVoiceState',
      'aiTTSState',
      'mobileQuickVoiceState',
      'mobileDailyAIComposeActive',
      'mobileHealthAIComposeActive',
      'dailyShadowState',
      'dailyShadowAdaptiveProfileCache',
      'dailyShadowThreadGuideCache',
      'dailyShadowThreadGuideState',
      'aiChatState',
      'aiChatSessionDrawerOpen',
      'aiChatSessionInlineMenuId',
      'aiChatDraftAttachments',
      'aiChatHeaderMoreMenuOpen',
      'aiChatUtilityMenuOpen',
      'aiChatUtilityMenuSection',
      'aiChatPendingUploadMode',
      'aiInlineUploadIntentActive',
      'aiPendingTimeBlockIntent',
      'aiPendingScriptWorkflowIntent',
      'aiPendingWebSearchIntent',
      'aiPendingOnboardingIntent',
      'aiPendingUtilityCategory',
      'aiPendingUtilityOptionSelected',
      'aiChatHistoryPersistQueued',
    ].forEach((name) => installBinding(state, name));
  }

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createAppStateDepsRuntime() {
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || window;
    const getGlobalFunction = (name = '') => {
      const key = String(name || '').trim();
      if (!key) return null;
      const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
      if (typeof fromGlobal === 'function') return fromGlobal;
      const fromWindow = typeof window[key] === 'function' ? window[key] : null;
      return typeof fromWindow === 'function' ? fromWindow : null;
    };
    const getGlobalValue = (name = '', fallback = null) => {
      const key = String(name || '').trim();
      if (!key) return fallback;
      if (globalRoot && typeof globalRoot[key] !== 'undefined') return globalRoot[key];
      if (typeof window[key] !== 'undefined') return window[key];
      return fallback;
    };
    const getAIChatStateFallback = () => (window.aiChatState && typeof window.aiChatState === 'object'
      ? window.aiChatState
      : { sessionId: '', messages: [] });
    function buildViewStateDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        getData: pickFunction(context.getData, () => null),
        cloneJSONSafe: pickFunction(context.cloneJSONSafe, getGlobalFunction('cloneJSONSafe') || ((value) => value)),
        getCurrentTab: pickFunction(context.getCurrentTab, () => String(getGlobalValue('currentTab', 'flashThoughts') || 'flashThoughts').trim() || 'flashThoughts'),
        setCurrentTab: pickFunction(context.setCurrentTab, (value) => { window.currentTab = String(value || '').trim() || 'flashThoughts'; }),
        getActiveContextId: pickFunction(context.getActiveContextId, () => {
          const value = getGlobalValue('activeContextId', null);
          return value == null ? null : String(value || '').trim() || null;
        }),
        setActiveContextId: pickFunction(context.setActiveContextId, (value) => { window.activeContextId = value == null ? null : String(value || '').trim() || null; }),
        getSelectedDailyMonth: pickFunction(context.getSelectedDailyMonth, () => String(getGlobalValue('selectedDailyMonth', '') || '').trim()),
        setSelectedDailyMonth: pickFunction(context.setSelectedDailyMonth, (value) => { window.selectedDailyMonth = String(value || '').trim(); }),
        getAIChatSessionId: pickFunction(context.getAIChatSessionId, () => String(getAIChatStateFallback()?.sessionId || '').trim()),
        setAIChatSessionId: pickFunction(context.setAIChatSessionId, (value) => {
          const state = getAIChatStateFallback();
          if (state && typeof state === 'object') state.sessionId = String(value || '').trim();
        }),
        getActiveThoughtsViewPane: pickFunction(context.getActiveThoughtsViewPane, () => String(getGlobalValue('activeThoughtsViewPane', 'flash') || 'flash').trim() || 'flash'),
        setActiveThoughtsViewPane: pickFunction(context.setActiveThoughtsViewPane, (value) => { window.activeThoughtsViewPane = String(value || '').trim(); }),
        getActiveThoughtVisualMode: pickFunction(context.getActiveThoughtVisualMode, getGlobalFunction('getActiveThoughtVisualMode') || (() => 'cards')),
        getActiveProjectCollectionPane: pickFunction(context.getActiveProjectCollectionPane, () => String(getGlobalValue('activeProjectCollectionPane', '') || '').trim()),
        setActiveProjectCollectionPane: pickFunction(context.setActiveProjectCollectionPane, (value) => { window.activeProjectCollectionPane = String(value || '').trim(); }),
        getActiveProjectSpaceId: pickFunction(context.getActiveProjectSpaceId, () => String(getGlobalValue('activeProjectSpaceId', '') || '').trim()),
        setActiveProjectSpaceId: pickFunction(context.setActiveProjectSpaceId, (value) => { window.activeProjectSpaceId = String(value || '').trim(); }),
        getActiveProjectViewPane: pickFunction(context.getActiveProjectViewPane, () => String(getGlobalValue('activeProjectViewPane', '') || '').trim()),
        setActiveProjectViewPane: pickFunction(context.setActiveProjectViewPane, (value) => { window.activeProjectViewPane = String(value || '').trim(); }),
        getCurrentEditorFocusSnapshot: pickFunction(context.getCurrentEditorFocusSnapshot, getGlobalFunction('getCurrentEditorFocusSnapshot') || (() => null)),
        getLastInject: pickFunction(context.getLastInject, () => getGlobalValue('lastInject', null)),
        getMonthStr: pickFunction(context.getMonthStr, getGlobalFunction('getMonthStr') || (() => '')),
        ensureAIMemoryShape: pickFunction(context.ensureAIMemoryShape, getGlobalFunction('ensureAIMemoryShape') || ((value) => value || {})),
        getMorphWorkingMemory: pickFunction(context.getMorphWorkingMemory, getGlobalFunction('getMorphWorkingMemory') || (() => null)),
        pruneMorphRecentMemoryBuffer: pickFunction(context.pruneMorphRecentMemoryBuffer, getGlobalFunction('pruneMorphRecentMemoryBuffer') || (() => ({ user: [], self: [], task: [] }))),
        suspendOmniAutoFocus: pickFunction(context.suspendOmniAutoFocus, getGlobalFunction('suspendOmniAutoFocus') || (() => {})),
        switchTab: pickFunction(context.switchTab, getGlobalFunction('switchTab') || (() => {})),
        openContextDetail: pickFunction(context.openContextDetail, getGlobalFunction('openContextDetail') || (() => {})),
        renderAll: pickFunction(context.renderAll, getGlobalFunction('renderAll') || (() => {})),
        renderAIChatView: pickFunction(context.renderAIChatView, getGlobalFunction('renderAIChatView') || (() => {})),
        renderMinGapMs: Number.isFinite(Number(context.renderMinGapMs))
          ? Number(context.renderMinGapMs)
          : Number(getGlobalValue('PERF', {})?.renderMinGapMs || 16),
        getAIChatMessages: pickFunction(context.getAIChatMessages, () => Array.isArray(getAIChatStateFallback()?.messages) ? getAIChatStateFallback().messages : []),
      };
    }
    return { buildViewStateDeps };
  }

  function createAppStateRuntime() {
    const existingState = window.__MorphAppStateRuntimeState;
    const state = existingState && typeof existingState === 'object'
      ? hydrateAppStateShape(existingState)
      : buildDefaultAppState();
    window.__MorphAppStateRuntimeState = state;
    installStateAccessors(state);
    installBindings(state);
    return {
      buildDefaultAIChatState,
      buildDefaultDetailEditorSelection,
      buildDefaultDailyShadowState,
      buildDefaultDailyShadowThreadGuideState,
      buildDefaultRoutineCalendarState,
      buildDefaultFinanceHostFeedbackState,
      buildDefaultExtensionsState,
      buildDefaultSettingsRuntimeState,
      buildDefaultGlucoseConfigState,
      buildDefaultFeishuConfigState,
      buildDefaultSettingsConfigState,
      buildDefaultBootstrapState,
      buildDefaultTaskRuntimeState,
      buildDefaultHomeVoiceState,
      buildDefaultDetailComposerVoiceState,
      buildDefaultDailyVoiceState,
      buildDefaultAIVoiceState,
      buildDefaultHealthVoiceState,
      buildDefaultAITTSState,
      buildDefaultMobileQuickVoiceState,
      buildDefaultTaskRuntimeState,
      buildDefaultAppState,
      getState: () => state,
      installBindings: () => installBindings(state),
    };
  }

  window.MorphAppStateRuntime = {
    create: createAppStateRuntime,
  };
  window.MorphAppStateDepsRuntime = {
    create: createAppStateDepsRuntime,
  };

  createAppStateRuntime();
})();
