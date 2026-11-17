import technicalBuildInventory from './scripts/technical-build.mjs';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins:[technicalBuildInventory()],
  base: './',
  publicDir: false,
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'model-loader', test: /three[\\/]examples[\\/]jsm[\\/]/, priority: 5 },
            { name: 'three-core', test: /three[\\/]build[\\/]three\.core/, priority: 20 },
            { name: 'three-renderer', test: /three[\\/]build[\\/]three\.module/, priority: 10 },
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
