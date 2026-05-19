const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMorphActionRegistry } = require('./morph-action-registry');
const { getMorphPluginBuilderSkillStatus } = require('./morph-plugin-builder-api');
const {
  getCanonicalMorphActionName,
  sanitizeMorphActionName,
} = require('./morph-action-contract');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const EXTENSION_CATALOG_PATHS = [
  path.join(ROOT_DIR, 'extensions', 'manifest.json'),
  path.join(ROOT_DIR, 'extensions', 'local-manifest.json'),
];
const DEFAULT_MORPH_PLUGIN_BUILDER_SKILL_ROOT = String(process.env.MORPH_PLUGIN_BUILDER_SKILL_ROOT || '').trim()
  || path.join(os.homedir(), '.codex', 'skills', 'morph-plugin-builder');

function toSafeText(value, maxLen = 200) {
  return String(value || '').trim().slice(0, maxLen);
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function normalizeThoughtTimestampSource(value = '') {
  return String(value || '')
    .trim()
    .replace(/[年月]/g, '-')
    .replace(/[日]/g, ' ')
    .replace(/\//g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseThoughtTimestamp(item = null) {
  if (!item || typeof item !== 'object') return 0;
  const fields = [item.updatedAt, item.createdAt, item.completedAt, item.time, item.date];
  for (let i = 0; i < fields.length; i += 1) {
    const normalized = normalizeThoughtTimestampSource(fields[i]);
    if (!normalized) continue;
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const sortOrder = Number(item.sortOrder);
  if (Number.isFinite(sortOrder) && sortOrder > 0) return sortOrder;
  return 0;
}

function sortThoughtsNewestFirst(items = []) {
  return toSafeArray(items)
    .map((item, idx) => ({ item, idx, ts: parseThoughtTimestamp(item) }))
    .sort((a, b) => (b.ts - a.ts) || (a.idx - b.idx))
    .map((entry) => entry.item);
}

function cloneJsonSafe(value) {
  try {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value == null ? value : null;
  }
}

function readIsolatedLiveDataSnapshot(readCurrentLiveData, normalizeData) {
  if (typeof readCurrentLiveData !== 'function') return normalizeData({});
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
  return cloneJsonSafe(snapshot) || normalizeData({});
}

function readJsonFileSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function loadMorphExtensionCatalog() {
  const merged = [];
  const seen = new Set();
  EXTENSION_CATALOG_PATHS.forEach((filePath) => {
    const payload = readJsonFileSafe(filePath);
    const entries = Array.isArray(payload?.extensions) ? payload.extensions : [];
    entries.forEach((entry) => {
      const id = toSafeText(entry?.id, 120);
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push(entry);
    });
  });
  return merged;
}

function isExtensionAIReadable(definition) {
  const permissions = Array.isArray(definition?.permissions) ? definition.permissions : [];
  if (permissions.some((item) => item && item.aiReadable === true)) return true;
  return permissions.some((item) => {
    const scope = toSafeText(item?.scope, 40);
    return scope === 'health' || scope === 'data';
  });
}

function buildExtensionReadableEntities(definition) {
  const readableEntities = [];
  const model = definition?.dataModel && typeof definition.dataModel === 'object' ? definition.dataModel : {};
  const stateKey = toSafeText(model.stateKey, 120);
  if (stateKey) readableEntities.push(stateKey);
  toSafeArray(model.sharedDomains).forEach((item) => {
    const value = toSafeText(item, 120);
    if (value) readableEntities.push(value);
  });
  return Array.from(new Set(readableEntities));
}

function hasAppleHealthExtensionFootprint(data) {
  const bundle = data?.appleHealthSync && typeof data.appleHealthSync === 'object' ? data.appleHealthSync : null;
  if (!bundle) return false;
  if (bundle.snapshot && typeof bundle.snapshot === 'object' && Object.keys(bundle.snapshot).length) return true;
  const history = bundle.history && typeof bundle.history === 'object' ? bundle.history : null;
  if (history && Object.keys(history).some((key) => {
    const value = history[key];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return !!toSafeText(value, 40);
  })) return true;
  return !!toSafeText(bundle.updatedAt, 80) || !!toSafeText(bundle.source, 80);
}

function buildExtensionStateMap(data, catalog = null) {
  const list = Array.isArray(catalog) ? catalog : loadMorphExtensionCatalog();
  const state = {};
  list.forEach((definition) => {
    const id = toSafeText(definition?.id, 120);
    if (!id) return;
    state[id] = definition?.defaultEnabled === true;
  });
  const syncedState = toSafeObject(data?.morphRuntime?.userPreferences?.extensionsState);
  Object.entries(syncedState).forEach(([id, enabled]) => {
    const key = toSafeText(id, 120);
    if (!key) return;
    state[key] = enabled === true;
  });
  if (!Object.prototype.hasOwnProperty.call(syncedState, 'apple-health') && hasAppleHealthExtensionFootprint(data)) {
    state['apple-health'] = true;
  }
  if (!Object.prototype.hasOwnProperty.call(state, 'health-state')) state['health-state'] = true;
  return state;
}

function isMorphExtensionEnabled(data, pluginId, catalog = null) {
  const key = toSafeText(pluginId, 120);
  if (!key) return false;
  if (key === 'health-state') return true;
  return buildExtensionStateMap(data, catalog)[key] === true;
}

function readExtensionStateProjection(data, definition) {
  const root = toSafeObject(data);
  const model = definition?.dataModel && typeof definition.dataModel === 'object' ? definition.dataModel : {};
  const extensionId = toSafeText(definition?.id, 120);
  const namespace = toSafeText(model.namespace, 120) || extensionId;
  const state = toSafeText(model.state, 40);
  const stateKey = toSafeText(model.stateKey, 120);
  if (state === 'root-pluginData' && namespace) {
    const pluginState = root?.pluginData?.[namespace];
    if (pluginState && typeof pluginState === 'object') {
      if (pluginState.state && typeof pluginState.state === 'object') return pluginState.state;
      return pluginState;
    }
  }
  if (stateKey && root[stateKey] && typeof root[stateKey] === 'object') return root[stateKey];
  const sharedDomains = toSafeArray(model.sharedDomains).map((item) => toSafeText(item, 120)).filter(Boolean);
  if (sharedDomains.length) {
    const projection = {};
    sharedDomains.forEach((key) => {
      if (root[key] && typeof root[key] === 'object') projection[key] = root[key];
    });
    if (Object.keys(projection).length) return projection;
  }
  return null;
}

function serializeAppleHealthSyncValue(value) {
  const payload = value && typeof value === 'object' ? value : null;
  if (!payload) return null;
  const snapshot = payload.snapshot && typeof payload.snapshot === 'object' ? payload.snapshot : null;
  const history = payload.history && typeof payload.history === 'object' ? payload.history : null;
  return {
    updatedAt: toSafeText(payload.updatedAt, 80),
    source: toSafeText(payload.source, 80),
    snapshot: snapshot
      ? {
          windowHours: Number.isFinite(Number(snapshot.windowHours)) ? Number(snapshot.windowHours) : null,
          windowStart: toSafeText(snapshot.windowStart, 80),
          windowEnd: toSafeText(snapshot.windowEnd, 80),
          steps: Number.isFinite(Number(snapshot.steps)) ? Number(snapshot.steps) : null,
          distanceMeters: Number.isFinite(Number(snapshot.distanceMeters)) ? Number(snapshot.distanceMeters) : null,
          activeEnergyKcal: Number.isFinite(Number(snapshot.activeEnergyKcal)) ? Number(snapshot.activeEnergyKcal) : null,
          restingHeartRateBpm: Number.isFinite(Number(snapshot.restingHeartRateBpm)) ? Number(snapshot.restingHeartRateBpm) : null,
          sleep: snapshot.sleep && typeof snapshot.sleep === 'object'
            ? {
                asleepHours: Number.isFinite(Number(snapshot.sleep.asleepHours)) ? Number(snapshot.sleep.asleepHours) : null,
                inBedHours: Number.isFinite(Number(snapshot.sleep.inBedHours)) ? Number(snapshot.sleep.inBedHours) : null,
              }
            : null,
          bodyMassKg: Number.isFinite(Number(snapshot.bodyMassKg)) ? Number(snapshot.bodyMassKg) : null,
          bloodGlucoseMmolPerL: Number.isFinite(Number(snapshot.bloodGlucoseMmolPerL)) ? Number(snapshot.bloodGlucoseMmolPerL) : null,
          heartRateSamples: toSafeArray(snapshot.heartRateSamples)
            .map((sample) => ({
              at: toSafeText(sample?.at, 80),
              bpm: Number.isFinite(Number(sample?.bpm)) ? Number(sample.bpm) : null,
            }))
            .filter((sample) => sample.at || sample.bpm != null),
        }
      : null,
    history: history
      ? {
          generatedAt: toSafeText(history.generatedAt, 80),
          windows: toSafeObject(history.windows),
          activityDaily: toSafeArray(history.activityDaily)
            .map((row) => ({
              date: toSafeText(row?.date, 20),
              steps: Number.isFinite(Number(row?.steps)) ? Number(row.steps) : null,
              distanceMeters: Number.isFinite(Number(row?.distanceMeters)) ? Number(row.distanceMeters) : null,
              activeEnergyKcal: Number.isFinite(Number(row?.activeEnergyKcal)) ? Number(row.activeEnergyKcal) : null,
            }))
            .filter((row) => row.date),
          sleepDaily: toSafeArray(history.sleepDaily)
            .map((row) => ({
              date: toSafeText(row?.date, 20),
              asleepHours: Number.isFinite(Number(row?.asleepHours)) ? Number(row.asleepHours) : null,
              inBedHours: Number.isFinite(Number(row?.inBedHours)) ? Number(row.inBedHours) : null,
              samplesCount: Number.isFinite(Number(row?.samplesCount)) ? Number(row.samplesCount) : null,
            }))
            .filter((row) => row.date),
          restingHeartRateDaily: toSafeArray(history.restingHeartRateDaily)
            .map((row) => ({
              date: toSafeText(row?.date, 20),
              at: toSafeText(row?.at, 80),
              restingHeartRateBpm: Number.isFinite(Number(row?.restingHeartRateBpm)) ? Number(row.restingHeartRateBpm) : null,
            }))
            .filter((row) => row.date),
          heartRateSamples: toSafeArray(history.heartRateSamples)
            .map((row) => ({
              date: toSafeText(row?.date, 20),
              at: toSafeText(row?.at, 80),
              bpm: Number.isFinite(Number(row?.bpm)) ? Number(row.bpm) : null,
            }))
            .filter((row) => row.at || row.date),
          bodyMassSamples: toSafeArray(history.bodyMassSamples)
            .map((row) => ({
              date: toSafeText(row?.date, 20),
              at: toSafeText(row?.at, 80),
              kg: Number.isFinite(Number(row?.kg)) ? Number(row.kg) : null,
            }))
            .filter((row) => row.at || row.date),
          bloodGlucoseSamples: toSafeArray(history.bloodGlucoseSamples)
            .map((row) => ({
              date: toSafeText(row?.date, 20),
              at: toSafeText(row?.at, 80),
              mgDl: Number.isFinite(Number(row?.mgDl)) ? Number(row.mgDl) : null,
              mmolL: Number.isFinite(Number(row?.mmolL)) ? Number(row.mmolL) : null,
            }))
            .filter((row) => row.at || row.date),
        }
      : null,
  };
}

function serializePluginReadableData(pluginId, projection) {
  const normalized = toSafeText(pluginId, 120);
  if (!normalized || !projection || typeof projection !== 'object') return null;
  if (normalized === 'apple-health') return serializeAppleHealthSyncValue(projection);
  return cloneJsonSafe(projection);
}

function buildPluginCommandExecutePath(pluginId, commandId) {
  const normalizedPluginId = toSafeText(pluginId, 120);
  const normalizedCommandId = toSafeText(commandId, 120);
  if (!normalizedPluginId || !normalizedCommandId) return '';
  return `/api/morph/plugins/${encodeURIComponent(normalizedPluginId)}/commands/${encodeURIComponent(normalizedCommandId)}`;
}

function buildPluginCommandRuntimeKey(pluginId, commandId) {
  const normalizedPluginId = toSafeText(pluginId, 120);
  const normalizedCommandId = toSafeText(commandId, 120);
  if (!normalizedPluginId || !normalizedCommandId) return '';
  return `${normalizedPluginId}::${normalizedCommandId}`;
}

function buildMorphPluginRuntimeRegistry(options = {}) {
  const atlasStore = options.atlasStore && typeof options.atlasStore === 'object' ? options.atlasStore : null;
  const handlers = new Map();
  if (atlasStore && typeof atlasStore.saveDoc === 'function') {
    handlers.set(buildPluginCommandRuntimeKey('atlas', 'save-atlas-doc'), {
      pluginId: 'atlas',
      commandId: 'save-atlas-doc',
      execute({ payload }) {
        const relPath = toSafeText(payload?.relPath, 240);
        const content = typeof payload?.content === 'string' ? payload.content : '';
        if (!relPath) {
          const error = new Error('relPath is required');
          error.statusCode = 400;
          error.code = 'missing_rel_path';
          throw error;
        }
        if (!content.trim()) {
          const error = new Error('content is required');
          error.statusCode = 400;
          error.code = 'missing_content';
          throw error;
        }
        const doc = atlasStore.saveDoc(relPath, content);
        if (!doc) {
          const error = new Error('atlas document save failed');
          error.statusCode = 400;
          error.code = 'plugin_runtime_save_failed';
          error.entityType = 'pluginDocument';
          error.entityId = relPath;
          throw error;
        }
        const updatedAt = toSafeText(doc.updatedAt, 80) || new Date().toISOString();
        return {
          entityType: 'pluginDocument',
          entityId: toSafeText(doc.relPath, 240),
          entity: {
            pluginId: 'atlas',
            relPath: toSafeText(doc.relPath, 240),
            name: toSafeText(doc.name, 160),
            title: toSafeText(doc.title, 240),
            updatedAt,
            content: typeof doc.content === 'string' ? doc.content : '',
          },
          affectedEntities: [
            {
              type: 'pluginDocument',
              id: toSafeText(doc.relPath, 240),
            },
          ],
          verifier: {
            ok: true,
            status: 'verified',
            updatedAt,
            userMessage: 'Atlas 文档已保存。',
          },
          writeReceipt: {
            ok: true,
            type: 'plugin_runtime_write',
            pipeline: 'plugin-runtime',
            status: 'committed',
            source: 'api/morph/plugins/atlas/commands/save-atlas-doc',
            pluginId: 'atlas',
            commandId: 'save-atlas-doc',
            targetStore: {
              kind: 'atlas-workspace-markdown',
              relativePath: toSafeText(doc.relPath, 240),
            },
            savedAt: updatedAt,
          },
          updatedAt,
          summary: `save-atlas-doc -> ${toSafeText(doc.relPath, 240)}`,
        };
      },
    });
  }
  return {
    resolve(pluginId, commandId) {
      return handlers.get(buildPluginCommandRuntimeKey(pluginId, commandId)) || null;
    },
  };
}

function normalizePluginCommandPermission(command = null) {
  const value = toSafeText(command?.requiredPermission, 40);
  return value || 'update';
}

function normalizePluginCommandRisk(command = null) {
  const value = toSafeText(command?.risk, 40);
  return value || 'medium';
}

function normalizePluginCommandBoundaryLevel(command = null) {
  const explicit = toSafeText(command?.boundaryLevel, 40);
  if (explicit) return explicit;
  return command?.confirmationRequired === true ? 'confirm-required' : 'allowed';
}

function buildReadablePluginDescriptor(definition, data, catalog = null) {
  const id = toSafeText(definition?.id, 120);
  if (!id || !isExtensionAIReadable(definition)) return null;
  const enabled = isMorphExtensionEnabled(data, id, catalog);
  const projection = enabled ? readExtensionStateProjection(data, definition) : null;
  return {
    id,
    name: toSafeText(definition?.name, 160),
    summary: toSafeText(definition?.summary, 240),
    enabled,
    dataAvailable: !!projection,
    readableEntities: enabled ? buildExtensionReadableEntities(definition) : [],
    requiredPermissions: toSafeArray(definition?.permissions)
      .filter((item) => item && (item.aiReadable === true || ['health', 'data'].includes(toSafeText(item.scope, 40))))
      .map((item) => ({
        id: toSafeText(item?.id, 120),
        scope: toSafeText(item?.scope, 40),
        required: item?.required !== false,
      }))
      .filter((item) => item.id),
    queryPath: `/api/morph/plugin?pluginId=${encodeURIComponent(id)}`,
  };
}

function buildExecutablePluginCommandDescriptor(definition, command, data, actionSpecMap, catalog = null, pluginRuntimeRegistry = null) {
  const pluginId = toSafeText(definition?.id, 120);
  if (!pluginId || !command || command.aiCallable !== true) return null;
  const pluginEnabled = isMorphExtensionEnabled(data, pluginId, catalog);
  const commandId = toSafeText(command?.id, 120);
  const hostAction = toSafeText(command?.hostAction, 120);
  const executionTarget = toSafeText(command?.executionTarget, 80) || (hostAction ? 'host-action' : '');
  const actionSpec = executionTarget === 'host-action' && hostAction ? actionSpecMap.get(hostAction) : null;
  const runtimeHandler = executionTarget === 'plugin-runtime' && pluginRuntimeRegistry && typeof pluginRuntimeRegistry.resolve === 'function'
    ? pluginRuntimeRegistry.resolve(pluginId, commandId)
    : null;
  const actionEnabled = executionTarget === 'host-action'
    ? !!(actionSpec && actionSpec.enabled !== false)
    : (executionTarget === 'plugin-runtime' ? !!runtimeHandler : false);
  const hostActionPath = hostAction ? `/api/morph/actions/${encodeURIComponent(hostAction)}` : '';
  const executePath = buildPluginCommandExecutePath(pluginId, commandId);
  const descriptor = {
    pluginId,
    pluginName: toSafeText(definition?.name, 160),
    commandId,
    label: toSafeText(command?.label, 160),
    executionTarget,
    hostAction,
    enabled: pluginEnabled && actionEnabled,
    pluginEnabled,
    permission: executionTarget === 'host-action' ? toSafeText(actionSpec?.permission, 40) : normalizePluginCommandPermission(command),
    boundaryLevel: executionTarget === 'host-action' ? toSafeText(actionSpec?.boundaryLevel, 40) : normalizePluginCommandBoundaryLevel(command),
    confirmationRequired: executionTarget === 'host-action' ? actionSpec?.confirmationRequired === true : command?.confirmationRequired === true,
    risk: executionTarget === 'host-action' ? toSafeText(actionSpec?.risk, 40) : normalizePluginCommandRisk(command),
    executePath,
    hostActionPath,
    path: executionTarget === 'plugin-runtime' ? executePath : hostActionPath,
  };
  if (!descriptor.commandId || !descriptor.label || !descriptor.executionTarget) return null;
  if (descriptor.executionTarget === 'host-action' && !descriptor.hostAction) return null;
  return descriptor;
}

function buildExecutablePluginCommandDescriptors(definition, data, actionSpecMap, catalog = null, pluginRuntimeRegistry = null) {
  const commands = Array.isArray(definition?.commands) ? definition.commands : [];
  return commands
    .map((command) => buildExecutablePluginCommandDescriptor(definition, command, data, actionSpecMap, catalog, pluginRuntimeRegistry))
    .filter(Boolean);
}

function matchPluginCommandExecutionRoute(url = '') {
  const match = String(url || '').trim().match(/^\/api\/morph\/plugins\/([^/]+)\/commands\/([^/]+)$/);
  if (!match) return null;
  return {
    pluginId: decodeURIComponent(match[1] || ''),
    commandId: decodeURIComponent(match[2] || ''),
  };
}

function resolveExecutablePluginCommand(catalog, data, actionSpecMap, pluginRuntimeRegistry, pluginId, commandId) {
  const normalizedPluginId = toSafeText(pluginId, 120);
  const normalizedCommandId = toSafeText(commandId, 120);
  if (!normalizedPluginId || !normalizedCommandId) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'invalid_plugin_command_request',
      error: 'pluginId and commandId are required',
    };
  }
  const definition = toSafeArray(catalog).find((entry) => toSafeText(entry?.id, 120) === normalizedPluginId);
  if (!definition) {
    return {
      ok: false,
      statusCode: 404,
      errorCode: 'plugin_not_found',
      error: 'plugin not found',
      pluginId: normalizedPluginId,
      commandId: normalizedCommandId,
    };
  }
  if (!isMorphExtensionEnabled(data, normalizedPluginId, catalog)) {
    return {
      ok: false,
      statusCode: 403,
      errorCode: 'plugin_disabled',
      error: 'plugin is disabled',
      pluginId: normalizedPluginId,
      commandId: normalizedCommandId,
    };
  }
  const commands = Array.isArray(definition?.commands) ? definition.commands : [];
  const command = commands.find((entry) => toSafeText(entry?.id, 120) === normalizedCommandId);
  if (!command) {
    return {
      ok: false,
      statusCode: 404,
      errorCode: 'plugin_command_not_found',
      error: 'plugin command not found',
      pluginId: normalizedPluginId,
      commandId: normalizedCommandId,
    };
  }
  if (command.aiCallable !== true) {
    return {
      ok: false,
      statusCode: 403,
      errorCode: 'plugin_command_not_externally_callable',
      error: 'plugin command is not exposed for AI or external agent execution',
      pluginId: normalizedPluginId,
      commandId: normalizedCommandId,
    };
  }
  const descriptor = buildExecutablePluginCommandDescriptor(definition, command, data, actionSpecMap, catalog, pluginRuntimeRegistry);
  if (!descriptor) {
    return {
      ok: false,
      statusCode: 409,
      errorCode: 'plugin_command_binding_invalid',
      error: 'plugin command binding is incomplete',
      pluginId: normalizedPluginId,
      commandId: normalizedCommandId,
    };
  }
  if (descriptor.executionTarget !== 'host-action') {
    if (descriptor.executionTarget === 'plugin-runtime') {
      const runtimeHandler = pluginRuntimeRegistry && typeof pluginRuntimeRegistry.resolve === 'function'
        ? pluginRuntimeRegistry.resolve(normalizedPluginId, normalizedCommandId)
        : null;
      if (!runtimeHandler) {
        return {
          ok: false,
          statusCode: 501,
          errorCode: 'plugin_runtime_handler_not_available',
          error: 'plugin runtime handler is not available',
          pluginId: normalizedPluginId,
          commandId: normalizedCommandId,
          executionTarget: descriptor.executionTarget,
        };
      }
      return {
        ok: true,
        definition,
        command,
        descriptor,
        runtimeHandler,
      };
    }
    return {
      ok: false,
      statusCode: 501,
      errorCode: 'plugin_command_target_not_supported',
      error: `execution target ${descriptor.executionTarget || 'unknown'} is not supported yet`,
      pluginId: normalizedPluginId,
      commandId: normalizedCommandId,
      executionTarget: descriptor.executionTarget,
    };
  }
  if (!actionSpecMap.get(descriptor.hostAction)) {
    return {
      ok: false,
      statusCode: 404,
      errorCode: 'plugin_command_host_action_not_found',
      error: 'host action not found for plugin command',
      pluginId: normalizedPluginId,
      commandId: normalizedCommandId,
      hostAction: descriptor.hostAction,
    };
  }
  return {
    ok: true,
    definition,
    command,
    descriptor,
  };
}

function serializeBaseEntity(item) {
  const src = item && typeof item === 'object' ? item : {};
  return {
    id: toSafeText(src.id, 120),
    createdAt: toSafeText(src.createdAt, 80),
    updatedAt: toSafeText(src.updatedAt, 80),
    archivedAt: toSafeText(src.archivedAt, 80),
    source: toSafeText(src.source, 80),
    tags: toSafeArray(src.tags).map((tag) => toSafeText(tag, 60)).filter(Boolean).slice(0, 20),
  };
}

function serializeEntityLinks(value) {
  return toSafeArray(value)
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      type: toSafeText(item.type, 40),
      targetId: toSafeText(item.targetId, 120),
      label: toSafeText(item.label, 120),
    }))
    .filter((item) => item.type && item.targetId)
    .slice(0, 50);
}

