import type { MetadataRoute } from "next";
import { baseUrl } from "./sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["Googlebot", "Applebot", "Bingbot"],
        allow: ["/"],
        disallow: "/private/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
