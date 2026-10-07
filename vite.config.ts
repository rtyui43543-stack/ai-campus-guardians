import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The same build works at a domain root or GitHub Pages /repository/ path.
  base: './',
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1100 },
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
});
