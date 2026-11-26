import { error } from "@sveltejs/kit";
import { findPackage } from "#lib/catalog.js";
import type { ToolPackage } from "#lib/catalog.js";

export function load(): { tool: ToolPackage } {
  const tool = findPackage("svg-compose");
  if (!tool) error(404, "SVG Compose is not registered.");
  return { tool };
}
