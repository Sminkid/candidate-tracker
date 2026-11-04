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
