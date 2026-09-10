# Six Down / Stålsfär

A playable six-booster, 2D Canvas landing PoC for Stålheart. One seeded landing site persists across all six entries. Recover at least five boosters (perfect or hard landings) to unlock launcher reconstruction in the result payload.

## Run

From this directory:

```sh
python3 -m http.server 8001 --bind 127.0.0.1
```

Open http://localhost:8001/landing/. No build, npm, external fonts, or server API. The optional recovery report uses locally vendored Three.js 0.180.0. All flight art is served locally. Use `?seed=your-seed` for another deterministic site.

## Controls

- **Space:** hold thrust, release to cut. W / up arrow remain aliases; engine spool takes time.
- A / D or left / right arrows: rotate. Tilt aims thrust; you must cancel lateral drift before contact.
- 1–7: designate a site. Tab cycles sites while the canvas has focus; Shift+Tab leaves the canvas for the accessible HTML controls.
- L: deploy legs. Automatic deployment at 200 m is enabled initially.
- O: orient to retrograde; manual rotation cancels alignment.
- **Esc:** pause/resume. Use the on-screen **Skip** button for the intro skip confirmation. H toggles diagnostics.
- Phones have separate multitouch rotation and burn buttons, plus legs and alignment controls. The landing-site strip scrolls horizontally.

For a first landing, aim for site 01. HUGIN arrives tilted with lateral speed: rotate toward retrograde (or use O), cancel drift, then brake before the ground gets close. Keep sink below 6 m/s, drift below 4 m/s, tilt below 11°, and legs fully deployed. A perfect landing requires 2.5 m/s sink, 1.5 m/s drift, and 4° tilt or better. The slope limit is 9°. Site 04 is deliberately unsafe at 11°.

## Opening and crash behavior

On each full page load, the opening alternates between the original Launch cinematic and a six-starship cinematic (first visit: Launch). The choice is stored locally and stays fixed for FLY AGAIN within the same page. If storage is unavailable, Launch is the fallback.

The new `landing/starship-intro.js` adapts the Onkochishin Starship noise-warped exhaust shader: six blooms in a 3 × 2 formation (2 × 3 on portrait screens), Time × fixed at 3.00, and exposure rising linearly from 0.05 to 4.00 over five presentation seconds, then holding until the eight-second controls handoff. Pause freezes the animation and ramp. It uses one WebGL2 context, a locally generated noise texture, a 960 × 600 resolution cap, and the same skip/reduced-motion handling as Launch. Attribution and MIT terms are in `landing/licenses/starship-shader-MIT.txt`.

