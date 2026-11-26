package assetgen

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const workerPrelude = `
const fs = require('fs');
const path = require('path');
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try { main(JSON.parse(raw)); }
  catch (e) { emit({ok:false, error:String(e), code:'E_TEST'}); }
});
function emit(value) { process.stdout.write(JSON.stringify(value) + '\n'); }
`

const successWorker = `
function main(req) {
  const icon = fs.readFileSync(path.join(req.root, req.inputs.icon), 'utf8');
  if (icon !== '<svg/>') throw new Error('input staging failed: ' + icon);
  if (fs.realpathSync(process.cwd()) !== fs.realpathSync(req.root)) throw new Error('worker cwd mismatch');
  if (req.tool !== 'expo' || req.jobId !== 'ok-job') throw new Error('bad request');
  const outDir = path.join(req.root, req.outDir);
  const png = path.join(outDir, 'icon.png');
  const cfg = path.join(outDir, 'config.json');
  fs.writeFileSync(png, Buffer.from('PNGDATA'));
  fs.writeFileSync(cfg, JSON.stringify(req.options));
  emit({ok:true, artifacts:[
    {name:'icon.png', path:path.join(req.outDir,'icon.png'), bytes:fs.statSync(png).size, width:64, height:64},
    {name:'config.json', path:path.join(req.outDir,'config.json'), bytes:fs.statSync(cfg).size, width:0, height:0}
  ], config:{generatedBy:'fake'}, configPath:path.join(req.outDir,'config.json'), agentPrompt:'Use the generated icon.'});
}
`

const brandWorker = `
function main(req) {
  if (req.tool !== 'brand' || req.jobId !== 'brand-job') throw new Error('bad request');
  const icon = fs.readFileSync(path.join(req.root, req.inputs.icon), 'utf8');
  if (icon !== '<svg/>') throw new Error('input staging failed: ' + icon);
  if (fs.realpathSync(process.cwd()) !== fs.realpathSync(req.root)) throw new Error('worker cwd mismatch');
  const outDir = path.join(req.root, req.outDir);
  function write(name, text, width, height) {
    const p = path.join(outDir, name);
    fs.writeFileSync(p, text);
    return {name:name, path:path.join(req.outDir, name), bytes:fs.statSync(p).size, width:width, height:height};
  }
  emit({ok:true, artifacts:[
    write('favicon.ico', 'ICODATA', 32, 32),
    write('og.png', 'OGDATA', 1200, 630),
    write('site.webmanifest', JSON.stringify({name:'Test'}), 0, 0)
  ], config:{generatedBy:'brand'}, agentPrompt:'Use the generated brand assets.'});
}
`

const errorWorker = `
function main() { emit({ok:false, error:'bad config', code:'E_CONFIG'}); }
`

const cancelWorker = `
function main(req) {
  fs.writeFileSync(path.join(req.root, 'started'), '1');
  setTimeout(function () {}, 30000);
}
`

