export interface WebSearchProviderManifest {
  id: string;
  name: string;
  kind?: "builtin" | "extension" | "custom";
  enabled?: boolean;
  description?: string;
}

export interface WebSearchProviderRequest {
  query: string;
  limit?: number;
}

export interface WebSearchProviderResult {
  title?: string;
  snippet?: string;
  url?: string;
}

export interface WebSearchProviderResponse {
  ok: boolean;
  providerId: string;
  results: WebSearchProviderResult[];
  error?: string;
}

export interface WebSearchProviderRuntimeState {
  selectedProviderId: string;
  providers: WebSearchProviderManifest[];
}
