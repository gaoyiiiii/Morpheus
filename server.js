#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalizeData, generateMarkdownMirror, writeLiveSnapshot } = require('./scripts/markdown-mirror-lib');
const { createGlucoseBridge } = require('./scripts/glucose-bridge');
const { createGlucoseConfigStore } = require('./scripts/connectors/glucose-config-store');
const { createFeishuStore } = require('./scripts/connectors/feishu-store');
const { createFeishuAIConfigStore } = require('./scripts/connectors/feishu-ai-config-store');
const { handleGlucoseApiRequest } = require('./scripts/connectors/glucose-api');
const { handleFeishuApiRequest } = require('./scripts/connectors/feishu-api');
const { createFeishuBotRuntime } = require('./scripts/connectors/feishu-bot-runtime');
const { createAtlasStore } = require('./scripts/connectors/atlas-store');
const { handleAtlasApiRequest } = require('./scripts/connectors/atlas-api');
const { createAgentStore } = require('./scripts/connectors/agent-store');
const { handleAgentApiRequest } = require('./scripts/connectors/agent-api');
const { handleCodexRemoteApiRequest } = require('./scripts/connectors/codex-remote-api');
const { handleMorphApiRequest } = require('./scripts/connectors/morph-api');
const { createMorphPluginBuilderApi } = require('./scripts/connectors/morph-plugin-builder-api');
const { getSyncRevision, handleMorphSyncRequest } = require('./scripts/connectors/morph-sync-route');
const { createMorphSyncEvents } = require('./scripts/connectors/morph-sync-events');
const { createStaticBootstrapInjection } = require('./scripts/connectors/static-bootstrap-injection');
const { createWebSearchRoute } = require('./scripts/connectors/web-search-route');
const { createAIProxyRoute } = require('./scripts/connectors/ai-proxy-route');
const { createServerHttpUtils } = require('./scripts/connectors/server-http-utils');
const { createStaticFileRoute } = require('./scripts/connectors/static-file-route');
const { createServerApiRoute } = require('./scripts/connectors/server-api-route');
const { createServerBootstrap } = require('./scripts/connectors/server-bootstrap');
const { createLiveDataStore } = require('./scripts/connectors/live-data-store');
const { resolveMorphStoragePaths } = require('./scripts/connectors/morph-storage-paths');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 2199);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MORPH_STORAGE = resolveMorphStoragePaths({
  rootDir: ROOT,
  env: process.env,
  existsSync: fs.existsSync,
  homedir: os.homedir(),
});
const MORPH_ICLOUD_ROOT = MORPH_STORAGE.iCloudRoot;
const VIDEO_OPS_ROOT = String(process.env.MORPH_ATLAS_ROOT || '').trim() || path.join(MORPH_ICLOUD_ROOT, '视频运营');
const LIVE_DATA_FILE = MORPH_STORAGE.liveDataFile;
const MORPH_MD_MIRROR_DIR = MORPH_STORAGE.mirrorDir;
const MORPH_ACTION_LOG_FILE = MORPH_STORAGE.actionLogFile;
const AGENT_WEBHOOK_SECRET = String(process.env.MORPH_AGENT_WEBHOOK_SECRET || '').trim();
const MORPH_API_CONTRACT_VERSION = String(process.env.MORPH_API_CONTRACT_VERSION || '').trim() || '2026-03-17.stage2';
const MORPH_REQUIRE_EXPLICIT_PERMISSIONS = String(process.env.MORPH_REQUIRE_EXPLICIT_PERMISSIONS || '').trim() === '1';
const glucoseBridge = createGlucoseBridge(ROOT);
const glucoseConfigStore = createGlucoseConfigStore(ROOT);
const feishuStore = createFeishuStore(ROOT);
const feishuAIConfigStore = createFeishuAIConfigStore(ROOT);
let liveDataStore = null;
const syncEvents = createMorphSyncEvents({
  liveDataFile: LIVE_DATA_FILE,
  getLiveDataStore: () => liveDataStore,
});
liveDataStore = createLiveDataStore({
  rootDir: ROOT,
  syncRoot: MORPH_STORAGE.syncRoot,
  liveDataFile: LIVE_DATA_FILE,
  mirrorDir: MORPH_MD_MIRROR_DIR,
  actionLogFile: MORPH_ACTION_LOG_FILE,
  canonicalStore: MORPH_STORAGE.canonicalStore,
  normalizeData,
  writeLiveSnapshot,
  generateMarkdownMirror,
  getSyncRevision,
  cloneJson,
  emitLiveDataSyncEvent: syncEvents.emitLiveDataSyncEvent,
  buildLiveDataSyncEventPayload: syncEvents.buildLiveDataSyncEventPayload,
});
const feishuBotRuntime = createFeishuBotRuntime({
  feishuStore,
  feishuAIConfigStore,
  readCurrentLiveData: () => liveDataStore && typeof liveDataStore.readCurrentLiveDataSafely === 'function'
    ? liveDataStore.readCurrentLiveDataSafely()
    : null,
  baseUrl: `http://${HOST}:${PORT}`,
  logger: console,
});
const atlasStore = createAtlasStore({
  rootDir: VIDEO_OPS_ROOT,
  morphRoot: MORPH_ICLOUD_ROOT,
  readCurrentLiveData: liveDataStore.readCurrentLiveDataSafely,
});
const staticBootstrapInjection = createStaticBootstrapInjection({
  atlasStore,
  liveDataStore,
});
const webSearchRoute = createWebSearchRoute();
const aiProxyRoute = createAIProxyRoute();
const agentStore = createAgentStore(ROOT);
const morphPluginBuilderApi = createMorphPluginBuilderApi({
  rootDir: ROOT,
});
const httpUtils = createServerHttpUtils({
  rootDir: ROOT,
  maxBodyBytes: MAX_BODY_BYTES,
});
const staticFileRoute = createStaticFileRoute({
  liveDataFile: LIVE_DATA_FILE,
  sendJson: httpUtils.sendJson,
  safeResolvePath: httpUtils.safeResolvePath,
  staticBootstrapInjection,
});
function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const serverApiRoute = createServerApiRoute({
  sendJson: httpUtils.sendJson,
  readRequestBody: httpUtils.readRequestBody,
  handleGlucoseApiRequest,
  handleFeishuApiRequest,
  handleAtlasApiRequest,
  handleAgentApiRequest,
  handleCodexRemoteApiRequest,
  handleMorphSyncRequest,
  handleMorphApiRequest,
  handleMorphPluginBuilderApiRequest: morphPluginBuilderApi.handleMorphPluginBuilderApiRequest,
  syncEvents,
  webSearchRoute,
  aiProxyRoute,
  glucoseBridge,
  glucoseConfigStore,
  feishuStore,
  feishuAIConfigStore,
  feishuBotRuntime,
  atlasStore,
  agentStore,
  webhookSecret: AGENT_WEBHOOK_SECRET,
  host: HOST,
  port: PORT,
  liveDataStore,
  normalizeData,
  apiContractVersion: MORPH_API_CONTRACT_VERSION,
  requireExplicitPermissions: MORPH_REQUIRE_EXPLICIT_PERMISSIONS,
});

feishuBotRuntime.syncFromStoredConfig().catch((error) => {
  console.warn('[FeishuBot] initial start failed:', error?.message || error);
});

const serverBootstrap = createServerBootstrap({
  serverApiRoute,
  staticFileRoute,
  syncEvents,
  host: HOST,
  port: PORT,
  liveDataStore,
  startupStorage: MORPH_STORAGE,
});

serverBootstrap.startServer();
