function createServerApiRoute(deps = {}) {
  const api = deps && typeof deps === 'object' ? deps : {};
  const sendJson = typeof api.sendJson === 'function' ? api.sendJson : null;
  const readRequestBody = typeof api.readRequestBody === 'function' ? api.readRequestBody : null;
  const handleGlucoseApiRequest = typeof api.handleGlucoseApiRequest === 'function' ? api.handleGlucoseApiRequest : null;
  const handleFeishuApiRequest = typeof api.handleFeishuApiRequest === 'function' ? api.handleFeishuApiRequest : null;
  const handleAtlasApiRequest = typeof api.handleAtlasApiRequest === 'function' ? api.handleAtlasApiRequest : null;
  const handleAgentApiRequest = typeof api.handleAgentApiRequest === 'function' ? api.handleAgentApiRequest : null;
  const handleCodexRemoteApiRequest = typeof api.handleCodexRemoteApiRequest === 'function' ? api.handleCodexRemoteApiRequest : null;
  const handleMorphSyncRequest = typeof api.handleMorphSyncRequest === 'function' ? api.handleMorphSyncRequest : null;
  const handleMorphApiRequest = typeof api.handleMorphApiRequest === 'function' ? api.handleMorphApiRequest : null;
  const handleMorphPluginBuilderApiRequest = typeof api.handleMorphPluginBuilderApiRequest === 'function'
    ? api.handleMorphPluginBuilderApiRequest
    : null;
  const webSearchRoute = api.webSearchRoute && typeof api.webSearchRoute.handleWebSearchRequest === 'function'
    ? api.webSearchRoute
    : null;
  const aiProxyRoute = api.aiProxyRoute && typeof api.aiProxyRoute.handleAIProxyRequest === 'function'
    ? api.aiProxyRoute
    : null;
  const syncEvents = api.syncEvents && typeof api.syncEvents.handleSyncEventsRequest === 'function'
    ? api.syncEvents
    : null;
  const glucoseBridge = api.glucoseBridge || null;
  const glucoseConfigStore = api.glucoseConfigStore || null;
  const feishuStore = api.feishuStore || null;
  const feishuAIConfigStore = api.feishuAIConfigStore || null;
  const feishuBotRuntime = api.feishuBotRuntime || null;
  const atlasStore = api.atlasStore || null;
  const agentStore = api.agentStore || null;
  const webhookSecret = String(api.webhookSecret || '').trim();
  const host = String(api.host || '127.0.0.1').trim() || '127.0.0.1';
  const port = Number(api.port || 2199) || 2199;
  const liveDataStore = api.liveDataStore || null;
  const normalizeData = typeof api.normalizeData === 'function' ? api.normalizeData : null;
  const apiContractVersion = String(api.apiContractVersion || '').trim();
  const requireExplicitPermissions = api.requireExplicitPermissions === true;
  const healthService = String(api.healthService || 'lian-sync').trim() || 'lian-sync';

  function sendPreflight(res) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Morph-Codex-Token',
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
  }

  async function handleApiRequest(req, res) {
    if (!sendJson || !readRequestBody) {
      throw new Error('server api route requires sendJson and readRequestBody');
    }
    const url = String(req.url || '').split('?')[0];

    if (req.method === 'OPTIONS') {
      sendPreflight(res);
      return true;
    }

    if (req.method === 'GET' && url === '/api/health') {
      const canonicalStore = liveDataStore && typeof liveDataStore.describeCanonicalStore === 'function'
        ? liveDataStore.describeCanonicalStore()
        : null;
      sendJson(res, 200, {
        ok: true,
        service: healthService,
        now: new Date().toISOString(),
        liveData: canonicalStore || undefined,
        glucose: glucoseBridge ? { status: glucoseBridge.getStatus() } : undefined,
      });
      return true;
    }

    if (req.method === 'GET' && url === '/api/sync/events' && syncEvents) {
      if (await syncEvents.handleSyncEventsRequest(req, res, { url })) return true;
    }

    if (handleGlucoseApiRequest && await handleGlucoseApiRequest(req, res, {
      url,
      host,
      port,
      sendJson,
      readRequestBody,
      glucoseBridge,
      glucoseConfigStore,
    })) return true;

    if (handleAgentApiRequest && await handleAgentApiRequest(req, res, {
      url,
      host,
      port,
      sendJson,
      readRequestBody,
      agentStore,
      webhookSecret,
    })) return true;

    if (handleFeishuApiRequest && await handleFeishuApiRequest(req, res, {
      url,
      host,
      port,
      sendJson,
      readRequestBody,
      feishuStore,
      feishuAIConfigStore,
      feishuBotRuntime,
    })) return true;

    if (handleAtlasApiRequest && handleAtlasApiRequest(req, res, {
      url,
      host,
      port,
      sendJson,
      atlasStore,
    })) return true;

    if (handleCodexRemoteApiRequest && await handleCodexRemoteApiRequest(req, res, {
      url,
      host,
      port,
      sendJson,
      readRequestBody,
    })) return true;

    if (handleMorphSyncRequest && await handleMorphSyncRequest(req, res, {
      url,
      host,
      port,
      sendJson,
      readRequestBody,
      liveDataStore,
      normalizeData,
    })) return true;

    if (handleMorphApiRequest && await handleMorphApiRequest(req, res, {
      url,
      host,
      port,
      sendJson,
      readRequestBody,
      readCurrentLiveData: liveDataStore && liveDataStore.readCurrentLiveDataSafely,
      normalizeData,
      persistMorphData: liveDataStore && liveDataStore.persistMorphData,
      commitMorphWrite: liveDataStore && liveDataStore.commitMorphWrite,
      appendActionLog: liveDataStore && liveDataStore.appendActionLog,
      atlasStore,
      apiContractVersion,
      requireExplicitPermissions,
    })) return true;

    if (aiProxyRoute && await aiProxyRoute.handleAIProxyRequest(req, res, {
      url,
      host,
      port,
      sendJson,
      readRequestBody,
    })) return true;

    if (handleMorphPluginBuilderApiRequest && await handleMorphPluginBuilderApiRequest(req, res, {
      url,
      host,
      port,
      sendJson,
      readRequestBody,
      readCurrentLiveData: liveDataStore && liveDataStore.readCurrentLiveDataSafely,
      normalizeData,
      persistMorphData: liveDataStore && liveDataStore.persistMorphData,
      commitMorphWrite: liveDataStore && liveDataStore.commitMorphWrite,
    })) return true;

    if (webSearchRoute && await webSearchRoute.handleWebSearchRequest(req, res, {
      url,
      host,
      port,
      sendJson,
    })) return true;

    sendJson(res, 404, { error: 'API route not found' });
    return true;
  }

  return {
    handleApiRequest,
    sendPreflight,
  };
}

module.exports = {
  createServerApiRoute,
};
