import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Geolocation } from "@capacitor/geolocation";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { PushNotifications, type PermissionStatus as PushPermissionStatus } from "@capacitor/push-notifications";
import { Share } from "@capacitor/share";
import { WebPlatformBridge } from "@/platform/web";
import { PlatformCapabilityError } from "@/platform/types";
import type { GeoPoint, HapticKind, PermissionState, PlatformBridge, PlatformName, PushRegistration, SecureKey, SharePayload } from "@/platform/types";

export class CapacitorPlatformBridge extends WebPlatformBridge {
  readonly platform: Exclude<PlatformName, "web">;

  constructor(platform: Exclude<PlatformName, "web">) {
    super();
    this.platform = platform;
  }

  override async getCurrentPosition(): Promise<GeoPoint> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 8_000,
        maximumAge: 60_000
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
    } catch (error) {
      throw new PlatformCapabilityError("location", "unavailable", this.errorMessage(error, "ไม่สามารถใช้ตำแหน่งปัจจุบันได้"));
    }
  }

  override async requestLocationPermission(): Promise<PermissionState> {
    try {
      const result = await Geolocation.requestPermissions();
      return this.mapPermission(result.location);
    } catch (error) {
      throw new PlatformCapabilityError("location", "failed", this.errorMessage(error, "ไม่สามารถขอสิทธิ์ตำแหน่งได้"));
    }
  }

  override async haptic(kind: HapticKind): Promise<void> {
    try {
      const style = kind === "success" ? ImpactStyle.Medium : kind === "warning" ? ImpactStyle.Heavy : ImpactStyle.Light;
      await Haptics.impact({ style });
    } catch {
      // Haptics are enhancement-only. A device without haptics must not block UX.
    }
  }

  override async share(payload: SharePayload): Promise<void> {
    try {
      await Share.share({ title: payload.title, text: payload.text, url: payload.url, dialogTitle: payload.title });
    } catch (error) {
      throw new PlatformCapabilityError("share", "unavailable", this.errorMessage(error, "ไม่สามารถแชร์จากอุปกรณ์นี้ได้"));
    }
  }

  override async getPushPermission(): Promise<PermissionState> {
    try {
      const result = await PushNotifications.checkPermissions();
      return this.mapPermission(result.receive);
    } catch (error) {
      throw new PlatformCapabilityError("push", "unavailable", this.errorMessage(error, "ไม่สามารถตรวจสอบสิทธิ์การแจ้งเตือนได้"));
    }
  }

  override async requestPushPermission(): Promise<PermissionState> {
    try {
      const result = await PushNotifications.requestPermissions();
      return this.mapPermission(result.receive);
    } catch (error) {
      throw new PlatformCapabilityError("push", "failed", this.errorMessage(error, "ไม่สามารถขอสิทธิ์การแจ้งเตือนได้"));
    }
  }

  override async registerPush(): Promise<PushRegistration | null> {
    const permission = await this.getPushPermission();
    if (permission !== "granted") return null;

    return new Promise<PushRegistration | null>((resolve, reject) => {
      let settled = false;
      let registrationHandle: { remove: () => Promise<void> } | undefined;
      let errorHandle: { remove: () => Promise<void> } | undefined;
      const finish = async (callback: () => void) => {
        if (settled) return;
        settled = true;
        await Promise.all([registrationHandle?.remove(), errorHandle?.remove()]);
        callback();
      };

      const timeout = window.setTimeout(() => {
        void finish(() => reject(new PlatformCapabilityError("push", "unavailable", "ยังไม่ได้รับ push token จากอุปกรณ์")));
      }, 8_000);

      void (async () => {
        try {
          registrationHandle = await PushNotifications.addListener("registration", (token) => {
            window.clearTimeout(timeout);
            void finish(() => resolve({ token: token.value, platform: this.platform }));
          });
          errorHandle = await PushNotifications.addListener("registrationError", (error) => {
            window.clearTimeout(timeout);
            void finish(() => reject(new PlatformCapabilityError("push", "failed", error.error || "ลงทะเบียน push ไม่สำเร็จ")));
          });
          await PushNotifications.register();
        } catch (error) {
          window.clearTimeout(timeout);
          void finish(() => reject(new PlatformCapabilityError("push", "failed", this.errorMessage(error, "ลงทะเบียน push ไม่สำเร็จ"))));
        }
      })();
    });
  }

  override async getSecure(key: SecureKey): Promise<string | null> {
    try {
      return await SecureStorage.getItem(key);
    } catch (error) {
      throw new PlatformCapabilityError("secure-storage", "failed", this.errorMessage(error, "อ่าน secure session ไม่สำเร็จ"));
    }
  }

  override async setSecure(key: SecureKey, value: string): Promise<void> {
    try {
      await SecureStorage.setItem(key, value);
    } catch (error) {
      throw new PlatformCapabilityError("secure-storage", "failed", this.errorMessage(error, "บันทึก secure session ไม่สำเร็จ"));
    }
  }

  override async removeSecure(key: SecureKey): Promise<void> {
    try {
      await SecureStorage.removeItem(key);
    } catch (error) {
      throw new PlatformCapabilityError("secure-storage", "failed", this.errorMessage(error, "ลบ secure session ไม่สำเร็จ"));
    }
  }

  private mapPermission(value: PushPermissionStatus["receive"] | "prompt-with-rationale" | undefined): PermissionState {
    if (value === "granted") return "granted";
    if (value === "denied") return "denied";
    if (value === "prompt" || value === "prompt-with-rationale") return "prompt";
    return "unavailable";
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}

export function createPlatformBridge(): PlatformBridge {
  if (Capacitor.isNativePlatform()) {
    const nativePlatform = Capacitor.getPlatform();
    return new CapacitorPlatformBridge(nativePlatform === "ios" ? "ios" : "android");
  }

  return new WebPlatformBridge();
}

export * from "@/platform/types";
