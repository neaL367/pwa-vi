"use server";

import { neon } from "@neondatabase/serverless";
import webpush, { PushSubscriptionJSON } from "./webpush";

export const sql = neon(process.env.DATABASE_URL!);

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

/**
 * Subscribe a user to push notifications
 * Stores subscription in database
 */
export async function subscribeUser(
  sub: PushSubscriptionJSON,
  userId?: string
): Promise<SubscriptionResult> {
  try {
    await sql`
      INSERT INTO pushSubscription (id, endpoint, p256dh, auth, "userId")
      VALUES (
        gen_random_uuid(), 
        ${sub.endpoint}, 
        ${sub.keys.p256dh}, 
        ${sub.keys.auth}, 
        ${userId ?? null}
      )
      ON CONFLICT (endpoint)
      DO UPDATE SET 
        p256dh = ${sub.keys.p256dh}, 
        auth = ${sub.keys.auth}, 
        "userId" = ${userId ?? null}
    `;

    return { success: true };
  } catch (error) {
    console.error("Failed to subscribe user:", error);
    return { success: false, error: "Failed to save subscription" };
  }
}

/**
 * Unsubscribe a user from push notifications
 * Removes subscription from database
 */
export async function unsubscribeUser(
  endpoint?: string
): Promise<SubscriptionResult> {
  try {
    if (endpoint) {
      await sql`
        DELETE FROM pushSubscription
        WHERE endpoint = ${endpoint}
      `;
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to unsubscribe user:", error);
    return { success: false, error: "Failed to remove subscription" };
  }
}

/**
 * Send push notification to all subscribed users
 * Handles invalid subscriptions by removing them
 */
export async function sendNotification(
  message: string
): Promise<NotificationResult> {
  try {
    const subscriptions = await sql`
      SELECT endpoint, p256dh, auth
      FROM pushSubscription
    `;

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

    const failedSubscriptions = subscriptions.filter((_, index) => {
      const result = results[index];
      if (result.status === "rejected") {
        const error = result.reason;
        return error?.statusCode === 410 || error?.statusCode === 404;
      }
      return false;
    });

    if (failedSubscriptions.length > 0) {
      await Promise.all(
        failedSubscriptions.map((sub) =>
          sql`DELETE FROM pushSubscription WHERE endpoint = ${sub.endpoint}`
        )
      );
      console.log(`Cleaned up ${failedSubscriptions.length} invalid subscriptions`);
    }

    return {
      success: true,
      sent: successCount,
      failed: failedCount,
    };
  } catch (error) {
    console.error("Failed to send notifications:", error);
    return {
      success: false,
      error: "Failed to send notification",
    };
  }
}