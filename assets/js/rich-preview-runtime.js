// @ts-check

(function initMorphRichPreviewRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphRichPreviewRuntime && typeof window.MorphRichPreviewRuntime.create === 'function';
  const hasDepsRuntime = window.MorphRichPreviewDepsRuntime && typeof window.MorphRichPreviewDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createRichPreviewRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const getIsLightMode = typeof api.getIsLightMode === 'function'
      ? api.getIsLightMode
      : () => !!window.isLightMode;

    function getStandaloneURL(text = '') {
      const value = String(text || '').trim();
      if (!value) return '';
      return /^https?:\/\/\S+$/i.test(value) ? value : '';
    }

    function getFirstURLFromItem(item) {
      const html = typeof item?.html === 'string' ? item.html : '';
      const richUrl = html.match(/rich-link-node[^>]*data-url=["']([^"']+)["']/i)?.[1];
      if (richUrl) return richUrl;
      const text = String(item?.text || '').trim();
      return text.match(/https?:\/\/[^\s]+/i)?.[0] || '';
    }

    function hasStoredCompactPreviewData(item) {
      return !!(item?.linkPreview && (item.linkPreview.title || item.linkPreview.imageUrl || item.linkPreview.url));
    }

    function hasStoredRichPreview(item) {
      const html = typeof item?.html === 'string' ? item.html : '';
      if (!html) return false;
      return /<h4\b/i.test(html) || /<img\b/i.test(html) || /data-loaded=["']true["']/i.test(html);
    }

    function buildStoredRichPreviewHTML(url, result) {
      if (!result || result.status !== 'success' || !result.data) return '';
      const { title, description, image, url: targetUrl } = result.data;
      const isLightMode = !!getIsLightMode();
      const imgBg = isLightMode ? 'bg-gray-100 border-r border-gray-200' : 'bg-white/[0.03] border-r border-white/8';
      const iconBg = isLightMode ? 'bg-white shadow-sm' : 'bg-white/[0.08]';
      const iconColor = isLightMode ? 'text-gray-600' : 'text-white';
      const titleColor = isLightMode ? 'text-gray-900' : 'text-white/90';
      const descColor = isLightMode ? 'text-gray-500' : 'text-white/58';
      const hoverBg = isLightMode ? 'hover:bg-gray-100/50' : 'hover:bg-white/[0.04]';
      const safeUrl = String(url || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return `<span class="rich-link-node flex items-center h-[80px] my-3 w-full max-w-lg border rounded-xl ${isLightMode ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-[#2f2a2a] border-white/10 text-white/60'} overflow-hidden select-none cursor-pointer hover:border-gray-400 dark:hover:border-white/30 transition-colors relative" contenteditable="false" data-url="${safeUrl}" data-mode="preview" data-loaded="true"><div class="group flex w-full h-full relative ${hoverBg} transition-colors">${image && image.url ? `<div class="w-24 h-full shrink-0 ${imgBg}"><img loading="lazy" decoding="async" src="${image.url}" class="w-full h-full object-cover opacity-90 dark:opacity-80 group-hover:opacity-100 transition-opacity" onerror="this.style.display='none'"/></div>` : ''}<div class="p-3 flex flex-col justify-center flex-1 min-w-0 h-full bg-transparent"><h4 class="text-[12px] ${titleColor} font-medium truncate mb-1">${title || targetUrl}</h4><p class="text-[10px] ${descColor} line-clamp-2 leading-relaxed">${description || '无摘要信息'}</p></div><div class="absolute top-2 right-2 ${iconBg} p-1.5 rounded backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><i data-lucide="external-link" class="w-3 h-3 ${iconColor}"></i></div></div></span>`;
    }

    function compactPreviewCacheResult(result = null) {
      if (!result || typeof result !== 'object') return null;
      const data = result.data && typeof result.data === 'object' ? result.data : {};
      return {
        status: String(result.status || '').trim() || 'unknown',
        data: {
          title: String(data.title || '').trim(),
          description: String(data.description || '').trim(),
          url: String(data.url || '').trim(),
          image: data.image && typeof data.image === 'object' && data.image.url
            ? { url: String(data.image.url || '').trim() }
            : null,
        },
      };
    }

    return {
      getStandaloneURL,
      getFirstURLFromItem,
      hasStoredCompactPreviewData,
      hasStoredRichPreview,
      buildStoredRichPreviewHTML,
      compactPreviewCacheResult,
    };
  }

  window.MorphRichPreviewRuntime = { create: createRichPreviewRuntime };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createRichPreviewDepsRuntime(root) {
    const currentRoot = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || currentRoot;
    const getGlobalValue = (name = '', fallback = null) => {
      const key = String(name || '').trim();
      if (!key) return fallback;
      if (globalRoot && typeof globalRoot[key] !== 'undefined') return globalRoot[key];
      if (currentRoot && typeof currentRoot[key] !== 'undefined') return currentRoot[key];
      return fallback;
    };

    function buildAppDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        getIsLightMode: pickFunction(context.getIsLightMode, () => !!getGlobalValue('isLightMode', false)),
      };
    }

    return { buildAppDeps };
  }

  window.MorphRichPreviewDepsRuntime = { create: () => createRichPreviewDepsRuntime(window) };
})();
