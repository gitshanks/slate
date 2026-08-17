import { buildPersonProfileDetail } from "@/lib/person-detail";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid person." }, { status: 400 });
  }

  try {
    const detail = await buildPersonProfileDetail(id);
    return Response.json(detail, {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[person-detail] Failed to load person", error);
    return Response.json(
      { error: "This person’s details are unavailable right now." },
      { status: 500 },
    );
  }
}
