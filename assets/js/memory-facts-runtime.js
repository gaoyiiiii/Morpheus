(function initMorphMemoryFactsRuntime() {
  function createMemoryFactsRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const LONG_TERM_FACT_RECONFIRM_DAYS = Number.isFinite(Number(api.LONG_TERM_FACT_RECONFIRM_DAYS))
      ? Math.max(1, Number(api.LONG_TERM_FACT_RECONFIRM_DAYS))
      : 60;
    const LONG_TERM_FACT_HARD_STALE_DAYS = Number.isFinite(Number(api.LONG_TERM_FACT_HARD_STALE_DAYS))
      ? Math.max(LONG_TERM_FACT_RECONFIRM_DAYS + 1, Number(api.LONG_TERM_FACT_HARD_STALE_DAYS))
      : 180;
    const LONG_TERM_FACT_MAX = Number.isFinite(Number(api.LONG_TERM_FACT_MAX))
      ? Math.max(1, Number(api.LONG_TERM_FACT_MAX))
      : 96;
    const LONG_TERM_FACT_ARCHIVE_MAX = Number.isFinite(Number(api.LONG_TERM_FACT_ARCHIVE_MAX))
      ? Math.max(1, Number(api.LONG_TERM_FACT_ARCHIVE_MAX))
      : 160;
    let lastBootStableMemorySummary = null;

    function deriveLongTermMemoryTaskHints(fact = null) {
      const safeFact = fact && typeof fact === 'object' ? fact : {};
      const category = String(safeFact.category || '').trim();
      const key = String(safeFact.key || safeFact.id || '').trim();
      const text = `${String(safeFact.label || '')} ${String(safeFact.fact || '')}`.toLowerCase();
      const hints = new Set(['memory']);
      const add = (...items) => items.forEach((item) => item && hints.add(item));

      if (category === 'relationship') add('relationship', 'reflection');
      if (category === 'behavior') add('planning', 'reflection');
      if (category === 'explicit') add('reflection');

      if (/(计划|规划|步骤|推进|项目|任务|时间块|schedule|plan)/.test(text) || key.includes('planning') || key.includes('focus')) {
        add('planning', 'execution');
      }
      if (/(血糖|健康|身体|症状|睡眠|运动|glucose|health)/.test(text)) add('health');
      if (/(发布|发送|公开|脚本|写作|表达|title|post|publish|writing)/.test(text)) add('writing', 'public-expression');
      if (/(公开|对外|发布|发出去|发送|邮件|消息|微博|推文|朋友圈)/.test(text) || key.includes('public') || key.includes('speech')) add('public-expression');
      if (/(钱|费用|预算|报价|花费|买|购买|投资|定价|付款|budget|price|pricing|cost)/.test(text) || key.includes('money') || key.includes('budget')) add('money');
      if (/(节律|作息|稳定|恢复|过载|休息|rhythm|recovery|pace)/.test(text) || key.includes('rhythm') || key.includes('stability')) add('rhythm');
      if (/(交付|上线|发布|里程碑|截止|deadline|ship|delivery|launch)/.test(text) || key.includes('delivery') || key.includes('launch')) add('delivery');
      if (/(提醒|主动|边界|相处|陪伴|长期|决策|关系)/.test(text) || key.includes('boundary') || key.includes('proactivity') || key.includes('reminders')) {
        add('relationship');
      }
      if (/(回顾|复盘|模式|习惯|偏好|记忆)/.test(text)) add('reflection');

      return Array.from(hints);
    }

    function sanitizeStableMemoryScope(value = '', fallback = 'user') {
      const normalized = String(value || '').trim().toLowerCase();
      if (['user', 'identity', 'address', 'preference', 'style', 'communication', 'boundary', 'relationship', 'behavior', 'workflow', 'persona-surface', 'system'].includes(normalized)) return normalized;
      return String(fallback || 'user').trim().toLowerCase() || 'user';
    }

    function sanitizeStableMemoryWriteMode(value = '', fallback = 'manual') {
      const normalized = String(value || '').trim().toLowerCase();
      if (['explicit-user', 'suggested', 'inferred', 'settings', 'manual', 'correction'].includes(normalized)) return normalized;
      return String(fallback || 'manual').trim().toLowerCase() || 'manual';
    }

    function sanitizeStableMemoryStability(value = '', fallback = 'normal') {
      const normalized = String(value || '').trim().toLowerCase();
      if (['locked', 'stable', 'normal'].includes(normalized)) return normalized;
      return String(fallback || 'normal').trim().toLowerCase() || 'normal';
    }

    function getMorpheusCoreConstitution() {
      return [
        'Morpheus 的产品定位、核心底盘、执行/确认/回执/撤销边界不能被稳定记忆改写。',
        '稳定记忆允许修改用户名字、称呼、长期偏好、相处边界、表达风格和人格外显，但不能把 Morpheus 改写成另一套身份设定。',
        '任何要求跳过确认、伪造成功、隐藏失败或绕过真实写入合同的内容，都不能进入稳定记忆。',
      ];
    }

    function inferStableMemoryMetadata({ category = '', scope = '', label = '', fact = '', source = '' } = {}) {
      const normalizedCategory = String(category || 'explicit').trim().toLowerCase() || 'explicit';
      const normalizedScope = sanitizeStableMemoryScope(scope || (normalizedCategory === 'relationship'
        ? 'relationship'
        : normalizedCategory === 'behavior'
          ? 'behavior'
          : 'user'));
      const title = String(label || '').trim();
      const text = String(fact || '').trim();
      const normalizedSource = String(source || '').trim().toLowerCase();
      const combined = `${title} ${text}`.trim();
      let derivedScope = normalizedScope;
      if (normalizedCategory === 'explicit' && normalizedScope === 'user') {
        if (/(名字|称呼|name)/i.test(title) || /(?:用户名字|用户称呼|名字|称呼)[:：]/u.test(text)) derivedScope = 'identity';
        else if (/(边界|不要替我|不要直接|先问|公开表达|花钱|健康判断)/.test(combined)) derivedScope = 'boundary';
        else if (/(表达|说话|口吻|语气|回复|聊天|列表|bullet)/i.test(combined)) derivedScope = 'style';
        else if (/(偏好|习惯|作息|饮食|工作方式|生活)/.test(combined)) derivedScope = 'preference';
      }
      let writeMode = 'manual';
      if (normalizedSource === 'correction') writeMode = 'correction';
      else if (normalizedSource === 'settings' || normalizedSource.startsWith('settings-')) writeMode = 'settings';
      else if (['user-name', 'user-preference', 'memory_write_user', 'settings-user-md'].includes(normalizedSource)) writeMode = 'explicit-user';
      else if (normalizedSource.includes('infer')) writeMode = 'inferred';
      let stability = 'normal';
      if (writeMode === 'settings' || writeMode === 'correction' || writeMode === 'explicit-user' || normalizedCategory === 'relationship' || normalizedCategory === 'behavior') {
        stability = 'stable';
      }
      if (derivedScope === 'identity' || normalizedSource === 'settings-user-md') stability = 'locked';
      const alwaysInject = derivedScope === 'identity'
        || derivedScope === 'communication'
        || derivedScope === 'persona-surface'
        || derivedScope === 'boundary'
        || derivedScope === 'style'
        || normalizedCategory === 'relationship'
        || normalizedCategory === 'behavior';
      return {
        scope: derivedScope,
        writeMode,
        stability,
        alwaysInject,
      };
    }

    function looksLikeBlockedStableMemoryWrite(sectionTitle = '', content = '') {
      const title = String(sectionTitle || '').trim();
      const text = String(content || '').trim();
      const combined = `${title} ${text}`.trim();
      if (!combined) return false;
      if (/^(?:从(?:现在|今天|此刻)(?:开始|起)?[，,\s]*)?你(?:就)?是/.test(text)) return true;
      if (/^(?:以后你|从现在开始你|你)(?:叫|叫做|就叫|是叫)/.test(text)) return true;
      if (/(?:你的名字|你的身份|你的角色|你的人设|你的设定|你的背景|你的故事|你的经历)/.test(text)) return true;
      if (/(?:产品定位|核心底盘|系统底盘|执行链|写入合同|确认合同|回执合同|撤销合同)/.test(combined) && /(?:改成|改写|重写|覆盖|不要|取消|跳过)/.test(combined)) return true;
      if (/(?:不要确认|不需要确认|跳过确认|绕过确认|别确认|不用回执|不要回执|假装成功|伪造成功|隐藏失败|不要告诉我失败)/.test(combined)) return true;
      return false;
    }

    function extractStableUserMemoryEntriesFromMarkdown(markdown = '') {
      const lines = String(markdown || '').split('\n');
      const entries = [];
      let currentSection = '';
      lines.forEach((line) => {
        const trimmed = String(line || '').trim();
        if (!trimmed) return;
        const headingMatch = trimmed.match(/^##\s+(.+)$/);
        if (headingMatch?.[1]) {
          currentSection = String(headingMatch[1] || '').trim() || '长期偏好';
          return;
        }
        if (/^#\s+/.test(trimmed)) return;
        const content = trimmed.replace(/^-\s*/, '').trim();
        if (!content) return;
        const sectionTitle = currentSection || '长期偏好';
        const derivedStableKey = typeof api.deriveStableKeyForExplicitMemoryEntry === 'function'
          ? api.deriveStableKeyForExplicitMemoryEntry({
            scope: 'user',
            sectionTitle,
            content,
          })
          : '';
        let stableKey = derivedStableKey;
        if (/^用户名字[:：]/u.test(content)) stableKey = 'user:preferred-name';
        else if (/^默认称呼用户为[:：]/u.test(content)) stableKey = 'user:address-preference';
        entries.push({
          scope: 'user',
          sectionTitle,
          content,
          stableKey,
          source: 'settings-user-md',
        });
      });
      return entries;
    }

    function extractStableUserNameMemorySignal(text = '') {
      const clean = String(text || '').trim();
      if (!clean) return '';
      const patterns = [
        /(?:用户名字|用户称呼|名字|称呼)[:：]\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{1,24})/u,
        /(?:我叫|我的名字是|名字叫|昵称叫|以后叫我|你可以叫我)\s*[「“"'']?([A-Za-z0-9_\-\u4e00-\u9fa5]{1,24})/u,
      ];
      for (const pattern of patterns) {
        const matched = clean.match(pattern);
        if (matched?.[1]) return String(matched[1]).trim();
      }
      return '';
    }

    function extractStableUserAddressPreferenceSignal(text = '') {
      const clean = String(text || '').trim();
      if (!clean) return '';
      const patterns = [
        /默认称呼用户为[:：]\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{1,24})/u,
        /(?:以后叫我|你可以叫我|称呼我为|叫我)\s*[「“"'']?([A-Za-z0-9_\-\u4e00-\u9fa5]{1,24})/u,
      ];
      for (const pattern of patterns) {
        const matched = clean.match(pattern);
        if (matched?.[1]) return String(matched[1]).trim();
      }
      return '';
    }

    function buildLockedPreferredNameStableFact(entryId = '', preferredName = '', source = 'user-name') {
      const normalizedName = String(preferredName || '').trim();
      if (!normalizedName) return null;
      const baseId = String(entryId || 'user-name').trim() || 'user-name';
      return {
        id: `explicit:${baseId}:preferred-name`,
        category: 'explicit',
        key: 'user.preferred_name',
        label: '名字与称呼',
        fact: `用户名字：${normalizedName}`,
        source,
        confidence: 'confirmed',
        scope: 'identity',
        writeMode: 'explicit-user',
        stability: 'locked',
        alwaysInject: true,
        editable: true,
      };
    }

    function buildLockedAddressPreferenceStableFact(entryId = '', addressPreference = '', source = 'user-name') {
      const normalizedName = String(addressPreference || '').trim();
      if (!normalizedName) return null;
      const baseId = String(entryId || 'user-name').trim() || 'user-name';
      return {
        id: `explicit:${baseId}:address-preference`,
        category: 'explicit',
        key: 'user.address_preference',
        label: '默认称呼',
        fact: `默认称呼用户为：${normalizedName}`,
        source,
        confidence: 'confirmed',
        scope: 'identity',
        writeMode: 'explicit-user',
        stability: 'locked',
        alwaysInject: true,
        editable: true,
      };
    }

    function buildLockedNameStableFacts(entryId = '', preferredName = '', source = 'user-name') {
      const normalizedName = String(preferredName || '').trim();
      if (!normalizedName) return [];
      return [
        buildLockedPreferredNameStableFact(entryId, normalizedName, source),
        buildLockedAddressPreferenceStableFact(entryId, normalizedName, source),
      ].filter(Boolean);
    }

    function normalizeCoreMemoryLine(value = '', maxLength = 180) {
      return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    }

    function upsertCoreMemoryIdentity(coreMemory = {}, patch = {}) {
      const target = coreMemory && typeof coreMemory === 'object' ? coreMemory : {};
      const identity = target.identity && typeof target.identity === 'object' ? target.identity : {};
      const preferredName = normalizeCoreMemoryLine(patch.preferredName || identity.preferredName, 48);
      const addressPreference = normalizeCoreMemoryLine(patch.addressPreference || identity.addressPreference || preferredName, 48);
      target.identity = {
        ...identity,
        preferredName,
        addressPreference,
        updatedAt: String(patch.updatedAt || identity.updatedAt || new Date().toISOString()).trim(),
        source: String(patch.source || identity.source || 'stable-memory').trim() || 'stable-memory',
      };
      return target;
    }

    function extractCoreMemoryIdentityFromFacts(facts = []) {
      const activeFacts = (Array.isArray(facts) ? facts : [])
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter((fact) => fact && String(fact.status || 'active').trim() !== 'stale' && String(fact.status || 'active').trim() !== 'dismissed');
      const findByKey = (key) => activeFacts.find((fact) => String(fact?.key || '').trim() === key) || null;
      const preferredFact = findByKey('user.preferred_name')
        || activeFacts.find((fact) => String(fact?.scope || '').trim() === 'identity' && /用户名字|名字[:：]/.test(String(fact?.fact || ''))) || null;
      const addressFact = findByKey('user.address_preference')
        || activeFacts.find((fact) => String(fact?.scope || '').trim() === 'identity' && /默认称呼用户为|称呼[:：]/.test(String(fact?.fact || ''))) || null;
      const preferredName = extractStableUserNameMemorySignal(String(preferredFact?.fact || '').trim());
      const addressPreference = extractStableUserAddressPreferenceSignal(String(addressFact?.fact || '').trim())
        || extractStableUserNameMemorySignal(String(addressFact?.fact || '').trim())
        || String(addressFact?.fact || '').trim().match(/默认称呼用户为[:：]?\s*([A-Za-z0-9_\-\u4e00-\u9fa5]{1,24})/u)?.[1]
        || preferredName;
      return {
        preferredName: normalizeCoreMemoryLine(preferredName, 48),
        addressPreference: normalizeCoreMemoryLine(addressPreference, 48),
        source: preferredName ? 'stable-facts' : '',
      };
    }

    function buildCoreMemoryPacket(aiMemory = null, options = {}) {
      const safeMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : {};
      const longTermMemory = safeMemory.longTermMemory && typeof safeMemory.longTermMemory === 'object' ? safeMemory.longTermMemory : {};
      const coreMemory = safeMemory.coreMemory && typeof safeMemory.coreMemory === 'object' ? safeMemory.coreMemory : {};
      const existingIdentity = coreMemory.identity && typeof coreMemory.identity === 'object' ? coreMemory.identity : {};
      const factIdentity = extractCoreMemoryIdentityFromFacts(longTermMemory.facts);
      const userMarkdown = String(safeMemory.user || longTermMemory.user || '').trim();
      const markdownName = extractStableUserNameMemorySignal(userMarkdown);
      const preferredName = normalizeCoreMemoryLine(factIdentity.preferredName || existingIdentity.preferredName || markdownName, 48);
      const addressPreference = normalizeCoreMemoryLine(factIdentity.addressPreference || existingIdentity.addressPreference || preferredName, 48);
      const directiveFacts = (Array.isArray(longTermMemory.facts) ? longTermMemory.facts : [])
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter((fact) => {
          if (!fact || String(fact.status || 'active').trim() !== 'active') return false;
          if (fact.needsReconfirmation === true) return false;
          const scope = String(fact.scope || '').trim();
          const stability = String(fact.stability || '').trim();
          return fact.alwaysInject === true
            || stability === 'locked'
            || ['identity', 'address', 'boundary', 'communication', 'persona-surface'].includes(scope);
        })
        .map((fact) => {
          const label = normalizeCoreMemoryLine(fact.label || fact.key || '稳定记忆', 40);
          const text = normalizeCoreMemoryLine(fact.fact || '', 180);
          return text ? `${label}：${text}` : '';
        })
        .filter(Boolean);
      const identityLines = [];
      if (preferredName) identityLines.push(`用户名字：${preferredName}`);
      if (addressPreference) identityLines.push(`默认称呼用户为：${addressPreference}`);
      const directives = Array.from(new Set(identityLines.concat(directiveFacts))).slice(0, 12);
      const packet = {
        version: 1,
        source: String(existingIdentity.source || factIdentity.source || (markdownName ? 'user-md-mirror' : 'empty')).trim() || 'empty',
        identity: {
          preferredName,
          addressPreference,
        },
        directives,
        hardInject: directives.length > 0,
      };
      if (options && options.mutate === true) {
        safeMemory.coreMemory = upsertCoreMemoryIdentity(coreMemory, {
          preferredName,
          addressPreference,
          source: packet.source,
        });
      }
      return packet;
    }

    function describeResponseLengthPreference(value = '') {
      if (value === 'concise') return '默认尽量简洁，先说重点。';
      if (value === 'detailed') return '默认可以更详细，必要时展开解释。';
      return '默认保持平衡，够用就好。';
    }

    function describeStructureStylePreference(value = '') {
      if (value === 'natural') return '默认更自然，像在对话。';
      if (value === 'action-first') return '默认先给结论和下一步，再补解释。';
      return '默认适度结构化，便于快速扫读。';
    }

    function describeWarmthLevelPreference(value = '') {
      if (value === 'calm') return '默认更平静克制。';
      if (value === 'encouraging') return '默认更鼓励、更有陪伴感。';
      return '默认有温度，但不过头。';
    }

    function describePersonaSurfaceSupport(value = '') {
      if (value === 'clarify-first') return '更像澄清者';
      if (value === 'push-forward') return '更像推进器';
      if (value === 'protect-boundaries') return '更像边界守护者';
      return '更像稳定陪跑者';
    }

    function describePersonaSurfaceProactivity(value = '') {
      if (value === 'proactive') return '默认更主动';
      if (value === 'reserved') return '默认更克制';
      return '主动程度平衡';
    }

    function describePersonaSurfaceReminderTone(value = '') {
      if (value === 'direct') return '提醒时更直接';
      if (value === 'minimal') return '提醒时更克制';
      return '提醒时更温和';
    }

    function buildCommunicationStableFacts(expression = {}, options = {}) {
      const source = String(options.source || 'settings-behavior-expression').trim() || 'settings-behavior-expression';
      const customNote = String(expression.customNote || '').trim();
      const styleParts = [
        describeResponseLengthPreference(expression.responseLength),
        describeStructureStylePreference(expression.structureStyle),
        describeWarmthLevelPreference(expression.warmth),
      ];
      if (customNote) styleParts.push(`补充：${customNote}`);
      return [
        {
          id: 'stable:user-communication-style',
          category: 'explicit',
          key: 'user.communication.style',
          label: '默认说话方式',
          fact: styleParts.join('；'),
          source,
          confidence: 'confirmed',
          scope: 'communication',
          writeMode: 'settings',
          stability: 'stable',
          alwaysInject: true,
          editable: true,
        },
      ];
    }

    function buildPersonaSurfaceStableFact({
      expression = {},
      reminder = {},
      proactivity = {},
      longTerm = {},
    } = {}, options = {}) {
      const source = String(options.source || 'settings-persona-surface').trim() || 'settings-persona-surface';
      const noteParts = [
        String(longTerm.customNote || '').trim(),
        String(proactivity.customNote || '').trim(),
        String(reminder.customNote || '').trim(),
      ].filter(Boolean);
      const factParts = [
        `Morpheus 的外显人格${describePersonaSurfaceSupport(longTerm.supportStyle)}`,
        describePersonaSurfaceProactivity(proactivity.defaultMode),
        describePersonaSurfaceReminderTone(reminder.tone),
        describeWarmthLevelPreference(expression.warmth).replace(/^默认/, ''),
      ];
      if (noteParts.length) factParts.push(`补充：${noteParts.join('；')}`);
      return {
        id: 'stable:morpheus-persona-surface',
        category: 'explicit',
        key: 'morpheus.persona.surface',
        label: 'Morpheus 外显人格',
        fact: factParts.join('；'),
        source,
        confidence: 'confirmed',
        scope: 'persona-surface',
        writeMode: 'settings',
        stability: 'stable',
        alwaysInject: true,
        editable: true,
      };
    }

    function buildStablePreferenceFact({
      id = '',
      key = '',
      label = '',
      fact = '',
      scope = 'preference',
      source = 'settings',
      valueType = 'enum',
      value = '',
      alwaysInject = false,
    } = {}) {
      const factText = String(fact || '').trim();
      if (!id || !key || !factText) return null;
      return {
        id,
        category: 'explicit',
        key,
        label: label || key,
        fact: factText,
        source,
        confidence: 'confirmed',
        scope,
        writeMode: 'settings',
        stability: 'stable',
        alwaysInject: alwaysInject === true,
        editable: true,
        valueType: String(valueType || 'enum').trim() || 'enum',
        value,
      };
    }

    function buildStablePreferenceMirrorFacts({
      reminder = {},
      proactivity = {},
      boundary = {},
      longTerm = {},
      memory = {},
      planning = {},
      expression = {},
      focus = {},
      safety = {},
    } = {}) {
      const facts = [];
      const push = (entry) => {
        if (entry) facts.push(entry);
      };
      push(buildStablePreferenceFact({
        id: 'stable:user-relationship-reminder-tone',
        key: 'user.relationship.reminder.tone',
        label: '提醒语气',
        fact: reminder.tone === 'direct' ? '默认提醒更直接。' : reminder.tone === 'minimal' ? '默认提醒更克制。' : '默认提醒更温和。',
        scope: 'relationship',
        source: 'settings-relationship-reminders',
        value: reminder.tone,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-relationship-reminder-frequency',
        key: 'user.relationship.reminder.frequency',
        label: '提醒频率',
        fact: reminder.frequency === 'important-only' ? '默认只在重要时提醒。' : reminder.frequency === 'follow-up' ? '默认允许多追问一步。' : '默认提醒频率保持平衡。',
        scope: 'relationship',
        source: 'settings-relationship-reminders',
        value: reminder.frequency,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-relationship-reminder-low-state',
        key: 'user.relationship.reminder.low_state_strategy',
        label: '低状态提醒策略',
        fact: reminder.lowStateStrategy === 'hold-back' ? '状态不好时先克制。' : reminder.lowStateStrategy === 'stay-direct' ? '状态不好时保持直接但不带压迫。' : '状态不好时更温和。',
        scope: 'relationship',
        source: 'settings-relationship-reminders',
        value: reminder.lowStateStrategy,
        alwaysInject: true,
      }));
      if (String(reminder.customNote || '').trim()) {
        push(buildStablePreferenceFact({
          id: 'stable:user-relationship-reminder-note',
          key: 'user.relationship.reminder.note',
          label: '提醒补充说明',
          fact: `提醒补充说明：${String(reminder.customNote || '').trim()}`,
          scope: 'relationship',
          source: 'settings-relationship-reminders',
          valueType: 'text',
          value: String(reminder.customNote || '').trim(),
          alwaysInject: true,
        }));
      }

      push(buildStablePreferenceFact({
        id: 'stable:user-relationship-proactivity-mode',
        key: 'user.relationship.proactivity.mode',
        label: '主动程度',
        fact: proactivity.defaultMode === 'proactive' ? '默认更主动。' : proactivity.defaultMode === 'reserved' ? '默认更克制。' : '默认主动程度平衡。',
        scope: 'relationship',
        source: 'settings-relationship-proactivity',
        value: proactivity.defaultMode,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-relationship-proactivity-followup',
        key: 'user.relationship.proactivity.follow_up_style',
        label: '追问风格',
        fact: proactivity.followUpStyle === 'wait-more' ? '默认多等一下。' : proactivity.followUpStyle === 'only-when-stuck' ? '只在明显卡住时推进。' : '默认多问一句帮助推进。',
        scope: 'relationship',
        source: 'settings-relationship-proactivity',
        value: proactivity.followUpStyle,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-relationship-proactivity-interruption',
        key: 'user.relationship.proactivity.interruption_threshold',
        label: '打断阈值',
        fact: proactivity.interruptionThreshold === 'important-only' ? '只有明确重要时才打断。' : proactivity.interruptionThreshold === 'surface-early' ? '有苗头就早点提醒。' : '打断阈值保持平衡。',
        scope: 'relationship',
        source: 'settings-relationship-proactivity',
        value: proactivity.interruptionThreshold,
        alwaysInject: true,
      }));
      if (String(proactivity.customNote || '').trim()) {
        push(buildStablePreferenceFact({
          id: 'stable:user-relationship-proactivity-note',
          key: 'user.relationship.proactivity.note',
          label: '主动补充说明',
          fact: `主动补充说明：${String(proactivity.customNote || '').trim()}`,
          scope: 'relationship',
          source: 'settings-relationship-proactivity',
          valueType: 'text',
          value: String(proactivity.customNote || '').trim(),
          alwaysInject: true,
        }));
      }

      push(buildStablePreferenceFact({
        id: 'stable:user-boundary-money-decisions',
        key: 'user.relationship.boundary.money_decisions',
        label: '金钱决策边界',
        fact: boundary.moneyDecisions === 'suggest-only' ? '涉及钱时只给建议。' : boundary.moneyDecisions === 'can-draft' ? '涉及钱时可以先起草方案但不替用户拍板。' : '涉及钱时先问用户。',
        scope: 'boundary',
        source: 'settings-relationship-boundaries',
        value: boundary.moneyDecisions,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-boundary-public-speech',
        key: 'user.relationship.boundary.public_speech',
        label: '公开表达边界',
        fact: boundary.publicSpeech === 'never-send' ? '公开表达永远不代发。' : boundary.publicSpeech === 'ask-before-send' ? '公开表达先问再发。' : '公开表达只帮起草。',
        scope: 'boundary',
        source: 'settings-relationship-boundaries',
        value: boundary.publicSpeech,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-boundary-health-judgment',
        key: 'user.relationship.boundary.health_judgment',
        label: '健康判断边界',
        fact: boundary.healthJudgment === 'suggest-only' ? '健康判断只给建议。' : boundary.healthJudgment === 'ask-first' ? '健康判断先多问几句。' : '健康判断必须明确保守。',
        scope: 'boundary',
        source: 'settings-relationship-boundaries',
        value: boundary.healthJudgment,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-boundary-uncertainty-style',
        key: 'user.relationship.boundary.uncertainty_style',
        label: '不确定性表达边界',
        fact: boundary.uncertaintyStyle === 'offer-options' ? '不确定时给几个方向。' : boundary.uncertaintyStyle === 'pause-and-ask' ? '不确定时先停一下多问一句。' : '不确定时先说不确定。',
        scope: 'boundary',
        source: 'settings-relationship-boundaries',
        value: boundary.uncertaintyStyle,
        alwaysInject: true,
      }));
      if (String(boundary.customNote || '').trim()) {
        push(buildStablePreferenceFact({
          id: 'stable:user-boundary-note',
          key: 'user.relationship.boundary.note',
          label: '边界补充说明',
          fact: `边界补充说明：${String(boundary.customNote || '').trim()}`,
          scope: 'boundary',
          source: 'settings-relationship-boundaries',
          valueType: 'text',
          value: String(boundary.customNote || '').trim(),
          alwaysInject: true,
        }));
      }

      push(buildStablePreferenceFact({
        id: 'stable:user-long-term-focus-primary',
        key: 'user.relationship.long_term_focus.primary',
        label: '长期重点主轴',
        fact: longTerm.primaryFocus === 'steady-rhythm' ? '长期默认先看节律和持续性。' : longTerm.primaryFocus === 'project-delivery' ? '长期默认先看项目推进和交付。' : longTerm.primaryFocus === 'health-stability' ? '长期默认先看健康和状态稳定。' : '长期默认平衡兼顾几条主线。',
        scope: 'workflow',
        source: 'settings-relationship-long-term-focus',
        value: longTerm.primaryFocus,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-long-term-focus-support-style',
        key: 'user.relationship.long_term_focus.support_style',
        label: '长期支持姿态',
        fact: longTerm.supportStyle === 'clarify-first' ? '长期默认更像澄清者。' : longTerm.supportStyle === 'push-forward' ? '长期默认更像推进器。' : longTerm.supportStyle === 'protect-boundaries' ? '长期默认更像边界守护者。' : '长期默认更像稳定陪跑者。',
        scope: 'persona-surface',
        source: 'settings-relationship-long-term-focus',
        value: longTerm.supportStyle,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-long-term-focus-horizon',
        key: 'user.relationship.long_term_focus.horizon',
        label: '长期视野范围',
        fact: longTerm.horizon === 'this-week' ? '默认先看这周。' : longTerm.horizon === 'long-term' ? '默认更看重长期方向。' : '默认看这一阶段。',
        scope: 'workflow',
        source: 'settings-relationship-long-term-focus',
        value: longTerm.horizon,
        alwaysInject: true,
      }));
      if (String(longTerm.customNote || '').trim()) {
        push(buildStablePreferenceFact({
          id: 'stable:user-long-term-focus-note',
          key: 'user.relationship.long_term_focus.note',
          label: '长期重点补充说明',
          fact: `长期重点补充说明：${String(longTerm.customNote || '').trim()}`,
          scope: 'workflow',
          source: 'settings-relationship-long-term-focus',
          valueType: 'text',
          value: String(longTerm.customNote || '').trim(),
          alwaysInject: true,
        }));
      }

      push(buildStablePreferenceFact({
        id: 'stable:user-memory-capture-mode',
        key: 'user.memory.capture_mode',
        label: '默认怎么记',
        fact: memory.captureMode === 'important-only' ? '默认只记真正重要的内容。' : memory.captureMode === 'rich-context' ? '默认多保留一些上下文。' : '默认在重要性和完整性之间保持平衡。',
        scope: 'behavior',
        source: 'settings-habit-memory',
        value: memory.captureMode,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-memory-retention-mode',
        key: 'user.memory.retention_mode',
        label: '长期留什么',
        fact: memory.retentionMode === 'stable-preferences' ? '长期更优先留稳定偏好和边界。' : memory.retentionMode === 'project-threads' ? '长期更优先留项目线程和推进脉络。' : '长期更优先留关键决定和转折点。',
        scope: 'behavior',
        source: 'settings-habit-memory',
        value: memory.retentionMode,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-memory-recall-mode',
        key: 'user.memory.recall_mode',
        label: '召回优先级',
        fact: memory.recallMode === 'recent-first' ? '召回时先看最近变化。' : memory.recallMode === 'pattern-first' ? '召回时先看长期模式。' : '召回时先沿当前任务。',
        scope: 'behavior',
        source: 'settings-habit-memory',
        value: memory.recallMode,
      }));
      if (String(memory.customNote || '').trim()) {
        push(buildStablePreferenceFact({
          id: 'stable:user-memory-note',
          key: 'user.memory.note',
          label: '记忆补充说明',
          fact: `记忆补充说明：${String(memory.customNote || '').trim()}`,
          scope: 'behavior',
          source: 'settings-habit-memory',
          valueType: 'text',
          value: String(memory.customNote || '').trim(),
        }));
      }

      push(buildStablePreferenceFact({
        id: 'stable:user-workflow-planning-style',
        key: 'user.workflow.planning_style',
        label: '默认规划方式',
        fact: planning.planningStyle === 'direct-plan' ? '默认先给方案。' : planning.planningStyle === 'minimum-next-step' ? '默认先给最小下一步。' : '默认先澄清再规划。',
        scope: 'workflow',
        source: 'settings-habit-planning',
        value: planning.planningStyle,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-workflow-certainty-style',
        key: 'user.workflow.certainty_style',
        label: '判断边界',
        fact: planning.certaintyStyle === 'more-decisive' ? '判断可以更果断。' : planning.certaintyStyle === 'stay-conservative' ? '判断更保守，先说假设。' : '默认区分事实和建议。',
        scope: 'workflow',
        source: 'settings-habit-planning',
        value: planning.certaintyStyle,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-workflow-granularity',
        key: 'user.workflow.granularity',
        label: '规划颗粒度',
        fact: planning.granularity === 'time-blocks' ? '更偏时间块。' : planning.granularity === 'full-steps' ? '更偏完整步骤。' : '更偏前三件事。',
        scope: 'workflow',
        source: 'settings-habit-planning',
        value: planning.granularity,
        alwaysInject: true,
      }));
      if (String(planning.customNote || '').trim()) {
        push(buildStablePreferenceFact({
          id: 'stable:user-workflow-planning-note',
          key: 'user.workflow.planning_note',
          label: '规划补充说明',
          fact: `规划补充说明：${String(planning.customNote || '').trim()}`,
          scope: 'workflow',
          source: 'settings-habit-planning',
          valueType: 'text',
          value: String(planning.customNote || '').trim(),
          alwaysInject: true,
        }));
      }

      push(buildStablePreferenceFact({
        id: 'stable:user-response-length',
        key: 'user.communication.length',
        label: '默认回复长度',
        fact: describeResponseLengthPreference(expression.responseLength),
        scope: 'communication',
        source: 'settings-behavior-expression',
        value: expression.responseLength,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-structure-style',
        key: 'user.communication.structure',
        label: '默认组织方式',
        fact: describeStructureStylePreference(expression.structureStyle),
        scope: 'communication',
        source: 'settings-behavior-expression',
        value: expression.structureStyle,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-warmth-level',
        key: 'user.communication.warmth',
        label: '默认情绪温度',
        fact: describeWarmthLevelPreference(expression.warmth),
        scope: 'communication',
        source: 'settings-behavior-expression',
        value: expression.warmth,
        alwaysInject: true,
      }));
      if (String(expression.customNote || '').trim()) {
        push(buildStablePreferenceFact({
          id: 'stable:user-communication-note',
          key: 'user.communication.note',
          label: '说话方式补充说明',
          fact: `说话方式补充说明：${String(expression.customNote || '').trim()}`,
          scope: 'communication',
          source: 'settings-behavior-expression',
          valueType: 'text',
          value: String(expression.customNote || '').trim(),
          alwaysInject: true,
        }));
      }

      push(buildStablePreferenceFact({
        id: 'stable:user-focus-primary-attention',
        key: 'user.focus.primary_attention',
        label: '默认先盯哪里',
        fact: focus.primaryAttention === 'task-thread' ? '默认先沿当前任务主线。' : focus.primaryAttention === 'long-term-balance' ? '默认兼顾长期平衡。' : '默认先看当前上下文。',
        scope: 'workflow',
        source: 'settings-habit-focus',
        value: focus.primaryAttention,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-focus-retrieval-priority',
        key: 'user.focus.retrieval_priority',
        label: '召回时先看什么',
        fact: focus.retrievalPriority === 'recent-signals' ? '召回时先看最近信号。' : focus.retrievalPriority === 'stable-patterns' ? '召回时先看长期模式。' : '召回时先看活跃事项。',
        scope: 'workflow',
        source: 'settings-habit-focus',
        value: focus.retrievalPriority,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-focus-reminder-bias',
        key: 'user.focus.reminder_bias',
        label: '提醒偏置',
        fact: focus.reminderBias === 'deadline-first' ? '提醒时先看截止时间。' : focus.reminderBias === 'state-first' ? '提醒时先看状态和过载风险。' : '提醒时先看真正重要的事。',
        scope: 'workflow',
        source: 'settings-habit-focus',
        value: focus.reminderBias,
      }));
      if (String(focus.customNote || '').trim()) {
        push(buildStablePreferenceFact({
          id: 'stable:user-focus-note',
          key: 'user.focus.note',
          label: '关注重点补充说明',
          fact: `关注重点补充说明：${String(focus.customNote || '').trim()}`,
          scope: 'workflow',
          source: 'settings-habit-focus',
          valueType: 'text',
          value: String(focus.customNote || '').trim(),
        }));
      }

      push(buildStablePreferenceFact({
        id: 'stable:user-safety-data-write',
        key: 'user.safety.data_write_mode',
        label: '数据写入边界',
        fact: safety.dataWriteMode === 'double-check-high-risk' ? '高风险写入会再确认。' : safety.dataWriteMode === 'assistive-draft' ? '可以先起草但不直接执行。' : '只有明确要求时才执行写入。',
        scope: 'boundary',
        source: 'settings-habit-safety',
        value: safety.dataWriteMode,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-safety-self-update',
        key: 'user.safety.self_update_mode',
        label: '自我修改边界',
        fact: safety.selfUpdateMode === 'runtime-only' ? '只有明确要求时才允许改 runtime。' : safety.selfUpdateMode === 'off' ? '关闭自我修改，只做解释和建议。' : '默认只提升级方案，不自行修改。',
        scope: 'boundary',
        source: 'settings-habit-safety',
        value: safety.selfUpdateMode,
        alwaysInject: true,
      }));
      push(buildStablePreferenceFact({
        id: 'stable:user-safety-high-risk-advice',
        key: 'user.safety.high_risk_advice_mode',
        label: '高风险建议边界',
        fact: safety.highRiskAdviceMode === 'balanced' ? '可以给判断，但要保留边界。' : safety.highRiskAdviceMode === 'ask-for-context' ? '先补关键上下文，再进入建议。' : '默认严格保守，不把建议说成结论。',
        scope: 'boundary',
        source: 'settings-habit-safety',
        value: safety.highRiskAdviceMode,
        alwaysInject: true,
      }));
      if (String(safety.customNote || '').trim()) {
        push(buildStablePreferenceFact({
          id: 'stable:user-safety-note',
          key: 'user.safety.note',
          label: '安全边界补充说明',
          fact: `安全边界补充说明：${String(safety.customNote || '').trim()}`,
          scope: 'boundary',
          source: 'settings-habit-safety',
          valueType: 'text',
          value: String(safety.customNote || '').trim(),
          alwaysInject: true,
        }));
      }

      return facts;
    }

    function buildStablePreferenceFactValueMap(facts = []) {
      const map = new Map();
      (Array.isArray(facts) ? facts : [])
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter((fact) => fact && fact.status === 'active')
        .forEach((fact) => {
          const key = String(fact?.key || '').trim();
          if (!key || map.has(key)) return;
          map.set(key, fact);
        });
      return map;
    }

    function readStablePreferenceFactValue(valueMap = null, key = '', fallback = '') {
      const fact = valueMap instanceof Map ? valueMap.get(String(key || '').trim()) : null;
      if (!fact) return fallback;
      if (typeof fact.value === 'string' && String(fact.value || '').trim()) return String(fact.value || '').trim();
      return fallback;
    }

    function syncStablePreferenceMirrorsFromFacts(aiMemory = null, facts = []) {
      const safeMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : null;
      if (!safeMemory) return false;
      const valueMap = buildStablePreferenceFactValueMap(facts);
      if (!valueMap.size) return false;
      let changed = false;
      const ensureRelationshipMode = () => {
        if (!safeMemory.relationshipMode || typeof safeMemory.relationshipMode !== 'object') safeMemory.relationshipMode = {};
        return safeMemory.relationshipMode;
      };
      const ensureBehaviorHabits = () => {
        if (!safeMemory.behaviorHabits || typeof safeMemory.behaviorHabits !== 'object') safeMemory.behaviorHabits = {};
        return safeMemory.behaviorHabits;
      };
      const syncGroup = (targetObject, targetKey, sanitizeFn, nextValues, watchKeys = []) => {
        const hasSignal = watchKeys.some((key) => valueMap.has(key));
        if (!hasSignal || typeof sanitizeFn !== 'function') return;
        const current = targetObject[targetKey] && typeof targetObject[targetKey] === 'object' ? targetObject[targetKey] : {};
        const next = sanitizeFn({
          ...current,
          ...nextValues,
        }, current);
        const prevSerialized = JSON.stringify(current);
        const nextSerialized = JSON.stringify(next);
        if (prevSerialized !== nextSerialized) {
          targetObject[targetKey] = next;
          changed = true;
        }
      };

      const relationshipMode = ensureRelationshipMode();
      syncGroup(relationshipMode, 'reminderPreferences', api.sanitizeRelationshipReminderPreferences, {
        tone: readStablePreferenceFactValue(valueMap, 'user.relationship.reminder.tone', relationshipMode.reminderPreferences?.tone),
        frequency: readStablePreferenceFactValue(valueMap, 'user.relationship.reminder.frequency', relationshipMode.reminderPreferences?.frequency),
        lowStateStrategy: readStablePreferenceFactValue(valueMap, 'user.relationship.reminder.low_state_strategy', relationshipMode.reminderPreferences?.lowStateStrategy),
        customNote: readStablePreferenceFactValue(valueMap, 'user.relationship.reminder.note', relationshipMode.reminderPreferences?.customNote),
      }, [
        'user.relationship.reminder.tone',
        'user.relationship.reminder.frequency',
        'user.relationship.reminder.low_state_strategy',
        'user.relationship.reminder.note',
      ]);
      syncGroup(relationshipMode, 'proactivityPreferences', api.sanitizeRelationshipProactivityPreferences, {
        defaultMode: readStablePreferenceFactValue(valueMap, 'user.relationship.proactivity.mode', relationshipMode.proactivityPreferences?.defaultMode),
        followUpStyle: readStablePreferenceFactValue(valueMap, 'user.relationship.proactivity.follow_up_style', relationshipMode.proactivityPreferences?.followUpStyle),
        interruptionThreshold: readStablePreferenceFactValue(valueMap, 'user.relationship.proactivity.interruption_threshold', relationshipMode.proactivityPreferences?.interruptionThreshold),
        customNote: readStablePreferenceFactValue(valueMap, 'user.relationship.proactivity.note', relationshipMode.proactivityPreferences?.customNote),
      }, [
        'user.relationship.proactivity.mode',
        'user.relationship.proactivity.follow_up_style',
        'user.relationship.proactivity.interruption_threshold',
        'user.relationship.proactivity.note',
      ]);
      syncGroup(relationshipMode, 'boundaryPreferences', api.sanitizeRelationshipBoundaryPreferences, {
        moneyDecisions: readStablePreferenceFactValue(valueMap, 'user.relationship.boundary.money_decisions', relationshipMode.boundaryPreferences?.moneyDecisions),
        publicSpeech: readStablePreferenceFactValue(valueMap, 'user.relationship.boundary.public_speech', relationshipMode.boundaryPreferences?.publicSpeech),
        healthJudgment: readStablePreferenceFactValue(valueMap, 'user.relationship.boundary.health_judgment', relationshipMode.boundaryPreferences?.healthJudgment),
        uncertaintyStyle: readStablePreferenceFactValue(valueMap, 'user.relationship.boundary.uncertainty_style', relationshipMode.boundaryPreferences?.uncertaintyStyle),
        customNote: readStablePreferenceFactValue(valueMap, 'user.relationship.boundary.note', relationshipMode.boundaryPreferences?.customNote),
      }, [
        'user.relationship.boundary.money_decisions',
        'user.relationship.boundary.public_speech',
        'user.relationship.boundary.health_judgment',
        'user.relationship.boundary.uncertainty_style',
        'user.relationship.boundary.note',
      ]);
      syncGroup(relationshipMode, 'longTermFocusPreferences', api.sanitizeRelationshipLongTermFocusPreferences, {
        primaryFocus: readStablePreferenceFactValue(valueMap, 'user.relationship.long_term_focus.primary', relationshipMode.longTermFocusPreferences?.primaryFocus),
        supportStyle: readStablePreferenceFactValue(valueMap, 'user.relationship.long_term_focus.support_style', relationshipMode.longTermFocusPreferences?.supportStyle),
        horizon: readStablePreferenceFactValue(valueMap, 'user.relationship.long_term_focus.horizon', relationshipMode.longTermFocusPreferences?.horizon),
        customNote: readStablePreferenceFactValue(valueMap, 'user.relationship.long_term_focus.note', relationshipMode.longTermFocusPreferences?.customNote),
      }, [
        'user.relationship.long_term_focus.primary',
        'user.relationship.long_term_focus.support_style',
        'user.relationship.long_term_focus.horizon',
        'user.relationship.long_term_focus.note',
      ]);

      const behaviorHabits = ensureBehaviorHabits();
      syncGroup(behaviorHabits, 'memoryPreferences', api.sanitizeBehaviorMemoryPreferences, {
        captureMode: readStablePreferenceFactValue(valueMap, 'user.memory.capture_mode', behaviorHabits.memoryPreferences?.captureMode),
        retentionMode: readStablePreferenceFactValue(valueMap, 'user.memory.retention_mode', behaviorHabits.memoryPreferences?.retentionMode),
        recallMode: readStablePreferenceFactValue(valueMap, 'user.memory.recall_mode', behaviorHabits.memoryPreferences?.recallMode),
        customNote: readStablePreferenceFactValue(valueMap, 'user.memory.note', behaviorHabits.memoryPreferences?.customNote),
      }, [
        'user.memory.capture_mode',
        'user.memory.retention_mode',
        'user.memory.recall_mode',
        'user.memory.note',
      ]);
      syncGroup(behaviorHabits, 'planningPreferences', api.sanitizeBehaviorPlanningPreferences, {
        planningStyle: readStablePreferenceFactValue(valueMap, 'user.workflow.planning_style', behaviorHabits.planningPreferences?.planningStyle),
        certaintyStyle: readStablePreferenceFactValue(valueMap, 'user.workflow.certainty_style', behaviorHabits.planningPreferences?.certaintyStyle),
        granularity: readStablePreferenceFactValue(valueMap, 'user.workflow.granularity', behaviorHabits.planningPreferences?.granularity),
        customNote: readStablePreferenceFactValue(valueMap, 'user.workflow.planning_note', behaviorHabits.planningPreferences?.customNote),
      }, [
        'user.workflow.planning_style',
        'user.workflow.certainty_style',
        'user.workflow.granularity',
        'user.workflow.planning_note',
      ]);
      syncGroup(behaviorHabits, 'expressionPreferences', api.sanitizeBehaviorExpressionPreferences, {
        responseLength: readStablePreferenceFactValue(valueMap, 'user.communication.length', behaviorHabits.expressionPreferences?.responseLength),
        structureStyle: readStablePreferenceFactValue(valueMap, 'user.communication.structure', behaviorHabits.expressionPreferences?.structureStyle),
        warmth: readStablePreferenceFactValue(valueMap, 'user.communication.warmth', behaviorHabits.expressionPreferences?.warmth),
        customNote: readStablePreferenceFactValue(valueMap, 'user.communication.note', behaviorHabits.expressionPreferences?.customNote),
      }, [
        'user.communication.length',
        'user.communication.structure',
        'user.communication.warmth',
        'user.communication.note',
      ]);
      syncGroup(behaviorHabits, 'focusPreferences', api.sanitizeBehaviorFocusPreferences, {
        primaryAttention: readStablePreferenceFactValue(valueMap, 'user.focus.primary_attention', behaviorHabits.focusPreferences?.primaryAttention),
        retrievalPriority: readStablePreferenceFactValue(valueMap, 'user.focus.retrieval_priority', behaviorHabits.focusPreferences?.retrievalPriority),
        reminderBias: readStablePreferenceFactValue(valueMap, 'user.focus.reminder_bias', behaviorHabits.focusPreferences?.reminderBias),
        customNote: readStablePreferenceFactValue(valueMap, 'user.focus.note', behaviorHabits.focusPreferences?.customNote),
      }, [
        'user.focus.primary_attention',
        'user.focus.retrieval_priority',
        'user.focus.reminder_bias',
        'user.focus.note',
      ]);
      syncGroup(behaviorHabits, 'safetyPreferences', api.sanitizeBehaviorSafetyPreferences, {
        dataWriteMode: readStablePreferenceFactValue(valueMap, 'user.safety.data_write_mode', behaviorHabits.safetyPreferences?.dataWriteMode),
        selfUpdateMode: readStablePreferenceFactValue(valueMap, 'user.safety.self_update_mode', behaviorHabits.safetyPreferences?.selfUpdateMode),
        highRiskAdviceMode: readStablePreferenceFactValue(valueMap, 'user.safety.high_risk_advice_mode', behaviorHabits.safetyPreferences?.highRiskAdviceMode),
        customNote: readStablePreferenceFactValue(valueMap, 'user.safety.note', behaviorHabits.safetyPreferences?.customNote),
      }, [
        'user.safety.data_write_mode',
        'user.safety.self_update_mode',
        'user.safety.high_risk_advice_mode',
        'user.safety.note',
      ]);
      return changed;
    }

    function getLongTermFactLifecycleProfile(fact = null) {
      const safeFact = fact && typeof fact === 'object' ? fact : {};
      const category = String(safeFact.category || 'explicit').trim() || 'explicit';
      const source = String(safeFact.source || '').trim().toLowerCase();
      const stability = sanitizeStableMemoryStability(safeFact.stability);
      const alwaysInject = safeFact.alwaysInject === true;
      const taskHints = Array.isArray(safeFact.taskHints) ? safeFact.taskHints : [];
      const hasHint = (key) => taskHints.includes(key);
      if (source === 'settings' || source.startsWith('settings-') || stability === 'locked' || alwaysInject) {
        return {
          managedBySettings: true,
          reconfirmAfterDays: 0,
          hardStaleDays: 0,
        };
      }
      if (source === 'correction') {
        if (hasHint('health') || hasHint('money') || hasHint('public-expression')) {
          return {
            managedBySettings: false,
            reconfirmAfterDays: 21,
            hardStaleDays: 140,
          };
        }
        return {
          managedBySettings: false,
          reconfirmAfterDays: 30,
          hardStaleDays: 210,
        };
      }
      if (category === 'explicit') {
        if (hasHint('health') || hasHint('money') || hasHint('public-expression')) {
          return {
            managedBySettings: false,
            reconfirmAfterDays: 45,
            hardStaleDays: 180,
          };
        }
        if (hasHint('delivery')) {
          return {
            managedBySettings: false,
            reconfirmAfterDays: 50,
            hardStaleDays: 170,
          };
        }
        if (hasHint('rhythm')) {
          return {
            managedBySettings: false,
            reconfirmAfterDays: 60,
            hardStaleDays: 210,
          };
        }
        return {
          managedBySettings: false,
          reconfirmAfterDays: 60,
          hardStaleDays: 240,
        };
      }
      if (category === 'relationship') {
        if (hasHint('public-expression') || hasHint('money')) {
          return {
            managedBySettings: false,
            reconfirmAfterDays: 60,
            hardStaleDays: 220,
          };
        }
        return {
          managedBySettings: false,
          reconfirmAfterDays: 90,
          hardStaleDays: 320,
        };
      }
      if (category === 'behavior') {
        if (hasHint('rhythm') || hasHint('delivery')) {
          return {
            managedBySettings: false,
            reconfirmAfterDays: 90,
            hardStaleDays: 240,
          };
        }
        return {
          managedBySettings: false,
          reconfirmAfterDays: 120,
          hardStaleDays: 360,
        };
      }
      return {
        managedBySettings: false,
        reconfirmAfterDays: LONG_TERM_FACT_RECONFIRM_DAYS,
        hardStaleDays: LONG_TERM_FACT_HARD_STALE_DAYS,
      };
    }

    function degradeLongTermFactConfidence(confidence = 'medium') {
      const value = String(confidence || '').trim();
      if (value === 'confirmed') return 'high';
      if (value === 'high') return 'medium';
      if (value === 'medium') return 'low';
      return 'low';
    }

    function applyLongTermFactLifecycle(fact, now = new Date()) {
      const safeFact = typeof api.sanitizeLongTermMemoryFact === 'function'
        ? api.sanitizeLongTermMemoryFact(fact)
        : fact;
      if (!safeFact) return null;
      if (safeFact.status !== 'active') return safeFact;
      const profile = getLongTermFactLifecycleProfile(safeFact);
      if (profile.managedBySettings) {
        return typeof api.sanitizeLongTermMemoryFact === 'function'
          ? api.sanitizeLongTermMemoryFact({
            ...safeFact,
            reconfirmAfterDays: 0,
            needsReconfirmation: false,
            needsReconfirmationReason: '',
            staleAt: '',
          })
          : {
            ...safeFact,
            reconfirmAfterDays: 0,
            needsReconfirmation: false,
            needsReconfirmationReason: '',
            staleAt: '',
          };
      }
      const observedAtMs = Date.parse(String(safeFact.lastObservedAt || safeFact.lastConfirmedAt || ''));
      const nowMs = now instanceof Date ? now.getTime() : Date.now();
      const ageDays = Number.isFinite(observedAtMs) && observedAtMs > 0
        ? Math.max(0, (nowMs - observedAtMs) / (1000 * 60 * 60 * 24))
        : 0;
      const reconfirmAfterDays = Math.max(1, Number(profile.reconfirmAfterDays || LONG_TERM_FACT_RECONFIRM_DAYS));
      const hardStaleDays = Math.max(reconfirmAfterDays + 1, Number(profile.hardStaleDays || LONG_TERM_FACT_HARD_STALE_DAYS));
      const shouldReconfirm = ageDays >= reconfirmAfterDays;
      const shouldGoStale = ageDays >= hardStaleDays;
      const nextConfidence = shouldGoStale
        ? 'low'
        : shouldReconfirm
          ? degradeLongTermFactConfidence(safeFact.confidence)
          : safeFact.confidence;
      const reason = shouldGoStale
        ? '这条长期记忆已经太久没有被再次确认，应先视为过期线索。'
        : shouldReconfirm
          ? '这条长期记忆已经一段时间没有被再次确认，后续遇到相关话题时应轻量再确认。'
          : '';
      const nextFact = {
        ...safeFact,
        confidence: nextConfidence,
        status: shouldGoStale ? 'stale' : 'active',
        reconfirmAfterDays,
        needsReconfirmation: shouldReconfirm && !shouldGoStale,
        needsReconfirmationReason: reason,
        staleAt: shouldGoStale ? new Date(nowMs).toISOString() : '',
      };
      return typeof api.sanitizeLongTermMemoryFact === 'function'
        ? api.sanitizeLongTermMemoryFact(nextFact)
        : nextFact;
    }

    function buildStructuredLongTermFacts(aiMemory = null) {
      const safeMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : {};
      const longTermMemory = safeMemory.longTermMemory && typeof safeMemory.longTermMemory === 'object'
        ? safeMemory.longTermMemory
        : {};
      const relationshipMode = safeMemory.relationshipMode && typeof safeMemory.relationshipMode === 'object'
        ? safeMemory.relationshipMode
        : {};
      const behaviorHabits = safeMemory.behaviorHabits && typeof safeMemory.behaviorHabits === 'object'
        ? safeMemory.behaviorHabits
        : {};
      const now = new Date().toISOString();
      const nextFacts = [];
      const pushFact = ({ id, category, key, label, fact, source = 'settings', confidence = 'confirmed', editable = true, scope = '', writeMode = '', stability = '', alwaysInject = null, valueType = '', value = undefined }) => {
        const factText = String(fact || '').trim();
        if (!id || !factText) return;
        const metadata = inferStableMemoryMetadata({ category, scope, label, fact: factText, source });
        nextFacts.push({
          id,
          category,
          key: key || id,
          label: label || key || '长期记忆',
          fact: factText,
          source,
          confidence,
          lastConfirmedAt: now,
          lastObservedAt: now,
          status: 'active',
          timesConfirmed: 1,
          taskHints: deriveLongTermMemoryTaskHints({ category, key: key || id, label, fact: factText }),
          scope: sanitizeStableMemoryScope(metadata.scope || scope),
          writeMode: sanitizeStableMemoryWriteMode(writeMode || metadata.writeMode),
          stability: sanitizeStableMemoryStability(stability || metadata.stability),
          alwaysInject: typeof alwaysInject === 'boolean' ? alwaysInject : metadata.alwaysInject === true,
          editable,
          valueType: String(valueType || '').trim(),
          value,
        });
      };

      const reminder = typeof api.sanitizeRelationshipReminderPreferences === 'function'
        ? api.sanitizeRelationshipReminderPreferences(relationshipMode.reminderPreferences)
        : (relationshipMode.reminderPreferences || {});
      const proactivity = typeof api.sanitizeRelationshipProactivityPreferences === 'function'
        ? api.sanitizeRelationshipProactivityPreferences(relationshipMode.proactivityPreferences)
        : (relationshipMode.proactivityPreferences || {});
      const boundary = typeof api.sanitizeRelationshipBoundaryPreferences === 'function'
        ? api.sanitizeRelationshipBoundaryPreferences(relationshipMode.boundaryPreferences)
        : (relationshipMode.boundaryPreferences || {});
      const longTerm = typeof api.sanitizeRelationshipLongTermFocusPreferences === 'function'
        ? api.sanitizeRelationshipLongTermFocusPreferences(relationshipMode.longTermFocusPreferences)
        : (relationshipMode.longTermFocusPreferences || {});
      const memory = typeof api.sanitizeBehaviorMemoryPreferences === 'function'
        ? api.sanitizeBehaviorMemoryPreferences(behaviorHabits.memoryPreferences)
        : (behaviorHabits.memoryPreferences || {});
      const planning = typeof api.sanitizeBehaviorPlanningPreferences === 'function'
        ? api.sanitizeBehaviorPlanningPreferences(behaviorHabits.planningPreferences)
        : (behaviorHabits.planningPreferences || {});
      const expression = typeof api.sanitizeBehaviorExpressionPreferences === 'function'
        ? api.sanitizeBehaviorExpressionPreferences(behaviorHabits.expressionPreferences)
        : (behaviorHabits.expressionPreferences || {});
      const focus = typeof api.sanitizeBehaviorFocusPreferences === 'function'
        ? api.sanitizeBehaviorFocusPreferences(behaviorHabits.focusPreferences)
        : (behaviorHabits.focusPreferences || {});
      const safety = typeof api.sanitizeBehaviorSafetyPreferences === 'function'
        ? api.sanitizeBehaviorSafetyPreferences(behaviorHabits.safetyPreferences)
        : (behaviorHabits.safetyPreferences || {});

      pushFact({
        id: 'relationship:reminders',
        category: 'relationship',
        key: 'reminders',
        label: '提醒方式',
        fact: `${reminder.tone === 'direct' ? '更直接' : reminder.tone === 'minimal' ? '更克制' : '更温和'}；${reminder.frequency === 'important-only' ? '只在重要时提醒' : reminder.frequency === 'follow-up' ? '允许多追问一步' : '提醒频率平衡'}；${reminder.lowStateStrategy === 'hold-back' ? '状态不好时先克制' : reminder.lowStateStrategy === 'stay-direct' ? '状态不好时保持直接但别攻击' : '状态不好时更温和'}`,
      });
      pushFact({
        id: 'relationship:proactivity',
        category: 'relationship',
        key: 'proactivity',
        label: '主动程度',
        fact: `${proactivity.defaultMode === 'proactive' ? '默认更主动' : proactivity.defaultMode === 'reserved' ? '默认更克制' : '主动程度平衡'}；${proactivity.followUpStyle === 'wait-more' ? '默认多等一下' : proactivity.followUpStyle === 'only-when-stuck' ? '只在明显卡住时推进' : '默认多问一句帮助推进'}；${proactivity.interruptionThreshold === 'important-only' ? '只有明确重要时才打断' : proactivity.interruptionThreshold === 'surface-early' ? '有苗头就早点提醒' : '打断阈值平衡'}`,
      });
      pushFact({
        id: 'relationship:boundaries',
        category: 'relationship',
        key: 'boundaries',
        label: '决策边界',
        fact: `${boundary.moneyDecisions === 'suggest-only' ? '涉及钱时只给建议' : boundary.moneyDecisions === 'can-draft' ? '涉及钱时可以先起草方案但不替用户拍板' : '涉及钱时先问用户'}；${boundary.publicSpeech === 'never-send' ? '公开表达永远不代发' : boundary.publicSpeech === 'ask-before-send' ? '公开表达先问再发' : '公开表达只帮起草'}；${boundary.healthJudgment === 'suggest-only' ? '健康判断只给建议' : boundary.healthJudgment === 'ask-first' ? '健康判断先多问几句' : '健康判断必须明确保守'}；${boundary.uncertaintyStyle === 'offer-options' ? '不确定时给几个方向' : boundary.uncertaintyStyle === 'pause-and-ask' ? '不确定时先停一下多问一句' : '不确定时先说不确定'}`,
      });
      pushFact({
        id: 'relationship:long-term-focus',
        category: 'relationship',
        key: 'long-term-focus',
        label: '长期重点',
        fact: `${longTerm.primaryFocus === 'steady-rhythm' ? '更偏节律和持续性' : longTerm.primaryFocus === 'project-delivery' ? '更偏项目推进和交付' : longTerm.primaryFocus === 'health-stability' ? '更偏健康和状态稳定' : '几条主线平衡兼顾'}；${longTerm.supportStyle === 'clarify-first' ? '更像澄清者' : longTerm.supportStyle === 'push-forward' ? '更像推进器' : longTerm.supportStyle === 'protect-boundaries' ? '更像边界守护者' : '更像稳定陪跑者'}；${longTerm.horizon === 'this-week' ? '默认先看这周' : longTerm.horizon === 'long-term' ? '默认更看重长期方向' : '默认看这一阶段'}`,
      });
      pushFact({
        id: 'behavior:memory',
        category: 'behavior',
        key: 'memory',
        label: '记忆方式',
        fact: `${memory.captureMode === 'important-only' ? '偏只记重要变化' : memory.captureMode === 'rich-context' ? '偏多留上下文' : '在重要性和完整性之间平衡'}；${memory.retentionMode === 'stable-preferences' ? '长期保留稳定偏好和边界' : memory.retentionMode === 'project-threads' ? '长期保留项目线程和推进脉络' : '长期保留关键决定与转折点'}；${memory.recallMode === 'recent-first' ? '召回时先看最近变化' : memory.recallMode === 'pattern-first' ? '召回时先看长期模式' : '召回时先沿当前任务'}`,
      });
      pushFact({
        id: 'behavior:planning',
        category: 'behavior',
        key: 'planning',
        label: '规划与建议',
        fact: `${planning.planningStyle === 'direct-plan' ? '默认先给方案' : planning.planningStyle === 'minimum-next-step' ? '默认先给最小下一步' : '默认先澄清再规划'}；${planning.certaintyStyle === 'more-decisive' ? '判断更果断' : planning.certaintyStyle === 'stay-conservative' ? '判断更保守，先说假设' : '区分事实与建议'}；${planning.granularity === 'time-blocks' ? '更偏时间块' : planning.granularity === 'full-steps' ? '更偏完整步骤' : '更偏前三件事'}`,
      });
      pushFact({
        id: 'behavior:expression',
        category: 'behavior',
        key: 'expression',
        label: '表达风格',
        fact: `${expression.responseLength === 'concise' ? '回复偏简洁' : expression.responseLength === 'detailed' ? '回复偏详细' : '回复长度平衡'}；${expression.structureStyle === 'natural' ? '更自然对话' : expression.structureStyle === 'action-first' ? '优先结论和下一步' : '保持结构化'}；${expression.warmth === 'calm' ? '语气更平静' : expression.warmth === 'encouraging' ? '语气更鼓励' : '语气温度平衡'}`,
      });
      buildCommunicationStableFacts(expression).forEach((factEntry) => pushFact(factEntry));
      pushFact(buildPersonaSurfaceStableFact({
        expression,
        reminder,
        proactivity,
        longTerm,
      }));
      pushFact({
        id: 'behavior:focus',
        category: 'behavior',
        key: 'focus',
        label: '关注重点',
        fact: `${focus.primaryAttention === 'task-thread' ? '优先沿当前任务主线' : focus.primaryAttention === 'long-term-balance' ? '优先兼顾长期平衡' : '优先参考当前上下文'}；${focus.retrievalPriority === 'recent-signals' ? '召回时先看最近信号' : focus.retrievalPriority === 'stable-patterns' ? '召回时先看长期模式' : '召回时先看活跃事项'}；${focus.reminderBias === 'deadline-first' ? '提醒时先看截止时间' : focus.reminderBias === 'state-first' ? '提醒时先看状态和过载风险' : '提醒时先看真正重要的事'}`,
      });
      pushFact({
        id: 'behavior:safety',
        category: 'behavior',
        key: 'safety',
        label: '安全边界',
        fact: `${safety.dataWriteMode === 'double-check-high-risk' ? '高风险写入会再确认' : safety.dataWriteMode === 'assistive-draft' ? '可以先起草但不直接执行' : '只在明确要求时写入'}；${safety.selfUpdateMode === 'off' ? '默认不自我修改' : safety.selfUpdateMode === 'runtime-only' ? '只在明确要求时改 runtime' : '默认只提升级方案'}；${safety.highRiskAdviceMode === 'balanced' ? '高风险建议保留边界' : safety.highRiskAdviceMode === 'ask-for-context' ? '高风险建议先补关键上下文' : '高风险建议默认严格保守'}`,
      });
      buildStablePreferenceMirrorFacts({
        reminder,
        proactivity,
        boundary,
        longTerm,
        memory,
        planning,
        expression,
        focus,
        safety,
      }).forEach((factEntry) => pushFact(factEntry));

      const explicitEntries = typeof api.normalizeExplicitMemoryLogEntries === 'function'
        ? api.normalizeExplicitMemoryLogEntries(Array.isArray(longTermMemory.explicitMemoryLog) ? longTermMemory.explicitMemoryLog : [])
        : (Array.isArray(longTermMemory.explicitMemoryLog) ? longTermMemory.explicitMemoryLog : []);
      const explicitStableKeys = new Set(explicitEntries.map((entry) => String(entry?.stableKey || '').trim()).filter(Boolean));
      explicitEntries.forEach((entry, index) => {
        const safeEntry = entry && typeof entry === 'object' ? entry : {};
        const entryId = String(safeEntry.id || '').trim() || `explicit:${index}`;
        const label = String(safeEntry.sectionTitle || safeEntry.title || '明确记忆').trim() || '明确记忆';
        const fact = String(safeEntry.content || safeEntry.summary || '').trim();
        if (!fact) return;
        const stableKey = (typeof api.deriveStableKeyForExplicitMemoryEntry === 'function'
          ? api.deriveStableKeyForExplicitMemoryEntry(safeEntry)
          : '')
          || (typeof api.buildExplicitMemorySectionStableKey === 'function'
            ? api.buildExplicitMemorySectionStableKey(String(safeEntry.scope || 'user').trim() || 'user', label, `entry-${index + 1}`)
            : label);
        const preferredName = extractStableUserNameMemorySignal(fact);
        const addressPreference = extractStableUserAddressPreferenceSignal(fact);
        if (stableKey === 'user:preferred-name' && preferredName) {
          pushFact(buildLockedPreferredNameStableFact(entryId, preferredName, String(safeEntry.source || 'user-name').trim() || 'user-name'));
          return;
        }
        if (stableKey === 'user:address-preference' && addressPreference) {
          pushFact(buildLockedAddressPreferenceStableFact(entryId, addressPreference, String(safeEntry.source || 'user-name').trim() || 'user-name'));
          return;
        }
        if (stableKey === 'user:name-and-address' && (preferredName || addressPreference)) {
          const source = String(safeEntry.source || 'user-name').trim() || 'user-name';
          const isUserDocumentMirror = source === 'settings-user-md' || source === 'user-md-migration';
          if (addressPreference) {
            pushFact(buildLockedAddressPreferenceStableFact(entryId, addressPreference, source));
          } else if (preferredName && isUserDocumentMirror && /用户名字[:：]/u.test(fact)) {
            pushFact(buildLockedPreferredNameStableFact(entryId, preferredName, source));
          } else if (preferredName) {
            buildLockedNameStableFacts(entryId, preferredName, source).forEach((factEntry) => pushFact(factEntry));
          }
          return;
        }
        pushFact({
          id: `explicit:${entryId}`,
          category: 'explicit',
          key: stableKey,
          label,
          fact,
          source: String(safeEntry.source || 'manual').trim() || 'manual',
          confidence: 'confirmed',
          scope: String(safeEntry.scope || 'user').trim() || 'user',
          writeMode: String(safeEntry.writeMode || '').trim(),
          stability: String(safeEntry.stability || '').trim(),
          alwaysInject: typeof safeEntry.alwaysInject === 'boolean' ? safeEntry.alwaysInject : null,
          editable: true,
        });
      });

      const userMarkdownEntries = extractStableUserMemoryEntriesFromMarkdown(String(safeMemory.user || longTermMemory.user || ''));
      if (!explicitStableKeys.has('user:name-and-address')) {
        const nameEntry = userMarkdownEntries.find((entry) => {
          const content = String(entry?.content || '').trim();
          return String(entry?.stableKey || '').trim() === 'user:name-and-address'
            || /名字|称呼|name/i.test(String(entry?.sectionTitle || '').trim())
            || !!extractStableUserNameMemorySignal(content);
        });
        const preferredName = extractStableUserNameMemorySignal(String(nameEntry?.content || '').trim());
        if (nameEntry && preferredName) {
          buildLockedNameStableFacts('user-name-migrated', preferredName, 'user-md-migration')
            .forEach((factEntry) => pushFact(factEntry));
        }
      }

      return nextFacts
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter(Boolean);
    }

    function mergeStructuredLongTermFacts(existingFacts, generatedFacts, existingArchive) {
      const activeFacts = (Array.isArray(existingFacts) ? existingFacts : [])
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter((fact) => fact && fact.status === 'active');
      const archiveFacts = (Array.isArray(existingArchive) ? existingArchive : [])
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter(Boolean);
      const nextGenerated = (Array.isArray(generatedFacts) ? generatedFacts : [])
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter(Boolean);
      const now = new Date().toISOString();
      const nextActive = [];
      const nextArchive = archiveFacts.slice();
      const seenLookup = new Set();
      const activeByLookup = new Map(activeFacts.map((fact) => [api.buildLongTermFactLookupKey(fact), fact]));

      nextGenerated.forEach((fact) => {
        const lookupKey = api.buildLongTermFactLookupKey(fact);
        const previous = activeByLookup.get(lookupKey);
        const archivedPrevious = !previous
          ? (api.findLatestArchivedFactForLookup(archiveFacts, lookupKey)
            || api.findLatestArchivedFactForVersionGroup(archiveFacts, api.deriveLongTermFactVersionGroupCandidate(fact)))
          : null;
        const nextFingerprint = api.buildLongTermFactFingerprint(fact);
        const prevFingerprint = previous ? api.buildLongTermFactFingerprint(previous) : '';
        const base = previous || {};
        if (previous && prevFingerprint !== nextFingerprint) {
          nextArchive.push(api.sanitizeLongTermMemoryFact({
            ...previous,
            status: 'superseded',
            supersededBy: fact.id,
            archivedAt: now,
          }));
        }
        nextActive.push(api.sanitizeLongTermMemoryFact({
          ...base,
          ...fact,
          status: 'active',
          timesConfirmed: previous && prevFingerprint === nextFingerprint
            ? Math.max(1, Number(previous.timesConfirmed || 1))
            : 1,
          versionGroup: String((previous && previous.versionGroup) || (archivedPrevious && archivedPrevious.versionGroup) || fact.versionGroup || api.deriveLongTermFactVersionGroupCandidate(fact) || lookupKey),
          supersedes: previous && prevFingerprint !== nextFingerprint
            ? previous.id
            : (!previous && archivedPrevious ? archivedPrevious.id : String(fact.supersedes || '').trim()),
          lastConfirmedAt: previous && prevFingerprint === nextFingerprint
            ? String(previous.lastConfirmedAt || fact.lastConfirmedAt || now)
            : String(fact.lastConfirmedAt || now),
          lastObservedAt: previous && prevFingerprint === nextFingerprint && String(fact.source || '').trim().toLowerCase() !== 'settings'
            ? String(previous.lastObservedAt || previous.lastConfirmedAt || fact.lastObservedAt || fact.lastConfirmedAt || now)
            : String(fact.lastObservedAt || now),
          taskHints: fact.taskHints && fact.taskHints.length
            ? fact.taskHints
            : deriveLongTermMemoryTaskHints(fact),
        }));
        seenLookup.add(lookupKey);
      });

      activeFacts.forEach((fact) => {
        const lookupKey = api.buildLongTermFactLookupKey(fact);
        if (seenLookup.has(lookupKey)) return;
        nextArchive.push(api.sanitizeLongTermMemoryFact({
          ...fact,
          status: fact.category === 'explicit' ? 'dismissed' : 'stale',
          archivedAt: now,
        }));
      });

      const dedupeArchive = new Map();
      nextArchive.filter(Boolean).forEach((fact) => {
        const archiveKey = `${api.buildLongTermFactLookupKey(fact)}::${api.buildLongTermFactFingerprint(fact)}::${fact.status}`;
        dedupeArchive.set(archiveKey, fact);
      });

      return {
        facts: nextActive.map(api.sanitizeLongTermMemoryFact).filter(Boolean).slice(0, LONG_TERM_FACT_MAX),
        factArchive: Array.from(dedupeArchive.values())
          .map(api.sanitizeLongTermMemoryFact)
          .filter(Boolean)
          .sort((a, b) => String(b.archivedAt || b.lastObservedAt || '').localeCompare(String(a.archivedAt || a.lastObservedAt || '')))
          .slice(0, LONG_TERM_FACT_ARCHIVE_MAX),
      };
    }

    function getMorphLongTermFactRecencyScore(fact = null) {
      const safeFact = fact && typeof fact === 'object' ? fact : {};
      const candidates = [
        safeFact.lastConfirmedAt,
        safeFact.lastObservedAt,
        safeFact.updatedAt,
        safeFact.createdAt,
        safeFact.at,
        safeFact.archivedAt,
        safeFact.staleAt,
      ];
      for (const value of candidates) {
        const parsed = Date.parse(String(value || '').trim());
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    }

    function resolveActiveLongTermFactVersionGroupCollisions(facts = [], factArchive = []) {
      const activeFacts = (Array.isArray(facts) ? facts : [])
        .map(api.sanitizeLongTermMemoryFact)
        .filter((fact) => fact && fact.status === 'active');
      const nextArchive = (Array.isArray(factArchive) ? factArchive : [])
        .map(api.sanitizeLongTermMemoryFact)
        .filter(Boolean);
      const grouped = new Map();
      const passthroughFacts = [];
      activeFacts.forEach((fact, index) => {
        const group = String(fact?.versionGroup || '').trim();
        if (!group) {
          passthroughFacts.push(fact);
          return;
        }
        const bucket = grouped.get(group) || [];
        bucket.push({ fact, index });
        grouped.set(group, bucket);
      });
      const now = new Date().toISOString();
      const dedupedFacts = passthroughFacts.slice();
      grouped.forEach((entries) => {
        if (!entries.length) return;
        if (entries.length === 1) {
          dedupedFacts.push(entries[0].fact);
          return;
        }
        const ranked = entries.slice().sort((a, b) => {
          const delta = getMorphLongTermFactRecencyScore(b.fact) - getMorphLongTermFactRecencyScore(a.fact);
          if (delta !== 0) return delta;
          return a.index - b.index;
        });
        const winner = ranked[0].fact;
        dedupedFacts.push(winner);
        ranked.slice(1).forEach(({ fact }) => {
          nextArchive.push(api.sanitizeLongTermMemoryFact({
            ...fact,
            status: 'superseded',
            supersededBy: String(winner?.id || '').trim(),
            archivedAt: now,
          }));
        });
      });
      return {
        facts: dedupedFacts.map(api.sanitizeLongTermMemoryFact).filter(Boolean).slice(0, LONG_TERM_FACT_MAX),
        factArchive: nextArchive
          .map(api.sanitizeLongTermMemoryFact)
          .filter(Boolean)
          .slice(0, LONG_TERM_FACT_ARCHIVE_MAX),
      };
    }

    function normalizeStableMemoryCurrentValueKey(fact = null) {
      const safeFact = fact && typeof fact === 'object' ? fact : {};
      const key = String(safeFact.key || safeFact.id || '').trim().toLowerCase();
      const scope = sanitizeStableMemoryScope(safeFact.scope || '', '');
      const label = String(safeFact.label || '').trim().toLowerCase();
      if (key === 'user.preferred_name' || key === 'user.address_preference') return key;
      if (scope === 'identity' && /名字|称呼|name/.test(label)) return key || 'user.preferred_name';
      return key || `${scope || 'user'}:${label || 'memory'}`;
    }

    function buildVisibleStableFactLines(facts = [], options = {}) {
      const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Number(options.limit)) : 24;
      const activeFacts = (Array.isArray(facts) ? facts : [])
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter((fact) => fact && String(fact.status || 'active').trim() === 'active' && isStableMemoryFactCandidate(fact));
      const rankedByKey = new Map();
      activeFacts.forEach((fact) => {
        const currentValueKey = normalizeStableMemoryCurrentValueKey(fact);
        const previous = rankedByKey.get(currentValueKey);
        if (!previous || rankStableMemoryFactCandidate(fact) >= rankStableMemoryFactCandidate(previous)) {
          rankedByKey.set(currentValueKey, fact);
        }
      });
      return Array.from(rankedByKey.values())
        .sort((left, right) => rankStableMemoryFactCandidate(right) - rankStableMemoryFactCandidate(left))
        .slice(0, limit)
        .map((fact) => {
          const label = normalizeCoreMemoryLine(fact.label || fact.key || '记忆', 40);
          const text = normalizeCoreMemoryLine(fact.fact || '', 220);
          if (!text) return '';
          return text.startsWith(`${label}：`) || text.startsWith(`${label}:`)
            ? `- ${text}`
            : `- ${label}：${text}`;
        })
        .filter(Boolean);
    }

    function buildVisibleUserMemoryMarkdown(aiMemory = null) {
      const safeMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : {};
      const longTermMemory = safeMemory.longTermMemory && typeof safeMemory.longTermMemory === 'object' ? safeMemory.longTermMemory : {};
      const facts = Array.isArray(longTermMemory.facts) ? longTermMemory.facts : [];
      const corePacket = buildCoreMemoryPacket(safeMemory, { mutate: true });
      const preferredName = normalizeCoreMemoryLine(corePacket?.identity?.preferredName || '', 48);
      const addressPreference = normalizeCoreMemoryLine(corePacket?.identity?.addressPreference || preferredName, 48);
      const stableLines = buildVisibleStableFactLines(facts, { limit: 24 })
        .filter((line) => !/^- (?:名字与称呼|默认称呼|用户\.preferred_name|user\.preferred_name|user\.address_preference)/i.test(line));
      const lines = ['# USER.md', ''];
      lines.push('## 身份', '');
      if (preferredName) lines.push(`- 用户名字：${preferredName}`);
      if (addressPreference) lines.push(`- 默认称呼用户为：${addressPreference}`);
      if (!preferredName && !addressPreference) lines.push('- 暂未设置稳定名字。');
      lines.push('', '## 记住了什么', '');
      lines.push(...(stableLines.length ? stableLines : ['- 暂无其他稳定记忆。']));
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function buildVisibleMemoryIndexMarkdown(aiMemory = null) {
      const safeMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : {};
      const longTermMemory = safeMemory.longTermMemory && typeof safeMemory.longTermMemory === 'object' ? safeMemory.longTermMemory : {};
      const facts = Array.isArray(longTermMemory.facts) ? longTermMemory.facts : [];
      const archive = Array.isArray(longTermMemory.factArchive) ? longTermMemory.factArchive : [];
      const lines = ['# MEMORY.md', '', '## 当前长期记忆', ''];
      lines.push(...(buildVisibleStableFactLines(facts, { limit: 32 }).length ? buildVisibleStableFactLines(facts, { limit: 32 }) : ['- 暂无结构化长期事实。']));
      lines.push('', '## 历史与候选', '');
      lines.push(archive.length ? `- 已保留 ${archive.length} 条历史版本，用于追溯，不作为当前记忆注入。` : '- 暂无历史版本。');
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function refreshVisibleStableMemoryFiles(aiMemory = null) {
      const safeMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : null;
      if (!safeMemory) return;
      if (!safeMemory.longTermMemory || typeof safeMemory.longTermMemory !== 'object') safeMemory.longTermMemory = {};
      safeMemory.user = buildVisibleUserMemoryMarkdown(safeMemory);
      safeMemory.memoryIndex = buildVisibleMemoryIndexMarkdown(safeMemory);
      safeMemory.longTermMemory.user = safeMemory.user;
      safeMemory.longTermMemory.memoryIndex = safeMemory.memoryIndex;
      if (typeof api.refreshDurableVisibleMemoryFiles === 'function') api.refreshDurableVisibleMemoryFiles(safeMemory);
    }

    function cloneJSON(value = null) {
      if (!value || typeof value !== 'object') return value;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_) {
        return null;
      }
    }

    function isStableMemoryFactCandidate(fact = null) {
      const safeFact = fact && typeof fact === 'object' ? fact : null;
      if (!safeFact) return false;
      const status = String(safeFact.status || 'active').trim().toLowerCase() || 'active';
      if (status && status !== 'active' && status !== 'confirmed') return false;
      const scope = sanitizeStableMemoryScope(safeFact.scope || '', '');
      const writeMode = sanitizeStableMemoryWriteMode(safeFact.writeMode || '', '');
      const stability = sanitizeStableMemoryStability(safeFact.stability || '', '');
      return safeFact.alwaysInject === true
        || stability === 'locked'
        || stability === 'stable'
        || writeMode === 'explicit-user'
        || writeMode === 'settings'
        || writeMode === 'correction'
        || ['identity', 'address', 'communication', 'boundary', 'relationship', 'workflow', 'persona-surface', 'behavior', 'preference', 'style'].includes(scope);
    }

    function rankStableMemoryFactCandidate(fact = null) {
      const safeFact = fact && typeof fact === 'object' ? fact : {};
      const stability = sanitizeStableMemoryStability(safeFact.stability || '', '');
      const writeMode = sanitizeStableMemoryWriteMode(safeFact.writeMode || '', '');
      let score = getMorphLongTermFactRecencyScore(safeFact);
      if (safeFact.alwaysInject === true) score += 1_000_000_000;
      if (stability === 'locked') score += 900_000_000;
      else if (stability === 'stable') score += 600_000_000;
      if (writeMode === 'explicit-user') score += 300_000_000;
      else if (writeMode === 'correction') score += 200_000_000;
      else if (writeMode === 'settings') score += 100_000_000;
      return score;
    }

    function isCanonicalIdentityStableFact(fact = null) {
      const key = String(fact?.key || '').trim();
      return key === 'user.preferred_name' || key === 'user.address_preference';
    }

    function looksLikeSupersededIdentityNoiseFact(fact = null) {
      const safeFact = fact && typeof fact === 'object' ? fact : {};
      if (!safeFact || isCanonicalIdentityStableFact(safeFact)) return false;
      const text = normalizeCoreMemoryLine(safeFact.fact || '', 120);
      if (!text) return false;
      if (/^(?:用户名字|默认称呼用户为)[:：]/u.test(text)) return false;
      const key = String(safeFact.key || '').trim();
      const label = String(safeFact.label || '').trim();
      const scope = sanitizeStableMemoryScope(safeFact.scope || '', '');
      const inUserMemoryBucket = scope === 'user'
        || scope === 'preference'
        || /^user[:.-]/i.test(key)
        || /(?:长期偏好|general|preference|名字|称呼|name)/i.test(label);
      if (!inUserMemoryBucket) return false;
      return /(?:我叫什么|我的名字是[？?]?|还记得我是谁|关于我你知道些什么|什么名字|没名字|我是谁吗)/u.test(text);
    }

    function archiveSupersededIdentityNoiseFacts(facts = [], archive = []) {
      const activeFacts = (Array.isArray(facts) ? facts : [])
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter(Boolean);
      const identityWinner = activeFacts
        .filter((fact) => isCanonicalIdentityStableFact(fact) && String(fact.status || 'active').trim() === 'active')
        .sort((left, right) => rankStableMemoryFactCandidate(right) - rankStableMemoryFactCandidate(left))[0] || null;
      if (!identityWinner) return { facts: activeFacts, factArchive: Array.isArray(archive) ? archive : [] };
      const now = new Date().toISOString();
      const nextFacts = [];
      const nextArchive = Array.isArray(archive) ? archive.slice() : [];
      activeFacts.forEach((fact) => {
        if (!looksLikeSupersededIdentityNoiseFact(fact)) {
          nextFacts.push(fact);
          return;
        }
        nextArchive.push(api.sanitizeLongTermMemoryFact({
          ...fact,
          status: 'dismissed',
          supersededBy: String(identityWinner.id || identityWinner.key || '').trim(),
          archivedAt: now,
          archiveReason: 'covered-by-locked-identity',
        }));
      });
      return {
        facts: nextFacts,
        factArchive: nextArchive.slice(0, LONG_TERM_FACT_ARCHIVE_MAX),
      };
    }

    function normalizeStableMemoryFactCollection(facts = []) {
      return (Array.isArray(facts) ? facts : [])
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter((fact) => fact && isStableMemoryFactCandidate(fact));
    }

    function mergeStableMemoryFactCollections(authoritativeFacts = [], selectedFacts = []) {
      const authoritative = normalizeStableMemoryFactCollection(authoritativeFacts);
      const selected = normalizeStableMemoryFactCollection(selectedFacts);
      const nextByLookup = new Map();
      authoritative.forEach((fact) => {
        nextByLookup.set(api.buildLongTermFactLookupKey(fact), fact);
      });
      selected.forEach((fact) => {
        const lookupKey = api.buildLongTermFactLookupKey(fact);
        const previous = nextByLookup.get(lookupKey);
        if (!previous || rankStableMemoryFactCandidate(fact) >= rankStableMemoryFactCandidate(previous)) {
          nextByLookup.set(lookupKey, fact);
        }
      });
      return Array.from(nextByLookup.values())
        .map((fact) => (typeof api.sanitizeLongTermMemoryFact === 'function' ? api.sanitizeLongTermMemoryFact(fact) : fact))
        .filter(Boolean)
        .sort((left, right) => rankStableMemoryFactCandidate(right) - rankStableMemoryFactCandidate(left))
        .slice(0, LONG_TERM_FACT_MAX);
    }

    function buildBootStableMemorySummary(summary = {}) {
      return {
        status: String(summary.status || '').trim(),
        reason: String(summary.reason || '').trim(),
        source: String(summary.source || '').trim(),
        sourceDetail: String(summary.sourceDetail || '').trim(),
        stableFactCount: Number(summary.stableFactCount || 0) || 0,
        authoritativeStableFactCount: Number(summary.authoritativeStableFactCount || 0) || 0,
        recoveryStableFactCount: Number(summary.recoveryStableFactCount || 0) || 0,
      };
    }

    function reconcileStableMemoryAfterBootSelection(options = {}) {
      const selectedSnapshot = options?.selectedSnapshot && typeof options.selectedSnapshot === 'object'
        ? options.selectedSnapshot
        : null;
      const selectedSource = String(options?.selectedSource || '').trim();
      const authoritativeSnapshot = options?.authoritativeSnapshot && typeof options.authoritativeSnapshot === 'object'
        ? options.authoritativeSnapshot
        : null;
      const authoritativeSource = String(options?.authoritativeSource || '').trim();
      if (!selectedSnapshot || selectedSource !== 'recovery') {
        lastBootStableMemorySummary = buildBootStableMemorySummary({
          status: 'skipped',
          reason: selectedSnapshot ? 'selected-source-not-recovery' : 'missing-selected-snapshot',
          source: selectedSource,
          stableFactCount: normalizeStableMemoryFactCollection(selectedSnapshot?.aiMemory?.longTermMemory?.facts).length,
        });
        return selectedSnapshot;
      }
      const authoritativeStableFacts = normalizeStableMemoryFactCollection(authoritativeSnapshot?.aiMemory?.longTermMemory?.facts);
      const recoveryStableFacts = normalizeStableMemoryFactCollection(selectedSnapshot?.aiMemory?.longTermMemory?.facts);
      if (!authoritativeStableFacts.length) {
        lastBootStableMemorySummary = buildBootStableMemorySummary({
          status: 'skipped',
          reason: 'missing-authoritative-stable-memory',
          source: selectedSource,
          sourceDetail: authoritativeSource,
          stableFactCount: recoveryStableFacts.length,
          authoritativeStableFactCount: 0,
          recoveryStableFactCount: recoveryStableFacts.length,
        });
        return selectedSnapshot;
      }
      const mergedFacts = mergeStableMemoryFactCollections(authoritativeStableFacts, recoveryStableFacts);
      const mergedFingerprint = JSON.stringify(mergedFacts.map((fact) => `${api.buildLongTermFactLookupKey(fact)}::${api.buildLongTermFactFingerprint(fact)}`));
      const recoveryFingerprint = JSON.stringify(recoveryStableFacts.map((fact) => `${api.buildLongTermFactLookupKey(fact)}::${api.buildLongTermFactFingerprint(fact)}`));
      if (mergedFingerprint === recoveryFingerprint) {
        lastBootStableMemorySummary = buildBootStableMemorySummary({
          status: 'skipped',
          reason: 'recovery-stable-memory-already-rich-enough',
          source: selectedSource,
          sourceDetail: authoritativeSource,
          stableFactCount: recoveryStableFacts.length,
          authoritativeStableFactCount: authoritativeStableFacts.length,
          recoveryStableFactCount: recoveryStableFacts.length,
        });
        return selectedSnapshot;
      }

      const reconciledSnapshot = cloneJSON(selectedSnapshot);
      if (!reconciledSnapshot || typeof reconciledSnapshot !== 'object') {
        lastBootStableMemorySummary = buildBootStableMemorySummary({
          status: 'skipped',
          reason: 'clone-failed',
          source: selectedSource,
          sourceDetail: authoritativeSource,
        });
        return selectedSnapshot;
      }
      if (!reconciledSnapshot.aiMemory || typeof reconciledSnapshot.aiMemory !== 'object') reconciledSnapshot.aiMemory = {};
      if (!reconciledSnapshot.aiMemory.longTermMemory || typeof reconciledSnapshot.aiMemory.longTermMemory !== 'object') {
        reconciledSnapshot.aiMemory.longTermMemory = {};
      }
      reconciledSnapshot.aiMemory.longTermMemory.facts = mergedFacts;
      if (!String(reconciledSnapshot.aiMemory.user || '').trim() && String(authoritativeSnapshot?.aiMemory?.user || '').trim()) {
        reconciledSnapshot.aiMemory.user = String(authoritativeSnapshot.aiMemory.user || '').trim();
      }
      if (!String(reconciledSnapshot.aiMemory.longTermMemory.user || '').trim() && String(authoritativeSnapshot?.aiMemory?.longTermMemory?.user || '').trim()) {
        reconciledSnapshot.aiMemory.longTermMemory.user = String(authoritativeSnapshot.aiMemory.longTermMemory.user || '').trim();
      }
      syncStablePreferenceMirrorsFromFacts(reconciledSnapshot.aiMemory, reconciledSnapshot.aiMemory.longTermMemory.facts);
      if (typeof api.refreshDurableVisibleMemoryFiles === 'function') api.refreshDurableVisibleMemoryFiles(reconciledSnapshot.aiMemory);
      lastBootStableMemorySummary = buildBootStableMemorySummary({
        status: 'applied',
        reason: 'recovery-kept-current-authoritative-restored-stable-memory',
        source: selectedSource,
        sourceDetail: authoritativeSource,
        stableFactCount: mergedFacts.length,
        authoritativeStableFactCount: authoritativeStableFacts.length,
        recoveryStableFactCount: recoveryStableFacts.length,
      });
      return reconciledSnapshot;
    }

    function getLastBootStableMemorySummary() {
      return lastBootStableMemorySummary && typeof lastBootStableMemorySummary === 'object'
        ? cloneJSON(lastBootStableMemorySummary) || lastBootStableMemorySummary
        : null;
    }

    function syncStructuredLongTermFacts(aiMemory = null) {
      const safeMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : null;
      if (!safeMemory) return [];
      if (!safeMemory.longTermMemory || typeof safeMemory.longTermMemory !== 'object') safeMemory.longTermMemory = {};
      syncStablePreferenceMirrorsFromFacts(safeMemory, safeMemory.longTermMemory.facts);
      const merged = mergeStructuredLongTermFacts(
        safeMemory.longTermMemory.facts,
        buildStructuredLongTermFacts(safeMemory),
        safeMemory.longTermMemory.factArchive
      );
      const repaired = resolveActiveLongTermFactVersionGroupCollisions(merged.facts, merged.factArchive);
      const identityPruned = archiveSupersededIdentityNoiseFacts(repaired.facts, repaired.factArchive);
      safeMemory.longTermMemory.facts = identityPruned.facts
        .map((fact) => applyLongTermFactLifecycle(fact))
        .filter(Boolean);
      syncStablePreferenceMirrorsFromFacts(safeMemory, safeMemory.longTermMemory.facts);
      safeMemory.longTermMemory.factArchive = identityPruned.factArchive;
      refreshVisibleStableMemoryFiles(safeMemory);
      return safeMemory.longTermMemory.facts;
    }

    function upsertUserScopedExplicitMemoryEntry(aiMemory = null, entry = null) {
      const safeMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : null;
      const safeEntry = entry && typeof entry === 'object' ? entry : {};
      if (!safeMemory) return null;
      if (!safeMemory.longTermMemory || typeof safeMemory.longTermMemory !== 'object') safeMemory.longTermMemory = {};
      const content = String(safeEntry.content || '').trim();
      if (!content) return null;
      const nextEntry = {
        id: String(safeEntry.id || '').trim() || `explicit:${Date.now()}`,
        at: String(safeEntry.at || new Date().toISOString()).trim() || new Date().toISOString(),
        scope: sanitizeStableMemoryScope(safeEntry.scope || 'user'),
        sectionTitle: String(safeEntry.sectionTitle || '长期偏好').trim() || '长期偏好',
        stableKey: String(safeEntry.stableKey || '').trim(),
        content,
        source: String(safeEntry.source || 'manual').trim() || 'manual',
        writeMode: sanitizeStableMemoryWriteMode(safeEntry.writeMode || inferStableMemoryMetadata(safeEntry).writeMode),
        stability: sanitizeStableMemoryStability(safeEntry.stability || inferStableMemoryMetadata(safeEntry).stability),
        alwaysInject: safeEntry.alwaysInject === true || inferStableMemoryMetadata(safeEntry).alwaysInject === true,
      };
      const explicitEntries = typeof api.normalizeExplicitMemoryLogEntries === 'function'
        ? api.normalizeExplicitMemoryLogEntries(Array.isArray(safeMemory.longTermMemory.explicitMemoryLog) ? safeMemory.longTermMemory.explicitMemoryLog : [])
        : (Array.isArray(safeMemory.longTermMemory.explicitMemoryLog) ? safeMemory.longTermMemory.explicitMemoryLog : []);
      const filtered = explicitEntries.filter((item) => {
        if (sanitizeStableMemoryScope(item?.scope || 'user') !== nextEntry.scope) return true;
        const itemStableKey = String(item?.stableKey || '').trim();
        if (nextEntry.stableKey && itemStableKey) return itemStableKey !== nextEntry.stableKey;
        return String(item?.sectionTitle || '').trim() !== nextEntry.sectionTitle;
      });
      filtered.unshift(nextEntry);
      safeMemory.longTermMemory.explicitMemoryLog = typeof api.normalizeExplicitMemoryLogEntries === 'function'
        ? api.normalizeExplicitMemoryLogEntries(filtered)
        : filtered;
      safeMemory.explicitMemoryLog = safeMemory.longTermMemory.explicitMemoryLog.slice();
      return nextEntry;
    }

    function writeStableUserMemoryEntry(entry = null, aiMemory = null, options = {}) {
      const safeEntry = entry && typeof entry === 'object' ? entry : {};
      const safeMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : null;
      if (!safeMemory) return { changed: false, blocked: false };
      const sectionTitle = String(safeEntry.sectionTitle || '长期偏好').trim() || '长期偏好';
      const content = String(safeEntry.content || safeEntry.text || '').trim();
      const source = String(options?.source || safeEntry.source || 'memory_write_user').trim() || 'memory_write_user';
      if (!content) return { changed: false, blocked: false };
      if (looksLikeBlockedStableMemoryWrite(sectionTitle, content)) {
        return {
          changed: false,
          blocked: true,
          constitution: getMorpheusCoreConstitution(),
        };
      }
      const baseMarkdown = String(safeMemory.user || '').trim() || (typeof api.buildDefaultAIUserMarkdown === 'function' ? String(api.buildDefaultAIUserMarkdown() || '') : '');
      const nextMarkdown = typeof api.appendToMarkdownSection === 'function'
        ? api.appendToMarkdownSection(baseMarkdown, sectionTitle, content, {
          buildDefaultMarkdown: api.buildDefaultAIUserMarkdown,
        })
        : baseMarkdown;
      safeMemory.user = nextMarkdown;
      if (safeMemory.longTermMemory && typeof safeMemory.longTermMemory === 'object') safeMemory.longTermMemory.user = nextMarkdown;
      const metadata = inferStableMemoryMetadata({
        category: 'explicit',
        scope: safeEntry.scope || 'user',
        label: sectionTitle,
        fact: content,
        source,
      });
      const preferredName = extractStableUserNameMemorySignal(content);
      if (preferredName) {
        safeMemory.coreMemory = upsertCoreMemoryIdentity(safeMemory.coreMemory, {
          preferredName,
          addressPreference: preferredName,
          source,
        });
      }
      if (typeof api.recordExplicitMemoryLogEntry === 'function') {
        api.recordExplicitMemoryLogEntry({
          aiMemory: safeMemory,
          scope: safeEntry.scope || 'user',
          sectionTitle,
          stableKey: String(safeEntry.stableKey || '').trim(),
          content,
          source,
          candidateType: 'stable-preference',
          writeTier: 'long-term-active',
          label: sectionTitle,
          summary: `更新了稳定记忆：${sectionTitle}`,
        });
      } else {
        upsertUserScopedExplicitMemoryEntry(safeMemory, {
          ...safeEntry,
          sectionTitle,
          content,
          source,
          scope: safeEntry.scope || metadata.scope,
          writeMode: metadata.writeMode,
          stability: metadata.stability,
          alwaysInject: metadata.alwaysInject,
        });
        syncStructuredLongTermFacts(safeMemory);
      }
      refreshVisibleStableMemoryFiles(safeMemory);
      return {
        changed: true,
        blocked: false,
        targetFile: 'user.md',
        sectionTitle,
      };
    }

    function replaceStableUserMemoryDocument(markdown = '', aiMemory = null, options = {}) {
      const safeMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : null;
      if (!safeMemory) return { changed: false, blocked: false };
      const nextMarkdown = String(markdown || '').trim() || (typeof api.buildDefaultAIUserMarkdown === 'function' ? String(api.buildDefaultAIUserMarkdown() || '') : '');
      const extractedEntries = extractStableUserMemoryEntriesFromMarkdown(nextMarkdown);
      if (extractedEntries.some((entry) => looksLikeBlockedStableMemoryWrite(entry.sectionTitle, entry.content))) {
        return {
          changed: false,
          blocked: true,
          constitution: getMorpheusCoreConstitution(),
        };
      }
      safeMemory.user = nextMarkdown;
      if (!safeMemory.longTermMemory || typeof safeMemory.longTermMemory !== 'object') safeMemory.longTermMemory = {};
      safeMemory.longTermMemory.user = nextMarkdown;
      const existing = typeof api.normalizeExplicitMemoryLogEntries === 'function'
        ? api.normalizeExplicitMemoryLogEntries(Array.isArray(safeMemory.longTermMemory.explicitMemoryLog) ? safeMemory.longTermMemory.explicitMemoryLog : [])
        : (Array.isArray(safeMemory.longTermMemory.explicitMemoryLog) ? safeMemory.longTermMemory.explicitMemoryLog : []);
      const preserved = existing.filter((entry) => sanitizeStableMemoryScope(entry?.scope || 'user') !== 'user');
      const userEntries = extractedEntries.map((entry, index) => {
        const metadata = inferStableMemoryMetadata({
          category: 'explicit',
          scope: 'user',
          label: entry.sectionTitle,
          fact: entry.content,
          source: options?.source || 'settings-user-md',
        });
        return {
          id: `explicit:user-doc:${index + 1}`,
          at: new Date().toISOString(),
          scope: 'user',
          sectionTitle: entry.sectionTitle,
          stableKey: entry.stableKey || '',
          content: entry.content,
          source: String(options?.source || 'settings-user-md').trim() || 'settings-user-md',
          writeMode: metadata.writeMode,
          stability: metadata.stability,
          alwaysInject: metadata.alwaysInject,
        };
      });
      const nextExplicitEntries = preserved.concat(userEntries);
      safeMemory.longTermMemory.explicitMemoryLog = typeof api.normalizeExplicitMemoryLogEntries === 'function'
        ? api.normalizeExplicitMemoryLogEntries(nextExplicitEntries)
        : nextExplicitEntries;
      safeMemory.explicitMemoryLog = safeMemory.longTermMemory.explicitMemoryLog.slice();
      syncStructuredLongTermFacts(safeMemory);
      buildCoreMemoryPacket(safeMemory, { mutate: true });
      refreshVisibleStableMemoryFiles(safeMemory);
      return {
        changed: true,
        blocked: false,
        targetFile: 'user.md',
        replacedEntries: userEntries.length,
      };
    }

    return {
      deriveLongTermMemoryTaskHints,
      sanitizeStableMemoryScope,
      sanitizeStableMemoryWriteMode,
      sanitizeStableMemoryStability,
      getMorpheusCoreConstitution,
      inferStableMemoryMetadata,
      extractStableUserMemoryEntriesFromMarkdown,
      looksLikeBlockedStableMemoryWrite,
      getLongTermFactLifecycleProfile,
      degradeLongTermFactConfidence,
      applyLongTermFactLifecycle,
      buildStructuredLongTermFacts,
      buildCoreMemoryPacket,
      buildVisibleUserMemoryMarkdown,
      buildVisibleMemoryIndexMarkdown,
      refreshVisibleStableMemoryFiles,
      buildStablePreferenceMirrorFacts,
      mergeStructuredLongTermFacts,
      getMorphLongTermFactRecencyScore,
      resolveActiveLongTermFactVersionGroupCollisions,
      syncStablePreferenceMirrorsFromFacts,
      syncStructuredLongTermFacts,
      reconcileStableMemoryAfterBootSelection,
      getLastBootStableMemorySummary,
      writeStableUserMemoryEntry,
      replaceStableUserMemoryDocument,
    };
  }

  window.MorphMemoryFactsRuntime = { create: createMemoryFactsRuntime };
})();
