"use client";

import { Countdown } from "@/components/countdown";
import { PWASectionShell } from "@/components/pwa-section";
import { cn } from "@/lib/cn";
import { BG_GRADIENT } from "@/lib/constants";

export default function Page() {
  return (
    <main
      className={cn(
        "flex min-h-screen flex-col items-center justify-center font-sans",
        "px-[12.8px] sm:px-4.25 md:px-[28.8px]",
        BG_GRADIENT
      )}
    >
      <div className="flex flex-col items-center text-center font-deco-bold px-[12.8px] sm:px-4.25 md:px-[28.8px]">
        <PWASectionShell>
          <Countdown />
        </PWASectionShell>
      </div>
    </main>
  );
}
