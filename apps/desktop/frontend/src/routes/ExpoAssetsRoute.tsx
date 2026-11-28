import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileArchive,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { EXPO_ASSET_DEFAULTS } from "@assets/expo-assets/types";

import { PreviewGalleryDialog, type PreviewGalleryItem } from "../components/PreviewGalleryDialog";
import { ColorField } from "../components/ColorField";
import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import { Checkbox } from "../components/ui/checkbox";
import { selectWebImage } from "../lib/asset-input";
import { getProjectClient } from "../lib/projects/client";
import { mergeDocumentDefaults, useProject, useProjectDocument } from "../lib/projects/context";
import type { AssetId } from "../lib/projects/types";
import {
  getAssetApp,
  hasAssetGeneration,
  type AssetInput,
  type AssetJobResult,
  type ExpoGenerateRequest,
} from "../lib/asset-generation";
import "./../modules/expo-assets/expo-assets.css";

type SourceRole = "icon" | "darkIcon" | "tintedIcon";

const SOURCES: Array<{ role: SourceRole; label: string; hint: string; optional: boolean }> = [
  { role: "icon", label: "Primary logo", hint: "Transparent SVG or PNG", optional: false },
  { role: "darkIcon", label: "Dark splash logo", hint: "Optional variant", optional: true },
  { role: "tintedIcon", label: "Tinted logo", hint: "Optional grayscale variant", optional: true },
];

function sourceActionLabel(selected: boolean, optional: boolean): string {
  if (selected) return "Change";
  return optional ? "Optional" : "Choose";
}

interface ExpoDocumentData {
  brandColor: string;
  splashBackground: string;
  imageWidth: number;
  foregroundSize: number;
  splashLogoSize: number;
  noMonochrome: boolean;
  writeConfig: boolean;
  outDir: string;
  sourceAssetIds: Record<string, string>;
}

const EXPO_DOCUMENT_DEFAULTS: ExpoDocumentData = {
  brandColor: EXPO_ASSET_DEFAULTS.brandColor,
  splashBackground: EXPO_ASSET_DEFAULTS.splashBackground,
  imageWidth: EXPO_ASSET_DEFAULTS.imageWidth,
  foregroundSize: EXPO_ASSET_DEFAULTS.foregroundSize,
  splashLogoSize: EXPO_ASSET_DEFAULTS.splashLogoSize,
  noMonochrome: false,
  writeConfig: true,
  outDir: EXPO_ASSET_DEFAULTS.outDir,
  sourceAssetIds: {},
};

function iconPreviewSize(foregroundSize: number): number {
  const value =
    Number.isFinite(foregroundSize) && foregroundSize > 0
      ? foregroundSize
      : EXPO_ASSET_DEFAULTS.foregroundSize;
  return Math.round(
    Math.min(224, Math.max(96, (value / EXPO_ASSET_DEFAULTS.foregroundSize) * 140)),
  );
}

function splashPreviewSize(logoSize: number): number {
  const value =
    Number.isFinite(logoSize) && logoSize > 0 ? logoSize : EXPO_ASSET_DEFAULTS.splashLogoSize;
  return Math.round(Math.min(180, Math.max(36, (value / EXPO_ASSET_DEFAULTS.splashLogoSize) * 92)));
}

