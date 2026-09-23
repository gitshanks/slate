import {
  ensureSharedListSchema,
  sharedListSchemaReady,
} from "@/lib/shared-list-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const connected = await ensureSharedListSchema();
    const ready = connected && await sharedListSchemaReady();
    return Response.json(
      { ready },
      { status: ready ? 200 : 503 },
    );
  } catch {
    return Response.json(
      { ready: false, error: "Migration failed" },
      { status: 500 },
    );
  }
}
