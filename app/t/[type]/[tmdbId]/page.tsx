import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedTitlePage } from "@/components/shared-title-page";
import { getSharedTitle } from "@/lib/shared-title-data";
import { getTitleMeta } from "@/lib/tmdb";
import { titleSharePath } from "@/lib/title-sharing";

export const revalidate = 3600;
export function generateStaticParams() { return []; }
type Props = { params: Promise<{ type: string; tmdbId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, tmdbId } = await params;
  const title = await getSharedTitle(type, tmdbId);
  if (!title) return { title: "Title not found · slate", robots: { index: false } };
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.s1ate.space";
  const canonical = `${origin}${titleSharePath(title.media_type, title.tmdb_id)}`;
  const description = title.overview?.slice(0, 180) || `Watch the trailer for ${title.title}, save it to your slate, and pass it on.`;
  return {
    metadataBase: new URL(origin),
    title: `${title.title} · A recommendation on slate`,
    description,
    alternates: { canonical },
    openGraph: { title: `${title.title} · Worth passing on`, description, url: canonical, siteName: "slate", type: "website" },
    twitter: { card: "summary_large_image", title: `${title.title} · slate`, description },
  };
}

export default async function Page({ params }: Props) {
  const { type, tmdbId } = await params;
  const title = await getSharedTitle(type, tmdbId);
  if (!title) notFound();
  const meta = await getTitleMeta(title.media_type, title.tmdb_id);
  return <SharedTitlePage title={title} trailerKey={meta.trailerKey} />;
}
