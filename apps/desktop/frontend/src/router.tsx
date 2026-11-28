import { lazy } from "react";
import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { AppShell } from "./components/AppShell";
import { findPackage } from "./lib/catalog";
import { legacyBoardPath } from "./lib/legacy-route";
import { getActiveProjectId } from "./lib/projects/client";
import { ErrorPage } from "./pages/ErrorPage";
import { HelpPage } from "./pages/HelpPage";
import { HelpToolPage } from "./pages/HelpToolPage";
import { McpPage } from "./pages/McpPage";
import { PackagePlaceholderPage } from "./pages/PackagePlaceholderPage";
import { ProjectDashboard } from "./pages/ProjectDashboard";
import { ProjectHome, projectToolSlug } from "./pages/ProjectHome";
import { ProjectToolRoutePage } from "./routes/ProjectToolRoute";

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

function redirectToProjectTool(tool: string) {
  return () => {
    const projectId = getActiveProjectId();
    if (!projectId) throw redirect({ to: "/" });
    throw redirect({
      to: "/projects/$projectId/$tool",
      params: { projectId, tool },
    });
  };
}

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ProjectHome,
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "projects/$projectId",
  component: ProjectDashboard,
});

const projectToolRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "projects/$projectId/$tool",
  component: ProjectToolRoutePage,
});

const mcpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "mcp",
  component: McpPage,
});

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "help",
  component: HelpPage,
});

const helpToolRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "help/$slug",
  component: HelpToolPage,
});

const packageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/$slug",
  beforeLoad: ({ params }) => redirectToProjectTool(projectToolSlug(params.slug)),
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
  beforeLoad: redirectToProjectTool("compose"),
  component: SvgComposeRoute,
});

const screenshotStudioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/screenshot-studio",
  beforeLoad: redirectToProjectTool("studio"),
  component: ScreenshotStudioHomeRoute,
});

const screenshotBoardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/screenshot-studio/board/$projectId",
  beforeLoad: redirectToProjectTool("studio"),
  component: ScreenshotStudioBoardRoute,
});

const cabraSoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/cabra-sound",
  beforeLoad: redirectToProjectTool("sound"),
  component: CabraSoundRoute,
});

const expoAssetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/expo-assets",
  beforeLoad: redirectToProjectTool("expo"),
  component: ExpoAssetsRoute,
});

const brandAssetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/brand-assets",
  beforeLoad: redirectToProjectTool("brand"),
  component: BrandAssetsRoute,
});

const socialInspectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "packages/social-inspect",
  beforeLoad: redirectToProjectTool("inspect"),
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === "string" ? search.url : "",
  }),
  component: SocialInspectRoute,
});

export const routeTree = rootRoute.addChildren([
  libraryRoute,
  helpRoute,
  helpToolRoute,
  mcpRoute,
  projectRoute,
  projectToolRoute,
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
