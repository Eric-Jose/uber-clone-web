import React, { useState } from 'react';
import '../styles/Auth.css';
import '../styles/PrecoFixo17Reference.css';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import { isFirebaseConfigured, loginWithFirebasePassword, signInWithSocialProvider, syncBackendSession } from '../firebase';
import precoFixo17Car from '../assets/precoFixo17Car';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');
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
      if (!isFirebaseConfigured) throw new Error('Firebase não está configurado no ambiente do aplicativo.');
      const normalizedEmail = email.trim().toLowerCase();
      const firebaseUser = await loginWithFirebasePassword(normalizedEmail, password);
      const data = await syncBackendSession(firebaseUser);
      if (!data?.token || !data?.user) throw new Error('Não foi possível sincronizar sua sessão com o servidor.');
      onLoginSuccess(data.user);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        setError('Email ou senha inválidos.');
      } else if (code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setError(err.message || 'Não foi possível fazer login.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setError('');
    if (!isFirebaseConfigured) {
      setError('Login social indisponível no momento. Configure o Firebase no ambiente do aplicativo.');
      return;
    }
    setSocialLoading(provider);
    try {
      const firebaseUser = await signInWithSocialProvider(provider);
      const data = await syncBackendSession(firebaseUser);
      if (!data?.token || !data?.user) throw new Error('Não foi possível sincronizar sua conta com o servidor.');
      onLoginSuccess(data.user);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Login cancelado.');
      } else if (code === 'auth/popup-blocked') {
        setError('O navegador bloqueou a janela de login. Permita pop-ups para entrar com esta conta.');
      } else if (code === 'auth/account-exists-with-different-credential') {
        setError('Este e-mail já está vinculado a outro método de login. Entre com o método original.');
      } else if (code === 'auth/operation-not-allowed') {
        setError(`Login com ${provider === 'google' ? 'Google' : 'Facebook'} não está ativado no Firebase.`);
      } else {
        setError(err?.message || `Não foi possível entrar com ${provider === 'google' ? 'Google' : 'Facebook'}.`);
      }
    } finally {
      setSocialLoading('');
    }
  };

  return (
    <div className="pf-login-screen">
      <style>{`
        .pf-login-screen{min-height:100vh;background:radial-gradient(circle at 50% 12%,rgba(255,90,0,.16),transparent 45%),#050505;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
        .pf-login-card{width:100%;max-width:390px;display:flex;flex-direction:column;align-items:center;text-align:center}
        .pf-login-logo{font-size:26px;font-weight:900;font-style:italic;letter-spacing:-.03em;line-height:1}.pf-login-logo span{color:#fff}.pf-login-logo b{color:#ff5a00}
        .pf-login-city-pill{display:inline-block;margin-top:4px;background:#121417;border:1px solid #282f3a;color:#ff5a00;font-size:10px;font-weight:900;letter-spacing:.14em;padding:3px 10px;border-radius:999px;text-transform:uppercase}
        .pf-login-car-stage{position:relative;width:100%;max-width:320px;margin:12px 0 6px;display:flex;flex-direction:column;align-items:center}.pf-login-car-glow{position:absolute;bottom:10px;width:80%;height:24px;background:radial-gradient(ellipse at center,rgba(255,90,0,.35),transparent 70%);filter:blur(8px)}.pf-login-car-img{width:100%;height:auto;position:relative;z-index:2;filter:drop-shadow(0 14px 20px rgba(0,0,0,.8));border-radius:12px}
        .pf-login-headline{font-size:16px;font-weight:600;color:#e1e7ec;margin:8px 0 20px}.pf-login-headline strong{color:#ff5a00}.pf-login-form{width:100%;display:flex;flex-direction:column;gap:12px}
        .pf-input-wrap{position:relative;display:flex;align-items:center;width:100%;background:#0f1216;border:1px solid #242a34;border-radius:14px}.pf-input-wrap:focus-within{border-color:#ff5a00;box-shadow:0 0 0 3px rgba(255,90,0,.15)}.pf-input-icon{position:absolute;left:14px;color:#727d8c;display:flex;pointer-events:none}.pf-input-field{width:100%;background:transparent;border:none;color:#fff;padding:15px 44px;font-size:15px;outline:none;font-family:inherit}.pf-input-field::placeholder{color:#6c7684}.pf-toggle-eye{position:absolute;right:12px;background:transparent;border:0;color:#727d8c;cursor:pointer;padding:6px;display:flex}
        .pf-forgot-row{display:flex;justify-content:flex-end;margin-top:-4px;margin-bottom:6px}.pf-forgot-btn{background:transparent;border:0;color:#ff5a00;font-size:13px;font-weight:600;cursor:pointer;padding:2px}.pf-login-btn{width:100%;background:#ff5a00;color:#fff;font-size:16px;font-weight:800;padding:15px;border:0;border-radius:999px;cursor:pointer;box-shadow:0 8px 24px rgba(255,90,0,.35)}.pf-login-btn:disabled,.pf-social-btn:disabled{opacity:.6;cursor:not-allowed}
        .pf-divider{display:flex;align-items:center;width:100%;margin:22px 0 16px;color:#647080;font-size:13px}.pf-divider:before,.pf-divider:after{content:"";flex:1;height:1px;background:#242a34}.pf-divider span{padding:0 12px}.pf-social-row{display:flex;gap:12px;width:100%}.pf-social-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;background:#0f1216;border:1px solid #242a34;border-radius:999px;color:#fff;font-size:14px;font-weight:600;padding:12px;cursor:pointer}.pf-social-btn:hover{background:#181d24}.pf-footer-register{margin-top:24px;color:#8e98a5;font-size:14px}.pf-footer-register button{background:transparent;border:0;color:#ff5a00;font-weight:700;font-size:14px;cursor:pointer;margin-left:4px}.pf-login-error{width:100%;box-sizing:border-box;background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.35);color:#ff9999;font-size:13px;padding:10px 14px;border-radius:12px;margin-bottom:12px;text-align:left}
      `}</style>
      <div className="pf-login-card">
        <div className="pf-login-logo"><span>PREÇO </span><b>FIXO 17</b></div>
        <div className="pf-login-city-pill">NA CIDADE</div>
        <div className="pf-login-car-stage"><div className="pf-login-car-glow"/><img src={precoFixo17Car} alt="Carro oficial PreçoFixo17" className="pf-login-car-img"/></div>
        <p className="pf-login-headline">Corrida particular com preço fixo de <strong>R$17</strong></p>
        {error && <div className="pf-login-error">{error}</div>}
        <form onSubmit={handleLogin} className="pf-login-form">
          <div className="pf-input-wrap"><span className="pf-input-icon">👤</span><input id="email" type="text" autoComplete="username" placeholder="E-mail ou telefone" className="pf-input-field" value={email} onChange={(e)=>setEmail(e.target.value)} required/></div>
          <div className="pf-input-wrap"><span className="pf-input-icon">🔒</span><input id="password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder="Senha" className="pf-input-field" value={password} onChange={(e)=>setPassword(e.target.value)} required/><button type="button" className="pf-toggle-eye" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Ocultar senha':'Ver senha'}>{showPassword?'🙈':'👁️'}</button></div>
          <div className="pf-forgot-row"><button type="button" className="pf-forgot-btn" onClick={()=>setShowForgotPassword(true)}>Esqueceu a senha?</button></div>
          <button type="submit" className="pf-login-btn" disabled={loading||!!socialLoading}>{loading?'Entrando…':'Entrar'}</button>
        </form>
        <div className="pf-divider"><span>ou entre com</span></div>
        <div className="pf-social-row">
          <button type="button" className="pf-social-btn" onClick={()=>handleSocialLogin('google')} disabled={loading||!!socialLoading}>{socialLoading==='google'?'Abrindo…':'G  Google'}</button>
          <button type="button" className="pf-social-btn" onClick={()=>handleSocialLogin('facebook')} disabled={loading||!!socialLoading}>{socialLoading==='facebook'?'Abrindo…':'f  Facebook'}</button>
        </div>
        <p className="pf-footer-register">Não tem conta?<button type="button" onClick={()=>setShowRegister(true)}>Cadastre-se</button></p>
      </div>
    </div>
  );
}

export default Login;
