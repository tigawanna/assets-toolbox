package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

var (
	testProjectIDPattern = regexp.MustCompile(`^p_[0-9a-f]{12}$`)
	testAssetIDPattern   = regexp.MustCompile(`^a_[0-9a-f]{16}$`)
)

func newTestProjectsHandler(t *testing.T) (*projectsStore, http.Handler) {
	t.Helper()
	t.Setenv("ASSETS_TOOLBOX_DATA", t.TempDir())
	store := newProjectsStore(defaultProjectsRoot())
	if store.root == "" {
		t.Fatal("projects root is unavailable")
	}
	return store, store.handler()
}

func serveProjects(t *testing.T, handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var reader *strings.Reader
	if body != "" {
		reader = strings.NewReader(body)
	} else {
		reader = strings.NewReader("")
	}
	request := httptest.NewRequest(method, path, reader)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func requireProjectsStatus(t *testing.T, recorder *httptest.ResponseRecorder, want int) {
	t.Helper()
	if recorder.Code != want {
		t.Fatalf("status = %d, want %d; body = %s", recorder.Code, want, recorder.Body.String())
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", contentType)
	}
}

func createTestProject(t *testing.T, handler http.Handler, name string) ProjectSummary {
	t.Helper()
	recorder := serveProjects(t, handler, http.MethodPost, "/api/projects", fmt.Sprintf(`{"name":%q}`, name))
	requireProjectsStatus(t, recorder, http.StatusOK)
	var response struct {
		Project ProjectSummary `json:"project"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if !testProjectIDPattern.MatchString(response.Project.ID) {
		t.Fatalf("project id = %q", response.Project.ID)
	}
	return response.Project
}

func addTestAsset(t *testing.T, handler http.Handler, projectID, name string, contents []byte, extraFields string) AssetRecord {
	t.Helper()
	body := fmt.Sprintf(
		`{"name":%q,"mime":"image/png","base64":%q%s}`,
		name,
		base64.StdEncoding.EncodeToString(contents),
		extraFields,
	)
	recorder := serveProjects(t, handler, http.MethodPost, "/api/projects/"+projectID+"/assets", body)
	requireProjectsStatus(t, recorder, http.StatusOK)
	var response struct {
		Asset AssetRecord `json:"asset"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if !testAssetIDPattern.MatchString(response.Asset.ID) {
		t.Fatalf("asset id = %q", response.Asset.ID)
	}
	return response.Asset
}

func listTestAssets(t *testing.T, handler http.Handler, projectID string) []AssetRecord {
	t.Helper()
	recorder := serveProjects(t, handler, http.MethodGet, "/api/projects/"+projectID+"/assets", "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	var response struct {
		Assets []AssetRecord `json:"assets"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response.Assets
}

func TestProjectsCreateListRenameDelete(t *testing.T) {
	store, handler := newTestProjectsHandler(t)

	recorder := serveProjects(t, handler, http.MethodGet, "/api/projects", "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	if body := strings.TrimSpace(recorder.Body.String()); body != `{"projects":[]}` {
		t.Fatalf("empty list = %s", body)
	}

	project := createTestProject(t, handler, "  Brand refresh  ")
	if project.Name != "Brand refresh" {
		t.Fatalf("name = %q", project.Name)
	}
	if project.Counts.Assets != 0 || project.Counts.Tools != 0 {
		t.Fatalf("counts = %+v", project.Counts)
	}
	if project.UpdatedAt == "" {
		t.Fatal("updatedAt is empty")
	}

	recorder = serveProjects(t, handler, http.MethodGet, "/api/projects/"+project.ID, "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	var detail struct {
		Project ProjectManifest `json:"project"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if detail.Project.ID != project.ID || detail.Project.SchemaVersion != 1 {
		t.Fatalf("manifest = %+v", detail.Project)
	}
	if detail.Project.CreatedAt == "" || detail.Project.UpdatedAt == "" {
		t.Fatalf("manifest timestamps = %+v", detail.Project)
	}

	recorder = serveProjects(t, handler, http.MethodGet, "/api/projects", "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	var list struct {
		Projects []ProjectSummary `json:"projects"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list.Projects) != 1 || list.Projects[0].ID != project.ID {
		t.Fatalf("list = %+v", list.Projects)
	}

	recorder = serveProjects(t, handler, http.MethodPatch, "/api/projects/"+project.ID,
		`{"name":"Renamed","settings":{"defaultOutDir":"dist","theme":"dark"}}`)
	requireProjectsStatus(t, recorder, http.StatusOK)
	var renamed struct {
		Project ProjectSummary `json:"project"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &renamed); err != nil {
		t.Fatal(err)
	}
	if renamed.Project.Name != "Renamed" {
		t.Fatalf("renamed = %+v", renamed.Project)
	}

	recorder = serveProjects(t, handler, http.MethodGet, "/api/projects/"+project.ID, "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	detail = struct {
		Project ProjectManifest `json:"project"`
	}{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if detail.Project.Name != "Renamed" || detail.Project.Settings.DefaultOutDir != "dist" || detail.Project.Settings.Theme != "dark" {
		t.Fatalf("updated manifest = %+v", detail.Project)
	}

	info, err := os.Stat(filepath.Join(store.root, "projects.json"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("projects.json mode = %o, want 600", info.Mode().Perm())
	}

	recorder = serveProjects(t, handler, http.MethodDelete, "/api/projects/"+project.ID, "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	if body := strings.TrimSpace(recorder.Body.String()); body != `{"ok":true}` {
		t.Fatalf("delete body = %s", body)
	}
	recorder = serveProjects(t, handler, http.MethodGet, "/api/projects/"+project.ID, "")
	requireProjectsStatus(t, recorder, http.StatusNotFound)
	recorder = serveProjects(t, handler, http.MethodGet, "/api/projects", "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	if body := strings.TrimSpace(recorder.Body.String()); body != `{"projects":[]}` {
		t.Fatalf("list after delete = %s", body)
	}
}

func TestProjectsDocumentSaveAndLoad(t *testing.T) {
	_, handler := newTestProjectsHandler(t)
	project := createTestProject(t, handler, "Documents")

	path := "/api/projects/" + project.ID + "/documents/compose"
	recorder := serveProjects(t, handler, http.MethodGet, path, "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	if body := strings.TrimSpace(recorder.Body.String()); body != `{"document":null}` {
		t.Fatalf("empty document = %s", body)
	}

	recorder = serveProjects(t, handler, http.MethodPut, path, `{"data":{"shapes":[1,2],"title":"Draft"}}`)
	requireProjectsStatus(t, recorder, http.StatusOK)
	var saved struct {
		Document ModuleRecord `json:"document"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &saved); err != nil {
		t.Fatal(err)
	}
	if saved.Document.ProjectID != project.ID || saved.Document.Tool != "compose" {
		t.Fatalf("document metadata = %+v", saved.Document)
	}
	if !strings.Contains(string(saved.Document.Data), `"shapes":[1,2]`) {
		t.Fatalf("document data = %s", saved.Document.Data)
	}
	if saved.Document.UpdatedAt == "" {
		t.Fatal("document updatedAt is empty")
	}

	recorder = serveProjects(t, handler, http.MethodGet, path, "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	var loaded struct {
		Document ModuleRecord `json:"document"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &loaded); err != nil {
		t.Fatal(err)
	}
	if string(loaded.Document.Data) != string(saved.Document.Data) || loaded.Document.UpdatedAt != saved.Document.UpdatedAt {
		t.Fatalf("loaded document = %+v", loaded.Document)
	}

	recorder = serveProjects(t, handler, http.MethodGet, "/api/projects", "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	var list struct {
		Projects []ProjectSummary `json:"projects"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list.Projects) != 1 || list.Projects[0].Counts.Tools != 1 {
		t.Fatalf("tool count = %+v", list.Projects[0].Counts)
	}

	requireProjectsStatus(t, serveProjects(t, handler, http.MethodPut, path, `{"other":1}`), http.StatusBadRequest)
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodPut, path, `{`), http.StatusBadRequest)
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodDelete, path, ""), http.StatusMethodNotAllowed)
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodGet,
		"/api/projects/"+project.ID+"/documents/unknown", ""), http.StatusNotFound)
}

func TestProjectsAssetAddBlobAndDedupe(t *testing.T) {
	store, handler := newTestProjectsHandler(t)
	project := createTestProject(t, handler, "Assets")

	first := addTestAsset(t, handler, project.ID, "logo.png", []byte("hello"), "")
	if first.Bytes != 5 || first.Hash != "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" {
		t.Fatalf("asset metadata = %+v", first)
	}
	if first.Kind != "source" || first.Tags == nil || first.Refs == nil {
		t.Fatalf("asset defaults = %+v", first)
	}
	second := addTestAsset(t, handler, project.ID, "logo-copy.png", []byte("hello"), "")
	if second.Hash != first.Hash || second.ID == first.ID {
		t.Fatalf("dedupe metadata = %+v / %+v", first, second)
	}

	blobPath := store.blobPath(project.ID, first.Hash)
	info, err := os.Stat(blobPath)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("blob mode = %o, want 600", info.Mode().Perm())
	}
	blobRoot := filepath.Join(store.root, "projects", project.ID, "assets", "blobs")
	blobCount := 0
	if err := filepath.Walk(blobRoot, func(_ string, entry os.FileInfo, err error) error {
		if err == nil && !entry.IsDir() {
			blobCount++
		}
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if blobCount != 1 {
		t.Fatalf("blob count = %d, want 1", blobCount)
	}

	recorder := serveProjects(t, handler, http.MethodGet,
		"/api/projects/"+project.ID+"/assets/"+first.ID+"/blob", "")
	requireProjectsStatus(t, recorder, http.StatusOK)
	var blob struct {
		Base64 string `json:"base64"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &blob); err != nil {
		t.Fatal(err)
	}
	if blob.Base64 != base64.StdEncoding.EncodeToString([]byte("hello")) {
		t.Fatalf("blob base64 = %q", blob.Base64)
	}

	assets := listTestAssets(t, handler, project.ID)
	if len(assets) != 2 {
		t.Fatalf("assets = %+v", assets)
	}

	requireProjectsStatus(t, serveProjects(t, handler, http.MethodPost,
		"/api/projects/"+project.ID+"/assets", `{"name":"bad","mime":"text/plain","base64":"!!!!"}`), http.StatusBadRequest)
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodPost,
		"/api/projects/"+project.ID+"/assets", fmt.Sprintf(`{"name":"big","base64":%q}`,
			base64.StdEncoding.EncodeToString(make([]byte, maxProjectsAssetBytes+1)))), http.StatusRequestEntityTooLarge)

	requireProjectsStatus(t, serveProjects(t, handler, http.MethodDelete,
		"/api/projects/"+project.ID+"/assets/"+first.ID, ""), http.StatusOK)
	if _, err := os.Stat(blobPath); err != nil {
		t.Fatalf("shared blob was removed too early: %v", err)
	}
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodDelete,
		"/api/projects/"+project.ID+"/assets/"+second.ID, ""), http.StatusOK)
	if _, err := os.Stat(blobPath); !os.IsNotExist(err) {
		t.Fatalf("orphaned blob still exists: %v", err)
	}
	if assets := listTestAssets(t, handler, project.ID); len(assets) != 0 {
		t.Fatalf("assets after delete = %+v", assets)
	}
}

func TestProjectsMoveAndCopyWithDerivedAssets(t *testing.T) {
	store, handler := newTestProjectsHandler(t)
	source := createTestProject(t, handler, "Source")
	target := createTestProject(t, handler, "Target")

	root := addTestAsset(t, handler, source.ID, "root.svg", []byte("root"), "")
	derived := addTestAsset(t, handler, source.ID, "derived.png", []byte("derived"),
		fmt.Sprintf(`,"origin":{"tool":"expo","derivedFrom":%q}`, root.ID))
	addTestAsset(t, handler, source.ID, "grand.png", []byte("grand"),
		fmt.Sprintf(`,"origin":{"tool":"brand","derivedFrom":%q}`, derived.ID))
	loose := addTestAsset(t, handler, source.ID, "loose.png", []byte("loose"), "")

	movePath := "/api/projects/" + source.ID + "/assets/move"
	copyBody := fmt.Sprintf(
		`{"assetIds":[%q],"targetProjectId":%q,"mode":"copy","includeDerived":true}`,
		root.ID, target.ID,
	)
	recorder := serveProjects(t, handler, http.MethodPost, movePath, copyBody)
	requireProjectsStatus(t, recorder, http.StatusOK)
	var copied struct {
		Assets []AssetRecord `json:"assets"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &copied); err != nil {
		t.Fatal(err)
	}
	if len(copied.Assets) != 3 {
		t.Fatalf("copied assets = %+v", copied.Assets)
	}
	byName := map[string]AssetRecord{}
	for _, asset := range copied.Assets {
		byName[asset.Name] = asset
		if asset.ProjectID != target.ID || !testAssetIDPattern.MatchString(asset.ID) {
			t.Fatalf("copied asset = %+v", asset)
		}
	}
	if byName["derived.png"].Origin == nil || byName["derived.png"].Origin.DerivedFrom != byName["root.svg"].ID {
		t.Fatalf("derived origin was not remapped: %+v", byName["derived.png"])
	}
	if byName["grand.png"].Origin == nil || byName["grand.png"].Origin.DerivedFrom != byName["derived.png"].ID {
		t.Fatalf("transitive derived origin was not remapped: %+v", byName["grand.png"])
	}
	if len(listTestAssets(t, handler, source.ID)) != 4 {
		t.Fatal("copy removed source assets")
	}
	for _, asset := range copied.Assets {
		if _, err := os.Stat(store.blobPath(target.ID, asset.Hash)); err != nil {
			t.Fatalf("target blob missing for %s: %v", asset.Name, err)
		}
	}

	// A document reference blocks a move but not a copy.
	docPath := "/api/projects/" + source.ID + "/documents/compose"
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodPut, docPath,
		fmt.Sprintf(`{"data":{"asset":%q}}`, derived.ID)), http.StatusOK)
	blocked := fmt.Sprintf(
		`{"assetIds":[%q],"targetProjectId":%q,"mode":"move","includeDerived":false}`,
		derived.ID, target.ID,
	)
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodPost, movePath, blocked), http.StatusConflict)
	allowed := fmt.Sprintf(
		`{"assetIds":[%q],"targetProjectId":%q,"mode":"copy","includeDerived":false}`,
		derived.ID, target.ID,
	)
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodPost, movePath, allowed), http.StatusOK)

	moving := fmt.Sprintf(
		`{"assetIds":[%q],"targetProjectId":%q,"mode":"move","includeDerived":false}`,
		loose.ID, target.ID,
	)
	recorder = serveProjects(t, handler, http.MethodPost, movePath, moving)
	requireProjectsStatus(t, recorder, http.StatusOK)
	var moved struct {
		Assets []AssetRecord `json:"assets"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &moved); err != nil {
		t.Fatal(err)
	}
	if len(moved.Assets) != 1 || moved.Assets[0].Name != "loose.png" {
		t.Fatalf("moved assets = %+v", moved.Assets)
	}
	remaining := listTestAssets(t, handler, source.ID)
	if len(remaining) != 3 {
		t.Fatalf("source assets after move = %+v", remaining)
	}
	for _, asset := range remaining {
		if asset.ID == loose.ID {
			t.Fatal("moved asset still in source")
		}
	}
	if _, err := os.Stat(store.blobPath(source.ID, loose.Hash)); !os.IsNotExist(err) {
		t.Fatalf("orphaned source blob still exists: %v", err)
	}

	requireProjectsStatus(t, serveProjects(t, handler, http.MethodPost, movePath,
		`{"assetIds":[],"targetProjectId":"p_000000000000","mode":"copy"}`), http.StatusNotFound)
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodPost, movePath,
		fmt.Sprintf(`{"assetIds":[%q],"targetProjectId":%q,"mode":"bad"}`, root.ID, target.ID)), http.StatusBadRequest)
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodGet, movePath, ""), http.StatusMethodNotAllowed)
}

