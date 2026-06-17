export const RELEASE_DATE = "2026-11-19";

export const BG_GRADIENT =
  "bg-linear-[223.17deg,#1c1829,#1b1828_8.61%,#191724_17.21%,#161520_25.82%,#14131c_34.42%,#121218_43.03%,#111117_51.63%]";

// Define base units sequentially to avoid repeating math
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// For rough TTLs/Caching only. (Use 30 flat days to avoid time-of-day drift)
const MONTH_APPROX = 30 * DAY;

export const MILLISECONDS = {
  SECOND,
  MINUTE,
  HOUR,
  DAY,
  WEEK,
  /** @deprecated Use Date methods for exact calendar math. This is an approximation for TTLs. */
  MONTH_APPROX,
} as const;
