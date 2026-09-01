import React, { useState } from 'react';
import '../styles/Promotions.css';

function Promotions({ userId, onApplyCode }) {
  const [promos, setPromos] = useState([
    {
      id: 1,
      code: 'VERÃO20',
      description: 'Ganhe 20% de desconto em suas próximas 5 corridas',
      discount: 20,
      type: 'percentage',
      expiresIn: '7 dias',
      icon: '🌞',
      used: false
    },
    {
      id: 2,
      code: 'NOVO50',
      description: 'R$ 50 de desconto em sua primeira corrida',
      discount: 50,
      type: 'fixed',
      expiresIn: '30 dias',
      icon: '🎁',
      used: false
    },
    {
      id: 3,
      code: 'AMIGOS10',
      description: 'Indique amigos e ganhe R$ 10 de crédito',
      discount: 10,
      type: 'referral',
      expiresIn: 'Ilimitado',
      icon: '👥',
      used: false
    }
  ]);

  const [appliedCode, setAppliedCode] = useState(null);
  const [couponInput, setCouponInput] = useState('');

  const handleApplyPromo = (promo) => {
    if (promo.used) {
      alert('Este cupom já foi utilizado!');
      return;
    }

    setAppliedCode(promo);
    onApplyCode(promo);
    alert(`✅ Cupom ${promo.code} aplicado com sucesso!`);
  };

  const handleApplyCustomCode = () => {
    if (!couponInput.trim()) {
      alert('Digite um código!');
      return;
    }

    const found = promos.find(p => p.code === couponInput.toUpperCase());
    if (found) {
      handleApplyPromo(found);
      setCouponInput('');
    } else {
      alert('Código inválido!');
    }
  };

  return (
    <div className="promotions-container">
      <h2>🎉 Promoções e Cupons</h2>
      <p className="subtitle">Economize em suas corridas</p>

      {/* Entrada de cupom customizado */}
      <div className="coupon-input-section">
        <h3>Tem um cupom?</h3>
        <div className="input-group">
          <input
            type="text"
            placeholder="Digite seu código aqui"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && handleApplyCustomCode()}
          />
          <button onClick={handleApplyCustomCode} className="btn-apply">
            ✓ Aplicar
          </button>
        </div>
      </div>

      {/* Cupom aplicado */}
      {appliedCode && (
        <div className="applied-banner">
          <span className="banner-icon">{appliedCode.icon}</span>
          <div className="banner-text">
            <strong>{appliedCode.code}</strong>
            <p>Desconto de {appliedCode.discount}{appliedCode.type === 'percentage' ? '%' : ' reais'} aplicado!</p>
          </div>
        </div>
      )}

      {/* Lista de promoções */}
      <div className="promos-list">
        {promos.map(promo => (
          <div
            key={promo.id}
            className={`promo-card ${promo.used ? 'used' : ''} ${appliedCode?.id === promo.id ? 'applied' : ''}`}
          >
            <div className="promo-icon">{promo.icon}</div>
            <div className="promo-content">
              <div className="promo-header">
                <h4>{promo.code}</h4>
                <span className="discount-badge">
                  {promo.type === 'percentage' && `${promo.discount}%`}
                  {promo.type === 'fixed' && `R$ ${promo.discount}`}
                  {promo.type === 'referral' && '🔗'}
                </span>
              </div>
              <p className="promo-description">{promo.description}</p>
              <span className="expires">⏰ Expira em: {promo.expiresIn}</span>
            </div>
            <button
              className={`btn-use ${appliedCode?.id === promo.id ? 'applied' : ''}`}
              onClick={() => handleApplyPromo(promo)}
              disabled={promo.used}
            >
              {appliedCode?.id === promo.id ? '✓ Aplicado' : 'Usar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Promotions;
