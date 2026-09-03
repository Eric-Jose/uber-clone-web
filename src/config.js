// URL central da API. Em produção, o fallback aponta diretamente para o Railway.
export const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL ||
  'https://uber-clone-backend-production.up.railway.app'
).replace(/\/+$/, '');

export default BACKEND_URL;
