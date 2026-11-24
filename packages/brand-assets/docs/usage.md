# @tigawanna/brand-assets — usage guide

One SVG in, a complete favicon set and social card out. This page goes deeper than the [README](../README.md): exact flags, the OG component contract, and the programmatic API.

## Requirements

- **Node.js 20+**
- `react >= 18` as a peer dependency — the OG image is rendered as a React tree through `takumi-js`. Install it once in your app (`npm i react`).
- A source SVG (PNG also works). Keep a 1024×1024 version around for crisp large icons.
- Custom OG components must be a `.ts`/`.tsx` file on disk when the command runs; `jiti` loads them directly, so there is no build step.

## Install / run

```bash
# local install (library + CLI)
npm i -D @tigawanna/brand-assets react

# one-off, no install
npx @tigawanna/brand-assets --icon ./public/logo.svg --out ./public --title "My site"
```

## 1. The default workflow

```bash
brand-assets --icon ./public/logo.svg --out ./public \
  --title "My site" \
  --description "The one-line pitch used on social cards" \
  --site-label "My site" \
  --plate '#0f100f' \
  --manifest --site-name "My site"
```

This writes the favicon set, `og.png`, and `site.webmanifest` into `./public`. Every file path is printed as it is written.

### CLI commands

| Command                              | What it runs                              |
| ------------------------------------ | ----------------------------------------- |
| `brand-assets --icon …` (or `all`)   | Icons + OG image (default)                |
| `brand-assets icons --icon …`        | Favicon set only; `--title` is not needed |
| `brand-assets og --icon … --title …` | OG image only                             |

### CLI options

| Flag                          | Default            | Notes                                                                            |
| ----------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `-i, --icon <path>`           | —                  | **Required.** Source SVG (or PNG).                                               |
| `-o, --out <dir>`             | cwd                | Output directory for all generated files.                                        |
| `-c, --component <path>`      | built-in template  | `.ts`/`.tsx` file exporting a React OG component.                                |
| `--export-name <name>`        | first valid export | Pick a named export instead of `default` / `OgImage` / `Og` / `Image`.           |
| `-t, --title <text>`          | —                  | **Required unless `--no-og`.** OG headline.                                      |
| `-d, --description <text>`    | —                  | OG description.                                                                  |
| `--site-label <text>`         | `""`               | Small label in the card header/footer.                                           |
| `--plate <hex>`               | `#0f100f`          | Background for the "plated" touch/manifest icons.                                |
| `--width <n>`, `--height <n>` | `1200`, `630`      | OG image size.                                                                   |
| `--copy-svg`                  | off                | Also write `favicon.svg`.                                                        |
| `--manifest`                  | off                | Also write `site.webmanifest`.                                                   |
| `--site-name <text>`          | `App`              | Manifest `name`. `--short-name`, `--theme-color`, `--background-color` work too. |
| `--no-og`, `--no-icons`       | off                | Skip one half of the default command.                                            |
| `-h, --help`                  | —                  | Print the built-in help.                                                         |

Flags can also be written with `=` (e.g. `--title="My site"`).

### Generated files

| File                                                           |            Size | Why                                    |
| -------------------------------------------------------------- | --------------: | -------------------------------------- |
| `favicon.ico`                                                  | 16/32/48 packed | Legacy browser tab icon.               |
| `favicon-32x32.png`, `favicon-96x96.png`                       |        32², 96² | Modern browser icons.                  |
| `apple-touch-icon.png`                                         |            180² | iOS home screen (padded on `--plate`). |
| `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png` |      192², 512² | PWA manifest icons (padded).           |
| `og.png`                                                       |        1200×630 | Social share card.                     |
| `site.webmanifest`                                             |               — | Only with `--manifest`.                |
| `favicon.svg`                                                  |               — | Only with `--copy-svg`.                |

## 2. Bring your own OG component

Your component is loaded at runtime with `jiti` and rendered by `takumi-js`. Use plain inline styles and flexbox — there is no browser CSS pipeline, so CSS files, external stylesheets, and Tailwind classes will not apply.

```tsx
// src/og/OgImage.tsx
export default function OgImage({
  title,
  description,
  siteLabel,
  iconDataUrl,
}: {
  title: string;
  description?: string;
  siteLabel?: string;
  iconDataUrl?: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 24,
        padding: 72,
        background: "#0f100f",
        color: "#f5f5f0",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28 }}>
        {iconDataUrl ? <img src={iconDataUrl} width={48} height={48} /> : null}
        {siteLabel}
      </div>
      <div style={{ display: "flex", fontSize: 68, fontWeight: 700 }}>{title}</div>
      {description ? (
        <div style={{ display: "flex", fontSize: 30, color: "#cfd3c8" }}>{description}</div>
      ) : null}
    </div>
  );
}
```

```bash
brand-assets --icon ./logo.svg --title "My site" \
  --component ./src/og/OgImage.tsx
```

Injected props:

| Prop          | Source                                          |
| ------------- | ----------------------------------------------- |
| `title`       | `--title`                                       |
| `description` | `--description`                                 |
| `siteLabel`   | `--site-label`                                  |
| `iconDataUrl` | `data:image/svg+xml;utf8,…` built from `--icon` |

Extra props can be supplied programmatically via `og.props` and take precedence over the built-in values. Default font is Inter (400/600/700); override with `og.fonts`.

## 3. Programmatic API

```ts
import {
  generateBrandAssets,
  generateIconSet,
  renderOgImage,
  generateManifest,
  type BrandAssetsOptions,
} from "@tigawanna/brand-assets";

const options: BrandAssetsOptions = {
  icon: "public/logo.svg",
  outDir: "public",
  plate: "#0f100f",
  og: { title: "My site", component: "./src/og/OgImage.tsx" },
  manifest: { name: "My site", shortName: "Site" },
};

const { icons, og, manifest } = await generateBrandAssets(options);

// Or run just one step:
await generateIconSet({ icon: "public/logo.svg", outDir: "public", copySvg: true });
await renderOgImage({ icon: "public/logo.svg", title: "My site", width: 1200 });
generateManifest({ name: "My site", outFile: "public/site.webmanifest" });
```

Every generator returns a `GeneratedFile` (`name`, absolute `path`, `bytes`). `generateIconSet` returns an array; `renderOgImage` returns `{ buffer, file }`. Pass `og: false` / `manifest: false` to skip those parts of `generateBrandAssets`. Option interfaces are exported from the package root: `IconSetOptions`, `OgImageOptions`, `ManifestOptions`, `IconSizes`, `OgFont`.

## 4. Troubleshooting

- **`--title is required`** — OG generation needs a title. Add `--title`, or use `icons` / `--no-og`.
- **Component exports not found** — the loader tries `default`, `OgImage`, `Og`, `Image`. Export one of those or pass `--export-name <name>`. Make sure the file path is relative to your current shell directory.
- **OG looks unstyled** — use inline styles only; `takumi-js` does not process CSS classes or external stylesheets.
- **Fonts do not render** — `googleFonts()` fetches fonts at generation time; the machine running the CLI needs network access, or you can pass a locally available font through `og.fonts`.
- **Sharp install problems** — `sharp` ships platform binaries; on unusual architectures install with the matching optional dependency or build from source. Node 20+ is required.

Publishing status and release notes: [CHANGELOG.md](../CHANGELOG.md).
