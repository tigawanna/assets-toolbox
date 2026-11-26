import { lazy } from "react";
import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { AppShell } from "./components/AppShell";
import { findPackage } from "./lib/catalog";
import { legacyBoardPath } from "./lib/legacy-route";
import { ErrorPage } from "./pages/ErrorPage";
import { LibraryPage } from "./pages/LibraryPage";
import { PackagePlaceholderPage } from "./pages/PackagePlaceholderPage";

function RootError({ error }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : "This page could not be opened.";
  return <ErrorPage message={message} />;
}

function NotFoundPage() {
  return <ErrorPage status={404} message="This page could not be found." />;
}

const rootRoute = createRootRoute({
  shellComponent: AppShell,
  errorComponent: RootError,
  notFoundComponent: NotFoundPage,
});

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LibraryPage,
});

const packageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/$slug",
  loader: ({ params }) => ({ tool: findPackage(params.slug) }),
  component: PackageRoutePage,
});

function PackageRoutePage() {
  const { tool } = packageRoute.useLoaderData();
  return <PackagePlaceholderPage tool={tool} />;
}

const SvgComposeRoute = lazy(() =>
  import("./routes/SvgComposeRoute").then((module) => ({ default: module.SvgComposeRoute })),
);
const ScreenshotStudioHomeRoute = lazy(() =>
  import("./routes/ScreenshotStudioRoutes").then((module) => ({
    default: module.ScreenshotStudioHomeRoute,
  })),
);
const ScreenshotStudioBoardRoute = lazy(() =>
  import("./routes/ScreenshotStudioRoutes").then((module) => ({
    default: module.ScreenshotStudioBoardRoutePage,
  })),
);
const CabraSoundRoute = lazy(() =>
  import("./routes/CabraSoundRoute").then((module) => ({ default: module.CabraSoundRoute })),
);
const SocialInspectRoute = lazy(() =>
  import("./routes/SocialInspectRoute").then((module) => ({ default: module.SocialInspectRoute })),
);
const ExpoAssetsRoute = lazy(() =>
  import("./routes/ExpoAssetsRoute").then((module) => ({ default: module.ExpoAssetsRoute })),
);
const BrandAssetsRoute = lazy(() =>
  import("./routes/BrandAssetsRoute").then((module) => ({ default: module.BrandAssetsRoute })),
);

const svgComposeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/svg-compose",
  component: SvgComposeRoute,
});

const screenshotStudioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/screenshot-studio",
  component: ScreenshotStudioHomeRoute,
});

const screenshotBoardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/screenshot-studio/board/$projectId",
  component: ScreenshotStudioBoardRoute,
});

const cabraSoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/cabra-sound",
  component: CabraSoundRoute,
});

const expoAssetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/expo-assets",
  component: ExpoAssetsRoute,
});

const brandAssetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/brand-assets",
  component: BrandAssetsRoute,
});

const socialInspectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/social-inspect",
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === "string" ? search.url : "",
  }),
  component: SocialInspectRoute,
});

export const routeTree = rootRoute.addChildren([
  libraryRoute,
  svgComposeRoute,
  screenshotStudioRoute,
  screenshotBoardRoute,
  cabraSoundRoute,
  expoAssetsRoute,
  brandAssetsRoute,
  socialInspectRoute,
  packageRoute,
]);

function createDesktopHistory() {
  const history = createBrowserHistory();
  const legacyPath = legacyBoardPath(window.location.hash);
  if (legacyPath) history.replace(legacyPath);
  return history;
}

export function createAppRouter() {
  return createRouter({
    routeTree,
    history: createDesktopHistory(),
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}

export const router = createAppRouter();
