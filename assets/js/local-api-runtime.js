// @ts-check

(function initMorphLocalApiRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphLocalApiRuntime && typeof window.MorphLocalApiRuntime.create === 'function') return;

  function createLocalApiRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const getWindowRef = typeof api.getWindowRef === 'function'
      ? api.getWindowRef
      : () => (typeof window !== 'undefined' ? window : null);
    const fetchImpl = typeof api.fetchImpl === 'function'
      ? api.fetchImpl
      : (...args) => fetch(...args);

    function buildLocalApiCandidates(apiPath = '') {
      const cleanPath = String(apiPath || '').startsWith('/') ? String(apiPath || '') : `/${String(apiPath || '')}`;
      const list = [cleanPath];
      try {
        const win = getWindowRef();
        const origin = String(win?.location?.origin || '');
        if (origin && origin !== 'null') list.push(`${origin}${cleanPath}`);
      } catch (_) {}
      list.push(`http://127.0.0.1:2199${cleanPath}`);
      list.push(`http://localhost:2199${cleanPath}`);
      return Array.from(new Set(list));
    }

    async function fetchLocalApiWithFallback(apiPath, fetchOptions = {}) {
      const candidates = buildLocalApiCandidates(apiPath);
      let lastError = null;
      let lastResponse = null;
      for (const url of candidates) {
        try {
          const res = await fetchImpl(url, fetchOptions);
          if (res && res.ok) return res;
          lastResponse = res || null;
        } catch (error) {
          lastError = error;
        }
      }
      if (lastResponse) return lastResponse;
      if (lastError) throw lastError;
      throw new Error('local_api_unreachable');
    }

    return {
      buildLocalApiCandidates,
      fetchLocalApiWithFallback,
    };
  }

  window.MorphLocalApiRuntime = {
    create: createLocalApiRuntime,
  };
})();
