import React, { useState, useEffect } from 'react';
import '../styles/Payment.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function Payment({ rideId, amount, onPaymentSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCardChange = (e) => {
    const { name, value } = e.target;
    setCardData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Simular chamada à API de pagamento
      const response = await fetch(`${BACKEND_URL}/api/payments/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId,
          amount,
          paymentMethod,
          cardData: paymentMethod === 'card' ? cardData : null
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao processar pagamento');
      }

      const data = await response.json();
      setLoading(false);
      
      setTimeout(() => {
        onPaymentSuccess(data);
      }, 2000);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="payment-container">
      <div className="payment-card">
        <div className="payment-header">
          <h2>💳 Pagamento da Corrida</h2>
          <p>Ride ID: {rideId}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Resumo da Corrida */}
        <div className="ride-summary">
          <div className="summary-item">
            <span className="label">📍 Origem:</span>
            <span className="value">Sua Localização</span>
          </div>
          <div className="summary-item">
            <span className="label">📍 Destino:</span>
            <span className="value">Endereço de Destino</span>
          </div>
          <div className="summary-item">
            <span className="label">⏱️ Duração:</span>
            <span className="value">15 minutos</span>
          </div>
          <div className="summary-item">
            <span className="label">📏 Distância:</span>
            <span className="value">8.5 km</span>
          </div>
        </div>

        {/* Valor Total */}
        <div className="price-section">
          <div className="price-breakdown">
            <div className="price-item">
              <span>Tarifa Base:</span>
              <span>R$ {(amount * 0.6).toFixed(2)}</span>
            </div>
            <div className="price-item">
              <span>Distância (8.5 km):</span>
              <span>R$ {(amount * 0.3).toFixed(2)}</span>
            </div>
            <div className="price-item">
              <span>Taxa de Serviço:</span>
              <span>R$ {(amount * 0.1).toFixed(2)}</span>
            </div>
            <div className="price-item total">
              <span>Total:</span>
              <span>R$ {amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Métodos de Pagamento */}
        <div className="payment-methods">
          <h3>Método de Pagamento</h3>
          <div className="methods-grid">
            <label className={`method-option ${paymentMethod === 'card' ? 'active' : ''}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                checked={paymentMethod === 'card'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>💳 Cartão de Crédito</span>
            </label>
            <label className={`method-option ${paymentMethod === 'wallet' ? 'active' : ''}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="wallet"
                checked={paymentMethod === 'wallet'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>👛 Carteira Digital</span>
            </label>
            <label className={`method-option ${paymentMethod === 'pix' ? 'active' : ''}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="pix"
                checked={paymentMethod === 'pix'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>🔲 PIX</span>
            </label>
          </div>
        </div>

        {/* Formulário de Cartão */}
        {paymentMethod === 'card' && (
          <form onSubmit={handlePayment} className="payment-form">
            <div className="form-group">
              <label>Número do Cartão</label>
              <input
                type="text"
                name="cardNumber"
                placeholder="0000 0000 0000 0000"
                maxLength="19"
                value={cardData.cardNumber}
                onChange={handleCardChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Titular do Cartão</label>
              <input
                type="text"
                name="cardName"
                placeholder="Nome completo"
                value={cardData.cardName}
                onChange={handleCardChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Validade</label>
                <input
                  type="text"
                  name="expiryDate"
                  placeholder="MM/YY"
                  maxLength="5"
                  value={cardData.expiryDate}
                  onChange={handleCardChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>CVV</label>
                <input
                  type="text"
                  name="cvv"
                  placeholder="123"
                  maxLength="3"
                  value={cardData.cvv}
                  onChange={handleCardChange}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-pay" disabled={loading}>
              {loading ? '⏳ Processando...' : `💰 Pagar R$ ${amount.toFixed(2)}`}
            </button>
          </form>
        )}

        {/* Outras formas de pagamento */}
        {paymentMethod === 'wallet' && (
          <div className="payment-info">
            <p>👛 Saldo disponível: R$ 250,00</p>
            <button className="btn-pay" onClick={handlePayment} disabled={loading}>
              {loading ? '⏳ Processando...' : `💰 Pagar com Carteira`}
            </button>
          </div>
        )}

        {paymentMethod === 'pix' && (
          <div className="payment-info">
            <p>🔲 Escaneie o QR Code com seu banco</p>
            <div className="qr-code">█████████████████████████</div>
            <button className="btn-pay" onClick={handlePayment} disabled={loading}>
              {loading ? '⏳ Aguardando confirmação...' : '✓ Confirmar PIX'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Payment;
