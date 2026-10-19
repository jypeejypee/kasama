import { fmtTime } from './time';

// Errors whose message is already written for the person, so screens show them as they are

// No signal, no data, or the server took too long
export class OfflineError extends Error {
  constructor() {
    super("Mukhang offline ka ngayon. Your tasks and reminders still work. Talk to me again when you're back online.");
  }
}

// Today's talks with Claude are used up. The limit resets at midnight UTC (8 AM in Manila).
export class LimitError extends Error {
  constructor() {
    const reset = new Date();
    reset.setUTCHours(24, 0, 0, 0);
    super(`Ang dami na nating napag-usapan ngayon. Pahinga muna ako sa chat. Balik tayo after ${fmtTime(reset.toISOString())}, okay lang ba? Your tasks and reminders still work.`);
  }
}

const TIMEOUT_MS = 60_000;

// fetch, but a request that never reaches the server (or hangs) becomes an OfflineError
export async function reach(url: string, init: RequestInit): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: abort.signal });
  } catch {
    throw new OfflineError();
  } finally {
    clearTimeout(timer);
  }
}
