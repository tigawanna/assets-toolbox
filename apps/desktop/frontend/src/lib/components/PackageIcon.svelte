<script lang="ts">
  import DeviceMobile from 'phosphor-svelte/lib/DeviceMobile';
  import FrameCorners from 'phosphor-svelte/lib/FrameCorners';
  import Scan from 'phosphor-svelte/lib/Scan';
  import Shapes from 'phosphor-svelte/lib/Shapes';
  import Palette from 'phosphor-svelte/lib/Palette';
  import Waveform from 'phosphor-svelte/lib/Waveform';
  import type { PackageIconName } from '#lib/catalog.js';

  const icons = {
    shapes: Shapes,
    scan: Scan,
    swatchbook: Palette,
    device: DeviceMobile,
    frame: FrameCorners,
    waveform: Waveform
  };

  let {
    name,
    size = 24,
    weight = 'duotone'
  }: {
    name: PackageIconName;
    size?: number;
    weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  } = $props();

  const Icon = $derived(icons[name]);
</script>

<Icon {size} {weight} aria-hidden="true" focusable="false" />
