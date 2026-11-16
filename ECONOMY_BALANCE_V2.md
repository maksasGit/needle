# Needle in a Haystack — Experimental Economy Balance v2

**Status:** PROPOSAL ONLY. Not implemented, not simulated against the actual game, not approved for production.
**Goal:** First active cycle of approximately **45–60 minutes**; most tools obtainable, pigs optional, prestige reset undecided.
**Source basis:** Current exported game economy (`balance.ts`, `progression.ts`, `rarity.ts`, `EconomySystem.ts` as described in the uploaded economy export), current `GAME_REQUIREMENTS`, and the balance proposal discussed with the owner. This document is a proposed replacement, **not** a claim about the current code.

## 1. Core assumptions and constraints

- Finite haystack: **20,000 units**. One unit corresponds to one straw.
- Base sale price: **1 coin per ordinary straw**. Sale-price upgrade adds **+0.25 coin per straw per level**, additive to the base price, not compounded.
- Starting backpack: **15**. Backpack upgrade: **+40 capacity per level**.
- Starting movement: **2.6 m/s**. Movement upgrade: **+0.65 m/s per level** (additive).
- Starting hand collection time: **0.45 seconds per action**. Collection-speed upgrade multiplies action time by **0.9 per level**.
- Tool action time: `0.45 * 0.9^(playerCollectionLevel) * toolTimeMultiplier`, additionally `* 0.9^(widePitchforkSpecialLevel)` for wide pitchfork. Existing multipliers: rake 0.80, pitchfork 0.95, wide pitchfork 1.20, vacuum 0.90.
- Base tool portions: rake 3, pitchfork 6, wide pitchfork 10, vacuum 14. One action collects no more than free capacity or remaining hay. Vacuum supports hold-to-collect; other tools remain one action per click/tap.
- Tools are bought sequentially; prior tools remain equippable.
- Pigs consume **the same finite hay** that players would otherwise sell; pig income is not additional resource creation. Pig collection does not fill the backpack. Pig behavior and travel time reduce actual throughput.
- Rare-hay rewards and timed ×2 sale events affect actual earnings. Keep existing implementation semantics until measured; do not silently rewrite rarity or event logic.
- Collection needle appears after clearing the haystack under the current game rule. Prestige mechanics are not decided; do not implement reset assumptions.
- Preserve the game's integer/fractional coin accounting, especially fractional remainders in hundredths, and save migration semantics.

## 2. Tool purchase prices

| Tool | Current price | Proposed v2 price | Base portion | Time multiplier | Intended role |
|---|---:|---:|---:|---:|---|
| Hands | Free | Free | 1 | 1.00 | Starting action |
| Rake | 84 | **60** | 3 | 0.80 | Cheap start, rarity bonus |
| Pitchfork | 336 | **260** | 6 | 0.95 | Reliable mid-game, range |
| Wide pitchfork | 1,344 | **1,100** | 10 | 1.20 | High portion, slower swing |
| Vacuum | 5,376 | **4,200** | 14 | 0.90 | Late-game hold collection |

Cumulative cost of all four purchased tools: **5,620 coins**. These are one-time purchase prices, not upgrade prices. Target: most players can purchase at least three tools; vacuum is an attractive but nonmandatory choice.

## 3. Backpack upgrades

Every level adds +40 slots. Cap in v2: level 8, total 335 slots.

| Level | Purchase price | Capacity | Cumulative cost |
|---:|---:|---:|---:|
| 0 | — | 15 | 0 |
| 1 | 30 | 55 | 30 |
| 2 | 70 | 95 | 100 |
| 3 | 130 | 135 | 230 |
| 4 | 230 | 175 | 460 |
| 5 | 380 | 215 | 840 |
| 6 | 600 | 255 | 1,440 |
| 7 | 900 | 295 | 2,340 |
| 8 | 1,300 | 335 | **3,640** |

The backpack saves trips; its payback depends on measured trip distance, actual sale frequency and tool portion size. Do not describe its payback as a direct coin multiplier.

## 4. Player movement speed

Each level adds 0.65 m/s to the starting 2.6 m/s; cap level 6.

| Level | Price | Speed | Cumulative cost |
|---:|---:|---:|---:|
| 0 | — | 2.60 m/s | 0 |
| 1 | 80 | 3.25 m/s | 80 |
| 2 | 180 | 3.90 m/s | 260 |
| 3 | 350 | 4.55 m/s | 610 |
| 4 | 650 | 5.20 m/s | 1,260 |
| 5 | 1,100 | 5.85 m/s | 2,360 |
| 6 | 1,800 | 6.50 m/s | **4,160** |

## 5. Player collection speed

Each level multiplies collection time by 0.9; cap level 7. Listed times are **hand collection** times rounded for display, not measured tool throughput.

