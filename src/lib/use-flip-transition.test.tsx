import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useFlipTransition } from "./use-flip-transition";

function TestComponent({ active }: { active: boolean }) {
  const ref = useFlipTransition<HTMLDivElement>(active);
  return <div ref={ref} data-testid="flip-target">Target</div>;
}

describe("useFlipTransition", () => {
  it("initializes without throwing", () => {
    const { getByTestId } = render(<TestComponent active={false} />);
    expect(getByTestId("flip-target")).toBeDefined();
  });

  it("safely handles state transitions when attached to an element", () => {
    let mockLeft = 100;
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = vi.fn().mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("data-testid") === "flip-target") {
        return {
          left: mockLeft,
          top: 50,
          right: mockLeft + 400,
          bottom: 450,
          width: 400,
          height: 400,
          x: mockLeft,
          y: 50,
          toJSON: () => {},
        };
      }
      return originalGetBoundingClientRect.call(this);
    });

    try {
      const { rerender, getByTestId } = render(<TestComponent active={false} />);
      const el = getByTestId("flip-target");

      // Shift position
      mockLeft = 40;
      rerender(<TestComponent active={true} />);

      expect(el.style.transform).toContain("translate3d");
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });
});
