(function () {
  function createGlucoseExtensionRuntime(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function buildDefaultGlucoseHistoryState() {
      return {
        loading: false,
        error: '',
        updatedAt: '',
        reading: null,
        series: [],
        targetLow: 70,
        targetHigh: 180,
        source: '',
        refreshTimer: null,
      };
    }

    function buildDefaultGlucoseSyncHydrationState() {
      return {
        timer: null,
        inFlight: false,
      };
    }

    function getGlucoseRuntimeState() {
      if (typeof api.getGlucoseRuntimeState === 'function') {
        const state = api.getGlucoseRuntimeState();
        if (state && typeof state === 'object') return state;
      }
      const hostState = typeof window !== 'undefined' && window.__MorphAppStateRuntimeState && typeof window.__MorphAppStateRuntimeState === 'object'
        ? window.__MorphAppStateRuntimeState
        : null;
      if (!hostState) return null;
      if (!hostState.glucoseRuntimeState || typeof hostState.glucoseRuntimeState !== 'object') {
        hostState.glucoseRuntimeState = {
          contextCache: null,
          historyState: buildDefaultGlucoseHistoryState(),
          syncHydrationState: buildDefaultGlucoseSyncHydrationState(),
        };
      }
      return hostState.glucoseRuntimeState;
    }

    function getGlucoseHistoryState() {
      const runtimeState = getGlucoseRuntimeState();
      if (!runtimeState) return buildDefaultGlucoseHistoryState();
      if (!runtimeState.historyState || typeof runtimeState.historyState !== 'object') {
        runtimeState.historyState = buildDefaultGlucoseHistoryState();
      }
      return runtimeState.historyState;
    }

    function getGlucoseSyncHydrationState() {
      const runtimeState = getGlucoseRuntimeState();
      if (!runtimeState) return buildDefaultGlucoseSyncHydrationState();
      if (!runtimeState.syncHydrationState || typeof runtimeState.syncHydrationState !== 'object') {
        runtimeState.syncHydrationState = buildDefaultGlucoseSyncHydrationState();
      }
      return runtimeState.syncHydrationState;
    }

    function clearGlucoseContextCache() {
      const runtimeState = getGlucoseRuntimeState();
      if (runtimeState) runtimeState.contextCache = null;
    }

    function clearGlucoseSyncHydrationTimer() {
      const syncState = getGlucoseSyncHydrationState();
      if (!syncState.timer) return;
      if (typeof clearInterval === 'function') clearInterval(syncState.timer);
      syncState.timer = null;
    }

    function hasExistingFootprint() {
      const settingsState = api.getSettingsState ? api.getSettingsState() : {};
      const config = settingsState.glucoseConfig || {};
      if (String(config.email || '').trim()) return true;
      if (config.hasPassword === true) return true;
      const synced = extractSyncedGlucoseBundle(api.getData ? api.getData() : null);
      if (synced && synced.reading) return true;
      if (Array.isArray(synced?.series) && synced.series.length) return true;
      const archive = getLocalGlucoseArchive(api.getData ? api.getData() : null);
      return Array.isArray(archive) && archive.length > 0;
    }

    function canUseFeature() {
      return api.isExtensionEnabled ? api.isExtensionEnabled('glucose') : false;
    }

    function normalizeGlucosePoint(point) {
      if (typeof api.normalizeGlucosePoint === 'function') return api.normalizeGlucosePoint(point);
      if (!point || typeof point !== 'object') return null;
      const value = Number(point.value);
      const timestamp = String(point.timestamp || point.time || '').trim();
      if (!Number.isFinite(value) || !timestamp) return null;
      return {
        value,
        timestamp,
        trend: String(point.trend || '').trim(),
        targetLow: Number.isFinite(Number(point.targetLow)) ? Number(point.targetLow) : 70,
        targetHigh: Number.isFinite(Number(point.targetHigh)) ? Number(point.targetHigh) : 180,
      };
    }

    function normalizeGlucoseHistorySeries(series = []) {
      if (typeof api.normalizeGlucoseHistorySeries === 'function') return api.normalizeGlucoseHistorySeries(series);
      if (!Array.isArray(series)) return [];
      const byTs = new Map();
      series.forEach((item) => {
        const point = normalizeGlucosePoint(item);
        if (!point) return;
        byTs.set(point.timestamp, point);
      });
      return Array.from(byTs.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    function mergeGlucoseSeries(prev = [], next = []) {
      const existing = normalizeGlucoseHistorySeries(prev);
      const incoming = normalizeGlucoseHistorySeries(next);
      if (!existing.length) return incoming;
      if (!incoming.length) return existing;
      const byTs = new Map();
      existing.forEach((point) => byTs.set(point.timestamp, point));
      incoming.forEach((point) => byTs.set(point.timestamp, point));
      const merged = Array.from(byTs.values())
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const latestTs = new Date(merged[merged.length - 1].timestamp).getTime();
      if (!Number.isFinite(latestTs)) return merged;
      const keepFrom = latestTs - (36 * 60 * 60 * 1000);
      const trimmed = merged.filter((point) => {
        const ts = new Date(point.timestamp).getTime();
        return Number.isFinite(ts) && ts >= keepFrom;
      });
      const finalSeries = trimmed.length ? trimmed : merged;
      return finalSeries.slice(-500);
    }

    function mergeGlucoseArchive(prev = [], next = []) {
      const existing = normalizeGlucoseHistorySeries(prev);
      const incoming = normalizeGlucoseHistorySeries(next);
      if (!existing.length) return incoming.slice(-500);
      if (!incoming.length) return existing.slice(-500);
      const byTs = new Map();
      existing.forEach((point) => byTs.set(point.timestamp, point));
      incoming.forEach((point) => byTs.set(point.timestamp, point));
      return Array.from(byTs.values())
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-500);
    }

    function getLocalGlucoseArchive(sourceData = api.getData ? api.getData() : null) {
      const root = sourceData && typeof sourceData === 'object' ? sourceData : {};
      const candidates = [
        root?.glucoseHistoryArchive,
        root?.glucoseSync?.archive,
        root?.glucose?.archive,
        root?.health?.glucoseHistoryArchive,
        root?.health?.glucose?.archive,
        root?.glucoseSync?.series,
        root?.glucose?.series,
      ];
      for (const candidate of candidates) {
        if (!Array.isArray(candidate) || !candidate.length) continue;
        const normalized = normalizeGlucoseHistorySeries(candidate);
        if (normalized.length) return normalized;
      }
      return [];
    }

    function extractSyncedGlucoseBundle(sourceData = api.getData ? api.getData() : null) {
      const root = sourceData && typeof sourceData === 'object' ? sourceData : {};
      const bundleCandidates = [
        root?.glucoseSync,
        root?.glucose,
        root?.health?.glucose,
        root?.health?.cgm,
        root?.cgm,
        root?.realtime?.glucose,
      ].filter((item) => item && typeof item === 'object');
      const bundle = bundleCandidates[0] || {};

      const seriesCandidates = [
        bundle?.series,
        bundle?.history,
        bundle?.graphData,
        bundle?.points,
        root?.glucoseSeries,
        root?.health?.glucoseSeries,
      ];
      let series = [];
      for (const candidate of seriesCandidates) {
        if (!Array.isArray(candidate) || !candidate.length) continue;
        series = candidate.map(normalizeGlucosePoint).filter(Boolean);
        if (series.length) break;
      }
      const archive = getLocalGlucoseArchive(root);
      if (!series.length && archive.length) {
        series = archive.slice(-500);
      }
      if (!series.length && bundle?.reading) {
        const one = normalizeGlucosePoint(bundle.reading);
        if (one) series = [one];
      }

      const readingCandidate = normalizeGlucosePoint(bundle?.reading || root?.glucoseReading || root?.health?.glucoseReading || null);
      const reading = readingCandidate || (series.length ? series[series.length - 1] : null);
      const targetLow = Number.isFinite(Number(bundle?.range?.targetLow))
        ? Number(bundle.range.targetLow)
        : Number(reading?.targetLow ?? bundle?.targetLow ?? 70);
      const targetHigh = Number.isFinite(Number(bundle?.range?.targetHigh))
        ? Number(bundle.range.targetHigh)
        : Number(reading?.targetHigh ?? bundle?.targetHigh ?? 180);
      const updatedAt = String(bundle?.updatedAt || bundle?.fetchedAt || root?.glucoseUpdatedAt || '').trim();

      if (!reading && !series.length) return null;
      return {
        reading: reading ? { ...reading, targetLow, targetHigh } : null,
        series,
        archive,
        targetLow,
        targetHigh,
        updatedAt,
      };
    }

    function hasFreshSyncedGlucoseReading(sourceData = api.getData ? api.getData() : null) {
      const root = sourceData && typeof sourceData === 'object' ? sourceData : {};
      const bundleCandidates = [
        root?.glucoseSync,
        root?.glucose,
        root?.health?.glucose,
        root?.health?.cgm,
        root?.cgm,
        root?.realtime?.glucose,
      ].filter((item) => item && typeof item === 'object');
      for (const bundle of bundleCandidates) {
        const seriesCandidates = [
          bundle?.series,
          bundle?.history,
          bundle?.graphData,
          bundle?.points,
        ];
        for (const candidate of seriesCandidates) {
          if (!Array.isArray(candidate) || !candidate.length) continue;
          if (normalizeGlucoseHistorySeries(candidate).length) return true;
        }
        if (normalizeGlucosePoint(bundle?.reading || null)) return true;
      }
      return false;
    }

    function buildCanonicalGlucoseSyncBundle(bundle = {}) {
      const series = normalizeGlucoseHistorySeries(Array.isArray(bundle?.series) ? bundle.series : []);
      const reading = normalizeGlucosePoint(bundle?.reading || null) || (series.length ? series[series.length - 1] : null);
      const targetLow = Number.isFinite(Number(bundle?.targetLow))
        ? Number(bundle.targetLow)
        : Number(reading?.targetLow ?? bundle?.range?.targetLow ?? 70);
      const targetHigh = Number.isFinite(Number(bundle?.targetHigh))
        ? Number(bundle.targetHigh)
        : Number(reading?.targetHigh ?? bundle?.range?.targetHigh ?? 180);
      return {
        reading: reading ? { ...reading, targetLow, targetHigh } : null,
        series,
        range: {
          targetLow,
          targetHigh,
        },
        updatedAt: String(bundle?.updatedAt || '').trim(),
      };
    }

    function formatGlucoseMmol(mgdl) {
      if (typeof api.formatGlucoseMmol === 'function') return api.formatGlucoseMmol(mgdl);
      const value = Number(mgdl);
      if (!Number.isFinite(value)) return '--';
      return (value / 18).toFixed(1);
    }

    function formatGlucoseTargetRangeMmol(lowMgdl, highMgdl) {
      if (typeof api.formatGlucoseTargetRangeMmol === 'function') return api.formatGlucoseTargetRangeMmol(lowMgdl, highMgdl);
      return `${formatGlucoseMmol(lowMgdl)}-${formatGlucoseMmol(highMgdl)} mmol/L`;
    }

    function formatGlucoseTrendLabel(raw = '') {
      if (typeof api.formatGlucoseTrendLabel === 'function') return api.formatGlucoseTrendLabel(raw);
      const key = String(raw || '').trim();
      if (!key) return '--';
      const map = {
        Flat: '平稳',
        SingleUp: '上升',
        FortyFiveUp: '缓升',
        DoubleUp: '快速上升',
        SingleDown: '下降',
        FortyFiveDown: '缓降',
        DoubleDown: '快速下降',
        NotComputable: '不可计算',
      };
      return map[key] || key;
    }

    function formatGlucoseTime(ts) {
      if (typeof api.formatGlucoseTime === 'function') return api.formatGlucoseTime(ts);
      if (!ts) return '--';
      const date = new Date(ts);
      if (Number.isNaN(date.getTime())) return '--';
      return date.toLocaleString('zh-CN', { hour12: false });
    }

    function startOfWeek(dateInput) {
      const date = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
      if (Number.isNaN(date.getTime())) return new Date(NaN);
      const day = date.getDay();
      const diff = day === 0 ? -6 : (1 - day);
      date.setDate(date.getDate() + diff);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    function formatGlucoseDateKey(dateInput, mode = 'day') {
      if (typeof api.formatGlucoseDateKey === 'function') return api.formatGlucoseDateKey(dateInput, mode);
      const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
      if (Number.isNaN(date.getTime())) return 'unknown';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      if (mode === 'month') return `${year}-${month}`;
      if (mode === 'week') {
        const start = startOfWeek(date);
        const weekYear = start.getFullYear();
        const weekMonth = String(start.getMonth() + 1).padStart(2, '0');
        const weekDay = String(start.getDate()).padStart(2, '0');
        return `${weekYear}-${weekMonth}-${weekDay}`;
      }
      return `${year}-${month}-${day}`;
    }

    function formatExpenseLedgerAmount(value) {
      if (typeof api.formatExpenseLedgerAmount === 'function') return api.formatExpenseLedgerAmount(value);
      const n = Number(value);
      if (!Number.isFinite(n)) return '0';
      return (Math.round(n * 100) / 100).toFixed(2);
    }

    function sanitizeGlucoseErrorMessage(message = '') {
      if (typeof api.sanitizeGlucoseErrorMessage === 'function') return api.sanitizeGlucoseErrorMessage(message);
      const raw = String(message || '').trim();
      if (!raw) return '读取血糖曲线失败';
      let safe = raw.replace(/[A-Za-z0-9_-]{28,}/g, '***');
      safe = safe.replace(/https?:\/\/[^\s|]+/g, (urlText) => {
        try {
          return new URL(urlText).host || 'api';
        } catch {
          return 'api';
        }
      });
      if (safe.length > 180) safe = `${safe.slice(0, 180)}...`;
      return safe;
    }

    function buildGlucoseChartMetaMarkup(payload = {}) {
      if (typeof api.buildGlucoseChartMetaMarkup === 'function') return api.buildGlucoseChartMetaMarkup(payload);
      const mmolRange = formatGlucoseTargetRangeMmol(payload.targetLow, payload.targetHigh);
      const updatedLabel = payload.updatedAt ? formatGlucoseTime(payload.updatedAt) : '--';
      const sourceLabel = String(payload.source || '').trim() || '等待同步';
      const escapeHTML = typeof api.escapeHTML === 'function'
        ? api.escapeHTML
        : (value) => String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      return `
        <div class="health-chart-meta" role="list" aria-label="血糖图表图例与说明">
            <span class="health-chart-meta-chip" role="listitem">
                <span class="health-chart-swatch health-chart-swatch-band" aria-hidden="true"></span>
                <span class="health-chart-meta-value">${escapeHTML(`目标 ${mmolRange}`)}</span>
            </span>
            <span class="health-chart-meta-chip" role="listitem">
                <span class="health-chart-swatch health-chart-swatch-line" aria-hidden="true"></span>
                <span class="health-chart-meta-value">近 24h 血糖曲线</span>
            </span>
            <span class="health-chart-meta-chip" role="listitem">
                <span class="health-chart-meta-label">更新</span>
                <span class="health-chart-meta-value">${escapeHTML(updatedLabel)}</span>
            </span>
            <span class="health-chart-meta-chip" role="listitem">
                <span class="health-chart-meta-label">来源</span>
                <span class="health-chart-meta-value">${escapeHTML(sourceLabel)}</span>
            </span>
        </div>
      `;
    }

    function buildGlucoseChartNoticeMarkup(message = '', tone = 'muted') {
      if (typeof api.buildGlucoseChartNoticeMarkup === 'function') return api.buildGlucoseChartNoticeMarkup(message, tone);
      const safeTone = tone === 'error' ? 'error' : 'muted';
      const escapeHTML = typeof api.escapeHTML === 'function'
        ? api.escapeHTML
        : (value) => String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      return `
        <div class="health-chart-meta ${safeTone === 'error' ? 'is-error' : ''}">
            <span class="health-chart-meta-value">${escapeHTML(String(message || '').trim() || '暂无血糖图表说明')}</span>
        </div>
      `;
    }

    /** 图表 X 轴固定时间窗口（小时），与拉取接口 hours 一致，保证手机端与电脑端时间跨度一致 */
    const GLUCOSE_CHART_WINDOW_HOURS = 24;

    function buildGlucoseChartSvg(series = [], options = {}) {
      const rawPoints = normalizeGlucoseHistorySeries(series);
      if (!rawPoints.length) return '<div class="h-full w-full flex items-center justify-center text-[11px] font-mono text-gray-500 dark:text-white/45">暂无可用血糖曲线</div>';

      const width = 1100;
      const viewportWidth = Number(options.viewportWidth);
      const effectiveViewportWidth = Number.isFinite(viewportWidth) && viewportWidth > 0
        ? viewportWidth
        : (typeof window !== 'undefined' ? Math.max(320, Math.min(window.innerWidth - 40, 1600)) : width);
      const isMobileChart = typeof window !== 'undefined'
        && (window.matchMedia('(max-width: 900px)').matches || window.matchMedia('(hover: none) and (pointer: coarse)').matches);
      const padLeft = isMobileChart ? 6 : 8;
      const padRight = isMobileChart ? 4 : 6;
      const padTop = 12;
      const padBottom = 20;
      const chartW = width - padLeft - padRight;
      const chartHBase = 280 - padTop - padBottom;
      const displayScale = Math.max(0.22, Math.min(3.4, effectiveViewportWidth / width));
      const scaleForDisplay = (targetPx, minUserPx, maxUserPx) => {
        const scaled = targetPx / displayScale;
        return Math.max(minUserPx, Math.min(maxUserPx, Number(scaled.toFixed(2))));
      };
      const axisFontSizeY = scaleForDisplay(isMobileChart ? 9.4 : 10, 8.6, 24);
      const axisFontSizeX = scaleForDisplay(isMobileChart ? 9.2 : 9.6, 8.4, 22);
      const gridStrokeWidth = scaleForDisplay(0.72, 0.5, 1.4);
      const lineStrokeWidth = scaleForDisplay(1.55, 1.1, 3.2);
      const pointRadius = scaleForDisplay(3.4, 2.8, 7);
      const pointStrokeWidth = scaleForDisplay(1.2, 0.9, 2.2);

      const nowTs = Date.now();
      const windowMs = GLUCOSE_CHART_WINDOW_HOURS * 60 * 60 * 1000;
      const actualAxisEnd = nowTs;
      const actualAxisStart = actualAxisEnd - windowMs;
      const usePoints = rawPoints.filter((point) => {
        const ts = new Date(point.timestamp).getTime();
        return Number.isFinite(ts) && ts >= actualAxisStart && ts <= actualAxisEnd;
      });
      const xSpan = Math.max(actualAxisEnd - actualAxisStart, 60 * 60 * 1000);

      const allValues = usePoints.length ? usePoints.map((point) => point.value) : [];
      const low = Number.isFinite(Number(options.targetLow)) ? Number(options.targetLow) : 70;
      const high = Number.isFinite(Number(options.targetHigh)) ? Number(options.targetHigh) : 180;
      const minValue = allValues.length ? Math.min(low - 30, ...allValues) : (low - 30);
      const maxValue = allValues.length ? Math.max(high + 30, ...allValues) : (high + 30);
      let yMin = Math.max(40, Math.floor(minValue / 10) * 10);
      let yMax = Math.min(360, Math.ceil(maxValue / 10) * 10);
      let ySpan = Math.max(40, yMax - yMin);
      let chartH = chartHBase;
      let height = 340;
      // 手机/触摸端：纵轴范围 3～21 mmol/L，比例与电脑端一致 -> 纵轴加高
      if (isMobileChart) {
        const ySpanDesktop = ySpan;
        const mmolToMgdl = (mmol) => Math.round(mmol * 18.0182);
        yMin = mmolToMgdl(3);
        yMax = mmolToMgdl(21);
        ySpan = yMax - yMin;
        chartH = Math.round(chartHBase * ySpan / ySpanDesktop);
        height = padTop + chartH + padBottom;
      }

      const axisStartTs = actualAxisStart;
      const xAt = (ts) => padLeft + ((ts - axisStartTs) / xSpan) * chartW;
      const yAt = (value) => padTop + (1 - ((value - yMin) / ySpan)) * chartH;

      const pathD = usePoints.map((point, index) => {
        const x = xAt(new Date(point.timestamp).getTime()).toFixed(2);
        const y = yAt(point.value).toFixed(2);
        return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
      }).join(' ');

      const latest = usePoints.length ? usePoints[usePoints.length - 1] : null;
      const latestX = latest ? xAt(new Date(latest.timestamp).getTime()).toFixed(2) : '0';
      const latestY = latest ? yAt(latest.value).toFixed(2) : '0';
      const bandTop = yAt(high).toFixed(2);
      const bandHeight = Math.max(1, yAt(low) - yAt(high)).toFixed(2);

      const yTicks = [yMin, yMin + ySpan * 0.33, yMin + ySpan * 0.66, yMax].map((value) => Math.round(value));
      const yGrid = yTicks.map((value) => {
        const y = yAt(value).toFixed(2);
        return `
            <line x1="${padLeft}" y1="${y}" x2="${(width - padRight).toFixed(2)}" y2="${y}" class="health-grid-line" style="stroke-width:${gridStrokeWidth}px;"></line>
            <text x="${(padLeft + 1.5).toFixed(2)}" y="${(yAt(value) - Math.max(6, axisFontSizeY * 0.45)).toFixed(2)}" text-anchor="start" dominant-baseline="auto" class="health-axis-label health-axis-label-y" style="font-size:${axisFontSizeY}px;font-weight:400;opacity:0.72;">${formatGlucoseMmol(value)}</text>
        `;
      }).join('');

      const tickCount = isMobileChart ? 4 : 6;
      const formatTickLabel = (ts, withSeconds = false) => (
        new Date(ts).toLocaleTimeString(
          'zh-CN',
          withSeconds
            ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
            : { hour: '2-digit', minute: '2-digit', hour12: false }
        )
      );
      const tickItems = Array.from({ length: tickCount + 1 }, (_, index) => {
        const ratio = index / tickCount;
        const ts = axisStartTs + Math.round(xSpan * ratio);
        return { ts, x: padLeft + chartW * ratio };
      });
      let labels = tickItems.map((item) => formatTickLabel(item.ts, xSpan < (60 * 60 * 1000)));
      if ((new Set(labels)).size < labels.length) labels = tickItems.map((item) => formatTickLabel(item.ts, true));
      const seenLabel = new Set();
      labels = labels.map((label) => {
        if (seenLabel.has(label)) return '';
        seenLabel.add(label);
        return label;
      });
      const xTicks = tickItems.map((item, index) => {
        const x = item.x;
        const label = labels[index] || '';
        return `
            <line x1="${x.toFixed(2)}" y1="${(height - padBottom).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(height - padBottom + 3).toFixed(2)}" class="health-grid-line" style="stroke-width:${gridStrokeWidth}px;"></line>
            <text x="${x.toFixed(2)}" y="${(height - padBottom + Math.max(10, axisFontSizeX * 0.9)).toFixed(2)}" text-anchor="middle" dominant-baseline="hanging" class="health-axis-label health-axis-label-x" style="font-size:${axisFontSizeX}px;font-weight:400;opacity:0.72;">${label}</text>
        `;
      }).join('');

      return `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="health-glucose-chart-svg w-full h-auto overflow-visible" role="img" aria-label="血糖曲线图">
            <rect x="${padLeft}" y="${bandTop}" width="${chartW}" height="${bandHeight}" class="health-target-band"></rect>
            ${yGrid}
            ${xTicks}
            <path d="${pathD}" class="health-line-path" style="stroke-width:${lineStrokeWidth}px;"></path>
            ${latest ? `<circle cx="${latestX}" cy="${latestY}" r="${pointRadius}" class="health-point-dot" style="stroke-width:${pointStrokeWidth}px;"></circle>` : ''}
        </svg>
    `;
    }

    function buildGlucoseSummaryRows(points = [], mode = 'day', options = {}) {
      const safePoints = normalizeGlucoseHistorySeries(points);
      const targetLow = Number.isFinite(Number(options?.targetLow)) ? Number(options.targetLow) : 70;
      const targetHigh = Number.isFinite(Number(options?.targetHigh)) ? Number(options.targetHigh) : 180;
      const groups = new Map();
      safePoints.forEach((point) => {
        const date = new Date(point.timestamp);
        if (Number.isNaN(date.getTime())) return;
        const key = formatGlucoseDateKey(date, mode);
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            values: [],
            first: point.timestamp,
            last: point.timestamp,
          });
        }
        const bucket = groups.get(key);
        bucket.values.push(Number(point.value || 0));
        if (String(point.timestamp || '') < String(bucket.first || '')) bucket.first = point.timestamp;
        if (String(point.timestamp || '') > String(bucket.last || '')) bucket.last = point.timestamp;
      });
      return Array.from(groups.values())
        .sort((a, b) => String(a.key).localeCompare(String(b.key)))
        .map((group) => {
          const values = group.values.filter((value) => Number.isFinite(value));
          const total = values.reduce((sum, value) => sum + value, 0);
          const average = values.length ? total / values.length : 0;
          const min = values.length ? Math.min(...values) : 0;
          const max = values.length ? Math.max(...values) : 0;
          const inRangeCount = values.filter((value) => value >= targetLow && value <= targetHigh).length;
          return [
            group.key,
            values.length,
            Math.round(min || 0),
            Math.round(max || 0),
            formatExpenseLedgerAmount(average),
            formatGlucoseMmol(average),
            values.length ? `${Math.round((inRangeCount / values.length) * 100)}%` : '0%',
            group.first || '',
            group.last || '',
          ];
        });
    }

    function buildGlucosePromptFromPayload(payload = {}) {
      const reading = payload?.reading;
      if (!reading || !Number.isFinite(Number(reading.value))) return '';
      const value = Number(reading.value);
      const valueMmol = formatGlucoseMmol(value);
      const timeText = reading.timestamp ? new Date(reading.timestamp).toLocaleString('zh-CN') : '未知时间';
      const trend = String(reading.trend || 'Flat');
      const targetLow = Number.isFinite(Number(reading.targetLow)) ? Number(reading.targetLow) : 70;
      const targetHigh = Number.isFinite(Number(reading.targetHigh)) ? Number(reading.targetHigh) : 180;
      const targetRangeMmol = formatGlucoseTargetRangeMmol(targetLow, targetHigh);
      const status = reading.isLow ? '偏低' : reading.isHigh ? '偏高' : '目标范围内';
      const series = mergeGlucoseArchive(
        normalizeGlucoseHistorySeries(Array.isArray(payload?.archive) ? payload.archive : []),
        normalizeGlucoseHistorySeries(Array.isArray(payload?.series) ? payload.series : [])
      );
      let seriesSummary = '';
      if (series.length > 1) {
        const values = series.map((p) => Number(p.value)).filter((v) => Number.isFinite(v));
        const minV = values.length ? Math.min(...values) : value;
        const maxV = values.length ? Math.max(...values) : value;
        const avgV = values.length ? (values.reduce((sum, v) => sum + v, 0) / values.length) : value;
        const startText = series[0]?.timestamp ? new Date(series[0].timestamp).toLocaleString('zh-CN') : '未知';
        const endText = series[series.length - 1]?.timestamp ? new Date(series[series.length - 1].timestamp).toLocaleString('zh-CN') : '未知';
        const recentSeries = series.slice(-8).map((p) => {
          const t = p.timestamp ? new Date(p.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
          return `${t}=${formatGlucoseMmol(p.value)}`;
        }).join('，');
        seriesSummary = [
          `- 历史序列: 共 ${series.length} 个点，时间范围 ${startText} 至 ${endText}`,
          `- 序列统计: 最低 ${formatGlucoseMmol(minV)} / 最高 ${formatGlucoseMmol(maxV)} / 均值 ${formatGlucoseMmol(avgV)} mmol/L`,
          `- 最近点序列 (mmol/L): ${recentSeries}`,
        ].join('\n');
      }
      return [
        '实时血糖上下文（来自 Morpheus 同步数据）:',
        `- 当前血糖: ${valueMmol} mmol/L（${status}，目标 ${targetRangeMmol}）`,
        `- 趋势: ${trend}`,
        `- 读数时间: ${timeText}`,
        seriesSummary,
      ].join('\n');
    }

    function isGlucoseQuestion(question = '') {
      return /血糖|低血糖|高血糖|CGM|连续血糖|mg\/dL|mmol\/L|控糖|glucose/i.test(String(question || ''));
    }

    function extractArchiveSeries() {
      const data = typeof api.getData === 'function' ? api.getData() : null;
      const archiveSeries = normalizeGlucoseHistorySeries(getLocalGlucoseArchive(data));
      const synced = extractSyncedGlucoseBundle(data);
      const syncedSeries = normalizeGlucoseHistorySeries(synced?.series || []);
      return {
        data,
        archiveSeries,
        synced,
        syncedSeries,
      };
    }

    function persistCanonicalGlucoseSync(payload = {}) {
      const next = buildCanonicalGlucoseSyncBundle(payload);
      if (!next.reading && (!Array.isArray(next.series) || !next.series.length)) return;
      const data = typeof api.getData === 'function' ? api.getData() : null;
      if (!data || typeof data !== 'object') return;
      const prev = buildCanonicalGlucoseSyncBundle(data.glucoseSync || {});
      const mergedSeries = mergeGlucoseSeries(prev.series || [], next.series || []);
      const nextReading = normalizeGlucosePoint(next.reading || null);
      const prevReading = normalizeGlucosePoint(prev.reading || null);
      const mergedReading = (() => {
        if (nextReading && prevReading) {
          const nextTs = new Date(nextReading.timestamp).getTime();
          const prevTs = new Date(prevReading.timestamp).getTime();
          return nextTs >= prevTs ? nextReading : prevReading;
        }
        return nextReading || prevReading || (mergedSeries.length ? mergedSeries[mergedSeries.length - 1] : null);
      })();
      const localArchive = getLocalGlucoseArchive(data);
      const explicitArchive = normalizeGlucoseHistorySeries(Array.isArray(payload?.archive) ? payload.archive : []);
      const prevArchive = explicitArchive.length
        ? mergeGlucoseArchive(localArchive, explicitArchive)
        : localArchive;
      const archiveSeed = [
        ...mergedSeries,
        ...(mergedReading ? [mergedReading] : []),
      ];
      const mergedArchive = mergeGlucoseArchive(prevArchive, archiveSeed);
      const finalNext = {
        reading: mergedReading ? {
          ...mergedReading,
          targetLow: Number.isFinite(Number(next?.range?.targetLow ?? next?.targetLow))
            ? Number(next.range?.targetLow ?? next.targetLow)
            : Number(prev?.range?.targetLow ?? prev?.targetLow ?? mergedReading.targetLow ?? 70),
          targetHigh: Number.isFinite(Number(next?.range?.targetHigh ?? next?.targetHigh))
            ? Number(next.range?.targetHigh ?? next.targetHigh)
            : Number(prev?.range?.targetHigh ?? prev?.targetHigh ?? mergedReading.targetHigh ?? 180),
        } : null,
        series: mergedSeries,
        range: {
          targetLow: Number.isFinite(Number(next?.range?.targetLow ?? next?.targetLow))
            ? Number(next.range?.targetLow ?? next.targetLow)
            : Number(prev?.range?.targetLow ?? prev?.targetLow ?? 70),
          targetHigh: Number.isFinite(Number(next?.range?.targetHigh ?? next?.targetHigh))
            ? Number(next.range?.targetHigh ?? next.targetHigh)
            : Number(prev?.range?.targetHigh ?? prev?.targetHigh ?? 180),
        },
        updatedAt: String(next.updatedAt || prev.updatedAt || '').trim(),
        series: mergedArchive.slice(-500),
      };
      const prevArchiveSerialized = JSON.stringify(prevArchive);
      const nextArchiveSerialized = JSON.stringify(mergedArchive);
      if (JSON.stringify(prev) === JSON.stringify(finalNext) && prevArchiveSerialized === nextArchiveSerialized) return;
      data.glucoseSync = finalNext;
      data.glucoseHistoryArchive = mergedArchive;
      if (typeof api.syncGlucoseUserFacingFiles === 'function') {
        api.syncGlucoseUserFacingFiles({
          ...finalNext,
          archive: mergedArchive,
          targetLow: Number(finalNext?.range?.targetLow ?? finalNext?.reading?.targetLow ?? 70),
          targetHigh: Number(finalNext?.range?.targetHigh ?? finalNext?.reading?.targetHigh ?? 180),
        });
      }
      if (typeof api.saveSilent === 'function') {
        api.saveSilent({ skipUndo: true, forceDebounce: true });
      }
    }

    async function hydrateGlucoseSyncFromLocalApiOnce({ force = false } = {}) {
      if (!canUseFeature()) return false;
      if (typeof api.isIOSNativeAppRuntime === 'function' && api.isIOSNativeAppRuntime()) {
        return hydrateGlucoseSyncFromNativeOnce({ force });
      }
      const syncState = getGlucoseSyncHydrationState();
      if (syncState.inFlight) return false;
      syncState.inFlight = true;
      try {
        const { data } = extractArchiveSeries();
        if (!force && hasFreshSyncedGlucoseReading(data)) return true;
        const query = force ? `refresh=1&t=${Date.now()}` : `t=${Date.now()}`;
        const fetchLocalApi = typeof api.fetchLocalApiWithFallback === 'function'
          ? api.fetchLocalApiWithFallback
          : (url, options) => fetch(url, options);
        const res = await fetchLocalApi(`/api/glucose/latest?${query}`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!json?.ok || !json?.reading) return false;
        const reading = normalizeGlucosePoint(json.reading);
        if (!reading) return false;
        persistCanonicalGlucoseSync({
          reading: {
            ...reading,
            targetLow: Number(json?.reading?.targetLow || 70),
            targetHigh: Number(json?.reading?.targetHigh || 180),
          },
          series: [reading],
          targetLow: Number(json?.reading?.targetLow || 70),
          targetHigh: Number(json?.reading?.targetHigh || 180),
          updatedAt: String(json?.fetchedAt || new Date().toISOString()),
        });
        return true;
      } catch (_) {
        return false;
      } finally {
        syncState.inFlight = false;
      }
    }

    async function hydrateGlucoseSyncFromNativeOnce({ force = false } = {}) {
      if (!canUseFeature()) return false;
      if (!(typeof api.isIOSNativeAppRuntime === 'function' ? api.isIOSNativeAppRuntime() : false)) return false;
      const syncState = getGlucoseSyncHydrationState();
      if (syncState.inFlight) return false;
      syncState.inFlight = true;
      try {
        if (!api.storage || typeof api.storage.callNativeDesktopControl !== 'function') return false;
        const native = await api.storage.callNativeDesktopControl('fetchGlucoseHistory', {
          force: !!force,
          hours: 24,
        });
        if (!native?.reading) return false;
        const reading = normalizeGlucosePoint(native.reading);
        if (!reading) return false;
        const nativeSeries = normalizeGlucoseHistorySeries(Array.isArray(native?.series) ? native.series : []);
        const { data, archiveSeries } = extractArchiveSeries();
        const mergedSeries = mergeGlucoseSeries(archiveSeries, nativeSeries.length ? nativeSeries : [reading]);
        persistCanonicalGlucoseSync({
          reading: {
            ...reading,
            targetLow: Number(native?.range?.targetLow || native?.reading?.targetLow || 70),
            targetHigh: Number(native?.range?.targetHigh || native?.reading?.targetHigh || 180),
          },
          series: mergedSeries.length ? mergedSeries : [reading],
          archive: archiveSeries,
          targetLow: Number(native?.range?.targetLow || native?.reading?.targetLow || 70),
          targetHigh: Number(native?.range?.targetHigh || native?.reading?.targetHigh || 180),
          updatedAt: String(native?.fetchedAt || new Date().toISOString()),
        });
        return true;
      } catch (_) {
        return false;
      } finally {
        syncState.inFlight = false;
      }
    }

    function restartGlucoseSyncHydrationScheduler() {
      clearGlucoseSyncHydrationTimer();
      if (!canUseFeature()) return;
      const refreshOnce = () => {
        if (typeof api.isIOSNativeAppRuntime === 'function' && api.isIOSNativeAppRuntime()) {
          hydrateGlucoseSyncFromNativeOnce({ force: true });
          return;
        }
        hydrateGlucoseSyncFromLocalApiOnce({ force: true });
      };
      if (typeof api.isIOSNativeAppRuntime === 'function' && api.isIOSNativeAppRuntime()) {
        hydrateGlucoseSyncFromNativeOnce({ force: false });
      } else {
        hydrateGlucoseSyncFromLocalApiOnce({ force: false });
      }
      const syncState = getGlucoseSyncHydrationState();
      if (typeof setInterval !== 'function') {
        syncState.timer = null;
        return;
      }
      syncState.timer = setInterval(() => {
        refreshOnce();
      }, 2 * 60 * 1000);
    }

    function stopGlucoseHealthAutoRefresh() {
      const historyState = getGlucoseHistoryState();
      if (!historyState.refreshTimer) return;
      if (typeof clearInterval === 'function') clearInterval(historyState.refreshTimer);
      historyState.refreshTimer = null;
    }

    function startGlucoseHealthAutoRefresh() {
      stopGlucoseHealthAutoRefresh();
      const historyState = getGlucoseHistoryState();
      if (typeof setInterval !== 'function') {
        historyState.refreshTimer = null;
        return;
      }
      historyState.refreshTimer = setInterval(() => {
        if (typeof api.getCurrentTab === 'function' && api.getCurrentTab() !== 'health') return;
        if (typeof api.fetchGlucoseHistoryForHealth === 'function') {
          api.fetchGlucoseHistoryForHealth({ force: true, silent: true });
          return;
        }
        fetchGlucoseHistoryForHealth({ force: true, silent: true });
      }, 60 * 1000);
    }

    function applyToggle(nextValue) {
      if (typeof api.clearGlucoseContextCache === 'function') {
        api.clearGlucoseContextCache();
      }
      clearGlucoseContextCache();
      if (nextValue) {
        restartGlucoseSyncHydrationScheduler();
        if (typeof api.getCurrentTab === 'function' && api.getCurrentTab() === 'health') {
          if (typeof api.fetchGlucoseHistoryForHealth === 'function') {
            api.fetchGlucoseHistoryForHealth({ force: false, silent: true });
          } else {
            fetchGlucoseHistoryForHealth({ force: false, silent: true });
          }
        }
        clearGlucoseContextCache();
        return { redirected: false };
      }
      stopGlucoseHealthAutoRefresh();
      clearGlucoseSyncHydrationTimer();
      let redirected = false;
      if (typeof api.getCurrentTab === 'function' && api.getCurrentTab() === 'health') {
        const hasAppleHealth = typeof api.canUseAppleHealthExtensionFeatures === 'function'
          ? api.canUseAppleHealthExtensionFeatures() === true
          : false;
        if (hasAppleHealth) {
          if (typeof api.setHealthViewPane === 'function') api.setHealthViewPane('apple-health');
          if (typeof api.syncHealthViewComposition === 'function') api.syncHealthViewComposition();
        } else if (typeof api.switchTab === 'function') {
          api.switchTab('extensions', true);
          redirected = true;
        }
      }
      return { redirected };
    }

    function applyGlucoseHistoryFromApiPayload(json) {
      const historyState = getGlucoseHistoryState();
      historyState.error = '';
      historyState.updatedAt = json?.fetchedAt || new Date().toISOString();
      historyState.series = normalizeGlucoseHistorySeries(json?.series || []);
      historyState.reading = json?.reading || historyState.series[historyState.series.length - 1] || null;
      historyState.targetLow = Number.isFinite(Number(json?.range?.targetLow))
        ? Number(json.range.targetLow)
        : Number(historyState.reading?.targetLow || 70);
      historyState.targetHigh = Number.isFinite(Number(json?.range?.targetHigh))
        ? Number(json.range.targetHigh)
        : Number(historyState.reading?.targetHigh || 180);
      historyState.source = '本地服务';
      persistCanonicalGlucoseSync({
        reading: historyState.reading,
        series: historyState.series,
        archive: getLocalGlucoseArchive(api.getData ? api.getData() : null),
        targetLow: historyState.targetLow,
        targetHigh: historyState.targetHigh,
        updatedAt: historyState.updatedAt,
      });
      return historyState;
    }

    async function fetchGlucoseHistoryForHealth({ force = false, silent = false } = {}) {
      if (!canUseFeature()) return;
      const historyState = getGlucoseHistoryState();
      if (historyState.loading) return;
      try {
        historyState.loading = true;
        if (!silent && typeof api.getCurrentTab === 'function' && api.getCurrentTab() === 'health' && typeof api.renderGlucoseHealthView === 'function') {
          api.renderGlucoseHealthView();
        }
        const data = typeof api.getData === 'function' ? api.getData() : null;
        const synced = extractSyncedGlucoseBundle(data);

        const fetchLocalApi = typeof api.fetchLocalApiWithFallback === 'function'
          ? api.fetchLocalApiWithFallback
          : (url, options) => fetch(url, options);
        const url = `/api/glucose/history?hours=24${force ? '&refresh=1' : ''}&t=${Date.now()}`;
        const res = await fetchLocalApi(url, { cache: 'no-store' });
        const json = await res.json().catch(() => null);

        if (json?.ok) {
          applyGlucoseHistoryFromApiPayload(json);
          return;
        }

        const missingHistoryRoute = !json?.ok && /api route not found|route not found/i.test(String(json?.error || json?.message || ''));
        if (!json?.ok && !missingHistoryRoute) {
          const syncedForFallback = extractSyncedGlucoseBundle(data);
          const archiveForFallback = getLocalGlucoseArchive(data);
          const syncedSeriesForFallback = normalizeGlucoseHistorySeries(syncedForFallback?.series || []);
          const mergedForFallback = mergeGlucoseArchive(archiveForFallback, syncedSeriesForFallback);
          if (mergedForFallback.length > 1) {
            historyState.error = '';
            historyState.updatedAt = syncedForFallback?.updatedAt || new Date().toISOString();
            historyState.series = mergedForFallback;
            historyState.reading = syncedForFallback?.reading || historyState.series[historyState.series.length - 1] || null;
            historyState.targetLow = Number(syncedForFallback?.targetLow || historyState.reading?.targetLow || 70);
            historyState.targetHigh = Number(syncedForFallback?.targetHigh || historyState.reading?.targetHigh || 180);
            historyState.source = '同步数据';
            persistCanonicalGlucoseSync({
              reading: historyState.reading,
              series: historyState.series,
              archive: archiveForFallback,
              targetLow: historyState.targetLow,
              targetHigh: historyState.targetHigh,
              updatedAt: historyState.updatedAt,
            });
            return;
          }
          throw new Error(json?.message || json?.error || '读取血糖曲线失败');
        }

        const latestQuery = force ? `refresh=1&t=${Date.now()}` : `t=${Date.now()}`;
        const latestUrl = `/api/glucose/latest?${latestQuery}`;
        const latestRes = await fetchLocalApi(latestUrl, { cache: 'no-store' });
        const latestJson = await latestRes.json().catch(() => null);
        if (!latestJson?.ok || !latestJson?.reading) {
          throw new Error(latestJson?.message || latestJson?.error || '读取当前血糖失败');
        }
        const latestReading = normalizeGlucosePoint(latestJson.reading);
        if (!latestReading) throw new Error('当前血糖数据格式无效');
        historyState.error = '';
        historyState.updatedAt = latestJson?.fetchedAt || new Date().toISOString();
        historyState.series = mergeGlucoseSeries(historyState.series || [], [latestReading]);
        historyState.reading = {
          ...latestReading,
          targetLow: Number(latestJson?.reading?.targetLow || 70),
          targetHigh: Number(latestJson?.reading?.targetHigh || 180),
        };
        historyState.targetLow = Number(historyState.reading.targetLow || 70);
        historyState.targetHigh = Number(historyState.reading.targetHigh || 180);
        historyState.source = '本地服务(实时值)';
        persistCanonicalGlucoseSync({
          reading: historyState.reading,
          series: historyState.series,
          archive: getLocalGlucoseArchive(data),
          targetLow: historyState.targetLow,
          targetHigh: historyState.targetHigh,
          updatedAt: historyState.updatedAt,
        });
      } catch (error) {
        const data = typeof api.getData === 'function' ? api.getData() : null;
        const synced = extractSyncedGlucoseBundle(data);
        if (synced) {
          const localArchive = getLocalGlucoseArchive(data);
          const syncedSeries = normalizeGlucoseHistorySeries(synced.series || []);
          const fullSeries = mergeGlucoseArchive(localArchive, syncedSeries);
          historyState.error = '';
          historyState.updatedAt = synced.updatedAt || new Date().toISOString();
          historyState.series = fullSeries.length ? fullSeries : syncedSeries;
          historyState.reading = synced.reading || historyState.series[historyState.series.length - 1] || null;
          historyState.targetLow = Number(synced.targetLow || historyState.reading?.targetLow || 70);
          historyState.targetHigh = Number(synced.targetHigh || historyState.reading?.targetHigh || 180);
          historyState.source = '同步数据';
          persistCanonicalGlucoseSync({
            reading: historyState.reading,
            series: historyState.series,
            archive: localArchive,
            targetLow: historyState.targetLow,
            targetHigh: historyState.targetHigh,
            updatedAt: historyState.updatedAt,
          });
        } else {
          historyState.error = sanitizeGlucoseErrorMessage(error?.message || '读取血糖曲线失败');
          historyState.source = '';
        }
      } finally {
        historyState.loading = false;
        if (typeof api.getCurrentTab === 'function' && api.getCurrentTab() === 'health' && typeof api.renderGlucoseHealthView === 'function') {
          api.renderGlucoseHealthView();
        }
      }
    }

    async function fetchLiveGlucosePromptContext(question = '') {
      if (!canUseFeature()) return '';
      const runtimeState = getGlucoseRuntimeState();
      const now = Date.now();
      if (runtimeState?.contextCache && (now - runtimeState.contextCache.at) < 60 * 1000) {
        if (runtimeState.contextCache.prompt) return runtimeState.contextCache.prompt;
        if (isGlucoseQuestion(question)) return runtimeState.contextCache.fallback || '';
        return '';
      }
      const data = typeof api.getData === 'function' ? api.getData() : null;
      const localArchive = getLocalGlucoseArchive(data);
        const synced = extractSyncedGlucoseBundle(data);
      const fetchLocalApi = typeof api.fetchLocalApiWithFallback === 'function'
        ? api.fetchLocalApiWithFallback
        : (url, options) => fetch(url, options);
      if (typeof api.isIOSNativeAppRuntime === 'function' && api.isIOSNativeAppRuntime()) {
        try {
          if (!api.storage || typeof api.storage.callNativeDesktopControl !== 'function') {
            const fallback = 'iOS 端当前未获取到实时血糖数据。';
            runtimeState.contextCache = { at: Date.now(), prompt: '', fallback };
            return isGlucoseQuestion(question) ? fallback : '';
          }
          const native = await api.storage.callNativeDesktopControl('fetchGlucoseHistory', {
            force: true,
            hours: 24,
          });
          const reading = native?.reading ? {
            ...native.reading,
            targetLow: Number(native?.range?.targetLow || native?.reading?.targetLow || 70),
            targetHigh: Number(native?.range?.targetHigh || native?.reading?.targetHigh || 180),
          } : null;
          const prompt = reading ? buildGlucosePromptFromPayload({
            reading,
            series: Array.isArray(native?.series) ? native.series : [],
            archive: localArchive,
          }) : '';
          const fallback = 'iOS 端当前未获取到实时血糖数据。';
          runtimeState.contextCache = { at: Date.now(), prompt, fallback };
          if (prompt) {
            persistCanonicalGlucoseSync({
              reading: normalizeGlucosePoint(reading),
              series: Array.isArray(native?.series) ? native.series : [],
              archive: localArchive,
              targetLow: Number(reading?.targetLow || 70),
              targetHigh: Number(reading?.targetHigh || 180),
              updatedAt: String(native?.fetchedAt || new Date().toISOString()),
            });
            return prompt;
          }
          return isGlucoseQuestion(question) ? fallback : '';
        } catch (_) {
          const prompt = synced?.reading ? buildGlucosePromptFromPayload({
            reading: {
              ...synced.reading,
              targetLow: synced.targetLow,
              targetHigh: synced.targetHigh,
            },
            series: synced.series || [],
            archive: synced.archive || localArchive,
          }) : '';
          const fallback = '当前未检测到 iOS 同步过来的血糖数据。';
          runtimeState.contextCache = { at: Date.now(), prompt, fallback };
          if (prompt) return prompt;
          return isGlucoseQuestion(question) ? fallback : '';
        }
      }
      try {
        let json = null;
        try {
          const historyRes = await fetchLocalApi(`/api/glucose/history?hours=24&t=${Date.now()}`, { cache: 'no-store' });
          const historyJson = await historyRes.json().catch(() => null);
          if (historyJson?.ok && historyJson?.reading) json = historyJson;
        } catch (_) {}
        if (!json) {
          const latestRes = await fetchLocalApi(`/api/glucose/latest?t=${Date.now()}`, { cache: 'no-store' });
          json = await latestRes.json().catch(() => null);
        }
        const prompt = buildGlucosePromptFromPayload({
          ...(json || {}),
          archive: localArchive,
        });
        if (json?.ok && json?.reading) {
          const normalizedReading = normalizeGlucosePoint(json.reading);
          const normalizedSeries = normalizeGlucoseHistorySeries(Array.isArray(json?.series) ? json.series : []);
          if (normalizedReading) {
            persistCanonicalGlucoseSync({
              reading: {
                ...normalizedReading,
                targetLow: Number(json?.reading?.targetLow || 70),
                targetHigh: Number(json?.reading?.targetHigh || 180),
              },
              series: normalizedSeries.length ? normalizedSeries : [normalizedReading],
              archive: localArchive,
              targetLow: Number(json?.reading?.targetLow || 70),
              targetHigh: Number(json?.reading?.targetHigh || 180),
              updatedAt: String(json?.fetchedAt || new Date().toISOString()),
            });
          }
        } else if (synced?.reading) {
          const syncPrompt = buildGlucosePromptFromPayload({
            reading: {
              ...synced.reading,
              targetLow: synced.targetLow,
              targetHigh: synced.targetHigh,
            },
            series: synced.series || [],
            archive: synced.archive || localArchive,
          });
          const fallback = '实时血糖接口当前不可用，已改用最近同步数据。';
          runtimeState.contextCache = { at: Date.now(), prompt: syncPrompt, fallback };
          if (syncPrompt) return syncPrompt;
          return isGlucoseQuestion(question) ? fallback : '';
        }
        const fallback = '实时血糖数据当前不可用（可能未配置 LibreLink 凭据或依赖未安装）。若用户询问血糖，请先明确说明当前不可读取实时值。';
        runtimeState.contextCache = {
          at: Date.now(),
          prompt,
          fallback,
        };
        if (prompt) return prompt;
        return isGlucoseQuestion(question) ? fallback : '';
      } catch (_) {
        const fallback = '实时血糖数据接口访问失败。若用户询问血糖，请先说明当前无法获取实时值。';
        runtimeState.contextCache = {
          at: Date.now(),
          prompt: '',
          fallback,
        };
        return isGlucoseQuestion(question) ? fallback : '';
      }
    }

    function buildGlucoseWorkspaceMarkup() {
      const historyState = getGlucoseHistoryState();
      const data = typeof api.getData === 'function' ? api.getData() : null;
      const reading = historyState.reading;
      const mmol = Number.isFinite(Number(reading?.value)) ? formatGlucoseMmol(reading.value) : '--';
      const mgdl = Number.isFinite(Number(reading?.value)) ? String(Math.round(Number(reading.value))) : '--';
      const trend = formatGlucoseTrendLabel(reading?.trend);
      const time = formatGlucoseTime(reading?.timestamp);
      const archiveSeries = normalizeGlucoseHistorySeries(getLocalGlucoseArchive(data));
      const syncedSeries = normalizeGlucoseHistorySeries(extractSyncedGlucoseBundle(data)?.series || []);
      const stateSeries = normalizeGlucoseHistorySeries(historyState.series || []);
      const mergedArchiveAndState = mergeGlucoseArchive(archiveSeries, stateSeries);
      const mergedAll = mergeGlucoseArchive(mergedArchiveAndState, syncedSeries);
      const chartSeries = mergedAll.length ? mergedAll : stateSeries;
      const escapeHTML = typeof api.escapeHTML === 'function'
        ? api.escapeHTML
        : (value) => String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      return `
        <div class="grid grid-cols-1 gap-3">
            <div class="health-canvas-panel px-4 py-4 sm:px-5">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">当前血糖读数</div>
                        <div class="mt-2 flex items-end gap-3">
                            <div class="text-[28px] leading-none font-semibold tracking-tight text-gray-900 dark:text-white/92 tabular-nums">${escapeHTML(mmol)}</div>
                            <div class="pb-0.5 text-[12px] text-gray-500 dark:text-white/45">mmol/L</div>
                        </div>
                    </div>
                    <div class="text-[12px] leading-6 text-gray-500 dark:text-white/45">最近更新时间：${escapeHTML(time)}</div>
                </div>
                <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div class="rounded-[0.95rem] border border-gray-200 dark:border-white/10 px-3 py-3 bg-white/72 dark:bg-white/[0.03]">
                        <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">mg/dL</div>
                        <div class="mt-1 text-[20px] font-semibold leading-none tabular-nums text-gray-900 dark:text-white/90">${escapeHTML(mgdl)}</div>
                    </div>
                    <div class="rounded-[0.95rem] border border-gray-200 dark:border-white/10 px-3 py-3 bg-white/72 dark:bg-white/[0.03]">
                        <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">趋势</div>
                        <div class="mt-1 text-[16px] font-medium leading-6 text-gray-900 dark:text-white/90">${escapeHTML(trend)}</div>
                    </div>
                    <div class="rounded-[0.95rem] border border-gray-200 dark:border-white/10 px-3 py-3 bg-white/72 dark:bg-white/[0.03] col-span-2 sm:col-span-1">
                        <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">状态</div>
                        <div class="mt-1 text-[16px] font-medium leading-6 text-gray-900 dark:text-white/90">${Number.isFinite(Number(reading?.value)) ? '已同步' : '暂无读数'}</div>
                    </div>
                </div>
            </div>

            <div class="health-canvas-panel px-4 py-4 sm:px-5">
                <div class="text-[10px] font-mono text-gray-500 dark:text-white/45">24 小时血糖曲线</div>
                <div class="mt-3 health-chart-status text-[12px] leading-6 text-gray-500 dark:text-white/45">${buildGlucoseChartMetaMarkup({
                  targetLow: historyState.targetLow,
                  targetHigh: historyState.targetHigh,
                  updatedAt: historyState.updatedAt,
                  source: historyState.source,
                })}</div>
                <div class="mt-4 overflow-hidden rounded-[1rem] border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] px-2 py-2 sm:px-3">${buildGlucoseChartSvg(chartSeries, {
                  targetLow: historyState.targetLow,
                  targetHigh: historyState.targetHigh,
                  viewportWidth: typeof window !== 'undefined' ? Math.max(320, Math.min(window.innerWidth - 40, 1600)) : 0,
                })}</div>
            </div>
        </div>
      `;
    }

    function renderGlucoseHealthView() {
      const doc = typeof api.document !== 'undefined' ? api.document : (typeof document !== 'undefined' ? document : null);
      if (!doc) return;
      const statusEl = doc.getElementById('health-status-text');
      const chartEl = doc.getElementById('health-chart-wrap');
      const mgdlEl = doc.getElementById('health-metric-mgdl');
      const mmolEl = doc.getElementById('health-metric-mmol');
      const trendEl = doc.getElementById('health-metric-trend');
      const timeEl = doc.getElementById('health-metric-time');
      if (!statusEl || !chartEl || !mgdlEl || !mmolEl || !trendEl || !timeEl) return;
      if (typeof api.syncHealthViewComposition === 'function') api.syncHealthViewComposition();
      if (!canUseFeature()) return;
      if (typeof api.syncGlucoseUserFacingFiles === 'function') api.syncGlucoseUserFacingFiles();

      const historyState = getGlucoseHistoryState();
      const reading = historyState.reading;
      mgdlEl.textContent = Number.isFinite(Number(reading?.value)) ? String(Math.round(Number(reading.value))) : '--';
      mmolEl.textContent = Number.isFinite(Number(reading?.value)) ? formatGlucoseMmol(reading.value) : '--';
      trendEl.textContent = formatGlucoseTrendLabel(reading?.trend);
      timeEl.textContent = formatGlucoseTime(reading?.timestamp);

      if (historyState.loading) {
        statusEl.innerHTML = buildGlucoseChartNoticeMarkup('正在读取血糖曲线...');
        statusEl.classList.remove('text-red-600', 'dark:text-red-400');
      } else if (historyState.error) {
        statusEl.innerHTML = buildGlucoseChartNoticeMarkup(historyState.error, 'error');
        statusEl.classList.add('text-red-600', 'dark:text-red-400');
      } else {
        statusEl.innerHTML = buildGlucoseChartMetaMarkup({
          targetLow: historyState.targetLow,
          targetHigh: historyState.targetHigh,
          updatedAt: historyState.updatedAt,
          source: historyState.source,
        });
        statusEl.classList.remove('text-red-600', 'dark:text-red-400');
      }

      const data = typeof api.getData === 'function' ? api.getData() : null;
      const archiveSeries = normalizeGlucoseHistorySeries(getLocalGlucoseArchive(data));
      const stateSeries = normalizeGlucoseHistorySeries(historyState.series || []);
      const syncedSeries = normalizeGlucoseHistorySeries(extractSyncedGlucoseBundle(data)?.series || []);
      const mergedArchiveAndState = mergeGlucoseArchive(archiveSeries, stateSeries);
      const mergedAll = mergeGlucoseArchive(mergedArchiveAndState, syncedSeries);
      const chartSeries = mergedAll.length ? mergedAll : stateSeries;
      chartEl.innerHTML = buildGlucoseChartSvg(chartSeries, {
        targetLow: historyState.targetLow,
        targetHigh: historyState.targetHigh,
        viewportWidth: chartEl.clientWidth || 0,
      });
      if (typeof api.renderHealthRelationshipFieldLab === 'function') api.renderHealthRelationshipFieldLab();
      if (typeof api.syncHealthViewComposition === 'function') api.syncHealthViewComposition();
    }

    return {
      hasExistingFootprint,
      canUseFeature,
      mergeGlucoseSeries,
      mergeGlucoseArchive,
      getLocalGlucoseArchive,
      extractSyncedGlucoseBundle,
      hasFreshSyncedGlucoseReading,
      buildCanonicalGlucoseSyncBundle,
      persistCanonicalGlucoseSync,
      hydrateGlucoseSyncFromLocalApiOnce,
      hydrateGlucoseSyncFromNativeOnce,
      applyToggle,
      clearGlucoseContextCache,
      clearGlucoseSyncHydrationTimer,
      restartGlucoseSyncHydrationScheduler,
      startGlucoseHealthAutoRefresh,
      stopGlucoseHealthAutoRefresh,
      applyGlucoseHistoryFromApiPayload,
      fetchGlucoseHistoryForHealth,
      fetchLiveGlucosePromptContext,
      buildGlucoseChartSvg,
      buildGlucoseSummaryRows,
      buildGlucoseWorkspaceMarkup,
      renderGlucoseHealthView,
    };
  }

  window.MorphGlucoseExtensionRuntime = {
    create: createGlucoseExtensionRuntime,
  };
})();
