import React, { useEffect, useState } from 'react';
import WebSocketService from '../services/WebSocketService';
import { BACKEND_URL } from '../config';

export default function RideRatingPanel({ account }) {
  const [ride, setRide] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onEnded = (payload) => {
      const ended = payload?.ride || payload;
      if (!ended?.id || ended.status !== 'COMPLETED') return;
      const uid = account?.uid;
      const isParticipant = uid && (String(ended.userId) === String(uid) || String(ended.driverId) === String(uid));
      if (!isParticipant) return;
      setRide(ended);
      setRating(0);
      setComment('');
      setSent(false);
      setError('');
    };
    WebSocketService.onRideEnded(onEnded);
    return () => WebSocketService.off('ride-ended', onEnded);
  }, [account?.uid]);

  if (!ride || sent) return null;

  const submit = async () => {
    if (!rating || sending) return;
    const token = localStorage.getItem('token');
    if (!token) return setError('Sua sessão expirou. Entre novamente para avaliar.');
    setSending(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rideId: ride.id, rating, comment: comment.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.details || 'Não foi possível enviar a avaliação.');
      setSent(true);
    } catch (e) {
      setError(e.message || 'Não foi possível enviar a avaliação.');
    } finally {
      setSending(false);
    }
  };

  return <div className="ride-rating-overlay" role="dialog" aria-modal="true" aria-label="Avaliar corrida">
    <style>{`.ride-rating-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.48);display:flex;align-items:flex-end;justify-content:center;padding:18px}.ride-rating-card{width:min(520px,100%);background:#fff;border-radius:22px;padding:22px;box-shadow:0 16px 50px rgba(0,0,0,.25);font-family:Arial,sans-serif}.ride-rating-stars{display:flex;gap:6px;margin:18px 0}.ride-rating-star{border:0;background:#f1f3f5;border-radius:12px;font-size:30px;width:54px;height:54px;cursor:pointer}.ride-rating-star.active{background:#fff1a8}.ride-rating-input{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:12px;padding:12px;resize:vertical;font:inherit}.ride-rating-submit{width:100%;border:0;border-radius:13px;padding:14px;background:#111;color:#fff;font-weight:800;margin-top:12px;cursor:pointer}.ride-rating-submit:disabled{opacity:.55}.ride-rating-error{margin-top:10px;background:#fff0f0;color:#9b1c1c;padding:10px;border-radius:10px;font-size:14px}`}</style>
    <div className="ride-rating-card">
      <h2 style={{ margin: 0 }}>⭐ Como foi sua corrida?</h2>
      <p style={{ color: '#68707a', marginBottom: 0 }}>{account?.userType === 'driver' ? 'Avalie o passageiro.' : 'Avalie seu motorista.'}</p>
      <div className="ride-rating-stars">
        {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={`ride-rating-star ${value <= rating ? 'active' : ''}`} onClick={() => setRating(value)} aria-label={`${value} estrelas`}>★</button>)}
      </div>
      <textarea className="ride-rating-input" rows="3" value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))} placeholder="Comentário opcional" />
      {error && <div className="ride-rating-error">{error}</div>}
      <button type="button" className="ride-rating-submit" disabled={!rating || sending} onClick={submit}>{sending ? 'Enviando…' : 'Enviar avaliação'}</button>
    </div>
  </div>;
}
