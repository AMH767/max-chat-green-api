
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  base: command === 'build' && process.env.GITHUB_ACTIONS === 'true'
    ? '/max-chat-green-api/'
    : '/',
  plugins: [react()],
  server: {
    allowedHosts: ['.us1.manus.computer'],
  },
}));
