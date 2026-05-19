(function initMorphLocalPluginWorkspaceRuntime() {
    function createLocalPluginWorkspaceRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    let cachedReadmes = {};
    const expenseLedgerViewState = {
      range: 'month',
      customStart: '',
      customEnd: '',
      anchorDate: '',
      activeBucketKey: '',
      detailModalOpen: false,
      calendarScrollLeft: 0,
      type: 'all',
      query: '',
    };
    const expenseLedgerImportState = {
      phase: 'idle',
      text: '',
      imported: 0,
      deduped: 0,
      fixed: 0,
      recovered: 0,
      aiRefined: 0,
    };
    const expenseLedgerEditorState = {
      recordId: '',
      draft: null,
    };
    const expenseLedgerManualDraftState = {
      open: false,
      draft: null,
      focusTarget: 'item',
      compositionTarget: '',
      categoryMenuOpen: false,
      categoryQuery: '',
      customCategoryOpen: false,
      statusText: '',
      statusError: false,
    };
    let expenseLedgerEmbeddedRenderSequence = 0;
    const sopWorkspaceState = {
      query: '',
      scenario: 'all',
      selectedId: '',
      mode: 'view',
      draft: null,
      execution: null,
      statusText: '',
      statusError: false,
    };
    const visualOrganizerComposerState = {
      prompt: '',
      templateKey: 'auto',
      busy: false,
      statusText: '',
      statusError: false,
      suppressStarterAutocreate: false,
    };
    const visualOrganizerVoiceState = {
      available: false,
      running: false,
      recognition: null,
      finalText: '',
      interimText: '',
    };
    const visualOrganizerEditorState = {
      organizerId: '',
      selectionType: 'meta',
      sectionIndex: -1,
      itemIndex: -1,
      statusText: '',
      statusTone: 'neutral',
    };
    const visualOrganizerDragState = {
      type: '',
      sectionIndex: -1,
      itemIndex: -1,
    };
    const visualOrganizerManualDraftState = {
      organizerId: '',
      title: '',
      summary: '',
      mermaidSource: '',
      dirty: false,
      lastRenderedSource: '',
      renderError: '',
    };
    const visualOrganizerExcalidrawState = {
      loaderPromise: null,
      container: null,
      organizerId: '',
      sceneFingerprint: '',
    };
    const visualOrganizerOverlayState = {
      panels: {
        assistant: { x: null, y: null, collapsed: false },
      },
      dragging: {
        panelKey: '',
        offsetX: 0,
        offsetY: 0,
      },
      listenersBound: false,
    };
    const CODEX_REMOTE_PLUGIN_ID = 'codex-remote-plugin';
    const CODEX_REMOTE_DEFAULT_THREAD_ID = '019d374a-40dc-7aa2-8a94-ada1de72dc31';
    const WECHAT_ARTICLE_FORMATTER_PLUGIN_ID = 'wechat-article-formatter';
    const jcringPluginState = {
      connected: false,
      connecting: false,
      deviceName: '',
      device: null,
      gattServer: null,
      heartRate: null,
      battery: null,
      error: '',
      lastUpdate: null,
      hrCharRef: null,
      batCharRef: null,
      pollTimerId: null,
      nativeDeviceId: null,
      useNativeBridge: false,
    };
    let mermaidLoaderPromise = null;
    let localPluginWorkspaceScrollTop = 0;
    let sopWorkspaceStatusTimer = null;
    let sopCodecRuntimeModules = null;
    let localPluginShellRuntimeModules = null;
    let localPluginCodexRemoteRuntimeModules = null;
    let pomodoroPluginRuntimeModules = null;
    let wechatArticleFormatterRuntimeModules = null;
    let localPluginExpenseLedgerImportRuntimeModules = null;
    let localPluginExpenseLedgerRenderRuntimeModules = null;
    let localPluginExpenseLedgerHostRuntimeModules = null;
    let localPluginExpenseLedgerMutationRuntimeModules = null;
    let localPluginExpenseLedgerDraftRuntimeModules = null;
    let localPluginExpenseLedgerViewRuntimeModules = null;
    let localPluginExpenseLedgerAnalyticsRuntimeModules = null;
    let localPluginExpenseLedgerContentRuntimeModules = null;
    let sopCodecFallbackModules = null;
    let pomodoroWorkspaceTicker = null;
    const wechatArticleFormatterViewState = {
      statusText: '复制后直接粘贴到公众号官方编辑器；微信二次清洗部分样式属于正常现象。',
      statusTone: 'neutral',
    };

    function getSopCodecRuntimeModules() {
      if (sopCodecRuntimeModules) return sopCodecRuntimeModules;
      const factory = window.MorphSopCodecRuntime && typeof window.MorphSopCodecRuntime.create === 'function'
        ? window.MorphSopCodecRuntime.create
        : null;
      if (!factory) return null;
      sopCodecRuntimeModules = factory({
        generateId: createRuntimeId,
        now: () => new Date().toISOString(),
      });
      return sopCodecRuntimeModules;
    }

    function getSopCodecFallbackModules() {
      if (sopCodecFallbackModules) return sopCodecFallbackModules;
      const normalizeText = (value = '') => String(value || '').replace(/\r\n/g, '\n').trim();
      const splitLines = (value = '') => normalizeText(value)
        .split('\n')
        .map((line) => String(line || '').replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
        .filter(Boolean);
      const normalizeEntryList = (rawList = [], fallbackBlocks = [], kind = 'step') => {
        const source = Array.isArray(rawList) && rawList.length
          ? rawList
          : (Array.isArray(fallbackBlocks) && kind === 'step' ? fallbackBlocks : []);
        return source.map((entry, index) => {
          const raw = entry && typeof entry === 'object' ? entry : {};
          const text = normalizeText(typeof entry === 'string' ? entry : (raw.text || raw.content || raw.title || ''));
          if (!text) return null;
          return {
            id: String(raw.id || '').trim() || createRuntimeId(kind === 'step' ? 'sop_step_' : 'sop_check_'),
            text,
            done: raw.done === true || raw.checked === true,
            note: normalizeText(raw.note || ''),
            order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
          };
        }).filter(Boolean);
      };
      const normalizeExecutions = (rawList = []) => Array.isArray(rawList)
        ? rawList.map((entry) => {
            const raw = entry && typeof entry === 'object' ? entry : {};
            return {
              id: String(raw.id || '').trim() || createRuntimeId('sop_run_'),
              startedAt: String(raw.startedAt || '').trim(),
              completedAt: String(raw.completedAt || '').trim(),
              checkedStepIds: Array.isArray(raw.checkedStepIds) ? raw.checkedStepIds.map((item) => String(item || '').trim()).filter(Boolean) : [],
              checkedChecklistIds: Array.isArray(raw.checkedChecklistIds) ? raw.checkedChecklistIds.map((item) => String(item || '').trim()).filter(Boolean) : [],
              note: normalizeText(raw.note || ''),
            };
          }).filter((entry) => entry.id)
        : [];
      const normalizeItem = (rawItem = null, index = 0) => {
        const raw = rawItem && typeof rawItem === 'object' ? rawItem : {};
        const metadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
        return {
          id: String(raw.id || '').trim() || createRuntimeId('sop_'),
          name: normalizeText(raw.name || raw.title || '') || `SOP ${index + 1}`,
          description: normalizeText(raw.description || raw.summary || raw.text || ''),
          status: String(raw.status || 'active').trim() || 'active',
          createdAt: String(raw.createdAt || '').trim(),
          updatedAt: String(raw.updatedAt || raw.createdAt || '').trim(),
          tags: Array.isArray(raw.tags) ? raw.tags.map((item) => normalizeText(item)).filter(Boolean) : [],
          metadata: {
            scenario: normalizeText(metadata.scenario || metadata.scene || ''),
            trigger: normalizeText(metadata.trigger || ''),
            steps: normalizeEntryList(metadata.steps, raw.blocks, 'step'),
            checklist: normalizeEntryList(metadata.checklist, [], 'check'),
            relatedRefs: Array.isArray(metadata.relatedRefs)
              ? metadata.relatedRefs.map((item) => normalizeText(item)).filter(Boolean)
              : [],
            executions: normalizeExecutions(metadata.executions),
          },
        };
      };
      const serializeItem = (item = null) => {
        const normalized = normalizeItem(item, 0);
        const blocks = normalized.metadata.steps.map((step, index) => ({
          id: String(step.id || '').trim() || createRuntimeId('sop_block_'),
          type: 'todo',
          text: step.text,
          checked: false,
          order: index,
          metadata: { kind: 'step' },
        }));
        return {
          ...normalized,
          createdAt: normalized.createdAt || new Date().toISOString(),
          updatedAt: normalized.updatedAt || new Date().toISOString(),
          blocks: blocks.length ? blocks : (normalized.description ? [{
            id: createRuntimeId('sop_block_'),
            type: 'p',
            text: normalized.description,
            checked: false,
            order: 0,
            metadata: { kind: 'note' },
          }] : []),
        };
      };
      const buildDraftFromItem = (item = null) => {
        const normalized = item ? normalizeItem(item, 0) : null;
        return {
          id: normalized?.id || '',
          name: normalized?.name || '',
          description: normalized?.description || '',
          scenario: normalized?.metadata?.scenario || '',
          trigger: normalized?.metadata?.trigger || '',
          stepsText: Array.isArray(normalized?.metadata?.steps) ? normalized.metadata.steps.map((step) => step.text).join('\n') : '',
          checklistText: Array.isArray(normalized?.metadata?.checklist) ? normalized.metadata.checklist.map((step) => step.text).join('\n') : '',
          relatedRefsText: Array.isArray(normalized?.metadata?.relatedRefs) ? normalized.metadata.relatedRefs.join('\n') : '',
          tagsText: Array.isArray(normalized?.tags) ? normalized.tags.join(', ') : '',
        };
      };

      sopCodecFallbackModules = {
        normalizeSopText: normalizeText,
        splitSopLines: splitLines,
        normalizeSopEntryList: normalizeEntryList,
        normalizeSopExecutions: normalizeExecutions,
        normalizeSopItem: normalizeItem,
        serializeSopItem: serializeItem,
        buildSopDraftFromItem: buildDraftFromItem,
      };
      return sopCodecFallbackModules;
    }

    function getSopCodecModules() {
      return getSopCodecRuntimeModules() || getSopCodecFallbackModules();
    }

    function getLocalPluginShellRuntimeModules() {
      if (localPluginShellRuntimeModules) return localPluginShellRuntimeModules;
      const factory = window.MorphLocalPluginShellRuntime && typeof window.MorphLocalPluginShellRuntime.create === 'function'
        ? window.MorphLocalPluginShellRuntime.create
        : null;
      if (!factory) return null;
      localPluginShellRuntimeModules = factory({
        escapeHTML,
        getDocument: () => document,
        getWorkspaceShellById: (extensionId) => {
          const id = String(extensionId || '').trim();
          if (!id || typeof api.getIntegratedExtensionWorkspaceShell !== 'function') return {};
          return api.getIntegratedExtensionWorkspaceShell(id) || {};
        },
        getWorkspaceHeaderActionsById: (extensionId) => {
          const id = String(extensionId || '').trim();
          if (!id || typeof api.getIntegratedExtensionWorkspaceHeaderActions !== 'function') return [];
          const actions = api.getIntegratedExtensionWorkspaceHeaderActions(id);
          return Array.isArray(actions) ? actions : [];
        },
      });
      return localPluginShellRuntimeModules;
    }

    function getLocalPluginCodexRemoteRuntimeModules() {
      if (localPluginCodexRemoteRuntimeModules) return localPluginCodexRemoteRuntimeModules;
      const factory = window.MorphLocalPluginCodexRemoteRuntime && typeof window.MorphLocalPluginCodexRemoteRuntime.create === 'function'
        ? window.MorphLocalPluginCodexRemoteRuntime.create
        : null;
      if (!factory) return null;
      localPluginCodexRemoteRuntimeModules = factory({
        pluginId: CODEX_REMOTE_PLUGIN_ID,
        defaultThreadId: CODEX_REMOTE_DEFAULT_THREAD_ID,
        getWindowRef: () => (typeof window !== 'undefined' ? window : null),
        getLocalStorage: () => (typeof localStorage !== 'undefined' ? localStorage : null),
        getFetch: () => (typeof fetch === 'function' ? fetch : null),
        escapeHTML,
        escapeJSString,
        resolveWorkspaceShellCopy,
        renderWorkspaceShell,
        buildWorkspaceHeaderActions,
        restoreLocalPluginWorkspaceScroll,
        requestLucideRefresh: (options = {}) => {
          if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh(options);
        },
        getExtensionPrivateState: (extensionId) => (
          typeof api.getExtensionPrivateState === 'function'
            ? api.getExtensionPrivateState(extensionId)
            : {}
        ),
        setExtensionPrivateState: (extensionId, updater, options = {}) => {
          if (typeof api.setExtensionPrivateState === 'function') {
            api.setExtensionPrivateState(extensionId, updater, options);
          }
        },
        rerenderWorkspace: () => {
          if (getSelectedPluginId() !== CODEX_REMOTE_PLUGIN_ID) return;
          void renderView();
        },
      });
      return localPluginCodexRemoteRuntimeModules;
    }

    function getPomodoroPluginRuntimeModules() {
      if (pomodoroPluginRuntimeModules) return pomodoroPluginRuntimeModules;
      const factory = window.MorphPomodoroPluginRuntime && typeof window.MorphPomodoroPluginRuntime.create === 'function'
        ? window.MorphPomodoroPluginRuntime.create
        : null;
      if (!factory) return null;
      pomodoroPluginRuntimeModules = factory({
        isExtensionEnabled: (extensionId) => {
          const rootData = typeof api.getData === 'function' ? api.getData() : null;
          const enabledMap = rootData?.morphRuntime?.userPreferences?.extensionsState;
          if (enabledMap && typeof enabledMap === 'object') {
            return enabledMap[String(extensionId || '').trim()] === true;
          }
          return String(extensionId || '').trim() === 'pomodoro-plugin';
        },
        getData: () => (typeof api.getData === 'function' ? api.getData() : {}),
        getExtensionPrivateState: (extensionId) => (
          typeof api.getExtensionPrivateState === 'function'
            ? api.getExtensionPrivateState(extensionId)
            : {}
        ),
        setExtensionPrivateState: (extensionId, updater, options = {}) => {
          if (typeof api.setExtensionPrivateState === 'function') {
            api.setExtensionPrivateState(extensionId, updater, options);
          }
        },
      });
      return pomodoroPluginRuntimeModules;
    }

    function getWechatArticleFormatterRuntimeModules() {
      if (wechatArticleFormatterRuntimeModules) return wechatArticleFormatterRuntimeModules;
      const factory = window.MorphWechatArticleFormatterRuntime && typeof window.MorphWechatArticleFormatterRuntime.create === 'function'
        ? window.MorphWechatArticleFormatterRuntime.create
        : null;
      if (!factory) return null;
      wechatArticleFormatterRuntimeModules = factory({
        isExtensionEnabled: (extensionId) => {
          const rootData = typeof api.getData === 'function' ? api.getData() : null;
          const enabledMap = rootData?.morphRuntime?.userPreferences?.extensionsState;
          if (enabledMap && typeof enabledMap === 'object') {
            const value = enabledMap[String(extensionId || '').trim()];
            if (typeof value === 'boolean') return value;
          }
          return String(extensionId || '').trim() === WECHAT_ARTICLE_FORMATTER_PLUGIN_ID;
        },
        getExtensionPrivateState: (extensionId) => (
          typeof api.getExtensionPrivateState === 'function'
            ? api.getExtensionPrivateState(extensionId)
            : {}
        ),
        setExtensionPrivateState: (extensionId, updater, options = {}) => {
          if (typeof api.setExtensionPrivateState === 'function') {
            api.setExtensionPrivateState(extensionId, updater, options);
          }
        },
        getNavigatorRef: () => (typeof navigator !== 'undefined' ? navigator : null),
        getDocumentRef: () => (typeof document !== 'undefined' ? document : null),
        getClipboardItemCtor: () => (typeof ClipboardItem !== 'undefined' ? ClipboardItem : null),
        getBlobCtor: () => (typeof Blob !== 'undefined' ? Blob : null),
      });
      return wechatArticleFormatterRuntimeModules;
    }

    function getLocalPluginExpenseLedgerImportRuntimeModules() {
      if (localPluginExpenseLedgerImportRuntimeModules) return localPluginExpenseLedgerImportRuntimeModules;
      const factory = window.MorphExpenseLedgerImportRuntime && typeof window.MorphExpenseLedgerImportRuntime.create === 'function'
        ? window.MorphExpenseLedgerImportRuntime.create
        : null;
      if (!factory) return null;
      localPluginExpenseLedgerImportRuntimeModules = factory({
        previewExpenseLedgerCsvText: (...args) => (
          typeof api.previewExpenseLedgerCsvText === 'function' ? api.previewExpenseLedgerCsvText(...args) : { ok: false, message: 'CSV 预览功能暂不可用' }
        ),
        importExpenseLedgerCsvText: (...args) => (
          typeof api.importExpenseLedgerCsvText === 'function' ? api.importExpenseLedgerCsvText(...args) : { ok: false, message: 'CSV 导入功能暂不可用' }
        ),
        getImportState: () => ({ ...expenseLedgerImportState }),
        setImportState: (updater = null) => {
          const prev = { ...expenseLedgerImportState };
          const next = typeof updater === 'function' ? updater(prev) : updater;
          if (!next || typeof next !== 'object') return { ...expenseLedgerImportState };
          Object.assign(expenseLedgerImportState, next);
          return { ...expenseLedgerImportState };
        },
        rerenderImportUI: rerenderExpenseLedgerWorkspaceAndHost,
        syncImportFeedback: syncExpenseLedgerImportFeedback,
        requestAnimationFrame: (callback) => {
          if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
          if (typeof callback === 'function') callback();
          return 0;
        },
        setTimeout: (...args) => setTimeout(...args),
        clearTimeout: (...args) => clearTimeout(...args),
        readFileText: (file = null) => (file && typeof file.text === 'function' ? file.text() : Promise.resolve('')),
      });
      return localPluginExpenseLedgerImportRuntimeModules;
    }

    function getLocalPluginExpenseLedgerRenderRuntimeModules() {
      if (localPluginExpenseLedgerRenderRuntimeModules) return localPluginExpenseLedgerRenderRuntimeModules;
      const factory = window.MorphExpenseLedgerRenderRuntime && typeof window.MorphExpenseLedgerRenderRuntime.create === 'function'
        ? window.MorphExpenseLedgerRenderRuntime.create
        : null;
      if (!factory) return null;
      localPluginExpenseLedgerRenderRuntimeModules = factory({
        escapeHTML,
        escapeJSString,
        formatAmount,
        parseRecordDate,
        formatExpenseLedgerDayLabel,
        formatDateInputValue,
        startOfWeek,
        startOfMonth,
        addMonths,
        addDays,
        getWindowRef: () => (typeof window !== 'undefined' ? window : null),
        getDocument: () => (typeof document !== 'undefined' ? document : null),
      });
      return localPluginExpenseLedgerRenderRuntimeModules;
    }

    function getLocalPluginExpenseLedgerHostRuntimeModules() {
      if (localPluginExpenseLedgerHostRuntimeModules) return localPluginExpenseLedgerHostRuntimeModules;
      const factory = window.MorphExpenseLedgerHostRuntime && typeof window.MorphExpenseLedgerHostRuntime.create === 'function'
        ? window.MorphExpenseLedgerHostRuntime.create
        : null;
      if (!factory) return null;
      localPluginExpenseLedgerHostRuntimeModules = factory({
        getDocument: () => (typeof document !== 'undefined' ? document : null),
        getWindowRef: () => (typeof window !== 'undefined' ? window : null),
        requestAnimationFrame: (callback) => {
          if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
          if (typeof callback === 'function') callback();
          return 0;
        },
        getCalendarScrollLeft: () => expenseLedgerViewState.calendarScrollLeft,
        setCalendarScrollLeft: (value = 0) => {
          expenseLedgerViewState.calendarScrollLeft = Number(value || 0);
        },
        rerenderExpenseLedgerWorkspace,
        getManualFocusTarget: () => String(expenseLedgerManualDraftState.focusTarget || ''),
        hasManualDraft: () => expenseLedgerManualDraftState.open && !!expenseLedgerManualDraftState.draft,
        hasEditorDraft: () => isExpenseLedgerEditorModalActive(),
        buildManualModalHtml: buildExpenseLedgerManualModalHtml,
        requestLucideRefresh: (options = {}) => {
          if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh(options);
        },
        getDetailModalOpen: () => expenseLedgerViewState.detailModalOpen === true,
        getManualDraftOpen: () => expenseLedgerManualDraftState.open === true,
        buildDetailModalHtml: buildExpenseLedgerDetailModalHtml,
      });
      return localPluginExpenseLedgerHostRuntimeModules;
    }

    function getLocalPluginExpenseLedgerMutationRuntimeModules() {
      if (localPluginExpenseLedgerMutationRuntimeModules) return localPluginExpenseLedgerMutationRuntimeModules;
      const factory = window.MorphExpenseLedgerMutationRuntime && typeof window.MorphExpenseLedgerMutationRuntime.create === 'function'
        ? window.MorphExpenseLedgerMutationRuntime.create
        : null;
      if (!factory) return null;
      localPluginExpenseLedgerMutationRuntimeModules = factory({
        storage: api.storage,
        parseRecordDate,
        sanitizeExpenseLedgerExportSegment,
        getExpenseLedgerLedger,
        getExpenseLedgerViewState: () => expenseLedgerViewState,
        getExpenseLedgerEditorState: () => expenseLedgerEditorState,
        getExpenseLedgerManualDraftState: () => expenseLedgerManualDraftState,
        syncExpenseLedgerManualModalHost,
        clearExpenseLedgerDetailModalHost,
        rerenderExpenseLedgerWorkspaceAndHost,
        getOpenCustomModal: () => (typeof api.openCustomModal === 'function' ? api.openCustomModal : window.openCustomModal),
        shouldWaitForNativeBootstrap: () => (
          typeof api.shouldWaitForNativeBootstrap === 'function' ? api.shouldWaitForNativeBootstrap() : false
        ),
        ensureBootstrapShellState: () => (
          typeof api.ensureBootstrapShellState === 'function' ? api.ensureBootstrapShellState() : null
        ),
        ensureExpenseLedgerShape: (value) => (
          typeof api.ensureExpenseLedgerShape === 'function' ? api.ensureExpenseLedgerShape(value) : { categories: [], records: [] }
        ),
        getData: () => (typeof api.getData === 'function' ? api.getData() : null),
        writePluginFacingDataFile: (...args) => (
          typeof api.writePluginFacingDataFile === 'function' ? api.writePluginFacingDataFile(...args) : Promise.resolve(null)
        ),
        buildExpenseLedgerCsv: (...args) => (
          typeof api.buildExpenseLedgerCsv === 'function' ? api.buildExpenseLedgerCsv(...args) : ''
        ),
        buildExpenseLedgerSummaryCsv: (...args) => (
          typeof api.buildExpenseLedgerSummaryCsv === 'function' ? api.buildExpenseLedgerSummaryCsv(...args) : { byMonth: '' }
        ),
        buildCsvFromRows: (...args) => (
          typeof api.buildCsvFromRows === 'function' ? api.buildCsvFromRows(...args) : ''
        ),
        normalizeExpenseLedgerCategory: (...args) => (
          typeof api.normalizeExpenseLedgerCategory === 'function' ? api.normalizeExpenseLedgerCategory(...args) : String(args[0] || '').trim()
        ),
        normalizeExpenseLedgerRecord: (...args) => (
          typeof api.normalizeExpenseLedgerRecord === 'function' ? api.normalizeExpenseLedgerRecord(...args) : null
        ),
        saveData: (...args) => {
          if (typeof api.saveData === 'function') api.saveData(...args);
        },
        commitPatchIntent: (options = {}) => (
          typeof api.commitPatchIntent === 'function'
            ? api.commitPatchIntent(options)
            : (typeof api.commitMorphCoreMutation === 'function' ? api.commitMorphCoreMutation(options) : null)
        ),
        commitMorphCoreMutation: (options = {}) => (
          typeof api.commitMorphCoreMutation === 'function' ? api.commitMorphCoreMutation(options) : null
        ),
        protectRecentCommittedData: (...args) => {
          if (typeof api.protectRecentCommittedData === 'function') api.protectRecentCommittedData(...args);
        },
        syncExpenseLedgerDetailModalHostFromLiveState,
        isExpenseLedgerEditorModalActive,
        cloneExpenseLedgerRecordDraft,
        parseDateTimeInputValue,
        formatExpenseLedgerTimestamp,
        createRuntimeId,
      });
      return localPluginExpenseLedgerMutationRuntimeModules;
    }

    function getLocalPluginExpenseLedgerDraftRuntimeModules() {
      if (localPluginExpenseLedgerDraftRuntimeModules) return localPluginExpenseLedgerDraftRuntimeModules;
      const factory = window.MorphExpenseLedgerDraftRuntime && typeof window.MorphExpenseLedgerDraftRuntime.create === 'function'
        ? window.MorphExpenseLedgerDraftRuntime.create
        : null;
      if (!factory) return null;
      localPluginExpenseLedgerDraftRuntimeModules = factory({
        getExpenseLedgerManualDraftState: () => expenseLedgerManualDraftState,
        getExpenseLedgerEditorState: () => expenseLedgerEditorState,
        syncExpenseLedgerManualModalHost,
        applyExpenseLedgerManualCategoryQueryUI,
        isExpenseLedgerEditorModalActive,
        getExpenseLedgerManualCategoryOptions,
      });
      return localPluginExpenseLedgerDraftRuntimeModules;
    }

    function getLocalPluginExpenseLedgerViewRuntimeModules() {
      if (localPluginExpenseLedgerViewRuntimeModules) return localPluginExpenseLedgerViewRuntimeModules;
      const factory = window.MorphExpenseLedgerViewRuntime && typeof window.MorphExpenseLedgerViewRuntime.create === 'function'
        ? window.MorphExpenseLedgerViewRuntime.create
        : null;
      if (!factory) return null;
      localPluginExpenseLedgerViewRuntimeModules = factory({
        getExpenseLedgerViewState: () => expenseLedgerViewState,
        rerenderExpenseLedgerWorkspaceAndHost,
        getExpenseLedgerLedger,
        parseDateInputValue,
        formatDateInputValue,
        parseRecordDate,
        startOfDay,
        startOfWeek,
        startOfMonth,
        startOfYear,
        addDays,
        addMonths,
      });
      return localPluginExpenseLedgerViewRuntimeModules;
    }

    function getLocalPluginExpenseLedgerAnalyticsRuntimeModules() {
      if (localPluginExpenseLedgerAnalyticsRuntimeModules) return localPluginExpenseLedgerAnalyticsRuntimeModules;
      const factory = window.MorphExpenseLedgerAnalyticsRuntime && typeof window.MorphExpenseLedgerAnalyticsRuntime.create === 'function'
        ? window.MorphExpenseLedgerAnalyticsRuntime.create
        : null;
      if (!factory) return null;
      localPluginExpenseLedgerAnalyticsRuntimeModules = factory({
        escapeHTML,
        formatAmount,
        parseRecordDate,
        isDarkMode: () => (typeof document !== 'undefined' && document.documentElement?.classList?.contains('dark')),
      });
      return localPluginExpenseLedgerAnalyticsRuntimeModules;
    }

    function getLocalPluginExpenseLedgerContentRuntimeModules() {
      if (localPluginExpenseLedgerContentRuntimeModules) return localPluginExpenseLedgerContentRuntimeModules;
      const factory = window.MorphExpenseLedgerContentRuntime && typeof window.MorphExpenseLedgerContentRuntime.create === 'function'
        ? window.MorphExpenseLedgerContentRuntime.create
        : null;
      if (!factory) return null;
      localPluginExpenseLedgerContentRuntimeModules = factory({
        escapeHTML,
        formatAmount,
        parseRecordDate,
        isDarkMode: () => (typeof document !== 'undefined' && document.documentElement?.classList?.contains('dark')),
        getExpenseLedgerViewState: () => expenseLedgerViewState,
        getExpenseLedgerLedger,
        ensureExpenseLedgerCustomRange,
        getExpenseLedgerResolvedAnchorDate,
        getExpenseLedgerRangeConfig,
        normalizeExpenseLedgerSearch,
        recordFallsInRange,
        buildExpenseBucketSummaries,
        resolveExpenseLedgerActiveBucketKey,
        buildExpenseMonthCalendarHtml,
        buildExpenseBucketStripHtml,
        buildExpenseRecordTableHtml,
        buildExpenseCategoryChartHtml,
        groupRecurringExpenseRecords,
        buildExpenseTrendSvg,
        buildExpensePeriodNavigatorHtml,
        buildExpenseRangePills,
        formatExpenseLedgerSourceLabel,
        resolveWorkspaceShellCopy,
        buildWorkspaceHeaderActions,
      });
      return localPluginExpenseLedgerContentRuntimeModules;
    }

    function callLocalPluginShellRuntime(methodName, args = [], fallback = null) {
      const runtime = getLocalPluginShellRuntimeModules();
      if (runtime && typeof runtime[methodName] === 'function') return runtime[methodName](...args);
      return typeof fallback === 'function' ? fallback() : fallback;
    }

    function unmountVisualOrganizerExcalidrawHost() {
      const container = visualOrganizerExcalidrawState.container;
      if (container && typeof container === 'object') {
        try {
          container.innerHTML = '';
        } catch (_) {}
      }
      visualOrganizerExcalidrawState.container = null;
      visualOrganizerExcalidrawState.organizerId = '';
      visualOrganizerExcalidrawState.sceneFingerprint = '';
    }

    function getSelectedPluginId() {
      return typeof api.getSelectedPluginId === 'function' ? String(api.getSelectedPluginId() || '').trim() : '';
    }

    function getCatalogDefinition(pluginId = '') {
      const catalog = typeof api.getExtensionCatalog === 'function' ? api.getExtensionCatalog() : null;
      const list = Array.isArray(catalog?.extensions) ? catalog.extensions : [];
      return list.find((item) => String(item?.id || '').trim() === String(pluginId || '').trim()) || null;
    }

    function escapeHTML(text = '') {
      if (typeof api.escapeHTML === 'function') return api.escapeHTML(text);
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function escapeJSString(text = '') {
      return String(text || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, ' ');
    }

    async function loadJson(url) {
      const target = String(url || '').trim();
      if (!target) return null;
      if (typeof fetch === 'function') {
        try {
          const response = await fetch(target, { cache: 'no-store' });
          if (response?.ok) {
            const json = await response.json().catch(() => null);
            if (json && typeof json === 'object') return json;
          }
        } catch (_) {}
      }
      if (typeof XMLHttpRequest !== 'function') return null;
      return new Promise((resolve) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', target, true);
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            const ok = (xhr.status >= 200 && xhr.status < 300) || xhr.status === 0;
            if (!ok || !xhr.responseText) {
              resolve(null);
              return;
            }
            try {
              const parsed = JSON.parse(xhr.responseText);
              resolve(parsed && typeof parsed === 'object' ? parsed : null);
            } catch (_) {
              resolve(null);
            }
          };
          xhr.onerror = function () { resolve(null); };
          xhr.send(null);
        } catch (_) {
          resolve(null);
        }
      });
    }

    async function loadText(url) {
      const target = String(url || '').trim();
      if (!target) return '';
      if (cachedReadmes[target]) return cachedReadmes[target];
      if (typeof fetch === 'function') {
        try {
          const response = await fetch(target, { cache: 'no-store' });
          if (response?.ok) {
            const text = await response.text().catch(() => '');
            cachedReadmes[target] = String(text || '');
            return cachedReadmes[target];
          }
        } catch (_) {}
      }
      if (typeof XMLHttpRequest !== 'function') return '';
      return new Promise((resolve) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', target, true);
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            const ok = (xhr.status >= 200 && xhr.status < 300) || xhr.status === 0;
            const text = ok && xhr.responseText ? String(xhr.responseText) : '';
            cachedReadmes[target] = text;
            resolve(text);
          };
          xhr.onerror = function () { resolve(''); };
          xhr.send(null);
        } catch (_) {
          resolve('');
        }
      });
    }

    function deriveReadmePath(entry = '') {
      const path = String(entry || '').trim();
      if (!path) return '';
      if (/README\.md$/i.test(path)) return path;
      if (/manifest\.json$/i.test(path)) return path.replace(/manifest\.json$/i, 'README.md');
      return '';
    }

    function formatMarkdownPreview(text = '') {
      const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
      const html = [];
      let listOpen = false;
      let paragraph = [];
      const flushParagraph = () => {
        if (!paragraph.length) return;
        html.push(`<p class="text-[13px] leading-7 text-gray-700 dark:text-white/78">${escapeHTML(paragraph.join(' '))}</p>`);
        paragraph = [];
      };
      const closeList = () => {
        if (!listOpen) return;
        html.push('</ul>');
        listOpen = false;
      };
      lines.forEach((lineRaw) => {
        const line = String(lineRaw || '').trim();
        if (!line) {
          flushParagraph();
          closeList();
          return;
        }
        const heading = line.match(/^#{1,4}\s+(.+)$/);
        if (heading) {
          flushParagraph();
          closeList();
          html.push(`<div class="text-[12px] font-medium text-black dark:text-white/90">${escapeHTML(heading[1])}</div>`);
          return;
        }
        const bullet = line.match(/^- (.+)$/);
        if (bullet) {
          flushParagraph();
          if (!listOpen) {
            html.push('<ul class="space-y-1.5">');
            listOpen = true;
          }
          html.push(`<li class="text-[13px] leading-7 text-gray-700 dark:text-white/78">• ${escapeHTML(bullet[1])}</li>`);
          return;
        }
        paragraph.push(line);
      });
      flushParagraph();
      closeList();
      return html.join('');
    }

    function formatAmount(amount = 0) {
      const value = Number(amount);
      if (!Number.isFinite(value)) return '0';
      return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
    }

    function parseRecordDate(input = '') {
      const raw = String(input || '').trim();
      if (!raw) return null;
      const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
      const date = new Date(normalized);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function startOfDay(date) {
      const next = new Date(date);
      next.setHours(0, 0, 0, 0);
      return next;
    }

    function startOfWeek(date) {
      const next = startOfDay(date);
      const day = next.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      next.setDate(next.getDate() + diff);
      return next;
    }

    function startOfMonth(date) {
      return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function startOfYear(date) {
      return new Date(date.getFullYear(), 0, 1);
    }

    function addDays(date, days) {
      const next = new Date(date);
      next.setDate(next.getDate() + days);
      return next;
    }

    function addMonths(date, months) {
      const next = new Date(date);
      next.setMonth(next.getMonth() + months);
      return next;
    }

    function formatDateInputValue(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function parseDateInputValue(input = '') {
      const raw = String(input || '').trim();
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDateTimeInputValue(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    function parseDateTimeInputValue(input = '') {
      const raw = String(input || '').trim();
      if (!raw) return null;
      const normalized = raw.length === 16 ? `${raw}:00` : raw;
      const date = new Date(normalized);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatExpenseLedgerTimestamp(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    }

    function cloneExpenseLedgerRecordDraft(record = null) {
      const safe = record && typeof record === 'object' ? record : {};
      const recordDate = parseRecordDate(safe.spentAt || safe.createdAt || '') || new Date();
      return {
        item: String(safe.item || '').trim(),
        amount: Number.isFinite(Number(safe.amount)) ? String(Number(safe.amount)) : '',
        category: String(safe.category || '').trim(),
        spentAt: formatDateTimeInputValue(recordDate),
        note: String(safe.note || '').trim(),
      };
    }

    function getExpenseLedgerRootData() {
      return typeof api.getData === 'function' ? api.getData() : null;
    }

    function getExpenseLedgerLedger() {
      const root = getExpenseLedgerRootData();
      return typeof api.ensureExpenseLedgerShape === 'function'
        ? api.ensureExpenseLedgerShape(root)
        : { categories: [], records: [] };
    }

    function rememberExpenseLedgerCalendarScroll() {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.rememberExpenseLedgerCalendarScroll === 'function') {
        runtime.rememberExpenseLedgerCalendarScroll();
      }
    }

    function restoreExpenseLedgerCalendarScroll(root = null) {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.restoreExpenseLedgerCalendarScroll === 'function') {
        runtime.restoreExpenseLedgerCalendarScroll(root);
      }
    }

    function rerenderExpenseLedgerWorkspaceAndHost() {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.rerenderExpenseLedgerWorkspaceAndHost === 'function') {
        runtime.rerenderExpenseLedgerWorkspaceAndHost();
        return;
      }
      rerenderExpenseLedgerWorkspace();
    }

    function ensureExpenseLedgerDetailModalHost() {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      return runtime && typeof runtime.ensureExpenseLedgerDetailModalHost === 'function'
        ? runtime.ensureExpenseLedgerDetailModalHost()
        : null;
    }

    function clearExpenseLedgerDetailModalHost() {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.clearExpenseLedgerDetailModalHost === 'function') {
        runtime.clearExpenseLedgerDetailModalHost();
      }
    }

    function ensureExpenseLedgerManualModalHost() {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      return runtime && typeof runtime.ensureExpenseLedgerManualModalHost === 'function'
        ? runtime.ensureExpenseLedgerManualModalHost()
        : null;
    }

    function clearExpenseLedgerManualModalHost() {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.clearExpenseLedgerManualModalHost === 'function') {
        runtime.clearExpenseLedgerManualModalHost();
      }
    }

    function focusExpenseLedgerManualPrimaryField() {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.focusExpenseLedgerManualPrimaryField === 'function') {
        runtime.focusExpenseLedgerManualPrimaryField();
      }
    }

    function isExpenseLedgerEditorModalActive() {
      return !!(expenseLedgerEditorState.draft && String(expenseLedgerEditorState.recordId || '').trim());
    }

    function syncExpenseLedgerManualModalHost() {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.syncExpenseLedgerManualModalHost === 'function') {
        runtime.syncExpenseLedgerManualModalHost();
      }
    }

    function applyExpenseLedgerManualCategoryQueryUI(query = '') {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.applyExpenseLedgerManualCategoryQueryUI === 'function') {
        runtime.applyExpenseLedgerManualCategoryQueryUI(query);
      }
    }

    function syncExpenseLedgerDetailModalHost(bucket = null, label = '') {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.syncExpenseLedgerDetailModalHost === 'function') {
        runtime.syncExpenseLedgerDetailModalHost(bucket, label);
      }
    }

    async function syncExpenseLedgerDetailModalHostFromLiveState() {
      if (expenseLedgerViewState.detailModalOpen !== true) {
        syncExpenseLedgerDetailModalHost(null, '');
        return;
      }
      const definition = getCatalogDefinition('expense-ledger-plugin');
      const payload = await buildExpenseLedgerWorkspaceContent(definition);
      syncExpenseLedgerDetailModalHost(payload?.detailModal?.bucket || null, payload?.detailModal?.label || '');
    }

    function syncExpenseLedgerImportFeedback(text = '', tone = 'neutral') {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.syncExpenseLedgerImportFeedback === 'function') {
        runtime.syncExpenseLedgerImportFeedback(text, tone);
      }
    }

    function buildExpenseLedgerImportPreviewText(previews = []) {
      const runtime = getLocalPluginExpenseLedgerImportRuntimeModules();
      if (runtime && typeof runtime.buildExpenseLedgerImportPreviewText === 'function') {
        return runtime.buildExpenseLedgerImportPreviewText(previews);
      }
      return '这份文件暂时没有生成可用预览。';
    }

    async function runExpenseLedgerCsvImport(supportedFiles = [], eventTarget = null) {
      const runtime = getLocalPluginExpenseLedgerImportRuntimeModules();
      if (runtime && typeof runtime.importExpenseLedgerCsvFiles === 'function') {
        await runtime.importExpenseLedgerCsvFiles(supportedFiles);
      }
      if (eventTarget) eventTarget.value = '';
    }

    async function rewriteExpenseLedgerHistory(records = []) {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.rewriteExpenseLedgerHistory === 'function') {
        return runtime.rewriteExpenseLedgerHistory(records);
      }
      return Promise.resolve();
    }

    function sanitizeExpenseLedgerExportSegment(value = '', fallback = 'unknown') {
      const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return normalized || fallback;
    }

    async function clearExpenseLedgerDerivedMirrorFiles(records = [], categories = []) {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.clearExpenseLedgerDerivedMirrorFiles === 'function') {
        return runtime.clearExpenseLedgerDerivedMirrorFiles(records, categories);
      }
      return Promise.resolve();
    }

    function syncAIConversationUserFacingFiles(aiMemory = null) {
      const target = aiMemory && typeof aiMemory === 'object'
        ? aiMemory
        : (typeof api.getAIMemory === 'function' ? api.getAIMemory() : null);
      const sessions = Array.isArray(target?.chatSessions)
        ? target.chatSessions.map((session) => (typeof api.normalizeAIChatSession === 'function' ? api.normalizeAIChatSession(session) : session)).filter(Boolean)
        : [];
      if (!sessions.length || typeof api.writePluginFacingDataFile !== 'function') return Promise.resolve([]);
      const baseDir = 'morph_md_mirror/对话';
      const overview = [
        '# 对话',
        '',
        '这里是你和 Morpheus 的历史对话。',
        '',
        `当前共 ${sessions.length} 个会话。`,
        '',
      ];
      sessions.forEach((session, index) => {
        const title = String(session?.title || '').trim() || `对话 ${index + 1}`;
        const updatedAt = String(session?.updatedAt || '').trim() || '未知';
        overview.push(`- ${title}（最近更新：${updatedAt}）`);
      });
      overview.push('');
      const jobs = [
        api.writePluginFacingDataFile(`${baseDir}/说明.md`, overview.join('\n'), 'plugin-facing-data'),
      ];
      sessions.forEach((session, index) => {
        const title = String(session?.title || '').trim() || `对话 ${index + 1}`;
        const sanitize = typeof api.sanitizeMirrorFileSegment === 'function'
          ? api.sanitizeMirrorFileSegment
          : ((value, fallback) => String(value || '').trim() || String(fallback || '未命名'));
        const fileName = `${String(index + 1).padStart(2, '0')}-${sanitize(title, `对话-${index + 1}`)}.md`;
        const markdown = typeof api.buildAIChatSessionMirrorMarkdown === 'function'
          ? api.buildAIChatSessionMirrorMarkdown(session, index)
          : String(session?.title || '').trim();
        jobs.push(api.writePluginFacingDataFile(`${baseDir}/${fileName}`, markdown, 'plugin-facing-data'));
      });
      return Promise.all(jobs);
    }

    function formatDailyLogMirrorBlock(block = {}) {
      const type = String(block?.type || '').trim();
      const content = String(block?.content || '').trim();
      if (!content && type !== 'todo') return '';
      const indent = Math.max(0, Number(block?.indent) || 0);
      const prefix = indent > 0 ? '  '.repeat(indent) : '';
      if (type === 'todo') return `${prefix}- [${block?.checked ? 'x' : ' '}] ${content}`.trimEnd();
      if (type === 'bullet') return `${prefix}- ${content}`.trimEnd();
      if (type === 'number') return `${prefix}1. ${content}`.trimEnd();
      if (type === 'h1' || type === 'h2' || type === 'h3') return `## ${content}`;
      return `${prefix}${content}`.trimEnd();
    }

    function buildDailyLogMirrorMarkdown(monthKey = '', blocks = []) {
      const safeMonthKey = String(monthKey || '').trim() || 'unknown';
      const lines = [`# 日志 ${safeMonthKey}`, ''];
      const safeBlocks = Array.isArray(blocks) ? blocks : [];
      safeBlocks.forEach((block) => {
        const formatted = formatDailyLogMirrorBlock(block);
        if (!formatted) return;
        if (/^##\s+/.test(formatted) && lines.length > 2 && lines[lines.length - 1] !== '') {
          lines.push('');
        }
        lines.push(formatted);
      });
      lines.push('');
      return `${lines.join('\n').trimEnd()}\n`;
    }

    async function syncDailyLogUserFacingFiles(dailyMonths = null) {
      if (typeof api.writePluginFacingDataFile !== 'function') return Promise.resolve([]);
      const source = dailyMonths && typeof dailyMonths === 'object'
        ? dailyMonths
        : (typeof api.getData === 'function' ? api.getData()?.dailyMonths : null);
      const safeMonths = source && typeof source === 'object' ? source : {};
      const monthKeys = Object.keys(safeMonths).sort();
      const baseDir = 'morph_md_mirror/日志';
      const jobs = [];
      if (!monthKeys.length) {
        jobs.push(api.writePluginFacingDataFile(`${baseDir}/说明.md`, '# 日志\n\n暂无日志。\n', 'plugin-facing-data'));
        return Promise.all(jobs);
      }
      jobs.push(api.writePluginFacingDataFile(`${baseDir}/说明.md`, [
        '# 日志',
        '',
        `当前共 ${monthKeys.length} 个日志月份。`,
        '',
      ].join('\n'), 'plugin-facing-data'));
      monthKeys.forEach((monthKey) => {
        const yearKey = /^\d{4}/.test(monthKey) ? monthKey.slice(0, 4) : 'unknown';
        const blocks = Array.isArray(safeMonths[monthKey]) ? safeMonths[monthKey] : [];
        jobs.push(api.writePluginFacingDataFile(
          `${baseDir}/${yearKey}/${monthKey}.md`,
          buildDailyLogMirrorMarkdown(monthKey, blocks),
          'plugin-facing-data',
        ));
      });
      return Promise.all(jobs);
    }

    function syncUserFacingMirrorOverview() {
      const sections = typeof api.buildDynamicMirrorSections === 'function'
        ? api.buildDynamicMirrorSections()
        : [];
      if (typeof api.writePluginFacingDataFile !== 'function') return Promise.resolve([]);
      const rootGuide = typeof api.buildRootMirrorGuideText === 'function'
        ? api.buildRootMirrorGuideText()
        : '';
      const rootReadmeLines = [
        '# Morpheus 数据镜像',
        '',
        '这个目录用于给你直接查看和整理自己的内容。',
        '',
      ];
      if (sections.length) {
        rootReadmeLines.push('当前已启用并整理出的内容：', '');
        sections.forEach((section) => {
          rootReadmeLines.push(`- ${section.key}：${section.summary}`);
        });
        rootReadmeLines.push('');
      } else {
        rootReadmeLines.push('当前还没有整理出可直接查看的内容目录。等你开始使用对应功能后，这里会自动出现。', '');
      }
      const jobs = [
        api.writePluginFacingDataFile('README.md', rootGuide, 'plugin-facing-data'),
        api.writePluginFacingDataFile('00-从这里开始.md', rootGuide, 'plugin-facing-data'),
        api.writePluginFacingDataFile('morph_md_mirror/README.md', rootReadmeLines.join('\n'), 'plugin-facing-data'),
      ];
      if (sections.some((section) => section.key === '对话')) {
        jobs.push(syncAIConversationUserFacingFiles(typeof api.getAIMemory === 'function' ? api.getAIMemory() : null));
      }
      if (sections.some((section) => section.key === '视频运营')) {
        const channelOpsReadme = [
          '# 视频运营',
          '',
          '这里是你的视频运营内容工作区，包含选题、脚本、素材和相关说明。',
          '',
          '- 当前目录：`morph_md_mirror/视频运营`',
          '',
        ].join('\n');
        jobs.push(api.writePluginFacingDataFile('morph_md_mirror/视频运营/说明.md', channelOpsReadme, 'plugin-facing-data'));
      }
      return Promise.all(jobs);
    }

    async function syncExpenseLedgerUserFacingFiles(records = []) {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.syncExpenseLedgerUserFacingFiles === 'function') {
        return runtime.syncExpenseLedgerUserFacingFiles(records);
      }
      return Promise.resolve([]);
    }

    function syncExpenseLedgerExtensionFiles(record = null) {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.syncExpenseLedgerExtensionFiles === 'function') {
        runtime.syncExpenseLedgerExtensionFiles(record);
      }
    }

    function buildHealthMirrorOverviewText() {
      const glucoseBundle = typeof api.extractSyncedGlucoseBundle === 'function'
        ? api.extractSyncedGlucoseBundle(typeof api.getData === 'function' ? api.getData() : null)
        : null;
      const appleBundle = getAppleHealthBundle();
      const hasGlucose = Boolean(glucoseBundle?.reading) || (Array.isArray(glucoseBundle?.series) && glucoseBundle.series.length > 0);
      const hasApple = !!(appleBundle?.snapshot || appleBundle?.history || String(appleBundle?.updatedAt || '').trim());
      const lines = [
        '# 健康',
        '',
        '这里是你在 Morpheus 里沉淀下来的健康数据镜像。',
        '',
      ];
      if (!hasGlucose && !hasApple) {
        lines.push('- 暂无健康镜像数据。', '');
        return lines.join('\n');
      }
      if (hasGlucose) lines.push('- 血糖: 血糖读数与周期汇总。');
      if (hasApple) lines.push('- Apple 健康: Apple Watch / iPhone 的活动、睡眠、心率、体重与血糖历史。');
      lines.push('');
      return lines.join('\n');
    }

    function getAppleHealthBundle(bundle = null) {
      if (bundle && typeof bundle === 'object') return bundle;
      const root = typeof api.getData === 'function' ? api.getData() : null;
      return root?.appleHealthSync && typeof root.appleHealthSync === 'object' ? root.appleHealthSync : null;
    }

    function normalizeAppleHealthList(value = null) {
      return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
    }

    function stringifyAppleHealthJson(value = null) {
      try {
        return `${JSON.stringify(value && typeof value === 'object' ? value : {}, null, 2)}\n`;
      } catch (_) {
        return '{}\n';
      }
    }

    function readAppleHealthNumber(value) {
      if (value == null) return '';
      if (typeof value === 'string' && !value.trim()) return '';
      const n = Number(value);
      if (!Number.isFinite(n)) return '';
      if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
      return n.toFixed(2).replace(/\.?0+$/, '');
    }

    function buildAppleHealthCsv(header = [], rows = []) {
      const buildCsvFromRows = typeof api.buildCsvFromRows === 'function' ? api.buildCsvFromRows : (() => '');
      return buildCsvFromRows(header, rows);
    }

    function buildAppleHealthActivityCsv(rows = []) {
      const safeRows = normalizeAppleHealthList(rows);
      return buildAppleHealthCsv(
        ['date', 'steps', 'distanceMeters', 'activeEnergyKcal'],
        safeRows.map((row) => [
          String(row.date || '').trim(),
          readAppleHealthNumber(row.steps),
          readAppleHealthNumber(row.distanceMeters),
          readAppleHealthNumber(row.activeEnergyKcal),
        ]),
      );
    }

    function buildAppleHealthSleepCsv(rows = []) {
      const safeRows = normalizeAppleHealthList(rows);
      return buildAppleHealthCsv(
        ['date', 'asleepHours', 'inBedHours', 'samplesCount'],
        safeRows.map((row) => [
          String(row.date || '').trim(),
          readAppleHealthNumber(row.asleepHours),
          readAppleHealthNumber(row.inBedHours),
          readAppleHealthNumber(row.samplesCount),
        ]),
      );
    }

    function buildAppleHealthRestingHeartCsv(rows = []) {
      const safeRows = normalizeAppleHealthList(rows);
      return buildAppleHealthCsv(
        ['date', 'restingHeartRateBpm', 'at'],
        safeRows.map((row) => [
          String(row.date || '').trim(),
          readAppleHealthNumber(row.restingHeartRateBpm),
          String(row.at || '').trim(),
        ]),
      );
    }

    function buildAppleHealthHeartRateCsv(rows = []) {
      const safeRows = normalizeAppleHealthList(rows);
      return buildAppleHealthCsv(
        ['date', 'at', 'bpm'],
        safeRows.map((row) => [
          String(row.date || '').trim() || String(row.at || '').slice(0, 10),
          String(row.at || '').trim(),
          readAppleHealthNumber(row.bpm),
        ]),
      );
    }

    function buildAppleHealthBodyMassCsv(rows = []) {
      const safeRows = normalizeAppleHealthList(rows);
      return buildAppleHealthCsv(
        ['date', 'at', 'kg'],
        safeRows.map((row) => [
          String(row.date || '').trim() || String(row.at || '').slice(0, 10),
          String(row.at || '').trim(),
          readAppleHealthNumber(row.kg),
        ]),
      );
    }

    function buildAppleHealthBloodGlucoseCsv(rows = []) {
      const safeRows = normalizeAppleHealthList(rows);
      return buildAppleHealthCsv(
        ['date', 'at', 'mgDl', 'mmolL'],
        safeRows.map((row) => [
          String(row.date || '').trim() || String(row.at || '').slice(0, 10),
          String(row.at || '').trim(),
          readAppleHealthNumber(row.mgDl),
          readAppleHealthNumber(row.mmolL),
        ]),
      );
    }

    function buildAppleHealthSyncHistoryRows(bundle = null) {
      const safeBundle = getAppleHealthBundle(bundle);
      if (!safeBundle) return [];
      const snapshot = safeBundle.snapshot && typeof safeBundle.snapshot === 'object' ? safeBundle.snapshot : {};
      const history = safeBundle.history && typeof safeBundle.history === 'object' ? safeBundle.history : {};
      const updatedAt = String(safeBundle.updatedAt || snapshot.fetchedAt || '').trim();
      if (!updatedAt) return [];
      return [[
        updatedAt,
        String(safeBundle.source || 'ios-healthkit').trim() || 'ios-healthkit',
        readAppleHealthNumber(snapshot.windowHours),
        normalizeAppleHealthList(history.activityDaily).length,
        normalizeAppleHealthList(history.sleepDaily).length,
        normalizeAppleHealthList(history.restingHeartRateDaily).length,
        normalizeAppleHealthList(history.heartRateSamples).length,
        normalizeAppleHealthList(history.bodyMassSamples).length,
        normalizeAppleHealthList(history.bloodGlucoseSamples).length,
      ]];
    }

    async function syncAppleHealthUserFacingFiles(bundle = null) {
      if (typeof api.writePluginFacingDataFile !== 'function') return Promise.resolve([]);
      const safeBundle = getAppleHealthBundle(bundle);
      if (!safeBundle) return Promise.resolve([]);
      const snapshot = safeBundle.snapshot && typeof safeBundle.snapshot === 'object' ? safeBundle.snapshot : {};
      const history = safeBundle.history && typeof safeBundle.history === 'object' ? safeBundle.history : {};
      const baseDir = 'morph_md_mirror/健康/Apple健康';
      const syncRows = buildAppleHealthSyncHistoryRows(safeBundle);
      const jobs = [
        api.writePluginFacingDataFile('morph_md_mirror/健康/说明.md', buildHealthMirrorOverviewText(), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/说明.md`, [
          '# Apple 健康',
          '',
          '这里保存的是 Apple Health / Apple Watch 同步到 Morpheus 后的长期历史文件。',
          '',
          '- 最新摘要.json: 当前 app 内展示用的最新摘要',
          '- 长期历史.json: 长历史原始结构化数据',
          '- 活动历史-按日.csv: 最近约 90 天按日活动汇总',
          '- 睡眠历史-按日.csv: 最近约 30 天睡眠汇总',
          '- 静息心率-按日.csv: 最近约 60 天静息心率',
          '- 心率历史-最近14天.csv: 最近约 14 天详细心率样本',
          '- 最新心率样本.csv: 当前摘要窗口内的心率样本',
          '- 体重历史.csv: 最近约 180 天体重样本',
          '- 血糖历史.csv: 最近约 30 天血糖样本',
          '',
        ].join('\n'), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/最新摘要.json`, stringifyAppleHealthJson({
          updatedAt: String(safeBundle.updatedAt || snapshot.fetchedAt || '').trim(),
          source: String(safeBundle.source || 'ios-healthkit').trim() || 'ios-healthkit',
          snapshot,
        }), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/长期历史.json`, stringifyAppleHealthJson(history), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/活动历史-按日.csv`, buildAppleHealthActivityCsv(history.activityDaily), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/睡眠历史-按日.csv`, buildAppleHealthSleepCsv(history.sleepDaily), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/静息心率-按日.csv`, buildAppleHealthRestingHeartCsv(history.restingHeartRateDaily), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/心率历史-最近14天.csv`, buildAppleHealthHeartRateCsv(history.heartRateSamples), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/最新心率样本.csv`, buildAppleHealthHeartRateCsv(snapshot.heartRateSamples), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/体重历史.csv`, buildAppleHealthBodyMassCsv(history.bodyMassSamples), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/血糖历史.csv`, buildAppleHealthBloodGlucoseCsv(history.bloodGlucoseSamples), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/同步历史.csv`, buildAppleHealthCsv(
          ['updatedAt', 'source', 'windowHours', 'activityDays', 'sleepDays', 'restingHeartDays', 'heartRateSamples', 'bodyMassSamples', 'bloodGlucoseSamples'],
          syncRows,
        ), 'apple-health-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/同步历史.ndjson`, syncRows.map((row) => JSON.stringify({
          updatedAt: row[0],
          source: row[1],
          windowHours: row[2],
          activityDays: row[3],
          sleepDays: row[4],
          restingHeartDays: row[5],
          heartRateSamples: row[6],
          bodyMassSamples: row[7],
          bloodGlucoseSamples: row[8],
        })).join('\n').concat(syncRows.length ? '\n' : ''), 'apple-health-plugin'),
      ];
      return Promise.all(jobs);
    }

    async function syncAppleHealthExtensionFiles(bundle = null, options = {}) {
      if (typeof api.writePluginFacingDataFile !== 'function') return Promise.resolve([]);
      const safeBundle = getAppleHealthBundle(bundle);
      if (!safeBundle) return Promise.resolve([]);
      const snapshot = safeBundle.snapshot && typeof safeBundle.snapshot === 'object' ? safeBundle.snapshot : {};
      const history = safeBundle.history && typeof safeBundle.history === 'object' ? safeBundle.history : {};
      const updatedAt = String(safeBundle.updatedAt || snapshot.fetchedAt || '').trim();
      const state = {
        updatedAt,
        source: String(safeBundle.source || 'ios-healthkit').trim() || 'ios-healthkit',
        snapshot,
        history,
      };
      const eventLine = updatedAt ? `${JSON.stringify({
        updatedAt,
        source: state.source,
        windowHours: snapshot.windowHours ?? null,
        appendHistory: options?.appendHistory === true,
      })}\n` : '';
      const jobs = [
        api.writePluginFacingDataFile('data/plugins/apple-health/state.json', stringifyAppleHealthJson(state), 'apple-health-plugin'),
        api.writePluginFacingDataFile('data/plugins/apple-health/events.ndjson', eventLine, 'apple-health-plugin'),
        syncAppleHealthUserFacingFiles(safeBundle),
      ];
      return Promise.all(jobs);
    }

    async function syncGlucoseUserFacingFiles(bundle = null) {
      if (typeof api.writePluginFacingDataFile !== 'function') return Promise.resolve([]);
      const safeBundle = bundle && typeof bundle === 'object'
        ? bundle
        : (typeof api.extractSyncedGlucoseBundle === 'function'
          ? api.extractSyncedGlucoseBundle(typeof api.getData === 'function' ? api.getData() : null)
          : null);
      const normalizeSeries = typeof api.normalizeGlucoseHistorySeries === 'function'
        ? api.normalizeGlucoseHistorySeries
        : ((list) => Array.isArray(list) ? list : []);
      const series = normalizeSeries(safeBundle?.archive || safeBundle?.series || []);
      const targetLow = Number.isFinite(Number(safeBundle?.targetLow)) ? Number(safeBundle.targetLow) : 70;
      const targetHigh = Number.isFinite(Number(safeBundle?.targetHigh)) ? Number(safeBundle.targetHigh) : 180;
      const baseDir = 'morph_md_mirror/健康/血糖';
      const header = ['period', 'readingCount', 'minMgdl', 'maxMgdl', 'avgMgdl', 'avgMmol', 'timeInRange', 'firstReadingAt', 'lastReadingAt'];
      const buildCsvFromRows = typeof api.buildCsvFromRows === 'function' ? api.buildCsvFromRows : (() => '');
      const buildGlucoseReadingsCsv = typeof api.buildGlucoseReadingsCsv === 'function' ? api.buildGlucoseReadingsCsv : (() => '');
      const buildGlucoseSummaryRows = typeof api.buildGlucoseSummaryRows === 'function' ? api.buildGlucoseSummaryRows : (() => []);
      return Promise.all([
        api.writePluginFacingDataFile('morph_md_mirror/健康/说明.md', buildHealthMirrorOverviewText(), 'health-glucose-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/说明.md`, [
          '# Health Glucose',
          '',
          '- readings.csv: 原始血糖读数',
          '- summaries/by-day.csv: 按日汇总',
          '- summaries/by-week.csv: 按周汇总（key 为该周起始日）',
          '- summaries/by-month.csv: 按月汇总',
          '',
        ].join('\n'), 'health-glucose-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/原始读数.csv`, buildGlucoseReadingsCsv(series, { targetLow, targetHigh }), 'health-glucose-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/汇总/按日.csv`, buildCsvFromRows(header, buildGlucoseSummaryRows(series, 'day', { targetLow, targetHigh })), 'health-glucose-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/汇总/按周.csv`, buildCsvFromRows(header, buildGlucoseSummaryRows(series, 'week', { targetLow, targetHigh })), 'health-glucose-plugin'),
        api.writePluginFacingDataFile(`${baseDir}/汇总/按月.csv`, buildCsvFromRows(header, buildGlucoseSummaryRows(series, 'month', { targetLow, targetHigh })), 'health-glucose-plugin'),
      ]);
    }

    function canSyncPluginFacingDataExports() {
      if (typeof api.writePluginFacingDataFile !== 'function') return false;
      try {
        if (api.storage && typeof api.storage.hasNativeControlBridge === 'function' && api.storage.hasNativeControlBridge()) {
          return true;
        }
      } catch (_) {}
      try {
        const meta = api.storage && typeof api.storage.getWebSyncRootMeta === 'function'
          ? api.storage.getWebSyncRootMeta()
          : null;
        return !!(
          meta
          && String(meta.mode || '').trim() === 'handle'
          && meta.readable !== false
          && meta.writable === true
        );
      } catch (_) {
        return false;
      }
    }

    async function syncAllPluginFacingDataExports() {
      if (!canSyncPluginFacingDataExports()) return [];
      try {
        await syncUserFacingMirrorOverview();
      } catch (error) {
        console.warn('[PluginData] Failed to sync user-facing mirror overview.', error);
      }
      try {
        await syncDailyLogUserFacingFiles();
      } catch (error) {
        console.warn('[PluginData] Failed to sync daily log mirror exports.', error);
      }
      try {
        const ledger = typeof api.ensureExpenseLedgerShape === 'function'
          ? api.ensureExpenseLedgerShape(typeof api.getData === 'function' ? api.getData() : null)
          : { records: [] };
        await syncExpenseLedgerUserFacingFiles(ledger.records);
      } catch (error) {
        console.warn('[PluginData] Failed to sync expense ledger exports.', error);
      }
      try {
        await syncGlucoseUserFacingFiles();
      } catch (error) {
        console.warn('[PluginData] Failed to sync glucose exports.', error);
      }
      try {
        await syncAppleHealthExtensionFiles();
      } catch (error) {
        console.warn('[PluginData] Failed to sync Apple Health exports.', error);
      }
    }

    async function persistExpenseLedgerMutations(options = {}) {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.persistExpenseLedgerMutations === 'function') {
        return runtime.persistExpenseLedgerMutations(options);
      }
      return Promise.resolve();
    }

    function clearExpenseLedgerEditorState() {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.clearExpenseLedgerEditorState === 'function') {
        runtime.clearExpenseLedgerEditorState();
      }
    }

    function closeExpenseLedgerManualDraft(options = {}) {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.closeExpenseLedgerManualDraft === 'function') {
        runtime.closeExpenseLedgerManualDraft(options);
      }
    }

    function getExpenseLedgerManualCategoryOptions() {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.getExpenseLedgerManualCategoryOptions === 'function') {
        return runtime.getExpenseLedgerManualCategoryOptions();
      }
      return ['餐饮美食', '交通出行', '日用百货', '房租', '医疗保健', '未分类'];
    }

    function findExpenseLedgerRecordIndex(recordId = '') {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.findExpenseLedgerRecordIndex === 'function') {
        return runtime.findExpenseLedgerRecordIndex(recordId);
      }
      return -1;
    }

    function ensureExpenseLedgerCustomRange(records = []) {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.ensureExpenseLedgerCustomRange === 'function') {
        runtime.ensureExpenseLedgerCustomRange(records);
      }
    }

    function getExpenseLedgerResolvedAnchorDate(records = []) {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.getExpenseLedgerResolvedAnchorDate === 'function') {
        return runtime.getExpenseLedgerResolvedAnchorDate(records);
      }
      return new Date();
    }

    function setExpenseLedgerAnchorDate(date) {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.setExpenseLedgerAnchorDate === 'function') {
        runtime.setExpenseLedgerAnchorDate(date);
      }
    }

    function formatExpenseLedgerDayLabel(date) {
      const value = date instanceof Date ? date : new Date(date);
      if (Number.isNaN(value.getTime())) return '';
      return `${value.getMonth() + 1}/${value.getDate()}`;
    }

    function formatExpenseLedgerRangeLabel(start, range = 'month') {
      const value = start instanceof Date ? start : new Date(start);
      if (Number.isNaN(value.getTime())) return '';
      if (range === 'day') {
        return `${value.getFullYear()}/${String(value.getMonth() + 1).padStart(2, '0')}/${String(value.getDate()).padStart(2, '0')}`;
      }
      if (range === 'week') {
        const end = addDays(value, 6);
        return `${formatDateInputValue(value)} - ${formatDateInputValue(end)}`;
      }
      if (range === 'month') {
        return `${value.getFullYear()}年${value.getMonth() + 1}月`;
      }
      if (range === 'year') {
        return `${value.getFullYear()}年`;
      }
      return formatDateInputValue(value);
    }

    function formatExpenseLedgerSourceLabel(source = '') {
      const runtime = getLocalPluginExpenseLedgerAnalyticsRuntimeModules();
      return runtime && typeof runtime.formatExpenseLedgerSourceLabel === 'function'
        ? runtime.formatExpenseLedgerSourceLabel(source)
        : '当前数据';
    }

    function formatBucketLabel(date, range) {
      const value = date instanceof Date ? date : new Date(date);
      if (range === 'day') return `${String(value.getHours()).padStart(2, '0')}:00`;
      if (range === 'week') return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][Math.max(0, Math.min(6, (value.getDay() + 6) % 7))];
      if (range === 'year') return `${value.getMonth() + 1}月`;
      return `${value.getMonth() + 1}/${value.getDate()}`;
    }

    function getExpenseLedgerRangeConfig(range, records = [], customRange = {}, options = {}) {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.getExpenseLedgerRangeConfig === 'function') {
        return runtime.getExpenseLedgerRangeConfig(range, records, customRange, options);
      }
      return { range: 'month', label: '', start: new Date(), end: new Date(), buckets: [] };
    }

    function recordFallsInRange(recordDate, bucket) {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.recordFallsInRange === 'function') {
        return runtime.recordFallsInRange(recordDate, bucket);
      }
      return false;
    }

    function buildExpenseTrendSvg(buckets = [], values = []) {
      const runtime = getLocalPluginExpenseLedgerAnalyticsRuntimeModules();
      return runtime && typeof runtime.buildExpenseTrendSvg === 'function'
        ? runtime.buildExpenseTrendSvg(buckets, values)
        : '';
    }

    function buildExpenseCategoryChartHtml(items = []) {
      const runtime = getLocalPluginExpenseLedgerAnalyticsRuntimeModules();
      return runtime && typeof runtime.buildExpenseCategoryChartHtml === 'function'
        ? runtime.buildExpenseCategoryChartHtml(items)
        : '';
    }

    function buildExpenseRangePills(activeRange = 'month') {
      const runtime = getLocalPluginExpenseLedgerRenderRuntimeModules();
      return runtime && typeof runtime.buildExpenseRangePills === 'function'
        ? runtime.buildExpenseRangePills(activeRange)
        : '';
    }
    function buildExpenseBucketSummaries(records = [], buckets = []) {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.buildExpenseBucketSummaries === 'function') {
        return runtime.buildExpenseBucketSummaries(records, buckets);
      }
      return [];
    }

    function resolveExpenseLedgerActiveBucketKey(rangeConfig = null, bucketSummaries = []) {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.resolveExpenseLedgerActiveBucketKey === 'function') {
        return runtime.resolveExpenseLedgerActiveBucketKey(rangeConfig, bucketSummaries);
      }
      return '';
    }

    function buildExpensePeriodNavigatorHtml(rangeConfig = null) {
      const runtime = getLocalPluginExpenseLedgerRenderRuntimeModules();
      return runtime && typeof runtime.buildExpensePeriodNavigatorHtml === 'function'
        ? runtime.buildExpensePeriodNavigatorHtml(rangeConfig)
        : '';
    }

    function buildExpenseMonthCalendarHtml(rangeConfig = null, bucketSummaries = [], activeBucketKey = '') {
      const runtime = getLocalPluginExpenseLedgerRenderRuntimeModules();
      return runtime && typeof runtime.buildExpenseMonthCalendarHtml === 'function'
        ? runtime.buildExpenseMonthCalendarHtml(rangeConfig, bucketSummaries, activeBucketKey)
        : '';
    }


    function buildExpenseBucketStripHtml(rangeConfig = null, bucketSummaries = [], activeBucketKey = '') {
      const runtime = getLocalPluginExpenseLedgerRenderRuntimeModules();
      return runtime && typeof runtime.buildExpenseBucketStripHtml === 'function'
        ? runtime.buildExpenseBucketStripHtml(rangeConfig, bucketSummaries, activeBucketKey)
        : '';
    }

    function ensureExpenseLedgerHostBindings() {
      const runtime = getLocalPluginExpenseLedgerHostRuntimeModules();
      if (runtime && typeof runtime.ensureExpenseLedgerHostBindings === 'function') {
        runtime.ensureExpenseLedgerHostBindings();
      }
    }

    function buildExpenseRecordTableHtml(records = []) {
      const runtime = getLocalPluginExpenseLedgerRenderRuntimeModules();
      return runtime && typeof runtime.buildExpenseRecordTableHtml === 'function'
        ? runtime.buildExpenseRecordTableHtml(records)
        : '';
    }

    function buildExpenseLedgerDetailListHtml(records = []) {
      const runtime = getLocalPluginExpenseLedgerRenderRuntimeModules();
      return runtime && typeof runtime.buildExpenseLedgerDetailListHtml === 'function'
        ? runtime.buildExpenseLedgerDetailListHtml(records)
        : '';
    }

    function buildExpenseLedgerDetailModalHtml(bucket = null, rangeLabel = '') {
      const runtime = getLocalPluginExpenseLedgerRenderRuntimeModules();
      return runtime && typeof runtime.buildExpenseLedgerDetailModalHtml === 'function'
        ? runtime.buildExpenseLedgerDetailModalHtml({
            bucket,
            rangeLabel,
            detailModalOpen: expenseLedgerViewState.detailModalOpen === true,
          })
        : '';
    }

    function buildExpenseLedgerManualModalHtml() {
      const runtime = getLocalPluginExpenseLedgerRenderRuntimeModules();
      const isEditing = isExpenseLedgerEditorModalActive();
      return runtime && typeof runtime.buildExpenseLedgerManualModalHtml === 'function'
        ? runtime.buildExpenseLedgerManualModalHtml({
            isEditing,
            draft: isEditing ? expenseLedgerEditorState.draft : expenseLedgerManualDraftState.draft,
            editorRecordId: String(expenseLedgerEditorState.recordId || ''),
            categoryOptions: getExpenseLedgerManualCategoryOptions(),
            categoryMenuOpen: expenseLedgerManualDraftState.categoryMenuOpen === true,
            categoryQuery: String(expenseLedgerManualDraftState.categoryQuery || ''),
            statusText: String(expenseLedgerManualDraftState.statusText || ''),
            statusError: expenseLedgerManualDraftState.statusError === true,
          })
        : '';
    }

    function normalizeExpenseLedgerSearch(text = '') {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.normalizeExpenseLedgerSearch === 'function') {
        return runtime.normalizeExpenseLedgerSearch(text);
      }
      return String(text || '').trim().toLowerCase();
    }

    function inferRecurringCadence(records = []) {
      const runtime = getLocalPluginExpenseLedgerAnalyticsRuntimeModules();
      return runtime && typeof runtime.inferRecurringCadence === 'function'
        ? runtime.inferRecurringCadence(records)
        : '待观察';
    }

    function groupRecurringExpenseRecords(records = []) {
      const runtime = getLocalPluginExpenseLedgerAnalyticsRuntimeModules();
      return runtime && typeof runtime.groupRecurringExpenseRecords === 'function'
        ? runtime.groupRecurringExpenseRecords(records)
        : [];
    }

    function renderWorkspaceShell(options = {}) {
      return callLocalPluginShellRuntime('renderWorkspaceShell', [options], () => `<section class="h-full w-full max-w-none flex flex-col min-h-0 relative">${String(options?.body || '')}</section>`);
    }

    function getLocalPluginWorkspaceScrollBody(root = null) {
      return callLocalPluginShellRuntime('getLocalPluginWorkspaceScrollBody', [root], () => {
        const scope = root && typeof root.querySelector === 'function' ? root : document;
        return scope && typeof scope.querySelector === 'function' ? scope.querySelector('[data-local-plugin-scroll-body]') || null : null;
      });
    }

    function captureLocalPluginWorkspaceScroll(root = null) {
      return callLocalPluginShellRuntime('captureLocalPluginWorkspaceScroll', [root], () => {
        const scroller = getLocalPluginWorkspaceScrollBody(root);
        if (!scroller) return;
        localPluginWorkspaceScrollTop = Number(scroller.scrollTop || 0);
      });
    }

    function restoreLocalPluginWorkspaceScroll(root = null) {
      return callLocalPluginShellRuntime('restoreLocalPluginWorkspaceScroll', [root], () => {
        const scroller = getLocalPluginWorkspaceScrollBody(root);
        if (!scroller) return;
        const nextTop = Number(localPluginWorkspaceScrollTop || 0);
        requestAnimationFrame(() => {
          scroller.scrollTop = nextTop;
        });
      });
    }

    function buildWorkspaceGhostAction(label = '配置', onclick = '') {
      return callLocalPluginShellRuntime('buildWorkspaceGhostAction', [label, onclick], '');
    }

    function buildWorkspaceMetaBadge(text = '') {
      return callLocalPluginShellRuntime('buildWorkspaceMetaBadge', [text], '');
    }

    function resolveWorkspaceShellCopy(definition = null, fallback = {}) {
      return callLocalPluginShellRuntime('resolveWorkspaceShellCopy', [definition, fallback], () => ({ eyebrow: String(fallback?.eyebrow || '').trim(), title: String(fallback?.title || '').trim(), englishTitle: String(fallback?.englishTitle || '').trim(), description: String(fallback?.description || '').trim(), backLabel: String(fallback?.backLabel || '').trim() }));
    }

    function buildWorkspaceHeaderActions(definition = null, options = {}) {
      return callLocalPluginShellRuntime('buildWorkspaceHeaderActions', [definition, options], []);
    }

    function clearPomodoroWorkspaceTicker() {
      if (pomodoroWorkspaceTicker) {
        clearInterval(pomodoroWorkspaceTicker);
        pomodoroWorkspaceTicker = null;
      }
    }

    function rerenderPomodoroWorkspace() {
      if (getSelectedPluginId() !== 'pomodoro-plugin') {
        clearPomodoroWorkspaceTicker();
        return;
      }
      void renderView();
    }

    function ensurePomodoroWorkspaceTicker(enabled = false) {
      clearPomodoroWorkspaceTicker();
      if (!enabled) return;
      pomodoroWorkspaceTicker = setInterval(() => {
        if (getSelectedPluginId() !== 'pomodoro-plugin') {
          clearPomodoroWorkspaceTicker();
          return;
        }
        rerenderPomodoroWorkspace();
      }, 1000);
    }

    function formatPomodoroClock(seconds = 0) {
      const runtime = getPomodoroPluginRuntimeModules();
      if (runtime && typeof runtime.formatClock === 'function') return runtime.formatClock(seconds);
      const safe = Math.max(0, Math.floor(Number(seconds) || 0));
      const minutes = Math.floor(safe / 60);
      const remainder = safe % 60;
      return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
    }

    function getPomodoroPhaseLabel(phase = 'focus') {
      const runtime = getPomodoroPluginRuntimeModules();
      if (runtime && typeof runtime.getPhaseLabel === 'function') return runtime.getPhaseLabel(phase);
      if (phase === 'short-break') return '短休息';
      if (phase === 'long-break') return '长休息';
      return '专注';
    }

    function getPomodoroStatusLabel(status = 'idle') {
      const runtime = getPomodoroPluginRuntimeModules();
      if (runtime && typeof runtime.getStatusLabel === 'function') return runtime.getStatusLabel(status);
      if (status === 'running') return '进行中';
      if (status === 'paused') return '已暂停';
      return '待开始';
    }

    function getPomodoroTodayStats(state = null) {
      const runtime = getPomodoroPluginRuntimeModules();
      if (runtime && typeof runtime.buildTodayStats === 'function') {
        return runtime.buildTodayStats(Array.isArray(state?.history) ? state.history : []);
      }
      return { focusCount: 0, focusMinutes: 0, shortBreakCount: 0, longBreakCount: 0 };
    }

    function formatWechatArticleFormatterCopiedAt(value = '') {
      const date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return '';
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      return `${month}-${day} ${hour}:${minute}`;
    }

    function getWechatArticleFormatterStatusClasses(tone = 'neutral') {
      if (tone === 'success') {
        return 'rounded-[0.95rem] border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-500/10 px-3 py-2 text-[12px] leading-6 text-emerald-700 dark:text-emerald-200';
      }
      if (tone === 'error') {
        return 'rounded-[0.95rem] border border-red-200 dark:border-red-500/30 bg-red-50/80 dark:bg-red-500/10 px-3 py-2 text-[12px] leading-6 text-red-700 dark:text-red-200';
      }
      return 'rounded-[0.95rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-2 text-[12px] leading-6 text-gray-600 dark:text-white/60';
    }

    function syncWechatArticleFormatterStatusDom(root = document) {
      const host = root && typeof root.getElementById === 'function'
        ? root.getElementById('wechat-article-formatter-status')
        : document.getElementById('wechat-article-formatter-status');
      if (!host) return;
      host.className = getWechatArticleFormatterStatusClasses(wechatArticleFormatterViewState.statusTone);
      host.textContent = wechatArticleFormatterViewState.statusText;
    }

    function setWechatArticleFormatterStatus(text = '', tone = 'neutral') {
      wechatArticleFormatterViewState.statusText = String(text || '').trim() || '复制后直接粘贴到公众号官方编辑器；微信二次清洗部分样式属于正常现象。';
      wechatArticleFormatterViewState.statusTone = tone === 'success' || tone === 'error' ? tone : 'neutral';
      syncWechatArticleFormatterStatusDom(document);
    }

    function refreshWechatArticleFormatterPreview(root = document) {
      const runtime = getWechatArticleFormatterRuntimeModules();
      if (!runtime || typeof runtime.buildRenderedArticle !== 'function') return;
      const article = runtime.buildRenderedArticle();
      const preview = root && typeof root.getElementById === 'function'
        ? root.getElementById('wechat-article-formatter-preview')
        : document.getElementById('wechat-article-formatter-preview');
      if (preview) preview.innerHTML = article.html;
      const meta = root && typeof root.getElementById === 'function'
        ? root.getElementById('wechat-article-formatter-meta')
        : document.getElementById('wechat-article-formatter-meta');
      if (meta) {
        const copiedLabel = article.lastCopiedAt ? ` · 最近复制 ${formatWechatArticleFormatterCopiedAt(article.lastCopiedAt)}` : '';
        meta.textContent = `${article.themeName} · ${article.charCount} 字 · ${article.wordCount} 词${copiedLabel}`;
      }
      const note = root && typeof root.getElementById === 'function'
        ? root.getElementById('wechat-article-formatter-title-note')
        : document.getElementById('wechat-article-formatter-title-note');
      if (note) {
        note.textContent = article.title && article.title !== '未命名文章'
          ? `当前标题：${article.title}`
          : '如果标题栏留空，会优先取正文第一行的 # 标题。';
      }
      syncWechatArticleFormatterStatusDom(root);
    }

    function getPomodoroPlannedSeconds(state = null) {
      if (!state || typeof state !== 'object') return 25 * 60;
      if (state.phase === 'short-break') return Math.max(60, Math.round(Number(state.shortBreakMinutes || 5) * 60));
      if (state.phase === 'long-break') return Math.max(60, Math.round(Number(state.longBreakMinutes || 15) * 60));
      return Math.max(60, Math.round(Number(state.focusDurationMinutes || 25) * 60));
    }

    function buildPomodoroStatCard(label = '', value = '', hint = '') {
      return `
        <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] px-4 py-4">
          <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">${escapeHTML(label)}</div>
          <div class="mt-2 text-[1.6rem] leading-none font-semibold tabular-nums text-gray-900 dark:text-white/92">${escapeHTML(value)}</div>
          ${hint ? `<div class="mt-2 text-[11px] leading-5 text-gray-500 dark:text-white/45">${escapeHTML(hint)}</div>` : ''}
        </div>
      `;
    }

    async function renderPomodoroWorkspace(root, definition) {
      const runtime = getPomodoroPluginRuntimeModules();
      if (!runtime || typeof runtime.getPluginState !== 'function') {
        root.innerHTML = renderWorkspaceShell({
          title: definition?.name || '番茄时钟',
          englishTitle: 'Pomodoro',
          description: String(definition?.description || definition?.summary || '').trim(),
          leftActions: [],
          rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
          body: `<div class="rounded-[1rem] border border-dashed border-gray-200 dark:border-white/10 px-4 py-5 text-[12px] leading-7 text-gray-500 dark:text-white/45">番茄时钟 runtime 尚未加载。</div>`,
        });
        restoreLocalPluginWorkspaceScroll(root);
        return;
      }

      const shellCopy = resolveWorkspaceShellCopy(definition, {
        title: definition?.name || '番茄时钟',
        englishTitle: 'Pomodoro',
        description: String(definition?.description || definition?.summary || '').replace(/\s+/g, ' ').trim(),
      });
      const state = runtime.getPluginState({ sync: true });
      const today = getPomodoroTodayStats(state);
      const plannedSeconds = getPomodoroPlannedSeconds(state);
      const progress = plannedSeconds > 0 ? Math.max(0, Math.min(100, ((plannedSeconds - Number(state.remainingSeconds || 0)) / plannedSeconds) * 100)) : 0;
      const quickStarts = typeof runtime.getQuickStartPresets === 'function' ? runtime.getQuickStartPresets() : [15, 25, 45];
      const isDisabled = runtime.isEnabled && runtime.isEnabled() === false;
      const currentTaskText = state.currentTaskLabel
        ? `当前主题：${state.currentTaskLabel}`
        : '直接开始也可以，配置仍在统一弹窗里。';
      const rhythmHint = `${state.focusDurationMinutes}/${state.shortBreakMinutes}/${state.longBreakMinutes} 分钟，${state.longBreakInterval} 个专注后长休息`;
      const statusToneClass = state.status === 'running'
        ? 'text-emerald-600 dark:text-emerald-400'
        : state.status === 'paused'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-gray-500 dark:text-white/45';
      const actionDisabledAttr = isDisabled ? 'disabled' : '';
      const disabledActionClass = isDisabled ? 'opacity-50 cursor-not-allowed' : '';
      const primaryActionMarkup = state.status === 'running'
        ? `<button type="button" onclick="window.pausePomodoroWorkspace && window.pausePomodoroWorkspace()" ${actionDisabledAttr} class="px-4 py-2.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-[12px] font-medium hover:opacity-90 transition-opacity ${disabledActionClass}">暂停</button>`
        : state.status === 'paused'
          ? `<button type="button" onclick="window.resumePomodoroWorkspace && window.resumePomodoroWorkspace()" ${actionDisabledAttr} class="px-4 py-2.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-[12px] font-medium hover:opacity-90 transition-opacity ${disabledActionClass}">继续</button>`
          : `<button type="button" onclick="window.startPomodoroWorkspace && window.startPomodoroWorkspace()" ${actionDisabledAttr} class="px-4 py-2.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-[12px] font-medium hover:opacity-90 transition-opacity ${disabledActionClass}">开始</button>`;
      const ringTrack = state.status === 'running'
        ? 'conic-gradient(from 180deg, rgba(17,24,39,0.92) 0deg, rgba(17,24,39,0.92) calc(3.6deg * var(--pomodoro-progress)), rgba(229,231,235,0.95) calc(3.6deg * var(--pomodoro-progress)), rgba(229,231,235,0.95) 360deg)'
        : 'conic-gradient(from 180deg, rgba(156,163,175,0.75) 0deg, rgba(156,163,175,0.75) calc(3.6deg * var(--pomodoro-progress)), rgba(229,231,235,0.95) calc(3.6deg * var(--pomodoro-progress)), rgba(229,231,235,0.95) 360deg)';
      const compactSummary = state.status === 'running' || state.status === 'paused'
        ? `${getPomodoroPhaseLabel(state.phase)} · ${getPomodoroStatusLabel(state.status)}`
        : `${getPomodoroPhaseLabel(state.phase)} · 准备开始`;

      const body = `
        <div class="flex flex-col gap-6 min-h-[calc(100vh-16rem)] justify-center" data-pomodoro-root>
          ${isDisabled
            ? `<div class="rounded-[1rem] border border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 px-4 py-3 text-[12px] leading-6 text-amber-800 dark:text-amber-200">当前插件处于关闭状态。番茄状态不会继续被 AI 读取；请先在插件页打开开关，再开始使用。</div>`
            : ''}
          <section class="mx-auto w-full max-w-3xl flex flex-col items-center text-center">
            <div
              class="relative flex items-center justify-center rounded-full p-4"
              style="--pomodoro-progress:${progress.toFixed(2)};background:${ringTrack};width:min(72vw,22rem);height:min(72vw,22rem);"
            >
              <div class="absolute rounded-full bg-white dark:bg-[#171717] border border-gray-200 dark:border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.06)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.28)]" style="inset:18px;"></div>
              <div class="relative z-[1] flex flex-col items-center justify-center px-6">
                <div class="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 px-3 py-1 text-[11px] font-medium ${statusToneClass} bg-white/70 dark:bg-white/[0.04]">${escapeHTML(compactSummary)}</div>
                <div class="mt-5 text-[clamp(3.75rem,10vw,5.5rem)] leading-none font-semibold tracking-tight tabular-nums text-gray-900 dark:text-white/95">${escapeHTML(formatPomodoroClock(state.remainingSeconds))}</div>
                <div class="mt-3 text-[13px] leading-6 text-gray-600 dark:text-white/68">${escapeHTML(currentTaskText)}</div>
              </div>
            </div>
            <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
              ${primaryActionMarkup}
              <button type="button" onclick="window.resetPomodoroWorkspace && window.resetPomodoroWorkspace()" ${actionDisabledAttr} class="px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10 text-[12px] font-medium text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${disabledActionClass}">重置</button>
              <button type="button" onclick="window.skipPomodoroWorkspacePhase && window.skipPomodoroWorkspacePhase()" ${actionDisabledAttr} class="px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10 text-[12px] font-medium text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${disabledActionClass}">切换阶段</button>
              <button type="button" onclick="window.openPomodoroWorkspaceSettings && window.openPomodoroWorkspaceSettings()" class="px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-white/10 text-[12px] font-medium text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">配置</button>
            </div>
            <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
              ${quickStarts.map((minutes) => `
                <button type="button" onclick="window.startPomodoroWorkspaceQuick && window.startPomodoroWorkspaceQuick(${Number(minutes) || 25})" ${actionDisabledAttr} class="px-3.5 py-2 rounded-2xl border border-gray-200 dark:border-white/10 text-[12px] font-medium text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${disabledActionClass}">${escapeHTML(String(minutes))} 分钟</button>
              `).join('')}
            </div>
            <div class="mt-6 flex flex-wrap items-center justify-center gap-3 text-[12px] text-gray-500 dark:text-white/45">
              <span class="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 px-3 py-1">今日 ${escapeHTML(String(today.focusCount))} 个番茄</span>
              <span class="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 px-3 py-1">专注 ${escapeHTML(String(today.focusMinutes))} 分钟</span>
              <span class="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 px-3 py-1">${escapeHTML(rhythmHint)}</span>
            </div>
          </section>
        </div>
      `;

      root.innerHTML = renderWorkspaceShell({
        title: shellCopy.title,
        englishTitle: shellCopy.englishTitle,
        description: shellCopy.description,
        leftActions: [],
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
        body,
      });
      restoreLocalPluginWorkspaceScroll(root);
      ensurePomodoroWorkspaceTicker(state.status === 'running');
      if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh({ root });
    }

    async function renderWechatArticleFormatterWorkspace(root, definition) {
      const runtime = getWechatArticleFormatterRuntimeModules();
      if (!runtime || typeof runtime.getPluginState !== 'function') {
        root.innerHTML = renderWorkspaceShell({
          title: definition?.name || '公众号排版器',
          englishTitle: 'WeChat Formatter',
          description: String(definition?.description || definition?.summary || '').trim(),
          leftActions: [],
          rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
          body: `<div class="rounded-[1rem] border border-dashed border-gray-200 dark:border-white/10 px-4 py-5 text-[12px] leading-7 text-gray-500 dark:text-white/45">公众号排版器 runtime 尚未加载。</div>`,
        });
        restoreLocalPluginWorkspaceScroll(root);
        return;
      }

      const shellCopy = resolveWorkspaceShellCopy(definition, {
        title: definition?.name || '公众号排版器',
        englishTitle: 'WeChat Formatter',
        description: String(definition?.description || definition?.summary || '').replace(/\s+/g, ' ').trim(),
      });
      const state = runtime.getPluginState({ sync: true });
      const article = runtime.buildRenderedArticle();
      const themes = typeof runtime.getThemes === 'function' ? runtime.getThemes() : [];
      const isDisabled = runtime.isEnabled && runtime.isEnabled() === false;
      const copiedLabel = article.lastCopiedAt ? `最近复制 ${formatWechatArticleFormatterCopiedAt(article.lastCopiedAt)}` : '尚未复制';
      const activeTheme = themes.find((theme) => theme.id === article.themeId) || themes[0] || null;
      const phoneBg = activeTheme?.phoneBg || '#f6f1ea';
      const phoneAccent = activeTheme?.accent || '#8b6b2b';
      const articleDateLabel = article.updatedAt ? formatWechatArticleFormatterCopiedAt(article.updatedAt) : '';

      const body = `
        <div class="flex flex-col gap-5">
          ${isDisabled
            ? `<div class="rounded-[1rem] border border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 px-4 py-3 text-[12px] leading-6 text-amber-800 dark:text-amber-200">当前插件处于关闭状态。你仍然可以临时查看内容，但建议先在插件页打开开关，再继续保存和复制。</div>`
            : ''}
          <section class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <div class="lg:sticky lg:top-4">
              <div class="px-4 py-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                    <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">手机预览</div>
                  <div id="wechat-article-formatter-meta" class="mt-2 text-[12px] leading-6 text-gray-600 dark:text-white/60">${escapeHTML(`${article.themeName} · ${article.charCount} 字 · ${article.wordCount} 词${article.lastCopiedAt ? ` · 最近复制 ${formatWechatArticleFormatterCopiedAt(article.lastCopiedAt)}` : ''}`)}</div>
                </div>
                <button type="button" onclick="copyWechatArticleFormatterArticle()" class="shrink-0 px-4 py-2.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-[12px] font-medium hover:opacity-90 transition-opacity">复制到公众号</button>
              </div>
                <div class="mt-4 px-4 py-5">
                  <div class="mx-auto w-full" style="max-width:390px;">
                    <div class="mb-3 flex items-center justify-between px-1">
                      <div class="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-[10px] font-mono tracking-wide text-gray-500 shadow-sm">
                        <span class="inline-block h-2 w-2 rounded-full" style="background:${escapeHTML(phoneAccent)}"></span>
                        公众号文章预览
                      </div>
                      <div class="text-[10px] font-mono text-gray-400">iPhone Mock</div>
                    </div>
                    <div class="relative mx-auto" style="width:min(390px,100%);border-radius:2.75rem;background:#1b1b1d;padding:10px;box-shadow:0 38px 120px rgba(15,23,42,0.22);">
                      <div class="pointer-events-none absolute" style="left:-3px;top:96px;height:40px;width:3px;border-radius:999px 0 0 999px;background:#2d2d30;"></div>
                      <div class="pointer-events-none absolute" style="left:-3px;top:160px;height:64px;width:3px;border-radius:999px 0 0 999px;background:#2d2d30;"></div>
                      <div class="pointer-events-none absolute" style="right:-3px;top:144px;height:80px;width:3px;border-radius:0 999px 999px 0;background:#2d2d30;"></div>
                      <div class="relative overflow-hidden" style="border-radius:2.25rem;background:${escapeHTML(phoneBg)};aspect-ratio:390/844;">
                        <div class="absolute left-1/2 top-2 z-[2] h-7 w-36 -translate-x-1/2 rounded-full shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]" style="background:#101012;"></div>
                        <div class="absolute inset-0 flex flex-col">
                          <div class="relative z-[1] flex items-center justify-between px-6 pt-4 pb-3 text-[11px] font-medium text-gray-700">
                            <span>9:41</span>
                            <span class="inline-flex items-center gap-1">
                              <span class="block h-2 w-2 rounded-full bg-gray-700/70"></span>
                              <span class="block h-2 w-2 rounded-full bg-gray-700/55"></span>
                              <span class="block h-2 w-5 rounded-sm border border-gray-700/60"></span>
                            </span>
                          </div>
                          <div class="mx-auto flex min-h-0 w-full flex-1 flex-col bg-white/96" style="box-shadow:inset 0 1px 0 rgba(255,255,255,0.8);">
                            <div class="flex shrink-0 items-center justify-between border-b border-black/6 px-4 py-3 text-[12px] text-gray-600">
                            <span class="inline-flex items-center gap-1.5">
                              <span class="text-[16px] leading-none text-gray-800">‹</span>
                              <span>公众号</span>
                            </span>
                            <span class="inline-flex items-center gap-2">
                              <span class="block h-1.5 w-1.5 rounded-full bg-gray-500/70"></span>
                              <span class="block h-1.5 w-1.5 rounded-full bg-gray-500/70"></span>
                              <span class="block h-1.5 w-1.5 rounded-full bg-gray-500/70"></span>
                            </span>
                            </div>
                            <div class="min-h-0 flex-1 overflow-y-auto" style="-webkit-overflow-scrolling:touch;">
                              <div class="px-5 pt-5 pb-2">
                                <div class="flex items-center gap-3">
                                  <div class="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-semibold text-white shadow-sm" style="background:${escapeHTML(phoneAccent)}">M</div>
                                  <div class="min-w-0 flex-1">
                                    <div class="truncate text-[13px] font-medium text-gray-900">Morpheus 排版实验室</div>
                                    <div class="mt-0.5 text-[11px] text-gray-400">${escapeHTML(articleDateLabel || '刚刚')} · 预览号</div>
                                  </div>
                                  <button type="button" class="rounded-full border px-3 py-1 text-[11px] font-medium" style="border-color:${escapeHTML(phoneAccent)};color:${escapeHTML(phoneAccent)};background:rgba(255,255,255,0.92)">关注</button>
                                </div>
                              </div>
                              <div class="px-5 pb-6">
                                <div id="wechat-article-formatter-preview">${article.html}</div>
                              </div>
                              <div class="border-t border-black/6 px-5 py-3 text-[11px] text-gray-400">
                                内容由公众号排版器预览生成，最终效果以微信编辑器为准。
                              </div>
                            </div>
                            <div class="flex shrink-0 justify-center pb-3 pt-2">
                              <div class="h-1.5 w-28 rounded-full bg-black/12"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="mt-4 border border-gray-200/80 bg-white/72 px-3.5 py-3 text-[12px] leading-6 text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45" style="border-radius:1rem;">左侧预览会尽量模拟手机阅读感受，但真正上线前还是建议粘贴进微信公众号编辑器再快速看一眼标题、引用和图片。</div>
              </div>
            </div>
            <div class="border border-gray-200 dark:border-white/10 bg-white/82 dark:bg-white/[0.03] px-4 py-4 dark:shadow-none" style="border-radius:1.35rem;box-shadow:0 18px 50px rgba(15,23,42,0.05);">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">正文编辑</div>
                  <div id="wechat-article-formatter-title-note" class="mt-2 text-[12px] leading-6 text-gray-600 dark:text-white/60">${escapeHTML(article.title && article.title !== '未命名文章' ? `当前标题：${article.title}` : '标题单独填写即可，正文区域直接像平时写文章一样写。')}</div>
                </div>
                <div class="text-[11px] font-mono text-gray-500 dark:text-white/45">${escapeHTML(copiedLabel)}</div>
              </div>
              <div class="mt-4 space-y-3">
                <label class="block">
                  <span class="text-[11px] font-medium text-gray-500 dark:text-white/50">标题</span>
                  <input
                    id="wechat-article-formatter-title"
                    type="text"
                    value="${escapeHTML(state.title || '')}"
                    oninput="previewWechatArticleFormatterTitle(this.value)"
                    onblur="persistWechatArticleFormatterDraft()"
                    placeholder="输入文章标题"
                    class="mt-1.5 w-full rounded-[0.95rem] border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3.5 py-3 text-[13px] text-gray-800 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/28 outline-none focus:border-black/15 dark:focus:border-white/20"
                  >
                </label>
                <label class="block">
                  <span class="text-[11px] font-medium text-gray-500 dark:text-white/50">正文</span>
                  <div class="mt-1.5 rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3.5 py-2.5 text-[12px] leading-6 text-gray-500 dark:text-white/55">直接正常写文章即可。空一行会分段，手动换行也会在复制时自动保留。</div>
                  <textarea
                    id="wechat-article-formatter-source"
                    rows="22"
                    oninput="previewWechatArticleFormatterSource(this.value)"
                    onblur="persistWechatArticleFormatterDraft()"
                    placeholder="从这里开始写正文"
                    class="mt-2 w-full rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-4 py-3.5 text-[15px] leading-8 text-gray-800 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/28 outline-none focus:border-black/15 dark:focus:border-white/20 resize-y"
                  >${escapeHTML(state.source || '')}</textarea>
                </label>
              </div>
              <div class="mt-4 flex flex-wrap items-center gap-2">
                ${themes.map((theme) => `
                  <button
                    type="button"
                    onclick="selectWechatArticleFormatterTheme('${escapeJSString(theme.id)}')"
                    class="px-3.5 py-2 rounded-full border text-[11px] font-medium transition-colors ${state.themeId === theme.id ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/[0.04] text-gray-600 dark:text-white/70'}"
                  >${escapeHTML(theme.name)}</button>
                `).join('')}
              </div>
              <div class="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onclick="persistWechatArticleFormatterDraft()" class="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-[11px] font-medium text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">保存草稿</button>
                <button type="button" onclick="resetWechatArticleFormatterDraft()" class="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-[11px] font-medium text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">恢复示例</button>
              </div>
              <div id="wechat-article-formatter-status" class="${getWechatArticleFormatterStatusClasses(wechatArticleFormatterViewState.statusTone)} mt-4">${escapeHTML(wechatArticleFormatterViewState.statusText)}</div>
              </div>
            </div>
          </section>
        </div>
      `;

      root.innerHTML = renderWorkspaceShell({
        title: shellCopy.title,
        englishTitle: shellCopy.englishTitle,
        description: shellCopy.description,
        leftActions: [],
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
        body,
      });
      restoreLocalPluginWorkspaceScroll(root);
      refreshWechatArticleFormatterPreview(root);
      if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh({ root });
    }

    window.previewWechatArticleFormatterSource = function previewWechatArticleFormatterSource(value = '') {
      const runtime = getWechatArticleFormatterRuntimeModules();
      if (!runtime || typeof runtime.updateDraft !== 'function') return;
      runtime.updateDraft({ source: value }, { save: false, skipRender: true, skipUndo: true });
      setWechatArticleFormatterStatus('正在预览当前草稿。', 'neutral');
      refreshWechatArticleFormatterPreview(document);
    };

    window.previewWechatArticleFormatterTitle = function previewWechatArticleFormatterTitle(value = '') {
      const runtime = getWechatArticleFormatterRuntimeModules();
      if (!runtime || typeof runtime.updateDraft !== 'function') return;
      runtime.updateDraft({ title: value }, { save: false, skipRender: true, skipUndo: true });
      setWechatArticleFormatterStatus('标题已更新到预览。', 'neutral');
      refreshWechatArticleFormatterPreview(document);
    };

    window.persistWechatArticleFormatterDraft = function persistWechatArticleFormatterDraft() {
      const runtime = getWechatArticleFormatterRuntimeModules();
      if (!runtime || typeof runtime.persistState !== 'function') return;
      runtime.persistState();
      setWechatArticleFormatterStatus('草稿已保存。', 'success');
      refreshWechatArticleFormatterPreview(document);
    };

    window.selectWechatArticleFormatterTheme = function selectWechatArticleFormatterTheme(themeId = '') {
      const runtime = getWechatArticleFormatterRuntimeModules();
      if (!runtime || typeof runtime.updateDraft !== 'function') return;
      runtime.updateDraft({ themeId }, { save: true, skipRender: true });
      setWechatArticleFormatterStatus('主题已切换。', 'success');
      void renderView();
    };

    window.copyWechatArticleFormatterArticle = async function copyWechatArticleFormatterArticle() {
      const runtime = getWechatArticleFormatterRuntimeModules();
      if (!runtime || typeof runtime.copyRenderedArticle !== 'function') return;
      const result = await runtime.copyRenderedArticle();
      setWechatArticleFormatterStatus(result?.message || '复制完成。', result?.ok ? 'success' : 'error');
      refreshWechatArticleFormatterPreview(document);
    };

    window.resetWechatArticleFormatterDraft = function resetWechatArticleFormatterDraft() {
      const runtime = getWechatArticleFormatterRuntimeModules();
      if (!runtime || typeof runtime.restoreDefaultDraft !== 'function') return;
      const commitReset = function commitReset() {
        runtime.restoreDefaultDraft();
        setWechatArticleFormatterStatus('已恢复为示例草稿。', 'success');
        void renderView();
      };
      if (typeof api.openCustomModal === 'function') {
        api.openCustomModal({
          title: '恢复默认示例？',
          desc: '这会覆盖当前排版草稿，但不会影响其他插件数据。',
          onConfirm: commitReset,
        });
        return;
      }
      commitReset();
    };

    async function renderCodexRemoteWorkspace(root, definition) {
      const runtime = getLocalPluginCodexRemoteRuntimeModules();
      if (runtime && typeof runtime.renderWorkspace === 'function') {
        await runtime.renderWorkspace(root, definition);
        return;
      }
      root.innerHTML = renderWorkspaceShell({
        title: definition?.name || 'Codex Remote',
        englishTitle: '',
        description: String(definition?.description || definition?.summary || '').trim(),
        leftActions: [],
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
        body: `<div class="rounded-[1rem] border border-dashed border-gray-200 dark:border-white/10 px-4 py-5 text-[12px] leading-7 text-gray-500 dark:text-white/45">Codex Remote runtime 尚未加载。</div>`,
      });
      restoreLocalPluginWorkspaceScroll(root);
      if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh({ root });
    }

    function getVisualOrganizerPluginState() {
      return typeof api.getVisualOrganizerPluginState === 'function'
        ? api.getVisualOrganizerPluginState()
        : { selectedTemplate: 'auto', draftPrompt: '', activeOrganizerId: '', organizers: [] };
    }

    function setVisualOrganizerPluginState(updater = null, options = {}) {
      if (typeof api.setVisualOrganizerPluginState !== 'function') return null;
      return api.setVisualOrganizerPluginState(updater, options);
    }

    function getVisualOrganizerTemplateCatalog() {
      return [
        { key: 'auto', label: '自动', accent: '由 AI 自动选最合适模板', color: 'from-stone-200 via-white to-stone-100' },
        { key: 'compare-map', label: '对比图', accent: '看相同点、不同点、优缺点', color: 'from-amber-200 via-white to-rose-100' },
        { key: 'concept-definition-map', label: '概念定义', accent: '适合理解一个概念是什么', color: 'from-sky-200 via-white to-cyan-100' },
        { key: 'hierarchy-diagram', label: '层级图', accent: '适合组织结构、分类层级', color: 'from-emerald-200 via-white to-lime-100' },
        { key: 'kwhl-chart', label: 'KWHL', accent: '适合学习前中后梳理', color: 'from-violet-200 via-white to-fuchsia-100' },
        { key: 'main-concepts-map', label: '主概念图', accent: '中心主题向外发散', color: 'from-orange-200 via-white to-yellow-100' },
        { key: 'circle-organizer', label: '循环流程', accent: '适合步骤、循环与过程', color: 'from-teal-200 via-white to-cyan-100' },
        { key: 'big-question-map', label: '大问题图', accent: '围绕一个问题展开分析', color: 'from-rose-200 via-white to-orange-100' },
        { key: 'problem-solving-organizer', label: '问题解决', accent: '把问题、原因、方案排清楚', color: 'from-blue-200 via-white to-indigo-100' },
      ];
    }

    function getVisualOrganizerTemplateMeta(templateKey = 'auto') {
      const key = String(templateKey || 'auto').trim();
      return getVisualOrganizerTemplateCatalog().find((item) => item.key === key) || getVisualOrganizerTemplateCatalog()[0];
    }

    function sanitizeInlineText(value = '', maxLength = 120) {
      return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    }

    function sanitizeMermaidSource(value = '', maxLength = 12000) {
      return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, maxLength);
    }

    function buildFallbackMermaidSource(organizer = null) {
      const title = sanitizeInlineText(organizer?.centralTopic || organizer?.title || '视觉组织图', 60) || '视觉组织图';
      const sections = buildVisualOrganizerSectionFallback(organizer);
      const direction = String(organizer?.templateKey || '').trim() === 'compare-map' ? 'LR' : 'TD';
      const lines = [`flowchart ${direction}`, `  root["${title.replace(/"/g, "'")}"]`];
      sections.slice(0, 5).forEach((section, sectionIndex) => {
        const sectionId = `s${sectionIndex + 1}`;
        lines.push(`  root --> ${sectionId}["${sanitizeInlineText(section?.title || '板块', 36).replace(/"/g, "'")}"]`);
        (Array.isArray(section?.items) ? section.items : []).slice(0, 5).forEach((item, itemIndex) => {
          const itemId = `${sectionId}_${itemIndex + 1}`;
          lines.push(`  ${sectionId} --> ${itemId}["${sanitizeInlineText(item, 48).replace(/"/g, "'")}"]`);
        });
      });
      return lines.join('\n');
    }

    function syncVisualOrganizerManualDraftFromOrganizer(organizer = null) {
      const targetId = String(organizer?.id || '').trim();
      if (!targetId) {
        visualOrganizerManualDraftState.organizerId = '';
        visualOrganizerManualDraftState.title = '';
        visualOrganizerManualDraftState.summary = '';
        visualOrganizerManualDraftState.mermaidSource = '';
        visualOrganizerManualDraftState.dirty = false;
        visualOrganizerManualDraftState.lastRenderedSource = '';
        visualOrganizerManualDraftState.renderError = '';
        return;
      }
      if (visualOrganizerManualDraftState.organizerId === targetId && visualOrganizerManualDraftState.dirty) return;
      visualOrganizerManualDraftState.organizerId = targetId;
      visualOrganizerManualDraftState.title = String(organizer?.title || '');
      visualOrganizerManualDraftState.summary = String(organizer?.summary || '');
      visualOrganizerManualDraftState.mermaidSource = sanitizeMermaidSource(organizer?.mermaidSource || buildFallbackMermaidSource(organizer));
      visualOrganizerManualDraftState.dirty = false;
      visualOrganizerManualDraftState.lastRenderedSource = '';
      visualOrganizerManualDraftState.renderError = '';
    }

    function readVisualOrganizerManualDraftFromDom() {
      const titleInput = document.getElementById('visual-organizer-manual-title');
      const summaryInput = document.getElementById('visual-organizer-manual-summary');
      const mermaidInput = document.getElementById('visual-organizer-mermaid-editor');
      if (titleInput) visualOrganizerManualDraftState.title = String(titleInput.value || '');
      if (summaryInput) visualOrganizerManualDraftState.summary = String(summaryInput.value || '');
      if (mermaidInput) visualOrganizerManualDraftState.mermaidSource = sanitizeMermaidSource(mermaidInput.value || '');
      visualOrganizerManualDraftState.dirty = true;
      return visualOrganizerManualDraftState;
    }

    function markVisualOrganizerManualDraftDirty() {
      readVisualOrganizerManualDraftFromDom();
      const status = document.getElementById('visual-organizer-mermaid-status');
      if (status) {
        status.textContent = '有未保存的 Mermaid 手动修改';
        status.className = 'text-[11px] leading-6 text-amber-600 dark:text-amber-300/85';
      }
    }

    async function previewVisualOrganizerManualDraft() {
      readVisualOrganizerManualDraftFromDom();
      return renderVisualOrganizerMermaidPreview(visualOrganizerManualDraftState.mermaidSource);
    }

    async function saveVisualOrganizerManualDraft() {
      const organizerId = sanitizeInlineText(visualOrganizerManualDraftState.organizerId, 48);
      if (!organizerId) return false;
      readVisualOrganizerManualDraftFromDom();
      const draftTitle = sanitizeInlineText(visualOrganizerManualDraftState.title, 80);
      const draftSummary = sanitizeInlineText(visualOrganizerManualDraftState.summary, 180);
      const draftMermaidSource = sanitizeMermaidSource(visualOrganizerManualDraftState.mermaidSource);
      if (!draftMermaidSource) {
        const status = document.getElementById('visual-organizer-mermaid-status');
        if (status) {
          status.textContent = '先写一点 Mermaid 内容，再保存手动修改。';
          status.className = 'text-[11px] leading-6 text-red-600 dark:text-red-300/85';
        }
        return false;
      }
      setVisualOrganizerPluginState((prev) => {
        const organizers = Array.isArray(prev?.organizers) ? prev.organizers : [];
        return {
          ...prev,
          activeOrganizerId: organizerId,
          organizers: organizers.map((item) => {
            if (String(item?.id || '') !== organizerId) return item;
            return {
              ...item,
              title: draftTitle || String(item?.title || ''),
              centralTopic: draftTitle || String(item?.centralTopic || item?.title || ''),
              summary: draftSummary,
              mermaidSource: draftMermaidSource,
              updatedAt: new Date().toISOString(),
            };
          }),
        };
      }, { save: true, skipRender: true });
      visualOrganizerManualDraftState.dirty = false;
      visualOrganizerManualDraftState.lastRenderedSource = draftMermaidSource;
      const status = document.getElementById('visual-organizer-mermaid-status');
      if (status) {
        status.textContent = '手动修改已保存到当前视觉组织图';
        status.className = 'text-[11px] leading-6 text-emerald-600 dark:text-emerald-300/85';
      }
      rerenderVisualOrganizerWorkspace();
      return true;
    }

    async function resetVisualOrganizerManualDraft() {
      const pluginState = getVisualOrganizerPluginState();
      const organizer = getVisualOrganizerActiveItem(pluginState);
      if (!organizer) return false;
      readVisualOrganizerManualDraftFromDom();
      const nextTitle = sanitizeInlineText(visualOrganizerManualDraftState.title || organizer?.title || organizer?.centralTopic || '', 80)
        || sanitizeInlineText(organizer?.title || organizer?.centralTopic || '', 80)
        || '视觉组织图';
      const nextSummary = String(visualOrganizerManualDraftState.summary || organizer?.summary || '');
      const rebuiltSource = buildFallbackMermaidSource({
        ...organizer,
        title: nextTitle,
        centralTopic: nextTitle,
        summary: nextSummary,
      });
      visualOrganizerManualDraftState.title = nextTitle;
      visualOrganizerManualDraftState.summary = nextSummary;
      visualOrganizerManualDraftState.mermaidSource = sanitizeMermaidSource(rebuiltSource);
      visualOrganizerManualDraftState.dirty = true;
      const titleInput = document.getElementById('visual-organizer-manual-title');
      const summaryInput = document.getElementById('visual-organizer-manual-summary');
      const mermaidInput = document.getElementById('visual-organizer-mermaid-editor');
      if (titleInput) titleInput.value = visualOrganizerManualDraftState.title;
      if (summaryInput) summaryInput.value = visualOrganizerManualDraftState.summary;
      if (mermaidInput) mermaidInput.value = visualOrganizerManualDraftState.mermaidSource;
      const status = document.getElementById('visual-organizer-mermaid-status');
      if (status) {
        status.textContent = 'Mermaid 已按当前结构重置，记得保存';
        status.className = 'text-[11px] leading-6 text-amber-600 dark:text-amber-300/85';
      }
      await renderVisualOrganizerMermaidPreview(visualOrganizerManualDraftState.mermaidSource);
      return true;
    }

    async function ensureMermaidRuntime() {
      const runtime = window.mermaid || window.mermaidAPI || null;
      if (runtime && typeof runtime.render === 'function') return runtime;
      if (mermaidLoaderPromise) return mermaidLoaderPromise;
      mermaidLoaderPromise = new Promise((resolve) => {
        const existing = document.querySelector('script[data-mermaid-runtime="1"]');
        if (existing) {
          existing.addEventListener('load', () => resolve(window.mermaid || null), { once: true });
          existing.addEventListener('error', () => resolve(null), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = 'assets/js/vendor/mermaid.min.js?v=20260316-visual-organizer-01';
        script.async = true;
        script.dataset.mermaidRuntime = '1';
        script.onload = () => {
          const loaded = window.mermaid || null;
          try {
            if (loaded && typeof loaded.initialize === 'function') {
              loaded.initialize({
                startOnLoad: false,
                securityLevel: 'loose',
                theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
              });
            }
          } catch (_) {}
          resolve(loaded);
        };
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
      });
      return mermaidLoaderPromise;
    }

    async function renderVisualOrganizerMermaidPreview(source = '') {
      const host = document.getElementById('visual-organizer-mermaid-preview');
      const status = document.getElementById('visual-organizer-mermaid-status');
      const fallback = document.getElementById('visual-organizer-mermaid-fallback');
      if (!host) return false;
      const normalized = sanitizeMermaidSource(source || visualOrganizerManualDraftState.mermaidSource || '');
      if (!normalized) {
        host.innerHTML = '<div class="text-[11px] leading-6 text-gray-400 dark:text-white/35">还没有 Mermaid 图谱代码。</div>';
        if (fallback) fallback.textContent = '';
        if (status) {
          status.textContent = '等待 Mermaid 内容';
          status.className = 'text-[11px] leading-6 text-gray-500 dark:text-white/45';
        }
        return false;
      }
      const mermaidRuntime = await ensureMermaidRuntime();
      if (!mermaidRuntime || typeof mermaidRuntime.render !== 'function') {
        host.innerHTML = '<div class="text-[11px] leading-6 text-gray-400 dark:text-white/35">Mermaid 运行时加载失败，先看下方源码。</div>';
        if (fallback) fallback.textContent = normalized;
        if (status) {
          status.textContent = 'Mermaid 预览不可用，但源码已保留';
          status.className = 'text-[11px] leading-6 text-red-600 dark:text-red-300/85';
        }
        visualOrganizerManualDraftState.renderError = 'mermaid_runtime_unavailable';
        return false;
      }
      try {
        const renderId = `visualOrganizerMermaid${Date.now().toString(36)}`;
        const result = await mermaidRuntime.render(renderId, normalized);
        host.innerHTML = String(result?.svg || '');
        if (typeof result?.bindFunctions === 'function') {
          try { result.bindFunctions(host); } catch (_) {}
        }
        if (fallback) fallback.textContent = normalized;
        if (status) {
          status.textContent = visualOrganizerManualDraftState.dirty ? 'Mermaid 预览已更新，记得保存' : 'Mermaid 预览已同步';
          status.className = `text-[11px] leading-6 ${visualOrganizerManualDraftState.dirty ? 'text-amber-600 dark:text-amber-300/85' : 'text-emerald-600 dark:text-emerald-300/85'}`;
        }
        visualOrganizerManualDraftState.lastRenderedSource = normalized;
        visualOrganizerManualDraftState.renderError = '';
        return true;
      } catch (error) {
        host.innerHTML = '<div class="text-[11px] leading-6 text-red-600 dark:text-red-300/85">Mermaid 语法暂时无法渲染，请检查下面的源码。</div>';
        if (fallback) fallback.textContent = normalized;
        if (status) {
          status.textContent = String(error?.message || 'Mermaid 渲染失败');
          status.className = 'text-[11px] leading-6 text-red-600 dark:text-red-300/85';
        }
        visualOrganizerManualDraftState.renderError = String(error?.message || 'render_failed');
        return false;
      }
    }

    function buildVisualOrganizerPromptExamples(templateKey = 'auto') {
      const key = String(templateKey || 'auto').trim();
      if (key === 'compare-map') {
        return [
          '带我认识对比图，并给我一个可以自己继续修改的骨架',
          '我想学习怎么做对比图，先帮我搭一个基本结构',
        ];
      }
      if (key === 'kwhl-chart') {
        return [
          '带我学习 KWHL 图是什么，并先铺一个可练习的骨架',
          '我想认识 KWHL 图的结构，先做一张空白练习图',
        ];
      }
      if (key === 'hierarchy-diagram') {
        return [
          '教我层级图怎么做，并先搭一个层级骨架',
          '我想学习层级图的组织方式，先给我一张示范图',
        ];
      }
      return [
        '带我认识视觉组织图，并给我一张可修改的示范图',
        '我想学习怎么自己做视觉组织图，请先铺一个练习骨架',
      ];
    }

    function getVisualOrganizerOverlayPanelState(panelKey = 'assistant') {
      const key = panelKey === 'assistant' ? 'assistant' : 'assistant';
      return visualOrganizerOverlayState.panels[key];
    }

    function buildVisualOrganizerOverlayPanelStyle(panelKey = 'assistant') {
      const panel = getVisualOrganizerOverlayPanelState(panelKey);
      const x = Number(panel?.x);
      const y = Number(panel?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return 'right:16px;top:180px;left:auto;bottom:auto;';
      return `left:${Math.max(12, Math.round(x))}px;top:${Math.max(180, Math.round(y))}px;right:auto;bottom:auto;`;
    }

    function buildVisualOrganizerStarterOrganizer(templateKey = 'auto') {
      const key = sanitizeInlineText(templateKey, 48) || 'auto';
      const templateMeta = getVisualOrganizerTemplateMeta(key);
      const title = key === 'auto' ? '视觉组织图练习板' : `${templateMeta.label}练习板`;
      const centralTopic = key === 'big-question-map' ? '' : templateMeta.label;
      const focusQuestion = key === 'big-question-map' ? '我想通过这张图回答什么问题？' : '';
      const sections = key === 'compare-map'
        ? [
            { title: '对象 A', items: ['比较点 1', '比较点 2'] },
            { title: '对象 B', items: ['比较点 1', '比较点 2'] },
          ]
        : key === 'kwhl-chart'
          ? [
              { title: 'K 我已知道', items: ['先写下已知内容'] },
              { title: 'W 我想知道', items: ['写下想弄懂的问题'] },
              { title: 'H 我怎么学', items: ['写下学习方法'] },
              { title: 'L 我学到了', items: ['最后回收结果'] },
            ]
          : [
              { title: '主板块 1', items: ['要点 1', '要点 2'] },
              { title: '主板块 2', items: ['要点 1', '要点 2'] },
              { title: '主板块 3', items: ['要点 1'] },
            ];
      return {
        id: '',
        templateKey: key,
        title,
        summary: '这是你的练习白板，可以直接双击、拖拽、继续搭建。',
        centralTopic,
        focusQuestion,
        sections,
      };
    }

    function getVisualOrganizerTemplateLearningCopy(templateKey = 'auto') {
      const key = String(templateKey || 'auto').trim();
      if (key === 'compare-map') {
        return {
          purpose: '适合练习“同一维度下的相同点和不同点”。',
          structure: '通常至少有两边对象，再加上比较维度或共同点区域。',
          makingTip: '先写比较对象，再统一比较维度，不要左边讲功能、右边讲历史。',
        };
      }
      if (key === 'concept-definition-map') {
        return {
          purpose: '适合学习“一个概念是什么、有什么特征、有哪些例子”。',
          structure: '中心放概念，外层放定义、特征、例子、非例子。',
          makingTip: '先用一句话说清概念，再补特征和例子，不要一开始就堆材料。',
        };
      }
      if (key === 'hierarchy-diagram') {
        return {
          purpose: '适合学习“由总到分、由上到下”的层级关系。',
          structure: '顶层是总类，下面一层层往下拆分。',
          makingTip: '每一层最好只表达同一种拆分标准，避免一层里混进不同逻辑。',
        };
      }
      if (key === 'kwhl-chart') {
        return {
          purpose: '适合学习前后对照，记录已知、想知、怎么学、学到了什么。',
          structure: '常见四格是 K / W / H / L。',
          makingTip: '先写 K 和 W，再补 H，最后在 L 里回收学习结果。',
        };
      }
      if (key === 'main-concepts-map') {
        return {
          purpose: '适合围绕一个中心主题向外发散，建立主概念和分支。',
          structure: '中心一个核心词，外面是几个大分支，再往下补细节。',
          makingTip: '先保留 3 到 5 个主分支，不要一上来就把图铺得太散。',
        };
      }
      if (key === 'circle-organizer') {
        return {
          purpose: '适合学习循环过程、连续步骤或阶段变化。',
          structure: '通常是一圈或一条连续链路，强调先后衔接。',
          makingTip: '每一步都用动词开头，更容易看出流程感。',
        };
      }
      if (key === 'big-question-map') {
        return {
          purpose: '适合围绕一个核心问题，把不同回答方向展开。',
          structure: '中心是问题，外围是分析角度、证据、回答路径。',
          makingTip: '先把问题写得够清楚，再决定周围是观点、证据还是条件。',
        };
      }
      if (key === 'problem-solving-organizer') {
        return {
          purpose: '适合梳理问题、原因、影响和解决方案。',
          structure: '常见结构是“问题 -> 原因 -> 方案 -> 结果/验证”。',
          makingTip: '不要把“现象”和“原因”写在同一层，先分清再往下画。',
        };
      }
      return {
        purpose: '适合先认识视觉组织图的基本组成，再决定用哪一种图型。',
        structure: '通常先有中心主题，再有几个大板块，最后补要点。',
        makingTip: '先搭骨架，再补内容；先让结构成立，再追求好看。',
      };
    }

    function buildVisualOrganizerCoachInsights(organizer = null) {
      const sections = buildVisualOrganizerEditableSections(organizer);
      const items = sections.flatMap((section) => Array.isArray(section?.items) ? section.items : []);
      const templateKey = String(organizer?.templateKey || 'auto').trim();
      const insights = [];
      if (!sanitizeInlineText(organizer?.centralTopic || organizer?.focusQuestion || organizer?.title || '', 80)) {
        insights.push('先放一个清楚的中心主题，整张图才有锚点。');
      }
      if (!sections.length) {
        insights.push('先搭 2 到 4 个主板块，再慢慢往里补要点。');
      } else if (sections.length === 1) {
        insights.push('目前只有 1 个主板块，可以再拆成几个并列分支。');
      } else if (sections.length >= 6) {
        insights.push('主板块已经比较多了，先检查有没有可以合并的同类项。');
      }
      if (items.length < 3) {
        insights.push('可以再补 3 到 5 个要点，让这张图更像完整的视觉组织图。');
      }
      if (templateKey === 'compare-map' && sections.length < 2) {
        insights.push('对比图至少要有两个比较对象，再考虑比较维度。');
      }
      if (templateKey === 'kwhl-chart') {
        const titles = sections.map((item) => sanitizeInlineText(item?.title || '', 24).toUpperCase());
        if (!titles.some((item) => item.startsWith('K'))) insights.push('KWHL 图里可以先补一个 K 区，写“我已知道什么”。');
        if (!titles.some((item) => item.startsWith('W'))) insights.push('再补一个 W 区，写“我还想知道什么”。');
      }
      if (templateKey === 'hierarchy-diagram' && sections.length >= 2) {
        insights.push('层级图要注意上下级逻辑是否一致，别把不同分类标准混在一层。');
      }
      if (templateKey === 'main-concepts-map' && sections.length >= 5) {
        insights.push('主概念图可以优先保留最核心的 3 到 5 条主分支，先别扩太散。');
      }
      return insights.slice(0, 3);
    }

    function ensureVisualOrganizerOverlayDragBindings() {
      if (visualOrganizerOverlayState.listenersBound) return;
      const handleMove = (event) => {
        const panelKey = String(visualOrganizerOverlayState.dragging.panelKey || '').trim();
        if (!panelKey) return;
        const host = document.getElementById('visual-organizer-overlay-root');
        const panel = document.querySelector(`[data-visual-organizer-panel="${panelKey}"]`);
        if (!host || !panel) return;
        const hostRect = host.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const nextX = event.clientX - hostRect.left - Number(visualOrganizerOverlayState.dragging.offsetX || 0);
        const nextY = event.clientY - hostRect.top - Number(visualOrganizerOverlayState.dragging.offsetY || 0);
        const minX = 12;
        const minY = 180;
        const maxX = Math.max(minX, hostRect.width - panelRect.width - 12);
        const maxY = Math.max(minY, hostRect.height - panelRect.height - 12);
        const x = Math.max(minX, Math.min(nextX, maxX));
        const y = Math.max(minY, Math.min(nextY, maxY));
        const state = getVisualOrganizerOverlayPanelState(panelKey);
        state.x = x;
        state.y = y;
        panel.style.left = `${Math.round(x)}px`;
        panel.style.top = `${Math.round(y)}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
      };
      const clearDrag = () => {
        visualOrganizerOverlayState.dragging.panelKey = '';
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', clearDrag);
      visualOrganizerOverlayState.listenersBound = true;
    }

    window.startVisualOrganizerOverlayDrag = function startVisualOrganizerOverlayDrag(event = null, panelKey = 'assistant') {
      const key = panelKey === 'assistant' ? 'assistant' : 'assistant';
      const host = document.getElementById('visual-organizer-overlay-root');
      const panel = document.querySelector(`[data-visual-organizer-panel="${key}"]`);
      if (!host || !panel || !event) return;
      ensureVisualOrganizerOverlayDragBindings();
      const hostRect = host.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const state = getVisualOrganizerOverlayPanelState(key);
      state.x = panelRect.left - hostRect.left;
      state.y = panelRect.top - hostRect.top;
      visualOrganizerOverlayState.dragging.panelKey = key;
      visualOrganizerOverlayState.dragging.offsetX = event.clientX - panelRect.left;
      visualOrganizerOverlayState.dragging.offsetY = event.clientY - panelRect.top;
      if (event.preventDefault) event.preventDefault();
    };

    window.toggleVisualOrganizerOverlayPanel = function toggleVisualOrganizerOverlayPanel(panelKey = 'assistant') {
      const panel = getVisualOrganizerOverlayPanelState(panelKey);
      panel.collapsed = !panel.collapsed;
      if (panel.collapsed) {
        panel.x = null;
        panel.y = null;
      }
      rerenderVisualOrganizerWorkspace();
    };

    function buildVisualOrganizerFloatingOverlayHtml(organizer = null, pluginState = null) {
      const safeState = pluginState && typeof pluginState === 'object' ? pluginState : getVisualOrganizerPluginState();
      const templateMeta = getVisualOrganizerTemplateMeta(organizer?.templateKey || visualOrganizerComposerState.templateKey || 'auto');
      const learningCopy = getVisualOrganizerTemplateLearningCopy(organizer?.templateKey || visualOrganizerComposerState.templateKey || 'auto');
      const examples = buildVisualOrganizerPromptExamples(visualOrganizerComposerState.templateKey || organizer?.templateKey || 'auto');
      const insights = buildVisualOrganizerCoachInsights(organizer);
      const sections = buildVisualOrganizerEditableSections(organizer);
      const itemCount = sections.reduce((sum, section) => sum + ((Array.isArray(section?.items) ? section.items.length : 0)), 0);
      const assistantPanel = getVisualOrganizerOverlayPanelState('assistant');
      const statusHtml = visualOrganizerComposerState.statusText
        ? `<div class="rounded-[1rem] border px-3 py-2.5 text-[11px] leading-6 ${visualOrganizerComposerState.statusError ? 'border-red-200 bg-red-50/96 text-red-700 dark:border-red-400/20 dark:bg-red-500/[0.14] dark:text-red-200' : 'border-sky-200 bg-sky-50/96 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/[0.14] dark:text-sky-200'}">${escapeHTML(visualOrganizerComposerState.statusText)}</div>`
        : '';
      const isDraft = !sanitizeInlineText(organizer?.id || '', 48);
      return `
        <div id="visual-organizer-overlay-root" class="absolute inset-0 pointer-events-none z-[5]">
          ${assistantPanel.collapsed ? `
            <div class="absolute right-4 top-[180px] pointer-events-auto max-w-[calc(100%-2rem)]">
              <button type="button" onclick="toggleVisualOrganizerOverlayPanel('assistant')" class="rounded-full border border-white/70 dark:border-white/12 bg-white/88 dark:bg-[#101010]/88 backdrop-blur-xl shadow-[0_18px_48px_rgba(15,23,42,0.16)] px-4 py-2 text-[12px] font-medium text-black dark:text-white/88">AI 教练</button>
            </div>
          ` : ''}
          <div data-visual-organizer-panel="assistant" style="${buildVisualOrganizerOverlayPanelStyle('assistant')}" class="absolute right-4 top-[180px] w-[min(360px,calc(100%-2rem))] pointer-events-auto">
            ${assistantPanel.collapsed ? '' : `
            <div class="rounded-[1.35rem] border border-white/70 dark:border-white/12 bg-white/88 dark:bg-[#101010]/88 backdrop-blur-xl shadow-[0_24px_70px_rgba(15,23,42,0.16)] px-4 py-4">
              <div class="flex items-center justify-between gap-2 mb-3">
                <button type="button" onmousedown="startVisualOrganizerOverlayDrag(event, 'assistant')" class="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/35 cursor-move">
                  <span>拖动</span><span>::</span>
                </button>
                <button type="button" onclick="toggleVisualOrganizerOverlayPanel('assistant')" class="h-7 px-3 rounded-full border border-gray-200 dark:border-white/10 text-[11px] text-gray-600 dark:text-white/68 bg-white/70 dark:bg-white/[0.04]">收起</button>
              </div>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/35">AI 教练</div>
                  <div class="mt-1 text-[14px] font-medium text-black dark:text-white/92">边学边做这类图</div>
                </div>
                ${buildVisualOrganizerBadge(templateMeta.label, 'active')}
              </div>
              <div class="mt-3 text-[12px] leading-6 text-gray-600 dark:text-white/65">输入你想学习的图型或制作动作，AI 先铺骨架；同时这张卡会告诉你这种图怎么用、怎么搭、现在还差什么。</div>
              ${statusHtml ? `<div class="mt-3">${statusHtml}</div>` : ''}
              <textarea id="visual-organizer-prompt-input" rows="4" onchange="updateVisualOrganizerPrompt(this.value)" placeholder="例如：带我认识对比图，并给我一个我能继续自己改的骨架。" class="mt-3 w-full rounded-[1rem] border border-gray-200/90 dark:border-white/10 bg-white/92 dark:bg-white/[0.05] px-3.5 py-3 text-[12px] leading-6 text-gray-800 dark:text-white/85 outline-none focus:border-black/20 dark:focus:border-white/20 resize-none">${escapeHTML(visualOrganizerComposerState.prompt || '')}</textarea>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" onclick="generateVisualOrganizerWorkspaceDraft()" class="px-3.5 py-2 rounded-2xl bg-black text-white dark:bg-white dark:text-black text-[12px] font-medium">${visualOrganizerComposerState.busy ? 'AI 铺图中…' : 'AI 铺骨架'}</button>
                <button type="button" onclick="toggleVisualOrganizerWorkspaceVoice()" class="px-3.5 py-2 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/88 dark:bg-white/[0.04] text-[12px] font-medium text-gray-700 dark:text-white/78">${visualOrganizerVoiceState.running ? '停止语音' : '语音口令'}</button>
                <button type="button" onclick="resetVisualOrganizerExcalidrawLayout()" class="px-3.5 py-2 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/88 dark:bg-white/[0.04] text-[12px] font-medium text-gray-700 dark:text-white/78">重排骨架</button>
                ${isDraft ? `<button type="button" onclick="createVisualOrganizerPracticeBoard()" class="px-3.5 py-2 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/88 dark:bg-white/[0.04] text-[12px] font-medium text-gray-700 dark:text-white/78">开始空白练习</button>` : ''}
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                ${buildVisualOrganizerTemplatePills(visualOrganizerComposerState.templateKey || 'auto')}
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" onclick="updateVisualOrganizerPrompt('${escapeJSString(examples[0] || '')}')" class="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[11px] text-gray-600 dark:text-white/65 bg-white/72 dark:bg-white/[0.04]">示例 1</button>
                <button type="button" onclick="updateVisualOrganizerPrompt('${escapeJSString(examples[1] || '')}')" class="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[11px] text-gray-600 dark:text-white/65 bg-white/72 dark:bg-white/[0.04]">示例 2</button>
              </div>
              ${(visualOrganizerVoiceState.interimText && visualOrganizerVoiceState.running) ? `<div class="mt-2 text-[11px] leading-6 text-gray-500 dark:text-white/45">实时口令：${escapeHTML(visualOrganizerVoiceState.interimText)}</div>` : ''}
              <div class="mt-3 space-y-2 text-[12px] leading-6 text-gray-600 dark:text-white/68">
                <div><span class="font-medium text-black dark:text-white/90">用途：</span>${escapeHTML(learningCopy.purpose)}</div>
                <div><span class="font-medium text-black dark:text-white/90">结构：</span>${escapeHTML(learningCopy.structure)}</div>
                <div><span class="font-medium text-black dark:text-white/90">制作提醒：</span>${escapeHTML(learningCopy.makingTip)}</div>
              </div>
              <div class="mt-4 grid grid-cols-3 gap-2">
                <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-2">
                  <div class="text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/35">板块</div>
                  <div class="mt-1 text-[16px] font-semibold text-black dark:text-white/90">${sections.length}</div>
                </div>
                <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-2">
                  <div class="text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/35">要点</div>
                  <div class="mt-1 text-[16px] font-semibold text-black dark:text-white/90">${itemCount}</div>
                </div>
                <div class="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-2">
                  <div class="text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/35">图数</div>
                  <div class="mt-1 text-[16px] font-semibold text-black dark:text-white/90">${Array.isArray(safeState.organizers) ? safeState.organizers.length : 0}</div>
                </div>
              </div>
              ${insights.length ? `
                <div class="mt-4">
                  <div class="text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/35">现在最值得补的地方</div>
                  <div class="mt-2 flex flex-col gap-2">
                    ${insights.map((item) => `<div class="rounded-2xl border border-amber-200/70 dark:border-amber-300/12 bg-amber-50/80 dark:bg-amber-300/[0.08] px-3 py-2 text-[11px] leading-6 text-amber-900 dark:text-amber-100/88">${escapeHTML(item)}</div>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
            `}
          </div>

          ${Array.isArray(safeState.organizers) && safeState.organizers.length ? `
            <div class="absolute left-4 bottom-4 right-4 pointer-events-none z-[30]">
              <div class="pointer-events-auto rounded-[1.2rem] border border-white/70 dark:border-white/12 bg-white/82 dark:bg-[#101010]/82 backdrop-blur-xl shadow-[0_18px_48px_rgba(15,23,42,0.12)] px-3 py-3">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/35">图库</div>
                <div class="mt-2 flex flex-wrap gap-2">
                  ${buildVisualOrganizerHistoryPills(safeState.organizers, organizer?.id || '')}
                </div>
              </div>
            </div>
          ` : ''}

          <div class="absolute right-4 bottom-4 pointer-events-none">
            <div class="pointer-events-auto rounded-[1rem] border border-white/70 dark:border-white/12 bg-white/84 dark:bg-[#101010]/84 backdrop-blur-xl px-3 py-2.5 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/35">画布提示</div>
              <div class="mt-1 text-[11px] leading-6 text-gray-600 dark:text-white/65">双击文字修改，拖拽元素移动，框选后可以整体调整。</div>
            </div>
          </div>
        </div>
      `;
    }

    function getVisualOrganizerActiveItem(state = null) {
      const safeState = state && typeof state === 'object' ? state : getVisualOrganizerPluginState();
      const list = Array.isArray(safeState.organizers) ? safeState.organizers : [];
      return list.find((item) => String(item?.id || '') === String(safeState.activeOrganizerId || '')) || list[0] || null;
    }

    function groupVisualOrganizerNodesByGroup(organizer = null) {
      const groups = new Map();
      const nodes = Array.isArray(organizer?.nodes) ? organizer.nodes : [];
      nodes.forEach((node) => {
        const group = sanitizeInlineText(node?.group || '', 32) || 'default';
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(node);
      });
      return Array.from(groups.entries()).map(([group, items]) => ({
        group,
        items: items.slice().sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0)),
      }));
    }

    function buildVisualOrganizerSectionFallback(organizer = null) {
      const sections = Array.isArray(organizer?.sections) ? organizer.sections : [];
      if (sections.length) return sections;
      return groupVisualOrganizerNodesByGroup(organizer).map((entry) => ({
        title: entry.group === 'default' ? '要点' : entry.group,
        items: entry.items.map((item) => sanitizeInlineText(item?.label || '', 90)).filter(Boolean),
      })).filter((entry) => entry.items.length);
    }

    function sanitizeVisualOrganizerEditableSections(raw = []) {
      return (Array.isArray(raw) ? raw : []).map((section, sectionIndex) => {
        const title = sanitizeInlineText(section?.title || `板块 ${sectionIndex + 1}`, 72) || `板块 ${sectionIndex + 1}`;
        const items = (Array.isArray(section?.items) ? section.items : [])
          .map((item) => sanitizeInlineText(item, 100))
          .filter(Boolean)
          .slice(0, 10);
        return { title, items };
      }).slice(0, 8);
    }

    function buildVisualOrganizerEditableSections(organizer = null) {
      return sanitizeVisualOrganizerEditableSections(buildVisualOrganizerSectionFallback(organizer));
    }

    function getVisualOrganizerSuggestedSectionTitle(templateKey = 'auto', index = 0) {
      const key = sanitizeInlineText(templateKey, 48) || 'auto';
      const presets = {
        'compare-map': ['左侧', '右侧', '共同点'],
        'kwhl-chart': ['K 我已知道', 'W 我想知道', 'H 我将如何学', 'L 我学到了什么'],
        'problem-solving-organizer': ['问题', '原因', '方案'],
        'big-question-map': ['线索一', '线索二', '线索三', '线索四'],
        'hierarchy-diagram': ['第一层', '第二层', '第三层'],
      };
      return sanitizeInlineText((presets[key] && presets[key][index]) || `新板块 ${index + 1}`, 72) || `新板块 ${index + 1}`;
    }

    function buildVisualOrganizerNodesFromSections(templateKey = 'auto', rawSections = []) {
      const key = sanitizeInlineText(templateKey, 48) || 'auto';
      const sections = sanitizeVisualOrganizerEditableSections(rawSections);
      const nodes = [];
      sections.forEach((section, sectionIndex) => {
        const baseTier = key === 'hierarchy-diagram' ? sectionIndex + 1 : 1;
        nodes.push({
          id: `section-${sectionIndex + 1}`,
          label: section.title,
          detail: '',
          group: '',
          tier: baseTier,
          order: sectionIndex * 100,
          emphasis: sectionIndex === 0,
        });
        section.items.forEach((item, itemIndex) => {
          nodes.push({
            id: `section-${sectionIndex + 1}-item-${itemIndex + 1}`,
            label: item,
            detail: '',
            group: section.title,
            tier: Math.min(6, baseTier + 1),
            order: sectionIndex * 100 + itemIndex + 1,
            emphasis: false,
          });
        });
      });
      return nodes.slice(0, 24);
    }

    function setVisualOrganizerEditorStatus(text = '', tone = 'neutral') {
      visualOrganizerEditorState.statusText = String(text || '').trim();
      visualOrganizerEditorState.statusTone = ['success', 'warning', 'danger'].includes(String(tone || '').trim())
        ? String(tone || '').trim()
        : 'neutral';
    }

    function syncVisualOrganizerEditorStateFromOrganizer(organizer = null) {
      const organizerId = sanitizeInlineText(organizer?.id || '', 48);
      const sections = buildVisualOrganizerEditableSections(organizer);
      if (!organizerId) {
        visualOrganizerEditorState.organizerId = '';
        visualOrganizerEditorState.selectionType = 'meta';
        visualOrganizerEditorState.sectionIndex = -1;
        visualOrganizerEditorState.itemIndex = -1;
        setVisualOrganizerEditorStatus('');
        return;
      }
      if (visualOrganizerEditorState.organizerId !== organizerId) {
        visualOrganizerEditorState.organizerId = organizerId;
        visualOrganizerEditorState.selectionType = 'meta';
        visualOrganizerEditorState.sectionIndex = sections.length ? 0 : -1;
        visualOrganizerEditorState.itemIndex = -1;
        setVisualOrganizerEditorStatus('点击图上的板块或卡片，就能在右侧直接编辑。');
      }
      if (!sections.length) {
        visualOrganizerEditorState.selectionType = 'meta';
        visualOrganizerEditorState.sectionIndex = -1;
        visualOrganizerEditorState.itemIndex = -1;
        return;
      }
      const maxSectionIndex = sections.length - 1;
      visualOrganizerEditorState.sectionIndex = Math.max(0, Math.min(maxSectionIndex, Number(visualOrganizerEditorState.sectionIndex || 0)));
      if (visualOrganizerEditorState.selectionType === 'item') {
        const items = Array.isArray(sections[visualOrganizerEditorState.sectionIndex]?.items) ? sections[visualOrganizerEditorState.sectionIndex].items : [];
        if (!items.length) {
          visualOrganizerEditorState.selectionType = 'section';
          visualOrganizerEditorState.itemIndex = -1;
        } else {
          visualOrganizerEditorState.itemIndex = Math.max(0, Math.min(items.length - 1, Number(visualOrganizerEditorState.itemIndex || 0)));
        }
      }
    }

    function getVisualOrganizerEditorSelection(organizer = null) {
      const sections = buildVisualOrganizerEditableSections(organizer);
      const selectionType = String(visualOrganizerEditorState.selectionType || 'meta');
      const sectionIndex = Number.isFinite(Number(visualOrganizerEditorState.sectionIndex)) ? Number(visualOrganizerEditorState.sectionIndex) : -1;
      const itemIndex = Number.isFinite(Number(visualOrganizerEditorState.itemIndex)) ? Number(visualOrganizerEditorState.itemIndex) : -1;
      const section = sectionIndex >= 0 ? sections[sectionIndex] || null : null;
      const item = section && itemIndex >= 0 ? section.items[itemIndex] || null : null;
      return { selectionType, sectionIndex, itemIndex, section, item, sections };
    }

    function isVisualOrganizerSelection(selectionType = 'meta', sectionIndex = -1, itemIndex = -1) {
      return String(visualOrganizerEditorState.selectionType || '') === String(selectionType || '')
        && Number(visualOrganizerEditorState.sectionIndex) === Number(sectionIndex)
        && Number(visualOrganizerEditorState.itemIndex) === Number(itemIndex);
    }

    function updateActiveVisualOrganizer(mutator = null) {
      const currentState = getVisualOrganizerPluginState();
      const currentOrganizer = getVisualOrganizerActiveItem(currentState);
      if (!currentOrganizer) return null;
      let nextOrganizer = null;
      setVisualOrganizerPluginState((prev) => {
        const organizers = (Array.isArray(prev?.organizers) ? prev.organizers : []).map((item) => {
          if (String(item?.id || '') !== String(currentOrganizer.id || '')) return item;
          const draft = {
            ...item,
            sections: buildVisualOrganizerEditableSections(item),
            nodes: Array.isArray(item?.nodes) ? item.nodes.map((node) => ({ ...node })) : [],
            edges: Array.isArray(item?.edges) ? item.edges.map((edge) => ({ ...edge })) : [],
          };
          const mutated = typeof mutator === 'function' ? mutator(draft) : draft;
          const prepared = mutated && typeof mutated === 'object' ? mutated : draft;
          const nextSections = sanitizeVisualOrganizerEditableSections(prepared.sections);
          nextOrganizer = {
            ...prepared,
            title: sanitizeInlineText(prepared.title || item?.title || '未命名视觉组织图', 80) || '未命名视觉组织图',
            summary: sanitizeInlineText(prepared.summary || '', 180),
            centralTopic: sanitizeInlineText(prepared.centralTopic || prepared.title || item?.centralTopic || item?.title || '', 80)
              || sanitizeInlineText(prepared.title || item?.title || '视觉组织图', 80)
              || '视觉组织图',
            focusQuestion: sanitizeInlineText(prepared.focusQuestion || '', 120),
            sections: nextSections,
            nodes: buildVisualOrganizerNodesFromSections(prepared.templateKey || item?.templateKey || 'auto', nextSections),
            edges: [],
            excalidrawScene: prepared.excalidrawScene || item?.excalidrawScene || null,
            updatedAt: new Date().toISOString(),
          };
          return nextOrganizer;
        });
        return {
          ...prev,
          activeOrganizerId: currentOrganizer.id,
          organizers,
        };
      }, { save: true, skipRender: true });
      if (nextOrganizer) syncVisualOrganizerEditorStateFromOrganizer(nextOrganizer);
      return nextOrganizer;
    }

    function clearVisualOrganizerDragState() {
      visualOrganizerDragState.type = '';
      visualOrganizerDragState.sectionIndex = -1;
      visualOrganizerDragState.itemIndex = -1;
    }

    function computeDropPlacement(event = null, axis = 'y') {
      const safeEvent = event && typeof event === 'object' ? event : null;
      const currentTarget = safeEvent?.currentTarget;
      if (!currentTarget || typeof currentTarget.getBoundingClientRect !== 'function') return 'after';
      const rect = currentTarget.getBoundingClientRect();
      if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return 'after';
      if (axis === 'x') {
        const midpoint = rect.left + rect.width / 2;
        return Number(safeEvent?.clientX || 0) < midpoint ? 'before' : 'after';
      }
      const midpoint = rect.top + rect.height / 2;
      return Number(safeEvent?.clientY || 0) < midpoint ? 'before' : 'after';
    }

    function moveVisualOrganizerSectionByDrag(fromIndex = -1, targetIndex = -1, placement = 'after') {
      const sourceIndex = Number.isFinite(Number(fromIndex)) ? Number(fromIndex) : -1;
      const baseTargetIndex = Number.isFinite(Number(targetIndex)) ? Number(targetIndex) : -1;
      if (sourceIndex < 0 || baseTargetIndex < 0) return false;
      let applied = false;
      updateActiveVisualOrganizer((draft) => {
        const sections = Array.isArray(draft.sections) ? draft.sections : [];
        if (sourceIndex >= sections.length || baseTargetIndex >= sections.length) return draft;
        let insertionIndex = baseTargetIndex + (placement === 'after' ? 1 : 0);
        const moved = sections.splice(sourceIndex, 1)[0];
        if (!moved) return draft;
        if (sourceIndex < insertionIndex) insertionIndex -= 1;
        insertionIndex = Math.max(0, Math.min(insertionIndex, sections.length));
        sections.splice(insertionIndex, 0, moved);
        applied = insertionIndex !== sourceIndex;
        return draft;
      });
      return applied;
    }

    function moveVisualOrganizerItemByDrag(fromSectionIndex = -1, fromItemIndex = -1, targetSectionIndex = -1, targetItemIndex = -1, placement = 'after') {
      const sourceSectionIndex = Number.isFinite(Number(fromSectionIndex)) ? Number(fromSectionIndex) : -1;
      const sourceItemIndex = Number.isFinite(Number(fromItemIndex)) ? Number(fromItemIndex) : -1;
      const destinationSectionIndex = Number.isFinite(Number(targetSectionIndex)) ? Number(targetSectionIndex) : -1;
      const destinationItemIndex = Number.isFinite(Number(targetItemIndex)) ? Number(targetItemIndex) : -1;
      if (sourceSectionIndex < 0 || sourceItemIndex < 0 || destinationSectionIndex < 0) return false;
      let applied = false;
      updateActiveVisualOrganizer((draft) => {
        const sections = Array.isArray(draft.sections) ? draft.sections : [];
        const sourceSection = sections[sourceSectionIndex];
        const destinationSection = sections[destinationSectionIndex];
        if (!sourceSection || !destinationSection) return draft;
        const sourceItems = Array.isArray(sourceSection.items) ? sourceSection.items : [];
        const destinationItems = Array.isArray(destinationSection.items) ? destinationSection.items : [];
        if (sourceItemIndex >= sourceItems.length) return draft;
        const moved = sourceItems.splice(sourceItemIndex, 1)[0];
        if (!moved) return draft;
        let insertionIndex = destinationItemIndex >= 0 ? destinationItemIndex + (placement === 'after' ? 1 : 0) : destinationItems.length;
        if (sourceSectionIndex === destinationSectionIndex && sourceItemIndex < insertionIndex) insertionIndex -= 1;
        insertionIndex = Math.max(0, Math.min(insertionIndex, destinationItems.length));
        destinationItems.splice(insertionIndex, 0, moved);
        applied = !(sourceSectionIndex === destinationSectionIndex && sourceItemIndex === insertionIndex);
        return draft;
      });
      return applied;
    }

    function buildVisualOrganizerBadge(text = '', tone = 'neutral') {
      const value = sanitizeInlineText(text, 48);
      if (!value) return '';
      const toneClass = tone === 'active'
        ? 'bg-black text-white dark:bg-white dark:text-black'
        : 'bg-white/75 text-gray-600 dark:bg-white/[0.08] dark:text-white/65';
      return `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono ${toneClass}">${escapeHTML(value)}</span>`;
    }

    function buildVisualOrganizerTemplatePills(selectedKey = 'auto') {
      return getVisualOrganizerTemplateCatalog().map((item) => {
        const active = item.key === selectedKey;
        const classes = active
          ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
          : 'bg-white/80 dark:bg-white/[0.03] text-gray-600 dark:text-white/65 border-gray-200 dark:border-white/10';
        return `<button type="button" onclick="selectVisualOrganizerTemplate('${escapeJSString(item.key)}')" class="px-3 py-2 rounded-2xl border text-[11px] font-medium transition-colors ${classes}">${escapeHTML(item.label)}</button>`;
      }).join('');
    }

    function buildVisualOrganizerHistoryPills(items = [], activeId = '') {
      return (Array.isArray(items) ? items : []).slice(0, 8).map((item) => {
        const selected = String(item?.id || '') === String(activeId || '');
        return `
          <div class="relative z-[40] inline-flex items-center gap-1.5 rounded-full border ${selected ? 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black' : 'border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.03]'} px-2 py-1">
            <button type="button" onclick="return openVisualOrganizerHistoryItem('${escapeJSString(String(item?.id || ''))}')" class="text-[10px] font-mono leading-5">${escapeHTML(sanitizeInlineText(item?.title || '未命名图', 20))}</button>
            <button type="button" onclick="return deleteVisualOrganizerHistoryItem('${escapeJSString(String(item?.id || ''))}')" class="relative z-[50] inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer" aria-label="删除视觉组织图">
              <i data-lucide="x" class="w-3 h-3"></i>
            </button>
          </div>
        `;
      }).join('');
    }

    function buildVisualOrganizerMiniAction(label = '', onClick = '', tone = 'neutral') {
      const text = sanitizeInlineText(label, 16);
      if (!text || !onClick) return '';
      const className = tone === 'danger'
        ? 'border-red-200 dark:border-red-400/20 text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-500/[0.08]'
        : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/65 bg-white/88 dark:bg-white/[0.04]';
      return `<button type="button" onclick="${onClick}" class="px-2 py-1 rounded-full border text-[10px] leading-4 shadow-[0_4px_10px_rgba(0,0,0,0.03)] ${className}">${escapeHTML(text)}</button>`;
    }

    function buildVisualOrganizerNodeCard(label = '', detail = '', options = {}) {
      const emphasis = options.emphasis === true;
      const sectionIndex = Number.isFinite(Number(options.sectionIndex)) ? Number(options.sectionIndex) : -1;
      const itemIndex = Number.isFinite(Number(options.itemIndex)) ? Number(options.itemIndex) : -1;
      const compact = options.compact === true;
      const textValue = sanitizeInlineText(label || '', 100);
      return `
        <div class="rounded-[1rem] border ${emphasis ? 'border-black/15 dark:border-white/25 bg-white dark:bg-white/[0.08]' : 'border-gray-200 dark:border-white/10 bg-white/82 dark:bg-white/[0.04]'} px-3 py-3 shadow-[0_10px_20px_rgba(0,0,0,0.03)]" ondragover="allowVisualOrganizerDrop(event)" ondrop="dropVisualOrganizerItem(event, ${sectionIndex}, ${itemIndex})">
          <textarea rows="${compact ? 2 : 3}" onchange="updateVisualOrganizerItemText(${sectionIndex}, ${itemIndex}, this.value)" class="w-full resize-none bg-transparent text-[12px] leading-6 text-black dark:text-white/90 outline-none placeholder:text-gray-400 dark:placeholder:text-white/25">${escapeHTML(textValue || '')}</textarea>
          ${detail ? `<div class="mt-1 text-[11px] leading-6 text-gray-500 dark:text-white/48">${escapeHTML(detail)}</div>` : ''}
          <div class="mt-2 flex flex-wrap items-center gap-1">
            <span draggable="true" ondragstart="startVisualOrganizerItemDrag(event, ${sectionIndex}, ${itemIndex})" ondragend="clearVisualOrganizerDragState()" class="px-2 py-1 rounded-full border border-gray-200 dark:border-white/10 bg-white/88 dark:bg-white/[0.04] text-[10px] leading-4 text-gray-500 dark:text-white/55 cursor-grab active:cursor-grabbing">拖拽</span>
            ${buildVisualOrganizerMiniAction('新增', `createVisualOrganizerSectionItem(${sectionIndex})`)}
            ${buildVisualOrganizerMiniAction('删除', `deleteVisualOrganizerItem(${sectionIndex}, ${itemIndex})`, 'danger')}
          </div>
        </div>
      `;
    }

    function buildVisualOrganizerSectionBlock(section = null, sectionIndex = 0, options = {}) {
      const safeSection = section && typeof section === 'object' ? section : { title: '', items: [] };
      const containerClass = String(options.containerClass || 'rounded-[1.1rem] border border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/[0.03] px-4 py-4');
      const itemWrapClass = String(options.itemWrapClass || 'mt-3 space-y-2');
      const titlePrefix = sanitizeInlineText(options.titlePrefix || '', 24);
      const titleSuffix = sanitizeInlineText(options.titleSuffix || '', 24);
      const itemCompact = options.itemCompact === true;
      return `
        <div class="${containerClass} relative overflow-hidden" ondragover="allowVisualOrganizerDrop(event)" ondrop="dropVisualOrganizerSection(event, ${sectionIndex})">
          <div class="absolute right-4 top-4 flex flex-wrap items-center justify-end gap-1">
            <span draggable="true" ondragstart="startVisualOrganizerSectionDrag(event, ${sectionIndex})" ondragend="clearVisualOrganizerDragState()" class="px-2 py-1 rounded-full border border-gray-200 dark:border-white/10 bg-white/88 dark:bg-white/[0.04] text-[10px] leading-4 text-gray-500 dark:text-white/55 cursor-grab active:cursor-grabbing">拖拽</span>
            ${buildVisualOrganizerMiniAction('加卡片', `createVisualOrganizerSectionItem(${sectionIndex})`)}
            ${buildVisualOrganizerMiniAction('删组', `deleteVisualOrganizerSection(${sectionIndex})`, 'danger')}
          </div>
          <div class="flex items-start justify-between gap-3 pr-28">
            <div class="min-w-0 flex-1">
              ${titlePrefix ? `<div class="text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-white/30">${escapeHTML(titlePrefix)}</div>` : ''}
              <input type="text" value="${escapeHTML(safeSection.title || '')}" onchange="updateVisualOrganizerSectionTitle(${sectionIndex}, this.value)" class="mt-1 h-10 w-full rounded-2xl border border-transparent bg-transparent px-2 text-[12px] font-medium text-black dark:text-white/90 outline-none focus:border-black/10 dark:focus:border-white/12" placeholder="输入板块标题">
            </div>
            ${titleSuffix ? `<span class="shrink-0 w-7 h-7 rounded-full bg-black text-white dark:bg-white dark:text-black inline-flex items-center justify-center text-[11px] font-tech">${escapeHTML(titleSuffix)}</span>` : ''}
          </div>
          <div class="${itemWrapClass}">
            ${(safeSection.items || []).length
              ? safeSection.items.map((item, itemIndex) => buildVisualOrganizerNodeCard(item, '', {
                sectionIndex,
                itemIndex,
                emphasis: options.emphasis === true,
                compact: itemCompact,
              })).join('')
              : `<div class="rounded-[1rem] border border-dashed border-gray-200 dark:border-white/10 px-4 py-4 text-[11px] leading-6 text-gray-400 dark:text-white/35">这个板块还没有内容，点“加卡片”直接补。</div>`}
          </div>
        </div>
      `;
    }

    function buildVisualOrganizerCompareCanvas(organizer = null) {
      const sections = buildVisualOrganizerEditableSections(organizer);
      const left = sections[0] || { title: '左侧', items: [] };
      const right = sections[1] || { title: '右侧', items: [] };
      const shared = sections[2] || { title: '共同点', items: [] };
      return `
        <div class="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
          ${buildVisualOrganizerSectionBlock(left, 0)}
          <div class="hidden xl:flex items-center justify-center">
            <div class="w-16 h-16 rounded-full border border-dashed border-gray-300 dark:border-white/15 flex items-center justify-center text-[10px] font-mono text-gray-400 dark:text-white/35">VS</div>
          </div>
          ${buildVisualOrganizerSectionBlock(right, 1)}
        </div>
        <div class="mt-3">${buildVisualOrganizerSectionBlock(shared, 2)}</div>
      `;
    }

    function buildVisualOrganizerHierarchyCanvas(organizer = null) {
      const sections = buildVisualOrganizerEditableSections(organizer);
      return sections.map((section, sectionIndex) => `
        <div class="relative">
          ${sectionIndex > 0 ? `<div class="h-6 w-px bg-gray-200 dark:bg-white/12 mx-auto"></div>` : ''}
          ${buildVisualOrganizerSectionBlock(section, sectionIndex, {
            emphasis: sectionIndex <= 1,
            itemWrapClass: `mt-3 grid ${section.items.length <= 1 ? 'grid-cols-1' : section.items.length === 2 ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-3'} gap-3`,
          })}
        </div>
      `).join('');
    }

    function buildVisualOrganizerKWHLCanvas(organizer = null) {
      const sections = buildVisualOrganizerEditableSections(organizer);
      const defaults = [
        { title: 'K 我已知道', label: '我已知道', badge: 'K' },
        { title: 'W 我想知道', label: '我想知道', badge: 'W' },
        { title: 'H 我将如何学', label: '我将如何学', badge: 'H' },
        { title: 'L 我学到了什么', label: '我学到了什么', badge: 'L' },
      ];
      return `
          <div class="grid grid-cols-1 xl:grid-cols-[1.18fr_0.82fr] gap-4 items-start">
            <div class="flex flex-col gap-4 min-w-0">
              <div class="rounded-[1.35rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
                <div class="flex items-center justify-between gap-3">
                  <div class="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 dark:text-white/35">时间账单</div>
                  <div class="text-[10px] font-mono text-gray-400 dark:text-white/35">点击日期或时间块，会直接弹出对应账单</div>
                </div>
                <div class="mt-4">${timeExplorerHtml}</div>
              </div>
              <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">${escapeHTML(rangeConfig.label)}类目分布</div>
                <div class="mt-3 space-y-3">${categoryBars}</div>
              </div>
              <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
                <div class="flex items-center justify-between gap-3">
                  <div class="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 dark:text-white/35">高频项目</div>
                  <div class="text-[10px] font-mono text-gray-400 dark:text-white/35">按名称聚合</div>
                </div>
                <div class="mt-4 grid grid-cols-1 gap-3">${recurringHtml}</div>
              </div>
            </div>
            <div class="flex flex-col gap-4 min-w-0">
              <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">${escapeHTML(rangeConfig.label)}总支出</div>
                <div class="mt-3 text-[24px] font-tech text-black dark:text-white/90">¥${formatAmount(total)}</div>
                <div class="mt-2 text-[10px] font-mono text-gray-400 dark:text-white/35">${scopedRecords.length} 笔</div>
              </div>
              <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">平均每笔开销</div>
                <div class="mt-3 text-[24px] font-tech text-black dark:text-white/90">¥${formatAmount(averageRecordAmount)}</div>
                <div class="mt-2 text-[10px] font-mono text-gray-400 dark:text-white/35">总支出 ÷ 当前范围内笔数</div>
              </div>
              <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">主要类目</div>
                <div class="mt-3 text-[16px] font-tech text-black dark:text-white/90">${escapeHTML(dominantCategory)}</div>
                <div class="mt-2 text-[10px] font-mono text-gray-400 dark:text-white/35">类目最高 ¥${formatAmount(dominantCategoryAmount)}</div>
              </div>
              <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">${escapeHTML(rangeConfig.label)}开销走势</div>
                <div class="mt-3 h-[14rem]">${buildExpenseTrendSvg(rangeConfig.buckets, trendValues)}</div>
              </div>
              <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">基础分类</div>
                <div class="mt-3 flex flex-wrap gap-2">${categoryPills}</div>
              </div>
              <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">你可以这样说</div>
                <div class="mt-3 space-y-2 text-[12px] leading-7 text-gray-700 dark:text-white/75">
                  <div>今天买咖啡花了 28</div>
                  <div>刚刚打车 39 到公司</div>
                  <div>房租 3200，帮我记一笔</div>
                  <div>给爷爷买礼物花了 999</div>
                </div>
              </div>
            </div>
          </div>
      `;
      return {
        shellCopy,
        body,
        detailModal: {
          bucket: activeBucket,
          label: activeBucketLabel,
        },
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
      };
    }

    async function buildExpenseLedgerWorkspaceContent(definition = null) {
      const runtime = getLocalPluginExpenseLedgerContentRuntimeModules();
      if (runtime && typeof runtime.buildExpenseLedgerWorkspaceContent === 'function') {
        return runtime.buildExpenseLedgerWorkspaceContent(definition);
      }
      return {
        shellCopy: resolveWorkspaceShellCopy(definition, {
          title: definition?.name || '简单记账',
          description: String(definition?.description || definition?.summary || '').replace(/\s+/g, ' ').trim(),
        }),
        body: '',
        detailModal: {
          bucket: null,
          label: '',
        },
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
      };
    }

    async function renderExpenseLedgerWorkspace(root, definition) {
      ensureExpenseLedgerHostBindings();
      const payload = await buildExpenseLedgerWorkspaceContent(definition);
      root.innerHTML = renderWorkspaceShell({
        title: payload.shellCopy.title,
        englishTitle: payload.shellCopy.englishTitle,
        description: payload.shellCopy.description,
        leftActions: [],
        rightActions: payload.rightActions,
        body: payload.body,
      });
      restoreExpenseLedgerCalendarScroll(root);
      syncExpenseLedgerDetailModalHost(payload.detailModal?.bucket || null, payload.detailModal?.label || '');
      if (typeof api.requestLucideRefresh === 'function') {
        api.requestLucideRefresh({ root });
      }
    }

    function createRuntimeId(prefix = '') {
      return `${String(prefix || '')}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    }

    function getSopRootData() {
      return typeof api.getData === 'function' ? api.getData() : null;
    }

    function getSopCollection() {
      const root = getSopRootData();
      if (!root || typeof root !== 'object') return [];
      if (!Array.isArray(root.sops)) root.sops = [];
      return root.sops;
    }

    function normalizeSopText(value = '') {
      return getSopCodecModules().normalizeSopText(value);
    }

    function splitSopLines(value = '') {
      return getSopCodecModules().splitSopLines(value);
    }

    function formatSopTime(value = '') {
      const text = String(value || '').trim();
      if (!text) return '-';
      const date = new Date(text);
      if (Number.isNaN(date.getTime())) return text;
      return date.toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    function normalizeSopEntryList(rawList = [], fallbackBlocks = [], kind = 'step') {
      return getSopCodecModules().normalizeSopEntryList(rawList, fallbackBlocks, kind);
    }

    function normalizeSopExecutions(rawList = []) {
      return getSopCodecModules().normalizeSopExecutions(rawList);
    }

    function normalizeSopItem(rawItem = null, index = 0) {
      return getSopCodecModules().normalizeSopItem(rawItem, index);
    }

    function serializeSopItem(item = null) {
      return getSopCodecModules().serializeSopItem(item);
    }

    function getNormalizedSopItems() {
      return getSopCollection()
        .map((item, index) => normalizeSopItem(item, index))
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    }

    function setSopWorkspaceFeedback(message = '', isError = false) {
      sopWorkspaceState.statusText = String(message || '').trim();
      sopWorkspaceState.statusError = !!isError;
      if (sopWorkspaceStatusTimer) {
        clearTimeout(sopWorkspaceStatusTimer);
        sopWorkspaceStatusTimer = null;
      }
      if (!sopWorkspaceState.statusText) return;
      sopWorkspaceStatusTimer = setTimeout(() => {
        sopWorkspaceState.statusText = '';
        sopWorkspaceState.statusError = false;
        rerenderSOPWorkspace();
      }, 2600);
    }

    function ensureSopWorkspaceSelection(items = []) {
      const list = Array.isArray(items) ? items : [];
      if (sopWorkspaceState.mode === 'create') return;
      const exists = list.some((item) => item.id === sopWorkspaceState.selectedId);
      if (exists) return;
      sopWorkspaceState.selectedId = list[0]?.id || '';
      if (!sopWorkspaceState.selectedId) {
        sopWorkspaceState.execution = null;
      }
    }

    function buildSopDraftFromItem(item = null) {
      return getSopCodecModules().buildSopDraftFromItem(item);
    }

    function persistSopWorkspaceMutations(feedbackText = '', isError = false) {
      if (typeof api.saveData === 'function') {
        try { api.saveData(); } catch (_) {}
      }
      if (feedbackText) setSopWorkspaceFeedback(feedbackText, isError);
      rerenderSOPWorkspace();
    }

    function rerenderSOPWorkspace() {
      if (getSelectedPluginId() !== 'sop-plugin') return;
      void renderView();
    }

    window.updateSOPWorkspaceQuery = function updateSOPWorkspaceQuery(value = '') {
      sopWorkspaceState.query = String(value || '');
      rerenderSOPWorkspace();
    };

    window.setSOPWorkspaceScenario = function setSOPWorkspaceScenario(value = 'all') {
      sopWorkspaceState.scenario = String(value || 'all').trim() || 'all';
      rerenderSOPWorkspace();
    };

    window.openSOPWorkspaceItem = function openSOPWorkspaceItem(id = '') {
      const normalizedId = String(id || '').trim();
      sopWorkspaceState.selectedId = normalizedId;
      sopWorkspaceState.mode = 'view';
      sopWorkspaceState.draft = null;
      if (sopWorkspaceState.execution && sopWorkspaceState.execution.sopId !== normalizedId) {
        sopWorkspaceState.execution = null;
      }
      rerenderSOPWorkspace();
    };

    window.createSOPWorkspaceItem = function createSOPWorkspaceItem() {
      sopWorkspaceState.mode = 'create';
      sopWorkspaceState.draft = buildSopDraftFromItem(null);
      sopWorkspaceState.execution = null;
      rerenderSOPWorkspace();
    };

    window.editSOPWorkspaceItem = function editSOPWorkspaceItem(id = '') {
      const normalizedId = String(id || sopWorkspaceState.selectedId || '').trim();
      const target = getNormalizedSopItems().find((item) => item.id === normalizedId) || null;
      if (!target) return;
      sopWorkspaceState.selectedId = target.id;
      sopWorkspaceState.mode = 'edit';
      sopWorkspaceState.draft = buildSopDraftFromItem(target);
      sopWorkspaceState.execution = null;
      rerenderSOPWorkspace();
    };

    window.cancelSOPWorkspaceEditor = function cancelSOPWorkspaceEditor() {
      sopWorkspaceState.mode = 'view';
      sopWorkspaceState.draft = null;
      rerenderSOPWorkspace();
    };

    window.updateSOPWorkspaceDraftField = function updateSOPWorkspaceDraftField(field = '', value = '') {
      if (!sopWorkspaceState.draft || typeof sopWorkspaceState.draft !== 'object') {
        sopWorkspaceState.draft = buildSopDraftFromItem(null);
      }
      const key = String(field || '').trim();
      if (!key) return;
      sopWorkspaceState.draft[key] = String(value || '');
    };

    window.saveSOPWorkspaceDraft = function saveSOPWorkspaceDraft() {
      const draft = sopWorkspaceState.draft && typeof sopWorkspaceState.draft === 'object'
        ? sopWorkspaceState.draft
        : buildSopDraftFromItem(null);
      const name = normalizeSopText(draft.name || '');
      const steps = splitSopLines(draft.stepsText || '');
      if (!name) {
        setSopWorkspaceFeedback('请先填写 SOP 标题。', true);
        rerenderSOPWorkspace();
        return;
      }
      if (!steps.length) {
        setSopWorkspaceFeedback('至少写下一步流程步骤。', true);
        rerenderSOPWorkspace();
        return;
      }
      const collection = getSopCollection();
      const normalizedItems = getNormalizedSopItems();
      const existing = draft.id ? normalizedItems.find((item) => item.id === draft.id) || null : null;
      const now = new Date().toISOString();
      const nextItem = serializeSopItem({
        id: existing?.id || draft.id || createRuntimeId('sop_'),
        name,
        description: normalizeSopText(draft.description || ''),
        status: existing?.status || 'active',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        tags: splitSopLines(String(draft.tagsText || '').replace(/,/g, '\n')),
        metadata: {
          scenario: normalizeSopText(draft.scenario || ''),
          trigger: normalizeSopText(draft.trigger || ''),
          steps: steps.map((text, index) => ({
            id: existing?.metadata?.steps?.[index]?.id || createRuntimeId('sop_step_'),
            text,
            order: index,
          })),
          checklist: splitSopLines(draft.checklistText || '').map((text, index) => ({
            id: existing?.metadata?.checklist?.[index]?.id || createRuntimeId('sop_check_'),
            text,
            order: index,
          })),
          relatedRefs: splitSopLines(draft.relatedRefsText || ''),
          executions: Array.isArray(existing?.metadata?.executions) ? existing.metadata.executions.slice() : [],
        },
      });
      const existingIndex = collection.findIndex((item) => String(item?.id || '').trim() === nextItem.id);
      if (existingIndex >= 0) collection.splice(existingIndex, 1, nextItem);
      else collection.unshift(nextItem);
      sopWorkspaceState.selectedId = nextItem.id;
      sopWorkspaceState.mode = 'view';
      sopWorkspaceState.draft = null;
      persistSopWorkspaceMutations(existingIndex >= 0 ? 'SOP 已更新。' : 'SOP 已创建。');
    };

    window.deleteSOPWorkspaceItem = function deleteSOPWorkspaceItem(id = '') {
      const normalizedId = String(id || sopWorkspaceState.selectedId || '').trim();
      if (!normalizedId) return;
      const commitDelete = function commitDelete() {
        const collection = getSopCollection();
        const index = collection.findIndex((item) => String(item?.id || '').trim() === normalizedId);
        if (index < 0) return;
        collection.splice(index, 1);
        if (sopWorkspaceState.selectedId === normalizedId) sopWorkspaceState.selectedId = '';
        sopWorkspaceState.mode = 'view';
        sopWorkspaceState.draft = null;
        sopWorkspaceState.execution = null;
        persistSopWorkspaceMutations('SOP 已删除。');
      };
      if (typeof api.openCustomModal === 'function') {
        api.openCustomModal({
          title: '删除这个 SOP？',
          desc: '删除后会从当前 SOP 列表中移除，但不会影响项目、日志或闪念原始内容。',
          onConfirm: commitDelete,
        });
        return;
      }
      commitDelete();
    };

    window.duplicateSOPWorkspaceItem = function duplicateSOPWorkspaceItem(id = '') {
      const normalizedId = String(id || sopWorkspaceState.selectedId || '').trim();
      const source = getNormalizedSopItems().find((item) => item.id === normalizedId) || null;
      if (!source) return;
      const now = new Date().toISOString();
      const duplicate = serializeSopItem({
        ...source,
        id: createRuntimeId('sop_'),
        name: `${source.name} · 副本`,
        createdAt: now,
        updatedAt: now,
        metadata: {
          ...source.metadata,
          executions: [],
        },
      });
      getSopCollection().unshift(duplicate);
      sopWorkspaceState.selectedId = duplicate.id;
      sopWorkspaceState.mode = 'view';
      sopWorkspaceState.execution = null;
      persistSopWorkspaceMutations('SOP 已复制。');
    };

    window.startSOPWorkspaceExecution = function startSOPWorkspaceExecution(id = '') {
      const normalizedId = String(id || sopWorkspaceState.selectedId || '').trim();
      const target = getNormalizedSopItems().find((item) => item.id === normalizedId) || null;
      if (!target) return;
      sopWorkspaceState.selectedId = normalizedId;
      sopWorkspaceState.execution = {
        sopId: normalizedId,
        startedAt: new Date().toISOString(),
        checkedStepIds: [],
        checkedChecklistIds: [],
        note: '',
      };
      sopWorkspaceState.mode = 'view';
      rerenderSOPWorkspace();
    };

    window.cancelSOPWorkspaceExecution = function cancelSOPWorkspaceExecution() {
      sopWorkspaceState.execution = null;
      rerenderSOPWorkspace();
    };

    window.toggleSOPWorkspaceExecutionStep = function toggleSOPWorkspaceExecutionStep(id = '') {
      const execution = sopWorkspaceState.execution;
      const normalizedId = String(id || '').trim();
      if (!execution || !normalizedId) return;
      const set = new Set(execution.checkedStepIds);
      if (set.has(normalizedId)) set.delete(normalizedId);
      else set.add(normalizedId);
      execution.checkedStepIds = Array.from(set);
      rerenderSOPWorkspace();
    };

    window.toggleSOPWorkspaceExecutionChecklist = function toggleSOPWorkspaceExecutionChecklist(id = '') {
      const execution = sopWorkspaceState.execution;
      const normalizedId = String(id || '').trim();
      if (!execution || !normalizedId) return;
      const set = new Set(execution.checkedChecklistIds);
      if (set.has(normalizedId)) set.delete(normalizedId);
      else set.add(normalizedId);
      execution.checkedChecklistIds = Array.from(set);
      rerenderSOPWorkspace();
    };

    window.updateSOPWorkspaceExecutionNote = function updateSOPWorkspaceExecutionNote(value = '') {
      if (!sopWorkspaceState.execution) return;
      sopWorkspaceState.execution.note = String(value || '');
    };

    window.completeSOPWorkspaceExecution = function completeSOPWorkspaceExecution() {
      const execution = sopWorkspaceState.execution;
      if (!execution?.sopId) return;
      const collection = getSopCollection();
      const index = collection.findIndex((item) => String(item?.id || '').trim() === execution.sopId);
      if (index < 0) return;
      const current = normalizeSopItem(collection[index], index);
      current.updatedAt = new Date().toISOString();
      current.metadata.executions.unshift({
        id: createRuntimeId('sop_run_'),
        startedAt: execution.startedAt,
        completedAt: new Date().toISOString(),
        checkedStepIds: execution.checkedStepIds.slice(),
        checkedChecklistIds: execution.checkedChecklistIds.slice(),
        note: normalizeSopText(execution.note || ''),
      });
      collection.splice(index, 1, serializeSopItem(current));
      sopWorkspaceState.execution = null;
      sopWorkspaceState.selectedId = current.id;
      persistSopWorkspaceMutations('本次 SOP 执行已记录。');
    };

    async function renderSOPWorkspace(root, definition) {
      const shellCopy = resolveWorkspaceShellCopy(definition, {
        title: definition?.name || 'SOP',
        description: String(definition?.description || definition?.summary || '').replace(/\s+/g, ' ').trim(),
      });
      const allItems = getNormalizedSopItems();
      ensureSopWorkspaceSelection(allItems);
      const scenarioOptions = ['内容发布', '项目推进', '生活事务', '健康管理', '系统维护']
        .concat(allItems.map((item) => String(item?.metadata?.scenario || '').trim()).filter(Boolean))
        .filter((value, index, arr) => arr.indexOf(value) === index);
      const query = String(sopWorkspaceState.query || '').trim().toLowerCase();
      const filteredItems = allItems.filter((item) => {
        if (sopWorkspaceState.scenario !== 'all' && String(item?.metadata?.scenario || '').trim() !== sopWorkspaceState.scenario) return false;
        if (!query) return true;
        const haystack = [
          item.name,
          item.description,
          item.metadata.scenario,
          item.metadata.trigger,
          item.metadata.steps.map((step) => step.text).join(' '),
          item.metadata.checklist.map((step) => step.text).join(' '),
          item.metadata.relatedRefs.join(' '),
          item.tags.join(' '),
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      });
      const selected = filteredItems.find((item) => item.id === sopWorkspaceState.selectedId)
        || allItems.find((item) => item.id === sopWorkspaceState.selectedId)
        || filteredItems[0]
        || allItems[0]
        || null;
      if (selected && !sopWorkspaceState.selectedId && sopWorkspaceState.mode !== 'create') {
        sopWorkspaceState.selectedId = selected.id;
      }
      const draft = sopWorkspaceState.draft && typeof sopWorkspaceState.draft === 'object'
        ? sopWorkspaceState.draft
        : buildSopDraftFromItem(selected);
      const execution = sopWorkspaceState.execution && sopWorkspaceState.execution.sopId === selected?.id
        ? sopWorkspaceState.execution
        : null;
      const recentExecution = Array.isArray(selected?.metadata?.executions) ? selected.metadata.executions.slice(0, 3) : [];
      const completionCount = allItems.reduce((sum, item) => sum + Number(item?.metadata?.executions?.length || 0), 0);
      const topScenario = scenarioOptions
        .filter((item) => item && item !== 'all')
        .sort((a, b) => allItems.filter((item) => item.metadata.scenario === b).length - allItems.filter((item) => item.metadata.scenario === a).length)[0] || '未分类';
      const listHtml = filteredItems.length
        ? filteredItems.map((item) => {
            const isActive = item.id === selected?.id && sopWorkspaceState.mode !== 'create';
            const stepCount = item.metadata.steps.length;
            const executionCount = item.metadata.executions.length;
            return `
              <button type="button" onclick="openSOPWorkspaceItem('${escapeJSString(item.id)}')" class="w-full text-left rounded-[1rem] border ${isActive ? 'border-black/15 dark:border-white/25 bg-black text-white dark:bg-white dark:text-black' : 'border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] text-black dark:text-white/88'} px-4 py-4 transition-colors">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="text-[13px] font-medium leading-6 ${isActive ? 'text-white dark:text-black' : 'text-black dark:text-white/90'}">${escapeHTML(item.name)}</div>
                    <div class="mt-1 text-[11px] leading-6 ${isActive ? 'text-white/70 dark:text-black/70' : 'text-gray-500 dark:text-white/45'}">${escapeHTML(item.description || item.metadata.trigger || '这条 SOP 还没有补充摘要。')}</div>
                  </div>
                  <div class="shrink-0 text-[10px] font-mono ${isActive ? 'text-white/60 dark:text-black/60' : 'text-gray-400 dark:text-white/35'}">${stepCount} 步</div>
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-2 text-[9px] font-mono ${isActive ? 'text-white/65 dark:text-black/65' : 'text-gray-400 dark:text-white/35'}">
                  ${item.metadata.scenario ? `<span>${escapeHTML(item.metadata.scenario)}</span>` : '<span>未分类</span>'}
                  <span>执行 ${executionCount} 次</span>
                  <span>${escapeHTML(formatSopTime(item.updatedAt || item.createdAt || ''))}</span>
                </div>
              </button>
            `;
          }).join('')
        : `<div class="rounded-[1rem] border border-dashed border-gray-200 dark:border-white/10 px-4 py-5 text-[12px] leading-7 text-gray-500 dark:text-white/45">当前筛选条件下还没有 SOP。你可以先新建一条。</div>`;
      const detailHtml = sopWorkspaceState.mode === 'create' || sopWorkspaceState.mode === 'edit'
        ? `
          <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 dark:text-white/35">${sopWorkspaceState.mode === 'create' ? '新建 SOP' : '编辑 SOP'}</div>
                <div class="mt-2 text-[18px] font-tech text-black dark:text-white/90">${sopWorkspaceState.mode === 'create' ? '把一套可重复流程沉淀下来' : '更新这套流程的步骤与适用场景'}</div>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" onclick="cancelSOPWorkspaceEditor()" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">取消</button>
                <button type="button" onclick="saveSOPWorkspaceDraft()" class="px-4 py-2 rounded-xl text-[11px] font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity">保存</button>
              </div>
            </div>
            <div class="mt-5 grid grid-cols-1 gap-4">
              <label class="flex flex-col gap-1.5">
                <span class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">标题</span>
                <input type="text" value="${escapeHTML(draft.name || '')}" oninput="updateSOPWorkspaceDraftField('name', this.value)" placeholder="例如：发布一篇视频前的检查 SOP" class="h-11 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] px-4 text-[12px] text-black dark:text-white/88 outline-none">
              </label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label class="flex flex-col gap-1.5">
                  <span class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">适用场景</span>
                  <input type="text" value="${escapeHTML(draft.scenario || '')}" oninput="updateSOPWorkspaceDraftField('scenario', this.value)" placeholder="内容发布 / 项目推进 / 健康管理" class="h-11 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] px-4 text-[12px] text-black dark:text-white/88 outline-none">
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">触发条件</span>
                  <input type="text" value="${escapeHTML(draft.trigger || '')}" oninput="updateSOPWorkspaceDraftField('trigger', this.value)" placeholder="什么时候应该执行这条 SOP" class="h-11 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] px-4 text-[12px] text-black dark:text-white/88 outline-none">
                </label>
              </div>
              <label class="flex flex-col gap-1.5">
                <span class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">摘要说明</span>
                <textarea oninput="updateSOPWorkspaceDraftField('description', this.value)" placeholder="这条 SOP 是干什么的，适合什么时候用" class="min-h-[96px] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] px-4 py-3 text-[12px] leading-7 text-black dark:text-white/88 outline-none">${escapeHTML(draft.description || '')}</textarea>
              </label>
              <label class="flex flex-col gap-1.5">
                <span class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">步骤列表</span>
                <textarea oninput="updateSOPWorkspaceDraftField('stepsText', this.value)" placeholder="每行一步，例如：\n确认目标\n检查素材\n发布前校对" class="min-h-[168px] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] px-4 py-3 text-[12px] leading-7 text-black dark:text-white/88 outline-none">${escapeHTML(draft.stepsText || '')}</textarea>
              </label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label class="flex flex-col gap-1.5">
                  <span class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">检查项</span>
                  <textarea oninput="updateSOPWorkspaceDraftField('checklistText', this.value)" placeholder="每行一个检查项" class="min-h-[132px] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] px-4 py-3 text-[12px] leading-7 text-black dark:text-white/88 outline-none">${escapeHTML(draft.checklistText || '')}</textarea>
                </label>
                <div class="flex flex-col gap-4">
                  <label class="flex flex-col gap-1.5">
                    <span class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">关联对象</span>
                    <textarea oninput="updateSOPWorkspaceDraftField('relatedRefsText', this.value)" placeholder="每行一个，例如：频道运营项目" class="min-h-[84px] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] px-4 py-3 text-[12px] leading-7 text-black dark:text-white/88 outline-none">${escapeHTML(draft.relatedRefsText || '')}</textarea>
                  </label>
                  <label class="flex flex-col gap-1.5">
                    <span class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">标签</span>
                    <input type="text" value="${escapeHTML(draft.tagsText || '')}" oninput="updateSOPWorkspaceDraftField('tagsText', this.value)" placeholder="用逗号分隔，例如：发布, 校对, 复盘" class="h-11 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] px-4 text-[12px] text-black dark:text-white/88 outline-none">
                  </label>
                </div>
              </div>
            </div>
          </div>
        `
        : selected
          ? `
            <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 dark:text-white/35">${escapeHTML(selected.metadata.scenario || '未分类')}</div>
                    ${selected.tags.length ? selected.tags.map((tag) => `<span class="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/[0.04] px-2.5 py-1 text-[9px] font-mono text-gray-500 dark:text-white/50">${escapeHTML(tag)}</span>`).join('') : ''}
                  </div>
                  <div class="mt-2 text-[22px] font-tech text-black dark:text-white/90">${escapeHTML(selected.name)}</div>
                  <div class="mt-3 text-[12px] leading-7 text-gray-600 dark:text-white/65">${escapeHTML(selected.description || '这条 SOP 还没有写摘要说明。')}</div>
                  <div class="mt-3 flex flex-wrap gap-4 text-[10px] font-mono text-gray-400 dark:text-white/35">
                    <span>触发：${escapeHTML(selected.metadata.trigger || '未填写')}</span>
                    <span>更新：${escapeHTML(formatSopTime(selected.updatedAt || selected.createdAt || ''))}</span>
                    <span>执行 ${selected.metadata.executions.length} 次</span>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" onclick="editSOPWorkspaceItem('${escapeJSString(selected.id)}')" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">编辑</button>
                  <button type="button" onclick="duplicateSOPWorkspaceItem('${escapeJSString(selected.id)}')" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">复制</button>
                  <button type="button" onclick="startSOPWorkspaceExecution('${escapeJSString(selected.id)}')" class="px-4 py-2 rounded-xl text-[11px] font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity">开始执行</button>
                  <button type="button" onclick="deleteSOPWorkspaceItem('${escapeJSString(selected.id)}')" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">删除</button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
              <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-5 py-5">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">步骤列表</div>
                <div class="mt-4 space-y-3">
                  ${selected.metadata.steps.length
                    ? selected.metadata.steps.map((step, index) => `<div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.02] px-4 py-3"><div class="text-[10px] font-mono text-gray-400 dark:text-white/35">Step ${index + 1}</div><div class="mt-1 text-[13px] leading-7 text-black dark:text-white/88">${escapeHTML(step.text)}</div></div>`).join('')
                    : '<div class="text-[12px] leading-7 text-gray-500 dark:text-white/45">还没有写下具体步骤。</div>'}
                </div>
              </div>
              <div class="flex flex-col gap-4">
                <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-5 py-5">
                  <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">检查项</div>
                  <div class="mt-4 space-y-2">
                    ${selected.metadata.checklist.length
                      ? selected.metadata.checklist.map((item) => `<div class="rounded-[0.9rem] border border-gray-200 dark:border-white/10 px-3 py-2 text-[12px] leading-6 text-gray-700 dark:text-white/75">${escapeHTML(item.text)}</div>`).join('')
                      : '<div class="text-[12px] leading-7 text-gray-500 dark:text-white/45">这条 SOP 还没有单独的检查项。</div>'}
                  </div>
                </div>
                <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-5 py-5">
                  <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">关联对象</div>
                  <div class="mt-4 flex flex-wrap gap-2">
                    ${selected.metadata.relatedRefs.length
                      ? selected.metadata.relatedRefs.map((item) => `<span class="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-3 py-1.5 text-[10px] font-mono text-gray-500 dark:text-white/50">${escapeHTML(item)}</span>`).join('')
                      : '<div class="text-[12px] leading-7 text-gray-500 dark:text-white/45">暂时还没有关联项目或对象。</div>'}
                  </div>
                </div>
                <div class="rounded-[1.25rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-5 py-5">
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">最近执行</div>
                    <div class="text-[10px] font-mono text-gray-400 dark:text-white/35">${selected.metadata.executions.length} 次</div>
                  </div>
                  <div class="mt-4 space-y-3">
                    ${recentExecution.length
                      ? recentExecution.map((entry) => `<div class="rounded-[0.95rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.02] px-4 py-3"><div class="flex items-center justify-between gap-2 text-[10px] font-mono text-gray-400 dark:text-white/35"><span>${escapeHTML(formatSopTime(entry.completedAt || entry.startedAt || ''))}</span><span>${entry.checkedStepIds.length}/${selected.metadata.steps.length} 步</span></div>${entry.note ? `<div class="mt-2 text-[12px] leading-7 text-gray-700 dark:text-white/72">${escapeHTML(entry.note)}</div>` : ''}</div>`).join('')
                      : '<div class="text-[12px] leading-7 text-gray-500 dark:text-white/45">还没有执行记录。</div>'}
                  </div>
                </div>
              </div>
            </div>
            ${execution ? `
              <div class="rounded-[1.35rem] border border-black/10 dark:border-white/15 bg-black text-white dark:bg-white dark:text-black px-5 py-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="text-[10px] font-mono uppercase tracking-[0.18em] text-white/55 dark:text-black/55">执行中</div>
                    <div class="mt-2 text-[18px] font-tech">${escapeHTML(selected.name)}</div>
                    <div class="mt-2 text-[11px] leading-6 text-white/70 dark:text-black/70">开始于 ${escapeHTML(formatSopTime(execution.startedAt || ''))}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="cancelSOPWorkspaceExecution()" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-white/15 dark:border-black/15 text-white dark:text-black hover:bg-white/10 dark:hover:bg-black/10 transition-colors">取消</button>
                    <button type="button" onclick="completeSOPWorkspaceExecution()" class="px-4 py-2 rounded-xl text-[11px] font-medium bg-white text-black dark:bg-black dark:text-white hover:opacity-90 transition-opacity">完成并记录</button>
                  </div>
                </div>
                <div class="mt-5 grid grid-cols-1 xl:grid-cols-[1.08fr_0.92fr] gap-4">
                  <div class="space-y-3">
                    ${selected.metadata.steps.map((step, index) => {
                      const active = execution.checkedStepIds.includes(step.id);
                      return `<button type="button" onclick="toggleSOPWorkspaceExecutionStep('${escapeJSString(step.id)}')" class="w-full text-left rounded-[1rem] border ${active ? 'border-white/20 dark:border-black/20 bg-white/12 dark:bg-black/10' : 'border-white/10 dark:border-black/10 bg-transparent'} px-4 py-3 transition-colors"><div class="flex items-start gap-3"><div class="mt-0.5 h-5 w-5 rounded-full border ${active ? 'border-white bg-white text-black dark:border-black dark:bg-black dark:text-white' : 'border-white/30 dark:border-black/30'} flex items-center justify-center text-[10px] font-mono">${active ? '✓' : index + 1}</div><div class="min-w-0 flex-1"><div class="text-[12px] leading-7 text-white dark:text-black">${escapeHTML(step.text)}</div></div></div></button>`; }).join('')}
                  </div>
                  <div class="space-y-4">
                    <div>
                      <div class="text-[10px] font-mono uppercase tracking-widest text-white/55 dark:text-black/55">检查项</div>
                      <div class="mt-3 space-y-2">
                        ${selected.metadata.checklist.length
                          ? selected.metadata.checklist.map((item) => {
                              const active = execution.checkedChecklistIds.includes(item.id);
                              return `<button type="button" onclick="toggleSOPWorkspaceExecutionChecklist('${escapeJSString(item.id)}')" class="w-full text-left rounded-[0.95rem] border ${active ? 'border-white/20 dark:border-black/20 bg-white/12 dark:bg-black/10' : 'border-white/10 dark:border-black/10 bg-transparent'} px-3 py-2 text-[12px] leading-6 transition-colors">${active ? '✓ ' : ''}${escapeHTML(item.text)}</button>`;
                            }).join('')
                          : '<div class="text-[12px] leading-7 text-white/65 dark:text-black/65">这条 SOP 没有额外检查项。</div>'}
                      </div>
                    </div>
                    <label class="flex flex-col gap-1.5">
                      <span class="text-[10px] font-mono uppercase tracking-widest text-white/55 dark:text-black/55">执行备注</span>
                      <textarea oninput="updateSOPWorkspaceExecutionNote(this.value)" placeholder="补充这次执行中的情况、偏差或结果" class="min-h-[132px] rounded-2xl border border-white/10 dark:border-black/10 bg-white/10 dark:bg-black/10 px-4 py-3 text-[12px] leading-7 text-white dark:text-black outline-none placeholder:text-white/35 dark:placeholder:text-black/35">${escapeHTML(execution.note || '')}</textarea>
                    </label>
                  </div>
                </div>
              </div>
            ` : ''}
          `
          : `
            <div class="rounded-[1.25rem] border border-dashed border-gray-200 dark:border-white/10 px-5 py-6 text-[12px] leading-7 text-gray-500 dark:text-white/45">
              现在还没有 SOP。先新建一条，把一套重复执行的流程沉淀下来。
            </div>
          `;
      const statusHtml = sopWorkspaceState.statusText
        ? `<div class="rounded-[1rem] border ${sopWorkspaceState.statusError ? 'border-red-200 dark:border-red-500/20 bg-red-50/80 dark:bg-red-500/10 text-red-700 dark:text-red-200' : 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'} px-4 py-3 text-[12px] leading-6">${escapeHTML(sopWorkspaceState.statusText)}</div>`
        : '';
      const body = `
        <div class="flex flex-col gap-4">
          ${statusHtml}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-[1.2rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">SOP 模板</div>
              <div class="mt-3 text-[24px] font-tech text-black dark:text-white/90">${allItems.length}</div>
              <div class="mt-2 text-[11px] leading-6 text-gray-500 dark:text-white/45">把经验沉淀成可重复执行的流程。</div>
            </div>
            <div class="rounded-[1.2rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">累计执行</div>
              <div class="mt-3 text-[24px] font-tech text-black dark:text-white/90">${completionCount}</div>
              <div class="mt-2 text-[11px] leading-6 text-gray-500 dark:text-white/45">记录 SOP 真正被执行了多少次。</div>
            </div>
            <div class="rounded-[1.2rem] border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.03] px-5 py-5">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">主要场景</div>
              <div class="mt-3 text-[18px] font-tech text-black dark:text-white/90">${escapeHTML(topScenario)}</div>
              <div class="mt-2 text-[11px] leading-6 text-gray-500 dark:text-white/45">先按场景归类，再逐步接项目与闪念。</div>
            </div>
          </div>
          <div class="grid grid-cols-1 xl:grid-cols-[0.88fr_1.12fr] gap-4 items-start">
            <div class="rounded-[1.35rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-5 py-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div class="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 dark:text-white/35">SOP 列表</div>
                  <div class="mt-2 text-[16px] font-tech text-black dark:text-white/90">把“以后都这么做”沉淀下来</div>
                </div>
                <button type="button" onclick="createSOPWorkspaceItem()" class="px-4 py-2 rounded-xl text-[11px] font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity">新建 SOP</button>
              </div>
              <div class="mt-4 flex flex-col gap-3">
                <input type="text" value="${escapeHTML(String(sopWorkspaceState.query || ''))}" oninput="updateSOPWorkspaceQuery(this.value)" placeholder="搜索标题、场景、触发条件或步骤" class="h-11 rounded-2xl border border-gray-200 dark:border-white/10 bg-[#fdfcf9] dark:bg-white/[0.04] px-4 text-[12px] text-black dark:text-white/88 outline-none">
                <div class="flex flex-wrap gap-2">
                  <button type="button" onclick="setSOPWorkspaceScenario('all')" class="px-3 py-1.5 rounded-full text-[10px] font-mono border ${sopWorkspaceState.scenario === 'all' ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/55'} transition-colors">全部</button>
                  ${scenarioOptions.filter((item) => item && item !== 'all').map((item) => `<button type="button" onclick="setSOPWorkspaceScenario('${escapeJSString(item)}')" class="px-3 py-1.5 rounded-full text-[10px] font-mono border ${sopWorkspaceState.scenario === item ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/55'} transition-colors">${escapeHTML(item)}</button>`).join('')}
                </div>
              </div>
              <div class="mt-4 flex flex-col gap-3">${listHtml}</div>
            </div>
            <div class="flex flex-col gap-4">${detailHtml}</div>
          </div>
        </div>
      `;
      root.innerHTML = renderWorkspaceShell({
        title: shellCopy.title,
        englishTitle: shellCopy.englishTitle,
        description: shellCopy.description,
        leftActions: [],
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
        body,
      });
      restoreLocalPluginWorkspaceScroll(root);
      if (typeof api.requestLucideRefresh === 'function') {
        api.requestLucideRefresh({ root });
      }
    }

    async function renderHealthStateWorkspace(root, definition) {
      const shellCopy = resolveWorkspaceShellCopy(definition, {
        title: definition?.name || '健康状态',
        description: String(definition?.description || definition?.summary || '').replace(/\s+/g, ' ').trim(),
      });
      const body = typeof api.getHealthCanvasWorkspaceMarkup === 'function'
        ? api.getHealthCanvasWorkspaceMarkup()
        : `<div class="text-[13px] leading-7 text-gray-500 dark:text-white/60">健康状态画布暂时不可用。</div>`;
      root.innerHTML = renderWorkspaceShell({
        title: shellCopy.title,
        englishTitle: shellCopy.englishTitle,
        description: shellCopy.description,
        leftActions: [],
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
        body,
      });
      if (typeof api.requestLucideRefresh === 'function') {
        api.requestLucideRefresh({ root });
      }
    }

    async function renderAppleHealthWorkspace(root, definition) {
      if (typeof api.hydrateAppleHealthFromNativeOnce === 'function') {
        try { await api.hydrateAppleHealthFromNativeOnce({ force: false }); } catch (_) {}
      }
      const shellCopy = resolveWorkspaceShellCopy(definition, {
        title: definition?.name || 'Apple 健康',
        description: String(definition?.description || definition?.summary || '').replace(/\s+/g, ' ').trim(),
      });
      const body = typeof api.getAppleHealthWorkspaceMarkup === 'function'
        ? api.getAppleHealthWorkspaceMarkup()
        : `<div class="text-[13px] leading-7 text-gray-500 dark:text-white/60">Apple 健康工作台暂时不可用。</div>`;
      root.innerHTML = renderWorkspaceShell({
        title: shellCopy.title,
        englishTitle: shellCopy.englishTitle,
        description: shellCopy.description,
        leftActions: [],
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
        body,
      });
      if (typeof api.bindAppleHealthWorkspaceActionButtons === 'function') {
        try { api.bindAppleHealthWorkspaceActionButtons(root); } catch (_) {}
      }
      if (typeof api.requestLucideRefresh === 'function') {
        api.requestLucideRefresh({ root });
      }
    }

    async function renderGlucoseWorkspace(root, definition) {
      if (typeof api.fetchGlucoseHistoryForHealth === 'function') {
        try { await api.fetchGlucoseHistoryForHealth({ force: false, silent: true }); } catch (_) {}
      }
      const shellCopy = resolveWorkspaceShellCopy(definition, {
        title: definition?.name || '血糖',
        description: String(definition?.description || definition?.summary || '').replace(/\s+/g, ' ').trim(),
      });
      const body = typeof api.getGlucoseWorkspaceMarkup === 'function'
        ? api.getGlucoseWorkspaceMarkup()
        : `<div class="text-[13px] leading-7 text-gray-500 dark:text-white/60">血糖工作台暂时不可用。</div>`;
      root.innerHTML = renderWorkspaceShell({
        title: shellCopy.title,
        englishTitle: shellCopy.englishTitle,
        description: shellCopy.description,
        leftActions: [],
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
        body,
      });
      if (typeof api.requestLucideRefresh === 'function') {
        api.requestLucideRefresh({ root });
      }
    }

    function rerenderJCRingWorkspace() {
      if (getSelectedPluginId() !== 'jcring-plugin') return;
      void renderView();
    }

    function updateJCRingLiveDisplay() {
      const s = jcringPluginState;
      const hrEl = document.querySelector('[data-jcring-hr]');
      const batEl = document.querySelector('[data-jcring-bat]');
      const lastEl = document.querySelector('[data-jcring-last]');
      const statusEl = document.querySelector('[data-jcring-status]');
      const errEl = document.querySelector('[data-jcring-error]');
      if (hrEl) hrEl.textContent = s.heartRate != null ? String(s.heartRate) : '--';
      if (batEl) batEl.textContent = s.battery != null ? `${s.battery}%` : '--';
      if (lastEl) lastEl.textContent = s.lastUpdate ? `更新于 ${new Date(s.lastUpdate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '';
      if (statusEl) {
        const text = s.connecting ? '正在连接…' : s.connected ? `已连接 · ${s.deviceName || '戒指'}` : '未连接';
        statusEl.textContent = text;
        statusEl.className = `font-mono text-[11px] uppercase tracking-wider ${s.connecting ? 'text-amber-600 dark:text-amber-400' : s.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-white/45'}`;
      }
      if (errEl) {
        errEl.textContent = s.error || '';
        errEl.style.display = s.error ? '' : 'none';
      }
    }

    function parseHeartRateMeasurement(buffer) {
      if (!buffer || buffer.byteLength < 2) return null;
      const dataView = new DataView(buffer);
      const flags = dataView.getUint8(0);
      const is16Bit = (flags & 0x01) !== 0;
      const bpm = is16Bit && buffer.byteLength >= 3
        ? dataView.getUint16(1, true)
        : dataView.getUint8(1);
      return bpm > 0 && bpm < 255 ? bpm : null;
    }

    async function renderJCRingWorkspace(root, definition) {
      const shellCopy = resolveWorkspaceShellCopy(definition, {
        title: definition?.name || 'JCRing 戒指',
        description: String(definition?.description || definition?.summary || '').replace(/\s+/g, ' ').trim(),
      });
      const hasWebBluetooth = typeof navigator !== 'undefined' && navigator.bluetooth && typeof navigator.bluetooth.requestDevice === 'function';
      const hasNativeBluetooth = typeof window !== 'undefined' && (window.__MorphNativeBluetoothAvailable__ || window.__LianXingNativeBluetoothAvailable__);
      const bluetoothAvailable = hasWebBluetooth || hasNativeBluetooth;
      const s = jcringPluginState;
      const statusText = s.connecting
        ? '正在连接…'
        : s.connected
          ? `已连接 · ${escapeHTML(s.deviceName || '戒指')}`
          : '未连接';
      const statusClass = s.connecting
        ? 'text-amber-600 dark:text-amber-400'
        : s.connected
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-gray-500 dark:text-white/45';
      const hrDisplay = s.heartRate != null ? String(s.heartRate) : '--';
      const batteryDisplay = s.battery != null ? `${s.battery}%` : '--';
      const lastUpdateText = s.lastUpdate
        ? `更新于 ${new Date(s.lastUpdate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
        : '';

      const body = `
        <div class="flex flex-col gap-6" data-jcring-root>
          ${!bluetoothAvailable
    ? `<div class="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 px-4 py-3 text-[12px] text-amber-800 dark:text-amber-200">当前浏览器或环境不支持 Web Bluetooth，请使用 Chrome/Edge 并在 HTTPS 或 localhost 下打开。</div>`
    : ''}
          <div class="flex flex-wrap items-center gap-3">
            <span data-jcring-status class="font-mono text-[11px] uppercase tracking-wider ${statusClass}">${statusText}</span>
            <span data-jcring-error class="text-red-600 dark:text-red-400 text-[12px]" style="${s.error ? '' : 'display:none'}">${escapeHTML(s.error)}</span>
            ${bluetoothAvailable
    ? (s.connected
      ? `<button type="button" onclick="window.jcringDisconnectRing && window.jcringDisconnectRing()" class="px-4 py-2 rounded-xl text-[11px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/75 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">断开连接</button>`
      : `<button type="button" onclick="window.jcringConnectRing && window.jcringConnectRing()" ${s.connecting ? 'disabled' : ''} class="px-4 py-2 rounded-xl text-[11px] font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity">连接戒指</button>`)
    : ''}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">心率</div>
              <div class="mt-2 text-2xl font-semibold tabular-nums text-gray-800 dark:text-white/90"><span data-jcring-hr>${escapeHTML(hrDisplay)}</span> <span class="text-sm font-normal text-gray-500 dark:text-white/45">bpm</span></div>
              ${s.connected ? `<div class="mt-1 text-[11px] text-gray-500 dark:text-white/45" data-jcring-last>${escapeHTML(lastUpdateText)}</div>` : '<div class="mt-1 text-[11px] text-gray-500 dark:text-white/45" data-jcring-last></div>'}
            </div>
            <div class="rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">电量</div>
              <div class="mt-2 text-2xl font-semibold tabular-nums text-gray-800 dark:text-white/90"><span data-jcring-bat>${escapeHTML(batteryDisplay)}</span></div>
            </div>
          </div>
          ${s.connected
    ? `<p class="text-[11px] text-gray-500 dark:text-white/45">若戒指支持标准 GATT 心率/电池服务，数据会自动更新。血氧、HRV 等需使用 J-STYLE 官方 App 或 SDK。</p>`
    : ''}
        </div>
      `;
      root.innerHTML = renderWorkspaceShell({
        title: shellCopy.title,
        englishTitle: shellCopy.englishTitle,
        description: shellCopy.description,
        leftActions: [],
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
        body,
      });
      if (typeof api.requestLucideRefresh === 'function') {
        api.requestLucideRefresh({ root });
      }
    }

    async function renderView() {
      const root = document.getElementById('local-plugin-workspace-view');
      if (!root) return;
      captureLocalPluginWorkspaceScroll(root);
      try {
        const pluginId = getSelectedPluginId();
        const definition = getCatalogDefinition(pluginId);
        if (!definition) {
          clearPomodoroWorkspaceTicker();
          unmountVisualOrganizerExcalidrawHost();
          root.innerHTML = renderWorkspaceShell({
            title: '还没有选中本地插件',
            englishTitle: 'Local Plugin Workspace',
            description: '请先回到插件页，打开一个本地插件的详情，再进入它的工作台。',
            leftActions: [],
            body: '',
            bodyClass: 'hidden',
          });
          restoreLocalPluginWorkspaceScroll(root);
          return;
        }

        const shellCopy = resolveWorkspaceShellCopy(definition, {
          title: definition.name,
          description: String(definition.description || definition.summary || '').replace(/\s+/g, ' ').trim(),
        });

        if (pluginId !== 'pomodoro-plugin') {
          clearPomodoroWorkspaceTicker();
        }

        if (pluginId !== 'visual-organizer-plugin') {
          unmountVisualOrganizerExcalidrawHost();
        }

        if (pluginId !== 'expense-ledger-plugin') {
          clearExpenseLedgerDetailModalHost();
          clearExpenseLedgerManualModalHost();
        }

        if (pluginId === 'expense-ledger-plugin') {
          await renderExpenseLedgerWorkspace(root, definition);
          return;
        }
        if (pluginId === 'sop-plugin') {
          await renderSOPWorkspace(root, definition);
          return;
        }
        if (pluginId === 'health-state') {
          await renderHealthStateWorkspace(root, definition);
          return;
        }
        if (pluginId === 'apple-health') {
          await renderAppleHealthWorkspace(root, definition);
          return;
        }
        if (pluginId === 'glucose') {
          await renderGlucoseWorkspace(root, definition);
          return;
        }
        if (pluginId === 'pomodoro-plugin') {
          await renderPomodoroWorkspace(root, definition);
          return;
        }
        if (pluginId === WECHAT_ARTICLE_FORMATTER_PLUGIN_ID) {
          await renderWechatArticleFormatterWorkspace(root, definition);
          return;
        }
        if (pluginId === 'visual-organizer-plugin') {
          await renderVisualOrganizerWorkspace(root, definition);
          return;
        }
        if (pluginId === 'jcring-plugin') {
          await renderJCRingWorkspace(root, definition);
          return;
        }
        if (pluginId === CODEX_REMOTE_PLUGIN_ID) {
          await renderCodexRemoteWorkspace(root, definition);
          return;
        }

        const entryManifest = definition.entry ? await loadJson(definition.entry) : null;
        const readmePath = deriveReadmePath(definition.entry || '');
        const readmeText = readmePath ? await loadText(readmePath) : '';
        const previewHtml = readmeText ? formatMarkdownPreview(readmeText) : `<p class="text-[13px] leading-7 text-gray-700 dark:text-white/78">这个插件还没有 README，你可以先从 manifest 开始往下补自己的工作台说明。</p>`;
        const requirements = []
          .concat(Array.isArray(definition.requires?.accounts) ? definition.requires.accounts.map((item) => `账号：${item}`) : [])
          .concat(Array.isArray(definition.requires?.devices) ? definition.requires.devices.map((item) => `设备：${item}`) : [])
          .concat(Array.isArray(definition.requires?.runtimeCapabilities) ? definition.requires.runtimeCapabilities.map((item) => `能力：${item}`) : []);

        const body = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">当前挂载信息</div>
                <div class="mt-3 space-y-2">
                  <div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">Manifest 入口：${escapeHTML(definition.entry || '-')}</div>
                  <div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">设置目标：${escapeHTML(definition.settingsTarget || definition.id)}</div>
                  <div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">Primary Action：${escapeHTML(definition.ui?.primaryAction || 'configure')}</div>
                  ${(entryManifest && entryManifest.version) ? `<div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">子 Manifest 版本：${escapeHTML(entryManifest.version)}</div>` : ''}
                </div>
              </div>
              <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
                <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">依赖与权限</div>
                <div class="mt-3 space-y-2">
                  ${requirements.length ? requirements.map((item) => `<div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">${escapeHTML(item)}</div>`).join('') : '<div class="text-[12px] leading-6 text-gray-500 dark:text-white/45">当前没有额外依赖。</div>'}
                  ${Array.isArray(definition.permissions) && definition.permissions.length
                    ? definition.permissions.map((item) => `<div class="text-[12px] leading-6 text-gray-700 dark:text-white/72">${escapeHTML(item.label || item.id)}</div>`).join('')
                    : '<div class="text-[12px] leading-6 text-gray-500 dark:text-white/45">当前没有额外权限声明。</div>'}
                </div>
              </div>
            </div>
            <div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
              <div class="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-white/35">README 预览</div>
              <div class="mt-3 space-y-3">${previewHtml}</div>
            </div>
        `;
        root.innerHTML = renderWorkspaceShell({
          title: shellCopy.title,
          englishTitle: shellCopy.englishTitle,
          description: shellCopy.description,
          leftActions: [],
          rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
          body,
        });
        restoreLocalPluginWorkspaceScroll(root);
        if (typeof api.requestLucideRefresh === 'function') {
          api.requestLucideRefresh({ root });
        }
      } catch (error) {
        clearPomodoroWorkspaceTicker();
        const pluginId = getSelectedPluginId();
        const label = pluginId || 'unknown-plugin';
        const message = String(error?.message || error || 'unknown error').trim();
        root.innerHTML = renderWorkspaceShell({
          title: '工作台加载失败',
          englishTitle: 'Workspace Error',
          description: '插件内容加载时发生异常，下面保留了错误信息，避免继续白页。',
          leftActions: [],
          body: `
            <div class="rounded-[1rem] border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10 px-5 py-5">
              <div class="text-[11px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-200">Plugin</div>
              <div class="mt-2 text-[14px] font-medium text-amber-900 dark:text-amber-100">${escapeHTML(label)}</div>
              <div class="mt-4 text-[11px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-200">Error</div>
              <div class="mt-2 text-[12px] leading-7 text-amber-900 dark:text-amber-100 break-words">${escapeHTML(message || 'unknown error')}</div>
            </div>
          `,
        });
        restoreLocalPluginWorkspaceScroll(root);
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error('[local-plugin-workspace] render failed:', pluginId, error);
        }
      }
    }

    function rerenderExpenseLedgerWorkspace() {
      if (getSelectedPluginId() !== 'expense-ledger-plugin') return;
      void renderView();
    }

    window.confirmClearExpenseLedgerWorkspaceRecords = function confirmClearExpenseLedgerWorkspaceRecords() {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.confirmClearExpenseLedgerWorkspaceRecords === 'function') {
        return runtime.confirmClearExpenseLedgerWorkspaceRecords();
      }
    };

    window.openExpenseLedgerManualAddModal = function openExpenseLedgerManualAddModal() {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.openExpenseLedgerManualAddModal === 'function') {
        runtime.openExpenseLedgerManualAddModal();
      }
    };

    function getExpenseLedgerModalDraft() {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.getExpenseLedgerModalDraft === 'function') {
        return runtime.getExpenseLedgerModalDraft();
      }
      return null;
    }

    window.closeExpenseLedgerManualAddModal = function closeExpenseLedgerManualAddModal() {
      closeExpenseLedgerManualDraft();
    };

    window.updateExpenseLedgerManualDraftField = function updateExpenseLedgerManualDraftField(field = '', value = '') {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.updateExpenseLedgerManualDraftField === 'function') {
        runtime.updateExpenseLedgerManualDraftField(field, value);
      }
    };

    window.toggleExpenseLedgerManualCategoryMenu = function toggleExpenseLedgerManualCategoryMenu(force) {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.toggleExpenseLedgerManualCategoryMenu === 'function') {
        runtime.toggleExpenseLedgerManualCategoryMenu(force);
      }
    };

    window.beginExpenseLedgerManualComposition = function beginExpenseLedgerManualComposition(target = '') {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.beginExpenseLedgerManualComposition === 'function') {
        runtime.beginExpenseLedgerManualComposition(target);
      }
    };

    window.endExpenseLedgerManualDraftFieldComposition = function endExpenseLedgerManualDraftFieldComposition(field = '', value = '') {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.endExpenseLedgerManualDraftFieldComposition === 'function') {
        runtime.endExpenseLedgerManualDraftFieldComposition(field, value);
      }
    };

    window.selectExpenseLedgerManualCategory = function selectExpenseLedgerManualCategory(category = '') {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.selectExpenseLedgerManualCategory === 'function') {
        runtime.selectExpenseLedgerManualCategory(category);
      }
    };

    window.updateExpenseLedgerManualCategoryQuery = function updateExpenseLedgerManualCategoryQuery(value = '') {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.updateExpenseLedgerManualCategoryQuery === 'function') {
        runtime.updateExpenseLedgerManualCategoryQuery(value);
      }
    };

    window.endExpenseLedgerManualCategoryQueryComposition = function endExpenseLedgerManualCategoryQueryComposition(value = '') {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.endExpenseLedgerManualCategoryQueryComposition === 'function') {
        runtime.endExpenseLedgerManualCategoryQueryComposition(value);
      }
    };

    window.createExpenseLedgerManualCategoryFromQuery = function createExpenseLedgerManualCategoryFromQuery() {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.createExpenseLedgerManualCategoryFromQuery === 'function') {
        runtime.createExpenseLedgerManualCategoryFromQuery();
      }
    };

    window.handleExpenseLedgerManualCategoryQueryKeydown = function handleExpenseLedgerManualCategoryQueryKeydown(event) {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.handleExpenseLedgerManualCategoryQueryKeydown === 'function') {
        runtime.handleExpenseLedgerManualCategoryQueryKeydown(event);
      }
    };

    window.submitExpenseLedgerManualDraft = async function submitExpenseLedgerManualDraft() {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.submitExpenseLedgerManualDraft === 'function') {
        await runtime.submitExpenseLedgerManualDraft();
      }
    };

    window.openExpenseLedgerRecordEditModal = function openExpenseLedgerRecordEditModal(recordId = '') {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.openExpenseLedgerRecordEditModal === 'function') {
        runtime.openExpenseLedgerRecordEditModal(recordId);
      }
    };

    window.startExpenseLedgerRecordEdit = function startExpenseLedgerRecordEdit(recordId = '') {
      window.openExpenseLedgerRecordEditModal(recordId);
    };

    window.cancelExpenseLedgerRecordEdit = function cancelExpenseLedgerRecordEdit() {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.cancelExpenseLedgerRecordEdit === 'function') {
        runtime.cancelExpenseLedgerRecordEdit();
      }
    };

    window.updateExpenseLedgerRecordDraftField = function updateExpenseLedgerRecordDraftField(field = '', value = '') {
      const runtime = getLocalPluginExpenseLedgerDraftRuntimeModules();
      if (runtime && typeof runtime.updateExpenseLedgerRecordDraftField === 'function') {
        runtime.updateExpenseLedgerRecordDraftField(field, value);
      }
    };

    window.saveExpenseLedgerRecordEdit = async function saveExpenseLedgerRecordEdit(recordId = '') {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.saveExpenseLedgerRecordEdit === 'function') {
        await runtime.saveExpenseLedgerRecordEdit(recordId);
      }
    };

    window.confirmDeleteExpenseLedgerRecord = function confirmDeleteExpenseLedgerRecord(recordId = '') {
      const runtime = getLocalPluginExpenseLedgerMutationRuntimeModules();
      if (runtime && typeof runtime.confirmDeleteExpenseLedgerRecord === 'function') {
        runtime.confirmDeleteExpenseLedgerRecord(recordId);
      }
    };

    function parseHeartRateFromBase64(base64) {
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return parseHeartRateMeasurement(bytes.buffer);
      } catch (_) {
        return null;
      }
    }

    window.jcringConnectRing = async function jcringConnectRing() {
      const s = jcringPluginState;
      if (s.connecting || s.connected) return;
      const useNative = (window.__MorphNativeBluetoothAvailable__ || window.__LianXingNativeBluetoothAvailable__)
        && typeof api.storage?.callNativeDesktopControl === 'function';

      if (useNative) {
        s.connecting = true;
        s.error = '';
        s.useNativeBridge = true;
        updateJCRingLiveDisplay();
        rerenderJCRingWorkspace();
        try {
          const payload = await api.storage.callNativeDesktopControl('bluetoothRequestDevice', {
            acceptAllDevices: true,
            optionalServices: ['heart_rate', 'battery_service'],
          });
          const device = payload?.device;
          if (!device || !device.id) {
            s.error = '未选择设备';
            s.useNativeBridge = false;
            s.connecting = false;
            updateJCRingLiveDisplay();
            rerenderJCRingWorkspace();
            return;
          }
          s.connected = true;
          s.deviceName = device.name || '戒指';
          s.nativeDeviceId = device.id;
          window.__MorphBluetoothNotify__ = window.__LianXingBluetoothNotify__ = function (msg) {
            if (!msg || !msg.value) return;
            const cu = String(msg.characteristicUUID || '').toUpperCase().replace(/-/g, '');
            if (cu !== '2A37') return;
            const bpm = parseHeartRateFromBase64(msg.value);
            if (bpm != null) {
              jcringPluginState.heartRate = bpm;
              jcringPluginState.lastUpdate = Date.now();
              updateJCRingLiveDisplay();
            }
          };
          try {
            await api.storage.callNativeDesktopControl('bluetoothStartNotifications', {
              deviceId: device.id,
              serviceUUID: 'heart_rate',
              characteristicUUID: 'heart_rate_measurement',
            });
          } catch (_) {}
          try {
            const hrPayload = await api.storage.callNativeDesktopControl('bluetoothReadCharacteristic', {
              deviceId: device.id,
              serviceUUID: 'heart_rate',
              characteristicUUID: 'heart_rate_measurement',
            });
            if (hrPayload?.value) {
              const bpm = parseHeartRateFromBase64(hrPayload.value);
              if (bpm != null) { s.heartRate = bpm; s.lastUpdate = Date.now(); }
            }
          } catch (_) {}
          try {
            const batPayload = await api.storage.callNativeDesktopControl('bluetoothReadCharacteristic', {
              deviceId: device.id,
              serviceUUID: 'battery_service',
              characteristicUUID: 'battery_level',
            });
            if (batPayload?.value) {
              try {
                const binary = atob(batPayload.value);
                if (binary.length >= 1) s.battery = binary.charCodeAt(0);
              } catch (_) {}
            }
          } catch (_) {}
          updateJCRingLiveDisplay();
          s.pollTimerId = setInterval(async () => {
            const state = jcringPluginState;
            if (!state.connected || !state.nativeDeviceId) return;
            try {
              const hrPayload = await api.storage.callNativeDesktopControl('bluetoothReadCharacteristic', {
                deviceId: state.nativeDeviceId,
                serviceUUID: 'heart_rate',
                characteristicUUID: 'heart_rate_measurement',
              });
              if (hrPayload?.value) {
                const bpm = parseHeartRateFromBase64(hrPayload.value);
                if (bpm != null) { state.heartRate = bpm; state.lastUpdate = Date.now(); }
              }
            } catch (_) {}
            try {
              const batPayload = await api.storage.callNativeDesktopControl('bluetoothReadCharacteristic', {
                deviceId: state.nativeDeviceId,
                serviceUUID: 'battery_service',
                characteristicUUID: 'battery_level',
              });
              if (batPayload?.value) {
                try {
                  const binary = atob(batPayload.value);
                  if (binary.length >= 1) state.battery = binary.charCodeAt(0);
                } catch (_) {}
              }
            } catch (_) {}
            updateJCRingLiveDisplay();
          }, 2500);
        } catch (err) {
          s.error = (err && err.message) ? String(err.message) : '连接失败';
          s.connected = false;
          s.nativeDeviceId = null;
          s.useNativeBridge = false;
        } finally {
          s.connecting = false;
          updateJCRingLiveDisplay();
          rerenderJCRingWorkspace();
        }
        return;
      }

      if (!navigator.bluetooth || typeof navigator.bluetooth.requestDevice !== 'function') {
        s.error = '当前环境不支持 Web Bluetooth';
        rerenderJCRingWorkspace();
        return;
      }
      s.connecting = true;
      s.error = '';
      s.useNativeBridge = false;
      rerenderJCRingWorkspace();
      try {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['heart_rate', 'battery_service'],
        });
        const server = await device.gatt.connect();
        s.device = device;
        s.gattServer = server;
        s.deviceName = device.name || '戒指';
        s.connected = true;
        device.addEventListener('gattserverdisconnected', () => {
          const js = jcringPluginState;
          js.connected = false;
          js.device = null;
          js.gattServer = null;
          js.heartRate = null;
          js.battery = null;
          js.hrCharRef = null;
          js.batCharRef = null;
          if (js.pollTimerId) {
            clearInterval(js.pollTimerId);
            js.pollTimerId = null;
          }
          updateJCRingLiveDisplay();
        });
        let hrChar = null;
        let batChar = null;
        try {
          const hrService = await server.getPrimaryService('heart_rate');
          hrChar = await hrService.getCharacteristic('heart_rate_measurement');
          s.hrCharRef = hrChar;
          await hrChar.startNotifications();
          hrChar.addEventListener('characteristicvaluechanged', (event) => {
            const bpm = parseHeartRateMeasurement(event.target.value && event.target.value.buffer);
            if (bpm != null) {
              jcringPluginState.heartRate = bpm;
              jcringPluginState.lastUpdate = Date.now();
              updateJCRingLiveDisplay();
            }
          });
          const firstHr = await hrChar.readValue();
          const bpm = parseHeartRateMeasurement(firstHr && firstHr.buffer);
          if (bpm != null) {
            s.heartRate = bpm;
            s.lastUpdate = Date.now();
          }
        } catch (_) {}
        try {
          const batService = await server.getPrimaryService('battery_service');
          batChar = await batService.getCharacteristic('battery_level');
          s.batCharRef = batChar;
          const batValue = await batChar.readValue();
          if (batValue && batValue.byteLength >= 1) s.battery = batValue.getUint8(0);
        } catch (_) {}
        updateJCRingLiveDisplay();
        if (hrChar || batChar) {
          s.pollTimerId = setInterval(async () => {
            const state = jcringPluginState;
            if (!state.connected || (!state.hrCharRef && !state.batCharRef)) return;
            try {
              if (state.hrCharRef) {
                const val = await state.hrCharRef.readValue();
                const bpm = parseHeartRateMeasurement(val && val.buffer);
                if (bpm != null) {
                  state.heartRate = bpm;
                  state.lastUpdate = Date.now();
                }
              }
              if (state.batCharRef) {
                const val = await state.batCharRef.readValue();
                if (val && val.byteLength >= 1) state.battery = val.getUint8(0);
              }
              updateJCRingLiveDisplay();
            } catch (_) {}
          }, 2500);
        }
      } catch (err) {
        s.connected = false;
        s.device = null;
        s.gattServer = null;
        s.error = (err && err.message) ? String(err.message) : '连接失败';
        if (s.error === 'User cancelled the request device chooser.') s.error = '已取消选择设备';
      } finally {
        s.connecting = false;
        updateJCRingLiveDisplay();
        rerenderJCRingWorkspace();
      }
    };

    window.jcringDisconnectRing = function jcringDisconnectRing() {
      const s = jcringPluginState;
      if (s.pollTimerId) {
        clearInterval(s.pollTimerId);
        s.pollTimerId = null;
      }
      if (s.useNativeBridge && s.nativeDeviceId && typeof api.storage?.callNativeDesktopControl === 'function') {
        try {
          api.storage.callNativeDesktopControl('bluetoothDisconnect', { deviceId: s.nativeDeviceId });
        } catch (_) {}
        s.nativeDeviceId = null;
        s.useNativeBridge = false;
      }
      if (s.device && s.device.gatt && s.device.gatt.connected) {
        s.device.gatt.disconnect();
      }
      s.connected = false;
      s.device = null;
      s.gattServer = null;
      s.heartRate = null;
      s.battery = null;
      s.hrCharRef = null;
      s.batCharRef = null;
      s.error = '';
      updateJCRingLiveDisplay();
      rerenderJCRingWorkspace();
    };

    function rerenderVisualOrganizerWorkspace() {
      if (getSelectedPluginId() !== 'visual-organizer-plugin') return;
      void renderView();
    }

    window.resetVisualOrganizerExcalidrawLayout = async function resetVisualOrganizerExcalidrawLayout() {
      const state = getVisualOrganizerPluginState();
      const organizer = getVisualOrganizerActiveItem(state);
      const runtime = await ensureVisualOrganizerExcalidrawRuntime();
      if (!runtime || typeof runtime.buildSceneFromOrganizer !== 'function') {
        visualOrganizerComposerState.statusText = '白板重排暂时不可用，请稍后重试。';
        visualOrganizerComposerState.statusError = true;
        rerenderVisualOrganizerWorkspace();
        return;
      }
      const seedOrganizer = organizer || buildVisualOrganizerStarterOrganizer(visualOrganizerComposerState.templateKey || 'auto');
      const nextScene = runtime.buildSceneFromOrganizer(seedOrganizer, getVisualOrganizerExcalidrawTheme());
      const ensuredOrganizer = organizer || ensureVisualOrganizerPracticeBoard();
      persistVisualOrganizerExcalidrawScene(nextScene, ensuredOrganizer.id);
      visualOrganizerComposerState.statusText = '已经按 AI 初稿重新铺好白板。';
      visualOrganizerComposerState.statusError = false;
      rerenderVisualOrganizerWorkspace();
    };

    window.createVisualOrganizerPracticeBoard = function createVisualOrganizerPracticeBoardHandler() {
      const state = getVisualOrganizerPluginState();
      if (!Array.isArray(state.organizers) || !state.organizers.length) {
        visualOrganizerComposerState.suppressStarterAutocreate = false;
        ensureVisualOrganizerPracticeBoard();
        visualOrganizerComposerState.statusText = '已经打开练习白板。';
        visualOrganizerComposerState.statusError = false;
        rerenderVisualOrganizerWorkspace();
        return;
      }
      createVisualOrganizerPracticeBoard(null, buildVisualOrganizerStarterOrganizer(visualOrganizerComposerState.templateKey || 'auto'));
      visualOrganizerComposerState.statusText = '已经新建一张练习白板。';
      visualOrganizerComposerState.statusError = false;
      rerenderVisualOrganizerWorkspace();
    };

    window.updateVisualOrganizerPrompt = function updateVisualOrganizerPrompt(value = '') {
      visualOrganizerComposerState.prompt = String(value || '');
      const state = getVisualOrganizerPluginState();
      if (String(state.draftPrompt || '') !== visualOrganizerComposerState.prompt) {
        setVisualOrganizerPluginState((prev) => ({ ...prev, draftPrompt: visualOrganizerComposerState.prompt }), { save: false, skipRender: true });
      }
      rerenderVisualOrganizerWorkspace();
    };

    window.selectVisualOrganizerTemplate = function selectVisualOrganizerTemplate(templateKey = 'auto') {
      visualOrganizerComposerState.templateKey = sanitizeInlineText(templateKey, 48) || 'auto';
      setVisualOrganizerPluginState((prev) => ({ ...prev, selectedTemplate: visualOrganizerComposerState.templateKey }), { save: false, skipRender: true });
      rerenderVisualOrganizerWorkspace();
    };

    window.openVisualOrganizerHistoryItem = function openVisualOrganizerHistoryItem(eventOrId = null, maybeId = '') {
      const id = typeof eventOrId === 'string' && !maybeId ? eventOrId : maybeId;
      const targetId = sanitizeInlineText(id, 48);
      if (!targetId) return false;
      visualOrganizerComposerState.suppressStarterAutocreate = false;
      setVisualOrganizerPluginState((prev) => ({ ...prev, activeOrganizerId: targetId }), { save: false, skipRender: true });
      rerenderVisualOrganizerWorkspace();
      return false;
    };

    window.deleteVisualOrganizerHistoryItem = function deleteVisualOrganizerHistoryItem(eventOrId = null, maybeId = '') {
      const id = typeof eventOrId === 'string' && !maybeId ? eventOrId : maybeId;
      const targetId = sanitizeInlineText(id, 48);
      if (!targetId) return false;
      let deleted = false;
      let removedCount = 0;
      setVisualOrganizerPluginState((prev) => {
        const currentList = Array.isArray(prev.organizers) ? prev.organizers : [];
        const targetItem = currentList.find((item) => String(item?.id || '') === targetId) || null;
        const shouldDeleteMatchingStarters = isVisualOrganizerStarterLike(targetItem);
        const starterKey = shouldDeleteMatchingStarters ? buildVisualOrganizerStarterKey(targetItem) : '';
        const nextList = currentList.filter((item) => {
          if (String(item?.id || '') === targetId) return false;
          if (shouldDeleteMatchingStarters && isVisualOrganizerStarterLike(item) && buildVisualOrganizerStarterKey(item) === starterKey) return false;
          return true;
        });
        removedCount = Math.max(0, currentList.length - nextList.length);
        deleted = removedCount > 0;
        const currentIndex = currentList.findIndex((item) => String(item?.id || '') === targetId);
        const fallbackIndex = currentIndex >= 0 ? Math.min(currentIndex, Math.max(0, nextList.length - 1)) : 0;
        return {
          ...prev,
          activeOrganizerId: nextList[fallbackIndex]?.id || '',
          organizers: nextList,
        };
      }, { save: true, skipRender: true });
      if (deleted) {
        const state = getVisualOrganizerPluginState();
        visualOrganizerComposerState.suppressStarterAutocreate = !Array.isArray(state?.organizers) || !state.organizers.length;
        visualOrganizerComposerState.statusText = removedCount > 1 ? `已删除 ${removedCount} 张重复练习板。` : '练习板已删除。';
        visualOrganizerComposerState.statusError = false;
      }
      rerenderVisualOrganizerWorkspace();
      return false;
    };

    window.updateVisualOrganizerMetaField = function updateVisualOrganizerMetaField(field = 'title', value = '') {
      const key = sanitizeInlineText(field, 32);
      const nextValue = key === 'summary'
        ? sanitizeInlineText(value, 180)
        : key === 'focusQuestion'
          ? sanitizeInlineText(value, 120)
          : sanitizeInlineText(value, 80);
      if (!['title', 'summary', 'centralTopic', 'focusQuestion'].includes(key)) return;
      updateActiveVisualOrganizer((draft) => {
        if (key === 'title') {
          draft.title = nextValue || draft.title || '未命名视觉组织图';
          if (!sanitizeInlineText(draft.centralTopic || '', 80)) draft.centralTopic = draft.title;
        } else {
          draft[key] = nextValue;
        }
        return draft;
      });
      setVisualOrganizerEditorStatus('图上修改已保存。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.updateVisualOrganizerSectionTitle = function updateVisualOrganizerSectionTitle(sectionIndex = -1, value = '') {
      const normalizedSectionIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      const nextTitle = sanitizeInlineText(value, 72);
      if (normalizedSectionIndex < 0 || !nextTitle) return;
      updateActiveVisualOrganizer((draft) => {
        if (!draft.sections[normalizedSectionIndex]) return draft;
        draft.sections[normalizedSectionIndex].title = nextTitle;
        return draft;
      });
      setVisualOrganizerEditorStatus('板块标题已保存。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.updateVisualOrganizerItemText = function updateVisualOrganizerItemText(sectionIndex = -1, itemIndex = -1, value = '') {
      const sIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      const iIndex = Number.isFinite(Number(itemIndex)) ? Number(itemIndex) : -1;
      const nextText = sanitizeInlineText(value, 100);
      if (sIndex < 0 || iIndex < 0 || !nextText) return;
      updateActiveVisualOrganizer((draft) => {
        if (!draft.sections[sIndex] || !Array.isArray(draft.sections[sIndex].items) || !draft.sections[sIndex].items[iIndex]) return draft;
        draft.sections[sIndex].items[iIndex] = nextText;
        return draft;
      });
      setVisualOrganizerEditorStatus('卡片内容已保存。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.deleteVisualOrganizerSection = function deleteVisualOrganizerSection(sectionIndex = -1) {
      const normalizedSectionIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      if (normalizedSectionIndex < 0) return;
      updateActiveVisualOrganizer((draft) => {
        draft.sections.splice(normalizedSectionIndex, 1);
        return draft;
      });
      setVisualOrganizerEditorStatus('板块已删除。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.deleteVisualOrganizerItem = function deleteVisualOrganizerItem(sectionIndex = -1, itemIndex = -1) {
      const sIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      const iIndex = Number.isFinite(Number(itemIndex)) ? Number(itemIndex) : -1;
      if (sIndex < 0 || iIndex < 0) return;
      updateActiveVisualOrganizer((draft) => {
        if (!draft.sections[sIndex] || !Array.isArray(draft.sections[sIndex].items)) return draft;
        draft.sections[sIndex].items.splice(iIndex, 1);
        return draft;
      });
      setVisualOrganizerEditorStatus('卡片已删除。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.startVisualOrganizerSectionDrag = function startVisualOrganizerSectionDrag(event = null, sectionIndex = -1) {
      visualOrganizerDragState.type = 'section';
      visualOrganizerDragState.sectionIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      visualOrganizerDragState.itemIndex = -1;
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', `section:${visualOrganizerDragState.sectionIndex}`);
      }
    };

    window.startVisualOrganizerItemDrag = function startVisualOrganizerItemDrag(event = null, sectionIndex = -1, itemIndex = -1) {
      visualOrganizerDragState.type = 'item';
      visualOrganizerDragState.sectionIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      visualOrganizerDragState.itemIndex = Number.isFinite(Number(itemIndex)) ? Number(itemIndex) : -1;
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', `item:${visualOrganizerDragState.sectionIndex}:${visualOrganizerDragState.itemIndex}`);
      }
    };

    window.clearVisualOrganizerDragState = function clearVisualOrganizerDragStateHandler() {
      clearVisualOrganizerDragState();
    };

    window.allowVisualOrganizerDrop = function allowVisualOrganizerDrop(event = null) {
      if (event?.preventDefault) event.preventDefault();
      if (event?.dataTransfer) event.dataTransfer.dropEffect = 'move';
    };

    window.dropVisualOrganizerSection = function dropVisualOrganizerSection(event = null, targetSectionIndex = -1) {
      if (event?.preventDefault) event.preventDefault();
      const normalizedTargetSectionIndex = Number.isFinite(Number(targetSectionIndex)) ? Number(targetSectionIndex) : -1;
      if (normalizedTargetSectionIndex < 0) {
        clearVisualOrganizerDragState();
        return;
      }
      let changed = false;
      if (visualOrganizerDragState.type === 'section') {
        const placement = computeDropPlacement(event, event?.currentTarget?.clientWidth > event?.currentTarget?.clientHeight ? 'x' : 'y');
        changed = moveVisualOrganizerSectionByDrag(visualOrganizerDragState.sectionIndex, normalizedTargetSectionIndex, placement);
        if (changed) setVisualOrganizerEditorStatus('板块顺序已通过拖拽更新。', 'success');
      } else if (visualOrganizerDragState.type === 'item') {
        changed = moveVisualOrganizerItemByDrag(
          visualOrganizerDragState.sectionIndex,
          visualOrganizerDragState.itemIndex,
          normalizedTargetSectionIndex,
          -1,
          'after'
        );
        if (changed) setVisualOrganizerEditorStatus('卡片已拖到新的板块。', 'success');
      }
      clearVisualOrganizerDragState();
      if (changed) rerenderVisualOrganizerWorkspace();
    };

    window.dropVisualOrganizerItem = function dropVisualOrganizerItem(event = null, targetSectionIndex = -1, targetItemIndex = -1) {
      if (event?.preventDefault) event.preventDefault();
      if (visualOrganizerDragState.type !== 'item') {
        clearVisualOrganizerDragState();
        return;
      }
      const normalizedTargetSectionIndex = Number.isFinite(Number(targetSectionIndex)) ? Number(targetSectionIndex) : -1;
      const normalizedTargetItemIndex = Number.isFinite(Number(targetItemIndex)) ? Number(targetItemIndex) : -1;
      if (normalizedTargetSectionIndex < 0 || normalizedTargetItemIndex < 0) {
        clearVisualOrganizerDragState();
        return;
      }
      const placement = computeDropPlacement(event, 'y');
      const changed = moveVisualOrganizerItemByDrag(
        visualOrganizerDragState.sectionIndex,
        visualOrganizerDragState.itemIndex,
        normalizedTargetSectionIndex,
        normalizedTargetItemIndex,
        placement
      );
      clearVisualOrganizerDragState();
      if (changed) {
        setVisualOrganizerEditorStatus('卡片顺序已通过拖拽更新。', 'success');
        rerenderVisualOrganizerWorkspace();
      }
    };

    window.selectVisualOrganizerEditorTarget = function selectVisualOrganizerEditorTarget(selectionType = 'meta', sectionIndex = -1, itemIndex = -1) {
      visualOrganizerEditorState.selectionType = ['meta', 'section', 'item'].includes(String(selectionType || '').trim())
        ? String(selectionType || '').trim()
        : 'meta';
      visualOrganizerEditorState.sectionIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      visualOrganizerEditorState.itemIndex = Number.isFinite(Number(itemIndex)) ? Number(itemIndex) : -1;
      setVisualOrganizerEditorStatus('');
      rerenderVisualOrganizerWorkspace();
    };

    window.saveVisualOrganizerEditorSelection = function saveVisualOrganizerEditorSelection() {
      const organizer = getVisualOrganizerActiveItem(getVisualOrganizerPluginState());
      if (!organizer) return;
      const selection = getVisualOrganizerEditorSelection(organizer);
      if (selection.selectionType === 'section' && selection.section) {
        const input = document.getElementById('visual-organizer-editor-section-title');
        const nextTitle = sanitizeInlineText(input?.value || '', 72);
        if (!nextTitle) {
          setVisualOrganizerEditorStatus('板块标题不能为空。', 'danger');
          rerenderVisualOrganizerWorkspace();
          return;
        }
        updateActiveVisualOrganizer((draft) => {
          draft.sections[selection.sectionIndex].title = nextTitle;
          return draft;
        });
        setVisualOrganizerEditorStatus('板块标题已保存。', 'success');
        rerenderVisualOrganizerWorkspace();
        return;
      }
      if (selection.selectionType === 'item' && selection.section) {
        const input = document.getElementById('visual-organizer-editor-item-text');
        const nextText = sanitizeInlineText(input?.value || '', 100);
        if (!nextText) {
          setVisualOrganizerEditorStatus('卡片内容不能为空。', 'danger');
          rerenderVisualOrganizerWorkspace();
          return;
        }
        updateActiveVisualOrganizer((draft) => {
          draft.sections[selection.sectionIndex].items[selection.itemIndex] = nextText;
          return draft;
        });
        setVisualOrganizerEditorStatus('卡片内容已保存。', 'success');
        rerenderVisualOrganizerWorkspace();
        return;
      }
      const titleInput = document.getElementById('visual-organizer-editor-title');
      const summaryInput = document.getElementById('visual-organizer-editor-summary');
      const topicInput = document.getElementById('visual-organizer-editor-central-topic');
      const questionInput = document.getElementById('visual-organizer-editor-focus-question');
      const nextTitle = sanitizeInlineText(titleInput?.value || organizer?.title || '', 80);
      if (!nextTitle) {
        setVisualOrganizerEditorStatus('标题不能为空。', 'danger');
        rerenderVisualOrganizerWorkspace();
        return;
      }
      updateActiveVisualOrganizer((draft) => {
        draft.title = nextTitle;
        draft.summary = sanitizeInlineText(summaryInput?.value || '', 180);
        draft.centralTopic = sanitizeInlineText(topicInput?.value || nextTitle, 80) || nextTitle;
        draft.focusQuestion = sanitizeInlineText(questionInput?.value || '', 120);
        return draft;
      });
      setVisualOrganizerEditorStatus('整张图的信息已保存。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.createVisualOrganizerSection = function createVisualOrganizerSection() {
      const organizer = getVisualOrganizerActiveItem(getVisualOrganizerPluginState());
      if (!organizer) return;
      const sections = buildVisualOrganizerEditableSections(organizer);
      const nextIndex = sections.length;
      updateActiveVisualOrganizer((draft) => {
        draft.sections.push({
          title: getVisualOrganizerSuggestedSectionTitle(draft.templateKey || organizer.templateKey || 'auto', nextIndex),
          items: [],
        });
        return draft;
      });
      visualOrganizerEditorState.selectionType = 'section';
      visualOrganizerEditorState.sectionIndex = nextIndex;
      visualOrganizerEditorState.itemIndex = -1;
      setVisualOrganizerEditorStatus('已新增一个板块。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.createVisualOrganizerSectionItem = function createVisualOrganizerSectionItem(sectionIndex = -1) {
      const organizer = getVisualOrganizerActiveItem(getVisualOrganizerPluginState());
      const normalizedSectionIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      if (!organizer || normalizedSectionIndex < 0) return;
      let nextItemIndex = 0;
      updateActiveVisualOrganizer((draft) => {
        const section = draft.sections[normalizedSectionIndex];
        if (!section) return draft;
        nextItemIndex = Array.isArray(section.items) ? section.items.length : 0;
        section.items = Array.isArray(section.items) ? section.items : [];
        section.items.push(`新卡片 ${nextItemIndex + 1}`);
        return draft;
      });
      visualOrganizerEditorState.selectionType = 'item';
      visualOrganizerEditorState.sectionIndex = normalizedSectionIndex;
      visualOrganizerEditorState.itemIndex = nextItemIndex;
      setVisualOrganizerEditorStatus('已新增一个可编辑卡片。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.moveVisualOrganizerSection = function moveVisualOrganizerSection(sectionIndex = -1, delta = 0) {
      const fromIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      const offset = Number.isFinite(Number(delta)) ? Number(delta) : 0;
      if (fromIndex < 0 || !offset) return;
      const organizer = getVisualOrganizerActiveItem(getVisualOrganizerPluginState());
      const sections = buildVisualOrganizerEditableSections(organizer);
      const toIndex = fromIndex + offset;
      if (!organizer || toIndex < 0 || toIndex >= sections.length) return;
      updateActiveVisualOrganizer((draft) => {
        const moved = draft.sections.splice(fromIndex, 1)[0];
        draft.sections.splice(toIndex, 0, moved);
        return draft;
      });
      visualOrganizerEditorState.selectionType = 'section';
      visualOrganizerEditorState.sectionIndex = toIndex;
      visualOrganizerEditorState.itemIndex = -1;
      setVisualOrganizerEditorStatus('板块位置已更新。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.moveVisualOrganizerItem = function moveVisualOrganizerItem(sectionIndex = -1, itemIndex = -1, delta = 0) {
      const sIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      const iIndex = Number.isFinite(Number(itemIndex)) ? Number(itemIndex) : -1;
      const offset = Number.isFinite(Number(delta)) ? Number(delta) : 0;
      if (sIndex < 0 || iIndex < 0 || !offset) return;
      const organizer = getVisualOrganizerActiveItem(getVisualOrganizerPluginState());
      const section = buildVisualOrganizerEditableSections(organizer)[sIndex];
      const toIndex = iIndex + offset;
      if (!organizer || !section || toIndex < 0 || toIndex >= section.items.length) return;
      updateActiveVisualOrganizer((draft) => {
        const list = draft.sections[sIndex].items;
        const moved = list.splice(iIndex, 1)[0];
        list.splice(toIndex, 0, moved);
        return draft;
      });
      visualOrganizerEditorState.selectionType = 'item';
      visualOrganizerEditorState.sectionIndex = sIndex;
      visualOrganizerEditorState.itemIndex = toIndex;
      setVisualOrganizerEditorStatus('卡片顺序已更新。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.moveVisualOrganizerItemAcrossSections = function moveVisualOrganizerItemAcrossSections(sectionIndex = -1, itemIndex = -1, delta = 0) {
      const sIndex = Number.isFinite(Number(sectionIndex)) ? Number(sectionIndex) : -1;
      const iIndex = Number.isFinite(Number(itemIndex)) ? Number(itemIndex) : -1;
      const offset = Number.isFinite(Number(delta)) ? Number(delta) : 0;
      if (sIndex < 0 || iIndex < 0 || !offset) return;
      const organizer = getVisualOrganizerActiveItem(getVisualOrganizerPluginState());
      const sections = buildVisualOrganizerEditableSections(organizer);
      const targetSectionIndex = sIndex + offset;
      if (!organizer || targetSectionIndex < 0 || targetSectionIndex >= sections.length) return;
      let targetItemIndex = 0;
      updateActiveVisualOrganizer((draft) => {
        const fromList = draft.sections[sIndex].items;
        const toList = draft.sections[targetSectionIndex].items;
        const moved = fromList.splice(iIndex, 1)[0];
        targetItemIndex = Array.isArray(toList) ? toList.length : 0;
        toList.push(moved);
        return draft;
      });
      visualOrganizerEditorState.selectionType = 'item';
      visualOrganizerEditorState.sectionIndex = targetSectionIndex;
      visualOrganizerEditorState.itemIndex = targetItemIndex;
      setVisualOrganizerEditorStatus('卡片已移动到另一个板块。', 'success');
      rerenderVisualOrganizerWorkspace();
    };

    window.deleteVisualOrganizerEditorSelection = function deleteVisualOrganizerEditorSelection() {
      const organizer = getVisualOrganizerActiveItem(getVisualOrganizerPluginState());
      if (!organizer) return;
      const selection = getVisualOrganizerEditorSelection(organizer);
      if (selection.selectionType === 'item' && selection.section) {
        updateActiveVisualOrganizer((draft) => {
          draft.sections[selection.sectionIndex].items.splice(selection.itemIndex, 1);
          return draft;
        });
        visualOrganizerEditorState.selectionType = 'section';
        visualOrganizerEditorState.itemIndex = -1;
        setVisualOrganizerEditorStatus('卡片已删除。', 'success');
        rerenderVisualOrganizerWorkspace();
        return;
      }
      if (selection.selectionType === 'section' && selection.section) {
        updateActiveVisualOrganizer((draft) => {
          draft.sections.splice(selection.sectionIndex, 1);
          return draft;
        });
        visualOrganizerEditorState.selectionType = 'meta';
        visualOrganizerEditorState.sectionIndex = -1;
        visualOrganizerEditorState.itemIndex = -1;
        setVisualOrganizerEditorStatus('板块已删除。', 'success');
        rerenderVisualOrganizerWorkspace();
      }
    };

    window.generateVisualOrganizerWorkspaceDraft = async function generateVisualOrganizerWorkspaceDraft() {
      const prompt = String(visualOrganizerComposerState.prompt || '').trim();
      if (!prompt) {
        visualOrganizerComposerState.statusText = '先输入一句口令，再让 AI 生成。';
        visualOrganizerComposerState.statusError = true;
        rerenderVisualOrganizerWorkspace();
        return;
      }
      if (visualOrganizerComposerState.busy) return;
      visualOrganizerComposerState.busy = true;
      visualOrganizerComposerState.suppressStarterAutocreate = false;
      visualOrganizerComposerState.statusText = '正在让 AI 组织这张图…';
      visualOrganizerComposerState.statusError = false;
      rerenderVisualOrganizerWorkspace();
      try {
        const result = typeof api.generateVisualOrganizerDraftWithAI === 'function'
          ? await api.generateVisualOrganizerDraftWithAI(prompt, { templateKey: visualOrganizerComposerState.templateKey, save: true })
          : { ok: false, message: '当前环境没有接入视觉组织图 AI 生成器。' };
        if (!result?.ok) {
          visualOrganizerComposerState.statusText = String(result?.message || '视觉组织图生成失败，请换个口令再试。');
          visualOrganizerComposerState.statusError = true;
        } else {
          visualOrganizerComposerState.statusText = '视觉组织图已生成。你可以继续讲解它，或者换模板重做一版。';
          visualOrganizerComposerState.statusError = false;
          if (result?.organizer?.templateKey) {
            visualOrganizerComposerState.templateKey = String(result.organizer.templateKey || visualOrganizerComposerState.templateKey);
          }
        }
      } catch (error) {
        visualOrganizerComposerState.statusText = String(error?.message || '视觉组织图生成失败，请稍后再试。');
        visualOrganizerComposerState.statusError = true;
      }
      visualOrganizerComposerState.busy = false;
      rerenderVisualOrganizerWorkspace();
    };

    window.toggleVisualOrganizerWorkspaceVoice = function toggleVisualOrganizerWorkspaceVoice() {
      const recognition = ensureVisualOrganizerVoiceRecognition();
      visualOrganizerVoiceState.available = !!recognition;
      if (!recognition) {
        visualOrganizerComposerState.statusText = '当前环境不支持语音口令，请直接输入文字。';
        visualOrganizerComposerState.statusError = true;
        rerenderVisualOrganizerWorkspace();
        return;
      }
      if (visualOrganizerVoiceState.running) {
        stopVisualOrganizerVoiceCapture();
        return;
      }
      visualOrganizerVoiceState.finalText = '';
      visualOrganizerVoiceState.interimText = '';
      try {
        recognition.start();
      } catch (_) {
        visualOrganizerComposerState.statusText = '语音暂时无法启动，请稍后再试。';
        visualOrganizerComposerState.statusError = true;
        rerenderVisualOrganizerWorkspace();
      }
    };

    window.markVisualOrganizerManualDraftDirty = function markVisualOrganizerManualDraftDirtyHandler() {
      markVisualOrganizerManualDraftDirty();
    };

    window.previewVisualOrganizerMermaidDraft = async function previewVisualOrganizerMermaidDraft() {
      await previewVisualOrganizerManualDraft();
    };

    window.saveVisualOrganizerManualEdits = async function saveVisualOrganizerManualEdits() {
      await saveVisualOrganizerManualDraft();
    };

    window.resetVisualOrganizerMermaidDraft = async function resetVisualOrganizerMermaidDraft() {
      await resetVisualOrganizerManualDraft();
    };

    async function renderEmbeddedView(root, pluginId = '') {
      const definition = getCatalogDefinition(pluginId);
      if (!root || !definition) return null;
      const renderSequence = pluginId === 'expense-ledger-plugin'
        ? ++expenseLedgerEmbeddedRenderSequence
        : 0;
      if (pluginId === 'expense-ledger-plugin') {
        const payload = await buildExpenseLedgerWorkspaceContent(definition);
        if (renderSequence !== expenseLedgerEmbeddedRenderSequence) return null;
        return {
          title: payload.shellCopy.title,
          englishTitle: payload.shellCopy.englishTitle,
          description: payload.shellCopy.description,
          rightActions: [],
          body: payload.body,
          detailModal: payload.detailModal || null,
          postMount(rootEl) {
            if (!rootEl) return;
            restoreExpenseLedgerCalendarScroll(rootEl);
            syncExpenseLedgerDetailModalHost(payload.detailModal?.bucket || null, payload.detailModal?.label || '');
            if (typeof api.requestLucideRefresh === 'function') api.requestLucideRefresh({ root: rootEl });
          },
        };
      }
      clearExpenseLedgerDetailModalHost();
      clearExpenseLedgerManualModalHost();
      root.innerHTML = `<div class="rounded-[1rem] border border-dashed border-gray-200 dark:border-white/10 px-4 py-5 text-[12px] leading-7 text-gray-500 dark:text-white/45">这个财务插件暂时还没有嵌入版宿主渲染。</div>`;
      return {
        title: definition?.name || '财务',
        englishTitle: '',
        description: String(definition?.description || definition?.summary || '').trim(),
        rightActions: buildWorkspaceHeaderActions(definition, { skipPrimary: true }),
      };
    }

    window.triggerExpenseLedgerCsvImport = function triggerExpenseLedgerCsvImport() {
      const financeInput = document.getElementById('finance-csv-input');
      const inputs = Array.from(document.querySelectorAll('#expense-ledger-csv-input'));
      const input = (financeInput && financeInput.offsetParent !== null ? financeInput : null)
        || inputs.find((node) => node.closest?.('.view-section.active') || node.offsetParent !== null)
        || inputs[0]
        || null;
      if (!input) return;
      input.value = '';
      if (typeof input.showPicker === 'function') {
        try { input.showPicker(); return; } catch (_) {}
      }
      input.click();
    };

    window.handleExpenseLedgerCsvImportChange = async function handleExpenseLedgerCsvImportChange(event) {
      const files = Array.from(event?.target?.files || []);
      if (!files.length) return;
      const supportedFiles = files.filter((file) => {
        const fileName = String(file.name || '').toLowerCase();
        const fileType = String(file.type || '').toLowerCase();
        return fileName.endsWith('.csv')
          || fileName.endsWith('.tsv')
          || fileName.endsWith('.txt')
          || fileType.includes('csv')
          || fileType.includes('excel')
          || fileType.startsWith('text/')
          || fileType === 'application/octet-stream';
      });
      if (!supportedFiles.length) {
        expenseLedgerImportState.phase = 'error';
        expenseLedgerImportState.text = '请导入 CSV、TSV 或文本格式的账单文件';
        rerenderExpenseLedgerWorkspaceAndHost();
        syncExpenseLedgerImportFeedback(expenseLedgerImportState.text, 'error');
        if (event?.target) event.target.value = '';
        return;
      }
      expenseLedgerImportState.phase = 'loading';
      expenseLedgerImportState.text = supportedFiles.length > 1
        ? `正在预览 ${supportedFiles.length} 个文件...`
        : `正在预览 ${supportedFiles[0].name}...`;
      expenseLedgerImportState.imported = 0;
      expenseLedgerImportState.deduped = 0;
      expenseLedgerImportState.fixed = 0;
      expenseLedgerImportState.recovered = 0;
      expenseLedgerImportState.aiRefined = 0;
      rerenderExpenseLedgerWorkspaceAndHost();
      syncExpenseLedgerImportFeedback(expenseLedgerImportState.text, 'neutral');
      try {
        const runtime = getLocalPluginExpenseLedgerImportRuntimeModules();
        const result = runtime && typeof runtime.previewExpenseLedgerCsvFiles === 'function'
          ? await runtime.previewExpenseLedgerCsvFiles(supportedFiles)
          : { ok: false, message: 'CSV 预览功能暂不可用' };
        if (event?.target) event.target.value = '';
        if (!result || result.ok !== true) {
          throw new Error(result?.message || 'CSV 预览失败，请检查文件格式');
        }
        const previews = Array.isArray(result.previews) ? result.previews : [];
        const openModal = typeof api.openCustomModal === 'function' ? api.openCustomModal : window.openCustomModal;
        if (typeof openModal === 'function') {
          openModal({
            title: supportedFiles.length > 1 ? '确认导入这些账单？' : '确认导入这份账单？',
            desc: buildExpenseLedgerImportPreviewText(previews),
            actionText: '确认导入',
            onConfirm: () => {
              void runExpenseLedgerCsvImport(supportedFiles, event?.target || null);
            },
          });
        } else {
          void runExpenseLedgerCsvImport(supportedFiles, event?.target || null);
          return;
        }
      } catch (error) {
        expenseLedgerImportState.phase = 'error';
        expenseLedgerImportState.text = String(error?.message || 'CSV 预览失败，请检查文件格式');
        syncExpenseLedgerImportFeedback(expenseLedgerImportState.text, 'error');
        if (event?.target) event.target.value = '';
      }
      rerenderExpenseLedgerWorkspaceAndHost();
    };

    window.switchExpenseLedgerWorkspaceRange = function switchExpenseLedgerWorkspaceRange(range = 'month') {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.switchExpenseLedgerWorkspaceRange === 'function') {
        runtime.switchExpenseLedgerWorkspaceRange(range);
      }
    };

    window.switchExpenseLedgerWorkspaceType = function switchExpenseLedgerWorkspaceType() {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.switchExpenseLedgerWorkspaceType === 'function') {
        runtime.switchExpenseLedgerWorkspaceType();
      }
    };

    window.updateExpenseLedgerWorkspaceCustomRange = function updateExpenseLedgerWorkspaceCustomRange(field = 'start', value = '') {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.updateExpenseLedgerWorkspaceCustomRange === 'function') {
        runtime.updateExpenseLedgerWorkspaceCustomRange(field, value);
      }
    };

    window.beginExpenseLedgerWorkspaceQueryComposition = function beginExpenseLedgerWorkspaceQueryComposition() {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.beginExpenseLedgerWorkspaceQueryComposition === 'function') {
        runtime.beginExpenseLedgerWorkspaceQueryComposition();
      }
    };

    window.endExpenseLedgerWorkspaceQueryComposition = function endExpenseLedgerWorkspaceQueryComposition(value = '') {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.endExpenseLedgerWorkspaceQueryComposition === 'function') {
        runtime.endExpenseLedgerWorkspaceQueryComposition(value);
      }
    };

    window.stageExpenseLedgerWorkspaceQuery = function stageExpenseLedgerWorkspaceQuery(value = '') {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.stageExpenseLedgerWorkspaceQuery === 'function') {
        runtime.stageExpenseLedgerWorkspaceQuery(value);
      }
    };

    window.commitExpenseLedgerWorkspaceQuery = function commitExpenseLedgerWorkspaceQuery(value = '') {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.commitExpenseLedgerWorkspaceQuery === 'function') {
        runtime.commitExpenseLedgerWorkspaceQuery(value);
      }
    };

    window.handleExpenseLedgerWorkspaceQueryKeydown = function handleExpenseLedgerWorkspaceQueryKeydown(event = null) {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.handleExpenseLedgerWorkspaceQueryKeydown === 'function') {
        runtime.handleExpenseLedgerWorkspaceQueryKeydown(event);
      }
    };

    window.updateExpenseLedgerWorkspaceQuery = function updateExpenseLedgerWorkspaceQuery(value = '') {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.updateExpenseLedgerWorkspaceQuery === 'function') {
        runtime.updateExpenseLedgerWorkspaceQuery(value);
      }
    };

    window.selectExpenseLedgerWorkspaceBucket = function selectExpenseLedgerWorkspaceBucket(bucketKey = '') {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.selectExpenseLedgerWorkspaceBucket === 'function') {
        runtime.selectExpenseLedgerWorkspaceBucket(bucketKey);
      }
    };

    window.closeExpenseLedgerWorkspaceDetailModal = function closeExpenseLedgerWorkspaceDetailModal() {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.closeExpenseLedgerWorkspaceDetailModal === 'function') {
        runtime.closeExpenseLedgerWorkspaceDetailModal();
      }
    };

    window.jumpExpenseLedgerWorkspacePeriod = function jumpExpenseLedgerWorkspacePeriod(direction = 0) {
      const runtime = getLocalPluginExpenseLedgerViewRuntimeModules();
      if (runtime && typeof runtime.jumpExpenseLedgerWorkspacePeriod === 'function') {
        runtime.jumpExpenseLedgerWorkspacePeriod(direction);
      }
    };

    window.codexRemoteUpdateBaseUrl = function codexRemoteUpdateBaseUrl(value = '') {
      const runtime = getLocalPluginCodexRemoteRuntimeModules();
      if (runtime && typeof runtime.updateBaseUrl === 'function') runtime.updateBaseUrl(value);
    };

    window.codexRemoteUpdateAccessToken = function codexRemoteUpdateAccessToken(value = '') {
      const runtime = getLocalPluginCodexRemoteRuntimeModules();
      if (runtime && typeof runtime.updateAccessToken === 'function') runtime.updateAccessToken(value);
    };

    window.codexRemoteUpdateField = function codexRemoteUpdateField(field = '', value = '') {
      const runtime = getLocalPluginCodexRemoteRuntimeModules();
      if (runtime && typeof runtime.updateField === 'function') runtime.updateField(field, value);
    };

    window.codexRemoteSelectThread = function codexRemoteSelectThread(threadId = '') {
      const runtime = getLocalPluginCodexRemoteRuntimeModules();
      if (runtime && typeof runtime.selectThread === 'function') runtime.selectThread(threadId);
    };

    window.codexRemoteRefreshThreads = async function codexRemoteRefreshThreads() {
      const runtime = getLocalPluginCodexRemoteRuntimeModules();
      if (runtime && typeof runtime.refreshThreads === 'function') await runtime.refreshThreads();
    };

    window.codexRemoteTestConnection = async function codexRemoteTestConnection() {
      const runtime = getLocalPluginCodexRemoteRuntimeModules();
      if (runtime && typeof runtime.testConnection === 'function') await runtime.testConnection();
    };

    window.codexRemoteSendMessage = async function codexRemoteSendMessage() {
      const runtime = getLocalPluginCodexRemoteRuntimeModules();
      if (runtime && typeof runtime.sendMessage === 'function') await runtime.sendMessage();
    };

    window.codexRemoteClearDraft = function codexRemoteClearDraft() {
      const runtime = getLocalPluginCodexRemoteRuntimeModules();
      if (runtime && typeof runtime.clearDraft === 'function') runtime.clearDraft();
    };

    window.startPomodoroWorkspace = function startPomodoroWorkspace() {
      const runtime = getPomodoroPluginRuntimeModules();
      if (runtime && typeof runtime.isEnabled === 'function' && runtime.isEnabled() === false) return;
      if (runtime && typeof runtime.startFocus === 'function') runtime.startFocus();
      rerenderPomodoroWorkspace();
    };

    window.startPomodoroWorkspaceQuick = function startPomodoroWorkspaceQuick(minutes = 25) {
      const runtime = getPomodoroPluginRuntimeModules();
      if (runtime && typeof runtime.isEnabled === 'function' && runtime.isEnabled() === false) return;
      if (runtime && typeof runtime.startFocus === 'function') {
        runtime.startFocus({ focusDurationMinutes: Number(minutes) || 25 });
      }
      rerenderPomodoroWorkspace();
    };

    window.pausePomodoroWorkspace = function pausePomodoroWorkspace() {
      const runtime = getPomodoroPluginRuntimeModules();
      if (runtime && typeof runtime.isEnabled === 'function' && runtime.isEnabled() === false) return;
      if (runtime && typeof runtime.pause === 'function') runtime.pause();
      rerenderPomodoroWorkspace();
    };

    window.resumePomodoroWorkspace = function resumePomodoroWorkspace() {
      const runtime = getPomodoroPluginRuntimeModules();
      if (runtime && typeof runtime.isEnabled === 'function' && runtime.isEnabled() === false) return;
      if (runtime && typeof runtime.resume === 'function') runtime.resume();
      rerenderPomodoroWorkspace();
    };

    window.resetPomodoroWorkspace = function resetPomodoroWorkspace() {
      const runtime = getPomodoroPluginRuntimeModules();
      if (runtime && typeof runtime.isEnabled === 'function' && runtime.isEnabled() === false) return;
      if (runtime && typeof runtime.reset === 'function') runtime.reset();
      rerenderPomodoroWorkspace();
    };

    window.skipPomodoroWorkspacePhase = function skipPomodoroWorkspacePhase() {
      const runtime = getPomodoroPluginRuntimeModules();
      if (runtime && typeof runtime.isEnabled === 'function' && runtime.isEnabled() === false) return;
      if (runtime && typeof runtime.skip === 'function') runtime.skip();
      rerenderPomodoroWorkspace();
    };

    window.openPomodoroWorkspaceSettings = function openPomodoroWorkspaceSettings() {
      if (typeof api.openLocalPluginSettingsModalById === 'function') {
        api.openLocalPluginSettingsModalById('pomodoro-plugin');
      }
    };

    return {
      renderView,
      renderEmbeddedView,
      syncAIConversationUserFacingFiles,
      syncDailyLogUserFacingFiles,
      syncUserFacingMirrorOverview,
      syncExpenseLedgerUserFacingFiles,
      syncExpenseLedgerExtensionFiles,
      syncGlucoseUserFacingFiles,
      syncAppleHealthUserFacingFiles,
      syncAppleHealthExtensionFiles,
      syncAllPluginFacingDataExports,
    };
  }

  window.MorphLocalPluginWorkspaceRuntime = {
    create: createLocalPluginWorkspaceRuntime,
  };
})();
