import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'KakuRen',
      fileName: 'kaku-ren',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['kaku'],
    },
  },
});
