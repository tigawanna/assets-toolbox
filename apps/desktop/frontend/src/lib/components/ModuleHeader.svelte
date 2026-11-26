<script lang="ts">
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import type { ToolPackage } from '#lib/catalog.js';
  import PackageIcon from './PackageIcon.svelte';

  let { tool }: { tool: ToolPackage } = $props();
</script>

<header class="module-header">
  <a class="back-button" href="/" aria-label="Back to library" title="Back to library">
    <ArrowLeft size={17} aria-hidden="true" />
  </a>

  <span class="module-icon"><PackageIcon name={tool.icon} size={22} /></span>

  <div class="module-title">
    <h1>{tool.name}</h1>
    <p>{tool.description}</p>
  </div>

  <span class="mounted-badge">Mounted</span>
</header>

<style>
  .module-header {
    display: flex;
    min-height: 58px;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .back-button {
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 8px;
    color: var(--text-muted);
    text-decoration: none;
    transition:
      border-color 150ms var(--ease),
      background-color 150ms var(--ease),
      color 150ms var(--ease);
  }

  .back-button:hover {
    border-color: var(--line-strong);
    background: var(--surface-muted);
    color: var(--text);
  }

  .back-button:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .module-icon {
    display: grid;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface-muted);
    color: var(--accent);
  }

  .module-title {
    min-width: 0;
    flex: 1;
  }

  .module-title h1 {
    margin: 0;
    font-size: 17px;
    font-weight: 620;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }

  .module-title p {
    overflow: hidden;
    margin: 3px 0 0;
    color: var(--text-muted);
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mounted-badge {
    flex: 0 0 auto;
    padding: 4px 7px;
    border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--line));
    border-radius: 5px;
    background: color-mix(in srgb, var(--accent) 7%, var(--surface));
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  @media (max-width: 640px) {
    .module-title p {
      display: none;
    }
  }
</style>
