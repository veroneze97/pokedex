import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pokeball.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PokéDex PT-BR',
        short_name: 'PokéDex',
        description: 'Catálogo pessoal de cartas Pokémon TCG PT-BR',
        lang: 'pt-BR',
        theme_color: '#0A0A0C',
        background_color: '#0A0A0C',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
