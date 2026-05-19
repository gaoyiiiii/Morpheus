function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Morph-Codex-Token',
    'Access-Control-Allow-Private-Network': 'true',
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req, options = {}) {
  const maxBodyBytes = Math.max(0, Number(options.maxBodyBytes) || 8 * 1024 * 1024);
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function safeResolvePath(urlPath, options = {}) {
  const rootDir = String(options.rootDir || '').trim();
  if (!rootDir) return null;
  let pathname = String(urlPath || '/').split('?')[0];
  try {
    pathname = decodeURIComponent(pathname);
  } catch (_) {}
  if (pathname === '/') pathname = '/morph.html';
  if (pathname === '/lian.html') pathname = '/morph.html';
  const abs = require('path').resolve(rootDir, `.${pathname}`);
  if (!abs.startsWith(rootDir)) return null;
  return abs;
}

function createServerHttpUtils(deps = {}) {
  const api = deps && typeof deps === 'object' ? deps : {};
  const rootDir = String(api.rootDir || '').trim();
  const maxBodyBytes = Math.max(0, Number(api.maxBodyBytes) || 8 * 1024 * 1024);

  return {
    readRequestBody(req) {
      return readRequestBody(req, { maxBodyBytes });
    },
    safeResolvePath(urlPath) {
      return safeResolvePath(urlPath, { rootDir });
    },
    sendJson,
  };
}

module.exports = {
  createServerHttpUtils,
  readRequestBody,
  safeResolvePath,
  sendJson,
};
