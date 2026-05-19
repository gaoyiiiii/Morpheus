(function initMorphAIRequestRuntime() {
  function createAIRequestRuntimeModules(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const resolveFn = (name, fallback = null) => (typeof api[name] === 'function' ? api[name] : fallback);
    const getAIProvider = resolveFn('getAIProvider', () => 'gemini');
    const getCurrentAIKey = resolveFn('getCurrentAIKey', () => '');
    const getOpenRouterApiKey = resolveFn('getOpenRouterApiKey', () => '');
    const getGLMApiKey = resolveFn('getGLMApiKey', () => '');
    const getDoubaoApiKey = resolveFn('getDoubaoApiKey', () => '');
    const getCodexBaseUrl = resolveFn('getCodexBaseUrl', () => '');
    const getCodexModel = resolveFn('getCodexModel', () => '');
    const fetchWithBackoff = resolveFn('fetchWithBackoff', async () => { throw new Error('fetch_with_backoff_unavailable'); });
    const isRunningInNativeIOSShell = resolveFn('isRunningInNativeIOSShell', () => false);
    const isRunningInNativeDesktopShell = resolveFn('isRunningInNativeDesktopShell', () => false);
    const hasInjectedFetchImpl = typeof api.fetchImpl === 'function';
    const fetchImpl = resolveFn('fetchImpl', (...args) => fetch(...args));
    const readFileAsArrayBuffer = resolveFn('readFileAsArrayBuffer', async () => { throw new Error('array_buffer_read_failed'); });
    const extractImportedAttachmentTextViaNative = resolveFn('extractImportedAttachmentTextViaNative', async () => { throw new Error('native_parser_unavailable'); });
    const getWindowRef = typeof api.getWindowRef === 'function'
      ? api.getWindowRef
      : () => (typeof window !== 'undefined' ? window : null);
    const getAIAbortSignal = resolveFn('getAIAbortSignal', () => null);
    const storage = api.storage && typeof api.storage === 'object' ? api.storage : null;

    const OPENROUTER_DEFAULT_MODEL = String(api.OPENROUTER_DEFAULT_MODEL || 'openrouter/auto').trim() || 'openrouter/auto';
    const GLM_DEFAULT_MODEL = String(api.GLM_DEFAULT_MODEL || 'glm-4.5-flash').trim() || 'glm-4.5-flash';
    const DOUBAO_DEFAULT_MODEL_ID = String(api.DOUBAO_DEFAULT_MODEL_ID || 'doubao-1-5-pro-256k-250115').trim() || 'doubao-1-5-pro-256k-250115';
    const QWEN_DEFAULT_MODEL = String(api.QWEN_DEFAULT_MODEL || 'qwen-plus').trim() || 'qwen-plus';
    const KIMI_DEFAULT_MODEL = String(api.KIMI_DEFAULT_MODEL || 'moonshot-v1-8k').trim() || 'moonshot-v1-8k';
    const KIMI_MEDIUM_CONTEXT_MODEL = String(api.KIMI_MEDIUM_CONTEXT_MODEL || 'moonshot-v1-32k').trim() || 'moonshot-v1-32k';
    const KIMI_LARGE_CONTEXT_MODEL = String(api.KIMI_LARGE_CONTEXT_MODEL || 'moonshot-v1-128k').trim() || 'moonshot-v1-128k';
    const CODEX_OPENAI_COMPAT_DEFAULT_MODEL = String(api.CODEX_OPENAI_COMPAT_DEFAULT_MODEL || 'gpt-5').trim() || 'gpt-5';
    const DOUBAO_CHAT_COMPLETIONS_URL = String(api.DOUBAO_CHAT_COMPLETIONS_URL || 'https://operator.las.cn-beijing.volces.com/api/v1/chat/completions').trim() || 'https://operator.las.cn-beijing.volces.com/api/v1/chat/completions';
    const QWEN_CHAT_COMPLETIONS_URL = String(api.QWEN_CHAT_COMPLETIONS_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions').trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    const KIMI_CHAT_COMPLETIONS_URL = String(api.KIMI_CHAT_COMPLETIONS_URL || 'https://api.moonshot.cn/v1/chat/completions').trim() || 'https://api.moonshot.cn/v1/chat/completions';
    const DESKTOP_MANAGED_ANTI_API_BASE_URL = String(api.DESKTOP_MANAGED_ANTI_API_BASE_URL || 'http://127.0.0.1:8964').trim() || 'http://127.0.0.1:8964';
    const AI_REQUEST_METRICS_MAX = 120;
    let aiRequestMetricsHistory = [];

    async function requestNativeIOSBridgeReply(action, payload, { onProgress = null } = {}) {
      if (typeof api.requestNativeIOSBridgeReply === 'function') {
        return api.requestNativeIOSBridgeReply(action, payload, { onProgress });
      }
      if (!isRunningInNativeIOSShell() || !storage?.hasNativeControlBridge || !storage.hasNativeControlBridge() || typeof storage.callNativeDesktopControl !== 'function') return null;
      const res = await storage.callNativeDesktopControl(action, payload, {
        onProgress: typeof onProgress === 'function'
          ? (nextPayload) => {
            const text = String(nextPayload?.text || '');
            if (text) onProgress(text);
          }
          : null,
      });
      const text = String(res?.text || '').trim();
      return text || null;
    }

    async function requestNativeIOSCodexReply(prompt, apiKey, endpoint, model, { onProgress = null } = {}) {
      if (typeof api.requestNativeIOSCodexReply === 'function') return api.requestNativeIOSCodexReply(prompt, apiKey, endpoint, model, { onProgress });
      return requestNativeIOSBridgeReply('requestCodexCompatibleChat', {
        prompt: String(prompt || ''),
        apiKey: String(apiKey || ''),
        baseURL: String(endpoint || ''),
        model: String(model || CODEX_OPENAI_COMPAT_DEFAULT_MODEL),
      }, { onProgress });
    }

    async function requestNativeIOSAIReply(prompt, { onProgress = null } = {}) {
      if (typeof api.requestNativeIOSAIReply === 'function') return api.requestNativeIOSAIReply(prompt, { onProgress });
      return requestNativeIOSBridgeReply('requestAIChat', {
        prompt: String(prompt || ''),
      }, { onProgress });
    }

    async function isDesktopManagedAntiAPIReachable(baseURL = DESKTOP_MANAGED_ANTI_API_BASE_URL) {
      if (typeof api.isDesktopManagedAntiAPIReachable === 'function') {
        return api.isDesktopManagedAntiAPIReachable(baseURL);
      }
      if (!isRunningInNativeDesktopShell()) return false;
      const candidates = [`${baseURL}/health`, `${baseURL}/v1/models`];
      for (const url of candidates) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 1600) : null;
        try {
          const res = await fetchImpl(url, {
            method: 'GET',
            cache: 'no-store',
            signal: controller?.signal || undefined,
          });
          if (res?.ok) return true;
        } catch (_) {
          // Keep trying other endpoints.
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
      return false;
    }

    async function extractImportedAttachmentPdfText(file) {
      if (typeof api.extractImportedAttachmentPdfText === 'function') {
        return api.extractImportedAttachmentPdfText(file);
      }
      const win = getWindowRef();
      const pdfjs = win?.pdfjsLib;
      if (pdfjs && typeof pdfjs.getDocument === 'function') {
        if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const buffer = await readFileAsArrayBuffer(file);
        const loadingTask = pdfjs.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        const pages = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const textContent = await page.getTextContent();
          const text = (textContent.items || [])
            .map((item) => String(item?.str || '').trim())
            .filter(Boolean)
            .join(' ');
          if (text) pages.push(text);
        }
        const parsed = pages.join('\n\n').trim();
        if (parsed) return parsed;
      }
      return extractImportedAttachmentTextViaNative(file);
    }

    async function extractImportedAttachmentDocxText(file) {
      if (typeof api.extractImportedAttachmentDocxText === 'function') {
        return api.extractImportedAttachmentDocxText(file);
      }
      const win = getWindowRef();
      if (win?.mammoth && typeof win.mammoth.extractRawText === 'function') {
        const buffer = await readFileAsArrayBuffer(file);
        const result = await win.mammoth.extractRawText({ arrayBuffer: buffer });
        const text = String(result?.value || '').replace(/\r\n/g, '\n').trim();
        if (text) return text;
      }
      return extractImportedAttachmentTextViaNative(file);
    }

    function resolveRequestSignal(signal = null) {
      return signal || getAIAbortSignal() || null;
    }

    function trimText(value = '') {
      return String(value || '').trim();
    }

    function estimateTokenCount(text = '') {
      const value = String(text || '').replace(/\s+/g, ' ').trim();
      if (!value) return 0;
      const asciiChars = (value.match(/[\u0000-\u007f]/g) || []).length;
      const nonAsciiChars = Math.max(0, value.length - asciiChars);
      return Math.max(1, Math.round((asciiChars / 4) + nonAsciiChars));
    }

    function normalizeAIUsage(result = null) {
      const usage = result?.usage && typeof result.usage === 'object'
        ? result.usage
        : result?.usageMetadata && typeof result.usageMetadata === 'object'
          ? result.usageMetadata
          : null;
      if (!usage) return null;
      const promptTokens = Number(
        usage.prompt_tokens
        ?? usage.input_tokens
        ?? usage.promptTokenCount
        ?? usage.inputTokenCount
        ?? 0
      );
      const completionTokens = Number(
        usage.completion_tokens
        ?? usage.output_tokens
        ?? usage.candidatesTokenCount
        ?? usage.outputTokenCount
        ?? 0
      );
      const totalTokens = Number(
        usage.total_tokens
        ?? usage.totalTokenCount
        ?? usage.totalTokens
        ?? (promptTokens + completionTokens)
      );
      if (![promptTokens, completionTokens, totalTokens].some((value) => Number.isFinite(value) && value > 0)) return null;
      return {
        promptTokens: Number.isFinite(promptTokens) && promptTokens > 0 ? Math.round(promptTokens) : 0,
        completionTokens: Number.isFinite(completionTokens) && completionTokens > 0 ? Math.round(completionTokens) : 0,
        totalTokens: Number.isFinite(totalTokens) && totalTokens > 0 ? Math.round(totalTokens) : Math.max(0, Math.round(promptTokens) + Math.round(completionTokens)),
        tokenSource: 'provider',
      };
    }

    function pushAIRequestMetric(metric = null) {
      if (!metric || typeof metric !== 'object') return null;
      const entry = {
        startedAt: trimText(metric.startedAt),
        finishedAt: trimText(metric.finishedAt),
        durationMs: Math.max(0, Number(metric.durationMs || 0) || 0),
        status: trimText(metric.status || 'ok') || 'ok',
        provider: trimText(metric.provider),
        model: trimText(metric.model),
        transport: trimText(metric.transport || 'http') || 'http',
        requestKind: trimText(metric.requestKind || 'text') || 'text',
        stream: metric.stream === true,
        preferNativeIOS: metric.preferNativeIOS === true,
        promptChars: Math.max(0, Number(metric.promptChars || 0) || 0),
        responseChars: Math.max(0, Number(metric.responseChars || 0) || 0),
        promptTokens: Math.max(0, Number(metric.promptTokens || 0) || 0),
        completionTokens: Math.max(0, Number(metric.completionTokens || 0) || 0),
        totalTokens: Math.max(0, Number(metric.totalTokens || 0) || 0),
        tokenSource: trimText(metric.tokenSource || 'estimated') || 'estimated',
        toolCount: Math.max(0, Number(metric.toolCount || 0) || 0),
        error: trimText(metric.error || ''),
      };
      aiRequestMetricsHistory.push(entry);
      if (aiRequestMetricsHistory.length > AI_REQUEST_METRICS_MAX) aiRequestMetricsHistory = aiRequestMetricsHistory.slice(-AI_REQUEST_METRICS_MAX);
      return entry;
    }

    function finalizeAIRequestMetric({
      prompt = '',
      responseText = '',
      result = null,
      startedAtMs = 0,
      provider = '',
      model = '',
      transport = 'http',
      requestKind = 'text',
      stream = false,
      preferNativeIOS = false,
      toolCount = 0,
      status = 'ok',
      error = '',
    } = {}) {
      const promptText = String(prompt || '');
      const replyText = String(responseText || '');
      const usage = normalizeAIUsage(result);
      const promptTokens = usage?.promptTokens || estimateTokenCount(promptText);
      const completionTokens = usage?.completionTokens || estimateTokenCount(replyText);
      const totalTokens = usage?.totalTokens || (promptTokens + completionTokens);
      return pushAIRequestMetric({
        startedAt: new Date(Number(startedAtMs || Date.now())).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - Number(startedAtMs || Date.now())),
        status,
        provider,
        model,
        transport,
        requestKind,
        stream,
        preferNativeIOS,
        promptChars: promptText.length,
        responseChars: replyText.length,
        promptTokens,
        completionTokens,
        totalTokens,
        tokenSource: usage?.tokenSource || 'estimated',
        toolCount,
        error,
      });
    }

    function buildLocalAIProxyConfig(provider = '') {
      return {
        provider: trimText(provider || getAIProvider()),
        apiKey: trimText(getCurrentAIKey()),
        baseUrl: trimText(getCodexBaseUrl()),
        model: trimText(provider === 'codex' ? (getCodexModel() || CODEX_OPENAI_COMPAT_DEFAULT_MODEL) : ''),
        openRouterDefaultModel: OPENROUTER_DEFAULT_MODEL,
        glmDefaultModel: GLM_DEFAULT_MODEL,
        doubaoDefaultModelId: DOUBAO_DEFAULT_MODEL_ID,
        qwenDefaultModel: QWEN_DEFAULT_MODEL,
        kimiDefaultModel: KIMI_DEFAULT_MODEL,
        kimiMediumContextModel: KIMI_MEDIUM_CONTEXT_MODEL,
        kimiLargeContextModel: KIMI_LARGE_CONTEXT_MODEL,
        doubaoChatCompletionsUrl: DOUBAO_CHAT_COMPLETIONS_URL,
        qwenChatCompletionsUrl: QWEN_CHAT_COMPLETIONS_URL,
        kimiChatCompletionsUrl: KIMI_CHAT_COMPLETIONS_URL,
      };
    }

    function shouldUseLocalAIProxy() {
      if (api.useLocalAIProxy === false) return false;
      if (!hasInjectedFetchImpl && typeof fetch !== 'function') return false;
      try {
        const win = getWindowRef();
        const protocol = String(win?.location?.protocol || '').trim();
        return protocol === 'http:' || protocol === 'https:';
      } catch (_) {
        return true;
      }
    }

    async function streamLocalAIProxyResponse(response, onProgress) {
      if (!response.body || typeof response.body.getReader !== 'function') throw new Error('local_ai_proxy_stream_unavailable');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let latest = '';
      const consumeBlock = (block) => {
        const text = String(block || '').split(/\r?\n/)
          .map((line) => String(line || ''))
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
          .trim();
        if (!text || text === '[DONE]') return;
        try {
          const payload = JSON.parse(text);
          const next = String(payload?.text || '');
          if (next) {
            latest = next;
            if (typeof onProgress === 'function') onProgress(next);
          }
        } catch (_) {}
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || '';
        parts.forEach(consumeBlock);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeBlock(buffer);
      return latest;
    }

    async function requestLocalAIProxy(prompt, options = {}) {
      if (!shouldUseLocalAIProxy()) return null;
      const provider = trimText(getAIProvider());
      const config = buildLocalAIProxyConfig(provider);
      if (!config.apiKey && provider !== 'codex') return null;
      if (provider === 'codex' && !config.baseUrl) return null;
      const response = await fetchImpl('/api/ai/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: String(prompt || ''),
          stream: options.stream === true,
          tools: Array.isArray(options.tools) ? options.tools : undefined,
          config,
        }),
        signal: options.signal || null,
      });
      if (!response || response.status === 404) return null;
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          message = String(payload?.error || message);
        } catch (_) {}
        const error = new Error(message);
        error.__morphLocalAIProxyAttempted = true;
        throw error;
      }
      if (options.stream === true) {
        const text = await streamLocalAIProxyResponse(response, options.onProgress);
        return { ok: true, text, transport: 'local-proxy-stream' };
      }
      const payload = await response.json();
      if (!payload?.ok) {
        const error = new Error(String(payload?.error || 'local_ai_proxy_failed'));
        error.__morphLocalAIProxyAttempted = true;
        throw error;
      }
      return {
        ok: true,
        text: String(payload.text || ''),
        message: payload.message && typeof payload.message === 'object' ? payload.message : null,
        result: payload,
        model: trimText(payload.model),
        transport: 'local-proxy',
      };
    }

    function getAIRequestMetricsCount() {
      return aiRequestMetricsHistory.length;
    }

    function readAIRequestMetricsSince(index = 0) {
      const start = Math.max(0, Number(index || 0) || 0);
      return aiRequestMetricsHistory.slice(start).map((item) => ({ ...item }));
    }

    function readRecentAIRequestMetrics(limit = 20) {
      const safeLimit = Math.max(1, Number(limit || 20) || 20);
      return aiRequestMetricsHistory.slice(-safeLimit).map((item) => ({ ...item }));
    }

    function normalizeTextFromUnknownNode(node, depth = 0) {
      if (depth > 6 || node == null) return '';
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map((entry) => normalizeTextFromUnknownNode(entry, depth + 1)).join('');
      if (typeof node !== 'object') return '';

      if (typeof node.text === 'string') return node.text;
      if (typeof node.value === 'string') return node.value;
      if (typeof node.output_text === 'string') return node.output_text;
      if (typeof node.content === 'string') return node.content;

      const contentText = normalizeTextFromUnknownNode(node.content, depth + 1);
      if (contentText) return contentText;
      return normalizeTextFromUnknownNode(node.text, depth + 1);
    }

    function mergeAggregatedStreamText(currentText, incomingChunk) {
      const current = String(currentText || '');
      const incoming = String(incomingChunk || '');
      if (!incoming) return current;
      if (!current) return incoming;
      if (incoming === current) return current;
      if (incoming.startsWith(current)) return incoming;
      if (current.endsWith(incoming)) return current;
      return current + incoming;
    }

    function parseSSEPayloadText(block) {
      const lines = String(block || '').split(/\r?\n/);
      const dataLines = [];
      lines.forEach((line) => {
        const raw = String(line || '');
        if (!raw || raw.startsWith(':')) return;
        if (raw.startsWith('data:')) {
          dataLines.push(raw.slice(5).trimStart());
          return;
        }
        dataLines.push(raw.trim());
      });
      return dataLines.join('\n').trim();
    }

    function parseSSEJSONPayloads(payloadText) {
      const text = String(payloadText || '').trim();
      if (!text || text === '[DONE]') return [];
      try {
        return [JSON.parse(text)];
      } catch (_) {}
      const parsedList = [];
      text
        .split(/\r?\n/)
        .map((line) => String(line || '').trim())
        .filter(Boolean)
        .forEach((line) => {
          if (line === '[DONE]') return;
          try {
            parsedList.push(JSON.parse(line));
          } catch (_) {}
        });
      return parsedList;
    }

    async function emitFallbackStreamProgress(fullText, onProgress) {
      if (typeof onProgress !== 'function') return;
      const text = String(fullText || '');
      if (!text) return;
      const totalLength = text.length;
      const step = Math.max(12, Math.ceil(totalLength / 20));
      for (let end = step; end < totalLength; end += step) {
        onProgress(text.slice(0, end));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      onProgress(text);
    }

    function shouldFallbackFromStreamError(error) {
      const name = String(error?.name || '').trim();
      const message = String(error?.message || error || '').trim();
      if (name === 'AbortError') return false;
      if (/abort|aborted|取消|中断/i.test(message)) return false;
      return true;
    }

    async function runStreamingRequestWithFallback(streamRequest, fallbackRequest, onProgress) {
      try {
        return await streamRequest();
      } catch (error) {
        if (!shouldFallbackFromStreamError(error)) throw error;
        const fallbackText = String(await fallbackRequest() || '');
        if (!fallbackText.trim()) throw error;
        await emitFallbackStreamProgress(fallbackText, onProgress);
        return fallbackText;
      }
    }

    async function streamSSEJSONResponse(response, onProgress, extractChunkText) {
      if (!response.body) throw new Error('当前环境不支持流式响应');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aggregated = '';
      const consumeEventBlock = (block) => {
        const payloadText = parseSSEPayloadText(block);
        if (!payloadText || payloadText === '[DONE]') return;
        const payloads = parseSSEJSONPayloads(payloadText);
        if (!payloads.length) return;
        payloads.forEach((payload) => {
          const nextChunk = String(extractChunkText(payload) || '');
          if (!nextChunk) return;
          const nextAggregated = mergeAggregatedStreamText(aggregated, nextChunk);
          if (nextAggregated === aggregated) return;
          aggregated = nextAggregated;
          if (typeof onProgress === 'function') onProgress(aggregated);
        });
      };
      const flushBufferedEvents = () => {
        const segments = buffer.split(/\r?\n\r?\n/);
        buffer = segments.pop() || '';
        segments.forEach((eventBlock) => {
          if (eventBlock && eventBlock.trim()) consumeEventBlock(eventBlock);
        });
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        flushBufferedEvents();
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeEventBlock(buffer);
      if (!aggregated.trim()) throw new Error('empty_stream_response');
      return aggregated;
    }

    function extractGeminiChunkText(payload) {
      const parts = payload?.candidates?.[0]?.content?.parts;
      return normalizeTextFromUnknownNode(parts);
    }

    function extractOpenAICompatibleChunkText(payload) {
      const choice = payload?.choices?.[0];
      const delta = choice?.delta || {};
      let chunk = normalizeTextFromUnknownNode(delta?.content);
      if (!chunk) chunk = normalizeTextFromUnknownNode(delta?.text);
      if (!chunk) chunk = normalizeTextFromUnknownNode(choice?.text);
      if (!chunk) chunk = normalizeTextFromUnknownNode(choice?.message?.content);
      if (!chunk) chunk = normalizeTextFromUnknownNode(payload?.message?.content);
      if (!chunk) chunk = normalizeTextFromUnknownNode(payload?.output_text);
      return chunk;
    }

    function extractOpenAICompatibleResponseText(result) {
      const choice = result?.choices?.[0];
      let text = normalizeTextFromUnknownNode(choice?.message?.content);
      if (!text) text = normalizeTextFromUnknownNode(choice?.text);
      if (!text) text = normalizeTextFromUnknownNode(result?.output_text);
      return text;
    }

    async function streamAIChatResponse(url, payload, onProgress, signal = null) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: resolveRequestSignal(signal),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }
      return streamSSEJSONResponse(response, onProgress, extractGeminiChunkText);
    }

    async function streamOpenRouterResponse(payload, onProgress, signal = null) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getOpenRouterApiKey()}`,
        },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: resolveRequestSignal(signal),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }
      return streamSSEJSONResponse(response, onProgress, extractOpenAICompatibleChunkText);
    }

    async function streamOpenAICompatibleResponse(endpoint, apiKey, payload, onProgress, signal = null) {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...payload, stream: true }),
        signal: resolveRequestSignal(signal),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }
      return streamSSEJSONResponse(response, onProgress, extractOpenAICompatibleChunkText);
    }

    async function streamGLMResponse(payload, onProgress, signal = null) {
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getGLMApiKey()}`,
        },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: resolveRequestSignal(signal),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }
      return streamSSEJSONResponse(response, onProgress, extractOpenAICompatibleChunkText);
    }

    async function streamDoubaoResponse(payload, onProgress, signal = null) {
      const response = await fetch(DOUBAO_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getDoubaoApiKey()}`,
        },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: resolveRequestSignal(signal),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }
      return streamSSEJSONResponse(response, onProgress, extractOpenAICompatibleChunkText);
    }

    function buildOpenRouterPayload(prompt, options) {
      const payload = { model: OPENROUTER_DEFAULT_MODEL, messages: [{ role: 'user', content: String(prompt || '') }] };
      if (options?.tools?.length) { payload.tools = options.tools; payload.tool_choice = 'auto'; }
      return payload;
    }

    function buildGLMPayload(prompt, options) {
      const payload = { model: GLM_DEFAULT_MODEL, messages: [{ role: 'user', content: String(prompt || '') }] };
      if (options?.tools?.length) { payload.tools = options.tools; payload.tool_choice = 'auto'; }
      return payload;
    }

    function buildDoubaoPayload(prompt, options) {
      const payload = { model: DOUBAO_DEFAULT_MODEL_ID, messages: [{ role: 'user', content: String(prompt || '') }] };
      if (options?.tools?.length) { payload.tools = options.tools; payload.tool_choice = 'auto'; }
      return payload;
    }

    function buildQwenPayload(prompt, options) {
      const payload = { model: QWEN_DEFAULT_MODEL, messages: [{ role: 'user', content: String(prompt || '') }] };
      if (options?.tools?.length) { payload.tools = options.tools; payload.tool_choice = 'auto'; }
      return payload;
    }

    function chooseKimiModelForPrompt(prompt = '') {
      const text = String(prompt || '');
      const length = text.length;
      if (length > 18000) return KIMI_LARGE_CONTEXT_MODEL;
      if (length > 5000) return KIMI_MEDIUM_CONTEXT_MODEL;
      return KIMI_DEFAULT_MODEL;
    }

    function buildKimiPayload(prompt, options) {
      const payload = { model: chooseKimiModelForPrompt(prompt), messages: [{ role: 'user', content: String(prompt || '') }] };
      if (options?.tools?.length) { payload.tools = options.tools; payload.tool_choice = 'auto'; }
      return payload;
    }

    function buildCodexOpenAICompatPayload(prompt, options) {
      const payload = {
        model: getCodexModel() || CODEX_OPENAI_COMPAT_DEFAULT_MODEL,
        messages: [{ role: 'user', content: String(prompt || '') }],
      };
      if (options?.tools?.length) { payload.tools = options.tools; payload.tool_choice = 'auto'; }
      return payload;
    }

    /**
     * Non-streaming request that includes tools (function calling).
     * Returns the raw choices[0].message object so the caller can inspect
     * tool_calls vs content.
     * @param {string} prompt
     * @param {{ tools?: unknown[], signal?: AbortSignal | null }} [options]
     * @returns {Promise<{ content?: string, tool_calls?: Array<{ id: string, function: { name: string, arguments: string } }> }>}
     */
    async function requestAIWithTools(prompt, options = {}) {
      const requestStartedAt = Date.now();
      const provider = String(getAIProvider() || '').trim();
      const key = getCurrentAIKey();
      if (!key && provider !== 'codex') throw new Error('missing_api_key');
      const toolsOpt = Array.isArray(options.tools) && options.tools.length ? { tools: options.tools } : undefined;
      const fail = (error, extra = {}) => {
        try {
          error.__morphAIRequestMetricRecorded = true;
        } catch (_) {}
        finalizeAIRequestMetric({
          prompt,
          responseText: '',
          startedAtMs: requestStartedAt,
          provider,
          requestKind: 'tool-use',
          stream: false,
          status: 'error',
          error: error?.message || String(error || ''),
          toolCount: Array.isArray(options.tools) ? options.tools.length : 0,
          ...extra,
        });
        throw error;
      };

      const openAICompatProviders = {
        openrouter: { build: buildOpenRouterPayload, url: 'https://openrouter.ai/api/v1/chat/completions', keyFn: getOpenRouterApiKey },
        glm: { build: buildGLMPayload, url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', keyFn: getGLMApiKey },
        doubao: { build: buildDoubaoPayload, url: DOUBAO_CHAT_COMPLETIONS_URL, keyFn: getDoubaoApiKey },
        qwen: { build: buildQwenPayload, url: QWEN_CHAT_COMPLETIONS_URL, keyFn: () => key },
        kimi: { build: buildKimiPayload, url: KIMI_CHAT_COMPLETIONS_URL, keyFn: () => key },
      };

      if (provider !== 'gemini') {
        try {
          const proxyResult = await requestLocalAIProxy(prompt, {
            tools: Array.isArray(options.tools) ? options.tools : [],
            stream: false,
            signal: options.signal || null,
          });
          if (proxyResult?.message) {
            const message = proxyResult.message || {};
            finalizeAIRequestMetric({
              prompt,
              responseText: normalizeTextFromUnknownNode(message?.content),
              result: proxyResult.result,
              startedAtMs: requestStartedAt,
              provider,
              model: trimText(proxyResult.model),
              transport: proxyResult.transport || 'local-proxy',
              requestKind: 'tool-use',
              stream: false,
              toolCount: Array.isArray(message?.tool_calls) ? message.tool_calls.length : 0,
            });
            return message;
          }
        } catch (error) {
          if (error?.__morphLocalAIProxyAttempted === true && !String(error?.message || '').includes('missing_api_key')) {
            console.warn('[MorphAI] local AI proxy failed, falling back to direct tool request:', error?.message || error);
          } else {
            throw error;
          }
        }
      }

      const cfg = openAICompatProviders[provider];
      if (cfg) {
        const payload = cfg.build(prompt, toolsOpt);
        const apiKey = cfg.keyFn();
        try {
          const result = await fetchWithBackoff(cfg.url, payload, 3, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(payload),
            signal: options.signal || null,
          });
          const message = result?.choices?.[0]?.message || {};
          finalizeAIRequestMetric({
            prompt,
            responseText: normalizeTextFromUnknownNode(message?.content),
            result,
            startedAtMs: requestStartedAt,
            provider,
            model: trimText(payload?.model),
            transport: 'http',
            requestKind: 'tool-use',
            stream: false,
            toolCount: Array.isArray(message?.tool_calls) ? message.tool_calls.length : 0,
          });
          return message;
        } catch (error) {
          return fail(error, {
            model: trimText(payload?.model),
            transport: 'http',
          });
        }
      }

      if (provider === 'codex') {
        const endpoint = getCodexBaseUrl();
        if (!endpoint) throw new Error('missing_openai_compat_endpoint');
        const payload = buildCodexOpenAICompatPayload(prompt, toolsOpt);
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers.Authorization = `Bearer ${key}`;
        try {
          const result = await fetchWithBackoff(endpoint, payload, 3, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: options.signal || null,
          });
          const message = result?.choices?.[0]?.message || {};
          finalizeAIRequestMetric({
            prompt,
            responseText: normalizeTextFromUnknownNode(message?.content),
            result,
            startedAtMs: requestStartedAt,
            provider,
            model: trimText(payload?.model),
            transport: 'http',
            requestKind: 'tool-use',
            stream: false,
            toolCount: Array.isArray(message?.tool_calls) ? message.tool_calls.length : 0,
          });
          return message;
        } catch (error) {
          return fail(error, {
            model: trimText(payload?.model),
            transport: 'http',
          });
        }
      }

      // Gemini — no native function calling support; skip the extra API call entirely
      return {};
    }

    async function requestAIText(prompt, { stream = false, onProgress = null, signal = null, preferNativeIOS = false } = {}) {
      const requestStartedAt = Date.now();
      const provider = String(getAIProvider() || '').trim();
      const key = getCurrentAIKey();
      if (!key && provider !== 'codex') throw new Error('missing_api_key');
      const finish = (text, extra = {}) => {
        finalizeAIRequestMetric({
          prompt,
          responseText: text,
          startedAtMs: requestStartedAt,
          provider,
          requestKind: 'text',
          stream,
          preferNativeIOS,
          ...extra,
        });
        return text;
      };
      const fail = (error, extra = {}) => {
        try {
          error.__morphAIRequestMetricRecorded = true;
        } catch (_) {}
        finalizeAIRequestMetric({
          prompt,
          responseText: '',
          startedAtMs: requestStartedAt,
          provider,
          requestKind: 'text',
          stream,
          preferNativeIOS,
          status: 'error',
          error: error?.message || String(error || ''),
          ...extra,
        });
        throw error;
      };
      try {
      try {
        const proxyResult = await requestLocalAIProxy(prompt, {
          stream,
          onProgress,
          signal,
        });
        if (proxyResult?.ok) {
          return finish(proxyResult.text || '', {
            result: proxyResult.result,
            model: trimText(proxyResult.model),
            transport: proxyResult.transport || (stream ? 'local-proxy-stream' : 'local-proxy'),
          });
        }
      } catch (error) {
        if (error?.__morphLocalAIProxyAttempted === true && !String(error?.message || '').includes('missing_api_key')) {
          console.warn('[MorphAI] local AI proxy failed, falling back to direct request:', error?.message || error);
        } else {
          throw error;
        }
      }

      if (isRunningInNativeIOSShell() && (!stream || preferNativeIOS)) {
        try {
          const nativeText = await requestNativeIOSAIReply(prompt, {
            onProgress: stream ? onProgress : null,
          });
          if (typeof nativeText === 'string' && nativeText.trim()) {
            if (!stream && typeof onProgress === 'function') onProgress(nativeText);
            return finish(nativeText, {
              model: provider === 'codex' ? trimText(getCodexModel() || CODEX_OPENAI_COMPAT_DEFAULT_MODEL) : provider === 'gemini' ? 'gemini-2.5-flash' : trimText(provider),
              transport: 'native-ios',
            });
          }
        } catch (error) {
          return fail(error, {
            model: provider === 'codex' ? trimText(getCodexModel() || CODEX_OPENAI_COMPAT_DEFAULT_MODEL) : provider === 'gemini' ? 'gemini-2.5-flash' : trimText(provider),
            transport: 'native-ios',
          });
        }
      }

      if (provider === 'openrouter') {
        const payload = buildOpenRouterPayload(prompt);
        const requestOpenRouterText = async () => {
          const result = await fetchWithBackoff('https://openrouter.ai/api/v1/chat/completions', payload, 3, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getOpenRouterApiKey()}`,
            },
            body: JSON.stringify(payload),
            signal,
          });
          return finish(extractOpenAICompatibleResponseText(result), {
            result,
            model: trimText(payload?.model),
            transport: 'http',
          });
        };
        if (stream) {
          return runStreamingRequestWithFallback(
            () => streamOpenRouterResponse(payload, onProgress, signal).then((text) => finish(text, {
              model: trimText(payload?.model),
              transport: 'http-stream',
            })),
            requestOpenRouterText,
            onProgress,
          );
        }
        return requestOpenRouterText();
      }

      if (provider === 'glm') {
        const payload = buildGLMPayload(prompt);
        const requestGLMText = async () => {
          const result = await fetchWithBackoff('https://open.bigmodel.cn/api/paas/v4/chat/completions', payload, 3, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getGLMApiKey()}`,
            },
            body: JSON.stringify(payload),
            signal,
          });
          return finish(extractOpenAICompatibleResponseText(result), {
            result,
            model: trimText(payload?.model),
            transport: 'http',
          });
        };
        if (stream) {
          return runStreamingRequestWithFallback(
            () => streamGLMResponse(payload, onProgress, signal).then((text) => finish(text, {
              model: trimText(payload?.model),
              transport: 'http-stream',
            })),
            requestGLMText,
            onProgress,
          );
        }
        return requestGLMText();
      }

      if (provider === 'doubao') {
        const payload = buildDoubaoPayload(prompt);
        const requestDoubaoText = async () => {
          const result = await fetchWithBackoff(DOUBAO_CHAT_COMPLETIONS_URL, payload, 3, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getDoubaoApiKey()}`,
            },
            body: JSON.stringify(payload),
            signal,
          });
          return finish(extractOpenAICompatibleResponseText(result), {
            result,
            model: trimText(payload?.model),
            transport: 'http',
          });
        };
        if (stream) {
          return runStreamingRequestWithFallback(
            () => streamDoubaoResponse(payload, onProgress, signal).then((text) => finish(text, {
              model: trimText(payload?.model),
              transport: 'http-stream',
            })),
            requestDoubaoText,
            onProgress,
          );
        }
        return requestDoubaoText();
      }

      if (provider === 'qwen') {
        const payload = buildQwenPayload(prompt);
        const requestQwenText = async () => {
          const result = await fetchWithBackoff(QWEN_CHAT_COMPLETIONS_URL, payload, 3, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(payload),
            signal,
          });
          return finish(extractOpenAICompatibleResponseText(result), {
            result,
            model: trimText(payload?.model),
            transport: 'http',
          });
        };
        if (stream) {
          return runStreamingRequestWithFallback(
            () => streamOpenAICompatibleResponse(QWEN_CHAT_COMPLETIONS_URL, key, payload, onProgress, signal).then((text) => finish(text, {
              model: trimText(payload?.model),
              transport: 'http-stream',
            })),
            requestQwenText,
            onProgress,
          );
        }
        return requestQwenText();
      }

      if (provider === 'kimi') {
        const payload = buildKimiPayload(prompt);
        const requestKimiText = async () => {
          const result = await fetchWithBackoff(KIMI_CHAT_COMPLETIONS_URL, payload, 3, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(payload),
            signal,
          });
          return finish(extractOpenAICompatibleResponseText(result), {
            result,
            model: trimText(payload?.model),
            transport: 'http',
          });
        };
        if (stream) {
          return runStreamingRequestWithFallback(
            () => streamOpenAICompatibleResponse(KIMI_CHAT_COMPLETIONS_URL, key, payload, onProgress, signal).then((text) => finish(text, {
              model: trimText(payload?.model),
              transport: 'http-stream',
            })),
            requestKimiText,
            onProgress,
          );
        }
        return requestKimiText();
      }

      if (provider === 'codex') {
        const endpoint = getCodexBaseUrl();
        const model = getCodexModel() || CODEX_OPENAI_COMPAT_DEFAULT_MODEL;
        if (!endpoint) throw new Error('missing_openai_compat_endpoint');
        if (!model) throw new Error('missing_openai_compat_model');
        if (isRunningInNativeIOSShell() && (!stream || preferNativeIOS)) {
          try {
            const nativeText = await requestNativeIOSCodexReply(prompt, key, endpoint, model, {
              onProgress: stream ? onProgress : null,
            });
            if (typeof nativeText === 'string' && nativeText.trim()) {
              if (!stream && typeof onProgress === 'function') onProgress(nativeText);
              return finish(nativeText, {
                model: trimText(model),
                transport: 'native-ios',
              });
            }
          } catch (error) {
            return fail(error, {
              model: trimText(model),
              transport: 'native-ios',
            });
          }
        }
        const payload = buildCodexOpenAICompatPayload(prompt);
        const requestCodexText = async () => {
          const headers = { 'Content-Type': 'application/json' };
          if (key) headers.Authorization = `Bearer ${key}`;
          const result = await fetchWithBackoff(endpoint, payload, 3, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal,
          });
          return finish(extractOpenAICompatibleResponseText(result), {
            result,
            model: trimText(payload?.model),
            transport: 'http',
          });
        };
        if (stream) {
          return runStreamingRequestWithFallback(
            () => streamOpenAICompatibleResponse(endpoint, key, payload, onProgress, signal).then((text) => finish(text, {
              model: trimText(payload?.model),
              transport: 'http-stream',
            })),
            requestCodexText,
            onProgress,
          );
        }
        return requestCodexText();
      }

      const payload = { contents: [{ parts: [{ text: prompt }] }] };
      const modelName = key ? 'gemini-2.5-flash' : 'gemini-2.5-flash-preview-09-2025';
      if (stream) {
        const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${key}`;
        const requestGeminiText = async () => {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
          const result = await fetchWithBackoff(url, payload, 3, { signal });
          return finish(String(result?.candidates?.[0]?.content?.parts?.[0]?.text || ''), {
            result,
            model: trimText(modelName),
            transport: 'http',
          });
        };
        return runStreamingRequestWithFallback(
          () => streamAIChatResponse(streamUrl, payload, onProgress, signal).then((text) => finish(text, {
            model: trimText(modelName),
            transport: 'http-stream',
          })),
          requestGeminiText,
          onProgress,
        );
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
      try {
        const result = await fetchWithBackoff(url, payload, 3, { signal });
        return finish(result?.candidates?.[0]?.content?.parts?.[0]?.text || '', {
          result,
          model: trimText(modelName),
          transport: 'http',
        });
      } catch (error) {
        return fail(error, {
          model: trimText(modelName),
          transport: 'http',
        });
      }
      } catch (error) {
        if (error?.__morphAIRequestMetricRecorded === true) throw error;
        return fail(error, {
          model: provider === 'codex'
            ? trimText(getCodexModel() || CODEX_OPENAI_COMPAT_DEFAULT_MODEL)
            : provider === 'gemini'
              ? 'gemini-2.5-flash'
              : trimText(provider),
          transport: 'http',
        });
      }
    }

    return {
      requestNativeIOSBridgeReply,
      requestNativeIOSAIReply,
      requestNativeIOSCodexReply,
      isDesktopManagedAntiAPIReachable,
      extractImportedAttachmentDocxText,
      extractImportedAttachmentPdfText,
      streamAIChatResponse,
      streamOpenRouterResponse,
      streamOpenAICompatibleResponse,
      streamGLMResponse,
      streamDoubaoResponse,
      buildOpenRouterPayload,
      buildGLMPayload,
      buildDoubaoPayload,
      buildQwenPayload,
      chooseKimiModelForPrompt,
      buildKimiPayload,
      buildCodexOpenAICompatPayload,
      getAIRequestMetricsCount,
      readAIRequestMetricsSince,
      readRecentAIRequestMetrics,
      requestAIText,
      requestAIWithTools,
    };
  }

  if (typeof window !== 'undefined') {
    window.MorphAIRequestRuntime = {
      create: createAIRequestRuntimeModules,
    };
  }
})();
