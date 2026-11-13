# Asset and dependency provenance

All visible game geometry, materials, interface, hand/tool models, hay, cart, barn, needle and favicon are generated locally from project code. There are no downloaded art assets, music, external fonts, analytics or runtime CDN dependencies. The block-style farm is an original procedural implementation, without Roblox branding/characters/assets or copied reference artwork.

System font fallbacks are used; no font files are distributed. Audio is not implemented.

Runtime dependency: Three.js, MIT license. Its license is copied from the installed package into `dist/THIRD_PARTY_LICENSES.txt` during release preparation. The exact installed version is recorded in `package-lock.json`.

Development-only tools: Vite (MIT), TypeScript (Apache-2.0), @types/three (MIT), Playwright (Apache-2.0). These packages are not copied wholesale into the web build. Their own license files remain in the dependency tree. Build output retains the bundler's legal comments.

Old Vite template assets in `src/assets/` and `public/` are not used by the game. `publicDir: false` excludes the old public template files from the production build. Do not add them to the release ZIP.

Any future external asset must have its source, license, commercial-use terms and required attribution recorded here before being included.
