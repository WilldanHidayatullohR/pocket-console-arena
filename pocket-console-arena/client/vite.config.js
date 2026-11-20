import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // Wajib agar HP di Wi-Fi yang sama bisa buka IP laptop
    port: 5173,
  },
})