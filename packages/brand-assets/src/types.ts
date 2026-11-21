/** A single file produced by one of the generators. */
export interface GeneratedFile {
  /** File name, e.g. `favicon.ico`. */
  name: string;
  /** Absolute path the file was written to. */
  path: string;
  /** Size of the written file in bytes. */
  bytes: number;
}

/** The favicon files emitted by {@link generateIconSet}. */
export interface IconSizes {
  /** Pixel sizes bundled into `favicon.ico`. */
  ico: number[];
  /** Transparent PNGs: output file name -> pixel size. */
  transparent: Record<string, number>;
  /** Plated PNGs: output file name -> `[pixel size, padding]`. */
  plated: Record<string, readonly [size: number, padding: number]>;
}

export const defaultIconSizes: IconSizes = {
  ico: [16, 32, 48],
  transparent: {
    "favicon-32x32.png": 32,
    "favicon-96x96.png": 96,
  },
  plated: {
    "apple-touch-icon.png": [180, 18],
    "web-app-manifest-192x192.png": [192, 22],
    "web-app-manifest-512x512.png": [512, 58],
  },
};

export interface IconSetOptions {
  /** Path to the source SVG (PNG also works). */
  icon: string;
  /** Directory to write the files into. Defaults to `process.cwd()`. */
  outDir?: string;
  /** Background color for the "plated" icons, as a hex string. */
  plate?: string;
  /** Override any part of the generated file set. */
  sizes?: Partial<IconSizes>;
  /** Also copy the source SVG to `favicon.svg`. */
  copySvg?: boolean;
}

/** A Google Font to load before rendering the OG image. */
export interface OgFont {
  name: string;
  weight?: number | number[];
}

export interface OgImageOptions {
  /**
   * Path to a `.ts`/`.tsx` file that exports a React component.
   * Omit this to use the built-in OG template.
   */
  component?: string;
  /** Named export to use from `component`. Defaults to the default export. */
  exportName?: string;
  /** SVG whose contents are injected as the `iconDataUrl` prop. */
  icon?: string;
  title: string;
  description?: string;
  siteLabel?: string;
  /** Extra props forwarded to the component (they win over the built-ins). */
  props?: Record<string, unknown>;
  width?: number;
  height?: number;
  fonts?: OgFont[];
  /** Output file path. Defaults to `<outDir>/og.png`. */
  outFile?: string;
}

export interface ManifestOptions {
  name?: string;
  shortName?: string;
  themeColor?: string;
  backgroundColor?: string;
  startUrl?: string;
  display?: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  outFile?: string;
}

export interface BrandAssetsOptions extends IconSetOptions {
  /** `false` skips the OG image entirely. */
  og?: false | OgImageOptions;
  /** Pass options to emit a `site.webmanifest`, or `false` to skip (default). */
  manifest?: false | ManifestOptions;
}

export interface BrandAssetsResult {
  outDir: string;
  icons: GeneratedFile[];
  og?: GeneratedFile;
  manifest?: GeneratedFile;
}
