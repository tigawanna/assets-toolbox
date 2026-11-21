import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { projectPaths, readProject, safePath, writeProject } from "../server/project-io";
import { finishExport, storeSlice } from "../server/export";
import { createDefaultProject } from "../src/model/migrate";
import { MemoryHost } from "../src/data-access-layer/host/memory";
import { setHost } from "../src/data-access-layer/host";
import { loadProject, updateProject, saveNow } from "../src/data-access-layer/project";

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "store-studio-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  setHost(null);
});

describe("project I/O", () => {
  it("creates and round-trips project.json", () => {
    const dir = tempDir();
    const paths = projectPaths(dir);
    const created = readProject(paths);
    expect(created.version).toBe(1);
    created.app.name = "Renamed";
    writeProject(paths, created);
    expect(readProject(paths).app.name).toBe("Renamed");
  });

  it("refuses path traversal", () => {
    const dir = tempDir();
    expect(() => safePath(dir, "../secret.txt")).toThrow(/escapes/);
    expect(safePath(dir, "assets/shot.png")).toBe(join(dir, "assets/shot.png"));
  });
});

describe("memory host", () => {
  it("loads, mutates and saves a document through the DAL", async () => {
    const host = new MemoryHost();
    setHost(host);
    const loaded = await loadProject();
    expect(loaded.app.name).toBe("My App");
    updateProject((draft) => {
      draft.app.name = "Updated";
    });
    await saveNow();
    expect((await host.readProject()).app.name).toBe("Updated");
  });
});

describe("server export", () => {
  it("writes opaque exact-size PNGs and an inventory", async () => {
    const dir = tempDir();
    const project = createDefaultProject();
    project.boards[0]!.sliceCount = 2;
    project.boards[0]!.sliceMeta = [{ alt: "Home" }, { alt: "Search" }];
    const bytes = await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 4,
        background: { r: 20, g: 30, b: 40, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();
    storeSlice(project.boards[0]!.id, 0, bytes);
    storeSlice(project.boards[0]!.id, 1, bytes);
    const report = await finishExport(
      { root: dir },
      {
        project,
        boardIds: project.boards.map((board) => board.id),
        settings: { ...project.export, outDir: "store/google" },
      },
    );
    expect(report.files.filter((file) => file.path.endsWith(".png"))).toHaveLength(2);
    const meta = await sharp(join(dir, "store/google/01-phone-portrait.png")).metadata();
    expect(meta).toMatchObject({ width: 1080, height: 1920, format: "png" });
    expect(meta.hasAlpha).toBe(false);
    const config = JSON.parse(
      readFileSync(join(dir, "store/google/play-screenshots.config.json"), "utf8"),
    );
    expect(config.play.phone).toHaveLength(2);
  });
});
