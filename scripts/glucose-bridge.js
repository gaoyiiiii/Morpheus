const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { resolveFetch } = require('./connectors/node-fetch-compat');

const DEFAULT_TARGET_LOW = 70;
const DEFAULT_TARGET_HIGH = 180;
const DEFAULT_CACHE_MS = 60 * 1000;
const DEFAULT_LIBRE_CLIENT_VERSION = '4.16.0';
const API_BY_REGION = {
  US: 'https://api-us.libreview.io',
  EU: 'https://api-eu.libreview.io',
};
const API_CANDIDATES_BY_REGION = {
  US: [
    'https://api-us.libreview.io',
    'https://api.libreview.io',
  ],
  EU: [
    'https://api-cn.myfreestyle.cn',
    'https://api.myfreestyle.cn',
    'https://api-eu2.libreview.io',
    'https://api-eu.libreview.io',
    'https://api.libreview.io',
  ],
};

function normalizeTrend(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'Flat';
  if (value === 'flat' || value === 'stable') return 'Flat';
  if (value === 'up' || value === 'rising' || value === 'singleup') return 'SingleUp';
  if (value === 'down' || value === 'falling' || value === 'singledown') return 'SingleDown';
  if (value === 'rapidlyup' || value === 'doubleup' || value === 'rapid up') return 'DoubleUp';
  if (value === 'rapidlydown' || value === 'doubledown' || value === 'rapid down') return 'DoubleDown';
  if (value === 'slightlyup' || value === 'fortyfiveup' || value === 'slight up') return 'FortyFiveUp';
  if (value === 'slightlydown' || value === 'fortyfivedown' || value === 'slight down') return 'FortyFiveDown';
  return String(raw || 'Flat');
}

