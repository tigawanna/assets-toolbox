import type { HostEvent, StudioHost } from "./types";

/**
 * Wails binding implementation. `window.runtime` signals the desktop host, so
 * no build flag is needed. The Go methods are written when the desktop app is
 * built; until then every call throws. The seam exists so `getHost()` is real.
 */
function bindings(): Record<string, (...args: unknown[]) => Promise<unknown>> {
  const runtime = (window as unknown as { runtime?: Record<string, unknown> }).runtime;
  const go = runtime?.go as
    | { studio?: { StudioService?: Record<string, (...args: unknown[]) => Promise<unknown>> } }
    | undefined;
  return go?.studio?.StudioService ?? {};
}

function notImplemented(method: string): never {
  throw new Error(
    `Desktop host method ${method} is not implemented yet. The Wails bindings land with the ` +
      "desktop app; the HTTP and memory hosts work today.",
  );
}

export const wailsHost: StudioHost = {
  readProject: async () => notImplemented("ReadProject"),
  writeProject: async () => notImplemented("WriteProject"),
  importAsset: async () => notImplemented("ImportAsset"),
  assetUrl: (file: string) => `/api/assets/${encodeURIComponent(file)}`,
  exportSlice: async () => notImplemented("ExportSlice"),
  readEvents: async () => notImplemented("ReadEvents"),
  appendEvent: async () => notImplemented("AppendEvent"),
  finishExport: async () => notImplemented("FinishExport"),
  subscribe(listener: (event: HostEvent) => void): () => void {
    const runtime = (window as unknown as { runtime?: Record<string, unknown> }).runtime;
    const eventsOn = runtime?.EventsOn as
      | ((name: string, cb: (payload: HostEvent) => void) => void)
      | undefined;
    if (typeof eventsOn !== "function") return () => {};
    eventsOn("host", listener);
    return () => {
      const off = runtime?.EventsOff as ((name: string) => void) | undefined;
      off?.("host");
    };
  },
  pickFiles: async () => null,
};

/** Exposed for the generated bindings once the Go app exists. */
export function wailsBinding(name: string): ((...args: unknown[]) => Promise<unknown>) | undefined {
  return bindings()[name];
}
