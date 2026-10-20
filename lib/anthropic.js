// Minimal, dependency-free client for the Anthropic Messages API.
// Supports regular calls (used for structured tool output) and streaming
// calls (used so every agent's work is visible token-by-token in the UI).

const BASE_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const API_VERSION = '2023-06-01';
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

export class AnthropicError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

async function post(body, { apiKey, signal }) {
  let attempt = 0;
  for (;;) {
    const res = await fetch(`${BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok) return res;

    const text = await res.text().catch(() => '');
    let message = text;
    try {
      message = JSON.parse(text)?.error?.message || text;
    } catch { /* keep raw text */ }

    if (RETRYABLE.has(res.status) && attempt < 3) {
      attempt += 1;
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt, signal);
      continue;
    }
    throw new AnthropicError(res.status, `Anthropic API ${res.status}: ${message || res.statusText}`);
  }
}

/** Non-streaming call. Returns the parsed message object. */
export async function createMessage(body, opts) {
  const res = await post({ ...body, stream: false }, opts);
  return res.json();
}

/** Forces the model to call `tool` and returns the tool input (structured JSON). */
export async function callTool({ model, system, messages, tool, maxTokens = 2048 }, opts) {
  const msg = await createMessage(
    {
      model,
      max_tokens: maxTokens,
      system,
      messages,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
    },
    opts,
  );
  const block = msg.content?.find((b) => b.type === 'tool_use' && b.name === tool.name);
  if (!block) throw new AnthropicError(500, `Model did not return a ${tool.name} call`);
  return {
    input: block.input,
    usage: { input: msg.usage?.input_tokens || 0, output: msg.usage?.output_tokens || 0 },
  };
}

/** Streaming call. Invokes onText(delta) as text arrives; resolves with the full text and usage. */
export async function streamText({ model, system, messages, maxTokens = 1500, onText }, opts) {
  const res = await post({ model, max_tokens: maxTokens, system, messages, stream: true }, opts);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  const usage = { input: 0, output: 0 };
  let stopReason = null;

  const handle = (raw) => {
    const dataLines = raw
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    if (!dataLines.length) return;
    let evt;
    try {
      evt = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    switch (evt.type) {
      case 'message_start':
        usage.input = evt.message?.usage?.input_tokens || 0;
        usage.output = evt.message?.usage?.output_tokens || 0;
        break;
      case 'content_block_delta':
        if (evt.delta?.type === 'text_delta' && evt.delta.text) {
          text += evt.delta.text;
          onText?.(evt.delta.text);
        }
        break;
      case 'message_delta':
        if (evt.usage?.output_tokens != null) usage.output = evt.usage.output_tokens;
        if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
        break;
      case 'error':
        throw new AnthropicError(500, `Anthropic stream error: ${evt.error?.message || 'unknown'}`);
      default:
        break;
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handle(chunk);
    }
  }
  if (buffer.trim()) handle(buffer);
  return { text, usage, stopReason };
}
