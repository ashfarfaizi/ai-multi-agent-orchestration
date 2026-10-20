import { useEffect } from 'react';
import Markdown from './Markdown.jsx';
import { SYSTEM_AGENTS, colorFor, fmtMs, fmtNum } from '../lib/theme.js';

export default function Inspector({ id, state, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!id) return null;

  const { plan } = state;
  const sys = SYSTEM_AGENTS[id];
  const meta = plan?.tasks.find((t) => t.id === id);
  const t = state.tasks[id];

  let body;
  if (id === 'orchestrator') {
    body = plan ? (
      <>
        <h4>Goal</h4>
        <p>{plan.goal}</p>
        <h4>Strategy</h4>
        <p>{plan.strategy}</p>
        <h4>Task graph</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Agent</th><th>Deliverable</th><th>Depends on</th></tr>
            </thead>
            <tbody>
              {plan.tasks.map((x) => (
                <tr key={x.id}>
                  <td className="mono">{x.id}</td>
                  <td>{x.icon} {x.agent_name}</td>
                  <td>{x.title}</td>
                  <td className="mono">{x.depends_on.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ) : <p className="muted">Planning…</p>;
  } else if (id === 'reviewer') {
    body = state.review ? (
      <>
        <p>{state.review.overall}</p>
        {state.review.reviews.map((r) => {
          const x = plan.tasks.find((p) => p.id === r.taskId);
          return (
            <div key={r.taskId} className="insp-review">
              <div className="row between">
                <b>{x?.icon} {x?.agent_name}</b>
                <span className={`score ${r.score >= 7 ? 'good' : 'bad'}`}>{r.score}/10 · {r.verdict}</span>
              </div>
              <p>{r.feedback}</p>
            </div>
          );
        })}
      </>
    ) : <p className="muted">Reviewing…</p>;
  } else if (id === 'synthesizer') {
    body = <Markdown text={state.report || '_Not started yet._'} />;
  } else if (meta && t) {
    const deps = meta.depends_on.map((d) => plan.tasks.find((x) => x.id === d)).filter(Boolean);
    const elapsed = t.segments.reduce((s, x) => s + ((x.end ?? Date.now()) - x.start), 0);
    body = (
      <>
        <div className="insp-stats mono">
          <span>status: {t.status}</span>
          <span>attempts: {Math.max(1, t.attempt)}</span>
          <span>time: {fmtMs(elapsed)}</span>
          {t.usage && <span>tokens: {fmtNum(t.usage.input)} in / {fmtNum(t.usage.output)} out</span>}
        </div>
        <h4>Role</h4>
        <p>{meta.agent_role}</p>
        <h4>Assignment from the orchestrator</h4>
        <p>{meta.instructions}</p>
        <h4>Context received</h4>
        <p>{deps.length ? deps.map((d) => `${d.icon} ${d.agent_name} (${d.title})`).join(' · ') : 'None: this agent started immediately, in parallel with the others.'}</p>
        {t.review && (
          <>
            <h4>Review</h4>
            <p>
              <span className={`score ${t.review.score >= 7 ? 'good' : 'bad'}`}>{t.review.score}/10</span> {t.review.feedback}
            </p>
          </>
        )}
        <h4>Deliverable{t.attempt > 1 ? ' (revised)' : ''}</h4>
        <Markdown text={t.text || '_Waiting to start…_'} />
        {t.previous && t.attempt > 1 && (
          <details className="prev">
            <summary>Show first draft (before review)</summary>
            <Markdown text={t.previous} />
          </details>
        )}
      </>
    );
  }

  const color = sys ? sys.color : colorFor(t?.colorIndex ?? 0);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" style={{ '--c': color }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Agent inspector">
        <header className="drawer-head">
          <span className="acard-icon">{sys ? sys.icon : meta?.icon}</span>
          <div>
            <div className="drawer-title">{sys ? sys.name : meta?.agent_name}</div>
            <div className="muted">{sys ? sys.role : meta?.title}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="drawer-body">{body}</div>
      </aside>
    </div>
  );
}
