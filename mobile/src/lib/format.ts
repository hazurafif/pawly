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
