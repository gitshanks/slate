import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-access";
import { SLATE_HOSTED } from "@/lib/public-mode";

export const metadata: Metadata = {
  title: "slate",
  description: "Save what you want to watch. Share it when you want.",
  openGraph: {
    title: "slate",
    description: "Save what you want to watch. Share it when you want.",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "slate — save what you want to watch",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "slate",
    description: "Save what you want to watch. Share it when you want.",
    images: ["/opengraph-image"],
  },
};

export default async function LandingPage() {
  if (SLATE_HOSTED) {
    const session = await getAppSession();

    if (session?.user?.id) {
      redirect("/app");
    }
  }

  return null;
}
