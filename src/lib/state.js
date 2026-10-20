// Turns the orchestration event stream into UI state.

export const initialState = {
  status: 'idle', // idle | running | done | error | stopped
  mode: null,
  model: null,
  task: '',
  phase: null,
  plan: null,
  agents: {
    orchestrator: { status: 'queued', segments: [] },
    reviewer: { status: 'queued', segments: [] },
    synthesizer: { status: 'queued', segments: [] },
  },
  tasks: {},
  review: null,
  report: '',
  usage: { input: 0, output: 0 },
  startedAt: null,
  endedAt: null,
  error: null,
  log: [],
};

const closeSegments = (segs, at) => segs.map((s) => (s.end == null ? { ...s, end: at } : s));

function log(state, entry) {
  const next = state.log.length > 400 ? state.log.slice(-400) : state.log;
  return [...next, { at: entry.at, kind: entry.kind || 'info', who: entry.who, msg: entry.msg }];
}

export function reducer(state, a) {
  const at = a.at;
  switch (a.type) {
    case 'reset':
      return { ...initialState, agents: structuredClone(initialState.agents) };

    case 'run_start':
      return {
        ...initialState,
        agents: structuredClone(initialState.agents),
        status: 'running',
        mode: a.mode,
        model: a.model,
        task: a.task,
        startedAt: at,
        log: [{ at, kind: 'sys', who: 'system', msg: `Run started (${a.mode === 'demo' ? 'demo replay' : a.model})` }],
      };

    case 'phase':
      return {
        ...state,
        phase: a.phase,
        log: a.phase === 'done' ? state.log : log(state, { at, kind: 'phase', who: 'orchestrator', msg: `Phase → ${a.phase}` }),
      };

    case 'agent_start': {
      const ag = state.agents[a.agent];
      const labels = { orchestrator: 'Decomposing goal into a task graph…', reviewer: 'Reviewing all deliverables…', synthesizer: 'Merging deliverables into the final answer…' };
      return {
        ...state,
        agents: { ...state.agents, [a.agent]: { ...ag, status: 'running', segments: [...ag.segments, { start: at, end: null, attempt: 1 }] } },
        log: log(state, { at, who: a.agent, msg: labels[a.agent] || 'started' }),
      };
    }

    case 'agent_done': {
      const ag = state.agents[a.agent];
      return {
        ...state,
        agents: { ...state.agents, [a.agent]: { ...ag, status: 'done', segments: closeSegments(ag.segments, at) } },
        report: a.agent === 'synthesizer' && a.output ? a.output : state.report,
        log: a.agent === 'synthesizer' ? log(state, { at, kind: 'ok', who: 'synthesizer', msg: 'Final deliverable ready' }) : state.log,
      };
    }

    case 'plan': {
      const tasks = {};
      a.plan.tasks.forEach((t, i) => {
        tasks[t.id] = { status: 'queued', attempt: 0, text: '', segments: [], usage: null, review: null, colorIndex: i };
      });
      const parallel = a.plan.tasks.filter((t) => !t.depends_on.length).length;
      return {
        ...state,
        plan: a.plan,
        tasks,
        log: log(state, {
          at,
          kind: 'ok',
          who: 'orchestrator',
          msg: `Planned ${a.plan.tasks.length} tasks for ${a.plan.tasks.length} specialist agents · ${parallel} can start in parallel`,
        }),
      };
    }

    case 'task_start': {
      const t = state.tasks[a.taskId];
      if (!t) return state;
      const meta = state.plan.tasks.find((x) => x.id === a.taskId);
      const deps = meta.depends_on.map((d) => state.plan.tasks.find((x) => x.id === d)?.agent_name).filter(Boolean);
      return {
        ...state,
        tasks: {
          ...state.tasks,
          [a.taskId]: {
            ...t,
            status: a.attempt > 1 ? 'revising' : 'running',
            attempt: a.attempt,
            text: '',
            previous: a.attempt > 1 ? t.text : t.previous,
            segments: [...t.segments, { start: at, end: null, attempt: a.attempt }],
          },
        },
        log: log(state, {
          at,
          kind: a.attempt > 1 ? 'warn' : 'info',
          who: meta.agent_name,
          msg: a.attempt > 1 ? `Revising "${meta.title}" with reviewer feedback` : `Started "${meta.title}"${deps.length ? ` ← context from ${deps.join(', ')}` : ''}`,
        }),
      };
    }

    case 'deltas': {
      // Batched text deltas: { tasks: {id: text}, synth: text }
      let tasks = state.tasks;
      for (const [id, text] of Object.entries(a.tasks || {})) {
        if (!tasks[id]) continue;
        tasks = { ...tasks, [id]: { ...tasks[id], text: tasks[id].text + text } };
      }
      return { ...state, tasks, report: a.synth ? state.report + a.synth : state.report };
    }

    case 'task_done': {
      const t = state.tasks[a.taskId];
      if (!t) return state;
      const meta = state.plan.tasks.find((x) => x.id === a.taskId);
      return {
        ...state,
        tasks: {
          ...state.tasks,
          [a.taskId]: { ...t, status: 'done', text: a.output, usage: a.usage, segments: closeSegments(t.segments, at) },
        },
        log: log(state, {
          at,
          kind: 'ok',
          who: meta.agent_name,
          msg: `Delivered "${meta.title}"${a.attempt > 1 ? ' (v2)' : ''} · ${a.usage?.output ?? '?'} tokens · ${(a.ms / 1000).toFixed(1)}s`,
        }),
      };
    }

    case 'review': {
      const tasks = { ...state.tasks };
      let st = state;
      let logs = state.log;
      for (const r of a.reviews) {
        if (!tasks[r.taskId]) continue;
        tasks[r.taskId] = { ...tasks[r.taskId], review: r, status: r.verdict === 'revise' ? 'flagged' : tasks[r.taskId].status };
        const name = state.plan.tasks.find((x) => x.id === r.taskId)?.agent_name;
        st = { ...st, log: logs };
        logs = log(st, {
          at,
          kind: r.verdict === 'revise' ? 'warn' : 'ok',
          who: 'reviewer',
          msg: `${name}: ${r.score}/10 · ${r.verdict === 'revise' ? 'sent back for revision' : 'approved'}`,
        });
      }
      return { ...state, tasks, review: { overall: a.overall, reviews: a.reviews }, log: logs };
    }

    case 'usage':
      return { ...state, usage: a.usage };

    case 'retry':
      return { ...state, log: log(state, { at, kind: 'warn', who: 'system', msg: a.message }) };

    case 'run_done':
      return { ...state, status: 'done', endedAt: at, phase: 'done', usage: a.usage || state.usage };

    case 'error':
    case 'stopped': {
      const tasks = Object.fromEntries(
        Object.entries(state.tasks).map(([id, t]) => [
          id,
          t.status === 'running' || t.status === 'revising' ? { ...t, status: 'error', segments: closeSegments(t.segments, at) } : t,
        ]),
      );
      const agents = Object.fromEntries(
        Object.entries(state.agents).map(([k, v]) => [k, v.status === 'running' ? { ...v, status: 'error', segments: closeSegments(v.segments, at) } : v]),
      );
      return {
        ...state,
        status: a.type === 'error' ? 'error' : 'stopped',
        error: a.type === 'error' ? a.message : null,
        endedAt: at,
        tasks,
        agents,
        log: log(state, { at, kind: 'err', who: 'system', msg: a.type === 'error' ? a.message : 'Run stopped by user' }),
      };
    }

    default:
      return state;
  }
}

/** Peak number of agents that were working at the same moment. */
export function peakParallelism(state) {
  const pts = [];
  for (const t of Object.values(state.tasks)) {
    for (const s of t.segments) {
      pts.push([s.start, 1]);
      pts.push([s.end ?? Infinity, -1]);
    }
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let peak = 0;
  for (const [, d] of pts) {
    cur += d;
    peak = Math.max(peak, cur);
  }
  return peak;
}
