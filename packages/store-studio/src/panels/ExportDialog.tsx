import { useState } from "react";

import { exportProject } from "../data-access-layer/export";
import { useProject } from "../data-access-layer/useProject";
import { renderSlice } from "../render/renderSlice";
import { createZip } from "../render/zip";
import type { ExportReport } from "../data-access-layer/host";

export function ExportDialog() {
  const project = useProject();
  const [open, setOpen] = useState(false);
  const [boardIds, setBoardIds] = useState<string[]>(project.boards.map((board) => board.id));
  const [format, setFormat] = useState<"png" | "jpeg">(project.export.format);
  const [layout, setLayout] = useState<"flat" | "fastlane" | "deliver">(project.export.layout);
  const [locale, setLocale] = useState(project.export.locale);
  const [zip, setZip] = useState(project.export.zip);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ExportReport | null>(null);

  async function run(): Promise<void> {
    setBusy(true);
    setReport(null);
    const blobs = new Map<string, Blob>();
    try {
      const result = await exportProject(
        project,
        boardIds,
        { ...project.export, format, layout, locale, zip },
        async (boardId, index) => {
          const board = project.boards.find((candidate) => candidate.id === boardId);
          if (board === undefined) throw new Error(`Unknown board ${boardId}`);
          const blob = await renderSlice(project, board, index);
          blobs.set(`${board.preset}-${index}`, blob);
          return blob;
        },
      );
      setReport(result);
      if (zip) {
        const file = await createZip(
          [...blobs.entries()].map(([key, blob]) => ({
            name: `${key}.${format === "jpeg" ? "jpg" : "png"}`,
            blob,
          })),
        );
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "store-screenshots.zip";
        anchor.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      setReport({ files: [], warnings: [error instanceof Error ? error.message : String(error)] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="primary" onClick={() => setOpen(true)}>
        Export
      </button>
      {open ? (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(event) => event.stopPropagation()}>
            <h2>Export screenshots</h2>
            <label className="field">
              <span>Boards</span>
              <div className="check-list">
                {project.boards.map((board) => (
                  <label key={board.id}>
                    <input
                      type="checkbox"
                      checked={boardIds.includes(board.id)}
                      onChange={() =>
                        setBoardIds((current) =>
                          current.includes(board.id)
                            ? current.filter((id) => id !== board.id)
                            : [...current, board.id],
                        )
                      }
                    />
                    {board.kind} · {board.sliceCount} slices
                  </label>
                ))}
              </div>
            </label>
            <div className="field-grid">
              <label className="field">
                <span>Format</span>
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as "png" | "jpeg")}
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                </select>
              </label>
              <label className="field">
                <span>Layout</span>
                <select
                  value={layout}
                  onChange={(event) => setLayout(event.target.value as typeof layout)}
                >
                  <option value="flat">Flat</option>
                  <option value="fastlane">Fastlane</option>
                  <option value="deliver">Deliver</option>
                </select>
              </label>
              <label className="field">
                <span>Locale</span>
                <input value={locale} onChange={(event) => setLocale(event.target.value)} />
              </label>
              <label className="field checkbox">
                <span>ZIP download</span>
                <input
                  type="checkbox"
                  checked={zip}
                  onChange={(event) => setZip(event.target.checked)}
                />
              </label>
            </div>
            <button
              type="button"
              className="primary"
              disabled={busy || boardIds.length === 0}
              onClick={() => void run()}
            >
              {busy ? "Rendering…" : "Export"}
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
            {report === null ? null : (
              <div className="export-report">
                <h3>{report.files.length} files written</h3>
                {report.files.map((file) => (
                  <div key={file.path}>
                    {file.path} · {file.width}×{file.height} · {Math.round(file.bytes / 1024)} KB
                  </div>
                ))}
                {report.warnings.map((warning, index) => (
                  <div key={index} className="warning">
                    ⚠ {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
