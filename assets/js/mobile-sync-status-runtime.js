// @ts-check

(function initMorphMobileSyncStatusRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphMobileSyncStatusRuntime && typeof window.MorphMobileSyncStatusRuntime.create === 'function') return;

  function createMobileSyncStatusRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};

    function getWindowRef() {
      if (typeof api.getWindowRef === 'function') return api.getWindowRef();
      if (typeof window !== 'undefined') return window;
      return null;
    }

    function getDocumentRef() {
      if (typeof api.getDocumentRef === 'function') return api.getDocumentRef();
      if (typeof document !== 'undefined') return document;
      return null;
    }

    function isMobileNavMode() {
      if (typeof api.isMobileNavMode === 'function') {
        return api.isMobileNavMode() === true;
      }
      return false;
    }

    function setStylePropertyCompat(style, cssProperty, value, important = false) {
      if (!style || !cssProperty) return;
      if (typeof style.setProperty === 'function') {
        style.setProperty(cssProperty, value, important ? 'important' : '');
        return;
      }
      const camelProperty = String(cssProperty).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      style[camelProperty] = value;
    }

    function removeStylePropertyCompat(style, cssProperty) {
      if (!style || !cssProperty) return;
      if (typeof style.removeProperty === 'function') {
        style.removeProperty(cssProperty);
        return;
      }
      const camelProperty = String(cssProperty).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      style[camelProperty] = '';
    }

    function getMobileCompactSyncStatusText(text = '') {
      const normalized = String(text || '').trim();
      if (!normalized) return '同步待更新';
      if (/启动数据补水中|启动补水中|hydrating-startup-snapshot/i.test(normalized)) return '启动补水中';
      if (/回退同步中|fallback/i.test(normalized)) return '回退同步中';
      if (/辅助同步服务未连接|无法连接同步服务/.test(normalized) && /浏览器目录仍可写|目录里/.test(normalized)) return '目录直写正常';
      if (/offline|离线/i.test(normalized)) return '同步已离线';
      if (/已载入用户目录|已从用户目录重新载入/.test(normalized)) return '目录已载入';
      if (/用户目录/i.test(normalized) && /(已同步|已加载|已写入)/.test(normalized)) return '用户目录已同步';
      if (/本地已保存，等待多端确认/.test(normalized)) return '待多端确认';
      if (/本地已保存，等待同步确认/.test(normalized)) return '待同步确认';
      if (/同步中|pending|syncing/i.test(normalized)) return '同步中';
      if (/已同步|已就绪|ready|ok/i.test(normalized)) return '已同步';
      if (/未同步|idle/i.test(normalized)) return '待同步';
      if (normalized.length > 10) return `${normalized.slice(0, 9)}…`;
      return normalized;
    }

    function syncMobileSyncStatusIndicator(state = '', text = '') {
      const doc = getDocumentRef();
      const win = getWindowRef();
      if (!doc || !win) return;
      const syncStatus = doc.getElementById('sync-status');
      const label = doc.getElementById('sync-status-text');
      if (!syncStatus || !label) return;
      const dot = doc.getElementById('sync-status-dot');
      const incomingText = String(text || '').trim();
      const normalizedState = String(state || '').trim();
      const fallbackFromState = normalizedState === 'syncing'
        ? '同步中'
        : (normalizedState === 'ok' ? '已同步' : '');
      const fullText = incomingText
        || String(label.dataset?.fullText || label.textContent || '').trim()
        || fallbackFromState
        || '同步待更新';
      if (!label.dataset || typeof label.dataset !== 'object') label.dataset = {};
      label.dataset.fullText = fullText;
      label.title = fullText;
      const mobile = isMobileNavMode();
      if (!mobile) {
        label.textContent = fullText;
        ['display', 'position', 'right', 'left', 'bottom', 'padding', 'gap', 'border-radius', 'font-size', 'line-height', 'max-width', 'pointer-events', 'z-index', 'transform'].forEach((property) => {
          removeStylePropertyCompat(syncStatus.style, property);
        });
        ['max-width', 'overflow', 'text-overflow', 'white-space'].forEach((property) => {
          removeStylePropertyCompat(label.style, property);
        });
        if (dot) {
          ['width', 'height'].forEach((property) => removeStylePropertyCompat(dot.style, property));
        }
        return;
      }
      const nav = doc.getElementById('mobile-bottom-nav');
      const quickBtn = doc.getElementById('mobile-quick-compose-btn');
      const navVisible = !!(nav && !nav.classList.contains('hidden') && nav.style.display !== 'none');
      const quickVisible = !!(quickBtn && !quickBtn.classList.contains('hidden') && quickBtn.style.display !== 'none');
      const navRect = navVisible && typeof nav?.getBoundingClientRect === 'function'
        ? nav.getBoundingClientRect()
        : null;
      const quickRect = quickVisible && typeof quickBtn?.getBoundingClientRect === 'function'
        ? quickBtn.getBoundingClientRect()
        : null;
      const navBottomGap = navRect ? Math.max(0, win.innerHeight - navRect.top) : 0;
      const quickBottomGap = quickRect ? Math.max(0, win.innerHeight - quickRect.top) : 0;
      const overlayHeight = Math.max(navBottomGap, quickBottomGap, 0);
      const bottomPx = overlayHeight > 0 ? Math.max(overlayHeight + 6, 58) : 10;
      const quickRightGap = quickRect ? Math.max(0, win.innerWidth - quickRect.left) : 0;
      const rightPx = quickVisible ? Math.max(Math.ceil(quickRightGap + 6), 74) : 10;
      const maxWidthPx = Math.max(132, Math.min(248, Math.floor(win.innerWidth - rightPx - 12)));
      syncStatus.classList.remove('hidden');
      setStylePropertyCompat(syncStatus.style, 'display', 'inline-flex', true);
      setStylePropertyCompat(syncStatus.style, 'position', 'fixed', true);
      setStylePropertyCompat(syncStatus.style, 'right', `${rightPx}px`);
      setStylePropertyCompat(syncStatus.style, 'left', 'auto');
      setStylePropertyCompat(syncStatus.style, 'bottom', `${bottomPx}px`);
      setStylePropertyCompat(syncStatus.style, 'padding', '0.2rem 0.45rem');
      setStylePropertyCompat(syncStatus.style, 'gap', '0.25rem');
      setStylePropertyCompat(syncStatus.style, 'border-radius', '9999px');
      setStylePropertyCompat(syncStatus.style, 'font-size', '9px');
      setStylePropertyCompat(syncStatus.style, 'line-height', '1.15');
      setStylePropertyCompat(syncStatus.style, 'max-width', `${maxWidthPx}px`);
      setStylePropertyCompat(syncStatus.style, 'pointer-events', 'none');
      setStylePropertyCompat(syncStatus.style, 'z-index', '35');
      setStylePropertyCompat(syncStatus.style, 'transform', 'translateZ(0)');
      label.textContent = getMobileCompactSyncStatusText(fullText);
      setStylePropertyCompat(label.style, 'max-width', `${Math.max(104, maxWidthPx - 22)}px`);
      setStylePropertyCompat(label.style, 'overflow', 'hidden');
      setStylePropertyCompat(label.style, 'text-overflow', 'ellipsis');
      setStylePropertyCompat(label.style, 'white-space', 'nowrap');
      if (dot) {
        setStylePropertyCompat(dot.style, 'width', '0.35rem');
        setStylePropertyCompat(dot.style, 'height', '0.35rem');
      }
    }

    function setGlobalSyncStatusText(text = '') {
      const doc = getDocumentRef();
      if (!doc) return;
      const label = doc.getElementById('sync-status-text');
      const nextText = String(text || '').trim();
      if (label) label.textContent = nextText;
      syncMobileSyncStatusIndicator('', nextText);
    }

    return {
      setStylePropertyCompat,
      removeStylePropertyCompat,
      getMobileCompactSyncStatusText,
      syncMobileSyncStatusIndicator,
      setGlobalSyncStatusText,
    };
  }

  window.MorphMobileSyncStatusRuntime = {
    create: createMobileSyncStatusRuntime,
  };
})();
