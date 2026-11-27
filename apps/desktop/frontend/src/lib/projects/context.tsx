import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useDesktopFlush } from "../flush";
import { getProjectClient } from "./client";
import type { ProjectId, ProjectSummary, ToolId } from "./types";

interface ProjectScope {
  projectId: ProjectId;
  project: ProjectSummary | null;
  refresh: () => Promise<void>;
}

const ProjectContext = createContext<ProjectScope | null>(null);

export function ProjectProvider({
  projectId,
  children,
}: {
  projectId: ProjectId;
  children: ReactNode;
}) {
  const [project, setProject] = useState<ProjectSummary | null>(null);

  const refresh = useCallback(async () => {
    const projects = await getProjectClient().listProjects();
    setProject(projects.find((item) => item.id === projectId) ?? null);
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ProjectContext.Provider value={{ projectId, project, refresh }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectScope {
  const scope = useContext(ProjectContext);
  if (!scope) throw new Error("ProjectProvider is missing");
  return scope;
}

/** Loads and autosaves one tool document inside the active project. */
export function useProjectDocument<T>(tool: ToolId, fallback: T) {
  const { projectId } = useProject();
  const [data, setData] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  const latest = useRef<T>(fallback);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    let active = true;
    setReady(false);
    dirty.current = false;
    if (timer.current !== null) window.clearTimeout(timer.current);
    void getProjectClient()
      .getDocument<T>(projectId, tool)
      .then((document) => {
        if (!active) return;
        const value = document?.data ?? fallbackRef.current;
        latest.current = value;
        setData(value);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        latest.current = fallbackRef.current;
        setData(fallbackRef.current);
        setReady(true);
      });
    return () => {
      active = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (dirty.current) void saveRef.current();
    };
  }, [projectId, tool]);

  const saveNow = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current || !ready) return true;
    try {
      await getProjectClient().saveDocument(projectId, tool, latest.current);
      dirty.current = false;
      return true;
    } catch {
      return false;
    }
  }, [projectId, ready, tool]);

  const saveRef = useRef(saveNow);
  saveRef.current = saveNow;

  useDesktopFlush("projects", saveNow);

  useEffect(() => {
    const flushOnHide = () => {
      void saveRef.current();
    };
    window.addEventListener("pagehide", flushOnHide);
    return () => window.removeEventListener("pagehide", flushOnHide);
  }, []);

  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      const previous = latest.current;
      const value = typeof next === "function" ? (next as (current: T) => T)(previous) : next;
      latest.current = value;
      dirty.current = true;
      setData(value);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void saveNow(), 600);
    },
    [saveNow],
  );

  return { data, update, saveNow, ready };
}
