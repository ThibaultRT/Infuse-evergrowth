# Physical Hand Combat Animation — Codex Implementation Spec

## Codex task prompt

Implement the physical hand-combat animation upgrade described in this file in `ThibaultRT/Infuse-evergrowth`.

Before coding:

1. Read `AGENTS.md` completely and follow it.
2. Read the current `WIP/graphical.md`, `WIP/quaternius-assets.md`, `src/rendering/AnimatedHumanoidView.ts`, `src/rendering/HeroView.ts`, `src/rendering/WeaponVisuals.ts`, `src/systems/CombatSystem.ts`, and any current event/wiring code involved in hero attacks.
3. Treat current `main` as authoritative. Slice 10 has already been implemented; do not recreate, revert, or reintroduce obsolete Slice 10 work.
4. Preserve the existing architecture: gameplay timing/damage remains authoritative in systems/domain state; rendering only presents attacks.

Then implement the feature, run `npm run build`, inspect the diff for accidental unrelated changes, increment the package version appropriately, commit on a fresh branch from current `origin/main`, and open a PR against `main`.

## Goal

Replace the current hand-weapon presentation where the weapon swings/translates by itself while the hero's arm stays mostly static.

The two physical hand slots must look physically wielded:

- right-hand attacks visibly move the right shoulder/arm/hand and attached weapon;
- left-hand attacks visibly move the left shoulder/arm/hand and attached weapon;
- bare hands visibly punch;
- both hands remain independently schedulable and may overlap;
- locomotion continues underneath instead of stopping for every attack;
- the strike direction should visually bias toward the actual target;
- orbit weapon behavior remains unchanged.

Do **not** redesign the hero as a quadruped or convert physical hand slots into floating weapons. The intended visual identity is two physically wielded hand weapons plus two magical orbit weapons.

## Current problem

At the time this spec was written, `HeroView` drives a hand attack by changing only the weapon attachment root:

- `root.rotation.y = ...`
- `root.position.z = ...`

The weapon is attached to `hand_l` / `hand_r`, but the character arm bones are not being driven by the attack. This makes the weapon appear to swing independently of the hero.

That implementation should be replaced for physical hand attacks once the new arm animation path is working. A very small weapon-local contact/orientation correction is acceptable if useful, but it must not remain the primary source of attack motion.

## Available assets

The current Quaternius universal character rig and animation libraries are compatible and already use the same skeleton naming.

Useful UAL1 clips already available in the project include:

- `Punch_Jab`
- `Punch_Cross`
- `Sword_Attack`

Useful UAL2 clips exist too, but do **not** add or ship UAL2 solely for this feature unless inspection of current `main` shows it is already shipped or there is a compelling measured need. Prefer UAL1 first.

The hero rig exposes at least `hand_l` and `hand_r`. Inspect the actual skeleton names in the runtime asset for clavicle/upper-arm/forearm/hand chains before hardcoding filters.

## Required implementation approach

### 1. Preserve base locomotion

Idle/walk/jog must remain the base full-body motion.

Do not solve this by playing a normal full-body `Sword_Attack` or punch animation that replaces locomotion completely, because the two hands attack asynchronously and must be able to overlap.

### 2. Create independent upper-limb attack layers

Create per-hand attack animation layers or an equivalent mechanism that affects only the bones/tracks for that side's arm.

Conceptually:

```text
base animation
  -> idle / walk / jog over the whole character

right attack layer
  -> right clavicle / upper arm / forearm / hand (+ fingers if useful)

left attack layer
  -> left clavicle / upper arm / forearm / hand (+ fingers if useful)
```

The exact Three.js implementation is up to you after inspecting the current animation pipeline, but it must support:

- right hand attacking while left remains idle;
- left hand attacking while right remains idle;
- both attacking at overlapping times;
- attacks while jogging;
- independent cooldown/duration presentation matching gameplay attack events.

