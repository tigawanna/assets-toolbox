export type DesktopFlush = () => Promise<boolean>;
export type DesktopModule = "studio";
export type WailsEventCallback = (...data: unknown[]) => void;

type WailsRuntime = {
  EventsOn?: (eventName: string, callback: WailsEventCallback) => (() => void) | undefined;
  EventsEmit?: (eventName: string, ...data: unknown[]) => void;
};

const desktopRuntime = (): WailsRuntime | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window as Window & { runtime?: WailsRuntime }).runtime;

/** Subscribe to a native close-time save request. No-op in a browser. */
export function onDesktopFlush(
  module: DesktopModule,
  callback: WailsEventCallback,
): (() => void) | undefined {
  return desktopRuntime()?.EventsOn?.(`${module}:flush`, callback);
}

/** Acknowledge only after a durable write, echoing the request ID to reject stale saves. */
export function completeDesktopFlush(
  module: DesktopModule,
  succeeded = true,
  requestId?: unknown,
): void {
  desktopRuntime()?.EventsEmit?.(`${module}:flushed`, succeeded, requestId);
}

/** Let the native shell enable close-time flushing only while Studio is mounted. */
export function setDesktopModuleActive(module: DesktopModule, active: boolean): void {
  desktopRuntime()?.EventsEmit?.(`${module}:${active ? "active" : "inactive"}`);
}
