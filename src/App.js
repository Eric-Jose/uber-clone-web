import React, { useState } from 'react';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import UserProfile from './pages/UserProfile';
import DriverRegistration from './pages/DriverRegistration';
import AdminPanel from './pages/AdminPanel';
import Payment from './pages/Payment';
import NotificationCenter from './pages/NotificationCenter';
import MapRide from './pages/MapRide';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('user')) || null; } catch { return null; } });
  const [admin, setAdmin] = useState(() => { try { return JSON.parse(localStorage.getItem('admin')) || null; } catch { return null; } });

  const handleUserLogin = (userData) => { setUser(userData); setCurrentPage(userData?.userType === 'driver' ? 'driver-registration' : 'profile'); };
  const handleUserLogout = () => { setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); setCurrentPage('home'); };
  const handleAdminLogin = (adminData) => { setAdmin(adminData); setCurrentPage('admin-dashboard'); };
  const handleAdminLogout = () => { setAdmin(null); localStorage.removeItem('adminToken'); localStorage.removeItem('admin'); setCurrentPage('home'); };

  if (admin) return <AdminDashboard admin={admin} onLogout={handleAdminLogout} />;
  if (currentPage === 'admin-login' || currentPage === 'admin-dashboard') return <AdminLogin onAdminLogin={handleAdminLogin} />;

  switch (currentPage) {
    case 'login': return <Login onLoginSuccess={handleUserLogin} />;
    case 'register': return <Register onRegisterSuccess={handleUserLogin} />;
    case 'ride': return <MapRide onRideCreate={() => setCurrentPage('profile')} onBack={() => setCurrentPage('profile')} />;
    case 'driver-registration': return <DriverRegistration onRegistrationSubmit={() => setCurrentPage('profile')} />;
    case 'profile': return user ? <UserProfile user={user} onLogout={handleUserLogout} onRequestRide={() => setCurrentPage('ride')} /> : <Login onLoginSuccess={handleUserLogin} />;
    case 'admin-panel': return <AdminPanel />;
    case 'payment': return <Payment rideId="RIDE001" amount={32.50} onPaymentSuccess={() => alert('Pagamento realizado!')} />;
    case 'notifications': return <NotificationCenter />;
    default: return (
      <div className="home-page"><div className="home-container"><h1>🚗 UberClone - Bem-vindo!</h1><p>Escolha uma opção para continuar:</p><div className="home-buttons"><button onClick={() => setCurrentPage('login')} className="btn-home">👤 Usuário</button><button onClick={() => setCurrentPage('admin-login')} className="btn-home admin">🔐 Administrador</button></div></div></div>
    );
  }
}
export default App;
