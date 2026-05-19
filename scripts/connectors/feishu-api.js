async function handleFeishuApiRequest(req, res, context) {
  const {
    url,
    host,
    port,
    sendJson,
    readRequestBody,
    feishuStore,
    feishuAIConfigStore,
    feishuBotRuntime,
  } = context;

  if (req.method === 'GET' && url === '/api/feishu/config') {
    const cfg = feishuStore.readConfig();
    sendJson(res, 200, {
      ok: true,
      config: feishuStore.summarizeConfig(cfg),
      now: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/feishu/config/full') {
    const cfg = feishuStore.readConfig();
    sendJson(res, 200, {
      ok: true,
      config: {
        enabled: cfg.enabled === true,
        appId: String(cfg.appId || '').trim(),
        appSecret: String(cfg.appSecret || '').trim(),
        verificationToken: String(cfg.verificationToken || '').trim(),
        encryptKey: String(cfg.encryptKey || '').trim(),
        botName: String(cfg.botName || '').trim(),
        callbackPath: '/api/feishu/webhook',
      },
      now: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/feishu/events') {
    const reqUrl = new URL(req.url || '/api/feishu/events', `http://${host}:${port}`);
    const limit = Number(reqUrl.searchParams.get('limit'));
    sendJson(res, 200, {
      ok: true,
      events: feishuStore.readEvents(limit),
      now: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'GET' && url === '/api/feishu/status') {
    const cfg = feishuStore.readConfig();
    const events = feishuStore.readEvents(20);
    const latest = events[0] || null;
    const runtimeStatus = feishuBotRuntime && typeof feishuBotRuntime.getStatusSummary === 'function'
      ? feishuBotRuntime.getStatusSummary()
      : {};
    const aiStatus = feishuAIConfigStore && typeof feishuAIConfigStore.summarizeFeishuAIConfig === 'function'
      ? feishuAIConfigStore.summarizeFeishuAIConfig(feishuAIConfigStore.readConfig())
      : { configured: false, provider: '' };
    sendJson(res, 200, {
      ok: true,
      ...feishuStore.summarizeConfig(cfg),
      eventCount: events.length,
      lastMessageAt: latest?.receivedAt || '',
      lastEventType: latest?.eventType || '',
      supportsEncryptedPayload: false,
      requiresPublicCallback: false,
      connectionMode: 'long-connection',
      runtime: runtimeStatus,
      ai: aiStatus,
      now: new Date().toISOString(),
    });
    return true;
  }

  if (req.method === 'POST' && url === '/api/feishu/ai-config') {
    try {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const saved = feishuAIConfigStore.writeConfig({
        provider: body.provider,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        model: body.model,
        updatedAt: new Date().toISOString(),
      });
      if (feishuBotRuntime && typeof feishuBotRuntime.applyAIConfigUpdate === 'function') {
        await feishuBotRuntime.applyAIConfigUpdate(saved);
      }
      sendJson(res, 200, {
        ok: true,
        config: feishuAIConfigStore.summarizeFeishuAIConfig(saved),
        savedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || 'save feishu ai config failed' });
      return true;
    }
  }

  if (req.method === 'POST' && url === '/api/feishu/config') {
    try {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const current = feishuStore.readConfig();
      const enabled = body.enabled === true;
      const appId = String(body.appId || '').trim();
      const verificationToken = String(body.verificationToken || '').trim();
      const botName = String(body.botName || '').trim();
      const appSecretIncoming = String(body.appSecret || '').trim();
      const encryptKeyIncoming = String(body.encryptKey || '').trim();
      const next = feishuStore.sanitizeFeishuConfig({
        enabled,
        appId,
        appSecret: appSecretIncoming || current.appSecret,
        verificationToken,
        encryptKey: encryptKeyIncoming || current.encryptKey,
        botName,
        updatedAt: new Date().toISOString(),
      }, current);
      if (next.enabled && !next.appId) {
        sendJson(res, 400, { ok: false, error: 'appId is required when enabled=true' });
        return true;
      }
      const saved = feishuStore.writeConfig(next);
      if (feishuBotRuntime && typeof feishuBotRuntime.applyConfigUpdate === 'function') {
        await feishuBotRuntime.applyConfigUpdate(saved);
      }
      sendJson(res, 200, {
        ok: true,
        config: feishuStore.summarizeConfig(saved),
        savedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || 'save feishu config failed' });
      return true;
    }
  }

  if (req.method === 'POST' && url === '/api/feishu/webhook') {
    try {
      const cfg = feishuStore.readConfig();
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};

      if (body?.encrypt) {
        sendJson(res, 400, {
          ok: false,
          error: 'encrypted callback payload is not supported yet, disable Encrypt Key in Feishu event subscription',
        });
        return true;
      }

      const tokenInBody = String(body?.token || body?.header?.token || '').trim();
      if (cfg.verificationToken) {
        if (!tokenInBody || tokenInBody !== cfg.verificationToken) {
          sendJson(res, 401, { ok: false, error: 'invalid feishu verification token' });
          return true;
        }
      }

      if (body?.type === 'url_verification') {
        sendJson(res, 200, { challenge: String(body.challenge || '') });
        return true;
      }

      const event = body?.event && typeof body.event === 'object' ? body.event : {};
      const header = body?.header && typeof body.header === 'object' ? body.header : {};
      const eventType = String(header.event_type || body.type || '').trim();

      let text = '';
      const contentRaw = String(event?.message?.content || '').trim();
      if (contentRaw) {
        try {
          const parsedContent = JSON.parse(contentRaw);
          text = String(parsedContent?.text || parsedContent?.title || '').trim();
        } catch (_) {
          text = contentRaw;
        }
      }

      const saved = feishuStore.appendEvent({
        eventId: String(header.event_id || '').trim(),
        eventType,
        chatId: String(event?.message?.chat_id || event?.chat_id || '').trim(),
        chatType: String(event?.message?.chat_type || event?.chat_type || '').trim(),
        senderId: String(
          event?.sender?.sender_id?.open_id
          || event?.sender?.sender_id?.union_id
          || event?.sender?.sender_id?.user_id
          || ''
        ).trim(),
        messageId: String(event?.message?.message_id || '').trim(),
        messageType: String(event?.message?.message_type || '').trim(),
        text,
        raw: body,
      });
      sendJson(res, 200, {
        ok: true,
        receivedAt: saved.receivedAt,
        eventType: saved.eventType,
      });
      return true;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || 'feishu webhook failed' });
      return true;
    }
  }

  return false;
}

module.exports = {
  handleFeishuApiRequest,
};
