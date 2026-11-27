import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";

import { Select } from "./ui/select";

import { getActiveProjectId, getProjectClient, setActiveProjectId } from "../lib/projects/client";
import type { ProjectId, ProjectSummary } from "../lib/projects/types";

export function ProjectSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [active, setActive] = useState<ProjectId | null>(getActiveProjectId());

  useEffect(() => {
    let current = true;
    void getProjectClient()
      .listProjects()
      .then((list) => {
        if (!current) return;
        setProjects(list);
        if (!active && list.length > 0) {
          const first = list[0]?.id ?? null;
          setActiveProjectId(first);
          setActive(first);
        }
      })
      .catch(() => {
        // The switcher simply stays empty when storage is unavailable.
      });
    return () => {
      current = false;
    };
  }, [active]);

  const change = useCallback(
    (id: ProjectId) => {
      setActiveProjectId(id);
      setActive(id);
      const parts = location.pathname.split("/");
      const tool = parts[3];
      if (parts[1] === "projects" && parts[2] && tool && tool !== "") {
        void navigate({ to: "/projects/$projectId/$tool", params: { projectId: id, tool } });
      } else {
        void navigate({ to: "/projects/$projectId", params: { projectId: id } });
      }
    },
    [location.pathname, navigate],
  );

  return (
    <label className={`project-switcher${collapsed ? " project-switcher-compact" : ""}`}>
      <FolderOpen size={15} aria-hidden="true" />
      <span className="project-switcher-label">Project</span>
      <Select
        aria-label="Active project"
        title={active ? `Active project: ${active}` : "Select a project"}
        value={active ?? ""}
        placeholder="Select project"
        options={projects.map((project) => ({ value: project.id, label: project.name }))}
        onChange={(event) => change(event.currentTarget.value as ProjectId)}
      />
    </label>
  );
}
