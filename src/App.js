/* Navegação autenticada: perfil e corrida usam rotas independentes. */
// Fluxo do passageiro: Procurar corrida, Histórico e Perfil permanecem independentes.
import React, { useEffect, useState } from 'react';
import AdminLogin from './pages/AdminLogin';
import AdminDashboardLive from './pages/AdminDashboardLive';
import Login from './pages/Login';
import Register from './pages/Register';
import UserProfile from './pages/UserProfile';
import DriverRegistration from './pages/DriverRegistration';
import DriverDashboardMapPro from './pages/DriverDashboardMapPro';
import DriverPanelMap from './components/DriverPanelMap';
import AdminPanel from './pages/AdminPanel';
import Payment from './pages/Payment';
import NotificationCenter from './pages/NotificationCenter';
import MapRidePro from './pages/MapRidePro';
import RideHistoryPro from './pages/RideHistoryPro';
import ResetPassword from './pages/ResetPassword';
import LiveStatsBar from './pages/LiveStatsBar';
import ProfilePhoto from './pages/ProfilePhoto';
import RideRatingPanel from './pages/RideRatingPanel';
import { logoutFirebase } from './firebase';
import { BACKEND_URL } from './config';
import { dispatchRideSearch } from './services/rideDispatch';
import './App.css';

const getStored = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } };
const resolveUserPage = (user) => { if (!user) return 'home'; if (user.userType !== 'driver') return 'ride'; if (user.driverApprovalStatus === 'approved') return 'driver-dashboard'; if (user.driverApprovalStatus === 'pending') return 'driver-pending'; return 'driver-registration'; };
const isUserPage = (page, user) => { if (!user) return false; if (page === 'ride' || page === 'ride-history' || page === 'profile') return true; if (user.userType === 'driver' && user.driverApprovalStatus === 'approved' && page === 'driver-dashboard') return true; if (user.userType === 'driver' && user.driverApprovalStatus === 'pending' && page === 'driver-pending') return true; if (user.userType === 'driver' && user.driverApprovalStatus !== 'approved' && user.driverApprovalStatus !== 'pending' && page === 'driver-registration') return true; return false; };
const getInitialPage = () => { const params = new URLSearchParams(window.location.search); if (params.get('mode') === 'resetPassword' && params.get('oobCode')) return 'reset-password'; const token = localStorage.getItem('token'); const adminToken = localStorage.getItem('adminToken'); const admin = getStored('admin'); const user = getStored('user'); if (admin && adminToken) return 'admin-dashboard'; if (user && token) return resolveUserPage(user); return 'home'; };

function AccountPanel({ account, currentPage, onNavigate, children }) {
  const isDriver = account?.userType === 'driver' && account?.driverApprovalStatus === 'approved';
  const items = isDriver ? [{ page: 'driver-dashboard', icon: '⌂', label: 'Início' }, { page: 'ride-history', icon: '▤', label: 'Histórico' }, { page: 'profile', icon: '◯', label: 'Perfil' }] : [{ page: 'ride', icon: '⌖', label: 'Procurar corrida' }, { page: 'ride-history', icon: '▤', label: 'Histórico' }, { page: 'profile', icon: '◯', label: 'Perfil' }];
  return <div className="account-shell"><div className="account-topbar"><div className="account-brand"><span>Preço</span><strong>Fixo17</strong></div><button type="button" className="account-profile-trigger" onClick={() => onNavigate('profile')} aria-label="Abrir perfil"><ProfilePhoto account={account} compact /></button></div><main className="account-content">{children}</main><RideRatingPanel account={account} /><nav className="app-bottom-nav" aria-label="Navegação principal">{items.map(item => <button key={item.page} type="button" className={`app-nav-item ${currentPage === item.page ? 'active' : ''}`} onClick={() => onNavigate(item.page)}><span className="app-nav-icon">{item.icon}</span><span>{item.label}</span></button>)}</nav></div>;
}

