import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  ALL_NAMES,
  AVAILABLE_NAMES,
  SOUND_META,
  controls,
  play,
  setPreview,
  wavFilename,
} from "../src/index";

type TapeEvent = {
  name?: string;
  notes: unknown[];
  gain: number;
};

function tape(): TapeEvent[] {
  const events: TapeEvent[] = [];
  (globalThis as { __tape?: TapeEvent[] }).__tape = events;
  return events;
}

afterEach(() => {
  delete (globalThis as { __tape?: TapeEvent[] }).__tape;
  setPreview(null);
});

describe("sound catalog", () => {
  it("exposes the full named catalog with metadata", () => {
    expect(ALL_NAMES).toHaveLength(182);
    expect(ALL_NAMES[0]).toBe("glint");
    expect(ALL_NAMES).toContain("click");
    expect(AVAILABLE_NAMES).toEqual(ALL_NAMES);
    expect(Object.keys(SOUND_META)).toHaveLength(ALL_NAMES.length);
    for (const name of ALL_NAMES) {
      expect(SOUND_META[name]?.ms).toBeGreaterThan(0);
      expect(SOUND_META[name]?.parts).toBeGreaterThan(0);
    }
  });

  it("builds WAV filenames from sound names", () => {
    expect(wavFilename(["glint"])).toBe("bencho-glint.wav");
    expect(wavFilename(["glint", "clack"])).toBe("bencho-glint-clack.wav");
  });
});

describe("play", () => {
  it("records named plays on the tape hook", () => {
    const events = tape();
    play("click");
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe("click");
    expect(events[0]?.notes).toHaveLength(1);
    expect(events[0]?.gain).toBe(1);
  });

  it("throttles repeated plays within the gap window", () => {
    const events = tape();
    play("click", { gap: 60_000 });
    play("click", { gap: 60_000 });
    expect(events).toHaveLength(1);
  });

  it("respects a preview override unless asIs is set", () => {
    const events = tape();
    setPreview("paid", ["paid", "click"]);
    play("click");
    play("click", { asIs: true });
    expect(events.map((event) => event.name)).toEqual(["paid", "click"]);
    expect(events[0]?.gain).toBe(3);
  });

  it("ignores names excluded by the preview filter", () => {
    const events = tape();
    setPreview("paid", ["paid"]);
    play("click");
    expect(events).toHaveLength(0);
  });
});

describe("controls", () => {
  it("clamps volume and notifies subscribers", () => {
    const original = controls.volume();
    let notifications = 0;
    const unsubscribe = controls.subscribe(() => notifications++);
    try {
      controls.setVolume(2);
      expect(controls.volume()).toBe(1);
      controls.setVolume(-1);
      expect(controls.volume()).toBe(0);
      expect(notifications).toBe(2);
    } finally {
      controls.setVolume(original);
      unsubscribe();
    }
  });

  it("toggles the enabled state", () => {
    const events = tape();
    const original = controls.enabled();
    try {
      controls.toggle();
      expect(controls.enabled()).toBe(!original);
    } finally {
      if (controls.enabled() !== original) controls.toggle();
      expect(events.length).toBeGreaterThanOrEqual(0);
    }
  });
});
