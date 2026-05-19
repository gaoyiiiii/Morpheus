const {
  ACTION_REGISTRY,
  buildMorphActionIdentity,
  getCanonicalMorphActionName,
  getMorphActionAliases,
  sanitizeMorphActionName,
} = require('./morph-action-contract');

function createMorphActionRegistry(deps) {
  const {
    toSafeText,
    toSafeArray,
    toSafeObject,
    normalizeEntityType,
    normalizeMorphStatus,
    createMorphId,
    ensureArrayField,
    ensureObjectField,
  } = deps;

  const SHARED_ACTION_REGISTRY = ACTION_REGISTRY && typeof ACTION_REGISTRY === 'object' ? ACTION_REGISTRY : {};
  const ACTION_POLICY_TAXONOMY = SHARED_ACTION_REGISTRY.tiers && typeof SHARED_ACTION_REGISTRY.tiers === 'object'
    ? SHARED_ACTION_REGISTRY.tiers
    : {};
  const SHARED_ACTION_OWNERSHIP = SHARED_ACTION_REGISTRY.ownership && typeof SHARED_ACTION_REGISTRY.ownership === 'object'
    ? SHARED_ACTION_REGISTRY.ownership
    : {};
  const SHARED_ACTION_SPECS = SHARED_ACTION_REGISTRY.actions && typeof SHARED_ACTION_REGISTRY.actions === 'object'
    ? SHARED_ACTION_REGISTRY.actions
    : {};
  const ACTION_BOUNDARY_LEVELS = SHARED_ACTION_REGISTRY.boundaryLevels && typeof SHARED_ACTION_REGISTRY.boundaryLevels === 'object'
    ? SHARED_ACTION_REGISTRY.boundaryLevels
    : {};
  const DEFAULT_BOUNDARY_LEVEL = toSafeText(SHARED_ACTION_REGISTRY.defaultBoundaryLevel, 40) || 'disabled';
  const getSharedActionEntry = (actionName) => {
    const requested = sanitizeMorphActionName(actionName);
    const canonical = getCanonicalMorphActionName(requested);
    const direct = requested && SHARED_ACTION_SPECS[requested] && typeof SHARED_ACTION_SPECS[requested] === 'object'
      ? SHARED_ACTION_SPECS[requested]
      : null;
    if (direct) return direct;
    const canonicalEntry = canonical && SHARED_ACTION_SPECS[canonical] && typeof SHARED_ACTION_SPECS[canonical] === 'object'
      ? SHARED_ACTION_SPECS[canonical]
      : null;
    return canonicalEntry;
  };
  const getSharedActionSpec = (actionName) => {
    const entry = getSharedActionEntry(actionName);
    const policy = entry && entry.policy && typeof entry.policy === 'object' ? entry.policy : null;
    if (!policy) return {};
    return {
      permission: toSafeText(policy.permissionLevel, 20),
      domain: toSafeText(policy.domain, 80),
      risk: toSafeText(policy.riskLevel, 20),
      consentTier: toSafeText(policy.consentTier, 80),
      notes: toSafeText(policy.notes, 240),
    };
  };
  const getSharedActionBoundarySpec = (actionName) => {
    const entry = getSharedActionEntry(actionName);
    // Runtime boundary truth lives in action-registry.json. action-boundaries.json stays a
    // human-readable / migration manifest and must not override host execution behavior.
    const boundary = entry && entry.boundary && typeof entry.boundary === 'object' ? entry.boundary : null;
    const level = boundary ? toSafeText(boundary.level, 40) : DEFAULT_BOUNDARY_LEVEL;
    return {
      level: level || DEFAULT_BOUNDARY_LEVEL,
      reason: toSafeText(boundary?.reason, 240),
      summary: toSafeText(ACTION_BOUNDARY_LEVELS[level]?.summary, 240),
    };
  };
  const getSharedConfirmationSpec = (actionName) => {
    const entry = getSharedActionEntry(actionName);
    if (!entry) return {};
    return {
      confirmationRequired: entry.confirmationRequired === true,
      displayName: toSafeText(entry.displayName, 120),
    };
  };

  const PERMISSION_ORDER = {
    read: 1,
    append: 2,
    update: 3,
    archive: 4,
    admin: 5,
  };

  function createMorphApiError(statusCode, code, message, extra = {}) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    Object.assign(error, extra);
    return error;
  }

  function createInvalidPayloadError(message, extra = {}) {
    return createMorphApiError(400, 'invalid_payload', message, extra);
  }

  function createEntityNotFoundError(entityType, entityId, extra = {}) {
    return createMorphApiError(404, 'entity_not_found', `${entityType} not found`, {
      entityType: toSafeText(entityType, 80),
      entityId: toSafeText(entityId, 120),
      ...extra,
    });
  }

  function normalizePermissionLevel(raw) {
    const value = String(raw || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PERMISSION_ORDER, value) ? value : '';
  }

  function normalizePermissionList(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => normalizePermissionLevel(item))
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index);
  }

  function normalizeConfirmation(body) {
    const raw = body?.confirmation && typeof body.confirmation === 'object' ? body.confirmation : {};
    const targetIds = Array.isArray(raw.targetIds)
      ? raw.targetIds.map((item) => toSafeText(item, 120)).filter(Boolean).slice(0, 50)
      : [];
    return {
      confirmed: raw.confirmed === true,
      reason: toSafeText(raw.reason, 240),
      scope: toSafeText(raw.scope, 120),
      targetIds,
    };
  }

  function resolveActionSpec(actionName) {
    const identity = buildMorphActionIdentity(actionName);
    const key = identity.requestedAction;
    const canonicalAction = identity.canonicalAction;
    if (!key || !canonicalAction) return null;
    const sharedSpec = getSharedActionSpec(canonicalAction);
    const boundary = getSharedActionBoundarySpec(canonicalAction);
    const confirmationSpec = getSharedConfirmationSpec(key) || getSharedConfirmationSpec(canonicalAction);
    const handlerAvailable = typeof actionHandlers[key] === 'function' || typeof actionHandlers[canonicalAction] === 'function';
    if (getSharedActionEntry(key) || getSharedActionEntry(canonicalAction)) {
      const consentTier = Object.prototype.hasOwnProperty.call(ACTION_POLICY_TAXONOMY, sharedSpec.consentTier)
        ? sharedSpec.consentTier
        : (sharedSpec.consentTier || 'architect-required');
      const boundaryLevel = toSafeText(boundary.level, 40) || DEFAULT_BOUNDARY_LEVEL;
      const enabled = boundaryLevel === 'allowed' && handlerAvailable;
      const reason = boundaryLevel !== 'allowed'
        ? (boundary.reason || boundary.summary || 'action is not exposed to external agents')
        : !handlerAvailable
          ? 'action is allowed by boundary policy but not yet implemented in the external connector'
          : '';
      return {
        action: canonicalAction,
        requestedAction: key,
        canonicalAction,
        aliases: getMorphActionAliases(canonicalAction),
        isAlias: identity.isAlias,
        permission: sharedSpec.permission || 'admin',
        domain: sharedSpec.domain,
        risk: sharedSpec.risk || 'low',
        consentTier,
        confirmationRequired: confirmationSpec.confirmationRequired === true,
        enabled,
        reason,
        notes: toSafeText(sharedSpec.notes, 240),
        boundaryLevel,
        boundaryReason: boundary.reason,
        boundarySummary: boundary.summary,
        handlerAvailable,
      };
    }
    if (sharedSpec.permission) {
      return {
        action: canonicalAction,
        requestedAction: key,
        canonicalAction,
        aliases: getMorphActionAliases(canonicalAction),
        isAlias: identity.isAlias,
        permission: sharedSpec.permission || 'admin',
        domain: sharedSpec.domain,
        risk: sharedSpec.risk || 'high',
        consentTier: sharedSpec.consentTier || 'disabled',
        confirmationRequired: confirmationSpec.confirmationRequired === true,
        enabled: false,
        reason: boundary.reason || boundary.summary || 'action is not exposed to external agents',
        notes: toSafeText(sharedSpec.notes, 240),
        boundaryLevel: toSafeText(boundary.level, 40) || DEFAULT_BOUNDARY_LEVEL,
        boundaryReason: boundary.reason,
        boundarySummary: boundary.summary,
        handlerAvailable,
      };
    }
    return null;
  }

  function listActionPolicyTiers() {
    return Object.keys(ACTION_POLICY_TAXONOMY).map((key) => ({
      consentTier: key,
      summary: toSafeText(ACTION_POLICY_TAXONOMY[key]?.summary, 240),
      userFacingRule: toSafeText(ACTION_POLICY_TAXONOMY[key]?.userFacingRule, 160),
    }));
  }

  function getSourceOfTruth() {
    return {
      actionIdentity: toSafeText(SHARED_ACTION_OWNERSHIP.actionIdentity, 160) || 'morph-runtime/action-registry.json',
      actionPolicy: toSafeText(SHARED_ACTION_OWNERSHIP.actionPolicy, 160) || 'morph-runtime/action-registry.json',
      boundarySource: toSafeText(SHARED_ACTION_OWNERSHIP.boundarySource, 240) || 'morph-runtime/action-registry.json#actions[*].boundary',
      derivedBoundaryManifest: toSafeText(SHARED_ACTION_OWNERSHIP.derivedBoundaryManifest, 160) || 'morph-runtime/action-boundaries.json',
      connectorRole: toSafeText(SHARED_ACTION_OWNERSHIP.connectorRole, 80) || 'adapter-only',
    };
  }

  function buildActionPolicy(actionSpec, confirmation) {
    const consentTier = toSafeText(actionSpec?.consentTier, 80) || 'architect-required';
    const tierSpec = ACTION_POLICY_TAXONOMY[consentTier] || ACTION_POLICY_TAXONOMY['architect-required'];
    return {
      risk: toSafeText(actionSpec?.risk || 'low', 20) || 'low',
      highRisk: String(actionSpec?.risk || '').trim() === 'high',
      consentTier,
      tierSummary: toSafeText(tierSpec.summary, 240),
      requiresExplicitConsent: consentTier === 'explicit-consent-required',
      disabledByDefault: consentTier === 'disabled',
      enabled: actionSpec?.enabled !== false,
      confirmationRequired: actionSpec?.confirmationRequired === true,
      confirmationReceived: confirmation?.confirmed === true,
      reason: toSafeText(actionSpec?.reason, 240),
      notes: toSafeText(actionSpec?.notes, 240),
    };
  }

  function resolveAuthorization(body, actionSpec, confirmation) {
    const explicitPermissions = normalizePermissionList(body?.permissions);
    const scopedPermissions = normalizePermissionList(body?.authorization?.permissions);
    const grantedPermissions = explicitPermissions.length ? explicitPermissions : scopedPermissions;
    const requiredPermission = normalizePermissionLevel(actionSpec?.permission) || 'admin';
    const mode = grantedPermissions.length ? 'explicit' : 'legacy-implicit';
    const effectivePermissions = grantedPermissions.length ? grantedPermissions : ['admin'];
    const maxGrantedWeight = effectivePermissions.reduce((max, item) => {
      return Math.max(max, PERMISSION_ORDER[item] || 0);
    }, 0);
    const requiredWeight = PERMISSION_ORDER[requiredPermission] || PERMISSION_ORDER.admin;
    const allowed = maxGrantedWeight >= requiredWeight;
    return {
      mode,
      explicit: grantedPermissions.length > 0,
      requiredPermission,
      grantedPermissions: effectivePermissions,
      actionDomain: toSafeText(actionSpec?.domain, 80),
      policy: buildActionPolicy(actionSpec, confirmation),
      allowed,
    };
  }

  function resolveDailyMonth(data, month) {
    const dailyMonths = ensureObjectField(data, 'dailyMonths', {});
    if (Array.isArray(dailyMonths[month])) return null;
    if (!dailyMonths[month] || typeof dailyMonths[month] !== 'object') {
      dailyMonths[month] = { month, days: {} };
    }
    if (!dailyMonths[month].days || typeof dailyMonths[month].days !== 'object') {
      dailyMonths[month].days = {};
    }
    return dailyMonths[month];
  }

  function ensureExpenseLedgerShape(data) {
    const ledger = ensureObjectField(data, 'expenseLedger', { categories: [], records: [] });
    if (!Array.isArray(ledger.categories)) ledger.categories = [];
    if (!Array.isArray(ledger.records)) ledger.records = [];
    return ledger;
  }

  function inferExpenseCategoryFromText(text = '') {
    const q = String(text || '').toLowerCase();
    if (!q) return '日用百货';
    if (/(医院|看病|挂号|体检|药|药店|诊所|保健|牙医|复诊)/i.test(q)) return '医疗保健';
    if (/(地铁|公交|打车|高铁|火车|机票|加油|停车|过路费|滴滴|出行|洗车|修车|保养)/i.test(q)) return '交通出行';
    if (/(咖啡|奶茶|午餐|晚餐|早餐|夜宵|外卖|吃饭|餐|饮料)/i.test(q)) return '餐饮';
    if (/(房租|租金)/i.test(q)) return '房租';
    if (/(房贷|月供|按揭)/i.test(q)) return '房贷';
    if (/(车贷)/i.test(q)) return '车贷';
    if (/(物业|物业费)/i.test(q)) return '物业';
    if (/(水费|电费|燃气|煤气|宽带|话费)/i.test(q)) return '水电气';
    return '日用百货';
  }

  function resolveDailyEntry(data, date) {
    const dayText = toSafeText(date, 20);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayText)) return null;
    const monthKey = dayText.slice(0, 7);
    const month = resolveDailyMonth(data, monthKey);
    if (!month.days[dayText] || typeof month.days[dayText] !== 'object') {
      month.days[dayText] = { date: dayText, blocks: [] };
    }
    if (!Array.isArray(month.days[dayText].blocks)) month.days[dayText].blocks = [];
    return month.days[dayText];
  }

  function shouldUseStructuredDailyStorage(data, date) {
    const dayText = toSafeText(date, 20);
    const monthKey = /^\d{4}-\d{2}-\d{2}$/.test(dayText) ? dayText.slice(0, 7) : '';
    const dailyMonths = ensureObjectField(data, 'dailyMonths', {});
    const targetMonth = monthKey ? dailyMonths[monthKey] : null;
    if (targetMonth && typeof targetMonth === 'object' && !Array.isArray(targetMonth)) return true;
    if (Array.isArray(targetMonth)) return false;
    const monthEntries = Object.values(dailyMonths).filter((item) => item && typeof item === 'object');
    if (!monthEntries.length) return false;
    const structuredCount = monthEntries.filter((item) => !Array.isArray(item)).length;
    const legacyCount = monthEntries.filter((item) => Array.isArray(item)).length;
    return structuredCount > 0 && legacyCount === 0;
  }

  function resolveLegacyDailyMonthBlocks(data, monthKey) {
    const dailyMonths = ensureObjectField(data, 'dailyMonths', {});
    const current = dailyMonths[monthKey];
    if (current && typeof current === 'object' && !Array.isArray(current)) return null;
    if (!Array.isArray(current)) dailyMonths[monthKey] = [];
    return dailyMonths[monthKey];
  }

  function extractLegacyDailyDateFromHeader(value) {
    const match = String(value || '').trim().match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  function findLegacyDailySection(blocks, date) {
    const list = toSafeArray(blocks);
    const dayText = toSafeText(date, 20);
    let headerIndex = -1;
    let nextHeaderIndex = list.length;
    for (let index = 0; index < list.length; index += 1) {
      const block = list[index];
      if (toSafeText(block?.type, 20) !== 'h3') continue;
      const blockDate = extractLegacyDailyDateFromHeader(block?.content || block?.text || '');
      if (blockDate === dayText) {
        headerIndex = index;
        for (let cursor = index + 1; cursor < list.length; cursor += 1) {
          if (toSafeText(list[cursor]?.type, 20) === 'h3') {
            nextHeaderIndex = cursor;
            break;
          }
        }
        break;
      }
    }
    return { headerIndex, nextHeaderIndex };
  }

  function ensureLegacyDailySection(blocks, date) {
    const list = toSafeArray(blocks);
    let section = findLegacyDailySection(list, date);
    if (section.headerIndex >= 0) return section;
    list.unshift({
      id: createMorphId('daily-header'),
      type: 'h3',
      content: `[ 日志 ] ${toSafeText(date, 20)}`,
      checked: false,
    });
    section = findLegacyDailySection(list, date);
    return section;
  }

  function getLegacyDailyInsertIndex(blocks, section) {
    const list = toSafeArray(blocks);
    let insertIndex = Number.isFinite(section?.nextHeaderIndex) ? section.nextHeaderIndex : list.length;
    while (insertIndex > (Number(section?.headerIndex) + 1)) {
      const previous = list[insertIndex - 1];
      if (toSafeText(previous?.type, 20) === 'h3') break;
      const previousText = toSafeText(previous?.content || previous?.text, 4000);
      if (previousText) break;
      insertIndex -= 1;
    }
    return Math.max(Number(section?.headerIndex) + 1, insertIndex);
  }

  function buildLegacyDailyEntrySnapshot(blocks, date) {
    const list = toSafeArray(blocks);
    const section = findLegacyDailySection(list, date);
    if (section.headerIndex < 0) return { date: toSafeText(date, 20), blocks: [] };
    const entryBlocks = list
      .slice(section.headerIndex + 1, section.nextHeaderIndex)
      .filter((item) => item && typeof item === 'object' && toSafeText(item.type, 20) !== 'h3')
      .map((item, index) => ({
        id: toSafeText(item.id, 120) || createMorphId('daily-block'),
        type: toSafeText(item.type, 60) || 'p',
        text: toSafeText(item.content || item.text, 4000),
        checked: item.checked === true,
        order: index,
        metadata: toSafeObject(item.metadata),
        createdAt: toSafeText(item.createdAt, 80),
        updatedAt: toSafeText(item.updatedAt, 80),
      }))
      .filter((item) => item.text || item.type === 'todo');
    return {
      date: toSafeText(date, 20),
      blocks: entryBlocks,
    };
  }

  function findLegacyDailyBlockIndex(blocks, date, payload = {}) {
    const list = toSafeArray(blocks);
    const section = findLegacyDailySection(list, date);
    if (section.headerIndex < 0) return -1;
    const blockId = toSafeText(payload.blockId || payload.id, 120);
    if (blockId) {
      for (let index = section.headerIndex + 1; index < section.nextHeaderIndex; index += 1) {
        if (toSafeText(list[index]?.id, 120) === blockId) return index;
      }
    }
    const targetText = toSafeText(payload.text, 4000);
    if (targetText) {
      for (let index = section.headerIndex + 1; index < section.nextHeaderIndex; index += 1) {
        if (toSafeText(list[index]?.content || list[index]?.text, 4000) === targetText) return index;
      }
    }
    return -1;
  }

  function resolveMutableEntityRef(data, type, id) {
    const needle = String(id || '').trim();
    if (!needle) return null;
    const searchArrayRef = (field) => {
      const list = toSafeArray(data[field]);
      const index = list.findIndex((item) => String(item?.id || '').trim() === needle);
      if (index < 0) return null;
      return {
        field,
        index,
        entity: list[index],
        save(nextEntity) {
          data[field][index] = nextEntity;
        },
        remove() {
          return data[field].splice(index, 1)[0];
        },
      };
    };
    if (type === 'flashThought') return searchArrayRef('flashThoughts') || searchArrayRef('completedFlashThoughts');
    if (type === 'fixedThought') return searchArrayRef('fixed') || searchArrayRef('completedFixedThoughts');
    if (type === 'project') return searchArrayRef('projects');
    if (type === 'routine') return searchArrayRef('routines');
    if (type === 'sop') return searchArrayRef('sops');
    if (type === 'reminder') return searchArrayRef('reminders');
    if (type === 'daily') {
      const dayText = toSafeText(needle, 20);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayText)) return null;
      const monthKey = dayText.slice(0, 7);
      const monthCandidate = toSafeObject(data.dailyMonths)[monthKey];
      if (Array.isArray(monthCandidate)) return null;
      const month = toSafeObject(monthCandidate);
      const days = toSafeObject(month.days);
      if (!days[dayText] || typeof days[dayText] !== 'object') return null;
      return {
        field: `dailyMonths.${monthKey}.days`,
        index: dayText,
        entity: days[dayText],
        save(nextEntity) {
          data.dailyMonths[monthKey].days[dayText] = nextEntity;
        },
        remove() {
          const prev = data.dailyMonths[monthKey].days[dayText];
          delete data.dailyMonths[monthKey].days[dayText];
          return prev;
        },
      };
    }
    return null;
  }

  function upsertEntityLink(target, link) {
    if (!target || typeof target !== 'object') return;
    const links = ensureArrayField(target, 'links');
    const next = {
      type: toSafeText(link?.type, 40),
      targetId: toSafeText(link?.targetId, 120),
      label: toSafeText(link?.label, 120),
    };
    if (!next.type || !next.targetId) return;
    const exists = links.some((item) => String(item?.type || '') === next.type && String(item?.targetId || '') === next.targetId);
    if (!exists) links.push(next);
  }

  function findItemIndexById(list, id) {
    const needle = toSafeText(id, 120);
    if (!needle) return -1;
    return toSafeArray(list).findIndex((item) => String(item?.id || '').trim() === needle);
  }

  function normalizeMemoryTargetFile(value = '') {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    if (/(^|\/)user\.?md$/.test(raw)) return 'user.md';
    if (/(^|\/)identity\.?md$/.test(raw)) return 'identity.md';
    if (/(^|\/)memory-system\.?md$/.test(raw)) return 'memory-system.md';
    if (/(^|\/)memory\.?md$/.test(raw)) return 'memory.md';
    if (/(^|\/)soul\.?md$/.test(raw)) return 'soul.md';
    return '';
  }

  function buildDefaultAISoulUserMaterialMarkdown() {
    return [
      '## 用户写入的 soul 素材',
      '',
      '（这里保留用户明确写给 Morpheus 的背景、语气、设定、叙事或补充说明。）',
      '',
    ].join('\n');
  }

  function buildDefaultAIIdentityMarkdown() {
    return [
      '# identity.md',
      '',
      '这里记录 Morpheus 当前的自我结构，而不是叙事性传记。',
      '',
    ].join('\n');
  }

  function buildDefaultAIUserMarkdown() {
    return [
      '# user.md',
      '',
      '这里记录用户的长期偏好、目标、处境与持续主题。',
      '',
      '## 名字与称呼',
      '',
      '（如果用户明确说了自己的名字、昵称或希望被怎样称呼，要稳定写在这里。）',
      '',
    ].join('\n');
  }

  function buildDefaultAIMemoryIndexMarkdown() {
    return [
      '# memory.md',
      '',
      '这里记录 Morpheus 当前长期记忆的索引层。',
      '',
    ].join('\n');
  }

  function buildDefaultAIMemorySystemMarkdown() {
    return [
      '# memory-system.md',
      '',
      '这里记录 Morpheus 的记忆层说明与运行规则。',
      '',
    ].join('\n');
  }

  function ensureServerAIMemoryShape(data) {
    const aiMemory = ensureObjectField(data, 'aiMemory', {});
    aiMemory.longTermMemory = aiMemory.longTermMemory && typeof aiMemory.longTermMemory === 'object'
      ? aiMemory.longTermMemory
      : {};
    aiMemory.workingMemory = aiMemory.workingMemory && typeof aiMemory.workingMemory === 'object'
      ? aiMemory.workingMemory
      : {};
    if (typeof aiMemory.soulUserNotes !== 'string' || !aiMemory.soulUserNotes.trim()) {
      aiMemory.soulUserNotes = typeof aiMemory.soul === 'string' && aiMemory.soul.trim()
        ? aiMemory.soul
        : buildDefaultAISoulUserMaterialMarkdown();
    }
    if (typeof aiMemory.identityNotes !== 'string' || !aiMemory.identityNotes.trim()) {
      aiMemory.identityNotes = typeof aiMemory.longTermMemory.identityNotes === 'string' && aiMemory.longTermMemory.identityNotes.trim()
        ? aiMemory.longTermMemory.identityNotes
        : buildDefaultAIIdentityMarkdown();
    }
    if (typeof aiMemory.user !== 'string' || !aiMemory.user.trim()) {
      aiMemory.user = typeof aiMemory.longTermMemory.user === 'string' && aiMemory.longTermMemory.user.trim()
        ? aiMemory.longTermMemory.user
        : buildDefaultAIUserMarkdown();
    }
    if (typeof aiMemory.memoryIndex !== 'string' || !aiMemory.memoryIndex.trim()) {
      aiMemory.memoryIndex = typeof aiMemory.longTermMemory.memoryIndex === 'string' && aiMemory.longTermMemory.memoryIndex.trim()
        ? aiMemory.longTermMemory.memoryIndex
        : buildDefaultAIMemoryIndexMarkdown();
    }
    if (typeof aiMemory.systemNotes !== 'string' || !aiMemory.systemNotes.trim()) {
      aiMemory.systemNotes = typeof aiMemory.longTermMemory.systemNotes === 'string' && aiMemory.longTermMemory.systemNotes.trim()
        ? aiMemory.longTermMemory.systemNotes
        : buildDefaultAIMemorySystemMarkdown();
    }
    if (!Array.isArray(aiMemory.longTermMemory.explicitMemoryLog)) {
      aiMemory.longTermMemory.explicitMemoryLog = Array.isArray(aiMemory.explicitMemoryLog)
        ? aiMemory.explicitMemoryLog.slice(0, 50)
        : [];
    }
    aiMemory.explicitMemoryLog = aiMemory.longTermMemory.explicitMemoryLog.slice(0, 50);
    return aiMemory;
  }

  function tokenizeMemoryEntry(text = '') {
    return Array.from(new Set(
      String(text || '')
        .toLowerCase()
        .match(/[\p{Script=Han}]{1,}|[a-z0-9_]+/gu)
        ?.map((item) => item.trim())
        .filter((item) => item.length >= 2) || []
    ));
  }

  function shouldReplaceExistingMemoryEntry(existingLine = '', nextContent = '') {
    const existing = String(existingLine || '').replace(/^-+\s*/, '').trim();
    const incoming = String(nextContent || '').trim();
    if (!existing || !incoming) return false;
    if (existing === incoming) return true;
    const existingTokens = tokenizeMemoryEntry(existing);
    const incomingTokens = tokenizeMemoryEntry(incoming);
    if (!existingTokens.length || !incomingTokens.length) return false;
    let overlap = 0;
    incomingTokens.forEach((token) => {
      if (existingTokens.includes(token)) overlap += 1;
    });
    const overlapRatio = overlap / Math.max(1, Math.min(existingTokens.length, incomingTokens.length));
    if (overlapRatio >= 0.6) return true;
    const existingCompact = existing.replace(/\s+/g, '');
    const incomingCompact = incoming.replace(/\s+/g, '');
    return existingCompact.includes(incomingCompact) || incomingCompact.includes(existingCompact);
  }

  function rewriteMarkdownSection(base = '', title = '长期记忆', body = '', options = {}) {
    const normalizedBody = String(body || '').trim();
    const heading = `## ${String(title || '').trim() || '长期记忆'}`;
    const fallback = typeof options.buildDefaultMarkdown === 'function'
      ? String(options.buildDefaultMarkdown() || '')
      : buildDefaultAISoulUserMaterialMarkdown();
    const normalizedBase = String(base || '').trim() || fallback;
    const lines = normalizedBase.replace(/\r\n/g, '\n').split('\n');
    const idx = lines.findIndex((line) => line.trim() === heading);
    const contentLines = normalizedBody ? normalizedBody.split('\n') : [''];
    if (idx === -1) {
      const next = normalizedBase.trimEnd();
      return `${next ? `${next}\n\n` : ''}${heading}\n\n${contentLines.join('\n')}`.trimEnd();
    }
    let endIdx = lines.length;
    for (let i = idx + 1; i < lines.length; i += 1) {
      if (/^##\s+/.test(lines[i].trim())) {
        endIdx = i;
        break;
      }
    }
    return [
      ...lines.slice(0, idx + 1),
      '',
      ...contentLines,
      ...lines.slice(endIdx),
    ].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  }

  function appendToMarkdownSection(markdown = '', sectionTitle = '', content = '', options = {}) {
    const fallback = typeof options.buildDefaultMarkdown === 'function'
      ? String(options.buildDefaultMarkdown() || '')
      : buildDefaultAISoulUserMaterialMarkdown();
    const base = String(markdown || '').trim() || fallback;
    const title = String(sectionTitle || '长期记忆').trim() || '长期记忆';
    const body = String(content || '').trim();
    if (!body) return base;
    const entry = `- ${body}`;
    if (base.includes(entry)) return base;
    const heading = `## ${title}`;
    const lines = base.split('\n');
    const idx = lines.findIndex((line) => line.trim() === heading);
    if (idx === -1) {
      const chunks = [base];
      if (!base.endsWith('\n')) chunks.push('');
      chunks.push('', heading, '', entry, '');
      return chunks.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    }
    let insertAt = lines.length;
    for (let i = idx + 1; i < lines.length; i += 1) {
      if (/^##\s+/.test(lines[i].trim())) {
        insertAt = i;
        break;
      }
    }
    const nextLines = lines.slice();
    for (let i = idx + 1; i < insertAt; i += 1) {
      const trimmed = String(nextLines[i] || '').trim();
      if (!trimmed.startsWith('- ')) continue;
      if (!shouldReplaceExistingMemoryEntry(trimmed, body)) continue;
      nextLines[i] = entry;
      return nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    }
    const needsBlank = insertAt > idx + 1 && String(nextLines[insertAt - 1] || '').trim() !== '';
    if (needsBlank) nextLines.splice(insertAt++, 0, '');
    nextLines.splice(insertAt, 0, entry);
    return nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  }

  function refreshServerVisibleMemoryFiles(aiMemory) {
    if (!aiMemory || typeof aiMemory !== 'object') return;
    aiMemory.soul = String(aiMemory.soulUserNotes || '').trim() || buildDefaultAISoulUserMaterialMarkdown();
    aiMemory.identityNotes = String(aiMemory.identityNotes || '').trim() || buildDefaultAIIdentityMarkdown();
    aiMemory.user = String(aiMemory.user || '').trim() || buildDefaultAIUserMarkdown();
    aiMemory.memoryIndex = String(aiMemory.memoryIndex || '').trim() || buildDefaultAIMemoryIndexMarkdown();
    aiMemory.systemNotes = String(aiMemory.systemNotes || '').trim() || buildDefaultAIMemorySystemMarkdown();
    aiMemory.longTermMemory.identityNotes = aiMemory.identityNotes;
    aiMemory.longTermMemory.user = aiMemory.user;
    aiMemory.longTermMemory.memoryIndex = aiMemory.memoryIndex;
    aiMemory.longTermMemory.systemNotes = aiMemory.systemNotes;
    aiMemory.explicitMemoryLog = Array.isArray(aiMemory.longTermMemory.explicitMemoryLog)
      ? aiMemory.longTermMemory.explicitMemoryLog.slice(0, 50)
      : [];
  }

  function recordExplicitMemoryLogEntry(aiMemory, entry = {}, now = '') {
    if (!aiMemory || typeof aiMemory !== 'object') return null;
    const next = {
      id: createMorphId('memory-log'),
      scope: toSafeText(entry.scope, 40) || 'user',
      sectionTitle: toSafeText(entry.sectionTitle, 120) || '长期记忆',
      content: toSafeText(entry.content, 4000),
      source: toSafeText(entry.source, 80) || 'api:morph-action',
      candidateType: toSafeText(entry.candidateType, 80) || 'explicit-memory',
      writeTier: toSafeText(entry.writeTier, 80) || 'long-term-active',
      label: toSafeText(entry.label, 120) || toSafeText(entry.sectionTitle, 120) || '长期记忆',
      summary: toSafeText(entry.summary, 240) || toSafeText(entry.content, 240),
      createdAt: toSafeText(now, 80),
      updatedAt: toSafeText(now, 80),
    };
    const current = Array.isArray(aiMemory.longTermMemory.explicitMemoryLog) ? aiMemory.longTermMemory.explicitMemoryLog : [];
    const dedupeKey = `${next.scope}::${next.sectionTitle}::${next.content}`.toLowerCase();
    aiMemory.longTermMemory.explicitMemoryLog = [next].concat(
      current.filter((item) => `${String(item?.scope || '')}::${String(item?.sectionTitle || '')}::${String(item?.content || '')}`.toLowerCase() !== dedupeKey)
    ).slice(0, 50);
    aiMemory.explicitMemoryLog = aiMemory.longTermMemory.explicitMemoryLog.slice(0, 50);
    return next;
  }

  function resolveMemoryTarget(aiMemory, payload = {}, fallbackFile = 'soul.md') {
    const explicitTargetFile = normalizeMemoryTargetFile(
      payload.targetFile || payload.file || payload.memoryFile || payload.targetPath || ''
    );
    const targetFile = explicitTargetFile || fallbackFile;
    if (targetFile === 'user.md') {
      return {
        targetFile,
        scope: 'user',
        getValue: () => String(aiMemory.user || ''),
        setValue: (value) => {
          aiMemory.user = value;
        },
        buildDefaultMarkdown: buildDefaultAIUserMarkdown,
      };
    }
    if (targetFile === 'identity.md') {
      return {
        targetFile,
        scope: 'soul',
        getValue: () => String(aiMemory.identityNotes || ''),
        setValue: (value) => {
          aiMemory.identityNotes = value;
        },
        buildDefaultMarkdown: buildDefaultAIIdentityMarkdown,
      };
    }
    if (targetFile === 'memory.md') {
      return {
        targetFile,
        scope: 'system',
        getValue: () => String(aiMemory.memoryIndex || ''),
        setValue: (value) => {
          aiMemory.memoryIndex = value;
        },
        buildDefaultMarkdown: buildDefaultAIMemoryIndexMarkdown,
      };
    }
    if (targetFile === 'memory-system.md') {
      return {
        targetFile,
        scope: 'system',
        getValue: () => String(aiMemory.systemNotes || ''),
        setValue: (value) => {
          aiMemory.systemNotes = value;
        },
        buildDefaultMarkdown: buildDefaultAIMemorySystemMarkdown,
      };
    }
    return {
      targetFile: 'soul.md',
      scope: 'soul',
      getValue: () => String(aiMemory.soulUserNotes || ''),
      setValue: (value) => {
        aiMemory.soulUserNotes = value;
      },
      buildDefaultMarkdown: buildDefaultAISoulUserMaterialMarkdown,
    };
  }

  const actionHandlers = {
    create_flash_thought(data, payload, now) {
      const text = toSafeText(payload.text, 4000);
      if (!text) throw createInvalidPayloadError('payload.text is required', { field: 'text' });
      const entity = {
        id: toSafeText(payload.id, 120) || createMorphId('flash'),
        text,
        date: toSafeText(payload.date, 40),
        time: toSafeText(payload.time, 40),
        status: 'active',
        tags: toSafeArray(payload.tags).map((tag) => toSafeText(tag, 60)).filter(Boolean).slice(0, 20),
        source: toSafeText(payload.source, 80) || 'api:morph-action',
        createdAt: now,
        updatedAt: now,
        links: [],
      };
      ensureArrayField(data, 'flashThoughts').push(entity);
      return { entityType: 'flashThought', entityId: entity.id, entity, affectedEntities: [{ type: 'flashThought', id: entity.id }] };
    },
    add_flash_thought(data, payload, now) {
      return actionHandlers.create_flash_thought(data, payload, now);
    },
    add_fixed_thought(data, payload, now) {
      const text = toSafeText(payload.text, 4000);
      const name = toSafeText(payload.name || payload.title, 240);
      const resolvedText = text || name;
      if (!resolvedText) throw createInvalidPayloadError('payload.text is required', { field: 'text' });
      const entity = {
        id: toSafeText(payload.id, 120) || createMorphId('fixed-thought'),
        name: name || resolvedText.slice(0, 120),
        title: name || resolvedText.slice(0, 120),
        text: resolvedText,
        status: 'active',
        tags: toSafeArray(payload.tags).map((tag) => toSafeText(tag, 60)).filter(Boolean).slice(0, 20),
        source: toSafeText(payload.source, 80) || 'api:morph-action',
        createdAt: now,
        updatedAt: now,
        links: [],
      };
      ensureArrayField(data, 'fixed').unshift(entity);
      return { entityType: 'fixedThought', entityId: entity.id, entity, affectedEntities: [{ type: 'fixedThought', id: entity.id }] };
    },
    archive_flash_thought(data, payload, now) {
      const id = toSafeText(payload.id, 120);
      if (!id) throw createInvalidPayloadError('payload.id is required', { field: 'id' });
      const activeList = ensureArrayField(data, 'flashThoughts');
      const activeIndex = activeList.findIndex((item) => String(item?.id || '').trim() === id);
      if (activeIndex < 0) throw createEntityNotFoundError('flashThought', id);
      const entity = { ...(activeList.splice(activeIndex, 1)[0] || {}) };
      entity.status = 'archived';
      entity.archivedAt = now;
      entity.updatedAt = now;
      ensureArrayField(data, 'completedFlashThoughts').push(entity);
      return { entityType: 'flashThought', entityId: entity.id, entity, affectedEntities: [{ type: 'flashThought', id: entity.id }] };
    },
    create_project(data, payload, now) {
      const name = toSafeText(payload.name, 240);
      if (!name) throw createInvalidPayloadError('payload.name is required', { field: 'name' });
      const fixedThought = {
        id: toSafeText(payload.fixedThoughtId, 120) || createMorphId('fixed-thought'),
        name,
        text: toSafeText(payload.fixedThoughtText, 4000) || name,
        status: 'active',
        tags: toSafeArray(payload.tags).map((tag) => toSafeText(tag, 60)).filter(Boolean).slice(0, 20),
        source: toSafeText(payload.source, 80) || 'api:morph-action',
        createdAt: now,
        updatedAt: now,
        promotedProjectId: '',
        promotedProjectName: '',
        links: [],
      };
      const entity = {
        id: toSafeText(payload.id, 120) || createMorphId('project'),
        name,
        description: toSafeText(payload.description, 4000),
        status: normalizeMorphStatus(payload.status, 'active'),
        tags: toSafeArray(payload.tags).map((tag) => toSafeText(tag, 60)).filter(Boolean).slice(0, 20),
        source: toSafeText(payload.source, 80) || 'api:morph-action',
        createdAt: now,
        updatedAt: now,
        blocks: [],
        metadata: toSafeObject(payload.metadata),
        sourceThought: {
          id: fixedThought.id,
          type: 'fixed',
          text: fixedThought.text,
          createdAt: fixedThought.createdAt,
        },
      };
      fixedThought.promotedProjectId = entity.id;
      fixedThought.promotedProjectName = entity.name;
      ensureArrayField(data, 'fixed').unshift(fixedThought);
      ensureArrayField(data, 'projects').push(entity);
      return {
        entityType: 'project',
        entityId: entity.id,
        entity,
        affectedEntities: [
          { type: 'project', id: entity.id },
          { type: 'fixedThought', id: fixedThought.id },
        ],
      };
    },
    create_routine(data, payload, now) {
      const name = toSafeText(payload.name, 240);
      if (!name) throw createInvalidPayloadError('payload.name is required', { field: 'name' });
      const entity = {
        id: toSafeText(payload.id, 120) || createMorphId('routine'),
        name,
        description: toSafeText(payload.description, 4000),
        status: normalizeMorphStatus(payload.status, 'active'),
        schedule: toSafeText(payload.schedule, 120),
        tags: toSafeArray(payload.tags).map((tag) => toSafeText(tag, 60)).filter(Boolean).slice(0, 20),
        source: toSafeText(payload.source, 80) || 'api:morph-action',
        createdAt: now,
        updatedAt: now,
        blocks: [],
        metadata: toSafeObject(payload.metadata),
        links: [],
      };
      ensureArrayField(data, 'routines').push(entity);
      return {
        entityType: 'routine',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'routine', id: entity.id }],
      };
    },
    update_project_status(data, payload, now) {
      const id = toSafeText(payload.id || payload.projectId, 120);
      if (!id) throw createInvalidPayloadError('payload.id is required', { field: 'id' });
      const ref = resolveMutableEntityRef(data, 'project', id);
      if (!ref) throw createEntityNotFoundError('project', id);
      const entity = { ...(ref.entity || {}) };
      entity.status = normalizeMorphStatus(payload.status, entity.status || 'active');
      entity.updatedAt = now;
      ref.save(entity);
      return { entityType: 'project', entityId: entity.id, entity, affectedEntities: [{ type: 'project', id: entity.id }] };
    },
    rename_project(data, payload, now) {
      const id = toSafeText(payload.id || payload.projectId, 120);
      const newName = toSafeText(payload.newName || payload.name, 240);
      if (!id) throw createInvalidPayloadError('payload.id is required', { field: 'id' });
      if (!newName) throw createInvalidPayloadError('payload.newName is required', { field: 'newName' });
      const ref = resolveMutableEntityRef(data, 'project', id);
      if (!ref) throw createEntityNotFoundError('project', id);
      const entity = { ...(ref.entity || {}) };
      entity.name = newName;
      entity.updatedAt = now;
      if (entity.sourceThought && typeof entity.sourceThought === 'object') {
        entity.sourceThought = { ...entity.sourceThought, text: newName };
      }
      ref.save(entity);
      const affectedEntities = [{ type: 'project', id: entity.id }];
      const sourceThoughtId = toSafeText(entity?.sourceThought?.id, 120);
      if (sourceThoughtId) {
        const fixedRef = resolveMutableEntityRef(data, 'fixedThought', sourceThoughtId);
        if (fixedRef) {
          const fixedEntity = { ...(fixedRef.entity || {}) };
          fixedEntity.name = newName;
          fixedEntity.title = newName;
          fixedEntity.text = newName;
          fixedEntity.updatedAt = now;
          fixedRef.save(fixedEntity);
          affectedEntities.push({ type: 'fixedThought', id: fixedEntity.id });
        }
      }
      return { entityType: 'project', entityId: entity.id, entity, affectedEntities };
    },
    append_project_block(data, payload, now) {
      const projectId = toSafeText(payload.projectId || payload.id, 120);
      const text = toSafeText(payload.text, 4000);
      if (!projectId) throw createInvalidPayloadError('payload.projectId is required', { field: 'projectId' });
      if (!text) throw createInvalidPayloadError('payload.text is required', { field: 'text' });
      const ref = resolveMutableEntityRef(data, 'project', projectId);
      if (!ref) throw createEntityNotFoundError('project', projectId);
      const entity = { ...(ref.entity || {}) };
      const blocks = ensureArrayField(entity, 'blocks');
      const block = {
        id: toSafeText(payload.blockId, 120) || createMorphId('project-block'),
        type: toSafeText(payload.type, 60) || 'note',
        text,
        checked: payload.checked === true,
        order: blocks.length,
        metadata: toSafeObject(payload.metadata),
        createdAt: now,
        updatedAt: now,
      };
      blocks.push(block);
      entity.updatedAt = now;
      ref.save(entity);
      return {
        entityType: 'project',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'project', id: entity.id }, { type: 'projectBlock', id: block.id }],
      };
    },
    update_project_block(data, payload, now) {
      const projectId = toSafeText(payload.projectId || payload.id, 120);
      const blockId = toSafeText(payload.blockId, 120);
      const nextText = toSafeText(payload.newContent || payload.content || payload.text, 4000);
      if (!projectId) throw createInvalidPayloadError('payload.projectId is required', { field: 'projectId' });
      if (!blockId) throw createInvalidPayloadError('payload.blockId is required', { field: 'blockId' });
      if (!nextText) throw createInvalidPayloadError('payload.newContent is required', { field: 'newContent' });
      const ref = resolveMutableEntityRef(data, 'project', projectId);
      if (!ref) throw createEntityNotFoundError('project', projectId);
      const entity = { ...(ref.entity || {}) };
      const blocks = ensureArrayField(entity, 'blocks');
      const index = findItemIndexById(blocks, blockId);
      if (index < 0) throw createEntityNotFoundError('projectBlock', blockId, { entityType: 'project', entityId: projectId });
      const block = { ...(blocks[index] || {}) };
      block.text = nextText;
      block.updatedAt = now;
      blocks[index] = block;
      entity.updatedAt = now;
      ref.save(entity);
      return {
        entityType: 'project',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'project', id: entity.id }, { type: 'projectBlock', id: block.id }],
      };
    },
    delete_project_block(data, payload, now) {
      const projectId = toSafeText(payload.projectId || payload.id, 120);
      const blockId = toSafeText(payload.blockId, 120);
      if (!projectId) throw createInvalidPayloadError('payload.projectId is required', { field: 'projectId' });
      if (!blockId) throw createInvalidPayloadError('payload.blockId is required', { field: 'blockId' });
      const ref = resolveMutableEntityRef(data, 'project', projectId);
      if (!ref) throw createEntityNotFoundError('project', projectId);
      const entity = { ...(ref.entity || {}) };
      const blocks = ensureArrayField(entity, 'blocks');
      const index = findItemIndexById(blocks, blockId);
      if (index < 0) throw createEntityNotFoundError('projectBlock', blockId, { entityType: 'project', entityId: projectId });
      blocks.splice(index, 1);
      entity.updatedAt = now;
      ref.save(entity);
      return {
        entityType: 'project',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'project', id: entity.id }, { type: 'projectBlock', id: blockId }],
      };
    },
    create_reminder(data, payload, now) {
      const title = toSafeText(payload.title, 240);
      if (!title) throw createInvalidPayloadError('payload.title is required', { field: 'title' });
      const entity = {
        id: toSafeText(payload.id, 120) || createMorphId('reminder'),
        title,
        note: toSafeText(payload.note, 2000),
        dueAt: toSafeText(payload.dueAt, 80),
        completedAt: '',
        priority: ['low', 'medium', 'high'].includes(String(payload.priority || '').trim()) ? String(payload.priority).trim() : 'medium',
        tags: toSafeArray(payload.tags).map((tag) => toSafeText(tag, 60)).filter(Boolean).slice(0, 20),
        source: toSafeText(payload.source, 80) || 'api:morph-action',
        createdAt: now,
        updatedAt: now,
      };
      ensureArrayField(data, 'reminders').push(entity);
      return { entityType: 'reminder', entityId: entity.id, entity, affectedEntities: [{ type: 'reminder', id: entity.id }] };
    },
    add_reminder(data, payload, now) {
      const title = toSafeText(payload.title || payload.text, 240);
      return actionHandlers.create_reminder(data, { ...payload, title }, now);
    },
    update_reminder(data, payload, now) {
      const id = toSafeText(payload.id || payload.reminderId, 120);
      if (!id) throw createInvalidPayloadError('payload.id is required', { field: 'id' });
      const ref = resolveMutableEntityRef(data, 'reminder', id);
      if (!ref) throw createEntityNotFoundError('reminder', id);
      const entity = { ...(ref.entity || {}) };
      const nextTitle = toSafeText(payload.newText || payload.text || payload.title, 240);
      const nextNote = toSafeText(payload.note, 2000);
      const nextDueAt = toSafeText(payload.newDatetime || payload.datetime || payload.dueAt, 80);
      if (!nextTitle && !nextDueAt && !Object.prototype.hasOwnProperty.call(payload, 'note')) {
        throw createInvalidPayloadError('payload must include at least one of newText, note, or newDatetime', { field: 'newText|note|newDatetime' });
      }
      if (nextTitle) entity.title = nextTitle;
      if (Object.prototype.hasOwnProperty.call(payload, 'note')) entity.note = nextNote;
      if (nextDueAt) entity.dueAt = nextDueAt;
      entity.updatedAt = now;
      ref.save(entity);
      return { entityType: 'reminder', entityId: entity.id, entity, affectedEntities: [{ type: 'reminder', id: entity.id }] };
    },
    delete_reminder(data, payload, now) {
      const id = toSafeText(payload.id || payload.reminderId, 120);
      if (!id) throw createInvalidPayloadError('payload.id is required', { field: 'id' });
      const ref = resolveMutableEntityRef(data, 'reminder', id);
      if (!ref) throw createEntityNotFoundError('reminder', id);
      const removed = ref.remove();
      const entity = { ...(removed || {}) };
      entity.updatedAt = now;
      return { entityType: 'reminder', entityId: id, entity, affectedEntities: [{ type: 'reminder', id }] };
    },
    complete_reminder(data, payload, now) {
      const id = toSafeText(payload.id || payload.reminderId, 120);
      if (!id) throw createInvalidPayloadError('payload.id is required', { field: 'id' });
      const ref = resolveMutableEntityRef(data, 'reminder', id);
      if (!ref) throw createEntityNotFoundError('reminder', id);
      const entity = { ...(ref.entity || {}) };
      entity.completedAt = toSafeText(payload.completedAt, 80) || now;
      entity.updatedAt = now;
      ref.save(entity);
      return { entityType: 'reminder', entityId: entity.id, entity, affectedEntities: [{ type: 'reminder', id: entity.id }] };
    },
    add_expense_record(data, payload, now) {
      const item = toSafeText(payload.item || payload.text || payload.title, 240);
      const amount = Number(payload.amount);
      if (!item) throw createInvalidPayloadError('payload.item is required', { field: 'item' });
      if (!Number.isFinite(amount) || amount <= 0) throw createInvalidPayloadError('payload.amount must be a positive number', { field: 'amount' });
      const ledger = ensureExpenseLedgerShape(data);
      const rawCategory = toSafeText(payload.category, 80);
      const category = rawCategory || inferExpenseCategoryFromText(`${item} ${toSafeText(payload.note, 240)}`);
      if (category && !ledger.categories.includes(category)) ledger.categories.push(category);
      const entity = {
        id: toSafeText(payload.id, 120) || createMorphId('expense'),
        item,
        category,
        amount: Math.round(amount * 100) / 100,
        note: toSafeText(payload.note, 2000),
        spentAt: toSafeText(payload.spentAt || payload.datetime, 80) || now.slice(0, 16).replace('T', ' '),
        createdAt: now,
        updatedAt: now,
        source: toSafeText(payload.source, 80) || 'api:morph-action',
      };
      ledger.records.push(entity);
      return {
        entityType: 'expenseRecord',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'expenseRecord', id: entity.id }],
      };
    },
    append_daily_log(data, payload, now) {
      const date = toSafeText(payload.date, 20) || now.slice(0, 10);
      const text = toSafeText(payload.text, 4000);
      if (!text) throw createInvalidPayloadError('payload.text is required', { field: 'text' });
      let entry = null;
      let block = null;
      if (shouldUseStructuredDailyStorage(data, date)) {
        entry = resolveDailyEntry(data, date);
        if (!entry) throw createInvalidPayloadError('payload.date must be in YYYY-MM-DD format', { field: 'date' });
        const blocks = ensureArrayField(entry, 'blocks');
        block = {
          id: toSafeText(payload.blockId, 120) || createMorphId('daily-block'),
          type: toSafeText(payload.type, 60) || 'note',
          text,
          checked: payload.checked === true,
          order: blocks.length,
          metadata: toSafeObject(payload.metadata),
          createdAt: now,
          updatedAt: now,
        };
        blocks.push(block);
        if (typeof payload.summary === 'string' && payload.summary.trim()) {
          entry.summary = toSafeText(payload.summary, 2000);
        }
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw createInvalidPayloadError('payload.date must be in YYYY-MM-DD format', { field: 'date' });
        const monthKey = date.slice(0, 7);
        const monthBlocks = resolveLegacyDailyMonthBlocks(data, monthKey);
        if (!monthBlocks) throw createInvalidPayloadError('payload.date conflicts with structured daily storage', { field: 'date' });
        const section = ensureLegacyDailySection(monthBlocks, date);
        const insertIndex = getLegacyDailyInsertIndex(monthBlocks, section);
        const legacyType = toSafeText(payload.type, 60) === 'todo' ? 'todo' : 'p';
        block = {
          id: toSafeText(payload.blockId, 120) || createMorphId('daily-block'),
          type: legacyType,
          content: text,
          checked: payload.checked === true,
          metadata: toSafeObject(payload.metadata),
          createdAt: now,
          updatedAt: now,
        };
        monthBlocks.splice(insertIndex, 0, block);
        entry = buildLegacyDailyEntrySnapshot(monthBlocks, date);
        if (typeof payload.summary === 'string' && payload.summary.trim()) {
          entry.summary = toSafeText(payload.summary, 2000);
        }
      }
      return {
        entityType: 'daily',
        entityId: date,
        entity: entry,
        affectedEntities: [{ type: 'daily', id: date }, { type: 'dailyBlock', id: block.id }],
      };
    },
    append_daily_log_under_date(data, payload, now) {
      const date = toSafeText(payload.date || payload.dateStr, 20);
      if (!date) throw createInvalidPayloadError('payload.date is required', { field: 'date' });
      return actionHandlers.append_daily_log(data, { ...payload, date }, now);
    },
    update_daily_log_entry(data, payload, now) {
      const date = toSafeText(payload.date, 20);
      const nextText = toSafeText(payload.newText || payload.textNew || payload.toText || payload.content, 4000);
      if (!date) throw createInvalidPayloadError('payload.date is required', { field: 'date' });
      if (!nextText) throw createInvalidPayloadError('payload.newText is required', { field: 'newText' });
      let entry = null;
      let block = null;
      if (shouldUseStructuredDailyStorage(data, date)) {
        entry = resolveDailyEntry(data, date);
        if (!entry) throw createEntityNotFoundError('daily', date);
        const blocks = ensureArrayField(entry, 'blocks');
        const blockId = toSafeText(payload.blockId || payload.id, 120);
        let index = blockId ? findItemIndexById(blocks, blockId) : -1;
        if (index < 0) {
          const previousText = toSafeText(payload.text, 4000);
          index = blocks.findIndex((item) => toSafeText(item?.text, 4000) === previousText);
        }
        if (index < 0) throw createEntityNotFoundError('dailyBlock', blockId || toSafeText(payload.text, 120), { entityType: 'daily', entityId: date });
        block = { ...(blocks[index] || {}) };
        block.text = nextText;
        block.updatedAt = now;
        blocks[index] = block;
        entry = { ...entry, blocks };
      } else {
        const monthBlocks = resolveLegacyDailyMonthBlocks(data, date.slice(0, 7));
        if (!monthBlocks) throw createEntityNotFoundError('daily', date);
        const index = findLegacyDailyBlockIndex(monthBlocks, date, payload);
        const blockId = toSafeText(payload.blockId || payload.id, 120);
        if (index < 0) throw createEntityNotFoundError('dailyBlock', blockId || toSafeText(payload.text, 120), { entityType: 'daily', entityId: date });
        block = { ...(monthBlocks[index] || {}) };
        block.content = nextText;
        block.updatedAt = now;
        delete block.html;
        monthBlocks[index] = block;
        entry = buildLegacyDailyEntrySnapshot(monthBlocks, date);
      }
      return {
        entityType: 'daily',
        entityId: date,
        entity: entry,
        affectedEntities: [{ type: 'daily', id: date }, { type: 'dailyBlock', id: block.id }],
      };
    },
    delete_daily_log_entry(data, payload, now) {
      const date = toSafeText(payload.date, 20);
      if (!date) throw createInvalidPayloadError('payload.date is required', { field: 'date' });
      let entry = null;
      let removed = null;
      if (shouldUseStructuredDailyStorage(data, date)) {
        entry = resolveDailyEntry(data, date);
        if (!entry) throw createEntityNotFoundError('daily', date);
        const blocks = ensureArrayField(entry, 'blocks');
        const blockId = toSafeText(payload.blockId || payload.id, 120);
        let index = blockId ? findItemIndexById(blocks, blockId) : -1;
        if (index < 0) {
          const targetText = toSafeText(payload.text, 4000);
          index = blocks.findIndex((block) => toSafeText(block?.text, 4000) === targetText);
        }
        if (index < 0) throw createEntityNotFoundError('dailyBlock', blockId || toSafeText(payload.text, 120), { entityType: 'daily', entityId: date });
        [removed] = blocks.splice(index, 1);
        entry = { ...entry, blocks };
      } else {
        const monthBlocks = resolveLegacyDailyMonthBlocks(data, date.slice(0, 7));
        if (!monthBlocks) throw createEntityNotFoundError('daily', date);
        const index = findLegacyDailyBlockIndex(monthBlocks, date, payload);
        const blockId = toSafeText(payload.blockId || payload.id, 120);
        if (index < 0) throw createEntityNotFoundError('dailyBlock', blockId || toSafeText(payload.text, 120), { entityType: 'daily', entityId: date });
        [removed] = monthBlocks.splice(index, 1);
        entry = buildLegacyDailyEntrySnapshot(monthBlocks, date);
      }
      return {
        entityType: 'daily',
        entityId: date,
        entity: entry,
        affectedEntities: [{ type: 'daily', id: date }, { type: 'dailyBlock', id: toSafeText(removed?.id, 120) }],
      };
    },
    add_project_reference(data, payload, now) {
      const projectId = toSafeText(payload.projectId || payload.id, 120);
      const text = toSafeText(payload.text, 4000);
      if (!projectId) throw createInvalidPayloadError('payload.projectId is required', { field: 'projectId' });
      if (!text) throw createInvalidPayloadError('payload.text is required', { field: 'text' });
      const ref = resolveMutableEntityRef(data, 'project', projectId);
      if (!ref) throw createEntityNotFoundError('project', projectId);
      const entity = { ...(ref.entity || {}) };
      const items = ensureArrayField(entity, 'items');
      const reference = {
        id: toSafeText(payload.referenceId || payload.itemId, 120) || createMorphId('project-ref'),
        text,
        time: toSafeText(payload.time, 40) || now,
        source: toSafeText(payload.source, 80) || 'api:morph-action',
        createdAt: now,
        updatedAt: now,
      };
      items.unshift(reference);
      entity.updatedAt = now;
      ref.save(entity);
      return {
        entityType: 'project',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'project', id: entity.id }, { type: 'projectReference', id: reference.id }],
      };
    },
    update_project_reference(data, payload, now) {
      const projectId = toSafeText(payload.projectId || payload.id, 120);
      const itemId = toSafeText(payload.itemId || payload.referenceId, 120);
      const nextText = toSafeText(payload.newText || payload.text, 4000);
      if (!projectId) throw createInvalidPayloadError('payload.projectId is required', { field: 'projectId' });
      if (!itemId) throw createInvalidPayloadError('payload.itemId is required', { field: 'itemId' });
      if (!nextText) throw createInvalidPayloadError('payload.newText is required', { field: 'newText' });
      const ref = resolveMutableEntityRef(data, 'project', projectId);
      if (!ref) throw createEntityNotFoundError('project', projectId);
      const entity = { ...(ref.entity || {}) };
      const items = ensureArrayField(entity, 'items');
      const index = findItemIndexById(items, itemId);
      if (index < 0) throw createEntityNotFoundError('projectReference', itemId, { entityType: 'project', entityId: projectId });
      const item = { ...(items[index] || {}) };
      item.text = nextText;
      item.time = toSafeText(payload.time, 40) || now;
      item.updatedAt = now;
      items[index] = item;
      entity.updatedAt = now;
      ref.save(entity);
      return {
        entityType: 'project',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'project', id: entity.id }, { type: 'projectReference', id: item.id }],
      };
    },
    delete_project_reference(data, payload, now) {
      const projectId = toSafeText(payload.projectId || payload.id, 120);
      const itemId = toSafeText(payload.itemId || payload.referenceId, 120);
      if (!projectId) throw createInvalidPayloadError('payload.projectId is required', { field: 'projectId' });
      if (!itemId) throw createInvalidPayloadError('payload.itemId is required', { field: 'itemId' });
      const ref = resolveMutableEntityRef(data, 'project', projectId);
      if (!ref) throw createEntityNotFoundError('project', projectId);
      const entity = { ...(ref.entity || {}) };
      const items = ensureArrayField(entity, 'items');
      const index = findItemIndexById(items, itemId);
      if (index < 0) throw createEntityNotFoundError('projectReference', itemId, { entityType: 'project', entityId: projectId });
      items.splice(index, 1);
      entity.updatedAt = now;
      ref.save(entity);
      return {
        entityType: 'project',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'project', id: entity.id }, { type: 'projectReference', id: itemId }],
      };
    },
    delete_project(data, payload, now) {
      const id = toSafeText(payload.id || payload.projectId, 120);
      if (!id) throw createInvalidPayloadError('payload.id is required', { field: 'id' });
      const ref = resolveMutableEntityRef(data, 'project', id);
      if (!ref) throw createEntityNotFoundError('project', id);
      const removed = ref.remove();
      const entity = { ...(removed || {}) };
      entity.updatedAt = now;
      const affectedEntities = [{ type: 'project', id }];
      const sourceThoughtId = toSafeText(entity?.sourceThought?.id, 120);
      if (sourceThoughtId) {
        const fixedRef = resolveMutableEntityRef(data, 'fixedThought', sourceThoughtId);
        if (fixedRef) {
          const fixedEntity = { ...(fixedRef.entity || {}) };
          fixedEntity.promotedProjectId = '';
          fixedEntity.promotedProjectName = '';
          fixedEntity.updatedAt = now;
          fixedRef.save(fixedEntity);
          affectedEntities.push({ type: 'fixedThought', id: fixedEntity.id });
        }
      }
      return { entityType: 'project', entityId: id, entity, affectedEntities };
    },
    create_sop(data, payload, now) {
      const name = toSafeText(payload.name, 240);
      if (!name) throw createInvalidPayloadError('payload.name is required', { field: 'name' });
      const entity = {
        id: toSafeText(payload.id, 120) || createMorphId('sop'),
        name,
        description: toSafeText(payload.description, 4000),
        status: normalizeMorphStatus(payload.status, 'active'),
        tags: toSafeArray(payload.tags).map((tag) => toSafeText(tag, 60)).filter(Boolean).slice(0, 20),
        source: toSafeText(payload.source, 80) || 'api:morph-action',
        createdAt: now,
        updatedAt: now,
        blocks: [],
        metadata: toSafeObject(payload.metadata),
      };
      ensureArrayField(data, 'sops').push(entity);
      return { entityType: 'sop', entityId: entity.id, entity, affectedEntities: [{ type: 'sop', id: entity.id }] };
    },
    memory_write_user(data, payload, now) {
      const content = toSafeText(payload.content || payload.text, 4000);
      const sectionTitle = toSafeText(payload.sectionTitle, 120) || '用户偏好';
      if (!content) throw createInvalidPayloadError('payload.content is required', { field: 'content' });
      const aiMemory = ensureServerAIMemoryShape(data);
      const target = resolveMemoryTarget(aiMemory, payload, 'user.md');
      target.setValue(appendToMarkdownSection(target.getValue(), sectionTitle, content, {
        buildDefaultMarkdown: target.buildDefaultMarkdown,
      }));
      refreshServerVisibleMemoryFiles(aiMemory);
      recordExplicitMemoryLogEntry(aiMemory, {
        scope: target.scope,
        sectionTitle,
        content,
        source: 'memory_write_user',
        candidateType: 'stable-preference',
        writeTier: 'long-term-active',
        label: sectionTitle,
        summary: `写入了 ${target.targetFile}：${sectionTitle}`,
      }, now);
      const entity = {
        id: target.targetFile,
        targetFile: target.targetFile,
        scope: target.scope,
        sectionTitle,
        content,
        text: target.getValue(),
        updatedAt: now,
        receiptLabel: `已记住，并写入 ${target.targetFile}：${sectionTitle}`,
      };
      return {
        entityType: 'memoryDocument',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'memoryDocument', id: entity.id }],
      };
    },
    memory_rewrite_section(data, payload, now) {
      const content = toSafeText(payload.content || payload.text, 4000);
      const sectionTitle = toSafeText(payload.sectionTitle, 120) || '长期记忆';
      if (!content) throw createInvalidPayloadError('payload.content is required', { field: 'content' });
      const aiMemory = ensureServerAIMemoryShape(data);
      const target = resolveMemoryTarget(aiMemory, payload, 'soul.md');
      target.setValue(rewriteMarkdownSection(target.getValue(), sectionTitle, content, {
        buildDefaultMarkdown: target.buildDefaultMarkdown,
      }));
      refreshServerVisibleMemoryFiles(aiMemory);
      recordExplicitMemoryLogEntry(aiMemory, {
        scope: target.scope,
        sectionTitle,
        content,
        source: 'memory_rewrite_section',
        candidateType: 'explicit-memory',
        writeTier: 'long-term-candidate',
        label: sectionTitle,
        summary: `重写了 ${target.targetFile}：${sectionTitle}`,
      }, now);
      const entity = {
        id: target.targetFile,
        targetFile: target.targetFile,
        scope: target.scope,
        sectionTitle,
        content,
        text: target.getValue(),
        updatedAt: now,
        receiptLabel: `已更新 ${target.targetFile}：${sectionTitle}`,
      };
      return {
        entityType: 'memoryDocument',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'memoryDocument', id: entity.id }],
      };
    },
    write_soul_memory(data, payload, now) {
      const content = toSafeText(payload.content || payload.text, 4000);
      const sectionTitle = toSafeText(payload.sectionTitle, 120) || '长期记忆';
      if (!content) throw createInvalidPayloadError('payload.content is required', { field: 'content' });
      const aiMemory = ensureServerAIMemoryShape(data);
      const target = resolveMemoryTarget(aiMemory, payload, 'soul.md');
      target.setValue(appendToMarkdownSection(target.getValue(), sectionTitle, content, {
        buildDefaultMarkdown: target.buildDefaultMarkdown,
      }));
      refreshServerVisibleMemoryFiles(aiMemory);
      recordExplicitMemoryLogEntry(aiMemory, {
        scope: target.scope,
        sectionTitle,
        content,
        source: 'write_soul_memory',
        candidateType: 'explicit-memory',
        writeTier: 'long-term-candidate',
        label: sectionTitle,
        summary: `写入了 ${target.targetFile}：${sectionTitle}`,
      }, now);
      const entity = {
        id: target.targetFile,
        targetFile: target.targetFile,
        scope: target.scope,
        sectionTitle,
        content,
        text: target.getValue(),
        updatedAt: now,
        receiptLabel: `已记住，并写入 ${target.targetFile}：${sectionTitle}`,
      };
      return {
        entityType: 'memoryDocument',
        entityId: entity.id,
        entity,
        affectedEntities: [{ type: 'memoryDocument', id: entity.id }],
      };
    },
    link_entities(data, payload, now) {
      const fromType = normalizeEntityType(payload.fromType);
      const toType = normalizeEntityType(payload.toType);
      const fromId = toSafeText(payload.fromId, 120);
      const toId = toSafeText(payload.toId, 120);
      if (!fromType || !toType) throw createInvalidPayloadError('payload.fromType and payload.toType must be valid', { field: 'fromType|toType' });
      if (!fromId || !toId) throw createInvalidPayloadError('payload.fromId and payload.toId are required', { field: 'fromId|toId' });
      const fromRef = resolveMutableEntityRef(data, fromType, fromId);
      const toRef = resolveMutableEntityRef(data, toType, toId);
      if (!fromRef) throw createEntityNotFoundError(fromType, fromId, { side: 'from' });
      if (!toRef) throw createEntityNotFoundError(toType, toId, { side: 'to' });
      const fromEntity = { ...(fromRef.entity || {}) };
      const toEntity = { ...(toRef.entity || {}) };
      upsertEntityLink(fromEntity, { type: toType, targetId: toId, label: payload.label });
      upsertEntityLink(toEntity, { type: fromType, targetId: fromId, label: payload.reverseLabel || payload.label });
      fromEntity.updatedAt = now;
      toEntity.updatedAt = now;
      fromRef.save(fromEntity);
      toRef.save(toEntity);
      return {
        entityType: fromType,
        entityId: fromId,
        entity: fromEntity,
        affectedEntities: [{ type: fromType, id: fromId }, { type: toType, id: toId }],
      };
    },
  };

  function applyAction(data, actionName, payload) {
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    const requestedAction = sanitizeMorphActionName(actionName);
    const canonicalAction = getCanonicalMorphActionName(requestedAction);
    const action = requestedAction || canonicalAction;
    const handler = actionHandlers[action] || actionHandlers[canonicalAction];
    if (typeof handler !== 'function') {
      throw createMorphApiError(404, 'unknown_action', `unknown action: ${actionName}`);
    }
    return handler(data, safePayload, new Date().toISOString());
  }

  function listActionSpecs() {
    return Array.from(new Set(
      Object.keys(SHARED_ACTION_SPECS).map((actionName) => getCanonicalMorphActionName(actionName) || sanitizeMorphActionName(actionName))
    ))
      .map((actionName) => resolveActionSpec(actionName))
      .filter(Boolean)
      .sort((left, right) => String(left.action || '').localeCompare(String(right.action || '')));
  }

  return {
    applyAction,
    getSourceOfTruth,
    listActionSpecs,
    listActionPolicyTiers,
    normalizeConfirmation,
    resolveActionSpec,
    resolveAuthorization,
  };
}

module.exports = {
  createMorphActionRegistry,
};
