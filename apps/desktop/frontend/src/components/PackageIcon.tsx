import {
  AudioWaveform,
  Frame,
  Palette,
  Scan,
  Shapes,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

import type { PackageIconName } from "../lib/catalog";

const icons: Record<PackageIconName, LucideIcon> = {
  shapes: Shapes,
  scan: Scan,
  swatchbook: Palette,
  device: Smartphone,
  frame: Frame,
  waveform: AudioWaveform,
};

export function PackageIcon({ name, size = 24 }: { name: PackageIconName; size?: number }) {
  const Icon = icons[name];
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" focusable="false" />;
}
