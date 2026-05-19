// @ts-check

(function initMorphAIChatRenderRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphAIChatRenderRuntime && typeof window.MorphAIChatRenderRuntime.create === 'function';
  const hasDepsRuntime = window.MorphAIChatRenderDepsRuntime && typeof window.MorphAIChatRenderDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createAIChatRenderRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const messageRenderKeyCache = typeof WeakMap === 'function' ? new WeakMap() : null;

    function getDocumentRef() {
      if (typeof api.getDocumentRef === 'function') return api.getDocumentRef();
      if (typeof document !== 'undefined') return document;
      return null;
    }

    function getWindowRef() {
      if (typeof api.getWindowRef === 'function') return api.getWindowRef();
      if (typeof window !== 'undefined') return window;
      return null;
    }

    function isHTMLElement(value) {
      const win = getWindowRef();
      const HTMLElementCtor = win && win.HTMLElement;
      return !!(HTMLElementCtor && value instanceof HTMLElementCtor);
    }

    function escapeHTML(text = '') {
      if (typeof api.escapeHTML === 'function') return api.escapeHTML(text);
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function escapeHTMLText(text = '') {
      return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function escapeHTMLAttr(text = '') {
      return escapeHTMLText(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function renderAIChatMarkdownInline(text) {
      let html = escapeHTMLText(text || '');
      html = html.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
      const codeTokens = [];
      html = html.replace(/`([^`\n]+)`/g, (_, code) => {
        const token = `__AI_CHAT_CODE_${codeTokens.length}__`;
        codeTokens.push(`<code class="ai-chat-md-code-inline">${code}</code>`);
        return token;
      });
      html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
        return `<a class="ai-chat-md-link" href="${escapeHTMLAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      });
      html = html.replace(/\*\*([^*\n][\s\S]*?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      html = html.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (_m, prefix, url) => `${prefix}<a class="ai-chat-md-link" href="${escapeHTMLAttr(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`);
      html = html.replace(/__AI_CHAT_CODE_(\d+)__/g, (_m, idx) => codeTokens[Number(idx)] || '');
      return html;
    }

    function splitAIChatMarkdownTableRow(line) {
      const raw = String(line || '').trim();
      if (!raw.includes('|')) return [];
      const normalized = raw.replace(/^\|/, '').replace(/\|$/, '');
      return normalized.split('|').map((cell) => cell.trim());
    }

    function isAIChatMarkdownTableSeparator(line) {
      const cells = splitAIChatMarkdownTableRow(line);
      if (!cells.length) return false;
      return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
    }

    function renderAIChatMarkdownTable(lines, startIndex) {
      const headerCells = splitAIChatMarkdownTableRow(lines[startIndex]);
      if (!headerCells.length) return null;
      if (!isAIChatMarkdownTableSeparator(lines[startIndex + 1] || '')) return null;
      const rows = [];
      let idx = startIndex + 2;
      while (idx < lines.length) {
        const rawLine = String(lines[idx] || '');
        const trimmed = rawLine.trim();
        if (!trimmed || !trimmed.includes('|')) break;
        if (isAIChatMarkdownTableSeparator(trimmed)) break;
        rows.push(splitAIChatMarkdownTableRow(rawLine));
        idx += 1;
      }
      const headHtml = headerCells.map((cell) => `<th>${renderAIChatMarkdownInline(cell)}</th>`).join('');
      const bodyHtml = rows.map((cells) => `<tr>${headerCells.map((_, colIdx) => `<td>${renderAIChatMarkdownInline(cells[colIdx] || '')}</td>`).join('')}</tr>`).join('');
      return {
        html: `<div class="ai-chat-md-table-wrap"><table class="ai-chat-md-table"><thead><tr>${headHtml}</tr></thead>${bodyHtml ? `<tbody>${bodyHtml}</tbody>` : ''}</table></div>`,
        nextIndex: idx,
      };
    }

    function renderAIChatMarkdown(text) {
      const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      if (!src.trim()) return '';
      const lines = src.split('\n');
      const out = [];
      let inCodeFence = false;
      let codeLines = [];
      let listType = '';
      const closeList = () => {
        if (!listType) return;
        out.push(listType === 'ol' ? '</ol>' : '</ul>');
        listType = '';
      };
      const openList = (type) => {
        if (listType === type) return;
        closeList();
        out.push(type === 'ol' ? '<ol class="ai-chat-md-list-ai ai-chat-md-list-ol">' : '<ul class="ai-chat-md-list-ai ai-chat-md-list-ul">');
        listType = type;
      };
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const trimmed = line.trim();
        if (/^```/.test(trimmed)) {
          closeList();
          if (!inCodeFence) {
            inCodeFence = true;
            codeLines = [];
          } else {
            const codeHtml = escapeHTMLText(codeLines.join('\n'));
            out.push(`<pre class="ai-chat-md-code-block"><code>${codeHtml}</code></pre>`);
            inCodeFence = false;
            codeLines = [];
          }
          continue;
        }
        if (inCodeFence) {
          codeLines.push(line);
          continue;
        }
        if (!trimmed) {
          if (listType) continue;
          closeList();
          continue;
        }
        if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
          closeList();
          out.push('<hr class="ai-chat-md-hr">');
          continue;
        }
        const table = renderAIChatMarkdownTable(lines, index);
        if (table) {
          closeList();
          out.push(table.html);
          index = table.nextIndex - 1;
          continue;
        }
        const head = line.match(/^(#{1,6})\s+(.+)$/);
        if (head) {
          closeList();
          const level = Math.min(6, head[1].length);
          out.push(`<h${level} class="ai-chat-md-h${level}">${renderAIChatMarkdownInline(head[2].trim())}</h${level}>`);
          continue;
        }
        const ol = line.match(/^\s*(\d+)[.)、]\s+(.+)$/);
        if (ol) {
          openList('ol');
          out.push(`<li>${renderAIChatMarkdownInline(ol[2].trim())}</li>`);
          continue;
        }
        const ul = line.match(/^\s*[-*+]\s+(.+)$/);
        if (ul) {
          openList('ul');
          out.push(`<li>${renderAIChatMarkdownInline(ul[1].trim())}</li>`);
          continue;
        }
        const quote = line.match(/^\s*>\s?(.+)$/);
        if (quote) {
          closeList();
          out.push(`<blockquote class="ai-chat-md-quote">${renderAIChatMarkdownInline(quote[1].trim())}</blockquote>`);
          continue;
        }
        closeList();
        out.push(`<p class="ai-chat-md-p">${renderAIChatMarkdownInline(line)}</p>`);
      }
      if (inCodeFence) {
        const codeHtml = escapeHTMLText(codeLines.join('\n'));
        out.push(`<pre class="ai-chat-md-code-block"><code>${codeHtml}</code></pre>`);
      }
      closeList();
      return out.join('');
    }

    function buildAIChatEmptyStateHtml() {
      return '<div class="ai-chat-empty-state h-full min-h-[12rem] flex flex-col items-center justify-center text-center text-[11px] font-mono text-gray-400 dark:text-white/35 px-6 gap-3"><div>你可以让 AI 总结当前内容，或直接要求它新增闪念 / 定念，或编辑某个项目。</div></div>';
    }

    function syncAIChatBubbleLayoutForItem(item) {
      if (!isHTMLElement(item)) return;
      const bubble = item.querySelector('.ai-chat-bubble');
      if (!bubble) return;
      item.classList.remove('ai-chat-item-multiline');
      const win = getWindowRef();
      const style = win ? win.getComputedStyle(bubble) : { lineHeight: '18', paddingTop: '0', paddingBottom: '0' };
      const lineHeight = Number.parseFloat(style.lineHeight) || 18;
      const paddingTop = Number.parseFloat(style.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
      const singleLineHeight = lineHeight + paddingTop + paddingBottom + 4;
      const multiline = bubble.scrollHeight > singleLineHeight || bubble.querySelector('.ai-chat-md-p + .ai-chat-md-p, .ai-chat-md-code-block, .ai-chat-md-table, ul, ol, blockquote, pre');
      if (multiline) item.classList.add('ai-chat-item-multiline');
    }

    function syncAIChatBubbleLayout(container = null) {
      const doc = getDocumentRef();
      const root = container || doc?.getElementById?.('ai-chat-messages');
      if (!root) return;
      const items = root.querySelectorAll('.ai-chat-item');
      items.forEach((item) => syncAIChatBubbleLayoutForItem(item));
    }

    function getVisibleAIChatActionLabels(msg = {}) {
      const safeMsg = msg && typeof msg === 'object' ? msg : {};
      const contentText = String(safeMsg.content || '').trim();
      const createdItems = Array.isArray(safeMsg.meta?.createdItems) ? safeMsg.meta.createdItems : [];
      const hasTimeBlockCards = createdItems.some((item) => (
        item
        && /^(?:timeBlocks|weekTimeBlocks)$/.test(String(item.tab || '').trim())
      ));
      return (Array.isArray(safeMsg.meta?.actions) ? safeMsg.meta.actions : [])
        .map((label) => String(label || '').trim())
        .filter(Boolean)
        .filter((label) => !(hasTimeBlockCards && contentText && label === contentText));
    }

    function buildAIChatMessageHtml(msg) {
      const safeMsg = msg && typeof msg === 'object' ? msg : {};
      const isUser = safeMsg.role === 'user';
      const isSystem = safeMsg.role === 'system';
      const bubbleClass = isUser
        ? 'ml-auto'
        : isSystem
          ? 'bg-gray-100 text-gray-700 dark:bg-[#2c2727] dark:text-white/80'
          : 'bg-gray-50 text-gray-800 dark:bg-[#2a2525] dark:text-white/88';
      const bubbleRoleClass = isUser
        ? 'ai-chat-bubble-user'
        : isSystem
          ? 'ai-chat-bubble-system'
          : 'ai-chat-bubble-assistant';
      const visibleActionLabels = getVisibleAIChatActionLabels(safeMsg);
      const actionHtml = visibleActionLabels.length
        ? `<div class="mt-2 flex flex-wrap gap-1">${visibleActionLabels.map((label) => `<span class="ai-chat-action-chip px-2 py-1 rounded-full bg-black/5 dark:bg-[#332e2e] text-[9px] font-mono">${escapeHTML(label)}</span>`).join('')}</div>`
        : '';
      const receiptSummary = String(safeMsg.meta?.receiptSummary || '').trim();
      const undoHint = String(safeMsg.meta?.undoHint || '').trim();
      const receiptHtml = receiptSummary
        ? `<div class="mt-2 ai-chat-receipt-card">
                <div class="ai-chat-receipt-summary">${escapeHTML(receiptSummary)}</div>
                ${undoHint ? `<div class="ai-chat-receipt-hint">${escapeHTML(undoHint)}</div>` : ''}
           </div>`
        : '';
      const navTargets = typeof api.mergeAIChatCitationTargets === 'function'
        ? api.mergeAIChatCitationTargets(safeMsg.meta, safeMsg.content)
        : [];
      const citationNavHtml = navTargets.length
        ? `<div class="mt-2 flex flex-wrap gap-1.5">${navTargets.map((item) => `<button type="button" onclick="return navigateAIChatCitation('${encodeURIComponent(item.source)}')" class="ai-chat-action-chip px-2.5 py-1 rounded-full bg-black/5 dark:bg-[#332e2e] text-[9px] font-mono inline-flex items-center gap-1.5 hover:bg-black/10 dark:hover:bg-[#403838] transition-colors"><i data-lucide="${escapeHTML(item.icon)}" class="w-3 h-3"></i><span>${escapeHTML(item.label)}</span></button>`).join('')}</div>`
        : '';
      const contentHtml = isSystem
        ? `<p class="ai-chat-md-p">${escapeHTML(safeMsg.content)}</p>`
        : renderAIChatMarkdown(safeMsg.content);
      const attachmentPreviewHtml = Array.isArray(safeMsg.meta?.attachments) && safeMsg.meta.attachments.length && typeof api.renderAIChatAttachmentPreviewHtml === 'function'
        ? api.renderAIChatAttachmentPreviewHtml(safeMsg.meta.attachments, { compact: true })
        : '';
      const createdItems = safeMsg.meta?.createdItems || [];
      const timeBlocksHtml = typeof api.renderAIChatTimeBlocksHtml === 'function'
        ? api.renderAIChatTimeBlocksHtml(createdItems, safeMsg.content || '')
        : '';
      const weekTimeBlocksHtml = typeof api.renderAIChatWeekTimeBlocksHtml === 'function'
        ? api.renderAIChatWeekTimeBlocksHtml(createdItems)
        : '';
      return `<div class="ai-chat-item ${isUser ? 'self-end' : 'self-start'}" data-ai-chat-message-id="${safeMsg.id}" oncontextmenu="return handleAIChatMessageContext(event, '${safeMsg.id}')">
        <div class="ai-chat-bubble ai-chat-md reading-body-text ${bubbleRoleClass} rounded-2xl px-4 py-3 break-words ${bubbleClass}">${contentHtml}${attachmentPreviewHtml}${timeBlocksHtml}${weekTimeBlocksHtml}</div>
        ${receiptHtml}
        ${actionHtml}
        ${citationNavHtml}
        <div class="mt-1 px-1 text-[9px] font-mono text-gray-400 dark:text-white/30 ${isUser ? 'text-right' : 'text-left'}">${safeMsg.time}</div>
      </div>`;
    }

    function buildStableTextSignature(text = '') {
      const source = String(text || '');
      let hash = 2166136261;
      for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return `${source.length}:${hash >>> 0}`;
    }

    function buildMetaRenderSignature(meta = null) {
      if (!meta || typeof meta !== 'object') return String(meta || '');
      try {
        return buildStableTextSignature(JSON.stringify(meta));
      } catch (_) {
        return buildStableTextSignature(Object.keys(meta).sort().map((key) => `${key}:${typeof meta[key]}`).join('|'));
      }
    }

    function getAIChatMessageRenderKey(msg) {
      const safeMsg = msg && typeof msg === 'object' ? msg : null;
      const messageId = String(safeMsg?.id || '');
      const role = String(safeMsg?.role || '');
      const content = String(safeMsg?.content || '');
      const meta = safeMsg?.meta || null;
      const time = String(safeMsg?.time || '');
      const contentSignature = buildStableTextSignature(content);
      const metaSignature = buildMetaRenderSignature(meta);
      if (messageRenderKeyCache && safeMsg) {
        const cached = messageRenderKeyCache.get(safeMsg);
        if (
          cached
          && cached.id === messageId
          && cached.role === role
          && cached.contentSignature === contentSignature
          && cached.meta === meta
          && cached.metaSignature === metaSignature
          && cached.time === time
        ) {
          return cached.key;
        }
      }
      const key = [
        messageId,
        role,
        contentSignature,
        metaSignature,
        time,
      ].join('::');
      if (messageRenderKeyCache && safeMsg) {
        messageRenderKeyCache.set(safeMsg, {
          id: messageId,
          role,
          contentSignature,
          meta,
          metaSignature,
          time,
          key,
        });
      }
      return key;
    }

    function buildLegacyAIChatMessageId(msg, index = 0) {
      const base = getAIChatMessageRenderKey(msg);
      let hash = 0;
      for (let i = 0; i < base.length; i += 1) {
        hash = ((hash << 5) - hash) + base.charCodeAt(i);
        hash |= 0;
      }
      return `legacy_${Math.max(0, Number(index) || 0)}_${Math.abs(hash)}`;
    }

    function normalizeAIChatRenderableMessages(messages = []) {
      const safeMessages = Array.isArray(messages) ? messages : [];
      return safeMessages.map((msg, index) => {
        const safeMsg = msg && typeof msg === 'object' ? msg : {};
        const currentId = String(safeMsg.id || '').trim();
        if (currentId) return safeMsg;
        return {
          ...safeMsg,
          id: buildLegacyAIChatMessageId(safeMsg, index),
        };
      });
    }

    function buildAIChatMessageListSignature(messages = []) {
      return (Array.isArray(messages) ? messages : []).map((msg) => {
        const messageId = String(msg?.id || '').trim();
        return `${messageId}::${getAIChatMessageRenderKey(msg)}`;
      }).join('|');
    }

    function renderAIChatMessageListFallback(container, messages = []) {
      if (!isHTMLElement(container)) return;
      const safeMessages = normalizeAIChatRenderableMessages(messages);
      const listSignature = buildAIChatMessageListSignature(safeMessages);
      container.innerHTML = safeMessages.length
        ? safeMessages.map((msg) => buildAIChatMessageHtml(msg)).join('')
        : buildAIChatEmptyStateHtml();
      container.__morphAIChatEmptyStateHtml = safeMessages.length ? '' : buildAIChatEmptyStateHtml();
      container.__morphAIChatMessageListSignature = listSignature;
      container.__morphAIChatMessageListCount = safeMessages.length;
    }

    function createAIChatMessageElement(msg) {
      const doc = getDocumentRef();
      if (!doc || typeof doc.createElement !== 'function') return null;
      const template = doc.createElement('template');
      template.innerHTML = buildAIChatMessageHtml(msg).trim();
      const item = template.content.firstElementChild;
      if (!isHTMLElement(item)) return null;
      item.__morphAIChatRenderKey = getAIChatMessageRenderKey(msg);
      return item;
    }

    function isAIChatMessageListDomEquivalent(container, messages = []) {
      if (!isHTMLElement(container)) return false;
      const safeMessages = Array.isArray(messages) ? messages : [];
      const children = container.children;
      if (!children || Number(children.length || 0) !== safeMessages.length) return false;
      for (let index = 0; index < safeMessages.length; index += 1) {
        const item = children[index];
        if (!isHTMLElement(item) || !item.classList?.contains?.('ai-chat-item')) return false;
        const messageId = String(item.getAttribute?.('data-ai-chat-message-id') || '').trim();
        const expectedId = String(safeMessages[index]?.id || '').trim();
        if (!messageId || messageId !== expectedId) return false;
        if (item.__morphAIChatRenderKey !== getAIChatMessageRenderKey(safeMessages[index])) return false;
      }
      return true;
    }

    function getAIChatTailPatchPlan(container, messages = []) {
      if (!isHTMLElement(container)) return false;
      const safeMessages = Array.isArray(messages) ? messages : [];
      if (!safeMessages.length) return false;
      const children = container.children;
      if (!children || Number(children.length || 0) !== safeMessages.length) return false;
      const lastIndex = safeMessages.length - 1;
      let tailItem = null;
      let tailMessage = null;
      for (let index = 0; index < safeMessages.length; index += 1) {
        const item = children[index];
        if (!isHTMLElement(item) || !item.classList?.contains?.('ai-chat-item')) return false;
        const messageId = String(item.getAttribute?.('data-ai-chat-message-id') || '').trim();
        const expectedId = String(safeMessages[index]?.id || '').trim();
        if (!messageId || messageId !== expectedId) return false;
        const nextRenderKey = getAIChatMessageRenderKey(safeMessages[index]);
        if (index < lastIndex) {
          if (item.__morphAIChatRenderKey !== nextRenderKey) return false;
          continue;
        }
        if (item.__morphAIChatRenderKey === nextRenderKey) return false;
        tailItem = item;
        tailMessage = safeMessages[index];
      }
      if (!tailItem || !tailMessage) return false;
      return { tailItem, tailMessage };
    }

    function tryPatchAIChatTailMessage(container, messages = []) {
      const patchPlan = getAIChatTailPatchPlan(container, messages);
      if (!patchPlan) return false;
      const { tailItem, tailMessage } = patchPlan;
      const replacement = createAIChatMessageElement(tailMessage);
      if (!replacement) return false;
      tailItem.replaceWith(replacement);
      syncAIChatBubbleLayoutForItem(replacement);
      return true;
    }

    function classifyAIChatMessageListUpdate(container, messages = []) {
      if (!isHTMLElement(container)) return 'unsupported';
      const safeMessages = normalizeAIChatRenderableMessages(messages);
      if (!safeMessages.length) {
        const emptyStateHtml = buildAIChatEmptyStateHtml();
        const emptyStateStable = (
          container.__morphAIChatEmptyStateHtml === emptyStateHtml
          && !!container.querySelector('.ai-chat-empty-state')
        );
        return emptyStateStable ? 'noop_empty' : 'replace_empty';
      }
      if (isAIChatMessageListDomEquivalent(container, safeMessages)) return 'noop_dom';
      if (getAIChatTailPatchPlan(container, safeMessages)) return 'tail_patch';
      return 'diff';
    }

    function syncAIChatMessageList(container, messages = []) {
      if (!isHTMLElement(container)) return;
      const safeMessages = normalizeAIChatRenderableMessages(messages);
      if (!safeMessages.length) {
        const emptyStateHtml = buildAIChatEmptyStateHtml();
        if (container.__morphAIChatEmptyStateHtml !== emptyStateHtml || !container.querySelector('.ai-chat-empty-state')) {
          container.innerHTML = emptyStateHtml;
          container.__morphAIChatEmptyStateHtml = emptyStateHtml;
        }
        container.__morphAIChatMessageListSignature = '';
        container.__morphAIChatMessageListCount = 0;
        return;
      }
      try {
        container.__morphAIChatEmptyStateHtml = '';
        const updateKind = classifyAIChatMessageListUpdate(container, safeMessages);
        if (updateKind === 'noop_dom') {
          container.__morphAIChatMessageListCount = safeMessages.length;
          return;
        }
        if (updateKind === 'tail_patch' && tryPatchAIChatTailMessage(container, safeMessages)) {
          container.__morphAIChatMessageListSignature = buildAIChatMessageListSignature(safeMessages);
          container.__morphAIChatMessageListCount = safeMessages.length;
          return;
        }
        const listSignature = buildAIChatMessageListSignature(safeMessages);
        const hasRenderedItems = !!container.querySelector('.ai-chat-item[data-ai-chat-message-id]');
        if (
          hasRenderedItems
          && String(container.__morphAIChatMessageListSignature || '') === listSignature
          && Number(container.__morphAIChatMessageListCount || 0) === safeMessages.length
        ) {
          return;
        }
        const existingById = new Map();
        Array.from(container.children).forEach((child) => {
          if (!isHTMLElement(child)) return;
          const messageId = String(child.getAttribute('data-ai-chat-message-id') || '').trim();
          if (child.classList.contains('ai-chat-item') && messageId) {
            existingById.set(messageId, child);
          }
        });
        const retainedIds = new Set();
        let cursor = container.firstChild;
        safeMessages.forEach((msg) => {
          const messageId = String(msg?.id || '').trim();
          if (!messageId) return;
          retainedIds.add(messageId);
          let item = existingById.get(messageId) || null;
          if (!item) {
            item = createAIChatMessageElement(msg);
            if (!item) return;
            container.insertBefore(item, cursor);
            syncAIChatBubbleLayoutForItem(item);
          } else {
            if (item !== cursor) {
              container.insertBefore(item, cursor);
            }
            const nextRenderKey = getAIChatMessageRenderKey(msg);
            if (item.__morphAIChatRenderKey !== nextRenderKey) {
              const replacement = createAIChatMessageElement(msg);
              if (replacement) {
                item.replaceWith(replacement);
                item = replacement;
                syncAIChatBubbleLayoutForItem(item);
              }
            }
          }
          cursor = item?.nextSibling || null;
        });
        Array.from(container.children).forEach((child) => {
          if (!isHTMLElement(child)) return;
          const messageId = String(child.getAttribute('data-ai-chat-message-id') || '').trim();
          if (!child.classList.contains('ai-chat-item') || !retainedIds.has(messageId)) {
            child.remove();
          }
        });
        if (!container.querySelector('.ai-chat-item[data-ai-chat-message-id]')) {
          renderAIChatMessageListFallback(container, safeMessages);
        } else {
          container.__morphAIChatMessageListSignature = listSignature;
          container.__morphAIChatMessageListCount = safeMessages.length;
        }
      } catch (error) {
        console.warn('[Morpheus AI Chat] Incremental message render failed, fallback to full render.', error);
        renderAIChatMessageListFallback(container, safeMessages);
      }
    }

    return {
      syncAIChatBubbleLayoutForItem,
      syncAIChatBubbleLayout,
      buildAIChatEmptyStateHtml,
      buildAIChatMessageHtml,
      getAIChatMessageRenderKey,
      classifyAIChatMessageListUpdate,
      renderAIChatMarkdown,
      syncAIChatMessageList,
    };
  }

  window.MorphAIChatRenderRuntime = {
    create: createAIChatRenderRuntime,
  };

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createAIChatRenderDepsRuntime(root) {
    const currentRoot = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || currentRoot;
    const getGlobalFunction = (name = '') => {
      const key = String(name || '').trim();
      if (!key) return null;
      const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
      if (typeof fromGlobal === 'function') return fromGlobal;
      const fromRoot = currentRoot && typeof currentRoot[key] === 'function' ? currentRoot[key] : null;
      return typeof fromRoot === 'function' ? fromRoot : null;
    };
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
        getWindowRef: pickFunction(context.getWindowRef, () => currentRoot || null),
        getDocumentRef: pickFunction(context.getDocumentRef, () => getGlobalValue('document', currentRoot?.document || null)),
        escapeHTML: pickFunction(context.escapeHTML, getGlobalFunction('escapeHTML') || ((text = '') => String(text || ''))),
        mergeAIChatCitationTargets: pickFunction(context.mergeAIChatCitationTargets, getGlobalFunction('mergeAIChatCitationTargets') || (() => [])),
        renderAIChatAttachmentPreviewHtml: pickFunction(context.renderAIChatAttachmentPreviewHtml, getGlobalFunction('renderAIChatAttachmentPreviewHtml') || (() => '')),
        renderAIChatTimeBlocksHtml: pickFunction(context.renderAIChatTimeBlocksHtml, getGlobalFunction('renderAIChatTimeBlocksHtml') || (() => '')),
        renderAIChatWeekTimeBlocksHtml: pickFunction(context.renderAIChatWeekTimeBlocksHtml, getGlobalFunction('renderAIChatWeekTimeBlocksHtml') || (() => '')),
      };
    }

    return { buildAppDeps };
  }

  window.MorphAIChatRenderDepsRuntime = { create: () => createAIChatRenderDepsRuntime(window) };
})();
