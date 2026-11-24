import { readFileSync } from "node:fs";
import { extname, basename } from "node:path";

import { DEVICE_MODEL_IDS, type DeviceModelId } from "@/devices/catalog";
import { boardCollections } from "@/lib/scenes";
import { writeBoardFill, type StoreName } from "@/lib/studio";

import {
  addAsset,
  addDevice,
  addText,
  applyBoardStore,
  cloneCollection,
  removeCollection,
  updateBoard,
  updateNode,
} from "./mutations";
import { describeOpenBoard } from "./open-board";
import { createProject, listProjects, resolveStudioPath } from "./projects";
import { readStudio } from "./queries";

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

const PROTOCOL = "2024-11-05";

const TOOLS = [
  {
    name: "list_boards",
    description: "List Screenshot Studio boards (name, store, slice count, file id).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_open_board",
    description:
      "Which board the studio UI is looking at right now (last focused tab). Use this before mutating if the user did not pass a projectId.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_board",
    description:
      "Read one board: scene strips, layers, and the latest event sequence. Omits image bytes. If projectId is omitted, uses the board currently open in the UI.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "create_board",
    description: "Create an empty mixed-store board and return its id.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
    },
  },
  {
    name: "clone_collection",
    description:
      "Duplicate a scene strip onto the same board. Pass store app-store or play to retarget devices.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        collectionId: { type: "string" },
        store: { type: "string", enum: ["play", "app-store"] },
      },
      required: ["projectId", "collectionId"],
    },
  },
  {
    name: "delete_collection",
    description: "Delete a scene strip and its layers. The last remaining strip cannot be deleted.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        collectionId: { type: "string" },
      },
      required: ["projectId", "collectionId"],
    },
  },
  {
    name: "apply_store_rules",
    description: "Resize a scene strip and swap device family for Apple or Android listing rules.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        store: { type: "string", enum: ["play", "app-store"] },
        collectionId: { type: "string" },
      },
      required: ["projectId", "store"],
    },
  },
  {
    name: "add_device",
    description:
      "Place a device on a slice. Android models: phone-punch, phone-flat, tablet, foldable-open, foldable-cover.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        model: { type: "string" },
        slice: { type: "number" },
        collectionId: { type: "string" },
      },
      required: ["projectId", "model"],
    },
  },
  {
    name: "add_text",
    description: "Add a headline or subtext on a slice.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        role: { type: "string", enum: ["headline", "subtext"] },
        slice: { type: "number" },
        collectionId: { type: "string" },
      },
      required: ["projectId", "role"],
    },
  },
  {
    name: "add_asset",
    description: "Import an image from a local file path into the board library. Returns assetId.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        path: { type: "string" },
      },
      required: ["projectId", "path"],
    },
  },
  {
    name: "update_board",
    description:
      "Rename the board or a scene strip, set slice count, store, or a solid background.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        collectionId: { type: "string" },
        name: { type: "string" },
        store: { type: "string", enum: ["play", "app-store"] },
        presetId: { type: "string" },
        sliceCount: { type: "number" },
        background: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "patch_node",
    description: "Edit a layer: text, screenAssetId, position, hidden, name.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        id: { type: "string" },
        patch: { type: "object" },
        label: { type: "string" },
      },
      required: ["projectId", "id", "patch"],
    },
  },
] as const;

