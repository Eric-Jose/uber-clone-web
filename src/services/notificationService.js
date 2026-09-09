const getAccountKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.uid || user?.id || user?.email || 'guest';
  } catch (_) {
    return 'guest';
  }
};

const getStorageKey = () => `pf17_notifications_${getAccountKey()}`;

export const addInAppNotification = ({ id, type = 'system', title, message, timeAgo = 'agora' }) => {
  if (!title || !message) return;
  const key = getStorageKey();
  try {
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    const list = Array.isArray(current) ? current : [];
    const notificationId = String(id || `${type}-${Date.now()}`);
    if (list.some((item) => String(item?.id) === notificationId)) return;
    const next = [
      { id: notificationId, type, title, message, timeAgo, read: false },
      ...list,
    ].slice(0, 50);
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('pf17-notifications-updated'));
  } catch (_) {}
};

export const getUnreadNotificationCount = () => {
  try {
    const list = JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
    return Array.isArray(list) ? list.filter((item) => !item?.read).length : 0;
  } catch (_) {
    return 0;
  }
};
