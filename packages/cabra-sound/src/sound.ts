/**
 * cabra-sound — typed TypeScript port of the minified audio module.
 *
 * Behaviour is identical to the original bundle: lazy AudioContext creation,
 * gesture-based unlock, localStorage persistence, a Web Audio synth, offline
 * peak/waveform analysis and WAV export.
 *
 * Sound designs and synthesis approach are based on Bencho by cabralorenzo:
 * https://github.com/cabralorenzo/bencho/tree/main/sounds
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Wave = "sine" | "square" | "triangle" | "sawtooth";

/** A single synth voice. */
export interface Note {
  /** Base frequency in Hz. */
  hz: number;
  /** Frequency to ramp to (Hz). */
  to?: number;
  /** Ramp duration in ms (defaults to the note length). */
  glide?: number;
  /** Note length in ms. */
  ms: number;
  /** Peak gain (default 0.05). */
  gain?: number;
  wave?: Wave;
  /** Optional lowpass cutoff in Hz. */
  cut?: number;
  /** Attack in ms (default 4). */
  atk?: number;
  /** Start offset in ms. */
  at?: number;
  /** Use a linear amplitude ramp instead of exponential. */
  lin?: boolean;
  /** Use filtered white noise instead of an oscillator. */
  noise?: BiquadFilterType;
  /** Filter Q (only relevant for noise voices). */
  q?: number;
}

export interface PlayOptions {
  /** Play the given name as-is, ignoring any active preview override. */
  asIs?: boolean;
  /** Minimum ms between two plays of the same sound. */
  gap?: number;
  /** Position 0..1, mapped onto a pitch-bend multiplier. */
  at?: number;
  /** Play even when sound is disabled. */
  force?: boolean;
  /** Gain multiplier. */
  gain?: number;
}

export interface SoundMeta {
  hz: number;
  pitch: number;
  ms: number;
  gain: number;
  bend: number;
  parts: number;
  wave: Wave;
  cut: number | null;
  atk: number;
}

export interface Waveform {
  /** Normalised peak per bucket (sqrt-scaled against the library maximum). */
  peaks: number[];
  /** Total duration in ms. */
  ms: number;
}

export interface SoundControls {
  volume(): number;
  setVolume(value: number): void;
  subscribe(listener: () => void): () => void;
  enabled(): boolean;
  forceOn(): void;
  toggle(): void;
}

interface TapeEventBase {
  bend: number;
  t: number;
  gain: number;
}

interface TapeNamedEvent extends TapeEventBase {
  name: string;
  notes: Note[];
}

interface TapeNotesEvent extends TapeEventBase {
  notes: Note[];
}

type TapeEvent = TapeNamedEvent | TapeNotesEvent;

type OfflineContextCtor = typeof OfflineAudioContext;

// ---------------------------------------------------------------------------
// Sound definitions
// ---------------------------------------------------------------------------

