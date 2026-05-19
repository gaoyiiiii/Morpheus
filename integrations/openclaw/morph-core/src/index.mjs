import { Type } from "./schema-lite.mjs";

const PLUGIN_ID = "morph-core";

function getPluginConfig(api) {
  const pluginEntry = api?.config?.plugins?.entries?.[PLUGIN_ID];
  const pluginConfig = pluginEntry && typeof pluginEntry.config === "object" ? pluginEntry.config : {};
  return {
    baseUrl: String(pluginConfig.baseUrl || "").trim().replace(/\/+$/g, ""),
    defaultActor: String(pluginConfig.defaultActor || "openclaw").trim() || "openclaw",
    defaultSource: String(pluginConfig.defaultSource || "skill:morph-core").trim() || "skill:morph-core",
    timeoutMs: Number.isFinite(Number(pluginConfig.timeoutMs)) ? Number(pluginConfig.timeoutMs) : 8000,
  };
}

function createMorphConnectorError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function normalizeMorphRequestError(error, context = {}) {
  const actionName = String(context.actionName || "").trim();
  const pathname = String(context.pathname || "").trim();
  const prefix = actionName ? `Morpheus action "${actionName}" failed` : `Morpheus request failed for ${pathname || "unknown path"}`;

  if (error && error.code === "morph_core_missing_base_url") {
    return createMorphConnectorError(
      "morph_core_missing_base_url",
      'Morpheus connector is missing `plugins.entries.morph-core.config.baseUrl`. Set it to your local Morpheus server, for example `http://127.0.0.1:2199`.',
      { pathname, actionName }
    );
  }

  if (error && error.code === "insufficient_permission") {
    const requiredPermission = String(error.details?.requiredPermission || "").trim() || "the required";
    return createMorphConnectorError(
      "insufficient_permission",
      `${prefix}: the server requires "${requiredPermission}" permission for this action.`,
      { pathname, actionName, ...error.details }
    );
  }

  if (error && error.code === "high_risk_action_disabled") {
    return createMorphConnectorError(
      "high_risk_action_disabled",
      `${prefix}: this action is intentionally disabled on the Morpheus side because it is marked high-risk.`,
      { pathname, actionName, ...error.details }
    );
  }

  if (error && error.code === "confirmation_required") {
    return createMorphConnectorError(
      "confirmation_required",
      `${prefix}: the server requires explicit confirmation before executing this action.`,
      { pathname, actionName, ...error.details }
    );
  }

  if (error && error.code === "unknown_action") {
    return createMorphConnectorError(
      "unknown_action",
      `${prefix}: this action is not exposed by the current Morpheus server. Check \`morph_capabilities\` first.`,
      { pathname, actionName, ...error.details }
    );
  }

  if (error && error.code === "entity_not_found") {
    return createMorphConnectorError(
      "entity_not_found",
      `${prefix}: the target entity was not found in Morpheus.`,
      { pathname, actionName, ...error.details }
    );
  }

  if (error && error.name === "AbortError") {
    return createMorphConnectorError(
      "morph_request_timeout",
      `${prefix}: request timed out. Check whether the local Morpheus server is running and reachable.`,
      { pathname, actionName }
    );
  }

  const message = String(error && error.message ? error.message : "");
  if (message && /fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)) {
    return createMorphConnectorError(
      "morph_server_unreachable",
      `${prefix}: could not reach the local Morpheus server. Check \`baseUrl\`, start Morpheus, or run \`morph_diagnose_connection\`.`,
      { pathname, actionName }
    );
  }

  return createMorphConnectorError(
    String(error && error.code ? error.code : "morph_request_failed"),
    `${prefix}: ${message || "unknown error"}`,
    { pathname, actionName }
  );
}

