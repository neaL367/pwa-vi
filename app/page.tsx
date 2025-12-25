"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { subscribeUser, unsubscribeUser } from "./actions";
import { Countdown } from "@/components/countdown";
import { cn } from "@/lib/cn";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface NavigatorIOS extends Navigator {
  standalone?: boolean;
}

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const BG_GRADIENT =
  "bg-linear-[223.17deg,#1c1829,#1b1828_8.61%,#191724_17.21%,#161520_25.82%,#14131c_34.42%,#121218_43.03%,#111117_51.63%]";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Manages Service Worker registration and Push Subscription state.

function usePushNotifications() {
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );

  // Check browser support safely
  const isSupported = useSyncExternalStore(
    () => () => {},
    () => "serviceWorker" in navigator && "PushManager" in window,
    () => false
  );

  // Sync existing subscription on mount
  useEffect(() => {
    if (!isSupported) return;

    async function sync() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const sub = await registration.pushManager.getSubscription();
        setSubscription(sub);
      } catch (error) {
        console.error("SW Registration failed:", error);
      }
    }
    sync();
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });
      setSubscription(sub);
      await subscribeUser(JSON.parse(JSON.stringify(sub)));
    } catch (error) {
      console.error("Subscription failed:", error);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    try {
      await unsubscribeUser(JSON.parse(JSON.stringify(subscription)));
      await subscription.unsubscribe();
      setSubscription(null);
    } catch (error) {
      console.error("Unsubscription failed:", error);
    }
  }, [subscription]);

  return { isSupported, subscription, subscribe, unsubscribe };
}


// Manages PWA installation logic for Android/Desktop and iOS detection.

function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  // Detect iOS
  const isIOS = useSyncExternalStore(
    () => () => {},
    () => {
      const ua = window.navigator.userAgent;
      return (
        /iPad|iPhone|iPod/i.test(ua) ||
        (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 0)
      );
    },
    () => false
  );

  // Detect Standalone Mode
  const isStandalone = useSyncExternalStore(
    () => () => {},
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as NavigatorIOS).standalone === true,
    () => false
  );

  // Listen for install prompt
  useEffect(() => {
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return { isIOS, isStandalone, deferredPrompt, triggerInstall };
}


function PushNotificationManager() {
  const { isSupported, subscription, subscribe, unsubscribe } =
    usePushNotifications();

  if (!isSupported) {
    return (
      <p className="text-white text-xs text-center font-deco-regular opacity-50">
        Push notifications not supported.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 max-w-md mx-auto font-deco-regular">
      <h3 className="text-xl font-semibold text-white mb-2">
        Push Notifications
      </h3>
      <p className="text-white/70 text-sm">
        {subscription
          ? "You are subscribed to push notifications."
          : "You are not subscribed to push notifications."}
      </p>

      <button
        onClick={subscription ? unsubscribe : subscribe}
        className="px-4 py-2 bg-white text-black hover:bg-white/90 rounded-full hover:cursor-pointer transition-colors duration-200 font-medium"
      >
        {subscription ? "Unsubscribe" : "Subscribe"}
      </button>
    </div>
  );
}

function InstallPrompt() {
  const { isIOS, isStandalone, deferredPrompt, triggerInstall } =
    usePwaInstall();

  // If already installed, don't show anything
  if (isStandalone) return null;

  // If it's not iOS and we don't have an install prompt yet (and not standalone), hide
  if (!isIOS && !deferredPrompt) return null;

  return (
    <div className="flex flex-col items-center gap-4 p-6 max-w-md mx-auto font-deco-regular">
      <h3 className="text-xl font-semibold text-white mb-2">Install App</h3>

      {/* Android / Desktop Install Button */}
      {deferredPrompt && (
        <button
          onClick={triggerInstall}
          className="px-4 py-2 bg-white text-black hover:bg-white/90 rounded-md transition-colors duration-200 font-medium"
        >
          Add to Home Screen
        </button>
      )}

      {/* iOS Instructions */}
      {isIOS && (
        <p className="text-white/70 text-sm text-center leading-relaxed">
          To install this app on your iOS device, tap the share button
          <span role="img" aria-label="share icon" className="mx-1">
            ⎋
          </span>
          and then &quot;Add to Home Screen&quot;
          <span role="img" aria-label="plus icon" className="mx-1">
            ➕
          </span>
          .
        </p>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <main
      className={cn(
        "flex min-h-screen flex-col items-center justify-center font-sans",
        "px-[12.8px] sm:px-[17px] md:px-[28.8px]",
        BG_GRADIENT
      )}
    >
      <div className="flex flex-col items-center text-center font-deco-bold px-[12.8px] sm:px-[17px] md:px-[28.8px]">
        <Countdown />
        <InstallPrompt />
        <PushNotificationManager />
      </div>
    </main>
  );
}
