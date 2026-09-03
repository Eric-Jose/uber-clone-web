import React, { useState } from 'react';
import '../styles/Auth.css';
import { BACKEND_URL } from '../config';

function ForgotPassword({ onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/password-reset/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar o link.');
      setMessage(data.message);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header"><h1>🔐 Recuperar senha</h1><p>Vamos ajudar você a entrar novamente.</p></div>
        {error && <div className="error-message">❌ {error}</div>}
        {message && <div className="success-message">✅ {message}</div>}
        {!message && <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group"><label htmlFor="reset-email">📧 Email</label><input id="reset-email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? '⏳ Enviando...' : '📩 Enviar link de recuperação'}</button>
        </form>}
        <div className="auth-footer"><button type="button" className="auth-link-button" onClick={onBackToLogin}>← Voltar para o login</button></div>
      </div>
    </div>
  );
}

export default ForgotPassword;
