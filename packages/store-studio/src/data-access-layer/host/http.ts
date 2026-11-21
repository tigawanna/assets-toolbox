import { migrateProject } from "../../model/migrate";
import type { EventLog, EventRecord, NewEventInput } from "../../model/events";
import type { StudioProject } from "../../model/schema";
import type { AssetRecordDTO, ExportReport, ExportRequest, HostEvent, StudioHost } from "./types";

/** Fetch/SSE implementation used by `npx` and by headless Playwright. */
export class HttpHost implements StudioHost {
  constructor(private readonly base = "") {}

  private url(path: string): string {
    return `${this.base}${path}`;
  }

  async readProject(): Promise<StudioProject> {
    const response = await fetch(this.url("/api/project"));
    if (!response.ok) throw new Error(`readProject failed: ${response.status}`);
    return migrateProject(await response.json());
  }

  async writeProject(project: StudioProject): Promise<void> {
    const response = await fetch(this.url("/api/project"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project),
    });
    if (!response.ok) throw new Error(`writeProject failed: ${response.status}`);
  }

  async importAsset(file: File): Promise<AssetRecordDTO> {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(this.url("/api/assets"), { method: "POST", body: form });
    if (!response.ok) throw new Error(`importAsset failed: ${response.status}`);
    return (await response.json()) as AssetRecordDTO;
  }

  assetUrl(file: string): string {
    return this.url(`/api/assets/${encodeURIComponent(file)}`);
  }

  async exportSlice(input: { boardId: string; index: number; png: Blob }): Promise<void> {
    const form = new FormData();
    form.append("boardId", input.boardId);
    form.append("index", String(input.index));
    form.append("png", input.png, `slice-${input.index}.png`);
    const response = await fetch(this.url("/api/export/slice"), { method: "POST", body: form });
    if (!response.ok) throw new Error(`exportSlice failed: ${response.status}`);
  }

  async readEvents(): Promise<EventLog | null> {
    const response = await fetch(this.url("/api/events-log"));
    if (!response.ok) throw new Error(`readEvents failed: ${response.status}`);
    return ((await response.json()) as { log: EventLog | null }).log;
  }

  async appendEvent(input: NewEventInput): Promise<EventRecord> {
    const response = await fetch(this.url("/api/events-log"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`appendEvent failed: ${response.status}`);
    return (await response.json()) as EventRecord;
  }

  async finishExport(input: ExportRequest): Promise<ExportReport> {
    const response = await fetch(this.url("/api/export/finish"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`finishExport failed: ${response.status}`);
    return (await response.json()) as ExportReport;
  }

  subscribe(listener: (event: HostEvent) => void): () => void {
    if (typeof EventSource === "undefined") return () => {};
    const source = new EventSource(this.url("/api/events"));
    const handle = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as HostEvent;
        listener(data);
      } catch {
        /* ignore malformed events */
      }
    };
    source.addEventListener("message", handle as EventListener);
    source.addEventListener("project-changed", handle as EventListener);
    source.addEventListener("assets-changed", handle as EventListener);
    return () => source.close();
  }
}

export const httpHost = new HttpHost();
