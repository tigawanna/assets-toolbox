import type { PlayStorePreset } from "@tigawanna/play-screenshots/sizes";

import type { BoardKind, Fill, Node, StoreKind, TemplateInput } from "../model/schema";
import { deviceNode, fadeNode, glowNode, imageNode, shapeNode, textNode, uid } from "./factory";

export interface BoardDraft {
  background: Fill;
  nodes: Node[];
  sliceMeta: Array<{ alt?: string; name?: string }>;
}

export type BoardBuilder = (input: TemplateInput, preset: PlayStorePreset) => BoardDraft;

export interface TemplateFamily {
  id: string;
  name: string;
  credit?: { name: string; url: string };
  stores?: StoreKind[];
  boards: Partial<Record<BoardKind, BoardBuilder>>;
}

function palette(input: TemplateInput) {
  return {
    primary: input.palette.primary ?? "#635bff",
    accent: input.palette.accent ?? "#ffb86b",
    background: input.palette.background ?? "#0f100f",
    text: input.palette.text ?? "#f7f7f3",
    muted: input.palette.muted ?? "#a8ada3",
  };
}

function skyFill(input: TemplateInput): Fill {
  const colors = palette(input);
  return {
    type: "linear",
    angle: 160,
    stops: [
      { offset: 0, color: colors.background },
      { offset: 0.45, color: colors.primary },
      { offset: 0.78, color: colors.accent },
      { offset: 1, color: colors.background },
    ],
  };
}

function meta(input: TemplateInput): BoardDraft["sliceMeta"] {
  return input.slides.map((slide) => ({
    name: slide.label ?? slide.headline.slice(0, 40),
    alt: `${slide.headline}${slide.subtext === undefined ? "" : ` — ${slide.subtext}`}`.slice(
      0,
      140,
    ),
  }));
}

function deviceFor(
  kind: BoardKind,
  store: StoreKind,
): "phone-punch" | "tablet" | "foldable-open" | "laptop" | "iphone-island" | "ipad" {
  if (store === "app-store") return kind === "ipad" ? "ipad" : "iphone-island";
  if (kind === "tablet") return "tablet";
  if (kind === "foldable") return "foldable-open";
  if (kind === "chromebook") return "laptop";
  return "phone-punch";
}

function textTop(kind: BoardKind, store: StoreKind): BoardBuilder {
  return (input, preset) => {
    const colors = palette(input);
    const W = preset.width;
    const H = preset.height;
    const nodes: Node[] = [];
    input.slides.forEach((slide, index) => {
      const x = index * W;
      const landscape = W > H;
      nodes.push(
        glowNode({ x: x + W * 0.6, y: -H * 0.1, width: W * 0.9, height: H * 0.5 }, colors.primary),
        glowNode({ x: x - W * 0.2, y: H * 0.4, width: W * 0.7, height: H * 0.6 }, colors.accent),
        textNode(
          {
            x: x + W * 0.07,
            y: H * 0.08,
            width: W * 0.86,
            height: H * 0.15,
            name: `Headline ${index + 1}`,
          },
          slide.headline,
          Math.round(W * (landscape ? 0.055 : 0.078)),
          colors.text,
        ),
      );
      if (slide.subtext !== undefined) {
        nodes.push(
          textNode(
            {
              x: x + W * 0.07,
              y: H * 0.19,
              width: W * 0.8,
              height: H * 0.08,
              name: `Subtext ${index + 1}`,
            },
            slide.subtext,
            Math.round(W * 0.032),
            colors.muted,
            {
              font: { family: "Inter", weight: 400, size: Math.round(W * 0.032) },
              role: "subtext",
            },
          ),
        );
      }
      const deviceW = W * (landscape ? 0.34 : 0.72);
      const deviceH = deviceW * (landscape ? 0.62 : 1.5);
      nodes.push(
        deviceNode(
          {
            x: x + (landscape ? W * 0.58 : W * 0.14),
            y: landscape ? H * 0.22 : H * 0.3,
            width: deviceW,
            height: deviceH,
            name: `Capture ${index + 1}`,
          },
          deviceFor(kind, store),
          slide.screenshot,
          { color: "black" },
        ),
      );
    });
    return { background: skyFill(input), nodes, sliceMeta: meta(input) };
  };
}

