import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Use relative paths so assets load correctly on both GitHub Pages subpaths and custom domains
  base: './',
});
