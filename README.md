# Micro Mayhem: Backyard Blitz

A tiny RC buggy racer with the arcade jump rhythm and risk/reward of classic motorcycle racing games, set in an oversized DIY backyard.

## Play

On a desktop or mobile browser, open `index.html` from GitHub Pages (or serve this folder with a static HTTP server). The game uses Three.js from a public CDN, so internet access is required for the first load.

**Desktop:** W / ↑ accelerate, A/D or ←/→ steer, S / ↓ brake, Shift boost, Q/E lean in midair, C switch angled-isometric/bird's-eye cameras, Escape pause. **Touch:** auto-throttle, on-screen steering, brake and boost.

## The first playable

- RC Pro-Am-inspired angled overhead isometric camera (default), optional more vertical bird's-eye view, smoothly scrolling ahead of the buggy, and compact rolling track radar
- Full point-to-point backyard course with more pronounced sweeping bends, painted direction arrows, six named sections, six big takeoff ramps, small rollers, lane obstacles and varied scenery
- Three AI competitors, a start countdown, race position, speedometer, boost overheat/cooling and finishing results
- Airborne pitch control, landing bonus/penalty, speed loss from collisions and off-track surfaces
- Procedural 3D artwork (no external model files), responsive on-screen controls and synthesised audio
- Personal best stored in the browser; replay, pause and restart

This is a **first playable**, not an assertion of production-ready simulation: the cars run on deliberately arcade-tuned kinematics, and the rivals use predictable scripted pacing. Next priorities are per-wheel suspension/traction polish, improved opponent collision/AI, race ghosts, track creator and graphics/audio tuning.

## Development

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/. The game has no bundling step. Deployment is configured by `.github/workflows/deploy.yml`. To make the site public, choose **Settings → Pages → Build and deployment → Source: GitHub Actions** once. The workflow then publishes on every push to `main`. Expected site URL: https://hambonesoftware.github.io/rcCars/ (only once Pages is enabled and deployment succeeds).

Files: `index.html` UI, `style.css` responsive presentation, `game.js` Three.js world, physics and game logic.

© Hambone Software. This is an original racing game; it is not affiliated with or based on original Excitebike assets.

## Interactive 3D truck preview

Open **[Vehicle Showroom](./vehicle-preview.html)** to inspect a reusable, real Three.js short-bed monster-truck model. Four paint variants match the red, green, blue and yellow pickup racing reference. Drag to orbit, zoom, tap a vehicle color to inspect it, or change between lineup, detail and overhead camera. Geometry lives in `truck-model.js` and is ready for later integration into gameplay after review.

## First quarter-track prototype (Sector 01 / 04)

The current development focus is **[Drive Sector 01](./quarter-track.html)**. This playable three-dimensional opening quarter uses the refined smooth-shell pickup trucks from `truck-model.js`. It provides a real four-car grid, an asphalt opening straight, two rhythm bumps, one jump ramp with airborne landing simulation, a banked 90-degree turn with yellow-black curbs and safety railings, a winding exit and a Sector 02 checkpoint. The prototype does not yet implement the other three quarters or a lap loop.

**Controls:** desktop W/Up accelerate, A/D or Left/Right steer, S/Down brake, Shift/Space boost, Q/E pitch in air, C overview/follow, Escape pause. On touch devices throttle is automatic and touch steering/brake/boost buttons are provided. The prototype uses arcade steering, motor heat, off-track penalties, opponent cars, and finish time. A closer rear three-quarter isometric follow camera (the default) keeps the truck prominent with the next turn visible; toggle the full-sector overview with the on-screen OVERVIEW button or C. Both cameras use an orthographic projection.

When Sector 01 feels right, the road-generation functions can be extended into the remaining course and the moving cars can be upgraded to a richer tire-contact/suspension simulation. The old long straightaway test build remains accessible on the root page.

## Photographic lighting and environment pass (Sector 01)

The sector now uses afternoon directional lighting and tighter soft shadow maps (including iPhone), graded ACES output, a procedural sky/sun environment reflection on clearcoated truck shells, and a stronger contact-occlusion shadow beneath all four vehicles. The smooth-shell monster truck model includes dark recessed wheel wells. Road surfaces now have multiscale grain, a subtle normal map, weathered paint decals, skid/rubber buildup around braking zones, and textured gravel shoulders. The verge uses sun-bleached grass patches, tapered individual grass blades, asymmetrical bush clumps and layered tree crowns, primarily as GPU instanced meshes. Black/yellow curbs have also been consolidated into two instanced meshes to reduce draw calls.

The procedural assets are deterministic and generated locally—no paid assets, external texture downloads, or new runtime dependencies. This is an **art-direction approximation** of the supplied photographic reference, not photographic PBR scans or a ray-traced render. Visual verification and phone performance testing remain important before declaring the look final.

## 2× race speed tuning