| Level | Price | Hand action time | Cumulative cost |
|---:|---:|---:|---:|
| 0 | — | 0.450 s | 0 |
| 1 | 100 | 0.405 s | 100 |
| 2 | 220 | 0.365 s | 320 |
| 3 | 450 | 0.328 s | 770 |
| 4 | 850 | 0.295 s | 1,620 |
| 5 | 1,500 | 0.266 s | 3,120 |
| 6 | 2,400 | 0.239 s | 5,520 |
| 7 | 3,600 | 0.215 s | **9,120** |

Important: this upgrade affects every tool. Check whether collection animations, input cooldowns, collision, or UI impose an additional speed ceiling.

## 6. Sale-price upgrades

Each level adds +0.25 coin per sold straw relative to base price 1.00. Cap level 5. Use existing fractional payout handling.

| Level | Price | Sale price per ordinary straw | Cumulative cost | Future straw sold to recover price* |
|---:|---:|---:|---:|---:|
| 0 | — | 1.00 | 0 | — |
| 1 | 300 | 1.25 | 300 | 1,200 |
| 2 | 500 | 1.50 | 800 | 2,000 |
| 3 | 750 | 1.75 | 1,550 | 3,000 |
| 4 | 1,100 | 2.00 | 2,650 | 4,400 |
| 5 | 1,600 | 2.25 | **4,250** | 6,400 |

*Simple break-even: `upgrade price / 0.25`; assumes future hay is sold by the player at normal price and ignores rarity, pigs, ×2 events and opportunity cost. It is **not** a prediction of when a real player will recoup the investment.

## 7. Tool portion upgrades

The prices are for each individual level, not cumulative. Tool-specific levels and caps are independent.

| Level | Rake (+1 each) | Pitchfork (+2 each) | Wide pitchfork (+3 each) | Vacuum (+4 each) |
|---:|---:|---:|---:|---:|
| 1 | 60 | 180 | 450 | 1,000 |
| 2 | 130 | 380 | 950 | 2,000 |
| 3 | 260 | 750 | 1,800 | 3,500 |
| 4 | 500 | 1,350 | 3,000 | 5,500 |
| 5 | 850 | 2,200 | 4,500 | — |

| Tool | Base portion | v2 maximum portion | Max portion-branch spend |
|---|---:|---:|---:|
| Rake | 3 | 8 | 1,800 |
| Pitchfork | 6 | 16 | 4,860 |
| Wide pitchfork | 10 | 25 | 10,700 |
| Vacuum | 14 | 30 | 12,000 |

**Correction to an earlier conversational summary:** Vacuum's +4 per level and four listed levels yield **30**, not 26. The four prices above are authoritative for this proposal.

## 8. Tool special upgrades

Cap: 3 levels per tool. Existing effects retained unless otherwise indicated. Prices are per level.

| Tool | Effect per level | L1 | L2 | L3 | Total |
|---|---|---:|---:|---:|---:|
| Rake | +15% to rarity bonus per level (additive to rarity-bonus multiplier) | 100 | 250 | 500 | 850 |
| Pitchfork | +0.25 m interaction range per level | 180 | 450 | 900 | 1,530 |
| Wide pitchfork | Action time ×0.9 per level | 400 | 950 | 1,900 | 3,250 |
| Vacuum | +0.35 m interaction range per level | 900 | 2,000 | 3,500 | 6,400 |

Retain the **existing starting range bonuses** for pitchfork (+0.25 m) and vacuum (+1.8 m). Do not mistake tool-specific range for player movement speed.

Rake rarity effect must be verified against the actual rarity formula before implementation. A possible future rare-straw highlighting feature is **not** part of v2.

## 9. Pigs: optional support economy

Sequential purchases, maximum 3 pigs.

| Pig | Proposed price | Base bite portion | Base cooldown, excluding movement |
|---|---:|---:|---:|
| #1 | 250 | 1 | 4.5 s |
| #2 | 750 | 2 | 4.0 s |
| #3 | 1,800 | 3 | 3.5 s |

Total purchase price: **2,800**. Pig walking speed and AI movement rules remain unchanged unless separately approved.

Shared upgrades apply to all owned pigs and future pigs:

| Level | Bite-size price (+1 straw per pig) | Bite-speed price (cooldown ×0.9 per level) |
|---:|---:|---:|
| 1 | 250 | 200 |
| 2 | 550 | 450 |
| 3 | 1,100 | 900 |
| 4 | 2,000 | — |
| 5 | 3,500 | — |
| Total | **7,400** | **1,550** |

**Blocking measurement:** Current pig AI reportedly wanders for at least ~3 seconds after a bite, then searches and walks to another target. This may mask cooldown upgrades. Do **not** ship bite-speed upgrade prices/effects as finalized until measured in-game; either revise AI with owner approval or change the upgrade design. Do not assume pig income is incremental profit, since pigs consume finite hay.

