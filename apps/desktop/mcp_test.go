package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func mcpCall(t *testing.T, handler http.Handler, body string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/mcp", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	var decoded map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("invalid JSON-RPC response: %v (%s)", err, response.Body.String())
	}
	return response, decoded
}

func mcpText(t *testing.T, response map[string]any) map[string]any {
	t.Helper()
	result, ok := response["result"].(map[string]any)
	if !ok {
		t.Fatalf("missing result: %v", response)
	}
	content, ok := result["content"].([]any)
	if !ok || len(content) == 0 {
		t.Fatalf("missing content: %v", result)
	}
	item, _ := content[0].(map[string]any)
	var decoded map[string]any
	if err := json.Unmarshal([]byte(item["text"].(string)), &decoded); err != nil {
		t.Fatalf("invalid text content: %v", err)
	}
	return decoded
}

func TestMCPInitializeAndToolsList(t *testing.T) {
	t.Setenv("ASSETS_TOOLBOX_DATA", t.TempDir())
	app := NewApp()
	handler := app.mcpHandler()

	_, response := mcpCall(t, handler, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`)
	if response["error"] != nil {
		t.Fatalf("initialize failed: %v", response)
	}
	result, _ := response["result"].(map[string]any)
	if result["protocolVersion"] != mcpProtocolVersion {
		t.Fatalf("unexpected protocol version: %v", result["protocolVersion"])
	}

	_, response = mcpCall(t, handler, `{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}`)
	result, _ = response["result"].(map[string]any)
	tools, _ := result["tools"].([]any)
	if len(tools) != 1 {
		t.Fatalf("expected one gateway tool, got %d", len(tools))
	}
	tool, _ := tools[0].(map[string]any)
	if tool["name"] != "assets_toolbox" {
		t.Fatalf("unexpected tool: %v", tool["name"])
	}
}

func TestMCPGatewayProjectAndAssetFlow(t *testing.T) {
	t.Setenv("ASSETS_TOOLBOX_DATA", t.TempDir())
	app := NewApp()
	handler := app.mcpHandler()

	call := func(op, tool string, args map[string]any, confirm bool) map[string]any {
		payload := map[string]any{"op": op}
		if tool != "" {
			payload["tool"] = tool
		}
		if args != nil {
			payload["args"] = args
		}
		if confirm {
			payload["confirm"] = true
		}
		body, err := json.Marshal(map[string]any{
			"jsonrpc": "2.0", "id": 1, "method": "tools/call",
			"params": map[string]any{"name": "assets_toolbox", "arguments": payload},
		})
		if err != nil {
			t.Fatal(err)
		}
		_, response := mcpCall(t, handler, string(body))
		if response["error"] != nil {
			t.Fatalf("gateway error: %v", response)
		}
		return mcpText(t, response)
	}

	listing := call("list", "", nil, false)
	tools, _ := listing["tools"].([]any)
	if len(tools) < 10 {
		t.Fatalf("catalog looks too small: %d", len(tools))
	}

	described := call("describe", "projects.create", nil, false)
	if described["id"] != "projects.create" {
		t.Fatalf("unexpected describe result: %v", described)
	}

	blocked := call("call", "projects.create", map[string]any{"name": "Geo Kenya"}, false)
	if blocked["error"] == nil {
		t.Fatal("mutating tool should require confirm=true")
	}

	created := call("call", "projects.create", map[string]any{"name": "Geo Kenya"}, true)
	project, _ := created["project"].(map[string]any)
	projectID, _ := project["id"].(string)
	if projectID == "" {
		t.Fatalf("project was not created: %v", created)
	}

	added := call("call", "assets.add", map[string]any{
		"projectId": projectID, "name": "logo.png", "mime": "image/png", "base64": "aGVsbG8=",
	}, true)
	asset, _ := added["asset"].(map[string]any)
	assetID, _ := asset["id"].(string)
	if assetID == "" {
		t.Fatalf("asset was not added: %v", added)
	}

	assets := call("call", "assets.list", map[string]any{"projectId": projectID}, false)
	if len(assets) == 0 {
		t.Fatalf("asset list is empty: %v", assets)
	}

	status := call("status", "", nil, false)
	if status["backend"] != "wails" {
		t.Fatalf("unexpected status: %v", status)
	}
}

func TestMCPBridgeRoundTrip(t *testing.T) {
	app := NewApp()
	app.emit = func(_ context.Context, name string, data ...interface{}) {
		if name != "mcp:request" {
			return
		}
		id, _ := data[0].(string)
		app.mcpBridgeMu.Lock()
		channel := app.mcpBridgeRequests[id]
		app.mcpBridgeMu.Unlock()
		if channel != nil {
			channel <- mcpBridgeResult{result: map[string]any{"ok": true}}
		}
	}
	result, err := app.mcpBridge("studio.get_board", map[string]any{"projectId": "p_test"})
	if err != nil {
		t.Fatalf("bridge failed: %v", err)
	}
	payload, _ := result.(map[string]any)
	if payload["ok"] != true {
		t.Fatalf("unexpected bridge result: %v", payload)
	}
}

func TestMCPRejectsUnknownNestedTool(t *testing.T) {
	t.Setenv("ASSETS_TOOLBOX_DATA", t.TempDir())
	app := NewApp()
	handler := app.mcpHandler()
	body := `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"assets_toolbox","arguments":{"op":"call","tool":"nope.nope","args":{}}}}`
	_, response := mcpCall(t, handler, body)
	if mcpText(t, response)["error"] == nil {
		t.Fatal("expected an error for an unknown nested tool")
	}
}
