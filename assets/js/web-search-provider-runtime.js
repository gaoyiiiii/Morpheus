// @ts-check
(function initMorphWebSearchProviderRuntime() {
  /**
   * @typedef {import('../../interfaces/web-search').WebSearchProviderManifest} WebSearchProviderManifest
   * @typedef {import('../../interfaces/web-search').WebSearchProviderResponse} WebSearchProviderResponse
   */

  function createWebSearchProviderRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    /** @type {WebSearchProviderManifest[]} */
    const providers = [
      {
        id: 'builtin-local-api',
        name: 'Builtin Local Search',
        kind: 'builtin',
        enabled: true,
        description: '默认本地 `/api/web/search` 提供方。',
      },
    ];

    function getProviders() {
      return providers.slice();
    }

    function getSelectedProviderId() {
      try {
        const stored = localStorage.getItem('morph_web_search_provider_v1');
        return stored || providers[0].id;
      } catch (_) {
        return providers[0].id;
      }
    }

    function setSelectedProviderId(providerId = '') {
      const nextId = String(providerId || '').trim();
      if (!nextId) return;
      try {
        localStorage.setItem('morph_web_search_provider_v1', nextId);
      } catch (_) {}
    }

    async function search(query = '', options = {}) {
      const q = String(query || '').trim();
      if (!q) {
        return { ok: false, providerId: getSelectedProviderId(), results: [], error: 'empty_query' };
      }
      if (typeof api.runBuiltinSearch === 'function') {
        return api.runBuiltinSearch(q, options);
      }
      return { ok: false, providerId: getSelectedProviderId(), results: [], error: 'no_provider' };
    }

    function resolveResultLimit() {
      const raw = Number(api.resultLimit);
      return Number.isFinite(raw) && raw > 0 ? Math.max(1, Math.floor(raw)) : 5;
    }

    function clipText(value = '', maxLength = 160) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      const safeMax = Math.max(24, Number(maxLength || 0) || 160);
      if (!text) return '';
      return text.length > safeMax
        ? `${text.slice(0, Math.max(0, safeMax - 1)).trim()}…`
        : text;
    }

    function getDisplayHost(url = '') {
      const source = String(url || '').trim();
      if (!source) return '';
      try {
        return new URL(source).hostname || source;
      } catch (_) {
        return source;
      }
    }

    async function fetchWebSearchContext(question = '', { force = false } = {}) {
      if (!force) return { contextText: '', citations: [] };
      const normalizeWebSearchQuery = typeof api.normalizeWebSearchQuery === 'function'
        ? api.normalizeWebSearchQuery
        : (value) => String(value || '').trim();
      const pickSearchKeywords = typeof api.pickSearchKeywords === 'function'
        ? api.pickSearchKeywords
        : () => [];
      const extractCoreSearchToken = typeof api.extractCoreSearchToken === 'function'
        ? api.extractCoreSearchToken
        : () => '';
      const scoreSearchResultRelevance = typeof api.scoreSearchResultRelevance === 'function'
        ? api.scoreSearchResultRelevance
        : () => 0;
      const containsTokenInResult = typeof api.containsTokenInResult === 'function'
        ? api.containsTokenInResult
        : () => true;
      const isFreshNewsIntent = typeof api.isFreshNewsIntent === 'function'
        ? api.isFreshNewsIntent
        : () => false;

      const q = normalizeWebSearchQuery(question);
      if (!q) return { contextText: '', citations: [] };
      const manualUrl = `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;

      try {
        const limit = resolveResultLimit();
        const payload = await search(q, { limit });
        if (!payload?.ok) {
          return {
            contextText: `联网搜索暂时不可用。需要时可提示用户改用手动搜索：${manualUrl}`,
            citations: [{ source: manualUrl, title: `搜索：${q}` }],
          };
        }
        const rawResults = Array.isArray(payload?.results) ? payload.results : [];
        const keywords = pickSearchKeywords(q, 10);
        const coreToken = extractCoreSearchToken(q);
        const newsIntent = isFreshNewsIntent(q);
        const ranked = rawResults
          .map((item) => ({ item, score: scoreSearchResultRelevance(item, keywords) }))
          .sort((a, b) => b.score - a.score);
        const minScore = newsIntent ? 4 : 2;
        const strong = ranked
          .filter((entry) => entry.score >= minScore)
          .map((entry) => entry.item)
          .filter((item) => containsTokenInResult(item, coreToken));
        const results = strong.slice(0, limit);
        if (!results.length) {
          return {
            contextText: `联网搜索未找到高相关可信结果。不要编造；先直接说明未找到，并在需要时提示用户改写关键词或手动搜索：${manualUrl}`,
            citations: [],
          };
        }
        const lines = results.slice(0, Math.min(limit, 3)).map((item, idx) => {
          const title = clipText(item?.title || '未命名结果', 72);
          const snippet = clipText(item?.snippet || '', 120);
          const host = clipText(getDisplayHost(item?.url || ''), 36);
          return [
            `${idx + 1}. ${title}`,
            host,
            snippet,
          ].filter(Boolean).join('｜');
        });
        const citations = results
          .slice(0, 3)
          .map((item) => ({
            source: String(item?.url || '').trim(),
            title: String(item?.title || '').trim(),
          }))
          .filter((item) => item.source);
        return {
          contextText: `联网搜索辅助结果（仅供核验）：\n${lines.join('\n')}`,
          citations,
        };
      } catch (_) {
        return {
          contextText: `联网搜索暂时不可用。需要时可提示用户改用手动搜索：${manualUrl}`,
          citations: [{ source: manualUrl, title: `搜索：${q}` }],
        };
      }
    }

    return {
      getProviders,
      getSelectedProviderId,
      setSelectedProviderId,
      search,
      fetchWebSearchContext,
    };
  }

  window.MorphWebSearchProviderRuntime = {
    create: createWebSearchProviderRuntime,
  };
})();
