# Holtzman

A web app for designing **fold-out sheet metal sculptures**. You start with one flat plate. The plasma cutter drops some shapes out entirely and cuts others free on every side but one. The uncut side is the hinge, and you fold those parts out by hand into 3D.

```
npm install
npm run dev      # http://localhost:5173
npm test         # geometry tests
npm run build
```

## How it works

| Concept | What it is |
| --- | --- |
| **Sheet** | The blank. It has an outline (rectangle, ellipse, polygon, squircle or organic blob), a material and thickness, the plasma kerf, a minimum bridge width and your cutting-bed size. |
| **Flaps** | Parts cut on every side except a straight hinge, then folded out. *Inset* flaps come out of the sheet's interior and leave a window behind. *Edge* flaps stick out past the outline and make legs, fins and crowns. |
| **Cutouts** | Holes that drop out entirely: circles, slots, polygons, or leaf/petal/spike profiles. |
| **Arrangements** | Each feature group is placed by a generator: single, radial rings, grid, phyllotaxis spiral, or evenly around the edge. |
| **Fold** | Angle, direction (up / down / alternate) and variation across the group (gradient, travelling wave, random). |
| **Hinges** | Solid (bend line on a reference layer only) or perforated (cut slots with solid bridges, for thicker plate). Optional relief holes at the hinge ends stop tearing. |
| **Roll** | Curls the finished plate into a tube (360°) or a curved panel (less). Flaps folded up stand out of the tube. Optional seam tabs tuck under the opposite edge for welding or rivets. The preview folds the flaps first, then rolls. |
| **Parts & assembly** | A project can hold several parts, and each part is one cut file. Each part's assembly array places copies as a ring or column (with *join edges*, the radius is solved so the panels meet), a tiled wall, stacked twisting layers, or a single placed piece. |
| **Auto slots** | Where one assembled part passes through another part's plate, that plate gets a matching slot: the other part's thickness (corrected for the crossing angle) plus a clearance. Two flat plates that cross each other get opposite half-depth slots so they slide together like an egg-crate. You can switch this off and set the clearance in the Parts panel. |
| **Nest** | Packs every copy of every part onto as many cutting beds as needed, and exports them as one DXF/SVG with the bed outlines on a `SHEET` layer. |

There are **53 presets** in six categories: Flora, Creatures, Geometric, Kinetic surfaces, Tubes & vessels, and multi-sheet Assemblies.

The **Cut** view shows the flat plate as it will be cut, with the bed outline. Features that break the rules show in red. The **Folded** view shows a 3D preview with a fold slider, plus *lay flat* or *stand up* display.

### Fabrication checks
- The part fits the bed, or fits it when rotated.
- Each feature keeps at least the minimum bridge to the sheet edge and to its neighbours. With *auto-prune* on, generated features that don't fit are dropped. With it off, they are flagged.
- Holes smaller than about the plate thickness are flagged, because they cut badly on plasma.
- Hinges narrower than 4× the thickness are flagged. Long solid hinges in thick plate get a note.
- Live stats show cut length, pierce count and plate weight.

### Export
- **DXF** (AutoCAD R12, POLYLINE/LINE) on layers `CUT` and `BEND`. This works with most plasma CAM software.
- **SVG** in mm with the same two layers.
- Paths are kerf **centrelines**. Kerf compensation is left to your CAM.
- **Project JSON** saves and reloads a design. The current design also autosaves in the browser.

## Code map

```
src/lib/geometry/   pure, tested geometry — no React
  shapes.ts         sheet outlines, flap profiles (spine + width profile), cutouts
  placement.ts      arrangement generators + fold-angle variation
  build.ts          design → resolved flaps/cutouts, validation, cut paths, stats
  fold.ts           flat part → rigid panels + hinge axes for the 3D view
  clipper.ts        the only clipper2-ts import (union / difference / offset / intersect)
src/lib/three/      fold + roll posing, assembly array matrices (three.js, no React)
src/lib/nest.ts     shelf-packs every copy onto beds
src/lib/export/     DXF + SVG writers
src/lib/presets.ts  defaults + factories
src/lib/presetLibrary.ts  the preset library
src/store/          zustand store (persisted)
src/components/     panels, 2D cut canvas, 3D fold view (react-three-fiber)
```

## Roadmap

- Weld tabs where assembled parts meet edge to edge, and true nesting (non-rectangular, interlocking).
- Cones (rolling to a taper) and per-copy variation inside an array.
- Flaps within flaps (nested folds), and cutout patterns *inside* flaps (veins, perforation).
- Bend allowance and inside radius per material, and folded-state collision checks.
- Patterns from seed-designer (voronoi, vein, scales …) as drop-out lattices.
- Pierce ordering and lead-ins.
