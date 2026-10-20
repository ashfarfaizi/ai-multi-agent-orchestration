// Minimal, dependency-free client for the Google Gemini API (generateContent).
// Gemini has a free tier (get a key at https://aistudio.google.com/apikey),
// so this is the default provider.

const BASE_URL = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;

export class GeminiError extends Error {
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

/** Gemini's 429s carry a RetryInfo detail like { retryDelay: "23s" }. */
function retryDelayMs(errBody, attempt) {
  const info = errBody?.error?.details?.find((d) => String(d['@type'] || '').includes('RetryInfo'));
  const secs = parseFloat(String(info?.retryDelay || '').replace('s', ''));
  if (Number.isFinite(secs) && secs > 0) return Math.min(secs, 40) * 1000 + 250;
  return Math.min(1000 * 2 ** attempt, 16000);
}

/**
 * Convert a standard JSON Schema (lowercase types) into Gemini's OpenAPI-style
 * Schema (uppercase types), keeping only the fields Gemini supports.
 */
export function toGeminiSchema(s) {
  if (!s || typeof s !== 'object') return s;
  const out = {};
  if (s.type) out.type = String(s.type).toUpperCase();
  if (s.description) out.description = s.description;
  if (s.enum) out.enum = s.enum;
  if (s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
    out.propertyOrdering = Object.keys(s.properties);
  }
  if (s.items) out.items = toGeminiSchema(s.items);
  if (s.required) out.required = s.required;
  return out;
}

async function post(model, method, body, { apiKey, signal, onRetry }) {
  const url = `${BASE_URL}/v1beta/models/${encodeURIComponent(model)}:${method}`;
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok) return res;

    const raw = await res.text().catch(() => '');
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch { /* not JSON */ }
    const message = parsed?.error?.message || raw || res.statusText;

    if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
      const wait = retryDelayMs(parsed, attempt);
      onRetry?.({ status: res.status, waitMs: wait, attempt: attempt + 1 });
      await sleep(wait, signal);
      attempt += 1;
      continue;
    }
    if (res.status === 429) {
      throw new GeminiError(429, `Gemini free-tier quota or rate limit reached for ${model}. Wait a minute, pick another model in Settings, or try Demo replay. (${message})`);
    }
    if (res.status === 400 && /api key/i.test(message)) {
      throw new GeminiError(401, 'Gemini rejected the API key. Check it in Settings (get one free at aistudio.google.com/apikey).');
    }
    throw new GeminiError(res.status, `Gemini API ${res.status}: ${message}`);
  }
}

const textOf = (resp) =>
  (resp?.candidates?.[0]?.content?.parts || [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');

const usageOf = (resp) => ({
  input: resp?.usageMetadata?.promptTokenCount || 0,
  output: (resp?.usageMetadata?.candidatesTokenCount || 0) + (resp?.usageMetadata?.thoughtsTokenCount || 0),
});

function blockedReason(resp) {
  const fr = resp?.candidates?.[0]?.finishReason;
  if (resp?.promptFeedback?.blockReason) return `prompt blocked (${resp.promptFeedback.blockReason})`;
  if (fr && !['STOP', 'MAX_TOKENS', 'FINISH_REASON_UNSPECIFIED'].includes(fr)) return `response stopped (${fr})`;
  return null;
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new GeminiError(500, 'Gemini returned malformed JSON for a structured step.');
  }
}

export const geminiProvider = {
  id: 'gemini',
  label: 'Google Gemini (free tier)',
  models: ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'],
  defaultModel: 'gemini-3.5-flash-lite',
  envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  keyHeader: 'x-gemini-key',

  /** Structured output via JSON mode + response schema. */
  async json({ model, system, user, schema, maxTokens = 8192 }, opts) {
    const res = await post(
      model,
      'generateContent',
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(schema),
          maxOutputTokens: Math.max(maxTokens, 8192),
          temperature: 0.7,
        },
      },
      opts,
    );
    const resp = await res.json();
    const text = textOf(resp);
    if (!text) throw new GeminiError(500, `Gemini returned no content: ${blockedReason(resp) || 'empty response'}`);
    return { data: parseJsonLoose(text), usage: usageOf(resp) };
  },

  /** Streamed text via Server-Sent Events. */
  async stream({ model, system, user, maxTokens = 8192, onText }, opts) {
    const res = await post(
      model,
      'streamGenerateContent?alt=sse',
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: Math.max(maxTokens, 8192), temperature: 0.8 },
      },
      opts,
    );
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let usage = { input: 0, output: 0 };
    let last = null;

    const handle = (raw) => {
      const data = raw
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('\n');
      if (!data) return;
      let chunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        return;
      }
      if (chunk.error) throw new GeminiError(500, `Gemini stream error: ${chunk.error.message}`);
      last = chunk;
      const delta = textOf(chunk);
      if (delta) {
        text += delta;
        onText?.(delta);
      }
      if (chunk.usageMetadata) usage = usageOf(chunk);
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        handle(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
    if (buffer.trim()) handle(buffer);
    if (!text) throw new GeminiError(500, `Gemini returned no text: ${blockedReason(last) || 'empty stream'}`);
    return { text, usage };
  },
};
