import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { localRepository } from "@/lib/local-repository";

/** Non-secret, lightweight preferences only. Never use this module for tokens. */
export async function getPreference<T>(key: string): Promise<T | undefined> {
  if (Capacitor.isNativePlatform()) {
    const result = await Preferences.get({ key });
    if (result.value === null) return undefined;
    try {
      return JSON.parse(result.value) as T;
    } catch {
      return undefined;
    }
  }

  return localRepository.getPreference<T>(key);
}

export async function setPreference<T>(key: string, value: T): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key, value: JSON.stringify(value) });
    return;
  }

  await localRepository.setPreference(key, value);
}

export async function removePreference(key: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key });
    return;
  }

  await localRepository.removePreference(key);
}
