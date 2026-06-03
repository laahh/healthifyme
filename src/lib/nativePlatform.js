import { Capacitor } from "@capacitor/core";

/** True saat berjalan di shell native Capacitor (Android/iOS), bukan browser biasa. */
export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
