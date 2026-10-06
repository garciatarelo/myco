import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  // En desarrollo local (command === 'serve') usamos '/' para que localhost:5173/mision funcione sin forzar /marsmatrix/.
  // En producción (command === 'build') usamos '/marsmatrix/' para el hosting en Alwaysdata o según variable de entorno.
  base: command === 'serve' ? '/' : (process.env.VITE_BASE_PATH || '/marsmatrix/'),
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    assetsDir: 'assets',
  }
}))