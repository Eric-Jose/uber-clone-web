/* eslint-disable no-unused-vars */
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
import AdminPanel from './pages/AdminPanel';
import Payment from './pages/Payment';
import NotificationCenter from './pages/NotificationCenter';
import MapRidePro from './pages/MapRidePro';
import RideHistoryPro from './pages/RideHistoryPro';
import ResetPassword from './pages/ResetPassword';
import LiveStatsBar from './pages/LiveStatsBar';
import ProfilePhoto from './pages/ProfilePhoto';
import RideRatingPanel from './pages/RideRatingPanel';
import Promotions from './pages/Promotions';
import HelpCenter from './pages/HelpCenter';
import { logoutFirebase } from './firebase';
import { BACKEND_URL } from './config';
import { getUnreadNotificationCount } from './services/notificationService';
import precoFixo17Car from './assets/precoFixo17Car';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './App.css';
import './styles/VisualPolish.css';
import './styles/UnifiedVisual.css';
import './styles/RideMapFinal.css';
import './styles/FinalDarkTheme.css';
import './styles/PrecoFixo17Mobile.css';
import './styles/ReferenceVisualLock.css';
import './styles/PrecoFixo17AccountMenu.css';

const getStored = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } };
const resolveUserPage = (user) => { if (!user) return 'home'; if (user.userType !== 'driver') return 'ride'; if (user.driverApprovalStatus === 'approved') return 'driver-dashboard'; if (user.driverApprovalStatus === 'pending') return 'driver-pending'; return 'driver-registration'; };
const isUserPage = (page, user) => { if (!user) return false; if (page === 'ride' || page === 'ride-history' || page === 'profile' || page === 'notifications' || page === 'payment' || page === 'promos' || page === 'help') return true; if (user.userType === 'driver' && user.driverApprovalStatus === 'approved' && page === 'driver-dashboard') return true; if (user.userType === 'driver' && user.driverApprovalStatus === 'pending' && page === 'driver-pending') return true; if (user.userType === 'driver' && user.driverApprovalStatus !== 'approved' && user.driverApprovalStatus !== 'pending' && page === 'driver-registration') return true; return false; };
const getInitialPage = () => { const params = new URLSearchParams(window.location.search); if (params.get('mode') === 'resetPassword' && params.get('oobCode')) return 'reset-password'; const token = localStorage.getItem('token'); const adminToken = localStorage.getItem('adminToken'); const admin = getStored('admin'); const user = getStored('user'); if (admin && adminToken) return 'admin-dashboard'; if (user && token) return resolveUserPage(user); return 'home'; };

