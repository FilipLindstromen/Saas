import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
var rootEnv = path.resolve(__dirname, '..');
try {
    require('dotenv').config({ path: path.join(rootEnv, '.env') });
    require('dotenv').config({ path: path.join(rootEnv, '.env.local') });
}
catch (_a) { }
export default defineConfig({
    envDir: rootEnv,
    define: {
        'import.meta.env.VITE_YOUTUBE_CLIENT_ID': JSON.stringify(process.env.YOUTUBE_CLIENT_ID || ''),
        'import.meta.env.VITE_INSTAGRAM_APP_ID': JSON.stringify(process.env.INSTAGRAM_APP_ID || ''),
        'import.meta.env.VITE_TIKTOK_CLIENT_KEY': JSON.stringify(process.env.TIKTOK_CLIENT_KEY || ''),
    },
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
});
