import localFont from "next/font/local";

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
