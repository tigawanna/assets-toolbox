const TOUR_KEY_PREFIX = "assets-toolbox-tool-tour:";
export const REPLAY_TOOL_TOUR_EVENT = "assets-toolbox:replay-tool-tour";

function storageKey(slug: string): string {
  return `${TOUR_KEY_PREFIX}${slug}`;
}

export function hasSeenToolTour(slug: string): boolean {
  try {
    return localStorage.getItem(storageKey(slug)) === "1";
  } catch {
    return false;
  }
}

export function markToolTourSeen(slug: string): void {
  try {
    localStorage.setItem(storageKey(slug), "1");
  } catch {
    // Private browsing can block localStorage; the tour simply replays next time.
  }
}

export function replayToolTour(slug: string): void {
  window.dispatchEvent(new CustomEvent<string>(REPLAY_TOOL_TOUR_EVENT, { detail: slug }));
}
