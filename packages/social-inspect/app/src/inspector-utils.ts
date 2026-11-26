export interface InspectorSearch {
  url: string;
}

/** Keep the standalone route's `?url=` search contract in one testable place. */
export function validateInspectorSearch(search: Record<string, unknown>): InspectorSearch {
  return { url: typeof search.url === "string" ? search.url : "" };
}

/** Resolve an API route against an optional desktop/server origin. */
export function inspectorApiPath(apiBase: string | undefined, route: "inspect" | "asset"): string {
  const base = apiBase?.trim().replace(/\/+$/, "") ?? "";
  return `${base}/api/${route}`;
}

export function inspectorAssetUrl(apiBase: string | undefined, url: string): string {
  return `${inspectorApiPath(apiBase, "asset")}?url=${encodeURIComponent(url)}`;
}

interface EditableElement {
  tagName: string;
  isContentEditable?: boolean | undefined;
  closest: (selector: string) => unknown;
}

/** Inputs, textareas, selects and contenteditable descendants keep the `/` key. */
export function isEditableElement(element: EditableElement | null): boolean {
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName.toUpperCase())) return true;
  return element.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}
