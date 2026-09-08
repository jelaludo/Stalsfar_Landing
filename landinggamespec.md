# SPEC — "Ten Down" · reusable-booster landing intro
Planet Name : stålsfär
Main game : stålheart

We will create a PoC of a landing game using assets from https://jelaludo.github.io/SentryTowers_A6/launchpad/
Specifically the Rocket without the launcher.
Landing at least 5/6 correctly allows to rebuild the launcher with the drone from Stalwart.
Retrovibe gameplay of lunar lander 1979, modernized. 

https://github.com/kai-denrei/stalheart/blob/main/docs/ROCKET-PLANET.md
https://kai-denrei.github.io/stalheart/



## Intent

A 60–150 second **intro sequence** for another game. 6 or 10 reusable entry boosters come down fast
on one persistent landing site. The player flies each one manually. Every booster that lands
intact is **starting resources** for the game that follows; every booster that doesn't is a wreck
that occupies the ground and makes the remaining entries harder.

The verb is not "descend slowly". The verb is **read the ground and commit** — pick a landing
spot in the first second or two of each entry, then fly a legible physics problem to it under
time and fuel pressure. Every crash must be diagnosable from the instruments: the player has to
be able to say *"too much sink"*, *"drifting"*, *"tilted"*, *"out of propellant"*, or
*"that shelf was sloped"* — never *"the game decided"*.

2D side view. The rocket art is baked from existing 3D assets into flat sprites (see **Asset
pipeline**); nothing renders in 3D at runtime.

## How to use this document

You are building the whole thing from this spec. Read it end to end before writing code.

- Follow **Build order**. Each step must run in a browser before the next one starts.
- Everything named in **CONFIG** is a tunable constant in one literal at the top of the module.
  Nothing tunable is hidden in logic. Nothing structural in **Architecture** becomes tunable.
- Numbers in this spec are *starting values with a rationale*, not sacred. If a value fights the
  feel described next to it, change it and note the change in a comment on that field.
- When this spec and "what feels right when you play it" disagree, playtest wins — but say so in
  the commit message rather than silently drifting.
- Do not add a build step, a bundler, npm, or a runtime dependency. If you think you need one,
  stop and ask.

## Constraints

- Vanilla ES modules, **Canvas2D**, no build step, no npm, **zero runtime dependencies**.
- Drops into the existing GitHub Pages site: served over plain HTTP from the repo, no server code.
- 60 fps at 1080p with DPR capped at 2. The whole simulation is a few dozen bodies; there is no
  excuse for frame drops.
- Fixed-timestep physics (see **Flight model**) so a laggy frame never changes the outcome of a
  landing. Rendering interpolates.
- Deterministic: the same seed produces the same terrain, the same entry sequence, the same wind.
  A landing outcome is a pure function of (seed, player input timeline).
- Fully playable with **keyboard alone** and with **touch alone**.
- `prefers-reduced-motion`: no screen shake, no dust plumes, no zoom ramp — the sim still runs.
- Skippable at any time (`Esc` / on-screen skip), which hands the host game a defined
  "skipped" payload (see **Handoff API**).
- No text/PII in code, comments, or metadata.

## File layout

```
landing/
  lander.js        the entire game, one ES module, exports runLandingIntro()
  index.html       thin harness: full-page canvas, imports lander.js, dumps the payload
  assets/
    booster.png       side view, legs stowed, engine cold
    booster-legs.png  side view, legs deployed
    booster-dead.png  scorched/dented variant for wrecks
    atlas.json        frame rects + the pivot point of each sprite, in pixels
  bake/
    bake.mjs       offline: 3D asset -> the PNGs above. Never runs in the browser.
```

`lander.js` has no side effects on import — no DOM writes, no listeners, no audio — until
`runLandingIntro()` is called. It must be safe for the host game to import at boot and run later.

## Asset pipeline (3D → 2D)

The rocket exists as a 3D asset; the game does not. Bake once, offline, commit the PNGs.

`bake/bake.mjs` is a Node script (three.js pulled in ad hoc there is fine — it is not shipped)
that loads the model, points a **orthographic** camera at it broadside, and renders:

- `booster.png` — legs stowed, 512 px tall, transparent background.
- `booster-legs.png` — legs deployed, same camera, same canvas, **same pivot**.
- `booster-dead.png` — the stowed render with a burn/dent pass, or hand-edited from it.