const validationWorker = `
function main(req) {
  const outDir = path.join(req.root, req.outDir);
  const mode = req.options.mode;
  function write(name, text) {
    const p = path.join(outDir, name);
    fs.writeFileSync(p, text);
    return {name:name, path:path.join(req.outDir, name), bytes:fs.statSync(p).size, width:0, height:0};
  }
  if (mode === 'traversal') {
    fs.writeFileSync(path.join(req.root, '..', 'leak.txt'), 'LEAK');
    emit({ok:true, artifacts:[{name:'leak.txt', path:'../leak.txt', bytes:4, width:0, height:0}]});
    return;
  }
  if (mode === 'absolute') {
    fs.writeFileSync(path.join(req.root, 'abs.txt'), 'AAAA');
    emit({ok:true, artifacts:[{name:'abs.txt', path:path.join(req.root, 'abs.txt'), bytes:4, width:0, height:0}]});
    return;
  }
  if (mode === 'name-mismatch') {
    const item = write('real.txt','AAAA');
    item.name = 'fake.txt';
    emit({ok:true, artifacts:[item]});
    return;
  }
  if (mode === 'bytes-mismatch') {
    const item = write('a.txt','AAAA');
    item.bytes = 99;
    emit({ok:true, artifacts:[item]});
    return;
  }
  if (mode === 'symlink') {
    const outside = path.join(req.root, '..', 'leak-link.txt');
    fs.writeFileSync(outside, 'BBBB');
    const link = path.join(outDir, 'link.txt');
    fs.symlinkSync(outside, link);
    emit({ok:true, artifacts:[{name:'link.txt', path:path.join(req.outDir,'link.txt'), bytes:4, width:0, height:0}]});
    return;
  }
  if (mode === 'config-traversal') {
    emit({ok:true, artifacts:[write('a.txt','AAAA')], configPath:'../outside.json'});
    return;
  }
  if (mode === 'oversize') {
    const p = path.join(outDir, 'big.bin');
    fs.writeFileSync(p, Buffer.alloc(16 * 1024 * 1024 + 1));
    emit({ok:true, artifacts:[{name:'big.bin', path:path.join(req.outDir,'big.bin'), bytes:fs.statSync(p).size, width:0, height:0}]});
    return;
  }
  emit({ok:true, artifacts:[write('a.txt','AAAA')]});
}
`

const slowWorker = `
function main(req) {
  setTimeout(function () {
    const p = path.join(req.root, req.outDir, 'done.txt');
    fs.writeFileSync(p, 'OK');
    emit({ok:true, artifacts:[{name:'done.txt', path:path.join(req.outDir,'done.txt'), bytes:2, width:0, height:0}]});
  }, 200);
}
`

func requireNode(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node is not available:", err)
	}
}

