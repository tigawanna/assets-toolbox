import { StudioProjectSchema, type StudioProject } from "./schema";

/**
 * Append-only, portable edit log. Each event carries a JSON-patch-like diff of
 * the plain document between two finished gestures. Replaying the log onto its
 * base snapshot reproduces the project on another machine.
 */

export const EVENT_LOG_VERSION = 1 as const;
export type PatchPath = Array<string | number>;

export interface PatchOp {
  op: "set" | "unset";
  path: PatchPath;
  value?: unknown;
}

export interface BaseRecord {
  kind: "base";
  ts: string;
  project: StudioProject;
}

export interface EventRecord {
  kind: "event";
  seq: number;
  id: string;
  ts: string;
  actor: string;
  label?: string | undefined;
  parentSeq: number;
  patch: PatchOp[];
}

export type LogRecord = BaseRecord | EventRecord;

export interface EventLog {
  version: typeof EVENT_LOG_VERSION;
  records: LogRecord[];
}

export interface NewEventInput {
  id: string;
  ts: string;
  actor: string;
  label?: string | undefined;
  parentSeq: number;
  patch: PatchOp[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Minimal structural diff. Arrays are replaced wholesale; objects recurse by key. */
export function diffDocuments(before: unknown, after: unknown, path: PatchPath = []): PatchOp[] {
  if (Object.is(before, after)) return [];
  if (isRecord(before) && isRecord(after)) {
    const ops: PatchOp[] = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const oldValue = before[key];
      const newValue = after[key];
      if (newValue === undefined) {
        if (oldValue !== undefined) ops.push({ op: "unset", path: [...path, key] });
      } else if (oldValue === undefined) {
        ops.push({ op: "set", path: [...path, key], value: newValue });
      } else {
        ops.push(...diffDocuments(oldValue, newValue, [...path, key]));
      }
    }
    return ops;
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [{ op: "set", path, value: after }];
}

/** Apply a patch to a clone of a document. Never mutates the input. */
export function applyPatch<T>(document: T, patch: PatchOp[]): T {
  const root = structuredClone(document) as Record<string, unknown>;
  for (const op of patch) {
    if (op.path.length === 0) {
      if (op.op === "set") return structuredClone(op.value) as T;
      continue;
    }
    let cursor: Record<string, unknown> | unknown[] = root;
    for (let index = 0; index < op.path.length - 1; index += 1) {
      const key = op.path[index]!;
      const existing = (cursor as Record<string, unknown>)[key];
      if (existing === null || typeof existing !== "object") {
        (cursor as Record<string, unknown>)[key] = typeof op.path[index + 1] === "number" ? [] : {};
      }
      cursor = (cursor as Record<string, unknown>)[key] as Record<string, unknown> | unknown[];
    }
    const last = op.path[op.path.length - 1]!;
    if (op.op === "unset") {
      if (Array.isArray(cursor)) {
        if (typeof last === "number") cursor.splice(last, 1);
      } else {
        delete cursor[last];
      }
    } else if (Array.isArray(cursor) && typeof last === "number") {
      cursor[last] = structuredClone(op.value);
    } else {
      (cursor as Record<string, unknown>)[String(last)] = structuredClone(op.value);
    }
  }
  return root as T;
}

export function createBaseRecord(
  project: StudioProject,
  ts = new Date().toISOString(),
): BaseRecord {
  return { kind: "base", ts, project: structuredClone(project) };
}

export function encodeLog(log: EventLog): string {
  return `${log.records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

export function decodeLog(text: string): EventLog {
  const records = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as LogRecord);
  if (records[0]?.kind !== "base") throw new Error("Event log must start with a base record");
  return { version: EVENT_LOG_VERSION, records };
}

/** Rebuild a project from its base snapshot plus every event in sequence. */
export function replayLog(log: EventLog): StudioProject {
  const base = log.records.find((record): record is BaseRecord => record.kind === "base");
  if (base === undefined) throw new Error("Event log has no base record");
  let project = structuredClone(base.project);
  let expected = 1;
  const events = log.records
    .filter((record): record is EventRecord => record.kind === "event")
    .sort((a, b) => a.seq - b.seq);
  for (const event of events) {
    if (event.seq !== expected) {
      throw new Error(`Event log gap: expected seq ${expected}, found ${event.seq}`);
    }
    project = applyPatch(project, event.patch);
    expected += 1;
  }
  return StudioProjectSchema.parse(project);
}

export function isEventRecord(record: LogRecord): record is EventRecord {
  return record.kind === "event";
}
