import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/landing-nav";
import { Hero } from "@/components/landing/hero";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Showcase } from "@/components/landing/showcase";
import { SelfHost } from "@/components/landing/self-host";
import { StackStrip } from "@/components/landing/stack-strip";
import { FinalCta } from "@/components/landing/cta";
import { LandingFooter } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "slate — a private Letterboxd for one",
  description:
    "Track everything you want to watch, are watching, and have loved — in a single, fast, self-hostable app. No social network. No algorithm. Just your shelf.",
  openGraph: {
    title: "slate — a private Letterboxd for one",
    description:
      "Track everything you want to watch, are watching, and have loved — in a single, fast, self-hostable app.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <FeatureGrid />
        <Showcase />
        <SelfHost />
        <StackStrip />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
