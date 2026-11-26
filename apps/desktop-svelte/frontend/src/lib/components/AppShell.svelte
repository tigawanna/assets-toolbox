<script lang="ts">
  import GridFour from 'phosphor-svelte/lib/GridFour';
  import List from 'phosphor-svelte/lib/List';
  import Moon from 'phosphor-svelte/lib/Moon';
  import SidebarSimple from 'phosphor-svelte/lib/SidebarSimple';
  import Sun from 'phosphor-svelte/lib/Sun';
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { findPackage, toolPackages } from '#lib/catalog.js';
  import { formatPlatform, getSystemInfo } from '#lib/native.js';
  import type { NativeSystemInfo } from '#lib/native.js';
  import { getTheme, toggleTheme } from '#lib/stores/theme.svelte.js';
  import PackageIcon from './PackageIcon.svelte';

  let { children } = $props();
  let systemInfo = $state<NativeSystemInfo | null>(null);
  let navOpen = $state(false);
  let sidebarCollapsed = $state(false);

  const currentSlug = $derived(page.url.pathname.split('/')[2] ?? '');
  const currentPackage = $derived(findPackage(currentSlug));
  const editorRoute = $derived(
    currentPackage?.id === 'svg-compose' || currentPackage?.id === 'screenshot-studio'
  );
  const currentLabel = $derived(currentPackage?.name ?? 'Library');
  const currentTheme = $derived(getTheme());
  const platform = $derived(systemInfo ? formatPlatform(systemInfo) : 'Connecting');
  const backendLabel = $derived.by(() => {
    if (!systemInfo) return 'Connecting to Go';
    return systemInfo.desktop ? 'Go backend connected' : 'Browser preview';
  });

  onMount(async () => {
    try {
      systemInfo = await getSystemInfo();
    } catch {
      systemInfo = null;
    }
  });

  onMount(() => {
    try {
      sidebarCollapsed = localStorage.getItem('assets-toolbox-sidebar') === 'collapsed';
    } catch {
      // Storage is optional; the default expanded sidebar still works.
    }
  });

  onMount(() => afterNavigate(() => (navOpen = false)));

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    try {
      localStorage.setItem('assets-toolbox-sidebar', sidebarCollapsed ? 'collapsed' : 'expanded');
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.repeat || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'b') {
      return;
    }
    event.preventDefault();
    toggleSidebar();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app-shell" class:collapsed={sidebarCollapsed} class:editor-route={editorRoute}>
  {#if navOpen}
    <button class="nav-scrim" aria-label="Close navigation" onclick={() => (navOpen = false)}></button>
  {/if}

  <aside class="sidebar" class:open={navOpen} class:collapsed={sidebarCollapsed} aria-label="Workspace navigation">
    <a class="brand" href="/" aria-label="Assets Toolbox home">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-copy">
        <strong>Assets Toolbox</strong>
        <small>Desktop workspace</small>
      </span>
    </a>

    <nav class="sidebar-nav">
      <div class="nav-section">
        <span class="nav-label">Workspace</span>
        <a
          class="nav-link"
          class:active={page.url.pathname === '/'}
          href="/"
          aria-label="Library"
          title="Library"
          aria-current={page.url.pathname === '/' ? 'page' : undefined}
        >
          <GridFour size={17} weight="regular" aria-hidden="true" />
          <span>Library</span>
          <span class="nav-count">{toolPackages.length}</span>
        </a>
      </div>

      <div class="nav-section">
        <span class="nav-label">Tools</span>
        {#each toolPackages as tool}
          <a
            class="nav-link"
            class:active={page.url.pathname === tool.route}
            href={tool.route}
            aria-label={tool.shortName}
            title={tool.shortName}
            aria-current={page.url.pathname === tool.route ? 'page' : undefined}
          >
            <PackageIcon name={tool.icon} size={17} weight="regular" />
            <span>{tool.shortName}</span>
          </a>
        {/each}
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="backend-status">
        <div class="backend-line">
          <span class="status-dot" class:preview={systemInfo && !systemInfo.desktop}></span>
          <span>{backendLabel}</span>
        </div>
        <div class="backend-meta">
          <span>{platform}</span>
          <span>v{systemInfo?.version ?? '0.1.0'}</span>
        </div>
      </div>

      <div class="sidebar-controls">
        <button
          class="sidebar-control theme-control"
          aria-label={currentTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={currentTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onclick={toggleTheme}
        >
          {#if currentTheme === 'dark'}
            <Sun size={17} aria-hidden="true" />
            <span>Light mode</span>
          {:else}
            <Moon size={17} aria-hidden="true" />
            <span>Dark mode</span>
          {/if}
        </button>

        <button
          class="sidebar-control collapse-control"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          aria-expanded={!sidebarCollapsed}
          onclick={toggleSidebar}
        >
          <SidebarSimple size={18} aria-hidden="true" />
          <span>{sidebarCollapsed ? 'Expand' : 'Collapse'}</span>
        </button>
      </div>
    </div>
  </aside>

  <section class="workspace">
    <header class="topbar">
      <div class="topbar-left">
        <button
          class="icon-button menu-button"
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={navOpen}
          onclick={() => (navOpen = !navOpen)}
        >
          <List size={20} aria-hidden="true" />
        </button>
        <div class="breadcrumb" aria-label="Breadcrumb">
          <span>Workspace</span>
          <span class="breadcrumb-separator">/</span>
          <strong>{currentLabel}</strong>
        </div>
      </div>
    </header>

    <main class="main-scroll">
      <div class="page-content">
        {@render children()}
      </div>
    </main>
  </section>
</div>

<style>
  .app-shell {
    display: grid;
    height: 100dvh;
    grid-template-columns: 208px minmax(0, 1fr);
    overflow: hidden;
    background: var(--canvas);
  }

  .app-shell.collapsed {
    grid-template-columns: 64px minmax(0, 1fr);
  }

  .sidebar {
    display: flex;
    min-height: 0;
    flex-direction: column;
    padding: 24px 14px 16px;
    border-right: 1px solid var(--line);
    background: var(--sidebar);
    color: var(--text);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 8px;
    color: inherit;
    text-decoration: none;
  }

  .brand:focus-visible {
    border-radius: 8px;
    outline: 2px solid var(--accent);
    outline-offset: 5px;
  }

  .brand-mark {
    position: relative;
    display: block;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    overflow: hidden;
    border-radius: 9px;
    background: var(--accent);
  }

  .brand-mark::before,
  .brand-mark::after {
    position: absolute;
    border: 1.5px solid var(--sidebar);
    content: '';
  }

  .brand-mark::before {
    top: 8px;
    left: 8px;
    width: 11px;
    height: 11px;
  }

  .brand-mark::after {
    right: 7px;
    bottom: 7px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--sidebar);
  }

  .brand-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }

  .brand-copy strong {
    font-size: 13px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }

  .brand-copy small {
    color: var(--text-subtle);
    font-size: 10px;
  }

  .sidebar-nav {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    margin-top: 32px;
    scrollbar-width: thin;
  }

  .nav-section + .nav-section {
    margin-top: 27px;
  }

  .nav-label {
    display: block;
    padding: 0 10px 9px;
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .nav-link {
    display: flex;
    min-height: 36px;
    align-items: center;
    gap: 10px;
    margin: 2px 0;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
    transition:
      background-color 150ms var(--ease),
      color 150ms var(--ease);
  }

  .nav-link:hover {
    background: var(--sidebar-hover);
    color: var(--text);
  }

  .nav-link.active {
    background: var(--sidebar-active);
    color: var(--text);
  }

  .nav-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .nav-link > :global(svg) {
    flex: 0 0 auto;
    color: var(--text-muted);
  }

  .nav-link.active > :global(svg) {
    color: var(--accent);
  }

  .nav-count {
    min-width: 20px;
    margin-left: auto;
    padding: 1px 5px;
    border: 1px solid var(--line);
    border-radius: 5px;
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 9px;
    text-align: center;
  }

  .backend-status {
    margin-top: 16px;
    padding: 15px 10px 0;
    border-top: 1px solid var(--line);
  }

  .backend-line {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
    font-size: 10px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    flex: 0 0 6px;
    border-radius: 50%;
    background: #79a886;
    box-shadow: 0 0 0 3px color-mix(in srgb, #79a886 12%, transparent);
  }

  .status-dot.preview {
    background: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .backend-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 7px;
    padding-left: 14px;
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 9px;
  }

  .sidebar-footer {
    margin-top: 16px;
  }

  .sidebar-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 34px;
    gap: 6px;
    margin-top: 10px;
  }

  .sidebar-control {
    display: flex;
    min-width: 0;
    min-height: 34px;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    padding: 7px 9px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
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

  .sidebar-control:hover {
    border-color: var(--line-strong);
    background: var(--sidebar-hover);
    color: var(--text);
  }

  .sidebar-control:active {
    background: var(--sidebar-active);
  }

  .sidebar-control:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .sidebar-control > :global(svg) {
    flex: 0 0 auto;
  }

  .collapse-control {
    justify-content: center;
    padding: 7px;
  }

  @media (min-width: 901px) {
    .sidebar.collapsed {
      padding: 24px 10px 16px;
    }

    .sidebar.collapsed .brand {
      justify-content: center;
      padding: 0;
    }

    .sidebar.collapsed .brand-copy,
    .sidebar.collapsed .nav-label,
    .sidebar.collapsed .nav-link > span,
    .sidebar.collapsed .backend-line > span:last-child,
    .sidebar.collapsed .backend-meta,
    .sidebar.collapsed .sidebar-control > span {
      display: none;
    }

    .sidebar.collapsed .sidebar-nav {
      margin-top: 24px;
    }

    .sidebar.collapsed .nav-link {
      justify-content: center;
      gap: 0;
      padding: 8px;
    }

    .sidebar.collapsed .backend-status {
      padding: 15px 0 0;
    }

    .sidebar.collapsed .backend-line {
      justify-content: center;
    }

    .sidebar.collapsed .sidebar-controls {
      grid-template-columns: minmax(0, 1fr);
    }

    .sidebar.collapsed .sidebar-control {
      justify-content: center;
      padding: 7px;
    }
  }

  .workspace {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
  }

  .topbar {
    display: flex;
    height: 64px;
    flex: 0 0 64px;
    align-items: center;
    justify-content: space-between;
    padding: 0 30px;
    border-bottom: 1px solid var(--line);
    background: var(--canvas);
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text-subtle);
    font-size: 11px;
  }

  .breadcrumb strong {
    color: var(--text);
    font-weight: 550;
  }

  .breadcrumb-separator {
    color: var(--line-strong);
  }

  .icon-button {
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--surface);
    color: var(--text-muted);
    cursor: pointer;
    transition:
      border-color 150ms var(--ease),
      color 150ms var(--ease),
      transform 150ms var(--ease);
  }

  .icon-button:hover {
    border-color: var(--line-strong);
    color: var(--text);
  }

  .icon-button:active {
    transform: scale(0.96);
  }

  .icon-button:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .menu-button {
    display: none;
  }

  .main-scroll {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    scrollbar-color: var(--line-strong) transparent;
    scrollbar-width: thin;
  }

  .page-content {
    width: 100%;
    max-width: 1280px;
    height: 100%;
    margin: 0 auto;
    padding: 24px 38px 48px;
  }

  .app-shell.editor-route .main-scroll {
    overflow: hidden;
  }

  .app-shell.editor-route .page-content {
    max-width: none;
    padding: 0;
  }

  .app-shell.editor-route :global(.page-content > *) {
    animation: none;
    transform: none;
  }

  :global(.page-content > *) {
    animation: enter 320ms var(--ease) both;
  }

  :global(.page-content > *):nth-child(2) {
    animation-delay: 40ms;
  }

  :global(.page-content > *):nth-child(3) {
    animation-delay: 80ms;
  }

  .nav-scrim {
    display: none;
  }

  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(7px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 900px) {
    .app-shell {
      display: block;
    }

    .sidebar {
      position: fixed;
      z-index: 20;
      top: 0;
      bottom: 0;
      left: 0;
      width: 252px;
      transform: translateX(-100%);
      transition: transform 220ms var(--ease);
    }

    .sidebar.open {
      transform: translateX(0);
    }

    .nav-scrim {
      position: fixed;
      z-index: 10;
      display: block;
      inset: 0;
      border: 0;
      background: rgb(15 18 15 / 45%);
      cursor: default;
    }

    .workspace {
      height: 100dvh;
    }

    .menu-button {
      display: grid;
    }

    .topbar {
      padding: 0 20px;
    }

    .page-content {
      padding: 30px 22px 40px;
    }
  }

  @media (max-width: 480px) {
    .topbar {
      height: 58px;
      flex-basis: 58px;
      padding: 0 14px;
    }

    .breadcrumb {
      gap: 7px;
      font-size: 10px;
    }

    .page-content {
      padding: 25px 16px 34px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar,
    .app-shell,
    .icon-button,
    .nav-link,
    .sidebar-control,
    :global(.page-content > *) {
      animation: none;
      transition: none;
    }
  }
</style>
