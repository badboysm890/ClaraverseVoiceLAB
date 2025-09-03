import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  server: {
    port: 3000, // Will be overridden by Docker
    host: true, // Listen on all interfaces for Docker
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // Will be configured in Docker
        changeOrigin: true,
      }
    }
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-accordion', '@radix-ui/react-dialog', '@radix-ui/react-label', '@radix-ui/react-slider', '@radix-ui/react-slot', '@radix-ui/react-tabs']
        }
      }
    }
  }
}));
