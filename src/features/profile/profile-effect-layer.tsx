import type { ProfileEffectId } from "./profile-customization-types";

interface ProfileEffectLayerProps {
  effectId: ProfileEffectId;
  className?: string;
}

export function ProfileEffectLayer({
  effectId,
  className = "",
}: ProfileEffectLayerProps) {
  if (effectId === "none") {
    return null;
  }

  return (
    <div
      className={`profile-effect-container profile-effect--${effectId} ${className}`}
      aria-hidden="true"
    >
      {effectId === "prismatic-sheen" && (
        <div className="effect-prismatic-sheen">
          <div className="effect-prismatic-sheen__beam" />
          <div className="effect-prismatic-sheen__refraction" />
        </div>
      )}

      {effectId === "sakura-breeze" && (
        <div className="effect-sakura-breeze">
          <span className="effect-petal petal-1" />
          <span className="effect-petal petal-2" />
          <span className="effect-petal petal-3" />
          <span className="effect-petal petal-4" />
          <span className="effect-petal petal-5" />
          <span className="effect-petal petal-6" />
        </div>
      )}

      {effectId === "cyber-scan" && (
        <div className="effect-cyber-scan">
          <div className="effect-cyber-scan__line" />
          <div className="effect-cyber-scan__grid" />
          <span className="effect-cyber-node node-1" />
          <span className="effect-cyber-node node-2" />
          <span className="effect-cyber-node node-3" />
        </div>
      )}

      {effectId === "cosmic-drift" && (
        <div className="effect-cosmic-drift">
          <div className="effect-cosmic-drift__nebula" />
          <span className="effect-star star-1" />
          <span className="effect-star star-2" />
          <span className="effect-star star-3" />
          <span className="effect-star star-4" />
          <span className="effect-star star-5" />
        </div>
      )}

      {effectId === "champagne-sparkle" && (
        <div className="effect-champagne-sparkle">
          <span className="effect-glitter glitter-1" />
          <span className="effect-glitter glitter-2" />
          <span className="effect-glitter glitter-3" />
          <span className="effect-glitter glitter-4" />
          <span className="effect-glitter glitter-5" />
        </div>
      )}
    </div>
  );
}
