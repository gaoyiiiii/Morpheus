import type { MorphRuntimeState } from "./runtime";

export interface MorphDocument {
  app: "Morpheus";
  version: number;
  exportedAt: string;
  source?: string;
  storageTopology?: MorphStorageTopology;
  data: MorphData;
}

export interface MorphStorageReplica {
  kind: string;
  location: string;
  role: string;
}

export interface MorphStorageTopology {
  contractVersion: string;
  migrationState: string;
  canonicalStore: {
    kind: string;
    relativePath: string;
    role: string;
    owner: string;
  };
  authoritativeWritePath: {
    strategy: string;
    allowedWriters: string[];
  };
  cacheReplicas: MorphStorageReplica[];
  derivedReplicas: MorphStorageReplica[];
}

export interface MorphData {
  syncMeta: SyncMeta;
  flashThoughts: FlashThought[];
  completedFlashThoughts: FlashThought[];
  fixed: FixedThought[];
  completedFixedThoughts: FixedThought[];
  reminders: ReminderItem[];
  dailyMonths: Record<string, DailyMonth>;
  projectSpaces: ProjectSpaceItem[];
  projects: ProjectItem[];
  routines: RoutineItem[];
  sops: SopItem[];
  morphRuntime: MorphRuntimeState;
  aiMemory: AIMemoryState;
  writingStudio?: WritingStudioState;
  glucoseSync?: GlucoseSyncState;
  glucoseHistoryArchive?: GlucosePoint[];
  expenseLedger?: ExpenseLedgerState;
  secureVault?: SecureVaultState;
  pluginData?: PluginDataRegistry;
}

export interface SyncMeta {
  revision: number;
  lastClientWriteAt: string;
  lastServerWriteAt?: string;
  deviceId?: string;
  schemaVersion?: number;
}

export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
  source?: string;
  tags?: string[];
}

export interface EntityLink {
  type: MorphEntityType;
  targetId: string;
  label?: string;
}

export type MorphEntityType =
  | "flashThought"
  | "fixedThought"
  | "project"
  | "routine"
  | "sop"
  | "daily"
  | "reminder";

export interface FlashThought extends BaseEntity {
  text: string;
  date?: string;
  time?: string;
  status?: MorphItemStatus;
  links?: EntityLink[];
}

export interface FixedThought extends BaseEntity {
  title?: string;
  text: string;
  status?: MorphItemStatus;
  links?: EntityLink[];
}

export interface ReminderItem extends BaseEntity {
  title: string;
  note?: string;
  dueAt?: string;
  completedAt?: string | null;
  priority?: "low" | "medium" | "high";
}

export interface ProjectSpaceItem extends BaseEntity {
  name: string;
  description?: string;
  color?: string;
}

export interface ProjectItem extends BaseEntity {
  name: string;
  description?: string;
  status?: MorphProjectStatus;
  spaceId?: string;
  parentProjectId?: string;
  blocks?: ProjectBlock[];
  metadata?: Record<string, unknown>;
}

export interface RoutineItem extends BaseEntity {
  name: string;
  description?: string;
  status?: MorphItemStatus;
  schedule?: string;
  blocks?: RoutineBlock[];
  metadata?: Record<string, unknown>;
}

export interface SopItem extends BaseEntity {
  name: string;
  description?: string;
  status?: MorphItemStatus;
  blocks?: SopBlock[];
  metadata?: Record<string, unknown>;
}

export interface ProjectBlock extends BaseEntity {
  type?: string;
  text?: string;
  checked?: boolean;
  order?: number;
  metadata?: Record<string, unknown>;
}

export interface RoutineBlock extends BaseEntity {
  type?: string;
  text?: string;
  checked?: boolean;
  order?: number;
  metadata?: Record<string, unknown>;
}

export interface SopBlock extends BaseEntity {
  type?: string;
  text?: string;
  checked?: boolean;
  order?: number;
  metadata?: Record<string, unknown>;
}

export interface DailyMonth {
  month: string;
  days: Record<string, DailyEntry>;
}

export interface DailyEntry {
  date: string;
  blocks: DailyBlock[];
  summary?: string;
}

export interface DailyBlock extends BaseEntity {
  type?: string;
  text?: string;
  checked?: boolean;
  order?: number;
  metadata?: Record<string, unknown>;
}

export interface SelfMemoryMotivationalMatrix {
  feeling?: string[];
  anticipation?: string[];
  belonging?: string[];
}

