package assetgen

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
)

var (
	safeJobIDRE        = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$`)
	safeRoleRE         = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`)
	safeExtensionRE    = regexp.MustCompile(`^\.[A-Za-z0-9]{1,10}$`)
	safeArtifactNameRE = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)
)

// jobRecord keeps the staging root alive for preview reads until the job is
// discarded. Fields touched by more than one goroutine are guarded by
// Manager.mu.
type jobRecord struct {
	id        string
	root      string
	cancel    context.CancelFunc
	done      bool
	artifacts map[string]string // artifact name -> path relative to root
}

// Manager stages inputs, runs the worker sidecar, and owns the lifetime of
// every job's temporary directory. It is safe for concurrent use.
type Manager struct {
	mu         sync.Mutex
	workerPath string
	jobs       map[string]*jobRecord
	closed     bool
}

// NewManager creates a Manager that invokes workerPath with `node`. A relative
// workerPath is resolved against the current working directory immediately so
// it keeps working after a job changes the child process's directory.
func NewManager(workerPath string) *Manager {
	if workerPath != "" {
		if absolute, err := filepath.Abs(workerPath); err == nil {
			workerPath = absolute
		}
	}
	return &Manager{
		workerPath: workerPath,
		jobs:       make(map[string]*jobRecord),
	}
}

