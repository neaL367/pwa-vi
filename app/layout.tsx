import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import { cn } from "@/lib/cn";

import { metadata, viewport } from "./metadata";
import { ArtDecoBold, ArtDecoRegular, ArtDecoSemiBold } from "./fonts";

export { metadata, viewport };

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
