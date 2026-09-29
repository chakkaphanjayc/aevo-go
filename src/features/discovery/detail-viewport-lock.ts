export const EXPLORE_DETAIL_OPEN_ATTRIBUTE = "data-explore-detail-open";

export function setExploreDetailViewportState(isOpen: boolean): void {
  if (typeof document === "undefined") return;

  if (isOpen) {
    document.documentElement.setAttribute(EXPLORE_DETAIL_OPEN_ATTRIBUTE, "true");
  } else {
    document.documentElement.removeAttribute(EXPLORE_DETAIL_OPEN_ATTRIBUTE);
  }
}