function serializeBlocks(value, options = {}) {
  const detail = options.detail === true;
  const blocks = toSafeArray(value)
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: toSafeText(item.id, 120) || `block-${index}`,
      type: toSafeText(item.type, 60),
      text: toSafeText(item.text, detail ? 2000 : 280),
      checked: item.checked === true,
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
      metadata: detail ? toSafeObject(item.metadata) : undefined,
    }));
  return detail ? blocks : { count: blocks.length };
}

function serializeProjectReferences(value, options = {}) {
  const detail = options.detail === true;
  const references = toSafeArray(value)
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: toSafeText(item.id, 120) || `reference-${index}`,
      text: toSafeText(item.text, detail ? 4000 : 240),
      time: toSafeText(item.time, 80),
      source: toSafeText(item.source, 80),
      createdAt: toSafeText(item.createdAt, 80),
      updatedAt: toSafeText(item.updatedAt, 80),
    }))
    .filter((item) => item.text);
  return detail ? references : { count: references.length };
}

function serializeExpenseRecord(item, options = {}) {
  const detail = options.detail === true;
  const src = item && typeof item === 'object' ? item : {};
  return {
    type: 'expenseRecord',
    ...serializeBaseEntity(src),
    item: toSafeText(src.item, detail ? 4000 : 240),
    category: toSafeText(src.category, 120),
    amount: Number.isFinite(Number(src.amount)) ? Number(src.amount) : null,
    note: toSafeText(src.note, detail ? 2000 : 280),
    spentAt: toSafeText(src.spentAt, 80),
  };
}

