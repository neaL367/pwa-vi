"use client";

import { Suspense } from "react";
import { cn } from "@/lib/cn";

import { LogoVI } from "@/components/logo/logo-vi";
import { LogoPlayStation } from "@/components/logo/logo-playstation";
import { LogoXbox } from "@/components/logo/logo-xbox";
import { Title } from "@/components/title";
import { Quote } from "@/components/quote";
import { Timer } from "@/components/timer";

import { PWAManager } from "@/components/pwa-manager";
import { PWAProvider } from "@/components/pwa-context";

import { useCountdown } from "@/hooks/use-countdown";
import { useNotifications } from "@/hooks/use-notifications";

function PageContent() {
  const deadline = new Date(2026, 10, 19, 0, 0, 0);
  const { timeLeft, isExpired, offset } = useCountdown(deadline);

  useNotifications(deadline, timeLeft, offset);

  return (
    <div
      className={cn(
        `px-[12.8px] sm:px-[17px] md:px-[28.8px] flex min-h-screen flex-col items-center justify-center font-sans`,
        `bg-linear-[223.17deg,#1c1829,#1b1828_8.61%,#191724_17.21%,#161520_25.82%,#14131c_34.42%,#121218_43.03%,#111117_51.63%]`
      )}
    >
      <div
        className={cn(
          `px-[12.8px] sm:px-[17px] md:px-[28.8px]`,
          `flex flex-col items-center text-center font-deco-bold`
        )}
      >
        <div className="flex flex-col items-center gap-[calc(clamp(6vh,11vw,6vh)*.4)]">
          <LogoVI />
          <div
            className={cn(
              `w-[calc(clamp(8vh,8vw,10vh)*3)] h-[calc(clamp(8vh,8vw,10vh)*0.22)]`,
              `flex justify-between gap-[calc(clamp(6vh,11vw,6vh)*.4)]`
            )}
          >
            <LogoPlayStation />
            <LogoXbox />
          </div>
          <Title />
          <Quote />
          <Timer timeLeft={timeLeft} isExpired={isExpired} />
        </div>
      </div>

      <div className="mt-12 flex gap-6 flex-col justify-center">
        <PWAProvider>
          <PWAManager />
        </PWAProvider>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
