"use client";

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";
import { subscribeUser, unsubscribeUser } from "@/server/actions";
import { PushSubscriptionJSON } from "@/server/webpush";
import {
  isPushSupported,
  getNotificationPermission,
  urlBase64ToUint8Array,
} from "@/lib/pwa";

interface PWAContextType {
  isPushSupported: boolean;
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  loading: boolean;
}

const PWAContext = createContext<PWAContextType | null>(null);

export function PWAProvider({ children }: { children: ReactNode }) {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const pushSupported = isPushSupported();

  useEffect(() => {
    setPermission(getNotificationPermission());
    if (!pushSupported) return;

    const initServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const existingSubscription =
          await registration.pushManager.getSubscription();
        if (existingSubscription) {
          setSubscription(existingSubscription);
        }
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    };

    initServiceWorker();
  }, [pushSupported]);

  const subscribe = useCallback(async () => {
    if (!pushSupported || subscription || loading) return;

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        throw new Error("Permission not granted");
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("VAPID public key not configured");
      }

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      setSubscription(newSubscription);
      await subscribeUser(newSubscription.toJSON() as PushSubscriptionJSON);
      console.log("Successfully subscribed to push notifications");
    } catch (error) {
      console.error("Subscription failed:", error);
    } finally {
      setLoading(false);
    }
  }, [pushSupported, subscription, loading]);

  const unsubscribe = useCallback(async () => {
    if (!subscription || loading) return;

    setLoading(true);
    try {
      await subscription.unsubscribe();
      await unsubscribeUser(subscription.endpoint);
      setSubscription(null);
      console.log("Successfully unsubscribed from push notifications");
    } catch (error) {
      console.error("Unsubscription failed:", error);
    } finally {
      setLoading(false);
    }
  }, [subscription, loading]);

  const value = useMemo(
    () => ({
      isPushSupported: pushSupported,
      permission,
      subscription,
      subscribe,
      unsubscribe,
      loading,
    }),
    [pushSupported, permission, subscription, subscribe, unsubscribe, loading]
  );

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error("usePWA must be used within a PWAProvider");
  }
  return context;
};