func writeWorker(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "worker.js")
	if err := os.WriteFile(path, []byte(workerPrelude+body), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

func writeInput(t *testing.T, name, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

func jobRootsWithPrefix(t *testing.T, prefix string) []string {
	t.Helper()
	matches, err := filepath.Glob(filepath.Join(os.TempDir(), "assetgen-"+prefix+"-*"))
	if err != nil {
		t.Fatal(err)
	}
	return matches
}

func TestStartSuccess(t *testing.T) {
	requireNode(t)
	worker := writeWorker(t, successWorker)
	input := writeInput(t, "my-icon.svg", "<svg/>")
	m := NewManager(worker)
	defer m.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	result, err := m.Start(ctx, Request{
		Tool:       "expo",
		JobID:      "ok-job",
		InputPaths: map[string]string{"icon": input},
		Options:    map[string]any{"color": "#fff"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.JobID != "ok-job" || len(result.Artifacts) != 2 {
		t.Fatalf("unexpected result: %+v", result)
	}
	if result.Config["generatedBy"] != "fake" {
		t.Fatalf("unexpected config: %v", result.Config)
	}
	if result.AgentPrompt != "Use the generated icon." {
		t.Fatalf("unexpected prompt: %q", result.AgentPrompt)
	}
	if result.ConfigPath == "" {
		t.Fatal("missing config path")
	}
	if result.Artifacts[0].Name != "icon.png" || result.Artifacts[0].Bytes != int64(len("PNGDATA")) || result.Artifacts[0].Width != 64 {
		t.Fatalf("unexpected first artifact: %+v", result.Artifacts[0])
	}
	if result.Artifacts[0].Data != nil {
		t.Fatal("artifact bytes must not be embedded in the result")
	}

	path, err := m.ArtifactPath("ok-job", "icon.png")
	if err != nil {
		t.Fatal(err)
	}
	if path != result.Artifacts[0].Path {
		t.Fatalf("path mismatch: %q vs %q", path, result.Artifacts[0].Path)
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != "PNGDATA" {
		t.Fatalf("read artifact: %v, %q", err, data)
	}
	if _, err := m.ArtifactPath("ok-job", "missing.png"); err == nil {
		t.Fatal("expected error for unknown artifact")
	}

	root, err := m.JobRoot("ok-job")
	if err != nil {
		t.Fatal(err)
	}
	staged, err := os.ReadFile(filepath.Join(root, "inputs", "icon.svg"))
	if err != nil || string(staged) != "<svg/>" {
		t.Fatalf("staged input: %v, %q", err, staged)
	}
	if _, err := os.Stat(root); err != nil {
		t.Fatalf("completed root should be retained: %v", err)
	}

	m.Discard("ok-job")
	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Fatalf("staging should be removed after Discard: %v", err)
	}
	if _, err := m.JobRoot("ok-job"); !errors.Is(err, ErrUnknownJob) {
		t.Fatalf("expected ErrUnknownJob, got %v", err)
	}
	if m.Cancel("ok-job") {
		t.Fatal("Cancel on discarded job should return false")
	}
}

func TestStartBrandSuccess(t *testing.T) {
	requireNode(t)
	worker := writeWorker(t, brandWorker)
	input := writeInput(t, "my-icon.svg", "<svg/>")
	optional := writeInput(t, "wordmark.svg", "<wordmark/>")
	m := NewManager(worker)
	defer m.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	result, err := m.Start(ctx, Request{
		Tool:  "brand",
		JobID: "brand-job",
		// Brand uses role "icon"; extra safe roles are staged as well.
		InputPaths: map[string]string{"icon": input, "wordmark": optional},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.JobID != "brand-job" || len(result.Artifacts) != 3 {
		t.Fatalf("unexpected result: %+v", result)
	}
	want := []struct {
		name   string
		bytes  int64
		width  int
		height int
	}{
		{"favicon.ico", int64(len("ICODATA")), 32, 32},
		{"og.png", int64(len("OGDATA")), 1200, 630},
		{"site.webmanifest", int64(len(`{"name":"Test"}`)), 0, 0},
	}
	for i, expected := range want {
		got := result.Artifacts[i]
		if got.Name != expected.name || got.Bytes != expected.bytes || got.Width != expected.width || got.Height != expected.height {
			t.Fatalf("unexpected artifact %d: %+v", i, got)
		}
		if got.Data != nil {
			t.Fatalf("artifact %q bytes must not be embedded in the result", got.Name)
		}
		path, err := m.ArtifactPath("brand-job", got.Name)
		if err != nil || path != got.Path {
			t.Fatalf("ArtifactPath(%q): %q, %v", got.Name, path, err)
		}
	}
	if result.Config["generatedBy"] != "brand" {
		t.Fatalf("unexpected config: %v", result.Config)
	}
	if result.AgentPrompt != "Use the generated brand assets." {
		t.Fatalf("unexpected prompt: %q", result.AgentPrompt)
	}

	root, err := m.JobRoot("brand-job")
	if err != nil {
		t.Fatal(err)
	}
	staged, err := os.ReadFile(filepath.Join(root, "inputs", "icon.svg"))
	if err != nil || string(staged) != "<svg/>" {
		t.Fatalf("staged icon: %v, %q", err, staged)
	}
	stagedOptional, err := os.ReadFile(filepath.Join(root, "inputs", "wordmark.svg"))
	if err != nil || string(stagedOptional) != "<wordmark/>" {
		t.Fatalf("staged optional role: %v, %q", err, stagedOptional)
	}
}

func TestRequestValidation(t *testing.T) {
	cases := []struct {
		name string
		req  Request
		want string
	}{
		{"unsupported tool", Request{Tool: "nextjs"}, "unsupported"},
		{"uppercase expo", Request{Tool: "EXPO"}, "unsupported"},
		{"mixed case brand", Request{Tool: "Brand"}, "unsupported"},
		{"unsafe job id", Request{Tool: "expo", JobID: "../bad"}, "unsafe job id"},
		{"unsafe role", Request{Tool: "expo", InputPaths: map[string]string{"../icon": "x"}}, "unsafe input role"},
		{"absolute outDir", Request{Tool: "expo", OutDir: "/tmp/out"}, "relative"},
		{"traversal outDir", Request{Tool: "expo", OutDir: "../out"}, "unsafe segment"},
		{"backslash outDir", Request{Tool: "expo", OutDir: "..\\out"}, "illegal character"},
		{"brand traversal outDir", Request{Tool: "brand", OutDir: "../out"}, "unsafe segment"},
		{"brand absolute outDir", Request{Tool: "brand", OutDir: "/tmp/out"}, "relative"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			m := NewManager(filepath.Join(t.TempDir(), "missing-worker.js"))
			defer m.Close()
			_, err := m.Start(context.Background(), tc.req)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("expected error containing %q, got %v", tc.want, err)
			}
		})
	}
}

func TestInputValidation(t *testing.T) {
	worker := writeWorker(t, errorWorker)
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"oversize", func() string {
			path := filepath.Join(t.TempDir(), "big.png")
			file, err := os.Create(path)
			if err != nil {
				t.Fatal(err)
			}
			if err := file.Truncate(maxInputBytes + 1); err != nil {
				t.Fatal(err)
			}
			_ = file.Close()
			return path
		}(), "exceeds 8 MiB"},
		{"directory", t.TempDir(), "not a regular file"},
		{"unsafe extension", writeInput(t, "icon.bad!", "x"), "unsafe extension"},
		{"symlink", func() string {
			dir := t.TempDir()
			target := filepath.Join(dir, "target.svg")
			if err := os.WriteFile(target, []byte("<svg/>"), 0600); err != nil {
				t.Fatal(err)
			}
			link := filepath.Join(dir, "link.svg")
			if err := os.Symlink(target, link); err != nil {
				t.Skipf("symlinks unavailable: %v", err)
			}
			return link
		}(), "symlinks are not allowed"},
	}
	for i, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			jobID := "bad-input-" + strings.ReplaceAll(tc.name, " ", "-")
			m := NewManager(worker)
			defer m.Close()
			_, err := m.Start(context.Background(), Request{
				Tool:       "expo",
				JobID:      jobID,
				InputPaths: map[string]string{"icon": tc.input},
			})
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("case %d: expected error containing %q, got %v", i, tc.want, err)
			}
			if roots := jobRootsWithPrefix(t, jobID); len(roots) != 0 {
				t.Fatalf("staging left behind: %v", roots)
			}
		})
	}
}

