import { basename } from "node:path";

export interface LiveEvent {
  type: "hello" | "change" | "ping";
  projectId: string;
  seq?: number;
  label?: string;
}

type Listener = (event: LiveEvent) => void;

const listeners = new Set<{ projectId: string; send: Listener }>();

export function projectIdFromDatabasePath(path: string): string {
  return basename(path, ".sqlite");
}

export function subscribeLive(projectId: string, send: Listener): () => void {
  const entry = { projectId, send };
  listeners.add(entry);
  return () => {
    listeners.delete(entry);
  };
}

export function publishLive(projectId: string, seq: number, label: string): void {
  const event: LiveEvent = { type: "change", projectId, seq, label };
  for (const entry of listeners) {
    if (entry.projectId !== "" && entry.projectId !== projectId) continue;
    try {
      entry.send(event);
    } catch {
      listeners.delete(entry);
    }
  }
}
