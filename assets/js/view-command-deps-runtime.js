(function initMorphViewCommandDepsRuntime(root) {
    if (!root) return;
    const VIEW_COMMAND_HELPER_NAMES = `
applyAIChatSessionDrawerState applyMobileNavigationMode applyProjectTreePanelState applyProjectVisualOrganizerPanelState buildProjectChildCards bumpUISessionLock
canUseAtlasExtensionFeatures canUseAppleHealthExtensionFeatures canUseFinancePageFeatures canUseGlucoseExtensionFeatures canUseHealthPageFeatures clearBlockBatchSelection closeAIKeySettingsModal
closeDailyAlignSettingsModal closeFeishuSettingsModal closeGlucoseSettingsModal closeSecureVaultSettingsModal commitDailyVoiceLiveTranscript
ensureEditorHistorySeed ensureSelectedDailyMonth escapeHTML fetchGlucoseHistoryForHealth findProjectById focusOmniInputSoon
flushActiveManagedEditorToCanonicalData flushLocalCacheWriteNow flushPersistData getProjectParentId hideMobileMoreMenu hideStartupBlockers initDailyMonth isIOSNativeAppRuntime isMobileBottomInputMode isMobileNavMode
normalizeThoughtsViewPane parseMorphHashRoute refreshSettingsNativeState renderAIChatView renderFinanceContentTabs renderFinanceHostView
renderGlobalHeaderActionPill renderHealthVoiceUI renderHomeVoiceUI renderProjectDirectoryTree renderStandardBlockEditor requestLucideRefresh
requestRenderAll resetMobileQuickVoiceState resizeComposerTextarea scheduleChannelOpsSync setHealthViewPane setOmniBarVisible setThoughtsViewPane
shouldKeepStartupBlockersVisible shouldShowMobileBottomBar shouldShowOmniBar showExtensionList sortProjectsForDirectory startGlucoseHealthAutoRefresh forceExplicitHashRouteVisibilityFallback
stopAIVoiceRecognition stopGlucoseHealthAutoRefresh stopMobileQuickVoiceInput syncComposerLayoutState syncHeaderActionPillHitArea
syncMainScrollAreaBottomInset syncMobileBottomNavState syncMobileContextDetailInputState syncMobileQuickComposeButton
syncOmniInputPlaceholder syncThoughtsComposerChrome
    `.trim().split(/\s+/);

    function pickFunction(candidate, fallback) {
        return typeof candidate === 'function' ? candidate : fallback;
    }

    function buildViewCommandRuntimeHelpers(context = {}) {
        const helpers = context.helpers && typeof context.helpers === 'object' ? { ...context.helpers } : {};
        const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || root;
        VIEW_COMMAND_HELPER_NAMES.forEach((name) => {
            const key = String(name || '').trim();
            if (!key || typeof helpers[key] === 'function') return;
            const fromContext = context[key];
            if (typeof fromContext === 'function') {
                helpers[key] = fromContext;
                return;
            }
            const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
            if (typeof fromGlobal === 'function') {
                helpers[key] = fromGlobal;
                return;
            }
            const fromWindow = root && typeof root[key] === 'function' ? root[key] : null;
            if (typeof fromWindow === 'function') helpers[key] = fromWindow;
        });
        return helpers;
    }

    function create() {
        const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || root;
        const getGlobalFunction = (name = '') => {
            const key = String(name || '').trim();
            if (!key) return null;
            const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
            if (typeof fromGlobal === 'function') return fromGlobal;
            const fromWindow = root && typeof root[key] === 'function' ? root[key] : null;
            return typeof fromWindow === 'function' ? fromWindow : null;
        };
        const getGlobalValue = (name = '', fallback = null) => {
            const key = String(name || '').trim();
            if (!key) return fallback;
            if (globalRoot && typeof globalRoot[key] !== 'undefined') return globalRoot[key];
            if (root && typeof root[key] !== 'undefined') return root[key];
            return fallback;
        };
        const setGlobalValue = (name = '', value = undefined) => {
            const key = String(name || '').trim();
            if (!key) return;
            try {
                if (root && Object.prototype.hasOwnProperty.call(root, key)) {
                    root[key] = value;
                    return;
                }
            } catch (_) {}
            try {
                if (globalRoot) globalRoot[key] = value;
            } catch (_) {}
        };

        function buildDeps(ctx = {}) {
            const context = ctx && typeof ctx === 'object' ? ctx : {};
            return {
                getViewStateRuntimeModules: pickFunction(context.getViewStateRuntimeModules, () => null),
                getData: pickFunction(context.getData, () => null),
                getCurrentTab: pickFunction(context.getCurrentTab, () => ''),
                setCurrentTab: pickFunction(context.setCurrentTab, () => {}),
                getActiveContextId: pickFunction(context.getActiveContextId, () => null),
                setActiveContextId: pickFunction(context.setActiveContextId, () => {}),
                getSelectedDailyMonth: pickFunction(context.getSelectedDailyMonth, () => ''),
                setSelectedDailyMonth: pickFunction(context.setSelectedDailyMonth, () => {}),
                getActiveThoughtsViewPane: pickFunction(context.getActiveThoughtsViewPane, () => ''),
                setActiveThoughtsViewPane: pickFunction(context.setActiveThoughtsViewPane, () => {}),
                getLastNonAITab: pickFunction(context.getLastNonAITab, () => 'flashThoughts'),
                setLastNonAITab: pickFunction(context.setLastNonAITab, () => {}),
                getLastNonExtensionsTab: pickFunction(context.getLastNonExtensionsTab, () => 'flashThoughts'),
                setLastNonExtensionsTab: pickFunction(context.setLastNonExtensionsTab, () => {}),
                getMobileAIComposeActive: pickFunction(context.getMobileAIComposeActive, () => false),
                setMobileAIComposeActive: pickFunction(context.setMobileAIComposeActive, () => {}),
                getMobileFinanceAIComposeActive: pickFunction(context.getMobileFinanceAIComposeActive, () => false),
                setMobileFinanceAIComposeActive: pickFunction(context.setMobileFinanceAIComposeActive, () => {}),
                getMobileDailyAIComposeActive: pickFunction(context.getMobileDailyAIComposeActive, () => false),
                setMobileDailyAIComposeActive: pickFunction(context.setMobileDailyAIComposeActive, () => {}),
                getMobileHealthAIComposeActive: pickFunction(context.getMobileHealthAIComposeActive, () => false),
                setMobileHealthAIComposeActive: pickFunction(context.setMobileHealthAIComposeActive, () => {}),
                getActiveLocalPluginWorkspaceId: pickFunction(context.getActiveLocalPluginWorkspaceId, () => ''),
                setActiveLocalPluginWorkspaceId: pickFunction(context.setActiveLocalPluginWorkspaceId, () => {}),
                getMobileMoreMenuOpen: pickFunction(context.getMobileMoreMenuOpen, () => false),
                getMobileProjectOrbitPanelOpen: pickFunction(context.getMobileProjectOrbitPanelOpen, () => false),
                setMobileProjectOrbitPanelOpen: pickFunction(context.setMobileProjectOrbitPanelOpen, () => {}),
                getGlucoseSettingsModalOpen: pickFunction(context.getGlucoseSettingsModalOpen, () => false),
                getFeishuSettingsModalOpen: pickFunction(context.getFeishuSettingsModalOpen, () => false),
                getDailyAlignSettingsModalOpen: pickFunction(context.getDailyAlignSettingsModalOpen, () => false),
                getAIKeySettingsModalOpen: pickFunction(context.getAIKeySettingsModalOpen, () => false),
                getSecureVaultSettingsModalOpen: pickFunction(context.getSecureVaultSettingsModalOpen, () => false),
                getAIVoiceState: pickFunction(context.getAIVoiceState, () => ({})),
                getDailyVoiceState: pickFunction(context.getDailyVoiceState, () => ({})),
                getMobileQuickVoiceState: pickFunction(context.getMobileQuickVoiceState, () => ({})),
                getLowPerfMode: pickFunction(context.getLowPerfMode, () => false),
                getLastTabKey: pickFunction(context.getLastTabKey, () => ''),
                helpers: {
                    ...buildViewCommandRuntimeHelpers(context),
                    shouldKeepStartupBlockersVisible: pickFunction(context.shouldKeepStartupBlockersVisible, () => false),
                    hideStartupBlockers: pickFunction(context.hideStartupBlockers, () => undefined),
                },
            };
        }

        function buildAppDeps(ctx = {}) {
            const context = ctx && typeof ctx === 'object' ? ctx : {};
            return {
                getViewStateRuntimeModules: pickFunction(context.getViewStateRuntimeModules, getGlobalFunction('getViewStateRuntimeModules') || (() => null)),
                getData: pickFunction(context.getData, () => {
                    const value = getGlobalValue('data', null);
                    return value && typeof value === 'object' ? value : { projects: [], routines: [], fixed: [], dailyMonths: {} };
                }),
                getCurrentTab: pickFunction(context.getCurrentTab, () => String(getGlobalValue('currentTab', 'flashThoughts') || 'flashThoughts').trim() || 'flashThoughts'),
                setCurrentTab: pickFunction(context.setCurrentTab, (value) => { setGlobalValue('currentTab', String(value || '').trim() || 'flashThoughts'); }),
                getActiveContextId: pickFunction(context.getActiveContextId, () => {
                    const value = getGlobalValue('activeContextId', null);
                    return value == null ? null : String(value || '').trim() || null;
                }),
                setActiveContextId: pickFunction(context.setActiveContextId, (value) => { setGlobalValue('activeContextId', value == null ? null : String(value || '').trim() || null); }),
                getSelectedDailyMonth: pickFunction(context.getSelectedDailyMonth, () => String(getGlobalValue('selectedDailyMonth', '') || '').trim()),
                setSelectedDailyMonth: pickFunction(context.setSelectedDailyMonth, (value) => { setGlobalValue('selectedDailyMonth', String(value || '').trim()); }),
                getActiveThoughtsViewPane: pickFunction(context.getActiveThoughtsViewPane, () => String(getGlobalValue('activeThoughtsViewPane', '') || '').trim()),
                setActiveThoughtsViewPane: pickFunction(context.setActiveThoughtsViewPane, (value) => { setGlobalValue('activeThoughtsViewPane', String(value || '').trim()); }),
                getLastNonAITab: pickFunction(context.getLastNonAITab, () => String(getGlobalValue('lastNonAITab', 'flashThoughts') || 'flashThoughts').trim() || 'flashThoughts'),
                setLastNonAITab: pickFunction(context.setLastNonAITab, (value) => { setGlobalValue('lastNonAITab', String(value || '').trim() || 'flashThoughts'); }),
                getLastNonExtensionsTab: pickFunction(context.getLastNonExtensionsTab, () => String(getGlobalValue('lastNonExtensionsTab', 'flashThoughts') || 'flashThoughts').trim() || 'flashThoughts'),
                setLastNonExtensionsTab: pickFunction(context.setLastNonExtensionsTab, (value) => { setGlobalValue('lastNonExtensionsTab', String(value || '').trim() || 'flashThoughts'); }),
                getMobileAIComposeActive: pickFunction(context.getMobileAIComposeActive, () => !!getGlobalValue('mobileAIComposeActive', false)),
                setMobileAIComposeActive: pickFunction(context.setMobileAIComposeActive, (value) => { setGlobalValue('mobileAIComposeActive', value === true); }),
                getMobileFinanceAIComposeActive: pickFunction(context.getMobileFinanceAIComposeActive, () => !!getGlobalValue('mobileFinanceAIComposeActive', false)),
                setMobileFinanceAIComposeActive: pickFunction(context.setMobileFinanceAIComposeActive, (value) => { setGlobalValue('mobileFinanceAIComposeActive', value === true); }),
                getMobileDailyAIComposeActive: pickFunction(context.getMobileDailyAIComposeActive, () => !!getGlobalValue('mobileDailyAIComposeActive', false)),
                setMobileDailyAIComposeActive: pickFunction(context.setMobileDailyAIComposeActive, (value) => { setGlobalValue('mobileDailyAIComposeActive', value === true); }),
                getMobileHealthAIComposeActive: pickFunction(context.getMobileHealthAIComposeActive, () => !!getGlobalValue('mobileHealthAIComposeActive', false)),
                setMobileHealthAIComposeActive: pickFunction(context.setMobileHealthAIComposeActive, (value) => { setGlobalValue('mobileHealthAIComposeActive', value === true); }),
                getActiveLocalPluginWorkspaceId: pickFunction(context.getActiveLocalPluginWorkspaceId, () => String(getGlobalValue('activeLocalPluginWorkspaceId', '') || '').trim()),
                setActiveLocalPluginWorkspaceId: pickFunction(context.setActiveLocalPluginWorkspaceId, (value) => { setGlobalValue('activeLocalPluginWorkspaceId', String(value || '').trim()); }),
                getMobileMoreMenuOpen: pickFunction(context.getMobileMoreMenuOpen, () => !!getGlobalValue('mobileMoreMenuOpen', false)),
                getMobileProjectOrbitPanelOpen: pickFunction(context.getMobileProjectOrbitPanelOpen, () => !!getGlobalValue('mobileProjectOrbitPanelOpen', false)),
                setMobileProjectOrbitPanelOpen: pickFunction(context.setMobileProjectOrbitPanelOpen, (value) => { setGlobalValue('mobileProjectOrbitPanelOpen', value === true); }),
                getGlucoseSettingsModalOpen: pickFunction(context.getGlucoseSettingsModalOpen, () => !!getGlobalValue('glucoseSettingsModalOpen', false)),
                getFeishuSettingsModalOpen: pickFunction(context.getFeishuSettingsModalOpen, () => !!getGlobalValue('feishuSettingsModalOpen', false)),
                getDailyAlignSettingsModalOpen: pickFunction(context.getDailyAlignSettingsModalOpen, () => !!getGlobalValue('dailyAlignSettingsModalOpen', false)),
                getAIKeySettingsModalOpen: pickFunction(context.getAIKeySettingsModalOpen, () => !!getGlobalValue('aiKeySettingsModalOpen', false)),
                getSecureVaultSettingsModalOpen: pickFunction(context.getSecureVaultSettingsModalOpen, () => !!getGlobalValue('secureVaultSettingsModalOpen', false)),
                getAIVoiceState: pickFunction(context.getAIVoiceState, () => getGlobalValue('aiVoiceState', { running: false }) || { running: false }),
                getDailyVoiceState: pickFunction(context.getDailyVoiceState, () => getGlobalValue('dailyVoiceState', { running: false }) || { running: false }),
                getMobileQuickVoiceState: pickFunction(context.getMobileQuickVoiceState, () => getGlobalValue('mobileQuickVoiceState', { running: false }) || { running: false }),
                getLowPerfMode: pickFunction(context.getLowPerfMode, () => !!getGlobalValue('LOW_PERF_MODE', false)),
                getLastTabKey: pickFunction(context.getLastTabKey, () => String(getGlobalValue('LAST_TAB_KEY', 'lianxing_last_tab_v1') || 'lianxing_last_tab_v1')),
                helpers: {
                    ...buildViewCommandRuntimeHelpers(context),
                    shouldKeepStartupBlockersVisible: pickFunction(context.shouldKeepStartupBlockersVisible, getGlobalFunction('shouldKeepStartupBlockersVisible') || (() => false)),
                    hideStartupBlockers: pickFunction(context.hideStartupBlockers, getGlobalFunction('hideStartupBlockers') || (() => undefined)),
                },
            };
        }

        return { buildDeps, buildAppDeps };
    }

    root.MorphViewCommandDepsRuntime = { create };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
