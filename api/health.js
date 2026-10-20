import { MODELS, DEFAULT_MODEL } from '../lib/orchestrator.js';

export default function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(
    JSON.stringify({
      ok: true,
      serverKey: Boolean(process.env.ANTHROPIC_API_KEY),
      models: MODELS,
      defaultModel: DEFAULT_MODEL,
    }),
  );
}
