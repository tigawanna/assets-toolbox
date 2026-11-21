export interface TestFrameProps {
  title: string;
  screenshotDataUrl?: string;
  brandColor?: string;
  marker?: string;
}

/** Default export fixture mirroring brand-assets' OgImage fixture. */
export default function Frame({
  title,
  screenshotDataUrl,
  brandColor = "#102030",
}: TestFrameProps) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        backgroundColor: brandColor,
        color: "#ffffff",
        fontFamily: "Inter",
        padding: "40px",
        fontSize: "64px",
        fontWeight: 700,
      }}
    >
      <div style={{ display: "flex" }}>{title}</div>
      {screenshotDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={screenshotDataUrl}
          style={{ width: "100%", height: "80%", objectFit: "contain" }}
        />
      ) : null}
    </div>
  );
}

/** Named export fixture. */
export function AltFrame({ marker = "alt" }: TestFrameProps) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#203010",
        color: "#ffffff",
        fontSize: "72px",
        fontFamily: "Inter",
      }}
    >
      {marker}
    </div>
  );
}
