import { BACKEND_URL } from '../config';

const SEARCH_DELAY_MS = 1500;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 4000, 9000];

export async function dispatchRideSearch(rideId, token) {
  if (!rideId || !token) return { ok: false, reason: 'missing-ride-or-token' };

  let lastError = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const waitMs = attempt === 0 ? SEARCH_DELAY_MS : RETRY_DELAYS_MS[attempt] || 9000;
    if (waitMs > 0) await new Promise((resolve) => window.setTimeout(resolve, waitMs));

    try {
      const response = await fetch(`${BACKEND_URL}/api/rides/${encodeURIComponent(rideId)}/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok || response.status === 202) return { ok: true, data };
      if (response.status === 409 && /não está mais procurando|já foi aceita/i.test(String(data?.error || ''))) {
        return { ok: true, data, alreadyHandled: true };
      }
      lastError = new Error(data?.error || `Busca de motorista falhou (${response.status})`);
    } catch (error) {
      lastError = error;
    }
  }

  return { ok: false, error: lastError };
}
