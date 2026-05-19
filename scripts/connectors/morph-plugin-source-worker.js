const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const DEFAULT_NODE_BIN = process.execPath || 'node';
const OPENROUTER_DEFAULT_MODEL = 'openrouter/auto';
const GLM_DEFAULT_MODEL = 'glm-4.5-flash';
const DOUBAO_DEFAULT_MODEL_ID = 'doubao-1-5-pro-256k-250115';
const QWEN_DEFAULT_MODEL = 'qwen-plus';
const KIMI_DEFAULT_MODEL = 'moonshot-v1-8k';
const CODEX_OPENAI_COMPAT_DEFAULT_MODEL = String(process.env.MORPH_PLUGIN_SOURCE_CODEX_MODEL || '').trim() || 'gpt-5.1-codex-mini';
const DESKTOP_MANAGED_ANTI_API_BASE_URL = 'http://127.0.0.1:8964/v1/chat/completions';
const DESKTOP_MANAGED_ANTI_API_MODELS_URL = 'http://127.0.0.1:8964/v1/models';
const DOUBAO_CHAT_COMPLETIONS_URL = 'https://operator.las.cn-beijing.volces.com/api/v1/chat/completions';
const QWEN_CHAT_COMPLETIONS_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const KIMI_CHAT_COMPLETIONS_URL = 'https://api.moonshot.cn/v1/chat/completions';
const DIST_WWW_RELATIVE_PATH = path.join('dist', 'Morpheus.app', 'Contents', 'Resources', 'www');
const DEFAULT_AI_REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.MORPH_PLUGIN_SOURCE_AI_TIMEOUT_MS) || 10 * 60 * 1000);
const SOURCE_MUTATION_POLICY_PATH = path.join(__dirname, 'morph-plugin-source-mutation-policy.json');

function toSafeText(value, maxLen = 4000) {
  return String(value || '').trim().slice(0, maxLen);
}

function normalizePluginId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 120);
}

function createHttpError(message, options = {}) {
  const error = new Error(message || 'request failed');
  error.statusCode = Number.isFinite(Number(options.statusCode)) ? Number(options.statusCode) : 400;
  error.code = toSafeText(options.code, 120) || 'request_failed';
  error.details = options.details && typeof options.details === 'object' ? options.details : undefined;
  return error;
}

function ensureWithinRoot(targetPath, rootDir) {
  const root = path.resolve(String(rootDir || '').trim() || '.');
  const target = path.resolve(String(targetPath || '').trim() || '.');
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw createHttpError('path escaped workspace root', {
      statusCode: 400,
      code: 'workspace_out_of_bounds',
      details: { target, root },
    });
  }
  return target;
}

function readTextFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return '';
  }
}

function readJsonFileSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function writeTextFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(content || ''), 'utf8');
}

function emitImplementationProgress(callback, payload = {}) {
  if (typeof callback !== 'function') return;
  try {
    callback({
      stage: toSafeText(payload.stage, 80) || 'working',
      message: toSafeText(payload.message, 240) || '处理中',
      percent: Math.max(0, Math.min(100, Number(payload.percent) || 0)),
      details: payload.details && typeof payload.details === 'object' ? payload.details : undefined,
    });
  } catch (_) {}
}

function normalizeAIConfig(raw = null) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const provider = String(source.provider || '').trim().toLowerCase();
  const apiKey = String(source.apiKey || '').trim();
  const baseUrl = String(source.baseUrl || '').trim();
  const model = String(source.model || '').trim();
  return {
    provider,
    apiKey,
    baseUrl,
    model,
  };
}

function buildOpenAICompatiblePayload(prompt, model, extra = {}) {
  return {
    model: model || CODEX_OPENAI_COMPAT_DEFAULT_MODEL,
    messages: [{ role: 'user', content: String(prompt || '') }],
    ...extra,
  };
}

async function isDesktopManagedAntiAPIReachable(deps = {}) {
  const fetchImpl = typeof deps.fetchImpl === 'function' ? deps.fetchImpl : fetch;
  try {
    const response = await fetchImpl(DESKTOP_MANAGED_ANTI_API_MODELS_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return !!response?.ok;
  } catch (_) {
    return false;
  }
}

async function refreshDesktopManagedAntiAPIAuth(deps = {}) {
  const fetchImpl = typeof deps.fetchImpl === 'function' ? deps.fetchImpl : fetch;
  try {
    const response = await fetchImpl('http://127.0.0.1:8964/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider: 'codex' }),
    });
    return !!response?.ok;
  } catch (_) {
    return false;
  }
}

