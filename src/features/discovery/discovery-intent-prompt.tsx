import { Compass, Filter, X } from "lucide-react";

const categoryLabels: Record<string, string> = {
  trace: "Trace",
  cafe: "Cafe",
  dining: "Dining",
  activities: "Activities",
  play: "Aevo Play",
};

const vibeLabels: Record<string, string> = {
  "slow-bar": "Slow Bar",
  quiet: "Quiet Space",
  art: "Art & Gallery",
  work: "Work-friendly",
  speakeasy: "Speakeasy",
  match: "Taste match",
};

export function DiscoveryIntentPrompt({
  area,
  vibe,
  category,
  date,
  partySize,
  onClear,
}: {
  area: string;
  vibe: string;
  category: string;
  date: string;
  partySize: string;
  onClear: () => void;
}) {
  const labels = [
    area ? `พื้นที่: ${area}` : null,
    vibe ? `บรรยากาศ: ${vibeLabels[vibe] ?? vibe}` : null,
    category && category !== "all" ? `หมวด: ${categoryLabels[category] ?? category}` : null,
    date ? `วันที่: ${date}` : null,
    partySize && partySize !== "2" ? `${partySize} คน` : null,
  ].filter((label): label is string => label !== null);

  return (
    <section className="discovery-intent-prompt" aria-labelledby="discovery-intent-title">
      <div className="discovery-intent-prompt__icon" aria-hidden="true">
        <Compass size={18} />
      </div>
      <div className="discovery-intent-prompt__copy">
        <p className="eyebrow"><Filter size={12} aria-hidden="true" /> DISCOVER BY INTENT</p>
        <h3 id="discovery-intent-title">ตั้งโจทย์ให้คำแนะนำวันนี้</h3>
        <p>
          เลือกพื้นที่ บรรยากาศ หรือวันเดินทางจากด้านบน ระบบจะใช้เป็นบริบทของคำขอนี้เท่านั้น
        </p>
        {labels.length > 0 ? (
          <div className="discovery-intent-prompt__tags" aria-label="โจทย์ที่กำลังใช้">
            {labels.map((label) => <span key={label}>{label}</span>)}
          </div>
        ) : (
          <span className="discovery-intent-prompt__empty">ยังไม่ได้ตั้งตัวกรองเพิ่มเติม · กำลังใช้ deterministic discovery</span>
        )}
      </div>
      {labels.length > 0 && (
        <button
          className="icon-button icon-button--subtle"
          type="button"
          aria-label="ล้างโจทย์การค้นพบ"
          onClick={onClear}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
