import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, Ban, Check, Clock3, CopyPlus, Flag, GitBranch, Heart, MapPin, MessageCircle, PanelRightOpen, Plus, Route, Save, Search, Send, Star, ThumbsUp, Trash2, Upload, UserRound, VolumeX, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api-client";
import { applyTraceDeeJourneyAction, applyTraceDeeTraceAction, createTraceDeeComment, createTraceDeeJourney, createTraceDeePost, createTraceDeeRemix, deleteTraceDeeContent, editTraceDeeContent, getTraceDeeComments, getTraceDeeJourneyForTrace, getTraceDeePosts, getTraceDeeRemixDraft, getTraceDeeTrace, getTraceDeeTraceLineage, publishTraceDeeRemix, rateTraceDeeJourney, reportTraceDeeContent, searchTraceDeePlaces, setTraceDeeCommentHelpful, setTraceDeeTracerFollow, setTraceDeeUserRelation, updateTraceDeeJourneyStop, updateTraceDeeRemix } from "@/lib/customer-api";
import { SpatialDockedLayout, SpatialDockedSidePanel } from "@/components/spatial-docked-side-panel";
import { createIdempotencyKey } from "@/lib/idempotency";
import { customerDataMode, placeApiMode } from "@/lib/env";
import { getCustomerSession } from "@/lib/session";
import { beginGoSignIn } from "@/lib/sso";
import { canonicalPlaceIdSchema } from "@/contracts/place";
import type { TraceDeeComment, TraceDeeJourneyCompletionVerification, TraceDeeJourneyDetail, TraceDeePostResponse, TraceDeeRatingResponse, TraceDeeRemixDraft, TraceDeeTraceAction, TraceDeeTraceDetail } from "@/contracts/tracedee";

const traceDeeRatingTags = [
  { value: "worth_it", label: "คุ้มที่จะไป" },
  { value: "good_pacing", label: "จังหวะดี" },
  { value: "hidden_gem", label: "hidden gem" }
] as const;

function RatingStars({ value }: { value: number }) {
  return <span className="tracedee-rating-stars" aria-label={`${value} จาก 5 ดาว`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} fill={star <= value ? "currentColor" : "none"} aria-hidden="true" />)}</span>;
}

function formatBudget(minor: number | null): string {
  if (minor === null) return "งบประมาณยืดหยุ่น";
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(minor / 100);
}

function tracePlaceMapHref(place: TraceDeeTraceDetail["stops"][number]["place"]): string {
  const reference = place.placeReference;
  const canonicalPlaceId =
    reference && (reference.resolutionStatus === "resolved" || reference.resolutionStatus === "redirected")
      ? canonicalPlaceIdSchema.safeParse(reference.canonicalPlaceId)
      : null;
  const selected = placeApiMode === "canonical" && canonicalPlaceId?.success
    ? canonicalPlaceId.data
    : place.slug;
  return `/map?mode=places&selected=${encodeURIComponent(selected)}`;
}

async function readOptionalCompletionEvidence(
  journey: TraceDeeJourneyDetail,
  useCoarseLocation: boolean
): Promise<TraceDeeJourneyCompletionVerification> {
  const verification: TraceDeeJourneyCompletionVerification = {};
  if (journey.startedAt) {
    verification.clientStartedAt = journey.startedAt;
    verification.clientCompletedAt = new Date().toISOString();
  }
  if (!useCoarseLocation || typeof navigator === "undefined" || !navigator.geolocation) {
    return verification;
  }
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 2_500
      });
    });
    verification.locationPermission = true;
    verification.coarseLatitude = Number(position.coords.latitude.toFixed(2));
    verification.coarseLongitude = Number(position.coords.longitude.toFixed(2));
  } catch {
    verification.locationPermission = false;
  }
  return verification;
}

