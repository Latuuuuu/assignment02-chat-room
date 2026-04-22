import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    publicDir: 'static',
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: 'public',
        emptyOutDir: true,
    },
    test: {
        globals: true,
        environment: 'jsdom',
    },
});