function serializeFlashThought(item, options = {}) {
  const detail = options.detail === true;
  const src = item && typeof item === 'object' ? item : {};
  const out = {
    type: 'flashThought',
    ...serializeBaseEntity(src),
    text: toSafeText(src.text, detail ? 4000 : 240),
    date: toSafeText(src.date, 40),
    time: toSafeText(src.time, 40),
    status: toSafeText(src.status || 'active', 20) || 'active',
    linkCount: toSafeArray(src.links).length,
  };
  if (detail) out.links = serializeEntityLinks(src.links);
  return out;
}

function serializeReminder(item, options = {}) {
  const detail = options.detail === true;
  const src = item && typeof item === 'object' ? item : {};
  const completedAt = toSafeText(src.completedAt, 80);
  const out = {
    type: 'reminder',
    ...serializeBaseEntity(src),
    title: toSafeText(src.title, 240),
    note: toSafeText(src.note, detail ? 2000 : 280),
    dueAt: toSafeText(src.dueAt, 80),
    completedAt,
    priority: toSafeText(src.priority || 'medium', 20) || 'medium',
    status: completedAt ? 'done' : 'active',
    linkCount: toSafeArray(src.links).length,
  };
  if (detail) out.links = serializeEntityLinks(src.links);
  return out;
}

function serializeProject(item, options = {}) {
  const detail = options.detail === true;
  const src = item && typeof item === 'object' ? item : {};
  const out = {
    type: 'project',
    ...serializeBaseEntity(src),
    name: toSafeText(src.name, 240),
    description: toSafeText(src.description, detail ? 4000 : 280),
    status: toSafeText(src.status || 'active', 20) || 'active',
    blockCount: toSafeArray(src.blocks).length,
    referenceCount: toSafeArray(src.items).length,
    linkCount: toSafeArray(src.links).length,
  };
  const sourceThought = src.sourceThought && typeof src.sourceThought === 'object'
    ? {
        id: toSafeText(src.sourceThought.id, 120),
        type: toSafeText(src.sourceThought.type, 40),
        text: toSafeText(src.sourceThought.text, detail ? 4000 : 240),
        createdAt: toSafeText(src.sourceThought.createdAt, 80),
      }
    : null;
  if (sourceThought && sourceThought.id && sourceThought.type) out.sourceThought = sourceThought;
  if (detail) {
    out.blocks = serializeBlocks(src.blocks, { detail: true });
    out.references = serializeProjectReferences(src.items, { detail: true });
    out.links = serializeEntityLinks(src.links);
    out.metadata = toSafeObject(src.metadata);
  }
  return out;
}

function serializeRoutine(item, options = {}) {
  const detail = options.detail === true;
  const src = item && typeof item === 'object' ? item : {};
  const out = {
    type: 'routine',
    ...serializeBaseEntity(src),
    name: toSafeText(src.name, 240),
    description: toSafeText(src.description, detail ? 4000 : 280),
    status: toSafeText(src.status || 'active', 20) || 'active',
    schedule: toSafeText(src.schedule, 120),
    blockCount: toSafeArray(src.blocks).length,
    linkCount: toSafeArray(src.links).length,
  };
  if (detail) {
    out.blocks = serializeBlocks(src.blocks, { detail: true });
    out.links = serializeEntityLinks(src.links);
    out.metadata = toSafeObject(src.metadata);
  }
  return out;
}

function serializeSop(item, options = {}) {
  const detail = options.detail === true;
  const src = item && typeof item === 'object' ? item : {};
  const out = {
    type: 'sop',
    ...serializeBaseEntity(src),
    name: toSafeText(src.name, 240),
    description: toSafeText(src.description, detail ? 4000 : 280),
    status: toSafeText(src.status || 'active', 20) || 'active',
    blockCount: toSafeArray(src.blocks).length,
    linkCount: toSafeArray(src.links).length,
  };
  if (detail) {
    out.blocks = serializeBlocks(src.blocks, { detail: true });
    out.links = serializeEntityLinks(src.links);
    out.metadata = toSafeObject(src.metadata);
  }
  return out;
}

function serializeDailyEntry(date, entry, options = {}) {
  const detail = options.detail === true;
  const src = entry && typeof entry === 'object' ? entry : {};
  const blocks = toSafeArray(src.blocks)
    .filter((item) => item && typeof item === 'object');
  const previewTexts = blocks
    .map((item) => toSafeText(readStructuredBlockText(item), 120))
    .filter(Boolean)
    .slice(0, 3);
  const out = {
    type: 'daily',
    id: toSafeText(date, 40),
    date: toSafeText(src.date || date, 40),
    summary: toSafeText(src.summary, detail ? 2000 : 280),
    blockCount: blocks.length,
    linkCount: toSafeArray(src.links).length,
    previewTexts,
  };
  if (detail) {
    out.blocks = serializeBlocks(blocks, { detail: true });
    out.links = serializeEntityLinks(src.links);
  }
  return out;
}

function normalizeEntityType(raw) {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return '';
  const aliases = {
    flashthought: 'flashThought',
    'flash-thought': 'flashThought',
    flashthoughts: 'flashThought',
    fixedthought: 'fixedThought',
    'fixed-thought': 'fixedThought',
    fixedthoughts: 'fixedThought',
    project: 'project',
    projects: 'project',
    routine: 'routine',
    routines: 'routine',
    sop: 'sop',
    sops: 'sop',
    daily: 'daily',
    dailyentry: 'daily',
    reminder: 'reminder',
    reminders: 'reminder',
  };
  return aliases[text] || '';
}

function normalizeActionName(raw) {
  return sanitizeMorphActionName(raw);
}

function normalizeMorphStatus(raw, fallback = 'active') {
  const value = String(raw || '').trim();
  return ['active', 'paused', 'done', 'archived'].includes(value) ? value : fallback;
}

function createMorphId(prefix = 'morph') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureArrayField(target, field) {
  if (!target || typeof target !== 'object') return [];
  if (!Array.isArray(target[field])) target[field] = [];
  return target[field];
}

function serializeMutationEntity(type, entity) {
  if (type === 'flashThought') return serializeFlashThought(entity, { detail: true });
  if (type === 'project') return serializeProject(entity, { detail: true });
  if (type === 'routine') return serializeRoutine(entity, { detail: true });
  if (type === 'sop') return serializeSop(entity, { detail: true });
  if (type === 'reminder') return serializeReminder(entity, { detail: true });
  if (type === 'daily') return serializeDailyEntry(entity?.date, entity, { detail: true });
  if (type === 'expenseRecord' || type === 'expense_record') return serializeExpenseRecord(entity, { detail: true });
  if (type === 'memoryDocument') {
    return {
      type: 'memoryDocument',
      id: toSafeText(entity?.id, 120),
      targetFile: toSafeText(entity?.targetFile, 120),
      scope: toSafeText(entity?.scope, 40),
      sectionTitle: toSafeText(entity?.sectionTitle, 120),
      content: toSafeText(entity?.content, 4000),
      text: toSafeText(entity?.text, 20000),
      updatedAt: toSafeText(entity?.updatedAt, 80),
      receiptLabel: toSafeText(entity?.receiptLabel, 240),
    };
  }
  if (type === 'fixedThought') {
    return {
      type: 'fixedThought',
      ...serializeBaseEntity(entity),
      title: toSafeText(entity?.title, 240),
      text: toSafeText(entity?.text, 4000),
      status: toSafeText(entity?.status || 'active', 20) || 'active',
      links: serializeEntityLinks(entity?.links),
    };
  }
  return { type, ...serializeBaseEntity(entity) };
}

const morphActionRegistry = createMorphActionRegistry({
  toSafeText,
  toSafeArray,
  toSafeObject,
  normalizeActionName,
  normalizeEntityType,
  normalizeMorphStatus,
  createMorphId,
  ensureArrayField,
  ensureObjectField: (target, field, fallback = {}) => {
    if (!target || typeof target !== 'object') return fallback;
    if (!target[field] || typeof target[field] !== 'object') target[field] = fallback;
    return target[field];
  },
});

function findMorphEntityByType(data, type, id) {
  const needle = String(id || '').trim();
  if (!needle) return null;
  if (type === 'flashThought') {
    const items = [...toSafeArray(data.flashThoughts), ...toSafeArray(data.completedFlashThoughts)];
    const found = items.find((item) => String(item?.id || '').trim() === needle);
    return found ? serializeFlashThought(found, { detail: true }) : null;
  }
  if (type === 'fixedThought') {
    const items = [...toSafeArray(data.fixed), ...toSafeArray(data.completedFixedThoughts)];
    const found = items.find((item) => String(item?.id || '').trim() === needle);
    if (!found) return null;
    return {
      type: 'fixedThought',
      ...serializeBaseEntity(found),
      title: toSafeText(found.title, 240),
      text: toSafeText(found.text, 4000),
      status: toSafeText(found.status || 'active', 20) || 'active',
      links: serializeEntityLinks(found.links),
    };
  }
  if (type === 'project') {
    const found = toSafeArray(data.projects).find((item) => String(item?.id || '').trim() === needle);
    return found ? serializeProject(found, { detail: true }) : null;
  }
  if (type === 'routine') {
    const found = toSafeArray(data.routines).find((item) => String(item?.id || '').trim() === needle);
    return found ? serializeRoutine(found, { detail: true }) : null;
  }
  if (type === 'sop') {
    const found = toSafeArray(data.sops).find((item) => String(item?.id || '').trim() === needle);
    return found ? serializeSop(found, { detail: true }) : null;
  }
  if (type === 'reminder') {
    const found = toSafeArray(data.reminders).find((item) => String(item?.id || '').trim() === needle);
    return found ? serializeReminder(found, { detail: true }) : null;
  }
  if (type === 'daily') {
    const foundDate = findDailyEntryByDate(data, needle);
    return foundDate ? serializeDailyEntry(needle, foundDate, { detail: true }) : null;
  }
  if (type === 'expenseRecord' || type === 'expense_record') {
    const found = toSafeArray(data?.expenseLedger?.records).find((item) => String(item?.id || '').trim() === needle);
    return found ? serializeExpenseRecord(found, { detail: true }) : null;
  }
  return null;
}

function buildMorphSummaryPayload(data) {
  const flashThoughts = toSafeArray(data.flashThoughts);
  const projects = toSafeArray(data.projects);
  const reminders = toSafeArray(data.reminders);
  const sops = toSafeArray(data.sops);
  const routines = toSafeArray(data.routines);
  const allDailyEntries = countDailyEntries(data);
  const overdueReminders = reminders.filter((item) => {
    const dueAt = Date.parse(String(item?.dueAt || ''));
    const completedAt = String(item?.completedAt || '').trim();
    return Number.isFinite(dueAt) && !completedAt && dueAt < Date.now();
  }).length;
  return {
    ok: true,
    domain: 'morph',
    fetchedAt: new Date().toISOString(),
    syncMeta: {
      revision: Number.isFinite(Number(data?.syncMeta?.revision)) ? Number(data.syncMeta.revision) : 0,
      lastClientWriteAt: toSafeText(data?.syncMeta?.lastClientWriteAt, 80),
      lastServerWriteAt: toSafeText(data?.syncMeta?.lastServerWriteAt, 80),
      schemaVersion: Number.isFinite(Number(data?.syncMeta?.schemaVersion)) ? Number(data.syncMeta.schemaVersion) : 1,
    },
    counts: {
      flashThoughts: flashThoughts.length,
      fixed: toSafeArray(data.fixed).length,
      reminders: reminders.length,
      projects: projects.length,
      routines: routines.length,
      sops: sops.length,
      dailyEntries: allDailyEntries,
      pluginNamespaces: Object.keys(toSafeObject(data.pluginData)).length,
    },
    status: {
      activeProjects: projects.filter((item) => String(item?.status || 'active').trim() === 'active').length,
      openReminders: reminders.filter((item) => !String(item?.completedAt || '').trim()).length,
      overdueReminders,
    },
    plugins: {
      enabledCount: Object.values(buildExtensionStateMap(data)).filter((value) => value === true).length,
    },
  };
}

