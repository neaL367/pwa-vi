"use client";

import { useState, useEffect } from "react";
import type { TimeLeft } from "./use-countdown";
import { sendNotification } from "@/server/actions";

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

const calculateTimeRemaining = (deadline: Date) => {
  const diff = +deadline - +new Date();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);

  return { diff, days, hours, minutes };
};

const getPendingNotifications = (deadline: Date): NotificationItem[] => {
  const remaining = calculateTimeRemaining(deadline);
  if (!remaining) return [];

  const { diff, days, hours, minutes } = remaining;

  // Release notification
  if (diff <= 1000) {
    return [
      {
        body: "Grand Theft Auto VI is available now!",
        key: "now",
        requireInteraction: true,
      },
    ];
  }

  // Minute notifications
  if (days === 0 && NOTIFICATION_THRESHOLDS.MINUTES.includes(minutes)) {
    return [
      {
        body: `Only ${minutes} minute${
          minutes > 1 ? "s" : ""
        } until GTA VI release!`,
        key: `min${minutes}`,
      },
    ];
  }

  // Hour notifications
  if (days === 0 && NOTIFICATION_THRESHOLDS.HOURS.includes(hours)) {
    return [
      {
        body: `${hours} hour${hours > 1 ? "s" : ""} until GTA VI release!`,
        key: `h${hours}`,
      },
    ];
  }

  // Day notifications
  if (days > 0 && NOTIFICATION_THRESHOLDS.DAYS.includes(days)) {
    return [
      {
        body: `${days} day${days > 1 ? "s" : ""} until GTA VI release!`,
        key: `d${days}`,
      },
    ];
  }

  // Week notifications
  const weeks = Math.ceil(days / 7);
  if (weeks <= 4 && NOTIFICATION_THRESHOLDS.WEEKS.includes(weeks)) {
    return [
      {
        body: `${weeks} week${weeks > 1 ? "s" : ""} until GTA VI release!`,
        key: `w${weeks}`,
      },
    ];
  }

  // Month notifications
  const months = Math.ceil(days / 30);
  if (
    months >= 2 &&
    months <= 12 &&
    NOTIFICATION_THRESHOLDS.MONTHS.includes(months)
  ) {
    return [
      {
        body: `${months} month${
          months > 1 ? "s" : ""
        } until GTA VI release!`,
        key: `m${months}`,
      },
    ];
  }

  return [];
};

const isNotificationSupported = (): boolean => {
  return typeof window !== "undefined" && "Notification" in window;
};

const isPushSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
};

export function useNotifications(deadline: Date, timeLeft: TimeLeft) {
  const [notified, setNotified] = useState<string[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [pushSubscription, setPushSubscription] =
    useState<PushSubscription | null>(null);

  useEffect(() => {
    if (!isNotificationSupported()) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(true);

    if (!isPushSupported()) return;

    const initPushSubscription = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          setPushSubscription(subscription);
        }
      } catch (error) {
        console.error("Failed to initialize push subscription:", error);
      }
    };

    initPushSubscription();
  }, []);

  // Send notifications when thresholds are reached
  useEffect(() => {
    if (
      !isSupported ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    const pending = getPendingNotifications(deadline).filter(
      (notification) => !notified.includes(notification.key)
    );

    if (pending.length === 0) return;

    const timeout = setTimeout(() => {
      pending.forEach((notification) => {
        try {
          new Notification("Grand Theft Auto VI", {
            body: notification.body,
            icon: "/apple-touch-icon.png",
            badge: "/apple-touch-icon.png",
            tag: notification.key,
            requireInteraction: notification.requireInteraction,
          });

          if (pushSubscription) {
            sendNotification(notification.body).catch(console.error);
          }
        } catch (error) {
          console.error("Failed to send notification:", error);
        }
      });

      setNotified((prev) => [...prev, ...pending.map((n) => n.key)]);
    }, 0);

    return () => clearTimeout(timeout);
  }, [timeLeft, notified, deadline, isSupported, pushSubscription]);

  return {
    isSupported,
    hasPermission:
      typeof Notification !== "undefined" &&
      Notification.permission === "granted",
  };
}
