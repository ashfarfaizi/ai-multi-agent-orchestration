import { SCENARIOS } from './scenarios.js';

/** Live mode: POST to the serverless orchestrator and read the NDJSON event stream. */
export async function runLive({ task, model, apiKey, onEvent, signal }) {
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers['x-anthropic-key'] = apiKey;
  const res = await fetch('/api/orchestrate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ task, model }),
    signal,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      msg = (await res.json()).error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const evt = JSON.parse(line);
      if (evt.type === 'ping') continue;
      if (evt.type === 'run_done' || evt.type === 'error') finished = true;
      onEvent(evt);
    }
  }
  if (!finished) throw new Error('The connection closed before the run finished (the server may have timed out).');
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

const tokens = (s) => Math.ceil(s.length / 4);

async function streamChunks(text, { cps, signal, emit }) {
  // Emit word-ish chunks at roughly `cps` characters per second.
  const parts = text.match(/\S+\s*|\s+/g) || [];
  let batch = '';
  const tick = 40;
  const perTick = Math.max(4, Math.round((cps * tick) / 1000));
  for (const p of parts) {
    batch += p;
    if (batch.length >= perTick) {
      emit(batch);
      batch = '';
      await sleep(tick * (0.6 + Math.random() * 0.8), signal);
    }
  }
  if (batch) emit(batch);
}

/** Demo mode: replays a recorded scenario through the exact same event protocol. */
export async function runDemo({ scenarioId, onEvent, signal, speed = 1 }) {
  const sc = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  const emit = (e) => onEvent({ ...e, t: Date.now() });
  const usage = { input: 0, output: 0 };
  const addUsage = (i, o) => {
    usage.input += i;
    usage.output += o;
    emit({ type: 'usage', usage: { ...usage } });
  };
  const t0 = Date.now();
  const plan = sc.plan;
  const outputs = {};

  emit({ type: 'run_start', task: sc.prompt, model: 'demo-replay', mode: 'demo' });
  emit({ type: 'phase', phase: 'planning' });
  emit({ type: 'agent_start', agent: 'orchestrator' });
  await sleep(2200 / speed, signal);
  addUsage(620, tokens(JSON.stringify(plan)));
  emit({ type: 'plan', plan });
  emit({ type: 'agent_done', agent: 'orchestrator' });
  emit({ type: 'phase', phase: 'executing' });

  // Each agent "types" at its own pace so the parallelism is visible.
  const paceFor = (id) => (170 + ((id.charCodeAt(id.length - 1) * 37) % 120)) * speed;

  const runTask = async (t, attempt, text) => {
    emit({ type: 'task_start', taskId: t.id, attempt });
    const started = Date.now();
    await sleep((500 + Math.random() * 600) / speed, signal); // time to first token
    await streamChunks(text, {
      cps: paceFor(t.id),
      signal,
      emit: (d) => emit({ type: 'task_delta', taskId: t.id, text: d }),
    });
    outputs[t.id] = text;
    const u = { input: 380 + t.depends_on.length * 450 + (attempt > 1 ? 700 : 0), output: tokens(text) };
    addUsage(u.input, u.output);
    emit({ type: 'task_done', taskId: t.id, attempt, output: text, usage: u, ms: Date.now() - started });
  };

  // Same DAG scheduling semantics as the server.
  await new Promise((resolve, reject) => {
    const status = Object.fromEntries(plan.tasks.map((t) => [t.id, 'pending']));
    const pump = () => {
      if (plan.tasks.every((t) => status[t.id] === 'done')) return resolve();
      for (const t of plan.tasks) {
        if (status[t.id] !== 'pending') continue;
        if (!t.depends_on.every((d) => status[d] === 'done')) continue;
        status[t.id] = 'running';
        runTask(t, 1, sc.outputs[t.id])
          .then(() => {
            status[t.id] = 'done';
            pump();
          })
          .catch(reject);
      }
    };
    pump();
  });

  emit({ type: 'phase', phase: 'reviewing' });
  emit({ type: 'agent_start', agent: 'reviewer' });
  await sleep(2600 / speed, signal);
  addUsage(tokens(Object.values(outputs).join('')) + 400, 420);
  emit({ type: 'review', overall: sc.review.overall, reviews: sc.review.reviews });
  emit({ type: 'agent_done', agent: 'reviewer' });

  const revs = Object.entries(sc.revisions || {});
  if (revs.length) {
    emit({ type: 'phase', phase: 'revising' });
    await Promise.all(revs.map(([id, text]) => runTask(plan.tasks.find((t) => t.id === id), 2, text)));
  }

  emit({ type: 'phase', phase: 'synthesizing' });
  emit({ type: 'agent_start', agent: 'synthesizer' });
  await sleep(700 / speed, signal);
  await streamChunks(sc.report, { cps: 650 * speed, signal, emit: (d) => emit({ type: 'synth_delta', text: d }) });
  addUsage(tokens(Object.values(outputs).join('')) + 300, tokens(sc.report));
  emit({ type: 'agent_done', agent: 'synthesizer', output: sc.report });
  emit({ type: 'phase', phase: 'done' });
  emit({ type: 'run_done', ms: Date.now() - t0, usage });
}
