import { runOrchestration } from '../lib/orchestrator.js';
import { PROVIDERS, DEFAULT_PROVIDER, serverKey } from '../lib/providers/index.js';

async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}');
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST' });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const task = String(body.task || '').trim();
  if (task.length < 8) return sendJson(res, 400, { error: 'Describe the goal in a bit more detail.' });
  if (task.length > 4000) return sendJson(res, 400, { error: 'Goal is too long (max 4000 characters).' });

  const provider = PROVIDERS[body.provider] || PROVIDERS[process.env.LLM_PROVIDER] || PROVIDERS[DEFAULT_PROVIDER];

  // Server key wins; otherwise accept a user-supplied key (bring-your-own-key).
  const apiKey = serverKey(provider) || String(req.headers[provider.keyHeader] || '').trim();
  if (!apiKey) {
    const hint = provider.id === 'gemini' ? 'Get a free key at aistudio.google.com/apikey and add it in Settings (or set GEMINI_API_KEY).' : 'Add an Anthropic key in Settings (or set ANTHROPIC_API_KEY).';
    return sendJson(res, 401, { error: `No ${provider.label} API key configured. ${hint}` });
  }

  const envModel = process.env[`${provider.id.toUpperCase()}_MODEL`];
  const model = provider.models.includes(body.model)
    ? body.model
    : provider.models.includes(envModel)
      ? envModel
      : provider.defaultModel;

  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    'x-accel-buffering': 'no',
    connection: 'keep-alive',
  });
  res.flushHeaders?.();

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });

  const emit = (event) => {
    if (res.writableEnded || controller.signal.aborted) return;
    res.write(JSON.stringify({ ...event, t: Date.now() }) + '\n');
  };
  const heartbeat = setInterval(() => emit({ type: 'ping' }), 10000);

  try {
    await runOrchestration({ task, provider, apiKey, model, emit, signal: controller.signal });
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error('[orchestrate]', err);
      emit({ type: 'error', message: err?.message || 'Orchestration failed' });
    }
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
}
