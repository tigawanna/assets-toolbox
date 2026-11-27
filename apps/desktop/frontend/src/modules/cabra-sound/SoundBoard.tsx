import {
  Download,
  FileArchive,
  Play,
  Search,
  Shuffle,
  Star,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AVAILABLE_NAMES,
  SOUND_META,
  controls,
  disposeAudio,
  initializeAudio,
  play,
  renderWav,
  subtleTick,
  sweep,
  wavFilename,
  type SoundName,
} from "@tigawanna/cabra-sound";
import { PackageIcon } from "../../components/PackageIcon";
import { ToolHeader } from "../../components/ToolHeader";
import { downloadBlob, zipStore } from "../../lib/zip";
import "./sound-board.css";

type Family = "all" | "favorites" | "mech" | "bubble" | "press" | "card" | "other";
type SoundFamily = Exclude<Family, "all">;

interface ExportProgress {
  completed: number;
  total: number;
}

const FAMILIES: ReadonlyArray<{ id: Family; label: string }> = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites" },
  { id: "mech", label: "Mechanical" },
  { id: "bubble", label: "Bubble" },
  { id: "press", label: "Press" },
  { id: "card", label: "Cards" },
  { id: "other", label: "Other" },
];

const WAVEFORM_BUCKETS = 32;
const WAVE_PROFILES = { sine: 1, square: 0.92, triangle: 0.82, sawtooth: 0.72 } as const;
const waveformCache = new Map<SoundName, string>();
const FAVORITES_KEY = "cabra-sound:favorites";

function loadFavorites(): Set<SoundName> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((item): item is SoundName => AVAILABLE_NAMES.includes(item as SoundName)),
    );
  } catch {
    return new Set();
  }
}

function familyOf(name: SoundName): SoundFamily {
  for (const prefix of ["mech", "bubble", "press", "card"] as const) {
    if (name.startsWith(prefix)) return prefix;
  }
  return "other";
}