// Start stages req.InputPaths into a private job root, runs the worker and
// returns validated results. On any error the staging root is removed. On
// success the root is retained until Discard or Close.
func (m *Manager) Start(ctx context.Context, req Request) (result Result, err error) {
	if ctx == nil {
		ctx = context.Background()
	}
	m.mu.Lock()
	closed := m.closed
	m.mu.Unlock()
	if closed {
		return Result{}, ErrManagerClosed
	}
	if err := validateRequest(req); err != nil {
		return Result{}, err
	}
	worker, err := m.resolveWorkerPath()
	if err != nil {
		return Result{}, err
	}

	jobID := req.JobID
	if jobID == "" {
		jobID, err = randomJobID()
		if err != nil {
			return Result{}, fmt.Errorf("generate job id: %w", err)
		}
	}
	root, err := os.MkdirTemp(os.TempDir(), "assetgen-"+jobID+"-")
	if err != nil {
		return Result{}, fmt.Errorf("create job root: %w", err)
	}

	jobCtx, jobCancel := context.WithCancel(ctx)
	job := &jobRecord{
		id:        jobID,
		root:      root,
		cancel:    jobCancel,
		artifacts: make(map[string]string),
	}
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		jobCancel()
		_ = os.RemoveAll(root)
		return Result{}, ErrManagerClosed
	}
	if _, exists := m.jobs[jobID]; exists {
		m.mu.Unlock()
		jobCancel()
		_ = os.RemoveAll(root)
		return Result{}, fmt.Errorf("job %q is already registered", jobID)
	}
	m.jobs[jobID] = job
	m.mu.Unlock()

	// Any failure from this point on leaves no staging behind.
	defer func() {
		if err != nil {
			m.discard(jobID)
		}
	}()

	outDir := normalizeOutDir(req.OutDir)
	if err = os.MkdirAll(filepath.Join(root, outDir), 0700); err != nil {
		return Result{}, fmt.Errorf("create output directory: %w", err)
	}
	inputs, err := stageInputs(root, req.InputPaths)
	if err != nil {
		return Result{}, err
	}

	options := req.Options
	if options == nil {
		options = make(map[string]any)
	}
	payload, err := json.Marshal(workerRequest{
		Tool:    req.Tool,
		JobID:   jobID,
		Root:    root,
		Inputs:  inputs,
		Options: options,
		OutDir:  outDir,
	})
	if err != nil {
		return Result{}, fmt.Errorf("encode worker request: %w", err)
	}

	cmd := exec.CommandContext(jobCtx, "node", worker)
	cmd.Dir = root
	stdout := &boundedBuffer{limit: maxWorkerStdout}
	stderr := &boundedBuffer{limit: maxWorkerStderr}
	cmd.Stdout = stdout
	cmd.Stderr = stderr

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return Result{}, fmt.Errorf("open worker stdin: %w", err)
	}
	writeResult := make(chan error, 1)
	go func() {
		_, writeErr := stdin.Write(payload)
		closeErr := stdin.Close()
		if writeErr == nil {
			writeErr = closeErr
		}
		writeResult <- writeErr
	}()

	runErr := cmd.Run()
	// Wait closes the parent side of the stdin pipe. Closing it here as well
	// unblocks the writer if the process never started at all.
	_ = stdin.Close()
	stdinErr := <-writeResult
	if cause := jobCtx.Err(); cause != nil {
		return Result{}, fmt.Errorf("job %q canceled: %w", jobID, cause)
	}

	out := stdout.Bytes()
	diagnostics := strings.TrimSpace(stderr.String())
	if len(bytes.TrimSpace(out)) == 0 {
		return Result{}, fmt.Errorf("worker produced no output (exit: %v, stderr: %q)", runErr, preview(diagnostics))
	}
	line := out
	if index := bytes.IndexByte(out, '\n'); index >= 0 {
		line = out[:index]
	}
	line = bytes.TrimSpace(line)
	var response workerResponse
	if err = json.Unmarshal(line, &response); err != nil {
		return Result{}, fmt.Errorf("decode worker response: %w (stdout: %q, stderr: %q)", err, preview(string(line)), preview(diagnostics))
	}
	if !response.OK {
		code := response.Code
		if code == "" {
			code = "WORKER_ERROR"
		}
		return Result{}, fmt.Errorf("worker error [%s]: %s", code, response.Error)
	}
	if runErr != nil {
		return Result{}, fmt.Errorf("worker exited with error: %w (stderr: %q)", runErr, preview(diagnostics))
	}
	if stdinErr != nil && !isIgnorableWriteError(stdinErr) {
		return Result{}, fmt.Errorf("write worker stdin: %w", stdinErr)
	}

	artifactPaths := make(map[string]string, len(response.Artifacts))
	result = Result{
		JobID:       jobID,
		Config:      response.Config,
		ConfigPath:  "",
		AgentPrompt: response.AgentPrompt,
	}
	for _, reported := range response.Artifacts {
		if !safeArtifactNameRE.MatchString(reported.Name) {
			return Result{}, fmt.Errorf("invalid artifact name %q", reported.Name)
		}
		if _, duplicate := artifactPaths[reported.Name]; duplicate {
			return Result{}, fmt.Errorf("duplicate artifact %q", reported.Name)
		}
		if reported.Bytes < 0 || reported.Width < 0 || reported.Height < 0 {
			return Result{}, fmt.Errorf("artifact %q: negative size or dimension", reported.Name)
		}
		absolute, relative, resolveErr := resolveInRoot(root, reported.Path)
		if resolveErr != nil {
			return Result{}, fmt.Errorf("artifact %q: %w", reported.Name, resolveErr)
		}
		if filepath.Base(relative) != reported.Name {
			return Result{}, fmt.Errorf("artifact %q: path %q has an unexpected name", reported.Name, reported.Path)
		}
		info, statErr := os.Stat(absolute)
		if statErr != nil {
			return Result{}, fmt.Errorf("artifact %q: %w", reported.Name, statErr)
		}
		if !info.Mode().IsRegular() {
			return Result{}, fmt.Errorf("artifact %q: not a regular file", reported.Name)
		}
		if info.Size() > maxArtifactBytes {
			return Result{}, fmt.Errorf("artifact %q: exceeds %d MiB", reported.Name, maxArtifactBytes>>20)
		}
		if reported.Bytes != info.Size() {
			return Result{}, fmt.Errorf("artifact %q: reported %d bytes, found %d on disk", reported.Name, reported.Bytes, info.Size())
		}
		result.Artifacts = append(result.Artifacts, Artifact{
			Name:   reported.Name,
			Path:   absolute,
			Bytes:  info.Size(),
			Width:  reported.Width,
			Height: reported.Height,
		})
		artifactPaths[reported.Name] = relative
	}

	if response.ConfigPath != "" {
		absolute, _, resolveErr := resolveInRoot(root, response.ConfigPath)
		if resolveErr != nil {
			return Result{}, fmt.Errorf("configPath: %w", resolveErr)
		}
		info, statErr := os.Stat(absolute)
		if statErr != nil {
			return Result{}, fmt.Errorf("configPath: %w", statErr)
		}
		if !info.Mode().IsRegular() || info.Size() > maxArtifactBytes {
			return Result{}, fmt.Errorf("configPath: not a regular file or exceeds %d MiB", maxArtifactBytes>>20)
		}
		result.ConfigPath = absolute
	}

	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return Result{}, ErrManagerClosed
	}
	job.artifacts = artifactPaths
	job.done = true
	m.mu.Unlock()
	jobCancel()

	return result, nil
}

// Cancel requests cancellation of a running job. It returns false if the job
// is unknown or has already completed. The staging directory is removed by
// Start when it observes the cancellation.
func (m *Manager) Cancel(jobID string) bool {
	m.mu.Lock()
	job := m.jobs[jobID]
	var cancel context.CancelFunc
	if job != nil && !job.done {
		cancel = job.cancel
	}
	m.mu.Unlock()
	if cancel == nil {
		return false
	}
	cancel()
	return true
}

