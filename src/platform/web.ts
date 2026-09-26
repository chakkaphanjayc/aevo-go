import type {
  GeoPoint,
  HapticKind,
  PermissionState,
  PlatformBridge,
  PlatformName,
  PushRegistration,
  SecureKey,
  SharePayload
} from "@/platform/types";
import { PlatformCapabilityError } from "@/platform/types";

export class WebPlatformBridge implements PlatformBridge {
  readonly platform: PlatformName = "web";

  async getCurrentPosition(): Promise<GeoPoint> {
    if (!navigator.geolocation) {
      throw new PlatformCapabilityError("location", "unsupported", "อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
    }

    return new Promise<GeoPoint>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
        (error) => reject(new PlatformCapabilityError("location", error.code === 1 ? "denied" : "unavailable", "ไม่สามารถใช้ตำแหน่งปัจจุบันได้")),
        { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 }
      );
    });
  }

  async requestLocationPermission(): Promise<PermissionState> {
    if (!navigator.geolocation) return "unsupported";
    if (!navigator.permissions?.query) return "prompt";

    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      return result.state;
    } catch {
      return "unavailable";
    }
  }

  async haptic(_kind: HapticKind): Promise<void> {
    if ("vibrate" in navigator) navigator.vibrate(8);
  }

  async share(payload: SharePayload): Promise<void> {
    if (navigator.share) {
      await navigator.share(payload);
      return;
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(payload.url);
      return;
    }

    throw new PlatformCapabilityError("share", "unsupported", "ไม่สามารถแชร์จาก browser นี้ได้");
  }

  async openExternalUrl(url: string): Promise<void> {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async getPushPermission(): Promise<PermissionState> {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission === "default" ? "prompt" : Notification.permission;
  }

  async requestPushPermission(): Promise<PermissionState> {
    if (!("Notification" in window)) return "unsupported";
    const permission = await Notification.requestPermission();
    return permission === "default" ? "prompt" : permission;
  }

  async registerPush(): Promise<PushRegistration | null> {
    throw new PlatformCapabilityError("push", "unsupported", "Push registration จะเปิดหลัง Customer Gateway พร้อม");
  }

  async getSecure(_key: SecureKey): Promise<string | null> {
    throw new PlatformCapabilityError("secure-storage", "unsupported", "Browser ใช้ secure storage ของ native ไม่ได้");
  }

  async setSecure(_key: SecureKey, _value: string): Promise<void> {
    throw new PlatformCapabilityError("secure-storage", "unsupported", "Browser ใช้ secure storage ของ native ไม่ได้");
  }

  async removeSecure(_key: SecureKey): Promise<void> {
    throw new PlatformCapabilityError("secure-storage", "unsupported", "Browser ใช้ secure storage ของ native ไม่ได้");
  }
}
