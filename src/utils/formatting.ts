export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRemaining(nowMs: number, validUntilMs: number): string {
  const remainingMs = validUntilMs - nowMs;
  if (remainingMs <= 0) {
    return "Expired";
  }

  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m remaining`;
  }

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return `${days}d ${restHours}h remaining`;
  }

  return `${hours}h ${minutes}m remaining`;
}

export function normalizedNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const match = String(value)
    .replace(",", ".")
    .match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  return Number(match[0]);
}
