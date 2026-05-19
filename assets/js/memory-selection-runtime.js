(function initMorphMemorySelectionRuntime() {
  function createMemorySelectionRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const LONG_TERM_FACT_STALE_DAYS = Number.isFinite(Number(api.LONG_TERM_FACT_STALE_DAYS))
      ? Math.max(1, Number(api.LONG_TERM_FACT_STALE_DAYS))
      : 180;

    function sanitizeFact(fact = null) {
      return typeof api.sanitizeLongTermMemoryFact === 'function'
        ? api.sanitizeLongTermMemoryFact(fact)
        : fact;
    }

    function inferLongTermMemoryRecallProfile(question = '', focus = null) {
      const focusState = focus && typeof focus === 'object' ? focus : {};
      const text = [
        String(question || ''),
        String(focusState.currentTaskState?.summary || ''),
        String(focusState.currentTaskState?.lastUserIntent || ''),
        String(focusState.currentWorkflowState?.type || ''),
        String(focusState.tab || ''),
      ].join('\n').toLowerCase();
      const hints = new Set(['memory']);
      const add = (...items) => items.forEach((item) => item && hints.add(item));
      if (/(规划|安排|计划|下一步|任务|项目|推进|plan|schedule|time block|时间块)/.test(text)) add('planning', 'execution');
      if (/(血糖|健康|身体|症状|运动|睡眠|health|glucose)/.test(text)) add('health');
      if (/(写|发布|发送|脚本|文案|标题|表达|publish|writing|post)/.test(text)) add('writing');
      if (/(公开|对外|发布|发出去|发送|邮件|消息|微博|推文|朋友圈|post|publish|send)/.test(text)) add('public-expression');
      if (/(钱|费用|预算|报价|花费|买|购买|投资|定价|付款|budget|price|pricing|cost)/.test(text)) add('money');
      if (/(节律|作息|稳定|恢复|过载|休息|rhythm|recovery|pace)/.test(text)) add('rhythm');
      if (/(交付|上线|发布|里程碑|deadline|ship|delivery|launch)/.test(text)) add('delivery');
      if (/(提醒|边界|主动|关系|相处|长期|陪伴|决策)/.test(text)) add('relationship', 'reflection');
      if (/(回顾|复盘|总结|偏好|习惯|记住|记忆|memory|recall)/.test(text)) add('reflection');
      return Array.from(hints);
    }

    function inferLongTermMemorySelectionPolicy(question = '', focus = null, options = {}) {
      const purpose = String(options?.purpose || 'general').trim().toLowerCase() || 'general';
      const focusState = focus && typeof focus === 'object' ? focus : {};
      const text = [
        String(question || ''),
        String(focusState.currentTaskState?.summary || ''),
        String(focusState.currentTaskState?.lastUserIntent || ''),
        String(focusState.currentWorkflowState?.type || ''),
        String(focusState.tab || ''),
      ].join('\n').toLowerCase();
      const recallProfile = inferLongTermMemoryRecallProfile(question, focus);
      const highRisk = /(钱|费用|预算|报价|花费|买|购买|投资|定价|付款|健康|身体|血糖|症状|药|生病|不舒服|医疗|医生|发出去|发送|公开|发布|对外|朋友圈|微博|推文|邮件|消息)/.test(text)
        || recallProfile.includes('health')
        || recallProfile.includes('writing');
      const plannerLike = purpose === 'planner';
      const promptLike = purpose === 'prompt';
      const replyLike = purpose === 'reply';
      const proactiveLike = purpose === 'proactive' || purpose === 'digest' || purpose === 'heartbeat';
      const reconfirmLike = purpose === 'reconfirm';
      const decisionLike = plannerLike || promptLike || replyLike;
      const heartbeatLike = purpose === 'heartbeat';
      const selfMemoryAdjustments = typeof api.deriveSelfMemorySelectionPolicyAdjustments === 'function'
        ? api.deriveSelfMemorySelectionPolicyAdjustments(options?.selfMemory || null, question, focus, { purpose })
        : {};
      const minimumReferenceStrength = proactiveLike
        ? heartbeatLike
          ? 'cautious'
          : 'weak'
        : replyLike && highRisk
          ? 'strong'
          : decisionLike && highRisk
            ? 'supported'
            : replyLike
              ? 'supported'
              : decisionLike
                ? 'cautious'
                : 'weak';
      let ambiguityGap = replyLike && highRisk
        ? 1.8
        : highRisk
          ? 1.45
          : decisionLike
            ? 1.05
            : 0.7;
      let minimumSelectionConfidence = heartbeatLike
        ? 'cautious'
        : replyLike && highRisk
          ? 'supported'
          : plannerLike && highRisk
            ? 'cautious'
            : replyLike
              ? 'cautious'
              : plannerLike
                ? 'cautious'
                : 'weak';
      let resolvedMinimumReferenceStrength = minimumReferenceStrength;
      if (String(selfMemoryAdjustments.minimumReferenceStrength || '').trim()) {
        resolvedMinimumReferenceStrength = String(selfMemoryAdjustments.minimumReferenceStrength).trim();
      }
      if (String(selfMemoryAdjustments.minimumSelectionConfidence || '').trim()) {
        minimumSelectionConfidence = String(selfMemoryAdjustments.minimumSelectionConfidence).trim();
      }
      ambiguityGap += Number(selfMemoryAdjustments.ambiguityGapDelta || 0);
      return {
        purpose,
        recallProfile,
        highRisk,
        allowNeedsReconfirmation: proactiveLike || reconfirmLike,
        needsReconfirmationPenalty: (proactiveLike ? (heartbeatLike ? 0.65 : 0.25) : decisionLike ? (highRisk ? (replyLike ? 3.8 : 3.2) : replyLike ? 2.3 : 1.9) : 0.7) + Number(selfMemoryAdjustments.needsReconfirmationPenaltyDelta || 0),
        lowConfidencePenalty: (decisionLike ? (highRisk ? (replyLike ? 2.8 : 2.4) : replyLike ? 1.6 : 1.2) : 0.5) + Number(selfMemoryAdjustments.lowConfidencePenaltyDelta || 0),
        mediumConfidencePenalty: decisionLike && highRisk ? (replyLike ? 1.05 : 0.8) : 0,
        stalePenaltyMultiplier: proactiveLike ? (heartbeatLike ? 0.9 : 0.6) : decisionLike && highRisk ? (replyLike ? 1.9 : 1.6) : 1,
        minimumReferenceStrength: resolvedMinimumReferenceStrength,
        minimumSelectionConfidence,
        ambiguityGap,
        freshnessHalfLifeDays: Math.max(7, (proactiveLike ? 150 : replyLike ? 60 : promptLike ? 75 : plannerLike ? 90 : 120) + Number(selfMemoryAdjustments.freshnessHalfLifeDaysDelta || 0)),
        preferLatestConfirmedVersion: decisionLike || heartbeatLike,
        sameTopicVersionPriorityGap: (replyLike && highRisk ? 1.4 : highRisk ? 1.1 : decisionLike ? 0.8 : 0.55) + Number(selfMemoryAdjustments.sameTopicVersionPriorityGapDelta || 0),
      };
    }

    function getLongTermMemorySelectionConfidenceRank(confidence = 'weak') {
      const value = String(confidence || '').trim().toLowerCase();
      if (value === 'strong') return 3;
      if (value === 'supported') return 2;
      if (value === 'cautious') return 1;
      return 0;
    }

    function getLongTermFactSourcePriority(source = '') {
      const value = String(source || '').trim().toLowerCase();
      if (!value) return 2;
      if (value === 'correction') return 5;
      if (value === 'settings') return 4;
      if (value === 'manual' || value === 'user') return 4;
      if (value === 'import' || value === 'daily-log') return 3;
      if (value === 'derived' || value === 'inferred') return 2;
      if (value === 'model') return 1;
      return 2;
    }

    function buildArchivedLongTermFactMap(archiveFacts = []) {
      return new Map(
        (Array.isArray(archiveFacts) ? archiveFacts : [])
          .map(sanitizeFact)
          .filter(Boolean)
          .map((fact) => [fact.id, fact])
      );
    }

    function deriveLongTermFactReferenceStrength(fact, archiveFacts = [], selectionPolicy = null) {
      const safeFact = sanitizeFact(fact);
      if (!safeFact || safeFact.status !== 'active') return 'weak';
      const safePolicy = selectionPolicy && typeof selectionPolicy === 'object'
        ? selectionPolicy
        : inferLongTermMemorySelectionPolicy('', null, {});
      if (safeFact.needsReconfirmation) return safePolicy.allowNeedsReconfirmation ? 'cautious' : 'weak';
      if (safeFact.confidence === 'low') return 'weak';
      if (safeFact.confidence === 'medium') return safePolicy.highRisk ? 'cautious' : 'supported';
      const archivedById = buildArchivedLongTermFactMap(archiveFacts);
      const previous = safeFact.supersedes ? archivedById.get(String(safeFact.supersedes || '').trim()) : null;
      if (previous?.status === 'dismissed') return 'strong';
      if (previous?.status === 'stale') return 'supported';
      return safeFact.confidence === 'confirmed' ? 'strong' : 'supported';
    }

    function getLongTermFactReferenceStrengthRank(strength = 'weak') {
      const value = String(strength || '').trim().toLowerCase();
      if (value === 'strong') return 3;
      if (value === 'supported') return 2;
      if (value === 'cautious') return 1;
      return 0;
    }

    function buildLongTermFactGroupKey(fact) {
      const safeFact = sanitizeFact(fact);
      if (!safeFact) return '';
      const lookupKey = typeof api.buildLongTermFactLookupKey === 'function'
        ? api.buildLongTermFactLookupKey(safeFact)
        : safeFact.id;
      return String(safeFact.versionGroup || lookupKey || safeFact.id || '').trim().toLowerCase();
    }

    function scoreLongTermFactFreshness(fact, selectionPolicy = null) {
      const safeFact = sanitizeFact(fact);
      if (!safeFact) return 0;
      const safePolicy = selectionPolicy && typeof selectionPolicy === 'object'
        ? selectionPolicy
        : inferLongTermMemorySelectionPolicy('', null, {});
      const freshnessAt = Date.parse(String(safeFact.lastConfirmedAt || safeFact.lastObservedAt || ''));
      if (!Number.isFinite(freshnessAt) || freshnessAt <= 0) return 0;
      const ageDays = Math.max(0, (Date.now() - freshnessAt) / (1000 * 60 * 60 * 24));
      const halfLife = Math.max(7, Number(safePolicy.freshnessHalfLifeDays || 90));
      const freshnessScore = Math.max(0, 1 - (ageDays / halfLife));
      const confirmationBoost = Math.min(1.2, Math.max(0, Number(safeFact.timesConfirmed || 1) - 1) * 0.12);
      return freshnessScore + confirmationBoost;
    }

    function scoreLongTermFactVersionPriority(fact, archiveFacts = [], selectionPolicy = null) {
      const safeFact = sanitizeFact(fact);
      if (!safeFact) return 0;
      const safePolicy = selectionPolicy && typeof selectionPolicy === 'object'
        ? selectionPolicy
        : inferLongTermMemorySelectionPolicy('', null, {});
      const archivedById = buildArchivedLongTermFactMap(archiveFacts);
      const previous = safeFact.supersedes ? archivedById.get(String(safeFact.supersedes || '').trim()) : null;
      let score = 0;
      if (safeFact.confidence === 'confirmed') score += 1.4;
      else if (safeFact.confidence === 'high') score += 0.85;
      else if (safeFact.confidence === 'medium') score += 0.3;
      score += Math.min(0.9, Math.max(0, Number(safeFact.timesConfirmed || 1) - 1) * 0.16);
      score += scoreLongTermFactFreshness(safeFact, safePolicy) * 0.55;
      if (safeFact.supersedes) score += previous?.status === 'dismissed' ? 1.1 : previous?.status === 'superseded' ? 0.65 : 0.35;
      if (safeFact.needsReconfirmation) score -= safePolicy.highRisk ? 1.2 : 0.6;
      if (safeFact.status === 'stale') score -= 1.2;
      return score;
    }

    function deriveLongTermMemorySelectionConfidence(entry, selectionPolicy = null) {
      const safePolicy = selectionPolicy && typeof selectionPolicy === 'object'
        ? selectionPolicy
        : inferLongTermMemorySelectionPolicy('', null, {});
      if (!entry || typeof entry !== 'object') return 'weak';
      if (entry.ambiguous) return 'cautious';
      const effectiveGap = Math.max(Number(entry.scoreGap || 0), Number(entry.currentVersionGap || 0));
      if (entry.referenceStrengthRank >= 3 && effectiveGap >= Number(safePolicy.ambiguityGap || 0.8) * 1.45) return 'strong';
      if (entry.referenceStrengthRank >= 2 && effectiveGap >= Number(safePolicy.ambiguityGap || 0.8)) return 'supported';
      if (entry.referenceStrengthRank >= 1) return 'cautious';
      return 'weak';
    }

    function scoreLongTermMemoryFactRelevance(fact, recallProfile = [], selectionPolicy = null, archiveFacts = []) {
      const safeFact = sanitizeFact(fact);
      if (!safeFact || safeFact.status !== 'active') return -Infinity;
      const archivedById = buildArchivedLongTermFactMap(archiveFacts);
      const safePolicy = selectionPolicy && typeof selectionPolicy === 'object'
        ? selectionPolicy
        : {
          allowNeedsReconfirmation: false,
          needsReconfirmationPenalty: 0.7,
          lowConfidencePenalty: 0.5,
          mediumConfidencePenalty: 0,
          stalePenaltyMultiplier: 1,
        };
      let score = 0;
      if (safeFact.category === 'explicit') score += 2.2;
      if (safeFact.category === 'relationship') score += 1.4;
      if (safeFact.category === 'behavior') score += 1.2;
      score += getLongTermFactSourcePriority(safeFact.source) * 0.18;
      if (safeFact.confidence === 'confirmed') score += 2;
      else if (safeFact.confidence === 'high') score += 1.2;
      else if (safeFact.confidence === 'medium') score += 0.6;
      else score += 0.2;
      if (safeFact.confidence === 'low') score -= Number(safePolicy.lowConfidencePenalty || 0);
      if (safeFact.confidence === 'medium') score -= Number(safePolicy.mediumConfidencePenalty || 0);
      score += scoreLongTermFactFreshness(safeFact, safePolicy) * 0.85;
      const factHints = Array.isArray(safeFact.taskHints) ? safeFact.taskHints : [];
      recallProfile.forEach((hint) => {
        if (factHints.includes(hint)) score += hint === 'health' || hint === 'planning' ? 2.6 : 1.4;
      });
      if (recallProfile.includes('public-expression') && factHints.includes('public-expression')) score += 2.2;
      if (recallProfile.includes('money') && factHints.includes('money')) score += safePolicy.highRisk ? 2.4 : 1.8;
      if (recallProfile.includes('rhythm') && factHints.includes('rhythm')) score += 1.8;
      if (recallProfile.includes('delivery') && factHints.includes('delivery')) score += 1.8;
      if (recallProfile.includes('public-expression') && factHints.includes('relationship')) score += 0.55;
      if (recallProfile.includes('money') && factHints.includes('relationship')) score += 0.45;
      if (recallProfile.includes('rhythm') && factHints.includes('health')) score += 0.65;
      if (recallProfile.includes('delivery') && factHints.includes('planning')) score += 0.7;
      const observedAt = Date.parse(String(safeFact.lastObservedAt || safeFact.lastConfirmedAt || ''));
      if (Number.isFinite(observedAt)) {
        const ageDays = Math.max(0, (Date.now() - observedAt) / (1000 * 60 * 60 * 24));
        const stalePenaltyMultiplier = Math.max(0.1, Number(safePolicy.stalePenaltyMultiplier || 1));
        if (ageDays > LONG_TERM_FACT_STALE_DAYS) score -= 2.4 * stalePenaltyMultiplier;
        else if (ageDays > 45) score -= 0.8 * stalePenaltyMultiplier;
      }
      if (safeFact.needsReconfirmation) {
        if (!safePolicy.allowNeedsReconfirmation) {
          score -= Number(safePolicy.needsReconfirmationPenalty || 0.7);
        } else {
          score -= Number(safePolicy.needsReconfirmationPenalty || 0.25);
        }
      }
      if (safeFact.supersedes) {
        const previous = archivedById.get(String(safeFact.supersedes || '').trim());
        if (previous?.status === 'dismissed') score += 1.4;
        else if (previous?.status === 'superseded') score += 0.8;
        else if (previous?.status === 'stale') score += 0.5;
        else if (!previous) score += 0.3;
      }
      return score;
    }

    function adjudicateLongTermMemoryFacts(facts, question = '', focus = null, options = {}) {
      const selectionPolicy = inferLongTermMemorySelectionPolicy(question, focus, options);
      const recallProfile = selectionPolicy.recallProfile || inferLongTermMemoryRecallProfile(question, focus);
      const archiveFacts = Array.isArray(options?.archiveFacts) ? options.archiveFacts : [];
      const grouped = new Map();
      (Array.isArray(facts) ? facts : [])
        .map(sanitizeFact)
        .filter((fact) => fact && fact.status === 'active')
        .forEach((fact) => {
          const groupKey = buildLongTermFactGroupKey(fact) || (typeof api.buildLongTermFactLookupKey === 'function' ? api.buildLongTermFactLookupKey(fact) : '');
          const referenceStrength = deriveLongTermFactReferenceStrength(fact, archiveFacts, selectionPolicy);
          const relevance = scoreLongTermMemoryFactRelevance(fact, recallProfile, selectionPolicy, archiveFacts);
          const bucket = grouped.get(groupKey) || [];
          bucket.push({
            fact,
            groupKey,
            referenceStrength,
            referenceStrengthRank: getLongTermFactReferenceStrengthRank(referenceStrength),
            relevance,
            freshnessScore: scoreLongTermFactFreshness(fact, selectionPolicy),
            versionPriority: scoreLongTermFactVersionPriority(fact, archiveFacts, selectionPolicy),
          });
          grouped.set(groupKey, bucket);
        });
      return Array.from(grouped.values())
        .map((items) => {
          const activeById = new Map(items.map((item) => [String(item.fact?.id || '').trim(), item]));
          const activelySupersededIds = new Set();
          items.forEach((item) => {
            const supersedesId = String(item?.fact?.supersedes || '').trim();
            if (!supersedesId || !activeById.has(supersedesId)) return;
            activelySupersededIds.add(supersedesId);
            item.currentVersionBoost = selectionPolicy.highRisk ? 1.45 : 0.95;
          });
          items.forEach((item) => {
            item.currentVersionBoost = Number(item.currentVersionBoost || 0);
            item.activeSupersededPenalty = activelySupersededIds.has(String(item.fact?.id || '').trim())
              ? (selectionPolicy.highRisk ? 2.8 : 1.9)
              : 0;
            item.currentVersionDominance = Number(item.versionPriority || 0)
              + Number(item.currentVersionBoost || 0)
              - Number(item.activeSupersededPenalty || 0);
          });
          return items
            .filter((item) => Number.isFinite(item.relevance) && item.relevance > -Infinity)
            .sort((a, b) => {
              const currentVersionDelta = Number(b.currentVersionDominance || 0) - Number(a.currentVersionDominance || 0);
              if (Math.abs(currentVersionDelta) > 0.55) return currentVersionDelta;
              const relevanceDelta = b.relevance - a.relevance;
              if (Math.abs(relevanceDelta) > Number(selectionPolicy.sameTopicVersionPriorityGap || 0.55)) return relevanceDelta;
              const versionPriorityDelta = b.versionPriority - a.versionPriority;
              if (versionPriorityDelta !== 0) return versionPriorityDelta;
              const freshnessDelta = b.freshnessScore - a.freshnessScore;
              if (freshnessDelta !== 0) return freshnessDelta;
              const strengthDelta = b.referenceStrengthRank - a.referenceStrengthRank;
              if (strengthDelta !== 0) return strengthDelta;
              return String(b.fact.lastObservedAt || b.fact.lastConfirmedAt || '').localeCompare(String(a.fact.lastObservedAt || a.fact.lastConfirmedAt || ''));
            });
        })
        .filter((items) => items.length)
        .map((items) => {
          const winner = items[0];
          const runnerUp = items[1] || null;
          const scoreGap = runnerUp ? Number(winner.relevance || 0) - Number(runnerUp.relevance || 0) : Infinity;
          const currentVersionGap = runnerUp ? Number(winner.currentVersionDominance || 0) - Number(runnerUp.currentVersionDominance || 0) : Infinity;
          const ambiguous = Boolean(
            runnerUp
            && (
              (
                scoreGap < Number(selectionPolicy.ambiguityGap || 0.8)
                && currentVersionGap < 0.9
              )
              || (
                selectionPolicy.highRisk
                && winner.referenceStrengthRank < 3
                && scoreGap < Number(selectionPolicy.ambiguityGap || 0.8) * 1.35
                && currentVersionGap < 1.15
              )
            )
          );
          const ambiguityReason = !ambiguous
            ? ''
            : selectionPolicy.highRisk
              ? '同主题长期记忆在高风险场景下仍存在竞争，先按最新更稳的版本理解，并在必要时再确认。'
              : '同主题长期记忆目前还有相近版本竞争，后续必要时先轻量确认。';
          return {
            fact: winner.fact,
            relevance: winner.relevance,
            referenceStrength: winner.referenceStrength,
            referenceStrengthRank: winner.referenceStrengthRank,
            freshnessScore: winner.freshnessScore,
            versionPriority: winner.versionPriority,
            currentVersionDominance: Number(winner.currentVersionDominance || 0),
            groupKey: winner.groupKey,
            runnerUp: runnerUp ? runnerUp.fact : null,
            runnerUpRelevance: runnerUp ? runnerUp.relevance : -Infinity,
            scoreGap,
            currentVersionGap,
            ambiguous,
            ambiguityReason,
            selectionConfidence: deriveLongTermMemorySelectionConfidence({
              referenceStrengthRank: winner.referenceStrengthRank,
              scoreGap,
              currentVersionGap,
              ambiguous,
            }, selectionPolicy),
          };
        })
        .filter((item) => item.referenceStrengthRank >= getLongTermFactReferenceStrengthRank(selectionPolicy.minimumReferenceStrength || 'weak'))
        .sort((a, b) => {
          const relevanceDelta = Number(b.relevance || 0) - Number(a.relevance || 0);
          if (relevanceDelta !== 0) return relevanceDelta;
          const strengthDelta = Number(b.referenceStrengthRank || 0) - Number(a.referenceStrengthRank || 0);
          if (strengthDelta !== 0) return strengthDelta;
          return String(b.fact?.lastObservedAt || b.fact?.lastConfirmedAt || '').localeCompare(String(a.fact?.lastObservedAt || a.fact?.lastConfirmedAt || ''));
        });
    }

    function prioritizeLongTermMemoryFacts(facts, question = '', focus = null, options = {}) {
      return adjudicateLongTermMemoryFacts(facts, question, focus, options).map((item) => item.fact);
    }

    function summarizeRelevantLongTermFacts(question = '', focus = null, limit = 3, options = {}) {
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      const longTermMemory = typeof api.getMorphLongTermMemory === 'function'
        ? api.getMorphLongTermMemory(aiMemory)
        : (aiMemory?.longTermMemory || {});
      return prioritizeLongTermMemoryFacts(longTermMemory.facts, question, focus, { ...options, archiveFacts: longTermMemory.factArchive })
        .slice(0, Math.max(0, Number(limit || 0) || 0))
        .map((fact) => `${String(fact.label || fact.key || '长期记忆').trim()}：${String(fact.fact || '').trim()}`)
        .filter(Boolean);
    }

    function collectLongTermMemorySelectionWarnings(activeFacts = [], archiveFacts = [], question = '', focus = null, options = {}) {
      const safeArchive = (Array.isArray(archiveFacts) ? archiveFacts : [])
        .map(sanitizeFact)
        .filter(Boolean);
      const archivedById = new Map(safeArchive.map((fact) => [fact.id, fact]));
      const warnings = [];
      const selectionPolicy = inferLongTermMemorySelectionPolicy(question, focus, options);
      const adjudicatedFacts = adjudicateLongTermMemoryFacts(activeFacts, question, focus, { ...options, archiveFacts: safeArchive }).slice(0, 4);
      adjudicatedFacts.forEach((entry) => {
        const fact = entry?.fact;
        if (!fact) return;
        const label = String(fact.label || fact.key || '长期记忆').trim() || '长期记忆';
        const referenceStrength = entry?.referenceStrength || deriveLongTermFactReferenceStrength(fact, safeArchive, selectionPolicy);
        if (referenceStrength === 'cautious') {
          warnings.push(`长期记忆「${label}」本轮只能谨慎参考，回答时不要把它说成已经确认的当前事实。`);
        } else if (referenceStrength === 'weak') {
          warnings.push(`长期记忆「${label}」当前只可作为弱参考，必要时先重新确认，不要直接沿用。`);
        }
        if (entry?.ambiguous && entry?.ambiguityReason) {
          warnings.push(`长期记忆「${label}」${entry.ambiguityReason}`);
        }
        if (fact.needsReconfirmation) {
          warnings.push(`长期记忆「${label}」已经久未确认，本轮只能作为弱参考，必要时先轻量确认。`);
        }
        if (!fact.supersedes) return;
        const previous = archivedById.get(String(fact.supersedes || '').trim());
        if (!previous) {
          warnings.push(`长期记忆「${label}」已经有更新版本，本轮优先按最新版本理解，不回退旧说法。`);
          return;
        }
        if (previous.status === 'dismissed') {
          warnings.push(`长期记忆「${label}」替代了已被用户否定的旧版本，本轮必须按更新后的版本理解。`);
          return;
        }
        if (previous.status === 'stale') {
          warnings.push(`长期记忆「${label}」替代了已过期的旧版本，必要时先轻量确认再继续沿用。`);
          return;
        }
        warnings.push(`长期记忆「${label}」已有旧版本，本轮优先按最新版本理解。`);
      });
      return Array.from(new Set(warnings)).slice(0, 4);
    }

    function collectLongTermMemoryAdjudicationReasons(activeFacts = [], archiveFacts = [], question = '', focus = null, options = {}) {
      const safeArchive = Array.isArray(archiveFacts) ? archiveFacts : [];
      return adjudicateLongTermMemoryFacts(activeFacts, question, focus, { ...options, archiveFacts: safeArchive })
        .slice(0, 4)
        .map((entry) => {
          const fact = entry?.fact;
          if (!fact) return '';
          const label = String(fact.label || fact.key || '长期记忆').trim() || '长期记忆';
          const reasons = [];
          if (fact.supersedes) reasons.push('已按更新版本理解');
          if (entry?.referenceStrength === 'strong') reasons.push('当前可信度高');
          if (Number(entry?.freshnessScore || 0) >= 1.1) reasons.push('最近确认且较新');
          if (Number(fact?.timesConfirmed || 1) >= 3) reasons.push('已被多次确认');
          if (!reasons.length && entry?.referenceStrength === 'supported') reasons.push('当前可作为稳定参考');
          if (entry?.ambiguous) reasons.push('仍保留轻量确认余地');
          return `${label}：${reasons.join('，')}`;
        })
        .filter(Boolean);
    }

    function buildLongTermMemorySelectionReport(activeFacts = [], archiveFacts = [], question = '', focus = null, options = {}) {
      const safeArchive = (Array.isArray(archiveFacts) ? archiveFacts : [])
        .map(sanitizeFact)
        .filter(Boolean);
      const archivedById = new Map(safeArchive.map((fact) => [fact.id, fact]));
      const selectionPolicy = inferLongTermMemorySelectionPolicy(question, focus, options);
      return adjudicateLongTermMemoryFacts(activeFacts, question, focus, { ...options, archiveFacts: safeArchive })
        .slice(0, Math.max(1, Number(options?.limit || 12)))
        .map((entry) => {
          const fact = entry?.fact;
          if (!fact) return null;
          const previous = fact.supersedes ? archivedById.get(String(fact.supersedes || '').trim()) : null;
          const mustConfirmBeforeUse = Boolean(
            fact.needsReconfirmation
            || entry?.ambiguous
            || entry?.referenceStrength === 'weak'
            || (selectionPolicy.highRisk && entry?.referenceStrength === 'cautious')
          );
          const isLatestVersion = Boolean(
            fact.supersedes
            || previous
            || (fact.versionGroup && !entry?.runnerUp)
          );
          const trustLevel = mustConfirmBeforeUse
            ? 'confirm-first'
            : entry?.referenceStrength === 'strong'
              ? 'stable'
              : entry?.referenceStrength === 'supported'
                ? 'usable'
                : 'weak';
          const reasons = [];
          const reasonCodes = [];
          if (fact.supersedes) {
            reasons.push(previous?.status === 'dismissed' ? '按已纠正的新版本理解' : '按更新版本理解');
            reasonCodes.push(previous?.status === 'dismissed' ? 'supersedes-dismissed' : 'supersedes-old');
          }
          if (Number(entry?.currentVersionGap || 0) >= 0.9 && fact.supersedes) {
            reasons.push('同主题旧版本已被当前版本压过');
            reasonCodes.push('current-version-dominant');
          }
          if (isLatestVersion && !fact.needsReconfirmation && (fact.confidence === 'confirmed' || fact.confidence === 'high')) {
            reasons.push('这是当前最新确认版本');
            reasonCodes.push('latest-confirmed-version');
          }
          if (entry?.referenceStrength === 'strong') {
            reasons.push('当前可信度高');
            reasonCodes.push('strong-reference');
          } else if (entry?.referenceStrength === 'supported') {
            reasons.push('当前可作为稳定参考');
            reasonCodes.push('supported-reference');
          } else if (entry?.referenceStrength === 'cautious') {
            reasons.push('当前只能谨慎参考');
            reasonCodes.push('cautious-reference');
          } else {
            reasons.push('当前只能弱参考');
            reasonCodes.push('weak-reference');
          }
          if (Number(entry?.freshnessScore || 0) >= 1.1) {
            reasons.push('最近确认且较新');
            reasonCodes.push('fresh');
          }
          if (Number(fact?.timesConfirmed || 1) >= 3) {
            reasons.push('已被多次确认');
            reasonCodes.push('reconfirmed-often');
          }
          if (fact.needsReconfirmation) {
            reasons.push('已进入再确认周期');
            reasonCodes.push('needs-reconfirmation');
          }
          if (entry?.ambiguous) {
            reasons.push('同主题仍存在近邻版本竞争');
            reasonCodes.push('ambiguous-competition');
          }
          const selectionConfidence = String(entry?.selectionConfidence || '');
          const meetsSelectionThreshold = getLongTermMemorySelectionConfidenceRank(selectionConfidence)
            >= getLongTermMemorySelectionConfidenceRank(selectionPolicy.minimumSelectionConfidence || 'weak');
          return {
            fact,
            referenceStrength: entry?.referenceStrength || 'weak',
            referenceStrengthRank: Number(entry?.referenceStrengthRank || 0),
            freshnessScore: Number(entry?.freshnessScore || 0),
            relevance: Number(entry?.relevance || 0),
            versionPriority: Number(entry?.versionPriority || 0),
            currentVersionDominance: Number(entry?.currentVersionDominance || 0),
            selectionConfidence,
            ambiguous: entry?.ambiguous === true,
            ambiguityReason: String(entry?.ambiguityReason || ''),
            mustConfirmBeforeUse,
            trustLevel,
            isLatestVersion,
            meetsSelectionThreshold,
            previousStatus: String(previous?.status || ''),
            scoreGap: Number(entry?.scoreGap || 0),
            currentVersionGap: Number(entry?.currentVersionGap || 0),
            reasonCodes,
            selectionReason: reasons.join('，'),
          };
        })
        .filter(Boolean)
        .filter((entry) => entry.meetsSelectionThreshold !== false);
    }

    function aggregateLongTermMemorySelectionSignals(report = []) {
      const items = Array.isArray(report) ? report : [];
      const summary = {
        total: 0,
        stableCount: 0,
        usableCount: 0,
        confirmFirstCount: 0,
        ambiguousCount: 0,
        latestVersionCount: 0,
        strongCount: 0,
        supportedCount: 0,
        cautiousCount: 0,
        topTaskHints: [],
        topSources: [],
        topReasonCodes: [],
      };
      if (!items.length) return summary;
      const reasonCounts = new Map();
      const taskHintCounts = new Map();
      const sourceCounts = new Map();
      items.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        summary.total += 1;
        if (entry.trustLevel === 'stable') summary.stableCount += 1;
        if (entry.trustLevel === 'usable') summary.usableCount += 1;
        if (entry.mustConfirmBeforeUse) summary.confirmFirstCount += 1;
        if (entry.ambiguous) summary.ambiguousCount += 1;
        if (entry.referenceStrength === 'strong') summary.strongCount += 1;
        else if (entry.referenceStrength === 'supported') summary.supportedCount += 1;
        else if (entry.referenceStrength === 'cautious') summary.cautiousCount += 1;
        const factHints = Array.isArray(entry.fact?.taskHints) ? entry.fact.taskHints : [];
        factHints.forEach((hint) => {
          const key = String(hint || '').trim();
          if (!key) return;
          taskHintCounts.set(key, Number(taskHintCounts.get(key) || 0) + 1);
        });
        const sourceKey = String(entry.fact?.source || '').trim();
        if (sourceKey) sourceCounts.set(sourceKey, Number(sourceCounts.get(sourceKey) || 0) + 1);
        if (Array.isArray(entry.reasonCodes)) {
          entry.reasonCodes.forEach((code) => {
            const key = String(code || '').trim();
            if (!key) return;
            reasonCounts.set(key, Number(reasonCounts.get(key) || 0) + 1);
            if (key === 'supersedes-dismissed' || key === 'supersedes-old') summary.latestVersionCount += 1;
          });
        }
      });
      summary.topTaskHints = Array.from(taskHintCounts.entries())
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
        .slice(0, 4)
        .map(([hint]) => hint);
      summary.topSources = Array.from(sourceCounts.entries())
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
        .slice(0, 3)
        .map(([source]) => source);
      summary.topReasonCodes = Array.from(reasonCounts.entries())
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
        .slice(0, 4)
        .map(([code]) => code);
      return summary;
    }

    function buildLongTermMemoryTelemetryReport(report = [], selectionSignals = null, selectionPolicy = null) {
      const items = Array.isArray(report) ? report : [];
      const signals = selectionSignals && typeof selectionSignals === 'object'
        ? selectionSignals
        : aggregateLongTermMemorySelectionSignals(items);
      const policy = selectionPolicy && typeof selectionPolicy === 'object' ? selectionPolicy : {};
      const total = Number(signals.total || 0);
      const stableCount = Number(signals.stableCount || 0);
      const usableCount = Number(signals.usableCount || 0);
      const confirmFirstCount = Number(signals.confirmFirstCount || 0);
      const ambiguousCount = Number(signals.ambiguousCount || 0);
      const latestVersionCount = Number(signals.latestVersionCount || 0);
      const strongCount = Number(signals.strongCount || 0);
      const supportedCount = Number(signals.supportedCount || 0);
      const cautiousCount = Number(signals.cautiousCount || 0);
      const directUseCount = Math.max(0, stableCount + usableCount - confirmFirstCount);
      const selectedLatestVersionCount = items.filter((entry) => entry?.isLatestVersion === true).length;
      const directUseRatio = total ? Number((directUseCount / total).toFixed(2)) : 0;
      const confirmFirstRatio = total ? Number((confirmFirstCount / total).toFixed(2)) : 0;
      const latestVersionRatio = total ? Number((selectedLatestVersionCount / total).toFixed(2)) : 0;
      const cautiousRatio = total ? Number((cautiousCount / total).toFixed(2)) : 0;
      const strongRatio = total ? Number((strongCount / total).toFixed(2)) : 0;
      let overallStability = 'empty';
      if (total) {
        if (stableCount > 0 && confirmFirstCount === 0 && ambiguousCount === 0) overallStability = 'stable';
        else if (confirmFirstRatio >= 0.5 || ambiguousCount > 1) overallStability = 'fragile';
        else overallStability = 'mixed';
      }
      let usageMode = 'fallback';
      if (!total) usageMode = 'none';
      else if (confirmFirstCount > 0 && confirmFirstCount >= stableCount + usableCount) usageMode = 'confirm-first';
      else if (stableCount > 0 && strongCount >= supportedCount && confirmFirstCount === 0) usageMode = 'direct';
      else usageMode = 'supported';
      return {
        purpose: String(policy.purpose || 'general'),
        highRisk: policy.highRisk === true,
        minimumReferenceStrength: String(policy.minimumReferenceStrength || 'weak'),
        minimumSelectionConfidence: String(policy.minimumSelectionConfidence || 'weak'),
        preferLatestConfirmedVersion: policy.preferLatestConfirmedVersion === true,
        total,
        stableCount,
        usableCount,
        confirmFirstCount,
        ambiguousCount,
        latestVersionCount,
        strongCount,
        supportedCount,
        cautiousCount,
        selectedLatestVersionCount,
        directUseCount,
        directUseRatio,
        confirmFirstRatio,
        latestVersionRatio,
        cautiousRatio,
        strongRatio,
        overallStability,
        usageMode,
        topTaskHints: Array.isArray(signals.topTaskHints) ? signals.topTaskHints.slice(0, 4) : [],
        topSources: Array.isArray(signals.topSources) ? signals.topSources.slice(0, 3) : [],
        topReasonCodes: Array.isArray(signals.topReasonCodes) ? signals.topReasonCodes.slice(0, 4) : [],
      };
    }

    function buildLongTermMemoryUsageGuidance(selectionSignals = null, options = {}) {
      const signals = selectionSignals && typeof selectionSignals === 'object' ? selectionSignals : {};
      const purpose = String(options?.purpose || 'general').trim().toLowerCase() || 'general';
      const lines = [];
      const total = Number(signals.total || 0);
      const stableCount = Number(signals.stableCount || 0);
      const usableCount = Number(signals.usableCount || 0);
      const confirmFirstCount = Number(signals.confirmFirstCount || 0);
      const ambiguousCount = Number(signals.ambiguousCount || 0);
      const latestVersionCount = Number(signals.latestVersionCount || 0);
      if (!total) return lines;
      if (confirmFirstCount > 0 && confirmFirstCount >= stableCount + usableCount) {
        lines.push(
          purpose === 'heartbeat'
            ? '这轮长期记忆里待确认项占多数，先克制地把它们当作参考。'
            : '这轮长期记忆里待确认项占多数，不要直接把旧记忆当成当前事实。'
        );
      } else if (stableCount > 0 && confirmFirstCount === 0) {
        lines.push('这轮长期记忆以稳定参考为主，可以沿用已确认版本。');
      }
      if (latestVersionCount > 0) {
        lines.push('同主题长期记忆已有更新版本，优先沿用最新确认版本。');
      }
      if (Array.isArray(signals.topTaskHints) && signals.topTaskHints.length) {
        const topHint = String(signals.topTaskHints[0] || '');
        if (topHint === 'public-expression') lines.push('这轮长期记忆主要集中在公开表达边界，涉及发送/发布时先把边界放前面。');
        else if (topHint === 'money') lines.push('这轮长期记忆主要集中在金钱与预算判断，默认先保守、先问用户。');
        else if (topHint === 'health') lines.push('这轮长期记忆主要集中在健康与状态线索，优先稳住而不是贸然推进。');
        else if (topHint === 'rhythm') lines.push('这轮长期记忆主要集中在节律与恢复，先避免把用户推向过载。');
        else if (topHint === 'delivery') lines.push('这轮长期记忆主要集中在交付主线，先沿着关键输出往前推进。');
      }
      if (ambiguousCount > 0) {
        lines.push(
          purpose === 'heartbeat'
            ? '同主题长期记忆仍有竞争版本，提醒时先轻描淡写地带过。'
            : '同主题长期记忆仍有竞争版本，必要时先轻量确认再继续。'
        );
      }
      return lines;
    }

    function looksLikeLongTermFactReconfirmation(text = '') {
      const clean = String(text || '').trim();
      if (!clean) return false;
      if (clean.length <= 4) return false;
      if (/[?？]$/.test(clean)) return false;
      if (/(不是|并非|别|不要|不想|不希望|别再|不要再|改成|改为|换成|纠正|搞错|不对)/.test(clean)) return false;
      return /(还是|仍然|依然|一直|确实|就是|保持|继续按|就按这个|默认|习惯|偏好|边界|提醒我|我希望|我不希望|长期|以后|通常|一般)/.test(clean);
    }

    function tokenizeLongTermFactMatchText(text = '') {
      return Array.from(new Set((String(text || '').toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]{3,}/g) || []).map((item) => String(item || '').trim()).filter(Boolean)));
    }

    function normalizeLongTermFactComparisonText(text = '') {
      return String(text || '')
        .toLowerCase()
        .replace(/[，。！？；：,.!?;:\s]+/g, '')
        .replace(/不是这样|并不是|不再|不要再|不要|别再|别把|不希望|改成|改为|换成|撤销|去掉|删掉/g, '');
    }

    function looksLikeLongTermFactDismissal(text = '') {
      const clean = String(text || '').trim();
      if (!clean) return false;
      return /(不是|并不是|不再|不要|别再|别把|不希望|别再按|改成|改为|换成|撤销|去掉|删掉|不要再记|不要这么记|不是这个|不是这样|这不对)/.test(clean)
        || (/(好多了|好很多了|恢复了|缓解了|已经好了|已经好很多了)/.test(clean) && /(左耳|右耳|耳朵|耳堵|耳鸣|堵|症状|身体状态)/.test(clean));
    }

    function dismissConflictingLongTermFactsFromUserSignals(userText = '', aiMemory = null) {
      const clean = String(userText || '').trim();
      if (!looksLikeLongTermFactDismissal(clean)) return [];
      const targetMemory = aiMemory && typeof aiMemory === 'object'
        ? aiMemory
        : (typeof api.getAIMemory === 'function' ? api.getAIMemory() : null);
      const longTermMemory = typeof api.getMorphLongTermMemory === 'function'
        ? api.getMorphLongTermMemory(targetMemory)
        : (targetMemory?.longTermMemory || {});
      const activeFacts = Array.isArray(longTermMemory.facts) ? longTermMemory.facts : [];
      const candidateFacts = prioritizeLongTermMemoryFacts(activeFacts, clean, null)
        .filter((fact) => fact && fact.status === 'active' && fact.editable !== false && String(fact.source || '').trim().toLowerCase() !== 'settings')
        .slice(0, 4);
      if (!candidateFacts.length) return [];
      const textTokens = tokenizeLongTermFactMatchText(clean);
      const symptomImprovementDismissal = /(好多了|好很多了|恢复了|缓解了|已经好了|已经好很多了)/.test(clean)
        && /(左耳|右耳|耳朵|耳堵|耳鸣|堵|症状|身体状态)/.test(clean);
      const dismissed = [];
      candidateFacts.forEach((fact) => {
        const factText = `${String(fact.label || '')} ${String(fact.fact || '')}`.trim();
        const factTokens = tokenizeLongTermFactMatchText(`${String(fact.label || '')} ${String(fact.fact || '')}`);
        const overlap = factTokens.filter((token) => textTokens.includes(token));
        const normalizedUser = normalizeLongTermFactComparisonText(clean);
        const normalizedFact = normalizeLongTermFactComparisonText(factText);
        const looseMatch = normalizedUser && normalizedFact && (
          normalizedUser.includes(normalizedFact)
          || normalizedFact.includes(normalizedUser)
          || normalizedUser.includes(normalizeLongTermFactComparisonText(String(fact.fact || '')))
        );
        const symptomLexicalMatch = symptomImprovementDismissal
          && /(左耳|右耳|耳朵|耳堵|耳鸣|堵|症状|身体状态)/.test(clean)
          && /(左耳|右耳|耳朵|耳堵|耳鸣|堵|症状|身体状态)/.test(factText);
        const symptomOverlap = symptomImprovementDismissal
          && overlap.some((token) => /(左耳|右耳|耳朵|耳堵|耳鸣|堵|症状|身体状态)/.test(token))
          && factTokens.some((token) => /(左耳|右耳|耳朵|耳堵|耳鸣|堵|症状|身体状态)/.test(token));
        if (!overlap.length && !looseMatch && !symptomOverlap && !symptomLexicalMatch) return;
        dismissed.push(fact);
      });
      if (!dismissed.length) return [];
      const dismissedIds = new Set(dismissed.map((fact) => fact.id));
      const now = new Date().toISOString();
      longTermMemory.facts = activeFacts
        .map(sanitizeFact)
        .filter((fact) => fact && !dismissedIds.has(fact.id));
      longTermMemory.factArchive = Array.isArray(longTermMemory.factArchive) ? longTermMemory.factArchive : [];
      dismissed.forEach((fact) => {
        const lookupKey = typeof api.buildLongTermFactLookupKey === 'function'
          ? api.buildLongTermFactLookupKey(fact)
          : String(fact.id || '').trim();
        longTermMemory.factArchive.unshift(sanitizeFact({
          ...fact,
          confidence: 'low',
          status: 'dismissed',
          versionGroup: String(fact.versionGroup || lookupKey),
          archivedAt: now,
          staleAt: now,
          needsReconfirmation: false,
          needsReconfirmationReason: '',
        }));
        if (typeof api.recordMorphMemoryConflictResult === 'function') {
          api.recordMorphMemoryConflictResult({
            factId: String(fact.id || '').trim(),
            conflictingFactIds: [String(fact.id || '').trim()],
            strategy: 'retire-old',
            reason: '用户明确纠正了旧理解，旧版本已退役。',
          });
        }
        if (typeof api.recordMorphMemoryWriteReceipt === 'function') {
          api.recordMorphMemoryWriteReceipt({
            source: 'correction',
            scope: 'user',
            candidateType: 'correction',
            writeTier: 'long-term-active',
            result: 'dismissed',
            targetKind: 'long-term-fact',
            targetId: String(fact.id || '').trim(),
            sectionTitle: String(fact.label || fact.key || '长期记忆').trim(),
            summary: `${String(fact.label || fact.key || '长期记忆').trim() || '长期记忆'} 已按用户纠正退役`,
          });
        }
        if (typeof api.recordMorphMemoryTrace === 'function') {
          api.recordMorphMemoryTrace({
            source: 'correction',
            scope: 'user',
            candidateType: 'correction',
            writeTier: 'long-term-active',
            signalText: clean,
            reconcileResult: 'updated',
            conflictStrategy: 'retire-old',
            targetFactId: String(fact.id || '').trim(),
            note: `${String(fact.label || fact.key || '长期记忆').trim() || '长期记忆'} 已按用户纠正退役`,
          });
        }
      });
      if (Array.isArray(targetMemory?.explicitMemoryLog) || Array.isArray(longTermMemory.explicitMemoryLog)) {
        const targetExplicitIds = new Set(dismissed
          .filter((fact) => String(fact.category || '') === 'explicit' && String(fact.id || '').startsWith('explicit:'))
          .map((fact) => String(fact.id || '').replace(/^explicit:/, '')));
        if (targetExplicitIds.size) {
          const filterEntries = (entries) => (Array.isArray(entries) ? entries.filter((entry) => !targetExplicitIds.has(String(entry?.id || '').trim())) : []);
          if (targetMemory && typeof targetMemory === 'object') targetMemory.explicitMemoryLog = filterEntries(targetMemory.explicitMemoryLog);
          longTermMemory.explicitMemoryLog = filterEntries(longTermMemory.explicitMemoryLog);
        }
      }
      return dismissed.map((fact) => String(fact.label || fact.key || '长期记忆').trim()).filter(Boolean);
    }

    function refreshLongTermFactsFromUserSignals(userText = '', aiMemory = null) {
      const clean = String(userText || '').trim();
      if (!looksLikeLongTermFactReconfirmation(clean)) return [];
      const targetMemory = aiMemory && typeof aiMemory === 'object'
        ? aiMemory
        : (typeof api.getAIMemory === 'function' ? api.getAIMemory() : null);
      const longTermMemory = typeof api.getMorphLongTermMemory === 'function'
        ? api.getMorphLongTermMemory(targetMemory)
        : (targetMemory?.longTermMemory || {});
      const facts = Array.isArray(longTermMemory.facts) ? longTermMemory.facts : [];
      const candidates = prioritizeLongTermMemoryFacts(facts, clean, null)
        .filter((fact) => fact && fact.status === 'active' && fact.needsReconfirmation)
        .slice(0, 3);
      if (!candidates.length) return [];
      const now = new Date().toISOString();
      const refreshedIds = new Set(candidates.map((fact) => fact.id));
      longTermMemory.facts = facts.map((fact) => {
        const safeFact = sanitizeFact(fact);
        if (!safeFact || !refreshedIds.has(safeFact.id)) return safeFact;
        const upgradedConfidence = safeFact.confidence === 'low'
          ? 'medium'
          : safeFact.confidence === 'medium'
            ? 'high'
            : 'confirmed';
        return sanitizeFact({
          ...safeFact,
          confidence: upgradedConfidence,
          lastConfirmedAt: now,
          lastObservedAt: now,
          needsReconfirmation: false,
          needsReconfirmationReason: '',
          staleAt: '',
          status: 'active',
          timesConfirmed: Math.max(1, Number(safeFact.timesConfirmed || 1)) + 1,
        });
      }).filter(Boolean);
      longTermMemory.facts
        .filter((fact) => fact && refreshedIds.has(fact.id))
        .forEach((fact) => {
          if (typeof api.resolveMorphMemoryReconfirmationTask === 'function') {
            api.resolveMorphMemoryReconfirmationTask(String(fact.id || '').trim(), 'resolved');
          }
          if (typeof api.recordMorphMemoryWriteReceipt === 'function') {
            api.recordMorphMemoryWriteReceipt({
              source: 'reconfirmation',
              scope: 'user',
              candidateType: 'stable-preference',
              writeTier: 'long-term-active',
              result: 'updated',
              targetKind: 'long-term-fact',
              targetId: String(fact.id || '').trim(),
              sectionTitle: String(fact.label || fact.key || '长期记忆').trim(),
              summary: `${String(fact.label || fact.key || '长期记忆').trim() || '长期记忆'} 已重新确认`,
            });
          }
          if (typeof api.recordMorphMemoryTrace === 'function') {
            api.recordMorphMemoryTrace({
              source: 'reconfirmation',
              scope: 'user',
              candidateType: 'stable-preference',
              writeTier: 'reconfirmation-task',
              signalText: clean,
              reconcileResult: 'updated',
              targetFactId: String(fact.id || '').trim(),
              note: `${String(fact.label || fact.key || '长期记忆').trim() || '长期记忆'} 已重新确认`,
            });
          }
        });
      return longTermMemory.facts
        .filter((fact) => fact && refreshedIds.has(fact.id))
        .map((fact) => String(fact.label || fact.key || '长期记忆').trim())
        .filter(Boolean);
    }

    return {
      inferLongTermMemoryRecallProfile,
      inferLongTermMemorySelectionPolicy,
      getLongTermMemorySelectionConfidenceRank,
      getLongTermFactSourcePriority,
      buildArchivedLongTermFactMap,
      deriveLongTermFactReferenceStrength,
      getLongTermFactReferenceStrengthRank,
      buildLongTermFactGroupKey,
      scoreLongTermFactFreshness,
      scoreLongTermFactVersionPriority,
      deriveLongTermMemorySelectionConfidence,
      scoreLongTermMemoryFactRelevance,
      adjudicateLongTermMemoryFacts,
      prioritizeLongTermMemoryFacts,
      summarizeRelevantLongTermFacts,
      collectLongTermMemorySelectionWarnings,
      collectLongTermMemoryAdjudicationReasons,
      buildLongTermMemorySelectionReport,
      aggregateLongTermMemorySelectionSignals,
      buildLongTermMemoryTelemetryReport,
      buildLongTermMemoryUsageGuidance,
      looksLikeLongTermFactReconfirmation,
      tokenizeLongTermFactMatchText,
      normalizeLongTermFactComparisonText,
      looksLikeLongTermFactDismissal,
      dismissConflictingLongTermFactsFromUserSignals,
      refreshLongTermFactsFromUserSignals,
    };
  }

  window.MorphMemorySelectionRuntime = { create: createMemorySelectionRuntime };
})();
