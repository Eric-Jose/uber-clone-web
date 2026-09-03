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

  if (showRegister) return <Register onRegisterSuccess={onLoginSuccess} onBackToLogin={() => setShowRegister(false)} />;
  if (showForgotPassword) return <ForgotPassword onBackToLogin={() => setShowForgotPassword(false)} />;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Erro ao fazer login');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Firebase passa a guardar a sessão localmente. O backend continua sendo
      // a fonte dos dados do aplicativo, portanto contas antigas não são perdidas.
      await syncFirebaseLogin(normalizedEmail, password);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Erro ao fazer login');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header"><h1>🚗 UberClone</h1><p>Bem-vindo de volta!</p></div>
        {error && <div className="error-message">❌ {error}</div>}
        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group"><label htmlFor="email">📧 Email</label><input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="form-group"><label htmlFor="password">🔐 Senha</label><input id="password" type="password" placeholder="Digite sua senha" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button type="button" className="auth-link-button forgot-link" onClick={() => setShowForgotPassword(true)}>Esqueci minha senha</button>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? '⏳ Entrando...' : '🚀 Entrar'}</button>
        </form>
        <div className="auth-footer"><p>Não tem conta? <button type="button" className="auth-link-button" onClick={() => setShowRegister(true)}>Cadastre-se aqui</button></p></div>
      </div>
    </div>
  );
}

export default Login;
