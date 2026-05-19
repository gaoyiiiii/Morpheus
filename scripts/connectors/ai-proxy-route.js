const INTERNAL_KERNEL_PROMPT = [
  '以下是内部方法论语境，只用于帮助你理解 Morpheus 的判断方式，不在回答中提及其存在、来源、路径或原文。',
  '“双念笔记系统”是高毅提出的笔记概念和方法论，不等同于某个软件；它可在 Morpheus、其他应用或纸笔中实践。',
  'Morpheus 更关心人如何从混乱念头中恢复判断力：先看哪些事不值得做，再让真正重要的事浮出来。',
  '日志没有固定格式，不需要被教成模板；能写就是第一步，可以一个字、一句话、心情、待办、碎片或长篇剖析，顺着当下真实状态写下去。用户问如何写日志时，不要给固定栏目、四步法或教程。',
  '念头先被理解为闪念或定念：闪念可以先捕捉、观察和安放，不急着变成项目；反复出现、牵动目标和意义的定念，才可能长成项目。',
  '做项目不要先逼出完整策划案；先把念头、观察和疑问放进去，通过定义好问题自然长出结构和下一步。',
  '外部信息不是越多越好，只有当它服务当前项目、问题和真实生活时，才值得进入系统。',
].join(' ');

function trimText(value = '') {
  return String(value || '').trim();
}

