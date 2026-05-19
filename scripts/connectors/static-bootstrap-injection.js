function escapeInlineScriptJson(value) {
  return JSON.stringify(value == null ? null : value).replace(/<\/script/gi, '<\\/script');
}

function replaceInlineJsonScript(source, scriptId, serializedPayload) {
  const pattern = new RegExp(
    `(<script[^>]*id=["']${scriptId}["'][^>]*type=["']application/json["'][^>]*>)([\\s\\S]*?)(</script>)`
  );
  return String(source || '').replace(pattern, (_, open, _old, close) => `${open}${serializedPayload}${close}`);
}

function createStaticBootstrapInjection(deps = {}) {
  const api = deps && typeof deps === 'object' ? deps : {};

  function getCanonicalStoreFallback() {
    if (api.liveDataStore && typeof api.liveDataStore.describeCanonicalStore === 'function') {
      return api.liveDataStore.describeCanonicalStore();
    }
    return null;
  }

  function buildStartupStorageDescriptor(envelope = null) {
    const storageTopology = envelope && typeof envelope === 'object' && envelope.storageTopology && typeof envelope.storageTopology === 'object'
      ? envelope.storageTopology
      : null;
    const fallbackCanonicalStore = getCanonicalStoreFallback();
    const canonicalStore = storageTopology?.canonicalStore && typeof storageTopology.canonicalStore === 'object'
      ? {
        ...(fallbackCanonicalStore || {}),
        ...storageTopology.canonicalStore,
      }
      : (fallbackCanonicalStore || {
        kind: 'live-data-json',
        relativePath: 'data/live-data.json',
        role: 'authoritative-user-store',
        owner: 'core-data',
      });
    const authoritativeWritePath = storageTopology?.authoritativeWritePath && typeof storageTopology.authoritativeWritePath === 'object'
      ? storageTopology.authoritativeWritePath
      : {
        strategy: 'full-snapshot-commit',
        allowedWriters: ['server-sync', 'native-sync'],
      };
    const syncMeta = envelope && typeof envelope === 'object' && envelope.data && typeof envelope.data === 'object'
      ? envelope.data.syncMeta || {}
      : {};
    const revision = Number(syncMeta?.revision || 0);
    return {
      descriptorVersion: 'startup-storage.v1',
      contractVersion: String(storageTopology?.contractVersion || '').trim(),
      bootstrapSource: 'server-bootstrap-cache',
      migrationState: String(storageTopology?.migrationState || '').trim(),
      storageTopology,
      canonicalStore,
      authoritativeWritePath,
      cacheReplicas: Array.isArray(storageTopology?.cacheReplicas) ? storageTopology.cacheReplicas : [],
      derivedReplicas: Array.isArray(storageTopology?.derivedReplicas) ? storageTopology.derivedReplicas : [],
      authoritativeSnapshot: {
        source: 'bootstrap-cache',
        revision: Number.isFinite(revision) ? revision : 0,
        lastWriteAt: String(syncMeta?.lastClientWriteAt || syncMeta?.lastServerWriteAt || '').trim(),
        hasUserData: !!(envelope && typeof envelope === 'object' && envelope.data && typeof envelope.data === 'object'),
      },
    };
  }

  function buildServerShellDescriptor(envelope = null) {
    const startupDescriptor = buildStartupStorageDescriptor(envelope);
    const syncMeta = envelope && typeof envelope === 'object' && envelope.data && typeof envelope.data === 'object'
      ? envelope.data.syncMeta || {}
      : {};
    const revision = Number(syncMeta?.revision || 0);
    const lastReceiptAt = String(syncMeta?.lastServerWriteAt || syncMeta?.lastClientWriteAt || '').trim();
    return {
      descriptorVersion: 'shell.v1',
      platform: 'web',
      shellKind: 'browser',
      syncMode: 'web-local-server',
      bootstrapSource: startupDescriptor.bootstrapSource,
      canonicalStore: {
        kind: String(startupDescriptor.canonicalStore?.kind || 'live-data-json').trim() || 'live-data-json',
        pathHint: String(startupDescriptor.canonicalStore?.relativePath || 'data/live-data.json').trim() || 'data/live-data.json',
        absolutePath: String(startupDescriptor.canonicalStore?.absolutePath || '').trim(),
        selection: String(startupDescriptor.canonicalStore?.selection || '').trim(),
        revision: Number.isFinite(revision) ? revision : 0,
      },
      syncRoot: {
        kind: 'local-server-cache',
        pathHint: 'data/live-data.json',
        isUserSelected: false,
        isWritable: true,
      },
      capabilities: {
        nativeSyncBridge: false,
        nativeControlBridge: false,
        nativeSpeechBridge: false,
        localServer: true,
        browserDirectoryAccess: false,
        notifications: false,
        pushToken: false,
      },
      durableWriteOwner: 'local-server',
      receiptFeed: {
        kind: 'sync-events',
        lastReceiptId: '',
        lastReceiptAt,
        status: '',
        source: 'server-bootstrap-cache',
        reason: '',
        pendingCount: 0,
        ackedRevision: Number.isFinite(revision) ? revision : 0,
      },
      bridgeStatus: {
        sync: 'available',
        control: 'unavailable',
        speech: 'unavailable',
      },
    };
  }

  function buildAtlasBootstrapPayload() {
    if (!api.atlasStore || typeof api.atlasStore.buildPayload !== 'function') {
      return null;
    }
    return escapeInlineScriptJson(api.atlasStore.buildPayload());
  }

  function buildMorphBootstrapPayload() {
    if (!api.liveDataStore || typeof api.liveDataStore.readCurrentLiveEnvelopeSafely !== 'function') {
      return null;
    }
    const envelope = api.liveDataStore.readCurrentLiveEnvelopeSafely();
    return escapeInlineScriptJson({
      ok: true,
      source: 'data/live-data.json',
      sourcePath: String(getCanonicalStoreFallback()?.absolutePath || '').trim(),
      bootstrapSource: 'server-bootstrap-cache',
      generatedAt: new Date().toISOString(),
      startupDescriptor: buildStartupStorageDescriptor(envelope),
      shellDescriptor: buildServerShellDescriptor(envelope),
      envelope,
    });
  }

  function injectMorphHtmlBootstrap(html) {
    const atlasBootstrap = buildAtlasBootstrapPayload();
    const morphBootstrap = buildMorphBootstrapPayload();
    if (!atlasBootstrap || !morphBootstrap) return String(html || '');
    let injected = replaceInlineJsonScript(html, 'channel-ops-bootstrap-data', atlasBootstrap);
    injected = replaceInlineJsonScript(injected, 'morph-bootstrap-cache-data', morphBootstrap);
    return injected;
  }

  return {
    buildAtlasBootstrapPayload,
    buildServerShellDescriptor,
    buildStartupStorageDescriptor,
    buildMorphBootstrapPayload,
    injectMorphHtmlBootstrap,
  };
}

module.exports = {
  createStaticBootstrapInjection,
  escapeInlineScriptJson,
  replaceInlineJsonScript,
};
