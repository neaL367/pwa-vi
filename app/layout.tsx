import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";

import { cn } from "@/lib/cn";
import { baseUrl } from "./sitemap";
import type { Metadata, Viewport } from "next";

export const ArtDecoRegular = localFont({
  src: "../public/art-deco-regular.woff",
  display: "swap",
  variable: "--font-art-deco-regular",
  preload: false,
});

export const ArtDecoSemiBold = localFont({
  src: "../public/art-deco-semibold.woff",
  display: "swap",
  variable: "--font-art-deco-semibold",
  preload: false,
});

export const ArtDecoBold = localFont({
  src: "../public/art-deco-bold.woff",
  display: "swap",
  variable: "--font-art-deco-bold",
  preload: false,
});

const siteConfig = {
  title: "Grand Theft Auto VI Countdown",
  description: "Countdown timer for Grand Theft Auto VI release",
  url: baseUrl,
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: siteConfig.title,
  description: siteConfig.description,
  manifest: "../manifest.json",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.title,
  },
  icons: [
    {
      url: "favicon.ico",
      sizes: "any",
      type: "image/x-icon",
    },
    {
      url: "/apple-icon.png",
      sizes: "80x80",
      type: "image/png",
    },
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: `${siteConfig.url}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: siteConfig.title,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteConfig.title,
    description: siteConfig.description,
    images: `${siteConfig.url}/opengraph-image.png`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout(props: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body
        className={cn(
          `${ArtDecoBold.variable} ${ArtDecoSemiBold.variable} ${ArtDecoRegular.variable} antialiased`
        )}
      >
        <Analytics />
        <main>{props.children}</main>
      </body>
    </html>
  );
}
