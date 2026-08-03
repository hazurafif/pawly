// The server's canonical timestamp format: RFC3339 UTC, fixed-width
// millisecond precision. Date.toISOString() emits exactly this.
export const ISO_MS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function toIsoMs(date: Date): string {
  return date.toISOString();
}

export function parseIsoMs(value: string): Date | null {
  if (!ISO_MS_REGEX.test(value)) {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatIDR(price: number): string {
  return 'Rp' + price.toLocaleString('id-ID').replace(/,/g, '.');
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatDate(isoMs: string, locale: 'id' | 'en'): string {
  const d = parseIsoMs(isoMs);
  if (!d) {
    return isoMs;
  }
  const months = locale === 'id' ? MONTHS_ID : MONTHS_EN;
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// --- v2 helpers ---

// A day is a YYYY-MM-DD in the USER's timezone: grouping and "today"
// boundaries must follow the owner's day, not UTC.
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayKeyOfIso(isoMs: string): string | null {
  const d = parseIsoMs(isoMs);
  return d ? dayKey(d) : null;
}

export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Local-time clock, e.g. "14:32".
export function formatTime(isoMs: string): string {
  const d = parseIsoMs(isoMs);
  if (!d) {
    return isoMs;
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

// "Today" / "Yesterday" / "12 Aug 2026" — grouped timeline headers.
export function relativeDayLabel(isoMs: string, locale: 'id' | 'en'): string {
  const d = parseIsoMs(isoMs);
  if (!d) {
    return isoMs;
  }
  const today = dayKey(new Date());
  const key = dayKey(d);
  if (key === today) {
    return locale === 'id' ? 'Hari ini' : 'Today';
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKey(yesterday)) {
    return locale === 'id' ? 'Kemarin' : 'Yesterday';
  }
  return formatDate(isoMs, locale);
}

// Whole years + months from an ISO date to "now" (or a reference date).
export function ageFrom(isoMs: string | null, now: Date = new Date()): string | null {
  if (!isoMs) {
    return null;
  }
  const d = parseIsoMs(isoMs);
  if (!d || d > now) {
    return null;
  }
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    months = 0;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0 && rem > 0) {
    return `${years}y ${rem}m`;
  }
  if (years > 0) {
    return `${years}y`;
  }
  if (rem > 0) {
    return `${rem}m`;
  }
  return '0m';
}

// Weight from the event data JSON, e.g. { kg: 4.3 }.
export function weightKg(data: string | null): number | null {
  if (!data) {
    return null;
  }
  try {
    const parsed = JSON.parse(data) as { kg?: unknown };
    if (typeof parsed.kg === 'number' && Number.isFinite(parsed.kg)) {
      return parsed.kg;
    }
  } catch {
    // malformed payload — treat as absent
  }
  return null;
}
