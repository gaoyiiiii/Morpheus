const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { createMorphPluginSourceWorker } = require('./morph-plugin-source-worker');

const execFileAsync = promisify(execFile);

const DEFAULT_SKILL_ROOT = String(process.env.MORPH_PLUGIN_BUILDER_SKILL_ROOT || '').trim()
  || path.join(os.homedir(), '.codex', 'skills', 'morph-plugin-builder');
const DEFAULT_PYTHON_BIN = String(process.env.MORPH_PLUGIN_BUILDER_PYTHON || '').trim() || 'python3';
const USER_LOCAL_EXTENSION_CATALOG_RELATIVE_PATH = path.join('data', 'extensions', 'local-plugin-catalog', 'state.json');
const OFFICIAL_EXTENSION_CATALOG_PATH = path.join('extensions', 'manifest.json');
const LOCAL_EXTENSION_MARKETPLACE_CATALOG_PATH = path.join('extensions', 'local-manifest.json');
const PLUGIN_BUILDER_JOB_TTL_MS = Math.max(60 * 1000, Number(process.env.MORPH_PLUGIN_BUILDER_JOB_TTL_MS) || 30 * 60 * 1000);

function toSafeText(value, maxLen = 4000) {
  return String(value || '').trim().slice(0, maxLen);
}

function toSafeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function cloneJson(value) {
  try {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value == null ? value : null;
  }
}

function readIsolatedLiveDataSnapshot(readCurrentLiveData) {
  if (typeof readCurrentLiveData !== 'function') return null;
  let snapshot = null;
  try {
    snapshot = readCurrentLiveData({ clone: true });
  } catch (_) {
    snapshot = null;
  }
  if (snapshot == null) {
    try {
      snapshot = readCurrentLiveData();
    } catch (_) {
      snapshot = null;
    }
  }
  return cloneJson(snapshot);
}

function readJsonFileSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function writeJsonFilePretty(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

function createJobId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `plugin_job_${globalThis.crypto.randomUUID()}`;
  }
  return `plugin_job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildPluginJobFingerprint({ kind = '', pluginId = '', requirement = '', requestBody = null } = {}) {
  const normalizedKind = toSafeText(kind, 80);
  const normalizedPluginId = normalizePluginId(pluginId);
  const normalizedRequirement = toSafeText(requirement, 4000);
  const safeBody = requestBody && typeof requestBody === 'object' ? cloneJson(requestBody) : null;
  const payload = {
    kind: normalizedKind,
    pluginId: normalizedPluginId,
    requirement: normalizedRequirement,
    requestBody: safeBody,
  };
  return JSON.stringify(payload);
}

function normalizeCatalogPayload(value = null) {
  const source = value && typeof value === 'object' ? value : {};
  const entries = Array.isArray(source.extensions) ? source.extensions : [];
  const merged = new Map();
  entries.forEach((entry) => {
    const item = entry && typeof entry === 'object' ? entry : null;
    const id = normalizePluginId(item?.id);
    if (!id) return;
    if (merged.has(id)) merged.delete(id);
    merged.set(id, {
      ...item,
      id,
      defaultEnabled: false,
    });
  });
  return {
    version: Math.max(Number.isFinite(Number(source.version)) ? Number(source.version) : 2, 2),
    updatedAt: toSafeText(source.updatedAt, 80),
    extensions: Array.from(merged.values()),
  };
}

function ensureWithinRoot(resolvedPath, rootDir) {
  const target = path.resolve(String(resolvedPath || '').trim() || '.');
  const root = path.resolve(String(rootDir || '').trim() || '.');
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw createHttpError('workspace root must stay within the Morpheus workspace', {
      statusCode: 400,
      code: 'workspace_out_of_bounds',
      details: { target, root },
    });
  }
  return target;
}

function resolveWorkspaceRoot(requestedRoot, rootDir) {
  if (!toSafeText(rootDir, 1200)) {
    throw createHttpError('server root is not configured', {
      statusCode: 500,
      code: 'workspace_root_unavailable',
    });
  }
  const fallback = path.resolve(rootDir);
  const requested = toSafeText(requestedRoot, 1200);
  if (!requested) return fallback;
  const resolved = path.resolve(requested);
  if (resolved !== fallback) {
    throw createHttpError('native plugin builder currently supports only the active Morpheus workspace root', {
      statusCode: 400,
      code: 'unsupported_workspace_root',
      details: { requested: resolved, expected: fallback },
    });
  }
  return resolved;
}

function resolveSkillScriptPaths(skillRoot) {
  const resolvedRoot = path.resolve(String(skillRoot || DEFAULT_SKILL_ROOT).trim() || DEFAULT_SKILL_ROOT);
  return {
    skillRoot: resolvedRoot,
    buildWorkpacket: path.join(resolvedRoot, 'scripts', 'build_morph_plugin_workpacket.py'),
    createFromRequirement: path.join(resolvedRoot, 'scripts', 'create_morph_plugin_from_requirement.py'),
  };
}

function getMorphPluginBuilderSkillStatus(options = {}) {
  const scriptPaths = resolveSkillScriptPaths(options.skillRoot);
  const scripts = {
    buildWorkpacket: fs.existsSync(scriptPaths.buildWorkpacket),
    createFromRequirement: fs.existsSync(scriptPaths.createFromRequirement),
  };
  return {
    available: Object.values(scripts).every(Boolean),
    skillRoot: scriptPaths.skillRoot,
    scripts,
  };
}

async function execPythonScript(pythonBin, scriptPath, args = []) {
  try {
    const result = await execFileAsync(pythonBin, [scriptPath].concat(args), {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8,
      cwd: path.dirname(scriptPath),
    });
    return {
      ok: true,
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || ''),
    };
  } catch (error) {
    throw createHttpError(`plugin builder script failed: ${path.basename(scriptPath)}`, {
      statusCode: 502,
      code: 'plugin_builder_script_failed',
      details: {
        scriptPath,
        stdout: String(error?.stdout || ''),
        stderr: String(error?.stderr || ''),
        exitCode: Number.isFinite(Number(error?.code)) ? Number(error.code) : undefined,
      },
    });
  }
}

function buildCapabilitiesPayload(options = {}) {
  const rootDir = path.resolve(String(options.rootDir || '').trim() || '.');
  const skillStatus = getMorphPluginBuilderSkillStatus({ skillRoot: options.skillRoot });
  return {
    ok: true,
    domain: 'morph',
    type: 'plugin-builder',
    fetchedAt: new Date().toISOString(),
    available: skillStatus.available,
    workspaceRoot: rootDir,
    implementation: {
      mode: 'native-local-worker',
      dependsOnCodexRemote: false,
      dependsOnCodexCompatApi: false,
      supportsCreateWorkpacket: true,
      supportsCreateScaffold: true,
      supportsInstallGeneratedPlugin: true,
      supportsCreateAndInstall: true,
      supportsExistingPluginImplementation: true,
      supportsAsyncJobs: true,
      supportsJobRetry: true,
      supportsIdempotentAsyncStart: true,
      supportsWorkspaceCodeMutation: true,
      skillRoot: skillStatus.skillRoot,
      pythonBin: String(options.pythonBin || DEFAULT_PYTHON_BIN).trim() || DEFAULT_PYTHON_BIN,
    },
    scripts: skillStatus.scripts,
    workflow: [
      'chat requirement',
      'build work packet',
      'scaffold plugin files into workspace',
      'register plugin manifest into local marketplace catalog',
      'install plugin into user local plugin catalog',
      'optionally persist enabled state into Morpheus synced preferences',
    ],
    endpoints: [
      { method: 'GET', path: '/api/morph/plugin-builder/capabilities' },
      { method: 'POST', path: '/api/morph/plugin-builder/workpacket' },
      { method: 'POST', path: '/api/morph/plugin-builder/create' },
      { method: 'POST', path: '/api/morph/plugin-builder/install' },
      { method: 'POST', path: '/api/morph/plugin-builder/create-and-install' },
      { method: 'POST', path: '/api/morph/plugin-builder/implement-existing' },
      { method: 'GET', path: '/api/morph/plugin-builder/jobs/:jobId' },
      { method: 'POST', path: '/api/morph/plugin-builder/jobs/:jobId/retry' },
    ],
    constraints: [
      'native generation currently targets the active writable Morpheus workspace only',
      'desktop or server-backed Morpheus is supported; pure iOS app bundle cannot grow source plugins locally',
      'plugin files are created in extensions/<pluginId>/ and installed into data/extensions/local-plugin-catalog/state.json',
      'existing-plugin implementation is constrained to a small plugin allowlist plus minimal host glue files',
      'AI source edits use a controlled patch protocol: plugin-owned files may upsert, host glue files are search_replace only',
    ],
  };
}

async function readJsonBody(req, readRequestBody) {
  const raw = await readRequestBody(req);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    throw createHttpError('request body must be valid JSON', {
      statusCode: 400,
      code: 'invalid_json',
    });
  }
}

function readReservedOfficialIds(workspaceRoot) {
  const payload = readJsonFileSafe(path.join(workspaceRoot, OFFICIAL_EXTENSION_CATALOG_PATH));
  const entries = Array.isArray(payload?.extensions) ? payload.extensions : [];
  return new Set(entries.map((entry) => normalizePluginId(entry?.id)).filter(Boolean));
}

function readManifestForPlugin(workspaceRoot, pluginId) {
  const id = normalizePluginId(pluginId);
  if (!id) {
    throw createHttpError('pluginId is required', {
      statusCode: 400,
      code: 'missing_plugin_id',
    });
  }
  const manifestPath = ensureWithinRoot(path.join(workspaceRoot, 'extensions', id, 'manifest.json'), workspaceRoot);
  const manifest = readJsonFileSafe(manifestPath);
  if (!manifest || typeof manifest !== 'object') {
    throw createHttpError('generated plugin manifest not found', {
      statusCode: 404,
      code: 'plugin_manifest_not_found',
      details: { manifestPath, pluginId: id },
    });
  }
  return { pluginId: id, manifestPath, manifest };
}

function mergeInstalledPluginIntoCatalog(workspaceRoot, manifest, options = {}) {
  const pluginId = normalizePluginId(manifest?.id);
  if (!pluginId) {
    throw createHttpError('generated plugin manifest must include a valid id', {
      statusCode: 400,
      code: 'invalid_plugin_manifest',
    });
  }
  const allowUpdate = options.allowUpdate !== false;
  const officialIds = readReservedOfficialIds(workspaceRoot);
  const catalogPath = path.join(workspaceRoot, USER_LOCAL_EXTENSION_CATALOG_RELATIVE_PATH);
  const current = normalizeCatalogPayload(readJsonFileSafe(catalogPath));
  const nextMap = new Map();
  current.extensions.forEach((entry) => {
    nextMap.set(normalizePluginId(entry?.id), entry);
  });
  if (officialIds.has(pluginId) && !nextMap.has(pluginId)) {
    throw createHttpError('plugin id collides with a reserved official plugin id', {
      statusCode: 409,
      code: 'reserved_plugin_id',
      details: { pluginId },
    });
  }
  if (!allowUpdate && nextMap.has(pluginId)) {
    throw createHttpError('plugin is already installed in the local plugin catalog', {
      statusCode: 409,
      code: 'plugin_already_installed',
      details: { pluginId },
    });
  }
  nextMap.set(pluginId, {
    ...cloneJson(manifest),
    id: pluginId,
    defaultEnabled: false,
  });
  const nextCatalog = {
    version: Math.max(Number(current.version || 2), 2),
    updatedAt: new Date().toISOString(),
    extensions: Array.from(nextMap.values()),
  };
  writeJsonFilePretty(catalogPath, nextCatalog);
  return {
    catalogPath,
    catalog: nextCatalog,
    installedPlugin: nextMap.get(pluginId),
  };
}

function ensureExtensionPreferenceState(data = null) {
  const next = cloneJson(data) || {};
  if (!next.morphRuntime || typeof next.morphRuntime !== 'object') next.morphRuntime = {};
  if (!next.morphRuntime.userPreferences || typeof next.morphRuntime.userPreferences !== 'object') {
    next.morphRuntime.userPreferences = {};
  }
  if (!next.morphRuntime.userPreferences.extensionsState || typeof next.morphRuntime.userPreferences.extensionsState !== 'object') {
    next.morphRuntime.userPreferences.extensionsState = {};
  }
  return next;
}

function persistInstalledPluginEnabledState(options = {}) {
  if (options.enableAfterInstall !== true) {
    return {
      applied: false,
      enabled: false,
    };
  }
  const pluginId = normalizePluginId(options.pluginId);
  if (!pluginId) {
    throw createHttpError('pluginId is required to persist enabled state', {
      statusCode: 400,
      code: 'missing_plugin_id',
    });
  }
  const currentData = readIsolatedLiveDataSnapshot(options.readCurrentLiveData);
  const nextData = ensureExtensionPreferenceState(
    currentData || (typeof options.normalizeData === 'function' ? options.normalizeData({}) : {})
  );
  nextData.morphRuntime.userPreferences.extensionsState[pluginId] = true;
  if (typeof options.commitMorphWrite === 'function') {
    const committed = options.commitMorphWrite(nextData, {
      source: 'api/morph/plugin-builder/install',
      receipt: {
        status: 'committed',
        source: 'morph-plugin-builder',
        reason: 'plugin_enabled_after_install',
        message: `plugin ${pluginId} 已写入用户偏好并启用`,
        action: 'enable_plugin_after_install',
        pluginId,
      },
    });
    return {
      applied: true,
      enabled: true,
      updatedAt: committed?.savedAt || new Date().toISOString(),
      writeReceipt: committed?.writeReceipt || null,
    };
  }
  if (typeof options.persistMorphData === 'function') {
    const persisted = options.persistMorphData(nextData, 'api/morph/plugin-builder/install');
    return {
      applied: true,
      enabled: true,
      updatedAt: new Date().toISOString(),
      writeReceipt: {
        ok: true,
        type: 'canonical_write',
        pipeline: 'morph-canonical-write',
        status: 'committed',
        source: 'api/morph/plugin-builder/install',
        reason: 'plugin_enabled_after_install',
        pluginId,
        snapshot: persisted?.snapshot || null,
        mirror: persisted?.mirror || null,
      },
    };
  }
  return {
    applied: false,
    enabled: false,
    warning: 'live_data_store_unavailable',
  };
}

function createMorphPluginBuilderApi(deps = {}) {
  const rootDir = path.resolve(String(deps.rootDir || '').trim() || '.');
  const pythonBin = String(deps.pythonBin || DEFAULT_PYTHON_BIN).trim() || DEFAULT_PYTHON_BIN;
  const skillRoot = String(deps.skillRoot || DEFAULT_SKILL_ROOT).trim() || DEFAULT_SKILL_ROOT;
  const scriptPaths = resolveSkillScriptPaths(skillRoot);
  const pluginSourceWorker = createMorphPluginSourceWorker({
    rootDir,
    requestAIText: typeof deps.requestAIText === 'function' ? deps.requestAIText : null,
    fetchImpl: typeof deps.fetchImpl === 'function' ? deps.fetchImpl : null,
    nodeBin: typeof deps.nodeBin === 'string' ? deps.nodeBin : undefined,
  });
  const pluginJobs = new Map();
  const pluginJobsByFingerprint = new Map();

  function prunePluginJobs(now = Date.now()) {
    pluginJobs.forEach((job, jobId) => {
      const finishedAt = Number(job?.finishedAtMs || 0);
      if (!finishedAt) return;
      if ((now - finishedAt) > PLUGIN_BUILDER_JOB_TTL_MS) {
        if (job?.fingerprint && pluginJobsByFingerprint.get(job.fingerprint) === jobId) {
          pluginJobsByFingerprint.delete(job.fingerprint);
        }
        pluginJobs.delete(jobId);
      }
    });
  }

  function buildPluginJobPayload(job = null) {
    const source = job && typeof job === 'object' ? job : {};
    return {
      id: toSafeText(source.id, 160),
      kind: toSafeText(source.kind, 80),
      status: ['queued', 'running', 'completed', 'failed'].includes(String(source.status || '').trim())
        ? String(source.status || '').trim()
        : 'queued',
      pluginId: toSafeText(source.pluginId, 160),
      createdAt: toSafeText(source.createdAt, 80),
      updatedAt: toSafeText(source.updatedAt, 80),
      startedAt: toSafeText(source.startedAt, 80),
      finishedAt: toSafeText(source.finishedAt, 80),
      progress: {
        stage: toSafeText(source.progress?.stage, 80) || 'queued',
        message: toSafeText(source.progress?.message, 240) || '已加入队列',
        percent: Math.max(0, Math.min(100, Number(source.progress?.percent) || 0)),
        details: source.progress?.details && typeof source.progress.details === 'object'
          ? cloneJson(source.progress.details)
          : undefined,
      },
      result: source.status === 'completed' && source.result && typeof source.result === 'object'
        ? cloneJson(source.result)
        : null,
      error: source.status === 'failed' && source.error && typeof source.error === 'object'
        ? cloneJson(source.error)
        : null,
      attempt: Math.max(1, Number(source.attempt) || 1),
      retriedFromJobId: toSafeText(source.retriedFromJobId, 160),
    };
  }

  function getPluginJob(jobId) {
    prunePluginJobs();
    const normalizedJobId = toSafeText(jobId, 200);
    if (!normalizedJobId) return null;
    return pluginJobs.get(normalizedJobId) || null;
  }

  function findReusablePluginJob(fingerprint = '') {
    const normalizedFingerprint = toSafeText(fingerprint, 8000);
    if (!normalizedFingerprint) return null;
    const jobId = pluginJobsByFingerprint.get(normalizedFingerprint);
    if (!jobId) return null;
    const job = getPluginJob(jobId);
    if (!job) {
      pluginJobsByFingerprint.delete(normalizedFingerprint);
      return null;
    }
    if (!['queued', 'running', 'completed'].includes(String(job.status || '').trim())) return null;
    return buildPluginJobPayload(job);
  }

  function createPluginJob({ kind = '', pluginId = '', requirement = '', fingerprint = '', retryInput = null, attempt = 1, retriedFromJobId = '', executor = null } = {}) {
    prunePluginJobs();
    const reusableJob = findReusablePluginJob(fingerprint);
    if (reusableJob) {
      return {
        job: reusableJob,
        reusedExisting: true,
      };
    }
    const nowIso = new Date().toISOString();
    const job = {
      id: createJobId(),
      kind: toSafeText(kind, 80) || 'workflow',
      status: 'queued',
      pluginId: normalizePluginId(pluginId),
      requirement: toSafeText(requirement, 1200),
      createdAt: nowIso,
      updatedAt: nowIso,
      startedAt: '',
      finishedAt: '',
      finishedAtMs: 0,
      fingerprint: toSafeText(fingerprint, 8000),
      retryInput: retryInput && typeof retryInput === 'object' ? cloneJson(retryInput) : null,
      attempt: Math.max(1, Number(attempt) || 1),
      retriedFromJobId: toSafeText(retriedFromJobId, 160),
      progress: {
        stage: 'queued',
        message: '已加入生成队列',
        percent: 0,
      },
      result: null,
      error: null,
    };
    pluginJobs.set(job.id, job);
    if (job.fingerprint) pluginJobsByFingerprint.set(job.fingerprint, job.id);

    const reportProgress = (payload = {}) => {
      const updatedAt = new Date().toISOString();
      job.updatedAt = updatedAt;
      if (job.status === 'queued') {
        job.status = 'running';
        job.startedAt = updatedAt;
      }
      job.progress = {
        stage: toSafeText(payload.stage, 80) || job.progress.stage || 'running',
        message: toSafeText(payload.message, 240) || job.progress.message || '处理中',
        percent: Math.max(0, Math.min(100, Number(payload.percent) || 0)),
        details: payload.details && typeof payload.details === 'object' ? cloneJson(payload.details) : undefined,
      };
    };

    Promise.resolve().then(async () => {
      reportProgress({ stage: 'running', message: '任务已开始', percent: 2 });
      try {
        const result = await (typeof executor === 'function' ? executor({ reportProgress, jobId: job.id }) : null);
        const finishedAt = new Date().toISOString();
        job.status = 'completed';
        job.updatedAt = finishedAt;
        job.finishedAt = finishedAt;
        job.finishedAtMs = Date.now();
        job.progress = {
          stage: 'completed',
          message: toSafeText(job.progress?.message, 240) || '任务完成',
          percent: 100,
          details: job.progress?.details && typeof job.progress.details === 'object' ? cloneJson(job.progress.details) : undefined,
        };
        job.result = result && typeof result === 'object' ? cloneJson(result) : result;
        job.error = null;
      } catch (error) {
        const finishedAt = new Date().toISOString();
        job.status = 'failed';
        job.updatedAt = finishedAt;
        job.finishedAt = finishedAt;
        job.finishedAtMs = Date.now();
        job.error = {
          code: toSafeText(error?.code, 120) || 'plugin_builder_job_failed',
          message: toSafeText(error?.message, 500) || 'plugin builder job failed',
          statusCode: Number.isFinite(Number(error?.statusCode)) ? Number(error.statusCode) : 500,
          details: error?.details && typeof error.details === 'object' ? cloneJson(error.details) : undefined,
        };
        job.progress = {
          stage: 'failed',
          message: toSafeText(error?.message, 240) || '任务失败',
          percent: Math.max(1, Math.min(99, Number(job.progress?.percent) || 0)),
          details: job.error?.details,
        };
        job.result = null;
      } finally {
        prunePluginJobs();
      }
    });

    return {
      job: buildPluginJobPayload(job),
      reusedExisting: false,
    };
  }

  function queueCreateAndInstallJob(body = {}, context = {}, options = {}) {
    const fingerprint = buildPluginJobFingerprint({
      kind: 'create-and-install',
      requirement: body.requirement,
      requestBody: {
        requirement: toSafeText(body.requirement, 8000),
        source: toSafeText(body.source, 40),
        owner: toSafeText(body.owner, 160),
        catalog: toSafeText(body.catalog, 40),
        dryRun: body.dryRun === true,
        withRuntime: body.withRuntime !== false,
        withTests: body.withTests !== false,
        overwrite: body.overwrite === true,
        enableAfterInstall: body.enableAfterInstall === true,
      },
    });
    return createPluginJob({
      kind: 'create-and-install',
      requirement: body.requirement,
      fingerprint,
      retryInput: {
        route: 'create-and-install',
        body: cloneJson(body),
      },
      attempt: options.attempt,
      retriedFromJobId: options.retriedFromJobId,
      executor: async ({ reportProgress }) => {
        reportProgress({ stage: 'workpacket', message: '正在生成插件工作包', percent: 8 });
        const workpacket = await buildPluginWorkPacket(body);
        const pluginId = normalizePluginId(workpacket?.packet?.plugin_spec?.plugin_id);
        reportProgress({ stage: 'scaffold', message: `正在脚手架化 ${pluginId || '新插件'}`, percent: 34, details: { pluginId } });
        const created = await createPluginFromRequirement({
          ...body,
          workpacketResult: workpacket,
        });
        if (body.dryRun === true) {
          reportProgress({ stage: 'completed', message: `${created.pluginId || pluginId || '插件'} dry-run 已完成`, percent: 100, details: { pluginId: created.pluginId || pluginId, dryRun: true } });
          return {
            workpacket: workpacket.packet,
            created,
            installed: null,
          };
        }
        reportProgress({ stage: 'install', message: `正在安装 ${created.pluginId || pluginId || '新插件'}`, percent: 72, details: { pluginId: created.pluginId || pluginId } });
        const installed = await installGeneratedPlugin({
          workspaceRoot: body.workspaceRoot,
          pluginId: created.pluginId,
          allowUpdate: body.allowUpdate !== false,
          enableAfterInstall: body.enableAfterInstall === true,
          readCurrentLiveData: context.readCurrentLiveData,
          normalizeData: context.normalizeData,
          persistMorphData: context.persistMorphData,
          commitMorphWrite: context.commitMorphWrite,
        });
        reportProgress({ stage: 'completed', message: `${created.pluginId || pluginId || '插件'} 已创建并安装`, percent: 100, details: { pluginId: created.pluginId || pluginId } });
        return {
          workpacket: workpacket.packet,
          created,
          installed,
        };
      },
    });
  }

  function queueImplementExistingJob(body = {}, options = {}) {
    const asyncPluginId = normalizePluginId(body.pluginId);
    const fingerprint = buildPluginJobFingerprint({
      kind: 'implement-existing',
      pluginId: asyncPluginId,
      requirement: body.requirement,
      requestBody: {
        pluginId: asyncPluginId,
        requirement: toSafeText(body.requirement, 8000),
      },
    });
    return createPluginJob({
      kind: 'implement-existing',
      pluginId: asyncPluginId,
      requirement: body.requirement,
      fingerprint,
      retryInput: {
        route: 'implement-existing',
        body: cloneJson(body),
      },
      attempt: options.attempt,
      retriedFromJobId: options.retriedFromJobId,
      executor: async ({ reportProgress }) => implementExistingPluginSource({
        ...body,
        pluginId: asyncPluginId,
        onProgress: reportProgress,
      }),
    });
  }

  function retryPluginJob(job, context = {}) {
    const source = job && typeof job === 'object' ? job : null;
    if (!source) {
      throw createHttpError('plugin builder job not found', {
        statusCode: 404,
        code: 'plugin_builder_job_not_found',
      });
    }
    if (String(source.status || '').trim() !== 'failed') {
      throw createHttpError('only failed plugin builder jobs can be retried', {
        statusCode: 409,
        code: 'plugin_builder_job_not_retryable',
      });
    }
    const retryInput = source.retryInput && typeof source.retryInput === 'object' ? source.retryInput : null;
    if (!retryInput?.route || !retryInput?.body || typeof retryInput.body !== 'object') {
      throw createHttpError('plugin builder job is missing retry input', {
        statusCode: 409,
        code: 'plugin_builder_job_retry_unavailable',
      });
    }
    const nextAttempt = Math.max(1, Number(source.attempt) || 1) + 1;
    if (retryInput.route === 'create-and-install') {
      return queueCreateAndInstallJob(retryInput.body, context, {
        attempt: nextAttempt,
        retriedFromJobId: source.id,
      });
    }
    if (retryInput.route === 'implement-existing') {
      return queueImplementExistingJob(retryInput.body, {
        attempt: nextAttempt,
        retriedFromJobId: source.id,
      });
    }
    throw createHttpError('plugin builder retry route is unsupported', {
      statusCode: 409,
      code: 'plugin_builder_job_retry_unavailable',
    });
  }

  function assertSkillAvailable() {
    const status = getMorphPluginBuilderSkillStatus({ skillRoot });
    if (!status.available) {
      throw createHttpError('native Morpheus plugin builder skill is not available on this machine', {
        statusCode: 503,
        code: 'plugin_builder_unavailable',
        details: status,
      });
    }
    return status;
  }

  async function buildPluginWorkPacket(options = {}) {
    assertSkillAvailable();
    const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot, rootDir);
    const requirement = toSafeText(options.requirement, 8000);
    if (!requirement) {
      throw createHttpError('requirement is required', {
        statusCode: 400,
        code: 'missing_requirement',
      });
    }
    const source = toSafeText(options.source, 40) || 'local';
    const owner = toSafeText(options.owner, 160);
    const args = [
      '--workspace-root',
      workspaceRoot,
      '--requirement',
      requirement,
      '--source',
      source,
    ];
    if (owner) args.push('--owner', owner);
    const result = await execPythonScript(pythonBin, scriptPaths.buildWorkpacket, args);
    let packet = null;
    try {
      packet = JSON.parse(result.stdout);
    } catch (_) {
      throw createHttpError('plugin builder work packet returned invalid JSON', {
        statusCode: 502,
        code: 'invalid_workpacket_json',
        details: {
          stdout: result.stdout,
          stderr: result.stderr,
        },
      });
    }
    return {
      packet,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  async function createPluginFromRequirement(options = {}) {
    const workpacketResult = options.workpacketResult && typeof options.workpacketResult === 'object'
      ? options.workpacketResult
      : await buildPluginWorkPacket(options);
    const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot, rootDir);
    const requirement = toSafeText(options.requirement, 8000);
    const source = toSafeText(options.source, 40) || 'local';
    const owner = toSafeText(options.owner, 160);
    const catalog = toSafeText(options.catalog, 40) || 'auto';
    const args = [
      '--workspace-root',
      workspaceRoot,
      '--requirement',
      requirement,
      '--source',
      source,
      '--catalog',
      catalog,
    ];
    if (owner) args.push('--owner', owner);
    if (options.withRuntime !== false) args.push('--with-runtime');
    if (options.withTests !== false) args.push('--with-tests');
    if (options.overwrite === true) args.push('--overwrite');
    if (options.dryRun === true) args.push('--dry-run');
    const result = await execPythonScript(pythonBin, scriptPaths.createFromRequirement, args);
    const pluginId = normalizePluginId(workpacketResult?.packet?.plugin_spec?.plugin_id);
    const manifestInfo = options.dryRun === true ? null : readManifestForPlugin(workspaceRoot, pluginId);
    return {
      pluginId,
      workspaceRoot,
      manifestPath: manifestInfo?.manifestPath || path.join(workspaceRoot, 'extensions', pluginId, 'manifest.json'),
      manifest: manifestInfo?.manifest || null,
      marketplaceCatalogPath: path.join(workspaceRoot, LOCAL_EXTENSION_MARKETPLACE_CATALOG_PATH),
      stdout: result.stdout,
      stderr: result.stderr,
      dryRun: options.dryRun === true,
      workpacket: workpacketResult.packet,
    };
  }

  async function installGeneratedPlugin(options = {}) {
    const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot, rootDir);
    const manifestInfo = readManifestForPlugin(workspaceRoot, options.pluginId);
    const catalogResult = mergeInstalledPluginIntoCatalog(workspaceRoot, manifestInfo.manifest, {
      allowUpdate: options.allowUpdate !== false,
    });
    const enabledState = persistInstalledPluginEnabledState({
      pluginId: manifestInfo.pluginId,
      enableAfterInstall: options.enableAfterInstall === true,
      readCurrentLiveData: options.readCurrentLiveData,
      normalizeData: options.normalizeData,
      persistMorphData: options.persistMorphData,
      commitMorphWrite: options.commitMorphWrite,
    });
    return {
      pluginId: manifestInfo.pluginId,
      manifestPath: manifestInfo.manifestPath,
      catalogPath: catalogResult.catalogPath,
      installedPlugin: catalogResult.installedPlugin,
      catalog: catalogResult.catalog,
      enabledState,
    };
  }

  async function createAndInstallFromRequirement(options = {}) {
    const workpacketResult = await buildPluginWorkPacket(options);
    const created = await createPluginFromRequirement({
      ...options,
      workpacketResult,
    });
    if (options.dryRun === true) {
      return {
        workpacket: workpacketResult.packet,
        created,
        installed: null,
      };
    }
    const installed = await installGeneratedPlugin({
      workspaceRoot: options.workspaceRoot,
      pluginId: created.pluginId,
      allowUpdate: options.allowUpdate !== false,
      enableAfterInstall: options.enableAfterInstall === true,
      readCurrentLiveData: options.readCurrentLiveData,
      normalizeData: options.normalizeData,
      persistMorphData: options.persistMorphData,
      commitMorphWrite: options.commitMorphWrite,
    });
    return {
      workpacket: workpacketResult.packet,
      created,
      installed,
    };
  }

  async function implementExistingPluginSource(options = {}) {
    return pluginSourceWorker.implementExistingPluginSource({
      ...options,
      workspaceRoot: resolveWorkspaceRoot(options.workspaceRoot, rootDir),
    });
  }

  async function handleMorphPluginBuilderApiRequest(req, res, context = {}) {
    const url = toSafeText(context.url, 240);
    const sendJson = typeof context.sendJson === 'function' ? context.sendJson : null;
    const readRequestBody = typeof context.readRequestBody === 'function' ? context.readRequestBody : null;
    if (!sendJson || !readRequestBody) {
      throw new Error('morph plugin builder api requires sendJson and readRequestBody');
    }

    if (req.method === 'GET' && url === '/api/morph/plugin-builder/capabilities') {
      sendJson(res, 200, buildCapabilitiesPayload({
        rootDir,
        pythonBin,
        skillRoot,
      }));
      return true;
    }

    const pluginJobMatch = req.method === 'GET'
      ? String(url || '').match(/^\/api\/morph\/plugin-builder\/jobs\/([^/?#]+)$/)
      : null;
    if (pluginJobMatch) {
      const job = getPluginJob(pluginJobMatch[1]);
      if (!job) {
        sendJson(res, 404, {
          ok: false,
          errorCode: 'plugin_builder_job_not_found',
          error: 'plugin builder job not found',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        domain: 'morph',
        type: 'plugin-builder-job',
        job,
      });
      return true;
    }

    const retryPluginJobMatch = req.method === 'POST'
      ? String(url || '').match(/^\/api\/morph\/plugin-builder\/jobs\/([^/?#]+)\/retry$/)
      : null;
    if (retryPluginJobMatch) {
      try {
        const sourceJob = getPluginJob(retryPluginJobMatch[1]);
        const queued = retryPluginJob(sourceJob, context);
        sendJson(res, 202, {
          ok: true,
          domain: 'morph',
          type: 'plugin-builder-job-retry',
          async: true,
          reusedExisting: queued.reusedExisting === true,
          job: queued.job,
        });
      } catch (error) {
        sendJson(res, Number(error?.statusCode || 400), {
          ok: false,
          errorCode: error?.code || 'plugin_builder_job_retry_failed',
          error: error?.message || 'failed to retry plugin builder job',
          details: error?.details,
        });
      }
      return true;
    }

    if (req.method === 'POST' && url === '/api/morph/plugin-builder/workpacket') {
      try {
        const body = await readJsonBody(req, readRequestBody);
        const result = await buildPluginWorkPacket(body);
        sendJson(res, 200, {
          ok: true,
          domain: 'morph',
          type: 'plugin-builder-workpacket',
          workpacket: result.packet,
        });
      } catch (error) {
        sendJson(res, Number(error?.statusCode || 400), {
          ok: false,
          errorCode: error?.code || 'plugin_builder_workpacket_failed',
          error: error?.message || 'failed to build plugin work packet',
          details: error?.details,
        });
      }
      return true;
    }

    if (req.method === 'POST' && url === '/api/morph/plugin-builder/create') {
      try {
        const body = await readJsonBody(req, readRequestBody);
        const result = await createPluginFromRequirement(body);
        sendJson(res, 200, {
          ok: true,
          domain: 'morph',
          type: 'plugin-builder-create',
          pluginId: result.pluginId,
          workspaceRoot: result.workspaceRoot,
          manifestPath: result.manifestPath,
          marketplaceCatalogPath: result.marketplaceCatalogPath,
          dryRun: result.dryRun,
          manifest: result.manifest,
          workpacket: result.workpacket,
          stdout: result.stdout,
          stderr: result.stderr,
        });
      } catch (error) {
        sendJson(res, Number(error?.statusCode || 400), {
          ok: false,
          errorCode: error?.code || 'plugin_builder_create_failed',
          error: error?.message || 'failed to create plugin from requirement',
          details: error?.details,
        });
      }
      return true;
    }

    if (req.method === 'POST' && url === '/api/morph/plugin-builder/install') {
      try {
        const body = await readJsonBody(req, readRequestBody);
        const result = await installGeneratedPlugin({
          ...body,
          readCurrentLiveData: context.readCurrentLiveData,
          normalizeData: context.normalizeData,
          persistMorphData: context.persistMorphData,
          commitMorphWrite: context.commitMorphWrite,
        });
        sendJson(res, 200, {
          ok: true,
          domain: 'morph',
          type: 'plugin-builder-install',
          pluginId: result.pluginId,
          manifestPath: result.manifestPath,
          catalogPath: result.catalogPath,
          installedPlugin: result.installedPlugin,
          catalog: result.catalog,
          enabledState: result.enabledState,
        });
      } catch (error) {
        sendJson(res, Number(error?.statusCode || 400), {
          ok: false,
          errorCode: error?.code || 'plugin_builder_install_failed',
          error: error?.message || 'failed to install generated plugin',
          details: error?.details,
        });
      }
      return true;
    }

    if (req.method === 'POST' && url === '/api/morph/plugin-builder/create-and-install') {
      try {
        const body = await readJsonBody(req, readRequestBody);
        if (body.async === true) {
          const queued = queueCreateAndInstallJob(body, context);
          sendJson(res, 202, {
            ok: true,
            domain: 'morph',
            type: 'plugin-builder-create-and-install-job',
            async: true,
            reusedExisting: queued.reusedExisting === true,
            job: queued.job,
          });
          return true;
        }
        const result = await createAndInstallFromRequirement({
          ...body,
          readCurrentLiveData: context.readCurrentLiveData,
          normalizeData: context.normalizeData,
          persistMorphData: context.persistMorphData,
          commitMorphWrite: context.commitMorphWrite,
        });
        sendJson(res, 200, {
          ok: true,
          domain: 'morph',
          type: 'plugin-builder-create-and-install',
          workpacket: result.workpacket,
          created: result.created,
          installed: result.installed,
        });
      } catch (error) {
        sendJson(res, Number(error?.statusCode || 400), {
          ok: false,
          errorCode: error?.code || 'plugin_builder_create_and_install_failed',
          error: error?.message || 'failed to create and install plugin',
          details: error?.details,
        });
      }
      return true;
    }

    if (req.method === 'POST' && url === '/api/morph/plugin-builder/implement-existing') {
      try {
        const body = await readJsonBody(req, readRequestBody);
        if (body.async === true) {
          const queued = queueImplementExistingJob(body);
          sendJson(res, 202, {
            ok: true,
            domain: 'morph',
            type: 'plugin-builder-implement-existing-job',
            async: true,
            reusedExisting: queued.reusedExisting === true,
            job: queued.job,
          });
          return true;
        }
        const result = await implementExistingPluginSource(body);
        sendJson(res, 200, {
          ok: true,
          domain: 'morph',
          type: 'plugin-builder-implement-existing',
          implementation: result,
        });
      } catch (error) {
        sendJson(res, Number(error?.statusCode || 400), {
          ok: false,
          errorCode: error?.code || 'plugin_builder_implement_existing_failed',
          error: error?.message || 'failed to implement existing plugin source',
          details: error?.details,
        });
      }
      return true;
    }

    return false;
  }

  return {
    buildCapabilitiesPayload: () => buildCapabilitiesPayload({ rootDir, pythonBin, skillRoot }),
    buildPluginWorkPacket,
    createPluginFromRequirement,
    installGeneratedPlugin,
    createAndInstallFromRequirement,
    implementExistingPluginSource,
    handleMorphPluginBuilderApiRequest,
  };
}

module.exports = {
  createMorphPluginBuilderApi,
  getMorphPluginBuilderSkillStatus,
};
