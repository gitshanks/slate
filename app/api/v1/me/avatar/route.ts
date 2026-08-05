import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import { getProfileById, profileAvatarUrl } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 650 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function decodeAvatar(value: unknown): Uint8Array | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return Uint8Array.from(value);
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (typeof value === "string") {
    const hex = value.startsWith("\\x") ? value.slice(2) : value;
    if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2) return null;
    return Uint8Array.from(Buffer.from(hex, "hex"));
  }
  return null;
}

function validImage(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((byte, index) => bytes[index] === byte);
  }
  if (mime === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function GET(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_data, avatar_mime")
      .eq("id", claims.ownerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const bytes = decodeAvatar(data?.avatar_data);
    const mime = typeof data?.avatar_mime === "string" ? data.avatar_mime : null;
    if (!bytes || !mime) return new Response(null, { status: 404 });
    return new Response(Uint8Array.from(bytes).buffer as ArrayBuffer, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": mime,
        "Content-Length": String(bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const mime = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!ALLOWED.has(mime)) {
      throw new NativeApiError(415, "bad_request", "Use a JPEG, PNG, or WebP image.");
    }
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && (length < 1 || length > MAX_BYTES)) {
      throw new NativeApiError(413, "bad_request", "Profile photos must be smaller than 650 KB.");
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length < 1 || bytes.length > MAX_BYTES || !validImage(bytes, mime)) {
      throw new NativeApiError(415, "bad_request", "That does not look like a valid image.");
    }
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("profiles").update({
      avatar_data: Buffer.from(bytes),
      avatar_mime: mime,
      avatar_updated_at: updatedAt,
      identity_customized: true,
      updated_at: updatedAt,
    }).eq("id", claims.ownerId);
    if (error) throw new Error(error.message);
    const profile = await getProfileById(claims.ownerId);
    if (!profile) throw new NativeApiError(404, "not_found", "Profile not found.");
    return apiData({ avatarUrl: profileAvatarUrl({ ...profile, avatar_mime: mime, avatar_updated_at: updatedAt }, new URL(request.url).origin) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("profiles").update({
      avatar_url: null,
      avatar_data: null,
      avatar_mime: null,
      avatar_updated_at: updatedAt,
      identity_customized: true,
      updated_at: updatedAt,
    }).eq("id", claims.ownerId);
    if (error) throw new Error(error.message);
    return apiData({ avatarUrl: null });
  } catch (error) {
    return apiError(error);
  }
}
