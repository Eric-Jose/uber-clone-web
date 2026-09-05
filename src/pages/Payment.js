import React, { useState } from 'react';
import '../styles/Payment.css';

const FIXED_RIDE_PRICE = 17;

function Payment({ rideId, onPaymentSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const total = FIXED_RIDE_PRICE;

  const handlePayment = async (e) => {
    e?.preventDefault();
    setMessage('');
    setLoading(true);
    // O app ainda não possui um provedor de pagamentos conectado.
    // Não coletamos nem enviamos número de cartão, CVV ou validade.
    setTimeout(() => {
      setLoading(false);
      setMessage('Pagamento real ainda não está conectado. Nenhuma cobrança foi realizada.');
      if (typeof onPaymentSuccess === 'function') onPaymentSuccess({ pending: true, rideId, amount: total, paymentMethod });
    }, 500);
  };

  return (
    <div className="payment-container">
      <div className="payment-card">
        <div className="payment-header">
          <h2>💳 Pagamento da corrida</h2>
          <p>Corrida: {rideId || '—'}</p>
        </div>

        <div className="price-section">
          <div className="price-breakdown">
            <div className="price-item total"><span>Preço fixo:</span><span>R$ {total.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="payment-methods">
          <h3>Escolha o método</h3>
          <div className="methods-grid">
            {[
              ['pix', '🔲 PIX'],
              ['card', '💳 Cartão'],
              ['wallet', '👛 Carteira']
            ].map(([value, label]) => (
              <label key={value} className={`method-option ${paymentMethod === value ? 'active' : ''}`}>
                <input type="radio" name="paymentMethod" value={value} checked={paymentMethod === value} onChange={(e) => setPaymentMethod(e.target.value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="payment-info">
          {paymentMethod === 'pix' && <>
            <p>🔒 O PIX será integrado a um provedor de pagamento seguro.</p>
            <p>Nenhum QR Code falso será exibido e nenhuma cobrança será simulada.</p>
          </>}
          {paymentMethod === 'card' && <>
            <p>🔒 Pagamento com cartão será feito por checkout/tokenização de um provedor.</p>
            <p>Por segurança, este aplicativo não coleta número do cartão ou CVV diretamente.</p>
          </>}
          {paymentMethod === 'wallet' && <>
            <p>👛 A carteira digital será habilitada quando o sistema financeiro for conectado.</p>
            <p>O saldo exibido anteriormente era apenas demonstrativo.</p>
          </>}
          {message && <div className="error-message" role="status">{message}</div>}
          <button className="btn-pay" onClick={handlePayment} disabled={loading}>
            {loading ? '⏳ Verificando...' : 'Continuar pagamento • R$ 17,00'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Payment;
