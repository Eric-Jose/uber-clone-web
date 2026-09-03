import React, { useEffect, useState } from 'react';
import AdminLogin from './pages/AdminLogin';
import AdminDashboardLive from './pages/AdminDashboardLive';
import Login from './pages/Login';
import Register from './pages/Register';
import UserProfile from './pages/UserProfile';
import DriverRegistration from './pages/DriverRegistration';
import DriverDashboardPro from './pages/DriverDashboardPro';
import AdminPanel from './pages/AdminPanel';
import Payment from './pages/Payment';
import NotificationCenter from './pages/NotificationCenter';
import MapRidePro from './pages/MapRidePro';
import RideHistoryPro from './pages/RideHistoryPro';
import ResetPassword from './pages/ResetPassword';
import LiveStatsBar from './pages/LiveStatsBar';
import ProfilePhoto from './pages/ProfilePhoto';
import { auth, onAuthStateChanged, syncBackendSession, logoutFirebase } from './firebase';
import { BACKEND_URL } from './config';
import './App.css';

const getStored = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } };
const resolveUserPage = (user) => {
  if (!user) return 'home';
  if (user.userType !== 'driver') return 'ride';
  if (user.driverApprovalStatus === 'approved') return 'driver-dashboard';
  if (user.driverApprovalStatus === 'pending') return 'driver-pending';
  return 'driver-registration';
};
const getInitialPage = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'resetPassword' && params.get('oobCode')) return 'reset-password';
  const token = localStorage.getItem('token');
  const adminToken = localStorage.getItem('adminToken');
  const admin = getStored('admin');
  const user = getStored('user');
  if (admin && adminToken) return 'admin-dashboard';
  if (user && token) return resolveUserPage(user);
  return 'home';
};

function AccountPanel({ account, currentPage, onNavigate, children }) {
  const isDriver = account?.userType === 'driver' && account?.driverApprovalStatus === 'approved';
  const items = isDriver ? [{ page: 'driver-dashboard', icon: '⌂', label: 'Início' }, { page: 'ride-history', icon: '▤', label: 'Histórico' }, { page: 'profile', icon: '◯', label: 'Perfil' }] : [{ page: 'ride', icon: '⌖', label: 'Procurar corrida' }, { page: 'ride-history', icon: '▤', label: 'Histórico' }, { page: 'profile', icon: '◯', label: 'Perfil' }];
  return <div className="account-shell"><div className="account-topbar"><div className="account-brand">UberClone</div><button className="account-profile-trigger" onClick={() => onNavigate('profile')} aria-label="Abrir perfil"><ProfilePhoto account={account} compact /></button></div><main className="account-content">{children}</main><nav className="app-bottom-nav" aria-label="Navegação principal">{items.map(item => <button key={item.page} className={`app-nav-item ${currentPage === item.page ? 'active' : ''}`} onClick={() => onNavigate(item.page)}><span className="app-nav-icon">{item.icon}</span><span>{item.label}</span></button>)}</nav></div>;
}

function DriverPending({ user, onLogout }) {
  return <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Arial' }}><div style={{ maxWidth: 520, width: '100%', background: '#fff', borderRadius: 16, padding: 28, textAlign: 'center' }}><ProfilePhoto account={user} compact /><div style={{ fontSize: 54 }}>⏳</div><h1>Cadastro em análise</h1><p style={{ color: '#666', lineHeight: 1.6 }}>{user?.name ? `${user.name}, ` : ''}seu cadastro de motorista foi enviado e aguarda aprovação.</p><p style={{ color: '#777', fontSize: 13 }}>Esta tela será atualizada automaticamente quando o administrador revisar o cadastro.</p><button onClick={onLogout} style={{ border: 0, borderRadius: 10, padding: '12px 20px', background: '#111827', color: '#fff', fontWeight: 700 }}>Sair</button></div></div>;
}

