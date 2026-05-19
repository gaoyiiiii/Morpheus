// @ts-check

(function initMorphMobilePressVoiceRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphMobilePressVoiceRuntime && window.MorphMobilePressVoiceRuntime.ready) return;

  const state = {
    voiceModeEnabled: false,
    capturing: false,
    awaitingNativeFinalize: false,
    cancelPending: false,
    pointerId: null,
    touchId: null,
    startX: 0,
    startY: 0,
    initialized: false,
    recognition: null,
    recognitionRunning: false,
    recognitionStopping: false,
    recognitionRestartTimer: 0,
    finalTranscript: '',
    interimTranscript: '',
    lastLiveText: '',
    sendRetryTimer: 0,
    activeProvider: '',
    nativeControlRunning: false,
    nativeBridgeBound: false,
    previousNativeSpeechEvent: null,
    previousNativeSpeechUpdate: null,
    captureSeq: 0,
  };

  const CANCEL_SWIPE_PX = 88;
  const SEND_RETRY_MAX_MS = 1400;

  function byId(id) {
    return document.getElementById(id);
  }

  function getStorageApi() {
    if (window.MorphStorage && typeof window.MorphStorage === 'object') return window.MorphStorage;
    if (window.LianXingStorage && typeof window.LianXingStorage === 'object') return window.LianXingStorage;
    return null;
  }

  function supportsSpeechRecognition() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function isLikelyIOSNativeRuntime() {
    try {
      if (document?.documentElement?.classList?.contains('ios-native-app')) return true;
    } catch (_) {}
    const ua = String(navigator?.userAgent || '');
    return /iPhone|iPad|iPod/i.test(ua);
  }

  function hasNativeControlBridge() {
    const storageApi = getStorageApi();
    return !!(storageApi && typeof storageApi.hasNativeControlBridge === 'function' && storageApi.hasNativeControlBridge());
  }

  function hasNativeControlSpeechToggle() {
    const storageApi = getStorageApi();
    return !!(storageApi
      && typeof storageApi.callNativeDesktopControl === 'function'
      && hasNativeControlBridge());
  }

  function hasNativeSpeechMessageBridge() {
    if (typeof window.postNativeSpeechMessage !== 'function') return false;
    if (typeof window.readNativeSpeechHandler === 'function') {
      try {
        return !!window.readNativeSpeechHandler();
      } catch (_) {
        return false;
      }
    }
    const handlers = window.webkit && window.webkit.messageHandlers;
    const bridge = handlers && handlers.morphNativeSpeech;
    return !!(bridge && typeof bridge.postMessage === 'function');
  }

  function resolvePreferredProvider() {
    if (isLikelyIOSNativeRuntime() && hasNativeControlSpeechToggle()) return 'native-control';
    if (hasNativeSpeechMessageBridge()) return 'native-message';
    if (supportsSpeechRecognition()) return 'web';
    return '';
  }

  function isMobileNavModeSafe() {
    return typeof window.isMobileNavMode === 'function' && window.isMobileNavMode();
  }

  function isShellVisible(shell) {
    if (!shell) return false;
    return !(shell.classList.contains('hidden') || shell.style.display === 'none');
  }

  function canUseVoiceRuntime() {
    return (
      isMobileNavModeSafe()
      && typeof window.submitMobileContextDetailInput === 'function'
      && !!resolvePreferredProvider()
    );
  }

  function autoPunctuate(text) {
    const normalized = String(text || '').trim();
    if (!normalized) return '';
    if (typeof window.autoPunctuateChineseText === 'function') {
      try {
        return String(window.autoPunctuateChineseText(normalized) || '').trim();
      } catch (_) {
        return normalized;
      }
    }
    return normalized;
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

  function clearTimer(name) {
    if (name === 'recognitionRestartTimer' && state.recognitionRestartTimer) {
      clearTimeout(state.recognitionRestartTimer);
      state.recognitionRestartTimer = 0;
      return;
    }
    if (name === 'sendRetryTimer' && state.sendRetryTimer) {
      clearTimeout(state.sendRetryTimer);
      state.sendRetryTimer = 0;
    }
  }

  function mergeTranscriptText() {
    return `${state.finalTranscript || ''}${state.interimTranscript || ''}`.trim();
  }

  function getVoiceTarget(kind = 'mobile') {
    if (kind === 'drawer') {
      return {
        kind,
        shell: byId('ai-chat-drawer-composer-shell'),
        container: byId('ai-chat-drawer-footer'),
        input: byId('ai-chat-drawer-input'),
        toggleBtn: byId('ai-chat-drawer-voice-toggle-btn'),
        toggleIcon: byId('ai-chat-drawer-voice-toggle-icon'),
        holdBtn: byId('ai-chat-drawer-voice-hold-btn'),
      };
    }
    return {
      kind: 'mobile',
      shell: byId('mobile-bottom-nav-input-shell'),
      container: byId('mobile-bottom-nav'),
      input: byId('mobile-detail-input'),
      toggleBtn: byId('mobile-detail-voice-toggle-btn'),
      toggleIcon: byId('mobile-detail-voice-toggle-icon'),
      holdBtn: byId('mobile-detail-voice-hold-btn'),
    };
  }

  function getAllVoiceTargets() {
    return [getVoiceTarget('mobile'), getVoiceTarget('drawer')];
  }

  function isRendered(el) {
    if (!el) return false;
    return !(el.classList.contains('hidden') || el.style.display === 'none');
  }

  function isDrawerVoiceTargetVisible() {
    if (!isMobileNavModeSafe() || !shouldKeepTranscriptInComposer()) return false;
    const target = getVoiceTarget('drawer');
    if (!target.shell || !target.input || !target.toggleBtn) return false;
    if (!isRendered(target.shell) || !isRendered(target.container)) return false;
    const drawer = byId('ai-chat-drawer');
    if (!drawer || !isRendered(drawer) || typeof drawer.getBoundingClientRect !== 'function') return true;
    const rect = drawer.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.right)) return true;
    return rect.right > 0 && rect.left < window.innerWidth;
  }

  function getActiveVoiceTarget() {
    if (isDrawerVoiceTargetVisible()) return getVoiceTarget('drawer');
    return getVoiceTarget('mobile');
  }

  function getDisplayTranscript() {
    const merged = mergeTranscriptText();
    if (merged) {
      const punctuated = autoPunctuate(merged);
      if (punctuated) {
        state.lastLiveText = punctuated;
        return punctuated;
      }
      state.lastLiveText = merged;
      return merged;
    }
    const inputText = String(getActiveVoiceTarget().input?.value || '').trim();
    if (inputText) {
      state.lastLiveText = inputText;
      return inputText;
    }
    return String(state.lastLiveText || '').trim();
  }

  function writeTranscriptToInput(text) {
    const input = getActiveVoiceTarget().input;
    if (!input) return;
    input.value = String(text || '').trim();
  }

  function shouldKeepTranscriptInComposer() {
    return false;
  }

  function getReleaseActionTip() {
    return shouldKeepTranscriptInComposer()
      ? '松开填入，上滑取消'
      : '松开发送，上滑取消';
  }

  function finalizeTranscriptToComposer(text) {
    const normalized = String(text || '').trim();
    if (!normalized) return false;
    writeTranscriptToInput(normalized);
    const input = getActiveVoiceTarget().input;
    if (!input) return true;
    if (typeof window.requestComposerTextareaResize === 'function') {
      try {
        window.requestComposerTextareaResize(input, 120, {
          force: true,
          syncMobileQuickComposeButton: input.id === 'mobile-detail-input',
        });
      } catch (_) {}
    } else if (typeof window.syncMobileContextDetailInputState === 'function') {
      try {
        window.syncMobileContextDetailInputState();
      } catch (_) {}
    }
    if (typeof window.markUserEditingActivity === 'function') {
      try {
        window.markUserEditingActivity();
      } catch (_) {}
    }
    try {
      input.focus();
      const length = input.value.length;
      input.setSelectionRange?.(length, length);
    } catch (_) {}
    return true;
  }

  function setHoldText(text) {
    const holdBtn = getActiveVoiceTarget().holdBtn;
    if (!holdBtn) return;
    const normalized = String(text || '').trim();
    holdBtn.textContent = normalized || '按住说话';
  }

  function setPanelTranscript(text) {
    const transcript = byId('mobile-voice-hold-transcript');
    if (!transcript) return;
    const normalized = String(text || '').trim();
    transcript.textContent = normalized || '正在听你说...';
  }

  function setPanelTip(text) {
    const tip = byId('mobile-voice-hold-tip');
    if (!tip) return;
    tip.textContent = String(text || '').trim() || '松开发送，上滑取消';
  }

  function refreshLucide(root) {
    if (typeof window.requestLucideRefresh === 'function') {
      window.requestLucideRefresh({ root: root || document.body });
    }
  }

  function triggerHapticFeedback(pattern = 16) {
    const shouldUseNativeHaptic = isLikelyIOSNativeRuntime() && hasNativeControlSpeechToggle();
    if (shouldUseNativeHaptic) {
      const storageApi = getStorageApi();
      if (storageApi && typeof storageApi.callNativeDesktopControl === 'function') {
        try {
          Promise.resolve(storageApi.callNativeDesktopControl('hapticImpact', { style: 'light', forceVibrate: false }))
            .catch(() => {});
        } catch (_) {}
      }
    }

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  }

  function syncVoicePanelPosition() {
    const nav = byId('mobile-bottom-nav');
    const panel = byId('mobile-voice-hold-panel');
    if (!nav || !panel) return;

    const rect = nav.getBoundingClientRect();
    if (!Number.isFinite(rect.top) || !Number.isFinite(rect.left) || !Number.isFinite(rect.right)) return;

    const bottom = Math.max(12, Math.round(window.innerHeight - rect.top + 10));
    const left = Math.max(8, Math.round(rect.left));
    const right = Math.max(8, Math.round(window.innerWidth - rect.right));

    panel.style.bottom = `${bottom}px`;
    panel.style.left = `${left}px`;
    panel.style.right = `${right}px`;
  }

  function syncUI() {
    const nav = byId('mobile-bottom-nav');
    const panel = byId('mobile-voice-hold-panel');
    const activeTarget = getActiveVoiceTarget();
    const shell = activeTarget.shell;
    const toggleBtn = activeTarget.toggleBtn;
    const toggleIcon = activeTarget.toggleIcon;

    if (!shell || !toggleBtn || !panel) return;

    getAllVoiceTargets().forEach((target) => {
      if (!target.toggleBtn || target.kind === activeTarget.kind) return;
      target.toggleBtn.classList.add('hidden');
      target.toggleBtn.style.display = 'none';
      target.shell?.classList.remove('voice-mode-enabled', 'voice-capturing');
    });

    const navVisible = !!nav && nav.style.display !== 'none' && !nav.classList.contains('hidden');
    const showInCurrentLayout = activeTarget.kind === 'mobile'
      ? (navVisible && isShellVisible(shell))
      : (isShellVisible(shell) && isDrawerVoiceTargetVisible());

    if (!showInCurrentLayout && state.capturing) {
      stopCapture({ cancel: true, reason: 'layout-hide' });
    }

    if (!showInCurrentLayout) {
      toggleBtn.classList.add('hidden');
      toggleBtn.style.display = 'none';
      panel.classList.add('hidden');
      panel.classList.remove('wave-live', 'cancel-pending');
      shell.classList.remove('voice-mode-enabled', 'voice-capturing');
      return;
    }

    toggleBtn.classList.remove('hidden');
    toggleBtn.style.display = 'inline-flex';

    const runtimeAvailable = canUseVoiceRuntime();
    toggleBtn.classList.toggle('opacity-60', !runtimeAvailable);
    toggleBtn.classList.toggle('cursor-not-allowed', !runtimeAvailable);

    if (!runtimeAvailable && state.voiceModeEnabled) {
      state.voiceModeEnabled = false;
      state.cancelPending = false;
    }

    shell.classList.toggle('voice-mode-enabled', state.voiceModeEnabled);
    shell.classList.toggle('voice-capturing', state.capturing);

    const iconName = state.voiceModeEnabled ? 'keyboard' : 'audio-lines';
    toggleBtn.setAttribute('aria-label', state.voiceModeEnabled ? '切换到键盘输入' : '切换到语音输入');
    toggleBtn.setAttribute('title', state.voiceModeEnabled ? '键盘输入' : '语音输入');
    if (toggleIcon) toggleIcon.setAttribute('data-lucide', iconName);
    refreshLucide(toggleBtn);

    if (!state.voiceModeEnabled) {
      setHoldText('按住说话');
      setPanelTranscript('按住说话，松开发送');
      setPanelTip(getReleaseActionTip());
      panel.classList.add('hidden');
      panel.classList.remove('wave-live', 'cancel-pending');
      panel.setAttribute('aria-hidden', 'true');
      syncVoicePanelPosition();
      return;
    }

    if (!state.capturing) {
      setHoldText('按住说话');
      panel.classList.add('hidden');
      panel.classList.remove('wave-live', 'cancel-pending');
      panel.setAttribute('aria-hidden', 'true');
      syncVoicePanelPosition();
      return;
    }

    const liveText = getDisplayTranscript() || '正在听你说...';
    setHoldText('按住说话');
    setPanelTranscript(liveText);
    setPanelTip(state.cancelPending ? '松手取消发送' : getReleaseActionTip());
    panel.classList.remove('hidden');
    panel.classList.add('wave-live');
    panel.classList.toggle('cancel-pending', state.cancelPending);
    panel.setAttribute('aria-hidden', 'false');
    syncVoicePanelPosition();
  }

  function clearTranscriptState({ clearInput = false } = {}) {
    state.finalTranscript = '';
    state.interimTranscript = '';
    state.lastLiveText = '';
    state.awaitingNativeFinalize = false;
    if (clearInput) writeTranscriptToInput('');
  }

  function normalizeNativeEventName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'stop') return 'end';
    return normalized;
  }

  function applyNativeTranscript(text, { isFinal = false } = {}) {
    const normalized = String(text || '').trim();
    if (!normalized) return;
    if (isFinal) {
      state.finalTranscript = normalized;
      state.interimTranscript = '';
    } else {
      state.interimTranscript = normalized;
    }
  }

  function showVoiceUnavailableNotice(message = '') {
    if (typeof window.openCustomModal === 'function') {
      window.openCustomModal({
        title: '语音暂不可用',
        desc: String(message || '').trim() || '当前环境不支持语音识别，或未开启麦克风权限。',
      });
    }
  }

  function handleNativeBridgeEvent(eventName, payload = {}) {
    const event = normalizeNativeEventName(eventName);
    if (!event) return false;

    const canHandle = state.capturing || state.awaitingNativeFinalize;
    const provider = state.activeProvider;
    if (!canHandle || (provider !== 'native-control' && provider !== 'native-message')) {
      return false;
    }

    const safePayload = payload && typeof payload === 'object' ? payload : {};
    if (event === 'start') {
      state.recognitionRunning = true;
      if (provider === 'native-control') state.nativeControlRunning = true;
      syncUI();
      return true;
    }

    if (event === 'partial') {
      applyNativeTranscript(safePayload.text, { isFinal: false });
      syncUI();
      return true;
    }

    if (event === 'final') {
      applyNativeTranscript(safePayload.text, { isFinal: true });
      syncUI();
      return true;
    }

    if (event === 'end') {
      state.recognitionRunning = false;
      state.nativeControlRunning = false;
      if (safePayload.text) applyNativeTranscript(safePayload.text, { isFinal: true });
      state.awaitingNativeFinalize = false;
      if (!state.capturing) state.activeProvider = '';
      syncUI();
      return true;
    }

    if (event === 'error') {
      state.recognitionRunning = false;
      state.nativeControlRunning = false;
      state.awaitingNativeFinalize = false;
      if (!state.capturing) state.activeProvider = '';
      const message = String(safePayload.message || '').trim();
      if (state.capturing) {
        state.capturing = false;
        state.cancelPending = false;
        clearTranscriptState({ clearInput: true });
        state.activeProvider = '';
        syncUI();
      }
      if (message) showVoiceUnavailableNotice(message);
      return true;
    }

    return false;
  }

  function bindNativeSpeechBridgeOnce() {
    if (state.nativeBridgeBound) return;

    const previousEvent = typeof window.MorphNativeSpeechEvent === 'function'
      ? window.MorphNativeSpeechEvent
      : null;
    const previousUpdate = typeof window.MorphNativeSpeechUpdate === 'function'
      ? window.MorphNativeSpeechUpdate
      : null;

    state.previousNativeSpeechEvent = previousEvent;
    state.previousNativeSpeechUpdate = previousUpdate;

    const wrappedEvent = function wrappedNativeSpeechEvent(eventName, payload) {
      const handled = handleNativeBridgeEvent(eventName, payload);
      if (!handled && typeof previousEvent === 'function') {
        return previousEvent(eventName, payload);
      }
      if (!state.capturing && !state.awaitingNativeFinalize && typeof previousEvent === 'function') {
        return previousEvent(eventName, payload);
      }
      return undefined;
    };

    const wrappedUpdate = function wrappedNativeSpeechUpdate(payload) {
      const type = String(payload?.type || '').trim();
      const handled = handleNativeBridgeEvent(type, payload);
      if (!handled && typeof previousUpdate === 'function') {
        return previousUpdate(payload);
      }
      if (!state.capturing && !state.awaitingNativeFinalize && typeof previousUpdate === 'function') {
        return previousUpdate(payload);
      }
      return undefined;
    };

    window.MorphNativeSpeechEvent = wrappedEvent;
    window.LianXingNativeSpeechEvent = wrappedEvent;
    window.MorphNativeSpeechUpdate = wrappedUpdate;
    window.LianXingNativeSpeechUpdate = wrappedUpdate;

    state.nativeBridgeBound = true;
  }

  function stopRecognitionSafely() {
    clearTimer('recognitionRestartTimer');
    state.recognitionStopping = true;
    const recognition = state.recognition;
    if (!recognition) return;
    try { recognition.stop(); } catch (_) {}
  }

  function startRecognitionSafely() {
    const recognition = ensureRecognition();
    if (!recognition) return false;

    state.recognitionStopping = false;
    try {
      recognition.start();
      return true;
    } catch (_) {
      if (state.recognitionRunning) return true;
      return false;
    }
  }

  function ensureRecognition() {
    if (state.recognition) return state.recognition;
    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechAPI) return null;

    const recognition = new SpeechAPI();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.recognitionRunning = true;
      state.recognitionStopping = false;
    };

    recognition.onresult = (event) => {
      const { finalBuffer, interimBuffer } = parseSpeechRecognitionResultBuffers(event);
      if (finalBuffer) state.finalTranscript += finalBuffer;
      state.interimTranscript = interimBuffer;
      syncUI();
    };

    recognition.onerror = () => {
      state.recognitionRunning = false;
    };

    recognition.onend = () => {
      state.recognitionRunning = false;
      if (state.capturing && !state.recognitionStopping) {
        clearTimer('recognitionRestartTimer');
        state.recognitionRestartTimer = window.setTimeout(() => {
          if (!state.capturing || state.recognitionStopping) return;
          startRecognitionSafely();
        }, 140);
      }
    };

    state.recognition = recognition;
    return recognition;
  }

  function clearCapturePointerState() {
    state.pointerId = null;
    state.touchId = null;
    state.startX = 0;
    state.startY = 0;
  }

  function startNativeMessageRecognition() {
    bindNativeSpeechBridgeOnce();
    state.recognitionStopping = false;
    if (typeof window.postNativeSpeechMessage !== 'function') return false;
    try {
      const posted = window.postNativeSpeechMessage('startRecognition', { locale: 'zh-CN' });
      if (posted) {
        state.recognitionRunning = true;
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  async function startNativeControlRecognition(captureSeq) {
    bindNativeSpeechBridgeOnce();
    const storageApi = getStorageApi();
    if (!storageApi || typeof storageApi.callNativeDesktopControl !== 'function') return false;
    try {
      let result = await storageApi.callNativeDesktopControl('speechToggle', {});
      let running = result?.running === true;
      if (!running && captureSeq === state.captureSeq && state.capturing) {
        result = await storageApi.callNativeDesktopControl('speechToggle', {});
        running = result?.running === true;
      }
      state.nativeControlRunning = running;
      state.recognitionRunning = running;
      return running;
    } catch (_) {
      state.nativeControlRunning = false;
      state.recognitionRunning = false;
      return false;
    }
  }

  function startCaptureProvider(provider, captureSeq) {
    if (provider === 'web') return startRecognitionSafely();
    if (provider === 'native-message') return startNativeMessageRecognition();
    if (provider === 'native-control') return startNativeControlRecognition(captureSeq);
    return false;
  }

  async function stopNativeControlRecognition({ force = false } = {}) {
    const storageApi = getStorageApi();
    if (!storageApi || typeof storageApi.callNativeDesktopControl !== 'function') return;
    if (!force && !state.nativeControlRunning && !state.recognitionRunning) return;
    try {
      const result = await storageApi.callNativeDesktopControl('speechToggle', {});
      state.nativeControlRunning = result?.running === true;
      if (!state.nativeControlRunning) state.recognitionRunning = false;
    } catch (_) {
      state.nativeControlRunning = false;
      state.recognitionRunning = false;
    }
  }

  function stopActiveProviderRecognition(provider, options = {}) {
    const active = String(provider || '').trim();
    if (!active) return;

    clearTimer('recognitionRestartTimer');
    state.recognitionStopping = true;

    if (active === 'web') {
      stopRecognitionSafely();
      return;
    }

    if (active === 'native-message') {
      try {
        if (typeof window.postNativeSpeechMessage === 'function') {
          window.postNativeSpeechMessage('stopRecognition', {});
        }
      } catch (_) {}
      state.recognitionRunning = false;
      return;
    }

    if (active === 'native-control') {
      void stopNativeControlRecognition(options);
    }
  }

  function finalizeProviderStart(provider, captureSeq, started) {
    if (!started) {
      if (captureSeq !== state.captureSeq) return;
      if (!state.capturing) return;
      state.capturing = false;
      state.cancelPending = false;
      state.activeProvider = '';
      clearTranscriptState({ clearInput: true });
      syncUI();
      showVoiceUnavailableNotice();
      return;
    }

    if (captureSeq !== state.captureSeq) {
      stopActiveProviderRecognition(provider, { force: true });
      return;
    }

    if (!state.capturing) {
      stopActiveProviderRecognition(provider, { force: true });
      return;
    }

    syncUI();
  }

  function beginCapture(clientX, clientY) {
    if (!state.voiceModeEnabled) return false;
    if (!canUseVoiceRuntime()) {
      showVoiceUnavailableNotice();
      return false;
    }
    if (state.capturing) return true;

    const provider = resolvePreferredProvider();
    if (!provider) {
      showVoiceUnavailableNotice();
      return false;
    }

    clearTimer('sendRetryTimer');
    clearTranscriptState({ clearInput: true });

    state.capturing = true;
    state.awaitingNativeFinalize = false;
    state.cancelPending = false;
    state.startX = Number(clientX) || 0;
    state.startY = Number(clientY) || 0;
    state.activeProvider = provider;
    state.captureSeq += 1;
    const seq = state.captureSeq;

    triggerHapticFeedback(18);

    const started = startCaptureProvider(provider, seq);
    if (typeof started === 'boolean') {
      if (!started) {
        state.capturing = false;
        state.activeProvider = '';
        syncUI();
        showVoiceUnavailableNotice();
        return false;
      }
    } else if (started && typeof started.then === 'function') {
      started.then((ok) => {
        finalizeProviderStart(provider, seq, !!ok);
      });
    }

    setHoldText('按住说话');
    setPanelTranscript('正在听你说...');
    setPanelTip(getReleaseActionTip());
    syncUI();
    return true;
  }

  function updateCancelByPoint(clientX, clientY) {
    if (!state.capturing) return;
    const dx = (Number(clientX) || 0) - state.startX;
    const dy = (Number(clientY) || 0) - state.startY;
    const verticalCancel = dy < -CANCEL_SWIPE_PX;
    const steepEnough = Math.abs(dy) >= Math.abs(dx) * 0.65;
    state.cancelPending = verticalCancel && steepEnough;
    syncUI();
  }

  function commitTranscriptWhenReady({ autoSubmit = true } = {}) {
    clearTimer('sendRetryTimer');
    const startedAt = Date.now();

    const trySend = () => {
      const input = getActiveVoiceTarget().input;
      const text = String(input?.value || '').trim() || getDisplayTranscript();
      const shouldWaitForNativeTail = state.awaitingNativeFinalize
        && (state.recognitionRunning || (Date.now() - startedAt < 260));
      if (shouldWaitForNativeTail) {
        state.sendRetryTimer = window.setTimeout(trySend, 70);
        return;
      }
      if (text) {
        finalizeTranscriptToComposer(text);
        state.awaitingNativeFinalize = false;
        state.activeProvider = '';
        if (autoSubmit) {
          if (typeof window.submitActiveMobileVoiceInput === 'function') {
            window.submitActiveMobileVoiceInput();
          } else if (typeof window.submitMobileContextDetailInput === 'function') {
            window.submitMobileContextDetailInput();
          }
        }
        return;
      }
      if (Date.now() - startedAt > SEND_RETRY_MAX_MS) {
        state.awaitingNativeFinalize = false;
        state.activeProvider = '';
        return;
      }
      state.sendRetryTimer = window.setTimeout(trySend, 90);
    };

    trySend();
  }

  function stopCapture({ cancel = false, reason = '' } = {}) {
    if (!state.capturing) return;
    const shouldCancel = cancel || state.cancelPending;
    const provider = state.activeProvider;

    state.capturing = false;
    state.cancelPending = false;

    if (!shouldCancel && (provider === 'native-control' || provider === 'native-message')) {
      state.awaitingNativeFinalize = true;
    } else {
      state.awaitingNativeFinalize = false;
    }

    stopActiveProviderRecognition(provider, { force: false });

    if (shouldCancel) {
      state.awaitingNativeFinalize = false;
      clearTranscriptState({ clearInput: true });
      setHoldText('按住说话');
      setPanelTranscript(reason === 'layout-hide' ? '已中断' : '已取消');
      setPanelTip(shouldKeepTranscriptInComposer() ? '按住说话，松开填入' : '按住说话，松开发送');
      state.activeProvider = '';
      syncUI();
      return;
    }

    commitTranscriptWhenReady({ autoSubmit: !shouldKeepTranscriptInComposer() });
    syncUI();
  }

  function handleToggleClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!state.voiceModeEnabled) {
      if (!canUseVoiceRuntime()) {
        showVoiceUnavailableNotice();
        return;
      }
      state.voiceModeEnabled = true;
      syncUI();
      return;
    }

    if (state.capturing) {
      stopCapture({ cancel: true, reason: 'mode-switch' });
    }
    state.voiceModeEnabled = false;
    clearTranscriptState({ clearInput: false });
    syncUI();
  }

  function bindHoldButtonEvents(holdBtn) {
    if (!holdBtn || holdBtn.dataset.voiceHoldBound === '1') return;
    holdBtn.dataset.voiceHoldBound = '1';

    holdBtn.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    holdBtn.addEventListener('selectstart', (event) => {
      event.preventDefault();
    });
    holdBtn.addEventListener('dragstart', (event) => {
      event.preventDefault();
    });

    if (window.PointerEvent) {
      holdBtn.addEventListener('pointerdown', (event) => {
        if (!state.voiceModeEnabled) return;
        event.preventDefault();
        holdBtn.setPointerCapture?.(event.pointerId);
        state.pointerId = event.pointerId;
        beginCapture(event.clientX, event.clientY);
      });
      holdBtn.addEventListener('pointermove', (event) => {
        if (!state.capturing) return;
        if (state.pointerId !== null && event.pointerId !== state.pointerId) return;
        updateCancelByPoint(event.clientX, event.clientY);
      });
      const release = (event, options = {}) => {
        if (state.pointerId !== null && event.pointerId !== state.pointerId) return;
        event.preventDefault();
        clearCapturePointerState();
        stopCapture(options);
      };
      holdBtn.addEventListener('pointerup', (event) => release(event));
      holdBtn.addEventListener('pointercancel', (event) => release(event, { cancel: true, reason: 'pointer-cancel' }));
      holdBtn.addEventListener('lostpointercapture', (event) => {
        if (!state.capturing) return;
        release(event, { cancel: true, reason: 'capture-lost' });
      });
      return;
    }

    holdBtn.addEventListener('touchstart', (event) => {
      if (!state.voiceModeEnabled) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      event.preventDefault();
      state.touchId = touch.identifier;
      beginCapture(touch.clientX, touch.clientY);
    }, { passive: false });

    holdBtn.addEventListener('touchmove', (event) => {
      if (!state.capturing) return;
      const list = Array.from(event.changedTouches || []);
      const touch = list.find((item) => item.identifier === state.touchId);
      if (!touch) return;
      event.preventDefault();
      updateCancelByPoint(touch.clientX, touch.clientY);
    }, { passive: false });

    const touchEnd = (event, options = {}) => {
      if (!state.capturing) return;
      const list = Array.from(event.changedTouches || []);
      const touch = list.find((item) => item.identifier === state.touchId);
      if (!touch) return;
      event.preventDefault();
      clearCapturePointerState();
      stopCapture(options);
    };

    holdBtn.addEventListener('touchend', (event) => touchEnd(event), { passive: false });
    holdBtn.addEventListener('touchcancel', (event) => touchEnd(event, { cancel: true, reason: 'touch-cancel' }), { passive: false });
  }

  function wrapLifecycleSyncFunctions() {
    ['syncMobileContextDetailInputState', 'syncMobileQuickComposeButton'].forEach((name) => {
      const fn = window[name];
      if (typeof fn !== 'function' || fn.__mobileVoiceWrapped === true) return;
      const wrapped = function wrappedMobileVoiceSync(...args) {
        const result = fn.apply(this, args);
        syncUI();
        return result;
      };
      wrapped.__mobileVoiceWrapped = true;
      window[name] = wrapped;
    });
  }

  function bindEvents() {
    const targets = getAllVoiceTargets().filter((target) => target.toggleBtn || target.holdBtn);
    if (!targets.length) return false;

    targets.forEach((target) => {
      if (target.toggleBtn && target.toggleBtn.dataset.voiceToggleBound !== '1') {
        target.toggleBtn.dataset.voiceToggleBound = '1';
        target.toggleBtn.addEventListener('click', handleToggleClick, { passive: false });
      }
      bindHoldButtonEvents(target.holdBtn);
    });

    window.addEventListener('resize', syncUI, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.capturing) {
        stopCapture({ cancel: true, reason: 'app-hidden' });
      }
      syncUI();
    });

    return true;
  }

  function initialize() {
    if (state.initialized) {
      syncUI();
      return;
    }

    wrapLifecycleSyncFunctions();
    bindNativeSpeechBridgeOnce();
    if (!bindEvents()) {
      window.setTimeout(initialize, 160);
      return;
    }

    state.initialized = true;
    syncUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }

  window.MorphMobilePressVoiceRuntime = {
    ready: true,
    syncUI,
    stopCapture,
  };
})();
