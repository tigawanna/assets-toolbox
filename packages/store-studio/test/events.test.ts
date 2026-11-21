import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  applyPatch,
  createBaseRecord,
  decodeLog,
  diffDocuments,
  encodeLog,
  replayLog,
  isEventRecord,
} from "../src/model/events";
import { createDefaultProject } from "../src/model/migrate";
import { MemoryHost } from "../src/data-access-layer/host/memory";
import { setHost } from "../src/data-access-layer/host";
import { flushEvents, resetEventQueue } from "../src/data-access-layer/events";
import {
  getCurrentProject,
  loadProject,
  saveNow,
  updateProject,
} from "../src/data-access-layer/project";
import { appendEvent, readEvents } from "../server/events";
import { main } from "../server/cli";

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "store-studio-events-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  setHost(null);
  resetEventQueue();
});

describe("document patches", () => {
  it("diffs and reapplies nested changes, additions and removals", () => {
    const before = createDefaultProject();
    const after = structuredClone(before);
    after.app.name = "Renamed";
    after.theme.tokens.accent = "#ff0000";
    after.boards[0]!.sliceCount = 3;
    after.boards[0]!.sliceMeta.push({ alt: "Third" });
    delete after.theme.tokens.muted;

    const patch = diffDocuments(before, after);
    expect(patch.length).toBeGreaterThan(0);
    expect(JSON.stringify(applyPatch(before, patch))).toBe(JSON.stringify(after));
    expect(JSON.stringify(applyPatch(after, diffDocuments(after, before)))).toBe(
      JSON.stringify(before),
    );
  });

  it("round-trips an encoded log and replays it", () => {
    const base = createDefaultProject();
    const final = structuredClone(base);
    final.app.name = "Final";
    final.boards[0]!.background = { type: "solid", color: "#ffffff" };
    const log = {
      version: 1 as const,
      records: [
        createBaseRecord(base, "2026-01-01T00:00:00.000Z"),
        {
          kind: "event" as const,
          seq: 1,
          id: "e1",
          ts: "2026-01-01T00:00:01.000Z",
          actor: "editor",
          label: "rename",
          parentSeq: 0,
          patch: diffDocuments(base, final),
        },
      ],
    };
    expect(JSON.stringify(replayLog(decodeLog(encodeLog(log))))).toBe(JSON.stringify(final));
    expect(log.records.filter(isEventRecord)).toHaveLength(1);
  });

  it("rejects a log with a sequence gap", () => {
    const base = createDefaultProject();
    expect(() =>
      replayLog({
        version: 1,
        records: [
          createBaseRecord(base),
          { kind: "event", seq: 2, id: "x", ts: "", actor: "a", parentSeq: 0, patch: [] },
        ],
      }),
    ).toThrow(/gap/);
  });
});

describe("portable event log", () => {
  it("records edits through the DAL and replays to the same document", async () => {
    const host = new MemoryHost();
    setHost(host);
    await loadProject();
    updateProject((draft) => {
      draft.app.name = "From events";
    });
    updateProject((draft) => {
      draft.boards[0]!.sliceCount = 4;
      draft.boards[0]!.sliceMeta = Array.from({ length: 4 }, (_, index) => ({
        alt: `Slice ${index + 1}`,
      }));
    });
    await flushEvents();
    await saveNow();

    const log = await host.readEvents();
    expect(log).not.toBeNull();
    expect(log!.records.filter(isEventRecord)).toHaveLength(2);
    expect(JSON.stringify(replayLog(log!))).toBe(JSON.stringify(getCurrentProject()));
  });

  it("appends to an on-disk log and supports the replay CLI", async () => {
    const dir = tempDir();
    const project = createDefaultProject();
    project.app.name = "Disk base";
    const projectFile = join(dir, "project.json");
    writeFileSync(projectFile, `${JSON.stringify(project, null, 2)}\n`);

    const first = appendEvent(dir, {
      id: "disk-1",
      ts: "2026-01-01T00:00:01.000Z",
      actor: "editor",
      label: "rename",
      parentSeq: 0,
      patch: diffDocuments(project, { ...project, app: { name: "Disk final" } }),
    });
    expect(first.seq).toBe(1);
    appendEvent(dir, {
      id: "disk-2",
      ts: "2026-01-01T00:00:02.000Z",
      actor: "editor",
      parentSeq: 1,
      patch: [{ op: "set", path: ["boards", 0, "sliceCount"], value: 2 }],
    });

    const log = readEvents(dir);
    expect(log).not.toBeNull();
    expect(log!.records.filter(isEventRecord)).toHaveLength(2);

    const logFile = join(dir, "events.jsonl");
    const out = join(dir, "project.replayed.json");
    await main(["replay", logFile, "--out", out]);
    const replayed = JSON.parse(readFileSync(out, "utf8"));
    expect(replayed.app.name).toBe("Disk final");
    expect(replayed.boards[0].sliceCount).toBe(2);

    writeFileSync(projectFile, `${JSON.stringify(replayed, null, 2)}\n`);
    await main(["replay", logFile, "--out", out, "--verify", projectFile]);
    expect(process.exitCode ?? 0).toBe(0);
  });
});
