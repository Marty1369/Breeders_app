import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Which deployment environment this build targets. On Vercel, VERCEL_ENV is
// 'production' for the production (main) deploy and 'preview' for branch/preview
// deploys; locally it's undefined. src/lib/supabase.ts reads this to route to
// the production vs staging database — see docs/ENVIRONMENTS.md.
const APP_ENV = process.env.VERCEL_ENV || process.env.VITE_APP_ENV || 'development'

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_ENV': JSON.stringify(APP_ENV),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Litter Planner',
        short_name: 'Litter Planner',
        description: 'Kennel litter planning: timeline, dogs, puppies, documents, expenses.',
        theme_color: '#17805a',
        background_color: '#f4f3ee',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
