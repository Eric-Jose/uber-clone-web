import React, { useState } from 'react';
import '../styles/Payment.css';
import '../styles/PrecoFixo17Reference.css';

const FIXED_RIDE_PRICE = 17;

function Payment({ rideId, amount = FIXED_RIDE_PRICE, onPaymentSuccess, onBack }) {
  const [selectedMethod, setSelectedMethod] = useState('money'); // 'money' | 'card' | 'pix'
  const [cashGiven, setCashGiven] = useState('20,00');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Calculate change
  const numericCash = parseFloat(cashGiven.replace(/\./g, '').replace(',', '.')) || 0;
  const changeValue = Math.max(0, numericCash - amount);

  const handleConfirm = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setConfirmed(true);
      if (typeof onPaymentSuccess === 'function') {
        onPaymentSuccess({
          rideId,
          amount,
          method: selectedMethod,
          change: changeValue
        });
      }
    }, 600);
  };

  return (
    <div className="pf-payment-screen">
      <style>{`
        .pf-payment-screen {
          min-height: 100vh;
          background: #050505;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .pf-pay-topbar {
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
        .pf-pay-back {
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
        .pf-pay-back:hover { background: #161b22; }
        .pf-pay-title {
          font-size: 17px;
          font-weight: 700;
          color: #ffffff;
        }
        .pf-pay-body {
          flex: 1;
          max-width: 440px;
          width: 100%;
          margin: 0 auto;
          padding: 32px 20px 40px;
          display: flex;
          flex-direction: column;
        }
        .pf-pay-hero {
          text-align: center;
          margin-bottom: 36px;
        }
        .pf-pay-hero-label {
          color: #8e98a5;
          font-size: 15px;
          margin-bottom: 6px;
        }
        .pf-pay-hero-price {
          font-size: 46px;
          font-weight: 900;
          color: #ff5a00;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .pf-pay-hero-price small {
          font-size: 26px;
          font-weight: 700;
          margin-right: 4px;
        }
        .pf-pay-section-label {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 14px;
        }
        .pf-pay-methods-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pf-pay-method-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px;
          background: #0f1216;
          border: 1.5px solid #242a34;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pf-pay-method-item:hover {
          border-color: #3b4454;
        }
        .pf-pay-method-item.selected {
          border-color: #ff5a00;
          background: rgba(255, 90, 0, 0.06);
        }
        .pf-pay-method-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pf-pay-method-icon {
          width: 40px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .pf-pay-icon-money {
          background: #1e3a29;
          color: #22c55e;
        }
        .pf-pay-icon-card {
          background: #1e293b;
          color: #38bdf8;
        }
        .pf-pay-icon-pix {
          background: #0f3032;
          color: #2dd4bf;
        }
        .pf-pay-method-name {
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
        }
        .pf-pay-radio {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid #485260;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .pf-pay-method-item.selected .pf-pay-radio {
          border-color: #ff5a00;
          background: #ff5a00;
        }
        .pf-pay-radio-check {
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
        }
        .pf-pay-change-box {
          margin-top: 24px;
          background: #0f1216;
          border: 1px solid #242a34;
          border-radius: 16px;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .pf-pay-change-label {
          font-size: 14px;
          color: #8e98a5;
        }
        .pf-pay-change-inputs {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pf-pay-input-change {
          background: #161a20;
          border: 1px solid #323a48;
          border-radius: 10px;
          color: #ffffff;
          font-size: 15px;
          font-weight: 700;
          padding: 8px 12px;
          width: 100px;
          text-align: right;
          outline: none;
        }
        .pf-pay-input-change:focus {
          border-color: #ff5a00;
        }
        .pf-pay-change-amount {
          color: #22c55e;
          font-weight: 800;
          font-size: 16px;
          white-space: nowrap;
        }
        .pf-pay-actions {
          margin-top: auto;
          padding-top: 36px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: center;
        }
        .pf-pay-confirm-btn {
          width: 100%;
          background: #ff5a00;
          color: #ffffff;
          border: none;
          border-radius: 999px;
          font-size: 16px;
          font-weight: 800;
          padding: 16px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(255, 90, 0, 0.35);
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .pf-pay-confirm-btn:hover:not(:disabled) {
          background: #ff6a16;
          transform: translateY(-1px);
        }
        .pf-pay-cancel-btn {
          background: transparent;
          border: none;
          color: #8e98a5;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          padding: 8px;
        }
        .pf-pay-cancel-btn:hover {
          color: #ffffff;
        }
        .pf-pay-success-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }
        .pf-pay-success-card {
          background: #111418;
          border: 1px solid #28303d;
          border-radius: 20px;
          padding: 28px 24px;
          text-align: center;
          max-width: 360px;
          width: 100%;
          animation: pfFadeIn 0.2s ease;
        }
        .pf-pay-success-icon {
          width: 60px;
          height: 60px;
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          margin: 0 auto 16px;
        }
      `}</style>

      {/* Top Header */}
      <header className="pf-pay-topbar">
        <button
          type="button"
          className="pf-pay-back"
          onClick={() => onBack?.()}
          aria-label="Voltar"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="pf-pay-title">Pagamento</span>
        <div style={{ width: 38 }} />
      </header>

      {/* Payment Body */}
      <main className="pf-pay-body">
        {/* Hero Price */}
        <div className="pf-pay-hero">
          <div className="pf-pay-hero-label">Preço fixo da corrida</div>
          <div className="pf-pay-hero-price">
            <small>R$</small>17,00
          </div>
        </div>

        {/* Payment Methods Section */}
        <div className="pf-pay-section-label">Pagamento</div>
        <div className="pf-pay-methods-list">
          {/* Cash */}
          <div
            className={`pf-pay-method-item ${selectedMethod === 'money' ? 'selected' : ''}`}
            onClick={() => setSelectedMethod('money')}
          >
            <div className="pf-pay-method-left">
              <div className="pf-pay-method-icon pf-pay-icon-money">
                💵
              </div>
              <span className="pf-pay-method-name">Dinheiro</span>
            </div>
            <div className="pf-pay-radio">
              {selectedMethod === 'money' && <span className="pf-pay-radio-check">✓</span>}
            </div>
          </div>

          {/* Credit Card */}
          <div
            className={`pf-pay-method-item ${selectedMethod === 'card' ? 'selected' : ''}`}
            onClick={() => setSelectedMethod('card')}
          >
            <div className="pf-pay-method-left">
              <div className="pf-pay-method-icon pf-pay-icon-card">
                💳
              </div>
              <span className="pf-pay-method-name">Cartão de Crédito</span>
            </div>
            <div className="pf-pay-radio">
              {selectedMethod === 'card' && <span className="pf-pay-radio-check">✓</span>}
            </div>
          </div>

          {/* PIX */}
          <div
            className={`pf-pay-method-item ${selectedMethod === 'pix' ? 'selected' : ''}`}
            onClick={() => setSelectedMethod('pix')}
          >
            <div className="pf-pay-method-left">
              <div className="pf-pay-method-icon pf-pay-icon-pix">
                ❖
              </div>
              <span className="pf-pay-method-name">PIX</span>
            </div>
            <div className="pf-pay-radio">
              {selectedMethod === 'pix' && <span className="pf-pay-radio-check">✓</span>}
            </div>
          </div>
        </div>

        {/* Change Calculation when Money is selected */}
        {selectedMethod === 'money' && (
          <div className="pf-pay-change-box">
            <span className="pf-pay-change-label">Troco para</span>
            <div className="pf-pay-change-inputs">
              <input
                type="text"
                className="pf-pay-input-change"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                placeholder="20,00"
              />
              <span className="pf-pay-change-amount">
                R$ {changeValue.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pf-pay-actions">
          <button
            type="button"
            className="pf-pay-confirm-btn"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Confirmando…' : 'Confirmar pagamento'}
          </button>
          <button
            type="button"
            className="pf-pay-cancel-btn"
            onClick={() => onBack?.()}
          >
            Cancelar
          </button>
        </div>
      </main>

      {/* Success Modal */}
      {confirmed && (
        <div className="pf-pay-success-modal">
          <div className="pf-pay-success-card">
            <div className="pf-pay-success-icon">✓</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Pagamento Confirmado!</h2>
            <p style={{ color: '#8e98a5', fontSize: 14, margin: '0 0 20px' }}>
              Corrida de R$ 17,00 paga com sucesso via{' '}
              <strong>
                {selectedMethod === 'money'
                  ? `Dinheiro (Troco: R$ ${changeValue.toFixed(2).replace('.', ',')})`
                  : selectedMethod === 'card'
                  ? 'Cartão de Crédito'
                  : 'PIX'}
              </strong>
              .
            </p>
            <button
              type="button"
              className="pf-btn-orange"
              onClick={() => onBack?.()}
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payment;
