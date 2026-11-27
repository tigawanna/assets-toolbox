import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Moon, Plus, Search, Sun, Trash2, X } from "lucide-react";

import { getActiveProjectId, getProjectClient, setActiveProjectId } from "../lib/projects/client";
import { toggleTheme, useTheme } from "../lib/theme";
import type { ProjectSummary } from "../lib/projects/types";
import "./projects.css";

export function ProjectHome() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
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

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? projects.filter((project) => project.name.toLowerCase().includes(needle))
      : projects;
    return [...list].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [projects, query]);

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
      setCreating(false);
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

  function renderProjects() {
    if (loading) return <p className="launch-empty">Loading projects…</p>;
    if (visible.length === 0) {
      return <p className="launch-empty">No projects match “{query}”.</p>;
    }
    return visible.map((project) => (
      <button
        type="button"
        className="launch-project-row"
        key={project.id}
        onClick={() => open(project)}
      >
        <span className="launch-project-avatar" aria-hidden="true">
          {project.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="launch-project-copy">
          <strong>{project.name}</strong>
          <span>
            {project.counts.assets} assets · {project.counts.tools} tools ·{" "}
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        </span>
        {activeId === project.id ? <span className="launch-project-active">ACTIVE</span> : null}
        <span
          className="launch-project-delete"
          role="button"
          tabIndex={0}
          aria-label={`Delete ${project.name}`}
          onClick={(event) => {
            event.stopPropagation();
            void remove(project);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              void remove(project);
            }
          }}
        >
          <Trash2 size={13} aria-hidden="true" />
        </span>
      </button>
    ));
  }

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
        <div className="launch-top-actions">
          <label className="launch-search">
            <Search size={14} aria-hidden="true" />
            <span className="launch-sr-only">Search projects</span>
            <input
              value={query}
              placeholder="Search projects"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <button type="button" className="launch-action" onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden="true" />
            New Project
          </button>
          <button
            type="button"
            className="launch-icon-action"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main className="launch-body">
        <div className="launch-list-head">
          <span>Projects</span>
          <span>{projects.length} total</span>
        </div>

        {error ? <p className="launch-error">{error}</p> : null}

        <div className="launch-project-list">{renderProjects()}</div>
      </main>

      {creating ? (
        <div className="launch-dialog-backdrop" onClick={() => setCreating(false)}>
          <div
            className="launch-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="New project"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="launch-dialog-head">
              <strong>New project</strong>
              <button
                type="button"
                className="launch-icon-action"
                aria-label="Close"
                onClick={() => setCreating(false)}
              >
                <X size={15} />
              </button>
            </div>
            <input
              autoFocus
              aria-label="Project name"
              value={name}
              placeholder="Project name"
              onChange={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void create();
                if (event.key === "Escape") setCreating(false);
              }}
            />
            <div className="launch-dialog-actions">
              <button type="button" className="launch-action" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="launch-action launch-action-primary"
                disabled={!name.trim()}
                onClick={() => void create()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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
