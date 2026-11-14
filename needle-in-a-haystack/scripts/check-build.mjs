import { readdir, stat, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

const root=path.resolve('dist');
await writeFile(path.join(root,'THIRD_PARTY_LICENSES.txt'),'Three.js\n\n'+await readFile('node_modules/three/LICENSE','utf8'));
async function walk(dir) {
  const files=[];
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if (entry.isDirectory()) files.push(...await walk(file)); else files.push(file);
  }
  return files;
}
const files=await walk(root);
const metrics=[];
let total=0;
for (const file of files) {
  const data=await readFile(file);
  const bytes=data.length; total+=bytes;
  assert.ok(bytes<30*1024*1024,`${file} exceeds hard file limit`);
  metrics.push({file:path.relative(root,file).replaceAll('\\','/'),bytes,gzipBytes:gzipSync(data).length,preferredFileLimit:bytes<512*1024});
  if (/\.(html|js|css)$/.test(file)) {
    const text=data.toString();
    assert.ok(!/youtube\.com\/game_api|ytgame\./.test(text),'No YouTube integration');
    assert.ok(!/https:\/\/(?:fonts\.googleapis|cdn\.|unpkg|www\.googletagmanager)/.test(text),'No external runtime CDN/tracker');
  }
}
assert.ok(files.length<=8000);
assert.ok(total<15*1024*1024,'Preferred initial-download target');
assert.ok(total<250*1024*1024);
// User-provided textured cart and optional background track are recorded
// exceptions to the preferred 512 KiB target, not the 30 MiB hard ceiling.
const preferredFileExceptions=metrics.filter(file=>!file.preferredFileLimit);
assert.ok(preferredFileExceptions.every(file=>/^assets\/(?:cart_colored-[\w-]+\.glb|needlebackground_2-[\w-]+\.mp3)$/.test(file.file)), 'Unexpected preferred-file budget exception');
const html=await readFile(path.join(root,'index.html'),'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (match[1].startsWith('data:')) continue;
  assert.ok(match[1].startsWith('./'),'Build references must be relative');
  await stat(path.resolve(root,match[1]));
}
await mkdir('verification',{recursive:true});
const report={totalBytes:total,fileCount:files.length,files:metrics,preferredFileExceptions,passed:true};
await writeFile('verification/build-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
