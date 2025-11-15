interface NotificationItem {
  body: string;
  key: string;
  requireInteraction?: boolean;
}

const NOTIFICATION_THRESHOLDS = {
  MINUTES: [30, 15, 5, 1],
  HOURS: [24, 12, 6, 3, 1],
  DAYS: [7, 6, 5, 4, 3, 2, 1],
  WEEKS: [4, 3, 2],
  MONTHS: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
};

export const getRemaining = (deadline: Date, offset: number) => {
  const now = Date.now() + offset;
  const diff = deadline.getTime() - now;
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff / 3600000) % 24);
  const minutes = Math.floor((diff / 60000) % 60);

  return { diff, days, hours, minutes };
};

type RemainingTime = ReturnType<typeof getRemaining>;

export const getPendingNotificationKey = (r: RemainingTime): string | null => {
  if (!r) return null;
  const { diff, days, hours, minutes } = r;

  if (diff <= 1000) return "now";

  if (days === 0 && NOTIFICATION_THRESHOLDS.MINUTES.includes(minutes)) {
    return `min${minutes}`;
  }
  if (days === 0 && NOTIFICATION_THRESHOLDS.HOURS.includes(hours)) {
    return `h${hours}`;
  }
  if (days > 0 && NOTIFICATION_THRESHOLDS.DAYS.includes(days)) {
    return `d${days}`;
  }
  const weeks = Math.ceil(days / 7);
  if (weeks <= 4 && NOTIFICATION_THRESHOLDS.WEEKS.includes(weeks)) {
    return `w${weeks}`;
  }
  const months = Math.ceil(days / 30);
  if (months >= 2 && NOTIFICATION_THRESHOLDS.MONTHS.includes(months)) {
    return `m${months}`;
  }

  return null;
};

export const createNotificationItem = (key: string): NotificationItem => {
  const item: Omit<NotificationItem, "key"> & { key?: string } = {
    body: "GTA VI is coming!",
  };

  if (key === "now") {
    item.body = "Grand Theft Auto VI is available now!";
    item.requireInteraction = true;
  }

  const val = parseInt(key.slice(1), 10);
  if (key.startsWith("min")) {
    item.body = `Only ${val} minute${val > 1 ? "s" : ""} until GTA VI release!`;
  } else if (key.startsWith("h")) {
    item.body = `${val} hour${val > 1 ? "s" : ""} until GTA VI release!`;
  } else if (key.startsWith("d")) {
    item.body = `${val} day${val > 1 ? "s" : ""} until GTA VI release!`;
  } else if (key.startsWith("w")) {
    item.body = `${val} week${val > 1 ? "s" : ""} until GTA VI release!`;
  } else if (key.startsWith("m")) {
    item.body = `${val} month${val > 1 ? "s" : ""} until GTA VI release!`;
  }

  return { ...item, key };
};
