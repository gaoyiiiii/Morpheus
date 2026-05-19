// @ts-check

(function initMorphAIActionTransactionRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIActionTransactionRuntime && typeof window.MorphAIActionTransactionRuntime.create === 'function') return;

  function createAIActionTransactionRuntime() {
    function captureActionTransactionDomainSnapshots(candidateDomains = [], options = {}) {
      const domains = Array.isArray(candidateDomains) ? candidateDomains : [];
      const captureDomain = typeof options.captureDomain === 'function' ? options.captureDomain : null;
      const clone = typeof options.clone === 'function' ? options.clone : ((value) => value);
      const dataRef = options.dataRef;
      const transactionBeforeDomains = options.transactionBeforeDomains && typeof options.transactionBeforeDomains === 'object'
        ? options.transactionBeforeDomains
        : {};
      const actionBeforeDomains = {};

      if (typeof captureDomain !== 'function') return { actionBeforeDomains, transactionBeforeDomains };

      domains.forEach((domain) => {
        if (!domain) return;
        const snapshot = captureDomain(domain, dataRef);
        actionBeforeDomains[domain] = snapshot;
        if (Object.prototype.hasOwnProperty.call(transactionBeforeDomains, domain)) return;
        transactionBeforeDomains[domain] = clone(snapshot);
      });

      return { actionBeforeDomains, transactionBeforeDomains };
    }

    return {
      captureActionTransactionDomainSnapshots,
    };
  }

  window.MorphAIActionTransactionRuntime = {
    create: createAIActionTransactionRuntime,
  };
})();
