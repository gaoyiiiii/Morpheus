(function initMorphDecisionTraceRuntime() {
  function createDecisionTraceRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const sanitizeTextList = typeof api.sanitizeSelfMemoryTextList === 'function'
      ? api.sanitizeSelfMemoryTextList
      : (value, fallback = []) => {
          if (!Array.isArray(value)) return Array.isArray(fallback) ? fallback : [];
          return value.map((item) => String(item || '').trim()).filter(Boolean);
        };

    function sanitizeMorphInternalDecisionTraceEntry(raw) {
      const src = raw && typeof raw === 'object' ? raw : {};
      const pick = (value, allowed, fallback) => allowed.includes(String(value || '').trim()) ? String(value || '').trim() : fallback;
      return {
        id: String(src.id || '').trim(),
        kind: pick(src.kind, ['interaction', 'proactive'], 'interaction'),
        source: String(src.source || '').trim().slice(0, 48),
        summary: String(src.summary || '').trim().slice(0, 220),
        responseMode: String(src.responseMode || '').trim().slice(0, 40),
        workflowType: String(src.workflowType || '').trim().slice(0, 64),
        workflowStep: String(src.workflowStep || '').trim().slice(0, 64),
        memoryWriteMode: pick(src.memoryWriteMode, ['observe', 'commit', ''], ''),
        proactiveSurfaceDecision: pick(src.proactiveSurfaceDecision, ['surface', 'queue', 'skip', ''], ''),
        proactivePersistenceDecision: pick(src.proactivePersistenceDecision, ['persist', 'skip', ''], ''),
        dominantMode: pick(src.dominantMode, ['oracle', 'architect', 'balanced', ''], ''),
        actionBias: pick(src.actionBias, ['hold-space', 'clarify-and-frame', 'guide-then-structure', 'structure-and-advance', 'structure-and-commit', ''], ''),
        findingKeys: sanitizeTextList(src.findingKeys, []).slice(0, 6),
        notes: sanitizeTextList(src.notes, []).slice(0, 6),
        createdAt: String(src.createdAt || '').trim(),
        updatedAt: String(src.updatedAt || '').trim(),
      };
    }

    function sanitizeMorphInternalDecisionTrace(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map((item) => sanitizeMorphInternalDecisionTraceEntry(item))
        .filter((item) => item.summary || item.kind === 'proactive')
        .slice(-24);
    }

    function recordMorphInternalDecisionTrace(entry = null) {
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return false;
      if (!aiMemory.workingMemory || typeof aiMemory.workingMemory !== 'object') aiMemory.workingMemory = {};
      const next = sanitizeMorphInternalDecisionTraceEntry({
        ...entry,
        id: entry?.id || (typeof api.genId === 'function' ? api.genId() : `trace_${Date.now()}`),
        createdAt: entry?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (!next.summary && next.kind !== 'proactive') return false;
      const existing = sanitizeMorphInternalDecisionTrace(aiMemory.workingMemory.internalDecisionTrace);
      existing.push(next);
      aiMemory.workingMemory.internalDecisionTrace = sanitizeMorphInternalDecisionTrace(existing);
      return true;
    }

    function getMorphInternalDecisionTrace(limit = 12) {
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      const workingMemory = typeof api.getMorphWorkingMemory === 'function'
        ? api.getMorphWorkingMemory(aiMemory)
        : (aiMemory?.workingMemory || {});
      const trace = sanitizeMorphInternalDecisionTrace(workingMemory.internalDecisionTrace);
      const maxCount = Math.max(1, Number(limit) || 12);
      return trace.slice(-maxCount);
    }

    return {
      sanitizeMorphInternalDecisionTraceEntry,
      sanitizeMorphInternalDecisionTrace,
      recordMorphInternalDecisionTrace,
      getMorphInternalDecisionTrace,
    };
  }

  window.MorphDecisionTraceRuntime = { create: createDecisionTraceRuntime };
})();
