import React, { useState } from 'react';
import '../styles/Auth.css';
import '../styles/PrecoFixo17Reference.css';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import { BACKEND_URL } from '../config';
import precoFixo17Car from '../assets/precoFixo17Car';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (showRegister) return <Register onRegisterSuccess={onLoginSuccess} onBackToLogin={() => setShowRegister(false)} />;
  if (showForgotPassword) return <ForgotPassword onBackToLogin={() => setShowForgotPassword(false)} />;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível entrar na conta.');
      if (!data.token || !data.user) throw new Error('Resposta de login incompleta.');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Não foi possível fazer login.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialMock = (provider) => {
    const mockUser = {
      id: `social-${Date.now()}`,
      name: provider === 'Google' ? 'João Silva (Google)' : 'João Silva (Facebook)',
      email: `joao.${provider.toLowerCase()}@exemplo.com`,
      userType: 'passenger',
      rating: 4.9
    };
    localStorage.setItem('token', `mock-token-${Date.now()}`);
    localStorage.setItem('user', JSON.stringify(mockUser));
    onLoginSuccess(mockUser);
  };

  return (
    <div className="pf-login-screen">
      <style>{`
        .pf-login-screen {
          min-height: 100vh;
          background: radial-gradient(circle at 50% 12%, rgba(255, 90, 0, 0.16), transparent 45%), #050505;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .pf-login-card {
          width: 100%;
          max-width: 390px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .pf-login-logo {
          font-size: 26px;
          font-weight: 900;
          font-style: italic;
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .pf-login-logo span { color: #ffffff; }
        .pf-login-logo b { color: #ff5a00; }
        .pf-login-city-pill {
          display: inline-block;
          margin-top: 4px;
          background: #121417;
          border: 1px solid #282f3a;
          color: #ff5a00;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.14em;
          padding: 3px 10px;
          border-radius: 999px;
          text-transform: uppercase;
        }
        .pf-login-car-stage {
          position: relative;
          width: 100%;
          max-width: 320px;
          margin: 12px 0 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .pf-login-car-glow {
          position: absolute;
          bottom: 10px;
          width: 80%;
          height: 24px;
          background: radial-gradient(ellipse at center, rgba(255, 90, 0, 0.35), transparent 70%);
          filter: blur(8px);
        }
        .pf-login-car-img {
          width: 100%;
          height: auto;
          position: relative;
          z-index: 2;
          filter: drop-shadow(0 14px 20px rgba(0,0,0,0.8));
          border-radius: 12px;
        }
        .pf-login-headline {
          font-size: 16px;
          font-weight: 600;
          color: #e1e7ec;
          margin: 8px 0 20px;
        }
        .pf-login-headline strong {
          color: #ff5a00;
        }
        .pf-login-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pf-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          background: #0f1216;
          border: 1px solid #242a34;
          border-radius: 14px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .pf-input-wrap:focus-within {
          border-color: #ff5a00;
          box-shadow: 0 0 0 3px rgba(255, 90, 0, 0.15);
        }
        .pf-input-icon {
          position: absolute;
          left: 14px;
          color: #727d8c;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .pf-input-field {
          width: 100%;
          background: transparent;
          border: none;
          color: #ffffff;
          padding: 15px 44px 15px 44px;
          font-size: 15px;
          outline: none;
          font-family: inherit;
        }
        .pf-input-field::placeholder {
          color: #6c7684;
        }
        .pf-toggle-eye {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          color: #727d8c;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
        }
        .pf-toggle-eye:hover { color: #cdd3dc; }
        .pf-forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -4px;
          margin-bottom: 6px;
        }
        .pf-forgot-btn {
          background: transparent;
          border: none;
          color: #ff5a00;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 2px;
        }
        .pf-forgot-btn:hover {
          text-decoration: underline;
        }
        .pf-login-btn {
          width: 100%;
          background: #ff5a00;
          color: #ffffff;
          font-size: 16px;
          font-weight: 800;
          padding: 15px;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(255, 90, 0, 0.35);
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .pf-login-btn:hover:not(:disabled) {
          background: #ff6a16;
          transform: translateY(-1px);
        }
        .pf-login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .pf-divider {
          display: flex;
          align-items: center;
          width: 100%;
          margin: 22px 0 16px;
          color: #647080;
          font-size: 13px;
        }
        .pf-divider::before, .pf-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #242a34;
        }
        .pf-divider span {
          padding: 0 12px;
        }
        .pf-social-row {
          display: flex;
          gap: 12px;
          width: 100%;
        }
        .pf-social-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #0f1216;
          border: 1px solid #242a34;
          border-radius: 999px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          padding: 12px;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .pf-social-btn:hover {
          background: #181d24;
          border-color: #363e4d;
        }
        .pf-footer-register {
          margin-top: 24px;
          color: #8e98a5;
          font-size: 14px;
        }
        .pf-footer-register button {
          background: transparent;
          border: none;
          color: #ff5a00;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          margin-left: 4px;
        }
        .pf-footer-register button:hover {
          text-decoration: underline;
        }
        .pf-login-error {
          width: 100%;
          background: rgba(220, 38, 38, 0.15);
          border: 1px solid rgba(220, 38, 38, 0.35);
          color: #ff9999;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 12px;
          margin-bottom: 12px;
          text-align: left;
        }
      `}</style>

      <div className="pf-login-card">
        {/* Top Logo */}
        <div className="pf-login-logo">
          <span>PREÇO </span>
          <b>FIXO 17</b>
        </div>
        <div className="pf-login-city-pill">NA CIDADE</div>

        {/* Official Car Stage with Spotlight */}
        <div className="pf-login-car-stage">
          <div className="pf-login-car-glow" />
          <img
            src={precoFixo17Car}
            alt="Carro oficial PreçoFixo17"
            className="pf-login-car-img"
          />
        </div>

        {/* Headline */}
        <p className="pf-login-headline">
          Corrida particular com preço fixo de <strong>R$17</strong>
        </p>

        {error && <div className="pf-login-error">{error}</div>}

        {/* Form */}
        <form onSubmit={handleLogin} className="pf-login-form">
          <div className="pf-input-wrap">
            <span className="pf-input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <input
              id="email"
              type="text"
              autoComplete="username"
              placeholder="E-mail ou telefone"
              className="pf-input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="pf-input-wrap">
            <span className="pf-input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Senha"
              className="pf-input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="pf-toggle-eye"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showPassword ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>

          <div className="pf-forgot-row">
            <button
              type="button"
              className="pf-forgot-btn"
              onClick={() => setShowForgotPassword(true)}
            >
              Esqueceu a senha?
            </button>
          </div>

          <button type="submit" className="pf-login-btn" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        {/* Social login divider */}
        <div className="pf-divider">
          <span>ou entre com</span>
        </div>

        {/* Social buttons */}
        <div className="pf-social-row">
          <button
            type="button"
            className="pf-social-btn"
            onClick={() => handleSocialMock('Google')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            className="pf-social-btn"
            onClick={() => handleSocialMock('Facebook')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </button>
        </div>

        {/* Footer */}
        <p className="pf-footer-register">
          Não tem conta?
          <button type="button" onClick={() => setShowRegister(true)}>
            Cadastre-se
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