func TestWorkerError(t *testing.T) {
	requireNode(t)
	worker := writeWorker(t, errorWorker)
	input := writeInput(t, "icon.svg", "<svg/>")
	m := NewManager(worker)
	defer m.Close()

	_, err := m.Start(context.Background(), Request{
		Tool:       "expo",
		JobID:      "worker-error",
		InputPaths: map[string]string{"icon": input},
	})
	if err == nil || !strings.Contains(err.Error(), "E_CONFIG") || !strings.Contains(err.Error(), "bad config") {
		t.Fatalf("expected structured worker error, got %v", err)
	}
	if roots := jobRootsWithPrefix(t, "worker-error"); len(roots) != 0 {
		t.Fatalf("staging left behind: %v", roots)
	}
}

func TestArtifactValidation(t *testing.T) {
	requireNode(t)
	worker := writeWorker(t, validationWorker)
	input := writeInput(t, "icon.svg", "<svg/>")
	cases := []struct {
		mode string
		want string
	}{
		{"traversal", "outside the job root"},
		{"absolute", "absolute paths are not allowed"},
		{"name-mismatch", "unexpected name"},
		{"bytes-mismatch", "reported 99 bytes"},
		{"symlink", "symlinks are not allowed"},
		{"config-traversal", "configPath"},
		{"oversize", "exceeds 16 MiB"},
	}
	for _, tc := range cases {
		t.Run(tc.mode, func(t *testing.T) {
			jobID := "artifact-" + tc.mode
			m := NewManager(worker)
			defer m.Close()
			_, err := m.Start(context.Background(), Request{
				Tool:       "expo",
				JobID:      jobID,
				InputPaths: map[string]string{"icon": input},
				Options:    map[string]any{"mode": tc.mode},
			})
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("expected error containing %q, got %v", tc.want, err)
			}
			if roots := jobRootsWithPrefix(t, jobID); len(roots) != 0 {
				t.Fatalf("staging left behind: %v", roots)
			}
		})
	}
}

