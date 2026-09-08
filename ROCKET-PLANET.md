# Rocket landing experiment: planet compatibility

Keep this as a separate page/project with its own flight state, controls and physics. The first handoff is this contract; no rocket game is integrated into Stalheart yet.

## Recreate the main game's planet

Use the pinned files listed in `docs/kernel-provenance.json`: `src/grid.js`, `sample.js`, `hull.js`, `vec3.js`, `rng.js`, `cellindex.js` and `dungeon.js`. Copy them together without changing their algorithms; retain their relative ESM imports and provenance. Use the same sole `vendor/three.module.js` (r160) for rendering.

```js
import { generateSphereMesh, relax } from './src/grid.js';
import { generateDungeon } from './src/dungeon.js';
const mesh = generateSphereMesh({ seed: 7, n: 500, k: 12 });
relax(mesh, { n_iters: 80, PULL_RATE: 0.25 });
const dungeon = generateDungeon(mesh, {
  seed: 7, rooms: 16, roomRadius: 4,
  extraCorridors: 8, corridorWidth: 1,
});
// mesh.vertices, mesh.quads, mesh.defaultSide;
// dungeon.graph.centers, dungeon.tags, dungeon.heart.
```

Sanity check for this exact recipe: **2,238 vertices, 2,236 quads/cells, heart cell 700**, and `mesh.defaultSide ≈ 0.07496681023037927`.

The main game uses an origin-centred **unit sphere**; height is radial, not global Y. Surface position = normalized direction × (1 + altitude). Its default wall height is 0.03. `src/td-tab.js` → `regenerate` and `buildGeometry` own the current world assembly, including sector sealing and special chambers; the snippet recreates the underlying grid/dungeon, not those gameplay modifications. Do not import that controller into the experiment.

For the visual identity, reuse `src/looks.js` → `LOOKS.tronColors`: dark opaque floors/walls, luminous edges and seeded accent zones. `LOOKS.battlezone` supplies the green variant. Plain sphere wireframe is not the organic quad grid. The Sinkhole Lab uses the same kernel at reduced density and a different presentation scale; it is not the exact main-game topology.

## Keep a future integration simple

- Store rocket position/velocity in one explicit coordinate frame. Gravity points toward the planet centre. Local up is `normalize(position)`; derive a stable tangent basis with `vec3.js` for heading and landing tilt.
- Ground distance is `R * acos(clamp(dot(a,b), -1, 1))` for normalized directions. Use sphere arcs for landing-pad distances; collision also needs altitude and the target cell's surface height.
- Assets use metres, +Y up and +Z forward. Preserve animated pivots. Convert at the adapter boundary: `src/core/stage-units.js` currently maps **10 authoring metres per cell**, with `mesh.defaultSide` as the unit-sphere cell scale. The game's 4,800 m fiction scale is a separate presentation convention, not this conversion.
- Put flight/landing rules in a pure module, with a fixed simulation step and explicit inputs. Keep rendering, audio and input adapters separate; visual model ticks take absolute time. Landing can emit `{ cellId, position, speed, tilt, success }` without knowing the TD controller.
- Keep seed, kernel revision, radius and units in the experiment configuration. Own and dispose its renderer/resources; avoid the game's saved progress keys. Later integration should attach an adapter to the same planet, not regenerate it with a different seed or resolution.

Verify matching vertex/quad counts and coordinates with the same seed, arc distances at multiple latitudes, radial landing normals, and identical flight outcomes at 30/60/144 Hz before integration.
