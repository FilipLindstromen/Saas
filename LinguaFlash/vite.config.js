import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import glosorHandler from './server/glosor.mjs';

export default defineConfig({
  plugins: [react(), {
    name: 'glosor-import',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/api/glosor') return glosorHandler(req, res);
        next();
      });
    },
  }],
  server: {
    host: true,
    port: 5186,
  },
});
