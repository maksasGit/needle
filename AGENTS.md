# AGENTS.md — Browser Game Development Standards

## 1. Project context

We are developing small, polished HTML5 browser games for publication on **itch.io**.

The long-term goal is to build games that can eventually be adapted for **YouTube Playables** with minimal architectural changes.

The current development phase is **itch.io only**.

**IMPORTANT: Do not implement YouTube-specific integrations unless explicitly requested.**

This document defines the technical, performance, compatibility, quality, and content standards that all coding agents should follow.

## 2. Current platform and technology

**Current target:** itch.io (HTML5 browser games).

**Potential future target:** YouTube Playables.

Preferred technologies depend on the project:

- **2D:** Phaser 3, JavaScript or TypeScript.
- **3D:** Three.js, TypeScript.
- **Build tooling:** Vite.
- **UI:** HTML/CSS or an appropriate game-engine UI system.
- **Rendering:** Canvas 2D or WebGL.

Do not introduce unnecessary frameworks, dependencies, backends, or complex infrastructure.

Prioritize simple, maintainable, modular architecture.

## 3. YouTube integration — explicitly out of scope

Until requested, agents MUST NOT:

- Integrate the YouTube Playables SDK.
- Import `https://www.youtube.com/game_api/v1`.
- Implement `ytgame.game.firstFrameReady()` or `gameReady()`.
- Implement YouTube cloud saves.
- Implement YouTube-specific pause/audio APIs.
- Implement YouTube advertising APIs.
- Add YouTube Developer Portal configuration.
- Prepare or submit YouTube certification packages.

Use ordinary browser functionality during itch.io development:

- `localStorage` for persistent progress where appropriate.
- Browser visibility events for pausing, where appropriate.
- Standard browser audio controls.
- Normal browser input APIs.

However, design these systems behind clear interfaces so they can later be replaced with YouTube-specific implementations.

For example:

- `SaveManager`
- `AudioManager`
- `LifecycleManager`
- `InputManager`

Do not build unnecessary abstraction layers solely for future integrations.

## 4. Performance requirements

Apply the following targets to all projects.

| Metric | Target |
|---|---|
| Initial download | Under 15 MiB preferred; never exceed 30 MiB |
| Total game bundle | Under 250 MiB; preferably much smaller |
| Individual file | Under 512 KiB preferred; never exceed 30 MiB |
| JavaScript heap | Stay below 512 MB peak |
| Time to interactivity | Aim for under 5 seconds |
| Saved game data | Under 500 KiB preferred; never exceed 3 MiB |
| Bundle file count | No more than 8,000 |

These limits are adopted from the YouTube Playables technical requirements as **internal project targets**. They are not itch.io publishing limits.

For small casual games, aim substantially below these limits wherever practical.

### Performance rules

- Avoid unnecessary allocations inside the game loop.
- Reuse temporary objects where appropriate.
- Use object pooling for frequently spawned objects.
- Dispose of unused geometries, materials, textures, render targets, and audio resources.
- Remove obsolete event listeners and timers.
- Avoid expensive per-frame DOM operations.
- Minimize draw calls, excessive transparency, and unnecessary lighting calculations.
- Use compressed and appropriately sized assets.
- Lazy-load nonessential assets when beneficial.
- Avoid large, blocking initialization tasks.
- Do not introduce memory leaks during restarts or scene transitions.

For Three.js, pay special attention to:

- `geometry.dispose()`
- `material.dispose()`
- `texture.dispose()`
- GPU resource lifecycle
- Instanced meshes for repeated objects
- Reusing geometries and materials
- Avoiding unnecessary shadow-casting objects

For Phaser, pay special attention to:

- Scene lifecycle cleanup
- Destroying obsolete game objects
- Texture management
- Timers and event listeners
- Particle and physics object pooling

## 5. Mobile-first design

Every game MUST be fully playable on both desktop and mobile.

### Input

- Support mouse and touch input.
- Prefer unified pointer input where possible.
- Use appropriately sized interactive targets.
- Avoid relying on hover.
- Avoid keyboard-only mechanics.
- Prevent accidental browser scrolling during gameplay.
- Ensure input remains accurate after resizing.
- Do not require precise taps on tiny objects.

Keyboard input may be added as an optional desktop enhancement.

### Responsive layout

Support portrait, landscape, and unusual aspect ratios, including:

- 9:16
- 3:4
- 1:1
- 4:3
- 16:9
- 21:9

Requirements:

- Do not lock device orientation.
- Adapt the camera and interface to the available viewport.
- Preserve game progress during resizing.
- Keep important gameplay objects visible.
- Respect safe areas and screen cutouts.
- Keep text and controls readable.
- Avoid stretching the game scene incorrectly.

When appropriate, use a responsive camera with a stable gameplay area and adaptive framing.

## 6. Stability and crash prevention

Stability is a high priority.

Internal crash-rate targets for future production releases:

- Below 1%: maximum acceptable target.
- Below 0.5%: preferred.
- Below 0.1%: ideal.

These are operational targets taken from the supplied Crash Rate handbook, not measurements available automatically during local development.

### Required practices

- Handle asset-loading failures.
- Avoid unhandled promise rejections.
- Avoid unhandled exceptions in the game loop.
- Validate object references before use.
- Prevent infinite loops.
- Avoid uncontrolled object spawning.
- Clean up resources when restarting.
- Handle WebGL context loss and restoration where supported.
- Ensure the game can recover from interrupted loading when practical.
- Avoid blank screens and permanent loading states.

### Testing

Before declaring a milestone complete:

1. Run the game on desktop.
2. Test on a real mobile device.
3. Test portrait and landscape orientations.
4. Resize the browser repeatedly.
5. Restart the game at least 10 times.
6. Check the browser console.
7. Verify that memory usage does not grow indefinitely.
8. Test pausing and resuming.
9. Test saved-game loading.
10. Verify that the production build works.

Do not treat a successful Vite development-server run as proof that the production build is valid.

## 7. Game loop and rendering

- Use frame-rate-independent movement and animations.
- Base movement on delta time.
- Avoid coupling game logic to rendering FPS.
- Avoid unnecessary work when the game is paused.
- Prevent large delta-time spikes after resuming.
- Use a clear game state model.
- Separate rendering, input, and gameplay logic where practical.

For 3D games:

- Keep geometry and shaders reasonably lightweight.
- Prefer simple lighting solutions.
- Optimize for mid-range mobile hardware.
- Avoid excessive real-time shadows and postprocessing.
- Monitor draw calls, triangle counts, GPU memory, and frame time.

## 8. Game design and user experience

Games should be:

- Easy to understand.
- Quick to start.
- Comfortable on mobile.
- Visually readable.
- Responsive to input.
- Satisfying during short sessions.
- Clear about objectives and progress.

