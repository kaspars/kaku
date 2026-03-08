import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Kaku3D',
      fileName: 'kaku-3d',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['three', /^three\//, /^@kaspars\/kaku/],
    },
  },
});
