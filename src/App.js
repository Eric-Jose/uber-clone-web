import React, { useEffect, useState } from 'react';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import UserProfile from './pages/UserProfile';
import DriverRegistration from './pages/DriverRegistration';
import DriverDashboard from './pages/DriverDashboard';
import AdminPanel from './pages/AdminPanel';
import Payment from './pages/Payment';
import NotificationCenter from './pages/NotificationCenter';
import MapRideFixed from './pages/MapRideFixed';
import RideHistory from './pages/RideHistory';
import ResetPassword from './pages/ResetPassword';
import LiveStatsBar from './pages/LiveStatsBar';
import ProfilePhoto from './pages/ProfilePhoto';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function getStoredJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
}

function resolveUserPage(userData) {
  if (!userData) return 'home';
  if (userData.userType !== 'driver') return 'ride';
  if (userData.driverApprovalStatus === 'approved') return 'driver-dashboard';
  if (userData.driverApprovalStatus === 'pending') return 'driver-pending';
  return 'driver-registration';
}

function getInitialPage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'resetPassword' && params.get('oobCode')) return 'reset-password';

  const token = localStorage.getItem('token');
  const adminToken = localStorage.getItem('adminToken');
  const admin = getStoredJson('admin');
  const user = getStoredJson('user');

  if (admin && adminToken) return 'admin-dashboard';
  if (user && token) return resolveUserPage(user);
  return 'home';
}

function DriverPending({ user, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: 520, width: '100%', background: '#fff', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 2px 14px rgba(0,0,0,.08)' }}>
        <ProfilePhoto account={user} compact />
        <div style={{ fontSize: 54 }}>⏳</div>
        <h1>Cadastro em análise</h1>
        <p style={{ color: '#666', lineHeight: 1.6 }}>
          {user?.name ? `${user.name}, ` : ''}seu cadastro de motorista foi enviado com sucesso e está aguardando aprovação.
          Você poderá ficar online e receber corridas depois que o cadastro for aprovado.
        </p>
        <button onClick={onLogout} style={{ border: 0, borderRadius: 10, padding: '12px 20px', background: '#111827', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
          Sair
        </button>
      </div>
    </div>
  );
}

function AccountPanel({ account, type, children }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 3000, background: '#fff', borderRadius: 14, padding: 10, boxShadow: '0 4px 18px rgba(0,0,0,.18)' }}>
        <ProfilePhoto account={account} compact />
      </div>
      {children}
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [user, setUser] = useState(() => getStoredJson('user'));
  const [admin, setAdmin] = useState(() => getStoredJson('admin'));

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = getStoredJson('user');
    if (!token || !storedUser) return undefined;

    let cancelled = false;
    const verifySession = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !data.valid || !data.user) {
          if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setCurrentPage('login');
          }
          return;
        }
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setCurrentPage(resolveUserPage(data.user));
      } catch (_) {}
    };

    verifySession();
    const interval = window.setInterval(verifySession, 30000);
    const handleFocus = () => verifySession();
    const handleVisibility = () => { if (document.visibilityState === 'visible') verifySession(); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const handlePhoto = (event) => {
      const uid = event.detail?.uid;
      const storedUser = getStoredJson('user');
      const storedAdmin = getStoredJson('admin');
      if (storedUser && (!uid || storedUser.uid === uid)) setUser({ ...storedUser, profilePhoto: event.detail.photo || null });
      if (storedAdmin && (!uid || storedAdmin.uid === uid)) setAdmin({ ...storedAdmin, profilePhoto: event.detail.photo || null });
    };
    window.addEventListener('profile-photo-updated', handlePhoto);
    return () => window.removeEventListener('profile-photo-updated', handlePhoto);
  }, []);

  const handleUserLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    setCurrentPage(resolveUserPage(userData));
  };

  const handleUserLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentPage('home');
  };

  const handleDriverRegistrationSubmit = (registration) => {
    const currentUser = getStoredJson('user') || user || null;
    const updatedUser = { ...(currentUser || {}), userType: 'driver', driverApprovalStatus: registration?.status || 'pending' };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setCurrentPage(resolveUserPage(updatedUser));
  };

  const handleAdminLogin = (adminData) => {
    setAdmin(adminData);
    const token = localStorage.getItem('adminToken');
    if (token) localStorage.setItem('token', token);
    localStorage.setItem('admin', JSON.stringify(adminData));
    setCurrentPage('admin-dashboard');
  };

  const handleAdminLogout = () => {
    setAdmin(null);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    setCurrentPage('home');
  };

  if (admin) return <AccountPanel account={admin} type="admin"><AdminDashboard admin={admin} onLogout={handleAdminLogout} /></AccountPanel>;
  if (currentPage === 'admin-login' || currentPage === 'admin-dashboard') return <AdminLogin onAdminLogin={handleAdminLogin} />;

  switch (currentPage) {
    case 'login': return <Login onLoginSuccess={handleUserLogin} />;
    case 'register': return <Register onRegisterSuccess={handleUserLogin} />;
    case 'reset-password': return <ResetPassword onBackToLogin={() => { window.history.replaceState({}, '', window.location.pathname); setCurrentPage('login'); }} />;
    case 'ride': return user ? <AccountPanel account={user} type="passenger"><LiveStatsBar userType="passenger" /><MapRideFixed onRideCreate={() => {}} onBack={() => setCurrentPage('profile')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} />;
    case 'ride-history': return user ? <RideHistory user={user} onBack={() => setCurrentPage(user.userType === 'driver' ? 'driver-dashboard' : 'ride')} /> : <Login onLoginSuccess={handleUserLogin} />;
    case 'driver-registration': return <DriverRegistration onRegistrationSubmit={handleDriverRegistrationSubmit} />;
    case 'driver-pending': return <DriverPending user={user} onLogout={handleUserLogout} />;
    case 'driver-dashboard': return user ? <AccountPanel account={user} type="driver"><LiveStatsBar userType="driver" /><DriverDashboard /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} />;
    case 'profile': return user ? <UserProfile user={user} onLogout={handleUserLogout} onRequestRide={() => setCurrentPage('ride')} onHistory={() => setCurrentPage('ride-history')} /> : <Login onLoginSuccess={handleUserLogin} />;
    case 'admin-panel': return <AdminPanel />;
    case 'payment': return <Payment rideId="RIDE001" amount={32.50} onPaymentSuccess={() => alert('Pagamento realizado!')} />;
    case 'notifications': return <NotificationCenter />;
    default: return <div className="home-page"><div className="home-container"><h1>🚗 UberClone - Bem-vindo!</h1><p>Escolha uma opção para continuar:</p><div className="home-buttons"><button onClick={() => setCurrentPage('login')} className="btn-home">👤 Usuário</button><button onClick={() => setCurrentPage('admin-login')} className="btn-home admin">🔐 Administrador</button></div></div></div>;
  }
}
export default App;
