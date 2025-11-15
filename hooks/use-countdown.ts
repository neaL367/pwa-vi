"use client";

import { useState, useEffect } from "react";

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

const calculateTimeLeft = (target: number, offset: number): TimeLeft => {
  const now = Date.now() + offset;
  const diff = target - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  return {
    days: Math.floor(diff / MILLISECONDS.DAY),
    hours: Math.floor((diff % MILLISECONDS.DAY) / MILLISECONDS.HOUR),
    minutes: Math.floor((diff % MILLISECONDS.HOUR) / MILLISECONDS.MINUTE),
    seconds: Math.floor((diff % MILLISECONDS.MINUTE) / MILLISECONDS.SECOND),
  };
};

const isExpired = (left: TimeLeft) =>
  left.days === 0 &&
  left.hours === 0 &&
  left.minutes === 0 &&
  left.seconds === 0;

export function useCountdown(deadline: Date) {
  const target = deadline.getTime();
  const [offset, setOffset] = useState(0);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(target, 0)
  );

  useEffect(() => {
    const syncTime = async () => {
      try {
        const clientStart = Date.now();
        const res = await fetch("/api/time");
        const data = await res.json();
        const clientEnd = Date.now();
        const serverTime = data.now;
        const latency = (clientEnd - clientStart) / 2;
        const clientTimeAtServer = clientEnd - latency;
        const newOffset = serverTime - clientTimeAtServer;
        setOffset(newOffset);

        setTimeLeft(calculateTimeLeft(target, newOffset));
      } catch (err) {
        console.error("Failed to sync server time:", err);
      }
    };
    syncTime();
  }, [target]);

  const expired = isExpired(timeLeft);

  useEffect(() => {
    if (expired) return;

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(target, offset));
    }, 1000);

    return () => clearInterval(timer);
  }, [target, offset, expired]);

  return { timeLeft, isExpired: expired, offset };
}
