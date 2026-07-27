import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/app-access";
import { getProfileById, profileAvatarUrl } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 650 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isValidImage(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((byte, index) => bytes[index] === byte);
  }
  if (mime === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

async function currentAccount() {
  if (!SLATE_HOSTED) return null;
  const session = await getAppSession();
  if (!session?.user?.id) return null;
  const profile = await getProfileById(session.user.id);
  return profile ? { id: session.user.id, profile } : null;
}

function revalidateProfile(username: string) {
  revalidatePath("/profile");
  revalidatePath(`/u/${username}`);
}

export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const avatar = formData.get("avatar");
  if (!(avatar instanceof File)) {
    return Response.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(avatar.type)) {
    return Response.json(
      { error: "Use a JPEG, PNG, or WebP image." },
      { status: 415 }
    );
  }
  if (avatar.size < 1 || avatar.size > MAX_AVATAR_BYTES) {
    return Response.json(
      { error: "The processed profile photo must be smaller than 650 KB." },
      { status: 413 }
    );
  }

  const bytes = new Uint8Array(await avatar.arrayBuffer());
  if (!isValidImage(bytes, avatar.type)) {
    return Response.json(
      { error: "That file does not appear to be a valid image." },
      { status: 415 }
    );
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_data: Buffer.from(bytes),
      avatar_mime: avatar.type,
      avatar_updated_at: updatedAt,
      identity_customized: true,
      updated_at: updatedAt,
    })
    .eq("id", account.id);

  if (error) {
    return Response.json(
      { error: "We couldn't save that profile photo." },
      { status: 500 }
    );
  }

  revalidateProfile(account.profile.username);
  return Response.json({
    avatarUrl: profileAvatarUrl({
      ...account.profile,
      avatar_mime: avatar.type,
      avatar_updated_at: updatedAt,
    }),
  });
}

export async function DELETE() {
  const account = await currentAccount();
  if (!account) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url: null,
      avatar_data: null,
      avatar_mime: null,
      avatar_updated_at: updatedAt,
      identity_customized: true,
      updated_at: updatedAt,
    })
    .eq("id", account.id);

  if (error) {
    return Response.json(
      { error: "We couldn't remove that profile photo." },
      { status: 500 }
    );
  }

  revalidateProfile(account.profile.username);
  return Response.json({ avatarUrl: null });
}
