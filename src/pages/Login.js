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
          <div className="login-showcase-car" aria-hidden="true">
            <svg viewBox="0 0 620 260" role="img" aria-label="Sedan branco PreçoFixo17" xmlns="http://www.w3.org/2000/svg">
              <defs><linearGradient id="pf17body" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#cfcfcf"/></linearGradient><linearGradient id="pf17glass" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#30343a"/><stop offset="1" stopColor="#08090b"/></linearGradient></defs>
              <ellipse cx="310" cy="226" rx="250" ry="20" fill="#000" opacity=".45"/>
              <path d="M68 181c8-29 29-45 65-53l70-15 55-55c12-12 29-18 47-18h105c30 0 52 12 71 35l42 51c37 7 57 21 64 55l5 23H61z" fill="url(#pf17body)" stroke="#171717" strokeWidth="7"/>
              <path d="M219 111l53-51c8-8 18-12 31-12h104c23 0 38 9 53 27l31 36z" fill="url(#pf17glass)" stroke="#222" strokeWidth="5"/>
              <path d="M274 53l-39 59h96V49h-31c-11 0-19 2-26 4zm68-4v63h119l-38-63z" fill="#11151a"/>
              <path d="M78 166h464c-8 16-19 27-34 34H96c-9-9-15-20-18-34z" fill="#ff5a00"/>
              <path d="M89 180h435" stroke="#080808" strokeWidth="8" opacity=".8"/>
              <text x="250" y="174" fill="#111" fontSize="24" fontWeight="900" fontStyle="italic">PREÇO</text><text x="250" y="198" fill="#ff5a00" fontSize="25" fontWeight="900" fontStyle="italic">FIXO</text><text x="370" y="196" fill="#111" fontSize="28" fontWeight="900" fontStyle="italic">17</text>
              <circle cx="152" cy="208" r="40" fill="#101010"/><circle cx="152" cy="208" r="23" fill="#777"/><circle cx="152" cy="208" r="9" fill="#191919"/>
              <circle cx="477" cy="208" r="40" fill="#101010"/><circle cx="477" cy="208" r="23" fill="#777"/><circle cx="477" cy="208" r="9" fill="#191919"/>
              <path d="M66 154h24" stroke="#ff5a00" strokeWidth="7" strokeLinecap="round"/><path d="M535 151h18" stroke="#fff" strokeWidth="8" strokeLinecap="round"/>
            </svg>
          </div>
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
