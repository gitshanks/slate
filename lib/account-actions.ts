"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { getAppSession } from "@/lib/app-access";
import { accountEmailHash } from "@/lib/email-auth-core";
import { deleteAccountData } from "@/lib/account-deletion";
import { runNeonTransaction } from "@/lib/neon-client";
import { getProfileById } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";

export interface DeleteAccountState {
  ok: boolean;
  message: string;
}

export async function deleteAccount(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  if (formData.get("confirmation") !== "DELETE") {
    return { ok: false, message: "Type DELETE to confirm." };
  }
  if (!SLATE_HOSTED || !process.env.DATABASE_URL) {
    return { ok: false, message: "Account deletion is unavailable on this installation." };
  }
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, message: "Sign in again to delete your account." };
  const ownerId = session.user.id;
  const profile = await getProfileById(ownerId);
  if (!profile) return { ok: false, message: "This account no longer exists." };
  try {
    await runNeonTransaction((client) => deleteAccountData(
      client,
      ownerId,
      session.user.email ? accountEmailHash(session.user.email.trim().toLowerCase()) : null,
    ));
  } catch {
    return { ok: false, message: "Your account couldn't be deleted. No changes were saved. Please try again." };
  }

  // Revoke this browser cookie too. Other web sessions are checked against
  // the profile generation; native sessions disappear via the FK cascade.
  await signOut({ redirect: false });
  revalidatePath("/", "layout");
  revalidatePath(`/u/${profile.username}`);
  return { ok: true, message: "Your Slate account has been deleted." };
}
