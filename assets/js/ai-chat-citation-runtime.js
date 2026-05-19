// @ts-check

(function initMorphAIChatCitationRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphAIChatCitationRuntime && typeof window.MorphAIChatCitationRuntime.create === 'function';
  const hasDepsRuntime = window.MorphAIChatCitationDepsRuntime && typeof window.MorphAIChatCitationDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createAIChatCitationRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function buildAIChatCitationTarget(item) {
      const source = String(item?.source || '').trim();
      if (!source) return null;
      if (
        source.startsWith('memory-fact:')
        || source.startsWith('ai-memory/')
        || source === 'user.md'
        || source === 'memory-system.md'
        || source === 'soul.md'
      ) {
        return null;
      }
      if (/^https?:\/\//i.test(source)) {
        let host = source;
        try {
          host = new URL(source).hostname || source;
        } catch (_) {}
        const title = String(item?.title || '').trim();
        return { key: source, source, label: title || host, icon: 'globe' };
      }
      if (source === 'flash-thoughts' || source === 'fixed-thoughts') {
        return null;
      }
      if (source.startsWith('daily:')) {
        const month = source.replace(/^daily:/, '');
        return { key: source, source, label: `去日志 ${month}`, icon: 'file-text' };
      }
      if (source.startsWith('project:')) {
        const parts = source.split(':');
        const projectName = parts[1] || '未命名项目';
        const tail = parts[2] === 'references'
          ? '参考闪念'
          : parts[2] === 'blocks'
            ? '执行块'
            : '内容';
        return { key: source, source, label: `${projectName} · ${tail}`, icon: 'layers' };
      }
      if (source.startsWith('flash-cluster:')) {
        return { key: source, source, label: '去闪念群组', icon: 'share-2' };
      }
      return { key: source, source, label: source, icon: 'arrow-up-right' };
    }

    function getAIChatCitationTargets(meta = null) {
      const citations = Array.isArray(meta?.citations) ? meta.citations : [];
      const seen = new Set();
      const targets = [];
      citations.forEach((item) => {
        const target = buildAIChatCitationTarget(item);
        if (!target || seen.has(target.key)) return;
        seen.add(target.key);
        targets.push(target);
      });
      return targets.slice(0, 5);
    }

    function getAIChatTargetsFromMessageContent(content) {
      const text = String(content || '');
      if (!text) return [];
      const seen = new Set();
      const targets = [];
      const pushProjectTarget = (projectName, targetKind = 'references') => {
        const trimmed = String(projectName || '').trim();
        if (!trimmed) return;
        const normalizedKind = targetKind === 'blocks' ? 'blocks' : 'references';
        const tailLabel = normalizedKind === 'references' ? '参考闪念' : '执行块';
        const key = `project:${trimmed}:${normalizedKind}`;
        if (seen.has(key)) return;
        seen.add(key);
        targets.push({
          key,
          source: `project:${trimmed}:${normalizedKind}`,
          label: `${trimmed} · ${tailLabel}`,
          icon: 'layers',
        });
      };

      const projectReferencePatterns = [
        /[“"]([^”"\n]+)[”"]\s*项目的参考中/g,
        /[“"]([^”"\n]+)[”"]\s*项目参考/g,
        /项目[“"]([^”"\n]+)[”"]的参考中/g,
      ];
      projectReferencePatterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          pushProjectTarget(match[1], 'references');
        }
      });

      return targets;
    }

    function getAIChatTargetsFromMeta(meta = null) {
      const targets = [];
      const seen = new Set();
      const pushTarget = (target) => {
        if (!target || !target.key || seen.has(target.key)) return;
        seen.add(target.key);
        targets.push(target);
      };

      const createdItems = Array.isArray(meta?.createdItems) ? meta.createdItems : [];
      createdItems.forEach((item) => {
        const tab = String(item?.tab || '').trim();
        if (tab === 'daily') {
          const explicitMonth = String(item?.month || item?.monthKey || item?.id || '').trim().slice(0, 7);
          const month = explicitMonth || (typeof api.ensureSelectedDailyMonth === 'function' ? api.ensureSelectedDailyMonth() : '');
          pushTarget({
            key: `daily:${month}`,
            source: `daily:${month}`,
            label: `去日志 ${month}`,
            icon: 'file-text',
          });
        } else if (tab === 'project') {
          const projectName = String(item?.text || item?.name || '').trim() || '未命名项目';
          const targetKind = String(item?.target || '').trim();
          if (targetKind === 'references' || targetKind === 'blocks') {
            pushTarget({
              key: `project:${projectName}:${targetKind}`,
              source: `project:${projectName}:${targetKind}`,
              label: `${projectName} · ${targetKind === 'references' ? '参考闪念' : '内容'}`,
              icon: 'layers',
            });
          } else {
            pushTarget({
              key: `project-created:${projectName}`,
              source: `project:${projectName}:blocks`,
              label: `去项目 · ${projectName}`,
              icon: 'layers',
            });
          }
        } else if (tab === 'flashThoughts') {
          pushTarget({
            key: 'flash-thoughts',
            source: 'flash-thoughts',
            label: '去闪念',
            icon: 'share-2',
          });
        } else if (tab === 'fixed') {
          pushTarget({
            key: 'fixed-thoughts',
            source: 'fixed-thoughts',
            label: '去定念',
            icon: 'share-2',
          });
        } else if (tab === 'expenseLedger') {
          pushTarget({
            key: 'expense-ledger',
            source: 'expense-ledger',
            label: '去账单',
            icon: 'receipt-text',
          });
        } else if (tab) {
          const hostExtension = typeof api.findIntegratedExtensionByCreatedItemTarget === 'function'
            ? api.findIntegratedExtensionByCreatedItemTarget(tab)
            : null;
          if (hostExtension) {
            const hostEntry = hostExtension.hostIntegration?.sidebarEntry || hostExtension.hostIntegration?.mobileMoreEntry || null;
            pushTarget({
              key: `host-extension:${hostExtension.id}`,
              source: `host-extension:${hostExtension.id}`,
              label: String(hostEntry?.label || hostExtension.name || '去工作台'),
              icon: String(hostEntry?.icon || hostExtension.icon || 'puzzle'),
            });
          }
        }
      });

      const actions = Array.isArray(meta?.actions) ? meta.actions : [];
      actions.forEach((label) => {
        const text = String(label || '').trim();
        if (!text) return;
        if (/^写入今日日志/.test(text) || /^追加日志/.test(text) || /日志/.test(text)) {
          const month = typeof api.ensureSelectedDailyMonth === 'function' ? api.ensureSelectedDailyMonth() : '';
          pushTarget({
            key: `daily:${month}`,
            source: `daily:${month}`,
            label: `去日志 ${month}`,
            icon: 'file-text',
          });
        }
      });

      return targets;
    }

    function mergeAIChatCitationTargets(meta = null, content = '') {
      const metaTargets = getAIChatTargetsFromMeta(meta);
      const explicitTargets = getAIChatTargetsFromMessageContent(content);
      const citationTargets = getAIChatCitationTargets(meta);
      const seen = new Set();
      const merged = [];
      metaTargets.concat(explicitTargets, citationTargets).forEach((item) => {
        if (!item || seen.has(item.key)) return;
        seen.add(item.key);
        merged.push(item);
      });
      return merged.slice(0, 5);
    }

    return {
      buildAIChatCitationTarget,
      getAIChatCitationTargets,
      getAIChatTargetsFromMessageContent,
      getAIChatTargetsFromMeta,
      mergeAIChatCitationTargets,
    };
  }

  window.MorphAIChatCitationRuntime = {
    create: createAIChatCitationRuntime,
  };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createAIChatCitationDepsRuntime(root) {
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
        ensureSelectedDailyMonth: pickFunction(context.ensureSelectedDailyMonth, getGlobalFunction('ensureSelectedDailyMonth') || (() => '')),
        findIntegratedExtensionByCreatedItemTarget: pickFunction(context.findIntegratedExtensionByCreatedItemTarget, getGlobalFunction('findIntegratedExtensionByCreatedItemTarget') || (() => null)),
      };
    }

    return { buildAppDeps };
  }

  window.MorphAIChatCitationDepsRuntime = { create: () => createAIChatCitationDepsRuntime(window) };
})();
