import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Copy, Ellipsis, ImagePlus, Trash2 } from "lucide-react";

import { useProjectAssets } from "../lib/projects/assets";
import { getProjectClient } from "../lib/projects/client";
import { useProject } from "../lib/projects/context";
import type { AssetId, AssetRecord, ToolId } from "../lib/projects/types";
import { TOOL_IDS } from "../lib/projects/types";
import { PreviewGalleryDialog, type PreviewGalleryItem } from "./PreviewGalleryDialog";
import { ToolHeaderButton } from "./ToolHeader";
import { Checkbox } from "./ui/checkbox";

const TOOL_LABELS: Record<string, string> = {
  brand: "Brand Assets",
  expo: "Expo Assets",
  studio: "Screenshot Studio",
  compose: "Icon Compose",
  sound: "Cabra Sound",
  inspect: "Social Inspect",
  source: "Source artwork",
};

export function AssetLibrary() {
  const { assets, add, remove, removeMany, move, preview } = useProjectAssets();
  const { projectId } = useProject();
  const navigate = useNavigate();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [owners, setOwners] = useState<Partial<Record<AssetId, ToolId>>>({});
  const [sources, setSources] = useState<Partial<Record<AssetId, AssetId>>>({});
  const [selected, setSelected] = useState<AssetId[]>([]);
  const [error, setError] = useState("");
  const [galleryTool, setGalleryTool] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cardMenuId, setCardMenuId] = useState<AssetId | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!actionsOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (actionsRef.current?.contains(event.target as Node)) return;
      setActionsOpen(false);
      setConfirmDelete(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setActionsOpen(false);
      setConfirmDelete(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [actionsOpen]);

  useEffect(() => {
    if (!cardMenuId) return;
    function handlePointerDown(event: PointerEvent) {
      if ((event.target as HTMLElement).closest(".project-assets-card-controls")) return;
      setCardMenuId(null);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setCardMenuId(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [cardMenuId]);

  useEffect(() => {
    let active = true;
    const client = getProjectClient();
    void Promise.all(
      TOOL_IDS.map(async (tool) => {
        try {
          const document = await client.getDocument<{
            outputAssetIds?: string[];
            assetIds?: string[];
            sourceAssetId?: string;
            sourceAssetIds?: Record<string, string>;
          }>(projectId, tool);
          const data = document?.data;
          const sourcesForTool =
            data?.sourceAssetId ??
            data?.sourceAssetIds?.icon ??
            Object.values(data?.sourceAssetIds ?? {})[0] ??
            "";
          return {
            tool,
            ids: data?.outputAssetIds ?? data?.assetIds ?? [],
            source: sourcesForTool,
          };
        } catch {
          return { tool, ids: [] as string[], source: "" };
        }
      }),
    ).then((documents) => {
      if (!active) return;
      const ownerMap: Partial<Record<AssetId, ToolId>> = {};
      const sourceMap: Partial<Record<AssetId, AssetId>> = {};
      for (const { tool, ids, source } of documents) {
        for (const id of ids) {
          ownerMap[id as AssetId] = tool;
          if (source) sourceMap[id as AssetId] = source as AssetId;
        }
      }
      setOwners(ownerMap);
      setSources(sourceMap);
    });
    return () => {
      active = false;
    };
  }, [assets, projectId]);

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

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);

  const groups = useMemo(() => {
    const result = new Map<string, AssetRecord[]>();
    for (const asset of assets) {
      const tool = asset.origin?.tool ?? owners[asset.id] ?? "source";
      if (!result.has(tool)) result.set(tool, []);
      result.get(tool)!.push(asset);
    }
    return [...result.entries()].sort(([left], [right]) => {
      if (left === "source") return 1;
      if (right === "source") return -1;
      return left.localeCompare(right);
    });
  }, [assets, owners]);

  const galleryAssets = galleryTool
    ? (groups.find(([tool]) => tool === galleryTool)?.[1] ?? [])
    : [];
  const galleryItems: PreviewGalleryItem[] = galleryAssets
    .filter((asset) => thumbs[asset.id])
    .map((asset) => ({ title: asset.name, src: thumbs[asset.id] }));

  const toggle = (id: AssetId) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const closeActions = () => {
    setActionsOpen(false);
    setConfirmDelete(false);
  };

  const copyAssets = async (ids: AssetId[]) => {
    if (ids.length === 0) return;
    try {
      await move(ids, projectId, "copy");
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      setError("");
      closeActions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not copy those assets.");
    }
  };

  const runDelete = async () => {
    if (selected.length === 0) return;
    try {
      await removeMany(selected);
      setSelected([]);
      setError("");
      closeActions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete those assets.");
    }
  };

  const galleryToolId = galleryTool && galleryTool !== "source" ? (galleryTool as ToolId) : null;

  return (
    <section className="project-assets">
      <div className="project-assets-head">
        <h2>Project assets</h2>
        <div className="project-assets-tools">
          <div className="project-assets-actions" ref={actionsRef}>
            <ToolHeaderButton
              aria-label="Asset actions"
              aria-expanded={actionsOpen}
              aria-haspopup="menu"
              disabled={selected.length === 0}
              onClick={() => {
                setConfirmDelete(false);
                setActionsOpen((open) => !open);
              }}
            >
              Actions
              <span className="project-assets-selected-count">{selected.length}</span>
              <ChevronDown size={12} aria-hidden="true" />
            </ToolHeaderButton>
            {actionsOpen ? (
              <div className="project-assets-actions-menu" role="menu">
                {confirmDelete ? (
                  <>
                    <p className="project-assets-actions-confirm">
                      Delete {selected.length} {selected.length === 1 ? "asset" : "assets"}?
                    </p>
                    <div className="project-assets-actions-row">
                      <button type="button" role="menuitem" onClick={() => setConfirmDelete(false)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="project-assets-actions-danger"
                        onClick={() => void runDelete()}
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" role="menuitem" onClick={() => void copyAssets(selected)}>
                      <Copy size={12} aria-hidden="true" />
                      Copy
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="project-assets-actions-danger"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
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

      <p className="project-assets-hint">
        These files are shared by every tool in this project. Select assets to copy or delete them
        with Actions, or add a new file to import it here.
      </p>

      {error ? <p className="project-assets-error">{error}</p> : null}

      {assets.length === 0 ? (
        <p className="project-assets-empty">
          No assets yet. Add an image to share it across tools.
        </p>
      ) : (
        groups.map(([tool, groupAssets]) => (
          <section className="project-assets-group" key={tool}>
            <div className="project-assets-group-head">
              <h3>{TOOL_LABELS[tool] ?? tool}</h3>
              <span>{groupAssets.length}</span>
            </div>
            <div className="project-assets-grid">
              {groupAssets.map((asset) => {
                const previewable = groupAssets.filter((item) => thumbs[item.id]);
                const position = previewable.findIndex((item) => item.id === asset.id);
                const sourceId = asset.origin?.derivedFrom ?? sources[asset.id];
                const source = sourceId ? assetById.get(sourceId as AssetId) : undefined;
                return (
                  <article
                    className={`project-assets-card${selected.includes(asset.id) ? " project-assets-card-selected" : ""}`}
                    key={asset.id}
                  >
                    <div className="project-assets-preview-wrap">
                      <button
                        type="button"
                        className="project-assets-preview"
                        aria-label={`Preview ${asset.name}`}
                        disabled={position < 0}
                        onClick={() => {
                          setGalleryTool(tool);
                          setGalleryIndex(Math.max(0, position));
                        }}
                      >
                        {thumbs[asset.id] ? (
                          <img src={thumbs[asset.id]} alt="" />
                        ) : (
                          <span>{asset.mime.split("/").at(-1)?.slice(0, 4)}</span>
                        )}
                      </button>
                      <div className="project-assets-card-controls">
                        <button
                          type="button"
                          aria-label={`Controls for ${asset.name}`}
                          aria-expanded={cardMenuId === asset.id}
                          onClick={() =>
                            setCardMenuId((current) => (current === asset.id ? null : asset.id))
                          }
                        >
                          <Ellipsis size={14} aria-hidden="true" />
                        </button>
                        {cardMenuId === asset.id ? (
                          <div className="project-assets-card-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                toggle(asset.id);
                                setCardMenuId(null);
                              }}
                            >
                              {selected.includes(asset.id) ? "Deselect" : "Select"}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                void copyAssets([asset.id]);
                                setCardMenuId(null);
                              }}
                            >
                              <Copy size={12} aria-hidden="true" />
                              Copy
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="project-assets-actions-danger"
                              onClick={() => {
                                void remove(asset.id).catch((cause: unknown) =>
                                  setError(String(cause)),
                                );
                                setCardMenuId(null);
                              }}
                            >
                              <Trash2 size={12} aria-hidden="true" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="project-assets-card-meta">
                      <Checkbox
                        aria-label={`Select ${asset.name}`}
                        checked={selected.includes(asset.id)}
                        onChange={() => toggle(asset.id)}
                      />
                      <div className="project-assets-card-info">
                        <strong title={asset.name}>{asset.name}</strong>
                        <span>{Math.round(asset.bytes / 1024)} KB</span>
                        {sourceId ? (
                          <span
                            className={
                              source ? "project-assets-source" : "project-assets-source-missing"
                            }
                            title={source ? source.name : "Starting asset was deleted"}
                          >
                            {source ? `from ${source.name}` : "Source deleted"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      {galleryTool ? (
        <PreviewGalleryDialog
          items={galleryItems}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryTool(null)}
          actionLabel={galleryToolId ? `Open in ${TOOL_LABELS[galleryToolId]}` : undefined}
          onAction={() => {
            if (galleryToolId) {
              void navigate({
                to: "/projects/$projectId/$tool",
                params: { projectId, tool: galleryToolId },
              });
            }
          }}
        />
      ) : null}
    </section>
  );
}
