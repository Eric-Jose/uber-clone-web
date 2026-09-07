import React, { useEffect, useMemo, useState } from 'react';
import { BACKEND_URL as B } from '../config';
import '../styles/PrecoFixo17Reference.css';

export default function RideHistoryPro({ user, onBack }) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'DONE' | 'CANCELLED'

  const load = () => {
    const t = localStorage.getItem('token');
    if (!t) {
      setRides([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${B}/api/rides/history?limit=50`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: 'no-store'
    })
      .then((r) => {
        if (!r.ok) throw new Error('history');
        return r.json();
      })
      .then((d) => {
        setRides(Array.isArray(d.rides) ? d.rides : []);
      })
      .catch(() => {
        setRides([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleClearHistory = () => {
    if (window.confirm('Deseja limpar a visualização do histórico?')) {
      setRides([]);
    }
  };

  const isDone = (s) => ['COMPLETED', 'completed', 'CONCLUIDA', 'concluida'].includes(s);
  const isCancelled = (s) => ['CANCELLED', 'cancelled', 'CANCELED', 'canceled', 'CANCELADA', 'cancelada'].includes(s);

  const doneRides = rides.filter((r) => isDone(r.status));
  const cancelledRides = rides.filter((r) => isCancelled(r.status));

  const visibleRides = useMemo(() => {
    if (filter === 'DONE') return doneRides;
    if (filter === 'CANCELLED') return cancelledRides;
    return rides;
  }, [filter, rides, doneRides, cancelledRides]);

  return (
    <div className="pf-history-screen">
      <style>{`
        .pf-history-screen {
          min-height: 100vh;
          background: #050505;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .pf-hist-topbar {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          border-bottom: 1px solid #1c2128;
          position: sticky;
          top: 0;
          background: rgba(5, 5, 5, 0.95);
          backdrop-filter: blur(10px);
          z-index: 10;
        }
        .pf-hist-btn {
          background: transparent;
          border: none;
          color: #ffffff;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .pf-hist-btn:hover { background: #161b22; }
        .pf-hist-title {
          font-size: 17px;
          font-weight: 700;
          color: #ffffff;
        }
        .pf-hist-body {
          flex: 1;
          max-width: 500px;
          width: 100%;
          margin: 0 auto;
          padding: 20px 16px 40px;
          display: flex;
          flex-direction: column;
        }
        .pf-hist-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .pf-hist-tab {
          flex: 1;
          padding: 10px 16px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 700;
          border: 1px solid #242a34;
          background: #0f1216;
          color: #8e98a5;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s ease;
        }
        .pf-hist-tab.active {
          background: #ff5a00;
          border-color: #ff5a00;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(255, 90, 0, 0.3);
        }
        .pf-hist-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .pf-hist-card {
          background: #0f1216;
          border: 1px solid #222832;
          border-radius: 18px;
          padding: 16px;
          transition: border-color 0.15s ease;
        }
        .pf-hist-card:hover { border-color: #353e4f; }
        .pf-hist-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px solid #1a2029;
          margin-bottom: 12px;
        }
        .pf-hist-date { font-size: 13px; color: #8e98a5; font-weight: 500; }
        .pf-hist-badge { font-size: 12px; font-weight: 800; padding: 3px 10px; border-radius: 999px; }
        .pf-hist-badge.completed { background: rgba(34, 197, 94, 0.12); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.25); }
        .pf-hist-badge.cancelled { background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); }
        .pf-hist-route { position: relative; padding-left: 24px; margin-bottom: 14px; }
        .pf-hist-route::before { content: ""; position: absolute; left: 7px; top: 8px; bottom: 10px; width: 2px; background: #2a3240; }
        .pf-hist-point { position: relative; font-size: 14px; color: #e5e7eb; margin-bottom: 10px; line-height: 1.35; }
        .pf-hist-point:last-child { margin-bottom: 0; }
        .pf-hist-point::before { content: ""; position: absolute; left: -24px; top: 4px; width: 10px; height: 10px; border-radius: 50%; }
        .pf-hist-point.orig::before { background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2); }
        .pf-hist-point.dest::before { background: #ff5a00; box-shadow: 0 0 0 3px rgba(255, 90, 0, 0.2); }
        .pf-hist-card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid #1a2029; font-size: 13px; }
        .pf-hist-dist { color: #8e98a5; }
        .pf-hist-price { font-size: 16px; font-weight: 800; color: #ffffff; }
        .pf-hist-more-btn { margin-top: 20px; background: #12151b; border: 1px solid #242b36; color: #ffffff; font-size: 14px; font-weight: 700; padding: 13px; border-radius: 999px; cursor: pointer; transition: background 0.15s ease; width: 100%; }
        .pf-hist-more-btn:hover { background: #181c24; }
        .pf-hist-empty { text-align: center; padding: 48px 16px; color: #8e98a5; background: #0f1216; border: 1px dashed #242a34; border-radius: 18px; }
      `}</style>

      <header className="pf-hist-topbar">
        <button type="button" className="pf-hist-btn" onClick={() => onBack?.()} aria-label="Voltar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="pf-hist-title">Minhas corridas</span>
        <button type="button" className="pf-hist-btn" onClick={handleClearHistory} aria-label="Limpar histórico">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e98a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        </button>
      </header>

      <main className="pf-hist-body">
        <div className="pf-hist-tabs">
          <button type="button" className={`pf-hist-tab ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>Todas</button>
          <button type="button" className={`pf-hist-tab ${filter === 'DONE' ? 'active' : ''}`} onClick={() => setFilter('DONE')}>Concluídas</button>
          <button type="button" className={`pf-hist-tab ${filter === 'CANCELLED' ? 'active' : ''}`} onClick={() => setFilter('CANCELLED')}>Canceladas</button>
        </div>

        <div className="pf-hist-list">
          {loading && !rides.length ? (
            <div className="pf-hist-empty">Carregando corridas…</div>
          ) : !visibleRides.length ? (
            <div className="pf-hist-empty">Nenhuma corrida encontrada.</div>
          ) : (
            visibleRides.map((ride) => {
              const done = isDone(ride.status);
              const formattedDate = ride.dateStr || (ride.createdAt ? new Date(Number(ride.createdAt)).toLocaleString('pt-BR') : 'Data não disponível');
              return (
                <article key={ride.id} className="pf-hist-card">
                  <div className="pf-hist-card-head"><span className="pf-hist-date">{formattedDate}</span><span className={`pf-hist-badge ${done ? 'completed' : 'cancelled'}`}>{done ? 'Concluída' : 'Cancelada'}</span></div>
                  <div className="pf-hist-route">
                    <div className="pf-hist-point orig">{ride.origin?.address || ride.origin?.formattedAddress || 'Origem não informada'}</div>
                    <div className="pf-hist-point dest">{ride.destination?.address || ride.destination?.formattedAddress || 'Destino não informado'}</div>
                  </div>
                  <div className="pf-hist-card-footer"><span className="pf-hist-dist">{Number(ride.distance || 0).toFixed(1).replace('.', ',')} km</span><span className="pf-hist-price">R$ {Number(ride.price || 17).toFixed(2).replace('.', ',')}</span></div>
                </article>
              );
            })
          )}
        </div>

        <button type="button" className="pf-hist-more-btn" onClick={() => load()}>Atualizar histórico</button>
      </main>
    </div>
  );
}
