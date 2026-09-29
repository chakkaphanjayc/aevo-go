import type { FeedReasonCode } from "@/contracts/feed";
import type { CanonicalPlaceId } from "@/contracts/place";
import type { DiscoveryCandidateType } from "@/contracts/discovery";

export type DiscoveryTab = "for_you" | "following" | "nearby";

export type DiscoveryReasonCode =
  | "SIMILAR_TASTE"
  | "FOLLOWING_TRACER"
  | "POPULAR_NEARBY"
  | "NEW_IN_SAVED_AREA"
  | "REMIXED_TRACE";

export type DiscoveryItemType = "TRACE" | "PLACE" | "POST" | "TRACER";
/** Live Core candidates are entity-only. POST/TRACER remain demo/detail compatibility types. */
export type DiscoveryCandidateItemType = DiscoveryCandidateType;

export interface DiscoveryReason {
  code: DiscoveryReasonCode;
  matchedTopics?: readonly string[];
  matchedAreas?: readonly string[];
}

export interface DiscoveryPresentation {
  style: "obsidian" | "pearl" | "editorial";
  feeling: string | null;
  tags: readonly string[];
  visibility: "public" | "followers";
}

export interface DiscoveryComment {
  id: string;
  authorId?: string;
  authorName: string;
  authorInitials: string;
  authorProfile?: DiscoveryCommentProfile;
  body: string;
  createdAt: string;
  parentId?: string;
  helpful?: boolean;
  isEdited?: boolean;
}

export interface DiscoveryCommentProfile {
  id: string;
  name: string;
  initials: string;
  bio?: string;
  area?: string;
  expertise?: readonly string[];
  tasteMatchLabel?: string;
  following?: boolean;
}

export interface DiscoveryTracerSummary {
  id: string;
  name: string;
  initials: string;
  expertise: readonly string[];
  area: string;
  following: boolean;
  profileAvailable?: boolean;
  bio?: string;
  tasteMatchLabel?: string;
}

export interface DiscoveryRouteStop {
  id: string;
  name: string;
  subtitle: string;
  area: string;
  category: string;
  rating: number | null;
  imageUrl: string | null;
  point: {
    latitude: number;
    longitude: number;
  };
  isAevoPlayPartner?: boolean;
}

export interface DiscoveryBase {
  id: string;
  itemType: DiscoveryItemType;
  reason: DiscoveryReason;
  presentation?: DiscoveryPresentation;
  feedSessionId?: string;
  trackingToken?: string;
  feedReasonCode?: FeedReasonCode;
}

export interface DiscoveryTrace extends DiscoveryBase {
  itemType: "TRACE";
  slug: string;
  title: string;
  description: string;
  area: string;
  creator: DiscoveryTracerSummary;
  coverTiles: [string, string, string];
  coverImages?: readonly string[];
  routeStops?: readonly DiscoveryRouteStop[];
  topicTags: string[];
  stopCount: number;
  durationMinutes: number | null;
  distanceKm: number | null;
  budgetLabel: string | null;
  followerCount: number;
  remixCount: number;
  completionCount: number;
  rating: number | null;
  saved: boolean;
  followed: boolean;
  comments: DiscoveryComment[];
}

export interface DiscoveryPlace extends DiscoveryBase {
  itemType: "PLACE";
  slug: string;
  /**
   * The canonical Place identity is intentionally separate from the Feed
   * item/legacy slug. It is only present when the server resolved an explicit
   * reference mapping; the client never derives it from a slug or name.
   */
  canonicalPlaceId?: CanonicalPlaceId;
  name: string;
  category: string;
  area: string;
  priceLabel: string;
  openNow: boolean | null;
  imageUrl: string | null;
  venueSlug?: string;
  isAevoPlayPartner?: boolean;
  description: string;
  traceCount: number;
  saved: boolean;
  comments: DiscoveryComment[];
}

export interface DiscoveryAttachedObject {
  itemType: "PLACE" | "TRACE";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface DiscoveryPost extends DiscoveryBase {
  itemType: "POST";
  author: DiscoveryTracerSummary;
  body: string;
  publishedLabel: string;
  mediaLabels: string[];
  mediaImages?: readonly string[];
  attachedObject: DiscoveryAttachedObject | null;
  likeCount: number;
  liked: boolean;
  comments: DiscoveryComment[];
}

export interface DiscoveryTracer extends DiscoveryBase {
  itemType: "TRACER";
  tracer: DiscoveryTracerSummary;
  tasteMatchLabel: string;
  featuredTrace: Pick<DiscoveryTrace, "slug" | "title" | "area" | "stopCount">;
  followerCount: number;
}

export type DiscoveryItem =
  | DiscoveryTrace
  | DiscoveryPlace
  | DiscoveryPost
  | DiscoveryTracer;

export type DiscoveryCandidateItem = DiscoveryTrace | DiscoveryPlace;

export function isDiscoveryCandidateItem(item: DiscoveryItem): item is DiscoveryCandidateItem {
  return item.itemType === "TRACE" || item.itemType === "PLACE";
}

export type DiscoveryAction =
  | "trace"
  | "follow"
  | "remix"
  | "save"
  | "like"
  | "comment"
  | "share"
  | "hide";

export interface DiscoveryActionState {
  pending: boolean;
  error: string | null;
}

export function discoveryReasonCopy(reason: DiscoveryReason): string {
  switch (reason.code) {
    case "SIMILAR_TASTE":
      return reason.matchedTopics?.length
        ? `เพราะคุณชอบ ${reason.matchedTopics.slice(0, 2).join(" และ ")}`
        : "เข้ากับสิ่งที่คุณชอบ";
    case "FOLLOWING_TRACER":
      return "จาก Tracer ที่คุณติดตาม";
    case "POPULAR_NEARBY":
      return "กำลังเป็นที่สนใจใกล้คุณ";
    case "NEW_IN_SAVED_AREA":
      return reason.matchedAreas?.[0]
        ? `ใหม่ใน ${reason.matchedAreas[0]}`
        : "ใหม่ในพื้นที่ที่คุณบันทึก";
    case "REMIXED_TRACE":
      return "Remix จาก Trace ที่คุณเคยทำ";
  }
}
