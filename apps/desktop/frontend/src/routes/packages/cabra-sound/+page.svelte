<script lang="ts">
  import type { ToolPackage } from '#lib/catalog.js';
  import ModuleHeader from '#lib/components/ModuleHeader.svelte';
  import SoundBoard from '#lib/modules/cabra-sound/SoundBoard.svelte';

  let { data }: { data: { tool: ToolPackage } } = $props();
</script>

<svelte:head>
  <title>Cabra Sound · Assets Toolbox</title>
</svelte:head>

<ModuleHeader tool={data.tool} />
<div class="sound-workspace">
  <SoundBoard />
</div>

<style>
  .sound-workspace {
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
  }
</style>
