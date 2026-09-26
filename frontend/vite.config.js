import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { devosSongsPlugin } from './vite-devos-plugin.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_BASE_URL || 'http://localhost:5000';

  return {
    base: '/',
    plugins: [react(), devosSongsPlugin()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/devotional-songs': {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('jspdf') || id.includes('html-to-image')) {
                return 'vendor-pdf';
              }
              if (id.includes('recharts')) {
                return 'vendor-charts';
              }
              if (id.includes('framer-motion') || id.includes('swiper') || id.includes('yet-another-react-lightbox') || id.includes('canvas-confetti')) {
                return 'vendor-ui';
              }
              if (id.includes('i18next')) {
                return 'vendor-i18n';
              }
              if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('react')) {
                return 'vendor-react';
              }
              return 'vendor-misc';
            }
          }
        }
      }
    }
  };
})
