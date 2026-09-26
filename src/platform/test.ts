import type {
  GeoPoint,
  HapticKind,
  PermissionState,
  PlatformBridge,
  PushRegistration,
  SecureKey,
  SharePayload
} from "@/platform/types";

export class TestPlatformBridge implements PlatformBridge {
  readonly platform = "web" as const;
  readonly calls: string[] = [];
  private readonly secureValues = new Map<SecureKey, string>();

  async getCurrentPosition(): Promise<GeoPoint> {
    this.calls.push("getCurrentPosition");
    return { latitude: 13.7563, longitude: 100.5018, accuracy: 10 };
  }

  async requestLocationPermission(): Promise<PermissionState> {
    this.calls.push("requestLocationPermission");
    return "granted";
  }

  async haptic(kind: HapticKind): Promise<void> {
    this.calls.push(`haptic:${kind}`);
  }

  async share(payload: SharePayload): Promise<void> {
    this.calls.push(`share:${payload.url}`);
  }

  async openExternalUrl(url: string): Promise<void> {
    this.calls.push(`openExternalUrl:${url}`);
  }

  async getPushPermission(): Promise<PermissionState> {
    this.calls.push("getPushPermission");
    return "unsupported";
  }

  async requestPushPermission(): Promise<PermissionState> {
    this.calls.push("requestPushPermission");
    return "unsupported";
  }

  async registerPush(): Promise<PushRegistration | null> {
    this.calls.push("registerPush");
    return null;
  }

  async getSecure(key: SecureKey): Promise<string | null> {
    this.calls.push(`getSecure:${key}`);
    return this.secureValues.get(key) ?? null;
  }

  async setSecure(key: SecureKey, value: string): Promise<void> {
    this.calls.push(`setSecure:${key}`);
    this.secureValues.set(key, value);
  }

  async removeSecure(key: SecureKey): Promise<void> {
    this.calls.push(`removeSecure:${key}`);
    this.secureValues.delete(key);
  }
}
