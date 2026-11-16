# ART_DIRECTION.md — Needle in a Haystack

## Status and authority
This is the **visual source of truth** for the Needle in a Haystack project. Read it before any work involving 3D models, colors, materials, textures, lighting, animation, particles, HUD, tutorial cues, screenshots, or promotional artwork. It describes the user's three supplied visual references, not permission to copy assets or characters from them.

## Art identity: Vibrant Toybox 3D
Create an immediately readable, cheerful, saturated 3D casual-game world with a Roblox-adjacent *visual vocabulary*: chunky simplified geometry, polished toy-like surfaces, bright primary and secondary colors, clear shapes, bold UI, strong object separation, and an instantly understandable objective. This is **not** claymation, paper craft, muted indie low-poly, gritty realism, or photorealism. Keep the game visually original.

### What the three reference images communicate
1. **Keyboard obby promotional image:** High-saturation pink/purple world, oversized chunky geometry, hard visual contrast, glossy highlights, energetic presentation and large outlined lettering. The typography is **thumbnail/marketing treatment**, not an instruction to fill the gameplay HUD with giant words. Do not reproduce its avatar, layout, text, or copyrighted elements.
2. **Colorful obstacle-course gameplay:** A clean, open, toy-like 3D play space; cyan sky, flat bright platforms, vivid red/blue accents, simple readable geometry and large separation between interactive elements. Aim for similar instant visual comprehension, not a copy of the level or UI.
3. **Haystack and needle image:** A single giant rounded golden hay mound on bright green ground against a clean blue sky; a readable metallic needle at its apex. This establishes the game's focal object and its recognizable silhouette. The visible hay-strand texture matters, but must be achieved economically. The oversized needle is appropriate for cover art, tutorials, and discovery moments; in normal gameplay, the hidden needle must remain a meaningful discovery.

## Scene art direction
- **Environment:** Bright sunny backyard / miniature farm playset, simple grass field, short fence, clear sky, sparse props. Do not bury the focal point in decorations.
- **Haystack:** Dominant rounded mound, warm golden-yellow/orange, with an irregular silhouette and layered clumps. At gameplay scale, use low-poly clump geometry plus selective repeating strand detail, baked texture or sparse instanced accents. Never model every strand as a separate mesh.
- **Player:** Original simplified toy-like character, readable silhouette and oversized hands/tools for clear animations. Avoid directly imitating recognizable Roblox avatar models or third-party characters.
- **Cart:** Oversized, easily identified drop-off point, visually distinct from hay. A few large wheels, strong color blocking, readable fill state.
- **Tools:** Each upgrade changes the visible tool silhouette (hands, rake/pitchfork, wheelbarrow, etc.). No tiny detailed assets that disappear on phones.
- **Coins/rewards:** Large, legible golden coins and restrained pop effects; the player should instantly understand earnings.
- **Needle:** Metallic silver, distinct against warm hay, subtle specular glint; hide until discovered or deliberately hinted.

## Color system (starting palette, adjust after in-engine tests)
- Sky: `#36C9FF` / deeper blue `#138EF2`
- Grass: `#67D83D` / shaded `#38A92E`
- Hay highlights: `#FFD83D`; base: `#F6AD22`; shadow: `#C77A19`
- Wood/cart: `#B86B38` / dark `#6D3C24`
- Coin/reward: `#FFE14A`
- Primary action/UI: `#23B8FF`
- Upgrade/positive: `#54D845`
- Secondary accent: `#FF69BE` or `#9655F5` sparingly
- Text: `#FFFFFF` with dark `#20212A` outline/shadow for contrast

Do not use every accent everywhere. Maintain a consistent hierarchy: hay = warm focal mass, grass/sky = clean background, interactive UI = clearly contrasted.

## Shape and material rules
- Favor chunky rounded forms, slightly exaggerated proportions and clean silhouettes.
- Use simple standard/lambert materials and a small shared material palette.
- Gentle specular shine on coins, tools, plastic-like objects; rougher matte hay and grass.
- Avoid realistic PBR texture sets, heavy normal maps, subsurface scattering, screen-space reflections, dense geometry, and expensive postprocessing.
- Use a bright directional sun + hemisphere/ambient fill; optional low-cost shadows only if performance permits.
- Make primary interactions readable from mobile viewing distances and on both portrait/landscape layouts.

## Gameplay UI vs promotional artwork
**In-game UI:** Large tap targets, minimal text, big icons, clear currency counters, single-action tutorial highlights, high contrast and uncluttered placement. Use short positive feedback, not huge permanent labels. Avoid excessive flashing, misleading prompts, or pressure tactics.

**Thumbnail/cover:** May use oversized outlined text, a huge golden haystack, a prominent needle, a lively character pose, saturated sky/grass and a bold readable focal composition. Cover art is separate from gameplay rendering. Do not copy the typography/composition of the reference image.

## Animation and onboarding
- First interaction within seconds: an animated pointer highlights the haystack and guides manual movement into range. A tap collects; only the vacuum repeats while held. Ground taps never move the player.
- Then highlight cart, reward, and first upgrade **one step at a time**; advance on completed actions, not a fixed timer.
- Hay visibly shrinks or changes silhouette; cart fills; coins bounce briefly; purchased tools visibly change.
- Use limited pooled particles and short effects. Avoid overstimulation or persistent visual clutter.
- No tutorial dependency on reading ability; provide replayable guidance and accessibility-minded contrast.

