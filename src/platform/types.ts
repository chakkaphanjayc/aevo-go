export type PlatformName = "web" | "ios" | "android";
export type PermissionState = "granted" | "denied" | "prompt" | "unsupported" | "unavailable";
export type HapticKind = "selection" | "success" | "warning";
export type SecureKey = "refresh-credential" | "guest-session";

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface SharePayload {
  title: string;
  text?: string;
  url: string;
}

export interface PushRegistration {
  token: string;
  platform: Exclude<PlatformName, "web">;
}

export class PlatformCapabilityError extends Error {
  readonly capability: string;
  readonly reason: "unsupported" | "denied" | "unavailable" | "failed";

  constructor(capability: string, reason: PlatformCapabilityError["reason"], message: string) {
    super(message);
    this.name = "PlatformCapabilityError";
    this.capability = capability;
    this.reason = reason;
  }
}

export interface PlatformBridge {
  readonly platform: PlatformName;
  getCurrentPosition(): Promise<GeoPoint>;
  requestLocationPermission(): Promise<PermissionState>;
  haptic(kind: HapticKind): Promise<void>;
  share(payload: SharePayload): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  getPushPermission(): Promise<PermissionState>;
  requestPushPermission(): Promise<PermissionState>;
  registerPush(): Promise<PushRegistration | null>;
  getSecure(key: SecureKey): Promise<string | null>;
  setSecure(key: SecureKey, value: string): Promise<void>;
  removeSecure(key: SecureKey): Promise<void>;
}
