import React, { useState } from 'react';
import '../styles/AdminLogin.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const DEFAULT_ADMIN_EMAIL = 'admin@uberclone.com';

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Servidor retornou uma resposta inválida (${response.status}). Verifique o backend.`); }
}

function AdminLogin({ onAdminLogin }) {
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Credenciais administrativas inválidas');
      if (!data.token || !data.admin) throw new Error('Resposta de login incompleta do servidor.');
      localStorage.setItem('adminToken', data.token);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.setItem('admin', JSON.stringify(data.admin));
      onAdminLogin(data.admin);
    } catch (err) {
      setError(err.message || 'Não foi possível entrar como administrador.');
    } finally {
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
        <form onSubmit={handleLogin} className="login-form">
          <div className="security-badge"><span>🛡️ Conexão Segura</span></div>
          <div className="form-group">
            <label htmlFor="email">📧 Email Administrativo</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </div>
          <div className="form-group">
            <label htmlFor="password">🔐 Senha</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" minLength={8} required />
          </div>
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? '⏳ Verificando...' : '🚀 Entrar como Admin'}
          </button>
        </form>
        <div className="login-footer">
          <p>🔒 Acesso administrativo protegido</p>
          <small>Use as credenciais configuradas no backend.</small>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
