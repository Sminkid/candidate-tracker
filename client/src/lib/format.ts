// Dates use one fixed locale so every user (and every test machine) sees the same format.
const LOCALE = "en-AU";

// "3 Nov" for this year, "3 Nov 2025" for older dates, so old candidates are not mistaken for new ones.
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).format(date);
}

// "3 Nov 2026": the full date, for a candidate's detail page.
export function formatFullDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone }).format(
    new Date(iso),
  );
}

// "3 Nov, 3:10 pm": when a note was written.
// timeZone is only passed by tests; the app uses the browser's own time zone.
export function formatDateTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}