function auroraPanorama(kind: BoardKind, store: StoreKind): BoardBuilder {
  return (input, preset) => {
    const colors = palette(input);
    const W = preset.width;
    const H = preset.height;
    const nodes: Node[] = [];
    // One silhouette band spanning the whole board — the continuous look.
    nodes.push(
      shapeNode(
        { x: 0, y: H * 0.78, width: W * input.slides.length, height: H * 0.35 },
        { type: "solid", color: colors.background },
        { name: "Horizon silhouette", radius: 0 },
      ),
    );
    input.slides.forEach((slide, index) => {
      const x = index * W;
      for (let star = 0; star < 8; star += 1) {
        nodes.push(
          glowNode(
            {
              x: x + ((star * 137 + index * 61) % W),
              y: (star * 89 + index * 43) % (H * 0.6),
              width: 10 + (star % 3) * 6,
              height: 10 + (star % 3) * 6,
            },
            colors.text,
            { opacity: 0.7, name: "Star" },
          ),
        );
      }
      nodes.push(
        textNode(
          {
            x: x + W * 0.08,
            y: H * 0.09,
            width: W * 0.7,
            height: H * 0.16,
            name: `Headline ${index + 1}`,
          },
          slide.headline,
          Math.round(W * 0.075),
          colors.text,
        ),
      );
      if (slide.subtext !== undefined) {
        nodes.push(
          textNode(
            { x: x + W * 0.08, y: H * 0.2, width: W * 0.6, height: H * 0.09 },
            slide.subtext,
            Math.round(W * 0.03),
            colors.muted,
            { font: { family: "Inter", weight: 400, size: Math.round(W * 0.03) }, role: "subtext" },
          ),
        );
      }
      // Every other device crosses a slice cut.
      const crosses = index % 2 === 0;
      const deviceW = W * 0.66;
      nodes.push(
        deviceNode(
          {
            x: x + (crosses ? W * 0.62 : W * 0.16),
            y: H * 0.34,
            width: deviceW,
            height: deviceW * 1.55,
            rotation: crosses ? 11 : -9,
            name: `Tilted capture ${index + 1}`,
          },
          deviceFor(kind, store),
          slide.screenshot,
        ),
      );
    });
    return { background: skyFill(input), nodes, sliceMeta: meta(input) };
  };
}

function fullBleed(input: TemplateInput, preset: PlayStorePreset): BoardDraft {
  const colors = palette(input);
  const W = preset.width;
  const H = preset.height;
  const nodes: Node[] = [];
  input.slides.forEach((slide, index) => {
    const x = index * W;
    nodes.push(
      imageNode({ x, y: 0, width: W, height: H }, slide.screenshot, {
        fit: "cover",
        name: `Full bleed ${index + 1}`,
      }),
      fadeNode({ x, y: 0, width: W, height: H * 0.42 }, colors.background, {
        angle: 90,
        strength: 0.92,
      }),
      textNode(
        { x: x + W * 0.08, y: H * 0.08, width: W * 0.84, height: H * 0.12 },
        slide.headline,
        Math.round(W * 0.072),
        colors.text,
      ),
    );
  });
  return {
    background: { type: "solid", color: colors.background },
    nodes,
    sliceMeta: meta(input),
  };
}

function splitLandscape(input: TemplateInput, preset: PlayStorePreset): BoardDraft {
  const colors = palette(input);
  const W = preset.width;
  const H = preset.height;
  const nodes: Node[] = [];
  input.slides.forEach((slide, index) => {
    const x = index * W;
    nodes.push(
      textNode(
        { x: x + W * 0.06, y: H * 0.34, width: W * 0.34, height: H * 0.2 },
        slide.headline,
        Math.round(W * 0.045),
        colors.text,
      ),
      ...(slide.subtext === undefined
        ? []
        : [
            textNode(
              { x: x + W * 0.06, y: H * 0.56, width: W * 0.34, height: H * 0.14 },
              slide.subtext,
              Math.round(W * 0.022),
              colors.muted,
              {
                font: { family: "Inter", weight: 400, size: Math.round(W * 0.022) },
                role: "subtext",
              },
            ),
          ]),
      deviceNode(
        { x: x + W * 0.46, y: H * 0.12, width: W * 0.46, height: H * 0.76 },
        "tablet",
        slide.screenshot,
      ),
      glowNode({ x: x + W * 0.5, y: -H * 0.2, width: W * 0.5, height: H * 0.7 }, colors.primary, {
        opacity: 0.6,
      }),
    );
  });
  return { background: skyFill(input), nodes, sliceMeta: meta(input) };
}

