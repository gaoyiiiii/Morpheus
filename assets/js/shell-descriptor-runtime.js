(function initMorphShellDescriptorRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphShellDescriptorRuntime && typeof window.MorphShellDescriptorRuntime.create === 'function') return;

  const SHELL_DESCRIPTOR_VERSION = 'shell.v1';

  function normalizePlatform(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'ios' || normalized === 'iphone' || normalized === 'ipad') return 'ios';
    if (normalized === 'watchos' || normalized === 'watch') return 'watchos';
    if (normalized === 'browser' || normalized === 'web') return 'web';
    if (normalized === 'mac' || normalized === 'macos' || normalized === 'darwin' || normalized === 'desktop') return 'macos';
    return normalized;
  }

  function trimText(value = '') {
    return String(value || '').trim();
  }

  function normalizeNativeBuildInfo(raw = null) {
    if (!raw || typeof raw !== 'object') return null;
    const buildTime = trimText(raw.buildTime || raw.nativeBuildTime || raw.compiledAt);
    const binaryMTime = trimText(raw.binaryMTime || raw.binaryMtime || raw.binaryModifiedAt);
    const binaryPath = trimText(raw.binaryPath || raw.executablePath || raw.path);
    const webBuildStamp = trimText(raw.webBuildStamp || raw.webBuildVersion || raw.buildStamp);
    if (!buildTime && !binaryMTime && !binaryPath && !webBuildStamp) return null;
    return {
      buildTime,
      binaryMTime,
      binaryPath,
      webBuildStamp,
    };
  }

  function pickBridgeStatus({ available = false, degraded = false } = {}) {
    if (degraded) return 'degraded';
    return available ? 'available' : 'unavailable';
  }

  function createShellDescriptorRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getSyncReasonRuntime() {
      const factory = window.MorphSyncReasonRuntime && typeof window.MorphSyncReasonRuntime.create === 'function'
        ? window.MorphSyncReasonRuntime.create
        : null;
      return typeof factory === 'function' ? factory() : null;
    }

    function getSettingsState() {
      return api.getSettingsState && typeof api.getSettingsState === 'function'
        ? (api.getSettingsState() || {})
        : {};
    }

    function getStartupStorageDescriptor() {
      if (api.getStartupStorageDescriptor && typeof api.getStartupStorageDescriptor === 'function') {
        const descriptor = api.getStartupStorageDescriptor();
        if (descriptor && typeof descriptor === 'object') return descriptor;
      }
      if (api.getStartupStorageRuntimeModules && typeof api.getStartupStorageRuntimeModules === 'function') {
        const runtime = api.getStartupStorageRuntimeModules();
        if (runtime && typeof runtime.getStartupStorageDescriptor === 'function') {
          const descriptor = runtime.getStartupStorageDescriptor();
          if (descriptor && typeof descriptor === 'object') return descriptor;
        }
      }
      return null;
    }

    function getWebSyncRootMeta() {
      return api.getWebSyncRootMeta && typeof api.getWebSyncRootMeta === 'function'
        ? (api.getWebSyncRootMeta() || null)
        : null;
    }

    function getNativeSyncRootCache() {
      return api.readMorphNativeSyncRootCache && typeof api.readMorphNativeSyncRootCache === 'function'
        ? (api.readMorphNativeSyncRootCache() || {})
        : {};
    }

    function getSyncMutationState() {
      return api.getSyncMutationState && typeof api.getSyncMutationState === 'function'
        ? (api.getSyncMutationState() || null)
        : null;
    }

    function getLastSyncAt() {
      return api.getLastSyncAt && typeof api.getLastSyncAt === 'function'
        ? trimText(api.getLastSyncAt())
        : '';
    }

    function readLastSyncReceipt() {
      return api.readLastSyncReceipt && typeof api.readLastSyncReceipt === 'function'
        ? (api.readLastSyncReceipt() || null)
        : null;
    }

    function readBootstrapShellDescriptor() {
      if (api.readBootstrapShellDescriptor && typeof api.readBootstrapShellDescriptor === 'function') {
        const descriptor = api.readBootstrapShellDescriptor();
        if (descriptor && typeof descriptor === 'object') return descriptor;
      }
      const cachedDescriptor = window.__MorphShellDescriptor || window.__LianXingShellDescriptor || null;
      if (cachedDescriptor && typeof cachedDescriptor === 'object') return cachedDescriptor;
      return null;
    }

    function getCurrentDataSyncMeta() {
      return api.getCurrentDataSyncMeta && typeof api.getCurrentDataSyncMeta === 'function'
        ? (api.getCurrentDataSyncMeta() || {})
        : {};
    }

    function getLocationProtocol() {
      if (api.getLocationProtocol && typeof api.getLocationProtocol === 'function') {
        return trimText(api.getLocationProtocol());
      }
      if (typeof window !== 'undefined' && window.location) {
        return trimText(window.location.protocol);
      }
      return '';
    }

    function resolvePlatform(context = {}) {
      const explicitSettingsPlatform = normalizePlatform(context.settingsState?.nativePlatform);
      if (explicitSettingsPlatform && explicitSettingsPlatform !== 'browser') {
        return explicitSettingsPlatform;
      }
      const nativeInfoPlatform = normalizePlatform(context.nativeSyncRootInfo?.platform);
      if (nativeInfoPlatform) return nativeInfoPlatform;
      const nativeCachePlatform = normalizePlatform(context.nativeSyncRootCache?.platform);
      if (nativeCachePlatform) return nativeCachePlatform;
      if (context.isRunningInNativeIOSShell) return 'ios';
      if (context.isRunningInNativeDesktopShell) return 'macos';
      if (context.isFileRuntime) return 'macos';
      return 'web';
    }

    function resolveShellKind(context = {}) {
      if (context.platform !== 'web') return 'native-webview';
      if (context.isRunningInNativeDesktopShell || context.isRunningInNativeIOSShell) return 'native-webview';
      return 'browser';
    }

    function resolveSyncMode(context = {}) {
      if (context.platform === 'ios' && (context.hasNativeControlBridge || context.isRunningInNativeIOSShell)) {
        return 'ios-native-bridge';
      }
      if (context.platform === 'macos' && (context.hasNativeControlBridge || context.isRunningInNativeDesktopShell)) {
        return 'macos-native-bridge';
      }
      if (trimText(context.webSyncRootMeta?.pathLabel)) return 'web-browser-directory';
      if (context.isHttpRuntime) return 'web-local-server';
      return 'web-local-cache';
    }

    function resolveSyncRoot(context = {}) {
      const nativePath = trimText(
        context.nativeSyncRootInfo?.path
        || context.settingsState?.syncRootPath
        || context.nativeSyncRootCache?.path
      );
      if (context.syncMode === 'ios-native-bridge' || context.syncMode === 'macos-native-bridge') {
        return {
          kind: context.syncMode === 'ios-native-bridge' ? 'ios-app-directory' : 'native-sync-root',
          pathHint: nativePath,
          isUserSelected: !!nativePath,
          isWritable: !!nativePath,
          deleteSafe: typeof context.nativeSyncRootInfo?.deleteSafe === 'boolean'
            ? context.nativeSyncRootInfo.deleteSafe
            : (typeof context.settingsState?.syncRootDeleteSafe === 'boolean'
              ? context.settingsState.syncRootDeleteSafe
              : (typeof context.nativeSyncRootCache?.deleteSafe === 'boolean'
                ? context.nativeSyncRootCache.deleteSafe
                : null)),
        };
      }
      if (trimText(context.webSyncRootMeta?.pathLabel)) {
        return {
          kind: 'browser-directory',
          pathHint: trimText(context.webSyncRootMeta?.pathLabel),
          isUserSelected: true,
          isWritable: context.webSyncRootMeta?.writable === true,
          deleteSafe: null,
        };
      }
      if (context.syncMode === 'web-local-server') {
        return {
          kind: 'local-server-cache',
          pathHint: 'data/live-data.json',
          isUserSelected: false,
          isWritable: true,
          deleteSafe: null,
        };
      }
      return {
        kind: 'browser-local-cache',
        pathHint: '',
        isUserSelected: false,
        isWritable: false,
        deleteSafe: null,
      };
    }

    function resolveCanonicalStore(context = {}) {
      const startupDescriptor = context.startupDescriptor && typeof context.startupDescriptor === 'object'
        ? context.startupDescriptor
        : null;
      const canonicalSource = startupDescriptor?.canonicalStore && typeof startupDescriptor.canonicalStore === 'object'
        ? startupDescriptor.canonicalStore
        : null;
      const syncMeta = context.currentDataSyncMeta && typeof context.currentDataSyncMeta === 'object'
        ? context.currentDataSyncMeta
        : {};
      const revision = Number.isFinite(Number(syncMeta.revision))
        ? Number(syncMeta.revision)
        : Number(startupDescriptor?.authoritativeSnapshot?.revision || 0);
      return {
        kind: trimText(canonicalSource?.kind) || 'live-data-json',
        pathHint: trimText(canonicalSource?.pathHint || canonicalSource?.relativePath || 'data/live-data.json'),
        revision: Number.isFinite(revision) ? revision : 0,
      };
    }

    function resolveCapabilities(context = {}) {
      return {
        nativeSyncBridge: context.hasNativeSyncBridge === true,
        nativeControlBridge: context.hasNativeControlBridge === true,
        nativeSpeechBridge: context.hasNativeSpeechBridge === true,
        localServer: context.isHttpRuntime === true,
        browserDirectoryAccess: !!trimText(context.webSyncRootMeta?.pathLabel),
        notifications: context.notificationsCapable === true,
        pushToken: context.pushTokenCapable === true,
      };
    }

    function resolveDurableWriteOwner(syncMode = '') {
      if (syncMode === 'web-browser-directory') return 'browser-directory';
      if (syncMode === 'web-local-server') return 'local-server';
      if (syncMode === 'web-local-cache') return 'browser-local-cache';
      return 'native-sync-writer';
    }

    function describeStartupSelectionReason(context = {}) {
      const startupDescriptor = context.startupDescriptor && typeof context.startupDescriptor === 'object'
        ? context.startupDescriptor
        : null;
      const bootstrapSource = trimText(startupDescriptor?.bootstrapSource).toLowerCase();
      if (bootstrapSource === 'server-bootstrap-cache') {
        return '启动时优先采用 bootstrap 快照，再进入后续补水链。';
      }
      if (bootstrapSource === 'native-bootstrap-cache') {
        return '启动时采用原生壳注入快照，再进入后续补水链。';
      }
      if (bootstrapSource === 'startup-snapshot-fallback') {
        return '启动时未命中 bootstrap 快照，先回退到 startup snapshot。';
      }
      if (bootstrapSource === 'browser-directory-live-data') {
        return '当前已选择浏览器目录，启动后会优先从目录 live-data 补水。';
      }
      if (bootstrapSource === 'local-cache-fallback') {
        return '当前未命中外部权威快照，先使用本地缓存启动。';
      }
      if (context.syncMode === 'web-browser-directory') {
        return '当前运行在浏览器目录直连模式，目录 live-data 会作为主要权威候选。';
      }
      if (context.syncMode === 'ios-native-bridge' || context.syncMode === 'macos-native-bridge') {
        return '当前运行在原生桥接模式，原生目录与桥接回执是主要权威候选。';
      }
      return '当前启动来源未命中显式分类，需结合同步模式继续排查。';
    }

    function resolveStartupSourceInspection(context = {}) {
      const startupDescriptor = context.startupDescriptor && typeof context.startupDescriptor === 'object'
        ? context.startupDescriptor
        : null;
      const authoritativeSnapshot = startupDescriptor?.authoritativeSnapshot && typeof startupDescriptor.authoritativeSnapshot === 'object'
        ? startupDescriptor.authoritativeSnapshot
        : null;
      const canonicalStore = startupDescriptor?.canonicalStore && typeof startupDescriptor.canonicalStore === 'object'
        ? startupDescriptor.canonicalStore
        : null;
      const webSyncRootMeta = context.webSyncRootMeta && typeof context.webSyncRootMeta === 'object'
        ? context.webSyncRootMeta
        : null;
      const nativeSyncRootPath = trimText(
        context.nativeSyncRootInfo?.path
        || context.settingsState?.syncRootPath
        || context.nativeSyncRootCache?.path
      );
      return {
        bootstrapSource: trimText(startupDescriptor?.bootstrapSource) || 'local-cache-fallback',
        authoritativeSource: trimText(authoritativeSnapshot?.source),
        authoritativeRevision: Number.isFinite(Number(authoritativeSnapshot?.revision))
          ? Number(authoritativeSnapshot.revision)
          : 0,
        authoritativeLastWriteAt: trimText(authoritativeSnapshot?.lastWriteAt),
        authoritativeHasUserData: authoritativeSnapshot?.hasUserData === true,
        canonicalStoreKind: trimText(canonicalStore?.kind),
        canonicalStorePathHint: trimText(canonicalStore?.pathHint || canonicalStore?.relativePath),
        selectedBrowserDirectory: !!trimText(webSyncRootMeta?.pathLabel),
        browserDirectoryPathHint: trimText(webSyncRootMeta?.pathLabel),
        browserDirectoryReadable: !!(webSyncRootMeta && webSyncRootMeta.readable !== false),
        browserDirectoryWritable: webSyncRootMeta?.writable === true,
        nativeSyncRootPath,
        durableWriteOwner: resolveDurableWriteOwner(context.syncMode),
        selectionReason: describeStartupSelectionReason(context),
      };
    }

    function buildReceiptFeedId(receipt = null, kind = '', syncMutationState = null) {
      if (receipt && typeof receipt === 'object') {
        const explicitId = trimText(receipt.id || receipt.receiptId || receipt.mutationId);
        if (explicitId) return explicitId;
        const source = trimText(receipt.source);
        const updatedAt = trimText(receipt.updatedAt);
        const ackedRevision = Number.isFinite(Number(receipt.ackedRevision)) ? Number(receipt.ackedRevision) : 0;
        if (source || updatedAt || ackedRevision > 0) {
          return [kind || 'receipt', source || 'source', updatedAt || `rev:${ackedRevision || 0}`].join(':');
        }
      }
      if (syncMutationState && typeof syncMutationState === 'object') {
        const pendingCount = Number.isFinite(Number(syncMutationState.pendingCount)) ? Number(syncMutationState.pendingCount) : 0;
        const ackedRevision = Number.isFinite(Number(syncMutationState.ackedRevision)) ? Number(syncMutationState.ackedRevision) : 0;
        if (pendingCount > 0 || ackedRevision > 0) {
          return `${kind || 'receipt'}:acked:${ackedRevision}:pending:${pendingCount}`;
        }
      }
      return '';
    }

    function resolveReceiptFeed(context = {}) {
      const receipt = context.lastSyncReceipt && typeof context.lastSyncReceipt === 'object'
        ? context.lastSyncReceipt
        : null;
      const reasonRuntime = getSyncReasonRuntime();
      const reasonSurface = reasonRuntime && typeof reasonRuntime.buildSyncReasonSurface === 'function'
        ? reasonRuntime.buildSyncReasonSurface({
            receipt,
            descriptor: {
              durableWriteOwner: resolveDurableWriteOwner(context.syncMode),
              platform: context.platform,
              syncMode: context.syncMode,
            },
            syncState: context.syncMutationState,
            currentMeta: context.currentDataSyncMeta,
          })
        : null;
      const kind = context.syncMode === 'ios-native-bridge' || context.syncMode === 'macos-native-bridge'
          ? 'native-ack'
          : (context.syncMode === 'web-local-cache' ? 'local-only' : 'sync-events');
      return {
        kind,
        lastReceiptId: buildReceiptFeedId(receipt, kind, context.syncMutationState),
        lastReceiptAt: trimText(receipt?.updatedAt || context.lastSyncAt),
        status: trimText(receipt?.status),
        source: trimText(receipt?.source),
        reason: trimText(receipt?.reason),
        pendingCount: Number.isFinite(Number(context.syncMutationState?.pendingCount))
          ? Number(context.syncMutationState.pendingCount)
          : Number.isFinite(Number(receipt?.pendingCount)) ? Number(receipt.pendingCount) : 0,
        ackedRevision: Number.isFinite(Number(receipt?.ackedRevision))
          ? Number(receipt.ackedRevision)
          : (Number.isFinite(Number(context.syncMutationState?.ackedRevision))
            ? Number(context.syncMutationState.ackedRevision)
            : 0),
        reasonSurface,
      };
    }

    function resolveBridgeStatus(context = {}) {
      const hasNativeShell = context.isRunningInNativeDesktopShell || context.isRunningInNativeIOSShell || context.platform !== 'web';
      return {
        sync: pickBridgeStatus({
          available: context.hasNativeSyncBridge === true
            || context.syncMode === 'web-local-server'
            || (context.syncMode === 'web-browser-directory' && context.webSyncRootMeta?.writable === true),
          degraded: (hasNativeShell && context.hasNativeControlBridge === true && context.hasNativeSyncBridge !== true)
            || (context.syncMode === 'web-browser-directory' && context.webSyncRootMeta?.writable !== true),
        }),
        control: pickBridgeStatus({
          available: context.hasNativeControlBridge === true,
          degraded: hasNativeShell && context.hasNativeControlBridge !== true,
        }),
        speech: pickBridgeStatus({
          available: context.hasNativeSpeechBridge === true,
          degraded: hasNativeShell && context.hasNativeSpeechBridge !== true,
        }),
      };
    }

    function resolveNativeBuildInfo(context = {}, bootstrapDescriptor = null) {
      const nativeInfoBuild = normalizeNativeBuildInfo(context?.nativeSyncRootInfo?.buildInfo);
      if (nativeInfoBuild) return nativeInfoBuild;
      const cacheBuild = normalizeNativeBuildInfo(context?.nativeSyncRootCache?.buildInfo);
      if (cacheBuild) return cacheBuild;
      return normalizeNativeBuildInfo(bootstrapDescriptor?.nativeBuildInfo);
    }

    function buildShellDescriptor(options = {}) {
      const settingsState = options.settingsState && typeof options.settingsState === 'object'
        ? options.settingsState
        : getSettingsState();
      const startupDescriptor = options.startupDescriptor && typeof options.startupDescriptor === 'object'
        ? options.startupDescriptor
        : getStartupStorageDescriptor();
      const webSyncRootMeta = options.webSyncRootMeta && typeof options.webSyncRootMeta === 'object'
        ? options.webSyncRootMeta
        : getWebSyncRootMeta();
      const nativeSyncRootCache = options.nativeSyncRootCache && typeof options.nativeSyncRootCache === 'object'
        ? options.nativeSyncRootCache
        : getNativeSyncRootCache();
      const syncMutationState = options.syncMutationState && typeof options.syncMutationState === 'object'
        ? options.syncMutationState
        : getSyncMutationState();
      const lastSyncReceipt = options.lastSyncReceipt && typeof options.lastSyncReceipt === 'object'
        ? options.lastSyncReceipt
        : readLastSyncReceipt();
      const currentDataSyncMeta = options.currentDataSyncMeta && typeof options.currentDataSyncMeta === 'object'
        ? options.currentDataSyncMeta
        : getCurrentDataSyncMeta();
      const protocol = trimText(options.locationProtocol || getLocationProtocol());
      const isHttpRuntime = options.isHttpRuntime === true || protocol === 'http:' || protocol === 'https:';
      const isFileRuntime = options.isFileRuntime === true || protocol === 'file:';
      const hasNativeControlBridge = options.hasNativeControlBridge === true
        || (options.hasNativeControlBridge == null && api.hasNativeControlBridge && typeof api.hasNativeControlBridge === 'function' && api.hasNativeControlBridge() === true);
      const hasNativeSyncBridge = options.hasNativeSyncBridge === true
        || (options.hasNativeSyncBridge == null && api.hasNativeSyncBridge && typeof api.hasNativeSyncBridge === 'function' && api.hasNativeSyncBridge() === true);
      const hasNativeSpeechBridge = options.hasNativeSpeechBridge === true
        || (options.hasNativeSpeechBridge == null && api.hasNativeSpeechBridge && typeof api.hasNativeSpeechBridge === 'function' && api.hasNativeSpeechBridge() === true);
      const isRunningInNativeIOSShell = options.isRunningInNativeIOSShell === true
        || (options.isRunningInNativeIOSShell == null && api.isRunningInNativeIOSShell && typeof api.isRunningInNativeIOSShell === 'function' && api.isRunningInNativeIOSShell() === true);
      const isRunningInNativeDesktopShell = options.isRunningInNativeDesktopShell === true
        || (options.isRunningInNativeDesktopShell == null && api.isRunningInNativeDesktopShell && typeof api.isRunningInNativeDesktopShell === 'function' && api.isRunningInNativeDesktopShell() === true);
      const notificationsCapable = options.notificationsCapable === true
        || (options.notificationsCapable == null
          && ((api.notificationsSupported && typeof api.notificationsSupported === 'function' && api.notificationsSupported() === true)
            || (typeof window !== 'undefined' && typeof window.Notification !== 'undefined')));
      const pushTokenCapable = options.pushTokenCapable === true
        || (options.pushTokenCapable == null
          && api.pushTokenAvailable && typeof api.pushTokenAvailable === 'function' && api.pushTokenAvailable() === true);
      const nativeSyncRootInfo = options.nativeSyncRootInfo && typeof options.nativeSyncRootInfo === 'object'
        ? options.nativeSyncRootInfo
        : null;
      const bootstrapDescriptor = readBootstrapShellDescriptor();
      const platform = resolvePlatform({
        settingsState,
        nativeSyncRootInfo,
        nativeSyncRootCache,
        isRunningInNativeDesktopShell,
        isRunningInNativeIOSShell,
        isFileRuntime,
      });
      const syncMode = resolveSyncMode({
        platform,
        hasNativeControlBridge,
        isRunningInNativeDesktopShell,
        isRunningInNativeIOSShell,
        webSyncRootMeta,
        isHttpRuntime,
      });
      const context = {
        settingsState,
        startupDescriptor,
        webSyncRootMeta,
        nativeSyncRootCache,
        syncMutationState,
        lastSyncReceipt,
        currentDataSyncMeta,
        hasNativeControlBridge,
        hasNativeSyncBridge,
        hasNativeSpeechBridge,
        isRunningInNativeDesktopShell,
        isRunningInNativeIOSShell,
        isHttpRuntime,
        isFileRuntime,
        notificationsCapable,
        pushTokenCapable,
        nativeSyncRootInfo,
        lastSyncAt: getLastSyncAt(),
        platform,
        syncMode,
      };
      const nativeBuildInfo = resolveNativeBuildInfo(context, bootstrapDescriptor);
      return {
        ...(bootstrapDescriptor && typeof bootstrapDescriptor === 'object' ? bootstrapDescriptor : {}),
        descriptorVersion: SHELL_DESCRIPTOR_VERSION,
        platform,
        shellKind: resolveShellKind(context),
        syncMode,
        bootstrapSource: trimText(startupDescriptor?.bootstrapSource) || 'local-cache-fallback',
        startupSourceInspection: resolveStartupSourceInspection(context),
        canonicalStore: resolveCanonicalStore(context),
        syncRoot: resolveSyncRoot(context),
        capabilities: resolveCapabilities(context),
        durableWriteOwner: resolveDurableWriteOwner(syncMode),
        receiptFeed: resolveReceiptFeed(context),
        bridgeStatus: resolveBridgeStatus(context),
        nativeBuildInfo,
      };
    }

    function refreshShellDescriptor(options = {}) {
      const descriptor = buildShellDescriptor(options);
      try {
        window.__MorphShellDescriptor = descriptor;
        window.__LianXingShellDescriptor = descriptor;
      } catch (_) {}
      return descriptor;
    }

    function getCachedShellDescriptor() {
      return window.__MorphShellDescriptor
        || window.__LianXingShellDescriptor
        || readBootstrapShellDescriptor()
        || null;
    }

    function applyShellDescriptorToSettingsState(settingsState, descriptor, options = {}) {
      const target = settingsState && typeof settingsState === 'object'
        ? settingsState
        : getSettingsState();
      if (!target || typeof target !== 'object') return descriptor;
      const syncRoot = descriptor && descriptor.syncRoot && typeof descriptor.syncRoot === 'object'
        ? descriptor.syncRoot
        : { pathHint: '', deleteSafe: null };
      const nativeBridge = descriptor?.shellKind === 'native-webview' || descriptor?.bridgeStatus?.control === 'available';
      target.nativeBridge = !!nativeBridge;
      target.syncRootPath = trimText(syncRoot.pathHint);
      target.syncRootDeleteSafe = typeof syncRoot.deleteSafe === 'boolean' ? syncRoot.deleteSafe : null;
      if (descriptor?.platform === 'web') {
        target.nativePlatform = syncRoot.kind === 'browser-directory' ? 'browser' : '';
      } else {
        target.nativePlatform = trimText(descriptor?.platform);
      }
      if (options.nativeSyncRootError) {
        target.statusMessage = '读取数据目录失败';
      } else if (target.nativeBridge && !target.syncRootPath && options.isRunningInNativeShell) {
        target.statusMessage = '桌面桥接已连接，正在等待数据目录能力就绪';
      } else if (descriptor?.platform === 'ios' && syncRoot.deleteSafe === false) {
        target.statusMessage = '当前为 App 本地目录：卸载 App 会删除数据。请先选择 OneDrive（或其他外部）Morpheus 文件夹。';
      } else {
        target.statusMessage = '';
      }
      return descriptor;
    }

    function getSyncModeLabel(syncMode = '') {
      if (syncMode === 'ios-native-bridge') return 'iOS 原生桥接同步';
      if (syncMode === 'macos-native-bridge') return 'mac 原生桥接同步';
      if (syncMode === 'web-browser-directory') return '浏览器目录直连同步';
      if (syncMode === 'web-local-server') return 'Web + 本地服务同步';
      return '浏览器本地缓存模式';
    }

    function getSyncRouteText(descriptor = null) {
      const syncMode = trimText(descriptor?.syncMode);
      if (syncMode === 'ios-native-bridge') {
        return '启动与主写入都以原生目录桥接为主，web 只负责界面与运行时。';
      }
      if (syncMode === 'macos-native-bridge') {
        return '启动与主写入都以桌面桥接目录为主，本地服务负责补充同步与状态。';
      }
      if (syncMode === 'web-browser-directory') {
        return '当前由用户选择目录作为主读写入口；本地服务只负责辅助联动与状态回执。';
      }
      if (syncMode === 'web-local-server') {
        return '当前没有用户目录桥接；启动与主写入依赖本地服务 live-data.json，浏览器本地缓存只作临时快照。';
      }
      return '当前没有目录桥接也没有本地服务；只能使用浏览器本地缓存，退出或换设备后不保证同步。';
    }

    function buildSettingsSyncSummary(options = {}) {
      const settingsState = options.settingsState && typeof options.settingsState === 'object'
        ? options.settingsState
        : getSettingsState();
      const descriptor = buildShellDescriptor({
        settingsState,
        ...options,
      });
      const syncRoot = descriptor.syncRoot && typeof descriptor.syncRoot === 'object'
        ? descriptor.syncRoot
        : { kind: 'none', pathHint: '' };
      const bridgeStatus = descriptor.bridgeStatus && typeof descriptor.bridgeStatus === 'object'
        ? descriptor.bridgeStatus
        : { control: 'unavailable' };
      const durableWriteOwner = trimText(descriptor.durableWriteOwner);
      let bridgeBadgeLabel = '未连接（web 浏览器）';
      if (bridgeStatus.control === 'available' && descriptor.platform === 'ios') {
        bridgeBadgeLabel = '已连接（iOS App）';
      } else if (bridgeStatus.control === 'available' && descriptor.platform === 'macos') {
        bridgeBadgeLabel = '已连接（mac 桌面版）';
      } else if (durableWriteOwner === 'browser-directory') {
        bridgeBadgeLabel = '浏览器目录为主写入';
      } else if (durableWriteOwner === 'local-server') {
        bridgeBadgeLabel = '本地服务为主写入';
      } else if (descriptor.shellKind === 'native-webview') {
        bridgeBadgeLabel = '桌面版（桥接检测中）';
      } else if (syncRoot.kind === 'browser-directory' && syncRoot.pathHint) {
        bridgeBadgeLabel = '本地目录已选中（待桥接）';
      }
      let syncRootText = trimText(syncRoot.pathHint);
      if (durableWriteOwner === 'native-sync-writer' || durableWriteOwner === 'browser-directory') {
        syncRootText = syncRootText || '正在读取...';
      } else if (!syncRootText || durableWriteOwner === 'local-server' || durableWriteOwner === 'browser-local-cache') {
        if (descriptor.shellKind === 'native-webview' && descriptor.platform === 'ios') {
          syncRootText = '正在读取...';
        } else if (descriptor.shellKind === 'native-webview' && descriptor.platform === 'macos') {
          syncRootText = '正在读取桌面数据目录';
        } else if (durableWriteOwner === 'local-server') {
          syncRootText = '当前读写依赖本地服务 live-data.json';
        } else {
          syncRootText = '当前仅使用浏览器本地缓存（未接管用户目录）';
        }
      }
      return {
        descriptor,
        bridgeBadgeLabel,
        bridgeBadgeConnected: descriptor.shellKind === 'native-webview' || bridgeStatus.control === 'available',
        syncRootText,
        syncModeText: getSyncModeLabel(descriptor.syncMode),
        syncRouteText: getSyncRouteText(descriptor),
        reasonSurface: descriptor.receiptFeed?.reasonSurface || null,
      };
    }

    async function refreshSettingsNativeState(options = {}) {
      const settingsState = options.settingsState && typeof options.settingsState === 'object'
        ? options.settingsState
        : getSettingsState();
      const hasNativeControlBridge = api.hasNativeControlBridge && typeof api.hasNativeControlBridge === 'function'
        ? api.hasNativeControlBridge() === true
        : false;
      const isRunningInNativeDesktopShell = api.isRunningInNativeDesktopShell && typeof api.isRunningInNativeDesktopShell === 'function'
        ? api.isRunningInNativeDesktopShell() === true
        : false;
      const isRunningInNativeIOSShell = api.isRunningInNativeIOSShell && typeof api.isRunningInNativeIOSShell === 'function'
        ? api.isRunningInNativeIOSShell() === true
        : false;
      let nativeSyncRootInfo = null;
      let nativeSyncRootError = null;
      if (hasNativeControlBridge && api.callNativeDesktopControl && typeof api.callNativeDesktopControl === 'function') {
        try {
          nativeSyncRootInfo = await api.callNativeDesktopControl('getSyncRoot');
          if (nativeSyncRootInfo && typeof nativeSyncRootInfo === 'object'
            && api.writeMorphNativeSyncRootCache && typeof api.writeMorphNativeSyncRootCache === 'function') {
            const cachedState = {
              path: trimText(nativeSyncRootInfo.path),
              deleteSafe: typeof nativeSyncRootInfo.deleteSafe === 'boolean' ? nativeSyncRootInfo.deleteSafe : null,
              platform: trimText(nativeSyncRootInfo.platform),
            };
            const nativeBuildInfo = normalizeNativeBuildInfo(nativeSyncRootInfo.buildInfo);
            if (nativeBuildInfo) cachedState.buildInfo = nativeBuildInfo;
            api.writeMorphNativeSyncRootCache(cachedState);
          }
        } catch (error) {
          nativeSyncRootError = error;
        }
      }
      const descriptor = refreshShellDescriptor({
        settingsState,
        nativeSyncRootInfo,
        hasNativeControlBridge,
        isRunningInNativeDesktopShell,
        isRunningInNativeIOSShell,
      });
      applyShellDescriptorToSettingsState(settingsState, descriptor, {
        isRunningInNativeShell: isRunningInNativeDesktopShell || isRunningInNativeIOSShell,
        nativeSyncRootError,
      });
      if (settingsState.nativeBridge && settingsState.syncRootPath
        && api.syncAllPluginFacingDataExports && typeof api.syncAllPluginFacingDataExports === 'function') {
        api.syncAllPluginFacingDataExports();
      }
      return descriptor;
    }

    return {
      buildShellDescriptor,
      buildSettingsSyncSummary,
      applyShellDescriptorToSettingsState,
      refreshShellDescriptor,
      getCachedShellDescriptor,
      getSyncModeLabel,
      getSyncRouteText,
      refreshSettingsNativeState,
    };
  }

  window.MorphShellDescriptorRuntime = {
    create: createShellDescriptorRuntime,
  };
})();
