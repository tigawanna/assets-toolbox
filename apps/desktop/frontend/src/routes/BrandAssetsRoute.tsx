import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileArchive,
  FolderOpen,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { defaultIconSizes } from "@assets/brand-assets/types";

import { AssetPreviewDialog } from "../components/AssetPreviewDialog";
import { ColorField } from "../components/ColorField";
import {
  createOgLayers,
  OgVisualEditor,
  renderOgLayers,
  type OgDesignResult,
  type OgEditorDraft,
} from "../components/OgVisualEditor";
import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import { selectWebImage } from "../lib/asset-input";
import { getProjectClient } from "../lib/projects/client";
import { mergeDocumentDefaults, useProject, useProjectDocument } from "../lib/projects/context";
import type { AssetId } from "../lib/projects/types";
import {
  getAssetApp,
  hasAssetGeneration,
  type AssetInput,
  type AssetJobResult,
  type BrandGenerateRequest,
} from "../lib/asset-generation";
import "./../modules/brand-assets/brand-assets.css";

function previewMime(extension: string | undefined): string {
  if (extension === "png") return "image/png";
  if (extension === "ico") return "image/x-icon";
  return "text/plain";
}

const ICON_SUMMARY = Object.entries({
  ...defaultIconSizes.transparent,
  ...Object.fromEntries(
    Object.entries(defaultIconSizes.plated).map(([name, [size]]) => [name, size]),
  ),
})
  .map(([name, size]) => `${name.replace(".png", "")} · ${size}px`)
  .join("  ·  ");

interface BrandDocumentData {
  plate: string;
  copySvg: boolean;
  ogEnabled: boolean;
  ogTitle: string;
  ogDescription: string;
  ogSiteLabel: string;
  ogWidth: number;
  ogHeight: number;
  manifestEnabled: boolean;
  name: string;
  shortName: string;
  themeColor: string;
  backgroundColor: string;
  startUrl: string;
  display: string;
  outDir: string;
  ogDraft: OgEditorDraft | null;
  sourceAssetId: string;
  initialized: boolean;
}

const BRAND_DEFAULTS: BrandDocumentData = {
  plate: "#0f100f",
  copySvg: false,
  ogEnabled: true,
  ogTitle: "",
  ogDescription: "",
  ogSiteLabel: "",
  ogWidth: 1200,
  ogHeight: 630,
  manifestEnabled: true,
  name: "App",
  shortName: "",
  themeColor: "#0f100f",
  backgroundColor: "#0f100f",
  startUrl: "/",
  display: "standalone",
  outDir: "out",
  ogDraft: null,
  sourceAssetId: "",
  initialized: false,
};