function App() {
  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [user, setUser] = useState(() => getStored('user'));
  const [admin, setAdmin] = useState(() => getStored('admin'));

  useEffect(() => {
    if (!auth) return undefined;
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser || cancelled || getStored('admin')) return;
      const data = await syncBackendSession(firebaseUser);
      if (cancelled || !data?.user) return;
      setUser(data.user);
      setAdmin(null);
      localStorage.removeItem('admin');
      localStorage.removeItem('adminToken');
      setCurrentPage(resolveUserPage(data.user));
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

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
          localStorage.setItem('user', JSON.stringify(data.user)); setUser(data.user); setCurrentPage(resolveUserPage(data.user));
        } else if (response.status === 401) {
          localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); setCurrentPage('login');
        }
      } catch (_) {}
    };
    verifySession();
    const intervalMs = currentPage === 'driver-pending' ? 5000 : 30000;
    const interval = window.setInterval(verifySession, intervalMs);
    const onFocus = () => verifySession();
    const onVisibility = () => { if (document.visibilityState === 'visible') verifySession(); };
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onVisibility);
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility); };
  }, [admin, currentPage]);

  useEffect(() => {
    const onPhoto = (event) => { const uid = event.detail?.uid; const storedUser = getStored('user'); const storedAdmin = getStored('admin'); if (storedUser && (!uid || storedUser.uid === uid)) setUser({ ...storedUser, profilePhoto: event.detail.photo || null }); if (storedAdmin && (!uid || storedAdmin.uid === uid)) setAdmin({ ...storedAdmin, profilePhoto: event.detail.photo || null }); };
    window.addEventListener('profile-photo-updated', onPhoto); return () => window.removeEventListener('profile-photo-updated', onPhoto);
  }, []);

  const handleUserLogin = (userData) => { setUser(userData); setAdmin(null); localStorage.setItem('user', JSON.stringify(userData)); localStorage.removeItem('admin'); localStorage.removeItem('adminToken'); setCurrentPage(resolveUserPage(userData)); };
  const handleLogout = async () => { await logoutFirebase(); setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); setCurrentPage('home'); };
  const handleDriverRegistration = (registration) => { const currentUser = getStored('user') || user || {}; const updatedUser = { ...currentUser, userType: 'driver', driverApprovalStatus: registration?.status || 'pending' }; setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); setCurrentPage(resolveUserPage(updatedUser)); };
  const handleAdminLogin = (adminData) => { setUser(null); setAdmin(adminData); localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.setItem('admin', JSON.stringify(adminData)); setCurrentPage('admin-dashboard'); };
  const handleAdminLogout = async () => { await logoutFirebase(); setAdmin(null); localStorage.removeItem('adminToken'); localStorage.removeItem('admin'); setCurrentPage('home'); };
  const navigate = (page) => setCurrentPage(page);

  if (admin) return <AdminDashboardLive admin={admin} onLogout={handleAdminLogout} />;
  if (currentPage === 'admin-login' || currentPage === 'admin-dashboard') return <AdminLogin onAdminLogin={handleAdminLogin} />;
  switch (currentPage) {
    case 'login': return <Login onLoginSuccess={handleUserLogin} />;
    case 'register': return <Register onRegisterSuccess={handleUserLogin} />;
    case 'reset-password': return <ResetPassword onBackToLogin={() => { window.history.replaceState({}, '', window.location.pathname); setCurrentPage('login'); }} />;
    case 'ride': return user ? <AccountPanel account={user} currentPage="ride" onNavigate={navigate}><LiveStatsBar userType="passenger" /><MapRidePro onRideCreate={() => {}} onBack={() => setCurrentPage('profile')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} />;
    case 'ride-history': return user ? <AccountPanel account={user} currentPage="ride-history" onNavigate={navigate}><RideHistoryPro user={user} onBack={() => setCurrentPage(user.userType === 'driver' ? 'driver-dashboard' : 'ride')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} />;
    case 'driver-registration': return <DriverRegistration onRegistrationSubmit={handleDriverRegistration} />;
    case 'driver-pending': return <DriverPending user={user} onLogout={handleLogout} />;
    case 'driver-dashboard': return user ? <AccountPanel account={user} currentPage="driver-dashboard" onNavigate={navigate}><LiveStatsBar userType="driver" /><DriverDashboardPro /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} />;
    case 'profile': return user ? <AccountPanel account={user} currentPage="profile" onNavigate={navigate}><UserProfile user={user} onLogout={handleLogout} onRequestRide={() => setCurrentPage('ride')} onHistory={() => setCurrentPage('ride-history')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} />;
    case 'admin-panel': return <AdminPanel />;
    case 'payment': return <Payment rideId="RIDE001" amount={32.5} onPaymentSuccess={() => alert('Pagamento realizado!')} />;
    case 'notifications': return <NotificationCenter />;
    default: return <div className="home-page"><div className="home-container"><div className="home-badge">🚗 Transporte inteligente</div><h1>UberClone</h1><p>Entre na sua conta para solicitar corridas, acompanhar seu motorista e acessar seu histórico.</p><div className="home-buttons"><button onClick={() => setCurrentPage('login')} className="btn-home">👤 Entrar como usuário</button><button onClick={() => setCurrentPage('register')} className="btn-home secondary">✨ Criar conta</button><button onClick={() => setCurrentPage('admin-login')} className="btn-home admin">🔐 Administrador</button></div></div></div>;
  }
}

export default App;
