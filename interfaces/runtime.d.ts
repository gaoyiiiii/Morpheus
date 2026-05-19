export interface MorphRuntimeState {
  skills: RuntimeSkillSettings;
  contextRules: ContextRules;
  memoryRules?: string;
  lastUpdatedAt?: string;
  agentState?: ProactiveAgentState;
  userPreferences?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RuntimeSkillSettings {
  version?: number;
  selfUpgradeEnabled?: boolean;
  extraSystemPrompt?: string;
  disabledActions?: string[];
  proactiveAgent?: ProactiveAgentConfig;
  capabilities?: string[];
  writableScopes?: string[];
  notes?: string[];
}

export interface ContextRules {
  version?: number;
  maxCoreMemory?: number | null;
  maxWorkingContext?: number | null;
  maxRetrieved?: number | null;
  maxCitations?: number | null;
  currentTabBoost?: number | null;
  activeContextBoost?: number | null;
  selectedMonthBoost?: number | null;
  clusterExpansionLimit?: number | null;
  tokenSynonyms?: Record<string, string[]>;
}

export interface ProactiveAgentConfig {
  enabled?: boolean;
  heartbeatMinutes?: number;
  minNotifyGapMinutes?: number;
  maxFindingsPerScan?: number;
  soonReminderMinutes?: number;
  overdueReminderMinutes?: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  runWhenHidden?: boolean;
  autoPushToChat?: boolean;
  autoWriteMemory?: boolean;
}

export interface ProactiveAgentState {
  lastHeartbeatAt?: string;
  lastNotifiedAt?: string;
  issueCooldowns?: Record<string, number>;
  history?: ProactiveAgentHistoryItem[];
}

export interface ProactiveAgentHistoryItem {
  at: string;
  summary: string;
  source?: string;
}

export interface RuntimeSkillDefaultsManifest extends RuntimeSkillSettings {
  version: number;
}

export interface ContextRulesFile extends ContextRules {
  version: number;
}