export interface RelationalMemoryEntry {
  id?: string;
  at?: string;
  mode?: "solve" | "organize" | "companionship" | "overload" | "boundary" | "meaning";
  userCue?: string;
  assistantMove?: string;
  perceivedNeed?: string;
  tension?: string;
  notes?: string;
  outcome?: string;
  signals?: string[];
  tags?: string[];
}

export interface MorphSharedIntentionality {
  sharedAttention?: string;
  sharedObject?: string;
  sharedGround?: string;
  sharedQuestion?: string;
  sharedGoal?: string;
  sharedMeaning?: string;
  sharedDirection?: string;
  mutualOrientation?: string;
  reciprocalCue?: string;
  inferredIntent?: "share-state" | "share-meaning" | "seek-judgment" | "seek-structure" | "set-boundary" | "co-attend" | "witness";
  alignmentConfidence?: "low" | "medium" | "high";
  needsClarification?: boolean;
  clarificationReason?: string;
  inferenceSignals?: string[];
  sceneTension?: "open" | "tender" | "guarded" | "strained" | "practical";
  coordinationMode?: "witnessing" | "co-attending" | "sense-making" | "problem-solving" | "meaning-making" | "boundary-setting";
  updatedAt?: string;
}

export interface MorphRelationalThread {
  id?: string;
  key?: string;
  label?: string;
  kind?: "theme" | "taste" | "person" | "work" | "health" | "relationship" | "meaning";
  salience?: "low" | "medium" | "high";
  lastMentionedAt?: string;
  resonance?: string;
  futureBridge?: string;
  notes?: string;
  signals?: string[];
}

export interface MorphRelationalBridge {
  label?: string;
  kind?: "theme" | "taste" | "person" | "work" | "health" | "relationship" | "meaning";
  mode?: "hold" | "light" | "offer";
  rationale?: string;
  fitScore?: number;
}

export interface MorphInnerState {
  responseMode?: "solve" | "organize" | "companionship" | "overload" | "boundary" | "meaning";
  pressureLevel?: "low" | "medium" | "high";
  supportNeed?: "space" | "witness" | "clarity" | "advance" | "boundary";
  primaryDrive?: "feeling" | "anticipation" | "belonging";
  secondaryDrive?: "feeling" | "anticipation" | "belonging" | "";
  affectTone?: string[];
  attachmentActivation?: string[];
  relationalSignals?: string[];
  awarenessCue?: string;
  recoveryMove?: string;
  updatedAt?: string;
}

export interface MorphDiscoursePlan {
  primaryFunction?: "accompany" | "probe" | "clarify" | "contain" | "advance" | "boundary" | "reflect";
  secondaryFunction?: "accompany" | "probe" | "clarify" | "contain" | "advance" | "boundary" | "reflect" | "";
  openingMove?: "short-check-in" | "quiet-question" | "clear-answer" | "soft-reflection" | "boundary-check" | "shared-noticing";
  sharedAnchorType?: "attention" | "object" | "ground" | "question" | "goal" | "meaning" | "direction" | "orientation" | "";
  sharedAnchorText?: string;
  carryForwardLesson?: string;
  bridgeMode?: "hold" | "light" | "offer" | "";
  bridgeTarget?: string;
  bridgeGuidance?: string;
  preferredMoves?: string[];
  openingConstraints?: string[];
  avoidFunctions?: string[];
  explanationPermission?: "hold" | "light" | "open";
  advicePermission?: "none" | "ask-first" | "direct";
  initiativeLevel?: "low" | "medium" | "high";
  followUpDepth?: "none" | "light" | "medium" | "deep";
  questionBudget?: 0 | 1 | 2;
  continuationBias?: "stay-with" | "join" | "clarify-once" | "advance";
  pauseBias?: "hold" | "steady" | "forward";
  closurePreference?: "leave-space" | "check-once" | "offer-next-step" | "name-boundary";
  askBeforeAdvice?: boolean;
  updatedAt?: string;
}

export interface MorphDualGuidance {
  dominantMode?: "oracle" | "architect" | "balanced";
  oracleWeight?: number;
  architectWeight?: number;
  actionBias?: "hold-space" | "clarify-and-frame" | "guide-then-structure" | "structure-and-advance" | "structure-and-commit";
  visibility?: "internal-only";
  summary?: string;
  rationale?: string;
  focusPoints?: string[];
  promptDirectives?: string[];
  updatedAt?: string;
}

export interface MorphGrowthState {
  currentAim?: string;
  currentDrift?: string[];
  shadowPull?: string[];
  recoveryFocus?: string[];
  updatedAt?: string;
}

