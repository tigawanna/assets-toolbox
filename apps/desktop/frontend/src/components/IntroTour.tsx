import { useEffect, useId, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

import { markTourSeen, TOUR_STEPS } from "../lib/tour";
import "./intro-tour.css";

export function IntroTour({ onClose }: { onClose: () => void }): JSX.Element {
  const [step, setStep] = useState(0);
  const headingId = useId();
  const nextRef = useRef<HTMLButtonElement>(null);
  const stepRef = useRef(0);
  const current = TOUR_STEPS[step]!;
  const last = step === TOUR_STEPS.length - 1;

  const next = () => {
    const nextStep = stepRef.current + 1;
    if (nextStep >= TOUR_STEPS.length) {
      markTourSeen();
      onClose();
      return;
    }
    stepRef.current = nextStep;
    setStep(nextStep);
  };

  const back = () => {
    const previous = Math.max(0, stepRef.current - 1);
    stepRef.current = previous;
    setStep(previous);
  };

  const skip = () => {
    markTourSeen();
    onClose();
  };

  useEffect(() => {
    nextRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        skip();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return createPortal(
    <div className="intro-backdrop">
      <div className="intro-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <header className="intro-header">
          <div className="intro-brand">
            <span className="brand-mark" aria-hidden="true" />
            <span>Assets Toolbox</span>
          </div>
          <button type="button" aria-label="Skip tour" onClick={skip}>
            <X size={15} />
          </button>
        </header>

        <div className="intro-slide">
          <span className="intro-eyebrow">
            {current.eyebrow} · {step + 1} / {TOUR_STEPS.length}
          </span>
          <h1 id={headingId}>{current.title}</h1>
          <p>{current.body}</p>
          {current.bullets ? (
            <ul>
              {current.bullets.map((bullet) => (
                <li key={bullet}>
                  <Check size={13} aria-hidden="true" />
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <footer className="intro-footer">
          <div className="intro-dots" aria-label={`Step ${step + 1} of ${TOUR_STEPS.length}`}>
            {TOUR_STEPS.map((item, index) => (
              <span key={item.title} className={index === step ? "active" : undefined} />
            ))}
          </div>
          <div className="intro-actions">
            {step > 0 ? (
              <button type="button" onClick={back}>
                <ArrowLeft size={14} /> Back
              </button>
            ) : null}
            <button type="button" className="intro-skip" onClick={skip}>
              Skip
            </button>
            <button ref={nextRef} type="button" className="intro-next" onClick={next}>
              {last ? "Finish" : "Next"} <ArrowRight size={14} />
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
