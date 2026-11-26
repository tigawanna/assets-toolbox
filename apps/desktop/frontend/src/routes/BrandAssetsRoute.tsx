import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Download,
  FileArchive,
  FolderOpen,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { defaultIconSizes } from "@assets/brand-assets/types";

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

export function BrandAssetsRoute() {
  const [icon, setIcon] = useState<AssetInput | null>(null);
  const [plate, setPlate] = useState("#0f100f");
  const [copySvg, setCopySvg] = useState(false);
  const [ogEnabled, setOgEnabled] = useState(true);
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogSiteLabel, setOgSiteLabel] = useState("");
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

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
    if (!app) return;
    try {
      setIcon(await app.SelectAssetImage("icon"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not select an icon.");
    }
  }, []);

  const generate = useCallback(async () => {
    const app = getAssetApp();
    if (!app || !icon) return;
    if (result) void app.DiscardAssetJob(result.jobId);
    setBusy(true);
    setError("");
    setResult(null);
    setCopied("");

    const request: BrandGenerateRequest = {
      icon: icon.handle,
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
      setResult(await app.GenerateBrandAssets(request));
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

  return (
    <section className="brand-page">
      <header className="brand-heading">
        <div>
          <p className="brand-eyebrow">Prepare</p>
          <h1>Brand Assets</h1>
          <p className="brand-lede">
            Build a favicon set, social card, and web manifest from one mark with the canonical
            Sharp and Takumi generators.
          </p>
        </div>
        <span className="brand-runtime">
          {native ? "Native generator ready" : "Browser preview"}
        </span>
      </header>

      {native ? null : (
        <p className="brand-notice">
          Generation requires the Wails desktop app. You can still inspect the form here.
        </p>
      )}

      <div className="brand-layout">
        <div className="brand-column">
          <div className="brand-card">
            <h2>Source mark</h2>
            <div className="brand-source">
              <span>
                {icon
                  ? `${icon.name} · ${Math.round(icon.size / 1024)} KB`
                  : "Transparent SVG or PNG"}
              </span>
              <button type="button" disabled={!native} onClick={() => void chooseIcon()}>
                {icon ? <Check size={14} /> : <FolderOpen size={14} />}
                {icon ? "Change" : "Choose"}
              </button>
            </div>
            <p className="brand-summary">{ICON_SUMMARY}</p>
          </div>

          <div className="brand-card">
            <h2>Icons and plate</h2>
            <label className="brand-field">
              <span>Plate color</span>
              <input value={plate} onChange={(event) => setPlate(event.target.value)} />
            </label>
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
                <label className="brand-field">
                  <span>Theme</span>
                  <input
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                  />
                </label>
                <label className="brand-field">
                  <span>Background</span>
                  <input
                    value={backgroundColor}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                  />
                </label>
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

          <button
            className="brand-generate"
            type="button"
            disabled={!native || busy || !icon || (ogEnabled && !ogTitle)}
            onClick={() => void generate()}
          >
            {busy ? <LoaderCircle className="brand-spin" size={15} /> : <Download size={15} />}
            {busy ? "Generating assets…" : "Generate brand set"}
          </button>
          {error ? (
            <p className="brand-error">
              <TriangleAlert size={14} />
              {error}
            </p>
          ) : null}
        </div>

        <div className="brand-column">
          <div className="brand-card brand-results">
            <div className="brand-results-head">
              <h2>Generated assets</h2>
              {result ? (
                <button type="button" onClick={() => void saveAll()}>
                  <FileArchive size={14} />
                  Save all
                </button>
              ) : null}
            </div>
            {result === null ? (
              <p className="brand-empty">Choose a mark and generate to see the brand asset set.</p>
            ) : (
              <>
                <div className="brand-score">
                  <strong>{result.artifacts.length}</strong>
                  <span>files generated</span>
                </div>
                <div className="brand-artifact-grid">
                  {result.artifacts.map((artifact) => (
                    <article className="brand-artifact" key={artifact.name}>
                      <div className="brand-artifact-preview">
                        {previews[artifact.name]?.startsWith("data:") ? (
                          <img src={previews[artifact.name]} alt="" />
                        ) : (
                          <span>{artifact.name.split(".").at(-1)?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="brand-artifact-meta">
                        <strong>{artifact.name}</strong>
                        <span>{Math.round(artifact.bytes / 1024)} KB</span>
                      </div>
                      <button type="button" onClick={() => void saveOne(artifact.name)}>
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
              </>
            )}
          </div>
        </div>
      </div>
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
