"use client";

import { useState, useEffect } from "react";
import { getTime } from "@/lib/time";

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
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(
    calculateTimeLeft(target, 0)
  );

  useEffect(() => {
    getTime().then((offset) => setOffset(offset));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(target, offset));
    }, 1000);
    return () => clearInterval(timer);
  }, [target, offset]);

  return { timeLeft, isExpired: isExpired(timeLeft), offset};
}
