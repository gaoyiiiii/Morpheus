import type { SkillCatalogManifest } from "./extensions";
import type { MorphRuntimeState } from "./runtime";
import type { PermissionKey } from "./tasks";

export interface AIAction {
  type: string;
  [key: string]: unknown;
}

export interface AIChatAttachment {
  id?: string;
  name?: string;
  type?: string;
  size?: number;
  content?: string;
  path?: string;
  mode?: "reference" | "ingest" | "image" | "audio" | "file";
}

export interface AIChatAttachmentPreviewItem {
  id?: string;
  name: string;
  type?: string;
  sizeLabel?: string;
  mode: NonNullable<AIChatAttachment["mode"]>;
}

export interface WebCitation {
  title?: string;
  source?: string;
  url?: string;
}

export interface WebSearchBundle {
  contextText?: string;
  citations?: WebCitation[];
}

export interface AITimingPhase {
  key: string;
  ms: number;
  detail?: string;
}

export interface AITimingTrace {
  totalMs?: number;
  visibleReplyMs?: number;
  path?: string;
  latencyMode?: string;
  provider?: string;
  phases?: AITimingPhase[];
}

export interface RuntimeInspectionSnapshot {
  runtimeLoaded?: boolean;
  selfUpgradeEnabled?: boolean;
  writableScopes?: string[];
  capabilities?: string[];
  disabledActions?: string[];
  actionPolicySummary?: {
    oracleSafe?: string[];
    architectRequired?: string[];
    explicitConsentRequired?: string[];
    disabledByDefault?: string[];
  };
  contextRules?: Record<string, unknown>;
  proactiveAgent?: Record<string, unknown>;
  memoryRulesPreview?: string[];
}

export interface AITemporalFrame {
  timezone?: string;
  nowText?: string;
  date?: string;
  month?: string;
  weekdayLabel?: string;
  hour?: number;
  minute?: number;
  periodLabel?: string;
  isLateNight?: boolean;
  isEvening?: boolean;
  relativeDates?: {
    today?: string;
    yesterday?: string;
    tomorrow?: string;
  };
}

