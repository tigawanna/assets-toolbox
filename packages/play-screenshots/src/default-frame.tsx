export interface DefaultFrameProps {
  title: string;
  subtitle?: string;
  screenshotDataUrl?: string;
  appName?: string;
  iconDataUrl?: string;
  brandColor: string;
  headingColor?: string;
  subtextColor?: string;
  fontFamily?: string;
  /** Derived from the preset aspect ratio inside `generate.ts`. */
  orientation?: "portrait" | "landscape" | "square";
}

const flex = "flex" as const;

/**
 * Built-in marketing frame. Portrait puts the headline in the top ~18% and the
 * capture below it; landscape puts the headline left and the capture right.
 * The headline + subtitle stay under Play's ~20% tagline guidance.
 */
export function DefaultFrame({
  title,
  subtitle,
  screenshotDataUrl,
  appName,
  iconDataUrl,
  brandColor,
  headingColor = "#f7f7f3",
  subtextColor = "rgba(247, 247, 243, 0.78)",
  fontFamily = "Inter",
  orientation,
}: DefaultFrameProps) {
  const landscape = orientation === "landscape";
  const square = orientation === "square";
  let headingSizing: Record<string, string>;
  if (landscape) headingSizing = { width: "40%" };
  else if (square)
    headingSizing = { alignItems: "center", textAlign: "center", maxWidth: "1800px" };
  else headingSizing = { maxWidth: "920px" };

  const heading = (
    <div
      style={{
        display: flex,
        flexDirection: "column",
        gap: "18px",
        ...headingSizing,
      }}
    >
      <div
        style={{
          display: flex,
          fontSize: landscape ? "104px" : "78px",
          fontWeight: 700,
          lineHeight: 1.03,
          letterSpacing: "-0.035em",
          color: headingColor,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            display: flex,
            fontSize: landscape ? "44px" : "34px",
            fontWeight: 400,
            lineHeight: 1.3,
            color: subtextColor,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );

  const capture = screenshotDataUrl ? (
    <div
      style={{
        display: flex,
        ...(landscape ? { width: "60%" } : { flex: 1, width: "100%", minHeight: 0 }),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={screenshotDataUrl}
        style={{
          width: square ? "82%" : "100%",
          height: "100%",
          objectFit: "contain",
          borderRadius: "32px",
        }}
      />
    </div>
  ) : null;

  if (landscape) {
    return (
      <div
        style={{
          display: flex,
          width: "100%",
          height: "100%",
          flexDirection: "row",
          alignItems: "center",
          gap: "64px",
          padding: "72px",
          backgroundColor: brandColor,
          color: headingColor,
          fontFamily,
        }}
      >
        {heading}
        {capture}
      </div>
    );
  }

  return (
    <div
      style={{
        display: flex,
        width: "100%",
        height: "100%",
        flexDirection: "column",
        padding: square ? "92px 92px 104px" : "72px 72px 88px",
        backgroundColor: brandColor,
        color: headingColor,
        fontFamily,
      }}
    >
      <div style={{ display: flex, flexDirection: "column", gap: "10px" }}>
        {appName ? (
          <div
            style={{
              display: flex,
              alignItems: "center",
              gap: "14px",
              fontSize: "26px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: subtextColor,
            }}
          >
            {iconDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconDataUrl} width={40} height={40} style={{ borderRadius: "10px" }} />
            ) : null}
            {appName}
          </div>
        ) : null}
        {heading}
      </div>
      {capture}
    </div>
  );
}
