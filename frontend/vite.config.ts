import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    // The PDF/Excel export chunks (jsPDF, ExcelJS) are large but loaded only when an
    // export button is clicked, so they do not affect page load.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Separate long-lived vendor code from app code for better caching.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          vendor: ['axios', 'lucide-react'],
        },
      },
    },
  },
});