const SOUND_DEFS = {
  paid: [
    { hz: 587, ms: 170, gain: 0.05, wave: `sine`, cut: 2600, atk: 5 },
    { hz: 880, ms: 460, gain: 0.046, wave: `sine`, cut: 2800, atk: 6, at: 95 },
    { hz: 1760, ms: 300, gain: 0.009, wave: `sine`, atk: 8, at: 100 },
  ],
  landed: [
    { hz: 330, to: 620, ms: 120, gain: 0.018, wave: `triangle`, cut: 1400, atk: 30 },
    { hz: 784, ms: 120, gain: 0.04, wave: `sine`, cut: 2600, atk: 4, at: 70 },
    { hz: 1047, ms: 130, gain: 0.04, wave: `sine`, cut: 2800, atk: 4, at: 140 },
    { hz: 1319, ms: 520, gain: 0.044, wave: `sine`, cut: 3e3, atk: 5, at: 210 },
    { hz: 2638, ms: 320, gain: 0.007, wave: `sine`, atk: 8, at: 215 },
  ],
  bubbleTap: [
    { hz: 480, to: 300, glide: 18, ms: 23, gain: 0.064, atk: 1 },
    { hz: 600, to: 900, glide: 40, ms: 61, gain: 0.015, atk: 12 },
    { hz: 960, to: 600, glide: 18, ms: 18, gain: 0.016, atk: 1 },
  ],
  attention: [
    { hz: 2500, ms: 5, gain: 0.029, noise: `lowpass`, q: -3, atk: 1 },
    { hz: 880, ms: 602, gain: 0.026, atk: 3 },
    { hz: 2428.8, ms: 283, gain: 0.0077, atk: 3 },
    { hz: 4752, ms: 172, gain: 0.0026, atk: 3 },
    { hz: 882, ms: 573, gain: 0.014, atk: 3 },
    { hz: 1318.51, ms: 562, gain: 0.02, atk: 3 },
    { hz: 3639.1, ms: 264, gain: 0.0059, atk: 3 },
  ],
  drag: [{ hz: 174, to: 155, ms: 250, gain: 0.034, wave: `sine`, cut: 640, atk: 28 }],
  off: [{ hz: 330, to: 247, ms: 88, gain: 0.03, wave: `sine`, cut: 720, atk: 8 }],
  lift: [{ hz: 660, to: 720, ms: 38, gain: 0.028, wave: `sine` }],
  sigh: [{ hz: 262, to: 131, ms: 28, gain: 0.065, wave: `triangle`, cut: 1700, atk: 8 }],
  perk: [{ hz: 330, ms: 360, gain: 0.053, wave: `sine`, cut: 560, atk: 90 }],
  purr: [{ hz: 92, ms: 350, gain: 0.046, wave: `triangle`, cut: 1100, atk: 32 }],
  lull: [{ hz: 234, ms: 214, gain: 0.054, wave: `sine`, cut: 820, atk: 8 }],
  whisk: [{ hz: 124, to: 65, ms: 130, gain: 0.067, wave: `sine`, cut: 560, atk: 50 }],
  buzz: [{ hz: 344, to: 239, ms: 24, gain: 0.048, wave: `triangle`, cut: 1100, atk: 7 }],
  deny: [{ hz: 208, to: 165, ms: 120, gain: 0.03, wave: `sine`, cut: 520, atk: 10 }],
  float: [{ hz: 262, ms: 322, gain: 0.052, wave: `sine`, cut: 820, atk: 16 }],
  glide: [{ hz: 397, to: 276, ms: 205, gain: 0.065, wave: `sine`, cut: 820, atk: 90 }],
  step: [{ hz: 227, to: 114, ms: 311, gain: 0.051, wave: `sine`, cut: 820, atk: 90 }],
  wander: [{ hz: 315, ms: 326, gain: 0.061, wave: `sine`, cut: 820, atk: 7 }],
  click: [{ hz: 196, to: 130, ms: 150, gain: 0.07, wave: `sine`, cut: 900 }],
  latch: [{ hz: 256, ms: 90, gain: 0.058, wave: `square`, cut: 2400, atk: 10 }],
  hail: [{ hz: 392, ms: 360, gain: 0.051, wave: `sine`, cut: 560, atk: 90 }],
  drape: [{ hz: 220, ms: 215, gain: 0.059, wave: `sine`, cut: 560, atk: 8 }],
  boot: [{ hz: 291, ms: 360, gain: 0.043, wave: `sine`, cut: 560, atk: 90 }],
  drone: [{ hz: 115, ms: 294, gain: 0.068, wave: `sine`, cut: 560, atk: 72 }],
  pick: [{ hz: 245, ms: 41, gain: 0.044, wave: `square`, cut: 2400, atk: 6 }],
  waft: [{ hz: 344, ms: 345, gain: 0.046, wave: `triangle`, cut: 1100, atk: 61 }],
  slink: [{ hz: 212, ms: 345, gain: 0.05, wave: `triangle`, cut: 1100, atk: 26 }],
  wake: [{ hz: 262, ms: 360, gain: 0.044, wave: `sine`, cut: 560, atk: 90 }],
  cog: [{ hz: 408, ms: 24, gain: 0.061, wave: `sine`, cut: 1100, atk: 10 }],
  pat: [{ hz: 230, ms: 60, gain: 0.036, wave: `triangle`, cut: 1700, atk: 10 }],
  knock: [{ hz: 330, ms: 32, gain: 0.046, wave: `triangle`, cut: 1100, atk: 7 }],
  hum: [{ hz: 196, ms: 302, gain: 0.061, wave: `sine`, cut: 560, atk: 90 }],
  jab: [{ hz: 259, ms: 33, gain: 0.049, wave: `square`, cut: 2400, atk: 6 }],
  groan: [{ hz: 394, to: 262, ms: 42, gain: 0.047, wave: `sine`, cut: 1100, atk: 6 }],
  chime: [{ hz: 220, ms: 271, gain: 0.046, wave: `sine`, cut: 820, atk: 90 }],
  shift: [{ hz: 294, to: 147, ms: 360, gain: 0.053, wave: `sine`, cut: 560, atk: 90 }],
  idle: [{ hz: 131, to: 65, ms: 360, gain: 0.055, wave: `triangle`, cut: 1700, atk: 90 }],
  cuff: [{ hz: 248, ms: 31, gain: 0.061, wave: `triangle`, cut: 1700, atk: 6 }],
  check: [{ hz: 370, ms: 90, gain: 0.055, wave: `square`, cut: 2400, atk: 10 }],
  vault: [{ hz: 218, to: 110, ms: 352, gain: 0.042, wave: `sine`, cut: 820, atk: 10 }],
  mark: [{ hz: 280, ms: 20, gain: 0.035, wave: `square`, cut: 2400, atk: 6 }],
  pop: [{ hz: 680, to: 930, ms: 34, gain: 0.05, wave: `sine`, atk: 3 }],
  dab: [{ hz: 233, ms: 32, gain: 0.046, wave: `triangle`, cut: 1700, atk: 10 }],
  snub: [{ hz: 344, to: 197, ms: 23, gain: 0.049, wave: `triangle`, cut: 1100, atk: 7 }],
  punt: [{ hz: 200, ms: 90, gain: 0.063, wave: `sine`, cut: 560, atk: 10 }],
  land: [{ hz: 262, to: 247, ms: 320, gain: 0.036, wave: `sine`, cut: 920, atk: 30 }],
  rise: [{ hz: 394, to: 612, ms: 360, gain: 0.057, wave: `triangle`, cut: 1700, atk: 13 }],
  stub: [{ hz: 224, ms: 34, gain: 0.059, wave: `triangle`, cut: 1700, atk: 10 }],
  chop: [{ hz: 315, ms: 56, gain: 0.065, wave: `triangle`, cut: 1100, atk: 10 }],
  press: [{ hz: 168, ms: 95, gain: 0.028, wave: `sine`, cut: 480, atk: 14 }],
  thump: [{ hz: 253, ms: 20, gain: 0.028, wave: `triangle`, cut: 1700, atk: 6 }],
  arc: [{ hz: 380, to: 193, ms: 184, gain: 0.052, wave: `triangle`, cut: 1700, atk: 82 }],
  climb: [{ hz: 220, ms: 144, gain: 0.046, wave: `sine`, cut: 820, atk: 60 }],
  peck: [{ hz: 283, ms: 90, gain: 0.07, wave: `triangle`, cut: 1100, atk: 6 }],
  pulse: [{ hz: 109, ms: 284, gain: 0.055, wave: `triangle`, cut: 1100, atk: 90 }],
  knell: [{ hz: 234, ms: 360, gain: 0.05, wave: `triangle`, cut: 1700, atk: 90 }],
  crest: [{ hz: 344, ms: 147, gain: 0.042, wave: `square`, cut: 2400, atk: 55 }],
  bop: [{ hz: 210, ms: 20, gain: 0.063, wave: `sine`, cut: 1100, atk: 6 }],
  trail: [{ hz: 262, ms: 360, gain: 0.036, wave: `triangle`, cut: 1700, atk: 17 }],
  creep: [{ hz: 405, ms: 332, gain: 0.055, wave: `sine`, cut: 560, atk: 32 }],
  notch: [{ hz: 230, ms: 49, gain: 0.048, wave: `sine`, cut: 820, atk: 6 }],
  pin: [{ hz: 329, ms: 37, gain: 0.059, wave: `triangle`, cut: 1100, atk: 6 }],
  drop: [{ hz: 196, to: 130, ms: 150, gain: 0.07, wave: `sine`, cut: 900 }],
  sweep: [{ hz: 256, to: 230, ms: 263, gain: 0.055, wave: `square`, cut: 2400, atk: 6 }],
  prod: [{ hz: 393, ms: 20, gain: 0.066, wave: `triangle`, cut: 1700, atk: 6 }],
  ferry: [{ hz: 220, to: 110, ms: 260, gain: 0.064, wave: `sine`, cut: 820, atk: 6 }],
  stride: [{ hz: 294, to: 147, ms: 350, gain: 0.05, wave: `triangle`, cut: 1100, atk: 86 }],
  swim: [{ hz: 124, ms: 175, gain: 0.049, wave: `triangle`, cut: 1700, atk: 64 }],
  fill: [{ hz: 245, ms: 169, gain: 0.043, wave: `triangle`, cut: 1100, atk: 83 }],
  bell: [{ hz: 366, ms: 319, gain: 0.041, wave: `sine`, cut: 560, atk: 90 }],
  swoop: [{ hz: 214, to: 124, ms: 241, gain: 0.065, wave: `sine`, cut: 560, atk: 90 }],
  tone: [{ hz: 276, ms: 300, gain: 0.052, wave: `sine`, cut: 820, atk: 90 }],
  sway: [{ hz: 408, ms: 217, gain: 0.054, wave: `triangle`, cut: 1100, atk: 7 }],
  hover: [{ hz: 232, ms: 360, gain: 0.038, wave: `sine`, cut: 560, atk: 66 }],
  flick: [{ hz: 333, ms: 25, gain: 0.045, wave: `triangle`, cut: 1100, atk: 9 }],
  expand: [
    { hz: 196, to: 174, ms: 360, gain: 0.042, wave: `sine`, cut: 880, atk: 36 },
    { hz: 294, to: 262, ms: 300, gain: 0.014, wave: `sine`, cut: 1100, atk: 48, at: 24 },
  ],
  skim: [{ hz: 261, ms: 360, gain: 0.039, wave: `sine`, cut: 560, atk: 74 }],
  roam: [{ hz: 394, ms: 360, gain: 0.058, wave: `triangle`, cut: 1100, atk: 18 }],
  portal: [{ hz: 220, to: 110, ms: 286, gain: 0.053, wave: `triangle`, cut: 1100, atk: 90 }],
  slide: [{ hz: 309, ms: 325, gain: 0.054, wave: `sine`, cut: 820, atk: 48 }],
  cross: [{ hz: 155, to: 78, ms: 235, gain: 0.059, wave: `sine`, cut: 820, atk: 14 }],
  tock: [{ hz: 250, ms: 28, gain: 0.045, wave: `triangle`, cut: 1700, atk: 10 }],
  poke: [{ hz: 380, ms: 20, gain: 0.047, wave: `triangle`, cut: 1700, atk: 5 }],
  tamp: [{ hz: 220, ms: 90, gain: 0.052, wave: `triangle`, cut: 1700, atk: 10 }],
  grip: [{ hz: 282, ms: 33, gain: 0.064, wave: `sine`, cut: 1100, atk: 9 }],
  bump: [
    { hz: 150, to: 92, ms: 140, gain: 0.07, wave: `sine`, cut: 640, atk: 4 },
    { hz: 420, ms: 26, gain: 0.014, wave: `triangle`, cut: 1500, atk: 3 },
  ],
  copied: [
    { hz: 880, ms: 70, gain: 0.026, wave: `sine`, cut: 2400, atk: 4 },
    { hz: 1175, ms: 150, gain: 0.02, wave: `sine`, cut: 2600, atk: 4, at: 55 },
  ],
  type: [
    { hz: 3900, ms: 6, gain: 0.077, noise: `bandpass`, q: 0.8, atk: 1 },
    { hz: 1550, ms: 15, gain: 0.22, noise: `bandpass`, q: 3.5, atk: 1 },
    { hz: 310, ms: 27, gain: 0.34, noise: `bandpass`, q: 2.5, atk: 2 },
  ],
  select: [
    { hz: 2800, ms: 8, gain: 0.13, noise: `bandpass`, q: 2.2, atk: 1 },
    { hz: 664, to: 415, glide: 18, ms: 20, gain: 0.024, atk: 1 },
  ],
  open: [
    {
      hz: 600,
      to: 1500,
      glide: 100,
      ms: 106,
      gain: 0.15,
      noise: `bandpass`,
      q: 1.4,
      atk: 50,
      lin: !0,
    },
    { hz: 659.25, ms: 215, gain: 0.013, atk: 50, lin: !0 },
    { hz: 1318.51, ms: 138, gain: 0.0044, atk: 50, lin: !0 },
  ],
  close: [
    {
      hz: 1400,
      to: 540,
      glide: 70,
      ms: 74,
      gain: 0.14,
      noise: `bandpass`,
      q: 1.4,
      atk: 20,
      lin: !0,
    },
    { hz: 261.63, ms: 107, gain: 0.013, atk: 3 },
    { hz: 350, ms: 28, gain: 0.14, noise: `bandpass`, q: 2, atk: 1 },
  ],
  navigate: [
    {
      hz: 400,
      to: 1100,
      glide: 210,
      ms: 231,
      gain: 0.15,
      noise: `bandpass`,
      q: 1.2,
      atk: 120,
      lin: !0,
    },
    { hz: 540, ms: 199, gain: 0.038, noise: `lowpass`, q: 0.7, atk: 90, lin: !0 },
  ],
  warning: [
    { hz: 1200, ms: 5, gain: 0.045, noise: `lowpass`, q: -3, atk: 1 },
    { hz: 440, ms: 166, gain: 0.043, atk: 3 },
    { hz: 1755.6, ms: 61, gain: 0.0086, atk: 3 },
    { hz: 659.25, ms: 148, gain: 0.034, atk: 3 },
    { hz: 2630.4, ms: 54, gain: 0.0067, atk: 3 },
  ],
  loading: [
    { hz: 196, ms: 1319, gain: 0.016, atk: 350, lin: !0 },
    { hz: 392, ms: 1250, gain: 0.0054, atk: 350, lin: !0 },
    { hz: 500, ms: 1194, gain: 0.0034, noise: `lowpass`, q: 0.7, atk: 350, lin: !0 },
  ],
  ready: [
    { hz: 1500, ms: 5, gain: 0.024, noise: `lowpass`, q: -3, atk: 1 },
    { hz: 392, ms: 500, gain: 0.032, atk: 3 },
    { hz: 1081.92, ms: 235, gain: 0.0095, atk: 3 },
    { hz: 2116.8, ms: 143, gain: 0.0032, atk: 3 },
    { hz: 393.2, ms: 465, gain: 0.015, atk: 3 },
  ],
  count: [
    {
      hz: 700,
      to: 1400,
      glide: 600,
      ms: 761,
      gain: 0.044,
      noise: `bandpass`,
      q: 1.2,
      atk: 150,
      lin: !0,
    },
    { hz: 1046.5, ms: 871, gain: 0.01, atk: 150, lin: !0 },
    {
      hz: 2e3,
      to: 3200,
      glide: 600,
      ms: 802,
      gain: 0.018,
      noise: `bandpass`,
      q: 2,
      atk: 150,
      lin: !0,
    },
  ],
  mechTap: [
    { hz: 2650, ms: 5, gain: 0.13, noise: `bandpass`, q: 1.5, atk: 1 },
    { hz: 728, to: 455, glide: 18, ms: 17, gain: 0.033, atk: 1 },
    { hz: 4600, ms: 3, gain: 0.085, noise: `bandpass`, q: 2, atk: 1 },
  ],
  mechType: [
    { hz: 3e3, ms: 4, gain: 0.1, noise: `bandpass`, q: 1.2, atk: 1 },
    { hz: 2150, ms: 8, gain: 0.18, noise: `bandpass`, q: 5, atk: 1 },
    { hz: 750, ms: 10, gain: 0.22, noise: `bandpass`, q: 3, atk: 1 },
  ],
  mechSelect: [
    { hz: 3650, ms: 4, gain: 0.15, noise: `bandpass`, q: 3, atk: 1 },
    { hz: 1500, ms: 9, gain: 0.27, noise: `bandpass`, q: 8, atk: 1 },
    { hz: 1480, ms: 44, gain: 0.0092, atk: 1 },
  ],
  mechToggle: [
    { hz: 1650, ms: 5, gain: 0.11, noise: `bandpass`, q: 2, atk: 1 },
    { hz: 528, to: 330, glide: 18, ms: 30, gain: 0.031, atk: 1 },
    { hz: 2650, ms: 7, gain: 0.14, noise: `bandpass`, q: 3, atk: 1 },
  ],
  mechOpen: [
    { hz: 2150, ms: 5, gain: 0.36, noise: `bandpass`, q: 3, atk: 1 },
    {
      hz: 1160,
      to: 2150,
      glide: 50,
      ms: 51,
      gain: 0.18,
      noise: `bandpass`,
      q: 2,
      atk: 20,
      lin: !0,
    },
    { hz: 1330, ms: 9, gain: 0.32, noise: `bandpass`, q: 5, atk: 1 },
  ],
  mechClose: [
    {
      hz: 2150,
      to: 1080,
      glide: 40,
      ms: 44,
      gain: 0.08,
      noise: `bandpass`,
      q: 2,
      atk: 15,
      lin: !0,
    },
    { hz: 1e3, ms: 10, gain: 0.44, noise: `bandpass`, q: 4, atk: 1 },
    { hz: 3300, ms: 4, gain: 0.2, noise: `bandpass`, q: 2, atk: 1 },
  ],
  mechSuccess: [
    { hz: 2200, ms: 5, gain: 0.047, noise: `lowpass`, q: -3, atk: 1 },
    { hz: 698.46, ms: 124, gain: 0.029, atk: 3 },
    { hz: 1927.75, ms: 60, gain: 0.0088, atk: 3 },
    { hz: 3771.7, ms: 37, gain: 0.0029, atk: 3 },
    { hz: 1046.5, ms: 152, gain: 0.025, atk: 3 },
    { hz: 2888.3, ms: 73, gain: 0.0072, atk: 3 },
    { hz: 1760, ms: 109, gain: 0.017, atk: 3 },
    { hz: 4857.6, ms: 52, gain: 0.0051, atk: 3 },
  ],
  mechError: [
    { hz: 430, ms: 18, gain: 0.44, noise: `bandpass`, q: 4, atk: 1 },
    { hz: 293.66, ms: 71, gain: 0.066, atk: 3 },
    { hz: 810.5, ms: 35, gain: 0.02, atk: 3 },
    { hz: 1585.8, ms: 31, gain: 0.0066, atk: 3 },
    { hz: 698.46, ms: 55, gain: 0.029, atk: 3 },
    { hz: 1927.75, ms: 31, gain: 0.0087, atk: 3 },
    { hz: 3771.7, ms: 31, gain: 0.0029, atk: 3 },
    { hz: 1830, ms: 7, gain: 0.14, noise: `bandpass`, q: 3, atk: 1 },
  ],
  mechNavigate: [
    {
      hz: 750,
      to: 1400,
      glide: 130,
      ms: 146,
      gain: 0.21,
      noise: `bandpass`,
      q: 1.8,
      atk: 50,
      lin: !0,
    },
    { hz: 2500, ms: 4, gain: 0.21, noise: `bandpass`, q: 4, atk: 1 },
  ],
  mechWarning: [
    { hz: 2e3, ms: 5, gain: 0.042, noise: `lowpass`, q: -3, atk: 1 },
    { hz: 587.33, ms: 95, gain: 0.034, atk: 3 },
    { hz: 1621, ms: 46, gain: 0.01, atk: 3 },
    { hz: 3171.6, ms: 31, gain: 0.0034, atk: 3 },
    { hz: 880, ms: 100, gain: 0.025, atk: 3 },
    { hz: 2428.8, ms: 48, gain: 0.0074, atk: 3 },
    { hz: 4752, ms: 31, gain: 0.0025, atk: 3 },
  ],
  mechLoading: [
    { hz: 500, ms: 1198, gain: 0.026, noise: `bandpass`, q: 1, atk: 350, lin: !0 },
    { hz: 233.08, ms: 1315, gain: 0.013, atk: 350, lin: !0 },
    { hz: 1e3, ms: 1233, gain: 0.0043, noise: `bandpass`, q: 2, atk: 350, lin: !0 },
  ],
  mechReady: [
    { hz: 2e3, ms: 5, gain: 0.053, noise: `lowpass`, q: -3, atk: 1 },
    { hz: 523.25, ms: 181, gain: 0.053, atk: 3 },
    { hz: 1444.17, ms: 86, gain: 0.016, atk: 3 },
    { hz: 2825.55, ms: 53, gain: 0.0053, atk: 3 },
  ],
  mechAttention: [
    { hz: 2500, ms: 5, gain: 0.035, noise: `lowpass`, q: -3, atk: 1 },
    { hz: 880, ms: 234, gain: 0.035, atk: 3 },
    { hz: 2428.8, ms: 111, gain: 0.01, atk: 3 },
    { hz: 4752, ms: 68, gain: 0.0035, atk: 3 },
    { hz: 1318.51, ms: 245, gain: 0.027, atk: 3 },
    { hz: 3639.1, ms: 116, gain: 0.0077, atk: 3 },
  ],
  mechCount: [
    {
      hz: 500,
      to: 900,
      glide: 600,
      ms: 748,
      gain: 0.1,
      noise: `bandpass`,
      q: 2,
      atk: 100,
      lin: !0,
    },
    {
      hz: 1900,
      to: 3300,
      glide: 600,
      ms: 706,
      gain: 0.051,
      noise: `bandpass`,
      q: 4,
      atk: 100,
      lin: !0,
    },
  ],
  bubbleType: [
    { hz: 664, to: 415, glide: 18, ms: 16, gain: 0.06, atk: 1 },
    { hz: 2500, ms: 4, gain: 0.03, noise: `lowpass`, q: 0.9, atk: 1 },
  ],
  bubbleSelect: [
    { hz: 700, to: 1050, glide: 12, ms: 29, gain: 0.028, atk: 1 },
    { hz: 3e3, ms: 4, gain: 0.042, noise: `lowpass`, q: 0.9, atk: 1 },
  ],
  bubbleToggle: [
    { hz: 900, ms: 9, gain: 0.055, noise: `lowpass`, q: 0.9, atk: 1 },
    { hz: 330, to: 660, glide: 60, ms: 82, gain: 0.021, atk: 3 },
    { hz: 990, to: 1485, glide: 20, ms: 75, gain: 0.0046, atk: 30, lin: !0 },
  ],
  bubbleOpen: [
    { hz: 220, to: 520, glide: 140, ms: 169, gain: 0.023, atk: 100, lin: !0 },
    { hz: 330, to: 780, glide: 140, ms: 187, gain: 0.0069, atk: 100, lin: !0 },
  ],
  bubbleClose: [
    { hz: 700, to: 220, glide: 70, ms: 95, gain: 0.042, atk: 4 },
    { hz: 1200, ms: 4, gain: 0.056, noise: `lowpass`, q: 0.9, atk: 1 },
  ],
  bubbleSuccess: [
    { hz: 523.25, to: 783.99, glide: 80, ms: 326, gain: 0.054, atk: 3 },
    { hz: 1046.5, to: 1567.98, glide: 80, ms: 123, gain: 0.014, atk: 3 },
  ],
  bubbleError: [
    { hz: 349.23, to: 261.63, glide: 140, ms: 230, gain: 0.045, atk: 4 },
    { hz: 900, ms: 4, gain: 0.12, noise: `lowpass`, q: 0.9, atk: 1 },
  ],
  bubbleNavigate: [
    { hz: 300, to: 1500, glide: 90, ms: 104, gain: 0.051, atk: 10 },
    {
      hz: 1500,
      to: 3e3,
      glide: 90,
      ms: 98,
      gain: 0.072,
      noise: `bandpass`,
      q: 1,
      atk: 20,
      lin: !0,
    },
  ],
  bubbleWarning: [
    { hz: 500, to: 440, glide: 50, ms: 183, gain: 0.051, atk: 2 },
    { hz: 1800, ms: 4, gain: 0.1, noise: `lowpass`, q: 0.9, atk: 1 },
  ],
  bubbleLoading: [
    { hz: 900, ms: 1077, gain: 0.021, noise: `lowpass`, q: 0.7, atk: 350, lin: !0 },
    { hz: 400, to: 600, glide: 350, ms: 1303, gain: 0.011, atk: 350, lin: !0 },
    { hz: 1800, ms: 1099, gain: 0.0028, noise: `bandpass`, q: 1.5, atk: 350, lin: !0 },
  ],
  bubbleReady: [
    { hz: 1400, to: 700, glide: 12, ms: 25, gain: 0.042, atk: 1 },
    { hz: 392, to: 587.33, glide: 60, ms: 300, gain: 0.056, atk: 12 },
    { hz: 2e3, ms: 4, gain: 0.042, noise: `lowpass`, q: 0.9, atk: 1 },
  ],
  bubbleAttention: [
    { hz: 659.25, to: 880, glide: 140, ms: 298, gain: 0.061, atk: 3 },
    { hz: 2200, ms: 4, gain: 0.21, noise: `lowpass`, q: 0.9, atk: 1 },
  ],
  bubbleCount: [
    {
      hz: 900,
      to: 1800,
      glide: 600,
      ms: 784,
      gain: 0.028,
      noise: `lowpass`,
      q: 0.7,
      atk: 150,
      lin: !0,
    },
    { hz: 587.33, to: 880, glide: 600, ms: 867, gain: 0.014, atk: 150, lin: !0 },
    { hz: 1600, ms: 4, gain: 0.035, noise: `lowpass`, q: 0.9, atk: 1 },
  ],
  pressTap: [
    { hz: 4e3, ms: 7, gain: 0.078, noise: `bandpass`, q: 8, atk: 1 },
    { hz: 2700, ms: 7, gain: 0.039, noise: `bandpass`, q: 2, atk: 1 },
    { hz: 71.3, to: 65.41, glide: 15, ms: 1470, gain: 0.018, atk: 110, lin: !0 },
    { hz: 142.6, to: 130.82, glide: 15, ms: 1334, gain: 0.0088, atk: 110, lin: !0 },
    { hz: 4800, ms: 7, gain: 0.042, noise: `bandpass`, q: 8, atk: 1, at: 90 },
    { hz: 3240, ms: 7, gain: 0.021, noise: `bandpass`, q: 2, atk: 1, at: 90 },
  ],
  pressType: [
    { hz: 4200, ms: 7, gain: 0.19, noise: `bandpass`, q: 8, atk: 1 },
    { hz: 2835, ms: 7, gain: 0.097, noise: `bandpass`, q: 2, atk: 1 },
    { hz: 488, to: 305, glide: 18, ms: 30, gain: 0.031, atk: 1 },
    { hz: 4100, ms: 7, gain: 0.062, noise: `bandpass`, q: 8, atk: 1, at: 90 },
    { hz: 1e3, ms: 7, gain: 0.047, noise: `bandpass`, q: 2, atk: 1, at: 90 },
    { hz: 662.4, to: 414, glide: 18, ms: 23, gain: 0.0093, atk: 1, at: 90 },
  ],
  pressSelect: [
    { hz: 4800, ms: 7, gain: 0.14, noise: `bandpass`, q: 8, atk: 1 },
    { hz: 3240, ms: 7, gain: 0.069, noise: `bandpass`, q: 2, atk: 1 },
    { hz: 1120, to: 700, glide: 18, ms: 21, gain: 0.023, atk: 1 },
    { hz: 4800, ms: 7, gain: 0.035, noise: `bandpass`, q: 8, atk: 1, at: 90 },
  ],
  pressToggle: [
    { hz: 4e3, ms: 7, gain: 0.059, noise: `bandpass`, q: 8, atk: 1 },
    { hz: 2700, ms: 7, gain: 0.029, noise: `bandpass`, q: 2, atk: 1 },
    { hz: 528, to: 330, glide: 18, ms: 40, gain: 0.012, atk: 1 },
    { hz: 89.83, to: 82.41, glide: 15, ms: 434, gain: 0.014, atk: 110, lin: !0 },
    { hz: 179.66, to: 164.82, glide: 15, ms: 402, gain: 0.0072, atk: 110, lin: !0 },
    { hz: 4800, ms: 7, gain: 0.024, noise: `bandpass`, q: 8, atk: 1, at: 90 },
    { hz: 3240, ms: 7, gain: 0.012, noise: `bandpass`, q: 2, atk: 1, at: 90 },
  ],
  pressOpen: [
    { hz: 4800, ms: 7, gain: 0.034, noise: `bandpass`, q: 8, atk: 1 },
    { hz: 3240, ms: 7, gain: 0.017, noise: `bandpass`, q: 2, atk: 1 },
    { hz: 704, to: 440, glide: 18, ms: 37, gain: 0.0067, atk: 1 },
    { hz: 1600, to: 3200, glide: 35, ms: 43, gain: 0.022, noise: `bandpass`, q: 1.5, atk: 8 },
    { hz: 119.9, to: 110, glide: 15, ms: 937, gain: 0.018, atk: 110, lin: !0 },
    { hz: 239.8, to: 220, glide: 15, ms: 854, gain: 0.0089, atk: 110, lin: !0 },
    { hz: 4800, ms: 7, gain: 0.011, noise: `bandpass`, q: 8, atk: 1, at: 90 },
  ],
  pressClose: [
    { hz: 3200, ms: 7, gain: 0.053, noise: `bandpass`, q: 8, atk: 1 },
    { hz: 2160, ms: 7, gain: 0.026, noise: `bandpass`, q: 2, atk: 1 },
    { hz: 209.3, to: 130.81, glide: 18, ms: 44, gain: 0.016, atk: 1 },
    { hz: 1800, to: 700, glide: 40, ms: 48, gain: 0.026, noise: `bandpass`, q: 1.5, atk: 8 },
    { hz: 71.3, to: 65.41, glide: 15, ms: 368, gain: 0.021, atk: 110, lin: !0 },
    { hz: 142.6, to: 130.82, glide: 15, ms: 342, gain: 0.01, atk: 110, lin: !0 },
    { hz: 285.2, to: 261.64, glide: 15, ms: 298, gain: 0.0012, atk: 110, lin: !0 },
  ],
  pressSuccess: [
    { hz: 285.2, to: 261.63, glide: 15, ms: 1580, gain: 0.019, atk: 110, lin: !0 },
    { hz: 570.4, to: 523.26, glide: 15, ms: 1433, gain: 0.0096, atk: 110, lin: !0 },
    { hz: 1140.7, to: 1046.52, glide: 15, ms: 1183, gain: 0.0011, atk: 110, lin: !0 },
    { hz: 427.3, to: 392, glide: 15, ms: 1620, gain: 0.016, atk: 110, lin: !0 },
    { hz: 854.6, to: 784, glide: 15, ms: 1469, gain: 0.008, atk: 110, lin: !0 },
    { hz: 718.6, to: 659.25, glide: 15, ms: 1470, gain: 0.012, atk: 110, lin: !0 },
    { hz: 1437.2, to: 1318.5, glide: 15, ms: 1334, gain: 0.006, atk: 110, lin: !0 },
  ],
  pressError: [
    { hz: 119.9, to: 110, glide: 15, ms: 597, gain: 0.022, atk: 110, lin: !0 },
    { hz: 239.8, to: 220, glide: 15, ms: 548, gain: 0.011, atk: 110, lin: !0 },
    { hz: 479.6, to: 440, glide: 15, ms: 466, gain: 0.0012, atk: 110, lin: !0 },
    { hz: 570.3, to: 523.25, glide: 15, ms: 571, gain: 0.0074, atk: 110, lin: !0 },
    { hz: 1140.7, to: 1046.5, glide: 15, ms: 525, gain: 0.0037, atk: 110, lin: !0 },
    { hz: 200, ms: 65, gain: 0.037, noise: `lowpass`, q: 0.7, atk: 10 },
  ],
  pressNavigate: [
    { hz: 4800, ms: 7, gain: 0.25, noise: `bandpass`, q: 8, atk: 1 },
    { hz: 3240, ms: 7, gain: 0.12, noise: `bandpass`, q: 2, atk: 1 },
    { hz: 600, to: 1400, glide: 88, ms: 96, gain: 0.2, noise: `bandpass`, q: 1, atk: 8 },
    { hz: 939.7, to: 587.33, glide: 18, ms: 22, gain: 0.025, atk: 1 },
  ],
  pressWarning: [
    { hz: 239.8, to: 220, glide: 15, ms: 1015, gain: 0.018, atk: 110, lin: !0 },
    { hz: 479.6, to: 440, glide: 15, ms: 925, gain: 0.009, atk: 110, lin: !0 },
    { hz: 959.2, to: 880, glide: 15, ms: 771, gain: 0.001, atk: 110, lin: !0 },
    { hz: 359.3, to: 329.63, glide: 15, ms: 950, gain: 0.0135, atk: 110, lin: !0 },
    { hz: 718.6, to: 659.26, glide: 15, ms: 866, gain: 0.0067, atk: 110, lin: !0 },
  ],
  pressLoading: [
    { hz: 196, ms: 1239, gain: 0.017, atk: 350, lin: !0 },
    { hz: 392, ms: 1250, gain: 0.0034, atk: 350, lin: !0 },
  ],
  pressReady: [
    { hz: 213.6, to: 196, glide: 15, ms: 1890, gain: 0.028, atk: 110, lin: !0 },
    { hz: 427.3, to: 392, glide: 15, ms: 1712, gain: 0.014, atk: 110, lin: !0 },
    { hz: 641, to: 588, glide: 15, ms: 1890, gain: 0.0011, atk: 110, lin: !0 },
    { hz: 854.6, to: 784, glide: 15, ms: 1409, gain: 0.0016, atk: 110, lin: !0 },
  ],
  pressAttention: [
    { hz: 479.6, to: 440, glide: 15, ms: 2450, gain: 0.022, atk: 110, lin: !0 },
    { hz: 959.2, to: 880, glide: 15, ms: 2216, gain: 0.011, atk: 110, lin: !0 },
    { hz: 1918.4, to: 1760, glide: 15, ms: 1818, gain: 0.0012, atk: 110, lin: !0 },
    { hz: 718.6, to: 659.25, glide: 15, ms: 2350, gain: 0.016, atk: 110, lin: !0 },
    { hz: 1437.2, to: 1318.5, glide: 15, ms: 2126, gain: 0.0078, atk: 110, lin: !0 },
    { hz: 959.2, to: 880, glide: 15, ms: 2e3, gain: 0.0078, atk: 110, lin: !0 },
    { hz: 1918.4, to: 1760, glide: 15, ms: 1811, gain: 0.0039, atk: 110, lin: !0 },
  ],
  pressCount: [
    {
      hz: 900,
      to: 1800,
      glide: 600,
      ms: 718,
      gain: 0.076,
      noise: `bandpass`,
      q: 2,
      atk: 150,
      lin: !0,
    },
    {
      hz: 200,
      to: 500,
      glide: 600,
      ms: 744,
      gain: 0.057,
      noise: `lowpass`,
      q: 0.7,
      atk: 150,
      lin: !0,
    },
    {
      hz: 2600,
      to: 3600,
      glide: 600,
      ms: 737,
      gain: 0.019,
      noise: `bandpass`,
      q: 4,
      atk: 150,
      lin: !0,
    },
  ],
  crinkle: [
    { hz: 3400, ms: 22, gain: 0.05, at: 0, q: 2, noise: `bandpass`, atk: 1 },
    { hz: 2600, ms: 18, gain: 0.04, at: 34, q: 2, noise: `bandpass`, atk: 1 },
    { hz: 4200, ms: 16, gain: 0.035, at: 61, q: 2, noise: `bandpass`, atk: 1 },
    { hz: 3e3, ms: 24, gain: 0.045, at: 92, q: 2, noise: `bandpass`, atk: 1 },
  ],
  rustle: [{ hz: 3e3, ms: 26, gain: 0.035, at: 0, q: 1.4, noise: `bandpass`, atk: 1 }],
  toss: [{ hz: 1100, to: 520, ms: 170, gain: 0.03, q: 0.8, noise: `bandpass`, atk: 40, lin: !0 }],
  paperTap: [{ hz: 1300, ms: 28, gain: 0.06, at: 0, q: -3, noise: `lowpass`, atk: 2 }],
  rim: [
    { hz: 800, ms: 30, gain: 0.06, at: 0, q: 3, noise: `bandpass`, atk: 1 },
    { hz: 500, ms: 40, gain: 0.03, at: 0, q: -3, noise: `lowpass`, atk: 2 },
  ],
  trash: [
    { hz: 650, ms: 70, gain: 0.08, at: 0, q: -3, noise: `lowpass`, atk: 2 },
    { hz: 2400, ms: 20, gain: 0.02, at: 4, q: 2, noise: `bandpass`, atk: 1 },
  ],
  print: [
    { hz: 5200, ms: 6, gain: 0.018, at: 0, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 4800, ms: 6, gain: 0.018, at: 22, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 4400, ms: 6, gain: 0.018, at: 44, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 5200, ms: 6, gain: 0.018, at: 66, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 4800, ms: 6, gain: 0.018, at: 88, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 4400, ms: 6, gain: 0.018, at: 110, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 5200, ms: 6, gain: 0.018, at: 132, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 4800, ms: 6, gain: 0.018, at: 154, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 4400, ms: 6, gain: 0.018, at: 176, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 5200, ms: 6, gain: 0.018, at: 198, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 4800, ms: 6, gain: 0.018, at: 220, q: 4, noise: `bandpass`, atk: 1 },
    { hz: 4400, ms: 6, gain: 0.018, at: 242, q: 4, noise: `bandpass`, atk: 1 },
  ],
  breath: [{ hz: 1600, ms: 120, gain: 0.012, q: 1, noise: `bandpass`, atk: 40, lin: !0 }],
  pouch: [
    { hz: 700, ms: 34, gain: 0.05, q: -3, noise: `lowpass`, atk: 3 },
    { hz: 190, ms: 40, gain: 0.03, wave: `sine`, atk: 4 },
  ],
  creak: [
    { hz: 210, to: 250, ms: 30, gain: 0.04, wave: `triangle`, cut: 900, atk: 4 },
    { hz: 1900, ms: 10, gain: 0.012, q: 3, noise: `bandpass`, atk: 1 },
  ],
  strain: [{ hz: 320, to: 296, ms: 90, gain: 0.04, wave: `sawtooth`, cut: 650, atk: 10 }],
  twang: [
    { hz: 2600, ms: 14, gain: 0.04, q: 2, noise: `bandpass`, atk: 1 },
    { hz: 150, to: 92, ms: 210, gain: 0.09, wave: `triangle`, atk: 2, glide: 130 },
    { hz: 300, to: 188, ms: 100, gain: 0.025, wave: `sine`, at: 6, atk: 2 },
  ],
  boing: [
    { hz: 260, to: 430, ms: 70, gain: 0.045, wave: `sine`, atk: 3, glide: 40 },
    { hz: 430, to: 350, ms: 60, gain: 0.02, wave: `sine`, at: 42, atk: 3 },
  ],
  thud: [
    { hz: 120, to: 70, ms: 110, gain: 0.1, wave: `sine`, atk: 2, glide: 30 },
    { hz: 700, ms: 30, gain: 0.035, q: -3, noise: `lowpass`, atk: 2 },
  ],
  compact: [
    { hz: 2200, to: 380, ms: 280, gain: 0.02, q: -3, noise: `lowpass`, atk: 30, lin: !0 },
    { hz: 440, to: 220, ms: 270, gain: 0.034, wave: `sine`, cut: 1100, atk: 24 },
    {
      hz: 196,
      to: 150,
      ms: 110,
      gain: 0.06,
      wave: `triangle`,
      cut: 900,
      atk: 2,
      glide: 18,
      at: 280,
    },
    { hz: 988, ms: 380, gain: 0.018, wave: `sine`, cut: 2800, atk: 5, at: 300 },
  ],
  restore: [
    { hz: 420, to: 1800, ms: 260, gain: 0.016, q: -3, noise: `lowpass`, atk: 40, lin: !0 },
    { hz: 220, to: 392, ms: 250, gain: 0.03, wave: `sine`, cut: 1100, atk: 30 },
    { hz: 262, ms: 90, gain: 0.04, wave: `triangle`, cut: 1100, atk: 3, at: 270 },
  ],
  stretch: [
    { hz: 240, to: 290, ms: 46, gain: 0.034, wave: `triangle`, cut: 760, atk: 5, glide: 30 },
    { hz: 120, ms: 40, gain: 0.022, wave: `sine`, atk: 4 },
  ],
  dust: [
    { hz: 3400, to: 1300, ms: 1e3, gain: 0.044, q: 1.4, noise: `bandpass`, atk: 160, lin: !0 },
    { hz: 900, to: 420, ms: 700, gain: 0.026, q: -3, noise: `lowpass`, atk: 60, lin: !0 },
    { hz: 4200, ms: 16, gain: 0.026, q: 4, noise: `bandpass`, atk: 1, at: 70 },
    { hz: 3100, ms: 14, gain: 0.022, q: 4, noise: `bandpass`, atk: 1, at: 150 },
    { hz: 5e3, ms: 12, gain: 0.02, q: 4, noise: `bandpass`, atk: 1, at: 210 },
    { hz: 3700, ms: 16, gain: 0.024, q: 4, noise: `bandpass`, atk: 1, at: 320 },
    { hz: 2700, ms: 14, gain: 0.02, q: 4, noise: `bandpass`, atk: 1, at: 400 },
    { hz: 4600, ms: 12, gain: 0.018, q: 4, noise: `bandpass`, atk: 1, at: 520 },
    { hz: 3300, ms: 14, gain: 0.018, q: 4, noise: `bandpass`, atk: 1, at: 610 },
    { hz: 2400, ms: 16, gain: 0.015, q: 4, noise: `bandpass`, atk: 1, at: 760 },
    { hz: 3900, ms: 12, gain: 0.013, q: 4, noise: `bandpass`, atk: 1, at: 880 },
  ],
  settle: [
    { hz: 150, to: 96, ms: 140, gain: 0.05, wave: `sine`, cut: 600, atk: 6, glide: 60 },
    { hz: 1600, to: 700, ms: 120, gain: 0.014, q: 1, noise: `bandpass`, atk: 8 },
  ],
  flap: [
    { hz: 2800, ms: 9, gain: 0.05, q: 3, noise: `bandpass`, atk: 1 },
    { hz: 300, to: 210, ms: 18, gain: 0.05, wave: `triangle`, cut: 1400, atk: 1, glide: 10, at: 2 },
  ],
  bet: [
    { hz: 3600, ms: 12, gain: 0.075, q: 6, noise: `bandpass`, atk: 1 },
    { hz: 2350, ms: 40, gain: 0.027, wave: `sine`, atk: 1 },
    { hz: 3300, ms: 12, gain: 0.068, q: 6, noise: `bandpass`, atk: 1, at: 60 },
    { hz: 2150, ms: 45, gain: 0.024, wave: `sine`, atk: 1, at: 60 },
    {
      hz: 196,
      to: 160,
      ms: 120,
      gain: 0.06,
      wave: `triangle`,
      cut: 900,
      atk: 4,
      glide: 40,
      at: 110,
    },
  ],
  trace: [{ hz: 520, ms: 46, gain: 0.022, wave: `sine`, cut: 1400, atk: 8 }],
  summon: [
    { hz: 600, to: 2600, ms: 560, gain: 0.018, q: 1.2, noise: `bandpass`, atk: 220, lin: !0 },
    { hz: 330, to: 494, ms: 520, gain: 0.03, wave: `sine`, cut: 1600, atk: 160, lin: !0 },
    { hz: 988, ms: 420, gain: 0.02, wave: `sine`, cut: 3e3, atk: 6, at: 540 },
  ],
  tuck: [
    { hz: 2600, to: 600, ms: 540, gain: 0.016, q: 1.2, noise: `bandpass`, atk: 160, lin: !0 },
    { hz: 494, to: 294, ms: 520, gain: 0.028, wave: `sine`, cut: 1400, atk: 120, lin: !0 },
    { hz: 196, to: 165, ms: 160, gain: 0.04, wave: `sine`, cut: 800, atk: 5, glide: 50, at: 560 },
  ],
  cardFan: [
    { hz: 2600, ms: 10, gain: 0.05, q: 3, noise: `bandpass`, atk: 1 },
    { hz: 2900, ms: 9, gain: 0.044, q: 3, noise: `bandpass`, atk: 1, at: 26 },
    { hz: 2700, ms: 10, gain: 0.038, q: 3, noise: `bandpass`, atk: 1, at: 49 },
    { hz: 3200, ms: 8, gain: 0.032, q: 3, noise: `bandpass`, atk: 1, at: 75 },
    { hz: 3e3, ms: 9, gain: 0.026, q: 3, noise: `bandpass`, atk: 1, at: 98 },
    { hz: 1800, to: 2600, ms: 120, gain: 0.012, q: 1, noise: `bandpass`, atk: 20, lin: !0 },
  ],
  cardSlide: [
    { hz: 1900, to: 2600, ms: 80, gain: 0.014, q: 1, noise: `bandpass`, atk: 14, lin: !0 },
  ],
  cardFlip: [
    { hz: 900, to: 2800, ms: 260, gain: 0.03, q: 1, noise: `bandpass`, atk: 70, lin: !0 },
    { hz: 3300, ms: 11, gain: 0.07, q: 4, noise: `bandpass`, atk: 1, at: 300 },
    {
      hz: 260,
      to: 190,
      ms: 26,
      gain: 0.04,
      wave: `triangle`,
      cut: 1200,
      atk: 1,
      glide: 14,
      at: 302,
    },
  ],
  cardPlace: [
    { hz: 2600, to: 900, ms: 220, gain: 0.024, q: 1, noise: `bandpass`, atk: 40, lin: !0 },
    { hz: 1100, ms: 30, gain: 0.06, q: -3, noise: `lowpass`, atk: 2, at: 240 },
    { hz: 170, to: 130, ms: 60, gain: 0.04, wave: `sine`, cut: 700, atk: 3, glide: 30, at: 240 },
    { hz: 3e3, ms: 7, gain: 0.018, q: 4, noise: `bandpass`, atk: 1, at: 244 },
  ],
  cardGather: [
    { hz: 3100, ms: 8, gain: 0.03, q: 3, noise: `bandpass`, atk: 1 },
    { hz: 2800, ms: 8, gain: 0.028, q: 3, noise: `bandpass`, atk: 1, at: 20 },
    { hz: 2900, ms: 8, gain: 0.026, q: 3, noise: `bandpass`, atk: 1, at: 38 },
    { hz: 2500, ms: 9, gain: 0.024, q: 3, noise: `bandpass`, atk: 1, at: 57 },
    { hz: 1200, ms: 26, gain: 0.045, q: -3, noise: `lowpass`, atk: 2, at: 84 },
  ],
  till: [
    { hz: 45, to: 32, ms: 135, gain: 0.05, atk: 70, lin: !0 },
    { hz: 3200, ms: 110, gain: 0.04, noise: `bandpass`, q: 0.6, at: 50, atk: 25, lin: !0 },
    { hz: 5e3, ms: 600, gain: 0.012, noise: `bandpass`, q: 2, at: 100, atk: 10 },
    { hz: 5300, ms: 1e3, gain: 0.011, at: 95, atk: 4 },
    { hz: 5478, ms: 750, gain: 0.0084, at: 95, atk: 4 },
    { hz: 4160, ms: 1500, gain: 0.0096, at: 115, atk: 4 },
    { hz: 4370, ms: 1400, gain: 0.009, at: 115, atk: 4 },
    { hz: 3735, ms: 1200, gain: 0.0048, at: 300, atk: 40 },
    { hz: 3095, ms: 1200, gain: 0.0042, at: 400, atk: 40 },
  ],
  glint: [
    { hz: 2270, to: 2080, ms: 30, gain: 0.04, atk: 1, glide: 10 },
    { hz: 3370, to: 3100, ms: 26, gain: 0.032, atk: 1 },
    { hz: 4200, ms: 18, gain: 0.04, noise: `bandpass`, q: 1.2, atk: 1 },
    { hz: 520, to: 420, ms: 30, gain: 0.0096, atk: 1 },
  ],
  clack: [
    { hz: 2600, ms: 5, gain: 0.19, noise: `bandpass`, q: 0.5, atk: 0.5 },
    { hz: 75, to: 48, ms: 48, gain: 0.071, at: 2, atk: 2, glide: 12 },
    { hz: 55, ms: 48, gain: 0.026, at: 3, atk: 3 },
    { hz: 2800, ms: 5, gain: 0.19, noise: `bandpass`, q: 0.5, at: 106, atk: 0.5 },
    { hz: 75, to: 48, ms: 48, gain: 0.077, at: 108, atk: 2, glide: 12 },
    { hz: 55, ms: 48, gain: 0.03, at: 110, atk: 3 },
  ],
  nib: [
    { hz: 1900, ms: 12, gain: 0.058, noise: `bandpass`, q: 2.5, atk: 1 },
    { hz: 2250, to: 2e3, ms: 12, gain: 0.046, atk: 1 },
    { hz: 300, ms: 10, gain: 0.023, atk: 1 },
  ],
  tink: [
    { hz: 655, to: 520, ms: 38, gain: 0.054, atk: 1 },
    { hz: 3450, to: 3250, ms: 32, gain: 0.036, atk: 1 },
    { hz: 3e3, ms: 20, gain: 0.036, noise: `bandpass`, q: 1.2, atk: 1 },
    { hz: 2170, to: 1950, ms: 14, gain: 0.011, atk: 1 },
  ],
  twinkle: [
    { hz: 6700, ms: 30, gain: 0.015, noise: `bandpass`, q: 3, atk: 6, lin: !0 },
    { hz: 8100, ms: 14, gain: 0.009, at: 10, atk: 2 },
    { hz: 6740, ms: 18, gain: 0.012, at: 14, atk: 2 },
    { hz: 7150, ms: 16, gain: 0.012, at: 24, atk: 2 },
    { hz: 8950, ms: 14, gain: 0.011, at: 29, atk: 2 },
    { hz: 2420, ms: 34, gain: 0.045, at: 38, atk: 1 },
    { hz: 5250, ms: 28, gain: 0.024, at: 38, atk: 1 },
    { hz: 7300, ms: 22, gain: 0.015, at: 38, atk: 1 },
  ],
  rasp: [
    { hz: 66, to: 60, ms: 115, gain: 0.042, wave: `square`, cut: 4e3, atk: 2 },
    { hz: 64, ms: 42, gain: 0.028, wave: `square`, cut: 5e3, at: 98, atk: 3 },
  ],
  ping: [{ hz: 732, to: 760, ms: 115, gain: 0.05, atk: 2 }],
  chirp: [{ hz: 790, to: 3200, ms: 175, gain: 0.044, atk: 2, glide: 150 }],
  ascend: [
    { hz: 2200, to: 2600, ms: 80, gain: 0.056, atk: 2 },
    { hz: 2700, to: 3330, ms: 130, gain: 0.034, at: 72, atk: 10 },
  ],
  grow: [
    { hz: 262, to: 300, ms: 70, gain: 0.016, atk: 18, lin: !0 },
    { hz: 300, to: 456, ms: 165, gain: 0.037, at: 55, atk: 90, lin: !0 },
  ],
  shrink: [
    { hz: 436, to: 300, ms: 150, gain: 0.038, atk: 62, lin: !0 },
    { hz: 280, to: 256, ms: 80, gain: 0.016, at: 145, atk: 40, lin: !0 },
  ],
  wonder: [
    { hz: 494, ms: 140, gain: 0.042, atk: 45, lin: !0 },
    { hz: 494, ms: 140, gain: 0.033, at: 60.73, atk: 40, lin: !0 },
    { hz: 494, ms: 110, gain: 0.024, at: 111.34, atk: 35, lin: !0 },
    { hz: 329, ms: 120, gain: 0.013, at: 180, atk: 14 },
    { hz: 247, ms: 60, gain: 0.0061, at: 278, atk: 8 },
  ],
  glitter: [
    { hz: 10550, ms: 40, gain: 0.015, at: 4, atk: 3 },
    { hz: 9290, ms: 40, gain: 0.02, at: 22, atk: 2 },
    { hz: 7050, ms: 60, gain: 0.015, at: 26, atk: 2 },
    { hz: 7080, ms: 60, gain: 0.025, at: 100, atk: 2 },
    { hz: 7950, ms: 50, gain: 0.02, at: 104, atk: 2 },
    { hz: 9380, ms: 70, gain: 0.025, at: 132, atk: 2 },
    { hz: 6740, ms: 90, gain: 0.017, at: 134, atk: 2 },
    { hz: 9320, ms: 50, gain: 0.02, at: 162, atk: 2 },
    { hz: 10050, ms: 60, gain: 0.02, at: 180, atk: 2 },
    { hz: 10400, ms: 60, gain: 0.015, at: 236, atk: 2 },
    { hz: 6360, ms: 110, gain: 0.015, at: 256, atk: 2 },
    { hz: 10040, ms: 60, gain: 0.015, at: 300, atk: 2 },
    { hz: 7610, ms: 70, gain: 0.022, at: 340, atk: 2 },
    { hz: 10420, ms: 50, gain: 0.015, at: 342, atk: 2 },
    { hz: 7040, ms: 80, gain: 0.02, at: 382, atk: 2 },
    { hz: 7600, ms: 120, gain: 0.015, at: 384, atk: 2 },
  ],
  thunk: [
    { hz: 3e3, ms: 5, gain: 0.16, noise: `bandpass`, q: 0.5, atk: 0.5 },
    { hz: 62, to: 45, ms: 48, gain: 0.054, at: 2, atk: 2, glide: 12 },
    { hz: 505, ms: 12, gain: 0.008, at: 1, atk: 1 },
    { hz: 3e3, ms: 5, gain: 0.16, noise: `bandpass`, q: 0.5, at: 105, atk: 0.5 },
    { hz: 62, to: 45, ms: 48, gain: 0.049, at: 107, atk: 2, glide: 12 },
    { hz: 330, ms: 12, gain: 0.008, at: 106, atk: 1 },
  ],
  rap: [
    { hz: 2200, ms: 5, gain: 0.082, noise: `bandpass`, q: 0.6, atk: 0.5 },
    { hz: 195, to: 190, ms: 48, gain: 0.062, at: 1, atk: 2 },
    { hz: 1200, to: 1450, ms: 20, gain: 0.014, atk: 1, glide: 9 },
    { hz: 2200, ms: 5, gain: 0.089, noise: `bandpass`, q: 0.6, at: 105, atk: 0.5 },
    { hz: 176, to: 172, ms: 48, gain: 0.069, at: 106, atk: 2 },
    { hz: 1220, ms: 18, gain: 0.014, at: 105, atk: 1 },
  ],
} satisfies Record<string, Note[]>;

