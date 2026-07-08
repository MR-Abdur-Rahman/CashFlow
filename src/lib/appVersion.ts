import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

export type LatestVersion = { version: string; releaseNotes: string[] };

// The minor (second) digit of a "major.minor.patch" version string. A new APK is only needed when
// the minor differs — the patch is irrelevant to that decision.
export function minorOf(version: string | null | undefined): number {
  return Number((version ?? "").split(".")[1] ?? 0) || 0;
}

// The version baked into the installed native app (null on the web — there's no native build there).
export async function getCurrentVersion(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return (await CapApp.getInfo()).version;
  } catch {
    return null;
  }
}

// The latest published version + release notes (a plain web file that deploys live).
export async function getLatestVersion(): Promise<LatestVersion | null> {
  try {
    const res = await fetch(`/app-version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as LatestVersion;
  } catch {
    return null;
  }
}
