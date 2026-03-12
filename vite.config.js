import { defineConfig } from 'vite';

export default defineConfig({
  base: '/brawler-iso/',
  root: '.',
  publicDir: 'public',
  server: {
    open: true,
  },
});