function buildActionErrorDetails(error) {
  if (!error || typeof error !== 'object') return null;
  const details = {};
  ['field', 'entityType', 'entityId', 'side'].forEach((key) => {
    const value = toSafeText(error[key], 120);
    if (value) details[key] = value;
  });
  return Object.keys(details).length ? details : null;
}

function resolveRequestedActionSurface(req) {
  const headerValue = toSafeText(req?.headers?.['x-morph-action-surface'], 40).toLowerCase();
  if (headerValue === 'manual' || headerValue === 'trusted-manual' || headerValue === 'trusted-product') return 'manual';
  if (headerValue === 'system') return 'system';
  return 'external';
}

function resolveActionBoundaryDecision(actionSpec, executionSurface, confirmation) {
  const boundaryLevel = toSafeText(actionSpec?.boundaryLevel, 40) || 'disabled';
  if (actionSpec?.enabled !== false) {
    return {
      allowed: true,
      boundaryLevel,
      via: 'external-allowed',
    };
  }
  if (boundaryLevel === 'confirm-required' && executionSurface === 'manual') {
    if (confirmation?.confirmed === true) {
      return {
        allowed: true,
        boundaryLevel,
        via: 'trusted-manual-confirmed',
      };
    }
    return {
      allowed: false,
      statusCode: 409,
      code: 'confirmation_required',
      message: `action ${actionSpec?.action || 'unknown'} requires explicit confirmation on trusted manual surfaces`,
      boundaryLevel,
      via: 'trusted-manual-missing-confirmation',
    };
  }
  if (boundaryLevel === 'manual-only' && executionSurface === 'manual') {
    return {
      allowed: true,
      boundaryLevel,
      via: 'trusted-manual-only',
    };
  }
  if (boundaryLevel === 'system-only' && executionSurface === 'system') {
    return {
      allowed: true,
      boundaryLevel,
      via: 'trusted-system-only',
    };
  }
  return {
    allowed: false,
    statusCode: 403,
    code: 'high_risk_action_disabled',
    message: actionSpec?.reason || `action ${actionSpec?.action || 'unknown'} is disabled in the current execution surface`,
    boundaryLevel,
    via: executionSurface === 'external' ? 'external-blocked' : 'surface-blocked',
  };
}

function buildActionBoundaryPayload(actionSpec, executionSurface, boundaryDecision) {
  return {
    level: toSafeText(actionSpec?.boundaryLevel, 40) || 'disabled',
    surface: toSafeText(executionSurface, 40) || 'external',
    allowed: boundaryDecision?.allowed === true,
    via: toSafeText(boundaryDecision?.via, 80),
    reason: toSafeText(
      boundaryDecision?.allowed === true
        ? ''
        : boundaryDecision?.message || actionSpec?.reason || actionSpec?.boundaryReason || actionSpec?.boundarySummary,
      240
    ),
  };
}

function buildActionReceipt(actionName, mutation, executionSurface, boundary, updatedAt, verifier = null) {
  const affectedEntities = toSafeArray(mutation?.affectedEntities)
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      type: toSafeText(item.type, 40),
      id: toSafeText(item.id, 120),
    }))
    .filter((item) => item.type && item.id);
  const entityType = toSafeText(mutation?.entityType, 40);
  const entityId = toSafeText(mutation?.entityId, 120);
  return {
    ok: true,
    action: toSafeText(actionName, 80),
    status: 'committed',
    entityType,
    entityId,
    affectedCount: affectedEntities.length,
    affectedEntities,
    executionSurface: toSafeText(executionSurface, 40) || 'external',
    boundaryLevel: toSafeText(boundary?.level, 40),
    verifierStatus: ['verified', 'failed', 'not_run'].includes(toSafeText(verifier?.status, 20))
      ? toSafeText(verifier?.status, 20)
      : 'not_run',
    updatedAt: toSafeText(updatedAt, 80),
    summary: `${toSafeText(actionName, 80) || 'action'} -> ${entityType || 'entity'}${entityId ? `:${entityId}` : ''}`,
  };
}

function buildFailedActionReceipt(actionName, executionSurface, boundary, error, updatedAt) {
  const statusCode = Number.isFinite(Number(error?.statusCode)) ? Number(error.statusCode) : 400;
  const errorCode = toSafeText(error?.code, 80) || 'action_failed';
  const verifierFailureKind = toSafeText(error?.verifier?.failureKind, 80);
  return {
    ok: false,
    action: toSafeText(actionName, 80),
    status: 'failed',
    entityType: toSafeText(error?.entityType, 40),
    entityId: toSafeText(error?.entityId, 120),
    affectedCount: 0,
    affectedEntities: [],
    executionSurface: toSafeText(executionSurface, 40) || 'external',
    boundaryLevel: toSafeText(boundary?.level, 40),
    verifierStatus: toSafeText(error?.verifier?.status, 20) || 'not_run',
    verifierFailureKind,
    errorCode,
    statusCode,
    updatedAt: toSafeText(updatedAt, 80),
    summary: `${toSafeText(actionName, 80) || 'action'} failed -> ${errorCode}`,
  };
}

async function executeMorphActionRequest(options = {}) {
  const {
    req,
    actionName,
    body,
    readMorphDataSnapshot,
    commitWrite,
    appendActionLog,
    requireExplicitPermissions,
    routeMetadata = null,
  } = options;
  const requestedActionName = normalizeActionName(actionName);
  let actor = 'unknown';
  let source = 'unknown';
  let requestId = '';
  let executionSurface = 'external';
  let authorization = null;
  let confirmation = null;
  try {
    if (!requestedActionName) {
      const error = new Error('action name is required');
      error.statusCode = 400;
      error.code = 'missing_action_name';
      throw error;
    }
    const safeBody = body && typeof body === 'object' ? body : {};
    actor = toSafeText(safeBody.actor, 80) || 'unknown';
    source = toSafeText(safeBody.source, 160) || 'unknown';
    requestId = toSafeText(safeBody.requestId, 160) || createMorphId('request');
    executionSurface = resolveRequestedActionSurface(req);
    const actionSpec = morphActionRegistry.resolveActionSpec(requestedActionName);
    if (!actionSpec) {
      const error = new Error(`unknown action: ${requestedActionName}`);
      error.statusCode = 404;
      error.code = 'unknown_action';
      throw error;
    }
    const canonicalAction = actionSpec.canonicalAction || getCanonicalMorphActionName(requestedActionName) || requestedActionName;
    confirmation = morphActionRegistry.normalizeConfirmation(safeBody);
    authorization = morphActionRegistry.resolveAuthorization(safeBody, actionSpec, confirmation);
    const boundaryDecision = resolveActionBoundaryDecision(actionSpec, executionSurface, confirmation);
    const boundary = buildActionBoundaryPayload(actionSpec, executionSurface, boundaryDecision);
    if (requireExplicitPermissions === true && authorization.explicit !== true) {
      const error = new Error(`action ${requestedActionName} requires explicit permissions in the current server policy`);
      error.statusCode = 403;
      error.code = 'permissions_required';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.boundary = boundary;
      throw error;
    }
    if (!boundaryDecision.allowed) {
      const error = new Error(boundaryDecision.message || actionSpec.reason || `action ${requestedActionName} is disabled in phase 1`);
      error.statusCode = boundaryDecision.statusCode || 403;
      error.code = boundaryDecision.code || 'high_risk_action_disabled';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.executionSurface = executionSurface;
      error.boundary = boundary;
      throw error;
    }
    if (actionSpec.confirmationRequired && confirmation.confirmed !== true) {
      const error = new Error(`action ${requestedActionName} requires explicit confirmation`);
      error.statusCode = 409;
      error.code = 'confirmation_required';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.boundary = boundary;
      throw error;
    }
    if (!authorization.allowed) {
      const error = new Error(`action ${requestedActionName} requires ${authorization.requiredPermission} permission`);
      error.statusCode = 403;
      error.code = 'insufficient_permission';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.boundary = boundary;
      throw error;
    }
    const data = readMorphDataSnapshot({ clone: true });
    const mutation = morphActionRegistry.applyAction(data, requestedActionName, safeBody.payload);
    const updatedAt = new Date().toISOString();
    let verifier = buildActionVerifier(canonicalAction, mutation, safeBody.payload, data, updatedAt);
    if (shouldForceVerifierFailure(canonicalAction, requestId)) {
      verifier = {
        ...verifier,
        ok: false,
        status: 'failed',
        failureKind: 'forced_test_failure',
        userMessage: verifier?.userMessage || 'forced verifier failure for contract coverage',
      };
    }
    if (verifier.ok === false) {
      const error = new Error(verifier.userMessage || `action ${requestedActionName} failed verifier checks`);
      error.statusCode = 409;
      error.code = 'verifier_failed';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.executionSurface = executionSurface;
      error.boundary = boundary;
      error.verifier = {
        failureKind: 'postcondition_mismatch',
        ...verifier,
      };
      error.entityType = mutation?.entityType || '';
      error.entityId = mutation?.entityId || '';
      throw error;
    }
    const committed = commitWrite(data, {
      source: `api/morph/actions/${canonicalAction}`,
      incrementRevision: true,
      receipt: {
        status: 'committed',
        source: 'morph-action',
        reason: 'morph_action_committed',
        message: `action ${canonicalAction} 已提交到 canonical store`,
        action: canonicalAction,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        executionSurface,
      },
    });
    const committedData = readMorphDataSnapshot({ clone: true });
    const postCommitVerifier = buildActionVerifier(canonicalAction, mutation, safeBody.payload, committedData, updatedAt);
    if (postCommitVerifier.ok === false) {
      const error = new Error(postCommitVerifier.userMessage || `action ${requestedActionName} failed post-commit verifier checks`);
      error.statusCode = 409;
      error.code = 'post_commit_verifier_failed';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.executionSurface = executionSurface;
      error.boundary = boundary;
      error.verifier = {
        failureKind: 'post_commit_mismatch',
        ...postCommitVerifier,
      };
      error.entityType = mutation?.entityType || '';
      error.entityId = mutation?.entityId || '';
      error.writeReceipt = committed.writeReceipt;
      throw error;
    }
    verifier = postCommitVerifier;
    const receipt = buildActionReceipt(canonicalAction, mutation, executionSurface, boundary, updatedAt, verifier);
    appendActionLog({
      ok: true,
      action: requestedActionName,
      canonicalAction,
      actor,
      source,
      requestId,
      executionSurface,
      updatedAt,
      affectedEntities: mutation.affectedEntities,
      authorization,
      confirmation,
      boundary,
      verifier,
      receipt,
      writeReceipt: committed.writeReceipt,
      routeMetadata,
    });
    return {
      statusCode: 200,
      payload: {
        ok: true,
        action: requestedActionName,
        canonicalAction,
        actor,
        source,
        requestId,
        executionSurface,
        authorization,
        confirmation,
        boundary,
        verifier,
        receipt,
        writeReceipt: committed.writeReceipt,
        entity: {
          type: mutation.entityType,
          id: mutation.entityId,
          data: serializeMutationEntity(mutation.entityType, mutation.entity),
        },
        affectedEntities: mutation.affectedEntities,
        updatedAt: committed.savedAt,
        snapshot: committed.snapshot,
        mirror: committed.mirror,
        ...(routeMetadata ? { routeMetadata } : {}),
      },
    };
  } catch (error) {
    const updatedAt = new Date().toISOString();
    const failedBoundary = error.boundary || null;
    const failedCanonicalAction = getCanonicalMorphActionName(requestedActionName || 'unknown') || requestedActionName || 'unknown';
    const failedReceipt = buildFailedActionReceipt(failedCanonicalAction, executionSurface, failedBoundary, error, updatedAt);
    const failedVerifier = error.verifier && typeof error.verifier === 'object' ? error.verifier : null;
    appendActionLog({
      ok: false,
      action: requestedActionName || 'unknown',
      canonicalAction: failedCanonicalAction,
      actor,
      source,
      requestId: requestId || createMorphId('request'),
      executionSurface,
      updatedAt,
      authorization,
      confirmation,
      boundary: failedBoundary,
      verifier: failedVerifier,
      receipt: failedReceipt,
      errorCode: error.code || 'action_failed',
      error: error.message || 'action failed',
      errorDetails: buildActionErrorDetails(error),
      routeMetadata,
    });
    return {
      statusCode: Number.isFinite(Number(error.statusCode)) ? Number(error.statusCode) : 400,
      payload: {
        ok: false,
        action: requestedActionName || 'unknown',
        canonicalAction: failedCanonicalAction,
        errorCode: error.code || 'action_failed',
        error: error.message || 'action failed',
        executionSurface,
        authorization,
        confirmation,
        boundary: failedBoundary,
        verifier: failedVerifier,
        receipt: failedReceipt,
        errorDetails: buildActionErrorDetails(error),
        ...(routeMetadata ? { routeMetadata } : {}),
      },
    };
  }
}

