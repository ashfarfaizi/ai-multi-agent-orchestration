import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In `npm run dev`, mount the same serverless handlers that Vercel runs in
// production, so the whole system works locally without the Vercel CLI.
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const route = req.url?.split('?')[0];
        const routes = {
          '/api/orchestrate': '/api/orchestrate.js',
          '/api/health': '/api/health.js',
        };
        if (!routes[route]) return next();
        try {
          const mod = await server.ssrLoadModule(routes[route]);
          await mod.default(req, res);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
});
