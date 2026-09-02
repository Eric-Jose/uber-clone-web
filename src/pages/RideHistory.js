import React, { useEffect, useMemo, useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function RideHistory({ user, onBack }) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const response = await fetch(`${BACKEND_URL}/api/rides/history?limit=50`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o histórico.');
        if (!cancelled) setRides(Array.isArray(data.rides) ? data.rides : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Erro ao carregar histórico.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadHistory();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => ({
    completed: rides.filter(r => r.status === 'COMPLETED').length,
    cancelled: rides.filter(r => r.status === 'CANCELLED').length,
    total: rides.reduce((sum, r) => sum + (Number(r.price) || 0), 0)
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
        <h1 style={{ marginBottom: 6 }}>📋 Histórico de corridas</h1>
        <p style={{ color: '#666', marginTop: 0 }}>{user?.userType === 'driver' ? 'Suas corridas como motorista' : 'Suas corridas como passageiro'}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, margin: '20px 0' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}><strong>{stats.completed}</strong><div>Concluídas</div></div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}><strong>{stats.cancelled}</strong><div>Canceladas</div></div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}><strong>R$ {stats.total.toFixed(2).replace('.', ',')}</strong><div>Valor das corridas</div></div>
        </div>

        {loading && <div style={{ background: '#fff', borderRadius: 12, padding: 24 }}>Carregando histórico...</div>}
        {error && <div style={{ background: '#fff3f3', color: '#a00', borderRadius: 12, padding: 16 }}>{error}</div>}
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
