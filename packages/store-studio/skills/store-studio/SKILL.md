---
name: store-studio
description: Use when preparing Google Play or Apple App Store listing screenshots. Triggers on store screenshots, play store listing, app store screenshots, feature graphic, store-studio, screenshot editor, marketing screenshots. Agents author the project file; a human finishes it in the editor.
---

# Store Studio

A local, template-driven screenshot editor for **Google Play** and the **Apple App Store**. This skill writes a project file that Store Studio materialises into a fully editable board. Agents choose templates and copy; they do not place pixels.

## Flow

1. **Discovery.** Ask the one question the Play skill insists on:

   > What are your top 3–6 features? For each, briefly describe what problem it solves for your users.

   If you get feature names without the problem, ask what a user would find frustrating without each. Then scan for screenshots (`.png`/`.jpg`, `screenshots/`) and an app icon (standard Android `mipmap-*` paths, `icon*.png`, `logo*.png`, `app-icon.*`). Confirm what you found before using it.

2. **Derive the palette.** Extract dominant toolbar colour → `primary`, saturated minority colour → `accent`, dominant background → `background`. State a short confirmation block and wait for approval. Never ask for hex codes you can derive. Colour extraction from captures is adapted from the Play skill (see `CREDITS.md`).

3. **Copy.** Each slide sells one outcome, not a UI tour. Use these credited formulas, summarised:
   - Hero — outcome in 3–6 words ("Inbox zero").
   - Differentiator — the thing competitors lack ("Works offline").
   - Feature — verb + benefit ("Find anything, instantly").
   - Proof — a number or fact from the real app (never invent one).
   - Closer — a calm CTA-free invitation ("Your space, organised").
   - Banned: `Best`, `#1`, `Top`, `New`, `Discount`, `Sale`, `Million Downloads`, `Free` as a promo, `Download/Install/Play/Try now`. Never claim rankings or prices.

4. **Author the project.** Write `store/studio/project.json` (Play) or `store/studio/project.json` with `store: "app-store"` (App Store). Set `boards[].source` and leave `nodes` empty — Studio materialises them on open:

   ```json
   {
     "version": 1,
     "store": "play",
     "app": { "name": "Hollow" },
     "theme": {
       "tokens": {
         "primary": "#635bff",
         "accent": "#ffb86b",
         "background": "#0f100f",
         "text": "#f7f7f3"
       },
       "fonts": {
         "heading": { "family": "Inter", "weight": 700, "size": 84 },
         "body": { "family": "Inter", "weight": 400, "size": 36 }
       }
     },
     "assets": {
       "home": { "file": "home.png", "width": 1080, "height": 2400, "kind": "screenshot" }
     },
     "boards": [
       {
         "id": "board-phone-1",
         "kind": "phone",
         "preset": "phone-portrait",
         "sliceCount": 5,
         "background": { "type": "solid", "color": { "token": "background" } },
         "source": {
           "family": "text-top",
           "input": {
             "appName": "Hollow",
             "palette": {
               "primary": "#635bff",
               "accent": "#ffb86b",
               "background": "#0f100f",
               "text": "#f7f7f3"
             },
             "slides": [
               { "headline": "Inbox zero", "subtext": "Works offline", "screenshot": "home" }
             ]
           }
         },
         "nodes": [],
         "sliceMeta": [{ "alt": "An empty inbox with a search bar" }]
       }
     ],
     "export": {
       "outDir": "store/google",
       "format": "png",
       "layout": "flat",
       "locale": "en-US",
       "zip": false
     }
   }
   ```

   Families: `text-top` (safe default), `aurora-panorama` (continuous sky across slices, tilted devices cross cuts), `full-bleed` (at most one slide), `duo-overlap`, `split-landscape` (tablet/laptop fallback), `feature-icon-left`, `feature-icon-center`.

5. **Hand off.** Tell the human to run `npx @tigawanna/store-studio store/studio --open`. They tweak layout and export. For CI, `store-studio render store/studio/project.json` writes the slices headlessly (Playwright is an optional peer).

6. **QA.** Map the reference checklist onto the editor's lint panel: actual UI in the first three shots, no carrier/notification clutter in raw captures (capture with demo mode on — do not try to inpaint it), feature focal point centred and clear of the left/right cut zones, alt text ≤140 chars and descriptive, 2–8 phone shots (4+ for promotion), Chromebook 4–8, App Store 1–10 per display size.

## Files the agent may touch

Only the project JSON and the assets it references. Do not hand-write device frames, Konva nodes, or export logic. The editor owns those.

See `CREDITS.md` for attribution.
