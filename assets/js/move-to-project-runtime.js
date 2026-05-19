// @ts-check

(function initMorphMoveToProjectRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphMoveToProjectRuntime && typeof window.MorphMoveToProjectRuntime.create === 'function') return;

  function createMoveToProjectRuntime() {
    function renderMoveToProjectList() {
        const listEl = document.getElementById('move-to-project-list');
        if (!listEl) return;
        const options = buildMoveToProjectRenderableOptions();
        if (!options.length) {
            listEl.innerHTML = moveToProjectState.treeMode
                ? '<div class="px-3 py-4 text-[12px] text-gray-400 dark:text-white/40">当前没有可移动到的其他目标。</div>'
                : '<div class="px-3 py-4 text-[12px] text-gray-400 dark:text-white/40">没有找到匹配项目，可以直接输入名字新建项目。</div>';
            moveToProjectState.selectedValue = '';
            syncMoveToProjectConfirmButton();
            return;
        }
        if (!options.some((item) => String(item?.value || '') === String(moveToProjectState.selectedValue || ''))) moveToProjectState.selectedValue = String(options[0]?.value || '').trim();
        if (moveToProjectState.treeMode) {
            const selectedValue = String(moveToProjectState.selectedValue || '').trim();
            const currentOption = options.find((item) => item.current);
            const currentValue = String(currentOption?.value || '').trim();
            const specialOptions = options.filter((item) => item?.isSpecial);
            const projectOptions = options.filter((item) => !item?.isSpecial && String(item?.kind || '').trim() !== 'fixed');
            const fixedOptions = options.filter((item) => String(item?.kind || '').trim() === 'fixed');
            const renderTreeButton = (item) => {
                const value = String(item?.value || '').trim();
                const selected = value === selectedValue;
                const isCurrent = value === currentValue;
                return `
                    <button type="button" class="move-to-project-item move-to-project-tree-item w-full text-left px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-800 dark:text-white/90 flex items-center gap-3 transition-colors ${selected ? ' selected' : ''}" data-value="${escapeHTML(value)}" aria-pressed="${selected ? 'true' : 'false'}" style="padding-left:${(Math.max(0, Number(item?.depth || 0)) * 16) + 16}px;">
                        <i data-lucide="${escapeHTML(String(item?.icon || 'target'))}" class="move-to-project-item-icon w-4 h-4 shrink-0 text-gray-400 dark:text-white/40"></i>
                        <span class="truncate">${escapeHTML(String(item?.label || '未命名目标'))}</span>
                        ${renderMoveToProjectStatusPills({ selected, current: isCurrent })}
                    </button>
                `;
            };
            const buildSectionClass = (hasPreviousSection = false) => `${hasPreviousSection ? 'mt-2 ' : ''}flex flex-col gap-0`;
            const projectSection = projectOptions.length ? `
                <div class="${buildSectionClass(specialOptions.length > 0)}">
                    <div class="px-2 py-2 text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/35">项目目录</div>
                    ${projectOptions.map((item) => renderTreeButton(item)).join('')}
                </div>
            ` : '';
            const fixedSection = fixedOptions.length ? `
                <div class="${buildSectionClass(specialOptions.length > 0 || projectOptions.length > 0)}">
                    <div class="px-2 py-2 text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/35">已有定念</div>
                    ${fixedOptions.map((item) => renderTreeButton(item)).join('')}
                </div>
            ` : '';
            listEl.innerHTML = `
                <div class="flex flex-col gap-0">
                    ${specialOptions.map((item) => renderTreeButton(item)).join('')}
                    ${projectSection}
                    ${fixedSection}
                </div>
            `;
            listEl.querySelectorAll('.move-to-project-item').forEach((btn) => {
                btn.addEventListener('click', () => {
                    moveToProjectState.selectedValue = String(btn.dataset.value || '').trim();
                    renderMoveToProjectList();
                });
            });
            syncMoveToProjectConfirmButton();
            requestLucideRefresh({ root: listEl });
            return;
        }
        listEl.innerHTML = options.map((item) => {
            const value = String(item.value ?? ''), label = escapeHTML(String(item.label ?? '')), icon = escapeHTML(String(item.icon || 'folder'));
            const selected = value === moveToProjectState.selectedValue;
            return `<button type="button" class="move-to-project-item w-full text-left px-4 py-3 rounded-full border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-800 dark:text-white/90 flex items-center gap-3 transition-colors ${selected ? ' selected' : ''}" data-value="${escapeHTML(value)}" aria-pressed="${selected ? 'true' : 'false'}"><i data-lucide="${icon}" class="move-to-project-item-icon w-4 h-4 shrink-0 text-gray-400 dark:text-white/40"></i><span class="truncate">${label}</span>${renderMoveToProjectStatusPills({ selected })}</button>`;
        }).join('');
        listEl.querySelectorAll('.move-to-project-item').forEach((btn) => {
            btn.addEventListener('click', () => {
                moveToProjectState.selectedValue = String(btn.dataset.value || '').trim();
                renderMoveToProjectList();
            });
        });
        syncMoveToProjectConfirmButton();
        requestLucideRefresh({ root: listEl });
    }

    return {
      renderMoveToProjectList,
    };
  }

  window.MorphMoveToProjectRuntime = {
    create: createMoveToProjectRuntime,
  };
})();
