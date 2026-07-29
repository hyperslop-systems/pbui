/** Format a number compactly for dense component labels. */
export function formatShortNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(absolute >= 10_000_000 ? 0 : 1)}M`;
  }
  if (absolute >= 1_000) {
    return `${(value / 1_000).toFixed(absolute >= 10_000 ? 0 : 1)}k`;
  }
  return String(Math.round(value));
}

/** Format a fraction as a whole percentage. */
export function formatPercent(fraction: number): string {
  return Number.isFinite(fraction) ? `${Math.round(fraction * 100)}%` : "—";
}

/** Format bytes using compact binary-scaled units. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** Format milliseconds for compact component labels. */
export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) return "—";
  if (milliseconds >= 3_600_000) return `${(milliseconds / 3_600_000).toFixed(1)}h`;
  if (milliseconds >= 60_000) return `${Math.round(milliseconds / 60_000)}m`;
  if (milliseconds >= 1_000) return `${(milliseconds / 1_000).toFixed(1)}s`;
  return `${Math.round(milliseconds)}ms`;
}
