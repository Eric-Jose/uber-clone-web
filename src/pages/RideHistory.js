import React, { useEffect, useMemo, useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function RideHistory({ user, onBack }) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async (showLoading = false) => {
      try {
        if (showLoading) setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Sessão não encontrada.');
        const response = await fetch(`${BACKEND_URL}/api/rides/history?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o histórico.');
        if (!cancelled) setRides(Array.isArray(data.rides) ? data.rides : []);
      } catch (err) {
        if (!cancelled && showLoading) setError(err.message || 'Erro ao carregar histórico.');
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    };

    loadHistory(true);
    const interval = window.setInterval(() => loadHistory(false), 5000);
    const handleFocus = () => loadHistory(false);
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadHistory(false); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const stats = useMemo(() => ({
    completed: rides.filter(r => r.status === 'COMPLETED').length,
    cancelled: rides.filter(r => r.status === 'CANCELLED').length,
    total: rides.reduce((sum, r) => sum + (Number(r.price) || 0), 0),
    distance: rides.reduce((sum, r) => sum + (Number(r.distance) || 0), 0),
    ongoing: rides.filter(r => ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)).length
  }), [rides]);

  const formatDate = (value) => {
    if (!value) return 'Data não informada';
    return new Date(Number(value)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const statusLabel = { SEARCHING: 'Procurando motorista', ACCEPTED: 'Aceita', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluída', CANCELLED: 'Cancelada' };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: 20, boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button onClick={onBack} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '8px 0', fontSize: 16 }}>← Voltar</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div><h1 style={{ marginBottom: 6 }}>📋 Histórico de corridas</h1><p style={{ color: '#666', marginTop: 0 }}>{user?.userType === 'driver' ? 'Suas corridas como motorista' : 'Suas corridas como passageiro'}</p></div>
          <span style={{ color: '#666', fontSize: 12 }}>{loading ? 'Atualizando…' : '● Atualizado automaticamente'}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, margin: '20px 0' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}><strong>{rides.length}</strong><div>Total</div></div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}><strong>{stats.completed}</strong><div>Concluídas</div></div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}><strong>{stats.cancelled}</strong><div>Canceladas</div></div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}><strong>{stats.ongoing}</strong><div>Em andamento</div></div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}><strong>R$ {stats.total.toFixed(2).replace('.', ',')}</strong><div>Valor das corridas</div></div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}><strong>{stats.distance.toFixed(1)} km</strong><div>Distância</div></div>
        </div>

        {error && <div style={{ background: '#fff3f3', color: '#a00', borderRadius: 12, padding: 16, marginBottom: 12 }}>{error}</div>}
        {!loading && !error && rides.length === 0 && <div style={{ background: '#fff', borderRadius: 12, padding: 24 }}>Você ainda não possui corridas no histórico.</div>}

        <div style={{ display: 'grid', gap: 12 }}>
          {rides.map((ride) => (
            <div key={ride.id} style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{statusLabel[ride.status] || ride.status}</strong>
                <span>{formatDate(ride.updatedAt || ride.createdAt)}</span>
              </div>
              <div style={{ marginTop: 12 }}><b>📍 Origem:</b> {ride.origin?.address || ride.origin?.formattedAddress || ride.origin?.lat ? JSON.stringify(ride.origin) : String(ride.origin || 'Não informada')}</div>
              <div style={{ marginTop: 6 }}><b>🏁 Destino:</b> {ride.destination?.address || ride.destination?.formattedAddress || ride.destination?.lat ? JSON.stringify(ride.destination) : String(ride.destination || 'Não informado')}</div>
              <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap', color: '#555' }}>
                <span>💰 R$ {(Number(ride.price) || 0).toFixed(2).replace('.', ',')}</span>
                <span>📏 {Number(ride.distance || 0).toFixed(1)} km</span>
                {ride.cancellationReason && <span>Motivo: {ride.cancellationReason}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RideHistory;
