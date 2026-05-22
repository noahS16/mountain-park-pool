import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        join: resolve(__dirname, 'join/index.html'),
        events: resolve(__dirname, 'events/index.html'),
        calendar: resolve(__dirname, 'calendar/index.html'),
        rules: resolve(__dirname, 'rules/index.html'),
        login: resolve(__dirname, 'login/index.html'),
        account: resolve(__dirname, 'account/index.html'),
        checkin: resolve(__dirname, 'checkin/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        confirm: resolve(__dirname, 'confirm/index.html'),
      }
    }
  }
})