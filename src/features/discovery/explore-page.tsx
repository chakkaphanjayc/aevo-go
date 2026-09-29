import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Compass,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { FeedEventName } from "@/contracts/feed";
import { GlidingGroup } from "@/components/gliding-group";
import { MediaConversationModal } from "@/components/media-conversation-modal";
import {
  applyTraceDeeTraceAction,
  setTraceDeeTracerFollow,
} from "@/lib/customer-api";
import { customerDataMode, placeApiMode } from "@/lib/env";
import { isGatewayOfflineError } from "@/lib/api-client";
import {
  enqueueFeedEvent,
  feedEventForItem,
  feedEventMetadata,
  feedEventQueue,
} from "@/lib/feed-events";
import {
  getCoreFeedFeedbackHistory,
  getCoreFeedPage,
  postCoreFeedFeedback,
} from "@/lib/feed-api";
import { createIdempotencyKey } from "@/lib/idempotency";
import { listSavedCanonicalPlaces, setCanonicalPlaceSaved } from "@/lib/place-api";
import { removeCustomerFavorite, saveCustomerFavorite } from "@/lib/public-api";
import { getCustomerSession } from "@/lib/session";
import { beginGoSignIn } from "@/lib/sso";
import { DiscoveryCard } from "./discovery-cards";
import { demoDiscoveryItems, filterDemoDiscoveryItems } from "./demo-discovery";
import { DiscoveryIntentPrompt } from "./discovery-intent-prompt";
import { DiscoveryModuleShelf } from "./discovery-modules";
import {
  DiscoveryComposer,
  type DiscoveryComposerDraft,
} from "./discover-feed-composer";
import { ExploreDetailEmpty, ExploreTraceDetail } from "./explore-trace-detail";
import { PlaceInlineDetail } from "./place-inline-detail";
import { PostInlineDetail } from "./post-inline-detail";
import { setExploreDetailViewportState } from "./detail-viewport-lock";
import {
  ExploreBookingPortal,
  parseExplorePortalCategory,
  type ExplorePortalCategory,
} from "./explore-booking-portal";
import {
  resolveFeedFeedbackPersistence,
  type FeedFeedbackPersistence,
} from "./feed-feedback-policy";
import {
  ExploreContextSidebar,
  ExploreInsightsSidebar,
} from "./explore-sidebars";
import {
  type DiscoveryAction,
  type DiscoveryActionState,
  type DiscoveryCommentProfile,
  type DiscoveryItem,
  type DiscoveryPlace,
  type DiscoveryPost,
  type DiscoveryTrace,
  type DiscoveryTab,
  type DiscoveryTracer,
  type DiscoveryTracerSummary,
} from "./types";
import { coreFeedItemToDiscovery, feedModulesToDiscovery } from "./feed-adapter";

const feedTabs = [
  { id: "for_you", label: "For you" },
  { id: "following", label: "Following" },
  { id: "nearby", label: "Nearby" },
] as const;

type FeedFeedbackReasonCode = "NOT_RELEVANT" | "ALREADY_SEEN" | "TOO_FAR" | "OTHER";

interface DiscoverySelectionAnchor {
  itemId: string;
  pageScrollTop: number;
  feedScrollTop: number;
  cardTop: number | null;
}

const DETAIL_CLOSE_DURATION_MS = 220;

const hideReasonOptions: readonly { code: FeedFeedbackReasonCode; label: string }[] = [
  { code: "NOT_RELEVANT", label: "ไม่เกี่ยวกับสิ่งที่กำลังหา" },
  { code: "ALREADY_SEEN", label: "เคยเห็นแล้ว" },
  { code: "TOO_FAR", label: "ไกลเกินไป" },
  { code: "OTHER", label: "เหตุผลอื่น" },
];

const hideReasonLabels: Readonly<Record<FeedFeedbackReasonCode, string>> = {
  NOT_RELEVANT: "ไม่เกี่ยวกับสิ่งที่กำลังหา",
  ALREADY_SEEN: "เคยเห็นแล้ว",
  TOO_FAR: "ไกลเกินไป",
  OTHER: "เหตุผลอื่น",
};

function safeWindowScrollTo(options: ScrollToOptions): void {
  if (typeof window === "undefined" || typeof window.scrollTo !== "function") return;
  if (typeof navigator !== "undefined" && navigator.userAgent?.includes("jsdom")) return;
  try {
    window.scrollTo(options);
  } catch {
    // JSDOM or environments without full scroll implementation
  }
}

function getDocumentScrollTop(): number {
  if (typeof window === "undefined") return 0;
  return window.scrollY || document.documentElement.scrollTop || document.body?.scrollTop || 0;
}

function focusSelectionTarget(target: HTMLElement | null, itemId: string): void {
  const card = findDiscoveryCard(itemId);
  const fallback = card?.querySelector<HTMLElement>("button, a, [tabindex]:not([tabindex='-1'])") ?? null;
  const nextTarget = target && document.contains(target) ? target : fallback;
  if (!nextTarget || nextTarget.hasAttribute("disabled")) return;
  nextTarget.focus({ preventScroll: true });
}

function findDiscoveryCard(itemId: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-discovery-item-id]"),
  ).find((element) => element.dataset.discoveryItemId === itemId) ?? null;
}

function updateActionState(
  current: Readonly<Record<string, DiscoveryActionState>>,
  key: string,
  next: DiscoveryActionState,
): Record<string, DiscoveryActionState> {
  return { ...current, [key]: next };
}

function actionKey(item: DiscoveryItem, action: DiscoveryAction): string {
  return `${item.itemType}:${item.id}:${action}`;
}

function enqueueExploreFeedEvent(
  item: DiscoveryItem,
  eventName: FeedEventName,
  tab: DiscoveryTab,
  position?: number,
): void {
  if (
    (item.itemType !== "TRACE" && item.itemType !== "PLACE") ||
    !item.feedSessionId ||
    !item.trackingToken
  ) return;

  enqueueFeedEvent(
    feedEventForItem({
      eventName,
      feedSessionId: item.feedSessionId,
      itemToken: item.trackingToken,
      itemType: item.itemType,
      ...(position !== undefined ? { position } : {}),
      metadata: feedEventMetadata({
        tab,
        reasonCode: item.feedReasonCode,
        ...(eventName === "impression"
          ? { visibleRatio: 0.5, visibleDurationMs: 1_000 }
          : {}),
      }),
    }),
  );
}

function traceFromDiscoveryItem(
  items: readonly DiscoveryItem[],
  item: DiscoveryItem,
): DiscoveryTrace | null {
  if (item.itemType === "TRACE") return item;
  if (item.itemType === "POST" && item.attachedObject?.itemType === "TRACE") {
    return (
      items.find(
        (candidate): candidate is DiscoveryTrace =>
          candidate.itemType === "TRACE" &&
          (candidate.id === item.attachedObject?.id ||
            candidate.slug === item.attachedObject?.href.replace("/traces/", "")),
      ) ?? null
    );
  }
  if (item.itemType === "TRACER") {
    return (
      items.find(
        (candidate): candidate is DiscoveryTrace =>
          candidate.itemType === "TRACE" &&
          candidate.slug === item.featuredTrace.slug,
      ) ?? null
    );
  }
  return null;
}

function SkeletonFeed() {
  return (
    <section
      className="discovery-feed"
      aria-busy="true"
      aria-label="กำลังโหลดฟีด"
    >
      <div className="discovery-skeleton">
        <span className="skeleton skeleton--wide" />
        <span className="skeleton" />
        <span className="skeleton skeleton--short" />
        <span className="skeleton" />
      </div>
      <div className="discovery-skeleton">
        <span className="skeleton skeleton--wide" />
        <span className="skeleton" />
        <span className="skeleton skeleton--short" />
      </div>
    </section>
  );
}

function ExploreDetailSkeleton() {
  return (
    <div className="explore-detail-panel explore-detail-panel--skeleton" aria-busy="true" aria-label="กำลังโหลดรายละเอียด">
      <header className="explore-detail-panel__header explore-detail-story-header">
        <div className="explore-detail-story-header__copy">
          <div className="skeleton skeleton--short" style={{ width: "90px", height: "11px", marginBottom: "6px" }} />
          <div className="skeleton skeleton--wide" style={{ width: "220px", height: "24px", marginBottom: "8px" }} />
          <div className="explore-detail-story-meta">
            <span className="skeleton" style={{ width: "26px", height: "26px", borderRadius: "50%" }} />
            <span className="skeleton skeleton--short" style={{ width: "120px", height: "13px" }} />
          </div>
        </div>
      </header>
      <div className="explore-detail-panel__body">
        <div className="explore-detail-hero" style={{ height: "240px" }}>
          <span className="skeleton" style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
        <div style={{ display: "grid", gap: "10px", marginTop: "18px" }}>
          <span className="skeleton skeleton--wide" style={{ height: "14px", display: "block" }} />
          <span className="skeleton" style={{ height: "14px", display: "block" }} />
          <span className="skeleton skeleton--short" style={{ height: "14px", display: "block" }} />
        </div>
      </div>
    </div>
  );
}

