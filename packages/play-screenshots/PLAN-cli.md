# Plan: Play Store screenshot generator

Scaffold lives in this package. Fit-mode (sharp letterbox + flatten) already works. Everything below is the remaining product.

## Goal

Ship `@tigawanna/play-screenshots` as an `npx`-able CLI **and** a library, in the same shape as `expo-assets` and `brand-assets`:

1. Take raw captures (or a small config of title / subtitle / screenshot).
2. Emit Play Console-ready PNGs at official sizes, **without alpha**.
3. Write `play-screenshots.config.json` plus an `agentPrompt` so a human or coding agent can upload them.

Capture from an emulator is **out of scope**. Point people at the [Android CLI screenshot guide](https://developer.android.com/google/play/requirements/screenshots-android-cli). This package starts after the PNG exists.

## Why a new package

| Package            | Job                                                                   |
| ------------------ | --------------------------------------------------------------------- |
| `expo-assets`      | Launcher / adaptive / splash icons from one logo                      |
| `brand-assets`     | Favicons + OG image from one SVG, optional React OG component         |
| `play-screenshots` | Store listing graphics: phone/tablet/foldable shots + feature graphic |

Do not fold this into `expo-assets`. Icons and listing screenshots have different sizes, policies, and inputs.

## What is already scaffolded

| File                    | Status                                                      |
| ----------------------- | ----------------------------------------------------------- |
| `src/sizes.ts`          | Play size catalog + `getPreset` / `assertPlayBounds`        |
| `src/types.ts`          | Options, result, config fragment                            |
| `src/generate.ts`       | Fit-mode renderer (contain + flatten)                       |
| `src/cli.ts`            | `--shot`, `--preset`, `--feature-graphic`, `--list-presets` |
| `src/utils.ts`          | hex, writeAsset, configPath                                 |
| `test/generate.test.ts` | dimensions, alpha flatten, CLI parse, inventory JSON        |

Run `pnpm --filter @tigawanna/play-screenshots test` after edits.

## Product: two render modes

### 1. Fit (done)

Raw capture → exact Play size. `sharp.resize({ fit: "contain" })` then `flatten` onto `--brand-color`. Use this for Wear OS (frames and extra text are forbidden) and for "just make my emulator dumps legal".

### 2. Frame (to build)

Marketing screenshot: branded canvas + headline + optional caption + the capture, composed like `brand-assets` OG images.

Reuse the Takumi path from `packages/brand-assets/src/og.ts`:

- `jiti` to load a user `.tsx` component at runtime
- `takumi-js` `render()` at the preset width/height
- `googleFonts` for Inter (or a flag)
- Inject `title`, `subtitle`, `screenshotDataUrl`, `iconDataUrl`, `brandColor`

Default template lives at `src/default-frame.tsx`. Users pass `--component ./store/PhoneShot.tsx`.

Policy constraints the default template must encode:

- Tagline occupies **at most ~20%** of the image (Play recommendation).
- No ranking / price / CTA copy (`Best`, `#1`, `Download now`).
- Feature graphic keeps the focal point in the **center**; pad ~10% on the left/right so Play overlays do not crop the slogan.
- Wear / watch-face presets **refuse** frame mode and fall back to fit.

## Official sizes (source of truth: `src/sizes.ts`)

Confirm against Play Console Help before changing numbers.

| Preset             |      Size | Section         | Notes                                          |
| ------------------ | --------: | --------------- | ---------------------------------------------- |
| `phone-portrait`   | 1080×1920 | Phone           | 9:16, promotion minimum                        |
| `phone-landscape`  | 1920×1080 | Phone           | 16:9                                           |
| `phone-tall`       | 1080×2400 | Phone           | `medium_phone` emulator, still under 2.3:1     |
| `tablet-portrait`  | 1600×2560 | 7" + 10"        | Duplicate path into both slots                 |
| `tablet-landscape` | 2560×1600 | 7" + 10"        | `medium_tablet`                                |
| `foldable-square`  | 2106×2106 | Foldable        | 1:1 unfolded. Required if you upload foldables |
| `foldable-wide`    | 2688×2016 | Foldable        | 4:3 unfolded                                   |
| `foldable-cover`   | 1260×2016 | Foldable        | 10:16 folded. **Not** 9:16                     |
| `chromebook`       | 1920×1080 | Chromebook      | 16:9                                           |
| `wear`             |   384×384 | Wear OS         | No frames, no extra text, no transparency      |
| `tv`               | 1920×1080 | TV              | Required to publish a TV app                   |
| `tv-banner`        |  1280×720 | TV banner       | Required for TV                                |
| `xr`               | 3840×2400 | Android XR      | 8:5, 4–8 shots                                 |
| `auto-portrait`    |  800×1280 | Automotive      | Generic system UI only                         |
| `auto-landscape`   |  1024×768 | Automotive      |                                                |
| `feature-graphic`  |  1024×500 | Feature graphic | Required to publish                            |
| `play-icon`        |   512×512 | App icon        | **Keep alpha**. Max 1024 KB                    |

Hard rules for every screenshot and the feature graphic:

- JPEG or **24-bit PNG, no alpha**
- Phone/tablet: each side 320–3840 px (tablets 1080–7680), long ≤ 2.3× short
- File ≤ 8 MB
- At least **two** screenshots to publish; **four** at ≥1080p 9:16/16:9 to be eligible for screenshot-based promotion

## Target API

Keep the current `generatePlayScreenshots` signature. Add, do not replace:

```ts
await generatePlayScreenshots({
  shots: [
    { file: "shots/home.png", title: "Inbox zero", subtitle: "Works offline", alt: "Empty inbox" },
    { file: "shots/search.png", title: "Find anything" },
  ],
  mode: "frame", // "fit" (default, already built) | "frame"
  component: "./store/Shot.tsx",
  exportName: "PhoneShot",
  presets: ["phone-portrait", "tablet-landscape"],
  featureGraphic: true,
  locale: "en-US",
  layout: "flat", // later: "fastlane"
  outDir: "store/google",
  brandColor: "#0f100f",
});
```

CLI should grow to match `brand-assets`:

```
play-screenshots --shot home.png --title "Inbox zero" --subtitle "Works offline" \
  --mode frame --component ./store/Shot.tsx --preset phone-portrait
```

Also accept a config file so a listing of 8 shots is not 8 flags:

```
play-screenshots --config ./store/play-screenshots.config.ts
```

Load it with the same `jiti` helper as OG components. Shape:

```ts
export default {
  brandColor: "#0f100f",
  presets: ["phone-portrait"],
  featureGraphic: true,
  shots: [{ file: "./shots/home.png", title: "Inbox zero" }],
};
```

## File map to implement

Add these. Do not rewrite the scaffold unless a type needs a field.

| File                    | What to do                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/default-frame.tsx` | Built-in marketing template. Portrait: headline top ~18%, capture below, brand fill. Landscape: headline left, capture right. Feature graphic: centered slogan, no device chrome (Play advises against device imagery). |
| `src/render.ts`         | Copy `loadOgComponent` / `render()` from `brand-assets/src/og.ts`. Take width/height from the preset. Convert the shot PNG to a data URL (not only SVG).                                                                |
| `src/fit.ts`            | Move `fitToPreset` out of `generate.ts`. Keep generate as the orchestrator.                                                                                                                                             |
| `src/validate.ts`       | After write: no alpha, size ≤ 8 MB, alt ≤ 140 chars, tagline-area heuristic for frame mode, reject banned phrases.                                                                                                      |
| `src/config.ts`         | Build the JSON inventory + `agentPrompt`. Optional `--layout fastlane` writing `metadata/android/<locale>/images/phoneScreenshots/`.                                                                                    |
| `src/types.ts`          | Add `mode`, `title`, `subtitle`, `component`, `locale`, `layout`.                                                                                                                                                       |
| `src/cli.ts`            | `--mode`, `--title` (per-shot is awkward on CLI — prefer `--config` once more than one shot has copy), `--component`, `--list-presets` already exists.                                                                  |
| `package.json`          | Add `takumi-js`, `jiti`, `react` peer — same versions as `brand-assets`.                                                                                                                                                |

## Phases

Do these in order. Each phase should leave `pnpm test` / `typecheck` / `check-exports` green.

### Phase 1 — Validation and JPEG (small)

- `validate.ts`: metadata check (no alpha unless `play-icon`), byte-size cap, `assertPlayBounds` on output not just the preset.
- `--format png|jpeg`. JPEG is often smaller for photos of UI; PNG stays default.
- Fail the run if a written file is > 8 MB.

### Phase 2 — Default marketing frame

- Add Takumi + React peer.
- `default-frame.tsx` for `phone-portrait` and `phone-landscape`.
- `--mode frame --title --subtitle`. One title applies to all shots on the CLI; per-shot titles come from `--config`.
- Tests: output still 1080×1920, still opaque, and a mid-band of pixels is not the brand fill (the capture landed on the canvas).

### Phase 3 — Pluggable component

- `loadFrameComponent` via jiti, same export fallbacks as OG (`default`, `Frame`, `Screenshot`, `Image`).
- Fixture `test/fixtures/Frame.tsx` mirroring `brand-assets/test/fixtures/OgImage.tsx`.
- Document the prop contract in the README.

### Phase 4 — Feature graphic template

- Dedicated `default-feature.tsx` (not the phone frame scaled down).
- Safe-zone padding: keep type/logo out of the left ~8% and right ~8%.
- Default copy: app name + one short value prop. No device mockup.

### Phase 5 — Locales and fastlane layout

- `--locale en-US` (repeatable later).
- `--layout fastlane` writes:

  ```
  metadata/android/en-US/images/phoneScreenshots/01.png
  metadata/android/en-US/images/sevenInchScreenshots/
  metadata/android/en-US/images/tenInchScreenshots/
  metadata/android/en-US/images/featureGraphic.png
  ```

- Keep `play-screenshots.config.json` either way.

### Phase 6 — The rest of the catalog

Fit-mode already emits any preset. Frame-mode needs layouts for:

1. Tablet (more canvas around the capture)
2. Foldable (1:1 and 4:3 — do not letterbox a 9:16 phone UI into the foldable slot)
3. Wear (frame mode must throw)
4. TV banner
5. `play-icon` — probably a thin wrapper around `expo-assets` 512 resize with alpha preserved; or tell people to use `expo-assets`

Skip device-bezel SVG frames unless a user asks. Play explicitly warns that device imagery dates poorly.

## Default frame layout (phase 2)

Portrait 1080×1920:

```
┌─────────────────────┐
│  72px pad           │
│  TITLE              │  ~14%  Inter 700, ≤ 3 lines
│  subtitle           │  ~6%   Inter 400
│                     │
│     ┌─────────┐     │
│     │ capture │     │  rounded 32px, max ~62% height
│     │         │     │  contain, no extra bezel
│     └─────────┘     │
│                     │
└─────────────────────┘
```

Headline + subtitle together must stay under 20% of height.

Feature graphic 1024×500:

```
┌── / cutoff / ── slogan + capture strip ── / cutoff / ──┐
│  ~80px     centered type, no device chrome      ~80px  │
└────────────────────────────────────────────────────────┘
```

Takumi is flexbox-in-JS like satori. Copy the style dialect from `brand-assets/src/default-og.tsx` (`display: "flex"` on every node).

## Tests to add with each phase

- Phase 1: a transparent source becomes opaque; a >8 MB mock fails (or a 3840×2400 PNG is under the cap).
- Phase 2: frame output matches preset size; `--mode fit` still matches current tests.
- Phase 3: named export and default export both load.
- Phase 4: feature graphic is 1024×500 and opaque.
- Phase 5: fastlane paths exist for `phoneScreenshots` and `featureGraphic.png`.
- Policy: `validate.ts` throws on title `"Best app #1 — Download now"`.

Keep using temp dirs + `sharp.metadata()` like `expo-assets/test/assets.test.ts`. Generate source PNGs in the test; do not check in large fixtures.

## Play policy the validator should know

From [Add preview assets](https://support.google.com/googleplay/android-developer/answer/9866151):

- Banned in taglines: Best, #1, Top, New, Discount, Sale, Million Downloads, Free (as promo), Download/Install/Play/Try now.
- Alt text: ≤140 chars, no leading "photo of" / "image of".
- Screenshots should show the actual UI. Stylized multi-image sequences are allowed but the first three should prioritize UI.
- Do not show carrier names or notifications in the status bar of raw captures — mention this in the README, do not try to inpaint it.
- Feature graphic: avoid pure white / dark gray fills (they vanish on the Play Store chrome). Warn if `--brand-color` is `#fff` / `#000` / `#111`.

## Out of scope

- Driving the Android emulator or `adb screencap`
- App Store / iPhone screenshot sizes (new package later, or a preset family behind `--store apple`)
- Video / YouTube preview URLs
- Uploading to Play Console (the JSON + agent prompt is the integration)
- AI-generated fake UI

## References

- [Play Console Help — preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Capture screenshots with the Android CLI](https://developer.android.com/google/play/requirements/screenshots-android-cli)
- `packages/brand-assets/src/og.ts` — jiti + Takumi pattern to copy
- `packages/expo-assets/src/assets.ts` — sharp canvas / flatten pattern already used in fit-mode