## Performance and asset budget
- Current target: **itch.io HTML5**; no YouTube SDK integration.
- Prioritize first meaningful interaction, targeting under 3 seconds on representative mobile hardware/network where feasible; measure cold-cache production builds.
- Adopt internal future-compatibility goals: initial transfer preferably <15 MiB (hard internal ceiling 30 MiB), JS heap peak <512 MB, whole build far below 250 MiB.
- First-load only character, haystack, cart, minimal environment, camera/input and essential UI. Lazy-load future levels, optional audio, cosmetics, advanced tools and decorations.
- Prefer procedural primitives, shared meshes/materials, texture atlases, instancing and pooled particles; avoid large per-object textures.
- For hay detail, use small repeated/atlas textures or a few instanced tuft meshes, not millions of strands or individual mesh objects.
- Optimize mobile draw calls, overdraw, texture memory, shadows and shader complexity.
- Keep art assets original or licensed for commercial use; document third-party assets in `ASSET_LICENSES.md`.

## Acceptance criteria for visual work
- A player can identify haystack, cart, character, collectible and primary action at a glance.
- Scene looks vivid and playful **without** resembling generic muted low-poly farm packs.
- Main haystack reads as textured golden hay, not a smooth yellow sphere.
- UI remains readable at small portrait mobile sizes.
- Changes to models, colors and effects respect the same visual language.
- Art enhancements do not delay the first interaction or materially degrade mobile performance.

## Art task workflow for agents
1. Read this file before editing visuals.
2. Describe how proposed assets fit the references and this document.
3. Favor a small original prototype over downloading a mismatched asset pack.
4. Implement the smallest representative change and check desktop/mobile framing.
5. Run the production build and report performance or asset-size changes when measurable.
6. Ask for approval before changing the core art style or introducing expensive graphics techniques.

## Visual feedback specification — adopted 2026-11-16

Use [GAME_REQUIREMENTS.md section 21](GAME_REQUIREMENTS.md#21-визуальная-обратная-связь-интерфейс-и-насыщенность-мира--референсы-2026-11-16) for the accepted visual backlog and review decisions. The two proposal files are source snapshots, not alternative art directions. These are planned improvements, not completed visuals.

- Reuse a shared set of configurable durations, easing, icon scales, radii, borders, typography and semantic color roles across HUD, book, item cards and barn price signs. Develop original SVG/CSS components first; no new UI framework or raster asset per state.
- A successful action has one readable focal response: a small icon accent, actual +N reward and optional bounded particles. Counter animation illustrates an already completed transaction; rapid updates retarget rather than queue. Keep costs and actionable states synchronized to real values.
- Give tools distinct motion: pinch, rake stroke, fork grab, wider grab and directed vacuum flow. Preserve the selected straw, actual carried count, hidden hands after tool purchase and bounded local hay physics. Avoid sustained camera shake or flashing.
- An item card is temporary and closeable. Keep the established HUD placement, no persistent bottom action description and no current-tool HUD card. Use text/symbols as well as color for locked, unaffordable, owned, equipped and max states; all actions support touch without hover.
- Reduced motion uses static or brief opacity confirmations without flight, shake or large scale changes. Feedback remains understandable with audio disabled and never covers joystick, jump, action controls or important counters.
- Dress the sunny 26×26 farm in small logical groups, preserving hay upper left, barn upper right and cart lower left, including their approved rotations. Start with shared prop families and cheap distant silhouettes; protect paths, picking, signs and mobile frame time. A decorative lantern does not imply extra dynamic lighting.
- Do not restore individual cart straws or delayed payout for spectacle. Keep the static cargo mound; prefer a few pooled 2D coins over a separate 3D coin family when sufficient. Optional decoration loads after interaction; animated scenery waits for authorized performance measurement.

Visual implementation order: HUD feedback → barn card → collection/sale presentation → cohesive mobile UI → onboarding/loading → restrained scenery. Mechanics still missing (needle collection and events) are tracked separately. Review each iteration manually with the user; the current no-automatic-tests/build/screenshots instruction supersedes generic validation commands above until requested.

### Runtime prototype mapping (2026-11-16)

Current code for the adopted feedback direction is mapped in GAME_REQUIREMENTS.md section 22: presentation.ts, HudFeedback.ts, BarnCard.ts, Onboarding.ts, icons.ts, FarmDecor.ts and SaleEvent.ts. These are unverified prototypes, not accepted final art. The original sunny palette/layout remains; a five-needle album was declined by the owner. New scenery stays static until authorized performance measurement, and no new raster/PBR/audio assets are implied by this implementation.

## Updated menu and feedback brief — 2026-11-16

The owner rejects verbose, generic menu descriptions. For the next implementation use short labels, icon/value/price, one primary action and at most one essential benefit line. Keep help/tutorial content separate. A new layout awaits the owner's drawing; this documentation task does not invent it. Maintain RU/EN, readable disabled reasons, focus and touch targets.

The owner now requests attention and a visible timer for ×2 money, plus a small progress timer over optional chests. These supersede the former no-countdown presentation for those features, while keeping a friendly style without flashing/pressure. Chest/well/helper-skin/record visuals are pending product decisions in docs/DEVELOPER_NOTES.md, not produced assets. The named helper-skin reference needs a supplied/authorized original visual and recorded source before integration; it is not permission to import another creator's model or sound.
