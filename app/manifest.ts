import type { MetadataRoute } from "next";

import { APP_ROOT } from "@/lib/public-mode";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "slate",
    short_name: "slate",
    description: "A private Letterboxd for the things you want to watch.",
    start_url: APP_ROOT,
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#ADEBB3",
    icons: [
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    share_target: {
      action: "/share",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
