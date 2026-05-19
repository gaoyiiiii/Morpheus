async function handleAgentApiRequest(req, res, context) {
  const {
    url,
    host,
    port,
    sendJson,
    readRequestBody,
    agentStore,
    webhookSecret,
  } = context;

  if (req.method === 'GET' && url === '/api/agent/events') {
    const reqUrl = new URL(req.url || '/api/agent/events', `http://${host}:${port}`);
    const limit = Number(reqUrl.searchParams.get('limit'));
    sendJson(res, 200, {
      ok: true,
      events: agentStore.readEvents(limit),
      now: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/agent/status') {
    sendJson(res, 200, agentStore.readStatusSummary(webhookSecret));
    return true;
  }

  if (req.method === 'POST' && url === '/api/agent/webhook') {
    try {
      if (webhookSecret) {
        const incoming = String(req.headers['x-morph-agent-secret'] || '').trim();
        if (!incoming || incoming !== webhookSecret) {
          sendJson(res, 401, { ok: false, error: 'unauthorized' });
          return true;
        }
      }
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const saved = agentStore.appendEvent(body);
      sendJson(res, 200, {
        ok: true,
        savedAt: saved.receivedAt,
        findings: Array.isArray(saved.findings) ? saved.findings.length : 0,
      });
      return true;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || 'agent webhook failed' });
      return true;
    }
  }

  return false;
}

module.exports = {
  handleAgentApiRequest,
};