async function requestMorphJson(api, pathname, options = {}) {
  const cfg = getPluginConfig(api);
  if (!cfg.baseUrl) {
    throw createMorphConnectorError(
      "morph_core_missing_base_url",
      'Morpheus connector is missing `plugins.entries.morph-core.config.baseUrl`. Set it to your local Morpheus server, for example `http://127.0.0.1:2199`.',
      { pathname }
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, cfg.timeoutMs));
  try {
    const response = await fetch(`${cfg.baseUrl}${pathname}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = payload && typeof payload.errorCode === "string"
        ? payload.errorCode
        : response.status === 404 && payload && payload.error === "entity not found"
          ? "entity_not_found"
          : payload && typeof payload.error === "string" && /unknown action/i.test(payload.error)
            ? "unknown_action"
            : `http_${response.status}`;
      throw createMorphConnectorError(code, payload && typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`, {
        pathname,
        status: response.status,
        payload,
        requiredPermission: payload?.authorization?.requiredPermission,
      });
    }
    return payload;
  } catch (error) {
    throw normalizeMorphRequestError(error, {
      pathname,
      actionName: options.actionName,
    });
  } finally {
    clearTimeout(timer);
  }
}

function makeActionEnvelope(api, actionName, params, requiredPermission) {
  const cfg = getPluginConfig(api);
  const rawConfirmation = params.confirmation && typeof params.confirmation === "object" ? params.confirmation : null;
  const confirmation = rawConfirmation
    ? {
        confirmed: rawConfirmation.confirmed === true,
        reason: String(rawConfirmation.reason || "").trim(),
        scope: String(rawConfirmation.scope || "").trim(),
        targetIds: Array.isArray(rawConfirmation.targetIds)
          ? rawConfirmation.targetIds.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
      }
    : undefined;
  return {
    actor: String(params.actor || cfg.defaultActor).trim() || cfg.defaultActor,
    source: String(params.source || cfg.defaultSource).trim() || cfg.defaultSource,
    requestId: String(params.requestId || `${actionName}-${Date.now()}`).trim(),
    permissions: Array.isArray(params.permissions) && params.permissions.length
      ? params.permissions
      : [requiredPermission],
    ...(confirmation ? { confirmation } : {}),
    payload: params.payload && typeof params.payload === "object" ? params.payload : {},
  };
}

function buildActionHeaders(params = {}) {
  const surface = String(params.surface || "").trim().toLowerCase();
  if (!surface || surface === "external") return {};
  if (surface === "manual" || surface === "trusted-manual" || surface === "trusted-product") {
    return { "x-morph-action-surface": "manual" };
  }
  if (surface === "system") {
    return { "x-morph-action-surface": "system" };
  }
  return {};
}

async function executeMorphAction(api, actionName, params = {}, requiredPermission = "") {
  return requestMorphJson(api, `/api/morph/actions/${actionName}`, {
    method: "POST",
    actionName,
    headers: buildActionHeaders(params),
    body: makeActionEnvelope(api, actionName, params, requiredPermission),
  });
}

function isStructuredHostPayload(value) {
  return !!(value && typeof value === "object" && typeof value.action === "string" && value.receipt && typeof value.receipt === "object");
}

function textResult(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }] };
}

function registerReadTool(api, spec) {
  api.registerTool({
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters || Type.Object({}),
    async execute(_id, params = {}) {
      const payload = await requestMorphJson(api, spec.buildPath(params));
      return textResult(payload);
    },
  });
}

