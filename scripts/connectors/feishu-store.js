const fs = require('fs');
const path = require('path');

function sanitizeFeishuConfig(raw = {}, fallback = null) {
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: src.enabled === true || (src.enabled !== false && base.enabled === true),
    appId: String(src.appId || base.appId || '').trim(),
    appSecret: String(src.appSecret || base.appSecret || '').trim(),
    verificationToken: String(src.verificationToken || base.verificationToken || '').trim(),
    encryptKey: String(src.encryptKey || base.encryptKey || '').trim(),
    botName: String(src.botName || base.botName || '').trim(),
    connectionMode: 'long-connection',
    updatedAt: String(src.updatedAt || base.updatedAt || '').trim(),
  };
}

function createFeishuStore(rootDir) {
  const configFile = path.join(rootDir, 'data', 'feishu.config.json');
  const eventsFile = path.join(rootDir, 'data', 'feishu-events.ndjson');
  const conversationsFile = path.join(rootDir, 'data', 'feishu-conversations.json');

  function readConfig() {
    try {
      const raw = fs.readFileSync(configFile, 'utf8');
      return sanitizeFeishuConfig(JSON.parse(raw));
    } catch (_) {
      return sanitizeFeishuConfig({});
    }
  }

  function writeConfig(nextConfig) {
    const safe = sanitizeFeishuConfig(nextConfig, readConfig());
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.writeFileSync(configFile, `${JSON.stringify(safe, null, 2)}\n`, 'utf8');
    return safe;
  }

  function summarizeConfig(config) {
    const cfg = sanitizeFeishuConfig(config);
    return {
      enabled: cfg.enabled === true,
      appId: cfg.appId,
      hasAppSecret: !!cfg.appSecret,
      verificationToken: cfg.verificationToken,
      hasEncryptKey: !!cfg.encryptKey,
      botName: cfg.botName,
      connectionMode: 'long-connection',
      callbackPath: '/api/feishu/webhook',
      updatedAt: cfg.updatedAt || '',
    };
  }

  function appendEvent(eventPayload) {
    const payload = eventPayload && typeof eventPayload === 'object' ? eventPayload : {};
    const entry = {
      receivedAt: new Date().toISOString(),
      eventId: String(payload.eventId || '').trim(),
      eventType: String(payload.eventType || '').trim(),
      chatId: String(payload.chatId || '').trim(),
      chatType: String(payload.chatType || '').trim(),
      senderId: String(payload.senderId || '').trim(),
      messageId: String(payload.messageId || '').trim(),
      messageType: String(payload.messageType || '').trim(),
      direction: String(payload.direction || 'inbound').trim() || 'inbound',
      text: String(payload.text || '').trim().slice(0, 4000),
      raw: payload.raw && typeof payload.raw === 'object' ? payload.raw : {},
    };
    fs.mkdirSync(path.dirname(eventsFile), { recursive: true });
    fs.appendFileSync(eventsFile, `${JSON.stringify(entry)}\n`, 'utf8');
    return entry;
  }

  function readEvents(limit = 20) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
    try {
      const raw = fs.readFileSync(eventsFile, 'utf8');
      const rows = raw.split('\n').map((line) => line.trim()).filter(Boolean);
      return rows
        .slice(-safeLimit)
        .map((line) => {
          try { return JSON.parse(line); } catch (_) { return null; }
        })
        .filter(Boolean)
        .reverse();
    } catch (_) {
      return [];
    }
  }

  function readConversationState() {
    try {
      return JSON.parse(fs.readFileSync(conversationsFile, 'utf8'));
    } catch (_) {
      return { chats: {} };
    }
  }

  function writeConversationState(nextState) {
    const safe = nextState && typeof nextState === 'object' ? nextState : { chats: {} };
    fs.mkdirSync(path.dirname(conversationsFile), { recursive: true });
    fs.writeFileSync(conversationsFile, `${JSON.stringify(safe, null, 2)}\n`, 'utf8');
    return safe;
  }

  function appendConversationMessage(chatId, entry = {}) {
    const key = String(chatId || '').trim();
    if (!key) return [];
    const state = readConversationState();
    if (!state.chats || typeof state.chats !== 'object') state.chats = {};
    const history = Array.isArray(state.chats[key]) ? state.chats[key] : [];
    history.push({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: String(entry.content || '').trim().slice(0, 4000),
      messageId: String(entry.messageId || '').trim(),
      at: entry.at && Number.isFinite(Date.parse(entry.at))
        ? new Date(entry.at).toISOString()
        : new Date().toISOString(),
    });
    state.chats[key] = history.slice(-20);
    writeConversationState(state);
    return state.chats[key];
  }

  function readConversation(chatId, limit = 12) {
    const key = String(chatId || '').trim();
    if (!key) return [];
    const state = readConversationState();
    const history = Array.isArray(state?.chats?.[key]) ? state.chats[key] : [];
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 12));
    return history.slice(-safeLimit);
  }

  function hasProcessedMessage(messageId) {
    const key = String(messageId || '').trim();
    if (!key) return false;
    return readEvents(200).some((item) => String(item?.messageId || '').trim() === key);
  }

  return {
    configFile,
    eventsFile,
    conversationsFile,
    sanitizeFeishuConfig,
    readConfig,
    writeConfig,
    summarizeConfig,
    appendEvent,
    readEvents,
    appendConversationMessage,
    readConversation,
    hasProcessedMessage,
  };
}

module.exports = {
  createFeishuStore,
  sanitizeFeishuConfig,
};
