import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const n2-vocab-app = 'REPO_NAME'
export default defineConfig({
  plugins: [react()],
  base: `/${n2-vocab-app}/`,
})
