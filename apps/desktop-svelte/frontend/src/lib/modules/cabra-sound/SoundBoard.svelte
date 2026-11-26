<script lang="ts">
  import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
  import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
  import Play from 'phosphor-svelte/lib/Play';
  import Shuffle from 'phosphor-svelte/lib/Shuffle';
  import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
  import SpeakerSlash from 'phosphor-svelte/lib/SpeakerSlash';
  import { onDestroy, onMount } from 'svelte';
  import {
    AVAILABLE_NAMES,
    SOUND_META,
    controls,
    disposeAudio,
    initializeAudio,
    play,
    renderWav,
    subtleTick,
    sweep,
    wavFilename,
    type SoundName
  } from './sound';
  import { downloadBlob, zipStore } from '../../zip';

  type Family = 'all' | 'mech' | 'bubble' | 'press' | 'card' | 'other';

  const families: { id: Family; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'mech', label: 'Mechanical' },
    { id: 'bubble', label: 'Bubble' },
    { id: 'press', label: 'Press' },
    { id: 'card', label: 'Cards' },
    { id: 'other', label: 'Other' }
  ];

  let query = $state('');
  let family = $state<Family>('all');
  let enabled = $state(true);
  let volume = $state(1);
  let selected = $state<SoundName | null>(null);
  let status = $state('Choose a sound to audition it.');
  let exporting = $state(false);
  let exportGeneration = 0;
  let exportCancelled = false;
  let searchInput = $state<HTMLInputElement | null>(null);
  let unsubscribe: (() => void) | undefined;

  const normalizedQuery = $derived(query.trim().replace(/\s+/g, ' ').toLowerCase());
  const showHelpers = $derived(family === 'all' && normalizedQuery.length === 0);
  const visibleNames = $derived(
    AVAILABLE_NAMES.filter((name) => {
      const matchesFamily = family === 'all' || familyOf(name) === family;
      const matchesQuery =
        name.toLowerCase().includes(normalizedQuery) ||
        formatName(name).toLowerCase().includes(normalizedQuery);
      return matchesFamily && matchesQuery;
    })
  );

  onMount(() => {
    initializeAudio();
    const sync = () => {
      enabled = controls.enabled();
      volume = controls.volume();
    };
    sync();
    unsubscribe = controls.subscribe(sync);
  });

  onDestroy(() => {
    unsubscribe?.();
    exportGeneration += 1;
    disposeAudio();
  });

  function familyOf(name: SoundName): Exclude<Family, 'all'> {
    for (const prefix of ['mech', 'bubble', 'press', 'card'] as const) {
      if (name.startsWith(prefix)) return prefix;
    }
    return 'other';
  }

  function formatName(name: SoundName): string {
    const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  function playSound(name: SoundName) {
    selected = name;
    if (!enabled) {
      status = 'Sound is muted. Turn it on to audition.';
      return;
    }
    if (!play(name)) {
      status = `Could not play ${formatName(name)}. Audio is unavailable or suppressed.`;
      return;
    }
    status = `Playing ${formatName(name)}`;
  }

  function playRandom() {
    const name = AVAILABLE_NAMES[Math.floor(Math.random() * AVAILABLE_NAMES.length)];
    if (name) playSound(name);
  }

  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const typing = target?.matches('input, textarea, select, [contenteditable="true"]');
    if (event.key === '/' && !typing) {
      event.preventDefault();
      searchInput?.focus();
    }
    if (event.key === 'Escape' && document.activeElement === searchInput) {
      query = '';
      searchInput?.blur();
    }
  }

  function beginExport(): number {
    exportGeneration += 1;
    exportCancelled = false;
    exporting = true;
    return exportGeneration;
  }

  function cancelExport() {
    if (!exporting) return;
    exportCancelled = true;
    status = 'Cancelling…';
  }

  function isExportActive(generation: number): boolean {
    return generation === exportGeneration && !exportCancelled;
  }

  function playHelper(label: string, work: () => boolean) {
    if (!enabled) {
      status = 'Sound is muted. Turn it on to audition.';
      return;
    }
    if (!work()) {
      status = `Could not play ${label}. Audio is unavailable or suppressed.`;
      return;
    }
    status = `Playing ${label}`;
  }

  async function exportMix() {
    const names = Object.freeze([...visibleNames]);
    if (names.length === 0 || exporting) return;
    const generation = beginExport();
    status = `Rendering ${names.length} ${names.length === 1 ? 'sound' : 'sounds'}…`;
    try {
      const blob = await renderWav(names);
      if (!isExportActive(generation)) return;
      if (!blob) throw new Error('WAV rendering is unavailable.');
      const filename =
        names.length === 1 ? wavFilename(names) : `bencho-${names.length}-sounds.wav`;
      downloadBlob(blob, filename);
      status = `Downloaded ${filename}`;
    } catch (error) {
      if (isExportActive(generation)) {
        status = error instanceof Error ? error.message : 'Could not render the WAV.';
      }
    } finally {
      if (generation === exportGeneration) {
        if (exportCancelled) status = 'Export cancelled';
        exporting = false;
      }
    }
  }

  async function exportSound(name: SoundName) {
    if (exporting) return;
    const generation = beginExport();
    status = `Rendering ${formatName(name)}…`;
    try {
      const blob = await renderWav([name]);
      if (!isExportActive(generation)) return;
      if (!blob) throw new Error('WAV rendering is unavailable.');
      const filename = wavFilename([name]);
      downloadBlob(blob, filename);
      status = `Downloaded ${filename}`;
    } catch (error) {
      if (isExportActive(generation)) {
        status = error instanceof Error ? error.message : 'Could not render the WAV.';
      }
    } finally {
      if (generation === exportGeneration) {
        if (exportCancelled) status = 'Export cancelled';
        exporting = false;
      }
    }
  }

  async function exportEach() {
    const names = Object.freeze([...visibleNames]);
    if (names.length === 0 || exporting) return;
    if (names.length > 12 && !window.confirm(`Download ${names.length} WAV files in a ZIP?`)) {
      return;
    }
    const generation = beginExport();
    try {
      const entries: { name: string; data: Uint8Array }[] = [];
      for (const [index, name] of names.entries()) {
        if (!isExportActive(generation)) break;
        status = `Rendering ${index + 1} of ${names.length}: ${formatName(name)}`;
        const blob = await renderWav([name]);
        if (!isExportActive(generation)) break;
        if (!blob) throw new Error('WAV rendering is unavailable.');
        entries.push({ name: wavFilename([name]), data: new Uint8Array(await blob.arrayBuffer()) });
      }
      if (!isExportActive(generation)) return;
      const filename = `bencho-${names.length}-sounds.zip`;
      downloadBlob(new Blob([zipStore(entries) as BlobPart], { type: 'application/zip' }), filename);
      status = `Downloaded ${filename}`;
    } catch (error) {
      if (isExportActive(generation)) {
        status = error instanceof Error ? error.message : 'Could not render all WAV files.';
      }
    } finally {
      if (generation === exportGeneration) {
        if (exportCancelled) status = 'Export cancelled';
        exporting = false;
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="sound-board">
  <div class="sound-toolbar">
    <label class="sound-search">
      <span class="sr-only">Search sounds</span>
      <MagnifyingGlass size={16} aria-hidden="true" />
      <input
        bind:this={searchInput}
        bind:value={query}
        type="search"
        placeholder="Search 182 sounds"
        autocomplete="off"
      />
      <kbd>/</kbd>
    </label>

    <div class="audio-controls">
      <button
        class="audio-toggle"
        class:active={enabled}
        aria-label={enabled ? 'Mute sounds' : 'Enable sounds'}
        aria-pressed={enabled}
        onclick={() => controls.toggle()}
      >
        {#if enabled}
          <SpeakerHigh size={17} aria-hidden="true" />
          <span>Sound on</span>
        {:else}
          <SpeakerSlash size={17} aria-hidden="true" />
          <span>Muted</span>
        {/if}
      </button>

      <label class="volume-control">
        <span class="sr-only">Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          oninput={(event) => controls.setVolume(Number(event.currentTarget.value))}
        />
        <span>{Math.round(volume * 100)}%</span>
      </label>
    </div>
  </div>

  <div class="sound-filter-row">
    <div class="family-filters" aria-label="Filter sounds by family">
      {#each families as item}
        <button
          class:active={family === item.id}
          aria-pressed={family === item.id}
          onclick={() => {
            family = item.id;
            query = '';
          }}
        >
          {item.label}
        </button>
      {/each}
    </div>

    <div class="export-actions">
      <button class="export-button" disabled={visibleNames.length === 0 || exporting} onclick={exportMix}>
        <DownloadSimple size={14} aria-hidden="true" />
        Export mix
      </button>
      <button class="export-button" disabled={visibleNames.length === 0 || exporting} onclick={exportEach}>
        Each as WAV
      </button>
    </div>
  </div>

  {#if showHelpers}
    <div class="helper-grid" aria-label="Sound helpers">
      <button onclick={playRandom}><Shuffle size={16} aria-hidden="true" /> Random</button>
      <button onclick={() => playHelper('Sweep up', () => sweep(180, true))}><Play size={15} aria-hidden="true" /> Sweep up</button>
      <button onclick={() => playHelper('Sweep down', () => sweep(180, false))}><Play size={15} aria-hidden="true" /> Sweep down</button>
      <button onclick={() => playHelper('Soft tick', subtleTick)}><Play size={15} aria-hidden="true" /> Soft tick</button>
    </div>
  {/if}

  <div class="sound-status">
    <span class="status-dot" class:muted={!enabled}></span>
    <span aria-live="polite">{status}</span>
    {#if exporting}
      <button class="export-button" onclick={cancelExport}>Cancel</button>
    {/if}
    <strong>{visibleNames.length} shown</strong>
  </div>

  {#if visibleNames.length > 0}
    <div class="sound-grid">
      {#each visibleNames as name (name)}
        <article class="sound-tile" class:selected={selected === name}>
          <button class="sound-play" aria-pressed={selected === name} onclick={() => playSound(name)}>
            <span class="play-icon"><Play size={15} weight="fill" aria-hidden="true" /></span>
            <span class="sound-name">{formatName(name)}</span>
            <span class="sound-meta">{SOUND_META[name].ms} ms</span>
          </button>
          <button
            class="sound-download"
            aria-label={`Download ${formatName(name)} as WAV`}
            title={`Download ${formatName(name)} as WAV`}
            disabled={exporting}
            onclick={() => exportSound(name)}
          >
            <DownloadSimple size={15} aria-hidden="true" />
          </button>
        </article>
      {/each}
    </div>
  {:else}
    <div class="sound-empty">
      <MagnifyingGlass size={24} aria-hidden="true" />
      <h2>No matching sounds</h2>
      <p>Try a different name or show all families.</p>
      <button
        onclick={() => {
          query = '';
          family = 'all';
          searchInput?.focus();
        }}
      >
        Reset filters
      </button>
    </div>
  {/if}

  <footer class="sound-footer">
    <span>{AVAILABLE_NAMES.length} procedural sounds · no audio files</span>
    <span>
      Sound designs based on
      <a href="https://github.com/cabralorenzo/bencho/tree/main/sounds" target="_blank" rel="noreferrer">Bencho</a>
      by cabralorenzo.
    </span>
  </footer>
</div>

<style>
  .sound-board {
    color: var(--text);
    font-family: var(--font-sans);
  }

  .sound-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .sound-search {
    display: flex;
    width: min(360px, 100%);
    height: 38px;
    align-items: center;
    gap: 9px;
    padding: 0 11px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text-subtle);
  }

  .sound-search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--focus);
  }

  .sound-search input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 11px;
  }

  .sound-search input::placeholder {
    color: var(--text-subtle);
  }

  .sound-search kbd {
    padding: 2px 5px;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--surface-muted);
    font-family: var(--font-mono);
    font-size: 8px;
  }

  .audio-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .audio-toggle,
  .export-button,
  .helper-grid button,
  .sound-empty button {
    display: inline-flex;
    min-height: 34px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface);
    color: var(--text-muted);
    font: inherit;
    font-size: 10px;
    font-weight: 550;
    cursor: pointer;
    transition:
      border-color 150ms var(--ease),
      background-color 150ms var(--ease),
      color 150ms var(--ease);
  }

  .audio-toggle:hover,
  .export-button:hover:not(:disabled),
  .helper-grid button:hover,
  .sound-empty button:hover {
    border-color: var(--line-strong);
    background: var(--surface-hover);
    color: var(--text);
  }

  .audio-toggle.active {
    border-color: color-mix(in srgb, var(--accent) 24%, var(--line));
    background: color-mix(in srgb, var(--accent) 7%, var(--surface));
    color: var(--accent);
  }

  .audio-toggle:focus-visible,
  .export-button:focus-visible,
  .helper-grid button:focus-visible,
  .sound-empty button:focus-visible,
  .family-filters button:focus-visible,
  .sound-play:focus-visible,
  .sound-download:focus-visible,
  .sound-footer a:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .volume-control {
    display: flex;
    min-width: 140px;
    align-items: center;
    gap: 8px;
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 9px;
  }

  .volume-control input {
    width: 100px;
    accent-color: var(--accent);
  }

  .sound-filter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 14px;
  }

  .family-filters {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-muted);
  }

  .family-filters button {
    min-height: 28px;
    padding: 5px 9px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 9px;
    font-weight: 550;
    cursor: pointer;
  }

  .family-filters button:hover {
    color: var(--text);
  }

  .family-filters button.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgb(20 24 18 / 8%);
  }

  .export-actions {
    display: flex;
    gap: 6px;
  }

  .export-button:disabled,
  .sound-download:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .helper-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 14px;
  }

  .sound-status {
    display: flex;
    min-height: 34px;
    align-items: center;
    gap: 8px;
    margin: 12px 0 10px;
    color: var(--text-muted);
    font-size: 10px;
  }

  .sound-status strong {
    margin-left: auto;
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 500;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    flex: 0 0 6px;
    border-radius: 50%;
    background: var(--accent);
  }

  .status-dot.muted {
    background: var(--text-subtle);
  }

  .sound-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .sound-tile {
    position: relative;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--surface);
    transition:
      border-color 150ms var(--ease),
      background-color 150ms var(--ease);
  }

  .sound-tile:hover {
    border-color: var(--line-strong);
    background: var(--surface-hover);
  }

  .sound-tile.selected {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
    background: color-mix(in srgb, var(--accent) 6%, var(--surface));
  }

  .sound-play {
    display: grid;
    width: 100%;
    min-height: 64px;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    padding: 10px 38px 10px 10px;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .play-icon {
    display: grid;
    width: 30px;
    height: 30px;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface-muted);
    color: var(--accent);
  }

  .sound-tile.selected .play-icon {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--surface);
  }

  .sound-name {
    overflow: hidden;
    font-size: 11px;
    font-weight: 550;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sound-meta {
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 8px;
  }

  .sound-download {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    width: 26px;
    height: 26px;
    place-items: center;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-subtle);
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 150ms var(--ease),
      background-color 150ms var(--ease),
      color 150ms var(--ease);
  }

  .sound-tile:hover .sound-download,
  .sound-tile:focus-within .sound-download {
    opacity: 1;
  }

  .sound-download:hover {
    background: var(--surface-muted);
    color: var(--text);
  }

  .sound-empty {
    display: flex;
    min-height: 280px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    text-align: center;
  }

  .sound-empty h2 {
    margin: 14px 0 5px;
    color: var(--text);
    font-size: 16px;
  }

  .sound-empty p {
    margin: 0;
    font-size: 11px;
  }

  .sound-empty button {
    margin-top: 16px;
  }

  .sound-footer {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-top: 16px;
    padding-top: 13px;
    border-top: 1px solid var(--line);
    color: var(--text-subtle);
    font-size: 9px;
    line-height: 1.5;
  }

  .sound-footer a {
    color: var(--text-muted);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  @media (max-width: 1000px) {
    .sound-toolbar,
    .sound-filter-row {
      align-items: stretch;
      flex-direction: column;
    }

    .sound-search {
    width: 100%;
  }

    .audio-controls,
    .export-actions {
    justify-content: space-between;
  }

    .sound-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .helper-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .family-filters {
      overflow-x: auto;
    }

    .family-filters button {
      flex: 1;
      white-space: nowrap;
    }

    .sound-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .sound-footer {
      flex-direction: column;
      gap: 6px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sound-tile,
    .sound-download,
    .audio-toggle,
    .export-button,
    .helper-grid button,
    .sound-empty button {
      transition: none;
    }
  }
</style>
