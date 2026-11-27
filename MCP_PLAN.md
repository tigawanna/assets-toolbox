# Native MCP plan — one gateway tool, progressive disclosure

**Status:** approach comparison documented (gateway chosen), Phase 1 gateway implemented and smoke-tested live, Phase 2 Studio/template bridge implemented with a Go round-trip test, stdio transport implemented and smoke-tested. Prompts, optional auth, notifications and Studio storage migration remain. Date: 2026-11-27.

### Implemented so far

- Go JSON-RPC 2.0 handler at `/mcp` in the Wails asset server (`apps/desktop/mcp.go`), with batch requests, notifications, `initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/read`.
- One registered tool `assets_toolbox` with `op: list | describe | call | status`; 18 nested tools in `apps/desktop/mcp_catalog.go` covering projects, documents, assets, Expo/Brand generation, jobs, and sound favorites.
- `stageAssetInput` lets generation consume project asset IDs with no native dialog.
- Headless HTTP mode: set `ASSETS_TOOLBOX_MCP_HTTP=127.0.0.1:4380` to serve the same API without a WebKit window (for agents and contract tests).
- Worker path now honors `ASSETS_TOOLBOX_WORKER` and searches cwd parents.

Live smoke test performed against the headless server: `initialize` → `tools/list` → `projects.create` → `assets.add` → `expo.generate` → `jobs.artifact` returned `icon.png` (148 KB base64). Go tests in `mcp_test.go` cover the same flow in-process.

A full "Aurora" wallpaper-app build was also driven entirely through MCP: project creation, four source images added as assets, `brand.generate` and `expo.generate`, and every generated artifact read back and stored in the project library (19 assets total, including `site.webmanifest`). The source artwork itself was authored locally with PIL — MCP has no image-painting tool, so it acts as the designer-provided input. A live failure exposed two missing forwarded flags in `brand.generate` (`ogEnabled`, `manifestEnabled`); both are now fixed and covered by the schema test.

Phase 2 adds a WebView bridge (`mcp:request` / `mcp:response`) so Go can reach Studio boards and global templates: `studio.list_boards`, `studio.get_board`, `studio.put_board`, `templates.list/save/apply/delete`. The bridge is tested in-process in Go; it requires a running Wails window at runtime (the headless HTTP mode has no frontend to answer bridge calls).

Connection snippet (HTTP): `{"mcpServers":{"assets-toolbox":{"url":"http://127.0.0.1:4380/mcp"}}}`.
Stdio mode: set `ASSETS_TOOLBOX_MCP_STDIO=1` and speak one JSON-RPC request per stdin line; responses are one JSON line on stdout. Verified with `initialize` and `tools/list`.
**Goal:** an MCP server inside the Wails app that can create, inspect, and manipulate every asset tool through **one registered tool**, with nested tool discovery on demand. An external agent should be able to take a project from brand mark → Expo assets → Studio boards without native dialogs.

---

## 0. Ground truth (what exists now)

### MCP today
- Screenshot Studio standalone has a hand-rolled JSON-RPC 2.0 HTTP endpoint at `/mcp` (`packages/screenshot-studio/src/server/mcp.ts`, route `src/routes/mcp.ts`). Protocol `2024-11-05`, streamable HTTP POST only, CORS wide open, no auth, no enable flag. Tools are a flat list (`list_boards`, `get_board`, `add_device`, `clone_collection`, `delete_collection`, `get_open_board`, …) — a direct adapter over Node/SQLite server functions.
- No MCP in the Wails app, no stdio transport anywhere, no shared tool registry.
- Studio embedded mode sets `mcpUrl: ""` and hides MCP settings.

### Native surface in the Wails app
- **Wails bindings** (`App`): `GetSystemInfo`, `WorkspaceID`, `LoadWorkspace`, `SaveWorkspace`, `SelectAssetImage`, `GetAssetInputPreview`, `GenerateExpoAssets`, `GenerateBrandAssets`, `GetAssetArtifact`, `ReplaceAssetArtifact`, `SaveAssetArtifact`, `SaveAssetSet`, `CopyAssetText`, `CancelAssetGeneration`, `DiscardAssetJob`.
- **HTTP in the Wails asset-server middleware**: `/api/workspace`, `/api/inspect`, `/api/asset`, `/api/projects*` (projects, documents, assets, blobs, move/copy).
- **Not reachable from outside the frontend**: Studio board storage (IndexedDB `assets-toolbox-screenshot-studio`), OG editor drafts (project document JSON), global templates (IndexedDB `assets-toolbox-templates`), theme/sidebar (`localStorage`).

