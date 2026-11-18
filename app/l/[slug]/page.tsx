import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicListView } from "@/components/public-list-view";
import { getAppSession } from "@/lib/app-access";
import { siteOrigin } from "@/lib/site-url";
import { getSlateListExtras } from "@/lib/slate-list-content";
import { getSlateList } from "@/lib/slate-lists";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await getSlateList(slug);
  if (!found) return { title: "List not found · slate", robots: { index: false } };

  const origin = siteOrigin();
  const canonical = `${origin}/l/${found.list.slug}`;
  const description =
    getSlateListExtras(found.list.slug).description ??
    found.list.description ??
    `${found.titles.length} titles picked by ${found.curator}.`;

  return {
    metadataBase: new URL(origin),
    title: `${found.list.name} · slate`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${found.list.name}, a list by ${found.curator}`,
      description,
      url: canonical,
      siteName: "slate",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${found.list.name}, a list by ${found.curator}`,
      description,
    },
  };
}

export default async function PublicListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await getSlateList(slug);
  if (!found) notFound();

  let viewerSignedIn = false;
  try {
    const session = await getAppSession();
    viewerSignedIn = Boolean(session?.user?.id);
  } catch {
    viewerSignedIn = false;
  }

  return (
    <main className="dark min-h-dvh w-full bg-[#080a09] text-foreground">
      <PublicListView
        slug={found.list.slug}
        name={found.list.name}
        description={found.list.description}
        username={found.username}
        titles={found.titles}
        extras={getSlateListExtras(found.list.slug)}
        viewerSignedIn={viewerSignedIn}
      />
    </main>
  );
}
