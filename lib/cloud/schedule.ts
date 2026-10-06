import type { Frequency, Schedule } from "./types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export { WEEKDAYS };

/** The next run strictly after `from`, in local time. */
export function computeNextRun(
  s: Pick<Schedule, "frequency" | "time" | "weekday" | "monthDay">,
  from: Date = new Date(),
): Date {
  const [hh, mm] = s.time.split(":").map(Number);
  const at = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);

  if (s.frequency === "daily") {
    const today = at(from);
    return today > from ? today : at(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1));
  }
  if (s.frequency === "weekly") {
    const delta = (s.weekday - from.getDay() + 7) % 7;
    const candidate = at(new Date(from.getFullYear(), from.getMonth(), from.getDate() + delta));
    return candidate > from
      ? candidate
      : at(new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate() + 7));
  }
  const thisMonth = at(new Date(from.getFullYear(), from.getMonth(), s.monthDay));
  return thisMonth > from ? thisMonth : at(new Date(from.getFullYear(), from.getMonth() + 1, s.monthDay));
}

export function describeSchedule(s: Pick<Schedule, "frequency" | "time" | "weekday" | "monthDay">): string {
  const time = formatTime(s.time);
  const labels: Record<Frequency, string> = {
    daily: `Every day at ${time}`,
    weekly: `Every ${WEEKDAYS[s.weekday]} at ${time}`,
    monthly: `Monthly on the ${ordinal(s.monthDay)} at ${time}`,
  };
  return labels[s.frequency];
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 45) return diff > 1 ? "in a moment" : "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
