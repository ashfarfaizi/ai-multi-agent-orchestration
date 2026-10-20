import { SYSTEM_AGENTS, colorFor, fmtMs } from '../lib/theme.js';

export default function Timeline({ state, now }) {
  const { plan, tasks, agents, startedAt } = state;
  if (!startedAt) return null;
  const end = state.endedAt ?? now;
  const span = Math.max(4000, end - startedAt);

  const rows = [
    { id: 'orchestrator', label: 'Orchestrator', icon: SYSTEM_AGENTS.orchestrator.icon, color: SYSTEM_AGENTS.orchestrator.color, segs: agents.orchestrator.segments },
    ...(plan?.tasks || []).map((t) => ({
      id: t.id,
      label: t.agent_name,
      icon: t.icon,
      color: colorFor(tasks[t.id].colorIndex),
      segs: tasks[t.id].segments,
    })),
    { id: 'reviewer', label: 'Reviewer', icon: SYSTEM_AGENTS.reviewer.icon, color: SYSTEM_AGENTS.reviewer.color, segs: agents.reviewer.segments },
    { id: 'synthesizer', label: 'Synthesizer', icon: SYSTEM_AGENTS.synthesizer.icon, color: SYSTEM_AGENTS.synthesizer.color, segs: agents.synthesizer.segments },
  ];

  const ticks = [];
  const step = span > 120000 ? 30000 : span > 40000 ? 10000 : span > 15000 ? 5000 : 2000;
  for (let x = 0; x <= span; x += step) ticks.push(x);

  return (
    <div className="timeline">
      <div className="tl-axis">
        <div className="tl-label" />
        <div className="tl-track">
          {ticks.map((x) => (
            <span key={x} className="tl-tick" style={{ left: `${(x / span) * 100}%` }}>
              {x / 1000}s
            </span>
          ))}
        </div>
      </div>
      {rows.map((r) => (
        <div className="tl-row" key={r.id}>
          <div className="tl-label">
            <span className="tl-swatch" style={{ background: r.color }} />
            <span className="tl-name">{r.label}</span>
          </div>
          <div className="tl-track">
            {ticks.map((x) => (
              <span key={x} className="tl-grid" style={{ left: `${(x / span) * 100}%` }} />
            ))}
            {r.segs.map((s, i) => {
              const left = ((s.start - startedAt) / span) * 100;
              const width = Math.max(0.6, (((s.end ?? now) - s.start) / span) * 100);
              return (
                <span
                  key={i}
                  className={`tl-bar ${s.end == null ? 'live' : ''} ${s.attempt > 1 ? 'rev' : ''}`}
                  style={{ left: `${left}%`, width: `${width}%`, '--c': r.color }}
                  title={`${r.label}${s.attempt > 1 ? ' (revision)' : ''}: ${fmtMs((s.end ?? now) - s.start)}`}
                >
                  <span className="tl-bar-text">{s.attempt > 1 ? 'rewrite ' : ''}{fmtMs((s.end ?? now) - s.start)}</span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
      {state.status === 'running' && (
        <div className="tl-now" style={{ left: `calc(var(--tl-label) + (100% - var(--tl-label)) * ${(now - startedAt) / span})` }} />
      )}
    </div>
  );
}
