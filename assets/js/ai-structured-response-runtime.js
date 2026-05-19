// @ts-check

(function initMorphAIStructuredResponseRuntime() {
  if (typeof window === 'undefined') return;
  if (window.MorphAIStructuredResponseRuntime && typeof window.MorphAIStructuredResponseRuntime.create === 'function') return;

  function createAIStructuredResponseRuntime() {
    function stripInlineAIActionTags(text = '') {
      return String(text || '')
        .replace(/\s*<{1,2}ACTIONS>{2}[\s\S]*$/i, '')
        .replace(/\s*<{1,2}ACTIONS[\s\S]*$/i, '')
        .replace(/<<[a-z_]+(?::[\s\S]*?)?>>/ig, '')
        .replace(/\s*<<[A-Z]{1,16}\s*$/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    function normalizeStructuredAction(rawAction = null) {
      if (!rawAction || typeof rawAction !== 'object' || Array.isArray(rawAction)) return rawAction;
      const action = { ...rawAction };
      if (!String(action.type || '').trim() && String(action.action || '').trim()) {
        action.type = String(action.action || '').trim();
      }
      const type = String(action.type || '').trim();
      if (['update_expense_record', 'delete_expense_record'].includes(type)) {
        const targetNote = String(action.targetNote || action.searchRemark || action.searchNote || action.noteContains || '').trim();
        const targetText = String(action.targetText || action.searchText || action.searchItem || action.recordText || '').trim();
        if (targetNote && !String(action.targetNote || '').trim()) action.targetNote = targetNote;
        if (targetText && !String(action.targetText || '').trim()) action.targetText = targetText;
        if (Number.isFinite(Number(action.newAmount)) && !Number.isFinite(Number(action.amount))) action.amount = Number(action.newAmount);
        if (String(action.newRemark || '').trim() && !String(action.note || '').trim()) action.note = String(action.newRemark || '').trim();
        if (String(action.newNote || '').trim() && !String(action.note || '').trim()) action.note = String(action.newNote || '').trim();
        if (String(action.newItem || '').trim() && !String(action.item || '').trim()) action.item = String(action.newItem || '').trim();
        if (String(action.newCategory || '').trim() && !String(action.category || '').trim()) action.category = String(action.newCategory || '').trim();
      }
      return action;
    }

    function normalizeStructuredActions(actions = []) {
      return Array.isArray(actions) ? actions.map(normalizeStructuredAction).filter(Boolean) : [];
    }

    function parseInlineAIActionsFromText(text = '') {
      const raw = String(text || '');
      if (!raw) return [];
      const actions = [];
      const tagPattern = /<<([a-z_]+)(?::([\s\S]*?))?>>/ig;
      const splitInlineActionFields = (body = '') => {
        const source = String(body || '');
        if (!source) return [];
        const fields = [];
        let current = '';
        let inQuotes = false;
        let escaped = false;
        for (let i = 0; i < source.length; i += 1) {
          const ch = source[i];
          if (escaped) {
            current += ch;
            escaped = false;
            continue;
          }
          if (ch === '\\') {
            current += ch;
            escaped = true;
            continue;
          }
          if (ch === '"') {
            current += ch;
            inQuotes = !inQuotes;
            continue;
          }
          if (ch === ',' && !inQuotes) {
            if (current.trim()) fields.push(current.trim());
            current = '';
            continue;
          }
          current += ch;
        }
        if (current.trim()) fields.push(current.trim());
        return fields;
      };
      let match = null;
      while ((match = tagPattern.exec(raw))) {
        const type = String(match[1] || '').trim();
        const body = String(match[2] || '').trim();
        if (!type) continue;
        const action = { type };
        if (body) {
          const parts = splitInlineActionFields(body);
          parts.forEach((part) => {
            const colonIndex = part.indexOf(':');
            const equalsIndex = part.indexOf('=');
            const separatorIndex = (() => {
              if (colonIndex > 0 && equalsIndex > 0) return Math.min(colonIndex, equalsIndex);
              if (colonIndex > 0) return colonIndex;
              if (equalsIndex > 0) return equalsIndex;
              return -1;
            })();
            if (separatorIndex <= 0) return;
            const key = String(part.slice(0, separatorIndex) || '').trim();
            const rawValue = String(part.slice(separatorIndex + 1) || '').trim();
            if (!key) return;
            let value;
            if (/^".*"$/.test(rawValue)) {
              try {
                value = JSON.parse(rawValue);
              } catch (_) {
                value = rawValue.slice(1, -1);
              }
            } else if (/^(true|false)$/i.test(rawValue)) {
              value = /^true$/i.test(rawValue);
            } else if (/^null$/i.test(rawValue)) {
              value = null;
            } else if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
              value = Number(rawValue);
            } else {
              value = rawValue;
            }
            action[key] = value;
          });
        }
        actions.push(action);
      }
      return actions;
    }

    function extractJSONBlock(text) {
      const raw = String(text || '').trim();
      if (!raw) return null;
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = fenced ? fenced[1].trim() : raw;
      try { return JSON.parse(candidate); } catch (_) {}
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { return JSON.parse(candidate.slice(start, end + 1)); } catch (_) {}
      }
      return null;
    }

    function splitAIChatStructuredResponse(text) {
      const raw = String(text || '');
      const markerMatch = raw.match(/<{1,2}ACTIONS>{2}/i);
      if (!markerMatch) {
        const partialIdx = raw.search(/<{1,2}ACTIONS/i);
        return {
          reply: stripInlineAIActionTags(partialIdx >= 0 ? raw.slice(0, partialIdx) : raw),
          actionsPayload: null,
          hasMarker: partialIdx >= 0 || /<<[a-z_]+(?::[\s\S]*?)?>>/i.test(raw),
        };
      }
      const idx = markerMatch.index || 0;
      return {
        reply: stripInlineAIActionTags(raw.slice(0, idx)),
        actionsPayload: raw.slice(idx + markerMatch[0].length).trim(),
        hasMarker: true,
      };
    }

    function extractAIChatStructuredResponse(text) {
      const parts = splitAIChatStructuredResponse(text);
      let parsed = parts.actionsPayload ? extractJSONBlock(parts.actionsPayload) : null;
      let actions = normalizeStructuredActions(Array.isArray(parsed?.actions) ? parsed.actions : []);
      let reply = parts.reply;
      const inlineActions = parseInlineAIActionsFromText(text);
      if ((!actions || actions.length === 0) && inlineActions.length > 0) {
        actions = normalizeStructuredActions(inlineActions);
        reply = stripInlineAIActionTags(reply || text);
      }
      if ((!actions || actions.length === 0) && !parts.hasMarker) {
        const inlineParsed = extractJSONBlock(text);
        if (inlineParsed && typeof inlineParsed === 'object') {
          parsed = inlineParsed;
          if (Array.isArray(inlineParsed.actions)) actions = normalizeStructuredActions(inlineParsed.actions);
          else if (typeof inlineParsed.type === 'string' || typeof inlineParsed.action === 'string') actions = normalizeStructuredActions([inlineParsed]);
          const cleaned = stripInlineAIActionTags(String(text || '').replace(/```(?:json)?\s*[\s\S]*?```/ig, '').trim());
          if (cleaned) reply = cleaned;
        }
      }
      return {
        reply,
        actions,
        hasMarker: parts.hasMarker,
      };
    }

    return {
      stripInlineAIActionTags,
      parseInlineAIActionsFromText,
      extractJSONBlock,
      splitAIChatStructuredResponse,
      extractAIChatStructuredResponse,
    };
  }

  window.MorphAIStructuredResponseRuntime = { create: createAIStructuredResponseRuntime };
})();
