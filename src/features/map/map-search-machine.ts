import { isMapBoundsEqual, type MapBounds, type MapDiscoveryStatus } from "./contracts";

const SEARCH_AREA_MOVE_THRESHOLD_METERS = 250;
const SEARCH_AREA_ZOOM_THRESHOLD_RATIO = 0.18;

function centerDistanceMeters(left: MapBounds, right: MapBounds): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(
    (right.north + right.south - left.north - left.south) / 2,
  );
  const longitudeDelta = toRadians(
    (right.east + right.west - left.east - left.west) / 2,
  );
  const latitude = toRadians((left.north + left.south) / 2);
  const nextLatitude = toRadians((right.north + right.south) / 2);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude) *
      Math.cos(nextLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function relativeSpanChange(left: MapBounds, right: MapBounds): number {
  const leftWidth = Math.max(left.east - left.west, 0.000001);
  const rightWidth = Math.max(right.east - right.west, 0.000001);
  const leftHeight = Math.max(left.north - left.south, 0.000001);
  const rightHeight = Math.max(right.north - right.south, 0.000001);
  return Math.max(
    Math.abs(rightWidth - leftWidth) / leftWidth,
    Math.abs(rightHeight - leftHeight) / leftHeight,
  );
}

export interface MapDiscoveryState {
  cameraBounds: MapBounds | null;
  committedBounds: MapBounds | null;
  cameraRevision: number;
  selectedStoreSlug: string | null;
  hoveredStoreSlug: string | null;
  status: MapDiscoveryStatus;
  userMovedSinceCommit: boolean;
}

export type MapDiscoveryEvent =
  | { type: "camera-moved"; bounds: MapBounds; userOriginated: boolean }
  | { type: "search-requested" }
  | { type: "search-succeeded"; bounds: MapBounds; hasResults: boolean }
  | { type: "search-failed"; offline: boolean }
  | { type: "select-store"; slug: string | null }
  | { type: "hover-store"; slug: string | null }
  | { type: "loading" }
  | { type: "reset" };

export function createInitialMapDiscoveryState(committedBounds: MapBounds | null, selectedStoreSlug: string | null = null): MapDiscoveryState {
  return {
    cameraBounds: committedBounds,
    committedBounds,
    cameraRevision: 0,
    selectedStoreSlug,
    hoveredStoreSlug: null,
    status: committedBounds ? "loading" : "idle",
    userMovedSinceCommit: false
  };
}

export function mapDiscoveryReducer(state: MapDiscoveryState, event: MapDiscoveryEvent): MapDiscoveryState {
  switch (event.type) {
    case "camera-moved":
      return {
        ...state,
        cameraBounds: event.bounds,
        cameraRevision: state.cameraRevision + 1,
        userMovedSinceCommit: event.userOriginated ? true : state.userMovedSinceCommit
      };
    case "search-requested":
      return {
        ...state,
        committedBounds: state.cameraBounds,
        userMovedSinceCommit: false,
        status: "loading"
      };
    case "search-succeeded":
      return {
        ...state,
        cameraBounds: event.bounds,
        committedBounds: event.bounds,
        userMovedSinceCommit: false,
        status: event.hasResults ? "ready" : "empty"
      };
    case "search-failed":
      return { ...state, status: event.offline ? "offline" : "error" };
    case "select-store":
      return { ...state, selectedStoreSlug: event.slug };
    case "hover-store":
      return { ...state, hoveredStoreSlug: event.slug };
    case "loading":
      return { ...state, status: "loading" };
    case "reset":
      return {
        ...state,
        cameraBounds: null,
        committedBounds: null,
        cameraRevision: state.cameraRevision + 1,
        selectedStoreSlug: null,
        hoveredStoreSlug: null,
        status: "idle",
        userMovedSinceCommit: false
      };
    default:
      return state;
  }
}

export function isMapSearchDirty(state: Pick<MapDiscoveryState, "cameraBounds" | "committedBounds" | "userMovedSinceCommit">): boolean {
  if (!state.userMovedSinceCommit || !state.cameraBounds || !state.committedBounds)
    return false;
  if (isMapBoundsEqual(state.cameraBounds, state.committedBounds)) return false;
  return (
    centerDistanceMeters(state.cameraBounds, state.committedBounds) >=
      SEARCH_AREA_MOVE_THRESHOLD_METERS ||
    relativeSpanChange(state.cameraBounds, state.committedBounds) >=
      SEARCH_AREA_ZOOM_THRESHOLD_RATIO
  );
}
