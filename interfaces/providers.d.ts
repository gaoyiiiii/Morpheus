import type { PermissionKey, ToolInvocation } from "./tasks";

export interface ProviderHealth {
  ok: boolean;
  message?: string;
  checkedAt: string;
}

export interface UsageStats {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}

export interface BaseProvider {
  id: string;
  kind: "chat" | "embedding" | "rerank" | "speech" | "image";
  label: string;
  authMode: "byok" | "hosted" | "native";
  capabilities: string[];
  healthCheck?: () => Promise<ProviderHealth>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface ToolCallDefinition {
  id: string;
  label?: string;
  description?: string;
  permissions?: PermissionKey[];
  inputSchema?: Record<string, unknown>;
}

export interface ChatInvocation {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolCallDefinition[];
  metadata?: Record<string, unknown>;
}

export interface ChatResult {
  text: string;
  usage?: UsageStats;
  toolCalls?: ToolInvocation[];
  raw?: unknown;
}

export interface ChatProvider extends BaseProvider {
  kind: "chat";
  invoke(input: ChatInvocation): Promise<ChatResult>;
}

export interface EmbeddingInvocation {
  texts: string[];
  model?: string;
}

export interface EmbeddingResult {
  vectors: number[][];
  usage?: UsageStats;
}

export interface EmbeddingProvider extends BaseProvider {
  kind: "embedding";
  embed(input: EmbeddingInvocation): Promise<EmbeddingResult>;
}
