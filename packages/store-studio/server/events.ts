import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createBaseRecord,
  decodeLog,
  encodeLog,
  isEventRecord,
  type EventLog,
  type EventRecord,
  type NewEventInput,
  type PatchOp,
} from "../src/model/events";
import { projectPaths, readProject } from "./project-io";

export function eventsPath(root: string): string {
  return resolve(root, "events.jsonl");
}

export function readEvents(root: string): EventLog | null {
  const file = eventsPath(root);
  if (!existsSync(file)) return null;
  return decodeLog(readFileSync(file, "utf8"));
}

function validatePatch(patch: unknown): asserts patch is PatchOp[] {
  if (!Array.isArray(patch)) throw new Error("Event patch must be an array");
  for (const op of patch) {
    if (op === null || typeof op !== "object") throw new Error("Invalid patch operation");
    const candidate = op as Partial<PatchOp>;
    if ((candidate.op !== "set" && candidate.op !== "unset") || !Array.isArray(candidate.path)) {
      throw new Error("Invalid patch operation: expected op set|unset and a path array");
    }
  }
}

/** Append one event, creating the base snapshot from project.json on first use. */
export function appendEvent(root: string, input: NewEventInput): EventRecord {
  validatePatch(input.patch);
  const file = eventsPath(root);
  let log = readEvents(root);
  if (log === null) {
    log = { version: 1, records: [createBaseRecord(readProject(projectPaths(root)))] };
    writeFileSync(file, encodeLog(log));
  }
  const previous = log.records.filter(isEventRecord).at(-1)?.seq ?? 0;
  const record: EventRecord = {
    kind: "event",
    seq: previous + 1,
    id: input.id,
    ts: input.ts,
    actor: input.actor,
    parentSeq: input.parentSeq,
    patch: input.patch,
    ...(input.label === undefined ? {} : { label: input.label }),
  };
  appendFileSync(file, `${JSON.stringify(record)}\n`);
  return record;
}
