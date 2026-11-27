package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/tigawanna/assets-toolbox/apps/desktop/internal/assetgen"
)

const mcpProtocolVersion = "2024-11-05"
const mcpLogLimit = 200

type mcpLogEntry struct {
	At    string         `json:"at"`
	Op    string         `json:"op"`
	Tool  string         `json:"tool,omitempty"`
	Args  map[string]any `json:"args,omitempty"`
	OK    bool           `json:"ok"`
	Error string         `json:"error,omitempty"`
}

func mcpLogPath() string {
	return filepath.Join(defaultProjectsRoot(), "mcp", "calls.jsonl")
}

func loadMCPLog() []mcpLogEntry {
	data, err := os.ReadFile(mcpLogPath())
	if err != nil {
		return nil
	}
	entries := []mcpLogEntry{}
	for _, line := range bytes.Split(data, []byte("\n")) {
		if len(bytes.TrimSpace(line)) == 0 {
			continue
		}
		var entry mcpLogEntry
		if err := json.Unmarshal(line, &entry); err == nil {
			entries = append(entries, entry)
		}
	}
	if len(entries) > mcpLogLimit {
		entries = entries[len(entries)-mcpLogLimit:]
	}
	return entries
}

func appendMCPLog(entry mcpLogEntry) {
	path := mcpLogPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer file.Close()
	encoded, err := json.Marshal(entry)
	if err != nil {
		return
	}
	_, _ = file.Write(append(encoded, '\n'))
}

func (a *App) recordMCPCall(entry mcpLogEntry) {
	a.mcpLogMu.Lock()
	a.mcpLog = append(a.mcpLog, entry)
	if len(a.mcpLog) > mcpLogLimit {
		a.mcpLog = a.mcpLog[len(a.mcpLog)-mcpLogLimit:]
	}
	appendMCPLog(entry)
	a.mcpLogMu.Unlock()
	if a.emit != nil && a.ctx != nil {
		a.emit(a.ctx, "mcp:call", entry)
	}
}

func (a *App) mcpLogHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", "GET")
			writeProjectsError(w, http.StatusMethodNotAllowed, "MCP log requires GET")
			return
		}
		a.mcpLogMu.Lock()
		entries := append([]mcpLogEntry(nil), a.mcpLog...)
		a.mcpLogMu.Unlock()
		writeProjectsJSON(w, http.StatusOK, map[string]any{"calls": entries})
	})
}

type mcpRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type mcpError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type mcpResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  any             `json:"result,omitempty"`
	Error   *mcpError       `json:"error,omitempty"`
}

type mcpToolEntry struct {
	ID          string                                 `json:"id"`
	Summary     string                                 `json:"summary"`
	Mutating    bool                                   `json:"mutating"`
	InputSchema map[string]any                         `json:"inputSchema"`
	Run         func(args map[string]any) (any, error) `json:"-"`
}

func (a *App) mcpHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", "POST")
			writeProjectsError(w, http.StatusMethodNotAllowed, "MCP requires POST")
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			writeProjectsError(w, http.StatusBadRequest, "Could not read request body")
			return
		}
		trimmed := bytes.TrimSpace(body)
		if len(trimmed) == 0 {
			writeProjectsError(w, http.StatusBadRequest, "Empty JSON-RPC body")
			return
		}
		w.Header().Set("Content-Type", "application/json")

		if trimmed[0] == '[' {
			var requests []mcpRequest
			if err := json.Unmarshal(trimmed, &requests); err != nil {
				writeMCPError(w, nil, -32700, "Invalid JSON")
				return
			}
			responses := make([]mcpResponse, 0, len(requests))
			for _, request := range requests {
				if response := a.handleMCP(request); response != nil {
					responses = append(responses, *response)
				}
			}
			_ = json.NewEncoder(w).Encode(responses)
			return
		}

		var request mcpRequest
		if err := json.Unmarshal(trimmed, &request); err != nil {
			writeMCPError(w, nil, -32700, "Invalid JSON")
			return
		}
		response := a.handleMCP(request)
		if response == nil {
			w.WriteHeader(http.StatusAccepted)
			return
		}
		_ = json.NewEncoder(w).Encode(response)
	})
}

