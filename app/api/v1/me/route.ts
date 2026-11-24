import { revalidatePath } from "next/cache";
import { deleteAccountData } from "@/lib/account-deletion";
import { runNeonTransaction } from "@/lib/neon-client";
import { getProfileById } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { profileDTO } from "@/lib/native-api/dto";
import {
  apiData,
  apiError,
  NativeApiError,
  readJsonObject,
} from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME = /^[a-z0-9][a-z0-9-]{2,29}$/;

export async function GET(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const profile = await getProfileById(claims.ownerId);
    if (!profile) throw new NativeApiError(404, "not_found", "Profile not found.");
    return apiData(profileDTO(profile, new URL(request.url).origin));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const body = await readJsonObject(request);
    const patch: Record<string, unknown> = {};

    if ("displayName" in body) {
      if (
        typeof body.displayName !== "string" ||
        !body.displayName.trim() ||
        body.displayName.trim().length > 80
      ) {
        throw new NativeApiError(400, "bad_request", "Display name is invalid.");
      }
      patch.display_name = body.displayName.trim();
      patch.identity_customized = true;
    }

    if ("username" in body) {
      if (typeof body.username !== "string" || !USERNAME.test(body.username)) {
        throw new NativeApiError(
          400,
          "bad_request",
          "Username must be 3–30 lowercase letters, numbers, or hyphens.",
        );
      }
      patch.username = body.username;
    }

    if ("isPublic" in body) {
      if (typeof body.isPublic !== "boolean") {
        throw new NativeApiError(400, "bad_request", "Privacy setting is invalid.");
      }
      patch.is_public = body.isPublic;
    }

    if (!Object.keys(patch).length) {
      throw new NativeApiError(400, "bad_request", "No profile changes were provided.");
    }

    patch.updated_at = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", claims.ownerId);
    if (updateError) {
      if (updateError.message.toLowerCase().includes("duplicate")) {
        throw new NativeApiError(409, "conflict", "That username is already taken.");
      }
      throw new Error(updateError.message);
    }

    // getProfileById is React-cached within one request. This is the first read
    // in PATCH, so it returns the newly persisted row.
    const profile = await getProfileById(claims.ownerId);
    if (!profile) throw new NativeApiError(404, "not_found", "Profile not found.");
    return apiData(profileDTO(profile, new URL(request.url).origin));
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Deletes the signed-in account, as the web's Delete account does. Device
 * sessions go with the profile through the foreign-key cascade.
 */
export async function DELETE(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    const body = await readJsonObject(request);
    if (body.confirmation !== "DELETE") {
      throw new NativeApiError(400, "bad_request", "Type DELETE to confirm.");
    }
    if (!SLATE_HOSTED || !process.env.DATABASE_URL) {
      throw new NativeApiError(503, "configuration_error", "Account deletion is unavailable on this installation.");
    }
    const profile = await getProfileById(claims.ownerId);
    if (!profile) throw new NativeApiError(404, "not_found", "This account no longer exists.");
    try {
      await runNeonTransaction((client) => deleteAccountData(client, claims.ownerId, null));
    } catch {
      throw new NativeApiError(
        500,
        "internal_error",
        "Your account couldn't be deleted. No changes were saved. Please try again.",
      );
    }
    revalidatePath(`/u/${profile.username}`);
    return apiData({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
