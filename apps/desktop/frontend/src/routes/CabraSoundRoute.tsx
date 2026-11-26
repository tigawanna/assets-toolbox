import { ModuleHeader } from "../components/ModuleHeader";
import { findPackage } from "../lib/catalog";
import { SoundBoard } from "../modules/cabra-sound/SoundBoard";

export function CabraSoundRoute() {
  const tool = findPackage("cabra-sound");
  if (!tool) return null;
  return (
    <>
      <ModuleHeader tool={tool} />
      <div className="sound-workspace">
        <SoundBoard />
      </div>
    </>
  );
}