The original eight-second opening uses the actual MIT-licensed ray-marched [Launch shader](https://kai-denrei.github.io/onkochishin/atelier/launch/), replacing the earlier Canvas line approximation. X stays at 0 and Z at 7. Tint, turbulence, squash, core, detail, exposure, march steps, and step divisor keep the demo defaults. Only camera Y is animated, alongside the shader's normal clock: 2 initially, through −8, then down to −1048576, where pixel checks show black. There is no zoom or artificial opacity fade. The initial Y=2 view holds for three seconds, and the final black view holds briefly before the controls splash.

`landing/launch-plume.js` uses native WebGL2 for this opening only, without a library or network fetch. It renders up to native CSS resolution (capped at 1600 × 1000) at up to 30 updates/second. Its shader, buffer, canvas, and context are released on handoff, skip, or cleanup. Reduced motion or unavailable WebGL2 goes directly to the controls splash. The playable landing game remains Canvas2D. Source attribution and the MIT license are retained in `landing/licenses/launch-shader-MIT.txt`.

The subsequent angled arrival remains at 3× speed (about 0.87 seconds) with the blue/white/yellow plasma wake. Neither cinematic consumes mission time or fuel.

Intact landing legs unfold through articulated knees with support struts and foot pads. Successful touchdowns animate a brief damped compression/rebound, scaled by sink speed, while the feet remain planted. This visual suspension uses simulation time (so pause freezes it) and is disabled for reduced motion. Collision geometry and landing thresholds are unchanged.

Crash severity now controls structural breakup. A low-energy failure topples as one body; impact speeds over 10 / 22 / 34 m/s produce two / three / four sections. The severity measure includes sink, lateral speed, and angular motion. Each section is clipped from the existing wreck sprite at a body-space cut, centered on its own pivot, and given independent velocity, spin, inertia, terrain contacts, and friction. No new raster assets are needed, and the vector fallback uses the same cuts. The director waits until every section has settled.

Debris follows ballistic arcs, bounces, and remains at the site. Collision checks test individual section polygons and settled shards, never a polygon spanning the empty gaps between pieces. The debris-range metadata is never a solid platform. This is a simplified sectional rigid-body model, not mesh fracture or a structural engineering model.

Esc freezes cinematics, physics, and crash motion. Pause, blur, and loss of visibility clear held controls. A fresh press is required to resume thrust; repeated keydown events cannot relight it after a pause.

## Sound

The opening stays silent. Begin Descent unlocks audio silently. The launch recording plays only while the player holds Space, W, up arrow, or touch BURN with fuel available. Releasing thrust cuts the recording with a short fade; another press restarts it. Booster arrivals do not start sound automatically. Landing cuts the launch audio, a wreck triggers the initial boom, and later section contacts trigger quieter impact sounds scaled by impact speed. A shared 2400 Hz low-pass filter slightly muffles all three recordings. Esc/blur suspends audio with the game; skip/completion releases the audio context. Toggle Sound effects under Assists to mute.

Local files in `landing/assets/audio/` were supplied by the user: `launch.mp3` from `jci21-rocket-launch-sfx-253937.mp3`, `crash.mp3` from `dragon-studio-boom-crash-487664.mp3`, and `impact.mp3` from `dragon-studio-car-crash-sound-effect-376874.mp3`. Their reuse terms were not supplied.

## Implemented

Fixed 120 Hz physics, interpolated drawing, seeded terrain/wind, seven site chips, persistent landings and wreck footprints, three contact grades with numerical verdicts, a six-entry director, next-entry holding fuel costs, instruments, impact projection, assists, reduced-motion camera behavior, touch controls, local sprite/atlas loading, vector fallback, resource payouts, replay, and skip/error cleanup.

The host API is `runLandingIntro(canvas, {seed, entries, assists, onEntryResolved})`, exported from `landing/lander.js`. The canvas needs the harness stylesheet for its cockpit. Import is inert. It returns a Promise with resources and per-entry results. Concurrent runs on the same canvas throw synchronously. Internal errors resolve with the skipped bundle. The harness displays the result and its JSON after cleanup.

## PoC decisions and remaining scope

- Six entries replace the original ten. Cadence is 18 seconds; the validated scripted flight took about 129 simulated seconds. Pauses and optional slow motion increase wall time.
- The source atlas supplies 21.4 m deployed height, a shared estimated COM, and 21.3667 image pixels/metre. Sprite dimensions are never fitted independently per pose.
- Positive clockwise tilt produces positive horizontal thrust; this corrects the inconsistent sign in the original pseudocode.
- Fuel margin chips are conservative estimates, **not a verified reachability solver**. The projected path holds the current burn command; it is guidance, not autopilot.
- No sphere kernel is imported. The full 3D/spherical approach remains a separate design decision; this PoC uses a planar heightfield and downward gravity.
- Reconstruction is a boolean handoff unlock. Drone animation, launcher assembly, regolith dust, and full instrument tapes remain future polish/integration work.
- Debug overlay currently shows frame rate, simulation state, seed, occupancy, and sprite/fallback status. Destructive debug shortcuts are not wired into the player controls.
- Determinism is verified for identical fixed-step input sequences at 30/60/144 Hz on this machine. Cross-machine floating-point equivalence has not been certified. Catch-up is capped at eight steps; severe stalls discard simulation time.

## Assets

Original model by **jelaludo** — https://jelaludo.github.io/SentryTowers_A6/

PNG and atlas sources: `SentryTowers_A6/assets/hugin-flight/`. The upstream generator is `tools/blender/build_hugin_flight.py`, with editable `source/blender/a6-hugin-flight.blend`. Source GLBs and the bake tool remain in the asset repository. The three committed PNGs need no runtime 3D engine. Reuse terms are in `landing/assets/ASSET-LICENSE.md`.

## Validation

```sh
node tests/physics.mjs
```

Checks contact thresholds, stowed legs, unsafe slope, thrust direction, occupancy, queue fuel drain, deterministic frame-rate runs, and a scripted pilot recovering at least five boosters.

`tests/browser.py` uses Playwright installed separately as development tooling (not a game dependency). With the server running, it checks desktop/phone layouts, Space hold/release, Esc pause, blur and repeated-key safety, simultaneous touch inputs, six-entry completion, replay, skip, reduced motion, and missing-assets fallback. Screenshots are written under `/tmp/stalsfar-*`.

`tests/shader.py` checks the reference uniform defaults, Y-only camera trajectory, bright start/plume stages, fully black final pixels, and WebGL resource cleanup.

`tests/audio.py` verifies silent startup, gesture-triggered launch, decoding/playback of all three clips, pause/resume, and context cleanup.

## Recovery report and publishing

Completed runs with at least three successful landings show only HUGIN's 20-second cargo recovery cycle, with a fixed orthographic isometric camera and compact scores alongside it. The scene is fitted to the full animation envelope, renders at up to 30 FPS, pauses when hidden, and releases its GPU resources on replay. Reduced motion presents a still view. The existing five-survivor reconstruction handoff remains unchanged.

The model is copied from `SentryTowers_A6/assets/game-ready/hugin_launchpad_d0_game.glb` (39,731 triangles), retaining its animation and attribution under the model reuse notice. Three.js 0.180.0 and the GLTF loader are vendored in `landing/vendor/three/`, with their MIT license. All published asset paths are relative; no localhost or CDN dependency is needed by the game.

`tests/recovery.py` checks the 2/3/6 recovery threshold, actual animation, mobile layout, and replay. Publish the repository root with GitHub Pages; `index.html` redirects to the game.

## Fleet 05: observe, failure, manual rescue

The published root opens HECTIC FLEET 05. Classic is available at `landing/?mode=classic`. Each replay generates a fresh seed; `?mode=fleet&seed=7` repeats a scenario.

All six start under automatic guidance. The initial fleet-wide view reveals no player assignment or selected sector. After 3.5–4.5 seconds of flight, a randomly chosen controller fails; an orange CRT alert and warning sounds announce manual override, and the camera focuses on that craft. Its position, velocity, orientation and fuel are preserved at takeover. Any of the six vehicle IDs can fail; its destination has neighbouring corridors on both sides.

Four other boosters target a shared arrival window, typically within seconds of a clean manual landing. The last booster starts higher and follows the main wave 24–27 seconds later. Healthy automatic units retain independent 90% success chances. A successful first manual landing offers up to 12 seconds to choose an optional takeover of the remaining damaged unit; without intervention its success chance is 50%. The offer never pauses the fleet, and expires with at least 15 seconds of scheduled approach remaining. Esc pauses everything.

Automatic approaches use continuous diagonal braking arcs with no lateral reversals and at most 4.5 m/s² lateral deceleration, easing into unique, shuffled safe sectors. Automatic trajectories are a cinematic guidance model; manual flight uses the game's physics. During manual control, the view retains enough horizontal space for neighbouring landings. Completion waits for all six outcomes and wreck settling.

Landing sites are labelled SEC 01–07 with approximate local X/Z coordinates (metres, rounded to 10 m), usable width and slope. Old material/site tier names remain internal scoring metadata only. Sector cards scroll on smaller screens rather than overlapping.

Both modes use the user-supplied `yodguard-warning_low-2-540185.mp3` (`handoff.mp3`) when manual control actually begins. Fleet also plays a two-second excerpt of `freesound_community-sci-fi-warning-alert-29632.mp3` (`alarm.mp3`) for the failure and damaged-module offer. There is no warning or manual target revelation while merely observing. Existing audio muffling, mute, pause and cleanup apply.

`node tests/fleet.mjs` checks complete/deterministic runs, optional rescue, probability outcomes, smooth braking, hidden initial assignment, all six possible failures, and nearby touchdowns on both sides of the player. `tests/fleet-browser.py` checks observation, CRT/audio handoff, takeover, pause, completion and replay.

Fleet 05 accelerates the atmospheric establishing shot to about 1.2 seconds, followed by an early controller failure. Entry sink speed is 1.7 × height / arrival time (roughly 30–40 m/s). Five vehicles have modest diagonal drift, with one vertical approach. Plasma expires 2.8 seconds into flight and does not restart on takeover. Automatic touchdowns cluster around the manual landing, with the optional final unit now deliberately delayed in Fleet 07.

## Mobile app / Fleet 06

The briefing uses a viewport-contained layout with its own scroll area and a permanently visible Begin Descent footer. Touch devices use a floating left-thumb stick: touch any non-button area on the left half of the playfield and drag horizontally for proportional steering. A separate right-thumb BOOST button supports simultaneous touch and cuts on release. Touch cancellation, pause, blur, orientation changes, takeover and cleanup reset the controls. Keyboard controls remain available.

The mobile HUD retains altitude, sink rate and fuel; sectors are shown on demand. Portrait and landscape layouts respect safe-area insets. Automatic legs remain enabled by default, with a LEGS control available. Landscape leaves the centre open and places boost/tools to the right.

Use INSTALL APP on the briefing. Supported browsers show their native install prompt; Safari receives Add to Home Screen instructions. The app manifest supplies standalone presentation and 192/512 px maskable icons plus an Apple touch icon. A root-scoped service worker precaches the complete game, including audio and the 3D recovery model, for offline play after the first successful online cache fill. Updates wait until the player chooses UPDATE READY · RELOAD on the briefing; active flights are not automatically reloaded.

For future releases, bump the cache version in `sw.js` and refresh its ASSETS list when adding/removing runtime files. All requests are scoped to this repository's URL. Only this app's old caches are removed. Verification: `tests/mobile-pwa.py` checks short-window CTA visibility, portrait/landscape layouts, real simultaneous touch input, independent release, pause reset, asset caching and offline startup. Browser emulation does not substitute for a physical iOS/Android device check.

## Final approach / Fleet 07

Below 130 metres the camera tightens around the controlled booster and its nearest nearby neighbour, prioritising readable craft size on mobile. Distant vehicles no longer hold the camera wide. Reduced-motion mode switches framing without an animated zoom. The final unit starts higher and arrives 24–27 seconds behind the main wave, leaving time for the takeover decision and a controllable descent.
