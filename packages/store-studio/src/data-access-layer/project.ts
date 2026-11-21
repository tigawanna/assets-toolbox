import { getHost } from "./host";
import { initEvents, recordEvent, type EventMeta } from "./events";
import { createDefaultProject } from "../model/migrate";
import type { StudioProject } from "../model/schema";

let current: StudioProject | null = null;
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const externalListeners = new Set<() => void>();
let onExternalChange: (() => void) | undefined;

function notify(): void {
  for (const listener of listeners) listener();
}

function invalidate(): void {
  for (const listener of externalListeners) listener();
}

export function getCurrentProject(): StudioProject {
  if (current === null) current = createDefaultProject();
  return current;
}

/** Stable snapshot for `useSyncExternalStore`. */
let snapshot: StudioProject = getCurrentProject();
function getSnapshot(): StudioProject {
  return snapshot;
}
export function subscribeProject(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function subscribeCollections(listener: () => void): () => void {
  externalListeners.add(listener);
  return () => externalListeners.delete(listener);
}

function commit(next: StudioProject): void {
  current = next;
  snapshot = next;
  notify();
  invalidate();
}

export async function loadProject(): Promise<StudioProject> {
  const project = await getHost().readProject();
  initEvents(
    await getHost()
      .readEvents()
      .catch(() => null),
  );
  commit(project);
  loaded = true;
  if (onExternalChange === undefined) {
    onExternalChange = () => {
      void getHost()
        .readProject()
        .then((fresh) => {
          // Only adopt external edits when there is no pending local save.
          if (saveTimer === undefined) commit(fresh);
        })
        .catch(() => {});
    };
    getHost().subscribe((event) => {
      if (event.type === "project-changed") onExternalChange?.();
    });
  }
  return project;
}

export function isLoaded(): boolean {
  return loaded;
}

/** Apply a mutation to the plain document. One call = one history entry. */
export function updateProject(mutator: (draft: StudioProject) => void, meta?: EventMeta): void {
  const before = getCurrentProject();
  const draft = structuredClone(before);
  mutator(draft);
  commit(draft);
  scheduleSave();
  void recordEvent(before, draft, meta);
}

export function scheduleSave(): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void saveNow();
  }, 500);
}

export async function saveNow(): Promise<void> {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  await getHost().writeProject(getCurrentProject());
}

export { getSnapshot };
