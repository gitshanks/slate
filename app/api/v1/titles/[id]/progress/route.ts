import { revalidatePath } from "next/cache";
import {
  apiData,
  apiError,
  NativeApiError,
  readJsonObject,
} from "@/lib/native-api/http";
import { recordNativeProgress } from "@/lib/native-api/progress";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function optionalCount(value: unknown, name: string, min: number): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > 10_000) {
    throw new NativeApiError(400, "bad_request", `${name} is invalid.`);
  }
  return value;
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/v1/titles/[id]/progress">,
) {
  try {
    const [claims, { id }, body] = await Promise.all([
      authenticateNativeRequest(request),
      context.params,
      readJsonObject(request),
    ]);
    if (!id || id.length > 100) {
      throw new NativeApiError(400, "bad_request", "title id is invalid.");
    }
    const season = optionalCount(body.season, "season", 0);
    const episode = optionalCount(body.episode, "episode", 1);
    if ((season === null) !== (episode === null)) {
      throw new NativeApiError(400, "bad_request", "season and episode go together.");
    }
    if (typeof body.completed !== "boolean") {
      throw new NativeApiError(400, "bad_request", "completed must be a boolean.");
    }

    const title = await recordNativeProgress(claims.ownerId, id, {
      season,
      episode,
      completed: body.completed,
    });
    revalidatePath("/");
    return apiData(title);
  } catch (error) {
    return apiError(error);
  }
}
