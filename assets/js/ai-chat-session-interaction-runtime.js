// @ts-check

(function initMorphAIChatSessionInteractionRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphAIChatSessionInteractionRuntime && typeof window.MorphAIChatSessionInteractionRuntime.create === 'function';
  const hasDepsRuntime = window.MorphAIChatSessionInteractionDepsRuntime && typeof window.MorphAIChatSessionInteractionDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createAIChatSessionInteractionRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function buildDialogueSessionEntityRef(sessionId = '', label = '', action = 'upsert') {
      const normalizedId = String(sessionId || '').trim();
      if (!normalizedId) return null;
      return {
        domain: 'aiChatSessions',
        entityType: 'ai_chat_session',
        entityId: normalizedId,
        action: String(action || 'upsert').trim() || 'upsert',
        label: String(label || '').trim().slice(0, 120),
      };
    }

    function buildDialogueCurrentSessionEntityRef(sessionId = '', label = '', action = 'point_to') {
      const normalizedId = String(sessionId || '').trim();
      if (!normalizedId) return null;
      return {
        domain: 'aiCurrentChatSessionId',
        entityType: 'ai_chat_session_pointer',
        entityId: normalizedId,
        action: String(action || 'point_to').trim() || 'point_to',
        label: String(label || '').trim().slice(0, 120),
      };
    }

    function buildDialogueMessageEntityRef(sessionId = '', messageId = '', label = '', action = 'upsert') {
      const normalizedSessionId = String(sessionId || '').trim();
      const normalizedMessageId = String(messageId || '').trim();
      if (!normalizedSessionId || !normalizedMessageId) return null;
      return {
        domain: 'aiChatSessions',
        entityType: 'ai_chat_message',
        entityId: `${normalizedSessionId}:${normalizedMessageId}`,
        action: String(action || 'upsert').trim() || 'upsert',
        label: String(label || '').trim().slice(0, 120),
      };
    }

    function collectDialogueEntityRefs(refs = []) {
      return (Array.isArray(refs) ? refs : []).filter((item) => item && typeof item === 'object');
    }

    function persistDialogueMutation(options = {}) {
      const label = String(options.label || '').trim();
      const actionType = String(options.actionType || 'manual_mutation').trim() || 'manual_mutation';
      const detail = options.detail && typeof options.detail === 'object' ? options.detail : {};
      const mutation = typeof options.mutation === 'function' ? options.mutation : null;
      if (!mutation) return false;
      if (typeof api.performMorphTransactionalMutation === 'function') {
        return api.performMorphTransactionalMutation({
          source: 'manual',
          actionType,
          promptQuestion: label || actionType,
          domains: ['aiMemoryFull'],
          detail,
          saveMode: 'silent',
          saveOptions: {
            skipUndo: true,
            skipRender: true,
            immediatePersist: true,
          },
          mutation,
        });
      }
      const result = mutation();
      if (result === false || result === null) return false;
      if (typeof api.persistAIChatHistory === 'function') {
        api.persistAIChatHistory({ syncData: true, flushNow: true });
      }
      return result;
    }

    function renameAIChatSession(sessionId, nextTitle, options = {}) {
      const normalizedId = String(sessionId || '').trim();
      const next = String(nextTitle || '').trim();
      if (!normalizedId || !next) return false;
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      const target = aiMemory?.chatSessions?.find((item) => item.id === normalizedId);
      if (!target) return false;
      target.title = next;
      target.customTitle = true;
      target.updatedAt = new Date().toISOString();
      setCurrentInlineMenuId('');
      if (options.render !== false && typeof api.requestAIChatRender === 'function') api.requestAIChatRender();
      if (options.persist !== false && typeof api.persistAIChatHistory === 'function') api.persistAIChatHistory({ syncData: true, flushNow: options.flushNow === true });
      return {
        changed: true,
        appliedLabel: options.label || `手动重命名对话：${next.slice(0, 24)}`,
        entityRefs: collectDialogueEntityRefs([
          buildDialogueSessionEntityRef(normalizedId, next, 'rename'),
          buildDialogueCurrentSessionEntityRef(String(aiMemory?.currentChatSessionId || normalizedId), next, 'point_to'),
        ]),
        patches: [{
          domain: 'aiChatSessions',
          entityType: 'ai_chat_session',
          entityId: normalizedId,
          action: 'rename',
          fieldPaths: ['title', 'customTitle', 'updatedAt'],
          reason: options.label || `手动重命名对话：${next.slice(0, 24)}`,
        }],
      };
    }

    function setAIChatSessionPinned(sessionId, options = {}) {
      const normalizedId = String(sessionId || '').trim();
      if (!normalizedId) return false;
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      const target = Array.isArray(aiMemory?.chatSessions)
        ? aiMemory.chatSessions.find((item) => String(item?.id || '') === normalizedId)
        : null;
      if (!target) return false;
      target.pinned = target.pinned === true ? false : true;
      target.updatedAt = new Date().toISOString();
      setCurrentInlineMenuId('');
      if (options.render !== false && typeof api.requestAIChatRender === 'function') api.requestAIChatRender();
      if (options.persist !== false && typeof api.persistAIChatHistory === 'function') api.persistAIChatHistory({ syncData: true, flushNow: options.flushNow === true });
      return {
        changed: true,
        appliedLabel: options.label || `${target.pinned ? '置顶' : '取消置顶'}对话：${String(target.title || '新对话').trim().slice(0, 24)}`,
        entityRefs: collectDialogueEntityRefs([
          buildDialogueSessionEntityRef(normalizedId, String(target.title || '').trim(), target.pinned ? 'pin' : 'unpin'),
          buildDialogueCurrentSessionEntityRef(String(aiMemory?.currentChatSessionId || normalizedId), String(target.title || '').trim(), 'point_to'),
        ]),
        patches: [{
          domain: 'aiChatSessions',
          entityType: 'ai_chat_session',
          entityId: normalizedId,
          action: target.pinned ? 'pin' : 'unpin',
          fieldPaths: ['pinned', 'updatedAt'],
          reason: options.label || `${target.pinned ? '置顶' : '取消置顶'}对话`,
        }],
      };
    }

    function getCurrentInlineMenuId() {
      if (typeof api.getAIChatSessionInlineMenuId === 'function') {
        return String(api.getAIChatSessionInlineMenuId() || '').trim();
      }
      return '';
    }

    function setCurrentInlineMenuId(value = '') {
      if (typeof api.setAIChatSessionInlineMenuId === 'function') {
        api.setAIChatSessionInlineMenuId(String(value || '').trim());
      }
    }

    function closeAIChatSessionInlineMenu() {
      if (!getCurrentInlineMenuId()) return;
      setCurrentInlineMenuId('');
      if (typeof api.requestAIChatRender === 'function') {
        api.requestAIChatRender();
      }
    }

    function closeAIChatSessionDrawer() {
      if (typeof api.setAIChatSessionDrawerOpen === 'function') api.setAIChatSessionDrawerOpen(false);
    }

    function handleAIChatMessageContext(event, messageId) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      closeAIChatSessionInlineMenu();
      if (typeof api.showAIChatMessageMenuAt === 'function') {
        api.showAIChatMessageMenuAt(messageId, event?.clientX ?? 0, event?.clientY ?? 0);
      }
      return false;
    }

    function promptRenameAIChatSession(sessionId) {
      const sessions = typeof api.getSortedAIChatSessions === 'function' ? api.getSortedAIChatSessions() : [];
      const session = sessions.find((item) => item.id === sessionId);
      if (!session) return;
      setCurrentInlineMenuId('');
      closeAIChatSessionDrawer();
      if (typeof api.requestAIChatRender === 'function') {
        api.requestAIChatRender();
      }
      if (typeof api.openCustomModal !== 'function') return;
      api.openCustomModal({
        title: '重命名对话',
        desc: '请输入新的对话名称',
        showInput: true,
        placeholder: session.title || '新对话',
        inputValue: session.title || '',
        onConfirm: (val) => {
          const next = String(val || '').trim();
          if (!next) return;
          const label = `手动重命名对话：${next.slice(0, 24)}`;
          persistDialogueMutation({
            actionType: 'manual_rename_ai_chat_session',
            label,
            detail: {
              sessionId,
              title: next,
              changedFields: ['title', 'customTitle', 'updatedAt'],
            },
            mutation: () => renameAIChatSession(sessionId, next, {
              persist: false,
              render: true,
              label,
            }),
          });
        },
      });
    }

    function toggleAIChatSessionInlineMenu(event, sessionId) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const nextId = String(sessionId || '').trim();
      if (!nextId) return false;
      const current = getCurrentInlineMenuId();
      setCurrentInlineMenuId(current === nextId ? '' : nextId);
      if (typeof api.requestAIChatRender === 'function') {
        api.requestAIChatRender();
      }
      return false;
    }

    function togglePinAIChatSession(sessionId) {
      const normalizedId = String(sessionId || '').trim();
      if (!normalizedId) return;
      const existingSessions = typeof api.getSortedAIChatSessions === 'function' ? api.getSortedAIChatSessions() : [];
      const target = existingSessions.find((item) => String(item?.id || '').trim() === normalizedId);
      if (!target) return;
      closeAIChatSessionDrawer();
      const nextPinned = target.pinned !== true;
      const label = `${nextPinned ? '置顶' : '取消置顶'}对话：${String(target.title || '新对话').trim().slice(0, 24)}`;
      persistDialogueMutation({
        actionType: 'manual_toggle_pin_ai_chat_session',
        label,
        detail: {
          sessionId: normalizedId,
          pinned: nextPinned,
          changedFields: ['pinned', 'updatedAt'],
        },
        mutation: () => setAIChatSessionPinned(normalizedId, {
          persist: false,
          render: true,
          label,
        }),
      });
    }

    function handleAIChatSessionContext(event, sessionId) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (typeof api.clearAIChatSessionLongPress === 'function') api.clearAIChatSessionLongPress();
      closeAIChatSessionInlineMenu();
      const aiChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
      if (!aiChatState || typeof aiChatState !== 'object') return false;
      aiChatState.suppressNextSessionClick = true;
      const x = event?.clientX ?? 0;
      const y = event?.clientY ?? 0;
      if (typeof api.showAIChatSessionMenuAt === 'function') api.showAIChatSessionMenuAt(sessionId, x, y);
      setTimeout(() => { aiChatState.suppressNextSessionClick = false; }, 220);
      return false;
    }

    function handleAIChatSessionTouchStart(event, sessionId) {
      if (typeof api.isMobileNavMode === 'function' && !api.isMobileNavMode()) return;
      if (typeof api.clearAIChatSessionLongPress === 'function') api.clearAIChatSessionLongPress();
      const touch = event?.touches?.[0];
      const point = {
        x: touch?.clientX ?? 0,
        y: touch?.clientY ?? 0,
      };
      const aiChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
      if (!aiChatState || typeof aiChatState !== 'object') return;
      aiChatState.longPressTimer = setTimeout(() => {
        aiChatState.suppressNextSessionClick = true;
        if (typeof api.showAIChatSessionMenuAt === 'function') api.showAIChatSessionMenuAt(sessionId, point.x, point.y);
        setTimeout(() => { aiChatState.suppressNextSessionClick = false; }, 260);
      }, 520);
    }

    function handleAIChatSessionTouchEnd() {
      if (typeof api.clearAIChatSessionLongPress === 'function') api.clearAIChatSessionLongPress();
    }

    function switchAIChatSession(sessionId) {
      const normalizedId = String(sessionId || '').trim();
      if (!normalizedId) return;
      const aiChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
      if (!aiChatState || typeof aiChatState !== 'object') return;
      if (aiChatState.suppressNextSessionClick) {
        aiChatState.suppressNextSessionClick = false;
        return;
      }
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      const session = (Array.isArray(aiMemory.chatSessions) ? aiMemory.chatSessions : [])
        .find((item) => String(item?.id || '').trim() === normalizedId);
      if (!session) return;
      if (String(aiChatState.sessionId || '').trim() === normalizedId) return;
      if (typeof api.setCurrentAIChatSessionId === 'function') api.setCurrentAIChatSessionId(normalizedId, { aiMemory, pointerSource: 'manual-switch' });
      else {
        aiMemory.currentChatSessionId = normalizedId;
        if (typeof api.setStoredActiveAIChatSessionId === 'function') api.setStoredActiveAIChatSessionId(normalizedId);
      }
      const maxMessages = Math.max(1, Number(api.getAIChatMaxMessages?.() || 60));
      aiChatState.sessionId = normalizedId;
      aiChatState.messages = Array.isArray(session.messages) ? session.messages.slice(-maxMessages) : [];
      aiChatState.forceScrollToBottom = true;
      if (typeof api.bumpUISessionLock === 'function') api.bumpUISessionLock(1200);
      setCurrentInlineMenuId('');
      if (typeof api.isMobileNavMode === 'function' && api.isMobileNavMode()) {
        if (typeof api.setAIChatSessionDrawerOpen === 'function') api.setAIChatSessionDrawerOpen(false);
      } else if (typeof api.applyAIChatSessionDrawerState === 'function') {
        api.applyAIChatSessionDrawerState();
      }
      if (typeof api.requestAIChatRender === 'function') api.requestAIChatRender();
    }

    function deleteAIChatSession(sessionId, options = {}) {
      const normalizedId = String(sessionId || '').trim();
      if (!normalizedId) return;
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      if (!aiMemory || typeof aiMemory !== 'object') return;
      const sessions = typeof api.getSortedAIChatSessions === 'function' ? api.getSortedAIChatSessions() : [];
      const exists = sessions.find((item) => String(item?.id || '').trim() === normalizedId);
      if (!exists) return;
      const remaining = sessions.filter((item) => String(item?.id || '').trim() !== normalizedId);
      const aiChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
      let nextCurrentSessionId = '';
      let nextCurrentSessionTitle = '';
      if (remaining.length === 0) {
        const fresh = typeof api.createAIChatSession === 'function' ? api.createAIChatSession() : null;
        if (!fresh || typeof fresh !== 'object') return;
        aiMemory.chatSessions = [fresh];
        if (typeof api.setCurrentAIChatSessionId === 'function') api.setCurrentAIChatSessionId(fresh.id, { aiMemory, pointerSource: 'delete-seeded' });
        else aiMemory.currentChatSessionId = fresh.id;
        nextCurrentSessionId = String(fresh.id || '').trim();
        nextCurrentSessionTitle = String(fresh.title || '').trim();
        if (aiChatState && typeof aiChatState === 'object') {
          aiChatState.sessionId = fresh.id;
          aiChatState.messages = [];
        }
      } else {
        aiMemory.chatSessions = remaining;
        if (String(aiMemory.currentChatSessionId || '').trim() === normalizedId) {
          if (typeof api.setCurrentAIChatSessionId === 'function') api.setCurrentAIChatSessionId(String(remaining[0]?.id || '').trim(), { aiMemory, pointerSource: 'delete-fallback' });
          else aiMemory.currentChatSessionId = String(remaining[0]?.id || '').trim();
        }
        nextCurrentSessionId = String(aiMemory.currentChatSessionId || remaining[0]?.id || '').trim();
        if (typeof api.setCurrentAIChatSessionId === 'function' && nextCurrentSessionId) {
          api.setCurrentAIChatSessionId(nextCurrentSessionId, { aiMemory, pointerSource: 'delete-keep-current' });
        }
        nextCurrentSessionTitle = String(remaining.find((item) => String(item?.id || '').trim() === nextCurrentSessionId)?.title || remaining[0]?.title || '').trim();
        if (typeof api.syncAIChatStateFromData === 'function') api.syncAIChatStateFromData();
      }
      if (options.persist !== false && typeof api.persistAIChatHistory === 'function') api.persistAIChatHistory({ syncData: true, flushNow: options.flushNow === true });
      setCurrentInlineMenuId('');
      if (options.render !== false && typeof api.requestAIChatRender === 'function') api.requestAIChatRender();
      return {
        changed: true,
        appliedLabel: options.label || `手动删除对话：${String(exists?.title || '新对话').trim().slice(0, 24)}`,
        entityRefs: collectDialogueEntityRefs([
          buildDialogueSessionEntityRef(normalizedId, String(exists?.title || '').trim(), 'delete'),
          buildDialogueCurrentSessionEntityRef(nextCurrentSessionId, nextCurrentSessionTitle, 'point_to'),
        ]),
        patches: [
          {
            domain: 'aiChatSessions',
            entityType: 'ai_chat_session',
            entityId: normalizedId,
            action: 'delete',
            fieldPaths: ['chatSessions'],
            reason: options.label || '手动删除对话',
          },
          {
            domain: 'aiCurrentChatSessionId',
            entityType: 'ai_chat_session_pointer',
            entityId: nextCurrentSessionId || normalizedId,
            action: 'point_to',
            fieldPaths: ['currentChatSessionId'],
            reason: options.label || '手动删除对话',
          },
        ],
      };
    }

    function confirmDeleteAIChatSession(sessionId) {
      const normalizedId = String(sessionId || '').trim();
      if (!normalizedId) return;
      const session = (typeof api.getSortedAIChatSessions === 'function' ? api.getSortedAIChatSessions() : [])
        .find((item) => String(item?.id || '').trim() === normalizedId);
      if (!session) return;
      setCurrentInlineMenuId('');
      closeAIChatSessionDrawer();
      if (typeof api.requestAIChatRender === 'function') {
        api.requestAIChatRender();
      }
      if (typeof api.openCustomModal !== 'function') return;
      api.openCustomModal({
        title: '删除对话？',
        desc: `将删除对话“${session.title || '新对话'}”。若误删，可通过“撤销最近一次手动操作”恢复。`,
        onConfirm: () => {
          const label = `手动删除对话：${session.title || '新对话'}`;
          if (typeof api.performMorphTransactionalMutation === 'function') {
            persistDialogueMutation({
              actionType: 'manual_delete_ai_chat_session',
              label,
              detail: {
                sessionId: normalizedId,
                changedFields: ['chatSessions', 'currentChatSessionId'],
              },
              mutation: () => deleteAIChatSession(normalizedId, {
                persist: false,
                render: true,
                label,
              }),
            });
            return;
          }
          deleteAIChatSession(normalizedId);
        },
      });
    }

    function deleteAIChatMessage(messageId, options = {}) {
      const normalizedId = String(messageId || '').trim();
      if (!normalizedId) return;
      const aiChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
      if (!aiChatState || typeof aiChatState !== 'object') return;
      const messages = Array.isArray(aiChatState.messages) ? aiChatState.messages : [];
      const idx = messages.findIndex((msg) => String(msg?.id || '').trim() === normalizedId);
      if (idx < 0) return;
      const target = messages[idx];
      const sessionId = String(aiChatState.sessionId || '').trim();
      const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
      messages.splice(idx, 1);
      if (String(aiChatState.currentAssistantMessageId || '').trim() === normalizedId) aiChatState.currentAssistantMessageId = null;
      if (aiMemory && typeof aiMemory === 'object' && sessionId) {
        const session = Array.isArray(aiMemory.chatSessions)
          ? aiMemory.chatSessions.find((item) => String(item?.id || '').trim() === sessionId)
          : null;
        if (session && typeof session === 'object') {
          session.messages = Array.isArray(messages) ? messages.slice() : [];
          session.updatedAt = new Date().toISOString();
        }
      }
      if (options.persist !== false && typeof api.persistAIChatHistory === 'function') api.persistAIChatHistory({ syncData: true, flushNow: options.flushNow === true });
      if (options.render !== false && typeof api.requestAIChatRender === 'function') api.requestAIChatRender();
      return {
        changed: true,
        appliedLabel: options.label || `手动删除对话消息：${String(target?.content || '').replace(/\s+/g, ' ').trim().slice(0, 24)}`,
        entityRefs: collectDialogueEntityRefs([
          buildDialogueSessionEntityRef(sessionId, '', 'upsert'),
          buildDialogueMessageEntityRef(sessionId, normalizedId, String(target?.content || '').replace(/\s+/g, ' ').trim(), 'delete'),
        ]),
        patches: [{
          domain: 'aiChatSessions',
          entityType: 'ai_chat_message',
          entityId: sessionId && normalizedId ? `${sessionId}:${normalizedId}` : normalizedId,
          action: 'delete',
          fieldPaths: ['messages', 'updatedAt'],
          reason: options.label || '手动删除对话消息',
        }],
      };
    }

    function confirmDeleteAIChatMessage(messageId) {
      const normalizedId = String(messageId || '').trim();
      if (!normalizedId) return;
      const aiChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
      if (!aiChatState || typeof aiChatState !== 'object') return;
      const target = (Array.isArray(aiChatState.messages) ? aiChatState.messages : [])
        .find((msg) => String(msg?.id || '').trim() === normalizedId);
      if (!target) return;
      const roleLabel = target.role === 'user'
        ? '你的提问'
        : target.role === 'assistant'
          ? 'AI 回复'
          : '系统消息';
      const preview = String(target.content || '').replace(/\s+/g, ' ').trim().slice(0, 42);
      if (typeof api.openCustomModal !== 'function') return;
      api.openCustomModal({
        title: '删除这条对话？',
        desc: `${roleLabel}：${preview || '（空内容）'}。若误删，可通过“撤销最近一次手动操作”恢复。`,
        onConfirm: () => {
          const label = `手动删除对话消息：${preview || roleLabel}`;
          if (typeof api.performMorphTransactionalMutation === 'function') {
            persistDialogueMutation({
              actionType: 'manual_delete_ai_chat_message',
              label,
              detail: {
                messageId: normalizedId,
                changedFields: ['chatSessions.messages', 'chatSessions.updatedAt'],
              },
              mutation: () => deleteAIChatMessage(normalizedId, {
                persist: false,
                render: true,
                label,
              }),
            });
            return;
          }
          deleteAIChatMessage(normalizedId);
        },
      });
    }

    function quoteAIChatMessageToComposer(messageId) {
      const normalizedId = String(messageId || '').trim();
      if (!normalizedId) return false;
      const aiChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
      if (!aiChatState || typeof aiChatState !== 'object') return false;
      const target = (Array.isArray(aiChatState.messages) ? aiChatState.messages : [])
        .find((msg) => String(msg?.id || '').trim() === normalizedId);
      if (!target) return false;
      const content = String(target.content || '').replace(/<<ACTIONS[\s\S]*$/i, '').trim();
      if (!content || /^(思考中|已停止生成。?)$/.test(content)) return false;
      const quotedBody = content.split(/\r?\n/).map((line) => `> ${line}`).join('\n');
      const quoteText = `引用对话：\n${quotedBody}\n\n`;
      const input = typeof api.getAIChatInputElement === 'function' ? api.getAIChatInputElement() : null;
      if (!input) return false;
      const existing = String(input.value || '').trim();
      input.value = existing ? `${existing}\n\n${quoteText}` : quoteText;
      if (typeof api.resizeComposerTextarea === 'function') {
        api.resizeComposerTextarea(input, input.id === 'omni-input' ? 132 : 120);
      }
      if (input.id === 'mobile-detail-input') {
        if (typeof api.syncMobileContextDetailInputState === 'function') api.syncMobileContextDetailInputState();
        else if (typeof api.syncComposerLayoutState === 'function') api.syncComposerLayoutState(input.id === 'ai-chat-input' ? 'ai-chat' : 'omni');
      }
      try {
        const len = input.value.length;
        input.focus();
        input.setSelectionRange(len, len);
      } catch (_) {}
      if (typeof api.markUserEditingActivity === 'function') api.markUserEditingActivity();
      return true;
    }

    function startNewAIChatSession() {
      const aiChatState = typeof api.getAIChatState === 'function' ? api.getAIChatState() : null;
      if (!aiChatState || typeof aiChatState !== 'object') return;
      if (aiChatState.busy && typeof api.stopAIChatGeneration === 'function') api.stopAIChatGeneration();
      const label = '手动新建对话';
      const createSessionMutation = () => {
        const aiMemory = typeof api.getAIMemory === 'function' ? api.getAIMemory() : null;
        if (!aiMemory || typeof aiMemory !== 'object') return false;
        const session = typeof api.createAIChatSession === 'function' ? api.createAIChatSession() : null;
        if (!session) return false;
        const sessions = typeof api.getSortedAIChatSessions === 'function' ? api.getSortedAIChatSessions() : [];
        const maxSessions = Math.max(1, Number(api.getAIChatMaxSessions?.() || 50));
        aiMemory.chatSessions = [session].concat(sessions).slice(0, maxSessions);
        if (typeof api.setCurrentAIChatSessionId === 'function') {
          api.setCurrentAIChatSessionId(session.id, { aiMemory, pointerSource: 'manual-create' });
        } else {
          aiMemory.currentChatSessionId = session.id;
          if (typeof api.setStoredActiveAIChatSessionId === 'function') {
            api.setStoredActiveAIChatSessionId(session.id);
          }
        }
        aiChatState.sessionId = session.id;
        aiChatState.messages = [];
        aiChatState.forceScrollToBottom = true;
        setCurrentInlineMenuId('');
        if (typeof api.isMobileNavMode === 'function' && api.isMobileNavMode()) {
          if (typeof api.setAIChatSessionDrawerOpen === 'function') api.setAIChatSessionDrawerOpen(false);
        } else if (typeof api.applyAIChatSessionDrawerState === 'function') {
          api.applyAIChatSessionDrawerState();
        }
        if (typeof api.requestAIChatRender === 'function') api.requestAIChatRender();
        if (typeof api.focusOmniInputSoon === 'function') api.focusOmniInputSoon(80);
        return {
          changed: true,
          appliedLabel: label,
          entityRefs: collectDialogueEntityRefs([
            buildDialogueSessionEntityRef(String(session.id || '').trim(), String(session.title || '').trim(), 'create'),
            buildDialogueCurrentSessionEntityRef(String(session.id || '').trim(), String(session.title || '').trim(), 'point_to'),
          ]),
          patches: [
            {
              domain: 'aiChatSessions',
              entityType: 'ai_chat_session',
              entityId: String(session.id || '').trim(),
              action: 'create',
              fieldPaths: ['chatSessions'],
              reason: label,
            },
            {
              domain: 'aiCurrentChatSessionId',
              entityType: 'ai_chat_session_pointer',
              entityId: String(session.id || '').trim(),
              action: 'point_to',
              fieldPaths: ['currentChatSessionId'],
              reason: label,
            },
          ],
        };
      };
      const applied = persistDialogueMutation({
        actionType: 'manual_create_ai_chat_session',
        label,
        detail: {
          changedFields: ['chatSessions', 'currentChatSessionId'],
        },
        mutation: createSessionMutation,
      });
      if (!applied) return;
    }

    function returnFromAIPage() {
      const lastNonAITab = typeof api.getLastNonAITab === 'function'
        ? String(api.getLastNonAITab() || '').trim()
        : '';
      if (typeof api.switchTab === 'function') api.switchTab(lastNonAITab || 'flashThoughts');
    }

    return {
      closeAIChatSessionInlineMenu,
      handleAIChatMessageContext,
      promptRenameAIChatSession,
      toggleAIChatSessionInlineMenu,
      togglePinAIChatSession,
      handleAIChatSessionContext,
      handleAIChatSessionTouchStart,
      handleAIChatSessionTouchEnd,
      switchAIChatSession,
      deleteAIChatSession,
      confirmDeleteAIChatSession,
      deleteAIChatMessage,
      confirmDeleteAIChatMessage,
      quoteAIChatMessageToComposer,
      startNewAIChatSession,
      returnFromAIPage,
    };
  }

  window.MorphAIChatSessionInteractionRuntime = {
    create: createAIChatSessionInteractionRuntime,
  };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createAIChatSessionInteractionDepsRuntime(root) {
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
        getAIChatSessionInlineMenuId: pickFunction(context.getAIChatSessionInlineMenuId, () => String(getGlobalValue('aiChatSessionInlineMenuId', '') || '').trim()),
        setAIChatSessionInlineMenuId: pickFunction(context.setAIChatSessionInlineMenuId, (value) => { currentRoot.aiChatSessionInlineMenuId = String(value || '').trim(); }),
        getCurrentTab: pickFunction(context.getCurrentTab, () => String(getGlobalValue('currentTab', '') || '').trim()),
        requestAIChatRender: pickFunction(context.requestAIChatRender, getGlobalFunction('requestAIChatRender') || (() => {})),
        showAIChatMessageMenuAt: pickFunction(context.showAIChatMessageMenuAt, getGlobalFunction('showAIChatMessageMenuAt') || (() => {})),
        getSortedAIChatSessions: pickFunction(context.getSortedAIChatSessions, getGlobalFunction('getSortedAIChatSessions') || (() => [])),
        openCustomModal: pickFunction(context.openCustomModal, getGlobalFunction('openCustomModal') || null),
        getAIMemory: pickFunction(context.getAIMemory, getGlobalFunction('getAIMemory') || (() => null)),
        persistAIChatHistory: pickFunction(context.persistAIChatHistory, getGlobalFunction('persistAIChatHistory') || (() => {})),
        clearAIChatSessionLongPress: pickFunction(context.clearAIChatSessionLongPress, getGlobalFunction('clearAIChatSessionLongPress') || (() => {})),
        getAIChatState: pickFunction(context.getAIChatState, () => {
          const value = getGlobalValue('aiChatState', {});
          return value && typeof value === 'object' ? value : {};
        }),
        showAIChatSessionMenuAt: pickFunction(context.showAIChatSessionMenuAt, getGlobalFunction('showAIChatSessionMenuAt') || (() => {})),
        isMobileNavMode: pickFunction(context.isMobileNavMode, getGlobalFunction('isMobileNavMode') || (() => false)),
        stopAIChatGeneration: pickFunction(context.stopAIChatGeneration, getGlobalFunction('stopAIChatGeneration') || (() => {})),
        createAIChatSession: pickFunction(context.createAIChatSession, getGlobalFunction('createAIChatSession') || (() => null)),
        syncAIChatStateFromData: pickFunction(context.syncAIChatStateFromData, getGlobalFunction('syncAIChatStateFromData') || (() => {})),
        performMorphTransactionalMutation: pickFunction(context.performMorphTransactionalMutation, getGlobalFunction('performMorphTransactionalMutation') || null),
        getAIChatInputElement: pickFunction(context.getAIChatInputElement, getGlobalFunction('getAIChatInputElement') || (() => null)),
        resizeComposerTextarea: pickFunction(context.resizeComposerTextarea, getGlobalFunction('resizeComposerTextarea') || (() => {})),
        syncMobileContextDetailInputState: pickFunction(context.syncMobileContextDetailInputState, getGlobalFunction('syncMobileContextDetailInputState') || null),
        syncComposerLayoutState: pickFunction(context.syncComposerLayoutState, getGlobalFunction('syncComposerLayoutState') || null),
        markUserEditingActivity: pickFunction(context.markUserEditingActivity, getGlobalFunction('markUserEditingActivity') || (() => {})),
        getAIChatMaxSessions: pickFunction(context.getAIChatMaxSessions, () => Number(getGlobalValue('AI_CHAT_MAX_SESSIONS', 50) || 50)),
        getAIChatMaxMessages: pickFunction(context.getAIChatMaxMessages, () => Number(getGlobalValue('AI_CHAT_MAX_MESSAGES', 60) || 60)),
        setStoredActiveAIChatSessionId: pickFunction(context.setStoredActiveAIChatSessionId, getGlobalFunction('setStoredActiveAIChatSessionId') || (() => {})),
        bumpUISessionLock: pickFunction(context.bumpUISessionLock, getGlobalFunction('bumpUISessionLock') || (() => {})),
        getLastNonAITab: pickFunction(context.getLastNonAITab, () => String(getGlobalValue('lastNonAITab', '') || '').trim()),
        switchTab: pickFunction(context.switchTab, getGlobalFunction('switchTab') || (() => {})),
        setAIChatSessionDrawerOpen: pickFunction(context.setAIChatSessionDrawerOpen, getGlobalFunction('setAIChatSessionDrawerOpen') || (() => {})),
        applyAIChatSessionDrawerState: pickFunction(context.applyAIChatSessionDrawerState, getGlobalFunction('applyAIChatSessionDrawerState') || (() => {})),
        focusOmniInputSoon: pickFunction(context.focusOmniInputSoon, getGlobalFunction('focusOmniInputSoon') || (() => {})),
      };
    }

    return { buildAppDeps };
  }

  window.MorphAIChatSessionInteractionDepsRuntime = { create: () => createAIChatSessionInteractionDepsRuntime(window) };
})();
