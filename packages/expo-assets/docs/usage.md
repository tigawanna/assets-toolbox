# @tigawanna/expo-assets — usage guide

Turn one logo into the whole Expo asset set. This page covers CLI flags, how to merge the generated `app.json` fragment, the programmatic API, and image prep. See the [README](../README.md) for the short pitch.

## Requirements

- **Node.js 20+**
- A transparent SVG or PNG logo (1024×1024 or larger recommended)
- The generated assets are plain PNGs/JSON — no Expo CLI is needed to run the generator.

## Install / run

```bash
npm i -D @tigawanna/expo-assets
# or one-off
npx @tigawanna/expo-assets --icon ./logo.svg --out ./assets/images \
  --brand-color '#0f100f' --splash-bg '#ffffff' --image-width 200
```

## 1. CLI reference

| Flag                      | Default         | Notes                                            |
| ------------------------- | --------------- | ------------------------------------------------ |
| `-i, --icon <path>`       | —               | **Required.** Source SVG or transparent PNG.     |
| `-o, --out <dir>`         | `assets/images` | Output directory for images and config fragment. |
| `--brand-color <hex>`     | `#0f100f`       | App icon background and adaptive background.     |
| `--splash-bg <hex>`       | `#ffffff`       | Written as `expo-splash-screen.backgroundColor`. |
| `--image-width <px>`      | `200`           | Written as `expo-splash-screen.imageWidth`.      |
| `--foreground-size <px>`  | `660`           | Logo size inside the 1024px adaptive foreground. |
| `--splash-logo-size <px>` | `620`           | Logo size inside the 1024px splash icon.         |
| `--dark-icon <path>`      | —               | Transparent logo for `splash-icon-dark.png`.     |
| `--tinted-icon <path>`    | —               | Grayscale logo for the iOS tinted icon.          |
| `--no-monochrome`         | off             | Skip `android-icon-monochrome.png`.              |
| `--no-config`             | off             | Skip writing `expo-assets.config.json`.          |
| `-h, --help`              | —               | Print the built-in help.                         |

`--flag=value` is supported as well as `--flag value`.

### Generated files

| File                          |  Size | Purpose                                             |
| ----------------------------- | ----: | --------------------------------------------------- |
| `icon.png`                    | 1024² | Main app icon on a brand-color background.          |
| `adaptive-icon.png`           | 1024² | Android adaptive foreground with safe-zone padding. |
| `android-icon-background.png` | 1024² | Android adaptive background.                        |
| `android-icon-monochrome.png` | 1024² | Android 13+ themed icon (white alpha silhouette).   |
| `splash-icon.png`             | 1024² | `expo-splash-screen` icon, transparent.             |
| `favicon.png`                 |   48² | Expo web favicon.                                   |
| `notification-icon.png`       |   96² | White Android notification icon.                    |
| `expo-assets.config.json`     |     — | `app.json` fragment (unless `--no-config`).         |
| `splash-icon-dark.png`        | 1024² | Only with `--dark-icon`.                            |
| `ios-tinted.png`              | 1024² | Only with `--tinted-icon`.                          |

## 2. Wire the config into your app

The CLI prints an `expo-assets.config.json` fragment shaped like this:

```json
{
  "expo": {
    "icon": "./assets/images/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      }
    },
    "web": { "favicon": "./assets/images/favicon.png" },
    "plugins": [
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "backgroundColor": "#ffffff",
          "imageWidth": 200
        }
      ]
    ]
  }
}
```

Merge it into `app.json` **deeply** — do not replace existing `expo.android`, `expo.web`, or `expo.plugins` arrays. In particular, if you already use `expo-splash-screen`, update that plugin's options instead of adding a duplicate entry. Paths are written relative to the project root when `--out` is a normal project-relative directory.

## 3. Programmatic API

```ts
import { generateExpoAssets, EXPO_ASSET_DEFAULTS } from "@tigawanna/expo-assets";

const { assets, config, configPath, agentPrompt } = await generateExpoAssets({
  icon: "logo.svg",
  outDir: "assets/images",
  brandColor: "#0f100f",
  splashBackground: "#ffffff",
  imageWidth: 200,
  // foregroundSize: 660,
  // splashLogoSize: 620,
  // darkIcon: "logo-dark.svg",
  // tintedIcon: "logo-tinted.svg",
  // noMonochrome: true,
  // writeConfig: false,
  // configOut: "app.assets.json",
});

console.log(EXPO_ASSET_DEFAULTS); // current defaults
console.log(agentPrompt); // one-line instruction for coding agents
```

`assets` is an array of `{ name, path, width, height, bytes }`. `config` is the typed `ExpoConfigSnippet`; `configPath` is set when the fragment was written. All options are typed via `ExpoAssetOptions` (exported from the package root).

## 4. Source image guidance

- Use a **transparent** SVG or PNG: the alpha channel is sampled to produce the white monochrome silhouette. A flat opaque image yields a solid square.
- Keep the mark centered with breathing room. Adaptive foregrounds reserve a safe zone; the generator scales the logo to `--foreground-size` inside a 1024px canvas.
- `--dark-icon` should be a transparent variant with enough contrast on dark splash backgrounds.
- `--tinted-icon` should be grayscale; iOS tints it for you.
- **Splash screens cannot be verified locally**: Expo Go and development builds show their own splash. Check the result in a preview or production build.

## 5. Troubleshooting

- **`--icon is required`** — add `--icon <path>`; the CLI does not guess a logo.
- **Monochrome icon is a solid square** — the source is opaque. Supply a transparent logo or use `--no-monochrome`.
- **Splash looks wrong in Expo Go** — expected; only preview/production builds use your splash config.
- **Config paths look wrong** — run the CLI from the Expo project root, or pass an absolute `--out` and merge paths manually.
- **Sharp install problems** — `sharp` needs Node 20+ and a platform binary; on unusual architectures install the matching optional dependency or build from source.

Release notes: [CHANGELOG.md](../CHANGELOG.md).