export function ExpoAssetsRoute() {
  const [sources, setSources] = useState<Record<SourceRole, AssetInput | null>>({
    icon: null,
    darkIcon: null,
    tintedIcon: null,
  });
  const [brandColor, setBrandColor] = useState<string>(EXPO_ASSET_DEFAULTS.brandColor);
  const [splashBackground, setSplashBackground] = useState<string>(
    EXPO_ASSET_DEFAULTS.splashBackground,
  );
  const [imageWidth, setImageWidth] = useState<number>(EXPO_ASSET_DEFAULTS.imageWidth);
  const [foregroundSize, setForegroundSize] = useState<number>(EXPO_ASSET_DEFAULTS.foregroundSize);
  const [splashLogoSize, setSplashLogoSize] = useState<number>(EXPO_ASSET_DEFAULTS.splashLogoSize);
  const [noMonochrome, setNoMonochrome] = useState(false);
  const [writeConfig, setWriteConfig] = useState(true);
  const [outDir, setOutDir] = useState<string>(EXPO_ASSET_DEFAULTS.outDir);
  const [result, setResult] = useState<AssetJobResult | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [sourcePreviews, setSourcePreviews] = useState<Record<string, string>>({});
  const [sourceAssetIds, setSourceAssetIds] = useState<Partial<Record<SourceRole, AssetId>>>({});
  const { projectId } = useProject();
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const {
    data: expoDocument,
    update: updateExpoDocument,
    ready: expoReady,
  } = useProjectDocument<ExpoDocumentData>("expo", EXPO_DOCUMENT_DEFAULTS);
  const expoHydrated = useRef(false);

  useEffect(() => {
    if (!expoReady || expoHydrated.current) return;
    expoHydrated.current = true;
    const nested = (expoDocument as unknown as { form?: Partial<ExpoDocumentData> }).form;
    const form = mergeDocumentDefaults(EXPO_DOCUMENT_DEFAULTS, nested, expoDocument);
    setBrandColor(form.brandColor);
    setSplashBackground(form.splashBackground);
    setImageWidth(form.imageWidth);
    setForegroundSize(form.foregroundSize);
    setSplashLogoSize(form.splashLogoSize);
    setNoMonochrome(form.noMonochrome);
    setWriteConfig(form.writeConfig);
    setOutDir(form.outDir);

    const saved = { ...expoDocument.sourceAssetIds, ...form.sourceAssetIds };
    const restored: Partial<Record<SourceRole, AssetId>> = {};
    for (const role of ["icon", "darkIcon", "tintedIcon"] as const) {
      if (saved[role]) restored[role] = saved[role] as AssetId;
    }
    setSourceAssetIds(restored);
    void getProjectClient()
      .listAssets(projectId)
      .then(async (list) => {
        const nextSources: Record<SourceRole, AssetInput | null> = {
          icon: null,
          darkIcon: null,
          tintedIcon: null,
        };
        const nextPreviews: Record<string, string> = {};
        for (const role of ["icon", "darkIcon", "tintedIcon"] as const) {
          const id = restored[role];
          if (!id) continue;
          const asset = list.find((item) => item.id === id);
          if (!asset) continue;
          const base64 = await getProjectClient().getAssetBlob(projectId, asset.id);
          nextSources[role] = {
            handle: `project:${asset.id}`,
            name: asset.name,
            size: asset.bytes,
            mimeType: asset.mime,
          };
          nextPreviews[role] = `data:${asset.mime};base64,${base64}`;
        }
        setSources(nextSources);
        setSourcePreviews(nextPreviews);
      })
      .catch(() => {
        // Missing source assets leave the pickers empty.
      });
  }, [expoDocument, expoReady, projectId]);

  useEffect(() => {
    if (!expoHydrated.current) return;
    updateExpoDocument({
      brandColor,
      splashBackground,
      imageWidth,
      foregroundSize,
      splashLogoSize,
      noMonochrome,
      writeConfig,
      outDir,
      sourceAssetIds: sourceAssetIds as Record<string, string>,
    });
  }, [
    brandColor,
    foregroundSize,
    imageWidth,
    noMonochrome,
    outDir,
    splashBackground,
    splashLogoSize,
    updateExpoDocument,
    writeConfig,
    sourceAssetIds,
  ]);

  const native = hasAssetGeneration();
  const galleryItems: PreviewGalleryItem[] = result
    ? result.artifacts
        .filter((artifact) => previews[artifact.name]?.startsWith("data:"))
        .map((artifact) => ({ title: artifact.name, src: previews[artifact.name] }))
    : [];

  useEffect(() => {
    return () => {
      if (!result) return;
      void getAssetApp()?.DiscardAssetJob(result.jobId);
    };
  }, [result]);

  useEffect(() => {
    if (!result) {
      setPreviews({});
      return;
    }
    let active = true;
    const app = getAssetApp();
    if (!app) return;
    void Promise.all(
      result.artifacts.map(async (artifact) => {
        if (!artifact.name.endsWith(".png") && !artifact.name.endsWith(".json")) return;
        try {
          const encoded = await app.GetAssetArtifact(result.jobId, artifact.name);
          if (active) {
            setPreviews((current) => ({
              ...current,
              [artifact.name]: artifact.name.endsWith(".png")
                ? `data:image/png;base64,${encoded}`
                : new TextDecoder().decode(
                    Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
                  ),
            }));
          }
        } catch {
          // A failed preview does not invalidate the generated file.
        }
      }),
    );
    return () => {
      active = false;
    };
  }, [result]);

  useEffect(() => {
    if (copied === "") return;
    const timer = window.setTimeout(() => setCopied(""), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const chooseSource = useCallback(
    async (role: SourceRole) => {
      setError("");
      const app = getAssetApp();
      if (!app) {
        try {
          const selection = await selectWebImage();
          if (!selection) return;
          setSources((current) => ({ ...current, [role]: selection.input }));
          setSourcePreviews((current) => ({ ...current, [role]: selection.preview }));
          const asset = await getProjectClient().addAsset(projectId, {
            name: selection.input.name,
            mime: selection.input.mimeType,
            base64: selection.preview.split(",").at(-1) ?? "",
          });
          setSourceAssetIds((current) => ({ ...current, [role]: asset.id as AssetId }));
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Could not preview that image.");
        }
        return;
      }
      try {
        const selected = await app.SelectAssetImage(role);
        setSources((current) => ({ ...current, [role]: selected }));
        const encoded = await app.GetAssetInputPreview(selected.handle);
        setSourcePreviews((current) => ({
          ...current,
          [role]: `data:${selected.mimeType || "image/png"};base64,${encoded}`,
        }));
        const asset = await getProjectClient().addAsset(projectId, {
          name: selected.name,
          mime: selected.mimeType || "image/png",
          base64: encoded,
        });
        setSourceAssetIds((current) => ({ ...current, [role]: asset.id as AssetId }));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not select an image.");
      }
    },
    [projectId],
  );

  const generate = useCallback(async () => {
    const app = getAssetApp();
    if (!app || !sources.icon) return;
    if (result) void app.DiscardAssetJob(result.jobId);
    setBusy(true);
    setError("");
    setResult(null);
    setCopied("");

    const handles: Partial<Record<SourceRole, string>> = {};
    if (app.StageProjectAsset) {
      try {
        for (const role of ["icon", "darkIcon", "tintedIcon"] as const) {
          const id = sourceAssetIds[role];
          if (id) handles[role] = (await app.StageProjectAsset(projectId, id, role)).handle;
        }
      } catch {
        setError("Could not restore the selected source assets.");
        setBusy(false);
        return;
      }
    }

    const request: ExpoGenerateRequest = {
      icon: handles.icon ?? sources.icon.handle,
      darkIcon: handles.darkIcon ?? sources.darkIcon?.handle,
      tintedIcon: handles.tintedIcon ?? sources.tintedIcon?.handle,
      brandColor,
      splashBackground,
      imageWidth: Number(imageWidth),
      foregroundSize: Number(foregroundSize),
      splashLogoSize: Number(splashLogoSize),
      noMonochrome,
      writeConfig,
      outDir,
    };

    try {
      setResult(await app.GenerateExpoAssets(request));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate Expo assets.");
    } finally {
      setBusy(false);
    }
  }, [
    brandColor,
    foregroundSize,
    imageWidth,
    noMonochrome,
    outDir,
    result,
    sources,
    splashBackground,
    splashLogoSize,
    writeConfig,
    sourceAssetIds,
    projectId,
  ]);

  const saveOne = useCallback(
    async (name: string) => {
      if (!result) return;
      try {
        await getAssetApp()?.SaveAssetArtifact(result.jobId, name);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save the asset.");
      }
    },
    [result],
  );

  const copyConfig = useCallback(async () => {
    if (!result?.configPath) return;
    try {
      await getAssetApp()?.CopyAssetText(result.jobId, result.configPath.split("/").at(-1) ?? "");
      setCopied("config");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not copy the config.");
    }
  }, [result]);

  const copyPrompt = useCallback(async () => {
    if (!result?.agentPrompt) return;
    try {
      await navigator.clipboard.writeText(result.agentPrompt);
      setCopied("prompt");
    } catch {
      setError("Clipboard access was blocked.");
    }
  }, [result]);

  const resetDefaults = useCallback(() => {
    setBrandColor(EXPO_DOCUMENT_DEFAULTS.brandColor);
    setSplashBackground(EXPO_DOCUMENT_DEFAULTS.splashBackground);
    setImageWidth(EXPO_DOCUMENT_DEFAULTS.imageWidth);
    setForegroundSize(EXPO_DOCUMENT_DEFAULTS.foregroundSize);
    setSplashLogoSize(EXPO_DOCUMENT_DEFAULTS.splashLogoSize);
    setNoMonochrome(EXPO_DOCUMENT_DEFAULTS.noMonochrome);
    setWriteConfig(EXPO_DOCUMENT_DEFAULTS.writeConfig);
    setOutDir(EXPO_DOCUMENT_DEFAULTS.outDir);
    setSources({ icon: null, darkIcon: null, tintedIcon: null });
    setSourcePreviews({});
    setSourceAssetIds({});
    setResult(null);
    setPreviews({});
    setError("");
    updateExpoDocument({ ...EXPO_DOCUMENT_DEFAULTS, sourceAssetIds: {} });
  }, [updateExpoDocument]);

  return (
    <section className="expo-page">
      <ToolHeader
        icon={<PackageIcon name="device" size={17} />}
        title="Expo Assets"
        meta={native ? "native generator ready" : "browser preview"}
        actions={
          <>
            {result ? (
              <ToolHeaderButton onClick={() => void saveAll()}>
                <FileArchive size={13} aria-hidden="true" />
                Save all
              </ToolHeaderButton>
            ) : null}
            <ToolHeaderButton onClick={resetDefaults} title="Reset all fields to defaults">
              <RotateCcw size={13} aria-hidden="true" />
              Reset
            </ToolHeaderButton>
            <ToolHeaderButton
              variant="primary"
              data-tour="generate"
              disabled={!native || busy || !sources.icon}
              onClick={() => void generate()}
            >
              {busy ? <LoaderCircle className="expo-spin" size={13} /> : <Download size={13} />}
              Generate
            </ToolHeaderButton>
          </>
        }
      />

      <div
        className={
          sourcePreviews.icon || result ? "expo-layout" : "expo-layout expo-layout-form-only"
        }
      >
        <div className="expo-column">
          <div className="expo-panel">
            <h2>Source artwork</h2>
            <div className="expo-sources">
              {SOURCES.map((source) => {
                const selected = sources[source.role];
                return (
                  <div className="expo-source" key={source.role}>
                    <div className="expo-source-main">
                      {sourcePreviews[source.role] ? (
                        <span className="expo-source-preview">
                          <img src={sourcePreviews[source.role]} alt="" />
                        </span>
                      ) : (
                        <span className="expo-source-placeholder" aria-hidden="true">
                          <FolderOpen size={16} />
                        </span>
                      )}
                      <div className="expo-source-copy">
                        <strong>{source.label}</strong>
                        <span>
                          {selected
                            ? `${selected.name} · ${Math.round(selected.size / 1024)} KB`
                            : source.hint}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      data-tour={source.optional ? "optional-logos" : "change-source"}
                      onClick={() => void chooseSource(source.role)}
                    >
                      {selected ? <Check size={14} /> : <FolderOpen size={14} />}
                      {sourceActionLabel(Boolean(selected), source.optional)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="expo-panel">
            <h2>Colors</h2>
            <div className="expo-field-grid">
              <ColorField label="Brand color" value={brandColor} onChange={setBrandColor} />
              <ColorField
                label="Splash background"
                value={splashBackground}
                onChange={setSplashBackground}
              />
            </div>
            <label className="expo-inline-field">
              <span>Output folder</span>
              <input value={outDir} onChange={(event) => setOutDir(event.target.value)} />
            </label>
          </div>

          <div className="expo-panel">
            <h2>Sizing</h2>
            <div className="expo-field-grid">
              <label>
                <span>Splash image width</span>
                <input
                  type="number"
                  min={1}
                  value={imageWidth}
                  onChange={(event) => setImageWidth(Number(event.target.value))}
                />
              </label>
              <label>
                <span>Adaptive foreground</span>
                <input
                  type="number"
                  min={1}
                  value={foregroundSize}
                  onChange={(event) => setForegroundSize(Number(event.target.value))}
                />
              </label>
              <label>
                <span>Splash logo size</span>
                <input
                  type="number"
                  min={1}
                  value={splashLogoSize}
                  onChange={(event) => setSplashLogoSize(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="expo-options">
              <label>
                <Checkbox
                  checked={noMonochrome}
                  onChange={(event) => setNoMonochrome(event.target.checked)}
                />
                Skip monochrome icon
              </label>
              <label>
                <Checkbox
                  checked={writeConfig}
                  onChange={(event) => setWriteConfig(event.target.checked)}
                />
                Write config fragment
              </label>
            </div>
          </div>

          <div className="expo-panel">
            <h2>Output files</h2>
            <ul className="expo-output-list">
              {[
                ["icon.png", "1024×1024"],
                ["adaptive-icon.png", "1024×1024"],
                ["android-icon-background.png", "1024×1024"],
                ...(noMonochrome ? [] : [["android-icon-monochrome.png", "1024×1024"]]),
                ["splash-icon.png", "1024×1024"],
                ["favicon.png", "48×48"],
                ["notification-icon.png", "96×96"],
                ...(writeConfig ? [["expo-assets.config.json", "config"]] : []),
              ].map(([name, size]) => (
                <li key={name}>
                  <span>{name}</span>
                  <span>{size}</span>
                </li>
              ))}
            </ul>
          </div>

          {error ? (
            <p className="expo-error">
              <TriangleAlert size={14} />
              {error}
            </p>
          ) : null}
        </div>

        <div className="expo-column">
          {sourcePreviews.icon ? (
            <div className="expo-panel expo-preview-panel">
              <h2>Preview</h2>
              <div className="expo-preview-grid">
                <article className="expo-preview-card">
                  <span className="expo-preview-label">App icon</span>
                  <div
                    className="expo-icon-preview"
                    style={{
                      backgroundColor: brandColor,
                      width: iconPreviewSize(foregroundSize),
                      height: iconPreviewSize(foregroundSize),
                    }}
                  >
                    <img src={sourcePreviews.icon} alt="App icon preview" />
                  </div>
                  <span className="expo-preview-meta">
                    1024×1024 · {foregroundSize}px foreground · {brandColor}
                  </span>
                </article>
                <article className="expo-preview-card">
                  <span className="expo-preview-label">Splash screen</span>
                  <div className="expo-phone-preview" style={{ backgroundColor: splashBackground }}>
                    <span className="expo-phone-notch" aria-hidden="true" />
                    <img
                      src={sourcePreviews.icon}
                      alt="Splash screen preview"
                      style={{ width: splashPreviewSize(splashLogoSize) }}
                    />
                  </div>
                  <span className="expo-preview-meta">
                    {splashBackground} · {splashLogoSize}px logo
                  </span>
                </article>
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="expo-panel expo-results">
              <div className="expo-results-head">
                <h2>Generated assets</h2>
                <button type="button" onClick={() => void saveAll()}>
                  <FileArchive size={14} />
                  Save all
                </button>
              </div>
              <>
                <div className="expo-score">
                  <strong>{result.artifacts.length}</strong>
                  <span>files · {result.agentPrompt ? "config ready" : "no config"}</span>
                </div>
                <div className="expo-asset-list">
                  {result.artifacts.map((artifact) => {
                    const galleryPosition = galleryItems.findIndex(
                      (item) => item.title === artifact.name,
                    );
                    const preview = previews[artifact.name];
                    return (
                      <article className="expo-asset-row" key={artifact.name}>
                        <button
                          type="button"
                          className="expo-asset-preview"
                          aria-label={`Preview ${artifact.name}`}
                          disabled={!preview?.startsWith("data:")}
                          onClick={() => {
                            setGalleryIndex(Math.max(0, galleryPosition));
                            setGalleryOpen(true);
                          }}
                        >
                          {preview?.startsWith("data:") ? (
                            <img src={preview} alt="" />
                          ) : (
                            <span>{artifact.name.split(".").at(-1)?.toUpperCase()}</span>
                          )}
                        </button>
                        <div className="expo-asset-meta">
                          <strong>{artifact.name}</strong>
                          <span>
                            {artifact.width ? `${artifact.width}×${artifact.height} · ` : ""}
                            {Math.round(artifact.bytes / 1024)} KB
                          </span>
                        </div>
                        <button
                          className="expo-asset-save"
                          type="button"
                          onClick={() => void saveOne(artifact.name)}
                        >
                          <Download size={13} />
                          Save
                        </button>
                      </article>
                    );
                  })}
                </div>
                {result.agentPrompt ? (
                  <div className="expo-agent">
                    <div>
                      <h3>Agent handoff</h3>
                      <button type="button" onClick={() => void copyPrompt()}>
                        {copied === "prompt" ? "Copied" : "Copy prompt"}
                      </button>
                    </div>
                    <p>{result.agentPrompt}</p>
                  </div>
                ) : null}
                {result.configPath ? (
                  <button
                    className="expo-copy-config"
                    type="button"
                    onClick={() => void copyConfig()}
                  >
                    {copied === "config" ? "Config copied" : "Copy app.json config"}
                  </button>
                ) : null}
              </>
            </div>
          ) : null}
        </div>
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

  async function saveAll() {
    if (!result) return;
    try {
      await getAssetApp()?.SaveAssetSet(result.jobId, "expo-assets.zip");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the asset set.");
    }
  }
}
