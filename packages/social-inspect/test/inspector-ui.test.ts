import { describe, expect, it } from "vite-plus/test";

import {
  inspectorApiPath,
  inspectorAssetUrl,
  isEditableElement,
  validateInspectorSearch,
} from "../app/src/inspector-utils";

describe("validateInspectorSearch", () => {
  it("preserves string URLs for the standalone route", () => {
    expect(validateInspectorSearch({ url: "https://example.com/path?q=1#preview" })).toEqual({
      url: "https://example.com/path?q=1#preview",
    });
  });

  it("defaults missing and non-string values to an empty URL", () => {
    expect(validateInspectorSearch({})).toEqual({ url: "" });
    expect(validateInspectorSearch({ url: 42 })).toEqual({ url: "" });
    expect(validateInspectorSearch({ url: null })).toEqual({ url: "" });
  });
});

describe("inspector API URLs", () => {
  it("uses same-origin API routes by default", () => {
    expect(inspectorApiPath(undefined, "inspect")).toBe("/api/inspect");
    expect(inspectorApiPath("", "asset")).toBe("/api/asset");
  });

  it("joins a desktop API origin without duplicate slashes", () => {
    expect(inspectorApiPath(" http://127.0.0.1:3000/ ", "inspect")).toBe(
      "http://127.0.0.1:3000/api/inspect",
    );
  });

  it("encodes asset URLs for the existing GET contract", () => {
    expect(inspectorAssetUrl("http://127.0.0.1:3000", "https://example.com/a.png?x=1&y=2")).toBe(
      "http://127.0.0.1:3000/api/asset?url=https%3A%2F%2Fexample.com%2Fa.png%3Fx%3D1%26y%3D2",
    );
  });
});

describe("isEditableElement", () => {
  const element = (tagName: string, isContentEditable = false, editableAncestor = false) => ({
    tagName,
    isContentEditable,
    closest: (selector: string) =>
      selector === '[contenteditable]:not([contenteditable="false"])' && editableAncestor
        ? {}
        : null,
  });

  it("recognizes form controls and contenteditable descendants", () => {
    expect(isEditableElement(element("INPUT"))).toBe(true);
    expect(isEditableElement(element("TEXTAREA"))).toBe(true);
    expect(isEditableElement(element("SELECT"))).toBe(true);
    expect(isEditableElement(element("SPAN", true))).toBe(true);
    expect(isEditableElement(element("SPAN", false, true))).toBe(true);
  });

  it("allows the shortcut from non-editable elements", () => {
    expect(isEditableElement(null)).toBe(false);
    expect(isEditableElement(element("BUTTON"))).toBe(false);
    expect(isEditableElement(element("DIV"))).toBe(false);
  });
});