func (a *App) handleMCP(request mcpRequest) *mcpResponse {
	response := &mcpResponse{JSONRPC: "2.0", ID: request.ID}
	if request.JSONRPC != "2.0" {
		response.Error = &mcpError{Code: -32600, Message: "Invalid JSON-RPC version"}
		return response
	}
	if len(request.ID) == 0 {
		// Notification: no response.
		return nil
	}

	var result any
	var rpcErr *mcpError
	switch request.Method {
	case "initialize":
		result = map[string]any{
			"protocolVersion": mcpProtocolVersion,
			"capabilities":    map[string]any{"tools": map[string]any{}, "resources": map[string]any{}},
			"serverInfo":      map[string]any{"name": "assets-toolbox", "version": appVersion},
		}
	case "ping":
		result = map[string]any{}
	case "tools/list":
		result = map[string]any{"tools": []any{mcpGatewayTool()}}
	case "tools/call":
		result, rpcErr = a.callMCPTool(request.Params)
	case "resources/list":
		result = map[string]any{"resources": mcpResources()}
	case "resources/read":
		result, rpcErr = a.readMCPResource(request.Params)
	default:
		rpcErr = &mcpError{Code: -32601, Message: "Method not found: " + request.Method}
	}
	if rpcErr != nil {
		response.Error = rpcErr
		return response
	}
	response.Result = result
	return response
}

func mcpGatewayTool() map[string]any {
	return map[string]any{
		"name":        "assets_toolbox",
		"description": "Gateway to every Assets Toolbox tool. Use op=list to discover nested tools, op=describe for a schema, then op=call to run one.",
		"inputSchema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"op":      map[string]any{"type": "string", "enum": []string{"list", "describe", "call", "status"}},
				"tool":    map[string]any{"type": "string", "description": "Nested tool id, e.g. expo.generate"},
				"args":    map[string]any{"type": "object", "description": "Arguments for the nested tool"},
				"confirm": map[string]any{"type": "boolean", "description": "Required true for destructive tools"},
			},
			"required": []string{"op"},
		},
	}
}

func mcpToolResult(value any, isError bool) map[string]any {
	encoded, err := json.Marshal(value)
	if err != nil {
		encoded = []byte(`{"error":"could not encode result"}`)
		isError = true
	}
	return map[string]any{
		"content": []any{map[string]any{"type": "text", "text": string(encoded)}},
		"isError": isError,
	}
}

