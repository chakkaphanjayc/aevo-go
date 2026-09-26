import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  ScaleControl,
  Source,
} from "react-map-gl/maplibre";
import type {
  MapLayerMouseEvent,
  MapRef,
  ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapBounds, StoreMapSummary, TraceMapSummary } from "./contracts";
import {
  toStoreFeatureCollection,
  toTraceFeatureCollection,
} from "./contracts";

const STORE_SOURCE_ID = "aevocado-stores";
const TRACE_SOURCE_ID = "aevocado-traces";
const CLUSTER_LAYER_ID = "store-clusters";
const CLUSTER_COUNT_LAYER_ID = "store-cluster-count";
const MARKER_LAYER_ID = "store-markers";
const MARKER_LABEL_LAYER_ID = "store-marker-labels";
const RATING_LAYER_ID = "store-rating-labels";
const SELECTED_LAYER_ID = "store-selected-halo";
const AVAILABILITY_LAYER_ID = "store-availability-indicator";
const PARTNER_LAYER_ID = "store-partner-indicator";
const TRACE_ROUTE_LAYER_ID = "trace-routes";
const TRACE_SELECTED_LAYER_ID = "trace-selected-route";
const TRACE_HOVERED_LAYER_ID = "trace-hovered-route";
const MAP_ICON_DEFINITIONS: Readonly<Record<string, string>> = {
  "aevocado-cafe": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#a1a1aa" stroke="#ffffff" stroke-width="2"/><path d="M15 19h14v7.5A7.5 7.5 0 0 1 21.5 34h0A6.5 6.5 0 0 1 15 27.5V19Zm14 3h2.2a4.8 4.8 0 0 1 0 9.6H29" fill="none" stroke="#090b0e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 37h20" fill="none" stroke="#090b0e" stroke-width="3" stroke-linecap="round"/></svg>`,
  "aevocado-dining": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#a1a1aa" stroke="#ffffff" stroke-width="2"/><path d="M17 12v12M13 12v8a4 4 0 0 0 8 0v-8M17 20v16M31 12v24M31 12c3.2 2.5 4.5 6.1 4.5 10.5H31" fill="none" stroke="#090b0e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "aevocado-bar": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#a1a1aa" stroke="#ffffff" stroke-width="2"/><path d="m14 15 10 11 10-11M24 26v10M18 36h12" fill="none" stroke="#090b0e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "aevocado-wellness": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#a1a1aa" stroke="#ffffff" stroke-width="2"/><path d="M24 36V17M24 25c-5.5 0-9-3.3-9-8 5.7-.1 9 2.5 9 8Zm0 2c5.5 0 9-3.3 9-8-5.7-.1-9 2.5-9 8Z" fill="none" stroke="#090b0e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "aevocado-activities": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#a1a1aa" stroke="#ffffff" stroke-width="2"/><path d="M16 34 27 23M24 16l5-5 8 8-5 5M18 30l-5 5M29 29l6 6" fill="none" stroke="#090b0e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "aevocado-stay": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#a1a1aa" stroke="#ffffff" stroke-width="2"/><path d="M13 34V21l11-8 11 8v13M18 34v-8h12v8M20 21h8" fill="none" stroke="#090b0e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "aevocado-partner": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#8de3b1" stroke="#ffffff" stroke-width="2"/><path d="m27 10-12 16h9l-3 12 12-17h-9l3-11Z" fill="none" stroke="#090b0e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "aevocado-default": `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="#a1a1aa" stroke="#ffffff" stroke-width="2"/><path d="M24 15v18M15 24h18" fill="none" stroke="#090b0e" stroke-width="3" stroke-linecap="round"/></svg>`,
};

export type MapProviderStatus = "loading" | "ready" | "error" | "unsupported";
export type MapInteractionSignal = "start" | "end" | "tap";

