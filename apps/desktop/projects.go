package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	projectsAPIPrefix     = "/api/projects"
	projectsSchemaVersion = 1
	maxProjectsJSONBody   = 1 << 20                              // 1 MiB
	maxProjectsAssetBytes = 16 << 20                             // 16 MiB decoded asset
	maxProjectsAssetBody  = (maxProjectsAssetBytes/3+1)*4 + 4096 // base64 upload allowance
)

var (
	errProjectsBodyTooLarge  = errors.New("Request body exceeds 1 MB")
	errProjectsAssetTooLarge = errors.New("Asset exceeds 16 MB")
	errProjectNotFound       = errors.New("Project not found")
	errAssetNotFound         = errors.New("Asset not found")
	errProjectsUnavailable   = errors.New("projects data directory is unavailable")

	projectIDPattern = regexp.MustCompile(`^p_[0-9a-f]{12}$`)
	assetIDPattern   = regexp.MustCompile(`^a_[0-9a-f]{16}$`)
	sha256Pattern    = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

var projectsToolIDs = map[string]bool{
	"compose": true,
	"brand":   true,
	"expo":    true,
	"studio":  true,
	"sound":   true,
	"inspect": true,
}

// ProjectSummary is the lightweight entry stored in projects.json.
type ProjectSummary struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	UpdatedAt    string        `json:"updatedAt"`
	LastOpenedAt string        `json:"lastOpenedAt,omitempty"`
	Path         string        `json:"path,omitempty"`
	Counts       ProjectCounts `json:"counts"`
}

type ProjectCounts struct {
	Assets int `json:"assets"`
	Tools  int `json:"tools"`
}

// ProjectManifest is the full per-project record stored in project.json.
type ProjectManifest struct {
	ID            string          `json:"id"`
	Name          string          `json:"name"`
	CreatedAt     string          `json:"createdAt"`
	UpdatedAt     string          `json:"updatedAt"`
	SchemaVersion int             `json:"schemaVersion"`
	Settings      ProjectSettings `json:"settings"`
}

type ProjectSettings struct {
	DefaultOutDir string `json:"defaultOutDir"`
	Theme         string `json:"theme,omitempty"`
}

type ProjectIndex struct {
	SchemaVersion   int              `json:"schemaVersion"`
	Projects        []ProjectSummary `json:"projects"`
	ActiveProjectID string           `json:"activeProjectId"`
}

// ModuleRecord is a tool document. Data is kept as raw JSON so a tool's
// payload round-trips without being reshaped by the native layer.
type ModuleRecord struct {
	ProjectID string          `json:"projectId"`
	Tool      string          `json:"tool"`
	Data      json.RawMessage `json:"data"`
	UpdatedAt string          `json:"updatedAt"`
}

type AssetOrigin struct {
	Tool        string `json:"tool"`
	DerivedFrom string `json:"derivedFrom,omitempty"`
}

type ModuleRef struct {
	Tool  string `json:"tool"`
	Field string `json:"field"`
}

type AssetRecord struct {
	ID        string       `json:"id"`
	ProjectID string       `json:"projectId"`
	Name      string       `json:"name"`
	Mime      string       `json:"mime"`
	Bytes     int64        `json:"bytes"`
	Width     int          `json:"width,omitempty"`
	Height    int          `json:"height,omitempty"`
	Hash      string       `json:"hash"`
	Kind      string       `json:"kind"`
	Origin    *AssetOrigin `json:"origin,omitempty"`
	Tags      []string     `json:"tags"`
	Refs      []ModuleRef  `json:"refs"`
	CreatedAt string       `json:"createdAt"`
}

type AssetIndex struct {
	Assets []AssetRecord     `json:"assets"`
	Links  []json.RawMessage `json:"links"`
}

type addAssetRequest struct {
	Name   string       `json:"name"`
	Mime   string       `json:"mime"`
	Base64 string       `json:"base64"`
	Kind   string       `json:"kind,omitempty"`
	Origin *AssetOrigin `json:"origin,omitempty"`
	Tags   []string     `json:"tags,omitempty"`
	Refs   []ModuleRef  `json:"refs,omitempty"`
	Width  int          `json:"width,omitempty"`
	Height int          `json:"height,omitempty"`
}

type assetMoveRequest struct {
	AssetIDs        []string `json:"assetIds"`
	TargetProjectID string   `json:"targetProjectId"`
	Mode            string   `json:"mode"`
	IncludeDerived  bool     `json:"includeDerived"`
}

type projectSettingsPatch struct {
	DefaultOutDir *string `json:"defaultOutDir"`
	Theme         *string `json:"theme"`
}

