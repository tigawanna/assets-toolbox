import type { EventLog, NewEventInput, EventRecord } from "../../model/events";
import type { AssetRecord, ExportSettings, StudioProject } from "../../model/schema";

export interface AssetRecordDTO extends AssetRecord {
  id: string;
  /** Browser-usable URL for the imported bytes. */
  url: string;
}

export interface ExportRequest {
  project: StudioProject;
  boardIds: string[];
  settings: ExportSettings;
}

export interface ExportedFile {
  path: string;
  bytes: number;
  width: number;
  height: number;
}

export interface ExportReport {
  files: ExportedFile[];
  warnings: string[];
  zipPath?: string;
}

export type HostEvent = { type: "project-changed" } | { type: "assets-changed"; file: string };

/**
 * The only way UI code reaches a host. HTTP today, Wails later, memory in tests.
 */
export interface StudioHost {
  readProject(): Promise<StudioProject>;
  writeProject(project: StudioProject): Promise<void>;
  importAsset(file: File): Promise<AssetRecordDTO>;
  assetUrl(file: string): string;
  exportSlice(input: { boardId: string; index: number; png: Blob }): Promise<void>;
  finishExport(input: ExportRequest): Promise<ExportReport>;
  /** Append-only edit log, portable across machines. */
  readEvents(): Promise<EventLog | null>;
  appendEvent(input: NewEventInput): Promise<EventRecord>;
  /** Returns an unsubscribe function. */
  subscribe(listener: (event: HostEvent) => void): () => void;
  /** Native dialog where the host has one; HTTP returns null so the UI uses <input>. */
  pickFiles?(options: { multiple: boolean; filters: string[] }): Promise<File[] | null>;
}
