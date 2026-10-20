import { useState } from 'react';

export const FALLBACK_PROVIDERS = [
  {
    id: 'gemini',
    label: 'Google Gemini (free tier)',
    models: ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'],
    defaultModel: 'gemini-3.5-flash-lite',
    serverKey: false,
  },
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    models: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
    defaultModel: 'claude-sonnet-5-5',
    serverKey: false,
  },
];

const KEY_INFO = {
  gemini: {
    label: 'Google Gemini API key',
    placeholder: 'AIza…',
    link: 'https://aistudio.google.com/apikey',
    linkText: 'Get a free key in Google AI Studio →',
    note: 'Free tier: no billing needed. Google may use free-tier prompts to improve its products, so avoid sensitive data.',
  },
  anthropic: {
    label: 'Anthropic API key',
    placeholder: 'sk-ant-…',
    link: 'https://console.anthropic.com/settings/keys',
    linkText: 'Create a key in the Anthropic Console →',
    note: 'Paid per use. A typical run costs a few cents.',
  },
};

export default function Settings({ settings, providers, onSave, onClose }) {
  const list = providers?.length ? providers : FALLBACK_PROVIDERS;
  const [mode, setMode] = useState(settings.mode);
  const [provider, setProvider] = useState(settings.provider);
  const [keys, setKeys] = useState({ ...settings.keys });
  const [models, setModels] = useState({ ...settings.models });

  const p = list.find((x) => x.id === provider) || list[0];
  const info = KEY_INFO[p.id];
  const key = keys[p.id] || '';
  const canLive = p.serverKey || key.trim().length > 10;
  const model = p.models.includes(models[p.id]) ? models[p.id] : p.defaultModel;

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
              ? 'Real AI agents plan and work on any goal you type.'
              : 'Replays recorded runs through the same engine protocol. No API key needed.'}
          </p>

          {mode === 'live' && (
            <>
              <label className="field-label">AI provider</label>
              <div className="seg">
                {list.map((x) => (
                  <button type="button" key={x.id} className={provider === x.id ? 'on' : ''} onClick={() => setProvider(x.id)}>
                    {x.id === 'gemini' ? 'Gemini (free)' : 'Claude'}
                  </button>
                ))}
              </div>

              {p.serverKey ? (
                <p className="hint ok-text">✓ This deployment already has a server-side {p.label} key. Nothing to paste.</p>
              ) : (
                <>
                  <label className="field-label" htmlFor="key">{info.label}</label>
                  <input
                    id="key"
                    className="input mono"
                    type="password"
                    placeholder={info.placeholder}
                    value={key}
                    onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="hint">
                    <a href={info.link} target="_blank" rel="noreferrer" className="key-link">{info.linkText}</a>
                  </p>
                  <p className="hint">{info.note} Your key is stored only in this browser and sent only to this app's API, which forwards it to the provider for your runs.</p>
                </>
              )}

              <label className="field-label" htmlFor="model">Model</label>
              <select id="model" className="input" value={model} onChange={(e) => setModels({ ...models, [p.id]: e.target.value })}>
                {p.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                    {m === p.defaultModel ? ' (recommended)' : ''}
                  </option>
                ))}
              </select>
              {p.id === 'gemini' && (
                <p className="hint">Flash-Lite has the most free daily requests. 3.8 Flash writes better but its free quota is small (a run uses about 9–11 requests).</p>
              )}
            </>
          )}
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn primary"
            disabled={mode === 'live' && !canLive}
            onClick={() =>
              onSave({
                mode,
                provider: p.id,
                keys: Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, (v || '').trim()])),
                models: { ...models, [p.id]: model },
              })
            }
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
