"use server";

import webpush from "web-push";
import { sql } from "@/lib/neon";

webpush.setVapidDetails(
  "mailto:your-email@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type PushSubscriptionJSON = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type WebPushError = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

export async function subscribeUser(sub: PushSubscriptionJSON) {
  await sql`
      INSERT INTO "pushsubscription" (endpoint, p256dh, auth)
      VALUES (${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
      ON CONFLICT (endpoint)
      DO UPDATE SET
        p256dh = ${sub.keys.p256dh},
        auth = ${sub.keys.auth}
    `;

  return { success: true };
}

export async function unsubscribeUser(sub: PushSubscriptionJSON) {
  if (!sub?.endpoint) return { success: false, error: "No endpoint provided" };

  await sql`
      DELETE FROM "pushsubscription"
      WHERE endpoint = ${sub.endpoint}
    `;

  return { success: true };
}

export async function sendNotification(
  message: string,
  sub: PushSubscriptionJSON | null
) {
  const payload = JSON.stringify({
    title: "GTA VI Countdown",
    body: message,
    icon: "/icon.png",
  });

  const sendToSubscription = async (subscription: PushSubscriptionJSON) => {
    try {
      await webpush.sendNotification(subscription, payload);
      return { success: true };
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error
      ) {
        const err = error as WebPushError;

        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(
            "Cleaning up expired subscription:",
            subscription.endpoint
          );

          await sql`
              DELETE FROM "pushsubscription" 
              WHERE endpoint = ${subscription.endpoint}
            `;
          return { success: false, error: "Subscription expired and removed" };
        }
      }

      console.error("Error sending push notification:", error);
      return { success: false, error: "Failed to send" };
    }
  };

  // Single User
  if (sub) {
    return await sendToSubscription(sub);
  }

  // Broadcast
  try {
    const rows =
      await sql`SELECT endpoint, p256dh, auth FROM "pushsubscription"`;

    const subscriptions = rows.map((row) => ({
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    })) as PushSubscriptionJSON[];

    if (subscriptions.length === 0) {
      return { success: false, error: "No subscriptions found in DB" };
    }

    const results = await Promise.allSettled(
      subscriptions.map((s) => sendToSubscription(s))
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    return {
      success: true,
      message: `Sent to ${successCount} of ${subscriptions.length} subscribers`,
    };
  } catch (error) {
    console.error("Broadcast failed:", error);
    return { success: false, error: "Broadcast failed" };
  }
}
