import { BACKEND_URL } from '../config';

// Production sync marker: this branch is the Vercel production branch.
// The Vercel function writes Firebase driver notifications before returning.
const RETRY_DELAYS_MS = [1500, 4000, 6000, 8000, 10000, 10000, 10000, 10000];

export async function dispatchRideSearch(rideId, token) {
  if (!rideId || !token) {
    return { ok: false, reason: 'missing-ride-or-token' };
  }

  let lastError = null;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const waitMs = RETRY_DELAYS_MS[attempt];
    if (waitMs > 0) await new Promise((resolve) => window.setTimeout(resolve, waitMs));

    try {
      const response = await fetch(`${BACKEND_URL}/api/ride-search-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rideId }),
        cache: 'no-store',
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 409) {
        const message = String(data?.error || '');
        if (/não está disponível|não está mais procurando|já foi aceita|não está disponível para busca/i.test(message)) {
          return { ok: true, data, alreadyHandled: true };
        }
      }

      if (!response.ok) {
        lastError = new Error(data?.error || `Busca de motorista falhou (${response.status})`);
        continue;
      }

      return { ok: true, data, driversNotified: Number(data?.driversNotified || 0) };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    error: lastError || new Error('Não foi possível iniciar a busca de motorista.'),
    exhausted: true,
  };
}
