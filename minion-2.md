# Minions v2 — independent slots, free unlock summons, and fixed replacement costs

## Goal and scope

Extend the single-minion feature specified in [minions.md](minions.md) to three **independent, persistent slots**. Add one new Soul Catcher node in progression Layer 2 and one in Layer 3. The first purchase of either node permanently unlocks its respective slot and immediately creates one minion in that slot without an additional summon charge. Move Sacrifice into each minion card and replace the escalating paid-summon formula with a fixed rarity/quantity per slot.

This is a follow-up plan, not an instruction to rewrite the original combat, equipment, reward, or infusion systems. Keep Area 1 autonomy, the single Summoning Pit, private inventories, owner-specific rewards, and the existing 50% kill-stat infusion rule unless a change below is explicit. Do not add autonomous cross-area travel or offline simulation.

## Integration preflight — required before implementation

verified main-branch constraints:
- Layer 2 already has 30 canonical nodes (SC-31–SC-60), and authored layers currently require exactly 30 canonical nodes. **Add** a new node rather than silently replacing an existing reward.
- Layer 3 currently has only registry metadata; it has no authored tree and no Epic Soul drop-unlock node. A purchasable 20-Epic slot node requires an actual source of Epic Souls first.
- The current Layer 2 entrance, SC-31, unlocks Rare Soul drops. Existing Soul Catcher progression uses typed effects, node IDs, weighted XP, per-layer adjacency, and detached UI snapshots.

## Locked gameplay decisions

| Slot | Unlock | One-time unlock price | Minion created on first unlock | Every later summon after sacrifice |
| --- | --- | --- | --- | --- |
| 1 | Existing SC-M01 / first-minion unlock | Existing 30 Uncommon Souls | 1 free minion (existing behavior) | **30 Uncommon Souls** |
| 2 | **New** Layer 2 node | **40 Rare Souls** | 1 free minion in slot 2 | **40 Rare Souls** |
| 3 | **New** Layer 3 node | **20 Epic Souls** | 1 free minion in slot 3 | **30 Epic Souls** |

The Layer 3 **unlock** price (20 Epic) and later **replacement** price (30 Epic) are deliberately different. Paid summon prices do not change with time, total summons, deaths, or the number of other minions.

Each unlocked slot is independently either occupied (including dead/respawning) or empty. A sacrifice empties **only the selected slot**, and the replacement button for that slot uses that slot's fixed price. An unlock does not fill other empty slots. Slot 3 is not implicitly dependent on purchasing slot 2: its prerequisites come from the Layer 3 progression path and Epic Soul availability, not from the other minion slot.

The free creation benefit is **once per slot for the lifetime of the save**, not once per Soul Catcher reset or node re-purchase.

## Soul Catcher node and Layer 3 design

1. Add a typed effect equivalent to **unlockMinionSlot(slotId: 2 | 3)**. Gameplay consumes a projected/evaluated effect; do not check new node IDs in the minion runtime.
2. Preserve the existing 30 regular nodes in Layer 2 and the planned 30-node format of fully authored layers. Register the two new nodes as **explicit bonus nodes** attached to their respective progression layers, with stable IDs such as **SC-MINION-02** and **SC-MINION-03**. Do not assign fake SC-61/SC-91 numbers or infer layer from numeric ID; node-to-layer membership comes from the registry. also standardize the layer 1 by renaming it **SC-MINION-01**
3. Use the standard single-level cost object with perLevel = 0. Both bonus nodes are regular Soul purchases for deduction, purchase XP, display, saving, reveal, and reset. Give each one a stable anchor/prerequisite in its own layer and a collision-free radial position:
   - Layer 2: attach to the SC-31/Rare Resonance branch so Rare Souls can actually be earned first; cost 40 Rare.
   - Layer 3: attach to its eventual Epic Soul unlock branch; cost 20 Epic. Do not expose a purchasable isolated node in an otherwise empty placeholder layer.
4. A fully authored Layer 3 must include a reachable **Epic Soul drop unlock** (for example, an entry node with the existing unlockSoulDrop effect) before the third-slot purchase can succeed. Reuse it if the implemented target branch already has it. **If Layer 3 is still unauthored, deliver the Layer 2 slot independently and treat Layer 3 authoring/Epic Soul availability as a required prerequisite for delivering slot 3.** Do not invent 29 unrelated upgrades just to fill the tree.
5. Extend Soul Catcher registration, lookup, reveal/adjacency, layer selection, UI snapshot, and node-level normalization to recognize bonus IDs. Keep validation of exactly 30 **regular** nodes on fully authored layers; validate bonus-node IDs, layers, prerequisites, positions, effects, and costs separately. Support a bonus-node registry entry in Layer 3 without incorrectly advertising an unauthored full tree as completed.
6. Bonus purchases award the normal rarity-weighted Soul Catcher XP. Include bonus-node maximum purchase XP when recalculating an authored layer's weighted maximum/next threshold; review threshold changes against existing saves and never silently relock a previously unlocked progression layer. Preserve the original first-minion unlock and its Soul Catcher reset semantics.

