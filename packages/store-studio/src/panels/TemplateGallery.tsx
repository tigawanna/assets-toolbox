import { useState } from "react";

import { Panel } from "./Panel";
import { useProject } from "../data-access-layer/useProject";
import { getCurrentProject } from "../data-access-layer/project";
import type { BoardKind, TemplateInput } from "../model/schema";
import { applyTemplate, familiesForStore, generateAllBoards } from "../templates/registry";

export function TemplateGallery() {
  const project = useProject();
  const [familyId, setFamilyId] = useState("text-top");
  const [appName, setAppName] = useState(project.app.name);
  const [slides, setSlides] = useState<TemplateInput["slides"]>([]);
  const assetIds = Object.keys(project.assets);

  const families = familiesForStore(project.store);
  const input: TemplateInput = {
    appName,
    icon: project.app.icon,
    palette: project.theme.tokens,
    slides,
  };

  function addSlide(): void {
    setSlides((current) => [
      ...current,
      { headline: `Slide ${current.length + 1}`, subtext: "", screenshot: assetIds[0] ?? "" },
    ]);
  }

  return (
    <Panel id="templates" title="Templates" className="template-gallery">
      <label className="field">
        <span>App name</span>
        <input value={appName} onChange={(event) => setAppName(event.target.value)} />
      </label>
      <div className="family-list">
        {families.map((family) => (
          <button
            key={family.id}
            type="button"
            className={family.id === familyId ? "family-card active" : "family-card"}
            onClick={() => setFamilyId(family.id)}
          >
            {family.name}
            {family.credit === undefined ? null : <small>credit: {family.credit.name}</small>}
          </button>
        ))}
      </div>
      <h4>Slides</h4>
      {slides.length === 0 ? (
        <p className="hint">Import screenshots, then add a slide per screen.</p>
      ) : null}
      {slides.map((slide, index) => (
        <div key={index} className="slide-editor">
          <input
            aria-label={`Headline ${index + 1}`}
            value={slide.headline}
            onChange={(event) =>
              setSlides((current) =>
                current.map((item, i) =>
                  i === index ? { ...item, headline: event.target.value } : item,
                ),
              )
            }
          />
          <input
            aria-label={`Subtext ${index + 1}`}
            placeholder="Subtext"
            value={slide.subtext ?? ""}
            onChange={(event) =>
              setSlides((current) =>
                current.map((item, i) =>
                  i === index ? { ...item, subtext: event.target.value } : item,
                ),
              )
            }
          />
          <select
            aria-label={`Screenshot ${index + 1}`}
            value={slide.screenshot}
            onChange={(event) =>
              setSlides((current) =>
                current.map((item, i) =>
                  i === index ? { ...item, screenshot: event.target.value } : item,
                ),
              )
            }
          >
            <option value="">Screenshot…</option>
            {assetIds.map((id) => (
              <option key={id} value={id}>
                {project.assets[id]?.file ?? id}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSlides((current) => current.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={addSlide}>
        + Slide
      </button>
      <div className="gallery-actions">
        <button
          type="button"
          disabled={slides.length === 0}
          onClick={() => {
            const boardId = getCurrentProject().boards[0]?.id;
            if (boardId !== undefined) applyTemplate(boardId, familyId, input);
          }}
        >
          Apply to board
        </button>
        <button
          type="button"
          disabled={slides.length === 0}
          onClick={() => {
            const kinds: BoardKind[] =
              project.store === "play"
                ? ["phone", "tablet", "foldable", "chromebook", "feature"]
                : ["iphone", "ipad"];
            generateAllBoards(kinds, familyId, input);
          }}
        >
          Generate all boards
        </button>
      </div>
    </Panel>
  );
}
