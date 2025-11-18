"use client";

import { useState, useEffect, useRef } from "react";

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const MILLISECONDS = {
  DAY: 86400000,
  HOUR: 3600000,
  MINUTE: 60000,
  SECOND: 1000,
};

const calculateTimeLeftFromDiff = (diff: number): TimeLeft => {
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  return {
    days: Math.floor(diff / MILLISECONDS.DAY),
    hours: Math.floor((diff % MILLISECONDS.DAY) / MILLISECONDS.HOUR),
    minutes: Math.floor((diff % MILLISECONDS.HOUR) / MILLISECONDS.MINUTE),
    seconds: Math.floor((diff % MILLISECONDS.MINUTE) / MILLISECONDS.SECOND),
  };
};

export const isExpired = (left: TimeLeft) =>
  left.days === 0 &&
  left.hours === 0 &&
  left.minutes === 0 &&
  left.seconds === 0;

export function useCountdown(deadline: Date) {
  const target = deadline.getTime();
  const [offset, setOffset] = useState<number>(0); // ms (serverNow - clientNow)
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => {
    const diff = target - Date.now();
    return calculateTimeLeftFromDiff(diff);
  });

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // try to sync time once at mount
    const ac = new AbortController();
    async function syncTime() {
      try {
        const res = await fetch("/api/time", {
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Time fetch failed");
        const json = await res.json();
        const serverNow = Number(json?.now) || Date.now();
        const newOffset = serverNow - Date.now();
        if (mountedRef.current) setOffset(newOffset);
      } catch {
        // fallback: use 0 offset (client time)
        if (mountedRef.current) setOffset(0);
      }
    }
    syncTime();

    return () => ac.abort();
  }, []);

  useEffect(() => {
    // Single interval that updates every 1s, but we compute based on Date to avoid drift.
    // eslint-disable-next-line prefer-const
    let rafId: number | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      const now = Date.now() + offset;
      const diff = target - now;
      const next = calculateTimeLeftFromDiff(diff);
      if (mountedRef.current) setTimeLeft(next);
    };

    // initial tick
    tick();

    // use setInterval for sensible battery usage; but schedule next tick aligned with clock.
    intervalId = setInterval(tick, 1000);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [target, offset]);

  return {
    timeLeft,
    isExpired: isExpired(timeLeft),
    offset,
  };
}