func TestCancellation(t *testing.T) {
	requireNode(t)
	worker := writeWorker(t, cancelWorker)
	input := writeInput(t, "icon.svg", "<svg/>")
	m := NewManager(worker)
	defer m.Close()

	const jobID = "cancel-job"
	done := make(chan error, 1)
	go func() {
		_, err := m.Start(context.Background(), Request{
			Tool:       "expo",
			JobID:      jobID,
			InputPaths: map[string]string{"icon": input},
		})
		done <- err
	}()

	var root string
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		candidate, err := m.JobRoot(jobID)
		if err == nil {
			root = candidate
			if _, err := os.Stat(filepath.Join(root, "started")); err == nil {
				break
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	if root == "" {
		t.Fatal("job never started")
	}
	if !m.Cancel(jobID) {
		t.Fatal("Cancel returned false for a running job")
	}
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("expected cancellation error, got %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Start did not return after cancellation")
	}
	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Fatalf("staging should be removed after cancellation: %v", err)
	}
	if m.Cancel(jobID) {
		t.Fatal("Cancel should return false once the job is gone")
	}
}

func TestConcurrentJobsAndDuplicateID(t *testing.T) {
	requireNode(t)
	worker := writeWorker(t, slowWorker)
	input := writeInput(t, "icon.svg", "<svg/>")
	m := NewManager(worker)
	defer m.Close()

	type outcome struct {
		result Result
		err    error
	}
	outputs := make(chan outcome, 2)
	for _, jobID := range []string{"concurrent-a", "concurrent-b"} {
		jobID := jobID
		go func() {
			result, err := m.Start(context.Background(), Request{
				Tool:       "expo",
				JobID:      jobID,
				InputPaths: map[string]string{"icon": input},
			})
			outputs <- outcome{result: result, err: err}
		}()
	}
	roots := make(map[string]bool)
	for i := 0; i < 2; i++ {
		select {
		case out := <-outputs:
			if out.err != nil {
				t.Fatalf("concurrent job failed: %v", out.err)
			}
			root, err := m.JobRoot(out.result.JobID)
			if err != nil || roots[root] {
				t.Fatalf("missing or duplicate root for %s: %q, %v", out.result.JobID, root, err)
			}
			roots[root] = true
			if len(out.result.Artifacts) != 1 || out.result.Artifacts[0].Name != "done.txt" {
				t.Fatalf("unexpected artifacts: %+v", out.result.Artifacts)
			}
		case <-time.After(10 * time.Second):
			t.Fatal("concurrent job timed out")
		}
	}

	// A job ID that is already registered cannot be reused while it exists.
	_, err := m.Start(context.Background(), Request{
		Tool:       "expo",
		JobID:      "concurrent-a",
		InputPaths: map[string]string{"icon": input},
	})
	if err == nil || !strings.Contains(err.Error(), "already registered") {
		t.Fatalf("expected duplicate id error, got %v", err)
	}
}

func TestCloseRejectsNewWork(t *testing.T) {
	requireNode(t)
	worker := writeWorker(t, successWorker)
	input := writeInput(t, "icon.svg", "<svg/>")
	m := NewManager(worker)

	result, err := m.Start(context.Background(), Request{
		Tool:       "expo",
		JobID:      "ok-job",
		InputPaths: map[string]string{"icon": input},
	})
	if err != nil {
		t.Fatal(err)
	}
	root := result.Artifacts[0].Path
	m.Close()
	m.Close() // idempotent
	if _, err := os.Stat(filepath.Dir(root)); !os.IsNotExist(err) {
		t.Fatalf("Close should remove staging: %v", err)
	}
	if _, err := m.Start(context.Background(), Request{Tool: "expo"}); !errors.Is(err, ErrManagerClosed) {
		t.Fatalf("expected ErrManagerClosed, got %v", err)
	}
	if m.Cancel("ok-job") {
		t.Fatal("Cancel should return false after Close")
	}
}
