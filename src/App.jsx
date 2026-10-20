import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Graph from './components/Graph.jsx';
import AgentFeed from './components/AgentFeed.jsx';
import Timeline from './components/Timeline.jsx';
import Report from './components/Report.jsx';
import Inspector from './components/Inspector.jsx';
import Settings, { FALLBACK_PROVIDERS } from './components/Settings.jsx';
import { initialState, reducer, peakParallelism } from './lib/state.js';
import { runDemo, runLive } from './lib/engines.js';
import { SCENARIOS } from './lib/scenarios.js';
import { fmtMs, fmtNum } from './lib/theme.js';

const REPO_URL = 'https://github.com/ashfarfaizi/orchestration-app';
const STORE_KEY = 'mao.settings.v2';
const DEFAULT_SETTINGS = { mode: null, provider: 'gemini', keys: { gemini: '', anthropic: '' }, models: {} };

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    return s ? { ...DEFAULT_SETTINGS, ...s, keys: { ...DEFAULT_SETTINGS.keys, ...s.keys } } : null;
  } catch {
    return null;
  }
}
function saveSettings(s) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch { /* storage unavailable */ }
}

const PHASES = [
  { id: 'planning', label: 'Plan' },
  { id: 'executing', label: 'Execute in parallel' },
  { id: 'reviewing', label: 'Review' },
  { id: 'revising', label: 'Revise' },
  { id: 'synthesizing', label: 'Synthesize' },
  { id: 'done', label: 'Deliver' },
];

