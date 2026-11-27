export const TOUR_KEY = "assets-toolbox-tour-done";

export interface TourStep {
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
}

export const TOUR_STEPS: TourStep[] = [
  {
    eyebrow: "Welcome",
    title: "One home for your asset work",
    body: "Assets Toolbox keeps every project, tool, and generated file together. This quick tour covers what you need to get going.",
    bullets: ["Local-first: everything stays on this device", "No account, no upload"],
  },
  {
    eyebrow: "Projects",
    title: "Start by picking a project",
    body: "The launch screen lists your projects. Open one to see its tools, or create a new one for a new app or client.",
    bullets: [
      "Switch projects any time from the sidebar",
      "Assets and saved forms stay with their project",
    ],
  },
  {
    eyebrow: "Tools",
    title: "Six tools, one workspace",
    body: "Icon Compose, Social Inspect, Brand Assets, Expo Assets, Screenshot Studio and Cabra Sound all live inside the project you opened.",
    bullets: [
      "Each tool has a compact header with its actions",
      "Press ? on any screen for shortcuts",
    ],
  },
  {
    eyebrow: "Assets",
    title: "Everything you make stays editable",
    body: "Source images and generated outputs live in a shared asset library, grouped by the tool that produced them. Click a preview to open the gallery.",
    bullets: [
      "Arrow keys move through previews; the wheel zooms",
      "Open an asset back in the tool that made it",
    ],
  },
  {
    eyebrow: "Reuse",
    title: "Choose once, reuse everywhere",
    body: "A mark selected in Brand Assets is saved in the project. Expo Assets and Screenshot Studio can use it without re-uploading, and derived files remember their source.",
    bullets: ["Deleted sources are flagged in the asset grid", "Adjust and re-export at any time"],
  },
  {
    eyebrow: "MCP",
    title: "Drive the tools from an agent",
    body: "A local MCP endpoint exposes one gateway tool with progressive discovery. The MCP screen shows configs, the tool catalog, and a live call log.",
    bullets: [
      "op=list → op=describe → op=call",
      "Configs can be copied with or without the mcpServers wrapper",
    ],
  },
  {
    eyebrow: "Ready",
    title: "You're good to go",
    body: "Open a project and start making things. Press ? whenever you want the shortcut list, and visit Help for a tool-by-tool overview.",
  },
];

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    // The tour is optional; storage failures are harmless.
  }
}

export function resetTour(): void {
  try {
    localStorage.removeItem(TOUR_KEY);
  } catch {
    // Ignore storage failures.
  }
}
