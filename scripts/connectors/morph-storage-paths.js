const fs = require('fs');
const os = require('os');
const path = require('path');

function toSafeText(value = '') {
  return String(value || '').trim();
}

function toResolvedPath(value = '') {
  const normalized = toSafeText(value);
  return normalized ? path.resolve(normalized) : '';
}

function pathsEqual(a = '', b = '') {
  const left = toResolvedPath(a);
  const right = toResolvedPath(b);
  return !!left && !!right && left === right;
}

function existsSyncSafe(existsSync, targetPath = '') {
  const candidate = toResolvedPath(targetPath);
  if (!candidate) return false;
  try {
    return existsSync(candidate);
  } catch (_) {
    return false;
  }
}

function deriveSyncRootFromLiveDataFile(filePath = '') {
  const resolved = toResolvedPath(filePath);
  if (!resolved) return '';
  if (path.basename(resolved) !== 'live-data.json') return '';
  const dataDir = path.dirname(resolved);
  if (path.basename(dataDir) !== 'data') return '';
  return path.dirname(dataDir);
}

function deriveCanonicalRelativePath(syncRoot = '', liveDataFile = '') {
  const resolvedRoot = toResolvedPath(syncRoot);
  const resolvedFile = toResolvedPath(liveDataFile);
  if (!resolvedFile) return 'data/live-data.json';
  if (path.basename(resolvedFile) === 'live-data.json') return 'data/live-data.json';
  if (resolvedRoot && pathsEqual(resolvedFile, path.join(resolvedRoot, 'data', 'live-data.json'))) {
    return 'data/live-data.json';
  }
  return path.basename(resolvedFile) || 'live-data.json';
}

function buildCanonicalStoreDescriptor(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const liveDataFile = toResolvedPath(source.liveDataFile);
  const syncRoot = toResolvedPath(source.syncRoot);
  return {
    kind: 'live-data-json',
    relativePath: deriveCanonicalRelativePath(syncRoot, liveDataFile),
    absolutePath: liveDataFile,
    syncRoot,
    role: 'authoritative-user-store',
    owner: 'core-data',
    selection: toSafeText(source.selection),
  };
}

function resolveMorphStoragePaths(options = {}) {
  const env = options.env && typeof options.env === 'object' ? options.env : process.env;
  const existsSync = typeof options.existsSync === 'function' ? options.existsSync : fs.existsSync;
  const rootDir = toResolvedPath(options.rootDir || process.cwd()) || process.cwd();
  const homedirValue = typeof options.homedir === 'function' ? options.homedir() : options.homedir;
  const homedir = toResolvedPath(homedirValue || os.homedir()) || os.homedir();

  const iCloudRoot = path.join(homedir, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Morph');
  const documentsRoot = path.join(homedir, 'Documents', 'Morph');
  const repoFallbackLiveDataFile = path.join(rootDir, 'data', 'live-data.json');

  const explicitSyncRoot = [
    env.MORPH_USER_SYNC_ROOT,
    env.LIANXING_USER_SYNC_ROOT,
  ]
    .map((value) => toResolvedPath(value))
    .find((candidate) => candidate && existsSyncSafe(existsSync, candidate));

  const preferredSyncRoot = [
    iCloudRoot,
    documentsRoot,
  ].find((candidate) => existsSyncSafe(existsSync, path.join(candidate, 'data', 'live-data.json'))) || '';

  const explicitLiveDataFile = toResolvedPath(env.MORPH_LIVE_DATA_FILE);
  const explicitMirrorDir = toResolvedPath(env.MORPH_MD_MIRROR_DIR);
  const explicitActionLogFile = toResolvedPath(env.MORPH_ACTION_LOG_FILE);

  let syncRoot = '';
  let liveDataFile = '';
  let selection = 'repo-fallback';
  const notes = [];

  if (explicitSyncRoot) {
    syncRoot = explicitSyncRoot;
    selection = 'explicit-sync-root';
  } else if (explicitLiveDataFile) {
    const derivedSyncRoot = deriveSyncRootFromLiveDataFile(explicitLiveDataFile);
    const isRepoFallbackOverride = pathsEqual(explicitLiveDataFile, repoFallbackLiveDataFile);
    if (isRepoFallbackOverride && preferredSyncRoot) {
      syncRoot = preferredSyncRoot;
      selection = 'preferred-sync-root';
      notes.push('ignored_explicit_repo_live_data_override');
    } else if (derivedSyncRoot) {
      syncRoot = derivedSyncRoot;
      liveDataFile = explicitLiveDataFile;
      selection = 'explicit-live-data-file';
    } else {
      liveDataFile = explicitLiveDataFile;
      selection = 'explicit-live-data-file';
      notes.push('standalone_live_data_file');
    }
  }

  if (!syncRoot && !liveDataFile && preferredSyncRoot) {
    syncRoot = preferredSyncRoot;
    selection = 'preferred-sync-root';
  }

  if (!syncRoot && !liveDataFile) {
    syncRoot = rootDir;
    selection = 'repo-fallback';
  }

  if (!liveDataFile) {
    liveDataFile = path.join(syncRoot, 'data', 'live-data.json');
  }

  const effectiveRoot = syncRoot || rootDir;
  const mirrorDir = explicitMirrorDir || path.join(effectiveRoot, 'morph_md_mirror');
  const actionLogFile = explicitActionLogFile || path.join(effectiveRoot, 'data', 'morph-action-log.ndjson');
  const canonicalStore = buildCanonicalStoreDescriptor({
    liveDataFile,
    syncRoot,
    selection,
  });

  return {
    rootDir,
    homedir,
    iCloudRoot,
    documentsRoot,
    syncRoot: syncRoot || '',
    storageRoot: effectiveRoot,
    liveDataFile,
    mirrorDir,
    actionLogFile,
    canonicalStore,
    source: {
      selection,
      explicitSyncRoot: explicitSyncRoot || '',
      explicitLiveDataFile,
      preferredSyncRoot,
      notes,
    },
  };
}

module.exports = {
  buildCanonicalStoreDescriptor,
  deriveCanonicalRelativePath,
  deriveSyncRootFromLiveDataFile,
  resolveMorphStoragePaths,
};
