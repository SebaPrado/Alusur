import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Prefijos exactos: Vite solo inyecta en el cliente lo que empieza por
  // uno de estos. `SUPABASE_` a secas también metería claves secretas.
  envPrefix: ["VITE_", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"],
})