## State, save migration, and atomicity

Use stable slot IDs (1, 2, 3), stable minion instance IDs, and a collection of minions. Each SavedMinion must belong to exactly one slot. Prefer a keyed, permanent **unlockedSlots** state (or an equivalent one-time grant ledger) because minion unlocks survive Soul Catcher reset while node levels and XP do not. Slot 1 maps to the previously implemented initial grant; existing first-minion saves must migrate into slot 1 without generating a new Imp. Slot 2 and 3 initially remain locked for old saves unless an existing save already proves those grants.

Important invariants:
- At most one minion per slot; at most three occupied slots; never discard a valid minion from another slot on a summon, death, or sacrifice.
- Dead/respawning minions still occupy their own slots and may be sacrificed, but may not be summoned over.
- Unlock purchase deducts the node price, records node/XP and the permanent slot unlock, generates one free minion **in one authoritative transaction**, and emits the normal purchase plus a slot-unlocked/minion-summoned presentation event. Failed purchases change nothing. Repeated commands, save reloads, and reset/re-purchase never duplicate a free grant.
- After Soul Catcher reset, unlocked minion slots and their occupants remain. Re-purchasing an already-granted node may follow normal Soul Catcher cost/XP rules but **must not** create another free minion, even if the slot is currently empty.
- Remove the tenfold paid-summon formula from active rules. An old paidSummonCount, if present, may be read for migration but must not influence any new price. Define the three fixed prices centrally in balance data and compute costs using the requested slot ID.
- Version and migrate the save according to AGENTS.md. Preserve valid old minion color, private stats, private inventory, respawn deadline, contribution totals, hero infusion and all other progression. Handle corrupt/duplicate slot assignments deterministically without deleting unrelated valid state. Do not persist scene objects, AI targets, or renderer state.

## Commands and systems

Replace roster-wide assumptions with slot- or minion-targeted operations:

~~~ts
{ type: 'summonMinion', slotId: 1 | 2 | 3 }
{ type: 'sacrificeMinion', minionId: string }
~~~

Keep commands atomic and authoritative in MinionSystem/its existing equivalent. Summoning requires an unlocked **empty** slot and its exact fixed Soul balance; it deducts only that slot's price, creates a fresh minion with a new stable instance ID/color, and persists once. An insufficient balance, locked slot, occupied slot, or duplicate command must leave state unchanged. If a specific free grant is being created from a Soul node purchase, do not route it through the paid-summon deduction.

Sacrifice targets the selected stable minion ID, including a dead/respawning minion. Retain the original 50% infusion and full equipment-copy reconciliation, but calculate and transfer **only that minion's** eligible earned stats and private equipment. Remove only that member; cancel only its timers/runtime/view; free only its slot; keep all other minions' HP, targets, cooldowns, progression, inventory, and Soul-contribution history intact. Souls credited globally when earned must **not be credited again** at sacrifice. Repeated confirmations or delayed events must not transfer twice. Emit a targeted sacrifice/infusion result containing the selected minion ID, slot ID, and actual transferred values.

Audit existing autonomous systems for hidden singleton assumptions: each minion has its own AI mode, navigation/path, recovery/respawn deadline, movement, attack timers, and independently equipped held/orbit weapons. Reuse the same Area 1 collision/walk-surface data. Spawn multiple minions near the shared Summoning Pit with small deterministic, navigable formation offsets to avoid exact visual overlap; no extra world landmark is required. Enemy target references and defeat ownership must remain stable by minion ID. A simultaneous lethal attempt by the hero or multiple minions still causes exactly one defeat, one reward owner, and one set of global consequences.

## Management UI

The existing Summoning Pit world button continues to open a single non-pausing management sheet. Make the collection view represent **three stable slot positions**, including an empty/locked state, instead of assuming an undifferentiated list. Show each active minion's existing compact HP/stats, private equipment, Soul contributions, and death/respawn countdown.

