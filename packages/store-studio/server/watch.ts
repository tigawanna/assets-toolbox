import chokidar from "chokidar";

import type { HostEvent } from "../src/data-access-layer/host/types";
import type { ProjectPaths } from "./project-io";

export type EventBus = {
  publish: (event: HostEvent) => void;
  subscribe: (listener: (event: HostEvent) => void) => () => void;
};

export function createEventBus(): EventBus {
  const listeners = new Set<(event: HostEvent) => void>();
  return {
    publish: (event) => {
      for (const listener of listeners) listener(event);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Watch project.json and assets; emit host events over SSE. */
export function watchProject(paths: ProjectPaths, bus: EventBus): () => void {
  const watcher = chokidar.watch([paths.file, paths.assets], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });
  watcher.on("all", (event, path) => {
    if (path === paths.file) bus.publish({ type: "project-changed" });
    else if (event !== "unlink" && event !== "unlinkDir")
      bus.publish({ type: "assets-changed", file: path });
  });
  return () => void watcher.close();
}
