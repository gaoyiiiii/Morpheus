const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getContentType(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function createStaticFileRoute(deps = {}) {
  const api = deps && typeof deps === 'object' ? deps : {};
  const liveDataFile = String(api.liveDataFile || '').trim();
  const staticBootstrapInjection = api.staticBootstrapInjection
    && typeof api.staticBootstrapInjection.injectMorphHtmlBootstrap === 'function'
    ? api.staticBootstrapInjection
    : null;
  const sendJson = typeof api.sendJson === 'function' ? api.sendJson : null;
  const safeResolvePath = typeof api.safeResolvePath === 'function' ? api.safeResolvePath : null;

  function respondWithFile(res, absPath, options = {}) {
    const { contentType, cacheControl } = options;
    const stream = fs.createReadStream(absPath);
    let opened = false;
    stream.on('open', () => {
      opened = true;
      res.writeHead(200, {
        'Content-Type': contentType || getContentType(absPath),
        'Cache-Control': cacheControl || 'no-cache',
      });
      stream.pipe(res);
    });
    stream.on('error', (error) => {
      if (!opened && !res.headersSent) {
        sendJson(res, 503, {
          error: 'File unavailable',
          detail: error?.message || String(error || ''),
        });
        return;
      }
      try {
        res.destroy(error);
      } catch (_) {}
    });
  }

  function respondWithInjectedHtml(res, absPath) {
    if (!staticBootstrapInjection) return false;
    try {
      const html = fs.readFileSync(absPath, 'utf8');
      const injected = staticBootstrapInjection.injectMorphHtmlBootstrap(html);
      res.writeHead(200, {
        'Content-Type': getContentType(absPath),
        'Cache-Control': 'no-store',
      });
      res.end(injected);
      return true;
    } catch (_) {
      return false;
    }
  }

  function handleLiveDataJson(res) {
    if (!liveDataFile) {
      sendJson(res, 404, { error: 'Not found' });
      return true;
    }
    fs.stat(liveDataFile, (err, stat) => {
      if (err || !stat.isFile()) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }
      respondWithFile(res, liveDataFile, {
        contentType: 'application/json; charset=utf-8',
        cacheControl: 'no-store',
      });
    });
    return true;
  }

  function handleStaticFileRequest(req, res) {
    if (!sendJson || !safeResolvePath) {
      throw new Error('static file route requires sendJson and safeResolvePath');
    }

    const requestPath = (req.url || '/').split('?')[0];
    const effectiveUrl = requestPath === '/' ? '/morph.html' : (req.url || '/');
    if (requestPath === '/data/live-data.json') {
      return handleLiveDataJson(res);
    }

    const abs = safeResolvePath(effectiveUrl);
    if (!abs) {
      sendJson(res, 403, { error: 'Forbidden' });
      return true;
    }

    fs.stat(abs, (err, stat) => {
      if (err || !stat.isFile()) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }
      const ext = path.extname(abs).toLowerCase();
      if (ext === '.html' && path.basename(abs) === 'morph.html') {
        if (respondWithInjectedHtml(res, abs)) return;
      }
      respondWithFile(res, abs, {
        cacheControl: ext === '.html' ? 'no-store' : 'no-cache',
      });
    });

    return true;
  }

  return {
    handleStaticFileRequest,
  };
}

module.exports = {
  createStaticFileRoute,
};
