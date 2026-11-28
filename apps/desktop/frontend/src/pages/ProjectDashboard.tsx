import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, FolderOpen } from "lucide-react";

import { AssetLibrary } from "../components/AssetLibrary";
import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import { getProjectClient } from "../lib/projects/client";
import { ProjectProvider } from "../lib/projects/context";
import { toolPackages } from "../lib/catalog";
import { ErrorPage } from "./ErrorPage";
import { isProjectId, type ProjectId, type ProjectSummary } from "../lib/projects/types";
import { projectToolSlug } from "./ProjectHome";
import "./projects.css";

export function ProjectDashboard() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    let active = true;
    void getProjectClient()
      .listProjects()
      .then((projects) => {
        if (active) setProject(projects.find((item) => item.id === projectId) ?? null);
      })
      .catch(() => {
        if (active) setProject(null);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const openTool = useCallback(
    (toolId: string) => {
      void navigate({
        to: "/projects/$projectId/$tool",
        params: { projectId, tool: projectToolSlug(toolId) },
      });
    },
    [navigate, projectId],
  );

  if (!isProjectId(projectId)) {
    return <ErrorPage message="That project could not be found." />;
  }

  return (
    <ProjectProvider key={projectId} projectId={projectId}>
      <section className="projects-page">
        <ToolHeader
          icon={<FolderOpen size={17} />}
          title={project?.name ?? "Project"}
          description={`${project?.counts.assets ?? 0} assets · ${project?.counts.tools ?? 0} tools`}
          actions={
            <ToolHeaderButton onClick={() => void navigate({ to: "/" })}>
              <ArrowLeft size={13} />
              Projects
            </ToolHeaderButton>
          }
        />

        <div className="projects-tools">
          {toolPackages.map((tool) => (
            <button
              className="projects-tool"
              type="button"
              key={tool.id}
              onClick={() => openTool(tool.id)}
            >
              <PackageIcon name={tool.icon} size={17} />
              <span>
                <strong>{tool.shortName}</strong>
                <small>{projectToolSlug(tool.id)}</small>
              </span>
            </button>
          ))}
        </div>

        <AssetLibrary />
      </section>
    </ProjectProvider>
  );
}

export type { ProjectId };
