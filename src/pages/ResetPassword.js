import React, { useMemo, useState } from 'react';
import '../styles/Auth.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function ResetPassword({ onBackToLogin }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const oobCode = useMemo(() => new URLSearchParams(window.location.search).get('oobCode') || '', []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!oobCode) return setError('Link de recuperação inválido ou incompleto.');
    if (password.length < 6) return setError('A nova senha deve ter pelo menos 6 caracteres.');
    if (password !== confirmPassword) return setError('As senhas não são iguais.');
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/password-reset/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oobCode, newPassword: password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível alterar a senha.');
      setMessage(data.message || 'Senha alterada com sucesso.');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header"><h1>🔐 Nova senha</h1><p>Digite sua nova senha para recuperar o acesso.</p></div>
        {error && <div className="error-message">❌ {error}</div>}
        {message ? <div className="success-message">✅ {message}<br/><button type="button" className="auth-link-button" onClick={onBackToLogin}>Entrar no aplicativo</button></div> : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group"><label htmlFor="new-password">🔑 Nova senha</label><input id="new-password" type="password" minLength="6" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required /></div>
            <div className="form-group"><label htmlFor="confirm-password">🔑 Confirmar senha</label><input id="confirm-password" type="password" minLength="6" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Digite novamente" required /></div>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? '⏳ Salvando...' : '✅ Alterar senha'}</button>
          </form>
        )}
        {!message && <div className="auth-footer"><button type="button" className="auth-link-button" onClick={onBackToLogin}>← Voltar para o login</button></div>}
      </div>
    </div>
  );
}

export default ResetPassword;
