<script lang="ts">
  import ArrowUpRight from 'phosphor-svelte/lib/ArrowUpRight';
  import type { ToolPackage } from '#lib/catalog.js';
  import PackageIcon from './PackageIcon.svelte';

  let { tool }: { tool: ToolPackage } = $props();
</script>

<a class="package-card" class:featured={tool.featured} href={tool.route}>
  <div class="card-topline">
    <span class="package-icon"><PackageIcon name={tool.icon} size={27} /></span>
    <span class="card-arrow"><ArrowUpRight size={18} weight="bold" /></span>
  </div>

  <div class="card-copy">
    <span class="category">{tool.category}</span>
    <h3>{tool.name}</h3>
    <p>{tool.description}</p>
  </div>

  <div class="card-footer">
    <span class="mount-state">{tool.mounted ? 'Mounted' : 'Route ready'}</span>
    <span class="stack">{tool.stack}</span>
  </div>
</a>

<style>
  .package-card {
    position: relative;
    display: flex;
    height: 300px;
    min-height: 300px;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text);
    padding: 20px;
    text-decoration: none;
    transition:
      transform 180ms var(--ease),
      border-color 180ms var(--ease),
      background-color 180ms var(--ease);
  }

  .package-card::after {
    position: absolute;
    right: -54px;
    bottom: -74px;
    width: 180px;
    height: 180px;
    border: 1px solid var(--line);
    border-radius: 50%;
    content: '';
    pointer-events: none;
    transition: transform 240ms var(--ease);
  }

  .package-card:hover {
    transform: translateY(-3px);
    border-color: var(--line-strong);
    background: var(--surface-hover);
  }

  .package-card:hover::after {
    transform: scale(1.12);
  }

  .package-card:active {
    transform: translateY(-1px);
  }

  .package-card:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 3px;
  }

  .featured {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--on-ink);
  }

  .featured:hover {
    border-color: var(--ink);
    background: var(--ink-hover);
  }

  .featured::after {
    right: -54px;
    bottom: -74px;
    width: 180px;
    height: 180px;
    border-color: color-mix(in srgb, var(--on-ink) 20%, transparent);
  }

  .card-topline,
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .package-icon {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: var(--surface-muted);
    color: var(--accent);
  }

  .featured .package-icon {
    border-color: color-mix(in srgb, var(--on-ink) 16%, transparent);
    background: color-mix(in srgb, var(--on-ink) 8%, transparent);
    color: var(--accent-bright);
  }

  .card-arrow {
    display: grid;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: 50%;
    color: var(--text-muted);
    transition:
      color 180ms var(--ease),
      transform 180ms var(--ease);
  }

  .package-card:hover .card-arrow {
    transform: translate(2px, -2px);
    color: var(--text);
  }

  .featured .card-arrow,
  .featured:hover .card-arrow {
    color: var(--on-ink);
  }

  .card-copy {
    position: relative;
    z-index: 1;
    padding: 20px 0 18px;
  }

  .category {
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .featured .category {
    color: var(--accent-bright);
  }

  h3 {
    margin: 9px 0 8px;
    font-size: 22px;
    font-weight: 620;
    letter-spacing: -0.035em;
    line-height: 1.15;
  }

  p {
    max-width: 46ch;
    margin: 0;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.55;
  }

  .featured p {
    max-width: 46ch;
    color: color-mix(in srgb, var(--on-ink) 70%, transparent);
  }

  .card-footer {
    position: relative;
    z-index: 1;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    font-size: 11px;
  }

  .featured .card-footer {
    border-color: color-mix(in srgb, var(--on-ink) 14%, transparent);
  }

  .mount-state {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--text-muted);
  }

  .mount-state::before {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    content: '';
  }

  .featured .mount-state {
    color: color-mix(in srgb, var(--on-ink) 70%, transparent);
  }

  .featured .mount-state::before {
    background: var(--accent-bright);
  }

  .stack {
    overflow: hidden;
    color: var(--text-subtle);
    font-family: var(--font-mono);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .featured .stack {
    color: color-mix(in srgb, var(--on-ink) 48%, transparent);
  }

  @media (max-width: 640px) {
    .package-card,
    .featured {
      height: auto;
      min-height: 230px;
      padding: 18px;
    }

  }

  @media (prefers-reduced-motion: reduce) {
    .package-card,
    .package-card::after,
    .card-arrow {
      transition: none;
    }

    .package-card:hover,
    .package-card:active,
    .package-card:hover::after,
    .package-card:hover .card-arrow {
      transform: none;
    }
  }
</style>
