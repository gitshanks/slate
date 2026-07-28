import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/landing-nav";
import { Hero } from "@/components/landing/hero";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Showcase } from "@/components/landing/showcase";
import { SelfHost } from "@/components/landing/self-host";
import { StackStrip } from "@/components/landing/stack-strip";
import { FinalCta } from "@/components/landing/cta";
import { LandingFooter } from "@/components/landing/footer";
import { getAppSession } from "@/lib/app-access";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "slate · your watchlist, shared your way",
  description:
    "Build a personal watchlist, keep it synced, and share it with friends when you choose. Slate remains fully self-hostable.",
  openGraph: {
    title: "slate · your watchlist, shared your way",
    description:
      "Build a personal watchlist, keep it synced, and share it with friends when you choose.",
    type: "website",
  },
};

export default async function LandingPage() {
  if (SLATE_HOSTED) {
    const session = await getAppSession();

    if (session?.user?.id) {
      redirect("/app");
    }
  }

  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <Showcase />
        <FeatureGrid />
        <SelfHost />
        <StackStrip />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
