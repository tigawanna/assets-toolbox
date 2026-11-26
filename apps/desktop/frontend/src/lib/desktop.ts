type WailsEventCallback = (...data: unknown[]) => void;

type WailsRuntime = {
  EventsOn: (eventName: string, callback: WailsEventCallback) => () => void;
  EventsEmit: (eventName: string, ...data: unknown[]) => void;
};

export type DesktopModule = "workspace" | "studio";
export type DesktopFlush = () => Promise<boolean>;

const desktopRuntime = (): WailsRuntime | undefined =>
  (window as Window & { runtime?: WailsRuntime }).runtime;

/** Subscribe to a native close-time save request. No-op in a browser. */
export const onDesktopFlush = (
  module: DesktopModule,
  callback: WailsEventCallback,
): (() => void) | undefined => desktopRuntime()?.EventsOn(`${module}:flush`, callback);

/** Acknowledge only after a durable write, echoing the request ID to reject stale saves. */
export const completeDesktopFlush = (
  module: DesktopModule,
  succeeded = true,
  requestId?: unknown,
): void => {
  desktopRuntime()?.EventsEmit(`${module}:flushed`, succeeded, requestId);
};

/** Let Go enable close-time flushing only while this module is mounted. */
export const setDesktopModuleActive = (module: DesktopModule, active: boolean): void => {
  desktopRuntime()?.EventsEmit(`${module}:${active ? "active" : "inactive"}`);
};
