import { useEffect, useState } from "react";
import { getPreset } from "@tigawanna/play-screenshots/sizes";

import { useProject } from "../data-access-layer/useProject";
import { renderSlice } from "../render/renderSlice";
import { useView } from "../session/view";

export function StorePreview() {
  const project = useProject();
  const { activeBoardId } = useView();
  const [urls, setUrls] = useState<string[]>([]);
  const [dark, setDark] = useState(true);
  const board =
    project.boards.find((candidate) => candidate.id === activeBoardId) ?? project.boards[0];

  useEffect(() => {
    if (board === undefined) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    const generated: string[] = [];
    void (async () => {
      for (let index = 0; index < board.sliceCount; index += 1) {
        const blob = await renderSlice(project, board, index);
        generated.push(URL.createObjectURL(blob));
      }
      if (cancelled) generated.forEach((url) => URL.revokeObjectURL(url));
      else setUrls(generated);
    })();
    return () => {
      cancelled = true;
      generated.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [board?.id, project]);

  if (board === undefined) return null;
  const preset = getPreset(board.preset);
  return (
    <div className={dark ? "store-preview dark" : "store-preview light"}>
      <div className="preview-head">
        <strong>Store preview</strong>
        <span className="hint">approximate · gaps shown</span>
        <button type="button" onClick={() => setDark(!dark)}>
          {dark ? "Light" : "Dark"}
        </button>
      </div>
      <div className="preview-carousel">
        {urls.map((url, index) => (
          <div
            key={index}
            className="preview-card"
            style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
          >
            <img src={url} alt={`Slice ${index + 1}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