export type SoundName = keyof typeof SOUND_DEFS;

/** Widened view so every entry exposes the full Note shape. */
const SOUNDS: Record<SoundName, Note[]> = SOUND_DEFS;

// ---------------------------------------------------------------------------
// Audio context, unlock and settings
// ---------------------------------------------------------------------------

const SOUND_KEY = "cabra-sound";
const VOLUME_KEY = "cabra-volume";

let audioContext: AudioContext | null = null;
let unlocked = false;
let silentBufferPlayed = false;

/** Create the context on first use and play a one-sample buffer to warm it up. */
function ensureAudio(): void {
  try {
    audioContext ??= new AudioContext();
  } catch {
    return;
  }
  const ctx = audioContext;
  if (ctx.state !== "running") void ctx.resume();
  if (!silentBufferPlayed) {
    silentBufferPlayed = true;
    try {
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      /* noop */
    }
  }
}

if (typeof window !== "undefined") {
  const gestures = ["pointerdown", "keydown", "touchend", "click"];
  const onGesture = (event: Event): void => {
    if (
      (event as PointerEvent).isTrusted &&
      ((unlocked = true), ensureAudio(), audioContext?.state === "running")
    ) {
      for (const gesture of gestures) window.removeEventListener(gesture, onGesture, true);
    }
  };
  for (const gesture of gestures) window.addEventListener(gesture, onGesture, true);
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

let enabled = readEnabled();

let volume = ((): number => {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const parsed = Number(stored);
    return stored !== null && Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
  } catch {
    return 1;
  }
})();

