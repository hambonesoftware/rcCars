# Micro Mayhem — HO-Scale Miniature Railway Art Direction

## North star

**A handcrafted HO-style model railroad exhibit, photographed with a miniature tilt-shift lens, where the player races exaggerated RC kart trucks through a living little town.**

The buildings, railway and landscaping evoke a real 1:87 model railroad, but the kart trucks remain larger than strict scale for gameplay readability. The road should feel integrated into a proper diorama, not float over generic terrain.

## Four district maps

| Course | District 1 | District 2 | District 3 | District 4 | Signature setting |
| --- | --- | --- | --- | --- | --- |
| Backyard Grand Prix | Elm Street | Hambone Village | Oak Junction | Mill Pond | Suburban model railway town |
| Creekside Scramble | Creekside Depot | Maple Falls | Willow Landing | River Market | Scenic riverside railway village |
| Garage Gauntlet | Repair Row | Brickyard | Switching Yard | Freight Works | Brick industrial switching district |
| Sunset Quarry | Miners Cottages | Stone Works | Quarry Branch | High Ridge | Rocky mining railroad with a tiny settlement |

The districts are genuine 3D scenery, not just title swaps. A shared scenery kit provides decorated buildings, model roofs, windows, chimneys, signs, people, parked cars, train tracks, ballast, rail sleepers, platforms, fences, landscape hills, and trains. Each track has its own authored centerline and its own town placements.

## Camera and rendering rules

- Use a high rear-three-quarter orthographic view, preserving a full view of the next turn and the truck.
- The full-course overview should frame the plywood-edged tabletop display.
- Use restrained screen-space tilt-shift blur at the upper and lower edges; keep the center of gameplay sharp. Stronger blur may be used in overview mode.
- Make tilt-shift optional, and honor reduced-transparency preferences. In-game controls: Pause > TILT-SHIFT FOCUS or desktop V.
- Provide recognizable hand-built scenic cues: pitched shingle roofs, storefront windows, painted trim, model ballast, textured roads, tiny figures, miniature landscaping, and soft shadows.
- Any scenic detail must remain out of the driving lane and not obscure obstacles, jumps or corners.

## Code and performance

- Shared model railroad town plans and instanced building/railroad/people geometry: miniature-world.js.
- Course geometry and distinct racing lines: track-layouts.js.
- Course metadata: course-presets.js.
- Course selection and model railway map previews: course-picker.js.
- Camera, game loop and WebGL world integration: quarter-track.js.
- Visual framing and controllable lens: quarter-track.html.

Batch common shapes/materials in instanced meshes rather than creating a unique draw call for each window, tie or figure. Scenic locomotive animation runs independently of racing physics. Avoid download-only assets and unnecessary additional rendering passes until phone performance is measured.

## Acceptance checks

Geometry regression checks must pass for all four loops. Browser smoke tests must verify that the WebGL scene starts, the miniature buildings/figures/ties/trains have been constructed, and Garage Gauntlet can enter its race countdown. The browser workflow captures real rendered course screenshots for visual QA.

A passing automated check is not a substitute for visual polish or iPhone playtesting. Verify miniature readability, track visibility, town placement, wooden board silhouette, performance, tilt-shift clarity, and collision-safe scenery.

## Next implementation priorities

1. Create **coherent streets, sidewalks, courtyards and railway stations**, beyond buildings placed along a road.
2. Build **genuinely traversable kart-racing set-pieces**, such as grade-separated bridges, underpasses, rail crossings and alternate routes.
3. Introduce drift mechanics, boost pads, variable road width, route choice and camera lookahead while retaining fast arcade handling.
4. Add selected living scenery: crossing signals, subtle crowds, small moving machinery and narrative train-table details.
5. Iterate against browser screenshots and actual phones, tracking render speed, scene readability and fun.

The goal is a beautifully crafted miniature town racing game, not a generic road with decorative low-detail boxes.