Sector 01 uses double the previous top speeds for the yellow player truck: normal target **30.8 world units/s** (was 15.4), and turbo target **43.2 world units/s** (was 21.6). All three rival trucks use double their previous cruise speeds too. Acceleration, braking, and steering authority are increased to match, the ramp launch is constrained to avoid an oversized airborne shortcut, and the rear-isometric camera follows the faster vehicles more responsively. The HUD remains arcade-scaled rather than measuring physical RC-car road speed. Boost still overheats and cools normally.

## Half-track build: Sectors 01 + 02 (latest)

**[Play the connected half-course](./quarter-track.html)**. Sector 01 remains geometrically unchanged, and its old finish is now a live checkpoint with a timed split. Sector 02, **Garden Switchbacks**, adds an eastward speed section, a broad banked left sweeper, an uphill rhythm section, a second jump, a right-hand sweeper with railings, and an exit straight ending at the Sector 03 gate. The in-race minimap automatically fits both sectors and updates the highlighted truck positions. Race results include the first-sector split and total time.

The refined 3D monster trucks retain the agreed double speed settings: **30.8 game units/s normal** and **43.2 units/s boost**, with proportionally tuned AI rivals. Controls and photographic materials are unchanged. The camera keeps the close rear three-quarter isometric follow angle, with a full half-course overview toggle.

The other half of the circuit and actual multi-lap racing are intentionally not yet built. The GitHub Pages deployment workflow runs Node syntax checks and **tests/track-geometry.test.cjs** before publication; that regression test verifies original Sector 01 coordinates, continuous joins, road projection, both jumps and the speed configuration.

## Full circuit Grand Prix — Sectors 01–04 (current)

**[Drive the four-sector Grand Prix](./quarter-track.html)**. The circuit closes cleanly back onto the original starting straight, with four continuous sections:

- **01: Backyard Launch** — four-car checkered start, rhythm rollers, first ramp, banked right corner.
- **02: Garden Switchbacks** — banked left sweeper, garden jump, opposing turn and speed exit.
- **03: Canyon Rush** — outside 90° turn, long speed section, third jump, and dramatic hairpin.
- **04: Home Run** — high-speed return straight, final launcher, 90° bend and finishing chute.

The Grand Prix has **two complete laps**, AI cars on the same closed route, timing gates at each sector, live lap/sector indicators, lap-time results, and a minimap showing all four sectors. The default camera remains the close rear-three-quarter isometric follow angle; **Overview** reveals the complete track.

Double-speed handling remains unchanged: 30.8 game units/s normal and 43.2 turbo (with overheating). Road shaders, smooth single-shell trucks, tire shadows and mobile-instanced environment remain intact.

The GitHub Pages workflow requires JavaScript syntax checks plus `tests/track-geometry.test.cjs`. The geometry test verifies original Quarter 1 coordinates, smooth centerline joins, a physically closed loop, four ramps, two laps, and lane projection. Passing CI does not substitute for visual and phone playtesting.
## Course selection — four playable circuits

Open **[Choose a Course](./courses.html)** (now the main menu launch). Courses use the same Three.js engine, smooth-shell monster trucks, 2× regular/turbo speeds, four AI competitors total, two laps, checkpoints, race map, and rear-three-quarter isometric camera. The Backyard route preserves its original analytic turns, while the three new venues use independent, closed, arc-length-parameterized Catmull-Rom centerlines authored in `track-layouts.js`. They no longer share the same path outline.

- **Backyard Grand Prix** (`?course=backyard`) — the original layout, lighting and racing personality.
- **Creekside Scramble** (`?course=creek`) — flowing, shorter forest track; creek pools, timber crossings, reeds and log hazards.
- **Garage Gauntlet** (`?course=garage`) — shorter, technical turns; industrial lighting, oversized workshop furniture, caution strips and barrel hazards.
- **Sunset Quarry** (`?course=quarry`) — longer, faster open layout; warm sunset colors, big quarry rock features and boulder hazards.

The new `courses.html` selection gallery draws actual mathematical course previews using the same track dimensions. The game itself dynamically selects the geometry, terrain, jump spacing, vegetation density and lights via `quarter-track.html?course=<id>`. The Gallery can be reopened from the race HUD and the finish screen. `tests/track-geometry.test.cjs` validates all four circuits for closed endpoints, smooth joins, lane projection and jumps. Manual browser and device testing is still recommended.

### Distinct course geometry and launch diagnostics

`track-layouts.js` defines three independent point-to-point waypoint loops: Creekside has long serpentine forest bends and broad flowing S-curves; Garage is the shortest technical course with close-spaced workshop hairpins; and Quarry has wide sweeping high-speed loops. `quarter-track.js` uses the actual authored road geometry for road mesh generation, kart movement, AI, physics banking, camera, course checkpoints and circuit minimap. `course-picker.js` renders that same geometry instead of a generic preview.

Course 3 no longer creates zero-count tree instancing meshes. If a JS module fails or the WebGL scene cannot initialize, the loading view now displays a readable problem and offers retry / course selection rather than getting stuck forever.

`tests/track-geometry.test.cjs` checks all course outlines for geometric distinctness, seamless wraparound and lane projection. `tests/browser-smoke.cjs` starts every course in headless Chromium and drives Garage Gauntlet, so publication is blocked if a course cannot boot.
