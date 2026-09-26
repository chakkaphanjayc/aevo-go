import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Coffee,
  Map,
  Route,
  Search,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type SpotlightOption = {
  id: string;
  label: string;
  description: string;
  shortcut: string;
  icon: LucideIcon;
  to: string;
  keywords: readonly string[];
};

const spotlightOptions: readonly SpotlightOption[] = [
  {
    id: "places",
    label: "Places & Cafes",
    description: "ค้นหาร้าน คาเฟ่ และสถานที่น่าแวะ",
    shortcut: "⌘1",
    icon: Coffee,
    to: "/search?category=Cafe",
    keywords: ["place", "places", "cafe", "cafes", "ร้าน", "คาเฟ่"],
  },
  {
    id: "traces",
    label: "Traces & Routes",
    description: "เปิดเส้นทางและแผนที่ Trace",
    shortcut: "⌘2",
    icon: Route,
    to: "/map?mode=traces",
    keywords: ["trace", "traces", "route", "routes", "เส้นทาง", "แผนที่"],
  },
  {
    id: "bookable",
    label: "Bookable via Aevo Play",
    description: "ดูสถานที่ที่จองเวลาได้ทันที",
    shortcut: "⌘3",
    icon: Zap,
    to: "/map?mode=places&reservable=1",
    keywords: ["book", "booking", "aevo", "play", "จอง", "เวลา"],
  },
  {
    id: "creators",
    label: "Tracers & Creators",
    description: "ค้นหาคนสร้าง Trace และคอนเทนต์",
    shortcut: "⌘4",
    icon: UserRound,
    to: "/search?q=tracer",
    keywords: ["tracer", "creator", "creators", "คนสร้าง", "ครีเอเตอร์"],
  },
];

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function SpotlightSearch() {
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = normalize(query);
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return spotlightOptions;
    return spotlightOptions.filter((option) =>
      [option.label, option.description, ...option.keywords]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!open) {
          previousFocusRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : triggerRef.current;
          setOpen(true);
        }
      }
      if (open && (event.metaKey || event.ctrlKey) && /^[1-4]$/.test(event.key)) {
        const option = spotlightOptions[Number(event.key) - 1];
        if (option) {
          event.preventDefault();
          setOpen(false);
          navigate(option.to);
        }
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return;
    }
    setQuery("");
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActiveIndex((current) =>
      filteredOptions.length === 0
        ? 0
        : Math.min(current, filteredOptions.length - 1),
    );
  }, [filteredOptions.length]);

  const openSearch = () => {
    previousFocusRef.current = triggerRef.current;
    setOpen(true);
  };

  const closeSearch = () => setOpen(false);

  const goTo = (to: string) => {
    closeSearch();
    navigate(to);
  };

  const submitSearch = () => {
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      goTo(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      return;
    }
    const option = filteredOptions[activeIndex];
    if (option) goTo(option.to);
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        filteredOptions.length === 0
          ? 0
          : (current + 1) % filteredOptions.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        filteredOptions.length === 0
          ? 0
          : (current - 1 + filteredOptions.length) % filteredOptions.length,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submitSearch();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        className="desktop-search-link spotlight-search-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openSearch}
      >
        <Search size={16} aria-hidden="true" />
        <span>Search or ask...</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div
          className="spotlight-search-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSearch();
          }}
        >
          <section
            className="spotlight-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotlight-search-title"
          >
            <h2 id="spotlight-search-title" className="sr-only">
              Search Aevocado GO
            </h2>
            <div className="spotlight-search-input-wrap">
              <Search size={20} aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search or ask Aevocado GO..."
                aria-label="ค้นหา Aevocado GO"
                autoComplete="off"
                spellCheck="false"
              />
              {query && (
                <button
                  className="spotlight-search-clear"
                  type="button"
                  aria-label="ล้างคำค้นหา"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
              <button
                className="spotlight-search-close"
                type="button"
                aria-label="ปิดการค้นหา"
                onClick={closeSearch}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div
              className="spotlight-search-suggestions"
              role="listbox"
              aria-label="หมวดหมู่การค้นหา"
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const Icon = option.icon;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={option.id}
                      id={`spotlight-option-${option.id}`}
                      className={`spotlight-search-option${active ? " is-active" : ""}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goTo(option.to)}
                    >
                      <span className="spotlight-search-option__icon">
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <span className="spotlight-search-option__copy">
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                      <kbd>{option.shortcut}</kbd>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  );
                })
              ) : (
                <button
                  className="spotlight-search-option is-active"
                  type="button"
                  onClick={submitSearch}
                >
                  <span className="spotlight-search-option__icon">
                    <Map size={17} aria-hidden="true" />
                  </span>
                  <span className="spotlight-search-option__copy">
                    <strong>ค้นหา “{query.trim()}”</strong>
                    <small>เปิดผลการค้นหาสถานที่และ Trace</small>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              )}
            </div>
            <footer className="spotlight-search-footer">
              <span>↑↓ เลือก</span>
              <span>Enter เปิด</span>
              <span>Esc ปิด</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
