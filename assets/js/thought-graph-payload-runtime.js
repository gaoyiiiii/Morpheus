// @ts-check

(function initMorphThoughtGraphPayloadRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphThoughtGraphPayloadRuntime && typeof window.MorphThoughtGraphPayloadRuntime.create === 'function';
  const hasDepsRuntime = window.MorphThoughtGraphPayloadDepsRuntime && typeof window.MorphThoughtGraphPayloadDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createThoughtGraphPayloadRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const renderKeyByContainer = new WeakMap();
    const getThoughtRef = typeof api.getThoughtRef === 'function' ? api.getThoughtRef : ((kind, id) => `${String(kind || '').trim()}:${String(id || '').trim()}`);
    const parseThoughtRef = typeof api.parseThoughtRef === 'function' ? api.parseThoughtRef : () => ({ source: '', id: '' });
    const findActiveThoughtByRef = typeof api.findActiveThoughtByRef === 'function' ? api.findActiveThoughtByRef : () => null;
    const getThoughtStoredEdgeRefs = typeof api.getThoughtStoredEdgeRefs === 'function' ? api.getThoughtStoredEdgeRefs : () => [];
    const getThoughtEdgeRefs = typeof api.getThoughtEdgeRefs === 'function' ? api.getThoughtEdgeRefs : () => [];
    const buildThoughtWormAnalysis = typeof api.buildThoughtWormAnalysis === 'function' ? api.buildThoughtWormAnalysis : () => ({ worms: [], byThoughtId: new Map() });
    const parseThoughtTimestamp = typeof api.parseThoughtTimestamp === 'function' ? api.parseThoughtTimestamp : () => 0;
    const getThoughtGraphCoords = typeof api.getThoughtGraphCoords === 'function' ? api.getThoughtGraphCoords : () => ({ x: 0, y: 0 });
    const getOrbDisplayText = typeof api.getOrbDisplayText === 'function' ? api.getOrbDisplayText : (item) => String(item?.text || '').trim();
    const getThoughtGraphRuntime = typeof api.getThoughtGraphRuntime === 'function' ? api.getThoughtGraphRuntime : () => null;
    const findLinkedProjectForFixedThought = typeof api.findLinkedProjectForFixedThought === 'function' ? api.findLinkedProjectForFixedThought : () => null;
    const findProjectById = typeof api.findProjectById === 'function' ? api.findProjectById : () => null;
    const findLinkedFixedThoughtForProject = typeof api.findLinkedFixedThoughtForProject === 'function' ? api.findLinkedFixedThoughtForProject : () => null;
    const getChildProjects = typeof api.getChildProjects === 'function' ? api.getChildProjects : () => [];
    const escapeHTML = typeof api.escapeHTML === 'function'
      ? api.escapeHTML
      : (value = '') => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    function getThoughtGraphRole(kind = '') {
      return String(kind || '').trim().toLowerCase().includes('fixed') ? 'fixed' : 'flash';
    }

    function buildThoughtGraphStableSignature(value = '') {
      const text = String(value || '');
      let hash = 2166136261;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return `${text.length}:${(hash >>> 0).toString(16)}`;
    }

    function isThoughtGraphFlashKind(kind = '') {
      const normalized = String(kind || '').trim();
      return normalized === 'flashThoughts' || normalized === 'completedFlashThoughts';
    }

    function isThoughtGraphFixedKind(kind = '') {
      const normalized = String(kind || '').trim();
      return normalized === 'fixed' || normalized === 'completedFixedThoughts';
    }

    function getThoughtGraphSeedCoords(nodeKey, index, total, zone = 'edge') {
      const coords = getThoughtGraphCoords(nodeKey, index, total, zone);
      return { x: Number(coords?.x || 0), y: Number(coords?.y || 0) };
    }

    function getThoughtWormAssignmentMap(analysis = null) {
      const result = new Map();
      if (!analysis || typeof analysis !== 'object') return result;
      const rawMap = analysis.byThoughtId;
      if (rawMap instanceof Map) {
        rawMap.forEach((value, key) => {
          const thoughtId = String(key || '').trim();
          if (!thoughtId || !value || typeof value !== 'object') return;
          result.set(thoughtId, value);
        });
      } else if (rawMap && typeof rawMap === 'object' && !Array.isArray(rawMap)) {
        Object.keys(rawMap).forEach((key) => {
          const thoughtId = String(key || '').trim();
          const value = rawMap[key];
          if (!thoughtId || !value || typeof value !== 'object') return;
          result.set(thoughtId, value);
        });
      }
      if (result.size > 0) return result;
      const worms = Array.isArray(analysis.worms) ? analysis.worms : [];
      worms.forEach((worm) => {
        const wormId = String(worm?.id || '').trim();
        const thoughtIds = Array.isArray(worm?.thoughtIds)
          ? worm.thoughtIds.map((id) => String(id || '').trim()).filter(Boolean)
          : [];
        const turnPointIds = worm?.turnPointIds instanceof Set
          ? worm.turnPointIds
          : new Set(Array.isArray(worm?.turnPointIds) ? worm.turnPointIds.map((id) => String(id || '').trim()) : []);
        thoughtIds.forEach((thoughtId, index) => {
          if (!thoughtId) return;
          result.set(thoughtId, {
            wormId,
            wormTitle: String(worm?.title || '').trim(),
            wormRole: index === 0 ? 'seed' : (turnPointIds.has(thoughtId) ? 'turn' : 'flow'),
            wormOrder: index + 1,
            transitionScore: 0,
            state: String(worm?.state || '').trim(),
            heat: Number(worm?.heat) || 0,
          });
        });
      });
      return result;
    }

    function buildThoughtWormGroupMetaMap(analysis = null) {
      const metaMap = new Map();
      const worms = Array.isArray(analysis?.worms) ? analysis.worms : [];
      worms.forEach((worm) => {
        const groupType = String(worm?.groupType || (worm?.projectGroupId ? 'project' : '')).trim();
        const groupId = String(worm?.groupId || worm?.projectGroupId || '').trim();
        if (!groupType || !groupId) return;
        metaMap.set(`${groupType}:${groupId}`, {
          wormId: String(worm?.id || `worm_${groupType}_${groupId}`).trim(),
          wormTitle: String(worm?.title || '').trim(),
          state: String(worm?.state || '').trim(),
          heat: Number(worm?.heat) || 0,
        });
      });
      return metaMap;
    }

    function resolveFixedThoughtWormAssignment(item, groupMetaMap = null) {
      const linkedProject = findLinkedProjectForFixedThought(item);
      const projectId = String(linkedProject?.id || '').trim();
      const fixedId = String(item?.id || '').trim();
      const groupType = projectId ? 'project' : 'fixed';
      const groupId = projectId || fixedId;
      if (!groupId) return null;
      const groupKey = `${groupType}:${groupId}`;
      const groupName = projectId
        ? String(linkedProject?.name || '').trim()
        : String(getOrbDisplayText(item) || item?.text || '定念群组').trim();
      const groupMeta = groupMetaMap instanceof Map ? (groupMetaMap.get(groupKey) || null) : null;
      if (!projectId && !groupMeta) return null;
      const ts = parseThoughtTimestamp(item);
      const ageDays = ts > 0 ? (Date.now() - ts) / 86400000 : 999;
      return {
        wormId: String(groupMeta?.wormId || `worm_${groupType}_${groupId}`).trim(),
        wormTitle: String(groupMeta?.wormTitle || groupName || getOrbDisplayText(item) || item?.text || '项目定念').trim(),
        wormRole: 'anchor',
        wormOrder: 0,
        transitionScore: 0,
        state: String(groupMeta?.state || (ageDays <= 3 ? 'now' : (ageDays <= 14 ? 'next' : 'other'))).trim(),
        heat: Number(groupMeta?.heat) || 0.72,
        projectGroupId: projectId,
      };
    }

    function resolveProjectHierarchyRootId(project = null) {
      let cursor = project && typeof project === 'object' ? project : null;
      const visited = new Set();
      let fallbackId = String(cursor?.id || '').trim();
      while (cursor && typeof cursor === 'object') {
        const cursorId = String(cursor?.id || '').trim();
        if (cursorId) fallbackId = cursorId;
        const parentProjectId = String(cursor?.parentProjectId || '').trim();
        if (!parentProjectId || visited.has(parentProjectId)) return fallbackId;
        visited.add(parentProjectId);
        const parentProject = findProjectById(parentProjectId);
        if (!parentProject) return fallbackId;
        cursor = parentProject;
      }
      return fallbackId;
    }

    function buildThoughtGraphVisualGroupMap(entries) {
      const list = Array.isArray(entries) ? entries.filter((entry) => entry?.item?.id && entry?.kind) : [];
      const visibleRefToNodeKey = new Map();
      list.forEach((entry) => {
        visibleRefToNodeKey.set(getThoughtRef(entry.kind, entry.item.id), `${entry.kind}:${entry.item.id}`);
      });
      const visited = new Set();
      const groups = [];
      visibleRefToNodeKey.forEach((_nodeKey, ref) => {
        if (visited.has(ref)) return;
        const parsed = parseThoughtRef(ref);
        const item = findActiveThoughtByRef(parsed.source, parsed.id);
        if (!item) return;
        const stack = [ref];
        const component = [];
        visited.add(ref);
        while (stack.length) {
          const current = stack.pop();
          component.push(current);
          const currentParsed = parseThoughtRef(current);
          const currentItem = findActiveThoughtByRef(currentParsed.source, currentParsed.id);
          if (!currentItem) continue;
          getThoughtEdgeRefs(currentItem).forEach((neighborRef) => {
            if (!visibleRefToNodeKey.has(neighborRef) || visited.has(neighborRef)) return;
            visited.add(neighborRef);
            stack.push(neighborRef);
          });
        }
        if (component.length > 1) groups.push(component);
      });

      const accentPalette = [
        { stroke: 'rgba(128, 128, 128, 0.34)', glow: 'rgba(186, 186, 186, 0.12)', badgeBg: 'rgba(128, 128, 128, 0.12)', badgeText: '#6f6f6f' },
        { stroke: 'rgba(156, 156, 156, 0.34)', glow: 'rgba(214, 214, 214, 0.12)', badgeBg: 'rgba(156, 156, 156, 0.12)', badgeText: '#7b7b7b' },
        { stroke: 'rgba(112, 112, 112, 0.34)', glow: 'rgba(172, 172, 172, 0.11)', badgeBg: 'rgba(112, 112, 112, 0.12)', badgeText: '#666666' },
        { stroke: 'rgba(176, 176, 176, 0.32)', glow: 'rgba(228, 228, 228, 0.12)', badgeBg: 'rgba(176, 176, 176, 0.11)', badgeText: '#858585' },
        { stroke: 'rgba(94, 94, 94, 0.34)', glow: 'rgba(152, 152, 152, 0.11)', badgeBg: 'rgba(94, 94, 94, 0.12)', badgeText: '#5f5f5f' },
        { stroke: 'rgba(144, 144, 144, 0.33)', glow: 'rgba(204, 204, 204, 0.11)', badgeBg: 'rgba(144, 144, 144, 0.12)', badgeText: '#767676' },
      ];

      const metaMap = new Map();
      groups
        .sort((a, b) => b.length - a.length)
        .forEach((component, index) => {
          const accent = accentPalette[index % accentPalette.length];
          const token = String(index + 1);
          const groupKey = `group-${index + 1}`;
          component.forEach((ref) => {
            const nodeKey = visibleRefToNodeKey.get(ref);
            if (!nodeKey) return;
            metaMap.set(nodeKey, {
              groupKey,
              token,
              size: component.length,
              stroke: accent.stroke,
              glow: accent.glow,
              badgeBg: accent.badgeBg,
              badgeText: accent.badgeText,
            });
          });
        });
      return metaMap;
    }

    function getVisibleThoughtRelationRefs(item, kind = '', layoutMode = 'default') {
      const baseRefs = layoutMode === 'worms'
        ? getThoughtStoredEdgeRefs(item)
        : getThoughtEdgeRefs(item);
      const refs = Array.isArray(baseRefs)
        ? baseRefs.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [];
      if (layoutMode !== 'worms') return refs;
      if (!isThoughtGraphFlashKind(kind)) return [];
      const ownRef = getThoughtRef(kind, item?.id);
      if (!ownRef) return [];
      const explicitFixedRefs = refs.filter((ref) => {
        const parsed = parseThoughtRef(ref);
        if (!parsed.source || !parsed.id) return false;
        if (!isThoughtGraphFixedKind(parsed.source)) return false;
        const target = findActiveThoughtByRef(parsed.source, parsed.id);
        if (!target) return false;
        const targetStoredRefs = getThoughtStoredEdgeRefs(target);
        return Array.isArray(targetStoredRefs) && targetStoredRefs.includes(ownRef);
      });
      if (!explicitFixedRefs.length) return [];
      return [explicitFixedRefs[explicitFixedRefs.length - 1]];
    }

    function buildThoughtGraphWormGroupMetaMap(entries, wormAnalysis = null) {
      const list = Array.isArray(entries) ? entries.filter((entry) => entry?.item?.id && entry?.kind) : [];
      const flashItems = list
        .filter((entry) => isThoughtGraphFlashKind(entry?.kind))
        .map((entry) => entry.item);
      const analysis = (wormAnalysis && wormAnalysis.byThoughtId instanceof Map)
        ? wormAnalysis
        : buildThoughtWormAnalysis(flashItems);
      const assignmentMap = getThoughtWormAssignmentMap(analysis);
      const projectMetaMap = buildThoughtWormGroupMetaMap(analysis);
      const buckets = new Map();
      list.forEach((entry) => {
        const item = entry.item;
        const kind = String(entry.kind || '').trim();
        const assignment = isThoughtGraphFlashKind(kind)
          ? (assignmentMap.get(String(item?.id || '').trim()) || null)
          : (isThoughtGraphFixedKind(kind) ? resolveFixedThoughtWormAssignment(item, projectMetaMap) : null);
        const wormId = String(assignment?.wormId || '').trim();
        if (!wormId) return;
        if (!buckets.has(wormId)) buckets.set(wormId, { wormId, nodes: [] });
        buckets.get(wormId).nodes.push(`${kind}:${item.id}`);
      });
      const accentPalette = [
        { stroke: 'rgba(118, 118, 118, 0.34)', glow: 'rgba(172, 172, 172, 0.13)', badgeBg: 'rgba(118, 118, 118, 0.11)', badgeText: '#777777' },
        { stroke: 'rgba(138, 138, 138, 0.34)', glow: 'rgba(198, 198, 198, 0.13)', badgeBg: 'rgba(138, 138, 138, 0.11)', badgeText: '#8b8b8b' },
        { stroke: 'rgba(124, 124, 124, 0.34)', glow: 'rgba(184, 184, 184, 0.13)', badgeBg: 'rgba(124, 124, 124, 0.11)', badgeText: '#7c7c7c' },
        { stroke: 'rgba(98, 98, 98, 0.34)', glow: 'rgba(156, 156, 156, 0.12)', badgeBg: 'rgba(98, 98, 98, 0.11)', badgeText: '#666666' },
        { stroke: 'rgba(148, 148, 148, 0.33)', glow: 'rgba(206, 206, 206, 0.13)', badgeBg: 'rgba(148, 148, 148, 0.11)', badgeText: '#909090' },
        { stroke: 'rgba(168, 168, 168, 0.33)', glow: 'rgba(222, 222, 222, 0.13)', badgeBg: 'rgba(168, 168, 168, 0.11)', badgeText: '#969696' },
      ];
      const metaMap = new Map();
      Array.from(buckets.values())
        .sort((a, b) => b.nodes.length - a.nodes.length)
        .forEach((bucket, index) => {
          const accent = accentPalette[index % accentPalette.length];
          const token = String(index + 1);
          const groupKey = `worm-${bucket.wormId}`;
          bucket.nodes.forEach((nodeKey) => {
            metaMap.set(nodeKey, {
              groupKey,
              token,
              size: bucket.nodes.length,
              stroke: accent.stroke,
              glow: accent.glow,
              badgeBg: accent.badgeBg,
              badgeText: accent.badgeText,
            });
          });
        });
      return metaMap;
    }

    function buildThoughtGraphPayload(entries, options = {}) {
      const list = Array.isArray(entries) ? entries.filter((entry) => entry?.item?.id && entry?.kind) : [];
      const flashEntries = list.filter((entry) => isThoughtGraphFlashKind(entry?.kind));
      const mode = options.mode === 'archived' ? 'archived' : 'active';
      const layoutMode = String(options.layoutMode || '').trim() === 'worms' ? 'worms' : 'default';
      const wormAnalysis = layoutMode === 'worms'
        ? (options?.wormAnalysis && options.wormAnalysis.byThoughtId instanceof Map
          ? options.wormAnalysis
          : buildThoughtWormAnalysis(flashEntries.map((entry) => entry.item)))
        : null;
      const wormAssignmentMap = getThoughtWormAssignmentMap(wormAnalysis);
      const projectWormMetaMap = buildThoughtWormGroupMetaMap(wormAnalysis);
      const focusKind = options.focusKind === 'fixed' || options.focusKind === 'flash' ? options.focusKind : '';
      const groupMetaMap = layoutMode === 'worms'
        ? buildThoughtGraphWormGroupMetaMap(list, wormAnalysis)
        : buildThoughtGraphVisualGroupMap(list);
      const buckets = { flash: [], fixed: [] };
      const bucketIndexByNodeKey = new Map();
      list.forEach((entry) => {
        const role = getThoughtGraphRole(entry.kind);
        const index = buckets[role].push(entry) - 1;
        bucketIndexByNodeKey.set(`${entry.kind}:${entry.item.id}`, index);
      });
      const flashTimeline = flashEntries
        .map((entry) => ({
          nodeId: `${entry.kind}:${entry.item.id}`,
          ts: parseThoughtTimestamp(entry.item),
        }))
        .sort((a, b) => {
          if (a.ts !== b.ts) return a.ts - b.ts;
          return a.nodeId.localeCompare(b.nodeId);
        });
      const timeNormByNodeId = new Map();
      const denom = Math.max(1, flashTimeline.length - 1);
      flashTimeline.forEach((entry, index) => {
        timeNormByNodeId.set(entry.nodeId, flashTimeline.length <= 1 ? 0.5 : (index / denom));
      });

      const nodes = list.map((entry) => {
        const { item, kind } = entry;
        const nodeKey = `${kind}:${item.id}`;
        const role = getThoughtGraphRole(kind);
        const bucket = buckets[role];
        const index = Math.max(0, Number(bucketIndexByNodeKey.get(nodeKey)) || 0);
        const zone = focusKind
          ? (role === focusKind ? 'center' : 'edge')
          : (role === 'fixed' ? 'center' : 'edge');
        const seed = getThoughtGraphSeedCoords(nodeKey, index, Math.max(1, bucket.length), zone);
        const groupMeta = groupMetaMap.get(nodeKey) || null;
        const assignment = role === 'flash'
          ? (wormAssignmentMap.get(String(item?.id || '').trim()) || null)
          : (role === 'fixed' ? resolveFixedThoughtWormAssignment(item, projectWormMetaMap) : null);
        const linkedProject = role === 'fixed' ? findLinkedProjectForFixedThought(item) : null;
        const parentProjectId = String(linkedProject?.parentProjectId || '').trim();
        const parentProject = role === 'fixed' && parentProjectId ? findProjectById(parentProjectId) : null;
        const parentFixed = role === 'fixed' && parentProject ? findLinkedFixedThoughtForProject(parentProject) : null;
        const parentFixedNodeId = role === 'fixed' && parentFixed?.id ? `fixed:${String(parentFixed.id || '').trim()}` : '';
        const hierarchyClusterId = role === 'fixed'
          ? resolveProjectHierarchyRootId(linkedProject)
          : '';
        return {
          id: nodeKey,
          rawId: item.id,
          kind,
          role,
          label: getOrbDisplayText(item) || item.text || '',
          wormId: String(assignment?.wormId || '').trim(),
          wormRole: String(assignment?.wormRole || '').trim(),
          wormOrder: Number(assignment?.wormOrder) || 0,
          transitionScore: Number(assignment?.transitionScore) || 0,
          timeNorm: role === 'flash' ? (Number(timeNormByNodeId.get(nodeKey)) || 0) : 0,
          groupKey: groupMeta?.groupKey || '',
          groupStroke: groupMeta?.stroke || '',
          groupGlow: groupMeta?.glow || '',
          linkedProjectId: String(linkedProject?.id || '').trim(),
          parentFixedNodeId,
          hierarchyClusterId: String(hierarchyClusterId || '').trim(),
          seedX: seed.x,
          seedY: seed.y,
          pinned: false,
        };
      });

      const nodeById = new Map();
      nodes.forEach((node) => {
        const nodeId = String(node?.id || '').trim();
        if (!nodeId) return;
        nodeById.set(nodeId, node);
      });
      const nodeIds = new Set(nodeById.keys());
      const edgeSet = new Set();
      const edges = [];
      const addEdge = (sourceId, targetId, meta = {}) => {
        if (!sourceId || !targetId || sourceId === targetId) return;
        if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return;
        const kind = String(meta?.kind || 'relation').trim() || 'relation';
        const edgeKey = `${[sourceId, targetId].sort().join('::')}::${kind}`;
        if (edgeSet.has(edgeKey)) return;
        edgeSet.add(edgeKey);
        edges.push({
          source: sourceId,
          target: targetId,
          kind,
        });
      };
      if (layoutMode === 'worms') {
        const anchorByWormId = new Map();
        nodes.forEach((node) => {
          const wormId = String(node?.wormId || '').trim();
          if (!wormId || node.role !== 'fixed' || String(node?.wormRole || '').trim() !== 'anchor') return;
          anchorByWormId.set(wormId, node.id);
        });
        nodes.forEach((node) => {
          const wormId = String(node?.wormId || '').trim();
          if (!wormId || node.role !== 'flash') return;
          const anchorId = String(anchorByWormId.get(wormId) || '').trim();
          if (!anchorId || anchorId === node.id) return;
          addEdge(anchorId, node.id, { kind: 'worm-anchor' });
        });
        list.forEach(({ item, kind }) => {
          if (!isThoughtGraphFixedKind(kind)) return;
          const sourceId = `${kind}:${item.id}`;
          const sourceNode = nodeById.get(sourceId) || null;
          const parentFixedNodeId = String(sourceNode?.parentFixedNodeId || '').trim();
          if (!parentFixedNodeId) return;
          addEdge(parentFixedNodeId, sourceId, { kind: 'project-hierarchy' });
        });
        list.forEach(({ item, kind }) => {
          const sourceId = `${kind}:${item.id}`;
          getVisibleThoughtRelationRefs(item, kind, layoutMode).forEach((ref) => {
            const parsed = parseThoughtRef(ref);
            const targetId = `${parsed.source}:${parsed.id}`;
            addEdge(sourceId, targetId, { kind: 'relation' });
          });
        });
      } else {
        list.forEach(({ item, kind }) => {
          const sourceId = `${kind}:${item.id}`;
          getVisibleThoughtRelationRefs(item, kind, layoutMode).forEach((ref) => {
            const parsed = parseThoughtRef(ref);
            const targetId = `${parsed.source}:${parsed.id}`;
            addEdge(sourceId, targetId, { kind: 'relation' });
          });
        });
      }

      const edgeSignature = edges
        .map((edge) => `${edge.source}->${edge.target}:${String(edge?.kind || 'relation').trim() || 'relation'}`)
        .sort()
        .join('|');
      const nodeSignature = nodes
        .map((node) => [
          String(node?.id || '').trim(),
          String(node?.wormId || '').trim(),
          String(node?.wormRole || '').trim(),
          String(node?.groupKey || '').trim(),
          String(node?.linkedProjectId || '').trim(),
          String(node?.parentFixedNodeId || '').trim(),
        ].join('::'))
        .filter(Boolean)
        .sort()
        .join('|');
      const nodeRenderSignature = nodes
        .map((node) => [
          String(node?.id || '').trim(),
          buildThoughtGraphStableSignature(node?.label || ''),
          String(node?.groupStroke || '').trim(),
          String(node?.groupGlow || '').trim(),
          Number(node?.seedX || 0).toFixed(2),
          Number(node?.seedY || 0).toFixed(2),
          node?.pinned === true ? '1' : '0',
        ].join('::'))
        .filter(Boolean)
        .sort()
        .join('|');

      return {
        mode,
        layoutMode,
        focusKind,
        layoutKey: `${mode}:${layoutMode}:${nodeSignature}::${edgeSignature}`,
        renderKey: `${mode}:${layoutMode}:${focusKind}:${nodeRenderSignature}::${edgeSignature}`,
        nodes,
        edges,
      };
    }

    async function renderThoughtGraph(container, entries, options = {}) {
      if (!container) return;
      const runtime = getThoughtGraphRuntime();
      const emptyLabel = String(options.emptyLabel || '暂无念头 (Empty)').trim();
      if (!runtime) {
        container.innerHTML = `<div class="thought-graph-empty">${escapeHTML(emptyLabel)}</div>`;
        return;
      }
      const payload = buildThoughtGraphPayload(entries, options);
      if (!payload.nodes.length) {
        runtime.unmount();
        renderKeyByContainer.delete(container);
        container.dataset.orbLayout = 'graph';
        container.innerHTML = `<div class="thought-graph-empty">${escapeHTML(emptyLabel)}</div>`;
        return;
      }
      container.dataset.orbLayout = 'graph';
      delete container.dataset.orbFocus;
      const mountedToCurrentContainer = typeof runtime.isMountedTo === 'function'
        ? runtime.isMountedTo(container)
        : runtime.isActive();
      const nextRenderKey = String(payload?.renderKey || payload?.layoutKey || '').trim();
      if (runtime.isActive() && mountedToCurrentContainer) {
        if (nextRenderKey && renderKeyByContainer.get(container) === nextRenderKey) {
          return;
        }
        runtime.update(payload);
        if (nextRenderKey) renderKeyByContainer.set(container, nextRenderKey);
        return;
      }
      runtime.mount(container, payload);
      if (nextRenderKey) renderKeyByContainer.set(container, nextRenderKey);
    }

    return {
      buildThoughtGraphVisualGroupMap,
      buildThoughtGraphWormGroupMetaMap,
      buildThoughtGraphPayload,
      renderThoughtGraph,
    };
  }

  window.MorphThoughtGraphPayloadRuntime = {
    create: createThoughtGraphPayloadRuntime,
  };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createThoughtGraphPayloadDepsRuntime(root) {
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

    function buildAppDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        getThoughtRef: pickFunction(context.getThoughtRef, getGlobalFunction('getThoughtRef') || ((kind, id) => `${String(kind || '').trim()}:${String(id || '').trim()}`)),
        parseThoughtRef: pickFunction(context.parseThoughtRef, getGlobalFunction('parseThoughtRef') || (() => ({ source: '', id: '' }))),
        findActiveThoughtByRef: pickFunction(context.findActiveThoughtByRef, getGlobalFunction('findActiveThoughtByRef') || (() => null)),
        getThoughtStoredEdgeRefs: pickFunction(context.getThoughtStoredEdgeRefs, getGlobalFunction('getThoughtStoredEdgeRefs') || (() => [])),
        getThoughtEdgeRefs: pickFunction(context.getThoughtEdgeRefs, getGlobalFunction('getThoughtEdgeRefs') || (() => [])),
        buildThoughtWormAnalysis: pickFunction(context.buildThoughtWormAnalysis, getGlobalFunction('buildThoughtWormAnalysis') || (() => ({ worms: [], byThoughtId: new Map() }))),
        parseThoughtTimestamp: pickFunction(context.parseThoughtTimestamp, getGlobalFunction('parseThoughtTimestamp') || (() => 0)),
        getThoughtGraphCoords: pickFunction(context.getThoughtGraphCoords, getGlobalFunction('getThoughtGraphCoords') || (() => ({ x: 0, y: 0 }))),
        getOrbDisplayText: pickFunction(context.getOrbDisplayText, getGlobalFunction('getOrbDisplayText') || ((item) => String(item?.text || '').trim())),
        getThoughtGraphRuntime: pickFunction(context.getThoughtGraphRuntime, getGlobalFunction('getThoughtGraphRuntime') || (() => null)),
        findLinkedProjectForFixedThought: pickFunction(context.findLinkedProjectForFixedThought, getGlobalFunction('findLinkedProjectForFixedThought') || (() => null)),
        findProjectById: pickFunction(context.findProjectById, getGlobalFunction('findProjectById') || (() => null)),
        findLinkedFixedThoughtForProject: pickFunction(context.findLinkedFixedThoughtForProject, getGlobalFunction('findLinkedFixedThoughtForProject') || (() => null)),
        getChildProjects: pickFunction(context.getChildProjects, getGlobalFunction('getChildProjects') || (() => [])),
        escapeHTML: pickFunction(context.escapeHTML, getGlobalFunction('escapeHTML') || ((value = '') => String(value || ''))),
      };
    }

    return { buildAppDeps };
  }

  window.MorphThoughtGraphPayloadDepsRuntime = { create: () => createThoughtGraphPayloadDepsRuntime(window) };
})();
