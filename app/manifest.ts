import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grand Theft Auto VI Countdown",
    short_name: "GTA VI",
    description: "Countdown timer for Grand Theft Auto VI release",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    icons: [
      {
        src: "/apple-touch-icon.png",
        sizes: "80x80",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon-precomposed.png",
        sizes: "80x80",
        type: "image/png",
      },
    ],
  };
}