// ArtifactPath returns the validated absolute path of one artifact of a
// completed job. The file is re-checked so a symlink swapped in after the job
// finished cannot be used to escape the staging root. Bytes remain on disk;
// they are deliberately not embedded in Result.
func (m *Manager) ArtifactPath(jobID, name string) (string, error) {
	m.mu.Lock()
	job := m.jobs[jobID]
	var relative string
	if job != nil {
		relative = job.artifacts[name]
	}
	m.mu.Unlock()
	if job == nil {
		return "", fmt.Errorf("%w: %s", ErrUnknownJob, jobID)
	}
	if relative == "" {
		return "", fmt.Errorf("unknown artifact %q for job %q", name, jobID)
	}
	absolute, _, err := resolveInRoot(job.root, relative)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return "", fmt.Errorf("artifact %q: %w", name, err)
	}
	if !info.Mode().IsRegular() || info.Size() > maxArtifactBytes {
		return "", fmt.Errorf("artifact %q: not a regular file or exceeds %d MiB", name, maxArtifactBytes>>20)
	}
	// Confirm the bytes are readable on demand without copying them into a
	// Result. A failed open here is reported instead of returning a dead path.
	file, err := os.Open(absolute)
	if err != nil {
		return "", fmt.Errorf("artifact %q: %w", name, err)
	}
	_ = file.Close()
	return absolute, nil
}

// JobRoot returns the absolute staging root of a known job.
func (m *Manager) JobRoot(jobID string) (string, error) {
	m.mu.Lock()
	job := m.jobs[jobID]
	m.mu.Unlock()
	if job == nil {
		return "", fmt.Errorf("%w: %s", ErrUnknownJob, jobID)
	}
	return job.root, nil
}

// Discard removes a job from the manager and deletes its staging directory.
// Discarding an unknown job is a no-op.
func (m *Manager) Discard(jobID string) {
	m.discard(jobID)
}

// Close cancels any running jobs, removes every staging directory and marks
// the manager unusable. It is safe to call more than once.
func (m *Manager) Close() {
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return
	}
	m.closed = true
	jobs := make([]*jobRecord, 0, len(m.jobs))
	for _, job := range m.jobs {
		jobs = append(jobs, job)
	}
	m.jobs = make(map[string]*jobRecord)
	m.mu.Unlock()

	for _, job := range jobs {
		if job.cancel != nil {
			job.cancel()
		}
		_ = os.RemoveAll(job.root)
	}
}

func (m *Manager) discard(jobID string) {
	m.mu.Lock()
	job := m.jobs[jobID]
	delete(m.jobs, jobID)
	m.mu.Unlock()
	if job == nil {
		return
	}
	if job.cancel != nil {
		job.cancel()
	}
	_ = os.RemoveAll(job.root)
}

func (m *Manager) resolveWorkerPath() (string, error) {
	if m.workerPath == "" {
		return "", errors.New("worker path is required")
	}
	info, err := os.Stat(m.workerPath)
	if err != nil {
		return "", fmt.Errorf("worker: %w", err)
	}
	if !info.Mode().IsRegular() {
		return "", errors.New("worker path is not a regular file")
	}
	return m.workerPath, nil
}

func validateRequest(req Request) error {
	if req.Tool != "expo" {
		return fmt.Errorf("%w: %q", ErrUnsupportedTool, req.Tool)
	}
	if req.JobID != "" && !safeJobIDRE.MatchString(req.JobID) {
		return fmt.Errorf("unsafe job id %q", req.JobID)
	}
	for role := range req.InputPaths {
		if !safeRoleRE.MatchString(role) {
			return fmt.Errorf("unsafe input role %q", role)
		}
	}
	if _, err := normalizeOutDirChecked(req.OutDir); err != nil {
		return fmt.Errorf("invalid outDir: %w", err)
	}
	return nil
}

func normalizeOutDir(value string) string {
	normalized, err := normalizeOutDirChecked(value)
	if err != nil {
		return "out" // validateRequest rejects the request before this is used.
	}
	return normalized
}

func normalizeOutDirChecked(value string) (string, error) {
	if value == "" {
		return "out", nil
	}
	if strings.ContainsRune(value, 0) || strings.Contains(value, "\\") {
		return "", errors.New("path contains an illegal character")
	}
	if filepath.IsAbs(value) || filepath.VolumeName(value) != "" {
		return "", errors.New("path must be relative to the job root")
	}
	for _, part := range strings.Split(value, "/") {
		if part == "" || part == "." || part == ".." {
			return "", errors.New("path contains an unsafe segment")
		}
	}
	cleaned := filepath.Clean(value)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
		return "", errors.New("path must stay inside the job root")
	}
	return cleaned, nil
}

