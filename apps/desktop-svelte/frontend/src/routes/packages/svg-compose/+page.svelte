<script lang="ts">
  import SvgCompose from '#lib/modules/svg-compose/SvgCompose.svelte';
</script>

<svelte:head>
  <title>SVG Compose · Assets Toolbox</title>
</svelte:head>

<div class="svg-compose-page">
  <SvgCompose />
</div>

<style>
  .svg-compose-page {
    height: 100%;
    min-height: 0;
    animation: none;
    transform: none;
  }
</style>
