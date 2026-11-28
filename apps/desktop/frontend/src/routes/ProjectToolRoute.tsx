import { lazy, Suspense, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";

import { ProjectProvider } from "../lib/projects/context";
import { setActiveProjectId } from "../lib/projects/client";
import { isProjectId, isToolId, type ToolId } from "../lib/projects/types";
import { setDesktopModuleActive } from "../lib/desktop";
import { saveStudioTemplate } from "../lib/studio-templates";
import { useFlushRegistry } from "../lib/flush";
import { ErrorPage } from "../pages/ErrorPage";

const CabraSoundRoute = lazy(() =>
  import("./CabraSoundRoute").then((module) => ({ default: module.CabraSoundRoute })),
);
const BrandAssetsRoute = lazy(() =>
  import("./BrandAssetsRoute").then((module) => ({ default: module.BrandAssetsRoute })),
);
const ExpoAssetsRoute = lazy(() =>
  import("./ExpoAssetsRoute").then((module) => ({ default: module.ExpoAssetsRoute })),
);
const SocialInspectRoute = lazy(() =>
  import("./SocialInspectRoute").then((module) => ({ default: module.SocialInspectRoute })),
);
const SvgComposeRoute = lazy(() =>
  import("./SvgComposeRoute").then((module) => ({ default: module.SvgComposeRoute })),
);
const Studio = lazy(() =>
  import("@assets/screenshot-studio/components/studio").then((module) => ({
    default: module.Studio,
  })),
);

export function ProjectToolRoutePage() {
  const { projectId, tool } = useParams({ from: "/projects/$projectId/$tool" });

  useEffect(() => {
    if (isProjectId(projectId)) setActiveProjectId(projectId);
  }, [projectId]);

  if (!isProjectId(projectId)) {
    return <ErrorPage message="That project could not be found." />;
  }
  if (!isToolId(tool)) {
    return <ErrorPage message="That tool is not part of a project." />;
  }

  return (
    <ProjectProvider key={projectId} projectId={projectId}>
      <Suspense fallback={null}>
        <ProjectTool tool={tool} projectId={projectId} />
      </Suspense>
    </ProjectProvider>
  );
}

function ProjectTool({ tool, projectId }: { tool: ToolId; projectId: `p_${string}` }) {
  switch (tool) {
    case "brand":
      return <BrandAssetsRoute />;
    case "expo":
      return <ExpoAssetsRoute />;
    case "compose":
      return <SvgComposeRoute />;
    case "sound":
      return <CabraSoundRoute />;
    case "inspect":
      return <SocialInspectRoute />;
    case "studio":
      return <ProjectStudio projectId={projectId} />;
    default:
      return <ErrorPage message="Unknown project tool." />;
  }
}

function ProjectStudio({ projectId }: { projectId: `p_${string}` }) {
  const navigate = useNavigate();
  const { register } = useFlushRegistry();

  const onReady = useCallback(
    (flush: (() => Promise<boolean>) | null) => register("studio", flush),
    [register],
  );
  const onHome = useCallback(() => {
    void navigate({ to: "/projects/$projectId", params: { projectId } });
  }, [navigate, projectId]);

  const onSaveTemplate = useCallback(
    (name: string) => saveStudioTemplate(projectId, name).then(() => undefined),
    [projectId],
  );

  useEffect(() => {
    setDesktopModuleActive("studio", true);
    return () => setDesktopModuleActive("studio", false);
  }, []);

  return (
    <div className="editor-page">
      <Studio
        projectId={projectId}
        embedded
        onReady={onReady}
        onHome={onHome}
        onSaveTemplate={onSaveTemplate}
      />
    </div>
  );
}