export interface WorkspaceSnapshotSamples {
  responseMode?: AIResponseMode;
  temporalFrame?: AITemporalFrame;
  soulUserMaterialExcerpt?: string[];
  soulMaterialActivation?: {
    source?: string;
    sectionTitle?: string;
    lines?: string[];
    remainingTurns?: number;
    updatedAt?: string;
  } | null;
  priorityMemoryPacket?: {
    userDirectives?: string[];
    sessionSummary?: string[];
    currentCorrections?: string[];
    relevantFacts?: string[];
    selfIdentity?: string[];
    soulSignals?: string[];
  };
  coreMemoryPacket?: {
    userDirectives?: unknown[];
    relevantFacts?: unknown[];
    [key: string]: unknown;
  };
  currentView?: AIWorkspaceCurrentView;
  projectNames?: unknown[];
  reminders?: unknown[];
  flashThoughtCatalog?: unknown[];
  projectReferenceCatalog?: unknown[];
  projectHierarchy?: unknown[];
  dailyLogCatalog?: unknown[];
  recentDailyLogs?: unknown[];
  expenseLedger?: {
    categories?: unknown[];
    recentRecords?: unknown[];
    [key: string]: unknown;
  };
  userExcerpt?: unknown[];
  memoryIndexExcerpt?: unknown[];
  identityExcerpt?: unknown[];
  recentMemoryBuffer?: {
    user?: Array<{ id?: string; namespace?: "user"; text?: string; source?: string; createdAt?: string }>;
    self?: Array<{ id?: string; namespace?: "self"; text?: string; source?: string; createdAt?: string }>;
    task?: Array<{ id?: string; namespace?: "task"; text?: string; source?: string; createdAt?: string }>;
  };
  relevantSources?: WebCitation[];
  citationChains?: string[];
  runtimeInspection?: RuntimeInspectionSnapshot;
  /** 兼容字段：仅在 Apple 健康插件启用时才会暴露的 HealthKit 摘要。 */
  appleHealthSummary?: Record<string, unknown> | null;
  currentWorkflowState?: {
    type?: string;
    step?: string;
    targetName?: string;
  };
  currentTaskState?: {
    summary?: string;
    lastUserIntent?: string;
    nextStep?: string;
    pendingDataIntent?: string;
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
  recentAssistantMessage?: string;
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
    inferredIntent?: string;
    alignmentConfidence?: string;
    needsClarification?: boolean;
    clarificationReason?: string;
    inferenceSignals?: string[];
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
    sharedAnchorType?: string;
    sharedAnchorText?: string;
    carryForwardLesson?: string;
    bridgeMode?: string;
    bridgeTarget?: string;
    bridgeGuidance?: string;
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
    tensionLevel?: string;
    synthesis?: string;
  };
  presenceField?: {
    supportPosture?: string;
    feltSignals?: string[];
    bodylessSensations?: string[];
    groundingMoves?: string[];
  };
  relationalFlow?: {
    currentState?: string;
    momentum?: string;
    lastMode?: string;
    recurringPattern?: string;
    carryForwardNotes?: string[];
  };
  growthMemory?: {
    currentArc?: string;
    lessons?: string[];
    driftCounts?: Record<string, number>;
    landedCounts?: Record<string, number>;
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
  relationalMemorySummary?: {
    relationshipState?: string;
    recurringNeeds?: string[];
    recurringFriction?: string[];
    recurringFit?: string[];
    preferredMoves?: string[];
    avoidMoves?: string[];
    summaryLines?: string[];
  };
  selfPrinciples?: Array<{
    text?: string;
    score?: number;
  }>;
  selfPrincipleGuidance?: string[];
  selfMemoryProfile?: {
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
  longTermFactSelection?: {
    total?: number;
    stableCount?: number;
    usableCount?: number;
    confirmFirstCount?: number;
    ambiguousCount?: number;
    latestVersionCount?: number;
    strongCount?: number;
    supportedCount?: number;
    cautiousCount?: number;
    topTaskHints?: string[];
    topSources?: string[];
    topReasonCodes?: string[];
  };
  longTermFactTelemetry?: {
    purpose?: string;
    highRisk?: boolean;
    minimumReferenceStrength?: string;
    minimumSelectionConfidence?: string;
    preferLatestConfirmedVersion?: boolean;
    total?: number;
    stableCount?: number;
    usableCount?: number;
    confirmFirstCount?: number;
    ambiguousCount?: number;
    latestVersionCount?: number;
    strongCount?: number;
    supportedCount?: number;
    cautiousCount?: number;
    selectedLatestVersionCount?: number;
    directUseCount?: number;
    directUseRatio?: number;
    confirmFirstRatio?: number;
    latestVersionRatio?: number;
    cautiousRatio?: number;
    strongRatio?: number;
    overallStability?: string;
    usageMode?: string;
    topTaskHints?: string[];
    topSources?: string[];
    topReasonCodes?: string[];
  };
  longTermFacts?: Array<{
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
    reconfirmAfterDays?: number;
    needsReconfirmation?: boolean;
    needsReconfirmationReason?: string;
    staleAt?: string;
    versionGroup?: string;
    supersedes?: string;
    referenceStrength?: string;
    trustLevel?: string;
    mustConfirmBeforeUse?: boolean;
    isLatestVersion?: boolean;
    selectionReason?: string;
    ambiguous?: boolean;
    selectionConfidence?: string;
    reasonCodes?: string[];
    scoreGap?: number;
    currentVersionDominance?: number;
    currentVersionGap?: number;
    meetsSelectionThreshold?: boolean;
  }>;
}

export interface AIWorkspaceCurrentView {
  tab?: string;
  tabLabel?: string;
  activeContextId?: string;
  selectedDailyMonth?: string;
  activeThoughtsViewPane?: string;
  activeThoughtsViewPaneLabel?: string;
  activeThoughtVisualMode?: string;
  activeThoughtVisualModeLabel?: string;
  activeProjectCollectionPane?: string;
  activeProjectSpaceId?: string;
  activeProjectViewPane?: string;
  activeLocalPluginWorkspaceId?: string;
  activeProject?: {
    id?: string;
    name?: string;
    referenceCount?: number;
    blockSample?: unknown[];
    [key: string]: unknown;
  } | null;
  activeRoutine?: {
    id?: string;
    name?: string;
    blockSample?: unknown[];
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface AIWorkspaceSnapshot {
  todayDate?: string;
  yesterdayDate?: string;
  counts?: Record<string, unknown>;
  todayDailyLog?: unknown[];
  yesterdayDailyLog?: unknown[];
  currentView?: AIWorkspaceCurrentView;
  samples?: WorkspaceSnapshotSamples;
  [key: string]: unknown;
}

export interface AIPlannerSummary {
  taskType?: string;
  taskLabel?: string;
  executionMode?: string;
  reason?: string;
  objective?: string;
  summary?: string;
}

export interface AIResponseMode {
  mode?: "solve" | "organize" | "companionship" | "overload" | "boundary" | "meaning";
  reason?: string;
}

export interface AIDualGuidance {
  dominantMode?: "oracle" | "architect" | "balanced";
  oracleWeight?: number;
  architectWeight?: number;
  actionBias?: "hold-space" | "clarify-and-frame" | "guide-then-structure" | "structure-and-advance" | "structure-and-commit";
  visibility?: "internal-only";
  summary?: string;
  rationale?: string;
  focusPoints?: string[];
  promptDirectives?: string[];
}

export interface BundledSkillPromptContext {
  manifest?: SkillCatalogManifest | null;
  summary?: string;
  matchedSkillIds?: string[];
  promptText: string;
}

export interface PluginAIReadableContext {
  pluginId: string;
  label?: string;
  promptText?: string;
  readableEntities?: string[];
  snapshotProjection?: unknown;
}

export interface AIExecutionContext {
  safeAttachments: AIChatAttachment[];
  attachmentContext: string;
  pluginPromptContexts: PluginAIReadableContext[];
  webSearchBundle: WebSearchBundle | null;
  snapshot: AIWorkspaceSnapshot;
  skillPromptContext: string;
  responseMode?: AIResponseMode;
  beijingNow: string;
  runtime: MorphRuntimeState;
  allowMorphDataActions: boolean;
  latencyMode?: "fast" | "full";
  isRoleConflictQuery?: boolean;
  activeSkillIds?: string[];
}

export interface MainAIPromptInput {
  extractedQuestion?: {
    promptQuestion?: string;
    userVisibleQuestion?: string;
    extracted?: boolean;
  };
  promptQuestion: string;
  webSearchRequested?: boolean;
  beijingNow?: string;
  temporalFrame?: AITemporalFrame | null;
  responseMode?: AIResponseMode;
  snapshot: AIWorkspaceSnapshot;
  runtime: MorphRuntimeState;
  isRoleConflictQuery?: boolean;
  allowMorphDataActions?: boolean;
  attachmentContext?: string;
  skillPromptContext?: string;
  pluginPromptContexts?: PluginAIReadableContext[];
  webSearchBundle?: WebSearchBundle | null;
  aiPersonaContext?: string;
}

export interface AIStreamProgressState {
  recordChat: boolean;
  promptQuestion?: string;
  assistantMessageId?: string | null;
  bestStreamedReply?: string;
}

export interface AIStreamProgressResult {
  assistantMessageId: string | null;
  bestStreamedReply: string;
}

export interface AIStructuredResponse {
  reply?: string;
  actions?: AIAction[];
}

export interface AIDerivedResponse {
  parsed: AIStructuredResponse;
  parsedReply: string;
  effectiveActions: AIAction[];
  reply: string;
  weakReplyPatterns: RegExp[];
}

export interface AIAppliedResult {
  appliedLabels?: string[];
  createdItems?: unknown[];
  blockedLabels?: string[];
  blockedReason?: string;
  failureKind?: string;
  failureStage?: string;
  failureCode?: string;
  failureMessage?: string;
  needsConfirmation?: boolean;
  morphActionExecutionFailed?: boolean;
  performedTransactionUndo?: boolean;
  transactionCommitted?: boolean;
  status?: string;
  type?: string;
  actionExecutionTrace?: Array<{
    type?: string;
    status?: string;
    verifierStatus?: string;
    message?: string;
    requestId?: string;
    entity?: string;
    entityId?: string;
    targetDate?: string;
    transactionId?: string;
    transactionCommitted?: boolean;
  }>;
  transactionId?: string;
  [key: string]: unknown;
}

export interface AIFinalizeReplyInput {
  reply: string;
  safeAttachments: AIChatAttachment[];
  webCitations: WebCitation[];
  promptQuestion: string;
  snapshot: AIWorkspaceSnapshot;
  effectiveActions: AIAction[];
  applied?: AIAppliedResult;
  weakReplyPatterns?: RegExp[];
}

export interface AIFinalizedResponse {
  reply: string;
  appliedLabels: string[];
}

export interface AIRouteTrace {
  route: string;
  capability: string;
  semanticFamily?: string;
  decisionSource?: string;
  candidateFamilies?: string[];
  blockedReason?: string;
  status?: string;
  path?: string;
  provider?: string;
  latencyMode?: string;
  timing?: AITimingTrace | null;
}

export interface AIAssistantMessageMeta {
  actions: string[];
  createdItems: unknown[];
  actionTypes?: string[];
  skillIds?: string[];
  skillLabels?: string[];
  primarySkillId?: string | null;
  primarySkillLabel?: string | null;
  transactionId?: string | null;
  receiptSummary?: string;
  undoHint?: string;
  citations: WebCitation[];
  citationChains: string[];
  routeTrace?: AIRouteTrace | null;
  timingTrace?: AITimingTrace | null;
}

export interface AIChatMessageMeta {
  attachments?: AIChatAttachmentPreviewItem[];
  actions?: string[];
  createdItems?: unknown[];
  actionTypes?: string[];
  skillIds?: string[];
  skillLabels?: string[];
  primarySkillId?: string | null;
  primarySkillLabel?: string | null;
  transactionId?: string | null;
  receiptSummary?: string;
  undoHint?: string;
  citations?: WebCitation[];
  citationChains?: string[];
  routeTrace?: AIRouteTrace | null;
  timingTrace?: AITimingTrace | null;
}

export interface AIChatMessageUpdate {
  content?: string;
  meta?: AIChatMessageMeta | null;
}

export interface AIChatPersistOptions {
  syncData?: boolean;
  flushNow?: boolean;
  forceScroll?: boolean;
  skipRender?: boolean;
}

export interface AIChatInputRef {
  id?: string;
  value?: string;
  focus?: () => void;
  setSelectionRange?: (selectionStart: number, selectionEnd: number, selectionDirection?: "forward" | "backward" | "none") => void;
}

export interface AIChatSendContext {
  input?: AIChatInputRef | null;
  question: string;
  attachments: AIChatAttachment[];
  onboardingRequested: boolean;
  webSearchRequested: boolean;
  finalQuestion: string;
}

export interface AIChatPreExecutionResult {
  handled: boolean;
  ok?: boolean;
  [key: string]: unknown;
}

export interface AIChatControllerState {
  pendingOnboardingIntent?: boolean;
  pendingWebSearchIntent?: boolean;
  isOnboardingActive?: boolean;
  currentTab?: string;
  mobileComposeActive?: boolean;
}

export type FrontendAIPermission =
  | PermissionKey
  | "ai.chat.send"
  | "ai.chat.attachments"
  | "ai.chat.onboarding"
  | "ai.runtime.inspect";

declare global {
  interface Window {
    MorphAIOrchestrationModules?: {
      create: (deps: any) => any;
    };
    MorphAIPromptBuilderModules?: {
      create: (deps: any) => any;
    };
    MorphAIResponseHandlerModules?: {
      create: (deps: any) => any;
    };
    MorphAIChatControllerModules?: {
      create: (deps: any) => any;
    };
    MorphAIActionSkillRuntime?: {
      create?: (deps?: any) => any;
      [key: string]: any;
    };
  }
}

export {};
