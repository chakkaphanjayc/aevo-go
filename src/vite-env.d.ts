/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_TUNNEL?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_GO_DATA_MODE?: "demo" | "live";
  readonly VITE_PLACE_API_MODE?: "legacy" | "canonical";
  readonly VITE_MAP_STYLE_URL?: string;
  readonly VITE_MAP_STYLE_ATTRIBUTION?: string;
  readonly VITE_CSRF_COOKIE_NAME?: string;
  readonly VITE_ACCOUNTS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
