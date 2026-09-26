import type { AvatarDecorationId } from "./profile-customization-types";

interface AvatarDecorationProps {
  decorationId: AvatarDecorationId;
  size?: number;
  className?: string;
}

export function AvatarDecoration({
  decorationId,
  size = 96,
  className = "",
}: AvatarDecorationProps) {
  if (decorationId === "none") {
    return null;
  }

  const containerStyle = {
    width: `${size + 24}px`,
    height: `${size + 24}px`,
    top: "-12px",
    left: "-12px",
  };

  return (
    <div
      className={`avatar-decoration-frame avatar-decoration--${decorationId} ${className}`}
      style={containerStyle}
      aria-hidden="true"
    >
      {decorationId === "lightstruck-halo" && (
        <div className="decoration-lightstruck">
          <div className="decoration-lightstruck__ring" />
          <span className="decoration-lightstruck__pearl p1" />
          <span className="decoration-lightstruck__pearl p2" />
          <span className="decoration-lightstruck__pearl p3" />
        </div>
      )}

      {decorationId === "sakura-orbit" && (
        <div className="decoration-sakura">
          <div className="decoration-sakura__orbit">
            <svg viewBox="0 0 120 120" className="decoration-sakura__svg" fill="none">
              {/* Petal 1 */}
              <path
                d="M60 12 C64 16 66 22 60 26 C54 22 56 16 60 12 Z"
                fill="#fbcfe8"
                opacity="0.95"
                transform="rotate(15 60 18)"
              />
              {/* Petal 2 */}
              <path
                d="M104 52 C108 56 109 63 103 66 C98 63 100 56 104 52 Z"
                fill="#f472b6"
                opacity="0.9"
                transform="rotate(65 104 59)"
              />
              {/* Petal 3 */}
              <path
                d="M74 102 C78 106 77 113 71 114 C67 110 70 104 74 102 Z"
                fill="#fbcfe8"
                opacity="0.95"
                transform="rotate(160 73 108)"
              />
              {/* Petal 4 */}
              <path
                d="M16 68 C20 72 19 79 13 80 C9 76 12 70 16 68 Z"
                fill="#fda4af"
                opacity="0.9"
                transform="rotate(240 16 74)"
              />
            </svg>
          </div>
          <div className="decoration-sakura__glow" />
        </div>
      )}

      {decorationId === "cyber-matrix" && (
        <div className="decoration-cyber">
          <div className="decoration-cyber__bracket top-left" />
          <div className="decoration-cyber__bracket top-right" />
          <div className="decoration-cyber__bracket bottom-left" />
          <div className="decoration-cyber__bracket bottom-right" />
          <div className="decoration-cyber__glitch-ring" />
          <span className="decoration-cyber__dot d1" />
          <span className="decoration-cyber__dot d2" />
        </div>
      )}

      {decorationId === "celestial-stardust" && (
        <div className="decoration-celestial">
          <div className="decoration-celestial__ring" />
          <svg viewBox="0 0 120 120" className="decoration-celestial__stars" fill="none">
            {/* 4-point Diamond Star top-right */}
            <path
              d="M92 24 L94 30 L100 32 L94 34 L92 40 L90 34 L84 32 L90 30 Z"
              fill="#ffffff"
            />
            {/* Small diamond bottom-left */}
            <path
              d="M26 88 L27 92 L31 93 L27 94 L26 98 L25 94 L21 93 L25 92 Z"
              fill="#e9d5ff"
            />
            {/* Sparkle top-left */}
            <circle cx="34" cy="28" r="2" fill="#c084fc" />
            <circle cx="98" cy="84" r="2.5" fill="#fbcfe8" />
          </svg>
        </div>
      )}

      {decorationId === "mystic-flame" && (
        <div className="decoration-mystic">
          <div className="decoration-mystic__aura" />
          <svg viewBox="0 0 120 120" className="decoration-mystic__wisps" fill="none">
            <path
              d="M48 20 C52 14 62 10 60 4 C56 12 44 14 48 20 Z"
              fill="url(#mystic-grad-1)"
              opacity="0.85"
            />
            <path
              d="M68 22 C74 16 82 14 78 6 C76 14 66 16 68 22 Z"
              fill="url(#mystic-grad-2)"
              opacity="0.9"
            />
            <defs>
              <linearGradient id="mystic-grad-1" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
              <linearGradient id="mystic-grad-2" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}

      {decorationId === "emerald-bloom" && (
        <div className="decoration-emerald">
          <div className="decoration-emerald__wreath">
            <svg viewBox="0 0 120 120" className="decoration-emerald__svg" fill="none">
              <path
                d="M58 8 C62 4 70 8 68 14 C62 14 58 10 58 8 Z"
                fill="#34d399"
                opacity="0.9"
              />
              <path
                d="M106 48 C112 50 114 58 108 62 C106 56 104 50 106 48 Z"
                fill="#10b981"
                opacity="0.9"
              />
              <path
                d="M72 110 C70 116 62 114 60 108 C64 106 70 108 72 110 Z"
                fill="#34d399"
                opacity="0.85"
              />
              <path
                d="M12 56 C8 52 10 44 16 44 C16 50 14 54 12 56 Z"
                fill="#6ee7b7"
                opacity="0.9"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