interface MapLibreMapProps {
  stores: readonly StoreMapSummary[];
  traces?: readonly TraceMapSummary[];
  styleUrl: string;
  selectedSlug?: string | null;
  hoveredSlug?: string | null;
  initialViewState: { longitude: number; latitude: number; zoom: number };
  focusBounds?: MapBounds | null;
  onSelect: (slug: string) => void;
  onSelectTrace?: (slug: string) => void;
  onHover?: (slug: string | null) => void;
  onViewportChange: (
    bounds: MapBounds,
    zoom: number,
    userOriginated: boolean,
  ) => void;
  onInteraction?: (signal: MapInteractionSignal) => void;
  onStatus?: (status: MapProviderStatus) => void;
}

function readSelectedSlug(event: MapLayerMouseEvent): string | undefined {
  const feature = event.features?.[0];
  const slug = feature?.properties?.slug;
  return typeof slug === "string" ? slug : undefined;
}

function isTraceFeature(event: MapLayerMouseEvent): boolean {
  return typeof event.features?.[0]?.properties?.traceId === "string";
}

function readClusterId(event: MapLayerMouseEvent): number | null {
  const value = event.features?.[0]?.properties?.cluster_id;
  const clusterId = Number(value);
  return Number.isInteger(clusterId) ? clusterId : null;
}

