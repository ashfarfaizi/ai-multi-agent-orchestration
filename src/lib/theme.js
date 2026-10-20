export const AGENT_COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

export const SYSTEM_AGENTS = {
  orchestrator: { name: 'Orchestrator', icon: '🧠', role: 'Plans the task graph and designs the team', color: '#a78bfa' },
  reviewer: { name: 'Quality Reviewer', icon: '🧐', role: 'Scores every deliverable and sends weak work back', color: '#f59e0b' },
  synthesizer: { name: 'Synthesizer', icon: '✨', role: 'Merges everything into one final answer', color: '#22d3ee' },
};

export const colorFor = (i) => AGENT_COLORS[i % AGENT_COLORS.length];

export const fmtMs = (ms) => {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

export const fmtNum = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
