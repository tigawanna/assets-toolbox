import { error } from "@sveltejs/kit";
import { findPackage } from "#lib/catalog.js";
import type { ToolPackage } from "#lib/catalog.js";

export function load({ params }: { params: { slug: string } }): { tool: ToolPackage } {
  const tool = findPackage(params.slug);
  if (!tool) {
    error(404, `No tool is registered for “${params.slug}”.`);
  }
  return { tool };
}