Recommended practices:

- Introduce the main mechanic immediately.
- Avoid long mandatory tutorials.
- Provide immediate visual feedback for interactions.
- Use sound and animation to reinforce actions.
- Keep menus simple.
- Provide clear success and failure states.
- Make restarting easy.
- Avoid unnecessary interruptions.

These are design goals, not strict YouTube certification requirements.

## 9. Copyright and intellectual property

All published games must use original, authorized, or properly licensed content.

Agents MUST NOT:

- Copy copyrighted characters, artwork, music, or models without permission.
- Reproduce recognizable franchise-specific visual designs.
- Assume recoloring an asset makes it legally original.
- Copy another game's distinctive visual presentation.
- Use assets with unknown licensing terms.
- Assume AI-generated assets are automatically free of intellectual-property concerns.

Before adding external assets:

1. Identify the source.
2. Check the license.
3. Confirm commercial-use permission where necessary.
4. Check attribution requirements.
5. Keep a record of the asset's origin.

Maintain an `ASSET_LICENSES.md` file when external assets are used.

General gameplay mechanics and ideas can inspire a project, but the final implementation should have its own identifiable presentation.

## 10. Privacy and external dependencies

For current itch.io builds:

- Avoid collecting unnecessary personal data.
- Do not embed trackers without a clear reason.
- Prefer local assets over runtime CDN dependencies.
- Avoid unnecessary network requests.
- Keep the game functional without a custom backend where possible.

Future YouTube Playables builds will require stricter restrictions on external calls and user data.

Do not enforce those platform-specific restrictions prematurely if they would interfere with legitimate itch.io functionality, but flag potential migration issues.

## 11. Packaging and builds

Use production builds for final validation.

For Vite projects:

- Run `npm run build`.
- Validate the output inside `dist/`.
- Ensure asset references resolve correctly.
- Prefer relative asset paths.
- Avoid absolute development-only paths.
- Check for missing assets and console errors.
- Verify the build on mobile.

For itch.io:

- Package the web build according to itch.io's HTML5 requirements.
- Ensure `index.html` is at the appropriate archive root.
- Verify that the uploaded game works inside itch.io's embedded environment.

Keep filenames simple and portable.

Minification is allowed. Avoid unnecessary code obfuscation.

## 12. Accessibility and localization

- English must be available as a game language.
- Additional languages are optional unless requested.
- Keep UI text readable.
- Do not communicate important information only through color.
- Provide clear visual feedback for interactions.
- Avoid unnecessarily small interactive elements.
- Consider reduced motion and audio accessibility where practical.

## 13. Coding agent workflow

When implementing a feature:

1. Inspect the existing project architecture.
2. Understand the current gameplay loop.
3. Propose the smallest reasonable implementation.
4. Preserve existing working functionality.
5. Follow the mobile-first requirements.
6. Consider memory and performance impact.
7. Implement the feature.
8. Run the available build and validation commands.
9. Fix introduced errors.
10. Summarize what changed and what still needs testing.

Do not claim to have tested something that was not actually tested.

Avoid broad refactoring unless necessary.

Prefer incremental, testable changes over rewriting entire systems.

## 14. Definition of Done

A feature is complete when:

- It works as intended.
- It does not break existing mechanics.
- It supports the relevant mobile and desktop interactions.
- It behaves correctly after resizing.
- It does not introduce obvious memory leaks.
- It handles expected errors.
- The production build succeeds.
- Its behavior is understandable to the player.

A game is ready for itch.io release when the complete gameplay loop works, the production build is verified, and the relevant stability, usability, and asset-rights checks are satisfied.

## 15. Future YouTube migration

When YouTube Playables integration is explicitly requested, revisit:

- Playables SDK initialization
- `firstFrameReady()` / `gameReady()`
- SDK pause/resume
- SDK audio settings
- Cloud saves
- Localization APIs
- External network restrictions
- Monetization APIs
- McPlay validation
- YouTube certification and metadata requirements

Do not implement these features before they are requested.

---

**Priority order for current development:**

1. Fun and functional gameplay.
2. Mobile and desktop usability.
3. Stability.
4. Performance.
5. Responsive design.
6. Maintainable code.
7. Copyright compliance.
8. Small and portable production builds.
9. Future YouTube compatibility without premature integration.

**Current mission: Build excellent itch.io games that are technically ready to evolve into YouTube Playables later.**

## 16. Needle in a Haystack — project-specific instructions

These project-specific decisions supplement the standards above. Preserve them unless the user requests a change.

### Workspace and communication

- Per user instruction on 2026-11-13, after finishing an authorized task and its relevant checks, commit the task's changes and push to the connected GitHub repository. Choose concise, descriptive commit messages without asking each time. This authorizes Git pushes, not game publishing or deployment. Inspect the diff, exclude secrets and unrelated changes, and report failures instead of force-pushing.

- The repository/application is in `needle-in-a-haystack/`; run npm commands there.
- Communicate with the user in Russian. English must also be available in the game under section 12; Russian communication does not replace that requirement.
- Explain the intended change before editing, work in small iterations, and preserve working features.
- Do not advance to the next milestone without the user's confirmation. Fixes and refinements to the current feature remain within the authorized scope.
- Do not create a separate reusable skill unless the user requests one; this AGENTS.md is the persistent source of project instructions.

### Accepted gameplay and technology

