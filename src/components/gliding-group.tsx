import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

export type GlidingGroupItem = {
  id: string;
  label: ReactNode;
  disabled?: boolean;
};

type GlidingGroupProps = {
  items: readonly GlidingGroupItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  role?: "tablist" | "group";
  size?: "default" | "small";
  className?: string;
};

type IndicatorRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function GlidingGroup({
  items,
  activeId,
  onChange,
  ariaLabel,
  role = "group",
  size = "default",
  className = ""
}: GlidingGroupProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);

  const measureIndicator = useCallback(() => {
    const root = rootRef.current;
    const activeItem = itemRefs.current[activeId];
    if (!root || !activeItem) {
      setIndicator(null);
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const activeRect = activeItem.getBoundingClientRect();
    setIndicator({
      left: activeRect.left - rootRect.left,
      top: activeRect.top - rootRect.top,
      width: activeRect.width,
      height: activeRect.height
    });
  }, [activeId]);

  useLayoutEffect(() => {
    measureIndicator();
    const root = rootRef.current;
    const observer = typeof ResizeObserver === "undefined" || !root ? null : new ResizeObserver(measureIndicator);
    if (root && observer) observer.observe(root);
    window.addEventListener("resize", measureIndicator);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureIndicator);
    };
  }, [measureIndicator]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (role !== "tablist" || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    for (let offset = 1; offset <= items.length; offset += 1) {
      const nextIndex = (index + direction * offset + items.length) % items.length;
      const nextItem = items[nextIndex];
      if (nextItem && !nextItem.disabled) {
        onChange(nextItem.id);
        itemRefs.current[nextItem.id]?.focus();
        return;
      }
    }
  };

  const classes = ["gliding-group", size === "small" ? "gliding-group--small" : "", className].filter(Boolean).join(" ");
  const indicatorStyle: CSSProperties | undefined = indicator ? {
    left: indicator.left,
    top: indicator.top,
    width: indicator.width,
    height: indicator.height
  } : undefined;

  return (
    <div ref={rootRef} className={classes} role={role} aria-label={ariaLabel}>
      {indicator && <span className="gliding-group__indicator" style={indicatorStyle} aria-hidden="true" />}
      {items.map((item, index) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            ref={(element) => { itemRefs.current[item.id] = element; }}
            className={`gliding-group__item${active ? " is-active" : ""}`}
            type="button"
            role={role === "tablist" ? "tab" : undefined}
            aria-selected={role === "tablist" ? active : undefined}
            aria-pressed={role === "group" ? active : undefined}
            tabIndex={role === "tablist" && !active ? -1 : undefined}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
