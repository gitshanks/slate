import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageArrival } from "@/components/image-arrival";
import { SlateListCard } from "@/components/slate-list-card";
import { siteOrigin } from "@/lib/site-url";
import { getSlateLists } from "@/lib/slate-lists";

export const dynamic = "force-dynamic";

const DESCRIPTION = "Films worth your time, picked and ranked. A new one every week.";

export function generateMetadata(): Metadata {
  const origin = siteOrigin();
  return {
    metadataBase: new URL(origin),
    title: "Lists by Slate",
    description: DESCRIPTION,
    alternates: { canonical: `${origin}/l` },
    openGraph: { title: "Lists by Slate", description: DESCRIPTION, url: `${origin}/l`, siteName: "slate", type: "website" },
    twitter: { card: "summary_large_image", title: "Lists by Slate", description: DESCRIPTION },
  };
}

/**
 * Every list made by Slate on one page: the one link for an Instagram bio,
 * and the place the home page sends people who want more to watch.
 */
export default async function SlateListsHub() {
  const lists = await getSlateLists();
  if (!lists.length) notFound();

  return (
    <main className="dark min-h-dvh w-full bg-background text-foreground">
      <ImageArrival />
      <div className="app-tab-arrive mx-auto w-full max-w-[1264px] px-5 sm:px-8">
        <div className="flex h-14 items-center justify-between lg:h-[72px]">
          <Link href="/" aria-label="slate home" className="flex items-center">
            <Image src="/brand/wordmark-light.svg" alt="slate" width={64} height={23} priority />
          </Link>
          <Link
            href="/login?mode=create"
            className="inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold text-primary ring-1 ring-inset ring-primary/35 transition-[background-color,transform] duration-150 hover:bg-primary/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] sm:h-10 sm:px-4 sm:text-sm"
          >
            Create your slate
          </Link>
        </div>

        <header className="pt-12 lg:pt-24">
          <h1 className="text-[44px] font-bold leading-[46px] tracking-[-0.035em] text-white lg:text-[88px] lg:leading-[88px]">
            Lists by Slate
          </h1>
          <p className="mt-2.5 text-balance text-base leading-6 text-white/60 lg:mt-4 lg:text-xl lg:leading-[30px]">
            {DESCRIPTION}
          </p>
        </header>

        <div className="mt-9 grid gap-4 pb-24 lg:mt-12 lg:grid-cols-2 lg:gap-6 lg:pb-40">
          {lists.map((list, index) => (
            <SlateListCard key={list.slug} list={list} featured={index === 0} priority={index < 2} />
          ))}
        </div>
      </div>
    </main>
  );
}