### Important constraints
- Native dialogs (`OpenFileDialog`/`SaveFileDialog`) cannot be driven headlessly. An MCP client can only use **project asset IDs** as generation inputs, never open a picker.
- Asset generation jobs are ephemeral temp dirs with no list/status binding; `jobId` from the result is the only handle.
- Studio's data lives in the browser process. A Go MCP server cannot read it without a bridge.

---

## 1. Approaches considered

| Approach | Shape | Pros | Cons |
| --- | --- | --- | --- |
| **A. Flat, one tool per capability** | 40–60 registered tools: `expo_generate`, `brand_generate`, `studio_add_device`, … | Simplest client code; standard MCP discovery | Huge tool list eats context; naming collisions; hard to version; violates “one tool for all tools” |
| **B. One tool with a giant action enum** | `assets_toolbox({tool, action, ...everything})` | Only one tool registered | Schema becomes enormous; no discoverability; validation nightmare; poor errors |
| **C. Gateway + progressive disclosure** (recommended) | One `assets_toolbox` tool with `op: list | describe | call | status`; nested tools addressed as `domain.action` | One registration; tiny always-on schema; full schemas fetched only when needed; naturally versioned; mirrors how the app itself is organized | Client must make 2 calls for an unfamiliar action; needs a catalog + schema validation |
| **D. Coarse per-domain tools** | 6 tools (`projects`, `brand`, `expo`, `studio`, …) each with actions | Middle ground; less schema bloat than A | Still 6 registrations; “one tool” requirement not met; repeated action patterns |

**Recommendation: C**, validated by a quick prototype spike in Phase 0 (see below). B is rejected outright. A is the fallback only if real-client testing shows agents fail with two-step discovery.

---

## 2. Proposed design

### 2.1 The single registered tool

```jsonc
{
  "name": "assets_toolbox",
  "description": "Gateway to the Assets Toolbox: list, describe, and call nested tools.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "op": { "type": "string", "enum": ["list", "describe", "call", "status"] },
      "tool": { "type": "string", "description": "Nested tool id, e.g. 'expo.generate'" },
      "args": { "type": "object", "description": "Arguments for the nested tool" },
      "confirm": { "type": "boolean", "description": "Required true for destructive tools" }
    },
    "required": ["op"]
  }
}
```

- `list` → grouped catalog: `{domain, id, summary, mutating, requiresConfirm}[]`.
- `describe` → full JSON schema for one nested tool, plus example args.
- `call` → executes `tool` with `args`, returns a typed result envelope.
- `status` → active project, registered modules, running jobs, backend mode.

Nested tool ids use `<domain>.<action>`: `projects.create`, `projects.set_document`, `assets.add`, `assets.move`, `brand.generate`, `expo.generate`, `compose.save`, `inspect.run`, `sound.favorites`, `studio.create_board`, `studio.apply_template`, `templates.list`, `templates.save`, `templates.apply`.

### 2.2 MCP resources (read-only, cheap context)

- `toolbox://catalog` — full catalog with schemas (alternative to `describe`).
- `toolbox://projects` — project list (mirrors `GET /api/projects`).
- `toolbox://projects/{id}` — manifest + document summaries + asset counts.
- `toolbox://jobs` — generation jobs currently alive (new internal status method).

### 2.3 Prompts (optional, phase 3)

- `new_project` — scaffold a project with brand/expo/studio defaults.
- `brand_to_expo` — take a brand source asset and generate an Expo set.
- `make_store_screens` — Studio board from a project's assets.

---

## 3. Tool → capability mapping