function readBounds(map: maplibregl.Map): MapBounds {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

function isWebGlAvailable(): boolean {
  if (typeof document === "undefined") return true;
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

export function MapLibreMap({
  stores,
  traces = [],
  styleUrl,
  selectedSlug,
  hoveredSlug,
  initialViewState,
  focusBounds,
  onSelect,
  onSelectTrace,
  onHover,
  onViewportChange,
  onInteraction,
  onStatus,
}: MapLibreMapProps) {
  const mapRef = useRef<MapRef>(null);
  const mapReadyRef = useRef(false);
  const programmaticMoveRef = useRef(false);
  const hoveredFeatureRef = useRef<string | null>(null);
  const [status, setStatus] = useState<MapProviderStatus>("loading");
  const supported = isWebGlAvailable();
  const data = useMemo(() => toStoreFeatureCollection(stores), [stores]);
  const traceData = useMemo(() => toTraceFeatureCollection(traces), [traces]);
  const selectedFilter = useMemo<["==", ["get", "slug"], string]>(
    () => ["==", ["get", "slug"], selectedSlug ?? "__no_selected_store__"],
    [selectedSlug],
  );
  const hoveredFilter = useMemo<["==", ["get", "slug"], string]>(
    () => ["==", ["get", "slug"], hoveredSlug ?? "__no_hovered_item__"],
    [hoveredSlug],
  );

  const updateStatus = useCallback(
    (nextStatus: MapProviderStatus) => {
      setStatus(nextStatus);
      onStatus?.(nextStatus);
    },
    [onStatus],
  );

  useEffect(() => {
    if (!supported) updateStatus("unsupported");
  }, [supported, updateStatus]);

  useEffect(() => {
    if (!focusBounds || !mapRef.current || !supported) return;
    const map = mapRef.current.getMap();
    programmaticMoveRef.current = true;
    map.fitBounds(
      [
        [focusBounds.west, focusBounds.south],
        [focusBounds.east, focusBounds.north],
      ],
      {
        padding: 56,
        duration: 0,
      },
    );
  }, [focusBounds, supported]);

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current || !selectedSlug) return;
    const selected = stores.find((store) => store.slug === selectedSlug);
    if (!selected) return;
    programmaticMoveRef.current = true;
    mapRef.current.getMap().easeTo({
      center: [selected.point.longitude, selected.point.latitude],
      duration: 260,
    });
  }, [selectedSlug, stores]);

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current || !hoveredSlug) return;
    const hovered = stores.find((store) => store.slug === hoveredSlug);
    const hoveredTrace = traces.find((trace) => trace.slug === hoveredSlug);
    if (hovered) {
      programmaticMoveRef.current = true;
      mapRef.current.getMap().easeTo({
        center: [hovered.point.longitude, hovered.point.latitude],
        duration: 180,
      });
      return;
    }
    if (hoveredTrace?.route.length) {
      const firstPoint = hoveredTrace.route[0];
      if (!firstPoint) return;
      programmaticMoveRef.current = true;
      mapRef.current.getMap().easeTo({
        center: [firstPoint.longitude, firstPoint.latitude],
        duration: 180,
      });
    }
  }, [hoveredSlug, stores, traces]);

  if (!supported) {
    return (
      <div className="map-provider map-provider--unavailable" role="status">
        อุปกรณ์นี้ไม่รองรับ WebGL · ใช้รายการสถานที่ด้านล่างได้
      </div>
    );
  }

  const handleClick = (event: MapLayerMouseEvent) => {
    const clusterId = readClusterId(event);
    if (clusterId !== null) {
      const map = mapRef.current?.getMap();
      const source = map?.getSource(STORE_SOURCE_ID);
      if (source && "getClusterExpansionZoom" in source) {
        programmaticMoveRef.current = true;
        void (source as GeoJSONSource)
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            const feature = event.features?.[0];
            const geometry = feature?.geometry;
            if (
              !map ||
              !geometry ||
              geometry.type !== "Point" ||
              typeof zoom !== "number"
            )
              return;
            const [longitude, latitude] = geometry.coordinates as [
              number,
              number,
            ];
            map.easeTo({ center: [longitude, latitude], zoom });
          })
          .catch(() => undefined);
      }
      return;
    }
    const slug = readSelectedSlug(event);
    if (!slug) {
      onInteraction?.("tap");
      return;
    }
    if (isTraceFeature(event)) onSelectTrace?.(slug);
    else onSelect(slug);
  };

  const handleMouseMove = (event: MapLayerMouseEvent) => {
    const nextHoveredSlug = readSelectedSlug(event) ?? null;
    if (hoveredFeatureRef.current === nextHoveredSlug) return;
    hoveredFeatureRef.current = nextHoveredSlug;
    onHover?.(nextHoveredSlug);
  };

  const handleMoveEnd = (event: ViewStateChangeEvent) => {
    const userOriginated =
      Boolean(event.originalEvent) ||
      (mapReadyRef.current && !programmaticMoveRef.current);
    programmaticMoveRef.current = false;
    if (userOriginated) onInteraction?.("end");
    onViewportChange(
      readBounds(event.target),
      event.viewState.zoom,
      userOriginated,
    );
  };

  const handleMoveStart = (event: ViewStateChangeEvent) => {
    if (event.originalEvent) onInteraction?.("start");
  };

  const handleLoad = () => {
    mapReadyRef.current = true;
    updateStatus("ready");
    const map = mapRef.current?.getMap();
    if (!map) return;
    for (const [name, svg] of Object.entries(MAP_ICON_DEFINITIONS)) {
      if (map.hasImage(name)) continue;
      const image = new Image();
      image.onload = () => {
        if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: 2 });
      };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
    onViewportChange(readBounds(map), map.getZoom(), false);
  };

  return (
    <div
      className="map-provider"
      role="region"
      aria-label="แผนที่สถานที่จาก Aevocado"
    >
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={styleUrl}
        interactiveLayerIds={[
          CLUSTER_LAYER_ID,
          MARKER_LAYER_ID,
          MARKER_LABEL_LAYER_ID,
          TRACE_ROUTE_LAYER_ID,
          TRACE_SELECTED_LAYER_ID,
          TRACE_HOVERED_LAYER_ID,
        ]}
        onLoad={handleLoad}
        onError={() => updateStatus("error")}
        onMoveStart={handleMoveStart}
        onMoveEnd={handleMoveEnd}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              if (hoveredFeatureRef.current === null) return;
              hoveredFeatureRef.current = null;
              onHover?.(null);
            }}
      >
        <Source id={TRACE_SOURCE_ID} type="geojson" data={traceData}>
          <Layer
            id={TRACE_ROUTE_LAYER_ID}
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#a1a1aa",
              "line-width": 2,
              "line-opacity": 0.6,
            }}
          />
          <Layer
            id={TRACE_HOVERED_LAYER_ID}
            type="line"
            filter={hoveredFilter}
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#ffffff",
              "line-width": 5,
              "line-opacity": 0.7,
            }}
          />
          <Layer
            id={TRACE_SELECTED_LAYER_ID}
            type="line"
            filter={selectedFilter}
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#ffffff",
              "line-width": 6,
              "line-opacity": 0.95,
            }}
          />
        </Source>
        <Source
          id={STORE_SOURCE_ID}
          type="geojson"
          data={data}
          cluster
          clusterMaxZoom={14}
          clusterRadius={48}
          promoteId="storeId"
        >
          <Layer
            id={CLUSTER_LAYER_ID}
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": [
                "step",
                ["get", "point_count"],
                "#27272a",
                10,
                "#3f3f46",
                30,
                "#52525b",
              ],
              "circle-radius": [
                "step",
                ["get", "point_count"],
                18,
                10,
                23,
                30,
                29,
              ],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id={CLUSTER_COUNT_LAYER_ID}
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
              "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            }}
            paint={{ "text-color": "#ffffff" }}
          />
          <Layer
            id={MARKER_LAYER_ID}
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": [
                "case",
                ["==", ["get", "isAevoPlayPartner"], true],
                "#8de3b1",
                "#a1a1aa",
              ],
              "circle-radius": 8,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id={MARKER_LABEL_LAYER_ID}
            type="symbol"
            filter={["!", ["has", "point_count"]]}
            layout={{
              "icon-image": ["get", "markerIcon"],
              "icon-size": 0.62,
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            }}
            paint={{ "icon-opacity": 0.98 }}
          />
          <Layer
            id={SELECTED_LAYER_ID}
            type="circle"
            filter={selectedFilter}
            paint={{
              "circle-color": "rgba(255, 255, 255, 0.18)",
              "circle-radius": 14,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id="store-hovered"
            type="circle"
            filter={hoveredFilter}
            paint={{
              "circle-color": "rgba(161, 161, 170, 0.18)",
              "circle-radius": 12,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id={AVAILABILITY_LAYER_ID}
            type="circle"
            filter={[
              "all",
              ["!", ["has", "point_count"]],
              ["==", ["get", "availableToday"], true],
            ]}
            paint={{
              "circle-color": "#ffffff",
              "circle-radius": 3,
              "circle-translate": [6, -6],
              "circle-stroke-color": "#070709",
              "circle-stroke-width": 1,
            }}
          />
          <Layer
            id={PARTNER_LAYER_ID}
            type="circle"
            filter={[
              "all",
              ["!", ["has", "point_count"]],
              ["==", ["get", "isAevoPlayPartner"], true],
            ]}
            paint={{
              "circle-color": "#8de3b1",
              "circle-radius": 3,
              "circle-translate": [6, -6],
              "circle-stroke-color": "#070709",
              "circle-stroke-width": 1,
            }}
          />
          <Layer
            id={RATING_LAYER_ID}
            type="symbol"
            filter={[
              "all",
              ["!", ["has", "point_count"]],
              ["!=", ["get", "ratingLabel"], ""],
            ]}
            layout={{
              "text-field": ["get", "ratingLabel"],
              "text-size": 10,
              "text-offset": [0, 1.8],
              "text-anchor": "top",
            }}
            paint={{
              "text-color": "#ffffff",
              "text-halo-color": "#070709",
              "text-halo-width": 1,
            }}
          />
        </Source>
        <NavigationControl showCompass={false} position="top-right" />
        <ScaleControl position="bottom-right" />
      </Map>
      {status === "loading" && (
        <span className="map-provider__status" role="status">
          กำลังโหลดแผนที่…
        </span>
      )}
      {status === "error" && (
        <span className="map-provider__status" role="status">
          Map provider ใช้งานไม่ได้ · รายการสถานที่ยังพร้อมใช้งาน
        </span>
      )}
    </div>
  );
}

export default MapLibreMap;
