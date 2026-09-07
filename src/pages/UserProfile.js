import React, { useEffect, useRef, useState } from 'react';
import '../styles/PrecoFixo17Reference.css';

const DEFAULT_ADDRESSES = [
  { id: 'home', label: 'Casa', address: '' },
  { id: 'work', label: 'Trabalho', address: '' }
];

function UserProfile({ user, onLogout, onBack, onNavigate }) {
  const [userData, setUserData] = useState({
    name: user?.name || user?.fullName || 'Usuário',
    role: user?.userType === 'driver' ? 'Motorista Parceiro' : 'Passageiro',
    email: user?.email || '',
    phone: user?.phone || '',
    rating: user?.rating || '5.0',
    profilePhoto: user?.profilePhoto || ''
  });
  const [addresses, setAddresses] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pf17_saved_addresses') || 'null');
      return Array.isArray(stored) ? stored : DEFAULT_ADDRESSES;
    } catch (_) {
      return DEFAULT_ADDRESSES;
    }
  });
  const [settings, setSettings] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pf17_settings') || 'null');
      return stored || { notifications: true, sounds: true };
    } catch (_) {
      return { notifications: true, sounds: true };
    }
  });
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (userData.profilePhoto) {
      try { localStorage.setItem('pf17_profile_photo', userData.profilePhoto); } catch (_) {}
    }
  }, [userData.profilePhoto]);

  const persistUser = (nextUser) => {
    try { localStorage.setItem('user', JSON.stringify(nextUser)); } catch (_) {}
  };

  const updateProfileName = () => {
    const nextName = window.prompt('Editar seu nome:', userData.name);
    if (!nextName || !nextName.trim()) return;
    const name = nextName.trim();
    const next = { ...userData, name };
    setUserData(next);
    persistUser({ ...(user || {}), name });
    setMessage('Nome atualizado com sucesso.');
  };

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Escolha uma imagem válida.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage('A foto deve ter no máximo 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const photo = String(reader.result || '');
      const next = { ...userData, profilePhoto: photo };
      setUserData(next);
      persistUser({ ...(user || {}), profilePhoto: photo });
      window.dispatchEvent(new CustomEvent('profile-photo-updated', { detail: { uid: user?.uid || user?.id, photo } }));
      setMessage('Foto de perfil atualizada.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const editAddress = (id) => {
    const current = addresses.find((item) => item.id === id);
    const value = window.prompt(`Endereço de ${current?.label || 'local'}:`, current?.address || '');
    if (value === null) return;
    const next = addresses.map((item) => item.id === id ? { ...item, address: value.trim() } : item);
    setAddresses(next);
    try { localStorage.setItem('pf17_saved_addresses', JSON.stringify(next)); } catch (_) {}
    setMessage('Endereço salvo.');
  };

  const toggleSetting = (key) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try { localStorage.setItem('pf17_settings', JSON.stringify(next)); } catch (_) {}
  };

  const closeModal = () => setModal(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (typeof onLogout === 'function') onLogout();
  };

  return (
    <div className="pf-profile-screen">
      <style>{`
        .pf-profile-screen{min-height:100vh;background:#050505;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column}
        .pf-prof-topbar{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #1c2128;position:sticky;top:0;background:rgba(5,5,5,.95);backdrop-filter:blur(10px);z-index:10}
        .pf-prof-back{background:transparent;border:none;color:#fff;cursor:pointer;padding:8px;display:flex;align-items:center;justify-content:center;border-radius:50%}
        .pf-prof-back:hover{background:#161b22}.pf-prof-title{font-size:17px;font-weight:700}
        .pf-prof-body{flex:1;max-width:440px;width:100%;margin:0 auto;padding:24px 16px 40px;display:flex;flex-direction:column}
        .pf-prof-hero{display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:28px}.pf-prof-avatar-wrap{position:relative;width:88px;height:88px;margin-bottom:14px}
        .pf-prof-avatar{width:100%;height:100%;border-radius:50%;border:3px solid #ff5a00;object-fit:cover;background:#1c212a}.pf-prof-avatar-edit{position:absolute;bottom:0;right:0;width:30px;height:30px;background:#ff5a00;border-radius:50%;border:2px solid #050505;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff}
        .pf-prof-name{font-size:20px;font-weight:800;margin:0 0 4px}.pf-prof-role{font-size:14px;color:#8e98a5;margin:0 0 4px}.pf-prof-email{font-size:13px;color:#6a7482;margin:0 0 8px}.pf-prof-rating{display:inline-flex;align-items:center;gap:4px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);color:#fbbf24;font-size:13px;font-weight:800;padding:4px 12px;border-radius:999px}
        .pf-prof-menu{display:flex;flex-direction:column;gap:10px;margin-bottom:28px}.pf-prof-item{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;background:#0f1216;border:1px solid #222832;border-radius:16px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:all .15s ease;text-align:left;width:100%}.pf-prof-item:hover{background:#14181e;transform:translateX(2px)}
        .pf-prof-item-left{display:flex;align-items:center;gap:14px}.pf-prof-item-icon{font-size:18px;color:#8e98a5}.pf-prof-chevron{color:#5c6674;font-size:18px}
        .pf-prof-logout-btn{width:100%;background:#dc2626;color:#fff;font-size:15px;font-weight:800;padding:15px;border:none;border-radius:999px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
        .pf-profile-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:100;display:flex;align-items:flex-end;justify-content:center;padding:16px}.pf-profile-modal{width:100%;max-width:440px;background:#0f1216;border:1px solid #2a313c;border-radius:22px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.55);max-height:80vh;overflow:auto}.pf-profile-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.pf-profile-modal-head h3{margin:0;font-size:18px}.pf-profile-close{border:0;background:#1a1f26;color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer}.pf-address-row,.pf-setting-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid #202631}.pf-address-copy{min-width:0}.pf-address-label{font-weight:800}.pf-address-value{margin-top:4px;color:#8e98a5;font-size:13px;overflow-wrap:anywhere}.pf-small-btn{border:1px solid #37404d;background:#161b22;color:#fff;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}.pf-toggle{border:0;border-radius:999px;padding:7px 12px;font-weight:800;cursor:pointer}.pf-toggle.on{background:#ff5a00;color:#fff}.pf-toggle.off{background:#252b34;color:#aeb7c4}.pf-profile-note{background:#112416;border:1px solid #245a32;color:#d9ffe2;border-radius:12px;padding:11px 12px;margin-bottom:14px;font-size:13px}
        @media (min-width:761px){.pf-profile-modal-backdrop{align-items:center}}
      `}</style>

      <header className="pf-prof-topbar">
        <button type="button" className="pf-prof-back" onClick={() => onBack?.()} aria-label="Voltar"><span style={{ fontSize: 24 }}>‹</span></button>
        <span className="pf-prof-title">Perfil</span><div style={{ width: 38 }} />
      </header>

      <main className="pf-prof-body">
        {message && <div className="pf-profile-note" role="status">{message}<button type="button" className="pf-prof-back" style={{ float:'right',padding:0,color:'#d9ffe2' }} onClick={() => setMessage('')}>×</button></div>}
        <div className="pf-prof-hero">
          <div className="pf-prof-avatar-wrap">
            <img src={userData.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=1c212a&color=ffffff&size=176`} alt={userData.name} className="pf-prof-avatar" />
            <button type="button" className="pf-prof-avatar-edit" title="Trocar foto" aria-label="Trocar foto" onClick={() => fileRef.current?.click()}>✎</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display:'none' }} />
          </div>
          <h2 className="pf-prof-name">{userData.name}</h2><div className="pf-prof-role">{userData.role}</div>
          {userData.email && <div className="pf-prof-email">{userData.email}</div>}
          <div className="pf-prof-rating"><span>★</span><span>{userData.rating}</span><span>★</span></div>
        </div>

        <div className="pf-prof-menu">
          <button type="button" className="pf-prof-item" onClick={updateProfileName}><div className="pf-prof-item-left"><span className="pf-prof-item-icon">👤</span><span>Informações pessoais</span></div><span className="pf-prof-chevron">›</span></button>
          <button type="button" className="pf-prof-item" onClick={() => setModal('addresses')}><div className="pf-prof-item-left"><span className="pf-prof-item-icon">📍</span><span>Endereços salvos</span></div><span className="pf-prof-chevron">›</span></button>
          <button type="button" className="pf-prof-item" onClick={() => onNavigate?.('payment')}><div className="pf-prof-item-left"><span className="pf-prof-item-icon">💳</span><span>Formas de pagamento</span></div><span className="pf-prof-chevron">›</span></button>
          <button type="button" className="pf-prof-item" onClick={() => setModal('ratings')}><div className="pf-prof-item-left"><span className="pf-prof-item-icon">⭐</span><span>Avaliar motoristas</span></div><span className="pf-prof-chevron">›</span></button>
          <button type="button" className="pf-prof-item" onClick={() => setModal('settings')}><div className="pf-prof-item-left"><span className="pf-prof-item-icon">⚙️</span><span>Configurações</span></div><span className="pf-prof-chevron">›</span></button>
          <button type="button" className="pf-prof-item" onClick={() => onNavigate?.('help')}><div className="pf-prof-item-left"><span className="pf-prof-item-icon">❓</span><span>Ajuda e suporte</span></div><span className="pf-prof-chevron">›</span></button>
        </div>

        <button type="button" className="pf-prof-logout-btn" onClick={handleLogout}>↪ <span>Sair da conta</span></button>
      </main>

      {modal && (
        <div className="pf-profile-modal-backdrop" onClick={closeModal}>
          <section className="pf-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pf-profile-modal-head"><h3>{modal === 'addresses' ? 'Endereços salvos' : modal === 'settings' ? 'Configurações' : 'Avaliações'}</h3><button type="button" className="pf-profile-close" onClick={closeModal} aria-label="Fechar">×</button></div>
            {modal === 'addresses' && addresses.map((item) => (
              <div className="pf-address-row" key={item.id}><div className="pf-address-copy"><div className="pf-address-label">{item.label}</div><div className="pf-address-value">{item.address || 'Nenhum endereço informado'}</div></div><button type="button" className="pf-small-btn" onClick={() => editAddress(item.id)}>Editar</button></div>
            ))}
            {modal === 'settings' && (
              <>
                <div className="pf-setting-row"><div><b>Notificações</b><div className="pf-address-value">Receber avisos de corridas e atualizações</div></div><button type="button" className={`pf-toggle ${settings.notifications ? 'on':'off'}`} onClick={() => toggleSetting('notifications')}>{settings.notifications ? 'Ativo' : 'Desligado'}</button></div>
                <div className="pf-setting-row"><div><b>Sons</b><div className="pf-address-value">Sons de chamada e mudança de status</div></div><button type="button" className={`pf-toggle ${settings.sounds ? 'on':'off'}`} onClick={() => toggleSetting('sounds')}>{settings.sounds ? 'Ativo' : 'Desligado'}</button></div>
              </>
            )}
            {modal === 'ratings' && (
              <div style={{ color:'#aeb7c4', lineHeight:1.6 }}><p>As avaliações são registradas ao finalizar uma corrida.</p><button type="button" className="pf-small-btn" onClick={() => { closeModal(); onNavigate?.('ride-history'); }}>Abrir minhas corridas</button></div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default UserProfile;
