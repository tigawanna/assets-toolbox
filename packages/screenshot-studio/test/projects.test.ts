import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { closeStudio, projectDatabasePath } from "../src/server/connection";
import { addDevice } from "../src/server/mutations";
import {
  cloneProject,
  createProject,
  deleteProject,
  listProjects,
  renameProject,
} from "../src/server/projects";
import { readStudio } from "../src/server/queries";

const dirs: string[] = [];
let previousData: string | undefined;

describe("project files", () => {
  beforeEach(() => {
    previousData = process.env.SCREENSHOT_STUDIO_DATA;
    const dir = mkdtempSync(join(tmpdir(), "screenshot-studio-projects-"));
    dirs.push(dir);
    process.env.SCREENSHOT_STUDIO_DATA = dir;
  });

  afterEach(() => {
    const created = dirs.splice(0);
    for (const dir of created) {
      for (const project of listProjects()) closeStudio(projectDatabasePath(project.id));
      rmSync(dir, { recursive: true, force: true });
    }
    if (previousData === undefined) delete process.env.SCREENSHOT_STUDIO_DATA;
    else process.env.SCREENSHOT_STUDIO_DATA = previousData;
  });

  it("lists nothing until a board is created", () => {
    expect(listProjects()).toEqual([]);
    const created = createProject("Hero phones");
    expect(created.name).toBe("Hero phones");
    const listed = listProjects();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
    expect(listed[0]?.name).toBe("Hero phones");
    expect(listed[0]?.nodeCount).toBe(0);
  });

  it("renames and deletes a board file", () => {
    const created = createProject("Draft");
    expect(renameProject(created.id, "Launch").name).toBe("Launch");
    expect(listProjects()[0]?.name).toBe("Launch");
    deleteProject(created.id);
    expect(listProjects()).toEqual([]);
  });

  it("clones every scene and can apply Apple rules on the copy", () => {
    const created = createProject("Hero phones");
    addDevice("phone-punch", 0, projectDatabasePath(created.id));
    const copy = cloneProject(created.id);
    expect(copy.name).toBe("Hero phones copy");
    expect(copy.id).not.toBe(created.id);
    expect(copy.nodeCount).toBe(1);
    const apple = cloneProject(created.id, { store: "app-store" });
    expect(apple.name).toBe("Hero phones · Apple");
    expect(apple.store).toBe("app-store");
    const snapshot = readStudio(projectDatabasePath(apple.id));
    expect(snapshot.board.presetId).toBe("iphone-6-9");
    expect(snapshot.nodes[0]?.type).toBe("device");
    if (snapshot.nodes[0]?.type === "device") {
      expect(snapshot.nodes[0].model).toBe("iphone-island");
    }
    expect(listProjects()).toHaveLength(3);
  });
});
