export type PermissionKey =
  | "read:data:flashThoughts"
  | "read:data:fixed"
  | "read:data:projects"
  | "read:data:routines"
  | "read:data:sops"
  | "read:data:daily"
  | "read:data:reminders"
  | "read:memory:ai"
  | "write:data:flashThoughts"
  | "write:data:fixed"
  | "write:data:projects"
  | "write:data:routines"
  | "write:data:sops"
  | "write:data:daily"
  | "write:data:reminders"
  | "invoke:model:chat"
  | "invoke:model:embedding"
  | "invoke:model:speech"
  | "invoke:model:image"
  | "invoke:tool:local"
  | "invoke:tool:webhook"
  | "network:outbound"
  | "background:run"
  | "cloud:sync";

export type MorphActionPermissionLevel =
  | "read"
  | "append"
  | "update"
  | "archive"
  | "admin";

export type MorphActionConsentTier =
  | "oracle-safe"
  | "architect-required"
  | "explicit-consent-required"
  | "disabled";

export type MorphActionRiskLevel = "low" | "medium" | "high";

export interface MorphActionExecutionPolicy {
  action: string;
  domain: string;
  permissionLevel: MorphActionPermissionLevel;
  consentTier: MorphActionConsentTier;
  riskLevel: MorphActionRiskLevel;
  notes?: string;
}

export interface MorphActionPermissionGrant {
  level: MorphActionPermissionLevel;
  domains?: string[];
  actions?: string[];
  note?: string;
}

export interface MorphActionConfirmation {
  confirmed?: boolean;
  reason?: string;
  scope?: string;
  targetIds?: string[];
}

export interface MorphActionCandidate {
  action: string;
  actor: string;
  source: string;
  requestId: string;
  target?: string;
  entity?: string;
  riskLevel: MorphActionRiskLevel;
  confirmationLevel: MorphActionConsentTier;
}

export interface MorphActionNormalizationResult {
  ok: boolean;
  action: string;
  payload: Record<string, unknown>;
  normalizedFields?: string[];
  userMessage?: string;
}

export interface MorphActionBoundaryResult {
  ok: boolean;
  action: string;
  domain: string;
  permissionLevel: MorphActionPermissionLevel;
  consentTier: MorphActionConsentTier;
  riskLevel: MorphActionRiskLevel;
  reason?: string;
}

export interface MorphActionVerifierResult {
  ok: boolean;
  action: string;
  entity?: string;
  entityId?: string;
  status?: string;
  oldStatus?: string;
  newStatus?: string;
  targetDate?: string;
  updatedAt?: string;
  blockIds?: string[];
  userMessage?: string;
}

export interface MorphActionReceipt {
  ok: boolean;
  action: string;
  receiptSummary: string;
  verifierStatus: "verified" | "failed" | "not_run";
  entity?: string;
  entityId?: string;
  status?: string;
  oldStatus?: string;
  newStatus?: string;
  targetDate?: string;
  updatedAt?: string;
  undoAvailable?: boolean;
  transactionHandle?: string;
  blockIds?: string[];
}

export interface MorphActionTraceEntry {
  type: string;
  status: string;
  message?: string;
  verifierStatus?: "verified" | "failed" | "not_run";
  requestId?: string;
  entity?: string;
  entityId?: string;
  targetDate?: string;
  candidate?: MorphActionCandidate;
  normalizedPayload?: Record<string, unknown>;
  boundary?: MorphActionBoundaryResult;
  verifier?: MorphActionVerifierResult;
  receipt?: MorphActionReceipt;
}

export interface ToolDefinition {
  id: string;
  label: string;
  description?: string;
  mode: "read" | "write" | "execute";
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  permissions?: PermissionKey[];
}

export interface ToolInvocation {
  toolId: string;
  input?: unknown;
  output?: unknown;
  status?: "requested" | "running" | "completed" | "failed";
}

export interface SkillTask {
  id: string;
  skillId: string;
  trigger: "manual" | "chat" | "schedule" | "data-change" | "webhook";
  status: SkillTaskStatus;
  input: Record<string, unknown>;
  output?: SkillTaskOutput;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  initiatedBy?: string;
}

export interface SkillTaskOutput {
  mode: "text" | "structured" | "suggestion" | "mutation";
  summary?: string;
  payload?: unknown;
  requiresConfirmation?: boolean;
}

export type SkillTaskStatus =
  | "queued"
  | "running"
  | "waiting-confirmation"
  | "completed"
  | "failed"
  | "cancelled";