- Three.js + TypeScript + Vite + HTML/CSS, without React or a heavyweight physics engine unless necessary and authorized.
- The current view is first person with a PerspectiveCamera. This supersedes the original orthographic/isometric camera requirement.
- Jumping uses Space on desktop and a large touch button on mobile. The haystack is walkable using a lightweight continuous support surface derived from its current column heights; do not restore its former solid circular movement obstacle. Recompute support after loading and let the player fall when hay beneath them is removed. Keep cart and world-boundary collisions.
- The broad mound prototype uses hayProfile 1 (radius 2.12 m, summit about 1.6 m). Saves without hayProfile are legacy layouts: repack surviving stable IDs once, preserving collected IDs, inventory, coins, upgrades and completed victories. New-profile saves retain their exact stored layout; include the profile marker on writes. Do not treat visual approval or real-device validation as completed merely because automated tests pass.
- Mouse and touch remain fully supported. Per user instruction on 2026-11-13, tap-to-approach is removed: desktop movement uses WASD/arrows with mouse look; mobile uses an analog virtual joystick plus touch look/actions. Ground taps never move the player; object taps only interact within range. No keyboard is required on mobile.
- One tap starts one collection action. No hold-to-collect or automatic repeating collection. Taps during collection do not queue actions.
- Collect only within interaction range. Manual movement cancels the route and unfinished collection.
- Cart interaction unloads the entire inventory and awards coins immediately. Presentation animations must not delay payment or duplicate a transaction.
- Upgrades affect capacity, movement speed, collection duration, and amount per action. Keep prices, limits, and effects in configuration.
- The haystack initially contains 20,000 individual straws. One unit of hay corresponds to one straw. Tools can collect multiple straws per action, limited by inventory capacity and remaining hay.
- Use instancing and bounded local settling rather than simulating 20,000 full rigid bodies. Preserve sleeping inactive straws and accelerated picking.
- Highlight the individual straw under the crosshair; collect that exact straw first. Keep stable identity across instance-index swaps and settling.
- At tool level zero, show block-style hands. Once any tool is purchased, hide both hands completely and show only the tool and carried hay.
- Visible carried straw count must match inventory. Per user update on 2026-11-15, sale is instant with no unload hand animation or per-straw flights into the cart. Cart cargo is one fixed-cost static mound scaled from the exact sold-unit counter, not one rendered straw per sold unit. Preserve sale amounts, saved cargo counts and pigEaten separation; do not restore the former 20,000-slot cart instance buffer.
- The visual direction is original, colorful, block-style farm art inspired by broad sandbox-game aesthetics. Do not copy Roblox branding, characters, UI assets, or a reference game's distinctive presentation.
- Geometry is procedural. External assets require explicit user agreement and documented licensing.

### Milestones and validation

- Milestone 01: scene and controls; 02: collection and sales; 03: upgrades; 04: needle and victory; 05: polish, saves, and release.
- On 2026-11-12 the user authorized executing the entire eight-stage requirements plan ("погнали прогоняй все сам"), including saves, localization, needle/victory, stability, verification and local packaging. This does not authorize publishing, YouTube integration, or unrelated future milestones.
- Saves, English localization and needle/victory now have implementations. Consult `needle-in-a-haystack/verification/AUDIT.md` for actual validation and remaining device/hosting checks. Do not claim release readiness until relevant requirements are verified.
- User workflow override (2026-11-14): do not automatically run tests, typecheck/build validation, browser/performance audits or create screenshots after each change. The user will explicitly request testing and can manually confirm visuals/behavior. Read/review source as needed, implement small changes, report what remains unverified and ask for focused manual feedback. This supersedes the default per-task verification cadence above; release validation still remains necessary before claiming release readiness.
- Report actual validation, limitations, and pending desktop/mobile checks. Automated tests are not proof of visual quality, device FPS, memory stability, or a production-device test.
- For documentation-only edits, check the document instead of running unrelated gameplay tests.
- Retain `base: './'` and validate emitted asset paths for itch.io. Never publish or submit externally without authorization.
- The production build splits Three.js core and renderer chunks to meet the preferred 512 KiB individual-file target. Measure the actual current build rather than treating historical sizes as current.

### Local development reliability

- The stylesheet is linked from index.html. Keep a reliable stylesheet loading path in both development and production.
- Vite's file watcher waits for writes to finish: preserve this protection against caching temporarily empty files.
- Prefer patch-based or atomic edits over repeatedly truncating files while the development server is watching.

## 17. Visual Identity, First-Load Performance & Onboarding

Added by the user on 2026-11-13. This section refines the earlier standards. Its development-priority order and 3-second initial-interactivity target take precedence over the earlier general priority list and 5-second aim for this game. Existing technical size, safety, licensing, and platform-scope requirements still apply.

### Product Direction

Needle in a Haystack is a bright, playful, mobile-first 3D casual game designed to be immediately understandable and engaging.

The game should be accessible to younger players, approximately ages 5–12, while remaining enjoyable for a broader audience.

Prioritize clarity, fast interaction, positive feedback, and age-appropriate design. Do not use manipulative engagement mechanics, artificial urgency, or pressure-based monetization.

### Visual Requirements

- Bright, colorful, friendly 3D art direction.
- Simple, readable silhouettes and recognizable objects.
- Large interactive targets.
- Minimal text and icon-first communication.
- Smooth, expressive animations.
- Lightweight materials and optimized geometry.
- Consistent visual hierarchy.
- Clear contrast between interactive and decorative objects.
- Avoid unnecessary visual clutter.
- Maintain visual consistency across all levels.

### Performance: Playable First

The highest technical priority is minimizing time to first meaningful interaction.

Target initial interactivity within 3 seconds on representative mobile hardware and network conditions, where feasible.

This is an internal performance target, not a guaranteed result.

#### Critical Loading

Load only assets required for the first playable interaction:

- Player character
- Initial haystack
- Cart
- Camera
- Input controls
- Minimal environment
- Essential UI

Do not block the first interaction on:

- Future levels
- Unused tools
- Decorative assets
- Optional sounds
- Nonessential effects
- Advanced upgrade content

#### Lazy Loading

Implement three loading phases:

1. Critical assets before gameplay.
2. Noncritical assets after the game becomes interactive.
3. Level-specific assets on demand.

Prefetch upcoming content when appropriate.

Do not cause visible freezes during background loading.

Measure actual startup time and initial transfer size.

Avoid downloading all future-level assets at startup.

### Guided Onboarding

The first session must teach the game through interaction rather than lengthy explanations.

#### Tutorial Sequence

1. Highlight the haystack.
2. Guide the player to tap the haystack.
3. Show the character collecting hay.
4. Highlight the cart.
5. Guide the player to deliver hay.
6. Show the coin reward.
7. Highlight the first affordable upgrade.
8. Guide the player to purchase it.
9. Demonstrate the improvement.
10. Introduce the objective of finding the hidden needle.

Control clarification: preserve manual-only movement from section 16. Before an interaction, visually guide the player to move into range with the mobile joystick or desktop movement keys. Tapping the haystack or cart performs an action only within range; tutorial guidance must not restore tap-to-approach or automatic walking.

#### Tutorial Rules

- One instruction at a time.
- Use animated pointers, arrows, highlights, and simple visual cues.
- Do not depend on reading ability.
- Never require a long text explanation.
- Keep tutorial interactions immediately responsive.
- Advance only when the required player action is completed.
- Do not repeatedly block normal gameplay with popups.
- Allow replaying tutorial guidance.
- Save tutorial completion locally.
- Ensure the tutorial works with touch and mouse.
- Respect reduced-motion preferences where practical.

### Feedback and Engagement

Every meaningful interaction should provide clear feedback.

Examples:

- Hay visually decreases after collection.
- The character visibly carries collected hay.
- Coins animate when delivered.
- Upgrades produce immediate observable changes.
- New tools have distinct appearances or animations.
- Major milestones introduce new visual elements.

Avoid excessive flashing, screen shaking, or overwhelming effects.

### Development Priority

