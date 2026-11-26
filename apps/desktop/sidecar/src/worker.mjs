#!/usr/bin/env node
/**
 * One-shot asset sidecar for Expo and brand assets.
 *
 * Reads a single JSON request from stdin, validates it, delegates generation to
 * the canonical `@tigawanna/expo-assets` or `@tigawanna/brand-assets` build,
 * and writes exactly one JSON line to stdout. Diagnostics go to stderr only.
 */
import {
  constants as fsConstants,
  closeSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
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
const MIN_OG_DIMENSION = 64;
const STDIN_TIMEOUT_MS = 10_000;
const GENERATION_TIMEOUT_MS = 60_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MANIFEST_DISPLAYS = ["standalone", "fullscreen", "minimal-ui", "browser"];

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
  writeSync(2, `[asset-sidecar] ${message}\n`);
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
  if (parsed.tool !== "expo" && parsed.tool !== "brand") {
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

function validateBrandOptions(raw) {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw validation("options must be an object");
  }
  const options = {};
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case "plate":
        if (
          typeof value !== "string" ||
          !/^#?(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(value.trim())
        ) {
          throw validation("plate must be a 3- or 6-digit hex color");
        }
        options[key] = value.trim();
        break;
      case "copySvg":
        if (typeof value !== "boolean") throw validation("copySvg must be a boolean");
        options[key] = value;
        break;
      case "og":
        options.og = validateOgOptions(value);
        break;
      case "manifest":
        options.manifest = validateManifestOptions(value);
        break;
      default:
        throw validation(`unknown option: ${key}`);
    }
  }
  return options;
}

function validateOgOptions(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw validation("og must be an object");
  }
  const og = {};
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case "title":
        if (typeof value !== "string" || value.trim().length === 0) {
          throw validation("og.title must be a non-empty string");
        }
        og.title = value;
        break;
      case "description":
      case "siteLabel":
        if (typeof value !== "string") throw validation(`og.${key} must be a string`);
        og[key] = value;
        break;
      case "width":
      case "height":
        if (
          typeof value !== "number" ||
          !Number.isInteger(value) ||
          value < MIN_OG_DIMENSION ||
          value > MAX_DIMENSION
        ) {
          throw validation(
            `og.${key} must be an integer between ${MIN_OG_DIMENSION} and ${MAX_DIMENSION}`,
          );
        }
        og[key] = value;
        break;
      case "enabled":
        if (typeof value !== "boolean") throw validation("og.enabled must be a boolean");
        og.enabled = value;
        break;
      default:
        throw validation(`unknown og option: ${key}`);
    }
  }
  if (typeof og.title !== "string" || og.title.trim().length === 0) {
    throw validation("og.title is required");
  }
  return og;
}

function validateManifestOptions(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw validation("manifest must be an object");
  }
  const manifest = {};
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case "name":
      case "shortName":
      case "themeColor":
      case "backgroundColor":
      case "startUrl":
        if (typeof value !== "string") throw validation(`manifest.${key} must be a string`);
        manifest[key] = value;
        break;
      case "display":
        if (typeof value !== "string" || !MANIFEST_DISPLAYS.includes(value)) {
          throw validation(`manifest.display must be one of ${MANIFEST_DISPLAYS.join(", ")}`);
        }
        manifest[key] = value;
        break;
      case "enabled":
        if (typeof value !== "boolean") throw validation("manifest.enabled must be a boolean");
        manifest.enabled = value;
        break;
      default:
        throw validation(`unknown manifest option: ${key}`);
    }
  }
  return manifest;
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

/** Read PNG/ICO dimensions from file headers; return 0x0 for anything else. */
function readImageSize(file) {
  try {
    const fd = openSync(file, "r");
    try {
      const header = Buffer.alloc(24);
      const read = readSync(fd, header, 0, header.length, 0);
      if (read >= 24 && header.subarray(0, 8).equals(PNG_SIGNATURE)) {
        const width = header.readUInt32BE(16);
        const height = header.readUInt32BE(20);
        if (width > 0 && height > 0) return { width, height };
      }
      if (read >= 8 && header.readUInt16LE(0) === 0 && header.readUInt16LE(2) === 1) {
        if (header.readUInt16LE(4) > 0) {
          // ICO entries encode 256 as a zero byte.
          const width = header[6] === 0 ? 256 : header[6];
          const height = header[7] === 0 ? 256 : header[7];
          return { width, height };
        }
      }
    } finally {
      closeSync(fd);
    }
  } catch {
    // Unknown file type or unreadable header: leave dimensions as zero.
  }
  return { width: 0, height: 0 };
}

function brandArtifact(file, root) {
  const { width, height } = readImageSize(file.path);
  return {
    name: file.name,
    path: projectRelative(root, resolve(root, file.path)),
    bytes: file.bytes,
    width,
    height,
  };
}

