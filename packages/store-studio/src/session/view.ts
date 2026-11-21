import { create } from "zustand";

export type Tool = "select" | "pan" | "text" | "shape" | "glow" | "device";

export interface ViewState {
  zoom: number;
  pan: { x: number; y: number };
  activeBoardId: string | null;
  activeSlice: number;
  tool: Tool;
  screenEditNodeId: string | null;
  showSliceGuides: boolean;
  showSafeZones: boolean;
  showStoreCrop: boolean;
  zoomTo: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setActiveBoard: (id: string) => void;
  setActiveSlice: (index: number) => void;
  setTool: (tool: Tool) => void;
  setScreenEdit: (id: string | null) => void;
  toggle: (key: "showSliceGuides" | "showSafeZones" | "showStoreCrop") => void;
}

export const useView = create<ViewState>((set) => ({
  zoom: 1,
  pan: { x: 0, y: 0 },
  activeBoardId: null,
  activeSlice: 0,
  tool: "select",
  screenEditNodeId: null,
  showSliceGuides: true,
  showSafeZones: false,
  showStoreCrop: false,
  zoomTo: (zoom) => set({ zoom: Math.min(4, Math.max(0.05, zoom)) }),
  setPan: (pan) => set({ pan }),
  setActiveBoard: (activeBoardId) => set({ activeBoardId, activeSlice: 0 }),
  setActiveSlice: (activeSlice) => set({ activeSlice }),
  setTool: (tool) => set({ tool }),
  setScreenEdit: (screenEditNodeId) => set({ screenEditNodeId }),
  toggle: (key) => set((state) => ({ [key]: !state[key] }) as Partial<ViewState>),
}));
