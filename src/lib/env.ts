import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\//.test(value), "VITE_API_BASE_URL must be an HTTP(S) URL"),
  VITE_DEV_TUNNEL: z.string().trim().optional(),
  VITE_APP_ENV: z.string().trim().optional(),
  VITE_GO_DATA_MODE: z.enum(["demo", "live"]).optional(),
  VITE_PLACE_API_MODE: z.enum(["legacy", "canonical"]).optional(),
  VITE_MAP_STYLE_URL: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\//.test(value), "VITE_MAP_STYLE_URL must be an HTTP(S) URL"),
  VITE_MAP_STYLE_ATTRIBUTION: z.string().trim().optional(),
  VITE_OSM_OVERPASS_MODE: z.enum(["disabled", "mock", "remote"]).optional(),
  VITE_OSM_OVERPASS_URL: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\//.test(value), "VITE_OSM_OVERPASS_URL must be an HTTP(S) URL"),
  VITE_CSRF_COOKIE_NAME: z.string().trim().min(1).optional(),
  VITE_ACCOUNTS_URL: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\//.test(value), "VITE_ACCOUNTS_URL must be an HTTP(S) URL"),
});

const parsed = envSchema.safeParse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_DEV_TUNNEL: import.meta.env.VITE_DEV_TUNNEL,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  VITE_GO_DATA_MODE: import.meta.env.VITE_GO_DATA_MODE,
  VITE_PLACE_API_MODE: import.meta.env.VITE_PLACE_API_MODE,
  VITE_MAP_STYLE_URL: import.meta.env.VITE_MAP_STYLE_URL,
  VITE_MAP_STYLE_ATTRIBUTION: import.meta.env.VITE_MAP_STYLE_ATTRIBUTION,
  VITE_OSM_OVERPASS_MODE: import.meta.env.VITE_OSM_OVERPASS_MODE,
  VITE_OSM_OVERPASS_URL: import.meta.env.VITE_OSM_OVERPASS_URL,
  VITE_CSRF_COOKIE_NAME: import.meta.env.VITE_CSRF_COOKIE_NAME,
  VITE_ACCOUNTS_URL: import.meta.env.VITE_ACCOUNTS_URL,
});

if (!parsed.success) {
  throw new Error("Aevo Go environment is invalid. Check VITE_API_BASE_URL.");
}

export const appEnvironment = parsed.data.VITE_APP_ENV ?? (import.meta.env.PROD ? "production" : "development");
export const customerDataMode = parsed.data.VITE_GO_DATA_MODE ?? "live";
// Keep the legacy Customer Gateway as the default until the Core canonical
// Place save migration, authenticated route smoke, and ownership/parity gate
// are complete in the target environment.
export const placeApiMode = parsed.data.VITE_PLACE_API_MODE ?? "legacy";
export const mapStyleUrl = parsed.data.VITE_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/dark";
export const mapStyleAttribution = parsed.data.VITE_MAP_STYLE_ATTRIBUTION ?? "© OpenFreeMap · © OpenStreetMap contributors";
export const osmOverpassMode =
  appEnvironment === "production"
    ? "disabled"
    : parsed.data.VITE_OSM_OVERPASS_MODE ??
      (customerDataMode === "demo" ? "mock" : "disabled");
export const osmOverpassUrl =
  parsed.data.VITE_OSM_OVERPASS_URL ??
  "https://overpass-api.de/api/interpreter";
export const csrfCookieName = parsed.data.VITE_CSRF_COOKIE_NAME ?? "aevo_go_csrf";
export const devTunnel = ["1", "true", "yes", "on"].includes(parsed.data.VITE_DEV_TUNNEL?.toLowerCase() ?? "");
export const accountsUrl = (devTunnel ? "" : parsed.data.VITE_ACCOUNTS_URL ?? (appEnvironment === "production" ? "" : "http://localhost:8787")).replace(/\/+$/u, "");
export const apiBaseUrl = (devTunnel ? "" : parsed.data.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

if (appEnvironment === "production" && !accountsUrl) {
  throw new Error("VITE_ACCOUNTS_URL is required in production");
}

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