async function diagnoseMorphConnection(api) {
  const cfg = getPluginConfig(api);
  const diagnosis = {
    ok: false,
    pluginId: PLUGIN_ID,
    baseUrl: cfg.baseUrl || "",
    checks: [],
    suggestions: [],
  };

  if (!cfg.baseUrl) {
    diagnosis.code = "morph_core_missing_base_url";
    diagnosis.checks.push({
      check: "config.baseUrl",
      ok: false,
      message: "Missing `plugins.entries.morph-core.config.baseUrl`.",
    });
    diagnosis.suggestions.push("Set `plugins.entries.morph-core.config.baseUrl` to your local Morpheus server, for example `http://127.0.0.1:2199`.");
    return diagnosis;
  }

  try {
    const health = await requestMorphJson(api, "/api/health");
    diagnosis.checks.push({
      check: "api.health",
      ok: health && health.ok === true,
      message: health && health.ok === true ? "Morpheus health endpoint is reachable." : "Morpheus health endpoint returned an unexpected payload.",
    });
  } catch (error) {
    diagnosis.code = error.code || "morph_server_unreachable";
    diagnosis.checks.push({
      check: "api.health",
      ok: false,
      message: error.message,
    });
    diagnosis.suggestions.push("Start the local Morpheus server and verify the configured `baseUrl` is reachable from OpenClaw.");
    return diagnosis;
  }

  try {
    const capabilities = await requestMorphJson(api, "/api/morph/capabilities");
    const actions = Array.isArray(capabilities?.actionApi?.actions) ? capabilities.actionApi.actions : [];
    diagnosis.checks.push({
      check: "api.capabilities",
      ok: capabilities && capabilities.ok === true,
      message: `Capabilities loaded with ${actions.length} declared action(s).`,
    });
    diagnosis.ok = true;
    diagnosis.code = "ok";
    diagnosis.capabilities = {
      actionCount: actions.length,
      queryEndpointCount: Array.isArray(capabilities?.queryEndpoints) ? capabilities.queryEndpoints.length : 0,
      disabledHighRiskActions: actions
        .filter((entry) => entry && entry.enabled === false && entry.risk === "high")
        .map((entry) => entry.action),
    };
    return diagnosis;
  } catch (error) {
    diagnosis.code = error.code || "morph_capabilities_unavailable";
    diagnosis.checks.push({
      check: "api.capabilities",
      ok: false,
      message: error.message,
    });
    diagnosis.suggestions.push("Make sure the current Morpheus server version exposes `GET /api/morph/capabilities`.");
    return diagnosis;
  }
}

function registerOptionalActionTool(api, spec) {
  api.registerTool(
    {
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
      async execute(_id, params) {
        try {
          const payload = await executeMorphAction(api, spec.actionName, {
            actor: params.actor,
            source: params.source,
            requestId: params.requestId,
            payload: spec.buildPayload(params),
          }, spec.requiredPermission);
          return textResult(payload);
        } catch (error) {
          if (isStructuredHostPayload(error?.details?.payload)) {
            return textResult(error.details.payload);
          }
          throw error;
        }
      },
    },
    { optional: true }
  );
}

