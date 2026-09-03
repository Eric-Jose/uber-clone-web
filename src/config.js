// URL central da API. Em produção, o fallback aponta diretamente para o Railway.
// Mantém todos os endpoints do frontend no mesmo backend para evitar caminhos divergentes.
// Ride search: despacho automático + sala de motoristas + polling de fallback.
// Release marker: corrigir e publicar a procura automática de motorista.
export const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL ||
  'https://uber-clone-backend-production.up.railway.app'
).replace(/\/+$/, '');

export default BACKEND_URL;