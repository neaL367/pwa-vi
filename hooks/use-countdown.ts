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

const calculateTimeLeft = (targetTimestamp: number, offset: number): TimeLeft => {
  const now = Date.now() + offset;
  const diff = targetTimestamp - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(diff / MILLISECONDS.DAY),
    hours: Math.floor((diff % MILLISECONDS.DAY) / MILLISECONDS.HOUR),
    minutes: Math.floor((diff % MILLISECONDS.HOUR) / MILLISECONDS.MINUTE),
    seconds: Math.floor((diff % MILLISECONDS.MINUTE) / MILLISECONDS.SECOND),
  };
};

const isCountdownExpired = (timeLeft: TimeLeft): boolean => {
  return (
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0
  );
};

export function useCountdown(deadline: Date) {
  const targetTimestamp = deadline.getTime();
  const [offset, setOffset] = useState(0);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(
    calculateTimeLeft(targetTimestamp, 0)
  );

  useEffect(() => {
    const syncTime = async () => {
      try {
        const response = await fetch("/api/time");
        const data = await response.json();
        setOffset(data.now - Date.now());
      } catch (error) {
        console.error("Failed to sync time:", error);
      }
    };
    
    syncTime();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetTimestamp, offset));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTimestamp, offset]);

  const isExpired = isCountdownExpired(timeLeft);

  return { timeLeft, isExpired };
}