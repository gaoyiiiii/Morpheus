const fs = require('fs');
const path = require('path');

function sanitizeLibreRangeValue(raw, fallback) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(num);
}

function normalizeRegion(raw) {
  const regionRaw = String(raw || 'EU').trim().toUpperCase();
  return regionRaw === 'EU' ? 'EU' : 'US';
}

function createGlucoseConfigStore(rootDir) {
  const configFile = path.join(rootDir, 'data', 'librelink.config.json');

  function readConfig() {
    try {
      const raw = fs.readFileSync(configFile, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function summarizeConfig(config) {
    const cfg = config && typeof config === 'object' ? config : {};
    const email = String(cfg?.credentials?.email || '').trim();
    const targetLow = sanitizeLibreRangeValue(cfg?.ranges?.target_low, 70);
    const targetHigh = sanitizeLibreRangeValue(cfg?.ranges?.target_high, 180);
    const region = normalizeRegion(cfg?.client?.region || 'EU');
    return {
      email,
      hasPassword: !!String(cfg?.credentials?.password || '').trim(),
      targetLow,
      targetHigh,
      region,
    };
  }

  function saveConfig(input, existingConfig) {
    const body = input && typeof input === 'object' ? input : {};
    const existing = existingConfig && typeof existingConfig === 'object' ? existingConfig : readConfig();
    const email = String(body?.email || '').trim();
    const incomingPassword = String(body?.password || '').trim();
    const password = incomingPassword || String(existing?.credentials?.password || '').trim();
    const targetLow = sanitizeLibreRangeValue(body?.targetLow, 70);
    const targetHigh = sanitizeLibreRangeValue(body?.targetHigh, 180);
    const region = normalizeRegion(body?.region || existing?.client?.region || 'EU');

    if (!email) throw new Error('email is required');
    if (!password) throw new Error('password is required');
    if (targetLow >= targetHigh) throw new Error('targetLow must be lower than targetHigh');

    const nextConfig = {
      credentials: {
        email,
        password,
      },
      ranges: {
        target_low: targetLow,
        target_high: targetHigh,
      },
      client: {
        region,
      },
    };

    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.writeFileSync(configFile, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
    return {
      raw: nextConfig,
      summary: summarizeConfig(nextConfig),
    };
  }

  return {
    configFile,
    readConfig,
    summarizeConfig,
    saveConfig,
    sanitizeLibreRangeValue,
    normalizeRegion,
  };
}

module.exports = {
  createGlucoseConfigStore,
  sanitizeLibreRangeValue,
  normalizeRegion,
};
