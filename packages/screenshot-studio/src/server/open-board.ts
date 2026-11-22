import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { boardCollections } from "@/lib/scenes";

import { studioRoot } from "./connection";
import { readStudio } from "./queries";
import { resolveStudioPath } from "./projects";
import { studioOrigin } from "./settings";

export interface OpenBoardFocus {
  projectId: string | null;
  focusedAt: string;
}

export function openBoardPath(): string {
  return join(studioRoot(), "open.json");
}

export function writeOpenBoard(projectId: string | null): OpenBoardFocus {
  const focus: OpenBoardFocus = {
    projectId: projectId === "" ? null : projectId,
    focusedAt: new Date().toISOString(),
  };
  mkdirSync(studioRoot(), { recursive: true });
  writeFileSync(openBoardPath(), `${JSON.stringify(focus, null, 2)}\n`);
  return focus;
}

export function readOpenBoard(): OpenBoardFocus | null {
  const file = openBoardPath();
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as OpenBoardFocus;
    if (parsed === null || typeof parsed !== "object") return null;
    const projectId =
      typeof parsed.projectId === "string" && parsed.projectId !== "" ? parsed.projectId : null;
    return {
      projectId,
      focusedAt: typeof parsed.focusedAt === "string" ? parsed.focusedAt : "",
    };
  } catch {
    return null;
  }
}

export function describeOpenBoard() {
  const focus = readOpenBoard();
  if (focus === null || focus.projectId === null) {
    return {
      open: false,
      projectId: null,
      hint: "No board is focused. Open a board in Screenshot Studio, or pass projectId from list_boards.",
    };
  }
  const path = resolveStudioPath(focus.projectId);
  if (!existsSync(path)) {
    return {
      open: true,
      projectId: focus.projectId,
      name: null,
      focusedAt: focus.focusedAt,
      hint: "The studio focused this id, but the board file is missing.",
    };
  }
  const snapshot = readStudio(path);
  return {
    open: true,
    projectId: focus.projectId,
    name: snapshot.board.name,
    focusedAt: focus.focusedAt,
    url: `${studioOrigin()}/board/${focus.projectId}`,
    collections: boardCollections(snapshot.board).map((collection) => ({
      id: collection.id,
      name: collection.name,
      store: collection.store,
      sliceCount: collection.sliceCount,
    })),
    eventCount: snapshot.events.length,
    nodeCount: snapshot.nodes.length,
  };
}
