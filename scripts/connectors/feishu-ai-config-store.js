const fs = require('fs');
const path = require('path');

function sanitizeFeishuAIConfig(raw = {}, fallback = null) {
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    provider: String(src.provider || base.provider || '').trim().toLowerCase(),
    apiKey: String(src.apiKey || base.apiKey || '').trim(),
    baseUrl: String(src.baseUrl || base.baseUrl || '').trim(),
    model: String(src.model || base.model || '').trim(),
    updatedAt: String(src.updatedAt || base.updatedAt || '').trim(),
  };
}

function summarizeFeishuAIConfig(config = {}) {
  const safe = sanitizeFeishuAIConfig(config);
  return {
    provider: safe.provider,
    configured: !!(safe.provider && (safe.apiKey || safe.baseUrl || safe.provider === 'codex')),
    hasApiKey: !!safe.apiKey,
    hasBaseUrl: !!safe.baseUrl,
    model: safe.model,
    updatedAt: safe.updatedAt,
  };
}

function createFeishuAIConfigStore(rootDir) {
  const configFile = path.join(rootDir, 'data', 'feishu-ai.config.json');

  function readConfig() {
    try {
      const raw = fs.readFileSync(configFile, 'utf8');
      return sanitizeFeishuAIConfig(JSON.parse(raw));
    } catch (_) {
      return sanitizeFeishuAIConfig({});
    }
  }

  function writeConfig(nextConfig) {
    const safe = sanitizeFeishuAIConfig(nextConfig, readConfig());
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.writeFileSync(configFile, `${JSON.stringify(safe, null, 2)}\n`, 'utf8');
    return safe;
  }

  return {
    configFile,
    readConfig,
    writeConfig,
    sanitizeFeishuAIConfig,
    summarizeFeishuAIConfig,
  };
}

module.exports = {
  createFeishuAIConfigStore,
  sanitizeFeishuAIConfig,
  summarizeFeishuAIConfig,
};
