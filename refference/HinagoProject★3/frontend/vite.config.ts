import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@common': resolve(__dirname, 'src/common'),
      '@features': resolve(__dirname, 'src/features'),
      '@app': resolve(__dirname, 'src/app')
    }
  },
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // アセットの処理を明示的に指定
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  // エントリーポイントの指定
  root: './'
});