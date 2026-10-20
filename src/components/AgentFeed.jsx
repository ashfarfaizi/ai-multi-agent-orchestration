import { useEffect, useRef, useState } from 'react';
import Markdown from './Markdown.jsx';
import { SYSTEM_AGENTS, colorFor, fmtMs, fmtNum } from '../lib/theme.js';

const STATUS_LABEL = {
  queued: 'Queued',
  running: 'Working',
  revising: 'Revising',
  done: 'Done',
  flagged: 'Needs revision',
  error: 'Error',
};

function Card({ id, icon, name, subtitle, color, status, children, footer, onOpen, attempt }) {
  const bodyRef = useRef(null);
  const live = status === 'running' || status === 'revising';
  useEffect(() => {
    if (live && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  });
  return (
    <article className={`acard s-${status}`} style={{ '--c': color }} data-id={id}>
      <header className="acard-head">
        <span className="acard-icon">{icon}</span>
        <div className="acard-titles">
          <div className="acard-name">
            {name}
            {attempt > 1 && <span className="badge warn">v{attempt}</span>}
          </div>
          <div className="acard-sub">{subtitle}</div>
        </div>
        <span className={`pill p-${status}`}>
          <span className={`dot d-${status}`} />
          {STATUS_LABEL[status] || status}
        </span>
      </header>
      {children && (
        <div className="acard-body" ref={bodyRef}>
          {children}
        </div>
      )}
      {(footer || onOpen) && (
        <footer className="acard-foot">
          <span className="muted mono">{footer}</span>
          {onOpen && (
            <button type="button" className="link-btn" onClick={onOpen}>
              Inspect →
            </button>
          )}
        </footer>
      )}
    </article>
  );
}

function LogView({ log, startedAt }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log.length]);
  return (
    <div className="logview mono" ref={ref}>
      {log.map((l, i) => (
        <div key={i} className={`logline k-${l.kind}`}>
          <span className="log-t">+{((l.at - (startedAt || l.at)) / 1000).toFixed(1).padStart(5, ' ')}s</span>
          <span className="log-who">{l.who}</span>
          <span className="log-msg">{l.msg}</span>
        </div>
      ))}
      {!log.length && <div className="muted">Events from the orchestration bus appear here.</div>}
    </div>
  );
}

export default function AgentFeed({ state, now, onInspect }) {
  const [tab, setTab] = useState('agents');
  const { plan, agents, tasks, review } = state;
  const orch = agents.orchestrator;

  return (
    <div className="feed">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'agents'} className={tab === 'agents' ? 'on' : ''} onClick={() => setTab('agents')}>
          Agents
        </button>
        <button type="button" role="tab" aria-selected={tab === 'log'} className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
          Event bus <span className="count">{state.log.length}</span>
        </button>
      </div>

      {tab === 'log' ? (
        <LogView log={state.log} startedAt={state.startedAt} />
      ) : (
        <div className="feed-list">
          {state.status === 'idle' && <div className="empty muted">Start a run to watch each agent think and write in real time.</div>}

          {state.status !== 'idle' && (
            <Card
              id="orchestrator"
              icon={SYSTEM_AGENTS.orchestrator.icon}
              name="Orchestrator"
              subtitle={plan ? `Designed ${plan.tasks.length} agents · ${plan.tasks.filter((t) => !t.depends_on.length).length} start in parallel` : 'Decomposing the goal…'}
              color={SYSTEM_AGENTS.orchestrator.color}
              status={orch.status}
              onOpen={plan ? () => onInspect('orchestrator') : null}
            >
              {plan ? (
                <div className="plan-mini">
                  <p>{plan.strategy}</p>
                  <ol>
                    {plan.tasks.map((t) => (
                      <li key={t.id}>
                        <span>{t.icon}</span> <b>{t.agent_name}</b>: {t.title}
                        {t.depends_on.length > 0 && <span className="muted"> ← {t.depends_on.join(', ')}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div className="thinking">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </Card>
          )}

          {plan?.tasks.map((t) => {
            const s = tasks[t.id];
            const elapsed = s.segments.reduce((sum, x) => sum + ((x.end ?? now) - x.start), 0);
            const live = s.status === 'running' || s.status === 'revising';
            return (
              <Card
                key={t.id}
                id={t.id}
                icon={t.icon}
                name={t.agent_name}
                subtitle={t.title}
                color={colorFor(s.colorIndex)}
                status={s.status}
                attempt={s.attempt}
                onOpen={() => onInspect(t.id)}
                footer={
                  s.segments.length
                    ? `${fmtMs(elapsed)}${s.usage ? ` · ${fmtNum(s.usage.output)} tok` : ''}${s.review ? ` · review ${s.review.score}/10` : ''}`
                    : t.depends_on.length
                      ? `waiting on ${t.depends_on.join(', ')}`
                      : 'ready'
                }
              >
                {s.review?.verdict === 'revise' && (
                  <div className="feedback-note">
                    <b>Reviewer:</b> {s.review.feedback}
                  </div>
                )}
                {s.text ? <Markdown text={s.text} streaming={live} /> : live ? <div className="thinking"><span /><span /><span /></div> : null}
              </Card>
            );
          })}

          {(agents.reviewer.status !== 'queued' || review) && (
            <Card
              id="reviewer"
              icon={SYSTEM_AGENTS.reviewer.icon}
              name="Quality Reviewer"
              subtitle={review ? review.overall : 'Scoring every deliverable…'}
              color={SYSTEM_AGENTS.reviewer.color}
              status={agents.reviewer.status}
              onOpen={review ? () => onInspect('reviewer') : null}
            >
              {review ? (
                <ul className="review-list">
                  {review.reviews.map((r) => {
                    const t = plan.tasks.find((x) => x.id === r.taskId);
                    return (
                      <li key={r.taskId}>
                        <span className={`score ${r.score >= 7 ? 'good' : 'bad'}`}>{r.score}/10</span>
                        <span>
                          <b>{t?.agent_name}</b> {r.verdict === 'revise' ? <span className="warn-text">· sent back</span> : <span className="ok-text">· approved</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="thinking"><span /><span /><span /></div>
              )}
            </Card>
          )}

          {agents.synthesizer.status !== 'queued' && (
            <Card
              id="synthesizer"
              icon={SYSTEM_AGENTS.synthesizer.icon}
              name="Synthesizer"
              subtitle={agents.synthesizer.status === 'done' ? 'Final deliverable is ready below' : 'Writing the final deliverable (streaming below)…'}
              color={SYSTEM_AGENTS.synthesizer.color}
              status={agents.synthesizer.status}
            />
          )}
        </div>
      )}
    </div>
  );
}
