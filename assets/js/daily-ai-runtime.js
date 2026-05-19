// @ts-check

(function initMorphDailyAIRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphDailyAIRuntime && typeof window.MorphDailyAIRuntime.create === 'function';
  const hasDepsRuntime = window.MorphDailyAIDepsRuntime && typeof window.MorphDailyAIDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createDailyAIRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function commitDailyPatchIntent(options = {}) {
      if (typeof api.commitPatchIntent === 'function') return api.commitPatchIntent(options);
      if (typeof api.commitMorphCoreMutation === 'function') return api.commitMorphCoreMutation(options);
      return null;
    }

    async function summarizeDailyLogWithAI() {
      const monthStr = typeof api.ensureSelectedDailyMonth === 'function' ? api.ensureSelectedDailyMonth() : '';
      const dataRoot = typeof api.getDataRoot === 'function' ? api.getDataRoot() : null;
      const blocks = dataRoot?.dailyMonths?.[monthStr];
      if (!blocks || blocks.length === 0) return;
      const textContent = blocks.map((b) => b.content).filter((c) => String(c || '').trim() !== '').join('\n');
      if (textContent.length < 10) {
        if (typeof api.openCustomModal === 'function') api.openCustomModal({ title: '数据不足', desc: '当前日志数据过少，无需提取。' });
        return;
      }
      const doc = typeof document !== 'undefined' ? document : null;
      const mobileQuickBtn = doc?.getElementById?.('mobile-quick-compose-btn');
      const desktopBtn = doc?.getElementById?.('btn-ai-daily');
      const useMobileQuickBtn = typeof api.isMobileNavMode === 'function'
        && api.isMobileNavMode()
        && String(api.getCurrentTab?.() || '') === 'daily'
        && mobileQuickBtn
        && !mobileQuickBtn.classList.contains('hidden');
      const btn = useMobileQuickBtn ? mobileQuickBtn : desktopBtn;
      if (!btn) return;
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>';
      btn.disabled = true;
      if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh({ root: btn });
      try {
        if (typeof api.getCurrentAIKey === 'function' && !api.getCurrentAIKey()) {
          const providerLabel = typeof api.getAIProviderDisplayLabel === 'function' ? api.getAIProviderDisplayLabel() : 'AI';
          if (typeof api.openCustomModal === 'function') api.openCustomModal({ title: '未配置 AI 密钥', desc: `请先在设置中填写 ${providerLabel} API Key。` });
          return;
        }
        const prompt = `以下是我近期的工作日志和想法碎片：\n\n${textContent}\n\n请你作为我的智能助理，用极度克制、简练的语言（不超过两句话），提炼我目前的核心状态，并给我一个关于明天的最高优先级建议。直接输出纯文本，不需要任何格式修饰。`;
        const text = typeof api.requestAIText === 'function' ? await api.requestAIText(prompt) : '';
        if (text) {
          const createId = typeof api.genId === 'function' ? api.genId : () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const appendedBlocks = [
            { id: createId(), type: 'h3', content: '✨ AI 量子提炼', checked: false },
            { id: createId(), type: 'p', content: String(text).trim(), checked: false },
            { id: createId(), type: 'p', content: '', checked: false },
          ];
          blocks.push(...appendedBlocks);
          const committed = commitDailyPatchIntent({
            changed: true,
            source: 'manual',
            promptQuestion: 'AI 总结日志',
            actions: [{ type: 'manual_ai_daily_summary_append', month: monthStr }],
            actionTypes: ['manual_ai_daily_summary_append'],
            domains: ['daily'],
            appliedLabels: ['AI 总结日志'],
            detail: {
              month: monthStr,
              blockCount: 3,
            },
            saveMode: 'data',
            immediatePersist: true,
            saveData: typeof api.saveData === 'function' ? api.saveData : null,
            currentTab: typeof api.getCurrentTab === 'function' ? api.getCurrentTab() : '',
          });
          if (!committed) {
            const appendedIds = new Set(appendedBlocks.map((item) => String(item?.id || '').trim()).filter(Boolean));
            for (let index = blocks.length - 1; index >= 0; index -= 1) {
              const blockId = String(blocks[index]?.id || '').trim();
              if (!appendedIds.has(blockId)) continue;
              blocks.splice(index, 1);
            }
            return;
          }
          if (typeof api.focusBlock === 'function') api.focusBlock(blocks[blocks.length - 1].id, true);
        }
      } catch (_) {
        if (typeof api.openCustomModal === 'function') api.openCustomModal({ title: '神经链路断开', desc: '无法建立连接。请按 F12 检查 API Key。' });
      } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        if (typeof api.syncMobileQuickComposeIcon === 'function') api.syncMobileQuickComposeIcon();
      }
    }

    return { summarizeDailyLogWithAI };
  }

  window.MorphDailyAIRuntime = {
    create: createDailyAIRuntime,
  };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createDailyAIDepsRuntime(root) {
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
        ensureSelectedDailyMonth: pickFunction(context.ensureSelectedDailyMonth, getGlobalFunction('ensureSelectedDailyMonth') || (() => '')),
        getDataRoot: pickFunction(context.getDataRoot, () => {
          const value = getGlobalValue('data', null);
          return value && typeof value === 'object' ? value : null;
        }),
        isMobileNavMode: pickFunction(context.isMobileNavMode, getGlobalFunction('isMobileNavMode') || (() => false)),
        getCurrentTab: pickFunction(context.getCurrentTab, () => String(getGlobalValue('currentTab', '') || '').trim()),
        requestLucideRefresh: pickFunction(context.requestLucideRefresh, getGlobalFunction('requestLucideRefresh') || (() => {})),
        getCurrentAIKey: pickFunction(context.getCurrentAIKey, getGlobalFunction('getCurrentAIKey') || (() => '')),
        openCustomModal: pickFunction(context.openCustomModal, getGlobalFunction('openCustomModal') || (() => {})),
        getAIProviderDisplayLabel: pickFunction(context.getAIProviderDisplayLabel, getGlobalFunction('getAIProviderDisplayLabel') || (() => 'AI')),
        requestAIText: pickFunction(context.requestAIText, getGlobalFunction('requestAIText') || (async () => '')),
        genId: pickFunction(context.genId, getGlobalFunction('genId') || (() => `id_${Date.now().toString(36)}`)),
        commitPatchIntent: pickFunction(context.commitPatchIntent, getGlobalFunction('commitMorphCoreMutation') || (() => null)),
        saveData: pickFunction(context.saveData, getGlobalFunction('saveData') || (() => {})),
        focusBlock: pickFunction(context.focusBlock, getGlobalFunction('focusBlock') || (() => {})),
        syncMobileQuickComposeIcon: pickFunction(context.syncMobileQuickComposeIcon, getGlobalFunction('syncMobileQuickComposeIcon') || (() => {})),
      };
    }

    return { buildAppDeps };
  }

  window.MorphDailyAIDepsRuntime = { create: () => createDailyAIDepsRuntime(window) };
})();
