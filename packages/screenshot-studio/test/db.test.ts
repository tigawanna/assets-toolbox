import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { closeStudio } from "../src/server/connection";
import { addFrame, moveFrame, removeFrame } from "../src/server/mutations";
import { readStudio } from "../src/server/queries";

const dirs: string[] = [];

function databasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "screenshot-studio-"));
  dirs.push(dir);
  return join(dir, "studio.sqlite");
}

afterEach(() => {
  const created = dirs.splice(0);
  for (const dir of created) closeStudio(join(dir, "studio.sqlite"));
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe("studio event log", () => {
  it("records an add, a move, and a remove", async () => {
    const path = databasePath();
    addFrame("play", "phone-portrait", path);
    const added = readStudio(path);
    const frame = added.frames[0];
    expect(frame).toBeDefined();
    expect(added.events).toHaveLength(1);

    moveFrame(frame!.id, 420, 180, path);
    const moved = readStudio(path);
    expect(moved.frames[0]?.x).toBe(420);
    expect(moved.frames[0]?.y).toBe(180);
    expect(moved.events.map((event) => event.kind)).toEqual(["add", "move"]);

    removeFrame(frame!.id, path);
    const removed = readStudio(path);
    expect(removed.frames).toHaveLength(0);
    expect(removed.events.map((event) => event.kind)).toEqual(["add", "move", "remove"]);
  });
});