- Put a **Sacrifice** button within **each occupied minion card**. Remove the bottom roster-wide sacrifice button. Confirmation identifies the selected minion/color/slot and previews the selected member's irreversible infusion/equipment transfer, not the whole roster.
- Put an independent **Summon** action with the fixed, rarity-labeled price in each **unlocked empty** slot card (or an explicit slot-specific selection in the existing top-right control). Do not offer a paid summon into an occupied/dead slot. Clearly distinguish the one-time free minion from the node's purchase price.
- Locked slot cards may show the required layer/node and its unlock price, but the purchase itself stays in the Soul Catcher. Layer 3's unavailable content must show a clear prerequisite, not a misleading affordable action.
- One sacrifice or summon re-renders affected cards and shared hero totals without resetting the other cards' selection, timers, or expanded state. Use the existing detached progression snapshot and coalesced events, not per-frame DOM rebuilds. Support 390 × 844 portrait with a scrollable sheet, 44 px touch controls, and accessible icon labels.

## Implementation sequence

1. **Rebase and reconcile.** Inspect the actual minions.md implementation branch. Identify the active minion modules, migration/version, existing typed unlocks, reset policy, summon/sacrifice command, and multi-minion readiness. Do not implement against the remote main snapshot until the original feature is available there or a fresh branch is created from the actual implementation base.
2. **Author data/domain.** Add the slot table, fixed summon costs, typed slot-unlock effect, bonus-node registry and pure cost/occupancy/grant rules. Attach Layer 2's bonus node to Rare Resonance and validate existing 30-node content. Avoid broad refactoring of Soul Catcher or adding an ECS.
3. **Migrate persistence.** Add permanent slot unlocks and per-minion slot identity with normalization, old-save migration, new version/key and reset/re-purchase safeguards.
4. **Implement atomic operations.** Introduce targeted summon and sacrifice commands; grant the unlock's free minion within the Soul purchase transaction. Remove all active exponential pricing and roster-wide sacrifice side effects.
5. **Enable concurrent runtime.** Audit AI, enemy targeting, drop ownership, independent combat/death/respawn, spawn formation, effects and Three.js/DOM view disposal for up to three simultaneous minions.
6. **Update UI/events.** Show stable slot cards, per-card Sacrifice and empty-slot Summon costs, confirmation, targeted refresh, and accessible mobile layout.
7. **Complete Layer 3 prerequisite.** Against the integrated target branch, verify or separately author the Layer 3 path and Epic Soul-drop unlock. Then register/attach the third-slot bonus node and validate its 20-Epic unlock/30-Epic replacement distinction. If Layer 3 content is not approved yet, ship the Layer 2 slice without pretending the third slot can be purchased.
8. **Validate and release.** Run focused deterministic validators first, then npm run build and the affected Soul Catcher/save/world checks; run npm run validate:release when the complete delivery slice is ready. Review git diff/status, bump package version for shipped gameplay, and commit on the correct current feature branch. Documentation-only changes need no version bump.

## Deterministic validation and acceptance

Cover, at minimum:

- Old single-minion save migrates into slot 1 with no stat, inventory, color, HP, contribution, respawn, or hero-progression loss; initial unlock remains idempotent.
- Layer 2 bonus node costs 40 Rare, is revealed only through its intended progression, awards normal XP, and atomically adds **one free slot-2 minion** without charging another 40 Rare.
- When the Layer 3/Epic prerequisite is present, the Layer 3 bonus node costs 20 Epic and atomically adds **one free slot-3 minion**; it cannot be bought before Epic Souls are obtainable and progression prerequisites are met.
- After sacrificing each slot repeatedly, paid summons cost **30 Uncommon / 40 Rare / 30 Epic every time**. Former summon counts of 0, 1, 5, and very large values have no price effect. Locked/occupied/dead slots and insufficient funds fail without any state mutation.
- Sacrifice slot 2 while slots 1 and 3 are active or respawning: only slot 2 disappears and infuses its own 50% eligible stat gains/equipment copies; no double Soul payout; slot 1 and 3 keep their AI, inventory, health, timers, kills, and colors. Repeat for each slot and repeated confirmation/reload.
- Purchase/reset/re-purchase/reload of either bonus node cannot create extra free minions, even when the originally granted minion has already been sacrificed. Existing permanent slots remain available after Soul Catcher reset.
- Multiple simultaneous minions can seek, path, attack, auto-equip, take damage, die and respawn independently. Competing lethal hits produce exactly one owner, one reward delivery, and one world defeat.
- Bonus nodes do not replace any canonical nodes or invalidate their IDs/reveal links; global node-ID normalization accepts bonus IDs; Layer 2 weighted XP and migration preserve already-unlocked progression; unavailable Layer 3 is represented honestly.
- On an iPhone-size viewport, three cards are usable without overlapping actions, confirm text names the targeted minion, icons have accessible labels, and the single Summoning Pit remains playable with Full/Reduced graphics.

Manual handoff: check the three distinct minions around the pit, mobile card readability, navigation around Area 1 blockers, independent combat/recovery, isolated sacrifice, fixed replacement cost, and save/reload on a real phone.
