import { useState, type ComponentType, type CSSProperties, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Eclipse,
  Maximize2,
  Monitor,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Trash2,
  Type,
} from "lucide-react";

import {
  applyCustomTheme,
  deleteCustomTheme,
  getCustomTheme,
  saveCustomTheme,
  updateCustomTheme,
  useCustomThemes,
} from "../lib/custom-themes";

import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import {
  DEFAULT_ACCENTS,
  DEFAULT_BACKGROUNDS,
  DEFAULT_TEXTS,
  DEFAULT_TEXT_SCALE,
  DEFAULT_UI_SCALE,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_STEP,
  THEME_LABELS,
  clampScale,
  isSystemDefault,
  resetAppearance,
  resolveTheme,
  setAccent,
  setBackground,
  setTextColor,
  setTextScale,
  setThemeMode,
  setUiScale,
  useAppearance,
  type ThemeMode,
} from "../lib/theme";
import "./settings.css";

type IconComponent = ComponentType<{
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}>;

const THEME_OPTIONS: ReadonlyArray<{
  mode: ThemeMode;
  label: string;
  hint: string;
  icon: IconComponent;
}> = [
  { mode: "light", label: "Light", hint: "Bright and crisp", icon: Sun },
  { mode: "dark", label: "Dark", hint: "Easy on the eyes", icon: Moon },
  { mode: "black", label: "Pitch black", hint: "True black, OLED friendly", icon: Eclipse },
  { mode: "system", label: "System", hint: "Follow your device", icon: Monitor },
];

const ACCENT_PRESETS: ReadonlyArray<{ name: string; color: string }> = [
  { name: "Terracotta", color: "#b65e37" },
  { name: "Indigo", color: "#6366f1" },
  { name: "Violet", color: "#8b5cf6" },
  { name: "Teal", color: "#0d9488" },
  { name: "Blue", color: "#2563eb" },
  { name: "Lime", color: "#65a30d" },
  { name: "Rose", color: "#e11d48" },
  { name: "Amber", color: "#d97706" },
];

interface ScaleControlProps {
  id: string;
  title: string;
  description: string;
  icon: IconComponent;
  value: number;
  defaultValue: number;
  onChange: (value: number) => void;
}