let masterGain: GainNode | null = null;

/** Route through the master gain when using the live context. */
function outputFor(ctx: BaseAudioContext): AudioNode {
  if (ctx === audioContext) {
    masterGain ??= (() => {
      const gain = ctx.createGain();
      gain.gain.value = volume;
      gain.connect(ctx.destination);
      return gain;
    })();
    return masterGain;
  }
  return ctx.destination;
}

const subscribers = new Set<() => void>();

export const controls: SoundControls = {
  volume: () => volume,
  setVolume(value) {
    volume = Math.min(1, Math.max(0, value));
    if (masterGain && audioContext) {
      masterGain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.02);
    }
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      /* noop */
    }
    subscribers.forEach((listener) => listener());
  },
  subscribe(listener) {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  },
  enabled: () => enabled,
  forceOn() {
    enabled = true;
    subscribers.forEach((listener) => listener());
  },
  toggle() {
    enabled = !enabled;
    try {
      localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
    } catch {
      /* noop */
    }
    if (enabled) play("click");
    subscribers.forEach((listener) => listener());
  },
};

// ---------------------------------------------------------------------------
// Synth
// ---------------------------------------------------------------------------

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

const PREFERRED: SoundName[] = ["glint", "clack", "pressCount", "crinkle", "toss", "till"];

