import { describe, expect, it } from "vite-plus/test";
import { getPreset } from "@tigawanna/play-screenshots/sizes";

import { createDefaultProject, migrateProject } from "../src/model/migrate";
import { StudioProjectSchema, schemaToJson } from "../src/model/schema";
import { materializeBoard, TEMPLATE_FAMILIES } from "../src/templates/families";
import type { TemplateInput } from "../src/model/schema";

function presetIdFor(kind: string): string {
  if (kind === "iphone") return "phone-portrait";
  if (kind === "ipad") return "tablet-landscape";
  if (kind === "feature") return "feature-graphic";
  if (kind === "tablet") return "tablet-landscape";
  if (kind === "foldable") return "foldable-square";
  if (kind === "chromebook") return "chromebook";
  return "phone-portrait";
}

const input: TemplateInput = {
  appName: "Hollow",
  palette: { primary: "#635bff", accent: "#ffb86b", background: "#0f100f", text: "#fff" },
  slides: [
    { headline: "Inbox zero", subtext: "Works offline", screenshot: "a" },
    { headline: "Find anything", screenshot: "b" },
  ],
};

describe("schema", () => {
  it("creates a valid default project for both stores", () => {
    expect(() => StudioProjectSchema.parse(createDefaultProject("play"))).not.toThrow();
    const appStore = createDefaultProject("app-store");
    expect(appStore.store).toBe("app-store");
    expect(appStore.boards[0]?.preset).toBe("iphone-6-9");
    expect(() => StudioProjectSchema.parse(appStore)).not.toThrow();
  });

  it("migrates partial documents and emits JSON Schema", () => {
    const migrated = migrateProject({ store: "play", boards: [], assets: {} });
    expect(migrated.version).toBe(1);
    expect(migrated.boards).toEqual([]);
    expect(schemaToJson()).toHaveProperty("$schema");
  });
});

describe("templates", () => {
  it("materialises deterministic boards for every family and board kind", () => {
    for (const family of TEMPLATE_FAMILIES) {
      for (const kind of Object.keys(family.boards)) {
        const presetId = presetIdFor(kind);
        const draft = materializeBoard(family.id, kind as never, input, {
          ...getPreset(presetId),
          id: presetId,
        } as never);
        expect(draft.nodes.length).toBeGreaterThan(0);
        expect(draft.sliceMeta).toHaveLength(kind === "feature" ? 1 : 2);
        expect(() =>
          StudioProjectSchema.parse({
            ...createDefaultProject(),
            boards: [
              {
                id: "b",
                kind,
                preset: presetId,
                sliceCount: 2,
                background: draft.background,
                nodes: draft.nodes,
                sliceMeta: draft.sliceMeta,
              },
            ],
          }),
        ).not.toThrow();
      }
    }
  });

  it("places aurora devices across slice cuts", () => {
    const draft = materializeBoard("aurora-panorama", "phone", input, {
      ...getPreset("phone-portrait"),
      id: "phone-portrait",
    } as never);
    const devices = draft.nodes.filter((node) => node.type === "device");
    expect(devices).toHaveLength(2);
    expect(devices.some((node) => node.rotation !== 0)).toBe(true);
  });
});
