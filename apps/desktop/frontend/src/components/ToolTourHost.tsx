import { useEffect, useState, type ReactNode } from "react";

import { hasSeenTour } from "../lib/tour";
import { hasSeenToolTour, markToolTourSeen, REPLAY_TOOL_TOUR_EVENT } from "../lib/tool-tours";
import { ToolGuideTour } from "./ToolGuideTour";

export function ToolTourHost({ slug, children }: { slug: string; children: ReactNode }) {
  const [run, setRun] = useState(false);

  // Wait for the tool to paint before anchoring the first tooltip. Don't stack
  // a tool tour on top of the first-launch workspace tour.
  useEffect(() => {
    if (!hasSeenTour() || hasSeenToolTour(slug)) return;
    const timer = window.setTimeout(() => {
      markToolTourSeen(slug);
      setRun(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [slug]);

  useEffect(() => {
    function handleReplay(event: Event) {
      if ((event as CustomEvent<string>).detail === slug) setRun(true);
    }
    window.addEventListener(REPLAY_TOOL_TOUR_EVENT, handleReplay);
    return () => window.removeEventListener(REPLAY_TOOL_TOUR_EVENT, handleReplay);
  }, [slug]);

  return (
    <>
      {children}
      <ToolGuideTour slug={slug} run={run} onRunChange={setRun} />
    </>
  );
}
