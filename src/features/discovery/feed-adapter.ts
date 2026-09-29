import type {
  FeedItem,
  FeedModule,
  FeedPlaceItem,
  FeedReasonCode,
  FeedTraceItem,
} from "@/contracts/feed";
import { canonicalPlaceIdSchema } from "@/contracts/place";
import type {
  DiscoveryCandidateItem,
  DiscoveryItem,
  DiscoveryPlace,
  DiscoveryTrace,
} from "./types";
import { isDiscoveryCandidateItem } from "./types";

export interface DiscoveryModuleView {
  moduleId: FeedModule["moduleId"];
  reasonCode: FeedModule["reasonCode"];
  items: DiscoveryCandidateItem[];
  degraded?: boolean;
}

function discoveryReason(reasonCode: FeedReasonCode, area: string) {
  switch (reasonCode) {
    case "FOLLOWING_TRACER":
      return { code: "FOLLOWING_TRACER" as const, matchedAreas: [area] };
    case "TASTE_MATCH":
      return { code: "SIMILAR_TASTE" as const, matchedAreas: [area] };
    case "NEW_TRACE":
      return { code: "NEW_IN_SAVED_AREA" as const, matchedAreas: [area] };
    case "POPULAR":
    case "NEARBY_PLACE":
    case "POPULAR_PLACE":
      return { code: "POPULAR_NEARBY" as const, matchedAreas: [area] };
  }
}

function creatorInitials(name: string): string {
  return name
    .split(/\s+/u)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function coreTraceToDiscovery(item: FeedTraceItem, feedSessionId: string): DiscoveryTrace {
  return {
    id: item.id,
    itemType: "TRACE",
    feedSessionId,
    trackingToken: item.itemToken,
    feedReasonCode: item.reasonCode,
    slug: item.slug,
    title: item.title,
    description: item.description,
    area: item.area,
    creator: {
      id: `feed-creator:${item.slug}`,
      name: item.creatorName,
      initials: creatorInitials(item.creatorName),
      expertise: item.topicTags.slice(0, 2),
      area: item.area,
      // Core Feed v1 exposes the reason signal, not the creator relation
      // state. Keep the action state conservative until detail hydration
      // returns the authoritative relationship.
      following: false,
      profileAvailable: false,
    },
    coverTiles: [item.area.slice(0, 2).toUpperCase(), "TR", String(item.stopCount)],
    topicTags: item.topicTags,
    stopCount: item.stopCount,
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
    reason: discoveryReason(item.reasonCode, item.area),
  };
}

function corePlaceToDiscovery(
  item: FeedPlaceItem,
  feedSessionId: string,
  savedCanonicalPlaceIds?: ReadonlySet<string>,
): DiscoveryPlace {
  const reference = item.placeReference;
  const canonicalPlaceId =
    reference && (reference.resolutionStatus === "resolved" || reference.resolutionStatus === "redirected")
      ? canonicalPlaceIdSchema.safeParse(reference.canonicalPlaceId)
      : null;

  return {
    id: item.id,
    itemType: "PLACE",
    feedSessionId,
    trackingToken: item.itemToken,
    feedReasonCode: item.reasonCode,
    slug: item.slug,
    ...(canonicalPlaceId?.success ? { canonicalPlaceId: canonicalPlaceId.data } : {}),
    name: item.name,
    category: item.category,
    area: item.area,
    priceLabel: "—",
    openNow: null,
    imageUrl: item.imageUrl,
    isAevoPlayPartner: false,
    description: item.description,
    traceCount: 0,
    saved: canonicalPlaceId?.success === true
      && savedCanonicalPlaceIds?.has(canonicalPlaceId.data) === true,
    comments: [],
    reason: discoveryReason(item.reasonCode, item.area),
  };
}

export function coreFeedItemToDiscovery(
  item: FeedItem,
  feedSessionId: string,
  savedCanonicalPlaceIds?: ReadonlySet<string>,
): DiscoveryCandidateItem {
  return item.itemType === "TRACE"
    ? coreTraceToDiscovery(item, feedSessionId)
    : corePlaceToDiscovery(item, feedSessionId, savedCanonicalPlaceIds);
}

function feedModuleItemKey(itemType: string, itemId: string, itemToken: string): string {
  return `${itemType}:${itemId}:${itemToken}`;
}

export function feedModulesToDiscovery(
  modules: readonly FeedModule[] | undefined,
  items: readonly DiscoveryItem[],
): DiscoveryModuleView[] {
  const candidateItems = items.filter(isDiscoveryCandidateItem);
  if (!modules || modules.length === 0 || candidateItems.length === 0) return [];

  const itemsByKey = new Map(
    candidateItems.map((item) => [
      feedModuleItemKey(item.itemType, item.id, item.trackingToken ?? ""),
      item,
    ]),
  );
  const claimedItemKeys = new Set<string>();

  return modules.flatMap((module) => {
    const resolvedItems = module.items.flatMap((reference) => {
      const referenceKey = feedModuleItemKey(
        reference.itemType,
        reference.itemId,
        reference.itemToken,
      );
      if (claimedItemKeys.has(referenceKey)) return [];
      const item = itemsByKey.get(
        referenceKey,
      );
      if (item) claimedItemKeys.add(referenceKey);
      return item ? [item] : [];
    });
    return resolvedItems.length > 0
      ? [{
          moduleId: module.moduleId,
          reasonCode: module.reasonCode,
          items: resolvedItems,
          ...(module.degraded !== undefined ? { degraded: module.degraded } : {}),
        }]
      : [];
  });
}
