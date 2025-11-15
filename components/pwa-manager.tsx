"use client";

import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { AndroidMenuIcon, IosShareIcon } from "./icon-pwa";
import { usePWA } from "./pwa-context";


export function PWAManager() {
  const { isPushSupported } = usePWA();
  const install = usePWAInstall();

  if (!install.mounted) return null;

  const showInstall =
    !install.isStandalone &&
    (install.canInstall || install.showInstallGuidance);

  
  const showSubscribe =
    isPushSupported && (!install.isMobile || install.isStandalone);

  return (
    <div className="space-y-8">
      {showInstall && <PWAInstallPrompt />}
      {showSubscribe ? (
        <PWASubscribeControls />
      ) : isPushSupported && install.isMobile ? (
        <p className="text-center text-sm text-muted-foreground">
          Install the app to enable push notifications.
        </p>
      ) : !isPushSupported ? (
        <p className="text-center text-sm text-muted-foreground">
          Push notifications are not supported on this device.
        </p>
      ) : null}
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
          <span role="img" aria-label="share icon">
            <IosShareIcon />
          </span>
          and then &quot;Add to Home Screen&quot;
        </p>
      )}

      {platform === "android" && !canInstall && (
        <p className="px-10 text-sm text-muted-foreground">
          To install this app, tap the menu button
          <span role="img" aria-label="menu icon">
            <AndroidMenuIcon />
          </span>
          and then &quot;Add to Home Screen&quot; or &quot;Install App&quot;
        </p>
      )}
    </div>
  );
}


function PWASubscribeControls() {
  const { permission, subscription, subscribe, unsubscribe, loading } =
    usePWA();

  const isBlocked = permission === "denied";
  const isSubscribed = !!subscription;

  return (
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
  );
}
