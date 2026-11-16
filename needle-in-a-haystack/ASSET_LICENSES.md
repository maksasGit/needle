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

System font fallbacks are used; no font files are distributed. Background music is supplied by the user; action sound effects are not implemented.

## Background music

- Source: `public/audio/needlebackground_2.mp3`, 1,759,581 bytes, supplied on 2026-11-15.
- Authorship: the project owner stated that they made the ambient/background music and explicitly requested its inclusion in the game.
- Permission: user-provided original project audio, integrated without editing. No separate public redistribution license or attribution requirement was supplied; do not describe it as a public-domain asset.
- Playback: a single local HTMLAudioElement, requested after user interaction, looping with saved music preferences. No external service, audio CDN, conversion or additional recording was used.

The reachable barn, hanging tools (including the vacuum), backpack, price-sign atlas, book avatar and pig helpers are original procedural project assets in `ToolAssets.ts`, `Barn.ts`, `PigHerd.ts` and `Shop.ts`. They use local primitive geometry, Canvas text and inline SVG, with no new third-party models, images, fonts or sounds. Displayed/held tools and pig instances share resources; the user-supplied textured cart remains the only imported art model.

Runtime dependency: Three.js, MIT license. Its license is copied from the installed package into `dist/THIRD_PARTY_LICENSES.txt` during release preparation. The exact installed version is recorded in `package-lock.json`.

Development-only tools: Vite (MIT), TypeScript (Apache-2.0), @types/three (MIT), Playwright (Apache-2.0). These packages are not copied wholesale into the web build. Their own license files remain in the dependency tree. Build output retains the bundler's legal comments.

Old Vite template assets in `src/assets/` and `public/` are not used by the game. `publicDir: false` excludes the old public template files from the production build. Do not add them to the release ZIP.

Any future external asset must have its source, license, commercial-use terms and required attribution recorded here before being included.

### Action sound effects — 2026-11-15

Source: four local MP3 files supplied by the project owner for integration, named for their intended actions. No external download, conversion or additional recording was used. No separate public redistribution license was supplied; do not describe these files as public domain.

- public/audio/collect_hay.mp3 — 25,389 bytes, successful collection.
- public/audio/inventory_is_full.mp3 — 25,389 bytes, shared unavailable-action feedback, as explicitly requested by the owner.
- public/audio/sell_sound.mp3 — 25,389 bytes, successful player sale.
- public/audio/steps_loop.mp3 — 55,341 bytes, grounded movement loop.

The earlier description of music as the only integrated audio is superseded by this entry. Manual playback acceptance is pending.

### Original presentation assets — 2026-11-16

src/ui/icons.ts contains original code-authored inline SVG paths shared by HUD, book, item cards and guidance. HudFeedback, BarnCard and Onboarding use DOM/CSS/WAAPI without downloaded artwork or fonts. FarmDecor.ts creates original shared primitive crates, barrels, rocks, bushes, trees, distant hills, flowers and paths; BoxHelper selection and FirstPersonView reuse existing Three.js/project resources. No external texture, model, icon pack, sound recording, new dependency or generated raster image was imported. The user-authored cart and four action MP3s remain unchanged. Manual visual/audio/device acceptance is pending.

### Layered mountain skyline (2026-11-16)

The existing rounded primitive is reused for 24 overlapping foothills and 18 distant mountains with deterministic height/scale variation and a second green material. This replaces four isolated hills; no external model, texture or image was imported. Models remain outside gameplay and do not affect picking/collision. Visual/device acceptance remains pending.

### Economy candidates and metrics (2026-11-16)

No new audio/visual asset, external analytics SDK or third-party dependency was added. Candidate prices, deterministic synthetic simulation results and code-authored local measurement controls use the existing project stack. Metrics are disabled by default and stay local unless the player deliberately downloads JSON. Reports committed to the repository contain synthetic model output, not collected player data.

### TEAM-02 reward chest (2026-11-16)

Original project procedural geometry/materials in src/world/RewardChest.ts. No external model, texture, image or sound added; pickup reuses the existing sell effect.

### TEAM-03 notice board (2026-11-16)

Original project procedural farm board in src/world/NoticeBoard.ts; no Witcher assets, textures, designs, sounds or branding copied. Fictional demo leaderboard names are local fixture data, not actual users.

### TEAM-04 well and diamonds (2026-11-16)

Original project procedural geometry/materials in Well.ts and Diamonds.ts. No external textures, models, characters, sounds or fonts added; existing licensed/original sell/deny audio reused.
