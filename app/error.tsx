"use client";

import { cn } from "@/lib/cn";
import { BG_GRADIENT } from "@/lib/constants";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={cn("flex min-h-screen flex-col items-center justify-center font-sans", BG_GRADIENT)}>
      <div className="text-center space-y-4 font-deco-bold px-[12.8px] sm:px-4.25 md:px-[28.8px]">
        <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
        <p className="text-white/60 text-sm">{error.message}</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-white text-black rounded-full font-medium transition-all hover:bg-white/90 hover:scale-105 active:scale-95 hover:cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