function AccountPanel({ account, currentPage, onNavigate, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(() => getUnreadNotificationCount());
  const isDriver = account?.userType === 'driver' && account?.driverApprovalStatus === 'approved';
  useEffect(() => {
    const refresh = () => setUnreadNotifications(getUnreadNotificationCount());
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('pf17-notifications-updated', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('pf17-notifications-updated', refresh); };
  }, [account?.uid, account?.id, account?.email]);
  const menuItems = [
    { id: 'home', page: isDriver ? 'driver-dashboard' : 'ride', icon: '⌂', label: 'Início' },
    { id: 'ride', page: isDriver ? 'driver-dashboard' : 'ride', icon: '⌖', label: 'Solicitar corrida' },
    { id: 'history', page: 'ride-history', icon: '▤', label: 'Minhas corridas' },
    { id: 'payment', page: 'payment', icon: '💳', label: 'Pagamentos' },
    { id: 'promos', page: 'promos', icon: '🏷️', label: 'Promoções' },
    { id: 'notifications', page: 'notifications', icon: '🔔', label: 'Notificações' },
    { id: 'payment-methods', page: 'payment', icon: '💳', label: 'Formas de pagamento' },
    { id: 'help', page: 'help', icon: '❓', label: 'Ajuda' },
    { id: 'settings', page: 'profile', icon: '⚙️', label: 'Configurações' }
  ];
  const handleMenuClick = (item) => { setMenuOpen(false); onNavigate(item.page); };
  const userName = account?.name || account?.fullName || 'João Silva';
  const userRole = isDriver ? 'Motorista Parceiro' : 'Passageiro';
  const userRating = account?.rating || '4.9';
  return (
    <div className="pf-app-layout" style={{ minHeight: '100vh', background: '#050505' }}>
      <main style={{ minHeight: '100vh', position: 'relative' }}>
        {React.Children.map(children, (child) => React.isValidElement(child) ? React.cloneElement(child, { onOpenMenu: () => setMenuOpen(true), onOpenNotifications: () => onNavigate('notifications'), onNavigate }) : child)}
      </main>
      {menuOpen && (
        <div className="pf-drawer-backdrop" onClick={() => setMenuOpen(false)}>
          <aside className="pf-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="pf-drawer-user">
              <div className="pf-drawer-avatar"><img src={account?.profilePhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80'} alt={userName} /><div className="pf-drawer-online" /></div>
              <div className="pf-drawer-user-info"><div className="pf-drawer-user-name">{userName}</div><div className="pf-drawer-user-role">{userRole}</div><div className="pf-drawer-user-rating"><span>★</span><span>{userRating}</span></div></div>
              <button type="button" className="pf-drawer-bell" onClick={() => { setMenuOpen(false); onNavigate('notifications'); }} aria-label="Notificações">🔔</button>
            </div>
            <nav className="pf-drawer-menu">
              {menuItems.map((item) => {
                const isActive = (item.id === 'home' && (currentPage === 'ride' || currentPage === 'driver-dashboard')) || (item.id === 'history' && currentPage === 'ride-history') || (item.id === 'notifications' && currentPage === 'notifications') || (item.id === 'payment' && currentPage === 'payment') || (item.id === 'promos' && currentPage === 'promos') || (item.id === 'help' && currentPage === 'help') || (item.id === 'settings' && currentPage === 'profile');
                return <button key={item.id} type="button" className={`pf-drawer-item ${isActive ? 'active' : ''}`} onClick={() => handleMenuClick(item)}><span className="pf-drawer-icon">{item.icon}</span><span>{item.label}</span>{item.id === 'notifications' && unreadNotifications > 0 && <span className="pf-drawer-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</button>;
              })}
              <button type="button" className="pf-drawer-logout" onClick={() => { setMenuOpen(false); onLogout?.(); }}><span className="pf-drawer-icon">↪</span><span>Sair</span></button>
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}

function DriverPending({ user, onLogout }) { return <div style={{ minHeight: '100vh', background: '#090909', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Arial' }}><div style={{ maxWidth: 520, width: '100%', background: '#151515', border: '1px solid #ff5a00', borderRadius: 16, padding: 28, textAlign: 'center' }}><ProfilePhoto account={user} compact /><div style={{ fontSize: 54 }}>⏳</div><h1>Cadastro em análise</h1><p style={{ color: '#ccc', lineHeight: 1.6 }}>{user?.name ? `${user.name}, ` : ''}seu cadastro de motorista foi enviado e aguarda aprovação.</p><p style={{ color: '#999', fontSize: 13 }}>Esta tela será atualizada automaticamente quando o administrador revisar o cadastro.</p><button type="button" onClick={onLogout} style={{ border: 0, borderRadius: 10, padding: '12px 20px', background: '#ff5a00', color: '#fff', fontWeight: 700 }}>Sair</button></div></div>; }

function App() {
  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [user, setUser] = useState(() => getStored('user'));
  const [admin, setAdmin] = useState(() => getStored('admin'));
  useEffect(() => { if (admin && localStorage.getItem('adminToken')) return undefined; const token = localStorage.getItem('token'); const storedUser = getStored('user'); if (!token || !storedUser) return undefined; let cancelled = false; const verifySession = async () => { try { const response = await fetch(`${BACKEND_URL}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }); const data = await response.json().catch(() => ({})); if (cancelled) return; if (response.ok && data.valid && data.user) { localStorage.setItem('user', JSON.stringify(data.user)); setUser(data.user); setCurrentPage((page) => isUserPage(page, data.user) ? page : resolveUserPage(data.user)); } else if (response.status === 401) { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); setCurrentPage('login'); } } catch (_) {} }; verifySession(); const interval = window.setInterval(verifySession, currentPage === 'driver-pending' ? 5000 : 30000); const onFocus = () => verifySession(); const onVisibility = () => { if (document.visibilityState === 'visible') verifySession(); }; window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onVisibility); return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener('focus', onFocus); window.removeEventListener('visibilitychange', onVisibility); }; }, [admin, currentPage]);
  useEffect(() => { const onPhoto = (event) => { const uid = event.detail?.uid; const storedUser = getStored('user'); const storedAdmin = getStored('admin'); if (storedUser && (!uid || storedUser.uid === uid)) setUser({ ...storedUser, profilePhoto: event.detail.photo || null }); if (storedAdmin && (!uid || storedAdmin.uid === uid)) setAdmin({ ...storedAdmin, profilePhoto: event.detail.photo || null }); }; window.addEventListener('profile-photo-updated', onPhoto); return () => window.removeEventListener('profile-photo-updated', onPhoto); }, []);
  const handleUserLogin = (userData) => { setUser(userData); setAdmin(null); localStorage.setItem('user', JSON.stringify(userData)); localStorage.removeItem('admin'); localStorage.removeItem('adminToken'); setCurrentPage(resolveUserPage(userData)); };
  const handleLogout = async () => { await logoutFirebase(); setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); setCurrentPage('home'); };
  const handleDriverRegistration = (registration) => { const currentUser = getStored('user') || user || {}; const updatedUser = { ...currentUser, userType: 'driver', driverApprovalStatus: registration?.status || 'pending' }; setUser(updatedUser); localStorage.setItem('user', JSON.stringify(updatedUser)); setCurrentPage(resolveUserPage(updatedUser)); };
  const handleAdminLogin = (adminData) => { setUser(null); setAdmin(adminData); localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.setItem('admin', JSON.stringify(adminData)); setCurrentPage('admin-dashboard'); };
  const handleAdminLogout = () => { try { localStorage.removeItem('adminToken'); localStorage.removeItem('admin'); localStorage.removeItem('token'); localStorage.removeItem('user'); sessionStorage.clear(); } catch (_) {} setAdmin(null); setUser(null); setCurrentPage('home'); window.location.assign('/?loggedOut=1'); };
  const navigate = (page) => setCurrentPage(page);
  // Ride creation is now dispatched authoritatively by the unified backend.
  // Keeping a second client-side dispatcher caused duplicate requests and is obsolete.
  const handleRideCreate = () => {};
  if (admin && localStorage.getItem('adminToken')) return <AdminDashboardLive admin={admin} onLogout={handleAdminLogout} />;
  if (currentPage === 'admin-login' || currentPage === 'admin-dashboard') return <AdminLogin onAdminLogin={handleAdminLogin} onBack={() => setCurrentPage('home')} />;
  switch (currentPage) {
    case 'login': return <Login onLoginSuccess={handleUserLogin} onAdminClick={() => setCurrentPage('admin-login')} onDriverRegisterClick={() => setCurrentPage('driver-registration')} onBack={() => setCurrentPage('home')} />;
    case 'register': return <Register onRegisterSuccess={handleUserLogin} onBack={() => setCurrentPage('home')} />;
    case 'reset-password': return <ResetPassword onBackToLogin={() => { window.history.replaceState({}, '', window.location.pathname); setCurrentPage('login'); }} />;
    case 'ride': return user ? <AccountPanel account={user} currentPage="ride" onNavigate={navigate} onLogout={handleLogout}><LiveStatsBar userType="passenger" /><MapRidePro onRideCreate={handleRideCreate} onBack={() => setCurrentPage('ride')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} onAdminClick={() => setCurrentPage('admin-login')} onDriverRegisterClick={() => setCurrentPage('driver-registration')} onBack={() => setCurrentPage('home')} />;
    case 'ride-history': return user ? <AccountPanel account={user} currentPage="ride-history" onNavigate={navigate} onLogout={handleLogout}><RideHistoryPro user={user} onBack={() => setCurrentPage(user.userType === 'driver' ? 'driver-dashboard' : 'ride')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} onAdminClick={() => setCurrentPage('admin-login')} onDriverRegisterClick={() => setCurrentPage('driver-registration')} onBack={() => setCurrentPage('home')} />;
    case 'driver-registration': return <DriverRegistration onRegistrationSubmit={handleDriverRegistration} onBack={() => setCurrentPage('home')} />;
    case 'driver-pending': return <DriverPending user={user} onLogout={handleLogout} />;
    case 'driver-dashboard': return user ? <AccountPanel account={user} currentPage="driver-dashboard" onNavigate={navigate} onLogout={handleLogout}><LiveStatsBar userType="driver" /><DriverDashboardMapPro /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} onAdminClick={() => setCurrentPage('admin-login')} onDriverRegisterClick={() => setCurrentPage('driver-registration')} onBack={() => setCurrentPage('home')} />;
    case 'profile': return user ? <AccountPanel account={user} currentPage="profile" onNavigate={navigate} onLogout={handleLogout}><UserProfile user={user} onLogout={handleLogout} onBack={() => setCurrentPage('ride')} onNavigate={navigate} onRequestRide={() => setCurrentPage('ride')} onHistory={() => setCurrentPage('ride-history')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} onAdminClick={() => setCurrentPage('admin-login')} onDriverRegisterClick={() => setCurrentPage('driver-registration')} onBack={() => setCurrentPage('home')} />;
    case 'admin-panel': return <AdminPanel />;
    case 'payment': return user ? <AccountPanel account={user} currentPage="payment" onNavigate={navigate} onLogout={handleLogout}><Payment rideId={null} amount={17} onBack={() => setCurrentPage('ride')} onPaymentSuccess={() => setCurrentPage('ride-history')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} onAdminClick={() => setCurrentPage('admin-login')} onDriverRegisterClick={() => setCurrentPage('driver-registration')} onBack={() => setCurrentPage('home')} />;
    case 'promos': return user ? <AccountPanel account={user} currentPage="promos" onNavigate={navigate} onLogout={handleLogout}><Promotions userId={user?.uid || user?.id} onApplyCode={(promo) => { if (promo?.code) localStorage.setItem('pf_selected_promo', String(promo.code)); }} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} onAdminClick={() => setCurrentPage('admin-login')} onDriverRegisterClick={() => setCurrentPage('driver-registration')} onBack={() => setCurrentPage('home')} />;
    case 'help': return user ? <AccountPanel account={user} currentPage="help" onNavigate={navigate} onLogout={handleLogout}><HelpCenter onBack={() => setCurrentPage('ride')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} onAdminClick={() => setCurrentPage('admin-login')} onDriverRegisterClick={() => setCurrentPage('driver-registration')} onBack={() => setCurrentPage('home')} />;
    case 'notifications': return user ? <AccountPanel account={user} currentPage="notifications" onNavigate={navigate} onLogout={handleLogout}><NotificationCenter onBack={() => setCurrentPage('ride')} /></AccountPanel> : <Login onLoginSuccess={handleUserLogin} onAdminClick={() => setCurrentPage('admin-login')} onDriverRegisterClick={() => setCurrentPage('driver-registration')} onBack={() => setCurrentPage('home')} />;
    default: return <div className="home-page"><div className="home-hero"><div className="home-copy"><div className="home-brand-lockup"><span>PREÇO</span><strong>FIXO</strong><em>17</em></div><div className="home-tagline">📍 NA CIDADE • CORRIDA PARTICULAR</div><h1>Preço justo.<br /><strong>Sem surpresa.</strong></h1><p>Corridas particulares com preço justo, segurança, conforto e atendimento para você chegar ao seu destino.</p><div className="home-feature-row"><span>💰 Preço justo</span><span>🛡️ Segurança</span><span>⏱️ Pontualidade</span></div><div className="home-buttons"><button type="button" onClick={() => setCurrentPage('login')} className="btn-home">👤 ENTRAR</button><button type="button" onClick={() => setCurrentPage('register')} className="btn-home secondary">CRIAR CONTA</button></div><div style={{ marginTop: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}><button type="button" onClick={() => setCurrentPage('driver-registration')} style={{ background: 'none', border: '1px solid #ff5a00', color: '#ff5a00', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>🚗 Ser Motorista Parceiro</button><button type="button" onClick={() => setCurrentPage('admin-login')} style={{ background: 'none', border: 'none', color: '#6b7280', padding: '8px 4px', cursor: 'pointer', fontSize: '13px' }}>🔐 Painel Administrativo</button></div></div><div className="home-visual"><img src={precoFixo17Car} alt="PreçoFixo17" /></div></div></div>;
  }
}

function AppWithInsights() {
  return (
    <>
      <App />
      <SpeedInsights />
    </>
  );
}

export default AppWithInsights;
