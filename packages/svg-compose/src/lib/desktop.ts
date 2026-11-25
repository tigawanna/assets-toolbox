type WailsEventCallback = (...data: unknown[]) => void;

type WailsRuntime = {
  EventsOn: (eventName: string, callback: WailsEventCallback) => () => void;
  EventsEmit: (eventName: string, ...data: unknown[]) => void;
};

const FLUSH_REQUEST = "workspace:flush";
const FLUSH_COMPLETE = "workspace:flushed";

const desktopRuntime = (): WailsRuntime | undefined =>
  (window as Window & { runtime?: WailsRuntime }).runtime;

/** Subscribe to the desktop shell's close-time save request. No-op in a browser. */
export const onDesktopFlush = (callback: WailsEventCallback): (() => void) | undefined =>
  desktopRuntime()?.EventsOn(FLUSH_REQUEST, callback);

/** Acknowledge a desktop flush after the pending save has settled. */
export const completeDesktopFlush = (): void => {
  desktopRuntime()?.EventsEmit(FLUSH_COMPLETE);
};
