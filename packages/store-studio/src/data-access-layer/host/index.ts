import { httpHost } from "./http";
import type { StudioHost } from "./types";
import { wailsHost } from "./wails";

let hostOverride: StudioHost | null = null;

export function isWails(): boolean {
  return typeof window !== "undefined" && "runtime" in window;
}

/** Tests inject the in-memory host here; the app never calls it. */
export function setHost(host: StudioHost | null): void {
  hostOverride = host;
}

export function getHost(): StudioHost {
  return hostOverride ?? (isWails() ? wailsHost : httpHost);
}

export type {
  AssetRecordDTO,
  ExportReport,
  ExportRequest,
  ExportedFile,
  HostEvent,
  StudioHost,
} from "./types";
export { httpHost } from "./http";
export { MemoryHost, memoryHost } from "./memory";
export { wailsHost, wailsBinding } from "./wails";
