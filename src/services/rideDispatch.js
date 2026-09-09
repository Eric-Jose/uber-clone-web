import { BACKEND_URL } from '../config';

const RETRY_DELAYS_MS = [1500, 4000, 6000, 8000, 8000, 10000, 10000, 10000];

export async function dispatchRideSearch(rideId, token) {
  if (!rideId || !token) return { ok: false, reason: 'missing-ride-or-token' };

  let lastError = null;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const waitMs = RETRY_DELAYS_MS[attempt];
    if (waitMs > 0) await new Promise((resolve) => window.setTimeout(resolve, waitMs));

    try {
      const response = await fetch(`${BACKEND_URL}/api/rides/${encodeURIComponent(rideId)}/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 409 && /não está mais procurando|já foi aceita|já possui uma corrida/i.test(String(data?.error || ''))) {
        return { ok: true, data, alreadyHandled: true };
      }
      if (!response.ok && response.status !== 202) {
        lastError = new Error(data?.error || `Busca de motorista falhou (${response.status})`);
        continue;
      }

      // 202 means the ride is still SEARCHING. Keep retrying so a driver
      // who comes online a few seconds later can receive the request.
      if (data?.ride?.status && data.ride.status !== 'SEARCHING') {
        return { ok: true, data, alreadyHandled: true };
      }
    } catch (error) {
      lastError = error;
    }
  }

  return { ok: !lastError, error: lastError || null, exhausted: true };
}
