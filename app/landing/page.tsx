import type { Metadata } from "next";
import { IndexLanding } from "@/components/landing/index-landing";
import { getAppSession } from "@/lib/app-access";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "slate · your watchlist for films and shows",
  description:
    "Save films and shows, track what you're watching, rate what you've seen, and share your Slate profile with friends.",
  openGraph: {
    title: "slate · your watchlist for films and shows",
    description:
      "Save films and shows, track what you're watching, rate what you've seen, and share your Slate profile with friends.",
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

  return <IndexLanding />;
}
