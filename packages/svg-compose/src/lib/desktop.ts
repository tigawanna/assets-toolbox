type WailsEventCallback = (...data: unknown[]) => void;

type WailsRuntime = {
  EventsOn: (eventName: string, callback: WailsEventCallback) => () => void;
  EventsEmit: (eventName: string, ...data: unknown[]) => void;
};

type NativeWorkspaceApp = {
  WorkspaceID?: () => Promise<string>;
};

const FLUSH_REQUEST = "workspace:flush";
const FLUSH_COMPLETE = "workspace:flushed";

const desktopRuntime = (): WailsRuntime | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window as Window & { runtime?: WailsRuntime }).runtime;

/** Read the native workspace namespace without making the package depend on the shell. */
export async function getWorkspaceId(): Promise<string> {
  if (typeof window === "undefined") return "";
  const app = (window as Window & { go?: { main?: { App?: NativeWorkspaceApp } } }).go?.main?.App;
  if (!app?.WorkspaceID) return "";
  try {
    return await app.WorkspaceID();
  } catch {
    return "";
  }
}

/** Subscribe to the desktop shell's close-time save request. No-op in a browser. */
export const onDesktopFlush = (callback: WailsEventCallback): (() => void) | undefined =>
  desktopRuntime()?.EventsOn(FLUSH_REQUEST, callback);

/** Acknowledge a close-time flush after the durable write, echoing its request ID. */
export const completeDesktopFlush = (succeeded = true, requestId?: unknown): void => {
  desktopRuntime()?.EventsEmit(FLUSH_COMPLETE, succeeded, requestId);
};
