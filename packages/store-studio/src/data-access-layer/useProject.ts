import { useSyncExternalStore } from "react";

import { getSnapshot, subscribeProject } from "./project";

/** Whole-document live view. Board/node-specific views use TanStack DB collections. */
export function useProject() {
  return useSyncExternalStore(subscribeProject, getSnapshot, getSnapshot);
}
