// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { Link, getCurrentProjectId, navigate, useCurrentProjectId } from "./router-shim";

let host: HTMLDivElement;
let root: Root;

function ProjectProbe() {
  const projectId = useCurrentProjectId();
  return <output>{projectId ?? "home"}</output>;
}

async function settleHashChange() {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.location.hash = "#/";
  await settleHashChange();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  window.location.hash = "#/";
  await settleHashChange();
});

describe("desktop hash router", () => {
  it("hydrates a project directly from the URL", async () => {
    window.location.hash = "#/board/direct-board";
    await act(async () => root.render(<ProjectProbe />));

    expect(host.textContent).toBe("direct-board");
    expect(getCurrentProjectId()).toBe("direct-board");
  });

  it("navigates and follows Back and Forward history", async () => {
    await act(async () => root.render(<ProjectProbe />));
    await act(async () => {
      await navigate({ to: "/board/$projectId", params: { projectId: "next-board" } });
    });
    await settleHashChange();
    expect(host.textContent).toBe("next-board");

    await act(async () => {
      const changed = new Promise<void>((resolve) => {
        window.addEventListener("hashchange", () => resolve(), { once: true });
      });
      window.history.back();
      await changed;
    });
    expect(host.textContent).toBe("home");

    await act(async () => {
      const changed = new Promise<void>((resolve) => {
        window.addEventListener("hashchange", () => resolve(), { once: true });
      });
      window.history.forward();
      await changed;
    });
    expect(host.textContent).toBe("next-board");
  });

  it("renders Links with usable hash hrefs and intercepts normal clicks", async () => {
    await act(async () =>
      root.render(
        <Link to="/board/$projectId" params={{ projectId: "linked-board" }}>
          Open board
        </Link>,
      ),
    );
    const link = host.querySelector("a");
    expect(link?.getAttribute("href")).toBe("#/board/linked-board");

    await act(async () => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    });
    await settleHashChange();
    expect(getCurrentProjectId()).toBe("linked-board");
  });
});
