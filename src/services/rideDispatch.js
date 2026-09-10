import { BACKEND_URL } from '../config';

// Compatibility helper for legacy screens. Driver dispatch is authoritative on
// the unified backend. This helper only asks the backend to retry its search;
// it never contains driver-selection or ride-assignment logic of its own.
const retryTimers = new Map();
const MAX_RETRIES = 24;
const RETRY_DELAY_MS = 7000;

function clearRetry(rideId) {
  const key = String(rideId || '');
  const timer = retryTimers.get(key);
  if (timer) clearTimeout(timer);
  retryTimers.delete(key);
}

function scheduleRetry(rideId, token, attempt) {
  const key = String(rideId || '');
  if (!key || !token || attempt >= MAX_RETRIES || retryTimers.has(key)) return;
  const timer = setTimeout(async () => {
    retryTimers.delete(key);
    const result = await dispatchRideSearch(rideId, token, attempt + 1);
    if (result?.alreadyHandled || result?.driversNotified > 0) clearRetry(key);
  }, RETRY_DELAY_MS);
  retryTimers.set(key, timer);
}

export async function dispatchRideSearch(rideId, token, attempt = 0) {
  if (!rideId || !token) return { ok: false, reason: 'missing-ride-or-token' };
  try {
    const response = await fetch(`${BACKEND_URL}/api/rides/${encodeURIComponent(rideId)}/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 409 && data?.ride?.status !== 'SEARCHING') {
        clearRetry(rideId);
        return { ok: true, alreadyHandled: true, data };
      }
      if (attempt < MAX_RETRIES - 1) scheduleRetry(rideId, token, attempt);
      return { ok: false, data, error: new Error(data?.error || `Busca de motorista falhou (${response.status})`) };
    }

    const driversNotified = Number(data?.driversNotified || 0);
    if (driversNotified > 0 || attempt >= MAX_RETRIES - 1) clearRetry(rideId);
    else scheduleRetry(rideId, token, attempt);

    return { ok: true, data, driversNotified };
  } catch (error) {
    if (attempt < MAX_RETRIES - 1) scheduleRetry(rideId, token, attempt);
    return { ok: false, error };
  }
}

export function cancelRideSearchRetry(rideId) {
  clearRetry(rideId);
}
