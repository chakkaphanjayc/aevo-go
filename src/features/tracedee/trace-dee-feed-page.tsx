import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Compass, Search, Settings2, Sparkles, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { GlidingGroup } from "@/components/gliding-group";
import type { TraceDeeFeedItem } from "@/contracts/tracedee";
import { ApiClientError } from "@/lib/api-client";
import { getTraceDeeFeed, getTraceDeeProfilePreferences, recordTraceDeeFeedInteraction, recordTraceDeeFeedImpression, updateTraceDeeProfilePreferences } from "@/lib/customer-api";
import { customerDataMode } from "@/lib/env";
import { createIdempotencyKey } from "@/lib/idempotency";
import { getCustomerSession } from "@/lib/session";
import { beginGoSignIn } from "@/lib/sso";

const feedTabs = [
  { id: "for_you", label: "For you" },
  { id: "following", label: "Following" },
  { id: "nearby", label: "Nearby" }
] as const;

type FeedTab = (typeof feedTabs)[number]["id"];

function reasonCopy(item: TraceDeeFeedItem): string {
  if (item.reasonCode === "FOLLOWING_TRACER") return "เพราะคุณติดตาม Tracer นี้";
  if (item.reasonCode === "TASTE_MATCH") {
    const topics = Array.isArray(item.reasonParams.matchedTopics) ? item.reasonParams.matchedTopics.filter((value): value is string => typeof value === "string").slice(0, 2) : [];
    const areas = Array.isArray(item.reasonParams.matchedAreas) ? item.reasonParams.matchedAreas.filter((value): value is string => typeof value === "string").slice(0, 1) : [];
    const signals = [...topics, ...areas];
    return signals.length > 0 ? `เพราะคุณชอบ ${signals.join(" และ ")}` : "เพราะเข้ากับสิ่งที่คุณชอบ";
  }
  if (item.reasonCode === "POPULAR") return "Trace ที่กำลังถูกบันทึกและติดตาม";
  return "Trace ใหม่ที่น่าลองในพื้นที่นี้";
}

function TraceCard({ item, tab, position, onHide }: { item: TraceDeeFeedItem; tab: FeedTab; position: number; onHide?: (item: TraceDeeFeedItem) => void }) {
  const cardRef = useRef<HTMLElement>(null);
  const sentRef = useRef(false);
  useEffect(() => {
    const element = cardRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry || sentRef.current || entry.intersectionRatio < 0.5) return;
      sentRef.current = true;
      void recordTraceDeeFeedImpression({
        entityId: item.itemId,
        trackingToken: item.trackingToken,
        position,
        tab
      }).catch(() => undefined);
      observer.disconnect();
    }, { threshold: [0.5] });
    observer.observe(element);
    return () => observer.disconnect();
  }, [item.itemId, item.trackingToken, position, tab]);

  return (
    <article className="tracedee-card" ref={cardRef}>
      <div className="tracedee-card__topline">
        <span className="eyebrow">TRACE / {item.area || "DISCOVERY"}</span>
        <span className="tracedee-card__reason"><Sparkles size={13} aria-hidden="true" />{reasonCopy(item)}</span>
      </div>
      <div className="tracedee-card__body">
        <div className="tracedee-card__title-row">
          <div>
            <h2><Link to={`/traces/${item.slug}`}>{item.title}</Link></h2>
            <p className="tracedee-card__creator">โดย {item.creatorName}</p>
          </div>
          <span className="tracedee-card__count" aria-label={`${item.stopCount} จุดแวะ`}>{item.stopCount} stops</span>
        </div>
        <p className="tracedee-card__description">{item.description || "เส้นทางที่คัดไว้ให้คุณลองใช้วันว่างให้คุ้มขึ้น"}</p>
        <div className="tracedee-card__meta">
          <span>{item.saveCount} saves</span>
          <span>{item.followerCount} followers</span>
          {item.topicTags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
        <Link className="button button--ghost" to={`/traces/${item.slug}`}>
          เปิด Trace <ArrowRight size={16} aria-hidden="true" />
        </Link>
        {onHide && <button className="button button--ghost button--small" type="button" onClick={() => onHide(item)}><X size={14} aria-hidden="true" />ไม่สนใจ Trace นี้</button>}
      </div>
    </article>
  );
}

