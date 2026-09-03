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
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      await syncFirebaseLogin(normalizedEmail, password);
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
          <div className="login-brand">UberClone</div>
          <div className="login-showcase-copy">
            <span className="login-eyebrow">Transporte simples e seguro</span>
            <h1>Chegue onde precisa.</h1>
            <p>Solicite uma corrida, acompanhe seu motorista em tempo real e tenha tudo na palma da mão.</p>
          </div>
          <div className="login-showcase-meta"><span>●</span> Experiência rápida no celular</div>
        </aside>

        <main className="auth-card login-card">
          <div className="mobile-login-brand">UberClone</div>
          <div className="auth-header login-header">
            <div className="login-icon" aria-hidden="true">↗</div>
            <h1>Entrar</h1>
            <p>Acesse sua conta para continuar.</p>
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
              <span>Conta protegida</span>
              <button type="button" className="auth-link-button forgot-link" onClick={() => setShowForgotPassword(true)}>Esqueci a senha</button>
            </div>

            <button type="submit" className="btn-primary login-submit" disabled={loading}>{loading ? 'Entrando…' : 'Continuar'}</button>
          </form>

          <div className="login-divider"><span>ou</span></div>
          <button type="button" className="login-outline-button" onClick={() => setShowRegister(true)}>Criar uma conta</button>
          <p className="login-legal">Ao continuar, você concorda com os termos e a política de privacidade do UberClone.</p>
        </main>
      </div>
    </div>
  );
}

export default Login;
