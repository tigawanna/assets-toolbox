import { getPreset } from "@tigawanna/play-screenshots/sizes";

import { updateProject } from "../data-access-layer/project";
import type { Board, BoardKind, StudioProject, TemplateInput } from "../model/schema";
import { presetForKind } from "../model/migrate";
import { getFamily, materializeBoard, TEMPLATE_FAMILIES, type TemplateFamily } from "./families";
import { uid } from "./factory";

export { TEMPLATE_FAMILIES, getFamily, materializeBoard };
export type { TemplateFamily };

export function familiesForStore(store: StudioProject["store"]): TemplateFamily[] {
  return TEMPLATE_FAMILIES.filter(
    (family) => family.stores === undefined || family.stores.includes(store),
  );
}

export function materializeStudioBoard(
  project: StudioProject,
  kind: BoardKind,
  familyId: string,
  input: TemplateInput,
): Board {
  const presetId = presetForKind(kind, project.store);
  const preset = getPreset(presetId);
  const draft = materializeBoard(familyId, kind, input, preset);
  return {
    id: uid("board"),
    kind,
    preset: presetId,
    sliceCount: input.slides.length,
    background: draft.background,
    nodes: draft.nodes,
    sliceMeta: draft.sliceMeta,
    detached: false,
    source: { family: familyId, input },
  };
}

/** Agent hand-off: boards with `source` and no nodes are materialised on open. */
export function materializeSources(): void {
  updateProject((draft) => {
    for (const board of draft.boards) {
      if (board.nodes.length > 0 || board.source === undefined) continue;
      const preset = getPreset(board.preset);
      const built = materializeBoard(board.source.family, board.kind, board.source.input, preset);
      board.nodes = built.nodes;
      board.sliceCount = built.sliceMeta.length || board.source.input.slides.length;
      if (built.sliceMeta.length > 0) board.sliceMeta = built.sliceMeta;
    }
  });
}

export function applyTemplate(boardId: string, familyId: string, input: TemplateInput): void {
  updateProject((draft) => {
    const index = draft.boards.findIndex((board) => board.id === boardId);
    if (index < 0) return;
    const existing = draft.boards[index]!;
    if (
      existing.detached === true &&
      !window.confirm("This board has edits. Replace it with the template?")
    )
      return;
    const board = materializeStudioBoard(draft, existing.kind, familyId, input);
    board.id = existing.id;
    draft.boards[index] = board;
  });
}

export function generateAllBoards(
  kinds: BoardKind[],
  familyId: string,
  input: TemplateInput,
): void {
  updateProject((draft) => {
    for (const kind of kinds) {
      const presetId = presetForKind(kind, draft.store);
      const board = materializeStudioBoard(draft, kind, familyId, input);
      const existingIndex = draft.boards.findIndex(
        (candidate) => candidate.kind === kind && candidate.preset === presetId,
      );
      if (existingIndex >= 0) board.id = draft.boards[existingIndex]!.id;
      draft.boards[existingIndex >= 0 ? existingIndex : draft.boards.length] = board;
    }
  });
}