When tradeoffs are necessary, prioritize:

1. Fast first interaction.
2. Clear onboarding.
3. Responsive mobile controls.
4. Stable gameplay.
5. Readable, attractive visuals.
6. Meaningful progression.
7. Optional visual polish.

Do not sacrifice startup performance for decorative improvements.

### Validation

Before release:

- Test first interaction on real mobile hardware.
- Measure startup time with a cold cache.
- Test under slower network conditions.
- Verify that the first interaction does not wait for optional assets.
- Confirm that tutorial steps work without reading.
- Test portrait and landscape orientations.
- Confirm that lazy-loaded assets do not interrupt gameplay.
- Check memory use and resource cleanup.
- Verify that the production build works on itch.io.

### Platform Scope

The current release target remains itch.io.

Do not integrate YouTube SDK, YouTube ads, YouTube cloud saves, or YouTube-specific lifecycle APIs unless explicitly requested.

Maintain architecture that can support future platform adaptation.

### Adoption and Current Implementation

These are requirements for subsequent development, not claims that the current prototype already meets them. Adding this section does not authorize unrelated feature implementation or a broad rewrite in the documentation task.

- The new bright, friendly art direction supersedes the earlier twilight-atmosphere preference as the product direction. Apply it in subsequent visual work while preserving clear hay contrast and selected-straw readability.
- Three-phase loading and the guided first-session tutorial still require implementation and validation. Existing help dialogs do not substitute for interactive onboarding.
- Local headless Chrome measurements do not prove the 3-second target on representative mobile hardware or slower networks.

## 18. Visual source of truth: ART_DIRECTION.md

- Read [ART_DIRECTION.md](ART_DIRECTION.md) before any work on models, colors, materials, textures, lighting, animations, particles, HUD, onboarding cues, screenshots, or promotional artwork.
- It is the authoritative visual direction for this project: **Vibrant Toybox 3D** — a sunny, cheerful, saturated, original toy-like farm with chunky readable silhouettes, golden textured hay, clean blue sky/green grass, and a distinct cart. Earlier twilight styling is not the current art target.
- Follow its palette, shape/material rules, mobile framing, performance constraints, and visual acceptance criteria. Promotional typography and oversized cover-art needles are not instructions to clutter the gameplay HUD or expose the hidden needle at startup.
- Use references for visual vocabulary only. Do not copy third-party characters, branding, assets, or distinctive compositions.
- Apply visual changes incrementally. Check portrait/landscape framing and production build; report measured transfer/performance changes where available. Do not introduce expensive graphics techniques or depart from the established core style without the user's approval.
- Preserve the explicit manual-control decision: desktop keys/mouse, mobile joystick/touch. The art document's immediate interaction response does not restore automatic walking on taps. Onboarding must guide manual movement into range before collection/delivery.
- Preserve the current 20,000-unit hay economy, selected-straw identity and visible collection feedback while optimizing representation. Instanced/shared geometry is compatible with the ban on one independent mesh object per straw; do not silently replace gameplay counts or remove selection mechanics during art work.
- Adding this reference records the design standard; it does not mean the current prototype already satisfies the art acceptance criteria or authorize implementing all visual/onboarding changes at once.

## 19. Living asset checklists

- Maintain three project-root Markdown inventories: [ASSETS_3D.md](ASSETS_3D.md) for models, terrain, sky, materials and 3D animations; [ASSETS_2D.md](ASSETS_2D.md) for UI, icons, typography, wording/localization, 2D effects and publishing artwork; [AUDIO_ASSETS.md](AUDIO_ASSETS.md) for music, ambience, sound effects and their integration needs.
- Whenever development adds, changes, replaces or removes an asset, a UI element/text group, an animation or an audio event, update the relevant checklist in the same task and commit. Add newly discovered needs rather than leaving them only in conversation. Update multiple lists when a feature affects multiple disciplines; cross-reference shared items instead of duplicating work.
- Use stable IDs, Markdown todo checkboxes, a concise description, priority and current implementation status. Record the actual path and basic validation once integrated. Distinguish existing procedural prototypes from missing final artwork; never mark an asset complete merely because it is planned or generated.
- Preserve descriptions/history when assets are replaced: identify the current source and remove stale active requirements. Record author/source/license in `needle-in-a-haystack/ASSET_LICENSES.md` for imported files, fonts, music and sounds.
- Check these inventories when scoping relevant work and include their updates in the completion check. A checklist entry alone does not authorize implementing a new mechanic, generating all assets, adding dependencies or publishing. Preserve ART_DIRECTION.md, gameplay decisions, mobile readability and loading/resource budgets.
- Consult and maintain [ASSET_BUDGETS.md](ASSET_BUDGETS.md) for quality targets, per-family triangle/texture/audio budgets and the combined working-set plan. For new/replaced assets record file bytes separately from decoded CPU/GPU estimates, materials/draw calls, texture resolutions, unique geometry and instance counts; for audio also duration, sample rate and channels. Reuse existing geometry, material atlases, icons and sound families before producing another asset. Distinguish estimates, project targets and measured peaks; checklist counts and GLB counts are not memory measurements. Do not claim the full game fits a memory budget from heap or archive size alone. Update affected inventories and this budget document in the same task when actual measurements or approved scope change.

## 20. Living gameplay and technical requirements

