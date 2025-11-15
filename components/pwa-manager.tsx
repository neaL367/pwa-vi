"use client";

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from "react";
import { Button } from "@/components/ui/button";
import { subscribeUser, unsubscribeUser } from "@/server/actions";
import { PushSubscriptionJSON } from "@/server/webpush";
import {
  isPushSupported,
  getNotificationPermission,
  urlBase64ToUint8Array,
} from "@/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

interface PWAContextType {
  isPushSupported: boolean;
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  loading: boolean;
}

const PWAContext = createContext<PWAContextType | null>(null);

export function PWAProvider({ children }: { children: React.ReactNode }) {
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

export function PWAManager() {
  // PWA Install state
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [mounted, setMounted] = useState(false);

  const {
    isPushSupported: pushSupported,
    permission,
    subscription,
    subscribe,
    unsubscribe,
    loading,
  } = usePWA();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafariMac =
      navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1;
    setIsIOS(isIOSDevice || isSafariMac);

    const isStandaloneDisplay = window.matchMedia(
      "(display-mode: standalone)"
    ).matches;
    const isIOSStandalone =
      (navigator as NavigatorStandalone).standalone === true;
    setIsStandalone(isStandaloneDisplay || isIOSStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      setDeferredPrompt(null);
    } catch (error) {
      console.error("Error showing install prompt:", error);
    }
  };

  if (!mounted) return null;

  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobileBrowser = isIOS || isAndroid;
  const isBlocked = permission === "denied";
  const isSubscribed = !!subscription;

  const showInstallPrompt =
    !isStandalone && (isIOS || isAndroid || !!deferredPrompt);


  const showSubscribeButton = !isMobileBrowser || isStandalone;

  return (
    <div className="space-y-8">
      {showInstallPrompt && (
        <div className="space-y-2 text-center font-deco-regular">
          <h3 className="text-lg font-semibold text-zinc-300">Install App</h3>

          {deferredPrompt && (
            <Button
              onClick={handleInstallClick}
              variant="outline"
              className="rounded-full"
            >
              Add to Home Screen
            </Button>
          )}

          {isIOS && !deferredPrompt && (
            <p className="px-10 text-sm text-muted-foreground">
              To install this app, tap the share button
              <span role="img" aria-label="share icon">
                {" "}
                <svg
                  className="inline-block w-4 h-4 mx-1"
                  viewBox="0 0 50 50"
                  fill="currentColor"
                >
                  <path d="M30.3 13.7L25 8.4l-5.3 5.3-1.4-1.4L25 5.6l6.7 6.7z" />
                  <path d="M24 7h2v21h-2z" />
                  <path d="M35 40H15c-1.7 0-3-1.3-3-3V19c0-1.7 1.3-3 3-3h7v2h-7c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h20c.6 0 1-.4 1-1V19c0-.6-.4-1-1-1h-7v-2h7c1.7 0 3 1.3 3 3v18c0 1.7-1.3 3-3 3z" />
                </svg>
              </span>
              and then &quot;Add to Home Screen&quot;
            </p>
          )}

          {isAndroid && !deferredPrompt && (
            <p className="px-10 text-sm text-muted-foreground">
              To install this app, tap the menu button
              <span role="img" aria-label="menu icon">
                {" "}
                <svg
                  className="inline-block w-4 h-4 mx-1"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </span>
              and then &quot;Add to Home Screen&quot; or &quot;Install App&quot;
            </p>
          )}
        </div>
      )}

      {pushSupported && showSubscribeButton ? (
        <div className="text-center font-deco-regular">
          <h3 className="mb-2 text-lg text-white font-semibold">
            Push Notifications
          </h3>
          {isSubscribed ? (
            <div className="space-y-3.5">
              <p className="text-sm text-muted-foreground">
                You are subscribed to notifications.
              </p>
              <Button
                onClick={unsubscribe}
                variant="outline"
                className="rounded-full"
                disabled={loading}
              >
                {loading ? "Unsubscribing..." : "Unsubscribe"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3.5">
              <p className="text-sm text-muted-foreground">
                {isBlocked
                  ? "Notifications are blocked."
                  : "Subscribe to get notified."}
              </p>
              {isBlocked ? (
                <p className="text-sm text-muted-foreground">
                  Enable notifications in your browser settings.
                </p>
              ) : (
                <Button
                  variant="outline"
                  onClick={subscribe}
                  className="rounded-full"
                  disabled={loading}
                >
                  {loading ? "Subscribing..." : "Subscribe"}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : !showSubscribeButton ? (
        <p className="text-center text-sm text-muted-foreground">
          Install the app to enable push notifications.
        </p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Push notifications are not supported on this device.
        </p>
      )}
    </div>
  );
}
