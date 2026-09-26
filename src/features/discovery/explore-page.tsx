import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Check,
  Compass,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { FeedEventName } from "@/contracts/feed";
import { CommentThread } from "@/components/comment-thread";
import { GlidingGroup } from "@/components/gliding-group";
import { MediaConversationModal } from "@/components/media-conversation-modal";
import {
  applyTraceDeeTraceAction,
  setTraceDeeTracerFollow,
} from "@/lib/customer-api";
import { customerDataMode } from "@/lib/env";
import { isGatewayOfflineError } from "@/lib/api-client";
import {
  enqueueFeedEvent,
  feedEventForItem,
  feedEventMetadata,
  feedEventQueue,
} from "@/lib/feed-events";
import { getCoreFeedPage } from "@/lib/feed-api";
import { createIdempotencyKey } from "@/lib/idempotency";
import { removeCustomerFavorite, saveCustomerFavorite } from "@/lib/public-api";
import { getCustomerSession } from "@/lib/session";
import { beginGoSignIn } from "@/lib/sso";
import { DiscoveryCard } from "./discovery-cards";
import { demoDiscoveryItems, filterDemoDiscoveryItems } from "./demo-discovery";
import {
  DiscoveryComposer,
  type DiscoveryComposerDraft,
} from "./discover-feed-composer";
import { ExploreDetailEmpty, ExploreTraceDetail } from "./explore-trace-detail";
import { PostInlineDetail } from "./post-inline-detail";
import {
  ExploreBookingPortal,
  parseExplorePortalCategory,
  type ExplorePortalCategory,
} from "./explore-booking-portal";
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
import { coreFeedItemToDiscovery } from "./feed-adapter";

const feedTabs = [
  { id: "for_you", label: "For you" },
  { id: "following", label: "Following" },
  { id: "nearby", label: "Nearby" },
] as const;

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