type projectPatchRequest struct {
	Name     *string               `json:"name"`
	Settings *projectSettingsPatch `json:"settings"`
}

// projectsStore owns all global project persistence. One mutex covers the
// index, manifests, documents, asset indexes and blob files because a single
// API request can touch several of them at once.
type projectsStore struct {
	mu   sync.Mutex
	root string
}

func defaultProjectsRoot() string {
	if dataDir := os.Getenv("ASSETS_TOOLBOX_DATA"); dataDir != "" {
		return dataDir
	}
	configDir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(configDir, "assets-toolbox")
}

func newProjectsStore(root string) *projectsStore {
	return &projectsStore{root: root}
}

func newProjectsHandler(store *projectsStore) http.Handler {
	return store
}

func (s *projectsStore) activeProjectID() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	index, err := s.loadIndexLocked()
	if err != nil {
		return ""
	}
	return index.ActiveProjectID
}

func (s *projectsStore) handler() http.Handler {
	return newProjectsHandler(s)
}

// newProjectsModuleMiddleware extends the exact-path module middleware with
// the /api/projects prefix. Existing routes keep their exact-match behavior.
func newProjectsModuleMiddleware(routes map[string]http.Handler, next http.Handler) http.Handler {
	base := newModuleMiddleware(routes, next)
	projects := routes[projectsAPIPrefix]
	if projects == nil {
		return base
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == projectsAPIPrefix || strings.HasPrefix(r.URL.Path, projectsAPIPrefix+"/") {
			projects.ServeHTTP(w, r)
			return
		}
		base.ServeHTTP(w, r)
	})
}

// ---------- validation ----------

func validProjectID(id string) bool {
	return projectIDPattern.MatchString(id) && safeProjectsSegment(id)
}

func validAssetID(id string) bool {
	return assetIDPattern.MatchString(id) && safeProjectsSegment(id)
}

func validProjectsHash(hash string) bool {
	return sha256Pattern.MatchString(hash) && safeProjectsSegment(hash)
}

func validProjectsTool(tool string) bool {
	return projectsToolIDs[tool] && safeProjectsSegment(tool)
}

func safeProjectsSegment(segment string) bool {
	if segment == "" || segment == "." || segment == ".." {
		return false
	}
	if strings.ContainsAny(segment, "/\\\x00") || strings.Contains(segment, "..") {
		return false
	}
	if filepath.IsAbs(segment) || filepath.VolumeName(segment) != "" {
		return false
	}
	return filepath.Clean(segment) == segment
}

func cleanProjectsName(name string) (string, bool) {
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, "/\\\x00") {
		return "", false
	}
	return name, true
}

func unsafeProjectsRequestPath(r *http.Request) bool {
	escaped := strings.ToLower(r.URL.EscapedPath())
	for _, fragment := range []string{"%2f", "%5c", "%00", "%2e%2e"} {
		if strings.Contains(escaped, fragment) {
			return true
		}
	}
	decoded := r.URL.Path
	if strings.ContainsAny(decoded, "\\\x00") {
		return true
	}
	for _, segment := range strings.Split(decoded, "/") {
		if segment == "." || segment == ".." {
			return true
		}
	}
	return false
}

// ---------- filesystem helpers ----------

func (s *projectsStore) indexPath() string {
	return filepath.Join(s.root, "projects.json")
}

func (s *projectsStore) projectDir(projectID string) string {
	return filepath.Join(s.root, "projects", projectID)
}

func (s *projectsStore) manifestPath(projectID string) string {
	return filepath.Join(s.projectDir(projectID), "project.json")
}

func (s *projectsStore) documentsDir(projectID string) string {
	return filepath.Join(s.projectDir(projectID), "documents")
}

func (s *projectsStore) documentPath(projectID, tool string) string {
	return filepath.Join(s.documentsDir(projectID), tool+".json")
}

func (s *projectsStore) assetsDir(projectID string) string {
	return filepath.Join(s.projectDir(projectID), "assets")
}

func (s *projectsStore) assetsIndexPath(projectID string) string {
	return filepath.Join(s.assetsDir(projectID), "index.json")
}

func (s *projectsStore) blobPath(projectID, hash string) string {
	return filepath.Join(s.assetsDir(projectID), "blobs", hash[:2], hash)
}

func projectsStamp() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

func atomicProjectsWrite(path string, data []byte) error {
	directory := filepath.Dir(path)
	if err := os.MkdirAll(directory, 0o755); err != nil {
		return err
	}
	temporary, err := os.CreateTemp(directory, ".projects-*.tmp")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)

	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return err
	}
	if _, err := temporary.Write(data); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return err
	}
	if handle, err := os.Open(directory); err == nil {
		_ = handle.Sync()
		_ = handle.Close()
	}
	return nil
}

