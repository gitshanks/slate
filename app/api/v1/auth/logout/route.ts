import { revokeDeviceSession } from "@/lib/native-api/device-sessions";
import { apiData, apiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    await revokeDeviceSession(claims.ownerId, claims.sessionId);
    return apiData({ signedOut: true });
  } catch (error) {
    return apiError(error);
  }
}