function InlineRecovery({
  onRetry,
  message = "โหลดคำแนะนำล่าสุดไม่ได้ กำลังแสดงข้อมูลที่บันทึกไว้",
}: {
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <div className="inline-recovery" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button
          className="text-link text-link--button"
          type="button"
          onClick={onRetry}
        >
          ลองใหม่
        </button>
      )}
    </div>
  );
}

export function ExplorePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const rawTab = searchParams.get("tab");
  const activeTab: DiscoveryTab = feedTabs.some((tab) => tab.id === rawTab)
    ? (rawTab as DiscoveryTab)
    : "for_you";
  const query = searchParams.get("q") ?? "";
  const area = searchParams.get("area") ?? "";
  const vibe = searchParams.get("vibe") ?? "";
  const activePortalCategory = parseExplorePortalCategory(searchParams.get("category"));
  const bookingDate = searchParams.get("date") ?? "";
  const partySize = searchParams.get("party") ?? "2";
  const feedCategory =
    activePortalCategory === "all" || activePortalCategory === "play"
      ? undefined
      : activePortalCategory;
  const feedPartySize = Number(searchParams.get("party"));
  const [input, setInput] = useState(query);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState("");
  const [actionStates, setActionStates] = useState<
    Record<string, DiscoveryActionState>
  >({});
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hiddenItem, setHiddenItem] = useState<DiscoveryItem | null>(null);
  const [hiddenFeedbackPersistence, setHiddenFeedbackPersistence] =
    useState<FeedFeedbackPersistence | null>(null);
  const [restorePending, setRestorePending] = useState(false);
  const [pendingHideItem, setPendingHideItem] = useState<DiscoveryItem | null>(null);
  const [feedbackHistoryOpen, setFeedbackHistoryOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [unsavedIds, setUnsavedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [unfollowedIds, setUnfollowedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [unlikedIds, setUnlikedIds] = useState<Set<string>>(new Set());
  const [followedCreatorIds, setFollowedCreatorIds] = useState<Set<string>>(new Set());
  const [unfollowedCreatorIds, setUnfollowedCreatorIds] = useState<Set<string>>(new Set());
  const [commentFocusRequest, setCommentFocusRequest] = useState<{
    itemId: string;
    key: number;
  } | null>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaModalIndex, setMediaModalIndex] = useState(0);
  const [promoOpen, setPromoOpen] = useState(true);
  const [createdItems, setCreatedItems] = useState<DiscoveryItem[]>([]);
  const composerSequenceRef = useRef(0);
  const feedColumnRef = useRef<HTMLElement>(null);
  useEffect(() => setInput(query), [query]);
  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);
  useEffect(() => {
    if (customerDataMode !== "live") return;
    const flush = () => {
      void feedEventQueue.flush();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  const notify = (message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 4200);
  };
  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session", "explore"],
    queryFn: getCustomerSession,
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 60_000,
  });
  const feedbackPersistence = resolveFeedFeedbackPersistence(
    customerDataMode,
    Boolean(sessionQuery.data),
  );
  const savedPlacesQuery = useQuery({
    queryKey: [
      "feed",
      "saved-places",
      "explore",
      sessionQuery.data?.user.id ?? null,
    ],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      listSavedCanonicalPlaces({ signal }),
    enabled:
      customerDataMode === "live" &&
      placeApiMode === "canonical" &&
      Boolean(sessionQuery.data),
    retry: false,
    staleTime: 30_000,
  });
  const savedCanonicalPlaceIds = useMemo(
    () => new Set((savedPlacesQuery.data ?? []).map((entry) => entry.placeId)),
    [savedPlacesQuery.data],
  );
  const feedbackHistoryQuery = useQuery({
    queryKey: [
      "feed",
      "feedback-history",
      "explore",
      sessionQuery.data?.user.id ?? null,
    ],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getCoreFeedFeedbackHistory(20, { signal }),
    enabled:
      customerDataMode === "live" &&
      feedbackHistoryOpen &&
      Boolean(sessionQuery.data),
    retry: false,
    staleTime: 15_000,
  });
  const liveFeedQuery = useInfiniteQuery({
    queryKey: [
      "feed",
      "explore",
      activeTab,
      query,
      area,
      vibe,
      feedCategory,
      bookingDate,
      Number.isInteger(feedPartySize) ? feedPartySize : null,
    ],
    queryFn: ({ signal, pageParam }) =>
      getCoreFeedPage(
        {
          tab: activeTab,
          ...(query ? { query } : {}),
          ...(area ? { area } : {}),
          ...(vibe ? { vibe } : {}),
          ...(feedCategory ? { category: feedCategory } : {}),
          ...(bookingDate ? { date: bookingDate } : {}),
          ...(Number.isInteger(feedPartySize) && feedPartySize > 0
            ? { partySize: feedPartySize }
            : {}),
          ...(pageParam ? { cursor: pageParam } : {}),
          limit: 8,
        },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: customerDataMode === "live",
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
  const gatewayOffline =
    customerDataMode === "live" &&
    isGatewayOfflineError(liveFeedQuery.error);

  const baseItems = useMemo(() => {
    if (customerDataMode === "demo" || gatewayOffline)
      return filterDemoDiscoveryItems(
        [...createdItems, ...demoDiscoveryItems],
        activeTab,
        query,
        area,
        vibe,
      );
    const feedPages = liveFeedQuery.data?.pages ?? [];
    return feedPages.flatMap((page) =>
      page.items.map((item) =>
        coreFeedItemToDiscovery(item, page.feedSessionId, savedCanonicalPlaceIds),
      ),
    );
  }, [
    activeTab,
    area,
    createdItems,
    gatewayOffline,
    liveFeedQuery.data,
    query,
    savedCanonicalPlaceIds,
    vibe,
  ]);

  const discoveryModules = useMemo(
    () =>
      customerDataMode === "live"
        ? feedModulesToDiscovery(liveFeedQuery.data?.pages[0]?.modules, baseItems)
        : [],
    [baseItems, liveFeedQuery.data?.pages]
  );

  const moduleItemKeys = useMemo(
    () => new Set(
      discoveryModules.flatMap((module) =>
        module.items.map((item) => `${item.itemType}:${item.id}`),
      ),
    ),
    [discoveryModules],
  );

  const items = useMemo(
    () =>
      baseItems
        .filter((item) => !hiddenIds.has(item.id))
        .map((item): DiscoveryItem => {
          if (item.itemType === "TRACE")
            return {
              ...item,
              saved: unsavedIds.has(item.id)
                ? false
                : item.saved || savedIds.has(item.id),
              followed: unfollowedIds.has(item.id)
                ? false
                : item.followed || followedIds.has(item.id),
            };
          if (item.itemType === "PLACE")
            return {
              ...item,
              saved: unsavedIds.has(item.id)
                ? false
                : item.saved || savedIds.has(item.id),
            };
          if (item.itemType === "POST")
            return {
              ...item,
              liked: unlikedIds.has(item.id)
                ? false
                : item.liked || likedIds.has(item.id),
            };
          return {
            ...item,
            tracer: {
              ...item.tracer,
              following: unfollowedIds.has(item.id)
                ? false
                : item.tracer.following || followedIds.has(item.id),
            },
          };
        }),
    [
      baseItems,
      followedIds,
      hiddenIds,
      likedIds,
      savedIds,
      unfollowedIds,
      unlikedIds,
      unsavedIds,
    ],
  );

  const partnerPlaces = useMemo(
    () =>
      items.filter(
        (item): item is DiscoveryPlace =>
          item.itemType === "PLACE" &&
          item.isAevoPlayPartner === true &&
          (placeApiMode !== "canonical" || Boolean(item.venueSlug)),
      ),
    [items],
  );
  const fallbackTrace = useMemo(
    () =>
      items.find(
        (item): item is DiscoveryTrace => item.itemType === "TRACE",
      ) ?? null,
    [items],
  );
  const trendingTracers = useMemo(
    () =>
      items.filter(
        (item): item is DiscoveryTracer => item.itemType === "TRACER",
      ),
    [items],
  );
  const heroImageUrl = useMemo(() => {
    if (customerDataMode !== "demo") return null;
    const trace = baseItems.find(
      (item): item is DiscoveryTrace => item.itemType === "TRACE",
    );
    return trace?.coverImages?.[0] ?? null;
  }, [baseItems]);

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates))
      value ? next.set(key, value) : next.delete(key);
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };

  const selectedId = searchParams.get("selected");
  const [activeSpyItemId, setActiveSpyItemId] = useState<string | null>(null);
  const scrollSpyTimerRef = useRef<number | null>(null);

  const selectedTrace = useMemo(() => {
    if (!selectedId) return null;
    const selected = items.find(
      (item) =>
        item.itemType === "TRACE" &&
        (item.id === selectedId || item.slug === selectedId),
    );
    return selected?.itemType === "TRACE" ? selected : null;
  }, [items, selectedId]);

  const selectedPost = useMemo(() => {
    if (!selectedId) return null;
    const selected = items.find(
      (item): item is DiscoveryPost => item.itemType === "POST" && item.id === selectedId,
    );
    return selected ?? null;
  }, [items, selectedId]);

  const selectedPlace = useMemo(() => {
    if (!selectedId) return null;
    const selected = items.find(
      (item): item is DiscoveryPlace => item.itemType === "PLACE" && item.id === selectedId,
    );
    return selected ?? null;
  }, [items, selectedId]);

  const selectedPostTrace = useMemo(() => {
    if (!selectedPost?.attachedObject || selectedPost.attachedObject.itemType !== "TRACE") return null;
    const attachedId = selectedPost.attachedObject.id;
    const attachedSlug = selectedPost.attachedObject.href.replace("/traces/", "");
    return items.find(
      (item): item is DiscoveryTrace =>
        item.itemType === "TRACE" && (item.id === attachedId || item.slug === attachedSlug),
    ) ?? null;
  }, [items, selectedPost]);

  // A selected post owns its detail page. The attached trace remains useful
  // as context, but it must not replace the post when the user chose the post
  // or its comment icon.
  const detailTrace = selectedTrace ?? (selectedPost ? null : selectedPostTrace);
  const modalTrace = detailTrace;
  const modalPost = detailTrace ? null : selectedPost;
  const modalCreator = modalPost?.author ?? modalTrace?.creator ?? null;
  const detailOpen = Boolean(detailTrace || selectedPost || selectedPlace);
  const selectedFeedItemId = selectedTrace?.id ?? selectedPost?.id ?? selectedPlace?.id ?? null;

  const savedPageScrollTopRef = useRef<number | null>(null);
  const selectionAnchorRef = useRef<DiscoverySelectionAnchor | null>(null);
  const selectionFocusTargetRef = useRef<HTMLElement | null>(null);

  // Keep the clicked card at the same visual anchor while the DOM changes from
  // the Facebook-like three-column feed into the master/detail workspace. We
  // never call scrollIntoView here: it can choose the wrong ancestor and move
  // the page and the feed column at the same time.
  useLayoutEffect(() => {
    if (!detailOpen || !selectedFeedItemId) return;
    setActiveSpyItemId(selectedFeedItemId);

    const anchor = selectionAnchorRef.current;
    if (!anchor || anchor.itemId !== selectedFeedItemId) return;

    const restore = () => {
      const feed = feedColumnRef.current;
      const card = findDiscoveryCard(selectedFeedItemId);
      if (!card) return;

      const feedOwnsScroll = Boolean(
        feed && feed.scrollHeight > feed.clientHeight + 1,
      );
      if (feedOwnsScroll && feed) {
        feed.scrollTop = anchor.feedScrollTop;
      }

      const currentTop = card.getBoundingClientRect().top;
      const delta = currentTop - (anchor.cardTop ?? currentTop);
      if (Math.abs(delta) < 1) return;

      if (feedOwnsScroll && feed) {
        feed.scrollTop += delta;
      } else {
        safeWindowScrollTo({
          top: anchor.pageScrollTop + delta,
          behavior: "auto",
        });
      }
    };

    if (typeof window.requestAnimationFrame !== "function") {
      const timeoutId = window.setTimeout(restore, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      restore();
      secondFrame = window.requestAnimationFrame(restore);
    });
    const settleTimeout = window.setTimeout(restore, 48);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settleTimeout);
    };
  }, [detailOpen, selectedFeedItemId]);

  // The detail column is removed only after the close transition. Restore the
  // page position from the post-removal layout, otherwise the browser can keep
  // the temporary split-view scroll clamp and leave the feed one viewport too
  // low after the column disappears.
  useLayoutEffect(() => {
    if (detailOpen) return;
    const anchor = selectionAnchorRef.current;
    if (!anchor) return;

    const restore = () => {
      safeWindowScrollTo({ top: anchor.pageScrollTop, behavior: "auto" });
      const feed = feedColumnRef.current;
      if (feed && feed.scrollHeight > feed.clientHeight + 1) {
        feed.scrollTop = anchor.feedScrollTop;
      }
      focusSelectionTarget(selectionFocusTargetRef.current, anchor.itemId);
    };

    if (typeof window.requestAnimationFrame !== "function") {
      const timeoutId = window.setTimeout(() => {
        restore();
        selectionAnchorRef.current = null;
        selectionFocusTargetRef.current = null;
        savedPageScrollTopRef.current = null;
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      restore();
      secondFrame = window.requestAnimationFrame(restore);
    });
    const settleTimeout = window.setTimeout(() => {
      restore();
      selectionAnchorRef.current = null;
      selectionFocusTargetRef.current = null;
      savedPageScrollTopRef.current = null;
    }, 80);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settleTimeout);
    };
  }, [detailOpen]);

  const activeFeedTrace = useMemo(() => {
    const activeItem = items.find((item) => item.id === activeSpyItemId);
    return activeItem
      ? traceFromDiscoveryItem(items, activeItem) ?? fallbackTrace
      : fallbackTrace;
  }, [activeSpyItemId, fallbackTrace, items]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const cardElements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-discovery-item-id]"),
    );
    if (cardElements.length === 0) return;

    const visibleEntries = new Map<string, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-discovery-item-id");
          if (!id) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            visibleEntries.set(id, entry);
          } else {
            visibleEntries.delete(id);
          }
        }

        if (scrollSpyTimerRef.current !== null) {
          window.clearTimeout(scrollSpyTimerRef.current);
        }

        scrollSpyTimerRef.current = window.setTimeout(() => {
          scrollSpyTimerRef.current = null;
          const viewportCenter = window.innerHeight / 2;
          const closestEntry = [...visibleEntries.values()]
            .filter((entry) => entry.intersectionRatio >= 0.5)
            .sort((left, right) => {
              const leftRect = left.boundingClientRect;
              const rightRect = right.boundingClientRect;
              const leftDistance = Math.abs((leftRect.top + leftRect.bottom) / 2 - viewportCenter);
              const rightDistance = Math.abs((rightRect.top + rightRect.bottom) / 2 - viewportCenter);
              return leftDistance - rightDistance;
            })[0];
          const closestId = closestEntry?.target.getAttribute("data-discovery-item-id");
          if (!closestId) return;

          // Once detail is open, the selected card is the stable master
          // reference. Letting scroll-spy replace it while the user reads the
          // detail panel makes the left column appear to jump or remount.
          if (detailOpen) return;

          setActiveSpyItemId(closestId);

        }, 120);
      },
      { threshold: [0.5, 0.6], rootMargin: "-10% 0px -10% 0px" },
    );

    cardElements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      if (scrollSpyTimerRef.current !== null) {
        window.clearTimeout(scrollSpyTimerRef.current);
        scrollSpyTimerRef.current = null;
      }
    };
  }, [detailOpen, items]);

  const [isClosingDetail, setIsClosingDetail] = useState(false);
  const [closingDetailTrace, setClosingDetailTrace] = useState<DiscoveryTrace | null>(null);
  const [closingSelectedPost, setClosingSelectedPost] = useState<DiscoveryPost | null>(null);
  const [closingSelectedPlace, setClosingSelectedPlace] = useState<DiscoveryPlace | null>(null);
  const closingTimeoutRef = useRef<number | null>(null);

  const activeDetailTrace = detailTrace || closingDetailTrace;
  const activeSelectedPost = selectedPost || closingSelectedPost;
  const activeSelectedPlace = selectedPlace || closingSelectedPlace;

  useEffect(() => {
    return () => {
      if (closingTimeoutRef.current !== null) {
        window.clearTimeout(closingTimeoutRef.current);
        closingTimeoutRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    setExploreDetailViewportState(detailOpen || isClosingDetail);

    return () => setExploreDetailViewportState(false);
  }, [detailOpen, isClosingDetail]);

  const captureSelectionAnchor = (itemId: string) => {
    const pageScrollTop = getDocumentScrollTop();
    const card = findDiscoveryCard(itemId);
    const feed = feedColumnRef.current;
    const activeElement = document.activeElement;
    savedPageScrollTopRef.current = pageScrollTop;
    selectionFocusTargetRef.current = activeElement instanceof HTMLElement && card?.contains(activeElement)
      ? activeElement
      : card?.querySelector<HTMLElement>("button, a, [tabindex]:not([tabindex='-1'])") ?? null;
    selectionAnchorRef.current = {
      itemId,
      pageScrollTop,
      feedScrollTop: feed?.scrollTop ?? 0,
      cardTop: card?.getBoundingClientRect().top ?? null,
    };
  };

  const selectTrace = (trace: DiscoveryTrace) => {
    captureSelectionAnchor(trace.id);
    if (closingTimeoutRef.current !== null) {
      window.clearTimeout(closingTimeoutRef.current);
      closingTimeoutRef.current = null;
    }
    setIsClosingDetail(false);
    setClosingDetailTrace(null);
    setClosingSelectedPost(null);
    setClosingSelectedPlace(null);
    setActiveSpyItemId(trace.id);
    setCommentFocusRequest(null);
    setMediaModalOpen(false);
    setMediaModalIndex(0);
    updateParams({ selected: trace.slug });
  };
  const closeTrace = () => {
    setMediaModalOpen(false);
    const targetScroll = savedPageScrollTopRef.current;
    const restorePagePosition = () => {
      if (targetScroll === null) return;
      const restore = () => safeWindowScrollTo({ top: targetScroll, behavior: "auto" });
      if (typeof window.requestAnimationFrame !== "function") {
        window.setTimeout(restore, 0);
        return;
      }
      let secondFrame: number | null = null;
      const firstFrame = window.requestAnimationFrame(() => {
        restore();
        secondFrame = window.requestAnimationFrame(restore);
      });
      window.setTimeout(() => {
        window.cancelAnimationFrame(firstFrame);
        if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
        restore();
      }, 48);
    };
    if (detailTrace || selectedPost || selectedPlace) {
      setClosingDetailTrace(detailTrace);
      setClosingSelectedPost(selectedPost);
      setClosingSelectedPlace(selectedPlace);
      setIsClosingDetail(true);
      if (closingTimeoutRef.current !== null) {
        window.clearTimeout(closingTimeoutRef.current);
      }
      closingTimeoutRef.current = window.setTimeout(() => {
        setIsClosingDetail(false);
        setClosingDetailTrace(null);
        setClosingSelectedPost(null);
        setClosingSelectedPlace(null);
        closingTimeoutRef.current = null;
        updateParams({ selected: null });
      }, DETAIL_CLOSE_DURATION_MS);
    } else {
      updateParams({ selected: null });
      restorePagePosition();
      if (selectionAnchorRef.current) {
        focusSelectionTarget(selectionFocusTargetRef.current, selectionAnchorRef.current.itemId);
      }
      selectionAnchorRef.current = null;
      selectionFocusTargetRef.current = null;
    }
  };

  useEffect(() => {
    if (!detailOpen || mediaModalOpen || isClosingDetail) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeTrace();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailOpen, isClosingDetail, mediaModalOpen, selectedFeedItemId]);

  const openMedia = (index: number) => {
    setMediaModalIndex(Math.max(0, index));
    setMediaModalOpen(true);
  };
  const closeMedia = () => setMediaModalOpen(false);

  const handleOpenPostDetail = (post: DiscoveryPost) => {
    captureSelectionAnchor(post.id);
    if (closingTimeoutRef.current !== null) {
      window.clearTimeout(closingTimeoutRef.current);
      closingTimeoutRef.current = null;
    }
    setIsClosingDetail(false);
    setClosingDetailTrace(null);
    setClosingSelectedPost(null);
    setClosingSelectedPlace(null);
    setActiveSpyItemId(post.id);
    setCommentFocusRequest(null);
    setMediaModalOpen(false);
    setMediaModalIndex(0);
    updateParams({ selected: post.id });
  };

  const handleComment = (item: DiscoveryItem) => {
    captureSelectionAnchor(item.id);
    if (closingTimeoutRef.current !== null) {
      window.clearTimeout(closingTimeoutRef.current);
      closingTimeoutRef.current = null;
    }
    setIsClosingDetail(false);
    setClosingDetailTrace(null);
    setClosingSelectedPost(null);
    setClosingSelectedPlace(null);
    setActiveSpyItemId(item.id);
    setMediaModalOpen(false);
    setCommentFocusRequest((current) => ({
      itemId: item.id,
      key: (current?.key ?? 0) + 1,
    }));
    if (item.itemType === "TRACE") {
      updateParams({ selected: item.slug });
      return;
    }
    updateParams({ selected: item.id });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (input.trim()) next.set("q", input.trim());
    else next.delete("q");
    if (bookingDate) next.set("availableAt", bookingDate);
    else next.delete("availableAt");
    const parsedPartySize = Number(partySize);
    if (Number.isInteger(parsedPartySize) && parsedPartySize > 0) {
      next.set("partySize", String(parsedPartySize));
    } else {
      next.delete("partySize");
    }
    next.delete("date");
    next.delete("party");
    if (activePortalCategory === "trace") {
      next.set("mode", "traces");
      next.delete("category");
      next.delete("categoryIds");
      next.delete("reservable");
    } else {
      next.delete("mode");
      const categoryMap: Partial<Record<ExplorePortalCategory, string>> = {
        cafe: "Cafe",
        dining: "Dining",
        activities: "Activities",
      };
      const category = categoryMap[activePortalCategory];
      if (category) next.set("categoryIds", category);
      else next.delete("categoryIds");
      if (activePortalCategory === "play") next.set("reservable", "1");
      else next.delete("reservable");
      next.delete("category");
    }
    next.set("searched", "1");
    navigate(`/map?${next.toString()}`);
  };

  const setTab = (nextTab: string) =>
    updateParams({ tab: nextTab === "for_you" ? null : nextTab, cursor: null });

  const runAction = async (
    item: DiscoveryItem,
    action: DiscoveryAction,
    hideReasonCode?: FeedFeedbackReasonCode,
  ): Promise<void> => {
    const key = actionKey(item, action);
    if (actionStates[key]?.pending) return;
    if (action === "comment") {
      handleComment(item);
      return;
    }
    if (action === "remix" && item.itemType === "TRACE") {
      navigate(`/traces/${item.slug}?remix=1`);
      return;
    }
    if (action === "share") {
      if (navigator.share) {
        try {
          await navigator.share({
            title: item.itemType === "POST" ? item.author.name : "Aevocado Go",
            url: window.location.href,
          });
          if (customerDataMode === "live") {
            enqueueExploreFeedEvent(item, "share", activeTab);
          }
          notify("เปิด share sheet แล้ว");
        } catch {
          // User-cancelled shares do not need an error toast.
        }
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href).then(
          () => {
            if (customerDataMode === "live") {
              enqueueExploreFeedEvent(item, "share", activeTab);
            }
            notify("คัดลอกลิงก์แล้ว");
          },
          () => {
            notify("คัดลอกลิงก์ไม่สำเร็จ");
            setActionStates((current) => updateActionState(current, key, { pending: false, error: "คัดลอกลิงก์ไม่สำเร็จ" }));
          },
        );
      } else {
        notify("อุปกรณ์นี้ยังไม่รองรับการแชร์");
        setActionStates((current) =>
          updateActionState(current, key, {
            pending: false,
            error: "คัดลอกลิงก์ไม่สำเร็จ",
          }),
        );
      }
      return;
    }
    const supportsAnonymousEntityHide =
      action === "hide" &&
      (item.itemType === "TRACE" || item.itemType === "PLACE") &&
      (customerDataMode === "demo" ||
        (sessionQuery.isSuccess && !sessionQuery.data));
    if (
      customerDataMode === "live" &&
      !sessionQuery.data &&
      !supportsAnonymousEntityHide
    ) {
      setActionStates((current) =>
        updateActionState(current, key, { pending: true, error: null }),
      );
      try {
        await beginGoSignIn(window.location.pathname + window.location.search);
        setActionStates((current) =>
          updateActionState(current, key, { pending: false, error: null }),
        );
      } catch {
        setActionStates((current) =>
          updateActionState(current, key, {
            pending: false,
            error: "ยังไม่สามารถเริ่มการเข้าสู่ระบบได้ ลองใหม่ได้",
          }),
        );
      }
      return;
    }
    setActionStates((current) =>
      updateActionState(current, key, { pending: true, error: null }),
    );
    try {
      if (customerDataMode === "live") {
        if (
          item.itemType === "TRACE" &&
          (action === "trace" || action === "follow")
        ) {
          const active = action === "trace" ? item.saved : item.followed;
          await applyTraceDeeTraceAction(
            item.slug,
            action === "trace"
              ? active
                ? "unsave"
                : "save"
              : active
                ? "unfollow"
                : "follow",
            createIdempotencyKey(`explore-${action}`),
          );
        } else if (item.itemType === "PLACE" && action === "trace") {
          if (placeApiMode === "canonical") {
            if (!item.canonicalPlaceId) {
              throw new Error("canonical-place-reference-missing");
            }
            const savedState = await setCanonicalPlaceSaved(
              item.canonicalPlaceId,
              !item.saved,
              createIdempotencyKey("explore-place-save"),
            );
            if (
              savedState.placeId !== item.canonicalPlaceId ||
              savedState.saved !== !item.saved
            ) {
              throw new Error("canonical-place-save-state-mismatch");
            }
            await queryClient.invalidateQueries({
              queryKey: [
                "feed",
                "saved-places",
                "explore",
                sessionQuery.data?.user.id ?? null,
              ],
            });
          }
          else if (item.saved) await removeCustomerFavorite(item.slug);
          else await saveCustomerFavorite(item.slug);
        } else if (item.itemType === "TRACER" && action === "follow") {
          await setTraceDeeTracerFollow(
            item.tracer.id,
            !item.tracer.following,
            createIdempotencyKey("explore-tracer-follow"),
          );
        } else if (
          (item.itemType === "TRACE" || item.itemType === "PLACE") &&
          action === "hide"
        ) {
          if (feedbackPersistence === "core") {
            if (!item.feedSessionId || !item.trackingToken) {
              throw new Error("feed-feedback-context-missing");
            }
            const feedback = await postCoreFeedFeedback({
              schemaVersion: "1",
              feedSessionId: item.feedSessionId,
              itemToken: item.trackingToken,
              action: "hide",
              ...(hideReasonCode ? { reasonCode: hideReasonCode } : {}),
            });
            if (
              feedback.itemType !== item.itemType ||
              feedback.itemId !== item.id ||
              feedback.active !== true
            ) {
              throw new Error("feed-feedback-state-mismatch");
            }
            if (feedbackHistoryOpen) void feedbackHistoryQuery.refetch();
          }
        } else {
          throw new Error("unsupported-explore-action");
        }
      } else {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
      }
      if (
        customerDataMode === "live" &&
        action === "trace" &&
        (item.itemType === "TRACE" || item.itemType === "PLACE") &&
        !item.saved
      ) {
        enqueueExploreFeedEvent(item, "save", activeTab);
      }
      if (
        action === "trace" &&
        (item.itemType === "TRACE" || item.itemType === "PLACE")
      ) {
        const active = item.saved;
        if (active) {
          setUnsavedIds((current) => new Set(current).add(item.id));
          setSavedIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        } else {
          setSavedIds((current) => new Set(current).add(item.id));
          setUnsavedIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        }
      }
      if (
        action === "follow" &&
        (item.itemType === "TRACE" || item.itemType === "TRACER")
      ) {
        const active =
          item.itemType === "TRACE" ? item.followed : item.tracer.following;
        if (active) {
          setUnfollowedIds((current) => new Set(current).add(item.id));
          setFollowedIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        } else {
          setFollowedIds((current) => new Set(current).add(item.id));
          setUnfollowedIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        }
      }
      if (action === "like" && item.itemType === "POST") {
        if (item.liked) {
          setUnlikedIds((current) => new Set(current).add(item.id));
          setLikedIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        } else {
          setLikedIds((current) => new Set(current).add(item.id));
          setUnlikedIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        }
      }
      if (action === "hide") {
        setHiddenIds((current) => new Set(current).add(item.id));
        setHiddenItem(item);
        setHiddenFeedbackPersistence(feedbackPersistence);
        setPendingHideItem(null);
      }
      if (action === "trace" && (item.itemType === "TRACE" || item.itemType === "PLACE")) {
        notify(item.saved ? "นำออกจาก Saved แล้ว" : "บันทึกไว้ใน Saved แล้ว");
      }
      if (action === "follow" && (item.itemType === "TRACE" || item.itemType === "TRACER")) {
        const active = item.itemType === "TRACE" ? item.followed : item.tracer.following;
        notify(active ? "ยกเลิกการติดตามแล้ว" : "ติดตามแล้ว");
      }
      if (action === "like") notify(item.itemType === "POST" && item.liked ? "ยกเลิกถูกใจแล้ว" : "ถูกใจแล้ว");
      if (action === "hide") {
        notify(
          feedbackPersistence === "core"
            ? "ซ่อนรายการนี้แล้ว"
            : "ซ่อนรายการนี้แล้วในเซสชันนี้",
        );
      }
      setActionStates((current) =>
        updateActionState(current, key, { pending: false, error: null }),
      );
    } catch (error) {
      const message = error instanceof Error && error.message === "canonical-place-reference-missing"
        ? "รายการนี้ยังไม่มี canonical Place ID จึงบันทึกไม่ได้"
        : error instanceof Error && error.message === "canonical-place-save-state-mismatch"
          ? "สถานะการบันทึก Place ไม่ตรงกับ Core ลองใหม่ได้"
        : error instanceof Error && error.message === "feed-feedback-context-missing"
          ? "รายการนี้ไม่มีบริบท Feed ที่ใช้ซ่อนแบบถาวร ลองโหลดฟีดใหม่"
          : error instanceof Error && error.message === "feed-feedback-state-mismatch"
            ? "สถานะการซ่อนรายการไม่ตรงกับ Core ลองใหม่ได้"
        : "ยังทำรายการไม่สำเร็จ ลองใหม่ได้";
      notify(message);
      setActionStates((current) =>
        updateActionState(current, key, {
          pending: false,
          error: message,
        }),
      );
    }
  };

  const restoreHiddenItem = async (): Promise<void> => {
    if (!hiddenItem || restorePending) return;
    setRestorePending(true);
    try {
      const persistence = hiddenFeedbackPersistence ?? feedbackPersistence;
      if (persistence === "core") {
        if (!sessionQuery.data) {
          throw new Error("feed-feedback-auth-required");
        }
        if (
          (hiddenItem.itemType !== "TRACE" && hiddenItem.itemType !== "PLACE") ||
          !hiddenItem.feedSessionId ||
          !hiddenItem.trackingToken
        ) {
          throw new Error("feed-feedback-context-missing");
        }
        const feedback = await postCoreFeedFeedback({
          schemaVersion: "1",
          feedSessionId: hiddenItem.feedSessionId,
          itemToken: hiddenItem.trackingToken,
          action: "unhide",
        });
        if (
          feedback.itemType !== hiddenItem.itemType ||
          feedback.itemId !== hiddenItem.id ||
          feedback.active !== false
        ) {
          throw new Error("feed-feedback-state-mismatch");
        }
        void liveFeedQuery.refetch();
        if (feedbackHistoryOpen) void feedbackHistoryQuery.refetch();
      } else {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
      }
      setHiddenIds((current) => {
        const next = new Set(current);
        next.delete(hiddenItem.id);
        return next;
      });
      setHiddenItem(null);
      setHiddenFeedbackPersistence(null);
      notify("นำรายการกลับมาแล้ว");
    } catch (error) {
      const message = error instanceof Error && error.message === "feed-feedback-context-missing"
        ? "รายการนี้ไม่มีบริบท Feed สำหรับเลิกซ่อน ลองโหลดฟีดใหม่"
        : error instanceof Error && error.message === "feed-feedback-state-mismatch"
          ? "สถานะเลิกซ่อนไม่ตรงกับ Core ลองใหม่ได้"
          : error instanceof Error && error.message === "feed-feedback-auth-required"
            ? "เข้าสู่ระบบก่อนเลิกซ่อนรายการนี้ เพื่อแก้สถานะใน Core"
          : "ยังเลิกซ่อนรายการไม่ได้ ลองใหม่ได้";
      notify(message);
    } finally {
      setRestorePending(false);
    }
  };

  const creatorActionKey = (profile: DiscoveryTracerSummary) => `creator-follow:${profile.id}`;
  const creatorIsFollowed = (profile: DiscoveryTracerSummary): boolean => unfollowedCreatorIds.has(profile.id)
    ? false
    : profile.following || followedCreatorIds.has(profile.id);
  const runCreatorFollow = async (profile: DiscoveryTracerSummary): Promise<void> => {
    const key = creatorActionKey(profile);
    if (actionStates[key]?.pending) return;
    if (customerDataMode === "live" && !sessionQuery.data) {
      try {
        await beginGoSignIn(window.location.pathname + window.location.search);
      } catch {
        notify("ยังไม่สามารถเริ่มการเข้าสู่ระบบได้ ลองใหม่ได้");
      }
      return;
    }
    const active = creatorIsFollowed(profile);
    setActionStates((current) => updateActionState(current, key, { pending: true, error: null }));
    try {
      const nextFollowing = !active;
      if (customerDataMode === "live") {
        const response = await setTraceDeeTracerFollow(profile.id, nextFollowing, createIdempotencyKey("explore-creator-follow"));
        if (response.follow.following !== nextFollowing) throw new Error("creator-follow-state-mismatch");
      } else {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
      }
      if (nextFollowing) {
        setFollowedCreatorIds((current) => new Set(current).add(profile.id));
        setUnfollowedCreatorIds((current) => { const next = new Set(current); next.delete(profile.id); return next; });
      } else {
        setUnfollowedCreatorIds((current) => new Set(current).add(profile.id));
        setFollowedCreatorIds((current) => { const next = new Set(current); next.delete(profile.id); return next; });
      }
      notify(nextFollowing ? `ติดตาม ${profile.name} แล้ว` : `ยกเลิกการติดตาม ${profile.name} แล้ว`);
      setActionStates((current) => updateActionState(current, key, { pending: false, error: null }));
    } catch {
      notify("ยังเปลี่ยนสถานะการติดตามไม่ได้ ลองใหม่ได้");
      setActionStates((current) => updateActionState(current, key, { pending: false, error: "ยังเปลี่ยนสถานะการติดตามไม่ได้ ลองใหม่ได้" }));
    }
  };

  const publishComposerDraft = (draft: DiscoveryComposerDraft): void => {
    if (customerDataMode !== "demo") return;
    composerSequenceRef.current += 1;
    const sequence = composerSequenceRef.current;
    const itemId = `local-${draft.mode}-${Date.now()}-${sequence}`;
    const creator: DiscoveryTracerSummary = {
      id: "current-customer",
      name: "คุณ",
      initials: "AG",
      expertise: draft.tags.length > 0 ? [...draft.tags].slice(0, 2) : ["city explorer"],
      area: draft.mode === "trace" ? draft.area || "Bangkok" : draft.location || "Bangkok",
      following: false,
      profileAvailable: true,
      bio: "บันทึกเมืองในแบบของตัวเองผ่าน Aevocado GO",
    };

    if (draft.mode === "trace") {
      const toTileLabel = (value: string | undefined, fallback: string): string => {
        const label = value?.trim();
        return label ? Array.from(label).slice(0, 3).join("").toUpperCase() : fallback;
      };
      const coverTiles = [
        toTileLabel(draft.stops[0], "GO"),
        toTileLabel(draft.stops[1], "TR"),
        toTileLabel(draft.stops[2], "01"),
      ] as [string, string, string];
      const publishedTrace: DiscoveryTrace = {
        id: itemId,
        itemType: "TRACE",
        slug: itemId,
        title: draft.title,
        description: draft.description || "เส้นทางที่จัดไว้เพื่อให้คนอื่นเดินตามได้ในจังหวะของตัวเอง",
        area: draft.area || "Bangkok",
        creator,
        presentation: {
          style: draft.style,
          feeling: draft.feeling,
          tags: draft.tags,
          visibility: draft.visibility,
        },
        coverTiles,
        ...(draft.media.length > 0 ? { coverImages: draft.media.map((image) => image.src) } : {}),
        ...(draft.routeStops.length > 0 ? { routeStops: draft.routeStops } : {}),
        topicTags: [...draft.tags, ...(draft.feeling ? [draft.feeling] : [])],
        stopCount: draft.stops.length,
        durationMinutes: null,
        distanceKm: null,
        budgetLabel: null,
        followerCount: 0,
        remixCount: 0,
        completionCount: 0,
        rating: null,
        saved: false,
        followed: false,
        comments: [],
        reason: {
          code: "NEW_IN_SAVED_AREA",
          matchedAreas: draft.area ? [draft.area] : [],
        },
      };
      setCreatedItems((current) => [publishedTrace, ...current]);
      setActiveSpyItemId(publishedTrace.id);
      return;
    }

    const publishedPost: DiscoveryPost = {
      id: itemId,
      itemType: "POST",
      author: creator,
      body: draft.body,
      publishedLabel: "เมื่อสักครู่",
      mediaLabels: draft.media.length > 0 ? draft.media.map((image) => image.name) : ["โพสต์จากคุณ"],
      ...(draft.media.length > 0 ? { mediaImages: draft.media.map((image) => image.src) } : {}),
      attachedObject: null,
      presentation: {
        style: draft.style,
        feeling: draft.feeling,
        tags: draft.tags,
        visibility: draft.visibility,
      },
      likeCount: 0,
      liked: false,
      comments: [],
      reason: {
        code: "NEW_IN_SAVED_AREA",
        matchedAreas: draft.location ? [draft.location] : [],
      },
    };
    setCreatedItems((current) => [publishedPost, ...current]);
    setActiveSpyItemId(publishedPost.id);
  };

  const getActionState = (
    item: DiscoveryItem,
    action: DiscoveryAction,
  ): DiscoveryActionState | undefined => actionStates[actionKey(item, action)];
  const handlers = {
    onAction: (item: DiscoveryItem, action: DiscoveryAction) => {
      if (action === "hide") {
        setPendingHideItem(item);
        return;
      }
      void runAction(item, action);
    },
    onComment: handleComment,
    onOpenPostDetail: handleOpenPostDetail,
    onInlineCommentSubmit: customerDataMode === "demo"
      ? async (_item: DiscoveryItem, _body: string, _parentId?: string) => {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 260));
        }
      : undefined,
    onCommentEdit: customerDataMode === "demo"
      ? async (_item: DiscoveryItem, _commentId: string, _body: string) => {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
        }
      : undefined,
    onCommentDelete: customerDataMode === "demo"
      ? async (_item: DiscoveryItem, _commentId: string) => {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
        }
      : undefined,
    onFollowCommenter: customerDataMode === "demo"
      ? async (profile: DiscoveryCommentProfile) => {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 160));
          notify(`ติดตาม ${profile.name} แล้ว`);
        }
      : undefined,
    onSelectTrace: selectTrace,
    onStartTrace: (trace: DiscoveryTrace) => {
      navigate(`/map?mode=traces&trace=${encodeURIComponent(trace.slug)}`);
    },
    selectedTraceId: selectedTrace?.id ?? null,
    activeSpyItemId,
    onCreatorFollow: customerDataMode === "demo"
      ? (profile: DiscoveryTracerSummary) => {
          void runCreatorFollow(profile);
        }
      : undefined,
    creatorFollowing: creatorIsFollowed,
    creatorFollowState: (profile: DiscoveryTracerSummary) =>
      actionStates[creatorActionKey(profile)],
    actionState: getActionState,
    onOpen: (item: DiscoveryItem) => {
      if (customerDataMode === "live") {
        if (item.itemType === "TRACE" || item.itemType === "PLACE") {
          enqueueExploreFeedEvent(
            item,
            item.itemType === "PLACE" ? "place_open" : "open",
            activeTab,
          );
        }
      }
    },
    onImpression: (item: DiscoveryItem, position: number) => {
      if (customerDataMode === "live") {
        enqueueExploreFeedEvent(item, "impression", activeTab, position);
      }
    },
    onHide: (item: DiscoveryItem) => {
      setPendingHideItem(item);
    },
  };
  const isLoading =
    customerDataMode === "live" &&
    liveFeedQuery.isLoading &&
    items.length === 0;
  const hasError =
    customerDataMode === "live" &&
    (liveFeedQuery.isError && !isGatewayOfflineError(liveFeedQuery.error));
  const isOffline =
    gatewayOffline ||
    (typeof navigator !== "undefined" && navigator.onLine === false);

  return (
    <div className="page-frame discovery-page discovery-page--master-detail">
      <ExploreBookingPortal
        activeCategory={activePortalCategory}
        area={area}
        date={bookingDate}
        demoMode={customerDataMode === "demo"}
        heroImageUrl={heroImageUrl}
        inputRef={searchInputRef}
        partnerPlaces={partnerPlaces}
        partySize={partySize}
        query={input}
        promoOpen={promoOpen}
        onAreaChange={(value) => updateParams({ area: value === "Bangkok" ? null : value })}
        onBookingSubmit={submitSearch}
        onCategoryChange={(category) => updateParams({ category: category === "all" ? null : category })}
        onDateChange={(value) => updateParams({ date: value || null })}
        onDismissPromo={() => setPromoOpen(false)}
        onNotify={notify}
        onPartySizeChange={(value) => updateParams({ party: value || null })}
        onQueryChange={setInput}
      />

      <section className="discovery-feed-tabs" aria-label="ตัวกรองฟีด Explore">
        <div>
          <p className="eyebrow">DISCOVER FEED</p>
          <h2>แรงบันดาลใจสำหรับทริปถัดไป</h2>
        </div>
        <GlidingGroup
          items={feedTabs}
          activeId={activeTab}
          onChange={setTab}
          ariaLabel="ประเภทฟีด Explore"
          role="tablist"
          size="small"
        />
      </section>

      <div className="discovery-status-stack">
        {gatewayOffline && items.length > 0 && (
          <div className="stale-data-notice" role="status">
            การเชื่อมต่อข้อมูลจริงยังไม่พร้อม · กำลังแสดงข้อมูลตัวอย่างในเครื่อง
            <button
              className="text-link text-link--button"
              type="button"
              onClick={() => {
                void liveFeedQuery.refetch();
                void sessionQuery.refetch();
              }}
            >
              ลองเชื่อมต่อใหม่
            </button>
          </div>
        )}
        {isOffline && !gatewayOffline && items.length > 0 && (
          <div className="stale-data-notice" role="status">
            กำลังออฟไลน์ · แสดงคำแนะนำล่าสุดที่บันทึกไว้
          </div>
        )}
        {customerDataMode === "demo" && (
          <div className="demo-data-notice" role="note">
            ตัวอย่างข้อมูลสำหรับทดสอบ interaction เท่านั้น
            ไม่ใช่สถานะจริงของร้านหรือ availability
          </div>
        )}
        {pendingHideItem && (
          <div className="stale-data-notice" role="dialog" aria-label="เลือกเหตุผลที่ซ่อนรายการ">
            <span>
              ทำไมจึงไม่อยากเห็น {pendingHideItem.itemType === "TRACE" ? pendingHideItem.title : pendingHideItem.itemType === "PLACE" ? pendingHideItem.name : "รายการนี้"}?
            </span>
            <div className="button-row">
              {hideReasonOptions.map((option) => (
                <button
                  key={option.code}
                  className="text-link text-link--button"
                  type="button"
                  disabled={actionStates[actionKey(pendingHideItem, "hide")]?.pending === true}
                  onClick={() => void runAction(pendingHideItem, "hide", option.code)}
                >
                  {option.label}
                </button>
              ))}
              <button
                className="text-link text-link--button"
                type="button"
                disabled={actionStates[actionKey(pendingHideItem, "hide")]?.pending === true}
                onClick={() => void runAction(pendingHideItem, "hide")}
              >
                ไม่ระบุเหตุผล
              </button>
              <button
                className="text-link text-link--button"
                type="button"
                disabled={actionStates[actionKey(pendingHideItem, "hide")]?.pending === true}
                onClick={() => setPendingHideItem(null)}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
        {hiddenItem && (
          <div className="stale-data-notice" role="status">
            ซ่อน {hiddenItem.itemType === "TRACE" ? hiddenItem.title : hiddenItem.itemType === "PLACE" ? hiddenItem.name : "รายการนี้"} แล้ว
            <button
              className="text-link text-link--button"
              type="button"
              disabled={restorePending}
              onClick={() => void restoreHiddenItem()}
            >
              {restorePending ? "กำลังเลิกซ่อน…" : "เลิกซ่อน"}
            </button>
          </div>
        )}
        {customerDataMode === "live" && sessionQuery.data && (
          <div className="stale-data-notice" role="region" aria-label="ประวัติการซ่อนรายการ">
            <button
              className="text-link text-link--button"
              type="button"
              aria-expanded={feedbackHistoryOpen}
              onClick={() => setFeedbackHistoryOpen((current) => !current)}
            >
              {feedbackHistoryOpen ? "ซ่อนประวัติการซ่อน" : "ดูประวัติการซ่อน"}
            </button>
            {feedbackHistoryOpen && (
              <div className="button-row" aria-busy={feedbackHistoryQuery.isLoading}>
                {feedbackHistoryQuery.isLoading && <span>กำลังโหลดประวัติ…</span>}
                {feedbackHistoryQuery.isError && (
                  <span>
                    โหลดประวัติไม่สำเร็จ
                    <button
                      className="text-link text-link--button"
                      type="button"
                      onClick={() => void feedbackHistoryQuery.refetch()}
                    >
                      ลองใหม่
                    </button>
                  </span>
                )}
                {feedbackHistoryQuery.data && feedbackHistoryQuery.data.entries.length === 0 && (
                  <span>ยังไม่มีประวัติการซ่อน</span>
                )}
                {feedbackHistoryQuery.data && feedbackHistoryQuery.data.entries.length > 0 && (
                  <ol aria-label="รายการประวัติการซ่อน">
                    {feedbackHistoryQuery.data.entries.map((entry, index) => {
                      const item = baseItems.find(
                        (candidate) =>
                          candidate.itemType === entry.itemType &&
                          candidate.id === entry.itemId,
                      );
                      const label = item
                        ? item.itemType === "TRACE"
                          ? item.title
                          : item.itemType === "PLACE"
                            ? item.name
                            : `${entry.itemType} · ${entry.itemId}`
                        : `${entry.itemType} · ${entry.itemId}`;
                      const reason = entry.reasonCode
                        ? hideReasonLabels[entry.reasonCode]
                        : "ไม่ระบุเหตุผล";
                      return (
                        <li key={`${entry.itemType}:${entry.itemId}:${entry.createdAt}:${index}`}>
                          <span>{label}</span>
                          <span className="muted-label">
                            {entry.active ? "ซ่อนอยู่" : "เลิกซ่อนแล้ว"} · {reason} · {new Date(entry.createdAt).toLocaleString("th-TH")}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className={`explore-discovery-shell${detailOpen || isClosingDetail ? " has-detail" : ""}`}>
        <ExploreContextSidebar
          activeArea={area}
          activeVibe={vibe}
          demoMode={customerDataMode === "demo"}
          onAreaChange={(value) => updateParams({ area: value })}
          onVibeChange={(value) => updateParams({ vibe: value })}
        />
        <div className={`discovery-workspace-layout${detailOpen || isClosingDetail ? " has-detail" : ""}`}>
          <main ref={feedColumnRef} className="discovery-feed-column" aria-label="Explore feed">
            <div className="discovery-feed-heading">
              <div>
                <p className="eyebrow">
                  {activeTab === "for_you"
                    ? "FOR YOU"
                    : activeTab === "following"
                      ? "FOLLOWING"
                      : "NEARBY"}
                </p>
                <h2>
                  {activeTab === "for_you"
                    ? "เรื่องราวที่น่าลองต่อ"
                    : activeTab === "following"
                      ? "จาก Tracer ที่คุณติดตาม"
                      : "ใกล้คุณตอนนี้"}
                </h2>
              </div>
              <span className="muted-label">{items.length} รายการ</span>
            </div>
            {customerDataMode === "demo" ? (
              <DiscoveryComposer
                demoMode
                onNotify={notify}
                onPublish={publishComposerDraft}
              />
            ) : (
              <DiscoveryIntentPrompt
                area={area}
                vibe={vibe}
                category={activePortalCategory}
                date={bookingDate}
                partySize={partySize}
                onClear={() => updateParams({
                  area: null,
                  vibe: null,
                  category: null,
                  date: null,
                  party: null,
                })}
              />
            )}
            {hasError && items.length > 0 && (
              <InlineRecovery
                onRetry={() => {
                  void liveFeedQuery.refetch();
                }}
              />
            )}
            {isLoading ? (
              <SkeletonFeed />
            ) : items.length === 0 ? (
              <section className="discovery-empty">
                <Compass size={22} aria-hidden="true" />
                <h2>
                  {customerDataMode === "live" && activeTab === "following"
                    ? "เข้าสู่ระบบเพื่อดู Following"
                    : "ยังไม่มีสิ่งที่ตรงกับการค้นหา"}
                </h2>
                <p>
                  {customerDataMode === "live"
                    ? "ลองเปลี่ยนพื้นที่ ล้างตัวกรอง หรือกลับมาดูคำแนะนำล่าสุดอีกครั้ง"
                    : "ลองเปลี่ยนคำค้นหรือเปิด Nearby เพื่อดูตัวอย่างอื่น"}
                </p>
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => {
                    setInput("");
                    setSearchParams({}, { replace: true, preventScrollReset: true });
                  }}
                >
                  ล้างตัวกรอง
                </button>
              </section>
            ) : (
              <>
                {discoveryModules.length > 0 && (
                  <DiscoveryModuleShelf modules={discoveryModules} handlers={handlers} />
                )}
                <div className="discovery-feed">
                  {items
                    .filter((item) => !moduleItemKeys.has(`${item.itemType}:${item.id}`))
                    .map((item) => (
                      <DiscoveryCard
                        key={`${item.itemType}-${item.id}`}
                        item={item}
                        handlers={handlers}
                      />
                    ))}
                </div>
                {customerDataMode === "live" && liveFeedQuery.hasNextPage && (
                  <button
                    className="button button--ghost load-more-button"
                    type="button"
                    disabled={liveFeedQuery.isFetchingNextPage}
                    onClick={() => void liveFeedQuery.fetchNextPage()}
                  >
                    {liveFeedQuery.isFetchingNextPage
                      ? "กำลังโหลดเพิ่ม…"
                      : "ดูเพิ่มเติม"}
                  </button>
                )}
              </>
            )}
          </main>
          {(detailOpen || isClosingDetail || Boolean(searchParams.get("selected"))) && (
            <aside className={`discovery-detail-column${isClosingDetail ? " is-closing" : ""}`} aria-label="รายละเอียดที่เลือก">
              {activeDetailTrace ? (
                <ExploreTraceDetail
                  trace={activeDetailTrace}
                  demoMode={customerDataMode === "demo"}
                  creatorFollowing={creatorIsFollowed(activeDetailTrace.creator)}
                  creatorFollowPending={actionStates[creatorActionKey(activeDetailTrace.creator)]?.pending === true}
                  handlers={handlers}
                  onClose={closeTrace}
                  onFollowCreator={customerDataMode === "demo" ? () => void runCreatorFollow(activeDetailTrace.creator) : undefined}
                  onStartJourney={() => navigate(`/map?mode=traces&trace=${encodeURIComponent(activeDetailTrace.slug)}`)}
                  onSaveStop={customerDataMode === "demo" ? () => notify("เซฟจุดแวะไว้แล้ว") : undefined}
                  commentFocusRequestKey={commentFocusRequest?.itemId === activeDetailTrace.id ? commentFocusRequest.key : 0}
                  onCommentSubmit={customerDataMode === "demo" ? async () => {
                    await new Promise<void>((resolve) => window.setTimeout(resolve, 260));
                  } : undefined}
                  onCommentEdit={customerDataMode === "demo" ? async () => {
                    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
                  } : undefined}
                  onCommentDelete={customerDataMode === "demo" ? async () => {
                    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
                  } : undefined}
                  onFollowCommenter={handlers.onFollowCommenter}
                  onOpenMedia={openMedia}
                />
              ) : activeSelectedPost ? (
                <PostInlineDetail
                  post={activeSelectedPost}
                  demoMode={customerDataMode === "demo"}
                  liked={activeSelectedPost.liked}
                  likeCount={activeSelectedPost.likeCount}
                  onClose={closeTrace}
                  onOpenMedia={openMedia}
                  onLike={() => void runAction(activeSelectedPost, "like")}
                  onShare={() => void runAction(activeSelectedPost, "share")}
                  commentFocusRequestKey={commentFocusRequest?.itemId === activeSelectedPost.id ? commentFocusRequest.key : 0}
                  onCommentSubmit={customerDataMode === "demo" ? async () => {
                    await new Promise<void>((resolve) => window.setTimeout(resolve, 260));
                  } : undefined}
                  onCommentEdit={customerDataMode === "demo" ? async () => {
                    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
                  } : undefined}
                  onCommentDelete={customerDataMode === "demo" ? async () => {
                    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
                  } : undefined}
                  onFollowCommenter={handlers.onFollowCommenter}
                />
              ) : activeSelectedPlace ? (
                <PlaceInlineDetail
                  place={activeSelectedPlace}
                  demoMode={customerDataMode === "demo"}
                  saved={activeSelectedPlace.saved}
                  onSave={customerDataMode === "demo" ? () => void runAction(activeSelectedPlace, "trace") : undefined}
                  onClose={closeTrace}
                  commentFocusRequestKey={commentFocusRequest?.itemId === activeSelectedPlace.id ? commentFocusRequest.key : 0}
                  onCommentSubmit={customerDataMode === "demo" ? async (body, parentId) => {
                    await handlers.onInlineCommentSubmit?.(activeSelectedPlace, body, parentId);
                  } : undefined}
                  onCommentEdit={customerDataMode === "demo" ? async (commentId, body) => {
                    await handlers.onCommentEdit?.(activeSelectedPlace, commentId, body);
                  } : undefined}
                  onCommentDelete={customerDataMode === "demo" ? async (commentId) => {
                    await handlers.onCommentDelete?.(activeSelectedPlace, commentId);
                  } : undefined}
                  onFollowCommenter={handlers.onFollowCommenter}
                />
              ) : (
                <ExploreDetailEmpty onClose={closeTrace} />
              )}
            </aside>
          )}
        </div>
        <ExploreInsightsSidebar
          demoMode={customerDataMode === "demo"}
          selectedTrace={selectedTrace}
          fallbackTrace={activeFeedTrace}
          partnerPlaces={partnerPlaces}
          trendingTracers={trendingTracers}
          creatorFollowing={creatorIsFollowed}
          creatorFollowState={(profile) => actionStates[creatorActionKey(profile)]}
          onCreatorFollow={customerDataMode === "demo" ? (profile) => void runCreatorFollow(profile) : undefined}
        />
      </div>
      {mediaModalOpen && (modalTrace || modalPost) && <MediaConversationModal
        trace={modalTrace}
        post={modalPost}
        demoMode={customerDataMode === "demo"}
        autoFocusComposer={Boolean(commentFocusRequest && modalTrace && commentFocusRequest.itemId === modalTrace.id)}
        creatorFollowing={modalCreator ? creatorIsFollowed(modalCreator) : false}
        creatorFollowPending={modalCreator ? actionStates[creatorActionKey(modalCreator)]?.pending === true : false}
        onFollowCreator={modalCreator && customerDataMode === "demo" ? () => void runCreatorFollow(modalCreator) : undefined}
        saved={modalTrace?.saved}
        savePending={modalTrace ? actionStates[actionKey(modalTrace, "trace")]?.pending === true : false}
        onSave={modalTrace ? () => void runAction(modalTrace, "trace") : undefined}
        liked={selectedPost?.liked}
        likePending={selectedPost ? actionStates[actionKey(selectedPost, "like")]?.pending === true : false}
        likeCount={selectedPost?.likeCount}
        onLike={selectedPost ? () => void runAction(selectedPost, "like") : undefined}
        onShare={modalTrace || selectedPost ? () => void runAction((selectedPost ?? modalTrace)!, "share") : undefined}
        onStartJourney={modalTrace ? () => navigate(`/map?mode=traces&trace=${encodeURIComponent(modalTrace.slug)}`) : undefined}
        onCommentSubmit={customerDataMode === "demo" ? async () => {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 260));
        } : undefined}
        onCommentEdit={customerDataMode === "demo" ? async () => {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
        } : undefined}
        onCommentDelete={customerDataMode === "demo" ? async () => {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
        } : undefined}
        onFollowCommenter={handlers.onFollowCommenter}
        initialImageIndex={mediaModalIndex}
        onClose={closeMedia}
      />}
      {toast && <div className="explore-toast" role="status" aria-live="polite">
        <Check size={16} aria-hidden="true" />
        <span>{toast}</span>
        <button className="explore-toast__close" type="button" aria-label="ปิดข้อความ" onClick={() => setToast("")}><X size={15} aria-hidden="true" /></button>
      </div>}
    </div>
  );
}
