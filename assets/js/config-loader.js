(function () {
  function normalizeStringArray(value) {
    return Array.isArray(value)
      ? value.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
  }

  function sanitizeTokenSynonyms(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.entries(raw).forEach(([key, value]) => {
      const token = String(key || '').trim();
      if (!token) return;
      const synonyms = normalizeStringArray(Array.isArray(value) ? value : [value]);
      if (!synonyms.length) return;
      out[token] = synonyms;
    });
    return out;
  }

  async function fetchText(url) {
    if (typeof fetch !== 'function') return null;
    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.text();
    } catch (_) {
      return null;
    }
  }

  async function fetchJSON(url) {
    const text = await fetchText(url);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function normalizeSkillCatalog(raw) {
    const skills = Array.isArray(raw?.skills)
      ? raw.skills
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: String(item.id || item.name || '').trim(),
            name: String(item.name || '').trim(),
            path: String(item.path || '').trim(),
            description: String(item.description || '').trim(),
            tags: normalizeStringArray(item.tags),
            triggers: normalizeStringArray(item.triggers),
            negativeTriggers: normalizeStringArray(item.negativeTriggers),
          }))
          .filter((item) => item.id && item.name && item.path && item.description)
      : [];
    return {
      version: Number.isFinite(Number(raw?.version)) ? Number(raw.version) : 1,
      updatedAt: String(raw?.updatedAt || '').trim(),
      skills,
    };
  }

  function normalizeRuntimeSkills(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const proactive = src.proactiveAgent && typeof src.proactiveAgent === 'object' ? src.proactiveAgent : {};
    return {
      version: Number.isFinite(Number(src.version)) ? Number(src.version) : 1,
      selfUpgradeEnabled: src.selfUpgradeEnabled !== false,
      extraSystemPrompt: typeof src.extraSystemPrompt === 'string' ? src.extraSystemPrompt : '',
      disabledActions: normalizeStringArray(src.disabledActions),
      proactiveAgent: {
        enabled: proactive.enabled !== false,
        heartbeatMinutes: Number.isFinite(Number(proactive.heartbeatMinutes)) ? Number(proactive.heartbeatMinutes) : 60,
        minNotifyGapMinutes: Number.isFinite(Number(proactive.minNotifyGapMinutes)) ? Number(proactive.minNotifyGapMinutes) : 18,
        maxFindingsPerScan: Number.isFinite(Number(proactive.maxFindingsPerScan)) ? Number(proactive.maxFindingsPerScan) : 3,
        soonReminderMinutes: Number.isFinite(Number(proactive.soonReminderMinutes)) ? Number(proactive.soonReminderMinutes) : 45,
        overdueReminderMinutes: Number.isFinite(Number(proactive.overdueReminderMinutes)) ? Number(proactive.overdueReminderMinutes) : 15,
        quietHoursStart: typeof proactive.quietHoursStart === 'string' ? proactive.quietHoursStart : '22:00',
        quietHoursEnd: typeof proactive.quietHoursEnd === 'string' ? proactive.quietHoursEnd : '07:00',
        runWhenHidden: !!proactive.runWhenHidden,
        autoPushToChat: proactive.autoPushToChat === true,
        autoWriteMemory: proactive.autoWriteMemory === true,
      },
      capabilities: normalizeStringArray(src.capabilities),
      writableScopes: normalizeStringArray(src.writableScopes),
      notes: normalizeStringArray(src.notes),
    };
  }

  function normalizeContextRules(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const asNumOrNull = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
    return {
      version: Number.isFinite(Number(src.version)) ? Number(src.version) : 1,
      maxCoreMemory: asNumOrNull(src.maxCoreMemory),
      maxWorkingContext: asNumOrNull(src.maxWorkingContext),
      maxRetrieved: asNumOrNull(src.maxRetrieved),
      maxCitations: asNumOrNull(src.maxCitations),
      currentTabBoost: asNumOrNull(src.currentTabBoost),
      activeContextBoost: asNumOrNull(src.activeContextBoost),
      selectedMonthBoost: asNumOrNull(src.selectedMonthBoost),
      clusterExpansionLimit: asNumOrNull(src.clusterExpansionLimit),
      tokenSynonyms: sanitizeTokenSynonyms(src.tokenSynonyms),
    };
  }

  function normalizeRuntimeActionPolicy(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const rawTiers = src.tiers && typeof src.tiers === 'object' ? src.tiers : {};
    const rawActions = src.actions && typeof src.actions === 'object' ? src.actions : {};
    const tiers = {};
    Object.entries(rawTiers).forEach(([key, value]) => {
      const tier = String(key || '').trim();
      const entry = value && typeof value === 'object' ? value : {};
      if (!tier) return;
      tiers[tier] = {
        summary: String(entry.summary || '').trim(),
        userFacingRule: String(entry.userFacingRule || '').trim(),
      };
    });
    const actions = {};
    Object.entries(rawActions).forEach(([key, value]) => {
      const action = String(key || '').trim();
      const entry = value && typeof value === 'object' ? value : {};
      if (!action) return;
      actions[action] = {
        domain: String(entry.domain || '').trim(),
        permissionLevel: String(entry.permissionLevel || '').trim(),
        consentTier: String(entry.consentTier || '').trim(),
        riskLevel: String(entry.riskLevel || '').trim(),
        notes: String(entry.notes || '').trim(),
      };
    });
    return {
      version: Number.isFinite(Number(src.version)) ? Number(src.version) : 1,
      tiers,
      actions,
    };
  }

  function normalizeRuntimeActionContract(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const rawAliases = src.aliases && typeof src.aliases === 'object' ? src.aliases : {};
    const aliases = {};
    Object.entries(rawAliases).forEach(([key, value]) => {
      const alias = String(key || '').trim();
      const canonical = String(value || '').trim();
      if (!alias || !canonical) return;
      aliases[alias] = canonical;
    });
    return {
      version: Number.isFinite(Number(src.version)) ? Number(src.version) : 1,
      aliases,
    };
  }

  function normalizeRuntimeActionRegistry(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const aliases = normalizeRuntimeActionContract({ aliases: src.aliases }).aliases;
    const tiers = normalizeRuntimeActionPolicy({ tiers: src.tiers }).tiers;
    const boundaryLevels = {};
    const rawBoundaryLevels = src.boundaryLevels && typeof src.boundaryLevels === 'object' ? src.boundaryLevels : {};
    Object.entries(rawBoundaryLevels).forEach(([key, value]) => {
      const level = String(key || '').trim();
      const entry = value && typeof value === 'object' ? value : {};
      if (!level) return;
      boundaryLevels[level] = {
        summary: String(entry.summary || '').trim(),
      };
    });
    const actions = {};
    const rawActions = src.actions && typeof src.actions === 'object' ? src.actions : {};
    Object.entries(rawActions).forEach(([key, value]) => {
      const action = String(key || '').trim();
      const entry = value && typeof value === 'object' ? value : {};
      if (!action) return;
      const policy = entry.policy && typeof entry.policy === 'object'
        ? normalizeRuntimeActionPolicy({ actions: { [action]: entry.policy } }).actions[action]
        : null;
      const boundary = entry.boundary && typeof entry.boundary === 'object'
        ? {
            level: String(entry.boundary.level || '').trim(),
            reason: String(entry.boundary.reason || '').trim(),
          }
        : null;
      const structured = entry.structured && typeof entry.structured === 'object'
        ? {
            requiredStringFields: normalizeStringArray(entry.structured.requiredStringFields),
            anyOfStringFields: Array.isArray(entry.structured.anyOfStringFields)
              ? entry.structured.anyOfStringFields
                  .filter((group) => Array.isArray(group))
                  .map((group) => normalizeStringArray(group))
                  .filter((group) => group.length)
              : [],
            anyOfStringMessage: String(entry.structured.anyOfStringMessage || '').trim(),
            dateFields: normalizeStringArray(entry.structured.dateFields),
            numericFields: normalizeStringArray(entry.structured.numericFields),
            requiredObjectFields: normalizeStringArray(entry.structured.requiredObjectFields),
            slotHydration: entry.structured.slotHydration && typeof entry.structured.slotHydration === 'object'
              ? { ...entry.structured.slotHydration }
              : null,
          }
        : null;
      const next = {
        canonicalAction: String(entry.canonicalAction || action).trim() || action,
        aliases: normalizeStringArray(entry.aliases),
        displayName: String(entry.displayName || '').trim(),
        confirmationRequired: entry.confirmationRequired === true,
      };
      if (policy) next.policy = policy;
      if (boundary && (boundary.level || boundary.reason)) next.boundary = boundary;
      if (structured) {
        const compactStructured = {};
        if (structured.requiredStringFields.length) compactStructured.requiredStringFields = structured.requiredStringFields;
        if (structured.anyOfStringFields.length) compactStructured.anyOfStringFields = structured.anyOfStringFields;
        if (structured.anyOfStringMessage) compactStructured.anyOfStringMessage = structured.anyOfStringMessage;
        if (structured.dateFields.length) compactStructured.dateFields = structured.dateFields;
        if (structured.numericFields.length) compactStructured.numericFields = structured.numericFields;
        if (structured.requiredObjectFields.length) compactStructured.requiredObjectFields = structured.requiredObjectFields;
        if (structured.slotHydration) compactStructured.slotHydration = structured.slotHydration;
        if (Object.keys(compactStructured).length) next.structured = compactStructured;
      }
      actions[action] = next;
    });
    return {
      version: Number.isFinite(Number(src.version)) ? Number(src.version) : 1,
      aliases,
      tiers,
      defaultBoundaryLevel: String(src.defaultBoundaryLevel || '').trim() || 'disabled',
      boundaryLevels,
      actions,
    };
  }

  function buildRuntimeActionAliasesFromRegistry(registry) {
    const src = registry && typeof registry === 'object' ? registry : {};
    const aliases = { ...(src.aliases && typeof src.aliases === 'object' ? src.aliases : {}) };
    Object.entries(src.actions && typeof src.actions === 'object' ? src.actions : {}).forEach(([actionType, value]) => {
      const entry = value && typeof value === 'object' ? value : {};
      const canonicalAction = String(entry.canonicalAction || actionType || '').trim();
      if (!canonicalAction) return;
      if (actionType !== canonicalAction) aliases[actionType] = canonicalAction;
      normalizeStringArray(entry.aliases).forEach((alias) => {
        aliases[alias] = canonicalAction;
      });
    });
    return aliases;
  }

  function buildRuntimeActionContractFromRegistry(registry) {
    const src = registry && typeof registry === 'object' ? registry : {};
    return {
      version: Number.isFinite(Number(src.version)) ? Number(src.version) : 1,
      aliases: buildRuntimeActionAliasesFromRegistry(src),
    };
  }

  function buildRuntimeActionPolicyFromRegistry(registry) {
    const src = registry && typeof registry === 'object' ? registry : {};
    const actions = {};
    const entries = src.actions && typeof src.actions === 'object' ? src.actions : {};
    Object.entries(entries).forEach(([actionType, value]) => {
      const entry = value && typeof value === 'object' ? value : {};
      if (entry.policy && typeof entry.policy === 'object') {
        actions[actionType] = {
          domain: String(entry.policy.domain || '').trim(),
          permissionLevel: String(entry.policy.permissionLevel || '').trim(),
          consentTier: String(entry.policy.consentTier || '').trim(),
          riskLevel: String(entry.policy.riskLevel || '').trim(),
          notes: String(entry.policy.notes || '').trim(),
        };
      }
      if (!entry.policy || typeof entry.policy !== 'object') return;
      normalizeStringArray(entry.aliases).forEach((alias) => {
        if (actions[alias]) return;
        actions[alias] = { ...actions[actionType] };
      });
    });
    return {
      version: Number.isFinite(Number(src.version)) ? Number(src.version) : 1,
      tiers: src.tiers && typeof src.tiers === 'object' ? normalizeRuntimeActionPolicy({ tiers: src.tiers }).tiers : {},
      actions,
    };
  }

  async function loadSkillCatalogFromUrl(url) {
    const raw = await fetchJSON(url);
    return raw ? normalizeSkillCatalog(raw) : null;
  }

  async function loadRuntimeBundleFromUrls(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const [skillsRaw, contextRaw, memoryText, actionRegistryRaw, actionPolicyRaw, actionContractRaw] = await Promise.all([
      fetchJSON(opts.skillsUrl || 'morph-runtime/skills.json'),
      fetchJSON(opts.contextRulesUrl || 'morph-runtime/context-rules.json'),
      fetchText(opts.memoryRulesUrl || 'morph-runtime/memory-rules.md'),
      fetchJSON(opts.actionRegistryUrl || 'morph-runtime/action-registry.json'),
      fetchJSON(opts.actionPolicyUrl || 'morph-runtime/action-policy.json'),
      fetchJSON(opts.actionContractUrl || 'morph-runtime/action-contract.json'),
    ]);
    const actionRegistry = normalizeRuntimeActionRegistry(actionRegistryRaw);
    const derivedActionPolicy = buildRuntimeActionPolicyFromRegistry(actionRegistry);
    const derivedActionContract = buildRuntimeActionContractFromRegistry(actionRegistry);
    const hasRegistryActions = Object.keys(actionRegistry.actions || {}).length > 0;
    return {
      skills: normalizeRuntimeSkills(skillsRaw),
      contextRules: normalizeContextRules(contextRaw),
      memoryRules: typeof memoryText === 'string' ? memoryText.trim() : '',
      actionRegistry,
      actionPolicy: hasRegistryActions ? derivedActionPolicy : normalizeRuntimeActionPolicy(actionPolicyRaw),
      actionContract: hasRegistryActions ? derivedActionContract : normalizeRuntimeActionContract(actionContractRaw),
    };
  }

  window.MorphConfigLoader = {
    fetchJSON,
    fetchText,
    normalizeSkillCatalog,
    normalizeRuntimeSkills,
    normalizeContextRules,
    normalizeRuntimeActionPolicy,
    normalizeRuntimeActionContract,
    normalizeRuntimeActionRegistry,
    buildRuntimeActionPolicyFromRegistry,
    buildRuntimeActionContractFromRegistry,
    loadSkillCatalogFromUrl,
    loadRuntimeBundleFromUrls,
  };
})();