async function resolveEffectiveAIConfig(aiConfig, deps = {}) {
  const normalized = normalizeAIConfig(aiConfig);
  if (normalized.provider) {
    if (normalized.provider === 'codex' && !normalized.baseUrl && await isDesktopManagedAntiAPIReachable(deps)) {
      return {
        ...normalized,
        apiKey: normalized.apiKey || 'anti-api-local',
        baseUrl: DESKTOP_MANAGED_ANTI_API_BASE_URL,
        model: normalized.model || CODEX_OPENAI_COMPAT_DEFAULT_MODEL,
      };
    }
    return normalized;
  }
  if (await isDesktopManagedAntiAPIReachable(deps)) {
    return {
      provider: 'codex',
      apiKey: 'anti-api-local',
      baseUrl: DESKTOP_MANAGED_ANTI_API_BASE_URL,
      model: CODEX_OPENAI_COMPAT_DEFAULT_MODEL,
    };
  }
  return normalized;
}

function shouldFallbackToDesktopManagedAntiAPI(error) {
  const code = String(error?.code || '').trim().toLowerCase();
  const message = String(error?.message || '').trim().toLowerCase();
  const body = String(error?.details?.body || '').trim().toLowerCase();
  if (code === 'missing_ai_provider' || code === 'missing_ai_key' || code === 'missing_ai_base_url') return true;
  if (message.includes('401') || body.includes('invalid_api_key') || body.includes('incorrect api key') || body.includes('api key')) return true;
  return false;
}

async function requestAITextWithProvider(prompt, aiConfig, deps = {}) {
  const cfg = await resolveEffectiveAIConfig(aiConfig, deps);
  const requestOverride = typeof deps.requestAIText === 'function' ? deps.requestAIText : null;
  if (requestOverride) {
    return requestOverride(prompt, cfg, deps);
  }
  if (!cfg.provider) {
    throw createHttpError('active AI provider is unavailable for native plugin source worker', {
      statusCode: 400,
      code: 'missing_ai_provider',
    });
  }
  const fetchImpl = typeof deps.fetchImpl === 'function' ? deps.fetchImpl : fetch;
  const requestJson = async (url, payload, headers = {}) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), DEFAULT_AI_REQUEST_TIMEOUT_MS) : null;
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
        signal: controller?.signal,
      });
    } catch (error) {
      if (timer) clearTimeout(timer);
      const isAbort = error?.name === 'AbortError' || /aborted|timeout/i.test(String(error?.message || ''));
      if (isAbort) {
        throw createHttpError('native plugin source worker AI request timed out', {
          statusCode: 504,
          code: 'plugin_source_ai_timeout',
          details: {
            provider: cfg.provider,
            timeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
            url,
          },
        });
      }
      throw error;
    }
    if (timer) clearTimeout(timer);
    if (!response.ok) {
      throw createHttpError(`native plugin source worker AI request failed: ${response.status}`, {
        statusCode: 502,
        code: 'plugin_source_ai_failed',
        details: {
          provider: cfg.provider,
          status: response.status,
          body: String(await response.text()).slice(0, 1200),
        },
      });
    }
    return response.json();
  };

  if (cfg.provider === 'openrouter') {
    if (!cfg.apiKey) throw createHttpError('OpenRouter API key is missing', { statusCode: 400, code: 'missing_ai_key' });
    const payload = buildOpenAICompatiblePayload(prompt, cfg.model || OPENROUTER_DEFAULT_MODEL);
    const result = await requestJson('https://openrouter.ai/api/v1/chat/completions', payload, {
      Authorization: `Bearer ${cfg.apiKey}`,
    });
    return String(result?.choices?.[0]?.message?.content || '').trim();
  }
  if (cfg.provider === 'glm') {
    if (!cfg.apiKey) throw createHttpError('GLM API key is missing', { statusCode: 400, code: 'missing_ai_key' });
    const payload = buildOpenAICompatiblePayload(prompt, cfg.model || GLM_DEFAULT_MODEL);
    const result = await requestJson('https://open.bigmodel.cn/api/paas/v4/chat/completions', payload, {
      Authorization: `Bearer ${cfg.apiKey}`,
    });
    return String(result?.choices?.[0]?.message?.content || '').trim();
  }
  if (cfg.provider === 'doubao') {
    if (!cfg.apiKey) throw createHttpError('Doubao API key is missing', { statusCode: 400, code: 'missing_ai_key' });
    const payload = buildOpenAICompatiblePayload(prompt, cfg.model || DOUBAO_DEFAULT_MODEL_ID);
    const result = await requestJson(DOUBAO_CHAT_COMPLETIONS_URL, payload, {
      Authorization: `Bearer ${cfg.apiKey}`,
    });
    return String(result?.choices?.[0]?.message?.content || '').trim();
  }
  if (cfg.provider === 'qwen') {
    if (!cfg.apiKey) throw createHttpError('Qwen API key is missing', { statusCode: 400, code: 'missing_ai_key' });
    const payload = buildOpenAICompatiblePayload(prompt, cfg.model || QWEN_DEFAULT_MODEL);
    const result = await requestJson(QWEN_CHAT_COMPLETIONS_URL, payload, {
      Authorization: `Bearer ${cfg.apiKey}`,
    });
    return String(result?.choices?.[0]?.message?.content || '').trim();
  }
  if (cfg.provider === 'kimi') {
    if (!cfg.apiKey) throw createHttpError('Kimi API key is missing', { statusCode: 400, code: 'missing_ai_key' });
    const payload = buildOpenAICompatiblePayload(prompt, cfg.model || KIMI_DEFAULT_MODEL);
    const result = await requestJson(KIMI_CHAT_COMPLETIONS_URL, payload, {
      Authorization: `Bearer ${cfg.apiKey}`,
    });
    return String(result?.choices?.[0]?.message?.content || '').trim();
  }
  if (cfg.provider === 'codex') {
    if (!cfg.baseUrl) throw createHttpError('Codex base URL is missing', { statusCode: 400, code: 'missing_ai_base_url' });
    const payload = buildOpenAICompatiblePayload(prompt, cfg.model || CODEX_OPENAI_COMPAT_DEFAULT_MODEL, {
      reasoning_effort: 'low',
    });
    const headers = {};
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    try {
      const result = await requestJson(cfg.baseUrl, payload, headers);
      const content = String(result?.choices?.[0]?.message?.content || '').trim();
      if (!content) {
        throw createHttpError('desktop managed anti-api returned an empty completion payload', {
          statusCode: 502,
          code: 'plugin_source_empty_ai_reply',
          details: {
            provider: cfg.provider,
            model: cfg.model || CODEX_OPENAI_COMPAT_DEFAULT_MODEL,
            baseUrl: cfg.baseUrl,
          },
        });
      }
      return content;
    } catch (error) {
      const shouldRetryWithRefresh = cfg.baseUrl === DESKTOP_MANAGED_ANTI_API_BASE_URL
        && /refresh token|not authenticated|authentication required|status 401/i.test(String(error?.details?.body || error?.message || ''));
      if (shouldRetryWithRefresh && await refreshDesktopManagedAntiAPIAuth(deps)) {
        const retry = await requestJson(cfg.baseUrl, payload, headers);
        const retryContent = String(retry?.choices?.[0]?.message?.content || '').trim();
        if (!retryContent) {
          throw createHttpError('desktop managed anti-api returned an empty completion payload after auth refresh', {
            statusCode: 502,
            code: 'plugin_source_empty_ai_reply',
            details: {
              provider: cfg.provider,
              model: cfg.model || CODEX_OPENAI_COMPAT_DEFAULT_MODEL,
              baseUrl: cfg.baseUrl,
            },
          });
        }
        return retryContent;
      }
      throw error;
    }
  }
  if (cfg.provider === 'gemini') {
    if (!cfg.apiKey) throw createHttpError('Gemini API key is missing', { statusCode: 400, code: 'missing_ai_key' });
    const model = cfg.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const payload = {
      contents: [{
        parts: [{ text: String(prompt || '') }],
      }],
    };
    const result = await requestJson(url, payload);
    return String(result?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  }
  throw createHttpError(`unsupported AI provider for native plugin source worker: ${cfg.provider}`, {
    statusCode: 400,
    code: 'unsupported_ai_provider',
    details: { provider: cfg.provider },
  });
}

