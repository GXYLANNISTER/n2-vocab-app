import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const n2-vocab-app = 'n2-vocab-app'
export default defineConfig({
  plugins: [react()],
  base: `/${n2-vocab-app}/`,
})
