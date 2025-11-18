interface NotificationItem {
  title?: string;
  body: string;
  key: string;
  requireInteraction?: boolean;
  icon?: string;
  badge?: string;
}

const NOTIFICATION_THRESHOLDS = {
  MINUTES: [30, 15, 5, 1],
  HOURS: [24, 12, 6, 3, 1],
  DAYS: [7, 6, 5, 4, 3, 2, 1],
  WEEKS: [4, 3, 2, 1],
  MONTHS: [12, 6, 3, 2],
};

export const getRemaining = (deadline: Date, offset: number) => {
  const now = Date.now() + (offset || 0);
  const diff = deadline.getTime() - now;
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff / 3600000) % 24);
  const minutes = Math.floor((diff / 60000) % 60);

  return { diff, days, hours, minutes };
};

type Remaining = ReturnType<typeof getRemaining>;

export const getPendingNotificationKey = (r: Remaining): string | null => {
  if (!r) return null;
  const { diff, days, hours, minutes } = r;

  // Immediately now
  if (diff <= 1000) return "now";

  // Minutes (within same day)
  if (days === 0 && NOTIFICATION_THRESHOLDS.MINUTES.includes(minutes)) {
    return `min${minutes}`;
  }

  // Hours (within same day)
  if (days === 0 && NOTIFICATION_THRESHOLDS.HOURS.includes(hours)) {
    return `h${hours}`;
  }

  // Days
  if (days > 0 && NOTIFICATION_THRESHOLDS.DAYS.includes(days)) {
    return `d${days}`;
  }

  // Weeks
  const weeks = Math.ceil(days / 7);
  if (weeks <= 4 && NOTIFICATION_THRESHOLDS.WEEKS.includes(weeks)) {
    return `w${weeks}`;
  }

  // Months (approx)
  const months = Math.floor(days / 30);
  if (months >= 2 && NOTIFICATION_THRESHOLDS.MONTHS.includes(months)) {
    return `m${months}`;
  }

  return null;
};

export const createNotificationItem = (key: string): NotificationItem => {
  const base: Omit<NotificationItem, "key"> = {
    title: "Grand Theft Auto VI",
    body: "GTA VI is coming!",
    requireInteraction: false,
    icon: "/apple-touch-icon.png",
    badge: "/apple-touch-icon.png",
  };

  if (key === "now") {
    return {
      ...base,
      key,
      body: "Grand Theft Auto VI is available now!",
      requireInteraction: true,
    };
  }

  const val = parseInt(key.slice(1), 10);
  if (key.startsWith("min")) {
    return {
      ...base,
      key,
      body: `Only ${val} minute${val > 1 ? "s" : ""} until GTA VI release!`,
    };
  }
  if (key.startsWith("h")) {
    return {
      ...base,
      key,
      body: `${val} hour${val > 1 ? "s" : ""} until GTA VI release!`,
    };
  }
  if (key.startsWith("d")) {
    return {
      ...base,
      key,
      body: `${val} day${val > 1 ? "s" : ""} until GTA VI release!`,
    };
  }
  if (key.startsWith("w")) {
    return {
      ...base,
      key,
      body: `${val} week${val > 1 ? "s" : ""} until GTA VI release!`,
    };
  }
  if (key.startsWith("m")) {
    return {
      ...base,
      key,
      body: `${val} month${val > 1 ? "s" : ""} until GTA VI release!`,
    };
  }

  return { ...base, key };
};