function ok(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function fail(id: RpcRequest["id"], message: string, code = -32000) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asStore(value: unknown): StoreName | undefined {
  return value === "play" || value === "app-store" ? value : undefined;
}

function asModel(value: unknown): DeviceModelId {
  if (typeof value !== "string" || !(DEVICE_MODEL_IDS as string[]).includes(value)) {
    throw new Error(`Unknown device ${String(value)}`);
  }
  return value as DeviceModelId;
}

function mimeFor(file: string): string {
  const ext = extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

function fileToDataUrl(file: string): { name: string; mime: string; data: string } {
  const mime = mimeFor(file);
  const bytes = readFileSync(file);
  return {
    name: basename(file),
    mime,
    data: `data:${mime};base64,${bytes.toString("base64")}`,
  };
}

async function callTool(name: string, raw: unknown): Promise<unknown> {
  const params = asObject(raw);
  if (name === "list_boards") return listProjects();
  if (name === "create_board") {
    const nameValue = typeof params.name === "string" ? params.name : "Untitled";
    return createProject(nameValue);
  }
  if (name === "get_open_board") return describeOpenBoard();
  let projectId = typeof params.projectId === "string" ? params.projectId : "";
  if (projectId === "") {
    const open = describeOpenBoard();
    if (open.open && typeof open.projectId === "string") projectId = open.projectId;
  }
  if (projectId === "") throw new Error("projectId is required");
  const path = resolveStudioPath(projectId);
  if (name === "get_board") {
    const snapshot = readStudio(path);
    return {
      id: projectId,
      board: snapshot.board,
      collections: boardCollections(snapshot.board),
      nodes: snapshot.nodes,
      eventCount: snapshot.events.length,
      assetCount: snapshot.assets.length,
    };
  }
  if (name === "clone_collection") {
    const collectionId = typeof params.collectionId === "string" ? params.collectionId : "";
    if (collectionId === "") throw new Error("collectionId is required");
    const snapshot = cloneCollection(collectionId, asStore(params.store), path);
    return { id: projectId, collections: boardCollections(snapshot.board) };
  }
  if (name === "delete_collection") {
    const collectionId = typeof params.collectionId === "string" ? params.collectionId : "";
    if (collectionId === "") throw new Error("collectionId is required");
    const snapshot = removeCollection(collectionId, path);
    return { id: projectId, collections: boardCollections(snapshot.board) };
  }
  if (name === "apply_store_rules") {
    const store = asStore(params.store);
    if (store === undefined) throw new Error("store must be play or app-store");
    const collectionId = typeof params.collectionId === "string" ? params.collectionId : undefined;
    const snapshot = applyBoardStore(store, path, collectionId);
    return { id: projectId, collections: boardCollections(snapshot.board) };
  }
  if (name === "add_device") {
    const snapshot = addDevice(
      asModel(params.model),
      typeof params.slice === "number" ? params.slice : 0,
      path,
      typeof params.collectionId === "string" ? params.collectionId : undefined,
    );
    const node = snapshot.nodes[snapshot.nodes.length - 1];
    return { id: projectId, nodeId: node?.id, node };
  }
  if (name === "add_text") {
    const role = params.role === "subtext" ? "subtext" : "headline";
    const snapshot = addText(
      role,
      typeof params.slice === "number" ? params.slice : 0,
      path,
      typeof params.collectionId === "string" ? params.collectionId : undefined,
    );
    const node = snapshot.nodes[snapshot.nodes.length - 1];
    return { id: projectId, nodeId: node?.id, node };
  }
  if (name === "add_asset") {
    if (typeof params.path !== "string" || params.path === "") throw new Error("path is required");
    const file = fileToDataUrl(params.path);
    const snapshot = addAsset(file.name, file.mime, file.data, path);
    return { id: projectId, assetId: snapshot.assetId, name: file.name };
  }
  if (name === "update_board") {
    let background: string | undefined;
    if (typeof params.background === "string") {
      background = params.background.startsWith("#")
        ? writeBoardFill({ color: params.background, bands: [] })
        : params.background;
    }
    const snapshot = updateBoard(
      {
        collectionId: typeof params.collectionId === "string" ? params.collectionId : undefined,
        name: typeof params.name === "string" ? params.name : undefined,
        store: asStore(params.store),
        presetId: typeof params.presetId === "string" ? params.presetId : undefined,
        sliceCount: typeof params.sliceCount === "number" ? params.sliceCount : undefined,
        background,
      },
      path,
    );
    return { id: projectId, board: snapshot.board, collections: boardCollections(snapshot.board) };
  }
  if (name === "patch_node") {
    const nodeId = typeof params.id === "string" ? params.id : "";
    if (nodeId === "") throw new Error("id is required");
    const patch = asObject(params.patch);
    const snapshot = updateNode(
      nodeId,
      patch,
      typeof params.label === "string" ? params.label : "Edit",
      "edit",
      path,
    );
    return { id: projectId, node: snapshot.nodes.find((node) => node.id === nodeId) };
  }
  throw new Error(`Unknown tool ${name}`);
}

/** JSON-RPC 2.0 handler for Streamable HTTP MCP on /mcp. */
export async function handleMcpMessage(message: RpcRequest): Promise<object | null> {
  const method = message.method ?? "";
  if (method === "notifications/initialized" || method.startsWith("notifications/")) return null;
  if (method === "initialize") {
    return ok(message.id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "screenshot-studio", version: "0.1.0" },
    });
  }
  if (method === "ping") return ok(message.id, {});
  if (method === "tools/list") return ok(message.id, { tools: TOOLS });
  if (method === "tools/call") {
    const params = asObject(message.params);
    const name = typeof params.name === "string" ? params.name : "";
    try {
      const result = await callTool(name, params.arguments);
      return ok(message.id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    } catch (cause: unknown) {
      const text = cause instanceof Error ? cause.message : "Tool failed";
      return ok(message.id, {
        content: [{ type: "text", text }],
        isError: true,
      });
    }
  }
  return fail(message.id, `Unknown method ${method}`, -32601);
}

export async function handleMcpBody(body: unknown): Promise<object | object[] | null> {
  if (Array.isArray(body)) {
    const replies = [];
    for (const item of body) {
      const reply = await handleMcpMessage(item as RpcRequest);
      if (reply !== null) replies.push(reply);
    }
    return replies;
  }
  return handleMcpMessage(asObject(body) as RpcRequest);
}