Rules:

- One camera, one canvas size, one pivot for all three. The sprites must be swappable mid-frame
  with no visual jump.
- The **pivot is the vehicle's center of mass**, not the image center. Write it into
  `atlas.json` in pixels. Runtime rotation is `ctx.rotate` about that pivot — do **not** bake
  rotation frames; in-plane rotation is free on canvas.
- Bake at 2× the largest on-screen size (the final-approach zoom), so it never softens.
- Establish `CONFIG.render.pxPerMeter` from the sprite: the booster is
  `CONFIG.vehicle.height` meters tall and `atlas.booster.h` pixels tall at zoom 1.

**Fallback is mandatory.** If the atlas fails to load, the game draws a vector booster (a capsule
body, a nozzle triangle, four leg strokes, a flame polygon) and plays identically. Build the
vector path *first*, in step 1 of the build order; the sprites are a skin over a game that already
works without them.

## Architecture (fixed — do not make configurable)

Five modules inside the one file, in dependency order. Each is a plain factory returning state +
`step(dt)` / `draw(ctx)`. No classes with inheritance, no event bus, no globals.

1. **rng** — seeded PRNG (mulberry32 or sfc32, ~10 lines) + `value noise 1D`. Every random draw
   in the game comes from here. `Math.random` appears nowhere.
2. **terrain** — a persistent 1D heightfield for the whole run, plus the pad list, plus the
   occupancy state that landings and wrecks write back into.
3. **vehicle** — one booster's rigid state and its integrator. Ten of these across a run, one
   live at a time.
4. **director** — the run: the entry queue, the mission clock, per-entry difficulty, the
   scoring ledger, and the transitions between entries.
5. **view** — camera, parallax sky, HUD, dust, and the draw order. The view reads state; it never
   writes it.

The terrain outlives the vehicles. That is the spine of the design: *the site fills up as you
play.*

## The run: ten entries, one site

- One terrain, generated once per run from the seed. It never regenerates between entries.
- Ten boosters arrive **on a cadence**, not on the player's schedule. `CONFIG.queue.interval`
  seconds after entry *n* becomes controllable, entry *n+1* lights its entry burn — visible as a
  streak high in the sky with a countdown chip on the HUD edge.
- The player flies **one booster at a time**: whichever is lowest. Control hands over the instant
  the previous one resolves (touchdown, wreck, or out of frame).
- **Dawdling costs the next rocket, not this one.** Any time entry *n* is still airborne when
  entry *n+1* is due, *n+1* burns propellant holding: it arrives with
  `fuel -= CONFIG.queue.holdBurn * overlapSeconds`, floored at `CONFIG.queue.minFuel`. Show this
  on the queue chip as a draining bar the moment the overlap starts. This is the entire time
  pressure mechanism — there is no round timer, no artificial countdown.
- A landed booster **stands where it landed** and occupies that ground for the rest of the run.
  So does a wreck, plus a debris field `CONFIG.wreck.debrisWidth` meters wide that no later
  booster can land on.
- Consequence: the good pads get used up. Entry 8 is hard because entries 1–7 took the easy
  ground, not because a difficulty number went up. Scripted ramp (below) is a garnish on top of
  this, not the main course.

The run ends when the tenth booster resolves. Total wall clock at competent play: ~100 s.

## Terrain and pads

Heightfield over `CONFIG.terrain.width` meters, sampled every `CONFIG.terrain.step` meters,
linearly interpolated between samples (slope is therefore piecewise constant and cheap to query).

```
h(x) = base
     + ridge   * ridged(fbm1(x * f1))        // big landforms
     + detail  * fbm1(x * f2)                // boulders, rim texture
```

Then pads are stamped in: for each pad, flatten the samples across its width to the median height
and mark those samples `padId`. Stamping *after* generation guarantees a pad is actually flat,
which the noise cannot.

Pad tiers (`CONFIG.terrain.pads` is a list of these, placed at seeded x positions with a minimum
separation):

| Tier | Width | Score × | Character |
|---|---|---|---|
| `barge` | 60 m | 1.0 | Wide, obvious, central. The safe answer. |
| `apron` | 30 m | 1.6 | Medium, off to one side — costs lateral translation. |
| `bullseye` | 14 m | 2.5 | Narrow, usually on high ground or a crater rim. |
| `shelf` | 34 m | 1.4 | **Reads flat at wide zoom, is sloped 9–13°.** Only the slope readout gives it away. |
| `dusty` | 40 m | 1.8 | Fine regolith: below 40 m the plume hides the ground. Commit early or go around. |