export const ALL_NAMES: SoundName[] = [
  ...PREFERRED,
  ...(Object.keys(SOUNDS) as SoundName[]).filter((name) => !PREFERRED.includes(name)),
];

export const EXCLUDED = new Set<SoundName>([]);
export const AVAILABLE_NAMES = ALL_NAMES.filter((name) => !EXCLUDED.has(name));

let activeCount = 0;

/** Increment the active counter; the returned callback releases it once. */
export function beginActivity(): () => void {
  activeCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    queueMicrotask(() => {
      activeCount--;
    });
  };
}

const lastPlayed: Record<string, number> = {};
let previewName: SoundName | null = null;
let previewOnly: SoundName[] | null = null;

/** Force all subsequent plays to use one sound (optionally limiting names). */
export function setPreview(name: SoundName | null, only?: SoundName[]): void {
  previewName = name;
  previewOnly = name && only ? only : null;
}

let audioSessionConfigured = false;

function configureAudioSession(): void {
  if (audioSessionConfigured) return;
  audioSessionConfigured = true;
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch {
    /* noop */
  }
}

function getTape(): TapeEvent[] | undefined {
  return (globalThis as { __tape?: TapeEvent[] }).__tape;
}

/** Play a named sound. */
export function play(name: SoundName, options?: PlayOptions): void {
  if (previewName && !options?.asIs) {
    if (previewOnly && !previewOnly.includes(name)) return;
    name = previewName;
    options = { ...options, force: true, gain: 3 };
  }

  const tape = getTape();
  if (tape) {
    if (options?.gap) {
      const now = performance.now();
      if (now - (lastPlayed[name] ?? -Infinity) < options.gap) return;
      lastPlayed[name] = now;
    }
    const bend = options?.at === undefined ? 1 : 0.75 + Math.min(1, Math.max(0, options.at)) * 0.75;
    tape.push({
      name,
      notes: SOUNDS[name],
      bend,
      t: performance.now(),
      gain: options?.gain ?? 1,
    });
    return;
  }

  if ((!enabled && !options?.force) || activeCount) return;
  if (options?.gap) {
    const now = performance.now();
    if (now - (lastPlayed[name] ?? -Infinity) < options.gap) return;
    lastPlayed[name] = now;
  }
  if (!unlocked || (configureAudioSession(), ensureAudio(), !audioContext)) return;
  const ctx = audioContext;
  if (ctx.state !== "running") return;
  const bend = options?.at === undefined ? 1 : 0.75 + Math.min(1, Math.max(0, options.at)) * 0.75;
  renderNotes(ctx, SOUNDS[name], bend, ctx.currentTime, options?.gain ?? 1);
}

