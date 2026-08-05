import "server-only";

import { getProfileById } from "@/lib/profiles";
import { resolveNativeOwner } from "@/lib/native-api/account";
import { createDeviceSession } from "@/lib/native-api/device-sessions";
import { profileDTO } from "@/lib/native-api/dto";
import { NativeApiError } from "@/lib/native-api/http";
import type { VerifiedProviderIdentity } from "@/lib/native-api/provider-identity";
import type { NativePlatform } from "@/lib/native-api/tokens";

export async function completeNativeSignIn(input: {
  identity: VerifiedProviderIdentity;
  platform: NativePlatform;
  deviceName: string | null;
  origin: string;
}) {
  const ownerId = await resolveNativeOwner(input.identity);
  const [session, profile] = await Promise.all([
    createDeviceSession({
      ownerId,
      platform: input.platform,
      deviceName: input.deviceName,
    }),
    getProfileById(ownerId),
  ]);
  if (!profile) {
    throw new NativeApiError(500, "internal_error", "Your Slate profile could not be loaded.");
  }

  return {
    ...session,
    user: profileDTO(profile, input.origin),
  };
}
