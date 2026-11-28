import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { hasSeenTour } from "../lib/tour";
import { hasSeenToolTour, markToolTourSeen, REPLAY_TOOL_TOUR_EVENT } from "../lib/tool-tours";
import { ToolGuideTour } from "./ToolGuideTour";

export function ToolTourHost({ slug, children }: { slug: string; children: ReactNode }) {
  const [run, setRun] = useState(false);
  // Remount the tour on each replay so Joyride starts from its first step.
  const [tourKey, setTourKey] = useState(0);
  const navigate = useNavigate();
  const { replayTour } = useSearch({ from: "/projects/$projectId/$tool" });

  // A help guide can open the tool with ?replayTour=1 to start the tour even
  // when it has already been seen. Clear the flag so a refresh doesn't replay.
  useEffect(() => {
    if (replayTour !== "1") return;
    markToolTourSeen(slug);
    setTourKey((key) => key + 1);
    setRun(true);
    void navigate({ to: ".", search: {}, replace: true });
  }, [replayTour, slug, navigate]);

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
      if ((event as CustomEvent<string>).detail !== slug) return;
      setTourKey((key) => key + 1);
      setRun(true);
    }
    window.addEventListener(REPLAY_TOOL_TOUR_EVENT, handleReplay);
    return () => window.removeEventListener(REPLAY_TOOL_TOUR_EVENT, handleReplay);
  }, [slug]);

  return (
    <>
      {children}
      <ToolGuideTour key={tourKey} slug={slug} run={run} onRunChange={setRun} />
    </>
  );
}