async function requestAITextWithProviderFallback(prompt, aiConfig, deps = {}) {
  const effective = await resolveEffectiveAIConfig(aiConfig, deps);
  try {
    return await requestAITextWithProvider(prompt, effective, deps);
  } catch (error) {
    if (
      effective.provider !== 'codex'
      && shouldFallbackToDesktopManagedAntiAPI(error)
      && await isDesktopManagedAntiAPIReachable(deps)
    ) {
      return requestAITextWithProvider(prompt, {
        provider: 'codex',
        apiKey: 'anti-api-local',
        baseUrl: DESKTOP_MANAGED_ANTI_API_BASE_URL,
        model: CODEX_OPENAI_COMPAT_DEFAULT_MODEL,
      }, deps);
    }
    throw error;
  }
}

function extractJsonObject(text = '') {
  const raw = String(text || '').trim();
  if (!raw) throw createHttpError('AI returned an empty plugin implementation response', {
    statusCode: 502,
    code: 'plugin_source_empty_ai_reply',
  });
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  const jsonText = firstBrace >= 0 && lastBrace >= firstBrace ? candidate.slice(firstBrace, lastBrace + 1) : candidate;
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw createHttpError('AI returned invalid plugin implementation JSON', {
      statusCode: 502,
      code: 'plugin_source_invalid_ai_json',
      details: {
        message: error?.message || 'parse_failed',
        replyPreview: raw.slice(0, 1200),
      },
    });
  }
}

function normalizeRelativePath(value = '') {
  return String(value || '').trim().replace(/\\/g, '/');
}