Six to eight pads for ten boosters. **Unprepared ground is always a legal target** if the slope
under the footprint is within tolerance — it just scores `CONFIG.score.roughMultiplier` (0.5).
There is always somewhere to go; it just gets worse. Never generate a run that is unwinnable.

The `shelf` is the one deliberately deceptive element and it is fair: the slope number is on the
HUD from the moment the pad is designated, and the pad chevrons render at the true slope angle
once the camera is past zoom 2. It punishes not looking, never bad luck.

## The core verb: designate before you burn

Each entry starts with the booster high, fast, and small on screen, with the whole site visible.

- Every candidate pad shows a **chip**: tier glyph, width, slope, and a **feasibility light**.
- Feasibility is computed continuously for each pad from current state, and it is the honest
  answer to *"can I still make that one?"*:

```
dvBrake = max(0, vSink - vTouch) + gravity * tFall     // kill the fall
dvLateral = 2 * sqrt(|padX - x| * aLateral)            // accelerate-then-null a translation
dvNeeded = dvBrake + dvLateral + CONFIG.hud.dvMargin
light = dvNeeded < dvAvailable * 0.75 ? green
      : dvNeeded < dvAvailable * 1.00 ? amber
      : red
```

where `aLateral = maxThrustAccel * sin(CONFIG.hud.planTilt)` and
`dvAvailable = maxThrustAccel * fuel / burnRate`.

- The player designates with `1`–`9`, `Tab` to cycle, or a tap/click on the chip. The designated
  pad gets a target bracket in world space, a distance readout, and its chevrons.
- Designating is **free and re-designatable at any time** — the cost of a bad read is paid in
  propellant, which is the only currency this game has. Never block a re-designation, never
  penalize it directly.
- Undesignated flying is allowed. The HUD then shows terrain slope under the predicted impact
  point instead, so an improviser is informed, just less so.

That is the whole "identify a proper landing spot" loop: chips give you the facts, the feasibility
light gives you the deadline, the propellant gauge gives you the consequence.

## Flight model

State per booster: `x, y, vx, vy, angle, angVel, fuel, throttle, legs, alive`.
`y` is meters above datum, up positive. `angle` is radians from vertical, positive clockwise.

**Integrator: semi-implicit Euler at a fixed `CONFIG.sim.dt` (1/120 s)**, accumulator-driven, with
a max of `CONFIG.sim.maxSteps` catch-up steps per frame. Render interpolates between the last two
physics states. Landing detection runs inside the physics step, never in the render frame.

```
thrustAccel = maxThrustAccel * throttleActual        // spooled, see below
ax = -sin(angle) * thrustAccel + wind(t) * dragCoef
ay =  cos(angle) * thrustAccel - gravity - dragCoef * vy * |vy|
angAcc = torqueInput * torqueAccel - angVel * angDamp
fuel  -= burnRate * throttleActual * dt
```

Notes that matter for feel:

- **Thrust is a vector the player aims.** Translating sideways requires tilting, which costs
  vertical authority. That coupling is the game.
- **Spool.** `throttleActual` chases `throttleInput` at `CONFIG.vehicle.spoolRate` per second
  (≈ 4/s, i.e. ~250 ms to full). No instant perfect braking. Also enforce
  `CONFIG.vehicle.minThrottle` (0.35) while lit: a real engine cannot idle at 3%, and the floor
  is what makes the suicide burn a *decision* rather than a hover.
- **Fuel is finite and the gauge is the tension.** `burnRate` at full throttle drains the tank in
  ~13 s. A textbook entry costs ~8 s of burn.
- **Drag** is thin-atmosphere: small, quadratic, and mostly there so terminal velocity exists and
  wind can push the booster.
- **Wind** is `windBase + windGust * fbm1(t * gustFreq)` — a smooth signed lateral acceleration.
  Show it as an arrow on the HUD; it must never be a surprise.
- **Legs.** Deploy with `L` (or auto below `CONFIG.vehicle.autoLegsAlt` if the assist is on).
  Deployment takes `legDeployTime` (0.6 s) and adds drag. **Landing without legs is a wreck**,
  no exceptions, and the HUD nags below 200 m.

