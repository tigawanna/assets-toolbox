# MCP endpoint — experimental, not production ready

> [!WARNING]
> **The Screenshot Studio MCP endpoint is a prototype.** It is included so agents can experiment with editing boards while you watch the canvas, but it is **not ready for production use**:
>
> - Tool names, parameters, and the wire protocol may change without notice between versions.
> - There is **no authentication or per-client authorization**. Any process that can reach the port can read and mutate every board.
> - CORS is open (`Access-Control-Allow-Origin: *`) and the MCP handshake is a small hand-rolled JSON-RPC implementation (`2024-11-05`), not a battle-tested SDK.
> - Only a subset of editor actions is exposed; some UI features have no MCP equivalent, and error messages are not stable.
>
> Keep the studio bound to `127.0.0.1`, do not expose it on a shared network, and treat boards as disposable while experimenting. The canvas editor and PNG export are the stable, supported surface.

Back to the [usage guide](./usage.md) and [README](../README.md).

## What it can do today

MCP is Streamable HTTP on the **same origin as the running studio** (`http://127.0.0.1:4320/mcp` by default). It does not open SQLite files itself — it talks to the live server, so it sees the same files as the UI and emits the same live-update events.

| Tool                | What it does                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `list_boards`       | Names, ids, store, slice counts                                                                      |
| `get_open_board`    | The board currently open in the studio tab                                                           |
| `get_board`         | Scene strips and layers for one `projectId` (no image bytes). Omit `projectId` to use the open board |
| `create_board`      | New empty board                                                                                      |
| `clone_collection`  | Duplicate a strip on that board; optional `store`: `app-store` or `play`                             |
| `delete_collection` | Remove a strip (not the last one)                                                                    |
| `apply_store_rules` | Resize / swap device family on a strip                                                               |
| `add_device`        | Place a device on a slice                                                                            |
| `add_text`          | Add a headline or subtext on a slice                                                                 |
| `add_asset`         | Import a local image into the board library; returns `assetId`                                       |
| `update_board`      | Rename a board/strip, or set slice count, store, preset, or solid background                         |
| `patch_node`        | Edit a layer: text, screen asset, position, hidden, name                                             |

Call `initialize` before `tools/list`. Mutating tools take `projectId` from `list_boards`; `clone_collection` / `delete_collection` also need `collectionId` from `get_board`.

## Connect Cursor (experimental)

1. Start the studio: `npx @tigawanna/screenshot-studio` or `pnpm --filter @tigawanna/screenshot-studio dev`.
2. Open **Settings** in the app and copy the Cursor snippet, or write `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "screenshot-studio": {
      "url": "http://127.0.0.1:4320/mcp"
    }
  }
}
```

If you changed `--port` / `PORT` / `HOST`, copy the URL from Settings instead of guessing.

3. Reload MCP in Cursor, then ask the agent to list boards or clone a strip for Apple.

## Probe it without a client

```bash
curl -s http://127.0.0.1:4320/mcp
curl -s -X POST http://127.0.0.1:4320/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
curl -s -X POST http://127.0.0.1:4320/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
curl -N "http://127.0.0.1:4320/api/live?projectId=<board-id>"
```

`GET /api/live` is SSE: open a board in the browser, subscribe with curl, then clone or delete a strip (UI or MCP). The stream emits `{ type: "change", projectId, seq, label }`.

## Known limitations

- The studio must be **running**; the endpoint is not a standalone server.
- No streaming responses, no resources/prompts surface, no session persistence beyond process lifetime.
- No stable compatibility promise for tool schemas — pin the package version if you build an integration, and expect to update it.
- Security hardening (auth, scoped tokens, tighter CORS) is not implemented. Do not expose the port beyond localhost.
