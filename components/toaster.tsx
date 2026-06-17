"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      richColors
      theme="dark"
      position="top-center"
      toastOptions={{
        style: {
          background: "linear-gradient(135deg, rgba(28, 24, 41, 0.9) 0%, rgba(18, 18, 24, 0.9) 100%)",
          border: "1px solid rgba(223, 58, 147, 0.25)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          color: "#ffffff",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        },
        classNames: {
          toast: "font-deco-semibold tracking-wide border-pink-500/25",
          title: "text-white font-deco-bold text-sm tracking-wide",
          description: "text-zinc-300 font-deco-regular text-xs",
          closeButton: "bg-black/40 hover:bg-black/60 border border-white/10 text-white",
        },
      }}
    />
  );
}