// stageInputs copies each selected file to inputs/<role><ext> inside root.
// Nothing outside the job root is written and unsafe sources are rejected.
func stageInputs(root string, inputs map[string]string) (map[string]string, error) {
	staged := make(map[string]string, len(inputs))
	if len(inputs) == 0 {
		return staged, nil
	}
	inputDir := filepath.Join(root, "inputs")
	if err := os.Mkdir(inputDir, 0700); err != nil {
		return nil, fmt.Errorf("create inputs directory: %w", err)
	}

	roles := make([]string, 0, len(inputs))
	for role := range inputs {
		roles = append(roles, role)
	}
	sort.Strings(roles)

	for _, role := range roles {
		source := inputs[role]
		info, err := os.Lstat(source)
		if err != nil {
			return nil, fmt.Errorf("input %q: %w", role, err)
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return nil, fmt.Errorf("input %q: symlinks are not allowed", role)
		}
		if !info.Mode().IsRegular() {
			return nil, fmt.Errorf("input %q: not a regular file", role)
		}
		if info.Size() > maxInputBytes {
			return nil, fmt.Errorf("input %q: exceeds %d MiB", role, maxInputBytes>>20)
		}
		extension := filepath.Ext(source)
		if extension != "" && !safeExtensionRE.MatchString(extension) {
			return nil, fmt.Errorf("input %q: unsafe extension %q", role, extension)
		}
		name := role + extension
		destination := filepath.Join(inputDir, name)
		if err := copyRegularFile(source, destination, info.Size(), maxInputBytes); err != nil {
			return nil, fmt.Errorf("input %q: %w", role, err)
		}
		staged[role] = filepath.ToSlash(filepath.Join("inputs", name))
	}
	return staged, nil
}

func copyRegularFile(source, destination string, expected, limit int64) error {
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	written, copyErr := io.Copy(out, io.LimitReader(in, limit+1))
	closeErr := out.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(destination)
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	}
	if written > limit {
		_ = os.Remove(destination)
		return fmt.Errorf("exceeds %d MiB", limit>>20)
	}
	if written != expected {
		_ = os.Remove(destination)
		return errors.New("file changed while it was being staged")
	}
	return nil
}

// resolveInRoot validates a worker-supplied relative path and walks every
// component with Lstat so neither ".." nor a symlink can escape root. The
// protocol uses forward slashes; backslashes are rejected because their
// meaning differs between platforms. It returns both the absolute path and
// the cleaned path relative to root.
func resolveInRoot(root, candidate string) (string, string, error) {
	if candidate == "" {
		return "", "", errors.New("empty path")
	}
	if strings.ContainsRune(candidate, 0) {
		return "", "", errors.New("path contains a NUL byte")
	}
	if strings.Contains(candidate, "\\") {
		return "", "", errors.New("path contains a backslash")
	}
	if filepath.IsAbs(candidate) || filepath.VolumeName(candidate) != "" {
		return "", "", errors.New("absolute paths are not allowed")
	}
	cleaned := filepath.Clean(candidate)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
		return "", "", errors.New("path is outside the job root")
	}

	absolute := filepath.Join(root, cleaned)
	relative, err := filepath.Rel(root, absolute)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", "", errors.New("path is outside the job root")
	}

	current := root
	for _, part := range strings.Split(relative, string(filepath.Separator)) {
		if part == "." || part == "" {
			continue
		}
		current = filepath.Join(current, part)
		info, err := os.Lstat(current)
		if err != nil {
			return "", "", fmt.Errorf("path component %q: %w", part, err)
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return "", "", errors.New("symlinks are not allowed in artifact paths")
		}
	}
	return absolute, relative, nil
}

func randomJobID() (string, error) {
	var seed [16]byte
	if _, err := rand.Read(seed[:]); err != nil {
		return "", err
	}
	return "job_" + hex.EncodeToString(seed[:]), nil
}

// boundedBuffer keeps child output from exhausting memory. Writes beyond the
// limit are discarded but still reported as consumed so exec does not stall.
type boundedBuffer struct {
	mu        sync.Mutex
	buffer    bytes.Buffer
	limit     int
	truncated bool
}

func (b *boundedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	written := len(p)
	free := b.limit - b.buffer.Len()
	if free <= 0 {
		if written > 0 {
			b.truncated = true
		}
		return written, nil
	}
	if written > free {
		_, _ = b.buffer.Write(p[:free])
		b.truncated = true
	} else {
		_, _ = b.buffer.Write(p)
	}
	return written, nil
}

func (b *boundedBuffer) Bytes() []byte {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]byte(nil), b.buffer.Bytes()...)
}

func (b *boundedBuffer) String() string {
	return string(b.Bytes())
}

func (b *boundedBuffer) Truncated() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.truncated
}

func isIgnorableWriteError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return errors.Is(err, io.ErrClosedPipe) || errors.Is(err, os.ErrClosed) || strings.Contains(message, "broken pipe")
}

func preview(value string) string {
	value = strings.TrimSpace(value)
	if len(value) > 512 {
		return value[:512] + "..."
	}
	return value
}
