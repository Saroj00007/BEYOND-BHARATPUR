import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YatraAI — Discover Bharatpur",
    short_name: "YatraAI",
    description: "Discover places and useful services around Bharatpur, Nepal.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8f5",
    theme_color: "#f6f8f5",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