function ActionButton({
  action,
  active,
  pending,
  onClick
}: {
  action: "save" | "follow";
  active: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const isSave = action === "save";
  return (
    <button className={`button ${active ? "button--dark" : "button--ghost"}`} type="button" aria-pressed={active} disabled={pending} onClick={onClick}>
      {isSave ? <Heart size={16} fill={active ? "currentColor" : "none"} aria-hidden="true" /> : <Route size={16} aria-hidden="true" />}
      {pending ? "กำลังบันทึก…" : active ? (isSave ? "บันทึกแล้ว" : "กำลังติดตาม") : (isSave ? "Save Trace" : "Follow Trace")}
    </button>
  );
}

type SpatialTraceTab = "stops" | "comments";

const spatialTraceTabs = [
  { id: "stops", label: "Stops Timeline" },
  { id: "comments", label: "ความคิดเห็น" }
] as const;

function TraceDockStops({ trace }: { trace: TraceDeeTraceDetail }) {
  return (
    <div className="spatial-stops-panel">
      <div className="spatial-stops-panel__intro">
        <p className="eyebrow">JOURNEY / STOPS</p>
        <h3>จุดแวะใน Trace นี้</h3>
        <p>เลื่อนอ่านรายละเอียดแต่ละจุดได้โดยไม่กระทบพื้นที่คอนเทนต์หลัก</p>
      </div>
      <ol className="spatial-stop-timeline">
        {trace.stops.map((stop) => (
          <li className="spatial-stop" key={stop.id}>
            <div className="spatial-stop__rail" aria-hidden="true">
              <span>{stop.position + 1}</span>
            </div>
            <div className="spatial-stop__body">
              <div className="spatial-stop__media" aria-hidden="true">
                {stop.place.imageUrl ? (
                  <img src={stop.place.imageUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span>{stop.place.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="spatial-stop__copy">
                <div className="spatial-stop__heading">
                  <div>
                    <h4>{stop.place.name}</h4>
                    <p>{stop.place.category} · {stop.place.area}</p>
                  </div>
                  <span className="spatial-stop__duration">
                    <Clock3 size={13} aria-hidden="true" />
                    {stop.durationMinutes ? `${stop.durationMinutes} นาที` : "ยืดหยุ่น"}
                  </span>
                </div>
                <p className="spatial-stop__note">{stop.note || stop.place.description || "จุดแวะใน Trace นี้"}</p>
                <Link className="button button--ghost button--small" to={tracePlaceMapHref(stop.place)}>
                  <MapPin size={14} aria-hidden="true" />ดูบนแผนที่
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TraceMediaStage({
  trace,
  onOpenPanel,
  panelOpen,
  activeTab
}: {
  trace: TraceDeeTraceDetail;
  onOpenPanel: (tab: SpatialTraceTab) => void;
  panelOpen: boolean;
  activeTab: SpatialTraceTab;
}) {
  const mediaUrl = trace.stops.find((stop) => stop.place.imageUrl)?.place.imageUrl ?? null;
  return (
    <div className="spatial-media-stage" aria-label={`คอนเทนต์ของ Trace ${trace.title}`}>
      {mediaUrl ? (
        <img className="spatial-media-stage__image" src={mediaUrl} alt={`ภาพประกอบ ${trace.title}`} />
      ) : (
        <div className="spatial-media-stage__fallback" aria-label="ยังไม่มี media projection">
          <Route size={42} aria-hidden="true" />
          <strong>TRACE / {trace.area || "DISCOVERY"}</strong>
          <span>media projection ยังไม่พร้อม</span>
        </div>
      )}
      <div className="spatial-media-stage__topline">
        <span className="spatial-media-stage__badge">{trace.area || "DISCOVERY"}</span>
        <span className="spatial-media-stage__count">{trace.stopCount} stops</span>
      </div>
      <div className="spatial-media-stage__bottomline">
        <span className="muted-label">ภาพจาก public place projection · ไม่มีการสร้าง media ปลอม</span>
        <div className="spatial-media-stage__actions">
          <button className="button button--ghost button--small" type="button" aria-expanded={panelOpen && activeTab === "stops"} onClick={() => onOpenPanel("stops")}>
            <PanelRightOpen size={14} aria-hidden="true" />ดู Stops
          </button>
          <button className="button button--ghost button--small" type="button" aria-expanded={panelOpen && activeTab === "comments"} onClick={() => onOpenPanel("comments")}>
            <MessageCircle size={14} aria-hidden="true" />ความคิดเห็น
          </button>
        </div>
      </div>
    </div>
  );
}

function TraceSpatialContentCard({
  trace,
  panelOpen,
  activeTab,
  onTogglePanel,
  setDetail
}: {
  trace: TraceDeeTraceDetail;
  panelOpen: boolean;
  activeTab: SpatialTraceTab;
  onTogglePanel: (tab: SpatialTraceTab) => void;
  setDetail: (next: TraceDeeTraceDetail) => void;
}) {
  return (
    <article className="spatial-content-card">
      <TraceMediaStage trace={trace} onOpenPanel={onTogglePanel} panelOpen={panelOpen} activeTab={activeTab} />
      <div className="spatial-content-card__body">
        <div className="spatial-content-card__eyebrow">
          <span className="eyebrow">TRACE / {trace.area || "DISCOVERY"}</span>
          <span className="muted-label">revision {trace.revision}</span>
        </div>
        <h1>{trace.title}</h1>
        <p className="spatial-content-card__description">{trace.description || "เส้นทางที่สร้างขึ้นเพื่อให้คุณได้ลองสัมผัสเมืองในจังหวะของตัวเอง"}</p>
        <div className="spatial-content-card__creator"><UserRound size={15} aria-hidden="true" /><span>โดย {trace.creatorName}</span><span>· {trace.stopCount} จุดแวะ</span></div>
        <section className="spatial-content-card__stats" aria-label="ข้อมูล Trace">
          <div><Clock3 size={16} aria-hidden="true" /><span>เวลา<strong>{trace.estimatedMinutes ? `${trace.estimatedMinutes} นาที` : "ยืดหยุ่น"}</strong></span></div>
          <div><MapPin size={16} aria-hidden="true" /><span>พื้นที่<strong>{trace.area || "ดูจากจุดแวะ"}</strong></span></div>
          <div><Heart size={16} aria-hidden="true" /><span>การตอบรับ<strong>{trace.saveCount} saves</strong></span></div>
          <div><Route size={16} aria-hidden="true" /><span>งบโดยประมาณ<strong>{formatBudget(trace.estimatedBudgetMinor)}</strong></span></div>
        </section>
        <DetailState detail={trace} setDetail={setDetail} />
        <div className="spatial-content-card__panel-actions" aria-label="เปิดแผงข้อมูล">
          <button className={`button ${panelOpen && activeTab === "stops" ? "button--dark" : "button--ghost"}`} type="button" aria-expanded={panelOpen && activeTab === "stops"} onClick={() => onTogglePanel("stops")}>
            <Route size={15} aria-hidden="true" />{panelOpen && activeTab === "stops" ? "ซ่อน Stops" : "ดู Stops Timeline"}
          </button>
          <button className={`button ${panelOpen && activeTab === "comments" ? "button--dark" : "button--ghost"}`} type="button" aria-expanded={panelOpen && activeTab === "comments"} onClick={() => onTogglePanel("comments")}>
            <MessageCircle size={15} aria-hidden="true" />{panelOpen && activeTab === "comments" ? "ซ่อนความคิดเห็น" : "เปิดความคิดเห็น"}
          </button>
        </div>
      </div>
    </article>
  );
}

function TraceSpatialPanel({
  trace,
  isOpen,
  activeTab,
  onTabChange,
  onClose
}: {
  trace: TraceDeeTraceDetail;
  isOpen: boolean;
  activeTab: SpatialTraceTab;
  onTabChange: (tab: SpatialTraceTab) => void;
  onClose: () => void;
}) {
  return (
    <SpatialDockedSidePanel
      isOpen={isOpen}
      activeTab={activeTab}
      tabs={spatialTraceTabs}
      title={trace.title}
      eyebrow={`TRACE / ${trace.area || "DISCOVERY"}`}
      onTabChange={(tab) => onTabChange(tab as SpatialTraceTab)}
      onClose={onClose}
      footer={activeTab === "stops" ? (
        <Link className="button button--dark" to="#tracedee-journey">
          <Route size={15} aria-hidden="true" />เปิด Journey
        </Link>
      ) : (
        <span className="muted-label">ความคิดเห็นจาก Journey จริงจะถูกตรวจสอบตาม community policy</span>
      )}
    >
      {activeTab === "stops" ? <TraceDockStops trace={trace} /> : <CommunityPanel trace={trace} docked />}
    </SpatialDockedSidePanel>
  );
}

function DetailState({ detail, setDetail }: { detail: TraceDeeTraceDetail; setDetail: (next: TraceDeeTraceDetail) => void }) {
  const { traceSlug } = useParams();
  const navigate = useNavigate();
  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session", "tracedee-detail"],
    queryFn: getCustomerSession,
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 60_000
  });
  const [pending, setPending] = useState<"save" | "follow" | "tracer" | null>(null);
  const [notice, setNotice] = useState("");
  const runAction = async (action: TraceDeeTraceAction) => {
    if (!sessionQuery.data) {
      try {
        await beginGoSignIn(`/traces/${traceSlug ?? detail.slug}`);
      } catch {
        setNotice("ยังไม่สามารถเริ่มการเข้าสู่ระบบได้ กรุณาลองใหม่");
      }
      return;
    }
    setPending(action === "save" || action === "unsave" ? "save" : "follow");
    setNotice("");
    try {
      const response = await applyTraceDeeTraceAction(detail.slug, action, createIdempotencyKey(`tracedee-${action}`));
      setDetail({ ...detail, saved: response.state.saved, followed: response.state.followed });
      setNotice(response.state.changed ? "อัปเดต Trace แล้ว" : "สถานะ Trace เป็นปัจจุบันอยู่แล้ว");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setNotice("session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
      } else {
        setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถอัปเดต Trace ได้");
      }
    } finally {
      setPending(null);
    }
  };

  const toggleTracerFollow = async () => {
    if (!sessionQuery.data) {
      try {
        await beginGoSignIn(`/traces/${traceSlug ?? detail.slug}`);
      } catch {
        setNotice("ยังไม่สามารถเริ่มการเข้าสู่ระบบได้ กรุณาลองใหม่");
      }
      return;
    }
    setPending("tracer");
    setNotice("");
    try {
      const response = await setTraceDeeTracerFollow(detail.creatorId, !detail.tracerFollowing, createIdempotencyKey("tracedee-tracer-follow"));
      setDetail({ ...detail, tracerFollowing: response.follow.following, tracerFollowerCount: response.follow.followerCount });
      setNotice(response.follow.changed ? (response.follow.following ? "ติดตามผู้สร้างแล้ว" : "เลิกติดตามผู้สร้างแล้ว") : "สถานะผู้สร้างเป็นปัจจุบันอยู่แล้ว");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setNotice("session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
      } else {
        setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถอัปเดตการติดตามผู้สร้างได้");
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className="tracedee-detail__actions">
        <ActionButton action="save" active={detail.saved} pending={pending === "save"} onClick={() => void runAction(detail.saved ? "unsave" : "save")} />
        <ActionButton action="follow" active={detail.followed} pending={pending === "follow"} onClick={() => void runAction(detail.followed ? "unfollow" : "follow")} />
        <button className={`button ${detail.tracerFollowing ? "button--dark" : "button--ghost"}`} type="button" aria-pressed={detail.tracerFollowing} disabled={pending !== null} onClick={() => void toggleTracerFollow()}><UserRound size={16} aria-hidden="true" />{pending === "tracer" ? "กำลังบันทึก…" : detail.tracerFollowing ? "ติดตามผู้สร้างแล้ว" : "ติดตามผู้สร้าง"} · {detail.tracerFollowerCount}</button>
        <button className="button button--ghost" type="button" onClick={() => navigate("/traces")}>กลับ Feed</button>
      </div>
      {notice && <p className="inline-notice" role="status">{notice}</p>}
    </>
  );
}

function RemixPanel({ trace }: { trace: TraceDeeTraceDetail }) {
  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session", "tracedee-remix"],
    queryFn: getCustomerSession,
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 60_000
  });
  const lineageQuery = useQuery({
    queryKey: ["tracedee-lineage", trace.itemId],
    queryFn: ({ signal }) => getTraceDeeTraceLineage(trace.slug, { signal }),
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 30_000
  });
  const [draft, setDraft] = useState<TraceDeeRemixDraft | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [pending, setPending] = useState<"create" | "save" | "publish" | null>(null);
  const [notice, setNotice] = useState("");
  const placeSearchQuery = useQuery({
    queryKey: ["tracedee-place-search", placeQuery],
    queryFn: ({ signal }) => searchTraceDeePlaces(placeQuery, { signal }),
    enabled: Boolean(draft && placeQuery.trim().length >= 2),
    staleTime: 30_000,
    retry: false
  });

  const requireSignIn = async () => {
    try {
      await beginGoSignIn(`/traces/${trace.slug}`);
    } catch {
      setNotice("ยังไม่สามารถเริ่มการเข้าสู่ระบบได้ กรุณาลองใหม่");
    }
  };

  const loadDraft = async (traceId: string): Promise<void> => {
    const nextDraft = await getTraceDeeRemixDraft(traceId);
    setDraft(nextDraft);
    setDraftDirty(false);
  };

  const createRemix = async () => {
    if (!sessionQuery.data) {
      await requireSignIn();
      return;
    }
    setPending("create");
    setNotice("");
    try {
      const response = await createTraceDeeRemix(
        trace.slug,
        { title: `${trace.title} — remix`, description: trace.description },
        createIdempotencyKey("tracedee-remix-create")
      );
      await loadDraft(response.remix.remixTraceId);
      setNotice("สร้าง remix draft แล้ว — clone อย่างเดียวจะยังไม่รับ XP");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถสร้าง remix ได้");
    } finally {
      setPending(null);
    }
  };

  const mutateDraft = (updater: (current: TraceDeeRemixDraft) => TraceDeeRemixDraft): void => {
    setDraft((current) => current ? updater(current) : current);
    setDraftDirty(true);
  };

  const updateStop = (stopId: string, updater: (stop: TraceDeeRemixDraft["stops"][number]) => TraceDeeRemixDraft["stops"][number]): void => {
    mutateDraft((current) => ({
      ...current,
      stops: current.stops.map((stop) => stop.id === stopId ? updater(stop) : stop)
    }));
  };

  const moveStop = (index: number, direction: -1 | 1): void => {
    if (!draft) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.stops.length) return;
    mutateDraft((current) => {
      const stops = [...current.stops];
      const [moved] = stops.splice(index, 1);
      if (!moved) return current;
      stops.splice(nextIndex, 0, moved);
      return { ...current, stops: stops.map((stop, position) => ({ ...stop, position })) };
    });
  };

  const removeStop = (stopId: string): void => {
    mutateDraft((current) => ({
      ...current,
      stops: current.stops.filter((stop) => stop.id !== stopId).map((stop, position) => ({ ...stop, position }))
    }));
  };

  const addPlace = (place: NonNullable<typeof placeSearchQuery.data>[number]): void => {
    if (!draft) return;
    if (draft.stops.some((stop) => stop.place.id === place.id)) {
      setNotice("จุดนี้อยู่ใน draft แล้ว");
      return;
    }
    if (draft.stops.length >= 30) {
      setNotice("Remix หนึ่งรายการมีได้สูงสุด 30 จุดแวะ");
      return;
    }
    mutateDraft((current) => ({
      ...current,
      stops: [...current.stops, {
        id: globalThis.crypto.randomUUID(),
        position: current.stops.length,
        place,
        note: "",
        durationMinutes: 30,
        transportMode: "WALK",
        budgetMinor: null
      }]
    }));
    setPlaceQuery("");
  };

  const saveDraft = async (): Promise<void> => {
    if (!draft) return;
    if (draft.stops.length === 0) {
      setNotice("ต้องมีอย่างน้อย 1 จุดแวะก่อนบันทึก");
      return;
    }
    setPending("save");
    setNotice("");
    try {
      const response = await updateTraceDeeRemix(
        draft.traceId,
        {
          expectedRevision: draft.revision,
          title: draft.title,
          description: draft.description,
          area: draft.area,
          topicTags: draft.topicTags,
          estimatedMinutes: draft.estimatedMinutes ?? undefined,
          estimatedBudgetMinor: draft.estimatedBudgetMinor ?? undefined,
          stops: draft.stops.map((stop) => ({
            placeId: stop.place.id,
            note: stop.note,
            ...(stop.durationMinutes === null ? {} : { durationMinutes: stop.durationMinutes }),
            ...(stop.transportMode ? { transportMode: stop.transportMode } : {}),
            ...(stop.budgetMinor === null ? {} : { budgetMinor: stop.budgetMinor })
          }))
        },
        createIdempotencyKey("tracedee-remix-update")
      );
      await loadDraft(response.remix.traceId);
      setNotice("บันทึก draft แล้ว ตรวจ revision ล่าสุดจากเซิร์ฟเวอร์เรียบร้อย");
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "TRACE_REVISION_CONFLICT") {
        await loadDraft(draft.traceId).catch(() => undefined);
        setNotice("draft ถูกแก้จากที่อื่น จึงโหลด revision ล่าสุดกลับมาให้แล้ว");
      } else {
        setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถบันทึก remix draft ได้");
      }
    } finally {
      setPending(null);
    }
  };

  const publishRemix = async () => {
    if (!draft) return;
    if (draftDirty) {
      setNotice("บันทึกการแก้ไขก่อนเผยแพร่ remix");
      return;
    }
    setPending("publish");
    setNotice("");
    try {
      await publishTraceDeeRemix(draft.traceId, createIdempotencyKey("tracedee-remix-publish"));
      setDraft(null);
      setDraftDirty(false);
      await lineageQuery.refetch();
      setNotice("เผยแพร่ remix แล้ว และบันทึก attribution ให้ผู้สร้างต้นทาง");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถเผยแพร่ remix ได้");
    } finally {
      setPending(null);
    }
  };

  const lineage = lineageQuery.data;
  return (
    <section className="tracedee-remix" aria-labelledby="tracedee-remix-title">
      <div className="section-heading">
        <div><p className="eyebrow">REMIX / LINEAGE</p><h2 id="tracedee-remix-title">ต่อยอด Trace ให้เป็นเวอร์ชันของคุณ</h2></div>
        <GitBranch size={20} aria-hidden="true" />
      </div>
      <p className="body-copy">เริ่มจาก draft ที่ clone จุดแวะเดิมได้ แล้วค่อยปรับ metadata หรือ stops ผ่าน editor ที่รองรับ revision check ก่อน publish</p>
      {lineage && <div className="tracedee-remix__lineage" aria-label="Trace lineage">
        <div className="tracedee-remix__node tracedee-remix__node--current"><strong>{lineage.trace.title}</strong><span>revision {lineage.trace.revision} · depth {lineage.trace.lineageDepth}</span></div>
        {lineage.ancestors.length > 0 && <div className="tracedee-remix__ancestors">ต้นทาง: {lineage.ancestors.map((node) => <Link key={node.id} to={`/traces/${node.slug}`}>{node.title}</Link>)}</div>}
        {lineage.descendants.length > 0 && <div className="tracedee-remix__ancestors">remix ต่อจากนี้: {lineage.descendants.map((node) => <Link key={node.id} to={`/traces/${node.slug}`}>{node.title}</Link>)}</div>}
      </div>}
      {!draft ? <div className="button-row"><button className="button button--ghost" type="button" disabled={pending !== null} onClick={() => void createRemix()}><CopyPlus size={15} aria-hidden="true" />{pending === "create" ? "กำลังสร้าง draft…" : "สร้าง Remix draft"}</button></div> : <div className="tracedee-remix__editor">
        <div className="tracedee-remix__editor-grid">
          <label><span>ชื่อ Remix</span><input value={draft.title} maxLength={180} onChange={(event) => mutateDraft((current) => ({ ...current, title: event.target.value }))} /></label>
          <label><span>พื้นที่</span><input value={draft.area} maxLength={120} onChange={(event) => mutateDraft((current) => ({ ...current, area: event.target.value }))} /></label>
          <label className="tracedee-remix__editor-grid--wide"><span>คำอธิบาย</span><textarea value={draft.description} maxLength={6000} onChange={(event) => mutateDraft((current) => ({ ...current, description: event.target.value }))} /></label>
          <label><span>หัวข้อ (คั่นด้วย comma)</span><input value={draft.topicTags.join(", ")} maxLength={800} onChange={(event) => mutateDraft((current) => ({ ...current, topicTags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 16) }))} /></label>
          <label><span>เวลาโดยประมาณ (นาที)</span><input type="number" min={1} max={10080} value={draft.estimatedMinutes ?? ""} onChange={(event) => mutateDraft((current) => ({ ...current, estimatedMinutes: event.target.value ? Number(event.target.value) : null }))} /></label>
          <label><span>งบประมาณ (สตางค์)</span><input type="number" min={0} value={draft.estimatedBudgetMinor ?? ""} onChange={(event) => mutateDraft((current) => ({ ...current, estimatedBudgetMinor: event.target.value ? Number(event.target.value) : null }))} /></label>
        </div>

        <div className="tracedee-remix__place-picker">
          <div className="section-heading"><div><p className="eyebrow">PLACE PICKER</p><h3>เพิ่มจุดแวะจากพื้นที่จริง</h3></div><MapPin size={18} aria-hidden="true" /></div>
          <label className="tracedee-search"><Search size={15} aria-hidden="true" /><input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="ค้นหาชื่อร้าน พื้นที่ หรือหมวดหมู่" aria-label="ค้นหาจุดแวะ" /><span className="muted-label">{draft.stops.length}/30</span></label>
          {placeQuery.trim().length >= 2 && <div className="tracedee-remix__place-results" aria-live="polite">
            {placeSearchQuery.isFetching && <span className="muted-label">กำลังค้นหาจุดแวะ…</span>}
            {placeSearchQuery.isError && <span className="muted-label">ค้นหาจุดแวะไม่สำเร็จ ลองใหม่อีกครั้ง</span>}
            {placeSearchQuery.data?.map((place) => <button className="tracedee-remix__place-result" type="button" key={place.id} onClick={() => addPlace(place)}><Plus size={14} aria-hidden="true" /><span><strong>{place.name}</strong><small>{place.area} · {place.category}</small></span></button>)}
            {!placeSearchQuery.isFetching && placeSearchQuery.data?.length === 0 && <span className="muted-label">ไม่พบจุดแวะที่เผยแพร่</span>}
          </div>}
        </div>

        <div className="tracedee-remix__stops-editor">
          <div className="section-heading"><div><p className="eyebrow">STOPS / ORDER</p><h3>จัดลำดับและรายละเอียดแต่ละจุด</h3></div><span className="muted-label">revision {draft.revision}{draftDirty ? " · มีการแก้ไขที่ยังไม่บันทึก" : ""}</span></div>
          {draft.stops.map((stop, index) => <div className="tracedee-remix__stop-editor" key={stop.id}>
            <div className="tracedee-remix__stop-editor-header"><div><span className="tracedee-stop__number" aria-hidden="true">{index + 1}</span><strong>{stop.place.name}</strong><small>{stop.place.area} · {stop.place.category}</small></div><div className="tracedee-remix__stop-editor-actions"><button className="icon-button icon-button--subtle" type="button" aria-label={`เลื่อน ${stop.place.name} ขึ้น`} disabled={index === 0 || pending !== null} onClick={() => moveStop(index, -1)}><ArrowUp size={14} aria-hidden="true" /></button><button className="icon-button icon-button--subtle" type="button" aria-label={`เลื่อน ${stop.place.name} ลง`} disabled={index === draft.stops.length - 1 || pending !== null} onClick={() => moveStop(index, 1)}><ArrowDown size={14} aria-hidden="true" /></button><button className="icon-button icon-button--subtle" type="button" aria-label={`ลบ ${stop.place.name}`} disabled={pending !== null} onClick={() => removeStop(stop.id)}><Trash2 size={14} aria-hidden="true" /></button></div></div>
            <div className="tracedee-remix__stop-editor-fields"><label><span>หมายเหตุ</span><input value={stop.note} maxLength={2000} onChange={(event) => updateStop(stop.id, (current) => ({ ...current, note: event.target.value }))} /></label><label><span>เวลา (นาที)</span><input type="number" min={1} max={1440} value={stop.durationMinutes ?? ""} onChange={(event) => updateStop(stop.id, (current) => ({ ...current, durationMinutes: event.target.value ? Number(event.target.value) : null }))} /></label><label><span>การเดินทาง</span><select value={stop.transportMode ?? ""} onChange={(event) => updateStop(stop.id, (current) => ({ ...current, transportMode: event.target.value ? event.target.value as NonNullable<typeof current.transportMode> : null }))}><option value="">ไม่ระบุ</option><option value="WALK">เดิน</option><option value="BIKE">จักรยาน</option><option value="TRANSIT">ขนส่งสาธารณะ</option><option value="CAR">รถยนต์</option><option value="RIDE_HAIL">รถรับจ้าง</option><option value="OTHER">อื่น ๆ</option></select></label><label><span>งบ (สตางค์)</span><input type="number" min={0} value={stop.budgetMinor ?? ""} onChange={(event) => updateStop(stop.id, (current) => ({ ...current, budgetMinor: event.target.value ? Number(event.target.value) : null }))} /></label></div>
          </div>)}
          {draft.stops.length === 0 && <p className="muted-label">เพิ่มอย่างน้อยหนึ่งจุดแวะเพื่อเผยแพร่ Remix</p>}
        </div>

        <div className="button-row"><button className="button button--ghost" type="button" disabled={pending !== null || !draftDirty} onClick={() => void saveDraft()}><Save size={15} aria-hidden="true" />{pending === "save" ? "กำลังบันทึก…" : "บันทึก draft"}</button><button className="button button--dark" type="button" disabled={pending !== null || draftDirty || draft.stops.length === 0} onClick={() => void publishRemix()}><Upload size={15} aria-hidden="true" />{pending === "publish" ? "กำลังเผยแพร่…" : `เผยแพร่ draft (revision ${draft.revision})`}</button></div>
      </div>}
      {notice && <p className="inline-notice" role="status">{notice}</p>}
    </section>
  );
}

function JourneyPanel({ trace }: { trace: TraceDeeTraceDetail }) {
  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session", "tracedee-journey"],
    queryFn: getCustomerSession,
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 60_000
  });
  const journeyQuery = useQuery({
    queryKey: ["tracedee-journey", trace.itemId],
    queryFn: () => getTraceDeeJourneyForTrace(trace.slug),
    enabled: customerDataMode === "live" && Boolean(sessionQuery.data),
    retry: false,
    staleTime: 15_000
  });
  const [journey, setJourney] = useState<TraceDeeJourneyDetail | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingTags, setRatingTags] = useState<string[]>([]);
  const [ratingReview, setRatingReview] = useState("");
  const [submittedRating, setSubmittedRating] = useState<TraceDeeRatingResponse["rating"] | null>(null);
  const [contributionTargetPlaceId, setContributionTargetPlaceId] = useState<string | null>(null);
  const [contributionBody, setContributionBody] = useState("");
  const [submittedPost, setSubmittedPost] = useState<TraceDeePostResponse["post"] | null>(null);
  const [useCoarseLocation, setUseCoarseLocation] = useState(false);
  useEffect(() => {
    if (journeyQuery.data) setJourney(journeyQuery.data);
  }, [journeyQuery.data]);

  const refreshJourney = async (): Promise<void> => {
    const refreshed = await journeyQuery.refetch();
    if (refreshed.data) setJourney(refreshed.data);
  };
  const requireSignIn = async (): Promise<void> => {
    try {
      await beginGoSignIn(`/traces/${trace.slug}`);
    } catch {
      setNotice("ยังไม่สามารถเริ่มการเข้าสู่ระบบได้ กรุณาลองใหม่");
    }
  };
  const startJourney = async (): Promise<void> => {
    if (!sessionQuery.data) {
      await requireSignIn();
      return;
    }
    setPending("start");
    setNotice("");
    try {
      const created = await createTraceDeeJourney(trace.slug, createIdempotencyKey("tracedee-journey-create"));
      await applyTraceDeeJourneyAction(created.journey.journeyId, "start", createIdempotencyKey("tracedee-journey-start"));
      await refreshJourney();
      setNotice("เริ่ม Journey แล้ว");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถเริ่ม Journey ได้");
    } finally {
      setPending(null);
    }
  };
  const updateStop = async (stopId: string, status: "COMPLETED" | "SKIPPED", version: number): Promise<void> => {
    if (!journey || !sessionQuery.data) return;
    setPending(`stop:${stopId}`);
    setNotice("");
    try {
      await updateTraceDeeJourneyStop(journey.journeyId, stopId, status, journey.version, createIdempotencyKey(`tracedee-stop-${status.toLowerCase()}`));
      await refreshJourney();
      setNotice(status === "COMPLETED" ? "บันทึกจุดแวะที่ทำสำเร็จแล้ว" : "ข้ามจุดแวะนี้แล้ว");
    } catch (error) {
      setNotice(error instanceof ApiClientError && error.code === "JOURNEY_VERSION_CONFLICT" ? "Journey มีการเปลี่ยนแปลง จึง refresh สถานะล่าสุดให้แล้ว" : error instanceof ApiClientError ? error.message : "ยังไม่สามารถอัปเดตจุดแวะได้");
      if (error instanceof ApiClientError && error.code === "JOURNEY_VERSION_CONFLICT") await refreshJourney();
    } finally {
      setPending(null);
    }
  };
  const completeJourney = async (): Promise<void> => {
    if (!journey || !sessionQuery.data) return;
    setPending("complete");
    setNotice("");
    try {
      const verification = await readOptionalCompletionEvidence(journey, useCoarseLocation);
      const response = await applyTraceDeeJourneyAction(journey.journeyId, "complete", createIdempotencyKey("tracedee-journey-complete"), verification);
      await refreshJourney();
      setNotice(response.journey.verificationStatus === "VERIFIED"
        ? "Journey สำเร็จแล้ว และผ่านการตรวจสอบแบบไม่รบกวน"
        : response.journey.verificationStatus === "PARTIAL"
          ? "Journey สำเร็จแล้ว ระบบบันทึกไว้พร้อม flag ให้ตรวจสอบเพิ่มเติม"
          : "Journey สำเร็จแล้ว");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถจบ Journey ได้");
    } finally {
      setPending(null);
    }
  };
  const submitRating = async (): Promise<void> => {
    if (!journey || !sessionQuery.data) return;
    if (ratingValue < 1) {
      setNotice("เลือกคะแนน 1–5 ดาวก่อนส่ง");
      return;
    }
    setPending("rating");
    setNotice("");
    try {
      const response = await rateTraceDeeJourney(
        journey.journeyId,
        { rating: ratingValue, tags: ratingTags, review: ratingReview },
        createIdempotencyKey("tracedee-rating")
      );
      setSubmittedRating(response.rating);
      await refreshJourney();
      setNotice(response.rating.moderationStatus === "UNDER_REVIEW" ? "ส่ง rating แล้ว รีวิวกำลังรอตรวจสอบ" : "ขอบคุณสำหรับ rating ของคุณ");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถส่ง rating ได้");
    } finally {
      setPending(null);
    }
  };
  const submitContribution = async (): Promise<void> => {
    if (!journey || !sessionQuery.data) return;
    if (!contributionBody.trim()) {
      setNotice("เขียนสิ่งที่อยากแบ่งปันก่อนส่ง");
      return;
    }
    setPending("post");
    setNotice("");
    try {
      const response = await createTraceDeePost(
        journey.journeyId,
        {
          body: contributionBody,
          ...(contributionTargetPlaceId ? { placeId: contributionTargetPlaceId } : { traceId: trace.itemId })
        },
        createIdempotencyKey("tracedee-post")
      );
      setSubmittedPost(response.post);
      setContributionBody("");
      setNotice(response.post.status === "UNDER_REVIEW" ? "ส่ง contribution แล้ว กำลังตรวจสอบก่อนเผยแพร่" : "ส่ง contribution แล้ว");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถส่ง contribution ได้");
    } finally {
      setPending(null);
    }
  };

  if (!sessionQuery.data) {
    return <section id="tracedee-journey" className="tracedee-journey-panel"><div><p className="eyebrow">JOURNEY / PRIVATE PROGRESS</p><h2>ทำ Trace นี้ให้เป็นวันจริง</h2><p className="body-copy">เข้าสู่ระบบเพื่อเริ่ม Journey และเก็บสถานะจุดแวะไว้กับบัญชีของคุณ</p></div><button className="button button--ghost" type="button" onClick={() => void requireSignIn()}>เข้าสู่ระบบเพื่อเริ่ม</button></section>;
  }
  if (journeyQuery.isLoading && !journey) return <section id="tracedee-journey" className="tracedee-journey-panel" aria-busy="true"><p className="muted-label">กำลังตรวจสอบ Journey ของคุณ…</p></section>;
  if (journeyQuery.isError && journeyQuery.error instanceof ApiClientError && journeyQuery.error.status !== 404) return <section className="tracedee-journey-panel" role="alert"><h2>โหลด Journey ไม่สำเร็จ</h2><p className="body-copy">{journeyQuery.error.message}</p><button className="button button--ghost" type="button" onClick={() => void refreshJourney()}>ลองใหม่</button></section>;
  if (!journey) return <section id="tracedee-journey" className="tracedee-journey-panel"><div><p className="eyebrow">JOURNEY / PRIVATE PROGRESS</p><h2>พร้อมเริ่ม Trace นี้ไหม?</h2><p className="body-copy">ระบบจะสร้างแผนส่วนตัวจาก revision {trace.revision} และไม่เปิดเผย precise visit history เป็น public</p></div><button className="button button--dark" type="button" disabled={pending !== null} aria-busy={pending === "start"} onClick={() => void startJourney()}>{pending === "start" ? "กำลังเริ่ม…" : "เริ่ม Journey"}</button></section>;

  return (
    <section id="tracedee-journey" className="tracedee-journey-panel" aria-busy={pending !== null}>
      <div className="tracedee-journey-panel__header"><div><p className="eyebrow">JOURNEY / {journey.status}</p><h2>เส้นทางของคุณ</h2><p className="body-copy">ทำแล้ว {journey.completedStopCount} · ข้าม {journey.skippedStopCount} · เหลือ {journey.pendingStopCount}</p></div>{journey.status === "PLANNED" && <button className="button button--dark" type="button" disabled={pending !== null} onClick={() => { setPending("start"); void (async () => { try { await applyTraceDeeJourneyAction(journey.journeyId, "start", createIdempotencyKey("tracedee-journey-start")); await refreshJourney(); setNotice("เริ่ม Journey แล้ว"); } catch (error) { setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถเริ่ม Journey ได้"); } finally { setPending(null); } })(); }}>{pending === "start" ? "กำลังเริ่ม…" : "เริ่มต่อ"}</button>}</div>
      <ol className="tracedee-journey-stops">
        {journey.stops.map((stop) => <li key={stop.id} className={`tracedee-journey-stop tracedee-journey-stop--${stop.status.toLowerCase()}`}><div className="tracedee-journey-stop__main"><span className="tracedee-journey-stop__number">{stop.position + 1}</span><div><strong>{stop.place.name}</strong><p>{stop.note || stop.place.area}</p></div></div><div className="tracedee-journey-stop__actions">{stop.status === "PENDING" && journey.status !== "COMPLETED" && journey.status !== "ABANDONED" ? <><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => void updateStop(stop.id, "COMPLETED", stop.version)}>ทำแล้ว</button><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => void updateStop(stop.id, "SKIPPED", stop.version)}>ข้าม</button></> : <span className="muted-label">{stop.status === "COMPLETED" ? "ทำแล้ว" : stop.status === "SKIPPED" ? "ข้ามแล้ว" : "รอเริ่ม"}</span>}</div></li>)}
      </ol>
      {journey.status !== "COMPLETED" && journey.status !== "ABANDONED" && <div className="tracedee-journey-panel__footer"><div className="tracedee-verification-option"><label><input type="checkbox" checked={useCoarseLocation} onChange={(event) => setUseCoarseLocation(event.target.checked)} />ตรวจสอบพื้นที่แบบหยาบ (ไม่เก็บพิกัดจริง)</label><span className="muted-label">ใช้เมื่อคุณอนุญาต location เท่านั้น</span></div><span className="muted-label">version {journey.version}</span><button className="button button--ghost" type="button" disabled={pending !== null || journey.pendingStopCount > 0 || journey.completedStopCount === 0} onClick={() => void completeJourney()}>{pending === "complete" ? "กำลังจบ…" : "จบ Journey"}</button></div>}
      {journey.status === "COMPLETED" && journey.verificationStatus && <div className={`tracedee-verification tracedee-verification--${journey.verificationStatus.toLowerCase()}`}><div><p className="eyebrow">COMPLETION CHECK</p><strong>{journey.verificationStatus === "VERIFIED" ? "ตรวจสอบแล้ว" : journey.verificationStatus === "PARTIAL" ? "ตรวจสอบบางส่วน" : journey.verificationStatus === "REJECTED" ? "ต้องตรวจสอบเพิ่มเติม" : "ยืนยันด้วยตัวเอง"}</strong></div><span className="muted-label">ระบบเก็บเฉพาะผลตรวจและ anomaly flags ไม่เก็บ visit history สาธารณะ</span></div>}
      {journey.status === "COMPLETED" && (() => {
        const rating = journey.rating ?? submittedRating;
        if (rating) {
          return <div className="tracedee-rating-summary"><div><p className="eyebrow">YOUR RATING</p><div className="tracedee-rating-summary__value"><RatingStars value={rating.rating} /><strong>{rating.rating}/5</strong></div></div><span className="muted-label">{rating.moderationStatus === "UNDER_REVIEW" ? "รีวิวกำลังตรวจสอบ" : "บันทึกแล้ว"}</span></div>;
        }
      return <div className="tracedee-rating"><div><p className="eyebrow">RATE THIS TRACE</p><h3>ทริปนี้เป็นอย่างไรบ้าง?</h3><p className="body-copy">rating นี้ช่วยให้เราเข้าใจว่า Trace ไหนควรส่งต่อให้คนที่ชอบจังหวะแบบคุณ</p></div><div className="tracedee-rating__stars" role="radiogroup" aria-label="ให้คะแนน Trace"><span className="muted-label">คะแนน</span>{[1, 2, 3, 4, 5].map((value) => <button key={value} className={`tracedee-rating__star ${value <= ratingValue ? "is-selected" : ""}`} type="button" role="radio" aria-checked={value === ratingValue} aria-label={`${value} ดาว`} onClick={() => setRatingValue(value)}><Star size={19} fill={value <= ratingValue ? "currentColor" : "none"} aria-hidden="true" /></button>)}</div><div className="tracedee-rating__tags" aria-label="คุณลักษณะของ Trace">{traceDeeRatingTags.map((tag) => { const selected = ratingTags.includes(tag.value); return <button key={tag.value} className={`chip ${selected ? "chip--selected" : ""}`} type="button" aria-pressed={selected} onClick={() => setRatingTags((current) => current.includes(tag.value) ? current.filter((item) => item !== tag.value) : [...current, tag.value])}>{selected && <Check size={14} aria-hidden="true" />}{tag.label}</button>; })}</div><label className="tracedee-rating__review"><span>เล่าเพิ่มได้ (ไม่บังคับ)</span><textarea value={ratingReview} maxLength={3000} placeholder="อะไรทำให้ Trace นี้น่าจดจำ?" onChange={(event) => setRatingReview(event.target.value)} /></label><button className="button button--dark" type="button" disabled={pending !== null || ratingValue < 1} onClick={() => void submitRating()}>{pending === "rating" ? "กำลังส่ง…" : "ส่ง rating"}</button></div>;
      })()}
      {journey.status === "COMPLETED" && <div className="tracedee-contribution"><div><p className="eyebrow">CONTRIBUTE</p><h3>แบ่งปันสิ่งที่ค้นพบ</h3><p className="body-copy">เล่าเรื่องสั้น ๆ ให้คนที่กำลังตามรอย Trace นี้ การแนบลิงก์จะเข้าสู่การตรวจสอบก่อนเผยแพร่</p></div><div className="tracedee-contribution__targets" aria-label="เลือกสิ่งที่จะอ้างอิง"><button className={`chip ${contributionTargetPlaceId === null ? "chip--selected" : ""}`} type="button" aria-pressed={contributionTargetPlaceId === null} onClick={() => setContributionTargetPlaceId(null)}>Trace นี้</button>{journey.stops.map((stop) => <button key={stop.place.id} className={`chip ${contributionTargetPlaceId === stop.place.id ? "chip--selected" : ""}`} type="button" aria-pressed={contributionTargetPlaceId === stop.place.id} onClick={() => setContributionTargetPlaceId(stop.place.id)}>{stop.place.name}</button>)}</div><label className="tracedee-rating__review"><span>Contribution</span><textarea value={contributionBody} maxLength={8000} placeholder="มีอะไรที่อยากบอกคนถัดไป?" onChange={(event) => setContributionBody(event.target.value)} /></label><button className="button button--dark" type="button" disabled={pending !== null || contributionBody.trim().length < 1} onClick={() => void submitContribution()}>{pending === "post" ? "กำลังส่ง…" : "ส่ง contribution"}</button>{submittedPost && <p className="inline-notice" role="status">Contribution ล่าสุด: {submittedPost.status === "UNDER_REVIEW" ? "รอตรวจสอบ" : "เผยแพร่แล้ว"} · thread พร้อมสำหรับการสนทนา</p>}</div>}
      {notice && <p className="inline-notice" role="status">{notice}</p>}
    </section>
  );
}

type TraceDeeReportTarget = {
  entityType: "POST" | "COMMENT";
  entityId: string;
  label: string;
};

const traceDeeReportReasons = [
  { value: "SPAM", label: "สแปม / โฆษณา" },
  { value: "HARASSMENT", label: "คุกคามหรือทำร้ายกัน" },
  { value: "UNSAFE", label: "ไม่ปลอดภัย" },
  { value: "MISLEADING", label: "ข้อมูลชวนเข้าใจผิด" }
] as const;

function CommunityPanel({ trace, docked = false }: { trace: TraceDeeTraceDetail; docked?: boolean }) {
  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session", "tracedee-community"],
    queryFn: getCustomerSession,
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 60_000
  });
  const postsQuery = useQuery({
    queryKey: ["tracedee-posts", trace.itemId],
    queryFn: ({ signal }) => getTraceDeePosts(trace.slug, { signal }),
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 15_000
  });
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<TraceDeeComment | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [reportTarget, setReportTarget] = useState<TraceDeeReportTarget | null>(null);
  const [reportReason, setReportReason] = useState("SPAM");
  const [reportDetails, setReportDetails] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ entityType: "POST" | "COMMENT"; entityId: string; label: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ entityType: "POST" | "COMMENT"; entityId: string; expectedUpdatedAt: string; label: string } | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const commentsQuery = useQuery({
    queryKey: ["tracedee-comments", openThreadId],
    queryFn: ({ signal }) => getTraceDeeComments(openThreadId ?? "", { signal }),
    enabled: Boolean(openThreadId),
    retry: false,
    staleTime: 10_000
  });

  const requireSignIn = async (): Promise<void> => {
    try {
      await beginGoSignIn(`/traces/${trace.slug}`);
    } catch {
      setNotice("ยังไม่สามารถเริ่มการเข้าสู่ระบบได้ กรุณาลองใหม่");
    }
  };

  const submitComment = async (): Promise<void> => {
    if (!sessionQuery.data || !openThreadId) {
      await requireSignIn();
      return;
    }
    const body = commentDraft.trim();
    if (!body) {
      setNotice("เขียนความคิดเห็นก่อนส่ง");
      return;
    }
    setPending("comment");
    setNotice("");
    try {
      const response = await createTraceDeeComment(
        openThreadId,
        { body, ...(replyTo ? { parentId: replyTo.commentId } : {}) },
        createIdempotencyKey("tracedee-comment")
      );
      setCommentDraft("");
      setReplyTo(null);
      await commentsQuery.refetch();
      await postsQuery.refetch();
      setNotice(response.comment.status === "UNDER_REVIEW" ? "ส่งความคิดเห็นแล้ว กำลังตรวจสอบก่อนเผยแพร่" : "ส่งความคิดเห็นแล้ว");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถส่งความคิดเห็นได้");
    } finally {
      setPending(null);
    }
  };

  const toggleHelpful = async (comment: TraceDeeComment): Promise<void> => {
    if (!sessionQuery.data) {
      await requireSignIn();
      return;
    }
    setPending(`helpful:${comment.commentId}`);
    setNotice("");
    try {
      await setTraceDeeCommentHelpful(comment.commentId, !comment.helpful, createIdempotencyKey("tracedee-helpful"));
      await commentsQuery.refetch();
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถอัปเดต helpful ได้");
    } finally {
      setPending(null);
    }
  };

  const submitReport = async (): Promise<void> => {
    if (!sessionQuery.data) {
      await requireSignIn();
      return;
    }
    if (!reportTarget) return;
    setPending("report");
    setNotice("");
    try {
      await reportTraceDeeContent({
        entityType: reportTarget.entityType,
        entityId: reportTarget.entityId,
        reason: reportReason,
        details: reportDetails
      }, createIdempotencyKey("tracedee-report"));
      setReportTarget(null);
      setReportDetails("");
      setNotice("รับรายงานแล้ว ทีมงานจะตรวจสอบตามลำดับ");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถส่งรายงานได้");
    } finally {
      setPending(null);
    }
  };

  const beginEdit = (target: { entityType: "POST" | "COMMENT"; entityId: string; expectedUpdatedAt: string; body: string; label: string }): void => {
    setEditTarget({ entityType: target.entityType, entityId: target.entityId, expectedUpdatedAt: target.expectedUpdatedAt, label: target.label });
    setEditDraft(target.body);
    setNotice("");
  };

  const saveEdit = async (): Promise<void> => {
    if (!sessionQuery.data || !editTarget) return;
    const body = editDraft.trim();
    if (!body) {
      setNotice("เนื้อหาต้องไม่ว่าง");
      return;
    }
    setPending(`edit:${editTarget.entityId}`);
    setNotice("");
    try {
      const response = await editTraceDeeContent(editTarget.entityType, editTarget.entityId, body, editTarget.expectedUpdatedAt, createIdempotencyKey("tracedee-content-edit"));
      setEditTarget(null);
      setEditDraft("");
      await postsQuery.refetch();
      await commentsQuery.refetch();
      setNotice(response.content.status === "UNDER_REVIEW" ? "แก้ไขแล้ว เนื้อหากำลังตรวจสอบก่อนเผยแพร่" : "แก้ไขเนื้อหาแล้ว");
    } catch (error) {
      setNotice(error instanceof ApiClientError && error.code === "CONTENT_VERSION_CONFLICT" ? "เนื้อหานี้เปลี่ยนไปแล้ว จึง refresh สถานะล่าสุดให้แล้ว" : error instanceof ApiClientError ? error.message : "ยังไม่สามารถแก้ไขเนื้อหาได้");
      if (error instanceof ApiClientError && error.code === "CONTENT_VERSION_CONFLICT") {
        await postsQuery.refetch();
        await commentsQuery.refetch();
      }
    } finally {
      setPending(null);
    }
  };

  const deleteContent = (entityType: "POST" | "COMMENT", entityId: string, label: string): void => {
    setDeleteTarget({ entityType, entityId, label });
    setNotice("");
  };

  const confirmDeleteContent = async (): Promise<void> => {
    if (!sessionQuery.data || !deleteTarget) return;
    const { entityType, entityId } = deleteTarget;
    setPending(`delete:${entityId}`);
    setNotice("");
    try {
      await deleteTraceDeeContent(entityType, entityId, createIdempotencyKey("tracedee-content-delete"));
      if (editTarget?.entityId === entityId) {
        setEditTarget(null);
        setEditDraft("");
      }
      await postsQuery.refetch();
      await commentsQuery.refetch();
      setNotice("ลบเนื้อหาแล้ว และเก็บ soft-delete ไว้สำหรับ audit");
      setDeleteTarget(null);
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถลบเนื้อหาได้");
    } finally {
      setPending(null);
    }
  };

  const setUserRelation = async (targetId: string, relation: "BLOCK" | "MUTE"): Promise<void> => {
    if (!sessionQuery.data) {
      await requireSignIn();
      return;
    }
    if (sessionQuery.data.user.id === targetId) {
      setNotice("คุณไม่สามารถซ่อนหรือบล็อกบัญชีของตัวเองได้");
      return;
    }
    setPending(`relation:${targetId}:${relation}`);
    setNotice("");
    try {
      await setTraceDeeUserRelation(targetId, relation, true, createIdempotencyKey(`tracedee-${relation.toLowerCase()}`));
      await postsQuery.refetch();
      await commentsQuery.refetch();
      setNotice(relation === "BLOCK" ? "บล็อกบัญชีแล้ว และจะไม่แสดงเนื้อหาจากบัญชีนี้" : "ปิดเสียงบัญชีแล้ว และจะไม่แสดงเนื้อหาในฟีด/ความคิดเห็น");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถอัปเดต safety setting ได้");
    } finally {
      setPending(null);
    }
  };

  const posts = postsQuery.data?.posts ?? [];
  useEffect(() => {
    if (!docked || openThreadId || posts.length === 0) return;
    setOpenThreadId(posts[0]?.threadId ?? null);
  }, [docked, openThreadId, posts]);

  return (
    <section className={`tracedee-community${docked ? " tracedee-community--docked" : ""}`} aria-labelledby="tracedee-community-title" aria-busy={pending !== null}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">COMMUNITY / FIELD NOTES</p>
          <h2 id="tracedee-community-title">บันทึกจากคนที่ไปจริง</h2>
        </div>
        <span className="muted-label">{posts.length} contributions</span>
      </div>
      <p className="body-copy">อ่านประสบการณ์จากผู้เดินทางจริง และช่วยกันเติมรายละเอียดให้ Trace นี้มีประโยชน์ขึ้น</p>
      {postsQuery.isLoading && <div className="tracedee-community__state" aria-busy="true"><span className="muted-label">กำลังโหลดความคิดเห็น…</span></div>}
      {postsQuery.isError && <div className="tracedee-community__state" role="alert"><p>โหลด community ไม่สำเร็จ</p><button className="button button--ghost button--small" type="button" onClick={() => void postsQuery.refetch()}>ลองใหม่</button></div>}
      {!postsQuery.isLoading && !postsQuery.isError && posts.length === 0 && <div className="tracedee-community__state"><MessageCircle size={18} aria-hidden="true" /><span>ยังไม่มีบันทึกสำหรับ Trace นี้ เป็นคนแรกที่แบ่งปันได้หลังจบ Journey</span></div>}
      <div className="tracedee-community__posts">
        {posts.map((post) => {
          const isOpen = openThreadId === post.threadId;
          const comments = isOpen ? (commentsQuery.data?.comments ?? []) : [];
          return (
            <article className="tracedee-community__post" key={post.postId}>
              <div className="tracedee-community__post-header">
                <div><strong>{post.authorName}</strong><span className="muted-label">{post.status === "LIMITED" ? "จำกัดการมองเห็น" : "บันทึกจาก Journey"}</span></div>
                {sessionQuery.data && sessionQuery.data.user.id !== post.authorId && <div className="tracedee-community__author-actions"><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => void setUserRelation(post.authorId, "MUTE")}><VolumeX size={13} aria-hidden="true" />ปิดเสียง</button><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => void setUserRelation(post.authorId, "BLOCK")}><Ban size={13} aria-hidden="true" />บล็อก</button></div>}
                {sessionQuery.data?.user.id === post.authorId && <div className="tracedee-community__author-actions"><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => beginEdit({ entityType: "POST", entityId: post.postId, expectedUpdatedAt: post.updatedAt, body: post.body, label: "contribution" })}>แก้ไข</button><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => deleteContent("POST", post.postId, "contribution นี้")}>ลบ</button></div>}
                <button className="button button--ghost button--small" type="button" onClick={() => setReportTarget({ entityType: "POST", entityId: post.postId, label: "contribution นี้" })}><Flag size={14} aria-hidden="true" />รายงาน</button>
              </div>
              <p className="tracedee-community__post-body">{post.body}</p>
              <div className="tracedee-community__post-actions">
                <button className="button button--ghost button--small" type="button" aria-expanded={isOpen} onClick={() => { setOpenThreadId(isOpen ? null : post.threadId); setReplyTo(null); setNotice(""); }}><MessageCircle size={14} aria-hidden="true" />{isOpen ? "ซ่อนความคิดเห็น" : `${post.commentCount} ความคิดเห็น`}</button>
              </div>
              {isOpen && <div className="tracedee-community__thread">
                {commentsQuery.isLoading && <span className="muted-label">กำลังโหลดความคิดเห็น…</span>}
                {commentsQuery.isError && <div className="tracedee-community__state" role="alert"><span>โหลดความคิดเห็นไม่สำเร็จ</span><button className="button button--ghost button--small" type="button" onClick={() => void commentsQuery.refetch()}>ลองใหม่</button></div>}
                {!commentsQuery.isLoading && !commentsQuery.isError && comments.length === 0 && <span className="muted-label">ยังไม่มีความคิดเห็น</span>}
                <div className="tracedee-community__comments">
                  {comments.map((comment) => <div className={`tracedee-community__comment tracedee-community__comment--depth-${comment.depth}`} key={comment.commentId}>
                    <div className="tracedee-community__comment-header"><div><strong>{comment.authorName}</strong><span className="muted-label">{comment.status === "LIMITED" ? "จำกัดการมองเห็น" : ""}</span></div>{sessionQuery.data?.user.id === comment.authorId && <div className="tracedee-community__author-actions"><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => beginEdit({ entityType: "COMMENT", entityId: comment.commentId, expectedUpdatedAt: comment.updatedAt, body: comment.body, label: "ความคิดเห็น" })}>แก้ไข</button><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => deleteContent("COMMENT", comment.commentId, "ความคิดเห็นนี้")}>ลบ</button></div>}{sessionQuery.data && sessionQuery.data.user.id !== comment.authorId && <div className="tracedee-community__author-actions"><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => void setUserRelation(comment.authorId, "MUTE")} aria-label={`ปิดเสียง ${comment.authorName}`}><VolumeX size={13} aria-hidden="true" /></button><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => void setUserRelation(comment.authorId, "BLOCK")} aria-label={`บล็อก ${comment.authorName}`}><Ban size={13} aria-hidden="true" /></button></div>}</div>
                    <p>{comment.body}</p>
                    <div className="tracedee-community__comment-actions">
                      <button className={`button button--ghost button--small ${comment.helpful ? "is-selected" : ""}`} type="button" aria-pressed={comment.helpful} disabled={pending !== null} onClick={() => void toggleHelpful(comment)}><ThumbsUp size={13} aria-hidden="true" />มีประโยชน์ {comment.helpfulCount > 0 ? comment.helpfulCount : ""}</button>
                      {comment.depth === 0 && <button className="button button--ghost button--small" type="button" onClick={() => setReplyTo(comment)}>ตอบกลับ</button>}
                      <button className="button button--ghost button--small" type="button" onClick={() => setReportTarget({ entityType: "COMMENT", entityId: comment.commentId, label: "ความคิดเห็นนี้" })}><Flag size={13} aria-hidden="true" />รายงาน</button>
                    </div>
                  </div>)}
                </div>
                {!docked && (sessionQuery.data ? <div className="tracedee-community__composer">
                  {replyTo && <div className="tracedee-community__replying"><span>กำลังตอบกลับ {replyTo.authorName}</span><button className="icon-button" type="button" aria-label="ยกเลิกการตอบกลับ" onClick={() => setReplyTo(null)}><X size={14} aria-hidden="true" /></button></div>}
                  <textarea value={commentDraft} maxLength={3000} placeholder={replyTo ? "เขียนคำตอบ…" : "เพิ่มความคิดเห็นที่เป็นประโยชน์…"} onChange={(event) => setCommentDraft(event.target.value)} />
                  <button className="button button--dark" type="button" disabled={pending !== null || !commentDraft.trim()} onClick={() => void submitComment()}>{pending === "comment" ? "กำลังส่ง…" : <><Send size={14} aria-hidden="true" />ส่งความคิดเห็น</>}</button>
                </div> : <button className="button button--ghost" type="button" onClick={() => void requireSignIn()}>เข้าสู่ระบบเพื่อแสดงความคิดเห็น</button>)}
              </div>}
            </article>
          );
        })}
      </div>
      {docked && <div className="tracedee-community__docked-composer">
        {openThreadId ? (sessionQuery.data ? <>
          {replyTo && <div className="tracedee-community__replying"><span>กำลังตอบกลับ {replyTo.authorName}</span><button className="icon-button" type="button" aria-label="ยกเลิกการตอบกลับ" onClick={() => setReplyTo(null)}><X size={14} aria-hidden="true" /></button></div>}
          <textarea value={commentDraft} maxLength={3000} placeholder={replyTo ? "เขียนคำตอบ…" : "เพิ่มความคิดเห็นที่เป็นประโยชน์…"} onChange={(event) => setCommentDraft(event.target.value)} />
          <button className="button button--dark" type="button" disabled={pending !== null || !commentDraft.trim()} onClick={() => void submitComment()}>{pending === "comment" ? "กำลังส่ง…" : <><Send size={14} aria-hidden="true" />ส่งความคิดเห็น</>}</button>
        </> : <button className="button button--ghost" type="button" onClick={() => void requireSignIn()}>เข้าสู่ระบบเพื่อแสดงความคิดเห็น</button>) : <span className="muted-label">ยังไม่มี discussion thread ที่พร้อมรับความคิดเห็น</span>}
      </div>}
      {editTarget && <div className="tracedee-community__edit"><div className="tracedee-community__report-header"><div><p className="eyebrow">EDIT / {editTarget.entityType}</p><strong>แก้ไข{editTarget.label}</strong></div><button className="icon-button" type="button" aria-label="ปิดแบบฟอร์มแก้ไข" onClick={() => { setEditTarget(null); setEditDraft(""); }}><X size={15} aria-hidden="true" /></button></div><textarea value={editDraft} maxLength={editTarget.entityType === "POST" ? 8000 : 3000} onChange={(event) => setEditDraft(event.target.value)} /><div className="button-row"><button className="button button--ghost" type="button" disabled={pending !== null} onClick={() => { setEditTarget(null); setEditDraft(""); }}>ยกเลิก</button><button className="button button--dark" type="button" disabled={pending !== null || !editDraft.trim()} onClick={() => void saveEdit()}>{pending?.startsWith("edit:") ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button></div></div>}
      {deleteTarget && <div className="tracedee-community__delete-confirm" role="alertdialog" aria-label="ยืนยันการลบเนื้อหา"><div><strong>ลบ{deleteTarget.label}?</strong><span>เนื้อหาจะถูกซ่อนจากมุมมองสาธารณะและเก็บไว้ใน audit trail</span></div><div className="button-row"><button className="button button--ghost button--small" type="button" disabled={pending !== null} onClick={() => setDeleteTarget(null)}>ยกเลิก</button><button className="button button--dark button--small" type="button" disabled={pending !== null} onClick={() => void confirmDeleteContent()}>{pending?.startsWith("delete:") ? "กำลังลบ…" : "ยืนยันลบ"}</button></div></div>}
      {reportTarget && <div className="tracedee-community__report">
        <div className="tracedee-community__report-header"><div><p className="eyebrow">REPORT / {reportTarget.entityType}</p><strong>รายงาน{reportTarget.label}</strong></div><button className="icon-button" type="button" aria-label="ปิดแบบฟอร์มรายงาน" onClick={() => setReportTarget(null)}><X size={15} aria-hidden="true" /></button></div>
        <label><span>เหตุผล</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>{traceDeeReportReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label>
        <label><span>รายละเอียดเพิ่มเติม (ไม่บังคับ)</span><textarea value={reportDetails} maxLength={2000} onChange={(event) => setReportDetails(event.target.value)} placeholder="ช่วยบอกบริบทให้ทีมงานตรวจสอบได้เร็วขึ้น" /></label>
        <button className="button button--dark" type="button" disabled={pending !== null} onClick={() => void submitReport()}>{pending === "report" ? "กำลังส่ง…" : "ส่งรายงาน"}</button>
      </div>}
      {notice && <p className="inline-notice" role="status">{notice}</p>}
    </section>
  );
}

