import React, { useState } from 'react';
import '../styles/AdminLogin.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function AdminLogin({ onAdminLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [step, setStep] = useState(1); // 1: Email/Senha, 2: 2FA
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFirstStep = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Credenciais inválidas');
      }

      // Se exigir 2FA
      if (data.requiresTwoFA) {
        setStep(2);
        setLoading(false);
        return;
      }

      // Login bem-sucedido
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('admin', JSON.stringify(data.admin));
      onAdminLogin(data.admin);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleTwoFA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, twoFACode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error('Código 2FA inválido');
      }

      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('admin', JSON.stringify(data.admin));
      onAdminLogin(data.admin);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="login-header">
          <div className="admin-icon">🔐</div>
          <h1>Acesso Administrativo</h1>
          <p>Apenas Administradores Autorizados</p>
        </div>

        {error && <div className="error-message">❌ {error}</div>}

        {step === 1 ? (
          // ETAPA 1: Email e Senha
          <form onSubmit={handleFirstStep} className="login-form">
            <div className="security-badge">
              <span>🛡️ Conexão Segura</span>
            </div>

            <div className="form-group">
              <label htmlFor="email">📧 Email Administrativo</label>
              <input
                id="email"
                type="email"
                placeholder="admin@uberclone.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">🔐 Senha</label>
              <input
                id="password"
                type="password"
                placeholder="Senha forte"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? '⏳ Verificando...' : '🚀 Entrar como Admin'}
            </button>
          </form>
        ) : (
          // ETAPA 2: Autenticação 2FA
          <form onSubmit={handleTwoFA} className="login-form">
            <div className="security-badge 2fa">
              <span>🔒 Autenticação 2FA</span>
            </div>

            <p className="info-text">
              Digite o código de 6 dígitos do seu autenticador.
            </p>

            <div className="form-group">
              <label htmlFor="twoFACode">📱 Código 2FA</label>
              <input
                id="twoFACode"
                type="text"
                placeholder="000000"
                maxLength="6"
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? '⏳ Verificando...' : '✅ Confirmar'}
            </button>

            <button
              type="button"
              className="btn-back"
              onClick={() => {
                setStep(1);
                setTwoFACode('');
              }}
            >
              ⬅️ Voltar
            </button>
          </form>
        )}

        <div className="login-footer">
          <p>🔒 Este acesso é monitorado e registrado em log</p>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
