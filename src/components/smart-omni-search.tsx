import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  Award,
  Clock,
  Coffee,
  Compass,
  Footprints,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Sparkles,
  Utensils,
  Wine,
  X,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { SearchTraceResponse, TraceWaypoint } from "../contracts/search";
import {
  getCurrentTimeSlot,
  searchSmartTrace,
  swapTraceWaypoint,
  reorderTraceWaypoints,
} from "../lib/search-trace-service";

interface SmartOmniSearchProps {
  onClose?: () => void;
  isOpen?: boolean;
}

export function SmartOmniSearch({ onClose, isOpen = true }: SmartOmniSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeTrace, setActiveTrace] = useState<SearchTraceResponse | null>(null);
  const [swapFeedback, setSwapFeedback] = useState<string | null>(null);

  const currentSlot = useMemo(() => getCurrentTimeSlot(), []);

  // Quick preset user location (BTS Ari default)
  const defaultLocation = useMemo(
    () => ({ lat: 13.7797, lng: 100.5447, accuracy_meters: 10 }),
    []
  );

  useEffect(() => {
    if (isOpen) {
      const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
  }, [isOpen]);

  // Debounced Intent Search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setActiveTrace(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await searchSmartTrace({
          query: trimmed,
          user_location: defaultLocation,
        });
        setActiveTrace(result);
      } catch (err) {
        console.error("Search trace error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query, defaultLocation]);

  const handleSelectPrompt = (promptText: string) => {
    setQuery(promptText);
    inputRef.current?.focus();
  };

  const handleAroundMe = () => {
    const prompt = "รอบตัวฉันตอนนี้ ในระยะ 500ม. คาเฟ่และร้านอาหารจานด่วน";
    setQuery(prompt);
  };

  const handleSwapNode = (index: number) => {
    if (!activeTrace) return;
    const currentWaypoint = activeTrace.waypoints[index];
    const updated = swapTraceWaypoint(activeTrace, index);
    setActiveTrace(updated);
    setSwapFeedback(
      `สลับเป็น ${updated.waypoints[index].name} (แทน ${currentWaypoint.name})`
    );
    window.setTimeout(() => setSwapFeedback(null), 3000);
  };

  const handleReorder = () => {
    if (!activeTrace || activeTrace.waypoints.length < 2) return;
    const updated = reorderTraceWaypoints(activeTrace, 0, 1);
    setActiveTrace(updated);
    setSwapFeedback("สลับลำดับการเดินทางแล้ว");
    window.setTimeout(() => setSwapFeedback(null), 2500);
  };

  const handleStartWalk = (trace: SearchTraceResponse) => {
    if (onClose) onClose();
    // Navigate to map view with active trace projection
    navigate(
      `/map?mode=traces&trace_id=${encodeURIComponent(trace.trace_id)}&title=${encodeURIComponent(trace.title)}`
    );
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (onClose) onClose();
    }
  };

  return (
    <div
      className="smart-omni-search-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <section
        className="smart-omni-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Smart Spatial Search Bar"
      >
        {/* Search Bar Input Area */}
        <div className="smart-omni-input-wrapper">
          <div className="smart-omni-input-icon">
            {isSearching ? (
              <RefreshCw size={19} className="smart-omni-spinner" aria-hidden="true" />
            ) : (
              <Search size={19} aria-hidden="true" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            className="smart-omni-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ค้นหาเส้นทาง เช่น 'หาร้านกาแฟเงียบๆ ไว้นั่งทำงาน แล้วต่อด้วยมื้อเที่ยงแถวอารีย์'..."
            aria-label="ช่องค้นหาเส้นทางแบบชาญฉลาด"
            autoComplete="off"
            spellCheck="false"
          />
          {query ? (
            <button
              type="button"
              className="smart-omni-btn-clear"
              aria-label="ล้างคำค้นหา"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              className="smart-omni-btn-close"
              aria-label="ปิดหน้าต่างค้นหา"
              onClick={onClose}
            >
              <kbd>Esc</kbd>
            </button>
          ) : null}
        </div>

        {/* Feedback Alert for Node Swapping / Reorder */}
        {swapFeedback && (
          <div className="smart-omni-toast" role="status">
            <Sparkles size={14} className="text-sky-200" aria-hidden="true" />
            <span>{swapFeedback}</span>
          </div>
        )}

        <div className="smart-omni-scrollable-content">
          {/* =========================================================================
              ZERO-STATE: เมื่อยังไม่ได้พิมพ์คำค้นหา (ฉาย Contextual Prompts ตามช่วงเวลา)
             ========================================================================= */}
          {!query.trim() && (
            <div className="smart-omni-zero-state">
              {/* Quick Around Me Button */}
              <div className="smart-omni-around-me-row">
                <button
                  type="button"
                  className="smart-omni-around-me-btn"
                  onClick={handleAroundMe}
                >
                  <div className="smart-omni-around-me-lead">
                    <Compass size={17} className="text-sky-200" aria-hidden="true" />
                    <strong>รอบตัวฉันตอนนี้</strong>
                  </div>
                  <span className="smart-omni-badge-walk">
                    <Footprints size={13} aria-hidden="true" />
                    รัศมี 500 ม. · เดิน 5-7 นาที
                  </span>
                </button>
              </div>

              {/* Time-of-Day Contextual Slot Nudge */}
              <div className="smart-omni-section">
                <div className="smart-omni-section-title">
                  <div className="smart-omni-slot-badge">
                    {currentSlot.slot_id === "morning_rush" && <Coffee size={14} />}
                    {currentSlot.slot_id === "lunch_dining" && <Utensils size={14} />}
                    {currentSlot.slot_id === "afternoon_focus" && <Sparkles size={14} />}
                    {currentSlot.slot_id === "nightlife_hop" && <Wine size={14} />}
                    <span>{currentSlot.label} ({currentSlot.time_range})</span>
                  </div>
                  <span className="smart-omni-slot-hint">ซิงก์จาก Aevo Control</span>
                </div>

                <div className="smart-omni-prompt-list">
                  {currentSlot.recommended_prompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="smart-omni-prompt-chip"
                      onClick={() => handleSelectPrompt(prompt)}
                    >
                      <Sparkles size={14} className="text-amber-200 shrink-0" aria-hidden="true" />
                      <span>{prompt}</span>
                      <ArrowRight size={13} className="text-zinc-500 ml-auto" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Curated Traces Fast Shortcuts */}
              <div className="smart-omni-section">
                <span className="smart-omni-section-heading">เส้นทางยอดนิยมพร้อมสิทธิพิเศษ Aevo</span>
                <div className="smart-omni-curated-chips">
                  <button
                    type="button"
                    className="smart-omni-curated-tag"
                    onClick={() => handleSelectPrompt("กาแฟ Slow bar เงียบสงบ อารีย์ ต่อมื้อเที่ยง")}
                  >
                    <Coffee size={13} aria-hidden="true" />
                    Ari Slow Work Trace
                  </button>
                  <button
                    type="button"
                    className="smart-omni-curated-tag"
                    onClick={() => handleSelectPrompt("คราฟต์เบียร์บาร์ และไวน์บาร์ไฟสลัว ทองหล่อ")}
                  >
                    <Wine size={13} aria-hidden="true" />
                    Thonglor Evening Hop
                  </button>
                  <button
                    type="button"
                    className="smart-omni-curated-tag"
                    onClick={() => handleSelectPrompt("กาแฟคั่ว เจริญกรุง ตลาดน้อย เดินชมอาร์ต")}
                  >
                    <Compass size={13} aria-hidden="true" />
                    Talat Noi Art Walk
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              ACTIVE-STATE: เมื่อพิมพ์คำค้นหา (แสดง Trace Route Card สำเร็จรูป + Waypoint Projection)
             ========================================================================= */}
          {query.trim() && activeTrace && (
            <div className="smart-omni-active-state">
              {/* Direct Synthesized Trace Route Card */}
              <div className="smart-omni-trace-card">
                <div className="smart-omni-trace-card-header">
                  <div>
                    <span className="smart-omni-trace-type-badge">
                      <Navigation size={12} aria-hidden="true" />
                      TRACE ROUTE BUNDLE
                    </span>
                    <h3 className="smart-omni-trace-title">{activeTrace.title}</h3>
                    <p className="smart-omni-trace-summary">{activeTrace.summary}</p>
                  </div>
                </div>

                {/* Trace Metrics Summary */}
                <div className="smart-omni-trace-metrics">
                  <div className="smart-omni-metric-item">
                    <MapPin size={14} className="text-sky-200" aria-hidden="true" />
                    <span>{activeTrace.waypoints.length} จุดแวะ</span>
                  </div>
                  <div className="smart-omni-metric-dot" />
                  <div className="smart-omni-metric-item">
                    <Footprints size={14} className="text-blue-400" aria-hidden="true" />
                    <span>{activeTrace.total_distance_meters} ม.</span>
                  </div>
                  <div className="smart-omni-metric-dot" />
                  <div className="smart-omni-metric-item">
                    <Clock size={14} className="text-amber-400" aria-hidden="true" />
                    <span>เดินรวม ~{activeTrace.estimated_walking_mins} นาที</span>
                  </div>
                </div>

                {/* Parsed Multi-Dimensional Intent Pill Bar */}
                {activeTrace.parsed_intent && (
                  <div className="smart-omni-intent-pills">
                    <span className="smart-omni-intent-label">Vibe & Constraints:</span>
                    {activeTrace.parsed_intent.mood_atmosphere.map((tag) => (
                      <span key={tag} className="smart-omni-vibe-pill">
                        #{tag}
                      </span>
                    ))}
                    <span className="smart-omni-spatio-pill">
                      {activeTrace.parsed_intent.spatio_temporal}
                    </span>
                  </div>
                )}

                {/* Fluid Timeline Pathway (Map-less Spatial Sequence) */}
                <div className="smart-omni-timeline">
                  {/* Starting Node: User GPS */}
                  <div className="smart-omni-timeline-node smart-omni-timeline-start">
                    <div className="smart-omni-node-marker smart-omni-node-start">
                      <MapPin size={13} aria-hidden="true" />
                    </div>
                    <div className="smart-omni-node-body">
                      <strong>จุดเริ่มต้น: พิกัดรอบตัวคุณ (BTS อารีย์)</strong>
                      <small>เริ่มก้าวเดินจากจุดปัจจุบัน</small>
                    </div>
                  </div>

                  {/* Sequential Waypoints */}
                  {activeTrace.waypoints.map((wp: TraceWaypoint, idx: number) => (
                    <div key={wp.place_id || idx} className="smart-omni-node-group">
                      {/* Hop Badge connecting previous node */}
                      <div className="smart-omni-hop-connector">
                        <div className="smart-omni-hop-line" />
                        <span className="smart-omni-hop-badge">
                          <Footprints size={11} aria-hidden="true" />
                          เดิน {idx === 0 ? "350 ม. · 4 นาที" : `${wp.walk_to_next ? wp.walk_to_next.distance_meters : 450} ม. · ${wp.walk_to_next ? wp.walk_to_next.mins : 6} นาที`}
                        </span>
                        <div className="smart-omni-hop-line" />
                      </div>

                      {/* Waypoint Card */}
                      <div className="smart-omni-timeline-node">
                        <div className="smart-omni-node-marker">
                          <span>{wp.step}</span>
                        </div>
                        <div className="smart-omni-waypoint-card">
                          <div className="smart-omni-waypoint-main">
                            <div className="smart-omni-waypoint-info">
                              <div className="smart-omni-waypoint-title-row">
                                <h4 className="smart-omni-waypoint-name">{wp.name}</h4>
                                <span className="smart-omni-category-tag">{wp.category}</span>
                              </div>
                              <div className="smart-omni-vibe-matches">
                                {wp.vibe_matches.map((vibe) => (
                                  <span key={vibe} className="smart-omni-vibe-match">
                                    ✓ {vibe}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Node Actions: Swap Button */}
                            <button
                              type="button"
                              className="smart-omni-action-btn"
                              title="สุ่มเปลี่ยนจุดนี้เป็นร้านอื่นที่เข้ากัน"
                              aria-label={`สุ่มเปลี่ยนจุดที่ ${wp.step}: ${wp.name}`}
                              onClick={() => handleSwapNode(idx)}
                            >
                              <RefreshCw size={13} aria-hidden="true" />
                              <span>สลับร้านนี้</span>
                            </button>
                          </div>

                          {/* Privilege / Perk Badge */}
                          {wp.aevo_perk && (
                            <div className="smart-omni-perk-row">
                              <span
                                className={`smart-omni-perk-badge smart-omni-perk--${wp.aevo_perk.type}`}
                              >
                                {wp.aevo_perk.type === "fast_pass" ? (
                                  <Zap size={12} aria-hidden="true" />
                                ) : (
                                  <Award size={12} aria-hidden="true" />
                                )}
                                {wp.aevo_perk.label}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Route Controls: Reorder & Start Walk */}
                <div className="smart-omni-controls-bar">
                  <button
                    type="button"
                    className="smart-omni-btn-secondary"
                    onClick={handleReorder}
                  >
                    <ArrowUpDown size={14} aria-hidden="true" />
                    <span>สลับลำดับการเดิน</span>
                  </button>

                  <button
                    type="button"
                    className="smart-omni-btn-primary"
                    onClick={() => handleStartWalk(activeTrace)}
                  >
                    <Navigation size={15} aria-hidden="true" />
                    <span>เริ่มเดินจริงบน Trace Map</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Keyboard Footer */}
        <footer className="smart-omni-footer">
          <div className="smart-omni-footer-hints">
            <span><kbd>Enter</kbd> เลือก</span>
            <span><kbd>Esc</kbd> ปิด</span>
          </div>
          <span className="smart-omni-footer-brand">Aevocado GO · Spatial Engine</span>
        </footer>
      </section>
    </div>
  );
}
