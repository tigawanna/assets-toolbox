# @tigawanna/play-screenshots

Make **Google Play Console**-ready screenshots: exact preset sizes, no alpha, a JSON inventory,
and — in `frame` mode — a composed marketing layout with a headline and your capture.

```bash
npx @tigawanna/play-screenshots --shot ./shots/home.png --shot ./shots/search.png \
  --preset phone-portrait --feature-graphic --out ./store/google
```

Capture from a device or emulator is out of scope. Point people at the
[Android CLI screenshot guide](https://developer.android.com/google/play/requirements/screenshots-android-cli);
this package starts once the PNG exists.

## Two render modes

| Mode            | What it does                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fit` (default) | `sharp.resize({ fit: "contain" })` into the exact preset, then flatten alpha onto `--brand-color`. Legal, minimal.                                                                           |
| `frame`         | Composes a marketing frame with Takumi: headline top (or left in landscape), subtitle, rounded capture, brand fill. A dedicated feature-graphic template keeps type out of Play's cut zones. |

```bash
# frame mode with the built-in template
npx @tigawanna/play-screenshots --shot ./shots/home.png --mode frame \
  --title "Inbox zero" --subtitle "Works offline" --app-name "Hollow" \
  --preset phone-portrait --feature-graphic
```

Frame-mode copy is checked against Play's promotional-word policy (`Best`, `#1`,
`Download now`, …) and the ~20% tagline-area guidance. Wear / Automotive presets
refuse frame mode; `play-icon` keeps its alpha and always uses fit.

## Config file

For a full listing, put the copy next to the shots and load it with `--config`:

```ts
// store/play-screenshots.config.ts
export default {
  brandColor: "#0f100f",
  presets: ["phone-portrait", "tablet-landscape"],
  featureGraphic: true,
  shots: [
    {
      file: "./shots/home.png",
      title: "Inbox zero",
      subtitle: "Works offline",
      alt: "Empty inbox",
    },
    { file: "./shots/search.png", title: "Find anything" },
  ],
};
```

```bash
npx @tigawanna/play-screenshots --config ./store/play-screenshots.config.ts
```

## Validation and formats

Every written file is checked against its preset: exact dimensions, the requested
encoding, **no alpha channel** (except `play-icon`), and the 8 MB cap. Failures
abort the run. `--format png|jpeg` switches the encoding (PNG is the default;
JPEG is often smaller for captures).

`checkAltText`, `assertNoBannedWords`, `checkScreenshotCounts`,
`checkTaglineCoverage`, `buildInventory` and the rest of the policy helpers are
exported as pure functions so the Store Studio editor can run the same checks.

## Fastlane layout

`--layout fastlane --locale en-US` writes into the conventional tree under the
output directory and keeps `play-screenshots.config.json`:

```
store/google/metadata/android/en-US/images/
  phoneScreenshots/01-phone-portrait.png
  sevenInchScreenshots/
  tenInchScreenshots/
  featureGraphic.png
```

## Generated files

Default `--preset phone-portrait` plus `--feature-graphic`:

| File                           |      Size | Play Console slot                         |
| ------------------------------ | --------: | ----------------------------------------- |
| `01-phone-portrait.png`        | 1080×1920 | Phone                                     |
| `feature-graphic.png`          |  1024×500 | Feature graphic (required to publish)     |
| `play-screenshots.config.json` |         — | Inventory + relative paths + agent prompt |

`npx @tigawanna/play-screenshots --list-presets` prints the full catalog (tablet,
foldable, Wear, TV, XR, automotive).

## Programmatic API

```ts
import { generatePlayScreenshots, buildInventory } from "@tigawanna/play-screenshots";

const { assets, config, agentPrompt, warnings } = await generatePlayScreenshots({
  shots: [{ file: "shots/home.png", alt: "Home timeline" }],
  outDir: "store/google",
  presets: ["phone-portrait"],
  featureGraphic: true,
  brandColor: "#0f100f",
});
```

Source images can be PNG, JPEG, or SVG. A **portrait capture** letterboxed onto
`--brand-color` is the intended fit-mode input; this is not a substitute for
capturing the UI on the right emulator profile.

## Pluggable frames

`--component ./store/Shot.tsx [--export-name PhoneShot]` loads a React component
with [jiti](https://github.com/unjs/jiti); no build step. It receives `title`,
`subtitle`, `screenshotDataUrl`, `appName`, `iconDataUrl`, `brandColor`,
`fontFamily` and `orientation`, and must use Takumi's flexbox-in-JS style dialect
(`display: "flex"` on every node). See `test/fixtures/Frame.tsx` for an example.

Built with `sharp`, `takumi-js`, `jiti`, `tsdown`, `attw`, `oxlint`/`oxfmt` and `vitest`.