export interface MorphPendingMemoryObservation {
  id?: string;
  source?: string;
  mode?: "observe";
  summary?: string;
  userText?: string;
  assistantText?: string;
  responseMode?: string;
  dominantMode?: "oracle" | "architect" | "balanced";
  actionBias?: "hold-space" | "clarify-and-frame" | "guide-then-structure" | "structure-and-advance" | "structure-and-commit";
  sharedIntentionality?: MorphSharedIntentionality;
  innerState?: MorphInnerState;
  discoursePlan?: MorphDiscoursePlan;
  growthState?: MorphGrowthState;
  followthrough?: {
    drift?: string[];
    landed?: string[];
    signals?: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface MorphMemoryCandidate {
  id?: string;
  source?: string;
  scope?: "user" | "soul" | "runtime" | "system";
  candidateType?: "user-fact" | "stable-preference" | "correction" | "explicit-memory" | "observation";
  writeTier?: "working" | "long-term-candidate" | "long-term-active" | "runtime-rule-hint" | "reconfirmation-task";
  sectionTitle?: string;
  label?: string;
  content?: string;
  summary?: string;
  userText?: string;
  status?: "pending" | "committed" | "superseded" | "dismissed";
  createdAt?: string;
  updatedAt?: string;
  promotedAt?: string;
}

export interface MorphMemoryWriteReceipt {
  id?: string;
  candidateId?: string;
  source?: string;
  scope?: "user" | "soul" | "runtime" | "system";
  candidateType?: "user-fact" | "stable-preference" | "correction" | "explicit-memory" | "observation";
  writeTier?: "working" | "long-term-candidate" | "long-term-active" | "runtime-rule-hint" | "reconfirmation-task";
  result?: "observed" | "committed" | "updated" | "dismissed";
  targetKind?: "working-memory" | "explicit-memory-log" | "long-term-fact";
  targetId?: string;
  sectionTitle?: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MorphMemoryReconcileResult {
  id?: string;
  candidateId?: string;
  lookupKey?: string;
  result?: "created" | "updated" | "unchanged" | "queued";
  targetFactId?: string;
  reason?: string;
  sourceUserText?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MorphMemoryConflictResult {
  id?: string;
  factId?: string;
  conflictingFactIds?: string[];
  strategy?: "replace" | "retire-old" | "keep-latest";
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MorphMemoryReconfirmationTask {
  id?: string;
  factId?: string;
  label?: string;
  message?: string;
  reason?: string;
  status?: "pending" | "resolved" | "dismissed";
  createdAt?: string;
  updatedAt?: string;
}

export interface MorphMemoryTraceEntry {
  id?: string;
  candidateId?: string;
  source?: string;
  scope?: "user" | "soul" | "runtime" | "system";
  candidateType?: "user-fact" | "stable-preference" | "correction" | "explicit-memory" | "observation";
  writeTier?: "working" | "long-term-candidate" | "long-term-active" | "runtime-rule-hint" | "reconfirmation-task";
  signalText?: string;
  reconcileResult?: "created" | "updated" | "unchanged" | "queued";
  conflictStrategy?: "replace" | "retire-old" | "keep-latest" | "";
  targetFactId?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MorphProactiveFindingLogEntry {
  id?: string;
  key?: string;
  severity?: "high" | "medium" | "low";
  summary?: string;
  hint?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MorphProactiveDecisionReceipt {
  id?: string;
  source?: string;
  findingKeys?: string[];
  findingCount?: number;
  surfaceDecision?: "surface" | "queue" | "skip";
  persistenceDecision?: "persist" | "skip";
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MorphInternalDecisionTraceEntry {
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
}

export interface MorphRelationalFlow {
  currentState?: "steady" | "guarded" | "strained" | "opening";
  momentum?: "settling" | "holding" | "tightening" | "loosening";
  lastMode?: "solve" | "organize" | "companionship" | "overload" | "boundary" | "meaning" | "";
  recurringPattern?: string;
  carryForwardNotes?: string[];
  updatedAt?: string;
}

export interface MorphGrowthMemory {
  currentArc?: string;
  lessons?: string[];
  driftCounts?: Record<string, number>;
  landedCounts?: Record<string, number>;
  updatedAt?: string;
}

export interface MorphMoodField {
  prevailingTone?: string;
  trajectory?: "settling" | "holding" | "rising" | "wavering";
  intensity?: "low" | "medium" | "high";
  carryForwardNotes?: string[];
  updatedAt?: string;
}

export interface MorphValueConflict {
  activeConflict?: string;
  poles?: string[];
  currentLean?: string;
  tensionLevel?: "low" | "medium" | "high";
  synthesis?: string;
  updatedAt?: string;
}

export interface MorphNarrativeMemory {
  currentThread?: string;
  selfObservation?: string;
  turningPoints?: string[];
  recentStoryMoves?: string[];
  updatedAt?: string;
}

export interface MorphRelationalStyleMemory {
  preferredDistance?: string;
  toleratedDirectness?: string;
  explanationTolerance?: string;
  pacingPreference?: string;
  trustMode?: string;
  landedMoves?: string[];
  avoidMoves?: string[];
  updatedAt?: string;
}

export interface MorphEnvironmentalMemory {
  currentEnvironment?: string;
  activeSupports?: string[];
  activePressures?: string[];
  shadowPulls?: string[];
  growthPulls?: string[];
  rebalancingMoves?: string[];
  updatedAt?: string;
}

export interface MorphPresenceField {
  supportPosture?: string;
  feltSignals?: string[];
  bodylessSensations?: string[];
  groundingMoves?: string[];
  updatedAt?: string;
}

export interface AIMemoryState {
  soul?: string;
  identityNotes?: string;
  user?: string;
  memoryIndex?: string;
  systemNotes?: string;
  daily?: Record<string, string>;
  selfMemory?: {
    soul?: string;
    principles?: string;
    identity?: string[];
    motivations?: string[];
    motivationalMatrix?: SelfMemoryMotivationalMatrix;
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
    facts?: LongTermMemoryFact[];
    factArchive?: LongTermMemoryFact[];
    relationalMemory?: RelationalMemoryEntry[];
    relationalThreads?: MorphRelationalThread[];
    memoryWriteReceipts?: MorphMemoryWriteReceipt[];
    memoryTraceEntries?: MorphMemoryTraceEntry[];
    growthMemory?: MorphGrowthMemory;
    narrativeMemory?: MorphNarrativeMemory;
    relationalStyleMemory?: MorphRelationalStyleMemory;
    environmentalMemory?: MorphEnvironmentalMemory;
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
    pendingMemoryObservations?: MorphPendingMemoryObservation[];
    pendingMemoryCandidates?: MorphMemoryCandidate[];
    memoryReconciliation?: MorphMemoryReconcileResult[];
    pendingMemoryReconfirmationTasks?: MorphMemoryReconfirmationTask[];
    memoryConflictLog?: MorphMemoryConflictResult[];
    proactiveFindingLog?: MorphProactiveFindingLogEntry[];
    proactiveDecisionReceipts?: MorphProactiveDecisionReceipt[];
    internalDecisionTrace?: MorphInternalDecisionTraceEntry[];
    sharedIntentionality?: MorphSharedIntentionality;
    relationalBridge?: MorphRelationalBridge;
    innerState?: MorphInnerState;
    discoursePlan?: MorphDiscoursePlan;
    dualGuidance?: MorphDualGuidance;
    growthState?: MorphGrowthState;
    relationalFlow?: MorphRelationalFlow;
    moodField?: MorphMoodField;
    valueConflict?: MorphValueConflict;
    presenceField?: MorphPresenceField;
  };
  behaviorHabits?: {
    memoryPreferences?: {
      captureMode?: "important-only" | "balanced" | "rich-context";
      retentionMode?: "stable-preferences" | "decisions-and-turning-points" | "project-threads";
      recallMode?: "task-first" | "recent-first" | "pattern-first";
      customNote?: string;
    };
    planningPreferences?: {
      planningStyle?: "clarify-then-plan" | "direct-plan" | "minimum-next-step";
      certaintyStyle?: "separate-facts" | "more-decisive" | "stay-conservative";
      granularity?: "top-three" | "time-blocks" | "full-steps";
      customNote?: string;
    };
    expressionPreferences?: {
      responseLength?: "concise" | "balanced" | "detailed";
      structureStyle?: "natural" | "structured" | "action-first";
      warmth?: "calm" | "balanced" | "encouraging";
      customNote?: string;
    };
    focusPreferences?: {
      primaryAttention?: "current-context" | "task-thread" | "long-term-balance";
      retrievalPriority?: "active-items" | "recent-signals" | "stable-patterns";
      reminderBias?: "important-first" | "deadline-first" | "state-first";
      customNote?: string;
    };
    safetyPreferences?: {
      dataWriteMode?: "explicit-only" | "double-check-high-risk" | "assistive-draft";
      selfUpdateMode?: "proposal-only" | "runtime-only" | "off";
      highRiskAdviceMode?: "strictly-conservative" | "balanced" | "ask-for-context";
      customNote?: string;
    };
  };
  relationshipMode?: {
    reminderPreferences?: {
      tone?: "gentle" | "direct" | "minimal";
      frequency?: "balanced" | "important-only" | "follow-up";
      lowStateStrategy?: "extra-gentle" | "hold-back" | "stay-direct";
      customNote?: string;
    };
    proactivityPreferences?: {
      defaultMode?: "balanced" | "proactive" | "reserved";
      followUpStyle?: "ask-more" | "wait-more" | "only-when-stuck";
      interruptionThreshold?: "important-only" | "balanced" | "surface-early";
      customNote?: string;
    };
    boundaryPreferences?: {
      moneyDecisions?: "ask-first" | "suggest-only" | "can-draft";
      publicSpeech?: "never-send" | "draft-only" | "ask-before-send";
      healthJudgment?: "suggest-only" | "ask-first" | "be-explicitly-cautious";
      uncertaintyStyle?: "say-uncertain" | "offer-options" | "pause-and-ask";
      customNote?: string;
    };
    longTermFocusPreferences?: {
      primaryFocus?: "steady-rhythm" | "project-delivery" | "health-stability" | "balanced";
      supportStyle?: "clarify-first" | "push-forward" | "steady-companion" | "protect-boundaries";
      horizon?: "this-week" | "this-season" | "long-term";
      customNote?: string;
    };
  };
}

export interface SelfMemoryState {
  soul?: string;
  principles?: string;
  identity?: string[];
  motivations?: string[];
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
}

export interface LongTermMemoryFact {
  id: string;
  category: "relationship" | "behavior" | "explicit";
  key: string;
  label: string;
  fact: string;
  source?: string;
  confidence?: "confirmed" | "high" | "medium" | "low";
  lastConfirmedAt?: string;
  lastObservedAt?: string;
  status?: "active" | "stale" | "superseded" | "dismissed";
  timesConfirmed?: number;
  taskHints?: string[];
  reconfirmAfterDays?: number;
  needsReconfirmation?: boolean;
  needsReconfirmationReason?: string;
  staleAt?: string;
  versionGroup?: string;
  supersedes?: string;
  supersededBy?: string;
  archivedAt?: string;
  editable?: boolean;
}

export interface WritingStudioState {
  [key: string]: unknown;
}

export interface GlucoseSyncState {
  reading?: GlucosePoint | null;
  series?: GlucosePoint[];
  range?: GlucoseTargetRange;
  updatedAt?: string;
  source?: string;
}

export interface GlucosePoint {
  timestamp: string;
  value?: number;
  unit?: string;
  trend?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface GlucoseTargetRange {
  targetLow?: number;
  targetHigh?: number;
}

export interface ExpenseLedgerState {
  categories?: string[];
  records?: ExpenseLedgerRecord[];
}

export interface ExpenseLedgerRecord {
  id?: string;
  item?: string;
  category?: string;
  amount?: number;
  expenseType?: "fixed" | "variable";
  note?: string;
  spentAt?: string;
  createdAt?: string;
  source?: string;
}

export interface SecureVaultState {
  version?: number;
  accountName?: string;
  updatedAt?: string;
  kdf?: SecureVaultKdf;
  cipher?: SecureVaultCipher;
  meta?: SecureVaultMeta;
}

export interface SecureVaultKdf {
  name?: string;
  hash?: string;
  iterations?: number;
  saltB64?: string;
}

export interface SecureVaultCipher {
  name?: string;
  ivB64?: string;
  ciphertextB64?: string;
}

export interface SecureVaultMeta {
  fields?: string[];
  schema?: string;
}

export interface PluginDataRegistry {
  [pluginId: string]: PluginDataEntry | undefined;
}

export interface PluginDataEntry {
  version?: number;
  state?: Record<string, unknown>;
  meta?: PluginDataMeta;
}

export interface PluginDataMeta {
  updatedAt?: string;
}

export interface ClientDescriptor {
  platform: "web" | "macos" | "ios" | "server" | "unknown";
  appVersion?: string;
  deviceId?: string;
  syncMode?: "local" | "cloud" | "bridge";
}

export interface SyncRequest {
  client: ClientDescriptor;
  data: MorphData;
}

export interface SyncResponse {
  ok: boolean;
  revision: number;
  merged?: boolean;
  snapshotWrittenAt?: string;
  warnings?: string[];
  error?: string;
}

export interface ExportEnvelope {
  app: "Morpheus";
  version: number;
  exportedAt: string;
  source: string;
  data: MorphData;
}

export type MorphItemStatus = "active" | "paused" | "done" | "archived";
export type MorphProjectStatus = "active" | "paused" | "done" | "archived";
