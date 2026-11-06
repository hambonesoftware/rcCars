# Garage Gauntlet — miniature photography art direction

## Approved reference direction

**A photograph of a physical HO-scale model railway diorama.** Suburban streets and houses, painted and injection-molded model buildings, recognizable miniature trees, scenic flocking, miniature cars, gently imperfect hand-built landscaping, and the limited depth of field of a real tabletop/macro photograph.

This is the visual treatment the project should converge on. Do **not** substitute a low-poly architectural render, a generic procedurally generated neighborhood, or indiscriminately glossy objects. The objective is **credible manufactured physical miniatures**, not photorealistic full-sized houses.

## Character of the scene

- Strong layout-level composition: a street that clearly belongs to an HO model railway, with curbs, sidewalk, driveway, houses, greenery, painted lanes, and the visible edge of its display base.
- Handmade-but-well-made scenic grass: believable static fibers, clump foliage, ground cover, tree armatures, stone ballast and bark beds. Avoid uniform textures, billiard-ball foliage and spiky geometry placeholders.
- Model-kit architecture: properly beveled molded plastic, thickness to parts, recessed glazing, molded shingles/tiles, plastic guttering, clean snap-fit details and minimal surface imperfections.
- Scale cues: a die-cast toy vehicle with realistic wheels and paint; mailbox, tiny porch lights, and occasional tool-scale details. Avoid oversized clothlike/glitched imported geometry.
- Photographic lighting: soft bright key, gentle bounce, image-based reflections where appropriate, convincing contact shadows, natural tonal range and a physical tabletop environment.
- Macro optics: a **low street-corner camera**, mildly compressed perspective, shallow but not excessive depth of field, and a slightly soft background. **The house and main car must remain clearly identifiable**, not blurred into abstract shapes.
- Mobile-first composition: on an iPhone-sized viewport, the important house facade, driveway, and street remain visible without a large overlay blocking the image.

## How to produce and validate it

1. **Reference photograph:** use a photograph of a real HO plastic-model house and its landscaped block. Maintain licensing/attribution if copying or bundling any particular photo.
2. **Hero asset:** model one reference-matched house/yard with bevels, non-boxy roof components, recessed windows, sidewalk, garage and planted scenery. Blender and authored glTF are preferable to endless primitive additions.
3. **Offline benchmark:** render the house in Blender with a physical-style tabletop photo rig. This offline render establishes a repeatable visual benchmark; it need not ship with the game.
4. **Realtime translation:** import optimized glTF into PlayCanvas; tune PBR materials, reflection atlases, shadows, and the photo-style camera at the **same camera angle** as the benchmark.
5. **Side-by-side image review:** capture desktop and iPhone screenshots from actual PlayCanvas browsers. If a physical-material cue is missing, revise that specific mesh/normal/roughness/texture instead of increasing global gloss.
6. **Performance:** retain low-to-moderate resolution real-time DOF on mobile, implement clear inspection alternatives, and avoid large numbers of foliage draw calls.

## Validation gate

- Seen without labels, does the scene resemble a photograph of an elaborate miniature train layout more than an architectural visualization?
- Are the roof, window recesses, molded edge details, grass fibers and car believable at a close-up camera angle?
- Are building and car grounded by realistic contact shadows?
- Is the chosen **Diorama** camera composed like an actual tabletop photograph, with a controllable depth focus?
- Do the corresponding desktop and iPhone browser screenshots show a fully visible subject?
- Does PlayCanvas perform acceptably with the chosen photo pass?

The V5 camera work in `playcanvas-house.html` and `playcanvas-toy-house.js` is a **camera/exhibition benchmark only**. It is **not** proof that the current procedural house model meets this art bar. The next major quality gate is the authored, reference-matched glTF house/yard.
