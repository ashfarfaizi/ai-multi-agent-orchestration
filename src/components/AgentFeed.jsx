import { useEffect, useRef, useState } from 'react';
import Markdown from './Markdown.jsx';
import { SYSTEM_AGENTS, colorFor, fmtMs, fmtNum, initials } from '../lib/theme.js';

const STATUS_LABEL = {
  queued: 'Waiting',
  running: 'Working',
  revising: 'Rewriting',
  done: 'Done',
  flagged: 'Needs changes',
  error: 'Failed',
};

function Card({ id, name, subtitle, color, status, children, footer, onOpen, attempt }) {
  const bodyRef = useRef(null);
  const live = status === 'running' || status === 'revising';
  useEffect(() => {
    if (live && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  });
  return (
    <article className={`acard s-${status}`} style={{ '--c': color }} data-id={id}>
      <header className="acard-head">
        <span className="badge-av">{initials(name)}</span>
        <div className="acard-titles">
          <div className="acard-name">
            {name}
            {attempt > 1 && <span className="tag warn">draft {attempt}</span>}
          </div>
          <div className="acard-sub">{subtitle}</div>
        </div>
        <span className={`state st-${status}`}>
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
          <span className="muted">{footer}</span>
          {onOpen && (
            <button type="button" className="link-btn" onClick={onOpen}>
              Details
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
    <div className="logview" ref={ref}>
      {log.map((l, i) => (
        <div key={i} className={`logline k-${l.kind}`}>
          <span className="log-t">{((l.at - (startedAt || l.at)) / 1000).toFixed(1)}s</span>
          <span className="log-who">{l.who}</span>
          <span className="log-msg">{l.msg}</span>
        </div>
      ))}
      {!log.length && <div className="muted">Every step of the run is logged here.</div>}
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
          Log <span className="count">{state.log.length}</span>
        </button>
      </div>

      {tab === 'log' ? (
        <LogView log={state.log} startedAt={state.startedAt} />
      ) : (
        <div className="feed-list">
          {state.status === 'idle' && <div className="empty muted">Run the team to see each agent write its part.</div>}

          {state.status !== 'idle' && (
            <Card
              id="orchestrator"
              name="Orchestrator"
              subtitle={plan ? `Made ${plan.tasks.length} tasks, ${plan.tasks.filter((t) => !t.depends_on.length).length} of them can start right away` : 'Splitting the goal into tasks…'}
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
                        <b>{t.agent_name}</b>: {t.title}
                        {t.depends_on.length > 0 && <span className="muted"> (after {t.depends_on.map((d) => plan.tasks.find((x) => x.id === d)?.agent_name || d).join(', ')})</span>}
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
                name={t.agent_name}
                subtitle={t.title}
                color={colorFor(s.colorIndex)}
                status={s.status}
                attempt={s.attempt}
                onOpen={() => onInspect(t.id)}
                footer={
                  s.segments.length
                    ? [fmtMs(elapsed), s.usage && `${fmtNum(s.usage.output)} tokens`, s.review && `score ${s.review.score}/10`].filter(Boolean).join(', ')
                    : t.depends_on.length
                      ? `Waits for ${t.depends_on.map((d) => plan.tasks.find((x) => x.id === d)?.agent_name || d).join(' and ')}`
                      : 'Starts right away'
                }
              >
                {s.review?.verdict === 'revise' && (
                  <div className="feedback-note">
                    <b>Reviewer notes:</b> {s.review.feedback}
                  </div>
                )}
                {s.text ? <Markdown text={s.text} streaming={live} /> : live ? <div className="thinking"><span /><span /><span /></div> : null}
              </Card>
            );
          })}

          {(agents.reviewer.status !== 'queued' || review) && (
            <Card
              id="reviewer"
              name="Reviewer"
              subtitle={review ? review.overall : 'Reading and scoring every result…'}
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
                          <b>{t?.agent_name}</b> {r.verdict === 'revise' ? <span className="warn-text">sent back</span> : <span className="ok-text">approved</span>}
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
              name="Synthesizer"
              subtitle={agents.synthesizer.status === 'done' ? 'The final document is below.' : 'Writing the final document below…'}
              color={SYSTEM_AGENTS.synthesizer.color}
              status={agents.synthesizer.status}
            />
          )}
        </div>
      )}
    </div>
  );
}
