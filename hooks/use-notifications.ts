"use client";

import { useState, useEffect } from "react";
import { sendNotification } from "@/server/actions";
import { TimeLeft } from "./use-countdown";
import { usePWA } from "@/components/pwa-manager";
import { useLocalStorage } from "./use-local-storage"; 
import { isNotificationSupported } from "@/lib/pwa";

interface NotificationItem {
  body: string;
  key: string;
  requireInteraction?: boolean;
}

const NOTIFICATION_THRESHOLDS = {
  MINUTES: [30, 15, 5, 1],
  HOURS: [12, 6, 3, 1],
  DAYS: [7, 6, 5, 4, 3, 1],
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
  offset: number,
  title: string
): NotificationItem[] => {
  const r = getRemaining(deadline, offset);
  if (!r) return [];

  const { diff, days, hours, minutes } = r;

  if (diff <= 1000)
    return [
      {
        body: `${title} is available now!`,
        key: "now",
        requireInteraction: true,
      },
    ];

  // Check from smallest to largest unit
  if (
    days === 0 &&
    hours === 0 &&
    NOTIFICATION_THRESHOLDS.MINUTES.includes(minutes)
  )
    return [
      {
        body: `Only ${minutes} minute${
          minutes > 1 ? "s" : ""
        } until ${title} release!`,
        key: `min${minutes}`,
      },
    ];

  if (days === 0 && NOTIFICATION_THRESHOLDS.HOURS.includes(hours))
    return [
      {
        body: `${hours} hour${hours > 1 ? "s" : ""} until ${title} release!`,
        key: `h${hours}`,
      },
    ];

  // Note: This now triggers on "1 day"
  if (days > 0 && NOTIFICATION_THRESHOLDS.DAYS.includes(days))
    return [
      {
        body: `${days} day${days > 1 ? "s" : ""} until ${title} release!`,
        key: `d${days}`,
      },
    ];

  // Logic for weeks/months is fine, but ensure it doesn't overlap with days
  if (days > 7) {
    const weeks = Math.ceil(days / 7);
    if (weeks <= 4 && NOTIFICATION_THRESHOLDS.WEEKS.includes(weeks))
      return [
        {
          body: `${weeks} week${weeks > 1 ? "s" : ""} until ${title} release!`,
          key: `w${weeks}`,
        },
      ];
  }

  if (days > 30) {
    const months = Math.ceil(days / 30);
    if (months >= 2 && NOTIFICATION_THRESHOLDS.MONTHS.includes(months))
      return [
        {
          body: `${months} month${
            months > 1 ? "s" : ""
          } until ${title} release!`,
          key: `m${months}`,
        },
      ];
  }

  return [];
};

export function useNotifications(
  deadline: Date,
  timeLeft: TimeLeft,
  offset: number,
  options: { title: string }
) {
  const [notified, setNotified] = useLocalStorage<string[]>(
    "notified_keys",
    []
  );
  const { subscription, permission } = usePWA();

  const [isSupported, setIsSupported] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(isNotificationSupported());
  }, []);

  useEffect(() => {
    if (!isSupported || permission !== "granted") {
      return;
    }

    const pending = getPendingNotifications(
      deadline,
      offset,
      options.title
    ).filter((n) => !notified.includes(n.key));

    if (pending.length === 0) return;

    pending.forEach((n) => {
      new Notification(options.title, {
        body: n.body,
        icon: "/apple-touch-icon.png",
        badge: "/apple-touch-icon.png",
        tag: n.key,
        requireInteraction: n.requireInteraction,
      });

      if (subscription) {
        sendNotification(n.body).catch(() => {});
      }
    });

    setNotified((prev) => [...prev, ...pending.map((n) => n.key)]);

  }, [
    timeLeft,
    notified,
    setNotified,
    deadline,
    offset,
    isSupported,
    permission,
    subscription,
    options.title,
  ]);

  return {
    isSupported,
    hasPermission: permission === "granted",
  };
}
