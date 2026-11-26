#!/usr/bin/env node
/**
 * One-shot Expo asset sidecar.
 *
 * Reads a single JSON request from stdin, validates it, delegates generation to
 * the canonical `@tigawanna/expo-assets` build, and writes exactly one JSON
 * line to stdout. Diagnostics go to stderr only.
 */
import {
  constants as fsConstants,
  closeSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const STDIN_TIMEOUT_MS = 10_000;
const GENERATION_TIMEOUT_MS = 60_000;

class SidecarError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SidecarError";
    this.code = code;
  }
}

const protocol = (message) => new SidecarError("PROTOCOL", message);
const validation = (message) => new SidecarError("VALIDATION", message);
const input = (message) => new SidecarError("INPUT", message);
const generation = (message) => new SidecarError("GENERATION", message);

function log(message) {
  writeSync(2, `[expo-sidecar] ${message}\n`);
}

let responseSent = false;
function emit(response) {
  if (responseSent) {
    log("suppressed duplicate response");
    return;
  }
  responseSent = true;
  writeSync(1, `${JSON.stringify(response)}\n`);
}

function withTimeout(promise, ms, code, message) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new SidecarError(code, message)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

async function readRequest() {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    total += chunk.length;
    if (total > MAX_REQUEST_BYTES) {
      process.stdin.pause();
      throw protocol(`request exceeds ${MAX_REQUEST_BYTES} bytes`);
    }
    chunks.push(chunk);
  }
  if (total === 0) throw protocol("empty request on stdin");
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks, total).toString("utf8"));
  } catch (err) {
    throw protocol(`invalid JSON request: ${err.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw protocol("request must be a JSON object");
  }
  if (parsed.tool !== "expo") {
    throw protocol(`unsupported tool: ${String(parsed.tool)}`);
  }
  if (typeof parsed.jobId !== "string" || parsed.jobId.length === 0) {
    throw protocol("jobId must be a non-empty string");
  }
  if (typeof parsed.root !== "string" || parsed.root.length === 0) {
    throw protocol("root must be a non-empty string");
  }
  if (!parsed.inputs || typeof parsed.inputs !== "object" || Array.isArray(parsed.inputs)) {
    throw protocol("inputs must be an object");
  }
  return parsed;
}

function resolveRoot(value) {
  const root = resolve(process.cwd(), value);
  let stat;
  try {
    stat = statSync(root);
  } catch {
    throw input(`root directory does not exist: ${value}`);
  }
  if (!stat.isDirectory()) throw validation(`root is not a directory: ${value}`);
  return root;
}

/** Accept normalized project-relative paths only; never allow escaping root. */
function safeRelative(value, label, { allowCurrentDir = false } = {}) {
  if (typeof value !== "string" || value.length === 0) {
    throw validation(`${label} must be a non-empty relative path`);
  }
  if (value.includes("\0") || value.includes("\\")) {
    throw validation(`${label} contains invalid path characters`);
  }
  if (isAbsolute(value) || /^[a-zA-Z]:/.test(value)) {
    throw validation(`${label} must be relative to root`);
  }
  const stripped = value.replace(/^(?:\.\/)+/, "").replace(/\/+$/, "");
  const segments = stripped.split("/").filter(Boolean);
  if (segments.length === 0) {
    if (allowCurrentDir && (value === "." || value === "./")) return ".";
    throw validation(`${label} must name a path`);
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw validation(`${label} must not contain traversal segments`);
  }
  return segments.join("/");
}

function isInside(root, target) {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function resolveWithin(root, rel, label) {
  const target = resolve(root, rel);
  if (!isInside(root, target)) throw validation(`${label} escapes root: ${rel}`);
  return target;
}

/** Copy a validated regular file into a private staging dir (no symlink races). */
function stageInput(root, rel, stagingDir, label) {
  const absolute = resolveWithin(root, rel, label);
  let stats;
  try {
    stats = lstatSync(absolute);
  } catch {
    throw input(`${label} not found: ${rel}`);
  }
  if (stats.isSymbolicLink()) throw validation(`${label} must not be a symlink: ${rel}`);
  if (!stats.isFile()) throw validation(`${label} must be a regular file: ${rel}`);
  let realRoot;
  let realFile;
  try {
    realRoot = realpathSync(root);
    realFile = realpathSync(absolute);
  } catch (err) {
    throw input(`cannot resolve ${label}: ${err.message}`);
  }
  if (!isInside(realRoot, realFile)) {
    throw validation(`${label} resolves outside root: ${rel}`);
  }

  const staged = join(stagingDir, `${label}-${basename(absolute)}`);
  let fd;
  try {
    fd = openSync(absolute, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    if (!fstatSync(fd).isFile()) throw validation(`${label} is not a regular file: ${rel}`);
    const buffer = Buffer.allocUnsafe(MAX_INPUT_BYTES + 1);
    let total = 0;
    while (total <= MAX_INPUT_BYTES) {
      const read = readSync(fd, buffer, total, Math.min(buffer.length - total, 64 * 1024), null);
      if (read === 0) break;
      total += read;
    }
    if (total > MAX_INPUT_BYTES) {
      throw validation(`${label} exceeds ${MAX_INPUT_BYTES} bytes: ${rel}`);
    }
    writeFileSync(staged, buffer.subarray(0, total), { flag: "wx", mode: 0o600 });
    return staged;
  } catch (err) {
    if (err instanceof SidecarError) throw err;
    throw input(`cannot read ${label}: ${err.message}`);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function validateOptions(raw) {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw validation("options must be an object");
  }
  const options = {};
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case "brandColor":
      case "splashBackground":
        if (
          typeof value !== "string" ||
          !/^#?(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(value.trim())
        ) {
          throw validation(`${key} must be a 3- or 6-digit hex color`);
        }
        options[key] = value.trim();
        break;
      case "imageWidth":
      case "foregroundSize":
      case "splashLogoSize":
        if (
          typeof value !== "number" ||
          !Number.isSafeInteger(value) ||
          value < 1 ||
          value > MAX_DIMENSION
        ) {
          throw validation(`${key} must be an integer between 1 and ${MAX_DIMENSION}`);
        }
        options[key] = value;
        break;
      case "noMonochrome":
      case "writeConfig":
        if (typeof value !== "boolean") throw validation(`${key} must be a boolean`);
        options[key] = value;
        break;
      default:
        throw validation(`unknown option: ${key}`);
    }
  }
  return options;
}

function projectRelative(root, absolute) {
  return relative(root, absolute).split(sep).join("/");
}

/** Keep generated paths machine-independent, including inside the agent prompt. */
function relativizePrompt(prompt, root, configPath, outDir) {
  const replacements = [
    { absolute: configPath, relative: configPath && `./${projectRelative(root, configPath)}` },
    { absolute: outDir, relative: `./${projectRelative(root, outDir)}` },
  ]
    .filter((item) => item.absolute && item.relative)
    .sort((a, b) => b.absolute.length - a.absolute.length);
  return replacements.reduce((text, item) => text.split(item.absolute).join(item.relative), prompt);
}

async function loadGenerator() {
  try {
    const module = await import("@tigawanna/expo-assets");
    if (typeof module.generateExpoAssets !== "function") {
      throw new Error("generateExpoAssets export is missing");
    }
    return module.generateExpoAssets;
  } catch (err) {
    throw generation(`cannot load @tigawanna/expo-assets: ${err.message}`);
  }
}

async function main() {
  let stagingDir;
  try {
    const request = await withTimeout(
      readRequest(),
      STDIN_TIMEOUT_MS,
      "PROTOCOL",
      `request timed out after ${STDIN_TIMEOUT_MS}ms`,
    );

    const root = resolveRoot(request.root);
    if (process.cwd() !== root) {
      log(`changing cwd to ${root}`);
      process.chdir(root);
    }

    const options = validateOptions(request.options);
    const iconPath = safeRelative(request.inputs.icon, "inputs.icon");
    const darkPath =
      request.inputs.darkIcon === undefined
        ? undefined
        : safeRelative(request.inputs.darkIcon, "inputs.darkIcon");
    const tintedPath =
      request.inputs.tintedIcon === undefined
        ? undefined
        : safeRelative(request.inputs.tintedIcon, "inputs.tintedIcon");
    const outPath = safeRelative(request.outDir, "outDir", { allowCurrentDir: true });
    const outDir = resolveWithin(root, outPath, "outDir");

    stagingDir = mkdtempSync(join(tmpdir(), "expo-assets-sidecar-"));
    const stagedIcon = stageInput(root, iconPath, stagingDir, "icon");
    const stagedDark = darkPath && stageInput(root, darkPath, stagingDir, "darkIcon");
    const stagedTinted = tintedPath && stageInput(root, tintedPath, stagingDir, "tintedIcon");

    const generateExpoAssets = await loadGenerator();
    const result = await withTimeout(
      generateExpoAssets({
        ...options,
        icon: stagedIcon,
        outDir,
        ...(stagedDark ? { darkIcon: stagedDark } : {}),
        ...(stagedTinted ? { tintedIcon: stagedTinted } : {}),
      }),
      GENERATION_TIMEOUT_MS,
      "GENERATION",
      `asset generation timed out after ${GENERATION_TIMEOUT_MS}ms`,
    );

    const artifacts = result.assets.map((asset) => ({
      name: asset.name,
      path: projectRelative(root, resolve(root, asset.path)),
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
    }));
    const configPath = result.configPath ? projectRelative(root, result.configPath) : null;

    emit({
      ok: true,
      tool: "expo",
      artifacts,
      config: result.config,
      configPath,
      agentPrompt: relativizePrompt(result.agentPrompt, root, result.configPath, outDir),
    });
  } catch (err) {
    const code = err instanceof SidecarError ? err.code : "GENERATION";
    const message = err instanceof Error ? err.message : String(err);
    log(`${code}: ${message}`);
    emit({ ok: false, error: message, code });
    process.exitCode = 1;
  } finally {
    if (stagingDir) rmSync(stagingDir, { recursive: true, force: true });
  }
}

process.on("uncaughtException", (err) => {
  log(`uncaught: ${err?.stack ?? String(err)}`);
  emit({ ok: false, error: err?.message ?? String(err), code: "GENERATION" });
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  log(`unhandled: ${err?.stack ?? String(err)}`);
  emit({ ok: false, error: err?.message ?? String(err), code: "GENERATION" });
  process.exit(1);
});

await main();