## Touchdown evaluation

The moment either leg contact point crosses the terrain, freeze the state and grade it. Contact
points are `(±legHalfWidth, -legHeight)` in body space, rotated by `angle`.

| Reading | Perfect | Hard | Fail |
|---|---|---|---|
| Sink rate `-vy` | ≤ 2.5 m/s | ≤ 6 m/s | > 6 m/s |
| Lateral `|vx|` | ≤ 1.5 m/s | ≤ 4 m/s | > 4 m/s |
| Tilt `|angle|` | ≤ 4° | ≤ 11° | > 11° |
| Ground slope under footprint | ≤ 5° | ≤ 9° | > 9° |
| Legs | deployed | deployed | stowed → wreck |

Outcome is the **worst** column any reading lands in:

- **Perfect** → booster intact, full payout, it stands on the pad, reusable.
- **Hard** → booster survives on a bent leg: payout × `CONFIG.score.hardMultiplier` (0.55), it
  still occupies the ground, and it lists visibly at a few degrees. Not reusable.
- **Fail** → wreck. Salvage payout only (`CONFIG.score.salvage`), crew lost, debris field stamped
  into the terrain, that pad is gone for the rest of the run.

Tipover is a post-touchdown check, not a separate rule: if the contact leaves the center of mass
outside the support polygon (the two contact points), it topples over ~1 s and becomes a wreck.
This is why a nominal-speed landing on a 12° slope still fails, and why that reads as *fair*.

**Every resolution prints its own verdict**: one line naming the reading that decided it, with the
number and the threshold — `SINK 8.4 m/s · LIMIT 6.0`. This line is the single most important
piece of UI in the game. Build it in step 3, not at the end.

## Instruments

Minimal, always-on, positioned so the eye can take all of it in one saccade with the booster.

- **Vertical speed tape** — vertical, next to the booster, with the perfect/hard bands drawn as
  colored zones. The needle sitting in the green band *is* the win condition, made visible.
- **Lateral speed** — horizontal, same treatment, centered on zero.
- **Altitude AGL** — terrain-relative, not datum-relative. Radar-altimeter callouts at 500 / 200 /
  100 / 50 / 20 / 10 m.
- **Fuel** — a bar plus **seconds of full throttle remaining**, which is the number a pilot
  actually needs.
- **Retrograde marker** — where to point to null the velocity vector. With spool and gravity, "nose
  on retrograde" is close enough to correct that beginners survive on it alone.
- **Predicted impact point** — ballistic, integrated forward with current throttle held, drawn on
  the terrain. Cheap: reuse the physics step, 2 s of lookahead at a coarse dt.
- **Slope readout** under the designated pad (or under the predicted impact point).
- **Queue chips** — the remaining boosters, their ETA, and the propellant drain when an overlap
  starts.

Instruments never lie and never degrade, even when the dust plume hides the ground. The dust
takes the *view*; the numbers stay honest. That's the difference between tense and arbitrary.

## Scoring and payout

Per landing:

```
payout = base * padMultiplier * outcomeMultiplier + leftoverPropellant * CONFIG.score.fuelToResource
```

Payout is a resource bundle the host game consumes:

| Resource | Where it comes from |
|---|---|
| `propellant` | Base payout + everything left in the tank. Efficiency pays directly. |
| `alloy` | Base payout, reduced on hard landings, salvage-only on wrecks. |
| `crew` | 1 per intact landing, 1 per hard landing, 0 on a wreck. |
| `credits` | Pad multiplier × outcome — the "did you take the risky pad" currency. |

Run-level bonuses, applied once at the end:

- `perfectStreak` — consecutive perfect landings, escalating.
- `allTen` — all ten survive (perfect or hard).
- `siteEfficiency` — fraction of the site's total pad multiplier the player actually claimed. This
  is what rewards *planning across the ten*: taking the bullseye early, while it's still free, beats
  taking the barge ten times.

Grade the run S/A/B/C/D from total credits against `CONFIG.score.gradeBands`, and show a one-screen
summary: ten rows, each with its pad, verdict line, and payout, then the totals. The player should
leave able to name the one landing that cost them the grade.

## Difficulty ramp

