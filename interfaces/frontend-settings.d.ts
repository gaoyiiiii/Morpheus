import type { MorphData } from "./core-data";
import type { ExtensionCatalogManifest } from "./extensions";
import type { ExtensionDataModelSpec, ExtensionHostIntegrationSpec, ExtensionUiSpec, OfficialExtensionManifest } from "./extensions";
import type { MorphRuntimeState } from "./runtime";

export interface SettingsGlucoseConfig {
  email: string;
  hasPassword: boolean;
  targetLow: number;
  targetHigh: number;
  region: string;
}

export interface SettingsFeishuConfig {
  enabled: boolean;
  appId: string;
  hasAppSecret: boolean;
  verificationToken: string;
  hasEncryptKey: boolean;
  botName: string;
  callbackPath: string;
  eventCount: number;
  lastMessageAt: string;
  lastEventType: string;
  runtimeConnected?: boolean;
  runtimeRunning?: boolean;
  runtimeReceivePolicy?: string;
  runtimeLastError?: string;
  aiConfigured?: boolean;
  aiProvider?: string;
  [key: string]: unknown;
}

export interface SettingsAgentStatus {
  enabled?: boolean;
  intervalSeconds?: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface SettingsRelationshipReminderPreferences {
  tone: "gentle" | "direct" | "minimal" | string;
  frequency: "balanced" | "important-only" | "follow-up" | string;
  lowStateStrategy: "extra-gentle" | "hold-back" | "stay-direct" | string;
  customNote: string;
}

export interface SettingsRelationshipProactivityPreferences {
  defaultMode: "balanced" | "proactive" | "reserved" | string;
  followUpStyle: "ask-more" | "wait-more" | "only-when-stuck" | string;
  interruptionThreshold: "important-only" | "balanced" | "surface-early" | string;
  customNote: string;
}

export interface SettingsRelationshipBoundaryPreferences {
  moneyDecisions: "ask-first" | "suggest-only" | "can-draft" | string;
  publicSpeech: "never-send" | "draft-only" | "ask-before-send" | string;
  healthJudgment: "suggest-only" | "ask-first" | "be-explicitly-cautious" | string;
  uncertaintyStyle: "say-uncertain" | "offer-options" | "pause-and-ask" | string;
  customNote: string;
}

export interface SettingsRelationshipLongTermFocusPreferences {
  primaryFocus: "steady-rhythm" | "project-delivery" | "health-stability" | "balanced" | string;
  supportStyle: "clarify-first" | "push-forward" | "steady-companion" | "protect-boundaries" | string;
  horizon: "this-week" | "this-season" | "long-term" | string;
  customNote: string;
}

export interface SettingsBehaviorPlanningPreferences {
  planningStyle: "clarify-then-plan" | "direct-plan" | "minimum-next-step" | string;
  certaintyStyle: "separate-facts" | "more-decisive" | "stay-conservative" | string;
  granularity: "top-three" | "time-blocks" | "full-steps" | string;
  customNote: string;
}

export interface SettingsBehaviorExpressionPreferences {
  responseLength: "concise" | "balanced" | "detailed" | string;
  structureStyle: "natural" | "structured" | "action-first" | string;
  warmth: "calm" | "balanced" | "encouraging" | string;
  customNote: string;
}

export interface SettingsBehaviorFocusPreferences {
  primaryAttention: "current-context" | "task-thread" | "long-term-balance" | string;
  retrievalPriority: "active-items" | "recent-signals" | "stable-patterns" | string;
  reminderBias: "important-first" | "deadline-first" | "state-first" | string;
  customNote: string;
}

export interface SettingsBehaviorSafetyPreferences {
  dataWriteMode: "explicit-only" | "double-check-high-risk" | "assistive-draft" | string;
  selfUpdateMode: "proposal-only" | "runtime-only" | "off" | string;
  highRiskAdviceMode: "strictly-conservative" | "balanced" | "ask-for-context" | string;
  customNote: string;
}

export interface SettingsBehaviorMemoryPreferences {
  captureMode: "important-only" | "balanced" | "rich-context" | string;
  retentionMode: "stable-preferences" | "decisions-and-turning-points" | "project-threads" | string;
  recallMode: "task-first" | "recent-first" | "pattern-first" | string;
  customNote: string;
}

export interface SettingsState {
  nativeBridge: boolean;
  syncRootPath: string;
  syncRootDeleteSafe: boolean | null;
  nativePlatform: string;
  statusMessage: string;
  aiStatusMessage: string;
  aiStatusError: boolean;
  runtimeStatusMessage: string;
  runtimeStatusError: boolean;
  glucoseStatusMessage: string;
  glucoseStatusError: boolean;
  feishuStatusMessage: string;
  feishuStatusError: boolean;
  secureVaultStatusMessage: string;
  secureVaultStatusError: boolean;
  writingStudioStatusMessage: string;
  writingStudioStatusError: boolean;
  relationshipModeStatusMessage: string;
  relationshipModeStatusError: boolean;
  behaviorHabitStatusMessage: string;
  behaviorHabitStatusError: boolean;
  glucoseConfigLoaded: boolean;
  feishuConfigLoaded: boolean;
  agentStatusLoaded: boolean;
  agentStatus: SettingsAgentStatus | null;
  glucoseConfig: SettingsGlucoseConfig;
  feishuConfig: SettingsFeishuConfig;
  aiProviderStatuses?: Record<string, any>;
  aiHealthCheckProvider?: string;
  aiHealthCheckSignature?: string;
  aiHealthCheckError?: boolean;
  aiHealthCheckMessage?: string;
  [key: string]: unknown;
}

export interface SettingsExtensionSummaryItem {
  id?: string;
  enabled?: boolean;
}

export type SettingsLocalPluginDefinition = Pick<
  OfficialExtensionManifest,
  "id" | "name" | "description" | "summary" | "entry" | "settingsTarget"
> & {
  ui?: ExtensionUiSpec;
  hostIntegration?: ExtensionHostIntegrationSpec;
  dataModel?: ExtensionDataModelSpec;
};

export interface SettingsSectionsRuntimeDeps {
  getExtensionsSummaryItems?: () => SettingsExtensionSummaryItem[];
  getIntegratedExtensionDefinitions?: () => Array<{
    id?: string;
    name?: string;
    icon?: string;
    summary?: string;
    description?: string;
    hostIntegration?: {
      settingsSection?: {
        id?: string;
        commandId?: string;
        label?: string;
        icon?: string;
      };
    };
  }>;
}

export interface SettingsSectionsRuntimeModules {
  buildExtensionCenterSummary: () => string;
  buildExtensionSettingsSectionItems: () => Array<{
    id: string;
    commandId?: string;
    extensionId: string;
    label: string;
    icon: string;
    summary: string;
  }>;
}

export interface SettingsDetailRuntimeDeps {
  getSettingsState?: () => SettingsState;
  getSettingsSyncSummary?: () => {
    descriptor?: {
      descriptorVersion?: string;
      platform?: string;
      shellKind?: string;
      syncMode?: string;
      durableWriteOwner?: string;
      canonicalStore?: { pathHint?: string };
      syncRoot?: { pathHint?: string };
      receiptFeed?: {
        kind?: string;
        lastReceiptAt?: string;
        status?: string;
        source?: string;
        reason?: string;
        pendingCount?: number;
        ackedRevision?: number;
      };
      bridgeStatus?: { sync?: string; control?: string; speech?: string };
    };
    bridgeBadgeLabel?: string;
    bridgeBadgeConnected?: boolean;
    syncRootText?: string;
    syncModeText?: string;
    syncRouteText?: string;
  } | null;
  getLegacyWritingRuntimeModules?: () => { buildSettingsDetailMarkup?: () => string } | null;
  getMorphRuntimeBundle?: () => MorphRuntimeState;
  getAIProvider?: () => string;
  getCurrentAIKey?: () => string;
  getCurrentAIModelLabel?: () => string;
  getApiKey?: () => string;
  getOpenRouterApiKey?: () => string;
  getGLMApiKey?: () => string;
  getDoubaoApiKey?: () => string;
  getQwenApiKey?: () => string;
  getKimiApiKey?: () => string;
  getCodexBaseUrl?: () => string;
  getDailyAlignEnabled?: () => boolean;
  getDailyAlignTime?: () => string;
  getDailyAlignLastRunDate?: () => string;
  getReminderSyncEnabled?: () => boolean;
  getReminderSyncEndpoint?: () => string;
  sanitizeMorphProactiveAgentConfig?: (value: unknown, fallback?: unknown) => { enabled?: boolean; heartbeatMinutes?: number; quietHoursStart?: string; quietHoursEnd?: string };
  formatProactiveWindowText?: (config: { quietHoursStart?: string; quietHoursEnd?: string }) => string;
  formatWorkerIntervalSecondsText?: (seconds?: number) => string;
  formatHeartbeatMinutesText?: (minutes?: number) => string;
  loadAgentStatusFromServer?: (options?: { silent?: boolean }) => Promise<boolean | void> | void;
  getAIMemory?: () => {
    soul?: string;
    identityNotes?: string;
    user?: string;
    memoryIndex?: string;
    systemNotes?: string;
    dailyLogs?: Record<string, unknown[]>;
    explicitMemoryLog?: unknown[];
    selfMemory?: {
      soul?: string;
      principles?: string;
      identity?: string[];
      motivations?: string[];
      motivationalMatrix?: {
        feeling?: string[];
        anticipation?: string[];
        belonging?: string[];
      };
      desires?: string[];
      fears?: string[];
      sensitivities?: string[];
      goals?: string[];
      tensions?: string[];
      relationalStance?: string[];
      growthDirections?: string[];
      attachmentPoints?: string[];
      attachmentAwareness?: string[];
      attachmentRecovery?: string[];
      attachmentRisks?: string[];
    };
    longTermMemory?: {
      identityNotes?: string;
      user?: string;
      memoryIndex?: string;
      systemNotes?: string;
      dailyLogs?: Record<string, unknown[]>;
      explicitMemoryLog?: unknown[];
      growthMemory?: {
        currentArc?: string;
        lessons?: string[];
      };
      narrativeMemory?: {
        currentThread?: string;
        selfObservation?: string;
        turningPoints?: string[];
        recentStoryMoves?: string[];
      };
      relationalStyleMemory?: {
        preferredDistance?: string;
        toleratedDirectness?: string;
        explanationTolerance?: string;
        pacingPreference?: string;
        trustMode?: string;
        landedMoves?: string[];
        avoidMoves?: string[];
      };
      environmentalMemory?: {
        currentEnvironment?: string;
        activeSupports?: string[];
        activePressures?: string[];
        shadowPulls?: string[];
        growthPulls?: string[];
        rebalancingMoves?: string[];
      };
      relationalMemory?: Array<{
        id?: string;
        at?: string;
        mode?: string;
        userCue?: string;
        assistantMove?: string;
        perceivedNeed?: string;
        tension?: string;
        notes?: string;
        outcome?: string;
        signals?: string[];
        tags?: string[];
      }>;
      relationalThreads?: Array<{
        id?: string;
        key?: string;
        label?: string;
        kind?: string;
        salience?: string;
        lastMentionedAt?: string;
        resonance?: string;
        futureBridge?: string;
        notes?: string;
        signals?: string[];
      }>;
      facts?: Array<{
        id?: string;
        category?: string;
        key?: string;
        label?: string;
        fact?: string;
        source?: string;
        confidence?: string;
        lastConfirmedAt?: string;
        lastObservedAt?: string;
        status?: string;
        taskHints?: string[];
        scope?: string;
        writeMode?: string;
        stability?: string;
        alwaysInject?: boolean;
        supersededBy?: string;
      archivedAt?: string;
      updatedAt?: string;
      editable?: boolean;
      }>;
      factArchive?: Array<{
        id?: string;
        category?: string;
        key?: string;
        label?: string;
        fact?: string;
        source?: string;
        confidence?: string;
        lastConfirmedAt?: string;
        lastObservedAt?: string;
        status?: string;
        taskHints?: string[];
        scope?: string;
        writeMode?: string;
        stability?: string;
        alwaysInject?: boolean;
        supersededBy?: string;
      archivedAt?: string;
      updatedAt?: string;
      editable?: boolean;
      }>;
    };
    workingMemory?: {
      currentTaskState?: {
        summary?: string;
        lastUserIntent?: string;
        nextStep?: string;
        pendingDataIntent?: string;
        lastActionLabels?: string[];
        updatedAt?: string;
      };
      currentWorkflowState?: {
        type?: string;
        step?: string;
        targetName?: string;
        summary?: string;
        updatedAt?: string;
      };
      pendingCorrectionReconfirmation?: {
        message?: string;
        createdAt?: string;
        sourceSignals?: string[];
      };
      pendingProactiveReminder?: {
        message?: string;
        createdAt?: string;
        severity?: string;
        source?: string;
        transitionHint?: string;
      };
      pendingMemoryObservations?: Array<{
        id?: string;
        source?: string;
        mode?: "observe";
        summary?: string;
        userText?: string;
        assistantText?: string;
        responseMode?: string;
        dominantMode?: "oracle" | "architect" | "balanced";
        actionBias?: "hold-space" | "clarify-and-frame" | "guide-then-structure" | "structure-and-advance" | "structure-and-commit";
        createdAt?: string;
        updatedAt?: string;
      }>;
      internalDecisionTrace?: Array<{
        id?: string;
        kind?: "interaction" | "proactive";
        source?: string;
        summary?: string;
        responseMode?: string;
        workflowType?: string;
        workflowStep?: string;
        memoryWriteMode?: "observe" | "commit" | "";
        proactiveSurfaceDecision?: "surface" | "queue" | "skip" | "";
        proactivePersistenceDecision?: "persist" | "skip" | "";
        dominantMode?: "oracle" | "architect" | "balanced" | "";
        actionBias?: "hold-space" | "clarify-and-frame" | "guide-then-structure" | "structure-and-advance" | "structure-and-commit" | "";
        findingKeys?: string[];
        notes?: string[];
        createdAt?: string;
        updatedAt?: string;
      }>;
      sharedIntentionality?: {
        sharedAttention?: string;
        sharedObject?: string;
        sharedGround?: string;
        sharedQuestion?: string;
        sharedGoal?: string;
        sharedMeaning?: string;
        sharedDirection?: string;
        mutualOrientation?: string;
        reciprocalCue?: string;
        sceneTension?: string;
        coordinationMode?: string;
      };
      relationalBridge?: {
        label?: string;
        kind?: string;
        mode?: string;
        rationale?: string;
        fitScore?: number;
      };
      innerState?: {
        responseMode?: string;
        pressureLevel?: string;
        supportNeed?: string;
        primaryDrive?: string;
        secondaryDrive?: string;
        affectTone?: string[];
        attachmentActivation?: string[];
        relationalSignals?: string[];
        awarenessCue?: string;
        recoveryMove?: string;
      };
      discoursePlan?: {
        primaryFunction?: string;
        secondaryFunction?: string;
        openingMove?: string;
        preferredMoves?: string[];
        openingConstraints?: string[];
        avoidFunctions?: string[];
        explanationPermission?: string;
        advicePermission?: string;
        initiativeLevel?: string;
        followUpDepth?: string;
        questionBudget?: number;
        continuationBias?: string;
        pauseBias?: string;
        closurePreference?: string;
        askBeforeAdvice?: boolean;
      };
      growthState?: {
        currentAim?: string;
        currentDrift?: string[];
        shadowPull?: string[];
        recoveryFocus?: string[];
      };
      moodField?: {
        prevailingTone?: string;
        trajectory?: string;
        intensity?: string;
        carryForwardNotes?: string[];
      };
      valueConflict?: {
        activeConflict?: string;
        poles?: string[];
        currentLean?: string;
        synthesis?: string;
      };
      presenceField?: {
        supportPosture?: string;
        feltSignals?: string[];
        bodylessSensations?: string[];
        groundingMoves?: string[];
      };
    };
    behaviorHabits?: {
      memoryPreferences?: Partial<SettingsBehaviorMemoryPreferences>;
      planningPreferences?: Partial<SettingsBehaviorPlanningPreferences>;
      expressionPreferences?: Partial<SettingsBehaviorExpressionPreferences>;
      focusPreferences?: Partial<SettingsBehaviorFocusPreferences>;
      safetyPreferences?: Partial<SettingsBehaviorSafetyPreferences>;
    };
    relationshipMode?: {
      reminderPreferences?: Partial<SettingsRelationshipReminderPreferences>;
      proactivityPreferences?: Partial<SettingsRelationshipProactivityPreferences>;
      boundaryPreferences?: Partial<SettingsRelationshipBoundaryPreferences>;
      longTermFocusPreferences?: Partial<SettingsRelationshipLongTermFocusPreferences>;
    };
  };
  buildDefaultAIUserMarkdown?: () => string;
  getDefaultRelationshipReminderPreferences?: () => SettingsRelationshipReminderPreferences;
  getDefaultRelationshipProactivityPreferences?: () => SettingsRelationshipProactivityPreferences;
  getDefaultRelationshipBoundaryPreferences?: () => SettingsRelationshipBoundaryPreferences;
  getDefaultRelationshipLongTermFocusPreferences?: () => SettingsRelationshipLongTermFocusPreferences;
  getDefaultBehaviorMemoryPreferences?: () => SettingsBehaviorMemoryPreferences;
  getDefaultBehaviorPlanningPreferences?: () => SettingsBehaviorPlanningPreferences;
  getDefaultBehaviorExpressionPreferences?: () => SettingsBehaviorExpressionPreferences;
  getDefaultBehaviorFocusPreferences?: () => SettingsBehaviorFocusPreferences;
  getDefaultBehaviorSafetyPreferences?: () => SettingsBehaviorSafetyPreferences;
  syncStructuredLongTermFacts?: (aiMemory: unknown) => unknown;
  replaceStableUserMemoryDocument?: (markdown: string, aiMemory: unknown, options?: { source?: string }) => Record<string, any> | unknown;
  saveData?: (options?: { skipUndo?: boolean; skipRender?: boolean; domains?: string[]; immediatePersist?: boolean }) => void;
  renderSettingsView?: () => void;
  applyMorphRuntimeOverlayUpdate?: (patch: Partial<MorphRuntimeState>) => boolean;
  escapeHTML?: (value: string) => string;
  setRuntimeStatus?: (message: string, isError?: boolean) => void;
}

export interface SettingsDetailRuntimeModules {
  buildSettingsDetailMarkup: (mode: string) => string;
  saveAIUserMemoryFromSettings: () => void;
  saveAIMemoryIndexFromSettings?: () => void;
  saveStableMemoryIdentityFromSettings: () => void;
  saveStableMemoryFactFromSettings: (factId: string, inputId: string) => void;
  deleteStableMemoryFactFromSettings: (factId: string) => void;
  toggleStableMemoryFactLockFromSettings: (factId: string) => void;
  deleteExplicitMemoryEntryFromSettings: (index: number) => void;
  saveRelationshipReminderPreferencesFromSettings: () => void;
  saveRelationshipProactivityPreferencesFromSettings: () => void;
  saveRelationshipBoundaryPreferencesFromSettings: () => void;
  saveRelationshipLongTermFocusPreferencesFromSettings: () => void;
  saveBehaviorMemoryPreferencesFromSettings: () => void;
  saveBehaviorPlanningPreferencesFromSettings: () => void;
  saveBehaviorExpressionPreferencesFromSettings: () => void;
  saveBehaviorFocusPreferencesFromSettings: () => void;
  saveBehaviorSafetyPreferencesFromSettings: () => void;
  saveMorphRuntimeFromSettings: () => void;
  saveMorphRuntimeSectionFromSettings: (section: string) => void;
  [key: string]: unknown;
}

export interface SettingsModalRuntimeDeps {
  storage: {
    setApiKey: (value: string) => void;
    setOpenRouterApiKey: (value: string) => void;
    setGLMApiKey?: (value: string) => void;
    setDoubaoApiKey?: (value: string) => void;
    setQwenApiKey?: (value: string) => void;
    setKimiApiKey?: (value: string) => void;
    setCodexApiKey?: (value: string) => void;
    setCodexBaseUrl?: (value: string) => void;
    setCodexModel?: (value: string) => void;
    setAIProvider: (value: string) => void;
  };
  openCustomModal?: (options: { title: string; desc: string; actionText?: string; onConfirm?: (value?: string) => void | Promise<void> }) => void;
  renderSettingsView?: () => void;
  getCurrentTab?: () => string;
  getData?: () => MorphData;
  ensureExpenseLedgerShape?: (source?: MorphData | null) => { records?: unknown[]; categories?: string[] };
  getExtensionPrivateState?: (extensionId: string, source?: MorphData) => Record<string, unknown>;
  setExtensionPrivateState?: (extensionId: string, updater: Record<string, unknown> | ((prevState: Record<string, unknown>) => Record<string, unknown>), options?: { save?: boolean; skipRender?: boolean; skipUndo?: boolean }) => Record<string, unknown> | null;
  getExtensionsRuntimeModules?: () => { getCachedCatalog?: () => ExtensionCatalogManifest | null } | null;
  getLocalPluginSettingsModalOpen?: () => boolean;
  setLocalPluginSettingsModalOpen?: (next: boolean) => void;
  getLocalPluginSettingsDefinition?: () => SettingsLocalPluginDefinition | null;
  setLocalPluginSettingsDefinition?: (next: SettingsLocalPluginDefinition | null) => void;
  getDailyAlignSettingsModalOpen?: () => boolean;
  setDailyAlignSettingsModalOpen?: (next: boolean) => void;
  getAIKeySettingsModalOpen?: () => boolean;
  setAIKeySettingsModalOpen?: (next: boolean) => void;
  getAIKeySettingsModalProvider?: () => string;
  setAIKeySettingsModalProvider?: (next: string) => void;
  getSecureVaultSettingsModalOpen?: () => boolean;
  setSecureVaultSettingsModalOpen?: (next: boolean) => void;
  getApiKey?: () => string;
  getOpenRouterApiKey?: () => string;
  getGLMApiKey?: () => string;
  getDoubaoApiKey?: () => string;
  getQwenApiKey?: () => string;
  getKimiApiKey?: () => string;
  getCodexApiKey?: () => string;
  getCodexBaseUrl?: () => string;
  getCodexModel?: () => string;
  setAISettingsFeedback?: (message: string, isError?: boolean) => void;
}

export interface SettingsModalRuntimeModules {
  syncLocalPluginSettingsModalUI: () => void;
  openLocalPluginSettingsModal: (definition?: SettingsLocalPluginDefinition | null) => void;
  closeLocalPluginSettingsModal: () => void;
  openLocalPluginSettingsModalById: (id?: string) => void;
  syncDailyAlignSettingsModalUI: () => void;
  openDailyAlignSettingsModal: () => void;
  closeDailyAlignSettingsModal: () => void;
  syncAIKeySettingsModalUI: () => void;
  openAIKeySettingsModal: (provider?: string) => void;
  closeAIKeySettingsModal: () => void;
  saveAIKeyFromModal: () => void;
  clearAIKeyFromModal: () => void;
  syncSecureVaultSettingsModalUI: () => void;
  openSecureVaultSettingsModal: () => void;
  closeSecureVaultSettingsModal: () => void;
}

export interface SettingsActionsRuntimeDeps {
  storage: {
    hasNativeControlBridge: () => boolean;
    callNativeDesktopControl: (action: string, payload?: unknown) => Promise<any>;
    setApiKey: (value: string) => void;
    setOpenRouterApiKey: (value: string) => void;
    setGLMApiKey?: (value: string) => void;
    setDoubaoApiKey?: (value: string) => void;
    setQwenApiKey?: (value: string) => void;
    setKimiApiKey?: (value: string) => void;
    setCodexApiKey?: (value: string) => void;
    setCodexBaseUrl?: (value: string) => void;
    setCodexModel?: (value: string) => void;
    setAIProvider: (value: string) => void;
    setDailyAlignEnabled: (value: boolean) => void;
    setDailyAlignTime: (value: string) => void;
    setDailyAlignPrompt: (value: string) => void;
    setTTSProvider?: (value: string) => void;
    setAIAutoSpeak?: (value: boolean) => void;
    chooseWebSyncRoot?: (options?: Record<string, unknown>) => Promise<Record<string, any> | null>;
    canUseWebDirectoryPicker?: () => boolean;
    canUseWebDirectoryUploadFallback?: () => boolean;
    reloadDataFromWebSyncRoot?: (options?: Record<string, unknown>) => Promise<Record<string, any> | null>;
    getWebSyncRootMeta?: () => Record<string, any> | null;
  };
  getSettingsState?: () => SettingsState;
  renderSettingsView?: () => void;
  openCustomModal?: (options: { title: string; desc: string; actionText?: string; onConfirm?: (value?: string) => void | Promise<void> }) => void;
  getAIProvider?: () => string;
  getApiKey?: () => string;
  getOpenRouterApiKey?: () => string;
  getGLMApiKey?: () => string;
  getDoubaoApiKey?: () => string;
  getQwenApiKey?: () => string;
  getKimiApiKey?: () => string;
  getCodexBaseUrl?: () => string;
  getCodexApiKey?: () => string;
  getCodexModel?: () => string;
  openAIKeySettingsModal?: (provider?: string) => void;
  setAISettingsFeedback?: (message: string, isError?: boolean) => void;
  getDailyAlignDefaultPrompt?: () => string;
  restartDailyAlignScheduler?: () => void;
  closeDailyAlignSettingsModal?: () => void;
  performAsyncSystemSettingsMutation?: (options: {
    actionType: string;
    label: string;
    domains?: string[];
    detail?: Record<string, unknown>;
    mutation: () => Promise<{ changed?: boolean; appliedLabel?: string } | void> | { changed?: boolean; appliedLabel?: string } | void;
  }) => Promise<void>;
  performSensitiveSettingsMutation?: (options: {
    actionType: string;
    label: string;
    detail?: Record<string, unknown>;
    mutation: () => Promise<{ changed?: boolean; appliedLabel?: string } | void> | { changed?: boolean; appliedLabel?: string } | void;
  }) => Promise<void> | void;
  setReminderSyncEnabled?: (value: boolean) => void;
  setReminderSyncEndpoint?: (value: string) => string;
  restartReminderLanSyncScheduler?: () => void;
  scheduleReminderLanSync?: (reason?: string) => void;
  setThemeMode?: (mode: "light" | "dark" | "system") => void;
  syncAllPluginFacingDataExports?: () => Promise<void> | void;
  rebuildPluginDataInSettings?: () => Promise<void> | void;
}

export interface SettingsActionsRuntimeModules {
  chooseSettingsSyncRoot: () => Promise<void>;
  openSettingsSyncRoot: () => Promise<void>;
  rebuildPluginDataInSettings: () => Promise<void>;
  reloadFromUserDataInSettings: () => Promise<void>;
  saveApiKeysFromSettings: () => void;
  clearCurrentAIKeyFromSettings: () => void;
  setAIProviderFromSettings: (provider: string) => void;
  saveDailyAlignSettingsFromSettings: () => void;
  saveReminderSyncSettingsFromSettings: () => void;
  saveTTSSettingsFromSettings: () => void;
  setLightThemeFromSettings: () => void;
  setDarkThemeFromSettings: () => void;
  setSystemThemeFromSettings: () => void;
}

export interface SettingsRenderRuntimeDeps {
  storage: {
    getLastSyncAt?: () => string;
    getLastRestoreAt?: () => string;
    getTheme?: () => string;
    getWebSyncRootMeta?: () => Record<string, any> | null;
    readLastSyncReceipt?: () => Record<string, any> | null;
    getSyncMutationState?: () => Record<string, any> | null;
  };
  getSettingsState?: () => SettingsState;
  getSettingsSyncSummary?: () => {
    descriptor?: {
      descriptorVersion?: string;
      platform?: string;
      shellKind?: string;
      syncMode?: string;
      durableWriteOwner?: string;
      canonicalStore?: { pathHint?: string };
      syncRoot?: { pathHint?: string };
      receiptFeed?: {
        kind?: string;
        lastReceiptAt?: string;
        status?: string;
        source?: string;
        reason?: string;
        pendingCount?: number;
        ackedRevision?: number;
      };
      bridgeStatus?: { sync?: string; control?: string; speech?: string };
    };
    bridgeBadgeLabel?: string;
    bridgeBadgeConnected?: boolean;
    syncRootText?: string;
    syncModeText?: string;
    syncRouteText?: string;
  } | null;
  getShellDescriptor?: () => {
    descriptorVersion?: string;
    platform?: string;
    shellKind?: string;
    syncMode?: string;
    durableWriteOwner?: string;
    startupSourceInspection?: {
      bootstrapSource?: string;
      authoritativeSource?: string;
      authoritativeRevision?: number;
      authoritativeLastWriteAt?: string;
      authoritativeHasUserData?: boolean;
      canonicalStoreKind?: string;
      canonicalStorePathHint?: string;
      selectedBrowserDirectory?: boolean;
      browserDirectoryPathHint?: string;
      browserDirectoryReadable?: boolean;
      browserDirectoryWritable?: boolean;
      nativeSyncRootPath?: string;
      durableWriteOwner?: string;
      selectionReason?: string;
    };
    canonicalStore?: { pathHint?: string };
    syncRoot?: { pathHint?: string };
    receiptFeed?: {
      kind?: string;
      lastReceiptAt?: string;
      status?: string;
      source?: string;
      reason?: string;
      pendingCount?: number;
      ackedRevision?: number;
    };
    bridgeStatus?: { sync?: string; control?: string; speech?: string };
  } | null;
  getAIMemory?: () => {
    user?: string;
    dailyLogs?: Record<string, unknown[]>;
    relationshipMode?: {
      reminderPreferences?: Partial<SettingsRelationshipReminderPreferences>;
      proactivityPreferences?: Partial<SettingsRelationshipProactivityPreferences>;
      boundaryPreferences?: Partial<SettingsRelationshipBoundaryPreferences>;
      longTermFocusPreferences?: Partial<SettingsRelationshipLongTermFocusPreferences>;
    };
  };
  getMorphRuntimeBundle?: () => MorphRuntimeState;
  getApiKey?: () => string;
  getOpenRouterApiKey?: () => string;
  getGLMApiKey?: () => string;
  getDoubaoApiKey?: () => string;
  getQwenApiKey?: () => string;
  getKimiApiKey?: () => string;
  getCodexApiKey?: () => string;
  getCodexBaseUrl?: () => string;
  getCodexModel?: () => string;
  getAIProvider?: () => string;
  getCurrentAIModelLabel?: () => string;
  getSettingsSectionsRuntimeModules?: () => SettingsSectionsRuntimeModules | null;
  getObservabilityRuntimeModules?: () => {
    buildNativeBuildInfoRows?: (info?: Record<string, unknown> | null) => string;
    [key: string]: unknown;
  } | null;
  getSecureVaultRecord?: () => { accountName?: string; updatedAt?: string; cipher?: { ciphertextB64?: string } };
  normalizeGlucoseRegion?: (value?: string) => string;
  isIOSNativeAppRuntime?: () => boolean;
  formatGlucoseTargetRangeMmol?: (low: number, high: number) => string;
  syncGlucoseSettingsModalUI?: () => void;
  resolveFeishuCallbackURL?: (path?: string) => string;
  formatSettingsTime?: (value?: string) => string;
  syncFeishuSettingsModalUI?: () => void;
  getDailyAlignEnabled?: () => boolean;
  getDailyAlignTime?: () => string;
  getDailyAlignPrompt?: () => string;
  getDailyAlignLastRunDate?: () => string;
  syncSecureVaultSettingsModalUI?: () => void;
  syncAIKeySettingsModalUI?: () => void;
  syncDailyAlignSettingsModalUI?: () => void;
  requestLucideRefresh?: (options?: { root?: Element | Document | null }) => void;
  getReminderSyncEnabled?: () => boolean;
  getReminderSyncEndpoint?: () => string;
  getTodayStr?: () => string;
  ensureMorphRuntimeShape?: (data: MorphData) => { morphRuntime: { lastUpdatedAt?: string } };
  getData?: () => MorphData;
}

export interface SettingsRenderRuntimeModules {
  syncSettingsSummaryUI: () => void;
}

export interface SettingsControllerRuntimeDeps {
  getSettingsState?: () => SettingsState;
  normalizeGlucoseRegion?: (value?: string) => string;
  setAIProviderFromSettings?: (provider: string) => void;
  openAIKeySettingsModal?: (provider?: string) => void;
  closeAIKeySettingsModal?: () => void;
  saveAIKeyFromModal?: () => void;
  clearAIKeyFromModal?: () => void;
  openSecureVaultSettingsModal?: () => void;
  closeSecureVaultSettingsModal?: () => void;
  backupSensitiveSettingsToSecureVault?: () => void;
  restoreSensitiveSettingsFromSecureVault?: () => void;
  openGlucoseSettingsModal?: () => void;
  openFeishuSettingsModal?: () => void;
  closeGlucoseSettingsModal?: () => void;
  closeFeishuSettingsModal?: () => void;
  closeLocalPluginSettingsModal?: () => void;
  closeDailyAlignSettingsModal?: () => void;
  saveGlucoseConfigFromSettings?: () => void;
  saveFeishuConfigFromSettings?: () => void;
  loadGlucoseConfigFromServer?: (options?: { silent?: boolean }) => void;
  loadFeishuConfigFromServer?: (options?: { silent?: boolean }) => void;
  saveDailyAlignSettingsFromSettings?: () => void;
  saveReminderSyncSettingsFromSettings?: () => void;
  setSystemThemeFromSettings?: () => void;
  setLightThemeFromSettings?: () => void;
  setDarkThemeFromSettings?: () => void;
  chooseSettingsSyncRoot?: () => void;
  openSettingsSyncRoot?: () => void;
  rebuildPluginDataInSettings?: () => void;
  reloadFromUserDataInSettings?: () => void;
  saveAIUserMemoryFromSettings?: () => void;
  saveRelationshipReminderPreferencesFromSettings?: () => void;
  saveRelationshipProactivityPreferencesFromSettings?: () => void;
  saveRelationshipBoundaryPreferencesFromSettings?: () => void;
  saveRelationshipLongTermFocusPreferencesFromSettings?: () => void;
  saveMorphRuntimeFromSettings?: () => void;
}

export interface SettingsControllerRuntimeModules {
  bindSettingsEvents: () => void;
}

export interface SettingsPageRuntimeDeps {
  getSettingsState?: () => SettingsState;
  getSettingsDetailMode?: () => string | null;
  setSettingsDetailMode?: (mode: string | null) => void;
  getSettingsDetailRuntimeModules?: () => SettingsDetailRuntimeModules | null;
  getSettingsRenderRuntimeModules?: () => SettingsRenderRuntimeModules | null;
  getSettingsControllerRuntimeModules?: () => SettingsControllerRuntimeModules | null;
  getLegacyWritingRuntimeModules?: () => { openWritingStudioSettings?: () => void } | null;
  requestLucideRefresh?: (options?: { root?: Element | Document | null }) => void;
  syncExtensionVisibility?: () => void;
  syncExperimentalFeatureVisibility?: () => void;
  refreshSettingsNativeState?: () => void;
  chooseSettingsSyncRoot?: () => void;
  openSettingsSyncRoot?: () => void;
  reloadFromUserDataInSettings?: () => void;
}

export interface SettingsPageRuntimeModules {
  syncSettingsStatusBadgeFromGlobal: () => void;
  renderSettingsView: () => void;
  buildSettingsDetailMarkup: (mode: string) => string;
  bindSettingsDetailActions: (mode: string) => void;
  openSettingsDetail: (mode: string) => void;
  closeSettingsDetail: () => void;
}

declare global {
  interface Window {
    isMobileNavMode?: () => boolean;
    MorphSyncReasonRuntime?: {
      create?: (deps?: Record<string, unknown>) => Record<string, unknown>;
      [key: string]: unknown;
    };
    MorphSettingsActionsRuntimeInstance?: Partial<SettingsActionsRuntimeModules> & Record<string, unknown>;
    closeGlucoseSettingsModal?: () => void;
    closeFeishuSettingsModal?: () => void;
    closeAppleHealthSettingsModal?: () => void;
    MorphPomodoroPluginRuntime?: {
      create?: (deps?: Record<string, unknown>) => Record<string, unknown>;
      [key: string]: unknown;
    };
    savePomodoroPluginSettingsFromModal?: () => void;
    resetPomodoroPluginSettingsFromModal?: () => void;
    runAIProviderHealthCheckFromSettings?: (provider?: string) => void;
    MorphSettingsSectionsRuntime?: {
      create: (deps: SettingsSectionsRuntimeDeps) => SettingsSectionsRuntimeModules;
    };
    MorphSettingsDetailRuntime?: {
      create: (deps: SettingsDetailRuntimeDeps) => SettingsDetailRuntimeModules;
    };
    MorphSettingsModalRuntime?: {
      create: (deps: SettingsModalRuntimeDeps) => SettingsModalRuntimeModules;
    };
    MorphSettingsActionsRuntime?: {
      create: (deps: SettingsActionsRuntimeDeps) => SettingsActionsRuntimeModules;
    };
    MorphSettingsRenderRuntime?: {
      create: (deps: SettingsRenderRuntimeDeps) => SettingsRenderRuntimeModules;
    };
    MorphSettingsControllerRuntime?: {
      create: (deps: SettingsControllerRuntimeDeps) => SettingsControllerRuntimeModules;
    };
    MorphSettingsPageRuntime?: {
      create: (deps: SettingsPageRuntimeDeps) => SettingsPageRuntimeModules;
    };
  }
}

export {};
