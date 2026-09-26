import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  CustomerStoreSummary,
  DiscoveryResponse,
} from "@/contracts/customer";
import type { PlaceSearchResponse } from "@/contracts/place";
import { getDiscovery } from "@/lib/customer-api";
import { searchPlaces } from "@/lib/place-api";
import { isGatewayOfflineError } from "@/lib/api-client";
import { customerDataMode, placeApiMode } from "@/lib/env";
import {
  isMapBoundsEqual as sameBounds,
  serializeMapBounds,
  type MapBounds,
  type MapDiscoveryStatus,
  type MapMode,
  type MapSearchFilters,
  type MapSort,
} from "./contracts";
import {
  createInitialMapDiscoveryState,
  isMapSearchDirty,
  mapDiscoveryReducer,
} from "./map-search-machine";
import {
  readMapUrlState,
  updateMapUrlState,
  type MapUrlUpdates,
} from "./map-url-state";
import { toCanonicalCategoryIds } from "./canonical-place-adapter";

const MAP_RESULT_LIMIT = 48;

function placeToCustomerStoreSummary(place: PlaceSearchResponse["data"][number]): CustomerStoreSummary {
  const displayPoint = place.displayPoint ?? place.labelPoint;
  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    area: place.area ?? place.address?.locality ?? place.address?.neighborhood ?? "Unknown area",
    category: place.category.label,
    rating: null,
    reviewCount: 0,
    priceRange: "—",
    imageUrl: null,
    address: place.address?.formattedAddress ?? null,
    availabilityLabel: null,
    latitude: displayPoint?.latitude ?? null,
    longitude: displayPoint?.longitude ?? null,
    categoryIconKey: place.category.id,
    priceLevel: null,
    availableToday: null,
    isAevoPlayPartner: place.capabilities.aevoPlayPartner,
    publicBookingRoute: place.capabilities.publicBookingRoute,
    ...(place.distanceMeters === null || place.distanceMeters === undefined
      ? {}
      : { distanceMeters: place.distanceMeters })
  };
}

