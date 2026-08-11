import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nomadia",
    short_name: "Nomadia",
    description:
      "P2P fiat <-> crypto exchange, matched by location, settled in person.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d0e",
    theme_color: "#0b0d0e",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
