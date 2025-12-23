"use server";

import webpush, { PushSubscriptionJSON } from "./webpush";
import { sql } from "@/lib/db";

interface SubscriptionResult {
  success: boolean;
  error?: string;
}

interface NotificationResult {
  success: boolean;
  sent?: number;
  failed?: number;
  error?: string;
}

interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function subscribeUser(
  sub: PushSubscriptionJSON,
  userId?: string
): Promise<SubscriptionResult> {
  try {
    await sql`
      INSERT INTO pushSubscription (id, endpoint, p256dh, auth, "userId")
      VALUES (gen_random_uuid(), ${sub.endpoint}, ${sub.keys.p256dh}, ${
      sub.keys.auth
    }, ${userId ?? null})
      ON CONFLICT (endpoint) DO UPDATE SET p256dh = ${
        sub.keys.p256dh
      }, auth = ${sub.keys.auth}, "userId" = ${userId ?? null}
    `;
    return { success: true };
  } catch (error) {
    console.error("Failed to subscribe user:", error);
    return { success: false, error: "Failed to save subscription" };
  }
}

export async function unsubscribeUser(
  endpoint?: string
): Promise<SubscriptionResult> {
  try {
    if (endpoint) {
      await sql`DELETE FROM pushSubscription WHERE endpoint = ${endpoint}`;
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to unsubscribe user:", error);
    return { success: false, error: "Failed to remove subscription" };
  }
}

export async function sendNotification(
  message: string
): Promise<NotificationResult> {
  try {
    const subscriptionsRaw =
      await sql`SELECT endpoint, p256dh, auth FROM pushSubscription`;

    const subscriptions: PushSubscriptionRecord[] = subscriptionsRaw.map(
      (row) => ({
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      })
    );

    if (subscriptions.length === 0) {
      return { success: true, sent: 0, failed: 0 };
    }

    const notificationPayload = JSON.stringify({
      title: "Grand Theft Auto VI",
      body: message,
      icon: "/apple-touch-icon.png",
      badge: "/apple-touch-icon.png",
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        url: "/",
      },
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload
        )
      )
    );

    const failedCount = results.filter((r) => r.status === "rejected").length;
    const successCount = subscriptions.length - failedCount;

    // Clean up invalid subscriptions (410 / 404)
    const failedSubscriptions = subscriptions.filter((_, index) => {
      const result = results[index];
      if (result.status === "rejected") {
        const err = (result as PromiseRejectedResult).reason;
        const status = err?.statusCode ?? err?.status;
        return status === 410 || status === 404;
      }
      return false;
    });

    if (failedSubscriptions.length > 0) {
      await Promise.all(
        failedSubscriptions.map(
          (sub) =>
            sql`DELETE FROM pushSubscription WHERE endpoint = ${sub.endpoint}`
        )
      );
      console.log(
        `Cleaned up ${failedSubscriptions.length} invalid subscriptions`
      );
    }

    return { success: true, sent: successCount, failed: failedCount };
  } catch (error) {
    console.error("Failed to send notifications:", error);
    return { success: false, error: "Failed to send notification" };
  }
}
