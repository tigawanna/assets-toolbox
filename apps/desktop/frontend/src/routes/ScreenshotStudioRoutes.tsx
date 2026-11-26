import { useCallback, useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ProjectHome } from "@assets/screenshot-studio/components/project-home";
import { Studio } from "@assets/screenshot-studio/components/studio";

import { setDesktopModuleActive, type DesktopFlush } from "../lib/desktop";
import { useFlushRegistry } from "../lib/flush";

export function ScreenshotStudioHomeRoute() {
  const navigate = useNavigate();
  const openBoard = useCallback(
    (projectId: string) =>
      navigate({
        to: "/packages/screenshot-studio/board/$projectId",
        params: { projectId },
      }),
    [navigate],
  );

  return (
    <div className="editor-page">
      <ProjectHome onOpenBoard={openBoard} />
    </div>
  );
}

export function ScreenshotStudioBoardRoutePage() {
  const { projectId } = useParams({
    from: "/packages/screenshot-studio/board/$projectId",
  });
  return <ScreenshotStudioBoardRoute projectId={projectId} />;
}

export function ScreenshotStudioBoardRoute({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { register } = useFlushRegistry();
  const onReady = useCallback(
    (flush: DesktopFlush | null) => register("studio", flush),
    [register],
  );
  const goHome = useCallback(() => {
    void navigate({ to: "/packages/screenshot-studio" });
  }, [navigate]);

  useEffect(() => {
    setDesktopModuleActive("studio", true);
    return () => setDesktopModuleActive("studio", false);
  }, []);

  return (
    <div className="editor-page">
      <Studio projectId={projectId} embedded onReady={onReady} onHome={goHome} />
    </div>
  );
}