function itemComments(item: DiscoveryItem) {
  return "comments" in item ? item.comments : [];
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
  const [input, setInput] = useState(query);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState("");
  const [actionStates, setActionStates] = useState<
    Record<string, DiscoveryActionState>
  >({});
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [unsavedIds, setUnsavedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [unfollowedIds, setUnfollowedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [unlikedIds, setUnlikedIds] = useState<Set<string>>(new Set());
  const [followedCreatorIds, setFollowedCreatorIds] = useState<Set<string>>(new Set());
  const [unfollowedCreatorIds, setUnfollowedCreatorIds] = useState<Set<string>>(new Set());
  const [selectedThread, setSelectedThread] = useState<DiscoveryItem | null>(
    null,
  );
  const [commentFocusRequest, setCommentFocusRequest] = useState<{
    traceId: string;
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
  const liveFeedQuery = useInfiniteQuery({
    queryKey: ["feed", "explore", activeTab, query, area],
    queryFn: ({ signal, pageParam }) =>
      getCoreFeedPage(
        {
          tab: activeTab,
          ...(query ? { query } : {}),
          ...(area ? { area } : {}),
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
      page.items.map((item) => coreFeedItemToDiscovery(item, page.feedSessionId)),
    );
  }, [activeTab, area, createdItems, gatewayOffline, liveFeedQuery.data, query, vibe]);

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
          item.itemType === "PLACE" && item.isAevoPlayPartner === true,
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

  const selectedPostTrace = useMemo(() => {
    if (!selectedPost?.attachedObject || selectedPost.attachedObject.itemType !== "TRACE") return null;
    const attachedId = selectedPost.attachedObject.id;
    const attachedSlug = selectedPost.attachedObject.href.replace("/traces/", "");
    return items.find(
      (item): item is DiscoveryTrace =>
        item.itemType === "TRACE" && (item.id === attachedId || item.slug === attachedSlug),
    ) ?? null;
  }, [items, selectedPost]);

  const detailTrace = selectedTrace ?? selectedPostTrace;
  const modalTrace = detailTrace;
  const modalPost = detailTrace ? null : selectedPost;
  const modalCreator = modalPost?.author ?? modalTrace?.creator ?? null;
  const detailOpen = Boolean(detailTrace || selectedPost);
  const selectedFeedItemId = selectedTrace?.id ?? selectedPost?.id ?? null;

  useEffect(() => {
    if (!detailOpen || !selectedFeedItemId) return;
    const frame = window.requestAnimationFrame(() => {
      setActiveSpyItemId(selectedFeedItemId);
      const target = Array.from(
        feedColumnRef.current?.querySelectorAll<HTMLElement>("[data-discovery-item-id]") ?? [],
      ).find((element) => element.dataset.discoveryItemId === selectedFeedItemId);
      target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detailOpen, items, selectedFeedItemId]);

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

          setActiveSpyItemId(closestId);

          if (detailOpen) {
            const focusedItem = items.find((item) => item.id === closestId);
            if (focusedItem?.itemType === "TRACE" && selectedTrace?.id !== focusedItem.id) {
              const next = new URLSearchParams(searchParams);
              next.set("selected", focusedItem.slug);
              setSearchParams(next, { replace: true, preventScrollReset: true });
            } else if (focusedItem?.itemType === "POST" && selectedPost?.id !== focusedItem.id) {
              const next = new URLSearchParams(searchParams);
              next.set("selected", focusedItem.id);
              setSearchParams(next, { replace: true, preventScrollReset: true });
            }
          }

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
  }, [detailOpen, items, searchParams, selectedPost?.id, selectedTrace?.id, setSearchParams]);

  const [isClosingDetail, setIsClosingDetail] = useState(false);
  const [closingDetailTrace, setClosingDetailTrace] = useState<DiscoveryTrace | null>(null);
  const [closingSelectedPost, setClosingSelectedPost] = useState<DiscoveryPost | null>(null);
  const closingTimeoutRef = useRef<number | null>(null);

  const isDetailActive = Boolean(detailOpen && !isClosingDetail);
  const activeDetailTrace = detailTrace || closingDetailTrace;
  const activeSelectedPost = selectedPost || closingSelectedPost;

  useEffect(() => {
    return () => {
      if (closingTimeoutRef.current !== null) {
        window.clearTimeout(closingTimeoutRef.current);
        closingTimeoutRef.current = null;
      }
    };
  }, []);

  const selectTrace = (trace: DiscoveryTrace) => {
    if (closingTimeoutRef.current !== null) {
      window.clearTimeout(closingTimeoutRef.current);
      closingTimeoutRef.current = null;
    }
    setIsClosingDetail(false);
    setClosingDetailTrace(null);
    setClosingSelectedPost(null);
    setActiveSpyItemId(trace.id);
    setCommentFocusRequest(null);
    setMediaModalOpen(false);
    setMediaModalIndex(0);
    updateParams({ selected: trace.slug });
  };
  const closeTrace = () => {
    setMediaModalOpen(false);
    if (detailTrace || selectedPost) {
      setClosingDetailTrace(detailTrace);
      setClosingSelectedPost(selectedPost);
      setIsClosingDetail(true);
      if (closingTimeoutRef.current !== null) {
        window.clearTimeout(closingTimeoutRef.current);
      }
      closingTimeoutRef.current = window.setTimeout(() => {
        setIsClosingDetail(false);
        setClosingDetailTrace(null);
        setClosingSelectedPost(null);
        closingTimeoutRef.current = null;
        updateParams({ selected: null });
      }, 200);
    } else {
      updateParams({ selected: null });
    }
  };
  const openMedia = (index: number) => {
    setMediaModalIndex(Math.max(0, index));
    setMediaModalOpen(true);
  };
  const closeMedia = () => setMediaModalOpen(false);

  const handleOpenPostDetail = (post: DiscoveryPost) => {
    if (closingTimeoutRef.current !== null) {
      window.clearTimeout(closingTimeoutRef.current);
      closingTimeoutRef.current = null;
    }
    setIsClosingDetail(false);
    setClosingDetailTrace(null);
    setClosingSelectedPost(null);
    setActiveSpyItemId(post.id);
    setSelectedThread(null);
    setCommentFocusRequest(null);
    setMediaModalOpen(false);
    setMediaModalIndex(0);
    updateParams({ selected: post.id });
  };

  const handleComment = (item: DiscoveryItem) => {
    if (item.itemType === "TRACE") {
      setActiveSpyItemId(item.id);
      setSelectedThread(null);
      updateParams({ selected: item.slug });
      setCommentFocusRequest((current) => ({
        traceId: item.id,
        key: (current?.key ?? 0) + 1,
      }));
      return;
    }
    if (item.itemType === "POST") {
      setActiveSpyItemId(item.id);
      setSelectedThread(null);
      setCommentFocusRequest(null);
      updateParams({ selected: item.id });
      return;
    }
    updateParams({ selected: null });
    setSelectedThread(item);
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
    if (customerDataMode === "live" && !sessionQuery.data) {
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
          if (item.saved) await removeCustomerFavorite(item.slug);
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
          // Core Feed v1 intentionally has no client-authored dismissal event.
          // Keep this test-stage hide session-local until the server contract
          // exposes an explicit preference mutation.
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
      if (action === "hide")
        setHiddenIds((current) => new Set(current).add(item.id));
      if (action === "trace" && (item.itemType === "TRACE" || item.itemType === "PLACE")) {
        notify(item.saved ? "นำออกจาก Saved แล้ว" : "บันทึกไว้ใน Saved แล้ว");
      }
      if (action === "follow" && (item.itemType === "TRACE" || item.itemType === "TRACER")) {
        const active = item.itemType === "TRACE" ? item.followed : item.tracer.following;
        notify(active ? "ยกเลิกการติดตามแล้ว" : "ติดตามแล้ว");
      }
      if (action === "like") notify(item.itemType === "POST" && item.liked ? "ยกเลิกถูกใจแล้ว" : "ถูกใจแล้ว");
      if (action === "hide") notify("ซ่อนรายการนี้แล้ว");
      setActionStates((current) =>
        updateActionState(current, key, { pending: false, error: null }),
      );
    } catch {
      notify("ยังทำรายการไม่สำเร็จ ลองใหม่ได้");
      setActionStates((current) =>
        updateActionState(current, key, {
          pending: false,
          error: "ยังทำรายการไม่สำเร็จ ลองใหม่ได้",
        }),
      );
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
      void runAction(item, action);
    },
    onComment: handleComment,
    onOpenPostDetail: handleOpenPostDetail,
    onInlineCommentSubmit: customerDataMode === "demo"
      ? async () => {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 260));
        }
      : undefined,
    onCommentEdit: customerDataMode === "demo"
      ? async () => {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
        }
      : undefined,
    onCommentDelete: customerDataMode === "demo"
      ? async () => {
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
      void runAction(item, "hide");
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
            Customer Gateway ยังไม่พร้อม · กำลังแสดงข้อมูลตัวอย่างในเครื่อง
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
      </div>
      <div className={`explore-discovery-shell${isDetailActive ? " has-detail" : ""}`}>
        <ExploreContextSidebar
          activeArea={area}
          activeVibe={vibe}
          demoMode={customerDataMode === "demo"}
          onAreaChange={(value) => updateParams({ area: value })}
          onVibeChange={(value) => updateParams({ vibe: value })}
        />
        <div className={`discovery-workspace-layout${isDetailActive ? " has-detail" : ""}`}>
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
            <DiscoveryComposer
              demoMode={customerDataMode === "demo"}
              onNotify={notify}
              onPublish={publishComposerDraft}
            />
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
              <div className="discovery-feed">
                {items.map((item) => (
                  <DiscoveryCard
                    key={`${item.itemType}-${item.id}`}
                    item={item}
                    handlers={handlers}
                  />
                ))}
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
              </div>
            )}
          </main>
          {(detailOpen || isClosingDetail) && (activeDetailTrace || activeSelectedPost) && (
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
                  commentFocusRequestKey={commentFocusRequest?.traceId === activeDetailTrace.id ? commentFocusRequest.key : 0}
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
              ) : <ExploreDetailEmpty />}
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
        autoFocusComposer={Boolean(commentFocusRequest && modalTrace && commentFocusRequest.traceId === modalTrace.id)}
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
      {selectedThread && (
        <CommentThread
          key={selectedThread.id}
          title={
            selectedThread.itemType === "TRACE"
              ? selectedThread.title
              : selectedThread.itemType === "PLACE"
                ? selectedThread.name
                : selectedThread.itemType === "POST"
                  ? selectedThread.author.name
                  : selectedThread.tracer.name
          }
          comments={itemComments(selectedThread)}
          onClose={() => setSelectedThread(null)}
          autoFocus
          preview={selectedThread.itemType === "POST" ? {
            authorName: selectedThread.author.name,
            authorInitials: selectedThread.author.initials,
            publishedLabel: selectedThread.publishedLabel,
            body: selectedThread.body,
            media: (selectedThread.mediaImages?.length ? selectedThread.mediaImages : selectedThread.mediaLabels).map((source, index) => ({
              src: selectedThread.mediaImages?.length ? source : undefined,
              alt: `โพสต์ของ ${selectedThread.author.name} รูปที่ ${index + 1}`,
              fallback: selectedThread.mediaLabels[index] ?? "ไม่มีสื่อที่แนบ",
            })),
          } : undefined}
          onSubmit={
            customerDataMode === "demo"
              ? async () => {
                  await new Promise<void>((resolve) =>
                    window.setTimeout(resolve, 260),
                  );
                }
              : undefined
          }
          onFollowCommenter={handlers.onFollowCommenter}
        />
      )}
    </div>
  );
}
