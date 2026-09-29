export type FeedFeedbackDataMode = "demo" | "live";
export type FeedFeedbackPersistence = "core" | "session";

export function resolveFeedFeedbackPersistence(
  dataMode: FeedFeedbackDataMode,
  hasAuthenticatedSession: boolean,
): FeedFeedbackPersistence {
  return dataMode === "live" && hasAuthenticatedSession ? "core" : "session";
}
