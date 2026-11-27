export type ToolId = "compose" | "brand" | "expo" | "studio" | "sound" | "inspect";
export type ProjectId = `p_${string}`;
export type AssetId = `a_${string}`;

export const TOOL_IDS: readonly ToolId[] = [
  "compose",
  "brand",
  "expo",
  "studio",
  "sound",
  "inspect",
];

export interface ProjectSummary {
  id: ProjectId;
  name: string;
  updatedAt: string;
  lastOpenedAt?: string;
  path?: string;
  counts: { assets: number; tools: number };
}

export interface ProjectManifest {
  id: ProjectId;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  settings: { defaultOutDir: string; theme?: "light" | "dark" };
}

export interface ModuleRecord<T = unknown> {
  projectId: ProjectId;
  tool: ToolId;
  data: T;
  updatedAt: string;
}

export type AssetKind = "source" | "generated" | "export" | "download";

export interface AssetRecord {
  id: AssetId;
  projectId: ProjectId;
  name: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  hash: string;
  kind: AssetKind;
  origin?: { tool: ToolId; derivedFrom?: AssetId };
  tags: string[];
  refs: ModuleRef[];
  createdAt: string;
}

export interface ModuleRef {
  tool: ToolId;
  field: string;
}

export interface AssetMoveRequest {
  assetIds: AssetId[];
  targetProjectId: ProjectId;
  mode: "copy" | "move";
  includeDerived: boolean;
}

const PROJECT_ID = /^p_[0-9a-f]{12}$/;
const ASSET_ID = /^a_[0-9a-f]{16}$/;

export function isProjectId(value: string): value is ProjectId {
  return PROJECT_ID.test(value);
}

export function isAssetId(value: string): value is AssetId {
  return ASSET_ID.test(value);
}

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

export function isAssetRecord(value: unknown): value is AssetRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<AssetRecord>;
  return (
    typeof record.id === "string" &&
    isAssetId(record.id) &&
    typeof record.projectId === "string" &&
    isProjectId(record.projectId) &&
    typeof record.name === "string" &&
    typeof record.mime === "string" &&
    typeof record.bytes === "number" &&
    typeof record.hash === "string" &&
    typeof record.createdAt === "string" &&
    Array.isArray(record.tags) &&
    Array.isArray(record.refs)
  );
}
