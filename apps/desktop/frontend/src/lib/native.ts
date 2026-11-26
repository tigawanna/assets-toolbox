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
    main: {
      App: {
        GetSystemInfo(): Promise<NativeSystemInfo>;
        WorkspaceID(): Promise<string>;
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
  if (typeof window === "undefined") {
    return browserPreview;
  }

  const bridge = (window as WailsWindow).go;
  if (!bridge) {
    return browserPreview;
  }

  return bridge.main.App.GetSystemInfo();
}

export async function getWorkspaceId(): Promise<string> {
  if (typeof window === "undefined") return "";
  const bridge = (window as WailsWindow).go;
  if (!bridge?.main.App.WorkspaceID) return "";
  try {
    return await bridge.main.App.WorkspaceID();
  } catch {
    return "";
  }
}

export function formatPlatform(info: NativeSystemInfo): string {
  if (!info.desktop) return "Browser preview";
  return `${info.os}/${info.arch}`;
}