async function executeMorphPluginRuntimeCommandRequest(options = {}) {
  const {
    req,
    descriptor,
    handler,
    body,
    appendActionLog,
    requireExplicitPermissions,
    routeMetadata = null,
  } = options;
  const pluginId = toSafeText(descriptor?.pluginId, 120);
  const commandId = toSafeText(descriptor?.commandId, 120);
  const canonicalAction = `plugin-runtime:${pluginId}:${commandId}`;
  let actor = 'unknown';
  let source = 'unknown';
  let requestId = '';
  let executionSurface = 'external';
  let authorization = null;
  let confirmation = null;
  try {
    const safeBody = body && typeof body === 'object' ? body : {};
    actor = toSafeText(safeBody.actor, 80) || 'unknown';
    source = toSafeText(safeBody.source, 160) || 'unknown';
    requestId = toSafeText(safeBody.requestId, 160) || createMorphId('request');
    executionSurface = resolveRequestedActionSurface(req);
    const pluginActionSpec = {
      action: canonicalAction,
      permission: toSafeText(descriptor?.permission, 40) || 'update',
      confirmationRequired: descriptor?.confirmationRequired === true,
      enabled: descriptor?.enabled === true,
      boundaryLevel: toSafeText(descriptor?.boundaryLevel, 40) || 'allowed',
      reason: descriptor?.enabled === true ? '' : 'plugin runtime command is not enabled',
    };
    confirmation = morphActionRegistry.normalizeConfirmation(safeBody);
    authorization = morphActionRegistry.resolveAuthorization(safeBody, pluginActionSpec, confirmation);
    const boundaryDecision = resolveActionBoundaryDecision(pluginActionSpec, executionSurface, confirmation);
    const boundary = buildActionBoundaryPayload(pluginActionSpec, executionSurface, boundaryDecision);
    if (requireExplicitPermissions === true && authorization.explicit !== true) {
      const error = new Error(`plugin command ${pluginId}/${commandId} requires explicit permissions in the current server policy`);
      error.statusCode = 403;
      error.code = 'permissions_required';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.boundary = boundary;
      throw error;
    }
    if (!boundaryDecision.allowed) {
      const error = new Error(boundaryDecision.message || pluginActionSpec.reason || `plugin command ${pluginId}/${commandId} is disabled`);
      error.statusCode = boundaryDecision.statusCode || 403;
      error.code = boundaryDecision.code || 'high_risk_action_disabled';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.executionSurface = executionSurface;
      error.boundary = boundary;
      throw error;
    }
    if (pluginActionSpec.confirmationRequired && confirmation.confirmed !== true) {
      const error = new Error(`plugin command ${pluginId}/${commandId} requires explicit confirmation`);
      error.statusCode = 409;
      error.code = 'confirmation_required';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.boundary = boundary;
      throw error;
    }
    if (!authorization.allowed) {
      const error = new Error(`plugin command ${pluginId}/${commandId} requires ${authorization.requiredPermission} permission`);
      error.statusCode = 403;
      error.code = 'insufficient_permission';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.boundary = boundary;
      throw error;
    }
    const runtimeResult = await Promise.resolve(handler.execute({
      payload: safeBody.payload && typeof safeBody.payload === 'object' ? safeBody.payload : {},
      body: safeBody,
      descriptor,
      requestId,
      actor,
      source,
      executionSurface,
    }));
    const updatedAt = toSafeText(runtimeResult?.updatedAt, 80) || new Date().toISOString();
    const verifier = runtimeResult?.verifier && typeof runtimeResult.verifier === 'object'
      ? runtimeResult.verifier
      : {
          ok: true,
          status: 'verified',
          updatedAt,
          userMessage: '',
        };
    if (verifier.ok === false) {
      const error = new Error(verifier.userMessage || `plugin command ${pluginId}/${commandId} failed verifier checks`);
      error.statusCode = 409;
      error.code = 'verifier_failed';
      error.authorization = authorization;
      error.confirmation = confirmation;
      error.executionSurface = executionSurface;
      error.boundary = boundary;
      error.verifier = {
        failureKind: 'postcondition_mismatch',
        ...verifier,
      };
      error.entityType = toSafeText(runtimeResult?.entityType, 40);
      error.entityId = toSafeText(runtimeResult?.entityId, 240);
      throw error;
    }
    const affectedEntities = toSafeArray(runtimeResult?.affectedEntities)
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        type: toSafeText(item.type, 40),
        id: toSafeText(item.id, 240),
      }))
      .filter((item) => item.type && item.id);
    const entityType = toSafeText(runtimeResult?.entityType, 40) || 'pluginRuntimeEntity';
    const entityId = toSafeText(runtimeResult?.entityId, 240);
    const receipt = {
      ok: true,
      action: commandId,
      status: 'committed',
      entityType,
      entityId,
      affectedCount: affectedEntities.length,
      affectedEntities,
      executionSurface: toSafeText(executionSurface, 40) || 'external',
      boundaryLevel: toSafeText(boundary?.level, 40),
      verifierStatus: toSafeText(verifier?.status, 20) || 'verified',
      updatedAt,
      summary: toSafeText(runtimeResult?.summary, 240) || `${commandId} -> ${entityType}${entityId ? `:${entityId}` : ''}`,
    };
    appendActionLog({
      ok: true,
      action: commandId,
      canonicalAction,
      actor,
      source,
      requestId,
      executionSurface,
      updatedAt,
      affectedEntities,
      authorization,
      confirmation,
      boundary,
      verifier,
      receipt,
      writeReceipt: runtimeResult?.writeReceipt || null,
      routeMetadata,
    });
    return {
      statusCode: 200,
      payload: {
        ok: true,
        action: commandId,
        canonicalAction,
        pluginId,
        commandId,
        executionTarget: 'plugin-runtime',
        actor,
        source,
        requestId,
        executionSurface,
        authorization,
        confirmation,
        boundary,
        verifier,
        receipt,
        writeReceipt: runtimeResult?.writeReceipt || null,
        entity: {
          type: entityType,
          id: entityId,
          data: cloneJsonSafe(runtimeResult?.entity),
        },
        affectedEntities,
        updatedAt,
        ...(routeMetadata ? { routeMetadata } : {}),
      },
    };
  } catch (error) {
    const updatedAt = new Date().toISOString();
    const failedBoundary = error.boundary || null;
    const failedReceipt = buildFailedActionReceipt(commandId || canonicalAction, executionSurface, failedBoundary, error, updatedAt);
    const failedVerifier = error.verifier && typeof error.verifier === 'object' ? error.verifier : null;
    appendActionLog({
      ok: false,
      action: commandId || 'unknown',
      canonicalAction,
      actor,
      source,
      requestId: requestId || createMorphId('request'),
      executionSurface,
      updatedAt,
      authorization,
      confirmation,
      boundary: failedBoundary,
      verifier: failedVerifier,
      receipt: failedReceipt,
      errorCode: error.code || 'plugin_runtime_command_failed',
      error: error.message || 'plugin runtime command failed',
      errorDetails: buildActionErrorDetails(error),
      routeMetadata,
    });
    return {
      statusCode: Number.isFinite(Number(error.statusCode)) ? Number(error.statusCode) : 400,
      payload: {
        ok: false,
        action: commandId || 'unknown',
        canonicalAction,
        pluginId,
        commandId,
        executionTarget: 'plugin-runtime',
        errorCode: error.code || 'plugin_runtime_command_failed',
        error: error.message || 'plugin runtime command failed',
        executionSurface,
        authorization,
        confirmation,
        boundary: failedBoundary,
        verifier: failedVerifier,
        receipt: failedReceipt,
        errorDetails: buildActionErrorDetails(error),
        ...(routeMetadata ? { routeMetadata } : {}),
      },
    };
  }
}

function shouldForceVerifierFailure(actionName, requestId) {
  const forcedAction = toSafeText(process.env.MORPH_FORCE_VERIFIER_FAILURE_ACTION, 80);
  const forcedRequestId = toSafeText(process.env.MORPH_FORCE_VERIFIER_FAILURE_REQUEST_ID, 160);
  if (!forcedAction || !forcedRequestId) return false;
  return forcedAction === toSafeText(actionName, 80) && forcedRequestId === toSafeText(requestId, 160);
}

