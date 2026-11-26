import { error } from "@sveltejs/kit";
import { findPackage } from "#lib/catalog.js";
import type { ToolPackage } from "#lib/catalog.js";

export function load(): { tool: ToolPackage } {
  const tool = findPackage("cabra-sound");
  if (!tool) error(404, "Cabra Sound is not registered.");
  return { tool };
}
