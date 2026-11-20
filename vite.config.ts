import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative paths so the build works at any address (GitHub Pages subfolder, Vercel, etc.)
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: false },
});
