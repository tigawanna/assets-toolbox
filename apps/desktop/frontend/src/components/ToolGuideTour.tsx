import { Fragment, useEffect, useMemo, useState } from "react";
import { EVENTS, Joyride, STATUS, type EventData } from "react-joyride";
import { LifeBuoy } from "lucide-react";

import { getHelpGuide, tourStepsFor } from "../lib/help-content";
import { replayToolTour } from "../lib/tool-tours";
import "./tool-guide.css";

export function ToolGuideTour({
  slug,
  run,
  onRunChange,
}: {
  slug: string;
  run: boolean;
  onRunChange: (run: boolean) => void;
}) {
  const guide = getHelpGuide(slug);
  const [playing, setPlaying] = useState(run);
  const steps = useMemo(() => {
    const base = guide ? tourStepsFor(guide) : [];
    return base.map((step, index) => ({
      ...step,
      content: (
        <Fragment>
          <span className="tour-step-count">
            {index + 1} / {base.length}
          </span>
          {step.content}
        </Fragment>
      ),
    }));
  }, [guide]);

  useEffect(() => {
    setPlaying(run);
  }, [run]);

  useEffect(() => {
    if (!playing) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "g" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest("input, textarea, [role='textbox']")) {
          return;
        }
        setPlaying(false);
        onRunChange(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [playing, onRunChange]);

  if (!guide || steps.length === 0) return null;

  function handleEvent(data: EventData) {
    if (data.type !== EVENTS.TOUR_END) return;
    if (data.status !== STATUS.FINISHED && data.status !== STATUS.SKIPPED) return;
    setPlaying(false);
    onRunChange(false);
  }

  return (
    <>
      {playing ? null : (
        <button
          type="button"
          className="tool-guide-replay"
          aria-label={`Replay ${guide.name} tour`}
          title={`Replay ${guide.name} tour`}
          onClick={() => replayToolTour(slug)}
        >
          <LifeBuoy size={13} aria-hidden="true" />
          Guide
        </button>
      )}
      <Joyride
        steps={steps}
        run={playing}
        continuous
        scrollToFirstStep
        onEvent={handleEvent}
        locale={{
          back: "Back",
          close: "Close",
          last: "Finish",
          next: "Next",
          nextWithProgress: "Next",
          skip: "Skip tour",
        }}
        options={{
          arrowColor: "var(--surface)",
          backgroundColor: "var(--surface)",
          overlayColor: "rgba(8, 9, 8, 0.72)",
          primaryColor: "var(--accent)",
          textColor: "var(--text)",
          zIndex: 200,
          showProgress: false,
          buttons: ["back", "skip", "primary"],
          closeButtonAction: "skip",
          overlayClickAction: false,
          skipBeacon: true,
          targetWaitTimeout: 1500,
        }}
        styles={{
          tooltip: {
            borderRadius: 10,
            border: "1px solid var(--line-strong)",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
          },
          tooltipTitle: { fontSize: 13, fontWeight: 650 },
          tooltipContent: { color: "var(--text-muted)", lineHeight: 1.6 },
          buttonPrimary: { borderRadius: 7, fontWeight: 600 },
          buttonBack: { color: "var(--text-muted)" },
          buttonSkip: { color: "var(--text-subtle)" },
          floater: { filter: "drop-shadow(0 16px 40px rgba(0,0,0,0.35))" },
        }}
      />
    </>
  );
}
