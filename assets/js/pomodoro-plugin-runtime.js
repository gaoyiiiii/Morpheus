(function initMorphPomodoroPluginRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphPomodoroPluginRuntime && typeof window.MorphPomodoroPluginRuntime.create === 'function') return;

  const PLUGIN_ID = 'pomodoro-plugin';
  const DEFAULT_SUMMARY = '专注/休息节奏计时器，记录番茄状态与最近完成统计';
  const MAX_HISTORY = 40;
  const PHASE_LABELS = {
    focus: '专注',
    'short-break': '短休息',
    'long-break': '长休息',
  };
  const STATUS_LABELS = {
    idle: '待开始',
    running: '进行中',
    paused: '已暂停',
  };
  const DEFAULT_STATE = {
    phase: 'focus',
    status: 'idle',
    focusDurationMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakInterval: 4,
    autoStartBreaks: false,
    autoStartFocus: false,
    soundEnabled: true,
    remainingSeconds: 25 * 60,
    deadline: null,
    currentTaskLabel: '',
    focusesSinceLongBreak: 0,
    completedFocusCount: 0,
    totalFocusSeconds: 0,
    lastCompletedAt: '',
    history: [],
    summary: DEFAULT_SUMMARY,
    updatedAt: '',
  };

  const api = {};

  function cloneValue(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function clampInteger(value, min, max, fallback) {
    const next = Math.round(Number(value));
    if (!Number.isFinite(next)) return fallback;
    if (Number.isFinite(min) && next < min) return min;
    if (Number.isFinite(max) && next > max) return max;
    return next;
  }

  function nowMs() {
    if (typeof api.now === 'function') {
      const value = Number(api.now());
      if (Number.isFinite(value)) return value;
    }
    return Date.now();
  }

  function toIso(value) {
    try {
      const date = value ? new Date(value) : new Date();
      if (Number.isNaN(date.getTime())) return new Date().toISOString();
      return date.toISOString();
    } catch (_) {
      return new Date().toISOString();
    }
  }

  function createHistoryId() {
    return `pomodoro_${Math.random().toString(36).slice(2, 8)}_${nowMs().toString(36)}`;
  }

  function getDurationMinutes(state, phase) {
    if (phase === 'short-break') return clampInteger(state.shortBreakMinutes, 1, 60, DEFAULT_STATE.shortBreakMinutes);
    if (phase === 'long-break') return clampInteger(state.longBreakMinutes, 1, 90, DEFAULT_STATE.longBreakMinutes);
    return clampInteger(state.focusDurationMinutes, 1, 180, DEFAULT_STATE.focusDurationMinutes);
  }

  function getPlannedSeconds(state, phase) {
    return getDurationMinutes(state, phase) * 60;
  }

  function getPhaseLabel(phase = 'focus') {
    return PHASE_LABELS[phase] || PHASE_LABELS.focus;
  }

  function getStatusLabel(status = 'idle') {
    return STATUS_LABELS[status] || STATUS_LABELS.idle;
  }

  function formatClock(seconds = 0) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(safe / 60);
    const remainder = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  function getLocalDayKey(value = '') {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function buildTodayStats(history = []) {
    const todayKey = getLocalDayKey();
    const stats = {
      focusCount: 0,
      focusMinutes: 0,
      shortBreakCount: 0,
      longBreakCount: 0,
    };
    (Array.isArray(history) ? history : []).forEach((entry) => {
      if (!entry || entry.skipped === true || getLocalDayKey(entry.completedAt) !== todayKey) return;
      if (entry.phase === 'focus') {
        stats.focusCount += 1;
        stats.focusMinutes += Math.max(0, Math.round((Number(entry.actualSeconds) || Number(entry.plannedSeconds) || 0) / 60));
        return;
      }
      if (entry.phase === 'short-break') stats.shortBreakCount += 1;
      if (entry.phase === 'long-break') stats.longBreakCount += 1;
    });
    return stats;
  }

  function buildSummary(state = DEFAULT_STATE) {
    const today = buildTodayStats(state.history);
    const phaseLabel = getPhaseLabel(state.phase);
    const statusLabel = getStatusLabel(state.status);
    const clockText = state.status === 'running' || state.status === 'paused'
      ? `，剩余 ${formatClock(state.remainingSeconds)}`
      : '';
    const taskText = state.currentTaskLabel ? `，主题「${state.currentTaskLabel}」` : '';
    if (!today.focusCount) {
      return `${statusLabel} · 当前${phaseLabel}${clockText}${taskText}`;
    }
    return `${statusLabel} · 当前${phaseLabel}${clockText}${taskText}；今日完成 ${today.focusCount} 个番茄，累计专注 ${today.focusMinutes} 分钟`;
  }

  function normalizeHistory(rawList = []) {
    if (!Array.isArray(rawList)) return [];
    return rawList
      .map((entry) => {
        const item = entry && typeof entry === 'object' ? entry : null;
        if (!item) return null;
        const phase = item.phase === 'short-break' || item.phase === 'long-break' ? item.phase : item.phase === 'focus' ? 'focus' : '';
        if (!phase) return null;
        return {
          id: String(item.id || '').trim() || createHistoryId(),
          phase,
          label: String(item.label || '').trim(),
          plannedSeconds: clampInteger(item.plannedSeconds, 1, 60 * 60 * 4, getPlannedSeconds(DEFAULT_STATE, phase)),
          actualSeconds: clampInteger(item.actualSeconds, 0, 60 * 60 * 4, clampInteger(item.plannedSeconds, 1, 60 * 60 * 4, getPlannedSeconds(DEFAULT_STATE, phase))),
          completedAt: toIso(item.completedAt || ''),
          skipped: item.skipped === true,
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')))
      .slice(0, MAX_HISTORY);
  }

  function normalizeState(raw = null) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const phase = source.phase === 'short-break' || source.phase === 'long-break' ? source.phase : source.phase === 'focus' ? 'focus' : DEFAULT_STATE.phase;
    const focusDurationMinutes = clampInteger(source.focusDurationMinutes, 1, 180, DEFAULT_STATE.focusDurationMinutes);
    const shortBreakMinutes = clampInteger(source.shortBreakMinutes, 1, 60, DEFAULT_STATE.shortBreakMinutes);
    const longBreakMinutes = clampInteger(source.longBreakMinutes, 1, 90, DEFAULT_STATE.longBreakMinutes);
    const longBreakInterval = clampInteger(source.longBreakInterval, 2, 8, DEFAULT_STATE.longBreakInterval);
    const base = {
      phase,
      status: source.status === 'running' || source.status === 'paused' ? source.status : 'idle',
      focusDurationMinutes,
      shortBreakMinutes,
      longBreakMinutes,
      longBreakInterval,
      autoStartBreaks: source.autoStartBreaks === true,
      autoStartFocus: source.autoStartFocus === true,
      soundEnabled: source.soundEnabled !== false,
      remainingSeconds: clampInteger(source.remainingSeconds, 0, getPlannedSeconds({
        focusDurationMinutes,
        shortBreakMinutes,
        longBreakMinutes,
      }, phase), getPlannedSeconds({
        focusDurationMinutes,
        shortBreakMinutes,
        longBreakMinutes,
      }, phase)),
      deadline: Number.isFinite(Number(source.deadline)) ? Number(source.deadline) : null,
      currentTaskLabel: String(source.currentTaskLabel || '').trim().slice(0, 80),
      focusesSinceLongBreak: clampInteger(source.focusesSinceLongBreak, 0, longBreakInterval, DEFAULT_STATE.focusesSinceLongBreak),
      completedFocusCount: clampInteger(source.completedFocusCount, 0, 100000, DEFAULT_STATE.completedFocusCount),
      totalFocusSeconds: clampInteger(source.totalFocusSeconds, 0, 60 * 60 * 24 * 365, DEFAULT_STATE.totalFocusSeconds),
      lastCompletedAt: String(source.lastCompletedAt || '').trim(),
      history: normalizeHistory(source.history),
      summary: '',
      updatedAt: String(source.updatedAt || '').trim() || toIso(),
    };
    if (base.status === 'running' && !Number.isFinite(base.deadline)) {
      base.status = 'paused';
      base.deadline = null;
    }
    if (base.status === 'idle') {
      base.deadline = null;
      const planned = getPlannedSeconds(base, base.phase);
      if (!Number.isFinite(Number(source.remainingSeconds))) {
        base.remainingSeconds = planned;
      } else {
        base.remainingSeconds = clampInteger(source.remainingSeconds, 0, planned, planned);
      }
    }
    base.summary = buildSummary(base);
    return base;
  }

  function readRootData() {
    return typeof api.getData === 'function' ? api.getData() : {};
  }

  function readRawPluginState() {
    if (typeof api.getExtensionPrivateState === 'function') {
      try {
        const state = api.getExtensionPrivateState(PLUGIN_ID, readRootData());
        if (state && typeof state === 'object') return state;
      } catch (_) {}
    }
    const root = readRootData();
    const record = root && root.pluginData && typeof root.pluginData === 'object'
      ? root.pluginData[PLUGIN_ID]
      : null;
    if (record && typeof record === 'object' && record.state && typeof record.state === 'object') return record.state;
    if (record && typeof record === 'object') return record;
    return {};
  }

  function persistState(nextState, options = {}) {
    const normalized = normalizeState(nextState);
    normalized.updatedAt = toIso();
    normalized.summary = buildSummary(normalized);
    if (typeof api.setExtensionPrivateState === 'function') {
      try {
        api.setExtensionPrivateState(PLUGIN_ID, normalized, {
          save: options.save !== false,
          skipRender: options.skipRender === true,
          skipUndo: options.skipUndo !== false,
        });
      } catch (_) {}
      return normalized;
    }
    if (typeof api.writePluginData === 'function') {
      try {
        api.writePluginData(PLUGIN_ID, normalized);
      } catch (_) {}
    }
    return normalized;
  }

  function moveToPhase(state, phase, mode = 'idle', overrides = {}) {
    const next = normalizeState({ ...state, phase });
    const plannedSeconds = clampInteger(
      overrides.remainingSeconds,
      0,
      getPlannedSeconds(next, phase),
      getPlannedSeconds(next, phase)
    );
    next.phase = phase;
    next.status = mode === 'running' ? 'running' : mode === 'paused' ? 'paused' : 'idle';
    next.remainingSeconds = plannedSeconds;
    next.deadline = next.status === 'running' ? nowMs() + (plannedSeconds * 1000) : null;
    if (typeof overrides.keepTaskLabel === 'string') next.currentTaskLabel = String(overrides.keepTaskLabel).trim().slice(0, 80);
    next.updatedAt = toIso();
    next.summary = buildSummary(next);
    return next;
  }

  function recordCompletedPhase(state, phase, details = {}) {
    const next = normalizeState(state);
    const entry = {
      id: createHistoryId(),
      phase,
      label: String(details.label || next.currentTaskLabel || '').trim().slice(0, 80),
      plannedSeconds: clampInteger(details.plannedSeconds, 1, 60 * 60 * 4, getPlannedSeconds(next, phase)),
      actualSeconds: clampInteger(details.actualSeconds, 0, 60 * 60 * 4, clampInteger(details.plannedSeconds, 1, 60 * 60 * 4, getPlannedSeconds(next, phase))),
      completedAt: toIso(details.completedAt || ''),
      skipped: details.skipped === true,
    };
    next.history = [entry].concat(next.history).slice(0, MAX_HISTORY);
    next.lastCompletedAt = entry.completedAt;
    if (phase === 'focus' && entry.skipped !== true) {
      next.completedFocusCount += 1;
      next.totalFocusSeconds += entry.actualSeconds;
      next.focusesSinceLongBreak = Math.min(next.longBreakInterval, next.focusesSinceLongBreak + 1);
    }
    if (phase === 'long-break' && entry.skipped !== true) {
      next.focusesSinceLongBreak = 0;
    }
    next.updatedAt = toIso();
    next.summary = buildSummary(next);
    return next;
  }

  function advanceCompletedPhaseOnce(state, completedAt = '') {
    const completedState = normalizeState(state);
    const phase = completedState.phase;
    const plannedSeconds = getPlannedSeconds(completedState, phase);
    let next = recordCompletedPhase(completedState, phase, {
      plannedSeconds,
      actualSeconds: plannedSeconds,
      completedAt,
    });
    if (phase === 'focus') {
      const shouldLongBreak = next.focusesSinceLongBreak >= next.longBreakInterval;
      const breakPhase = shouldLongBreak ? 'long-break' : 'short-break';
      next = moveToPhase(next, breakPhase, next.autoStartBreaks ? 'running' : 'idle');
      return next;
    }
    if (phase === 'long-break') {
      next.focusesSinceLongBreak = 0;
      next = moveToPhase(next, 'focus', next.autoStartFocus ? 'running' : 'idle');
      return next;
    }
    next = moveToPhase(next, 'focus', next.autoStartFocus ? 'running' : 'idle');
    return next;
  }

  function resolveTimeline(state) {
    let next = normalizeState(state);
    let didAdvance = false;
    if (next.status !== 'running' || !Number.isFinite(next.deadline)) {
      next.summary = buildSummary(next);
      return { state: next, didAdvance };
    }
    const now = nowMs();
    let guard = 0;
    while (next.status === 'running' && Number.isFinite(next.deadline) && next.deadline <= now && guard < 8) {
      next = advanceCompletedPhaseOnce(next, toIso(now));
      didAdvance = true;
      guard += 1;
    }
    if (next.status === 'running' && Number.isFinite(next.deadline)) {
      next.remainingSeconds = Math.max(0, Math.ceil((next.deadline - now) / 1000));
    }
    if (didAdvance) next.updatedAt = toIso();
    next.summary = buildSummary(next);
    return { state: next, didAdvance };
  }

  function getPluginState(options = {}) {
    const normalized = normalizeState(readRawPluginState());
    if (options.sync === false) return normalized;
    const resolved = resolveTimeline(normalized);
    if (resolved.didAdvance) {
      persistState(resolved.state, { save: options.save !== false, skipUndo: true, skipRender: true });
    }
    return resolved.state;
  }

  function updatePluginState(updater = null, options = {}) {
    const current = getPluginState({ sync: true, save: options.save !== false });
    let next = current;
    if (typeof updater === 'function') {
      const computed = updater(cloneValue(current));
      if (computed && typeof computed === 'object') next = computed;
    } else if (updater && typeof updater === 'object') {
      next = updater;
    }
    return persistState(resolveTimeline(next).state, options);
  }

  function startFocus(options = {}) {
    return updatePluginState((current) => {
      const next = normalizeState(current);
      const focusMinutes = options && Number.isFinite(Number(options.focusDurationMinutes))
        ? clampInteger(options.focusDurationMinutes, 1, 180, next.focusDurationMinutes)
        : next.focusDurationMinutes;
      next.focusDurationMinutes = focusMinutes;
      if (typeof options.currentTaskLabel === 'string') {
        next.currentTaskLabel = String(options.currentTaskLabel).trim().slice(0, 80);
      }
      return moveToPhase(next, 'focus', 'running');
    }, { save: options.save !== false, skipUndo: true });
  }

  function pause() {
    return updatePluginState((current) => {
      const next = normalizeState(current);
      if (next.status !== 'running' || !Number.isFinite(next.deadline)) return next;
      next.remainingSeconds = Math.max(0, Math.ceil((next.deadline - nowMs()) / 1000));
      next.status = 'paused';
      next.deadline = null;
      return next;
    }, { skipUndo: true });
  }

  function resume() {
    return updatePluginState((current) => {
      const next = normalizeState(current);
      if (next.status !== 'paused') return next;
      next.status = 'running';
      next.deadline = nowMs() + (Math.max(1, next.remainingSeconds) * 1000);
      return next;
    }, { skipUndo: true });
  }

  function reset(options = {}) {
    return updatePluginState((current) => {
      const next = normalizeState(current);
      if (typeof options.currentTaskLabel === 'string') {
        next.currentTaskLabel = String(options.currentTaskLabel).trim().slice(0, 80);
      }
      return moveToPhase(next, 'focus', 'idle', {
        keepTaskLabel: next.currentTaskLabel,
      });
    }, { skipUndo: true });
  }

  function skip() {
    return updatePluginState((current) => {
      const next = normalizeState(current);
      if (next.phase === 'focus') {
        return moveToPhase(next, 'short-break', 'idle');
      }
      if (next.phase === 'long-break') {
        next.focusesSinceLongBreak = 0;
      }
      return moveToPhase(next, 'focus', 'idle');
    }, { skipUndo: true });
  }

  function applySettings(patch = {}) {
    return updatePluginState((current) => {
      const next = normalizeState({ ...current, ...(patch && typeof patch === 'object' ? patch : {}) });
      const plannedSeconds = getPlannedSeconds(next, next.phase);
      if (next.status === 'idle') {
        next.remainingSeconds = plannedSeconds;
      } else if (next.status === 'paused') {
        next.remainingSeconds = clampInteger(next.remainingSeconds, 0, plannedSeconds, plannedSeconds);
      }
      return next;
    }, { skipUndo: true });
  }

  function setCurrentTaskLabel(value = '') {
    return updatePluginState((current) => ({
      ...current,
      currentTaskLabel: String(value || '').trim().slice(0, 80),
    }), { skipUndo: true });
  }

  function buildAIReadableContext() {
    if (!isEnabled()) return null;
    const state = getPluginState({ sync: true });
    const today = buildTodayStats(state.history);
    return {
      pluginId: PLUGIN_ID,
      summary: String(state.summary || DEFAULT_SUMMARY).trim(),
      snapshot: {
        phase: state.phase,
        phaseLabel: getPhaseLabel(state.phase),
        status: state.status,
        statusLabel: getStatusLabel(state.status),
        remainingSeconds: state.remainingSeconds,
        remainingClock: formatClock(state.remainingSeconds),
        currentTaskLabel: state.currentTaskLabel,
        completedFocusCount: state.completedFocusCount,
        totalFocusMinutes: Math.round((Number(state.totalFocusSeconds) || 0) / 60),
        focusesSinceLongBreak: state.focusesSinceLongBreak,
        settings: {
          focusDurationMinutes: state.focusDurationMinutes,
          shortBreakMinutes: state.shortBreakMinutes,
          longBreakMinutes: state.longBreakMinutes,
          longBreakInterval: state.longBreakInterval,
          autoStartBreaks: state.autoStartBreaks,
          autoStartFocus: state.autoStartFocus,
        },
        today,
        recentHistory: state.history.slice(0, 8),
      },
    };
  }

  function handleToggle(nextValue) {
    if (nextValue === false) reset();
    return { enabled: nextValue === true };
  }

  function isEnabled() {
    return typeof api.isExtensionEnabled === 'function'
      ? api.isExtensionEnabled(PLUGIN_ID)
      : false;
  }

  function getQuickStartPresets() {
    return [15, 25, 45];
  }

  function createPomodoroPluginRuntime(deps = {}) {
    Object.assign(api, deps && typeof deps === 'object' ? deps : {});
    return {
      isEnabled,
      getPluginState,
      updatePluginState,
      buildAIReadableContext,
      handleToggle,
      startFocus,
      pause,
      resume,
      reset,
      skip,
      applySettings,
      setCurrentTaskLabel,
      getQuickStartPresets,
      formatClock,
      getPhaseLabel,
      getStatusLabel,
      buildTodayStats,
    };
  }

  window.MorphPomodoroPluginRuntime = {
    create: createPomodoroPluginRuntime,
  };
})();