export function BrandAssetsRoute() {
  const { project, projectId } = useProject();
  const [icon, setIcon] = useState<AssetInput | null>(null);
  const [sourceAssetId, setSourceAssetId] = useState<AssetId | null>(null);
  const [plate, setPlate] = useState("#0f100f");
  const [copySvg, setCopySvg] = useState(false);
  const [ogEnabled, setOgEnabled] = useState(true);
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogSiteLabel, setOgSiteLabel] = useState("");
  const [ogEditorOpen, setOgEditorOpen] = useState(false);
  const [ogDesign, setOgDesign] = useState<OgDesignResult | null>(null);
  const [ogPreview, setOgPreview] = useState("");
  const [ogWidth, setOgWidth] = useState(1200);
  const [ogHeight, setOgHeight] = useState(630);
  const [manifestEnabled, setManifestEnabled] = useState(true);
  const [name, setName] = useState("App");
  const [shortName, setShortName] = useState("");
  const [themeColor, setThemeColor] = useState("#0f100f");
  const [backgroundColor, setBackgroundColor] = useState("#0f100f");
  const [startUrl, setStartUrl] = useState("/");
  const [display, setDisplay] = useState("standalone");
  const [outDir, setOutDir] = useState("out");
  const [result, setResult] = useState<AssetJobResult | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [sourcePreview, setSourcePreview] = useState("");
  const [expanded, setExpanded] = useState<{ title: string; src: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const {
    data: brandDocument,
    update: updateBrandDocument,
    ready: brandReady,
  } = useProjectDocument<BrandDocumentData>("brand", BRAND_DEFAULTS);
  const brandHydrated = useRef(false);
  const ogDraftRef = useRef(brandDocument.ogDraft);
  ogDraftRef.current = brandDocument.ogDraft;

  useEffect(() => {
    if (!brandReady || brandHydrated.current) return;
    brandHydrated.current = true;
    const nested = (brandDocument as unknown as { form?: Partial<BrandDocumentData> }).form;
    const form = mergeDocumentDefaults(BRAND_DEFAULTS, nested, brandDocument);
    setPlate(form.plate);
    setCopySvg(form.copySvg);
    setOgEnabled(form.ogEnabled);
    setOgTitle(form.ogTitle);
    setOgDescription(form.ogDescription);
    setOgSiteLabel(form.ogSiteLabel);
    setOgWidth(form.ogWidth);
    setOgHeight(form.ogHeight);
    setManifestEnabled(form.manifestEnabled);
    setName(form.name);
    setShortName(form.shortName);
    setThemeColor(form.themeColor);
    setBackgroundColor(form.backgroundColor);
    setStartUrl(form.startUrl);
    setDisplay(form.display);
    setOutDir(form.outDir);

    const savedSource = form.sourceAssetId || brandDocument.sourceAssetId;
    setSourceAssetId(savedSource ? (savedSource as AssetId) : null);
    if (savedSource) {
      void getProjectClient()
        .listAssets(projectId)
        .then(async (list) => {
          const asset = list.find((item) => item.id === savedSource);
          if (!asset) return;
          const base64 = await getProjectClient().getAssetBlob(projectId, asset.id);
          setSourcePreview(`data:${asset.mime};base64,${base64}`);
          setIcon({
            handle: `project:${asset.id}`,
            name: asset.name,
            size: asset.bytes,
            mimeType: asset.mime,
          });
        })
        .catch(() => {
          // A deleted source simply leaves the picker empty.
        });
    }
    if (!brandDocument.initialized && !nested && project?.name) {
      setOgTitle(project.name);
      setName(project.name);
    }
  }, [brandDocument, brandReady, project?.name, projectId]);

  useEffect(() => {
    if (!brandHydrated.current) return;
    updateBrandDocument({
      plate,
      copySvg,
      ogEnabled,
      ogTitle,
      ogDescription,
      ogSiteLabel,
      ogWidth,
      ogHeight,
      manifestEnabled,
      name,
      shortName,
      themeColor,
      backgroundColor,
      startUrl,
      display,
      outDir,
      ogDraft: ogDraftRef.current,
      sourceAssetId: sourceAssetId ?? "",
      initialized: true,
    });
  }, [
    backgroundColor,
    copySvg,
    display,
    manifestEnabled,
    name,
    ogDescription,
    ogEnabled,
    ogHeight,
    ogSiteLabel,
    ogTitle,
    ogWidth,
    outDir,
    plate,
    shortName,
    startUrl,
    themeColor,
    updateBrandDocument,
    sourceAssetId,
  ]);

  useEffect(() => {
    let active = true;
    const width = Number(ogWidth);
    const height = Number(ogHeight);
    const timer = window.setTimeout(() => {
      const layers =
        brandDocument.ogDraft?.layers ??
        createOgLayers(
          {
            title: ogTitle,
            description: ogDescription,
            siteLabel: ogSiteLabel,
            imageUrl: sourcePreview || undefined,
          },
          width,
          height,
        );
      void renderOgLayers(layers, width, height)
        .then((dataUrl) => {
          if (active) setOgPreview(dataUrl);
        })
        .catch(() => {
          // A preview failure does not prevent editing or generating.
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    brandDocument.ogDraft,
    ogDescription,
    ogHeight,
    ogSiteLabel,
    ogTitle,
    ogWidth,
    sourcePreview,
  ]);

  const native = hasAssetGeneration();

  useEffect(() => {
    return () => {
      if (result) void getAssetApp()?.DiscardAssetJob(result.jobId);
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
        const extension = artifact.name.split(".").at(-1);
        if (!["png", "ico", "webmanifest", "json"].includes(extension ?? "")) return;
        try {
          const encoded = await app.GetAssetArtifact(result.jobId, artifact.name);
          if (!active) return;
          const mime = previewMime(extension);
          setPreviews((current) => ({
            ...current,
            [artifact.name]:
              mime === "text/plain"
                ? new TextDecoder().decode(
                    Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
                  )
                : `data:${mime};base64,${encoded}`,
          }));
        } catch {
          // Previews are best-effort; artifacts remain saveable.
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

  const chooseIcon = useCallback(async () => {
    setError("");
    const app = getAssetApp();
    if (!app) {
      try {
        const selection = await selectWebImage();
        if (!selection) return;
        setIcon(selection.input);
        setSourcePreview(selection.preview);
        const asset = await getProjectClient().addAsset(projectId, {
          name: selection.input.name,
          mime: selection.input.mimeType,
          base64: selection.preview.split(",").at(-1) ?? "",
        });
        setSourceAssetId(asset.id);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not preview that image.");
      }
      return;
    }
    try {
      const selected = await app.SelectAssetImage("icon");
      setIcon(selected);
      const encoded = await app.GetAssetInputPreview(selected.handle);
      setSourcePreview(`data:${selected.mimeType || "image/png"};base64,${encoded}`);
      const asset = await getProjectClient().addAsset(projectId, {
        name: selected.name,
        mime: selected.mimeType || "image/png",
        base64: encoded,
      });
      setSourceAssetId(asset.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not select an icon.");
    }
  }, [projectId]);

  const generate = useCallback(async () => {
    const app = getAssetApp();
    if (!app || !icon) return;
    if (result) void app.DiscardAssetJob(result.jobId);
    setBusy(true);
    setError("");
    setResult(null);
    setCopied("");

    let iconHandle = icon.handle;
    if (sourceAssetId && app.StageProjectAsset) {
      try {
        const staged = await app.StageProjectAsset(projectId, sourceAssetId, "icon");
        iconHandle = staged.handle;
      } catch {
        setError("Could not restore the selected source asset.");
        setBusy(false);
        return;
      }
    }

    const request: BrandGenerateRequest = {
      icon: iconHandle,
      plate,
      copySvg,
      ogEnabled,
      ogTitle,
      ogDescription,
      ogSiteLabel,
      ogWidth: Number(ogWidth),
      ogHeight: Number(ogHeight),
      manifestEnabled,
      name,
      shortName,
      themeColor,
      backgroundColor,
      startUrl,
      display,
      outDir,
    };

    try {
      const generated = await app.GenerateBrandAssets(request);
      if (ogDesign && generated.artifacts.some((artifact) => artifact.name === "og.png")) {
        const encoded = ogDesign.dataUrl.split(",")[1] ?? "";
        await app.ReplaceAssetArtifact(generated.jobId, "og.png", encoded);
        setPreviews((current) => ({ ...current, "og.png": ogDesign.dataUrl }));
      }
      setResult(generated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate brand assets.");
    } finally {
      setBusy(false);
    }
  }, [
    backgroundColor,
    copySvg,
    display,
    icon,
    manifestEnabled,
    name,
    ogDesign,
    ogDescription,
    ogEnabled,
    ogHeight,
    ogSiteLabel,
    ogTitle,
    ogWidth,
    outDir,
    plate,
    result,
    shortName,
    startUrl,
    themeColor,
    sourceAssetId,
    projectId,
  ]);

  const saveOne = useCallback(
    async (artifactName: string) => {
      if (!result) return;
      try {
        await getAssetApp()?.SaveAssetArtifact(result.jobId, artifactName);
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
      setError(cause instanceof Error ? cause.message : "Could not copy the manifest.");
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

  const saveOgDraft = useCallback(
    (draft: OgEditorDraft) => {
      updateBrandDocument((current) => ({ ...current, ogDraft: draft }));
    },
    [updateBrandDocument],
  );

  const downloadOgDesign = useCallback(() => {
    if (!ogDesign) return;
    const link = document.createElement("a");
    link.href = ogDesign.dataUrl;
    link.download = "og.png";
    document.body.append(link);
    link.click();
    link.remove();
  }, [ogDesign]);

  return (
    <section className="brand-page">
      <ToolHeader
        icon={<PackageIcon name="swatchbook" size={17} />}
        title="Brand Assets"
        meta={native ? "native generator ready" : "browser preview"}
        actions={
          <>
            {result ? (
              <ToolHeaderButton onClick={() => void saveAll()}>
                <FileArchive size={13} aria-hidden="true" />
                Save all
              </ToolHeaderButton>
            ) : null}
            <ToolHeaderButton
              variant="primary"
              disabled={!native || busy || !icon || (ogEnabled && !ogTitle)}
              onClick={() => void generate()}
            >
              {busy ? <LoaderCircle className="brand-spin" size={13} /> : <Download size={13} />}
              Generate
            </ToolHeaderButton>
          </>
        }
      />

      {native ? null : (
        <p className="brand-notice">
          Choose a mark to preview it here. Generating the asset set requires the Wails desktop app.
        </p>
      )}

      <div className={result ? "brand-layout" : "brand-layout brand-layout-form-only"}>
        <div className="brand-column">
          <div className="brand-card">
            <h2>Source mark</h2>
            <div className="brand-source">
              <div className="brand-source-main">
                {sourcePreview ? (
                  <button
                    type="button"
                    className="brand-source-preview"
                    aria-label={`Enlarge ${icon?.name ?? "source image"}`}
                    onClick={() =>
                      setExpanded({ title: icon?.name ?? "Source image", src: sourcePreview })
                    }
                  >
                    <img src={sourcePreview} alt="" />
                  </button>
                ) : (
                  <span className="brand-source-placeholder" aria-hidden="true">
                    <FolderOpen size={16} />
                  </span>
                )}
                <span>
                  {icon
                    ? `${icon.name} · ${Math.round(icon.size / 1024)} KB`
                    : "Transparent SVG or PNG"}
                </span>
              </div>
              <button type="button" onClick={() => void chooseIcon()}>
                {icon ? <Check size={14} /> : <FolderOpen size={14} />}
                {icon ? "Change" : "Choose"}
              </button>
            </div>
            {sourcePreview ? (
              <div className="brand-mark-preview">
                <span className="brand-preview-label">Selected mark</span>
                <button
                  type="button"
                  className="brand-mark-preview-box"
                  aria-label={`Enlarge ${icon?.name ?? "source image"}`}
                  onClick={() =>
                    setExpanded({ title: icon?.name ?? "Source image", src: sourcePreview })
                  }
                >
                  <img src={sourcePreview} alt="Selected source mark" />
                </button>
                <span className="brand-preview-meta">
                  {icon?.name ?? "Source image"} · click to enlarge
                </span>
              </div>
            ) : null}
            <p className="brand-summary">{ICON_SUMMARY}</p>
          </div>

          <div className="brand-card">
            <h2>Icons and plate</h2>
            <ColorField label="Plate color" value={plate} onChange={setPlate} />
            <label className="brand-check">
              <input
                type="checkbox"
                checked={copySvg}
                onChange={(event) => setCopySvg(event.target.checked)}
              />
              Copy source as favicon.svg
            </label>
            <label className="brand-field">
              <span>Output folder</span>
              <input value={outDir} onChange={(event) => setOutDir(event.target.value)} />
            </label>
          </div>

          <div className="brand-card">
            <div className="brand-section-head">
              <h2>Social card</h2>
              <label className="brand-switch">
                <input
                  type="checkbox"
                  checked={ogEnabled}
                  onChange={(event) => setOgEnabled(event.target.checked)}
                />
                Enable
              </label>
            </div>
            <fieldset disabled={!ogEnabled}>
              <label className="brand-field">
                <span>Title</span>
                <input value={ogTitle} onChange={(event) => setOgTitle(event.target.value)} />
              </label>
              <label className="brand-field">
                <span>Description</span>
                <input
                  value={ogDescription}
                  onChange={(event) => setOgDescription(event.target.value)}
                />
              </label>
              <label className="brand-field">
                <span>Site label</span>
                <input
                  value={ogSiteLabel}
                  onChange={(event) => setOgSiteLabel(event.target.value)}
                />
              </label>
              <div className="brand-field-row">
                <label className="brand-field">
                  <span>Width</span>
                  <input
                    type="number"
                    value={ogWidth}
                    onChange={(event) => setOgWidth(Number(event.target.value))}
                  />
                </label>
                <label className="brand-field">
                  <span>Height</span>
                  <input
                    type="number"
                    value={ogHeight}
                    onChange={(event) => setOgHeight(Number(event.target.value))}
                  />
                </label>
              </div>
              <div className="brand-custom-og">
                <div className="brand-og-actions">
                  <button type="button" onClick={() => setOgEditorOpen(true)}>
                    Open visual editor
                  </button>
                  {ogDesign ? (
                    <button type="button" onClick={downloadOgDesign}>
                      Download PNG
                    </button>
                  ) : null}
                  {ogDesign ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOgDesign(null);
                        updateBrandDocument((current) => ({ ...current, ogDraft: null }));
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="brand-og-preview"
                  onClick={() => setOgEditorOpen(true)}
                  aria-label="Customize social card"
                >
                  {ogPreview ? (
                    <img src={ogPreview} alt="Social card preview" />
                  ) : (
                    <span className="brand-og-preview-placeholder">
                      Preparing social card preview…
                    </span>
                  )}
                  <span className="brand-og-preview-label">Click to customize</span>
                </button>
              </div>
            </fieldset>
          </div>

          <div className="brand-card">
            <div className="brand-section-head">
              <h2>Web manifest</h2>
              <label className="brand-switch">
                <input
                  type="checkbox"
                  checked={manifestEnabled}
                  onChange={(event) => setManifestEnabled(event.target.checked)}
                />
                Enable
              </label>
            </div>
            <fieldset disabled={!manifestEnabled}>
              <div className="brand-field-row">
                <label className="brand-field">
                  <span>Name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="brand-field">
                  <span>Short name</span>
                  <input value={shortName} onChange={(event) => setShortName(event.target.value)} />
                </label>
              </div>
              <div className="brand-field-row">
                <ColorField label="Theme" value={themeColor} onChange={setThemeColor} />
                <ColorField
                  label="Background"
                  value={backgroundColor}
                  onChange={setBackgroundColor}
                />
              </div>
              <div className="brand-field-row">
                <label className="brand-field">
                  <span>Start URL</span>
                  <input value={startUrl} onChange={(event) => setStartUrl(event.target.value)} />
                </label>
                <label className="brand-field">
                  <span>Display</span>
                  <select value={display} onChange={(event) => setDisplay(event.target.value)}>
                    <option value="standalone">standalone</option>
                    <option value="fullscreen">fullscreen</option>
                    <option value="minimal-ui">minimal-ui</option>
                    <option value="browser">browser</option>
                  </select>
                </label>
              </div>
            </fieldset>
          </div>

          {error ? (
            <p className="brand-error">
              <TriangleAlert size={14} />
              {error}
            </p>
          ) : null}
        </div>

        {result ? (
          <div className="brand-column">
            <div className="brand-card brand-results">
              <div className="brand-results-head">
                <h2>Generated assets</h2>
                <button type="button" onClick={() => void saveAll()}>
                  <FileArchive size={14} />
                  Save all
                </button>
              </div>
              <div className="brand-score">
                <strong>{result.artifacts.length}</strong>
                <span>files generated</span>
              </div>
              <div className="brand-artifact-list">
                {result.artifacts.map((artifact) => (
                  <article className="brand-artifact" key={artifact.name}>
                    {previews[artifact.name]?.startsWith("data:") ? (
                      <button
                        type="button"
                        className="brand-artifact-preview"
                        aria-label={`Enlarge ${artifact.name}`}
                        onClick={() =>
                          setExpanded({ title: artifact.name, src: previews[artifact.name] })
                        }
                      >
                        <img src={previews[artifact.name]} alt="" />
                      </button>
                    ) : (
                      <div className="brand-artifact-preview">
                        <span>{artifact.name.split(".").at(-1)?.toUpperCase()}</span>
                      </div>
                    )}
                    <div className="brand-artifact-meta">
                      <strong>{artifact.name}</strong>
                      <span>{Math.round(artifact.bytes / 1024)} KB</span>
                    </div>
                    <button
                      className="brand-artifact-save"
                      type="button"
                      onClick={() => void saveOne(artifact.name)}
                    >
                      <Download size={13} />
                      Save
                    </button>
                  </article>
                ))}
              </div>
              {result.configPath ? (
                <pre className="brand-config">
                  {previews[result.configPath.split("/").at(-1) ?? ""] ?? ""}
                </pre>
              ) : null}
              {result.agentPrompt ? (
                <div className="brand-agent">
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
                  className="brand-copy-config"
                  type="button"
                  onClick={() => void copyConfig()}
                >
                  {copied === "config" ? "Manifest copied" : "Copy web manifest"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {ogEditorOpen ? (
        <OgVisualEditor
          title={ogTitle}
          description={ogDescription}
          siteLabel={ogSiteLabel}
          imageUrl={sourcePreview || undefined}
          width={Number(ogWidth)}
          height={Number(ogHeight)}
          initialDraft={brandDocument.ogDraft}
          onDraftChange={saveOgDraft}
          onExport={(design) => {
            setOgDesign(design);
            setOgEditorOpen(false);
          }}
          onClose={() => setOgEditorOpen(false)}
        />
      ) : null}
      <AssetPreviewDialog
        title={expanded?.title ?? ""}
        src={expanded?.src}
        onClose={() => setExpanded(null)}
      />
    </section>
  );

  async function saveAll() {
    if (!result) return;
    try {
      await getAssetApp()?.SaveAssetSet(result.jobId, "brand-assets.zip");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the brand set.");
    }
  }
}