function normalizePatchOperationKind(value = '') {
  const kind = String(value || '').trim().toLowerCase();
  if (['upsert_file', 'write_file', 'replace_file'].includes(kind)) return 'upsert_file';
  if (kind === 'create_file') return 'create_file';
  if (['search_replace', 'patch_file'].includes(kind)) return 'search_replace';
  return '';
}

function loadSourceMutationPolicy() {
  const fallback = {
    pluginOwnedFiles: [],
    conditionalHostFiles: [],
  };
  const loaded = readJsonFileSafe(SOURCE_MUTATION_POLICY_PATH);
  return loaded && typeof loaded === 'object'
    ? loaded
    : fallback;
}

function hasWorkspaceHostIntegration(workspaceRoot, pluginId) {
  const hostRuntimePath = path.join(workspaceRoot, 'assets', 'js', 'local-plugin-workspace-runtime.js');
  const morphHtmlPath = path.join(workspaceRoot, 'morph.html');
  const hostRuntimeText = readTextFileSafe(hostRuntimePath);
  const morphHtmlText = readTextFileSafe(morphHtmlPath);
  const runtimeFileName = `${pluginId}-runtime.js`;
  const hasWorkspaceBranch = hostRuntimeText.includes(pluginId);
  const hasScriptRegistration = morphHtmlText.includes(runtimeFileName);
  return hasWorkspaceBranch && hasScriptRegistration;
}

function resolvePolicyPathTemplate(template = '', pluginId = '') {
  return normalizeRelativePath(String(template || '').replace(/\{pluginId\}/g, pluginId));
}

function buildAllowedPathPolicies(workspaceRoot, pluginId) {
  const policy = loadSourceMutationPolicy();
  const hasIntegration = hasWorkspaceHostIntegration(workspaceRoot, pluginId);
  const filePolicyMap = new Map();
  const registerPolicy = (entry = {}, owner = 'plugin') => {
    const relativePath = resolvePolicyPathTemplate(entry.path, pluginId);
    if (!relativePath) return;
    const allowOperations = new Set(
      (Array.isArray(entry.allowOperations) ? entry.allowOperations : [])
        .map((item) => normalizePatchOperationKind(item))
        .filter(Boolean)
    );
    if (!allowOperations.size) return;
    filePolicyMap.set(relativePath, {
      path: relativePath,
      owner,
      allowOperations,
    });
  };
  (Array.isArray(policy.pluginOwnedFiles) ? policy.pluginOwnedFiles : []).forEach((entry) => registerPolicy(entry, 'plugin'));
  (Array.isArray(policy.conditionalHostFiles) ? policy.conditionalHostFiles : []).forEach((entry) => {
    const condition = toSafeText(entry?.when, 80);
    if (condition === 'missing-workspace-integration' && hasIntegration) return;
    registerPolicy(entry, 'host');
  });
  return filePolicyMap;
}

function buildFileContext(workspaceRoot, relativePath) {
  const absolutePath = ensureWithinRoot(path.join(workspaceRoot, relativePath), workspaceRoot);
  const exists = fs.existsSync(absolutePath);
  return {
    path: relativePath,
    exists,
    content: exists ? readTextFileSafe(absolutePath) : '',
  };
}

function buildImplementationPrompt({
  pluginId,
  requirement,
  workspaceRoot,
  manifest,
  fileContexts,
  validationTargets,
}) {
  const rules = [
    'Manifest-first, keep Morpheus host shells intact.',
    '配置页面必须继续是 modal-only；不要把配置项或当前状态塞进工作台详情页。',
    '工作台右上角必须继续复用宿主统一药丸；不要自造右上角按钮。',
    '尽量把插件状态放进 pluginData["' + pluginId + '"]；AI 读取必须以插件启用状态为前提。',
    '只允许改动 allowlist 里的文件，且宿主改动要最小化。',
    '插件自有文件优先用 upsert_file 或 create_file；宿主文件只能用 search_replace。',
    'search_replace 的 search 必须直接取自当前文件原文，避免模糊描述。',
    '如果需要真正让插件运行，可以补 runtime、在 local-plugin-workspace-runtime.js 中接渲染分支、并在 morph.html 注册 script。',
    '返回内容只能是严格 JSON，不要 markdown，不要解释段落。',
  ];
  const allowlist = fileContexts.map((item) => item.path);
  return [
    'You are a controlled Morpheus native plugin source worker.',
    `Target plugin id: ${pluginId}`,
    `Workspace root: ${workspaceRoot}`,
    `User requirement: ${requirement}`,
    '',
    'Current plugin manifest:',
    JSON.stringify(manifest, null, 2),
    '',
    'Hard rules:',
    ...rules.map((item) => `- ${item}`),
    '',
    'Allowed files:',
    ...fileContexts.map((item) => `- ${item.path} (${item.owner === 'host' ? 'host glue' : 'plugin owned'}; allowed operations: ${Array.from(item.allowOperations || []).join(', ')})`),
    '',
    'Return ONLY strict JSON in this shape:',
    '{',
    '  "summary": "short one-line summary",',
    '  "assumptions": ["optional assumption"],',
    '  "operations": [',
    '    { "type": "upsert_file", "path": "relative/path", "content": "full file content" },',
    '    { "type": "create_file", "path": "relative/path", "content": "full file content" },',
    '    { "type": "search_replace", "path": "relative/path", "search": "exact old snippet", "replace": "new snippet", "expectedMatches": 1 }',
    '  ]',
    '}',
    '',
    'Requirements for operations:',
    '- At least one operation is required.',
    '- Do not include files outside the allowlist.',
    '- For host glue files, use search_replace only.',
    '- upsert_file/create_file must provide complete file contents.',
    '- search_replace must use exact snippets from Current file contents below.',
    '- If you intentionally replace multiple matches, set all=true and expectedMatches=<count>.',
    '',
    'Validation targets after write:',
    ...validationTargets.map((item) => `- ${item}`),
    '',
    'Current file contents:',
    ...fileContexts.flatMap((item) => [
      `FILE: ${item.path}`,
      item.exists ? item.content : '(missing file)',
      `END FILE: ${item.path}`,
      '',
    ]),
  ].join('\n');
}

