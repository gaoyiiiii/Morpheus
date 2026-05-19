import { Type } from "./schema-lite.mjs";

const PLUGIN_ID = "custom-morph-connector";

function getPluginConfig(api) {
  const pluginEntry = api?.config?.plugins?.entries?.[PLUGIN_ID];
  const pluginConfig = pluginEntry && typeof pluginEntry.config === "object" ? pluginEntry.config : {};
  return {
    baseUrl: String(pluginConfig.baseUrl || "").trim().replace(/\/+$/g, ""),
    defaultActor: String(pluginConfig.defaultActor || "openclaw").trim() || "openclaw",
    defaultSource: String(pluginConfig.defaultSource || "skill:custom-morph-connector").trim() || "skill:custom-morph-connector",
  };
}

async function requestMorphJson(api, pathname, options = {}) {
  const cfg = getPluginConfig(api);
  if (!cfg.baseUrl) throw new Error("missing baseUrl");
  const response = await fetch(`${cfg.baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
  return payload;
}

function textResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export default function registerTemplateConnector(api) {
  api.registerTool({
    name: "custom_morph_summary",
    description: "Read Morpheus summary through /api/morph/summary.",
    parameters: Type.Object({}),
    async execute() {
      return textResult(await requestMorphJson(api, "/api/morph/summary"));
    },
  });

  api.registerTool(
    {
      name: "custom_morph_create_project",
      description: "Create a Morpheus project through /api/morph/actions/create_project.",
      parameters: Type.Object({
        name: Type.String({ minLength: 1 }),
        description: Type.Optional(Type.String()),
      }),
      async execute(_id, params) {
        const cfg = getPluginConfig(api);
        return textResult(await requestMorphJson(api, "/api/morph/actions/create_project", {
          method: "POST",
          body: {
            actor: cfg.defaultActor,
            source: cfg.defaultSource,
            requestId: `custom-create-project-${Date.now()}`,
            permissions: ["append"],
            payload: {
              name: params.name,
              description: params.description || "",
            },
          },
        }));
      },
    },
    { optional: true }
  );
}