function Stepper({ phase, status, hadRevision }) {
  const idx = PHASES.findIndex((p) => p.id === phase);
  return (
    <ol className="stepper">
      {PHASES.map((p, i) => {
        let cls = 'todo';
        if (i < idx || (status === 'done' && i <= idx)) cls = 'done';
        else if (i === idx) cls = status === 'running' ? 'now' : status === 'done' ? 'done' : 'halt';
        if (p.id === 'revising' && i < idx && !hadRevision) cls = 'skip';
        return (
          <li key={p.id} className={cls}>
            <span className="step-dot">{cls === 'done' ? '✓' : cls === 'skip' ? '–' : i + 1}</span>
            <span className="step-label">{p.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={`stat ${accent ? 'accent' : ''}`}>
      <div className="stat-v mono">{value}</div>
      <div className="stat-l">{label}</div>
    </div>
  );
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g stroke="url(#lg)" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <path d="M32 17 L17 40 M32 17 L47 40 M32 17 L32 40 M17 40 L32 50 M47 40 L32 50 M32 40 L32 50" />
      </g>
      <circle cx="32" cy="16" r="6.5" fill="url(#lg)" />
      <circle cx="17" cy="40" r="4.5" fill="#8b5cf6" />
      <circle cx="32" cy="40" r="4.5" fill="#3b82f6" />
      <circle cx="47" cy="40" r="4.5" fill="#22d3ee" />
      <circle cx="32" cy="51" r="4" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [health, setHealth] = useState(null);
  const [settings, setSettings] = useState(() => loadSettings() || DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [selected, setSelected] = useState(null);
  const [task, setTask] = useState(SCENARIOS[0].prompt);
  const [notice, setNotice] = useState(null);
  const [now, setNow] = useState(Date.now());
  const abortRef = useRef(null);
  const dashRef = useRef(null);
  const pending = useRef({ tasks: {}, synth: '', timer: null });

  useEffect(() => {
    let alive = true;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((h) => {
        if (!alive) return;
        setHealth(h || { serverKey: false, providers: null });
        setSettings((s) => (s.mode ? s : { ...s, mode: h?.serverKey ? 'live' : 'demo', provider: h?.defaultProvider || s.provider }));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (state.status !== 'running') return undefined;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [state.status]);

  const flush = useCallback(() => {
    const p = pending.current;
    if (p.timer) clearTimeout(p.timer);
    p.timer = null;
    if (!Object.keys(p.tasks).length && !p.synth) return;
    dispatch({ type: 'deltas', tasks: p.tasks, synth: p.synth });
    p.tasks = {};
    p.synth = '';
  }, []);

  const onEvent = useCallback(
    (e) => {
      const p = pending.current;
      if (e.type === 'task_delta' || e.type === 'synth_delta') {
        if (e.type === 'task_delta') p.tasks[e.taskId] = (p.tasks[e.taskId] || '') + e.text;
        else p.synth += e.text;
        if (!p.timer) p.timer = setTimeout(flush, 60);
        return;
      }
      flush();
      dispatch({ ...e, at: Date.now() });
    },
    [flush],
  );

  const mode = settings.mode || 'demo';
  const providers = health?.providers || FALLBACK_PROVIDERS;
  const prov = providers.find((p) => p.id === settings.provider) || providers[0];
  const model = prov.models.includes(settings.models?.[prov.id]) ? settings.models[prov.id] : prov.defaultModel;
  const userKey = settings.keys?.[prov.id] || '';
  const liveReady = Boolean(prov.serverKey || userKey);

  const start = async () => {
    const text = task.trim();
    setNotice(null);
    let scenario = null;
    if (mode === 'demo') {
      scenario = SCENARIOS.find((s) => s.prompt === text);
      if (!scenario) {
        setNotice('demo-custom');
        return;
      }
    } else if (!liveReady) {
      setShowSettings(true);
      return;
    } else if (text.length < 8) {
      setNotice('short');
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSelected(null);
    dispatch({ type: 'reset' });
    setNow(Date.now());
    requestAnimationFrame(() => dashRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    try {
      if (scenario) await runDemo({ scenarioId: scenario.id, onEvent, signal: ac.signal });
      else await runLive({ task: text, provider: prov.id, model, apiKey: prov.serverKey ? '' : userKey, onEvent, signal: ac.signal });
    } catch (err) {
      flush();
      if (err?.name === 'AbortError') dispatch({ type: 'stopped', at: Date.now() });
      else dispatch({ type: 'error', message: err?.message || String(err), at: Date.now() });
    } finally {
      flush();
    }
  };

  const stop = () => abortRef.current?.abort();

  const running = state.status === 'running';
  const elapsed = state.startedAt ? (state.endedAt ?? now) - state.startedAt : 0;
  const reviews = state.review?.reviews || [];
  const revisions = reviews.filter((r) => r.verdict === 'revise').length;
  const avgScore = reviews.length ? (reviews.reduce((s, r) => s + r.score, 0) / reviews.length).toFixed(1) : '—';
  const agentCount = state.plan ? state.plan.tasks.length + 3 : '—';

  return (
    <div className="app">
      <div className="bg-grid" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="/">
          <Logo />
          <span>
            <span className="brand-name">Multi-Agent Orchestration</span>
            <span className="brand-sub">plan · parallelize · review · synthesize</span>
          </span>
        </a>
        <div className="row gap">
          <button type="button" className={`mode-pill ${mode}`} onClick={() => setShowSettings(true)} title="Change mode & model">
            <span className={`dot ${mode === 'live' ? 'd-done' : 'd-flagged'}`} />
            {mode === 'live' ? `Live · ${model}` : 'Demo replay'}
          </button>
          <a className="icon-btn" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source on GitHub" title="Source on GitHub">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
          <button type="button" className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings" title="Settings">
            ⚙
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow">Multi-agent AI system · live</div>
          <h1>
            One goal.
            <br />
            <span className="grad">A whole team of AI agents.</span>
          </h1>
          <p className="lede">
            An <b>Orchestrator</b> breaks your goal into a task graph and designs a specialist agent for each piece. The agents
            work <b>in parallel</b> and pass context downstream. A <b>Reviewer</b> sends weak work back for revision, and a{' '}
            <b>Synthesizer</b> delivers the final answer. You watch all of it stream live.
          </p>

          <div className="composer">
            <textarea
              value={task}
              onChange={(e) => {
                setTask(e.target.value);
                setNotice(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !running) start();
              }}
              placeholder="Describe a goal: a plan, a design, a decision, a research question…"
              rows={3}
              maxLength={4000}
              aria-label="Goal for the agent team"
            />
            <div className="composer-row">
              <div className="chips">
                {SCENARIOS.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`chip ${task === s.prompt ? 'on' : ''}`}
                    onClick={() => {
                      setTask(s.prompt);
                      setNotice(null);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {running ? (
                <button type="button" className="btn danger" onClick={stop}>
                  ■ Stop
                </button>
              ) : (
                <button type="button" className="btn primary big" onClick={start}>
                  Orchestrate <span className="kbd">⌘↵</span>
                </button>
              )}
            </div>
            {notice === 'demo-custom' && (
              <div className="notice">
                <b>You're in demo mode,</b> which replays three recorded runs (pick one above). To send real AI agents after{' '}
                <i>any</i> goal, go live with a <b>free Google Gemini API key</b>.
                <button type="button" className="btn sm primary" onClick={() => setShowSettings(true)}>
                  Go live
                </button>
              </div>
            )}
            {notice === 'short' && <div className="notice">Describe the goal in a bit more detail.</div>}
          </div>
        </section>

        {state.status === 'idle' && (
          <section className="how">
            {[
              ['🧠', 'Plan', 'The Orchestrator turns your goal into a dependency graph (DAG) and designs a specialist for each node.'],
              ['⚡', 'Execute in parallel', 'A scheduler runs every task whose inputs are ready at the same time, passing outputs downstream as context.'],
              ['🧐', 'Review & revise', 'A Quality Reviewer scores each deliverable and sends weak ones back with concrete feedback.'],
              ['✨', 'Synthesize', 'A Synthesizer merges everything into one polished deliverable you can copy or download.'],
            ].map(([icon, title, body], i) => (
              <div className="how-card" key={title}>
                <div className="how-n mono">0{i + 1}</div>
                <div className="how-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </section>
        )}

        {state.status !== 'idle' && (
          <section className="dash" ref={dashRef}>
            <div className="dash-top">
              <Stepper phase={state.phase} status={state.status} hadRevision={revisions > 0} />
              <div className="stats">
                <Stat label="elapsed" value={fmtMs(elapsed)} accent={running} />
                <Stat label="agents" value={agentCount} />
                <Stat label="peak parallel" value={peakParallelism(state) || '—'} />
                <Stat label="tokens" value={fmtNum(state.usage.input + state.usage.output)} />
                <Stat label="revisions" value={state.review ? revisions : '—'} />
                <Stat label="avg review" value={avgScore} />
              </div>
            </div>

            {state.status === 'error' && (
              <div className="notice error">
                <b>Run failed:</b> {state.error}
              </div>
            )}

            <div className="dash-grid">
              <section className="panel graph-panel">
                <div className="panel-head">
                  <h2>Agent graph</h2>
                  <span className="muted small">click any agent to inspect it</span>
                </div>
                <Graph state={state} now={now} selected={selected} onSelect={setSelected} />
                <div className="legend small muted">
                  <span><i className="lg flow" /> data flowing</span>
                  <span><i className="lg done" /> delivered</span>
                  <span><i className="lg fb" /> reviewer feedback loop</span>
                </div>
              </section>
              <section className="panel feed-panel">
                <AgentFeed state={state} now={now} onInspect={setSelected} />
              </section>
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>Execution timeline</h2>
                <span className="muted small">overlapping bars = agents working at the same time</span>
              </div>
              <Timeline state={state} now={now} />
            </section>

            {(state.report || state.agents.synthesizer.status === 'running') && (
              <Report text={state.report} streaming={state.agents.synthesizer.status === 'running'} task={state.task} />
            )}
          </section>
        )}
      </main>

      <footer className="foot">
        <span>
          Multi-Agent Orchestration · built by{' '}
          <a href="https://github.com/ashfarfaizi" target="_blank" rel="noreferrer">
            Ashfar Faizi
          </a>
        </span>
        <span className="muted">React · Vercel Functions · Gemini / Claude · streaming NDJSON event bus</span>
      </footer>

      {selected && <Inspector id={selected} state={state} onClose={() => setSelected(null)} />}
      {showSettings && (
        <Settings
          settings={{ ...settings, mode }}
          providers={providers}
          onClose={() => setShowSettings(false)}
          onSave={(s) => {
            setSettings(s);
            saveSettings(s);
            setShowSettings(false);
            setNotice(null);
          }}
        />
      )}
    </div>
  );
}
