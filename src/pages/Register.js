import React, { useState } from 'react';
import '../styles/Auth.css';
import { syncFirebaseRegistration } from '../firebase';
import { BACKEND_URL } from '../config';

function Register({ onRegisterSuccess, onBackToLogin }) {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '', userType: 'passenger' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (formData.password !== formData.confirmPassword) { setError('As senhas não conferem!'); return; }
    setLoading(true);
    try {
      const normalizedEmail = formData.email.trim().toLowerCase();
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, email: normalizedEmail, phone: formData.phone, password: formData.password, userType: formData.userType })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Erro ao registrar');
      if (!data.token || !data.user) throw new Error('Resposta de cadastro incompleta.');

      // Firebase é sincronização auxiliar; o cadastro principal já foi criado
      // pelo backend com Firebase Admin e a sessão JWT abaixo é persistida.
      try { await syncFirebaseRegistration(normalizedEmail, formData.password); } catch (_) {}
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccess('✅ Cadastro realizado com sucesso!');
      setTimeout(() => onRegisterSuccess(data.user), 700);
    } catch (err) {
      setError(err.message || 'Erro ao registrar');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card large">
        <div className="auth-header"><h1>🚗 UberClone</h1><p>Crie sua conta e comece!</p></div>
        {error && <div className="error-message">❌ {error}</div>}
        {success && <div className="success-message">{success}</div>}
        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group"><label htmlFor="userType">👤 Você é:</label><select id="userType" name="userType" value={formData.userType} onChange={handleChange} className="user-type-select"><option value="passenger">🚖 Passageiro (Viajar)</option><option value="driver">🚗 Motorista (Ganhar)</option></select></div>
          <div className="form-group"><label htmlFor="name">👤 Nome Completo</label><input id="name" type="text" name="name" placeholder="Seu nome" value={formData.name} onChange={handleChange} required /></div>
          <div className="form-group"><label htmlFor="email">📧 Email</label><input id="email" type="email" name="email" placeholder="seu@email.com" value={formData.email} onChange={handleChange} required /></div>
          <div className="form-group"><label htmlFor="phone">📱 Telefone</label><input id="phone" type="tel" name="phone" placeholder="(11) 99999-9999" value={formData.phone} onChange={handleChange} required /></div>
          <div className="form-group"><label htmlFor="password">🔐 Senha</label><input id="password" type="password" name="password" placeholder="Senha forte" value={formData.password} onChange={handleChange} required /></div>
          <div className="form-group"><label htmlFor="confirmPassword">🔐 Confirmar Senha</label><input id="confirmPassword" type="password" name="confirmPassword" placeholder="Repita a senha" value={formData.confirmPassword} onChange={handleChange} required /></div>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? '⏳ Cadastrando...' : '✨ Criar Conta'}</button>
        </form>
        <div className="auth-footer"><p>Já tem conta? <button type="button" onClick={() => onBackToLogin?.()} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>Faça login aqui</button></p></div>
      </div>
    </div>
  );
}

export default Register;
