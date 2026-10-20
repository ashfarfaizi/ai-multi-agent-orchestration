import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SYSTEM_AGENTS, colorFor, fmtMs, initials } from '../lib/theme.js';

const NODE_W = 188;
const NODE_H = 62;
const ROW = 112;
const PAD_Y = 22;

function computeLayout(plan, width) {
  const tasks = plan?.tasks || [];
  const depth = {};
  for (const t of tasks) depth[t.id] = 1 + Math.max(0, ...t.depends_on.map((d) => depth[d] ?? 0));
  const maxDepth = Math.max(1, ...Object.values(depth));
  const layers = [['orchestrator']];
  for (let d = 1; d <= maxDepth; d++) layers.push(tasks.filter((t) => depth[t.id] === d).map((t) => t.id));
  if (!tasks.length) layers.push(['…']);
  layers.push(['reviewer'], ['synthesizer']);

  const widest = Math.max(...layers.map((l) => l.length));
  const innerW = Math.max(width, widest * (NODE_W + 18) + 24);
  const scale = Math.max(0.45, Math.min(1, width / innerW));
  const pos = {};
  layers.forEach((layer, li) => {
    const gap = innerW / layer.length;
    layer.forEach((id, i) => {
      pos[id] = { x: gap * i + gap / 2 - NODE_W / 2, y: PAD_Y + li * ROW };
    });
  });

  const edges = [];
  for (const t of tasks) {
    if (!t.depends_on.length) edges.push({ from: 'orchestrator', to: t.id, kind: 'plan' });
    for (const d of t.depends_on) edges.push({ from: d, to: t.id, kind: 'data' });
    edges.push({ from: t.id, to: 'reviewer', kind: 'review' });
  }
  if (!tasks.length) edges.push({ from: 'orchestrator', to: '…', kind: 'plan' }, { from: '…', to: 'reviewer', kind: 'plan' });
  edges.push({ from: 'reviewer', to: 'synthesizer', kind: 'data' });
  return { pos, edges, scale, width: innerW, height: PAD_Y * 2 + (layers.length - 1) * ROW + NODE_H };
}

function nodeStatus(state, id) {
  if (state.agents[id]) return state.agents[id].status;
  return state.tasks[id]?.status || 'queued';
}

const isDone = (s) => s === 'done' || s === 'flagged';
const isActive = (s) => s === 'running' || s === 'revising';

function edgeState(state, e) {
  const from = nodeStatus(state, e.from);
  const to = nodeStatus(state, e.to);
  if (isActive(to) && isDone(from)) return 'active';
  if (e.to === 'reviewer' && isActive(to)) return 'active';
  if (isDone(from) && (isDone(to) || isActive(to))) return 'done';
  return 'idle';
}

function path(a, b) {
  const x1 = a.x + NODE_W / 2;
  const y1 = a.y + NODE_H;
  const x2 = b.x + NODE_W / 2;
  const y2 = b.y;
  const my = (y1 + y2) / 2;
  return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
}

function feedbackPath(rev, t) {
  // Loop from the reviewer's side back up to the flagged task.
  const x1 = rev.x + NODE_W;
  const y1 = rev.y + NODE_H / 2;
  const x2 = t.x + NODE_W;
  const y2 = t.y + NODE_H / 2;
  const bulge = Math.max(x1, x2) + 60;
  return `M${x1},${y1} C${bulge},${y1} ${bulge},${y2} ${x2},${y2}`;
}

function elapsedOf(segments, now) {
  if (!segments?.length) return null;
  return segments.reduce((sum, s) => sum + ((s.end ?? now) - s.start), 0);
}

function Node({ id, state, pos, now, selected, onSelect }) {
  const sys = SYSTEM_AGENTS[id];
  const meta = state.plan?.tasks.find((t) => t.id === id);
  const t = state.tasks[id];
  const ag = state.agents[id];
  const status = nodeStatus(state, id);
  const color = sys ? sys.color : colorFor(t?.colorIndex ?? 0);
  const elapsed = elapsedOf((t || ag)?.segments, now);

  if (id === '…') {
    return (
      <div className="gnode ghost" style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}>
        <span className="muted">{state.status === 'idle' ? 'Specialists appear here' : 'Planning the team…'}</span>
      </div>
    );
  }

  const label = { queued: 'Waiting', running: 'Working', revising: 'Rewriting', done: 'Done', flagged: 'Needs changes', error: 'Failed' }[status];
  return (
    <button
      type="button"
      className={`gnode s-${status} ${selected ? 'selected' : ''}`}
      style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H, '--c': color }}
      onClick={() => onSelect(id)}
      title={meta ? `${meta.agent_name}: ${meta.title}` : sys.role}
    >
      <span className="badge-av">{initials(sys ? sys.name : meta?.agent_name)}</span>
      <span className="gnode-body">
        <span className="gnode-name">{sys ? sys.name : meta?.agent_name}</span>
        <span className="gnode-title">{sys ? sys.role : meta?.title}</span>
        <span className="gnode-meta">
          <span className={`dot d-${status}`} />
          {label}
          {elapsed != null && <span className="num">{fmtMs(elapsed)}</span>}
          {t?.review && <span className={`score ${t.review.score >= 7 ? 'good' : 'bad'}`}>{t.review.score}/10</span>}
        </span>
      </span>
    </button>
  );
}

export default function Graph({ state, now, selected, onSelect }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => computeLayout(state.plan, width), [state.plan, width]);
  const flagged = (state.review?.reviews || []).filter((r) => r.verdict === 'revise');

  return (
    <div className="graph-wrap" ref={wrapRef}>
      <div className="graph-sizer" style={{ width: layout.width * layout.scale, height: layout.height * layout.scale }}>
      <div className="graph-canvas" style={{ width: layout.width, height: layout.height, transform: `scale(${layout.scale})` }}>
        <svg className="graph-edges" width={layout.width} height={layout.height}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="arrowhead" />
            </marker>
            <marker id="arrow-warn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#b26b00" />
            </marker>
          </defs>
          {layout.edges.map((e) => {
            const a = layout.pos[e.from];
            const b = layout.pos[e.to];
            if (!a || !b) return null;
            const st = edgeState(state, e);
            return <path key={`${e.from}-${e.to}`} d={path(a, b)} className={`edge e-${st} k-${e.kind}`} markerEnd="url(#arrow)" />;
          })}
          {flagged.map((r) => {
            const a = layout.pos.reviewer;
            const b = layout.pos[r.taskId];
            if (!a || !b) return null;
            const st = state.tasks[r.taskId]?.status;
            return (
              <path
                key={`fb-${r.taskId}`}
                d={feedbackPath(a, b)}
                className={`edge feedback ${st === 'revising' ? 'e-active' : st === 'done' ? 'e-done' : 'e-pending'}`}
                markerEnd="url(#arrow-warn)"
              />
            );
          })}
        </svg>
        {Object.entries(layout.pos).map(([id, p]) => (
          <Node key={id} id={id} pos={p} state={state} now={now} selected={selected === id} onSelect={onSelect} />
        ))}
      </div>
      </div>
    </div>
  );
}
