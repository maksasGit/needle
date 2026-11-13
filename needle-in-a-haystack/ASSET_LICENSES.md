# Asset and dependency provenance

The environment, interface, hands/tools, hay, procedural fallback cart, barn, needle and favicon are generated locally from project code. The imported cart is an original user-authored model, described below. There are no downloaded third-party art assets, music, external fonts, analytics or runtime CDN dependencies. The block-style farm uses no Roblox branding/characters/assets or copied reference artwork.

## Cart model

- Source: `public/models/cart_colored.glb`, supplied by the project owner on 2026-11-13, replacing the initial untextured `cart.glb`.
- Authorship: the user explicitly confirmed “я ее сделал сам” (I made it myself).
- Permission: supplied for integration into this game; original project artwork, no third-party attribution requirement reported.
- Format: self-contained textured GLB, 3,129,416 bytes, 3,027 triangles. Its UVs, normals, embedded PNG and original material are preserved. No remote texture dependencies.
- The user supplied `Meshy_AI_Stylized Wooden Cart Concept.png` as a visual reference. The reference image itself is not embedded in the game. The subsequent colored GLB replaces the provisional procedural wood material; no generated repaint is applied to the user's texture.
- Budget: this user-requested self-contained art asset exceeds the preferred 512 KiB per-file target but stays below the hard 30 MiB ceiling. It loads after the first frame, with a functional procedural fallback. Build validation reports this specific asset as a preferred-target exception; JavaScript and other files retain their size checks.
- No separate redistribution license has been declared; this is not a public-domain or permissively licensed asset pack.

System font fallbacks are used; no font files are distributed. Audio is not implemented.

Runtime dependency: Three.js, MIT license. Its license is copied from the installed package into `dist/THIRD_PARTY_LICENSES.txt` during release preparation. The exact installed version is recorded in `package-lock.json`.

Development-only tools: Vite (MIT), TypeScript (Apache-2.0), @types/three (MIT), Playwright (Apache-2.0). These packages are not copied wholesale into the web build. Their own license files remain in the dependency tree. Build output retains the bundler's legal comments.

Old Vite template assets in `src/assets/` and `public/` are not used by the game. `publicDir: false` excludes the old public template files from the production build. Do not add them to the release ZIP.

Any future external asset must have its source, license, commercial-use terms and required attribution recorded here before being included.
