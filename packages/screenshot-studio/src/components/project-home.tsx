import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Download, Plus } from "lucide-react";

import { downloadSnapshotsZip } from "@/canvas/export-slices";
import { ScreenshotStudioIcon } from "@/components/brand-icon";
import { BoardCloneMenu } from "@/components/board-clone-menu";
import { SettingsDrawer } from "@/components/settings-drawer";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { fileSlug, storeLabel } from "@/lib/store-rules";
import type { StoreName } from "@/lib/studio";
import {
  cloneBoard,
  createBoard,
  deleteBoard,
  focusBoard,
  listBoards,
  loadStudio,
  type ProjectSummary,
} from "@/server/fns";

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export type ProjectHomeProps = {
  onOpenBoard?: (projectId: string) => void | Promise<void>;
};

export function ProjectHome(props: ProjectHomeProps) {
  return props.onOpenBoard ? (
    <ProjectHomeContent onOpenBoard={props.onOpenBoard} embedded />
  ) : (
    <RoutedProjectHome />
  );
}

function RoutedProjectHome() {
  const navigate = useNavigate();
  return (
    <ProjectHomeContent
      onOpenBoard={(projectId) => navigate({ to: "/board/$projectId", params: { projectId } })}
      embedded={false}
    />
  );
}

function ProjectHomeContent({
  onOpenBoard,
  embedded,
}: {
  onOpenBoard: (projectId: string) => void | Promise<void>;
  embedded: boolean;
}) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    void refresh();
    void focusBoard({ data: { projectId: null } });
  }, []);

  async function refresh() {
    try {
      setProjects(await listBoards());
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not list boards");
    }
  }

  async function create(name = "Untitled") {
    setCreating(true);
    setError("");
    try {
      const project = await createBoard({ data: { name } });
      await onOpenBoard(project.id);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not create a board");
      setCreating(false);
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await deleteBoard({ data: { projectId: id } });
      setProjects((current) => current?.filter((project) => project.id !== id) ?? []);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not delete");
    }
  }

  async function clone(id: string, store?: StoreName) {
    setBusy(`clone:${id}`);
    setError("");
    try {
      await cloneBoard({ data: { projectId: id, store } });
      await refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not clone");
    } finally {
      setBusy("");
    }
  }

  async function exportOne(project: ProjectSummary) {
    setBusy(`export:${project.id}`);
    setError("");
    try {
      const snapshot = await loadStudio({ data: { projectId: project.id } });
      await downloadSnapshotsZip([snapshot], `${fileSlug(project.name)}.zip`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not export");
    } finally {
      setBusy("");
    }
  }

  async function exportAll() {
    if (projects === null || projects.length === 0) return;
    setBusy("export-all");
    setError("");
    try {
      const snapshots = [];
      for (const project of projects) {
        snapshots.push(await loadStudio({ data: { projectId: project.id } }));
      }
      await downloadSnapshotsZip(snapshots, "screenshot-studio-boards.zip");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not export");
    } finally {
      setBusy("");
    }
  }

  const empty = projects !== null && projects.length === 0;
  const locked = creating || busy !== "";

  return (
    <div
      className={`${embedded ? "screenshot-studio-root h-full min-h-0 overflow-y-auto" : "min-h-svh"} bg-background text-foreground`}
    >
      {embedded ? (
        <header data-studio-home-header>
          <div data-studio-home-identity>
            <ScreenshotStudioIcon className="size-5" />
            <div>
              <strong>Screenshot Studio</strong>
              <span>
                {projects === null
                  ? "Boards · local storage"
                  : `${projects.length} boards · local storage`}
              </span>
            </div>
          </div>
          <div data-studio-home-actions>
            {projects === null || empty ? null : (
              <Button
                variant="outline"
                size="xs"
                disabled={locked}
                data-testid="export-all-boards"
                onClick={() => void exportAll()}
              >
                <Download />
                Export all
              </Button>
            )}
            <Button size="xs" disabled={locked} onClick={() => void create()}>
              <Plus />
              New board
            </Button>
            <SettingsDrawer embedded />
          </div>
        </header>
      ) : (
        <header className="flex h-12 items-center justify-between border-b border-border px-6">
          <strong className="flex items-center gap-2 text-sm tracking-tight">
            <ScreenshotStudioIcon className="size-6" />
            Screenshot Studio
          </strong>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <SettingsDrawer />
          </div>
        </header>
      )}
      <main className={`mx-auto w-full max-w-3xl px-6 ${embedded ? "py-6" : "py-16"}`}>
        {error === "" ? null : <p className="mt-4 text-sm text-destructive">{error}</p>}
        {projects === null ? (
          <p className="mt-16 text-sm text-muted-foreground">Loading boards…</p>
        ) : null}
        {empty ? (
          <div
            className="mt-16 max-w-xl rounded-2xl border border-primary/25 bg-primary/5 px-8 py-12"
            data-testid="empty-boards"
          >
            <p className="text-2xl leading-tight font-medium tracking-tight text-foreground">
              Start with a mixed-store board.
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Stack an Android and iPhone on the same slice. Clone the collection for Apple or
              Android when the stores need their own scenes.
            </p>
            <Button className="mt-8" size="lg" disabled={creating} onClick={() => void create()}>
              <Plus />
              Create your first board
            </Button>
          </div>
        ) : null}
        {projects !== null && !empty ? (
          <ul className="mt-12 divide-y divide-border border-y border-border">
            {projects.map((project) => (
              <li key={project.id} className="group flex items-center gap-3 py-4">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => void onOpenBoard(project.id)}
                >
                  <span className="flex items-center gap-2 text-base text-foreground group-hover:text-primary">
                    {project.name}
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs tracking-wide text-muted-foreground uppercase">
                      {storeLabel(project.store)}
                    </span>
                    <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100" />
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {project.presetLabel} · {project.sliceCount} slices · {project.nodeCount} layers
                    · {relativeTime(project.updatedAt)}
                  </span>
                </button>
                <BoardCloneMenu
                  align="right"
                  disabled={locked}
                  onDuplicate={() => void clone(project.id)}
                  onCloneStore={(store) => void clone(project.id, store)}
                />
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={locked}
                  title="Download every scene in this collection"
                  onClick={() => void exportOne(project)}
                >
                  <Download />
                  {busy === `export:${project.id}` ? "Exporting" : "Export"}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={locked}
                  onClick={() => void remove(project.id)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