func TestProjectsPathValidation(t *testing.T) {
	_, handler := newTestProjectsHandler(t)
	project := createTestProject(t, handler, "Valid")

	for _, path := range []string{
		"/api/projects/../projects.json",
		"/api/projects/%2e%2e%2fprojects.json",
		"/api/projects/p_123456789abc%5c..",
		"/api/projects/p_123456789abc%00",
		"/api/projects/" + project.ID + "/assets/..%2findex.json/blob",
		"/api/projects/" + project.ID + "/documents/..%2f..%2fproject.json",
	} {
		t.Run(path, func(t *testing.T) {
			requireProjectsStatus(t, serveProjects(t, handler, http.MethodGet, path, ""), http.StatusBadRequest)
		})
	}

	for _, path := range []string{
		"/api/projects/p_notavalidid",
		"/api/projects/p_000000000000",
		"/api/projects/" + project.ID + "/documents/unknown",
		"/api/projects/" + project.ID + "/assets/a_0000000000000000/blob",
	} {
		t.Run(path, func(t *testing.T) {
			requireProjectsStatus(t, serveProjects(t, handler, http.MethodGet, path, ""), http.StatusNotFound)
		})
	}

	requireProjectsStatus(t, serveProjects(t, handler, http.MethodDelete, "/api/projects", ""), http.StatusMethodNotAllowed)
	requireProjectsStatus(t, serveProjects(t, handler, http.MethodPut, "/api/projects", ""), http.StatusMethodNotAllowed)
}

func TestProjectsMiddlewareRoutesPrefixWithoutBreakingExactRoutes(t *testing.T) {
	_, projects := newTestProjectsHandler(t)
	nextCalled := false
	workspaceCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusTeapot)
	})
	workspace := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		workspaceCalled = true
		w.WriteHeader(http.StatusNoContent)
	})
	routes := map[string]http.Handler{
		"/api/workspace": workspace,
		"/api/projects":  projects,
	}
	handler := newProjectsModuleMiddleware(routes, next)

	project := createTestProject(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handler.ServeHTTP(w, r)
	}), "Through middleware")
	if project.ID == "" {
		t.Fatal("project was not created through the middleware")
	}

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/workspace", nil))
	if !workspaceCalled {
		t.Fatal("existing workspace route was not reached")
	}
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/packages/svg-compose", nil))
	if !nextCalled {
		t.Fatal("unrelated route did not fall through")
	}
}
