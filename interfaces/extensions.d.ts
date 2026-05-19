import type { PermissionKey } from "./tasks";

export interface CompatibilitySpec {
  minCoreVersion?: string;
  maxCoreVersion?: string;
  platforms?: Array<"web" | "macos" | "ios">;
}

export interface PluginManifest {
  kind: "plugin";
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  entry: string;
  compatibility: CompatibilitySpec;
  permissions: PermissionKey[];
  contributes?: PluginContributions;
}

export interface PluginContributions {
  commands?: PluginCommand[];
  views?: PluginView[];
  settings?: PluginSettingSection[];
  importers?: ExternalConnector[];
  exporters?: ExternalConnector[];
}

export interface PluginCommand {
  id: string;
  title: string;
  when?: string;
}

export interface PluginView {
  id: string;
  title: string;
  mount: "sidebar" | "panel" | "tab" | "detail";
}

export interface PluginSettingSection {
  id: string;
  title: string;
  description?: string;
}

export interface ExternalConnector {
  id: string;
  label: string;
  description?: string;
}

export interface OfficialExtensionManifest {
  id: string;
  kind: string;
  name: string;
  summary?: string;
  source?: "official" | "local" | "remote" | string;
  icon?: string;
  entry?: string;
  description?: string;
  category?: "integration" | "workspace" | "skill-pack" | "developer-tool" | string;
  owner?: "official" | "local-user" | "team" | "third-party" | string;
  tags?: string[];
  settingsTarget?: string;
  visibilityTargets?: string[];
  hostIntegration?: ExtensionHostIntegrationSpec;
  dataModel?: ExtensionDataModelSpec;
  defaultEnabled?: boolean;
  requiresConfiguration?: boolean;
  ui?: ExtensionUiSpec;
  requires?: ExtensionRequirementSpec;
  permissions?: ExtensionPermissionSpec[];
  commands?: ExtensionCommandSpec[];
}

export interface ExtensionHostEntrySpec {
  label: string;
  icon?: string;
  platforms?: ExtensionClientTarget[];
}

export interface ExtensionHostDrawerEntrySpec {
  drawerId: string;
  label?: string;
  icon?: string;
  platforms?: ExtensionClientTarget[];
}

export type ExtensionClientTarget = "desktop" | "mobile";

export interface ExtensionContextPanelSpec {
  id: string;
  target: "project-top" | "health-top" | "health-chart-bottom";
  label?: string;
  icon?: string;
  commandId?: string;
  platforms?: ExtensionClientTarget[];
}

export interface ExtensionChatShortcutSpec {
  id: string;
  label: string;
  icon?: string;
  target?: string;
  commandId?: string;
  platforms?: ExtensionClientTarget[];
}

export interface ExtensionSettingsSectionSpec {
  id: string;
  label: string;
  icon?: string;
  commandId?: string;
  platforms?: ExtensionClientTarget[];
}

export interface ExtensionWorkspaceHeaderActionSpec {
  id: string;
  label: string;
  icon?: string;
  commandId?: string;
  variant?: "ghost" | "pill" | string;
  platforms?: ExtensionClientTarget[];
}

export interface ExtensionCommandSpec {
  id: string;
  label: string;
  icon?: string;
  action?: "open-workspace" | "open-settings" | "open-drawer" | "switch-tab" | "custom" | string;
  target?: string;
  payload?: Record<string, unknown>;
  aiCallable?: boolean;
  executionTarget?: "host-action" | "plugin-runtime" | string;
  hostAction?: string;
  requiredPermission?: "read" | "append" | "update" | "archive" | "admin" | string;
  risk?: "low" | "medium" | "high" | string;
  confirmationRequired?: boolean;
  boundaryLevel?: "allowed" | "confirm-required" | "manual-only" | "system-only" | "disabled" | string;
}

