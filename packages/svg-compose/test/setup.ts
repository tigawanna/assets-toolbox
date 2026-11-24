/**
 * jsdom has no ResizeObserver (the Stage uses one to keep the viewBox in sync
 * with its container). A no-op stand-in is enough for unit tests.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

/** jsdom has no hit testing; tests can override this per case. */
if (typeof document !== "undefined" && !document.elementsFromPoint) {
  document.elementsFromPoint = () => [];
}
