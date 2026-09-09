export interface TimeRange {
  oldest?: number;
  latest?: number;
  label: string;
}

const DUR_RE =
  /^(?:last\s+)?(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mo)$/i;

export function parseTimeRange(opts: {
  since?: string;
  latest?: string;
  now?: Date;
  tz?: string;
}): TimeRange {
  const now = opts.now ?? new Date();
  const tz = opts.tz ?? "UTC";
  const latest = opts.latest ? parseBound(opts.latest, now, tz, "end") : undefined;
  const oldest = opts.since ? parseBound(opts.since, now, tz, "start") : undefined;
  const parts: string[] = [];
  if (opts.since) parts.push(`since ${opts.since}`);
  if (opts.latest) parts.push(`until ${opts.latest}`);
  return {
    oldest: oldest ? Math.floor(oldest.getTime() / 1000) : undefined,
    latest: latest ? Math.floor(latest.getTime() / 1000) : undefined,
    label: parts.join(" ") || "latest",
  };
}

export function parseExpiration(
  input: string | undefined,
  now: Date,
  tz: string,
): number | undefined {
  if (!input || !input.trim()) return undefined;
  const bound = parseBound(input, now, tz, "end");
  return Math.floor(bound.getTime() / 1000);
}

function parseBound(input: string, now: Date, tz: string, edge: "start" | "end"): Date {
  const raw = input.trim().toLowerCase();
  if (!raw) return now;

  if (raw === "now") return now;
  if (raw === "today") return edge === "start" ? startOfDay(now, tz) : now;
  if (raw === "yesterday") {
    const start = startOfDay(now, tz);
    const y = new Date(start.getTime() - 86_400_000);
    return edge === "start" ? y : start;
  }

  const dur = DUR_RE.exec(raw);
  if (dur) {
    const n = Number(dur[1]);
    const unit = dur[2].toLowerCase();
    return new Date(now.getTime() - n * unitMs(unit));
  }

  if (/^\d{10}$/.test(raw)) return new Date(Number(raw) * 1000);
  if (/^\d{13}$/.test(raw)) return new Date(Number(raw));

  const iso = Date.parse(input);
  if (!Number.isNaN(iso)) return new Date(iso);

  const weekday = weekdayOffset(raw, now, tz);
  if (weekday) return weekday;

  throw new Error(
    `Could not parse time "${input}". Try today, yesterday, 4h, 7d, 1w, an ISO date, or unix seconds.`,
  );
}

function unitMs(unit: string): number {
  if (unit === "s" || unit.startsWith("sec")) return 1000;
  if (unit === "m" || unit.startsWith("min")) return 60_000;
  if (unit === "h" || unit.startsWith("hour") || unit.startsWith("hr")) return 3_600_000;
  if (unit === "d" || unit.startsWith("day")) return 86_400_000;
  if (unit === "w" || unit.startsWith("week")) return 7 * 86_400_000;
  if (unit === "mo" || unit.startsWith("month")) return 30 * 86_400_000;
  return 3_600_000;
}

function weekdayOffset(raw: string, now: Date, tz: string): Date | undefined {
  const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const stripped = raw.replace(/^last\s+/, "");
  const idx = names.indexOf(stripped);
  if (idx < 0) return undefined;
  const start = startOfDay(now, tz);
  const current = tzWeekday(start, tz);
  let delta = (current - idx + 7) % 7;
  if (delta === 0) delta = 7;
  return new Date(start.getTime() - delta * 86_400_000);
}

function tzWeekday(date: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

export function startOfDay(now: Date, tz: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0);
  const asNow = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  const offset = asNow - now.getTime();
  return new Date(asUtc - offset);
}

export function formatClock(tsSeconds: number, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(tsSeconds * 1000));
}

export function formatDay(tsSeconds: number, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(tsSeconds * 1000));
}
