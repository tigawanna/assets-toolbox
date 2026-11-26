export type PackageCategory = "Create" | "Inspect" | "Prepare" | "Audio";
export type PackageIconName = "shapes" | "scan" | "swatchbook" | "device" | "frame" | "waveform";
export type ToolId =
  | "svg-compose"
  | "social-inspect"
  | "brand-assets"
  | "expo-assets"
  | "screenshot-studio"
  | "cabra-sound";
export type ToolRoute = `/packages/${ToolId}`;

export interface ToolPackage {
  id: ToolId;
  name: string;
  shortName: string;
  description: string;
  category: PackageCategory;
  icon: PackageIconName;
  tags: readonly string[];
  source: string;
  stack: string;
  mount: string;
  route: ToolRoute;
  featured?: boolean;
  mounted?: boolean;
}

const packageSeed = [
  {
    id: "svg-compose",
    name: "SVG Compose",
    shortName: "SVG Compose",
    description: "Build, edit, and export vector artwork with a focused live SVG compositor.",
    category: "Create",
    icon: "shapes",
    tags: ["Vector", "Editor", "Export"],
    source: "packages/svg-compose",
    stack: "React + Vite",
    mount: "Original React UI with native Go workspace persistence",
    featured: true,
    mounted: true,
  },
  {
    id: "social-inspect",
    name: "Social Inspect",
    shortName: "Social Inspect",
    description: "Review social metadata and preview link cards across the platforms that matter.",
    category: "Inspect",
    icon: "scan",
    tags: ["Open Graph", "Metadata", "Preview"],
    source: "packages/social-inspect/app",
    stack: "React + Go inspector",
    mount: "Canonical React UI with Go-backed inspection and asset routes",
    mounted: true,
  },
  {
    id: "brand-assets",
    name: "Brand Assets",
    shortName: "Brand Assets",
    description: "Generate favicons, app icons, social cards, and manifests from one brand mark.",
    category: "Prepare",
    icon: "swatchbook",
    tags: ["Favicons", "Icons", "Social cards"],
    source: "packages/brand-assets",
    stack: "TypeScript + Sharp",
    mount: "New desktop UI with native or sidecar rendering",
  },
  {
    id: "expo-assets",
    name: "Expo Assets",
    shortName: "Expo Assets",
    description: "Produce the complete Expo, Android, iOS, and web asset set from a single logo.",
    category: "Prepare",
    icon: "device",
    tags: ["Expo", "Mobile", "Icons"],
    source: "packages/expo-assets",
    stack: "React + Sharp sidecar",
    mount: "Canonical generator in a Node sidecar with native file handling",
    mounted: true,
  },
  {
    id: "screenshot-studio",
    name: "Screenshot Studio",
    shortName: "Screenshot Studio",
    description:
      "Compose polished store screenshots with device frames, layered scenes, and export.",
    category: "Create",
    icon: "frame",
    tags: ["Canvas", "App Store", "Export"],
    source: "packages/screenshot-studio",
    stack: "TanStack Router + Konva",
    mount: "Original React canvas with browser-local board storage",
    mounted: true,
  },
  {
    id: "cabra-sound",
    name: "Cabra Sound",
    shortName: "Cabra Sound",
    description: "Browse procedural interface sounds, audition waveforms, and export WAV files.",
    category: "Audio",
    icon: "waveform",
    tags: ["Sound", "Web Audio", "WAV"],
    source: "packages/cabra-sound",
    stack: "Web Audio",
    mount: "React interface using the procedural Web Audio engine",
    mounted: true,
  },
] satisfies readonly Omit<ToolPackage, "route">[];

export const toolPackages: readonly ToolPackage[] = packageSeed.map((tool) => ({
  ...tool,
  route: `/packages/${tool.id}`,
}));

export const packageCategories: readonly PackageCategory[] = [
  "Create",
  "Inspect",
  "Prepare",
  "Audio",
];

export function findPackage(slug: string): ToolPackage | undefined {
  return toolPackages.find((tool) => tool.id === slug);
}

export function filterPackages(query: string, category: PackageCategory | "All") {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return toolPackages.filter((tool) => {
    const matchesCategory = category === "All" || tool.category === category;
    const searchable = [tool.name, tool.description, tool.category, tool.stack, ...tool.tags]
      .join(" ")
      .toLocaleLowerCase();
    return matchesCategory && searchable.includes(normalizedQuery);
  });
}
