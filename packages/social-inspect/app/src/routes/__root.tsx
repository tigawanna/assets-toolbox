import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";

import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import standaloneCss from "../standalone.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { title: "Social Inspect — OG preview inspector" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content:
          "Inspect Open Graph tags, favicons, and social previews for any local or remote URL.",
      },
    ],
    links: [
      { rel: "stylesheet", href: standaloneCss },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
