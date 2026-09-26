export type PlaceApiMode = "legacy" | "canonical";
export type MapMode = "places" | "traces";
export type OsmOverpassMode = "disabled" | "mock" | "remote";

export function shouldQueryOsmPlaces(
  placeApiMode: PlaceApiMode,
  mapMode: MapMode,
  osmOverpassMode: OsmOverpassMode,
): boolean {
  return placeApiMode !== "canonical" && mapMode === "places" && osmOverpassMode !== "disabled";
}

export function shouldUseCanonicalMapOverlay(
  placeApiMode: PlaceApiMode,
  customerDataMode: "demo" | "live",
  mapMode: MapMode,
): boolean {
  return placeApiMode === "canonical" && customerDataMode === "live" && mapMode === "places";
}
