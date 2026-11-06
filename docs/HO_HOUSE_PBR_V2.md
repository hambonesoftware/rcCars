# HO House No. 01 — Manufacturing Realism, Three.js V2

## Visual reference

The goal is a convincingly photographed electric-train-table lot: injection-molded and painted styrene house, thin tinted windows, carpet-like glued artificial grass, and a small glossy die-cast miniature car with chromed details and black polymer tires. It is not a cartoon cottage, full-scale photorealism, or a game vehicle. The original procedural geometry avoids using any manufacturer's proprietary mesh.

## Exact physical surface parameters (THREE.MeshPhysicalMaterial)

| Surface | roughness | metalness | clearcoat | clearcoatRoughness | Special |
|---|---:|---:|---:|---:|---|
| Painted plastic clapboard siding | 0.37 | 0 | 0.34 | 0.31 | 256px wood-siding map; bumpScale 0.014 |
| Molded white door/window trim | 0.27 | 0 | 0.51 | 0.21 | Separate physical frame geometry |
| Molded colored plastic door | 0.25 | 0 | 0.72 | 0.18 | Raised molding and handle |
| Asphalt model shingles | 0.75 | 0 | 0 | — | 256px shingle map; bumpScale 0.020 |
| Brick chimney | 0.79 | 0 | 0 | — | Brick-and-mortar texture; bumpScale 0.025 |
| Thin plastic window glazing | 0.075 | 0.03 | 1 | 0.045 | Tinted; opacity 0.84; depthWrite false |
| Die-cast enamel car shell | 0.23 | 0.38 | 1 | 0.075 | Curved longitudinal body panels |
| Dark toy-car glazing | 0.065 | 0.05 | 1 | 0.05 | Transparent thin window geometry |
| Chrome model wheels | 0.17 | 0.94 | 0.5 | 0.13 | Raised five-spoke wheels |
| Molded rubber tires | 0.90 | 0 | 0 | — | True circular wheel geometry |
| Model flocking fibers | 1 | 0 | 0 | — | Individual blade colors, one mesh |
| Green foam-flock ground | 0.99 | 0 | 0 | — | Mottled 256px artificial turf pattern |

The glass uses thin transparent glazing, not heavyweight volumetric transmission. Painted polystyrene remains opaque; higher specular response belongs mainly to the painted plastic trim, windows, and clearcoated die-cast body. Rough shingles, brick, and grass deliberately stay non-glossy.

## Geometry rules

**House:** real sloping gable roof planes, fascia and trim, clapboard map, window frames/muntins, attached garage with recessed sectional door, separate porch canopy/posts/stairs. Dimensional details are modeled rather than painted on a flat wall.

**Artificial grass:** replace 1,250 big conical grass tufts with 16,000 fine cut nylon-style fibers in a single THREE.BufferGeometry; each triangle is 0.14–0.34 model units tall and 0.02–0.048 wide with a narrow bent tip. Assign mixed green/ochre per-vertex colors and avoid all hardscape, driveway, house, and flowerbed areas. Use dense speckle/fiber 256px ground texture to keep the flocked look at normal camera distance. This remains one draw call.

**Die-cast toy:** smooth lofted body shell with changing width/hood profile; a separate tapered roof and raked windshields, car-side glazing, wheel-arch trim, black polymer chassis, wheels with five chrome spokes, tiny bumper/grille, molded headlights/taillights, side mirrors, door handles and body trim. Standard body front is +Z. Clearcoat creates strong believable highlights in the photographed exhibition lighting.

## Test and production acceptance

The viewer at house-showcase.html must expose a street-angle view, full overhead, and die-cast close-up. Original game and other buildings remain unchanged. Browser CI must check visible startup, material/build features, 16k fibers, car closeup camera, color variations and mobile touch. Capture real screenshots; the rendering cannot be evaluated from material numbers alone.

The intended look is **manufactured hobby miniature realism**: slightly reflective painted styrene, actual fake-glass windows, nylon turf flocking, and a glossy small die-cast model. A future pass can add a studio HDR light rig if visual comparisons show insufficient true material reflection, but that should be measured against iPhone WebGL frame cost.
