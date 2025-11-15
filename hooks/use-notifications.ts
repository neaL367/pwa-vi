"use client";

import { useState, useEffect } from "react";
import { sendNotification } from "@/server/actions";
import { TimeLeft } from "./use-countdown";

interface NotificationItem {
  body: string;
  key: string;
  requireInteraction?: boolean;
}

const NOTIFICATION_THRESHOLDS = {
  MINUTES: [30, 15, 5, 1],
  HOURS: [24, 12, 6, 3, 1],
  DAYS: [7, 6, 5, 4, 3, 2],
  WEEKS: [4, 3, 2],
  MONTHS: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
};

const getRemaining = (deadline: Date, offset: number) => {
  const now = Date.now() + offset;
  const diff = deadline.getTime() - now;
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff / 3600000) % 24);
  const minutes = Math.floor((diff / 60000) % 60);

  return { diff, days, hours, minutes };
};

const getPendingNotifications = (
  deadline: Date,
  offset: number
): NotificationItem[] => {
  const r = getRemaining(deadline, offset);
  if (!r) return [];

  const { diff, days, hours, minutes } = r;

  if (diff <= 1000)
    return [
      {
        body: "Grand Theft Auto VI is available now!",
        key: "now",
        requireInteraction: true,
      },
    ];

  if (days === 0 && NOTIFICATION_THRESHOLDS.MINUTES.includes(minutes))
    return [
      {
        body: `Only ${minutes} minute${
          minutes > 1 ? "s" : ""
        } until GTA VI release!`,
        key: `min${minutes}`,
      },
    ];

  if (days === 0 && NOTIFICATION_THRESHOLDS.HOURS.includes(hours))
    return [
      {
        body: `${hours} hour${hours > 1 ? "s" : ""} until GTA VI release!`,
        key: `h${hours}`,
      },
    ];

  if (days > 0 && NOTIFICATION_THRESHOLDS.DAYS.includes(days))
    return [
      {
        body: `${days} day${days > 1 ? "s" : ""} until GTA VI release!`,
        key: `d${days}`,
      },
    ];

  const weeks = Math.ceil(days / 7);
  if (weeks <= 4 && NOTIFICATION_THRESHOLDS.WEEKS.includes(weeks))
    return [
      {
        body: `${weeks} week${weeks > 1 ? "s" : ""} until GTA VI release!`,
        key: `w${weeks}`,
      },
    ];

  const months = Math.ceil(days / 30);
  if (months >= 2 && NOTIFICATION_THRESHOLDS.MONTHS.includes(months))
    return [
      {
        body: `${months} month${months > 1 ? "s" : ""} until GTA VI release!`,
        key: `m${months}`,
      },
    ];

  return [];
};

const isNotificationSupported = () =>
  typeof window !== "undefined" && "Notification" in window;
const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

export function useNotifications(
  deadline: Date,
  timeLeft: TimeLeft,
  offset: number
) {
  const [notified, setNotified] = useState<string[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [pushSubscription, setPushSubscription] =
    useState<PushSubscription | null>(null);

  useEffect(() => {
    if (!isNotificationSupported()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(true);
    if (!isPushSupported()) return;

    const initPush = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) setPushSubscription(sub);
      } catch {}
    };
    initPush();
  }, []);

  useEffect(() => {
    if (!isSupported || Notification.permission !== "granted") return;

    const pending = getPendingNotifications(deadline, offset).filter(
      (n) => !notified.includes(n.key)
    );
    if (pending.length === 0) return;

    const t = setTimeout(() => {
      pending.forEach((n) => {
        new Notification("Grand Theft Auto VI", {
          body: n.body,
          icon: "/apple-touch-icon.png",
          badge: "/apple-touch-icon.png",
          tag: n.key,
          requireInteraction: n.requireInteraction,
        });
        if (pushSubscription) sendNotification(n.body).catch(() => {});
      });
      setNotified((prev) => [...prev, ...pending.map((n) => n.key)]);
    }, 0);

    return () => clearTimeout(t);
  }, [timeLeft, notified, deadline, isSupported, pushSubscription, offset]);

  return { isSupported, hasPermission: Notification.permission === "granted" };
}