| Domain | Nested tools | Backing implementation |
| --- | --- | --- |
| `projects` | `list`, `create`, `get`, `rename`, `delete` | `/api/projects*` (Go `projectsStore`) |
| `documents` | `get`, `put` (tool ∈ compose/brand/expo/studio/sound/inspect) | `/api/projects/{id}/documents/{tool}` |
| `assets` | `list`, `add`, `blob`, `move`, `delete` | `/api/projects/{id}/assets*` |
| `brand` | `generate` (source asset id + form + optional custom OG draft) | new `stageAssetInput` + `GenerateBrandAssets` |
| `expo` | `generate` | new `stageAssetInput` + `GenerateExpoAssets` |
| `jobs` | `list`, `status`, `artifact`, `replace`, `apply`, `discard`, `cancel` | new `assetgen.Manager` status/list methods + existing bindings |
| `compose` | `get_document`, `save_document` (SVG document JSON) | project documents |
| `inspect` | `run` (URL → report), `save_report` | `/api/inspect` + inspect document |
| `sound` | `get_favorites`, `set_favorites` | project document |
| `studio` | `list_boards`, `get_board`, `create_board`, `put_board`, `apply_template` | **bridge needed** (see §4) |
| `templates` | `list`, `describe`, `save`, `apply`, `delete` | new Go template store + frontend sync bridge |

---

## 4. Architectural decisions

1. **Transport** — add `/mcp` to the Wails asset-server middleware in `main.go`, handled by Go JSON-RPC 2.0. Same-origin, loopback only, no new process. Optional headless stdio binary in phase 3 (`cmd/assets-toolbox-mcp`) that reuses the same handler but has no dialogs.
2. **Gateway implementation lives in Go**, dispatching to:
   - existing HTTP stores via direct Go method calls (refactor `projectsStore`/`assetManager` into exported methods rather than re-HTTP-ing internally);
   - existing `App` bindings for generation, artifact read/replace, and job lifecycle;
   - a new `stageAssetInput(projectId, assetId, role)` helper that reads a project blob, writes it into a job staging dir, and returns a normal `AssetInput` handle — this is what makes brand→Expo reuse possible without dialogs.
3. **No native dialogs from MCP** — mutating file-save tools are out of scope for phase 1; instead `jobs.apply` writes an artifact into the project asset library by content hash. Saving to a user-chosen path stays a UI action.
4. **Studio bridge** — Studio's data is in browser IndexedDB. Two options:
   - **4a (recommended, phase 2):** a Wails event roundtrip. Go emits `mcp:request` with a request id; frontend listens, calls Studio's document API, emits `mcp:response` with the result. Mirrors the existing `<module>:flush` handshake pattern. Requires a `mcp` module registered in `DesktopFlushProvider`/`App.startup`.
   - **4b (later):** migrate Studio board storage into the Go `projectsStore` so it is directly addressable; larger change, but removes the bridge.