function normalizePatchOperations(payload, workspaceRoot, allowedPathPolicies) {
  let operations = Array.isArray(payload?.operations) ? payload.operations : [];
  if (!operations.length && Array.isArray(payload?.changedFiles)) {
    operations = payload.changedFiles.map((entry) => ({
      type: 'upsert_file',
      path: entry?.path,
      content: entry?.content,
    }));
  }
  if (!operations.length) {
    throw createHttpError('plugin implementation AI response did not include operations', {
      statusCode: 502,
      code: 'plugin_source_no_operations',
    });
  }
  return operations.map((entry, index) => {
    const relativePath = normalizeRelativePath(entry?.path);
    const policy = relativePath ? allowedPathPolicies.get(relativePath) : null;
    if (!relativePath || !policy) {
      throw createHttpError('plugin implementation AI tried to edit a file outside the allowlist', {
        statusCode: 502,
        code: 'plugin_source_path_not_allowed',
        details: {
          path: relativePath,
          allowlist: Array.from(allowedPathPolicies.keys()),
          operationIndex: index,
        },
      });
    }
    const kind = normalizePatchOperationKind(entry?.type);
    if (!kind || !policy.allowOperations.has(kind)) {
      throw createHttpError('plugin implementation AI used an operation that is not allowed for this file', {
        statusCode: 502,
        code: 'plugin_source_operation_not_allowed',
        details: {
          path: relativePath,
          operationType: toSafeText(entry?.type, 80),
          allowedOperations: Array.from(policy.allowOperations),
          operationIndex: index,
        },
      });
    }
    const absolutePath = ensureWithinRoot(path.join(workspaceRoot, relativePath), workspaceRoot);
    if (kind === 'upsert_file' || kind === 'create_file') {
      const content = typeof entry?.content === 'string' ? entry.content : null;
      if (content == null) {
        throw createHttpError('plugin implementation AI returned a file write without content', {
          statusCode: 502,
          code: 'plugin_source_missing_content',
          details: { path: relativePath, operationIndex: index },
        });
      }
      return {
        type: kind,
        path: relativePath,
        absolutePath,
        content,
      };
    }
    const search = typeof entry?.search === 'string' ? entry.search : null;
    const replace = typeof entry?.replace === 'string' ? entry.replace : null;
    if (!search) {
      throw createHttpError('plugin implementation AI returned search_replace without search text', {
        statusCode: 502,
        code: 'plugin_source_missing_search',
        details: { path: relativePath, operationIndex: index },
      });
    }
    if (replace == null) {
      throw createHttpError('plugin implementation AI returned search_replace without replace text', {
        statusCode: 502,
        code: 'plugin_source_missing_replace',
        details: { path: relativePath, operationIndex: index },
      });
    }
    return {
      type: kind,
      path: relativePath,
      absolutePath,
      search,
      replace,
      all: entry?.all === true,
      expectedMatches: Number.isFinite(Number(entry?.expectedMatches))
        ? Math.max(1, Number(entry.expectedMatches))
        : null,
    };
  });
}

function countExactMatches(text = '', search = '') {
  if (!search) return 0;
  return String(text || '').split(search).length - 1;
}

