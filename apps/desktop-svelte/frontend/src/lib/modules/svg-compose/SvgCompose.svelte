<script lang="ts">
  import { onMount } from 'svelte';

  let host = $state<HTMLDivElement | null>(null);

  onMount(() => {
    const element = host;
    if (!element) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void import('./mount.js').then(({ mountSvgCompose }) => {
      if (cancelled) return;
      cleanup = mountSvgCompose(element);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  });
</script>

<div class="svg-compose-mount" bind:this={host}></div>

<style>
  .svg-compose-mount {
    width: 100%;
    height: 100%;
    min-height: 0;
  }
</style>
