import { useEffect, useRef, useState, type CSSProperties, type Touch, type TouchEvent } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";

export interface PhotoLightboxItem {
  src?: string;
  alt: string;
  fallback: string;
}

interface PhotoLightboxProps {
  items: readonly PhotoLightboxItem[];
  initialIndex?: number;
  title: string;
  onClose: () => void;
  onOpenDetail?: () => void;
}

interface ZoomTransform {
  x: number;
  y: number;
  scale: number;
}

interface TouchGesture {
  mode: "swipe" | "pinch";
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  startScale: number;
  startDistance: number;
  startCenterX: number;
  startCenterY: number;
}

const initialTransform: ZoomTransform = { x: 0, y: 0, scale: 1 };

function touchDistance(first: Touch, second: Touch): number {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function touchCenter(first: Touch, second: Touch): { x: number; y: number } {
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}

export function PhotoLightbox({
  items,
  initialIndex = 0,
  title,
  onClose,
  onOpenDetail,
}: PhotoLightboxProps) {
  const safeItems = items.length > 0 ? items : [{ alt: title, fallback: title }];
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), safeItems.length - 1),
  );
  const [imageError, setImageError] = useState(false);
  const [transform, setTransform] = useState<ZoomTransform>(initialTransform);
  const [isGesturing, setIsGesturing] = useState(false);
  const gestureRef = useRef<TouchGesture | null>(null);
  const activeItem = safeItems[activeIndex] ?? safeItems[0];
  const hasMultipleItems = safeItems.length > 1;

  useEffect(() => {
    setImageError(false);
    setTransform(initialTransform);
  }, [activeIndex, activeItem.src]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        setTransform(initialTransform);
        setActiveIndex((current) => (current === 0 ? safeItems.length - 1 : current - 1));
      }
      if (event.key === "ArrowRight") {
        setTransform(initialTransform);
        setActiveIndex((current) => (current + 1) % safeItems.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, safeItems.length]);

  const goToIndex = (nextIndex: number) => {
    setTransform(initialTransform);
    setActiveIndex((nextIndex + safeItems.length) % safeItems.length);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const first = event.touches[0];
    if (!first) return;
    if (event.touches.length >= 2) {
      const second = event.touches[1];
      if (!second) return;
      const center = touchCenter(first, second);
      gestureRef.current = {
        mode: "pinch",
        startX: first.clientX,
        startY: first.clientY,
        baseX: transform.x,
        baseY: transform.y,
        startScale: transform.scale,
        startDistance: touchDistance(first, second),
        startCenterX: center.x,
        startCenterY: center.y,
      };
    } else {
      gestureRef.current = {
        mode: "swipe",
        startX: first.clientX,
        startY: first.clientY,
        baseX: transform.x,
        baseY: transform.y,
        startScale: transform.scale,
        startDistance: 0,
        startCenterX: 0,
        startCenterY: 0,
      };
    }
    setIsGesturing(true);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const first = event.touches[0];
    if (!gesture || !first) return;

    if (event.touches.length >= 2 && gesture.startDistance > 0) {
      const second = event.touches[1];
      if (!second) return;
      event.preventDefault();
      const center = touchCenter(first, second);
      const nextScale = Math.max(1, Math.min(4, gesture.startScale * (touchDistance(first, second) / gesture.startDistance)));
      setTransform({
        scale: nextScale,
        x: gesture.baseX + center.x - gesture.startCenterX,
        y: gesture.baseY + center.y - gesture.startCenterY,
      });
      return;
    }

    if (event.touches.length !== 1) return;
    const deltaX = first.clientX - gesture.startX;
    const deltaY = first.clientY - gesture.startY;
    if (gesture.startScale > 1.01 || transform.scale > 1.01) {
      event.preventDefault();
      setTransform({ x: gesture.baseX + deltaX, y: gesture.baseY + deltaY, scale: transform.scale });
      return;
    }
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
      setTransform({ x: deltaX, y: Math.max(-90, Math.min(90, deltaY * 0.35)), scale: 1 });
    } else {
      setTransform({ x: 0, y: Math.max(-80, Math.min(180, deltaY)), scale: 1 });
    }
  };

  const finishTouch = (event: TouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.touches.length > 0) return;
    const deltaX = event.changedTouches[0]?.clientX - gesture.startX || 0;
    const deltaY = event.changedTouches[0]?.clientY - gesture.startY || 0;
    const horizontalSwipe = Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY);
    const swipeDown = deltaY > 110 && Math.abs(deltaY) > Math.abs(deltaX);
    if (gesture.mode === "swipe" && transform.scale <= 1.01 && horizontalSwipe && hasMultipleItems) {
      goToIndex(activeIndex + (deltaX < 0 ? 1 : -1));
    } else if (gesture.mode === "swipe" && transform.scale <= 1.01 && swipeDown) {
      onClose();
    } else if (transform.scale <= 1.01) {
      setTransform(initialTransform);
    }
    gestureRef.current = null;
    setIsGesturing(false);
  };

  const zoomStyle: CSSProperties = {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
    transition: isGesturing ? "none" : "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
  };

  return (
    <div
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`ดูรูปภาพ ${title}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="photo-lightbox__surface">
        <header className="photo-lightbox__header">
          <div>
            <span className="eyebrow">MEDIA PREVIEW</span>
            <strong>{title}</strong>
          </div>
          <button className="icon-button" type="button" aria-label="ปิดตัวดูรูปภาพ" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div
          className="photo-lightbox__viewer"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={finishTouch}
          onTouchCancel={finishTouch}
        >
          <div className="photo-lightbox__zoom-layer" style={zoomStyle}>
            {activeItem.src && !imageError ? (
              <img src={activeItem.src} alt={activeItem.alt} decoding="async" onError={() => setImageError(true)} />
            ) : (
              <span className="photo-lightbox__fallback">{activeItem.fallback}</span>
            )}
          </div>
          {hasMultipleItems && (
            <>
              <button className="photo-lightbox__nav photo-lightbox__nav--previous" type="button" aria-label="รูปก่อนหน้า" onClick={() => goToIndex(activeIndex - 1)}>
                <ChevronLeft size={22} aria-hidden="true" />
              </button>
              <button className="photo-lightbox__nav photo-lightbox__nav--next" type="button" aria-label="รูปถัดไป" onClick={() => goToIndex(activeIndex + 1)}>
                <ChevronRight size={22} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        <footer className="photo-lightbox__footer">
          <span className="muted-label" aria-live="polite">{activeIndex + 1} / {safeItems.length} · แตะสองนิ้วเพื่อซูม</span>
          {onOpenDetail && (
            <button className="button button--dark" type="button" onClick={() => { onClose(); onOpenDetail(); }}>
              เปิดรายละเอียด <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
