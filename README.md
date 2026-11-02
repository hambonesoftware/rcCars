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

**Controls:** desktop W/Up accelerate, A/D or Left/Right steer, S/Down brake, Shift/Space boost, Q/E pitch in air, C overview/follow, Escape pause. On touch devices throttle is automatic and touch steering/brake/boost buttons are provided. The prototype uses arcade steering, motor heat, off-track penalties, opponent cars, and finish time. Aerial follow and full-sector overview cameras let us evaluate track geometry independently from handling.

When Sector 01 feels right, the road-generation functions can be extended into the remaining course and the moving cars can be upgraded to a richer tire-contact/suspension simulation. The old long straightaway test build remains accessible on the root page.