function findDailyEntryByDate(data, date) {
  const day = toSafeText(date, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const month = day.slice(0, 7);
  const monthEntry = toSafeObject(data.dailyMonths)[month];
  if (Array.isArray(monthEntry)) return buildLegacyDailyEntryFromMonthBlocks(monthEntry, day);
  return toSafeObject(toSafeObject(monthEntry).days)[day] || null;
}

function extractDailyDateFromHeaderText(value) {
  const match = String(value || '').trim().match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function normalizeLegacyDailyBlock(block, order = 0) {
  const src = block && typeof block === 'object' ? block : {};
  return {
    id: toSafeText(src.id, 120) || `legacy-daily-block-${order}`,
    type: toSafeText(src.type, 60) || 'p',
    text: toSafeText(src.content || src.text, 10000),
    checked: src.checked === true,
    order,
    metadata: toSafeObject(src.metadata),
    createdAt: toSafeText(src.createdAt, 80),
    updatedAt: toSafeText(src.updatedAt, 80),
  };
}

function buildLegacyDailyEntryFromMonthBlocks(blocks, date) {
  const list = toSafeArray(blocks);
  const targetDate = toSafeText(date, 20);
  let headerIndex = -1;
  let nextHeaderIndex = list.length;
  for (let index = 0; index < list.length; index += 1) {
    if (toSafeText(list[index]?.type, 20) !== 'h3') continue;
    if (extractDailyDateFromHeaderText(list[index]?.content || list[index]?.text || '') !== targetDate) continue;
    headerIndex = index;
    for (let cursor = index + 1; cursor < list.length; cursor += 1) {
      if (toSafeText(list[cursor]?.type, 20) === 'h3') {
        nextHeaderIndex = cursor;
        break;
      }
    }
    break;
  }
  if (headerIndex < 0) return null;
  const entryBlocks = list
    .slice(headerIndex + 1, nextHeaderIndex)
    .filter((item) => item && typeof item === 'object' && toSafeText(item.type, 20) !== 'h3')
    .map((item, index) => normalizeLegacyDailyBlock(item, index))
    .filter((item) => item.text || item.type === 'todo');
  return {
    date: targetDate,
    blocks: entryBlocks,
  };
}

function listDailyEntriesForMonth(data, month) {
  const monthKey = toSafeText(month, 20);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return [];
  const monthEntry = toSafeObject(data.dailyMonths)[monthKey];
  if (Array.isArray(monthEntry)) {
    const dates = [];
    toSafeArray(monthEntry).forEach((block) => {
      if (toSafeText(block?.type, 20) !== 'h3') return;
      const date = extractDailyDateFromHeaderText(block?.content || block?.text || '');
      if (date && date.startsWith(`${monthKey}-`) && !dates.includes(date)) dates.push(date);
    });
    return dates
      .sort()
      .map((date) => buildLegacyDailyEntryFromMonthBlocks(monthEntry, date))
      .filter(Boolean)
      .map((entry) => serializeDailyEntry(entry.date, entry));
  }
  const days = toSafeObject(toSafeObject(monthEntry).days);
  return Object.keys(days).sort().map((date) => serializeDailyEntry(date, days[date]));
}

function countDailyEntries(data) {
  const dailyMonths = toSafeObject(data.dailyMonths);
  return Object.keys(dailyMonths).reduce((total, monthKey) => {
    return total + listDailyEntriesForMonth(data, monthKey).length;
  }, 0);
}

function findProjectBlockById(project, blockId) {
  const id = toSafeText(blockId, 120);
  if (!id) return null;
  return toSafeArray(project?.blocks).find((block) => String(block?.id || '').trim() === id) || null;
}

function findProjectReferenceById(project, itemId) {
  const id = toSafeText(itemId, 120);
  if (!id) return null;
  return toSafeArray(project?.items).find((item) => String(item?.id || '').trim() === id) || null;
}

function readStructuredBlockText(block) {
  return toSafeText(block?.content || block?.text, 10000);
}

function normalizeMemoryTargetFile(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (/(^|\/)user\.?md$/.test(raw)) return 'user.md';
  if (/(^|\/)identity\.?md$/.test(raw)) return 'identity.md';
  if (/(^|\/)memory-system\.?md$/.test(raw)) return 'memory-system.md';
  if (/(^|\/)memory\.?md$/.test(raw)) return 'memory.md';
  if (/(^|\/)soul\.?md$/.test(raw)) return 'soul.md';
  return '';
}

function readMemoryDocumentText(data, targetFile = '') {
  const normalizedTarget = normalizeMemoryTargetFile(targetFile) || 'soul.md';
  const aiMemory = toSafeObject(data?.aiMemory);
  const longTermMemory = toSafeObject(aiMemory.longTermMemory);
  if (normalizedTarget === 'identity.md') return toSafeText(aiMemory.identityNotes || longTermMemory.identityNotes, 20000);
  if (normalizedTarget === 'user.md') return toSafeText(aiMemory.user || longTermMemory.user, 20000);
  if (normalizedTarget === 'memory.md') return toSafeText(aiMemory.memoryIndex || longTermMemory.memoryIndex, 20000);
  if (normalizedTarget === 'memory-system.md') return toSafeText(aiMemory.systemNotes || longTermMemory.systemNotes, 20000);
  return toSafeText(aiMemory.soulUserNotes || aiMemory.soul, 20000);
}

function buildActionVerifier(actionName, mutation, payload, data, updatedAt) {
  const action = toSafeText(actionName, 80);
  const entityType = toSafeText(mutation?.entityType, 40);
  const entityId = toSafeText(mutation?.entityId, 120);
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const affectedEntities = toSafeArray(mutation?.affectedEntities);
  const base = {
    ok: true,
    action,
    entity: entityType,
    entityId,
    status: 'not_run',
    oldStatus: '',
    newStatus: '',
    targetDate: '',
    updatedAt: toSafeText(updatedAt, 80),
    blockIds: [],
    userMessage: '',
  };

  if (action === 'create_project') {
    const project = toSafeArray(data.projects).find((item) => String(item?.id || '').trim() === entityId);
    const fixedThoughtId = toSafeText(mutation?.entity?.sourceThought?.id, 120);
    const fixedThought = toSafeArray(data.fixed).find((item) => String(item?.id || '').trim() === fixedThoughtId);
    const ok = !!(project && fixedThought && String(project.sourceThought?.id || '').trim() === fixedThoughtId);
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      newStatus: toSafeText(project?.status || mutation?.entity?.status, 40),
      userMessage: ok ? '项目与关联定念已创建。' : '项目创建后的对象落点没有通过校验。',
    };
  }

  if (action === 'create_routine') {
    const routine = toSafeArray(data.routines).find((item) => String(item?.id || '').trim() === entityId);
    const ok = !!routine;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      newStatus: toSafeText(routine?.status || mutation?.entity?.status, 40),
      userMessage: ok ? '例行事项已创建。' : '例行事项创建后的对象落点没有通过校验。',
    };
  }

  if (action === 'update_project_status') {
    const project = toSafeArray(data.projects).find((item) => String(item?.id || '').trim() === entityId);
    const expectedStatus = toSafeText(safePayload.status, 40);
    const actualStatus = toSafeText(project?.status || mutation?.entity?.status, 40);
    const ok = !!project && !!expectedStatus && expectedStatus === actualStatus;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      newStatus: actualStatus,
      userMessage: ok ? '项目状态已完成更新。' : '项目状态更新后的结果没有通过校验。',
    };
  }

  if (action === 'rename_project') {
    const project = toSafeArray(data.projects).find((item) => String(item?.id || '').trim() === entityId);
    const expectedName = toSafeText(safePayload.newName || safePayload.name, 160);
    const actualName = toSafeText(project?.name || mutation?.entity?.name, 160);
    const ok = !!project && !!expectedName && expectedName === actualName;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      userMessage: ok ? '项目名称已完成更新。' : '项目改名后的结果没有通过校验。',
    };
  }

  if (action === 'complete_reminder') {
    const reminder = toSafeArray(data.reminders).find((item) => String(item?.id || '').trim() === entityId);
    const completedAt = toSafeText(reminder?.completedAt || mutation?.entity?.completedAt, 80);
    const ok = !!reminder && !!completedAt;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      newStatus: completedAt ? 'done' : '',
      userMessage: ok ? '提醒已标记为完成。' : '提醒完成状态没有通过校验。',
    };
  }

  if (action === 'create_reminder' || action === 'add_reminder') {
    const reminder = toSafeArray(data.reminders).find((item) => String(item?.id || '').trim() === entityId);
    const ok = !!reminder;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      newStatus: toSafeText(reminder?.completedAt, 80) ? 'done' : 'active',
      userMessage: ok ? '提醒已创建。' : '提醒创建后的对象落点没有通过校验。',
    };
  }

  if (action === 'add_expense_record') {
    const records = toSafeArray(data?.expenseLedger?.records);
    const expectedAmount = Number.isFinite(Number(safePayload.amount)) ? Number(safePayload.amount) : null;
    const expectedItem = toSafeText(safePayload.item || safePayload.text || safePayload.title, 240);
    const record = records.find((item) => String(item?.id || '').trim() === entityId)
      || records.find((item) => {
        const itemOk = expectedItem ? toSafeText(item?.item, 240) === expectedItem : false;
        const amountOk = expectedAmount != null ? Number(item?.amount) === expectedAmount : false;
        return itemOk && amountOk;
      });
    const ok = !!record;
    return {
      ...base,
      ok,
      entity: 'expenseRecord',
      status: ok ? 'verified' : 'failed',
      userMessage: ok ? '记账已写入账本。' : '记账写入后的结果没有通过校验。',
    };
  }

  if (['memory_write_user', 'write_soul_memory', 'memory_rewrite_section'].includes(action)) {
    const targetFile = normalizeMemoryTargetFile(
      mutation?.entity?.targetFile || safePayload.targetFile || safePayload.file || safePayload.memoryFile || safePayload.targetPath || ''
    ) || (action === 'memory_write_user' ? 'user.md' : 'soul.md');
    const expectedContent = toSafeText(safePayload.content || safePayload.text, 4000);
    const documentText = readMemoryDocumentText(data, targetFile);
    const ok = !!expectedContent && !!documentText && documentText.includes(expectedContent);
    return {
      ...base,
      ok,
      entity: 'memoryDocument',
      entityId: targetFile,
      status: ok ? 'verified' : 'failed',
      userMessage: ok
        ? toSafeText(mutation?.entity?.receiptLabel, 240) || `记忆文件已更新：${targetFile}`
        : `记忆文件写入后的结果没有通过校验：${targetFile}`,
    };
  }

  if (action === 'append_daily_log' || action === 'append_daily_log_under_date') {
    const targetDate = toSafeText(mutation?.entity?.date || entityId || safePayload.date, 20);
    const entry = findDailyEntryByDate(data, targetDate);
    const blockIds = affectedEntities
      .filter((item) => String(item?.type || '').trim() === 'dailyBlock')
      .map((item) => toSafeText(item.id, 120))
      .filter(Boolean);
    const ok = !!entry && blockIds.length > 0 && blockIds.every((id) => toSafeArray(entry.blocks).some((block) => String(block?.id || '').trim() === id));
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      targetDate,
      blockIds,
      userMessage: ok ? '日志内容已写入目标日期。' : '日志写入后的 block 落点没有通过校验。',
    };
  }

  if (action === 'update_daily_log_entry') {
    const targetDate = toSafeText(safePayload.date || mutation?.entity?.date, 20);
    const entry = findDailyEntryByDate(data, targetDate);
    const targetBlockId = toSafeText(safePayload.blockId || safePayload.id, 120);
    const expectedContent = toSafeText(safePayload.newText || safePayload.textNew || safePayload.toText || safePayload.content, 10000);
    const targetBlock = targetBlockId
      ? toSafeArray(entry?.blocks).find((block) => String(block?.id || '').trim() === targetBlockId)
      : null;
    const ok = !!entry && !!expectedContent && (
      (targetBlockId && !!targetBlock && readStructuredBlockText(targetBlock) === expectedContent)
      || (!targetBlockId && toSafeArray(entry?.blocks).some((block) => readStructuredBlockText(block) === expectedContent))
    );
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      targetDate,
      blockIds: targetBlockId ? [targetBlockId] : [],
      userMessage: ok ? '日志条目已完成更新。' : '日志条目更新后的结果没有通过校验。',
    };
  }

  if (action === 'delete_daily_log_entry') {
    const targetDate = toSafeText(safePayload.date || mutation?.entity?.date, 20);
    const entry = findDailyEntryByDate(data, targetDate);
    const targetBlockId = toSafeText(safePayload.blockId || safePayload.id, 120);
    const targetText = toSafeText(safePayload.text, 10000);
    const stillExists = !!entry && (
      (targetBlockId && toSafeArray(entry?.blocks).some((block) => String(block?.id || '').trim() === targetBlockId))
      || (!targetBlockId && !!targetText && toSafeArray(entry?.blocks).some((block) => readStructuredBlockText(block) === targetText))
    );
    const ok = !stillExists;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      targetDate,
      blockIds: targetBlockId ? [targetBlockId] : [],
      userMessage: ok ? '日志条目已删除。' : '日志条目删除后的结果没有通过校验。',
    };
  }

  if (action === 'create_flash_thought') {
    const flashThought = toSafeArray(data.flashThoughts).find((item) => String(item?.id || '').trim() === entityId);
    const ok = !!flashThought;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      userMessage: ok ? '闪念已创建。' : '闪念创建后的对象落点没有通过校验。',
    };
  }

  if (action === 'add_fixed_thought') {
    const fixedThought = toSafeArray(data.fixed).find((item) => String(item?.id || '').trim() === entityId);
    const ok = !!fixedThought;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      userMessage: ok ? '定念已创建。' : '定念创建后的对象落点没有通过校验。',
    };
  }

  if (action === 'archive_flash_thought') {
    const archived = toSafeArray(data.completedFlashThoughts).find((item) => String(item?.id || '').trim() === entityId);
    const stillActive = toSafeArray(data.flashThoughts).some((item) => String(item?.id || '').trim() === entityId);
    const ok = !!archived && !stillActive && toSafeText(archived.status, 20) === 'archived';
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      newStatus: toSafeText(archived?.status, 20),
      userMessage: ok ? '闪念已归档。' : '闪念归档后的状态没有通过校验。',
    };
  }

  if (action === 'append_project_block') {
    const project = toSafeArray(data.projects).find((item) => String(item?.id || '').trim() === entityId);
    const blockIds = affectedEntities
      .filter((item) => String(item?.type || '').trim() === 'projectBlock')
      .map((item) => toSafeText(item.id, 120))
      .filter(Boolean);
    const ok = !!project && blockIds.length > 0 && blockIds.every((id) => toSafeArray(project.blocks).some((block) => String(block?.id || '').trim() === id));
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      blockIds,
      userMessage: ok ? '项目块已追加。' : '项目块追加后的落点没有通过校验。',
    };
  }

  if (action === 'update_project_block') {
    const project = toSafeArray(data.projects).find((item) => String(item?.id || '').trim() === entityId);
    const targetBlockId = toSafeText(safePayload.blockId || safePayload.id, 120);
    const expectedContent = toSafeText(safePayload.newContent || safePayload.content, 10000);
    const block = findProjectBlockById(project, targetBlockId);
    const ok = !!project && !!targetBlockId && !!expectedContent && !!block && readStructuredBlockText(block) === expectedContent;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      blockIds: targetBlockId ? [targetBlockId] : [],
      userMessage: ok ? '项目块已完成更新。' : '项目块更新后的结果没有通过校验。',
    };
  }

  if (action === 'delete_project_block') {
    const project = toSafeArray(data.projects).find((item) => String(item?.id || '').trim() === entityId);
    const targetBlockId = toSafeText(safePayload.blockId || safePayload.id, 120);
    const stillExists = !!project && !!targetBlockId && !!findProjectBlockById(project, targetBlockId);
    const ok = !!targetBlockId && !stillExists;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      blockIds: targetBlockId ? [targetBlockId] : [],
      userMessage: ok ? '项目块已删除。' : '项目块删除后的结果没有通过校验。',
    };
  }

  if (action === 'add_project_reference') {
    const project = toSafeArray(data.projects).find((item) => String(item?.id || '').trim() === entityId);
    const referenceIds = affectedEntities
      .filter((item) => String(item?.type || '').trim() === 'projectReference')
      .map((item) => toSafeText(item.id, 120))
      .filter(Boolean);
    const ok = !!project && referenceIds.length > 0 && referenceIds.every((id) => toSafeArray(project.items).some((item) => String(item?.id || '').trim() === id));
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      userMessage: ok ? '项目参考已追加。' : '项目参考追加后的落点没有通过校验。',
    };
  }

  if (action === 'update_project_reference') {
    const project = toSafeArray(data.projects).find((item) => String(item?.id || '').trim() === entityId);
    const itemId = toSafeText(safePayload.itemId || safePayload.id, 120);
    const expectedText = toSafeText(safePayload.newText || safePayload.text, 10000);
    const item = findProjectReferenceById(project, itemId);
    const ok = !!project && !!itemId && !!expectedText && !!item && toSafeText(item?.text, 10000) === expectedText;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      userMessage: ok ? '项目参考已完成更新。' : '项目参考更新后的结果没有通过校验。',
    };
  }

  if (action === 'delete_project_reference') {
    const project = toSafeArray(data.projects).find((item) => String(item?.id || '').trim() === entityId);
    const itemId = toSafeText(safePayload.itemId || safePayload.id, 120);
    const stillExists = !!project && !!itemId && !!findProjectReferenceById(project, itemId);
    const ok = !!itemId && !stillExists;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      userMessage: ok ? '项目参考已删除。' : '项目参考删除后的结果没有通过校验。',
    };
  }

  if (action === 'delete_project') {
    const stillExists = toSafeArray(data.projects).some((item) => String(item?.id || '').trim() === entityId);
    const ok = !!entityId && !stillExists;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      userMessage: ok ? '项目已删除。' : '项目删除后的结果没有通过校验。',
    };
  }

  if (action === 'update_reminder') {
    const reminder = toSafeArray(data.reminders).find((item) => String(item?.id || '').trim() === entityId);
    const expectedText = toSafeText(safePayload.newText || safePayload.textNew || safePayload.toText, 1000);
    const expectedDatetime = toSafeText(safePayload.newDatetime || safePayload.datetimeNew || safePayload.toDatetime || safePayload.datetime || safePayload.dueAt, 120);
    const actualText = toSafeText(reminder?.text || reminder?.title, 1000);
    const actualDatetime = toSafeText(reminder?.dueAtText || reminder?.dueAt, 120);
    const textOk = expectedText ? expectedText === actualText : true;
    const timeOk = expectedDatetime ? expectedDatetime === actualDatetime : true;
    const ok = !!reminder && textOk && timeOk;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      newStatus: toSafeText(reminder?.completedAt, 80) ? 'done' : 'active',
      userMessage: ok ? '提醒已完成更新。' : '提醒更新后的结果没有通过校验。',
    };
  }

  if (action === 'delete_reminder') {
    const stillExists = toSafeArray(data.reminders).some((item) => String(item?.id || '').trim() === entityId);
    const ok = !!entityId && !stillExists;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      userMessage: ok ? '提醒已删除。' : '提醒删除后的结果没有通过校验。',
    };
  }

  if (action === 'create_sop') {
    const sop = toSafeArray(data.sops).find((item) => String(item?.id || '').trim() === entityId);
    const ok = !!sop;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      newStatus: toSafeText(sop?.status || mutation?.entity?.status, 40),
      userMessage: ok ? 'SOP 已创建。' : 'SOP 创建后的对象落点没有通过校验。',
    };
  }

  if (action === 'link_entities') {
    const fromType = normalizeEntityType(safePayload.fromType);
    const toType = normalizeEntityType(safePayload.toType);
    const fromId = toSafeText(safePayload.fromId, 120);
    const toId = toSafeText(safePayload.toId, 120);
    const fromEntity = findMorphEntityByType(data, fromType, fromId);
    const toEntity = findMorphEntityByType(data, toType, toId);
    const forwardOk = toSafeArray(fromEntity?.links).some((item) => String(item?.type || '').trim() === toType && String(item?.targetId || '').trim() === toId);
    const reverseOk = toSafeArray(toEntity?.links).some((item) => String(item?.type || '').trim() === fromType && String(item?.targetId || '').trim() === fromId);
    const ok = !!fromEntity && !!toEntity && forwardOk && reverseOk;
    return {
      ...base,
      ok,
      status: ok ? 'verified' : 'failed',
      userMessage: ok ? '双向链接已写入。' : '实体链接没有完整写入双向关系。',
    };
  }

  return base;
}

