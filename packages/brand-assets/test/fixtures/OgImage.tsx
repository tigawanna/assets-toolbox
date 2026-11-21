export interface OgImageProps {
  title: string;
  description?: string;
  siteLabel?: string;
  iconDataUrl?: string;
}

/** Fixture used to prove that a user-supplied TSX component can be ingested. */
export function OgImage({ title, description, siteLabel, iconDataUrl }: OgImageProps) {
  return (
    <div style={{ display: "flex", fontFamily: "Inter" }}>
      {iconDataUrl ? <img src={iconDataUrl} width={48} height={48} alt="" /> : null}
      <span>{siteLabel}</span>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