function formatName(name: SoundName): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function nameHash(name: string): number {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A lightweight, deterministic preview without offline renders for every tile. */
function waveformPath(name: SoundName): string {
  const cached = waveformCache.get(name);
  if (cached) return cached;

  const meta = SOUND_META[name];
  const seed = nameHash(name);
  const duration = Math.max(1, meta.ms);
  const attack = clamp(meta.atk / duration, 0.025, 0.55);
  const release = clamp(260 / duration, 0.08, 0.62);
  const gain = clamp(0.32 + Math.sqrt(meta.gain / 0.45) * 0.68, 0.38, 1);
  const pitch = clamp(Math.log2(Math.max(1, meta.pitch) / 80) / 8, 0, 1);
  const density = clamp(meta.parts / 6, 0.15, 1);
  const phase = (seed % 360) / 57.2958;
  const waveProfile = WAVE_PROFILES[meta.wave];

  const segments: string[] = [];
  for (let index = 0; index < WAVEFORM_BUCKETS; index += 1) {
    const position = (index + 0.5) / WAVEFORM_BUCKETS;
    const attackEnvelope = Math.min(1, position / attack);
    const releaseEnvelope = Math.min(1, (1 - position) / release);
    const ripple = 0.76 + Math.abs(Math.sin(index * (0.82 + density * 1.7) + phase)) * 0.24;
    const movement = 0.86 + Math.sin(index * 0.57 + pitch * 5 + phase) * 0.14;
    const bend = 0.94 + clamp(meta.bend, -0.5, 0.5) * position * 0.12;
    const height =
      3 + 23 * gain * attackEnvelope * releaseEnvelope * ripple * movement * bend * waveProfile;
    const x = 2 + (index / (WAVEFORM_BUCKETS - 1)) * 136;
    const top = 14 - height / 2;
    const bottom = 14 + height / 2;
    segments.push(`M${x.toFixed(2)} ${top.toFixed(2)}V${bottom.toFixed(2)}`);
  }

  const path = segments.join(" ");
  waveformCache.set(name, path);
  return path;
}

function SoundWaveform({ name }: { name: SoundName }) {
  return (
    <svg
      className="sound-waveform"
      viewBox="0 0 140 28"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={waveformPath(name)} />
    </svg>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const subscribeControls = (listener: () => void) => controls.subscribe(listener);
const getEnabled = () => controls.enabled();
const getVolume = () => controls.volume();

export function SoundBoard() {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<Family>("all");
  const [selected, setSelected] = useState<SoundName | null>(null);
  const [revealed, setRevealed] = useState<SoundName | null>(null);
  const [favorites, setFavorites] = useState<Set<SoundName>>(loadFavorites);
  const [status, setStatus] = useState("Choose a sound to audition it.");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tileRefs = useRef(new Map<SoundName, HTMLElement>());
  const mountedRef = useRef(false);
  const exportGenerationRef = useRef(0);
  const exportCancelledRef = useRef(false);
  const exportingRef = useRef(false);

  const enabled = useSyncExternalStore(subscribeControls, getEnabled, getEnabled);
  const volume = useSyncExternalStore(subscribeControls, getVolume, getVolume);

  useEffect(() => {
    mountedRef.current = true;
    initializeAudio();

    return () => {
      mountedRef.current = false;
      exportGenerationRef.current += 1;
      exportCancelledRef.current = true;
      exportingRef.current = false;
      disposeAudio();
    };
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof Element &&
        target.matches('input, textarea, select, [contenteditable="true"]');

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        setQuery("");
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const normalizedQuery = useMemo(() => query.trim().replace(/\s+/g, " ").toLowerCase(), [query]);
  const showHelpers = family === "all" && normalizedQuery.length === 0;
  const visibleNames = useMemo(
    () =>
      AVAILABLE_NAMES.filter((name) => {
        const matchesFamily =
          family === "all" ||
          (family === "favorites" ? favorites.has(name) : familyOf(name) === family);
        const matchesQuery =
          name.toLowerCase().includes(normalizedQuery) ||
          formatName(name).toLowerCase().includes(normalizedQuery);
        return matchesFamily && matchesQuery;
      }),
    [family, favorites, normalizedQuery],
  );

  const playSound = useCallback(
    (name: SoundName) => {
      setSelected(name);
      if (!enabled) {
        setStatus("Sound is muted. Turn it on to audition.");
        return;
      }
      if (!play(name)) {
        setStatus(`Could not play ${formatName(name)}. Audio is unavailable or suppressed.`);
        return;
      }
      setStatus(`Playing ${formatName(name)}`);
    },
    [enabled],
  );

  const toggleFavorite = useCallback((name: SoundName) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // Favorites still work for this session when storage is unavailable.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!revealed) return;
    tileRefs.current.get(revealed)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [revealed]);

  const playRandom = useCallback(() => {
    const pool = visibleNames.length > 0 ? visibleNames : AVAILABLE_NAMES;
    const name = pool[Math.floor(Math.random() * pool.length)];
    if (!name) return;
    setRevealed(name);
    playSound(name);
  }, [playSound, visibleNames]);

  const playHelper = useCallback(
    (label: string, work: () => boolean) => {
      if (!enabled) {
        setStatus("Sound is muted. Turn it on to audition.");
        return;
      }
      if (!work()) {
        setStatus(`Could not play ${label}. Audio is unavailable or suppressed.`);
        return;
      }
      setStatus(`Playing ${label}`);
    },
    [enabled],
  );

  const beginExport = useCallback((total: number): number | null => {
    if (exportingRef.current) return null;
    exportGenerationRef.current += 1;
    exportCancelledRef.current = false;
    exportingRef.current = true;
    setExporting(true);
    setExportProgress({ completed: 0, total });
    return exportGenerationRef.current;
  }, []);

  const isExportActive = useCallback(
    (generation: number) =>
      mountedRef.current &&
      generation === exportGenerationRef.current &&
      !exportCancelledRef.current,
    [],
  );

  const finishExport = useCallback((generation: number) => {
    if (!mountedRef.current || generation !== exportGenerationRef.current) return;
    if (exportCancelledRef.current) setStatus("Export cancelled");
    exportingRef.current = false;
    setExporting(false);
    setExportProgress(null);
  }, []);

  const cancelExport = useCallback(() => {
    if (!exportingRef.current) return;
    exportCancelledRef.current = true;
    setStatus("Cancelling…");
  }, []);

  const exportMix = useCallback(async () => {
    const names = Object.freeze([...visibleNames]);
    if (names.length === 0) return;
    const generation = beginExport(names.length > 1 ? names.length : 1);
    if (generation === null) return;

    setStatus(`Rendering ${names.length} ${names.length === 1 ? "sound" : "sounds"}…`);
    try {
      const blob = await renderWav(names);
      if (!isExportActive(generation)) return;
      if (!blob) throw new Error("WAV rendering is unavailable.");
      if (names.length > 1) setExportProgress({ completed: names.length, total: names.length });
      const filename =
        names.length === 1 ? wavFilename(names) : `bencho-${names.length}-sounds.wav`;
      downloadBlob(blob, filename);
      setStatus(`Downloaded ${filename}`);
    } catch (error) {
      if (isExportActive(generation)) {
        setStatus(errorMessage(error, "Could not render the WAV."));
      }
    } finally {
      finishExport(generation);
    }
  }, [beginExport, finishExport, isExportActive, visibleNames]);

  const exportSound = useCallback(
    async (name: SoundName) => {
      const generation = beginExport(1);
      if (generation === null) return;

      setStatus(`Rendering ${formatName(name)}…`);
      try {
        const blob = await renderWav([name]);
        if (!isExportActive(generation)) return;
        if (!blob) throw new Error("WAV rendering is unavailable.");
        const filename = wavFilename([name]);
        downloadBlob(blob, filename);
        setStatus(`Downloaded ${filename}`);
      } catch (error) {
        if (isExportActive(generation)) {
          setStatus(errorMessage(error, "Could not render the WAV."));
        }
      } finally {
        finishExport(generation);
      }
    },
    [beginExport, finishExport, isExportActive],
  );

  const exportEach = useCallback(async () => {
    const names = Object.freeze([...visibleNames]);
    if (names.length === 0) return;
    if (names.length > 12 && !window.confirm(`Download ${names.length} WAV files in a ZIP?`)) {
      return;
    }

    const generation = beginExport(names.length);
    if (generation === null) return;

    try {
      const entries: Array<{ name: string; data: Uint8Array }> = [];
      for (const [index, name] of names.entries()) {
        if (!isExportActive(generation)) break;
        setStatus(`Rendering ${index + 1} of ${names.length}: ${formatName(name)}`);
        const blob = await renderWav([name]);
        if (!isExportActive(generation)) break;
        if (!blob) throw new Error("WAV rendering is unavailable.");
        const data = new Uint8Array(await blob.arrayBuffer());
        if (!isExportActive(generation)) break;
        entries.push({ name: wavFilename([name]), data });
        setExportProgress({ completed: index + 1, total: names.length });
      }

      if (!isExportActive(generation)) return;
      const filename = `bencho-${names.length}-sounds.zip`;
      const archive = new Blob([zipStore(entries) as BlobPart], { type: "application/zip" });
      downloadBlob(archive, filename);
      setStatus(`Downloaded ${filename}`);
    } catch (error) {
      if (isExportActive(generation)) {
        setStatus(errorMessage(error, "Could not render all WAV files."));
      }
    } finally {
      finishExport(generation);
    }
  }, [beginExport, finishExport, isExportActive, visibleNames]);

  const resetFilters = useCallback(() => {
    setQuery("");
    setFamily("all");
    searchInputRef.current?.focus();
  }, []);

  return (
    <section className="sound-board" aria-label="Cabra Sound library">
      <ToolHeader
        icon={<PackageIcon name="waveform" size={17} />}
        title="Cabra Sound"
        meta={`${AVAILABLE_NAMES.length} sounds · ${enabled ? "audio on" : "muted"}`}
        actions={
          <button type="button" onClick={playRandom}>
            <Shuffle size={13} aria-hidden="true" />
            Random
          </button>
        }
      />

      <div className="sound-toolbar">
        <label className="sound-search">
          <span className="sound-sr-only">Search sounds</span>
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={`Search ${AVAILABLE_NAMES.length} sounds`}
            autoComplete="off"
          />
          <kbd>/</kbd>
        </label>

        <div className="sound-audio-controls">
          <button
            className={`sound-audio-toggle${enabled ? " sound-is-active" : ""}`}
            type="button"
            aria-label={enabled ? "Mute sounds" : "Enable sounds"}
            aria-pressed={enabled}
            onClick={() => controls.toggle()}
          >
            {enabled ? (
              <Volume2 size={17} aria-hidden="true" />
            ) : (
              <VolumeX size={17} aria-hidden="true" />
            )}
            <span>{enabled ? "Sound on" : "Muted"}</span>
          </button>

          <label className="sound-volume-control">
            <span className="sound-sr-only">Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => controls.setVolume(Number(event.currentTarget.value))}
            />
            <span>{Math.round(volume * 100)}%</span>
          </label>
        </div>
      </div>

      <div className="sound-filter-row">
        <div className="sound-family-filters" role="group" aria-label="Filter sounds by family">
          {FAMILIES.map((item) => (
            <button
              className={family === item.id ? "sound-is-active" : undefined}
              type="button"
              aria-pressed={family === item.id}
              key={item.id}
              onClick={() => {
                setFamily(item.id);
                setQuery("");
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="sound-export-actions">
          <button
            className="sound-export-button"
            type="button"
            disabled={visibleNames.length === 0 || exporting}
            onClick={() => void exportMix()}
          >
            <Download size={14} aria-hidden="true" />
            Export mix
          </button>
          <button
            className="sound-export-button"
            type="button"
            disabled={visibleNames.length === 0 || exporting}
            onClick={() => void exportEach()}
          >
            <FileArchive size={14} aria-hidden="true" />
            Each as WAV
          </button>
        </div>
      </div>

      {showHelpers && (
        <div className="sound-helper-grid" role="group" aria-label="Sound helpers">
          <button type="button" onClick={() => playHelper("Sweep up", () => sweep(180, true))}>
            <Play size={15} aria-hidden="true" />
            Sweep up
          </button>
          <button type="button" onClick={() => playHelper("Sweep down", () => sweep(180, false))}>
            <Play size={15} aria-hidden="true" />
            Sweep down
          </button>
          <button type="button" onClick={() => playHelper("Soft tick", subtleTick)}>
            <Play size={15} aria-hidden="true" />
            Soft tick
          </button>
        </div>
      )}

      {selected ? (
        <div className="sound-now-playing" aria-label="Last played sound">
          <button
            className="sound-now-play"
            type="button"
            aria-label={`Replay ${formatName(selected)}`}
            onClick={() => playSound(selected)}
          >
            <Play size={15} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
          </button>
          <div className="sound-now-copy">
            <strong>{formatName(selected)}</strong>
            <span>
              {SOUND_META[selected].ms} ms · {familyOf(selected)}
            </span>
          </div>
          <SoundWaveform name={selected} />
          <button
            className={`sound-favorite${favorites.has(selected) ? " sound-is-favorite" : ""}`}
            type="button"
            aria-label={favorites.has(selected) ? "Remove favorite" : "Add favorite"}
            aria-pressed={favorites.has(selected)}
            onClick={() => toggleFavorite(selected)}
          >
            <Star
              size={15}
              fill={favorites.has(selected) ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
          <button
            className="sound-export-button"
            type="button"
            disabled={exporting}
            onClick={() => void exportSound(selected)}
          >
            <Download size={14} aria-hidden="true" />
            Download
          </button>
        </div>
      ) : null}

      <div className="sound-status">
        <span
          className={`sound-status-dot${enabled ? "" : " sound-is-muted"}`}
          aria-hidden="true"
        />
        <span className="sound-status-message" aria-live="polite" aria-atomic="true">
          {status}
        </span>
        {exporting && exportProgress && (
          <progress
            className="sound-export-progress"
            max={exportProgress.total}
            value={exportProgress.total > 1 ? exportProgress.completed : undefined}
            aria-label="Export progress"
          />
        )}
        {exporting && (
          <button className="sound-export-button" type="button" onClick={cancelExport}>
            <X size={13} aria-hidden="true" />
            Cancel
          </button>
        )}
        <strong>{visibleNames.length} shown</strong>
      </div>

      {visibleNames.length > 0 ? (
        <div className="sound-grid" aria-label="Available sounds">
          {visibleNames.map((name) => {
            const label = formatName(name);
            const isSelected = selected === name;
            return (
              <article
                className={`sound-tile${isSelected ? " sound-is-selected" : ""}`}
                key={name}
                ref={(node) => {
                  if (node) tileRefs.current.set(name, node);
                  else tileRefs.current.delete(name);
                }}
              >
                <button
                  className="sound-play"
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => playSound(name)}
                >
                  <span className="sound-play-icon">
                    <Play size={15} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="sound-tile-info">
                    <span className="sound-name">{label}</span>
                    <span className="sound-meta">{SOUND_META[name].ms} ms</span>
                  </span>
                  <SoundWaveform name={name} />
                </button>
                <div className="sound-tile-actions">
                  <button
                    className={`sound-favorite${favorites.has(name) ? " sound-is-favorite" : ""}`}
                    type="button"
                    aria-label={favorites.has(name) ? `Unfavorite ${label}` : `Favorite ${label}`}
                    aria-pressed={favorites.has(name)}
                    onClick={() => toggleFavorite(name)}
                  >
                    <Star
                      size={14}
                      fill={favorites.has(name) ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    className="sound-download"
                    type="button"
                    aria-label={`Download ${label} as WAV`}
                    title={`Download ${label} as WAV`}
                    disabled={exporting}
                    onClick={() => void exportSound(name)}
                  >
                    <Download size={15} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="sound-empty">
          <Search size={24} aria-hidden="true" />
          <h2>No matching sounds</h2>
          <p>Try a different name or show all families.</p>
          <button type="button" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      )}

      <footer className="sound-footer">
        <span>{AVAILABLE_NAMES.length} procedural sounds · no audio files</span>
        <span>
          Sound designs based on{" "}
          <a
            href="https://github.com/cabralorenzo/bencho/tree/main/sounds"
            target="_blank"
            rel="noreferrer"
          >
            Bencho
          </a>{" "}
          by cabralorenzo.
        </span>
      </footer>
    </section>
  );
}

export default SoundBoard;
