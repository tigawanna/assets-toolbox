export interface DefaultFeatureGraphicProps {
  appName: string;
  slogan?: string;
  iconDataUrl?: string;
  brandColor: string;
  headingColor?: string;
  subtextColor?: string;
  fontFamily?: string;
}

const flex = "flex" as const;
/** ~8% on each side — Play overlays crop the feature-graphic edges. */
const SAFE_PAD = "84px";

/** Dedicated 1024×500 feature graphic: centered type, no device mockup. */
export function DefaultFeatureGraphic({
  appName,
  slogan,
  iconDataUrl,
  brandColor,
  headingColor = "#f7f7f3",
  subtextColor = "rgba(247, 247, 243, 0.82)",
  fontFamily = "Inter",
}: DefaultFeatureGraphicProps) {
  return (
    <div
      style={{
        display: flex,
        width: "100%",
        height: "100%",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "18px",
        padding: `44px ${SAFE_PAD}`,
        backgroundColor: brandColor,
        color: headingColor,
        fontFamily,
        textAlign: "center",
      }}
    >
      {iconDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconDataUrl} width={92} height={92} style={{ borderRadius: "22px" }} />
      ) : null}
      <div
        style={{
          display: flex,
          fontSize: "88px",
          fontWeight: 700,
          lineHeight: 1.0,
          letterSpacing: "-0.035em",
          maxWidth: "100%",
        }}
      >
        {appName}
      </div>
      {slogan ? (
        <div
          style={{
            display: flex,
            fontSize: "38px",
            fontWeight: 400,
            lineHeight: 1.25,
            color: subtextColor,
            maxWidth: "860px",
          }}
        >
          {slogan}
        </div>
      ) : null}
    </div>
  );
}
