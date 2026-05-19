#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_BASE_URL = 'http://127.0.0.1:2199';
const DEFAULT_PLUGIN_DIR = path.join(ROOT, 'integrations', 'openclaw', 'morph-core');
const DEFAULT_OPENCLAW_CONFIG = path.join(process.env.HOME || '', '.openclaw', 'openclaw.json');

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const part = String(argv[index] || '').trim();
    if (!part.startsWith('--')) continue;
    const key = part.slice(2);
    const next = argv[index + 1];
    if (!next || String(next).startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'SELF_CHECK_FAILED';
    throw error;
  }
}

async function fetchJson(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${pathname} returned HTTP ${response.status}${payload && payload.error ? `: ${payload.error}` : ''}`);
  }
  return payload;
}

function ensureFileExists(filePath) {
  assert(fs.existsSync(filePath), `missing required file: ${path.relative(ROOT, filePath)}`);
}

function parseSemverParts(value) {
  return String(value || '')
    .trim()
    .split('.')
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
}

function compareSemver(left, right) {
  const a = parseSemverParts(left);
  const b = parseSemverParts(right);
  const len = Math.max(a.length, b.length);
  for (let index = 0; index < len; index += 1) {
    const av = a[index] || 0;
    const bv = b[index] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function validateOfficialPackage(pluginDir) {
  const requiredFiles = [
    path.join(pluginDir, 'package.json'),
    path.join(pluginDir, 'openclaw.plugin.json'),
    path.join(pluginDir, 'src', 'index.mjs'),
    path.join(pluginDir, 'skills', 'morph-core', 'SKILL.md'),
  ];
  requiredFiles.forEach(ensureFileExists);

  const packageJson = JSON.parse(fs.readFileSync(path.join(pluginDir, 'package.json'), 'utf8'));
  const pluginJson = JSON.parse(fs.readFileSync(path.join(pluginDir, 'openclaw.plugin.json'), 'utf8'));

  assert(packageJson.name === '@morph/openclaw-morph-core', 'unexpected connector package name');
  assert(pluginJson.id === 'morph-core', 'unexpected plugin id');
  assert(Array.isArray(pluginJson.skills) && pluginJson.skills.includes('./skills'), 'plugin must expose bundled skills');

  return {
    packageName: packageJson.name,
    version: String(packageJson.version || pluginJson.version || '').trim(),
    pluginId: pluginJson.id,
    pluginDir: path.relative(ROOT, pluginDir),
  };
}

function validateCapabilities(capabilities) {
  assert(capabilities && capabilities.ok === true, 'capabilities must return ok=true');
  assert(capabilities.syncApi && capabilities.syncApi.defaultExternalWrite === false, 'capabilities must mark /api/sync as non-default external write path');

  const queryEndpoints = Array.isArray(capabilities.queryEndpoints) ? capabilities.queryEndpoints : [];
  const actions = Array.isArray(capabilities.actionApi && capabilities.actionApi.actions)
    ? capabilities.actionApi.actions
    : [];

  assert(queryEndpoints.some((entry) => entry && entry.path === '/api/morph/capabilities'), 'capabilities endpoint must be discoverable');
  assert(queryEndpoints.some((entry) => entry && entry.path === '/api/morph/summary'), 'summary endpoint must be discoverable');
  assert(actions.some((entry) => entry && entry.action === 'create_project' && entry.enabled === true && entry.permission === 'append'), 'create_project must be enabled with append permission');
  assert(actions.some((entry) => entry && entry.action === 'delete_entity' && entry.enabled === false && entry.risk === 'high'), 'delete_entity must remain disabled high-risk action');

  return {
    queryEndpointCount: queryEndpoints.length,
    actionCount: actions.length,
    apiContractVersion: String(capabilities.apiContractVersion || '').trim(),
    minimumConnectorVersion: String(capabilities.connectorCompatibility?.minimumConnectorVersion || '').trim(),
    recommendedConnectorVersion: String(capabilities.connectorCompatibility?.recommendedConnectorVersion || '').trim(),
    explicitPermissionsRequired: capabilities.actionApi?.authorizationPolicy?.explicitPermissionsRequired === true,
  };
}

function inspectOpenClawConfig(configPath) {
  const out = {
    path: configPath,
    exists: false,
    mentionsPlugin: false,
    mentionsBaseUrl: false,
    mentionsAllowlist: false,
  };
  if (!configPath || !fs.existsSync(configPath)) return out;
  const text = fs.readFileSync(configPath, 'utf8');
  out.exists = true;
  out.mentionsPlugin = /morph-core/.test(text);
  out.mentionsBaseUrl = /baseUrl/.test(text) && /127\.0\.0\.1|localhost|https?:\/\//.test(text);
  out.mentionsAllowlist = /tools\s*:\s*\{[\s\S]*allow|morph_create_project|morph_complete_reminder|morph_link_entities/.test(text);
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args['base-url'] || process.env.MORPH_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/g, '');
  const pluginDir = path.resolve(String(args['plugin-dir'] || process.env.MORPH_OPENCLAW_PLUGIN_DIR || DEFAULT_PLUGIN_DIR));
  const openclawConfigPath = path.resolve(String(args['openclaw-config'] || process.env.OPENCLAW_CONFIG_PATH || DEFAULT_OPENCLAW_CONFIG));

  const packageInfo = validateOfficialPackage(pluginDir);
  const health = await fetchJson(baseUrl, '/api/health');
  assert(health && health.ok === true, 'health endpoint must return ok=true');

  const capabilities = await fetchJson(baseUrl, '/api/morph/capabilities');
  const capabilityInfo = validateCapabilities(capabilities);
  const configInfo = inspectOpenClawConfig(openclawConfigPath);
  const suggestions = [];

  if (capabilityInfo.minimumConnectorVersion && packageInfo.version
    && compareSemver(packageInfo.version, capabilityInfo.minimumConnectorVersion) < 0) {
    suggestions.push(`Connector version ${packageInfo.version} is older than the server minimum ${capabilityInfo.minimumConnectorVersion}.`);
  }
  if (!configInfo.exists) {
    suggestions.push(`OpenClaw config file was not found at ${openclawConfigPath}.`);
  } else {
    if (!configInfo.mentionsPlugin) suggestions.push('OpenClaw config does not appear to enable the `morph-core` plugin yet.');
    if (!configInfo.mentionsBaseUrl) suggestions.push('OpenClaw config does not appear to include a Morpheus `baseUrl` entry yet.');
    if (!configInfo.mentionsAllowlist) suggestions.push('OpenClaw config does not appear to allow optional Morpheus write tools yet.');
  }

  const result = {
    ok: true,
    baseUrl,
    package: packageInfo,
    capabilities: capabilityInfo,
    openclawConfig: configInfo,
    suggestions,
  };

  console.log('[openclaw:selfcheck] PASS');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('[openclaw:selfcheck] FAIL');
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
