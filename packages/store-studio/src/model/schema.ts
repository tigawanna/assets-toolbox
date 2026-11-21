import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const StoreKind = z.enum(["play", "app-store"]);
export type StoreKind = z.infer<typeof StoreKind>;

export const BoardKind = z.enum([
  "phone",
  "tablet",
  "foldable",
  "chromebook",
  "feature",
  "iphone",
  "ipad",
]);
export type BoardKind = z.infer<typeof BoardKind>;

export const AssetKind = z.enum(["screenshot", "image", "icon"]);
export type AssetKind = z.infer<typeof AssetKind>;

export const ColorRefSchema = z.union([z.string().min(1), z.object({ token: z.string().min(1) })]);
export type ColorRef = z.infer<typeof ColorRefSchema>;

const StopSchema = z.object({ offset: z.number().min(0).max(1), color: ColorRefSchema });
export type Stop = z.infer<typeof StopSchema>;

export const FillSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color: ColorRefSchema }),
  z.object({
    type: z.literal("linear"),
    angle: z.number().default(90),
    stops: z.array(StopSchema).min(2),
  }),
  z.object({
    type: z.literal("radial"),
    stops: z.array(StopSchema).min(2),
  }),
  z.object({
    type: z.literal("image"),
    assetId: z.string().min(1),
    fit: z.enum(["cover", "contain"]),
  }),
]);
export type Fill = z.infer<typeof FillSchema>;

export const FontRefSchema = z.object({
  family: z.string().min(1),
  weight: z.number().int().min(100).max(900).default(400),
  size: z.number().positive(),
});
export type FontRef = z.infer<typeof FontRefSchema>;

export const AssetRecordSchema = z.object({
  file: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  kind: AssetKind,
  intrinsic: z
    .object({ width: z.number().int().positive(), height: z.number().int().positive() })
    .optional(),
});
export type AssetRecord = z.infer<typeof AssetRecordSchema>;

const BaseNodeFields = {
  id: z.string().min(1),
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
  rotation: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  shadow: z
    .object({
      color: ColorRefSchema,
      blur: z.number().nonnegative(),
      offsetX: z.number(),
      offsetY: z.number(),
    })
    .optional(),
};

export const ScreenContentSchema = z.object({
  assetId: z.string().min(1),
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  offset: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  zoom: z.number().positive().default(1),
  trim: z
    .object({
      top: z.number().nonnegative().default(0),
      bottom: z.number().nonnegative().default(0),
      left: z.number().nonnegative().default(0),
      right: z.number().nonnegative().default(0),
    })
    .default({ top: 0, bottom: 0, left: 0, right: 0 }),
});
export type ScreenContent = z.infer<typeof ScreenContentSchema>;

export const DeviceModelId = z.enum([
  "phone-punch",
  "phone-flat",
  "tablet",
  "foldable-open",
  "foldable-cover",
  "laptop",
  "browser",
  "monitor",
  "iphone-island",
  "iphone-notch",
  "ipad",
]);
export type DeviceModelId = z.infer<typeof DeviceModelId>;

export const DeviceNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("device"),
  width: z.number().positive(),
  height: z.number().positive(),
  model: DeviceModelId,
  color: z.enum(["black", "white", "silver"]).default("black"),
  screenAspect: z.union([z.number().positive(), z.literal("match")]).default("match"),
  statusBar: z.enum(["clean", "hidden"]).default("hidden"),
  content: ScreenContentSchema,
});

export const ImageNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("image"),
  width: z.number().positive(),
  height: z.number().positive(),
  assetId: z.string().min(1),
  fit: z.enum(["cover", "contain", "fill"]).default("contain"),
  mask: z.enum(["rect", "rounded", "ellipse", "fade"]).default("rect"),
  radius: z.number().nonnegative().default(0),
});

export const TextNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("text"),
  text: z.string(),
  font: FontRefSchema,
  color: ColorRefSchema,
  align: z.enum(["left", "center", "right"]).default("left"),
  width: z.number().positive(),
  height: z.number().positive(),
  lineHeight: z.number().positive().default(1.2),
  role: z.enum(["headline", "subtext", "label", "body"]).default("body"),
});

