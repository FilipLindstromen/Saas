import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var API_PORT = process.env.BROLL_API_PORT || 3230;
// Root .env keys (OpenAI/Pexels/Pixabay/Unsplash) reach the client via the /api/keys route in
// server/index.mjs rather than Vite's import.meta.env define mechanism: this repo's root .env
// doesn't use the VITE_ prefix Vite requires to auto-expose a var, and defining
// 'import.meta.env.VITE_X' only statically replaces literal `import.meta.env.VITE_X`
// call-sites — shared/apiKeys.js reads it via a destructured `const e = import.meta.env; e.X`,
// which Vite does not retroactively populate, so that define never actually took effect here.
export default defineConfig({
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../shared'),
            'react': path.resolve(__dirname, 'node_modules/react'),
            'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
            'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
            'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
        },
    },
    plugins: [react()],
    server: {
        port: 5190,
        strictPort: false,
        proxy: {
            '/api': "http://localhost:".concat(API_PORT),
            '/uploads': "http://localhost:".concat(API_PORT),
            '/renders': "http://localhost:".concat(API_PORT),
        },
    },
});