export function TraceDeeDetailPage() {
  const { traceSlug } = useParams();
  const [detail, setDetail] = useState<TraceDeeTraceDetail | null>(null);
  const query = useQuery({
    queryKey: ["tracedee-trace", traceSlug],
    queryFn: ({ signal }) => getTraceDeeTrace(traceSlug ?? "", { signal }),
    enabled: customerDataMode === "live" && Boolean(traceSlug),
    staleTime: 30_000
  });
  useEffect(() => {
    if (query.data) setDetail(query.data);
  }, [query.data]);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<SpatialTraceTab>("stops");

  const togglePanel = (tab: SpatialTraceTab): void => {
    if (isPanelOpen && activePanelTab === tab) {
      setIsPanelOpen(false);
      return;
    }
    setActivePanelTab(tab);
    setIsPanelOpen(true);
  };

  useEffect(() => {
    if (!isPanelOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setIsPanelOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPanelOpen]);

  if (customerDataMode !== "live") return <div className="page-frame"><section className="tracedee-empty"><h1>TraceDee ต้องเชื่อมต่อ Gateway</h1><p className="body-copy">เปิด live mode เพื่อทดสอบ Trace จริง</p><Link className="button button--ghost" to="/traces">กลับ TraceDee</Link></section></div>;
  if (query.isError) return <div className="page-frame"><section className="tracedee-empty" role="alert"><h1>{query.error instanceof ApiClientError && query.error.status === 404 ? "ไม่พบ Trace นี้" : "โหลด Trace ไม่สำเร็จ"}</h1><p className="body-copy">ตรวจสอบลิงก์หรือการเชื่อมต่อแล้วลองใหม่อีกครั้ง</p><Link className="button button--ghost" to="/traces">กลับ TraceDee</Link></section></div>;
  if (query.isLoading || !detail) return <div className="page-frame"><div className="loading-state" aria-busy="true"><p className="muted-label">กำลังโหลด Trace…</p><div className="skeleton-stack"><span className="skeleton skeleton--wide" /><span className="skeleton" /><span className="skeleton skeleton--short" /></div></div></div>;

  return (
    <div className="page-frame tracedee-detail-page tracedee-detail-page--spatial">
      <Link className="back-link" to="/traces"><ArrowLeft size={16} aria-hidden="true" />กลับ TraceDee</Link>
      <SpatialDockedLayout
        isOpen={isPanelOpen}
        main={
          <TraceSpatialContentCard
            trace={detail}
            panelOpen={isPanelOpen}
            activeTab={activePanelTab}
            onTogglePanel={togglePanel}
            setDetail={setDetail}
          />
        }
        panel={
          <TraceSpatialPanel
            trace={detail}
            isOpen={isPanelOpen}
            activeTab={activePanelTab}
            onTabChange={(tab) => setActivePanelTab(tab)}
            onClose={() => setIsPanelOpen(false)}
          />
        }
      />

      <RemixPanel trace={detail} />
      <JourneyPanel trace={detail} />

      <section className="tracedee-next-step"><div><p className="eyebrow">NEXT STEP</p><h2>พร้อมเปลี่ยน Trace ให้เป็นวันจริงหรือยัง?</h2><p className="body-copy">เริ่ม Journey ได้ทันที แล้ว mark จุดแวะที่ทำสำเร็จทีละจุดเพื่อเก็บประสบการณ์ที่ตรวจสอบย้อนกลับได้</p></div><Link className="button button--ghost" to="#tracedee-journey"><Check size={16} aria-hidden="true" />เริ่ม Journey</Link></section>
    </div>
  );
}
