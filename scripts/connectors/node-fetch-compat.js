const http = require('http');
const https = require('https');
const zlib = require('zlib');

function normalizeHeaders(headers = {}) {
  if (!headers || typeof headers !== 'object') return {};
  if (typeof headers.entries === 'function') return Object.fromEntries(headers.entries());
  return { ...headers };
}

function decodeBody(buffer, encoding = '') {
  const normalized = String(encoding || '').toLowerCase();
  if (normalized.includes('gzip')) return zlib.gunzipSync(buffer);
  if (normalized.includes('br')) return zlib.brotliDecompressSync(buffer);
  if (normalized.includes('deflate')) return zlib.inflateSync(buffer);
  return buffer;
}

function createFetchResponse({ statusCode = 0, statusMessage = '', headers = {}, body = Buffer.alloc(0), url = '' } = {}) {
  const decoded = decodeBody(body, headers['content-encoding']);
  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    statusText: statusMessage,
    headers,
    url,
    async text() {
      return decoded.toString('utf8');
    },
    async json() {
      const text = decoded.toString('utf8');
      return text ? JSON.parse(text) : null;
    },
  };
}

function nodeFetchCompat(url, options = {}) {
  const target = new URL(String(url || ''));
  const client = target.protocol === 'https:' ? https : http;
  const method = String(options.method || 'GET').toUpperCase();
  const headers = normalizeHeaders(options.headers);
  const body = options.body == null ? null : Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body));
  if (body && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-length')) {
    headers['content-length'] = String(body.length);
  }

  return new Promise((resolve, reject) => {
    const req = client.request(target, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve(createFetchResponse({
          statusCode: res.statusCode || 0,
          statusMessage: res.statusMessage || '',
          headers: res.headers || {},
          body: Buffer.concat(chunks),
          url: target.toString(),
        }));
      });
    });
    req.on('error', reject);
    if (options.signal) {
      if (options.signal.aborted) {
        req.destroy(new Error('The operation was aborted'));
        return;
      }
      options.signal.addEventListener('abort', () => {
        req.destroy(new Error('The operation was aborted'));
      }, { once: true });
    }
    if (body) req.write(body);
    req.end();
  });
}

function resolveFetch(fetchImpl) {
  if (typeof fetchImpl === 'function') return fetchImpl;
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
  return nodeFetchCompat;
}

module.exports = {
  nodeFetchCompat,
  resolveFetch,
};