function toIsoTime(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function safeReadJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function createGlucoseBridge(rootDir) {
  let cache = null;
  let inFlight = null;
  let historyCache = null;
  let historyInFlight = null;
  let lastError = '';
  let cachedClientCtor = undefined;
  const fetchImpl = resolveFetch();

  function loadLibreConfig() {
    const defaultFile = path.join(os.homedir(), '.librelink-mcp', 'config.json');
    const localFile = path.join(rootDir, 'data', 'librelink.config.json');
    const envFile = process.env.LIBRELINK_CONFIG_PATH ? path.resolve(process.env.LIBRELINK_CONFIG_PATH) : '';
    const candidateFiles = [envFile, localFile, defaultFile].filter(Boolean);

    let fileConfig = null;
    for (const file of candidateFiles) {
      const parsed = safeReadJson(file);
      if (parsed && typeof parsed === 'object') {
        fileConfig = parsed;
        break;
      }
    }

    const email = String(process.env.LIBRELINK_EMAIL || fileConfig?.credentials?.email || '').trim();
    const password = String(process.env.LIBRELINK_PASSWORD || fileConfig?.credentials?.password || '').trim();
    const targetLow = Number(process.env.LIBRELINK_TARGET_LOW || fileConfig?.ranges?.target_low || DEFAULT_TARGET_LOW);
    const targetHigh = Number(process.env.LIBRELINK_TARGET_HIGH || fileConfig?.ranges?.target_high || DEFAULT_TARGET_HIGH);
    const cacheMs = Number(process.env.LIBRELINK_CACHE_MS || DEFAULT_CACHE_MS);
    const regionRaw = String(process.env.LIBRELINK_REGION || fileConfig?.client?.region || 'EU').trim().toUpperCase();
    const region = regionRaw === 'EU' ? 'EU' : 'US';
    const apiUrlRaw = String(process.env.LIBRELINK_API_URL || fileConfig?.client?.apiUrl || '').trim();
    const apiUrl = apiUrlRaw || API_BY_REGION[region];
    const clientVersion = String(
      process.env.LIBRELINK_CLIENT_VERSION
      || process.env.LIBRE_LINK_UP_VERSION
      || fileConfig?.client?.version
      || DEFAULT_LIBRE_CLIENT_VERSION
    ).trim() || DEFAULT_LIBRE_CLIENT_VERSION;

    return {
      enabled: !!(email && password),
      email,
      password,
      targetLow: Number.isFinite(targetLow) ? targetLow : DEFAULT_TARGET_LOW,
      targetHigh: Number.isFinite(targetHigh) ? targetHigh : DEFAULT_TARGET_HIGH,
      cacheMs: Number.isFinite(cacheMs) ? Math.max(15 * 1000, cacheMs) : DEFAULT_CACHE_MS,
      region,
      apiUrl,
      clientVersion,
    };
  }

  function getModuleCandidates() {
    const moduleCandidates = [];
    try {
      moduleCandidates.push(require.resolve('libre-link-unofficial-api', { paths: [rootDir] }));
    } catch (_) {}
    try {
      moduleCandidates.push(require.resolve('libre-link-unofficial-api', { paths: [path.join(rootDir, 'librelink-mcp-server-main')] }));
    } catch (_) {}
    return Array.from(new Set(moduleCandidates));
  }

  function hasLibreDependency() {
    return getModuleCandidates().length > 0;
  }

  function getApiCandidates(cfg = {}) {
    const region = String(cfg.region || 'EU').toUpperCase() === 'US' ? 'US' : 'EU';
    const list = [];
    const push = (value) => {
      const url = String(value || '').trim().replace(/\/+$/, '');
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) return;
      if (!list.includes(url)) list.push(url);
    };
    push(cfg.apiUrl);
    (API_CANDIDATES_BY_REGION[region] || []).forEach(push);
    return list;
  }

  async function loadClientCtor() {
    if (typeof cachedClientCtor === 'function') return cachedClientCtor;
    const candidates = getModuleCandidates();
    for (const modulePath of candidates) {
      try {
        const mod = await import(modulePath);
        const ctor = mod?.LibreLinkClient || mod?.default?.LibreLinkClient || mod?.default;
        if (typeof ctor === 'function') {
          cachedClientCtor = ctor;
          return ctor;
        }
      } catch (_) {
        // try next candidate
      }
    }
    return null;
  }

  async function requestLibreJSON(apiUrl, endpoint, { method = 'GET', token = '', accountId = '', clientVersion = DEFAULT_LIBRE_CLIENT_VERSION, body = null } = {}) {
    const headers = {
      product: 'llu.android',
      version: clientVersion || DEFAULT_LIBRE_CLIENT_VERSION,
      'accept-encoding': 'gzip',
      'cache-control': 'no-cache',
      connection: 'Keep-Alive',
      'content-type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (accountId) headers['Account-Id'] = accountId;
    const response = await fetchImpl(`${String(apiUrl || '').replace(/\/+$/, '')}/${String(endpoint || '').replace(/^\/+/, '')}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const message = json?.message || JSON.stringify(json || {});
      throw new Error(`Error fetching data from Libre Link Up API with status ${response.status}. ${message}`);
    }
    return json || {};
  }

  async function resolveRegionalApi(apiUrl, region, clientVersion) {
    const fallback = API_BY_REGION[String(region || '').toUpperCase() === 'EU' ? 'EU' : 'US'];
    try {
      const regionConfig = await requestLibreJSON(apiUrl, 'llu/config/country?country=DE', {
        method: 'GET',
        clientVersion,
      });
      const mapped = regionConfig?.data?.regionalMap?.[region]?.lslApi;
      return String(mapped || fallback || apiUrl || '').trim() || fallback;
    } catch (_) {
      return String(fallback || apiUrl || '').trim() || apiUrl;
    }
  }

  function hashAccountId(raw = '') {
    const text = String(raw || '').trim();
    if (!text) return '';
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  function normalizeTrendFromArrow(arrow) {
    const trendMap = {
      0: 'NotComputable',
      1: 'SingleDown',
      2: 'FortyFiveDown',
      3: 'Flat',
      4: 'FortyFiveUp',
      5: 'SingleUp',
    };
    const code = Number(arrow);
    if (Number.isFinite(code) && Object.prototype.hasOwnProperty.call(trendMap, code)) {
      return trendMap[code];
    }
    return normalizeTrend(arrow);
  }

  function extractConnections(connectionsRes = {}) {
    const rawConnectionsData = connectionsRes?.data;
    if (Array.isArray(rawConnectionsData)) return rawConnectionsData;
    if (Array.isArray(rawConnectionsData?.connections)) return rawConnectionsData.connections;
    if (rawConnectionsData && typeof rawConnectionsData === 'object' && rawConnectionsData.patientId) return [rawConnectionsData];
    if (Array.isArray(connectionsRes?.connections)) return connectionsRes.connections;
    return [];
  }

  function normalizeHistoryPoint(raw = {}) {
    const value = Number(
      raw?.ValueInMgPerDl
      ?? raw?.valueInMgPerDl
      ?? raw?.value
      ?? raw?.Value
      ?? raw?.glucose
      ?? raw?.glucoseValue
    );
    const timestamp = toIsoTime(raw?.Timestamp ?? raw?.FactoryTimestamp ?? raw?.timestamp ?? raw?.date);
    if (!Number.isFinite(value) || !timestamp) return null;
    return {
      value,
      timestamp,
      trend: normalizeTrendFromArrow(raw?.TrendArrow ?? raw?.trendArrow ?? raw?.trend),
    };
  }

  function parseGraphPoints(graph = {}) {
    const dataNode = graph?.data || {};
    const candidates = [];
    if (Array.isArray(dataNode?.graphData)) candidates.push(...dataNode.graphData);
    if (Array.isArray(dataNode?.connection?.graphData)) candidates.push(...dataNode.connection.graphData);
    if (Array.isArray(dataNode?.history)) candidates.push(...dataNode.history);
    const latest = dataNode?.connection?.glucoseItem;
    if (latest && typeof latest === 'object') candidates.push(latest);
    const unique = new Map();
    candidates.forEach((item) => {
      const point = normalizeHistoryPoint(item);
      if (!point) return;
      unique.set(point.timestamp, point);
    });
    return Array.from(unique.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  function buildReadingFromPoint(point, cfg) {
    const value = Number(point?.value);
    const trend = normalizeTrend(point?.trend || 'Flat');
    const timestamp = toIsoTime(point?.timestamp);
    const isHigh = Number.isFinite(value) && value > cfg.targetHigh;
    const isLow = Number.isFinite(value) && value < cfg.targetLow;
    return {
      value: Number.isFinite(value) ? value : null,
      unit: 'mg/dL',
      trend,
      timestamp,
      isHigh,
      isLow,
      targetLow: cfg.targetLow,
      targetHigh: cfg.targetHigh,
    };
  }

  async function fetchGraphViaDirectHTTP(cfg, apiUrlInput = '') {
    let apiUrl = String(apiUrlInput || cfg.apiUrl || '').trim();
    let login = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      login = await requestLibreJSON(apiUrl, 'llu/auth/login', {
        method: 'POST',
        clientVersion: cfg.clientVersion,
        body: { email: cfg.email, password: cfg.password },
      });
      const loginData = login?.data || {};
      if (Number(login?.status) === 2) {
        throw new Error('Invalid credentials. Please verify LibreLinkUp email/password.');
      }
      if (Object.prototype.hasOwnProperty.call(loginData, 'redirect') && loginData?.region) {
        apiUrl = await resolveRegionalApi(apiUrl, loginData.region, cfg.clientVersion);
        continue;
      }
      break;
    }

    const loginData = login?.data || {};
    const token = String(
      loginData?.authTicket?.token
      || loginData?.authTicket
      || loginData?.token
      || login?.authTicket?.token
      || ''
    ).trim();
    if (!token) {
      throw new Error(`Failed to get auth token from Libre Link Up API (status=${String(login?.status ?? 'unknown')}).`);
    }

    const accountIdRaw = loginData?.user?.id || loginData?.accountId || loginData?.userId || '';
    const accountHash = hashAccountId(accountIdRaw);
    const connectionsRes = await requestLibreJSON(apiUrl, 'llu/connections', {
      method: 'GET',
      token,
      accountId: accountHash,
      clientVersion: cfg.clientVersion,
    });
    const connections = extractConnections(connectionsRes);
    if (!connections.length) {
      const rawConnectionsData = connectionsRes?.data;
      const keys = rawConnectionsData && typeof rawConnectionsData === 'object'
        ? Object.keys(rawConnectionsData).slice(0, 12).join(',')
        : '';
      const suffix = keys ? ` (response keys: ${keys})` : '';
      throw new Error(`No connections found. Please ensure that you have a connection with the LibreLinkUp app.${suffix}`);
    }
    const patientId = String(connections[0]?.patientId || '').trim();
    if (!patientId) throw new Error('Patient ID not found in connections.');

    const graph = await requestLibreJSON(apiUrl, `llu/connections/${patientId}/graph`, {
      method: 'GET',
      token,
      accountId: accountHash,
      clientVersion: cfg.clientVersion,
    });
    return { graph };
  }

  async function fetchLatestReadingViaDirectHTTP(cfg, apiUrlInput = '') {
    const { graph } = await fetchGraphViaDirectHTTP(cfg, apiUrlInput);
    const connection = graph?.data?.connection || {};
    const glucose = connection?.glucoseItem || null;
    if (!glucose) throw new Error('No glucose item in graph response.');

    const reading = buildReadingFromPoint({
      value: glucose?.ValueInMgPerDl,
      timestamp: glucose?.Timestamp,
      trend: glucose?.TrendArrow,
    }, cfg);

    return {
      ok: true,
      status: 'ok',
      message: '',
      reading,
      fetchedAt: new Date().toISOString(),
    };
  }

  async function fetchHistoryReading(hours = 24) {
    const cfg = loadLibreConfig();
    if (!cfg.enabled) {
      return {
        ok: false,
        status: 'disabled',
        message: 'LibreLink credentials are not configured.',
        reading: null,
        series: [],
        fetchedAt: new Date().toISOString(),
      };
    }
    const apiCandidates = getApiCandidates(cfg);
    if (!apiCandidates.length) {
      return {
        ok: false,
        status: 'error',
        message: 'No LibreLink API endpoint configured.',
        reading: null,
        series: [],
        fetchedAt: new Date().toISOString(),
      };
    }

    const errors = [];
    for (const apiUrl of apiCandidates) {
      try {
        const { graph } = await fetchGraphViaDirectHTTP(cfg, apiUrl);
        const points = parseGraphPoints(graph);
        if (!points.length) throw new Error('No glucose points found in graph response.');
        const endTs = Date.now();
        const startTs = endTs - (Math.max(1, Number(hours) || 24) * 60 * 60 * 1000);
        const series = points.filter((item) => {
          const ts = new Date(item.timestamp).getTime();
          return Number.isFinite(ts) && ts >= startTs && ts <= (endTs + 60 * 1000);
        });
        const normalizedSeries = (series.length ? series : points).map((item) => ({
          timestamp: item.timestamp,
          value: Number(item.value),
          trend: normalizeTrend(item.trend),
        }));
        const latestPoint = normalizedSeries[normalizedSeries.length - 1];
        return {
          ok: true,
          status: 'ok',
          message: '',
          reading: buildReadingFromPoint(latestPoint, cfg),
          series: normalizedSeries,
          range: {
            targetLow: cfg.targetLow,
            targetHigh: cfg.targetHigh,
          },
          unit: 'mg/dL',
          fetchedAt: new Date().toISOString(),
        };
      } catch (error) {
        errors.push(`${apiUrl}: ${String(error?.message || 'unknown error')}`);
      }
    }
    throw new Error(errors.join(' | '));
  }

  async function fetchLatestReading() {
    const cfg = loadLibreConfig();
    if (!cfg.enabled) {
      return {
        ok: false,
        status: 'disabled',
        message: 'LibreLink credentials are not configured.',
        reading: null,
        fetchedAt: new Date().toISOString(),
      };
    }

    const apiCandidates = getApiCandidates(cfg);
    if (!apiCandidates.length) {
      return {
        ok: false,
        status: 'error',
        message: 'No LibreLink API endpoint configured.',
        reading: null,
        fetchedAt: new Date().toISOString(),
      };
    }
    const errors = [];
    for (const apiUrl of apiCandidates) {
      try {
        return await fetchLatestReadingViaDirectHTTP(cfg, apiUrl);
      } catch (error) {
        errors.push(`${apiUrl}: ${String(error?.message || 'unknown error')}`);
      }
    }

    if (!hasLibreDependency()) {
      return {
        ok: false,
        status: 'missing_dependency',
        message: 'libre-link-unofficial-api is not installed, and direct API attempts failed.',
        reading: null,
        fetchedAt: new Date().toISOString(),
      };
    }

    process.env.LIBRE_LINK_UP_VERSION = cfg.clientVersion || DEFAULT_LIBRE_CLIENT_VERSION;
    const ClientCtor = await loadClientCtor();
    if (!ClientCtor) {
      return {
        ok: false,
        status: 'error',
        message: errors.join(' | ') || 'All direct API attempts failed.',
        reading: null,
        fetchedAt: new Date().toISOString(),
      };
    }

    for (const apiUrl of apiCandidates) {
      try {
        process.env.LIBRE_LINK_API_URL = apiUrl;
        const client = new ClientCtor({
          email: cfg.email,
          password: cfg.password,
        });
        await client.login();
        const raw = await client.read();
        const value = Number(raw?.value);
        const trend = normalizeTrend(raw?.trendType || raw?.trend || '');
        const timestamp = toIsoTime(raw?.timestamp || raw?.FactoryTimestamp || raw?.Timestamp);
        const isHigh = Number.isFinite(value) && value > cfg.targetHigh;
        const isLow = Number.isFinite(value) && value < cfg.targetLow;
        return {
          ok: true,
          status: 'ok',
          message: '',
          reading: {
            value: Number.isFinite(value) ? value : null,
            unit: 'mg/dL',
            trend,
            timestamp,
            isHigh,
            isLow,
            targetLow: cfg.targetLow,
            targetHigh: cfg.targetHigh,
          },
          fetchedAt: new Date().toISOString(),
        };
      } catch (error) {
        errors.push(`sdk:${apiUrl}: ${String(error?.message || 'unknown error')}`);
      }
    }
    throw new Error(errors.join(' | '));
  }

  async function getLatest(options = {}) {
    const forceRefresh = options && options.force === true;
    const now = Date.now();
    const cfg = loadLibreConfig();
    const ttl = cfg.cacheMs;

    if (!forceRefresh && cache && (now - cache.cachedAt) <= ttl) {
      return { ...cache.payload, cacheHit: true };
    }
    if (inFlight) {
      const payload = await inFlight;
      return { ...payload, cacheHit: false };
    }

    inFlight = (async () => {
      try {
        const payload = await fetchLatestReading();
        cache = { cachedAt: Date.now(), payload };
        lastError = '';
        return payload;
      } catch (error) {
        const message = String(error?.message || 'Failed to read LibreLink glucose.');
        lastError = message;
        const payload = {
          ok: false,
          status: 'error',
          message,
          reading: null,
          fetchedAt: new Date().toISOString(),
        };
        cache = { cachedAt: Date.now(), payload };
        return payload;
      } finally {
        inFlight = null;
      }
    })();

    const payload = await inFlight;
    return { ...payload, cacheHit: false };
  }

  async function getHistory(options = {}) {
    const forceRefresh = options && options.force === true;
    const hoursRaw = Number(options?.hours);
    const hours = Number.isFinite(hoursRaw) ? Math.min(72, Math.max(3, Math.round(hoursRaw))) : 24;
    const now = Date.now();
    const cfg = loadLibreConfig();
    const ttl = cfg.cacheMs;

    if (!forceRefresh && historyCache && historyCache.hours === hours && (now - historyCache.cachedAt) <= ttl) {
      return { ...historyCache.payload, cacheHit: true };
    }
    if (historyInFlight) {
      const payload = await historyInFlight;
      return { ...payload, cacheHit: false };
    }

    historyInFlight = (async () => {
      try {
        const payload = await fetchHistoryReading(hours);
        historyCache = { cachedAt: Date.now(), hours, payload };
        lastError = '';
        return payload;
      } catch (error) {
        const message = String(error?.message || 'Failed to read LibreLink glucose history.');
        lastError = message;
        const payload = {
          ok: false,
          status: 'error',
          message,
          reading: null,
          series: [],
          fetchedAt: new Date().toISOString(),
        };
        historyCache = { cachedAt: Date.now(), hours, payload };
        return payload;
      } finally {
        historyInFlight = null;
      }
    })();

    const payload = await historyInFlight;
    return { ...payload, cacheHit: false };
  }

  function getStatus() {
    const cfg = loadLibreConfig();
    if (!cfg.enabled) return 'disabled';
    if (!hasLibreDependency()) return 'missing_dependency';
    if (lastError) return 'error';
    return 'ready';
  }

  return {
    getLatest,
    getHistory,
    getStatus,
  };
}

module.exports = {
  createGlucoseBridge,
};
