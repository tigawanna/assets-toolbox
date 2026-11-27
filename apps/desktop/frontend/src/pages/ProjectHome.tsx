import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FolderOpen, Plus, Trash2 } from "lucide-react";

import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import { getActiveProjectId, getProjectClient, setActiveProjectId } from "../lib/projects/client";
import { toolPackages } from "../lib/catalog";
import type { ProjectId, ProjectSummary } from "../lib/projects/types";
import "./projects.css";

export function ProjectHome() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const activeId = getActiveProjectId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const client = getProjectClient();
      let list = await client.listProjects();
      if (list.length === 0) {
        let bootstrapped = false;
        try {
          bootstrapped = localStorage.getItem("assets-toolbox-projects-bootstrapped") === "1";
          localStorage.setItem("assets-toolbox-projects-bootstrapped", "1");
        } catch {
          // The marker is only a cross-tab guard.
        }
        if (!bootstrapped) {
          const created = await client.createProject("My Project");
          setActiveProjectId(created.id);
          list = [created];
        }
      }
      setProjects(list);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = useCallback(
    (project: ProjectSummary) => {
      setActiveProjectId(project.id);
      void navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
    },
    [navigate],
  );

  const create = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await getProjectClient().createProject(trimmed);
      setName("");
      setActiveProjectId(created.id);
      await load();
      void navigate({ to: "/projects/$projectId", params: { projectId: created.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the project.");
    }
  }, [load, name, navigate]);

  const remove = useCallback(
    async (project: ProjectSummary) => {
      try {
        await getProjectClient().deleteProject(project.id);
        if (getActiveProjectId() === project.id) setActiveProjectId(null);
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not delete the project.");
      }
    },
    [load],
  );

  return (
    <section className="projects-page">
      <ToolHeader
        icon={<FolderOpen size={17} />}
        title="Projects"
        description="local folders · everything for a project in one place"
        actions={
          <button type="button" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        }
      />

      {error ? <p className="projects-empty">{error}</p> : null}

      <div className="projects-list">
        {projects.map((project) => (
          <article className="projects-row" key={project.id}>
            <div className="projects-row-main">
              <strong>{project.name}</strong>
              <span>
                {project.counts.assets} assets · {project.counts.tools} tools ·{" "}
                {new Date(project.updatedAt).toLocaleDateString()}
              </span>
            </div>
            {activeId === project.id ? <span className="projects-row-active">ACTIVE</span> : null}
            <div className="projects-actions">
              <ToolHeaderButton onClick={() => open(project)}>Open</ToolHeaderButton>
              <ToolHeaderButton
                variant="icon"
                aria-label={`Delete ${project.name}`}
                onClick={() => void remove(project)}
              >
                <Trash2 size={13} />
              </ToolHeaderButton>
            </div>
          </article>
        ))}
      </div>

      <div className="projects-new">
        <input
          aria-label="New project name"
          value={name}
          placeholder="New project name, e.g. Geo Kenya"
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void create();
          }}
        />
        <ToolHeaderButton variant="primary" onClick={() => void create()} disabled={!name.trim()}>
          <Plus size={13} />
          Create project
        </ToolHeaderButton>
      </div>
    </section>
  );
}

const PROJECT_TOOL_ROUTE: Record<string, string> = {
  "svg-compose": "compose",
  "screenshot-studio": "studio",
  "cabra-sound": "sound",
  "expo-assets": "expo",
  "brand-assets": "brand",
  "social-inspect": "inspect",
};

export function projectToolSlug(toolId: string): string {
  return PROJECT_TOOL_ROUTE[toolId] ?? toolId;
}

export function toolIcon(name: (typeof toolPackages)[number]["icon"]) {
  return <PackageIcon name={name} size={17} />;
}

export type { ProjectId };
