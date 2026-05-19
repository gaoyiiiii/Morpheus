(function initMorphStartupStorageRuntime() {
  const STARTUP_STORAGE_DESCRIPTOR_VERSION = 'startup-storage.v1';

  function buildSingleSourceOfTruthDescriptor(contractVersion = '2026-03-30.round-06') {
    return {
      contractVersion: String(contractVersion || '2026-03-30.round-06').trim() || '2026-03-30.round-06',
      migrationState: 'boundary-landed',
      canonicalStore: {
        kind: 'live-data-json',
        relativePath: 'data/live-data.json',
        role: 'authoritative-user-store',
        owner: 'core-data',
      },
      authoritativeWritePath: {
        strategy: 'full-snapshot-commit',
        allowedWriters: ['server-sync', 'native-sync'],
      },
      cacheReplicas: [
        {
          kind: 'browser-local-storage',
          location: 'localStorage:lianxing_mono_v18',
          role: 'bootstrap-cache',
        },
        {
          kind: 'bootstrap-cache',
          location: 'app-bootstrap-cache',
          role: 'bootstrap-cache',
        },
        {
          kind: 'startup-snapshot',
          location: 'startup-snapshot',
          role: 'startup-read-model',
        },
      ],
      derivedReplicas: [
        {
          kind: 'markdown-mirror',
          location: 'morph_md_mirror/',
          role: 'derived-mirror',
        },
        {
          kind: 'live-data-shards',
          location: 'data/shards/',
          role: 'derived-shard-index',
        },
      ],
    };
  }

  function createStartupStorageRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const contractVersion = String(api.contractVersion || api.MORPH_SSOT_CONTRACT_VERSION || '2026-03-30.round-06').trim() || '2026-03-30.round-06';
    const readBootstrapCacheEntry = typeof api.readBootstrapCacheEntry === 'function' ? api.readBootstrapCacheEntry : null;
    const readBootstrapCacheData = typeof api.readBootstrapCacheData === 'function' ? api.readBootstrapCacheData : () => null;
    const loadStartupSnapshotData = typeof api.loadStartupSnapshotData === 'function' ? api.loadStartupSnapshotData : () => null;
    const hasAnyUserData = typeof api.hasAnyUserData === 'function'
      ? api.hasAnyUserData
      : (snapshot) => !!snapshot;
    const canTrustPersistedNativeDataSnapshot = typeof api.canTrustPersistedNativeDataSnapshot === 'function'
      ? api.canTrustPersistedNativeDataSnapshot
      : () => false;
    const parseBootSnapshotRevision = typeof api.parseBootSnapshotRevision === 'function'
      ? api.parseBootSnapshotRevision
      : (snapshot = null) => {
        const revision = Number(snapshot?.syncMeta?.revision || 0);
        return Number.isFinite(revision) && revision > 0 ? revision : 0;
      };
    const parseBootSnapshotWriteTime = typeof api.parseBootSnapshotWriteTime === 'function'
      ? api.parseBootSnapshotWriteTime
      : (snapshot = null) => {
        const raw = String(
          snapshot?.syncMeta?.lastClientWriteAt
          || snapshot?.syncMeta?.lastServerWriteAt
          || snapshot?.syncMeta?.updatedAt
          || ''
        ).trim();
        if (!raw) return 0;
        const value = Date.parse(raw);
        return Number.isFinite(value) ? value : 0;
      };
    let cachedAuthoritativeStartupEntry = null;

    function normalizeBootstrapSource(value = '', source = '') {
      const normalized = String(value || '').trim();
      if (normalized) return normalized;
      if (source === 'bootstrap-cache') return 'server-bootstrap-cache';
      if (source === 'startup-snapshot') return 'startup-snapshot-fallback';
      return 'local-cache-fallback';
    }

    function buildStartupStorageDescriptor(options = {}) {
      const source = String(options.source || '').trim();
      const data = options.data && typeof options.data === 'object' ? options.data : null;
      const providedDescriptor = options.providedDescriptor && typeof options.providedDescriptor === 'object'
        ? options.providedDescriptor
        : null;
      const storageTopology = providedDescriptor?.storageTopology && typeof providedDescriptor.storageTopology === 'object'
        ? providedDescriptor.storageTopology
        : buildSingleSourceOfTruthDescriptor(contractVersion);
      const revision = parseBootSnapshotRevision(data);
      const writeTime = parseBootSnapshotWriteTime(data);
      return {
        descriptorVersion: String(providedDescriptor?.descriptorVersion || STARTUP_STORAGE_DESCRIPTOR_VERSION).trim() || STARTUP_STORAGE_DESCRIPTOR_VERSION,
        contractVersion: String(providedDescriptor?.contractVersion || contractVersion).trim() || contractVersion,
        bootstrapSource: normalizeBootstrapSource(providedDescriptor?.bootstrapSource || options.bootstrapSource, source),
        migrationState: String(providedDescriptor?.migrationState || storageTopology?.migrationState || '').trim(),
        storageTopology,
        canonicalStore: providedDescriptor?.canonicalStore && typeof providedDescriptor.canonicalStore === 'object'
          ? providedDescriptor.canonicalStore
          : (storageTopology?.canonicalStore || null),
        authoritativeWritePath: providedDescriptor?.authoritativeWritePath && typeof providedDescriptor.authoritativeWritePath === 'object'
          ? providedDescriptor.authoritativeWritePath
          : (storageTopology?.authoritativeWritePath || null),
        cacheReplicas: Array.isArray(providedDescriptor?.cacheReplicas)
          ? providedDescriptor.cacheReplicas
          : (Array.isArray(storageTopology?.cacheReplicas) ? storageTopology.cacheReplicas : []),
        derivedReplicas: Array.isArray(providedDescriptor?.derivedReplicas)
          ? providedDescriptor.derivedReplicas
          : (Array.isArray(storageTopology?.derivedReplicas) ? storageTopology.derivedReplicas : []),
        authoritativeSnapshot: {
          source,
          revision,
          lastWriteAt: writeTime > 0 ? new Date(writeTime).toISOString() : '',
          hasUserData: hasAnyUserData(data),
        },
      };
    }

    function readBootstrapEntry() {
      if (readBootstrapCacheEntry) {
        const entry = readBootstrapCacheEntry();
        if (entry && typeof entry === 'object') {
          const payload = entry.payload && typeof entry.payload === 'object' ? entry.payload : null;
          return {
            data: entry.data && typeof entry.data === 'object' ? entry.data : null,
            bootstrapSource: String(entry.bootstrapSource || payload?.bootstrapSource || '').trim(),
            startupDescriptor: entry.startupDescriptor && typeof entry.startupDescriptor === 'object'
              ? entry.startupDescriptor
              : (payload?.startupDescriptor && typeof payload.startupDescriptor === 'object' ? payload.startupDescriptor : null),
          };
        }
      }
      const data = readBootstrapCacheData();
      return data && typeof data === 'object'
        ? { data, bootstrapSource: '', startupDescriptor: null }
        : null;
    }

    function sanitizeStartupScheduleMvpState(raw = null) {
      const source = raw && typeof raw === 'object' ? raw : {};
      const sanitizeTimestampValue = (value = '') => {
        const rawValue = String(value || '').trim();
        if (!rawValue) return '';
        const parsed = Date.parse(rawValue);
        return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
      };
      const sanitizeBoolBucket = (value = null) => {
        const out = {};
        if (!value || typeof value !== 'object') return out;
        Object.entries(value).forEach(([key, flag]) => {
          const safeKey = String(key || '').trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(safeKey) || flag !== true) return;
          out[safeKey] = true;
        });
        return out;
      };
      const sanitizeVideoBucket = (value = null) => {
        const out = {};
        if (!value || typeof value !== 'object') return out;
        Object.entries(value).forEach(([key, status]) => {
          const safeKey = String(key || '').trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(safeKey) || String(status || '').trim() !== 'done') return;
          out[safeKey] = 'done';
        });
        return out;
      };
      const sanitizeExerciseBucket = (value = null) => {
        const out = {};
        if (!value || typeof value !== 'object') return out;
        Object.entries(value).forEach(([weekKey, days]) => {
          const safeWeekKey = String(weekKey || '').trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(safeWeekKey) || !days || typeof days !== 'object') return;
          const weekOut = sanitizeBoolBucket(days);
          if (Object.keys(weekOut).length) out[safeWeekKey] = weekOut;
        });
        return out;
      };
      const sanitizeTimestampBucket = (value = null) => {
        const out = {};
        if (!value || typeof value !== 'object') return out;
        Object.entries(value).forEach(([key, timestamp]) => {
          const safeKey = String(key || '').trim();
          const safeTimestamp = sanitizeTimestampValue(timestamp);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(safeKey) || !safeTimestamp) return;
          out[safeKey] = safeTimestamp;
        });
        return out;
      };
      const sanitizeExerciseTimestampBucket = (value = null) => {
        const out = {};
        if (!value || typeof value !== 'object') return out;
        Object.entries(value).forEach(([weekKey, days]) => {
          const safeWeekKey = String(weekKey || '').trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(safeWeekKey) || !days || typeof days !== 'object') return;
          const weekOut = sanitizeTimestampBucket(days);
          if (Object.keys(weekOut).length) out[safeWeekKey] = weekOut;
        });
        return out;
      };
      const sanitizeCustomRhythms = (value = null) => {
        const items = Array.isArray(value) ? value : [];
        return items.map((item) => {
          const sourceItem = item && typeof item === 'object' ? item : {};
          const id = String(sourceItem.id || '').trim();
          const title = String(sourceItem.title || sourceItem.name || '').trim().slice(0, 48);
          if (!id || !title) return null;
          return {
            id,
            title,
            description: String(sourceItem.description || '').trim().slice(0, 160),
            cadence: String(sourceItem.cadence || '每天').trim().slice(0, 40) || '每天',
            frequency: String(sourceItem.frequency || '').trim().slice(0, 16),
            targetCount: Math.max(1, Math.min(365, Math.floor(Number(sourceItem.targetCount)) || 1)),
            icon: String(sourceItem.icon || 'sparkles').trim().slice(0, 32) || 'sparkles',
            metaLabel: String(sourceItem.metaLabel || sourceItem.eyebrow || 'RHYTHM').trim().slice(0, 24) || 'RHYTHM',
            createdAt: String(sourceItem.createdAt || '').trim(),
            updatedAt: String(sourceItem.updatedAt || '').trim(),
          };
        }).filter(Boolean).slice(0, 24);
      };
      const sanitizeCardOverrides = (value = null) => {
        const out = {};
        if (!value || typeof value !== 'object') return out;
        Object.entries(value).forEach(([key, item]) => {
          const safeKey = String(key || '').trim();
          const sourceItem = item && typeof item === 'object' ? item : {};
          if (!safeKey) return;
          const title = String(sourceItem.title || '').trim().slice(0, 48);
          const description = String(sourceItem.description || '').trim().slice(0, 160);
          const icon = String(sourceItem.icon || '').trim().slice(0, 32);
          const metaLabel = String(sourceItem.metaLabel || '').trim().slice(0, 24);
          const frequency = String(sourceItem.frequency || '').trim().slice(0, 16);
          const targetCount = sourceItem.targetCount ? Math.max(1, Math.min(365, Math.floor(Number(sourceItem.targetCount)) || 1)) : 0;
          const hidden = sourceItem.hidden === true;
          if (!title && !description && !icon && !metaLabel && !frequency && !targetCount && !hidden) return;
          out[safeKey] = { title, description, icon, metaLabel, frequency, targetCount, hidden };
        });
        return out;
      };
      return {
        video: sanitizeVideoBucket(source.video),
        review: sanitizeBoolBucket(source.review),
        reviewAt: sanitizeTimestampBucket(source.reviewAt),
        sleep: sanitizeBoolBucket(source.sleep),
        sleepAt: sanitizeTimestampBucket(source.sleepAt),
        exercise: sanitizeExerciseBucket(source.exercise),
        exerciseAt: sanitizeExerciseTimestampBucket(source.exerciseAt),
        custom: sanitizeCustomRhythms(source.custom),
        customDone: source.customDone && typeof source.customDone === 'object' ? Object.fromEntries(Object.entries(source.customDone).map(([id, days]) => [String(id || '').trim(), sanitizeBoolBucket(days)]).filter(([id]) => !!id)) : {},
        customDoneAt: source.customDoneAt && typeof source.customDoneAt === 'object' ? Object.fromEntries(Object.entries(source.customDoneAt).map(([id, days]) => [String(id || '').trim(), sanitizeTimestampBucket(days)]).filter(([id]) => !!id)) : {},
        cardOverrides: sanitizeCardOverrides(source.cardOverrides),
        cardOrder: Array.isArray(source.cardOrder) ? Array.from(new Set(source.cardOrder.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 64) : [],
        cardOrderUpdatedAt: typeof source.cardOrderUpdatedAt === 'string' ? source.cardOrderUpdatedAt : '',
        updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
      };
    }

    function countStartupScheduleMvpRecords(state = null) {
      const source = state && typeof state === 'object' ? state : {};
      const countFlatBucket = (bucket = null) => (bucket && typeof bucket === 'object' ? Object.keys(bucket).length : 0);
      const exerciseCount = Object.values(source.exercise && typeof source.exercise === 'object' ? source.exercise : {})
        .reduce((sum, days) => sum + countFlatBucket(days), 0);
      const customDoneCount = Object.values(source.customDone && typeof source.customDone === 'object' ? source.customDone : {})
        .reduce((sum, days) => sum + countFlatBucket(days), 0);
      return countFlatBucket(source.video) + countFlatBucket(source.review) + countFlatBucket(source.sleep) + exerciseCount + (Array.isArray(source.custom) ? source.custom.length : 0) + customDoneCount + (Array.isArray(source.cardOrder) ? source.cardOrder.length : 0);
    }

    function mergeScheduleRhythmCardOrderFields(left = null, right = null) {
      const leftOrder = Array.isArray(left?.cardOrder) ? left.cardOrder : [];
      const rightOrder = Array.isArray(right?.cardOrder) ? right.cardOrder : [];
      const leftAt = Date.parse(String(left?.cardOrderUpdatedAt || '').trim() || '') || 0;
      const rightAt = Date.parse(String(right?.cardOrderUpdatedAt || '').trim() || '') || 0;
      if (rightOrder.length && (!leftOrder.length || rightAt >= leftAt || (!leftAt && !rightAt))) {
        return {
          cardOrder: rightOrder,
          cardOrderUpdatedAt: String(right?.cardOrderUpdatedAt || left?.cardOrderUpdatedAt || '').trim(),
        };
      }
      return {
        cardOrder: leftOrder,
        cardOrderUpdatedAt: String(left?.cardOrderUpdatedAt || right?.cardOrderUpdatedAt || '').trim(),
      };
    }

    function mergeStartupScheduleMvpState(preferred = null, supplemental = null) {
      const base = sanitizeStartupScheduleMvpState(preferred);
      const extra = sanitizeStartupScheduleMvpState(supplemental);
      const mergeFlatBucket = (left = {}, right = {}) => ({ ...(left && typeof left === 'object' ? left : {}), ...(right && typeof right === 'object' ? right : {}) });
      const exercise = mergeFlatBucket(base.exercise, null);
      Object.entries(extra.exercise && typeof extra.exercise === 'object' ? extra.exercise : {}).forEach(([weekKey, days]) => {
        exercise[weekKey] = mergeFlatBucket(exercise[weekKey], days);
      });
      const customMap = new Map();
      [...(Array.isArray(base.custom) ? base.custom : []), ...(Array.isArray(extra.custom) ? extra.custom : [])].forEach((item) => {
        if (item?.id) customMap.set(String(item.id), item);
      });
      const customDone = mergeFlatBucket(base.customDone, null);
      Object.entries(extra.customDone && typeof extra.customDone === 'object' ? extra.customDone : {}).forEach(([id, days]) => {
        customDone[id] = mergeFlatBucket(customDone[id], days);
      });
      const exerciseAt = mergeFlatBucket(base.exerciseAt, null);
      Object.entries(extra.exerciseAt && typeof extra.exerciseAt === 'object' ? extra.exerciseAt : {}).forEach(([weekKey, days]) => {
        exerciseAt[weekKey] = mergeFlatBucket(exerciseAt[weekKey], days);
      });
      const customDoneAt = mergeFlatBucket(base.customDoneAt, null);
      Object.entries(extra.customDoneAt && typeof extra.customDoneAt === 'object' ? extra.customDoneAt : {}).forEach(([id, days]) => {
        customDoneAt[id] = mergeFlatBucket(customDoneAt[id], days);
      });
      return {
        video: mergeFlatBucket(base.video, extra.video),
        review: mergeFlatBucket(base.review, extra.review),
        reviewAt: mergeFlatBucket(base.reviewAt, extra.reviewAt),
        sleep: mergeFlatBucket(base.sleep, extra.sleep),
        sleepAt: mergeFlatBucket(base.sleepAt, extra.sleepAt),
        exercise,
        exerciseAt,
        custom: Array.from(customMap.values()),
        customDone,
        customDoneAt,
        cardOverrides: mergeFlatBucket(base.cardOverrides, extra.cardOverrides),
        ...mergeScheduleRhythmCardOrderFields(base, extra),
        updatedAt: base.updatedAt || extra.updatedAt || '',
      };
    }

    function attachMergedStartupScheduleMvp(preferred = null, other = null) {
      if (!preferred?.data || !other?.data) return preferred;
      const otherCount = countStartupScheduleMvpRecords(other.data.scheduleMvp);
      if (otherCount <= 0) return preferred;
      const mergedScheduleMvp = mergeStartupScheduleMvpState(preferred.data.scheduleMvp, other.data.scheduleMvp);
      if (JSON.stringify(mergedScheduleMvp) === JSON.stringify(sanitizeStartupScheduleMvpState(preferred.data.scheduleMvp))) {
        return preferred;
      }
      const nextData = JSON.parse(JSON.stringify(preferred.data));
      nextData.scheduleMvp = mergedScheduleMvp;
      return {
        ...preferred,
        data: nextData,
      };
    }

    function choosePreferredStartupEntry(primary = null, secondary = null) {
      const left = primary && typeof primary === 'object' ? primary : null;
      const right = secondary && typeof secondary === 'object' ? secondary : null;
      const leftHasData = !!(left && left.data);
      const rightHasData = !!(right && right.data);
      if (leftHasData && !rightHasData) return left;
      if (rightHasData && !leftHasData) return right;
      if (!leftHasData && !rightHasData) return left || right || null;
      const leftRevision = Number(left?.data?.syncMeta?.revision || 0);
      const rightRevision = Number(right?.data?.syncMeta?.revision || 0);
      if (leftRevision !== rightRevision) {
        const winner = leftRevision > rightRevision ? left : right;
        const loser = winner === left ? right : left;
        return attachMergedStartupScheduleMvp(winner, loser);
      }
      const leftWriteAt = Date.parse(String(left?.data?.syncMeta?.lastClientWriteAt || left?.data?.syncMeta?.lastServerWriteAt || '')) || 0;
      const rightWriteAt = Date.parse(String(right?.data?.syncMeta?.lastClientWriteAt || right?.data?.syncMeta?.lastServerWriteAt || '')) || 0;
      if (leftWriteAt !== rightWriteAt) {
        const winner = leftWriteAt > rightWriteAt ? left : right;
        const loser = winner === left ? right : left;
        return attachMergedStartupScheduleMvp(winner, loser);
      }
      if (String(right?.source || '').trim() === 'startup-snapshot') return attachMergedStartupScheduleMvp(right, left);
      if (String(left?.source || '').trim() === 'startup-snapshot') return attachMergedStartupScheduleMvp(left, right);
      return attachMergedStartupScheduleMvp(left, right);
    }

    function resolveAuthoritativeStartupEntry() {
      if (cachedAuthoritativeStartupEntry) return cachedAuthoritativeStartupEntry;
      const bootstrapEntry = readBootstrapEntry();
      const startupSnapshot = loadStartupSnapshotData();
      const bootstrapDescriptorEntry = bootstrapEntry?.data ? (() => {
        const startupDescriptor = buildStartupStorageDescriptor({
          source: 'bootstrap-cache',
          data: bootstrapEntry.data,
          bootstrapSource: bootstrapEntry.bootstrapSource,
          providedDescriptor: bootstrapEntry.startupDescriptor,
        });
        return {
          data: bootstrapEntry.data,
          source: 'bootstrap-cache',
          bootstrapSource: startupDescriptor.bootstrapSource,
          startupDescriptor,
        };
      })() : null;
      const startupSnapshotEntry = startupSnapshot ? (() => {
        const startupDescriptor = buildStartupStorageDescriptor({
          source: 'startup-snapshot',
          data: startupSnapshot,
        });
        return {
          data: startupSnapshot,
          source: 'startup-snapshot',
          bootstrapSource: startupDescriptor.bootstrapSource,
          startupDescriptor,
        };
      })() : null;
      const preferredEntry = choosePreferredStartupEntry(bootstrapDescriptorEntry, startupSnapshotEntry);
      if (preferredEntry?.data) {
        cachedAuthoritativeStartupEntry = preferredEntry;
        return cachedAuthoritativeStartupEntry;
      }
      const startupDescriptor = buildStartupStorageDescriptor({
        source: '',
        data: null,
      });
      cachedAuthoritativeStartupEntry = {
        data: null,
        source: '',
        bootstrapSource: startupDescriptor.bootstrapSource,
        startupDescriptor,
      };
      return cachedAuthoritativeStartupEntry;
    }

    function buildReleasedAuthoritativeStartupEntry(entry = null) {
      const current = entry && typeof entry === 'object' ? entry : null;
      const source = String(current?.source || '').trim();
      const bootstrapSource = normalizeBootstrapSource(current?.bootstrapSource || '', source);
      const startupDescriptor = current?.startupDescriptor && typeof current.startupDescriptor === 'object'
        ? current.startupDescriptor
        : buildStartupStorageDescriptor({
          source,
          data: null,
          bootstrapSource,
        });
      return {
        data: null,
        source,
        bootstrapSource,
        startupDescriptor,
      };
    }

    function loadAuthoritativeStartupDataDescriptor() {
      const entry = resolveAuthoritativeStartupEntry();
      return {
        data: entry.data,
        source: entry.source,
        bootstrapSource: entry.bootstrapSource,
        startupDescriptor: entry.startupDescriptor,
      };
    }

    function loadAuthoritativeStartupData() {
      return resolveAuthoritativeStartupEntry().data;
    }

    function releaseAuthoritativeStartupData() {
      cachedAuthoritativeStartupEntry = buildReleasedAuthoritativeStartupEntry(cachedAuthoritativeStartupEntry);
      return true;
    }

    function getSingleSourceOfTruthDescriptor() {
      return buildSingleSourceOfTruthDescriptor(contractVersion);
    }

    function getStartupStorageDescriptor() {
      return resolveAuthoritativeStartupEntry().startupDescriptor;
    }

    function choosePreferredBootSnapshot(primary = null, secondary = null, options = {}) {
      const left = primary && typeof primary === 'object' ? primary : null;
      const right = secondary && typeof secondary === 'object' ? secondary : null;
      const leftHasData = hasAnyUserData(left);
      const rightHasData = hasAnyUserData(right);
      if (leftHasData && !rightHasData) return left;
      if (rightHasData && !leftHasData) return right;
      if (!leftHasData && !rightHasData) return left || right || null;
      if (options.preferTrusted === true) {
        const leftTrusted = canTrustPersistedNativeDataSnapshot(left);
        const rightTrusted = canTrustPersistedNativeDataSnapshot(right);
        if (leftTrusted && !rightTrusted) return left;
        if (rightTrusted && !leftTrusted) return right;
      }
      const leftRevision = parseBootSnapshotRevision(left);
      const rightRevision = parseBootSnapshotRevision(right);
      if (leftRevision !== rightRevision) return leftRevision > rightRevision ? left : right;
      const leftWriteAt = parseBootSnapshotWriteTime(left);
      const rightWriteAt = parseBootSnapshotWriteTime(right);
      if (leftWriteAt !== rightWriteAt) return leftWriteAt > rightWriteAt ? left : right;
      return left || right || null;
    }

    function describeBrowserSyncRootAdoption(options = {}) {
      const silent = options.silent === true;
      return {
        source: 'browser-sync-root',
        reason: silent ? 'browser_sync_root_bootstrap' : 'browser_sync_root_manual_reload',
        message: silent ? '已载入用户目录' : '已从用户目录重新载入',
      };
    }

    return {
      contractVersion,
      parseBootSnapshotRevision,
      parseBootSnapshotWriteTime,
      choosePreferredBootSnapshot,
      loadAuthoritativeStartupDataDescriptor,
      loadAuthoritativeStartupData,
      releaseAuthoritativeStartupData,
      getSingleSourceOfTruthDescriptor,
      getStartupStorageDescriptor,
      describeBrowserSyncRootAdoption,
    };
  }

  window.MorphStartupStorageRuntime = {
    create: createStartupStorageRuntime,
  };
})();
