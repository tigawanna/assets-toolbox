# @tigawanna/appstore-screenshots

Make **App Store Connect**-ready screenshots: exact preset sizes, no alpha, and a JSON inventory.
This package is a library plus a thin CLI for **fit mode only** — a raw simulator capture becomes an
exact-size, flattened image. The [Store Studio](https://github.com/tigawanna/assets-toolbox) editor
does the designed output.

```bash
npx @tigawanna/appstore-screenshots --shot ./shots/home.png --shot ./shots/search.png \
  --preset iphone-6-9 --preset ipad-13 --out ./store/appstore
```

Capturing from a simulator is out of scope. This package starts once the PNG or JPEG exists.

## Presets

| Preset       | Portrait size | Display                              |
| ------------ | ------------: | ------------------------------------ |
| `iphone-6-9` |     1320×2868 | iPhone 6.9" (covers smaller iPhones) |
| `iphone-6-5` |     1284×2778 | iPhone 6.5" (also accepts 1242×2688) |
| `ipad-13`    |     2064×2752 | iPad 13" (covers smaller iPads)      |
| `ipad-12-9`  |     2048×2732 | iPad 12.9"                           |

Each also has a `-landscape` id with the sides swapped. **All numbers in `src/sizes.ts` are marked
`verify`** — re-check them against
[Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/)
before release. Apple adds display sizes over time.

## What the CLI does

- `sharp.resize({ fit: "contain" })` into the exact preset, letterboxed onto `--brand-color`.
- Flattens alpha: App Store Connect rejects transparency, so screenshots are always opaque.
- Writes PNG (default) or JPEG (`--format jpeg`, quality 90), then checks exact dimensions,
  encoding, absence of alpha and the 8 MB cap for every written file.
- Writes `appstore-screenshots.config.json`: the relative paths, dimensions and an agent prompt.

Out of scope by design: video app previews, a feature graphic (App Store has no equivalent),
device frames and drawn status bars.

## Policy checks

`checkAltText`, `assertAltText`, `checkScreenshotCounts`, `assertScreenshotCounts` and the constants
are **pure** — no `sharp`, no disk — so the editor can run them in a webview. The App Store has no
banned-words list and no text-coverage cap, so those Play rules are deliberately absent.

- Alt text: at most 140 characters, and it should not start with "photo of" / "image of".
- Counts: warn at 0 screenshots per display size, error above 10 per display size per localization.

Byte-level checks live in `validate.ts` (`validateOutputFile`, `assertMaxFileSize`).

## Deliver layout

`--layout deliver --locale en-US` writes into fastlane's tree under the output directory while
keeping the JSON inventory:

```
store/appstore/
  fastlane/screenshots/en-US/
    iPhone 6.9-01.png
    iPad 13-01.png
  appstore-screenshots.config.json
```

Flat layout writes `01-iphone-6-9.png`, `02-iphone-6-9.png`, … directly into the output directory.
Check the exact filenames deliver expects in the
[deliver docs](https://docs.fastlane.tools/actions/deliver/) before release.

## Programmatic API

```ts
import { generateAppStoreScreenshots, buildInventory } from "@tigawanna/appstore-screenshots";

const { assets, config, agentPrompt, warnings } = await generateAppStoreScreenshots({
  shots: [{ file: "shots/home.png", alt: "Home timeline" }],
  outDir: "store/appstore",
  presets: ["iphone-6-9"],
  layout: "flat",
  brandColor: "#0f100f",
});
```

`npx @tigawanna/appstore-screenshots --list-presets` prints the full catalog. Built with `sharp`,
`tsdown`, `attw`, `oxlint`/`oxfmt` and `vitest`.
