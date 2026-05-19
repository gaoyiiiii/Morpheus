const http = require('http');

function createServerBootstrap(deps = {}) {
  const api = deps && typeof deps === 'object' ? deps : {};
  const serverApiRoute = api.serverApiRoute && typeof api.serverApiRoute.handleApiRequest === 'function'
    ? api.serverApiRoute
    : null;
  const staticFileRoute = api.staticFileRoute && typeof api.staticFileRoute.handleStaticFileRequest === 'function'
    ? api.staticFileRoute
    : null;
  const syncEvents = api.syncEvents && typeof api.syncEvents.startLiveDataWatch === 'function'
    ? api.syncEvents
    : null;
  const host = String(api.host || '127.0.0.1').trim() || '127.0.0.1';
  const port = Number(api.port || 2199) || 2199;
  const logger = api.logger && typeof api.logger.log === 'function' ? api.logger : console;
  const onListen = typeof api.onListen === 'function' ? api.onListen : null;
  const liveDataStore = api.liveDataStore || null;
  const startupStorage = api.startupStorage && typeof api.startupStorage === 'object' ? api.startupStorage : null;

  function createMorphServer() {
    const server = http.createServer((req, res) => {
      if ((req.url || '').startsWith('/api/')) {
        if (serverApiRoute) {
          const maybePromise = serverApiRoute.handleApiRequest(req, res);
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch((error) => {
              logger.warn('[Morpheus server] api route failed:', error?.message || error);
            });
          }
          return;
        }
      }
      if (staticFileRoute) {
        staticFileRoute.handleStaticFileRequest(req, res);
      }
    });
    return server;
  }

  function startServer() {
    if (syncEvents) {
      syncEvents.startLiveDataWatch();
    }
    const server = createMorphServer();
    server.listen(port, host, () => {
      logger.log(`Morpheus server running at http://${host}:${port}`);
      logger.log('Realtime sync API: POST /api/sync');
      logger.log('Realtime sync events: GET /api/sync/events');
      const canonicalStore = liveDataStore && typeof liveDataStore.describeCanonicalStore === 'function'
        ? liveDataStore.describeCanonicalStore()
        : null;
      if (canonicalStore?.absolutePath) {
        logger.log(`[Morpheus server] live data source: ${canonicalStore.absolutePath} (${canonicalStore.selection || 'unknown'})`);
      } else if (startupStorage?.liveDataFile) {
        logger.log(`[Morpheus server] live data source: ${startupStorage.liveDataFile}`);
      }
      if (onListen) onListen(server);
    });
    return server;
  }

  return {
    createMorphServer,
    startServer,
  };
}

module.exports = {
  createServerBootstrap,
};
