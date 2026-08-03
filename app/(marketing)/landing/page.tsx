import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-access";
import { SLATE_HOSTED } from "@/lib/public-mode";

export const metadata: Metadata = {
  title: "slate · never lose a good recommendation",
  description: "Save what you want to watch. Share it when you want.",
  openGraph: {
    title: "slate · never lose a good recommendation",
    description: "Save what you want to watch. Share it when you want.",
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

  return null;
}
