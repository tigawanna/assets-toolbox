# @tigawanna/expo-assets

Generate the complete Expo app-asset set from **one SVG or PNG logo** — the third member of the `assets-toolbox` monorepo.

```bash
npx @tigawanna/expo-assets --icon ./logo.svg --out ./assets/images \
  --brand-color '#0f100f' --splash-bg '#ffffff' --image-width 200
```

## Generated files

| File                          |      Size | Purpose                                                      |
| ----------------------------- | --------: | ------------------------------------------------------------ |
| `icon.png`                    | 1024×1024 | Main app icon (opaque brand background)                      |
| `adaptive-icon.png`           | 1024×1024 | Android adaptive foreground (transparent, safe-zone padding) |
| `android-icon-background.png` | 1024×1024 | Android adaptive background                                  |
| `android-icon-monochrome.png` | 1024×1024 | Android 13+ themed icon (white alpha silhouette)             |
| `splash-icon.png`             | 1024×1024 | `expo-splash-screen` icon (transparent)                      |
| `favicon.png`                 |     48×48 | Expo web favicon                                             |
| `notification-icon.png`       |     96×96 | White Android notification icon                              |
| `expo-assets.config.json`     |         — | app.json fragment pointing at all of the above               |

Optional `--dark-icon` adds `splash-icon-dark.png`; `--tinted-icon` adds `ios-tinted.png`.

The config fragment is designed to be pasted by a human **or** an agent:

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

## Programmatic API

```ts
import { generateExpoAssets } from "@tigawanna/expo-assets";

const { assets, config, agentPrompt } = await generateExpoAssets({
  icon: "logo.svg",
  outDir: "assets/images",
  brandColor: "#0f100f",
  imageWidth: 200,
});
```

## Source image guidance

A **transparent PNG or SVG**, ideally 1024×1024 or larger, gives the best results. The alpha channel of the source is used to derive the Android monochrome icon, so a flat opaque image will produce a solid square — use a transparent logo.

Splash screens can only be verified with a preview or production build; Expo Go and development builds render their own splash.

Built with `sharp`, `tsdown`, `attw`, `oxlint`/`oxfmt` and `vitest`.