function ScaleControl({
  id,
  title,
  description,
  icon: Icon,
  value,
  defaultValue,
  onChange,
}: ScaleControlProps) {
  const percent = Math.round(value * 100);

  return (
    <div className="settings-scale">
      <div className="settings-scale-head">
        <span className="settings-scale-icon" aria-hidden="true">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <div className="settings-scale-copy">
          <label htmlFor={id}>{title}</label>
          <p>{description}</p>
        </div>
        <output htmlFor={id} className="settings-scale-value">
          {percent}%
        </output>
      </div>
      <div className="settings-scale-controls">
        <button
          type="button"
          className="settings-step"
          aria-label={`Decrease ${title.toLowerCase()}`}
          disabled={value <= SCALE_MIN}
          onClick={() => onChange(clampScale(value - SCALE_STEP))}
        >
          −
        </button>
        <input
          id={id}
          className="settings-range"
          type="range"
          min={SCALE_MIN}
          max={SCALE_MAX}
          step={SCALE_STEP}
          value={value}
          aria-valuetext={`${percent} percent`}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <button
          type="button"
          className="settings-step"
          aria-label={`Increase ${title.toLowerCase()}`}
          disabled={value >= SCALE_MAX}
          onClick={() => onChange(clampScale(value + SCALE_STEP))}
        >
          +
        </button>
      </div>
      <div className="settings-scale-meta">
        <span>{Math.round(SCALE_MIN * 100)}%</span>
        <button
          type="button"
          className="settings-scale-default"
          disabled={value === defaultValue}
          onClick={() => onChange(defaultValue)}
        >
          Reset to {Math.round(defaultValue * 100)}%
        </button>
        <span>{Math.round(SCALE_MAX * 100)}%</span>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const appearance = useAppearance();
  const savedThemes = useCustomThemes();
  const [themeName, setThemeName] = useState("");
  const [creatingTheme, setCreatingTheme] = useState(false);
  const atDefaults = isSystemDefault(appearance);
  const resolved = resolveTheme(appearance);
  const currentAccent = appearance.accent ?? DEFAULT_ACCENTS[resolved];
  const currentBackground = appearance.background ?? DEFAULT_BACKGROUNDS[resolved];
  const currentText = appearance.text ?? DEFAULT_TEXTS[resolved];
  const activeTheme = getCustomTheme(appearance.activeThemeId);
  const currentColors = {
    accent: currentAccent,
    background: currentBackground,
    text: currentText,
  };
  let modeHint = `Using ${THEME_LABELS[resolved]} theme.`;
  if (appearance.mode === "custom") {
    modeHint = `Using your ${activeTheme?.name ?? "custom"} theme.`;
  } else if (appearance.mode === "system") {
    modeHint = `System is currently ${THEME_LABELS[resolved]}.`;
  }

  function handleSaveTheme(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const created = saveCustomTheme({ ...currentColors, name: themeName });
    if (created === null) return;
    applyCustomTheme(created);
    setThemeName("");
    setCreatingTheme(false);
  }

  function handleDeleteTheme(id: string): void {
    deleteCustomTheme(id);
    // Deleting the theme you are wearing drops you back to a built-in mode.
    if (appearance.activeThemeId === id) setThemeMode("system");
  }

  function openCustomThemes(): void {
    setCreatingTheme(true);
    document
      .getElementById("settings-custom-themes")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <section className="settings-page">
      <ToolHeader
        icon={<SlidersHorizontal size={18} strokeWidth={1.8} aria-hidden="true" />}
        title="Settings"
        description="appearance · make the workspace yours"
        actions={
          <ToolHeaderButton onClick={resetAppearance} disabled={atDefaults}>
            <RotateCcw size={14} aria-hidden="true" />
            Reset to system defaults
          </ToolHeaderButton>
        }
      />

      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-head">
            <p className="settings-eyebrow">Appearance</p>
            <h2>Theme</h2>
            <p>
              Pick a look for the desktop workspace. System follows your device and updates live.
            </p>
          </div>

          <fieldset className="settings-fieldset">
            <legend className="settings-field-label">Theme</legend>
            <div className="settings-theme-options">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = appearance.mode === option.mode;
                return (
                  <label
                    key={option.mode}
                    className="settings-theme-option"
                    data-selected={selected}
                  >
                    <input
                      type="radio"
                      name="theme-mode"
                      value={option.mode}
                      checked={selected}
                      onChange={() => setThemeMode(option.mode)}
                    />
                    <Icon size={18} strokeWidth={1.7} aria-hidden={true} />
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <p className="settings-hint" role="status">
            {modeHint}
          </p>
          <button type="button" className="settings-custom-link" onClick={openCustomThemes}>
            Build your own custom theme
            <ArrowRight size={13} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <p className="settings-eyebrow">Readability</p>
            <h2>Size</h2>
            <p>Scale the whole interface, or grow text without changing the layout around it.</p>
          </div>

          <ScaleControl
            id="settings-ui-scale"
            title="Scale everything"
            description="Enlarges text, controls and spacing together."
            icon={Maximize2}
            value={appearance.uiScale}
            defaultValue={DEFAULT_UI_SCALE}
            onChange={setUiScale}
          />
          <ScaleControl
            id="settings-text-scale"
            title="Scale text only"
            description="Enlarges font sizes while keeping the layout as-is."
            icon={Type}
            value={appearance.textScale}
            defaultValue={DEFAULT_TEXT_SCALE}
            onChange={setTextScale}
          />
        </section>

        <section className="settings-card settings-accent-card" id="settings-custom-themes">
          <div className="settings-card-head">
            <p className="settings-eyebrow">Identity</p>
            <h2>Colors</h2>
            <p>
              Pick a primary color and it flows through the shell and every tool — buttons, focus
              rings, badges and highlights. Background and text colors reshape the whole palette.
            </p>
          </div>

          <div className="settings-custom-config">
            <div className="settings-swatch-row" role="group" aria-label="Accent color presets">
              {ACCENT_PRESETS.map((preset) => {
                const selected = appearance.accent?.toLowerCase() === preset.color;
                return (
                  <button
                    key={preset.color}
                    type="button"
                    className="settings-swatch"
                    data-selected={selected}
                    style={{ "--swatch": preset.color } as CSSProperties}
                    title={preset.name}
                    aria-label={`${preset.name} accent`}
                    aria-pressed={selected}
                    onClick={() => setAccent(preset.color)}
                  />
                );
              })}
              <button
                type="button"
                className="settings-swatch settings-swatch-default"
                title="Use the theme's default accent"
                aria-label="Use theme default accent"
                aria-pressed={appearance.accent === null}
                data-selected={appearance.accent === null}
                onClick={() => setAccent(null)}
              >
                <Palette size={14} aria-hidden="true" />
              </button>
            </div>

            <div className="settings-color-grid">
              <div className="settings-color-row">
                <label className="settings-color-field">
                  <span>Accent</span>
                  <input
                    type="color"
                    value={currentAccent}
                    aria-label="Custom accent color"
                    onChange={(event) => setAccent(event.target.value)}
                  />
                  <code>{currentAccent.toUpperCase()}</code>
                </label>
                <button
                  type="button"
                  className="settings-color-reset"
                  disabled={appearance.accent === null}
                  onClick={() => setAccent(null)}
                >
                  Theme default
                </button>
              </div>

              <div className="settings-color-row">
                <label className="settings-color-field">
                  <span>Background</span>
                  <input
                    type="color"
                    value={currentBackground}
                    aria-label="Custom background color"
                    onChange={(event) => setBackground(event.target.value)}
                  />
                  <code>{currentBackground.toUpperCase()}</code>
                </label>
                <button
                  type="button"
                  className="settings-color-reset"
                  disabled={appearance.background === null}
                  onClick={() => setBackground(null)}
                >
                  Theme default
                </button>
              </div>

              <div className="settings-color-row">
                <label className="settings-color-field">
                  <span>Text</span>
                  <input
                    type="color"
                    value={currentText}
                    aria-label="Custom text color"
                    onChange={(event) => setTextColor(event.target.value)}
                  />
                  <code>{currentText.toUpperCase()}</code>
                </label>
                <button
                  type="button"
                  className="settings-color-reset"
                  disabled={appearance.text === null}
                  onClick={() => setTextColor(null)}
                >
                  Theme default
                </button>
              </div>
            </div>
            <div className="settings-custom-actions">
              <button
                type="button"
                className="settings-new-theme"
                onClick={() => {
                  setThemeName("");
                  setCreatingTheme(true);
                }}
              >
                <Plus size={14} aria-hidden="true" />
                Save as a new theme
              </button>
              {activeTheme && (
                <button
                  type="button"
                  className="settings-update-button"
                  title={`Overwrite ${activeTheme.name} with the current colours`}
                  onClick={() =>
                    updateCustomTheme(activeTheme.id, { ...currentColors, name: activeTheme.name })
                  }
                >
                  Update “{activeTheme.name}”
                </button>
              )}
            </div>

            {creatingTheme && (
              <form className="settings-theme-builder" onSubmit={handleSaveTheme}>
                <label className="settings-builder-label" htmlFor="settings-theme-name">
                  Name your theme
                </label>
                <div className="settings-save-row">
                  <input
                    id="settings-theme-name"
                    className="settings-save-input"
                    type="text"
                    placeholder="e.g. Forest, Moonlight"
                    maxLength={40}
                    autoFocus
                    value={themeName}
                    onChange={(event) => setThemeName(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="settings-save-button"
                    disabled={!themeName.trim()}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Save theme
                  </button>
                </div>
                <button
                  type="button"
                  className="settings-cancel-button"
                  onClick={() => {
                    setThemeName("");
                    setCreatingTheme(false);
                  }}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          <div className="settings-custom-saved">
            <div className="settings-saved-head">
              <p className="settings-eyebrow">Your presets</p>
              <h3>Saved themes</h3>
              <p>Open one to jump straight back to your custom look.</p>
            </div>

            {savedThemes.length > 0 ? (
              <div className="settings-saved-list">
                {savedThemes.map((theme) => {
                  const active = theme.id === appearance.activeThemeId;
                  return (
                    <div key={theme.id} className="settings-saved-item" data-active={active}>
                      <button
                        type="button"
                        className="settings-saved-apply"
                        aria-pressed={active}
                        title={`Switch to ${theme.name}`}
                        onClick={() => applyCustomTheme(theme)}
                      >
                        <span
                          className="settings-saved-swatch"
                          style={
                            {
                              "--swatch-bg": theme.background,
                              "--swatch-accent": theme.accent,
                            } as CSSProperties
                          }
                          aria-hidden="true"
                        />
                        <span className="settings-saved-copy">
                          <strong>{theme.name}</strong>
                          <small>
                            {theme.background.toUpperCase()} · {theme.accent.toUpperCase()}
                          </small>
                        </span>
                        {active && <Check size={14} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        className="settings-saved-delete"
                        title={`Delete ${theme.name}`}
                        aria-label={`Delete ${theme.name}`}
                        onClick={() => handleDeleteTheme(theme.id)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="settings-saved-empty">
                No saved themes yet. Pick your colours, then choose “Save as a new theme” above.
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
