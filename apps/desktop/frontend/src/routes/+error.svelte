<script lang="ts">
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status} · Assets Toolbox</title>
</svelte:head>

<div class="error-page">
  <span class="error-icon"><WarningCircle size={28} aria-hidden="true" /></span>
  <p class="error-code">{page.status}</p>
  <h1>{page.error?.message ?? 'This page could not be opened.'}</h1>
  <a href="/">
    <ArrowLeft size={15} aria-hidden="true" />
    Back to library
  </a>
</div>

<style>
  .error-page {
    display: flex;
    min-height: 60dvh;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    text-align: center;
  }

  .error-icon {
    display: grid;
    width: 56px;
    height: 56px;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    color: var(--accent);
  }

  .error-code {
    margin: 22px 0 7px;
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
  }

  h1 {
    max-width: 520px;
    margin: 0;
    font-size: clamp(25px, 4vw, 36px);
    font-weight: 590;
    letter-spacing: -0.04em;
    line-height: 1.15;
  }

  a {
    display: inline-flex;
    min-height: 36px;
    align-items: center;
    gap: 7px;
    margin-top: 25px;
    padding: 8px 12px;
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    background: var(--surface);
    color: var(--text);
    font-size: 11px;
    font-weight: 550;
    text-decoration: none;
  }

  a:hover {
    background: var(--surface-muted);
  }

  a:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 3px;
  }
</style>
