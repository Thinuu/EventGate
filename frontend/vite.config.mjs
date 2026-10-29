import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_');
  return {
    plugins: [react()],
    envPrefix: 'REACT_APP_',
    build: { outDir: 'dist', sourcemap: false },
    server: { port: 3000, proxy: { '/api': { target: env.REACT_APP_DEV_API || 'http://127.0.0.1:5000', changeOrigin: true }, '/socket.io': { target: env.REACT_APP_DEV_API || 'http://127.0.0.1:5000', ws: true } } },
  };
});
