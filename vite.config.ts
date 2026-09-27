import { defineConfig } from 'vitest/config';

import createVuePlugin from '@vitejs/plugin-vue';
import { execSync } from 'child_process';
import { resolve } from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import IconsResolve from 'unplugin-icons/resolver';
import Icons from 'unplugin-icons/vite';
import Components from 'unplugin-vue-components/vite';
import tailwindcss from '@tailwindcss/vite';

import { PrimeVueResolver } from '@primevue/auto-import-resolver';

let commitHash: string = 'unknown';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString();
} catch (error) {
  console.error('Failed to get commit hash. Running in this mode will not be supported.');
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [
    createVuePlugin({
      script: {
        defineModel: true,
      },
    }),
    Components({
      resolvers: [IconsResolve(), PrimeVueResolver()],
      dts: 'src/components.d.ts',
    }),
    Icons({
      compiler: 'vue3',
    }),
    AutoImport({
      imports: ['vue', 'vue-router', '@vueuse/core', 'pinia'],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/composables', 'src/stores', 'src/utils/**'],
      vueTemplate: true,
    }),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['vue'],
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 700, // Default is 500
    sourcemap: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
    host: '127.0.0.1',
    port: 3000,
  },
  test: {
    environment: 'happy-dom',
    env: {
      // Timezone-name rendering (the `z` token) reads the system locale when the code does not
      // pass one explicitly, and Node's default here follows the host `LANG`. That made
      // timeformat.spec.ts assert-dependent: on a `LANG=en_GB` host the same code renders
      // `CEST` instead of the `GMT+2` the suite expects, so the suite passed on one machine
      // and failed on another for no code reason at all. Pinning LANG makes the expectation
      // mean what it says. Do not remove this on the assumption the test is "wrong": with
      // `LANG=en_US` the assertion passes against the unmodified formatter.
      LANG: 'en_US.UTF-8',
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],
  },
});