export interface ExtensionHostIntegrationSpec {
  entryCommandId?: string;
  platforms?: ExtensionClientTarget[];
  aiContextProviderId?: string;
  sidebarEntry?: ExtensionHostEntrySpec;
  sidebarFooterEntry?: ExtensionHostEntrySpec;
  mobileMoreEntry?: ExtensionHostEntrySpec;
  drawerEntry?: ExtensionHostDrawerEntrySpec;
  contextPanels?: ExtensionContextPanelSpec[];
  chatShortcuts?: ExtensionChatShortcutSpec[];
  settingsSection?: ExtensionSettingsSectionSpec;
  workspaceHeaderActions?: ExtensionWorkspaceHeaderActionSpec[];
  createdItemTargets?: string[];
}

export interface ExtensionDataModelSpec {
  namespace?: string;
  state?: "root-pluginData" | "shared-domain" | "none" | string;
  stateKey?: string;
  history?: "file-backed" | "root-inline" | "none" | string;
  syncPolicy?: "inherit-root" | "local-only" | "device-only" | "vault" | string;
  sharedDomains?: string[];
}

export interface ExtensionUiSpec {
  detailMode?: "embedded" | "modal" | "external" | string;
  primaryAction?: "configure" | "open-workspace" | "open-drawer" | "connect" | string;
  workspaceShell?: ExtensionWorkspaceShellSpec;
}

export interface ExtensionWorkspaceShellSpec {
  eyebrow?: string;
  title?: string;
  englishTitle?: string;
  description?: string;
  backLabel?: string;
}

export interface ExtensionRequirementSpec {
  accounts?: string[];
  devices?: string[];
  runtimeCapabilities?: string[];
}

export interface ExtensionPermissionSpec {
  id: string;
  label?: string;
  required?: boolean;
  scope?: "data" | "network" | "ui" | "webhook" | "health" | string;
  aiReadable?: boolean;
}

export interface ExtensionCatalogManifest {
  version: number;
  updatedAt: string;
  extensions: OfficialExtensionManifest[];
}

export interface PromptSpec {
  system?: string;
  style?: "concise" | "balanced" | "detailed";
  constraints?: string[];
  refusalRules?: string[];
}

export interface TriggerSpec {
  keywords?: string[];
  negativeKeywords?: string[];
  intents?: string[];
  events?: Array<"manual" | "chat" | "schedule" | "data-change" | "webhook">;
}

export interface SkillPermissions {
  read: PermissionKey[];
  write: PermissionKey[];
  network?: boolean;
  backgroundRun?: boolean;
  userConfirmation?: "always" | "optional" | "never";
}

export interface SkillInputSpec {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "entity-ref" | "date";
  required?: boolean;
  description?: string;
}

export interface SkillOutputSpec {
  type: "text" | "structured" | "suggestion" | "mutation";
  description?: string;
}

export interface ToolRequirement {
  id: string;
  required?: boolean;
  mode?: "read" | "write" | "execute";
}

export interface ModelPolicy {
  preferred?: Array<"chat" | "embedding" | "speech" | "image">;
  allowBringYourOwnKey?: boolean;
  allowHostedModel?: boolean;
  minContextWindow?: number;
}

export interface CostProfile {
  estimatedTokens?: number;
  estimatedLatencyMs?: number;
  tier?: "low" | "medium" | "high";
}

export interface SkillManifest {
  kind: "skill";
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  entry?: string;
  promptSpec?: PromptSpec;
  triggers?: TriggerSpec;
  permissions: SkillPermissions;
  inputs?: SkillInputSpec[];
  outputs?: SkillOutputSpec[];
  tools?: ToolRequirement[];
  modelPolicy?: ModelPolicy;
  costProfile?: CostProfile;
  compatibility?: CompatibilitySpec;
}

export interface SkillCatalogManifest {
  version: number;
  updatedAt: string;
  skills: SkillCatalogItem[];
}

export interface SkillCatalogItem {
  id: string;
  name: string;
  path: string;
  description: string;
  triggers?: string[];
  negativeTriggers?: string[];
  tags?: string[];
}

export interface PluginCatalogManifest {
  version: number;
  updatedAt: string;
  plugins: PluginCatalogItem[];
}

export interface PluginCatalogItem {
  id: string;
  name: string;
  path: string;
  description: string;
  tags?: string[];
}
