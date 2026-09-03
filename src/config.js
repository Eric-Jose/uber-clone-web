// URL central da API. Em produção, o fallback aponta diretamente para o Railway.
// Mantém todos os endpoints do frontend no mesmo backend para evitar caminhos divergentes.
// Deploy: perfil, recuperação de senha e redefinição usam a mesma API.
// Ride search: despacho automático + sala de motoristas + polling de fallback.
// Deploy sync: publicar as correções mais recentes do fluxo de corridas.
export const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL ||
  'https://uber-clone-backend-production.up.railway.app'
).replace(/\/+$/, '');

export default BACKEND_URL;