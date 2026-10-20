import { useState } from 'react';

export default function Settings({ settings, health, onSave, onClose }) {
  const [mode, setMode] = useState(settings.mode);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const canLive = health?.serverKey || apiKey.trim().length > 10;
  const models = health?.models || ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'];

  return (
    <div className="drawer-backdrop center" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <header className="drawer-head">
          <div className="drawer-title">Settings</div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="drawer-body">
          <label className="field-label">Mode</label>
          <div className="seg">
            <button type="button" className={mode === 'live' ? 'on' : ''} onClick={() => setMode('live')}>
              Live agents
            </button>
            <button type="button" className={mode === 'demo' ? 'on' : ''} onClick={() => setMode('demo')}>
              Demo replay
            </button>
          </div>
          <p className="hint">
            {mode === 'live'
              ? 'Real Claude agents plan and work on any goal you type.'
              : 'Replays recorded runs through the same engine protocol. No API key needed.'}
          </p>

          {mode === 'live' && (
            <>
              {health?.serverKey ? (
                <p className="hint ok-text">✓ This deployment has a server-side API key configured.</p>
              ) : (
                <>
                  <label className="field-label" htmlFor="key">Anthropic API key</label>
                  <input
                    id="key"
                    className="input mono"
                    type="password"
                    placeholder="sk-ant-…"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="hint">Stored only in this browser and sent only to this app's API, which forwards it to Anthropic for your runs. Never logged.</p>
                </>
              )}
              <label className="field-label" htmlFor="model">Model</label>
              <select id="model" className="input" value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn primary"
            disabled={mode === 'live' && !canLive}
            onClick={() => onSave({ mode, apiKey: apiKey.trim(), model })}
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
