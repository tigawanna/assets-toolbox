export interface GeneratedAsset {
  name: string;
  path: string;
  bytes: number;
  width: number;
  height: number;
}

/** app.json fragment pointing at everything that was generated. */
export interface ExpoConfigSnippet {
  expo: {
    icon: string;
    android: {
      adaptiveIcon: {
        foregroundImage: string;
        backgroundImage: string;
        monochromeImage: string;
      };
    };
    web: { favicon: string };
    plugins: Array<[string, Record<string, unknown>]>;
  };
}

export interface ExpoAssetOptions {
  /** Source logo — a transparent SVG or PNG works best. */
  icon: string;
  /** Output directory. Default `assets/images` relative to the cwd. */
  outDir?: string | undefined;
  /** App icon / adaptive background color. Default `#0f100f`. */
  brandColor?: string | undefined;
  /** Background color written into the expo-splash-screen plugin config. Default `#ffffff`. */
  splashBackground?: string | undefined;
  /** `imageWidth` for expo-splash-screen. Default 200. */
  imageWidth?: number | undefined;
  /** Logo size inside the 1024px adaptive foreground. Default 660. */
  foregroundSize?: number | undefined;
  /** Logo size inside the 1024px splash icon. Default 620. */
  splashLogoSize?: number | undefined;
  /** Optional transparent logo used for the iOS dark icon. */
  darkIcon?: string | undefined;
  /** Optional grayscale logo used for the iOS tinted icon. */
  tintedIcon?: string | undefined;
  /** Skip the Android monochrome (themed) icon. */
  noMonochrome?: boolean | undefined;
  /** Write the app.json snippet to disk. Default true. */
  writeConfig?: boolean | undefined;
  /** Where to write the snippet. Default `<outDir>/expo-assets.config.json`. */
  configOut?: string | undefined;
}

export interface ExpoAssetsResult {
  outDir: string;
  assets: GeneratedAsset[];
  config: ExpoConfigSnippet;
  configPath?: string;
  /** One-line instruction an agent can follow to wire the assets up. */
  agentPrompt: string;
}

export const EXPO_ASSET_DEFAULTS = {
  outDir: "assets/images",
  brandColor: "#0f100f",
  splashBackground: "#ffffff",
  imageWidth: 200,
  foregroundSize: 660,
  splashLogoSize: 620,
} as const;
