// @ts-check

(function initMorphBlockBatchClipboardRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphBlockBatchClipboardRuntime && typeof window.MorphBlockBatchClipboardRuntime.create === 'function') return;

  function createBlockBatchClipboardRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const buildSelectedBlockBatchClipboardText = typeof api.buildSelectedBlockBatchClipboardText === 'function'
      ? api.buildSelectedBlockBatchClipboardText
      : () => '';
    const buildSelectedBlockBatchClipboardHTML = typeof api.buildSelectedBlockBatchClipboardHTML === 'function'
      ? api.buildSelectedBlockBatchClipboardHTML
      : () => '';
    const deleteSelectedBlockBatch = typeof api.deleteSelectedBlockBatch === 'function'
      ? api.deleteSelectedBlockBatch
      : () => false;
    const getDocumentRef = typeof api.getDocumentRef === 'function'
      ? api.getDocumentRef
      : () => (typeof document !== 'undefined' ? document : null);
    const getNavigatorRef = typeof api.getNavigatorRef === 'function'
      ? api.getNavigatorRef
      : () => (typeof navigator !== 'undefined' ? navigator : null);
    const getClipboardItemCtor = typeof api.getClipboardItemCtor === 'function'
      ? api.getClipboardItemCtor
      : () => (typeof ClipboardItem !== 'undefined' ? ClipboardItem : null);
    const getBlobCtor = typeof api.getBlobCtor === 'function'
      ? api.getBlobCtor
      : () => (typeof Blob !== 'undefined' ? Blob : null);

    async function writeSelectedBlockBatchToClipboard({ cut = false } = {}) {
      const text = buildSelectedBlockBatchClipboardText();
      const html = buildSelectedBlockBatchClipboardHTML();
      if (!text) return false;

      const doc = getDocumentRef();
      const nav = getNavigatorRef();
      const ClipboardItemCtor = getClipboardItemCtor();
      const BlobCtor = getBlobCtor();

      try {
        if (html && nav?.clipboard?.write && typeof ClipboardItemCtor === 'function' && typeof BlobCtor === 'function') {
          await nav.clipboard.write([
            new ClipboardItemCtor({
              'text/plain': new BlobCtor([text], { type: 'text/plain' }),
              'text/html': new BlobCtor([html], { type: 'text/html' }),
            }),
          ]);
        } else if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(text);
        } else if (doc?.createElement && doc?.body) {
          const textarea = doc.createElement('textarea');
          textarea.value = text;
          textarea.setAttribute('readonly', 'true');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          textarea.style.pointerEvents = 'none';
          doc.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const copied = doc.execCommand && doc.execCommand('copy');
          doc.body.removeChild(textarea);
          if (!copied) return false;
        } else {
          return false;
        }
      } catch (_) {
        return false;
      }

      if (cut) deleteSelectedBlockBatch({ keepViewport: true, preserveScroll: true });
      return true;
    }

    return {
      writeSelectedBlockBatchToClipboard,
    };
  }

  window.MorphBlockBatchClipboardRuntime = {
    create: createBlockBatchClipboardRuntime,
  };
})();
