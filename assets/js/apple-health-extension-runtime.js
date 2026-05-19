(function initMorphAppleHealthExtensionRuntime() {
  function createAppleHealthExtensionRuntime(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const syncState = {
      inFlight: false,
      timer: null,
      statusMessage: '',
      statusError: false,
      autoHandlersBound: false,
      lastAttemptAt: 0,
      lastSuccessAt: 0,
      diagnostics: null,
      diagnosticsInFlight: false,
      diagnosticsLoadedAt: 0,
    };
    const DEFAULT_ACTIVITY_WINDOW_HOURS = 24;
    const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;
    const AUTO_SYNC_STALE_MS = 15 * 60 * 1000;
    const AUTO_SYNC_MIN_GAP_MS = 45 * 1000;

    function canUseFeature() {
      return typeof api.isExtensionEnabled === 'function' && api.isExtensionEnabled('apple-health');
    }

    function readCurrentBundle() {
      const data = typeof api.getData === 'function' ? api.getData() : null;
      return data?.appleHealthSync && typeof data.appleHealthSync === 'object' ? data.appleHealthSync : null;
    }

    function isIOSRuntime() {
      return typeof api.isIOSNativeAppRuntime === 'function' ? api.isIOSNativeAppRuntime() : false;
    }

    function readBundleUpdatedAtMs(bundle = null) {
      const updatedAt = String(bundle?.updatedAt || '').trim();
      if (!updatedAt) return 0;
      const ts = Date.parse(updatedAt);
      return Number.isFinite(ts) ? ts : 0;
    }

    function hasPersistedAppleHealthHistory(bundle = null) {
      const history = bundle?.history && typeof bundle.history === 'object' ? bundle.history : null;
      if (!history) return false;
      return [
        history.activityDaily,
        history.sleepDaily,
        history.restingHeartRateDaily,
        history.heartRateSamples,
        history.bodyMassSamples,
        history.bloodGlucoseSamples,
      ].some((list) => Array.isArray(list) && list.length > 0);
    }

    function persistAppleHealthSync(payload) {
      if (!canUseFeature()) return;
      const data = typeof api.getData === 'function' ? api.getData() : null;
      if (!data || typeof data !== 'object') return;
      const snap = payload && typeof payload.snapshot === 'object' ? payload.snapshot : null;
      if (!snap) return;
      const history = payload && typeof payload.history === 'object' ? payload.history : null;
      const fetchedAt = String(payload.fetchedAt || snap.fetchedAt || new Date().toISOString());
      const prev = data.appleHealthSync && typeof data.appleHealthSync === 'object' ? data.appleHealthSync : {};
      data.appleHealthSync = {
        ...prev,
        snapshot: snap,
        history: history || (prev.history && typeof prev.history === 'object' ? prev.history : {}),
        updatedAt: fetchedAt,
        source: 'ios-healthkit',
      };
      syncState.lastSuccessAt = Date.now();
      // 同步用户可见文件后，优先走主应用的即时持久化链路，把 appleHealthSync 推进权威 live data。
      if (typeof api.syncAppleHealthExtensionFiles === 'function') {
        Promise.resolve(api.syncAppleHealthExtensionFiles(data.appleHealthSync, { appendHistory: true })).catch((error) => {
          if (typeof console !== 'undefined' && console.warn) console.warn('[apple-health] failed to sync local files', error);
        });
      }
      syncModalUI();
      rerender();
      if (typeof api.saveSilent === 'function') {
        api.saveSilent({
          skipUndo: true,
          skipRender: true,
          immediatePersist: true,
          domains: ['appleHealthSync'],
        });
        return;
      }
      if (typeof api.stampLocalDataRevision === 'function') {
        api.stampLocalDataRevision();
      }
      if (api.storage && typeof api.storage.saveData === 'function') {
        api.storage.saveData(api.getData(), {});
      }
    }

    async function hydrateAppleHealthFromNativeOnce({ force = false } = {}) {
      if (!canUseFeature()) return false;
      if (!(typeof api.isIOSNativeAppRuntime === 'function' ? api.isIOSNativeAppRuntime() : false)) return false;
      if (!api.storage || typeof api.storage.callNativeDesktopControl !== 'function') return false;
      if (syncState.inFlight) return false;
      syncState.inFlight = true;
      try {
        const prev = typeof api.getData === 'function' ? api.getData()?.appleHealthSync : null;
        if (!force && prev?.updatedAt && prev?.snapshot) return true;
        const native = await api.storage.callNativeDesktopControl('fetchAppleHealthSnapshot', {
          hours: DEFAULT_ACTIVITY_WINDOW_HOURS,
        });
        if (!native?.snapshot || typeof native.snapshot !== 'object') return false;
        persistAppleHealthSync({
          snapshot: native.snapshot,
          history: native?.history && typeof native.history === 'object' ? native.history : null,
          fetchedAt: native.fetchedAt,
        });
        return true;
      } catch (_) {
        return false;
      } finally {
        syncState.inFlight = false;
      }
    }

    function clearAppleHealthSyncTimer() {
      if (syncState.timer) {
        clearInterval(syncState.timer);
        syncState.timer = null;
      }
    }

    function shouldSkipAutoSync({ force = false } = {}) {
      if (force) return false;
      const now = Date.now();
      if (syncState.lastAttemptAt && now - syncState.lastAttemptAt < AUTO_SYNC_MIN_GAP_MS) return true;
      const bundle = readCurrentBundle();
      if (!hasPersistedAppleHealthHistory(bundle)) return false;
      const updatedAtMs = readBundleUpdatedAtMs(bundle);
      if (!updatedAtMs) return false;
      return now - updatedAtMs < AUTO_SYNC_STALE_MS;
    }

    async function triggerAppleHealthAutoSync({ force = false, reason = '' } = {}) {
      if (!canUseFeature()) return false;
      if (!(typeof api.isIOSNativeAppRuntime === 'function' ? api.isIOSNativeAppRuntime() : false)) return false;
      if (shouldSkipAutoSync({ force })) return false;
      syncState.lastAttemptAt = Date.now();
      const ok = await hydrateAppleHealthFromNativeOnce({ force: true });
      if (!ok && force && typeof console !== 'undefined' && console.warn) {
        console.warn('[apple-health] auto sync did not return snapshot', reason || 'manual');
      }
      return ok;
    }

    function installAppleHealthAutoSyncHandlers() {
      if (syncState.autoHandlersBound || typeof window === 'undefined') return;
      syncState.autoHandlersBound = true;
      const onVisible = () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        triggerAppleHealthAutoSync({ force: false, reason: 'visibility' }).catch(() => {});
      };
      if (typeof document !== 'undefined' && document?.addEventListener) {
        document.addEventListener('visibilitychange', onVisible);
      }
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('focus', onVisible);
        window.addEventListener('pageshow', onVisible);
      }
    }

    function restartAppleHealthSyncScheduler() {
      clearAppleHealthSyncTimer();
      if (!canUseFeature()) return false;
      if (!(typeof api.isIOSNativeAppRuntime === 'function' ? api.isIOSNativeAppRuntime() : false)) return false;
      installGlobalHandlers();
      installAppleHealthAutoSyncHandlers();
      triggerAppleHealthAutoSync({ force: true, reason: 'startup' }).catch(() => {});
      syncState.timer = setInterval(() => {
        triggerAppleHealthAutoSync({ force: false, reason: 'interval' }).catch(() => {});
      }, AUTO_SYNC_INTERVAL_MS);
      return true;
    }

    function notifyAppleHealthUser(title, desc) {
      const t = String(title || '').trim() || '提示';
      const d = String(desc || '').trim();
      if (typeof api.openCustomModal === 'function') {
        api.openCustomModal({ title: t, desc: d });
      } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(d ? `${t}\n\n${d}` : t);
      }
    }

    async function requestAppleHealthAuthorization() {
      if (!(typeof api.isIOSNativeAppRuntime === 'function' ? api.isIOSNativeAppRuntime() : false)) {
        throw new Error('仅在 Morpheus iOS 应用内可请求健康权限');
      }
      if (!api.storage || typeof api.storage.callNativeDesktopControl !== 'function') {
        throw new Error('原生桥接不可用');
      }
      await api.storage.callNativeDesktopControl('requestAppleHealthAuthorization', {});
    }

    async function refreshAppleHealthSnapshot() {
      const ok = await triggerAppleHealthAutoSync({ force: true, reason: 'manual' });
      if (!ok) throw new Error('暂时没有取到 Apple 健康摘要');
      setAppleHealthStatusMessage('已同步最新 Apple 健康摘要', false);
      syncModalUI();
      rerender();
      if (typeof api.requestLucideRefresh === 'function') {
        api.requestLucideRefresh();
      }
    }

    function formatNumber(value, digits = 0) {
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      if (digits <= 0) return String(Math.round(n));
      return n.toFixed(digits);
    }

    function formatDateTimeLabel(value, { includeDate = true } = {}) {
      const iso = String(value || '').trim();
      if (!iso) return '—';
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) return iso;
      try {
        return parsed.toLocaleString('zh-CN', {
          month: includeDate ? '2-digit' : undefined,
          day: includeDate ? '2-digit' : undefined,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      } catch (_) {
        return includeDate ? iso.slice(5, 16).replace('T', ' ') : iso.slice(11, 16);
      }
    }

    function readOptionalNumber(value) {
      if (value == null) return null;
      if (typeof value === 'string' && !value.trim()) return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }

    function esc(text) {
      const raw = String(text ?? '');
      return api.escapeHTML ? api.escapeHTML(raw) : raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function rerender() {
      const tab = typeof api.getCurrentTab === 'function' ? api.getCurrentTab() : '';
      if (tab === 'settings' && typeof api.renderSettingsView === 'function') api.renderSettingsView();
      else if (tab === 'extensions' && typeof api.renderExtensionsView === 'function') api.renderExtensionsView();
      else if (tab === 'health' && typeof api.renderHealthAppleHealthPane === 'function') api.renderHealthAppleHealthPane();
      else if (
        tab === 'localPluginWorkspace'
        && typeof api.getActiveLocalPluginWorkspaceId === 'function'
        && api.getActiveLocalPluginWorkspaceId() === 'apple-health'
        && typeof api.renderLocalPluginWorkspaceView === 'function'
      ) api.renderLocalPluginWorkspaceView();
    }

    function setAppleHealthStatusMessage(message = '', isError = false) {
      syncState.statusMessage = String(message || '').trim();
      syncState.statusError = isError === true;
      const status = typeof document !== 'undefined' ? document.getElementById('settings-apple-health-status') : null;
      if (status) {
        status.textContent = syncState.statusMessage;
        status.className = `mt-3 text-[10px] font-mono ${syncState.statusError ? 'text-red-500 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}`;
      }
    }

    function normalizeAppleHealthDiagnostics(raw = null) {
      const source = raw && typeof raw === 'object' ? raw : {};
      const authorization = source.authorization && typeof source.authorization === 'object' ? source.authorization : {};
      const runtime = source.runtime && typeof source.runtime === 'object' ? source.runtime : {};
      const syncRoot = source.syncRoot && typeof source.syncRoot === 'object' ? source.syncRoot : {};
      const canonicalStore = source.canonicalStore && typeof source.canonicalStore === 'object' ? source.canonicalStore : {};
      const buildInfo = source.buildInfo && typeof source.buildInfo === 'object' ? source.buildInfo : {};
      const byTypeRaw = authorization.byType && typeof authorization.byType === 'object' ? authorization.byType : {};
      const byType = Object.fromEntries(
        Object.entries(byTypeRaw).map(([key, value]) => [String(key || '').trim(), String(value || '').trim()]),
      );
      return {
        checkedAt: new Date().toISOString(),
        support: {
          isHealthDataAvailable: source.isHealthDataAvailable === true,
        },
        authorization: {
          byType,
          authorizedCount: Number.isFinite(Number(authorization.authorizedCount)) ? Number(authorization.authorizedCount) : 0,
          deniedCount: Number.isFinite(Number(authorization.deniedCount)) ? Number(authorization.deniedCount) : 0,
          notDeterminedCount: Number.isFinite(Number(authorization.notDeterminedCount)) ? Number(authorization.notDeterminedCount) : 0,
          hasAnyAuthorized: authorization.hasAnyAuthorized === true,
          allAuthorized: authorization.allAuthorized === true,
        },
        runtime: {
          lastAuthorizationRequestedAt: String(runtime.lastAuthorizationRequestedAt || '').trim(),
          lastAuthorizationCompletedAt: String(runtime.lastAuthorizationCompletedAt || '').trim(),
          lastAuthorizationError: String(runtime.lastAuthorizationError || '').trim(),
          lastFetchAttemptAt: String(runtime.lastFetchAttemptAt || '').trim(),
          lastFetchSucceededAt: String(runtime.lastFetchSucceededAt || '').trim(),
          lastFetchError: String(runtime.lastFetchError || '').trim(),
          lastFetchHours: Number.isFinite(Number(runtime.lastFetchHours)) ? Number(runtime.lastFetchHours) : 0,
        },
        syncRoot: {
          path: String(syncRoot.path || '').trim(),
          storageMode: String(syncRoot.storageMode || '').trim(),
          deleteSafe: syncRoot.deleteSafe === true,
        },
        canonicalStore: {
          hasLiveDataFile: canonicalStore.hasLiveDataFile === true,
          hasAppleHealthSync: canonicalStore.hasAppleHealthSync === true,
          updatedAt: String(canonicalStore.updatedAt || '').trim(),
          hasSnapshot: canonicalStore.hasSnapshot === true,
          hasHistory: canonicalStore.hasHistory === true,
          historyKeys: Array.isArray(canonicalStore.historyKeys) ? canonicalStore.historyKeys.map((item) => String(item || '').trim()).filter(Boolean) : [],
          liveDataModifiedAt: String(canonicalStore.liveDataModifiedAt || '').trim(),
          revision: Number.isFinite(Number(canonicalStore.revision)) ? Number(canonicalStore.revision) : 0,
          pluginStateFileExists: canonicalStore.pluginStateFileExists === true,
          userMirrorExists: canonicalStore.userMirrorExists === true,
        },
        buildInfo: {
          version: String(buildInfo.version || buildInfo.appVersion || '').trim(),
          build: String(buildInfo.build || '').trim(),
        },
      };
    }

    async function fetchAppleHealthDiagnostics({ force = false, silent = false } = {}) {
      if (!isIOSRuntime()) return null;
      if (!api.storage || typeof api.storage.callNativeDesktopControl !== 'function') {
        throw new Error('原生桥接不可用');
      }
      if (
        !force
        && syncState.diagnostics
        && syncState.diagnosticsLoadedAt
        && Date.now() - syncState.diagnosticsLoadedAt < 15 * 1000
      ) {
        return syncState.diagnostics;
      }
      if (syncState.diagnosticsInFlight) return syncState.diagnostics;
      syncState.diagnosticsInFlight = true;
      try {
        const raw = await api.storage.callNativeDesktopControl('getAppleHealthDiagnostics', {});
        const diagnostics = normalizeAppleHealthDiagnostics(raw);
        syncState.diagnostics = diagnostics;
        syncState.diagnosticsLoadedAt = Date.now();
        if (!silent) {
          syncModalUI();
          rerender();
        }
        return diagnostics;
      } catch (error) {
        if (!silent) {
          setAppleHealthStatusMessage(String(error?.message || error || '读取诊断失败'), true);
          syncModalUI();
          rerender();
        }
        throw error;
      } finally {
        syncState.diagnosticsInFlight = false;
      }
    }

    function authStatusText(value = '') {
      const normalized = String(value || '').trim();
      if (normalized === 'sharingAuthorized') return '已授权';
      if (normalized === 'sharingDenied') return '已拒绝';
      if (normalized === 'notDetermined') return '未决定';
      if (normalized === 'unavailable') return '不可用';
      if (!normalized) return '—';
      return normalized;
    }

    function buildAppleHealthStatusSummary(bundle, { isIOS = false } = {}) {
      const enabled = canUseFeature();
      const snap = bundle?.snapshot && typeof bundle.snapshot === 'object' ? bundle.snapshot : null;
      const updatedAt = String(bundle?.updatedAt || '').trim();
      if (!enabled) return 'Apple 健康扩展当前未启用。启用后才会在 Morpheus 中保留同步摘要。';
      if (!snap) {
        return isIOS
          ? '已启用 Apple 健康扩展，但还没有同步到摘要。先请求权限，再执行一次同步即可。'
          : '已启用 Apple 健康扩展，但本机不能直接读取 HealthKit。请在 iPhone 上的 Morpheus 里完成授权与同步。';
      }
      const steps = readOptionalNumber(snap.steps);
      const asleepHours = readOptionalNumber(snap?.sleep?.asleepHours);
      const bodyMassKg = readOptionalNumber(snap.bodyMassKg);
      const parts = [];
      if (updatedAt) parts.push(`最近同步 ${updatedAt}`);
      if (steps != null) parts.push(`步数 ${formatNumber(steps, 0)}`);
      if (asleepHours != null) parts.push(`睡眠 ${formatNumber(asleepHours, 1)} h`);
      if (bodyMassKg != null) parts.push(`体重 ${formatNumber(bodyMassKg, 1)} kg`);
      return parts.length
        ? `Apple 健康摘要已同步。${parts.join('，')}。`
        : 'Apple 健康摘要已同步，后续同步会继续覆盖根数据中的最新摘要。';
    }

    function parseHrPoint(sample) {
      const iso = String(sample?.at || '').trim();
      const t = Date.parse(iso);
      const bpm = Number(sample?.bpm);
      if (!Number.isFinite(t) || !Number.isFinite(bpm)) return null;
      return { t, bpm };
    }

    function chartGradientUid() {
      return `ah_${Math.random().toString(36).slice(2, 10)}`;
    }

    /** Catmull-Rom → cubic Bézier，贴近「健康」中心率曲线观感 */
    function buildSmoothHrPathD(sortedPoints, xAt, yAt) {
      const pts = sortedPoints.map((p) => ({ x: xAt(p.t), y: yAt(p.bpm) }));
      if (pts.length < 1) return '';
      if (pts.length === 1) {
        const { x, y } = pts[0];
        return `M ${x.toFixed(2)} ${y.toFixed(2)} L ${(x + 0.8).toFixed(2)} ${y.toFixed(2)}`;
      }
      if (pts.length === 2) {
        return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} L ${pts[1].x.toFixed(2)} ${pts[1].y.toFixed(2)}`;
      }
      let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
      }
      return d;
    }

    /**
     * 心率图：平滑曲线 + 渐变面积 + 静息区间带，风格参考 iOS「健康」中心率摘要。
     */
    function buildAppleHealthHrChartSvg(sortedPoints, axisStart, axisEnd, restingBpm) {
      if (!sortedPoints.length) {
        return '<div class="h-40 w-full flex items-center justify-center text-[11px] font-mono text-gray-500 dark:text-white/45">本窗口内心率样本较少，同步后可显示曲线</div>';
      }
      const gid = chartGradientUid();
      const width = 1100;
      const padLeft = 10;
      const padRight = 8;
      const padTop = 14;
      const padBottom = 26;
      const chartW = width - padLeft - padRight;
      const chartH = 228;
      const height = padTop + chartH + padBottom;
      const baselineY = padTop + chartH;
      const xSpan = Math.max(axisEnd - axisStart, 60 * 60 * 1000);
      const xAt = (ts) => padLeft + ((ts - axisStart) / xSpan) * chartW;
      const bpms = sortedPoints.map((p) => p.bpm);
      let yMin = Math.floor(Math.min(...bpms) / 5) * 5 - 5;
      let yMax = Math.ceil(Math.max(...bpms) / 5) * 5 + 5;
      yMin = Math.max(35, yMin);
      yMax = Math.min(220, Math.max(yMin + 20, yMax));
      const ySpan = Math.max(1, yMax - yMin);
      const yAt = (bpm) => padTop + (1 - (bpm - yMin) / ySpan) * chartH;

      let bandTop = null;
      let bandHeight = 0;
      if (Number.isFinite(restingBpm) && restingBpm > 0) {
        const low = Math.max(yMin, restingBpm - 12);
        const high = Math.min(yMax, restingBpm + 35);
        if (high > low) {
          bandTop = yAt(high);
          bandHeight = Math.max(1, yAt(low) - yAt(high));
        }
      }

      const lineD = buildSmoothHrPathD(sortedPoints, xAt, yAt);
      const firstX = xAt(sortedPoints[0].t);
      const last = sortedPoints[sortedPoints.length - 1];
      const lastX = xAt(last.t);
      const areaD = `${lineD} L ${lastX.toFixed(2)} ${baselineY.toFixed(2)} L ${firstX.toFixed(2)} ${baselineY.toFixed(2)} Z`;
      const latestX = lastX.toFixed(2);
      const latestY = yAt(last.bpm).toFixed(2);

      const yTicks = [yMin, Math.round(yMin + ySpan * 0.33), Math.round(yMin + ySpan * 0.66), yMax];
      const yGrid = yTicks
        .map((value) => {
          const y = yAt(value).toFixed(2);
          return `<line x1="${padLeft}" y1="${y}" x2="${(width - padRight).toFixed(2)}" y2="${y}" class="apple-health-hr-grid-line"></line>
            <text x="${(padLeft + 2).toFixed(2)}" y="${(yAt(value) - 7).toFixed(2)}" text-anchor="start" class="apple-health-hr-axis-tick">${value}</text>`;
        })
        .join('');

      const tickCount = 5;
      const xTicks = Array.from({ length: tickCount + 1 }, (_, index) => {
        const ratio = index / tickCount;
        const ts = axisStart + Math.round(xSpan * ratio);
        const x = padLeft + chartW * ratio;
        const label = new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `<line x1="${x.toFixed(2)}" y1="${(height - padBottom).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(height - padBottom + 4).toFixed(2)}" class="apple-health-hr-grid-line apple-health-hr-grid-line--x"></line>
          <text x="${x.toFixed(2)}" y="${(height - padBottom + 14).toFixed(2)}" text-anchor="middle" class="apple-health-hr-axis-tick apple-health-hr-axis-tick--x">${esc(label)}</text>`;
      }).join('');

      const bandRect =
        bandTop != null
          ? `<rect x="${padLeft}" y="${bandTop.toFixed(2)}" width="${chartW}" height="${bandHeight.toFixed(2)}" rx="6" class="apple-health-resting-band"></rect>`
          : '';

      const defs = `<defs>
        <linearGradient id="${gid}_area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" class="apple-health-hr-grad-stop-a0" />
          <stop offset="55%" class="apple-health-hr-grad-stop-a1" />
          <stop offset="100%" class="apple-health-hr-grad-stop-a2" />
        </linearGradient>
        <linearGradient id="${gid}_line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" class="apple-health-hr-grad-stop-l0" />
          <stop offset="100%" class="apple-health-hr-grad-stop-l1" />
        </linearGradient>
        <filter id="${gid}_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>`;

      return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="apple-health-hr-chart-svg w-full h-auto overflow-visible" role="img" aria-label="心率时间序列">
          ${defs}
          <rect x="${padLeft}" y="${padTop}" width="${chartW}" height="${chartH}" rx="16" class="apple-health-hr-plot-bg"></rect>
          ${bandRect}
          ${yGrid}
          ${xTicks}
          <path d="${areaD}" fill="url(#${gid}_area)" class="apple-health-hr-area-path"></path>
          <path d="${lineD}" fill="none" stroke="url(#${gid}_line)" class="apple-health-hr-line-path" filter="url(#${gid}_glow)"></path>
          <circle cx="${latestX}" cy="${latestY}" r="10" class="apple-health-hr-latest-halo"></circle>
          <circle cx="${latestX}" cy="${latestY}" r="4.5" class="apple-health-hr-latest-dot"></circle>
        </svg>`;
    }

    /** 活动三环：用能量 / 步数 / 距离（或睡眠）相对目标近似「健身记录」圆环 */
    function buildAppleHealthActivityRingsSvg(snap) {
      const steps = Number(snap?.steps);
      const kcal = Number(snap?.activeEnergyKcal);
      const dist = Number(snap?.distanceMeters);
      const sleep = snap?.sleep && typeof snap.sleep === 'object' ? snap.sleep : {};
      const asleepH = readOptionalNumber(sleep.asleepHours);
      const move = Number.isFinite(kcal) ? clamp01(kcal / 600) : 0;
      const exercise = Number.isFinite(steps) ? clamp01(steps / 10000) : 0;
      const stand = Number.isFinite(dist)
        ? clamp01(dist / 8000)
        : Number.isFinite(asleepH)
          ? clamp01(asleepH / 8)
          : 0;
      if (move <= 0 && exercise <= 0 && stand <= 0) return '';

      const gid = chartGradientUid();
      const size = 132;
      const cx = size / 2;
      const cy = size / 2;
      const rings = [
        { r: 52, pct: move, grad: `${gid}_mv` },
        { r: 40, pct: exercise, grad: `${gid}_ex` },
        { r: 28, pct: stand, grad: `${gid}_st` },
      ];

      function ringDash(radius, pct) {
        const c = 2 * Math.PI * radius;
        const dash = c * pct;
        const gap = Math.max(0.001, c - dash);
        return { dash: dash.toFixed(2), gap: gap.toFixed(2) };
      }

      const circles = rings
        .map(({ r, pct, grad }) => {
          const { dash, gap } = ringDash(r, pct);
          return `<circle class="apple-health-ring-track" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="10" transform="rotate(-90 ${cx} ${cy})" />
            <circle class="apple-health-ring-arc" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#${grad})" stroke-width="10" stroke-dasharray="${dash} ${gap}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})" />`;
        })
        .join('');

      const standLabel = Number.isFinite(dist) ? '步行跑步距离' : '睡眠（卧床）';
      const standValue = Number.isFinite(dist)
        ? `${formatNumber(dist / 1000, 1)} / 8 km`
        : Number.isFinite(asleepH)
          ? `${formatNumber(asleepH, 1)} / 8 h`
          : '—';

      return `<div class="apple-health-rings-card rounded-[1.25rem] border border-gray-200/90 dark:border-white/10 bg-gradient-to-br from-white/90 to-gray-50/80 dark:from-white/[0.06] dark:to-white/[0.02] px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <svg class="apple-health-rings-svg shrink-0 mx-auto sm:mx-0" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <defs>
            <linearGradient id="${gid}_mv" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#FF6482" /><stop offset="100%" stop-color="#FF375F" />
            </linearGradient>
            <linearGradient id="${gid}_ex" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#63E6A8" /><stop offset="100%" stop-color="#30D158" />
            </linearGradient>
            <linearGradient id="${gid}_st" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#7DD9FF" /><stop offset="100%" stop-color="#0A84FF" />
            </linearGradient>
          </defs>
          <g class="apple-health-rings-g">${circles}</g>
        </svg>
        <div class="flex-1 min-w-0 space-y-2">
          <div class="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-white/45">今日活动（相对目标）</div>
          <ul class="text-[11px] leading-relaxed text-gray-700 dark:text-white/80 space-y-1.5 list-none pl-0">
            <li class="flex items-center gap-2"><span class="apple-health-legend-swatch apple-health-legend-swatch--move"></span><span>活动能量</span><span class="ml-auto font-mono tabular-nums opacity-80">${Number.isFinite(kcal) ? `${formatNumber(kcal, 0)} / 600 kcal` : '—'}</span></li>
            <li class="flex items-center gap-2"><span class="apple-health-legend-swatch apple-health-legend-swatch--exercise"></span><span>步数</span><span class="ml-auto font-mono tabular-nums opacity-80">${Number.isFinite(steps) ? `${formatNumber(steps, 0)} / 10000` : '—'}</span></li>
            <li class="flex items-center gap-2"><span class="apple-health-legend-swatch apple-health-legend-swatch--stand"></span><span>${esc(standLabel)}</span><span class="ml-auto font-mono tabular-nums opacity-80">${esc(standValue)}</span></li>
          </ul>
        </div>
      </div>`;
    }

    function clamp01(x) {
      return Math.max(0, Math.min(1, x));
    }

    function buildAppleHealthMetricStripMarkup(snap, hrStats = null) {
      const steps = Number(snap?.steps);
      const dist = Number(snap?.distanceMeters);
      const kcal = Number(snap?.activeEnergyKcal);
      const restHr = Number(snap?.restingHeartRateBpm);
      const lastHr = hrStats?.latest || null;
      const cards = [
        {
          accent: 'steps',
          icon: 'footprints',
          label: '步数',
          value: Number.isFinite(steps) ? formatNumber(steps, 0) : '—',
          sub: '窗口内累计',
        },
        {
          accent: 'energy',
          icon: 'flame',
          label: '活动能量',
          value: Number.isFinite(kcal) ? `${formatNumber(kcal, 0)} kcal` : '—',
          sub: '主动消耗',
        },
        {
          accent: 'distance',
          icon: 'map-pin',
          label: '步行跑步',
          value: Number.isFinite(dist) ? `${formatNumber(dist / 1000, 1)} km` : '—',
          sub: '距离',
        },
        {
          accent: 'heart',
          icon: 'heart-pulse',
          label: '心率',
          value: lastHr ? `${formatNumber(lastHr.bpm, 0)} bpm` : '—',
          sub: Number.isFinite(restHr) ? `静息 ${formatNumber(restHr, 0)}` : '最近样本',
        },
      ];
      return `<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
        ${cards
          .map(
            (c) => `<div class="health-metric-card apple-health-metric-card apple-health-metric-card--${esc(c.accent)} glass-card rounded-2xl px-3 py-2 sm:px-4 sm:py-3 border border-gray-200 dark:border-white/10">
            <div class="flex items-center gap-2 text-[10px] font-mono text-gray-500 dark:text-white/45 uppercase tracking-wider">
              <i data-lucide="${esc(c.icon)}" class="w-3.5 h-3.5 shrink-0 opacity-80"></i>
              <span>${esc(c.label)}</span>
            </div>
            <div class="mt-0.5 sm:mt-1 text-lg sm:text-xl font-semibold text-black dark:text-white tracking-tight">${esc(c.value)}</div>
            <div class="text-[9px] font-mono text-gray-400 dark:text-white/35 mt-0.5">${esc(c.sub)}</div>
          </div>`,
          )
          .join('')}
      </div>`;
    }

    function buildAppleHealthHrStats(points = []) {
      if (!Array.isArray(points) || !points.length) return null;
      const sorted = points
        .slice()
        .sort((a, b) => a.t - b.t);
      const bpms = sorted.map((p) => p.bpm).filter((item) => Number.isFinite(item));
      if (!bpms.length) return null;
      const latest = sorted[sorted.length - 1];
      const min = Math.min(...bpms);
      const max = Math.max(...bpms);
      const avg = bpms.reduce((sum, item) => sum + item, 0) / bpms.length;
      return {
        latest,
        min,
        max,
        avg,
        count: sorted.length,
        firstAt: sorted[0]?.t || 0,
        lastAt: latest?.t || 0,
      };
    }

    function buildAppleHealthDetailOverviewMarkup(snap, updatedAt) {
      const cards = [
        {
          label: '同步时间',
          value: updatedAt ? formatDateTimeLabel(updatedAt) : '—',
          sub: '最后一次摘要刷新',
        },
        {
          label: '统计窗口',
          value: snap?.windowStart && snap?.windowEnd ? `${formatDateTimeLabel(snap.windowStart, { includeDate: false })} - ${formatDateTimeLabel(snap.windowEnd, { includeDate: false })}` : (readOptionalNumber(snap?.windowHours) != null ? `近 ${formatNumber(snap.windowHours, 0)} 小时` : '—'),
          sub: '当前展示的时间范围',
        },
      ];
      return `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${cards.map((item) => `<div class="rounded-[1.15rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
            <div class="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/40">${esc(item.label)}</div>
            <div class="mt-2 text-[20px] leading-none font-semibold tracking-tight text-black dark:text-white">${esc(item.value)}</div>
            <div class="mt-2 text-[11px] leading-5 text-gray-500 dark:text-white/55">${esc(item.sub)}</div>
          </div>`).join('')}
      </div>`;
    }

    function buildAppleHealthBiometricsMarkup(snap, hrStats = null) {
      const sleep = snap?.sleep && typeof snap.sleep === 'object' ? snap.sleep : {};
      const asleep = readOptionalNumber(sleep.asleepHours);
      const inBed = readOptionalNumber(sleep.inBedHours);
      const steps = readOptionalNumber(snap?.steps);
      const kcal = readOptionalNumber(snap?.activeEnergyKcal);
      const dist = readOptionalNumber(snap?.distanceMeters);
      const bodyMassKg = readOptionalNumber(snap?.bodyMassKg);
      const glucose = readOptionalNumber(snap?.bloodGlucoseMmolPerL);
      const resting = readOptionalNumber(snap?.restingHeartRateBpm);
      const rows = [
        ['步数', steps != null ? formatNumber(steps, 0) : '—'],
        ['活动能量', kcal != null ? `${formatNumber(kcal, 0)} kcal` : '—'],
        ['步行跑步距离', dist != null ? `${formatNumber(dist / 1000, 1)} km` : '—'],
        ['实际睡眠', asleep != null ? `${formatNumber(asleep, 1)} h` : '—'],
        ['卧床时间', inBed != null ? `${formatNumber(inBed, 1)} h` : '—'],
        ['静息心率', resting != null ? `${formatNumber(resting, 0)} bpm` : '—'],
        ['最近心率', hrStats?.latest ? `${formatNumber(hrStats.latest.bpm, 0)} bpm` : '—'],
        ['平均心率', hrStats ? `${formatNumber(hrStats.avg, 0)} bpm` : '—'],
        ['体重', bodyMassKg != null ? `${formatNumber(bodyMassKg, 1)} kg` : '—'],
        ['血糖', glucose != null ? `${formatNumber(glucose, 1)} mmol/L` : '—'],
      ];
      return `<div class="rounded-[1.15rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
        <div class="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/40">睡眠与生理指标</div>
        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          ${rows.map(([label, value]) => `<div class="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-white/6 pb-2">
            <span class="text-[12px] text-gray-600 dark:text-white/68">${esc(label)}</span>
            <span class="text-[12px] font-mono tabular-nums text-black dark:text-white">${esc(value)}</span>
          </div>`).join('')}
        </div>
      </div>`;
    }

    function buildAppleHealthHrSampleFeedMarkup(sortedPoints = []) {
      if (!Array.isArray(sortedPoints) || !sortedPoints.length) return '';
      const rows = sortedPoints
        .slice()
        .sort((a, b) => b.t - a.t)
        .slice(0, 18);
      return `<div class="rounded-[1.15rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <div class="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/40">最近心率样本</div>
          <div class="text-[10px] font-mono text-gray-400 dark:text-white/35">按时间倒序</div>
        </div>
        <div class="mt-3 divide-y divide-gray-100 dark:divide-white/6">
          ${rows.map((point, index) => `<div class="flex items-center justify-between gap-3 py-2">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-5 text-[10px] font-mono text-gray-400 dark:text-white/30">${index + 1}</span>
              <span class="text-[12px] text-gray-600 dark:text-white/70">${esc(formatDateTimeLabel(new Date(point.t).toISOString()))}</span>
            </div>
            <span class="text-[12px] font-mono tabular-nums text-black dark:text-white">${formatNumber(point.bpm, 0)} bpm</span>
          </div>`).join('')}
        </div>
      </div>`;
    }

    function buildAppleHealthRelativeBarsMarkup(snap) {
      const steps = Number(snap?.steps);
      const dist = Number(snap?.distanceMeters);
      const kcal = Number(snap?.activeEnergyKcal);
      const sleep = snap?.sleep && typeof snap.sleep === 'object' ? snap.sleep : {};
      const asleepH = readOptionalNumber(sleep.asleepHours);
      const rows = [
        { key: 'steps', icon: 'footprints', label: '步数', pct: Number.isFinite(steps) ? clamp01(steps / 14000) : 0, text: Number.isFinite(steps) ? formatNumber(steps, 0) : '—' },
        { key: 'energy', icon: 'flame', label: '能量', pct: Number.isFinite(kcal) ? clamp01(kcal / 600) : 0, text: Number.isFinite(kcal) ? `${formatNumber(kcal, 0)} kcal` : '—' },
        { key: 'distance', icon: 'ruler', label: '距离', pct: Number.isFinite(dist) ? clamp01(dist / 8000) : 0, text: Number.isFinite(dist) ? `${formatNumber(dist / 1000, 1)} km` : '—' },
        { key: 'sleep', icon: 'moon', label: '睡眠', pct: Number.isFinite(asleepH) ? clamp01(asleepH / 9) : 0, text: Number.isFinite(asleepH) ? `${formatNumber(asleepH, 1)} h` : '—' },
      ];
      const any = rows.some((r) => r.pct > 0 || r.text !== '—');
      if (!any) return '';
      return `<div class="rounded-[1.15rem] border border-gray-200 dark:border-white/10 bg-white/55 dark:bg-white/[0.03] px-3 py-3 sm:px-4 sm:py-4 apple-health-bars-panel">
        <div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-white/45 mb-3">活动概览</div>
        <div class="flex flex-col gap-2.5">
          ${rows
            .map(
              (r) => `<div class="flex items-center gap-2.5">
              <i data-lucide="${esc(r.icon)}" class="w-3.5 h-3.5 shrink-0 text-gray-500 dark:text-white/45"></i>
              <span class="w-12 text-[10px] font-medium text-gray-600 dark:text-white/55">${esc(r.label)}</span>
              <div class="flex-1 h-2.5 rounded-full apple-health-bar-track overflow-hidden min-w-0 shadow-inner">
                <div class="apple-health-bar-fill apple-health-bar-fill--${esc(r.key)} h-full rounded-full transition-[width] duration-500 ease-out" style="width:${Math.round(r.pct * 100)}%"></div>
              </div>
              <span class="w-20 text-right text-[11px] font-mono tabular-nums text-gray-800 dark:text-white/85 shrink-0">${esc(r.text)}</span>
            </div>`,
            )
            .join('')}
        </div>
      </div>`;
    }

    function buildAppleHealthChartMetaRow(snap, hrCount, updatedAt) {
      const wh = readOptionalNumber(snap?.windowHours);
      const windowLabel = Number.isFinite(wh) ? `${formatNumber(wh, 0)}h 窗口` : '统计窗口';
      const start = String(snap?.windowStart || '').trim();
      const end = String(snap?.windowEnd || '').trim();
      const rangeLabel = start && end ? `${start.slice(11, 16)}–${end.slice(11, 16)}` : '';
      return `<div class="health-chart-meta" role="list" aria-label="Apple 健康图表说明">
        <span class="health-chart-meta-chip" role="listitem">
          <span class="health-chart-swatch health-chart-swatch-line apple-health-swatch-hr" aria-hidden="true"></span>
          <span class="health-chart-meta-value">${esc(windowLabel)}${rangeLabel ? ` · ${esc(rangeLabel)}` : ''}</span>
        </span>
        <span class="health-chart-meta-chip" role="listitem">
          <span class="health-chart-meta-label">心率点</span>
          <span class="health-chart-meta-value">${esc(String(hrCount))}</span>
        </span>
        ${updatedAt ? `<span class="health-chart-meta-chip" role="listitem"><span class="health-chart-meta-label">更新</span><span class="health-chart-meta-value">${esc(updatedAt)}</span></span>` : ''}
      </div>`;
    }

    function buildAppleHealthDetailChipsMarkup(snap) {
      const parts = [];
      const w = readOptionalNumber(snap?.bodyMassKg);
      if (Number.isFinite(w)) parts.push(`体重 ${formatNumber(w, 1)} kg`);
      const bg = readOptionalNumber(snap?.bloodGlucoseMmolPerL);
      if (Number.isFinite(bg)) parts.push(`血糖 ${formatNumber(bg, 1)} mmol/L`);
      const sleep = snap?.sleep && typeof snap.sleep === 'object' ? snap.sleep : {};
      const inBed = readOptionalNumber(sleep.inBedHours);
      if (Number.isFinite(inBed)) parts.push(`卧床 ${formatNumber(inBed, 1)} h`);
      if (!parts.length) return '';
      return `<div class="flex flex-wrap gap-2 text-[10px] font-mono text-gray-500 dark:text-white/45">
        ${parts.map((p) => `<span class="px-2 py-1 rounded-full border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.04]">${esc(p)}</span>`).join('')}
      </div>`;
    }

    function isAppleHealthRelevantQuestion(question = '') {
      return /步数|活动|能量|心率|睡眠|Apple\s*健康|苹果健康|HealthKit|健康数据|静息|步行|卡路|千卡|公里|km|kcal|\bbpm\b|锻炼|健身记录|血氧|散步|走路|跑步/i.test(String(question || ''));
    }

    function buildAppleHealthPromptFromBundle(bundle) {
      if (!bundle || typeof bundle !== 'object') return '';
      const snap = bundle.snapshot && typeof bundle.snapshot === 'object' ? bundle.snapshot : null;
      const history = bundle.history && typeof bundle.history === 'object' ? bundle.history : null;
      if (!snap && !history) return '';
      const lines = [];
      const updatedAt = String(bundle.updatedAt || '').trim();
      lines.push('Apple 健康（HealthKit）上下文（Morpheus 根数据 appleHealthSync；回答运动、睡眠、心率等相关问题时请引用）:');
      if (updatedAt) lines.push(`- 数据同步时间: ${updatedAt}`);
      if (!snap) {
        const activityDays = Array.isArray(history?.activityDaily) ? history.activityDaily.length : 0;
        const heartSamples = Array.isArray(history?.heartRateSamples) ? history.heartRateSamples.length : 0;
        if (activityDays || heartSamples) lines.push(`- 已有长期历史: 活动 ${activityDays} 天，心率样本 ${heartSamples} 条`);
        lines.push('- 说明: 当前没有最新摘要，但已有长期历史可供参考。');
        return lines.join('\n');
      }
      const wh = readOptionalNumber(snap.windowHours);
      if (Number.isFinite(wh)) lines.push(`- 统计窗口: 约 ${Math.round(wh)} 小时`);
      const ws = String(snap.windowStart || '').trim();
      const we = String(snap.windowEnd || '').trim();
      if (ws && we) lines.push(`- 窗口起止 (ISO): ${ws} — ${we}`);

      const steps = readOptionalNumber(snap.steps);
      if (Number.isFinite(steps)) lines.push(`- 步数 (窗口累计): ${Math.round(steps)}`);
      const kcal = readOptionalNumber(snap.activeEnergyKcal);
      if (Number.isFinite(kcal)) lines.push(`- 活动能量 (主动消耗, kcal): ${Math.round(kcal)}`);
      const dist = readOptionalNumber(snap.distanceMeters);
      if (Number.isFinite(dist)) lines.push(`- 步行跑步距离: ${(dist / 1000).toFixed(2)} km`);
      const rest = readOptionalNumber(snap.restingHeartRateBpm);
      if (Number.isFinite(rest)) lines.push(`- 静息心率: ${Math.round(rest)} bpm`);

      const sleep = snap.sleep && typeof snap.sleep === 'object' ? snap.sleep : null;
      if (sleep) {
        const ah = readOptionalNumber(sleep.asleepHours);
        const ib = readOptionalNumber(sleep.inBedHours);
        const bits = [];
        if (Number.isFinite(ah)) bits.push(`实际睡眠约 ${ah.toFixed(1)} h`);
        if (Number.isFinite(ib)) bits.push(`卧床约 ${ib.toFixed(1)} h`);
        if (bits.length) lines.push(`- 睡眠 (窗口内): ${bits.join('，')}`);
      }
      const w = readOptionalNumber(snap.bodyMassKg);
      if (Number.isFinite(w)) lines.push(`- 体重 (HealthKit): ${w.toFixed(1)} kg`);
      const bg = readOptionalNumber(snap.bloodGlucoseMmolPerL);
      if (Number.isFinite(bg)) lines.push(`- 血糖 (HealthKit, mmol/L): ${bg.toFixed(1)}`);

      const hrList = Array.isArray(snap.heartRateSamples) ? snap.heartRateSamples : [];
      if (hrList.length) {
        const parsed = hrList
          .map((s) => {
            const iso = String(s?.at || '').trim();
            const bpm = Number(s?.bpm);
            if (!Number.isFinite(bpm)) return null;
            return { iso, bpm };
          })
          .filter(Boolean);
        if (parsed.length) {
          const bpms = parsed.map((p) => p.bpm);
          const minB = Math.min(...bpms);
          const maxB = Math.max(...bpms);
          const avgB = bpms.reduce((a, b) => a + b, 0) / bpms.length;
          lines.push(`- 心率样本数: ${parsed.length}；最低 ${Math.round(minB)} / 最高 ${Math.round(maxB)} / 平均 ${avgB.toFixed(0)} bpm`);
          const tail = parsed.slice(-16);
          const recent = tail
            .map((p) => {
              const t = p.iso.length >= 19 ? p.iso.slice(11, 19) : p.iso;
              return `${t}→${Math.round(p.bpm)}`;
            })
            .join(', ');
          lines.push(`- 最近心率样本 (时间→bpm): ${recent}`);
        }
      }

      if (history) {
        const activityDaily = Array.isArray(history.activityDaily) ? history.activityDaily : [];
        const sleepDaily = Array.isArray(history.sleepDaily) ? history.sleepDaily : [];
        const restingDaily = Array.isArray(history.restingHeartRateDaily) ? history.restingHeartRateDaily : [];
        const heartHistory = Array.isArray(history.heartRateSamples) ? history.heartRateSamples : [];
        const bodyMassHistory = Array.isArray(history.bodyMassSamples) ? history.bodyMassSamples : [];
        const glucoseHistory = Array.isArray(history.bloodGlucoseSamples) ? history.bloodGlucoseSamples : [];
        if (activityDaily.length || sleepDaily.length || restingDaily.length || heartHistory.length || bodyMassHistory.length || glucoseHistory.length) {
          lines.push(`- 长期历史覆盖: 活动 ${activityDaily.length} 天；睡眠 ${sleepDaily.length} 天；静息心率 ${restingDaily.length} 天；心率样本 ${heartHistory.length} 条；体重 ${bodyMassHistory.length} 条；血糖 ${glucoseHistory.length} 条`);
        }
        const latestActivity = activityDaily.length ? activityDaily[activityDaily.length - 1] : null;
        if (latestActivity && latestActivity.date) {
          const parts = [];
          if (Number.isFinite(Number(latestActivity.steps))) parts.push(`步数 ${Math.round(Number(latestActivity.steps))}`);
          if (Number.isFinite(Number(latestActivity.distanceMeters))) parts.push(`距离 ${(Number(latestActivity.distanceMeters) / 1000).toFixed(2)} km`);
          if (Number.isFinite(Number(latestActivity.activeEnergyKcal))) parts.push(`活动能量 ${Math.round(Number(latestActivity.activeEnergyKcal))} kcal`);
          if (parts.length) lines.push(`- 最近按日活动 (${latestActivity.date}): ${parts.join('，')}`);
        }
      }

      lines.push('- 说明: 以上为设备/HealthKit 摘要，非医疗诊断；未列出项表示当前窗口未同步或未授权。');
      return lines.join('\n');
    }

    async function fetchAppleHealthPromptContext(question = '') {
      if (!canUseFeature()) return '';
      const data = typeof api.getData === 'function' ? api.getData() : null;
      const text = buildAppleHealthPromptFromBundle(data?.appleHealthSync);
      if (text) return text;
      return isAppleHealthRelevantQuestion(question)
        ? 'Apple 健康：当前本地尚无已同步的 HealthKit 摘要。若已启用扩展，请在 iPhone 上的 Morpheus 里打开 Apple 健康配置面板并执行同步。'
        : '';
    }

    function buildAppleHealthDiagnosticConclusion(bundle = null, diagnostics = null) {
      const snap = bundle?.snapshot && typeof bundle.snapshot === 'object' ? bundle.snapshot : null;
      const diag = diagnostics && typeof diagnostics === 'object' ? diagnostics : null;
      if (!diag) {
        return isIOSRuntime()
          ? '可以直接读取真机诊断，但当前还没有刷新诊断面板。'
          : '当前不在 iPhone Morpheus 环境，无法直接读取真机 HealthKit 诊断。';
      }
      if (!diag.support.isHealthDataAvailable) {
        return '当前设备不支持 Apple Health / HealthKit。';
      }
      if (snap) {
        return '当前会话已经拿到 Apple 健康摘要，诊断面板可继续核对是否已经写入权威文件。';
      }
      if (!diag.authorization.hasAnyAuthorized) {
        return 'Morpheus 目前还没有拿到任何 Apple 健康读权限。';
      }
      if (diag.runtime.lastFetchError) {
        return `最近一次原生读取失败：${diag.runtime.lastFetchError}`;
      }
      if (diag.runtime.lastFetchSucceededAt && !diag.canonicalStore.hasAppleHealthSync) {
        return '原生侧已经成功读取过 Apple 健康，但当前 sync root 的 live-data.json 里还没有 appleHealthSync。';
      }
      if (diag.canonicalStore.hasAppleHealthSync) {
        return '当前 sync root 的权威 live data 已经包含 appleHealthSync。';
      }
      return '当前还没看到 Apple 健康数据真正写进权威 live data。';
    }

    function buildAppleHealthDiagnosticsMarkup(bundle = null) {
      const diag = syncState.diagnostics && typeof syncState.diagnostics === 'object' ? syncState.diagnostics : null;
      const conclusion = buildAppleHealthDiagnosticConclusion(bundle, diag);
      const authRows = diag ? Object.entries(diag.authorization.byType || {}) : [];
      const authMarkup = authRows.length
        ? `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            ${authRows.map(([key, value]) => `<div class="rounded-xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3 py-2">
              <div class="text-[10px] font-mono text-gray-500 dark:text-white/40">${esc(key)}</div>
              <div class="mt-1 text-[12px] text-black dark:text-white">${esc(authStatusText(value))}</div>
            </div>`).join('')}
          </div>`
        : `<div class="text-[11px] leading-6 text-gray-500 dark:text-white/55">${isIOSRuntime() ? '点一次「刷新诊断」后，这里会显示每一项 HealthKit 权限状态。' : '请在 iPhone Morpheus 里查看真机诊断。'}</div>`;
      const rows = diag ? [
        ['结论', conclusion],
        ['HealthKit 可用', diag.support.isHealthDataAvailable ? '是' : '否'],
        ['已授权条目', `${diag.authorization.authorizedCount} 项`],
        ['未决定条目', `${diag.authorization.notDeterminedCount} 项`],
        ['已拒绝条目', `${diag.authorization.deniedCount} 项`],
        ['最近授权请求', diag.runtime.lastAuthorizationRequestedAt ? formatDateTimeLabel(diag.runtime.lastAuthorizationRequestedAt) : '—'],
        ['最近授权完成', diag.runtime.lastAuthorizationCompletedAt ? formatDateTimeLabel(diag.runtime.lastAuthorizationCompletedAt) : '—'],
        ['授权错误', diag.runtime.lastAuthorizationError || '—'],
        ['最近拉取尝试', diag.runtime.lastFetchAttemptAt ? formatDateTimeLabel(diag.runtime.lastFetchAttemptAt) : '—'],
        ['最近拉取成功', diag.runtime.lastFetchSucceededAt ? formatDateTimeLabel(diag.runtime.lastFetchSucceededAt) : '—'],
        ['拉取错误', diag.runtime.lastFetchError || '—'],
        ['当前 sync root', diag.syncRoot.path || '—'],
        ['存储模式', diag.syncRoot.storageMode || '—'],
        ['权威 live-data', diag.canonicalStore.hasLiveDataFile ? '已找到' : '未找到'],
        ['已写入 appleHealthSync', diag.canonicalStore.hasAppleHealthSync ? '是' : '否'],
        ['权威文件更新时间', diag.canonicalStore.liveDataModifiedAt ? formatDateTimeLabel(diag.canonicalStore.liveDataModifiedAt) : '—'],
        ['权威 revision', diag.canonicalStore.revision ? String(diag.canonicalStore.revision) : '—'],
        ['插件 state.json', diag.canonicalStore.pluginStateFileExists ? '已生成' : '未生成'],
        ['用户镜像目录', diag.canonicalStore.userMirrorExists ? '已生成' : '未生成'],
      ] : [['结论', conclusion]];
      return `<div class="rounded-[1.15rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <div class="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/40">Apple Health 诊断</div>
          <div class="text-[10px] font-mono text-gray-400 dark:text-white/35">${diag?.checkedAt ? `刷新于 ${esc(formatDateTimeLabel(diag.checkedAt))}` : '未刷新'}</div>
        </div>
        <div class="mt-3 grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
          <div class="space-y-2">
            ${rows.map(([label, value]) => `<div class="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-white/6 pb-2">
              <span class="text-[11px] text-gray-500 dark:text-white/45 shrink-0">${esc(label)}</span>
              <span class="text-[11px] text-right leading-5 text-black dark:text-white/85 break-all">${esc(value)}</span>
            </div>`).join('')}
          </div>
          <div>
            <div class="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/40">权限分布</div>
            <div class="mt-3">${authMarkup}</div>
            ${diag?.canonicalStore?.historyKeys?.length ? `<div class="mt-4 text-[11px] leading-6 text-gray-500 dark:text-white/55">权威文件 history keys: ${esc(diag.canonicalStore.historyKeys.join(', '))}</div>` : ''}
          </div>
        </div>
      </div>`;
    }

    function buildAppleHealthSettingsSyncPanelMarkup(bundle = null) {
      const isIOS = isIOSRuntime();
      const disabledAttr = isIOS && canUseFeature() ? '' : 'disabled';
      const updatedAt = String(bundle?.updatedAt || '').trim();
      const snap = bundle?.snapshot && typeof bundle.snapshot === 'object' ? bundle.snapshot : null;
      const rows = [
        ['上次同步', updatedAt ? formatDateTimeLabel(updatedAt) : '—'],
        ['统计窗口', snap?.windowStart && snap?.windowEnd ? `${formatDateTimeLabel(snap.windowStart, { includeDate: false })} - ${formatDateTimeLabel(snap.windowEnd, { includeDate: false })}` : '最近 24 小时'],
        ['数据写入', snap ? '已写入 appleHealthSync' : '等待同步摘要'],
      ];
      return `<div class="rounded-[1rem] border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-4 py-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div class="text-[10px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-widest">同步面板</div>
            <div class="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              ${rows.map(([label, value]) => `<div>
                <div class="text-[10px] font-mono text-gray-400 dark:text-white/35">${esc(label)}</div>
                <div class="mt-1 text-[11px] leading-5 text-gray-700 dark:text-white/76">${esc(value)}</div>
              </div>`).join('')}
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button id="settings-apple-health-authorize" type="button" onclick="if (typeof morphAppleHealthAuthorize === 'function') morphAppleHealthAuthorize()" class="w-full sm:w-auto px-4 py-3 rounded-xl text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" ${disabledAttr}>请求健康权限</button>
            <button id="settings-apple-health-refresh" type="button" onclick="if (typeof morphAppleHealthRefresh === 'function') morphAppleHealthRefresh()" class="w-full sm:w-auto px-4 py-3 rounded-xl text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" ${disabledAttr}>立即同步</button>
            <button id="settings-apple-health-diagnose" type="button" onclick="if (typeof morphAppleHealthDiagnose === 'function') morphAppleHealthDiagnose()" class="w-full sm:w-auto px-4 py-3 rounded-xl text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" ${disabledAttr}>刷新诊断</button>
          </div>
        </div>
      </div>`;
    }

    function buildAppleHealthWorkspaceMarkup() {
      if (!canUseFeature()) {
        return `<div class="rounded-[1.2rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-5 text-[13px] leading-7 text-gray-500 dark:text-white/60">请先启用「Apple 健康」扩展，之后才能在这里查看完整健康摘要。</div>`;
      }
      const data = typeof api.getData === 'function' ? api.getData() : null;
      const bundle = data?.appleHealthSync && typeof data.appleHealthSync === 'object' ? data.appleHealthSync : {};
      const snap = bundle.snapshot && typeof bundle.snapshot === 'object' ? bundle.snapshot : null;
      const updatedAt = String(bundle.updatedAt || '').trim();
      if (!snap) {
        return `<div class="flex flex-col gap-4">
          <div class="rounded-[1.2rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-5">
            <div class="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/40">Apple Health Details</div>
            <div class="mt-3 text-[14px] leading-7 text-gray-700 dark:text-white/80">当前还没有可显示的 Apple 健康摘要。</div>
            <div class="mt-2 text-[12px] leading-6 text-gray-500 dark:text-white/55">完成授权并同步后，顶部概览只保留同步时间和统计窗口，下面的详细数据会继续展示。</div>
          </div>
        </div>`;
      }
      const sortedPoints = (Array.isArray(snap.heartRateSamples) ? snap.heartRateSamples : [])
        .map(parseHrPoint)
        .filter(Boolean)
        .sort((a, b) => a.t - b.t);
      const hrStats = buildAppleHealthHrStats(sortedPoints);
      const axisStart = sortedPoints.length ? sortedPoints[0].t : Date.now() - 24 * 60 * 60 * 1000;
      const axisEnd = sortedPoints.length ? sortedPoints[sortedPoints.length - 1].t : Date.now();
      const ringsMarkup = buildAppleHealthActivityRingsSvg(snap);
      const barsMarkup = buildAppleHealthRelativeBarsMarkup(snap);
      const hrChart = buildAppleHealthHrChartSvg(
        sortedPoints,
        axisStart,
        Math.max(axisEnd, axisStart + 60 * 60 * 1000),
        readOptionalNumber(snap?.restingHeartRateBpm),
      );
      return `
        <div class="flex flex-col gap-4">
          ${buildAppleHealthDetailOverviewMarkup(snap, updatedAt)}
          <div class="grid grid-cols-1 2xl:grid-cols-2 gap-4 items-start">
            <div class="flex flex-col gap-4">
              ${buildAppleHealthMetricStripMarkup(snap, hrStats)}
              ${barsMarkup}
              <div class="rounded-[1.15rem] border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-4 py-4">
                <div class="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-500 dark:text-white/40">心率曲线</div>
                <div class="mt-3">${buildAppleHealthChartMetaRow(snap, hrStats?.count || 0, updatedAt)}</div>
                <div class="mt-3">${hrChart}</div>
              </div>
            </div>
            <div class="flex flex-col gap-4">
              ${ringsMarkup || ''}
              ${buildAppleHealthBiometricsMarkup(snap, hrStats)}
            </div>
          </div>
          ${buildAppleHealthHrSampleFeedMarkup(sortedPoints)}
          <p class="text-[11px] leading-5 text-gray-500 dark:text-white/45">以上为 Apple Health / HealthKit 摘要数据与样本概览，适合用来观察趋势，不作为医疗诊断依据。</p>
        </div>
      `;
    }

    function syncModalUI() {
      const modal = typeof document !== 'undefined' ? document.getElementById('settings-apple-health-modal') : null;
      if (!modal) return;
      const open = typeof api.isModalOpen === 'function' ? api.isModalOpen() : false;
      modal.classList.toggle('opacity-0', !open);
      modal.classList.toggle('pointer-events-none', !open);
      modal.setAttribute('aria-hidden', open ? 'false' : 'true');
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.classList.toggle('scale-95', !open);
        content.classList.toggle('scale-100', open);
      }

      const isIOS = typeof api.isIOSNativeAppRuntime === 'function' ? api.isIOSNativeAppRuntime() : false;
      const data = typeof api.getData === 'function' ? api.getData() : null;
      const bundle = data?.appleHealthSync && typeof data.appleHealthSync === 'object' ? data.appleHealthSync : {};
      const summary = document.getElementById('settings-apple-health-status-summary');
      if (summary) summary.textContent = buildAppleHealthStatusSummary(bundle, { isIOS });
      const enabledInput = document.getElementById('settings-apple-health-enabled-input');
      if (enabledInput) enabledInput.checked = canUseFeature();
      const syncPanel = document.getElementById('settings-apple-health-sync-panel');
      if (syncPanel) syncPanel.innerHTML = buildAppleHealthSettingsSyncPanelMarkup(bundle);
      const diagnosticsPanel = document.getElementById('settings-apple-health-diagnostics-panel');
      if (diagnosticsPanel) diagnosticsPanel.innerHTML = buildAppleHealthDiagnosticsMarkup(bundle);
      const authBtn = document.getElementById('settings-apple-health-authorize');
      if (authBtn) authBtn.disabled = !isIOS || !canUseFeature();
      const refreshBtn = document.getElementById('settings-apple-health-refresh');
      if (refreshBtn) refreshBtn.disabled = !isIOS || !canUseFeature();
      const diagnoseBtn = document.getElementById('settings-apple-health-diagnose');
      if (diagnoseBtn) diagnoseBtn.disabled = !isIOS || !canUseFeature();
      setAppleHealthStatusMessage(syncState.statusMessage, syncState.statusError);
    }

    function openModal() {
      if (typeof api.setModalOpen === 'function') api.setModalOpen(true);
      syncModalUI();
      rerender();
      if (isIOSRuntime() && canUseFeature() && !syncState.diagnostics && !syncState.diagnosticsInFlight) {
        fetchAppleHealthDiagnostics({ force: false, silent: true }).then(() => {
          syncModalUI();
        }).catch(() => {});
      }
      const target = (typeof document !== 'undefined' && (document.getElementById('settings-apple-health-enabled-input') || document.getElementById('settings-apple-health-authorize'))) || null;
      if (target && typeof target.focus === 'function') {
        requestAnimationFrame(() => {
          try { target.focus(); } catch (_) {}
        });
      }
    }

    function closeModal() {
      if (typeof api.setModalOpen === 'function') api.setModalOpen(false);
      syncModalUI();
    }

    function installGlobalHandlers() {
      if (typeof window === 'undefined') return;
      window.morphAppleHealthAuthorize = () => {
        setAppleHealthStatusMessage('正在请求 Apple 健康权限...', false);
        requestAppleHealthAuthorization()
          .then(() => {
            setAppleHealthStatusMessage('权限已授予，正在同步摘要...', false);
            return refreshAppleHealthSnapshot();
          })
          .catch((err) => {
            const msg = String(err?.message || err || '授权失败');
            setAppleHealthStatusMessage(msg, true);
            syncModalUI();
            if (typeof console !== 'undefined' && console.warn) console.warn('[apple-health]', msg);
            if (/native_control_timeout/i.test(msg)) {
              notifyAppleHealthUser(
                '健康权限',
                '原生未在超时时间内返回结果。请重新点一次「请求健康权限」；若仍无系统弹窗，请完全退出 Morpheus 后重开，并确认 Xcode 已为 App 勾选 HealthKit 能力。',
              );
            } else {
              notifyAppleHealthUser('健康权限', msg);
            }
          });
      };
      window.morphAppleHealthRefresh = () => {
        setAppleHealthStatusMessage('正在同步 Apple 健康摘要...', false);
        refreshAppleHealthSnapshot().catch((err) => {
          const msg = String(err?.message || err || '同步失败');
          setAppleHealthStatusMessage(msg, true);
          syncModalUI();
          notifyAppleHealthUser('Apple 健康', msg);
        });
      };
      window.morphAppleHealthDiagnose = () => {
        setAppleHealthStatusMessage('正在刷新 Apple 健康诊断...', false);
        fetchAppleHealthDiagnostics({ force: true, silent: false }).catch((err) => {
          const msg = String(err?.message || err || '读取诊断失败');
          setAppleHealthStatusMessage(msg, true);
          syncModalUI();
          notifyAppleHealthUser('Apple 健康诊断', msg);
        });
      };
    }

    /** 供工作台在 innerHTML 渲染后绑定，避免 WKWebView 内联 onclick 偶发不触发。 */
    function bindAppleHealthWorkspaceActionButtons(root) {
      if (!root || typeof root.querySelector !== 'function') return;
      const enabledInput = root.querySelector('[data-morph-apple-health-enabled]');
      const authBtn = root.querySelector('[data-morph-apple-health-authorize]');
      const refreshBtn = root.querySelector('[data-morph-apple-health-refresh]');
      const diagnoseBtn = root.querySelector('[data-morph-apple-health-diagnose]');
      if (enabledInput && !enabledInput.dataset.morphAppleHealthBound) {
        enabledInput.dataset.morphAppleHealthBound = '1';
        enabledInput.addEventListener('change', () => {
          if (typeof api.setExtensionEnabled === 'function') api.setExtensionEnabled('apple-health', enabledInput.checked === true);
          syncModalUI();
        });
      }
      if (authBtn && !authBtn.dataset.morphAppleHealthBound) {
        authBtn.dataset.morphAppleHealthBound = '1';
        authBtn.addEventListener('click', () => {
          if (typeof window.morphAppleHealthAuthorize === 'function') window.morphAppleHealthAuthorize();
        });
      }
      if (refreshBtn && !refreshBtn.dataset.morphAppleHealthBound) {
        refreshBtn.dataset.morphAppleHealthBound = '1';
        refreshBtn.addEventListener('click', () => {
          if (typeof window.morphAppleHealthRefresh === 'function') window.morphAppleHealthRefresh();
        });
      }
      if (diagnoseBtn && !diagnoseBtn.dataset.morphAppleHealthBound) {
        diagnoseBtn.dataset.morphAppleHealthBound = '1';
        diagnoseBtn.addEventListener('click', () => {
          if (typeof window.morphAppleHealthDiagnose === 'function') window.morphAppleHealthDiagnose();
        });
      }
    }

    function applyToggle(nextEnabled) {
      if (nextEnabled) {
        installGlobalHandlers();
        restartAppleHealthSyncScheduler();
      } else {
        clearAppleHealthSyncTimer();
        if (typeof api.getCurrentTab === 'function' && api.getCurrentTab() === 'health') {
          const hasGlucose = typeof api.canUseGlucoseExtensionFeatures === 'function'
            ? api.canUseGlucoseExtensionFeatures() === true
            : false;
          if (hasGlucose) {
            if (typeof api.setHealthViewPane === 'function') api.setHealthViewPane('glucose');
            if (typeof api.syncHealthViewComposition === 'function') api.syncHealthViewComposition();
          } else if (typeof api.switchTab === 'function') {
            api.switchTab('extensions', true);
            return { redirected: true };
          }
        }
      }
      syncModalUI();
      return { redirected: false };
    }

    function hasExistingFootprint() {
      const data = typeof api.getData === 'function' ? api.getData() : null;
      const b = data?.appleHealthSync;
      if (b && typeof b === 'object' && b.snapshot && typeof b.snapshot === 'object') return true;
      if (typeof b?.updatedAt === 'string' && b.updatedAt.trim()) return true;
      return false;
    }

    installGlobalHandlers();

    return {
      canUseFeature,
      persistAppleHealthSync,
      hydrateAppleHealthFromNativeOnce,
      requestAppleHealthAuthorization,
      refreshAppleHealthSnapshot,
      buildAppleHealthWorkspaceMarkup,
      bindAppleHealthWorkspaceActionButtons,
      syncModalUI,
      openModal,
      closeModal,
      applyToggle,
      restartAppleHealthSyncScheduler,
      triggerAppleHealthAutoSync,
      clearAppleHealthSyncTimer,
      hasExistingFootprint,
      fetchAppleHealthPromptContext,
      buildAppleHealthPromptFromBundle,
      fetchAppleHealthDiagnostics,
    };
  }

  window.MorphAppleHealthExtensionRuntime = {
    create: createAppleHealthExtensionRuntime,
  };
})();