/** Play a raw note array (bypasses named-sound lookup). */
function playNotes(notes: Note[], gain = 1): void {
  const tape = getTape();
  if (tape) {
    tape.push({ notes, bend: 1, t: performance.now(), gain });
    return;
  }
  if (!enabled || activeCount || !unlocked) return;
  configureAudioSession();
  ensureAudio();
  if (audioContext && audioContext.state === "running") {
    renderNotes(audioContext, notes, 1, audioContext.currentTime, gain);
  }
}

/** A short rising/falling sweep made of many tiny voices. */
export function sweep(duration: number, ascending: boolean): void {
  const steps = Math.max(6, Math.round(duration / 360));
  const notes: Note[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    const s = ascending ? t : 1 - t;
    notes.push({
      hz: 120 + s * 70,
      to: 90 + s * 50,
      ms: 46,
      gain: 0.03 + Math.sin(Math.PI * t) * 0.03,
      wave: "sine",
      cut: 600,
      atk: 2,
      glide: 22,
      at: eased * (duration - 60),
    });
  }
  playNotes(notes);
}

/** A very quiet click used as a UI tick. */
export function subtleTick(): void {
  playNotes([
    { hz: 2600, ms: 16, gain: 0.006, q: 3, noise: "bandpass", atk: 1 },
    { hz: 880, to: 760, ms: 28, gain: 0.006, wave: "sine", atk: 2 },
  ]);
}

