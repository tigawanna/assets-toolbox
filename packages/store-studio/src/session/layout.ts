import { create } from "zustand";

/** Ephemeral workspace layout. Never written to project.json. */
export interface LayoutState {
  collapsed: Record<string, boolean>;
  leftOpen: boolean;
  rightOpen: boolean;
  floating: boolean;
  offset: { x: number; y: number };
  togglePanel: (id: string) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setOffset: (offset: { x: number; y: number }) => void;
  setFloating: (floating: boolean) => void;
  dock: () => void;
}

export const useLayout = create<LayoutState>((set) => ({
  collapsed: {},
  leftOpen: true,
  rightOpen: true,
  floating: false,
  offset: { x: 0, y: 0 },
  togglePanel: (id) =>
    set((state) => ({ collapsed: { ...state.collapsed, [id]: state.collapsed[id] !== true } })),
  toggleLeft: () => set((state) => ({ leftOpen: !state.leftOpen })),
  toggleRight: () => set((state) => ({ rightOpen: !state.rightOpen })),
  setOffset: (offset) => set({ offset, floating: true }),
  setFloating: (floating) => set({ floating }),
  dock: () => set({ floating: false, offset: { x: 0, y: 0 } }),
}));
