import AsyncStorage from '@react-native-async-storage/async-storage';

export const BACKEND_URL = 'https://uber-clone-backend-production.up.railway.app';
const TOKEN_KEY = '@precofixo17/token';
const USER_KEY = '@precofixo17/user';

async function request(path, options = {}) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || `Erro ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function login(email, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  });
  await AsyncStorage.multiSet([
    [TOKEN_KEY, data.token],
    [USER_KEY, JSON.stringify(data.user || {})]
  ]);
  return data;
}

export async function register(payload) {
  const data = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...payload, userType: payload.userType || 'passenger' })
  });
  await AsyncStorage.multiSet([
    [TOKEN_KEY, data.token],
    [USER_KEY, JSON.stringify(data.user || {})]
  ]);
  return data;
}

export async function restoreSession() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const data = await request('/api/auth/verify');
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user || {}));
    return { token, user: data.user };
  } catch (error) {
    await logout();
    return null;
  }
}

export async function logout() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function requestRide(origin, destination) {
  return request('/api/rides/request', {
    method: 'POST',
    body: JSON.stringify({ origin, destination })
  });
}

export async function getActiveRide() {
  return request('/api/rides/active');
}

export async function searchRide(rideId) {
  return request(`/api/rides/${encodeURIComponent(rideId)}/search`, { method: 'POST' });
}
