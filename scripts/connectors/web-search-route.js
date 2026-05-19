function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createWebSearchRoute(deps = {}) {
  const api = deps && typeof deps === 'object' ? deps : {};

  function fetchWithTimeout(url, options = {}, timeoutMs = 6500) {
    const fetchImpl = typeof api.fetchImpl === 'function' ? api.fetchImpl : fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetchImpl(url, { ...options, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
    });
  }

  function pushItem(items, title, link, snippet) {
    const t = String(title || '').trim();
    const u = String(link || '').trim();
    const s = String(snippet || '').trim();
    if (!t || !u) return;
    items.push({
      title: t.slice(0, 200),
      url: u.slice(0, 1000),
      snippet: s.slice(0, 500),
      source: 'duckduckgo',
    });
  }

  function decodeDuckDuckGoRedirectUrl(rawLink) {
    const clean = String(rawLink || '').trim();
    if (!clean) return '';
    try {
      const parsed = new URL(clean, 'https://duckduckgo.com');
      if (parsed.pathname === '/l/') {
        const uddg = parsed.searchParams.get('uddg');
        if (uddg) return decodeURIComponent(uddg);
      }
      return parsed.toString();
    } catch (_) {
      return clean;
    }
  }

  function stripHtml(text) {
    return String(text || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function searchDuckDuckGo(query = '', limit = 5) {
    const q = String(query || '').trim();
    if (!q) return [];
    const safeLimit = Math.max(1, Math.min(10, Number(limit) || 5));
    const requestHeaders = { 'User-Agent': 'Morpheus/1.0 (+local-search-proxy)' };
    const items = [];

    try {
      const instantUrl = new URL('https://api.duckduckgo.com/');
      instantUrl.searchParams.set('q', q);
      instantUrl.searchParams.set('format', 'json');
      instantUrl.searchParams.set('no_html', '1');
      instantUrl.searchParams.set('no_redirect', '1');
      const res = await fetchWithTimeout(instantUrl.toString(), {
        method: 'GET',
        headers: requestHeaders,
      });
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json === 'object') {
          pushItem(items, json.Heading || q, json.AbstractURL || '', json.AbstractText || '');
          const related = Array.isArray(json.RelatedTopics) ? json.RelatedTopics : [];
          related.forEach((entry) => {
            if (entry && typeof entry === 'object' && Array.isArray(entry.Topics)) {
              entry.Topics.forEach((topic) => {
                if (!topic || typeof topic !== 'object') return;
                pushItem(items, topic.Text || '', topic.FirstURL || '', topic.Text || '');
              });
              return;
            }
            if (!entry || typeof entry !== 'object') return;
            pushItem(items, entry.Text || '', entry.FirstURL || '', entry.Text || '');
          });
        }
      }
    } catch (_) {
      // Keep best-effort only, then fallback to HTML SERP extraction.
    }

    if (items.length < safeLimit) {
      try {
        const htmlUrl = new URL('https://html.duckduckgo.com/html/');
        htmlUrl.searchParams.set('q', q);
        const htmlRes = await fetchWithTimeout(htmlUrl.toString(), {
          method: 'GET',
          headers: requestHeaders,
        });
        if (htmlRes.ok) {
          const html = String(await htmlRes.text() || '');
          const resultRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          let match = null;
          while ((match = resultRegex.exec(html)) !== null) {
            const href = decodeDuckDuckGoRedirectUrl(match[1]);
            const title = stripHtml(match[2]);
            if (!href || !title) continue;
            const start = Math.max(0, match.index - 400);
            const end = Math.min(html.length, match.index + 1200);
            const nearby = html.slice(start, end);
            const snippetMatch = nearby.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
              || nearby.match(/<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            const snippet = stripHtml(snippetMatch ? snippetMatch[1] : '');
            pushItem(items, title, href, snippet);
            if (items.length >= safeLimit * 3) break;
          }
        }
      } catch (_) {
        // Keep quiet; we'll return whatever we already have.
      }
    }

    if (items.length < safeLimit) {
      try {
        const bingUrl = new URL('https://www.bing.com/search');
        bingUrl.searchParams.set('q', q);
        bingUrl.searchParams.set('format', 'rss');
        const bingRes = await fetchWithTimeout(bingUrl.toString(), {
          method: 'GET',
          headers: requestHeaders,
        });
        if (bingRes.ok) {
          const xml = String(await bingRes.text() || '');
          const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
          let match = null;
          while ((match = itemRegex.exec(xml)) !== null) {
            const chunk = String(match[1] || '');
            const title = (chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
            const link = (chunk.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
            const desc = (chunk.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
            pushItem(items, stripHtml(title), link, stripHtml(desc));
            if (items.length >= safeLimit * 4) break;
          }
        }
      } catch (_) {
        // Keep quiet; this is fallback path.
      }
    }

    const dedup = [];
    const seen = new Set();
    items.forEach((item) => {
      const key = `${item.url}::${item.title}`;
      if (seen.has(key)) return;
      seen.add(key);
      dedup.push(item);
    });
    return dedup.slice(0, safeLimit);
  }

  async function handleWebSearchRequest(req, res, context = {}) {
    const url = String(context.url || req.url || '').split('?')[0];
    if (req.method !== 'GET' || url !== '/api/web/search') return false;
    const sendJson = typeof context.sendJson === 'function' ? context.sendJson : api.sendJson;
    if (typeof sendJson !== 'function') {
      throw new Error('sendJson is required for web search route handling');
    }
    try {
      const reqUrl = new URL(req.url || '/api/web/search', `http://${context.host || api.host || '127.0.0.1'}:${context.port || api.port || 2199}`);
      const q = String(reqUrl.searchParams.get('q') || '').trim();
      const limit = Number(reqUrl.searchParams.get('limit'));
      if (!q) {
        sendJson(res, 400, { ok: false, error: 'q is required' });
        return true;
      }
      const results = await searchDuckDuckGo(q, limit);
      sendJson(res, 200, {
        ok: true,
        query: q,
        results,
        fetchedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message || 'web search failed' });
      return true;
    }
  }

  return {
    handleWebSearchRequest,
    searchDuckDuckGo,
    cloneJson,
  };
}

module.exports = {
  createWebSearchRoute,
};