function duoOverlap(input: TemplateInput, preset: PlayStorePreset): BoardDraft {
  const colors = palette(input);
  const W = preset.width;
  const H = preset.height;
  const nodes: Node[] = [];
  input.slides.forEach((slide, index) => {
    const x = index * W;
    const second = input.slides[(index + 1) % input.slides.length];
    nodes.push(
      textNode(
        { x: x + W * 0.08, y: H * 0.08, width: W * 0.8, height: H * 0.13 },
        slide.headline,
        Math.round(W * 0.07),
        colors.text,
      ),
      deviceNode(
        { x: x + W * 0.18, y: H * 0.3, width: W * 0.5, height: H * 0.72, rotation: -7 },
        "phone-punch",
        slide.screenshot,
      ),
      ...(second === undefined
        ? []
        : [
            deviceNode(
              { x: x + W * 0.55, y: H * 0.36, width: W * 0.46, height: H * 0.68, rotation: 8 },
              "phone-punch",
              second.screenshot,
              { color: "silver" },
            ),
          ]),
    );
  });
  return { background: skyFill(input), nodes, sliceMeta: meta(input) };
}

function featureGraphic(variant: "icon-left" | "icon-center"): BoardBuilder {
  return (input, preset) => {
    const colors = palette(input);
    const W = preset.width;
    const H = preset.height;
    const center = variant === "icon-center";
    const nodes: Node[] = [];
    if (input.icon !== undefined) {
      nodes.push(
        imageNode(
          { x: center ? W / 2 - 90 : W * 0.12, y: H / 2 - 90, width: 180, height: 180 },
          input.icon,
          { mask: "rounded", radius: 36, name: "App icon" },
        ),
      );
    }
    nodes.push(
      textNode(
        {
          x: center ? W * 0.1 : W * 0.34,
          y: H * 0.3,
          width: center ? W * 0.8 : W * 0.55,
          height: H * 0.4,
          name: "Feature headline",
        },
        input.appName,
        Math.round(W * 0.085),
        colors.text,
        { align: center ? "center" : "left" },
      ),
      glowNode({ x: W * 0.6, y: -H * 0.4, width: W * 0.5, height: H * 0.9 }, colors.primary, {
        opacity: 0.5,
      }),
    );
    return {
      background: {
        type: "linear",
        angle: 140,
        stops: [
          { offset: 0, color: colors.background },
          { offset: 1, color: colors.primary },
        ],
      },
      nodes,
      sliceMeta: [{}],
    };
  };
}

const playBoards: BoardKind[] = ["phone", "tablet", "foldable", "chromebook"];
const appBoards: BoardKind[] = ["iphone", "ipad"];

function family(
  id: string,
  name: string,
  builder: (kind: BoardKind, store: StoreKind) => BoardBuilder,
  credit?: TemplateFamily["credit"],
): TemplateFamily {
  const boards: Partial<Record<BoardKind, BoardBuilder>> = {};
  for (const kind of [...playBoards, ...appBoards])
    boards[kind] = builder(kind, kind === "iphone" || kind === "ipad" ? "app-store" : "play");
  return { id, name, boards, ...(credit === undefined ? {} : { credit }) };
}

export const TEMPLATE_FAMILIES: TemplateFamily[] = [
  family("text-top", "Text top", textTop, {
    name: "play-store-screenshots",
    url: "https://github.com/mobile-dev-ci/play-store-screenshots",
  }),
  family("aurora-panorama", "Aurora panorama", auroraPanorama),
  {
    id: "full-bleed",
    name: "Full bleed",
    credit: {
      name: "play-store-screenshots",
      url: "https://github.com/mobile-dev-ci/play-store-screenshots",
    },
    boards: Object.fromEntries(
      [...playBoards, ...appBoards].map((kind) => [kind, fullBleed]),
    ) as TemplateFamily["boards"],
  },
  family("duo-overlap", "Duo overlap", () => duoOverlap),
  {
    id: "split-landscape",
    name: "Split landscape",
    boards: Object.fromEntries(
      [...playBoards, ...appBoards].map((kind) => [kind, splitLandscape]),
    ) as TemplateFamily["boards"],
  },
  {
    id: "feature-icon-left",
    name: "Feature · icon left",
    boards: { feature: featureGraphic("icon-left") },
  },
  {
    id: "feature-icon-center",
    name: "Feature · icon center",
    boards: { feature: featureGraphic("icon-center") },
  },
];

export function getFamily(id: string): TemplateFamily | undefined {
  return TEMPLATE_FAMILIES.find((candidate) => candidate.id === id);
}

export function materializeBoard(
  familyId: string,
  kind: BoardKind,
  input: TemplateInput,
  preset: PlayStorePreset,
): BoardDraft {
  const family = getFamily(familyId) ?? getFamily("text-top");
  const builder =
    family?.boards[kind] ?? family?.boards.feature ?? TEMPLATE_FAMILIES[0]?.boards[kind];
  if (builder === undefined) throw new Error(`No template builder for ${kind}`);
  return builder(input, preset);
}

export { uid };
