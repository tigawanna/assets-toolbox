import { useCallback, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import SvgComposeApp from "@assets/svg-compose/App";

import { setDesktopModuleActive, type DesktopFlush } from "../lib/desktop";
import { useFlushRegistry } from "../lib/flush";

export function SvgComposeRoute() {
  const navigate = useNavigate();
  const { register } = useFlushRegistry();
  const onReady = useCallback(
    (flush: DesktopFlush | null) => register("workspace", flush),
    [register],
  );

  const goHome = useCallback(() => {
    void navigate({ to: "/" });
  }, [navigate]);

  useEffect(() => {
    setDesktopModuleActive("workspace", true);
    return () => setDesktopModuleActive("workspace", false);
  }, []);

  return (
    <div className="editor-page">
      <SvgComposeApp embedded onReady={onReady} onHome={goHome} />
    </div>
  );
}
