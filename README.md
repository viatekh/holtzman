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
  clipper.ts        the only clipper2-ts import (union / difference / offset)
src/lib/export/     DXF + SVG writers
src/lib/presets.ts  starter designs + defaults
src/store/          zustand store (persisted)
src/components/     panels, 2D cut canvas, 3D fold view (react-three-fiber)
```

## Roadmap

- **Multi-part sculptures**: several sheets welded together, with a 3D assembly view, weld-tab joinery and nesting on the bed.
- Flaps within flaps (nested folds), and cutout patterns *inside* flaps (veins, perforation).
- Bend allowance and inside radius per material, and folded-state collision checks.
- Patterns from seed-designer (voronoi, vein, scales …) as drop-out lattices.
- Pierce ordering and lead-ins.
