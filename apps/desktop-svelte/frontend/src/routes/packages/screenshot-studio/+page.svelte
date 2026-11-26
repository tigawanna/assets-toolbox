<script lang="ts">
  import ScreenshotStudio from '#lib/modules/screenshot-studio/ScreenshotStudio.svelte';
</script>

<svelte:head>
  <title>Screenshot Studio · Assets Toolbox</title>
</svelte:head>

<div class="screenshot-studio-page">
  <ScreenshotStudio />
</div>

<style>
  .screenshot-studio-page {
    height: 100%;
    min-height: 0;
    animation: none;
    transform: none;
  }
</style>
