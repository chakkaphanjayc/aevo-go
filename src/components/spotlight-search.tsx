import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { SmartOmniSearch } from "./smart-omni-search";

export { SmartOmniSearch };

export function SpotlightSearch() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

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
        } else {
          setOpen(false);
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

  const openSearch = () => {
    previousFocusRef.current = triggerRef.current;
    setOpen(true);
  };

  const closeSearch = () => {
    setOpen(false);
    previousFocusRef.current?.focus();
    previousFocusRef.current = null;
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

      {open && <SmartOmniSearch onClose={closeSearch} isOpen={open} />}
    </>
  );
}

