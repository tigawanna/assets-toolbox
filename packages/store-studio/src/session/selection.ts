import { create } from "zustand";

export interface SelectionState {
  ids: string[];
  select: (id: string | null) => void;
  toggle: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clear: () => void;
}

export const useSelection = create<SelectionState>((set) => ({
  ids: [],
  select: (id) => set({ ids: id === null ? [] : [id] }),
  toggle: (id) =>
    set((state) => ({
      ids: state.ids.includes(id)
        ? state.ids.filter((candidate) => candidate !== id)
        : [...state.ids, id],
    })),
  selectMany: (ids) => set({ ids }),
  clear: () => set({ ids: [] }),
}));
