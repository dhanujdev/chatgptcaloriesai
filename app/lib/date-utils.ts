export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeDate(date?: string): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return todayDate();
}

export function shiftDate(isoDate: string, delta: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function formatDate(isoDate: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}
