// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { closeWorkspace, loadWorkspace, saveWorkspace } from "../server/storage.mjs";

const withDatabase = (run: (path: string) => void) => {
  const folder = mkdtempSync(join(tmpdir(), "svg-compose-"));
  const path = join(folder, "workspace.sqlite");
  try {
    run(path);
  } finally {
    closeWorkspace(path);
    rmSync(folder, { recursive: true, force: true });
  }
};

describe("Node workspace", () => {
  it("loads an empty workspace", () => {
    withDatabase((path) => {
      expect(loadWorkspace(path)).toBeNull();
    });
  });

  it("saves and reloads the draft on the Node side", () => {
    withDatabase((path) => {
      const saved = saveWorkspace(
        {
          name: "Icon set",
          svg: '<g id="a"><rect width="10" height="10"/></g>',
          viewport: { zoom: 2, tx: 20, ty: -10 },
        },
        path,
      );
      expect(saved.name).toBe("Icon set");
      expect(loadWorkspace(path)).toEqual(saved);
    });
  });

  it("updates the same draft row", () => {
    withDatabase((path) => {
      saveWorkspace({ name: "First", svg: "<rect/>" }, path);
      const second = saveWorkspace({ name: "Second", svg: "<circle/>" }, path);
      expect(second.name).toBe("Second");
      expect(loadWorkspace(path)?.svg).toBe("<circle/>");
      expect(loadWorkspace(path)?.id).toBe("draft");
    });
  });

  it("rejects invalid snapshots and oversized documents", () => {
    withDatabase((path) => {
      expect(() => saveWorkspace({ svg: 42 } as unknown as { svg: string }, path)).toThrow();
      expect(() => saveWorkspace({ svg: "x".repeat(8 * 1024 * 1024 + 1) }, path)).toThrow();
    });
  });
});