function applyPatchOperations(workspaceRoot, operations = []) {
  const stagedFiles = new Map();
  operations.forEach((operation, index) => {
    if (!stagedFiles.has(operation.path)) {
      const exists = fs.existsSync(operation.absolutePath);
      stagedFiles.set(operation.path, {
        path: operation.path,
        absolutePath: operation.absolutePath,
        existed: exists,
        originalContent: exists ? readTextFileSafe(operation.absolutePath) : '',
        content: exists ? readTextFileSafe(operation.absolutePath) : '',
      });
    }
    const current = stagedFiles.get(operation.path);
    if (operation.type === 'create_file') {
      if (current.existed) {
        throw createHttpError('plugin implementation AI tried to create a file that already exists', {
          statusCode: 502,
          code: 'plugin_source_create_existing_file',
          details: { path: operation.path, operationIndex: index },
        });
      }
      current.content = operation.content;
      current.existed = true;
      return;
    }
    if (operation.type === 'upsert_file') {
      current.content = operation.content;
      current.existed = true;
      return;
    }
    if (!current.existed) {
      throw createHttpError('plugin implementation AI tried to patch a file that does not exist', {
        statusCode: 502,
        code: 'plugin_source_patch_missing_file',
        details: { path: operation.path, operationIndex: index },
      });
    }
    const matchCount = countExactMatches(current.content, operation.search);
    const expectedMatches = operation.expectedMatches != null
      ? operation.expectedMatches
      : (operation.all === true ? null : 1);
    if (matchCount < 1) {
      throw createHttpError('plugin implementation AI search_replace did not match the current file', {
        statusCode: 502,
        code: 'plugin_source_search_not_found',
        details: { path: operation.path, operationIndex: index },
      });
    }
    if (expectedMatches != null && matchCount !== expectedMatches) {
      throw createHttpError('plugin implementation AI search_replace matched an unexpected number of snippets', {
        statusCode: 502,
        code: 'plugin_source_unexpected_match_count',
        details: {
          path: operation.path,
          operationIndex: index,
          matchCount,
          expectedMatches,
        },
      });
    }
    current.content = operation.all === true
      ? current.content.split(operation.search).join(operation.replace)
      : current.content.replace(operation.search, operation.replace);
  });
  const changedFiles = Array.from(stagedFiles.values())
    .filter((item) => !item.existed || item.content !== item.originalContent)
    .map((item) => ({
      path: item.path,
      absolutePath: item.absolutePath,
      content: item.content,
    }));
  if (!changedFiles.length) {
    throw createHttpError('plugin implementation AI did not produce any effective file changes', {
      statusCode: 502,
      code: 'plugin_source_no_effective_changes',
    });
  }
  return changedFiles;
}

async function runCommand(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd || process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8,
    });
    return {
      ok: true,
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || ''),
    };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error?.stdout || ''),
      stderr: String(error?.stderr || error?.message || ''),
      code: Number.isFinite(Number(error?.code)) ? Number(error.code) : null,
    };
  }
}

