import { create } from "zustand";

import { getCurrentProject, subscribeProject, updateProject } from "../data-access-layer/project";
import type { StudioProject } from "../model/schema";

const LIMIT = 60;

export interface HistoryState {
  past: StudioProject[];
  present: StudioProject;
  future: StudioProject[];
  /** Commit a finished gesture: one undo step. */
  commit: (mutator: (draft: StudioProject) => void) => void;
  undo: () => void;
  redo: () => void;
  reset: (project: StudioProject) => void;
}

export const useHistory = create<HistoryState>((set, get) => ({
  past: [],
  present: getCurrentProject(),
  future: [],
  commit: (mutator) => {
    const previous = getCurrentProject();
    const next = structuredClone(previous);
    mutator(next);
    set((state) => ({
      past: [...state.past, previous].slice(-LIMIT),
      present: next,
      future: [],
    }));
    updateProject(() => next);
  },
  undo: () => {
    const { past, present, future } = get();
    const previous = past[past.length - 1];
    if (previous === undefined) return;
    set({
      past: past.slice(0, -1),
      present: previous,
      future: [present, ...future].slice(0, LIMIT),
    });
    updateProject(() => previous);
  },
  redo: () => {
    const { past, present, future } = get();
    const next = future[0];
    if (next === undefined) return;
    set({ past: [...past, present].slice(-LIMIT), present: next, future: future.slice(1) });
    updateProject(() => next);
  },
  reset: (project) => set({ past: [], present: project, future: [] }),
}));

// Keep the snapshot in step with DAL loads and external edits.
subscribeProject(() => {
  const current = getCurrentProject();
  if (current !== useHistory.getState().present) useHistory.setState({ present: current });
});
