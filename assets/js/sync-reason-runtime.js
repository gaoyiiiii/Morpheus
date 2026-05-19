(function initMorphSyncReasonRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphSyncReasonRuntime && typeof window.MorphSyncReasonRuntime.create === 'function') return;

  function createSyncReasonRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function trimText(value = '') {
      return String(value || '').trim();
    }

    function toFiniteNumber(value, fallback = 0) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    }

    function toTimestamp(value = '') {
      const parsed = Date.parse(trimText(value));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function nowMs() {
      return api.now && typeof api.now === 'function' ? toFiniteNumber(api.now(), Date.now()) : Date.now();
    }

    function normalizeReasonCode(reason = '') {
      return trimText(reason).toLowerCase();
    }

    function normalizeStatusCode(status = '') {
      const normalized = trimText(status).toLowerCase();
      if (normalized === 'ok') return 'acked';
      return normalized;
    }

    function describeStatus(status = '') {
      const normalized = normalizeStatusCode(status);
      if (normalized === 'acked') return '已确认';
      if (normalized === 'pending' || normalized === 'syncing') return '同步中';
      if (normalized === 'deferred') return '已暂缓';
      if (normalized === 'blocked') return '已拦截';
      if (normalized === 'noop') return '无需应用';
      if (normalized === 'applied') return '已应用';
      if (normalized === 'error') return '失败';
      return normalized || '未知';
    }

    function isBootHydrationPending(bootPhase = '') {
      const normalized = trimText(bootPhase).toLowerCase();
      return normalized === 'waiting-native-bootstrap'
        || normalized === 'waiting-browser-sync-bootstrap'
        || normalized === 'hydrating-startup-snapshot'
        || normalized === 'booting';
    }

    function buildAuxiliarySyncFailureExplain(owner = '', receiptMessage = '') {
      const normalizedOwner = trimText(owner).toLowerCase();
      if (normalizedOwner === 'browser-directory' && /辅助同步服务未连接|无法连接同步服务/.test(receiptMessage)) {
        return '浏览器目录仍是主写入链路；当前只是本地服务辅助联动没连上。';
      }
      return '';
    }

    function inferCloudNotArrived(context = {}) {
      const owner = trimText(context.descriptor?.durableWriteOwner || '').toLowerCase();
      if (owner !== 'browser-directory' && owner !== 'native-sync-writer') return false;
      if (isBootHydrationPending(context.bootPhase)) return false;
      if (toFiniteNumber(context.pendingCount, 0) > 0) return false;
      if (normalizeReasonCode(context.rawReason)) return false;
      const receiptAtMs = toTimestamp(context.receiptUpdatedAt);
      if (!receiptAtMs) return true;
      const currentWriteAtMs = toTimestamp(context.currentMeta?.lastClientWriteAt);
      if (currentWriteAtMs > 0 && currentWriteAtMs > receiptAtMs) return true;
      return nowMs() - receiptAtMs > 3 * 60 * 1000;
    }

    function buildReasonRecord(code = '', bucket = '', label = '', explainText = '', extras = {}) {
      return {
        code,
        bucket,
        label,
        explainText,
        ...extras,
      };
    }

    function resolveReasonRecord(context = {}) {
      const rawReason = normalizeReasonCode(context.rawReason);
      const rawStatus = normalizeStatusCode(context.rawStatus);
      const receiptMessage = trimText(context.receipt?.message || context.receiptMessage);
      const owner = trimText(context.descriptor?.durableWriteOwner || '').toLowerCase();

      if (rawReason === 'draft_protected') {
        return buildReasonRecord('draft_protected', 'draft_protected', '草稿保护', '当前存在未提交草稿，系统先保护编辑中的内容，不让外部快照直接覆盖。');
      }
      if (rawReason === 'recent_local_commit' || rawReason === 'recent_commit_guard') {
        return buildReasonRecord('recent_commit_guard', 'recent_commit_guard', '最近提交保护', '刚刚发生过一次本地提交，系统会短暂延后外部同步，避免新写入立刻被旧快照卷回去。');
      }
      if (rawReason === 'stale_external_snapshot' || rawReason === 'older_revision') {
        return buildReasonRecord('older_revision', 'older_revision', '旧版本外部快照', '这次到达的是更旧的外部版本，系统已保留当前较新的数据。');
      }
      if (
        rawReason === 'editing_in_progress'
        || rawReason === 'local_dirty_pending_sync'
        || rawReason === 'external_reload_deferred'
        || rawReason === 'deferred_waiting'
      ) {
        return buildReasonRecord('deferred_waiting', 'deferred_waiting', '等待当前写入/编辑结束', rawReason === 'editing_in_progress'
          ? '当前正在编辑内容，外部同步会暂缓，避免把你光标下的内容突然替换掉。'
          : rawReason === 'local_dirty_pending_sync'
            ? '本地还有未确认写入，系统先等当前写入确认，再决定是否应用外部快照。'
            : '外部快照已经到达，但系统会等本地空闲后再应用。');
      }
      if (rawReason === 'cloud_not_arrived') {
        return buildReasonRecord('cloud_not_arrived', 'cloud_not_arrived', '云端文件还没到', '当前还没有看到新的外部快照到达，更像是另一端的文件还在云端同步途中。');
      }
      if (rawReason === 'browser_sync_root_loaded') {
        return buildReasonRecord('browser_sync_root_loaded', 'applied', '目录已接管', '用户目录已经接管当前运行态。');
      }
      if (rawReason === 'same_data') {
        return buildReasonRecord('same_data', 'stable', '数据一致', '收到的数据与当前运行态一致，所以没有重复应用。');
      }
      if (rawReason === 'unexpected_sync_root') {
        return buildReasonRecord('unexpected_sync_root', 'blocked', '目录不匹配', '收到的外部数据来自另一个目录，不是当前用户目录，所以被系统主动忽略。');
      }
      if (rawReason === 'empty_external_snapshot') {
        return buildReasonRecord('empty_external_snapshot', 'blocked', '空快照已拦截', '外部快照是空数据，但当前本地已有内容，系统已拦截这次覆盖。');
      }
      if (rawReason === 'native_control_unavailable') {
        return buildReasonRecord('native_control_unavailable', 'environment', '桥接不可用', '当前环境没有可用的原生桥接能力。');
      }
      if (rawReason === 'browser_sync_root_permission_denied') {
        return buildReasonRecord('browser_sync_root_permission_denied', 'permission', '目录读取权限缺失', '浏览器没有授予所选目录读取权限。');
      }
      if (rawReason === 'browser_sync_root_write_denied') {
        return buildReasonRecord('browser_sync_root_write_denied', 'permission', '目录写入权限缺失', '浏览器已经允许读取，但没有授予写入权限。');
      }
      if (rawReason === 'sync_failed' || rawReason === 'server_sync_error' || rawReason === 'server-sync:error') {
        const auxiliaryExplain = buildAuxiliarySyncFailureExplain(owner, receiptMessage);
        if (auxiliaryExplain) {
          return buildReasonRecord('auxiliary_sync_unavailable', 'auxiliary_service_outage', '辅助同步服务未连接', auxiliaryExplain);
        }
        return buildReasonRecord('server_sync_error', 'error', '同步服务失败', '本地服务同步失败，通常是服务端拒绝写入或服务暂时不可达。');
      }
      if (inferCloudNotArrived(context)) {
        return buildReasonRecord('cloud_not_arrived', 'cloud_not_arrived', '云端文件还没到', '当前还没有看到新的外部快照到达，更像是另一端的文件还在云端同步途中。');
      }
      if (rawStatus === 'applied') {
        return buildReasonRecord('applied', 'applied', '已应用最新快照', '外部同步已经应用到当前运行态。');
      }
      if (rawStatus === 'acked') {
        return buildReasonRecord('acked', 'stable', '同步已确认', '当前运行态已经收到最近一次同步确认。');
      }
      if (!rawReason && receiptMessage) {
        return buildReasonRecord('receipt_message', rawStatus || 'info', '回执提示', receiptMessage);
      }
      if (!rawReason) {
        return buildReasonRecord('stable', 'stable', '最近没有阻塞', '最近没有记录到异常或阻塞。');
      }
      return buildReasonRecord(rawReason, rawStatus || 'unknown', rawReason, receiptMessage || `系统记录了同步事件：${rawReason}`);
    }

    function buildSyncReasonSurface({
      receipt = null,
      descriptor = null,
      syncState = null,
      currentMeta = null,
      bootPhase = '',
      reason = '',
      status = '',
    } = {}) {
      const safeReceipt = receipt && typeof receipt === 'object' ? receipt : null;
      const rawReason = trimText(reason || safeReceipt?.reason);
      const rawStatus = trimText(status || safeReceipt?.status);
      const pendingCount = toFiniteNumber(
        syncState?.pendingCount,
        toFiniteNumber(safeReceipt?.pendingCount, 0),
      );
      const record = resolveReasonRecord({
        rawReason,
        rawStatus,
        pendingCount,
        receipt: safeReceipt,
        receiptMessage: safeReceipt?.message,
        receiptUpdatedAt: safeReceipt?.updatedAt,
        descriptor,
        syncState,
        currentMeta,
        bootPhase,
      });
      return {
        rawReason: normalizeReasonCode(rawReason),
        rawStatus: normalizeStatusCode(rawStatus),
        statusLabel: describeStatus(rawStatus),
        pendingCount,
        code: trimText(record.code),
        bucket: trimText(record.bucket),
        label: trimText(record.label),
        explainText: trimText(record.explainText),
        receiptMessage: trimText(safeReceipt?.message),
        updatedAt: trimText(safeReceipt?.updatedAt),
        source: trimText(safeReceipt?.source),
        ackedRevision: toFiniteNumber(
          safeReceipt?.ackedRevision,
          toFiniteNumber(syncState?.ackedRevision, 0),
        ),
      };
    }

    return {
      normalizeReasonCode,
      normalizeStatusCode,
      describeStatus,
      buildSyncReasonSurface,
    };
  }

  window.MorphSyncReasonRuntime = {
    create: createSyncReasonRuntime,
  };
})();
