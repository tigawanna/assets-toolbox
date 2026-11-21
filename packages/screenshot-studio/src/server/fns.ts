import { createServerFn } from "@tanstack/react-start";
import { readStudio } from "./queries";
import { addFrame as addFrameFn, moveFrames as moveFramesFn, removeFrame as removeFrameFn } from "./mutations";

import type { StoreName } from "@/lib/events";

function isStore(value: unknown): value is StoreName {
  return value === "play" || value === "app-store";
}

export const loadStudio = createServerFn({ method: "GET" }).handler(async () => {
  return readStudio();
});

export const addFrame = createServerFn({ method: "POST" })
  .validator((data: { store: StoreName; presetId: string }) => {
    if (!isStore(data.store) || data.presetId.trim() === "") {
      throw new Error("A store and preset are required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    return addFrameFn(data.store, data.presetId);
  });

export const moveBanner = createServerFn({ method: "POST" })
  .validator((data: { frames: { id: string; x: number; y: number }[] }) => {
    if (data.frames.length === 0) throw new Error("A banner move needs at least one frame");
    for (const frame of data.frames) {
      if (frame.id.trim() === "" || !Number.isFinite(frame.x) || !Number.isFinite(frame.y)) {
        throw new Error("Each slice needs an id and a position");
      }
    }
    return data;
  })
  .handler(async ({ data }) => {
    return moveFramesFn(data.frames);
  });

export const removeFrame = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => {
    if (data.id.trim() === "") throw new Error("A frame id is required");
    return data;
  })
  .handler(async ({ data }) => {
    return removeFrameFn(data.id);
  });