function brandAgentPrompt(root, outDir, hasManifest) {
  const relativeDir = projectRelative(root, outDir);
  const prefix = relativeDir ? `./${relativeDir}` : ".";
  const links = [
    `<link rel="icon" href="${prefix}/favicon.ico">`,
    `<link rel="apple-touch-icon" href="${prefix}/apple-touch-icon.png">`,
  ];
  if (hasManifest) links.push(`<link rel="manifest" href="${prefix}/site.webmanifest">`);
  return (
    `Copy the generated files from ${prefix} into your project's public directory, ` +
    `then add ${links.join(" and ")} to your HTML <head>.`
  );
}

function brandOgOptions(og) {
  const { title, description, siteLabel, width, height } = og;
  return {
    title,
    ...(description !== undefined ? { description } : {}),
    ...(siteLabel !== undefined ? { siteLabel } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    fonts: [],
  };
}

function brandManifestOptions(manifest) {
  const { name, shortName, themeColor, backgroundColor, startUrl, display } = manifest;
  return {
    ...(name !== undefined ? { name } : {}),
    ...(shortName !== undefined ? { shortName } : {}),
    ...(themeColor !== undefined ? { themeColor } : {}),
    ...(backgroundColor !== undefined ? { backgroundColor } : {}),
    ...(startUrl !== undefined ? { startUrl } : {}),
    ...(display !== undefined ? { display } : {}),
  };
}

async function loadBrandGenerator() {
  try {
    const module = await import("@tigawanna/brand-assets");
    if (typeof module.generateBrandAssets !== "function") {
      throw new Error("generateBrandAssets export is missing");
    }
    return module.generateBrandAssets;
  } catch (err) {
    throw generation(`cannot load @tigawanna/brand-assets: ${err.message}`);
  }
}

/**
 * Try the requested fonts first, then retry without an explicit font list if
 * the renderer rejects an empty list. The env hook lets the test suite exercise
 * the fallback path without patching the generator.
 */
async function generateBrand(generateBrandAssets, options) {
  const attempt = (withEmptyFonts) => {
    const request = { ...options };
    if (request.og) {
      request.og = { ...request.og };
      if (withEmptyFonts) request.og.fonts = [];
      else delete request.og.fonts;
    }
    return withTimeout(
      generateBrandAssets(request),
      GENERATION_TIMEOUT_MS,
      "GENERATION",
      `asset generation timed out after ${GENERATION_TIMEOUT_MS}ms`,
    );
  };

  try {
    if (process.env.ASSET_SIDECAR_FORCE_FONT_FAILURE === "1") {
      throw new Error("fonts: [] could not be rendered (forced by test hook)");
    }
    return await attempt(true);
  } catch (err) {
    if (options.og && /font/i.test(err?.message ?? "")) {
      log(`warning: fonts: [] could not be rendered (${err?.message}); retrying without fonts`);
      return attempt(false);
    }
    throw err;
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

    const isBrand = request.tool === "brand";
    const options = isBrand
      ? validateBrandOptions(request.options)
      : validateOptions(request.options);
    const iconPath = safeRelative(request.inputs.icon, "inputs.icon");

    if (isBrand) {
      const outPath = safeRelative(request.outDir, "outDir", { allowCurrentDir: true });
      const outDir = resolveWithin(root, outPath, "outDir");
      stagingDir = mkdtempSync(join(tmpdir(), "brand-assets-sidecar-"));
      const stagedIcon = stageInput(root, iconPath, stagingDir, "icon");
      const generateBrandAssets = await loadBrandGenerator();
      const { plate, copySvg, og, manifest } = options;
      const result = await generateBrand(generateBrandAssets, {
        icon: stagedIcon,
        outDir,
        ...(plate !== undefined ? { plate } : {}),
        ...(copySvg !== undefined ? { copySvg } : {}),
        og: og?.enabled === true ? brandOgOptions(og) : false,
        manifest: manifest?.enabled === true ? brandManifestOptions(manifest) : false,
      });

      const artifacts = [
        ...result.icons.map((file) => brandArtifact(file, root)),
        ...(result.og ? [brandArtifact(result.og, root)] : []),
        ...(result.manifest ? [brandArtifact(result.manifest, root)] : []),
      ];
      const configFile = result.manifest;
      const configPath = configFile ? projectRelative(root, resolve(root, configFile.path)) : null;
      emit({
        ok: true,
        tool: "brand",
        artifacts,
        config: configFile ? JSON.parse(readFileSync(configFile.path, "utf8")) : null,
        configPath,
        agentPrompt: brandAgentPrompt(root, outDir, Boolean(configFile)),
      });
      return;
    }

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