## 10. Economic budget and progression

Total cost to fully max the four player branches (backpack, movement, collection, sale): **21,170 coins**. All four tool purchases add **5,620**, excluding all tool-specific upgrades and pigs. This is intentionally beyond the budget for casually maxing everything in one cycle.

Existing rarity distribution, as previously documented, suggests an illustrative expected **24,280 coins** for the full 20,000-hay stack at base sale price, before sale upgrades and ×2 events; verify exact rarity probabilities and reward formulas in code. This is a theoretical expectation, not a measured session payout.

**Desired experiential milestones, subject to playtest:**

| Elapsed time | Player experience | Typical options |
|---|---|---|
| 0–5 min | Frequent, visible improvements | Rake, first backpack, movement or collection |
| 5–15 min | Meaningful alternatives | Pitchfork, backpack, early sale upgrade |
| 15–30 min | Specialization | Wide pitchfork, focused upgrades, optional first pig |
| 30–45 min | Powerful late-game choice | Vacuum OR enhanced wide pitchfork; convenience upgrades |
| 45–60 min | Clear the stack and find the needle | Finish without requiring maxed upgrades |

The milestones are **targets**, not simulation results. Target average removal throughput for a 50-minute full clear is **400 hay/min** including trips, sales and downtime. Theoretical action speeds can be much faster, so completion time must be measured and simulated rather than inferred from prices.

## 11. Economy and behavioral principles

1. Optimize for enjoyable **agency, mastery and meaningful choices**, not compulsive retention or artificial waiting.
2. No hard requirement to max upgrades or buy all pigs.
3. Avoid obviously dominated upgrades. Measure real gain from backpack, movement and range.
4. Use short early feedback loops and longer optional goals later, but avoid fabricated urgency.
5. For finite hay, evaluate **remaining resource and opportunity cost**, not only coins per minute.
6. Credit purchases and sales **atomically**. UI number-counting animations are visual only and must not delay saved balances.
7. Keep all prices and effects centralized and versioned; no scattered magic numbers.
8. Preserve old saves: no retroactive charges, refunds or silently reset levels. Higher old levels beyond v2 caps require an explicit migration policy and owner approval.
9. Keep prestige/reset and permanent upgrades out of this first-cycle balance until the owner decides what persists.
10. Compare multiple viable purchase strategies; don't tune exclusively for a single optimal path.

## 12. Metrics required before calling v2 balanced

- Total first-cycle time: median and spread across testers; target **45–60 minutes**, not guaranteed.
- Actual hay removed per minute by tool, per stage and overall.
- Actual coins earned per minute and cumulative earned/spent; rare and event contributions separated.
- Time of each purchase, upgrade level, player choice, and unspent currency.
- Seconds collecting, walking, selling, shopping and idle.
- Trips to cart, average load, average distance and time per trip.
- Actual pig bites/min, hay consumed/min, coins credited/min, time spent wandering/approaching.
- Time spent in ×2 event, hay sold during event.
- Remaining hay when sale-price upgrades are purchased; realized break-even.
- First time reaching rake, pitchfork, wide pitchfork, vacuum; proportion of players choosing each.
- Completion with/without pigs; completion with/without vacuum.
- Save/reload correctness, including fractional coins and prior high-level upgrades.

Use **local, opt-in development telemetry** initially. Do not collect personal identifiers or upload analytics without explicit approval.

## 13. Implementation gate

1. Read the actual current `balance.ts`, `progression.ts`, `rarity.ts`, `EconomySystem.ts` and relevant save migrations.
2. Compare this proposal against code; record discrepancies in `OPEN_QUESTIONS.md`.
3. Create a separate experimental config (e.g., `balance.v2.ts`) and deterministic simulator; keep the production config untouched.
4. Simulate strategies: early sale-price, fast tool rush, large backpack, wide pitchfork specialization, pig-assisted, and no-pig/no-vacuum.
5. Present time-to-purchase, payback, remaining hay, and estimated completion time; label model assumptions.
6. Ask the owner to approve changes before production activation.
7. Re-export economy documentation after approved changes with `node scripts/export-economy.mjs`, then verify saves and tests.

## 14. Open decisions for owner

- What should persist after prestige? No assumption is authorized.
- Are old saves with levels above new caps grandfathered, capped with compensation, or migrated another way?
- What are measured collection/travel/sale times on representative desktop and mobile devices?
- Should pig AI change before pig speed upgrades become purchasable?
- Is the current ×2 event actually enabled in the production build, and what are its exact timing rules?
- Should late-game vacuum be optional in practice or a near-universal choice?

Record unanswered items in `OPEN_QUESTIONS.md`; do not block unrelated safe tasks.
