import { getPreset } from "@tigawanna/play-screenshots/sizes";

import { createDefaultProject } from "../../model/migrate";
import {
  createBaseRecord,
  isEventRecord,
  type EventLog,
  type EventRecord,
  type NewEventInput,
} from "../../model/events";
import type { StudioProject } from "../../model/schema";
import type { AssetRecordDTO, ExportReport, ExportRequest, HostEvent, StudioHost } from "./types";

interface StoredAsset {
  file: string;
  url: string;
  bytes: number;
  record: AssetRecordDTO;
}

/** In-memory host. Used by tests and Storybook; proves the UI is host-independent. */
export class MemoryHost implements StudioHost {
  private project: StudioProject;
  private readonly assets = new Map<string, StoredAsset>();
  private readonly slices = new Map<string, Blob>();
  private readonly listeners = new Set<(event: HostEvent) => void>();
  private readonly urls = new Set<string>();
  private eventLog: EventLog | null = null;

  constructor(project: StudioProject = createDefaultProject()) {
    this.project = structuredClone(project);
  }

  async readProject(): Promise<StudioProject> {
    return structuredClone(this.project);
  }

  async writeProject(project: StudioProject): Promise<void> {
    this.project = structuredClone(project);
    this.emit({ type: "project-changed" });
  }

  async importAsset(file: File): Promise<AssetRecordDTO> {
    const key = `${Date.now()}-${file.name}`;
    const bytes = file.size;
    let width = 1080;
    let height = 1920;
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      } catch {
        /* keep the fallback dimensions */
      }
    }
    const url =
      typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(file)
        : `data:${file.type || "image/png"};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    if (url.startsWith("blob:")) this.urls.add(url);
    const record: AssetRecordDTO = {
      id: key,
      file: key,
      url,
      width,
      height,
      kind: "screenshot",
      intrinsic: { width, height },
    };
    this.assets.set(key, { file: key, url, bytes, record });
    this.emit({ type: "assets-changed", file: key });
    return record;
  }

  assetUrl(file: string): string {
    return this.assets.get(file)?.url ?? "";
  }

  async exportSlice(input: { boardId: string; index: number; png: Blob }): Promise<void> {
    this.slices.set(`${input.boardId}:${input.index}`, input.png);
  }

  async readEvents(): Promise<EventLog | null> {
    return this.eventLog === null ? null : structuredClone(this.eventLog);
  }

  async appendEvent(input: NewEventInput): Promise<EventRecord> {
    if (this.eventLog === null) {
      this.eventLog = { version: 1, records: [createBaseRecord(this.project)] };
    }
    const previous = this.eventLog.records.filter(isEventRecord).at(-1)?.seq ?? 0;
    const record: EventRecord = { kind: "event", seq: previous + 1, ...input };
    this.eventLog.records.push(record);
    return structuredClone(record);
  }

  async finishExport(input: ExportRequest): Promise<ExportReport> {
    const files: ExportReport["files"] = [];
    for (const board of input.project.boards) {
      if (!input.boardIds.includes(board.id)) continue;
      const preset = getPreset(board.preset);
      for (let index = 0; index < board.sliceCount; index += 1) {
        const blob = this.slices.get(`${board.id}:${index}`);
        files.push({
          path: `${input.settings.outDir}/${String(index + 1).padStart(2, "0")}-${board.preset}.${input.settings.format === "jpeg" ? "jpg" : "png"}`,
          bytes: blob?.size ?? 0,
          width: preset.width,
          height: preset.height,
        });
      }
    }
    return { files, warnings: [] };
  }

  subscribe(listener: (event: HostEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Test helper: fire a host event as if the file on disk changed. */
  emit(event: HostEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  /** Test helper: list imported assets. */
  listAssets(): AssetRecordDTO[] {
    return [...this.assets.values()].map((asset) => asset.record);
  }

  dispose(): void {
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}

export const memoryHost = new MemoryHost();
