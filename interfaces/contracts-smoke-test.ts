import skillCatalog from "../skills/manifest.json";
import extensionCatalog from "../extensions/manifest.json";
import runtimeSkills from "../morph-runtime/skills.json";
import contextRules from "../morph-runtime/context-rules.json";

import type { ExtensionCatalogManifest, SkillCatalogManifest } from "./extensions";
import type {
  AIAssistantMessageMeta,
  AIChatSendContext,
  AIExecutionContext,
  MainAIPromptInput,
} from "./frontend-ai";
import type { SettingsState } from "./frontend-settings";
import type { ContextRulesFile, RuntimeSkillDefaultsManifest } from "./runtime";
import type { WebSearchProviderRuntimeState } from "./web-search";

const validatedSkillCatalog = skillCatalog as SkillCatalogManifest;
const validatedExtensionCatalog = extensionCatalog as ExtensionCatalogManifest;
const validatedRuntimeSkills = runtimeSkills as RuntimeSkillDefaultsManifest;
const validatedContextRules = contextRules as ContextRulesFile;

const validatedAIExecutionContext: AIExecutionContext = {
  safeAttachments: [],
  attachmentContext: "",
  pluginPromptContexts: [],
  webSearchBundle: null,
  snapshot: { samples: {} },
  skillPromptContext: "",
  responseMode: { mode: "solve", reason: "默认按求解处理" },
  beijingNow: "",
  runtime: {
    skills: {},
    contextRules: {},
    memoryRules: "",
  },
  isRoleConflictQuery: false,
  allowMorphDataActions: false,
};

const validatedMainPromptInput: MainAIPromptInput = {
  promptQuestion: "今天的重点是什么？",
  snapshot: validatedAIExecutionContext.snapshot,
  runtime: validatedAIExecutionContext.runtime,
  responseMode: validatedAIExecutionContext.responseMode,
};

const validatedAssistantMeta: AIAssistantMessageMeta = {
  actions: [],
  createdItems: [],
  actionTypes: [],
  transactionId: "",
  citations: [],
  citationChains: [],
};

const validatedAIChatSendContext: AIChatSendContext = {
  input: { id: "desktop-detail-input", value: "继续" },
  question: "继续",
  attachments: [],
  onboardingRequested: false,
  webSearchRequested: false,
  finalQuestion: "继续",
};

const validatedSettingsState: SettingsState = {
  nativeBridge: false,
  syncRootPath: "",
  syncRootDeleteSafe: null,
  nativePlatform: "web",
  statusMessage: "",
  aiStatusMessage: "",
  aiStatusError: false,
  runtimeStatusMessage: "",
  runtimeStatusError: false,
  glucoseStatusMessage: "",
  glucoseStatusError: false,
  feishuStatusMessage: "",
  feishuStatusError: false,
  secureVaultStatusMessage: "",
  secureVaultStatusError: false,
  writingStudioStatusMessage: "",
  writingStudioStatusError: false,
  relationshipModeStatusMessage: "",
  relationshipModeStatusError: false,
  behaviorHabitStatusMessage: "",
  behaviorHabitStatusError: false,
  glucoseConfigLoaded: false,
  feishuConfigLoaded: false,
  agentStatusLoaded: false,
  agentStatus: null,
  glucoseConfig: {
    email: "",
    hasPassword: false,
    targetLow: 70,
    targetHigh: 180,
    region: "CN",
  },
  feishuConfig: {
    enabled: false,
    appId: "",
    hasAppSecret: false,
    verificationToken: "",
    hasEncryptKey: false,
    botName: "",
    callbackPath: "/api/feishu/webhook",
    eventCount: 0,
    lastMessageAt: "",
    lastEventType: "",
  },
};

const validatedWebSearchRuntimeState: WebSearchProviderRuntimeState = {
  selectedProviderId: "builtin-local-api",
  providers: [{ id: "builtin-local-api", name: "Builtin Local Search", kind: "builtin", enabled: true }],
};

export {
  validatedAIChatSendContext,
  validatedAIExecutionContext,
  validatedAssistantMeta,
  validatedContextRules,
  validatedExtensionCatalog,
  validatedMainPromptInput,
  validatedRuntimeSkills,
  validatedSkillCatalog,
  validatedSettingsState,
  validatedWebSearchRuntimeState,
};
