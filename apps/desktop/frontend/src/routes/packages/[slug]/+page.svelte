<script lang="ts">
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
  import Check from 'phosphor-svelte/lib/Check';
  import Code from 'phosphor-svelte/lib/Code';
  import type { ToolPackage } from '#lib/catalog.js';
  import PackageIcon from '#lib/components/PackageIcon.svelte';

  let { data }: { data: { tool: ToolPackage } } = $props();
  const tool = $derived(data.tool);
</script>

<svelte:head>
  <title>{tool.name} · Assets Toolbox</title>
</svelte:head>

<a class="back-link" href="/">
  <ArrowLeft size={15} aria-hidden="true" />
  Back to library
</a>

<header class="module-heading">
  <div class="module-icon"><PackageIcon name={tool.icon} size={34} /></div>
  <div class="module-heading-copy">
    <div class="module-eyebrow">
      <span>{tool.category}</span>
      <span class="status-badge">{tool.mounted ? 'Mounted' : 'Not mounted'}</span>
    </div>
    <h1>{tool.name}</h1>
    <p>{tool.description}</p>
    <div class="tag-list" aria-label="Tool capabilities">
      {#each tool.tags as tag}
        <span>{tag}</span>
      {/each}
    </div>
  </div>
</header>

<div class="module-layout">
  <section class="mount-plan" aria-labelledby="mount-title">
    <div class="section-heading">
      <span class="section-number">01</span>
      <div>
        <h2 id="mount-title">Mounting plan</h2>
        <p>The route is ready. The package UI comes next.</p>
      </div>
    </div>

    <div class="mount-strategy">
      <span>Recommended path</span>
      <strong>{tool.mount}</strong>
    </div>

    <ol class="mount-steps">
      <li>
        <span class="step-check"><Check size={13} weight="bold" aria-hidden="true" /></span>
        <div>
          <strong>Route reserved</strong>
          <p>The shell can navigate here without a full page reload.</p>
        </div>
      </li>
      <li>
        <span class="step-index">2</span>
        <div>
          <strong>Lift the package UI</strong>
          <p>Copy the existing interface into an isolated module directory.</p>
        </div>
      </li>
      <li>
        <span class="step-index">3</span>
        <div>
          <strong>Connect native services</strong>
          <p>Move filesystem, persistence, and platform work behind Go APIs.</p>
        </div>
      </li>
    </ol>
  </section>

  <aside class="module-details" aria-labelledby="details-title">
    <div class="details-heading">
      <Code size={18} aria-hidden="true" />
      <h2 id="details-title">Module details</h2>
    </div>

    <dl>
      <div>
        <dt>Reserved route</dt>
        <dd><code>{tool.route}</code></dd>
      </div>
      <div>
        <dt>Source package</dt>
        <dd><code>{tool.source}</code></dd>
      </div>
      <div>
        <dt>Current stack</dt>
        <dd>{tool.stack}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd class="detail-status">{tool.mounted ? 'Mounted in desktop shell' : 'Catalogued for mounting'}</dd>
      </div>
    </dl>

    <a class="details-link" href="/">
      Browse all modules
      <ArrowRight size={15} aria-hidden="true" />
    </a>
  </aside>
</div>

<footer class="module-footer">
  <span class="footer-mark" aria-hidden="true"></span>
  <p>This placeholder is intentional. It keeps navigation stable while the real tool is integrated.</p>
</footer>

<style>
  .back-link {
    display: inline-flex;
    min-height: 32px;
    align-items: center;
    gap: 7px;
    margin-bottom: 30px;
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 550;
    text-decoration: none;
  }

  .back-link:hover {
    color: var(--text);
  }

  .back-link:focus-visible,
  .details-link:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 4px;
  }

  .module-heading {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--line);
  }

  .module-icon {
    display: grid;
    width: 70px;
    height: 70px;
    flex: 0 0 70px;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--surface);
    color: var(--accent);
  }

  .module-heading-copy {
    min-width: 0;
  }

  .module-eyebrow {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .status-badge {
    padding: 3px 6px;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: var(--surface-muted);
    color: var(--text-muted);
    font-size: 8px;
    letter-spacing: 0.04em;
  }

  h1 {
    margin: 9px 0 8px;
    font-size: clamp(30px, 4vw, 43px);
    font-weight: 590;
    letter-spacing: -0.05em;
    line-height: 1.05;
  }

  .module-heading-copy > p {
    max-width: 62ch;
    margin: 0;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.65;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 15px;
  }

  .tag-list span {
    padding: 4px 7px;
    border: 1px solid var(--line);
    border-radius: 5px;
    color: var(--text-muted);
    font-size: 9px;
  }

  .module-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.8fr);
    gap: 18px;
    margin-top: 26px;
  }

  .mount-plan,
  .module-details {
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .mount-plan {
    padding: 25px;
  }

  .section-heading {
    display: flex;
    align-items: flex-start;
    gap: 13px;
  }

  .section-number {
    display: grid;
    width: 31px;
    height: 31px;
    flex: 0 0 31px;
    place-items: center;
    border-radius: 8px;
    background: var(--surface-muted);
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 650;
  }

  .section-heading h2,
  .details-heading h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 620;
    letter-spacing: -0.02em;
  }

  .section-heading p {
    margin: 5px 0 0;
    color: var(--text-muted);
    font-size: 11px;
  }

  .mount-strategy {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 23px 0;
    padding: 15px 16px;
    border-left: 2px solid var(--accent);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    background: var(--surface-muted);
  }

  .mount-strategy span {
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .mount-strategy strong {
    font-size: 12px;
    font-weight: 550;
    line-height: 1.5;
  }

  .mount-steps {
    display: flex;
    flex-direction: column;
    gap: 18px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .mount-steps li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .step-check,
  .step-index {
    display: grid;
    width: 23px;
    height: 23px;
    flex: 0 0 23px;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 50%;
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 9px;
  }

  .step-check {
    border-color: color-mix(in srgb, var(--accent) 28%, var(--line));
    background: color-mix(in srgb, var(--accent) 8%, var(--surface));
    color: var(--accent);
  }

  .mount-steps strong {
    display: block;
    margin: 1px 0 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .mount-steps p {
    max-width: 58ch;
    margin: 0;
    color: var(--text-muted);
    font-size: 10px;
    line-height: 1.55;
  }

  .module-details {
    display: flex;
    flex-direction: column;
    padding: 24px;
  }

  .details-heading {
    display: flex;
    align-items: center;
    gap: 9px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--line);
    color: var(--text-muted);
  }

  .module-details dl {
    display: flex;
    flex-direction: column;
    gap: 19px;
    margin: 21px 0;
  }

  .module-details dl div {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .module-details dt {
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 8px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .module-details dd {
    margin: 0;
    color: var(--text);
    font-size: 11px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .module-details code {
    padding: 3px 5px;
    border-radius: 4px;
    background: var(--surface-muted);
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 9px;
  }

  .detail-status {
    color: var(--accent);
  }

  .details-link {
    display: flex;
    min-height: 35px;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: auto;
    padding: 8px 11px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface);
    color: var(--text);
    font-size: 10px;
    font-weight: 550;
    text-decoration: none;
    transition:
      border-color 150ms var(--ease),
      background-color 150ms var(--ease);
  }

  .details-link:hover {
    border-color: var(--line-strong);
    background: var(--surface-muted);
  }

  .module-footer {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 18px;
    color: var(--text-subtle);
  }

  .module-footer p {
    margin: 0;
    font-size: 10px;
    line-height: 1.5;
  }

  .footer-mark {
    width: 5px;
    height: 5px;
    flex: 0 0 5px;
    margin-top: 5px;
    border-radius: 50%;
    background: var(--accent);
  }

  @media (max-width: 820px) {
    .module-layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 560px) {
    .module-heading {
      flex-direction: column;
      gap: 16px;
    }

    .mount-plan,
    .module-details {
      padding: 20px;
    }
  }
</style>
