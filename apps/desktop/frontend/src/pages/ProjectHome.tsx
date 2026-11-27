import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Moon, Plus, Sun, Trash2 } from "lucide-react";

import { getActiveProjectId, getProjectClient, setActiveProjectId } from "../lib/projects/client";
import { toggleTheme, useTheme } from "../lib/theme";
import type { ProjectSummary } from "../lib/projects/types";
import "./projects.css";

export function ProjectHome() {
  const navigate = useNavigate();
  const theme = useTheme();
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
    <div className="launch-page">
      <header className="launch-top">
        <div className="launch-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="launch-brand-copy">
            <strong>Assets Toolbox</strong>
            <small>Local project workspace</small>
          </span>
        </div>
        <button
          type="button"
          className="launch-theme"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
      </header>

      <main className="launch-body">
        <div className="launch-intro">
          <span className="launch-eyebrow">Projects</span>
          <h1>Where should we work?</h1>
          <p>
            Each project keeps its own tools and assets in one place. Pick one to open the tool
            library, or start a new one.
          </p>
        </div>

        <div className="launch-create">
          <input
            aria-label="New project name"
            value={name}
            placeholder="Project name, e.g. Geo Kenya"
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
            }}
          />
          <button
            type="button"
            className="launch-create-button"
            disabled={!name.trim()}
            onClick={() => void create()}
          >
            <Plus size={14} />
            Create project
          </button>
        </div>

        {error ? <p className="launch-error">{error}</p> : null}

        <section className="launch-projects">
          <h2>Your projects</h2>
          {renderProjects()}
        </section>
      </main>
    </div>
  );

  function renderProjects() {
    if (loading) return <p className="launch-empty">Loading projects…</p>;
    if (projects.length === 0) {
      return <p className="launch-empty">No projects yet. Create one above to get started.</p>;
    }
    return (
      <div className="launch-project-list">
        {projects.map((project) => (
          <article className="launch-project-row" key={project.id}>
            <div className="launch-project-copy">
              <strong>{project.name}</strong>
              <span>
                {project.counts.assets} assets · {project.counts.tools} tools ·{" "}
                {new Date(project.updatedAt).toLocaleDateString()}
              </span>
            </div>
            {activeId === project.id ? <span className="launch-project-active">ACTIVE</span> : null}
            <button type="button" className="launch-open" onClick={() => open(project)}>
              Open
            </button>
            <button
              type="button"
              className="launch-delete"
              aria-label={`Delete ${project.name}`}
              onClick={() => void remove(project)}
            >
              <Trash2 size={13} />
            </button>
          </article>
        ))}
      </div>
    );
  }
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
