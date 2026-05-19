// @ts-check

(function initMorphAIChatTitleRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIChatTitleRuntime && typeof window.MorphAIChatTitleRuntime.create === 'function') return;

  function createAIChatTitleRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const autoTitleTasks = new Map();
    function cleanAIChatAutoTitle(text = '') {
      let normalized = String(text || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/^[\s"'“”‘’《》【】\[\]\-:：]+|[\s"'“”‘’《》【】\[\]\-:：]+$/g, '')
        .replace(/\s+/g, ' ');
      if (!normalized) return '';
      normalized = normalized
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) || '';
      normalized = normalized
        .replace(/^标题[:：]\s*/i, '')
        .trim();
      if (!normalized) return '';
      const chars = Array.from(normalized);
      if (chars.length > 18) return `${chars.slice(0, 18).join('')}…`;
      return normalized;
    }

    function buildAIChatSessionTitle(messages = [], fallback = '新对话') {
      const firstUser = (Array.isArray(messages) ? messages : []).find((msg) => msg && msg.role === 'user' && String(msg.content || '').trim());
      if (!firstUser) return fallback;
      const text = String(firstUser.content || '').replace(/\s+/g, ' ').trim();
      return (text.length > 18 ? `${text.slice(0, 18)}…` : text) || fallback;
    }

    function buildAIChatAutoTitleFallback(messages = []) {
      const base = buildAIChatSessionTitle(messages, '新对话');
      const cleaned = cleanAIChatAutoTitle(base);
      return cleaned || '新对话';
    }

    async function ensureAIChatSessionAutoTitle(sessionId, { force = false } = {}) {
      const id = String(sessionId || '').trim();
      if (!id) return false;
      if (typeof api.getCurrentAIKey !== 'function' || !api.getCurrentAIKey()) return false;
      if (typeof api.getAIMemory !== 'function') return false;
      const aiMemory = api.getAIMemory();
      const sessions = Array.isArray(aiMemory?.chatSessions) ? aiMemory.chatSessions : [];
      const session = sessions.find((item) => item?.id === id);
      if (!session || session.customTitle === true) return false;
      if (!force && session.autoTitleGenerated === true) return false;
      const messages = Array.isArray(session.messages) ? session.messages : [];
      const userMessages = messages.filter((msg) => msg?.role === 'user' && String(msg.content || '').trim());
      const assistantMessages = messages.filter((msg) => msg?.role === 'assistant' && String(msg.content || '').trim());
      if (!userMessages.length || !assistantMessages.length) return false;
      if (autoTitleTasks.has(id)) return false;
      if (typeof api.requestAIText !== 'function') return false;

      const namingTask = (async () => {
        try {
          const contextMessages = messages.slice(-8).map((msg) => {
            const role = msg.role === 'user' ? '用户' : (msg.role === 'assistant' ? 'AI' : '系统');
            const content = String(msg.content || '').replace(/\s+/g, ' ').trim().slice(0, 120);
            return `${role}：${content}`;
          }).join('\n');
          const prompt = [
            '你是标题生成助手。',
            '请根据下面对话，生成一个中文会话标题。',
            '要求：',
            '1) 仅输出标题本身',
            '2) 自然、准确、像真人给对话起名',
            '3) 可以短，也可以稍微展开，不要故意压成几个字',
            '4) 不要引号、序号、解释、前缀',
            '',
            '对话：',
            contextMessages,
          ].join('\n');

          const raw = await api.requestAIText(prompt, { stream: false });
          const finalTitle = cleanAIChatAutoTitle(raw) || buildAIChatAutoTitleFallback(messages);
          const latestMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : aiMemory;
          const targetSessions = Array.isArray(latestMemory?.chatSessions) ? latestMemory.chatSessions : [];
          const target = targetSessions.find((item) => item?.id === id);
          if (!target || target.customTitle === true) return;
          target.title = finalTitle;
          target.autoTitleGenerated = true;
          target.updatedAt = new Date().toISOString();
          if (typeof api.saveSilent === 'function') api.saveSilent({ skipUndo: true, forceDebounce: true });
          if (typeof api.getCurrentTab === 'function' && api.getCurrentTab() === 'ai' && typeof api.requestAIChatRender === 'function') {
            api.requestAIChatRender();
          }
        } catch (_) {
          // Keep auto naming best-effort only.
        } finally {
          autoTitleTasks.delete(id);
        }
      })();
      autoTitleTasks.set(id, namingTask);
      return true;
    }

    return {
      cleanAIChatAutoTitle,
      buildAIChatSessionTitle,
      buildAIChatAutoTitleFallback,
      ensureAIChatSessionAutoTitle,
    };
  }

  window.MorphAIChatTitleRuntime = { create: createAIChatTitleRuntime };
})();
