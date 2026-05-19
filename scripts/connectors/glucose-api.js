async function handleGlucoseApiRequest(req, res, context) {
  const {
    url,
    host,
    port,
    sendJson,
    readRequestBody,
    glucoseBridge,
    glucoseConfigStore,
  } = context;

  if (req.method === 'GET' && url === '/api/glucose/latest') {
    try {
      const reqUrl = new URL(req.url || '/api/glucose/latest', `http://${host}:${port}`);
      const force = reqUrl.searchParams.get('refresh') === '1';
      const payload = await glucoseBridge.getLatest({ force });
      sendJson(res, 200, payload);
      return true;
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        status: 'error',
        message: error.message || 'glucose read failed',
        reading: null,
        fetchedAt: new Date().toISOString(),
      });
      return true;
    }
  }

  if (req.method === 'GET' && url === '/api/glucose/history') {
    try {
      const reqUrl = new URL(req.url || '/api/glucose/history', `http://${host}:${port}`);
      const force = reqUrl.searchParams.get('refresh') === '1';
      const hoursRaw = Number(reqUrl.searchParams.get('hours'));
      const hours = Number.isFinite(hoursRaw) ? Math.min(72, Math.max(3, Math.round(hoursRaw))) : 24;
      const payload = await glucoseBridge.getHistory({ force, hours });
      sendJson(res, 200, payload);
      return true;
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        status: 'error',
        message: error.message || 'glucose history read failed',
        reading: null,
        series: [],
        fetchedAt: new Date().toISOString(),
      });
      return true;
    }
  }

  if (req.method === 'GET' && url === '/api/glucose/config') {
    const cfg = glucoseConfigStore.readConfig();
    sendJson(res, 200, {
      ok: true,
      status: glucoseBridge.getStatus(),
      config: glucoseConfigStore.summarizeConfig(cfg),
      loadedAt: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/glucose/config/full') {
    const cfg = glucoseConfigStore.readConfig();
    sendJson(res, 200, {
      ok: true,
      config: {
        email: String(cfg?.credentials?.email || '').trim(),
        password: String(cfg?.credentials?.password || '').trim(),
        targetLow: Number(cfg?.ranges?.target_low || 70),
        targetHigh: Number(cfg?.ranges?.target_high || 180),
        region: String(cfg?.client?.region || 'EU').trim() || 'EU',
      },
      loadedAt: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'POST' && url === '/api/glucose/config') {
    try {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const saved = glucoseConfigStore.saveConfig(body);
      sendJson(res, 200, {
        ok: true,
        status: 'saved',
        config: saved.summary,
        savedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || 'save config failed' });
      return true;
    }
  }

  return false;
}

module.exports = {
  handleGlucoseApiRequest,
};
