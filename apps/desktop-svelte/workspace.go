package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const maxWorkspaceBody = 8 << 20

var errWorkspaceBodyTooLarge = errors.New("Request body exceeds 8 MB")

type WorkspaceViewport struct {
	Zoom float64 `json:"zoom"`
	Tx   float64 `json:"tx"`
	Ty   float64 `json:"ty"`
}

type WorkspaceDocument struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	SVG       string            `json:"svg"`
	Viewport  WorkspaceViewport `json:"viewport"`
	UpdatedAt string            `json:"updatedAt"`
}

type workspaceStore struct {
	mu   sync.Mutex
	path string
}

func defaultWorkspacePath() string {
	dataDir := os.Getenv("SVG_COMPOSE_DATA")
	if dataDir == "" {
		configDir, err := os.UserConfigDir()
		if err != nil {
			return ""
		}
		dataDir = filepath.Join(configDir, "assets-toolbox", "svg-compose")
	}
	return filepath.Join(dataDir, "workspace.json")
}

func newWorkspaceStore(path string) *workspaceStore {
	return &workspaceStore{path: path}
}

func (s *workspaceStore) load() (*WorkspaceDocument, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.path == "" {
		return nil, errors.New("workspace data directory is unavailable")
	}

	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var document WorkspaceDocument
	if err := json.Unmarshal(data, &document); err != nil {
		return nil, fmt.Errorf("decode workspace: %w", err)
	}
	return &document, nil
}

func (s *workspaceStore) save(document WorkspaceDocument) (WorkspaceDocument, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.path == "" {
		return WorkspaceDocument{}, errors.New("workspace data directory is unavailable")
	}
	if len(document.SVG) > maxWorkspaceBody {
		return WorkspaceDocument{}, errors.New("Document is too large to save (8 MB limit)")
	}

	document.ID = "draft"
	document.Name = strings.TrimSpace(document.Name)
	if document.Name == "" {
		document.Name = "Untitled"
	}
	document.UpdatedAt = time.Now().UTC().Format("2006-01-02T15:04:05.000Z")

	data, err := json.Marshal(document)
	if err != nil {
		return WorkspaceDocument{}, err
	}
	data = append(data, '\n')

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return WorkspaceDocument{}, err
	}
	temporary, err := os.CreateTemp(filepath.Dir(s.path), ".workspace-*.json")
	if err != nil {
		return WorkspaceDocument{}, err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)

	if err := temporary.Chmod(0o600); err != nil {
		temporary.Close()
		return WorkspaceDocument{}, err
	}
	if _, err := temporary.Write(data); err != nil {
		temporary.Close()
		return WorkspaceDocument{}, err
	}
	if err := temporary.Sync(); err != nil {
		temporary.Close()
		return WorkspaceDocument{}, err
	}
	if err := temporary.Close(); err != nil {
		return WorkspaceDocument{}, err
	}
	if err := os.Rename(temporaryPath, s.path); err != nil {
		return WorkspaceDocument{}, err
	}
	if directory, err := os.Open(filepath.Dir(s.path)); err == nil {
		_ = directory.Sync()
		_ = directory.Close()
	}
	return document, nil
}

func decodeWorkspaceDocument(body io.Reader) (WorkspaceDocument, error) {
	data, err := io.ReadAll(io.LimitReader(body, maxWorkspaceBody+1))
	if err != nil {
		return WorkspaceDocument{}, errors.New("Invalid JSON")
	}
	if len(data) > maxWorkspaceBody {
		return WorkspaceDocument{}, errWorkspaceBodyTooLarge
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(data, &payload); err != nil {
		return WorkspaceDocument{}, errors.New("Invalid JSON")
	}

	rawDocument, wrapped := payload["document"]
	if !wrapped {
		rawDocument, err = json.Marshal(payload)
		if err != nil {
			return WorkspaceDocument{}, errors.New("Invalid JSON")
		}
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(rawDocument, &fields); err != nil {
		return WorkspaceDocument{}, errors.New("Invalid JSON")
	}
	rawSVG, ok := fields["svg"]
	if !ok {
		return WorkspaceDocument{}, errors.New("svg must be a string")
	}
	var svg string
	if err := json.Unmarshal(rawSVG, &svg); err != nil {
		return WorkspaceDocument{}, errors.New("svg must be a string")
	}

	var name string
	if rawName, ok := fields["name"]; ok {
		_ = json.Unmarshal(rawName, &name)
	}

	return WorkspaceDocument{
		Name:     name,
		SVG:      svg,
		Viewport: decodeWorkspaceViewport(fields["viewport"]),
	}, nil
}

func decodeWorkspaceViewport(raw json.RawMessage) WorkspaceViewport {
	fallback := WorkspaceViewport{Zoom: 1}
	var values map[string]any
	if len(raw) == 0 || json.Unmarshal(raw, &values) != nil {
		return fallback
	}
	zoom, zoomOK := workspaceNumber(values["zoom"])
	tx, txOK := workspaceNumber(values["tx"])
	ty, tyOK := workspaceNumber(values["ty"])
	if !zoomOK || !txOK || !tyOK {
		return fallback
	}
	return WorkspaceViewport{Zoom: zoom, Tx: tx, Ty: ty}
}

func workspaceNumber(value any) (float64, bool) {
	switch number := value.(type) {
	case float64:
		return number, !math.IsInf(number, 0) && !math.IsNaN(number)
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(number), 64)
		return parsed, err == nil && !math.IsInf(parsed, 0) && !math.IsNaN(parsed)
	case bool:
		if number {
			return 1, true
		}
		return 0, true
	default:
		return 0, false
	}
}

func writeWorkspaceJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)
	_ = encoder.Encode(value)
}

func (s *workspaceStore) handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			document, err := s.load()
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeWorkspaceJSON(w, http.StatusOK, map[string]any{"document": document})
		case http.MethodPut, http.MethodPost:
			document, err := decodeWorkspaceDocument(r.Body)
			if err != nil {
				status := http.StatusBadRequest
				switch {
				case errors.Is(err, errWorkspaceBodyTooLarge):
					status = http.StatusRequestEntityTooLarge
				case err.Error() == "svg must be a string":
					status = http.StatusInternalServerError
				}
				http.Error(w, err.Error(), status)
				return
			}
			saved, err := s.save(document)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeWorkspaceJSON(w, http.StatusOK, map[string]any{"document": saved})
		default:
			w.Header().Set("Allow", "GET, PUT, POST")
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		}
	})
}

func newModuleMiddleware(workspace http.Handler, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/workspace" {
			workspace.ServeHTTP(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}
