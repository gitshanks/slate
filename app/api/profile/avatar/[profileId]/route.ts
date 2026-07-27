import { getAppSession } from "@/lib/app-access";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

interface AvatarRecord {
  avatar_data: Buffer | Uint8Array | string | number[] | null;
  avatar_mime: string | null;
  is_public: boolean;
}

function decodeAvatar(value: AvatarRecord["avatar_data"]): Uint8Array | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return Uint8Array.from(value);
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (Array.isArray(value)) return Uint8Array.from(value);
  if (typeof value === "string") {
    const hex = value.startsWith("\\x") ? value.slice(2) : value;
    if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 !== 0) return null;
    return Uint8Array.from(Buffer.from(hex, "hex"));
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_data, avatar_mime, is_public")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !data) {
    return new Response(null, { status: 404 });
  }

  const avatar = data as AvatarRecord;
  if (!avatar.is_public) {
    const session = await getAppSession();
    if (session?.user?.id !== profileId) {
      return new Response(null, { status: 404 });
    }
  }

  const bytes = decodeAvatar(avatar.avatar_data);
  if (!bytes || !avatar.avatar_mime) {
    return new Response(null, { status: 404 });
  }

  const body = Uint8Array.from(bytes).buffer as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Cache-Control": avatar.is_public
        ? "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
        : "private, max-age=3600",
      "Content-Length": String(bytes.byteLength),
      "Content-Type": avatar.avatar_mime,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
