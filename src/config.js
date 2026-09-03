// URL central da API. Em produção, o fallback aponta diretamente para o Railway.
// Mantém todos os endpoints do frontend no mesmo backend para evitar caminhos divergentes.
// Deploy: perfil do passageiro restaurado e navegação separada da corrida.
export const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL ||
  'https://uber-clone-backend-production.up.railway.app'
).replace(/\/+$/, '');

export default BACKEND_URL;
