import { ProjectHome } from "@/components/project-home";
import { Studio } from "@/components/studio";
import type { DesktopFlush } from "../../desktop";
import { useCurrentProjectId } from "./local/router-shim";

export default function ScreenshotStudioApp({
  onReady,
}: {
  onReady?: (flush: DesktopFlush | null) => void;
}) {
  const projectId = useCurrentProjectId();
  return projectId === null ? <ProjectHome /> : <Studio projectId={projectId} onReady={onReady} />;
}
