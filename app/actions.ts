"use server";

import {
  isValidSubscription,
  saveSubscription,
  deleteSubscription,
  type PushSubscriptionJSON,
  type ServiceResponse,
} from "@/lib/notifications";

export type { PushSubscriptionJSON, ServiceResponse };

export async function subscribeUser(sub: PushSubscriptionJSON): Promise<ServiceResponse> {
  if (!isValidSubscription(sub)) {
    return { success: false, error: "Invalid subscription" };
  }
  try {
    await saveSubscription(sub);
    return { success: true };
  } catch (error) {
    console.error("Subscribe failed:", error);
    return { success: false, error: "Failed to save subscription" };
  }
}

export async function unsubscribeUser(sub: PushSubscriptionJSON): Promise<ServiceResponse> {
  // Intentional asymmetry: only the endpoint is needed to identify and delete the record.
  // Skipping the full isValidSubscription() guard ensures that even if a client's
  // browser subscription keys become malformed, they can still successfully unsubscribe.
  if (!sub?.endpoint) return { success: false, error: "No endpoint" };
  try {
    await deleteSubscription(sub.endpoint);
    return { success: true };
  } catch (error) {
    console.error("Unsubscribe failed:", error);
    return { success: false, error: "Failed to remove subscription" };
  }
}