- Maintain [GAME_REQUIREMENTS.md](GAME_REQUIREMENTS.md) as the project-specific product/technical specification. Read it before gameplay changes; update it in the same task when a mechanic, balance decision, technical constraint or acceptance criterion changes. Synchronize affected asset lists and ASSET_BUDGETS.md.
- Explicitly distinguish implemented behavior, newly requested/planned features, acceptance checks and unresolved design choices. Do not present documented plans as working code or invent final rarity odds/rewards, needle counts, event timers or win rules.
- New direction recorded on 2026-11-14: a broader gently sloped hay mound instead of an egg-like silhouette; rare straws with extra money for discovery; multiple needles and a persistent collection; buying tools at a reachable barn; random positive events such as ×2 hay-sale proceeds. These are pending implementation and do not authorize implementing every feature during a documentation task.
- The current single-needle victory, rake/fork tool order and menu shop remain descriptions of current code until their replacement is implemented. The requested barn sequence (small forks, then rake, then a stronger tool), collection completion/reset rules and event/rarity balance require explicit configuration/design decisions. Preserve old progress through migration; do not silently reset completed saves or weaken economy validation.
- Current HUD decision (2026-11-14): no game title or persistent bottom action-description panel; coins and carry capacity stack on the left with a book-shaped shop button underneath; help/settings in the upper right; hay remaining is a top-centred progress bar. Do not show a current-tool card. On narrow screens reserve the top row for the centred progress bar and keep the side controls below it to avoid overlaps. Preserve localized accessible labels and the hidden live status region.
- Hay progress shows a hay icon and remaining number, without the visible "hay left" caption. Use brief pooled floating feedback for actual collection amounts, sale payouts and a full-inventory rejection; no permanent bottom descriptions. Preserve immediate transactions, suppress zero/duplicate feedback, respect reduced motion and clean up animations on restart. Manual review only unless the user requests automated checks.
- Latest progression prototype: buy rake, pitchfork, wide pitchfork and vacuum sequentially at the reachable open barn; upgrade capacity via the hanging backpack; buy up to three pigs with increasing prices. The book's first tab upgrades character movement, collection speed and sale price; purchased-tool tabs have independent amount/special levels and equip selection. Backpack/pig tabs show owned-item information. Pigs are explicitly authorized automatic helpers; the player's collection remains one action per tap. Preserve save-v2 migration, separate saleRevenue/discoveryCoins and pigEaten accounting. Details and provisional prices/features are in GAME_REQUIREMENTS.md section 17; do not label untested behavior as verified.
- Background music uses the user's `public/audio/needlebackground_2.mp3` through one app-level AudioManager/HTMLAudioElement, not a full decoded AudioBuffer or one player per game restart. Start/download only after a user gesture; loop, pause for dialogs/hidden or unfocused pages, preserve playback position and saved music-enabled/volume settings (default 25%). Keep local Vite asset URLs and graceful audio failures. No automatic listening/browser tests or screenshots without the user's request.



### Action audio (2026-11-15)

- Keep collection/sale sounds attached to actual completed transactions, not individual straws or coins.
- Reuse inventory_is_full.mp3 for unavailable actions with the 450 ms cooldown.
- Footsteps follow actual grounded displacement and stop in menus/background/air; reuse a single loop.
- Preserve the bounded four-voice effect pool, lazy audio sources and separate saved music/effects preferences.
- Current user instruction remains: do not run automated tests, typechecks/builds, browser checks or screenshots unless requested; ask the user to verify gameplay manually.

### Progression and vacuum override (2026-11-15)

- The user's newer request explicitly overrides one-tap-only for the vacuum: repeat hay collection only while E, action button or a hay pointer is held. Stop on release/cancel/menu/background; allow movement while vacuuming. Other tools remain one action per tap. Busy collection taps are silent.
- Target 10–15 actions per backpack at comparable progression. Current capacity 15 + 40/level, max 615. Sale upgrades add 10% of base price per level; retain integer tenths across payouts.
- Pigs share bite-size/eating-speed upgrades in the book after first purchase. Keep the three-pig bound and all economy ledgers.
- Preserve v3 save migration and the frozen legacy price tables: historical purchases use old prices, new purchases use current prices. Never reset the player's progress to apply a balance update.
- GAME_REQUIREMENTS.md section 18 describes current provisional prices and manual acceptance; do not claim balance or device validation without actual user confirmation.

### Map layout override (2026-11-15)

- Playable map is 26×26 (twice each former side), hay upper left, cart lower left, barn upper right rotated -30° around Y. Keep layout coordinates in balance.ts/progression.ts and use barnWorld for world-space interaction points; barn geometry uses local coordinates.
- Preserve rotated-wall collision support and expanded pig roaming bounds. Do not move visuals without their interaction/collision data.
- Save layoutVersion and relocate only legacy-layout or obstructed player positions to the configured spawn; retain all economy, hay and upgrade progress. See GAME_REQUIREMENTS.md section 19 for manual acceptance.

### Price reduction override (2026-11-15)

- All purchases use floor(previous level price × 0.7), except sale upgrades use ×0.28 (first 700). Keep the historical price functions unchanged for save validation.
- Sale effect now adds 25% of base price per level, not 10%; carry fractional payouts in integer hundredths. Save v4 migrates old tenths and keeps priceBaseline plus legacyProgress to preserve historical spending without resetting progress.
- Cart group yaw is +30°, including its cargo/model. Follow GAME_REQUIREMENTS.md section 20 for current values; manual validation remains pending.

## 21. Adopted visual feedback backlog (2026-11-16)

- GAME_REQUIREMENTS.md section 21 is the canonical adopted visual/UX backlog; ART_DIRECTION.md defines its original Vibrant Toybox presentation. GAME_REQUIREMENTS_visual_proposals.md and visual_feedback_appendix.md are preserved input snapshots. The large proposal repeats the appendix and contains obsolete prices/capacity/input descriptions and escaped Markdown: never replace the canonical requirements with it or treat it as an instruction to roll back current mechanics.
- Apply the review clarifications in section 21.8: silent busy taps, held vacuum only, instant atomic payouts, static cart cargo, accurate real-state affordances while decorative counters animate, temporary barn purchase confirmation card, preserved book and current 26×26 layout/save v4. Cards are planned changes to direct item purchase, not implemented by adopting the document.
- Visual implementation order: shared parameters/HUD → barn card → tool/collection/sale feel → cohesive mobile UI → interactive onboarding/playable-first loading → restrained scenery. Needle collection and random events are separate pending gameplay decisions. No automatic stage advancement without the user's confirmation; the present task adopts documents only.
- Keep ASSETS_2D.md, ASSETS_3D.md, AUDIO_ASSETS.md and ASSET_BUDGETS.md synchronized using stable requirement IDs. Reuse existing SVG, shared meshes/materials and sound families; do not generate every listed prop or animation as a new asset. Decorative coins/feedback need hard pool bounds; optional scenery cannot delay first interaction.
- Manual review covers bursts, full inventory, rare reward, large/empty/repeated sales, unaffordable/owned/equipped/max items, modal input/pause, touch portrait/landscape, reduced motion and reload. Real mobile/performance/production checks remain pending and require the user's request; no automatic tests/typecheck/build/browser/screenshots for this documentation adoption.

### Implementation of approved presentation plan (2026-11-16)

The owner authorized all visual roadmap stages in one task. Current prototypes are in GAME_REQUIREMENTS.md section 22; earlier planned-status paragraphs are historical. The owner explicitly retained one needle and approved the timed ×2 player-delivery event. Do not add a five-needle album.