/** Render notes into any (online or offline) audio context. */
function renderNotes(
  ctx: BaseAudioContext,
  notes: Note[],
  bend: number,
  startTime: number,
  gain = 1,
): void {
  for (const note of notes) {
    const noteStart = startTime + (note.at ?? 0) / 1e3;
    const noteEnd = noteStart + note.ms / 1e3;
    const glideEnd = note.glide ? noteStart + note.glide / 1e3 : noteEnd;
    let source: AudioScheduledSourceNode;
    let node: AudioNode;

    if (note.noise) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(ctx);
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = note.noise;
      filter.frequency.setValueAtTime(note.hz * bend, noteStart);
      if (note.to) filter.frequency.exponentialRampToValueAtTime(note.to * bend, glideEnd);
      if (note.q !== undefined) filter.Q.value = note.q;
      noise.connect(filter);
      source = noise;
      node = filter;
    } else {
      const osc = ctx.createOscillator();
      osc.type = note.wave ?? "sine";
      osc.frequency.setValueAtTime(note.hz * bend, noteStart);
      if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to * bend, glideEnd);
      source = osc;
      node = osc;
    }

    const envelope = ctx.createGain();
    const attack = Math.min((note.atk ?? 4) / 1e3, (note.ms / 1e3) * 0.6);
    envelope.gain.setValueAtTime(1e-4, noteStart);
    if (note.lin) {
      envelope.gain.linearRampToValueAtTime((note.gain ?? 0.05) * gain, noteStart + attack);
    } else {
      envelope.gain.exponentialRampToValueAtTime((note.gain ?? 0.05) * gain, noteStart + attack);
    }
    envelope.gain.exponentialRampToValueAtTime(1e-4, noteEnd);

    let output = node;
    if (note.cut) {
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = note.cut;
      node.connect(lowpass);
      output = lowpass;
    }
    output.connect(envelope).connect(outputFor(ctx));

    if (note.noise) (source as AudioBufferSourceNode).start(noteStart, Math.random() * 1.5);
    else (source as OscillatorNode).start(noteStart);
    source.stop(noteEnd + 0.02);
  }
}

