// @ts-check

(function initMorphContextGridRenderRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphContextGridRenderRuntime && typeof window.MorphContextGridRenderRuntime.create === 'function';
  const hasDepsRuntime = window.MorphContextGridRenderDepsRuntime && typeof window.MorphContextGridRenderDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createContextGridRenderRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const escapeHtml = (value = '') => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const escapeAttr = escapeHtml;
    const escapeJsString = (value = '') => String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

    function getDataRoot() {
      if (typeof api.getDataRoot === 'function') {
        const dataRoot = api.getDataRoot();
        if (dataRoot && typeof dataRoot === 'object') return dataRoot;
      }
      return null;
    }

    function getProjectTimestamp(project = null) {
      if (!project || typeof project !== 'object') return 0;
      const candidates = [
        project.updatedAt,
        project.createdAt,
        project.sourceThought && project.sourceThought.createdAt,
      ];
      for (const value of candidates) {
        const parsed = Date.parse(String(value || '').trim());
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
      return 0;
    }

    function getProjectGraphFolderKind(project = null, index = 0, childCount = 0) {
      if (index < 3 || childCount > 1) return 'open';
      if (index < 9 || childCount > 0) return 'near';
      return 'far';
    }

    function buildProjectGraphView(rawProjects = [], options = {}) {
      const safeProjects = (Array.isArray(rawProjects) ? rawProjects : [])
        .filter((project) => project && typeof project === 'object' && String(project.id || '').trim())
        .slice(0, 32);
      if (!safeProjects.length) return options.emptyHtml || '';

      const projectMap = new Map(safeProjects.map((project) => [String(project.id || '').trim(), project]));
      const childrenById = new Map();
      const parentById = new Map();
      safeProjects.forEach((project) => {
        const parentId = String(project.parentProjectId || '').trim();
        if (!parentId || !projectMap.has(parentId)) return;
        parentById.set(String(project.id || '').trim(), parentId);
        if (!childrenById.has(parentId)) childrenById.set(parentId, []);
        childrenById.get(parentId).push(project);
      });
      childrenById.forEach((children) => {
        children.sort((a, b) => getProjectTimestamp(b) - getProjectTimestamp(a));
      });

      const rootProjects = safeProjects.filter((project) => {
        const parentId = String(project.parentProjectId || '').trim();
        return !parentId || !projectMap.has(parentId);
      });
      const ranked = rootProjects
        .map((project, index) => ({
          project,
          index,
          childCount: Number((childrenById.get(String(project.id || '').trim()) || []).length),
          timestamp: getProjectTimestamp(project),
        }))
        .sort((a, b) => {
          if (b.childCount !== a.childCount) return b.childCount - a.childCount;
          if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
          return a.index - b.index;
        });

      const layout = new Map();
      const countsByKind = { open: 0, near: 0, far: 0 };
      const totalByKind = { open: 0, near: 0, far: 0 };
      const persistedPositions = (typeof api.getProjectGraphFolderPositions === 'function' ? api.getProjectGraphFolderPositions() : null) || {};
      ranked.forEach((entry, index) => {
        const kind = getProjectGraphFolderKind(entry.project, index, entry.childCount);
        totalByKind[kind] += 1;
      });

      ranked.forEach((entry, index) => {
        const projectId = String(entry.project.id || '').trim();
        const kind = getProjectGraphFolderKind(entry.project, index, entry.childCount);
        const slot = countsByKind[kind]++;
        const total = Math.max(1, totalByKind[kind]);
        let x = 50;
        let y = 50;
        const saved = persistedPositions && typeof persistedPositions === 'object' ? persistedPositions[projectId] : null;
        if (saved && Number.isFinite(Number(saved.x)) && Number.isFinite(Number(saved.y))) {
          x = Number(saved.x);
          y = Number(saved.y);
        } else if (kind === 'open') {
          const openPositions = [
            [28, 32],
            [58, 28],
            [43, 62],
          ];
          [x, y] = openPositions[slot] || [50, 50];
        } else {
          const radiusX = kind === 'near' ? 36 : 45;
          const radiusY = kind === 'near' ? 25 : 33;
          const angle = (-Math.PI / 2) + ((slot + 0.5) / total) * Math.PI * 2;
          x = 50 + Math.cos(angle) * radiusX;
          y = 50 + Math.sin(angle) * radiusY;
        }
        layout.set(projectId, {
          x: Math.max(9, Math.min(91, x)),
          y: Math.max(12, Math.min(88, y)),
          kind,
        });
      });

      const edgeHtml = ranked.map((entry) => {
        const node = layout.get(String(entry.project.id || '').trim());
        if (!node) return '';
        return `<line class="project-graph-edge" x1="50" y1="50" x2="${node.x}" y2="${node.y}" />`;
      }).join('');
      const focusState = (typeof api.getProjectGraphFocusState === 'function' ? api.getProjectGraphFocusState() : null) || {};
      const focusedProjectId = String(focusState.projectId || '').trim();
      const focusedProject = focusedProjectId ? projectMap.get(focusedProjectId) : null;
      const focusedChildren = focusedProjectId ? (childrenById.get(focusedProjectId) || []) : [];
      const focusedParentId = focusedProjectId ? String(parentById.get(focusedProjectId) || '').trim() : '';
      const focusedAnchorId = layout.has(focusedProjectId) ? focusedProjectId : focusedParentId;
      const focusedAnchor = focusedAnchorId ? layout.get(focusedAnchorId) : null;
      const focusedMode = focusedProject ? (focusedChildren.length ? 'children' : 'writing') : '';
      const focusPanelX = focusedAnchor ? Math.max(22, Math.min(78, focusedAnchor.x + (focusedAnchor.x < 58 ? 28 : -28))) : 68;
      const focusPanelY = focusedAnchor ? Math.max(18, Math.min(82, focusedAnchor.y + (focusedAnchor.y < 50 ? 12 : -12))) : 42;
      const focusPanelHtml = focusedProject ? (() => {
        const title = escapeHtml(String(focusedProject.name || '').trim() || '未命名项目');
        if (focusedMode === 'children') {
          const childHtml = focusedChildren.slice(0, 12).map((child, childIndex) => {
            const childId = String(child?.id || '').trim();
            const childTitle = escapeHtml(String(child?.name || '').trim() || '未命名子项目');
            const nestedCount = (childrenById.get(childId) || []).length;
            const childItems = Array.isArray(child?.items) ? child.items.length : 0;
            const childBlocks = Array.isArray(child?.blocks) ? child.blocks.length : 0;
            return `
              <button
                type="button"
                class="project-graph-focus-child ${childIndex === 0 ? 'is-lit' : ''}"
                onclick="event.stopPropagation(); handleProjectGraphFolderClick(event, '${escapeJsString(childId)}')"
                oncontextmenu="event.stopPropagation(); handleContextCardRightClick(event, 'project', '${escapeJsString(childId)}')"
              >
                <i></i>
                <span>${childTitle}</span>
                <em>${nestedCount ? `子项目 ${nestedCount}` : `${childItems}/${childBlocks}`}</em>
              </button>
            `;
          }).join('');
          return `
            <aside class="project-graph-focus-panel is-children" style="left:${focusPanelX}%;top:${focusPanelY}%;">
              <div class="project-graph-focus-title">
                <span>${title}</span>
                <button type="button" onclick="event.stopPropagation(); clearProjectGraphFocusState()" aria-label="关闭">×</button>
              </div>
              <div class="project-graph-focus-children">${childHtml}</div>
            </aside>
          `;
        }
        return `
          <aside class="project-graph-focus-panel is-writing" style="left:${focusPanelX}%;top:${focusPanelY}%;">
            <div class="project-graph-focus-title">
              <span>${title}</span>
              <button type="button" onclick="event.stopPropagation(); clearProjectGraphFocusState()" aria-label="关闭">×</button>
            </div>
            <div
              id="project-graph-block-editor-${escapeAttr(focusedProjectId)}"
              class="project-graph-writing-editor no-scrollbar"
              data-project-graph-block-editor-id="${escapeAttr(focusedProjectId)}"
              onpointerdown="event.stopPropagation()"
              onclick="event.stopPropagation()"
              onkeydown="if(event.key!=='Escape')event.stopPropagation()"
            ></div>
          </aside>
        `;
      })() : '';

      const folderHtml = ranked.map((entry, index) => {
        const project = entry.project;
        const projectId = String(project.id || '').trim();
        const node = layout.get(projectId);
        if (!node) return '';
        const children = childrenById.get(projectId) || [];
        const childCount = children.length;
        const itemCount = Array.isArray(project.items) ? project.items.length : 0;
        const blockCount = Array.isArray(project.blocks) ? project.blocks.length : 0;
        const label = escapeHtml(String(project.name || '').trim() || '未命名项目');
        const sideItems = [
          childCount ? `子项目 ${childCount}` : '独立项目',
          itemCount ? `闪念 ${itemCount}` : '闪念 0',
          blockCount ? `文字 ${blockCount}` : '文字 0',
        ];
        const childFolders = children.slice(0, 8).map((child, childIndex) => {
          const childId = String(child?.id || '').trim();
          const childLabel = escapeHtml(String(child?.name || '').trim() || '未命名子项目');
          const childItems = Array.isArray(child?.items) ? child.items.length : 0;
          const childBlocks = Array.isArray(child?.blocks) ? child.blocks.length : 0;
          return `
            <button
              type="button"
              class="project-graph-child-folder ${childIndex === 0 ? 'is-lit' : ''}"
              onclick="event.stopPropagation(); handleProjectGraphFolderClick(event, '${escapeJsString(childId)}')"
              oncontextmenu="event.stopPropagation(); handleContextCardRightClick(event, 'project', '${escapeJsString(childId)}')"
            >
              <i></i>
              <span>${childLabel}</span>
              <em>${childItems}/${childBlocks}</em>
            </button>
          `;
        }).join('');
        const looseFiles = [
          itemCount ? `thoughts_${String(itemCount).padStart(2, '0')}` : 'notes',
          blockCount ? `blocks_${String(blockCount).padStart(2, '0')}` : 'draft',
        ].map((item, itemIndex) => `<span class="project-graph-file-chip ${!childFolders && itemIndex === 0 ? 'is-lit' : ''}"><i></i><b>${escapeHtml(item)}</b></span>`).join('');
        return `
          <div
            role="button"
            tabindex="0"
            class="project-graph-folder is-${node.kind} ${focusedProjectId ? (projectId === focusedAnchorId ? 'is-focus-source' : 'is-dimmed') : ''}"
            style="left:${node.x}%;top:${node.y}%;"
            data-context-card-type="project"
            data-context-card-id="${escapeAttr(projectId)}"
            data-project-graph-folder-id="${escapeAttr(projectId)}"
            onclick="handleProjectGraphFolderClick(event, '${escapeJsString(projectId)}')"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();handleProjectGraphFolderClick(event, '${escapeJsString(projectId)}')}"
            onpointerdown="handleProjectGraphFolderPointerDown(event, '${escapeJsString(projectId)}')"
            oncontextmenu="handleContextCardRightClick(event, 'project', '${escapeJsString(projectId)}')"
          >
            <span class="project-graph-folder-title">${label}</span>
            <span class="project-graph-folder-body">
              <span class="project-graph-folder-sidebar">
                ${sideItems.map((item) => `<i>${escapeHtml(item)}</i>`).join('')}
              </span>
              <span class="project-graph-folder-files">
                ${childFolders || looseFiles}
              </span>
            </span>
            <span class="project-graph-folder-index">${String(index + 1).padStart(2, '0')}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="project-graph-shell">
          <div class="project-graph-stage" aria-label="项目图谱">
            <div class="project-graph-grid"></div>
            <div class="project-graph-center">
              <span>PROJECTS</span>
              <strong>${ranked.length}</strong>
            </div>
            <svg class="project-graph-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${edgeHtml}</svg>
            ${folderHtml}
            ${focusPanelHtml}
          </div>
        </div>
      `;
    }

    function renderContextGrid(contextType) {
      const data = getDataRoot() || {};
      if (contextType === 'project' && typeof api.normalizeProjectCollectionPane === 'function') {
        api.normalizeProjectCollectionPane();
      }
      const activeProjectCollectionPane = typeof api.getActiveProjectCollectionPane === 'function'
        ? api.getActiveProjectCollectionPane()
        : '';
      const sortProjectsNewestFirst = typeof api.sortProjectsNewestFirst === 'function'
        ? api.sortProjectsNewestFirst
        : (list) => (Array.isArray(list) ? list : []);
      const sortProjectsForDirectory = typeof api.sortProjectsForDirectory === 'function'
        ? api.sortProjectsForDirectory
        : sortProjectsNewestFirst;
      const sortProjectsForBoard = typeof api.sortProjectsForBoard === 'function'
        ? api.sortProjectsForBoard
        : sortProjectsNewestFirst;
      const getChildProjects = typeof api.getChildProjects === 'function'
        ? api.getChildProjects
        : () => [];
      const getProjectQueueLaneId = typeof api.getProjectQueueLaneId === 'function'
        ? api.getProjectQueueLaneId
        : () => 'other';
      const getProjectBoardLaneComposerState = typeof api.getProjectBoardLaneComposerState === 'function'
        ? api.getProjectBoardLaneComposerState
        : () => ({ open: false, draft: '' });
      const getProjectQueueLaneDefs = typeof api.getProjectQueueLaneDefs === 'function'
        ? api.getProjectQueueLaneDefs
        : () => (Array.isArray(api.projectQueueLaneDefs) ? api.projectQueueLaneDefs : []);
      const activeProjectViewPane = contextType === 'project' && typeof api.getActiveProjectViewPane === 'function'
        ? String(api.getActiveProjectViewPane() || '').trim() || 'default'
        : 'default';
      const laneDefs = Array.isArray(getProjectQueueLaneDefs()) ? getProjectQueueLaneDefs() : [];
      const emptyTextMap = {
        project: '暂无项目',
      };
      const rawItems = Array.isArray(data[`${contextType}s`]) ? data[`${contextType}s`] : [];
      const items = contextType === 'project'
        ? (activeProjectViewPane === 'board' ? sortProjectsForBoard(rawItems) : sortProjectsForDirectory(rawItems)).filter((item) => {
          const archived = String(item?.status || '').trim() === 'archived' || !!String(item?.archivedAt || '').trim();
          if (archived) return false;
          return !String(item?.parentProjectId || '').trim();
        })
        : rawItems;
      const buildProjectCardMarkup = (p) => {
        const childCount = contextType === 'project' ? getChildProjects(p.id).length : 0;
        const badge = childCount > 0 ? `<span class="inline-flex items-center gap-1 text-[8px] font-mono text-gray-500 dark:text-white/50 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 px-1.5 py-0.5 rounded">子项目 ${childCount}</span>` : '';
        const projectTitle = escapeHtml(String(p?.name || '').trim() || '未命名项目');
        const menuButton = `
          <button
            type="button"
            class="project-card-more-btn relative z-20 inline-flex h-6 w-6 shrink-0 items-center justify-center text-gray-500 transition-all duration-150 hover:text-black dark:text-white/45 dark:hover:text-white"
            aria-label="更多操作"
            title="更多操作"
            onclick="openContextCardMenuFromTrigger(event, '${contextType}', '${p.id}')"
          >
            <i data-lucide="ellipsis" class="w-4 h-4"></i>
          </button>
        `;
        const defaultIcon = contextType === 'project' && activeProjectViewPane !== 'board'
          ? '<i data-lucide="folder" class="mt-0.5 h-4 w-4 shrink-0 text-gray-400 dark:text-white/35"></i>'
          : '';
        const cardBody = `<div class="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-black/20 dark:from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div><div class="relative z-10 flex items-start justify-between gap-3"><div class="min-w-0 flex flex-1 items-start gap-2">${defaultIcon}<div class="min-w-0 flex-1"><h3 class="font-medium text-[15px] text-black dark:text-white/80 line-clamp-2 glow-text">${projectTitle}</h3>${badge ? `<div class="mt-1">${badge}</div>` : ''}</div></div>${menuButton}</div><div class="flex items-center mt-3 relative z-10"><span class="text-[8px] font-mono text-gray-500 dark:text-white/50 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 px-1.5 py-0.5 rounded">闪念/块: ${p.items ? p.items.length : 0} | ${p.blocks ? p.blocks.length : 0}</span></div>`;
        if (contextType === 'project' && activeProjectViewPane === 'board') {
          return `<div class="project-board-card glass-card p-4 sm:p-4 rounded-[1.2rem] cursor-pointer flex flex-col justify-between h-28 sm:h-28 min-h-[112px] drop-zone relative overflow-hidden group" data-context-card-type="${contextType}" data-context-card-id="${p.id}" onclick="handleProjectCardClick('${p.id}')" oncontextmenu="handleContextCardRightClick(event, '${contextType}', '${p.id}')" onpointerdown="handleProjectBoardCardPointerDown(event, '${p.id}')">${cardBody}</div>`;
        }
        return `<div class="project-default-card glass-card p-4 sm:p-4 rounded-[1.2rem] cursor-pointer flex flex-col justify-between h-28 sm:h-28 min-h-[112px] drop-zone relative overflow-hidden group" data-context-card-type="${contextType}" data-context-card-id="${p.id}" onclick="handleProjectCardClick('${p.id}')" oncontextmenu="handleContextCardRightClick(event, '${contextType}', '${p.id}')" onpointerdown="handleProjectDefaultCardPointerDown(event, '${p.id}')" ondragover="allowDrop(event)" ondragleave="dragLeave(event)" ondrop="dropToContextCard(event, '${p.id}', '${contextType}')">${cardBody}</div>`;
      };
      const cardsHtml = items.map((p) => buildProjectCardMarkup(p)).join('');
      const projectEmpty = `<div class="col-span-full text-center py-10 text-gray-500 dark:text-gray-700 font-mono text-[10px] border border-dashed border-gray-300 dark:border-white/5 rounded-[1.5rem] bg-gray-50 dark:bg-white/[0.005]">${emptyTextMap[contextType]} (Empty)</div>`;
      if (contextType === 'project') {
        if (activeProjectCollectionPane !== 'archived' && activeProjectViewPane === 'graph') {
          const graphItems = sortProjectsForDirectory(rawItems).filter((item) => {
            const archived = String(item?.status || '').trim() === 'archived' || !!String(item?.archivedAt || '').trim();
            return !archived;
          });
          return buildProjectGraphView(graphItems, { emptyHtml: projectEmpty });
        }
        if (activeProjectCollectionPane !== 'archived' && activeProjectViewPane === 'board') {
          const laneCards = Object.fromEntries(
            laneDefs.map((lane) => [String(lane?.id || '').trim(), []]),
          );
          items.forEach((project) => {
            const laneId = getProjectQueueLaneId(project);
            if (!laneCards[laneId]) laneCards.other?.push(project);
            else laneCards[laneId].push(project);
          });
          const laneHtml = laneDefs.map((lane) => {
            const laneItems = laneCards[lane.id] || [];
            const laneCardHtml = laneItems.map((p) => buildProjectCardMarkup(p)).join('');
            const laneEmpty = `<div class="project-board-card" data-project-lane-empty="true"><div class="w-full rounded-[0.95rem] border border-dashed border-gray-300 dark:border-white/8 bg-black/5 dark:bg-white/[0.02] px-4 py-5 text-left text-[10px] font-mono text-gray-500 dark:text-white/32">把项目拖到「${lane.label}」</div></div>`;
            return `
                    <section class="project-board-column drop-zone flex flex-col rounded-[1.2rem] p-3" style="background:var(--surface-panel);" data-project-lane-id="${lane.id}" ondragover="allowDrop(event)" ondragleave="dragLeave(event)" ondrop="handleProjectBoardLaneDrop(event, '${lane.id}')">
                        <div class="project-board-lane-head mb-3 rounded-[0.95rem] bg-black/5 px-3.5 py-3 dark:bg-white/[0.03]" data-project-lane-head="true" oncontextmenu="handleProjectQueueLaneContextMenu(event, '${lane.id}')" onpointerdown="handleProjectBoardLanePointerDown(event, '${lane.id}')">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="project-board-lane-title text-[15px] font-medium">${lane.label}</span>
                                        <span class="project-board-lane-count text-[12px] font-mono">${laneItems.length}</span>
                                    </div>
                                    <span class="project-board-lane-hint mt-1 block text-[10px] font-mono">${lane.hint}</span>
                                </div>
                                <div class="flex items-center gap-1 shrink-0">
                                    <button type="button" class="project-board-lane-add-btn inline-flex h-7 w-7 items-center justify-center" aria-label="新增项目" title="新增项目" onclick="promptCreateProjectForQueueLane('${lane.id}')">
                                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                                    </button>
                                    <button type="button" class="project-board-lane-menu-btn inline-flex h-7 w-7 items-center justify-center" aria-label="看板操作" title="看板操作" onclick="openContextCardMenuFromTrigger(event, 'projectQueueLane', '${lane.id}', { kind: 'project-lane' })">
                                        <i data-lucide="ellipsis" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="project-board-cards flex min-h-[16rem] flex-1 flex-col" data-project-lane-cards="true">
                            ${laneCardHtml || laneEmpty}
                        </div>
                    </section>
                `;
          }).join('');
          const composerState = getProjectBoardLaneComposerState();
          const composerOpen = composerState?.open === true;
          const composerDraft = String(composerState?.draft || '');
          const addLaneHtml = `
                    <section class="project-board-column project-board-column-creator flex flex-col rounded-[1.2rem] p-3" style="background:var(--surface-panel);">
                        ${composerOpen ? `
                            <div class="project-board-add-surface flex min-h-[8.15rem] flex-col justify-start rounded-[0.95rem] border border-white/50 bg-black/[0.03] p-4 dark:border-white/8 dark:bg-white/[0.03]">
                                <div class="flex items-center gap-2 text-[14px] font-medium text-black/82 dark:text-white/90">
                                    <i data-lucide="plus" class="h-4 w-4"></i>
                                    <span>新增看板</span>
                                </div>
                                <input
                                    id="project-board-lane-composer-input"
                                    type="text"
                                    value="${escapeHtml(composerDraft)}"
                                    placeholder="输入看板名字，回车创建"
                                    class="project-board-column-input mt-4 w-full rounded-[0.95rem] border border-black/10 bg-white/88 px-3.5 py-3 text-[14px] text-black outline-none transition-colors placeholder:text-gray-400 focus:border-black/30 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/28"
                                    oninput="updateProjectBoardLaneComposerDraft(this.value)"
                                    onkeydown="handleProjectBoardLaneComposerKeydown(event)"
                                    onblur="handleProjectBoardLaneComposerBlur(event)"
                                />
                            </div>
                        ` : `
                            <button
                                type="button"
                                class="project-board-add-trigger flex min-h-[8.15rem] flex-col items-start justify-start rounded-[0.95rem] border border-white/50 bg-black/[0.03] p-4 text-left transition-colors hover:bg-black/[0.045] dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                                onclick="openProjectBoardLaneComposer()"
                            >
                                <span class="inline-flex items-center gap-2 text-[15px] font-medium text-black/82 dark:text-white/90">
                                    <i data-lucide="plus" class="h-4 w-4"></i>
                                    <span>新增看板</span>
                                </span>
                                <span class="mt-2 text-[10px] font-mono text-gray-500 dark:text-white/50">创建一列后，就可以把项目拖进来</span>
                            </button>
                        `}
                    </section>
                `;
          return laneHtml
            ? `<div class="project-board-scroll-shell no-scrollbar h-full min-h-0"><div class="project-board-columns min-h-full">${laneHtml}${addLaneHtml}</div></div>`
            : projectEmpty;
        }
        return `${cardsHtml || projectEmpty}`;
      }
      return cardsHtml || projectEmpty;
    }

    return { renderContextGrid };
  }

  window.MorphContextGridRenderRuntime = {
    create: createContextGridRenderRuntime,
  };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createContextGridRenderDepsRuntime(root) {
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
        normalizeProjectCollectionPane: pickFunction(context.normalizeProjectCollectionPane, getGlobalFunction('normalizeProjectCollectionPane') || (() => {})),
        getActiveProjectCollectionPane: pickFunction(context.getActiveProjectCollectionPane, () => String(getGlobalValue('activeProjectCollectionPane', '') || '').trim()),
        getActiveProjectViewPane: pickFunction(context.getActiveProjectViewPane, () => String(getGlobalValue('activeProjectViewPane', '') || '').trim()),
        sortProjectsNewestFirst: pickFunction(context.sortProjectsNewestFirst, getGlobalFunction('sortProjectsNewestFirst') || ((list) => (Array.isArray(list) ? list : []))),
        sortProjectsForDirectory: pickFunction(context.sortProjectsForDirectory, getGlobalFunction('sortProjectsForDirectory') || (getGlobalFunction('sortProjectsNewestFirst') || ((list) => (Array.isArray(list) ? list : [])))),
        sortProjectsForBoard: pickFunction(context.sortProjectsForBoard, getGlobalFunction('sortProjectsForBoard') || (getGlobalFunction('sortProjectsNewestFirst') || ((list) => (Array.isArray(list) ? list : [])))),
        getChildProjects: pickFunction(context.getChildProjects, getGlobalFunction('getChildProjects') || (() => [])),
        getProjectQueueLaneId: pickFunction(context.getProjectQueueLaneId, getGlobalFunction('getProjectQueueLaneId') || (() => 'other')),
        getProjectBoardLaneComposerState: pickFunction(context.getProjectBoardLaneComposerState, getGlobalFunction('getProjectBoardLaneComposerState') || (() => ({ open: false, draft: '' }))),
        getProjectQueueLaneDefs: pickFunction(context.getProjectQueueLaneDefs, getGlobalFunction('getProjectQueueLaneDefs') || (() => (Array.isArray(getGlobalValue('PROJECT_QUEUE_LANE_DEFS', [])) ? getGlobalValue('PROJECT_QUEUE_LANE_DEFS', []) : []))),
        getProjectGraphFolderPositions: pickFunction(context.getProjectGraphFolderPositions, getGlobalFunction('readProjectGraphFolderPositions') || (() => ({}))),
        getProjectGraphFocusState: pickFunction(context.getProjectGraphFocusState, getGlobalFunction('getProjectGraphFocusState') || (() => ({ projectId: '' }))),
        getProjectGraphWritingText: pickFunction(context.getProjectGraphWritingText, getGlobalFunction('getProjectGraphWritingText') || (() => '')),
        projectQueueLaneDefs: Array.isArray(context.projectQueueLaneDefs)
          ? context.projectQueueLaneDefs
          : (Array.isArray(getGlobalValue('PROJECT_QUEUE_LANE_DEFS', [])) ? getGlobalValue('PROJECT_QUEUE_LANE_DEFS', []) : []),
      };
    }

    return { buildAppDeps };
  }

  window.MorphContextGridRenderDepsRuntime = { create: () => createContextGridRenderDepsRuntime(window) };
})();
