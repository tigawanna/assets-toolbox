import { useState } from "react";

import { resolveAsset } from "@inspect/url";
import type { InspectReport } from "@inspect/types";

const platforms = [
  "Google",
  "X / Twitter",
  "Facebook",
  "Discord",
  "LinkedIn",
  "WhatsApp",
  "Slack",
  "Telegram",
] as const;

type Platform = (typeof platforms)[number];

interface Props {
  report: InspectReport;
  proxy: (url: string) => string;
}

function useFields(report: InspectReport, proxy: (url: string) => string) {
  const url = new URL(report.finalUrl);
  const title = report.og.title || report.title || "Untitled page";
  const description =
    report.og.description ||
    report.description ||
    report.twitter.description ||
    "No description found for this page.";
  const siteName = report.og.site_name || report.title || url.hostname;
  const host = url.hostname.replace(/^www\./, "");
  const rawImage = report.og.image || report.twitter.image;
  const image = rawImage ? resolveAsset(report.finalUrl, rawImage) : undefined;
  const favicon = report.favicons[0]?.url;
  return {
    title,
    description,
    siteName,
    host,
    image: image ? proxy(image) : undefined,
    favicon: favicon ? proxy(favicon) : undefined,
  };
}

function Image({ src, alt }: { src?: string | undefined; alt: string }) {
  if (!src) {
    return <div className="preview-empty-img">No OG image declared</div>;
  }
  return <img className="preview-img" src={src} alt={alt} />;
}

export function PreviewCards({ report, proxy }: Props) {
  const [active, setActive] = useState<Platform>("X / Twitter");
  const f = useFields(report, proxy);

  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Platform previews">
        {platforms.map((platform) => (
          <button
            key={platform}
            type="button"
            role="tab"
            aria-selected={active === platform}
            className={`tab ${active === platform ? "active" : ""}`}
            onClick={() => setActive(platform)}
          >
            {platform}
          </button>
        ))}
      </div>

      <div className="stage">
        {active === "Google" ? (
          <div className="preview-card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              {f.favicon ? (
                <img src={f.favicon} width={22} height={22} alt="" style={{ borderRadius: 4 }} />
              ) : null}
              <div>
                <div style={{ fontSize: 12, color: "#202124" }}>{f.siteName}</div>
                <div className="preview-host">{f.host}</div>
              </div>
            </div>
            <div className="google-title">{f.title}</div>
            <div className="preview-desc">{f.description}</div>
          </div>
        ) : null}

        {active === "X / Twitter" ? (
          <div className="preview-card">
            <Image src={f.image} alt={f.title} />
            <div className="preview-body">
              <div className="preview-host">{f.host}</div>
              <div className="preview-title">{f.title}</div>
              <div className="preview-desc">{f.description}</div>
              <div className="preview-site">{report.twitter.card || "summary"}</div>
            </div>
          </div>
        ) : null}

        {active === "Facebook" ? (
          <div className="preview-card">
            <Image src={f.image} alt={f.title} />
            <div className="preview-body">
              <div className="preview-host">{f.host.toUpperCase()}</div>
              <div className="preview-title" style={{ fontSize: 20 }}>
                {f.title}
              </div>
              <div className="preview-desc">{f.description}</div>
            </div>
          </div>
        ) : null}

        {active === "Discord" ? (
          <div className="preview-card discord">
            <div style={{ padding: "16px 16px 0" }}>
              <div className="discord-author">
                <strong>{f.siteName}</strong>
                <time>Today at 12:00</time>
              </div>
              <div className="discord-body">
                <div className="discord-site">{f.host}</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "#b5bac1", marginTop: 4 }}>{f.description}</div>
                {f.image ? (
                  <img
                    src={f.image}
                    alt=""
                    style={{ width: "60%", marginTop: 12, borderRadius: 6 }}
                  />
                ) : null}
              </div>
            </div>
            <div style={{ height: 12 }} />
          </div>
        ) : null}

        {active === "LinkedIn" ? (
          <div className="preview-card">
            <Image src={f.image} alt={f.title} />
            <div className="preview-body">
              <div className="preview-title">{f.title}</div>
              <div className="preview-desc">{f.description}</div>
              <div className="preview-site">{f.host}</div>
            </div>
          </div>
        ) : null}

        {active === "WhatsApp" ? (
          <div className="preview-card whatsapp" style={{ padding: 14 }}>
            <Image src={f.image} alt={f.title} />
            <div className="whatsapp-bubble">
              <div style={{ color: "#00a884", fontSize: 11, fontFamily: "var(--mono)" }}>
                {f.host}
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 3 }}>{f.title}</div>
              <div className="preview-desc" style={{ marginTop: 3 }}>
                {f.description}
              </div>
            </div>
            <div className="whatsapp-time">12:00 ✓✓</div>
          </div>
        ) : null}

        {active === "Slack" ? (
          <div className="preview-card" style={{ padding: 18 }}>
            <div className="slack-name">
              {f.favicon ? (
                <img src={f.favicon} width={20} height={20} alt="" style={{ borderRadius: 4 }} />
              ) : null}
              {f.siteName}
            </div>
            <div style={{ fontWeight: 700, marginTop: 8 }}>{f.title}</div>
            <div className="preview-desc" style={{ marginTop: 4 }}>
              {f.description}
            </div>
            {f.image ? (
              <img src={f.image} alt="" style={{ width: "100%", marginTop: 12, borderRadius: 8 }} />
            ) : null}
          </div>
        ) : null}

        {active === "Telegram" ? (
          <div className="preview-card" style={{ padding: 0 }}>
            {f.image ? (
              <img src={f.image} alt="" style={{ width: "100%", display: "block" }} />
            ) : null}
            <div className="preview-body">
              <div className="telegram-name">{f.siteName}</div>
              <div className="preview-title">{f.title}</div>
              <div className="preview-desc">{f.description}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
