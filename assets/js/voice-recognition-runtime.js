// @ts-check

(function initMorphVoiceRecognitionRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphVoiceRecognitionRuntime && typeof window.MorphVoiceRecognitionRuntime.create === 'function') return;

  function createVoiceRecognitionRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function mergeVoiceTranscriptText(finalText = '', interimText = '') {
      return `${finalText || ''}${interimText || ''}`.trim();
    }

    function autoPunctuateChineseText(text) {
      if (typeof text !== 'string') return '';
      let s = text.replace(/\r\n/g, '\n').trim();
      if (!s) return '';
      s = s
        .replace(/\s*(逗号|顿号)\s*/g, '，')
        .replace(/\s*(句号|句点)\s*/g, '。')
        .replace(/\s*(问号)\s*/g, '？')
        .replace(/\s*(感叹号)\s*/g, '！')
        .replace(/\s*(冒号)\s*/g, '：')
        .replace(/\s*(分号)\s*/g, '；')
        .replace(/\s*(省略号)\s*/g, '……')
        .replace(/\s*(换行|另起一行)\s*/g, '\n')
        .replace(/[ \t]+/g, ' ');

      if (/[\u3002\uff01\uff1f\uff0c\uff1b\uff1a,.!?]/.test(s)) {
        return s;
      }

      const parts = [];
      let buf = '';
      const hardBreakWords = ['但是', '不过', '然后', '所以', '因此', '因为', '如果', '同时', '另外', '而且'];
      for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        buf += ch;
        const lookback = s.slice(Math.max(0, i - 2), i + 1);
        const hitWord = hardBreakWords.some((word) => lookback.endsWith(word));
        if (buf.length >= 16 && (hitWord || /[啊呀呢吧嘛啦]/.test(ch) || buf.length >= 24)) {
          parts.push(buf.trim());
          buf = '';
        }
      }
      if (buf.trim()) parts.push(buf.trim());
      if (parts.length === 0) return s;

      const withComma = parts.join('，').replace(/，+/g, '，');
      const endsWithQuestion = /(吗|么|呢|是不是|要不要)$/.test(withComma);
      const terminal = endsWithQuestion ? '？' : '。';
      return /[。！？]$/.test(withComma) ? withComma : `${withComma}${terminal}`;
    }

    function applyVoiceTranscriptToInput(input, text = '', { moveCaretToEnd = true } = {}) {
      if (!input) return;
      input.value = String(text || '');
      if (!moveCaretToEnd) return;
      try {
        const len = input.value.length;
        input.setSelectionRange(len, len);
        input.scrollLeft = input.scrollWidth;
      } catch (_) {}
    }

    function shouldSkipVoiceTranscriptCommit(lastCommittedText, lastCommittedAt, nextText, nowMs, dedupeWindowMs = 1600) {
      return (
        String(lastCommittedText || '') === String(nextText || '')
        && (Number(nowMs || 0) - Number(lastCommittedAt || 0)) < Number(dedupeWindowMs || 1600)
      );
    }

    function parseSpeechRecognitionResultBuffers(event) {
      let finalBuffer = '';
      let interimBuffer = '';
      const startIndex = Number.isFinite(Number(event?.resultIndex)) ? Number(event.resultIndex) : 0;
      const results = event?.results;
      const total = Number.isFinite(Number(results?.length)) ? Number(results.length) : 0;
      for (let i = startIndex; i < total; i += 1) {
        const chunk = String(results?.[i]?.[0]?.transcript || '');
        if (!chunk) continue;
        if (results?.[i]?.isFinal) finalBuffer += chunk;
        else interimBuffer += chunk;
      }
      return { finalBuffer, interimBuffer };
    }

    function stopVoiceRecognitionSafely(recognition) {
      if (!recognition) return;
      try { recognition.stop(); } catch (_) {}
    }

    function startVoiceRecognitionSafely(recognition, { beforeStart = null, suspendMs = 1600 } = {}) {
      if (!recognition) return false;
      try {
        if (Number(suspendMs) > 0 && typeof api.suspendOmniAutoFocus === 'function') {
          api.suspendOmniAutoFocus(Number(suspendMs));
        }
        if (typeof beforeStart === 'function') beforeStart();
        recognition.start();
        return true;
      } catch (_) {
        return false;
      }
    }

    function updateAIVoiceInputField(context = {}, options = {}) {
      const state = context && typeof context.aiVoiceState === 'object' ? context.aiVoiceState : null;
      if (!state || typeof context.getAIChatInputElement !== 'function') return;
      const input = context.getAIChatInputElement();
      if (!input) return;
      const merged = mergeVoiceTranscriptText(state.finalText, state.interimText);
      const punctuate = typeof context.autoPunctuateChineseText === 'function'
        ? context.autoPunctuateChineseText
        : (text) => String(text || '').trim();
      applyVoiceTranscriptToInput(input, options && options.finalize ? punctuate(merged) : merged);
      if (typeof context.markUserEditingActivity === 'function') context.markUserEditingActivity();
      if (typeof context.syncAIInputLoadingState === 'function') context.syncAIInputLoadingState();
    }

    function updateMobileQuickVoiceInputField(context = {}, options = {}) {
      const state = context && typeof context.mobileQuickVoiceState === 'object' ? context.mobileQuickVoiceState : null;
      if (!state || typeof context.getMobileDetailInputElement !== 'function') return;
      const input = context.getMobileDetailInputElement();
      if (!input) return;
      const merged = mergeVoiceTranscriptText(state.finalText, state.interimText);
      const punctuate = typeof context.autoPunctuateChineseText === 'function'
        ? context.autoPunctuateChineseText
        : (text) => String(text || '').trim();
      applyVoiceTranscriptToInput(input, options && options.finalize ? punctuate(merged) : merged);
      if (typeof context.markUserEditingActivity === 'function') context.markUserEditingActivity();
      if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
    }

    function resetMobileQuickVoiceState(context = {}, options = {}) {
      const state = context && typeof context.mobileQuickVoiceState === 'object' ? context.mobileQuickVoiceState : null;
      if (!state) return;
      state.running = false;
      state.finalText = '';
      state.interimText = '';
      state.mode = '';
      if (options && options.clearInput && typeof context.getMobileDetailInputElement === 'function') {
        const input = context.getMobileDetailInputElement();
        if (input) input.value = '';
      }
      if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
    }

    function ensureAIVoiceRecognition(context = {}) {
      const state = context && typeof context.aiVoiceState === 'object' ? context.aiVoiceState : null;
      if (!state) return null;
      if (state.recognition) return state.recognition;
      const win = context.windowRef || (typeof window !== 'undefined' ? window : null);
      const SpeechAPI = win && (win.SpeechRecognition || win.webkitSpeechRecognition);
      if (!SpeechAPI) return null;
      const recognition = new SpeechAPI();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        state.running = true;
        state.provider = 'web';
        state.finalText = '';
        state.interimText = '';
        if (context.healthVoiceState && typeof context.healthVoiceState === 'object') {
          context.healthVoiceState.running = state.captureContext === 'health';
        }
        const input = typeof context.getAIChatInputElement === 'function' ? context.getAIChatInputElement() : null;
        if (input) input.value = '';
        if (typeof context.syncAIInputLoadingState === 'function') context.syncAIInputLoadingState();
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
        if (typeof context.renderHealthVoiceUI === 'function') context.renderHealthVoiceUI();
      };
      recognition.onresult = (event) => {
        const { finalBuffer, interimBuffer } = parseSpeechRecognitionResultBuffers(event);
        if (finalBuffer) state.finalText += finalBuffer;
        state.interimText = interimBuffer;
        updateAIVoiceInputField(context, { finalize: false });
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
        if (typeof context.renderHealthVoiceUI === 'function') context.renderHealthVoiceUI();
      };
      recognition.onerror = () => {
        state.running = false;
        state.provider = '';
        state.captureContext = 'ai';
        state.finalText = '';
        state.interimText = '';
        if (context.healthVoiceState && typeof context.healthVoiceState === 'object') {
          context.healthVoiceState.running = false;
        }
        if (typeof context.syncAIInputLoadingState === 'function') context.syncAIInputLoadingState();
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
        if (typeof context.renderHealthVoiceUI === 'function') context.renderHealthVoiceUI();
      };
      recognition.onend = () => {
        if (typeof context.finalizeAIVoiceInput === 'function') {
          context.finalizeAIVoiceInput();
          return;
        }
        state.running = false;
      };
      state.recognition = recognition;
      return recognition;
    }

    function ensureMobileQuickVoiceRecognition(context = {}) {
      const state = context && typeof context.mobileQuickVoiceState === 'object' ? context.mobileQuickVoiceState : null;
      if (!state) return null;
      if (state.recognition) return state.recognition;
      const win = context.windowRef || (typeof window !== 'undefined' ? window : null);
      const SpeechAPI = win && (win.SpeechRecognition || win.webkitSpeechRecognition);
      if (!SpeechAPI) return null;
      const recognition = new SpeechAPI();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        state.running = true;
        state.finalText = '';
        state.interimText = '';
        const input = typeof context.getMobileDetailInputElement === 'function'
          ? context.getMobileDetailInputElement()
          : null;
        if (input) input.value = '';
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
      };
      recognition.onresult = (event) => {
        const { finalBuffer, interimBuffer } = parseSpeechRecognitionResultBuffers(event);
        if (finalBuffer) state.finalText += finalBuffer;
        state.interimText = interimBuffer;
        updateMobileQuickVoiceInputField(context, { finalize: false });
      };
      recognition.onerror = () => {
        state.running = false;
        state.finalText = '';
        state.interimText = '';
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
      };
      recognition.onend = () => {
        if (typeof context.finalizeMobileQuickVoiceInput === 'function') {
          context.finalizeMobileQuickVoiceInput();
          return;
        }
        state.running = false;
      };
      state.recognition = recognition;
      return recognition;
    }

    function resolveDailyVoiceTargetEditor(context = {}) {
      const state = context && typeof context.dailyVoiceState === 'object' ? context.dailyVoiceState : null;
      const win = context.windowRef || (typeof window !== 'undefined' ? window : null);
      const doc = context.documentRef || (typeof document !== 'undefined' ? document : null);
      const NodeRef = context.NodeRef || win?.Node || (typeof Node !== 'undefined' ? Node : null);
      if (!state || !doc) return null;
      const getEditorFromNode = (node) => {
        const elementNode = node && NodeRef && node.nodeType === NodeRef.ELEMENT_NODE
          ? node
          : node?.parentElement;
        return elementNode?.closest?.('#daily-block-editor .block-content') || null;
      };
      if (state.anchorRange) {
        const editor = getEditorFromNode(state.anchorRange.startContainer);
        if (editor) return editor;
      }
      const selection = win && typeof win.getSelection === 'function' ? win.getSelection() : null;
      if (selection && selection.rangeCount) {
        const editor = getEditorFromNode(selection.getRangeAt(0).startContainer);
        if (editor) return editor;
      }
      const active = doc.activeElement;
      if (active?.closest) {
        const editor = active.closest('#daily-block-editor .block-content');
        if (editor) return editor;
      }
      if (state.targetBlockId) {
        const remembered = doc.querySelector(`#daily-block-editor .block-content[data-id="${state.targetBlockId}"]`);
        if (remembered) return remembered;
      }
      return doc.querySelector('#daily-block-editor .block-content:last-of-type');
    }

    function ensureDailyVoiceLiveNode(context = {}) {
      const state = context && typeof context.dailyVoiceState === 'object' ? context.dailyVoiceState : null;
      const win = context.windowRef || (typeof window !== 'undefined' ? window : null);
      const doc = context.documentRef || (typeof document !== 'undefined' ? document : null);
      const dataRef = context && typeof context.dataRef === 'object' ? context.dataRef : null;
      if (!state || !doc) return null;
      const existing = state.liveNode;
      if (existing && existing.isConnected) return existing;

      let editor = resolveDailyVoiceTargetEditor(context);
      if (!editor) {
        const monthKey = typeof context.getMonthStr === 'function' ? context.getMonthStr() : '';
        if (monthKey && dataRef) {
          if (!dataRef.dailyMonths || typeof dataRef.dailyMonths !== 'object') dataRef.dailyMonths = {};
          if (!dataRef.dailyMonths[monthKey]) dataRef.dailyMonths[monthKey] = [];
          const id = typeof context.genId === 'function' ? context.genId() : `daily-${Date.now()}`;
          dataRef.dailyMonths[monthKey].push({ id, type: 'p', content: '', checked: false });
          if (typeof context.saveSilent === 'function') context.saveSilent();
          if (typeof context.renderAll === 'function') context.renderAll();
        }
        editor = doc.querySelector('#daily-block-editor .block-content:last-of-type');
        if (!editor) return null;
      }
      state.targetBlockId = editor.dataset.id || state.targetBlockId;

      let range = state.anchorRange ? state.anchorRange.cloneRange() : null;
      if (!range || !editor.contains(range.startContainer)) {
        const selection = win && typeof win.getSelection === 'function' ? win.getSelection() : null;
        const candidate = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        range = candidate && editor.contains(candidate.startContainer) ? candidate.cloneRange() : null;
      }
      if (!range) {
        range = doc.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
      }

      const live = doc.createElement('span');
      live.dataset.dailyVoiceLive = '1';
      live.className = 'text-gray-500 dark:text-white/50';
      live.textContent = '正在听写…';
      range.insertNode(live);
      state.anchorRange = null;
      state.liveNode = live;
      try { doc.activeElement?.blur?.(); } catch (_) {}
      if (typeof context.persistRichEditorForNode === 'function') context.persistRichEditorForNode(editor);
      return live;
    }

    function updateDailyVoiceLiveTranscript(context = {}, text) {
      const live = ensureDailyVoiceLiveNode(context);
      if (!live) return;
      live.textContent = String(text || '').trim();
      const editor = live.closest('.block-content');
      if (editor && typeof context.persistRichEditorForNode === 'function') {
        context.persistRichEditorForNode(editor);
      }
    }

    function commitDailyVoiceLiveTranscript(context = {}, finalText = '') {
      const state = context && typeof context.dailyVoiceState === 'object' ? context.dailyVoiceState : null;
      const win = context.windowRef || (typeof window !== 'undefined' ? window : null);
      const doc = context.documentRef || (typeof document !== 'undefined' ? document : null);
      if (!state || !doc) return;
      const live = state.liveNode;
      if (!live || !live.isConnected) return;
      const source = String(finalText || live.textContent || '').trim();
      if (source === '正在听写…') {
        live.remove();
        state.liveNode = null;
        return;
      }
      const punctuate = typeof context.autoPunctuateChineseText === 'function'
        ? context.autoPunctuateChineseText
        : (value) => String(value || '').trim();
      const normalized = punctuate(source);
      const editor = live.closest('.block-content');
      if (!normalized) {
        live.remove();
        state.liveNode = null;
        if (editor && typeof context.persistRichEditorForNode === 'function') {
          context.persistRichEditorForNode(editor);
        }
        return;
      }
      const textNode = doc.createTextNode(normalized);
      live.replaceWith(textNode);
      state.liveNode = null;
      const selection = win && typeof win.getSelection === 'function' ? win.getSelection() : null;
      if (selection) {
        const range = doc.createRange();
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      if (editor && typeof context.persistRichEditorForNode === 'function') {
        context.persistRichEditorForNode(editor);
      }
      state.lastCommittedText = normalized;
      state.lastCommittedAt = Date.now();
    }

    function setHomeVoiceStatus(context = {}, text, isError = false) {
      const statusEl = typeof context.getHomeVoiceStatusElement === 'function'
        ? context.getHomeVoiceStatusElement()
        : null;
      if (!statusEl) return;
      statusEl.textContent = text || '将自动写入闪念';
      statusEl.classList.toggle('text-red-500', !!isError);
      statusEl.classList.toggle('dark:text-red-400', !!isError);
      if (!isError) {
        statusEl.classList.remove('text-red-500', 'dark:text-red-400');
        statusEl.classList.add('text-gray-400', 'dark:text-white/30');
      }
    }

    function renderHomeVoiceUI(context = {}) {
      const state = context && typeof context.homeVoiceState === 'object' ? context.homeVoiceState : null;
      if (!state) return;
      const btn = typeof context.getHomeVoiceToggleButton === 'function'
        ? context.getHomeVoiceToggleButton()
        : null;
      const textEl = typeof context.getHomeVoiceToggleTextElement === 'function'
        ? context.getHomeVoiceToggleTextElement()
        : null;
      if (!btn || !textEl) return;
      const enabled = (typeof context.isMobileNavMode === 'function' && context.isMobileNavMode())
        && (typeof context.hasNativeControlBridge === 'function' && context.hasNativeControlBridge());
      state.available = enabled;
      btn.classList.toggle('hidden', !enabled);
      if (!enabled) {
        state.running = false;
        return;
      }
      textEl.textContent = state.running ? '停止' : '语音';
      btn.classList.toggle('bg-red-500', state.running);
      btn.classList.toggle('text-white', state.running);
      btn.classList.toggle('dark:bg-red-500', state.running);
      btn.classList.toggle('bg-gray-100', !state.running);
      btn.classList.toggle('dark:bg-white/10', !state.running);
      btn.classList.toggle('text-gray-700', !state.running);
      btn.classList.toggle('dark:text-white/85', !state.running);
    }

    function renderHealthVoiceUI(context = {}) {
      const state = context && typeof context.healthVoiceState === 'object' ? context.healthVoiceState : null;
      if (!state) return;
      const btn = typeof context.getHealthVoiceToggleButton === 'function'
        ? context.getHealthVoiceToggleButton()
        : null;
      const textEl = typeof context.getHealthVoiceToggleTextElement === 'function'
        ? context.getHealthVoiceToggleTextElement()
        : null;
      const iconEl = typeof context.getHealthVoiceToggleIconElement === 'function'
        ? context.getHealthVoiceToggleIconElement()
        : null;
      if (!btn || !textEl) return;
      const enabled = (typeof context.isMobileNavMode === 'function' && context.isMobileNavMode())
        && context.currentTab === 'health'
        && !(typeof context.isNativeDesktopShell === 'function' && context.isNativeDesktopShell());
      btn.classList.toggle('hidden', !enabled);
      if (!enabled) {
        state.running = false;
        state.asking = false;
        return;
      }
      const asking = !!state.asking;
      const running = !!state.running;
      textEl.textContent = asking ? '提问中' : (running ? '停止' : '语音');
      if (iconEl) {
        iconEl.setAttribute('data-lucide', asking ? 'loader-2' : 'audio-lines');
        iconEl.classList.toggle('animate-spin', asking);
      }
      btn.disabled = asking;
      btn.classList.toggle('opacity-70', asking);
      btn.classList.toggle('cursor-wait', asking);
      btn.classList.toggle('bg-red-500', running && !asking);
      btn.classList.toggle('dark:bg-red-500', running && !asking);
      btn.classList.toggle('text-white', running && !asking);
      btn.classList.toggle('bg-gray-100', !running || asking);
      btn.classList.toggle('dark:bg-white/10', !running || asking);
      btn.classList.toggle('text-gray-700', !running || asking);
      btn.classList.toggle('dark:text-white', !running || asking);
      if (typeof context.requestLucideRefresh === 'function') context.requestLucideRefresh({ root: btn });
    }

    function handleNativeSpeechEvent(context = {}, eventName, payload) {
      const state = context && typeof context.aiVoiceState === 'object' ? context.aiVoiceState : null;
      const ttsState = context && typeof context.aiTTSState === 'object' ? context.aiTTSState : null;
      if (!state) return;
      const event = String(eventName || '').trim();
      const dataPayload = payload && typeof payload === 'object' ? payload : {};
      if (event === 'start') {
        state.available = true;
        state.running = true;
        state.provider = 'native';
        state.finalText = '';
        state.interimText = '';
        const input = typeof context.getAIChatInputElement === 'function' ? context.getAIChatInputElement() : null;
        if (input) input.value = '';
        if (typeof context.syncAIInputLoadingState === 'function') context.syncAIInputLoadingState();
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
        return;
      }
      if (event === 'partial') {
        state.available = true;
        state.running = true;
        state.provider = 'native';
        state.finalText = '';
        state.interimText = String(dataPayload.text || '');
        updateAIVoiceInputField(context, { finalize: false });
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
        return;
      }
      if (event === 'final') {
        state.available = true;
        state.running = false;
        state.provider = 'native';
        state.finalText = String(dataPayload.text || '');
        state.interimText = '';
        updateAIVoiceInputField(context, { finalize: true });
        if (typeof context.syncAIInputLoadingState === 'function') context.syncAIInputLoadingState();
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
        return;
      }
      if (event === 'end') {
        if (!state.finalText && dataPayload.text) {
          state.finalText = String(dataPayload.text || '');
        }
        finalizeAIVoiceInput(context);
        return;
      }
      if (event === 'spoken') {
        if (ttsState) ttsState.playing = false;
        return;
      }
      if (event === 'error') {
        state.running = false;
        state.provider = '';
        if (ttsState) ttsState.playing = false;
        const message = String(dataPayload.message || '').trim();
        if (message && typeof context.setAISettingsFeedback === 'function') {
          context.setAISettingsFeedback(`语音不可用：${message}`, true);
        }
        if (typeof context.syncAIInputLoadingState === 'function') context.syncAIInputLoadingState();
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
      }
    }

    function toggleHomeVoiceInput(context = {}) {
      const state = context && typeof context.homeVoiceState === 'object' ? context.homeVoiceState : null;
      if (!state) return;
      state.running = false;
      renderHomeVoiceUI(context);
      setHomeVoiceStatus(context, '语音功能已停用', true);
    }

    function toggleDailyVoiceInput(context = {}) {
      const state = context && typeof context.dailyVoiceState === 'object' ? context.dailyVoiceState : null;
      if (!state) return;
      state.running = false;
      commitDailyVoiceLiveTranscript(context, '');
      if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
      if (typeof context.openCustomModal === 'function') {
        context.openCustomModal({ title: '语音功能已停用', desc: '请直接使用系统键盘语音输入。' });
      }
    }

    function toggleDetailComposerVoiceInput(context = {}) {
      const state = context && typeof context.detailComposerVoiceState === 'object' ? context.detailComposerVoiceState : null;
      if (!state) return;
      if (!state.available) {
        setDetailComposerVoiceStatus(context, '当前环境不支持语音', true);
        return;
      }
      if (state.running) {
        stopVoiceRecognitionSafely(state.recognition);
        return;
      }
      const plainText = typeof context.getDetailComposerPlainText === 'function'
        ? context.getDetailComposerPlainText()
        : '';
      if (plainText) {
        if (typeof context.addItemFromDetailComposer === 'function') {
          context.addItemFromDetailComposer();
        }
        return;
      }
      startDetailComposerVoiceInput(context);
    }

    function setDetailComposerVoiceStatus(context = {}, text, isError = false) {
      const el = typeof context.getDetailComposerStatusElement === 'function'
        ? context.getDetailComposerStatusElement()
        : null;
      if (!el) return;
      el.textContent = '';
      el.classList.add('hidden');
      el.classList.toggle('text-red-500', !!isError);
      el.classList.toggle('dark:text-red-400', !!isError);
      if (!isError) {
        el.classList.remove('text-red-500', 'dark:text-red-400');
        el.classList.add('text-gray-400', 'dark:text-white/35');
      }
    }

    function renderDetailComposerVoiceUI(context = {}) {
      const state = context && typeof context.detailComposerVoiceState === 'object' ? context.detailComposerVoiceState : null;
      if (!state) return;
      const btn = typeof context.getDetailComposerVoiceToggleButton === 'function'
        ? context.getDetailComposerVoiceToggleButton()
        : null;
      const textEl = typeof context.getDetailComposerVoiceToggleTextElement === 'function'
        ? context.getDetailComposerVoiceToggleTextElement()
        : null;
      if (!btn || !textEl) return;
      const mode = typeof context.getCurrentDetailMode === 'function' ? context.getCurrentDetailMode() : '';
      const hasSpeechAPI = typeof context.hasBrowserSpeechRecognition === 'function'
        ? context.hasBrowserSpeechRecognition()
        : false;
      const enabled = (typeof context.isMobileNavMode === 'function' && context.isMobileNavMode())
        && ['create-flashThoughts', 'create-fixed'].includes(mode)
        && !!hasSpeechAPI;
      state.available = enabled;
      if (!enabled) {
        state.running = false;
        textEl.textContent = '语音';
        btn.classList.add('opacity-60');
        setDetailComposerVoiceStatus(context, '当前环境不支持语音');
        btn.setAttribute('data-lucide', 'mic');
        if (typeof context.requestLucideRefresh === 'function') context.requestLucideRefresh({ root: btn });
        return;
      }
      btn.classList.remove('opacity-60');
      const hasContent = typeof context.getDetailComposerPlainText === 'function'
        ? !!context.getDetailComposerPlainText()
        : false;
      const icon = state.running ? 'loader-2' : (hasContent ? 'send' : 'audio-lines');
      btn.classList.remove('bg-red-500', 'text-white', 'dark:bg-red-500', 'opacity-60');
      btn.classList.add('bg-gray-100', 'dark:bg-white/10', 'text-gray-700', 'dark:text-white/85');
      btn.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 ${state.running ? 'animate-spin' : ''}"></i><span id="detail-voice-toggle-text" class="hidden">${state.running ? '处理中' : (hasContent ? '发送' : '语音')}</span>`;
      if (typeof context.requestLucideRefresh === 'function') context.requestLucideRefresh({ root: btn });
    }

    function appendSpeechTextToDetailEditor(context = {}, text, { isFinal = false } = {}) {
      const state = context && typeof context.detailComposerVoiceState === 'object' ? context.detailComposerVoiceState : null;
      if (!state || !text || !String(text).trim()) return;
      const editor = typeof context.getDetailComposerEditor === 'function'
        ? context.getDetailComposerEditor()
        : null;
      if (!editor) return;
      const punctuate = typeof context.autoPunctuateChineseText === 'function'
        ? context.autoPunctuateChineseText
        : (value) => String(value || '').trim();
      const normalized = isFinal ? punctuate(String(text)) : String(text);
      if (!normalized.trim()) return;
      const now = Date.now();
      if (isFinal && state.lastCommittedText === normalized && (now - state.lastCommittedAt) < 1600) {
        return;
      }
      const prefix = editor.textContent?.trim() ? '\n' : '';
      const node = document.createTextNode(`${prefix}${normalized}`);
      editor.appendChild(node);
      if (typeof context.persistRichEditorForNode === 'function') context.persistRichEditorForNode(editor);
      if (isFinal) {
        state.lastCommittedText = normalized;
        state.lastCommittedAt = now;
      }
    }

    function ensureDetailComposerLiveNode(context = {}) {
      const state = context && typeof context.detailComposerVoiceState === 'object' ? context.detailComposerVoiceState : null;
      if (!state) return null;
      const editor = typeof context.getDetailComposerEditor === 'function'
        ? context.getDetailComposerEditor()
        : null;
      if (!editor) return null;
      const prev = state.liveNode;
      if (prev && prev.isConnected) return prev;

      const span = document.createElement('span');
      span.dataset.voiceLive = '1';
      span.className = 'text-gray-500 dark:text-white/50';
      const prefix = editor.textContent?.trim() ? '\n' : '';
      span.textContent = prefix;
      editor.appendChild(span);
      state.liveNode = span;
      return span;
    }

    function updateDetailComposerLiveTranscript(context = {}, text) {
      const node = ensureDetailComposerLiveNode(context);
      if (!node) return;
      const value = String(text || '').trim();
      if (!value) return;
      const hasLeadingBreak = node.textContent?.startsWith('\n');
      node.textContent = `${hasLeadingBreak ? '\n' : ''}${value}`;
      const editor = typeof context.getDetailComposerEditor === 'function'
        ? context.getDetailComposerEditor()
        : null;
      if (editor) editor.scrollTop = editor.scrollHeight;
      if (typeof context.persistRichEditorForNode === 'function') context.persistRichEditorForNode(editor);
      renderDetailComposerVoiceUI(context);
    }

    function commitDetailComposerLiveTranscript(context = {}, finalText = '') {
      const state = context && typeof context.detailComposerVoiceState === 'object' ? context.detailComposerVoiceState : null;
      if (!state) return;
      const editor = typeof context.getDetailComposerEditor === 'function'
        ? context.getDetailComposerEditor()
        : null;
      if (!editor) return;
      const node = state.liveNode;
      const liveText = node && node.isConnected ? node.textContent : '';
      const source = String(finalText || liveText || '').trim();
      if (node && node.isConnected) node.remove();
      state.liveNode = null;
      if (!source) return;
      appendSpeechTextToDetailEditor(context, source, { isFinal: true });
      editor.scrollTop = editor.scrollHeight;
      renderDetailComposerVoiceUI(context);
    }

    function ensureDetailComposerRecognition(context = {}) {
      const state = context && typeof context.detailComposerVoiceState === 'object' ? context.detailComposerVoiceState : null;
      if (!state) return null;
      if (state.recognition) return state.recognition;
      const win = context.windowRef || (typeof window !== 'undefined' ? window : null);
      const SpeechAPI = win && (win.SpeechRecognition || win.webkitSpeechRecognition);
      if (!SpeechAPI) return null;
      const recognition = new SpeechAPI();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        state.running = true;
        renderDetailComposerVoiceUI(context);
      };
      recognition.onresult = (event) => {
        const { finalBuffer, interimBuffer } = parseSpeechRecognitionResultBuffers(event);
        if (finalBuffer) {
          commitDetailComposerLiveTranscript(context, finalBuffer);
        }
        if (interimBuffer) {
          updateDetailComposerLiveTranscript(context, interimBuffer);
        }
      };
      recognition.onerror = () => {
        state.running = false;
        renderDetailComposerVoiceUI(context);
      };
      recognition.onend = () => {
        state.running = false;
        commitDetailComposerLiveTranscript(context, '');
        renderDetailComposerVoiceUI(context);
      };
      state.recognition = recognition;
      return recognition;
    }

    function finalizeAIVoiceInput(context = {}) {
      const state = context && typeof context.aiVoiceState === 'object' ? context.aiVoiceState : null;
      const chatState = context && typeof context.aiChatState === 'object' ? context.aiChatState : null;
      if (!state || !chatState) return;
      if (!state.running && !state.finalText && !state.interimText) {
        if (typeof context.syncAIInputLoadingState === 'function') context.syncAIInputLoadingState();
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
        if (typeof context.renderHealthVoiceUI === 'function') context.renderHealthVoiceUI();
        return;
      }
      const captureContext = state.captureContext || 'ai';
      state.running = false;
      if (context.healthVoiceState && typeof context.healthVoiceState === 'object') {
        context.healthVoiceState.running = false;
      }
      const merged = mergeVoiceTranscriptText(state.finalText, state.interimText);
      if (merged) {
        const punctuate = typeof context.autoPunctuateChineseText === 'function'
          ? context.autoPunctuateChineseText
          : (text) => String(text || '').trim();
        const normalized = punctuate(merged);
        const now = Date.now();
        if (!shouldSkipVoiceTranscriptCommit(state.lastCommittedText, state.lastCommittedAt, normalized, now)) {
          const input = typeof context.getAIChatInputElement === 'function' ? context.getAIChatInputElement() : null;
          applyVoiceTranscriptToInput(input, normalized, { moveCaretToEnd: false });
          state.lastCommittedText = normalized;
          state.lastCommittedAt = now;
          const setTimeoutRef = typeof context.setTimeoutRef === 'function' ? context.setTimeoutRef : setTimeout;
          if (captureContext === 'ai' && context.currentTab === 'ai' && !chatState.busy) {
            setTimeoutRef(() => {
              if (context.currentTab !== 'ai' || chatState.busy) return;
              const latestInput = typeof context.getAIChatInputElement === 'function' ? context.getAIChatInputElement() : null;
              if (!String(latestInput?.value || '').trim()) return;
              if (typeof context.sendAIChatMessage === 'function') context.sendAIChatMessage();
            }, 80);
          } else if (captureContext === 'health' && !chatState.busy) {
            setTimeoutRef(async () => {
              if (chatState.busy) return;
              if (context.healthVoiceState && typeof context.healthVoiceState === 'object') {
                context.healthVoiceState.asking = true;
              }
              if (typeof context.renderHealthVoiceUI === 'function') context.renderHealthVoiceUI();
              const question = `请结合我当前同步到 Morpheus 的血糖数据，回答我的健康问题并给出简短建议：${normalized}`;
              if (typeof context.executeAICommandWithQuestion === 'function') {
                await context.executeAICommandWithQuestion(question, { recordChat: false });
              }
              if (context.healthVoiceState && typeof context.healthVoiceState === 'object') {
                context.healthVoiceState.asking = false;
              }
              if (typeof context.renderHealthVoiceUI === 'function') context.renderHealthVoiceUI();
            }, 80);
          }
        }
      }
      state.provider = '';
      state.captureContext = 'ai';
      state.finalText = '';
      state.interimText = '';
      if (typeof context.syncAIInputLoadingState === 'function') context.syncAIInputLoadingState();
      if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
      if (typeof context.renderHealthVoiceUI === 'function') context.renderHealthVoiceUI();
    }

    function finalizeMobileQuickVoiceInput(context = {}) {
      const state = context && typeof context.mobileQuickVoiceState === 'object' ? context.mobileQuickVoiceState : null;
      if (!state) return;
      if (!state.running && !state.finalText && !state.interimText) {
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
        return;
      }
      state.running = false;
      const merged = mergeVoiceTranscriptText(state.finalText, state.interimText);
      if (merged) {
        const punctuate = typeof context.autoPunctuateChineseText === 'function'
          ? context.autoPunctuateChineseText
          : (text) => String(text || '').trim();
        const normalized = punctuate(merged);
        const now = Date.now();
        if (!shouldSkipVoiceTranscriptCommit(state.lastCommittedText, state.lastCommittedAt, normalized, now)) {
          const input = typeof context.getMobileDetailInputElement === 'function'
            ? context.getMobileDetailInputElement()
            : null;
          applyVoiceTranscriptToInput(input, normalized);
          state.lastCommittedText = normalized;
          state.lastCommittedAt = now;
        }
      }
      state.finalText = '';
      state.interimText = '';
      if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
    }

    function startAIVoiceInput(context = {}) {
      const state = context && typeof context.aiVoiceState === 'object' ? context.aiVoiceState : null;
      const chatState = context && typeof context.aiChatState === 'object' ? context.aiChatState : null;
      if (!state || !chatState) return false;
      if (context.currentTab !== 'ai' || chatState.busy) return false;
      if (typeof context.isNativeDesktopShell === 'function' && context.isNativeDesktopShell()) {
        state.available = false;
        state.running = false;
        state.provider = '';
        if (typeof context.syncAIInputLoadingState === 'function') context.syncAIInputLoadingState();
        if (typeof context.syncMobileQuickComposeIcon === 'function') context.syncMobileQuickComposeIcon();
        return false;
      }
      const recognition = ensureAIVoiceRecognition(context);
      state.available = !!recognition;
      if (!recognition) return false;
      if (state.running) return true;
      return startVoiceRecognitionSafely(recognition, {
        beforeStart: () => {
          state.captureContext = 'ai';
        },
      });
    }

    function startHealthVoiceInput(context = {}) {
      const state = context && typeof context.aiVoiceState === 'object' ? context.aiVoiceState : null;
      const chatState = context && typeof context.aiChatState === 'object' ? context.aiChatState : null;
      if (!state || !chatState) return false;
      if (context.currentTab !== 'health' || chatState.busy) return false;
      if (typeof context.isNativeDesktopShell === 'function' && context.isNativeDesktopShell()) return false;
      const recognition = ensureAIVoiceRecognition(context);
      state.available = !!recognition;
      if (!recognition) return false;
      if (state.running) return true;
      return startVoiceRecognitionSafely(recognition, {
        beforeStart: () => {
          state.captureContext = 'health';
        },
      });
    }

    function startMobileQuickVoiceInput(context = {}) {
      const state = context && typeof context.mobileQuickVoiceState === 'object' ? context.mobileQuickVoiceState : null;
      if (!state) return false;
      if (!(typeof context.isMobileNavMode === 'function' && context.isMobileNavMode())) return false;
      const recognition = ensureMobileQuickVoiceRecognition(context);
      state.available = !!recognition;
      if (!recognition) return false;
      if (state.running) return true;
      state.mode = context.mode || '';
      return startVoiceRecognitionSafely(recognition);
    }

    function startDetailComposerVoiceInput(context = {}) {
      const recognition = ensureDetailComposerRecognition(context);
      if (!recognition) return false;
      return startVoiceRecognitionSafely(recognition, { suspendMs: 0 });
    }

    return {
      mergeVoiceTranscriptText,
      autoPunctuateChineseText,
      applyVoiceTranscriptToInput,
      shouldSkipVoiceTranscriptCommit,
      parseSpeechRecognitionResultBuffers,
      stopVoiceRecognitionSafely,
      startVoiceRecognitionSafely,
      updateAIVoiceInputField,
      updateMobileQuickVoiceInputField,
      resetMobileQuickVoiceState,
      ensureAIVoiceRecognition,
      ensureMobileQuickVoiceRecognition,
      ensureDetailComposerRecognition,
      resolveDailyVoiceTargetEditor,
      ensureDailyVoiceLiveNode,
      updateDailyVoiceLiveTranscript,
      commitDailyVoiceLiveTranscript,
      setHomeVoiceStatus,
      renderHomeVoiceUI,
      renderHealthVoiceUI,
      handleNativeSpeechEvent,
      toggleHomeVoiceInput,
      toggleDailyVoiceInput,
      toggleDetailComposerVoiceInput,
      setDetailComposerVoiceStatus,
      renderDetailComposerVoiceUI,
      appendSpeechTextToDetailEditor,
      ensureDetailComposerLiveNode,
      updateDetailComposerLiveTranscript,
      commitDetailComposerLiveTranscript,
      finalizeAIVoiceInput,
      finalizeMobileQuickVoiceInput,
      startAIVoiceInput,
      startHealthVoiceInput,
      startMobileQuickVoiceInput,
      startDetailComposerVoiceInput,
    };
  }

  window.MorphVoiceRecognitionRuntime = {
    create: createVoiceRecognitionRuntime,
  };
})();
