// Pure month-grid math for the Journal calendar view — no React imports,
// unit-tested. All dates are UTC instants; the calendar is rendered from
// UTC day keys (same key space as dayKeyOfIso in format.ts).

export interface MonthPosition {
  year: number;
  /** 0-11 */
  month: number;
}

// Cells for one month: leading/trailing nulls pad the grid to full weeks
// (Sunday-first), so the array length is always a multiple of 7.
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(Date.UTC(year, month, d)));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

// YYYY-MM-DD key for a cell date — matches dayKeyOfIso event keys.
export function cellDayKey(date: Date): string {
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${m}-${d}`;
}

export function addMonths(pos: MonthPosition, delta: number): MonthPosition {
  const total = pos.year * 12 + pos.month + delta;
  return { year: Math.floor(total / 12), month: total % 12 };
}

export function todayPosition(): MonthPosition {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}
