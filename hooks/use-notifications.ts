"use client";

import { useState, useEffect } from "react";
import { sendNotification } from "@/server/actions";
import { TimeLeft } from "./use-countdown";
import {
  getRemaining,
  getPendingNotificationKey,
  createNotificationItem,
} from "@/lib/notification";

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
    if (!isNotificationSupported()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    if (!isPushSupported()) return;

    const initPush = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) setPushSubscription(sub);
      } catch (err) {
        console.error("Failed to initialize push subscription:", err);
      }
    };
    initPush();
  }, []);

  useEffect(() => {
    if (
      !isSupported ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;

    const remaining = getRemaining(deadline, offset);

    const key = getPendingNotificationKey(remaining);

    if (key && !notified.includes(key)) {
      const item = createNotificationItem(key);

      new Notification("Grand Theft Auto VI", {
        body: item.body,
        icon: "/apple-touch-icon.png",
        badge: "/apple-touch-icon.png",
        tag: item.key,
        requireInteraction: item.requireInteraction,
      });

      if (pushSubscription) {
        sendNotification(item.body).catch((err) => {
          console.error("Failed to send push notification:", err);
        });
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotified((prev) => [...prev, key]);
    }
  }, [timeLeft, notified, deadline, isSupported, pushSubscription, offset]);

  return {
    isSupported,
    hasPermission:
      typeof window !== "undefined" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted",
  };
}