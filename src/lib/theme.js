// Muted, print-like agent colours. Used only for small markers (badges, bars).
export const AGENT_COLORS = ['#2F6FDB', '#7357C9', '#0F8B7D', '#B7791F', '#C2417B', '#4D7C0F'];

export const SYSTEM_AGENTS = {
  orchestrator: { name: 'Orchestrator', role: 'Splits the goal into tasks and assigns them', color: '#475467' },
  reviewer: { name: 'Reviewer', role: 'Scores each result and sends weak ones back', color: '#B26B00' },
  synthesizer: { name: 'Synthesizer', role: 'Combines everything into one document', color: '#1F7A4D' },
};

export const colorFor = (i) => AGENT_COLORS[i % AGENT_COLORS.length];

/** "Market Researcher" → "MR", "Orchestrator" → "Or" */
export function initials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2);
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const fmtMs = (ms) => {
  if (ms == null || !Number.isFinite(ms)) return '–';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

export const fmtNum = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