export const ShapeNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("shape"),
  shape: z.enum(["rect", "ellipse", "blob", "line"]),
  width: z.number().positive(),
  height: z.number().positive(),
  fill: FillSchema,
  radius: z.number().nonnegative().default(0),
});

export const GlowNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("glow"),
  width: z.number().positive(),
  height: z.number().positive(),
  color: ColorRefSchema,
  /** Fraction of the radius kept opaque before the radial fade to transparent. */
  core: z.number().min(0).max(1).default(0),
});

export const FadeNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal("fade"),
  width: z.number().positive(),
  height: z.number().positive(),
  color: ColorRefSchema,
  angle: z.number().default(90),
  strength: z.number().min(0).max(1).default(1),
});

export type DeviceNode = z.infer<typeof DeviceNodeSchema>;
export type ImageNode = z.infer<typeof ImageNodeSchema>;
export type TextNode = z.infer<typeof TextNodeSchema>;
export type ShapeNode = z.infer<typeof ShapeNodeSchema>;
export type GlowNode = z.infer<typeof GlowNodeSchema>;
export type FadeNode = z.infer<typeof FadeNodeSchema>;
export type GroupNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  locked?: boolean | undefined;
  hidden?: boolean | undefined;
  shadow?: DeviceNode["shadow"] | undefined;
  type: "group";
  width: number;
  height: number;
  children: Node[];
};
export type Node = DeviceNode | ImageNode | TextNode | ShapeNode | GlowNode | FadeNode | GroupNode;
export type NodeType = Node["type"];

export const GroupNodeSchema: z.ZodType<GroupNode> = z.lazy(() =>
  z.object({
    ...BaseNodeFields,
    type: z.literal("group"),
    width: z.number().positive(),
    height: z.number().positive(),
    children: z.array(NodeSchema),
  }),
);

export const NodeSchema = z.union([
  DeviceNodeSchema,
  ImageNodeSchema,
  TextNodeSchema,
  ShapeNodeSchema,
  GlowNodeSchema,
  FadeNodeSchema,
  GroupNodeSchema,
]);

export const TemplateInputSchema = z.object({
  appName: z.string(),
  icon: z.string().optional(),
  palette: z.record(z.string(), z.string()),
  slides: z.array(
    z.object({
      label: z.string().optional(),
      headline: z.string(),
      subtext: z.string().optional(),
      screenshot: z.string(),
    }),
  ),
});
export type TemplateInput = z.infer<typeof TemplateInputSchema>;

export const BoardSchema = z.object({
  id: z.string().min(1),
  kind: BoardKind,
  preset: z.string().min(1),
  sliceCount: z.number().int().positive(),
  background: FillSchema,
  source: z.object({ family: z.string().min(1), input: TemplateInputSchema }).optional(),
  detached: z.boolean().optional(),
  nodes: z.array(NodeSchema),
  sliceMeta: z.array(
    z.object({ alt: z.string().max(140).optional(), name: z.string().optional() }),
  ),
});
export type Board = z.infer<typeof BoardSchema>;

export const ExportSettingsSchema = z.object({
  outDir: z.string().min(1),
  format: z.enum(["png", "jpeg"]).default("png"),
  layout: z.enum(["flat", "fastlane", "deliver"]).default("flat"),
  locale: z.string().min(1).default("en-US"),
  zip: z.boolean().default(false),
});
export type ExportSettings = z.infer<typeof ExportSettingsSchema>;

export const StudioProjectSchema = z.object({
  version: z.literal(SCHEMA_VERSION),
  store: StoreKind,
  app: z.object({ name: z.string(), icon: z.string().optional() }),
  theme: z.object({
    tokens: z.record(z.string(), z.string()),
    fonts: z.object({ heading: FontRefSchema, body: FontRefSchema }),
  }),
  assets: z.record(z.string(), AssetRecordSchema),
  boards: z.array(BoardSchema),
  export: ExportSettingsSchema,
});
export type StudioProject = z.infer<typeof StudioProjectSchema>;

/** Emitted for agents and the template gallery so both use the same shape. */
export function schemaToJson(): Record<string, unknown> {
  return z.toJSONSchema(StudioProjectSchema) as Record<string, unknown>;
}

export function parseProject(value: unknown): StudioProject {
  return StudioProjectSchema.parse(value);
}
