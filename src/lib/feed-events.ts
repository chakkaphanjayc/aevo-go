import {
  type FeedEvent,
  type FeedEventBatch,
  type FeedEventBatchResponse,
  type FeedEventMetadata,
  type FeedEventName,
  type FeedItemType,
  feedEventBatchSchema,
} from "@/contracts/feed";
import { postCoreFeedEvents } from "@/lib/feed-api";

export type FeedEventInput = Omit<FeedEvent, "schemaVersion" | "eventId" | "occurredAt"> & {
  eventId?: string;
  occurredAt?: string;
};

export interface FeedEventQueueSender {
  (batch: FeedEventBatch): Promise<FeedEventBatchResponse>;
}

function eventId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `feed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildEvent(input: FeedEventInput): FeedEvent {
  return feedEventBatchSchema.shape.events.element.parse({
    schemaVersion: "1",
    eventId: input.eventId ?? eventId(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    ...input,
  });
}

export class FeedEventQueue {
  private readonly sender: FeedEventQueueSender;
  private pending: FeedEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  constructor(sender: FeedEventQueueSender = postCoreFeedEvents) {
    this.sender = sender;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  enqueue(input: FeedEventInput): void {
    this.pending.push(buildEvent(input));
    if (this.pending.length >= 10) {
      void this.flush();
      return;
    }
    this.schedule(1_000);
  }

  async flush(): Promise<void> {
    if (this.flushing || this.pending.length === 0) return;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.flushing = true;
    const batch = this.pending.splice(0, 100);
    let failed = false;
    try {
      await this.sender({ events: batch });
    } catch {
      failed = true;
      // Preserve event IDs so a retried batch is safely deduplicated if the
      // server accepted the request before the client lost the response.
      this.pending = [...batch, ...this.pending];
      this.schedule(5_000);
    } finally {
      this.flushing = false;
      if (!failed && this.pending.length > 0) {
        if (this.pending.length >= 10) void this.flush();
        else this.schedule(1_000);
      }
    }
  }

  clear(): void {
    this.pending = [];
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(delayMs: number): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delayMs);
  }
}

export const feedEventQueue = new FeedEventQueue();

export function enqueueFeedEvent(input: FeedEventInput): void {
  feedEventQueue.enqueue(input);
}

export function feedClientPlatform(): "web" | "pwa" | "capacitor" {
  if (typeof window !== "undefined" && "Capacitor" in window) return "capacitor";
  if (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) return "pwa";
  return "web";
}

export function feedEventMetadata(input: {
  tab: "for_you" | "following" | "nearby";
  reasonCode?: FeedEventMetadata["reasonCode"];
  visibleRatio?: number;
  visibleDurationMs?: number;
}): FeedEventMetadata {
  return {
    clientPlatform: feedClientPlatform(),
    surface: "explore",
    tab: input.tab,
    ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
    ...(input.visibleRatio !== undefined ? { visibleRatio: input.visibleRatio } : {}),
    ...(input.visibleDurationMs !== undefined ? { visibleDurationMs: input.visibleDurationMs } : {}),
  };
}

export function feedEventForItem(input: {
  eventName: FeedEventName;
  feedSessionId: string;
  itemToken: string;
  itemType: FeedItemType;
  position?: number;
  metadata?: FeedEventMetadata;
}): FeedEventInput {
  return {
    eventName: input.eventName,
    feedSessionId: input.feedSessionId,
    itemToken: input.itemToken,
    source: input.itemType,
    ...(input.position !== undefined ? { position: input.position } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}
