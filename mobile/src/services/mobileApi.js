import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend oficial do PreçoFixo17. O backend vive no mesmo projeto Vercel.
// Não usar Railway ou outra origem externa aqui.
export const BACKEND_URL = 'https://uber-clone-web.vercel.app';

const TOKEN_KEY = '@precofixo17/token';
const USER_KEY = '@precofixo17/user';
const REQUEST_TIMEOUT_MS = 15000;

async function request(path, options = {}) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('O servidor demorou para responder. Tente novamente.');
    }
    throw new Error('Não foi possível conectar ao PreçoFixo17. Verifique sua internet.');
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  let data = {};
  if (raw && contentType.includes('application/json')) {
    try { data = JSON.parse(raw); } catch (_) { data = {}; }
  }

  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Erro ${response.status}`);
    error.status = response.status;
    if (response.status === 401) {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    }
    throw error;
  }

  return data;
}

export async function login(email, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  });
  if (!data?.token) throw new Error('Login realizado sem sessão válida.');
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
  if (!data?.token) throw new Error('Cadastro realizado sem sessão válida.');
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
    if (!data?.user) throw new Error('Sessão inválida.');
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return { token, user: data.user };
  } catch (error) {
    if (error?.status === 401 || error?.message === 'Sessão inválida.') await logout();
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
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
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
