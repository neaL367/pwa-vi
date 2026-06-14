"use server";

import {
  isValidSubscription,
  saveSubscriptionToDb,
  deleteSubscriptionFromDb,
  type PushSubscriptionJSON,
  type ServiceResponse,
} from "@/lib/notifications";

export type { PushSubscriptionJSON, ServiceResponse };

export async function subscribeUser(sub: PushSubscriptionJSON): Promise<ServiceResponse> {
  if (!isValidSubscription(sub)) {
    return { success: false, error: "Invalid subscription" };
  }
  try {
    await saveSubscriptionToDb(sub);
    return { success: true };
  } catch (error) {
    console.error("Subscribe failed:", error);
    return { success: false, error: "Failed to save subscription" };
  }
}

export async function unsubscribeUser(sub: PushSubscriptionJSON): Promise<ServiceResponse> {
  if (!sub?.endpoint) return { success: false, error: "No endpoint" };
  try {
    await deleteSubscriptionFromDb(sub.endpoint);
    return { success: true };
  } catch (error) {
    console.error("Unsubscribe failed:", error);
    return { success: false, error: "Failed to remove subscription" };
  }
}