func atomicProjectsWriteJSON(path string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return atomicProjectsWrite(path, data)
}

func randomProjectsID(prefix string, byteLength int) (string, error) {
	buffer := make([]byte, byteLength)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(buffer), nil
}

// ---------- loading / saving ----------

func (s *projectsStore) loadIndexLocked() (ProjectIndex, error) {
	if s.root == "" {
		return ProjectIndex{}, errProjectsUnavailable
	}
	data, err := os.ReadFile(s.indexPath())
	if errors.Is(err, os.ErrNotExist) {
		return ProjectIndex{
			SchemaVersion: projectsSchemaVersion,
			Projects:      []ProjectSummary{},
		}, nil
	}
	if err != nil {
		return ProjectIndex{}, err
	}
	var index ProjectIndex
	if err := json.Unmarshal(data, &index); err != nil {
		return ProjectIndex{}, fmt.Errorf("decode projects index: %w", err)
	}
	if index.SchemaVersion == 0 {
		index.SchemaVersion = projectsSchemaVersion
	}
	if index.Projects == nil {
		index.Projects = []ProjectSummary{}
	}
	return index, nil
}

func (s *projectsStore) saveIndexLocked(index ProjectIndex) error {
	return atomicProjectsWriteJSON(s.indexPath(), index)
}

func (s *projectsStore) loadManifestLocked(projectID string) (*ProjectManifest, error) {
	if !validProjectID(projectID) {
		return nil, errProjectNotFound
	}
	data, err := os.ReadFile(s.manifestPath(projectID))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var manifest ProjectManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("decode project manifest: %w", err)
	}
	return &manifest, nil
}

func (s *projectsStore) saveManifestLocked(manifest ProjectManifest) error {
	return atomicProjectsWriteJSON(s.manifestPath(manifest.ID), manifest)
}

func (s *projectsStore) loadAssetIndexLocked(projectID string) (AssetIndex, error) {
	data, err := os.ReadFile(s.assetsIndexPath(projectID))
	if errors.Is(err, os.ErrNotExist) {
		return AssetIndex{Assets: []AssetRecord{}, Links: []json.RawMessage{}}, nil
	}
	if err != nil {
		return AssetIndex{}, err
	}
	var index AssetIndex
	if err := json.Unmarshal(data, &index); err != nil {
		return AssetIndex{}, fmt.Errorf("decode asset index: %w", err)
	}
	if index.Assets == nil {
		index.Assets = []AssetRecord{}
	}
	if index.Links == nil {
		index.Links = []json.RawMessage{}
	}
	return index, nil
}

func (s *projectsStore) saveAssetIndexLocked(projectID string, index AssetIndex) error {
	if index.Assets == nil {
		index.Assets = []AssetRecord{}
	}
	if index.Links == nil {
		index.Links = []json.RawMessage{}
	}
	return atomicProjectsWriteJSON(s.assetsIndexPath(projectID), index)
}

func (s *projectsStore) loadDocumentLocked(projectID, tool string) (*ModuleRecord, error) {
	data, err := os.ReadFile(s.documentPath(projectID, tool))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var record ModuleRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, fmt.Errorf("decode tool document: %w", err)
	}
	return &record, nil
}

func (s *projectsStore) countToolsLocked(projectID string) (int, error) {
	entries, err := os.ReadDir(s.documentsDir(projectID))
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	count := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		if validProjectsTool(strings.TrimSuffix(entry.Name(), ".json")) {
			count++
		}
	}
	return count, nil
}

func (s *projectsStore) summarizeLocked(manifest ProjectManifest) (ProjectSummary, error) {
	assets, err := s.loadAssetIndexLocked(manifest.ID)
	if err != nil {
		return ProjectSummary{}, err
	}
	tools, err := s.countToolsLocked(manifest.ID)
	if err != nil {
		return ProjectSummary{}, err
	}
	summary := ProjectSummary{
		ID:        manifest.ID,
		Name:      manifest.Name,
		UpdatedAt: manifest.UpdatedAt,
		Counts:    ProjectCounts{Assets: len(assets.Assets), Tools: tools},
	}
	index, err := s.loadIndexLocked()
	if err == nil {
		for _, existing := range index.Projects {
			if existing.ID == manifest.ID {
				summary.LastOpenedAt = existing.LastOpenedAt
				summary.Path = existing.Path
				break
			}
		}
	}
	return summary, nil
}

func (s *projectsStore) saveSummaryLocked(summary ProjectSummary) error {
	index, err := s.loadIndexLocked()
	if err != nil {
		return err
	}
	replaced := false
	for i := range index.Projects {
		if index.Projects[i].ID == summary.ID {
			index.Projects[i] = summary
			replaced = true
			break
		}
	}
	if !replaced {
		index.Projects = append(index.Projects, summary)
	}
	return s.saveIndexLocked(index)
}

