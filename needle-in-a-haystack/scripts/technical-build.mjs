import { readdir, stat, writeFile, readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { Buffer } from 'node:buffer';

/** Real emitted output inventory; invoked by Vite only for a production build. */
export default function technicalBuildInventory() {
  return { name: 'technical-build-inventory', apply: 'build', async writeBundle(options) {
    const root = resolve(options.dir ?? 'dist');
    await writeFile(join(root, 'THIRD_PARTY_LICENSES.txt'), 'Three.js\n\n' + await readFile(new URL('../node_modules/three/LICENSE', import.meta.url), 'utf8'));
    let count = 0, total = 0, largest = 0;
    const byExtension = {};
    const scan = async dir => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) await scan(file);
        else if (entry.name !== 'technical-build.json') {
          const info = await stat(file), ext = extname(entry.name) || 'none';
          byExtension[ext] ??= { count: 0, bytes: 0 };
          byExtension[ext].count++; byExtension[ext].bytes += info.size;
          count++; total += info.size; largest = Math.max(largest, info.size);
        }
      }
    };
    await scan(root);
    let bytes = 0, body = '';
    for (let i = 0; i < 8; i++) {
      body = JSON.stringify({ source: 'production output, uncompressed, totals include inventory; byExtension excludes inventory', byExtension, fileCount: count + 1, totalBytes: total + bytes, largestFileBytes: Math.max(largest, bytes) });
      const next = Buffer.byteLength(body);
      if (next === bytes) break;
      bytes = next;
    }
    await writeFile(join(root, 'technical-build.json'), body, 'utf8');
  } };
}