export default function registerMorphCorePlugin(api) {
  api.registerTool({
    name: "morph_diagnose_connection",
    description: "Diagnose Morpheus connector configuration and local server reachability.",
    parameters: Type.Object({}),
    async execute() {
      const payload = await diagnoseMorphConnection(api);
      return textResult(payload);
    },
  });

  registerReadTool(api, {
    name: "morph_capabilities",
    description: "Read Morpheus capability discovery info from /api/morph/capabilities.",
    buildPath() {
      return "/api/morph/capabilities";
    },
  });

  api.registerTool({
    name: "morph_action",
    description: "Direct passthrough to Morpheus Action Host v1. Use this when you want the raw host contract instead of a convenience wrapper.",
    parameters: Type.Object({
      actionName: Type.String({ minLength: 1 }),
      payload: Type.Optional(Type.Object({}, { additionalProperties: true })),
      permissions: Type.Optional(Type.Array(Type.String())),
      confirmation: Type.Optional(Type.Object({
        confirmed: Type.Optional(Type.Boolean()),
        reason: Type.Optional(Type.String()),
        scope: Type.Optional(Type.String()),
        targetIds: Type.Optional(Type.Array(Type.String())),
      })),
      surface: Type.Optional(Type.Union([
        Type.Literal("external"),
        Type.Literal("manual"),
        Type.Literal("system"),
      ])),
      actor: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
    }),
    async execute(_id, params = {}) {
      try {
        const payload = await executeMorphAction(api, params.actionName, {
          actor: params.actor,
          source: params.source,
          requestId: params.requestId,
          permissions: Array.isArray(params.permissions) ? params.permissions : [],
          confirmation: params.confirmation,
          surface: params.surface,
          payload: params.payload && typeof params.payload === "object" ? params.payload : {},
        }, "");
        return textResult(payload);
      } catch (error) {
        if (error && error.code === "confirmation_required" && error.details?.payload && typeof error.details.payload === "object") {
          return textResult(error.details.payload);
        }
        throw error;
      }
    },
  });

  registerReadTool(api, {
    name: "morph_summary",
    description: "Read Morpheus summary counts and status snapshot from /api/morph/summary.",
    buildPath() {
      return "/api/morph/summary";
    },
  });

  registerReadTool(api, {
    name: "morph_projects",
    description: "Read Morpheus projects from /api/morph/projects.",
    buildPath() {
      return "/api/morph/projects";
    },
  });

  registerReadTool(api, {
    name: "morph_reminders",
    description: "Read Morpheus reminders from /api/morph/reminders.",
    buildPath() {
      return "/api/morph/reminders";
    },
  });

  registerReadTool(api, {
    name: "morph_sops",
    description: "Read Morpheus SOPs from /api/morph/sops.",
    buildPath() {
      return "/api/morph/sops";
    },
  });

  registerReadTool(api, {
    name: "morph_flash_thoughts",
    description: "Read Morpheus flash thoughts from /api/morph/flash-thoughts.",
    buildPath() {
      return "/api/morph/flash-thoughts";
    },
  });

  registerReadTool(api, {
    name: "morph_daily",
    description: "Read Morpheus daily entries for a month from /api/morph/daily?month=YYYY-MM.",
    parameters: Type.Object({
      month: Type.String({ minLength: 7 }),
    }),
    buildPath(params) {
      return `/api/morph/daily?month=${encodeURIComponent(params.month)}`;
    },
  });

  api.registerTool({
    name: "morph_entity",
    description: "Read a single Morpheus entity by id and type.",
    parameters: Type.Object({
      id: Type.String({ minLength: 1 }),
      type: Type.Union([
        Type.Literal("project"),
        Type.Literal("reminder"),
        Type.Literal("sop"),
        Type.Literal("daily"),
        Type.Literal("flashThought"),
        Type.Literal("fixedThought"),
        Type.Literal("routine"),
      ]),
    }),
    async execute(_id, params) {
      const payload = await requestMorphJson(
        api,
        `/api/morph/entity?id=${encodeURIComponent(params.id)}&type=${encodeURIComponent(params.type)}`
      );
      return textResult(payload);
    },
  });

  registerOptionalActionTool(api, {
    name: "morph_create_flash_thought",
    actionName: "create_flash_thought",
    description: "Create a Morpheus flash thought via POST /api/morph/actions/create_flash_thought.",
    requiredPermission: "append",
    parameters: Type.Object({
      text: Type.String({ minLength: 1 }),
      date: Type.Optional(Type.String()),
      time: Type.Optional(Type.String()),
      tags: Type.Optional(Type.Array(Type.String())),
      actor: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
    }),
    buildPayload(params) {
      return {
        text: params.text,
        date: params.date || "",
        time: params.time || "",
        tags: Array.isArray(params.tags) ? params.tags : [],
      };
    },
  });

  registerOptionalActionTool(api, {
    name: "morph_add_fixed_thought",
    actionName: "add_fixed_thought",
    description: "Create a Morpheus fixed thought via POST /api/morph/actions/add_fixed_thought.",
    requiredPermission: "append",
    parameters: Type.Object({
      text: Type.String({ minLength: 1 }),
      name: Type.Optional(Type.String()),
      tags: Type.Optional(Type.Array(Type.String())),
      actor: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
    }),
    buildPayload(params) {
      return {
        text: params.text,
        name: params.name || "",
        tags: Array.isArray(params.tags) ? params.tags : [],
      };
    },
  });

  registerOptionalActionTool(api, {
    name: "morph_create_project",
    actionName: "create_project",
    description: "Create a Morpheus project via POST /api/morph/actions/create_project.",
    requiredPermission: "append",
    parameters: Type.Object({
      name: Type.String({ minLength: 1 }),
      description: Type.Optional(Type.String()),
      tags: Type.Optional(Type.Array(Type.String())),
      actor: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
    }),
    buildPayload(params) {
      return {
        name: params.name,
        description: params.description || "",
        tags: Array.isArray(params.tags) ? params.tags : [],
      };
    },
  });

  registerOptionalActionTool(api, {
    name: "morph_append_project_block",
    actionName: "append_project_block",
    description: "Append a block into a Morpheus project via POST /api/morph/actions/append_project_block.",
    requiredPermission: "append",
    parameters: Type.Object({
      projectId: Type.String({ minLength: 1 }),
      text: Type.String({ minLength: 1 }),
      type: Type.Optional(Type.String()),
      checked: Type.Optional(Type.Boolean()),
      actor: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
    }),
    buildPayload(params) {
      return {
        projectId: params.projectId,
        text: params.text,
        type: params.type || "",
        checked: params.checked === true,
      };
    },
  });

  registerOptionalActionTool(api, {
    name: "morph_create_routine",
    actionName: "create_routine",
    description: "Create a Morpheus routine via POST /api/morph/actions/create_routine.",
    requiredPermission: "append",
    parameters: Type.Object({
      name: Type.String({ minLength: 1 }),
      description: Type.Optional(Type.String()),
      schedule: Type.Optional(Type.String()),
      tags: Type.Optional(Type.Array(Type.String())),
      actor: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
    }),
    buildPayload(params) {
      return {
        name: params.name,
        description: params.description || "",
        schedule: params.schedule || "",
        tags: Array.isArray(params.tags) ? params.tags : [],
      };
    },
  });

  registerOptionalActionTool(api, {
    name: "morph_create_reminder",
    actionName: "create_reminder",
    description: "Create a Morpheus reminder via POST /api/morph/actions/create_reminder.",
    requiredPermission: "append",
    parameters: Type.Object({
      title: Type.String({ minLength: 1 }),
      note: Type.Optional(Type.String()),
      dueAt: Type.Optional(Type.String()),
      priority: Type.Optional(Type.Union([
        Type.Literal("low"),
        Type.Literal("medium"),
        Type.Literal("high"),
      ])),
      actor: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
    }),
    buildPayload(params) {
      return {
        title: params.title,
        note: params.note || "",
        dueAt: params.dueAt || "",
        priority: params.priority || "medium",
      };
    },
  });

  registerOptionalActionTool(api, {
    name: "morph_add_project_reference",
    actionName: "add_project_reference",
    description: "Append a project reference item via POST /api/morph/actions/add_project_reference.",
    requiredPermission: "append",
    parameters: Type.Object({
      projectId: Type.String({ minLength: 1 }),
      text: Type.String({ minLength: 1 }),
      time: Type.Optional(Type.String()),
      actor: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
    }),
    buildPayload(params) {
      return {
        projectId: params.projectId,
        text: params.text,
        time: params.time || "",
      };
    },
  });

  registerOptionalActionTool(api, {
    name: "morph_append_daily_log",
    actionName: "append_daily_log",
    description: "Append a note block into a Morpheus daily log via POST /api/morph/actions/append_daily_log.",
    requiredPermission: "append",
    parameters: Type.Object({
      text: Type.String({ minLength: 1 }),
      date: Type.Optional(Type.String()),
      summary: Type.Optional(Type.String()),
      actor: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
    }),
    buildPayload(params) {
      return {
        text: params.text,
        date: params.date || "",
        summary: params.summary || "",
      };
    },
  });

}