func (s *projectsStore) touchProjectLocked(projectID string) error {
	manifest, err := s.loadManifestLocked(projectID)
	if err != nil {
		return err
	}
	if manifest == nil {
		return errProjectNotFound
	}
	manifest.UpdatedAt = projectsStamp()
	if err := s.saveManifestLocked(*manifest); err != nil {
		return err
	}
	summary, err := s.summarizeLocked(*manifest)
	if err != nil {
		return err
	}
	return s.saveSummaryLocked(summary)
}

func (s *projectsStore) documentReferencesAssetLocked(projectID, assetID string) (bool, error) {
	entries, err := os.ReadDir(s.documentsDir(projectID))
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.documentsDir(projectID), entry.Name()))
		if err != nil {
			return false, err
		}
		if strings.Contains(string(data), assetID) {
			return true, nil
		}
	}
	return false, nil
}

// ---------- HTTP helpers ----------

func writeProjectsJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)
	_ = encoder.Encode(value)
}

func writeProjectsError(w http.ResponseWriter, status int, message string) {
	writeProjectsJSON(w, status, map[string]string{"error": message})
}

func writeProjectsMethodError(w http.ResponseWriter, allow string) {
	w.Header().Set("Allow", allow)
	writeProjectsError(w, http.StatusMethodNotAllowed, "Method not allowed")
}

func decodeProjectsBody(body io.Reader, limit int, target any) error {
	data, err := io.ReadAll(io.LimitReader(body, int64(limit)+1))
	if err != nil {
		return errors.New("Invalid JSON")
	}
	if len(data) > limit {
		return errProjectsBodyTooLarge
	}
	if err := json.Unmarshal(data, target); err != nil {
		return errors.New("Invalid JSON")
	}
	return nil
}

func writeProjectsStoreError(w http.ResponseWriter, err error) {
	if errors.Is(err, errProjectNotFound) || errors.Is(err, errAssetNotFound) {
		writeProjectsError(w, http.StatusNotFound, err.Error())
		return
	}
	writeProjectsError(w, http.StatusInternalServerError, err.Error())
}

// ---------- routing ----------

func (s *projectsStore) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if unsafeProjectsRequestPath(r) {
		writeProjectsError(w, http.StatusBadRequest, "Invalid path")
		return
	}
	if r.URL.Path != projectsAPIPrefix && !strings.HasPrefix(r.URL.Path, projectsAPIPrefix+"/") {
		writeProjectsError(w, http.StatusNotFound, "Not found")
		return
	}
	rest := strings.TrimPrefix(r.URL.Path, projectsAPIPrefix)
	if rest == "" {
		s.handleProjectsCollection(w, r)
		return
	}
	segments := strings.Split(strings.TrimPrefix(rest, "/"), "/")
	if len(segments) == 0 || segments[0] == "" {
		writeProjectsError(w, http.StatusNotFound, "Not found")
		return
	}
	projectID := segments[0]
	if !validProjectID(projectID) {
		writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
		return
	}

	switch len(segments) {
	case 1:
		s.handleProject(w, r, projectID)
	case 2:
		switch segments[1] {
		case "assets":
			s.handleProjectAssets(w, r, projectID)
		default:
			writeProjectsError(w, http.StatusNotFound, "Not found")
		}
	case 3:
		switch segments[1] {
		case "documents":
			if !validProjectsTool(segments[2]) {
				writeProjectsError(w, http.StatusNotFound, "Unknown tool")
				return
			}
			s.handleProjectDocument(w, r, projectID, segments[2])
		case "assets":
			if segments[2] == "move" {
				s.handleAssetMove(w, r, projectID)
				return
			}
			if !validAssetID(segments[2]) {
				writeProjectsError(w, http.StatusNotFound, errAssetNotFound.Error())
				return
			}
			s.handleProjectAsset(w, r, projectID, segments[2])
		default:
			writeProjectsError(w, http.StatusNotFound, "Not found")
		}
	case 4:
		if segments[1] == "assets" && segments[3] == "blob" {
			if !validAssetID(segments[2]) {
				writeProjectsError(w, http.StatusNotFound, errAssetNotFound.Error())
				return
			}
			s.handleAssetBlob(w, r, projectID, segments[2])
			return
		}
		writeProjectsError(w, http.StatusNotFound, "Not found")
	default:
		writeProjectsError(w, http.StatusNotFound, "Not found")
	}
}

