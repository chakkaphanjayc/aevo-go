import { localRepository } from "@/lib/local-repository";
import type {
  AvatarDecorationId,
  BannerPresetId,
  ProfileEffectId,
  ThemeAccentId,
  UserProfileCustomization,
} from "./profile-customization-types";

const CURRENT_SCHEMA_VERSION = 1;

export function defaultProfileCustomization(
  userId = "guest-user",
  overrides?: Partial<UserProfileCustomization>
): UserProfileCustomization {
  return {
    version: CURRENT_SCHEMA_VERSION,
    userId,
    displayName: overrides?.displayName ?? "Mina P.",
    handle: overrides?.handle ?? "minap_ari",
    bio: overrides?.bio ?? "ชอบเก็บรายละเอียดเล็ก ๆ ของเมืองผ่านกาแฟ งานออกแบบ และการเดินที่ไม่ต้องเร่งรีบ",
    pronouns: overrides?.pronouns ?? "she/her",
    avatarUrl: overrides?.avatarUrl ?? null,
    avatarDecorationId: (overrides?.avatarDecorationId as AvatarDecorationId) ?? "lightstruck-halo",
    bannerUrl: overrides?.bannerUrl ?? null,
    bannerPresetId: (overrides?.bannerPresetId as BannerPresetId) ?? "lightstruck-iridescent",
    profileEffectId: (overrides?.profileEffectId as ProfileEffectId) ?? "prismatic-sheen",
    themeAccentId: (overrides?.themeAccentId as ThemeAccentId) ?? "obsidian-titanium",
    activeBadges: overrides?.activeBadges ?? [
      "badge-founding-tastemaker",
      "badge-verified-curator",
      "badge-coffee-specialist",
    ],
    socialLinks: overrides?.socialLinks ?? [
      { id: "1", platform: "instagram", label: "Instagram", url: "https://instagram.com" },
      { id: "2", platform: "threads", label: "Threads", url: "https://threads.net" },
    ],
    updatedAt: Date.now(),
  };
}

function getStorageKey(userId?: string): string {
  const normalizedId = userId?.trim() || "current-user";
  return `profile_customization_v1_${normalizedId}`;
}

export async function getStoredProfileCustomization(
  userId?: string
): Promise<UserProfileCustomization> {
  const key = getStorageKey(userId);
  try {
    const raw = await localRepository.getPreference<Partial<UserProfileCustomization>>(key);
    if (!raw) {
      return defaultProfileCustomization(userId);
    }

    // Auto-migrate & fill defaults for resilient forward-compatibility
    return {
      version: CURRENT_SCHEMA_VERSION,
      userId: raw.userId ?? userId ?? "current-user",
      displayName: raw.displayName ?? "Mina P.",
      handle: raw.handle ?? "minap_ari",
      bio: raw.bio ?? "",
      pronouns: raw.pronouns ?? "",
      avatarUrl: raw.avatarUrl ?? null,
      avatarDecorationId: raw.avatarDecorationId ?? "lightstruck-halo",
      bannerUrl: raw.bannerUrl ?? null,
      bannerPresetId: raw.bannerPresetId ?? "lightstruck-iridescent",
      profileEffectId: raw.profileEffectId ?? "prismatic-sheen",
      themeAccentId: raw.themeAccentId ?? "obsidian-titanium",
      activeBadges: Array.isArray(raw.activeBadges) ? raw.activeBadges : ["badge-founding-tastemaker"],
      socialLinks: Array.isArray(raw.socialLinks) ? raw.socialLinks : [],
      updatedAt: raw.updatedAt ?? Date.now(),
    };
  } catch {
    return defaultProfileCustomization(userId);
  }
}

export async function saveStoredProfileCustomization(
  customization: UserProfileCustomization
): Promise<void> {
  const key = getStorageKey(customization.userId);
  const updated: UserProfileCustomization = {
    ...customization,
    version: CURRENT_SCHEMA_VERSION,
    updatedAt: Date.now(),
  };
  await localRepository.setPreference(key, updated);
}

/**
 * Validates, downsizes, and compresses client-side image uploads
 * to ensure persistent storage safety without flooding IndexedDB.
 * Complies with docs/feed-system/07-media-pipeline.md
 */
export async function processProfileImageUpload(
  file: File,
  maxDimension = 1024,
  maxBytes = 3 * 1024 * 1024
): Promise<{ dataUrl: string; width: number; height: number; byteSize: number }> {
  const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedMime.includes(file.type)) {
    throw new Error("รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP, GIF) เท่านั้น");
  }

  if (file.size > maxBytes) {
    throw new Error(`ขนาดไฟล์รูปภาพเกินกำหนด (ไม่เกิน ${Math.round(maxBytes / 1024 / 1024)}MB)`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพได้"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ไฟล์รูปภาพเสียหายหรือรูปแบบไม่ถูกต้อง"));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Downscale proportionally if exceeds max dimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({
            dataUrl: reader.result as string,
            width,
            height,
            byteSize: file.size,
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/webp", 0.88);
        resolve({
          dataUrl: compressedDataUrl,
          width,
          height,
          byteSize: Math.round(compressedDataUrl.length * 0.75),
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