The site filling up does most of the work. On top of that, per entry index (0-based):

| Entry | Entry alt | Entry speed | Fuel | Added condition |
|---|---|---|---|---|
| 0 | 700 m | 40 m/s | 110 | none — this one teaches |
| 1 | 800 m | 55 m/s | 105 | none |
| 2 | 850 m | 65 m/s | 100 | light wind |
| 3 | 900 m | 70 m/s | 100 | light wind |
| 4 | 900 m | 75 m/s | 95 | gusts |
| 5 | 950 m | 80 m/s | 90 | gusts + entry tilt |
| 6 | 1000 m | 85 m/s | 88 | entry tilt |
| 7 | 1000 m | 90 m/s | 85 | gusts + entry tilt |
| 8 | 1050 m | 92 m/s | 80 | strong gusts |
| 9 | 1100 m | 95 m/s | 78 | strong gusts + entry tilt |

"Entry tilt" means the booster arrives rotated `CONFIG.entry.tiltMax` off vertical with some
angular rate — the first job is to stop the tumble, which costs altitude. Never randomize the
*direction* of entry tilt so hard that recovery is impossible: cap `angVel` at
`CONFIG.entry.angVelMax` and always tilt toward the site, not away.

Difficulty is a table in CONFIG (`CONFIG.entries`), not a formula. Ten hand-tuned rows beat a
curve every time.

## Camera and presentation

- Follow the live booster; lead the camera slightly along the velocity vector.
- **Zoom is the phase indicator.** `zoom = lerp(wide, close, 1 - clamp(altAGL / zoomStartAlt))`,
  eased. At entry the whole site is visible and the pad chips are readable — that's the
  *identify* phase. Below ~120 m the view is close and the terrain texture resolves — that's the
  *fly it* phase. Under reduced-motion, hold a single mid zoom.
- Palette continues the site's existing look: near-black ground (`#050807`), dim teal terrain
  (`#1d4d44`), amber for anything hot — flame, alerts, the designated bracket (`#ffe9a3`).
  Landed boosters go dim teal; wrecks go rust.
- Effects, all cheap and all off under reduced motion: engine flame (throttle-scaled, jittered),
  dust plume below 40 m over `dusty` pads, ground shadow, touchdown thump (2–3 px shake, 150 ms),
  contrail streaks for queued entries.
- Silhouette first: the booster must be legible against terrain at every zoom. If the sprite and
  the ground share a value, put a subtle rim light on the booster, not a glow on everything.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Throttle | `W` / `↑` hold; `Shift` = full | Right thumb pad, vertical drag = throttle |
| Rotate | `A` `D` / `←` `→` | Left thumb pad, horizontal drag |
| Deploy legs | `L` | Button |
| Designate pad | `1`–`9`, `Tab` cycles | Tap the chip |
| Pause | `Space` | Button |
| Skip intro | `Esc` (confirm) | Button |
| Debug HUD | `H` | — |

Analog feel from digital keys comes from spool plus angular damping, not from key repeat. Gamepad
is a stretch goal; if added, right trigger is throttle and left stick is rotation, and both go
through the same input struct so the physics never knows the difference.

## Assists and accessibility

All default **on** for the first entry and individually toggleable in a corner panel; the HUD
shows which are active, and the run summary records them.

- `predictor` — the impact marker (on by default; expert play turns it off for a score bonus).
- `stabilityHold` — bleeds `angVel` toward zero when no rotation input is held.
- `autoOrient` — points at retrograde on a tap.
- `autoLegs` — deploys legs at 200 m.
- `slowMo` — final 10 m at 0.6× time. Costs nothing but the leaderboard.

Plus: full keyboard operation, focus-visible controls, `aria-live` on the verdict line and the
altimeter callouts, no reliance on color alone (every feasibility light also has a glyph:
✓ / ! / ✕), and a `CONFIG.a11y.highContrast` palette swap.

## Handoff API

```js
import { runLandingIntro } from './landing/lander.js';

const result = await runLandingIntro(canvas, {
  seed: 20260907,          // number | string; same seed = same run
  entries: 10,             // 1..10, for testing
  assists: { predictor: true },
  onEntryResolved: (r) => {},   // optional, fired per booster
});
```

Resolves with:

