import type { ExportSettings, StudioProject } from "../model/schema";
import type { ExportReport } from "./host";
import { getHost } from "./host";
import { lintProject } from "../lint/rules";

export type SliceRenderer = (boardId: string, index: number) => Promise<Blob>;

/** Send every slice through the host, then ask it to finish and write the inventory. */
export async function exportProject(
  project: StudioProject,
  boardIds: string[],
  settings: ExportSettings,
  renderSlice: SliceRenderer,
): Promise<ExportReport> {
  const warnings: string[] = [];
  for (const issue of lintProject(project)) {
    if (issue.severity !== "error")
      warnings.push(`${issue.boardId ?? "project"}: ${issue.message}`);
  }

  for (const boardId of boardIds) {
    const board = project.boards.find((candidate) => candidate.id === boardId);
    if (board === undefined) continue;
    for (let index = 0; index < board.sliceCount; index += 1) {
      const png = await renderSlice(boardId, index);
      await getHost().exportSlice({ boardId, index, png });
    }
  }

  const report = await getHost().finishExport({ project, boardIds, settings });
  return { ...report, warnings: [...warnings, ...report.warnings] };
}