- Shared presentation parameters: src/config/presentation.ts. HUD: HudFeedback.ts (one retargeted counter loop, eight coins), FloatingFeedback.ts (four messages), icons.ts. Synchronize actual game state before menus; never award resources from animation callbacks.
- Barn interaction now opens BarnCard.ts, with purchase/equip confirmation and 320 ms duplicate guard. The book still upgrades characters/owned tools/pigs. Preserve accessible feedback, focus, range checks, pause/input reset and immediate saved transactions. New models are original procedural/SVG assets.
- Onboarding.ts persists completion in needle.tutorial.v1, replays from help, teaches manual movement and uses actual successful actions. Never restore tap-to-approach. Replaying guidance cannot freeze an active ×2 event.
- SaleEvent.ts: after tutorial, 180–300 active seconds between events, 45 seconds ×2 for player deliveries only, no countdown urgency/offline reward. Save v5 persists timer/eventRevenue/eventRemainder alongside all v4 ledgers and price baselines. Pigs and rare discovery coins are excluded from ×2. Keep the full spending/revenue invariant.
- FarmDecor.ts is optional static instanced scenery, loaded after the first playable frame; barn display is also deferred and held tool models are created on demand. No new lights, colliders, raster textures or separate cart straws. Scenery motion remains disabled until authorized performance measurement.
- No automated tests, typechecks/builds, browser runs or screenshots were performed for this implementation per the owner's standing instruction. Visual acceptance, mobile/startup/resource measurements and production hosting validation remain pending. Do not claim release readiness or turn open checkboxes into verified completion without actual review.

### Каталог экономики — 2026-11-16

- Поддерживать [ECONOMY_CATALOG.md](ECONOMY_CATALOG.md): все действующие покупки/уровни/эффекты, отдельно цена шага и накопленные расходы. После правки balance.ts/progression.ts/rarity.ts обновлять экспортом `node scripts/export-economy.mjs` из приложения (Node 22.13+). Это генератор документации, не разрешение запускать тесты/сборку.
- В каталоге объяснять фактические ограничения: скорость еды свинок не меняет прогулку/поиск корма, уровни веток инструментов не переносятся между предметами, ×2 только для сдачи игроком. Не менять баланс молча при формировании таблиц.

## 22. Economy and owner collaboration — adopted 2026-11-16

## Global rule: ask the owner when it improves the result

The project owner is available for decisions but may not answer immediately. **Actively ask clarifying questions** whenever the answer could materially improve design quality, player experience, technical correctness, visual fidelity, balance, architecture, or maintenance.

Do not assume that silence means approval. Do not invent product decisions merely to avoid asking.

Examples of when to ask:
- Two plausible mechanics, UI styles, or UX behaviors lead to meaningfully different outcomes.
- A gameplay rule, numeric target, or source of truth is ambiguous.
- A requested change risks affecting saves, economy, accessibility, performance or mobile play.
- A new asset, animation, interaction, or upgrade needs a subjective design choice.
- An implementation could be simpler or better with one missing fact from the owner.
- Requirements contradict each other or differ from existing code.

Ask **focused questions with context**: explain the decision, offer 2–3 concrete options when helpful, recommend a default, and state what work is blocked. Prefer batching related questions over interrupting after every small detail. Do not ask about trivial reversible choices that can be handled with established project conventions.

### Persistent open questions: `OPEN_QUESTIONS.md`

Create and maintain a file named `OPEN_QUESTIONS.md` at the project root. It is the persistent decision backlog, not a chat transcript.

When an answer is unavailable:
1. Add a question with a stable ID, date, category, priority, reason, options/recommendation, blocking status, and affected files/features.
2. Mark it `OPEN`; do not silently choose a permanent answer.
3. Continue **independent, safe, reversible work** that does not require the answer.
4. If necessary, use a clearly labeled temporary assumption **only when reversible and low risk**, with no production release or destructive migration. Link the assumption to the question ID.
5. When the owner answers, record the decision and date, mark `RESOLVED`, and update affected documentation and implementation after approval.
6. Never delete the question history; archive resolved questions in the same file or a `Resolved` section.
7. Avoid duplicate questions: update the existing ID instead.

Suggested entry format:

```markdown
## Q-001 — [Short question]
- Status: OPEN | RESOLVED | BLOCKED
- Created: YYYY-MM-DD
- Category: Gameplay | Economy | Visual | UX | Technical | Save migration | Other
- Priority: High | Medium | Low
- Decision needed: [one direct question]
- Why it matters: [consequences]
- Options: A / B / C
- Recommendation: [preferred option and rationale, or 'none yet']
- Blocks: [specific task, or 'none']
- Related: [files, features, issue]
- Temporary assumption: [if any, explicitly reversible]
- Answer / resolved date: [fill when owner responds]
```

When the owner says **"напомни вопросы"**, **"какие вопросы открыты?"**, or asks to review unresolved decisions: read `OPEN_QUESTIONS.md`, list all currently `OPEN`/`BLOCKED` questions grouped by priority, briefly restate the trade-offs, and invite answers. Do not rely only on chat history.

At the end of each substantial Codex task, mention newly added or still-blocking questions and whether the work was completed without answers.

## Economy: source of truth and scope

Read `ECONOMY_BALANCE_V2.md` before any economy, progression, price, tool-upgrade, pig, rarity, or prestige-related work. This is an **experimental proposal**, not current production truth.

Also inspect actual implementation and exports before editing:
- `src/config/balance.ts`
- `src/config/progression.ts`
- `src/config/rarity.ts`
- `EconomySystem.ts` (locate its actual path)
- save schema/migrations and current `GAME_REQUIREMENTS.md`
- `scripts/export-economy.mjs` if present

The real code and current saves determine **current behavior**. The experimental document determines **proposed v2 targets**. If they disagree, report the difference; do not quietly overwrite either.

## Economy: required design principles

1. Target a first active playthrough of **45–60 minutes** for a finite 20,000-hay stack. This is a **hypothesis to validate**, not a promise.
2. Prioritize player agency, mastery, visible gains, and distinct upgrade roles over artificial time gates or manipulative retention.
3. Most tools should be attainable; all upgrades and pigs need not be purchased. Pigs are optional.
4. Keep prices, caps, effects, and economy version centralized in configuration. No magic numbers in UI components.
5. Evaluate upgrades using **time to purchase, realized throughput, remaining hay, and opportunity cost**. A price/sale bonus is only valuable on hay remaining to sell.
6. For finite hay, pigs consume existing hay. Do not count all pig revenue as newly generated profit.
7. Evaluate backpack, movement, tool range, and tool action speed using real traversal and interaction data, not theoretical rates alone.
8. Beware of pig AI's wandering/travel time masking cooldown upgrades. Ask the owner before changing pig behavior.
9. Keep purchases/sales atomic, authoritative and persisted immediately; animated counters and coin effects must never delay actual transactions.
10. Keep rarity, ×2 events and fractional coin remainders correct; verify against code.
11. Do not implement prestige reset or permanent buffs until the owner specifies what is retained.
12. Do not silently reduce existing players' upgrade levels or corrupt old saves when introducing lower caps. Ask for a migration policy.
13. Do not change existing production balance until the owner explicitly approves the experimental results.

## Economy: required validation workflow

Before proposing to activate v2:

