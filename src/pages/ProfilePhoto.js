import React, { useEffect, useRef, useState } from 'react';

function resizeImage(file, maxSize = 512, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selecione uma imagem válida.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Não foi possível processar a foto.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
    reader.readAsDataURL(file);
  });
}

function ProfilePhoto({ account, compact = false }) {
  const inputRef = useRef(null);
  const uid = account?.uid || account?.email || 'default';
  const storageKey = `profilePhoto:${uid}`;
  const [photo, setPhoto] = useState(() => localStorage.getItem(storageKey) || account?.profilePhoto || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) setPhoto(stored);
    else if (account?.profilePhoto) setPhoto(account.profilePhoto);
  }, [storageKey, account?.profilePhoto]);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setMessage('A foto deve ter no máximo 8 MB.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const dataUrl = await resizeImage(file);
      localStorage.setItem(storageKey, dataUrl);
      setPhoto(dataUrl);
      setMessage('Foto de perfil atualizada.');
      window.dispatchEvent(new CustomEvent('profile-photo-updated', { detail: { storageKey, photo: dataUrl } }));
    } catch (error) {
      setMessage(error.message || 'Não foi possível atualizar a foto.');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = () => {
    localStorage.removeItem(storageKey);
    setPhoto('');
    setMessage('Foto removida.');
    window.dispatchEvent(new CustomEvent('profile-photo-updated', { detail: { storageKey, photo: '' } }));
  };

  const avatarSize = compact ? 64 : 104;
  const initials = (account?.name || account?.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '50%',
          overflow: 'hidden',
          background: '#e5e7eb',
          border: '3px solid #fff',
          boxShadow: '0 2px 10px rgba(0,0,0,.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto'
        }}
      >
        {photo ? <img src={photo} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: compact ? 26 : 42, fontWeight: 800, color: '#6b7280' }}>{initials}</span>}
      </div>

      <div>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Foto de perfil</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} style={{ border: 0, borderRadius: 9, padding: '9px 13px', background: '#111827', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            {busy ? 'Processando…' : photo ? '📷 Alterar foto' : '📷 Adicionar foto'}
          </button>
          {photo && <button type="button" onClick={removePhoto} disabled={busy} style={{ border: '1px solid #d1d5db', borderRadius: 9, padding: '9px 13px', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 700 }}>🗑️ Remover</button>}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} style={{ display: 'none' }} />
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>JPG, PNG ou WebP · imagem redimensionada automaticamente</div>
        {message && <div role="status" style={{ marginTop: 6, fontSize: 12, color: '#166534' }}>{message}</div>}
      </div>
    </div>
  );
}

export default ProfilePhoto;
