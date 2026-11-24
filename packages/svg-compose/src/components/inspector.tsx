import type { SelectionStyle, StylePatch } from "../canvas/stage";
import { SWATCHES } from "../doc/color";
import { TextIcon } from "./icons";

const roundValue = (value: number) => Math.round(value * 10) / 10;

type Props = {
  values: SelectionStyle | null;
  onChange: (patch: StylePatch) => void;
  onRadius: (radius: number) => void;
  onRotation: (degrees: number) => void;
  onAddText: () => void;
};

function ColorRow({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string;
  onPick: (color: string) => void;
}) {
  const swatchIndex = SWATCHES.indexOf(value);
  return (
    <div className="color-row">
      <div className="color-row-head">
        <span>{label}</span>
        <code>{value}</code>
      </div>
      <div className="swatch-row">
        {SWATCHES.map((color, index) => (
          <button
            key={color}
            aria-label={`${label} ${color}`}
            className={`swatch swatch-${index}${index === swatchIndex ? " active" : ""}`}
            title={color}
            onClick={() => onPick(color)}
          />
        ))}
        <label aria-label={`Custom ${label.toLowerCase()} color`} className="swatch custom">
          <input type="color" value={value} onChange={(event) => onPick(event.target.value)} />
          <span className="custom-plus">+</span>
        </label>
      </div>
    </div>
  );
}

export function Inspector({ values: style, onChange, onRadius, onRotation, onAddText }: Props) {
  return (
    <section className="inspector">
      <div className="inspector-head">
        <h2>Appearance</h2>
        <button className="inline-button" onClick={onAddText} title="Add text (T)">
          <TextIcon />
          Text
        </button>
      </div>

      {!style ? (
        <p className="empty">Select an object to change its colors, or add text.</p>
      ) : (
        <>
          <ColorRow label="Fill" value={style.fill} onPick={(fill) => onChange({ fill })} />
          <ColorRow label="Stroke" value={style.stroke} onPick={(stroke) => onChange({ stroke })} />

          <label className="inspector-field">
            <span>Stroke width</span>
            <input
              max="40"
              min="0"
              step="1"
              type="number"
              value={style.strokeWidth}
              onChange={(event) => onChange({ strokeWidth: Number(event.target.value) })}
            />
          </label>

          {style.radius !== null && (
            <label className="inspector-field">
              <span>Corner radius</span>
              <span className="range-row">
                <input
                  max="80"
                  min="0"
                  type="range"
                  value={style.radius}
                  onChange={(event) => onRadius(Number(event.target.value))}
                />
                <input
                  min="0"
                  type="number"
                  value={roundValue(style.radius)}
                  onChange={(event) => onRadius(Number(event.target.value))}
                />
              </span>
            </label>
          )}

          <label className="inspector-field">
            <span>Rotation</span>
            <span className="range-row">
              <input
                max="180"
                min="-180"
                type="range"
                value={roundValue(style.rotation)}
                onChange={(event) => onRotation(Number(event.target.value))}
              />
              <input
                max="180"
                min="-180"
                type="number"
                value={roundValue(style.rotation)}
                onChange={(event) => onRotation(Number(event.target.value))}
              />
            </span>
          </label>

          {style.text !== null && (
            <>
              <label className="inspector-field">
                <span>Content</span>
                <textarea
                  rows={3}
                  value={style.text}
                  onChange={(event) => onChange({ text: event.target.value })}
                />
              </label>
              <label className="inspector-field">
                <span>Font size</span>
                <input
                  max="200"
                  min="4"
                  step="1"
                  type="number"
                  value={style.fontSize}
                  onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
                />
              </label>
            </>
          )}

          <p className="inspector-meta">
            {style.count} {style.count === 1 ? "item" : "items"} · {style.tag}
          </p>
        </>
      )}
    </section>
  );
}
