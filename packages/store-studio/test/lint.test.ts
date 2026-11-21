import { describe, expect, it } from "vite-plus/test";

import { lintProject } from "../src/lint/rules";
import { createDefaultProject } from "../src/model/migrate";
import { uid, textNode } from "../src/templates/factory";

function withText(text: string, x = 100, width = 900) {
  const project = createDefaultProject();
  const board = project.boards[0]!;
  board.sliceCount = 2;
  board.sliceMeta = [{}, {}];
  board.nodes = [
    textNode({ x, y: 100, width, height: 200 }, text, 80, "#ffffff", { id: uid("t") }),
  ];
  return project;
}

describe("lint rules", () => {
  it("flags banned words", () => {
    const issues = lintProject(withText("Best app #1 — Download now"));
    expect(issues.some((issue) => issue.id.endsWith(":banned") && issue.severity === "error")).toBe(
      true,
    );
  });

  it("flags text crossing a slice cut", () => {
    const issues = lintProject(withText("Inbox zero", 900, 400));
    expect(issues.some((issue) => issue.id.endsWith(":slice-cut"))).toBe(true);
  });

  it("flags missing alt text and too few phone slices", () => {
    const project = createDefaultProject();
    const issues = lintProject(project);
    expect(issues.some((issue) => issue.id.includes("alt-missing"))).toBe(true);
    expect(issues.some((issue) => issue.id.endsWith(":count") && issue.severity === "error")).toBe(
      true,
    );
  });

  it("warns about low-contrast feature graphic fills", () => {
    const project = createDefaultProject();
    project.boards[0]!.background = { type: "solid", color: "#ffffff" };
    const issues = lintProject(project);
    expect(issues.some((issue) => issue.id.endsWith(":background-contrast"))).toBe(true);
  });
});
