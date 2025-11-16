import type { MetadataRoute } from "next";

export const baseUrl = "https://pwa-vi.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "always",
      priority: 1,
    },
  ];
}
