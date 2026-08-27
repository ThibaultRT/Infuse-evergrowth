# 3 — Physical hand combat

## Outcome

Make each equipped hand read as an independent physical attack without interrupting locomotion or changing combat timing/rules.

## Plan

- Preserve the base locomotion mixer and layer masked upper-limb actions per hand.
- Derive right/left actions safely from compatible clips or mirrored rig tracks; never mutate shared source clips.
- Keep weapons attached to their hand bones through the full action and orient presentation toward the selected target.
- Trigger visuals from the existing `weaponAttacked` event. Damage remains immediate/system-owned unless a separately approved gameplay change introduces hit timing.
- Keep orbit sources visually distinct; do not force hand animation for orbit attacks.
- Cache clips/actions and avoid per-attack mixer, clip, material, or geometry allocation.
- Fall back to the current readable attack presentation if the rig or clip is unavailable.

## Acceptance

Walking continues during held-weapon attacks; held and orbit cooldowns remain independent; the held attack affects the correct limb and weapon; rapid attacks blend cleanly; death/resurrection clears layered actions; all weapon classes, three orbit slots, and mobile performance are validated.
