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

const REPO_URL = 'https://github.com/ashfarfaizi/ai-multi-agent-orchestration';
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
  { id: 'executing', label: 'Work' },
  { id: 'reviewing', label: 'Review' },
  { id: 'revising', label: 'Revise' },
  { id: 'synthesizing', label: 'Write up' },
  { id: 'done', label: 'Done' },
];

function Progress({ phase, status, hadRevision }) {
  const idx = PHASES.findIndex((p) => p.id === phase);
  return (
    <ol className="progress" aria-label="Run progress">
      {PHASES.map((p, i) => {
        let cls = 'todo';
        if (i < idx || (status === 'done' && i <= idx)) cls = 'done';
        else if (i === idx) cls = status === 'running' ? 'now' : status === 'done' ? 'done' : 'halt';
        if (p.id === 'revising' && i < idx && !hadRevision) cls = 'skip';
        return (
          <li key={p.id} className={cls} aria-current={cls === 'now' ? 'step' : undefined}>
            {p.label}
            {p.id === 'revising' && cls === 'skip' && <span className="skip-note"> (not needed)</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="logo">
      <circle cx="12" cy="4.5" r="2.6" fill="currentColor" />
      <circle cx="5" cy="13" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="13" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="19" cy="13" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="20.5" r="2" fill="currentColor" />
      <path d="M12 7v3.8M10.4 6.4 6.3 11M13.6 6.4l4.1 4.6M5.9 15l4.7 4.2M12 15.2v3.4M18.1 15l-4.7 4.2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
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
      <header className="topbar">
        <a className="brand" href="/">
          <Logo />
          <span className="brand-name">Multi-Agent Orchestration</span>
        </a>
        <nav className="row gap">
          <button type="button" className="mode" onClick={() => setShowSettings(true)} title="Change mode, provider and model">
            <span className={`dot ${mode === 'live' ? 'd-done' : 'd-idle'}`} />
            {mode === 'live' ? model : 'Demo mode'}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setShowSettings(true)}>
            Settings
          </button>
          <a className="btn ghost sm" href={REPO_URL} target="_blank" rel="noreferrer">
            Source
          </a>
        </nav>
      </header>

      <main>
        <section className="intro">
          <h1>Give a goal to a team of AI agents</h1>
          <p className="lede">
            The orchestrator splits your goal into tasks and assigns each one to a specialist. Specialists work at the
            same time and pass their results to whoever needs them. A reviewer sends weak work back, and a synthesizer
            combines everything into one document.
          </p>

          <div className="composer">
            <label htmlFor="goal" className="composer-label">Goal</label>
            <textarea
              id="goal"
              value={task}
              onChange={(e) => {
                setTask(e.target.value);
                setNotice(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !running) start();
              }}
              placeholder="For example: design the backend for a food delivery app"
              rows={3}
              maxLength={4000}
            />
            <div className="composer-row">
              <div className="examples">
                <span className="muted">Examples:</span>
                {SCENARIOS.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`example ${task === s.prompt ? 'on' : ''}`}
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
                <button type="button" className="btn stop" onClick={stop}>
                  Stop
                </button>
              ) : (
                <button type="button" className="btn primary" onClick={start} title="Ctrl + Enter">
                  Run the team
                </button>
              )}
            </div>
            {notice === 'demo-custom' && (
              <div className="notice">
                <p>
                  Demo mode only replays the three examples. To run your own goal, add a free Google Gemini API key in
                  Settings.
                </p>
                <button type="button" className="btn primary sm" onClick={() => setShowSettings(true)}>
                  Open settings
                </button>
              </div>
            )}
            {notice === 'short' && <div className="notice"><p>Describe the goal in a bit more detail.</p></div>}
          </div>
        </section>

        {state.status === 'idle' && (
          <section className="how">
            <h2>What happens when you run it</h2>
            <ol>
              <li><b>Plan.</b> The orchestrator breaks the goal into 3 to 6 tasks and decides which ones depend on others.</li>
              <li><b>Work.</b> Every task that isn't waiting on another starts at once. Finished work is handed to the tasks that need it.</li>
              <li><b>Review.</b> A reviewer scores each result out of 10 and writes notes on anything weak.</li>
              <li><b>Revise.</b> Weak results go back to their agent with the notes, and get rewritten.</li>
              <li><b>Write up.</b> The synthesizer merges all results into one document you can copy or download.</li>
            </ol>
          </section>
        )}

        {state.status !== 'idle' && (
          <section className="dash" ref={dashRef}>
            <div className="dash-top">
              <Progress phase={state.phase} status={state.status} hadRevision={revisions > 0} />
              <dl className="summary">
                <div><dt>Time</dt><dd>{fmtMs(elapsed)}</dd></div>
                <div><dt>Agents</dt><dd>{agentCount}</dd></div>
                <div><dt>Most at once</dt><dd>{peakParallelism(state) || '–'}</dd></div>
                <div><dt>Tokens</dt><dd>{fmtNum(state.usage.input + state.usage.output)}</dd></div>
                <div><dt>Sent back</dt><dd>{state.review ? revisions : '–'}</dd></div>
                <div><dt>Avg score</dt><dd>{avgScore}</dd></div>
              </dl>
            </div>

            {state.status === 'error' && (
              <div className="notice error">
                <p><b>The run stopped.</b> {state.error}</p>
              </div>
            )}

            <div className="dash-grid">
              <section className="panel graph-panel">
                <div className="panel-head">
                  <h2>Team</h2>
                  <span className="muted small">Select an agent to see its instructions and output</span>
                </div>
                <Graph state={state} now={now} selected={selected} onSelect={setSelected} />
                <div className="legend small muted">
                  <span><i className="lg flow" /> passing work</span>
                  <span><i className="lg done" /> finished</span>
                  <span><i className="lg fb" /> sent back by reviewer</span>
                </div>
              </section>
              <section className="panel feed-panel">
                <AgentFeed state={state} now={now} onInspect={setSelected} />
              </section>
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>Timeline</h2>
                <span className="muted small">Bars that overlap ran at the same time</span>
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
          Built by <a href="https://github.com/ashfarfaizi" target="_blank" rel="noreferrer">Ashfar Faizi</a>
        </span>
        <span className="muted">React and Vercel Functions, with Google Gemini or Claude</span>
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
