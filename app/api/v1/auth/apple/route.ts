import { completeNativeSignIn } from "@/lib/native-api/sign-in";
import {
  apiData,
  apiError,
  NativeApiError,
  optionalString,
  readJsonObject,
  requiredString,
} from "@/lib/native-api/http";
import { verifyAppleIdentity } from "@/lib/native-api/provider-identity";
import type { NativePlatform } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const idToken = requiredString(body.idToken, "idToken", 20_000);
    const rawNonce = optionalString(body.nonce, 256);
    const fullName = optionalString(body.fullName, 100);
    const deviceName = optionalString(body.deviceName, 100);
    const platform = body.platform as NativePlatform;
    if (platform !== "ios" && platform !== "android") {
      throw new NativeApiError(400, "bad_request", "platform must be ios or android.");
    }

    const identity = await verifyAppleIdentity(idToken, rawNonce, fullName);
    return apiData(
      await completeNativeSignIn({
        identity,
        platform,
        deviceName,
        origin: new URL(request.url).origin,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