Prefer deriving filtered animation clips from the source clip tracks and using dedicated `AnimationAction`s / mixers or another clean Three.js animation-layer solution. Avoid ad-hoc per-frame copying of the entire skeleton unless truly necessary.

### 3. Left/right clip handling

UAL attack clips may be authored primarily for one side. Inspect actual track names and motion.

Implement the cleanest reusable strategy:

- use native left/right clips if present;
- otherwise derive a mirrored/opposite-side presentation if feasible and robust;
- if mirroring animation tracks is disproportionately complex, use a small procedural arm swing for the opposite side, but keep it tied to the arm bones rather than the weapon root.

Do not duplicate a full second character rig or weapon model merely to fake opposite-hand motion.

### 4. Weapon attachment stays on the hand

Weapons must remain children of the actual `hand_l` / `hand_r` attachment path.

The arm animation should carry the weapon naturally through space.

Keep any authored per-weapon grip orientation/offset separate from attack timing. The visual weapon object should not become gameplay authority.

### 5. Bare-hand attacks

An empty physical hand should visibly punch.

Preferred mapping for first pass:

- hand without weapon -> `Punch_Jab` / `Punch_Cross` style motion;
- sword/slash weapon -> `Sword_Attack` style motion;
- hammer/blunt weapon -> use the closest convincing existing arm swing if no hammer-specific clip exists;
- spear/piercing weapon -> use a forward/thrust-like arm motion if available, otherwise a restrained procedural forward extension until a better asset exists.

Do not change gameplay damage types, attack values, rates, equipment rules, or independent-hand scheduling just to fit the available clips.

### 6. Target-directed presentation

The hit should look directed toward the enemy instead of being a generic swing into empty space.

At minimum:

- preserve/continue the existing smooth hero facing toward combat targets;
- when the attack presentation starts, retain the target world position supplied by the gameplay event;
- during the strike/contact portion of the attack, bias the attacking arm/weapon toward that target.

Use the simplest robust solution first.

Preferred order:

1. asset animation provides the natural gross arm motion;
2. hero facing handles most horizontal target alignment;
3. add a lightweight procedural shoulder/forearm/hand correction during the strike window to improve contact direction;
4. only introduce formal two-bone IK if a simpler correction is visibly inadequate.

Any procedural correction must be rendering-only and must never change gameplay range, damage, target selection, or hit outcome.

Do not stretch limbs unnaturally to guarantee exact mesh contact. Visual plausibility is more important than mathematically touching every enemy mesh.

### 7. Attack timing

Gameplay remains authoritative.

The visual animation duration should be normalized or time-scaled to the duration/cooldown passed by the attack event where appropriate, while keeping a natural wind-up -> strike -> recovery shape.

Do not delay, cancel, or repeat gameplay damage based on an animation event.

If gameplay currently emits damage immediately while the animation visually contacts later, preserve gameplay behavior unless a clean existing event already provides a presentation timing hook. This task is primarily graphical; do not redesign combat scheduling without necessity.

### 8. Orbit weapons

Do not change orbit attack gameplay or presentation except for refactoring required to keep `HeroView` clean.

Orbit weapons should continue their autonomous outbound/return strike behavior and remain visually distinct from hand-held attacks.

## Suggested rendering architecture

Avoid putting a large amount of one-off animation code directly into `Game.ts`.

A reasonable direction is to extend the rendering animation layer with reusable concepts such as:

```text
AnimatedHumanoidView
  - base locomotion action
  - clip catalogue
  - helper to create/filter clips by bone names
  - layered/secondary actions

HeroView
  - left hand attack state
  - right hand attack state
  - attack style selection
  - target-directed procedural correction
  - weapon attachment/grip visuals
  - existing orbit presentation
```

Exact class/file structure may differ if current `main` has evolved after this spec. Follow the project's existing rendering boundaries rather than forcing these names.

Do not move combat rules into rendering.

## Attack-style selection