function DriverPending({ user, onLogout }) { return <div style={{ minHeight: '100vh', background: '#090909', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Arial' }}><div style={{ maxWidth: 520, width: '100%', background: '#151515', border: '1px solid #ff5a00', borderRadius: 16, padding: 28, textAlign: 'center' }}><ProfilePhoto account={user} compact /><div style={{ fontSize: 54 }}>⏳</div><h1>Cadastro em análise</h1><p style={{ color: '#ccc', lineHeight: 1.6 }}>{user?.name ? `${user.name}, ` : ''}seu cadastro de motorista foi enviado e aguarda aprovação.</p><p style={{ color: '#999', fontSize: 13 }}>Esta tela será atualizada automaticamente quando o administrador revisar o cadastro.</p><button type="button" onClick={onLogout} style={{ border: 0, borderRadius: 10, padding: '12px 20px', background: '#ff5a00', color: '#fff', fontWeight: 700 }}>Sair</button></div></div>; }

function App() {
  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [user, setUser] = useState(() => getStored('user'));
  const [admin, setAdmin] = useState(() => getStored('admin'));

  useEffect(() => {
    if (admin && localStorage.getItem('adminToken')) return undefined;
    const token = localStorage.getItem('token');
    const storedUser = getStored('user');
    if (!token || !storedUser) return undefined;
    let cancelled = false;
    const verifySession = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok && data.valid && data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
          setCurrentPage((page) => isUserPage(page, data.user) ? page : resolveUserPage(data.user));
        } else if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setCurrentPage('login');
        }
      } catch (_) {}
    };
    verifySession();
    const interval = window.setInterval(verifySession, currentPage === 'driver-pending' ? 5000 : 30000);
    const onFocus = () => verifySession();
    const onVisibility = () => { if (document.visibilityState === 'visible') verifySession(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility); };
  }, [admin, currentPage]);

  useEffect(() => { const onPhoto = (event) => { const uid = event.detail?.uid; const storedUser = getStored('user'); const storedAdmin = getStored('admin'); if (storedUser && (!uid || storedUser.uid === uid)) setUser({ ...storedUser, profilePhoto: event.detail.photo || null }); if (storedAdmin && (!uid || storedAdmin.uid === uid)) setAdmin({ ...storedAdmin, profilePhoto: event.detail.photo || null }); }; window.addEventListener('profile-photo-updated', onPhoto); return () => window.removeEventListener('profile-photo-updated', onPhoto); }, []);
  const handleUserLogin = (userData) => { setUser(userData); setAdmin(null); localStorage.setItem('user', JSON.stringify(userData)); localStorage.removeItem('admin'); localStorage.removeItem('adminToken'); setCurrentPage(resolveUserPage(userData)); };
  const handleLogout = async () => { await logoutFirebase(); setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); setCurrentPage('home'); };
  const handleDriverRegistration = (registration) => { const currentUser = getStored('user') || user || {}; const updatedUser = { ...currentUser, userType: 'driver', driverApprovalStatus: registration?.status || 'pending' }; setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); setCurrentPage(resolveUserPage(updatedUser)); };
  const handleAdminLogin = (adminData) => { setUser(null); setAdmin(adminData); localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.setItem('admin', JSON.stringify(adminData)); setCurrentPage('admin-dashboard'); };
  const handleAdminLogout = async () => { await logoutFirebase(); setAdmin(null); localStorage.removeItem('adminToken'); localStorage.removeItem('admin'); setCurrentPage('home'); };
  const navigate = (page) => setCurrentPage(page);
  const handleRideCreate = (ride) => { const rideId = ride?.id; const token = localStorage.getItem('token'); if (!rideId || !token) return; void dispatchRideSearch(rideId, token); };
  if (admin) return <AdminDashboardLive admin={admin} onLogout={handleAdminLogout} />;
  if (currentPage === 'admin-login' || currentPage === 'admin-dashboard') return <AdminLogin onAdminLogin={handleAdminLogin} />;
  switch (currentPage) {
    case 'login': return <Login onLoginSuccess={handleUserLogin} />;
    case 'register': return <Register onRegisterSuccess={handleUserLogin} />;
    case 'reset-password': return <ResetPassword onBackToLogin={() => { window.history.replaceState({}, '', window.location.pathname); setCurrentPage('login'); }} />;
    case 'ride': return user ? <AccountPanel account={user} currentPage="ride" onNavigate={navigate}><LiveStatsBar userType="passenger" /><MapRidePro onRideCreate={handleRideCreate} onBack={() => setCurrentPage('ride')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} />;
    case 'ride-history': return user ? <AccountPanel account={user} currentPage="ride-history" onNavigate={navigate}><RideHistoryPro user={user} onBack={() => setCurrentPage(user.userType === 'driver' ? 'driver-dashboard' : 'ride')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} />;
    case 'driver-registration': return <DriverRegistration onRegistrationSubmit={handleDriverRegistration} />;
    case 'driver-pending': return <DriverPending user={user} onLogout={handleLogout} />;
    case 'driver-dashboard': return user ? <AccountPanel account={user} currentPage="driver-dashboard" onNavigate={navigate}><LiveStatsBar userType="driver" /><DriverPanelMap /><DriverDashboardMapPro /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} />;
    case 'profile': return user ? <AccountPanel account={user} currentPage="profile" onNavigate={navigate}><UserProfile user={user} onLogout={handleLogout} onRequestRide={() => setCurrentPage('ride')} onHistory={() => setCurrentPage('ride-history')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} />;
    case 'admin-panel': return <AdminPanel />;
    case 'payment': return <Payment rideId="RIDE001" amount={32.5} onPaymentSuccess={() => {}} />;
    case 'notifications': return <NotificationCenter />;
    default: return <div className="home-page"><div className="home-hero"><div className="home-copy"><div className="home-brand-lockup"><span>PREÇO</span><strong>FIXO</strong><em>17</em></div><div className="home-tagline">📍 NA CIDADE • CORRIDA PARTICULAR</div><h1>Preço justo.<br /><strong>Sem surpresa.</strong></h1><p>Corridas particulares com preço justo, segurança, conforto e atendimento para você chegar ao seu destino.</p><div className="home-feature-row"><span>💰 Preço justo</span><span>🛡️ Segurança</span><span>⏱️ Pontualidade</span></div><div className="home-buttons"><button type="button" onClick={() => setCurrentPage('login')} className="btn-home">👤 ENTRAR</button><button type="button" onClick={() => setCurrentPage('register')} className="btn-home secondary">CRIAR MINHA CONTA</button></div><button type="button" onClick={() => setCurrentPage('admin-login')} className="home-admin-link">🔐 Acesso administrativo</button></div><div className="home-visual"><div className="home-price-card"><small>R$</small><b>17</b><span>PREÇO FIXO</span></div><div className="home-car"><div className="home-car-glow" /><div className="home-car-body"><div className="home-window front" /><div className="home-window rear" /><div className="home-car-door" /><div className="home-car-line" /><div className="home-wheel left" /><div className="home-wheel right" /></div></div><div className="home-visual-caption"><b>RÁPIDO. SEGURO.</b><span>E SEM COMPLICAÇÃO.</span></div></div></div></div>;
  }
}
export default App;
