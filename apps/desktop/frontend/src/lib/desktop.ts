type WailsEventCallback = (...data: unknown[]) => void;

type WailsRuntime = {
  EventsOn: (eventName: string, callback: WailsEventCallback) => () => void;
  EventsEmit: (eventName: string, ...data: unknown[]) => void;
};

export type DesktopModule = "workspace" | "studio";
export type DesktopFlush = () => Promise<boolean>;

const desktopRuntime = (): WailsRuntime | undefined =>
  (window as Window & { runtime?: WailsRuntime }).runtime;

export function onDesktopFlush(
  module: DesktopModule,
  callback: WailsEventCallback,
): (() => void) | undefined {
  return desktopRuntime()?.EventsOn(`${module}:flush`, callback);
}

export function completeDesktopFlush(
  module: DesktopModule,
  succeeded = true,
  requestId?: unknown,
): void {
  desktopRuntime()?.EventsEmit(`${module}:flushed`, succeeded, requestId);
}

export function setDesktopModuleActive(module: DesktopModule, active: boolean): void {
  desktopRuntime()?.EventsEmit(`${module}:${active ? "active" : "inactive"}`);
}
