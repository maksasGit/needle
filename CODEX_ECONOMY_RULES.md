# Proposed AGENTS.md addition — Economy and Owner Collaboration

> **Instructions for Codex:** Add the sections below to the **existing** project-root `AGENTS.md`. Do not replace or delete any existing instructions. Resolve conflicts with existing rules explicitly and ask the owner. The global collaboration rules apply to **all work**, not just economy tasks.

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
