// @ts-check

(function initMorphThoughtWormRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphThoughtWormRuntime && typeof window.MorphThoughtWormRuntime.create === 'function';
  const hasDepsRuntime = window.MorphThoughtWormDepsRuntime && typeof window.MorphThoughtWormDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createThoughtWormRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const getDataRoot = typeof api.getDataRoot === 'function' ? api.getDataRoot : () => null;
    const sortThoughtsNewestFirst = typeof api.sortThoughtsNewestFirst === 'function' ? api.sortThoughtsNewestFirst : (items) => (Array.isArray(items) ? items.slice() : []);
    const parseThoughtTimestamp = typeof api.parseThoughtTimestamp === 'function' ? api.parseThoughtTimestamp : () => 0;
    const getOrbDisplayText = typeof api.getOrbDisplayText === 'function' ? api.getOrbDisplayText : (item) => String(item?.text || '').trim();
    const getFlashThoughtProjectGroupId = typeof api.getFlashThoughtProjectGroupId === 'function' ? api.getFlashThoughtProjectGroupId : () => '';
    const getFlashThoughtProjectGroupName = typeof api.getFlashThoughtProjectGroupName === 'function' ? api.getFlashThoughtProjectGroupName : () => '';
    const getFlashThoughtWormGroup = typeof api.getFlashThoughtWormGroup === 'function' ? api.getFlashThoughtWormGroup : () => null;
    const getThoughtEdgeRefs = typeof api.getThoughtEdgeRefs === 'function' ? api.getThoughtEdgeRefs : () => [];
    const parseThoughtRef = typeof api.parseThoughtRef === 'function' ? api.parseThoughtRef : () => ({ source: '', id: '' });
    const extractThoughtWormTokenSet = typeof api.extractThoughtWormTokenSet === 'function' ? api.extractThoughtWormTokenSet : () => new Set();
    const computeThoughtWormLinkAffinity = typeof api.computeThoughtWormLinkAffinity === 'function'
      ? api.computeThoughtWormLinkAffinity
      : () => ({ score: 0, directEdge: false });
    const computeThoughtWormTemporalScore = typeof api.computeThoughtWormTemporalScore === 'function' ? api.computeThoughtWormTemporalScore : () => 0;
    const splitThoughtWormOrderedIds = typeof api.splitThoughtWormOrderedIds === 'function'
      ? api.splitThoughtWormOrderedIds
      : (ids) => [Array.isArray(ids) ? ids.slice() : []];
    const buildThoughtWormTitleFromEntries = typeof api.buildThoughtWormTitleFromEntries === 'function'
      ? api.buildThoughtWormTitleFromEntries
      : (entries) => String(entries?.[0]?.text || '思维虫').trim() || '思维虫';
    const genId = typeof api.genId === 'function'
      ? api.genId
      : () => `worm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

    function buildThoughtWormAnalysis(sourceItems = null) {
      const dataRoot = getDataRoot();
      const baseItems = Array.isArray(sourceItems)
        ? sourceItems
        : (Array.isArray(dataRoot?.flashThoughts) ? dataRoot.flashThoughts : []);
      const flashItems = baseItems.filter((item) => item && item.id);
      if (!flashItems.length) return { worms: [], byThoughtId: new Map() };

      const features = sortThoughtsNewestFirst(flashItems)
        .sort((left, right) => {
          const leftTs = parseThoughtTimestamp(left);
          const rightTs = parseThoughtTimestamp(right);
          if (leftTs !== rightTs) return leftTs - rightTs;
          return String(left?.id || '').localeCompare(String(right?.id || ''));
        })
        .map((item) => {
          const id = String(item?.id || '').trim();
          const text = String(item?.text || getOrbDisplayText(item) || '').trim();
          const wormGroup = getFlashThoughtWormGroup(item);
          const groupType = String(wormGroup?.type || (getFlashThoughtProjectGroupId(item) ? 'project' : '')).trim();
          const groupId = String(wormGroup?.id || getFlashThoughtProjectGroupId(item) || '').trim();
          const groupName = String(wormGroup?.name || getFlashThoughtProjectGroupName(item) || '').trim();
          return {
            id,
            item,
            ts: parseThoughtTimestamp(item),
            tokens: extractThoughtWormTokenSet(text),
            edgeThoughtIds: new Set(
              getThoughtEdgeRefs(item)
                .map((ref) => parseThoughtRef(ref))
                .filter((parsed) => parsed.source === 'flashThoughts' && parsed.id)
                .map((parsed) => String(parsed.id).trim()),
            ),
            clusterId: String(item?.clusterId || '').trim(),
            groupType,
            groupId,
            groupName,
            projectGroupId: String(getFlashThoughtProjectGroupId(item) || '').trim(),
            projectGroupName: String(getFlashThoughtProjectGroupName(item) || '').trim(),
          };
        })
        .filter((feature) => feature.id);
      if (!features.length) return { worms: [], byThoughtId: new Map() };

      const featureById = new Map(features.map((feature) => [feature.id, feature]));
      const byThoughtId = new Map();
      const worms = [];
      const groupedFeatures = new Map();
      features.forEach((feature) => {
        const bucketKey = feature.groupId ? `${String(feature.groupType || 'group').trim() || 'group'}:${feature.groupId}` : `solo:${feature.id}`;
        if (!groupedFeatures.has(bucketKey)) groupedFeatures.set(bucketKey, []);
        groupedFeatures.get(bucketKey)?.push(feature);
      });

      groupedFeatures.forEach((bucketFeatures, bucketKey) => {
        const members = (Array.isArray(bucketFeatures) ? bucketFeatures : [])
          .filter(Boolean)
          .sort((left, right) => {
            if (left.ts !== right.ts) return left.ts - right.ts;
            return left.id.localeCompare(right.id);
          });
        if (!members.length) return;
        const entries = members.map((entry) => entry.item).filter(Boolean);
        if (!entries.length) return;
        const groupType = String(members[0]?.groupType || '').trim();
        const groupId = String(members[0]?.groupId || '').trim();
        const groupName = String(members[0]?.groupName || '').trim();
        const projectGroupId = String(members[0]?.projectGroupId || '').trim();
        const projectGroupName = String(members[0]?.projectGroupName || '').trim();
        const wormId = groupId ? `worm_${groupType || 'group'}_${groupId}` : `worm_flash_${members[0]?.id || genId()}`;
        const latestTs = Math.max(...members.map((entry) => Number(entry?.ts) || 0));
        const latestAgeDays = latestTs > 0 ? (Date.now() - latestTs) / 86400000 : 999;
        const sizeScore = Math.min(1, Math.max(0, (entries.length - 1) / 8));
        const recencyScore = Math.exp(-(Math.max(0, latestAgeDays) / 14));
        const heat = Number(Math.min(1, Math.max(0, (sizeScore * 0.45) + (recencyScore * 0.55))).toFixed(2));
        const state = latestAgeDays <= 3 ? 'now' : (latestAgeDays <= 14 ? 'next' : 'other');
        const title = groupName || projectGroupName || buildThoughtWormTitleFromEntries(entries);
        const description = groupId
          ? `${groupType === 'fixed' ? '定念群组' : '项目群组'} · ${entries.length} 条闪念`
          : `未归项目 · ${entries.length} 条闪念`;
        const thoughtIds = members.map((entry) => entry.id);
        const turnPointIds = new Set();

        thoughtIds.forEach((thoughtId, index) => {
          byThoughtId.set(thoughtId, {
            wormId,
            wormTitle: title,
            wormRole: index === 0 ? 'seed' : 'flow',
            wormOrder: index + 1,
            transitionScore: 0,
            state,
            heat,
          });
        });

        worms.push({
          id: wormId,
          title,
          description,
          state,
          heat,
          turnPointIds,
          thoughtIds,
          entries,
          size: entries.length,
          lastActiveAt: latestTs > 0 ? new Date(latestTs).toISOString() : '',
          groupType,
          groupId,
          groupName,
          projectGroupId,
          projectGroupName,
          bucketKey,
        });
      });

      const stateRank = { now: 0, next: 1, other: 2 };
      worms.sort((left, right) => {
        const rankDiff = (stateRank[left.state] ?? 99) - (stateRank[right.state] ?? 99);
        if (rankDiff !== 0) return rankDiff;
        if (right.heat !== left.heat) return right.heat - left.heat;
        if (right.size !== left.size) return right.size - left.size;
        const leftTs = Date.parse(String(left.lastActiveAt || '').trim()) || 0;
        const rightTs = Date.parse(String(right.lastActiveAt || '').trim()) || 0;
        if (rightTs !== leftTs) return rightTs - leftTs;
        return String(left.title || '').localeCompare(String(right.title || ''));
      });

      return { worms, byThoughtId };
    }

    return {
      buildThoughtWormAnalysis,
    };
  }

  window.MorphThoughtWormRuntime = {
    create: createThoughtWormRuntime,
  };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createThoughtWormDepsRuntime(root) {
    const currentRoot = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || currentRoot;
    const getGlobalFunction = (name = '') => {
      const key = String(name || '').trim();
      if (!key) return null;
      const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
      if (typeof fromGlobal === 'function') return fromGlobal;
      const fromRoot = currentRoot && typeof currentRoot[key] === 'function' ? currentRoot[key] : null;
      return typeof fromRoot === 'function' ? fromRoot : null;
    };
    const getGlobalValue = (name = '', fallback = null) => {
      const key = String(name || '').trim();
      if (!key) return fallback;
      if (globalRoot && typeof globalRoot[key] !== 'undefined') return globalRoot[key];
      if (currentRoot && typeof currentRoot[key] !== 'undefined') return currentRoot[key];
      return fallback;
    };

    function buildAppDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        getDataRoot: pickFunction(context.getDataRoot, () => {
          const value = getGlobalValue('data', null);
          return value && typeof value === 'object' ? value : null;
        }),
        sortThoughtsNewestFirst: pickFunction(context.sortThoughtsNewestFirst, getGlobalFunction('sortThoughtsNewestFirst') || ((items) => (Array.isArray(items) ? items.slice() : []))),
        parseThoughtTimestamp: pickFunction(context.parseThoughtTimestamp, getGlobalFunction('parseThoughtTimestamp') || (() => 0)),
        getOrbDisplayText: pickFunction(context.getOrbDisplayText, getGlobalFunction('getOrbDisplayText') || ((item) => String(item?.text || '').trim())),
        getFlashThoughtProjectGroupId: pickFunction(context.getFlashThoughtProjectGroupId, getGlobalFunction('getFlashThoughtProjectGroupId') || (() => '')),
        getFlashThoughtProjectGroupName: pickFunction(context.getFlashThoughtProjectGroupName, getGlobalFunction('getFlashThoughtProjectGroupName') || (() => '')),
        getFlashThoughtWormGroup: pickFunction(context.getFlashThoughtWormGroup, getGlobalFunction('getFlashThoughtWormGroup') || (() => null)),
        getThoughtEdgeRefs: pickFunction(context.getThoughtEdgeRefs, getGlobalFunction('getThoughtEdgeRefs') || (() => [])),
        parseThoughtRef: pickFunction(context.parseThoughtRef, getGlobalFunction('parseThoughtRef') || (() => ({ source: '', id: '' }))),
        extractThoughtWormTokenSet: pickFunction(context.extractThoughtWormTokenSet, getGlobalFunction('extractThoughtWormTokenSet') || (() => new Set())),
        computeThoughtWormLinkAffinity: pickFunction(context.computeThoughtWormLinkAffinity, getGlobalFunction('computeThoughtWormLinkAffinity') || (() => ({ score: 0, directEdge: false }))),
        computeThoughtWormTemporalScore: pickFunction(context.computeThoughtWormTemporalScore, getGlobalFunction('computeThoughtWormTemporalScore') || (() => 0)),
        splitThoughtWormOrderedIds: pickFunction(context.splitThoughtWormOrderedIds, getGlobalFunction('splitThoughtWormOrderedIds') || ((ids) => [Array.isArray(ids) ? ids.slice() : []])),
        buildThoughtWormTitleFromEntries: pickFunction(context.buildThoughtWormTitleFromEntries, getGlobalFunction('buildThoughtWormTitleFromEntries') || ((entries) => String(entries?.[0]?.text || '思维虫').trim() || '思维虫')),
        genId: pickFunction(context.genId, getGlobalFunction('genId') || (() => `worm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`)),
      };
    }

    return { buildAppDeps };
  }

  window.MorphThoughtWormDepsRuntime = { create: () => createThoughtWormDepsRuntime(window) };
})();