function buildMorphCapabilitiesPayload(options = {}) {
  const apiContractVersion = toSafeText(options.apiContractVersion, 80) || '2026-03-17.stage2';
  const requireExplicitPermissions = options.requireExplicitPermissions === true;
  const currentData = options.currentData && typeof options.currentData === 'object' ? options.currentData : {};
  const pluginRuntimeRegistry = buildMorphPluginRuntimeRegistry({
    atlasStore: options.atlasStore,
  });
  const actionSpecs = morphActionRegistry.listActionSpecs();
  const actionSourceOfTruth = typeof morphActionRegistry.getSourceOfTruth === 'function'
    ? morphActionRegistry.getSourceOfTruth()
    : {
        actionIdentity: 'morph-runtime/action-registry.json',
        actionPolicy: 'morph-runtime/action-registry.json',
        boundarySource: 'morph-runtime/action-registry.json#actions[*].boundary',
        derivedBoundaryManifest: 'morph-runtime/action-boundaries.json',
        connectorRole: 'adapter-only',
      };
  const exposedActions = actionSpecs.filter((spec) => spec && spec.enabled !== false);
  const blockedActions = actionSpecs.filter((spec) => spec && spec.enabled === false);
  const actionSpecMap = new Map(actionSpecs.map((spec) => [toSafeText(spec?.action, 120), spec]).filter((entry) => entry[0]));
  const extensionCatalog = loadMorphExtensionCatalog();
  const readablePlugins = extensionCatalog
    .map((definition) => buildReadablePluginDescriptor(definition, currentData, extensionCatalog))
    .filter(Boolean);
  const executablePluginCommands = extensionCatalog.flatMap((definition) => buildExecutablePluginCommandDescriptors(
    definition,
    currentData,
    actionSpecMap,
    extensionCatalog,
    pluginRuntimeRegistry
  ));
  const pluginBuilderStatus = getMorphPluginBuilderSkillStatus({
    skillRoot: DEFAULT_MORPH_PLUGIN_BUILDER_SKILL_ROOT,
  });
  return {
    ok: true,
    domain: 'morph',
    fetchedAt: new Date().toISOString(),
    phase: 'stage-2-integration',
    apiContractVersion,
    connectorCompatibility: {
      minimumConnectorVersion: '0.1.0',
      recommendedConnectorVersion: '0.1.0',
    },
    pluginNamespace: {
      stateRoot: 'pluginData',
      heavyDataRoot: 'data/plugins/<pluginId>/',
      secretsRoot: 'secureVault.plugins[pluginId]',
    },
    queryEndpoints: [
      {
        method: 'GET',
        path: '/api/morph/capabilities',
        kind: 'capabilities',
        description: 'Discover Morpheus query/action capabilities for external agents and connectors.',
      },
      {
        method: 'GET',
        path: '/api/morph/summary',
        kind: 'summary',
        description: 'Read top-level counts, sync meta, and reminder/project status snapshot.',
      },
      {
        method: 'GET',
        path: '/api/morph/projects',
        kind: 'collection',
        entityType: 'project',
      },
      {
        method: 'GET',
        path: '/api/morph/reminders',
        kind: 'collection',
        entityType: 'reminder',
      },
      {
        method: 'GET',
        path: '/api/morph/sops',
        kind: 'collection',
        entityType: 'sop',
      },
      {
        method: 'GET',
        path: '/api/morph/flash-thoughts',
        kind: 'collection',
        entityType: 'flashThought',
      },
      {
        method: 'GET',
        path: '/api/morph/daily?month=YYYY-MM',
        kind: 'collection',
        entityType: 'daily',
      },
      {
        method: 'GET',
        path: '/api/morph/entity?id=...&type=...',
        kind: 'entity',
      },
      {
        method: 'GET',
        path: '/api/morph/plugins',
        kind: 'collection',
        entityType: 'plugin',
      },
      {
        method: 'GET',
        path: '/api/morph/plugin?pluginId=...',
        kind: 'entity',
        entityType: 'plugin',
      },
      {
        method: 'GET',
        path: '/api/morph/plugin-builder/capabilities',
        kind: 'capabilities',
        entityType: 'pluginBuilder',
      },
      {
        method: 'POST',
        path: '/api/morph/plugin-builder/workpacket',
        kind: 'workflow',
        entityType: 'pluginBuilder',
      },
      {
        method: 'POST',
        path: '/api/morph/plugin-builder/create',
        kind: 'workflow',
        entityType: 'pluginBuilder',
      },
      {
        method: 'POST',
        path: '/api/morph/plugin-builder/install',
        kind: 'workflow',
        entityType: 'pluginBuilder',
      },
      {
        method: 'POST',
        path: '/api/morph/plugin-builder/create-and-install',
        kind: 'workflow',
        entityType: 'pluginBuilder',
      },
      {
        method: 'POST',
        path: '/api/morph/plugin-builder/implement-existing',
        kind: 'workflow',
        entityType: 'pluginBuilder',
      },
      {
        method: 'GET',
        path: '/api/morph/plugin-builder/jobs/:jobId',
        kind: 'workflow-status',
        entityType: 'pluginBuilder',
      },
      {
        method: 'POST',
        path: '/api/morph/plugin-builder/jobs/:jobId/retry',
        kind: 'workflow',
        entityType: 'pluginBuilder',
      },
    ],
    pluginApi: {
      method: 'GET',
      listPath: '/api/morph/plugins',
      detailPath: '/api/morph/plugin?pluginId=...',
      commandExecutePathTemplate: '/api/morph/plugins/:pluginId/commands/:commandId',
      disabledPluginPolicy: 'return 403 plugin_disabled when the plugin is turned off',
      readablePlugins,
      executableCommands: executablePluginCommands,
    },
    pluginBuilderApi: {
      available: pluginBuilderStatus.available,
      skillRoot: pluginBuilderStatus.skillRoot,
      scripts: pluginBuilderStatus.scripts,
      supportsCreateWorkpacket: true,
      supportsCreateScaffold: true,
      supportsInstallGeneratedPlugin: true,
      supportsCreateAndInstall: true,
      supportsExistingPluginImplementation: true,
      supportsAsyncJobs: true,
      supportsJobRetry: true,
      supportsIdempotentAsyncStart: true,
      supportsWorkspaceCodeMutation: true,
      workflow: {
        capabilitiesPath: '/api/morph/plugin-builder/capabilities',
        workpacketPath: '/api/morph/plugin-builder/workpacket',
        createPath: '/api/morph/plugin-builder/create',
        installPath: '/api/morph/plugin-builder/install',
        createAndInstallPath: '/api/morph/plugin-builder/create-and-install',
        implementExistingPath: '/api/morph/plugin-builder/implement-existing',
        jobStatusPathTemplate: '/api/morph/plugin-builder/jobs/:jobId',
        retryJobPathTemplate: '/api/morph/plugin-builder/jobs/:jobId/retry',
      },
      constraints: [
        'requires a writable Morpheus workspace root on the local server',
        'creates plugin source files under extensions/<pluginId>/',
        'installs into data/extensions/local-plugin-catalog/state.json so the plugin appears in the plugin page',
        'existing-plugin implementation is limited to the active plugin allowlist plus minimal host glue files',
        'AI source edits now use a controlled patch protocol: plugin-owned files may upsert, host glue files are search_replace only',
      ],
    },
    actionApi: {
      method: 'POST',
      path: '/api/morph/actions/:actionName',
      sourceOfTruth: {
        actionIdentity: actionSourceOfTruth.actionIdentity,
        actionPolicy: actionSourceOfTruth.actionPolicy,
        boundarySource: actionSourceOfTruth.boundarySource,
        derivedBoundaryManifest: actionSourceOfTruth.derivedBoundaryManifest,
        connectorRole: actionSourceOfTruth.connectorRole,
      },
      authorizationPolicy: {
        explicitPermissionsRequired: requireExplicitPermissions,
        legacyImplicitAllowed: requireExplicitPermissions !== true,
      },
      envelope: {
        actor: 'string',
        source: 'string',
        requestId: 'string',
        permissions: ['read | append | update | archive | admin'],
        confirmation: {
          confirmed: 'boolean',
          reason: 'string',
          scope: 'string',
          targetIds: ['string'],
        },
        payload: 'object',
      },
      boundaryPolicy: {
        externalAgentsMayExecuteOnly: 'allowed',
        trustedManualSurfaceMayExecute: 'confirm-required with explicit confirmation',
        unregisteredDefault: 'disabled',
      },
      actions: exposedActions.map((spec) => ({
        action: spec.action,
        permission: spec.permission,
        domain: spec.domain,
        risk: spec.risk,
        confirmationRequired: spec.confirmationRequired === true,
        enabled: spec.enabled !== false,
        reason: spec.enabled === false ? spec.reason : '',
        boundaryLevel: spec.boundaryLevel || '',
      })),
      blockedActions: blockedActions.map((spec) => ({
        action: spec.action,
        permission: spec.permission,
        domain: spec.domain,
        risk: spec.risk,
        enabled: false,
        reason: spec.reason || '',
        boundaryLevel: spec.boundaryLevel || '',
        handlerAvailable: spec.handlerAvailable === true,
      })),
    },
    executionMainline: {
      defaultOwner: 'external-agent',
      hostRole: 'state-boundary-receipt',
      connectorRole: 'adapter-only',
      builtinAiRole: 'light-entry-fallback',
      builtinAiMayFallbackWithoutExternalAgent: true,
      externalAgentDefaultFor: [
        'tool-choice',
        'multi-step-orchestration',
        'cross-tool-execution',
        'complex-write-planning',
      ],
      builtinAiDefaultFor: [
        'chat-companion',
        'clarification',
        'confirmation',
        'receipt-presentation',
        'explanation-summary',
      ],
    },
    syncApi: {
      method: 'POST',
      path: '/api/sync',
      defaultExternalWrite: false,
      reservedFor: [
        'ui-internal-sync',
        'data-import-restore',
        'low-frequency-full-snapshot-write',
      ],
    },
  };
}

