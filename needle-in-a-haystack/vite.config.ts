import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /three[\\/]build[\\/]three\.core/, priority: 20 },
            { name: 'three-renderer', test: /node_modules[\\/]three/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    watch: {
      // Avoid caching a temporarily empty file while an editor rewrites it.
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    },
  },
});
