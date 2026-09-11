/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from 'react';
import { BACKEND_URL } from '../config';

function LiveStatsBar() {
  const [, setStats] = useState({ total: 0, completed: 0, cancelled: 0, ongoing: 0, distance: 0, rating: 5.0 });

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/rides/history?limit=100`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
        });
        if (!response.ok) return;
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        const rides = Array.isArray(data.rides) ? data.rides : [];
        setStats({
          total: rides.length,
          completed: rides.filter(r => r.status === 'COMPLETED').length,
          cancelled: rides.filter(r => r.status === 'CANCELLED').length,
          ongoing: rides.filter(r => ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)).length,
          distance: rides.reduce((sum, r) => sum + (Number(r.distance) || 0), 0),
          rating: Number(data.user?.rating ?? 5.0) || 5.0
        });
      } catch (_) {}
    };
    loadStats();
    const interval = window.setInterval(loadStats, 5000);
    const handleFocus = () => loadStats();
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadStats(); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Mantém a atualização em segundo plano, mas remove a faixa visual.
  return null;
}

export default LiveStatsBar;
