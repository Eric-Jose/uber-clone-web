import React, { useState } from 'react';
import '../styles/Auth.css';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import { syncFirebaseLogin } from '../firebase';
import { BACKEND_URL } from '../config';

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
      try { await syncFirebaseLogin(normalizedEmail, password); } catch (_) {}
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Não foi possível fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container login-page">
      <div className="login-shell">
        <aside className="login-showcase" aria-hidden="true">
          <div className="login-showcase-glow" />
          <div className="login-brand-lockup">
            <span className="login-brand-main">PREÇO</span>
            <span className="login-brand-orange">FIXO</span>
            <span className="login-brand-price"><small>R$</small>17</span>
          </div>
          <div className="login-showcase-car" aria-hidden="true"><span>🚘</span></div>
          <div className="login-showcase-copy">
            <span className="login-eyebrow">CORRIDA PARTICULAR</span>
            <h1>Preço justo.<br /><em>Sem surpresa.</em></h1>
            <p>Corridas rápidas, segurança e conforto para você chegar ao seu destino.</p>
          </div>
          <div className="login-benefits">
            <span><b>R$</b> Preço justo</span>
            <span><b>✓</b> Segurança</span>
            <span><b>●</b> Atendimento</span>
            <span><b>◷</b> Pontualidade</span>
          </div>
          <div className="login-showcase-meta"><strong>17</strong> na cidade · rápido, seguro e sem complicação</div>
        </aside>

        <main className="auth-card login-card">
          <div className="mobile-login-brand"><span>PREÇO</span><strong>FIXO</strong><b>17</b></div>
          <div className="auth-header login-header">
            <div className="login-welcome-badge">17</div>
            <h1>Bem-vindo!</h1>
            <p>Entre na sua conta para continuar.</p>
          </div>

          {error && <div className="error-message" role="alert"><span>!</span>{error}</div>}

          <form onSubmit={handleLogin} className="auth-form login-form">
            <div className="form-group floating-group">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" autoComplete="email" inputMode="email" placeholder="voce@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div className="form-group floating-group">
              <label htmlFor="password">Senha</label>
              <div className="password-wrap">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
              </div>
            </div>

            <div className="login-actions-row">
              <span>🔒 Conta protegida</span>
              <button type="button" className="auth-link-button forgot-link" onClick={() => setShowForgotPassword(true)}>Esqueci minha senha</button>
            </div>

            <button type="submit" className="btn-primary login-submit" disabled={loading}>{loading ? 'Entrando…' : 'ENTRAR'}</button>
          </form>

          <div className="login-divider"><span>ou</span></div>
          <button type="button" className="login-outline-button" onClick={() => setShowRegister(true)}>CRIAR MINHA CONTA</button>
          <p className="login-legal">Ao continuar, você concorda com os termos e a política de privacidade do PreçoFixo17.</p>
          <div className="login-footer-slogan">🚗 <strong>PreçoFixo17</strong> · conforto e confiança para você.</div>
        </main>
      </div>
    </div>
  );
}

export default Login;
