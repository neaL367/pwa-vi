"use client";

import { TimeLeft } from "@/hooks/use-countdown";
import { cn } from "@/lib/cn";

interface TimerProps {
  timeLeft: TimeLeft | null;
  isExpired: boolean;
}

const formatNumber = (num: number): string => String(num).padStart(2, "0");

const TimerValue = ({ value, label }: { value: number; label: string }) => (
  <>
    <span className="tabular-nums tracking-normal" suppressHydrationWarning>
      {formatNumber(value)}
    </span>
    {label}{" "}
  </>
);

export function Timer({ timeLeft, isExpired }: TimerProps) {
  const timerClasses = cn(
    "block text-[min(8vw,3.5vh)] md:text-[clamp(3.5vh,11vw,4vh)]",
    "bg-radial-[circle_at_50%_75%] from-[#ffd27b] to-[#df3a93] from-0%",
    "text-transparent bg-clip-text isolate wrap-break-word text-nowrap",
    "leading-[86%] tracking-[-.04em] md:tracking-[-.0125em]"
  );

  if (isExpired) {
    return (
      <h4 className={timerClasses}>
        <span>Available Now!</span>
      </h4>
    );
  }

  const { days = 0, hours = 0, minutes = 0, seconds = 0 } = timeLeft || {};

  return (
    <h4 className={timerClasses}>
      <span>
        <TimerValue value={days} label="d" />
        <TimerValue value={hours} label="h" />
        <TimerValue value={minutes} label="m" />
        <TimerValue value={seconds} label="s" />
      </span>
    </h4>
  );
}
