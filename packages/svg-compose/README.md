# @tigawanna/svg-compose

A local SVG icon editor built around the **live SVG DOM** — no canvas renderer, no Konva. Groups, paths, rects, ids and transforms in the document are the real thing, so export is just serialization and stays faithful to the source.

> **Status:** this package is `private: true` and is not published to npm. It is a local-only app in this monorepo.

```bash
pnpm install
pnpm --filter @tigawanna/svg-compose dev
# http://127.0.0.1:4330
```

## Architecture

- `src/canvas/stage.ts` — imperative `Stage` that owns a real `<svg>`; pointer math goes through `getScreenCTM().inverse()`. React never renders document nodes.
- `src/doc/` — import (DOMPurify sanitize, id assignment, normalization), export (serialize + recompute `viewBox`), id and transform helpers.
- `src/history/stack.ts` — snapshot command stack over `docGroup.innerHTML`; undo is lossless.
- `src/components/` — React chrome only: tool rail, layers tree, inspector, HUD, keyboard-shortcuts dialog.
- `src/tools/types.ts` — seam for the tool state machine used by later phases.
- Selection outlines and handles live in `#overlay`, a sibling of `#doc`, so they can never leak into an export.

## Current features (Phases 1–6 + shortcuts)

- **Foundation:** pan (space-drag / shift-wheel), zoom (wheel, anchored at pointer), fit to content (`Ctrl+0`), recenter on the selection or all content (`C`, keeps the current zoom), resize-aware viewBox.
- **Import:** file picker, drag/drop, and paste SVG markup. Scripts, `foreignObject`, event handlers and `javascript:` links are stripped; every element gets a stable id.
- **Export:** whole-document SVG with a padded viewBox recomputed from the content, and 2× PNG.
- **Selection:** click picks the top-level object in scope; `Ctrl+click` picks an object inside a group; `Shift+click` extends the selection; `Alt+click` picks the object underneath; double-click enters a group and the sidebar offers **Exit group**. Drag a selection to move it; `Ctrl+drag` makes a copy and drags that instead. A single selection shows four corner boxes to **scale** (hold Shift for uniform) and an amber handle above it to **rotate**. Both are single undo steps. While a transform tool is active these generic boxes are hidden so its own handle is unambiguous; clicking elsewhere still selects another object.
- **Layers tree:** nested structure with hide/show and selection synced to the canvas. Each row has a hover trash button, and right-clicking a row opens a small menu with Delete layer / Duplicate layer (and Enter group for groups). All are undoable.
- **Editing:** delete, duplicate, move up/down/front/back (all undoable), and visible selection boxes with corner handles.
- **Arrange:** group, ungroup (baking the group's transform into children), detach nested objects into the document root, and align left/center/right/top/middle/bottom. Group needs at least two selected objects — Shift+click to add more — and works even when they sit at different nesting levels (ancestor transforms are baked in so nothing moves). The sidebar explains this when the button is disabled.
- **Drawing:** rect, ellipse, line and a click-to-add-points pen; previews live in a tool overlay and are never exported.
- **Node tool:** Object to Path converts shapes (using the `0.5523` circle constant for smooth corners); the node tool shows anchors and bezier handles, drags them live, toggles smooth/corner with `S`, and deletes the focused node. Step 1: select a shape and press `Ctrl+Shift+C`. Step 2: press `N`, then drag square anchors to move nodes or circle handles to bend curves; click a green **+** dot on a segment to **insert a node** there (bezier handles are split correctly); press `S` to make the focused node smooth (turns a converted rectangle into a rounded shape/ellipse) or corner again; `Del` removes a node. The sidebar shows this cheat-sheet whenever the tool is active.
- **Tool rail:** grouped into **Create** (Select/Rect/Ellipse/Line/Pen/Text) and **Transform** (Node/morph, Morph corners, Rotate, Scale/stretch), with icons, labels, shortcut badges, and tooltips when collapsed.
- **Interface:** tools live in a collapsible left rail — icons only when collapsed, icon + label + shortcut badge when expanded, with tooltips in the collapsed state. The right sidebar's Selection actions use the same one-per-row pattern (icon + label + shortcut badge), with native tooltips plus a hover description line — e.g. Ungroup explains that it disassembles a group, Object to Path explains that it enables node morphing. The right inspector has its own collapse trigger, and **Focus mode** hides both panels at once (`Ctrl/Cmd+B` or `[` toggles the left rail, `]` toggles the right). A small HUD at the edge of the canvas announces the shortcut you just used (`R` → "Rectangle tool") and shows a persistent "Moving 1 item · release to drop" chip while dragging. The app fills the viewport (`100dvh`); each sidebar scrolls independently while the rail logo and inspector header stay pinned.
- **Inspector:** fill and stroke swatches plus a custom color picker, stroke width, corner radius and rotation (slider + number), and text content/font size when a text object is selected. Changes apply to the whole selected group and are undoable.
- **Shaping tools:** the **Morph corners** tool (`K`) shows one draggable handle that rounds **all** corners uniformly — it works on rectangles and on 4-node paths made with Object to Path. **Node / morph** (`N`) is the general editor: it reveals every anchor and bezier handle so you can reshape one node at a time, toggle smooth/corner per node, or delete nodes. The **Rotate** tool (`O`) shows a handle above the object's centre for drag rotation. Rotation is baked into the element's `transform` around its own centre, so the object stays in place.
- **Text:** press `T` (or use the rail) then click the canvas to place text; edit it in the inspector.
- **Help:** press `Shift+?` (or click `?`) for a YouTube-style keyboard shortcuts dialog; `Escape` closes it.

## Shortcuts, keys and combos

Press `Shift+?` in the app for the same reference in a YouTube-style dialog. All shortcuts are skipped while you are typing in a field.

### Keyboard

| Keys                                   | Action                                                             |
| -------------------------------------- | ------------------------------------------------------------------ |
| `Shift + ?`                            | Open/close the shortcuts dialog                                    |
| `Escape`                               | Close dialog; otherwise deselect, then exit the entered group      |
| `Ctrl/Cmd + Z`                         | Undo                                                               |
| `Ctrl/Cmd + Shift + Z`, `Ctrl/Cmd + Y` | Redo                                                               |
| `Ctrl/Cmd + D`                         | Duplicate selection                                                |
| `Ctrl/Cmd + G`                         | Group selection (needs 2+ objects)                                 |
| `Ctrl/Cmd + Shift + G`                 | Ungroup — disassemble a group and bake its transform into children |
| `Ctrl/Cmd + Shift + C`                 | Object to Path — convert a shape so its nodes can be morphed       |
| `Ctrl/Cmd + 0`                         | Fit document to view (changes zoom)                                |
| `C`                                    | Recenter view on selection/document (keeps zoom)                   |
| `V` / `R` / `E` / `L`                  | Select / Rectangle / Ellipse / Line                                |
| `P` / `N` / `T`                        | Pen / Node-morph / Text                                            |
| `K` / `O`                              | Morph corners / Rotate tool                                        |
| `S`                                    | With Node tool: smooth ↔ corner node. Otherwise: scale hint        |
| `Delete` / `Backspace`                 | Delete selection                                                   |
| `Ctrl/Cmd + B` or `[`                  | Toggle left tool rail                                              |
| `]`                                    | Toggle right inspector                                             |
| `\`                                    | Focus mode — hide both sidebars at once                            |

### Mouse and pointer combos

| Gesture                                   | Action                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Click`                                   | Select the top-level object in the current scope                                           |
| `Shift + click`                           | Add to / remove from the selection                                                         |
| `Ctrl + click`                            | Select a shape _inside_ a group without entering it                                        |
| `Ctrl + Shift + click`                    | Add that inner shape to a multi-selection                                                  |
| `Alt + click`                             | Select the object underneath the current one                                               |
| `Double-click` a group                    | Enter it; children become directly selectable (use **Exit group** or `Esc` twice to leave) |
| `Drag` a selection                        | Move it (one undo step)                                                                    |
| `Ctrl + drag`                             | Duplicate and drag the copy (original stays put)                                           |
| `Space + drag`                            | Pan the canvas                                                                             |
| `Wheel` / `Shift + wheel`                 | Zoom at pointer / pan horizontally                                                         |
| Corner box `drag`                         | Scale around the opposite corner                                                           |
| `Shift +` corner box drag                 | Uniform scale                                                                              |
| Amber top handle `drag`                   | Rotate around the object's centre                                                          |
| Orange handle `drag` (Morph corners)      | Round all corners of a rect or 4-node path                                                 |
| Green `+` dot `click` (Node tool)         | Insert a node at a segment midpoint                                                        |
| Square node `drag` / circle handle `drag` | Move a node / bend a bezier handle                                                         |
| Layer row trash button                    | Delete that layer                                                                          |
| Right-click a layer row                   | Delete / Duplicate layer, or Enter group                                                   |

### Common combos

| Goal                                | Steps                                                                |
| ----------------------------------- | -------------------------------------------------------------------- |
| Square → rounded square             | Select rect → `K` → drag the orange corner handle                    |
| Square → ellipse                    | Select rect → `Ctrl+Shift+C` → `N` → click each node → `S` to smooth |
| Morph from a new angle              | `N` → click a green `+` dot → drag the new node or its handles       |
| Group a shape pulled out of a group | `Ctrl+click` the inner shape → `Shift+click` another → `Ctrl+G`      |
| Copy while arranging                | `Ctrl+drag` the object instead of duplicating first                  |
| Frame your work                     | `Ctrl+0` fits the zoom, then `C` centres it without changing zoom    |
| Undo a whole drag                   | `Ctrl+Z` — each drag/transform is one snapshot                       |

## Acceptance test

`test/selection.test.ts` and `test/doc.test.ts` cover the box-plus-circle workflow: import an SVG containing a box and a plus, confirm the inner shapes survive as structured DOM nodes, select the inner path through the group, and export with the shapes intact and no overlay markup. Later phases extend this with pull-out / circle-in-middle / group steps.

## Not built yet

Phase 7 (boolean operations — union, difference, intersection, combine, break apart) and the rest of Phase 8 polish (snapping, full property inspector, export selection/layer). The node tool currently handles `M`/`L`/`C`/`Z` paths produced by this editor; paths with arcs or quadratic curves from arbitrary imports can be selected and transformed but not node-edited.

## Validation

```bash
pnpm --filter @tigawanna/svg-compose test
pnpm --filter @tigawanna/svg-compose typecheck
pnpm --filter @tigawanna/svg-compose build
```

Tests run in jsdom (DOMPurify needs a standards-compliant HTML parser; happy-dom drops SVG children during sanitization).