Keep visual attack style separate from gameplay calculations.

A small rendering-only mapping may be useful, e.g.:

```text
bare hand         -> punch
sword / slash     -> slash
hammer / blunt    -> heavy swing
spear / piercing  -> thrust
```

Use existing equipment metadata (`weaponClass`, damage type, etc.) where appropriate rather than item-ID-specific branches.

If an ideal animation is unavailable, choose the closest plausible presentation and leave the architecture ready for a later clip replacement.

## Fallback behavior

Quaternius cosmetic asset failure must continue to leave the game playable.

If the animated rig/attack clip is unavailable:

- keep the existing procedural/fallback hero usable;
- a simplified weapon/hand presentation is acceptable as fallback;
- do not throw or break combat because an animation clip is absent.

Console warnings should be informative but not spammed every frame.

## Performance constraints

Slice 10 optimization has already been completed, so preserve its improvements.

This feature must not casually undo animation LOD, mixer optimizations, asset-loading changes, material reuse, mobile safeguards, or other post-Slice-10 work present on `main`.

Avoid creating new mixers, cloned clips, vectors, or temporary animation objects every frame. Build/cache filtered clips/actions when the model becomes ready or when first needed.

The solution must remain appropriate for Safari/iPhone-class hardware.

## Non-goals

Do not in this task:

- redesign combat mechanics;
- change hand cooldowns/damage/range;
- change equipment progression;
- change save format unless unexpectedly necessary;
- redesign the hero species/body plan;
- convert hand weapons into orbit weapons;
- add root-motion gameplay;
- make animation determine hits;
- rebuild Slice 10;
- add a large generic IK/animation framework unless clearly justified by the existing codebase.

## Validation scenarios

Manually validate at least these cases in addition to `npm run build`:

1. Hero idle, empty right hand attacks: right arm visibly punches.
2. Hero idle, empty left hand attacks: left arm visibly punches.
3. One equipped hand weapon attacks: arm and weapon move together.
4. Left and right hand attacks overlap: both arms can animate without one cancelling the other.
5. Hero jogs while one hand attacks: legs/locomotion continue naturally.
6. Hero jogs while both hands overlap attacks: no full-body animation fighting/collapse.
7. Enemy is offset to the side within valid range: attack visually aims plausibly toward it.
8. Weapon remains attached correctly throughout wind-up, contact and recovery.
9. Orbit attack still behaves exactly as before.
10. Missing/failed cosmetic asset does not break gameplay.
11. No obvious arm snapping or persistent bad pose after an attack finishes.
12. Death/hit/resurrection animations still work and do not leave stale hand-attack layers active.

If browser inspection tooling is available, also inspect a mobile-sized portrait viewport and capture a screenshot/video-equivalent evidence in the PR description where practical.

## Acceptance criteria

The task is complete when:

- physical hand attacks no longer look like weapons swinging independently of static arms;
- right and left arm attacks are independently schedulable;
- overlapping dual-hand attacks work;
- locomotion remains active underneath attacks;
- empty hands visibly punch;
- equipped weapons move as part of the hand/arm chain;
- attack direction plausibly follows the actual target;
- gameplay combat timing and damage remain renderer-independent and unchanged;
- orbit attacks remain unchanged;
- post-Slice-10 performance/asset optimizations are preserved;
- cosmetic failures retain a playable fallback;
- `npm run build` succeeds;
- package version is incremented;
- PR contains only this feature and necessary supporting refactors/docs.

## Implementation notes for Codex

Use current repository code as the source of truth over any exact implementation detail in this document. If a class or API has changed since this spec was written, adapt the intent to the current architecture rather than reverting newer code.

Keep the implementation compact and maintainable. Prefer a general per-hand layered animation mechanism over special cases for the current bronze sword.

If you discover that a requested clip or bone is absent in the actual curated runtime assets, do not invent it. Inspect available clips/bones, choose the nearest robust solution, and document the substitution in the PR.