```js
{
  status: 'completed' | 'skipped',       // never rejects; skipped yields the default bundle
  seed, durationMs, grade: 'S'|'A'|'B'|'C'|'D',
  resources: { propellant, alloy, crew, credits },
  landings: [ { index, padId, padTier, outcome, sink, lateral, tilt, slope,
                fuelLeft, payout, verdict } ],
  bonuses: { perfectStreak, allTen, siteEfficiency },
  assistsUsed: [ ... ],
}
```

Contract:

- `runLandingIntro` always resolves — a thrown internal error resolves as `status: 'skipped'` with
  the default bundle, because an intro sequence must never be able to block the game behind it.
- It cleans up after itself: every listener removed, `rAF` cancelled, canvas left clear.
- `status: 'skipped'` returns `CONFIG.score.skipBundle` — deliberately modest, never zero. Skipping
  must be a real option, not a punishment.
- Calling it twice concurrently on the same canvas throws immediately. That is a programming
  error, not a runtime condition.

## CONFIG — the tuning surface

One literal at the top of `lander.js`. Comment every field with its range and what it changes.

```js
const CONFIG = {
  sim: {
    dt: 1 / 120,           // fixed physics step, seconds
    maxSteps: 8,           // catch-up cap per frame; beyond this, drop time
    gravity: 3.2,          // m/s^2. 1.6 lunar-floaty, 9.8 brutal in a short descent
    dragCoef: 0.0016,      // quadratic; thin atmosphere. 0 = vacuum
  },

  vehicle: {
    height: 22,            // m, sets pxPerMeter with the sprite
    mass: 1,               // normalized; all forces are accelerations
    maxThrustAccel: 12.0,  // m/s^2. TWR 3.75 at default gravity
    minThrottle: 0.35,     // engine floor while lit — makes the suicide burn a decision
    spoolRate: 4.0,        // throttle units/s. 0.25 s to full
    burnRate: 8.0,         // fuel units/s at full throttle (~13 s of tank)
    torqueAccel: 5.5,      // rad/s^2 at full rotation input
    angDamp: 2.2,          // passive angular damping
    legHalfWidth: 4.5,     // m, half the footprint = the support polygon
    legHeight: 9.0,        // m from CoM to contact points
    legDeployTime: 0.6,    // s
    legDragBonus: 0.0009,
    autoLegsAlt: 200,      // m AGL when the assist is on
  },

  entry: {
    tiltMax: 0.35,         // rad of arrival tilt on tilted entries
    angVelMax: 0.5,        // rad/s cap so recovery is always possible
    xSpread: 420,          // m of lateral scatter around site center
  },

  queue: {
    interval: 11,          // s between entries becoming due
    holdBurn: 3.5,         // fuel/s the NEXT booster burns while you dawdle
    minFuel: 45,           // floor; a dawdled entry is hard, never impossible
  },

  terrain: {
    width: 2400,           // m
    step: 4,               // m between samples
    base: 60, ridge: 90, detail: 14,
    f1: 0.0016, f2: 0.011,
    pads: [                // count 6-8; x positions seeded with min separation
      { tier: 'barge',    width: 60, mult: 1.0 },
      { tier: 'apron',    width: 30, mult: 1.6 },
      { tier: 'bullseye', width: 14, mult: 2.5 },
      { tier: 'shelf',    width: 34, mult: 1.4, slopeDeg: 11 },
      { tier: 'dusty',    width: 40, mult: 1.8, dustAlt: 40 },
    ],
    minPadSeparation: 140, // m
  },

  wind: { base: 0.0, gust: 0.9, gustFreq: 0.12 },   // m/s^2 lateral

  land: {
    sinkPerfect: 2.5, sinkHard: 6.0,      // m/s
    latPerfect: 1.5,  latHard: 4.0,       // m/s
    tiltPerfect: 0.07, tiltHard: 0.19,    // rad (4 deg / 11 deg)
    slopePerfect: 0.087, slopeHard: 0.157,// rad (5 deg / 9 deg)
  },

  wreck: { debrisWidth: 34, salvageAlloy: 0.25 },

  score: {
    base: { propellant: 6, alloy: 10, crew: 1, credits: 100 },
    hardMultiplier: 0.55,
    roughMultiplier: 0.5,      // landing on unprepared ground
    salvage: { propellant: 0, alloy: 3, crew: 0, credits: 15 },
    fuelToResource: 1.0,       // leftover propellant -> starting propellant
    noAssistBonus: 1.25,
    gradeBands: [2400, 1800, 1300, 800],   // S / A / B / C, else D
    skipBundle: { propellant: 40, alloy: 40, crew: 4, credits: 400 },
  },

  hud: {
    dvMargin: 4,          // m/s of honesty padding in the feasibility light
    planTilt: 0.35,       // rad the planner assumes for lateral translation
    predictorSeconds: 2,
    callouts: [500, 200, 100, 50, 20, 10],
  },

  view: {
    zoomWide: 0.35, zoomClose: 2.4, zoomStartAlt: 300,
    leadFactor: 0.35, dprCap: 2,
    palette: {
      sky: '#050807', ground: '#1d4d44', groundLit: '#2a6b5d',
      hot: '#ffe9a3', bad: '#e2725b', landed: '#3d8a7a', wreck: '#6b4034',
    },
  },

  a11y: { highContrast: false, slowMoFinal: true, reducedMotion: 'auto' },

  entries: [ /* the ten rows from the difficulty table, verbatim */ ],
};
```