async function validateChangedFiles(workspaceRoot, changedFiles, pluginId, options = {}) {
  const nodeBin = String(options.nodeBin || DEFAULT_NODE_BIN).trim() || DEFAULT_NODE_BIN;
  const checks = [];
  const changedRelativePaths = new Set(changedFiles.map((item) => item.path));
  for (const file of changedFiles) {
    if (file.path.endsWith('.js')) {
      const result = await runCommand(nodeBin, ['--check', file.absolutePath], { cwd: workspaceRoot });
      checks.push({
        type: 'node-check',
        path: file.path,
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      if (!result.ok) return { ok: false, checks };
    }
  }
  const smokeTestPath = path.join(workspaceRoot, 'scripts', 'contracts', `test-${pluginId}-plugin-smoke.js`);
  if (fs.existsSync(smokeTestPath) && (changedRelativePaths.has(path.join('assets', 'js', `${pluginId}-runtime.js`)) || changedRelativePaths.has(path.join('scripts', 'contracts', `test-${pluginId}-plugin-smoke.js`)) || changedRelativePaths.has(path.join('assets', 'js', 'local-plugin-workspace-runtime.js')))) {
    const result = await runCommand(nodeBin, [smokeTestPath], { cwd: workspaceRoot });
    checks.push({
      type: 'plugin-smoke',
      path: path.relative(workspaceRoot, smokeTestPath),
      ok: result.ok,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    if (!result.ok) return { ok: false, checks };
  }
  return { ok: true, checks };
}

function syncDistMirrorForWorkspacePath(workspaceRoot, relativePath) {
  const distRoot = path.join(workspaceRoot, DIST_WWW_RELATIVE_PATH);
  if (!fs.existsSync(distRoot)) return null;
  const normalized = String(relativePath || '').trim();
  if (!normalized) return null;
  if (!(normalized === 'morph.html' || normalized.startsWith('assets/') || normalized.startsWith('extensions/'))) {
    return null;
  }
  const sourcePath = ensureWithinRoot(path.join(workspaceRoot, normalized), workspaceRoot);
  const destinationPath = ensureWithinRoot(path.join(distRoot, normalized), distRoot);
  if (!fs.existsSync(sourcePath)) return null;
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  return destinationPath;
}

function snapshotOriginalFiles(changedFiles) {
  return changedFiles.map((item) => ({
    path: item.path,
    absolutePath: item.absolutePath,
    existed: fs.existsSync(item.absolutePath),
    content: fs.existsSync(item.absolutePath) ? readTextFileSafe(item.absolutePath) : '',
  }));
}

function restoreOriginalFiles(snapshots = []) {
  snapshots.forEach((item) => {
    if (item.existed) {
      writeTextFile(item.absolutePath, item.content);
    } else if (fs.existsSync(item.absolutePath)) {
      fs.rmSync(item.absolutePath, { force: true });
    }
  });
}

function summarizeValidationChecks(checks = []) {
  return checks.map((item) => {
    const status = item.ok ? 'ok' : 'failed';
    return `[${status}] ${item.type} ${item.path}\n${String(item.stderr || item.stdout || '').trim()}`.trim();
  }).join('\n\n').trim();
}

function summarizePreparationFailure(error) {
  const message = toSafeText(error?.message, 500) || 'unknown preparation failure';
  const details = error?.details && typeof error.details === 'object'
    ? JSON.stringify(error.details, null, 2)
    : '';
  return details ? `${message}\n${details}` : message;
}

function buildRepairPrompt(basePrompt, previousPayload, validationSummary) {
  return [
    basePrompt,
    '',
    'The previous JSON did not validate. Repair it.',
    '',
    'Previous JSON:',
    JSON.stringify(previousPayload, null, 2),
    '',
    'Validation failures:',
    validationSummary,
    '',
    'Return ONLY a corrected strict JSON object in the same shape.',
  ].join('\n');
}

async function requestAndPrepareChanges(basePrompt, aiConfig, workspaceRoot, allowedPathPolicies, options = {}, previousPayload = null, failureSummary = '') {
  const prompt = previousPayload
    ? buildRepairPrompt(basePrompt, previousPayload, failureSummary)
    : basePrompt;
  const parsed = extractJsonObject(await requestAITextWithProviderFallback(prompt, aiConfig, options));
  const operations = normalizePatchOperations(parsed, workspaceRoot, allowedPathPolicies);
  const changedFiles = applyPatchOperations(workspaceRoot, operations);
  return {
    parsed,
    operations,
    changedFiles,
  };
}

function createMorphPluginSourceWorker(options = {}) {
  const rootDir = path.resolve(String(options.rootDir || '').trim() || '.');

  async function implementExistingPluginSource(request = {}) {
    const workspaceRoot = ensureWithinRoot(path.resolve(String(request.workspaceRoot || rootDir).trim() || rootDir), rootDir);
    const pluginId = normalizePluginId(request.pluginId);
    if (!pluginId) {
      throw createHttpError('pluginId is required for existing plugin implementation', {
        statusCode: 400,
        code: 'missing_plugin_id',
      });
    }
    const requirement = toSafeText(request.requirement, 20000);
    if (!requirement) {
      throw createHttpError('requirement is required for existing plugin implementation', {
        statusCode: 400,
        code: 'missing_requirement',
      });
    }
    const manifestPath = ensureWithinRoot(path.join(workspaceRoot, 'extensions', pluginId, 'manifest.json'), workspaceRoot);
    const manifest = readJsonFileSafe(manifestPath);
    if (!manifest || typeof manifest !== 'object') {
      throw createHttpError('plugin manifest not found for existing plugin implementation', {
        statusCode: 404,
        code: 'plugin_manifest_not_found',
        details: { pluginId, manifestPath },
      });
    }
    const aiConfig = await resolveEffectiveAIConfig(request.aiConfig, options);
    const allowedPathPolicies = buildAllowedPathPolicies(workspaceRoot, pluginId);
    const fileContexts = Array.from(allowedPathPolicies.values()).map((policy) => ({
      ...buildFileContext(workspaceRoot, policy.path),
      owner: policy.owner,
      allowOperations: Array.from(policy.allowOperations),
    }));
    const validationTargets = [
      ...fileContexts.filter((item) => item.path.endsWith('.js')).map((item) => `node --check ${item.path}`),
      `node scripts/contracts/test-${pluginId}-plugin-smoke.js (if present)`,
    ];
    emitImplementationProgress(request.onProgress, {
      stage: 'prepare',
      message: `已加载 ${pluginId} 的当前上下文，准备请求 AI 补源码`,
      percent: 8,
      details: {
        pluginId,
        fileCount: fileContexts.length,
      },
    });
    const basePrompt = buildImplementationPrompt({
      pluginId,
      requirement,
      workspaceRoot,
      manifest,
      fileContexts,
      validationTargets,
    });

    emitImplementationProgress(request.onProgress, {
      stage: 'request_ai',
      message: `正在让 AI 生成 ${pluginId} 的源码变更`,
      percent: 20,
      details: { pluginId, fileCount: fileContexts.length },
    });
    let prepared;
    try {
      prepared = await requestAndPrepareChanges(basePrompt, aiConfig, workspaceRoot, allowedPathPolicies, options);
    } catch (error) {
      prepared = await requestAndPrepareChanges(
        basePrompt,
        aiConfig,
        workspaceRoot,
        allowedPathPolicies,
        options,
        {},
        summarizePreparationFailure(error),
      );
    }
    let parsed = prepared.parsed;
    let changedFiles = prepared.changedFiles;
    let operations = prepared.operations;
    let originalSnapshots = snapshotOriginalFiles(changedFiles);
    try {
      emitImplementationProgress(request.onProgress, {
        stage: 'write_files',
        message: `AI 已返回方案，正在写入 ${changedFiles.length} 个文件`,
        percent: 60,
        details: {
          pluginId,
          changedFiles: changedFiles.map((item) => item.path),
          operationCount: operations.length,
        },
      });
      changedFiles.forEach((item) => writeTextFile(item.absolutePath, item.content));
      emitImplementationProgress(request.onProgress, {
        stage: 'validate',
        message: `正在校验 ${pluginId} 的生成结果`,
        percent: 72,
        details: { pluginId },
      });
      let validation = await validateChangedFiles(workspaceRoot, changedFiles, pluginId, { nodeBin: options.nodeBin });
      if (!validation.ok) {
        restoreOriginalFiles(originalSnapshots);
        emitImplementationProgress(request.onProgress, {
          stage: 'repair',
          message: `${pluginId} 首轮校验未通过，正在请求 AI 修复`,
          percent: 82,
          details: {
            pluginId,
            checks: validation.checks.map((item) => ({ type: item.type, path: item.path, ok: item.ok })),
          },
        });
        parsed = extractJsonObject(await requestAITextWithProviderFallback(
          buildRepairPrompt(basePrompt, parsed, summarizeValidationChecks(validation.checks)),
          aiConfig,
          options,
        ));
        operations = normalizePatchOperations(parsed, workspaceRoot, allowedPathPolicies);
        changedFiles = applyPatchOperations(workspaceRoot, operations);
        originalSnapshots = snapshotOriginalFiles(changedFiles);
        changedFiles.forEach((item) => writeTextFile(item.absolutePath, item.content));
        emitImplementationProgress(request.onProgress, {
          stage: 'revalidate',
          message: `正在复检 ${pluginId} 的修复结果`,
          percent: 90,
          details: { pluginId },
        });
        validation = await validateChangedFiles(workspaceRoot, changedFiles, pluginId, { nodeBin: options.nodeBin });
        if (!validation.ok) {
          restoreOriginalFiles(originalSnapshots);
          throw createHttpError('plugin implementation did not pass validation after repair', {
            statusCode: 502,
            code: 'plugin_source_validation_failed',
            details: {
              checks: validation.checks,
            },
          });
        }
        const syncedDistPaths = changedFiles
          .map((item) => syncDistMirrorForWorkspacePath(workspaceRoot, item.path))
          .filter(Boolean);
        emitImplementationProgress(request.onProgress, {
          stage: 'completed',
          message: `${pluginId} 已完成实现并通过修复校验`,
          percent: 100,
          details: {
            pluginId,
            changedFiles: changedFiles.map((item) => item.path),
            repaired: true,
          },
        });
        return {
          ok: true,
          pluginId,
          summary: toSafeText(parsed?.summary, 400),
          assumptions: Array.isArray(parsed?.assumptions) ? parsed.assumptions.map((item) => toSafeText(item, 400)).filter(Boolean) : [],
          changedFiles: changedFiles.map((item) => ({ path: item.path })),
          operationCount: operations.length,
          validation: validation.checks,
          syncedDistPaths,
          repaired: true,
        };
      }
      const syncedDistPaths = changedFiles
        .map((item) => syncDistMirrorForWorkspacePath(workspaceRoot, item.path))
        .filter(Boolean);
      emitImplementationProgress(request.onProgress, {
        stage: 'completed',
        message: `${pluginId} 已完成实现并通过校验`,
        percent: 100,
        details: {
          pluginId,
          changedFiles: changedFiles.map((item) => item.path),
          repaired: false,
        },
      });
      return {
        ok: true,
        pluginId,
        summary: toSafeText(parsed?.summary, 400),
        assumptions: Array.isArray(parsed?.assumptions) ? parsed.assumptions.map((item) => toSafeText(item, 400)).filter(Boolean) : [],
        changedFiles: changedFiles.map((item) => ({ path: item.path })),
        operationCount: operations.length,
        validation: validation.checks,
        syncedDistPaths,
        repaired: false,
      };
    } catch (error) {
      if (error?.code !== 'plugin_source_validation_failed') {
        restoreOriginalFiles(originalSnapshots);
      }
      throw error;
    }
  }

  return {
    implementExistingPluginSource,
  };
}

module.exports = {
  createMorphPluginSourceWorker,
  requestAITextWithProvider,
  requestAITextWithProviderFallback,
};
