# HO House — Rendering and Lighting Lab

A deliberately controlled rendering experiment for the Elm Street House in Micro Mayhem.

Live test: https://hambonesoftware.github.io/rcCars/house-showcase.html

## Purpose

The V1-V3 house changed shaders and modeling without a stable reference comparison. This lab keeps the original **procedural geometry, seed, paint, layout, camera pose and viewport** consistent, allowing the rendering pipeline itself to be evaluated. A visual difference is not automatically a quality improvement: compare real output with physical photographs of inexpensive molded-plastic railway kits, flocked fake-grass mats and die-cast toy cars.

## Presets

| Preset | Tone map | Lighting | Shadows | Molded-plastic detail | Camera | Depth blur |
|---|---|---|---|---|---|---|
| A: Original | ACES | Original baseline | Broad 1024 px | Original | Orthographic | Off |
| B: Room light | Neutral | Lower-fill indoor rig | Tighter 2048 px with contact patches | Original | Orthographic | Off |
| C: Surface detail | Neutral | Room | Same as B | Separate normal and roughness maps | Orthographic | Off |
| D: Photo lens | Neutral | Room | Same as B | Same as C | Perspective, matched framing | Depth-aware DOF (desktop) |

Link directly to a preset with URL query parameter preset=original, preset=room, preset=surface, or preset=photo. The control panel also supports individually switching tone mapping, lighting, shadows, materials, projection and DOF, resulting in a Custom comparison.

## Important technical findings

1. A rendered toy can look digital despite a high polygon count. Strongly overfilled lighting, perfectly uniform material roughness, too few contact shadows and orthographic-only imaging hide manufacturing cues.
2. Color/reflectance and shape are separate systems. The new independent normal/roughness data maps use NoColorSpace; base color remains sRGB.
3. Small model seams need better localized shadowing: the detailed preset shrinks the directional shadow projection and adds grounded contact-shadow overlays. The latter approximate cheap baked occlusion; they are not screen-space GTAO.
4. The photographic preset renders a real perspective view with a view-space, depth-texture-based nine-sample focus blur plus restrained vignette and grain. It is not a CSS edge blur. A proper 24-bit depth buffer and a near plane of 1.0 are required to distinguish thin road, lawn and roof surfaces at this camera distance; 16-bit depth caused severe striped Z-fighting.
5. Mobile intentionally keeps the perspective and skips expensive desktop depth postprocessing. It reduces detailed shadow map allocation to 1024 pixels.
6. Switching evening and daylight now restores the specified baseline lights, not an outdated brighter configuration.

## Performance and limitations

- Controlled visual research is run in the standalone model viewer, **not** the kart-racing camera.
- The desktop photo preset is more expensive; using it on every racing camera frame is not recommended.
- Roughness and normal textures are small, deterministic 128x128 data maps. They test material response but are not scanned real plastic microsurfaces.
- Shadow contacts are approximations; a future full-quality preset could compare low-cost lightmaps with GTAOPass.
- The DOF pass is an inexpensive visual approximation; it is not physically rigorous cinematic bokeh.
- Strongly repeating stylized geometry may still dominate the impression, regardless of shader fidelity. The lab is built to make that conclusion observable rather than speculative.

## Visual test and acceptance

The independent GitHub Actions workflow named Verify Procedural HO Hero House renders actual WebGL screenshots at the same 1440x900 viewport and source model. The artifacts contain:

- house-render-lab-original.png
- house-render-lab-room.png
- house-render-lab-surface.png
- house-render-lab-photo.png
- house-render-lab-phone-photo.png

The test also validates model-seed and paint continuity, expected preset settings, non-identical captured images, shader errors, original controls and phone touch fallback. These checks establish functional rendering and controllability; they do not by themselves establish photorealistic image quality.

## Recommended selection process

Keep the four exported images at matching size. First compare the B/A shadow and light improvement, then the C/B surface-map change, then D/C photographic camera improvement. Reject any setting that damages surface readability or introduces striping, banding, shimmering or blown-out highlights. Only adopt the winning, measured subset for the miniature racing environment after a real-device performance check.
