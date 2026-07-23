// Shared date helpers for time off requests.

// Counts weekdays (Mon–Fri) between two YYYY-MM-DD dates, inclusive of
// both endpoints. The crew works Monday through Friday, so a request that
// spans a weekend shouldn't count Saturday/Sunday as requested days off —
// e.g. Fri Aug 21 through Mon Aug 24 is 2 work days, not 4 calendar days.
export function countWeekdays(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  if (end < start) return 0;

  let count = 0;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}
