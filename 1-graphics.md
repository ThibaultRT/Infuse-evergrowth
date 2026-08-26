# 1 — Graphics validation and performance

## Outcome

Ship the implemented graphical stack with measured evidence on the minimum target: iPhone 12 portrait at 390×844 CSS pixels.

## Remaining work

- Record cold-load time, downloaded payload, frame pacing, draw calls, triangles, textures, and active mixers in Full/Smooth, Full/30 FPS, Reduced/Smooth, and Reduced/30 FPS modes.
- Validate combat crowds, both area crossings, gate cinematics, death/resurrection, equipment/inventory, rotation/resize, background/foreground recovery, offline launch, and cosmetic asset failure.
- Profile only after measurement; prioritize shared materials/geometries, fewer transparent layers, reduced mixer/DOM work, frustum culling, and safe pixel-ratio/frame caps.
- Keep Full DPR capped at 2 and Reduced at 70% of that value. Preserve saved quality choices and the development statistics toggle.
- Meet the <=20 second representative initial-load target and <500 MB absolute payload ceiling, while aiming materially lower.

## Completion evidence

A release-validation record names device/browser/network conditions, contains before/after measurements, and notes any accepted limitation. Desktop emulation alone is insufficient.
