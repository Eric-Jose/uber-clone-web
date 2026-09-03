import React, { useEffect, useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function LiveStatsBar({ userType = 'passenger' }) {
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0, ongoing: 0, distance: 0, rating: 5.0 });

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

  return (
    <div aria-hidden="true" style={{
      position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5000,
      width: 'min(760px, calc(100% - 20px))', background: 'rgba(255,255,255,.96)',
      border: '1px solid #ddd', borderRadius: 14, boxShadow: '0 4px 18px rgba(0,0,0,.12)',
      padding: '10px 12px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      pointerEvents: 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <strong>{userType === 'driver' ? '🚗 Minhas estatísticas' : '🚖 Minhas estatísticas'}</strong>
        <span style={{ fontSize: 11, color: '#666' }}>● Atualização automática</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(70px, 1fr))', gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 12 }}><b>{stats.total}</b> corridas</span>
        <span style={{ fontSize: 12 }}><b>{stats.completed}</b> concluídas</span>
        <span style={{ fontSize: 12 }}><b>{stats.cancelled}</b> canceladas</span>
        <span style={{ fontSize: 12 }}><b>{stats.ongoing}</b> ativas</span>
        <span style={{ fontSize: 12 }}><b>{stats.distance.toFixed(1)} km</b></span>
        <span style={{ fontSize: 12 }}><b>⭐ {stats.rating.toFixed(1)}</b></span>
      </div>
    </div>
  );
}

export default LiveStatsBar;