async function handleMorphApiRequest(req, res, context) {
  const {
    url,
    host,
    port,
    sendJson,
    readRequestBody,
    readCurrentLiveData,
    normalizeData,
    persistMorphData,
    commitMorphWrite,
    appendActionLog,
    atlasStore,
    apiContractVersion,
    requireExplicitPermissions,
  } = context;

  const readMorphDataSnapshot = (options = {}) => {
    if (options && options.clone === true) {
      return readIsolatedLiveDataSnapshot(readCurrentLiveData, normalizeData);
    }
    return (typeof readCurrentLiveData === 'function' ? readCurrentLiveData() : null) || normalizeData({});
  };
  const commitWrite = typeof commitMorphWrite === 'function'
    ? commitMorphWrite
    : ((data, options = {}) => {
        const persisted = persistMorphData(data, options.source || 'api/morph');
        return {
          ok: true,
          savedAt: new Date().toISOString(),
          snapshot: persisted.snapshot,
          mirror: persisted.mirror,
          writeReceipt: {
            ok: true,
            type: 'canonical_write',
            pipeline: 'morph-canonical-write',
            status: 'committed',
            source: String(options.source || 'api/morph').trim() || 'api/morph',
            reason: 'morph_action_committed',
            canonicalStore: {
              kind: 'live-data-json',
              relativePath: 'data/live-data.json',
            },
            snapshot: persisted.snapshot,
            mirror: persisted.mirror,
            savedAt: new Date().toISOString(),
          },
        };
      });

  if (req.method === 'GET' && url === '/api/morph/capabilities') {
    return sendJson(res, 200, buildMorphCapabilitiesPayload({
      apiContractVersion,
      requireExplicitPermissions,
      currentData: readMorphDataSnapshot(),
      atlasStore,
    })), true;
  }

  if (req.method === 'GET' && url === '/api/morph/summary') {
    return sendJson(res, 200, buildMorphSummaryPayload(readMorphDataSnapshot())), true;
  }

  if (req.method === 'GET' && url === '/api/morph/projects') {
    const data = readMorphDataSnapshot();
    sendJson(res, 200, {
      ok: true,
      domain: 'morph',
      type: 'project',
      items: toSafeArray(data.projects).map((item) => serializeProject(item)),
      count: toSafeArray(data.projects).length,
      fetchedAt: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/morph/reminders') {
    const data = readMorphDataSnapshot();
    sendJson(res, 200, {
      ok: true,
      domain: 'morph',
      type: 'reminder',
      items: toSafeArray(data.reminders).map((item) => serializeReminder(item)),
      count: toSafeArray(data.reminders).length,
      fetchedAt: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/morph/sops') {
    const data = readMorphDataSnapshot();
    sendJson(res, 200, {
      ok: true,
      domain: 'morph',
      type: 'sop',
      items: toSafeArray(data.sops).map((item) => serializeSop(item)),
      count: toSafeArray(data.sops).length,
      fetchedAt: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/morph/flash-thoughts') {
    const data = readMorphDataSnapshot();
    const flashThoughts = toSafeArray(data.flashThoughts);
    sendJson(res, 200, {
      ok: true,
      domain: 'morph',
      type: 'flashThought',
      items: sortThoughtsNewestFirst(flashThoughts).map((item) => serializeFlashThought(item)),
      count: flashThoughts.length,
      fetchedAt: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/morph/daily') {
    const reqUrl = new URL(req.url || '/api/morph/daily', `http://${host}:${port}`);
    const month = toSafeText(reqUrl.searchParams.get('month'), 20);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      sendJson(res, 400, { ok: false, error: 'month must be in YYYY-MM format' });
      return true;
    }
    const data = readMorphDataSnapshot();
    const items = listDailyEntriesForMonth(data, month);
    sendJson(res, 200, {
      ok: true,
      domain: 'morph',
      type: 'daily',
      month,
      items,
      count: items.length,
      fetchedAt: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/morph/entity') {
    const reqUrl = new URL(req.url || '/api/morph/entity', `http://${host}:${port}`);
    const id = toSafeText(reqUrl.searchParams.get('id'), 120);
    const type = normalizeEntityType(reqUrl.searchParams.get('type'));
    if (!id) {
      sendJson(res, 400, { ok: false, error: 'id is required' });
      return true;
    }
    if (!type) {
      sendJson(res, 400, { ok: false, error: 'type is required and must be valid' });
      return true;
    }
    const data = readMorphDataSnapshot();
    const entity = findMorphEntityByType(data, type, id);
    if (!entity) {
      sendJson(res, 404, { ok: false, error: 'entity not found', type, id });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      domain: 'morph',
      type,
      id,
      entity,
      fetchedAt: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/morph/plugins') {
    const data = readMorphDataSnapshot();
    const extensionCatalog = loadMorphExtensionCatalog();
    const items = extensionCatalog
      .map((definition) => buildReadablePluginDescriptor(definition, data, extensionCatalog))
      .filter(Boolean);
    sendJson(res, 200, {
      ok: true,
      domain: 'morph',
      type: 'plugin',
      items,
      count: items.length,
      fetchedAt: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/morph/plugin') {
    const reqUrl = new URL(req.url || '/api/morph/plugin', `http://${host}:${port}`);
    const pluginId = toSafeText(reqUrl.searchParams.get('pluginId'), 120);
    if (!pluginId) {
      sendJson(res, 400, { ok: false, error: 'pluginId is required', errorCode: 'missing_plugin_id' });
      return true;
    }
    const data = readMorphDataSnapshot();
    const extensionCatalog = loadMorphExtensionCatalog();
    const definition = extensionCatalog.find((entry) => toSafeText(entry?.id, 120) === pluginId);
    if (!definition) {
      sendJson(res, 404, { ok: false, error: 'plugin not found', errorCode: 'plugin_not_found', pluginId });
      return true;
    }
    if (!isExtensionAIReadable(definition)) {
      sendJson(res, 403, { ok: false, error: 'plugin is not exposed for AI or external agent reads', errorCode: 'plugin_not_ai_readable', pluginId });
      return true;
    }
    if (!isMorphExtensionEnabled(data, pluginId, extensionCatalog)) {
      sendJson(res, 403, { ok: false, error: 'plugin is disabled', errorCode: 'plugin_disabled', pluginId });
      return true;
    }
    const projection = readExtensionStateProjection(data, definition);
    sendJson(res, 200, {
      ok: true,
      domain: 'morph',
      type: 'plugin',
      pluginId,
      enabled: true,
      name: toSafeText(definition?.name, 160),
      summary: toSafeText(definition?.summary, 240),
      readableEntities: buildExtensionReadableEntities(definition),
      requiredPermissions: toSafeArray(definition?.permissions)
        .filter((item) => item && (item.aiReadable === true || ['health', 'data'].includes(toSafeText(item.scope, 40))))
        .map((item) => ({
          id: toSafeText(item?.id, 120),
          scope: toSafeText(item?.scope, 40),
          required: item?.required !== false,
        }))
        .filter((item) => item.id),
      dataModel: cloneJsonSafe(definition?.dataModel && typeof definition.dataModel === 'object' ? definition.dataModel : {}),
      dataAvailable: !!projection,
      data: serializePluginReadableData(pluginId, projection),
      fetchedAt: new Date().toISOString(),
    });
    return true;
  }

  const pluginCommandRoute = req.method === 'POST' ? matchPluginCommandExecutionRoute(url) : null;
  if (pluginCommandRoute) {
    const { pluginId, commandId } = pluginCommandRoute;
    const extensionCatalog = loadMorphExtensionCatalog();
    const data = readMorphDataSnapshot();
    const actionSpecs = morphActionRegistry.listActionSpecs();
    const actionSpecMap = new Map(actionSpecs.map((spec) => [toSafeText(spec?.action, 120), spec]).filter((entry) => entry[0]));
    const pluginRuntimeRegistry = buildMorphPluginRuntimeRegistry({ atlasStore });
    const resolvedCommand = resolveExecutablePluginCommand(extensionCatalog, data, actionSpecMap, pluginRuntimeRegistry, pluginId, commandId);
    if (!resolvedCommand.ok) {
      sendJson(res, resolvedCommand.statusCode || 400, {
        ok: false,
        error: resolvedCommand.error || 'plugin command resolution failed',
        errorCode: resolvedCommand.errorCode || 'plugin_command_resolution_failed',
        pluginId: toSafeText(resolvedCommand.pluginId, 120) || toSafeText(pluginId, 120),
        commandId: toSafeText(resolvedCommand.commandId, 120) || toSafeText(commandId, 120),
        executionTarget: toSafeText(resolvedCommand.executionTarget, 80),
        hostAction: toSafeText(resolvedCommand.hostAction, 120),
      });
      return true;
    }
    const raw = await readRequestBody(req);
    const parsed = raw ? JSON.parse(raw) : {};
    const body = parsed && typeof parsed === 'object' ? parsed : {};
    const routeMetadata = {
      kind: 'plugin-command',
      pluginCommand: {
        pluginId: resolvedCommand.descriptor.pluginId,
        pluginName: resolvedCommand.descriptor.pluginName,
        commandId: resolvedCommand.descriptor.commandId,
        label: resolvedCommand.descriptor.label,
        executionTarget: resolvedCommand.descriptor.executionTarget,
        permission: resolvedCommand.descriptor.permission,
        boundaryLevel: resolvedCommand.descriptor.boundaryLevel,
        hostAction: resolvedCommand.descriptor.hostAction,
        executePath: resolvedCommand.descriptor.executePath,
        hostActionPath: resolvedCommand.descriptor.hostActionPath,
      },
    };
    const result = resolvedCommand.descriptor.executionTarget === 'plugin-runtime'
      ? await executeMorphPluginRuntimeCommandRequest({
          req,
          descriptor: resolvedCommand.descriptor,
          handler: resolvedCommand.runtimeHandler,
          body,
          appendActionLog,
          requireExplicitPermissions,
          routeMetadata,
        })
      : await executeMorphActionRequest({
          req,
          actionName: resolvedCommand.descriptor.hostAction,
          body,
          readMorphDataSnapshot,
          commitWrite,
          appendActionLog,
          requireExplicitPermissions,
          routeMetadata,
        });
    sendJson(res, result.statusCode, result.payload);
    return true;
  }

  if (req.method === 'POST' && url.startsWith('/api/morph/actions/')) {
    const actionName = normalizeActionName(url.slice('/api/morph/actions/'.length));
    if (!actionName) {
      sendJson(res, 400, { ok: false, error: 'action name is required' });
      return true;
    }
    const raw = await readRequestBody(req);
    const parsed = raw ? JSON.parse(raw) : {};
    const body = parsed && typeof parsed === 'object' ? parsed : {};
    const result = await executeMorphActionRequest({
      req,
      actionName,
      body,
      readMorphDataSnapshot,
      commitWrite,
      appendActionLog,
      requireExplicitPermissions,
    });
    sendJson(res, result.statusCode, result.payload);
    return true;
  }

  return false;
}

module.exports = {
  handleMorphApiRequest,
};
