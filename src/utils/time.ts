export function formatSeconds(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const m = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const s = (clamped % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
