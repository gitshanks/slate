import { rotateDeviceSession } from "@/lib/native-api/device-sessions";
import {
  apiData,
  apiError,
  readJsonObject,
  requiredString,
} from "@/lib/native-api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const refreshToken = requiredString(body.refreshToken, "refreshToken", 256);
    return apiData(await rotateDeviceSession(refreshToken));
  } catch (error) {
    return apiError(error);
  }
}
