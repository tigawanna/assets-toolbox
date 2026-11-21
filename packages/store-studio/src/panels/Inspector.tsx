import { getPreset } from "@tigawanna/play-screenshots/sizes";

import { Panel } from "./Panel";
import { useProject } from "../data-access-layer/useProject";
import { cropPercentages, fitScreen } from "../model/geometry";
import type { ColorRef, Node, StudioProject } from "../model/schema";
import { DEVICE_MODEL_IDS } from "../devices/catalog";
import { useHistory } from "../session/history";
import { useSelection } from "../session/selection";
import { useView } from "../session/view";

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function currentToken(node: Node): string {
  let color: ColorRef | undefined;
  if (node.type === "shape") {
    if (node.fill.type === "solid") color = node.fill.color;
  } else if ("color" in node && node.color !== undefined) {
    color = node.color;
  }
  return color === undefined || typeof color === "string" ? "" : color.token;
}

function mutateSelected(id: string, fn: (node: Node) => void): void {
  useHistory.getState().commit((draft: StudioProject) => {
    const node = draft.boards
      .flatMap((board) => board.nodes)
      .find((candidate) => candidate.id === id);
    if (node !== undefined) fn(node);
  });
}

export function Inspector() {
  const project = useProject();
  const { ids } = useSelection();
  const { activeBoardId, activeSlice } = useView();
  const board =
    project.boards.find((candidate) => candidate.id === activeBoardId) ?? project.boards[0];
  const node = board?.nodes.find((candidate) => candidate.id === ids[0]);

  return (
    <Panel id="inspector" title="Inspector" className="inspector">
      {node === undefined ? <p className="hint">Select a node to edit it.</p> : null}
      {node !== undefined ? (
        <div className="inspector-body">
          <div className="field-row">
            <input
              aria-label="Node name"
              value={node.name}
              onChange={(event) =>
                mutateSelected(node.id, (item) => {
                  item.name = event.target.value;
                })
              }
            />
            <span className="badge">{node.type}</span>
          </div>

          <h4>Transform</h4>
          <div className="field-grid">
            <NumberField
              label="X"
              value={Math.round(node.x)}
              onChange={(value) =>
                mutateSelected(node.id, (item) => {
                  item.x = value;
                })
              }
            />
            <NumberField
              label="Y"
              value={Math.round(node.y)}
              onChange={(value) =>
                mutateSelected(node.id, (item) => {
                  item.y = value;
                })
              }
            />
            <NumberField
              label="W"
              value={Math.round(node.width)}
              onChange={(value) =>
                mutateSelected(node.id, (item) => {
                  item.width = Math.max(1, value);
                })
              }
            />
            <NumberField
              label="H"
              value={Math.round(node.height)}
              onChange={(value) =>
                mutateSelected(node.id, (item) => {
                  item.height = Math.max(1, value);
                })
              }
            />
            <NumberField
              label="Rotate"
              value={Math.round(node.rotation)}
              onChange={(value) =>
                mutateSelected(node.id, (item) => {
                  item.rotation = value;
                })
              }
            />
            <NumberField
              label="Opacity"
              value={node.opacity}
              step={0.05}
              onChange={(value) =>
                mutateSelected(node.id, (item) => {
                  item.opacity = Math.min(1, Math.max(0, value));
                })
              }
            />
          </div>

          {node.type === "device" ? (
            <>
              <h4>Device</h4>
              <label className="field">
                <span>Model</span>
                <select
                  value={node.model}
                  onChange={(event) =>
                    mutateSelected(node.id, (item) => {
                      if (item.type === "device")
                        item.model = event.target.value as typeof item.model;
                    })
                  }
                >
                  {DEVICE_MODEL_IDS.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Finish</span>
                <select
                  value={node.color}
                  onChange={(event) =>
                    mutateSelected(node.id, (item) => {
                      if (item.type === "device")
                        item.color = event.target.value as typeof item.color;
                    })
                  }
                >
                  <option value="black">Black</option>
                  <option value="white">White</option>
                  <option value="silver">Silver</option>
                </select>
              </label>
              <label className="field">
                <span>Status bar</span>
                <select
                  value={node.statusBar}
                  onChange={(event) =>
                    mutateSelected(node.id, (item) => {
                      if (item.type === "device")
                        item.statusBar = event.target.value as typeof item.statusBar;
                    })
                  }
                >
                  <option value="hidden">Hidden</option>
                  <option value="clean">Clean (drawn)</option>
                </select>
              </label>
              <h4>Screen</h4>
              <label className="field">
                <span>Fit</span>
                <select
                  value={node.content.fit}
                  onChange={(event) =>
                    mutateSelected(node.id, (item) => {
                      if (item.type === "device")
                        item.content.fit = event.target.value as typeof item.content.fit;
                    })
                  }
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="fill">Fill</option>
                </select>
              </label>
              <div className="field-grid">
                <NumberField
                  label="Zoom"
                  value={node.content.zoom}
                  step={0.05}
                  onChange={(value) =>
                    mutateSelected(node.id, (item) => {
                      if (item.type === "device") item.content.zoom = Math.max(0.1, value);
                    })
                  }
                />
                <NumberField
                  label="Offset X"
                  value={node.content.offset.x}
                  step={0.05}
                  onChange={(value) =>
                    mutateSelected(node.id, (item) => {
                      if (item.type === "device") item.content.offset.x = value;
                    })
                  }
                />
                <NumberField
                  label="Offset Y"
                  value={node.content.offset.y}
                  step={0.05}
                  onChange={(value) =>
                    mutateSelected(node.id, (item) => {
                      if (item.type === "device") item.content.offset.y = value;
                    })
                  }
                />
              </div>
              <h4>Trim (source px)</h4>
              <div className="field-grid">
                {(["top", "bottom", "left", "right"] as const).map((edge) => (
                  <NumberField
                    key={edge}
                    label={edge}
                    value={node.content.trim[edge]}
                    onChange={(value) =>
                      mutateSelected(node.id, (item) => {
                        if (item.type === "device") item.content.trim[edge] = Math.max(0, value);
                      })
                    }
                  />
                ))}
              </div>
              {(() => {
                const asset = project.assets[node.content.assetId];
                if (asset === undefined) return <p className="hint">No capture pinned.</p>;
                const fit = fitScreen(
                  asset.width,
                  asset.height,
                  node.content.trim,
                  { x: 0, y: 0, width: node.width * 0.88, height: node.height * 0.9 },
                  node.content.fit,
                  node.content.zoom,
                  node.content.offset,
                );
                const crop = cropPercentages(fit);
                return (
                  <p className="crop-readout">
                    Cropping {Math.round(crop.top * 100)}% top, {Math.round(crop.bottom * 100)}%
                    bottom, {Math.round(crop.left * 100)}% left, {Math.round(crop.right * 100)}%
                    right
                  </p>
                );
              })()}
              <button
                type="button"
                onClick={() =>
                  mutateSelected(node.id, (item) => {
                    if (item.type === "device") item.content.fit = "contain";
                  })
                }
              >
                Contain
              </button>
              <button
                type="button"
                onClick={() =>
                  mutateSelected(node.id, (item) => {
                    if (item.type === "device") {
                      item.screenAspect = "match";
                      item.content.fit = "cover";
                    }
                  })
                }
              >
                Match capture
              </button>
            </>
          ) : null}

          {node.type === "text" ? (
            <>
              <h4>Text</h4>
              <textarea
                aria-label="Text content"
                value={node.text}
                onChange={(event) =>
                  mutateSelected(node.id, (item) => {
                    if (item.type === "text") item.text = event.target.value;
                  })
                }
              />
              <label className="field">
                <span>Color token</span>
                <select
                  value={typeof node.color === "string" ? "" : node.color.token}
                  onChange={(event) =>
                    mutateSelected(node.id, (item) => {
                      if (item.type === "text")
                        item.color =
                          event.target.value === "" ? "#ffffff" : { token: event.target.value };
                    })
                  }
                >
                  <option value="">Custom</option>
                  {Object.keys(project.theme.tokens).map((token) => (
                    <option key={token} value={token}>
                      {token}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label="Font size"
                value={node.font.size}
                onChange={(value) =>
                  mutateSelected(node.id, (item) => {
                    if (item.type === "text")
                      item.font = { ...item.font, size: Math.max(1, value) };
                  })
                }
              />
            </>
          ) : null}

          {node.type === "glow" || node.type === "fade" || node.type === "shape" ? (
            <label className="field">
              <span>Color token</span>
              <select
                value={currentToken(node)}
                onChange={(event) =>
                  mutateSelected(node.id, (item) => {
                    const ref =
                      event.target.value === "" ? "#ffffff" : { token: event.target.value };
                    if ((item.type === "glow" || item.type === "fade") && item.color !== undefined)
                      item.color = ref;
                    if (item.type === "shape" && item.fill.type === "solid")
                      item.fill = { ...item.fill, color: ref };
                  })
                }
              >
                <option value="">Custom</option>
                {Object.keys(project.theme.tokens).map((token) => (
                  <option key={token} value={token}>
                    {token}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <h4>Theme tokens</h4>
      <div className="token-grid">
        {Object.entries(project.theme.tokens).map(([token, value]) => (
          <label key={token} className="token-field">
            <span>{token}</span>
            <input
              type="color"
              value={value}
              onChange={(event) => {
                const color = event.target.value;
                useHistory.getState().commit((draft) => {
                  draft.theme.tokens[token] = color;
                });
              }}
            />
          </label>
        ))}
      </div>

      {board !== undefined ? (
        <>
          <h4>Slice {activeSlice + 1}</h4>
          <input
            aria-label="Slice alt text"
            placeholder="Alt text (≤140 chars)"
            value={board.sliceMeta[activeSlice]?.alt ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              useHistory.getState().commit((draft) => {
                const target = draft.boards.find((candidate) => candidate.id === board.id);
                if (target?.sliceMeta[activeSlice] !== undefined)
                  target.sliceMeta[activeSlice]!.alt = value;
              });
            }}
          />
          <p className="hint">
            Board preset: {getPreset(board.preset).width}×{getPreset(board.preset).height}
          </p>
        </>
      ) : null}
    </Panel>
  );
}
