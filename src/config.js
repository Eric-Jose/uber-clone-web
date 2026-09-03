// URL central da API. Em produção, o fallback aponta diretamente para o Railway.
// Mantém todos os endpoints do frontend no mesmo backend para evitar caminhos divergentes.
// Deploy: perfil, recuperação de senha e redefinição usam a mesma API.
// Deploy trigger: frontend conectado ao backend de produção.
// Ride search fix: driver room e polling preparados para novas solicitações.
// Deploy sync: publicar a correção mais recente da fila de motoristas.
export const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL ||
  'https://uber-clone-backend-production.up.railway.app'
).replace(/\/+$/, '');

export default BACKEND_URL;