func (s *projectsStore) handleProjectsCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.mu.Lock()
		defer s.mu.Unlock()
		index, err := s.loadIndexLocked()
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		writeProjectsJSON(w, http.StatusOK, map[string]any{"projects": index.Projects})
	case http.MethodPost:
		s.mu.Lock()
		defer s.mu.Unlock()
		var payload struct {
			Name string `json:"name"`
		}
		if err := decodeProjectsBody(r.Body, maxProjectsJSONBody, &payload); err != nil {
			writeProjectsError(w, http.StatusBadRequest, err.Error())
			return
		}
		name, ok := cleanProjectsName(payload.Name)
		if !ok {
			writeProjectsError(w, http.StatusBadRequest, "name is required")
			return
		}

		projectID, err := randomProjectsID("p_", 6)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		stamp := projectsStamp()
		manifest := ProjectManifest{
			ID:            projectID,
			Name:          name,
			CreatedAt:     stamp,
			UpdatedAt:     stamp,
			SchemaVersion: projectsSchemaVersion,
			Settings:      ProjectSettings{DefaultOutDir: ""},
		}
		if err := os.MkdirAll(s.documentsDir(projectID), 0o755); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if err := os.MkdirAll(filepath.Join(s.assetsDir(projectID), "blobs"), 0o755); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if err := s.saveManifestLocked(manifest); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if err := s.saveAssetIndexLocked(projectID, AssetIndex{}); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		summary := ProjectSummary{ID: projectID, Name: name, UpdatedAt: stamp, Counts: ProjectCounts{}}
		if err := s.saveSummaryLocked(summary); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		writeProjectsJSON(w, http.StatusOK, map[string]any{"project": summary})
	default:
		writeProjectsMethodError(w, "GET, POST")
	}
}

func (s *projectsStore) handleProject(w http.ResponseWriter, r *http.Request, projectID string) {
	switch r.Method {
	case http.MethodGet:
		s.mu.Lock()
		defer s.mu.Unlock()
		manifest, err := s.loadManifestLocked(projectID)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if manifest == nil {
			writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
			return
		}
		writeProjectsJSON(w, http.StatusOK, map[string]any{"project": manifest})
	case http.MethodPatch:
		s.mu.Lock()
		defer s.mu.Unlock()
		manifest, err := s.loadManifestLocked(projectID)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if manifest == nil {
			writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
			return
		}
		var payload projectPatchRequest
		if err := decodeProjectsBody(r.Body, maxProjectsJSONBody, &payload); err != nil {
			writeProjectsError(w, http.StatusBadRequest, err.Error())
			return
		}
		if payload.Name != nil {
			name, ok := cleanProjectsName(*payload.Name)
			if !ok {
				writeProjectsError(w, http.StatusBadRequest, "name must not be empty")
				return
			}
			manifest.Name = name
		}
		if payload.Settings != nil {
			if payload.Settings.DefaultOutDir != nil {
				if strings.ContainsRune(*payload.Settings.DefaultOutDir, '\x00') {
					writeProjectsError(w, http.StatusBadRequest, "invalid defaultOutDir")
					return
				}
				manifest.Settings.DefaultOutDir = *payload.Settings.DefaultOutDir
			}
			if payload.Settings.Theme != nil {
				theme := *payload.Settings.Theme
				if theme != "" && theme != "light" && theme != "dark" {
					writeProjectsError(w, http.StatusBadRequest, "theme must be light, dark or empty")
					return
				}
				manifest.Settings.Theme = theme
			}
		}
		manifest.UpdatedAt = projectsStamp()
		if err := s.saveManifestLocked(*manifest); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		summary, err := s.summarizeLocked(*manifest)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if err := s.saveSummaryLocked(summary); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		writeProjectsJSON(w, http.StatusOK, map[string]any{"project": summary})
	case http.MethodDelete:
		s.mu.Lock()
		defer s.mu.Unlock()
		manifest, err := s.loadManifestLocked(projectID)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if manifest == nil {
			writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
			return
		}
		if err := os.RemoveAll(s.projectDir(projectID)); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		index, err := s.loadIndexLocked()
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		projects := make([]ProjectSummary, 0, len(index.Projects))
		for _, project := range index.Projects {
			if project.ID != projectID {
				projects = append(projects, project)
			}
		}
		index.Projects = projects
		if index.ActiveProjectID == projectID {
			index.ActiveProjectID = ""
		}
		if err := s.saveIndexLocked(index); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		writeProjectsJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		writeProjectsMethodError(w, "GET, PATCH, DELETE")
	}
}

