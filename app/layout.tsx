import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";

import { cn } from "@/lib/utils";

import type { Metadata, Viewport } from "next";

const baseUrl = "https://pwa-vi.vercel.app"

const ArtDecoRegular = localFont({
  src: "../public/art-deco-regular.woff",
  display: "swap",
  variable: "--font-art-deco-regular",
  preload: false,
});

const ArtDecoSemiBold = localFont({
  src: "../public/art-deco-semibold.woff",
  display: "swap",
  variable: "--font-art-deco-semibold",
  preload: false,
});

const ArtDecoBold = localFont({
  src: "../public/art-deco-bold.woff",
  display: "swap",
  variable: "--font-art-deco-bold",
  preload: false,
});

export const viewport: Viewport = {
  themeColor: "#191724",
};


export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Grand Theft Auto VI Countdown",
  description: "Countdown timer for Grand Theft Auto VI release",
  icons: [
    {
      url: "favicon.ico",
      sizes: "any",
      type: "image/x-icon",
    },
    {
      url: "apple-icon.png",
      sizes: "80x80",
      type: "image/png",
    },
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Grand Theft Auto VI Countdown",
    description: "Countdown timer for Grand Theft Auto VI release",
    images: [
      {
        url: `${baseUrl}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "neaL367 - Personal website",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Grand Theft Auto VI Countdown",
    description: "Countdown timer for Grand Theft Auto VI release",
    images: `${baseUrl}/opengraph-image.png`,
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          `${ArtDecoBold.variable} ${ArtDecoSemiBold.variable} ${ArtDecoRegular.variable} antialiased overflow-hidden`
        )}
      >
        <Analytics />
        <main>{props.children}</main>
      </body>
    </html>
  );
}
