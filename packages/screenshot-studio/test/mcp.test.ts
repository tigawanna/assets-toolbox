import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { handleMcpMessage } from "../src/server/mcp";
import { studioSettings } from "../src/server/settings";

const dirs: string[] = [];

afterEach(() => {
  const created = dirs.splice(0);
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe("studio settings", () => {
  it("points MCP at the running origin and keeps boards under the data folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "screenshot-studio-settings-"));
    dirs.push(dir);
    const previous = process.env.SCREENSHOT_STUDIO_DATA;
    process.env.SCREENSHOT_STUDIO_DATA = dir;
    const settings = studioSettings("abc");
    expect(settings.dataRoot).toBe(dir);
    expect(settings.projectsDir).toContain("projects");
    expect(settings.mcpUrl).toMatch(/\/mcp$/);
    expect(settings.mcpConfig.mcpServers["screenshot-studio"]?.url).toBe(settings.mcpUrl);
    expect(settings.boardFile).toContain("abc.sqlite");
    if (previous === undefined) delete process.env.SCREENSHOT_STUDIO_DATA;
    else process.env.SCREENSHOT_STUDIO_DATA = previous;
  });
});

describe("MCP JSON-RPC", () => {
  it("advertises tools after initialize", async () => {
    const init = await handleMcpMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });
    expect(init).toMatchObject({
      result: { serverInfo: { name: "screenshot-studio" } },
    });
    const listed = await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(JSON.stringify(listed)).toContain("list_boards");
    expect(JSON.stringify(listed)).toContain("clone_collection");
    expect(JSON.stringify(listed)).toContain("delete_collection");
    expect(JSON.stringify(listed)).toContain("get_open_board");
  });
});

describe("open board focus", () => {
  it("records the focused board for MCP", async () => {
    const dir = mkdtempSync(join(tmpdir(), "screenshot-studio-open-"));
    dirs.push(dir);
    const previous = process.env.SCREENSHOT_STUDIO_DATA;
    process.env.SCREENSHOT_STUDIO_DATA = dir;
    const { writeOpenBoard, describeOpenBoard } = await import("../src/server/open-board");
    writeOpenBoard(null);
    expect(describeOpenBoard().open).toBe(false);
    writeOpenBoard("abc123");
    expect(describeOpenBoard()).toMatchObject({
      open: true,
      projectId: "abc123",
      name: null,
    });
    if (previous === undefined) delete process.env.SCREENSHOT_STUDIO_DATA;
    else process.env.SCREENSHOT_STUDIO_DATA = previous;
  });
});