## Debug HUD (`H`)

Monospace overlay, built in step 2 and kept: fps, physics steps/frame, seed, entry index, full
vehicle state, fuel, computed dv-available vs dv-needed for every pad, pad occupancy, wind.
Plus `R` reseed, `Space` pause, `.` single-step physics, `0`–`9` jump to entry, `K` force a
touchdown at current state. This is the tuning cockpit — it pays for itself by step 4.

## Build order

Each step ends with something runnable. Do not proceed on a broken step.

1. **Canvas, fixed-step loop, vector booster, flat ground.** Thrust, rotate, gravity, crash or
   land on a hard-coded threshold. It should already be *slightly* fun. If it isn't, the
   numbers are wrong — fix them here, before anything else exists.
2. **Terrain + camera + debug HUD.** Seeded heightfield, pad stamping, terrain-relative altitude,
   zoom ramp, slope query.
3. **Touchdown evaluation + the verdict line.** All five readings, three outcomes, tipover.
   This is the heart; get it honest before adding anything on top.
4. **Instruments.** Speed tapes, fuel-in-seconds, retrograde, predictor, callouts.
5. **The ten-entry director.** Queue, cadence, overlap fuel drain, persistent occupancy, wrecks
   and debris, handover between boosters.
6. **Designation + feasibility lights.** Pad chips, brackets, dv math.
7. **Scoring, run summary, `runLandingIntro` handoff.** Full payload, skip path, cleanup.
8. **Assists + accessibility + reduced motion.**
9. **Sprites.** Bake, atlas, swap in over the vector fallback, keep both paths working.
10. **Polish.** Dust, flame, shake, contrails, sound hooks if wanted (behind a config flag,
    default off, never required).

## Acceptance criteria

- Ten entries complete in 100–150 s at competent play, with no frame over 20 ms.
- **Every** resolution — good or bad — prints one line naming the reading that decided it and its
  threshold. A watching player can diagnose a crash without asking.
- The site visibly fills up: by entry 8 the good pads are occupied and the player is choosing
  between a narrow bullseye and unprepared ground.
- Dawdling on entry *n* visibly drains entry *n+1*'s propellant, and the player can see the
  causal link on the queue chip while it happens.
- The feasibility lights never lie: an amber pad is reachable with a clean burn, a red pad is not.
  Verify by scripting inputs against a fixed seed.
- Same seed + same input timeline = byte-identical landing results, across machines and frame
  rates. Test at 30, 60, and 144 fps.
- Playable start to finish with keyboard only, and with touch only, on a phone.
- With `assets/` deleted, the game runs identically on the vector fallback.
- `runLandingIntro` resolves in every path — completed, skipped, and internal error — and leaves
  no listeners, no `rAF`, and no globals behind. Verify by running it twice in a row.
- Changing any single CONFIG value produces a visible, isolated change. No hidden couplings.

## Non-goals

- No orbital mechanics, no rendezvous, no ascent, no 3D at runtime.
- No procedural mission text, no narrative, no cutscenes. The intro is the ten landings.
- No persistence, no accounts, no leaderboards, no network calls of any kind.
- No difficulty *selection* screen. The assists panel is the difficulty selection.
- No monetization hooks, no analytics, no telemetry.