5. **Templates** — introduce a Go template store (manifest JSON + template payloads using the editor's own representation: `OgEditorDraft` / `StudioSnapshot`). The browser template client (`lib/templates/client.ts`) syncs through `/api/templates*`, so UI and MCP share one source of truth. Phase 1 can keep IndexedDB and expose templates through the event bridge instead; phase 2 moves storage to Go.
6. **Live events** — MCP `status`/`resources` are point-in-time reads. Phase 3 can bridge Go Wails events and Studio SSE into MCP notifications (`notifications/tools/list_changed`, `notifications/resources/updated`) if clients need them.

---

## 5. Safety and validation

- Bind the HTTP MCP endpoint to loopback only; optional `ASSETS_TOOLBOX_MCP_TOKEN` bearer token in phase 2.
- Validate nested tool args against their JSON schema *before* dispatch; reject unknown fields by default.
- Destructive tools (`projects.delete`, `assets.delete`, `jobs.discard`, `templates.delete`) require `confirm: true`.
- Reuse existing limits: 8 MB input, 16 MiB artifact, path containment/no-symlink checks, ID regexes.
- Never expose raw filesystem paths in responses; return project/asset/job IDs and base64 only when explicitly requested.
- Rate-limit generation jobs; cap concurrent jobs via the existing manager.

---

## 6. Iterative implementation plan

### Phase 0 — prototype spike (decision gate)
- [ ] Stand up a throwaway Go `/mcp` handler with `initialize`, `tools/list`, `tools/call`, `ping`.
- [ ] Implement **approach A** (flat tools) and **approach C** (gateway) behind a build flag for 3 representative flows: create project, generate Expo assets, read Studio board.
- [ ] Measure: tool-list token count, calls needed per flow, agent success rate with a small prompt set.
- [ ] Decide and document; delete the losing prototype.
- **Done when:** a written decision with numbers is committed in this file.

### Phase 1 — gateway core + non-Studio domains
- [ ] `apps/desktop/mcp/handler.go`: JSON-RPC 2.0 handler (single, batch, notifications, errors `-32600/-32601/-32602/-32603`).
- [ ] `apps/desktop/mcp/catalog.go`: nested tool catalog + schemas + `list`/`describe`/`call`/`status` dispatch.
- [ ] Wire `/mcp` into `main.go` apiRoutes middleware; loopback guard.
- [ ] Implement domains: `projects`, `documents`, `assets`, `brand`, `expo`, `jobs`, `compose`, `inspect`, `sound`.
- [ ] Add `stageAssetInput` and `assetgen.Manager` status/list methods.
- [ ] Resources: `toolbox://catalog`, `toolbox://projects`, `toolbox://projects/{id}`, `toolbox://jobs`.
- [ ] Go tests using `httptest` + the existing projects fixtures.
- **Done when:** an MCP client can create a project, add an asset, generate Expo assets from that asset, and read the artifacts — all through the one gateway tool.

### Phase 2 — Studio bridge + templates
- [ ] Add `mcp` to the flush/active module set in `app.go` and `DesktopModule` in TS.
- [ ] Implement event roundtrip: `mcp:request` → frontend handler → `mcp:response`, with timeout and request ids.
- [ ] Bridge `studio.*` tools (list/get/create/put board, apply template) through it.
- [ ] Introduce Go template store + `/api/templates*`; switch `lib/templates/client.ts` to it; expose `templates.*` tools.
- [ ] Tests: Go bridge timeout/error paths, TS bridge handler, template roundtrip across projects.
- **Done when:** Studio boards and global templates are readable/writable from MCP with the same payloads the editor uses.

### Phase 3 — polish and alternative transport
- [ ] Optional stdio binary reusing the same handler; document no-dialog limits.
- [ ] Prompts (`new_project`, `brand_to_expo`, `make_store_screens`).
- [ ] MCP notifications for live changes; token auth; rate limiting.
- [ ] Consider migrating Studio storage to Go (remove bridge).
- [ ] Docs: connection snippets for Cursor/Claude, tool catalog, examples.
- **Done when:** documented, tested, and usable from at least one real MCP client.

---

## 7. Test strategy

- Go `httptest` POSTs of JSON-RPC envelopes: `initialize`, `tools/list`, `tools/call` for every `op`, batch requests, notifications → 202, unknown method/tool → proper errors.
- Reuse `projects_test.go` helpers (`t.Setenv("ASSETS_TOOLBOX_DATA", ...)`, `createTestProject`, `addTestAsset`).
- Integration test: create project → add source asset → `brand.generate` → `jobs.artifact` → `assets.add` → second project → `expo.generate` from same asset.
- TS tests for the event bridge mirror `packages/screenshot-studio/test/mcp.test.ts` style (call handler directly, no HTTP).
- A small script that speaks the protocol over HTTP as a contract test, like `packages/svg-compose/test/api.test.ts`.

---

## 8. Risks / open questions

| Risk | Recommendation |
| --- | --- |
| Agents fail with two-step `list`/`describe`/`call`. | Phase 0 measures this; fallback is approach D (6 domain tools) or A. |
| Studio bridge latency/timeouts. | Reuse the 3 s flush timeout pattern; make it configurable; prefer phase 3 storage migration. |
| Dialogs unavailable to MCP. | Asset-ID-based inputs only; document that save-to-path is UI-only. |
| Schema drift between UI and MCP. | Generate nested tool schemas from the same TS types where possible, or keep a single catalog file reviewed in both places. |
| Security of an unauthenticated local endpoint. | Loopback-only in phase 1; token in phase 3; no raw paths in responses. |
| Job state not persisted across restart. | `jobs.list` reports live jobs only; document that jobs are ephemeral. |

**Decisions to confirm before Phase 0:**
1. Is the gateway-only tool acceptable, or must the server also register a few coarse domain tools? (recommended: gateway only, revisit after the spike.)
2. Should MCP be enabled by default or behind an env flag? (recommended: default on for loopback HTTP, with a disable flag.)
3. Is modifying Studio storage in phase 3 in scope, or should the bridge stay long-term? (recommended: bridge first, decide later.)