const interestOptions = [
  { dimensionType: "TOPIC", dimensionKey: "coffee", label: "กาแฟ" },
  { dimensionType: "TOPIC", dimensionKey: "heritage", label: "ย่านเก่า" },
  { dimensionType: "TOPIC", dimensionKey: "slow-travel", label: "เดินช้า ๆ" },
  { dimensionType: "TOPIC", dimensionKey: "art", label: "ศิลปะ" },
  { dimensionType: "TOPIC", dimensionKey: "photo-walk", label: "ถ่ายรูป" },
  { dimensionType: "TOPIC", dimensionKey: "wellness", label: "wellness" },
  { dimensionType: "AREA", dimensionKey: "Rattanakosin", label: "Rattanakosin" },
  { dimensionType: "AREA", dimensionKey: "Talat Noi", label: "Talat Noi" }
] as const;

function TraceDeePreferencesPanel({ sessionReady, onSaved }: { sessionReady: boolean; onSaved: () => void }) {
  const preferencesQuery = useQuery({
    queryKey: ["tracedee-preferences"],
    queryFn: ({ signal }) => getTraceDeeProfilePreferences({ signal }),
    enabled: customerDataMode === "live" && sessionReady,
    retry: false,
    staleTime: 60_000
  });
  const [enabled, setEnabled] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!preferencesQuery.data) return;
    setEnabled(preferencesQuery.data.personalizationEnabled);
    setSelected(preferencesQuery.data.interests.map((interest) => `${interest.dimensionType}:${interest.dimensionKey}`));
  }, [preferencesQuery.data]);

  const toggleInterest = (key: string): void => {
    setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : current.length >= 5 ? current : [...current, key]);
  };
  const save = async (): Promise<void> => {
    if (!enabled && selected.length === 0) {
      setPending(true);
    } else if (selected.length > 0 && selected.length < 3) {
      setNotice("เลือกอย่างน้อย 3 ความสนใจ หรือปิด personalization เพื่อบันทึก");
      return;
    } else {
      setPending(true);
    }
    setNotice("");
    try {
      const interests = selected.map((key) => {
        const option = interestOptions.find((item) => `${item.dimensionType}:${item.dimensionKey}` === key);
        return option ? { dimensionType: option.dimensionType, dimensionKey: option.dimensionKey } : { dimensionType: "TOPIC" as const, dimensionKey: key.replace(/^TOPIC:/, "") };
      });
      await updateTraceDeeProfilePreferences({ personalizationEnabled: enabled, interests }, createIdempotencyKey("tracedee-preferences"));
      await preferencesQuery.refetch();
      onSaved();
      setNotice(enabled ? "บันทึกความสนใจแล้ว ระบบจะใช้เป็น signal แบบอธิบายได้" : "ปิด personalization แล้ว ฟีดจะกลับไปใช้ deterministic ranking");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถบันทึกความสนใจได้");
    } finally {
      setPending(false);
    }
  };
  const reset = async (): Promise<void> => {
    setEnabled(false);
    setSelected([]);
    setPending(true);
    setNotice("");
    try {
      await updateTraceDeeProfilePreferences({ personalizationEnabled: false, interests: [] }, createIdempotencyKey("tracedee-preferences-reset"));
      await preferencesQuery.refetch();
      onSaved();
      setNotice("รีเซ็ตความสนใจและปิด personalization แล้ว");
    } catch (error) {
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถรีเซ็ตความสนใจได้");
    } finally {
      setPending(false);
    }
  };
  if (!sessionReady) return null;
  return (
    <details className="tracedee-preferences">
      <summary><Settings2 size={15} aria-hidden="true" />ตั้งค่าความสนใจและ personalization</summary>
      <div className="tracedee-preferences__body">
        <label className="tracedee-preferences__toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span><strong>ใช้ความสนใจช่วยจัดลำดับ</strong><small>ระบบจะใช้ signal จาก save/follow/complete และสิ่งที่เลือก โดยไม่แสดงคะแนนเปอร์เซ็นต์</small></span></label>
        <div className="tracedee-preferences__options" aria-label="เลือกความสนใจ">
          {interestOptions.map((option) => { const key = `${option.dimensionType}:${option.dimensionKey}`; const active = selected.includes(key); return <button className={`tracedee-preferences__option${active ? " is-selected" : ""}`} key={key} type="button" aria-pressed={active} disabled={pending} onClick={() => toggleInterest(key)}>{active ? <Check size={13} aria-hidden="true" /> : <span className="tracedee-preferences__dot" aria-hidden="true" />}{option.label}</button>; })}
        </div>
        <div className="button-row"><button className="button button--dark" type="button" disabled={pending} onClick={() => void save()}>{pending ? "กำลังบันทึก…" : "บันทึกความสนใจ"}</button><button className="button button--ghost" type="button" disabled={pending} onClick={() => void reset()}>รีเซ็ตและปิด</button><span className="muted-label">{selected.length}/5 เลือก</span></div>
        {notice && <p className="inline-notice" role="status">{notice}</p>}
      </div>
    </details>
  );
}

