import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Main chunk still holds App + workout UI; lazy routes split Coach / Progress / Create flow
    chunkSizeWarningLimit: 900,
  },
})