func (a *App) callMCPTool(params json.RawMessage) (result any, rpcErr *mcpError) {
	var payload struct {
		Name string         `json:"name"`
		Args map[string]any `json:"arguments"`
	}
	if err := json.Unmarshal(params, &payload); err != nil {
		return nil, &mcpError{Code: -32602, Message: "Invalid tools/call params"}
	}
	if payload.Name != "assets_toolbox" {
		return nil, &mcpError{Code: -32602, Message: "Unknown tool: " + payload.Name}
	}
	op, _ := payload.Args["op"].(string)
	toolID, _ := payload.Args["tool"].(string)
	nestedArgs, _ := payload.Args["args"].(map[string]any)
	if nestedArgs == nil {
		nestedArgs = map[string]any{}
	}
	confirm, _ := payload.Args["confirm"].(bool)

	entry := mcpLogEntry{
		At:   time.Now().UTC().Format(time.RFC3339),
		Op:   op,
		Tool: toolID,
		Args: payload.Args,
	}
	defer func() {
		if rpcErr != nil {
			entry.Error = rpcErr.Message
		} else if output, ok := result.(map[string]any); ok && output["isError"] == true {
			entry.Error = "tool returned an error"
		} else {
			entry.OK = true
		}
		a.recordMCPCall(entry)
	}()

	switch op {
	case "list":
		catalog := a.mcpCatalog()
		list := make([]map[string]any, 0, len(catalog))
		for _, entry := range catalog {
			list = append(list, map[string]any{
				"id": entry.ID, "summary": entry.Summary, "mutating": entry.Mutating,
			})
		}
		return mcpToolResult(map[string]any{"tools": list}, false), nil
	case "describe":
		entry, ok := a.mcpCatalog()[toolID]
		if !ok {
			return mcpToolResult(map[string]any{"error": "Unknown nested tool: " + toolID}, true), nil
		}
		return mcpToolResult(map[string]any{
			"id": toolID, "summary": entry.Summary, "inputSchema": entry.InputSchema,
		}, false), nil
	case "status":
		return mcpToolResult(map[string]any{
			"backend": "wails", "activeProject": a.projects.activeProjectID(), "jobs": a.assetManager.ActiveCount(),
		}, false), nil
	case "call":
		entry, ok := a.mcpCatalog()[toolID]
		if !ok {
			return mcpToolResult(map[string]any{"error": "Unknown nested tool: " + toolID}, true), nil
		}
		if entry.Mutating && !confirm {
			return mcpToolResult(map[string]any{
				"error": "This tool mutates data. Pass confirm=true.",
			}, true), nil
		}
		result, err := entry.Run(nestedArgs)
		if err != nil {
			return mcpToolResult(map[string]any{"error": err.Error()}, true), nil
		}
		return mcpToolResult(result, false), nil
	default:
		return nil, &mcpError{Code: -32602, Message: "Unknown op: " + op}
	}
}

func mcpResources() []any {
	return []any{
		map[string]any{"uri": "toolbox://catalog", "name": "Tool catalog", "mimeType": "application/json"},
		map[string]any{"uri": "toolbox://projects", "name": "Projects", "mimeType": "application/json"},
	}
}

func (a *App) readMCPResource(params json.RawMessage) (any, *mcpError) {
	var payload struct {
		URI string `json:"uri"`
	}
	if err := json.Unmarshal(params, &payload); err != nil {
		return nil, &mcpError{Code: -32602, Message: "Invalid resources/read params"}
	}
	var value any
	switch payload.URI {
	case "toolbox://catalog":
		catalog := a.mcpCatalog()
		list := make([]map[string]any, 0, len(catalog))
		for _, entry := range catalog {
			list = append(list, map[string]any{
				"id": entry.ID, "summary": entry.Summary, "inputSchema": entry.InputSchema,
			})
		}
		value = list
	case "toolbox://projects":
		value, _ = a.projectsCall(http.MethodGet, "/api/projects", nil)
	default:
		return nil, &mcpError{Code: -32602, Message: "Unknown resource: " + payload.URI}
	}
	return map[string]any{
		"contents": []any{map[string]any{
			"uri": payload.URI, "mimeType": "application/json",
			"text": string(mustJSON(value)),
		}},
	}, nil
}

func writeMCPError(w http.ResponseWriter, id json.RawMessage, code int, message string) {
	_ = json.NewEncoder(w).Encode(mcpResponse{
		JSONRPC: "2.0", ID: id, Error: &mcpError{Code: code, Message: message},
	})
}

func mustJSON(value any) []byte {
	encoded, err := json.Marshal(value)
	if err != nil {
		return []byte(`null`)
	}
	return encoded
}

// projectsCall drives the projects HTTP handler in-process so MCP and the UI
// share exactly the same validation and storage behavior.
func (a *App) projectsCall(method, path string, payload any) (any, error) {
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(encoded)
	}
	request := httptest.NewRequest(method, path, body)
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	a.projects.ServeHTTP(recorder, request)
	if recorder.Code >= 400 {
		return nil, fmt.Errorf("projects API %d: %s", recorder.Code, strings.TrimSpace(recorder.Body.String()))
	}
	if recorder.Body.Len() == 0 {
		return map[string]any{"ok": true}, nil
	}
	var result any
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		return nil, err
	}
	return result, nil
}