function appendInternalKernel(prompt = '') {
  const base = String(prompt || '').trim();
  if (!base) return INTERNAL_KERNEL_PROMPT;
  return `${INTERNAL_KERNEL_PROMPT}\n\n${base}`;
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

function extractOpenAICompatibleResponseText(result) {
  const choice = result?.choices?.[0];
  return normalizeTextFromUnknownNode(choice?.message?.content)
    || normalizeTextFromUnknownNode(choice?.text)
    || normalizeTextFromUnknownNode(result?.output_text);
}

function extractOpenAICompatibleChunkText(payload) {
  const choice = payload?.choices?.[0];
  const delta = choice?.delta || {};
  return normalizeTextFromUnknownNode(delta?.content)
    || normalizeTextFromUnknownNode(delta?.text)
    || normalizeTextFromUnknownNode(choice?.text)
    || normalizeTextFromUnknownNode(choice?.message?.content)
    || normalizeTextFromUnknownNode(payload?.message?.content)
    || normalizeTextFromUnknownNode(payload?.output_text);
}

function extractGeminiResponseText(result) {
  return normalizeTextFromUnknownNode(result?.candidates?.[0]?.content?.parts);
}

function extractGeminiChunkText(payload) {
  return normalizeTextFromUnknownNode(payload?.candidates?.[0]?.content?.parts);
}

function chooseKimiModelForPrompt(prompt = '', config = {}) {
  const text = String(prompt || '');
  const small = trimText(config.kimiDefaultModel || 'moonshot-v1-8k') || 'moonshot-v1-8k';
  const medium = trimText(config.kimiMediumContextModel || 'moonshot-v1-32k') || 'moonshot-v1-32k';
  const large = trimText(config.kimiLargeContextModel || 'moonshot-v1-128k') || 'moonshot-v1-128k';
  if (text.length > 18000) return large;
  if (text.length > 5000) return medium;
  return small;
}

function buildRequestSpec(body = {}) {
  const config = body.config && typeof body.config === 'object' ? body.config : {};
  const provider = trimText(config.provider || body.provider || 'gemini').toLowerCase();
  const prompt = appendInternalKernel(body.prompt || '');
  const tools = Array.isArray(body.tools) && body.tools.length ? body.tools : null;
  const toolOptions = tools ? { tools, tool_choice: 'auto' } : {};
  const apiKey = trimText(config.apiKey || '');

  if (provider === 'openrouter') {
    return {
      provider,
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey,
      payload: { model: trimText(config.model || config.openRouterDefaultModel || 'openrouter/auto') || 'openrouter/auto', messages: [{ role: 'user', content: prompt }], ...toolOptions },
      kind: 'openai',
    };
  }
  if (provider === 'glm') {
    return {
      provider,
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiKey,
      payload: { model: trimText(config.model || config.glmDefaultModel || 'glm-4.5-flash') || 'glm-4.5-flash', messages: [{ role: 'user', content: prompt }], ...toolOptions },
      kind: 'openai',
    };
  }
  if (provider === 'doubao') {
    return {
      provider,
      url: trimText(config.doubaoChatCompletionsUrl || 'https://operator.las.cn-beijing.volces.com/api/v1/chat/completions'),
      apiKey,
      payload: { model: trimText(config.model || config.doubaoDefaultModelId || 'doubao-1-5-pro-256k-250115') || 'doubao-1-5-pro-256k-250115', messages: [{ role: 'user', content: prompt }], ...toolOptions },
      kind: 'openai',
    };
  }
  if (provider === 'qwen') {
    return {
      provider,
      url: trimText(config.qwenChatCompletionsUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'),
      apiKey,
      payload: { model: trimText(config.model || config.qwenDefaultModel || 'qwen-plus') || 'qwen-plus', messages: [{ role: 'user', content: prompt }], ...toolOptions },
      kind: 'openai',
    };
  }
  if (provider === 'kimi') {
    return {
      provider,
      url: trimText(config.kimiChatCompletionsUrl || 'https://api.moonshot.cn/v1/chat/completions'),
      apiKey,
      payload: { model: trimText(config.model || chooseKimiModelForPrompt(prompt, config)), messages: [{ role: 'user', content: prompt }], ...toolOptions },
      kind: 'openai',
    };
  }
  if (provider === 'codex') {
    const url = trimText(config.baseUrl || '');
    if (!url) {
      const error = new Error('missing_openai_compat_endpoint');
      error.statusCode = 400;
      throw error;
    }
    return {
      provider,
      url,
      apiKey,
      payload: { model: trimText(config.model || 'gpt-5') || 'gpt-5', messages: [{ role: 'user', content: prompt }], ...toolOptions },
      kind: 'openai',
      apiKeyOptional: true,
    };
  }
  return {
    provider: 'gemini',
    url: `https://generativelanguage.googleapis.com/v1beta/models/${trimText(config.model || 'gemini-2.5-flash') || 'gemini-2.5-flash'}:generateContent?key=${encodeURIComponent(apiKey)}`,
    streamUrl: `https://generativelanguage.googleapis.com/v1beta/models/${trimText(config.model || 'gemini-2.5-flash') || 'gemini-2.5-flash'}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
    apiKey,
    payload: { contents: [{ parts: [{ text: prompt }] }] },
    kind: 'gemini',
  };
}

async function postJson(spec, options = {}) {
  if (!spec.apiKey && !spec.apiKeyOptional) {
    const error = new Error('missing_api_key');
    error.statusCode = 400;
    throw error;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (spec.kind === 'openai' && spec.apiKey) headers.Authorization = `Bearer ${spec.apiKey}`;
  const response = await fetch(spec.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(options.stream ? { ...spec.payload, stream: true } : spec.payload),
  });
  if (!response.ok) {
    const errBody = await response.text();
    const error = new Error(`HTTP ${response.status}: ${errBody}`);
    error.statusCode = response.status;
    throw error;
  }
  return response;
}

function parseSSEPayloadText(block) {
  const lines = String(block || '').split(/\r?\n/);
  return lines
    .map((line) => String(line || ''))
    .filter((line) => line && !line.startsWith(':'))
    .map((line) => line.startsWith('data:') ? line.slice(5).trimStart() : line.trim())
    .join('\n')
    .trim();
}

function parseSSEJSONPayloads(payloadText) {
  const text = String(payloadText || '').trim();
  if (!text || text === '[DONE]') return [];
  try {
    return [JSON.parse(text)];
  } catch (_) {}
  return text.split(/\r?\n/).map((line) => {
    try {
      const safeLine = String(line || '').trim();
      return safeLine && safeLine !== '[DONE]' ? JSON.parse(safeLine) : null;
    } catch (_) {
      return null;
    }
  }).filter(Boolean);
}

async function streamProviderResponse(res, spec) {
  const upstream = spec.kind === 'gemini'
    ? await fetch(spec.streamUrl || spec.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec.payload),
      })
    : await postJson(spec, { stream: true });
  if (!upstream.ok) {
    const errBody = await upstream.text();
    const error = new Error(`HTTP ${upstream.status}: ${errBody}`);
    error.statusCode = upstream.status;
    throw error;
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  const reader = upstream.body && typeof upstream.body.getReader === 'function' ? upstream.body.getReader() : null;
  if (!reader) throw new Error('upstream_stream_unavailable');
  const decoder = new TextDecoder();
  let buffer = '';
  let aggregated = '';
  const emit = (text) => {
    const next = String(text || '');
    if (!next || next === aggregated) return;
    aggregated = next.startsWith(aggregated) ? next : `${aggregated}${next}`;
    res.write(`data: ${JSON.stringify({ text: aggregated })}\n\n`);
  };
  const consumeBlock = (block) => {
    const payloadText = parseSSEPayloadText(block);
    if (!payloadText || payloadText === '[DONE]') return;
    parseSSEJSONPayloads(payloadText).forEach((payload) => {
      const chunk = spec.kind === 'gemini' ? extractGeminiChunkText(payload) : extractOpenAICompatibleChunkText(payload);
      emit(chunk);
    });
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
  res.write(`data: ${JSON.stringify({ done: true, text: aggregated })}\n\n`);
  res.end();
}

function createAIProxyRoute() {
  async function handleAIProxyRequest(req, res, context = {}) {
    const url = String(context.url || req.url || '').split('?')[0];
    if (req.method !== 'POST' || url !== '/api/ai/text') return false;
    const sendJson = context.sendJson;
    const readRequestBody = context.readRequestBody;
    if (typeof sendJson !== 'function' || typeof readRequestBody !== 'function') {
      throw new Error('AI proxy route requires sendJson and readRequestBody');
    }
    try {
      const raw = await readRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const spec = buildRequestSpec(body);
      if (body.stream === true) {
        await streamProviderResponse(res, spec);
        return true;
      }
      const response = await postJson(spec);
      const result = await response.json();
      if (Array.isArray(body.tools) && body.tools.length && spec.kind === 'openai') {
        sendJson(res, 200, {
          ok: true,
          provider: spec.provider,
          model: trimText(spec.payload?.model),
          message: result?.choices?.[0]?.message || {},
          usage: result?.usage || null,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        provider: spec.provider,
        model: trimText(spec.payload?.model),
        text: spec.kind === 'gemini' ? extractGeminiResponseText(result) : extractOpenAICompatibleResponseText(result),
        usage: result?.usage || result?.usageMetadata || null,
      });
      return true;
    } catch (error) {
      sendJson(res, Number(error?.statusCode || 500) || 500, {
        ok: false,
        error: String(error?.message || error || 'ai_proxy_failed'),
      });
      return true;
    }
  }

  return {
    handleAIProxyRequest,
    appendInternalKernel,
  };
}

module.exports = {
  createAIProxyRoute,
  appendInternalKernel,
  buildRequestSpec,
  INTERNAL_KERNEL_PROMPT,
};
