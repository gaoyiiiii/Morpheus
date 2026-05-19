// @ts-check

(function initMorphAIChatViewRenderRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphAIChatViewRenderRuntime && typeof window.MorphAIChatViewRenderRuntime.create === 'function';
  const hasDepsRuntime = window.MorphAIChatViewRenderDepsRuntime && typeof window.MorphAIChatViewRenderDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createAIChatViewRenderRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getDocumentRef() {
      if (typeof api.getDocumentRef === 'function') return api.getDocumentRef();
      if (typeof document !== 'undefined') return document;
      return null;
    }

    function isMobileNavMode() {
      try {
        return typeof api.isMobileNavMode === 'function' && api.isMobileNavMode() === true;
      } catch (_) {
        return false;
      }
    }

    function isHTMLElement(value) {
      const doc = getDocumentRef();
      const win = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
      const HTMLElementCtor = win && win.HTMLElement;
      return !!(HTMLElementCtor && value instanceof HTMLElementCtor);
    }

    function captureAIChatScrollAnchor(container) {
      if (!isHTMLElement(container)) return null;
      const containerRect = container.getBoundingClientRect();
      const items = Array.from(container.querySelectorAll('.ai-chat-item[data-ai-chat-message-id]'));
      for (const item of items) {
        if (!isHTMLElement(item)) continue;
        const rect = item.getBoundingClientRect();
        if (rect.bottom >= containerRect.top + 1) {
          return {
            messageId: String(item.getAttribute('data-ai-chat-message-id') || '').trim(),
            offsetTop: rect.top - containerRect.top,
          };
        }
      }
      return null;
    }

    function restoreAIChatScrollAnchor(container, anchor) {
      if (!isHTMLElement(container) || !anchor?.messageId) return false;
      const item = Array.from(container.children).find((child) => (
        isHTMLElement(child)
        && child.classList.contains('ai-chat-item')
        && String(child.getAttribute('data-ai-chat-message-id') || '').trim() === String(anchor.messageId || '').trim()
      ));
      if (!isHTMLElement(item)) return false;
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const desiredOffsetTop = Number(anchor.offsetTop || 0);
      const delta = (itemRect.top - containerRect.top) - desiredOffsetTop;
      if (Math.abs(delta) > 0.5) {
        container.scrollTop += delta;
      }
      return true;
    }

    function clampScrollTop(container, value) {
      if (!isHTMLElement(container)) return 0;
      const nextValue = Number(value || 0);
      const safeValue = Number.isFinite(nextValue) ? nextValue : 0;
      const maxScrollTop = Math.max(0, Number(container.scrollHeight || 0) - Number(container.clientHeight || 0));
      return Math.min(Math.max(0, safeValue), maxScrollTop);
    }

    function buildSafeMessageFallbackHtml(messages = []) {
      const safeMessages = (Array.isArray(messages) ? messages : []).map((message, index) => {
        const safeMessage = message && typeof message === 'object' ? message : {};
        const currentId = String(safeMessage.id || '').trim();
        if (currentId) return safeMessage;
        return {
          ...safeMessage,
          id: `view_fallback_${index}_${String(safeMessage.role || 'assistant').trim() || 'assistant'}`,
        };
      });
      if (!safeMessages.length) {
        if (typeof api.buildAIChatEmptyStateHtml === 'function') {
          const emptyHtml = api.buildAIChatEmptyStateHtml();
          if (String(emptyHtml || '').trim()) return emptyHtml;
        }
        return '<div class="ai-chat-empty-state h-full min-h-[12rem] flex flex-col items-center justify-center text-center text-[11px] font-mono text-gray-400 dark:text-white/35 px-6 gap-3"><div>还没有对话内容。</div></div>';
      }
      if (typeof api.buildAIChatMessageHtml === 'function') {
        const fullHtml = safeMessages.map((message) => api.buildAIChatMessageHtml(message)).filter(Boolean).join('');
        if (String(fullHtml || '').trim()) return fullHtml;
      }
      const escapeHTML = typeof api.escapeHTML === 'function' ? api.escapeHTML : (text) => String(text || '');
      return safeMessages.map((message) => {
        const id = escapeHTML(String(message?.id || '').trim());
        const role = escapeHTML(String(message?.role || 'assistant').trim() || 'assistant');
        const content = escapeHTML(String(message?.content || '').trim());
        const isUser = role === 'user';
        const bubbleRoleClass = isUser ? 'ai-chat-bubble-user' : 'ai-chat-bubble-assistant';
        return `
          <div class="ai-chat-item ${isUser ? 'self-end' : 'self-start'}" data-ai-chat-message-id="${id}" data-ai-chat-role="${role}">
            <div class="ai-chat-bubble ai-chat-md reading-body-text ${bubbleRoleClass} rounded-2xl px-4 py-3 break-words">${content || ' '}</div>
          </div>
        `;
      }).join('');
    }

    function renderSafeMessageFallback(container, messages = []) {
      if (!isHTMLElement(container)) return;
      container.innerHTML = buildSafeMessageFallbackHtml(messages);
    }

    function safeRun(label, task, fallback = null) {
      if (typeof task !== 'function') return fallback;
      try {
        return task();
      } catch (error) {
        try {
          console.warn(`[Morpheus AI chat] ${label} failed`, error);
        } catch (_) {}
        return fallback;
      }
    }

    function buildSessionDrawerSignature(sessions = [], currentSessionId = '', inlineMenuId = '') {
      const safeSessions = Array.isArray(sessions) ? sessions : [];
      return safeSessions.map((session) => {
        const sessionId = String(session?.id || '').trim();
        const title = String(session?.title || '新对话');
        const pinned = session?.pinned === true ? '1' : '0';
        const active = sessionId && sessionId === String(currentSessionId || '').trim() ? '1' : '0';
        const menuOpen = sessionId && sessionId === String(inlineMenuId || '').trim() ? '1' : '0';
        return `${sessionId}::${title}::${pinned}::${active}::${menuOpen}`;
      }).join('|');
    }

    function buildAIChatTailRenderSignature(messages = []) {
      const safeMessages = Array.isArray(messages) ? messages : [];
      const lastMessage = safeMessages.length ? safeMessages[safeMessages.length - 1] : null;
      if (!lastMessage) return 'empty';
      if (typeof api.getAIChatMessageRenderKey === 'function') {
        const sharedKey = String(api.getAIChatMessageRenderKey(lastMessage) || '').trim();
        if (sharedKey) return sharedKey;
      }
      try {
        return JSON.stringify([
          String(lastMessage?.id || '').trim(),
          String(lastMessage?.role || '').trim(),
          String(lastMessage?.content || ''),
          lastMessage?.meta || null,
          String(lastMessage?.time || '').trim(),
        ]);
      } catch (_) {
        return [
          String(lastMessage?.id || '').trim(),
          String(lastMessage?.role || '').trim(),
          String(lastMessage?.content || ''),
          String(lastMessage?.time || '').trim(),
        ].join('::');
      }
    }

    function buildAIChatViewChromeSignature({ currentSessionId = '', busy = false, messages = [] } = {}) {
      const safeMessages = Array.isArray(messages) ? messages : [];
      return [
        String(currentSessionId || '').trim(),
        busy ? 'busy' : 'idle',
        safeMessages.length,
        buildAIChatTailRenderSignature(safeMessages),
      ].join('|');
    }

    function performRenderAIChatView() {
      const doc = getDocumentRef();
      const aiChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
      if (!doc || !aiChatState || typeof aiChatState !== 'object') return;
      const container = doc.getElementById('ai-chat-messages');
      const statusEl = doc.getElementById('ai-chat-status');
      const sendBtn = doc.getElementById('ai-chat-send-btn');
      const stopBtn = doc.getElementById('ai-chat-stop-btn');
      const plusBtn = doc.getElementById('ai-chat-plus-btn');
      const backBtn = doc.getElementById('ai-mobile-back-btn');
      const newBtn = doc.getElementById('ai-chat-new-btn');
      const sessionDrawerList = doc.getElementById('ai-chat-session-drawer-list');
      if (!container) return;
      const maxMessages = Math.max(1, Number(typeof api.getAIChatMaxMessages === 'function' ? api.getAIChatMaxMessages() : 200) || 200);
      const sessions = typeof api.getSortedAIChatSessions === 'function' ? api.getSortedAIChatSessions() : [];
      let currentSession = sessions.find((item) => item.id === aiChatState.sessionId) || sessions[0] || null;
      if (!currentSession && typeof api.ensureCurrentAIChatSession === 'function') {
        currentSession = safeRun('ensureCurrentAIChatSession', () => api.ensureCurrentAIChatSession(), null);
      }
      const currentSessionId = String(currentSession?.id || '').trim();
      const sessionMessageSource = Array.isArray(currentSession?.messages) ? currentSession.messages : [];
      const currentSessionMessages = sessionMessageSource.length > maxMessages
        ? sessionMessageSource.slice(-maxMessages)
        : sessionMessageSource;
      const stateMessages = Array.isArray(aiChatState.messages) ? aiChatState.messages : [];
      const stateSessionId = String(aiChatState.sessionId || '').trim();
      const currentMessageCount = stateMessages.length;
      const currentLastMessageId = currentMessageCount
        ? String(stateMessages[currentMessageCount - 1]?.id || '').trim()
        : '';
      const sessionLastMessageId = currentSessionMessages.length
        ? String(currentSessionMessages[currentSessionMessages.length - 1]?.id || '').trim()
        : '';
      const shouldRenderSessionMessages = !!currentSessionId && (
        stateSessionId !== currentSessionId
        || !Array.isArray(aiChatState.messages)
        || (!aiChatState.busy && (
          String(aiChatState.renderedSessionId || '').trim() !== currentSessionId
          || currentMessageCount !== currentSessionMessages.length
          || currentLastMessageId !== sessionLastMessageId
        ))
      );
      const renderMessages = shouldRenderSessionMessages ? currentSessionMessages : stateMessages;
      const viewChromeSignature = buildAIChatViewChromeSignature({
        currentSessionId,
        busy: !!aiChatState.busy,
        messages: renderMessages,
      });
      const shouldRefreshViewChrome = String(container.__morphAIChatViewChromeSignature || '') !== viewChromeSignature;

      if (shouldRefreshViewChrome) {
        const shortcutsOk = safeRun('renderAIExtensionShortcuts', () => {
          if (typeof api.renderAIExtensionShortcuts === 'function') api.renderAIExtensionShortcuts();
          return true;
        }, false);
        const panelsOk = safeRun('renderAIExtensionPanels', () => {
          if (typeof api.renderAIExtensionPanels === 'function') api.renderAIExtensionPanels();
          return true;
        }, false);
        if (shortcutsOk !== false && panelsOk !== false) {
          container.__morphAIChatViewChromeSignature = viewChromeSignature;
        }
      }

      if (backBtn) {
        backBtn.classList.add('hidden');
        backBtn.classList.remove('inline-flex');
      }
      if (newBtn) newBtn.disabled = !!aiChatState.busy;

      if (sessionDrawerList) {
        const inlineMenuId = typeof api.getAIChatSessionInlineMenuId === 'function' ? api.getAIChatSessionInlineMenuId() : '';
        const drawerSignature = buildSessionDrawerSignature(sessions, currentSessionId, inlineMenuId);
        const shouldRenderDrawer = (
          !String(sessionDrawerList.innerHTML || '').trim()
          || String(sessionDrawerList.__morphAIChatDrawerSignature || '') !== drawerSignature
        );
        const drawerHtml = safeRun('renderAIChatSessionDrawer', () => {
          if (!shouldRenderDrawer) return sessionDrawerList.innerHTML;
          const escapeHTML = typeof api.escapeHTML === 'function' ? api.escapeHTML : (text) => String(text || '');
          const createRowHtml = `
                  <div class="ai-chat-session-row ai-chat-session-row-create" data-session-action="new">
                      <button type="button" onclick="startNewAIChatSession(); setAIChatSessionDrawerOpen(false); return false;" class="ai-chat-session-row-main">
                          <i data-lucide="square-pen" class="w-3.5 h-3.5 shrink-0"></i>
                          <span class="ai-chat-session-row-title">新对话</span>
                      </button>
                  </div>
              `;
          const itemsHtml = sessions.map((session) => {
            const safeSessionId = String(session?.id || '').trim();
            const active = !!currentSessionId && safeSessionId === currentSessionId;
            const menuOpen = inlineMenuId === safeSessionId;
            const pinLabel = session?.pinned === true ? '取消置顶' : '置顶对话';
            return `
                  <div class="ai-chat-session-row ${active ? 'is-active' : ''} ${menuOpen ? 'is-menu-open' : ''}" data-session-id="${safeSessionId}">
                      <button type="button" onclick="switchAIChatSession('${safeSessionId}'); setAIChatSessionDrawerOpen(false); return false;" oncontextmenu="return handleAIChatSessionContext(event, '${safeSessionId}')" class="ai-chat-session-row-main">
                          ${session?.pinned === true ? '<span class="ai-chat-session-row-pin"><i data-lucide="pin" class="w-3 h-3"></i></span>' : ''}
                          <span class="ai-chat-session-row-title">${escapeHTML(session?.title || '新对话')}</span>
                      </button>
                      <button type="button" aria-label="更多操作" onclick="return toggleAIChatSessionInlineMenu(event, '${safeSessionId}')" class="ai-chat-session-row-more">
                          <i data-lucide="ellipsis" class="w-3.5 h-3.5"></i>
                      </button>
                      <div class="ai-chat-session-row-menu ${menuOpen ? 'open' : ''}">
                          <button type="button" onclick="setAIChatSessionDrawerOpen(false); promptRenameAIChatSession('${safeSessionId}'); return false;" class="ai-chat-session-row-menu-item">重命名</button>
                          <button type="button" onclick="setAIChatSessionDrawerOpen(false); togglePinAIChatSession('${safeSessionId}'); return false;" class="ai-chat-session-row-menu-item">${pinLabel}</button>
                          <button type="button" onclick="setAIChatSessionDrawerOpen(false); confirmDeleteAIChatSession('${safeSessionId}'); return false;" class="ai-chat-session-row-menu-item is-danger">删除</button>
                      </div>
                  </div>
              `;
          }).join('');
          sessionDrawerList.innerHTML = `${createRowHtml}${itemsHtml || '<div class="px-1 py-3 text-[11px] text-gray-400 dark:text-white/35 font-mono">还没有对话。</div>'}`;
          sessionDrawerList.__morphAIChatDrawerSignature = drawerSignature;
          return sessionDrawerList.innerHTML;
        }, '<div class="px-1 py-3 text-[11px] text-gray-400 dark:text-white/35 font-mono">对话目录暂时不可用。</div>');
        if (!String(sessionDrawerList.innerHTML || '').trim() && String(drawerHtml || '').trim()) {
          sessionDrawerList.innerHTML = String(drawerHtml || '');
        }
        if (!String(sessionDrawerList.innerHTML || '').trim()) {
          sessionDrawerList.innerHTML = '<div class="px-1 py-3 text-[11px] text-gray-400 dark:text-white/35 font-mono">还没有对话。</div>';
        }
        if (shouldRenderDrawer && typeof api.requestLucideRefresh === 'function') {
          api.requestLucideRefresh({ root: sessionDrawerList });
        }
      }

      const prevRenderedSessionId = String(aiChatState.renderedSessionId || '');
      const prevScrollTop = container.scrollTop;
      const prevScrollHeight = container.scrollHeight;
      const prevClientHeight = container.clientHeight;
      const wasNearBottom = (prevScrollHeight - (prevScrollTop + prevClientHeight)) <= 72;
      const sameSessionAsBefore = prevRenderedSessionId === currentSessionId;
      const shouldStickBottom = currentSessionId
        ? (aiChatState.forceScrollToBottom || (sameSessionAsBefore && (aiChatState.busy || wasNearBottom)))
        : true;
      const messageListUpdateKind = safeRun('classifyAIChatMessageListUpdate', () => (
        typeof api.classifyAIChatMessageListUpdate === 'function'
          ? String(api.classifyAIChatMessageListUpdate(container, renderMessages) || '').trim()
          : ''
      ), '');
      const canReuseScrollOffset = sameSessionAsBefore
        && !shouldStickBottom
        && (messageListUpdateKind === 'noop_dom' || messageListUpdateKind === 'tail_patch');
      const scrollAnchor = sameSessionAsBefore && !shouldStickBottom
        && !canReuseScrollOffset
        ? captureAIChatScrollAnchor(container)
        : null;
      if (prevRenderedSessionId) aiChatState.scrollTopBySession[prevRenderedSessionId] = prevScrollTop;

      safeRun('syncAIChatMessageList', () => {
        if (typeof api.syncAIChatMessageList === 'function') {
          api.syncAIChatMessageList(container, renderMessages);
        } else {
          renderSafeMessageFallback(container, renderMessages);
        }
      });
      const hasRenderedItems = typeof container.querySelector === 'function'
        ? !!container.querySelector('.ai-chat-item[data-ai-chat-message-id]')
        : String(container.innerHTML || '').includes('data-ai-chat-message-id=');
      if (!hasRenderedItems) {
        renderSafeMessageFallback(container, renderMessages);
      }
      if (container.__morphAIChatMeasuredWidth !== container.clientWidth) {
        safeRun('syncAIChatBubbleLayout', () => {
          if (typeof api.syncAIChatBubbleLayout === 'function') api.syncAIChatBubbleLayout(container);
        });
        container.__morphAIChatMeasuredWidth = container.clientWidth;
      }

      if (currentSessionId) {
        if (shouldStickBottom) {
          container.scrollTop = container.scrollHeight;
        } else if (canReuseScrollOffset) {
          container.scrollTop = clampScrollTop(container, prevScrollTop);
        } else if (sameSessionAsBefore && restoreAIChatScrollAnchor(container, scrollAnchor)) {
          // Keep the same visible message anchored while the current session updates.
        } else {
          const savedTop = Number(aiChatState.scrollTopBySession[currentSessionId]);
          if (Number.isFinite(savedTop)) {
            container.scrollTop = clampScrollTop(container, savedTop);
          } else {
            container.scrollTop = container.scrollHeight;
          }
        }
        aiChatState.scrollTopBySession[currentSessionId] = container.scrollTop;
      } else {
        container.scrollTop = container.scrollHeight;
      }

      aiChatState.renderedSessionId = currentSessionId;
      aiChatState.forceScrollToBottom = false;
      const statusText = aiChatState.busy
        ? 'AI 正在处理中…'
        : currentSession
          ? `当前对话：${currentSession.title || '新对话'}`
          : 'AI 将结合当前应用数据回答，并可执行结构化更新。';
      if (statusEl) {
        if (statusEl.textContent !== statusText) statusEl.textContent = statusText;
      }
      const toolbarSignature = aiChatState.busy ? 'busy' : 'idle';
      if (sendBtn) {
        if (String(sendBtn.__morphAIChatToolbarSignature || '') !== toolbarSignature) {
          sendBtn.disabled = !!aiChatState.busy;
          sendBtn.innerHTML = aiChatState.busy
            ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>处理中</span>'
            : '<i data-lucide="send" class="w-3.5 h-3.5"></i><span>发送</span>';
          sendBtn.__morphAIChatToolbarSignature = toolbarSignature;
          if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh({ root: sendBtn });
        }
      }
      if (plusBtn) {
        if (String(plusBtn.__morphAIChatToolbarSignature || '') !== toolbarSignature) {
          plusBtn.disabled = !!aiChatState.busy;
          plusBtn.__morphAIChatToolbarSignature = toolbarSignature;
          if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh({ root: plusBtn });
        }
      }
      if (stopBtn) {
        if (isMobileNavMode()) {
          stopBtn.classList.add('hidden');
          stopBtn.classList.remove('flex');
          stopBtn.style.display = 'none';
          stopBtn.disabled = true;
          stopBtn.__morphAIChatToolbarSignature = 'mobile-hidden';
        } else
        if (String(stopBtn.__morphAIChatToolbarSignature || '') !== toolbarSignature) {
          stopBtn.classList.toggle('hidden', !aiChatState.busy);
          stopBtn.classList.toggle('flex', !!aiChatState.busy);
          stopBtn.style.display = aiChatState.busy ? 'flex' : 'none';
          stopBtn.disabled = !aiChatState.busy;
          stopBtn.__morphAIChatToolbarSignature = toolbarSignature;
          safeRun('refreshStopButtonIcon', () => {
            if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh({ root: stopBtn });
          });
        }
      }
      safeRun('renderAIChatDraftAttachments', () => {
        if (typeof api.renderAIChatDraftAttachments === 'function') api.renderAIChatDraftAttachments();
      });
      safeRun('syncAIInputLoadingState', () => {
        if (typeof api.syncAIInputLoadingState === 'function') api.syncAIInputLoadingState();
      });
      safeRun('syncMobileQuickComposeIcon', () => {
        if (typeof api.syncMobileQuickComposeIcon === 'function') api.syncMobileQuickComposeIcon();
      });
      if (shouldRefreshViewChrome) {
        const iconsOk = safeRun('refreshAIChatContainerIcons', () => {
          if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh({ root: container });
          return true;
        }, false);
        if (iconsOk !== false) {
          container.__morphAIChatViewChromeSignature = viewChromeSignature;
        }
      }
    }

    return { performRenderAIChatView };
  }

  window.MorphAIChatViewRenderRuntime = {
    create: createAIChatViewRenderRuntime,
  };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createAIChatViewRenderDepsRuntime(root) {
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
        getDocumentRef: pickFunction(context.getDocumentRef, () => getGlobalValue('document', currentRoot?.document || null)),
        getAIChatState: pickFunction(context.getAIChatState, () => {
          const value = getGlobalValue('aiChatState', {});
          return value && typeof value === 'object' ? value : {};
        }),
        getAIChatSessionInlineMenuId: pickFunction(context.getAIChatSessionInlineMenuId, () => String(getGlobalValue('aiChatSessionInlineMenuId', '') || '').trim()),
        getSortedAIChatSessions: pickFunction(context.getSortedAIChatSessions, getGlobalFunction('getSortedAIChatSessions') || (() => [])),
        ensureCurrentAIChatSession: pickFunction(context.ensureCurrentAIChatSession, getGlobalFunction('ensureCurrentAIChatSession') || (() => null)),
        renderAIExtensionShortcuts: pickFunction(context.renderAIExtensionShortcuts, getGlobalFunction('renderAIExtensionShortcuts') || (() => {})),
        renderAIExtensionPanels: pickFunction(context.renderAIExtensionPanels, getGlobalFunction('renderAIExtensionPanels') || (() => {})),
        escapeHTML: pickFunction(context.escapeHTML, getGlobalFunction('escapeHTML') || ((text = '') => String(text || ''))),
        requestLucideRefresh: pickFunction(context.requestLucideRefresh, getGlobalFunction('requestLucideRefresh') || (() => {})),
        getAIChatMessageRenderKey: pickFunction(context.getAIChatMessageRenderKey, getGlobalFunction('getAIChatMessageRenderKey') || (() => '')),
        classifyAIChatMessageListUpdate: pickFunction(context.classifyAIChatMessageListUpdate, getGlobalFunction('classifyAIChatMessageListUpdate') || (() => '')),
        syncAIChatMessageList: pickFunction(context.syncAIChatMessageList, getGlobalFunction('syncAIChatMessageList') || (() => {})),
        syncAIChatBubbleLayout: pickFunction(context.syncAIChatBubbleLayout, getGlobalFunction('syncAIChatBubbleLayout') || (() => {})),
        buildAIChatMessageHtml: pickFunction(context.buildAIChatMessageHtml, getGlobalFunction('buildAIChatMessageHtml') || (() => '')),
        buildAIChatEmptyStateHtml: pickFunction(context.buildAIChatEmptyStateHtml, getGlobalFunction('buildAIChatEmptyStateHtml') || (() => '')),
        renderAIChatDraftAttachments: pickFunction(context.renderAIChatDraftAttachments, getGlobalFunction('renderAIChatDraftAttachments') || (() => {})),
        syncAIInputLoadingState: pickFunction(context.syncAIInputLoadingState, getGlobalFunction('syncAIInputLoadingState') || (() => {})),
        syncMobileQuickComposeIcon: pickFunction(context.syncMobileQuickComposeIcon, getGlobalFunction('syncMobileQuickComposeIcon') || (() => {})),
      };
    }

    return { buildAppDeps };
  }

  window.MorphAIChatViewRenderDepsRuntime = { create: () => createAIChatViewRenderDepsRuntime(window) };
})();