export interface MapDiscoveryViewModel {
  filters: MapSearchFilters;
  mode: MapMode;
  sort: MapSort;
  cameraBounds: MapBounds | null;
  committedBounds: MapBounds | null;
  zoom: number;
  selectedSlug: string | null;
  hoveredSlug: string | null;
  status: MapDiscoveryStatus;
  isDirty: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  isSearching: boolean;
  isOffline: boolean;
  usingDemoFallback: boolean;
  isTruncated: boolean;
  results: CustomerStoreSummary[];
  response: DiscoveryResponse | undefined;
  error: unknown;
  onViewportChange: (
    bounds: MapBounds,
    zoom: number,
    userOriginated: boolean,
  ) => void;
  commitBounds: (
    bounds: MapBounds,
    zoom: number,
    updates?: Omit<MapUrlUpdates, "cameraBounds" | "zoom" | "searched">,
  ) => void;
  searchThisArea: () => void;
  selectStore: (slug: string | null) => void;
  hoverStore: (slug: string | null) => void;
  setFilters: (updates: MapUrlUpdates, options?: { replace?: boolean }) => void;
  resetArea: (area: string) => void;
  retry: () => Promise<unknown>;
}

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function useMapDiscovery(): MapDiscoveryViewModel {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => readMapUrlState(searchParams), [searchParams]);
  const [state, dispatch] = useReducer(
    mapDiscoveryReducer,
    createInitialMapDiscoveryState(
      urlState.searched ? urlState.cameraBounds : null,
      urlState.selectedSlug,
    ),
  );
  const [debouncedFilters, setDebouncedFilters] = useState(urlState.filters);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFilters(urlState.filters);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [urlState.filters]);

  const requestSignature = useMemo(
    () =>
      JSON.stringify({
        bounds:
          urlState.searched && urlState.cameraBounds
            ? serializeMapBounds(urlState.cameraBounds)
            : null,
        zoom: urlState.zoom,
        mode: urlState.mode,
        sort: urlState.sort,
        placeApiMode,
        filters: debouncedFilters,
      }),
    [debouncedFilters, placeApiMode, urlState.cameraBounds, urlState.mode, urlState.searched, urlState.sort, urlState.zoom],
  );
  const latestRequestSignature = useRef(requestSignature);

  useEffect(() => {
    latestRequestSignature.current = requestSignature;
  }, [requestSignature]);

  useEffect(() => {
    if (state.selectedStoreSlug !== urlState.selectedSlug)
      dispatch({ type: "select-store", slug: urlState.selectedSlug });
  }, [state.selectedStoreSlug, urlState.selectedSlug]);

  useEffect(() => {
    if (!urlState.searched && !urlState.cameraBounds && state.committedBounds) {
      dispatch({ type: "reset" });
      return;
    }
    if (
      urlState.searched &&
      urlState.cameraBounds &&
      !state.userMovedSinceCommit &&
      !sameBounds(state.committedBounds, urlState.cameraBounds)
    ) {
      dispatch({
        type: "search-succeeded",
        bounds: urlState.cameraBounds,
        hasResults: false,
      });
    }
  }, [
    state.committedBounds,
    state.userMovedSinceCommit,
    urlState.cameraBounds,
    urlState.searched,
  ]);

  const committedBounds = state.committedBounds;
  const discoveryQuery = useQuery({
    queryKey: [
      "public-discovery",
      "map",
      committedBounds ? serializeMapBounds(committedBounds) : null,
      urlState.zoom,
      debouncedFilters.query ?? "",
      debouncedFilters.area ?? "",
      debouncedFilters.categoryIds,
      debouncedFilters.priceLevels,
      debouncedFilters.availableAt ?? "",
      debouncedFilters.reservableOnly ?? false,
      debouncedFilters.partySize ?? null,
      debouncedFilters.ratingMin ?? null,
      debouncedFilters.tasteMatch ?? false,
      debouncedFilters.savedOnly ?? false,
      debouncedFilters.followingOnly ?? false,
      urlState.mode,
      urlState.sort,
      placeApiMode,
    ],
    queryFn: async ({ signal }) => {
      const response = placeApiMode === "canonical"
        ? await (async () => {
            const canonical = await searchPlaces(
              {
                ...(debouncedFilters.query ? { query: debouncedFilters.query } : {}),
                ...(debouncedFilters.area ? { area: debouncedFilters.area } : {}),
                bounds: committedBounds!,
                ...(debouncedFilters.categoryIds.length > 0
                  ? { categoryIds: toCanonicalCategoryIds(debouncedFilters.categoryIds) }
                  : {}),
                sort: "relevance",
                limit: MAP_RESULT_LIMIT,
              },
              { signal },
            );
            return {
              data: canonical.data.map(placeToCustomerStoreSummary),
              nextCursor: canonical.nextCursor,
              truncated: canonical.truncated,
              requestId: canonical.requestId,
              bounds: committedBounds!,
              ...(canonical.totalApproximate === null
                ? {}
                : { totalApproximate: canonical.totalApproximate }),
            } satisfies DiscoveryResponse;
          })()
        : await getDiscovery(
            {
              ...(debouncedFilters.query ? { query: debouncedFilters.query } : {}),
              ...(debouncedFilters.area ? { area: debouncedFilters.area } : {}),
              ...(debouncedFilters.categoryIds.length > 0
                ? { categoryIds: debouncedFilters.categoryIds }
                : {}),
              ...(debouncedFilters.priceLevels.length > 0
                ? { priceLevels: debouncedFilters.priceLevels }
                : {}),
              ...(debouncedFilters.availableAt
                ? { availableAt: debouncedFilters.availableAt }
                : {}),
              ...(debouncedFilters.reservableOnly
                ? { reservableOnly: true }
                : {}),
              ...(debouncedFilters.partySize
                ? { partySize: debouncedFilters.partySize }
                : {}),
              ...(debouncedFilters.ratingMin
                ? { ratingMin: debouncedFilters.ratingMin }
                : {}),
              ...(debouncedFilters.tasteMatch ? { tasteMatch: true } : {}),
              ...(debouncedFilters.savedOnly ? { savedOnly: true } : {}),
              ...(debouncedFilters.followingOnly ? { followingOnly: true } : {}),
              ...(urlState.sort !== "relevant" ? { sort: urlState.sort } : {}),
              bbox: serializeMapBounds(committedBounds!),
              zoom: urlState.zoom,
              limit: MAP_RESULT_LIMIT,
            },
            { signal },
          );
      if (latestRequestSignature.current !== requestSignature) {
        throw new DOMException("Obsolete map response", "AbortError");
      }
      return response;
    },
    enabled:
      customerDataMode === "live" &&
      urlState.mode === "places" &&
      Boolean(committedBounds) &&
      urlState.searched,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (!committedBounds || !urlState.searched) return;
    if (discoveryQuery.isSuccess && !discoveryQuery.isFetching) {
      dispatch({
        type: "search-succeeded",
        bounds: committedBounds,
        hasResults: discoveryQuery.data.data.length > 0,
      });
    } else if (discoveryQuery.isError) {
      dispatch({ type: "search-failed", offline: isBrowserOffline() });
    } else if (discoveryQuery.isFetching && !discoveryQuery.data) {
      dispatch({ type: "loading" });
    }
  }, [
    committedBounds,
    discoveryQuery.data,
    discoveryQuery.isError,
    discoveryQuery.isFetching,
    discoveryQuery.isSuccess,
    urlState.searched,
  ]);

  const onViewportChange = useCallback(
    (bounds: MapBounds, zoom: number, userOriginated: boolean) => {
      dispatch({ type: "camera-moved", bounds, userOriginated });
      // Camera movement is intentionally local. It only marks the map dirty;
      // the URL and network query change after the user presses Search this area.
      void zoom;
    },
    [],
  );

  const commitBounds = useCallback(
    (
      bounds: MapBounds,
      zoom: number,
      updates: Omit<MapUrlUpdates, "cameraBounds" | "zoom" | "searched"> = {},
    ) => {
      dispatch({ type: "camera-moved", bounds, userOriginated: false });
      dispatch({ type: "search-requested" });
      setSearchParams(
        (current) =>
          updateMapUrlState(current, {
            ...updates,
            cameraBounds: bounds,
            zoom,
            searched: true,
          }),
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  const searchThisArea = useCallback(() => {
    if (!state.cameraBounds) return;
    dispatch({ type: "search-requested" });
    setSearchParams(
      (current) =>
        updateMapUrlState(current, {
          cameraBounds: state.cameraBounds,
          zoom: urlState.zoom,
          searched: true,
        }),
      { replace: true, preventScrollReset: true },
    );
  }, [setSearchParams, state.cameraBounds, urlState.zoom]);

  const selectStore = useCallback(
    (slug: string | null) => {
      dispatch({ type: "select-store", slug });
      setSearchParams(
        (current) => updateMapUrlState(current, { selectedSlug: slug }),
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  const hoverStore = useCallback((slug: string | null) => {
    dispatch({ type: "hover-store", slug });
  }, []);

  const setFilters = useCallback(
    (updates: MapUrlUpdates, options: { replace?: boolean } = {}) => {
      setSearchParams((current) => updateMapUrlState(current, updates), {
        replace: options.replace ?? true,
        preventScrollReset: true,
      });
    },
    [setSearchParams],
  );

  const resetArea = useCallback(
    (area: string) => {
      dispatch({ type: "reset" });
      setSearchParams(
        (current) =>
          updateMapUrlState(current, {
            area,
            cameraBounds: null,
            searched: false,
            selectedSlug: null,
          }),
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  const results = discoveryQuery.data?.data ?? [];
  const usingDemoFallback =
    customerDataMode === "live" && isGatewayOfflineError(discoveryQuery.error);
  const status =
    customerDataMode === "demo"
      ? state.committedBounds
        ? "ready"
        : "idle"
      : state.status;

  return {
    filters: urlState.filters,
    mode: urlState.mode,
    sort: urlState.sort,
    cameraBounds: state.cameraBounds,
    committedBounds,
    zoom: urlState.zoom,
    selectedSlug: state.selectedStoreSlug ?? urlState.selectedSlug,
    hoveredSlug: state.hoveredStoreSlug,
    status,
    isDirty: isMapSearchDirty(state),
    isLoading: discoveryQuery.isLoading,
    isRefreshing: discoveryQuery.isFetching && Boolean(discoveryQuery.data),
    isSearching: discoveryQuery.isFetching && !discoveryQuery.data,
    isOffline: state.status === "offline" || isBrowserOffline(),
    usingDemoFallback,
    isTruncated: discoveryQuery.data?.truncated === true,
    results,
    response: discoveryQuery.data,
    error: discoveryQuery.error,
    onViewportChange,
    commitBounds,
    searchThisArea,
    selectStore,
    hoverStore,
    setFilters,
    resetArea,
    retry: () => discoveryQuery.refetch(),
  };
}
