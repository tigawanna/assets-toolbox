import { describe, expect, it } from "vite-plus/test";

import { legacyBoardPath } from "./legacy-route";

describe("legacy Studio board links", () => {
  it("redirects old hash routes into TanStack Router paths", () => {
    expect(legacyBoardPath("#/board/launch")).toBe("/packages/screenshot-studio/board/launch");
    expect(legacyBoardPath("#/board/spring%20launch")).toBe(
      "/packages/screenshot-studio/board/spring%20launch",
    );
  });

  it("ignores shell hashes and malformed board IDs", () => {
    expect(legacyBoardPath("#/library")).toBeNull();
    expect(legacyBoardPath("#/board/%E0%A4%A")).toBeNull();
  });
});
