import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // Vite secara default sudah membaca file .env
  // dan mengekspos variable yang diawali VITE_ ke client
  // via import.meta.env.VITE_*

  // Pastikan variable rahasia TANPA prefix VITE_ TIDAK bocor ke client
  // Variabel yang HANYA ada di server (jika pakai SSR):
  //   envPrefix: 'VITE_',  ← ini default Vite, tidak perlu diubah

  // Jika app diletakkan dalam subfolder di server, set base
  // base: '/',

  // Build settings untuk Vercel
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    // Hindari ekspos env ke sourcemap di production
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },

  // Development server
  server: {
    port: 5173,
    open: true,
  },
}))
