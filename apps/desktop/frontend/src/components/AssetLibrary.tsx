import { useEffect, useRef, useState } from "react";
import { Copy, ImagePlus, Trash2 } from "lucide-react";

import { useProjectAssets } from "../lib/projects/assets";
import { getProjectClient } from "../lib/projects/client";
import type { AssetId, ProjectId } from "../lib/projects/types";
import { PreviewGalleryDialog, type PreviewGalleryItem } from "./PreviewGalleryDialog";
import { ToolHeaderButton } from "./ToolHeader";

export function AssetLibrary() {
  const { assets, add, remove, move, preview } = useProjectAssets();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Array<{ id: ProjectId; name: string }>>([]);
  const [target, setTarget] = useState("");
  const [selected, setSelected] = useState<AssetId[]>([]);
  const [error, setError] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getProjectClient()
      .listProjects()
      .then((projects) => setTargets(projects.map(({ id, name }) => ({ id, name }))))
      .catch(() => setTargets([]));
  }, [assets.length]);

  useEffect(() => {
    let active = true;
    const next: Record<string, string> = {};
    void Promise.all(
      assets.map(async (asset) => {
        if (!asset.mime.startsWith("image/")) return;
        try {
          next[asset.id] = await preview(asset);
        } catch {
          // A missing blob simply has no thumbnail.
        }
      }),
    ).then(() => {
      if (active) setThumbs(next);
    });
    return () => {
      active = false;
    };
  }, [assets, preview]);

  const galleryItems: PreviewGalleryItem[] = assets
    .filter((asset) => thumbs[asset.id])
    .map((asset) => ({ title: asset.name, src: thumbs[asset.id] }));

  const toggle = (id: AssetId) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const runMove = async (mode: "copy" | "move") => {
    if (selected.length === 0 || !target) return;
    try {
      await move(selected, target as ProjectId, mode);
      setSelected([]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not move those assets.");
    }
  };

  return (
    <section className="project-assets">
      <div className="project-assets-head">
        <h2>Project assets</h2>
        <div className="project-assets-tools">
          <select
            aria-label="Target project"
            value={target}
            onChange={(event) => setTarget(event.currentTarget.value)}
          >
            <option value="">Target project…</option>
            {targets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <ToolHeaderButton
            disabled={selected.length === 0 || !target}
            onClick={() => void runMove("copy")}
          >
            <Copy size={13} />
            Copy
          </ToolHeaderButton>
          <ToolHeaderButton
            disabled={selected.length === 0 || !target}
            onClick={() => void runMove("move")}
          >
            Move
          </ToolHeaderButton>
          <ToolHeaderButton variant="primary" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={13} />
            Add asset
          </ToolHeaderButton>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/*,.svg"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void add(file).catch((cause: unknown) => setError(String(cause)));
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      {error ? <p className="project-assets-error">{error}</p> : null}

      <div className="project-assets-grid">
        {assets.length === 0 ? (
          <p className="project-assets-empty">
            No assets yet. Add an image to share it across tools.
          </p>
        ) : (
          assets.map((asset) => {
            const galleryPosition = galleryItems.findIndex((item) => item.title === asset.name);
            return (
              <article className="project-assets-card" key={asset.id}>
                <div className="project-assets-card-top">
                  <input
                    type="checkbox"
                    aria-label={`Select ${asset.name}`}
                    checked={selected.includes(asset.id)}
                    onChange={() => toggle(asset.id)}
                  />
                  <ToolHeaderButton
                    variant="icon"
                    aria-label={`Delete ${asset.name}`}
                    onClick={() => void remove(asset.id)}
                  >
                    <Trash2 size={13} />
                  </ToolHeaderButton>
                </div>
                <button
                  type="button"
                  className="project-assets-preview"
                  aria-label={`Preview ${asset.name}`}
                  disabled={galleryPosition < 0}
                  onClick={() => {
                    setGalleryIndex(Math.max(0, galleryPosition));
                    setGalleryOpen(true);
                  }}
                >
                  {thumbs[asset.id] ? (
                    <img src={thumbs[asset.id]} alt="" />
                  ) : (
                    <span>{asset.mime.split("/").at(-1)?.slice(0, 4)}</span>
                  )}
                </button>
                <div className="project-assets-card-meta">
                  <strong title={asset.name}>{asset.name}</strong>
                  <span>{Math.round(asset.bytes / 1024)} KB</span>
                </div>
              </article>
            );
          })
        )}
      </div>

      {galleryOpen ? (
        <PreviewGalleryDialog
          items={galleryItems}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryOpen(false)}
        />
      ) : null}
    </section>
  );
}
