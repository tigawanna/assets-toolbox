# @tigawanna/cabra-sound

A tiny Web Audio sound engine: 182 procedurally synthesized UI sounds, gesture-based unlock, persistent volume/mute settings, offline waveform analysis and 16-bit WAV export. No audio assets — the whole library is about 11 KB gzipped.

## Install

```sh
pnpm add @tigawanna/cabra-sound
```

## Usage

```ts
import { play, controls, ALL_NAMES, renderWav, wavFilename } from "@tigawanna/cabra-sound";

play("click"); // first user gesture unlocks the AudioContext
play("paid", { at: 0.5, gain: 0.8, gap: 100 }); // pitch bend, gain, throttle

controls.setVolume(0.4);
controls.toggle(); // mute/unmute (persisted in localStorage)

const blob = await renderWav(["glint", "clack"]); // 44.1 kHz, 16-bit mono WAV
const name = wavFilename(["glint", "clack"]); // bencho-glint-clack.wav
```

The original single-letter export names are kept as aliases (`a`, `c`, `d`, `f`, `i`, `l`, `m`, `n`, `o`, `p`, `r`, `s`, `t`, `u`) for drop-in compatibility.

## API

| Export                                     | Description                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `play(name, options?)`                     | Play a named sound. Options: `asIs`, `gap`, `at`, `force`, `gain`.              |
| `controls`                                 | `volume()`, `setVolume()`, `subscribe()`, `enabled()`, `forceOn()`, `toggle()`. |
| `ALL_NAMES`, `AVAILABLE_NAMES`, `EXCLUDED` | Sound name catalog and exclusion set.                                           |
| `SOUND_META`                               | Per-sound frequency, duration, gain, bend, parts, waveform, cutoff, attack.     |
| `setPreview(name, only?)`                  | Override every subsequent play with one sound.                                  |
| `beginActivity()`                          | Suppress playback until the returned callback runs (one microtask).             |
| `sweep(ms, ascending)`, `subtleTick()`     | Helper sounds.                                                                  |
| `renderSound(ctx, name, at, gain?)`        | Render a sound into any audio context.                                          |
| `getWaveform(names, buckets?)`             | Normalised peak buckets for visual previews.                                    |
| `renderWav(names)`                         | Render sounds to a WAV `Blob`.                                                  |
| `wavFilename(names)`                       | Build the `bencho-*.wav` filename.                                              |

Types `Note`, `Wave`, `PlayOptions`, `SoundName`, `SoundMeta`, `Waveform` and `SoundControls` are exported too.

## Demo

[`demo/sound-board.html`](./demo/sound-board.html) is a self-contained page with a button for every sound, a family dropdown beside the search field, volume/mute controls and WAV download buttons. Open it directly in a browser.

Its embedded module is a compiled snapshot of `src/sound.ts`, delimited by `// DEMO:MODULE:START` / `// DEMO:MODULE:END`. After changing the library, rebuild and refresh it with:

```sh
pnpm build
pnpm build:demo
```

## Studio

Launch that page as a local server and open it in your browser:

```sh
npx -y @tigawanna/cabra-sound studio
```

`PORT` picks the starting port (default `5178`); if it is busy, the next free port is used. `NO_OPEN=1` prints the URL without launching a browser. Inside the repo, `pnpm studio` does the same after `pnpm build`.

## Attribution

Sound designs and the synthesis approach are based on [Bencho by cabralorenzo](https://github.com/cabralorenzo/bencho/tree/main/sounds), whose `sounds.ts` synthesises its interface sounds in the browser with the Web Audio API. The `bencho-*.wav` download filenames are kept in reference to that project.

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
```
