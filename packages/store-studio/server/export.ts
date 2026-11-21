import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import {
  buildInventory as buildPlayInventory,
  getPreset as getPlayPreset,
  hexToColor,
  outputTargetsFor as playTargets,
  MAX_FILE_BYTES,
  type GeneratedAsset as PlayAsset,
  type PlayStoreSection,
} from "@tigawanna/play-screenshots";
import {
  buildInventory as buildAppInventory,
  getPreset as getAppPreset,
  outputTargetsFor as appTargets,
  type GeneratedAsset as AppAsset,
  type AppStoreSection,
} from "@tigawanna/appstore-screenshots";

import type { Board } from "../src/model/schema";
import type { ExportReport, ExportRequest } from "../src/data-access-layer/host/types";

const slices = new Map<string, Buffer>();

export function storeSlice(boardId: string, index: number, bytes: Buffer): void {
  slices.set(`${boardId}:${index}`, bytes);
}

export function clearSlices(): void {
  slices.clear();
}

function sectionFor(board: Board): PlayStoreSection | AppStoreSection {
  switch (board.kind) {
    case "phone":
      return "phone";
    case "tablet":
      return "tablet-10";
    case "foldable":
      return "foldable";
    case "chromebook":
      return "chromebook";
    case "feature":
      return "feature-graphic";
    case "iphone":
      return "iphone";
    case "ipad":
      return "ipad";
  }
}

interface PreparedAsset {
  name: string;
  path: string;
  bytes: number;
  width: number;
  height: number;
  section: string;
  preset: string;
  format: "png" | "jpeg";
}

interface Prepared {
  asset: PreparedAsset;
  bytes: Buffer;
  targets: Array<{ abs: string; rel: string }>;
}

export async function finishExport(
  paths: { root: string },
  input: ExportRequest,
): Promise<ExportReport> {
  const { project, boardIds, settings } = input;
  const outDir = resolve(paths.root, settings.outDir.replace(/^\.\//, ""));
  mkdirSync(outDir, { recursive: true });
  const brandHex = project.theme.tokens.background ?? "#ffffff";
  const background = hexToColor(brandHex);
  const prepared: Prepared[] = [];
  const warnings: string[] = [];
  let layout: "flat" | "fastlane" | "deliver" = "flat";
  if (settings.layout === "deliver") layout = "deliver";
  else if (settings.layout === "fastlane") layout = "fastlane";

  for (const board of project.boards) {
    if (!boardIds.includes(board.id)) continue;
    const preset =
      project.store === "app-store" ? getAppPreset(board.preset) : getPlayPreset(board.preset);
    const section = sectionFor(board);
    for (let index = 0; index < board.sliceCount; index += 1) {
      const raw = slices.get(`${board.id}:${index}`);
      if (raw === undefined) throw new Error(`Missing slice ${index + 1} for board ${board.kind}`);
      const pipeline = sharp(raw).flatten({ background });
      let bytes: Buffer;
      const name = `${String(index + 1).padStart(2, "0")}-${board.preset}.${settings.format === "jpeg" ? "jpg" : "png"}`;
      if (settings.format === "jpeg") bytes = await pipeline.jpeg({ quality: 90 }).toBuffer();
      else bytes = await pipeline.png().toBuffer();
      if (bytes.length > MAX_FILE_BYTES) {
        throw new Error(
          `${name}: ${(bytes.length / 1024 / 1024).toFixed(2)} MB exceeds the 8 MB cap`,
        );
      }
      const targetOptions = {
        outDir,
        layout,
        locale: settings.locale,
        format: settings.format,
      };
      const targets =
        project.store === "app-store"
          ? appTargets(
              { section: section as AppStoreSection, name } as never,
              targetOptions as never,
            )
          : playTargets(
              { section: section as PlayStoreSection, name } as never,
              targetOptions as never,
            );
      const asset: PreparedAsset = {
        name,
        path: targets[0]?.rel ?? `./${name}`,
        bytes: bytes.length,
        width: preset.width,
        height: preset.height,
        section,
        preset: board.preset,
        format: settings.format,
      };
      prepared.push({ asset, bytes, targets });
    }
  }

  const files: ExportReport["files"] = [];
  for (const item of prepared) {
    for (const target of item.targets) {
      mkdirSync(resolve(target.abs, ".."), { recursive: true });
      writeFileSync(target.abs, item.bytes);
      files.push({
        path: target.abs,
        bytes: item.bytes.length,
        width: item.asset.width,
        height: item.asset.height,
      });
    }
  }

  const inventoryOptions = {
    outDir,
    layout: settings.layout,
    locale: settings.locale,
    format: settings.format,
  };
  let configName: string;
  let config: unknown;
  if (project.store === "app-store") {
    config = buildAppInventory(
      prepared.map((item) => item.asset as unknown as AppAsset),
      inventoryOptions as never,
    );
    configName = "appstore-screenshots.config.json";
  } else {
    config = buildPlayInventory(
      prepared.map((item) => item.asset as unknown as PlayAsset),
      inventoryOptions as never,
    );
    configName = "play-screenshots.config.json";
  }
  const configFile = resolve(outDir, configName);
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  files.push({
    path: configFile,
    bytes: Buffer.byteLength(JSON.stringify(config)),
    width: 0,
    height: 0,
  });

  return { files, warnings };
}
