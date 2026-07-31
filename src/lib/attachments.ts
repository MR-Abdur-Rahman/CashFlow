import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// Attachments for a transaction: images (gallery/camera) and documents.
//
// The `transaction-attachments` bucket is PRIVATE, unlike `avatars` — these are single-user
// financial records, not something every viewer of a shared split needs to render. So we store the
// object PATH in transaction_attachments.file_path and mint a short-lived signed URL at read time.
// Never getPublicUrl here; it returns a URL that 400s on a private bucket.
export const ATTACHMENTS_BUCKET = "transaction-attachments";

// Long enough to open a document or scroll a list without re-signing mid-session.
const SIGNED_URL_TTL_SECONDS = 3600;

export type AttachmentType = "image" | "document";

// An attachment chosen in the form but not yet uploaded. New transactions have no id until the
// insert returns, so the file is held in memory and uploaded afterwards (see uploadPending).
export type PendingAttachment = {
  localId: string;
  type: AttachmentType;
  blob: Blob;
  fileName: string;
  // Object URL for the chip thumbnail. Caller must revokePreview() when discarding.
  previewUrl?: string;
};

// A row already persisted in transaction_attachments, with a freshly signed URL for display.
export type SavedAttachment = {
  id: string;
  type: AttachmentType;
  filePath: string;
  fileName: string | null;
  signedUrl: string | null;
};

// The installed APK may predate these plugins (the native shell loads the web app remotely, so JS
// ships ahead of the native build). isPluginAvailable is the difference between a graceful fallback
// to the browser file input and a hard crash on an older install.
function pluginReady(name: string): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(name);
}

export const canUseNativeCamera = () => pluginReady("Camera");
export const canUseNativeFilePicker = () => pluginReady("FilePicker");
export const canUseNativeGeolocation = () => pluginReady("Geolocation");

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function extensionFor(blob: Blob, fallback: string): string {
  const fromMime = blob.type.split("/")[1]?.split(";")[0];
  return fromMime || fallback;
}

export function makePending(blob: Blob, fileName: string, type: AttachmentType): PendingAttachment {
  return {
    localId: crypto.randomUUID(),
    type,
    blob,
    fileName,
    previewUrl: type === "image" ? URL.createObjectURL(blob) : undefined,
  };
}

export function revokePreview(a: PendingAttachment) {
  if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
}

// ---------------------------------------------------------------------------
// Pickers (native). The caller falls back to a hidden <input type="file"> when these report
// unavailable — same camera-vs-gallery split EntityAvatarUpload already uses on web.
// ---------------------------------------------------------------------------

export async function pickImageNative(from: "camera" | "gallery"): Promise<PendingAttachment | null> {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    quality: 80,
    resultType: CameraResultType.Uri,
    source: from === "camera" ? CameraSource.Camera : CameraSource.Photos,
    // The editor adds a crop step users don't expect for a receipt snapshot.
    allowEditing: false,
  });
  if (!photo.webPath) return null;
  const blob = await (await fetch(photo.webPath)).blob();
  const ext = photo.format || extensionFor(blob, "jpg");
  return makePending(blob, `${from}-${Date.now()}.${ext}`, "image");
}

export async function pickDocumentNative(): Promise<PendingAttachment | null> {
  const { FilePicker } = await import("@capawesome/capacitor-file-picker");
  const result = await FilePicker.pickFiles({
    // Matches the bucket's mime allowlist — anything else is rejected server-side anyway.
    types: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    readData: true,
    limit: 1,
  });
  const file = result.files?.[0];
  if (!file?.data) return null;
  const mimeType = file.mimeType || "application/octet-stream";
  const blob = base64ToBlob(file.data, mimeType);
  const type: AttachmentType = mimeType.startsWith("image/") ? "image" : "document";
  return makePending(blob, file.name || `document-${Date.now()}`, type);
}

// ---------------------------------------------------------------------------
// Location. Writes to transactions.location_lat/lng (columns on the transaction itself), so unlike
// files this needs no post-insert step — it goes straight into the insert payload.
// ---------------------------------------------------------------------------

export type Coords = { lat: number; lng: number };

export async function getCurrentLocation(): Promise<Coords> {
  if (canUseNativeGeolocation()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted") perm = await Geolocation.requestPermissions();
    if (perm.location !== "granted") {
      throw new Error(
        "Location permission is off. Turn it on in Settings › Apps › CashFlow › Permissions, then retry.",
      );
    }
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }

  // Browser (and older APKs without the plugin).
  if (!("geolocation" in navigator)) throw new Error("Location isn't available on this device.");
  return await new Promise<Coords>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("Couldn't get your location. Check location permissions and retry.")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

// Plain maps link — deliberately no reverse geocoding, so there's no geocoding API key or quota.
export function mapsUrl({ lat, lng }: Coords): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// ---------------------------------------------------------------------------
// Storage + table
// ---------------------------------------------------------------------------

// Object keys are `${userId}/${transactionId}/${filename}`. The first segment must be the caller's
// uid — that's exactly what the bucket's RLS policies check via storage.foldername(name)[1].
function objectPath(userId: string, transactionId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.-]+/g, "_");
  return `${userId}/${transactionId}/${Date.now()}-${safe}`;
}

// Uploads pending files and records them. Called AFTER the transaction insert returns an id.
// Best-effort per file: one failure shouldn't discard the transaction the user just saved, so
// failures are collected and reported rather than thrown.
export async function uploadPending(
  userId: string,
  transactionId: string,
  pending: PendingAttachment[],
): Promise<{ uploaded: number; failed: string[] }> {
  const failed: string[] = [];
  let uploaded = 0;

  for (const a of pending) {
    const path = objectPath(userId, transactionId, a.fileName);
    const { error: upErr } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, a.blob, { contentType: a.blob.type || undefined, upsert: false });
    if (upErr) {
      failed.push(a.fileName);
      continue;
    }
    const { error: rowErr } = await supabase.from("transaction_attachments").insert({
      transaction_id: transactionId,
      type: a.type,
      file_path: path,
      file_name: a.fileName,
    });
    if (rowErr) {
      // Don't leave an object with no row pointing at it.
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
      failed.push(a.fileName);
      continue;
    }
    uploaded++;
  }

  return { uploaded, failed };
}

export async function listAttachments(transactionId: string): Promise<SavedAttachment[]> {
  const { data, error } = await supabase
    .from("transaction_attachments")
    .select("id, type, file_path, file_name")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  return await Promise.all(
    data.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(row.file_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: row.id,
        type: row.type as AttachmentType,
        filePath: row.file_path,
        fileName: row.file_name,
        signedUrl: signed?.signedUrl ?? null,
      };
    }),
  );
}

// Removes the row AND the underlying object. Postgres cascades the row when a transaction is
// deleted but cannot touch storage, so every deletion path has to call through here or the bucket
// accumulates orphans.
export async function removeAttachment(id: string, filePath: string): Promise<boolean> {
  const { error } = await supabase.from("transaction_attachments").delete().eq("id", id);
  if (error) return false;
  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([filePath]);
  return true;
}

// Call BEFORE deleting a transaction: once the row is gone the cascade takes the attachment rows
// with it and their paths become unrecoverable.
export async function purgeAttachmentsFor(transactionId: string): Promise<void> {
  const { data } = await supabase
    .from("transaction_attachments")
    .select("file_path")
    .eq("transaction_id", transactionId);
  const paths = (data ?? []).map((r) => r.file_path);
  if (paths.length) await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
}
