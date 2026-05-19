// @ts-check

(function initMorphAIActionDevRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionDevRuntime && typeof window.MorphAIActionDevRuntime.create === 'function') return;

  function createAIActionDevRuntime() {
    function buildActionDebugMessage(status = '', type = '', reason = '', details = {}) {
      const parts = [];
      const normalizedStatus = String(status || '').trim() || 'action';
      const normalizedType = String(type || '').trim() || 'unknown';
      parts.push(`${normalizedStatus}:${normalizedType}`);
      const normalizedReason = String(reason || '').trim();
      if (normalizedReason) parts.push(normalizedReason);
      const entity = String(details?.entity || '').trim();
      if (entity) parts.push(`entity=${entity}`);
      const targetDate = String(details?.targetDate || '').trim();
      if (targetDate) parts.push(`date=${targetDate}`);
      const requestId = String(details?.requestId || '').trim();
      if (requestId) parts.push(`requestId=${requestId}`);
      return parts.join(' | ');
    }

    function buildActionFailure(status = '', type = '', reasonCode = '', fallbackUserMessage = '', details = {}, options = {}) {
      const debugMessage = buildActionDebugMessage(status, type, reasonCode, details);
      const exposeRawActionFailures = options?.exposeRawActionFailures === true;
      return {
        reasonCode: String(reasonCode || '').trim(),
        debugMessage,
        userMessage: exposeRawActionFailures
          ? debugMessage
          : String(fallbackUserMessage || '').trim(),
      };
    }

    return {
      buildActionDebugMessage,
      buildActionFailure,
    };
  }

  window.MorphAIActionDevRuntime = {
    create: createAIActionDevRuntime,
  };
})();
