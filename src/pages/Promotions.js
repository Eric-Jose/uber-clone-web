import React, { useEffect, useState } from 'react';
import { BACKEND_URL } from '../config';
import '../styles/Promotions.css';

function Promotions({ userId, onApplyCode }) {
  const storageKey = `pf17_promo_${userId || 'guest'}`;
  const [promos, setPromos] = useState([]);
  const [appliedCode, setAppliedCode] = useState(null);
  const [couponInput, setCouponInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return undefined;
    }

    const loadPromotions = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/promotions`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as promoções.');
        const availablePromos = Array.isArray(data.promotions) ? data.promotions : [];
        if (cancelled) return;
        setPromos(availablePromos);

        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
          const current = availablePromos.find((promo) => promo.code === saved?.code);
          if (current) setAppliedCode(current);
          else localStorage.removeItem(storageKey);
        } catch (_) {
          localStorage.removeItem(storageKey);
        }
      } catch (loadError) {
        if (!cancelled) setFeedback({ type: 'error', text: loadError.message || 'Não foi possível carregar as promoções.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPromotions();
    return () => { cancelled = true; };
  }, [storageKey]);

  const handleApplyPromo = (promo) => {
    if (!promo || promo.used) {
      setFeedback({ type: 'error', text: 'Este cupom não pode ser utilizado.' });
      return;
    }
    setAppliedCode(promo);
    try { localStorage.setItem(storageKey, JSON.stringify(promo)); } catch (_) {}
    if (typeof onApplyCode === 'function') onApplyCode(promo);
    setFeedback({ type: 'success', text: `Cupom ${promo.code} aplicado com sucesso!` });
  };

  const handleApplyCustomCode = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return setFeedback({ type: 'error', text: 'Digite um código válido.' });
    const found = promos.find((promo) => promo.code === code);
    if (!found) return setFeedback({ type: 'error', text: 'Código de cupom inválido ou expirado.' });
    handleApplyPromo(found);
    setCouponInput('');
  };

  return (
    <div className="promotions-container">
      <h2>🎉 Promoções e Cupons</h2>
      <p className="subtitle">Ofertas disponíveis para sua conta</p>
      {feedback && <div style={{ background: feedback.type === 'success' ? '#143820' : '#381414', border: `1px solid ${feedback.type === 'success' ? '#22c55e' : '#ef4444'}`, color:'#fff', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:14, fontWeight:600, display:'flex', justifyContent:'space-between', alignItems:'center' }}><span>{feedback.type === 'success' ? '✅' : '⚠️'} {feedback.text}</span><button type="button" onClick={() => setFeedback(null)} style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:16 }}>×</button></div>}
      <div className="coupon-input-section"><h3>Tem um cupom?</h3><div className="input-group"><input type="text" placeholder="Digite seu código aqui" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') handleApplyCustomCode(); }} /><button type="button" onClick={handleApplyCustomCode} className="btn-apply" disabled={loading}>✓ Aplicar</button></div></div>
      {appliedCode && <div className="applied-banner"><span className="banner-icon">{appliedCode.icon}</span><div className="banner-text"><strong>{appliedCode.code}</strong><p>Desconto de {appliedCode.discount}{appliedCode.type === 'percentage' ? '%' : ' reais'} aplicado!</p></div></div>}
      {loading ? <div className="empty-state"><p>Carregando promoções...</p></div> : promos.length === 0 ? <div className="empty-state"><p>Nenhuma promoção disponível no momento.</p></div> : <div className="promos-list">{promos.map((promo) => <div key={promo.id} className={`promo-card ${promo.used ? 'used' : ''} ${appliedCode?.id === promo.id ? 'applied' : ''}`}><div className="promo-icon">{promo.icon}</div><div className="promo-content"><div className="promo-header"><h4>{promo.code}</h4><span className="discount-badge">{promo.type === 'percentage' && `${promo.discount}%`}{promo.type === 'fixed' && `R$ ${promo.discount}`}{promo.type === 'referral' && '🔗'}</span></div><p className="promo-description">{promo.description}</p>{promo.expiresIn && <span className="expires">⏰ Expira em: {promo.expiresIn}</span>}</div><button type="button" className={`btn-use ${appliedCode?.id === promo.id ? 'applied' : ''}`} onClick={() => handleApplyPromo(promo)} disabled={promo.used}>{appliedCode?.id === promo.id ? '✓ Aplicado' : 'Usar'}</button></div>)}</div>}
    </div>
  );
}

export default Promotions;