func (s *projectsStore) handleProjectDocument(w http.ResponseWriter, r *http.Request, projectID, tool string) {
	switch r.Method {
	case http.MethodGet:
		s.mu.Lock()
		defer s.mu.Unlock()
		manifest, err := s.loadManifestLocked(projectID)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if manifest == nil {
			writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
			return
		}
		document, err := s.loadDocumentLocked(projectID, tool)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		writeProjectsJSON(w, http.StatusOK, map[string]any{"document": document})
	case http.MethodPut:
		s.mu.Lock()
		defer s.mu.Unlock()
		manifest, err := s.loadManifestLocked(projectID)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if manifest == nil {
			writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
			return
		}
		var payload map[string]json.RawMessage
		if err := decodeProjectsBody(r.Body, maxProjectsJSONBody, &payload); err != nil {
			writeProjectsError(w, http.StatusBadRequest, err.Error())
			return
		}
		rawData, ok := payload["data"]
		if !ok {
			writeProjectsError(w, http.StatusBadRequest, "data is required")
			return
		}
		document := ModuleRecord{
			ProjectID: projectID,
			Tool:      tool,
			Data:      rawData,
			UpdatedAt: projectsStamp(),
		}
		if err := atomicProjectsWriteJSON(s.documentPath(projectID, tool), document); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if err := s.touchProjectLocked(projectID); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		writeProjectsJSON(w, http.StatusOK, map[string]any{"document": document})
	default:
		writeProjectsMethodError(w, "GET, PUT")
	}
}

func (s *projectsStore) handleProjectAssets(w http.ResponseWriter, r *http.Request, projectID string) {
	switch r.Method {
	case http.MethodGet:
		s.mu.Lock()
		defer s.mu.Unlock()
		manifest, err := s.loadManifestLocked(projectID)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if manifest == nil {
			writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
			return
		}
		index, err := s.loadAssetIndexLocked(projectID)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		writeProjectsJSON(w, http.StatusOK, map[string]any{"assets": index.Assets})
	case http.MethodPost:
		s.mu.Lock()
		defer s.mu.Unlock()
		manifest, err := s.loadManifestLocked(projectID)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if manifest == nil {
			writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
			return
		}
		var payload addAssetRequest
		if err := decodeProjectsBody(r.Body, maxProjectsAssetBody, &payload); err != nil {
			status := http.StatusBadRequest
			if errors.Is(err, errProjectsBodyTooLarge) {
				status = http.StatusRequestEntityTooLarge
			}
			writeProjectsError(w, status, err.Error())
			return
		}
		name, ok := cleanProjectsName(payload.Name)
		if !ok {
			writeProjectsError(w, http.StatusBadRequest, "name is required")
			return
		}
		contents, err := base64.StdEncoding.Strict().DecodeString(payload.Base64)
		if err != nil {
			writeProjectsError(w, http.StatusBadRequest, "invalid base64 data")
			return
		}
		if len(contents) > maxProjectsAssetBytes {
			writeProjectsError(w, http.StatusRequestEntityTooLarge, errProjectsAssetTooLarge.Error())
			return
		}

		kind := payload.Kind
		if kind == "" {
			kind = "source"
		}
		mime := payload.Mime
		if mime == "" {
			mime = "application/octet-stream"
		}
		if payload.Origin != nil {
			if payload.Origin.Tool != "" && !validProjectsTool(payload.Origin.Tool) {
				writeProjectsError(w, http.StatusBadRequest, "invalid origin tool")
				return
			}
			if payload.Origin.DerivedFrom != "" && !validAssetID(payload.Origin.DerivedFrom) {
				writeProjectsError(w, http.StatusBadRequest, "invalid origin derivedFrom")
				return
			}
		}
		tags := payload.Tags
		if tags == nil {
			tags = []string{}
		}
		refs := payload.Refs
		if refs == nil {
			refs = []ModuleRef{}
		}
		sum := sha256.Sum256(contents)
		hash := hex.EncodeToString(sum[:])

		index, err := s.loadAssetIndexLocked(projectID)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		used := make(map[string]bool, len(index.Assets))
		for _, existing := range index.Assets {
			used[existing.ID] = true
		}
		assetID, err := newUnusedAssetID(used)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		blobPath := s.blobPath(projectID, hash)
		if _, err := os.Stat(blobPath); errors.Is(err, os.ErrNotExist) {
			if err := atomicProjectsWrite(blobPath, contents); err != nil {
				writeProjectsStoreError(w, err)
				return
			}
		} else if err != nil {
			writeProjectsStoreError(w, err)
			return
		}

		record := AssetRecord{
			ID:        assetID,
			ProjectID: projectID,
			Name:      name,
			Mime:      mime,
			Bytes:     int64(len(contents)),
			Width:     payload.Width,
			Height:    payload.Height,
			Hash:      hash,
			Kind:      kind,
			Origin:    payload.Origin,
			Tags:      tags,
			Refs:      refs,
			CreatedAt: projectsStamp(),
		}
		index.Assets = append(index.Assets, record)
		if err := s.saveAssetIndexLocked(projectID, index); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if err := s.touchProjectLocked(projectID); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		writeProjectsJSON(w, http.StatusOK, map[string]any{"asset": record})
	default:
		writeProjectsMethodError(w, "GET, POST")
	}
}

