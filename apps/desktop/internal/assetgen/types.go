// Package assetgen stages user-selected files into private per-job directories,
// runs a Node sidecar that generates desktop assets, and validates everything
// the sidecar reports before handing results back to the Wails layer.
//
// Staging directories live under os.TempDir() with 0700 permissions. They are
// kept after a successful run so the UI can preview generated files, and are
// removed by Discard or Close (and automatically when a job fails). Artifact
// bytes are never embedded in a Result: ArtifactPath returns a validated path
// that the preview layer can read directly from disk.
package assetgen

import "errors"

const (
	// maxInputBytes is the largest single user-selected input file we stage.
	maxInputBytes int64 = 8 << 20
	// maxArtifactBytes is the largest single file the worker may report.
	maxArtifactBytes int64 = 16 << 20
	// maxWorkerStdout bounds the JSON protocol line read from the worker.
	maxWorkerStdout = 4 << 20
	// maxWorkerStderr bounds diagnostic text kept for error messages.
	maxWorkerStderr = 64 << 10
)

// Errors returned by the public API. Callers can use errors.Is to distinguish
// them from validation failures and worker protocol errors.
var (
	ErrUnsupportedTool = errors.New("unsupported asset generation tool")
	ErrUnknownJob      = errors.New("unknown job")
	ErrManagerClosed   = errors.New("asset generation manager is closed")
)

// Request describes one asset generation job. JobID may be empty, in which
// case the manager generates a random identifier. OutDir defaults to "out"
// and must be a safe path relative to the job root.
type Request struct {
	Tool       string            `json:"tool"`
	JobID      string            `json:"jobId"`
	InputPaths map[string]string `json:"inputPaths"`
	Options    map[string]any    `json:"options"`
	OutDir     string            `json:"outDir"`
}

// Artifact is one validated file produced by the worker. Path is absolute and
// points inside the private job root. Data is intentionally omitted from JSON
// and is never populated by Start; use ArtifactPath to obtain a safe path for
// on-demand preview reads.
type Artifact struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	Bytes  int64  `json:"bytes"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Data   []byte `json:"-"`
}

// Result is the validated response returned by Start.
type Result struct {
	JobID       string         `json:"jobId"`
	Artifacts   []Artifact     `json:"artifacts"`
	Config      map[string]any `json:"config,omitempty"`
	ConfigPath  string         `json:"configPath,omitempty"`
	AgentPrompt string         `json:"agentPrompt,omitempty"`
}

// workerRequest is the stdin protocol sent to the Node sidecar.
type workerRequest struct {
	Tool    string            `json:"tool"`
	JobID   string            `json:"jobId"`
	Root    string            `json:"root"`
	Inputs  map[string]string `json:"inputs"`
	Options map[string]any    `json:"options"`
	OutDir  string            `json:"outDir"`
}

// workerArtifact is an unvalidated artifact reported by the worker.
type workerArtifact struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	Bytes  int64  `json:"bytes"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

// workerResponse is the stdout JSON-line protocol of the sidecar.
type workerResponse struct {
	OK          bool             `json:"ok"`
	Error       string           `json:"error,omitempty"`
	Code        string           `json:"code,omitempty"`
	Artifacts   []workerArtifact `json:"artifacts,omitempty"`
	Config      map[string]any   `json:"config,omitempty"`
	ConfigPath  string           `json:"configPath,omitempty"`
	AgentPrompt string           `json:"agentPrompt,omitempty"`
}