// StageProjectAsset turns a stored project asset into a native generation
// input. It is bound to Wails so the UI can restore a source after restart.
func (a *App) StageProjectAsset(projectID, assetID, role string) (AssetInput, error) {
	return a.stageMCPAsset(projectID, assetID, role)
}

func mcpAssetMime(name string) string {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".png":
		return "image/png"
	case ".ico":
		return "image/x-icon"
	case ".json", ".webmanifest":
		return "application/json"
	default:
		return "application/octet-stream"
	}
}

// commitMCPArtifacts stores generated files in the project library so the
// programmatic result survives after the ephemeral generation job is discarded.
func (a *App) commitMCPArtifacts(
	projectID, jobID, tool, sourceAssetID string,
	artifacts []assetgen.Artifact,
) ([]string, error) {
	ids := make([]string, 0, len(artifacts))
	for _, artifact := range artifacts {
		encoded, err := a.GetAssetArtifact(jobID, artifact.Name)
		if err != nil {
			return nil, err
		}
		stored, err := a.projectsCall(http.MethodPost, "/api/projects/"+projectID+"/assets", map[string]any{
			"name": artifact.Name, "mime": mcpAssetMime(artifact.Name), "base64": encoded,
			"kind":   "generated",
			"origin": map[string]any{"tool": tool, "derivedFrom": sourceAssetID},
		})
		if err != nil {
			return nil, err
		}
		payload, _ := stored.(map[string]any)
		asset, _ := payload["asset"].(map[string]any)
		if id, ok := asset["id"].(string); ok {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func mcpString(args map[string]any, key string) (string, error) {
	value, ok := args[key].(string)
	if !ok || strings.TrimSpace(value) == "" {
		return "", fmt.Errorf("%s is required", key)
	}
	return strings.TrimSpace(value), nil
}

func mcpBase64(args map[string]any, key string) ([]byte, error) {
	value, ok := args[key].(string)
	if !ok {
		return nil, fmt.Errorf("%s is required", key)
	}
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, fmt.Errorf("%s must be base64", key)
	}
	return decoded, nil
}

// stageMCPAsset turns a project asset into a native input handle without a dialog.
func (a *App) stageMCPAsset(projectID, assetID, role string) (AssetInput, error) {
	listing, err := a.projectsCall(http.MethodGet, "/api/projects/"+projectID+"/assets", nil)
	if err != nil {
		return AssetInput{}, err
	}
	payload, _ := listing.(map[string]any)
	assets, _ := payload["assets"].([]any)
	var asset map[string]any
	for _, item := range assets {
		candidate, _ := item.(map[string]any)
		if candidate["id"] == assetID {
			asset = candidate
			break
		}
	}
	if asset == nil {
		return AssetInput{}, errors.New("asset not found in project")
	}
	blobResult, err := a.projectsCall(http.MethodGet, "/api/projects/"+projectID+"/assets/"+assetID+"/blob", nil)
	if err != nil {
		return AssetInput{}, err
	}
	blobPayload, _ := blobResult.(map[string]any)
	encoded, _ := blobPayload["base64"].(string)
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return AssetInput{}, err
	}
	extension := filepath.Ext(fmt.Sprint(asset["name"]))
	if extension == "" {
		extension = ".png"
	}
	file, err := os.CreateTemp("", "assets-toolbox-mcp-*"+extension)
	if err != nil {
		return AssetInput{}, err
	}
	if _, err := file.Write(data); err != nil {
		_ = file.Close()
		_ = os.Remove(file.Name())
		return AssetInput{}, err
	}
	if err := file.Close(); err != nil {
		return AssetInput{}, err
	}
	handle, err := newAssetHandle()
	if err != nil {
		return AssetInput{}, err
	}
	a.assetInputsMu.Lock()
	a.assetInputs[handle] = file.Name()
	a.assetInputsMu.Unlock()
	return AssetInput{
		Handle:   handle,
		Name:     fmt.Sprint(asset["name"]),
		Size:     int64(len(data)),
		MimeType: fmt.Sprint(asset["mime"]),
	}, nil
}