func newUnusedAssetID(used map[string]bool) (string, error) {
	for range 16 {
		assetID, err := randomProjectsID("a_", 8)
		if err != nil {
			return "", err
		}
		if !used[assetID] {
			used[assetID] = true
			return assetID, nil
		}
	}
	return "", errors.New("could not generate an asset id")
}

func (s *projectsStore) handleAssetBlob(w http.ResponseWriter, r *http.Request, projectID, assetID string) {
	if r.Method != http.MethodGet {
		writeProjectsMethodError(w, http.MethodGet)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	manifest, err := s.loadManifestLocked(projectID)
	if err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	if manifest == nil {
		writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
		return
	}
	index, err := s.loadAssetIndexLocked(projectID)
	if err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	var record *AssetRecord
	for i := range index.Assets {
		if index.Assets[i].ID == assetID {
			record = &index.Assets[i]
			break
		}
	}
	if record == nil {
		writeProjectsError(w, http.StatusNotFound, errAssetNotFound.Error())
		return
	}
	if !validProjectsHash(record.Hash) {
		writeProjectsError(w, http.StatusInternalServerError, "invalid asset hash")
		return
	}
	contents, err := os.ReadFile(s.blobPath(projectID, record.Hash))
	if errors.Is(err, os.ErrNotExist) {
		writeProjectsError(w, http.StatusNotFound, "asset blob not found")
		return
	}
	if err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	writeProjectsJSON(w, http.StatusOK, map[string]any{"base64": base64.StdEncoding.EncodeToString(contents)})
}

func (s *projectsStore) handleProjectAsset(w http.ResponseWriter, r *http.Request, projectID, assetID string) {
	if r.Method != http.MethodDelete {
		writeProjectsMethodError(w, http.MethodDelete)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	manifest, err := s.loadManifestLocked(projectID)
	if err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	if manifest == nil {
		writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
		return
	}
	index, err := s.loadAssetIndexLocked(projectID)
	if err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	var hash string
	remaining := make([]AssetRecord, 0, len(index.Assets))
	for _, asset := range index.Assets {
		if asset.ID == assetID {
			hash = asset.Hash
			continue
		}
		remaining = append(remaining, asset)
	}
	if hash == "" {
		writeProjectsError(w, http.StatusNotFound, errAssetNotFound.Error())
		return
	}
	index.Assets = remaining
	if err := s.saveAssetIndexLocked(projectID, index); err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	if validProjectsHash(hash) && !indexHasHash(index, hash) {
		_ = os.Remove(s.blobPath(projectID, hash))
	}
	if err := s.touchProjectLocked(projectID); err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	writeProjectsJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func indexHasHash(index AssetIndex, hash string) bool {
	for _, asset := range index.Assets {
		if asset.Hash == hash {
			return true
		}
	}
	return false
}

func (s *projectsStore) handleAssetMove(w http.ResponseWriter, r *http.Request, sourceID string) {
	if r.Method != http.MethodPost {
		writeProjectsMethodError(w, http.MethodPost)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	var payload assetMoveRequest
	if err := decodeProjectsBody(r.Body, maxProjectsJSONBody, &payload); err != nil {
		writeProjectsError(w, http.StatusBadRequest, err.Error())
		return
	}
	if payload.Mode != "copy" && payload.Mode != "move" {
		writeProjectsError(w, http.StatusBadRequest, "mode must be copy or move")
		return
	}
	if !validProjectID(payload.TargetProjectID) {
		writeProjectsError(w, http.StatusBadRequest, "invalid targetProjectId")
		return
	}
	targetID := payload.TargetProjectID
	sourceManifest, err := s.loadManifestLocked(sourceID)
	if err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	if sourceManifest == nil {
		writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
		return
	}
	targetManifest, err := s.loadManifestLocked(targetID)
	if err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	if targetManifest == nil {
		writeProjectsError(w, http.StatusNotFound, errProjectNotFound.Error())
		return
	}

	sourceIndex, err := s.loadAssetIndexLocked(sourceID)
	if err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	byID := make(map[string]AssetRecord, len(sourceIndex.Assets))
	for _, asset := range sourceIndex.Assets {
		byID[asset.ID] = asset
	}
	selected := make(map[string]bool, len(payload.AssetIDs))
	for _, assetID := range payload.AssetIDs {
		if !validAssetID(assetID) {
			writeProjectsError(w, http.StatusBadRequest, "invalid asset id")
			return
		}
		if _, ok := byID[assetID]; !ok {
			writeProjectsError(w, http.StatusNotFound, errAssetNotFound.Error())
			return
		}
		selected[assetID] = true
	}
	if payload.IncludeDerived {
		for changed := true; changed; {
			changed = false
			for _, asset := range sourceIndex.Assets {
				if asset.Origin == nil || asset.Origin.DerivedFrom == "" {
					continue
				}
				if selected[asset.Origin.DerivedFrom] && !selected[asset.ID] {
					selected[asset.ID] = true
					changed = true
				}
			}
		}
	}

	ordered := make([]AssetRecord, 0, len(selected))
	for _, asset := range sourceIndex.Assets {
		if selected[asset.ID] {
			ordered = append(ordered, asset)
		}
	}

	if payload.Mode == "move" {
		for _, asset := range ordered {
			referenced, err := s.documentReferencesAssetLocked(sourceID, asset.ID)
			if err != nil {
				writeProjectsStoreError(w, err)
				return
			}
			if referenced {
				writeProjectsError(w, http.StatusConflict, "asset is referenced by a tool document")
				return
			}
		}
	}

	targetIndex, err := s.loadAssetIndexLocked(targetID)
	if err != nil {
		writeProjectsStoreError(w, err)
		return
	}
	used := make(map[string]bool, len(targetIndex.Assets))
	for _, asset := range targetIndex.Assets {
		used[asset.ID] = true
	}
	idMap := make(map[string]string, len(ordered))
	created := make([]AssetRecord, 0, len(ordered))
	for _, asset := range ordered {
		if !validProjectsHash(asset.Hash) {
			writeProjectsStoreError(w, errors.New("invalid asset hash"))
			return
		}
		if sourceID != targetID {
			targetBlob := s.blobPath(targetID, asset.Hash)
			if _, err := os.Stat(targetBlob); errors.Is(err, os.ErrNotExist) {
				contents, err := os.ReadFile(s.blobPath(sourceID, asset.Hash))
				if err != nil {
					writeProjectsStoreError(w, err)
					return
				}
				if err := atomicProjectsWrite(targetBlob, contents); err != nil {
					writeProjectsStoreError(w, err)
					return
				}
			} else if err != nil {
				writeProjectsStoreError(w, err)
				return
			}
		}
		assetID, err := newUnusedAssetID(used)
		if err != nil {
			writeProjectsStoreError(w, err)
			return
		}

		copyRecord := asset
		if asset.Origin != nil {
			origin := *asset.Origin
			copyRecord.Origin = &origin
		}
		copyRecord.Tags = append([]string(nil), asset.Tags...)
		copyRecord.Refs = append([]ModuleRef(nil), asset.Refs...)
		copyRecord.ID = assetID
		copyRecord.ProjectID = targetID
		idMap[asset.ID] = assetID
		created = append(created, copyRecord)
	}
	for i := range created {
		if created[i].Origin != nil && created[i].Origin.DerivedFrom != "" {
			if mapped, ok := idMap[created[i].Origin.DerivedFrom]; ok {
				created[i].Origin.DerivedFrom = mapped
			}
		}
	}

	remaining := make([]AssetRecord, 0, len(sourceIndex.Assets))
	for _, asset := range sourceIndex.Assets {
		if !selected[asset.ID] {
			remaining = append(remaining, asset)
		}
	}

	if sourceID == targetID {
		final := append(remaining, created...)
		sourceIndex.Assets = final
		if err := s.saveAssetIndexLocked(sourceID, sourceIndex); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if err := s.touchProjectLocked(sourceID); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
	} else {
		if payload.Mode == "move" {
			sourceIndex.Assets = remaining
			if err := s.saveAssetIndexLocked(sourceID, sourceIndex); err != nil {
				writeProjectsStoreError(w, err)
				return
			}
			for _, asset := range ordered {
				if !indexHasHash(sourceIndex, asset.Hash) && validProjectsHash(asset.Hash) {
					_ = os.Remove(s.blobPath(sourceID, asset.Hash))
				}
			}
			if err := s.touchProjectLocked(sourceID); err != nil {
				writeProjectsStoreError(w, err)
				return
			}
		}
		targetIndex.Assets = append(targetIndex.Assets, created...)
		if err := s.saveAssetIndexLocked(targetID, targetIndex); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
		if err := s.touchProjectLocked(targetID); err != nil {
			writeProjectsStoreError(w, err)
			return
		}
	}
	writeProjectsJSON(w, http.StatusOK, map[string]any{"assets": created})
}