function EmptyTraceState({ live }: { live: boolean }) {
  return (
    <section className="tracedee-empty" role="status">
      <span className="icon-badge" aria-hidden="true"><Compass size={21} /></span>
      <h2>{live ? "ยังไม่มี Trace ที่เปิด public" : "TraceDee ต้องเชื่อมต่อ Gateway"}</h2>
      <p className="body-copy">{live ? "เมื่อมีเส้นทางที่เผยแพร่แล้ว ระบบจะจัดอันดับและแสดงเหตุผลของแต่ละรายการตรงนี้" : "หน้านี้จะไม่สร้างข้อมูลปลอมใน demo mode กรุณาเปิด Customer Gateway เพื่อทดสอบข้อมูลจริง"}</p>
      {!live && <Link className="button button--ghost" to="/">กลับ Explore</Link>}
    </section>
  );
}

export function TraceDeeFeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: FeedTab = feedTabs.some((tab) => tab.id === rawTab) ? rawTab as FeedTab : "for_you";
  const query = searchParams.get("q") ?? "";
  const area = searchParams.get("area") ?? "";
  const [input, setInput] = useState(query);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hidePendingId, setHidePendingId] = useState<string | null>(null);
  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session", "tracedee"],
    queryFn: getCustomerSession,
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 60_000
  });
  const feedQuery = useInfiniteQuery({
    queryKey: ["tracedee-feed", activeTab, query, area],
    queryFn: ({ signal, pageParam }) => getTraceDeeFeed({
      tab: activeTab,
      ...(query ? { query } : {}),
      ...(area ? { area } : {}),
      ...(pageParam ? { cursor: pageParam } : {}),
      limit: 12
    }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: customerDataMode === "live",
    staleTime: 30_000
  });
  const items = useMemo(() => (feedQuery.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => !hiddenIds.has(item.itemId)), [feedQuery.data, hiddenIds]);
  const hideItem = async (item: TraceDeeFeedItem): Promise<void> => {
    if (!sessionQuery.data) {
      try { await beginGoSignIn("/traces"); } catch { /* sign-in surface owns its error */ }
      return;
    }
    setHidePendingId(item.itemId);
    try {
      await recordTraceDeeFeedInteraction(item.itemId, { interactionType: "DISMISSED", trackingToken: item.trackingToken, metadata: { source: "feed-card" } }, createIdempotencyKey("tracedee-feed-hide"));
      setHiddenIds((current) => new Set(current).add(item.itemId));
    } catch {
      // The card stays visible when the server cannot reconcile the hide.
    } finally {
      setHidePendingId(null);
    }
  };
  const updateSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (input.trim()) next.set("q", input.trim());
    else next.delete("q");
    next.delete("cursor");
    setSearchParams(next);
  };
  const updateTab = (nextTab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    next.delete("cursor");
    setSearchParams(next);
  };

  return (
    <div className="page-frame tracedee-page">
      <header className="page-heading page-heading--hero tracedee-heading">
        <p className="eyebrow">TRACEDEE / DISCOVER</p>
        <h1>ออกไปเจออะไรดี</h1>
        <p className="body-copy">ค้นพบเส้นทางที่คนจริงสร้างไว้ แล้วเก็บไว้เปลี่ยนวันว่างให้เป็นประสบการณ์</p>
      </header>

      <section className="tracedee-toolbar" aria-label="ตัวกรอง TraceDee">
        <GlidingGroup
          items={feedTabs}
          activeId={activeTab}
          onChange={updateTab}
          ariaLabel="เลือกฟีด TraceDee"
          role="tablist"
          size="small"
        />
        <form className="tracedee-search" role="search" onSubmit={updateSearch}>
          <Search size={16} aria-hidden="true" />
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="ค้นหา Trace หรือพื้นที่" aria-label="ค้นหา TraceDee" />
          <button className="icon-button icon-button--subtle" type="submit" aria-label="ค้นหา TraceDee"><ArrowRight size={16} aria-hidden="true" /></button>
        </form>
      </section>

      <TraceDeePreferencesPanel sessionReady={Boolean(sessionQuery.data)} onSaved={() => { setHiddenIds(new Set()); void feedQuery.refetch(); }} />

      {!sessionQuery.data && customerDataMode === "live" && activeTab === "following" && <p className="inline-notice">Following ต้องเข้าสู่ระบบก่อน จึงจะแสดงรายการของคุณ</p>}
      {customerDataMode !== "live" ? <EmptyTraceState live={false} />
        : feedQuery.isLoading ? <section className="tracedee-feed" aria-busy="true"><div className="loading-state"><p className="muted-label">กำลังจัด Trace ที่เหมาะกับคุณ…</p><div className="skeleton-stack"><span className="skeleton skeleton--wide" /><span className="skeleton" /><span className="skeleton skeleton--short" /></div></div></section>
        : feedQuery.isError ? <section className="tracedee-empty" role="alert"><h2>โหลด TraceDee ไม่สำเร็จ</h2><p className="body-copy">{feedQuery.error instanceof ApiClientError && feedQuery.error.status === 503 ? "TraceDee schema ยังไม่พร้อมบน Gateway" : "ตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง"}</p><button className="button button--ghost" type="button" onClick={() => void feedQuery.refetch()}>ลองใหม่</button></section>
        : items.length === 0 ? <EmptyTraceState live />
        : <section className="tracedee-feed" aria-label="TraceDee feed">{items.map((item, index) => <TraceCard key={item.itemId} item={item} tab={activeTab} position={index} onHide={hidePendingId ? undefined : (nextItem) => void hideItem(nextItem)} />)}{feedQuery.hasNextPage && <button className="button button--ghost load-more-button" type="button" disabled={feedQuery.isFetchingNextPage} onClick={() => void feedQuery.fetchNextPage()}>{feedQuery.isFetchingNextPage ? "กำลังโหลด…" : "โหลด Trace เพิ่ม"}</button>}</section>}
    </div>
  );
}

export function TraceDeePreview() {
  const query = useQuery({
    queryKey: ["tracedee-feed", "preview"],
    queryFn: () => getTraceDeeFeed({ tab: "for_you", limit: 3 }),
    enabled: customerDataMode === "live",
    staleTime: 30_000
  });
  const items = query.data?.items ?? [];
  if (customerDataMode !== "live" || query.isLoading || query.isError || items.length === 0) return null;
  return (
    <section className="content-section tracedee-preview" aria-labelledby="tracedee-preview-title">
      <div className="section-heading"><div><p className="eyebrow">TRACEDEE / PRODUCT LOOP</p><h2 id="tracedee-preview-title">เส้นทางที่น่าลองต่อ</h2></div><Link className="text-link" to="/traces">ดู Trace ทั้งหมด <ArrowRight size={14} aria-hidden="true" /></Link></div>
      <div className="tracedee-preview-grid">{items.map((item) => <TraceCard key={item.itemId} item={item} tab="for_you" position={0} />)}</div>
    </section>
  );
}
