<script lang="ts">
  import { toolPackages } from '#lib/catalog.js';
  import PackageCard from '#lib/components/PackageCard.svelte';
</script>

<svelte:head>
  <title>Library · Assets Toolbox</title>
</svelte:head>

<div class="tool-grid">
  {#each toolPackages as tool (tool.id)}
    <PackageCard {tool} />
  {/each}
</div>

<style>
  .tool-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  @media (max-width: 1100px) {
    .tool-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .tool-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
