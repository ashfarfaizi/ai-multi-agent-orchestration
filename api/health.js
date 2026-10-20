import { describeProviders, DEFAULT_PROVIDER, PROVIDERS } from '../lib/providers/index.js';

export default function handler(req, res) {
  const providers = describeProviders();
  const preferred = PROVIDERS[process.env.LLM_PROVIDER] ? process.env.LLM_PROVIDER : DEFAULT_PROVIDER;
  // If the preferred provider has no server key but another does, prefer that one.
  const withKey = providers.find((p) => p.id === preferred && p.serverKey) || providers.find((p) => p.serverKey);
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(
    JSON.stringify({
      ok: true,
      serverKey: Boolean(withKey),
      defaultProvider: withKey?.id || preferred,
      providers,
    }),
  );
}
