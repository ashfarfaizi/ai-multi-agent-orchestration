import { runOrchestration, MODELS, DEFAULT_MODEL } from '../lib/orchestrator.js';

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

  // Server key wins; otherwise accept a user-supplied key (bring-your-own-key).
  const apiKey = process.env.ANTHROPIC_API_KEY || String(req.headers['x-anthropic-key'] || '').trim();
  if (!apiKey) return sendJson(res, 401, { error: 'No Anthropic API key configured. Add one in Settings or set ANTHROPIC_API_KEY.' });

  const model = MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;

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
    await runOrchestration({ task, apiKey, model, emit, signal: controller.signal });
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
