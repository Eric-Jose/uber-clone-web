import { BACKEND_URL } from '../config';

// Compatibility helper for legacy screens. Driver dispatch is authoritative on
// the unified backend; this endpoint only asks it to retry the search.
export async function dispatchRideSearch(rideId, token) {
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
        return { ok: true, alreadyHandled: true, data };
      }
      return { ok: false, data, error: new Error(data?.error || `Busca de motorista falhou (${response.status})`) };
    }
    return { ok: true, data, driversNotified: Number(data?.driversNotified || 0) };
  } catch (error) {
    return { ok: false, error };
  }
}
