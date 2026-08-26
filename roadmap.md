# Infuse: Evergrowth roadmap

This is the single index for planned work. Completed implementation history belongs in Git, not in permanent WIP specifications. Each active improvement has one focused document; update or delete that document when the item is completed.

0. [Gameplay review remarks](0-gameplay-remarks.md) — correctness and maintainability findings from the current gameplay code review.
1. [Graphics validation and performance](1-graphics.md) — finish device validation, budgets, and release evidence.
2. [Environment production](2-environment.md) — turn the accepted three-area topology and asset proofs into an authored, performant environment.
3. [Physical hand combat](3-physical-hand-combat.md) — replace whole-body attack playback with independent upper-body/hand presentation.
4. [Gameplay architecture](4-gameplay-architecture.md) — finish the headless gameplay and persistence boundary without introducing a generic ECS.

## Maintenance rule

Keep this index short. Add a numbered document only for a substantial, independently deliverable improvement. Put implementation details in code and stable engineering rules in `AGENTS.md`; do not retain completed slice prompts, asset-search diaries, or duplicate architecture plans.