1. Inspect all formulas and save behavior in the code.
2. Build a deterministic simulation against actual game formulas and a finite 20,000-hay stack.
3. Compare multiple purchase strategies: fast tools, early sale-price upgrades, backpack-focused, wide-pitchfork-focused, pig-assisted, no pigs, and no vacuum.
4. Include realistic time for walking, collecting, selling, shopping and pig movement, with assumptions labeled.
5. Show predicted time to purchase, upgrade payback, remaining hay, total currency earned/spent, and predicted completion time.
6. Flag dominated or nonfunctional upgrades and any price ceilings that make choices inaccessible.
7. Collect local opt-in playtest metrics, including real hay/min, coins/min, purchase order, cart trips, pig bites/min, and completion time.
8. Separate **measured**, **simulated**, and **assumed** values in every report.
9. Propose adjustments, record open decisions, and request owner approval before changing the production configuration.
10. After approval, implement with tests, update economy exports/docs, and verify save migrations and mobile gameplay.

## Economy: specific questions to track initially

If unanswered, create entries in `OPEN_QUESTIONS.md` for:
- Prestige reset and persistent rewards.
- Migration of existing saves above proposed v2 level caps.
- Actual mobile/desktop collection and travel times.
- Whether to modify pig AI before releasing pig-speed upgrades.
- Current availability and exact semantics of the ×2 sale event.

## Rule precedence and collaboration

- Existing `AGENTS.md` rules remain in force unless the owner approves an explicit change.
- Treat `ECONOMY_BALANCE_V2.md` as a candidate balance, not an instruction to immediately modify production.
- Ask for owner input when it could materially improve outcomes; write unanswered questions to `OPEN_QUESTIONS.md` and proceed safely where possible.
- Never treat a recommendation, assumption, or unanswered question as an approved design decision.


### Economy v2 task decisions and precedence — 2026-11-16

- The owner answered: preserve existing upgrade levels AND effects; do not change pig AI; run only the economic simulation now, game checks later; retain the 45–60-minute target and revise the candidate. These answers resolve Q-001/002/003/008 in OPEN_QUESTIONS.md. Do not ask them again without new material constraints.
- Existing no-tests/build/browser/screenshots instruction still applies. The numerical simulator is explicitly part of this requested design evaluation, not proof of gameplay/save migration correctness. Candidate v2 remains inactive until approval of results per ECONOMY_BALANCE_V2.md §13; current price catalog remains production-only.
- balance.v2.ts revision 2 and ECONOMY_SIMULATION_V2.md contain the revised prices, assumptions, 243 runs and counterexamples. The 45–60-minute goal is NOT proven: faster tool-investment paths and device/time assumptions materially change results. No artificial waiting was added to meet a target.
- EconomyTelemetry is opt-in and local only, disabled by default, capped at 200 purchase/trip entries, no identifiers/network upload. It records a current session segment, not an automatically stitched complete cycle across reloads. Do not export or upload player measurements without their action/authorization.
- Grandfather implementation is not yet active: future v2 migration must keep original step effects for historical rake/range levels and allow above-new-cap saves. Never clamp the getter/validator or shrink the carry buffer to the fresh-player cap while old players can carry more.

## Architecture and documentation entry point

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the current module map, lifecycle, gameplay invariants, persistence, concise rules and documentation index. It is an overview, not a replacement for AGENTS.md, GAME_REQUIREMENTS.md or ART_DIRECTION.md. Update it alongside actual changes to module responsibilities, lifecycle, persistence/platform boundaries or document authority. Keep implemented, experimental, measured and pending states distinct; a documentation-only task does not activate the v2 candidate or authorize game tests/publishing.

## Team feedback and menu direction — 2026-11-16

- The owner requested preparation only, with confirmation before starting implementation. docs/DEVELOPER_NOTES.md is the tracked TEAM-01…08 backlog; GAME_REQUIREMENTS.md §25 records scope. New mechanics are not implemented by documenting them.
- Read master-agent commit 66e0794 and docs/REPO_REVIEW.md, TESTING.md, PERFORMANCE.md for current audit findings and check limitations. Do not claim its documentation changes fixed gameplay or ran tests.
- Every denial sound needs a concise visible reason in the appropriate world/menu UI. Busy collection remains silent; no repeated message/sound queues. Keep the existing cooldown and pooling.
- Owner now wants a visible timer/status for ×2 money and timed optional chest progress bars. This supersedes the earlier no-countdown presentation decision for these features only; preserve player-sale-only ×2 semantics until separately changed. No penalty for ignoring an optional chest or manipulative monetization.
- Short menu copy is the new direction: icon, brief label/value, price and main button; technical explanations belong in docs. Wait for the owner's promised drawing before changing menu layout. Do not remove localization/accessibility to reduce copy.
- Chests, leaderboard, diamond/well meta-upgrades and helper skins require the recorded decisions Q-009…014 plus Q-005. Do not infer a backend, destructive prestige, new pig AI or unlicensed assets. Candidate economy v2 remains inactive under Q-007.

### TEAM-01 implemented (2026-11-16)

The owner authorized step 1 only: Game.reject(text) is the single route for an audible denial plus a short visible reason. Use the active dialog's feedback or the existing world popup pool; share presentation.rejectionCooldownMs (450 ms) with AudioManager. Busy collection remains silent. Shop rejection callbacks pass the reason text, and exact failure messages must not be overwritten by generic fallback UI. Prices, interaction range, saves and all other TEAM items are unchanged. Manual acceptance is pending; no automatic tests/build/browser/screenshots/simulation were run. Do not advance to step 2 without the owner's instruction.

### TEAM-02 implemented (2026-11-16)

The owner approved random chests: one at a time, 180–300 seconds of active play between appearances (after claim/expiry), lifetime 30 seconds. Rewards follow cleared hay: <25% = 50, <50% = 100, <75% = 300, otherwise 1000 coins; fix the stage at spawn. Pause in menus/background; preserve wait, RNG, active chest and lifetime across reload. No offline advancement, penalty for missing, or sale ×2 multiplier. One nearby tap/E/action claims immediately, including with a full inventory. SaveData v6 adds chestRevenue, four stage claim counters and ChestState; keep the income/spending invariant and versions 1–5 migration. Reuse one procedural chest and one timer overlay; no new assets or sounds are required. Manual acceptance is pending. Existing v2 simulations predate chests and v2 remains inactive. No automatic checks unless requested by the owner.

### TEAM-03 implemented (2026-11-16)

