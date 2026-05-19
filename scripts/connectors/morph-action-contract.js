const fs = require('fs');
const path = require('path');

function sanitizeMorphActionName(raw) {
  return String(raw || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9:_-]/g, '');
}

function loadMorphActionRegistry() {
  try {
    const filePath = path.join(__dirname, '..', '..', 'morph-runtime', 'action-registry.json');
    const text = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function loadActionAliases() {
  const parsed = loadMorphActionRegistry();
  const aliases = parsed && typeof parsed.aliases === 'object' ? parsed.aliases : {};
  const actions = parsed && parsed.actions && typeof parsed.actions === 'object' ? parsed.actions : {};
  const normalized = {};
  Object.entries(aliases).forEach(([alias, canonical]) => {
    const safeAlias = sanitizeMorphActionName(alias);
    const safeCanonical = sanitizeMorphActionName(canonical);
    if (!safeAlias || !safeCanonical) return;
    normalized[safeAlias] = safeCanonical;
  });
  Object.entries(actions).forEach(([actionName, value]) => {
    const safeAction = sanitizeMorphActionName(actionName);
    const entry = value && typeof value === 'object' ? value : {};
    const safeCanonical = sanitizeMorphActionName(entry.canonicalAction || actionName);
    if (!safeAction || !safeCanonical) return;
    if (safeAction !== safeCanonical) normalized[safeAction] = safeCanonical;
    (Array.isArray(entry.aliases) ? entry.aliases : []).forEach((alias) => {
      const safeAlias = sanitizeMorphActionName(alias);
      const safeCanonicalAlias = sanitizeMorphActionName(entry.canonicalAction || actionName);
      if (!safeAlias || !safeCanonicalAlias) return;
      normalized[safeAlias] = safeCanonicalAlias;
    });
  });
  if (Object.keys(normalized).length) {
    return Object.freeze(normalized);
  }
  try {
    const filePath = path.join(__dirname, '..', '..', 'morph-runtime', 'action-contract.json');
    const text = fs.readFileSync(filePath, 'utf8');
    const fallbackParsed = JSON.parse(text);
    const fallbackAliases = fallbackParsed && typeof fallbackParsed.aliases === 'object' ? fallbackParsed.aliases : {};
    const fallbackNormalized = {};
    Object.entries(fallbackAliases).forEach(([alias, canonical]) => {
      const safeAlias = sanitizeMorphActionName(alias);
      const safeCanonical = sanitizeMorphActionName(canonical);
      if (!safeAlias || !safeCanonical) return;
      fallbackNormalized[safeAlias] = safeCanonical;
    });
    return Object.freeze(fallbackNormalized);
  } catch (_) {
    return Object.freeze({});
  }
}

const ACTION_REGISTRY = loadMorphActionRegistry();
const ACTION_ALIASES = loadActionAliases();

function getCanonicalMorphActionName(raw) {
  const actionName = sanitizeMorphActionName(raw);
  if (!actionName) return '';
  return ACTION_ALIASES[actionName] || actionName;
}

function getMorphActionAliases(raw) {
  const canonicalAction = getCanonicalMorphActionName(raw);
  if (!canonicalAction) return [];
  return Object.keys(ACTION_ALIASES).filter((alias) => ACTION_ALIASES[alias] === canonicalAction);
}

function buildMorphActionIdentity(raw) {
  const requestedAction = sanitizeMorphActionName(raw);
  const canonicalAction = getCanonicalMorphActionName(requestedAction);
  return {
    requestedAction,
    canonicalAction,
    isAlias: !!requestedAction && !!canonicalAction && requestedAction !== canonicalAction,
    aliases: getMorphActionAliases(canonicalAction),
  };
}

module.exports = {
  ACTION_ALIASES,
  ACTION_REGISTRY,
  buildMorphActionIdentity,
  getCanonicalMorphActionName,
  getMorphActionAliases,
  loadMorphActionRegistry,
  sanitizeMorphActionName,
};
