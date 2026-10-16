import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const kit = fileURLToPath(new URL('./node_modules/@flysk-tech/amocrm-kommo-vue-ui-kit/dist', import.meta.url))

export default defineConfig({
  base: '/dokupka-calc/',
  plugins: [vue()],
  resolve: {
    // в пакете экспорт ./styles указывает на несуществующий dist/styles/index.css, а шрифты в ptsans.css подключены по абсолютному /fonts — берём файлы напрямую
    alias: {
      'kit-styles': kit + '/styles/style.css',
      '@kit': kit
    }
  },
  test: { environment: 'node' }
})