/** Render one named sound into a context at a given time. */
export function renderSound(
  ctx: BaseAudioContext,
  name: SoundName,
  startTime: number,
  gain = 1,
): void {
  renderNotes(ctx, SOUNDS[name], 1, startTime, gain);
}

// ---------------------------------------------------------------------------
// Offline analysis and WAV export
// ---------------------------------------------------------------------------

const PEAK_RATE = 22050;

export const SOUND_META = Object.fromEntries(
  Object.entries(SOUNDS).map(([name, notes]) => {
    const first = notes[0]!;
    return [
      name,
      {
        hz: first.hz,
        pitch: notes.find((note) => !note.noise)?.hz ?? first.hz / 8,
        ms: Math.max(...notes.map((note) => (note.at ?? 0) + note.ms)),
        gain: Math.max(...notes.map((note) => note.gain ?? 0)),
        bend: ((first.to ?? first.hz) - first.hz) / first.hz,
        parts: notes.length,
        wave: first.wave ?? "sine",
        cut: first.cut ?? null,
        atk: first.atk ?? 4,
      },
    ];
  }),
) as Record<SoundName, SoundMeta>;

function getOfflineContext(): OfflineContextCtor | null {
  return typeof globalThis.OfflineAudioContext === "function"
    ? globalThis.OfflineAudioContext
    : null;
}

function durationMs(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, (note.at ?? 0) + note.ms), 0);
}

let maxAmplitudeCache: Promise<number> | null = null;

async function computeMaxAmplitude(): Promise<number> {
  const OfflineCtx = getOfflineContext();
  if (!OfflineCtx) return 0;
  let max = 0;
  for (const name of AVAILABLE_NAMES) {
    const ctx = new OfflineCtx(
      1,
      Math.ceil((durationMs(SOUNDS[name]) / 1e3 + 0.02) * PEAK_RATE),
      PEAK_RATE,
    );
    renderNotes(ctx, SOUNDS[name], 1, 0);
    const data = (await ctx.startRendering()).getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const amplitude = Math.abs(data[i]!);
      if (amplitude > max) max = amplitude;
    }
  }
  return max;
}

const waveformCache = new Map<string, Waveform | null>();

/** Compute a normalised waveform preview for a set of sounds. */
export async function getWaveform(names: SoundName[], buckets = 40): Promise<Waveform | null> {
  const OfflineCtx = getOfflineContext();
  if (!OfflineCtx || names.length === 0) return null;
  const key = `${[...names].sort().join("+")}:${buckets}`;
  const cached = waveformCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const reference = await (maxAmplitudeCache ??= computeMaxAmplitude());
    if (!(reference > 0)) return null;
    const notes = names.flatMap((name) => SOUNDS[name]);
    const ms = durationMs(notes);
    const ctx = new OfflineCtx(1, Math.ceil((ms / 1e3 + 0.02) * PEAK_RATE), PEAK_RATE);
    renderNotes(ctx, notes, 1, 0);
    const data = (await ctx.startRendering()).getChannelData(0);
    const bucketSize = data.length / buckets;
    const peaks: number[] = [];
    for (let i = 0; i < buckets; i++) {
      let peak = 0;
      const from = Math.floor(i * bucketSize);
      const to = Math.min(data.length, Math.floor((i + 1) * bucketSize));
      for (let j = from; j < to; j++) {
        const amplitude = Math.abs(data[j]!);
        if (amplitude > peak) peak = amplitude;
      }
      peaks.push(Math.min(1, Math.sqrt(peak / reference)));
    }
    const result = { peaks, ms };
    waveformCache.set(key, result);
    return result;
  } catch {
    waveformCache.set(key, null);
    return null;
  }
}

const WAV_RATE = 44100;
const WAV_TAIL = 0.05;

/** Render a set of sounds to a 16-bit PCM WAV blob. */
export async function renderWav(names: SoundName[]): Promise<Blob | null> {
  const OfflineCtx = getOfflineContext();
  if (!OfflineCtx || names.length === 0) return null;
  try {
    const notes = names.flatMap((name) => SOUNDS[name]);
    const ctx = new OfflineCtx(
      1,
      Math.ceil((durationMs(notes) / 1e3 + WAV_TAIL) * WAV_RATE),
      WAV_RATE,
    );
    renderNotes(ctx, notes, 1, 0);
    return encodeWav((await ctx.startRendering()).getChannelData(0), WAV_RATE);
  } catch {
    return null;
  }
}

export const wavFilename = (names: SoundName[]): string => `bencho-${names.join("-")}.wav`;

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

// ---------------------------------------------------------------------------
// Original minified export aliases (kept for drop-in compatibility)
// ---------------------------------------------------------------------------

export {
  renderWav as a,
  play as c,
  controls as d,
  setPreview as f,
  SOUND_META as i,
  sweep as l,
  getWaveform as m,
  EXCLUDED as n,
  wavFilename as o,
  renderSound as p,
  AVAILABLE_NAMES as r,
  beginActivity as s,
  ALL_NAMES as t,
  subtleTick as u,
};
