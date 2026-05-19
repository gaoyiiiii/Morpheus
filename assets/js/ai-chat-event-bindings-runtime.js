// @ts-check

(function initMorphAIChatEventBindingsRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIChatEventBindingsRuntime && typeof window.MorphAIChatEventBindingsRuntime.create === 'function') return;

  function createAIChatEventBindingsRuntime() {
    let didBind = false;
    let didBindEditorInteractionEvents = false;
    let didBindDetailEditorSurfaceEvents = false;
    let didBindThoughtHeaderMenuEvents = false;
    let didBindShellSearchEvents = false;
    let didBindHeaderPillDismissEvents = false;
    let didBindDetailLinkInteractionEvents = false;
    let didBindRichLinkLifecycleEvents = false;
    let didBindAppInputLifecycleEvents = false;
    let didBindModalActionEvents = false;
    let didBindBlockHandleActionGlobals = false;
    let didBindContextBatchMenuEvents = false;
    let touchLongPressTimer = null;
    let touchLongPressStart = null;
    let touchLongPressHandled = false;
    let touchLongPressTarget = null;
    let touchLongPressMeta = null;
    let mobileBottomNavGestureLock = false;
    let editorSaveToastTimer = null;

    function isMobileBottomGestureProtectedTarget(target) {
      return !!target?.closest?.('#mobile-bottom-nav, #mobile-quick-compose-btn');
    }

    function clearTouchLongPressState() {
      if (touchLongPressTimer) clearTimeout(touchLongPressTimer);
      touchLongPressTimer = null;
      touchLongPressStart = null;
      touchLongPressTarget = null;
      touchLongPressMeta = null;
    }

    function prefersNativeTouchSelection(target) {
      if (!target?.closest) return false;
      if (target.closest('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')) return true;
      return !!target.closest('.ai-chat-bubble, .ai-chat-md, .thought-card-preview-body, .thought-card-preview-rich, .thought-card-preview-text');
    }

    function shouldIgnoreTouchLongPressMenu(target) {
      if (!target?.closest) return true;
      if (target.closest('#mobile-detail-voice-hold-btn, #mobile-detail-voice-toggle-btn, #ai-chat-drawer-voice-hold-btn, #ai-chat-drawer-voice-toggle-btn')) return true;
      if (prefersNativeTouchSelection(target)) return true;
      if (target.closest('button, a, input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')) return true;
      return false;
    }

    function detectTouchLongPressMenuMeta(target) {
      if (!target?.closest) return null;
      const linkNode = target.closest('.rich-link-node');
      const editableRoot = linkNode && linkNode.closest('#detail-editor-rich, .block-content, .rhythm-node-input');
      if (linkNode && editableRoot) return { target: linkNode, meta: { type: 'link' } };
      const orbitFragment = target.closest('[data-orbit-fragment]');
      if (orbitFragment) {
          const itemId = orbitFragment.getAttribute('data-item-id');
          const parentId = orbitFragment.getAttribute('data-parent-id');
          const contextType = orbitFragment.getAttribute('data-context-type');
          if (!itemId || !parentId || !contextType) return null;
          return { target: orbitFragment, meta: { type: 'orbit-fragment', itemId, parentId, contextType }, };
      }
      if (shouldIgnoreTouchLongPressMenu(target)) return null;
      const aiChatMessage = target.closest('.ai-chat-item[data-ai-chat-message-id]');
      if (aiChatMessage) {
          const messageId = String(aiChatMessage.getAttribute('data-ai-chat-message-id') || '').trim();
          if (!messageId) return null;
          return { target: aiChatMessage, meta: { type: 'ai-chat-message', messageId }, };
      }
      const projectLaneHead = target.closest('[data-project-lane-head="true"]');
      if (projectLaneHead) {
          const laneId = String(
            projectLaneHead.closest('[data-project-lane-id]')?.getAttribute('data-project-lane-id')
            || projectLaneHead.getAttribute('data-project-lane-id')
            || ''
          ).trim();
          if (!laneId) return null;
          return { target: projectLaneHead, meta: { type: 'project-lane', laneId }, };
      }
      const contextCard = target.closest('[data-context-card-type][data-context-card-id], [oncontextmenu*="handleContextCardRightClick"]');
      if (contextCard) {
          const contextType = String(
            contextCard.getAttribute('data-context-card-type')
            || contextCard.getAttribute('oncontextmenu')?.match(/'([^']+)'\s*,\s*'([^']+)'/)?.[1]
            || ''
          ).trim();
          const id = String(
            contextCard.getAttribute('data-context-card-id')
            || contextCard.getAttribute('oncontextmenu')?.match(/'([^']+)'\s*,\s*'([^']+)'/)?.[2]
            || ''
          ).trim();
          if (!contextType || !id) return null;
          return { target: contextCard, meta: { type: 'context-card', contextType, id }, };
      }
      return null;
    }

    function handleManagedBlockPointerCompletion(target, clientX = null, clientY = null) {
      if (!target?.closest) return false;
      if (blockSweepSelection) return false;
      if (target.closest('button, a, input, textarea, .drag-handle, [contenteditable="false"]')) return false;
      if (target.closest('[contenteditable="true"]')) return false;
      const row = target.closest('.block-row[data-context][data-context-id][data-block-id]');
      const context = row?.dataset?.context || '';
      if (row && (context === 'daily' || context === 'project')) return focusManagedBlockEditorAtPoint(context, row.dataset.contextId || '', row.dataset.blockId || '', clientX, clientY);
      const dailyContainer = target.closest('#daily-block-editor');
      if (dailyContainer && target === dailyContainer) return handleManagedBlockEditorContainerPointer({ target: dailyContainer, clientX, clientY }, 'daily', ensureSelectedDailyMonth());
      const projectContainer = target.closest('#project-block-editor');
      if (projectContainer && target === projectContainer && activeContextId) return handleManagedBlockEditorContainerPointer({ target: projectContainer, clientX, clientY }, 'project', activeContextId);
      return false;
    }

    function ensureEditorSaveShortcutToastElement() {
      if (typeof document === 'undefined') return null;
      let toast = document.getElementById('editor-save-shortcut-toast');
      if (toast && document.body?.contains(toast)) return toast;
      toast = document.createElement('div');
      toast.id = 'editor-save-shortcut-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.innerHTML = [
        '<span class="editor-save-shortcut-toast-icon"><i data-lucide="check" class="w-3.5 h-3.5"></i></span>',
        '<span class="editor-save-shortcut-toast-copy">',
        '<span class="editor-save-shortcut-toast-title">已保存</span>',
        '<span class="editor-save-shortcut-toast-desc">Morpheus 会自动保存，不用手动按。</span>',
        '</span>',
      ].join('');
      document.body?.appendChild(toast);
      if (typeof requestLucideRefresh === 'function') requestLucideRefresh({ root: toast });
      return toast;
    }

    function showEditorSaveShortcutToast() {
      const toast = ensureEditorSaveShortcutToastElement();
      if (!toast) return;
      toast.classList.remove('is-visible');
      void toast.offsetWidth;
      toast.classList.add('is-visible');
      if (editorSaveToastTimer) clearTimeout(editorSaveToastTimer);
      editorSaveToastTimer = setTimeout(() => {
        editorSaveToastTimer = null;
        toast.classList.remove('is-visible');
      }, 2600);
    }

    function handleEditorSaveShortcut(event) {
      const key = String(event?.key || '').toLowerCase();
      if (!((event?.metaKey || event?.ctrlKey) && !event?.altKey && !event?.shiftKey && key === 's')) return false;
      event.preventDefault();
      event.stopPropagation();
      let flushedActiveEditor = false;
      let didRequestSave = false;
      if (typeof flushActiveManagedEditorToCanonicalData === 'function') {
        try {
          flushedActiveEditor = !!flushActiveManagedEditorToCanonicalData({ immediatePersist: true });
          didRequestSave = flushedActiveEditor;
        } catch (error) {
          console.warn('[Morpheus] Failed to flush active editor before save shortcut.', error);
        }
      }
      if (!flushedActiveEditor && typeof saveData === 'function') {
        saveData({ immediatePersist: true, skipRender: true, skipUndo: true });
        didRequestSave = true;
      }
      if (didRequestSave) showEditorSaveShortcutToast();
      return true;
    }

    function bindAIChatEventBindings() {
      if (didBind) return;
      didBind = true;

      document.getElementById('ai-chat-new-btn')?.addEventListener('click', startNewAIChatSession);
      document.getElementById('ai-web-entry')?.addEventListener('click', () => {
          activateAIPendingWebSearchIntent();
      });
      document.getElementById('omni-ai-web-entry')?.addEventListener('click', () => {
          activateAIPendingWebSearchIntent();
      });
      document.getElementById('ai-chat-plus-btn')?.addEventListener('click', (e) => {
          if (!AI_COMPOSER_PLUS_ENABLED) return;
          e.preventDefault();
          e.stopPropagation();
          toggleAIChatUtilityMenu();
      });
      document.getElementById('omni-ai-plus-btn')?.addEventListener('click', (e) => {
          if (!AI_COMPOSER_PLUS_ENABLED) return;
          e.preventDefault();
          e.stopPropagation();
          toggleAIChatUtilityMenu();
      });
      document.getElementById('mobile-ai-plus-btn')?.addEventListener('click', (e) => {
          if (!AI_COMPOSER_PLUS_ENABLED) return;
          e.preventDefault();
          e.stopPropagation();
          toggleAIChatUtilityMenu();
      });
      document.getElementById('ai-chat-upload-learning-entry')?.addEventListener('click', () => {
          activateAIPendingUtilityCategory('upload');
      });
      document.getElementById('omni-ai-upload-learning-entry')?.addEventListener('click', () => {
          activateAIPendingUtilityCategory('upload');
      });
      document.getElementById('mobile-ai-upload-learning-entry')?.addEventListener('click', () => {
          activateAIPendingUtilityCategory('upload');
      });
      document.getElementById('ai-chat-upload-direct-entry')?.addEventListener('click', () => {
          activateAIInlineUploadIntent({ mode: 'reference', openPicker: true });
      });
      document.getElementById('omni-ai-upload-direct-entry')?.addEventListener('click', () => {
          activateAIInlineUploadIntent({ mode: 'reference', openPicker: true });
      });
      document.getElementById('mobile-ai-upload-direct-entry')?.addEventListener('click', () => {
          activateAIInlineUploadIntent({ mode: 'reference', openPicker: true });
      });
      document.getElementById('ai-chat-time-block-entry')?.addEventListener('click', () => {
          activateAIPendingUtilityCategory('timeBlocks');
      });
      document.getElementById('omni-ai-time-block-entry')?.addEventListener('click', () => {
          activateAIPendingUtilityCategory('timeBlocks');
      });
      document.getElementById('mobile-ai-time-block-entry')?.addEventListener('click', () => {
          activateAIPendingUtilityCategory('timeBlocks');
      });
      document.getElementById('ai-chat-script-workflow-entry')?.addEventListener('click', () => {
          activateAIPendingUtilityCategory('scriptWorkflow');
      });
      document.getElementById('omni-ai-script-workflow-entry')?.addEventListener('click', () => {
          activateAIPendingUtilityCategory('scriptWorkflow');
      });
      document.getElementById('mobile-ai-script-workflow-entry')?.addEventListener('click', () => {
          activateAIPendingUtilityCategory('scriptWorkflow');
      });
      document.getElementById('ai-chat-upload-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('omni-ai-upload-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('mobile-ai-upload-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('ai-chat-web-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('omni-ai-web-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('mobile-ai-web-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('ai-chat-time-block-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('omni-ai-time-block-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('mobile-ai-time-block-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('ai-chat-script-workflow-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('omni-ai-script-workflow-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.getElementById('mobile-ai-script-workflow-back-btn')?.addEventListener('click', () => {
          setAIChatUtilityMenuSection('root');
      });
      document.querySelectorAll('.ai-chat-upload-mode-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
              activateAIInlineUploadIntent({ mode: btn.getAttribute('data-upload-mode') || 'learn', openPicker: true });
          });
      });
      document.querySelectorAll('.omni-ai-upload-mode-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
              activateAIInlineUploadIntent({ mode: btn.getAttribute('data-upload-mode') || 'learn', openPicker: true });
          });
      });
      document.querySelectorAll('.mobile-ai-upload-mode-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
              activateAIInlineUploadIntent({ mode: btn.getAttribute('data-upload-mode') || 'learn', openPicker: true });
          });
      });
      document.querySelectorAll('.ai-chat-time-block-option-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
              activateAIPendingTimeBlockIntent(btn.getAttribute('data-time-block-range') || 'today');
          });
      });
      document.querySelectorAll('.omni-ai-time-block-option-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
              activateAIPendingTimeBlockIntent(btn.getAttribute('data-time-block-range') || 'today');
          });
      });
      document.querySelectorAll('.mobile-ai-time-block-option-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
              activateAIPendingTimeBlockIntent(btn.getAttribute('data-time-block-range') || 'today');
          });
      });
      document.querySelectorAll('.ai-chat-script-workflow-option-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
              activateAIPendingScriptWorkflowIntent(btn.getAttribute('data-script-workflow-step') || 'topic_title');
          });
      });
      document.querySelectorAll('.omni-ai-script-workflow-option-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
              activateAIPendingScriptWorkflowIntent(btn.getAttribute('data-script-workflow-step') || 'topic_title');
          });
      });
      document.querySelectorAll('.mobile-ai-script-workflow-option-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
              activateAIPendingScriptWorkflowIntent(btn.getAttribute('data-script-workflow-step') || 'topic_title');
          });
      });
      document.getElementById('ai-chat-web-search-option')?.addEventListener('click', () => {
          activateAIPendingWebSearchIntent();
      });
      document.getElementById('omni-ai-web-search-option')?.addEventListener('click', () => {
          activateAIPendingWebSearchIntent();
      });
      document.getElementById('mobile-ai-web-search-option')?.addEventListener('click', () => {
          activateAIPendingWebSearchIntent();
      });
      document.getElementById('ai-chat-file-input')?.addEventListener('change', handleAIChatAttachmentUpload);
      document.getElementById('omni-ai-file-input')?.addEventListener('change', handleAIChatAttachmentUpload);
      document.getElementById('mobile-ai-file-input')?.addEventListener('change', handleAIChatAttachmentUpload);
      document.getElementById('ai-chat-upload-intent-remove')?.addEventListener('click', () => {
          clearAIInlineUploadIntent();
      });
      document.getElementById('omni-ai-upload-intent-remove')?.addEventListener('click', () => {
          clearAIInlineUploadIntent();
      });
      document.getElementById('mobile-ai-upload-intent-remove')?.addEventListener('click', () => {
          clearAIInlineUploadIntent();
      });
      document.getElementById('mobile-ai-web-entry')?.addEventListener('click', () => {
          activateAIPendingWebSearchIntent();
      });
      document.getElementById('omni-ai-time-block-intent-remove')?.addEventListener('click', () => {
          clearAIPendingTimeBlockIntent();
      });
      document.getElementById('ai-chat-time-block-intent-remove')?.addEventListener('click', () => {
          clearAIPendingTimeBlockIntent();
      });
      document.getElementById('mobile-ai-time-block-intent-remove')?.addEventListener('click', () => {
          clearAIPendingTimeBlockIntent();
      });
      document.getElementById('omni-ai-web-search-intent-remove')?.addEventListener('click', () => {
          clearAIPendingWebSearchIntent();
      });
      document.getElementById('ai-chat-web-search-intent-remove')?.addEventListener('click', () => {
          clearAIPendingWebSearchIntent();
      });
      document.getElementById('mobile-ai-web-search-intent-remove')?.addEventListener('click', () => {
          clearAIPendingWebSearchIntent();
      });
      document.getElementById('omni-ai-time-block-trigger-chip')?.addEventListener('click', () => {
          setAIChatUtilityMenuOpen(true);
          setAIChatUtilityMenuSection('timeBlocks');
      });
      document.getElementById('ai-chat-time-block-trigger-chip')?.addEventListener('click', () => {
          setAIChatUtilityMenuOpen(true);
          setAIChatUtilityMenuSection('timeBlocks');
      });
      document.getElementById('mobile-ai-time-block-trigger-chip')?.addEventListener('click', () => {
          setAIChatUtilityMenuOpen(true);
          setAIChatUtilityMenuSection('timeBlocks');
      });
      document.getElementById('omni-ai-web-search-trigger-chip')?.addEventListener('click', () => {
          activateAIPendingWebSearchIntent();
      });
      document.getElementById('ai-chat-web-search-trigger-chip')?.addEventListener('click', () => {
          activateAIPendingWebSearchIntent();
      });
      document.getElementById('mobile-ai-web-search-trigger-chip')?.addEventListener('click', () => {
          activateAIPendingWebSearchIntent();
      });
      document.getElementById('ai-chat-utility-category-remove')?.addEventListener('click', () => {
          clearAIPendingUtilityCategory();
      });
      document.getElementById('omni-ai-utility-category-remove')?.addEventListener('click', () => {
          clearAIPendingUtilityCategory();
      });
      document.getElementById('mobile-ai-utility-category-remove')?.addEventListener('click', () => {
          clearAIPendingUtilityCategory();
      });
      document.getElementById('ai-chat-utility-option-trigger')?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!aiPendingUtilityCategory) return;
          setAIChatUtilityMenuOpen(true);
          setAIChatUtilityMenuSection(aiPendingUtilityCategory);
      });
      document.getElementById('omni-ai-utility-option-trigger')?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!aiPendingUtilityCategory) return;
          setAIChatUtilityMenuOpen(true);
          setAIChatUtilityMenuSection(aiPendingUtilityCategory);
      });
      document.getElementById('mobile-ai-utility-option-trigger')?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!aiPendingUtilityCategory) return;
          setAIChatUtilityMenuOpen(true);
          setAIChatUtilityMenuSection(aiPendingUtilityCategory);
      });
      document.getElementById('ai-chat-upload-trigger-chip')?.addEventListener('click', () => {
          triggerAIChatAttachmentPickerWithMode(aiChatPendingUploadMode || 'learn');
      });
      document.getElementById('omni-ai-upload-trigger-chip')?.addEventListener('click', () => {
          triggerAIChatAttachmentPickerWithMode(aiChatPendingUploadMode || 'learn');
      });
      document.getElementById('mobile-ai-upload-trigger-chip')?.addEventListener('click', () => {
          triggerAIChatAttachmentPickerWithMode(aiChatPendingUploadMode || 'learn');
      });
      document.getElementById('ai-chat-send-btn')?.addEventListener('click', sendAIChatMessage);
      document.getElementById('ai-chat-drawer-send-btn')?.addEventListener('click', sendAIChatMessage);
      document.getElementById('mobile-detail-send-btn')?.addEventListener('click', () => {
          submitMobileContextDetailInput();
      });
      document.getElementById('ai-chat-stop-btn')?.addEventListener('click', stopAIChatGeneration);
      document.getElementById('ai-chat-drawer-stop-btn')?.addEventListener('click', stopAIChatGeneration);
      document.getElementById('ai-chat-input')?.addEventListener('keydown', (e) => {
          if (e.key === 'Tab' && typeof isThoughtGraphInteractive === 'function' && isThoughtGraphInteractive()) {
              e.preventDefault();
              e.stopPropagation();
              if (typeof preventThoughtGraphFocusScrollDrift === 'function') preventThoughtGraphFocusScrollDrift();
              return;
          }
          if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey) && !shouldTreatEnterAsCompositionConfirm(e)) {
              e.preventDefault();
              requestAnimationFrame(() => sendAIChatMessage());
          }
      });
      document.getElementById('ai-chat-drawer-input')?.addEventListener('keydown', (e) => {
          if (e.key === 'Tab' && typeof isThoughtGraphInteractive === 'function' && isThoughtGraphInteractive()) {
              e.preventDefault();
              e.stopPropagation();
              if (typeof preventThoughtGraphFocusScrollDrift === 'function') preventThoughtGraphFocusScrollDrift();
              return;
          }
          if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey) && !shouldTreatEnterAsCompositionConfirm(e)) {
              e.preventDefault();
              requestAnimationFrame(() => sendAIChatMessage());
          }
      });
      document.getElementById('ai-chat-input')?.addEventListener('input', (e) => {
          handleComposerTextareaInput('ai-chat-input', e, 120, {
              syncShellLayout: false,
          });
      });
      document.getElementById('ai-chat-drawer-input')?.addEventListener('input', (e) => {
          handleComposerTextareaInput('ai-chat-drawer-input', e, 120, {
              syncShellLayout: false,
          });
      });
      document.getElementById('ai-chat-input')?.addEventListener('focus', () => {
          if (aiChatUtilityMenuOpen) setAIChatUtilityMenuOpen(false);
          if (typeof setThoughtGraphShortcutActive === 'function') setThoughtGraphShortcutActive(false, { silent: true });
      });
      document.getElementById('ai-chat-drawer-input')?.addEventListener('focus', () => {
          if (aiChatUtilityMenuOpen) setAIChatUtilityMenuOpen(false);
          if (typeof setThoughtGraphShortcutActive === 'function') setThoughtGraphShortcutActive(false, { silent: true });
      });
      ['omni-input', 'mobile-detail-input', 'ai-chat-input', 'ai-chat-drawer-input'].forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.addEventListener('focus', () => {
              if (typeof setThoughtGraphShortcutActive === 'function') setThoughtGraphShortcutActive(false, { silent: true });
              if (id === 'omni-input' && typeof clearThoughtGraphKeyboardNavigation === 'function') clearThoughtGraphKeyboardNavigation({ closeDetail: false });
              else if (id === 'omni-input' && typeof syncThoughtGraphStatusBar === 'function') syncThoughtGraphStatusBar();
          });
          el.addEventListener('compositionstart', () => {
              el.dataset.imeComposing = '1';
          });
          el.addEventListener('compositionend', (e) => {
              delete el.dataset.imeComposing;
              scheduleComposerInputPostProcess(id, el, id === 'omni-input' ? 132 : 120, {
                  force: true,
                  event: e,
                  delayMs: 0,
                  syncMobileQuickComposeButton: id === 'mobile-detail-input',
                  skipMobileIconRefresh: id === 'mobile-detail-input',
              });
          });
          el.addEventListener('blur', () => {
              persistComposerDraftValue(id, el.value || '');
              requestComposerTextareaResize(el, id === 'omni-input' ? 132 : 120, {
                  force: true,
                  syncMobileQuickComposeButton: id === 'mobile-detail-input',
                  skipMobileIconRefresh: id === 'mobile-detail-input',
              });
              if (id === 'omni-input' && typeof syncThoughtGraphStatusBar === 'function') syncThoughtGraphStatusBar();
          });
      });
      document.addEventListener('pointerdown', (e) => {
          const target = e.target;
          if (!target?.closest) return;
          const inComposerShell = !!(
              target.closest('#mobile-bottom-nav-input-shell') ||
              target.closest('#ai-chat-drawer-composer-shell') ||
              target.closest('#omni-composer-shell') ||
              target.closest('#ai-chat-composer-shell')
          );
          if (inComposerShell || isPrimaryComposerInputTarget(target)) {
              if (typeof setThoughtGraphShortcutActive === 'function') setThoughtGraphShortcutActive(false);
              if (target.closest?.('#omni-composer-shell') && typeof clearThoughtGraphKeyboardNavigation === 'function') {
                  clearThoughtGraphKeyboardNavigation({ closeDetail: false });
              }
              return;
          }
          if (typeof isThoughtGraphShortcutActivatorTarget === 'function' && isThoughtGraphShortcutActivatorTarget(target)) {
              const graphHost = target.closest?.('#main-flash-thoughts-list');
              const previewAlreadyActive = typeof isThoughtGraphKeyboardPreviewActive === 'function'
                  ? isThoughtGraphKeyboardPreviewActive()
                  : false;
              const shortcutAlreadyActive = String(graphHost?.dataset?.shortcutActive || '').trim() === '1';
              if (shortcutAlreadyActive && previewAlreadyActive) {
                  if (typeof setThoughtGraphShortcutActive === 'function') setThoughtGraphShortcutActive(true, { silent: true });
                  return;
              }
              if (isPrimaryComposerInputTarget(document.activeElement) && typeof blurEscapeTarget === 'function') {
                  blurEscapeTarget(document.activeElement);
              }
              if (typeof setThoughtGraphShortcutActive === 'function') setThoughtGraphShortcutActive(true);
              if (typeof activateThoughtGraphPreviewFromPointer === 'function') activateThoughtGraphPreviewFromPointer();
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation?.();
              return;
          }
          if (typeof setThoughtGraphShortcutActive === 'function') setThoughtGraphShortcutActive(false, { silent: true });
      }, true);
      requestAnimationFrame(restoreComposerDraftsFromCache);
      document.getElementById('ai-chat-messages')?.addEventListener('scroll', (e) => {
          const el = e.currentTarget;
          if (!el) return;
          const sessionId = String(aiChatState.sessionId || '');
          if (!sessionId) return;
          aiChatState.scrollTopBySession[sessionId] = el.scrollTop;
      });
      document.getElementById('ai-chat-drawer-messages')?.addEventListener('scroll', (e) => {
          const el = e.currentTarget;
          if (!el) return;
          const sessionId = String(aiChatState.sessionId || '');
          if (!sessionId) return;
          aiChatState.scrollTopBySession[sessionId] = el.scrollTop;
      });
      document.addEventListener('copy', (e) => {
          handleSelectedBlockBatchClipboardCopy(e, { cut: false });
      });
      document.addEventListener('click', (e) => {
          const target = e.target;
          if (!aiChatUtilityMenuOpen || !target?.closest) return;
          if (target.closest('#ai-chat-plus-menu') || target.closest('#ai-chat-plus-btn') || target.closest('#omni-ai-plus-menu') || target.closest('#omni-ai-plus-btn') || target.closest('#mobile-ai-plus-menu') || target.closest('#mobile-ai-plus-btn')) return;
          setAIChatUtilityMenuOpen(false);
      });
      document.addEventListener('click', (e) => {
          const target = e.target;
          if (!target?.closest) return;
          if (target.closest('#thought-graph-shortcut-help-btn') || target.closest('#thought-graph-shortcut-help-menu')) return;
          if (typeof setThoughtGraphShortcutHelpMenuOpen === 'function') setThoughtGraphShortcutHelpMenuOpen(false);
      });
      document.addEventListener('click', (e) => {
          const target = e.target;
          if (!aiChatDrawerOpen || !target?.closest) return;
          if (!isMobileNavMode()) return;
          if (
              target.closest('#custom-modal') ||
              target.closest('#detail-modal') ||
              target.closest('#move-to-project-modal') ||
              target.closest('.modal-content')
          ) {
              return;
          }
          if (target.closest('#ai-chat-drawer') || target.closest('#header-action-pill-global') || target.closest('#header-action-pill-menu')) return;
          setAIChatDrawerOpen(false);
      });
      document.addEventListener('click', (e) => {
          const target = e.target;
          if (!aiChatSessionDrawerOpen || !target?.closest) return;
          // Desktop keeps AI directory pinned until the user explicitly closes it.
          // We still close inline row menus when clicking away.
          if (!isMobileNavMode()) {
              if (target.closest('.ai-chat-session-row-menu')) return;
              if (target.closest('#ai-chat-session-drawer') || target.closest('#header-action-pill-global') || target.closest('#header-action-pill-menu')) {
                  if (!target.closest('.ai-chat-session-row-more') && !target.closest('.ai-chat-session-row-menu')) closeAIChatSessionInlineMenu();
                  return;
              }
              closeAIChatSessionInlineMenu();
              return;
          }
          if (
              target.closest('#custom-modal') ||
              target.closest('#detail-modal') ||
              target.closest('#move-to-project-modal') ||
              target.closest('.modal-content')
          ) {
              return;
          }
          if (target.closest('.ai-chat-session-row-menu')) return;
          if (target.closest('#ai-chat-session-drawer') || target.closest('#header-action-pill-global') || target.closest('#header-action-pill-menu')) {
              if (!target.closest('.ai-chat-session-row-more') && !target.closest('.ai-chat-session-row-menu')) closeAIChatSessionInlineMenu();
              return;
          }
          closeAIChatSessionInlineMenu();
          setAIChatSessionDrawerOpen(false);
      });
      document.addEventListener('click', (e) => {
          const target = e.target;
          const projectDirectoryCollapsed = typeof projectTreePanelCollapsed === 'boolean' ? projectTreePanelCollapsed : false;
          const projectDrawerOpen = currentTab === 'project' && !!activeContextId && !projectDirectoryCollapsed;
          if (!projectDrawerOpen || !target?.closest) return;
          // Desktop keeps project directory pinned until the user explicitly closes it.
          if (!isMobileNavMode()) return;
          if (
              target.closest('#custom-modal') ||
              target.closest('#detail-modal') ||
              target.closest('#move-to-project-modal') ||
              target.closest('.modal-content')
          ) {
              return;
          }
          if (target.closest('#project-directory-drawer') || target.closest('#header-action-pill-global') || target.closest('#header-action-pill-menu')) return;
          toggleProjectTreePanel(false);
      });
      document.addEventListener('click', (e) => {
          const target = e.target;
          const organizerDrawerOpen = currentTab === 'project' && !!activeContextId && (typeof getProjectVisualOrganizerPanelOpen === 'function' ? getProjectVisualOrganizerPanelOpen() : false);
          if (!organizerDrawerOpen || !target?.closest) return;
          if (!isMobileNavMode()) return;
          if (
              target.closest('#custom-modal') ||
              target.closest('#detail-modal') ||
              target.closest('#move-to-project-modal') ||
              target.closest('.modal-content')
          ) {
              return;
          }
          if (target.closest('#project-visual-organizer-drawer') || target.closest('#header-action-pill-global') || target.closest('#header-action-pill-menu')) return;
          setProjectVisualOrganizerPanelOpen(false);
      });
      document.addEventListener('cut', (e) => {
          handleSelectedBlockBatchClipboardCopy(e, { cut: true });
      });
    }

    function bindEditorInteractionEvents() {
      if (didBindEditorInteractionEvents) return;
      didBindEditorInteractionEvents = true;

      document.addEventListener('keydown', (e) => {
          const key = (e.key || '').toLowerCase(), target = e.target, versionedEditorMeta = getVersionedEditorMetaFromTarget(target), pasteTarget = resolvePlainTextPasteTarget(target), inEditable = !!(target && target.closest && target.closest('[contenteditable="true"]'));
          const inManagedBlockEditor = isManagedBlockEditorTarget(target), inDetailEditor = isManagedDetailEditorTarget(target), inTitleEditor = isManagedTitleEditorTarget(target), inPlainInput = !!(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !target.closest('#detail-modal'));
          const activeComposerShortcutLock = isPrimaryComposerInputTarget(target) || isPrimaryComposerInputTarget(document.activeElement);
          if (handleEditorSaveShortcut(e)) return;
          if (!activeComposerShortcutLock && typeof handleThoughtGraphKeyboardShortcut === 'function' && handleThoughtGraphKeyboardShortcut(e)) return;
          if ((e.metaKey || e.ctrlKey) && !e.altKey && key === 'a' && inPlainInput) return;
          if (handleGlobalEscapeKey(e)) {
              e.preventDefault();
              e.stopPropagation();
              return;
          }
          if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && isRunningInNativeDesktopShell()) {
              e.preventDefault();
              e.stopPropagation();
              return;
          }
          if (isPrimaryComposerInputTarget(target)) return;
          if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'v' && (inEditable || inPlainInput || !!pasteTarget)) {
              if (storage?.hasNativeControlBridge && storage.hasNativeControlBridge() && typeof storage?.callNativeDesktopControl === 'function') {
                  e.preventDefault();
                  e.stopPropagation();
                  void insertPlainTextViaNativeClipboard(pasteTarget);
                  return;
              }
              queuePlainTextPasteShortcut(pasteTarget);
          }
          if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && selectedBlockBatch?.ids?.length && !inPlainInput && !inDetailEditor && !inTitleEditor) {
              if (key === 'c') {
                  e.preventDefault();
                  void writeSelectedBlockBatchToClipboard({ cut: false });
                  return;
              }
              if (key === 'x') {
                  e.preventDefault();
                  void cutSelectedBlockBatchWithFallback();
                  return;
              }
          }
          if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && ['b', 'i', 'u'].includes(key)) {
              if (inManagedBlockEditor || inDetailEditor) {
                  e.preventDefault();
                  const command = key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline';
                  applyManagedInlineFormat(command, target);
                  return;
              }
          }
          if ((e.key === 'Backspace' || e.key === 'Delete') && selectedBlockBatch?.ids?.length) {
              e.preventDefault();
              deleteSelectedBlockBatch();
              return;
          }
          if ((key === 'backspace' || key === 'delete') && !inEditable && !inPlainInput) {
              e.preventDefault();
              return;
          }
          if ((((e.metaKey || e.ctrlKey) && !e.altKey && key === 'z')
              || (e.ctrlKey && !e.metaKey && !e.altKey && key === 'y'))
              && !inPlainInput
              && !inDetailEditor
              && versionedEditorMeta) {
              e.preventDefault();
              if (key === 'y' || e.shiftKey) redoEditorAwareChange(target);
              else undoEditorAwareChange(target);
              rememberManagedEditorShortcutBridge(key === 'y' || e.shiftKey ? 'redo' : 'undo', target);
              return;
          }
          if (((e.metaKey || e.ctrlKey) && !e.altKey && key === 'z' && !inPlainInput && !inDetailEditor && !inTitleEditor)
              || (e.ctrlKey && !e.metaKey && !e.altKey && key === 'y' && !inPlainInput && !inDetailEditor && !inTitleEditor)) {
              e.preventDefault();
              if (key === 'y' || e.shiftKey) redoEditorAwareChange(target);
              else undoEditorAwareChange(target);
              rememberManagedEditorShortcutBridge(key === 'y' || e.shiftKey ? 'redo' : 'undo', target);
              return;
          }
          const meta = getFocusedBlockEditorMeta();
          if (!meta) return;

          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
              if (inDetailEditor || inTitleEditor) return;
              if (!inManagedBlockEditor) return;
              e.preventDefault();
              selectAllBlocksInEditor(meta.context, meta.contextId);
              return;
          }

          if ((e.key === 'Backspace' || e.key === 'Delete') && selectedBlockBatch && selectedBlockBatch.context === meta.context && selectedBlockBatch.contextId === meta.contextId) {
              e.preventDefault();
              deleteSelectedBlockBatch();
          }
      }, true);

      document.addEventListener('mousedown', (e) => {
          if (e.target.closest?.('#block-batch-menu, #link-context-menu, #context-card-menu')) return;
          if (typeof e.button === 'number' && e.button !== 0) return;
          const row = e.target.closest ? e.target.closest('.block-row') : null;
          if (!row) {
              if (selectedBlockBatch) clearBlockBatchSelection();
              stopBlockSweepSelection();
              return;
          }

          const inEditable = !!(e.target.closest && e.target.closest('[contenteditable="true"]'));
          const clickedDragHandle = !!(e.target.closest && e.target.closest('.drag-handle'));
          const allowSweep = e.shiftKey;

          if (allowSweep) {
              e.preventDefault();
              if (!selectBlockRangeFromCurrentSelection(row)) startBlockSweepSelection(row);
              return;
          }

          if (clickedDragHandle) {
              if (!isRowInsideSelectedBlockBatch(row)) selectSingleBlockRow(row);
              return;
          }

          const clickedSelectedRow = row.classList.contains('block-selected');
          if (!inEditable && selectedBlockBatch && !(clickedSelectedRow || clickedDragHandle)) clearBlockBatchSelection();
      });

      document.addEventListener('mouseover', (e) => {
          if (!blockSweepSelection) return;
          const row = e.target.closest ? e.target.closest('.block-row') : null;
          if (!row) return;
          extendBlockSweepSelection(row);
      });

      document.addEventListener('pointerup', (e) => {
          if (blockSweepSelection) stopBlockSweepSelection();
          if (!e.defaultPrevented && e.button === 0 && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) handleManagedBlockPointerCompletion(e.target, e.clientX, e.clientY);
          if (projectVisualOrganizerResizeState) {
              projectVisualOrganizerResizeState = null;
              if (!sidebarResizeState) document.body.classList.remove('sidebar-resizing');
          }
          if (sidebarResizeState) {
              sidebarResizeState = null;
              document.body.classList.remove('sidebar-resizing');
          }
      });

      document.addEventListener('pointercancel', () => {
          if (blockSweepSelection) stopBlockSweepSelection();
          if (projectVisualOrganizerResizeState) {
              projectVisualOrganizerResizeState = null;
              if (!sidebarResizeState) document.body.classList.remove('sidebar-resizing');
          }
          if (sidebarResizeState) {
              sidebarResizeState = null;
              document.body.classList.remove('sidebar-resizing');
          }
      });

      document.addEventListener('pointermove', (e) => {
          if (projectVisualOrganizerResizeState) {
              const next = projectVisualOrganizerResizeState.startWidth + (e.clientX - projectVisualOrganizerResizeState.startX);
              setProjectVisualOrganizerPanelWidth(next);
              return;
          }
          if (!sidebarResizeState) return;
          const next = sidebarResizeState.startWidth + (e.clientX - sidebarResizeState.startX);
          setSidebarWidth(next);
      });

      document.addEventListener('mouseup', () => {
          stopBlockSweepSelection();
          if (editorImageResizeState) {
              const editor = editorImageResizeState.editor;
              const wrapper = editorImageResizeState.wrapper;
              editorImageResizeState = null;
              document.body.style.cursor = '';
              document.body.style.userSelect = '';
              if (editor && wrapper) persistRichEditorForNode(editor);
          }
          if (projectVisualOrganizerResizeState) {
              projectVisualOrganizerResizeState = null;
              if (!sidebarResizeState) document.body.classList.remove('sidebar-resizing');
          }
          if (sidebarResizeState) {
              sidebarResizeState = null;
              document.body.classList.remove('sidebar-resizing');
          }
      });

      document.addEventListener('mousemove', (e) => {
          if (editorImageResizeState) {
              const { wrapper, editor, startX, startY, startWidth, direction, aspectRatio } = editorImageResizeState;
              if (wrapper && editor) {
                  const dx = e.clientX - startX;
                  const dy = e.clientY - startY;
                  let nextWidth = startWidth;
                  if (direction.includes('e')) nextWidth += dx;
                  if (direction.includes('w')) nextWidth -= dx;
                  if (direction === 'n') nextWidth -= dy * aspectRatio;
                  if (direction === 's') nextWidth += dy * aspectRatio;
                  if (direction.includes('n') && direction.length === 2) nextWidth -= dy * aspectRatio * 0.5;
                  if (direction.includes('s') && direction.length === 2) nextWidth += dy * aspectRatio * 0.5;
                  applyEditorImageWidth(wrapper, nextWidth, { persist: true });
              }
              return;
          }
          if (projectVisualOrganizerResizeState) {
              const next = projectVisualOrganizerResizeState.startWidth + (e.clientX - projectVisualOrganizerResizeState.startX);
              setProjectVisualOrganizerPanelWidth(next);
              return;
          }
          if (!sidebarResizeState) return;
          const next = sidebarResizeState.startWidth + (e.clientX - sidebarResizeState.startX);
          setSidebarWidth(next);
      });
      document.addEventListener('compositionstart', () => {
          userEditComposeActive = true;
          if (!isPrimaryComposerInputTarget(document.activeElement)) markUserEditingActivity();
      }, true);
      document.addEventListener('compositionend', () => {
          userEditComposeActive = false;
          if (!isPrimaryComposerInputTarget(document.activeElement)) markUserEditingActivity();
          if (typeof window.__MorphFlushDeferredBlockRerender === 'function') {
              try { window.__MorphFlushDeferredBlockRerender(); } catch (_) {}
          }
      }, true);
    }

    function bindAppInputLifecycleEvents() {
      if (didBindAppInputLifecycleEvents) return;
      didBindAppInputLifecycleEvents = true;

      document.getElementById('omni-input')?.addEventListener('keydown', (e) => {
          if (e.key === 'Tab' && typeof isThoughtGraphInteractive === 'function' && isThoughtGraphInteractive()) {
              e.preventDefault();
              e.stopPropagation();
              if (typeof preventThoughtGraphFocusScrollDrift === 'function') preventThoughtGraphFocusScrollDrift();
              return;
          }
          if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !shouldTreatEnterAsCompositionConfirm(e)) {
              e.preventDefault();
              requestAnimationFrame(() => submitOmniInput());
          }
      });
      document.getElementById('omni-input')?.addEventListener('input', (e) => {
          handleComposerTextareaInput('omni-input', e, 132, {
              syncShellLayout: false,
          });
      });
      document.getElementById('mobile-detail-input')?.addEventListener('keydown', (e) => {
          if (e.key === 'Tab' && typeof isThoughtGraphInteractive === 'function' && isThoughtGraphInteractive()) {
              e.preventDefault();
              e.stopPropagation();
              if (typeof preventThoughtGraphFocusScrollDrift === 'function') preventThoughtGraphFocusScrollDrift();
              return;
          }
          if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !shouldTreatEnterAsCompositionConfirm(e)) {
              e.preventDefault();
              requestAnimationFrame(() => submitMobileContextDetailInput());
          }
      });
      document.getElementById('mobile-detail-input')?.addEventListener('input', (e) => {
          handleComposerTextareaInput('mobile-detail-input', e, 120, {
              syncShellLayout: false,
          });
      });
      document.getElementById('mobile-detail-input')?.addEventListener('focus', () => {
          syncMobileKeyboardFollowPosition();
          setTimeout(syncMobileKeyboardFollowPosition, 80);
          setTimeout(syncMobileKeyboardFollowPosition, 220);
      });
      document.getElementById('mobile-detail-input')?.addEventListener('blur', () => {
          mobileBottomNavGestureLock = false;
          setTimeout(syncMobileKeyboardFollowPosition, 80);
      });
      document.getElementById('home-quick-input')?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !shouldTreatEnterAsCompositionConfirm(e)) {
              e.preventDefault();
              submitHomeQuickInput();
          }
      });
      document.getElementById('home-quick-input')?.addEventListener('input', markUserEditingActivity);
      document.getElementById('home-quick-submit-btn')?.addEventListener('click', () => {
          submitHomeQuickInput();
      });
      document.getElementById('home-voice-toggle-btn')?.addEventListener('click', () => {
          toggleHomeVoiceInput();
      });
      document.addEventListener('input', (e) => {
          const t = e.target;
          if (!t) return;
          if (isComposerIMEActive(t, e)) return;
          if (t.id === 'omni-input' || t.id === 'mobile-detail-input' || t.id === 'ai-chat-input') return;
          if (t.isContentEditable || t.closest?.('[contenteditable="true"]') || ['INPUT', 'TEXTAREA'].includes(t.tagName)) markUserEditingActivity();
      }, true);
      document.addEventListener('focusin', (e) => {
          const t = e.target;
          if (t?.id === 'mobile-detail-input' || t?.closest?.('#mobile-bottom-nav-input-shell')) {
              syncMobileKeyboardFollowPosition();
              setTimeout(syncMobileKeyboardFollowPosition, 80);
          }
          if (!t || !t.closest) return;
          const editor = t.closest('#daily-block-editor .block-content');
          if (!editor?.dataset?.id) return;
          dailyVoiceState.targetBlockId = editor.dataset.id;
          if (!dailyVoiceState.running) return;
          try { t.blur?.(); } catch (_) {}
      }, true);
      document.addEventListener('focusin', (e) => {
          rememberManagedBlockSelection(e.target);
      }, true);
      document.addEventListener('focusin', (e) => {
          if (!shouldUseDailyShadowSuggestion()) {
              clearDailyShadowSuggestion({ preserveSuspend: true });
              return;
          }
          const editor = e.target?.closest?.('#daily-block-editor .block-content');
          if (!editor || currentTab !== 'daily') {
              clearDailyShadowSuggestion({ preserveSuspend: true });
              return;
          }
          const row = editor.closest('.block-row'), monthKey = String(row?.dataset?.contextId || '').trim(), blockId = String(row?.dataset?.blockId || '').trim();
          if (!monthKey || !blockId) return;
          scheduleDailyShadowSuggestion(monthKey, blockId, extractDailyShadowEditorText(editor));
      }, true);
      document.addEventListener('selectionchange', () => {
          if (isPrimaryComposerInputTarget(document.activeElement)) return;
          if (!isMobileNavMode() || currentTab !== 'daily' || dailyVoiceState.running) return;
          const sel = window.getSelection();
          if (!sel || !sel.rangeCount) return;
          const range = sel.getRangeAt(0), node = range.startContainer;
          const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement, editor = el?.closest?.('#daily-block-editor .block-content');
          if (!editor) return;
          dailyVoiceState.anchorRange = range.cloneRange();
          if (editor.dataset?.id) dailyVoiceState.targetBlockId = editor.dataset.id;
      });
      document.addEventListener('selectionchange', () => {
          if (isPrimaryComposerInputTarget(document.activeElement)) return;
          const sel = window.getSelection(); if (!sel || !sel.rangeCount) return;
          const range = sel.getRangeAt(0), node = range.startContainer, el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
          rememberManagedBlockSelection(el, range);
      });
      document.addEventListener('selectionchange', () => {
          if (isPrimaryComposerInputTarget(document.activeElement)) return;
          if (!shouldUseDailyShadowSuggestion()) {
              clearDailyShadowSuggestion({ preserveSuspend: true });
              return;
          }
          if (currentTab !== 'daily') {
              clearDailyShadowSuggestion({ preserveSuspend: true });
              return;
          }
          const selection = window.getSelection();
          if (!selection || !selection.rangeCount) {
              clearDailyShadowSuggestion({ preserveSuspend: true });
              return;
          }
          const range = selection.getRangeAt(0), el = range.startContainer?.nodeType === Node.ELEMENT_NODE
              ? range.startContainer
              : range.startContainer?.parentElement, editor = el?.closest?.('#daily-block-editor .block-content');
          if (!editor) {
              clearDailyShadowSuggestion({ preserveSuspend: true });
              return;
          }
          const row = editor.closest('.block-row'), monthKey = String(row?.dataset?.contextId || '').trim(), blockId = String(row?.dataset?.blockId || '').trim();
          if (!monthKey || !blockId || !selection.isCollapsed || !isDailyShadowCaretAtEnd(editor)) {
              clearDailyShadowSuggestion({ preserveSuspend: true });
              return;
          }
          scheduleDailyShadowSuggestion(monthKey, blockId, extractDailyShadowEditorText(editor));
      });
      document.addEventListener('focusout', (e) => {
          const t = e.target;
          if (t?.id !== 'mobile-detail-input' && !t?.closest?.('#mobile-bottom-nav-input-shell')) return;
          setTimeout(syncMobileKeyboardFollowPosition, 60);
          setTimeout(syncMobileKeyboardFollowPosition, 180);
      }, true);
      document.addEventListener('focusout', (e) => {
          if (!shouldUseDailyShadowSuggestion()) {
              clearDailyShadowSuggestion({ preserveSuspend: true });
              return;
          }
          if (!e.target?.closest?.('#daily-block-editor .block-content')) return;
          setTimeout(() => {
              const activeEditor = document.activeElement?.closest?.('#daily-block-editor .block-content');
              if (!activeEditor) clearDailyShadowSuggestion({ preserveSuspend: true });
          }, 0);
      }, true);
      document.addEventListener('focusin', (e) => {
          const nextKey = getManagedEditorFocusKey(e.target);
          if (!nextKey) return;
          if (lastManagedEditorFocusKey && lastManagedEditorFocusKey !== nextKey) flushTypingUndoSnapshot();
          lastManagedEditorFocusKey = nextKey;
      }, true);
      document.addEventListener('touchstart', (e) => {
          if (!dailyVoiceState.running) return;
          const editor = e.target?.closest?.('#daily-block-editor .block-content');
          if (!editor) return;
          e.preventDefault();
          if (editor.dataset?.id) dailyVoiceState.targetBlockId = editor.dataset.id;
      }, { capture: true, passive: false });
      document.addEventListener('touchstart', (e) => {
          if (!e.touches || e.touches.length !== 1) return;
          const touch = e.touches[0];
          const target = e.target;

          touchLongPressHandled = false;
          touchLongPressStart = { x: touch.clientX, y: touch.clientY };

          const resolved = detectTouchLongPressMenuMeta(target);
          if (!resolved) {
              clearTouchLongPressState();
              return;
          }
          touchLongPressTarget = resolved.target;
          touchLongPressMeta = resolved.meta;

          clearTimeout(touchLongPressTimer);
          touchLongPressTimer = setTimeout(() => {
              if (!touchLongPressMeta || !touchLongPressStart) return;
              touchLongPressHandled = true;
              if (touchLongPressMeta.type === 'link') {
                  activeLinkNode = touchLongPressTarget;
                  hideContextCardMenu();
                  ctxMenu.style.left = `${touchLongPressStart.x}px`;
                  ctxMenu.style.top = `${touchLongPressStart.y}px`;
                  showLinkContextMenu();
                  const mode = activeLinkNode?.dataset?.mode || 'preview';
                  document.getElementById('menu-toggle-link').style.display = mode === 'preview' ? 'flex' : 'none';
                  document.getElementById('menu-toggle-preview').style.display = mode === 'link' ? 'flex' : 'none';
              } else if (touchLongPressMeta.type === 'context-card') {
                  showContextCardMenuAt(touchLongPressMeta.contextType, touchLongPressMeta.id, touchLongPressStart.x, touchLongPressStart.y);
              } else if (touchLongPressMeta.type === 'ai-chat-message') {
                  showAIChatMessageMenuAt(touchLongPressMeta.messageId, touchLongPressStart.x, touchLongPressStart.y);
              } else if (touchLongPressMeta.type === 'project-lane') {
                  showContextCardMenuAt('projectQueueLane', touchLongPressMeta.laneId, touchLongPressStart.x, touchLongPressStart.y, { kind: 'project-lane' });
              } else if (touchLongPressMeta.type === 'orbit-fragment') {
                  showOrbitFragmentMenuAt(touchLongPressMeta.itemId, touchLongPressMeta.parentId, touchLongPressMeta.contextType, touchLongPressStart.x, touchLongPressStart.y);
              }
          }, 450);
      }, { passive: true });
      document.addEventListener('touchmove', (e) => {
          if (mobileBottomNavGestureLock) {
              e.preventDefault();
              return;
          }
          if (!touchLongPressStart || !e.touches || e.touches.length !== 1) return;
          const touch = e.touches[0], dx = touch.clientX - touchLongPressStart.x, dy = touch.clientY - touchLongPressStart.y;
          if ((dx * dx + dy * dy) > (10 * 10)) clearTouchLongPressState();
      }, { passive: false });
      document.addEventListener('touchstart', (e) => {
          if (!document.documentElement.classList.contains('ios-native-app')) {
              mobileBottomNavGestureLock = false;
              return;
          }
          const target = e.target;
          if (!isMobileBottomGestureProtectedTarget(target)) {
              mobileBottomNavGestureLock = false;
              return;
          }
          mobileBottomNavGestureLock = shouldTrackMobileKeyboard();
      }, { passive: true, capture: true });
      document.addEventListener('touchmove', (e) => {
          if (!mobileBottomNavGestureLock) return;
          const target = e.target;
          if (!isMobileBottomGestureProtectedTarget(target)) return;
          e.preventDefault();
      }, { passive: false, capture: true });
      document.addEventListener('touchend', () => {
          clearTimeout(touchLongPressTimer);
          touchLongPressTimer = null;
          mobileBottomNavGestureLock = false;
      });
      document.addEventListener('touchcancel', () => {
          mobileBottomNavGestureLock = false;
      }, true);
      document.addEventListener('click', (e) => {
          if (touchLongPressHandled) {
              e.preventDefault();
              e.stopPropagation();
              touchLongPressHandled = false;
              clearTouchLongPressState();
          }
      }, true);
      document.addEventListener('keydown', (event) => {
          if (!isThoughtGraphInteractive()) return;
          const target = event.target;
          if (target?.closest?.('input, textarea, [contenteditable="true"]')) return;
          const runtime = getThoughtGraphRuntime();
          if (!(event.metaKey || event.ctrlKey)) return;
          if (event.key === '+' || event.key === '=' ) {
              event.preventDefault();
              if (runtime?.isActive()) {
                  runtime.setScale((runtime.getScale?.() || 1) + 0.12);
                  return;
              }
              adjustThoughtGraphScale(thoughtGraphScale + 0.12);
              return;
          }
          if (event.key === '-' || event.key === '_') {
              event.preventDefault();
              if (runtime?.isActive()) {
                  runtime.setScale((runtime.getScale?.() || 1) - 0.12);
                  return;
              }
              adjustThoughtGraphScale(thoughtGraphScale - 0.12);
              return;
          }
          if (event.key === '0') {
              event.preventDefault();
              resetThoughtGraphViewport();
          }
      });
      document.addEventListener('pointermove', handleThoughtGraphPointerMove);
      document.addEventListener('pointerup', handleThoughtGraphPointerUp);
      document.addEventListener('pointercancel', handleThoughtGraphPointerUp);
      document.addEventListener('touchstart', handleThoughtGraphTouchStart, { passive: false });
      document.addEventListener('touchmove', handleThoughtGraphTouchMove, { passive: false });
      document.addEventListener('touchend', clearThoughtGraphTouchState, { passive: true });
      document.addEventListener('touchcancel', clearThoughtGraphTouchState, { passive: true });
    }

    function bindModalActionEvents() {
      if (didBindModalActionEvents) return;
      didBindModalActionEvents = true;

      document.getElementById('modal-action-btn')?.addEventListener('click', () => {
          const inputEl = document.getElementById('modal-input'), optionListEl = document.getElementById('modal-option-list');
          const value = optionListEl && !optionListEl.classList.contains('hidden') ? modalSelectedValue : inputEl.value;
          if (modalCallback) modalCallback(value);
          closeCustomModal();
      });
      document.getElementById('modal-input')?.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') document.getElementById('modal-action-btn')?.click();
      });

      const moveToProjectConfirmEl = document.getElementById('move-to-project-confirm'), moveToProjectCancelEl = document.getElementById('move-to-project-cancel');
      if (moveToProjectConfirmEl) {
          moveToProjectConfirmEl.addEventListener('click', () => {
              const selected = document.querySelector('#move-to-project-list .move-to-project-item.selected');
              const value = String(selected?.dataset?.value || moveToProjectState.selectedValue || '').trim();
              if (moveToProjectCallback && value) {
                  moveToProjectCallback({
                      value,
                      query: normalizeMoveToProjectQuery(moveToProjectState.query),
                  });
              }
              closeMoveToProjectModal();
          });
      }
      if (moveToProjectCancelEl) moveToProjectCancelEl.addEventListener('click', closeMoveToProjectModal);
    }

    function bindSidebarResizeEvents(resizer = null, sidebar = null, tryBeginFromPointerEvent = null) {
      if (!resizer || !sidebar || typeof tryBeginFromPointerEvent !== 'function') return;
      resizer.style.touchAction = 'none';
      resizer.addEventListener('pointerdown', (e) => { tryBeginFromPointerEvent(e, false); });
      resizer.addEventListener('mousedown', (e) => { tryBeginFromPointerEvent(e, false); });
      // Make desktop resizing resilient in WebView: dragging from sidebar right edge also works.
      sidebar.addEventListener('pointerdown', (e) => { if (!e || e.target?.closest?.('#sidebar-resizer')) return; tryBeginFromPointerEvent(e, true); });
    }

    function bindDetailEditorSurfaceEvents() {
      if (didBindDetailEditorSurfaceEvents) return;
      didBindDetailEditorSurfaceEvents = true;

      const detailEditor = document.getElementById('detail-editor-rich');
      detailEditor?.addEventListener('compositionstart', () => {
          detailEditor.dataset.imeComposing = '1';
          rememberDetailEditorSelection();
      });
      detailEditor?.addEventListener('compositionend', () => {
          delete detailEditor.dataset.imeComposing;
          queueMicrotask(() => {
              rememberDetailEditorSelection();
              saveDetailState({ commit: false });
          });
      });
      document.getElementById('detail-close-btn')?.addEventListener('pointerdown', () => {
          if (typeof primeDetailEditorCloseBoundary === 'function') primeDetailEditorCloseBoundary(detailEditor || document.getElementById('detail-editor-rich'));
      });
      document.getElementById('detail-close-btn')?.addEventListener('mousedown', () => {
          if (typeof primeDetailEditorCloseBoundary === 'function') primeDetailEditorCloseBoundary(detailEditor || document.getElementById('detail-editor-rich'));
      });

      document.getElementById('detail-insert-image-btn')?.addEventListener('click', (e) => {
          // `label[for]` handles most browsers; keep JS fallback for embedded webviews.
          e.preventDefault();
          rememberDetailEditorSelection();
          if (!document.getElementById('detail-image-input')) return;
          const input = document.getElementById('detail-image-input');
          if (!input) return;
          if (typeof input.showPicker === 'function') {
              try { input.showPicker(); return; } catch (_) {}
          }
          triggerDetailImagePicker();
      });
      document.getElementById('detail-insert-image-btn')?.addEventListener('mousedown', (e) => {
          e.preventDefault();
          rememberDetailEditorSelection();
      });
      document.getElementById('detail-image-input')?.addEventListener('change', handleDetailImageFileChange);
      document.getElementById('detail-voice-toggle-btn')?.addEventListener('click', () => {
          toggleDetailComposerVoiceInput();
      });
      document.getElementById('detail-add-flash-thoughts-btn')?.addEventListener('click', () => {
          addItemFromDetailComposer();
      });
      document.addEventListener('paste', (e) => {
          if (handleForcedPlainTextPaste(e)) return;
          handleRichEditorPasteImage(e);
          if (e.defaultPrevented) return;
          handleManagedRichPaste(e);
      });
      document.addEventListener('beforeinput', (e) => {
          handleManagedEditorBeforeInput(e);
      }, true);
      document.addEventListener('dragover', handleEditorImageDragOver);
      document.addEventListener('drop', handleEditorImageDrop);
    }

    function bindThoughtHeaderMenuEvents() {
      if (didBindThoughtHeaderMenuEvents) return;
      didBindThoughtHeaderMenuEvents = true;

      document.querySelectorAll('[data-thought-view-mode-option]').forEach((btn) => {
          btn.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              const mode = String(btn.getAttribute('data-thought-view-mode-option') || '').trim();
              closeThoughtHeaderMenus();
              if (mode) handleThoughtViewModeChange(mode);
          });
      });

      document.querySelectorAll('[data-thought-archive-option]').forEach((btn) => {
          btn.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              openThoughtArchivePane(btn.getAttribute('data-thought-archive-option') || 'all');
          });
      });

      document.addEventListener('click', (event) => {
          const menu = document.getElementById('thoughts-view-mode-menu'), archiveMenu = document.getElementById('thoughts-archive-menu'), trigger = document.getElementById('thoughts-view-mode-btn'), archiveTrigger = document.getElementById('thoughts-archived-btn');
          const target = event.target, menuOpen = !!menu && !menu.classList.contains('hidden'), archiveOpen = !!archiveMenu && !archiveMenu.classList.contains('hidden');
          if (!menuOpen && !archiveOpen) return;
          if (menuOpen && (menu.contains(target) || trigger?.contains?.(target))) return;
          if (archiveOpen && (archiveMenu.contains(target) || archiveTrigger?.contains?.(target))) return;
          closeThoughtHeaderMenus();
      });
    }

    function bindShellSearchEvents() {
      if (didBindShellSearchEvents) return;
      didBindShellSearchEvents = true;

      document.getElementById('omni-submit-btn')?.addEventListener('click', function() {
          submitOmniInput();
      });
      document.getElementById('drawer-search-input')?.addEventListener('input', (e) => {
          setDrawerSearchQuery(e.target.value);
      });
      document.getElementById('drawer-search-input')?.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
              e.preventDefault();
              toggleDrawerSearch(false);
          }
      });
      document.getElementById('project-directory-search-input')?.addEventListener('input', (e) => {
          projectDirectorySearchQuery = String(e?.target?.value || '');
          renderProjectDirectoryTree();
      });
      document.getElementById('project-directory-search-input')?.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
              e.preventDefault();
              toggleProjectTreePanel(false);
          }
      });
    }

    function bindHeaderPillDismissEvents() {
      if (didBindHeaderPillDismissEvents) return;
      didBindHeaderPillDismissEvents = true;

      document.addEventListener('click', (e) => {
          if (!mobileMoreMenuOpen) return;
          const menu = document.getElementById('mobile-more-menu');
          const nav = document.getElementById('mobile-bottom-nav');
          if (menu?.contains(e.target) || nav?.contains(e.target)) return;
          hideMobileMoreMenu();
      });
      document.addEventListener('click', (e) => {
          if (!dailyMonthPillMenuOpen) return;
          const target = e.target;
          if (target?.closest?.('#header-action-pill-global') || target?.closest?.('#header-action-pill-menu')) return;
          setDailyMonthPillMenuOpen(false);
      });
      document.addEventListener('click', (e) => {
          if (!settingsThemePillMenuOpen) return;
          const target = e.target;
          if (target?.closest?.('#header-action-pill-global') || target?.closest?.('#header-action-pill-menu')) return;
          setSettingsThemePillMenuOpen(false);
      });
      document.addEventListener('click', (e) => {
          if (!projectArchivePillMenuOpen) return;
          const target = e.target;
          if (target?.closest?.('#header-action-pill-global') || target?.closest?.('#header-action-pill-menu')) return;
          setProjectArchivePillMenuOpen(false);
      });
      document.addEventListener('click', (e) => {
          if (!projectCreatePillMenuOpen) return;
          const target = e.target;
          if (target?.closest?.('#header-action-pill-global') || target?.closest?.('#header-action-pill-menu')) return;
          setProjectCreatePillMenuOpen(false);
      });
      document.addEventListener('click', (e) => {
          if (!projectSpacePillMenuOpen) return;
          const target = e.target;
          if (target?.closest?.('#header-action-pill-global') || target?.closest?.('#header-action-pill-menu')) return;
          setProjectSpacePillMenuOpen(false);
      });
      document.addEventListener('click', (e) => {
          if (!aiChatHeaderMoreMenuOpen) return;
          const target = e.target;
          if (target?.closest?.('#header-action-pill-global') || target?.closest?.('#header-action-pill-menu')) return;
          setAIChatHeaderMoreMenuOpen(false);
      });
    }

    function bindDetailLinkInteractionEvents() {
      if (didBindDetailLinkInteractionEvents) return;
      didBindDetailLinkInteractionEvents = true;

      document.getElementById('detail-editor-rich')?.addEventListener('click', (e) => {
          rememberDetailEditorSelection();
          const linkNode = e.target.closest('.rich-link-node');
          if (!linkNode) return;
          if ((linkNode.dataset.mode || 'preview') === 'link') {
              ensureInlineLinkNodeEditable(linkNode);
              return;
          }
          openExternalURL(linkNode.dataset.url);
      });
      document.addEventListener('click', (e) => {
          const linkNode = e.target.closest?.('.rich-link-node');
          if (!linkNode) return;
          if (linkNode.closest('#detail-editor-rich')) return;
          if (!linkNode.closest('.block-content, .rhythm-node-input')) return;
          if ((linkNode.dataset.mode || 'preview') === 'link') {
              ensureInlineLinkNodeEditable(linkNode);
              return;
          }
          openExternalURL(linkNode.dataset.url);
      });
      document.addEventListener('selectionchange', () => {
          const editor = document.getElementById('detail-editor-rich');
          if (!editor) return;
          const selection = window.getSelection?.();
          if (!selection?.rangeCount) return;
          const range = selection.getRangeAt(0);
          if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return;
          rememberDetailEditorSelection(range);
      });
      document.addEventListener('mousedown', (e) => {
          const linkNode = e.target.closest?.('.rich-link-node');
          if (!linkNode) return;
          if ((linkNode.dataset.mode || 'preview') !== 'link') return;
          if (!linkNode.closest('#detail-editor-rich, .block-content, .rhythm-node-input')) return;
          ensureInlineLinkNodeEditable(linkNode);
      });
    }

    function bindRichLinkLifecycleEvents() {
      if (didBindRichLinkLifecycleEvents) return;
      didBindRichLinkLifecycleEvents = true;

      document.addEventListener('dblclick', (e) => {
          const linkNode = e.target.closest?.('.rich-link-node');
          if (!linkNode) return;
          if ((linkNode.dataset.mode || 'preview') !== 'link') return;
          if (!linkNode.closest('#detail-editor-rich, .block-content, .rhythm-node-input')) return;
          // Lightweight links are directly editable inline now.
      });
      document.addEventListener('input', (e) => {
          const linkNode = e.target?.closest?.('.rich-link-node');
          if (!linkNode) return;
          if ((linkNode.dataset.mode || 'preview') !== 'link') return;
          const nextUrl = (linkNode.textContent || '').replace(/\u00A0/g, ' ').trim();
          linkNode.dataset.url = nextUrl;
          persistRichEditorForNode(linkNode);
      });
      document.addEventListener('blur', (e) => {
          const linkNode = e.target?.closest?.('.rich-link-node');
          if (!linkNode) return;
          if ((linkNode.dataset.mode || 'preview') !== 'link') return;
          const nextUrl = (linkNode.textContent || '').replace(/\u00A0/g, ' ').trim();
          linkNode.dataset.url = nextUrl;
          linkNode.textContent = nextUrl;
          persistRichEditorForNode(linkNode);
      }, true);
      document.addEventListener('input', (e) => {
          const linkNode = e.target?.closest?.('.rich-link-node');
          if (!linkNode) return;
          if ((linkNode.dataset.mode || 'preview') !== 'link') return;
          const nextUrl = (linkNode.textContent || '').replace(/\u00A0/g, ' ').trim();
          linkNode.dataset.url = nextUrl;
          persistRichEditorForNode(linkNode);
      });
      document.addEventListener('blur', (e) => {
          const linkNode = e.target?.closest?.('.rich-link-node');
          if (!linkNode) return;
          if ((linkNode.dataset.mode || 'preview') !== 'link') return;
          const nextUrl = (linkNode.textContent || '').replace(/\u00A0/g, ' ').trim();
          linkNode.dataset.url = nextUrl;
          linkNode.textContent = nextUrl;
          persistRichEditorForNode(linkNode);
      }, true);
    }

    function resolveBlockRowByMeta(meta = null) {
      const context = String(meta?.context || '').trim();
      const contextId = String(meta?.contextId || '').trim();
      const blockId = String(meta?.blockId || '').trim();
      if (!context || !contextId || !blockId) return null;
      return document.querySelector(`.block-row[data-context="${context}"][data-context-id="${contextId}"][data-block-id="${blockId}"]`);
    }

    function ensureBlockBatchSelectionForMenu() {
      if (selectedBlockBatch?.ids?.length) return true;
      const row = resolveBlockRowByMeta(lastOpenedBlockHandleMeta);
      if (!row) return false;
      return selectSingleBlockRow(row);
    }

    function runManualBlockHandleDragFallback(event, context, contextId, blockId) {
      if (!event || typeof document === 'undefined') return false;
      if (typeof event.button === 'number' && event.button !== 0) return false;
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
      const row = event?.currentTarget?.closest?.('.block-row')
          || document.querySelector(`.block-row[data-context="${context}"][data-context-id="${contextId}"][data-block-id="${blockId}"]`);
      if (!row) return false;
      const ids = resolveManagedBlockDragIds(context, contextId, blockId);
      if (!ids.length) return false;
      cancelManualBlockHandleDrag();
      manualBlockHandleDragState = {
          context,
          contextId,
          blockId,
          ids,
          startX: Number(event.clientX) || 0,
          startY: Number(event.clientY) || 0,
          active: false,
          targetRow: null,
          targetBlockId: '',
          insertAfter: false,
          moveHandler: null,
          upHandler: null,
      };

      const moveHandler = (moveEvent) => { const state = manualBlockHandleDragState; if (!state) return; const dx = (Number(moveEvent.clientX) || 0) - state.startX; const dy = (Number(moveEvent.clientY) || 0) - state.startY; if (!state.active && Math.hypot(dx, dy) < 4) return; const movingSet = new Set(state.ids || []); if (!state.active) { state.active = true; document.querySelectorAll(`.block-row[data-context="${state.context}"][data-context-id="${state.contextId}"]`).forEach((candidate) => { if (movingSet.has(candidate.dataset.blockId)) candidate.classList.add('opacity-30'); }); } document.querySelectorAll('.block-row.drag-over-top, .block-row.drag-over-bottom').forEach((candidate) => { candidate.classList.remove('drag-over-top', 'drag-over-bottom'); }); const hoverEl = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY); let targetRow = hoverEl?.closest?.('.block-row') || null; let forcedInsertAfter = null; const isValidTargetRow = (candidate) => { if (!candidate) return false; const targetContext = String(candidate.dataset.context || ''); const targetContextId = String(candidate.dataset.contextId || ''); const targetBlockId = String(candidate.dataset.blockId || ''); return !!targetBlockId && targetContext === state.context && targetContextId === state.contextId && !movingSet.has(targetBlockId); }; if (!isValidTargetRow(targetRow)) { const nearestTarget = resolveNearestManagedBlockDropTargetRow(state.context, state.contextId, moveEvent.clientY, movingSet); if (nearestTarget?.row && isValidTargetRow(nearestTarget.row)) { targetRow = nearestTarget.row; if (typeof nearestTarget.insertAfter === 'boolean') forcedInsertAfter = nearestTarget.insertAfter; } else { targetRow = null; } } if (!targetRow || !isValidTargetRow(targetRow)) { state.targetRow = null; state.targetBlockId = ''; state.insertAfter = false; return; } const targetBlockId = String(targetRow.dataset.blockId || ''); const rect = targetRow.getBoundingClientRect(); const insertAfter = typeof forcedInsertAfter === 'boolean' ? forcedInsertAfter : ((moveEvent.clientY - rect.top) > (rect.height / 2)); targetRow.classList.toggle('drag-over-bottom', insertAfter); targetRow.classList.toggle('drag-over-top', !insertAfter); state.targetRow = targetRow; state.targetBlockId = targetBlockId; state.insertAfter = insertAfter; };

      const upHandler = (upEvent) => { const state = manualBlockHandleDragState; if (!state) { cancelManualBlockHandleDrag(); return; } const shouldDrop = !!(state.active && state.targetRow && state.targetBlockId); if (shouldDrop) { draggedBlockData = { context: state.context, contextId: state.contextId, blockId: state.blockId, ids: state.ids, }; const targetRow = state.targetRow; const rect = targetRow.getBoundingClientRect(); const clientY = Number(upEvent?.clientY); const fallbackClientY = state.insertAfter ? (rect.bottom - 1) : (rect.top + 1); blockDrop({ preventDefault() {}, stopPropagation() {}, target: targetRow, clientY: Number.isFinite(clientY) ? clientY : fallbackClientY, }, state.context, state.contextId, state.targetBlockId); draggedBlockData = null; } cancelManualBlockHandleDrag({ clearVisual: true }); };

      manualBlockHandleDragState.moveHandler = moveHandler;
      manualBlockHandleDragState.upHandler = upHandler;
      document.addEventListener('mousemove', moveHandler, true);
      document.addEventListener('mouseup', upHandler, true);
      return true;
    }

    function bindBlockHandleActionGlobals() {
      if (didBindBlockHandleActionGlobals) return;
      didBindBlockHandleActionGlobals = true;

      window.openSingleBlockHandleMenu = function openSingleBlockHandleMenu(event, context, contextId, blockId) {
        const row = event?.currentTarget?.closest?.('.block-row') || document.querySelector(`.block-row[data-context="${context}"][data-context-id="${contextId}"][data-block-id="${blockId}"]`);
        if (!row) return false;
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!isRowInsideSelectedBlockBatch(row)) selectSingleBlockRow(row);
        lastOpenedBlockHandleMeta = { context, contextId, blockId };
        const rect = row.querySelector('.drag-handle')?.getBoundingClientRect?.() || row.getBoundingClientRect();
        showBlockBatchMenuAt(rect.left + Math.min(rect.width + 8, 24), rect.top + Math.max(0, rect.height * 0.5));
        requestLucideRefresh({ root: blockBatchMenu });
        return false;
      };
    }

    function bindContextBatchMenuEvents() {
      if (didBindContextBatchMenuEvents) return;
      didBindContextBatchMenuEvents = true;

      document.addEventListener('contextmenu', (e) => {
          const linkNode = e.target.closest('.rich-link-node');
          const editableRoot = linkNode && linkNode.closest('#detail-editor-rich, .block-content, .rhythm-node-input');
          if (linkNode && editableRoot) {
              e.preventDefault(); activeLinkNode = linkNode; ctxMenu.style.left = `${e.clientX}px`; ctxMenu.style.top = `${e.clientY}px`; showLinkContextMenu();
              const mode = linkNode.dataset.mode || 'preview'; document.getElementById('menu-toggle-link').style.display = mode === 'preview' ? 'flex' : 'none'; document.getElementById('menu-toggle-preview').style.display = mode === 'link' ? 'flex' : 'none';
          } else { hideLinkContextMenu(); }
      });
      document.addEventListener('contextmenu', (e) => {
          const row = e.target.closest?.('.block-row');
          const hitDragHandle = !!e.target.closest?.('.drag-handle');
          if (!row || (!row.classList.contains('block-selected') && !hitDragHandle)) {
              hideBlockBatchMenu();
              return;
          }
          if (!selectedBlockBatch || !isRowInsideSelectedBlockBatch(row)) {
              if (!selectSingleBlockRow(row)) {
                  hideBlockBatchMenu();
                  return;
              }
          }
          if (!selectedBlockBatch) {
              hideBlockBatchMenu();
              return;
          }
          if (row.dataset.context !== selectedBlockBatch.context || row.dataset.contextId !== selectedBlockBatch.contextId) {
              hideBlockBatchMenu();
              return;
          }
          e.preventDefault();
          e.stopPropagation();
          showBlockBatchMenuAt(e.clientX, e.clientY);
      });
      document.addEventListener('click', (e) => {
          hideLinkContextMenu();
          hideContextCardMenu();
          hideThoughtGraphNodeMenu();
          hideBlockBatchMenu();
          const target = e?.target;
          const previewActive = typeof isThoughtGraphKeyboardPreviewActive === 'function' ? isThoughtGraphKeyboardPreviewActive() : false;
          const insideThoughtGraphUi = !!target?.closest?.('#main-flash-thoughts-list, #thought-graph-hover-preview, #thought-graph-status-bar');
          if (previewActive && insideThoughtGraphUi) return;
          hideThoughtGraphHoverPreview();
      });
      document.getElementById('menu-toggle-link')?.addEventListener('click', () => { if(activeLinkNode) setLinkNodeMode(activeLinkNode, 'link'); });
      document.getElementById('menu-toggle-preview')?.addEventListener('click', () => { if(activeLinkNode) setLinkNodeMode(activeLinkNode, 'preview'); });
      thoughtGraphNodeMenuOpenBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = activeThoughtGraphNodeTarget;
          hideThoughtGraphNodeMenu();
          if (!target) return;
          window.handleThoughtGraphNodeOpen?.(target.kind, target.id);
      });
      thoughtGraphNodeMenuDeleteBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = activeThoughtGraphNodeTarget;
          hideThoughtGraphNodeMenu();
          if (!target) return;
          if (!['flashThoughts', 'fixed', 'completedFlashThoughts', 'completedFixedThoughts'].includes(target.kind)) return;
          confirmDelete(target.kind, target.id);
      });
      document.getElementById('block-batch-menu-copy')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          hideBlockBatchMenu();
          if (!ensureBlockBatchSelectionForMenu()) return;
          await writeSelectedBlockBatchToClipboard({ cut: false });
      });
      document.getElementById('block-batch-menu-cut')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          hideBlockBatchMenu();
          if (!ensureBlockBatchSelectionForMenu()) return;
          await cutSelectedBlockBatchWithFallback();
      });
      document.getElementById('block-batch-menu-delete')?.addEventListener('click', (e) => {
          e.stopPropagation();
          hideBlockBatchMenu();
          if (!ensureBlockBatchSelectionForMenu()) return;
          deleteSelectedBlockBatch();
      });
      document.getElementById('context-card-menu-open-side-panel')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!activeContextCardTarget) return;
          const { contextType, id, parentId, isFragment, kind } = activeContextCardTarget;
          hideContextCardMenu();
          if (kind || isFragment || parentId || contextType !== 'project') return;
          if (typeof openProjectAsWorkbenchSidePanel === 'function') openProjectAsWorkbenchSidePanel(id);
      });
      document.getElementById('context-card-menu-edit')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!activeContextCardTarget) return;
          const { contextType, id, parentId, isFragment, kind } = activeContextCardTarget;
          hideContextCardMenu();
          if (kind === 'project-lane') {
              promptRenameProjectQueueLane(id);
              return;
          }
          if (kind === 'ai-chat-session') {
              promptRenameAIChatSession(id);
              return;
          }
          if (kind === 'ai-chat-message') {
              quoteAIChatMessageToComposer(id);
              return;
          }
          if (isFragment && parentId) {
              const parent = data[`${contextType}s`]?.find((p) => p.id === parentId);
              const item = parent?.items?.find((i) => i.id === id);
              if (item) openDetailModal(item, { kind: 'context-fragment', parentId, contextType });
          } else {
              renameContextItem(contextType, id);
          }
      });
      document.getElementById('context-card-menu-move')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!activeContextCardTarget) return;
          const { contextType, id, parentId, isFragment, kind } = activeContextCardTarget;
          hideContextCardMenu();
          if (kind || isFragment || parentId || contextType !== 'project') return;
          promptMoveProject(id);
      });
      document.getElementById('context-card-menu-archive')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!activeContextCardTarget) return;
          const { contextType, id, parentId, isFragment, kind } = activeContextCardTarget;
          hideContextCardMenu();
          if (kind || isFragment || parentId || contextType !== 'project') return;
          const project = Array.isArray(data.projects) ? data.projects.find((item) => item.id === id) : null;
          const isArchivedProject = !!project && (String(project.status || '').trim() === 'archived' || !!String(project.archivedAt || '').trim());
          if (isArchivedProject) {
              confirmRestoreProject(id);
              return;
          }
          confirmArchiveProject(id);
      });
      document.getElementById('context-card-menu-delete')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!activeContextCardTarget) return;
          const { contextType, id, parentId, isFragment, kind } = activeContextCardTarget;
          hideContextCardMenu();
          if (kind === 'project-lane') {
              confirmDeleteProjectQueueLane(id);
              return;
          }
          if (kind === 'ai-chat-session') {
              confirmDeleteAIChatSession(id);
              return;
          }
          if (kind === 'ai-chat-message') {
              confirmDeleteAIChatMessage(id);
              return;
          }
          if (isFragment && parentId) confirmDelete(contextType + 'Orbit', id, parentId); else {
              confirmDelete(contextType, id);
          }
      });
    }

    return {
      handleManagedBlockPointerCompletion,
      bindAIChatEventBindings,
      bindEditorInteractionEvents,
      bindDetailEditorSurfaceEvents,
      bindThoughtHeaderMenuEvents,
      bindShellSearchEvents,
      bindHeaderPillDismissEvents,
      bindDetailLinkInteractionEvents,
      bindRichLinkLifecycleEvents,
      bindAppInputLifecycleEvents,
      bindModalActionEvents,
      bindSidebarResizeEvents,
      runManualBlockHandleDragFallback,
      bindBlockHandleActionGlobals,
      bindContextBatchMenuEvents,
    };
  }

  window.MorphAIChatEventBindingsRuntime = {
    create: createAIChatEventBindingsRuntime,
  };
})();
