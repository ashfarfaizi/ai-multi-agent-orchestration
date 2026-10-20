// Provider registry. Each provider implements the same two-method interface,
// so the orchestrator never knows (or cares) which LLM is behind the agents:
//
//   json({ model, system, user, schema, name, description, maxTokens }, { apiKey, signal })
//     → { data, usage }        structured output that matches `schema`
//   stream({ model, system, user, maxTokens, onText }, { apiKey, signal })
//     → { text, usage }        streamed text, onText(delta) called as it arrives

import { geminiProvider } from './gemini.js';
import { anthropicProvider } from './anthropic.js';

export const PROVIDERS = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
};

export const DEFAULT_PROVIDER = 'gemini';

/** The server-side key for a provider, if one is configured. */
export function serverKey(provider) {
  for (const k of provider.envKeys) if (process.env[k]) return process.env[k];
  return '';
}

/** Public, key-free description of what this deployment supports. */
export function describeProviders() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    models: p.models,
    defaultModel: p.defaultModel,
    serverKey: Boolean(serverKey(p)),
  }));
}
