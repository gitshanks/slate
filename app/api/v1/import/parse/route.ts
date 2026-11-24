import { parseCsv } from "@/lib/import-parse";
import { apiData, apiError, NativeApiError } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARACTERS = 5 * 1024 * 1024;

/**
 * Reads a Letterboxd, IMDb or Trakt CSV into rows, as the web's import page
 * does in the browser. The body is the file itself (text/csv). The app then
 * sends the rows back a batch at a time.
 */
export async function POST(request: Request) {
  try {
    await authenticateNativeRequest(request);
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_CHARACTERS) {
      throw new NativeApiError(413, "bad_request", "That file is over 5 MB. Split it and import each part.");
    }
    const csv = await request.text();
    if (csv.length > MAX_CHARACTERS) {
      throw new NativeApiError(413, "bad_request", "That file is over 5 MB. Split it and import each part.");
    }
    const rows = parseCsv(csv);
    if (!rows.length) {
      throw new NativeApiError(400, "bad_request", "No titles in that file. Use a CSV with a Title or Name column.");
    }
    return apiData({ rows });
  } catch (error) {
    return apiError(error);
  }
}
