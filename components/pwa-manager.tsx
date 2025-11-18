"use client";

import { Button } from "@/components/ui/button";
import { usePWA } from "./pwa-context";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { AndroidMenuIcon, IosShareIcon } from "./icons/icon-pwa";

export function PWAManager() {
  const { isPushSupported, isOnline } = usePWA();
  const install = usePWAInstall();
  if (!install.mounted) return null;

  if (!isOnline) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Notifications are not available while you are offline.
      </p>
    );
  }

  const showInstall =
    !install.isStandalone &&
    (install.canInstall || install.showInstallGuidance);

  const showSubscribe = isPushSupported;

  return (
    <div className="space-y-8">
      {showInstall && <PWAInstallPrompt />}
      {showSubscribe && <PWASubscribeControls />}
      {!showSubscribe && (
        <p className="text-center text-sm text-muted-foreground">
          Push notifications are not supported on this device.
        </p>
      )}
    </div>
  );
}

function PWAInstallPrompt() {
  const { platform, canInstall, triggerInstall } = usePWAInstall();
  return (
    <div className="space-y-2 text-center font-deco-regular">
      <h3 className="text-lg font-semibold text-zinc-300">Install App</h3>
      {canInstall && (
        <Button
          onClick={triggerInstall}
          variant="outline"
          className="rounded-full"
        >
          Add to Home Screen
        </Button>
      )}
      {platform === "ios" && !canInstall && (
        <p className="px-10 text-sm text-muted-foreground">
          To install this app, tap the share button
          <IosShareIcon /> and then “Add to Home Screen”.
        </p>
      )}
      {platform === "android" && !canInstall && (
        <p className="px-10 text-sm text-muted-foreground">
          To install this app, tap the menu button <AndroidMenuIcon /> then “Add
          to Home Screen”.
        </p>
      )}
    </div>
  );
}

function PWASubscribeControls() {
  const { permission, subscription, subscribe, unsubscribe, loading } =
    usePWA();
  const isSubscribed = !!subscription;
  const isBlocked = permission === "denied";

  return (
    <div className="text-center font-deco-regular">
      <h3 className="mb-2 text-lg font-semibold text-white">
        Push Notifications
      </h3>
      {isSubscribed ? (
        <div className="space-y-3.5">
          <p className="text-sm text-muted-foreground">You are subscribed.</p>
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
              : "Subscribe to notifications."}
          </p>
          {isBlocked ? (
            <p className="text-sm text-muted-foreground">
              Change notification settings in your browser.
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
  );
}
