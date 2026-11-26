export interface NativeSystemInfo {
  appName: string;
  version: string;
  os: string;
  arch: string;
  goVersion: string;
  desktop: boolean;
}

interface WailsWindow extends Window {
  go?: {
    main?: {
      App?: {
        GetSystemInfo?: () => Promise<NativeSystemInfo>;
      };
    };
  };
}

const browserPreview: NativeSystemInfo = {
  appName: "Assets Toolbox",
  version: "0.1.0",
  os: "Browser",
  arch: "preview",
  goVersion: "",
  desktop: false,
};

export async function getSystemInfo(): Promise<NativeSystemInfo> {
  if (typeof window === "undefined") return browserPreview;
  const app = (window as WailsWindow).go?.main?.App;
  return app?.GetSystemInfo ? app.GetSystemInfo() : browserPreview;
}

export function formatPlatform(info: NativeSystemInfo): string {
  return info.desktop ? `${info.os}/${info.arch}` : "Browser preview";
}