Owner approved a farm notice board opening Local / Global tabs. Local stores only the five fastest completed new runs; Global is explicitly fictional demo data with no backend/login/network. Count active wall time from first playable frame to picking up the needle, excluding menus, background, context loss, loading and offline time. Persist RunState (id/time/eligibility/finished/rules) in SaveData v7; load versions 1–7. Old runs without complete timing remain playable but never enter records. Keep records under separate needle.records.v1 so New Game retains them. Deduplicate by run ID across victory reloads; leaderboard is independent of opt-in telemetry. Current comparison rules: fresh 20k-hay production economy v1 with chests. Future balance/meta changes need a new rules ID and a migration/display decision. Board is original procedural farm art, not copied Witcher assets. Do not implement the next TEAM item without instruction. No automatic checks unless requested.

### TEAM-04 design input (2026-11-16)

Owner specified well meta-upgrades: starting movement ×1.5, twice as many chests, double ×2 event duration, starting rake/pitchfork/wide pitchfork/vacuum, one starting pet. Diamonds come from hay. WELL_PROGRESSION.md records accepted effects separately from unapproved price/drop-rate/application proposals; Q-005/Q-011 remain pending until owner replies. Preserve old saves/records and coin ledger; free starting items are not coin purchases. Diamond award + claim marker and meta purchase + debit require recoverable atomic persistence. Do not invent prestige resets or activate economy v2.

### TEAM-04 approved and implemented (2026-11-16)

This supersedes the pending-design note above. Owner explicitly approved 20 diamonds/stack (+1 each, pigs leave them), one-time prices legs10/luck15/gold15/friends20 and sequential start tools10/20/35/60. One chest every90–150s with luck, still30s lifetime; gold makes sale ×2 last90s. Purchases/diamonds persist through New Game and apply ONLY next run; highest owned start tool and one pig within cap3. Current runs/old records are retained; new results show starting buff badges. SaveData v8 stores MetaProfile + run buffs + GemState in the SAME atomic checkpoint as hay/coins/run timer. Never remove SAVE_KEY before New Game initialization; preserve meta even in memory-only restart. Free starter items are excluded from paid coin spending, not credited as fictional income. Preserve stable gem IDs/claim mask and pig drops; no duplicate award on reload. See WELL_PROGRESSION.md. Q-005/011 resolved for this scope; destructive prestige still not authorized. No tests/build/browser/screenshots were run; manual acceptance pending. Economy v2 remains inactive.

### TEAM-06/07 refinements (2026-11-17)

Owner requested default interaction reach ×1.5 and a visible ×2-sale countdown. Hay collection base center distance is now (hay.radius + playerRadius + gap + tolerance) × collectionRangeMultiplier (1.5), 2.93→4.395m; tool reach remains additive. Reuse Game.inRange for touch/desktop, vacuum, tutorial and final collection check. Other object ranges/collisions are unchanged. SaleEvent.remainingSeconds exposes ceil remaining, HUD shows m:ss and changes DOM only on whole-second transitions; respects existing pause/save/45s or well90s duration. No new timer loops/audio/urgency effects, no tests/build/screenshots unless requested.

### Pigs and muscle memory (2026-11-17)

Owner authorized pigs eating×3 at ALL levels (base3/6/9, portion step3), purchase prices−15% (476/1428/4284). Do not change upgrade prices, intervals or pig AI. Preserve historical paid costs with pigPriceBaseline (pre-discount560/1680/5040); no refunds. Owner explicitly confirmed muscle memory50 diamonds carries all character/backpack/tool levels and all pigs + their upgrades to New Game, with coins/inventory/hay-progress reset. Persist one memoryProgress snapshot in MetaProfile; record free startProgress in SaveData v9 and exclude it from coin spending. No fictional sale revenue. Combine starter tool/friends with carried progress via max, not addition. Old saves/records retained; ↺ badge marks memory. No automatic checks unless requested, v2 remains inactive.

### General opt-in playtest report (2026-11-17)

Owner requested game-wide JSON beyond economy. PLAYTEST_REPORT.md documents schema2/current-segment semantics. Preserve old economy fields, settings opt-in (off by default), local-only storage and explicit manual export needle-playtest.json. PlaytestTelemetry bounds counters64/denials24/milestones11/histogram7, economy logs stay200 entries each. No raw UA, names/run IDs, URLs/error strings/stacks, input traces or network. Renderer/optional JS heap peaks are sampled every60 rendered frames, not GPU/total memory guarantees. Remove error listeners on disable/dispose. Do not silently stitch reloads or call segment data a measured full run. No automatic checks unless requested.

### Playtest v3 / technical targets (2026-11-17)

Owner explicitly authorized the proposed metrics including random durable run ID + segment linking; this supersedes the earlier blanket no-run-ID note ONLY for random playtestId, never player/device identifiers. Keep reportId stable per cumulative segment/export; old reports cannot be retro-linked. PLAYTEST_REPORT_V3.md is schema/limits authority. Track stages by totalHay, per-tool/source/outcome, full moving/stationary, per-pig/level, purchase effects before/after, viewport-visible chest (no occlusion inference), distinct clear/needle/victory/record result. TechnicalTelemetry must distinguish observed within-range/exceeds/unknown; never certify cold download, GPU/process memory, crash rate, mobile/itch/orientation/restart leak checks from this report. Build inventory is generated by next production build, unknown in dev; only local opt-in manifest fetch, no upload. Keep optional RunState link fields compatible with saves1–9. CPU timings are synchronous main-thread only; percentiles are histogram upper bounds. Do not run checks/build/browser without owner request.

### Selected action refinements (2026-11-17)

Owner authorized action1/2/3/5/7/9 including addressed checks + production build; screenshots remain unrequested. Separately answered YES to pig speed shortening both cooldown and post-bite wander threshold; movement speed/routes stay unchanged. This supersedes the old preserve-AI instruction for these timers only. Game uses foreground elapsed for event/collection/pig clocks, capped50ms for movement/physics; keep pause/background resets and no queued/catch-up harvest. gameSeconds remains capped-physics telemetry, new build marker2026-11-17-refinements-r1 identifies semantics.

Haystack snapshot stays byte-compatible; cache must invalidate on remove/restore AND settling rotation, and cache rotation quantization only for unchanged IDs. Preserve legacy rounding at half boundaries. Save transactions remain immediate/atomic. Shadow is one132-triangle procedural hemisphere, individual hay cast/receive shadows off; scene dirty invalidation must track proxy changes, not each settling straw. Keep instancing/picking/surface unchanged. CollectionFeedback is one disposable widget, immediate state/20Hz progress, no busy denial/queue.

Actual addressed results and pending real-mobile/visual/hosting checks: needle-in-a-haystack/verification/REFINEMENTS_2026-11-17.md. This task's test authorization does not grant blanket future automatic tests; previous owner preference persists outside requested verification scope. Do not call headless SwiftShader/mobile emulation real-device FPS. v2 remains inactive.
