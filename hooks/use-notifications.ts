"use client";

import { useEffect, useRef, useState } from "react";
import { sendNotification } from "@/server/actions";
import type { TimeLeft } from "./use-countdown";
import {
  getRemaining,
  getPendingNotificationKey,
  createNotificationItem,
} from "@/lib/notification";

const SUPPORTS_NOTIFICATION =
  typeof window !== "undefined" && "Notification" in window;
const SUPPORTS_PUSH =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

const LOCAL_STORAGE_KEY = "notified-keys-v1";

export function useNotifications(
  deadline: Date,
  timeLeft: TimeLeft,
  offset: number
) {
  const notifiedRef = useRef<Set<string>>(new Set());
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [pushSubscription, setPushSubscription] =
    useState<PushSubscription | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load persisted notified keys from localStorage once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(SUPPORTS_NOTIFICATION);
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        notifiedRef.current = new Set(arr);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initialize service worker subscription (non-blocking)
  useEffect(() => {
    if (!SUPPORTS_PUSH) return;
    let mounted = true;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (mounted) setPushSubscription(sub);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Persist notified keys when changed
  const persistNotified = () => {
    try {
      const arr = Array.from(notifiedRef.current);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // This runs every render where timeLeft changes (once per second typically).
    if (!isSupported) return;

    // Do not spam if tab is hidden: optional - but often we still want push to handle offline notifications
    const remaining = getRemaining(deadline, offset);
    const key = getPendingNotificationKey(remaining);

    if (!key) return;
    if (notifiedRef.current.has(key)) return;

    // Avoid local notification if permission not granted.
    const permission =
      typeof Notification !== "undefined" ? Notification.permission : "default";
    const canLocalNotify = permission === "granted";

    const item = createNotificationItem(key);

    // Prefer server push if we have a subscription and server supports scheduled pushes:
    // We still create a local notification so user receives immediate feedback (if permitted).
    if (canLocalNotify) {
      try {
        // Guard: avoid creating notification if the page is hidden to avoid duplicate SW notifications.
        const docHidden =
          typeof document !== "undefined" &&
          document.visibilityState === "hidden";
        if (!docHidden) {
          new Notification(item.title ?? "Notification", {
            body: item.body,
            icon: item.icon ?? "/apple-touch-icon.png",
            badge: item.badge ?? "/apple-touch-icon.png",
            tag: item.key,
            requireInteraction: item.requireInteraction ?? false,
            data: { key: item.key },
          });
        }
      } catch (err) {
        // ignore errors from Notification constructor
        // browsers might throw if not allowed
        console.error("local notification failed", err);
      }
    }

    // Attempt to trigger a server-side push (best-effort)
    if (pushSubscription) {
      (async () => {
        try {
          await sendNotification(item.body);
        } catch (err) {
          // server-side push failed; ignore
          console.error("sendNotification failed", err);
        }
      })();
    }

    // Mark notified and persist
    notifiedRef.current.add(key);
    persistNotified();
  }, [timeLeft, deadline, offset, isSupported, pushSubscription]);

  const hasPermission =
    typeof Notification !== "undefined" &&
    Notification.permission === "granted";

  return {
    isSupported,
    hasPermission,
    pushSubscription,
  };
}
