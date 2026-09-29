import { useLayoutEffect, useRef } from "react";

export interface UseFlipOptions<T extends HTMLElement = HTMLElement> {
  durationMs?: number;
  closeDurationMs?: number;
  easing?: string;
  direction?: "horizontal" | "both";
  disabled?: boolean;
  externalRef?: React.RefObject<T | null>;
}

/**
 * useFlipTransition executes FLIP (First, Last, Invert, Play) animations on an element
 * using GPU-accelerated CSS transforms (translate3d) instead of transitioning width/flex-basis,
 * eliminating layout thrashing and delivering buttery 60 FPS transitions.
 */
export function useFlipTransition<T extends HTMLElement = HTMLElement>(
  triggerActive: boolean,
  options: UseFlipOptions<T> = {},
) {
  const internalRef = useRef<T | null>(null);
  const ref = options.externalRef ?? internalRef;
  const prevRectRef = useRef<DOMRect | null>(null);
  const isFirstRender = useRef(true);

  const durationMs = triggerActive ? (options.durationMs ?? 320) : (options.closeDurationMs ?? 240);
  const easing = options.easing ?? "cubic-bezier(0.16, 1, 0.3, 1)";
  const direction = options.direction ?? "horizontal";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || options.disabled) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevRectRef.current = el.getBoundingClientRect();
      return;
    }

    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      prevRectRef.current = el.getBoundingClientRect();
      return;
    }

    const prevRect = prevRectRef.current;
    const currentRect = el.getBoundingClientRect();
    prevRectRef.current = currentRect;

    if (!prevRect) return;

    const deltaX = prevRect.left - currentRect.left;
    const deltaY = direction === "both" ? prevRect.top - currentRect.top : 0;

    // Only apply FLIP if there is a noticeable position shift (avoid micro jitter)
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      // Invert: lock element to previous visual position with zero transition
      el.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
      el.style.transition = "none";

      // Play: animate to final coordinate (0, 0) on the compositor thread
      let innerRafId: number | null = null;
      const outerRafId = requestAnimationFrame(() => {
        innerRafId = requestAnimationFrame(() => {
          if (!el) return;
          el.style.transition = `transform ${durationMs}ms ${easing}`;
          el.style.transform = "translate3d(0, 0, 0)";
        });
      });

      const timer = window.setTimeout(() => {
        if (!el) return;
        el.style.transition = "";
        el.style.transform = "";
      }, durationMs + 30);

      return () => {
        cancelAnimationFrame(outerRafId);
        if (innerRafId !== null) cancelAnimationFrame(innerRafId);
        window.clearTimeout(timer);
      };
    }
  }, [triggerActive, durationMs, easing, direction, options.disabled]);

  return ref;
}
