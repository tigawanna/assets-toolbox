import { describe, expect, it } from "vite-plus/test";

import { createAppRouter } from "./router";

describe("TanStack desktop routes", () => {
  const router = createAppRouter();

  it.each([
    ["/", "/"],
    ["/packages/svg-compose", "/packages/svg-compose"],
    ["/packages/screenshot-studio", "/packages/screenshot-studio"],
    ["/packages/screenshot-studio/board/launch", "/packages/screenshot-studio/board/$projectId"],
    ["/packages/cabra-sound", "/packages/cabra-sound"],
    ["/packages/social-inspect", "/packages/social-inspect"],
    ["/packages/expo-assets", "/packages/expo-assets"],
    ["/packages/brand-assets", "/packages/brand-assets"],
    ["/packages/unknown", "/packages/$slug"],
  ])("matches %s without a router shim", (path, route) => {
    expect(router.matchRoutes(path).at(-1)?.fullPath).toBe(route);
  });

  it("leaves unmatched URLs to the styled root not-found boundary", () => {
    expect(router.matchRoutes("/not-a-route").at(-1)?._notFound).toBe(true);
  });
});
